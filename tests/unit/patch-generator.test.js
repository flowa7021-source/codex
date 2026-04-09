// ─── Unit Tests: patch-generator ─────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  createPatch,
  applyPatch,
  parsePatch,
  serializePatch,
  invertPatch,
  canApply,
} from '../../app/modules/patch-generator.js';

// ─── createPatch ─────────────────────────────────────────────────────────────

describe('createPatch', () => {
  it('returns empty hunks for identical texts', () => {
    const patch = createPatch('a\nb\nc', 'a\nb\nc');
    assert.equal(patch.hunks.length, 0);
  });

  it('creates a hunk for a single-line change', () => {
    const patch = createPatch('a\nb\nc', 'a\nx\nc');
    assert.equal(patch.hunks.length, 1);
  });

  it('hunk contains a - line for the deleted content', () => {
    const patch = createPatch('a\nb', 'a\nc');
    const lines = patch.hunks[0].lines;
    assert.ok(lines.some((l) => l.startsWith('-b')));
  });

  it('hunk contains a + line for the inserted content', () => {
    const patch = createPatch('a\nb', 'a\nc');
    const lines = patch.hunks[0].lines;
    assert.ok(lines.some((l) => l.startsWith('+c')));
  });

  it('includes filename in the header', () => {
    const patch = createPatch('a', 'b', 'myfile.txt');
    assert.ok(patch.header.includes('myfile.txt'));
  });

  it('defaults filename to "file"', () => {
    const patch = createPatch('a', 'b');
    assert.ok(patch.header.includes('file'));
  });

  it('hunk oldStart and newStart are positive integers', () => {
    const patch = createPatch('a\nb\nc', 'a\nx\nc');
    const hunk = patch.hunks[0];
    assert.ok(hunk.oldStart >= 1);
    assert.ok(hunk.newStart >= 1);
  });

  it('oldCount and newCount match the hunk line prefixes', () => {
    const patch = createPatch('a\nb\nc', 'a\nx\ny\nc');
    const hunk = patch.hunks[0];
    const contextAndDelete = hunk.lines.filter((l) => l.startsWith(' ') || l.startsWith('-'));
    const contextAndInsert = hunk.lines.filter((l) => l.startsWith(' ') || l.startsWith('+'));
    assert.equal(contextAndDelete.length, hunk.oldCount);
    assert.equal(contextAndInsert.length, hunk.newCount);
  });

  it('two separate changes produce separate hunks when far apart', () => {
    // Changes on line 1 and line 20 should be in separate hunks (> 6 lines apart)
    const oldLines = Array.from({ length: 20 }, (_, i) => `line${i + 1}`).join('\n');
    const newLines = oldLines.replace('line1', 'CHANGED1').replace('line20', 'CHANGED20');
    const patch = createPatch(oldLines, newLines);
    assert.ok(patch.hunks.length >= 2);
  });
});

// ─── applyPatch ──────────────────────────────────────────────────────────────

describe('applyPatch', () => {
  it('returns original text when there are no hunks', () => {
    const patch = createPatch('a\nb', 'a\nb');
    assert.equal(applyPatch('a\nb', patch), 'a\nb');
  });

  it('applies a single-line change', () => {
    const old = 'a\nb\nc';
    const expected = 'a\nx\nc';
    const patch = createPatch(old, expected);
    assert.equal(applyPatch(old, patch), expected);
  });

  it('applies an insertion', () => {
    const old = 'a\nc';
    const expected = 'a\nb\nc';
    const patch = createPatch(old, expected);
    assert.equal(applyPatch(old, patch), expected);
  });

  it('applies a deletion', () => {
    const old = 'a\nb\nc';
    const expected = 'a\nc';
    const patch = createPatch(old, expected);
    assert.equal(applyPatch(old, patch), expected);
  });

  it('applies multi-line changes', () => {
    const old = 'x\na\nb\nc\ny';
    const expected = 'x\n1\n2\n3\ny';
    const patch = createPatch(old, expected);
    assert.equal(applyPatch(old, patch), expected);
  });

  it('throws on context mismatch', () => {
    const patch = createPatch('a\nb\nc', 'a\nx\nc');
    assert.throws(() => applyPatch('WRONG\nb\nc', patch));
  });

  it('round-trips: apply(original, createPatch(original, modified)) === modified', () => {
    const original = 'line1\nline2\nline3\nline4\nline5';
    const modified = 'line1\nchanged\nline3\nnew\nline5';
    const patch = createPatch(original, modified);
    assert.equal(applyPatch(original, patch), modified);
  });

  it('applies a patch that appends a line', () => {
    const old = 'a\nb';
    const expected = 'a\nb\nc';
    const patch = createPatch(old, expected);
    assert.equal(applyPatch(old, patch), expected);
  });
});

// ─── parsePatch ──────────────────────────────────────────────────────────────

describe('parsePatch', () => {
  it('parses a serialized patch back to a Patch object', () => {
    const original = createPatch('a\nb\nc', 'a\nx\nc');
    const serialized = serializePatch(original);
    const parsed = parsePatch(serialized);
    assert.equal(parsed.hunks.length, original.hunks.length);
  });

  it('preserves hunk header numbers', () => {
    const original = createPatch('a\nb\nc', 'a\nx\nc');
    const parsed = parsePatch(serializePatch(original));
    assert.equal(parsed.hunks[0].oldStart, original.hunks[0].oldStart);
    assert.equal(parsed.hunks[0].newStart, original.hunks[0].newStart);
    assert.equal(parsed.hunks[0].oldCount, original.hunks[0].oldCount);
    assert.equal(parsed.hunks[0].newCount, original.hunks[0].newCount);
  });

  it('preserves hunk lines', () => {
    const original = createPatch('foo\nbar', 'foo\nbaz');
    const parsed = parsePatch(serializePatch(original));
    assert.deepEqual(parsed.hunks[0].lines, original.hunks[0].lines);
  });

  it('parses a manually crafted unified diff', () => {
    const text = `--- a\n+++ b\n@@ -1,2 +1,2 @@\n old\n-removed\n+added`;
    const patch = parsePatch(text);
    assert.equal(patch.hunks.length, 1);
    assert.equal(patch.hunks[0].oldStart, 1);
    assert.equal(patch.hunks[0].oldCount, 2);
    assert.equal(patch.hunks[0].newStart, 1);
    assert.equal(patch.hunks[0].newCount, 2);
  });

  it('returns empty hunks for a no-change patch string', () => {
    const patch = parsePatch('--- file\n+++ file');
    assert.equal(patch.hunks.length, 0);
  });

  it('preserves the header section', () => {
    const original = createPatch('a', 'b', 'test.txt');
    const parsed = parsePatch(serializePatch(original));
    assert.ok(parsed.header.includes('test.txt'));
  });

  it('round-trips multiple hunks', () => {
    const oldLines = Array.from({ length: 20 }, (_, i) => `line${i + 1}`).join('\n');
    const newLines = oldLines.replace('line1', 'X').replace('line20', 'Y');
    const original = createPatch(oldLines, newLines);
    const parsed = parsePatch(serializePatch(original));
    assert.equal(parsed.hunks.length, original.hunks.length);
  });

  it('parses + and - lines correctly', () => {
    const text = `--- a\n+++ b\n@@ -1,1 +1,1 @@\n-old\n+new`;
    const patch = parsePatch(text);
    assert.ok(patch.hunks[0].lines.includes('-old'));
    assert.ok(patch.hunks[0].lines.includes('+new'));
  });
});

// ─── serializePatch ──────────────────────────────────────────────────────────

describe('serializePatch', () => {
  it('includes @@ hunk header in output', () => {
    const patch = createPatch('a\nb', 'a\nc');
    const text = serializePatch(patch);
    assert.ok(text.includes('@@'));
  });

  it('includes the patch header in output', () => {
    const patch = createPatch('a', 'b', 'example.txt');
    const text = serializePatch(patch);
    assert.ok(text.includes('example.txt'));
  });

  it('produces a string', () => {
    const patch = createPatch('a', 'b');
    assert.equal(typeof serializePatch(patch), 'string');
  });

  it('serializes empty patch to just the header', () => {
    const patch = createPatch('same', 'same');
    const text = serializePatch(patch);
    // no @@ because no hunks
    assert.ok(!text.includes('@@'));
  });

  it('round-trips through parsePatch', () => {
    const original = createPatch('hello\nworld', 'hello\nearth');
    const text = serializePatch(original);
    const parsed = parsePatch(text);
    assert.equal(serializePatch(parsed), text);
  });

  it('each hunk line appears on its own line', () => {
    const patch = createPatch('a\nb\nc', 'a\nx\nc');
    const text = serializePatch(patch);
    const outputLines = text.split('\n');
    // Should contain lines starting with -, + or space
    const patchLines = outputLines.filter(
      (l) => l.startsWith('-') || l.startsWith('+') || l.startsWith(' '),
    );
    assert.ok(patchLines.length > 0);
  });

  it('hunk header format is @@ -a,b +c,d @@', () => {
    const patch = createPatch('a\nb', 'a\nc');
    const text = serializePatch(patch);
    assert.match(text, /@@ -\d+,\d+ \+\d+,\d+ @@/);
  });

  it('serializes multi-hunk patches correctly', () => {
    const oldLines = Array.from({ length: 20 }, (_, i) => `line${i + 1}`).join('\n');
    const newLines = oldLines.replace('line1', 'X').replace('line20', 'Y');
    const patch = createPatch(oldLines, newLines);
    const text = serializePatch(patch);
    const hunkCount = (text.match(/^@@/gm) || []).length;
    assert.equal(hunkCount, patch.hunks.length);
  });
});

// ─── invertPatch ─────────────────────────────────────────────────────────────

describe('invertPatch', () => {
  it('swaps + and - lines', () => {
    const patch = createPatch('a\nb', 'a\nc');
    const inv = invertPatch(patch);
    const lines = inv.hunks[0].lines;
    assert.ok(lines.some((l) => l.startsWith('+b')));
    assert.ok(lines.some((l) => l.startsWith('-c')));
  });

  it('swaps oldStart/oldCount with newStart/newCount', () => {
    const patch = createPatch('a\nb\nc', 'a\nx\nc');
    const inv = invertPatch(patch);
    assert.equal(inv.hunks[0].oldStart, patch.hunks[0].newStart);
    assert.equal(inv.hunks[0].newStart, patch.hunks[0].oldStart);
    assert.equal(inv.hunks[0].oldCount, patch.hunks[0].newCount);
    assert.equal(inv.hunks[0].newCount, patch.hunks[0].oldCount);
  });

  it('applying patch then inverted patch restores original', () => {
    const original = 'a\nb\nc';
    const modified = 'a\nx\nc';
    const patch = createPatch(original, modified);
    const applied = applyPatch(original, patch);
    const inv = invertPatch(patch);
    assert.equal(applyPatch(applied, inv), original);
  });

  it('preserves context lines (space prefix)', () => {
    const patch = createPatch('a\nb\nc', 'a\nx\nc');
    const inv = invertPatch(patch);
    const contextLines = inv.hunks[0].lines.filter((l) => l.startsWith(' '));
    const origContextLines = patch.hunks[0].lines.filter((l) => l.startsWith(' '));
    assert.equal(contextLines.length, origContextLines.length);
  });

  it('double inversion returns the original patch structure', () => {
    const patch = createPatch('hello\nworld', 'hello\nearth');
    const doubleInv = invertPatch(invertPatch(patch));
    assert.deepEqual(doubleInv.hunks[0].lines, patch.hunks[0].lines);
    assert.equal(doubleInv.hunks[0].oldStart, patch.hunks[0].oldStart);
    assert.equal(doubleInv.hunks[0].newStart, patch.hunks[0].newStart);
  });

  it('handles empty hunks', () => {
    const patch = createPatch('same', 'same');
    const inv = invertPatch(patch);
    assert.equal(inv.hunks.length, 0);
  });

  it('preserves header', () => {
    const patch = createPatch('a', 'b', 'myfile.txt');
    const inv = invertPatch(patch);
    assert.equal(inv.header, patch.header);
  });

  it('can be applied to modified text to recover original', () => {
    const original = 'line1\nline2\nline3';
    const modified = 'line1\nLINE2\nline3';
    const patch = createPatch(original, modified);
    const inv = invertPatch(patch);
    assert.equal(applyPatch(modified, inv), original);
  });
});

// ─── canApply ────────────────────────────────────────────────────────────────

describe('canApply', () => {
  it('returns true when patch applies cleanly', () => {
    const patch = createPatch('a\nb\nc', 'a\nx\nc');
    assert.equal(canApply('a\nb\nc', patch), true);
  });

  it('returns false when context does not match', () => {
    const patch = createPatch('a\nb\nc', 'a\nx\nc');
    assert.equal(canApply('WRONG\nb\nc', patch), false);
  });

  it('returns true for patch with no hunks', () => {
    const patch = createPatch('a\nb', 'a\nb');
    assert.equal(canApply('a\nb', patch), true);
  });

  it('returns false when applying inverted patch to original text', () => {
    const original = 'a\nb\nc';
    const patch = createPatch(original, 'a\nx\nc');
    const inv = invertPatch(patch);
    // Inverted patch expects 'x' on the old side; original has 'b'
    assert.equal(canApply(original, inv), false);
  });

  it('returns true when applying inverted patch to patched text', () => {
    const original = 'a\nb\nc';
    const modified = 'a\nx\nc';
    const patch = createPatch(original, modified);
    const inv = invertPatch(patch);
    assert.equal(canApply(modified, inv), true);
  });

  it('does not mutate the text argument', () => {
    const text = 'a\nb\nc';
    const patch = createPatch(text, 'a\nx\nc');
    canApply(text, patch);
    assert.equal(text, 'a\nb\nc');
  });

  it('returns false for a completely wrong text', () => {
    const patch = createPatch('hello\nworld', 'hello\nearth');
    assert.equal(canApply('completely\ndifferent\ntext', patch), false);
  });

  it('returns true after a round-trip createPatch/applyPatch', () => {
    const original = 'foo\nbar\nbaz';
    const modified = 'foo\nQUX\nbaz';
    const patch = createPatch(original, modified);
    const applied = applyPatch(original, patch);
    // The inverted patch should apply cleanly to the modified text
    const inv = invertPatch(patch);
    assert.equal(canApply(applied, inv), true);
  });
});
