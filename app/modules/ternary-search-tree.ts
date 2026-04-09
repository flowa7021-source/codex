// @ts-check
// ─── Ternary Search Tree ──────────────────────────────────────────────────────
// A tree where each node stores a single character and has three children:
// left (less-than), middle (equal), right (greater-than). Combines the
// space efficiency of tries with the time efficiency of binary search trees.

// ─── Types ────────────────────────────────────────────────────────────────────

interface TSTNode<V> {
  char: string;
  left: TSTNode<V> | null;
  mid: TSTNode<V> | null;
  right: TSTNode<V> | null;
  value: V | undefined;
  hasValue: boolean;
}

function createNode<V>(char: string): TSTNode<V> {
  return { char, left: null, mid: null, right: null, value: undefined, hasValue: false };
}

// ─── TernarySearchTree ──────────────────────────────────────────────────────

export class TernarySearchTree<V> {
  #root: TSTNode<V> | null = null;
  #size: number = 0;

  // ── Public API ──────────────────────────────────────────────────────────────

  /** Insert or update a key-value pair. Empty keys are ignored. */
  set(key: string, value: V): void {
    if (key.length === 0) return;
    this.#root = this.#insert(this.#root, key, value, 0);
  }

  /** Return the value associated with `key`, or `undefined`. */
  get(key: string): V | undefined {
    if (key.length === 0) return undefined;
    const node = this.#find(this.#root, key, 0);
    return node?.hasValue ? node.value : undefined;
  }

  /** Return `true` if the tree contains `key`. */
  has(key: string): boolean {
    if (key.length === 0) return false;
    const node = this.#find(this.#root, key, 0);
    return node !== null && node.hasValue;
  }

  /** Remove `key` from the tree. Returns `true` if the key existed. */
  delete(key: string): boolean {
    if (key.length === 0) return false;
    const result = { deleted: false };
    this.#root = this.#remove(this.#root, key, 0, result);
    if (result.deleted) this.#size--;
    return result.deleted;
  }

  /** Number of key-value pairs stored. */
  get size(): number {
    return this.#size;
  }

  /** Return all keys in sorted order. */
  keys(): string[] {
    const result: string[] = [];
    this.#collectKeys(this.#root, '', result);
    return result;
  }

  /** Return all keys that start with `prefix`. */
  keysWithPrefix(prefix: string): string[] {
    if (prefix.length === 0) return this.keys();

    const node = this.#find(this.#root, prefix, 0);
    if (node === null) return [];

    const result: string[] = [];
    if (node.hasValue) result.push(prefix);
    this.#collectKeys(node.mid, prefix, result);
    return result;
  }

  /** Return the longest key that is a prefix of `query`, or `null`. */
  longestPrefixOf(query: string): string | null {
    if (query.length === 0 || this.#root === null) return null;

    let longest: string | null = null;
    let node = this.#root;
    let depth = 0;

    while (node !== null && depth < query.length) {
      const ch = query[depth];

      if (ch < node.char) {
        node = node.left;
      } else if (ch > node.char) {
        node = node.right;
      } else {
        depth++;
        if (node.hasValue) {
          longest = query.slice(0, depth);
        }
        node = node.mid;
      }
    }

    return longest;
  }

  /** Remove all entries. */
  clear(): void {
    this.#root = null;
    this.#size = 0;
  }

  // ── Internal helpers ────────────────────────────────────────────────────────

  #insert(node: TSTNode<V> | null, key: string, value: V, depth: number): TSTNode<V> {
    const ch = key[depth];

    if (node === null) {
      node = createNode(ch);
    }

    if (ch < node.char) {
      node.left = this.#insert(node.left, key, value, depth);
    } else if (ch > node.char) {
      node.right = this.#insert(node.right, key, value, depth);
    } else if (depth < key.length - 1) {
      node.mid = this.#insert(node.mid, key, value, depth + 1);
    } else {
      if (!node.hasValue) this.#size++;
      node.value = value;
      node.hasValue = true;
    }

    return node;
  }

  #find(node: TSTNode<V> | null, key: string, depth: number): TSTNode<V> | null {
    if (node === null) return null;

    const ch = key[depth];

    if (ch < node.char) return this.#find(node.left, key, depth);
    if (ch > node.char) return this.#find(node.right, key, depth);
    if (depth < key.length - 1) return this.#find(node.mid, key, depth + 1);
    return node;
  }

  #remove(
    node: TSTNode<V> | null,
    key: string,
    depth: number,
    result: { deleted: boolean },
  ): TSTNode<V> | null {
    if (node === null) return null;

    const ch = key[depth];

    if (ch < node.char) {
      node.left = this.#remove(node.left, key, depth, result);
    } else if (ch > node.char) {
      node.right = this.#remove(node.right, key, depth, result);
    } else if (depth < key.length - 1) {
      node.mid = this.#remove(node.mid, key, depth + 1, result);
    } else {
      if (node.hasValue) {
        node.value = undefined;
        node.hasValue = false;
        result.deleted = true;
      }
    }

    // Prune leaf nodes that carry no value and have no children
    if (!node.hasValue && node.left === null && node.mid === null && node.right === null) {
      return null;
    }

    return node;
  }

  #collectKeys(node: TSTNode<V> | null, prefix: string, result: string[]): void {
    if (node === null) return;

    // Traverse left subtree first (smaller characters)
    this.#collectKeys(node.left, prefix, result);

    // Current character's subtree
    const current = prefix + node.char;
    if (node.hasValue) result.push(current);
    this.#collectKeys(node.mid, current, result);

    // Traverse right subtree (larger characters)
    this.#collectKeys(node.right, prefix, result);
  }
}

// ─── Factory ────────────────────────────────────────────────────────────────

export function createTernarySearchTree<V>(): TernarySearchTree<V> {
  return new TernarySearchTree<V>();
}
