// @ts-check
// ─── Suffix Array ───────────────────────────────────────────────────────────
// Builds a suffix array for a given text and supports pattern search via
// binary search.  Construction is O(n log^2 n) using the prefix-doubling
// approach; search is O(m log n) per query where m = pattern length.

// ─── Construction (prefix-doubling) ─────────────────────────────────────────

function buildSuffixArray(text: string): number[] {
  const n = text.length;
  if (n === 0) return [];

  // Initial rank = char code
  let rank = new Int32Array(n);
  let tmp = new Int32Array(n);
  const sa: number[] = Array.from({ length: n }, (_, i) => i);

  for (let i = 0; i < n; i++) rank[i] = text.charCodeAt(i);

  for (let k = 1; k < n; k *= 2) {
    // Capture current rank and k for the comparator closure
    const r = rank;
    const step = k;
    sa.sort((a, b) => {
      if (r[a] !== r[b]) return r[a] - r[b];
      const ra = a + step < n ? r[a + step] : -1;
      const rb = b + step < n ? r[b + step] : -1;
      return ra - rb;
    });

    tmp[sa[0]] = 0;
    for (let i = 1; i < n; i++) {
      const prev = sa[i - 1];
      const cur = sa[i];
      const sameFirst = r[prev] === r[cur];
      const prevSecond = prev + step < n ? r[prev + step] : -1;
      const curSecond = cur + step < n ? r[cur + step] : -1;
      tmp[cur] = tmp[prev] + (sameFirst && prevSecond === curSecond ? 0 : 1);
    }

    // Swap rank and tmp
    [rank, tmp] = [tmp, rank];

    // Early termination: all ranks are unique
    if (rank[sa[n - 1]] === n - 1) break;
  }

  return sa;
}

// ─── Binary search helpers ──────────────────────────────────────────────────

function compareSuffix(text: string, suffixStart: number, pattern: string): number {
  const n = text.length;
  const m = pattern.length;
  for (let i = 0; i < m; i++) {
    if (suffixStart + i >= n) return -1; // suffix is shorter
    const diff = text.charCodeAt(suffixStart + i) - pattern.charCodeAt(i);
    if (diff !== 0) return diff;
  }
  return 0;
}

function lowerBound(text: string, sa: number[], pattern: string): number {
  let lo = 0;
  let hi = sa.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (compareSuffix(text, sa[mid], pattern) < 0) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return lo;
}

function upperBound(text: string, sa: number[], pattern: string): number {
  let lo = 0;
  let hi = sa.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (compareSuffix(text, sa[mid], pattern) <= 0) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return lo;
}

// ─── SuffixArray class ──────────────────────────────────────────────────────

export class SuffixArray {
  private readonly _text: string;
  private readonly _sa: number[];

  constructor(text: string) {
    this._text = text;
    this._sa = buildSuffixArray(text);
  }

  // ── accessors ───────────────────────────────────────────────────────────

  get text(): string {
    return this._text;
  }

  get size(): number {
    return this._sa.length;
  }

  toArray(): number[] {
    return [...this._sa];
  }

  suffixAt(rank: number): string {
    if (rank < 0 || rank >= this._sa.length) return '';
    return this._text.slice(this._sa[rank]);
  }

  // ── search ─────────────────────────────────────────────────────────────

  search(pattern: string): number[] {
    if (pattern.length === 0 || this._sa.length === 0) return [];
    const lo = lowerBound(this._text, this._sa, pattern);
    const hi = upperBound(this._text, this._sa, pattern);
    const results: number[] = [];
    for (let i = lo; i < hi; i++) {
      results.push(this._sa[i]);
    }
    return results.sort((a, b) => a - b);
  }

  contains(pattern: string): boolean {
    if (pattern.length === 0) return true;
    if (this._sa.length === 0) return false;
    const lo = lowerBound(this._text, this._sa, pattern);
    return lo < this._sa.length && compareSuffix(this._text, this._sa[lo], pattern) === 0;
  }

  count(pattern: string): number {
    if (pattern.length === 0) return 0;
    if (this._sa.length === 0) return 0;
    const lo = lowerBound(this._text, this._sa, pattern);
    const hi = upperBound(this._text, this._sa, pattern);
    return hi - lo;
  }

  // ── LCP helpers ────────────────────────────────────────────────────────

  /** Longest common prefix of the suffixes at SA positions i and j. */
  longestCommonPrefix(i: number, j: number): string {
    if (i < 0 || j < 0 || i >= this._sa.length || j >= this._sa.length) return '';
    const a = this._sa[i];
    const b = this._sa[j];
    const maxLen = this._text.length - Math.max(a, b);
    let len = 0;
    while (len < maxLen && this._text[a + len] === this._text[b + len]) {
      len++;
    }
    return this._text.slice(a, a + len);
  }

  /** Longest repeated substring (appears at least twice). */
  longestRepeatedSubstring(): string {
    if (this._sa.length <= 1) return '';
    let best = '';
    for (let i = 1; i < this._sa.length; i++) {
      const lcp = this.longestCommonPrefix(i - 1, i);
      if (lcp.length > best.length) {
        best = lcp;
      }
    }
    return best;
  }
}

// ─── Factory ────────────────────────────────────────────────────────────────

export function createSuffixArray(text: string): SuffixArray {
  return new SuffixArray(text);
}
