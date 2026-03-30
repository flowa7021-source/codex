// @ts-check

import { XlsxBuilder } from './xlsx-builder.js';
import { extractTables } from './table-extractor.js';

/**
 * @typedef {Object} ConvertOptions
 * @property {'auto'|'manual'} [mode='auto']
 * @property {{x: number, y: number, width: number, height: number}} [selectedArea]
 * @property {boolean} [sheetsPerPage=false]  - true = one sheet per page; false = one sheet per table
 * @property {boolean} [numberDetection=true] - auto-detect numbers, dates, currencies
 * @property {(current: number, total: number) => void} [onProgress] - progress callback
 * @property {string} [pageRange] - e.g. "1-5,8" to limit pages
 */

/**
 * @typedef {Object} ConvertResult
 * @property {Blob} blob
 * @property {number} sheetCount
 * @property {number} tableCount
 */

/**
 * @typedef {Object} TypedCell
 * @property {string|number} value
 * @property {'string'|'number'|'date'|'currency'|'percentage'} type
 * @property {string} [format] - e.g. currency symbol or percentage format
 */

/* ------------------------------------------------------------------ */
/*  Regex patterns for data-type detection                            */
/* ------------------------------------------------------------------ */

/**
 * Matches plain numbers and thousand-separated numbers.
 * Examples: "123", "-1,234.56", "1.234,56", "1 234", "-42.5"
 * @type {RegExp}
 */
const RE_NUMBER = /^-?\d{1,3}([,. ]\d{3})*([.,]\d+)?$|^-?\d+([.,]\d+)?$/;

/** @type {RegExp} */
const RE_DATE = /^\d{1,2}[./\-]\d{1,2}[./\-]\d{2,4}$/;

/** @type {RegExp} */
const RE_CURRENCY_PREFIX = /^([$€£¥₽])\s*([\d.,\s]+)$/;

/** @type {RegExp} */
const RE_CURRENCY_SUFFIX = /^([\d.,\s]+)\s*([$€£¥₽])$/;

/** @type {RegExp} */
const RE_PERCENTAGE = /^([\d.,]+)\s*%$/;

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

/**
 * Parse a numeric string, removing thousands separators and converting
 * comma-decimal to dot-decimal.
 * @param {string} raw
 * @returns {number}
 */
function parseNumeric(raw) {
  // Remove spaces used as thousands separators
  const noSpaces = raw.replace(/\s/g, '');

  const lastComma = noSpaces.lastIndexOf(',');
  const lastDot = noSpaces.lastIndexOf('.');

  /** @type {string} */
  let cleaned;

  if (lastComma > lastDot) {
    // Comma is the decimal separator (e.g. "1.234,56")
    cleaned = noSpaces.replace(/\./g, '').replace(',', '.');
  } else {
    // Dot is the decimal separator or there is no decimal (e.g. "1,234.56")
    cleaned = noSpaces.replace(/,/g, '');
  }

  return Number(cleaned);
}

/**
 * Detect the type of a cell's text and return a typed representation.
 * @param {string} raw
 * @param {boolean} numberDetection
 * @returns {TypedCell}
 */
function typeCell(raw, numberDetection) {
  const text = raw.trim();

  if (!numberDetection || text === '') {
    return { value: text, type: 'string' };
  }

  // Percentage (check before plain number so "50%" isn't caught as number)
  const pctMatch = text.match(RE_PERCENTAGE);
  if (pctMatch) {
    const num = parseNumeric(pctMatch[1]);
    if (isFinite(num)) {
      return { value: num / 100, type: 'percentage', format: '0.00%' };
    }
  }

  // Currency with prefix  e.g. "$1,234.56"
  const curPrefixMatch = text.match(RE_CURRENCY_PREFIX);
  if (curPrefixMatch) {
    const symbol = curPrefixMatch[1];
    const num = parseNumeric(curPrefixMatch[2]);
    if (isFinite(num)) {
      return { value: num, type: 'currency', format: symbol };
    }
  }

  // Currency with suffix  e.g. "1.234,56 €"
  const curSuffixMatch = text.match(RE_CURRENCY_SUFFIX);
  if (curSuffixMatch) {
    const symbol = curSuffixMatch[2];
    const num = parseNumeric(curSuffixMatch[1]);
    if (isFinite(num)) {
      return { value: num, type: 'currency', format: symbol };
    }
  }

  // Date  e.g. "12/31/2024"
  if (RE_DATE.test(text)) {
    return { value: text, type: 'date' };
  }

  // Plain number  e.g. "-1,234.56"
  if (RE_NUMBER.test(text)) {
    const num = parseNumeric(text);
    if (isFinite(num)) {
      return { value: num, type: 'number' };
    }
  }

  return { value: text, type: 'string' };
}

/**
 * Convert a TypedCell to an XlsxBuilder-compatible CellValue.
 * Maps internal types (currency, percentage) to XlsxBuilder's types
 * with appropriate number formats.
 *
 * @param {string} rawText - the cell's raw text (CellData.text)
 * @param {boolean} numberDetection
 * @returns {import('./xlsx-builder.js').CellValue}
 */
function typeCellToXlsx(rawText, numberDetection) {
  const typed = typeCell(rawText, numberDetection);

  switch (typed.type) {
    case 'number':
      return { value: /** @type {number} */ (typed.value), type: 'number' };

    case 'date':
      return { value: /** @type {string} */ (typed.value), type: 'date', style: { numberFormat: 'dd.mm.yyyy' } };

    case 'currency': {
      const symbol = typed.format || '$';
      return {
        value: /** @type {number} */ (typed.value),
        type: 'number',
        style: { numberFormat: `${symbol}#,##0.00` },
      };
    }

    case 'percentage':
      return {
        value: /** @type {number} */ (typed.value),
        type: 'number',
        style: { numberFormat: '0.00%' },
      };

    default:
      // string — return the plain string value
      return /** @type {string} */ (typed.value);
  }
}

/**
 * Sanitize a string for use as an Excel sheet name.
 * Excel sheet names: max 31 chars, no  \ / ? * [ ] :  characters.
 * @param {string} name
 * @returns {string}
 */
function sanitizeSheetName(name) {
  return name.replace(/[\\/?*[\]:]/g, '_').slice(0, 31);
}

/**
 * Yield to the UI thread. Returns a promise that resolves after a 0ms
 * setTimeout so the browser can process events / paint.
 * @returns {Promise<void>}
 */
function yieldToUI() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Lazily load PDF.js (pdfjs-dist) via dynamic import and return the library
 * object.  The caller is responsible for setting `workerSrc` if needed.
 * @returns {Promise<typeof import('pdfjs-dist')>}
 */
async function loadPdfjs() {
  const pdfjs = await import('pdfjs-dist');
  return pdfjs;
}

/**
 * Parse a simple page-range string like "1-5,8,10-12" into an array of
 * 1-based page numbers, clamped to [1, maxPage].
 * @param {string} str
 * @param {number} maxPage
 * @returns {number[]}
 */
function parseSimpleRange(str, maxPage) {
  /** @type {Set<number>} */
  const pages = new Set();
  const parts = str.split(',');

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const dashIdx = trimmed.indexOf('-');
    if (dashIdx >= 0) {
      const start = parseInt(trimmed.slice(0, dashIdx), 10);
      const end = parseInt(trimmed.slice(dashIdx + 1), 10);
      if (isNaN(start) || isNaN(end)) continue;
      const lo = Math.max(1, Math.min(start, end));
      const hi = Math.min(maxPage, Math.max(start, end));
      for (let p = lo; p <= hi; p++) {
        pages.add(p);
      }
    } else {
      const num = parseInt(trimmed, 10);
      if (!isNaN(num) && num >= 1 && num <= maxPage) {
        pages.add(num);
      }
    }
  }

  return [...pages].sort((a, b) => a - b);
}

/**
 * Compute column widths from a table's cell rects and apply them to the builder.
 * PDF points / 7 ≈ Excel character units.
 *
 * @param {XlsxBuilder} builder
 * @param {number} sheetIdx - 0-based sheet index
 * @param {import('./table-extractor.js').Table} table
 */
function setColumnWidthsFromTable(builder, sheetIdx, table) {
  if (!table.rows || table.rows.length === 0) return;

  // Find the row with the most columns to determine column count
  const maxCols = Math.max(...table.rows.map((r) => r.length));
  if (maxCols === 0) return;

  // For each column, compute width from the max cell width in that column
  for (let c = 0; c < maxCols; c++) {
    let maxWidth = 0;
    for (const row of table.rows) {
      if (c < row.length && row[c].rect) {
        maxWidth = Math.max(maxWidth, row[c].rect.w);
      }
    }
    if (maxWidth > 0) {
      // Convert PDF points to Excel character units (roughly points / 7)
      const excelWidth = Math.max(8, Math.round(maxWidth / 7));
      builder.setColumnWidth(sheetIdx, c, excelWidth);
    }
  }
}

/**
 * Apply merged-cell ranges for a single table that starts at the given
 * rowOffset within its sheet.
 *
 * @param {XlsxBuilder} builder
 * @param {number} sheetIdx - 0-based sheet index
 * @param {import('./table-extractor.js').Table} table
 * @param {number} rowOffset - the row offset of this table within the sheet
 */
function applyMergesForTable(builder, sheetIdx, table, rowOffset) {
  for (let r = 0; r < table.rows.length; r++) {
    const row = table.rows[r];
    for (let c = 0; c < row.length; c++) {
      const cell = row[c];
      if (cell.mergeAcross && cell.mergeAcross > 0) {
        builder.mergeCells(
          sheetIdx,
          rowOffset + r,
          c,
          rowOffset + r,
          c + cell.mergeAcross,
        );
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Text fallback: group PDF.js text items into lines                 */
/* ------------------------------------------------------------------ */

/**
 * Group PDF.js textContent items into rows of cells.
 * Groups by Y-coordinate proximity into lines, then splits each line
 * into columns based on X-position gaps (for tabular data).
 * @param {any[]} items
 * @returns {string[][]} array of rows, each row is array of cell strings
 */
function _groupTextItemsIntoRows(items) {
  if (!items?.length) return [];
  const filtered = items.filter(it => it.str && it.str.trim());
  if (!filtered.length) return [];

  // Sort: top-to-bottom (PDF Y is bottom-up), then left-to-right
  const sorted = [...filtered].sort((a, b) => {
    const dy = (b.transform?.[5] ?? 0) - (a.transform?.[5] ?? 0);
    if (Math.abs(dy) > 3) return dy;
    return (a.transform?.[4] ?? 0) - (b.transform?.[4] ?? 0);
  });

  // Group into lines by Y proximity
  /** @type {Array<Array<{text: string, x: number, w: number}>>} */
  const lines = [];
  let currentLine = [];
  let lastY = null;

  for (const item of sorted) {
    const y = item.transform?.[5] ?? 0;
    const x = item.transform?.[4] ?? 0;
    const w = item.width || 0;
    if (lastY !== null && Math.abs(y - lastY) > 3) {
      if (currentLine.length) lines.push(currentLine);
      currentLine = [];
    }
    currentLine.push({ text: item.str, x, w });
    lastY = y;
  }
  if (currentLine.length) lines.push(currentLine);

  // Detect column boundaries from X-gaps across ALL lines
  // Collect all gap positions where X-gap > avg char width * 2
  const allGaps = [];
  for (const line of lines) {
    for (let i = 1; i < line.length; i++) {
      const gap = line[i].x - (line[i - 1].x + line[i - 1].w);
      if (gap > 8) { // significant gap (>8pt ≈ >1 char width)
        allGaps.push(line[i].x);
      }
    }
  }
  // Cluster gap positions to find column boundaries
  const colBoundaries = _clusterValues(allGaps, 5);

  // Split each line into columns
  return lines.map(line => {
    if (colBoundaries.length === 0) {
      // No columns detected — single cell per line
      return [line.map(it => it.text).join(' ')];
    }
    const cells = new Array(colBoundaries.length + 1).fill('');
    for (const item of line) {
      let colIdx = colBoundaries.length; // last column by default
      for (let c = 0; c < colBoundaries.length; c++) {
        if (item.x < colBoundaries[c]) { colIdx = c; break; }
      }
      cells[colIdx] = (cells[colIdx] ? cells[colIdx] + ' ' : '') + item.text;
    }
    return cells.map(c => c.trim());
  });
}

/**
 * Cluster numeric values within tolerance, returning sorted centroids.
 * @param {number[]} values
 * @param {number} tolerance
 * @returns {number[]}
 */
function _clusterValues(values, tolerance) {
  if (!values.length) return [];
  const sorted = [...values].sort((a, b) => a - b);
  const clusters = [];
  let clusterStart = 0;
  for (let i = 1; i <= sorted.length; i++) {
    if (i === sorted.length || sorted[i] - sorted[i - 1] > tolerance) {
      // Cluster complete — take centroid if cluster has 2+ members
      const size = i - clusterStart;
      if (size >= 2) {
        let sum = 0;
        for (let j = clusterStart; j < i; j++) sum += sorted[j];
        clusters.push(sum / size);
      }
      clusterStart = i;
    }
  }
  return clusters;
}

/* ------------------------------------------------------------------ */
/*  Main public API                                                   */
/* ------------------------------------------------------------------ */

/**
 * Convert a PDF file (as raw bytes) to an XLSX Blob.
 *
 * @param {Uint8Array|ArrayBuffer} pdfBytes - raw PDF content
 * @param {ConvertOptions} [options]
 * @returns {Promise<ConvertResult>}
 */
export async function convertPdfToXlsx(pdfBytes, options = {}) {
  const {
    mode = 'auto',
    selectedArea,
    sheetsPerPage = false,
    numberDetection = true,
    onProgress,
    pageRange,
  } = options;

  /* ---- 1. Load PDF via PDF.js ----------------------------------- */
  const pdfjs = await loadPdfjs();
  const loadingTask = pdfjs.getDocument({ data: pdfBytes });
  const pdfDoc = await loadingTask.promise;
  const totalPages = pdfDoc.numPages;

  /* ---- 2. Determine which pages to process ---------------------- */
  /** @type {number[]} */
  let pagesToProcess;
  if (pageRange) {
    pagesToProcess = parseSimpleRange(pageRange, totalPages);
  } else {
    pagesToProcess = [];
    for (let i = 1; i <= totalPages; i++) {
      pagesToProcess.push(i);
    }
  }

  const builder = new XlsxBuilder();

  let sheetCount = 0;
  let tableCount = 0;

  /* ---- 3. Iterate pages ----------------------------------------- */
  for (let idx = 0; idx < pagesToProcess.length; idx++) {
    const pageNum = pagesToProcess[idx];

    // Report progress
    if (onProgress) {
      onProgress(idx + 1, pagesToProcess.length);
    }

    // FIX B1 & B2: call extractTables(pdfDoc, pageNum, ...) — NOT extractAllTables(page)
    /** @type {import('./table-extractor.js').Table[]} */
    let tables;

    if (mode === 'manual' && selectedArea) {
      tables = await extractTables(pdfDoc, pageNum, /** @type {any} */ ({ area: selectedArea }));
    } else {
      tables = await extractTables(pdfDoc, pageNum);
    }

    if (!tables || tables.length === 0) {
      // No tables detected — fall back to extracting all text content
      // as a single-column sheet so the XLSX is never empty.
      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();
      if (textContent?.items?.length) {
        const rows = _groupTextItemsIntoRows(textContent.items);
        if (rows.length > 0) {
          const sheetName = sanitizeSheetName(`Page ${pageNum}`);
          // Apply number detection to each cell
          const typedRows = rows.map(row =>
            row.map(cell => typeCellToXlsx(cell, numberDetection))
          );
          builder.addSheet(sheetName, typedRows);
          sheetCount++;
        }
      }
      if (idx % 5 === 0) await yieldToUI();
      continue;
    }

    tableCount += tables.length;

    if (sheetsPerPage) {
      /* -- One sheet per page: merge all tables on this page ------- */
      const sheetName = sanitizeSheetName(`Page ${pageNum}`);
      /** @type {import('./xlsx-builder.js').CellValue[][]} */
      const sheetRows = [];

      /** @type {Array<{table: import('./table-extractor.js').Table, rowOffset: number}>} */
      const mergeQueue = [];

      for (const table of tables) {
        const rowOffset = sheetRows.length;
        mergeQueue.push({ table, rowOffset });

        // FIX B3: iterate table.rows, not table directly
        for (const row of table.rows) {
          // FIX B4: pass cell.text (string), not cell (object)
          // FIX B5: typeCellToXlsx maps currency/percentage to XlsxBuilder-compatible format
          const typedRow = row.map((cell) => typeCellToXlsx(cell.text, numberDetection));
          sheetRows.push(typedRow);
        }

        // Blank separator row between tables on the same sheet
        sheetRows.push([]);
      }

      builder.addSheet(sheetName, sheetRows);

      // A5: Set column widths from the first table's cell rects
      if (tables.length > 0) {
        setColumnWidthsFromTable(builder, sheetCount, tables[0]);
      }

      // Apply merged cells after the sheet exists in the builder
      for (const { table, rowOffset } of mergeQueue) {
        applyMergesForTable(builder, sheetCount, table, rowOffset);
      }

      sheetCount++;
    } else {
      /* -- One sheet per table ------------------------------------ */
      for (let t = 0; t < tables.length; t++) {
        const table = tables[t];
        const sheetName = sanitizeSheetName(
          `Page ${pageNum} - Table ${t + 1}`,
        );

        // FIX B3: iterate table.rows, not table
        // FIX B4: pass cell.text (string), not cell (object)
        // FIX B5: typeCellToXlsx maps currency/percentage to XlsxBuilder format
        const sheetRows = table.rows.map((row) =>
          row.map((cell) => typeCellToXlsx(cell.text, numberDetection)),
        );

        builder.addSheet(sheetName, sheetRows);

        // A5: Set column widths from table cell rects
        setColumnWidthsFromTable(builder, sheetCount, table);

        // Merged cells
        applyMergesForTable(builder, sheetCount, table, 0);

        sheetCount++;
      }
    }

    // Yield to UI every 5 pages so the browser stays responsive
    if (idx % 5 === 0) {
      await yieldToUI();
    }
  }

  /* ---- 4. Handle edge-case: no tables found at all -------------- */
  if (sheetCount === 0) {
    builder.addSheet(sanitizeSheetName('Sheet1'), []);
    sheetCount = 1;
  }

  /* ---- 5. Build XLSX -------------------------------------------- */
  const xlsxBytes = await builder.build();

  const blob = new Blob([/** @type {any} */ (xlsxBytes)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  return { blob, sheetCount, tableCount };
}
