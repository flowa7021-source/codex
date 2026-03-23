import './setup-dom.js';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  TableConversionPlugin,
  InvoiceTablePlugin,
  FinancialTablePlugin,
  ScientificTablePlugin,
  TimetablePlugin,
  TablePluginRegistry,
  tablePluginRegistry,
  convertTable,
} from '../../app/modules/table-conversion-plugins.js';

function mkRows(data) {
  return data.map(row => ({
    cells: row.map(text => ({ text: String(text), runs: [] })),
  }));
}

describe('TableConversionPlugin base', () => {
  it('detect returns false by default', () => {
    const plugin = new TableConversionPlugin();
    assert.strictEqual(plugin.detect([], {}), false);
  });

  it('getName returns BasePlugin', () => {
    assert.strictEqual(new TableConversionPlugin().getName(), 'BasePlugin');
  });
});

describe('InvoiceTablePlugin', () => {
  const plugin = new InvoiceTablePlugin();

  it('detects invoice table with qty/price headers and currency', () => {
    const rows = mkRows([
      ['Item', 'Qty', 'Price'],
      ['Widget', '5', '$100.00'],
      ['Gadget', '2', '$50.00'],
    ]);
    assert.strictEqual(plugin.detect(rows, {}), true);
  });

  it('does not detect generic data table', () => {
    const rows = mkRows([
      ['Name', 'Age', 'City'],
      ['Alice', '30', 'NYC'],
    ]);
    assert.strictEqual(plugin.detect(rows, {}), false);
  });

  it('converts invoice table with correct structure', () => {
    const rows = mkRows([
      ['Item', 'Qty', 'Price'],
      ['Widget', '5', '$100.00'],
      ['Total', '', '$150.00'],
    ]);
    const result = plugin.convert(rows, {});
    assert.strictEqual(result.type, 'table');
    assert.strictEqual(result.meta.plugin, 'InvoiceTable');
    assert.ok(result.rows[2].isTotal);
  });
});

describe('FinancialTablePlugin', () => {
  const plugin = new FinancialTablePlugin();

  it('detects financial table with keywords and numeric data', () => {
    const rows = mkRows([
      ['Category', '2023', '2024'],
      ['Revenue', '1,000,000', '1,200,000'],
      ['Expenses', '800,000', '900,000'],
      ['Net Income', '200,000', '300,000'],
    ]);
    assert.strictEqual(plugin.detect(rows, {}), true);
  });

  it('converts financial table', () => {
    const rows = mkRows([
      ['Category', 'Amount'],
      ['Revenue', '1,000'],
      ['Total', '1,000'],
    ]);
    const result = plugin.convert(rows, {});
    assert.strictEqual(result.type, 'table');
    assert.strictEqual(result.meta.plugin, 'FinancialTable');
  });
});

describe('ScientificTablePlugin', () => {
  const plugin = new ScientificTablePlugin();

  it('detects scientific table with unit rows', () => {
    const rows = mkRows([
      ['Parameter', 'Value', 'Error'],
      ['(mm)', '(mm)', '(mm)'],
      ['Length', '100.5', '0.3'],
      ['Width', '50.2', '0.1'],
    ]);
    assert.strictEqual(plugin.detect(rows, {}), true);
  });

  it('converts scientific table and strips footnote refs', () => {
    const rows = mkRows([
      ['Param', 'Value'],
      ['(mm)', '(mm)'],
      ['Length', '100.5*'],
      ['Width', '50.2'],
    ]);
    const result = plugin.convert(rows, {});
    assert.strictEqual(result.type, 'table');
    assert.strictEqual(result.meta.plugin, 'ScientificTable');
    // Footnote should be stripped from cell text
    const lengthCell = result.rows[2].cells[1];
    assert.ok(!lengthCell.text.includes('*'));
  });
});

describe('TimetablePlugin', () => {
  const plugin = new TimetablePlugin();

  it('detects timetable with day names in header', () => {
    const rows = mkRows([
      ['Time', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'],
      ['9:00', 'Math', 'English', 'Science', 'History'],
      ['10:00', 'Art', 'Math', 'English', 'Science'],
    ]);
    assert.strictEqual(plugin.detect(rows, {}), true);
  });

  it('converts timetable with correct structure', () => {
    const rows = mkRows([
      ['Time', 'Mon', 'Tue', 'Wed'],
      ['9:00', 'Math', 'English', 'Science'],
      ['10:00', 'Art', 'Math', 'English'],
    ]);
    const result = plugin.convert(rows, {});
    assert.strictEqual(result.type, 'table');
    assert.strictEqual(result.meta.plugin, 'Timetable');
  });
});

describe('TablePluginRegistry', () => {
  it('registers and lists plugins', () => {
    const reg = new TablePluginRegistry();
    reg.register(new InvoiceTablePlugin());
    assert.deepStrictEqual(reg.getPluginNames(), ['InvoiceTable']);
  });

  it('throws on invalid plugin', () => {
    const reg = new TablePluginRegistry();
    assert.throws(() => reg.register({}), TypeError);
  });

  it('unregisters plugins by name', () => {
    const reg = new TablePluginRegistry();
    reg.register(new InvoiceTablePlugin());
    reg.unregister('InvoiceTable');
    assert.deepStrictEqual(reg.getPluginNames(), []);
  });

  it('falls back to generic conversion when no plugin matches', () => {
    const reg = new TablePluginRegistry();
    const rows = mkRows([['A', 'B'], ['1', '2']]);
    const result = reg.convertTable(rows, {});
    assert.strictEqual(result.type, 'table');
    assert.strictEqual(result.meta.plugin, 'generic');
  });
});

describe('convertTable convenience function', () => {
  it('converts a table using the default registry', () => {
    const rows = mkRows([
      ['Item', 'Qty', 'Price'],
      ['Widget', '5', '$100.00'],
    ]);
    const result = convertTable(rows, {});
    assert.strictEqual(result.type, 'table');
    assert.ok(result.maxCols >= 3);
  });
});
