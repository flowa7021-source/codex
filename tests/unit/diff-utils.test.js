// ─── Unit Tests: diff-utils ───────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  diffLines,
  diffWords,
  diffChars,
  formatUnifiedDiff,
  diffStats,
  applyDiff,
  isDiffEmpty,
} from '../../app/modules/diff-utils.js';

// ─── diffLines ────────────────────────────────────────────────────────────────

describe('diffLines', () => {
  it('identical strings produce only equal chunks', () => {
    const chunks = diffLines('foo\nbar\n', 'foo\nbar\n');
    assert.ok(chunks.every(c => c.op === 'equal'), 'all chunks should be equal');
  });

  it('returns empty array for two empty strings', () => {
    const chunks = diffLines('', '');
    assert.deepEqual(chunks, []);
  });

  it('addition produces an insert chunk', () => {
    const chunks = diffLines('foo\n', 'foo\nbar\n');
    const ops = chunks.map(c => c.op);
    assert.ok(ops.includes('insert'), 'should have an insert chunk');
    assert.ok(!ops.includes('delete'), 'should not have a delete chunk');
    const inserted = chunks.filter(c => c.op === 'insert').map(c => c.text).join('');
    assert.ok(inserted.includes('bar'), 'inserted text should contain the new line');
  });

  it('deletion produces a delete chunk', () => {
    const chunks = diffLines('foo\nbar\n', 'foo\n');
    const ops = chunks.map(c => c.op);
    assert.ok(ops.includes('delete'), 'should have a delete chunk');
    assert.ok(!ops.includes('insert'), 'should not have an insert chunk');
    const deleted = chunks.filter(c => c.op === 'delete').map(c => c.text).join('');
    assert.ok(deleted.includes('bar'), 'deleted text should contain the removed line');
  });

  it('changed line produces both delete and insert chunks', () => {
    const chunks = diffLines('hello\n', 'world\n');
    const ops = chunks.map(c => c.op);
    assert.ok(ops.includes('delete'));
    assert.ok(ops.includes('insert'));
  });

  it('new text from chunks reconstructs the new text', () => {
    const oldText = 'line1\nline2\nline3\n';
    const newText = 'line1\nlineX\nline3\n';
    const chunks = diffLines(oldText, newText);
    const reconstructed = applyDiff(chunks);
    assert.equal(reconstructed, newText);
  });
});

// ─── diffWords ────────────────────────────────────────────────────────────────

describe('diffWords', () => {
  it('identical strings produce only equal chunks', () => {
    const chunks = diffWords('hello world', 'hello world');
    assert.ok(chunks.every(c => c.op === 'equal'));
  });

  it('word substitution produces delete and insert', () => {
    const chunks = diffWords('hello world', 'hello earth');
    const ops = chunks.map(c => c.op);
    assert.ok(ops.includes('delete'));
    assert.ok(ops.includes('insert'));
  });

  it('added word produces insert chunk', () => {
    const chunks = diffWords('foo bar', 'foo baz bar');
    const ops = chunks.map(c => c.op);
    assert.ok(ops.includes('insert'));
  });

  it('reconstructed text matches new text', () => {
    const oldText = 'the quick brown fox';
    const newText = 'the slow brown fox';
    const chunks = diffWords(oldText, newText);
    assert.equal(applyDiff(chunks), newText);
  });

  it('empty strings produce no chunks', () => {
    assert.deepEqual(diffWords('', ''), []);
  });
});

// ─── diffChars ────────────────────────────────────────────────────────────────

describe('diffChars', () => {
  it('identical strings produce only equal chunks', () => {
    const chunks = diffChars('abc', 'abc');
    assert.ok(chunks.every(c => c.op === 'equal'));
  });

  it('single character change produces delete and insert', () => {
    const chunks = diffChars('abc', 'axc');
    const ops = chunks.map(c => c.op);
    assert.ok(ops.includes('delete'));
    assert.ok(ops.includes('insert'));
  });

  it('inserted characters produce insert chunks', () => {
    const chunks = diffChars('ac', 'abc');
    const inserted = chunks.filter(c => c.op === 'insert').map(c => c.text).join('');
    assert.equal(inserted, 'b');
  });

  it('deleted characters produce delete chunks', () => {
    const chunks = diffChars('abc', 'ac');
    const deleted = chunks.filter(c => c.op === 'delete').map(c => c.text).join('');
    assert.equal(deleted, 'b');
  });

  it('reconstructed text matches new text', () => {
    const old = 'Hello, World!';
    const newStr = 'Hello, TypeScript!';
    const chunks = diffChars(old, newStr);
    assert.equal(applyDiff(chunks), newStr);
  });

  it('empty strings produce no chunks', () => {
    assert.deepEqual(diffChars('', ''), []);
  });
});

// ─── formatUnifiedDiff ────────────────────────────────────────────────────────

describe('formatUnifiedDiff', () => {
  it('contains + prefix for inserted lines', () => {
    const chunks = diffLines('foo\n', 'foo\nbar\n');
    const unified = formatUnifiedDiff(chunks);
    assert.ok(unified.includes('+bar'), 'should contain +bar');
  });

  it('contains - prefix for deleted lines', () => {
    const chunks = diffLines('foo\nbar\n', 'foo\n');
    const unified = formatUnifiedDiff(chunks);
    assert.ok(unified.includes('-bar'), 'should contain -bar');
  });

  it('contains @@ hunk header', () => {
    const chunks = diffLines('a\n', 'b\n');
    const unified = formatUnifiedDiff(chunks);
    assert.ok(unified.includes('@@'), 'should contain @@ hunk header');
  });

  it('returns empty string for identical content', () => {
    const chunks = diffLines('foo\nbar\n', 'foo\nbar\n');
    assert.equal(formatUnifiedDiff(chunks), '');
  });

  it('context lines are prefixed with space', () => {
    const chunks = diffLines('ctx\nold\nctx\n', 'ctx\nnew\nctx\n');
    const unified = formatUnifiedDiff(chunks, 1);
    const lines = unified.split('\n').filter(l => !l.startsWith('@@'));
    const contextLines = lines.filter(l => l.startsWith(' '));
    assert.ok(contextLines.length > 0, 'should have context lines');
  });
});

// ─── diffStats ────────────────────────────────────────────────────────────────

describe('diffStats', () => {
  it('returns zero counts for identical strings', () => {
    const chunks = diffChars('hello', 'hello');
    const stats = diffStats(chunks);
    assert.equal(stats.insertions, 0);
    assert.equal(stats.deletions, 0);
    assert.equal(stats.unchanged, 5);
  });

  it('counts inserted characters correctly', () => {
    const chunks = diffChars('ac', 'abc');
    const stats = diffStats(chunks);
    assert.equal(stats.insertions, 1);
    assert.equal(stats.deletions, 0);
  });

  it('counts deleted characters correctly', () => {
    const chunks = diffChars('abc', 'ac');
    const stats = diffStats(chunks);
    assert.equal(stats.deletions, 1);
    assert.equal(stats.insertions, 0);
  });

  it('counts unchanged characters correctly', () => {
    const chunks = diffChars('abcd', 'axcd');
    const stats = diffStats(chunks);
    // 'a', 'c', 'd' are unchanged = 3; 'b' deleted = 1; 'x' inserted = 1
    assert.equal(stats.unchanged, 3);
    assert.equal(stats.insertions, 1);
    assert.equal(stats.deletions, 1);
  });

  it('handles empty diff', () => {
    const stats = diffStats([]);
    assert.equal(stats.insertions, 0);
    assert.equal(stats.deletions, 0);
    assert.equal(stats.unchanged, 0);
  });
});

// ─── applyDiff ────────────────────────────────────────────────────────────────

describe('applyDiff', () => {
  it('reconstructs new text from line diff', () => {
    const oldText = 'line1\nline2\nline3\n';
    const newText = 'line1\nlineX\nline3\n';
    const chunks = diffLines(oldText, newText);
    assert.equal(applyDiff(chunks), newText);
  });

  it('reconstructs new text from word diff', () => {
    const oldText = 'the quick brown fox';
    const newText = 'the slow brown fox';
    const chunks = diffWords(oldText, newText);
    assert.equal(applyDiff(chunks), newText);
  });

  it('reconstructs new text from char diff', () => {
    const oldText = 'Hello World';
    const newText = 'Hello TypeScript';
    const chunks = diffChars(oldText, newText);
    assert.equal(applyDiff(chunks), newText);
  });

  it('returns empty string for empty diff', () => {
    assert.equal(applyDiff([]), '');
  });

  it('returns new text unchanged when old equals new', () => {
    const text = 'unchanged content';
    const chunks = diffChars(text, text);
    assert.equal(applyDiff(chunks), text);
  });
});

// ─── isDiffEmpty ──────────────────────────────────────────────────────────────

describe('isDiffEmpty', () => {
  it('returns true for identical strings', () => {
    const chunks = diffLines('foo\nbar\n', 'foo\nbar\n');
    assert.equal(isDiffEmpty(chunks), true);
  });

  it('returns true for empty diff array', () => {
    assert.equal(isDiffEmpty([]), true);
  });

  it('returns false when there are insertions', () => {
    const chunks = diffLines('foo\n', 'foo\nbar\n');
    assert.equal(isDiffEmpty(chunks), false);
  });

  it('returns false when there are deletions', () => {
    const chunks = diffLines('foo\nbar\n', 'foo\n');
    assert.equal(isDiffEmpty(chunks), false);
  });

  it('returns false for char-level changes', () => {
    const chunks = diffChars('abc', 'axc');
    assert.equal(isDiffEmpty(chunks), false);
  });
});
