// @ts-check
// ─── PDF → CSV Converter ─────────────────────────────────────────────────────
// Extracts tables from PDF pages and converts them to CSV format.
// Uses the table-extractor module for structured table detection.

/**
 * @typedef {Object} CsvOptions
 * @property {string} [separator=','] - Field separator character
 * @property {boolean} [allPages=true] - Process all pages (vs. first page only)
 * @property {boolean} [tableOnly=true] - Only include detected tables (vs. all text)
 */

/**
 * @typedef {Object} CsvResult
 * @property {string} csv
 * @property {number} tableCount
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
 * Escape a CSV field according to RFC 4180.
 * Fields containing the separator, double quotes, or newlines are wrapped in
 * double quotes with internal double quotes doubled.
 * @param {string} field
 * @param {string} separator
 * @returns {string}
 */
function escapeCsvField(field, separator) {
  if (
    field.includes(separator) ||
    field.includes('"') ||
    field.includes('\n') ||
    field.includes('\r')
  ) {
    return '"' + field.replace(/"/g, '""') + '"';
  }
  return field;
}

/**
 * Convert a 2D string array (table) to CSV text.
 * @param {string[][]} rows
 * @param {string} separator
 * @returns {string}
 */
function tableToCsv(rows, separator) {
  return rows
    .map(row => row.map(cell => escapeCsvField(cell, separator)).join(separator))
    .join('\n');
}

/**
 * Extract all text from a PDF page as tab-separated rows.
 * Groups text items by Y coordinate to form rows.
 * @param {any} page - PDF.js page proxy
 * @returns {Promise<string[][]>}
 */
async function extractPageTextAsRows(page) {
  const textContent = await page.getTextContent();
  const viewport = page.getViewport({ scale: 1.0 });
  const pageHeight = viewport.height;

  // Group items by approximate Y position (within 3pt tolerance)
  /** @type {Map<number, Array<{x: number, text: string}>>} */
  const rowMap = new Map();
  const yTolerance = 3;

  for (const item of textContent.items) {
    if (!('str' in item) || !item.str.trim()) continue;

    const x = item.transform[4];
    const y = pageHeight - item.transform[5]; // flip Y

    // Find existing row key within tolerance
    let foundKey = -1;
    for (const key of rowMap.keys()) {
      if (Math.abs(key - y) <= yTolerance) {
        foundKey = key;
        break;
      }
    }

    const rowKey = foundKey >= 0 ? foundKey : y;
    if (!rowMap.has(rowKey)) {
      rowMap.set(rowKey, []);
    }
    rowMap.get(rowKey)?.push({ x, text: item.str });
  }

  // Sort rows by Y (top to bottom), items within row by X (left to right)
  const sortedKeys = [...rowMap.keys()].sort((a, b) => a - b);
  /** @type {string[][]} */
  const rows = [];

  for (const key of sortedKeys) {
    const items = rowMap.get(key) || [];
    items.sort((a, b) => a.x - b.x);
    rows.push(items.map(it => it.text));
  }

  return rows;
}

/**
 * Convert a PDF file to CSV format.
 *
 * @param {Uint8Array|ArrayBuffer} pdfBytes - Raw PDF content
 * @param {CsvOptions} [options]
 * @returns {Promise<CsvResult>}
 */
export async function convertPdfToCsv(pdfBytes, options = {}) {
  const { separator = ',', allPages = true, tableOnly = true } = options;

  const pdfjs = await loadPdfjs();
  const loadingTask = pdfjs.getDocument({ data: pdfBytes });
  const pdfDoc = await loadingTask.promise;
  const totalPages = pdfDoc.numPages;
  const maxPage = allPages ? totalPages : 1;

  /** @type {string[]} */
  const csvParts = [];
  let tableCount = 0;

  if (tableOnly) {
    // Use table extractor for structured table detection
    const { extractAllTables } = await import('./table-extractor.js');

    for (let pageNum = 1; pageNum <= maxPage; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const tables = await extractAllTables(/** @type {any} */ (page));

      if (tables && /** @type {any} */ (tables).length > 0) {
        for (const table of /** @type {any} */ (tables)) {
          tableCount++;
          const csv = tableToCsv(table, separator);
          if (csv) csvParts.push(csv);
        }
      }

      page.cleanup();
      if (pageNum % 5 === 0) await yieldToUI();
    }
  } else {
    // Extract all text as rows
    for (let pageNum = 1; pageNum <= maxPage; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const rows = await extractPageTextAsRows(page);

      if (rows.length > 0) {
        tableCount++;
        // Use tab separator for raw text mode
        const csv = tableToCsv(rows, separator);
        if (csv) csvParts.push(csv);
      }

      page.cleanup();
      if (pageNum % 5 === 0) await yieldToUI();
    }
  }

  const csv = csvParts.join('\n\n');

  return { csv, tableCount };
}
