// @ts-check
// ─── PDF → RTF Converter ─────────────────────────────────────────────────────
// Extracts text from PDF pages (via PDF.js) and produces an RTF document
// preserving basic font information, bold/italic style hints, and page breaks.

/**
 * @typedef {Object} RtfResult
 * @property {Blob} blob
 * @property {number} pageCount
 */

/** @type {typeof import('pdfjs-dist') | null} */
let _pdfjsLib = null;

/**
 * Lazily load PDF.js.
 * @returns {Promise<typeof import('pdfjs-dist')>}
 */
async function loadPdfjs() {
  if (!_pdfjsLib) {
    _pdfjsLib = await import('pdfjs-dist');
  }
  return _pdfjsLib;
}

/** Yield to UI thread. */
const yieldToUI = () => new Promise(r => setTimeout(r, 0));

/**
 * Escape RTF special characters.
 * Backslash, open brace, and close brace must be escaped.
 * @param {string} text
 * @returns {string}
 */
function escapeRtf(text) {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    if (ch === 0x5C) {        // backslash
      out += '\\\\';
    } else if (ch === 0x7B) { // {
      out += '\\{';
    } else if (ch === 0x7D) { // }
      out += '\\}';
    } else if (ch > 127) {
      // Unicode character → \uN? format
      // The ? is a placeholder for readers that don't support \u
      out += `\\u${ch}?`;
    } else {
      out += text[i];
    }
  }
  return out;
}

/**
 * Determine if a font name likely represents a bold typeface.
 * @param {string} fontName
 * @returns {boolean}
 */
function isBoldFont(fontName) {
  return /bold|black|heavy/i.test(fontName);
}

/**
 * Determine if a font name likely represents an italic typeface.
 * @param {string} fontName
 * @returns {boolean}
 */
function isItalicFont(fontName) {
  return /italic|oblique/i.test(fontName);
}

/**
 * Convert a PDF file to RTF format.
 *
 * @param {Uint8Array|ArrayBuffer} pdfBytes - Raw PDF content
 * @returns {Promise<RtfResult>}
 */
export async function convertPdfToRtf(pdfBytes) {
  const pdfjs = await loadPdfjs();
  const loadingTask = pdfjs.getDocument({ data: pdfBytes });
  const pdfDoc = await loadingTask.promise;
  const totalPages = pdfDoc.numPages;

  // Collect unique font names across all pages for the font table
  /** @type {Map<string, number>} fontName → index */
  const fontMap = new Map();
  fontMap.set('Arial', 0); // Default font

  /** @type {Array<{pageNum: number, items: Array<{text: string, fontName: string, fontSize: number}>}>} */
  const pages = [];

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent();

    /** @type {Array<{text: string, fontName: string, fontSize: number}>} */
    const items = [];

    for (const item of textContent.items) {
      if (!('str' in item)) continue;
      const text = item.str;
      if (!text) continue;

      const fontName = item.fontName || 'Arial';
      const fontSize = Math.abs(item.transform?.[3] || 12);

      // Register font
      if (!fontMap.has(fontName)) {
        fontMap.set(fontName, fontMap.size);
      }

      items.push({ text, fontName, fontSize });
    }

    pages.push({ pageNum, items });
    page.cleanup();

    if (pageNum % 5 === 0) await yieldToUI();
  }

  // ─── Build RTF ─────────────────────────────────────────────────────────

  // Font table
  const fontEntries = [];
  for (const [name, idx] of fontMap) {
    // Clean font name: remove subset prefix like "ABCDEF+"
    const cleanName = name.replace(/^[A-Z]{6}\+/, '');
    fontEntries.push(`{\\f${idx} ${escapeRtf(cleanName)};}`);
  }
  const fontTable = `{\\fonttbl ${fontEntries.join('')}}`;

  // Color table (black only for simplicity)
  const colorTable = '{\\colortbl ;\\red0\\green0\\blue0;}';

  // Document body
  let body = '';

  for (let p = 0; p < pages.length; p++) {
    const pageData = pages[p];

    // Page break before every page except the first
    if (p > 0) {
      body += '\\page\n';
    }

    let lastFontIdx = -1;
    let lastFontSize = -1;
    let lastBold = false;
    let lastItalic = false;

    for (const item of pageData.items) {
      const fontIdx = fontMap.get(item.fontName) || 0;
      // RTF font size is in half-points
      const fsHalf = Math.round(item.fontSize * 2);
      const bold = isBoldFont(item.fontName);
      const italic = isItalicFont(item.fontName);

      // Emit font/size changes
      let prefix = '';
      if (fontIdx !== lastFontIdx) {
        prefix += `\\f${fontIdx}`;
        lastFontIdx = fontIdx;
      }
      if (fsHalf !== lastFontSize) {
        prefix += `\\fs${fsHalf}`;
        lastFontSize = fsHalf;
      }
      if (bold !== lastBold) {
        prefix += bold ? '\\b' : '\\b0';
        lastBold = bold;
      }
      if (italic !== lastItalic) {
        prefix += italic ? '\\i' : '\\i0';
        lastItalic = italic;
      }

      if (prefix) {
        body += prefix + ' ';
      }

      body += escapeRtf(item.text);
    }

    // End paragraph
    body += '\\par\n';
  }

  // Full RTF document
  const rtf = `{\\rtf1\\ansi\\deff0\n${fontTable}\n${colorTable}\n${body}}`;

  const blob = new Blob([rtf], { type: 'application/rtf' });

  return { blob, pageCount: totalPages };
}
