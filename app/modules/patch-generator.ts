// @ts-check
// ─── Patch Generator ─────────────────────────────────────────────────────────
// Patch file creation, application, parsing, serialisation, inversion, and
// applicability checks.  Pure functions — no DOM, no I/O.

import { computeDiff } from './diff-viewer.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Hunk {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  /** Lines prefixed with ' ' (context), '+' (insert), or '-' (delete). */
  lines: string[];
}

export interface Patch {
  header: string;
  hunks: Hunk[];
}

// ─── Internal helpers ────────────────────────────────────────────────────────

/** Split text into lines, preserving an empty trailing element only when the
 *  text ends with a newline (so round-trip via join('\n') is exact). */
function splitLines(text: string): string[] {
  if (text === '') return [];
  return text.split('\n');
}

// ─── createPatch ─────────────────────────────────────────────────────────────

/**
 * Generate a Patch from two texts.
 * `filename` is used in the header; defaults to 'file'.
 * Context lines per hunk is fixed at 3.
 */
export function createPatch(oldText: string, newText: string, filename = 'file'): Patch {
  const header = `--- ${filename}\n+++ ${filename}`;

  const diff = computeDiff(oldText, newText);
  const diffLines = diff.lines;

  if (diffLines.length === 0) {
    return { header, hunks: [] };
  }

  const CONTEXT = 3;

  // Find changed indices
  const changedSet = new Set<number>();
  for (let i = 0; i < diffLines.length; i++) {
    if (diffLines[i].type !== 'equal') changedSet.add(i);
  }
  if (changedSet.size === 0) return { header, hunks: [] };

  // Build inclusion ranges
  const included = new Set<number>();
  for (const idx of changedSet) {
    for (
      let k = Math.max(0, idx - CONTEXT);
      k <= Math.min(diffLines.length - 1, idx + CONTEXT);
      k++
    ) {
      included.add(k);
    }
  }

  // Group consecutive indices into hunk index-ranges
  const sortedIndices = [...included].sort((a, b) => a - b);
  const hunkRanges: number[][] = [];
  let current: number[] = [];
  for (const idx of sortedIndices) {
    if (current.length === 0 || idx === current[current.length - 1] + 1) {
      current.push(idx);
    } else {
      hunkRanges.push(current);
      current = [idx];
    }
  }
  if (current.length > 0) hunkRanges.push(current);

  const hunks: Hunk[] = [];

  for (const range of hunkRanges) {
    // Calculate old/new line positions at start of this hunk
    let oldLine = 1;
    let newLine = 1;
    for (let i = 0; i < range[0]; i++) {
      if (diffLines[i].type !== 'insert') oldLine++;
      if (diffLines[i].type !== 'delete') newLine++;
    }

    let oldCount = 0;
    let newCount = 0;
    const lines: string[] = [];

    for (const idx of range) {
      const dl = diffLines[idx];
      if (dl.type === 'equal') {
        lines.push(' ' + dl.content);
        oldCount++;
        newCount++;
      } else if (dl.type === 'delete') {
        lines.push('-' + dl.content);
        oldCount++;
      } else {
        lines.push('+' + dl.content);
        newCount++;
      }
    }

    hunks.push({ oldStart: oldLine, oldCount, newStart: newLine, newCount, lines });
  }

  return { header, hunks };
}

// ─── applyPatch ──────────────────────────────────────────────────────────────

/**
 * Apply a patch to a text, returning the patched result.
 * Throws if any hunk cannot be applied (context mismatch).
 */
export function applyPatch(text: string, patch: Patch): string {
  if (patch.hunks.length === 0) return text;

  const lines = splitLines(text);
  const result: string[] = [];
  // cursor into `lines` (0-based)
  let cursor = 0;

  for (const hunk of patch.hunks) {
    // oldStart is 1-based
    const hunkStart = hunk.oldStart - 1;

    // Copy unchanged lines before this hunk
    while (cursor < hunkStart) {
      result.push(lines[cursor]);
      cursor++;
    }

    // Apply hunk lines
    for (const patchLine of hunk.lines) {
      const prefix = patchLine[0];
      const content = patchLine.slice(1);

      if (prefix === ' ') {
        // Context line — must match
        if (cursor >= lines.length || lines[cursor] !== content) {
          throw new Error(
            `Patch context mismatch at line ${cursor + 1}: expected "${content}", got "${lines[cursor]}"`,
          );
        }
        result.push(content);
        cursor++;
      } else if (prefix === '-') {
        // Delete — must match
        if (cursor >= lines.length || lines[cursor] !== content) {
          throw new Error(
            `Patch delete mismatch at line ${cursor + 1}: expected "${content}", got "${lines[cursor]}"`,
          );
        }
        cursor++;
      } else if (prefix === '+') {
        // Insert — emit without advancing cursor
        result.push(content);
      }
    }
  }

  // Copy any remaining lines after all hunks
  while (cursor < lines.length) {
    result.push(lines[cursor]);
    cursor++;
  }

  return result.join('\n');
}

// ─── parsePatch ──────────────────────────────────────────────────────────────

/**
 * Parse a unified diff string into a Patch object.
 * Accepts the format produced by `serializePatch`.
 */
export function parsePatch(patchText: string): Patch {
  const inputLines = patchText.split('\n');
  const headerLines: string[] = [];
  const hunks: Hunk[] = [];
  let i = 0;

  // Consume header lines (--- and +++ lines)
  while (i < inputLines.length && !inputLines[i].startsWith('@@')) {
    headerLines.push(inputLines[i]);
    i++;
  }

  const header = headerLines.join('\n');

  // Parse hunks
  while (i < inputLines.length) {
    const hunkHeader = inputLines[i];
    if (!hunkHeader.startsWith('@@')) {
      i++;
      continue;
    }

    // Parse @@ -a,b +c,d @@
    const match = hunkHeader.match(/^@@ -(\d+),(\d+) \+(\d+),(\d+) @@/);
    if (!match) {
      i++;
      continue;
    }

    const oldStart = parseInt(match[1], 10);
    const oldCount = parseInt(match[2], 10);
    const newStart = parseInt(match[3], 10);
    const newCount = parseInt(match[4], 10);
    i++;

    const lines: string[] = [];
    while (i < inputLines.length && !inputLines[i].startsWith('@@')) {
      lines.push(inputLines[i]);
      i++;
    }

    hunks.push({ oldStart, oldCount, newStart, newCount, lines });
  }

  return { header, hunks };
}

// ─── serializePatch ──────────────────────────────────────────────────────────

/**
 * Serialize a Patch back to a unified diff string.
 */
export function serializePatch(patch: Patch): string {
  const parts: string[] = [];
  if (patch.header) parts.push(patch.header);

  for (const hunk of patch.hunks) {
    parts.push(`@@ -${hunk.oldStart},${hunk.oldCount} +${hunk.newStart},${hunk.newCount} @@`);
    for (const line of hunk.lines) {
      parts.push(line);
    }
  }

  return parts.join('\n');
}

// ─── invertPatch ─────────────────────────────────────────────────────────────

/**
 * Invert a patch — swap insertions and deletions so it can be used to undo
 * what the original patch applied.
 */
export function invertPatch(patch: Patch): Patch {
  const invertedHunks: Hunk[] = patch.hunks.map((hunk) => {
    const invertedLines = hunk.lines.map((line) => {
      if (line.startsWith('+')) return '-' + line.slice(1);
      if (line.startsWith('-')) return '+' + line.slice(1);
      return line;
    });
    return {
      oldStart: hunk.newStart,
      oldCount: hunk.newCount,
      newStart: hunk.oldStart,
      newCount: hunk.oldCount,
      lines: invertedLines,
    };
  });

  return { header: patch.header, hunks: invertedHunks };
}

// ─── canApply ────────────────────────────────────────────────────────────────

/**
 * Return `true` if the patch can be applied to `text` without errors.
 * Does not modify `text`.
 */
export function canApply(text: string, patch: Patch): boolean {
  try {
    applyPatch(text, patch);
    return true;
  } catch {
    return false;
  }
}
