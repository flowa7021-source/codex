// @ts-check
// ─── Binary Search Tree ──────────────────────────────────────────────────────
// Generic BST with custom comparator support. Provides standard insertion,
// lookup, deletion and traversal operations on a keyed node tree.

// ─── Internal node ───────────────────────────────────────────────────────────

interface BSTNode<K, V> {
  key: K;
  value: V;
  left: BSTNode<K, V> | null;
  right: BSTNode<K, V> | null;
}

function createNode<K, V>(key: K, value: V): BSTNode<K, V> {
  return { key, value, left: null, right: null };
}

// ─── Default comparator ──────────────────────────────────────────────────────

function defaultCompare<K>(a: K, b: K): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

// ─── BST ─────────────────────────────────────────────────────────────────────

export class BST<K, V> {
  #root: BSTNode<K, V> | null;
  #size: number;
  #compare: (a: K, b: K) => number;

  constructor(compareFn?: (a: K, b: K) => number) {
    this.#root = null;
    this.#size = 0;
    this.#compare = compareFn ?? defaultCompare;
  }

  // ── Size ────────────────────────────────────────────────────────────────────

  /** Number of key-value pairs in the tree. */
  get size(): number {
    return this.#size;
  }

  // ── Insert ──────────────────────────────────────────────────────────────────

  /** Insert or update the value for `key`. */
  insert(key: K, value: V): void {
    const result = this.#insert(this.#root, key, value);
    this.#root = result.node;
    if (result.inserted) this.#size++;
  }

  #insert(
    node: BSTNode<K, V> | null,
    key: K,
    value: V,
  ): { node: BSTNode<K, V>; inserted: boolean } {
    if (node === null) {
      return { node: createNode(key, value), inserted: true };
    }
    const cmp = this.#compare(key, node.key);
    if (cmp < 0) {
      const result = this.#insert(node.left, key, value);
      node.left = result.node;
      return { node, inserted: result.inserted };
    } else if (cmp > 0) {
      const result = this.#insert(node.right, key, value);
      node.right = result.node;
      return { node, inserted: result.inserted };
    } else {
      // Key already exists — update value in place.
      node.value = value;
      return { node, inserted: false };
    }
  }

  // ── Get ─────────────────────────────────────────────────────────────────────

  /** Return the value for `key`, or `undefined` if not present. */
  get(key: K): V | undefined {
    let node = this.#root;
    while (node !== null) {
      const cmp = this.#compare(key, node.key);
      if (cmp < 0) node = node.left;
      else if (cmp > 0) node = node.right;
      else return node.value;
    }
    return undefined;
  }

  // ── Has ─────────────────────────────────────────────────────────────────────

  /** Return `true` if `key` exists in the tree. */
  has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  // ── Delete ──────────────────────────────────────────────────────────────────

  /**
   * Remove the node with `key`.
   * Returns `true` if the key existed and was removed, `false` otherwise.
   */
  delete(key: K): boolean {
    const result = this.#delete(this.#root, key);
    this.#root = result.node;
    if (result.deleted) this.#size--;
    return result.deleted;
  }

  #delete(
    node: BSTNode<K, V> | null,
    key: K,
  ): { node: BSTNode<K, V> | null; deleted: boolean } {
    if (node === null) return { node: null, deleted: false };

    const cmp = this.#compare(key, node.key);
    if (cmp < 0) {
      const result = this.#delete(node.left, key);
      node.left = result.node;
      return { node, deleted: result.deleted };
    } else if (cmp > 0) {
      const result = this.#delete(node.right, key);
      node.right = result.node;
      return { node, deleted: result.deleted };
    } else {
      // Found the node to delete.
      if (node.left === null) return { node: node.right, deleted: true };
      if (node.right === null) return { node: node.left, deleted: true };

      // Two children: replace with in-order successor (min of right subtree).
      const successor = this.#minNode(node.right)!;
      node.key = successor.key;
      node.value = successor.value;
      const result = this.#delete(node.right, successor.key);
      node.right = result.node;
      return { node, deleted: true };
    }
  }

  // ── Min / Max ───────────────────────────────────────────────────────────────

  /** Return the `[key, value]` pair with the smallest key, or `null` if empty. */
  min(): [K, V] | null {
    const node = this.#minNode(this.#root);
    return node ? [node.key, node.value] : null;
  }

  /** Return the `[key, value]` pair with the largest key, or `null` if empty. */
  max(): [K, V] | null {
    const node = this.#maxNode(this.#root);
    return node ? [node.key, node.value] : null;
  }

  #minNode(node: BSTNode<K, V> | null): BSTNode<K, V> | null {
    if (node === null) return null;
    let current = node;
    while (current.left !== null) current = current.left;
    return current;
  }

  #maxNode(node: BSTNode<K, V> | null): BSTNode<K, V> | null {
    if (node === null) return null;
    let current = node;
    while (current.right !== null) current = current.right;
    return current;
  }

  // ── Traversals ──────────────────────────────────────────────────────────────

  /** Return all `[key, value]` pairs sorted ascending by key (in-order). */
  inOrder(): [K, V][] {
    const result: [K, V][] = [];
    this.#inOrder(this.#root, result);
    return result;
  }

  #inOrder(node: BSTNode<K, V> | null, result: [K, V][]): void {
    if (node === null) return;
    this.#inOrder(node.left, result);
    result.push([node.key, node.value]);
    this.#inOrder(node.right, result);
  }

  /** Return all `[key, value]` pairs in pre-order (root, left, right). */
  preOrder(): [K, V][] {
    const result: [K, V][] = [];
    this.#preOrder(this.#root, result);
    return result;
  }

  #preOrder(node: BSTNode<K, V> | null, result: [K, V][]): void {
    if (node === null) return;
    result.push([node.key, node.value]);
    this.#preOrder(node.left, result);
    this.#preOrder(node.right, result);
  }

  /** Return all `[key, value]` pairs in post-order (left, right, root). */
  postOrder(): [K, V][] {
    const result: [K, V][] = [];
    this.#postOrder(this.#root, result);
    return result;
  }

  #postOrder(node: BSTNode<K, V> | null, result: [K, V][]): void {
    if (node === null) return;
    this.#postOrder(node.left, result);
    this.#postOrder(node.right, result);
    result.push([node.key, node.value]);
  }

  // ── Height ──────────────────────────────────────────────────────────────────

  /**
   * Return the height of the tree.
   * Height of an empty tree is -1; a single-node tree has height 0.
   */
  height(): number {
    return this.#height(this.#root);
  }

  #height(node: BSTNode<K, V> | null): number {
    if (node === null) return -1;
    return 1 + Math.max(this.#height(node.left), this.#height(node.right));
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/** Create a new empty `BST` with an optional custom comparator. */
export function createBST<K, V>(
  compareFn?: (a: K, b: K) => number,
): BST<K, V> {
  return new BST<K, V>(compareFn);
}
