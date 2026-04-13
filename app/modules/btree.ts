// @ts-check
// ─── B-Tree ──────────────────────────────────────────────────────────────────
// A balanced B-Tree supporting generic key-value pairs. The tree is
// parameterised by a minimum degree `t` (default 3). Each non-root node holds
// at least t-1 keys and at most 2t-1 keys. Lookup, insert, and delete are all
// O(log n).

// ─── Internal Node ───────────────────────────────────────────────────────────

/** A single node inside the B-Tree. */
interface BTreeNode<K, V> {
  keys: K[];
  values: V[];
  children: BTreeNode<K, V>[];
  leaf: boolean;
}

function createNode<K, V>(leaf: boolean): BTreeNode<K, V> {
  return { keys: [], values: [], children: [], leaf };
}

// ─── BTree ───────────────────────────────────────────────────────────────────

/**
 * Generic B-Tree with configurable minimum degree `t`.
 * All keys must be totally ordered by the supplied comparator (default: < / >
 * on numbers/strings).
 */
export class BTree<K, V> {
  readonly #t: number;
  readonly #cmp: (a: K, b: K) => number;
  #root: BTreeNode<K, V>;
  #size: number;

  /**
   * @param t       Minimum degree (≥ 2). Every non-root node has [t-1, 2t-1]
   *                keys. Default: 3.
   * @param compare Comparator function. Negative → a < b, 0 → a === b,
   *                positive → a > b. Default: lexicographic/numeric.
   */
  constructor(
    t: number = 3,
    compare: (a: K, b: K) => number = defaultCmp as (a: K, b: K) => number,
  ) {
    if (t < 2) throw new RangeError('BTree minimum degree t must be ≥ 2');
    this.#t = t;
    this.#cmp = compare;
    this.#root = createNode<K, V>(true);
    this.#size = 0;
  }

  // ── Public accessors ────────────────────────────────────────────────────────

  /** Number of key-value pairs in the tree. */
  get size(): number {
    return this.#size;
  }

  /** Height of the tree (1 for an empty/single-node tree). */
  get height(): number {
    return nodeHeight(this.#root);
  }

  // ── Core operations ─────────────────────────────────────────────────────────

  /**
   * Insert or update a key-value pair.
   * If the key already exists its value is replaced.
   */
  set(key: K, value: V): void {
    // Check for existing key first — update in place.
    if (this.#updateExisting(this.#root, key, value)) return;

    // Root is full → split it and create a new root.
    if (this.#root.keys.length === 2 * this.#t - 1) {
      const newRoot = createNode<K, V>(false);
      newRoot.children.push(this.#root);
      this.#splitChild(newRoot, 0);
      this.#root = newRoot;
    }

    this.#insertNonFull(this.#root, key, value);
    this.#size++;
  }

  /** Look up the value associated with `key`, or `undefined` if absent. */
  get(key: K): V | undefined {
    return this.#search(this.#root, key);
  }

  /** Return `true` if the tree contains `key`. */
  has(key: K): boolean {
    return this.#search(this.#root, key) !== undefined;
  }

  /**
   * Delete `key` from the tree.
   * Returns `true` if the key existed and was removed, `false` otherwise.
   */
  delete(key: K): boolean {
    const existed = this.#delete(this.#root, key);
    if (existed) {
      this.#size--;
      // Shrink the root if it became empty after deletion.
      if (this.#root.keys.length === 0 && !this.#root.leaf) {
        this.#root = this.#root.children[0];
      }
    }
    return existed;
  }

  // ── Traversal ────────────────────────────────────────────────────────────────

  /** All keys in sorted (ascending) order. */
  keys(): K[] {
    const result: K[] = [];
    inorder<K, V>(this.#root, (k) => result.push(k));
    return result;
  }

  /** All values in key order. */
  values(): V[] {
    const result: V[] = [];
    inorderKV<K, V>(this.#root, (_, v) => result.push(v));
    return result;
  }

  /** All entries as `[key, value]` pairs in key order. */
  entries(): [K, V][] {
    const result: [K, V][] = [];
    inorderKV<K, V>(this.#root, (k, v) => result.push([k, v]));
    return result;
  }

  /**
   * Range query: all `[key, value]` pairs where `lo ≤ key ≤ hi`.
   * Both endpoints are inclusive.
   */
  range(lo: K, hi: K): [K, V][] {
    const result: [K, V][] = [];
    this.#rangeQuery(this.#root, lo, hi, result);
    return result;
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  /** Return the value for `key` in the subtree rooted at `node`, or undefined. */
  #search(node: BTreeNode<K, V>, key: K): V | undefined {
    let i = findFirst(node.keys, key, this.#cmp);
    if (i < node.keys.length && this.#cmp(key, node.keys[i]) === 0) {
      return node.values[i];
    }
    if (node.leaf) return undefined;
    return this.#search(node.children[i], key);
  }

  /**
   * Attempt to update an existing key's value.
   * Returns `true` if the key was found and updated.
   */
  #updateExisting(node: BTreeNode<K, V>, key: K, value: V): boolean {
    let i = findFirst(node.keys, key, this.#cmp);
    if (i < node.keys.length && this.#cmp(key, node.keys[i]) === 0) {
      node.values[i] = value;
      return true;
    }
    if (node.leaf) return false;
    return this.#updateExisting(node.children[i], key, value);
  }

  /**
   * Insert into a node that is guaranteed to be non-full.
   * The caller is responsible for pre-splitting full children.
   */
  #insertNonFull(node: BTreeNode<K, V>, key: K, value: V): void {
    let i = node.keys.length - 1;

    if (node.leaf) {
      // Shift right to make room.
      node.keys.push(key);
      node.values.push(value);
      while (i >= 0 && this.#cmp(key, node.keys[i]) < 0) {
        node.keys[i + 1] = node.keys[i];
        node.values[i + 1] = node.values[i];
        i--;
      }
      node.keys[i + 1] = key;
      node.values[i + 1] = value;
    } else {
      // Find the right child and split it if full.
      while (i >= 0 && this.#cmp(key, node.keys[i]) < 0) i--;
      i++;
      if (node.children[i].keys.length === 2 * this.#t - 1) {
        this.#splitChild(node, i);
        if (this.#cmp(key, node.keys[i]) > 0) i++;
      }
      this.#insertNonFull(node.children[i], key, value);
    }
  }

  /**
   * Split the `idx`-th child of `parent` which must be full (2t-1 keys).
   * The median key is promoted to `parent`.
   */
  #splitChild(parent: BTreeNode<K, V>, idx: number): void {
    const t = this.#t;
    const full = parent.children[idx];
    const sibling = createNode<K, V>(full.leaf);

    // The sibling takes the upper half of full's keys.
    sibling.keys = full.keys.splice(t, t - 1);
    sibling.values = full.values.splice(t, t - 1);

    // Promote the median to the parent.
    const medKey = full.keys.pop()!;
    const medVal = full.values.pop()!;

    if (!full.leaf) {
      sibling.children = full.children.splice(t);
    }

    // Insert median into parent at position idx.
    parent.keys.splice(idx, 0, medKey);
    parent.values.splice(idx, 0, medVal);
    parent.children.splice(idx + 1, 0, sibling);
  }

  // ── Delete ───────────────────────────────────────────────────────────────────

  /**
   * Core B-Tree deletion. Returns `true` if key was present.
   * Maintains the B-Tree invariant: every node (except root) has ≥ t-1 keys.
   */
  #delete(node: BTreeNode<K, V>, key: K): boolean {
    const t = this.#t;
    const i = findFirst(node.keys, key, this.#cmp);
    const found = i < node.keys.length && this.#cmp(key, node.keys[i]) === 0;

    if (node.leaf) {
      if (!found) return false;
      node.keys.splice(i, 1);
      node.values.splice(i, 1);
      return true;
    }

    if (found) {
      // Case 2a: left child has ≥ t keys → replace with predecessor.
      if (node.children[i].keys.length >= t) {
        const [predKey, predVal] = this.#getPredecessor(node.children[i]);
        node.keys[i] = predKey;
        node.values[i] = predVal;
        return this.#delete(node.children[i], predKey);
      }
      // Case 2b: right child has ≥ t keys → replace with successor.
      if (node.children[i + 1].keys.length >= t) {
        const [succKey, succVal] = this.#getSuccessor(node.children[i + 1]);
        node.keys[i] = succKey;
        node.values[i] = succVal;
        return this.#delete(node.children[i + 1], succKey);
      }
      // Case 2c: both children have t-1 keys → merge.
      this.#merge(node, i);
      return this.#delete(node.children[i], key);
    }

    // Key not in this node — descend into the appropriate child.
    // Ensure that child has ≥ t keys before descending (Case 3).
    let childIdx = i;
    if (node.children[childIdx].keys.length < t) {
      childIdx = this.#fill(node, childIdx);
    }
    return this.#delete(node.children[childIdx], key);
  }

  /** Return the [key, value] of the rightmost (largest) entry in `node`'s subtree. */
  #getPredecessor(node: BTreeNode<K, V>): [K, V] {
    let cur = node;
    while (!cur.leaf) cur = cur.children[cur.children.length - 1];
    return [cur.keys[cur.keys.length - 1], cur.values[cur.values.length - 1]];
  }

  /** Return the [key, value] of the leftmost (smallest) entry in `node`'s subtree. */
  #getSuccessor(node: BTreeNode<K, V>): [K, V] {
    let cur = node;
    while (!cur.leaf) cur = cur.children[0];
    return [cur.keys[0], cur.values[0]];
  }

  /**
   * Merge children[idx] and children[idx+1], pulling down node.keys[idx].
   * After this call node.children[idx] has 2t-1 keys and node.children[idx+1]
   * is removed.
   */
  #merge(node: BTreeNode<K, V>, idx: number): void {
    const left = node.children[idx];
    const right = node.children[idx + 1];

    left.keys.push(node.keys[idx]);
    left.values.push(node.values[idx]);

    for (const k of right.keys) left.keys.push(k);
    for (const v of right.values) left.values.push(v);
    for (const c of right.children) left.children.push(c);

    node.keys.splice(idx, 1);
    node.values.splice(idx, 1);
    node.children.splice(idx + 1, 1);
  }

  /**
   * Ensure the `idx`-th child of `node` has at least `t` keys.
   * Uses rotation from a sibling or merging, then returns the (possibly
   * adjusted) index to descend into.
   */
  #fill(node: BTreeNode<K, V>, idx: number): number {
    const t = this.#t;

    if (idx > 0 && node.children[idx - 1].keys.length >= t) {
      // Borrow from left sibling.
      this.#borrowFromLeft(node, idx);
      return idx;
    }

    if (idx < node.children.length - 1 && node.children[idx + 1].keys.length >= t) {
      // Borrow from right sibling.
      this.#borrowFromRight(node, idx);
      return idx;
    }

    // Merge with a sibling.
    if (idx < node.children.length - 1) {
      this.#merge(node, idx);
      return idx;
    }
    this.#merge(node, idx - 1);
    return idx - 1;
  }

  /** Rotate a key from the left sibling down into children[idx]. */
  #borrowFromLeft(node: BTreeNode<K, V>, idx: number): void {
    const child = node.children[idx];
    const sibling = node.children[idx - 1];

    // Shift child's keys right by one.
    child.keys.unshift(node.keys[idx - 1]);
    child.values.unshift(node.values[idx - 1]);

    // Promote sibling's last key to parent.
    node.keys[idx - 1] = sibling.keys.pop()!;
    node.values[idx - 1] = sibling.values.pop()!;

    if (!sibling.leaf) {
      child.children.unshift(sibling.children.pop()!);
    }
  }

  /** Rotate a key from the right sibling down into children[idx]. */
  #borrowFromRight(node: BTreeNode<K, V>, idx: number): void {
    const child = node.children[idx];
    const sibling = node.children[idx + 1];

    // Append parent's key to child.
    child.keys.push(node.keys[idx]);
    child.values.push(node.values[idx]);

    // Promote sibling's first key to parent.
    node.keys[idx] = sibling.keys.shift()!;
    node.values[idx] = sibling.values.shift()!;

    if (!sibling.leaf) {
      child.children.push(sibling.children.shift()!);
    }
  }

  // ── Range query ──────────────────────────────────────────────────────────────

  #rangeQuery(
    node: BTreeNode<K, V>,
    lo: K,
    hi: K,
    result: [K, V][],
  ): void {
    const cmp = this.#cmp;
    for (let i = 0; i < node.keys.length; i++) {
      const k = node.keys[i];
      // Descend into left child if it might contain keys ≥ lo.
      if (!node.leaf && cmp(lo, k) <= 0) {
        this.#rangeQuery(node.children[i], lo, hi, result);
      }
      if (cmp(k, lo) >= 0 && cmp(k, hi) <= 0) {
        result.push([k, node.values[i]]);
      }
      // Once we've passed hi, no further keys or right children matter.
      if (cmp(k, hi) > 0) return;
    }
    // Descend into the rightmost child.
    if (!node.leaf) {
      this.#rangeQuery(node.children[node.children.length - 1], lo, hi, result);
    }
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────────

/**
 * Default comparator that works for numbers and strings.
 * Uses < / > operators so it behaves like Array.prototype.sort's default.
 */
function defaultCmp<K>(a: K, b: K): number {
  if ((a as unknown as number) < (b as unknown as number)) return -1;
  if ((a as unknown as number) > (b as unknown as number)) return 1;
  return 0;
}

/**
 * Return the first index `i` such that `keys[i] >= key` (lower-bound
 * binary search). Returns `keys.length` when all keys are < key.
 */
function findFirst<K>(keys: K[], key: K, cmp: (a: K, b: K) => number): number {
  let lo = 0;
  let hi = keys.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (cmp(keys[mid], key) < 0) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return lo;
}

/** Compute the height of a B-Tree node's subtree recursively. */
function nodeHeight<K, V>(node: BTreeNode<K, V>): number {
  if (node.leaf) return 1;
  return 1 + nodeHeight(node.children[0]);
}

/** In-order traversal yielding only keys. */
function inorder<K, V>(node: BTreeNode<K, V>, visit: (k: K) => void): void {
  for (let i = 0; i < node.keys.length; i++) {
    if (!node.leaf) inorder(node.children[i], visit);
    visit(node.keys[i]);
  }
  if (!node.leaf) inorder(node.children[node.children.length - 1], visit);
}

/** In-order traversal yielding key-value pairs. */
function inorderKV<K, V>(
  node: BTreeNode<K, V>,
  visit: (k: K, v: V) => void,
): void {
  for (let i = 0; i < node.keys.length; i++) {
    if (!node.leaf) inorderKV(node.children[i], visit);
    visit(node.keys[i], node.values[i]);
  }
  if (!node.leaf) inorderKV(node.children[node.children.length - 1], visit);
}
