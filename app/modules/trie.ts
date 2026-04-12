// @ts-check
// ─── Trie (Prefix Tree) ───────────────────────────────────────────────────────
// A classic trie data structure supporting insert, exact search, delete,
// prefix queries, autocomplete, and longest-common-prefix computation.

// ─── Internal Node ───────────────────────────────────────────────────────────

interface TrieNode {
  children: Map<string, TrieNode>;
  /** True when this node terminates a complete word. */
  isEnd: boolean;
}

function createNode(): TrieNode {
  return { children: new Map(), isEnd: false };
}

// ─── Trie ────────────────────────────────────────────────────────────────────

export class Trie {
  #root: TrieNode = createNode();
  #size: number = 0;

  // ── Mutation ────────────────────────────────────────────────────────────────

  /** Insert a word into the trie. Duplicate insertions are silently ignored. */
  insert(word: string): void {
    let node = this.#root;
    for (const ch of word) {
      if (!node.children.has(ch)) {
        node.children.set(ch, createNode());
      }
      node = node.children.get(ch)!;
    }
    if (!node.isEnd) {
      node.isEnd = true;
      this.#size++;
    }
  }

  /**
   * Delete a word from the trie.
   * @returns `true` if the word existed and was removed, `false` otherwise.
   */
  delete(word: string): boolean {
    if (!this.has(word)) return false;
    this.#deleteHelper(this.#root, word, 0);
    this.#size--;
    return true;
  }

  /** Remove all words from the trie. */
  clear(): void {
    this.#root = createNode();
    this.#size = 0;
  }

  // ── Queries ─────────────────────────────────────────────────────────────────

  /**
   * Return `true` if `word` is stored as an exact complete word.
   * Case-sensitive.
   */
  has(word: string): boolean {
    const node = this.#traverse(word);
    return node !== null && node.isEnd;
  }

  /**
   * Return `true` if any inserted word starts with `prefix`.
   * An empty prefix returns `true` when the trie is non-empty.
   */
  hasPrefix(prefix: string): boolean {
    if (prefix === '') return this.#size > 0;
    return this.#traverse(prefix) !== null;
  }

  /**
   * Return all stored words that start with `prefix`, in lexicographic order.
   * Alias: search(prefix) → wordsWithPrefix(prefix).
   */
  search(prefix: string): string[] {
    return this.wordsWithPrefix(prefix);
  }

  /**
   * Return all stored words that start with `prefix`, in lexicographic order.
   * Alias: startsWith(prefix) → wordsWithPrefix(prefix).
   */
  startsWith(prefix: string): string[] {
    return this.wordsWithPrefix(prefix);
  }

  /**
   * Return all stored words that start with `prefix`, in lexicographic order.
   * An empty prefix returns all words.
   */
  wordsWithPrefix(prefix: string): string[] {
    const node = this.#traverse(prefix);
    if (node === null) return [];
    const results: string[] = [];
    this.#collect(node, prefix, results);
    return results;
  }

  /**
   * Return all words starting with `prefix` in lexicographic order.
   * Default limit of 10 results; pass a custom limit to override.
   */
  autocomplete(prefix: string, maxResults = 10): string[] {
    const all = this.wordsWithPrefix(prefix);
    return all.slice(0, maxResults);
  }

  /** Count words that start with `prefix`. */
  countWithPrefix(prefix: string): number {
    return this.wordsWithPrefix(prefix).length;
  }

  /**
   * Return the longest string that is a prefix of every stored word.
   * Returns `''` when the trie is empty or words share no common prefix.
   */
  longestCommonPrefix(): string {
    if (this.#size === 0) return '';
    let node = this.#root;
    let prefix = '';
    // Walk while there is exactly one child and the current node is not a word end
    while (node.children.size === 1 && !node.isEnd) {
      const [ch, child] = node.children.entries().next().value as [string, TrieNode];
      prefix += ch;
      node = child;
    }
    return prefix;
  }

  /** Number of distinct words currently stored. */
  get size(): number {
    return this.#size;
  }

  /** Return every stored word in lexicographic order. */
  toArray(): string[] {
    return this.wordsWithPrefix('');
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  /** Walk the trie following each character of `str`. Returns the final node or `null`. */
  #traverse(str: string): TrieNode | null {
    let node = this.#root;
    for (const ch of str) {
      const next = node.children.get(ch);
      if (!next) return null;
      node = next;
    }
    return node;
  }

  /**
   * Depth-first collection of all complete words in the subtree rooted at `node`.
   * Children are visited in sorted (lexicographic) order so results are sorted.
   */
  #collect(node: TrieNode, prefix: string, out: string[]): void {
    if (node.isEnd) out.push(prefix);
    const keys = [...node.children.keys()].sort();
    for (const ch of keys) {
      this.#collect(node.children.get(ch)!, prefix + ch, out);
    }
  }

  /**
   * Recursive deletion. Prunes leaf nodes on the way back up.
   * Returns `true` when the caller should delete the edge leading to this node.
   */
  #deleteHelper(node: TrieNode, word: string, depth: number): boolean {
    if (depth === word.length) {
      node.isEnd = false;
      return node.children.size === 0;
    }
    const ch = word[depth];
    const child = node.children.get(ch)!;
    const shouldPrune = this.#deleteHelper(child, word, depth + 1);
    if (shouldPrune) {
      node.children.delete(ch);
    }
    return shouldPrune && !node.isEnd && node.children.size === 0;
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * Convenience factory. Optionally pre-populates the trie with `words`.
 */
export function createTrie(words?: string[]): Trie {
  const trie = new Trie();
  if (words) {
    for (const word of words) trie.insert(word);
  }
  return trie;
}
