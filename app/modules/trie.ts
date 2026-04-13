// @ts-check
// ─── Trie (Prefix Tree) ────────────────────────────────────────────────
// A classic trie data structure supporting insert, exact search, delete,
// prefix queries, autocomplete, and longest-common-prefix computation.

// ─── Internal Node ───────────────────────────────────────────────

interface TrieNode {
  children: Map<string, TrieNode>;
  /** True when this node terminates a complete word. */
  isEnd: boolean;
}

function createNode(): TrieNode {
  return { children: new Map(), isEnd: false };
}

// ─── Trie ──────────────────────────────────────────────────────────────

export class Trie {
  #root: TrieNode = createNode();
  #size: number = 0;

  // ── Mutation ──────────────────────────────────────────────────────────────────

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
    if (!this.search(word)) return false;
    this.#deleteHelper(this.#root, word, 0);
    this.#size--;
    return true;
  }

  /** Remove all words from the trie. */
  clear(): void {
    this.#root = createNode();
    this.#size = 0;
  }

  // ── Queries ──────────────────────────────────────────────────────────────────

  /**
   * Exact-match lookup. Returns `true` if `word` is stored as a complete word.
   * Case-sensitive.
   */
  search(word: string): boolean {
    const node = this.#traverse(word);
    return node !== null && node.isEnd;
  }

  /**
   * Returns `true` if any inserted word starts with `prefix`.
   * An empty prefix returns `true` when the trie is non-empty.
   */
  startsWith(prefix: string): boolean {
    if (prefix === '') return this.#size > 0;
    return this.#traverse(prefix) !== null;
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
   * Alias for wordsWithPrefix with an optional result cap.
   * When `maxResults` is given, at most that many results are returned.
   */
  autocomplete(prefix: string, maxResults?: number): string[] {
    const all = this.wordsWithPrefix(prefix);
    return maxResults !== undefined ? all.slice(0, maxResults) : all;
  }

  /**
   * Return the longest string that is a prefix of every stored word.
   * Returns '' when the trie is empty or words share no common prefix.
   */
  longestCommonPrefix(): string {
    if (this.#size === 0) return '';
    let node = this.#root;
    let prefix = '';
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

  // ── Private helpers ───────────────────────────────────────────────────────────

  #traverse(str: string): TrieNode | null {
    let node = this.#root;
    for (const ch of str) {
      const next = node.children.get(ch);
      if (!next) return null;
      node = next;
    }
    return node;
  }

  #collect(node: TrieNode, prefix: string, out: string[]): void {
    if (node.isEnd) out.push(prefix);
    const keys = [...node.children.keys()].sort();
    for (const ch of keys) {
      this.#collect(node.children.get(ch)!, prefix + ch, out);
    }
  }

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

// ─── Factory ──────────────────────────────────────────────────────────────────

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
