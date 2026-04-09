// @ts-check
// ─── R-Tree for Spatial Indexing ──────────────────────────────────────────────
// A simple R-Tree implementation for indexing axis-aligned rectangles.
// Supports insert, search (range query), and remove operations.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Rectangle {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  data?: unknown;
}

interface RTreeNode {
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  children: RTreeNode[];
  leaf: boolean;
  items: Rectangle[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createLeaf(): RTreeNode {
  return {
    bounds: { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
    children: [],
    leaf: true,
    items: [],
  };
}

function createInternal(): RTreeNode {
  return {
    bounds: { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
    children: [],
    leaf: false,
    items: [],
  };
}

function area(b: { minX: number; minY: number; maxX: number; maxY: number }): number {
  return (b.maxX - b.minX) * (b.maxY - b.minY);
}

function enlargedArea(
  b: { minX: number; minY: number; maxX: number; maxY: number },
  rect: { minX: number; minY: number; maxX: number; maxY: number },
): number {
  const w = Math.max(b.maxX, rect.maxX) - Math.min(b.minX, rect.minX);
  const h = Math.max(b.maxY, rect.maxY) - Math.min(b.minY, rect.minY);
  return w * h;
}

function extend(
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  rect: { minX: number; minY: number; maxX: number; maxY: number },
): void {
  bounds.minX = Math.min(bounds.minX, rect.minX);
  bounds.minY = Math.min(bounds.minY, rect.minY);
  bounds.maxX = Math.max(bounds.maxX, rect.maxX);
  bounds.maxY = Math.max(bounds.maxY, rect.maxY);
}

function intersects(
  a: { minX: number; minY: number; maxX: number; maxY: number },
  b: { minX: number; minY: number; maxX: number; maxY: number },
): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
}

function recalcBounds(node: RTreeNode): void {
  node.bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  if (node.leaf) {
    for (const item of node.items) {
      extend(node.bounds, item);
    }
  } else {
    for (const child of node.children) {
      extend(node.bounds, child.bounds);
    }
  }
}

function rectEquals(a: Rectangle, b: Rectangle): boolean {
  return a.minX === b.minX && a.minY === b.minY && a.maxX === b.maxX && a.maxY === b.maxY && a.data === b.data;
}

// ─── RTree ────────────────────────────────────────────────────────────────────

export class RTree {
  readonly #maxEntries: number;
  readonly #minEntries: number;
  #root: RTreeNode;
  #size: number;

  constructor(maxEntries: number = 9) {
    if (maxEntries < 2) throw new RangeError('maxEntries must be at least 2');
    this.#maxEntries = maxEntries;
    this.#minEntries = Math.max(2, Math.ceil(maxEntries * 0.4));
    this.#root = createLeaf();
    this.#size = 0;
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  get size(): number {
    return this.#size;
  }

  /** Insert a rectangle into the tree. */
  insert(rect: Rectangle): void {
    const leaf = this.#chooseLeaf(this.#root, rect);
    leaf.items.push(rect);
    extend(leaf.bounds, rect);
    this.#size++;

    // Check overflow and split up the tree
    this.#handleOverflow(leaf);
  }

  /** Search for all rectangles that intersect the given bounds. */
  search(bounds: { minX: number; minY: number; maxX: number; maxY: number }): Rectangle[] {
    const result: Rectangle[] = [];
    this.#search(this.#root, bounds, result);
    return result;
  }

  /** Remove a rectangle from the tree. Returns true if found and removed. */
  remove(rect: Rectangle): boolean {
    const removed = this.#remove(this.#root, rect);
    if (removed) {
      this.#size--;
      // Condense tree if root has single child
      if (!this.#root.leaf && this.#root.children.length === 1) {
        this.#root = this.#root.children[0];
      }
      if (!this.#root.leaf && this.#root.children.length === 0) {
        this.#root = createLeaf();
      }
    }
    return removed;
  }

  /** Remove all entries. */
  clear(): void {
    this.#root = createLeaf();
    this.#size = 0;
  }

  /** Return all rectangles in the tree. */
  toArray(): Rectangle[] {
    const result: Rectangle[] = [];
    this.#collect(this.#root, result);
    return result;
  }

  // ── Private Helpers ─────────────────────────────────────────────────────────

  /** Choose the best leaf node for inserting rect. */
  #chooseLeaf(node: RTreeNode, rect: Rectangle): RTreeNode {
    if (node.leaf) return node;

    let bestChild = node.children[0];
    let bestEnlargement = Infinity;
    let bestArea = Infinity;

    for (const child of node.children) {
      const enlargement = enlargedArea(child.bounds, rect) - area(child.bounds);
      const childArea = area(child.bounds);
      if (enlargement < bestEnlargement || (enlargement === bestEnlargement && childArea < bestArea)) {
        bestEnlargement = enlargement;
        bestArea = childArea;
        bestChild = child;
      }
    }

    return this.#chooseLeaf(bestChild, rect);
  }

  /** Handle overflow after insertion by splitting nodes up the path. */
  #handleOverflow(node: RTreeNode): void {
    if (node.leaf && node.items.length <= this.#maxEntries) return;
    if (!node.leaf && node.children.length <= this.#maxEntries) return;

    // Need to split. Find the parent path.
    const path = this.#findPath(this.#root, node, []);
    if (!path) {
      // node is root
      this.#splitRoot();
      return;
    }

    const parent = path[path.length - 1];
    const newNode = this.#splitNode(node);

    // Update parent
    parent.children.push(newNode);
    recalcBounds(parent);

    // Check if parent overflows
    this.#handleOverflow(parent);
  }

  /** Find path from root to target (excluding target itself). */
  #findPath(current: RTreeNode, target: RTreeNode, path: RTreeNode[]): RTreeNode[] | null {
    if (current === target) return path.length > 0 ? path : null;
    if (current.leaf) return null;

    for (const child of current.children) {
      path.push(current);
      const found = this.#findPath(child, target, path);
      if (found) return found;
      path.pop();
    }
    return null;
  }

  /** Split the root node. */
  #splitRoot(): void {
    const newNode = this.#splitNode(this.#root);
    const oldRoot = this.#root;
    const newRoot = createInternal();
    newRoot.children.push(oldRoot, newNode);
    recalcBounds(newRoot);
    this.#root = newRoot;
  }

  /** Split an overflowing node. Returns the new sibling. */
  #splitNode(node: RTreeNode): RTreeNode {
    if (node.leaf) {
      return this.#splitLeaf(node);
    }
    return this.#splitInternal(node);
  }

  /** Split an overflowing leaf. Returns the new leaf. */
  #splitLeaf(node: RTreeNode): RTreeNode {
    const newLeaf = createLeaf();
    const items = node.items;

    // Sort by minX to get a reasonable split
    items.sort((a, b) => a.minX - b.minX);

    const splitAt = Math.ceil(items.length / 2);
    newLeaf.items = items.splice(splitAt);

    recalcBounds(node);
    recalcBounds(newLeaf);
    return newLeaf;
  }

  /** Split an overflowing internal node. Returns the new node. */
  #splitInternal(node: RTreeNode): RTreeNode {
    const newNode = createInternal();
    const children = node.children;

    // Sort children by their bounds minX
    children.sort((a, b) => a.bounds.minX - b.bounds.minX);

    const splitAt = Math.ceil(children.length / 2);
    newNode.children = children.splice(splitAt);

    recalcBounds(node);
    recalcBounds(newNode);
    return newNode;
  }

  /** Recursive search for intersecting rectangles. */
  #search(node: RTreeNode, bounds: { minX: number; minY: number; maxX: number; maxY: number }, result: Rectangle[]): void {
    if (!intersects(node.bounds, bounds)) return;

    if (node.leaf) {
      for (const item of node.items) {
        if (intersects(item, bounds)) {
          result.push(item);
        }
      }
      return;
    }

    for (const child of node.children) {
      this.#search(child, bounds, result);
    }
  }

  /** Recursive remove. Returns true if rect was found and removed. */
  #remove(node: RTreeNode, rect: Rectangle): boolean {
    if (!intersects(node.bounds, rect)) return false;

    if (node.leaf) {
      const idx = node.items.findIndex(item => rectEquals(item, rect));
      if (idx === -1) return false;
      node.items.splice(idx, 1);
      recalcBounds(node);
      return true;
    }

    for (const child of node.children) {
      if (this.#remove(child, rect)) {
        // Remove empty children
        if (child.leaf && child.items.length === 0) {
          node.children.splice(node.children.indexOf(child), 1);
        } else if (!child.leaf && child.children.length === 0) {
          node.children.splice(node.children.indexOf(child), 1);
        }
        recalcBounds(node);
        return true;
      }
    }
    return false;
  }

  /** Collect all rectangles from the subtree. */
  #collect(node: RTreeNode, result: Rectangle[]): void {
    if (node.leaf) {
      result.push(...node.items);
      return;
    }
    for (const child of node.children) {
      this.#collect(child, result);
    }
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createRTree(maxEntries?: number): RTree {
  return new RTree(maxEntries);
}
