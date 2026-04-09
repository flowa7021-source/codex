// @ts-check
// ─── Tree Utilities ───────────────────────────────────────────────────────────
// Generic tree/trie data structure utilities.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TreeNode<T> {
  value: T;
  children: TreeNode<T>[];
  parent?: TreeNode<T>;
}

/** Traversal order supported by `traverse`. */
export type TraversalOrder = 'preorder' | 'inorder' | 'postorder' | 'bfs';

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

// ─── Extended API ─────────────────────────────────────────────────────────────
// Functions below complement the original treeXxx API above with the standard
// functional-style signatures used across the codebase.

/** Factory: create a tree node (no parent backlink). */
export function createNode<T>(value: T, children: TreeNode<T>[] = []): TreeNode<T> {
  return { value, children };
}

/** Return true when the node has no children. */
export function isLeaf<T>(node: TreeNode<T>): boolean {
  return node.children.length === 0;
}

/**
 * Total number of nodes in the tree.
 * (Alias for `treeSize` with the generic function name `size`.)
 */
export function size<T>(root: TreeNode<T>): number {
  return treeSize(root);
}

/**
 * Maximum depth of the tree.
 * A single-node tree has depth 1 (unlike `treeDepth` which returns 0).
 */
export function depth<T>(root: TreeNode<T>): number {
  return treeDepth(root) + 1;
}

/**
 * Find the first node whose value strictly equals `value` using BFS.
 * Returns null if not found.
 */
export function find<T>(root: TreeNode<T>, value: T): TreeNode<T> | null {
  const queue: TreeNode<T>[] = [root];
  while (queue.length > 0) {
    const node = queue.shift()!;
    if (node.value === value) return node;
    for (const child of node.children) {
      queue.push(child);
    }
  }
  return null;
}

/**
 * Return the path of values from the root to the node with the given value,
 * inclusive of both endpoints. Returns [] if the value is not found.
 */
export function pathTo<T>(root: TreeNode<T>, value: T): T[] {
  function dfs(node: TreeNode<T>, path: T[]): T[] | null {
    const next = [...path, node.value];
    if (node.value === value) return next;
    for (const child of node.children) {
      const result = dfs(child, next);
      if (result !== null) return result;
    }
    return null;
  }
  return dfs(root, []) ?? [];
}

/**
 * Traverse the tree and return values in the requested order.
 *
 * - preorder  : root → children left-to-right
 * - inorder   : first-child subtree → root → remaining children
 * - postorder : children left-to-right → root
 * - bfs       : level-order (breadth-first)
 */
export function traverse<T>(root: TreeNode<T>, order: TraversalOrder): T[] {
  const result: T[] = [];

  function preorder(node: TreeNode<T>): void {
    result.push(node.value);
    for (const child of node.children) preorder(child);
  }

  function inorder(node: TreeNode<T>): void {
    if (node.children.length === 0) {
      result.push(node.value);
      return;
    }
    inorder(node.children[0]);
    result.push(node.value);
    for (let i = 1; i < node.children.length; i++) {
      inorder(node.children[i]);
    }
  }

  function postorder(node: TreeNode<T>): void {
    for (const child of node.children) postorder(child);
    result.push(node.value);
  }

  function bfs(node: TreeNode<T>): void {
    const queue: TreeNode<T>[] = [node];
    while (queue.length > 0) {
      const current = queue.shift()!;
      result.push(current.value);
      for (const child of current.children) queue.push(child);
    }
  }

  switch (order) {
    case 'preorder':
      preorder(root);
      break;
    case 'inorder':
      inorder(root);
      break;
    case 'postorder':
      postorder(root);
      break;
    case 'bfs':
      bfs(root);
      break;
  }

  return result;
}

/** Return all values in BFS order (same as traverse with 'bfs'). */
export function flatten<T>(root: TreeNode<T>): T[] {
  return traverse(root, 'bfs');
}

/**
 * Insert a new node with the given value as a child of the first node whose
 * value equals `parentValue`. Returns a new tree; the original is unchanged.
 * Throws if the parent node is not found.
 */
export function insert<T>(root: TreeNode<T>, parentValue: T, value: T): TreeNode<T> {
  let inserted = false;

  function cloneAndInsert(node: TreeNode<T>): TreeNode<T> {
    const newChildren = node.children.map(cloneAndInsert);
    if (node.value === parentValue && !inserted) {
      inserted = true;
      return { value: node.value, children: [...newChildren, createNode(value)] };
    }
    return { value: node.value, children: newChildren };
  }

  const result = cloneAndInsert(root);
  if (!inserted) {
    throw new Error(`Parent node with value ${String(parentValue)} not found`);
  }
  return result;
}

/**
 * Remove the first node whose value equals `value` (and its entire subtree).
 * Returns the new tree root, or null if the root itself was removed.
 */
export function remove<T>(root: TreeNode<T>, value: T): TreeNode<T> | null {
  if (root.value === value) return null;

  function cloneWithout(node: TreeNode<T>): TreeNode<T> {
    const newChildren = node.children
      .filter((child) => child.value !== value)
      .map(cloneWithout);
    return { value: node.value, children: newChildren };
  }

  return cloneWithout(root);
}

/**
 * Transform every value in the tree using `fn`, preserving structure.
 * (Functional alias for `treeMap`.)
 */
export function map<T, U>(root: TreeNode<T>, fn: (value: T) => U): TreeNode<U> {
  return treeMap(root, fn);
}

/**
 * Keep only nodes whose value satisfies `predicate`.
 * A non-matching node removes its entire subtree.
 * Returns null if the root itself does not satisfy the predicate.
 */
export function filter<T>(
  root: TreeNode<T>,
  predicate: (value: T) => boolean,
): TreeNode<T> | null {
  if (!predicate(root.value)) return null;
  const filteredChildren: TreeNode<T>[] = [];
  for (const child of root.children) {
    const result = filter(child, predicate);
    if (result !== null) filteredChildren.push(result);
  }
  return { value: root.value, children: filteredChildren };
}
