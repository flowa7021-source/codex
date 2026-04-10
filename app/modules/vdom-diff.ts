// @ts-check
// ─── Virtual DOM Diffing ──────────────────────────────────────────────────────
// Structural diff between two VNode trees, represented as a list of patches.
// Patches can then be applied immutably via `patch()`.

import type { VNode, VNodeChild } from './vdom.js';
import { normalizeChildren } from './vdom.js';

// ─── Types ────────────────────────────────────────────────────────────────────

/** The set of operations that may appear in a patch. */
export const PatchType = {
  CREATE: 'CREATE',
  DELETE: 'DELETE',
  REPLACE: 'REPLACE',
  UPDATE_PROPS: 'UPDATE_PROPS',
  UPDATE_CHILDREN: 'UPDATE_CHILDREN',
  TEXT: 'TEXT',
} as const;

export type PatchType = (typeof PatchType)[keyof typeof PatchType];

/** A single patch operation. */
export interface Patch {
  /** The kind of operation. */
  type: PatchType;
  /** Path from the root to the affected node, expressed as child indices. */
  path: number[];
  /** Operation-specific payload. */
  payload?: unknown;
}

// ─── diff() ──────────────────────────────────────────────────────────────────

/**
 * Compute the diff between `oldTree` and `newTree`.
 * Returns a (possibly empty) list of patches.
 *
 * Supported patch types:
 *   CREATE           – node was absent and should be created
 *   DELETE           – node was present and should be removed
 *   REPLACE          – node type changed; payload is the new tree
 *   UPDATE_PROPS     – props changed; payload is `{ added, removed, updated }`
 *   UPDATE_CHILDREN  – children changed (see payload)
 *   TEXT             – text content changed; payload is the new string
 */
export function diff(
  oldTree: VNode | string | null,
  newTree: VNode | string | null,
): Patch[] {
  const patches: Patch[] = [];
  diffNode(oldTree, newTree, [], patches);
  return patches;
}

// ─── Internal recursive diff ──────────────────────────────────────────────────

function diffNode(
  oldNode: VNode | string | null,
  newNode: VNode | string | null,
  path: number[],
  patches: Patch[],
): void {
  // Both absent – nothing to do.
  if (oldNode == null && newNode == null) return;

  // Creation
  if (oldNode == null) {
    patches.push({ type: PatchType.CREATE, path: [...path], payload: newNode });
    return;
  }

  // Deletion
  if (newNode == null) {
    patches.push({ type: PatchType.DELETE, path: [...path] });
    return;
  }

  // Both are text nodes
  if (typeof oldNode === 'string' && typeof newNode === 'string') {
    if (oldNode !== newNode) {
      patches.push({ type: PatchType.TEXT, path: [...path], payload: newNode });
    }
    return;
  }

  // Type mismatch (string ↔ element, or different element types)
  if (
    typeof oldNode !== typeof newNode ||
    (typeof oldNode !== 'string' &&
      typeof newNode !== 'string' &&
      oldNode.type !== newNode.type)
  ) {
    patches.push({ type: PatchType.REPLACE, path: [...path], payload: newNode });
    return;
  }

  // Both are VNodes with the same type – diff props and children
  const oldVNode = oldNode as VNode;
  const newVNode = newNode as VNode;

  diffProps(oldVNode, newVNode, path, patches);
  diffChildren(oldVNode, newVNode, path, patches);
}

// ─── Props diffing ────────────────────────────────────────────────────────────

function diffProps(
  oldVNode: VNode,
  newVNode: VNode,
  path: number[],
  patches: Patch[],
): void {
  const added: Record<string, unknown> = {};
  const removed: string[] = [];
  const updated: Record<string, unknown> = {};

  // Check for added / updated props
  for (const [key, newVal] of Object.entries(newVNode.props)) {
    if (!(key in oldVNode.props)) {
      added[key] = newVal;
    } else if (oldVNode.props[key] !== newVal) {
      updated[key] = newVal;
    }
  }

  // Check for removed props
  for (const key of Object.keys(oldVNode.props)) {
    if (!(key in newVNode.props)) {
      removed.push(key);
    }
  }

  if (
    Object.keys(added).length > 0 ||
    removed.length > 0 ||
    Object.keys(updated).length > 0
  ) {
    patches.push({
      type: PatchType.UPDATE_PROPS,
      path: [...path],
      payload: { added, removed, updated },
    });
  }
}

// ─── Children diffing ─────────────────────────────────────────────────────────

function diffChildren(
  oldVNode: VNode,
  newVNode: VNode,
  path: number[],
  patches: Patch[],
): void {
  const oldChildren = normalizeChildren(oldVNode.children);
  const newChildren = normalizeChildren(newVNode.children);
  const maxLen = Math.max(oldChildren.length, newChildren.length);

  if (maxLen === 0) return;

  const childPatches: Patch[] = [];

  for (let i = 0; i < maxLen; i++) {
    const oldChild: VNode | string | null = oldChildren[i] ?? null;
    const newChild: VNode | string | null = newChildren[i] ?? null;
    diffNode(oldChild, newChild, [...path, i], childPatches);
  }

  if (childPatches.length > 0) {
    // Emit an UPDATE_CHILDREN patch carrying the child-level patches as payload,
    // then push the individual child patches so callers can apply them.
    patches.push({
      type: PatchType.UPDATE_CHILDREN,
      path: [...path],
      payload: childPatches,
    });
    for (const p of childPatches) {
      patches.push(p);
    }
  }
}

// ─── patch() ─────────────────────────────────────────────────────────────────

/**
 * Apply `patches` to `tree` and return the updated tree (immutable).
 * If `patches` is empty the original tree is returned unchanged.
 */
export function patch(
  tree: VNode | string | null,
  patches: Patch[],
): VNode | string | null {
  // Apply each patch in order.  Because we work immutably we keep a reference
  // to the current root and replace it when a root-level operation fires.
  let root = tree;

  for (const p of patches) {
    // Skip embedded child patches – they are applied when we recurse into
    // UPDATE_CHILDREN at the parent level.
    // (We do NOT skip them here; they carry full absolute paths so applying
    //  them at the top level is correct.)
    root = applyPatch(root, p);
  }

  return root;
}

// ─── Internal patch application ───────────────────────────────────────────────

function applyPatch(
  tree: VNode | string | null,
  p: Patch,
): VNode | string | null {
  const { type, path, payload } = p;

  // Root-level operations
  if (path.length === 0) {
    switch (type) {
      case PatchType.CREATE:
        return payload as VNode | string;
      case PatchType.DELETE:
        return null;
      case PatchType.REPLACE:
        return payload as VNode | string;
      case PatchType.TEXT:
        return payload as string;
      case PatchType.UPDATE_PROPS: {
        if (tree == null || typeof tree === 'string') return tree;
        const { added, removed, updated } = payload as {
          added: Record<string, unknown>;
          removed: string[];
          updated: Record<string, unknown>;
        };
        const newProps = { ...tree.props, ...added, ...updated };
        for (const k of removed) delete newProps[k];
        return { ...tree, props: newProps };
      }
      case PatchType.UPDATE_CHILDREN:
        // The actual child patches are emitted separately with absolute paths;
        // nothing to do at this level.
        return tree;
      default:
        return tree;
    }
  }

  // Deep path – recurse into the VNode tree
  if (tree == null || typeof tree === 'string') return tree;

  const [head, ...rest] = path;
  const oldChildren = normalizeChildren(tree.children);

  // Clone children array
  const newChildren: (VNode | string | null)[] = [...oldChildren];

  // Ensure the slot exists (CREATE can extend the array)
  while (newChildren.length <= head) newChildren.push(null);

  const childPatch: Patch = { type, path: rest, payload };
  newChildren[head] = applyPatch(newChildren[head], childPatch);

  // Convert null children back to the VNodeChild type and remove trailing nulls
  const filteredChildren = newChildren.filter((c) => c !== null) as (
    | VNode
    | string
  )[];

  return { ...tree, children: filteredChildren };
}
