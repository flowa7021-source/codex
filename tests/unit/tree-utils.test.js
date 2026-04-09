// ─── Unit Tests: tree-utils ───────────────────────────────────────────────────
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  treeNode,
  treeWalk,
  treeFind,
  treeFilter,
  treeMap,
  treeLeaves,
  treeDepth,
  treeSize,
  arrayToTree,
  treeToArray,
} from '../../app/modules/tree-utils.js';

// Build test tree:
//        1
//       / \
//      2   3
//     / \
//    4   5

/** @returns {import('../../app/modules/tree-utils.js').TreeNode<number>} */
function buildTree() {
  return treeNode(1, [
    treeNode(2, [
      treeNode(4),
      treeNode(5),
    ]),
    treeNode(3),
  ]);
}

// ─── treeNode ─────────────────────────────────────────────────────────────────

describe('treeNode', () => {
  it('creates a node with a value and no children by default', () => {
    const node = treeNode(42);
    assert.equal(node.value, 42);
    assert.deepEqual(node.children, []);
  });

  it('creates a node with provided children', () => {
    const child1 = treeNode('a');
    const child2 = treeNode('b');
    const parent = treeNode('root', [child1, child2]);
    assert.equal(parent.value, 'root');
    assert.equal(parent.children.length, 2);
    assert.equal(parent.children[0].value, 'a');
    assert.equal(parent.children[1].value, 'b');
  });

  it('sets parent reference on children', () => {
    const child = treeNode(2);
    const parent = treeNode(1, [child]);
    assert.equal(child.parent, parent);
  });

  it('does not set parent on root (no parent call)', () => {
    const root = treeNode(1);
    assert.equal(root.parent, undefined);
  });
});

// ─── treeWalk ─────────────────────────────────────────────────────────────────

describe('treeWalk', () => {
  it('visits all nodes in depth-first order', () => {
    const root = buildTree();
    const visited = [];
    treeWalk(root, (node) => visited.push(node.value));
    assert.deepEqual(visited, [1, 2, 4, 5, 3]);
  });

  it('passes correct depth to callback', () => {
    const root = buildTree();
    const depths = [];
    treeWalk(root, (node, depth) => depths.push({ value: node.value, depth }));
    assert.deepEqual(depths, [
      { value: 1, depth: 0 },
      { value: 2, depth: 1 },
      { value: 4, depth: 2 },
      { value: 5, depth: 2 },
      { value: 3, depth: 1 },
    ]);
  });

  it('visits single node tree', () => {
    const root = treeNode(99);
    const visited = [];
    treeWalk(root, (node) => visited.push(node.value));
    assert.deepEqual(visited, [99]);
  });
});

// ─── treeFind ─────────────────────────────────────────────────────────────────

describe('treeFind', () => {
  it('finds the root node when predicate matches root', () => {
    const root = buildTree();
    const found = treeFind(root, (v) => v === 1);
    assert.equal(found?.value, 1);
  });

  it('finds a leaf node', () => {
    const root = buildTree();
    const found = treeFind(root, (v) => v === 5);
    assert.equal(found?.value, 5);
  });

  it('finds an intermediate node', () => {
    const root = buildTree();
    const found = treeFind(root, (v) => v === 2);
    assert.equal(found?.value, 2);
  });

  it('returns null when predicate does not match any node', () => {
    const root = buildTree();
    const found = treeFind(root, (v) => v === 99);
    assert.equal(found, null);
  });

  it('returns the first matching node in DFS order', () => {
    const root = treeNode(1, [treeNode(1), treeNode(2)]);
    const found = treeFind(root, (v) => v === 1);
    assert.equal(found?.value, 1);
    assert.equal(found?.children.length, 2); // should be root, not child
  });
});

// ─── treeFilter ───────────────────────────────────────────────────────────────

describe('treeFilter', () => {
  it('returns null when no node matches and no ancestors needed', () => {
    const root = buildTree();
    const result = treeFilter(root, (v) => v === 99);
    assert.equal(result, null);
  });

  it('keeps matching leaf node and all its ancestors', () => {
    const root = buildTree();
    const result = treeFilter(root, (v) => v === 4);
    assert.notEqual(result, null);
    assert.equal(result?.value, 1);
    assert.equal(result?.children.length, 1);
    assert.equal(result?.children[0].value, 2);
    assert.equal(result?.children[0].children.length, 1);
    assert.equal(result?.children[0].children[0].value, 4);
  });

  it('keeps all children when root matches', () => {
    const root = buildTree();
    // if root itself matches, it stays; children that don't match are pruned unless they match
    const result = treeFilter(root, (v) => v === 1 || v === 3);
    assert.notEqual(result, null);
    assert.equal(result?.value, 1);
    // Node 3 matches so it's kept; node 2 does not match and has no matching descendants
    const childValues = result?.children.map((c) => c.value);
    assert.ok(childValues?.includes(3));
  });

  it('returns a new tree (not the same reference)', () => {
    const root = buildTree();
    const result = treeFilter(root, (v) => v > 0);
    assert.notEqual(result, root);
  });
});

// ─── treeMap ──────────────────────────────────────────────────────────────────

describe('treeMap', () => {
  it('transforms all values in the tree', () => {
    const root = buildTree();
    const mapped = treeMap(root, (v) => v * 10);
    const values = [];
    treeWalk(mapped, (node) => values.push(node.value));
    assert.deepEqual(values, [10, 20, 40, 50, 30]);
  });

  it('returns a new tree with the same structure', () => {
    const root = buildTree();
    const mapped = treeMap(root, (v) => String(v));
    assert.equal(mapped.value, '1');
    assert.equal(mapped.children.length, 2);
    assert.equal(mapped.children[0].value, '2');
    assert.equal(mapped.children[0].children.length, 2);
    assert.equal(mapped.children[1].value, '3');
    assert.equal(mapped.children[1].children.length, 0);
  });

  it('does not mutate the original tree', () => {
    const root = buildTree();
    treeMap(root, (v) => v * 2);
    assert.equal(root.value, 1);
  });

  it('works on a single-node tree', () => {
    const node = treeNode(7);
    const mapped = treeMap(node, (v) => v + 1);
    assert.equal(mapped.value, 8);
    assert.deepEqual(mapped.children, []);
  });
});

// ─── treeLeaves ───────────────────────────────────────────────────────────────

describe('treeLeaves', () => {
  it('returns all leaf nodes [4, 5, 3] for test tree', () => {
    const root = buildTree();
    const leaves = treeLeaves(root);
    assert.deepEqual(
      leaves.map((n) => n.value),
      [4, 5, 3],
    );
  });

  it('returns the root itself when it is a leaf', () => {
    const root = treeNode(1);
    const leaves = treeLeaves(root);
    assert.equal(leaves.length, 1);
    assert.equal(leaves[0].value, 1);
  });

  it('returns all leaves for a wider tree', () => {
    const root = treeNode('root', [
      treeNode('a'),
      treeNode('b'),
      treeNode('c'),
    ]);
    const leaves = treeLeaves(root);
    assert.deepEqual(
      leaves.map((n) => n.value),
      ['a', 'b', 'c'],
    );
  });
});

// ─── treeDepth ────────────────────────────────────────────────────────────────

describe('treeDepth', () => {
  it('returns 2 for the test tree', () => {
    assert.equal(treeDepth(buildTree()), 2);
  });

  it('returns 0 for a single leaf node', () => {
    assert.equal(treeDepth(treeNode(1)), 0);
  });

  it('returns 1 for a root with leaf children only', () => {
    const root = treeNode(1, [treeNode(2), treeNode(3)]);
    assert.equal(treeDepth(root), 1);
  });

  it('returns depth of the deepest branch', () => {
    const root = treeNode(1, [
      treeNode(2, [treeNode(3, [treeNode(4)])]),
      treeNode(5),
    ]);
    assert.equal(treeDepth(root), 3);
  });
});

// ─── treeSize ─────────────────────────────────────────────────────────────────

describe('treeSize', () => {
  it('returns 5 for the test tree', () => {
    assert.equal(treeSize(buildTree()), 5);
  });

  it('returns 1 for a single node', () => {
    assert.equal(treeSize(treeNode(1)), 1);
  });

  it('returns correct count for a flat tree', () => {
    const root = treeNode(1, [treeNode(2), treeNode(3), treeNode(4)]);
    assert.equal(treeSize(root), 4);
  });
});

// ─── arrayToTree ──────────────────────────────────────────────────────────────

describe('arrayToTree', () => {
  it('converts a flat array into a tree structure', () => {
    const items = [
      { id: '1', name: 'root' },
      { id: '2', parentId: '1', name: 'child1' },
      { id: '3', parentId: '1', name: 'child2' },
      { id: '4', parentId: '2', name: 'grandchild' },
    ];
    const roots = arrayToTree(items);
    assert.equal(roots.length, 1);
    const root = roots[0];
    assert.equal(root.value.name, 'root');
    assert.equal(root.children.length, 2);
    assert.equal(root.children[0].value.name, 'child1');
    assert.equal(root.children[0].children.length, 1);
    assert.equal(root.children[0].children[0].value.name, 'grandchild');
    assert.equal(root.children[1].value.name, 'child2');
  });

  it('returns multiple roots when there are multiple items without parentId', () => {
    const items = [
      { id: '1', name: 'root1' },
      { id: '2', name: 'root2' },
    ];
    const roots = arrayToTree(items);
    assert.equal(roots.length, 2);
  });

  it('handles an empty array', () => {
    const roots = arrayToTree([]);
    assert.deepEqual(roots, []);
  });

  it('sets parent references on child nodes', () => {
    const items = [
      { id: '1', name: 'parent' },
      { id: '2', parentId: '1', name: 'child' },
    ];
    const roots = arrayToTree(items);
    const child = roots[0].children[0];
    assert.equal(child.parent?.value.name, 'parent');
  });
});

// ─── treeToArray ──────────────────────────────────────────────────────────────

describe('treeToArray', () => {
  it('returns values in DFS order for test tree', () => {
    const root = buildTree();
    assert.deepEqual(treeToArray(root), [1, 2, 4, 5, 3]);
  });

  it('returns single element for a leaf node', () => {
    assert.deepEqual(treeToArray(treeNode(42)), [42]);
  });

  it('returns all values of a flat tree in insertion order', () => {
    const root = treeNode('a', [treeNode('b'), treeNode('c'), treeNode('d')]);
    assert.deepEqual(treeToArray(root), ['a', 'b', 'c', 'd']);
  });

  it('round-trips with arrayToTree (values preserved)', () => {
    const items = [
      { id: '1', name: 'root' },
      { id: '2', parentId: '1', name: 'child1' },
      { id: '3', parentId: '1', name: 'child2' },
    ];
    const roots = arrayToTree(items);
    const flat = treeToArray(roots[0]);
    assert.deepEqual(
      flat.map((v) => v.name),
      ['root', 'child1', 'child2'],
    );
  });
});
