// @ts-check
/**
 * @module formula-editor
 * @description Phase 8 — Formula Editor (Tier 4 unique tool).
 *
 * Renders a LaTeX formula using an off-screen SVG (via a lightweight built-in
 * renderer) or by leveraging a MathJax/KaTeX CDN fallback, then converts the
 * result to a PNG image and embeds it at a chosen position in the PDF.
 *
 * Two rendering backends (in priority order):
 *   1. KaTeX (if loaded on the page or via dynamic import from CDN)
 *   2. MathJax 3 (fallback — heavier but universal)
 *   3. Built-in minimal renderer (superscript/subscript/basic Greek only)
 *
 * Public API:
 *   renderLatexToPng(latex, opts)               → Promise<Uint8Array>  (PNG bytes)
 *   insertFormulaIntoPdf(pdfBytes, pageNum, latex, x, y, opts)
 *                                               → Promise<Blob>
 *   FormulaEditor                               – interactive overlay widget
 *
 * Dependency on pdf-lib for PDF write-back (already in package.json).
 */

import { PDFDocument } from 'pdf-lib';
import { safeTimeout, clearSafeTimeout } from './safe-timers.js';

// ---------------------------------------------------------------------------
// Rendering backends
// ---------------------------------------------------------------------------

/** @type {any} */
let _katexInstance = null;

/**
 * Load KaTeX from the bundled npm package.
 * Also injects the KaTeX CSS into the page once (for correct rendering).
 * Returns null in non-browser environments (Node.js/tests) where Image.onload
 * never fires and the HTML→PNG pipeline would hang.
 */
async function _tryKatex() {
  // KaTeX rendering requires a real browser event loop (Image.onload, canvas)
  if (typeof window === 'undefined') return null;
  if (_katexInstance) return _katexInstance;
  try {
    // Load katex JS and CSS in parallel; CSS import is a no-op in non-Vite envs
    const [mod] = await Promise.all([
      import('katex'),
      import('katex/dist/katex.min.css').catch(() => {}),
    ]);
    _katexInstance = mod.default ?? mod;
    return _katexInstance;
  } catch (_e) { /* not available in this environment */ }
  return null;
}

/**
 * Attempt to load MathJax 3 from window.MathJax (if already loaded).
 */
function _tryMathJax() {
  return (typeof window !== 'undefined' && /** @type {any} */ (window).MathJax?.tex2svg) ? /** @type {any} */ (window).MathJax : null;
}

// ---------------------------------------------------------------------------
// renderLatexToPng
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} RenderOptions
 * @property {number} [fontSize=20]        pt — base font size in the output image
 * @property {string} [color='#000000']    Foreground colour
 * @property {string} [background='transparent']  Background colour ('transparent' = PNG alpha)
 * @property {number} [paddingPx=6]        Padding around the rendered formula
 * @property {number} [scale=2]            Device-pixel ratio for crisp rendering
 * @property {'display'|'inline'} [mode='display']
 */

/**
 * Render a LaTeX string to a PNG Uint8Array.
 *
 * @param {string} latex
 * @param {RenderOptions} [opts]
 * @returns {Promise<{png: Uint8Array, width: number, height: number}>}
 */
export async function renderLatexToPng(latex, opts = {}) {
  const fontSize   = opts.fontSize   || 20;
  const color      = opts.color      || '#000000';
  const bg         = opts.background || 'transparent';
  const padding    = opts.paddingPx  ?? 6;
  const scale      = opts.scale      ?? 2;
  const mode       = opts.mode       || 'display';

  // ── Backend: KaTeX ────────────────────────────────────────────────────────
  const katex = await _tryKatex();
  if (katex) {
    return _renderWithKatex(katex, latex, { fontSize, color, bg, padding, scale, mode });
  }

  // ── Backend: MathJax ─────────────────────────────────────────────────────
  const mj = _tryMathJax();
  if (mj) {
    return _renderWithMathJax(mj, latex, { fontSize, color, bg, padding, scale, mode });
  }

  // ── Fallback: minimal renderer ────────────────────────────────────────────
  return _renderFallback(latex, { fontSize, color, bg, padding, scale });
}

// ── KaTeX backend ────────────────────────────────────────────────────────────

async function _renderWithKatex(katex, latex, opts) {
  const { fontSize, color, bg, padding, scale, mode } = opts;

  // Render to HTML string
  let html;
  try {
    html = katex.renderToString(latex, {
      displayMode: mode === 'display',
      throwOnError: false,
      output: 'html',
    });
  } catch (err) {
    console.warn('[formula-editor] KaTeX error:', err.message);
    html = `<span style="color:red;font-family:monospace">${_escapeHtml(latex)}</span>`;
  }

  // Wrap in a full HTML document for off-screen rendering via iframe or blob URL
  // KaTeX CSS is bundled via `import 'katex/dist/katex.min.css'` at the top of this module.
  // For the off-screen SVG foreignObject approach we inline the minimal display rules;
  // full KaTeX styling is injected by Vite into the page's <head> automatically.
  const fullHtml = `<!DOCTYPE html>
<html><head>
<style>
  body { margin:0; padding:${padding}px; background:${bg === 'transparent' ? 'transparent' : bg};
         font-size:${fontSize}px; color:${color}; display:inline-block; }
  .katex-display { margin:0; }
  .katex { font-size:1em; }
</style>
</head><body>${html}</body></html>`;

  return _htmlToPng(fullHtml, scale);
}

// ── MathJax backend ──────────────────────────────────────────────────────────

async function _renderWithMathJax(mj, latex, opts) {
  const { fontSize, color, bg, padding, scale, mode } = opts;

  try {
    const svgNode = mj.tex2svg(latex, { display: mode === 'display' });
    const svgEl   = svgNode.querySelector('svg') || svgNode;
    svgEl.style.fill  = color;
    svgEl.style.color = color;

    // Wrap SVG in an HTML page and render via blob URL
    const svgStr = svgEl.outerHTML;
    const fullHtml = `<!DOCTYPE html>
<html><head>
<style>
  body { margin:0; padding:${padding}px; background:${bg === 'transparent' ? 'transparent' : bg};
         font-size:${fontSize}px; display:inline-block; }
  svg  { width:auto; height:1em; vertical-align:middle; }
</style>
</head><body>${svgStr}</body></html>`;

    return _htmlToPng(fullHtml, scale);
  } catch (err) {
    console.warn('[formula-editor] MathJax error:', err.message);
    return _renderFallback(latex, opts);
  }
}

// ── Fallback renderer (canvas-based) ─────────────────────────────────────────

/**
 * Very minimal renderer: substitutes common LaTeX tokens with Unicode,
 * then draws the result on a canvas.  Handles Greek letters, super/sub,
 * fractions (as a/b).
 */
function _renderFallback(latex, opts) {
  const { fontSize, color, bg, padding, scale } = opts;

  const display = _latexToUnicode(latex);
  const canvas  = document.createElement('canvas');
  const ctx     = canvas.getContext('2d');
  if (!ctx) return null;

  const fontPx = fontSize * scale;
  ctx.font = `${fontPx}px "Times New Roman", serif`;

  const metrics = ctx.measureText(display);
  const textW = metrics.width;
  const textH = fontPx * 1.4;

  canvas.width  = Math.ceil(textW + padding * 2 * scale);
  canvas.height = Math.ceil(textH + padding * 2 * scale);

  if (bg !== 'transparent') {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  ctx.font         = `${fontPx}px "Times New Roman", serif`;
  ctx.fillStyle    = color;
  ctx.textBaseline = 'top';
  ctx.fillText(display, padding * scale, padding * scale);

  return _canvasToPngResult(canvas, scale);
}

// ---------------------------------------------------------------------------
// insertFormulaIntoPdf
// ---------------------------------------------------------------------------

/**
 * Render `latex` and insert the resulting image into the PDF at position (x, y).
 *
 * @param {Uint8Array|ArrayBuffer} pdfBytes
 * @param {number} pageNum        1-based
 * @param {string} latex
 * @param {number} x              PDF pt from left edge
 * @param {number} y              PDF pt from bottom edge
 * @param {Object} [opts]
 * @param {number} [opts.maxWidth=200]   Maximum width in pt (image scaled to fit)
 * @param {RenderOptions} [opts.render]  Passed to renderLatexToPng
 * @returns {Promise<Blob>}
 */
export async function insertFormulaIntoPdf(pdfBytes, pageNum, latex, x, y, opts = {}) {
  const maxWidth   = opts.maxWidth || 200;
  const renderOpts = opts.render   || {};

  // Render formula to PNG
  const { png, width: pxW, height: pxH } = await renderLatexToPng(latex, renderOpts);

  // Load PDF
  const pdfDoc  = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const page    = pdfDoc.getPage(pageNum - 1);

  // Embed PNG
  const pngImage = await pdfDoc.embedPng(png);

  // Scale to maxWidth if needed (preserve aspect ratio)
  const scale  = Math.min(1, maxWidth / pxW);
  const drawW  = pxW * scale;
  const drawH  = pxH * scale;

  page.drawImage(pngImage, { x, y, width: drawW, height: drawH });

  const saved = await pdfDoc.save();
// @ts-ignore
  return new Blob([saved], { type: 'application/pdf' });
}

// ---------------------------------------------------------------------------
// FormulaEditor — interactive widget
// ---------------------------------------------------------------------------

/**
 * A floating editor widget that lets users type LaTeX and see a live preview,
 * then insert the rendered formula at the clicked position in the PDF.
 *
 * Usage:
 *   const fe = new FormulaEditor(pageContainer, pageWidthPt, pageHeightPt, zoom);
 *   fe.open(clickX_pt, clickY_pt);
 *   fe.on('insert', async ({ latex, x, y }) => {
 *     const blob = await insertFormulaIntoPdf(pdfBytes, pageNum, latex, x, y);
 *     // reload PDF …
 *   });
 */
export class FormulaEditor {
  constructor(pageContainer, pageWidthPt, pageHeightPt, zoom = 1) {
    this.container = pageContainer;
    this.pageW     = pageWidthPt;
    this.pageH     = pageHeightPt;
    this.zoom      = zoom;

    this._x = 0;
    this._y = 0;
    this._overlay   = null;
    this._previewEl = null;
    this._inputEl   = null;
    this._listeners = {};
    this._debounceTimer = null;
  }

// @ts-ignore
  /** @param {{x,y}} ptCoords  PDF pt coordinates of the insertion point */
  open(ptX, ptY) {
    if (this._overlay) this.close();

    this._x = ptX;
    this._y = ptY;

    this._buildOverlay();
    this._positionOverlay();
  }

  close() {
    if (this._overlay) {
      this._overlay.remove();
      this._overlay = null;
    }
    clearSafeTimeout(this._debounceTimer);
  }

  on(event, handler) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(handler);
    return this;
  }

  setZoom(zoom) {
    this.zoom = zoom;
    if (this._overlay) this._positionOverlay();
  }

  // ── Build UI ───────────────────────────────────────────────────────────────

  _buildOverlay() {
    const el = document.createElement('div');
    el.className = 'formula-editor-overlay';
    el.style.cssText = [
      'position:absolute',
      'z-index:300',
      'background:#fff',
      'border:2px solid #5C6BC0',
      'border-radius:8px',
      'box-shadow:0 6px 24px rgba(0,0,0,0.22)',
      'padding:12px',
      'min-width:320px',
      'max-width:500px',
      'font-family:Arial,sans-serif',
      'font-size:13px',
    ].join(';');

    // Title
    const title = document.createElement('div');
    title.textContent = 'Формула (LaTeX)';
    title.style.cssText = 'font-weight:bold;margin-bottom:8px;color:#3949AB;';
    el.appendChild(title);

    // LaTeX input
    const input = document.createElement('textarea');
    input.placeholder = 'Введите LaTeX, например: \\frac{x^2+1}{2}';
    input.style.cssText = [
      'width:100%',
      'min-height:60px',
      'font-family:"Courier New",monospace',
      'font-size:13px',
      'border:1px solid #ccc',
      'border-radius:4px',
      'padding:6px',
      'box-sizing:border-box',
      'resize:vertical',
    ].join(';');
    input.addEventListener('input', () => this._schedulePreview());
    this._inputEl = input;
    el.appendChild(input);

    // Preview area
    const previewLabel = document.createElement('div');
    previewLabel.textContent = 'Предпросмотр:';
    previewLabel.style.cssText = 'margin:8px 0 4px;color:#555;';
    el.appendChild(previewLabel);

    const preview = document.createElement('div');
    preview.style.cssText = [
      'min-height:50px',
      'border:1px dashed #ccc',
      'border-radius:4px',
      'padding:8px',
      'text-align:center',
      'background:#FAFAFA',
      'display:flex',
      'align-items:center',
      'justify-content:center',
    ].join(';');
    preview.textContent = 'Введите формулу для предпросмотра...';
    this._previewEl = preview;
    el.appendChild(preview);

    // Buttons
    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:8px;margin-top:10px;justify-content:flex-end;';

    const btnInsert = document.createElement('button');
    btnInsert.textContent = '↓ Вставить в PDF';
    btnInsert.style.cssText = 'padding:6px 14px;background:#5C6BC0;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:13px;';
    btnInsert.addEventListener('click', () => this._insert());

    const btnCancel = document.createElement('button');
    btnCancel.textContent = 'Отмена';
    btnCancel.style.cssText = 'padding:6px 14px;background:#f5f5f5;border:1px solid #ccc;border-radius:4px;cursor:pointer;font-size:13px;';
    btnCancel.addEventListener('click', () => this.close());

    btnRow.appendChild(btnInsert);
    btnRow.appendChild(btnCancel);
    el.appendChild(btnRow);

    this._overlay = el;
    this.container.style.position = 'relative';
    this.container.appendChild(el);

    input.focus();
  }

  _positionOverlay() {
    if (!this._overlay) return;
    const z = this.zoom;
    const canvasX = this._x * z;
    const canvasY = (this.pageH - this._y) * z;
    this._overlay.style.left = `${Math.min(canvasX, window.innerWidth - 350)}px`;
    this._overlay.style.top  = `${canvasY + 10}px`;
  }

  _schedulePreview() {
    clearSafeTimeout(this._debounceTimer);
    this._debounceTimer = safeTimeout(() => this._updatePreview(), 400);
  }

  async _updatePreview() {
    if (!this._previewEl || !this._inputEl) return;
    const latex = this._inputEl.value.trim();
    if (!latex) {
      this._previewEl.innerHTML = '';
      this._previewEl.textContent = 'Введите формулу для предпросмотра...';
      return;
    }

    try {
      const result = await renderLatexToPng(latex, { fontSize: 18, scale: 1 });
      if (!result) { this._previewEl.textContent = 'Render error'; return; }
      const { png, width, height } = result;
// @ts-ignore
      const blob = new Blob([png], { type: 'image/png' });
      const url  = URL.createObjectURL(blob);
      this._previewEl.innerHTML = '';
      const img = document.createElement('img');
      img.src = url;
      img.width = width;
      img.height = height;
      img.style.maxWidth = '100%';
      img.alt = 'formula';
      this._previewEl.appendChild(img);
      // Revoke after display
      safeTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (err) {
      this._previewEl.textContent = `Ошибка: ${err.message}`;
    }
  }

  _insert() {
    if (!this._inputEl) return;
    const latex = this._inputEl.value.trim();
    if (!latex) return;

    this._emit('insert', { latex, x: this._x, y: this._y });
    this.close();
  }

  _emit(event, data) {
    for (const fn of (this._listeners[event] || [])) {
      try { fn(data); } catch (e) { console.error('[formula-editor] event error:', e); }
    }
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Convert HTML string to PNG via a data-URL blob URL + off-screen image element. */
async function _htmlToPng(html, scale) {
  // We need a way to render HTML to canvas in a browser context.
  // Approach: create a Blob URL, load it in an off-screen Image via foreignObject in SVG.
  const svgDataUri = `data:image/svg+xml;charset=utf-8,
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="200">
  <foreignObject width="800" height="200">
    <body xmlns="http://www.w3.org/1999/xhtml" style="margin:0;padding:0">
      ${_escapeXml(html)}
    </body>
  </foreignObject>
</svg>`;

  // Fallback: render to canvas via Image + SVG foreignObject
  const canvas = document.createElement('canvas');
  canvas.width  = Math.round(800 * scale);
  canvas.height = Math.round(200 * scale);

  return new Promise((resolve, _reject) => {
    const img = new Image();
    img.onload = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(_renderFallback(html.replace(/<[^>]+>/g, ''), { fontSize: 20, color: '#000', bg: 'transparent', padding: 6, scale })); return; }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(_canvasToPngResult(canvas, scale));
    };
    img.onerror = () => {
      // SVG foreignObject approach failed (cross-origin etc) — fall back
      resolve(_renderFallback(html.replace(/<[^>]+>/g, ''), { fontSize: 20, color: '#000', bg: 'transparent', padding: 6, scale }));
    };
    img.src = svgDataUri;
  });
}

async function _canvasToPngResult(canvas, scale) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) { reject(new Error('canvas.toBlob returned null')); return; }
      const reader = new FileReader();
      reader.onload  = () => resolve({
        png:    new Uint8Array(/** @type {ArrayBuffer} */ (reader.result)),
        width:  Math.round(canvas.width  / scale),
        height: Math.round(canvas.height / scale),
      });
      reader.onerror = reject;
      reader.readAsArrayBuffer(blob);
    }, 'image/png');
  });
}

/** Minimal LaTeX → Unicode substitution for the fallback renderer. */
function _latexToUnicode(latex) {
  return latex
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1)/($2)')
    .replace(/\\sqrt\{([^}]+)\}/g, '√($1)')
    .replace(/\^2/g, '²')
    .replace(/\^3/g, '³')
    .replace(/\^n/g, 'ⁿ')
    .replace(/_0/g, '₀')
    .replace(/_1/g, '₁')
    .replace(/_2/g, '₂')
    .replace(/_n/g, 'ₙ')
    .replace(/\\alpha/g, 'α').replace(/\\beta/g, 'β').replace(/\\gamma/g, 'γ')
    .replace(/\\delta/g, 'δ').replace(/\\epsilon/g, 'ε').replace(/\\theta/g, 'θ')
    .replace(/\\lambda/g, 'λ').replace(/\\mu/g, 'μ').replace(/\\pi/g, 'π')
    .replace(/\\sigma/g, 'σ').replace(/\\phi/g, 'φ').replace(/\\omega/g, 'ω')
    .replace(/\\infty/g, '∞').replace(/\\sum/g, '∑').replace(/\\int/g, '∫')
    .replace(/\\partial/g, '∂').replace(/\\nabla/g, '∇')
    .replace(/\\leq/g, '≤').replace(/\\geq/g, '≥').replace(/\\neq/g, '≠')
    .replace(/\\approx/g, '≈').replace(/\\times/g, '×').replace(/\\div/g, '÷')
    .replace(/\\pm/g, '±').replace(/\\cdot/g, '·')
    .replace(/\{|\}/g, '')
    .replace(/\\/g, '')
    .trim();
}

function _escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function _escapeXml(s) {
  return encodeURIComponent(s);
}
