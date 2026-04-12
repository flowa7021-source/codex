// @ts-check
// ─── Trie (Prefix Tree) ──────────────────────────────────────────────────────
// A compact prefix-tree data structure supporting insertion, deletion, exact
// lookup, prefix lookup, autocomplete, and longest-common-prefix queries.

// ─── Internal Node ───────────────────────────────────────────────────────────

interface TrieNode {
  children: Map<string, TrieNode>;
  /** True when this node terminates a complete word. */
  isEnd: boolean;
}

function createNode(): TrieNode {
  return { children: new Map(), isEnd: false };
}

// ─── Trie ─────────────────────────────────────────────────────────────────────

export class Trie {
  #root: TrieNode = createNode();
  #size: number = 0;

  // ── Public API ──────────────────────────────────────────────────────────────

  /** Number of distinct words stored in the trie. */
  get size(): number {
    return this.#size;
  }

  /** Insert a word. Duplicate insertions are silently ignored. */
  insert(word: string): void {
    if (this.has(word)) return;
    let node = this.#root;
    for (const ch of word) {
      if (!node.children.has(ch)) {
        node.children.set(ch, createNode());
      }
      node = node.children.get(ch)!;
    }
    node.isEnd = true;
    this.#size++;
  }

  /**
   * Delete a word from the trie.
   * Returns `true` if the word existed and was removed, `false` otherwise.
   */
  delete(word: string): boolean {
    if (!this.has(word)) return false;
    this.#deleteHelper(this.#root, word, 0);
    this.#size--;
    return true;
  }

  /** Return `true` if `word` is stored as a complete word. */
  has(word: string): boolean {
    const node = this.#getNode(word);
    return node !== null && node.isEnd;
  }

  /** Return `true` if any stored word starts with `prefix`. */
  hasPrefix(prefix: string): boolean {
    if (this.#size === 0) return false;
    return this.#getNode(prefix) !== null;
  }

  /**
   * Return all words that start with `prefix`, in alphabetical order.
   * An empty prefix returns all words.
   */
  search(prefix: string): string[] {
    const node = this.#getNode(prefix);
    if (node === null) return [];
    const results: string[] = [];
    this.#collect(node, prefix, results);
    return results.sort();
  }

  /** Alias for `search`. */
  startsWith(prefix: string): string[] {
    return this.search(prefix);
  }

  /**
   * Return up to `limit` words (default 10) that start with `prefix`,
   * in alphabetical order.
   */
  autocomplete(prefix: string, limit: number = 10): string[] {
    return this.search(prefix).slice(0, limit);
  }

  /** Count how many stored words start with `prefix`. */
  countWithPrefix(prefix: string): number {
    return this.search(prefix).length;
  }

  /** Remove all words from the trie. */
  clear(): void {
    this.#root = createNode();
    this.#size = 0;
  }

  /** Return every stored word in alphabetical order. */
  toArray(): string[] {
    return this.search('');
  }

  /** Alias for search(). */
  wordsWithPrefix(prefix: string): string[] {
    return this.search(prefix);
  }

  /** Alias for toArray(). */
  allWords(): string[] {
    return this.toArray();
  }

  /**
   * Return the longest string that is a prefix of every stored word.
   * Returns `''` when the trie is empty or words share no common prefix.
   */
  longestCommonPrefix(): string {
    if (this.#size === 0) return '';
    let node = this.#root;
    let prefix = '';
    while (node.children.size === 1 && !node.isEnd) {
      const entry = node.children.entries().next().value as [string, TrieNode];
      prefix += entry[0];
      node = entry[1];
    }
    return prefix;
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  /** Walk to the node for `prefix`, returning `null` if the path is missing. */
  #getNode(prefix: string): TrieNode | null {
    let node = this.#root;
    for (const ch of prefix) {
      if (!node.children.has(ch)) return null;
      node = node.children.get(ch)!;
    }
    return node;
  }

  /**
   * Recursively collect all complete words in the subtree rooted at `node`,
   * accumulating characters in `prefix`.
   */
  #collect(node: TrieNode, prefix: string, results: string[]): void {
    if (node.isEnd) results.push(prefix);
    for (const [ch, child] of node.children) {
      this.#collect(child, prefix + ch, results);
    }
  }

  /**
   * Recursive deletion. Prunes leaf nodes on the way back up.
   * Returns `true` when the caller should delete the edge to this node.
   */
  #deleteHelper(node: TrieNode, word: string, depth: number): boolean {
    if (depth === word.length) {
      node.isEnd = false;
      return node.children.size === 0;
    }
    const ch = word[depth];
    const child = node.children.get(ch)!;
    const shouldDelete = this.#deleteHelper(child, word, depth + 1);
    if (shouldDelete) {
      node.children.delete(ch);
    }
    return shouldDelete && !node.isEnd && node.children.size === 0;
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * Convenience factory. Optionally pre-populates the trie with `words`.
 */
export function createTrie(words: string[] = []): Trie {
  const trie = new Trie();
  for (const word of words) {
    trie.insert(word);
  }
  return trie;
}
