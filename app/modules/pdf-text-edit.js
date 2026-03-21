// ─── PDF Inline Text Editing ────────────────────────────────────────────────
// Direct text editing in PDF via pdf-lib. Font replacement, spell-check hooks.

import { PDFDocument, StandardFonts, rgb, PDFName } from 'pdf-lib';

const STANDARD_FONT_MAP = {
  'TimesRoman': StandardFonts.TimesRoman,
  'TimesRomanBold': StandardFonts.TimesRomanBold,
  'TimesRomanItalic': StandardFonts.TimesRomanItalic,
  'Helvetica': StandardFonts.Helvetica,
  'HelveticaBold': StandardFonts.HelveticaBold,
  'Courier': StandardFonts.Courier,
  'CourierBold': StandardFonts.CourierBold,
};

/**
 * Apply a set of text edits to a PDF document.
 * Each edit specifies a page, position, old text, and new text.
 *
 * @param {Uint8Array|ArrayBuffer} pdfBytes
 * @param {TextEdit[]} edits
 * @returns {Promise<Blob>}
 *
 * @typedef {object} TextEdit
 * @property {number} page - 1-indexed page number
 * @property {number} x - X coordinate of the text start
 * @property {number} y - Y coordinate (from bottom)
 * @property {string} oldText - Original text (for verification)
 * @property {string} newText - Replacement text
 * @property {number} [fontSize=12]
 * @property {string} [fontName='Helvetica']
 * @property {{r:number, g:number, b:number}} [color={r:0,g:0,b:0}]
 */
export async function applyTextEdits(pdfBytes, edits) {
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const pages = pdfDoc.getPages();
  const fontCache = {};

  for (const edit of edits) {
    const pageIdx = edit.page - 1;
    if (pageIdx < 0 || pageIdx >= pages.length) continue;

    const page = pages[pageIdx];
    const fontKey = edit.fontName || 'Helvetica';

    if (!fontCache[fontKey]) {
      const stdFont = STANDARD_FONT_MAP[fontKey];
      fontCache[fontKey] = stdFont
        ? await pdfDoc.embedFont(stdFont)
        : await pdfDoc.embedFont(StandardFonts.Helvetica);
    }

    const font = fontCache[fontKey];
    const fontSize = edit.fontSize || 12;
    const color = edit.color ? rgb(edit.color.r, edit.color.g, edit.color.b) : rgb(0, 0, 0);

    // Whiteout the old text area
    const oldWidth = font.widthOfTextAtSize(edit.oldText || edit.newText, fontSize);
    const lineHeight = fontSize * 1.2;

    // Draw white rectangle over old text
    page.drawRectangle({
      x: edit.x - 1,
      y: edit.y - 2,
      width: oldWidth + 4,
      height: lineHeight + 2,
      color: rgb(1, 1, 1), // white
    });

    // Draw new text
    page.drawText(edit.newText, {
      x: edit.x,
      y: edit.y,
      size: fontSize,
      font,
      color,
    });
  }

  return new Blob([await pdfDoc.save()], { type: 'application/pdf' });
}

/**
 * Add a text block to a specific position on a PDF page.
 * Used for inserting new text elements.
 */
export async function addTextBlock(pdfBytes, options) {
  const {
    page: pageNum,
    text,
    x, y,
    fontSize = 12,
    fontName = 'Helvetica',
    color = { r: 0, g: 0, b: 0 },
    maxWidth,
  } = options;

  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const page = pdfDoc.getPages()[pageNum - 1];
  if (!page) throw new Error(`Page ${pageNum} not found`);

  const stdFont = STANDARD_FONT_MAP[fontName] || StandardFonts.Helvetica;
  const font = await pdfDoc.embedFont(stdFont);
  const textColor = rgb(color.r, color.g, color.b);

  if (maxWidth) {
    // Word-wrap text
    const lines = wrapText(text, font, fontSize, maxWidth);
    let currentY = y;
    const lineHeight = fontSize * 1.4;
    for (const line of lines) {
      page.drawText(line, { x, y: currentY, size: fontSize, font, color: textColor });
      currentY -= lineHeight;
    }
  } else {
    page.drawText(text, { x, y, size: fontSize, font, color: textColor });
  }

  return new Blob([await pdfDoc.save()], { type: 'application/pdf' });
}

function wrapText(text, font, fontSize, maxWidth) {
  const words = text.split(/\s+/);
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const width = font.widthOfTextAtSize(testLine, fontSize);
    if (width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

/**
 * Replace all occurrences of a string in a PDF's text content streams.
 * This is a basic find-and-replace at the content stream level.
 */
export async function findAndReplace(pdfBytes, searchText, replaceText, options = {}) {
  const { caseSensitive = true, pageRange } = options;
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const pages = pdfDoc.getPages();
  let replacements = 0;

  for (let i = 0; i < pages.length; i++) {
    if (pageRange && !pageRange.includes(i + 1)) continue;

    const page = pages[i];
    try {
      const contents = page.node.get(PDFName.of('Contents'));
      if (!contents) continue;

      // Get content stream as text
      const ref = contents;
      const stream = pdfDoc.context.lookup(ref);
      if (!stream?.getContents) continue;

      const decoded = new TextDecoder().decode(stream.getContents());

      // Search for text in TJ/Tj operators
      const search = caseSensitive ? searchText : searchText.toLowerCase();
      const target = caseSensitive ? decoded : decoded.toLowerCase();

      if (target.includes(search)) {
        // Replace in the decoded stream
        const regex = new RegExp(
          searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
          caseSensitive ? 'g' : 'gi'
        );
        const newContent = decoded.replace(regex, replaceText);
        const encoded = new TextEncoder().encode(newContent);
        stream.setContents(encoded);
        replacements++;
      }
    } catch (err) {
      console.warn('[pdf-ops] error:', err?.message);
      // Skip pages with complex content streams
    }
  }

  return {
    blob: new Blob([await pdfDoc.save()], { type: 'application/pdf' }),
    replacements,
  };
}

/**
 * List available standard fonts for text editing.
 */
export function getAvailableFonts() {
  return Object.keys(STANDARD_FONT_MAP).map(name => ({
    name,
    label: name.replace(/([A-Z])/g, ' $1').trim(),
  }));
}

/**
 * Simple spell-check hook. Returns words not found in the provided dictionary.
 * @param {string} text
 * @param {Set<string>} dictionary
 * @returns {string[]} Misspelled words
 */
export function spellCheck(text, dictionary) {
  if (!text || !dictionary) return [];
  const words = text.match(/[\p{L}]{2,}/gu) || [];
  return words.filter(w => !dictionary.has(w.toLowerCase()));
}
