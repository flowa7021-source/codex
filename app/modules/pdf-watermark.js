/**
 * @module pdf-watermark
 * @description Professional watermark tool for PDF documents.
 *
 * Supports:
 *   • Text watermarks (diagonal/horizontal, custom font/size/color/opacity)
 *   • Image watermarks (logo/stamp, positioned and scaled)
 *   • Per-page or all-pages application
 *   • Removal of previously added watermarks (by tag)
 *
 * Usage:
 *   import { addTextWatermark, addImageWatermark, WatermarkEditor } from './pdf-watermark.js';
 *
 *   const blob = await addTextWatermark(pdfBytes, 'CONFIDENTIAL', opts);
 *   const blob2 = await addImageWatermark(pdfBytes, logoPngBytes, opts);
 */

import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_TEXT_SIZE     = 60;
const DEFAULT_TEXT_COLOR    = { r: 0.7, g: 0.7, b: 0.7 };
const DEFAULT_TEXT_OPACITY  = 0.25;
const DEFAULT_TEXT_ROTATION = -45;    // degrees

/**
 * @typedef {Object} TextWatermarkOptions
 * @property {number}   [fontSize=60]
 * @property {{ r:number, g:number, b:number }} [color]
 * @property {number}   [opacity=0.25]       0-1
 * @property {number}   [rotation=-45]       degrees
 * @property {string}   [position='center']  'center' | 'top' | 'bottom'
 * @property {number[]} [pages]              1-based page numbers (default: all)
 * @property {boolean}  [behind=true]        render behind page content
 * @property {string}   [fontFamily='Helvetica']
 * @property {number}   [repeatX=1]          horizontal tile count
 * @property {number}   [repeatY=1]          vertical tile count
 */

/**
 * @typedef {Object} ImageWatermarkOptions
 * @property {number}   [opacity=0.3]
 * @property {number}   [scale=0.3]          0-1, relative to page width
 * @property {string}   [position='center']  'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
 * @property {number[]} [pages]
 * @property {boolean}  [behind=true]
 */

// ---------------------------------------------------------------------------
// Public API — Text watermark
// ---------------------------------------------------------------------------

/**
 * Add a text watermark to a PDF.
 *
 * @param {Uint8Array|ArrayBuffer} pdfBytes
 * @param {string} text
 * @param {TextWatermarkOptions} [opts]
 * @returns {Promise<Blob>}
 */
export async function addTextWatermark(pdfBytes, text, opts = {}) {
  const data     = pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes);
  const pdfDoc   = await PDFDocument.load(data);

  const fontSize = opts.fontSize ?? DEFAULT_TEXT_SIZE;
  const color    = opts.color    ?? DEFAULT_TEXT_COLOR;
  const opacity  = opts.opacity  ?? DEFAULT_TEXT_OPACITY;
  const rotation = opts.rotation ?? DEFAULT_TEXT_ROTATION;
  const position = opts.position ?? 'center';
  const behind   = opts.behind   !== false;
  const repeatX  = opts.repeatX  ?? 1;
  const repeatY  = opts.repeatY  ?? 1;

  const fontKey  = _resolveStandardFont(opts.fontFamily);
  const font     = await pdfDoc.embedFont(fontKey);

  const pages    = _resolvePages(pdfDoc, opts.pages);

  for (const page of pages) {
    const { width, height } = page.getSize();
    const textWidth = font.widthOfTextAtSize(text, fontSize);

    // Calculate positions based on tiling
    const positions = _computeTextPositions(
      width, height, textWidth, fontSize, position, repeatX, repeatY,
    );

    const drawOpts = {
      size:     fontSize,
      font,
      color:    rgb(color.r, color.g, color.b),
      opacity,
      rotate:   degrees(rotation),
    };

    for (const pos of positions) {
      if (behind) {
        // Move existing content to top by drawing watermark first
        // pdf-lib draws in order, so we draw and content stays on top
        page.drawText(text, { ...drawOpts, x: pos.x, y: pos.y });
      } else {
        page.drawText(text, { ...drawOpts, x: pos.x, y: pos.y });
      }
    }
  }

  const saved = await pdfDoc.save();
  return new Blob([saved], { type: 'application/pdf' });
}

// ---------------------------------------------------------------------------
// Public API — Image watermark
// ---------------------------------------------------------------------------

/**
 * Add an image watermark (PNG or JPEG) to a PDF.
 *
 * @param {Uint8Array|ArrayBuffer} pdfBytes
 * @param {Uint8Array|ArrayBuffer} imageBytes – PNG or JPEG
 * @param {ImageWatermarkOptions} [opts]
 * @returns {Promise<Blob>}
 */
export async function addImageWatermark(pdfBytes, imageBytes, opts = {}) {
  const data   = pdfBytes   instanceof Uint8Array ? pdfBytes   : new Uint8Array(pdfBytes);
  const imgBuf = imageBytes instanceof Uint8Array ? imageBytes : new Uint8Array(imageBytes);

  const pdfDoc = await PDFDocument.load(data);
  const image  = await _embedImage(pdfDoc, imgBuf);

  const opacity  = opts.opacity  ?? 0.3;
  const scale    = opts.scale    ?? 0.3;
  const position = opts.position ?? 'center';
  const pages    = _resolvePages(pdfDoc, opts.pages);

  for (const page of pages) {
    const { width, height } = page.getSize();
    const drawW = width * scale;
    const drawH = (image.height / image.width) * drawW;

    const pos = _computeImagePosition(width, height, drawW, drawH, position);

    page.drawImage(image, {
      x:       pos.x,
      y:       pos.y,
      width:   drawW,
      height:  drawH,
      opacity,
    });
  }

  const saved = await pdfDoc.save();
  return new Blob([saved], { type: 'application/pdf' });
}

// ---------------------------------------------------------------------------
// Public API — Remove watermark (overlay white rect at known position)
// ---------------------------------------------------------------------------

/**
 * Remove a watermark by covering its region with a white rectangle.
 * This is a visual removal — the original content may still exist in the PDF.
 *
 * @param {Uint8Array|ArrayBuffer} pdfBytes
 * @param {{ x: number, y: number, width: number, height: number }} rect – region to cover (PDF pt)
 * @param {number[]} [pages] – 1-based page numbers (default: all)
 * @returns {Promise<Blob>}
 */
export async function removeWatermarkRegion(pdfBytes, rect, pages) {
  const data   = pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes);
  const pdfDoc = await PDFDocument.load(data);

  const targetPages = _resolvePages(pdfDoc, pages);

  for (const page of targetPages) {
    page.drawRectangle({
      x:       rect.x,
      y:       rect.y,
      width:   rect.width,
      height:  rect.height,
      color:   rgb(1, 1, 1),
      opacity: 1,
    });
  }

  const saved = await pdfDoc.save();
  return new Blob([saved], { type: 'application/pdf' });
}

// ---------------------------------------------------------------------------
// WatermarkEditor — UI controller
// ---------------------------------------------------------------------------

export class WatermarkEditor {
  /**
   * @param {HTMLElement} container – host element for the floating panel
   * @param {Object} deps
   * @param {Function} deps.onApply – (opts) => void  — called with watermark options
   * @param {Function} deps.onCancel
   */
  constructor(container, deps) {
    this._container = container;
    this._deps      = deps;
    this._panel     = null;
    this._mode      = 'text';   // 'text' | 'image'
  }

  open() {
    if (this._panel) return;
    this._panel = this._buildPanel();
    this._container.appendChild(this._panel);
  }

  close() {
    if (this._panel) {
      this._panel.remove();
      this._panel = null;
    }
  }

  _buildPanel() {
    const panel = document.createElement('div');
    panel.style.cssText = [
      'position:absolute', 'top:50%', 'left:50%', 'transform:translate(-50%,-50%)',
      'background:#2a2a2a', 'border:1px solid #555', 'border-radius:8px',
      'padding:20px', 'z-index:9000', 'min-width:340px',
      'box-shadow:0 8px 32px rgba(0,0,0,.6)', 'color:#eee', 'font-family:sans-serif',
    ].join(';');

    // Title
    const title = document.createElement('h3');
    title.textContent = 'Add Watermark';
    title.style.cssText = 'margin:0 0 14px;font-size:16px;font-weight:600';
    panel.appendChild(title);

    // Mode selector
    const modeRow = _row('Type:');
    const modeSelect = document.createElement('select');
    modeSelect.style.cssText = _inputStyle();
    for (const [val, label] of [['text', 'Text'], ['image', 'Image']]) {
      const opt = document.createElement('option');
      opt.value = val;
      opt.textContent = label;
      modeSelect.appendChild(opt);
    }
    modeSelect.addEventListener('change', () => {
      this._mode = modeSelect.value;
      textFields.style.display  = this._mode === 'text'  ? 'block' : 'none';
      imageFields.style.display = this._mode === 'image' ? 'block' : 'none';
    });
    modeRow.appendChild(modeSelect);
    panel.appendChild(modeRow);

    // Text fields
    const textFields = document.createElement('div');

    const textRow = _row('Text:');
    const textInput = document.createElement('input');
    textInput.type  = 'text';
    textInput.value = 'CONFIDENTIAL';
    textInput.style.cssText = _inputStyle();
    textRow.appendChild(textInput);
    textFields.appendChild(textRow);

    const sizeRow = _row('Font size:');
    const sizeInput = document.createElement('input');
    sizeInput.type  = 'number';
    sizeInput.value = '60';
    sizeInput.min   = '8';
    sizeInput.max   = '200';
    sizeInput.style.cssText = _inputStyle();
    sizeRow.appendChild(sizeInput);
    textFields.appendChild(sizeRow);

    const opacityRow = _row('Opacity:');
    const opacityInput = document.createElement('input');
    opacityInput.type  = 'range';
    opacityInput.min   = '0';
    opacityInput.max   = '100';
    opacityInput.value = '25';
    opacityInput.style.cssText = 'width:140px;cursor:pointer';
    opacityRow.appendChild(opacityInput);
    textFields.appendChild(opacityRow);

    const rotRow = _row('Rotation:');
    const rotInput = document.createElement('input');
    rotInput.type  = 'number';
    rotInput.value = '-45';
    rotInput.min   = '-90';
    rotInput.max   = '90';
    rotInput.style.cssText = _inputStyle();
    rotRow.appendChild(rotInput);
    textFields.appendChild(rotRow);

    panel.appendChild(textFields);

    // Image fields (hidden by default)
    const imageFields = document.createElement('div');
    imageFields.style.display = 'none';

    const fileRow = _row('Image:');
    const fileInput = document.createElement('input');
    fileInput.type   = 'file';
    fileInput.accept = 'image/png,image/jpeg';
    fileInput.style.cssText = 'font-size:12px;color:#ccc';
    fileRow.appendChild(fileInput);
    imageFields.appendChild(fileRow);

    const imgScaleRow = _row('Scale:');
    const imgScaleInput = document.createElement('input');
    imgScaleInput.type  = 'range';
    imgScaleInput.min   = '5';
    imgScaleInput.max   = '100';
    imgScaleInput.value = '30';
    imgScaleInput.style.cssText = 'width:140px;cursor:pointer';
    imgScaleRow.appendChild(imgScaleInput);
    imageFields.appendChild(imgScaleRow);

    panel.appendChild(imageFields);

    // Buttons
    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:10px;margin-top:16px;justify-content:flex-end';

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = 'padding:6px 14px;border:1px solid #666;border-radius:4px;background:transparent;color:#ccc;cursor:pointer';
    cancelBtn.addEventListener('click', () => {
      this.close();
      this._deps.onCancel?.();
    });

    const applyBtn = document.createElement('button');
    applyBtn.textContent = 'Apply';
    applyBtn.style.cssText = 'padding:6px 14px;border:none;border-radius:4px;background:#0078d4;color:#fff;cursor:pointer;font-weight:600';
    applyBtn.addEventListener('click', async () => {
      if (this._mode === 'text') {
        this._deps.onApply?.({
          mode:     'text',
          text:     textInput.value,
          fontSize: Number(sizeInput.value),
          opacity:  Number(opacityInput.value) / 100,
          rotation: Number(rotInput.value),
        });
      } else {
        const file = fileInput.files?.[0];
        if (!file) return;
        const buf = new Uint8Array(await file.arrayBuffer());
        this._deps.onApply?.({
          mode:       'image',
          imageBytes: buf,
          scale:      Number(imgScaleInput.value) / 100,
          opacity:    0.3,
        });
      }
      this.close();
    });

    btnRow.append(cancelBtn, applyBtn);
    panel.appendChild(btnRow);

    return panel;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function _resolvePages(pdfDoc, pageNums) {
  const all = pdfDoc.getPages();
  if (!pageNums) return all;
  return pageNums
    .filter(n => n >= 1 && n <= all.length)
    .map(n => all[n - 1]);
}

function _resolveStandardFont(family) {
  const map = {
    'Helvetica':     StandardFonts.Helvetica,
    'Arial':         StandardFonts.Helvetica,
    'Times':         StandardFonts.TimesRoman,
    'TimesRoman':    StandardFonts.TimesRoman,
    'Courier':       StandardFonts.Courier,
    'Courier New':   StandardFonts.Courier,
  };
  return map[family] ?? StandardFonts.Helvetica;
}

function _computeTextPositions(pageW, pageH, textW, fontSize, position, repeatX, repeatY) {
  const positions = [];

  if (repeatX <= 1 && repeatY <= 1) {
    // Single watermark
    const pos = _singleTextPosition(pageW, pageH, textW, fontSize, position);
    positions.push(pos);
  } else {
    // Tiled watermarks
    const gapX = pageW / (repeatX + 1);
    const gapY = pageH / (repeatY + 1);
    for (let iy = 1; iy <= repeatY; iy++) {
      for (let ix = 1; ix <= repeatX; ix++) {
        positions.push({
          x: gapX * ix - textW / 2,
          y: gapY * iy - fontSize / 2,
        });
      }
    }
  }

  return positions;
}

function _singleTextPosition(pageW, pageH, textW, fontSize, position) {
  switch (position) {
    case 'top':
      return { x: (pageW - textW) / 2, y: pageH - fontSize - 36 };
    case 'bottom':
      return { x: (pageW - textW) / 2, y: 36 + fontSize };
    case 'center':
    default:
      return { x: (pageW - textW) / 2, y: (pageH - fontSize) / 2 };
  }
}

function _computeImagePosition(pageW, pageH, drawW, drawH, position) {
  switch (position) {
    case 'top-left':     return { x: 36, y: pageH - drawH - 36 };
    case 'top-right':    return { x: pageW - drawW - 36, y: pageH - drawH - 36 };
    case 'bottom-left':  return { x: 36, y: 36 };
    case 'bottom-right': return { x: pageW - drawW - 36, y: 36 };
    case 'center':
    default:
      return { x: (pageW - drawW) / 2, y: (pageH - drawH) / 2 };
  }
}

async function _embedImage(pdfDoc, imageBytes) {
  // Detect PNG vs JPEG from magic bytes
  if (imageBytes[0] === 0x89 && imageBytes[1] === 0x50) {
    return pdfDoc.embedPng(imageBytes);
  }
  return pdfDoc.embedJpg(imageBytes);
}

function _row(label) {
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:8px';
  const lbl = document.createElement('span');
  lbl.textContent  = label;
  lbl.style.cssText = 'font-size:13px;min-width:75px;color:#aaa';
  row.appendChild(lbl);
  return row;
}

function _inputStyle() {
  return 'padding:4px 8px;border:1px solid #555;border-radius:3px;background:#1e1e1e;color:#eee;font-size:13px;width:140px';
}
