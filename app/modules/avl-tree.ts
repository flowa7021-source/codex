// ─── AVL Tree ───────────────────────────────────────────────────────────────
// Self-balancing binary search tree using height-based rebalancing.
// Guarantees O(log n) insert, delete, and lookup with strict balance.

// ─── Types ──────────────────────────────────────────────────────────────────

interface AVLNode<K, V> {
  key: K;
  value: V;
  height: number;
  left: AVLNode<K, V> | null;
  right: AVLNode<K, V> | null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function defaultCompare<K>(a: K, b: K): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function nodeHeight<K, V>(node: AVLNode<K, V> | null): number {
  return node === null ? 0 : node.height;
}

function updateHeight<K, V>(node: AVLNode<K, V>): void {
  node.height = 1 + Math.max(nodeHeight(node.left), nodeHeight(node.right));
}

function balanceFactor<K, V>(node: AVLNode<K, V>): number {
  return nodeHeight(node.left) - nodeHeight(node.right);
}

function createNode<K, V>(key: K, value: V): AVLNode<K, V> {
  return { key, value, height: 1, left: null, right: null };
}

// ─── Rotations ──────────────────────────────────────────────────────────────

function rotateRight<K, V>(y: AVLNode<K, V>): AVLNode<K, V> {
  const x = y.left!;
  y.left = x.right;
  x.right = y;
  updateHeight(y);
  updateHeight(x);
  return x;
}

function rotateLeft<K, V>(x: AVLNode<K, V>): AVLNode<K, V> {
  const y = x.right!;
  x.right = y.left;
  y.left = x;
  updateHeight(x);
  updateHeight(y);
  return y;
}

function rebalance<K, V>(node: AVLNode<K, V>): AVLNode<K, V> {
  updateHeight(node);
  const bf = balanceFactor(node);

  if (bf > 1) {
    // Left-heavy
    if (balanceFactor(node.left!) < 0) {
      node.left = rotateLeft(node.left!);
    }
    return rotateRight(node);
  }

  if (bf < -1) {
    // Right-heavy
    if (balanceFactor(node.right!) > 0) {
      node.right = rotateRight(node.right!);
    }
    return rotateLeft(node);
  }

  return node;
}

// ─── AVLTree Class ──────────────────────────────────────────────────────────

/**
 * AVL balanced binary search tree.
 *
 * @example
 *   const tree = new AVLTree<number, string>();
 *   tree.set(3, 'c');
 *   tree.set(1, 'a');
 *   tree.get(1); // 'a'
 *   tree.keys(); // [1, 3]
 */
export class AVLTree<K, V> {
  #root: AVLNode<K, V> | null = null;
  #size = 0;
  #compare: (a: K, b: K) => number;

  constructor(compare?: (a: K, b: K) => number) {
    this.#compare = compare ?? defaultCompare;
  }

  // ─── Public API ─────────────────────────────────────────────────────────

  /** Number of entries in the tree. */
  get size(): number {
    return this.#size;
  }

  /**
   * Insert or update a key-value pair.
   */
  set(key: K, value: V): void {
    let inserted = false;
    const insert = (node: AVLNode<K, V> | null): AVLNode<K, V> => {
      if (node === null) {
        inserted = true;
        return createNode(key, value);
      }
      const cmp = this.#compare(key, node.key);
      if (cmp < 0) {
        node.left = insert(node.left);
      } else if (cmp > 0) {
        node.right = insert(node.right);
      } else {
        node.value = value;
        return node;
      }
      return rebalance(node);
    };
    this.#root = insert(this.#root);
    if (inserted) this.#size++;
  }

  /**
   * Retrieve the value for a key, or `undefined` if absent.
   */
  get(key: K): V | undefined {
    let current = this.#root;
    while (current !== null) {
      const cmp = this.#compare(key, current.key);
      if (cmp < 0) current = current.left;
      else if (cmp > 0) current = current.right;
      else return current.value;
    }
    return undefined;
  }

  /**
   * Check whether the tree contains a given key.
   */
  has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  /**
   * Remove a key. Returns `true` if the key was present.
   */
  delete(key: K): boolean {
    let removed = false;

    const removeMin = (node: AVLNode<K, V>): AVLNode<K, V> | null => {
      if (node.left === null) return node.right;
      node.left = removeMin(node.left);
      return rebalance(node);
    };

    const findMin = (node: AVLNode<K, V>): AVLNode<K, V> => {
      let current = node;
      while (current.left !== null) current = current.left;
      return current;
    };

    const remove = (node: AVLNode<K, V> | null): AVLNode<K, V> | null => {
      if (node === null) return null;
      const cmp = this.#compare(key, node.key);
      if (cmp < 0) {
        node.left = remove(node.left);
      } else if (cmp > 0) {
        node.right = remove(node.right);
      } else {
        removed = true;
        if (node.left === null) return node.right;
        if (node.right === null) return node.left;
        // Two children: replace with in-order successor
        const successor = findMin(node.right);
        successor.right = removeMin(node.right);
        successor.left = node.left;
        return rebalance(successor);
      }
      return rebalance(node);
    };

    this.#root = remove(this.#root);
    if (removed) this.#size--;
    return removed;
  }

  /**
   * Return the smallest key-value pair, or `null` if the tree is empty.
   */
  min(): [K, V] | null {
    if (this.#root === null) return null;
    let node = this.#root;
    while (node.left !== null) node = node.left;
    return [node.key, node.value];
  }

  /**
   * Return the largest key-value pair, or `null` if the tree is empty.
   */
  max(): [K, V] | null {
    if (this.#root === null) return null;
    let node = this.#root;
    while (node.right !== null) node = node.right;
    return [node.key, node.value];
  }

  /** All keys in ascending order. */
  keys(): K[] {
    const result: K[] = [];
    this.#inOrder(this.#root, (n) => result.push(n.key));
    return result;
  }

  /** All values in key-ascending order. */
  values(): V[] {
    const result: V[] = [];
    this.#inOrder(this.#root, (n) => result.push(n.value));
    return result;
  }

  /** All entries as [key, value] pairs in ascending key order. */
  entries(): [K, V][] {
    const result: [K, V][] = [];
    this.#inOrder(this.#root, (n) => result.push([n.key, n.value]));
    return result;
  }

  /** Remove all entries. */
  clear(): void {
    this.#root = null;
    this.#size = 0;
  }

  /**
   * Height of the tree (longest root-to-leaf path length).
   * Returns 0 for an empty tree.
   */
  height(): number {
    return nodeHeight(this.#root);
  }

  /**
   * Verify that the AVL invariant holds: every node's children heights
   * differ by at most 1.
   */
  isBalanced(): boolean {
    const check = (node: AVLNode<K, V> | null): boolean => {
      if (node === null) return true;
      const bf = Math.abs(balanceFactor(node));
      return bf <= 1 && check(node.left) && check(node.right);
    };
    return check(this.#root);
  }

  // ─── Internal: traversal ────────────────────────────────────────────────

  #inOrder(node: AVLNode<K, V> | null, fn: (n: AVLNode<K, V>) => void): void {
    if (node === null) return;
    this.#inOrder(node.left, fn);
    fn(node);
    this.#inOrder(node.right, fn);
  }
}

// ─── Factory ────────────────────────────────────────────────────────────────

/**
 * Create a new AVL tree instance.
 */
export function createAVLTree<K, V>(
  compare?: (a: K, b: K) => number,
): AVLTree<K, V> {
  return new AVLTree<K, V>(compare);
}
