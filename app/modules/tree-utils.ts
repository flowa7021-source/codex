// @ts-check
// ─── Tree Utilities ───────────────────────────────────────────────────────────
// Generic tree/trie data structure utilities.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TreeNode<T> {
  value: T;
  children: TreeNode<T>[];
  parent?: TreeNode<T>;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Create a tree node with value and optional children. */
export function treeNode<T>(value: T, children?: TreeNode<T>[]): TreeNode<T> {
  const node: TreeNode<T> = { value, children: children ?? [] };
  for (const child of node.children) {
    child.parent = node;
  }
  return node;
}

/** Walk a tree depth-first, calling fn on each node. */
export function treeWalk<T>(
  root: TreeNode<T>,
  fn: (node: TreeNode<T>, depth: number) => void,
  depth = 0,
): void {
  fn(root, depth);
  for (const child of root.children) {
    treeWalk(child, fn, depth + 1);
  }
}

/** Find first node matching predicate. Returns null if not found. */
export function treeFind<T>(
  root: TreeNode<T>,
  predicate: (value: T) => boolean,
): TreeNode<T> | null {
  if (predicate(root.value)) return root;
  for (const child of root.children) {
    const found = treeFind(child, predicate);
    if (found !== null) return found;
  }
  return null;
}

/** Filter tree: return a new tree with only nodes (and their ancestors) matching predicate. */
export function treeFilter<T>(
  root: TreeNode<T>,
  predicate: (value: T) => boolean,
): TreeNode<T> | null {
  const filteredChildren: TreeNode<T>[] = [];
  for (const child of root.children) {
    const filteredChild = treeFilter(child, predicate);
    if (filteredChild !== null) {
      filteredChildren.push(filteredChild);
    }
  }
  if (predicate(root.value) || filteredChildren.length > 0) {
    return treeNode(root.value, filteredChildren);
  }
  return null;
}

/** Map tree: apply fn to every node's value, returning a new tree. */
export function treeMap<T, U>(root: TreeNode<T>, fn: (value: T) => U): TreeNode<U> {
  return treeNode(
    fn(root.value),
    root.children.map((child) => treeMap(child, fn)),
  );
}

/** Get all leaf nodes (nodes with no children). */
export function treeLeaves<T>(root: TreeNode<T>): TreeNode<T>[] {
  if (root.children.length === 0) return [root];
  const leaves: TreeNode<T>[] = [];
  for (const child of root.children) {
    leaves.push(...treeLeaves(child));
  }
  return leaves;
}

/** Get depth of tree (0 for leaf). */
export function treeDepth<T>(root: TreeNode<T>): number {
  if (root.children.length === 0) return 0;
  return 1 + Math.max(...root.children.map(treeDepth));
}

/** Count all nodes in tree. */
export function treeSize<T>(root: TreeNode<T>): number {
  return 1 + root.children.reduce((sum, child) => sum + treeSize(child), 0);
}

/** Convert array with parent references to a tree.
 * items: array of { id, parentId?, ...data }
 * Returns root node(s).
 */
export function arrayToTree<T extends { id: string; parentId?: string }>(
  items: T[],
): TreeNode<T>[] {
  const nodeMap = new Map<string, TreeNode<T>>();

  // First pass: create all nodes
  for (const item of items) {
    nodeMap.set(item.id, treeNode(item));
  }

  const roots: TreeNode<T>[] = [];

  // Second pass: wire up parent-child relationships
  for (const item of items) {
    const node = nodeMap.get(item.id)!;
    if (item.parentId !== undefined && nodeMap.has(item.parentId)) {
      const parent = nodeMap.get(item.parentId)!;
      parent.children.push(node);
      node.parent = parent;
    } else {
      roots.push(node);
    }
  }

  return roots;
}

/** Flatten tree back to array in DFS order. */
export function treeToArray<T>(root: TreeNode<T>): T[] {
  const result: T[] = [];
  treeWalk(root, (node) => result.push(node.value));
  return result;
}
