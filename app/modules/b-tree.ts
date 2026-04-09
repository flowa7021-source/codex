// @ts-check
// ─── B-Tree of Configurable Order ──────────────────────────────────────────
// A self-balancing search tree where each node can contain multiple keys.
// Supports configurable order and custom comparator.

// ─── Types ────────────────────────────────────────────────────────────────────

interface BTreeNode<K, V> {
  keys: K[];
  values: V[];
  children: BTreeNode<K, V>[];
  leaf: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createNode<K, V>(leaf: boolean): BTreeNode<K, V> {
  return { keys: [], values: [], children: [], leaf };
}

function defaultCompare<K>(a: K, b: K): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

// ─── BTree ────────────────────────────────────────────────────────────────────

export class BTree<K, V> {
  readonly #order: number;
  readonly #compare: (a: K, b: K) => number;
  #root: BTreeNode<K, V>;
  #size: number;

  constructor(order: number = 3, compare?: (a: K, b: K) => number) {
    if (order < 2) throw new RangeError('Order must be at least 2');
    this.#order = order;
    this.#compare = compare ?? defaultCompare;
    this.#root = createNode<K, V>(true);
    this.#size = 0;
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  get size(): number {
    return this.#size;
  }

  /** Insert or update a key-value pair. */
  set(key: K, value: V): void {
    // Try to update existing key first
    const updated = this.#update(this.#root, key, value);
    if (updated) return;

    // If root is full, split it before inserting
    if (this.#root.keys.length === 2 * this.#order - 1) {
      const newRoot = createNode<K, V>(false);
      newRoot.children.push(this.#root);
      this.#splitChild(newRoot, 0);
      this.#root = newRoot;
    }
    this.#insertNonFull(this.#root, key, value);
    this.#size++;
  }

  /** Retrieve the value for a key, or undefined if absent. */
  get(key: K): V | undefined {
    return this.#search(this.#root, key);
  }

  /** Check whether a key exists in the tree. */
  has(key: K): boolean {
    return this.#search(this.#root, key) !== undefined;
  }

  /** Delete a key. Returns true if the key was found and removed. */
  delete(key: K): boolean {
    const removed = this.#delete(this.#root, key);
    if (!removed) return false;
    this.#size--;

    // Shrink tree if root has no keys but has a child
    if (this.#root.keys.length === 0 && !this.#root.leaf) {
      this.#root = this.#root.children[0];
    }
    return true;
  }

  /** Return the minimum key-value pair, or null if empty. */
  min(): [K, V] | null {
    if (this.#size === 0) return null;
    let node = this.#root;
    while (!node.leaf) {
      node = node.children[0];
    }
    return [node.keys[0], node.values[0]];
  }

  /** Return the maximum key-value pair, or null if empty. */
  max(): [K, V] | null {
    if (this.#size === 0) return null;
    let node = this.#root;
    while (!node.leaf) {
      node = node.children[node.children.length - 1];
    }
    const last = node.keys.length - 1;
    return [node.keys[last], node.values[last]];
  }

  /** Return all keys in sorted order. */
  keys(): K[] {
    const result: K[] = [];
    this.#inOrder(this.#root, (k, _v) => result.push(k));
    return result;
  }

  /** Return all entries in sorted order. */
  entries(): [K, V][] {
    const result: [K, V][] = [];
    this.#inOrder(this.#root, (k, v) => result.push([k, v]));
    return result;
  }

  /** Remove all entries. */
  clear(): void {
    this.#root = createNode<K, V>(true);
    this.#size = 0;
  }

  /** Return the height of the tree (0 for empty). */
  height(): number {
    if (this.#size === 0) return 0;
    let h = 1;
    let node = this.#root;
    while (!node.leaf) {
      h++;
      node = node.children[0];
    }
    return h;
  }

  // ── Private Helpers ─────────────────────────────────────────────────────────

  /** Binary search for key position within a node. Returns index where key is or should be inserted. */
  #findKeyIndex(node: BTreeNode<K, V>, key: K): number {
    let lo = 0;
    let hi = node.keys.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (this.#compare(node.keys[mid], key) < 0) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    return lo;
  }

  /** Search for a key starting at node. */
  #search(node: BTreeNode<K, V>, key: K): V | undefined {
    const i = this.#findKeyIndex(node, key);
    if (i < node.keys.length && this.#compare(node.keys[i], key) === 0) {
      return node.values[i];
    }
    if (node.leaf) return undefined;
    return this.#search(node.children[i], key);
  }

  /** Update existing key's value. Returns true if key was found. */
  #update(node: BTreeNode<K, V>, key: K, value: V): boolean {
    const i = this.#findKeyIndex(node, key);
    if (i < node.keys.length && this.#compare(node.keys[i], key) === 0) {
      node.values[i] = value;
      return true;
    }
    if (node.leaf) return false;
    return this.#update(node.children[i], key, value);
  }

  /** Split the i-th child of parent, which must be full. */
  #splitChild(parent: BTreeNode<K, V>, i: number): void {
    const t = this.#order;
    const fullChild = parent.children[i];
    const newChild = createNode<K, V>(fullChild.leaf);

    // Median goes up to parent
    parent.keys.splice(i, 0, fullChild.keys[t - 1]);
    parent.values.splice(i, 0, fullChild.values[t - 1]);

    // Right half of keys/values go to new child
    newChild.keys = fullChild.keys.splice(t, t - 1);
    newChild.values = fullChild.values.splice(t, t - 1);

    // Remove the median from full child
    fullChild.keys.pop();
    fullChild.values.pop();

    // Move children if internal node
    if (!fullChild.leaf) {
      newChild.children = fullChild.children.splice(t, t);
    }

    parent.children.splice(i + 1, 0, newChild);
  }

  /** Insert into a non-full node. */
  #insertNonFull(node: BTreeNode<K, V>, key: K, value: V): void {
    const i = this.#findKeyIndex(node, key);

    if (node.leaf) {
      node.keys.splice(i, 0, key);
      node.values.splice(i, 0, value);
      return;
    }

    // If child is full, split it first
    if (node.children[i].keys.length === 2 * this.#order - 1) {
      this.#splitChild(node, i);
      // After split, decide which of the two children to descend into
      if (this.#compare(key, node.keys[i]) > 0) {
        return this.#insertNonFull(node.children[i + 1], key, value);
      }
    }
    this.#insertNonFull(node.children[i], key, value);
  }

  /** In-order traversal calling visitor on each key-value pair. */
  #inOrder(node: BTreeNode<K, V>, visitor: (k: K, v: V) => void): void {
    for (let i = 0; i < node.keys.length; i++) {
      if (!node.leaf) {
        this.#inOrder(node.children[i], visitor);
      }
      visitor(node.keys[i], node.values[i]);
    }
    if (!node.leaf) {
      this.#inOrder(node.children[node.keys.length], visitor);
    }
  }

  /** Delete a key from the subtree rooted at node. */
  #delete(node: BTreeNode<K, V>, key: K): boolean {
    const i = this.#findKeyIndex(node, key);
    const found = i < node.keys.length && this.#compare(node.keys[i], key) === 0;

    if (node.leaf) {
      if (!found) return false;
      node.keys.splice(i, 1);
      node.values.splice(i, 1);
      return true;
    }

    if (found) {
      return this.#deleteFromInternal(node, i);
    }

    // Key is not in this node; descend into child
    return this.#deleteFromChild(node, i, key);
  }

  /** Delete a key that is in an internal node at position i. */
  #deleteFromInternal(node: BTreeNode<K, V>, i: number): boolean {
    const t = this.#order;

    if (node.children[i].keys.length >= t) {
      // Replace with predecessor
      const [predK, predV] = this.#extractMax(node.children[i]);
      node.keys[i] = predK;
      node.values[i] = predV;
      return true;
    }

    if (node.children[i + 1].keys.length >= t) {
      // Replace with successor
      const [succK, succV] = this.#extractMin(node.children[i + 1]);
      node.keys[i] = succK;
      node.values[i] = succV;
      return true;
    }

    // Merge children[i] and children[i+1]
    this.#merge(node, i);
    return this.#delete(node.children[i], node.keys.length >= i ? node.children[i].keys[t - 1] : node.children[i].keys[node.children[i].keys.length - 1]);
  }

  /** Delete key from a child subtree, ensuring child has enough keys. */
  #deleteFromChild(node: BTreeNode<K, V>, i: number, key: K): boolean {
    const t = this.#order;
    const child = node.children[i];

    if (child.keys.length >= t) {
      return this.#delete(child, key);
    }

    // Try borrowing from left sibling
    if (i > 0 && node.children[i - 1].keys.length >= t) {
      this.#borrowFromLeft(node, i);
      return this.#delete(node.children[i], key);
    }

    // Try borrowing from right sibling
    if (i < node.children.length - 1 && node.children[i + 1].keys.length >= t) {
      this.#borrowFromRight(node, i);
      return this.#delete(node.children[i], key);
    }

    // Merge with a sibling
    if (i < node.children.length - 1) {
      this.#merge(node, i);
      return this.#delete(node.children[i], key);
    } else {
      this.#merge(node, i - 1);
      return this.#delete(node.children[i - 1], key);
    }
  }

  /** Extract the maximum key-value from a subtree and remove it. */
  #extractMax(node: BTreeNode<K, V>): [K, V] {
    if (node.leaf) {
      return [node.keys.pop()!, node.values.pop()!];
    }
    const lastIdx = node.children.length - 1;
    if (node.children[lastIdx].keys.length < this.#order) {
      // Ensure child has enough keys
      if (lastIdx > 0 && node.children[lastIdx - 1].keys.length >= this.#order) {
        this.#borrowFromLeft(node, lastIdx);
      } else {
        this.#merge(node, lastIdx - 1);
        return this.#extractMax(node.children[node.children.length - 1]);
      }
    }
    return this.#extractMax(node.children[node.children.length - 1]);
  }

  /** Extract the minimum key-value from a subtree and remove it. */
  #extractMin(node: BTreeNode<K, V>): [K, V] {
    if (node.leaf) {
      return [node.keys.shift()!, node.values.shift()!];
    }
    if (node.children[0].keys.length < this.#order) {
      if (node.children.length > 1 && node.children[1].keys.length >= this.#order) {
        this.#borrowFromRight(node, 0);
      } else {
        this.#merge(node, 0);
        return this.#extractMin(node.children[0]);
      }
    }
    return this.#extractMin(node.children[0]);
  }

  /** Borrow a key from the left sibling of children[i]. */
  #borrowFromLeft(parent: BTreeNode<K, V>, i: number): void {
    const child = parent.children[i];
    const leftSib = parent.children[i - 1];

    child.keys.unshift(parent.keys[i - 1]);
    child.values.unshift(parent.values[i - 1]);
    parent.keys[i - 1] = leftSib.keys.pop()!;
    parent.values[i - 1] = leftSib.values.pop()!;

    if (!child.leaf) {
      child.children.unshift(leftSib.children.pop()!);
    }
  }

  /** Borrow a key from the right sibling of children[i]. */
  #borrowFromRight(parent: BTreeNode<K, V>, i: number): void {
    const child = parent.children[i];
    const rightSib = parent.children[i + 1];

    child.keys.push(parent.keys[i]);
    child.values.push(parent.values[i]);
    parent.keys[i] = rightSib.keys.shift()!;
    parent.values[i] = rightSib.values.shift()!;

    if (!child.leaf) {
      child.children.push(rightSib.children.shift()!);
    }
  }

  /** Merge children[i] and children[i+1] using parent key at i. */
  #merge(parent: BTreeNode<K, V>, i: number): void {
    const left = parent.children[i];
    const right = parent.children[i + 1];

    left.keys.push(parent.keys[i]);
    left.values.push(parent.values[i]);
    left.keys.push(...right.keys);
    left.values.push(...right.values);
    if (!left.leaf) {
      left.children.push(...right.children);
    }

    parent.keys.splice(i, 1);
    parent.values.splice(i, 1);
    parent.children.splice(i + 1, 1);
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createBTree<K, V>(order?: number): BTree<K, V> {
  return new BTree<K, V>(order);
}
