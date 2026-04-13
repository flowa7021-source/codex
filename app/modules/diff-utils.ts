// @ts-check
// ─── Diff Utilities ──────────────────────────────────────────────────────────
// Text diffing utilities using a simple LCS-based (greedy) diff algorithm.

// ─── Types ────────────────────────────────────────────────────────────────────

export type DiffOp = 'equal' | 'insert' | 'delete';

export interface DiffChunk {
  op: DiffOp;
  text: string;
}

// ─── Internal: LCS-based diff ────────────────────────────────────────────────

/**
 * Compute a diff between two arrays of tokens using a simple greedy LCS approach.
 * Returns an array of DiffChunk objects with op 'equal', 'insert', or 'delete'.
 */
function diffTokens(oldTokens: string[], newTokens: string[]): DiffChunk[] {
  const m = oldTokens.length;
  const n = newTokens.length;

  // Build LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldTokens[i - 1] === newTokens[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to produce diff chunks
  const chunks: DiffChunk[] = [];
  let i = m;
  let j = n;
  const ops: Array<{ op: DiffOp; token: string }> = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldTokens[i - 1] === newTokens[j - 1]) {
      ops.push({ op: 'equal', token: oldTokens[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.push({ op: 'insert', token: newTokens[j - 1] });
      j--;
    } else {
      ops.push({ op: 'delete', token: oldTokens[i - 1] });
      i--;
    }
  }

  ops.reverse();

  // Merge consecutive ops of the same kind
  for (const { op, token } of ops) {
    const last = chunks[chunks.length - 1];
    if (last && last.op === op) {
      last.text += token;
    } else {
      chunks.push({ op, text: token });
    }
  }

  return chunks;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Compute line-level diff between two strings. Returns array of DiffChunks. */
export function diffLines(oldText: string, newText: string): DiffChunk[] {
  // Split into lines preserving the newline character at the end of each line
  const splitLines = (text: string): string[] => {
    if (text === '') return [];
    const lines: string[] = [];
    let start = 0;
    for (let i = 0; i < text.length; i++) {
      if (text[i] === '\n') {
        lines.push(text.slice(start, i + 1));
        start = i + 1;
      }
    }
    if (start < text.length) {
      lines.push(text.slice(start));
    }
    return lines;
  };

  return diffTokens(splitLines(oldText), splitLines(newText));
}

/** Compute word-level diff between two strings. */
export function diffWords(oldText: string, newText: string): DiffChunk[] {
  // Split on word boundaries, keeping delimiters
  const splitWords = (text: string): string[] => {
    if (text === '') return [];
    return text.match(/\S+|\s+/g) ?? [];
  };

  return diffTokens(splitWords(oldText), splitWords(newText));
}

/** Compute character-level diff between two strings. */
export function diffChars(oldText: string, newText: string): DiffChunk[] {
  return diffTokens([...oldText], [...newText]);
}

/** Format a diff as a unified diff string (like `diff -u`). */
export function formatUnifiedDiff(chunks: DiffChunk[], context = 3): string {
  // Convert chunks to lines array with op markers
  type LineEntry = { op: DiffOp; line: string };
  const lines: LineEntry[] = [];

  for (const chunk of chunks) {
    const chunkLines = chunk.text.split('\n');
    // If the chunk ends with a newline, split produces a trailing empty string — remove it
    if (chunkLines[chunkLines.length - 1] === '') {
      chunkLines.pop();
    }
    for (const line of chunkLines) {
      lines.push({ op: chunk.op, line });
    }
  }

  if (lines.length === 0) return '';

  // Build hunks with context
  const changedIndices = new Set<number>();
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].op !== 'equal') {
      changedIndices.add(i);
    }
  }

  if (changedIndices.size === 0) return '';

  // Group changed lines into ranges with context
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
  if (rangeStart !== -1) {
    ranges.push({ start: rangeStart, end: rangeEnd });
  }

  const output: string[] = [];

  for (const range of ranges) {
    // Compute old/new line counts and starts
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
      if (op === 'equal') {
        hunkLines.push(` ${line}`);
        oldCount++;
        newCount++;
      } else if (op === 'delete') {
        hunkLines.push(`-${line}`);
        oldCount++;
      } else {
        hunkLines.push(`+${line}`);
        newCount++;
      }
    }

    output.push(`@@ -${oldStart},${oldCount} +${newStart},${newCount} @@`);
    output.push(...hunkLines);
  }

  return output.join('\n');
}

/** Count insertions and deletions in a diff. */
export function diffStats(chunks: DiffChunk[]): { insertions: number; deletions: number; unchanged: number } {
  let insertions = 0;
  let deletions = 0;
  let unchanged = 0;

  for (const chunk of chunks) {
    if (chunk.op === 'insert') {
      insertions += chunk.text.length;
    } else if (chunk.op === 'delete') {
      deletions += chunk.text.length;
    } else {
      unchanged += chunk.text.length;
    }
  }

  return { insertions, deletions, unchanged };
}

/** Apply a diff (array of DiffChunks) to produce the new text. */
export function applyDiff(chunks: DiffChunk[]): string {
  return chunks
    .filter(c => c.op !== 'delete')
    .map(c => c.text)
    .join('');
}

/** Check if two strings are equal (no diff). */
export function isDiffEmpty(chunks: DiffChunk[]): boolean {
  return chunks.every(c => c.op === 'equal');
}
