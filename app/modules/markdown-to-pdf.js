// @ts-check
// ─── Markdown → PDF Converter ────────────────────────────────────────────────
// Parses a subset of Markdown and renders it to a PDF using pdf-lib.
// Supports: headings, bold, italic, bullet/numbered lists, blockquotes,
// code blocks, horizontal rules, links (rendered as text), and paragraphs.

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

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
 * Parse inline markdown formatting into text runs.
 * Handles **bold**, *italic*, `code`, and [text](url).
 * @param {string} text
 * @returns {TextRun[]}
 */
function parseInline(text) {
  /** @type {TextRun[]} */
  const runs = [];

  // Process inline patterns
  const regex = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|\[(.+?)\]\((.+?)\))/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Text before the match
    if (match.index > lastIndex) {
      runs.push({ text: text.slice(lastIndex, match.index), bold: false, italic: false, mono: false });
    }

    if (match[2]) {
      // ***bold italic***
      runs.push({ text: match[2], bold: true, italic: true, mono: false });
    } else if (match[3]) {
      // **bold**
      runs.push({ text: match[3], bold: true, italic: false, mono: false });
    } else if (match[4]) {
      // *italic*
      runs.push({ text: match[4], bold: false, italic: true, mono: false });
    } else if (match[5]) {
      // `code`
      runs.push({ text: match[5], bold: false, italic: false, mono: true });
    } else if (match[6]) {
      // [text](url) — render text only (links not clickable in PDF)
      runs.push({ text: match[6], bold: false, italic: false, mono: false });
    }

    lastIndex = match.index + match[0].length;
  }

  // Remaining text
  if (lastIndex < text.length) {
    runs.push({ text: text.slice(lastIndex), bold: false, italic: false, mono: false });
  }

  if (runs.length === 0) {
    runs.push({ text, bold: false, italic: false, mono: false });
  }

  return runs;
}

/**
 * Parse markdown text into structured lines.
 * @param {string} md
 * @returns {ParsedLine[]}
 */
function parseMarkdown(md) {
  const rawLines = md.split('\n');
  /** @type {ParsedLine[]} */
  const parsed = [];
  let inCodeBlock = false;

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];

    // Code block toggle
    if (line.trimStart().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      if (!inCodeBlock) continue; // closing fence
      continue; // opening fence
    }

    if (inCodeBlock) {
      parsed.push({ type: 'code', runs: [{ text: line, bold: false, italic: false, mono: true }], raw: line });
      continue;
    }

    // Blank line
    if (line.trim() === '') {
      parsed.push({ type: 'blank', runs: [] });
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|_{3,}|\*{3,})\s*$/.test(line.trim())) {
      parsed.push({ type: 'hr', runs: [] });
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const type = /** @type {'h1'|'h2'|'h3'} */ (`h${level}`);
      parsed.push({ type, runs: parseInline(headingMatch[2]) });
      continue;
    }

    // Bullet list
    const bulletMatch = line.match(/^(\s*[-*+])\s+(.+)$/);
    if (bulletMatch) {
      parsed.push({ type: 'bullet', runs: parseInline(bulletMatch[2]) });
      continue;
    }

    // Numbered list
    const numMatch = line.match(/^(\s*)(\d+)\.\s+(.+)$/);
    if (numMatch) {
      parsed.push({ type: 'numbered', runs: parseInline(numMatch[3]), listNumber: parseInt(numMatch[2], 10) });
      continue;
    }

    // Blockquote
    const quoteMatch = line.match(/^>\s?(.*)$/);
    if (quoteMatch) {
      parsed.push({ type: 'quote', runs: parseInline(quoteMatch[1]) });
      continue;
    }

    // Regular paragraph
    parsed.push({ type: 'paragraph', runs: parseInline(line) });
  }

  return parsed;
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

  // Parse markdown
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
      const words = run.text.split(/( +)/);

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
