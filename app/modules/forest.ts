// @ts-check
// ─── Forest ──────────────────────────────────────────────────────────────────
// A forest is an ordered collection of n-ary trees.  This module provides both
// a `Forest<T>` class and standalone utility functions for converting between
// tree and adjacency-list representations, and for JSON serialisation.

import { createNode, find, flatten, size } from './tree-utils.js';
import type { TreeNode } from './tree-utils.js';

// ─── Forest class ────────────────────────────────────────────────────────────

/** An ordered, mutable collection of root trees. */
export class Forest<T> {
  private trees: TreeNode<T>[];

  constructor(trees: TreeNode<T>[] = []) {
    this.trees = [...trees];
  }

  // ── Mutating methods ───────────────────────────────────────────────────────

  /** Append a root tree to the forest. */
  addTree(root: TreeNode<T>): void {
    this.trees.push(root);
  }

  /**
   * Remove the first root tree whose root value strictly equals `rootValue`.
   * Returns true if a tree was removed, false otherwise.
   */
  removeTree(rootValue: T): boolean {
    const idx = this.trees.findIndex((t) => t.value === rootValue);
    if (idx === -1) return false;
    this.trees.splice(idx, 1);
    return true;
  }

  // ── Query methods ──────────────────────────────────────────────────────────

  /** Return a shallow copy of the array of root nodes. */
  getRoots(): TreeNode<T>[] {
    return [...this.trees];
  }

  /**
   * Search all trees for the first node whose value strictly equals `value`.
   * Trees are searched in order; within each tree BFS is used.
   * Returns null if not found.
   */
  findInAll(value: T): TreeNode<T> | null {
    for (const root of this.trees) {
      const node = find(root, value);
      if (node !== null) return node;
    }
    return null;
  }

  /** Return all values across every tree in BFS order per tree. */
  allValues(): T[] {
    const result: T[] = [];
    for (const root of this.trees) {
      result.push(...flatten(root));
    }
    return result;
  }

  /** Total node count across all trees. */
  totalSize(): number {
    return this.trees.reduce((acc, root) => acc + size(root), 0);
  }

  /**
   * Merge this forest with `other`, returning a new Forest containing all
   * trees from both (this forest's trees first).
   * Neither the original forest nor `other` is mutated.
   */
  merge(other: Forest<T>): Forest<T> {
    return new Forest<T>([...this.trees, ...other.trees]);
  }
}

// ─── Adjacency-list conversion ───────────────────────────────────────────────

/**
 * Convert a tree to an adjacency list mapping each node's value to an array
 * of its children's values.  The iteration order follows BFS.
 *
 * Note: if duplicate values exist in the tree the map key is shared and the
 * children arrays are merged.
 */
export function toAdjacencyList<T>(root: TreeNode<T>): Map<T, T[]> {
  const map = new Map<T, T[]>();
  const queue: TreeNode<T>[] = [root];

  while (queue.length > 0) {
    const node = queue.shift()!;
    const existing = map.get(node.value);
    const childValues = node.children.map((c) => c.value);

    if (existing !== undefined) {
      existing.push(...childValues);
    } else {
      map.set(node.value, childValues);
    }

    for (const child of node.children) {
      queue.push(child);
    }
  }

  return map;
}

/**
 * Build a tree from an adjacency list.
 * `map` maps each value to its children's values.
 * `root` is the root value (must exist as a key in `map`, or have no
 * children entry — in that case it becomes a leaf).
 *
 * Cycles in the map are silently broken: a value is only expanded the first
 * time it is visited (subsequent encounters produce leaf nodes).
 */
export function fromAdjacencyList<T>(map: Map<T, T[]>, root: T): TreeNode<T> {
  const visited = new Set<T>();

  function build(value: T): TreeNode<T> {
    if (visited.has(value)) {
      return createNode(value);
    }
    visited.add(value);
    const childValues = map.get(value) ?? [];
    const children = childValues.map(build);
    return createNode(value, children);
  }

  return build(root);
}

// ─── Serialisation ───────────────────────────────────────────────────────────

/**
 * Serialise a tree to a JSON string.
 * The resulting JSON only includes the `value` and `children` fields.
 */
export function serialize<T>(root: TreeNode<T>): string {
  function strip(node: TreeNode<T>): { value: T; children: ReturnType<typeof strip>[] } {
    return {
      value: node.value,
      children: node.children.map(strip),
    };
  }
  return JSON.stringify(strip(root));
}

/**
 * Deserialise a tree from a JSON string produced by `serialize`.
 * The `parent` backlink is NOT restored (use `treeNode` construction if
 * parent links are needed after deserialisation).
 */
export function deserialize<T>(json: string): TreeNode<T> {
  function restore(obj: { value: T; children: typeof obj[] }): TreeNode<T> {
    return createNode(obj.value, obj.children.map(restore));
  }
  return restore(JSON.parse(json) as { value: T; children: { value: T; children: never[] }[] });
}
