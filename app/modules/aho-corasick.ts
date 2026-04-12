// @ts-check
// ─── Aho-Corasick Multi-Pattern String Matching ─────────────────────────────
// Builds an automaton from a set of patterns and scans text in O(n + m + z)
// where n = text length, m = total pattern length, z = number of matches.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AhoCorasickMatch {
  pattern: string;
  index: number;
}

// ─── Trie Node ───────────────────────────────────────────────────────────────

interface TrieNode {
  children: Map<string, TrieNode>;
  fail: TrieNode | null;
  output: string[];
}

function createNode(): TrieNode {
  return { children: new Map(), fail: null, output: [] };
}

// ─── AhoCorasick ─────────────────────────────────────────────────────────────

export class AhoCorasick {
  readonly #root: TrieNode;
  readonly #patternCount: number;

  constructor(patterns: string[]) {
    // Deduplicate and filter empty strings
    const unique = [...new Set(patterns.filter(p => p.length > 0))];
    this.#patternCount = unique.length;
    this.#root = createNode();
    this.#buildTrie(unique);
    this.#buildFailureLinks();
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /** Return every occurrence of every pattern in `text`. */
  search(text: string): AhoCorasickMatch[] {
    const results: AhoCorasickMatch[] = [];
    let node = this.#root;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];

      while (node !== this.#root && !node.children.has(ch)) {
        node = node.fail!;
      }

      if (node.children.has(ch)) {
        node = node.children.get(ch)!;
      }

      // Collect all outputs reachable via the output / fail chain
      let tmp: TrieNode | null = node;
      while (tmp !== this.#root) {
        for (const pattern of tmp!.output) {
          results.push({ pattern, index: i - pattern.length + 1 });
        }
        tmp = tmp!.fail!;
      }
    }

    return results;
  }

  /** Return `true` if any pattern occurs in `text`. */
  contains(text: string): boolean {
    let node = this.#root;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];

      while (node !== this.#root && !node.children.has(ch)) {
        node = node.fail!;
      }

      if (node.children.has(ch)) {
        node = node.children.get(ch)!;
      }

      let tmp: TrieNode | null = node;
      while (tmp !== this.#root) {
        if (tmp!.output.length > 0) return true;
        tmp = tmp!.fail!;
      }
    }

    return false;
  }

  /** Number of unique non-empty patterns in the automaton. */
  get patternCount(): number {
    return this.#patternCount;
  }

  // ── Build helpers ───────────────────────────────────────────────────────────

  #buildTrie(patterns: string[]): void {
    for (const pattern of patterns) {
      let node = this.#root;
      for (const ch of pattern) {
        if (!node.children.has(ch)) {
          node.children.set(ch, createNode());
        }
        node = node.children.get(ch)!;
      }
      node.output.push(pattern);
    }
  }

  #buildFailureLinks(): void {
    const queue: TrieNode[] = [];

    // Depth-1 nodes fail back to root
    for (const child of this.#root.children.values()) {
      child.fail = this.#root;
      queue.push(child);
    }

    while (queue.length > 0) {
      const current = queue.shift()!;

      for (const [ch, child] of current.children) {
        let fallback = current.fail!;

        while (fallback !== this.#root && !fallback.children.has(ch)) {
          fallback = fallback.fail!;
        }

        child.fail = fallback.children.has(ch)
          ? fallback.children.get(ch)!
          : this.#root;

        queue.push(child);
      }
    }
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createAhoCorasick(patterns: string[]): AhoCorasick {
  return new AhoCorasick(patterns);
}
