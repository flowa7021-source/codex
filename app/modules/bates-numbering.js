// @ts-check
/**
 * @module bates-numbering
 * @description Professional Bates numbering / page stamps for legal documents.
 *
 * Features:
 *   • Sequential Bates numbers with configurable prefix, suffix, digit count
 *   • Date stamps (ISO, US, EU formats)
 *   • Custom text stamps at any position (header / footer / corners)
 *   • Confidentiality labels
 *   • Per-page or range-based application
 *   • Preview before applying
 *
 * Usage:
 *   import { applyBatesNumbering, applyPageStamp, BatesEditor } from './bates-numbering.js';
 *
 *   const blob = await applyBatesNumbering(pdfBytes, {
 *     prefix: 'DOC-', startNumber: 1, digits: 6, position: 'bottom-right',
 *   });
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_FONT_SIZE = 10;
const DEFAULT_MARGIN    = 36;     // 0.5 inch
const DEFAULT_DIGITS    = 6;
const DEFAULT_COLOR     = { r: 0, g: 0, b: 0 };

const POSITIONS = {
  'top-left':      (w, h, m, _tw) => ({ x: m,           y: h - m }),
  'top-center':    (w, h, m, tw) => ({ x: (w - tw) / 2, y: h - m }),
  'top-right':     (w, h, m, tw) => ({ x: w - m - tw,  y: h - m }),
  'bottom-left':   (w, _h, m, _tw) => ({ x: m,           y: m }),
  'bottom-center': (w, _h, m, tw) => ({ x: (w - tw) / 2, y: m }),
  'bottom-right':  (w, _h, m, tw) => ({ x: w - m - tw,  y: m }),
};

const DATE_FORMATS = {
  iso:  (d) => d.toISOString().split('T')[0],                           // 2026-03-21
  us:   (d) => `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`, // 3/21/2026
  eu:   (d) => `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`,// 21.3.2026
  full: (d) => d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
};

// ---------------------------------------------------------------------------
// Public API — Bates numbering
// ---------------------------------------------------------------------------

/**
 * Apply sequential Bates numbers to a PDF.
 *
 * @param {Uint8Array|ArrayBuffer} pdfBytes
 * @param {Object} opts
 * @param {string}  [opts.prefix='']        Prefix before the number
 * @param {string}  [opts.suffix='']        Suffix after the number
 * @param {number}  [opts.startNumber=1]    First Bates number
 * @param {number}  [opts.digits=6]         Zero-padded digit count
 * @param {string}  [opts.position='bottom-right']
 * @param {number}  [opts.fontSize=10]
 * @param {{ r:number, g:number, b:number }} [opts.color]
 * @param {number}  [opts.margin=36]        Distance from edge in pt
 * @param {number[]} [opts.pages]           1-based page numbers (default: all)
 * @param {boolean} [opts.includeDate=false] Append date to stamp
 * @param {string}  [opts.dateFormat='iso']
 * @returns {Promise<Blob>}
 */
export async function applyBatesNumbering(pdfBytes, opts = {}) {
  const data     = pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes);
  const pdfDoc   = await PDFDocument.load(data);
  const font     = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const prefix   = opts.prefix      ?? '';
  const suffix   = opts.suffix      ?? '';
  const start    = opts.startNumber ?? 1;
  const digits   = opts.digits      ?? DEFAULT_DIGITS;
  const position = opts.position    ?? 'bottom-right';
  const fontSize = opts.fontSize    ?? DEFAULT_FONT_SIZE;
  const color    = opts.color       ?? DEFAULT_COLOR;
  const margin   = opts.margin      ?? DEFAULT_MARGIN;
  const inclDate = opts.includeDate ?? false;
  const dateFmt  = opts.dateFormat  ?? 'iso';

  const posFn    = POSITIONS[position] ?? POSITIONS['bottom-right'];
  const pages    = _resolvePages(pdfDoc, opts.pages);
  const dateSuffix = inclDate ? `  ${_formatDate(new Date(), dateFmt)}` : '';

  for (let i = 0; i < pages.length; i++) {
    const page     = pages[i];
    const { width, height } = page.getSize();
    const num      = String(start + i).padStart(digits, '0');
    const text     = `${prefix}${num}${suffix}${dateSuffix}`;
    const textW    = font.widthOfTextAtSize(text, fontSize);
    const pos      = posFn(width, height, margin, textW);

    page.drawText(text, {
      x:    pos.x,
      y:    pos.y,
      size: fontSize,
      font,
      color: rgb(color.r, color.g, color.b),
    });
  }

  const saved = await pdfDoc.save();
  return new Blob([/** @type {any} */ (saved)], { type: 'application/pdf' });
}

// ---------------------------------------------------------------------------
// Public API — Generic page stamp
// ---------------------------------------------------------------------------

/**
 * Apply a custom text stamp to PDF pages.
 *
 * @param {Uint8Array|ArrayBuffer} pdfBytes
 * @param {string} stampText               Text to stamp (supports {page}, {total}, {date} placeholders)
 * @param {Object} opts
 * @param {string}  [opts.position='bottom-center']
 * @param {number}  [opts.fontSize=10]
 * @param {{ r:number, g:number, b:number }} [opts.color]
 * @param {number}  [opts.margin=36]
 * @param {number[]} [opts.pages]
 * @param {string}  [opts.dateFormat='iso']
 * @returns {Promise<Blob>}
 */
export async function applyPageStamp(pdfBytes, stampText, opts = {}) {
  const data     = pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes);
  const pdfDoc   = await PDFDocument.load(data);
  const font     = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const position = opts.position ?? 'bottom-center';
  const fontSize = opts.fontSize ?? DEFAULT_FONT_SIZE;
  const color    = opts.color    ?? DEFAULT_COLOR;
  const margin   = opts.margin   ?? DEFAULT_MARGIN;
  const dateFmt  = opts.dateFormat ?? 'iso';

  const posFn    = POSITIONS[position] ?? POSITIONS['bottom-center'];
  const allPages = pdfDoc.getPages();
  const pages    = _resolvePages(pdfDoc, opts.pages);
  const total    = allPages.length;
  const dateStr  = _formatDate(new Date(), dateFmt);

  for (const page of pages) {
    const pageIdx = allPages.indexOf(page);
    const { width, height } = page.getSize();

    const text = stampText
      .replace(/\{page\}/g,  String(pageIdx + 1))
      .replace(/\{total\}/g, String(total))
      .replace(/\{date\}/g,  dateStr);

    const textW = font.widthOfTextAtSize(text, fontSize);
    const pos   = posFn(width, height, margin, textW);

    page.drawText(text, {
      x:    pos.x,
      y:    pos.y,
      size: fontSize,
      font,
      color: rgb(color.r, color.g, color.b),
    });
  }

  const saved = await pdfDoc.save();
  return new Blob([/** @type {any} */ (saved)], { type: 'application/pdf' });
}

// ---------------------------------------------------------------------------
// Public API — Confidentiality label
// ---------------------------------------------------------------------------

/**
 * Apply a confidentiality label to all pages.
 *
 * @param {Uint8Array|ArrayBuffer} pdfBytes
 * @param {string} level  – 'public' | 'internal' | 'confidential' | 'secret' | custom string
 * @param {Object} [opts]
 * @param {string} [opts.position='top-center']
 * @param {number} [opts.fontSize=9]
 * @returns {Promise<Blob>}
 */
export async function applyConfidentialityLabel(pdfBytes, level, opts = {}) {
  const LEVEL_COLORS = {
    public:       { r: 0.2, g: 0.6, b: 0.2 },
    internal:     { r: 0.1, g: 0.4, b: 0.7 },
    confidential: { r: 0.8, g: 0.5, b: 0.0 },
    secret:       { r: 0.8, g: 0.1, b: 0.1 },
  };

  const label    = level.toUpperCase();
  const color    = LEVEL_COLORS[level.toLowerCase()] ?? DEFAULT_COLOR;
  const position = opts.position ?? 'top-center';
  const fontSize = opts.fontSize ?? 9;

  return applyPageStamp(pdfBytes, label, { position, fontSize, color });
}

// ---------------------------------------------------------------------------
// BatesEditor — UI controller
// ---------------------------------------------------------------------------

export class BatesEditor {
  /**
   * @param {HTMLElement} container
   * @param {Object} deps
   * @param {Function} deps.onApply  – (opts) => Promise<void>
   * @param {Function} [deps.onCancel]
   */
  constructor(container, deps) {
    this._container = container;
    this._deps      = deps;
    this._panel     = null;
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
      'padding:20px', 'z-index:9000', 'min-width:380px',
      'box-shadow:0 8px 32px rgba(0,0,0,.6)', 'color:#eee', 'font-family:sans-serif',
    ].join(';');

    // Title
    _appendEl(panel, 'h3', 'Bates Numbering', 'margin:0 0 14px;font-size:16px;font-weight:600');

    // Mode tabs
    const modeRow = _row('Mode:');
    const modeSelect = _select([
      ['bates', 'Bates Numbers'],
      ['stamp', 'Page Stamp'],
      ['label', 'Confidentiality'],
    ]);
    modeRow.appendChild(modeSelect);
    panel.appendChild(modeRow);

    // Bates fields
    const batesFields = document.createElement('div');

    const prefixInput = _textInput('DOC-');
    batesFields.appendChild(_labeledRow('Prefix:', prefixInput));

    const startInput = _numberInput(1, 1, 999999);
    batesFields.appendChild(_labeledRow('Start #:', startInput));

    const digitsInput = _numberInput(6, 1, 12);
    batesFields.appendChild(_labeledRow('Digits:', digitsInput));

    const suffixInput = _textInput('');
    batesFields.appendChild(_labeledRow('Suffix:', suffixInput));

    panel.appendChild(batesFields);

    // Stamp fields (hidden)
    const stampFields = document.createElement('div');
    stampFields.style.display = 'none';

    const stampInput = _textInput('Page {page} of {total}');
    stampInput.style.width = '220px';
    stampFields.appendChild(_labeledRow('Text:', stampInput));

    const helpEl = document.createElement('div');
    helpEl.style.cssText = 'font-size:11px;color:#888;margin-bottom:8px';
    helpEl.textContent = 'Placeholders: {page}, {total}, {date}';
    stampFields.appendChild(helpEl);

    panel.appendChild(stampFields);

    // Label fields (hidden)
    const labelFields = document.createElement('div');
    labelFields.style.display = 'none';

    const levelSelect = _select([
      ['public', 'PUBLIC'],
      ['internal', 'INTERNAL'],
      ['confidential', 'CONFIDENTIAL'],
      ['secret', 'SECRET'],
    ]);
    labelFields.appendChild(_labeledRow('Level:', levelSelect));
    panel.appendChild(labelFields);

    // Common: position
    const posSelect = _select(Object.keys(POSITIONS).map(k => [k, k]));
    posSelect.value = 'bottom-right';
    panel.appendChild(_labeledRow('Position:', posSelect));

    // Date checkbox
    const dateCheck = document.createElement('input');
    dateCheck.type = 'checkbox';
    const dateRow  = _labeledRow('Include date:', dateCheck);
    panel.appendChild(dateRow);

    // Mode switching
    modeSelect.addEventListener('change', () => {
      batesFields.style.display = modeSelect.value === 'bates' ? 'block' : 'none';
      stampFields.style.display = modeSelect.value === 'stamp' ? 'block' : 'none';
      labelFields.style.display = modeSelect.value === 'label' ? 'block' : 'none';
    });

    // Preview
    const previewEl = document.createElement('div');
    previewEl.style.cssText = [
      'margin:12px 0', 'padding:8px 12px', 'background:#1e1e1e',
      'border:1px solid #444', 'border-radius:4px', 'font-size:12px',
      'color:#aaa', 'font-family:monospace',
    ].join(';');
    previewEl.textContent = 'Preview: DOC-000001';

    const updatePreview = () => {
      const mode = modeSelect.value;
      if (mode === 'bates') {
        const num = String(Number(startInput.value) || 1).padStart(Number(digitsInput.value) || 6, '0');
        const date = dateCheck.checked ? `  ${_formatDate(new Date(), 'iso')}` : '';
        previewEl.textContent = `Preview: ${prefixInput.value}${num}${suffixInput.value}${date}`;
      } else if (mode === 'stamp') {
        previewEl.textContent = `Preview: ${stampInput.value.replace('{page}', '1').replace('{total}', '10').replace('{date}', _formatDate(new Date(), 'iso'))}`;
      } else {
        previewEl.textContent = `Preview: ${levelSelect.value.toUpperCase()}`;
      }
    };

    [prefixInput, startInput, digitsInput, suffixInput, stampInput, modeSelect, levelSelect, dateCheck].forEach(el => {
      el.addEventListener('input', updatePreview);
      el.addEventListener('change', updatePreview);
    });

    panel.appendChild(previewEl);

    // Buttons
    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:10px;justify-content:flex-end';

    const cancelBtn = _button('Cancel', false, () => {
      this.close();
      this._deps.onCancel?.();
    });

    const applyBtn = _button('Apply', true, () => {
      const mode = modeSelect.value;
      const common = {
        position:    posSelect.value,
        includeDate: dateCheck.checked,
      };

      if (mode === 'bates') {
        this._deps.onApply?.({
          mode: 'bates',
          prefix:      prefixInput.value,
          suffix:      suffixInput.value,
          startNumber: Number(startInput.value) || 1,
          digits:      Number(digitsInput.value) || 6,
          ...common,
        });
      } else if (mode === 'stamp') {
        this._deps.onApply?.({
          mode: 'stamp',
          text: stampInput.value,
          ...common,
        });
      } else {
        this._deps.onApply?.({
          mode:  'label',
          level: levelSelect.value,
          ...common,
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
  return pageNums.filter(n => n >= 1 && n <= all.length).map(n => all[n - 1]);
}

function _formatDate(date, format) {
  const fn = DATE_FORMATS[format] ?? DATE_FORMATS.iso;
  return fn(date);
}

// DOM helpers

function _appendEl(parent, tag, text, style) {
  const el = document.createElement(tag);
  el.textContent = text;
  if (style) el.style.cssText = style;
  parent.appendChild(el);
  return el;
}

function _row(label) {
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:8px';
  const lbl = document.createElement('span');
  lbl.textContent  = label;
  lbl.style.cssText = 'font-size:13px;min-width:85px;color:#aaa';
  row.appendChild(lbl);
  return row;
}

function _labeledRow(label, input) {
  const row = _row(label);
  row.appendChild(input);
  return row;
}

function _textInput(value) {
  const el = document.createElement('input');
  el.type  = 'text';
  el.value = value;
  el.style.cssText = 'padding:4px 8px;border:1px solid #555;border-radius:3px;background:#1e1e1e;color:#eee;font-size:13px;width:140px';
  return el;
}

function _numberInput(value, min, max) {
  const el = document.createElement('input');
  el.type  = 'number';
  el.value = String(value);
  el.min   = String(min);
  el.max   = String(max);
  el.style.cssText = 'padding:4px 8px;border:1px solid #555;border-radius:3px;background:#1e1e1e;color:#eee;font-size:13px;width:80px';
  return el;
}

function _select(options) {
  const el = document.createElement('select');
  el.style.cssText = 'padding:4px 8px;border:1px solid #555;border-radius:3px;background:#1e1e1e;color:#eee;font-size:13px';
  for (const [val, label] of options) {
    const opt = document.createElement('option');
    opt.value       = val;
    opt.textContent = label;
    el.appendChild(opt);
  }
  return el;
}

function _button(label, primary, onClick) {
  const btn = document.createElement('button');
  btn.textContent = label;
  btn.style.cssText = primary
    ? 'padding:6px 14px;border:none;border-radius:4px;background:#0078d4;color:#fff;cursor:pointer;font-weight:600'
    : 'padding:6px 14px;border:1px solid #666;border-radius:4px;background:transparent;color:#ccc;cursor:pointer';
  btn.addEventListener('click', onClick);
  return btn;
}
