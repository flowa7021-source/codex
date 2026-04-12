// @ts-check
// ─── Binary Search Tree ──────────────────────────────────────────────────────
// Generic BST with in-order, pre-order, post-order, and level-order traversals,
// floor/ceil queries, and full iterator support.

// ─── Internal Node ───────────────────────────────────────────────────────────

interface BSTNode<T> {
  value: T;
  left: BSTNode<T> | null;
  right: BSTNode<T> | null;
}

function createNode<T>(value: T): BSTNode<T> {
  return { value, left: null, right: null };
}

// ─── Default Comparator ──────────────────────────────────────────────────────

/** Numeric/lexicographic comparator for primitive values. */
function defaultComparator<T>(a: T, b: T): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

// ─── BinarySearchTree ────────────────────────────────────────────────────────

export class BinarySearchTree<T = number> {
  #root: BSTNode<T> | null = null;
  #size: number = 0;
  readonly #comparator: (a: T, b: T) => number;

  constructor(comparator?: (a: T, b: T) => number) {
    this.#comparator = comparator ?? defaultComparator;
  }

  // ── Size & Height ───────────────────────────────────────────────────────────

  /** Number of nodes in the tree. */
  get size(): number {
    return this.#size;
  }

  /** Longest path from root to any leaf (0 for an empty tree). */
  get height(): number {
    return this.#nodeHeight(this.#root);
  }

  #nodeHeight(node: BSTNode<T> | null): number {
    if (node === null) return 0;
    return 1 + Math.max(this.#nodeHeight(node.left), this.#nodeHeight(node.right));
  }

  // ── Insert ──────────────────────────────────────────────────────────────────

  /** Insert `value` into the tree. Duplicates are ignored. */
  insert(value: T): void {
    const result = this.#insertNode(this.#root, value);
    if (result.inserted) {
      this.#root = result.node;
      this.#size++;
    }
  }

  #insertNode(
    node: BSTNode<T> | null,
    value: T,
  ): { node: BSTNode<T>; inserted: boolean } {
    if (node === null) {
      return { node: createNode(value), inserted: true };
    }
    const cmp = this.#comparator(value, node.value);
    if (cmp < 0) {
      const result = this.#insertNode(node.left, value);
      node.left = result.node;
      return { node, inserted: result.inserted };
    } else if (cmp > 0) {
      const result = this.#insertNode(node.right, value);
      node.right = result.node;
      return { node, inserted: result.inserted };
    }
    // duplicate — ignore
    return { node, inserted: false };
  }

  // ── Delete ──────────────────────────────────────────────────────────────────

  /** Remove `value` from the tree. Returns `true` if the value was found and removed. */
  delete(value: T): boolean {
    const result = this.#deleteNode(this.#root, value);
    if (result.deleted) {
      this.#root = result.node;
      this.#size--;
      return true;
    }
    return false;
  }

  #deleteNode(
    node: BSTNode<T> | null,
    value: T,
  ): { node: BSTNode<T> | null; deleted: boolean } {
    if (node === null) return { node: null, deleted: false };

    const cmp = this.#comparator(value, node.value);
    if (cmp < 0) {
      const result = this.#deleteNode(node.left, value);
      node.left = result.node;
      return { node, deleted: result.deleted };
    } else if (cmp > 0) {
      const result = this.#deleteNode(node.right, value);
      node.right = result.node;
      return { node, deleted: result.deleted };
    }

    // Found the node to delete
    if (node.left === null) return { node: node.right, deleted: true };
    if (node.right === null) return { node: node.left, deleted: true };

    // Two children: replace with in-order successor (min of right subtree)
    const successor = this.#minNode(node.right)!;
    node.value = successor.value;
    const result = this.#deleteNode(node.right, successor.value);
    node.right = result.node;
    return { node, deleted: true };
  }

  // ── Has / Find ──────────────────────────────────────────────────────────────

  /** Returns `true` if `value` exists in the tree. */
  has(value: T): boolean {
    return this.#findNode(this.#root, value) !== null;
  }

  /** Returns the stored value equal to `value`, or `undefined` if not found. */
  find(value: T): T | undefined {
    const node = this.#findNode(this.#root, value);
    return node === null ? undefined : node.value;
  }

  #findNode(node: BSTNode<T> | null, value: T): BSTNode<T> | null {
    if (node === null) return null;
    const cmp = this.#comparator(value, node.value);
    if (cmp < 0) return this.#findNode(node.left, value);
    if (cmp > 0) return this.#findNode(node.right, value);
    return node;
  }

  // ── Min / Max ───────────────────────────────────────────────────────────────

  /** Smallest value in the tree, or `undefined` if empty. */
  min(): T | undefined {
    const node = this.#minNode(this.#root);
    return node === null ? undefined : node.value;
  }

  /** Largest value in the tree, or `undefined` if empty. */
  max(): T | undefined {
    const node = this.#maxNode(this.#root);
    return node === null ? undefined : node.value;
  }

  #minNode(node: BSTNode<T> | null): BSTNode<T> | null {
    if (node === null) return null;
    let cur = node;
    while (cur.left !== null) cur = cur.left;
    return cur;
  }

  #maxNode(node: BSTNode<T> | null): BSTNode<T> | null {
    if (node === null) return null;
    let cur = node;
    while (cur.right !== null) cur = cur.right;
    return cur;
  }

  // ── Floor / Ceil ─────────────────────────────────────────────────────────────

  /** Largest value in the tree that is <= `value`, or `undefined`. */
  floor(value: T): T | undefined {
    return this.#floor(this.#root, value);
  }

  #floor(node: BSTNode<T> | null, value: T): T | undefined {
    if (node === null) return undefined;
    const cmp = this.#comparator(value, node.value);
    if (cmp === 0) return node.value;
    if (cmp < 0) return this.#floor(node.left, value);
    // node.value < value: node might be the answer, but check right subtree too
    const right = this.#floor(node.right, value);
    return right !== undefined ? right : node.value;
  }

  /** Smallest value in the tree that is >= `value`, or `undefined`. */
  ceil(value: T): T | undefined {
    return this.#ceil(this.#root, value);
  }

  #ceil(node: BSTNode<T> | null, value: T): T | undefined {
    if (node === null) return undefined;
    const cmp = this.#comparator(value, node.value);
    if (cmp === 0) return node.value;
    if (cmp > 0) return this.#ceil(node.right, value);
    // node.value > value: node might be the answer, but check left subtree too
    const left = this.#ceil(node.left, value);
    return left !== undefined ? left : node.value;
  }

  // ── Traversals ───────────────────────────────────────────────────────────────

  /** In-order traversal (sorted ascending). */
  inOrder(): T[] {
    const result: T[] = [];
    this.#inOrder(this.#root, result);
    return result;
  }

  #inOrder(node: BSTNode<T> | null, result: T[]): void {
    if (node === null) return;
    this.#inOrder(node.left, result);
    result.push(node.value);
    this.#inOrder(node.right, result);
  }

  /** Pre-order traversal (root, left, right). */
  preOrder(): T[] {
    const result: T[] = [];
    this.#preOrder(this.#root, result);
    return result;
  }

  #preOrder(node: BSTNode<T> | null, result: T[]): void {
    if (node === null) return;
    result.push(node.value);
    this.#preOrder(node.left, result);
    this.#preOrder(node.right, result);
  }

  /** Post-order traversal (left, right, root). */
  postOrder(): T[] {
    const result: T[] = [];
    this.#postOrder(this.#root, result);
    return result;
  }

  #postOrder(node: BSTNode<T> | null, result: T[]): void {
    if (node === null) return;
    this.#postOrder(node.left, result);
    this.#postOrder(node.right, result);
    result.push(node.value);
  }

  /** Level-order (breadth-first) traversal. */
  levelOrder(): T[] {
    const result: T[] = [];
    if (this.#root === null) return result;
    const queue: BSTNode<T>[] = [this.#root];
    while (queue.length > 0) {
      const node = queue.shift()!;
      result.push(node.value);
      if (node.left !== null) queue.push(node.left);
      if (node.right !== null) queue.push(node.right);
    }
    return result;
  }

  // ── toArray / clear ──────────────────────────────────────────────────────────

  /** Returns all values sorted ascending (same as `inOrder()`). */
  toArray(): T[] {
    return this.inOrder();
  }

  /** Remove all nodes from the tree. */
  clear(): void {
    this.#root = null;
    this.#size = 0;
  }

  // ── Iterator ─────────────────────────────────────────────────────────────────

  /** Iterate in-order (ascending). */
  [Symbol.iterator](): Iterator<T> {
    const values = this.inOrder();
    let index = 0;
    return {
      next(): IteratorResult<T> {
        if (index < values.length) {
          return { value: values[index++], done: false };
        }
        return { value: undefined as unknown as T, done: true };
      },
    };
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/** Create a new `BinarySearchTree` with an optional custom comparator. */
export function createBST<T>(
  comparator?: (a: T, b: T) => number,
): BinarySearchTree<T> {
  return new BinarySearchTree<T>(comparator);
}
