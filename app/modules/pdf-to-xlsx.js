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

/** Matches financial negative numbers in parentheses: (1,234.56) → -1234.56 */
const RE_NEGATIVE_PARENS = /^\(([0-9][0-9\s,.']*)\)$/;

// ── Structure-detection keywords (total/subtotal rows) ─────────────────────
const TOTAL_KEYWORDS = new Set([
  'итого', 'итог', 'всего', 'сумма', 'subtotal', 'total', 'grand total',
  'итого:', 'всего:', 'total:',
]);

// ── Cell styles for structured tables ─────────────────────────────────────
/** @type {import('./xlsx-builder.js').CellStyle} */
const STYLE_HEADER = { bold: true, bgColor: '2F5597', fontColor: 'FFFFFF', borders: true, alignment: 'center' };
/** @type {import('./xlsx-builder.js').CellStyle} */
const STYLE_TOTAL  = { bold: true, bgColor: 'E2EFDA', borders: true };
/** @type {import('./xlsx-builder.js').CellStyle} */
const STYLE_DATA   = { borders: true };

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
  // Handle financial parenthesised negatives: (1 234,56) → -1234.56
  const parenMatch = raw.trim().match(RE_NEGATIVE_PARENS);
  if (parenMatch) {
    const inner = parseNumeric(parenMatch[1]);
    return isFinite(inner) ? -inner : NaN;
  }

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

  // Financial parenthesised negatives: (1 234,56) → -1234.56
  if (RE_NEGATIVE_PARENS.test(text)) {
    const num = parseNumeric(text);
    if (isFinite(num)) return { value: num, type: 'number' };
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

  // Estimate average item height for adaptive Y-tolerance
  let avgItemH = 12;
  if (filtered.length > 0) {
    const heights = filtered.map(it => it.height || Math.sqrt((it.transform?.[0] ?? 12) ** 2 + (it.transform?.[1] ?? 0) ** 2));
    avgItemH = heights.reduce((a, b) => a + b, 0) / heights.length || 12;
  }

  // Sort: top-to-bottom (PDF Y is bottom-up), then left-to-right
  const sorted = [...filtered].sort((a, b) => {
    const dy = (b.transform?.[5] ?? 0) - (a.transform?.[5] ?? 0);
    const yTol = Math.max(3, avgItemH * 0.3);
    if (Math.abs(dy) > yTol) return dy;
    return (a.transform?.[4] ?? 0) - (b.transform?.[4] ?? 0);
  });

  // Group into lines by Y proximity (adaptive tolerance)
  /** @type {Array<Array<{text: string, x: number, w: number}>>} */
  const lines = [];
  let currentLine = [];
  let lastY = null;
  const yTolerance = Math.max(3, avgItemH * 0.3);

  for (const item of sorted) {
    const y = item.transform?.[5] ?? 0;
    const x = item.transform?.[4] ?? 0;
    const fontSize = Math.sqrt((item.transform?.[0] ?? 12) ** 2 + (item.transform?.[1] ?? 0) ** 2);
    // Fallback width for items with width=0
    const w = item.width || (item.str.length * fontSize * 0.5);
    if (lastY !== null && Math.abs(y - lastY) > yTolerance) {
      if (currentLine.length) lines.push(currentLine);
      currentLine = [];
    }
    currentLine.push({ text: item.str, x, w });
    lastY = y;
  }
  if (currentLine.length) lines.push(currentLine);

  // Detect column boundaries from X-gaps across ALL lines
  // Adaptive gap threshold based on average character width
  const totalChars = lines.flat().reduce((s, it) => s + (it.text?.length || 0), 0);
  const totalW = lines.flat().reduce((s, it) => s + it.w, 0);
  const avgCharWidth = totalChars > 0 && totalW > 0 ? totalW / totalChars : avgItemH * 0.5;
  const gapThreshold = Math.max(8, avgCharWidth * 2.5);

  const allGaps = [];
  for (const line of lines) {
    for (let i = 1; i < line.length; i++) {
      const gap = line[i].x - (line[i - 1].x + line[i - 1].w);
      if (gap > gapThreshold) {
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
/*  Structural analysis helpers                                       */
/* ------------------------------------------------------------------ */

/**
 * Detect how many leading rows are header rows.
 * Heuristic: a row is a header when it contains NO numeric cells and has
 * non-empty text in the majority of its columns.
 * @param {string[][]} rawRows
 * @returns {number}
 */
function detectHeaderRows(rawRows) {
  if (!rawRows || rawRows.length === 0) return 0;
  const colCount = Math.max(...rawRows.map(r => r.length));
  let headerCount = 0;

  for (let i = 0; i < Math.min(5, rawRows.length); i++) {
    const row = rawRows[i];
    const nonEmpty = row.filter(c => String(c || '').trim().length > 0).length;
    if (nonEmpty < Math.max(1, colCount * 0.4)) break; // mostly empty → stop

    const hasNumeric = row.some(c => {
      const t = String(c || '').trim();
      if (!t || t === '-' || t === '—') return false;
      const { type } = typeCell(t, true);
      return type === 'number' || type === 'currency';
    });
    if (!hasNumeric) {
      headerCount = i + 1;
    } else {
      break;
    }
  }
  return headerCount;
}

/**
 * Detect which data rows (after headers) are total/subtotal rows.
 * Returns a Set of row indices (0-based, relative to the rawRows array).
 * @param {string[][]} rawRows
 * @param {number} headerCount
 * @returns {Set<number>}
 */
function detectTotalRows(rawRows, headerCount) {
  const totalRowIndices = new Set();
  for (let i = headerCount; i < rawRows.length; i++) {
    const row = rawRows[i];
    const label = String(row[0] || '').trim().toLowerCase();
    if (!label) continue;
    if ([...TOTAL_KEYWORDS].some(kw => label.startsWith(kw))) {
      totalRowIndices.add(i);
    }
  }
  return totalRowIndices;
}

/**
 * Fill empty first-column cells downward (rowspan gap filling).
 * Used for financial reports where a category label spans multiple rows.
 * @param {string[][]} rawRows
 * @param {number} headerCount
 * @returns {string[][]}
 */
function fillRowspanGaps(rawRows, headerCount) {
  let lastLabel = '';
  return rawRows.map((row, i) => {
    if (i < headerCount) return row;
    const cell = String(row[0] || '').trim();
    if (cell) {
      lastLabel = cell;
      return row;
    }
    if (lastLabel) {
      return [lastLabel, ...row.slice(1)];
    }
    return row;
  });
}

/**
 * Build column widths from content (text length-based, clamped 8–45 chars).
 * Applies to the builder immediately.
 * @param {XlsxBuilder} builder
 * @param {number} sheetIdx
 * @param {string[][]} rawRows
 */
function autoFitFromContent(builder, sheetIdx, rawRows) {
  if (!rawRows.length) return;
  const colCount = Math.max(...rawRows.map(r => r.length));
  for (let c = 0; c < colCount; c++) {
    let maxLen = 0;
    for (const row of rawRows) {
      const v = String(row[c] || '');
      if (v.length > maxLen) maxLen = v.length;
    }
    const w = Math.min(45, Math.max(8, maxLen + 2));
    builder.setColumnWidth(sheetIdx, c, w);
  }
}

/**
 * Convert a column index to an Excel letter (A, B, … Z, AA, …).
 * @param {number} col - 0-based
 * @returns {string}
 */
function colLetter(col) {
  let result = '';
  let n = col + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    result = String.fromCharCode(65 + rem) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

/**
 * Build a SUBTOTAL(9,...) formula string for a column range.
 * @param {string} col - column letter, e.g. "B"
 * @param {number} dataStartRow - 1-based Excel row where data starts
 * @param {number} dataEndRow   - 1-based Excel row where data ends (inclusive)
 * @returns {string}
 */
function subtotalFormula(col, dataStartRow, dataEndRow) {
  return `=SUBTOTAL(9,${col}${dataStartRow}:${col}${dataEndRow})`;
}

/**
 * Generate a clean sheet name from a table caption, falling back to
 * "Page N - Tbl M". Ensures uniqueness via the usedNames set.
 * @param {string|null} caption
 * @param {number} pageNum
 * @param {number} tableIdx
 * @param {Set<string>} usedNames
 * @returns {string}
 */
function makeSheetName(caption, pageNum, tableIdx, usedNames) {
  let base = (caption && caption.length >= 3)
    ? caption.replace(/[\\/?*[\]:]/g, '_').slice(0, 28)
    : `Стр.${pageNum} Табл.${tableIdx}`;
  base = base.trim() || `Стр.${pageNum} Табл.${tableIdx}`;
  let name = base;
  let suffix = 2;
  while (usedNames.has(name)) {
    name = `${base.slice(0, 28)} ${suffix++}`;
  }
  usedNames.add(name);
  return name;
}

/**
 * Add an index (table of contents) sheet as the first sheet in the workbook.
 * @param {XlsxBuilder} builder
 * @param {Array<{sheetName: string, caption: string|null, pageNum: number}>} tableInfos
 */
function addIndexSheet(builder, tableInfos) {
  /** @type {import('./xlsx-builder.js').CellValue[][]} */
  const rows = [
    [{ value: 'Содержание', type: 'string', style: { bold: true } }],
    [],
  ];
  for (const info of tableInfos) {
    rows.push([
      `${info.caption || info.sheetName}  →  лист "${info.sheetName}"`,
      `Стр. ${info.pageNum}`,
    ]);
  }
  const idx = builder.addSheet('Оглавление', rows);
  builder.setColumnWidth(idx, 0, 45);
  builder.setColumnWidth(idx, 1, 10);
  builder.setCellStyle(idx, 0, 0, { bold: true });
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
    for (let i = 1; i <= totalPages; i++) pagesToProcess.push(i);
  }

  const builder = new XlsxBuilder();
  const usedSheetNames = new Set();

  let sheetCount = 0;
  let tableCount = 0;

  // Collect table infos for index sheet
  /** @type {Array<{sheetName: string, caption: string|null, pageNum: number}>} */
  const allTableInfos = [];

  /* ---- 3. Iterate pages ----------------------------------------- */
  for (let idx = 0; idx < pagesToProcess.length; idx++) {
    const pageNum = pagesToProcess[idx];

    if (onProgress) onProgress(idx + 1, pagesToProcess.length);

    /** @type {import('./table-extractor.js').Table[]} */
    let tables;
    if (mode === 'manual' && selectedArea) {
      tables = await extractTables(pdfDoc, pageNum, /** @type {any} */ ({ area: selectedArea }));
    } else {
      tables = await extractTables(pdfDoc, pageNum);
    }

    if (!tables || tables.length === 0) {
      // No tables detected — fall back to text extraction as a plain sheet
      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();
      if (textContent?.items?.length) {
        const rows = _groupTextItemsIntoRows(textContent.items);
        if (rows.length > 0) {
          const sheetName = makeSheetName(null, pageNum, 0, usedSheetNames);
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
      /* -- One sheet per page: all tables stacked vertically -------- */
      const sheetName = makeSheetName(null, pageNum, 0, usedSheetNames);
      /** @type {import('./xlsx-builder.js').CellValue[][]} */
      const sheetRows = [];
      /** @type {Array<{table: import('./table-extractor.js').Table, rowOffset: number}>} */
      const mergeQueue = [];

      for (const table of tables) {
        const rawRows = table.rows.map(r => r.map(c => c.text));
        const cleanRows = fillRowspanGaps(rawRows, 0);
        const rowOffset = sheetRows.length;
        mergeQueue.push({ table, rowOffset });
        for (const row of cleanRows) {
          sheetRows.push(row.map(cell => typeCellToXlsx(cell, numberDetection)));
        }
        sheetRows.push([]);
      }

      builder.addSheet(sheetName, sheetRows);
      if (tables.length > 0) setColumnWidthsFromTable(builder, sheetCount, tables[0]);
      for (const { table, rowOffset } of mergeQueue) {
        applyMergesForTable(builder, sheetCount, table, rowOffset);
      }
      sheetCount++;

    } else {
      /* -- One sheet per table (with structure detection) ----------- */
      for (let t = 0; t < tables.length; t++) {
        const table = tables[t];

        // Raw text matrix
        const rawRows = table.rows.map(r => r.map(c => c.text));

        // Structure detection
        const headerCount = detectHeaderRows(rawRows);
        const totalRowSet = detectTotalRows(rawRows, headerCount);
        const filledRows = fillRowspanGaps(rawRows, headerCount);
        const colCount = Math.max(...filledRows.map(r => r.length));

        const sheetName = makeSheetName(null, pageNum, t + 1, usedSheetNames);
        allTableInfos.push({ sheetName, caption: null, pageNum });

        // Build typed rows
        /** @type {import('./xlsx-builder.js').CellValue[][]} */
        const sheetRows = filledRows.map((row, rIdx) => {
          const isTotal = totalRowSet.has(rIdx);
          if (isTotal) {
            // Total row: first cell as text, rest will get SUBTOTAL formulas below
            return row.map((cell, cIdx) => {
              if (cIdx === 0) return cell;
              // placeholder — will be replaced with formula
              return typeCellToXlsx(cell, numberDetection);
            });
          }
          return row.map(cell => typeCellToXlsx(cell, numberDetection));
        });

        const sheetIdx = builder.addSheet(sheetName, sheetRows);

        // Apply cell styles
        for (let r = 0; r < sheetRows.length; r++) {
          const isHeader = r < headerCount;
          const isTotal = totalRowSet.has(r);
          for (let c = 0; c < colCount; c++) {
            if (isHeader) {
              builder.setCellStyle(sheetIdx, r, c, STYLE_HEADER);
            } else if (isTotal) {
              builder.setCellStyle(sheetIdx, r, c, STYLE_TOTAL);
            } else {
              builder.setCellStyle(sheetIdx, r, c, STYLE_DATA);
            }
          }
        }

        // Replace total-row numeric cells with SUBTOTAL(9,...) formulas
        if (totalRowSet.size > 0) {
          for (const totalRowIdx of totalRowSet) {
            const excelTotalRow = totalRowIdx + 1; // 1-based

            // Find the preceding data range (from after last total or after header)
            let dataStart = headerCount;
            for (const prevTotalIdx of totalRowSet) {
              if (prevTotalIdx < totalRowIdx) dataStart = prevTotalIdx + 1;
            }
            const dataStartExcel = dataStart + 1;  // 1-based
            const dataEndExcel   = excelTotalRow - 1;

            if (dataEndExcel >= dataStartExcel) {
              for (let c = 1; c < colCount; c++) {
                const cell = filledRows[totalRowIdx]?.[c];
                const { type } = typeCell(cell || '', numberDetection);
                if (type === 'number' || type === 'currency' || type === 'percentage' || !cell?.trim() || cell.trim() === '-') {
                  const formula = subtotalFormula(colLetter(c), dataStartExcel, dataEndExcel);
                  builder._sheets[sheetIdx].rows[totalRowIdx][c] = {
                    value: formula, type: 'formula',
                    style: STYLE_TOTAL,
                  };
                }
              }
            }
          }
        }

        // Column widths: prefer PDF bbox, fall back to content-based
        if (table.rows.some(r => r.some(c => c.rect?.w))) {
          setColumnWidthsFromTable(builder, sheetIdx, table);
        } else {
          autoFitFromContent(builder, sheetIdx, filledRows);
        }

        // Merged cells from table-extractor
        applyMergesForTable(builder, sheetIdx, table, 0);

        // Freeze panes: freeze header rows
        if (headerCount > 0) {
          builder.setFreezePanes(sheetIdx, headerCount, 0);
        }

        // Auto-filter on header row (last header row)
        if (headerCount > 0 && filledRows.length > headerCount) {
          const filterRow = headerCount - 1;
          builder.setAutoFilter(sheetIdx, filterRow, 0, filledRows.length - 1, colCount - 1);
        }

        sheetCount++;
      }
    }

    if (idx % 5 === 0) await yieldToUI();
  }

  /* ---- 4. Handle edge-case: no tables found at all -------------- */
  if (sheetCount === 0) {
    builder.addSheet(sanitizeSheetName('Sheet1'), []);
    sheetCount = 1;
  }

  /* ---- 5. Prepend index sheet when > 3 tables ------------------- */
  if (allTableInfos.length > 3 && !sheetsPerPage) {
    addIndexSheet(builder, allTableInfos);
    // Move index sheet to position 0
    const last = builder._sheets.pop();
    if (last) builder._sheets.unshift(last);
  }

  /* ---- 6. Build XLSX -------------------------------------------- */
  const xlsxBytes = await builder.build();

  const blob = new Blob([/** @type {any} */ (xlsxBytes)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  return { blob, sheetCount, tableCount };
}
