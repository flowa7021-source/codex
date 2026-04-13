// @ts-check
// ─── Boyer-Moore String Search ──────────────────────────────────────────────
// Classic bad-character heuristic implementation for single-pattern search.
// Average-case sub-linear in text length for natural-language inputs.

// ─── BoyerMoore ──────────────────────────────────────────────────────────────

export class BoyerMoore {
  readonly #pattern: string;
  readonly #badChar: Map<string, number>;

  constructor(pattern: string) {
    if (pattern.length === 0) {
      throw new Error('Pattern must not be empty');
    }
    this.#pattern = pattern;
    this.#badChar = BoyerMoore.#buildBadCharTable(pattern);
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /** Return indices of all occurrences of the pattern in `text`. */
  search(text: string): number[] {
    const results: number[] = [];
    const m = this.#pattern.length;
    const n = text.length;

    if (m > n) return results;

    let shift = 0;
    while (shift <= n - m) {
      let j = m - 1;

      // Match from right to left
      while (j >= 0 && this.#pattern[j] === text[shift + j]) {
        j--;
      }

      if (j < 0) {
        // Full match found
        results.push(shift);
        // Shift by 1 to find overlapping matches
        shift += 1;
      } else {
        const badCharShift = this.#getBadCharShift(text[shift + j], j);
        shift += Math.max(1, badCharShift);
      }
    }

    return results;
  }

  /** Return the index of the first occurrence, or -1 if not found. */
  searchFirst(text: string): number {
    const m = this.#pattern.length;
    const n = text.length;

    if (m > n) return -1;

    let shift = 0;
    while (shift <= n - m) {
      let j = m - 1;

      while (j >= 0 && this.#pattern[j] === text[shift + j]) {
        j--;
      }

      if (j < 0) return shift;

      const badCharShift = this.#getBadCharShift(text[shift + j], j);
      shift += Math.max(1, badCharShift);
    }

    return -1;
  }

  /** The pattern this searcher was built for. */
  get pattern(): string {
    return this.#pattern;
  }

  // ── Internals ───────────────────────────────────────────────────────────────

  /** Build the bad-character table: maps each character to its last index. */
  static #buildBadCharTable(pattern: string): Map<string, number> {
    const table = new Map<string, number>();
    for (let i = 0; i < pattern.length; i++) {
      table.set(pattern[i], i);
    }
    return table;
  }

  /**
   * Compute the shift from the bad-character rule.
   * If the mismatched character exists in the pattern to the left of `j`,
   * align it; otherwise shift past the mismatch position.
   */
  #getBadCharShift(char: string, j: number): number {
    const last = this.#badChar.get(char);
    if (last === undefined) {
      // Character not in pattern — shift so pattern moves past mismatch
      return j + 1;
    }
    // Shift so that the last occurrence of `char` in pattern aligns with
    // position j. If last > j the result is negative, Math.max(1, …) in
    // the caller handles that.
    return j - last;
  }
}

// ─── Standalone helper ───────────────────────────────────────────────────────

/** One-shot search: build a BoyerMoore searcher and return all occurrences. */
export function boyerMooreSearch(text: string, pattern: string): number[] {
  return new BoyerMoore(pattern).search(text);
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createBoyerMoore(pattern: string): BoyerMoore {
  return new BoyerMoore(pattern);
}
