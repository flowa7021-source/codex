// @ts-check

/**
 * @module docx-to-xlsx
 * Converts DOCX to XLSX by extracting tables from Word documents.
 *
 * Parses word/document.xml using regex-based XML extraction so the module
 * works in both browser and Node.js test environments without DOMParser.
 */

import { unzipSync } from 'fflate';
import { XlsxBuilder } from './xlsx-builder.js';

/* ------------------------------------------------------------------ */
/*  Regex helpers for OOXML parsing                                    */
/* ------------------------------------------------------------------ */

/**
 * Return all non-overlapping matches of an outer element from `xml`.
 * Handles nested tags of the same local-name by counting depth.
 *
 * @param {string} xml
 * @param {string} tag  – fully-qualified tag, e.g. "w:tbl"
 * @returns {Array<{start: number, end: number, content: string}>}
 */
function findAllElements(xml, tag) {
  /** @type {Array<{start: number, end: number, content: string}>} */
  const results = [];
  const closeTag = `</${tag}>`;

  /**
   * Find next occurrence of `<tag>` or `<tag ` or `<tag/` (but not `<tagX`).
   * @param {number} from
   * @returns {number} index or -1
   */
  function findOpen(from) {
    const prefix = `<${tag}`;
    let idx = from;
    while (idx < xml.length) {
      idx = xml.indexOf(prefix, idx);
      if (idx === -1) return -1;
      const after = xml.charAt(idx + prefix.length);
      if (after === '>' || after === ' ' || after === '/' || after === '\n' || after === '\r' || after === '\t') {
        return idx;
      }
      idx += prefix.length;
    }
    return -1;
  }

  let searchFrom = 0;
  while (searchFrom < xml.length) {
    const openIdx = findOpen(searchFrom);
    if (openIdx === -1) break;

    let depth = 0;
    let cursor = openIdx;

    while (cursor < xml.length) {
      const nextOpen = findOpen(cursor + 1);
      const nextClose = xml.indexOf(closeTag, cursor + 1);

      if (nextClose === -1) {
        cursor = xml.length;
        break;
      }

      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth++;
        cursor = nextOpen;
      } else {
        if (depth === 0) {
          const end = nextClose + closeTag.length;
          results.push({
            start: openIdx,
            end,
            content: xml.substring(openIdx, end),
          });
          searchFrom = end;
          break;
        }
        depth--;
        cursor = nextClose;
      }
    }

    if (cursor >= xml.length) {
      searchFrom = openIdx + 1;
    }
  }

  return results;
}

/**
 * Extract concatenated plain text from all `<w:t>` elements inside a fragment.
 *
 * @param {string} fragment
 * @returns {string}
 */
function extractText(fragment) {
  const re = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
  let text = '';
  let m;
  while ((m = re.exec(fragment)) !== null) {
    text += m[1];
  }
  return text;
}

/**
 * Check whether the fragment contains a `<w:b/>` or `<w:b w:val="true"/>` tag
 * (but not `<w:b w:val="false"/>`).
 *
 * @param {string} fragment
 * @returns {boolean}
 */
function hasBold(fragment) {
  // Self-closing <w:b/> with no val attribute → bold
  if (/<w:b\/>/.test(fragment)) return true;
  // <w:b w:val="true"/> or <w:b w:val="1"/> → bold
  if (/<w:b\s+w:val\s*=\s*"(true|1)"\s*\/>/.test(fragment)) return true;
  // <w:b> ... </w:b> with val="true" handled above; bare <w:b> without val
  if (/<w:b>/.test(fragment)) return true;
  return false;
}

/**
 * Detect horizontal alignment from `<w:jc w:val="..."/>`.
 *
 * @param {string} fragment
 * @returns {string | null} – "center", "right", "left", etc. or null
 */
function getAlignment(fragment) {
  const m = fragment.match(/<w:jc\s+w:val\s*=\s*"([^"]+)"\s*\/>/);
  return m ? m[1] : null;
}

/**
 * Get the gridSpan value for a table cell (horizontal merge).
 *
 * @param {string} cellXml
 * @returns {number}
 */
function getGridSpan(cellXml) {
  const m = cellXml.match(/<w:gridSpan\s+w:val\s*=\s*"(\d+)"\s*\/>/);
  return m ? parseInt(m[1], 10) : 1;
}

/**
 * Detect vertical merge state.
 *
 * @param {string} cellXml
 * @returns {"restart" | "continue" | null}
 */
function getVMerge(cellXml) {
  // <w:vMerge w:val="restart"/>  → starts a new vertical merge group
  const restart = cellXml.match(/<w:vMerge\s+w:val\s*=\s*"restart"\s*\/>/);
  if (restart) return 'restart';

  // <w:vMerge/> with no val attribute → continues previous cell's merge
  if (/<w:vMerge\s*\/>/.test(cellXml)) return 'continue';

  return null;
}

/* ------------------------------------------------------------------ */
/*  Heading detection                                                  */
/* ------------------------------------------------------------------ */

/**
 * @typedef {Object} HeadingInfo
 * @property {string} text
 * @property {number} end – character index where the paragraph ends
 */

/**
 * Collect all heading paragraphs (Heading1-9, Title) with their position.
 *
 * @param {string} xml
 * @returns {HeadingInfo[]}
 */
function collectHeadings(xml) {
  /** @type {HeadingInfo[]} */
  const headings = [];
  const paragraphs = findAllElements(xml, 'w:p');

  for (const p of paragraphs) {
    const styleMatch = p.content.match(
      /<w:pStyle\s+w:val\s*=\s*"(Heading\d|Title)"\s*\/>/,
    );
    if (styleMatch) {
      const text = extractText(p.content).trim();
      if (text) {
        headings.push({ text, end: p.end });
      }
    }
  }
  return headings;
}

/**
 * Given a table's start offset and the list of headings, return the nearest
 * heading text that appears before the table, or `null`.
 *
 * @param {number} tableStart
 * @param {HeadingInfo[]} headings
 * @returns {string | null}
 */
function headingBefore(tableStart, headings) {
  /** @type {string | null} */
  let best = null;
  for (const h of headings) {
    if (h.end <= tableStart) {
      best = h.text;
    }
  }
  return best;
}

/* ------------------------------------------------------------------ */
/*  Table / cell model                                                 */
/* ------------------------------------------------------------------ */

/**
 * @typedef {Object} CellData
 * @property {string} text
 * @property {boolean} bold
 * @property {string | null} alignment
 * @property {number} gridSpan
 * @property {"restart" | "continue" | null} vMerge
 */

/**
 * @typedef {CellData[]} RowData
 */

/**
 * Parse a single `<w:tbl>` block into a 2-D array of CellData.
 *
 * @param {string} tableXml
 * @returns {RowData[]}
 */
function parseTable(tableXml) {
  /** @type {RowData[]} */
  const rows = [];
  const rowElements = findAllElements(tableXml, 'w:tr');

  for (const rowEl of rowElements) {
    /** @type {RowData} */
    const row = [];
    const cellElements = findAllElements(rowEl.content, 'w:tc');

    for (const cellEl of cellElements) {
      row.push({
        text: extractText(cellEl.content),
        bold: hasBold(cellEl.content),
        alignment: getAlignment(cellEl.content),
        gridSpan: getGridSpan(cellEl.content),
        vMerge: getVMerge(cellEl.content),
      });
    }
    rows.push(row);
  }
  return rows;
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Convert a DOCX file (as bytes) to an XLSX Blob by extracting every table
 * found in word/document.xml.
 *
 * Each table is placed on its own sheet. The sheet name is derived from the
 * nearest heading that precedes the table, falling back to "Table N".
 *
 * @param {Uint8Array} docxBytes – raw bytes of the .docx file
 * @returns {Promise<{blob: Blob, sheetCount: number}>}
 * @throws {Error} If the DOCX structure is invalid or contains no tables.
 */
export async function convertDocxToXlsx(docxBytes) {
  /* 1. Unpack DOCX ------------------------------------------------- */
  /** @type {Record<string, Uint8Array>} */
  let entries;
  try {
    entries = unzipSync(docxBytes);
  } catch {
    throw new Error('Invalid DOCX format');
  }

  const docEntry = entries['word/document.xml'];
  if (!docEntry) {
    throw new Error('Invalid DOCX format');
  }

  const xml = new TextDecoder().decode(docEntry);

  /* 2-3. Find all <w:tbl> elements --------------------------------- */
  const tableElements = findAllElements(xml, 'w:tbl');
  if (tableElements.length === 0) {
    throw new Error('No tables found in document');
  }

  /* Heading map for sheet naming ----------------------------------- */
  const headings = collectHeadings(xml);

  /* 4. Build Excel workbook ---------------------------------------- */
  const builder = new XlsxBuilder();

  for (let t = 0; t < tableElements.length; t++) {
    const tblEl = tableElements[t];
    const parsedRows = parseTable(tblEl.content);

    // Determine sheet name
    const headingText = headingBefore(tblEl.start, headings);
    const sheetName = headingText || `Table ${t + 1}`;

    // Build rows array for XlsxBuilder: each row is array of cell values
    // Cells can be plain values or {value, type, style} objects
    /** @type {Array<Array<string | {value: string, type: string, style?: Record<string, unknown>}>>} */
    const xlsxRows = [];

    for (let r = 0; r < parsedRows.length; r++) {
      const row = parsedRows[r];
      /** @type {Array<string | {value: string, type: string, style?: Record<string, unknown>}>} */
      const xlsxRow = [];

      for (const cell of row) {
        const hasStyle = cell.bold || cell.alignment;
        if (hasStyle) {
          /** @type {Record<string, unknown>} */
          const style = {};
          if (cell.bold) style.bold = true;
          if (cell.alignment) style.alignment = cell.alignment;
          xlsxRow.push({ value: cell.text, type: 'string', style });
        } else {
          xlsxRow.push(cell.text);
        }

        // Pad for gridSpan > 1 (empty cells for merged area)
        for (let g = 1; g < cell.gridSpan; g++) {
          xlsxRow.push('');
        }

      }

      xlsxRows.push(xlsxRow);
    }

    builder.addSheet(sheetName, /** @type {any} */ (xlsxRows));
    const sheetIndex = t;

    // Handle horizontal merges (gridSpan)
    for (let r = 0; r < parsedRows.length; r++) {
      let colIdx = 0;
      for (const cell of parsedRows[r]) {
        if (cell.gridSpan > 1) {
          builder.mergeCells(sheetIndex, r, colIdx, r, colIdx + cell.gridSpan - 1);
        }
        colIdx += cell.gridSpan;
      }
    }

    // Finalize vertical merges
    finalizeVerticalMergesOnBuilder(parsedRows, builder, sheetIndex);
  }

  /* 5. Return blob ------------------------------------------------- */
  const xlsxBytes = await builder.build();
  return { blob: new Blob([/** @type {any} */ (xlsxBytes)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), sheetCount: tableElements.length };
}

/**
 * Walk the parsed rows and emit vertical merge ranges via the builder.
 *
 * @param {RowData[]} rows
 * @param {*} builder – XlsxBuilder instance
 * @param {number} sheetIndex – 0-based sheet index
 */
function finalizeVerticalMergesOnBuilder(rows, builder, sheetIndex) {
  // Wrapper that delegates to builder.mergeCells(sheetIndex, ...)
  const fakeSheet = {
    mergeCells: (sr, sc, er, ec) => builder.mergeCells(sheetIndex, sr, sc, er, ec),
  };
  finalizeVerticalMerges(rows, fakeSheet);
}

function finalizeVerticalMerges(rows, sheet) {
  // Build a grid that maps (row, expandedCol) → vMerge state.
  // We need to expand gridSpan so column indices are absolute.

  /** @type {Array<Array<{vMerge: "restart" | "continue" | null, colSpan: number}>>} */
  const grid = [];

  for (const row of rows) {
    /** @type {Array<{vMerge: "restart" | "continue" | null, colSpan: number}>} */
    const expandedRow = [];
    for (const cell of row) {
      expandedRow.push({ vMerge: cell.vMerge, colSpan: cell.gridSpan });
    }
    grid.push(expandedRow);
  }

  // For each row, compute the starting column index of each cell.
  for (let r = 0; r < grid.length; r++) {
    let col = 0;
    for (let c = 0; c < grid[r].length; c++) {
      const cellInfo = grid[r][c];
      if (cellInfo.vMerge === 'restart') {
        // Find how far the merge extends downward.
        let endRow = r;
        for (let nr = r + 1; nr < grid.length; nr++) {
          const targetCell = getCellAtAbsoluteCol(grid[nr], col);
          if (targetCell && targetCell.vMerge === 'continue') {
            endRow = nr;
          } else {
            break;
          }
        }
        if (endRow > r) {
          sheet.mergeCells(r, col, endRow, col + cellInfo.colSpan - 1);
        }
      }
      col += cellInfo.colSpan;
    }
  }
}

/**
 * Given an expanded row (array of cells with colSpan), find the cell that
 * occupies the given absolute column index.
 *
 * @param {Array<{vMerge: "restart" | "continue" | null, colSpan: number}>} expandedRow
 * @param {number} absCol
 * @returns {{vMerge: "restart" | "continue" | null, colSpan: number} | null}
 */
function getCellAtAbsoluteCol(expandedRow, absCol) {
  let col = 0;
  for (const cell of expandedRow) {
    if (col === absCol) return cell;
    col += cell.colSpan;
    if (col > absCol) return null;
  }
  return null;
}
