// @ts-check
// ═══════════════════════════════════════════════════════════════════════
// NovaReader 3.0 — OCR Verification Tool
// Word-by-word navigation and correction of OCR results
// ═══════════════════════════════════════════════════════════════════════

/**
 * @typedef {Object} OcrWord
 * @property {string} text
 * @property {number} confidence  - 0..1
 * @property {{x: number, y: number, width: number, height: number}} bbox
 * @property {number} pageNum     - 1-based
 * @property {boolean} [corrected]
 * @property {string}  [originalText]
 */

/**
 * @typedef {Object} VerifyStats
 * @property {number} totalWords
 * @property {number} lowConfidenceWords
 * @property {number} correctedWords
 * @property {number} skippedWords
 * @property {number} verifiedWords
 * @property {number} averageConfidence
 */

// ---------------------------------------------------------------------------
// OcrVerifyTool
// ---------------------------------------------------------------------------

export class OcrVerifyTool {
  /**
   * @param {OcrWord[]} words - OCR result words
   * @param {object} [options]
   * @param {number} [options.confidenceThreshold] - below this = needs review (0..1)
   * @param {boolean} [options.showAllWords] - if true, navigate all words not just low-confidence
   */
  constructor(words, options = {}) {
    const { confidenceThreshold = 0.7, showAllWords = false } = options;

    /** @type {OcrWord[]} */
    this._allWords = words.map(w => ({ ...w }));

    /** @type {number} */
    this._confidenceThreshold = confidenceThreshold;

    /** @type {boolean} */
    this._showAllWords = showAllWords;

    /** @type {OcrWord[]} */
    this._reviewQueue = showAllWords
      ? [...this._allWords]
      : this._allWords.filter(w => w.confidence < confidenceThreshold);

    /** @type {number} */
    this._currentIndex = -1;

    /** @type {Set<number>} */
    this._skipped = new Set();

    /** @type {Set<number>} */
    this._verified = new Set();

    /** @type {Map<number, string>} */
    this._corrections = new Map();
  }

  // -----------------------------------------------------------------------
  // Navigation
  // -----------------------------------------------------------------------

  /**
   * Move to the next word in the review queue.
   * @returns {OcrWord|null}
   */
  next() {
    if (this._currentIndex < this._reviewQueue.length - 1) {
      this._currentIndex++;
      return this.current();
    }
    return null;
  }

  /**
   * Move to the previous word.
   * @returns {OcrWord|null}
   */
  previous() {
    if (this._currentIndex > 0) {
      this._currentIndex--;
      return this.current();
    }
    return null;
  }

  /**
   * Get current word.
   * @returns {OcrWord|null}
   */
  current() {
    if (this._currentIndex < 0 || this._currentIndex >= this._reviewQueue.length) {
      return null;
    }
    return this._reviewQueue[this._currentIndex];
  }

  /**
   * Jump to a specific index.
   * @param {number} index
   * @returns {OcrWord|null}
   */
  jumpTo(index) {
    if (index >= 0 && index < this._reviewQueue.length) {
      this._currentIndex = index;
      return this.current();
    }
    return null;
  }

  /**
   * Jump to the next unchecked (not verified and not skipped) word.
   * @returns {OcrWord|null}
   */
  nextUnchecked() {
    for (let i = this._currentIndex + 1; i < this._reviewQueue.length; i++) {
      if (!this._verified.has(i) && !this._skipped.has(i)) {
        this._currentIndex = i;
        return this.current();
      }
    }
    return null;
  }

  // -----------------------------------------------------------------------
  // Actions
  // -----------------------------------------------------------------------

  /**
   * Correct the current word.
   * @param {string} newText
   * @returns {boolean}
   */
  correct(newText) {
    const word = this.current();
    if (!word) return false;

    word.originalText = word.originalText || word.text;
    word.text = newText;
    word.corrected = true;
    word.confidence = 1.0;

    this._corrections.set(this._currentIndex, newText);
    this._verified.add(this._currentIndex);
    this._skipped.delete(this._currentIndex);

    return true;
  }

  /**
   * Accept (verify) the current word as correct.
   * @returns {boolean}
   */
  accept() {
    if (this._currentIndex < 0 || this._currentIndex >= this._reviewQueue.length) {
      return false;
    }
    this._verified.add(this._currentIndex);
    this._skipped.delete(this._currentIndex);
    return true;
  }

  /**
   * Skip the current word.
   * @returns {boolean}
   */
  skip() {
    if (this._currentIndex < 0 || this._currentIndex >= this._reviewQueue.length) {
      return false;
    }
    this._skipped.add(this._currentIndex);
    return true;
  }

  /**
   * Accept all remaining unchecked words.
   * @returns {number} count of newly accepted words
   */
  acceptAll() {
    let count = 0;
    for (let i = 0; i < this._reviewQueue.length; i++) {
      if (!this._verified.has(i) && !this._skipped.has(i)) {
        this._verified.add(i);
        count++;
      }
    }
    return count;
  }

  // -----------------------------------------------------------------------
  // Statistics
  // -----------------------------------------------------------------------

  /**
   * Get verification statistics.
   * @returns {VerifyStats}
   */
  getStats() {
    const totalWords = this._allWords.length;
    const lowConfidenceWords = this._allWords.filter(
      w => w.confidence < this._confidenceThreshold,
    ).length;
    const correctedWords = this._corrections.size;
    const skippedWords = this._skipped.size;
    const verifiedWords = this._verified.size;

    let totalConf = 0;
    for (const w of this._allWords) {
      totalConf += w.confidence;
    }
    const averageConfidence = totalWords > 0
      ? Math.round((totalConf / totalWords) * 100) / 100
      : 0;

    return {
      totalWords,
      lowConfidenceWords,
      correctedWords,
      skippedWords,
      verifiedWords,
      averageConfidence,
    };
  }

  /**
   * Check if review is complete (all words verified or skipped).
   * @returns {boolean}
   */
  isComplete() {
    for (let i = 0; i < this._reviewQueue.length; i++) {
      if (!this._verified.has(i) && !this._skipped.has(i)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Get completion percentage.
   * @returns {number} 0..100
   */
  getProgress() {
    if (this._reviewQueue.length === 0) return 100;
    const done = this._verified.size + this._skipped.size;
    return Math.round((done / this._reviewQueue.length) * 100);
  }

  // -----------------------------------------------------------------------
  // Getters
  // -----------------------------------------------------------------------

  /** @returns {number} */
  get queueLength() {
    return this._reviewQueue.length;
  }

  /** @returns {number} */
  get currentIndex() {
    return this._currentIndex;
  }

  /** @returns {OcrWord[]} */
  get allWords() {
    return this._allWords;
  }

  /** @returns {OcrWord[]} */
  get correctedWords() {
    return this._reviewQueue.filter((_, i) => this._corrections.has(i));
  }

  /**
   * Get the final corrected text for all words.
   * @returns {OcrWord[]}
   */
  getFinalWords() {
    return this._allWords.map(w => ({ ...w }));
  }

  /**
   * Filter review queue by page number.
   * @param {number} pageNum
   * @returns {OcrWord[]}
   */
  getWordsByPage(pageNum) {
    return this._reviewQueue.filter(w => w.pageNum === pageNum);
  }

  /**
   * Reset all corrections and navigation state.
   */
  reset() {
    this._currentIndex = -1;
    this._skipped.clear();
    this._verified.clear();
    this._corrections.clear();
    for (const word of this._allWords) {
      if (word.originalText) {
        word.text = word.originalText;
        delete word.originalText;
        delete word.corrected;
      }
    }
  }
}
