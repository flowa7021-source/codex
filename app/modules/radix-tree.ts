// @ts-check
// ─── Compressed Radix Tree (Patricia Trie) ────────────────────────────────────
// A space-efficient trie where each node that is the only child is merged with
// its parent, storing edge labels as substrings rather than single characters.

// ─── Types ────────────────────────────────────────────────────────────────────

interface RadixNode<V> {
  children: Map<string, RadixNode<V>>;
  value: V | undefined;
  hasValue: boolean;
}

function createNode<V>(): RadixNode<V> {
  return { children: new Map(), value: undefined, hasValue: false };
}

// ─── RadixTree ──────────────────────────────────────────────────────────────

export class RadixTree<V> {
  readonly #root: RadixNode<V> = createNode();
  #size: number = 0;

  // ── Public API ──────────────────────────────────────────────────────────────

  /** Insert or update a key-value pair. */
  set(key: string, value: V): void {
    this.#insert(this.#root, key, value);
  }

  /** Return the value associated with `key`, or `undefined`. */
  get(key: string): V | undefined {
    const node = this.#find(this.#root, key);
    return node?.hasValue ? node.value : undefined;
  }

  /** Return `true` if the tree contains `key`. */
  has(key: string): boolean {
    const node = this.#find(this.#root, key);
    return node !== null && node.hasValue;
  }

  /** Remove `key` from the tree. Returns `true` if the key existed. */
  delete(key: string): boolean {
    const deleted = this.#delete(this.#root, key);
    if (deleted) this.#size--;
    return deleted;
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

  /** Return all values in key-sorted order. */
  values(): V[] {
    const result: V[] = [];
    this.#collectValues(this.#root, '', result);
    return result;
  }

  /** Return all entries as [key, value] pairs in key-sorted order. */
  entries(): [string, V][] {
    const result: [string, V][] = [];
    this.#collectEntries(this.#root, '', result);
    return result;
  }

  /** Return all keys that start with `prefix`. */
  keysWithPrefix(prefix: string): string[] {
    const result: string[] = [];
    this.#findKeysWithPrefix(this.#root, prefix, '', result);
    return result;
  }

  /** Remove all entries. */
  clear(): void {
    this.#root.children.clear();
    this.#root.value = undefined;
    this.#root.hasValue = false;
    this.#size = 0;
  }

  // ── Internal helpers ────────────────────────────────────────────────────────

  #insert(node: RadixNode<V>, key: string, value: V): void {
    // Empty remaining key → store value at this node
    if (key.length === 0) {
      if (!node.hasValue) this.#size++;
      node.value = value;
      node.hasValue = true;
      return;
    }

    for (const [edge, child] of node.children) {
      const common = commonPrefixLength(key, edge);

      if (common === 0) continue;

      if (common === edge.length && common === key.length) {
        // Exact match on edge label
        if (!child.hasValue) this.#size++;
        child.value = value;
        child.hasValue = true;
        return;
      }

      if (common === edge.length) {
        // Key extends beyond this edge – recurse into child
        this.#insert(child, key.slice(common), value);
        return;
      }

      // Partial match – split the edge
      const splitNode: RadixNode<V> = createNode();
      node.children.delete(edge);
      node.children.set(edge.slice(0, common), splitNode);
      splitNode.children.set(edge.slice(common), child);

      if (common === key.length) {
        // The key ends exactly at the split point
        splitNode.value = value;
        splitNode.hasValue = true;
        this.#size++;
      } else {
        // Add new child for the remaining part of key
        const newChild: RadixNode<V> = createNode();
        newChild.value = value;
        newChild.hasValue = true;
        splitNode.children.set(key.slice(common), newChild);
        this.#size++;
      }
      return;
    }

    // No matching edge found – create a new one
    const newChild: RadixNode<V> = createNode();
    newChild.value = value;
    newChild.hasValue = true;
    node.children.set(key, newChild);
    this.#size++;
  }

  #find(node: RadixNode<V>, key: string): RadixNode<V> | null {
    if (key.length === 0) return node;

    for (const [edge, child] of node.children) {
      const common = commonPrefixLength(key, edge);

      if (common === 0) continue;

      if (common === edge.length && common === key.length) {
        return child;
      }

      if (common === edge.length) {
        return this.#find(child, key.slice(common));
      }

      // Partial match → key not in tree
      return null;
    }

    return null;
  }

  #delete(node: RadixNode<V>, key: string): boolean {
    if (key.length === 0) {
      if (!node.hasValue) return false;
      node.value = undefined;
      node.hasValue = false;
      return true;
    }

    for (const [edge, child] of node.children) {
      const common = commonPrefixLength(key, edge);

      if (common === 0) continue;

      if (common < edge.length) return false;

      const remaining = key.slice(common);
      const deleted = this.#delete(child, remaining);

      if (deleted) {
        // Compress: if child has no value and only one child, merge them
        if (!child.hasValue && child.children.size === 1) {
          const [childEdge, grandChild] = child.children.entries().next().value!;
          node.children.delete(edge);
          node.children.set(edge + childEdge, grandChild);
        } else if (!child.hasValue && child.children.size === 0) {
          node.children.delete(edge);
        }
      }

      return deleted;
    }

    return false;
  }

  #collectKeys(node: RadixNode<V>, prefix: string, result: string[]): void {
    if (node.hasValue) result.push(prefix);
    const sorted = [...node.children.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1);
    for (const [edge, child] of sorted) {
      this.#collectKeys(child, prefix + edge, result);
    }
  }

  #collectValues(node: RadixNode<V>, prefix: string, result: V[]): void {
    if (node.hasValue) result.push(node.value!);
    const sorted = [...node.children.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1);
    for (const [edge, child] of sorted) {
      this.#collectValues(child, prefix + edge, result);
    }
  }

  #collectEntries(node: RadixNode<V>, prefix: string, result: [string, V][]): void {
    if (node.hasValue) result.push([prefix, node.value!]);
    const sorted = [...node.children.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1);
    for (const [edge, child] of sorted) {
      this.#collectEntries(child, prefix + edge, result);
    }
  }

  #findKeysWithPrefix(
    node: RadixNode<V>,
    prefix: string,
    accumulated: string,
    result: string[],
  ): void {
    // If the remaining prefix is empty, collect all keys under this node
    if (prefix.length === 0) {
      this.#collectKeys(node, accumulated, result);
      return;
    }

    for (const [edge, child] of node.children) {
      const common = commonPrefixLength(prefix, edge);

      if (common === 0) continue;

      if (common === prefix.length && common <= edge.length) {
        // The prefix is fully consumed within this edge
        this.#collectKeys(child, accumulated + edge, result);
        return;
      }

      if (common === edge.length) {
        // Continue matching the rest of the prefix in the child
        this.#findKeysWithPrefix(child, prefix.slice(common), accumulated + edge, result);
        return;
      }
    }
  }
}

// ─── Utility ────────────────────────────────────────────────────────────────

function commonPrefixLength(a: string, b: string): number {
  const len = Math.min(a.length, b.length);
  let i = 0;
  while (i < len && a[i] === b[i]) i++;
  return i;
}

// ─── Factory ────────────────────────────────────────────────────────────────

export function createRadixTree<V>(): RadixTree<V> {
  return new RadixTree<V>();
}
