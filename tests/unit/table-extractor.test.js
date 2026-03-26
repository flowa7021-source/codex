import './setup-dom.js';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// We need to mock pdfjs-dist before importing the module under test.
// table-extractor lazily imports pdfjs-dist via `await import('pdfjs-dist')`.
// We intercept by registering a mock module.

/** OPS constants matching pdfjs-dist (real values from the library) */
const OPS = {
  moveTo: 13,
  lineTo: 14,
  rectangle: 19,
};

/**
 * Create a mock PDF page.
 * @param {object} opts
 * @param {Array} opts.fnArray - operator function IDs
 * @param {Array} opts.argsArray - operator arguments
 * @param {Array} opts.textItems - text content items
 * @returns mock page object
 */
function mockPage({ fnArray = [], argsArray = [], textItems = [] }) {
  return {
    getOperatorList: async () => ({ fnArray, argsArray }),
    getTextContent: async () => ({
      items: textItems.map((item) =>
        typeof item === 'string'
          ? { str: item, transform: [1, 0, 0, 1, 0, 0], width: 10, height: 10 }
          : item
      ),
    }),
  };
}

/**
 * Create a mock PDF document proxy.
 * @param {Array} pages - array of mock pages (1-indexed internally)
 * @returns mock pdfDoc
 */
function mockPdfDoc(pages) {
  return {
    numPages: pages.length,
    getPage: async (num) => pages[num - 1],
  };
}

/**
 * Build operator list entries for a rectangle grid (ruled table).
 * Draws horizontal lines at given Y coords spanning [xMin..xMax],
 * and vertical lines at given X coords spanning [yMin..yMax].
 * @param {number[]} xCoords - vertical line X positions
 * @param {number[]} yCoords - horizontal line Y positions
 */
function gridOps(xCoords, yCoords) {
  const fnArray = [];
  const argsArray = [];

  // Horizontal lines
  for (const y of yCoords) {
    fnArray.push(OPS.moveTo);
    argsArray.push([xCoords[0], y]);
    fnArray.push(OPS.lineTo);
    argsArray.push([xCoords[xCoords.length - 1], y]);
  }

  // Vertical lines
  for (const x of xCoords) {
    fnArray.push(OPS.moveTo);
    argsArray.push([x, yCoords[0]]);
    fnArray.push(OPS.lineTo);
    argsArray.push([x, yCoords[yCoords.length - 1]]);
  }

  return { fnArray, argsArray };
}

/**
 * Create a text item at a given position.
 */
function textItem(str, x, y, width = 10, height = 10) {
  return { str, transform: [1, 0, 0, 1, x, y], width, height };
}

// The table-extractor module lazily imports pdfjs-dist for OPS constants.
// We use the real pdfjs-dist (installed as a dependency) but provide mock
// page objects that return our controlled operator lists and text content.

let extractTables, extractAllTables;

// Dynamically import to handle potential pdfjs-dist issues
try {
  const mod = await import('../../app/modules/table-extractor.js');
  extractTables = mod.extractTables;
  extractAllTables = mod.extractAllTables;
} catch {
  // If pdfjs-dist isn't available, we skip tests
}

describe('table-extractor', { skip: !extractTables && 'pdfjs-dist not available' }, () => {
  describe('ruled table 4x3', () => {
    it('detects a 4-row, 3-column ruled table', async () => {
      // Grid: 4 columns of vertical lines (3 cols), 5 horizontal lines (4 rows)
      const xCoords = [50, 150, 250, 350]; // 3 columns
      const yCoords = [100, 130, 160, 190, 220]; // 4 rows
      const ops = gridOps(xCoords, yCoords);

      // Place text items inside cells
      const textItems = [];
      const cellTexts = [
        ['H1', 'H2', 'H3'],
        ['A1', 'A2', 'A3'],
        ['B1', 'B2', 'B3'],
        ['C1', 'C2', 'C3'],
      ];
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 3; c++) {
          textItems.push(textItem(cellTexts[r][c], xCoords[c] + 5, yCoords[r] + 5));
        }
      }

      const page = mockPage({ ...ops, textItems });
      const pdfDoc = mockPdfDoc([page]);
      const tables = await extractTables(pdfDoc, 1, { mode: 'ruled' });

      assert.ok(tables.length > 0, 'should detect at least one table');
      const table = tables[0];
      assert.equal(table.rows.length, 4, 'should have 4 rows');
      assert.equal(table.rows[0].length, 3, 'should have 3 columns');
      assert.equal(table.ruled, true, 'should be marked as ruled');
    });
  });

  describe('ruled table row order', () => {
    it('first output row = visual top of table (rows reversed from PDF Y)', async () => {
      // Grid: 2 cols, 2 rows
      // yCoords: [100, 130, 160] means rows at y=100-130 (bottom in PDF) and y=130-160 (top in PDF)
      const xCoords = [50, 150, 250];
      const yCoords = [100, 130, 160];
      const ops = gridOps(xCoords, yCoords);

      // Place "Bottom" in the lower Y range (y=105) and "Top" in the higher Y range (y=135)
      const textItems = [
        textItem('Bottom', 55, 105, 40, 10), // lower Y = visually lower in PDF
        textItem('BotR', 155, 105, 40, 10),
        textItem('Top', 55, 135, 40, 10),     // higher Y = visually higher in PDF
        textItem('TopR', 155, 135, 40, 10),
      ];

      const page = mockPage({ ...ops, textItems });
      const pdfDoc = mockPdfDoc([page]);
      const tables = await extractTables(pdfDoc, 1, { mode: 'ruled' });

      assert.ok(tables.length > 0, 'should detect a table');
      const table = tables[0];
      assert.equal(table.rows.length, 2, 'should have 2 rows');

      // After reversal, the first output row should be the one from higher Y (visual top)
      assert.ok(
        table.rows[0][0].text.includes('Top'),
        `first row should be visual top ("Top"), got: "${table.rows[0][0].text}"`,
      );
      assert.ok(
        table.rows[1][0].text.includes('Bottom'),
        `second row should be visual bottom ("Bottom"), got: "${table.rows[1][0].text}"`,
      );
    });
  });

  describe('vertical merge detection', () => {
    it('cell with text above empty cells gets mergeDown', async () => {
      // 3 rows, 2 cols
      const xCoords = [50, 150, 250];
      const yCoords = [100, 130, 160, 190];
      const ops = gridOps(xCoords, yCoords);

      // Place text in col 0 only in the first row (lowest Y in grid = y=100-130).
      // The other two rows in col 0 are empty -> should produce mergeDown.
      // Col 1 has text in all rows.
      // After reversal (highest Y row first), the top row will be y=160-190.
      // We need the filled cell to be at the TOP visually (highest Y), so put text at y=165.
      const textItems = [
        textItem('R1C2', 155, 105, 40, 10), // col 1, row at y=100-130
        textItem('R2C2', 155, 135, 40, 10), // col 1, row at y=130-160
        textItem('Merged', 55, 165, 40, 10), // col 0, row at y=160-190 (highest Y = visual top after reversal)
        textItem('R3C2', 155, 165, 40, 10), // col 1, row at y=160-190
      ];

      const page = mockPage({ ...ops, textItems });
      const pdfDoc = mockPdfDoc([page]);
      const tables = await extractTables(pdfDoc, 1, { mode: 'ruled' });

      assert.ok(tables.length > 0, 'should detect a table');
      const table = tables[0];
      assert.equal(table.rows.length, 3, 'should have 3 rows');

      // After reversal, first row is the one from highest Y (y=160-190).
      // "Merged" should be in first row col 0 with mergeDown = 2 (two empty cells below).
      const topLeftCell = table.rows[0][0];
      assert.equal(topLeftCell.text, 'Merged', 'top-left cell should contain "Merged"');
      assert.ok(
        topLeftCell.mergeDown >= 1,
        `mergeDown should be >= 1, got: ${topLeftCell.mergeDown}`,
      );
    });
  });

  describe('ruleless table', () => {
    it('detects a table with 2 columns from text clustering', async () => {
      // No lines, just text items in two X-clusters
      const textItems = [
        textItem('Name', 50, 200, 40, 10),
        textItem('Age', 200, 200, 20, 10),
        textItem('Alice', 50, 180, 40, 10),
        textItem('30', 200, 180, 15, 10),
        textItem('Bob', 50, 160, 30, 10),
        textItem('25', 200, 160, 15, 10),
      ];

      const page = mockPage({ fnArray: [], argsArray: [], textItems });
      const pdfDoc = mockPdfDoc([page]);
      const tables = await extractTables(pdfDoc, 1, { mode: 'ruleless' });

      assert.ok(tables.length > 0, 'should detect a table');
      const table = tables[0];
      assert.ok(table.rows.length >= 2, 'should have at least 2 rows');
      // Each row should have 2 cells (2 X-clusters)
      for (const row of table.rows) {
        assert.equal(row.length, 2, 'each row should have 2 columns');
      }
      assert.equal(table.ruled, false, 'should be marked as ruleless');
    });

    it('normalizes column count: different item counts per row produce same column count', async () => {
      // Row 1 has 3 items, row 2 has 2 items, row 3 has 3 items
      // After column normalization, all rows should have 3 columns (with empty padding)
      const textItems = [
        textItem('A', 50, 200, 20, 10),
        textItem('B', 200, 200, 20, 10),
        textItem('C', 350, 200, 20, 10),
        textItem('D', 50, 180, 20, 10),
        // skip column 2 for row 2
        textItem('F', 350, 180, 20, 10),
        textItem('G', 50, 160, 20, 10),
        textItem('H', 200, 160, 20, 10),
        textItem('I', 350, 160, 20, 10),
      ];

      const page = mockPage({ fnArray: [], argsArray: [], textItems });
      const pdfDoc = mockPdfDoc([page]);
      const tables = await extractTables(pdfDoc, 1, { mode: 'ruleless' });

      assert.ok(tables.length > 0, 'should detect a table');
      const table = tables[0];

      // All rows should have the same number of columns
      const colCounts = table.rows.map((r) => r.length);
      const uniqueCounts = [...new Set(colCounts)];
      assert.equal(uniqueCounts.length, 1, `all rows should have same column count, got: ${colCounts}`);
      assert.equal(uniqueCounts[0], 3, 'should have 3 columns');

      // The row missing column B should have an empty cell in that position
      // Row 2 (middle Y) is row index 1 after sorting by Y desc
      const middleRow = table.rows[1];
      const emptyCell = middleRow.find((c) => c.text === '');
      assert.ok(emptyCell, 'row with missing column should have an empty padded cell');
    });

    it('empty cells are padded correctly in ruleless mode', async () => {
      // 3 columns but first row only has text in cols 0 and 2
      const textItems = [
        textItem('Left', 50, 200, 20, 10),
        // no middle item in this row
        textItem('Right', 350, 200, 20, 10),
        textItem('A', 50, 180, 20, 10),
        textItem('B', 200, 180, 20, 10),
        textItem('C', 350, 180, 20, 10),
      ];

      const page = mockPage({ fnArray: [], argsArray: [], textItems });
      const pdfDoc = mockPdfDoc([page]);
      const tables = await extractTables(pdfDoc, 1, { mode: 'ruleless' });

      assert.ok(tables.length > 0, 'should detect a table');
      const table = tables[0];

      // All rows should have 3 columns
      for (const row of table.rows) {
        assert.equal(row.length, 3, `row should have 3 columns, got ${row.length}`);
      }

      // First row (highest Y = visual top) should have an empty cell in the middle
      const firstRow = table.rows[0];
      assert.equal(firstRow[1].text, '', 'middle cell of first row should be empty');
    });
  });

  describe('merged cell detection', () => {
    it('text spanning 2 columns produces mergeAcross', async () => {
      const xCoords = [50, 150, 250, 350];
      const yCoords = [100, 130, 160];
      const ops = gridOps(xCoords, yCoords);

      // A wide text item that spans from col 0 across col 1
      const textItems = [
        textItem('Wide Header', 55, 105, 195, 10), // spans from x=55 past x=150 to x=250
        textItem('Normal', 255, 105, 40, 10),
        textItem('R2C1', 55, 135, 40, 10),
        textItem('R2C2', 155, 135, 40, 10),
        textItem('R2C3', 255, 135, 40, 10),
      ];

      const page = mockPage({ ...ops, textItems });
      const pdfDoc = mockPdfDoc([page]);
      const tables = await extractTables(pdfDoc, 1, { mode: 'ruled' });

      assert.ok(tables.length > 0, 'should detect a table');
      const table = tables[0];
      // The first row, first cell should have mergeAcross
      const firstCell = table.rows[0][0];
      assert.ok(firstCell.mergeAcross >= 1, 'first cell should have mergeAcross >= 1');
    });
  });

  describe('no tables on page', () => {
    it('returns empty array when no lines and insufficient text', async () => {
      // Single text item (not enough for a table)
      const page = mockPage({
        fnArray: [],
        argsArray: [],
        textItems: [textItem('Just a paragraph', 50, 200, 100, 10)],
      });
      const pdfDoc = mockPdfDoc([page]);
      const tables = await extractTables(pdfDoc, 1);

      assert.deepEqual(tables, [], 'should return empty array');
    });

    it('returns empty array for empty page', async () => {
      const page = mockPage({ fnArray: [], argsArray: [], textItems: [] });
      const pdfDoc = mockPdfDoc([page]);
      const tables = await extractTables(pdfDoc, 1);

      assert.deepEqual(tables, []);
    });
  });

  describe('extractAllTables', () => {
    it('extracts tables from multiple pages', async () => {
      const xCoords = [50, 150, 250];
      const yCoords = [100, 130, 160];
      const ops = gridOps(xCoords, yCoords);

      const textItems = [
        textItem('A', 55, 105, 10, 10),
        textItem('B', 155, 105, 10, 10),
        textItem('C', 55, 135, 10, 10),
        textItem('D', 155, 135, 10, 10),
      ];

      const pageWithTable = mockPage({ ...ops, textItems });
      const emptyPage = mockPage({ fnArray: [], argsArray: [], textItems: [] });

      const pdfDoc = mockPdfDoc([pageWithTable, emptyPage, pageWithTable]);
      const result = await extractAllTables(pdfDoc);

      // Pages 1 and 3 should have tables, page 2 should not
      assert.ok(result.has(1), 'page 1 should have tables');
      assert.ok(!result.has(2), 'page 2 should not have tables');
      assert.ok(result.has(3), 'page 3 should have tables');
    });
  });
});
