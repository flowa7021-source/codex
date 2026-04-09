// @ts-check
// ─── Trie (Prefix Tree) ───────────────────────────────────────────────────────
// Efficient prefix-based string storage and retrieval.

// ─── Internal Node ────────────────────────────────────────────────────────────

class TrieNode {
  children: Map<string, TrieNode> = new Map();
  isEnd = false;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export class Trie {
  #root: TrieNode = new TrieNode();
  #size = 0;

  /** Insert a word into the trie. */
  insert(word: string): void {
    let node = this.#root;
    for (const ch of word) {
      let child = node.children.get(ch);
      if (!child) {
        child = new TrieNode();
        node.children.set(ch, child);
      }
      node = child;
    }
    if (!node.isEnd) {
      node.isEnd = true;
      this.#size++;
    }
  }

  /** Returns true if the exact word exists. */
  search(word: string): boolean {
    const node = this.#traverse(word);
    return node !== null && node.isEnd;
  }

  /** Returns true if any word starts with prefix. */
  startsWith(prefix: string): boolean {
    return this.#traverse(prefix) !== null;
  }

  /** Delete a word from the trie. Returns true if deleted. */
  delete(word: string): boolean {
    return this.#delete(this.#root, word, 0);
  }

  /** Get all words with the given prefix. */
  wordsWithPrefix(prefix: string): string[] {
    const node = this.#traverse(prefix);
    if (node === null) return [];
    const results: string[] = [];
    this.#collect(node, prefix, results);
    return results;
  }

  /** Get all words in the trie. */
  allWords(): string[] {
    return this.wordsWithPrefix('');
  }

  /** Number of unique words. */
  get size(): number {
    return this.#size;
  }

  /** Clear all words. */
  clear(): void {
    this.#root = new TrieNode();
    this.#size = 0;
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────

  #traverse(prefix: string): TrieNode | null {
    let node = this.#root;
    for (const ch of prefix) {
      const child = node.children.get(ch);
      if (!child) return null;
      node = child;
    }
    return node;
  }

  #collect(node: TrieNode, prefix: string, results: string[]): void {
    if (node.isEnd) results.push(prefix);
    for (const [ch, child] of node.children) {
      this.#collect(child, prefix + ch, results);
    }
  }

  #delete(node: TrieNode, word: string, depth: number): boolean {
    if (depth === word.length) {
      if (!node.isEnd) return false;
      node.isEnd = false;
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
