// @ts-check
/**
 * XLSX Builder
 *
 * Generates XLSX files (Office Open XML SpreadsheetML) without external
 * dependencies beyond `fflate` for ZIP compression. An XLSX file is a ZIP
 * archive containing well-formed XML parts.
 *
 * Public API:
 *   - XlsxBuilder.addSheet(name, rows)
 *   - XlsxBuilder.setCellStyle(sheet, row, col, style)
 *   - XlsxBuilder.setColumnWidth(sheet, col, width)
 *   - XlsxBuilder.mergeCells(sheet, startRow, startCol, endRow, endCol)
 *   - XlsxBuilder.build() → Promise<Uint8Array>
 */

import { zipSync } from 'fflate';

// ---------------------------------------------------------------------------
// Types (JSDoc only)
// ---------------------------------------------------------------------------

/**
 * @typedef {'string'|'number'|'date'|'formula'} CellType
 */

/**
 * @typedef {Object} CellStyle
 * @property {boolean}  [bold]
 * @property {boolean}  [italic]
 * @property {string}   [alignment]    - 'left'|'center'|'right'
 * @property {string}   [numberFormat] - e.g. '#,##0.00', '0%', 'dd.mm.yyyy'
 * @property {boolean}  [borders]      - thin borders on all four sides
 */

/**
 * @typedef {Object} CellObject
 * @property {string|number|boolean|Date} value
 * @property {CellType}  [type]
 * @property {CellStyle} [style]
 */

/**
 * @typedef {string|number|boolean|Date|null|undefined|CellObject} CellValue
 */

/**
 * @typedef {Object} SheetData
 * @property {string}       name
 * @property {CellValue[][]} rows
 * @property {Map<string, CellStyle>} cellStyles  - key = "row,col"
 * @property {Map<number, number>}    colWidths   - col index → width
 * @property {Array<{sr: number, sc: number, er: number, ec: number}>} merges
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Epoch for Excel serial dates: 1900-01-00 (Jan 0 = Dec 31, 1899). */
const EXCEL_EPOCH = new Date(Date.UTC(1899, 11, 30));

/** Regex to detect ISO-like date strings: YYYY-MM-DD or YYYY/MM/DD with optional time. */
const DATE_PATTERN = /^\d{4}[-/]\d{2}[-/]\d{2}([T ]\d{2}:\d{2}(:\d{2})?)?$/;

/** Built-in number format IDs used by Excel. */
const NUM_FMT = {
  GENERAL: 0,
  DATE_DDMMYYYY: 164,
  CURRENCY: 165,
  PERCENTAGE: 166,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Escape XML special characters.
 * @param {string} s
 * @returns {string}
 */
function escapeXml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Convert a 0-based column index to an Excel column letter (A, B, ..., Z, AA, AB, ...).
 * @param {number} col - 0-based column index
 * @returns {string}
 */
function colToLetter(col) {
  let result = '';
  let c = col;
  while (c >= 0) {
    result = String.fromCharCode((c % 26) + 65) + result;
    c = Math.floor(c / 26) - 1;
  }
  return result;
}

/**
 * Build an Excel cell reference like "A1", "BC42".
 * @param {number} row - 0-based row index
 * @param {number} col - 0-based column index
 * @returns {string}
 */
function cellRef(row, col) {
  return colToLetter(col) + (row + 1);
}

/**
 * Convert a JS Date to an Excel serial date number.
 * Includes the Lotus 1-2-3 bug: Excel incorrectly treats 1900 as a leap year,
 * so dates on or after 1900-03-01 are off by +1.
 * @param {Date} date
 * @returns {number}
 */
function dateToSerial(date) {
  const ms = date.getTime() - EXCEL_EPOCH.getTime();
  let serial = ms / (24 * 60 * 60 * 1000);
  // Lotus 1-2-3 bug: add 1 for dates after Feb 28, 1900
  if (serial >= 60) {
    serial += 1;
  }
  return serial;
}

/**
 * Encode a string to UTF-8 bytes.
 * @param {string} str
 * @returns {Uint8Array}
 */
function toUtf8(str) {
  return new TextEncoder().encode(str);
}

/**
 * Normalise a raw cell value into a typed representation.
 * @param {CellValue} cell
 * @returns {{ value: string|number|boolean|Date, type: CellType, style?: CellStyle }}
 */
function normalizeCell(cell) {
  if (cell === null || cell === undefined) {
    return { value: '', type: 'string' };
  }

  // Already a cell object
  if (typeof cell === 'object' && !(cell instanceof Date) && 'value' in cell) {
    const obj = /** @type {CellObject} */ (cell);
    const type = obj.type || detectType(obj.value);
    return { value: obj.value, type, style: obj.style };
  }

  // Date instance
  if (cell instanceof Date) {
    return { value: cell, type: 'date' };
  }

  // Primitives
  if (typeof cell === 'boolean') {
    return { value: cell, type: 'string' };
  }
  if (typeof cell === 'number') {
    return { value: cell, type: 'number' };
  }

  // String — try auto-detect
  const s = String(cell);
  return { value: s, type: detectType(s) };
}

/**
 * Auto-detect the type of a value.
 * @param {*} val
 * @returns {CellType}
 */
function detectType(val) {
  if (val instanceof Date) return 'date';
  if (typeof val === 'number') return 'number';
  if (typeof val === 'string') {
    // Check if it looks like a formula
    if (val.startsWith('=')) return 'formula';
    // Check if it's a date string
    if (DATE_PATTERN.test(val.trim())) {
      const d = new Date(val.trim());
      if (!isNaN(d.getTime())) return 'date';
    }
    // Check if it parses as a finite number (and is not empty / whitespace)
    const trimmed = val.trim();
    if (trimmed !== '' && isFinite(Number(trimmed))) return 'number';
  }
  return 'string';
}

// ---------------------------------------------------------------------------
// Style registry — collects unique styles and number formats
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} ResolvedStyle
 * @property {boolean} bold
 * @property {boolean} italic
 * @property {string}  alignment
 * @property {string}  numberFormat
 * @property {boolean} borders
 */

class StyleRegistry {
  constructor() {
    /** @type {Map<string, number>} style key → xf index */
    this._xfMap = new Map();
    /** @type {ResolvedStyle[]} ordered list of xf entries (index 0 = default) */
    this._xfs = [];
    /** @type {Map<string, number>} format string → numFmtId */
    this._numFmtMap = new Map();
    /** @type {number} next custom numFmtId (starts at 164) */
    this._nextNumFmtId = NUM_FMT.DATE_DDMMYYYY; // 164

    // Register built-in custom formats
    this._numFmtMap.set('dd.mm.yyyy', NUM_FMT.DATE_DDMMYYYY);
    this._numFmtMap.set('#,##0.00\\ "$"', NUM_FMT.CURRENCY);
    this._numFmtMap.set('0%', NUM_FMT.PERCENTAGE);
    this._nextNumFmtId = 167; // next available after our 3 custom ones

    // Default xf at index 0 (no special formatting)
    this._register({ bold: false, italic: false, alignment: '', numberFormat: '', borders: false });
  }

  /**
   * Get or create an xf index for the given style.
   * @param {CellStyle|undefined} style
   * @param {CellType} cellType - used to apply default date format
   * @returns {number} xf index
   */
  resolve(style, cellType) {
    /** @type {ResolvedStyle} */
    const resolved = {
      bold: !!(style && style.bold),
      italic: !!(style && style.italic),
      alignment: (style && style.alignment) || '',
      numberFormat: (style && style.numberFormat) || '',
      borders: !!(style && style.borders),
    };
    // Apply default date format when no explicit format given
    if (cellType === 'date' && !resolved.numberFormat) {
      resolved.numberFormat = 'dd.mm.yyyy';
    }
    return this._register(resolved);
  }

  /**
   * @param {ResolvedStyle} rs
   * @returns {number}
   */
  _register(rs) {
    const key = `${rs.bold}|${rs.italic}|${rs.alignment}|${rs.numberFormat}|${rs.borders}`;
    const existing = this._xfMap.get(key);
    if (existing !== undefined) return existing;

    // Register number format if needed
    if (rs.numberFormat && !this._numFmtMap.has(rs.numberFormat)) {
      this._numFmtMap.set(rs.numberFormat, this._nextNumFmtId++);
    }

    const idx = this._xfs.length;
    this._xfs.push(rs);
    this._xfMap.set(key, idx);
    return idx;
  }

  /**
   * Build the styles.xml content.
   * @returns {string}
   */
  toXml() {
    const numFmts = [...this._numFmtMap.entries()];
    const hasCustomFmts = numFmts.length > 0;

    // Fonts: 0 = default, 1 = bold, 2 = italic, 3 = bold+italic
    const fonts = [
      '<font><sz val="11"/><name val="Calibri"/><family val="2"/></font>',
      '<font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font>',
      '<font><i/><sz val="11"/><name val="Calibri"/><family val="2"/></font>',
      '<font><b/><i/><sz val="11"/><name val="Calibri"/><family val="2"/></font>',
    ];

    // Fills (minimum 2 required by Excel)
    const fills = [
      '<fill><patternFill patternType="none"/></fill>',
      '<fill><patternFill patternType="gray125"/></fill>',
    ];

    // Borders: 0 = none, 1 = thin all sides
    const borders = [
      '<border><left/><right/><top/><bottom/><diagonal/></border>',
      '<border>' +
        '<left style="thin"><color auto="1"/></left>' +
        '<right style="thin"><color auto="1"/></right>' +
        '<top style="thin"><color auto="1"/></top>' +
        '<bottom style="thin"><color auto="1"/></bottom>' +
        '<diagonal/>' +
      '</border>',
    ];

    // cellXfs
    const xfEntries = this._xfs.map((rs) => {
      const fontId = (rs.bold && rs.italic) ? 3 : rs.bold ? 1 : rs.italic ? 2 : 0;
      const borderId = rs.borders ? 1 : 0;
      const numFmtId = rs.numberFormat ? (this._numFmtMap.get(rs.numberFormat) || 0) : 0;
      const applyFont = fontId > 0 ? ' applyFont="1"' : '';
      const applyBorder = borderId > 0 ? ' applyBorder="1"' : '';
      const applyNumFmt = numFmtId > 0 ? ' applyNumberFormat="1"' : '';
      const applyAlignment = rs.alignment ? ' applyAlignment="1"' : '';

      let xf = `<xf numFmtId="${numFmtId}" fontId="${fontId}" fillId="0" borderId="${borderId}"${applyFont}${applyBorder}${applyNumFmt}${applyAlignment}`;
      if (rs.alignment) {
        xf += `><alignment horizontal="${escapeXml(rs.alignment)}"/></xf>`;
      } else {
        xf += '/>';
      }
      return xf;
    });

    let xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
    xml += '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">';

    if (hasCustomFmts) {
      xml += `<numFmts count="${numFmts.length}">`;
      for (const [code, id] of numFmts) {
        xml += `<numFmt numFmtId="${id}" formatCode="${escapeXml(code)}"/>`;
      }
      xml += '</numFmts>';
    }

    xml += `<fonts count="${fonts.length}">${fonts.join('')}</fonts>`;
    xml += `<fills count="${fills.length}">${fills.join('')}</fills>`;
    xml += `<borders count="${borders.length}">${borders.join('')}</borders>`;
    xml += '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>';
    xml += `<cellXfs count="${xfEntries.length}">${xfEntries.join('')}</cellXfs>`;
    xml += '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>';
    xml += '</styleSheet>';

    return xml;
  }
}

// ---------------------------------------------------------------------------
// Shared strings table
// ---------------------------------------------------------------------------

class SharedStrings {
  constructor() {
    /** @type {Map<string, number>} string → index */
    this._map = new Map();
    /** @type {string[]} ordered list */
    this._list = [];
  }

  /**
   * Get or add a shared string, returning its index.
   * @param {string} s
   * @returns {number}
   */
  add(s) {
    const existing = this._map.get(s);
    if (existing !== undefined) return existing;
    const idx = this._list.length;
    this._list.push(s);
    this._map.set(s, idx);
    return idx;
  }

  /** @returns {number} */
  get count() {
    return this._list.length;
  }

  /**
   * Build sharedStrings.xml content.
   * @returns {string}
   */
  toXml() {
    let xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
    xml += `<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${this._list.length}" uniqueCount="${this._list.length}">`;
    for (const s of this._list) {
      xml += `<si><t>${escapeXml(s)}</t></si>`;
    }
    xml += '</sst>';
    return xml;
  }
}

// ---------------------------------------------------------------------------
// XlsxBuilder
// ---------------------------------------------------------------------------

export class XlsxBuilder {
  constructor() {
    /** @type {SheetData[]} */
    this._sheets = [];
  }

  /**
   * Add a worksheet with the given name and row data.
   * @param {string} name - Sheet tab name (max 31 chars, no special chars).
   * @param {CellValue[][]} rows - Array of rows, each row is an array of cell values.
   */
  addSheet(name, rows) {
    // Sanitise sheet name: max 31 chars, strip characters not allowed in sheet names
    const safeName = name
      .replace(/[\\/*?:\[\]]/g, '_')
      .slice(0, 31) || 'Sheet';

    /** @type {SheetData} */
    const sheet = {
      name: safeName,
      rows: rows || [],
      cellStyles: new Map(),
      colWidths: new Map(),
      merges: [],
    };
    this._sheets.push(sheet);
  }

  /**
   * Set a cell style on an already-added sheet.
   * @param {number} sheetIndex - 0-based sheet index
   * @param {number} row        - 0-based row index
   * @param {number} col        - 0-based column index
   * @param {CellStyle} style
   */
  setCellStyle(sheetIndex, row, col, style) {
    const sheet = this._sheets[sheetIndex];
    if (!sheet) return;
    sheet.cellStyles.set(`${row},${col}`, style);
  }

  /**
   * Set the width of a column (in character units, same as Excel).
   * @param {number} sheetIndex - 0-based sheet index
   * @param {number} col        - 0-based column index
   * @param {number} width      - Column width in character units
   */
  setColumnWidth(sheetIndex, col, width) {
    const sheet = this._sheets[sheetIndex];
    if (!sheet) return;
    sheet.colWidths.set(col, width);
  }

  /**
   * Define a merge range on a sheet.
   * @param {number} sheetIndex - 0-based sheet index
   * @param {number} startRow   - 0-based start row
   * @param {number} startCol   - 0-based start column
   * @param {number} endRow     - 0-based end row
   * @param {number} endCol     - 0-based end column
   */
  mergeCells(sheetIndex, startRow, startCol, endRow, endCol) {
    const sheet = this._sheets[sheetIndex];
    if (!sheet) return;
    sheet.merges.push({ sr: startRow, sc: startCol, er: endRow, ec: endCol });
  }

  /**
   * Build the XLSX file and return it as a Uint8Array.
   * @returns {Promise<Uint8Array>}
   */
  async build() {
    // Ensure at least one sheet exists
    if (this._sheets.length === 0) {
      this.addSheet('Sheet1', []);
    }

    const styles = new StyleRegistry();
    const strings = new SharedStrings();

    // Build sheet XML for each sheet
    /** @type {string[]} */
    const sheetXmls = [];
    for (const sheet of this._sheets) {
      sheetXmls.push(this._buildSheetXml(sheet, styles, strings));
    }

    // Assemble ZIP entries
    /** @type {Record<string, Uint8Array>} */
    const files = {};

    files['[Content_Types].xml'] = toUtf8(this._contentTypesXml());
    files['_rels/.rels'] = toUtf8(this._relsXml());
    files['xl/workbook.xml'] = toUtf8(this._workbookXml());
    files['xl/_rels/workbook.xml.rels'] = toUtf8(this._workbookRelsXml());
    files['xl/styles.xml'] = toUtf8(styles.toXml());
    files['xl/sharedStrings.xml'] = toUtf8(strings.toXml());

    for (let i = 0; i < sheetXmls.length; i++) {
      files[`xl/worksheets/sheet${i + 1}.xml`] = toUtf8(sheetXmls[i]);
    }

    return zipSync(files, { level: 6 });
  }

  // -----------------------------------------------------------------------
  // Private: XML generators
  // -----------------------------------------------------------------------

  /**
   * @returns {string}
   */
  _contentTypesXml() {
    let xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
    xml += '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">';
    xml += '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>';
    xml += '<Default Extension="xml" ContentType="application/xml"/>';
    xml += '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>';
    xml += '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>';
    xml += '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>';
    for (let i = 0; i < this._sheets.length; i++) {
      xml += `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`;
    }
    xml += '</Types>';
    return xml;
  }

  /**
   * @returns {string}
   */
  _relsXml() {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
      '</Relationships>';
  }

  /**
   * @returns {string}
   */
  _workbookXml() {
    let xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
    xml += '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">';
    xml += '<sheets>';
    for (let i = 0; i < this._sheets.length; i++) {
      xml += `<sheet name="${escapeXml(this._sheets[i].name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`;
    }
    xml += '</sheets>';
    xml += '</workbook>';
    return xml;
  }

  /**
   * @returns {string}
   */
  _workbookRelsXml() {
    let xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
    xml += '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">';
    for (let i = 0; i < this._sheets.length; i++) {
      xml += `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`;
    }
    const ssId = this._sheets.length + 1;
    const stId = this._sheets.length + 2;
    xml += `<Relationship Id="rId${ssId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>`;
    xml += `<Relationship Id="rId${stId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`;
    xml += '</Relationships>';
    return xml;
  }

  /**
   * Build the XML for a single worksheet.
   * @param {SheetData}     sheet
   * @param {StyleRegistry} styles
   * @param {SharedStrings} strings
   * @returns {string}
   */
  _buildSheetXml(sheet, styles, strings) {
    let xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
    xml += '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">';

    // Column widths
    if (sheet.colWidths.size > 0) {
      xml += '<cols>';
      const sorted = [...sheet.colWidths.entries()].sort((a, b) => a[0] - b[0]);
      for (const [col, width] of sorted) {
        const colNum = col + 1; // 1-based
        xml += `<col min="${colNum}" max="${colNum}" width="${width}" customWidth="1"/>`;
      }
      xml += '</cols>';
    }

    // Sheet data
    xml += '<sheetData>';
    for (let r = 0; r < sheet.rows.length; r++) {
      const row = sheet.rows[r];
      if (!row || row.length === 0) {
        xml += `<row r="${r + 1}"/>`;
        continue;
      }

      xml += `<row r="${r + 1}">`;
      for (let c = 0; c < row.length; c++) {
        const raw = row[c];
        if (raw === null || raw === undefined) continue;

        const cell = normalizeCell(raw);
        const ref = cellRef(r, c);

        // Merge explicit style from setCellStyle with cell-level style
        const explicitStyle = sheet.cellStyles.get(`${r},${c}`);
        const mergedStyle = explicitStyle
          ? { ...(cell.style || {}), ...explicitStyle }
          : cell.style;

        const xfIdx = styles.resolve(mergedStyle, cell.type);
        const sAttr = xfIdx > 0 ? ` s="${xfIdx}"` : '';

        switch (cell.type) {
          case 'number': {
            const num = typeof cell.value === 'string' ? Number(cell.value) : Number(cell.value);
            xml += `<c r="${ref}"${sAttr}><v>${num}</v></c>`;
            break;
          }
          case 'date': {
            const d = cell.value instanceof Date
              ? cell.value
              : new Date(String(cell.value));
            if (isNaN(d.getTime())) {
              // Fallback: treat as string
              const si = strings.add(String(cell.value));
              xml += `<c r="${ref}" t="s"${sAttr}><v>${si}</v></c>`;
            } else {
              xml += `<c r="${ref}"${sAttr}><v>${dateToSerial(d)}</v></c>`;
            }
            break;
          }
          case 'formula': {
            const formula = String(cell.value).slice(1); // strip leading '='
            xml += `<c r="${ref}"${sAttr}><f>${escapeXml(formula)}</f></c>`;
            break;
          }
          default: {
            // string (and boolean rendered as string)
            const str = typeof cell.value === 'boolean'
              ? (cell.value ? 'TRUE' : 'FALSE')
              : String(cell.value);
            const si = strings.add(str);
            xml += `<c r="${ref}" t="s"${sAttr}><v>${si}</v></c>`;
            break;
          }
        }
      }
      xml += '</row>';
    }
    xml += '</sheetData>';

    // Merge cells
    if (sheet.merges.length > 0) {
      xml += `<mergeCells count="${sheet.merges.length}">`;
      for (const m of sheet.merges) {
        xml += `<mergeCell ref="${cellRef(m.sr, m.sc)}:${cellRef(m.er, m.ec)}"/>`;
      }
      xml += '</mergeCells>';
    }

    xml += '</worksheet>';
    return xml;
  }
}
