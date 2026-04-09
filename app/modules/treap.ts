// @ts-check
// ─── Treap ───────────────────────────────────────────────────────────────────
// Randomized treap: a binary search tree where each node carries a random
// priority, maintained as a max-heap. Expected O(log n) operations.

// ─── Types ───────────────────────────────────────────────────────────────────

interface TreapNode<K, V> {
  key: K;
  value: V;
  priority: number;
  left: TreapNode<K, V> | null;
  right: TreapNode<K, V> | null;
}

export type Comparator<K> = (a: K, b: K) => number;

// ─── Default comparator ──────────────────────────────────────────────────────

function defaultCompare<K>(a: K, b: K): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

// ─── Treap class ─────────────────────────────────────────────────────────────

export class Treap<K, V> {
  private _root: TreapNode<K, V> | null = null;
  private _size: number = 0;
  private readonly _compare: Comparator<K>;

  constructor(compare?: Comparator<K>) {
    this._compare = compare ?? defaultCompare;
  }

  // ─── Size getter ─────────────────────────────────────────────────────────

  get size(): number {
    return this._size;
  }

  // ─── Rotations ───────────────────────────────────────────────────────────

  private _rotateRight(node: TreapNode<K, V>): TreapNode<K, V> {
    const left = node.left!;
    node.left = left.right;
    left.right = node;
    return left;
  }

  private _rotateLeft(node: TreapNode<K, V>): TreapNode<K, V> {
    const right = node.right!;
    node.right = right.left;
    right.left = node;
    return right;
  }

  // ─── Insert ──────────────────────────────────────────────────────────────

  private _insert(
    node: TreapNode<K, V> | null,
    key: K,
    value: V,
    priority: number,
  ): { root: TreapNode<K, V>; inserted: boolean } {
    if (node === null) {
      return {
        root: { key, value, priority, left: null, right: null },
        inserted: true,
      };
    }

    const cmp = this._compare(key, node.key);

    if (cmp === 0) {
      // Key already exists — update value only
      node.value = value;
      return { root: node, inserted: false };
    }

    let inserted: boolean;

    if (cmp < 0) {
      const result = this._insert(node.left, key, value, priority);
      node.left = result.root;
      inserted = result.inserted;
      if (node.left.priority > node.priority) {
        node = this._rotateRight(node);
      }
    } else {
      const result = this._insert(node.right, key, value, priority);
      node.right = result.root;
      inserted = result.inserted;
      if (node.right.priority > node.priority) {
        node = this._rotateLeft(node);
      }
    }

    return { root: node, inserted };
  }

  set(key: K, value: V): void {
    const priority = Math.random();
    const result = this._insert(this._root, key, value, priority);
    this._root = result.root;
    if (result.inserted) {
      this._size++;
    }
  }

  // ─── Search ──────────────────────────────────────────────────────────────

  private _find(key: K): TreapNode<K, V> | null {
    let node = this._root;
    while (node !== null) {
      const cmp = this._compare(key, node.key);
      if (cmp === 0) return node;
      node = cmp < 0 ? node.left : node.right;
    }
    return null;
  }

  get(key: K): V | undefined {
    const node = this._find(key);
    return node !== null ? node.value : undefined;
  }

  has(key: K): boolean {
    return this._find(key) !== null;
  }

  // ─── Delete ──────────────────────────────────────────────────────────────

  private _delete(
    node: TreapNode<K, V> | null,
    key: K,
  ): { root: TreapNode<K, V> | null; deleted: boolean } {
    if (node === null) {
      return { root: null, deleted: false };
    }

    const cmp = this._compare(key, node.key);

    if (cmp < 0) {
      const result = this._delete(node.left, key);
      node.left = result.root;
      return { root: node, deleted: result.deleted };
    }

    if (cmp > 0) {
      const result = this._delete(node.right, key);
      node.right = result.root;
      return { root: node, deleted: result.deleted };
    }

    // cmp === 0 — found the node to delete
    if (node.left === null && node.right === null) {
      return { root: null, deleted: true };
    }

    if (node.left === null) {
      node = this._rotateLeft(node);
      const result = this._delete(node.left, key);
      node.left = result.root;
      return { root: node, deleted: result.deleted };
    }

    if (node.right === null) {
      node = this._rotateRight(node);
      const result = this._delete(node.right, key);
      node.right = result.root;
      return { root: node, deleted: result.deleted };
    }

    // Both children present — rotate the higher-priority child up
    if (node.left.priority > node.right.priority) {
      node = this._rotateRight(node);
      const result = this._delete(node.right, key);
      node.right = result.root;
      return { root: node, deleted: result.deleted };
    } else {
      node = this._rotateLeft(node);
      const result = this._delete(node.left, key);
      node.left = result.root;
      return { root: node, deleted: result.deleted };
    }
  }

  delete(key: K): boolean {
    const result = this._delete(this._root, key);
    this._root = result.root;
    if (result.deleted) {
      this._size--;
    }
    return result.deleted;
  }

  // ─── Min / Max ───────────────────────────────────────────────────────────

  min(): [K, V] | null {
    if (this._root === null) return null;
    let node = this._root;
    while (node.left !== null) {
      node = node.left;
    }
    return [node.key, node.value];
  }

  max(): [K, V] | null {
    if (this._root === null) return null;
    let node = this._root;
    while (node.right !== null) {
      node = node.right;
    }
    return [node.key, node.value];
  }

  // ─── In-order traversal ──────────────────────────────────────────────────

  private _inOrder(node: TreapNode<K, V> | null, out: [K, V][]): void {
    if (node === null) return;
    this._inOrder(node.left, out);
    out.push([node.key, node.value]);
    this._inOrder(node.right, out);
  }

  entries(): [K, V][] {
    const result: [K, V][] = [];
    this._inOrder(this._root, result);
    return result;
  }

  keys(): K[] {
    return this.entries().map(([k]) => k);
  }

  values(): V[] {
    return this.entries().map(([, v]) => v);
  }

  // ─── Clear ───────────────────────────────────────────────────────────────

  clear(): void {
    this._root = null;
    this._size = 0;
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createTreap<K, V>(compare?: Comparator<K>): Treap<K, V> {
  return new Treap<K, V>(compare);
}
