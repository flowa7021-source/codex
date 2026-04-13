// @ts-check
// ─── Text Search Library ──────────────────────────────────────────────────────
// Full-text search utilities: Boyer-Moore-Horspool, KMP, Rabin-Karp, fuzzy
// matching, edit distance, LCS, inverted index, scoring engine, and highlighting.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SearchDocument {
  id: string;
  content: string;
  title?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface SearchResult {
  id: string;
  score: number;
  highlights: string[]; // snippets with the match context
  document: SearchDocument;
}

export interface SearchOptions {
  caseSensitive?: boolean; // default false
  wholeWord?: boolean;     // default false
  limit?: number;          // max results, default 20
  minScore?: number;       // minimum score threshold
}

// ─── Boyer-Moore-Horspool ─────────────────────────────────────────────────────

/**
 * Boyer-Moore-Horspool substring search.
 * Returns an array of all starting indices where `pattern` occurs in `text`.
 * Case-sensitive. Includes all positions (including overlapping).
 */
export function findAll(text: string, pattern: string): number[] {
  const results: number[] = [];
  const n = text.length;
  const m = pattern.length;

  if (m === 0) {
    // Empty pattern matches at every position 0..n
    for (let i = 0; i <= n; i++) results.push(i);
    return results;
  }

  if (m > n) return results;

  // Build the bad-character shift table
  const skip = new Map<string, number>();
  for (let i = 0; i < m - 1; i++) {
    skip.set(pattern[i], m - 1 - i);
  }

  let i = m - 1;
  while (i < n) {
    let j = m - 1;
    let k = i;
    while (j >= 0 && text[k] === pattern[j]) {
      j--;
      k--;
    }
    if (j === -1) {
      results.push(k + 1);
    }
    const ch = text[i];
    i += skip.has(ch) ? skip.get(ch)! : m;
  }

  return results;
}

// ─── Knuth-Morris-Pratt ───────────────────────────────────────────────────────

/** Compute the KMP failure function (partial match table) for `pattern`. */
function buildKmpTable(pattern: string): number[] {
  const m = pattern.length;
  const table = new Array<number>(m).fill(0);
  let len = 0;
  let i = 1;
  while (i < m) {
    if (pattern[i] === pattern[len]) {
      len++;
      table[i] = len;
      i++;
    } else if (len > 0) {
      len = table[len - 1];
    } else {
      table[i] = 0;
      i++;
    }
  }
  return table;
}

/**
 * Knuth-Morris-Pratt substring search.
 * Returns the index of the first occurrence of `pattern` in `text`, or -1.
 */
export function kmpSearch(text: string, pattern: string): number {
  const n = text.length;
  const m = pattern.length;

  if (m === 0) return 0;
  if (m > n) return -1;

  const table = buildKmpTable(pattern);
  let i = 0; // index into text
  let j = 0; // index into pattern

  while (i < n) {
    if (text[i] === pattern[j]) {
      i++;
      j++;
      if (j === m) return i - j;
    } else if (j > 0) {
      j = table[j - 1];
    } else {
      i++;
    }
  }

  return -1;
}

// ─── Rabin-Karp ───────────────────────────────────────────────────────────────

const RK_BASE = 31;
const RK_MOD = 1_000_000_007;

/**
 * Rabin-Karp rolling-hash substring search.
 * Returns an array of all starting indices where `pattern` occurs in `text`.
 */
export function rabinKarp(text: string, pattern: string): number[] {
  const results: number[] = [];
  const n = text.length;
  const m = pattern.length;

  if (m === 0) {
    for (let i = 0; i <= n; i++) results.push(i);
    return results;
  }

  if (m > n) return results;

  // Compute pattern hash and the highest power base^(m-1)
  let patHash = 0;
  let highPow = 1;
  for (let i = 0; i < m; i++) {
    patHash = (patHash * RK_BASE + pattern.charCodeAt(i)) % RK_MOD;
    if (i > 0) highPow = (highPow * RK_BASE) % RK_MOD;
  }

  // Compute initial window hash
  let winHash = 0;
  for (let i = 0; i < m; i++) {
    winHash = (winHash * RK_BASE + text.charCodeAt(i)) % RK_MOD;
  }

  for (let i = 0; i <= n - m; i++) {
    if (winHash === patHash) {
      // Verify to guard against hash collisions
      if (text.slice(i, i + m) === pattern) {
        results.push(i);
      }
    }
    if (i < n - m) {
      winHash =
        ((winHash - (text.charCodeAt(i) * highPow) % RK_MOD + RK_MOD) * RK_BASE +
          text.charCodeAt(i + m)) %
        RK_MOD;
    }
  }

  return results;
}

// ─── Fuzzy Match ──────────────────────────────────────────────────────────────

/**
 * Returns `true` if `pattern` can be found as a subsequence of `text`.
 * An empty pattern always matches.
 */
export function fuzzyMatch(text: string, pattern: string): boolean {
  if (pattern.length === 0) return true;
  let pi = 0;
  for (let ti = 0; ti < text.length && pi < pattern.length; ti++) {
    if (text[ti] === pattern[pi]) pi++;
  }
  return pi === pattern.length;
}

// ─── Levenshtein Edit Distance ────────────────────────────────────────────────

/**
 * Compute the Levenshtein edit distance between strings `a` and `b`.
 * Uses two-row DP: O(min(|a|,|b|)) space.
 */
export function levenshtein(a: string, b: string): number {
  // Keep `a` as the shorter string for space optimisation
  if (a.length > b.length) return levenshtein(b, a);

  const la = a.length;
  const lb = b.length;

  const prev = Array.from({ length: la + 1 }, (_, i) => i);
  const curr = new Array<number>(la + 1);

  for (let j = 1; j <= lb; j++) {
    curr[0] = j;
    for (let i = 1; i <= la; i++) {
      if (a[i - 1] === b[j - 1]) {
        curr[i] = prev[i - 1];
      } else {
        curr[i] = 1 + Math.min(prev[i - 1], prev[i], curr[i - 1]);
      }
    }
    for (let i = 0; i <= la; i++) prev[i] = curr[i];
  }

  return prev[la];
}

// ─── Longest Common Subsequence ───────────────────────────────────────────────

/**
 * Return the length of the longest common subsequence of `a` and `b`.
 */
export function lcs(a: string, b: string): number {
  const la = a.length;
  const lb = b.length;
  if (la === 0 || lb === 0) return 0;

  const prev = new Array<number>(lb + 1).fill(0);
  const curr = new Array<number>(lb + 1).fill(0);

  for (let i = 1; i <= la; i++) {
    curr[0] = 0;
    for (let j = 1; j <= lb; j++) {
      if (a[i - 1] === b[j - 1]) {
        curr[j] = prev[j - 1] + 1;
      } else {
        curr[j] = Math.max(prev[j], curr[j - 1]);
      }
    }
    for (let j = 0; j <= lb; j++) prev[j] = curr[j];
  }

  return prev[lb];
}

// ─── Longest Common Substring ─────────────────────────────────────────────────

/**
 * Return the length of the longest contiguous common substring of `a` and `b`.
 */
export function longestCommonSubstring(a: string, b: string): number {
  const la = a.length;
  const lb = b.length;
  if (la === 0 || lb === 0) return 0;

  let best = 0;
  const prev = new Array<number>(lb + 1).fill(0);
  const curr = new Array<number>(lb + 1).fill(0);

  for (let i = 1; i <= la; i++) {
    curr[0] = 0;
    for (let j = 1; j <= lb; j++) {
      if (a[i - 1] === b[j - 1]) {
        curr[j] = prev[j - 1] + 1;
        if (curr[j] > best) best = curr[j];
      } else {
        curr[j] = 0;
      }
    }
    for (let j = 0; j <= lb; j++) prev[j] = curr[j];
  }

  return best;
}

// ─── SearchIndex ──────────────────────────────────────────────────────────────

/**
 * Simple inverted index for multi-document full-text search.
 * Tokenises text on whitespace / punctuation boundaries.
 */
export class SearchIndex {
  /** term → Set of document IDs */
  readonly #index: Map<string, Set<string>>;
  /** doc ID → set of terms contained in that document */
  readonly #docs: Map<string, Set<string>>;

  constructor() {
    this.#index = new Map();
    this.#docs = new Map();
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  #tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .split(/[\s\p{P}]+/u)
      .filter(t => t.length > 0);
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  /** Index a document under `id` with the given `text`. Re-indexes if `id` already exists. */
  addDocument(id: string, text: string): void {
    this.removeDocument(id);

    const terms = new Set(this.#tokenize(text));
    this.#docs.set(id, terms);

    for (const term of terms) {
      let postings = this.#index.get(term);
      if (!postings) {
        postings = new Set();
        this.#index.set(term, postings);
      }
      postings.add(id);
    }
  }

  /** Remove a document and all its term postings from the index. */
  removeDocument(id: string): void {
    const terms = this.#docs.get(id);
    if (!terms) return;
    for (const term of terms) {
      const postings = this.#index.get(term);
      if (postings) {
        postings.delete(id);
        if (postings.size === 0) this.#index.delete(term);
      }
    }
    this.#docs.delete(id);
  }

  /**
   * AND search: returns doc IDs that contain ALL query terms.
   * Returns an empty array for a blank query.
   */
  search(query: string): string[] {
    const terms = this.#tokenize(query);
    if (terms.length === 0) return [];

    let result: Set<string> | null = null;
    for (const term of terms) {
      const postings = this.#index.get(term);
      if (!postings || postings.size === 0) return [];
      if (result === null) {
        result = new Set(postings);
      } else {
        for (const id of result) {
          if (!postings.has(id)) result.delete(id);
        }
      }
    }

    return result ? [...result] : [];
  }

  /**
   * OR search: returns doc IDs that contain ANY query term.
   * Returns an empty array for a blank query.
   */
  searchAny(query: string): string[] {
    const terms = this.#tokenize(query);
    if (terms.length === 0) return [];

    const result = new Set<string>();
    for (const term of terms) {
      const postings = this.#index.get(term);
      if (postings) {
        for (const id of postings) result.add(id);
      }
    }

    return [...result];
  }

  /** Number of documents currently indexed. */
  get documentCount(): number {
    return this.#docs.size;
  }

  /** Remove all documents and clear the index. */
  clear(): void {
    this.#index.clear();
    this.#docs.clear();
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/** Create a fresh, empty `SearchIndex`. */
export function createSearchIndex(): SearchIndex {
  return new SearchIndex();
}

// ─── Highlight ────────────────────────────────────────────────────────────────

/**
 * Highlight every occurrence of `pattern` in `text` by wrapping it in
 * `<tag>…</tag>` (default tag: `mark`).
 * Case-sensitive; preserves the original matched characters.
 */
export function highlight(text: string, pattern: string, tag: string = 'mark'): string {
  if (pattern.length === 0) return text;

  const positions = findAll(text, pattern);
  if (positions.length === 0) return text;

  const open = `<${tag}>`;
  const close = `</${tag}>`;
  const m = pattern.length;

  let result = '';
  let last = 0;

  for (const pos of positions) {
    result += text.slice(last, pos) + open + text.slice(pos, pos + m) + close;
    last = pos + m;
  }

  result += text.slice(last);
  return result;
}

// ─── TextSearch (original scoring engine) ────────────────────────────────────

const HIGHLIGHT_CONTEXT = 40;
const MAX_HIGHLIGHTS = 3;

/** Count non-overlapping occurrences of `needle` in `haystack`. */
function countOccurrences(haystack: string, needle: string): number {
  if (needle.length === 0) return 0;
  let count = 0;
  let pos = 0;
  while (true) {
    pos = haystack.indexOf(needle, pos);
    if (pos === -1) break;
    count++;
    pos += needle.length;
  }
  return count;
}

/** Count whole-word occurrences of `needle` in `haystack`. */
function countWholeWordOccurrences(haystack: string, needle: string): number {
  if (needle.length === 0) return 0;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`\\b${escaped}\\b`, 'g');
  const matches = haystack.match(re);
  return matches ? matches.length : 0;
}

export class TextSearch {
  #documents: Map<string, SearchDocument> = new Map();

  /** Add document(s) to the index. */
  add(doc: SearchDocument | SearchDocument[]): void {
    if (Array.isArray(doc)) {
      for (const d of doc) {
        this.#documents.set(d.id, d);
      }
    } else {
      this.#documents.set(doc.id, doc);
    }
  }

  /** Remove document by id. */
  remove(id: string): void {
    this.#documents.delete(id);
  }

  /** Update a document. */
  update(doc: SearchDocument): void {
    this.#documents.set(doc.id, doc);
  }

  /** Search for a query string. Returns ranked results. */
  search(query: string, options?: SearchOptions): SearchResult[] {
    const caseSensitive = options?.caseSensitive ?? false;
    const wholeWord = options?.wholeWord ?? false;
    const limit = options?.limit ?? 20;
    const minScore = options?.minScore ?? 0;

    if (!query) return [];

    const needle = caseSensitive ? query : query.toLowerCase();

    const results: SearchResult[] = [];

    for (const doc of this.#documents.values()) {
      const title = caseSensitive ? (doc.title ?? '') : (doc.title ?? '').toLowerCase();
      const content = caseSensitive ? doc.content : doc.content.toLowerCase();
      const tags = (doc.tags ?? []).map((t) => (caseSensitive ? t : t.toLowerCase()));

      let score = 0;

      if (wholeWord) {
        score += countWholeWordOccurrences(title, needle) * 3;
        score += countWholeWordOccurrences(content, needle);
        for (const tag of tags) {
          score += countWholeWordOccurrences(tag, needle) * 2;
        }
      } else {
        score += countOccurrences(title, needle) * 3;
        score += countOccurrences(content, needle);
        for (const tag of tags) {
          score += countOccurrences(tag, needle) * 2;
        }
      }

      if (score < 1 || score < minScore) continue;

      const snippets = extractHighlightsCI(doc.content, query, caseSensitive, wholeWord);

      results.push({ id: doc.id, score, highlights: snippets, document: doc });
    }

    results.sort((a, b) => b.score - a.score);

    return results.slice(0, limit);
  }

  /** Get document count. */
  get size(): number {
    return this.#documents.size;
  }

  /** Clear all documents. */
  clear(): void {
    this.#documents.clear();
  }
}

function extractHighlightsCI(
  text: string,
  needle: string,
  caseSensitive: boolean,
  wholeWord: boolean,
): string[] {
  const snippets: string[] = [];
  const positions: number[] = [];
  const textSearch = caseSensitive ? text : text.toLowerCase();
  const needleSearch = caseSensitive ? needle : needle.toLowerCase();

  if (wholeWord) {
    const escaped = needleSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const flags = caseSensitive ? 'g' : 'gi';
    const re = new RegExp(`\\b${escaped}\\b`, flags);
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      positions.push(m.index);
    }
  } else {
    let pos = 0;
    while (true) {
      pos = textSearch.indexOf(needleSearch, pos);
      if (pos === -1) break;
      positions.push(pos);
      pos += needleSearch.length;
    }
  }

  for (let i = 0; i < Math.min(positions.length, MAX_HIGHLIGHTS); i++) {
    const idx = positions[i];
    const start = Math.max(0, idx - HIGHLIGHT_CONTEXT);
    const end = Math.min(text.length, idx + needle.length + HIGHLIGHT_CONTEXT);
    snippets.push(text.slice(start, end));
  }

  return snippets;
}
