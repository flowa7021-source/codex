// @ts-check
// ─── Patch ───────────────────────────────────────────────────────────────────
// Patch creation and application utilities.

import { diffLines } from './diff-utils.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Patch {
  version: 1;
  hunks: PatchHunk[];
}

export interface PatchHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: string[];  // '+', '-', ' ' prefixed lines
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function splitLines(text: string): string[] {
  if (text === '') return [];
  const lines = text.split('\n');
  // Re-attach newline to each line (except possibly the last)
  const result: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (i < lines.length - 1) {
      result.push(lines[i] + '\n');
    } else if (lines[i] !== '') {
      result.push(lines[i]);
    }
  }
  return result;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Create a patch from old text to new text. */
export function createPatch(oldText: string, newText: string, context = 3): Patch {
  const chunks = diffLines(oldText, newText);

  // Expand chunks into per-line entries
  type LineEntry = { op: 'equal' | 'insert' | 'delete'; line: string };
  const lines: LineEntry[] = [];

  for (const chunk of chunks) {
    const chunkLines = splitLines(chunk.text);
    for (const line of chunkLines) {
      lines.push({ op: chunk.op, line });
    }
  }

  // Find changed line indices
  const changedIndices = new Set<number>();
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].op !== 'equal') changedIndices.add(i);
  }

  if (changedIndices.size === 0) return { version: 1, hunks: [] };

  // Group into hunk ranges with context
  const ranges: Array<{ start: number; end: number }> = [];
  let rangeStart = -1;
  let rangeEnd = -1;

  const sortedChanged = [...changedIndices].sort((a, b) => a - b);

  for (const idx of sortedChanged) {
    const s = Math.max(0, idx - context);
    const e = Math.min(lines.length - 1, idx + context);
    if (rangeStart === -1) {
      rangeStart = s;
      rangeEnd = e;
    } else if (s <= rangeEnd + 1) {
      rangeEnd = Math.max(rangeEnd, e);
    } else {
      ranges.push({ start: rangeStart, end: rangeEnd });
      rangeStart = s;
      rangeEnd = e;
    }
  }
  if (rangeStart !== -1) ranges.push({ start: rangeStart, end: rangeEnd });

  const hunks: PatchHunk[] = [];

  for (const range of ranges) {
    // Count old/new starts
    let oldStart = 1;
    let newStart = 1;
    for (let i = 0; i < range.start; i++) {
      if (lines[i].op !== 'insert') oldStart++;
      if (lines[i].op !== 'delete') newStart++;
    }

    let oldCount = 0;
    let newCount = 0;
    const hunkLines: string[] = [];

    for (let i = range.start; i <= range.end; i++) {
      const { op, line } = lines[i];
      // Strip trailing newline for storage in hunk lines (will be re-added on apply)
      const stripped = line.endsWith('\n') ? line.slice(0, -1) : line;
      if (op === 'equal') {
        hunkLines.push(` ${stripped}`);
        oldCount++;
        newCount++;
      } else if (op === 'delete') {
        hunkLines.push(`-${stripped}`);
        oldCount++;
      } else {
        hunkLines.push(`+${stripped}`);
        newCount++;
      }
    }

    hunks.push({ oldStart, oldLines: oldCount, newStart, newLines: newCount, lines: hunkLines });
  }

  return { version: 1, hunks };
}

/** Apply a patch to text. Returns null if patch doesn't apply cleanly. */
export function applyPatch(text: string, patch: Patch): string | null {
  const lines = splitLines(text);
  const result: string[] = [...lines];
  // We apply hunks in reverse order to not disturb line indices
  const hunks = [...patch.hunks].sort((a, b) => b.oldStart - a.oldStart);

  for (const hunk of hunks) {
    const start = hunk.oldStart - 1; // 0-indexed
    const end = start + hunk.oldLines;

    // Verify context and delete lines match
    const contextAndDeletes = hunk.lines.filter(l => l.startsWith(' ') || l.startsWith('-'));
    const oldSlice = result.slice(start, end);

    if (oldSlice.length !== contextAndDeletes.length) return null;

    for (let i = 0; i < contextAndDeletes.length; i++) {
      const expectedContent = contextAndDeletes[i].slice(1); // strip prefix
      const actualLine = oldSlice[i];
      // Compare ignoring trailing newline differences
      const actual = actualLine.endsWith('\n') ? actualLine.slice(0, -1) : actualLine;
      if (actual !== expectedContent) return null;
    }

    // Build replacement lines
    const replacement: string[] = [];
    for (const l of hunk.lines) {
      if (l.startsWith(' ') || l.startsWith('+')) {
        const content = l.slice(1);
        // Re-attach newline for non-final lines (we'll normalise at end)
        replacement.push(content + '\n');
      }
    }

    result.splice(start, hunk.oldLines, ...replacement);
  }

  // Reconstruct text
  let out = result.join('');
  // Remove trailing newlines added to last line if original didn't have them
  if (!text.endsWith('\n') && out.endsWith('\n')) {
    out = out.slice(0, -1);
  }
  return out;
}

/** Serialize a patch to unified diff format string. */
export function serializePatch(patch: Patch): string {
  const parts: string[] = [];
  for (const hunk of patch.hunks) {
    parts.push(`@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`);
    for (const line of hunk.lines) {
      parts.push(line);
    }
  }
  return parts.join('\n');
}

/** Parse a unified diff format string into a Patch object. */
export function parsePatch(unifiedDiff: string): Patch | null {
  const lines = unifiedDiff.split('\n');
  const hunks: PatchHunk[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Match hunk header: @@ -oldStart,oldLines +newStart,newLines @@
    const match = line.match(/^@@ -(\d+),(\d+) \+(\d+),(\d+) @@/);
    if (!match) {
      i++;
      continue;
    }

    const oldStart = parseInt(match[1], 10);
    const oldLines = parseInt(match[2], 10);
    const newStart = parseInt(match[3], 10);
    const newLines = parseInt(match[4], 10);
    i++;

    const hunkLines: string[] = [];
    while (i < lines.length && !lines[i].startsWith('@@')) {
      const l = lines[i];
      if (l.startsWith(' ') || l.startsWith('+') || l.startsWith('-')) {
        hunkLines.push(l);
      }
      i++;
    }

    hunks.push({ oldStart, oldLines, newStart, newLines, lines: hunkLines });
  }

  if (hunks.length === 0 && unifiedDiff.trim() !== '') {
    // Check if it looked like it had hunk headers but we failed to parse
    if (!unifiedDiff.includes('@@')) return null;
  }

  return { version: 1, hunks };
}

/** Invert a patch (swap insertions and deletions). */
export function invertPatch(patch: Patch): Patch {
  const hunks: PatchHunk[] = patch.hunks.map(hunk => {
    const invertedLines = hunk.lines.map(line => {
      if (line.startsWith('+')) return `-${line.slice(1)}`;
      if (line.startsWith('-')) return `+${line.slice(1)}`;
      return line;
    });

    return {
      oldStart: hunk.newStart,
      oldLines: hunk.newLines,
      newStart: hunk.oldStart,
      newLines: hunk.oldLines,
      lines: invertedLines,
    };
  });

  return { version: 1, hunks };
}

/** Check if a patch applies cleanly to text (without applying it). */
export function canApplyPatch(text: string, patch: Patch): boolean {
  return applyPatch(text, patch) !== null;
}
