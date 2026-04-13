// @ts-check
// ─── AVL Tree (self-balancing BST) ───────────────────────────────────────────
// Generic AVL tree with custom comparator support. Maintains the AVL balance
// invariant (|height(left) − height(right)| ≤ 1) after every insert/delete
// via single and double rotations.

// ─── Types ───────────────────────────────────────────────────────────────────

interface AVLNode<K, V> {
  key: K;
  value: V;
  height: number;
  left: AVLNode<K, V> | null;
  right: AVLNode<K, V> | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

// ─── Rotations ───────────────────────────────────────────────────────────────

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

// ─── AVLTree ──────────────────────────────────────────────────────────────────

export class AVLTree<K, V> {
  #root: AVLNode<K, V> | null;
  #size: number;
  #compare: (a: K, b: K) => number;

  constructor(compareFn?: (a: K, b: K) => number) {
    this.#root = null;
    this.#size = 0;
    this.#compare = compareFn ?? defaultCompare;
  }

  // ── Size ────────────────────────────────────────────────────────────────────

  /** Number of key-value pairs stored in the tree. */
  get size(): number {
    return this.#size;
  }

  // ── Insert / Set ────────────────────────────────────────────────────────────

  /**
   * Insert or update a key-value pair, rebalancing as needed.
   * Alias: `set()`.
   */
  insert(key: K, value: V): void {
    let inserted = false;
    const doInsert = (node: AVLNode<K, V> | null): AVLNode<K, V> => {
      if (node === null) {
        inserted = true;
        return createNode(key, value);
      }
      const cmp = this.#compare(key, node.key);
      if (cmp < 0) {
        node.left = doInsert(node.left);
      } else if (cmp > 0) {
        node.right = doInsert(node.right);
      } else {
        node.value = value;
        return node;
      }
      return rebalance(node);
    };
    this.#root = doInsert(this.#root);
    if (inserted) this.#size++;
  }

  /** Alias for `insert()` — insert or update a key-value pair. */
  set(key: K, value: V): void {
    this.insert(key, value);
  }

  // ── Get ─────────────────────────────────────────────────────────────────────

  /** Return the value associated with `key`, or `undefined` if absent. */
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

  // ── Has ─────────────────────────────────────────────────────────────────────

  /** Return `true` if `key` is present. */
  has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  // ── Delete ──────────────────────────────────────────────────────────────────

  /**
   * Remove the node with `key`.
   * Returns `true` if removed, `false` if the key was not found.
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

  // ── Min / Max ───────────────────────────────────────────────────────────────

  /** Return the `[key, value]` pair with the smallest key, or `null` if empty. */
  min(): [K, V] | null {
    if (this.#root === null) return null;
    let node = this.#root;
    while (node.left !== null) node = node.left;
    return [node.key, node.value];
  }

  /** Return the `[key, value]` pair with the largest key, or `null` if empty. */
  max(): [K, V] | null {
    if (this.#root === null) return null;
    let node = this.#root;
    while (node.right !== null) node = node.right;
    return [node.key, node.value];
  }

  // ── Traversals ──────────────────────────────────────────────────────────────

  /** Return all `[key, value]` pairs sorted ascending by key (in-order). */
  inOrder(): [K, V][] {
    const result: [K, V][] = [];
    this.#traverseInOrder(this.#root, (n) => result.push([n.key, n.value]));
    return result;
  }

  /** Return all `[key, value]` pairs in pre-order (root, left, right). */
  preOrder(): [K, V][] {
    const result: [K, V][] = [];
    this.#traversePreOrder(this.#root, result);
    return result;
  }

  /** Return all `[key, value]` pairs in post-order (left, right, root). */
  postOrder(): [K, V][] {
    const result: [K, V][] = [];
    this.#traversePostOrder(this.#root, result);
    return result;
  }

  /** All keys in ascending order. */
  keys(): K[] {
    const result: K[] = [];
    this.#traverseInOrder(this.#root, (n) => result.push(n.key));
    return result;
  }

  /** All values in key-ascending order. */
  values(): V[] {
    const result: V[] = [];
    this.#traverseInOrder(this.#root, (n) => result.push(n.value));
    return result;
  }

  /** All entries as `[key, value]` pairs in ascending key order. */
  entries(): [K, V][] {
    return this.inOrder();
  }

  // ── Clear ───────────────────────────────────────────────────────────────────

  /** Remove all entries from the tree. */
  clear(): void {
    this.#root = null;
    this.#size = 0;
  }

  // ── Height ──────────────────────────────────────────────────────────────────

  /**
   * Return the height of the tree.
   * Empty tree → 0; single node → 1.
   */
  height(): number {
    return nodeHeight(this.#root);
  }

  // ── Balance invariant check ─────────────────────────────────────────────────

  /**
   * Return `true` if every node satisfies |height(left) − height(right)| ≤ 1.
   * Useful for verifying that the AVL invariant is maintained after mutations.
   */
  isBalanced(): boolean {
    const check = (node: AVLNode<K, V> | null): boolean => {
      if (node === null) return true;
      const bf = Math.abs(balanceFactor(node));
      return bf <= 1 && check(node.left) && check(node.right);
    };
    return check(this.#root);
  }

  // ── Internal traversal helpers ──────────────────────────────────────────────

  #traverseInOrder(
    node: AVLNode<K, V> | null,
    fn: (n: AVLNode<K, V>) => void,
  ): void {
    if (node === null) return;
    this.#traverseInOrder(node.left, fn);
    fn(node);
    this.#traverseInOrder(node.right, fn);
  }

  #traversePreOrder(node: AVLNode<K, V> | null, result: [K, V][]): void {
    if (node === null) return;
    result.push([node.key, node.value]);
    this.#traversePreOrder(node.left, result);
    this.#traversePreOrder(node.right, result);
  }

  #traversePostOrder(node: AVLNode<K, V> | null, result: [K, V][]): void {
    if (node === null) return;
    this.#traversePostOrder(node.left, result);
    this.#traversePostOrder(node.right, result);
    result.push([node.key, node.value]);
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/** Create a new empty `AVLTree` with an optional custom comparator. */
export function createAVLTree<K, V>(
  compareFn?: (a: K, b: K) => number,
): AVLTree<K, V> {
  return new AVLTree<K, V>(compareFn);
}
