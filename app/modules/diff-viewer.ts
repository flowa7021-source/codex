// @ts-check
// ─── Diff Viewer ─────────────────────────────────────────────────────────────
// Text diff display utilities: LCS-based line diff, unified format,
// side-by-side format, inline char-level highlights, and change counts.
// Pure functions — no DOM, no I/O.

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DiffLine {
  type: 'equal' | 'insert' | 'delete';
  content: string;
  lineNumber?: number;
}

export interface DiffResult {
  lines: DiffLine[];
  stats: { added: number; removed: number; unchanged: number };
}

// ─── Internal: LCS ───────────────────────────────────────────────────────────

/**
 * Build the LCS length table for two string arrays.
 * Returns a 2-D array where table[i][j] is the LCS length of
 * oldLines[0..i-1] and newLines[0..j-1].
 */
function buildLcsTable(oldLines: string[], newLines: string[]): number[][] {
  const m = oldLines.length;
  const n = newLines.length;
  // Allocate (m+1) × (n+1) with zeros
  const table: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        table[i][j] = table[i - 1][j - 1] + 1;
      } else {
        table[i][j] = Math.max(table[i - 1][j], table[i][j - 1]);
      }
    }
  }
  return table;
}

/**
 * Walk the LCS table back-to-front and emit DiffLine entries.
 */
function walkLcs(
  table: number[][],
  oldLines: string[],
  newLines: string[],
  i: number,
  j: number,
  result: DiffLine[],
): void {
  if (i === 0 && j === 0) return;

  if (i === 0) {
    // Only new lines remain
    walkLcs(table, oldLines, newLines, i, j - 1, result);
    result.push({ type: 'insert', content: newLines[j - 1], lineNumber: j });
  } else if (j === 0) {
    // Only old lines remain
    walkLcs(table, oldLines, newLines, i - 1, j, result);
    result.push({ type: 'delete', content: oldLines[i - 1], lineNumber: i });
  } else if (oldLines[i - 1] === newLines[j - 1]) {
    walkLcs(table, oldLines, newLines, i - 1, j - 1, result);
    result.push({ type: 'equal', content: oldLines[i - 1], lineNumber: i });
  } else if (table[i - 1][j] >= table[i][j - 1]) {
    walkLcs(table, oldLines, newLines, i - 1, j, result);
    result.push({ type: 'delete', content: oldLines[i - 1], lineNumber: i });
  } else {
    walkLcs(table, oldLines, newLines, i, j - 1, result);
    result.push({ type: 'insert', content: newLines[j - 1], lineNumber: j });
  }
}

// ─── computeDiff ─────────────────────────────────────────────────────────────

/**
 * Compute a line-by-line diff of two texts using the LCS algorithm.
 * Returns a DiffResult with per-line type annotations and change statistics.
 */
export function computeDiff(oldText: string, newText: string): DiffResult {
  const oldLines = oldText === '' ? [] : oldText.split('\n');
  const newLines = newText === '' ? [] : newText.split('\n');

  const table = buildLcsTable(oldLines, newLines);
  const lines: DiffLine[] = [];
  walkLcs(table, oldLines, newLines, oldLines.length, newLines.length, lines);

  let added = 0;
  let removed = 0;
  let unchanged = 0;
  for (const line of lines) {
    if (line.type === 'insert') added++;
    else if (line.type === 'delete') removed++;
    else unchanged++;
  }

  return { lines, stats: { added, removed, unchanged } };
}

// ─── formatUnified ───────────────────────────────────────────────────────────

/**
 * Format a DiffResult as a unified diff string.
 * `context` controls how many unchanged lines to show around each change
 * (default: 3). Produces standard "@@ -a,b +c,d @@" hunk headers.
 */
export function formatUnified(diff: DiffResult, context = 3): string {
  const lines = diff.lines;
  if (lines.length === 0) return '';

  // Find indices of changed lines
  const changedIndices = new Set<number>();
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].type !== 'equal') changedIndices.add(i);
  }
  if (changedIndices.size === 0) return '';

  // Build ranges of lines to include (changed ± context)
  const included = new Set<number>();
  for (const idx of changedIndices) {
    for (let k = Math.max(0, idx - context); k <= Math.min(lines.length - 1, idx + context); k++) {
      included.add(k);
    }
  }

  // Group consecutive included indices into hunks
  const sortedIndices = [...included].sort((a, b) => a - b);
  const hunks: number[][] = [];
  let currentHunk: number[] = [];

  for (const idx of sortedIndices) {
    if (currentHunk.length === 0 || idx === currentHunk[currentHunk.length - 1] + 1) {
      currentHunk.push(idx);
    } else {
      hunks.push(currentHunk);
      currentHunk = [idx];
    }
  }
  if (currentHunk.length > 0) hunks.push(currentHunk);

  const outputParts: string[] = [];

  for (const hunk of hunks) {
    // Calculate old/new line numbers for the hunk header
    let oldStart = 1;
    let oldCount = 0;
    let newStart = 1;
    let newCount = 0;

    // Count old/new positions up to start of hunk
    let oldLine = 1;
    let newLine = 1;
    for (let i = 0; i < hunk[0]; i++) {
      if (lines[i].type !== 'insert') oldLine++;
      if (lines[i].type !== 'delete') newLine++;
    }
    oldStart = oldLine;
    newStart = newLine;

    const hunkLines: string[] = [];
    for (const idx of hunk) {
      const dl = lines[idx];
      if (dl.type === 'equal') {
        hunkLines.push(' ' + dl.content);
        oldCount++;
        newCount++;
      } else if (dl.type === 'delete') {
        hunkLines.push('-' + dl.content);
        oldCount++;
      } else {
        hunkLines.push('+' + dl.content);
        newCount++;
      }
    }

    outputParts.push(`@@ -${oldStart},${oldCount} +${newStart},${newCount} @@`);
    outputParts.push(...hunkLines);
  }

  return outputParts.join('\n');
}

// ─── formatSideBySide ────────────────────────────────────────────────────────

/**
 * Format a DiffResult for side-by-side display.
 * Returns two parallel arrays: `left` (old) and `right` (new).
 * Each array has the same number of elements; unmatched slots use empty string.
 */
export function formatSideBySide(diff: DiffResult): { left: string[]; right: string[] } {
  const left: string[] = [];
  const right: string[] = [];

  for (const line of diff.lines) {
    if (line.type === 'equal') {
      left.push(line.content);
      right.push(line.content);
    } else if (line.type === 'delete') {
      left.push(line.content);
      right.push('');
    } else {
      left.push('');
      right.push(line.content);
    }
  }

  return { left, right };
}

// ─── highlightChanges ────────────────────────────────────────────────────────

/**
 * Produce an inline character-level diff of two lines.
 * Returns the new line with changed characters wrapped in `[+…+]` markers
 * and deleted characters from the old line represented as `[-…-]`.
 *
 * Uses a simple greedy LCS on characters for highlighting.
 */
export function highlightChanges(line: string, oldLine: string): string {
  if (line === oldLine) return line;
  if (oldLine === '') return '[+' + line + '+]';
  if (line === '') return '[-' + oldLine + '-]';

  const a = oldLine.split('');
  const b = line.split('');
  const m = a.length;
  const n = b.length;

  // Build char-level LCS table (capped at 200×200 to stay performant)
  const maxLen = 200;
  if (m > maxLen || n > maxLen) {
    // Fall back to full-line replacement marker
    return '[-' + oldLine + '-][+' + line + '+]';
  }

  const tbl: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        tbl[i][j] = tbl[i - 1][j - 1] + 1;
      } else {
        tbl[i][j] = Math.max(tbl[i - 1][j], tbl[i][j - 1]);
      }
    }
  }

  // Backtrack to find alignment
  type CharOp = { op: 'equal' | 'insert' | 'delete'; ch: string };
  const ops: CharOp[] = [];
  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      ops.unshift({ op: 'equal', ch: b[j - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || tbl[i][j - 1] >= tbl[i - 1][j])) {
      ops.unshift({ op: 'insert', ch: b[j - 1] });
      j--;
    } else {
      ops.unshift({ op: 'delete', ch: a[i - 1] });
      i--;
    }
  }

  // Build output, collapsing consecutive operations into spans
  let output = '';
  let k = 0;
  while (k < ops.length) {
    const op = ops[k].op;
    if (op === 'equal') {
      output += ops[k].ch;
      k++;
    } else if (op === 'delete') {
      let span = '';
      while (k < ops.length && ops[k].op === 'delete') {
        span += ops[k].ch;
        k++;
      }
      output += '[-' + span + '-]';
    } else {
      let span = '';
      while (k < ops.length && ops[k].op === 'insert') {
        span += ops[k].ch;
        k++;
      }
      output += '[+' + span + '+]';
    }
  }
  return output;
}

// ─── countChanges ────────────────────────────────────────────────────────────

/**
 * Return the number of added and removed lines from a DiffResult.
 * Convenience wrapper — same values as `diff.stats` but without `unchanged`.
 */
export function countChanges(diff: DiffResult): { added: number; removed: number } {
  return { added: diff.stats.added, removed: diff.stats.removed };
}
