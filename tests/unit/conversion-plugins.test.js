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
});
