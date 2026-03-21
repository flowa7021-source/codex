/**
 * @module cross-format-paste
 * @description Phase 7 — Cross-format clipboard.
 *
 * Provides rich copy/paste between NovaReader and external applications:
 *   • Copy selected text with formatting (HTML + plain-text on clipboard)
 *   • Copy page region as image (PNG blob on clipboard)
 *   • Paste rich content (HTML/images) into the PDF via pdf-lib
 *   • Paste plain text onto a page at a target position
 *
 * Works on top of the Clipboard API (navigator.clipboard) with
 * ClipboardItem / read / write.
 *
 * Usage:
 *   import { copyFormattedText, copyRegionAsImage, pasteIntoPage } from './cross-format-paste.js';
 *
 *   await copyFormattedText(selectedBlocks, pageModel);
 *   await copyRegionAsImage(canvas, rect);
 *   const result = await pasteIntoPage(pdfLibDoc, pageNum, position, opts);
 */

import { rgb } from 'pdf-lib';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CLIPBOARD_IMAGE_TYPE  = 'image/png';
const CLIPBOARD_HTML_TYPE   = 'text/html';
const CLIPBOARD_PLAIN_TYPE  = 'text/plain';

const DEFAULT_PASTE_FONT_SIZE = 12;   // pt
const _DEFAULT_PASTE_FONT     = 'Helvetica';

// ---------------------------------------------------------------------------
// Copy helpers
// ---------------------------------------------------------------------------

/**
 * Copy selected text blocks as rich HTML + plain text to the system clipboard.
 *
 * Each block is expected to have `{ text, fontFamily, fontSize, bold, italic, color }`.
 *
 * @param {Array<Object>} selectedBlocks – text blocks from PageModel
 * @param {Object} [opts]
 * @param {string} [opts.title]          – document title for HTML header
 * @returns {Promise<void>}
 */
export async function copyFormattedText(selectedBlocks, opts = {}) {
  if (!selectedBlocks || selectedBlocks.length === 0) return;

  const plainParts = [];
  const htmlParts  = ['<div style="font-family:sans-serif">'];

  if (opts.title) {
    htmlParts.push(`<p style="font-size:10px;color:#888">${_esc(opts.title)}</p>`);
  }

  for (const block of selectedBlocks) {
    const text = block.text ?? '';
    plainParts.push(text);

    const styles = [];
    if (block.fontFamily) styles.push(`font-family:${_esc(block.fontFamily)}`);
    if (block.fontSize)   styles.push(`font-size:${block.fontSize}pt`);
    if (block.bold)       styles.push('font-weight:bold');
    if (block.italic)     styles.push('font-style:italic');
    if (block.color)      styles.push(`color:${_colorToCss(block.color)}`);

    const tag = block.heading ? `h${Math.min(block.heading, 6)}` : 'p';
    htmlParts.push(`<${tag} style="${styles.join(';')}">${_esc(text)}</${tag}>`);
  }

  htmlParts.push('</div>');

  const plainText = plainParts.join('\n');
  const html      = htmlParts.join('\n');

  await _writeToClipboard(plainText, html);
}

/**
 * Copy a rectangular region of a canvas as a PNG image to the clipboard.
 *
 * @param {HTMLCanvasElement} canvas – source canvas
 * @param {{ x: number, y: number, width: number, height: number }} rect – crop region in canvas px
 * @returns {Promise<void>}
 */
export async function copyRegionAsImage(canvas, rect) {
  const cropped  = _cropCanvas(canvas, rect);
  const blob     = await _canvasToBlob(cropped, CLIPBOARD_IMAGE_TYPE);

  const ClipboardItemCtor = typeof globalThis.ClipboardItem !== 'undefined' ? globalThis.ClipboardItem : null;
  if (ClipboardItemCtor && navigator.clipboard?.write) {
    const item = new ClipboardItemCtor({ [CLIPBOARD_IMAGE_TYPE]: blob });
    await navigator.clipboard.write([item]);
  } else {
    // Fallback: copy a data-URL as text
    const reader   = new FileReader();
    const dataUrl  = await new Promise((resolve, _reject) => {
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
    await navigator.clipboard.writeText(dataUrl);
  }
}

/**
 * Copy the full rendered page as a PNG to the clipboard.
 *
 * @param {HTMLCanvasElement} pageCanvas – rendered page canvas
 * @returns {Promise<void>}
 */
export async function copyPageAsImage(pageCanvas) {
  return copyRegionAsImage(pageCanvas, {
    x: 0, y: 0, width: pageCanvas.width, height: pageCanvas.height,
  });
}

// ---------------------------------------------------------------------------
// Paste helpers
// ---------------------------------------------------------------------------

/**
 * Read the system clipboard and paste its content into a PDF page.
 *
 * Supports:
 *   • PNG/JPEG image → embed as XObject, draw at position
 *   • HTML text → strip tags, draw as plain text
 *   • Plain text → draw as text via pdf-lib
 *
 * @param {PDFDocument} pdfDoc  – pdf-lib document (mutable)
 * @param {number} pageNum      – 0-based page index
 * @param {{ x: number, y: number }} position – PDF-space coordinate (bottom-left origin)
 * @param {Object} [opts]
 * @param {number} [opts.fontSize=12]
 * @param {string} [opts.fontFamily='Helvetica']
 * @param {number} [opts.maxWidth]       – word-wrap width in pt
 * @param {number} [opts.lineHeight=1.4] – line height multiplier
 * @returns {Promise<{type: string, content: string|null}>}
 */
export async function pasteIntoPage(pdfDoc, pageNum, position, opts = {}) {
  const fontSize   = opts.fontSize   ?? DEFAULT_PASTE_FONT_SIZE;
  const lineHeight = opts.lineHeight ?? 1.4;
  const maxWidth   = opts.maxWidth   ?? 500;

  const clipData = await _readClipboard();

  if (!clipData) {
    return { type: 'empty', content: null };
  }

  const page = pdfDoc.getPages()[pageNum];
  if (!page) throw new Error(`Page ${pageNum} not found`);

  // Image paste
  if (clipData.type === 'image' && clipData.blob) {
    const arrayBuf = await clipData.blob.arrayBuffer();
    const bytes    = new Uint8Array(arrayBuf);

    let image;
    if (clipData.blob.type === 'image/png') {
      image = await pdfDoc.embedPng(bytes);
    } else {
      image = await pdfDoc.embedJpg(bytes);
    }

    const scale  = Math.min(1, maxWidth / image.width);
    const drawW  = image.width  * scale;
    const drawH  = image.height * scale;

    page.drawImage(image, {
      x:      position.x,
      y:      position.y - drawH,
      width:  drawW,
      height: drawH,
    });

    return { type: 'image', content: `${Math.round(drawW)}×${Math.round(drawH)}` };
  }

  // Text paste (HTML → strip tags, or plain)
  let text = clipData.text ?? '';
  if (clipData.html) {
    text = _stripHtml(clipData.html);
  }
  if (!text.trim()) return { type: 'empty', content: null };

  // Word-wrap
  const lines    = _wordWrap(text, maxWidth, fontSize * 0.5);  // rough char width
  const font     = await _embedStandardFont(pdfDoc, opts.fontFamily);
  const leading  = fontSize * lineHeight;

  let y = position.y;
  for (const line of lines) {
    page.drawText(line, {
      x:    position.x,
      y,
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
    });
    y -= leading;
  }

  return { type: 'text', content: text.slice(0, 200) };
}

// ---------------------------------------------------------------------------
// Clipboard read / write wrappers
// ---------------------------------------------------------------------------

/**
 * Read the clipboard, returning the best available format.
 *
 * @returns {Promise<{ type: 'image'|'text', blob?: Blob, text?: string, html?: string }|null>}
 */
async function _readClipboard() {
  // Modern Clipboard API
  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.read) {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        // Prefer image
        for (const t of item.types) {
          if (t.startsWith('image/')) {
            const blob = await item.getType(t);
            return { type: 'image', blob };
          }
        }
        // HTML
        if (item.types.includes(CLIPBOARD_HTML_TYPE)) {
          const htmlBlob = await item.getType(CLIPBOARD_HTML_TYPE);
          const html     = await htmlBlob.text();
          return { type: 'text', html, text: _stripHtml(html) };
        }
        // Plain
        if (item.types.includes(CLIPBOARD_PLAIN_TYPE)) {
          const textBlob = await item.getType(CLIPBOARD_PLAIN_TYPE);
          const text     = await textBlob.text();
          return { type: 'text', text };
        }
      }
    } catch (_e) {
      // Clipboard read permission denied — fall back to readText
    }
  }

  // Legacy fallback
  if (navigator.clipboard?.readText) {
    try {
      const text = await navigator.clipboard.readText();
      if (text) return { type: 'text', text };
    } catch (_e) {
      // silently fail
    }
  }

  return null;
}

/**
 * Write both HTML and plain-text representations to the clipboard.
 */
async function _writeToClipboard(plainText, html) {
  const CICtor = typeof globalThis.ClipboardItem !== 'undefined' ? globalThis.ClipboardItem : null;
  if (CICtor && navigator.clipboard?.write) {
    const htmlBlob  = new Blob([html],      { type: CLIPBOARD_HTML_TYPE });
    const textBlob  = new Blob([plainText], { type: CLIPBOARD_PLAIN_TYPE });
    const item      = new CICtor({
      [CLIPBOARD_HTML_TYPE]:  htmlBlob,
      [CLIPBOARD_PLAIN_TYPE]: textBlob,
    });
    await navigator.clipboard.write([item]);
  } else if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(plainText);
  }
}

// ---------------------------------------------------------------------------
// Cross-format paste controller (UI integration)
// ---------------------------------------------------------------------------

/**
 * Controller that hooks into keyboard events for Ctrl+C / Ctrl+V on the
 * page container, routing to the appropriate copy or paste helper.
 */
export class ClipboardController {
  /**
   * @param {Object} deps
   * @param {HTMLElement}   deps.container      – page container element
   * @param {Function}      deps.getSelection   – () → { blocks: Object[], rect?: Rect } | null
   * @param {Function}      deps.getPageCanvas  – () → HTMLCanvasElement | null
   * @param {Function}      deps.getPdfDoc      – () → PDFDocument | null
   * @param {Function}      deps.getPageNum     – () → number  (0-based)
   * @param {Function}      deps.getCursorPos   – () → { x: number, y: number }  (PDF coords)
   * @param {Function}      deps.onPasteComplete – ({ type, content }) → void
   * @param {Function}      [deps.onCopyComplete] – () → void
   */
  constructor(deps) {
    this._deps      = deps;
    this._container = deps.container;
    this._onKeyDown = this._onKeyDown.bind(this);
    this._container.addEventListener('keydown', this._onKeyDown);
  }

  destroy() {
    this._container.removeEventListener('keydown', this._onKeyDown);
  }

  async _onKeyDown(e) {
    const ctrl = e.ctrlKey || e.metaKey;
    if (!ctrl) return;

    // Ctrl+C — Copy
    if (e.key === 'c') {
      const sel = this._deps.getSelection?.();
      if (!sel) return;   // let default browser copy handle it

      e.preventDefault();

      if (sel.rect && this._deps.getPageCanvas?.()) {
        // Region selection → copy as image
        await copyRegionAsImage(this._deps.getPageCanvas(), sel.rect);
      } else if (sel.blocks?.length) {
        await copyFormattedText(sel.blocks);
      }

      this._deps.onCopyComplete?.();
      return;
    }

    // Ctrl+V — Paste
    if (e.key === 'v') {
      const pdfDoc = this._deps.getPdfDoc?.();
      if (!pdfDoc) return;   // let default handle it

      e.preventDefault();

      const pageNum = this._deps.getPageNum?.() ?? 0;
      const pos     = this._deps.getCursorPos?.() ?? { x: 72, y: 700 };

      const result = await pasteIntoPage(pdfDoc, pageNum, pos);
      this._deps.onPasteComplete?.(result);
    }
  }
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function _esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function _stripHtml(html) {
  // Use DOMParser when available, else regex
  if (typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body?.textContent ?? '';
  }
  return html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
}

function _colorToCss(color) {
  if (typeof color === 'string') return color;
  if (color && typeof color.r === 'number') {
    const r = Math.round(color.r * 255);
    const g = Math.round(color.g * 255);
    const b = Math.round(color.b * 255);
    return `rgb(${r},${g},${b})`;
  }
  return '#000';
}

function _cropCanvas(canvas, rect) {
  const out = document.createElement('canvas');
  out.width  = Math.round(rect.width);
  out.height = Math.round(rect.height);
  out.getContext('2d').drawImage(
    canvas,
    rect.x, rect.y, rect.width, rect.height,
    0, 0, out.width, out.height,
  );
  return out;
}

function _canvasToBlob(canvas, mimeType = 'image/png') {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mimeType);
  });
}

/**
 * Simple word-wrap: split text into lines that fit within maxWidth.
 * Uses a rough character width estimate.
 */
function _wordWrap(text, maxWidthPt, charWidthPt) {
  const charsPerLine = Math.max(10, Math.floor(maxWidthPt / charWidthPt));
  const inputLines   = text.split('\n');
  const result       = [];

  for (const raw of inputLines) {
    if (raw.length <= charsPerLine) {
      result.push(raw);
      continue;
    }
    const words = raw.split(/\s+/);
    let line    = '';
    for (const word of words) {
      if (line.length + word.length + 1 > charsPerLine && line.length > 0) {
        result.push(line);
        line = word;
      } else {
        line = line ? `${line} ${word}` : word;
      }
    }
    if (line) result.push(line);
  }

  return result;
}

/**
 * Embed a standard PDF font, with fallback to Helvetica.
 */
async function _embedStandardFont(pdfDoc, family) {
  // pdf-lib standard fonts
  const STANDARD = {
    'Helvetica':     'Helvetica',
    'Times':         'TimesRoman',
    'Times-Roman':   'TimesRoman',
    'TimesRoman':    'TimesRoman',
    'Courier':       'Courier',
    'Courier New':   'Courier',
    'Arial':         'Helvetica',
    'sans-serif':    'Helvetica',
    'serif':         'TimesRoman',
    'monospace':     'Courier',
  };

  const resolved = STANDARD[family] ?? 'Helvetica';

  // Dynamic import the StandardFonts enum from pdf-lib
  const { StandardFonts } = await import('pdf-lib');
  const fontEnum = StandardFonts[resolved] ?? StandardFonts.Helvetica;
  return pdfDoc.embedFont(fontEnum);
}
