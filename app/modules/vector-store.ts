// @ts-check
// ─── Vector Store ────────────────────────────────────────────────────────────
// Simple in-memory vector database with cosine-similarity search.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VectorEntry<M = Record<string, unknown>> {
  id: string;
  vector: number[];
  metadata?: M;
}

export interface SearchResult<M = Record<string, unknown>> {
  id: string;
  score: number;
  metadata?: M;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Compute the cosine similarity between two vectors.
 * Returns 0 if either vector has zero magnitude.
 */
function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

// ─── VectorStore ─────────────────────────────────────────────────────────────

export class VectorStore<M = Record<string, unknown>> {
  readonly #dims: number;
  readonly #entries: Map<string, VectorEntry<M>> = new Map();

  constructor(dimensions: number) {
    if (!Number.isInteger(dimensions) || dimensions < 1) {
      throw new RangeError(`dimensions must be a positive integer, got ${dimensions}`);
    }
    this.#dims = dimensions;
  }

  /** Add or update a vector. */
  upsert(entry: VectorEntry<M>): void {
    if (entry.vector.length !== this.#dims) {
      throw new RangeError(
        `vector length ${entry.vector.length} does not match store dimensions ${this.#dims}`,
      );
    }
    this.#entries.set(entry.id, { ...entry, vector: entry.vector.slice() });
  }

  /** Remove by id. Returns true if found and removed. */
  delete(id: string): boolean {
    return this.#entries.delete(id);
  }

  /** Get a stored entry by id. */
  get(id: string): VectorEntry<M> | undefined {
    const e = this.#entries.get(id);
    if (!e) return undefined;
    // Return a shallow copy so callers cannot mutate internal state.
    return { ...e, vector: e.vector.slice() };
  }

  /**
   * Find k nearest neighbours by cosine similarity.
   * Results are sorted descending by score (highest similarity first).
   */
  search(query: number[], k = 10): SearchResult<M>[] {
    if (query.length !== this.#dims) {
      throw new RangeError(
        `query length ${query.length} does not match store dimensions ${this.#dims}`,
      );
    }
    const results: SearchResult<M>[] = [];
    for (const entry of this.#entries.values()) {
      results.push({
        id: entry.id,
        score: cosine(query, entry.vector),
        metadata: entry.metadata,
      });
    }
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, k);
  }

  /**
   * Find all entries whose cosine similarity to `query` is >= `threshold`.
   * Results are sorted descending by score.
   */
  searchByThreshold(query: number[], threshold: number): SearchResult<M>[] {
    if (query.length !== this.#dims) {
      throw new RangeError(
        `query length ${query.length} does not match store dimensions ${this.#dims}`,
      );
    }
    const results: SearchResult<M>[] = [];
    for (const entry of this.#entries.values()) {
      const score = cosine(query, entry.vector);
      if (score >= threshold) {
        results.push({ id: entry.id, score, metadata: entry.metadata });
      }
    }
    results.sort((a, b) => b.score - a.score);
    return results;
  }

  /** Number of stored entries. */
  get size(): number {
    return this.#entries.size;
  }

  /** All stored ids. */
  ids(): string[] {
    return Array.from(this.#entries.keys());
  }
}
