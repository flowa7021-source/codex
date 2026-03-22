// @ts-check
/**
 * @module visual-diff
 * @description Phase 8 — Visual Diff overlay mode.
 *
 * Compares two rendered PDF pages pixel-by-pixel and provides:
 *   • Side-by-side view (two canvases, synchronised scroll/zoom)
 *   • Overlay view (one canvas, opacity slider blends A over B)
 *   • Difference heat-map (per-pixel ΔE coloured from green → red)
 *   • Change summary (changed %, bounding rect of diff region)
 *
 * Integration:
 *   const diff = new VisualDiff(containerEl, opts);
 *   await diff.load(pdfBytesA, pdfBytesB, pageNumA, pageNumB);
 *   diff.setMode('overlay');   // 'side-by-side' | 'overlay' | 'heatmap'
 *   diff.setOpacity(0.5);      // overlay alpha [0..1]
 *
 * Standalone helpers:
 *   const result = await computePixelDiff(canvasA, canvasB, opts);
 *   // → { diffCanvas, changedPercent, diffRect, totalPixels, changedPixels }
 */

import { getDocument } from 'pdfjs-dist/build/pdf.mjs';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_RENDER_SCALE = 1.5;   // px per PDF point
const DIFF_THRESHOLD       = 15;    // per-channel tolerance (0-255)

// ---------------------------------------------------------------------------
// Public API — standalone helpers
// ---------------------------------------------------------------------------

/**
 * Render a single PDF page to an off-screen canvas.
 *
 * @param {Uint8Array|ArrayBuffer} pdfBytes
 * @param {number} pageNum   – 1-based
 * @param {number} scale     – CSS pixel density factor
 * @returns {Promise<HTMLCanvasElement>}
 */
export async function renderPageToCanvas(pdfBytes, pageNum, scale = DEFAULT_RENDER_SCALE) {
  const data   = pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes);
  const loadingTask = getDocument({ data });
  const pdfDoc = await loadingTask.promise;
  const page   = await pdfDoc.getPage(pageNum);

  const viewport = page.getViewport({ scale });
  const canvas   = document.createElement('canvas');
  canvas.width   = Math.round(viewport.width);
  canvas.height  = Math.round(viewport.height);

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  await page.render({ canvasContext: ctx, viewport }).promise;
  pdfDoc.destroy();
  return canvas;
}

/**
 * Compute per-pixel difference between two canvases.
 *
 * If the canvases have different dimensions the smaller one is scaled up to
 * match the larger one before comparison.
 *
 * @param {HTMLCanvasElement} canvasA
 * @param {HTMLCanvasElement} canvasB
 * @param {Object} [opts]
 * @param {number} [opts.threshold=15]   Per-channel change threshold (0-255)
 * @param {string} [opts.heatmapLow='#00c853']   Colour for small diff
 * @param {string} [opts.heatmapHigh='#d50000']  Colour for large diff
 * @returns {{
 *   diffCanvas: HTMLCanvasElement,
 *   changedPercent: number,
 *   changedPixels: number,
 *   totalPixels: number,
 *   diffRect: {x:number,y:number,width:number,height:number}|null
 * }}
 */
export function computePixelDiff(canvasA, canvasB, opts = {}) {
  const threshold    = opts.threshold    ?? DIFF_THRESHOLD;
  const heatmapLow   = opts.heatmapLow   ?? '#00c853';
  const heatmapHigh  = opts.heatmapHigh  ?? '#d50000';

  const [lowR, lowG, lowB]   = _hexToRgb(heatmapLow);
  const [highR, highG, highB] = _hexToRgb(heatmapHigh);

  // Unify dimensions
  const w = Math.max(canvasA.width,  canvasB.width);
  const h = Math.max(canvasA.height, canvasB.height);

  const dataA = _getScaledImageData(canvasA, w, h);
  const dataB = _getScaledImageData(canvasB, w, h);

  const diffCanvas = document.createElement('canvas');
  diffCanvas.width  = w;
  diffCanvas.height = h;
  const diffCtx = diffCanvas.getContext('2d');
  if (!diffCtx) return { diffCanvas, changedPercent: 0, changedPixels: 0, totalPixels: w * h, diffRect: null };
  const diffImg = diffCtx.createImageData(w, h);
  const out     = diffImg.data;
  const a       = dataA.data;
  const b       = dataB.data;

  let changedPixels = 0;
  let minX = w, minY = h, maxX = 0, maxY = 0;

  for (let i = 0; i < w * h; i++) {
    const off = i * 4;
    const dr  = Math.abs(a[off]     - b[off]);
    const dg  = Math.abs(a[off + 1] - b[off + 1]);
    const db  = Math.abs(a[off + 2] - b[off + 2]);
    const delta = (dr + dg + db) / 3;   // mean channel delta [0..255]

    if (dr > threshold || dg > threshold || db > threshold) {
      changedPixels++;
      const t   = Math.min(delta / 255, 1);   // normalised [0..1]
      out[off]     = Math.round(lowR + t * (highR - lowR));
      out[off + 1] = Math.round(lowG + t * (highG - lowG));
      out[off + 2] = Math.round(lowB + t * (highB - lowB));
      out[off + 3] = Math.round(128 + t * 127);   // 50-100 % opacity

      const px = i % w;
      const py = Math.floor(i / w);
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;
    } else {
      // Unchanged: draw A pixel at 20 % opacity (greyed out)
      out[off]     = a[off];
      out[off + 1] = a[off + 1];
      out[off + 2] = a[off + 2];
      out[off + 3] = 51;   // ~20 %
    }
  }

  diffCtx.putImageData(diffImg, 0, 0);

  const totalPixels    = w * h;
  const changedPercent = (changedPixels / totalPixels) * 100;
  const diffRect       = changedPixels > 0
    ? { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
    : null;

  return { diffCanvas, changedPercent, changedPixels, totalPixels, diffRect };
}

// ---------------------------------------------------------------------------
// VisualDiff — UI controller
// ---------------------------------------------------------------------------

/**
 * @typedef {'side-by-side'|'overlay'|'heatmap'} DiffMode
 */

export class VisualDiff {
  /**
   * @param {HTMLElement} container  – Host element (will be filled by the UI)
   * @param {Object} [opts]
   * @param {number} [opts.scale=1.5]       Render resolution multiplier
   * @param {number} [opts.threshold=15]    Pixel change threshold
   * @param {string} [opts.labelA='Version A']
   * @param {string} [opts.labelB='Version B']
   */
  constructor(container, opts = {}) {
    this._container  = container;
    this._scale      = opts.scale     ?? DEFAULT_RENDER_SCALE;
    this._threshold  = opts.threshold ?? DIFF_THRESHOLD;
    this._labelA     = opts.labelA    ?? 'Version A';
    this._labelB     = opts.labelB    ?? 'Version B';

    /** @type {DiffMode} */
    this._mode       = 'side-by-side';
    this._opacity    = 0.5;

    /** @type {HTMLCanvasElement|null} */
    this._canvasA    = null;
    /** @type {HTMLCanvasElement|null} */
    this._canvasB    = null;
    /** @type {HTMLCanvasElement|null} */
    this._diffCanvas = null;

    this._result     = null;   // last computePixelDiff result
    this._ui         = null;   // { root, viewA, viewB, overlay, heatmap, summary, opacitySlider }

    this._buildShell();
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Load and render two PDF pages, then run the diff.
   *
   * @param {Uint8Array|ArrayBuffer} pdfBytesA
   * @param {Uint8Array|ArrayBuffer} pdfBytesB
   * @param {number} [pageNumA=1]
   * @param {number} [pageNumB=1]
   */
  async load(pdfBytesA, pdfBytesB, pageNumA = 1, pageNumB = 1) {
    this._showStatus('Rendering pages…');

    const [cA, cB] = await Promise.all([
      renderPageToCanvas(pdfBytesA, pageNumA, this._scale),
      renderPageToCanvas(pdfBytesB, pageNumB, this._scale),
    ]);

    this._canvasA = cA;
    this._canvasB = cB;

    this._showStatus('Computing diff…');
    this._result = computePixelDiff(cA, cB, { threshold: this._threshold });
    this._diffCanvas = this._result.diffCanvas;

    this._renderView();
    this._updateSummary();
  }

  /**
   * Switch the display mode.
   * @param {DiffMode} mode
   */
  setMode(mode) {
    this._mode = mode;
    this._renderView();
    this._syncModeButtons();
  }

  /**
   * Set overlay opacity [0..1].  Only visible in 'overlay' mode.
   * @param {number} alpha
   */
  setOpacity(alpha) {
    this._opacity = Math.max(0, Math.min(1, alpha));
    if (this._mode === 'overlay') this._renderOverlay();
    if (this._ui) this._ui.opacitySlider.value = String(Math.round(this._opacity * 100));
  }

  /** Remove all DOM and free resources. */
  destroy() {
    this._container.innerHTML = '';
    this._canvasA    = null;
    this._canvasB    = null;
    this._diffCanvas = null;
    this._result     = null;
    this._ui         = null;
  }

  // ── Shell ──────────────────────────────────────────────────────────────────

  _buildShell() {
    this._container.innerHTML = '';
    this._container.style.cssText = [
      'display:flex', 'flex-direction:column', 'height:100%',
      'background:#1e1e1e', 'color:#fff', 'font-family:sans-serif',
      'user-select:none', 'overflow:hidden',
    ].join(';');

    // Toolbar
    const toolbar = document.createElement('div');
    toolbar.style.cssText = [
      'display:flex', 'align-items:center', 'gap:8px',
      'padding:6px 10px', 'background:#2d2d2d', 'border-bottom:1px solid #444',
      'flex-shrink:0',
    ].join(';');

    // Mode buttons
    const modes = /** @type {DiffMode[]} */ (['side-by-side', 'overlay', 'heatmap']);
    const modeLabels = { 'side-by-side': 'Side-by-Side', overlay: 'Overlay', heatmap: 'Heat Map' };
    const modeButtons = {};
    modes.forEach(m => {
      const btn = document.createElement('button');
      btn.textContent = modeLabels[m];
      btn.dataset.mode = m;
      btn.style.cssText = _btnStyle(m === this._mode);
      btn.addEventListener('click', () => this.setMode(m));
      toolbar.appendChild(btn);
      modeButtons[m] = btn;
    });

    // Separator
    toolbar.appendChild(_separator());

    // Opacity label + slider
    const opLabel = document.createElement('span');
    opLabel.textContent = 'Opacity:';
    opLabel.style.fontSize = '13px';

    const opSlider = document.createElement('input');
    opSlider.type  = 'range';
    opSlider.min   = '0';
    opSlider.max   = '100';
    opSlider.value = String(Math.round(this._opacity * 100));
    opSlider.style.cssText = 'width:100px;cursor:pointer';
    opSlider.addEventListener('input', () => this.setOpacity(Number(opSlider.value) / 100));

    const opValue = document.createElement('span');
    opValue.style.cssText = 'font-size:12px;min-width:32px;text-align:right';
    opSlider.addEventListener('input', () => { opValue.textContent = `${opSlider.value}%`; });
    opValue.textContent = `${opSlider.value}%`;

    toolbar.append(opLabel, opSlider, opValue);

    // Separator + summary
    toolbar.appendChild(_separator());

    const summary = document.createElement('span');
    summary.style.cssText = 'font-size:12px;color:#aaa;margin-left:auto';
    summary.textContent    = 'No diff loaded';

    toolbar.appendChild(summary);

    // Viewport
    const viewport = document.createElement('div');
    viewport.style.cssText = [
      'flex:1', 'overflow:auto', 'position:relative',
      'display:flex', 'align-items:flex-start', 'justify-content:center',
      'padding:12px', 'gap:12px',
    ].join(';');

    const statusEl = document.createElement('div');
    statusEl.style.cssText = [
      'position:absolute', 'top:50%', 'left:50%',
      'transform:translate(-50%,-50%)',
      'color:#aaa', 'font-size:15px',
    ].join(';');
    statusEl.textContent = 'Load two PDF documents to compare.';
    viewport.appendChild(statusEl);

    this._container.append(toolbar, viewport);
    this._ui = {
      toolbar, viewport, statusEl,
      modeButtons, summary,
      opacitySlider: opSlider, opValue,
    };
  }

  // ── Status ─────────────────────────────────────────────────────────────────

  _showStatus(msg) {
    if (!this._ui) return;
    this._ui.statusEl.textContent  = msg;
    this._ui.statusEl.style.display = 'block';
  }

  _hideStatus() {
    if (this._ui) this._ui.statusEl.style.display = 'none';
  }

  // ── View rendering ─────────────────────────────────────────────────────────

  _renderView() {
    if (!this._canvasA || !this._canvasB) return;

    // Clear the viewport (except status overlay)
    const vp = this._ui.viewport;
    while (vp.firstChild && vp.firstChild !== this._ui.statusEl) vp.removeChild(vp.firstChild);
    this._hideStatus();

    switch (this._mode) {
      case 'side-by-side': this._renderSideBySide(); break;
      case 'overlay':      this._renderOverlay();     break;
      case 'heatmap':      this._renderHeatmap();     break;
    }
  }

  _renderSideBySide() {
    const vp = this._ui.viewport;
    vp.style.flexDirection  = 'row';

    vp.appendChild(_labelledCanvas(this._canvasA, this._labelA));
    vp.appendChild(_labelledCanvas(this._canvasB, this._labelB));
  }

  _renderOverlay() {
    if (!this._canvasA || !this._canvasB) return;
    const vp = this._ui.viewport;
    vp.style.flexDirection = 'column';

    // Composite: draw B then A at this._opacity on top
    const w = Math.max(this._canvasA.width,  this._canvasB.width);
    const h = Math.max(this._canvasA.height, this._canvasB.height);

    const composite = document.createElement('canvas');
    composite.width  = w;
    composite.height = h;
    const ctx = composite.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(this._canvasB, 0, 0, w, h);
    ctx.globalAlpha = this._opacity;
    ctx.drawImage(this._canvasA, 0, 0, w, h);
    ctx.globalAlpha = 1;

    const label = `${this._labelA} (${Math.round(this._opacity * 100)} %) over ${this._labelB}`;
    vp.appendChild(_labelledCanvas(composite, label));
  }

  _renderHeatmap() {
    if (!this._diffCanvas) return;
    const vp = this._ui.viewport;
    vp.style.flexDirection = 'column';
    vp.appendChild(_labelledCanvas(this._diffCanvas, 'Difference Heat Map'));
  }

  // ── Summary ────────────────────────────────────────────────────────────────

  _updateSummary() {
    if (!this._ui || !this._result) return;
    const { changedPercent, changedPixels, totalPixels, diffRect } = this._result;
    const pct  = changedPercent.toFixed(2);
    const rect = diffRect
      ? `  ·  Diff region: ${diffRect.width}×${diffRect.height}px`
      : '  ·  Identical';
    this._ui.summary.textContent = `Changed: ${pct}% (${changedPixels.toLocaleString()} / ${totalPixels.toLocaleString()} px)${rect}`;
  }

  _syncModeButtons() {
    if (!this._ui) return;
    Object.entries(this._ui.modeButtons).forEach(([m, btn]) => {
      btn.style.cssText = _btnStyle(m === this._mode);
    });
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Return ImageData for a canvas, scaling to target dimensions if needed.
 * @param {HTMLCanvasElement} src
 * @param {number} w
 * @param {number} h
 * @returns {ImageData}
 */
function _getScaledImageData(src, w, h) {
  if (src.width === w && src.height === h) {
    const srcCtx = src.getContext('2d');
    if (!srcCtx) return new ImageData(w, h);
    return srcCtx.getImageData(0, 0, w, h);
  }
  const tmp = document.createElement('canvas');
  tmp.width  = w;
  tmp.height = h;
  const ctx  = tmp.getContext('2d');
  if (!ctx) return new ImageData(w, h);
  ctx.drawImage(src, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

/**
 * Parse a #RRGGBB hex color to [R, G, B] (0-255).
 * @param {string} hex
 * @returns {[number, number, number]}
 */
function _hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/**
 * Wrap a canvas in a labelled container div.
 * @param {HTMLCanvasElement} canvas
 * @param {string} label
 * @returns {HTMLDivElement}
 */
function _labelledCanvas(canvas, label) {
  const wrapper = document.createElement('div');
  wrapper.style.cssText = [
    'display:flex', 'flex-direction:column', 'align-items:center', 'gap:4px',
  ].join(';');

  const lbl = document.createElement('div');
  lbl.textContent  = label;
  lbl.style.cssText = 'font-size:12px;color:#ccc;letter-spacing:.5px';

  // Scale down for display: max 720px wide
  const display = document.createElement('canvas');
  const maxW    = 720;
  const ratio   = canvas.width > maxW ? maxW / canvas.width : 1;
  display.width  = Math.round(canvas.width  * ratio);
  display.height = Math.round(canvas.height * ratio);
  display.style.cssText = 'border:1px solid #444;border-radius:2px;box-shadow:0 2px 8px rgba(0,0,0,.5)';
  const displayCtx = display.getContext('2d');
  if (displayCtx) displayCtx.drawImage(canvas, 0, 0, display.width, display.height);

  wrapper.append(lbl, display);
  return wrapper;
}

function _btnStyle(active) {
  return [
    'padding:4px 10px',
    'border:none',
    'border-radius:3px',
    'cursor:pointer',
    'font-size:13px',
    active ? 'background:#0078d4;color:#fff' : 'background:#3c3c3c;color:#ddd',
  ].join(';');
}

function _separator() {
  const s = document.createElement('div');
  s.style.cssText = 'width:1px;height:20px;background:#555;margin:0 4px';
  return s;
}
