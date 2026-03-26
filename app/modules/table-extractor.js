// @ts-check

/**
 * @typedef {{ text: string, rect: { x: number, y: number, w: number, h: number } }} CellData
 * @typedef {{ rows: CellData[][], bounds: { x: number, y: number, w: number, h: number }, ruled: boolean }} Table
 * @typedef {{ mode?: 'auto' | 'ruled' | 'ruleless', yTolerance?: number, gapMultiplier?: number }} ExtractOptions
 */

/**
 * @typedef {{ x1: number, y1: number, x2: number, y2: number }} Line
 */

/** @type {typeof import('pdfjs-dist') | null} */
let _pdfjsLib = null;

/**
 * Lazily loads pdfjs-dist.
 * @returns {Promise<typeof import('pdfjs-dist')>}
 */
async function getPdfjs() {
  if (!_pdfjsLib) {
    _pdfjsLib = await import('pdfjs-dist');
  }
  return _pdfjsLib;
}

const LINE_TOLERANCE = 1;

/**
 * Determines if a line is horizontal (y1 ~= y2).
 * @param {Line} line
 * @returns {boolean}
 */
function isHorizontal(line) {
  return Math.abs(line.y1 - line.y2) <= LINE_TOLERANCE;
}

/**
 * Determines if a line is vertical (x1 ~= x2).
 * @param {Line} line
 * @returns {boolean}
 */
function isVertical(line) {
  return Math.abs(line.x1 - line.x2) <= LINE_TOLERANCE;
}

/**
 * Snaps a value to the nearest value in a sorted array within tolerance.
 * @param {number} val
 * @param {number[]} sorted
 * @param {number} tol
 * @returns {number}
 */
function _snapTo(val, sorted, tol) {
  for (const s of sorted) {
    if (Math.abs(val - s) <= tol) return s;
  }
  return val;
}

/**
 * De-duplicates numeric values within a tolerance, returning sorted unique values.
 * @param {number[]} values
 * @param {number} tol
 * @returns {number[]}
 */
function uniqueSorted(values, tol) {
  if (values.length === 0) return [];
  const sorted = [...values].sort((a, b) => a - b);
  /** @type {number[]} */
  const result = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - result[result.length - 1] > tol) {
      result.push(sorted[i]);
    }
  }
  return result;
}

/**
 * Extracts lines (horizontal and vertical) from a PDF page's operator list.
 * @param {import('pdfjs-dist').PDFPageProxy} page
 * @returns {Promise<{ horizontal: Line[], vertical: Line[] }>}
 */
async function extractLines(page) {
  const pdfjsLib = await getPdfjs();
  const OPS = pdfjsLib.OPS;
  const ops = await page.getOperatorList();

  /** @type {Line[]} */
  const horizontal = [];
  /** @type {Line[]} */
  const vertical = [];

  let curX = 0;
  let curY = 0;

  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i];
    const args = ops.argsArray[i];

    if (fn === OPS.moveTo) {
      curX = /** @type {number} */ (args[0]);
      curY = /** @type {number} */ (args[1]);
    } else if (fn === OPS.lineTo) {
      const x2 = /** @type {number} */ (args[0]);
      const y2 = /** @type {number} */ (args[1]);
      const line = { x1: curX, y1: curY, x2, y2 };

      if (isHorizontal(line)) {
        horizontal.push({
          x1: Math.min(line.x1, line.x2),
          y1: (line.y1 + line.y2) / 2,
          x2: Math.max(line.x1, line.x2),
          y2: (line.y1 + line.y2) / 2,
        });
      } else if (isVertical(line)) {
        vertical.push({
          x1: (line.x1 + line.x2) / 2,
          y1: Math.min(line.y1, line.y2),
          x2: (line.x1 + line.x2) / 2,
          y2: Math.max(line.y1, line.y2),
        });
      }

      curX = x2;
      curY = y2;
    } else if (fn === OPS.rectangle) {
      const rx = /** @type {number} */ (args[0]);
      const ry = /** @type {number} */ (args[1]);
      const rw = /** @type {number} */ (args[2]);
      const rh = /** @type {number} */ (args[3]);

      // A rectangle contributes 4 lines (2 horizontal + 2 vertical)
      horizontal.push(
        { x1: rx, y1: ry, x2: rx + rw, y2: ry },
        { x1: rx, y1: ry + rh, x2: rx + rw, y2: ry + rh }
      );
      vertical.push(
        { x1: rx, y1: ry, x2: rx, y2: ry + rh },
        { x1: rx + rw, y1: ry, x2: rx + rw, y2: ry + rh }
      );
    }
  }

  return { horizontal, vertical };
}

/**
 * Builds a cell grid from horizontal and vertical lines, then binds text items to cells.
 * @param {Line[]} horizontal
 * @param {Line[]} vertical
 * @param {Array<{ str: string, transform: number[], width: number, height: number }>} textItems
 * @returns {Table | null}
 */
function buildRuledTable(horizontal, vertical, textItems) {
  // Collect unique x-coords from vertical lines and unique y-coords from horizontal lines
  const xValues = uniqueSorted(
    vertical.flatMap((l) => [l.x1, l.x2]),
    LINE_TOLERANCE
  );
  const yValues = uniqueSorted(
    horizontal.flatMap((l) => [l.y1, l.y2]),
    LINE_TOLERANCE
  );

  if (xValues.length < 2 || yValues.length < 2) return null;

  const numRows = yValues.length - 1;
  const numCols = xValues.length - 1;

  if (numRows < 1 || numCols < 1) return null;

  // Build empty grid: rows × cols, each cell has text accumulator and rect
  /** @type {{ texts: string[], rect: { x: number, y: number, w: number, h: number }, mergeAcross?: number }[][]} */
  const grid = [];
  for (let r = 0; r < numRows; r++) {
    /** @type {{ texts: string[], rect: { x: number, y: number, w: number, h: number }, mergeAcross?: number }[]} */
    const row = [];
    for (let c = 0; c < numCols; c++) {
      row.push({
        texts: [],
        rect: {
          x: xValues[c],
          y: yValues[r],
          w: xValues[c + 1] - xValues[c],
          h: yValues[r + 1] - yValues[r],
        },
      });
    }
    grid.push(row);
  }

  // Bind text items to cells
  for (const item of textItems) {
    if (!item.str.trim()) continue;
    const tx = item.transform[4];
    const ty = item.transform[5];

    for (let r = 0; r < numRows; r++) {
      for (let c = 0; c < numCols; c++) {
        const cell = grid[r][c];
        if (
          tx >= cell.rect.x - LINE_TOLERANCE &&
          tx < cell.rect.x + cell.rect.w + LINE_TOLERANCE &&
          ty >= cell.rect.y - LINE_TOLERANCE &&
          ty < cell.rect.y + cell.rect.h + LINE_TOLERANCE
        ) {
          cell.texts.push(item.str);
        }
      }
    }
  }

  // Detect merged cells: if a text item spans across multiple column boundaries
  for (const item of textItems) {
    if (!item.str.trim()) continue;
    const tx = item.transform[4];
    const textRight = tx + item.width;

    for (let r = 0; r < numRows; r++) {
      for (let c = 0; c < numCols; c++) {
        const cell = grid[r][c];
        if (
          tx >= cell.rect.x - LINE_TOLERANCE &&
          tx < cell.rect.x + cell.rect.w + LINE_TOLERANCE
        ) {
          // Count how many additional columns this text spans
          let span = 0;
          for (let cc = c + 1; cc < numCols; cc++) {
            if (textRight > xValues[cc] + LINE_TOLERANCE) {
              span++;
            } else {
              break;
            }
          }
          if (span > 0) {
            grid[r][c].mergeAcross = span;
          }
        }
      }
    }
  }

  // Convert grid to output format
  /** @type {CellData[][]} */
  const rows = grid.map((row) =>
    row.map((cell) => ({
      text: cell.texts.join(' '),
      rect: cell.rect,
      ...(cell.mergeAcross ? { mergeAcross: cell.mergeAcross } : {}),
    }))
  );

  const bounds = {
    x: xValues[0],
    y: yValues[0],
    w: xValues[xValues.length - 1] - xValues[0],
    h: yValues[yValues.length - 1] - yValues[0],
  };

  return { rows, bounds, ruled: true };
}

/**
 * Extracts tables using ruled-line detection from a single page.
 * @param {import('pdfjs-dist').PDFPageProxy} page
 * @returns {Promise<Table[]>}
 */
async function extractRuledTables(page) {
  const { horizontal, vertical } = await extractLines(page);

  if (horizontal.length < 2 || vertical.length < 2) return [];

  const textContent = await page.getTextContent();
  const textItems = /** @type {Array<{ str: string, transform: number[], width: number, height: number }>} */ (
    textContent.items.filter(
      (/** @type {any} */ item) => typeof item.str === 'string'
    )
  );

  const table = buildRuledTable(horizontal, vertical, textItems);
  return table ? [table] : [];
}

/**
 * Extracts tables using ruleless (coordinate clustering) detection.
 * @param {import('pdfjs-dist').PDFPageProxy} page
 * @param {number} yTolerance
 * @param {number} gapMultiplier
 * @returns {Promise<Table[]>}
 */
async function extractRulelessTables(page, yTolerance, gapMultiplier) {
  const textContent = await page.getTextContent();
  const textItems = /** @type {Array<{ str: string, transform: number[], width: number, height: number }>} */ (
    textContent.items.filter(
      (/** @type {any} */ item) => typeof item.str === 'string' && item.str.trim()
    )
  );

  if (textItems.length === 0) return [];

  // Compute median character width
  const charWidths = textItems
    .filter((item) => item.str.length > 0 && item.width > 0)
    .map((item) => item.width / item.str.length);

  if (charWidths.length === 0) return [];

  charWidths.sort((a, b) => a - b);
  const medianCharWidth = charWidths[Math.floor(charWidths.length / 2)];
  const gapThreshold = medianCharWidth * gapMultiplier;

  // Sort text items by Y descending (PDF coordinates: origin at bottom-left)
  const sorted = [...textItems].sort(
    (a, b) => b.transform[5] - a.transform[5]
  );

  // Cluster by Y into rows
  /** @type {Array<Array<{ str: string, transform: number[], width: number, height: number }>>} */
  const rowGroups = [];
  /** @type {Array<{ str: string, transform: number[], width: number, height: number }>} */
  let currentRow = [sorted[0]];
  let currentY = sorted[0].transform[5];

  for (let i = 1; i < sorted.length; i++) {
    const itemY = sorted[i].transform[5];
    if (Math.abs(itemY - currentY) <= yTolerance) {
      currentRow.push(sorted[i]);
    } else {
      rowGroups.push(currentRow);
      currentRow = [sorted[i]];
      currentY = itemY;
    }
  }
  rowGroups.push(currentRow);

  // Within each row, sort by X ascending and find column breaks
  /** @type {CellData[][]} */
  const tableRows = [];

  for (const group of rowGroups) {
    group.sort((a, b) => a.transform[4] - b.transform[4]);

    /** @type {CellData[]} */
    const cells = [];
    /** @type {typeof group} */
    let currentCell = [group[0]];

    for (let i = 1; i < group.length; i++) {
      const prevItem = group[i - 1];
      const prevRight = prevItem.transform[4] + prevItem.width;
      const curLeft = group[i].transform[4];
      const gap = curLeft - prevRight;

      if (gap > gapThreshold) {
        // Column break
        cells.push(itemsToCell(currentCell));
        currentCell = [group[i]];
      } else {
        currentCell.push(group[i]);
      }
    }
    cells.push(itemsToCell(currentCell));
    tableRows.push(cells);
  }

  // Validate: need at least 2 rows and 2 columns
  const maxCols = Math.max(...tableRows.map((r) => r.length));
  if (tableRows.length < 2 || maxCols < 2) return [];

  // Compute bounds
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const row of tableRows) {
    for (const cell of row) {
      minX = Math.min(minX, cell.rect.x);
      minY = Math.min(minY, cell.rect.y);
      maxX = Math.max(maxX, cell.rect.x + cell.rect.w);
      maxY = Math.max(maxY, cell.rect.y + cell.rect.h);
    }
  }

  return [
    {
      rows: tableRows,
      bounds: { x: minX, y: minY, w: maxX - minX, h: maxY - minY },
      ruled: false,
    },
  ];
}

/**
 * Converts a group of text items into a single CellData.
 * @param {Array<{ str: string, transform: number[], width: number, height: number }>} items
 * @returns {CellData}
 */
function itemsToCell(items) {
  const text = items.map((it) => it.str).join(' ');
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const item of items) {
    const x = item.transform[4];
    const y = item.transform[5];
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + item.width);
    maxY = Math.max(maxY, y + item.height);
  }

  return {
    text,
    rect: { x: minX, y: minY, w: maxX - minX, h: maxY - minY },
  };
}

/**
 * Extracts tables from a single PDF page.
 *
 * @param {import('pdfjs-dist').PDFDocumentProxy} pdfDoc - PDF.js document proxy
 * @param {number} pageNum - 1-based page number
 * @param {ExtractOptions} [options]
 * @returns {Promise<Table[]>}
 */
export async function extractTables(pdfDoc, pageNum, options) {
  const mode = options?.mode ?? 'auto';
  const yTolerance = options?.yTolerance ?? 3;
  const gapMultiplier = options?.gapMultiplier ?? 2;

  const page = await pdfDoc.getPage(pageNum);

  if (mode === 'ruled') {
    return extractRuledTables(page);
  }

  if (mode === 'ruleless') {
    return extractRulelessTables(page, yTolerance, gapMultiplier);
  }

  // Auto mode: try ruled first, fall back to ruleless
  const ruledResults = await extractRuledTables(page);
  if (ruledResults.length > 0) {
    return ruledResults;
  }

  return extractRulelessTables(page, yTolerance, gapMultiplier);
}

/**
 * Extracts tables from all pages of a PDF document.
 *
 * @param {import('pdfjs-dist').PDFDocumentProxy} pdfDoc - PDF.js document proxy
 * @returns {Promise<Map<number, Table[]>>}
 */
export async function extractAllTables(pdfDoc) {
  /** @type {Map<number, Table[]>} */
  const result = new Map();
  const numPages = pdfDoc.numPages;

  for (let i = 1; i <= numPages; i++) {
    const tables = await extractTables(pdfDoc, i);
    if (tables.length > 0) {
      result.set(i, tables);
    }
  }

  return result;
}
