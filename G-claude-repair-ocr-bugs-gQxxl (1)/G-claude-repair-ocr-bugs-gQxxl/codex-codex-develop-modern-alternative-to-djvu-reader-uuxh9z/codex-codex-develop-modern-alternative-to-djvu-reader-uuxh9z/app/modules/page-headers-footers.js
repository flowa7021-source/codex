/**
 * @module page-headers-footers
 * @description Configurable page headers and footers for PDF documents.
 *
 * Supports:
 *   • Left / center / right aligned text in header and footer
 *   • Placeholders: {page}, {total}, {date}, {title}, {author}
 *   • Configurable font, size, color, margins
 *   • Separator line between header/footer and page content
 *   • Different first page / odd / even page templates
 *   • Per-page or range-based application
 *
 * Usage:
 *   import { addHeadersFooters, HeaderFooterEditor } from './page-headers-footers.js';
 *
 *   const blob = await addHeadersFooters(pdfBytes, {
 *     header: { center: '{title}' },
 *     footer: { center: 'Page {page} of {total}', right: '{date}' },
 *   });
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_FONT_SIZE   = 9;
const DEFAULT_MARGIN      = 36;          // 0.5" from edge
const DEFAULT_COLOR       = { r: 0.3, g: 0.3, b: 0.3 };
const SEPARATOR_OFFSET    = 4;           // gap between text and line

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} HFSlot
 * @property {string} [left]
 * @property {string} [center]
 * @property {string} [right]
 */

/**
 * @typedef {Object} HeaderFooterOptions
 * @property {HFSlot}  [header]
 * @property {HFSlot}  [footer]
 * @property {HFSlot}  [firstPageHeader]   – override for page 1
 * @property {HFSlot}  [firstPageFooter]
 * @property {HFSlot}  [evenHeader]        – override for even pages
 * @property {HFSlot}  [evenFooter]
 * @property {number}  [fontSize=9]
 * @property {{ r:number, g:number, b:number }} [color]
 * @property {number}  [margin=36]         – distance from page edge in pt
 * @property {boolean} [separator=true]    – draw line under header / above footer
 * @property {number}  [startPage=1]       – 1-based start (skip before this)
 * @property {number[]} [pages]            – specific pages (overrides startPage)
 * @property {string}  [dateFormat='iso']
 */

/**
 * Add headers and/or footers to a PDF.
 *
 * @param {Uint8Array|ArrayBuffer} pdfBytes
 * @param {HeaderFooterOptions} opts
 * @returns {Promise<Blob>}
 */
export async function addHeadersFooters(pdfBytes, opts = {}) {
  const data     = pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes);
  const pdfDoc   = await PDFDocument.load(data);
  const font     = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const fontSize  = opts.fontSize  ?? DEFAULT_FONT_SIZE;
  const color     = opts.color     ?? DEFAULT_COLOR;
  const margin    = opts.margin    ?? DEFAULT_MARGIN;
  const separator = opts.separator !== false;
  const startPage = opts.startPage ?? 1;
  const dateFmt   = opts.dateFormat ?? 'iso';

  const allPages  = pdfDoc.getPages();
  const total     = allPages.length;
  const title     = pdfDoc.getTitle()  ?? '';
  const author    = pdfDoc.getAuthor() ?? '';
  const dateStr   = _formatDate(new Date(), dateFmt);

  const pageIndices = opts.pages
    ? opts.pages.filter(n => n >= 1 && n <= total).map(n => n - 1)
    : Array.from({ length: total }, (_, i) => i).filter(i => i >= startPage - 1);

  for (const idx of pageIndices) {
    const page     = allPages[idx];
    const pageNum  = idx + 1;
    const { width, height } = page.getSize();
    const isFirst  = pageNum === 1;
    const isEven   = pageNum % 2 === 0;

    // Resolve which template to use
    const hdrTemplate = (isFirst && opts.firstPageHeader) ? opts.firstPageHeader
                      : (isEven  && opts.evenHeader)      ? opts.evenHeader
                      : opts.header;
    const ftrTemplate = (isFirst && opts.firstPageFooter) ? opts.firstPageFooter
                      : (isEven  && opts.evenFooter)      ? opts.evenFooter
                      : opts.footer;

    const vars = { page: String(pageNum), total: String(total), date: dateStr, title, author };

    // Draw header
    if (hdrTemplate) {
      const y = height - margin;
      _drawSlot(page, font, fontSize, color, margin, width, y, hdrTemplate, vars);

      if (separator) {
        _drawLine(page, margin, y - fontSize - SEPARATOR_OFFSET, width - margin, y - fontSize - SEPARATOR_OFFSET, color);
      }
    }

    // Draw footer
    if (ftrTemplate) {
      const y = margin;
      _drawSlot(page, font, fontSize, color, margin, width, y, ftrTemplate, vars);

      if (separator) {
        _drawLine(page, margin, y + fontSize + SEPARATOR_OFFSET, width - margin, y + fontSize + SEPARATOR_OFFSET, color);
      }
    }
  }

  const saved = await pdfDoc.save();
  return new Blob([saved], { type: 'application/pdf' });
}

// ---------------------------------------------------------------------------
// HeaderFooterEditor — UI
// ---------------------------------------------------------------------------

export class HeaderFooterEditor {
  /**
   * @param {HTMLElement} container
   * @param {Object} deps
   * @param {Function} deps.onApply  – (opts: HeaderFooterOptions) => Promise<void>
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
      'padding:20px', 'z-index:9000', 'min-width:480px',
      'box-shadow:0 8px 32px rgba(0,0,0,.6)', 'color:#eee', 'font-family:sans-serif',
    ].join(';');

    // Title
    const title = document.createElement('h3');
    title.textContent = 'Headers & Footers';
    title.style.cssText = 'margin:0 0 14px;font-size:16px;font-weight:600';
    panel.appendChild(title);

    // Help text
    const help = document.createElement('div');
    help.style.cssText = 'font-size:11px;color:#888;margin-bottom:12px';
    help.textContent = 'Placeholders: {page}, {total}, {date}, {title}, {author}';
    panel.appendChild(help);

    // Header section
    panel.appendChild(_sectionLabel('Header'));
    const headerInputs = _slotRow();
    panel.appendChild(headerInputs.row);

    // Footer section
    panel.appendChild(_sectionLabel('Footer'));
    const footerInputs = _slotRow();
    panel.appendChild(footerInputs.row);

    // Options
    const optRow = document.createElement('div');
    optRow.style.cssText = 'display:flex;gap:14px;margin:12px 0;align-items:center';

    const sizeLabel = document.createElement('span');
    sizeLabel.textContent = 'Size:';
    sizeLabel.style.cssText = 'font-size:12px;color:#aaa';
    const sizeInput = document.createElement('input');
    sizeInput.type  = 'number';
    sizeInput.value = '9';
    sizeInput.min   = '6';
    sizeInput.max   = '24';
    sizeInput.style.cssText = 'width:50px;padding:3px;border:1px solid #555;border-radius:3px;background:#1e1e1e;color:#eee;font-size:12px';

    const sepCheck = document.createElement('input');
    sepCheck.type    = 'checkbox';
    sepCheck.checked = true;
    const sepLabel   = document.createElement('span');
    sepLabel.textContent = 'Separator line';
    sepLabel.style.cssText = 'font-size:12px;color:#aaa';

    optRow.append(sizeLabel, sizeInput, sepCheck, sepLabel);
    panel.appendChild(optRow);

    // Preview
    const preview = document.createElement('div');
    preview.style.cssText = [
      'margin:8px 0', 'padding:8px 12px', 'background:#1e1e1e',
      'border:1px solid #444', 'border-radius:4px', 'font-size:11px',
      'color:#aaa', 'font-family:monospace', 'min-height:32px',
    ].join(';');

    const updatePreview = () => {
      const hdr = [headerInputs.left.value, headerInputs.center.value, headerInputs.right.value].filter(Boolean);
      const ftr = [footerInputs.left.value, footerInputs.center.value, footerInputs.right.value].filter(Boolean);
      const parts = [];
      if (hdr.length) parts.push('Header: ' + hdr.join(' | '));
      if (ftr.length) parts.push('Footer: ' + ftr.join(' | '));
      preview.textContent = parts.length ? parts.join('\n') : 'Configure header/footer above';
    };

    [headerInputs.left, headerInputs.center, headerInputs.right,
     footerInputs.left, footerInputs.center, footerInputs.right].forEach(el => {
      el.addEventListener('input', updatePreview);
    });
    updatePreview();
    panel.appendChild(preview);

    // Buttons
    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:10px;justify-content:flex-end;margin-top:8px';

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
    applyBtn.addEventListener('click', () => {
      const opts = {
        header:    _slotValues(headerInputs),
        footer:    _slotValues(footerInputs),
        fontSize:  Number(sizeInput.value) || 9,
        separator: sepCheck.checked,
      };
      this._deps.onApply?.(opts);
      this.close();
    });

    btnRow.append(cancelBtn, applyBtn);
    panel.appendChild(btnRow);

    return panel;
  }
}

// ---------------------------------------------------------------------------
// Internal drawing
// ---------------------------------------------------------------------------

function _drawSlot(page, font, fontSize, color, margin, pageWidth, y, template, vars) {
  const drawColor = rgb(color.r, color.g, color.b);

  if (template.left) {
    const text = _resolvePlaceholders(template.left, vars);
    page.drawText(text, { x: margin, y, size: fontSize, font, color: drawColor });
  }

  if (template.center) {
    const text  = _resolvePlaceholders(template.center, vars);
    const textW = font.widthOfTextAtSize(text, fontSize);
    page.drawText(text, { x: (pageWidth - textW) / 2, y, size: fontSize, font, color: drawColor });
  }

  if (template.right) {
    const text  = _resolvePlaceholders(template.right, vars);
    const textW = font.widthOfTextAtSize(text, fontSize);
    page.drawText(text, { x: pageWidth - margin - textW, y, size: fontSize, font, color: drawColor });
  }
}

function _drawLine(page, x1, y1, x2, _y2, color) {
  page.drawLine({
    start: { x: x1, y: y1 },
    end:   { x: x2, y: y1 },
    thickness: 0.5,
    color: rgb(color.r, color.g, color.b),
    opacity: 0.4,
  });
}

function _resolvePlaceholders(template, vars) {
  return template
    .replace(/\{page\}/g,   vars.page)
    .replace(/\{total\}/g,  vars.total)
    .replace(/\{date\}/g,   vars.date)
    .replace(/\{title\}/g,  vars.title)
    .replace(/\{author\}/g, vars.author);
}

function _formatDate(date, format) {
  if (format === 'us') return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
  if (format === 'eu') return `${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()}`;
  return date.toISOString().split('T')[0];
}

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------

function _sectionLabel(text) {
  const el = document.createElement('div');
  el.textContent = text;
  el.style.cssText = 'font-size:12px;color:#888;margin-bottom:4px;text-transform:uppercase;letter-spacing:.5px';
  return el;
}

function _slotRow() {
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:8px;margin-bottom:10px';

  const style = 'flex:1;padding:5px 8px;border:1px solid #555;border-radius:3px;background:#1e1e1e;color:#eee;font-size:12px';

  const left   = document.createElement('input');
  left.type    = 'text';
  left.placeholder = 'Left';
  left.style.cssText = style;

  const center = document.createElement('input');
  center.type  = 'text';
  center.placeholder = 'Center';
  center.style.cssText = style;

  const right  = document.createElement('input');
  right.type   = 'text';
  right.placeholder = 'Right';
  right.style.cssText = style;

  row.append(left, center, right);
  return { row, left, center, right };
}

function _slotValues(inputs) {
  const slot = {};
  if (inputs.left.value.trim())   slot.left   = inputs.left.value.trim();
  if (inputs.center.value.trim()) slot.center  = inputs.center.value.trim();
  if (inputs.right.value.trim())  slot.right   = inputs.right.value.trim();
  return Object.keys(slot).length > 0 ? slot : undefined;
}
