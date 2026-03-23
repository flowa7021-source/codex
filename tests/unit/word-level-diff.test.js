import './setup-dom.js';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { diffWords, diffChars, diffLines, renderDiffHtml, DiffViewer } from '../../app/modules/word-level-diff.js';

describe('diffWords', () => {
  it('returns all equal for identical strings', () => {
    const result = diffWords('hello world', 'hello world');
    assert.strictEqual(result.stats.equal, result.stats.totalA);
    assert.strictEqual(result.stats.inserted, 0);
    assert.strictEqual(result.stats.deleted, 0);
  });

  it('detects inserted words', () => {
    const result = diffWords('hello world', 'hello beautiful world');
    assert.ok(result.stats.inserted > 0 || result.stats.replaced > 0);
    assert.ok(result.chunks.length > 0);
  });

  it('detects deleted words', () => {
    const result = diffWords('hello beautiful world', 'hello world');
    assert.ok(result.stats.deleted > 0 || result.stats.replaced > 0);
  });

  it('detects replaced words', () => {
    const result = diffWords('the cat sat', 'the dog sat');
    const hasReplace = result.chunks.some(c => c.op === 'replace');
    const hasDeleteInsert = result.chunks.some(c => c.op === 'delete') || result.chunks.some(c => c.op === 'insert');
    assert.ok(hasReplace || hasDeleteInsert);
  });

  it('handles empty strings', () => {
    const result = diffWords('', '');
    assert.strictEqual(result.chunks.length, 0);
    assert.strictEqual(result.stats.totalA, 0);
    assert.strictEqual(result.stats.totalB, 0);
  });

  it('handles one empty string', () => {
    const result = diffWords('hello', '');
    assert.ok(result.stats.deleted > 0);
    assert.strictEqual(result.stats.totalB, 0);
  });
});

describe('diffChars', () => {
  it('detects character-level changes', () => {
    const result = diffChars('cat', 'car');
    assert.ok(result.chunks.length > 0);
    const changed = result.chunks.filter(c => c.op !== 'equal');
    assert.ok(changed.length > 0);
  });

  it('returns all equal for identical strings', () => {
    const result = diffChars('abc', 'abc');
    assert.strictEqual(result.stats.equal, 3);
  });
});

describe('diffLines', () => {
  it('detects line-level insertions', () => {
    const result = diffLines('line1\nline2', 'line1\nnewline\nline2');
    assert.ok(result.stats.inserted > 0);
  });

  it('handles identical multi-line text', () => {
    const result = diffLines('a\nb\nc', 'a\nb\nc');
    assert.strictEqual(result.stats.equal, 3);
    assert.strictEqual(result.stats.inserted, 0);
    assert.strictEqual(result.stats.deleted, 0);
  });
});

describe('renderDiffHtml', () => {
  it('renders inline HTML for a diff result', () => {
    const result = diffWords('hello world', 'hello earth');
    const html = renderDiffHtml(result);
    assert.ok(html.includes('<div'));
    assert.ok(html.includes('hello'));
  });

  it('renders side-by-side HTML', () => {
    const result = diffWords('hello world', 'hello world');
    const html = renderDiffHtml(result, { mode: 'side-by-side' });
    assert.ok(html.includes('display:flex'));
  });

  it('escapes HTML entities', () => {
    const result = diffWords('<script>', '<script>');
    const html = renderDiffHtml(result);
    assert.ok(!html.includes('<script>'));
    assert.ok(html.includes('&lt;script&gt;'));
  });
});

describe('DiffViewer', () => {
  it('creates and removes a panel on show/close', () => {
    const container = document.createElement('div');
    const viewer = new DiffViewer(container);
    const result = diffWords('a', 'b');
    viewer.show(result);
    assert.strictEqual(container.children.length, 1);
    viewer.close();
    assert.strictEqual(container.children.length, 0);
  });

  it('switches mode via setMode', () => {
    const container = document.createElement('div');
    const viewer = new DiffViewer(container);
    const result = diffWords('hello world', 'hello world');
    viewer.show(result);
    viewer.setMode('side-by-side');
    // Panel should have been re-rendered
    assert.strictEqual(container.children.length, 1);
    viewer.close();
  });
});
