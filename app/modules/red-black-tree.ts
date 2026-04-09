// ─── Red-Black Tree ─────────────────────────────────────────────────────────
// Self-balancing binary search tree with O(log n) insert, delete, and lookup.
// Each node is colored red or black to maintain balance invariants.

// ─── Types ──────────────────────────────────────────────────────────────────

const enum Color {
  Red = 0,
  Black = 1,
}

interface RBNode<K, V> {
  key: K;
  value: V;
  color: Color;
  left: RBNode<K, V> | null;
  right: RBNode<K, V> | null;
  parent: RBNode<K, V> | null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function defaultCompare<K>(a: K, b: K): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function createNode<K, V>(
  key: K,
  value: V,
  color: Color,
  parent: RBNode<K, V> | null,
): RBNode<K, V> {
  return { key, value, color, left: null, right: null, parent };
}

// ─── RBTree Class ───────────────────────────────────────────────────────────

/**
 * Red-Black balanced binary search tree.
 *
 * @example
 *   const tree = new RBTree<number, string>();
 *   tree.set(3, 'c');
 *   tree.set(1, 'a');
 *   tree.get(1); // 'a'
 *   tree.keys(); // [1, 3]
 */
export class RBTree<K, V> {
  #root: RBNode<K, V> | null = null;
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
    if (this.#root === null) {
      this.#root = createNode(key, value, Color.Black, null);
      this.#size = 1;
      return;
    }

    let current = this.#root;
    let parent: RBNode<K, V> = current;
    let cmp = 0;

    while (current !== null) {
      parent = current;
      cmp = this.#compare(key, current.key);
      if (cmp < 0) {
        current = current.left!;
      } else if (cmp > 0) {
        current = current.right!;
      } else {
        // Key already exists — update value.
        current.value = value;
        return;
      }
    }

    const node = createNode(key, value, Color.Red, parent);
    if (cmp < 0) {
      parent.left = node;
    } else {
      parent.right = node;
    }
    this.#size++;
    this.#insertFixup(node);
  }

  /**
   * Retrieve the value for a key, or `undefined` if absent.
   */
  get(key: K): V | undefined {
    const node = this.#findNode(key);
    return node ? node.value : undefined;
  }

  /**
   * Check whether the tree contains a given key.
   */
  has(key: K): boolean {
    return this.#findNode(key) !== null;
  }

  /**
   * Remove a key. Returns `true` if the key was present.
   */
  delete(key: K): boolean {
    const node = this.#findNode(key);
    if (node === null) return false;
    this.#deleteNode(node);
    this.#size--;
    return true;
  }

  /**
   * Return the smallest key-value pair, or `null` if the tree is empty.
   */
  min(): [K, V] | null {
    if (this.#root === null) return null;
    const node = this.#subtreeMin(this.#root);
    return [node.key, node.value];
  }

  /**
   * Return the largest key-value pair, or `null` if the tree is empty.
   */
  max(): [K, V] | null {
    if (this.#root === null) return null;
    const node = this.#subtreeMax(this.#root);
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
   * Black-height of the tree (number of black nodes on any root-to-null path).
   * Returns 0 for an empty tree.
   */
  height(): number {
    let h = 0;
    let node = this.#root;
    while (node !== null) {
      if (node.color === Color.Black) h++;
      node = node.left;
    }
    return h;
  }

  // ─── Internal: lookup ───────────────────────────────────────────────────

  #findNode(key: K): RBNode<K, V> | null {
    let current = this.#root;
    while (current !== null) {
      const cmp = this.#compare(key, current.key);
      if (cmp < 0) current = current.left;
      else if (cmp > 0) current = current.right;
      else return current;
    }
    return null;
  }

  // ─── Internal: traversal ────────────────────────────────────────────────

  #inOrder(node: RBNode<K, V> | null, fn: (n: RBNode<K, V>) => void): void {
    if (node === null) return;
    this.#inOrder(node.left, fn);
    fn(node);
    this.#inOrder(node.right, fn);
  }

  #subtreeMin(node: RBNode<K, V>): RBNode<K, V> {
    while (node.left !== null) node = node.left;
    return node;
  }

  #subtreeMax(node: RBNode<K, V>): RBNode<K, V> {
    while (node.right !== null) node = node.right;
    return node;
  }

  // ─── Internal: rotations ────────────────────────────────────────────────

  #rotateLeft(x: RBNode<K, V>): void {
    const y = x.right!;
    x.right = y.left;
    if (y.left !== null) y.left.parent = x;
    y.parent = x.parent;
    if (x.parent === null) {
      this.#root = y;
    } else if (x === x.parent.left) {
      x.parent.left = y;
    } else {
      x.parent.right = y;
    }
    y.left = x;
    x.parent = y;
  }

  #rotateRight(x: RBNode<K, V>): void {
    const y = x.left!;
    x.left = y.right;
    if (y.right !== null) y.right.parent = x;
    y.parent = x.parent;
    if (x.parent === null) {
      this.#root = y;
    } else if (x === x.parent.right) {
      x.parent.right = y;
    } else {
      x.parent.left = y;
    }
    y.right = x;
    x.parent = y;
  }

  // ─── Internal: insert fixup ─────────────────────────────────────────────

  #insertFixup(z: RBNode<K, V>): void {
    let node = z;
    while (node.parent !== null && node.parent.color === Color.Red) {
      const grandparent = node.parent.parent!;
      if (node.parent === grandparent.left) {
        const uncle = grandparent.right;
        if (uncle !== null && uncle.color === Color.Red) {
          // Case 1: uncle is red
          node.parent.color = Color.Black;
          uncle.color = Color.Black;
          grandparent.color = Color.Red;
          node = grandparent;
        } else {
          if (node === node.parent.right) {
            // Case 2: triangle — rotate to line
            node = node.parent;
            this.#rotateLeft(node);
          }
          // Case 3: line — rotate and recolor
          node.parent!.color = Color.Black;
          node.parent!.parent!.color = Color.Red;
          this.#rotateRight(node.parent!.parent!);
        }
      } else {
        // Mirror: parent is right child of grandparent
        const uncle = grandparent.left;
        if (uncle !== null && uncle.color === Color.Red) {
          node.parent.color = Color.Black;
          uncle.color = Color.Black;
          grandparent.color = Color.Red;
          node = grandparent;
        } else {
          if (node === node.parent.left) {
            node = node.parent;
            this.#rotateRight(node);
          }
          node.parent!.color = Color.Black;
          node.parent!.parent!.color = Color.Red;
          this.#rotateLeft(node.parent!.parent!);
        }
      }
    }
    this.#root!.color = Color.Black;
  }

  // ─── Internal: delete ───────────────────────────────────────────────────

  #transplant(u: RBNode<K, V>, v: RBNode<K, V> | null): void {
    if (u.parent === null) {
      this.#root = v;
    } else if (u === u.parent.left) {
      u.parent.left = v;
    } else {
      u.parent.right = v;
    }
    if (v !== null) v.parent = u.parent;
  }

  #deleteNode(z: RBNode<K, V>): void {
    let y = z;
    let yOriginalColor = y.color;
    let x: RBNode<K, V> | null;
    let xParent: RBNode<K, V> | null;

    if (z.left === null) {
      x = z.right;
      xParent = z.parent;
      this.#transplant(z, z.right);
    } else if (z.right === null) {
      x = z.left;
      xParent = z.parent;
      this.#transplant(z, z.left);
    } else {
      y = this.#subtreeMin(z.right);
      yOriginalColor = y.color;
      x = y.right;
      if (y.parent === z) {
        xParent = y;
      } else {
        xParent = y.parent;
        this.#transplant(y, y.right);
        y.right = z.right;
        y.right.parent = y;
      }
      this.#transplant(z, y);
      y.left = z.left;
      y.left.parent = y;
      y.color = z.color;
    }

    if (yOriginalColor === Color.Black) {
      this.#deleteFixup(x, xParent);
    }
  }

  #deleteFixup(x: RBNode<K, V> | null, xParent: RBNode<K, V> | null): void {
    while (x !== this.#root && (x === null || x.color === Color.Black)) {
      if (xParent === null) break;
      if (x === xParent.left) {
        let w = xParent.right;
        if (w !== null && w.color === Color.Red) {
          w.color = Color.Black;
          xParent.color = Color.Red;
          this.#rotateLeft(xParent);
          w = xParent.right;
        }
        if (
          (w === null) ||
          ((w.left === null || w.left.color === Color.Black) &&
            (w.right === null || w.right.color === Color.Black))
        ) {
          if (w !== null) w.color = Color.Red;
          x = xParent;
          xParent = x.parent;
        } else {
          if (w!.right === null || w!.right.color === Color.Black) {
            if (w!.left !== null) w!.left.color = Color.Black;
            w!.color = Color.Red;
            this.#rotateRight(w!);
            w = xParent.right;
          }
          w!.color = xParent.color;
          xParent.color = Color.Black;
          if (w!.right !== null) w!.right.color = Color.Black;
          this.#rotateLeft(xParent);
          x = this.#root;
          xParent = null;
        }
      } else {
        // Mirror: x is right child
        let w = xParent.left;
        if (w !== null && w.color === Color.Red) {
          w.color = Color.Black;
          xParent.color = Color.Red;
          this.#rotateRight(xParent);
          w = xParent.left;
        }
        if (
          (w === null) ||
          ((w.right === null || w.right.color === Color.Black) &&
            (w.left === null || w.left.color === Color.Black))
        ) {
          if (w !== null) w.color = Color.Red;
          x = xParent;
          xParent = x.parent;
        } else {
          if (w!.left === null || w!.left.color === Color.Black) {
            if (w!.right !== null) w!.right.color = Color.Black;
            w!.color = Color.Red;
            this.#rotateLeft(w!);
            w = xParent.left;
          }
          w!.color = xParent.color;
          xParent.color = Color.Black;
          if (w!.left !== null) w!.left.color = Color.Black;
          this.#rotateRight(xParent);
          x = this.#root;
          xParent = null;
        }
      }
    }
    if (x !== null) x.color = Color.Black;
  }
}

// ─── Factory ────────────────────────────────────────────────────────────────

/**
 * Create a new Red-Black tree instance.
 */
export function createRBTree<K, V>(
  compare?: (a: K, b: K) => number,
): RBTree<K, V> {
  return new RBTree<K, V>(compare);
}
