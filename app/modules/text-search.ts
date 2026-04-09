// @ts-check
// ─── Text Search ─────────────────────────────────────────────────────────────
// Full-text search with scoring and highlight extraction.

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
  // Escape special regex chars in needle
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`\\b${escaped}\\b`, 'g');
  const matches = haystack.match(re);
  return matches ? matches.length : 0;
}

// ─── TextSearch ───────────────────────────────────────────────────────────────

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

      const highlights = extractHighlightsCI(doc.content, query, caseSensitive, wholeWord);

      results.push({ id: doc.id, score, highlights, document: doc });
    }

    // Sort descending by score
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

// ─── Highlight helper (handles case-insensitive search in original text) ──────

function extractHighlightsCI(
  text: string,
  needle: string,
  caseSensitive: boolean,
  wholeWord: boolean,
): string[] {
  const highlights: string[] = [];
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
    highlights.push(text.slice(start, end));
  }

  return highlights;
}
