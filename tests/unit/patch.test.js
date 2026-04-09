// ─── Unit Tests: patch ────────────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  createPatch,
  applyPatch,
  serializePatch,
  parsePatch,
  invertPatch,
  canApplyPatch,
} from '../../app/modules/patch.js';

// ─── createPatch ──────────────────────────────────────────────────────────────

describe('createPatch', () => {
  it('returns a Patch object with version 1', () => {
    const patch = createPatch('old\n', 'new\n');
    assert.equal(patch.version, 1);
    assert.ok(Array.isArray(patch.hunks));
  });

  it('produces hunks when texts differ', () => {
    const patch = createPatch('foo\nbar\n', 'foo\nbaz\n');
    assert.ok(patch.hunks.length > 0);
  });

  it('produces no hunks for identical texts', () => {
    const patch = createPatch('same\ntext\n', 'same\ntext\n');
    assert.equal(patch.hunks.length, 0);
  });

  it('hunk has correct oldStart, oldLines, newStart, newLines', () => {
    const patch = createPatch('line1\nline2\nline3\n', 'line1\nlineX\nline3\n');
    assert.ok(patch.hunks.length > 0);
    const hunk = patch.hunks[0];
    assert.ok(typeof hunk.oldStart === 'number');
    assert.ok(typeof hunk.oldLines === 'number');
    assert.ok(typeof hunk.newStart === 'number');
    assert.ok(typeof hunk.newLines === 'number');
  });

  it('hunk lines contain + and - prefixed lines for changes', () => {
    const patch = createPatch('foo\nbar\n', 'foo\nbaz\n');
    const allLines = patch.hunks.flatMap(h => h.lines);
    assert.ok(allLines.some(l => l.startsWith('+')));
    assert.ok(allLines.some(l => l.startsWith('-')));
  });

  it('context lines have space prefix', () => {
    const patch = createPatch('ctx\nold\nctx\n', 'ctx\nnew\nctx\n', 1);
    const allLines = patch.hunks.flatMap(h => h.lines);
    assert.ok(allLines.some(l => l.startsWith(' ')));
  });
});

// ─── applyPatch ───────────────────────────────────────────────────────────────

describe('applyPatch', () => {
  it('produces the correct new text', () => {
    const oldText = 'foo\nbar\nbaz\n';
    const newText = 'foo\nQUX\nbaz\n';
    const patch = createPatch(oldText, newText);
    const result = applyPatch(oldText, patch);
    assert.equal(result, newText);
  });

  it('returns null for a patch that does not apply cleanly', () => {
    const patch = createPatch('foo\nbar\n', 'foo\nbaz\n');
    const result = applyPatch('completely different\ntext\n', patch);
    assert.equal(result, null);
  });

  it('returns original text unchanged when patch has no hunks', () => {
    const text = 'unchanged\n';
    const patch = createPatch(text, text);
    const result = applyPatch(text, patch);
    assert.equal(result, text);
  });

  it('applies patch with multiple hunks', () => {
    const oldText = 'a\nb\nc\nd\ne\nf\ng\nh\ni\nj\n';
    const newText = 'a\nB\nc\nd\ne\nf\ng\nh\nI\nj\n';
    const patch = createPatch(oldText, newText, 1);
    const result = applyPatch(oldText, patch);
    assert.equal(result, newText);
  });

  it('roundtrip: createPatch + applyPatch reconstructs new text', () => {
    const oldText = 'The quick brown fox\njumps over the lazy dog\n';
    const newText = 'The slow green fox\njumps over the happy dog\n';
    const patch = createPatch(oldText, newText);
    assert.equal(applyPatch(oldText, patch), newText);
  });
});

// ─── serializePatch ───────────────────────────────────────────────────────────

describe('serializePatch', () => {
  it('contains @@ hunk headers', () => {
    const patch = createPatch('old\n', 'new\n');
    const serialized = serializePatch(patch);
    assert.ok(serialized.includes('@@'));
  });

  it('contains + lines for insertions', () => {
    const patch = createPatch('foo\n', 'foo\nbar\n');
    const serialized = serializePatch(patch);
    assert.ok(serialized.includes('+bar'));
  });

  it('contains - lines for deletions', () => {
    const patch = createPatch('foo\nbar\n', 'foo\n');
    const serialized = serializePatch(patch);
    assert.ok(serialized.includes('-bar'));
  });

  it('returns empty string for empty patch', () => {
    const patch = createPatch('same\n', 'same\n');
    assert.equal(serializePatch(patch), '');
  });

  it('hunk header format is @@ -old,count +new,count @@', () => {
    const patch = createPatch('a\nb\nc\n', 'a\nX\nc\n');
    const serialized = serializePatch(patch);
    assert.ok(/@@\s+-\d+,\d+\s+\+\d+,\d+\s+@@/.test(serialized));
  });
});

// ─── parsePatch ───────────────────────────────────────────────────────────────

describe('parsePatch', () => {
  it('roundtrip with serializePatch preserves hunks', () => {
    const oldText = 'line1\nline2\nline3\n';
    const newText = 'line1\nlineX\nline3\n';
    const patch = createPatch(oldText, newText);
    const serialized = serializePatch(patch);
    const parsed = parsePatch(serialized);
    assert.ok(parsed !== null);
    assert.equal(parsed.version, 1);
    assert.equal(parsed.hunks.length, patch.hunks.length);
    assert.deepEqual(parsed.hunks[0].lines, patch.hunks[0].lines);
  });

  it('parsed patch oldStart/oldLines/newStart/newLines match original', () => {
    const patch = createPatch('a\nb\nc\n', 'a\nX\nc\n');
    const serialized = serializePatch(patch);
    const parsed = parsePatch(serialized);
    assert.ok(parsed !== null);
    assert.equal(parsed.hunks[0].oldStart, patch.hunks[0].oldStart);
    assert.equal(parsed.hunks[0].oldLines, patch.hunks[0].oldLines);
    assert.equal(parsed.hunks[0].newStart, patch.hunks[0].newStart);
    assert.equal(parsed.hunks[0].newLines, patch.hunks[0].newLines);
  });

  it('returns null for input that has no hunk headers at all', () => {
    // A string with no @@ at all — not a valid unified diff
    const result = parsePatch('this is not a patch at all');
    assert.equal(result, null);
  });

  it('returns patch with empty hunks for empty string', () => {
    const result = parsePatch('');
    assert.ok(result !== null);
    assert.equal(result.hunks.length, 0);
  });
});

// ─── invertPatch ──────────────────────────────────────────────────────────────

describe('invertPatch', () => {
  it('swaps + and - lines', () => {
    const patch = createPatch('foo\nbar\n', 'foo\nbaz\n');
    const inverted = invertPatch(patch);
    const allLines = inverted.hunks.flatMap(h => h.lines);
    const original = patch.hunks.flatMap(h => h.lines);

    // Find original + lines (insertions) — they should become - in inverted
    const originalInserts = original.filter(l => l.startsWith('+'));
    const invertedDeletes = allLines.filter(l => l.startsWith('-'));
    assert.deepEqual(
      originalInserts.map(l => l.slice(1)),
      invertedDeletes.map(l => l.slice(1)),
    );

    // Find original - lines (deletions) — they should become + in inverted
    const originalDeletes = original.filter(l => l.startsWith('-'));
    const invertedInserts = allLines.filter(l => l.startsWith('+'));
    assert.deepEqual(
      originalDeletes.map(l => l.slice(1)),
      invertedInserts.map(l => l.slice(1)),
    );
  });

  it('swaps oldStart/oldLines with newStart/newLines', () => {
    const patch = createPatch('a\nb\n', 'a\nc\n');
    const inverted = invertPatch(patch);
    assert.equal(inverted.hunks[0].oldStart, patch.hunks[0].newStart);
    assert.equal(inverted.hunks[0].newStart, patch.hunks[0].oldStart);
    assert.equal(inverted.hunks[0].oldLines, patch.hunks[0].newLines);
    assert.equal(inverted.hunks[0].newLines, patch.hunks[0].oldLines);
  });

  it('applying inverted patch reverses the change', () => {
    const oldText = 'foo\nbar\nbaz\n';
    const newText = 'foo\nQUX\nbaz\n';
    const patch = createPatch(oldText, newText);
    const inverted = invertPatch(patch);
    // Apply original then apply inverted should give back old text
    const applied = applyPatch(oldText, patch);
    assert.equal(applied, newText);
    const reverted = applyPatch(newText, inverted);
    assert.equal(reverted, oldText);
  });

  it('context lines remain unchanged after inversion', () => {
    const patch = createPatch('ctx\nold\nctx\n', 'ctx\nnew\nctx\n', 1);
    const inverted = invertPatch(patch);
    const origContext = patch.hunks.flatMap(h => h.lines).filter(l => l.startsWith(' '));
    const invContext = inverted.hunks.flatMap(h => h.lines).filter(l => l.startsWith(' '));
    assert.deepEqual(origContext, invContext);
  });
});

// ─── canApplyPatch ────────────────────────────────────────────────────────────

describe('canApplyPatch', () => {
  it('returns true when patch applies cleanly', () => {
    const oldText = 'foo\nbar\nbaz\n';
    const newText = 'foo\nQUX\nbaz\n';
    const patch = createPatch(oldText, newText);
    assert.equal(canApplyPatch(oldText, patch), true);
  });

  it('returns false for mismatched text', () => {
    const patch = createPatch('foo\nbar\n', 'foo\nbaz\n');
    assert.equal(canApplyPatch('completely different\ncontent\n', patch), false);
  });

  it('returns true for empty patch on any text', () => {
    const patch = createPatch('same\n', 'same\n');
    assert.equal(canApplyPatch('any text here\n', patch), true);
  });

  it('returns false when target text is wrong for the patch context', () => {
    const patch = createPatch('aaa\nbbb\nccc\n', 'aaa\nXXX\nccc\n');
    // Provide text where the context line differs
    assert.equal(canApplyPatch('zzz\nbbb\nccc\n', patch), false);
  });
});
