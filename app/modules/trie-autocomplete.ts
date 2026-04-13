// @ts-check
// ─── Trie Autocomplete ──────────────────────────────────────────────────────
// A trie optimized for autocomplete with weighted ranking.

// ─── Internal Node ────────────────────────────────────────────────────────────

class AutocompleteNode {
  children: Map<string, AutocompleteNode> = new Map();
  isEnd = false;
  weight = 0;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export class AutocompleteTrie {
  #root: AutocompleteNode = new AutocompleteNode();
  #size = 0;

  /** Insert a word with an optional weight for ranking (default 1). */
  insert(word: string, weight: number = 1): void {
    let node = this.#root;
    for (const ch of word) {
      let child = node.children.get(ch);
      if (!child) {
        child = new AutocompleteNode();
        node.children.set(ch, child);
      }
      node = child;
    }
    if (!node.isEnd) {
      this.#size++;
    }
    node.isEnd = true;
    node.weight = weight;
  }

  /** Search for words matching a prefix, sorted by weight descending. */
  search(prefix: string, limit?: number): { word: string; weight: number }[] {
    const node = this.#traverse(prefix);
    if (node === null) return [];
    const results: { word: string; weight: number }[] = [];
    this.#collect(node, prefix, results);
    results.sort((a, b) => b.weight - a.weight);
    if (limit !== undefined && limit >= 0) {
      return results.slice(0, limit);
    }
    return results;
  }

  /** Returns true if the exact word exists. */
  has(word: string): boolean {
    const node = this.#traverse(word);
    return node !== null && node.isEnd;
  }

  /** Delete a word from the trie. Returns true if deleted. */
  delete(word: string): boolean {
    return this.#delete(this.#root, word, 0);
  }

  /** Number of unique words. */
  get size(): number {
    return this.#size;
  }

  /** Get all words in the trie. */
  words(): string[] {
    const results: { word: string; weight: number }[] = [];
    this.#collect(this.#root, '', results);
    return results.map(r => r.word);
  }

  /** Clear all words. */
  clear(): void {
    this.#root = new AutocompleteNode();
    this.#size = 0;
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────

  #traverse(prefix: string): AutocompleteNode | null {
    let node = this.#root;
    for (const ch of prefix) {
      const child = node.children.get(ch);
      if (!child) return null;
      node = child;
    }
    return node;
  }

  #collect(
    node: AutocompleteNode,
    prefix: string,
    results: { word: string; weight: number }[],
  ): void {
    if (node.isEnd) {
      results.push({ word: prefix, weight: node.weight });
    }
    for (const [ch, child] of node.children) {
      this.#collect(child, prefix + ch, results);
    }
  }

  #delete(node: AutocompleteNode, word: string, depth: number): boolean {
    if (depth === word.length) {
      if (!node.isEnd) return false;
      node.isEnd = false;
      node.weight = 0;
      this.#size--;
      return true;
    }
    const ch = word[depth];
    const child = node.children.get(ch);
    if (!child) return false;
    const deleted = this.#delete(child, word, depth + 1);
    if (deleted && child.children.size === 0 && !child.isEnd) {
      node.children.delete(ch);
    }
    return deleted;
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/** Create a new AutocompleteTrie instance. */
export function createAutocompleteTrie(): AutocompleteTrie {
  return new AutocompleteTrie();
}
