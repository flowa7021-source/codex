// --- Unit Tests: XlsxBuilder ---
import './setup-dom.js';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { unzipSync } from 'fflate';

import { XlsxBuilder } from '../../app/modules/xlsx-builder.js';

/**
 * Helper: build XLSX and extract a named file from the ZIP as a UTF-8 string.
 * @param {XlsxBuilder} builder
 * @param {string} path - path inside the ZIP, e.g. 'xl/worksheets/sheet1.xml'
 * @returns {Promise<string>}
 */
async function extractEntry(builder, path) {
  const bytes = await builder.build();
  const entries = unzipSync(bytes);
  const entry = entries[path];
  assert.ok(entry, `ZIP should contain ${path}`);
  return new TextDecoder().decode(entry);
}

/**
 * Helper: build XLSX and return all unzipped entries as { path: string-content }.
 * @param {XlsxBuilder} builder
 * @returns {Promise<Record<string, string>>}
 */
async function buildAndUnzip(builder) {
  const bytes = await builder.build();
  const entries = unzipSync(bytes);
  /** @type {Record<string, string>} */
  const result = {};
  for (const [path, data] of Object.entries(entries)) {
    result[path] = new TextDecoder().decode(data);
  }
  return result;
}

describe('XlsxBuilder', () => {
  describe('build() basics', () => {
    it('returns a Uint8Array', async () => {
      const builder = new XlsxBuilder();
      builder.addSheet('Sheet1', [['hello']]);
      const result = await builder.build();
      assert.ok(result instanceof Uint8Array, 'result should be Uint8Array');
    });

    it('returns non-empty output', async () => {
      const builder = new XlsxBuilder();
      builder.addSheet('Sheet1', [['hello']]);
      const result = await builder.build();
      assert.ok(result.length > 0, 'result should not be empty');
    });

    it('first two bytes are PK ZIP signature (0x50, 0x4B)', async () => {
      const builder = new XlsxBuilder();
      builder.addSheet('Sheet1', [['hello']]);
      const result = await builder.build();
      assert.equal(result[0], 0x50, 'first byte should be 0x50 (P)');
      assert.equal(result[1], 0x4B, 'second byte should be 0x4B (K)');
    });
  });

  describe('addSheet return value', () => {
    it('addSheet returns 0-based sheet index', () => {
      const builder = new XlsxBuilder();
      const idx0 = builder.addSheet('First', [['a']]);
      const idx1 = builder.addSheet('Second', [['b']]);
      const idx2 = builder.addSheet('Third', [['c']]);

      assert.equal(idx0, 0, 'first sheet should be index 0');
      assert.equal(idx1, 1, 'second sheet should be index 1');
      assert.equal(idx2, 2, 'third sheet should be index 2');
    });
  });

  describe('sheet with 3x3 data', () => {
    it('all cells are present in sheet XML', async () => {
      const builder = new XlsxBuilder();
      const rows = [
        ['A1', 'B1', 'C1'],
        ['A2', 'B2', 'C2'],
        ['A3', 'B3', 'C3'],
      ];
      builder.addSheet('Data', rows);

      const sheetXml = await extractEntry(builder, 'xl/worksheets/sheet1.xml');

      // 3 rows
      assert.ok(sheetXml.includes('r="1"'), 'row 1 should exist');
      assert.ok(sheetXml.includes('r="2"'), 'row 2 should exist');
      assert.ok(sheetXml.includes('r="3"'), 'row 3 should exist');

      // Cell references for all 9 cells
      for (const ref of ['A1', 'B1', 'C1', 'A2', 'B2', 'C2', 'A3', 'B3', 'C3']) {
        assert.ok(sheetXml.includes(`r="${ref}"`), `cell ${ref} should exist`);
      }
    });

    it('cell values appear in shared strings', async () => {
      const builder = new XlsxBuilder();
      builder.addSheet('Data', [['Alpha', 'Beta', 'Gamma']]);

      const sstXml = await extractEntry(builder, 'xl/sharedStrings.xml');
      assert.ok(sstXml.includes('Alpha'), 'shared strings should contain Alpha');
      assert.ok(sstXml.includes('Beta'), 'shared strings should contain Beta');
      assert.ok(sstXml.includes('Gamma'), 'shared strings should contain Gamma');
    });
  });

  describe('merged cells', () => {
    it('mergeArea is recorded in sheet XML', async () => {
      const builder = new XlsxBuilder();
      builder.addSheet('Merge', [['Spanning', '', ''], ['a', 'b', 'c']]);
      builder.mergeCells(0, 0, 0, 0, 2); // merge A1:C1

      const sheetXml = await extractEntry(builder, 'xl/worksheets/sheet1.xml');
      assert.ok(sheetXml.includes('<mergeCell'), 'should contain <mergeCell');
      assert.ok(sheetXml.includes('ref="A1:C1"'), 'merge range should be A1:C1');
    });

    it('mergeCells count attribute is set', async () => {
      const builder = new XlsxBuilder();
      builder.addSheet('Merge', [['a', 'b', 'c', 'd']]);
      builder.mergeCells(0, 0, 0, 0, 1);
      builder.mergeCells(0, 0, 2, 0, 3);

      const sheetXml = await extractEntry(builder, 'xl/worksheets/sheet1.xml');
      assert.ok(sheetXml.includes('count="2"'), 'mergeCells count should be 2');
    });
  });

  describe('setRowHeight', () => {
    it('produces customHeight="1" and ht= in row XML', async () => {
      const builder = new XlsxBuilder();
      builder.addSheet('Heights', [['row0'], ['row1'], ['row2']]);
      builder.setRowHeight(0, 1, 30); // row index 1, height 30 points

      const sheetXml = await extractEntry(builder, 'xl/worksheets/sheet1.xml');
      assert.ok(sheetXml.includes('customHeight="1"'), 'should contain customHeight="1"');
      assert.ok(sheetXml.includes('ht="30"'), 'should contain ht="30"');
    });

    it('rows without setRowHeight do not have ht attribute', async () => {
      const builder = new XlsxBuilder();
      builder.addSheet('Heights', [['row0'], ['row1']]);
      builder.setRowHeight(0, 0, 25);

      const sheetXml = await extractEntry(builder, 'xl/worksheets/sheet1.xml');
      // Row 1 (r="1") should have ht, row 2 (r="2") should not
      assert.ok(sheetXml.includes('ht="25"'), 'row 1 should have ht="25"');
      // Check that row 2 doesn't have customHeight
      const row2Match = sheetXml.match(/<row r="2"([^>]*)>/);
      assert.ok(row2Match, 'row 2 should exist');
      assert.ok(!row2Match[1].includes('customHeight'), 'row 2 should not have customHeight');
    });
  });

  describe('number format', () => {
    it('numeric string "42.5" is stored with type="n" (no t="s" attribute)', async () => {
      const builder = new XlsxBuilder();
      builder.addSheet('Nums', [['42.5']]);

      const sheetXml = await extractEntry(builder, 'xl/worksheets/sheet1.xml');
      // Numbers are written as <c r="A1"><v>42.5</v></c> without t="s"
      assert.ok(sheetXml.includes('<v>42.5</v>'), 'should contain numeric value 42.5');
      // The cell for A1 should NOT have t="s" (shared string marker)
      const cellMatch = sheetXml.match(/<c r="A1"[^>]*>/);
      assert.ok(cellMatch, 'cell A1 should exist');
      assert.ok(!cellMatch[0].includes('t="s"'), 'numeric cell should not have t="s"');
    });
  });

  describe('date format', () => {
    it('ISO date string is recognized as date with numFmt', async () => {
      const builder = new XlsxBuilder();
      builder.addSheet('Dates', [['2026-03-25']]);

      const sheetXml = await extractEntry(builder, 'xl/worksheets/sheet1.xml');
      // Date cells get a style index (s attribute) for the date format
      const cellMatch = sheetXml.match(/<c r="A1"([^>]*)>/);
      assert.ok(cellMatch, 'cell A1 should exist');
      assert.ok(cellMatch[1].includes('s='), 'date cell should have a style index');

      // Styles should include the dd.mm.yyyy format
      const stylesXml = await extractEntry(builder, 'xl/styles.xml');
      assert.ok(stylesXml.includes('dd.mm.yyyy'), 'styles should contain dd.mm.yyyy format');
    });

    it('Date object is serialized as Excel serial number', async () => {
      const builder = new XlsxBuilder();
      builder.addSheet('Dates', [[new Date('2026-03-25T00:00:00Z')]]);

      const sheetXml = await extractEntry(builder, 'xl/worksheets/sheet1.xml');
      // Should contain a numeric value (serial date), not a string
      const cellMatch = sheetXml.match(/<c r="A1"[^>]*>/);
      assert.ok(cellMatch, 'cell A1 should exist');
      assert.ok(!cellMatch[0].includes('t="s"'), 'date cell should not be a shared string');
    });

    it('"25.03.2026" (dd.mm.yyyy) is not auto-detected as date by xlsx-builder', async () => {
      // xlsx-builder's DATE_PATTERN only matches YYYY-MM-DD / YYYY/MM/DD format
      // "25.03.2026" does not match that pattern, so it will be treated as string
      const builder = new XlsxBuilder();
      builder.addSheet('Dates', [['25.03.2026']]);

      const sheetXml = await extractEntry(builder, 'xl/worksheets/sheet1.xml');
      // This will be a string since the auto-detect DATE_PATTERN doesn't match dd.mm.yyyy
      const cellMatch = sheetXml.match(/<c r="A1"[^>]*>/);
      assert.ok(cellMatch, 'cell A1 should exist');
      assert.ok(cellMatch[0].includes('t="s"'), '"25.03.2026" is treated as string by xlsx-builder');
    });
  });

  describe('currency format', () => {
    it('CellObject with number type and currency style is formatted correctly', async () => {
      const builder = new XlsxBuilder();
      builder.addSheet('Currency', [[{ value: 1250, type: 'number', style: { numberFormat: '#,##0.00\\ "$"' } }]]);

      const sheetXml = await extractEntry(builder, 'xl/worksheets/sheet1.xml');
      assert.ok(sheetXml.includes('<v>1250</v>'), 'should contain numeric value');

      const stylesXml = await extractEntry(builder, 'xl/styles.xml');
      assert.ok(stylesXml.includes('#,##0.00'), 'styles should contain currency number format');
    });

    it('CellObject with $#,##0.00 currency format is included in output', async () => {
      const builder = new XlsxBuilder();
      builder.addSheet('Currency', [[
        { value: 1250, type: 'number', style: { numberFormat: '$#,##0.00' } },
      ]]);

      const sheetXml = await extractEntry(builder, 'xl/worksheets/sheet1.xml');
      assert.ok(sheetXml.includes('<v>1250</v>'), 'should contain numeric value 1250');

      // Cell should have a style index applied
      const cellMatch = sheetXml.match(/<c r="A1"([^>]*)>/);
      assert.ok(cellMatch, 'cell A1 should exist');
      assert.ok(cellMatch[1].includes('s='), 'currency cell should have a style index');

      const stylesXml = await extractEntry(builder, 'xl/styles.xml');
      assert.ok(stylesXml.includes('$#,##0.00'), 'styles should contain $#,##0.00 format');
    });
  });

  describe('empty table', () => {
    it('empty rows produce a valid sheet without errors', async () => {
      const builder = new XlsxBuilder();
      builder.addSheet('Empty', []);

      const result = await builder.build();
      assert.ok(result instanceof Uint8Array, 'should return Uint8Array');
      assert.ok(result.length > 0, 'should not be empty');
      assert.equal(result[0], 0x50, 'should be valid ZIP');
      assert.equal(result[1], 0x4B, 'should be valid ZIP');
    });

    it('empty sheet contains sheetData element', async () => {
      const builder = new XlsxBuilder();
      builder.addSheet('Empty', []);

      const sheetXml = await extractEntry(builder, 'xl/worksheets/sheet1.xml');
      assert.ok(sheetXml.includes('<sheetData>'), 'should contain opening sheetData');
      assert.ok(sheetXml.includes('</sheetData>'), 'should contain closing sheetData');
    });

    it('no sheets at all still produces valid output', async () => {
      const builder = new XlsxBuilder();
      // build() with no sheets auto-creates Sheet1
      const result = await builder.build();
      assert.ok(result instanceof Uint8Array, 'should return Uint8Array');
      assert.equal(result[0], 0x50);
      assert.equal(result[1], 0x4B);

      const entries = unzipSync(result);
      assert.ok(entries['xl/worksheets/sheet1.xml'], 'default sheet should exist');
    });
  });

  describe('special characters', () => {
    it('&, <, > are XML-escaped in cell text', async () => {
      const builder = new XlsxBuilder();
      builder.addSheet('Special', [['Tom & Jerry', '<script>', 'a > b']]);

      const sstXml = await extractEntry(builder, 'xl/sharedStrings.xml');
      assert.ok(sstXml.includes('&amp;'), '& should be escaped to &amp;');
      assert.ok(sstXml.includes('&lt;'), '< should be escaped to &lt;');
      assert.ok(sstXml.includes('&gt;'), '> should be escaped to &gt;');
      // Must not contain unescaped versions in text content
      assert.ok(!sstXml.includes('<script>'), 'raw <script> should not appear');
    });

    it('quotes are XML-escaped in sheet names', async () => {
      const builder = new XlsxBuilder();
      builder.addSheet('Sheet "1"', [['data']]);

      const wbXml = await extractEntry(builder, 'xl/workbook.xml');
      assert.ok(wbXml.includes('&quot;'), 'quotes in sheet name should be escaped');
    });

    it('ampersand in cell does not produce raw & in shared strings', async () => {
      const builder = new XlsxBuilder();
      builder.addSheet('Esc', [['A & B']]);

      const sstXml = await extractEntry(builder, 'xl/sharedStrings.xml');
      // The raw "&" between A and B should appear as "&amp;" only
      assert.ok(sstXml.includes('A &amp; B'), 'should contain escaped ampersand');
    });
  });
});
