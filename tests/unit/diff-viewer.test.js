// ─── Unit Tests: diff-viewer ──────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  computeDiff,
  formatUnified,
  formatSideBySide,
  highlightChanges,
  countChanges,
} from '../../app/modules/diff-viewer.js';

// ─── computeDiff ─────────────────────────────────────────────────────────────

describe('computeDiff', () => {
  it('returns all equal lines for identical texts', () => {
    const result = computeDiff('a\nb\nc', 'a\nb\nc');
    assert.ok(result.lines.every((l) => l.type === 'equal'));
    assert.equal(result.stats.added, 0);
    assert.equal(result.stats.removed, 0);
    assert.equal(result.stats.unchanged, 3);
  });

  it('detects an inserted line', () => {
    const result = computeDiff('a\nb', 'a\nx\nb');
    const inserted = result.lines.filter((l) => l.type === 'insert');
    assert.equal(inserted.length, 1);
    assert.equal(inserted[0].content, 'x');
    assert.equal(result.stats.added, 1);
  });

  it('detects a deleted line', () => {
    const result = computeDiff('a\nb\nc', 'a\nc');
    const deleted = result.lines.filter((l) => l.type === 'delete');
    assert.equal(deleted.length, 1);
    assert.equal(deleted[0].content, 'b');
    assert.equal(result.stats.removed, 1);
  });

  it('detects a replaced line as delete + insert', () => {
    const result = computeDiff('hello', 'world');
    assert.equal(result.stats.removed, 1);
    assert.equal(result.stats.added, 1);
    assert.equal(result.stats.unchanged, 0);
  });

  it('handles empty old text (all inserts)', () => {
    const result = computeDiff('', 'a\nb\nc');
    assert.equal(result.stats.added, 3);
    assert.equal(result.stats.removed, 0);
    assert.equal(result.stats.unchanged, 0);
  });

  it('handles empty new text (all deletes)', () => {
    const result = computeDiff('a\nb\nc', '');
    assert.equal(result.stats.removed, 3);
    assert.equal(result.stats.added, 0);
    assert.equal(result.stats.unchanged, 0);
  });

  it('handles both texts empty', () => {
    const result = computeDiff('', '');
    assert.equal(result.lines.length, 0);
    assert.equal(result.stats.added, 0);
    assert.equal(result.stats.removed, 0);
    assert.equal(result.stats.unchanged, 0);
  });

  it('produces lines in the correct order', () => {
    const result = computeDiff('a\nb\nc', 'a\ny\nc');
    const contents = result.lines.map((l) => l.content);
    const firstA = contents.indexOf('a');
    const lastC = contents.lastIndexOf('c');
    assert.ok(firstA < lastC, 'a should come before c');
  });

  it('stats sum matches total lines in result', () => {
    const result = computeDiff('x\ny\nz', 'x\na\nb\nz');
    const { added, removed, unchanged } = result.stats;
    assert.equal(added + removed + unchanged, result.lines.length);
  });

  it('preserves equal lines that separate change blocks', () => {
    const result = computeDiff('a\nb\nc', 'x\nb\ny');
    const equalLines = result.lines.filter((l) => l.type === 'equal');
    assert.equal(equalLines.length, 1);
    assert.equal(equalLines[0].content, 'b');
  });
});

// ─── formatUnified ───────────────────────────────────────────────────────────

describe('formatUnified', () => {
  it('returns empty string for identical texts', () => {
    const diff = computeDiff('a\nb', 'a\nb');
    assert.equal(formatUnified(diff), '');
  });

  it('includes @@ hunk header', () => {
    const diff = computeDiff('a\nb', 'a\nc');
    const output = formatUnified(diff);
    assert.ok(output.includes('@@'));
  });

  it('prefixes inserted lines with +', () => {
    const diff = computeDiff('a', 'a\nb');
    const output = formatUnified(diff);
    assert.ok(output.includes('+b'));
  });

  it('prefixes deleted lines with -', () => {
    const diff = computeDiff('a\nb', 'a');
    const output = formatUnified(diff);
    assert.ok(output.includes('-b'));
  });

  it('prefixes context lines with space', () => {
    const diff = computeDiff('a\nb\nc', 'a\nx\nc');
    const output = formatUnified(diff);
    const lines = output.split('\n');
    const contextLines = lines.filter((l) => l.startsWith(' '));
    assert.ok(contextLines.length > 0);
  });

  it('respects custom context=0 (no surrounding lines)', () => {
    const diff = computeDiff('a\nb\nc\nd\ne', 'a\nb\nX\nd\ne');
    const output = formatUnified(diff, 0);
    const lines = output.split('\n');
    // With context=0 there should be no space-prefixed context lines
    const contextLines = lines.filter((l) => l.startsWith(' '));
    assert.equal(contextLines.length, 0);
  });

  it('returns empty string for empty diff', () => {
    const diff = computeDiff('', '');
    assert.equal(formatUnified(diff), '');
  });

  it('all-replacement diff contains both + and - lines', () => {
    const diff = computeDiff('foo', 'bar');
    const output = formatUnified(diff);
    assert.ok(output.includes('-foo'));
    assert.ok(output.includes('+bar'));
  });

  it('hunk header format matches @@ -a,b +c,d @@', () => {
    const diff = computeDiff('a\nb', 'a\nc');
    const output = formatUnified(diff);
    assert.match(output, /^@@ -\d+,\d+ \+\d+,\d+ @@/m);
  });
});

// ─── formatSideBySide ────────────────────────────────────────────────────────

describe('formatSideBySide', () => {
  it('left and right have equal length', () => {
    const diff = computeDiff('a\nb\nc', 'a\nx\nc');
    const { left, right } = formatSideBySide(diff);
    assert.equal(left.length, right.length);
  });

  it('equal lines appear on both sides', () => {
    const diff = computeDiff('same', 'same');
    const { left, right } = formatSideBySide(diff);
    assert.deepEqual(left, right);
    assert.equal(left[0], 'same');
  });

  it('deleted lines appear only on the left', () => {
    const diff = computeDiff('a\nb', 'a');
    const { left, right } = formatSideBySide(diff);
    // Find position where 'b' was deleted
    const idx = left.indexOf('b');
    assert.ok(idx >= 0, 'deleted line should appear on left');
    assert.equal(right[idx], '', 'right side should be empty for deleted line');
  });

  it('inserted lines appear only on the right', () => {
    const diff = computeDiff('a', 'a\nb');
    const { left, right } = formatSideBySide(diff);
    const idx = right.indexOf('b');
    assert.ok(idx >= 0, 'inserted line should appear on right');
    assert.equal(left[idx], '', 'left side should be empty for inserted line');
  });

  it('returns empty arrays for empty diff', () => {
    const diff = computeDiff('', '');
    const { left, right } = formatSideBySide(diff);
    assert.equal(left.length, 0);
    assert.equal(right.length, 0);
  });

  it('works for all-replacement', () => {
    const diff = computeDiff('old', 'new');
    const { left, right } = formatSideBySide(diff);
    assert.ok(left.includes('old'));
    assert.ok(right.includes('new'));
  });

  it('produces same length arrays for multi-line diff', () => {
    const diff = computeDiff('a\nb\nc\nd', 'a\nx\ny\nd');
    const { left, right } = formatSideBySide(diff);
    assert.equal(left.length, right.length);
  });

  it('contains all original lines on left side for pure deletion', () => {
    const diff = computeDiff('a\nb\nc', '');
    const { left, right } = formatSideBySide(diff);
    assert.deepEqual(left.filter((l) => l !== ''), ['a', 'b', 'c']);
    assert.ok(right.every((r) => r === ''));
  });
});

// ─── highlightChanges ────────────────────────────────────────────────────────

describe('highlightChanges', () => {
  it('returns the line unchanged when line equals oldLine', () => {
    assert.equal(highlightChanges('hello', 'hello'), 'hello');
  });

  it('wraps the entire line in [+…+] when oldLine is empty', () => {
    assert.equal(highlightChanges('new', ''), '[+new+]');
  });

  it('wraps entire old content in [-…-] when line is empty', () => {
    assert.equal(highlightChanges('', 'old'), '[-old-]');
  });

  it('marks inserted characters with [+…+]', () => {
    const result = highlightChanges('hello world', 'hello');
    assert.ok(result.includes('[+'), 'should contain insert marker');
  });

  it('marks deleted characters with [-…-]', () => {
    const result = highlightChanges('hello', 'hello world');
    assert.ok(result.includes('[-'), 'should contain delete marker');
  });

  it('preserves common prefix outside markers', () => {
    const result = highlightChanges('foobar', 'foobaz');
    // 'fooba' is common, only 'r' vs 'z' differs
    assert.ok(result.startsWith('fooba'), 'common prefix should be unmarked');
  });

  it('handles completely different strings', () => {
    const result = highlightChanges('xyz', 'abc');
    assert.ok(result.includes('[-') || result.includes('[+'));
  });

  it('returns a string type', () => {
    const result = highlightChanges('a', 'b');
    assert.equal(typeof result, 'string');
  });
});

// ─── countChanges ────────────────────────────────────────────────────────────

describe('countChanges', () => {
  it('returns zero added and removed for identical texts', () => {
    const diff = computeDiff('a\nb', 'a\nb');
    assert.deepEqual(countChanges(diff), { added: 0, removed: 0 });
  });

  it('counts added lines correctly', () => {
    const diff = computeDiff('a', 'a\nb\nc');
    assert.equal(countChanges(diff).added, 2);
  });

  it('counts removed lines correctly', () => {
    const diff = computeDiff('a\nb\nc', 'a');
    assert.equal(countChanges(diff).removed, 2);
  });

  it('counts both added and removed in a mixed diff', () => {
    const diff = computeDiff('a\nb', 'c\nd');
    const counts = countChanges(diff);
    assert.equal(counts.added, 2);
    assert.equal(counts.removed, 2);
  });

  it('returns zero for empty texts', () => {
    const diff = computeDiff('', '');
    assert.deepEqual(countChanges(diff), { added: 0, removed: 0 });
  });

  it('matches stats from the diff result', () => {
    const diff = computeDiff('x\ny\nz', 'x\na\nb\nz');
    const counts = countChanges(diff);
    assert.equal(counts.added, diff.stats.added);
    assert.equal(counts.removed, diff.stats.removed);
  });

  it('handles single-line replacement', () => {
    const diff = computeDiff('old', 'new');
    const counts = countChanges(diff);
    assert.equal(counts.added, 1);
    assert.equal(counts.removed, 1);
  });

  it('counts all-insert diff', () => {
    const diff = computeDiff('', 'a\nb\nc');
    assert.equal(countChanges(diff).added, 3);
    assert.equal(countChanges(diff).removed, 0);
  });
});
