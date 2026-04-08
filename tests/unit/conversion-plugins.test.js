import './setup-dom.js';
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  getPlugin,
  getAllPlugins,
  registerPlugin,
  detectApplicablePlugins,
  applyPlugin,
  pluginToDocxXml,
} from '../../app/modules/conversion-plugins.js';

describe('getPlugin', () => {
  it('returns invoice plugin by id', () => {
    const p = getPlugin('invoice');
    assert.ok(p);
    assert.equal(p.id, 'invoice');
  });

  it('returns null for unknown id', () => {
    assert.equal(getPlugin('nonexistent'), null);
  });
});

describe('getAllPlugins', () => {
  it('returns at least 3 built-in plugins', () => {
    const all = getAllPlugins();
    assert.ok(all.length >= 3);
  });
});

describe('registerPlugin', () => {
  it('adds a custom plugin', () => {
    registerPlugin({ id: 'test-plugin', name: 'Test', detect() { return false; }, transform(t) { return t; }, toDocxXml() { return null; } });
    assert.ok(getPlugin('test-plugin'));
  });
});

describe('detectApplicablePlugins', () => {
  it('detects invoice text', () => {
    const text = 'Invoice #123\nTotal amount: $500\nQty: 10';
    const plugins = detectApplicablePlugins(text);
    assert.ok(plugins.some(p => p.id === 'invoice'));
  });

  it('detects report text', () => {
    const text = 'Report Summary\nSection 1\nResults and conclusion';
    const plugins = detectApplicablePlugins(text);
    assert.ok(plugins.some(p => p.id === 'report'));
  });

  it('returns empty for non-matching text', () => {
    const plugins = detectApplicablePlugins('just some random text');
    assert.ok(Array.isArray(plugins));
  });

  it('returns empty for null/empty', () => {
    assert.deepEqual(detectApplicablePlugins(''), []);
    assert.deepEqual(detectApplicablePlugins(null), []);
  });
});

describe('applyPlugin', () => {
  it('transforms invoice text with table markers', () => {
    const text = 'Item\tQty\tPrice\nWidget\t10\t12.50\nGadget\t5\t25.00';
    const result = applyPlugin('invoice', text);
    assert.ok(result.includes('|'));
  });

  it('returns original text for unknown plugin', () => {
    assert.equal(applyPlugin('unknown', 'hello'), 'hello');
  });
});

describe('pluginToDocxXml', () => {
  it('generates XML for invoice plugin', () => {
    const text = '| A | B |\n| 1 | 2 |';
    const xml = pluginToDocxXml('invoice', text);
    assert.ok(xml);
    assert.ok(xml.includes('<w:tbl>'));
  });

  it('returns null for unknown plugin', () => {
    assert.equal(pluginToDocxXml('unknown', 'text'), null);
  });

  it('report plugin generates heading XML', () => {
    const text = '## SUMMARY\nSome body text';
    const xml = pluginToDocxXml('report', text);
    assert.ok(xml);
    assert.ok(xml.includes('Heading2'));
  });

  it('report plugin generates Heading3 XML for ### lines', () => {
    const text = '### Sub-heading\nBody content';
    const xml = pluginToDocxXml('report', text);
    assert.ok(xml);
    assert.ok(xml.includes('Heading3'));
    assert.ok(xml.includes('Sub-heading'));
  });

  it('report plugin handles plain text lines (not heading)', () => {
    const text = 'Just plain text without any heading markers';
    const xml = pluginToDocxXml('report', text);
    assert.ok(xml);
    assert.ok(xml.includes('Just plain text'));
    assert.ok(!xml.includes('Heading'));
  });

  it('custom-table plugin is detectable via detectApplicablePlugins', () => {
    const tabData = 'Name\tAge\tCity\nAlice\t30\tNYC\nBob\t25\tLA\nCarol\t35\tSF';
    const plugins = detectApplicablePlugins(tabData);
    assert.ok(plugins.some(p => p.id === 'custom-table'));
  });

  it('custom-table plugin transform produces pipe-separated output', () => {
    const text = 'Col1\tCol2\tCol3\nA\tB\tC\nX\tY\tZ';
    const result = applyPlugin('custom-table', text);
    assert.ok(result.includes('|'));
    assert.ok(result.includes('Col1'));
  });

  it('custom-table toDocxXml delegates to InvoicePlugin', () => {
    const text = '| Header1 | Header2 |\n| val1 | val2 |';
    const xml = pluginToDocxXml('custom-table', text);
    assert.ok(xml);
    assert.ok(xml.includes('<w:tbl>'));
  });

  it('custom-table transform handles single-cell lines as plain text', () => {
    const text = 'Only one cell here\nAnother single line';
    const result = applyPlugin('custom-table', text);
    assert.ok(result.includes('Only one cell here'));
    assert.ok(!result.includes('|'));
  });
});
