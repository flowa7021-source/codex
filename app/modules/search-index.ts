// @ts-check
// ─── Search Index ────────────────────────────────────────────────────────────
// Simple in-memory inverted index for full-text search with TF-based scoring.

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * A document stored in the index.
 */
export interface IndexedDocument {
  id: string;
  [field: string]: unknown;
}

/**
 * Search result.
 */
export interface SearchResult {
  id: string;
  score: number;
  document: IndexedDocument;
}

// ─── Internals ───────────────────────────────────────────────────────────────

/** Common English stop words to omit from the index. */
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'it', 'its', 'as', 'be', 'was',
  'are', 'were', 'has', 'have', 'had', 'this', 'that', 'not', 'no',
]);

/**
 * Tokenize a string into lowercased terms, splitting on whitespace and
 * punctuation and filtering stop words.
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s\p{P}]+/u)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

/**
 * Compute per-field term frequencies for a document.
 * Returns a Map of term → frequency-in-doc (count of occurrences).
 */
function computeTF(doc: IndexedDocument, fields: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const field of fields) {
    const value = doc[field];
    if (value == null) continue;
    const terms = tokenize(String(value));
    for (const term of terms) {
      tf.set(term, (tf.get(term) ?? 0) + 1);
    }
  }
  return tf;
}

// ─── SearchIndex ─────────────────────────────────────────────────────────────

/**
 * A simple inverted index for full-text search.
 *
 * Builds an inverted index over the nominated fields of each added document.
 * Search results are ranked by the sum of raw term frequencies across all
 * matched query terms (a lightweight BM25-inspired score).
 *
 * @example
 *   const idx = new SearchIndex(['title', 'body']);
 *   idx.add({ id: '1', title: 'Hello world', body: 'Foo bar baz' });
 *   const results = idx.search('hello');
 */
export class SearchIndex {
  /** Field names to index on each document. */
  readonly #fields: string[];

  /** id → document */
  readonly #docs: Map<string, IndexedDocument> = new Map();

  /** id → per-term frequency map */
  readonly #tfMap: Map<string, Map<string, number>> = new Map();

  /** term → Set of doc ids that contain the term */
  readonly #invertedIndex: Map<string, Set<string>> = new Map();

  /**
   * @param fields - List of field names to index.
   */
  constructor(fields: string[]) {
    this.#fields = [...fields];
  }

  // ─── Mutation ──────────────────────────────────────────────────────────────

  /** Add a document to the index. */
  add(document: IndexedDocument): void {
    const { id } = document;
    // If already present, remove the old version first.
    if (this.#docs.has(id)) {
      this.#removeFromIndex(id);
    }
    const tf = computeTF(document, this.#fields);
    this.#docs.set(id, document);
    this.#tfMap.set(id, tf);
    for (const term of tf.keys()) {
      let posting = this.#invertedIndex.get(term);
      if (!posting) {
        posting = new Set<string>();
        this.#invertedIndex.set(term, posting);
      }
      posting.add(id);
    }
  }

  /** Update a document in the index (replaces the existing entry). */
  update(document: IndexedDocument): void {
    this.add(document);
  }

  /** Remove a document from the index by id. */
  remove(id: string): void {
    if (!this.#docs.has(id)) return;
    this.#removeFromIndex(id);
    this.#docs.delete(id);
    this.#tfMap.delete(id);
  }

  /** Clear all documents from the index. */
  clear(): void {
    this.#docs.clear();
    this.#tfMap.clear();
    this.#invertedIndex.clear();
  }

  // ─── Query ─────────────────────────────────────────────────────────────────

  /**
   * Search for documents matching the query.
   *
   * Tokenizes the query, looks up each term in the inverted index, and sums
   * the term-frequency scores for all matched terms per document.
   *
   * @param query - Free-text query string.
   * @param limit - Maximum number of results to return (default: all).
   * @returns Array of {@link SearchResult} sorted by score descending.
   */
  search(query: string, limit?: number): SearchResult[] {
    const queryTerms = tokenize(query);
    if (queryTerms.length === 0) return [];

    // Accumulate scores: docId → score
    const scores = new Map<string, number>();
    for (const term of queryTerms) {
      const posting = this.#invertedIndex.get(term);
      if (!posting) continue;
      for (const id of posting) {
        const tf = this.#tfMap.get(id)?.get(term) ?? 0;
        scores.set(id, (scores.get(id) ?? 0) + tf);
      }
    }

    // Build result objects and sort by score descending.
    let results: SearchResult[] = [];
    for (const [id, score] of scores) {
      const document = this.#docs.get(id);
      if (document) results.push({ id, score, document });
    }
    results.sort((a, b) => b.score - a.score);

    if (limit !== undefined && limit >= 0) {
      results = results.slice(0, limit);
    }
    return results;
  }

  // ─── Accessors ─────────────────────────────────────────────────────────────

  /** Number of indexed documents. */
  get size(): number {
    return this.#docs.size;
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  /** Remove a document's terms from the inverted index (does NOT delete from #docs/#tfMap). */
  #removeFromIndex(id: string): void {
    const tf = this.#tfMap.get(id);
    if (!tf) return;
    for (const term of tf.keys()) {
      const posting = this.#invertedIndex.get(term);
      if (posting) {
        posting.delete(id);
        if (posting.size === 0) this.#invertedIndex.delete(term);
      }
    }
  }
}
