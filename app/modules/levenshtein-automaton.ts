// @ts-check
// ─── Levenshtein Automaton ──────────────────────────────────────────────────
// Fuzzy string matching using Levenshtein (edit) distance.

// ─── Public API ───────────────────────────────────────────────────────────────

export class LevenshteinAutomaton {
  #word: string;
  #maxDistance: number;

  constructor(word: string, maxDistance: number) {
    this.#word = word;
    this.#maxDistance = maxDistance;
  }

  /** The reference word this automaton was built for. */
  get word(): string {
    return this.#word;
  }

  /** Maximum edit distance threshold. */
  get maxDistance(): number {
    return this.#maxDistance;
  }

  /** Returns true if the candidate is within maxDistance edits of the word. */
  matches(candidate: string): boolean {
    return this.distance(candidate) <= this.#maxDistance;
  }

  /** Compute the exact Levenshtein distance between the word and candidate. */
  distance(candidate: string): number {
    return levenshteinDistance(this.#word, candidate);
  }
}

// ─── Levenshtein Distance ─────────────────────────────────────────────────────

/**
 * Classic dynamic-programming Levenshtein distance with two-row
 * space optimization.
 */
function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;

  // Short-circuit trivial cases.
  if (m === 0) return n;
  if (n === 0) return m;

  // Ensure a is the shorter string for space efficiency.
  if (m > n) return levenshteinDistance(b, a);

  let prev = new Array<number>(m + 1);
  let curr = new Array<number>(m + 1);

  for (let i = 0; i <= m; i++) prev[i] = i;

  for (let j = 1; j <= n; j++) {
    curr[0] = j;
    for (let i = 1; i <= m; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[i] = Math.min(
        prev[i] + 1,       // deletion
        curr[i - 1] + 1,   // insertion
        prev[i - 1] + cost, // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }

  return prev[m];
}

// ─── Fuzzy Search ─────────────────────────────────────────────────────────────

/**
 * Search a dictionary for all words within maxDistance edits of the query.
 * Results are sorted by distance ascending, then alphabetically.
 */
export function fuzzySearch(
  dictionary: string[],
  query: string,
  maxDistance: number,
): { word: string; distance: number }[] {
  const results: { word: string; distance: number }[] = [];

  for (const word of dictionary) {
    const d = levenshteinDistance(query, word);
    if (d <= maxDistance) {
      results.push({ word, distance: d });
    }
  }

  results.sort((a, b) => a.distance - b.distance || a.word.localeCompare(b.word));
  return results;
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/** Create a new LevenshteinAutomaton instance. */
export function createLevenshteinAutomaton(
  word: string,
  maxDistance: number,
): LevenshteinAutomaton {
  return new LevenshteinAutomaton(word, maxDistance);
}
