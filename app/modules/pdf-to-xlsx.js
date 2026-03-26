// @ts-check

import { XlsxBuilder } from './xlsx-builder.js';
import { extractTables, extractAllTables } from './table-extractor.js';

/**
 * @typedef {Object} ConvertOptions
 * @property {'auto'|'manual'} [mode='auto']
 * @property {{x: number, y: number, width: number, height: number}} [selectedArea]
 * @property {boolean} [sheetsPerPage=false]  - true = one sheet per page; false = one sheet per table
 * @property {boolean} [numberDetection=true] - auto-detect numbers, dates, currencies
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

/** @type {RegExp} */
const RE_NUMBER = /^-?\d+([.,]\d+)?$/;

/** @type {RegExp} */
const RE_DATE = /^\d{1,2}[./\-]\d{1,2}[./\-]\d{2,4}$/;

/** @type {RegExp} */
const RE_CURRENCY_PREFIX = /^([$€£¥₽])\s*([\d.,]+)$/;

/** @type {RegExp} */
const RE_CURRENCY_SUFFIX = /^([\d.,]+)\s*([$€£¥₽])$/;

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
  // Determine whether comma is a decimal separator or thousands separator.
  // If the string contains both '.' and ',', the last one is the decimal sep.
  const lastComma = raw.lastIndexOf(',');
  const lastDot = raw.lastIndexOf('.');

  /** @type {string} */
  let cleaned;

  if (lastComma > lastDot) {
    // Comma is the decimal separator (e.g. "1.234,56")
    cleaned = raw.replace(/\./g, '').replace(',', '.');
  } else {
    // Dot is the decimal separator or there is no decimal (e.g. "1,234.56")
    cleaned = raw.replace(/,/g, '');
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
    return { value: num / 100, type: 'percentage', format: '0.00%' };
  }

  // Currency with prefix  e.g. "$1,234.56"
  const curPrefixMatch = text.match(RE_CURRENCY_PREFIX);
  if (curPrefixMatch) {
    const symbol = curPrefixMatch[1];
    const num = parseNumeric(curPrefixMatch[2]);
    return { value: num, type: 'currency', format: symbol };
  }

  // Currency with suffix  e.g. "1.234,56 €"
  const curSuffixMatch = text.match(RE_CURRENCY_SUFFIX);
  if (curSuffixMatch) {
    const symbol = curSuffixMatch[2];
    const num = parseNumeric(curSuffixMatch[1]);
    return { value: num, type: 'currency', format: symbol };
  }

  // Date  e.g. "12/31/2024"
  if (RE_DATE.test(text)) {
    return { value: text, type: 'date' };
  }

  // Plain number  e.g. "-1,234.56"
  if (RE_NUMBER.test(text)) {
    const num = parseNumeric(text);
    return { value: num, type: 'number' };
  }

  return { value: text, type: 'string' };
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
  /** @type {typeof import('pdfjs-dist')} */
  const pdfjs = await import('pdfjs-dist');
  return pdfjs;
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
  } = options;

  /* ---- 1. Load PDF via PDF.js ----------------------------------- */
  const pdfjs = await loadPdfjs();
  const loadingTask = pdfjs.getDocument({ data: pdfBytes });
  const pdfDoc = await loadingTask.promise;
  const totalPages = pdfDoc.numPages;

  const builder = new XlsxBuilder();

  let sheetCount = 0;
  let tableCount = 0;

  /* ---- 2. Iterate pages ----------------------------------------- */
  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);

    /** @type {any} */
    let tables;

    if (mode === 'manual' && selectedArea) {
      tables = await extractTables(/** @type {any} */ (page), /** @type {any} */ ({ area: selectedArea }));
    } else {
      tables = await extractAllTables(/** @type {any} */ (page));
    }

    if (!tables || tables.length === 0) {
      // Skip pages without detected tables
      // (but continue to next page)
      page.cleanup();
      // Yield every 5 pages to keep UI responsive
      if (pageNum % 5 === 0) {
        await yieldToUI();
      }
      continue;
    }

    tableCount += tables.length;

    if (sheetsPerPage) {
      /* -- One sheet per page: merge all tables on this page ------- */
      const sheetName = sanitizeSheetName(`Page ${pageNum}`);
      /** @type {any[]} */
      const sheetRows = [];
      for (const table of tables) {
        for (const row of /** @type {any} */ (table)) {
          /** @type {TypedCell[]} */
          const typedRow = row.map((/** @type {any} */ cell) => typeCell(cell, numberDetection));
          sheetRows.push(typedRow);
        }
        // Blank separator row between tables on the same sheet
        sheetRows.push([]);
      }
      builder.addSheet(sheetName, sheetRows);
      sheetCount++;
    } else {
      /* -- One sheet per table ------------------------------------ */
      for (let t = 0; t < tables.length; t++) {
        const table = tables[t];
        const sheetName = sanitizeSheetName(
          `Page ${pageNum} - Table ${t + 1}`,
        );
        /** @type {any[]} */
        const sheetRows = [];
        for (const row of /** @type {any} */ (table)) {
          /** @type {TypedCell[]} */
          const typedRow = row.map((/** @type {any} */ cell) => typeCell(cell, numberDetection));
          sheetRows.push(typedRow);
        }
        builder.addSheet(sheetName, sheetRows);
        sheetCount++;
      }
    }

    page.cleanup();

    // Yield to UI every 5 pages so the browser stays responsive
    if (pageNum % 5 === 0) {
      await yieldToUI();
    }
  }

  /* ---- 3. Handle edge-case: no tables found at all -------------- */
  if (sheetCount === 0) {
    const emptyName = sanitizeSheetName('Sheet1');
    builder.addSheet(emptyName, []);
    sheetCount = 1;
  }

  /* ---- 4. Build XLSX -------------------------------------------- */
  /** @type {Uint8Array} */
  const xlsxBytes = await builder.build();

  const blob = new Blob([/** @type {any} */ (xlsxBytes)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  return { blob, sheetCount, tableCount };
}
