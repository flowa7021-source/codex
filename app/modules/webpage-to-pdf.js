// @ts-check
// ═══════════════════════════════════════════════════════════════════════
// NovaReader 3.0 — Webpage to PDF Converter
// Capture a webpage and convert its content to a PDF document
// ═══════════════════════════════════════════════════════════════════════

/**
 * @typedef {Object} PageSize
 * @property {number} width
 * @property {number} height
 */

/** @type {Record<string, PageSize>} */
const PAGE_SIZES = {
  A4:     { width: 595.28, height: 841.89 },
  Letter: { width: 612,    height: 792 },
  Legal:  { width: 612,    height: 1008 },
  A3:     { width: 841.89, height: 1190.55 },
};

/**
 * @typedef {Object} Margins
 * @property {number} top
 * @property {number} right
 * @property {number} bottom
 * @property {number} left
 */

/**
 * Parse HTML content and extract basic structure.
 * @param {string} html
 * @returns {{title: string, sections: {tag: string, text: string}[]}}
 */
function parseHtmlContent(html) {
  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : 'Untitled';

  /** @type {{tag: string, text: string}[]} */
  const sections = [];

  // Extract headings, paragraphs, and list items
  const tagPattern = /<(h[1-6]|p|li|pre|blockquote|td|th|dt|dd)[^>]*>([\s\S]*?)<\/\1>/gi;
  let match;
  while ((match = tagPattern.exec(html)) !== null) {
    const tag = match[1].toLowerCase();
    // Strip inner HTML tags to get plain text
    const text = match[2].replace(/<[^>]+>/g, '').trim();
    if (text) {
      sections.push({ tag, text });
    }
  }

  // If no structured content found, extract all text
  if (sections.length === 0) {
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const bodyContent = bodyMatch ? bodyMatch[1] : html;
    const plainText = bodyContent.replace(/<[^>]+>/g, '').trim();
    if (plainText) {
      sections.push({ tag: 'p', text: plainText });
    }
  }

  return { title, sections };
}

/**
 * Wrap long text into lines that fit within a given width.
 * @param {string} text
 * @param {number} maxCharsPerLine
 * @returns {string[]}
 */
function wrapText(text, maxCharsPerLine) {
  const words = text.split(/\s+/);
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    if (currentLine.length + word.length + 1 > maxCharsPerLine && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = currentLine ? currentLine + ' ' + word : word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

/**
 * Capture a webpage to PDF.
 * In browser: fetch HTML, extract text, render to PDF via pdf-lib.
 *
 * @param {string} url
 * @param {object} [options]
 * @param {string} [options.pageSize]
 * @param {Margins} [options.margins]
 * @param {string} [options.htmlContent] - Pre-fetched HTML (bypasses fetch)
 * @returns {Promise<{blob: Blob, title: string, pageCount: number}>}
 */
export async function captureWebpageToPdf(url, options = {}) {
  const {
    pageSize = 'A4',
    margins = { top: 50, right: 50, bottom: 50, left: 50 },
    htmlContent,
  } = options;

  const size = PAGE_SIZES[pageSize] || PAGE_SIZES.A4;

  // 1. Fetch HTML content
  let html = htmlContent || '';
  if (!html) {
    const response = await fetch(url);
    html = await response.text();
  }

  // 2. Parse structure
  const { title, sections } = parseHtmlContent(html);

  // 3. Create PDF with pdf-lib
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  pdfDoc.setTitle(title);
  pdfDoc.setProducer('NovaReader Webpage Capture');

  const contentWidth = size.width - margins.left - margins.right;
  const _contentHeight = size.height - margins.top - margins.bottom;

  // Font sizes by tag
  /** @type {Record<string, number>} */
  const fontSizes = {
    h1: 24, h2: 20, h3: 16, h4: 14, h5: 12, h6: 11,
    p: 11, li: 11, pre: 10, blockquote: 11, td: 10, th: 10, dt: 11, dd: 11,
  };

  let page = pdfDoc.addPage([size.width, size.height]);
  let y = size.height - margins.top;

  for (const section of sections) {
    const fontSize = fontSizes[section.tag] || 11;
    const isHeading = section.tag.startsWith('h');
    const currentFont = isHeading ? boldFont : font;
    const lineHeight = fontSize * 1.4;
    const charsPerLine = Math.floor(contentWidth / (fontSize * 0.5));
    const lines = wrapText(section.text, charsPerLine);

    // Add spacing before headings
    if (isHeading) {
      y -= fontSize * 0.5;
    }

    for (const line of lines) {
      // Check if we need a new page
      if (y - lineHeight < margins.bottom) {
        page = pdfDoc.addPage([size.width, size.height]);
        y = size.height - margins.top;
      }

      page.drawText(line, {
        x: margins.left + (section.tag === 'li' ? 15 : 0),
        y: y - fontSize,
        size: fontSize,
        font: currentFont,
        color: rgb(0, 0, 0),
      });

      y -= lineHeight;
    }

    // Add spacing after paragraphs
    y -= fontSize * 0.3;
  }

  // 4. Save and return
  const bytes = await pdfDoc.save();
  const blob = new Blob([/** @type {any} */ (bytes)], { type: 'application/pdf' });

  return {
    blob,
    title,
    pageCount: pdfDoc.getPageCount(),
  };
}

// Exported for testing
export { parseHtmlContent, wrapText, PAGE_SIZES };
