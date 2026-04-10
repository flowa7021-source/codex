// @ts-check
// ─── Text Classifier ─────────────────────────────────────────────────────────
// Multinomial Naive Bayes text classifier with Laplace smoothing and optional
// stop-word removal.  Suitable for document categorisation tasks.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ClassifierOptions {
  /** Laplace smoothing parameter. Default: 1. */
  alpha?: number;
  /** Remove stop words. Default: true. */
  removeStopWords?: boolean;
}

// ─── Stop Words ──────────────────────────────────────────────────────────────

/** A minimal English stop-word list. */
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'could', 'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought',
  'used', 'it', 'its', 'this', 'that', 'these', 'those', 'i', 'me', 'my',
  'we', 'our', 'you', 'your', 'he', 'she', 'they', 'them', 'his', 'her',
  'their', 'what', 'which', 'who', 'whom', 'not', 'no', 'so', 'if', 'as',
]);

// ─── Text pre-processing ──────────────────────────────────────────────────────

/**
 * Tokenise a string: lower-case, strip punctuation, split on whitespace,
 * and optionally remove stop words.
 */
function tokenise(text: string, removeStopWords: boolean): string[] {
  const raw = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 0);

  return removeStopWords ? raw.filter(w => !STOP_WORDS.has(w)) : raw;
}

// ─── TextClassifier ──────────────────────────────────────────────────────────

export class TextClassifier {
  readonly #alpha: number;
  readonly #removeStopWords: boolean;

  // ── Per-class statistics (populated during training) ─────────────────────

  /** All unique classes seen during training, in insertion order. */
  #classes: string[] = [];
  /** All unique tokens seen during training (the vocabulary). */
  #vocab: string[] = [];
  /** Set for O(1) vocab membership checks. */
  #vocabSet = new Set<string>();
  /** Prior log-probabilities: log P(class). */
  #logPrior = new Map<string, number>();
  /** Smoothed log-likelihoods: log P(token | class). */
  #logLikelihood = new Map<string, Map<string, number>>();

  constructor(options: ClassifierOptions = {}) {
    this.#alpha = options.alpha ?? 1;
    this.#removeStopWords = options.removeStopWords ?? true;
  }

  // ── Getters ─────────────────────────────────────────────────────────────────

  get classes(): string[] {
    return [...this.#classes];
  }

  get vocabulary(): string[] {
    return [...this.#vocab];
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Train the classifier on `texts` with corresponding `labels`.
   * Can be called multiple times to add more training data (incremental).
   * Re-calling with the same data will retrain from scratch on all provided data.
   */
  train(texts: string[], labels: string[]): void {
    if (texts.length !== labels.length) {
      throw new Error('texts and labels must have the same length');
    }

    // ── Collect vocabulary and per-class word counts ─────────────────────────

    /** Per-class raw token frequency maps. */
    const classCounts = new Map<string, Map<string, number>>();
    /** How many documents belong to each class. */
    const classDocs = new Map<string, number>();
    const totalDocs = texts.length;

    for (let i = 0; i < texts.length; i++) {
      const label = labels[i];
      const tokens = tokenise(texts[i], this.#removeStopWords);

      if (!classCounts.has(label)) {
        classCounts.set(label, new Map<string, number>());
        classDocs.set(label, 0);
      }

      classDocs.set(label, (classDocs.get(label) ?? 0) + 1);

      const counts = classCounts.get(label)!;
      for (const token of tokens) {
        this.#vocabSet.add(token);
        counts.set(token, (counts.get(token) ?? 0) + 1);
      }
    }

    this.#vocab = [...this.#vocabSet];
    this.#classes = [...classCounts.keys()];
    const V = this.#vocab.length;

    // ── Compute log-priors and log-likelihoods ────────────────────────────────

    this.#logPrior.clear();
    this.#logLikelihood.clear();

    for (const cls of this.#classes) {
      // log P(class)
      this.#logPrior.set(cls, Math.log((classDocs.get(cls) ?? 0) / totalDocs));

      // Smoothed log P(token | class)
      const counts = classCounts.get(cls)!;
      const totalTokens = [...counts.values()].reduce((a, b) => a + b, 0);
      const denominator = totalTokens + this.#alpha * V;

      const llMap = new Map<string, number>();
      for (const token of this.#vocab) {
        const count = counts.get(token) ?? 0;
        llMap.set(token, Math.log((count + this.#alpha) / denominator));
      }
      this.#logLikelihood.set(cls, llMap);
    }
  }

  /** Predict the most likely class label for `text`. */
  predict(text: string): string {
    const proba = this.#scoreAll(text);
    let bestClass = this.#classes[0] ?? '';
    let bestScore = -Infinity;

    for (const [cls, score] of Object.entries(proba)) {
      if (score > bestScore) {
        bestScore = score;
        bestClass = cls;
      }
    }

    return bestClass;
  }

  /**
   * Return a probability distribution over all classes for `text`.
   * Uses the softmax of log-scores so values sum to 1.
   */
  predictProba(text: string): Record<string, number> {
    const scores = this.#scoreAll(text);
    return softmax(scores);
  }

  /** Predict labels for a batch of texts. */
  predictBatch(texts: string[]): string[] {
    return texts.map(t => this.predict(t));
  }

  /** Compute accuracy on a labelled test set. */
  evaluate(texts: string[], labels: string[]): number {
    if (texts.length === 0) return 0;
    const predictions = this.predictBatch(texts);
    const correct = predictions.filter((p, i) => p === labels[i]).length;
    return correct / texts.length;
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  /**
   * Compute the un-normalised log-score for each class given `text`.
   * Returns a plain object mapping class → log-score.
   */
  #scoreAll(text: string): Record<string, number> {
    const tokens = tokenise(text, this.#removeStopWords);
    const result: Record<string, number> = {};

    for (const cls of this.#classes) {
      let score = this.#logPrior.get(cls) ?? 0;
      const llMap = this.#logLikelihood.get(cls)!;

      for (const token of tokens) {
        if (this.#vocabSet.has(token)) {
          score += llMap.get(token) ?? 0;
        }
        // Unknown tokens are silently ignored (zero contribution).
      }

      result[cls] = score;
    }

    return result;
  }
}

// ─── Softmax ─────────────────────────────────────────────────────────────────

/**
 * Convert a map of raw log-scores to a probability distribution via softmax.
 * Subtracts the max for numerical stability.
 */
function softmax(scores: Record<string, number>): Record<string, number> {
  const keys = Object.keys(scores);
  if (keys.length === 0) return {};

  const max = Math.max(...keys.map(k => scores[k]));
  const exps: Record<string, number> = {};
  let sum = 0;

  for (const k of keys) {
    exps[k] = Math.exp(scores[k] - max);
    sum += exps[k];
  }

  const result: Record<string, number> = {};
  for (const k of keys) {
    result[k] = exps[k] / sum;
  }
  return result;
}
