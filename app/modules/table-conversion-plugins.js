// @ts-check
// ─── Table Conversion Plugins ────────────────────────────────────────────────
// Plugin system for converting complex table templates detected in PDF pages
// into structured table blocks for DOCX export.
//
// Built-in plugins handle invoices, financial statements, scientific tables,
// and timetables.  A registry auto-detects the best plugin for a given table
// and falls back to generic conversion when no plugin matches.
//
// Integration:
//   import { tablePluginRegistry, convertTable } from './table-conversion-plugins.js';
//   const result = tablePluginRegistry.convertTable(blocks, pageContext);

// Lazily resolved — docx is in a separate chunk, loaded on first use
let _AlignmentType = { LEFT: 'left', CENTER: 'center', RIGHT: 'right', JUSTIFIED: 'justified' };
import('docx').then(m => { _AlignmentType = m.AlignmentType || _AlignmentType; }).catch(() => { /* fallback to defaults */ });

// ---------------------------------------------------------------------------
// Base class — TableConversionPlugin
// ---------------------------------------------------------------------------

/**
 * Base interface for table conversion plugins.
 * Subclasses must implement `detect`, `convert`, and `getName`.
 */
export class TableConversionPlugin {
  /**
   * Determine whether this plugin can handle the given blocks.
   * @param {Array<Object>} blocks  – table row blocks (cells, text, etc.)
   * @param {Object} pageContext    – { pageNumber, pageWidth, pageHeight, lang }
   * @returns {boolean}
   */
  detect(blocks, pageContext) {       // eslint-disable-line no-unused-vars
    return false;
  }

  /**
   * Convert blocks into a structured table object suitable for DOCX export.
   * @param {Array<Object>} blocks
   * @param {Object} pageContext
   * @returns {Object} – { type:'table', rows, maxCols, meta }
   */
  convert(blocks, pageContext) {      // eslint-disable-line no-unused-vars
    return null;
  }

  /**
   * Human-readable plugin name.
   * @returns {string}
   */
  getName() {
    return 'BasePlugin';
  }
}

// ---------------------------------------------------------------------------
// Helpers shared across plugins
// ---------------------------------------------------------------------------

const CURRENCY_RE = /[$€£¥₽₴₹¢₿]\s*[\d,.]+|[\d,.]+\s*[$€£¥₽₴₹¢₿]|[\d,.]+\s*(руб|USD|EUR|GBP|RUB|UAH|JPY)/i;
const NUMBER_RE   = /^[\s]*[-+]?[\d\s,.]+%?[\s]*$/;
const TOTAL_RE    = /^(total|итого|всего|сумма|subtotal|промежуточный\s*итог|grand\s*total|net|gross|balance|итог|sum|amount\s*due)/i;
const QTY_HEADER_RE = /^(qty|quantity|кол[-.]?во|количество|count|шт|pcs|units|ед)/i;
const PRICE_HEADER_RE = /^(price|цена|стоимость|cost|rate|unit\s*price|сумма|amount|sum)/i;

/**
 * Check if a string looks like a currency value.
 */
function isCurrencyValue(text) {
  return CURRENCY_RE.test((text || '').trim());
}

/**
 * Check if a string is numeric (possibly with thousands separators).
 */
function isNumericValue(text) {
  return NUMBER_RE.test((text || '').trim()) && (text || '').trim().length > 0;
}

/**
 * Check if a string matches a "total" keyword.
 */
function isTotalLabel(text) {
  return TOTAL_RE.test((text || '').trim());
}

/**
 * Normalise cell text: trim whitespace and collapse inner spaces.
 */
function normCell(cell) {
  return (cell?.text || (typeof cell === 'string' ? cell : '')).trim().replace(/\s+/g, ' ');
}

/**
 * Extract rows from a table block — accepts both { rows } and flat arrays.
 */
function extractRows(blocks) {
  // If blocks is already a table block object with rows
  if (blocks && blocks.rows) return blocks.rows;
  // If blocks is an array of row objects
  if (Array.isArray(blocks) && blocks.length && blocks[0]?.cells) return blocks;
  // If blocks is an array of arrays (raw text)
  if (Array.isArray(blocks) && blocks.length && Array.isArray(blocks[0])) {
    return blocks.map(row => ({
      cells: row.map(text => ({ text: String(text), runs: [] })),
    }));
  }
  return [];
}

/**
 * Build a standardised table result object.
 */
function buildTableResult(rows, meta = {}) {
  const maxCols = rows.reduce((m, r) => Math.max(m, (r.cells || []).length), 0);
  // Pad rows so every row has maxCols cells
  const padded = rows.map(r => {
    const cells = r.cells || [];
    while (cells.length < maxCols) cells.push({ text: '', runs: [] });
    return { ...r, cells };
  });
  return { type: 'table', rows: padded, maxCols, meta };
}

// ---------------------------------------------------------------------------
// InvoiceTablePlugin
// ---------------------------------------------------------------------------

export class InvoiceTablePlugin extends TableConversionPlugin {
  getName() { return 'InvoiceTable'; }

  detect(blocks, _pageContext) {
    const rows = extractRows(blocks);
    if (rows.length < 2) return false;

    // Heuristic: header row with qty/price-like columns and at least one
    // currency value in the data rows, or a total row at the bottom.
    const headerCells = (rows[0].cells || []).map(c => normCell(c));
    const hasQtyHeader   = headerCells.some(h => QTY_HEADER_RE.test(h));
    const hasPriceHeader = headerCells.some(h => PRICE_HEADER_RE.test(h));

    const dataRows = rows.slice(1);
    const hasCurrency = dataRows.some(r =>
      (r.cells || []).some(c => isCurrencyValue(normCell(c))),
    );
    const hasTotal = dataRows.some(r =>
      (r.cells || []).some(c => isTotalLabel(normCell(c))),
    );

    // Need header hints AND (currency values OR a total row)
    return (hasQtyHeader || hasPriceHeader) && (hasCurrency || hasTotal);
  }

  convert(blocks, _pageContext) {
    const rows = extractRows(blocks);
    if (!rows.length) return null;

    const headerCells = (rows[0].cells || []).map(c => normCell(c));

    // Tag columns by role
    const colRoles = headerCells.map(h => {
      if (QTY_HEADER_RE.test(h))   return 'qty';
      if (PRICE_HEADER_RE.test(h)) return 'price';
      if (/^(#|№|no|item|наименование|описание|description|product|товар|name)/i.test(h)) return 'item';
      return 'other';
    });

    // Format data rows: right-align numeric/currency columns
    const converted = rows.map((row, ri) => {
      const cells = (row.cells || []).map((cell, ci) => {
        const txt = normCell(cell);
        const role = colRoles[ci] || 'other';
        const alignment = (role === 'qty' || role === 'price' || isNumericValue(txt))
          ? _AlignmentType.RIGHT
          : _AlignmentType.LEFT;

        // Currency formatting: normalise thousands separators
        let formattedText = txt;
        if (ri > 0 && isCurrencyValue(txt)) {
          formattedText = txt.replace(/(\d)\s+(\d)/g, '$1\u00A0$2'); // thin non-breaking space
        }

        return {
          text: formattedText,
          runs: cell.runs || [{ text: formattedText, bold: ri === 0 || isTotalLabel(txt), italic: false, fontFamily: 'Arial', fontSize: 10 }],
          alignment,
          bold: ri === 0 || isTotalLabel(txt),
        };
      });

      // Detect total row
      const isTotal = cells.some(c => isTotalLabel(c.text));

      return { cells, isHeader: ri === 0, isTotal };
    });

    return buildTableResult(converted, { plugin: 'InvoiceTable', colRoles });
  }
}

// ---------------------------------------------------------------------------
// FinancialTablePlugin
// ---------------------------------------------------------------------------

const FINANCIAL_HEADER_RE = /^(assets|liabilities|equity|revenue|expenses?|income|loss|profit|net\s*income|operating|ebitda|активы|пассивы|капитал|доход|расход|прибыль|убыток|баланс|выручка|себестоимость)/i;
const SUBTOTAL_RE = /^(subtotal|total|итого|всего|net|gross|промежуточный|balance)/i;
const INDENT_RE = /^(\s{2,}|\t+)/;

export class FinancialTablePlugin extends TableConversionPlugin {
  getName() { return 'FinancialTable'; }

  detect(blocks, _pageContext) {
    const rows = extractRows(blocks);
    if (rows.length < 3) return false;

    // Look for financial header keywords and predominantly numeric data
    let financialHeaderCount = 0;
    let numericCellCount = 0;
    let totalCells = 0;

    for (const row of rows) {
      for (const cell of (row.cells || [])) {
        const txt = normCell(cell);
        totalCells++;
        if (FINANCIAL_HEADER_RE.test(txt)) financialHeaderCount++;
        if (isNumericValue(txt) || isCurrencyValue(txt)) numericCellCount++;
      }
    }

    const numericRatio = totalCells > 0 ? numericCellCount / totalCells : 0;
    // Financial tables: category labels + lots of numbers, with at least one financial keyword
    return financialHeaderCount >= 1 && numericRatio >= 0.3;
  }

  convert(blocks, _pageContext) {
    const rows = extractRows(blocks);
    if (!rows.length) return null;

    const converted = rows.map((row, ri) => {
      const cells = (row.cells || []).map((cell, _ci) => {
        const txt = normCell(cell);
        const isNumber = isNumericValue(txt) || isCurrencyValue(txt);
        const isSubtotal = SUBTOTAL_RE.test(txt);
        const isCategory = FINANCIAL_HEADER_RE.test(txt);
        const isIndented = INDENT_RE.test(cell?.text || '');

        // Detect nesting level from leading whitespace
        const leadingSpaces = (cell?.text || '').match(/^(\s*)/)?.[1]?.length || 0;
        const nestLevel = Math.floor(leadingSpaces / 2);

        const alignment = isNumber ? _AlignmentType.RIGHT : _AlignmentType.LEFT;
        const bold = ri === 0 || isSubtotal || isCategory;

        // Format negative numbers: (123) or -123
        let formattedText = txt;
        if (isNumber) {
          formattedText = txt.replace(/(\d)\s+(\d)/g, '$1\u00A0$2');
        }

        return {
          text: formattedText,
          runs: cell.runs || [{ text: formattedText, bold, italic: false, fontFamily: 'Arial', fontSize: 10 }],
          alignment,
          bold,
          indent: isIndented ? nestLevel : 0,
        };
      });

      const isSubtotalRow = cells.some(c => SUBTOTAL_RE.test(c.text));
      return { cells, isHeader: ri === 0, isSubtotal: isSubtotalRow };
    });

    return buildTableResult(converted, { plugin: 'FinancialTable' });
  }
}

// ---------------------------------------------------------------------------
// ScientificTablePlugin
// ---------------------------------------------------------------------------

const UNIT_RE = /^\s*[\[(]?\s*(mm|cm|m|kg|g|mg|ml|l|s|ms|µs|ns|Hz|kHz|MHz|GHz|Pa|kPa|MPa|°C|°F|K|V|mV|A|mA|Ω|mol|%|ppm|ppb|мм|см|м|кг|г|мг|мл|л|с|мс|Гц|кГц|МГц|Па|кПа|МПа)\s*[\])]?\s*$/i;
const FOOTNOTE_REF_RE = /[*†‡§¶#]\s*$|\[\d+\]\s*$/;
const MERGED_HEADER_RE = /\n|<br\s*\/?>/i;

export class ScientificTablePlugin extends TableConversionPlugin {
  getName() { return 'ScientificTable'; }

  detect(blocks, _pageContext) {
    const rows = extractRows(blocks);
    if (rows.length < 3) return false;

    let unitRowCount = 0;
    let footnoteRefCount = 0;
    let multiLineHeaderCount = 0;
    let mergedCellHint = 0;

    // Check first two rows for unit rows / multi-line headers
    const headerRows = rows.slice(0, Math.min(3, rows.length));
    for (const row of headerRows) {
      const cells = (row.cells || []);
      let unitCells = 0;
      for (const cell of cells) {
        const txt = normCell(cell);
        if (UNIT_RE.test(txt)) unitCells++;
        if (MERGED_HEADER_RE.test(cell?.text || '')) multiLineHeaderCount++;
        if (!txt && cells.length > 1) mergedCellHint++; // empty cells may indicate merges
      }
      if (unitCells >= Math.ceil(cells.length * 0.4)) unitRowCount++;
    }

    // Check data rows for footnote references
    for (const row of rows.slice(1)) {
      for (const cell of (row.cells || [])) {
        if (FOOTNOTE_REF_RE.test(normCell(cell))) footnoteRefCount++;
      }
    }

    // Scientific if: unit row present, or multi-line headers + footnote refs, or many merged hints
    return unitRowCount >= 1 ||
           (multiLineHeaderCount >= 1 && footnoteRefCount >= 1) ||
           (mergedCellHint >= 3 && rows.length >= 4);
  }

  convert(blocks, _pageContext) {
    const rows = extractRows(blocks);
    if (!rows.length) return null;

    // Detect unit row (second row that is all units)
    let unitRowIdx = -1;
    for (let ri = 1; ri < Math.min(3, rows.length); ri++) {
      const cells = (rows[ri].cells || []);
      const unitCount = cells.filter(c => UNIT_RE.test(normCell(c))).length;
      if (unitCount >= Math.ceil(cells.length * 0.4)) {
        unitRowIdx = ri;
        break;
      }
    }

    const converted = rows.map((row, ri) => {
      const isHeader = ri === 0;
      const isUnitRow = ri === unitRowIdx;

      const cells = (row.cells || []).map(cell => {
        let txt = normCell(cell);
        const isNumber = isNumericValue(txt);

        // Strip footnote markers from data for clean export; keep in meta
        let footnote = null;
        const fnMatch = txt.match(/([*†‡§¶#])\s*$|\[(\d+)\]\s*$/);
        if (fnMatch) {
          footnote = fnMatch[1] || fnMatch[2];
          txt = txt.replace(/[*†‡§¶#]\s*$|\[\d+\]\s*$/, '').trim();
        }

        // Multi-line header: join with space
        if (isHeader) {
          txt = txt.replace(/\n|<br\s*\/?>/gi, ' ').trim();
        }

        const alignment = isNumber ? _AlignmentType.RIGHT : _AlignmentType.CENTER;

        return {
          text: txt,
          runs: cell.runs || [{ text: txt, bold: isHeader, italic: isUnitRow, fontFamily: 'Arial', fontSize: isUnitRow ? 9 : 10 }],
          alignment,
          bold: isHeader,
          italic: isUnitRow,
          footnote,
        };
      });

      return { cells, isHeader, isUnitRow };
    });

    return buildTableResult(converted, { plugin: 'ScientificTable', unitRowIdx });
  }
}

// ---------------------------------------------------------------------------
// TimetablePlugin
// ---------------------------------------------------------------------------

const TIME_RE = /^\d{1,2}[:.]\d{2}(\s*[-–—]\s*\d{1,2}[:.]\d{2})?$/;
const DAY_RE = /^(mon|tue|wed|thu|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday|пн|вт|ср|чт|пт|сб|вс|понедельник|вторник|среда|четверг|пятница|суббота|воскресенье|lun|mar|mer|jeu|ven|sam|dim|mo|di|mi|do|fr|sa|so)/i;
const PERIOD_RE = /^(period|урок|пара|час|hour|slot|block|lesson)\s*\d*/i;

export class TimetablePlugin extends TableConversionPlugin {
  getName() { return 'Timetable'; }

  detect(blocks, _pageContext) {
    const rows = extractRows(blocks);
    if (rows.length < 3) return false;

    const headerCells = (rows[0].cells || []).map(c => normCell(c));

    // Check if header row has day names or time slots
    let dayCount = 0;
    let timeCount = 0;

    for (const h of headerCells) {
      if (DAY_RE.test(h)) dayCount++;
      if (TIME_RE.test(h)) timeCount++;
      if (PERIOD_RE.test(h)) timeCount++; // period patterns count toward time
    }

    // Also check first column for time slots
    let firstColTimeCount = 0;
    for (const row of rows.slice(1)) {
      const firstCell = normCell((row.cells || [])[0]);
      if (TIME_RE.test(firstCell) || PERIOD_RE.test(firstCell)) firstColTimeCount++;
    }

    // Timetable: header has >=3 day names, or first column has time slots with day headers
    return (dayCount >= 3) ||
           (dayCount >= 2 && firstColTimeCount >= 2) ||
           (firstColTimeCount >= 3 && headerCells.length >= 3) ||
           (timeCount >= 2 && dayCount >= 1);
  }

  convert(blocks, _pageContext) {
    const rows = extractRows(blocks);
    if (!rows.length) return null;

    const converted = rows.map((row, ri) => {
      const cells = (row.cells || []).map((cell, ci) => {
        const txt = normCell(cell);
        const isTime = TIME_RE.test(txt) || PERIOD_RE.test(txt);
        const isDay = DAY_RE.test(txt);
        const isHeader = ri === 0 || (ci === 0 && isTime);

        const alignment = isTime ? _AlignmentType.CENTER : _AlignmentType.LEFT;

        return {
          text: txt,
          runs: cell.runs || [{ text: txt, bold: isHeader || isDay, italic: false, fontFamily: 'Arial', fontSize: 10 }],
          alignment,
          bold: isHeader || isDay,
        };
      });

      return { cells, isHeader: ri === 0 };
    });

    return buildTableResult(converted, { plugin: 'Timetable' });
  }
}

// ---------------------------------------------------------------------------
// Generic fallback conversion
// ---------------------------------------------------------------------------

function genericConvert(blocks, _pageContext) {
  const rows = extractRows(blocks);
  if (!rows.length) return null;

  const converted = rows.map((row, ri) => {
    const cells = (row.cells || []).map(cell => {
      const txt = normCell(cell);
      const isNumber = isNumericValue(txt);
      return {
        text: txt,
        runs: cell.runs || [{ text: txt, bold: ri === 0, italic: false, fontFamily: 'Arial', fontSize: 10 }],
        alignment: isNumber ? _AlignmentType.RIGHT : _AlignmentType.LEFT,
        bold: ri === 0,
      };
    });
    return { cells, isHeader: ri === 0 };
  });

  return buildTableResult(converted, { plugin: 'generic' });
}

// ---------------------------------------------------------------------------
// TablePluginRegistry
// ---------------------------------------------------------------------------

export class TablePluginRegistry {
  constructor() {
    /** @type {TableConversionPlugin[]} */
    this._plugins = [];
  }

  /**
   * Register a plugin instance.
   * @param {TableConversionPlugin} plugin
   */
  register(plugin) {
    if (!(plugin instanceof TableConversionPlugin)) {
      throw new TypeError('Plugin must extend TableConversionPlugin');
    }
    this._plugins.push(plugin);
  }

  /**
   * Unregister a plugin by name.
   * @param {string} name
   */
  unregister(name) {
    this._plugins = this._plugins.filter(p => p.getName() !== name);
  }

  /**
   * Return the list of registered plugin names.
   * @returns {string[]}
   */
  getPluginNames() {
    return this._plugins.map(p => p.getName());
  }

  /**
   * Auto-detect which plugin fits best for the given blocks.
   * Returns the first matching plugin, or null if none matches.
   * @param {Array<Object>} blocks
   * @param {Object} pageContext
   * @returns {TableConversionPlugin|null}
   */
  detectPlugin(blocks, pageContext) {
    for (const plugin of this._plugins) {
      try {
        if (plugin.detect(blocks, pageContext)) return plugin;
      } catch (err) {
        console.warn(`[table-plugins] ${plugin.getName()} detect error:`, err);
      }
    }
    return null;
  }

  /**
   * Convert a table using the best matching plugin, or fall back to generic
   * conversion if no plugin claims the table.
   * @param {Array<Object>|Object} blocks – table block or row array
   * @param {Object} [pageContext={}]
   * @returns {Object} – { type:'table', rows, maxCols, meta }
   */
  convertTable(blocks, pageContext = {}) {
    const plugin = this.detectPlugin(blocks, pageContext);
    if (plugin) {
      try {
        const result = plugin.convert(blocks, pageContext);
        if (result) return result;
      } catch (err) {
        console.warn(`[table-plugins] ${plugin.getName()} convert error:`, err);
      }
    }
    // Fallback to generic conversion
    return genericConvert(blocks, pageContext);
  }
}

// ---------------------------------------------------------------------------
// Default registry with built-in plugins
// ---------------------------------------------------------------------------

export const tablePluginRegistry = new TablePluginRegistry();
tablePluginRegistry.register(new InvoiceTablePlugin());
tablePluginRegistry.register(new FinancialTablePlugin());
tablePluginRegistry.register(new ScientificTablePlugin());
tablePluginRegistry.register(new TimetablePlugin());

// ---------------------------------------------------------------------------
// Convenience export for integration with docx-converter
// ---------------------------------------------------------------------------

/**
 * Convert a table block using the plugin registry.
 * Drop-in replacement for simple table conversion in docx-converter.
 * @param {Object|Array} blocks – table block ({ rows, maxCols }) or row array
 * @param {Object} [pageContext={}]
 * @returns {Object}
 */
export function convertTable(blocks, pageContext = {}) {
  return tablePluginRegistry.convertTable(blocks, pageContext);
}
