// @ts-check
// ─── Embeddings ──────────────────────────────────────────────────────────────
// Lightweight text-embedding utilities: TF-IDF, bag-of-words, and math helpers.
// No external dependencies.

// ─── Stop Words ───────────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'it', 'its', 'was', 'are', 'be',
  'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
  'would', 'could', 'should', 'may', 'might', 'shall', 'can', 'not',
  'no', 'nor', 'so', 'yet', 'both', 'either', 'neither', 'this', 'that',
  'these', 'those', 'i', 'you', 'he', 'she', 'we', 'they', 'me', 'him',
  'her', 'us', 'them', 'my', 'your', 'his', 'our', 'their', 'what',
  'which', 'who', 'whom', 'as', 'if', 'then', 'than', 'when', 'where',
]);

// ─── Tokenizer ────────────────────────────────────────────────────────────────

/**
 * Simple tokenizer: lowercases input, splits on non-alphanumeric characters,
 * and optionally removes common English stop words.
 * Empty tokens produced by splitting are always discarded.
 */
export function tokenize(text: string, removeStopWords = false): string[] {
  const tokens = text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 0);
  if (removeStopWords) {
    return tokens.filter((t) => !STOP_WORDS.has(t));
  }
  return tokens;
}

// ─── Math Utilities ───────────────────────────────────────────────────────────

/**
 * Cosine similarity between two vectors.
 * Returns 0 if either vector has zero magnitude.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new RangeError(`vectors must have equal length (${a.length} vs ${b.length})`);
  }
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

/**
 * Euclidean distance between two vectors.
 */
export function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new RangeError(`vectors must have equal length (${a.length} vs ${b.length})`);
  }
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

/**
 * Normalize a vector to unit length (L2 norm).
 * Returns a zero vector unchanged.
 */
export function normalize(v: number[]): number[] {
  let mag = 0;
  for (const x of v) mag += x * x;
  mag = Math.sqrt(mag);
  if (mag === 0) return v.slice();
  return v.map((x) => x / mag);
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

/** Build a sorted vocabulary array from a corpus of token arrays. */
function buildVocabulary(tokenized: string[][]): string[] {
  const vocab = new Set<string>();
  for (const tokens of tokenized) {
    for (const t of tokens) vocab.add(t);
  }
  return Array.from(vocab).sort();
}

/** Count token occurrences in an array of tokens. */
function termFrequency(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const t of tokens) {
    tf.set(t, (tf.get(t) ?? 0) + 1);
  }
  return tf;
}

// ─── BagOfWordsVectorizer ─────────────────────────────────────────────────────

/**
 * Bag-of-words vectorizer.
 * Produces raw term-frequency (count) vectors.
 */
export class BagOfWordsVectorizer {
  #vocab: string[] = [];

  /** Fit on a corpus: build vocabulary from all documents. */
  fit(corpus: string[]): void {
    const tokenized = corpus.map((doc) => tokenize(doc));
    this.#vocab = buildVocabulary(tokenized);
  }

  /**
   * Transform a document to a BoW count vector.
   * Must call `fit` first.
   */
  transform(document: string): number[] {
    if (this.#vocab.length === 0) {
      throw new Error('BagOfWordsVectorizer has not been fitted yet');
    }
    const tf = termFrequency(tokenize(document));
    return this.#vocab.map((term) => tf.get(term) ?? 0);
  }

  /** Fit on a corpus and return the transformed matrix. */
  fitTransform(corpus: string[]): number[][] {
    this.fit(corpus);
    return corpus.map((doc) => this.transform(doc));
  }

  /** The vocabulary terms in sorted order. */
  get vocabulary(): string[] {
    return this.#vocab.slice();
  }
}

// ─── TfIdfVectorizer ──────────────────────────────────────────────────────────

/**
 * TF-IDF vectorizer.
 * TF = term frequency (count / doc length).
 * IDF = log((N + 1) / (df + 1)) + 1   (smooth IDF, sklearn-style).
 */
export class TfIdfVectorizer {
  #vocab: string[] = [];
  #idf: number[] = [];
  #numDocs = 0;

  /** Fit on a corpus: build vocabulary and compute IDF weights. */
  fit(corpus: string[]): void {
    const tokenized = corpus.map((doc) => tokenize(doc));
    this.#vocab = buildVocabulary(tokenized);
    this.#numDocs = corpus.length;

    // Document frequency per term.
    const df = new Map<string, number>();
    for (const tokens of tokenized) {
      const seen = new Set(tokens);
      for (const term of seen) {
        df.set(term, (df.get(term) ?? 0) + 1);
      }
    }

    const N = this.#numDocs;
    this.#idf = this.#vocab.map((term) => {
      const d = df.get(term) ?? 0;
      return Math.log((N + 1) / (d + 1)) + 1;
    });
  }

  /**
   * Transform a document to a TF-IDF vector.
   * Must call `fit` first.
   */
  transform(document: string): number[] {
    if (this.#vocab.length === 0) {
      throw new Error('TfIdfVectorizer has not been fitted yet');
    }
    const tokens = tokenize(document);
    const tf = termFrequency(tokens);
    const len = tokens.length || 1; // avoid division by zero
    return this.#vocab.map((term, i) => {
      const count = tf.get(term) ?? 0;
      return (count / len) * this.#idf[i];
    });
  }

  /** Fit on a corpus and return the TF-IDF matrix. */
  fitTransform(corpus: string[]): number[][] {
    this.fit(corpus);
    return corpus.map((doc) => this.transform(doc));
  }

  /** The vocabulary terms in sorted order. */
  get vocabulary(): string[] {
    return this.#vocab.slice();
  }
}
