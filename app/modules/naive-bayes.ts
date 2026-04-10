// @ts-check
// ─── Naive Bayes Text Classifier ────────────────────────────────────────────
// A multinomial Naive Bayes classifier for text categorisation. Applies
// Laplace (add-1) smoothing to avoid zero-probability issues.

// ─── Tokenizer ───────────────────────────────────────────────────────────────

/**
 * Simple word tokenizer: lowercases the input, strips non-alphanumeric
 * characters (except spaces), and splits on whitespace. Returns an empty
 * array for blank or whitespace-only input.
 */
export function tokenize(text: string): string[] {
  const cleaned = text.toLowerCase().replace(/[^a-z0-9\s]/g, '');
  const tokens = cleaned.split(/\s+/).filter((t) => t.length > 0);
  return tokens;
}

// ─── NaiveBayes Class ────────────────────────────────────────────────────────

export class NaiveBayes {
  /** Total document count per category. */
  private catDocCount = new Map<string, number>();
  /** Word frequency per category: category → (word → count). */
  private catWordCount = new Map<string, Map<string, number>>();
  /** Total word count per category. */
  private catTotalWords = new Map<string, number>();
  /** Global vocabulary (all unique words seen during training). */
  private vocabulary = new Set<string>();
  /** Total number of documents trained on. */
  private totalDocs = 0;

  constructor() {
    // intentionally empty
  }

  /** Whether at least one document has been trained. */
  get isTrained(): boolean {
    return this.totalDocs > 0;
  }

  /** List of known categories (in insertion order). */
  get categories(): string[] {
    return [...this.catDocCount.keys()];
  }

  /**
   * Train the classifier with a single text document and its category.
   */
  train(text: string, category: string): void {
    this.totalDocs++;
    this.catDocCount.set(category, (this.catDocCount.get(category) ?? 0) + 1);

    if (!this.catWordCount.has(category)) {
      this.catWordCount.set(category, new Map());
    }

    const words = tokenize(text);
    const wordMap = this.catWordCount.get(category)!;

    for (const word of words) {
      this.vocabulary.add(word);
      wordMap.set(word, (wordMap.get(word) ?? 0) + 1);
    }

    this.catTotalWords.set(
      category,
      (this.catTotalWords.get(category) ?? 0) + words.length,
    );
  }

  /**
   * Compute the log-posterior for each category given `text`, then return
   * a Map of category → posterior probability (normalised to sum to 1).
   */
  probabilities(text: string): Map<string, number> {
    const words = tokenize(text);
    const vocabSize = this.vocabulary.size;

    // Compute log-posteriors.
    const logScores = new Map<string, number>();

    for (const category of this.catDocCount.keys()) {
      // Log prior: log P(category)
      let logP = Math.log(this.catDocCount.get(category)! / this.totalDocs);

      const wordMap = this.catWordCount.get(category)!;
      const totalWords = this.catTotalWords.get(category) ?? 0;

      // Log likelihood with Laplace smoothing.
      for (const word of words) {
        const wordCount = wordMap.get(word) ?? 0;
        logP += Math.log((wordCount + 1) / (totalWords + vocabSize));
      }

      logScores.set(category, logP);
    }

    // Convert log-scores to normalised probabilities via the log-sum-exp trick.
    const maxLog = Math.max(...logScores.values());
    let expSum = 0;
    const expScores = new Map<string, number>();

    for (const [cat, logS] of logScores) {
      const e = Math.exp(logS - maxLog);
      expScores.set(cat, e);
      expSum += e;
    }

    const result = new Map<string, number>();
    for (const [cat, e] of expScores) {
      result.set(cat, e / expSum);
    }

    return result;
  }

  /**
   * Classify `text` into the most probable category.
   * Throws if the classifier has not been trained.
   */
  classify(text: string): string {
    if (!this.isTrained) {
      throw new Error('Classifier has not been trained');
    }

    const probs = this.probabilities(text);
    let bestCat = '';
    let bestProb = -Infinity;

    for (const [cat, prob] of probs) {
      if (prob > bestProb) {
        bestProb = prob;
        bestCat = cat;
      }
    }

    return bestCat;
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/** Create a new NaiveBayes classifier instance. */
export function createNaiveBayes(): NaiveBayes {
  return new NaiveBayes();
}
