// @ts-check
// ─── Markdown → PDF Converter ────────────────────────────────────────────────
// Parses Markdown using the `marked` library (v12) and renders it to PDF
// using pdf-lib. Supports headings (h1-h6), bold, italic, code spans,
// code blocks, bullet/numbered lists, blockquotes, horizontal rules,
// tables (rendered as plain text rows), and links (text only, not clickable).

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { marked } from 'marked';

/**
 * @typedef {Object} MdPdfOptions
 * @property {'A4'|'Letter'|'Legal'} [pageSize='A4']
 * @property {number} [fontSize=12]
 * @property {string} [fontFamily='Helvetica']
 * @property {number} [marginTop=72]
 * @property {number} [marginBottom=72]
 * @property {number} [marginLeft=72]
 * @property {number} [marginRight=72]
 */

/**
 * @typedef {Object} TextRun
 * @property {string} text
 * @property {boolean} bold
 * @property {boolean} italic
 * @property {boolean} mono
 */

/**
 * @typedef {Object} ParsedLine
 * @property {'h1'|'h2'|'h3'|'paragraph'|'bullet'|'numbered'|'quote'|'code'|'hr'|'blank'} type
 * @property {TextRun[]} runs
 * @property {string} [raw] - Original text for code blocks
 * @property {number} [listNumber] - For numbered lists
 */

/** Page size dimensions in points (1 inch = 72 points). */
const PAGE_SIZES = {
  A4: { width: 595.28, height: 841.89 },
  Letter: { width: 612, height: 792 },
  Legal: { width: 612, height: 1008 },
};

/**
 * Convert a marked inline token tree into TextRun[].
 * @param {any[]} tokens
 * @param {{bold?: boolean, italic?: boolean}} [ctx]
 * @returns {TextRun[]}
 */
function _inlineTokensToRuns(tokens, ctx = {}) {
  /** @type {TextRun[]} */
  const runs = [];
  const bold = ctx.bold || false;
  const italic = ctx.italic || false;

  for (const t of (tokens || [])) {
    switch (t.type) {
      case 'text':
      case 'escape':
        runs.push({ text: t.text || t.raw || '', bold, italic, mono: false });
        break;
      case 'strong':
        runs.push(..._inlineTokensToRuns(t.tokens || [], { bold: true, italic }));
        break;
      case 'em':
        runs.push(..._inlineTokensToRuns(t.tokens || [], { bold, italic: true }));
        break;
      case 'codespan':
        runs.push({ text: t.text || '', bold: false, italic: false, mono: true });
        break;
      case 'link':
        // Links rendered as plain text only (no hyperlinks in PDF)
        runs.push(..._inlineTokensToRuns(t.tokens || [], { bold, italic }));
        break;
      case 'br':
        runs.push({ text: ' ', bold: false, italic: false, mono: false });
        break;
      default:
        if (t.raw) runs.push({ text: t.raw, bold, italic, mono: false });
    }
  }
  return runs.length > 0 ? runs : [];
}

/**
 * Convert a marked block token list into ParsedLine[].
 * Handles tables, blockquotes, and all standard block elements.
 * @param {any[]} tokens
 * @returns {ParsedLine[]}
 */
function _blockTokensToParsedLines(tokens) {
  /** @type {ParsedLine[]} */
  const parsed = [];

  for (const token of tokens) {
    switch (token.type) {
      case 'heading': {
        const level = Math.min(3, token.depth);
        const type = /** @type {'h1'|'h2'|'h3'} */ (`h${level}`);
        parsed.push({ type, runs: _inlineTokensToRuns(token.tokens || []) });
        break;
      }
      case 'paragraph':
        parsed.push({ type: 'paragraph', runs: _inlineTokensToRuns(token.tokens || []) });
        break;
      case 'code':
        for (const codeLine of (token.text || '').split('\n')) {
          parsed.push({ type: 'code', runs: [{ text: codeLine, bold: false, italic: false, mono: true }], raw: codeLine });
        }
        break;
      case 'blockquote':
        for (const inner of _blockTokensToParsedLines(token.tokens || [])) {
          parsed.push({ ...inner, type: 'quote' });
        }
        break;
      case 'list': {
        let orderedIdx = 1;
        for (const item of (token.items || [])) {
          const itemRuns = [];
          for (const child of (item.tokens || [])) {
            if (child.type === 'text') {
              const childRuns = _inlineTokensToRuns(child.tokens || [{ type: 'text', text: child.text }]);
              itemRuns.push(...childRuns);
            } else if (child.type === 'paragraph') {
              itemRuns.push(..._inlineTokensToRuns(child.tokens || []));
            }
          }
          if (token.ordered) {
            parsed.push({ type: 'numbered', runs: itemRuns, listNumber: orderedIdx++ });
          } else {
            parsed.push({ type: 'bullet', runs: itemRuns });
          }
        }
        break;
      }
      case 'table': {
        // Render table as plain text rows separated by pipes
        const header = (token.header || []).map((/** @type {any} */ h) =>
          _inlineTokensToRuns(h.tokens || []).map((/** @type {TextRun} */ r) => r.text).join('')
        ).join(' | ');
        if (header) {
          parsed.push({ type: 'paragraph', runs: [{ text: header, bold: true, italic: false, mono: false }] });
          parsed.push({ type: 'hr', runs: [] });
        }
        for (const row of (token.rows || [])) {
          const cells = row.map((/** @type {any} */ cell) =>
            _inlineTokensToRuns(cell.tokens || []).map((/** @type {TextRun} */ r) => r.text).join('')
          ).join(' | ');
          parsed.push({ type: 'paragraph', runs: [{ text: cells, bold: false, italic: false, mono: false }] });
        }
        parsed.push({ type: 'blank', runs: [] });
        break;
      }
      case 'hr':
        parsed.push({ type: 'hr', runs: [] });
        break;
      case 'space':
        parsed.push({ type: 'blank', runs: [] });
        break;
      default:
        if (token.text) {
          parsed.push({ type: 'paragraph', runs: [{ text: token.text, bold: false, italic: false, mono: false }] });
        }
    }
  }
  return parsed;
}

/**
 * Parse markdown text into structured lines using the `marked` lexer.
 * @param {string} md
 * @returns {ParsedLine[]}
 */
function parseMarkdown(md) {
  const tokens = marked.lexer(md);
  return _blockTokensToParsedLines(tokens);
}

/**
 * Convert a Markdown string to PDF bytes.
 *
 * @param {string} mdString - Markdown source text
 * @param {MdPdfOptions} [options]
 * @returns {Promise<Uint8Array>}
 */
export async function convertMarkdownToPdf(mdString, options = {}) {
  const {
    pageSize = 'A4',
    fontSize = 12,
    marginTop = 72,
    marginBottom = 72,
    marginLeft = 72,
    marginRight = 72,
  } = options;

  const dims = PAGE_SIZES[pageSize] || PAGE_SIZES.A4;
  const pdfDoc = await PDFDocument.create();

  // Embed standard fonts
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
  const fontBoldItalic = await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique);
  const fontMono = await pdfDoc.embedFont(StandardFonts.Courier);

  const usableWidth = dims.width - marginLeft - marginRight;

  /**
   * Select the right font for a text run.
   * @param {TextRun} run
   */
  function getFont(run) {
    if (run.mono) return fontMono;
    if (run.bold && run.italic) return fontBoldItalic;
    if (run.bold) return fontBold;
    if (run.italic) return fontItalic;
    return fontRegular;
  }

  // Parse markdown via marked lexer → structured lines
  const lines = parseMarkdown(mdString);

  // Rendering state
  let page = pdfDoc.addPage([dims.width, dims.height]);
  let y = dims.height - marginTop;

  /**
   * Ensure we have enough space; add a new page if not.
   * @param {number} needed - Points of vertical space needed
   */
  function ensureSpace(needed) {
    if (y - needed < marginBottom) {
      page = pdfDoc.addPage([dims.width, dims.height]);
      y = dims.height - marginTop;
    }
  }

  /**
   * Draw text runs at the current position, wrapping lines.
   * @param {TextRun[]} runs
   * @param {number} size
   * @param {number} xOffset - Additional left offset (for lists, quotes)
   */
  function drawRuns(runs, size, xOffset = 0) {
    const lineHeight = size * 1.4;
    let x = marginLeft + xOffset;
    const maxX = dims.width - marginRight;

    for (const run of runs) {
      const font = getFont(run);
      // Replace control chars (newlines, tabs) that pdf-lib WinAnsi can't encode
      const safeText = run.text.replace(/[\x00-\x09\x0B-\x1F\x7F]/g, ' ').replace(/\n/g, ' ');
      const words = safeText.split(/( +)/);

      for (const word of words) {
        if (!word) continue;
        const wordWidth = font.widthOfTextAtSize(word, size);

        // Wrap if needed
        if (x + wordWidth > maxX && x > marginLeft + xOffset) {
          y -= lineHeight;
          x = marginLeft + xOffset;
          ensureSpace(lineHeight);
        }

        page.drawText(word, { x, y, size, font, color: rgb(0, 0, 0) });
        x += wordWidth;
      }
    }

    y -= lineHeight;
  }

  // Render each parsed line
  for (const line of lines) {
    switch (line.type) {
      case 'h1': {
        const size = fontSize * 2;
        ensureSpace(size * 1.6);
        y -= size * 0.3; // extra space before heading
        // Force bold for headings
        const boldRuns = line.runs.map(r => ({ ...r, bold: true }));
        drawRuns(boldRuns, size);
        y -= size * 0.2; // extra space after heading
        break;
      }

      case 'h2': {
        const size = fontSize * 1.5;
        ensureSpace(size * 1.6);
        y -= size * 0.2;
        const boldRuns = line.runs.map(r => ({ ...r, bold: true }));
        drawRuns(boldRuns, size);
        y -= size * 0.15;
        break;
      }

      case 'h3': {
        const size = fontSize * 1.2;
        ensureSpace(size * 1.6);
        y -= size * 0.15;
        const boldRuns = line.runs.map(r => ({ ...r, bold: true }));
        drawRuns(boldRuns, size);
        y -= size * 0.1;
        break;
      }

      case 'bullet': {
        ensureSpace(fontSize * 1.6);
        const bulletPrefix = [{ text: '\u2022  ', bold: false, italic: false, mono: false }];
        drawRuns([...bulletPrefix, ...line.runs], fontSize, 18);
        break;
      }

      case 'numbered': {
        ensureSpace(fontSize * 1.6);
        const numPrefix = [{ text: `${line.listNumber || 1}.  `, bold: false, italic: false, mono: false }];
        drawRuns([...numPrefix, ...line.runs], fontSize, 18);
        break;
      }

      case 'quote': {
        ensureSpace(fontSize * 1.6);
        // Draw a vertical bar indicator
        const barX = marginLeft + 8;
        page.drawRectangle({
          x: barX,
          y: y - fontSize * 0.3,
          width: 2,
          height: fontSize * 1.2,
          color: rgb(0.7, 0.7, 0.7),
        });
        const italicRuns = line.runs.map(r => ({ ...r, italic: true }));
        drawRuns(italicRuns, fontSize, 18);
        break;
      }

      case 'code': {
        ensureSpace(fontSize * 1.4);
        // Light gray background
        const codeSize = fontSize * 0.9;
        page.drawRectangle({
          x: marginLeft,
          y: y - codeSize * 0.4,
          width: usableWidth,
          height: codeSize * 1.3,
          color: rgb(0.95, 0.95, 0.95),
        });
        drawRuns(line.runs, codeSize, 6);
        break;
      }

      case 'hr': {
        ensureSpace(fontSize * 1.2);
        y -= fontSize * 0.4;
        page.drawLine({
          start: { x: marginLeft, y },
          end: { x: dims.width - marginRight, y },
          thickness: 1,
          color: rgb(0.6, 0.6, 0.6),
        });
        y -= fontSize * 0.4;
        break;
      }

      case 'blank':
        y -= fontSize * 0.6;
        break;

      case 'paragraph':
      default: {
        ensureSpace(fontSize * 1.6);
        drawRuns(line.runs, fontSize);
        break;
      }
    }
  }

  pdfDoc.setCreator('NovaReader');
  pdfDoc.setProducer('NovaReader + pdf-lib');

  const pdfBytes = await pdfDoc.save();
  return new Uint8Array(pdfBytes);
}
