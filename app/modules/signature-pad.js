// @ts-check
/**
 * @module signature-pad
 * @description Digital signature pad for PDF documents.
 *
 * Three input modes:
 *   1. **Draw** — freehand canvas drawing with pressure-aware stroke
 *   2. **Type** — render typed name in a script/handwriting font
 *   3. **Image** — upload a signature image (PNG/JPEG)
 *
 * After creation the signature is embedded as a PNG into the PDF at the
 * user-specified position via pdf-lib.
 *
 * Usage:
 *   import { SignaturePad, insertSignatureIntoPdf } from './signature-pad.js';
 *
 *   const pad = new SignaturePad(containerEl, {
 *     onInsert: async (signatureData) => {
 *       const blob = await insertSignatureIntoPdf(pdfBytes, pageNum, signatureData);
 *     },
 *   });
 *   pad.open();
 */

import { PDFDocument } from 'pdf-lib';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAD_WIDTH       = 460;
const PAD_HEIGHT      = 180;
const STROKE_COLOR    = '#1a1a2e';
const STROKE_WIDTH    = 2.5;
const SIGNATURE_FONTS = [
  "'Dancing Script', cursive",
  "'Great Vibes', cursive",
  "'Pacifico', cursive",
  "cursive",
];

// ---------------------------------------------------------------------------
// Public API — embed signature into PDF
// ---------------------------------------------------------------------------

/**
 * Insert a signature PNG into a PDF page.
 *
 * @param {Uint8Array|ArrayBuffer} pdfBytes
 * @param {number} pageNum - 1-based
 * @param {Object} signatureData
 * @param {Uint8Array}  signatureData.pngBytes - signature image as PNG
 * @param {{ x: number, y: number }} signatureData.position - PDF coords (bottom-left origin)
 * @param {number} [signatureData.width=150]  - target width in PDF pt
 * @param {number} [signatureData.height]     - auto-computed if omitted
 * @returns {Promise<Blob>}
 */
export async function insertSignatureIntoPdf(pdfBytes, pageNum, signatureData) {
  const data   = pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes);
  const pdfDoc = await PDFDocument.load(data);
  const page   = pdfDoc.getPages()[pageNum - 1];
  if (!page) throw new Error(`Page ${pageNum} not found`);

  const image  = await pdfDoc.embedPng(signatureData.pngBytes);
  const targetW = signatureData.width ?? 150;
  const ratio   = image.height / image.width;
  const targetH = signatureData.height ?? targetW * ratio;

  page.drawImage(image, {
    x:      signatureData.position.x,
    y:      signatureData.position.y,
    width:  targetW,
    height: targetH,
  });

  const saved = await pdfDoc.save();
  return new Blob([/** @type {any} */ (saved)], { type: 'application/pdf' });
}

// ---------------------------------------------------------------------------
// SignaturePad — UI controller
// ---------------------------------------------------------------------------

export class SignaturePad {
  /**
   * @param {HTMLElement} container
   * @param {Object} deps
   * @param {Function} deps.onInsert - (signatureData: { pngBytes, position, width }) => void
   * @param {Function} [deps.onCancel]
   * @param {{ x: number, y: number }} [deps.defaultPosition={ x: 72, y: 72 }]
   * @param {number} [deps.defaultWidth=150]
   */
  constructor(container, deps) {
    this._container = container;
    this._deps      = deps;
    this._panel     = null;
    this._canvas    = null;
    this._ctx       = null;
    this._drawing   = false;
    this._points    = [];
    this._mode      = 'draw';   // 'draw' | 'type' | 'image'
    this._imageData = null;     // uploaded image bytes
    this._typedName = '';

    this._onMouseDown = this._onMouseDown.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onMouseUp   = this._onMouseUp.bind(this);
  }

  open() {
    if (this._panel) return;
    this._panel = this._buildPanel();
    this._container.appendChild(this._panel);
    this._initDrawCanvas();
  }

  close() {
    this._destroyDrawListeners();
    if (this._panel) {
      this._panel.remove();
      this._panel = null;
    }
  }

  // ── Panel builder ──────────────────────────────────────────────────────────

  _buildPanel() {
    const panel = document.createElement('div');
    panel.style.cssText = [
      'position:absolute', 'top:50%', 'left:50%', 'transform:translate(-50%,-50%)',
      'background:#2a2a2a', 'border:1px solid #555', 'border-radius:8px',
      'padding:20px', 'z-index:9000', 'min-width:500px',
      'box-shadow:0 8px 32px rgba(0,0,0,.6)', 'color:#eee', 'font-family:sans-serif',
    ].join(';');

    // Title
    const title = document.createElement('h3');
    title.textContent = 'Add Signature';
    title.style.cssText = 'margin:0 0 12px;font-size:16px;font-weight:600';
    panel.appendChild(title);

    // Mode tabs
    const tabs = document.createElement('div');
    tabs.style.cssText = 'display:flex;gap:0;margin-bottom:12px;border-bottom:1px solid #444';

    const modes = [
      { key: 'draw',  label: 'Draw' },
      { key: 'type',  label: 'Type' },
      { key: 'image', label: 'Image' },
    ];

    this._tabBtns = {};
    for (const m of modes) {
      const btn = document.createElement('button');
      btn.textContent = m.label;
      btn.dataset.mode = m.key;
      btn.style.cssText = this._tabStyle(m.key === this._mode);
      btn.addEventListener('click', () => this._switchMode(m.key));
      tabs.appendChild(btn);
      this._tabBtns[m.key] = btn;
    }
    panel.appendChild(tabs);

    // Draw area
    this._drawArea = document.createElement('div');
    this._drawArea.style.cssText = 'margin-bottom:12px';

    this._canvas = document.createElement('canvas');
    this._canvas.width  = PAD_WIDTH;
    this._canvas.height = PAD_HEIGHT;
    this._canvas.style.cssText = [
      'border:1px solid #555', 'border-radius:4px', 'cursor:crosshair',
      'background:#fff', `width:${PAD_WIDTH}px`, `height:${PAD_HEIGHT}px`,
    ].join(';');
    this._drawArea.appendChild(this._canvas);
    panel.appendChild(this._drawArea);

    // Type area (hidden)
    this._typeArea = document.createElement('div');
    this._typeArea.style.display = 'none';

    const nameInput = document.createElement('input');
    nameInput.type        = 'text';
    nameInput.placeholder = 'Type your name…';
    nameInput.style.cssText = [
      'width:100%', 'padding:12px', 'border:1px solid #555',
      'border-radius:4px', 'background:#fff', 'color:#1a1a2e',
      `font-family:${SIGNATURE_FONTS[0]}`, 'font-size:32px',
      'box-sizing:border-box',
    ].join(';');
    nameInput.addEventListener('input', () => {
      this._typedName = nameInput.value;
      this._renderTypedPreview();
    });
    this._typeArea.appendChild(nameInput);
    this._nameInput = nameInput;

    this._typePreview = document.createElement('canvas');
    this._typePreview.width  = PAD_WIDTH;
    this._typePreview.height = PAD_HEIGHT;
    this._typePreview.style.cssText = [
      'border:1px solid #555', 'border-radius:4px', 'margin-top:8px',
      'background:#fff', `width:${PAD_WIDTH}px`, `height:${PAD_HEIGHT}px`,
    ].join(';');
    this._typeArea.appendChild(this._typePreview);
    panel.appendChild(this._typeArea);

    // Image area (hidden)
    this._imageArea = document.createElement('div');
    this._imageArea.style.display = 'none';

    const fileInput = document.createElement('input');
    fileInput.type   = 'file';
    fileInput.accept = 'image/png,image/jpeg';
    fileInput.style.cssText = 'font-size:13px;color:#ccc';
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      this._imageData = new Uint8Array(await file.arrayBuffer());
      this._renderImagePreview();
    });
    this._imageArea.appendChild(fileInput);

    this._imagePreview = document.createElement('canvas');
    this._imagePreview.width  = PAD_WIDTH;
    this._imagePreview.height = PAD_HEIGHT;
    this._imagePreview.style.cssText = [
      'border:1px solid #555', 'border-radius:4px', 'margin-top:8px',
      'background:#fff', `width:${PAD_WIDTH}px`, `height:${PAD_HEIGHT}px`,
    ].join(';');
    this._imageArea.appendChild(this._imagePreview);
    panel.appendChild(this._imageArea);

    // Buttons
    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:10px;justify-content:flex-end';

    const clearBtn = document.createElement('button');
    clearBtn.textContent = 'Clear';
    clearBtn.style.cssText = 'padding:6px 14px;border:1px solid #666;border-radius:4px;background:transparent;color:#ccc;cursor:pointer';
    clearBtn.addEventListener('click', () => this._clear());

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = 'padding:6px 14px;border:1px solid #666;border-radius:4px;background:transparent;color:#ccc;cursor:pointer';
    cancelBtn.addEventListener('click', () => {
      this.close();
      this._deps.onCancel?.();
    });

    const insertBtn = document.createElement('button');
    insertBtn.textContent = 'Insert';
    insertBtn.style.cssText = 'padding:6px 14px;border:none;border-radius:4px;background:#0078d4;color:#fff;cursor:pointer;font-weight:600';
    insertBtn.addEventListener('click', () => this._handleInsert());

    btnRow.append(clearBtn, cancelBtn, insertBtn);
    panel.appendChild(btnRow);

    return panel;
  }

  // ── Mode switching ─────────────────────────────────────────────────────────

  _switchMode(mode) {
    this._mode = mode;
    this._drawArea.style.display  = mode === 'draw'  ? 'block' : 'none';
    this._typeArea.style.display  = mode === 'type'  ? 'block' : 'none';
    this._imageArea.style.display = mode === 'image' ? 'block' : 'none';

    Object.entries(this._tabBtns).forEach(([k, btn]) => {
      btn.style.cssText = this._tabStyle(k === mode);
    });

    if (mode === 'draw') this._initDrawCanvas();
    if (mode === 'type' && this._typedName) this._renderTypedPreview();
  }

  _tabStyle(active) {
    return [
      'padding:6px 16px', 'border:none', 'cursor:pointer', 'font-size:13px',
      'border-bottom:2px solid ' + (active ? '#0078d4' : 'transparent'),
      'background:transparent',
      'color:' + (active ? '#fff' : '#aaa'),
    ].join(';');
  }

  // ── Draw mode ──────────────────────────────────────────────────────────────

  _initDrawCanvas() {
    if (!this._canvas) return;
    this._ctx = this._canvas.getContext('2d');
    if (!this._ctx) return;
    this._ctx.lineCap   = 'round';
    this._ctx.lineJoin  = 'round';
    this._ctx.lineWidth = STROKE_WIDTH;
    this._ctx.strokeStyle = STROKE_COLOR;

    this._canvas.addEventListener('mousedown',  this._onMouseDown);
    this._canvas.addEventListener('mousemove',  this._onMouseMove);
    this._canvas.addEventListener('mouseup',    this._onMouseUp);
    this._canvas.addEventListener('mouseleave', this._onMouseUp);

    // Touch support
    this._canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.touches[0];
      this._onMouseDown({ offsetX: t.clientX - this._canvas.getBoundingClientRect().left,
                           offsetY: t.clientY - this._canvas.getBoundingClientRect().top });
    });
    this._canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const t = e.touches[0];
      this._onMouseMove({ offsetX: t.clientX - this._canvas.getBoundingClientRect().left,
                           offsetY: t.clientY - this._canvas.getBoundingClientRect().top });
    });
    this._canvas.addEventListener('touchend', () => this._onMouseUp());
  }

  _destroyDrawListeners() {
    if (!this._canvas) return;
    this._canvas.removeEventListener('mousedown',  this._onMouseDown);
    this._canvas.removeEventListener('mousemove',  this._onMouseMove);
    this._canvas.removeEventListener('mouseup',    this._onMouseUp);
    this._canvas.removeEventListener('mouseleave', this._onMouseUp);
  }

  _onMouseDown(e) {
    this._drawing = true;
    this._points  = [{ x: e.offsetX, y: e.offsetY }];
    this._ctx.beginPath();
    this._ctx.moveTo(e.offsetX, e.offsetY);
  }

  _onMouseMove(e) {
    if (!this._drawing) return;
    this._points.push({ x: e.offsetX, y: e.offsetY });
    this._ctx.lineTo(e.offsetX, e.offsetY);
    this._ctx.stroke();
    this._ctx.beginPath();
    this._ctx.moveTo(e.offsetX, e.offsetY);
  }

  _onMouseUp() {
    this._drawing = false;
  }

  // ── Type mode ──────────────────────────────────────────────────────────────

  _renderTypedPreview() {
    const ctx = this._typePreview.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, PAD_WIDTH, PAD_HEIGHT);

    if (!this._typedName) return;

    ctx.fillStyle    = STROKE_COLOR;
    ctx.font         = `36px ${SIGNATURE_FONTS[0]}`;
    ctx.textBaseline = 'middle';
    ctx.fillText(this._typedName, 20, PAD_HEIGHT / 2);
  }

  // ── Image mode ─────────────────────────────────────────────────────────────

  _renderImagePreview() {
    if (!this._imageData) return;

    const ctx  = this._imagePreview.getContext('2d');
    if (!ctx) return;
    const blob = new Blob([this._imageData]);
    const url  = URL.createObjectURL(blob);
    const img  = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, PAD_WIDTH, PAD_HEIGHT);
      const scale = Math.min(PAD_WIDTH / img.width, PAD_HEIGHT / img.height, 1);
      const w = img.width  * scale;
      const h = img.height * scale;
      ctx.drawImage(img, (PAD_WIDTH - w) / 2, (PAD_HEIGHT - h) / 2, w, h);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  // ── Clear ──────────────────────────────────────────────────────────────────

  _clear() {
    if (this._mode === 'draw' && this._ctx) {
      this._ctx.clearRect(0, 0, PAD_WIDTH, PAD_HEIGHT);
      this._points = [];
    }
    if (this._mode === 'type') {
      this._typedName = '';
      if (this._nameInput) this._nameInput.value = '';
      this._renderTypedPreview();
    }
    if (this._mode === 'image') {
      this._imageData = null;
      const ctx = this._imagePreview.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, PAD_WIDTH, PAD_HEIGHT);
    }
  }

  // ── Insert ─────────────────────────────────────────────────────────────────

  async _handleInsert() {
    let sourceCanvas;

    if (this._mode === 'draw') {
      sourceCanvas = this._canvas;
    } else if (this._mode === 'type') {
      this._renderTypedPreview();
      sourceCanvas = this._typePreview;
    } else if (this._mode === 'image') {
      sourceCanvas = this._imagePreview;
    }

    if (!sourceCanvas) return;

    // Trim whitespace and export as PNG
    const trimmed = _trimCanvas(sourceCanvas);
    const pngBlob = await new Promise(resolve => trimmed.toBlob(resolve, 'image/png'));
    const pngBytes = new Uint8Array(await pngBlob.arrayBuffer());

    const position = this._deps.defaultPosition ?? { x: 72, y: 72 };
    const width    = this._deps.defaultWidth    ?? 150;

    this._deps.onInsert?.({ pngBytes, position, width });
    this.close();
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Trim transparent/white borders from a canvas.
 * Returns a new canvas containing only the non-empty region.
 */
function _trimCanvas(canvas) {
  const ctx  = canvas.getContext('2d');
  if (!ctx) return canvas;
  const w    = canvas.width;
  const h    = canvas.height;
  const data = ctx.getImageData(0, 0, w, h).data;

  let top = h, left = w, right = 0, bottom = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const off = (y * w + x) * 4;
      const a   = data[off + 3];
      // Check if pixel is non-white and non-transparent
      const isContent = a > 10 && (data[off] < 245 || data[off + 1] < 245 || data[off + 2] < 245);
      if (isContent) {
        if (x < left)   left   = x;
        if (x > right)  right  = x;
        if (y < top)    top    = y;
        if (y > bottom) bottom = y;
      }
    }
  }

  // No content found — return 1×1 canvas
  if (right < left || bottom < top) {
    const empty = document.createElement('canvas');
    empty.width  = 1;
    empty.height = 1;
    return empty;
  }

  const trimW = right - left + 1;
  const trimH = bottom - top + 1;
  const pad   = 4;

  const out = document.createElement('canvas');
  out.width  = trimW + pad * 2;
  out.height = trimH + pad * 2;
  const outCtx = out.getContext('2d');
  if (!outCtx) return out;
  outCtx.drawImage(canvas, left, top, trimW, trimH, pad, pad, trimW, trimH);
  return out;
}
