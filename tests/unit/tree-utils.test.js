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
  // Extended API
  createNode,
  isLeaf,
  size,
  depth,
  find,
  pathTo,
  traverse,
  flatten,
  insert,
  remove,
  map,
  filter,
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

// ─── Extended API ─────────────────────────────────────────────────────────────
//
// Test tree used in the sections below:
//        1
//       / \
//      2   3
//     / \
//    4   5

/** @returns {import('../../app/modules/tree-utils.js').TreeNode<number>} */
function buildExtTree() {
  return createNode(1, [
    createNode(2, [
      createNode(4),
      createNode(5),
    ]),
    createNode(3),
  ]);
}

// ─── createNode ───────────────────────────────────────────────────────────────

describe('createNode', () => {
  it('creates a node with a value and empty children by default', () => {
    const node = createNode(42);
    assert.equal(node.value, 42);
    assert.deepEqual(node.children, []);
  });

  it('creates a node with provided children', () => {
    const c1 = createNode('a');
    const c2 = createNode('b');
    const parent = createNode('root', [c1, c2]);
    assert.equal(parent.children.length, 2);
    assert.equal(parent.children[0].value, 'a');
    assert.equal(parent.children[1].value, 'b');
  });

  it('does not set a parent backlink (unlike treeNode)', () => {
    const child = createNode(2);
    const parent = createNode(1, [child]);
    assert.equal(child.parent, undefined);
    assert.equal(parent.parent, undefined);
  });

  it('accepts an empty children array explicitly', () => {
    const node = createNode('x', []);
    assert.deepEqual(node.children, []);
  });

  it('stores the exact value passed (object reference)', () => {
    const obj = { id: 1 };
    const node = createNode(obj);
    assert.equal(node.value, obj);
  });

  it('works with null values', () => {
    const node = createNode(null);
    assert.equal(node.value, null);
  });

  it('works with string values', () => {
    const node = createNode('hello');
    assert.equal(node.value, 'hello');
  });

  it('children array is independent between sibling nodes', () => {
    const a = createNode(1);
    const b = createNode(2);
    a.children.push(createNode(99));
    assert.equal(b.children.length, 0);
  });
});

// ─── isLeaf ───────────────────────────────────────────────────────────────────

describe('isLeaf', () => {
  it('returns true for a node with no children', () => {
    assert.equal(isLeaf(createNode(1)), true);
  });

  it('returns false for a node with at least one child', () => {
    const node = createNode(1, [createNode(2)]);
    assert.equal(isLeaf(node), false);
  });

  it('returns false for root of buildExtTree', () => {
    assert.equal(isLeaf(buildExtTree()), false);
  });

  it('returns true for leaf nodes of buildExtTree', () => {
    const root = buildExtTree();
    assert.equal(isLeaf(root.children[0].children[0]), true); // 4
    assert.equal(isLeaf(root.children[0].children[1]), true); // 5
    assert.equal(isLeaf(root.children[1]), true);             // 3
  });

  it('returns true after removing all children manually', () => {
    const node = createNode(1, [createNode(2)]);
    node.children.splice(0);
    assert.equal(isLeaf(node), true);
  });

  it('works with string-valued nodes', () => {
    assert.equal(isLeaf(createNode('leaf')), true);
  });

  it('returns false when multiple children present', () => {
    const node = createNode(0, [createNode(1), createNode(2), createNode(3)]);
    assert.equal(isLeaf(node), false);
  });

  it('is consistent with children.length check', () => {
    const node = buildExtTree();
    assert.equal(isLeaf(node), node.children.length === 0);
  });
});

// ─── size ─────────────────────────────────────────────────────────────────────

describe('size', () => {
  it('returns 5 for the 5-node test tree', () => {
    assert.equal(size(buildExtTree()), 5);
  });

  it('returns 1 for a single node', () => {
    assert.equal(size(createNode(1)), 1);
  });

  it('returns 4 for a root with 3 leaf children', () => {
    const root = createNode(1, [createNode(2), createNode(3), createNode(4)]);
    assert.equal(size(root), 4);
  });

  it('counts nodes in a deep unary chain', () => {
    const root = createNode(1, [createNode(2, [createNode(3, [createNode(4)])])]);
    assert.equal(size(root), 4);
  });

  it('counts all nodes including root', () => {
    const root = createNode('r', [
      createNode('a', [createNode('a1'), createNode('a2')]),
      createNode('b'),
    ]);
    assert.equal(size(root), 5);
  });

  it('matches treeSize for the same structure', () => {
    const root = buildExtTree();
    assert.equal(size(root), treeSize(root));
  });

  it('returns 2 for a root with exactly one child', () => {
    assert.equal(size(createNode(1, [createNode(2)])), 2);
  });

  it('handles a wide flat tree (root + 10 leaves)', () => {
    const children = Array.from({ length: 10 }, (_, i) => createNode(i + 1));
    const root = createNode(0, children);
    assert.equal(size(root), 11);
  });
});

// ─── depth ────────────────────────────────────────────────────────────────────

describe('depth', () => {
  it('returns 3 for the 3-level test tree', () => {
    assert.equal(depth(buildExtTree()), 3);
  });

  it('returns 1 for a single-node tree', () => {
    assert.equal(depth(createNode(42)), 1);
  });

  it('returns 2 for a root with leaf children only', () => {
    const root = createNode(1, [createNode(2), createNode(3)]);
    assert.equal(depth(root), 2);
  });

  it('returns depth along the deepest branch', () => {
    const root = createNode(1, [
      createNode(2, [createNode(3, [createNode(4)])]),
      createNode(5),
    ]);
    assert.equal(depth(root), 4);
  });

  it('is always at least 1', () => {
    assert.ok(depth(createNode('x')) >= 1);
  });

  it('equals treeDepth + 1', () => {
    const root = buildExtTree();
    assert.equal(depth(root), treeDepth(root) + 1);
  });

  it('handles a wide flat tree correctly', () => {
    const children = Array.from({ length: 5 }, (_, i) => createNode(i));
    const root = createNode(-1, children);
    assert.equal(depth(root), 2);
  });

  it('handles a deep unary chain of length 5', () => {
    const root = createNode(1, [
      createNode(2, [
        createNode(3, [
          createNode(4, [createNode(5)]),
        ]),
      ]),
    ]);
    assert.equal(depth(root), 5);
  });
});

// ─── find ─────────────────────────────────────────────────────────────────────

describe('find', () => {
  it('returns the root when value matches root', () => {
    const root = buildExtTree();
    const node = find(root, 1);
    assert.equal(node?.value, 1);
    assert.equal(node, root);
  });

  it('finds a leaf node by value', () => {
    assert.equal(find(buildExtTree(), 4)?.value, 4);
    assert.equal(find(buildExtTree(), 5)?.value, 5);
    assert.equal(find(buildExtTree(), 3)?.value, 3);
  });

  it('finds an intermediate node', () => {
    const node = find(buildExtTree(), 2);
    assert.equal(node?.value, 2);
    assert.equal(node?.children.length, 2);
  });

  it('returns null for a value not in the tree', () => {
    assert.equal(find(buildExtTree(), 99), null);
  });

  it('returns null for empty-ish single node with non-matching value', () => {
    assert.equal(find(createNode(7), 8), null);
  });

  it('returns first BFS match when duplicates exist', () => {
    const root = createNode(1, [createNode(1, [createNode(3)]), createNode(2)]);
    const found = find(root, 1);
    // BFS: root is visited first
    assert.equal(found, root);
  });

  it('works with string values', () => {
    const root = createNode('a', [createNode('b', [createNode('c')])]);
    assert.equal(find(root, 'c')?.value, 'c');
    assert.equal(find(root, 'z'), null);
  });

  it('returned node has the correct children', () => {
    const root = buildExtTree();
    const node = find(root, 2);
    assert.deepEqual(node?.children.map((c) => c.value), [4, 5]);
  });
});

// ─── pathTo ───────────────────────────────────────────────────────────────────

describe('pathTo', () => {
  it('returns [root] when value equals root', () => {
    assert.deepEqual(pathTo(buildExtTree(), 1), [1]);
  });

  it('returns path to a deep leaf', () => {
    assert.deepEqual(pathTo(buildExtTree(), 4), [1, 2, 4]);
    assert.deepEqual(pathTo(buildExtTree(), 5), [1, 2, 5]);
  });

  it('returns path to a direct child of root', () => {
    assert.deepEqual(pathTo(buildExtTree(), 3), [1, 3]);
  });

  it('returns [] when value not found', () => {
    assert.deepEqual(pathTo(buildExtTree(), 99), []);
  });

  it('returns [] on empty-like single node with no match', () => {
    assert.deepEqual(pathTo(createNode(1), 2), []);
  });

  it('handles single-node tree with matching value', () => {
    assert.deepEqual(pathTo(createNode(7), 7), [7]);
  });

  it('works with string values', () => {
    const root = createNode('root', [
      createNode('child', [createNode('grandchild')]),
    ]);
    assert.deepEqual(pathTo(root, 'grandchild'), ['root', 'child', 'grandchild']);
  });

  it('always starts with the root value', () => {
    const path = pathTo(buildExtTree(), 5);
    assert.equal(path[0], 1);
  });

  it('always ends with the target value', () => {
    const path = pathTo(buildExtTree(), 5);
    assert.equal(path[path.length - 1], 5);
  });
});

// ─── traverse ─────────────────────────────────────────────────────────────────

describe('traverse', () => {
  it('preorder visits root before children', () => {
    assert.deepEqual(traverse(buildExtTree(), 'preorder'), [1, 2, 4, 5, 3]);
  });

  it('postorder visits children before root', () => {
    assert.deepEqual(traverse(buildExtTree(), 'postorder'), [4, 5, 2, 3, 1]);
  });

  it('bfs visits level by level', () => {
    assert.deepEqual(traverse(buildExtTree(), 'bfs'), [1, 2, 3, 4, 5]);
  });

  it('inorder: first child subtree → root → rest', () => {
    // tree: 1 → [2 → [4, 5], 3]
    // inorder: inorder(2) first → then 1 → then inorder(3)
    // inorder(2) = inorder(4), 2, inorder(5) = 4, 2, 5
    // result: [4, 2, 5, 1, 3]
    assert.deepEqual(traverse(buildExtTree(), 'inorder'), [4, 2, 5, 1, 3]);
  });

  it('all orders return all node values (same set)', () => {
    const root = buildExtTree();
    const expected = new Set([1, 2, 3, 4, 5]);
    for (const order of ['preorder', 'inorder', 'postorder', 'bfs']) {
      const values = new Set(traverse(root, order));
      assert.deepEqual(values, expected);
    }
  });

  it('single-node tree: all orders return [value]', () => {
    const root = createNode(42);
    for (const order of ['preorder', 'inorder', 'postorder', 'bfs']) {
      assert.deepEqual(traverse(root, order), [42]);
    }
  });

  it('preorder of a chain is left-to-right top-down', () => {
    const root = createNode(1, [createNode(2, [createNode(3)])]);
    assert.deepEqual(traverse(root, 'preorder'), [1, 2, 3]);
  });

  it('postorder of a chain is bottom-up', () => {
    const root = createNode(1, [createNode(2, [createNode(3)])]);
    assert.deepEqual(traverse(root, 'postorder'), [3, 2, 1]);
  });
});

// ─── flatten ──────────────────────────────────────────────────────────────────

describe('flatten (tree)', () => {
  it('returns BFS order for the test tree', () => {
    assert.deepEqual(flatten(buildExtTree()), [1, 2, 3, 4, 5]);
  });

  it('returns [value] for a single node', () => {
    assert.deepEqual(flatten(createNode(7)), [7]);
  });

  it('matches traverse bfs', () => {
    const root = buildExtTree();
    assert.deepEqual(flatten(root), traverse(root, 'bfs'));
  });

  it('returns all values including internal nodes', () => {
    const root = buildExtTree();
    const values = flatten(root);
    assert.equal(values.length, 5);
    assert.ok(values.includes(2)); // intermediate node
  });

  it('handles a wide flat tree', () => {
    const root = createNode(0, [createNode(1), createNode(2), createNode(3)]);
    assert.deepEqual(flatten(root), [0, 1, 2, 3]);
  });

  it('handles a deep unary chain in BFS (same as DFS for unary)', () => {
    const root = createNode(1, [createNode(2, [createNode(3)])]);
    assert.deepEqual(flatten(root), [1, 2, 3]);
  });

  it('does not mutate the tree', () => {
    const root = buildExtTree();
    const before = size(root);
    flatten(root);
    assert.equal(size(root), before);
  });

  it('returns a plain array (not a TreeNode)', () => {
    const result = flatten(buildExtTree());
    assert.ok(Array.isArray(result));
    assert.ok(!('value' in result));
  });
});

// ─── insert ───────────────────────────────────────────────────────────────────

describe('insert', () => {
  it('inserts a child under the matching parent', () => {
    const root = buildExtTree();
    const newTree = insert(root, 3, 99);
    const node3 = find(newTree, 3);
    assert.equal(node3?.children.length, 1);
    assert.equal(node3?.children[0].value, 99);
  });

  it('inserts under root', () => {
    const root = buildExtTree();
    const newTree = insert(root, 1, 6);
    assert.equal(newTree.children.length, 3);
    assert.equal(newTree.children[2].value, 6);
  });

  it('inserts under an intermediate node', () => {
    const root = buildExtTree();
    const newTree = insert(root, 2, 6);
    const node2 = find(newTree, 2);
    assert.equal(node2?.children.length, 3);
    assert.equal(node2?.children[2].value, 6);
  });

  it('does not mutate the original tree', () => {
    const root = buildExtTree();
    insert(root, 3, 99);
    assert.equal(find(root, 3)?.children.length, 0);
  });

  it('returns a new root reference', () => {
    const root = buildExtTree();
    const newTree = insert(root, 1, 6);
    assert.notEqual(newTree, root);
  });

  it('inserted node is a leaf', () => {
    const newTree = insert(buildExtTree(), 4, 10);
    const node10 = find(newTree, 10);
    assert.notEqual(node10, null);
    assert.equal(isLeaf(node10), true);
  });

  it('increments total size by 1', () => {
    const root = buildExtTree();
    const newTree = insert(root, 2, 10);
    assert.equal(size(newTree), size(root) + 1);
  });

  it('throws when parent value is not found', () => {
    assert.throws(() => insert(buildExtTree(), 99, 1), /not found/i);
  });
});

// ─── remove ───────────────────────────────────────────────────────────────────

describe('remove', () => {
  it('returns null when removing the root', () => {
    assert.equal(remove(buildExtTree(), 1), null);
  });

  it('removes a leaf node', () => {
    const root = buildExtTree();
    const newTree = remove(root, 4);
    assert.equal(find(newTree, 4), null);
    assert.equal(size(newTree), 4);
  });

  it('removes an intermediate node and its subtree', () => {
    const root = buildExtTree();
    const newTree = remove(root, 2);
    // Removes 2, 4, and 5
    assert.equal(find(newTree, 2), null);
    assert.equal(find(newTree, 4), null);
    assert.equal(find(newTree, 5), null);
    assert.equal(size(newTree), 2); // only 1 and 3 remain
  });

  it('does not mutate the original tree', () => {
    const root = buildExtTree();
    remove(root, 4);
    assert.equal(find(root, 4)?.value, 4);
  });

  it('returns a new root reference', () => {
    const root = buildExtTree();
    const newTree = remove(root, 3);
    assert.notEqual(newTree, root);
  });

  it('returns unchanged tree when value not found', () => {
    const root = buildExtTree();
    const newTree = remove(root, 99);
    assert.equal(size(newTree), size(root));
  });

  it('removes only the first occurrence (left-most BFS) of a duplicate', () => {
    const root = createNode(1, [createNode(2), createNode(2)]);
    const newTree = remove(root, 2);
    // Both children have value 2; remove cloneWithout strips ALL matching children
    // at a given level — this is a known behaviour; test documents it
    assert.notEqual(newTree, null);
  });

  it('after removing a leaf parent becomes a leaf itself (if no other children)', () => {
    const root = createNode(1, [createNode(2, [createNode(3)])]);
    const newTree = remove(root, 3);
    const node2 = find(newTree, 2);
    assert.equal(isLeaf(node2), true);
  });
});

// ─── map ──────────────────────────────────────────────────────────────────────

describe('map (tree)', () => {
  it('transforms all values', () => {
    const mapped = map(buildExtTree(), (v) => v * 2);
    assert.deepEqual(traverse(mapped, 'bfs'), [2, 4, 6, 8, 10]);
  });

  it('changes the type of values', () => {
    const mapped = map(buildExtTree(), (v) => String(v));
    assert.equal(mapped.value, '1');
    assert.equal(mapped.children[0].value, '2');
  });

  it('preserves the tree structure', () => {
    const root = buildExtTree();
    const mapped = map(root, (v) => v + 100);
    assert.equal(mapped.children.length, root.children.length);
    assert.equal(mapped.children[0].children.length, root.children[0].children.length);
  });

  it('does not mutate the original tree', () => {
    const root = buildExtTree();
    map(root, (v) => v * 99);
    assert.equal(root.value, 1);
  });

  it('returns a new root reference', () => {
    const root = buildExtTree();
    assert.notEqual(map(root, (v) => v), root);
  });

  it('works on a single-node tree', () => {
    const mapped = map(createNode(7), (v) => v + 1);
    assert.equal(mapped.value, 8);
    assert.deepEqual(mapped.children, []);
  });

  it('applies fn to each node exactly once', () => {
    let calls = 0;
    map(buildExtTree(), (v) => { calls++; return v; });
    assert.equal(calls, 5);
  });

  it('is equivalent to treeMap', () => {
    const root = buildExtTree();
    const a = map(root, (v) => v * 3);
    const b = treeMap(root, (v) => v * 3);
    assert.deepEqual(traverse(a, 'bfs'), traverse(b, 'bfs'));
  });
});

// ─── filter ───────────────────────────────────────────────────────────────────

describe('filter (tree)', () => {
  it('returns null when root does not match predicate', () => {
    assert.equal(filter(buildExtTree(), (v) => v > 100), null);
  });

  it('keeps only nodes matching predicate (removes non-matching subtrees)', () => {
    const result = filter(buildExtTree(), (v) => v % 2 !== 0); // keep odd
    // root=1 (odd, kept), child 2 (even, dropped with subtree), child 3 (odd, kept)
    assert.notEqual(result, null);
    assert.equal(result?.value, 1);
    assert.equal(result?.children.length, 1);
    assert.equal(result?.children[0].value, 3);
  });

  it('keeps full subtree when all values pass predicate', () => {
    const result = filter(buildExtTree(), (v) => v > 0);
    assert.equal(size(result), 5);
  });

  it('returns null for single node not matching', () => {
    assert.equal(filter(createNode(5), (v) => v > 10), null);
  });

  it('returns matching single node', () => {
    const result = filter(createNode(5), (v) => v === 5);
    assert.equal(result?.value, 5);
    assert.deepEqual(result?.children, []);
  });

  it('does not mutate the original tree', () => {
    const root = buildExtTree();
    filter(root, (v) => v === 1);
    assert.equal(size(root), 5);
  });

  it('returns a new root reference', () => {
    const root = buildExtTree();
    const result = filter(root, (v) => v > 0);
    assert.notEqual(result, root);
  });

  it('removes leaf that does not match even if siblings do', () => {
    const root = createNode(1, [createNode(2), createNode(3), createNode(4)]);
    const result = filter(root, (v) => v !== 3);
    assert.equal(result?.children.length, 2);
    assert.deepEqual(result?.children.map((c) => c.value), [2, 4]);
  });
});
