// @ts-check
// ─── Splay Tree ──────────────────────────────────────────────────────────────
// Self-adjusting binary search tree. Recently accessed elements are moved to
// the root via splay operations, giving amortized O(log n) access.

// ─── Types ───────────────────────────────────────────────────────────────────

interface SplayNode<K, V> {
  key: K;
  value: V;
  left: SplayNode<K, V> | null;
  right: SplayNode<K, V> | null;
}

export type Comparator<K> = (a: K, b: K) => number;

// ─── Default comparator ──────────────────────────────────────────────────────

function defaultCompare<K>(a: K, b: K): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

// ─── SplayTree class ─────────────────────────────────────────────────────────

export class SplayTree<K, V> {
  private _root: SplayNode<K, V> | null = null;
  private _size: number = 0;
  private readonly _compare: Comparator<K>;

  constructor(compare?: Comparator<K>) {
    this._compare = compare ?? defaultCompare;
  }

  // ─── Size getter ─────────────────────────────────────────────────────────

  get size(): number {
    return this._size;
  }

  // ─── Splay ───────────────────────────────────────────────────────────────
  // Top-down splay: splits the tree into left and right subtrees while
  // walking toward the target key, then reassembles.

  private _splay(key: K): void {
    if (this._root === null) return;

    // Dummy header node for assembly
    const header: SplayNode<K, V> = { key: undefined as unknown as K, value: undefined as unknown as V, left: null, right: null };
    let leftTreeMax: SplayNode<K, V> = header;
    let rightTreeMin: SplayNode<K, V> = header;
    let current: SplayNode<K, V> = this._root;

    for (;;) {
      const cmp = this._compare(key, current.key);

      if (cmp < 0) {
        if (current.left === null) break;

        // Zig-zig: rotate right
        if (this._compare(key, current.left.key) < 0) {
          const tmp = current.left;
          current.left = tmp.right;
          tmp.right = current;
          current = tmp;
          if (current.left === null) break;
        }

        // Link right
        rightTreeMin.left = current;
        rightTreeMin = current;
        current = current.left;
      } else if (cmp > 0) {
        if (current.right === null) break;

        // Zig-zig: rotate left
        if (this._compare(key, current.right.key) > 0) {
          const tmp = current.right;
          current.right = tmp.left;
          tmp.left = current;
          current = tmp;
          if (current.right === null) break;
        }

        // Link left
        leftTreeMax.right = current;
        leftTreeMax = current;
        current = current.right;
      } else {
        break;
      }
    }

    // Assemble
    leftTreeMax.right = current.left;
    rightTreeMin.left = current.right;
    current.left = header.right;
    current.right = header.left;
    this._root = current;
  }

  // ─── Set ─────────────────────────────────────────────────────────────────

  set(key: K, value: V): void {
    if (this._root === null) {
      this._root = { key, value, left: null, right: null };
      this._size = 1;
      return;
    }

    this._splay(key);

    const cmp = this._compare(key, this._root!.key);

    if (cmp === 0) {
      // Key exists — update value
      this._root!.value = value;
      return;
    }

    const node: SplayNode<K, V> = { key, value, left: null, right: null };

    if (cmp < 0) {
      node.left = this._root!.left;
      node.right = this._root;
      this._root!.left = null;
    } else {
      node.right = this._root!.right;
      node.left = this._root;
      this._root!.right = null;
    }

    this._root = node;
    this._size++;
  }

  // ─── Get ─────────────────────────────────────────────────────────────────

  get(key: K): V | undefined {
    if (this._root === null) return undefined;

    this._splay(key);

    if (this._compare(key, this._root!.key) === 0) {
      return this._root!.value;
    }

    return undefined;
  }

  // ─── Has ─────────────────────────────────────────────────────────────────

  has(key: K): boolean {
    if (this._root === null) return false;

    this._splay(key);

    return this._compare(key, this._root!.key) === 0;
  }

  // ─── Delete ──────────────────────────────────────────────────────────────

  delete(key: K): boolean {
    if (this._root === null) return false;

    this._splay(key);

    if (this._compare(key, this._root!.key) !== 0) {
      return false;
    }

    if (this._root!.left === null) {
      this._root = this._root!.right;
    } else {
      const right = this._root!.right;
      this._root = this._root!.left;
      // Splay the max of the left subtree to the root
      this._splay(key);
      this._root!.right = right;
    }

    this._size--;
    return true;
  }

  // ─── Min / Max ───────────────────────────────────────────────────────────

  min(): [K, V] | null {
    if (this._root === null) return null;
    let node = this._root;
    while (node.left !== null) {
      node = node.left;
    }
    // Splay the min node to the root for self-adjusting behaviour
    this._splay(node.key);
    return [node.key, node.value];
  }

  max(): [K, V] | null {
    if (this._root === null) return null;
    let node = this._root;
    while (node.right !== null) {
      node = node.right;
    }
    // Splay the max node to the root
    this._splay(node.key);
    return [node.key, node.value];
  }

  // ─── In-order traversal ──────────────────────────────────────────────────

  private _inOrder(node: SplayNode<K, V> | null, out: [K, V][]): void {
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

export function createSplayTree<K, V>(compare?: Comparator<K>): SplayTree<K, V> {
  return new SplayTree<K, V>(compare);
}
