// ─── Unit Tests: forest ───────────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { Forest, toAdjacencyList, fromAdjacencyList, serialize, deserialize } from '../../app/modules/forest.js';
import { createNode, find, size } from '../../app/modules/tree-utils.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build the test tree used across most describe blocks:
 *
 *        1
 *       / \
 *      2   3
 *     / \
 *    4   5
 */
function buildTree() {
  return createNode(1, [
    createNode(2, [
      createNode(4),
      createNode(5),
    ]),
    createNode(3),
  ]);
}

function buildSmallTree() {
  return createNode(10, [createNode(20), createNode(30)]);
}

// ─── Forest — constructor / getRoots ──────────────────────────────────────────

describe('Forest constructor / getRoots', () => {
  it('creates an empty forest by default', () => {
    const f = new Forest();
    assert.deepEqual(f.getRoots(), []);
  });

  it('accepts initial trees', () => {
    const t1 = buildTree();
    const t2 = buildSmallTree();
    const f = new Forest([t1, t2]);
    assert.equal(f.getRoots().length, 2);
  });

  it('getRoots returns a copy (mutating the returned array does not affect the forest)', () => {
    const f = new Forest([buildTree()]);
    const roots = f.getRoots();
    roots.push(buildSmallTree());
    assert.equal(f.getRoots().length, 1);
  });

  it('does not share the initial array (adding later does not affect original)', () => {
    const arr = [buildTree()];
    const f = new Forest(arr);
    arr.push(buildSmallTree());
    assert.equal(f.getRoots().length, 1);
  });

  it('stores trees in insertion order', () => {
    const t1 = buildTree();
    const t2 = buildSmallTree();
    const f = new Forest([t1, t2]);
    assert.equal(f.getRoots()[0].value, 1);
    assert.equal(f.getRoots()[1].value, 10);
  });

  it('each root in getRoots is the exact reference passed in', () => {
    const t = buildTree();
    const f = new Forest([t]);
    assert.equal(f.getRoots()[0], t);
  });

  it('accepts an empty array explicitly', () => {
    const f = new Forest([]);
    assert.deepEqual(f.getRoots(), []);
  });

  it('accepts more than two trees', () => {
    const f = new Forest([buildTree(), buildSmallTree(), createNode(99)]);
    assert.equal(f.getRoots().length, 3);
  });
});

// ─── Forest — addTree ─────────────────────────────────────────────────────────

describe('Forest#addTree', () => {
  it('adds a tree to an empty forest', () => {
    const f = new Forest();
    f.addTree(buildTree());
    assert.equal(f.getRoots().length, 1);
  });

  it('appends trees in order', () => {
    const f = new Forest();
    f.addTree(buildTree());
    f.addTree(buildSmallTree());
    const roots = f.getRoots();
    assert.equal(roots[0].value, 1);
    assert.equal(roots[1].value, 10);
  });

  it('allows adding the same tree reference twice', () => {
    const t = buildTree();
    const f = new Forest();
    f.addTree(t);
    f.addTree(t);
    assert.equal(f.getRoots().length, 2);
  });

  it('does not mutate the added tree', () => {
    const t = buildTree();
    const before = size(t);
    const f = new Forest();
    f.addTree(t);
    assert.equal(size(t), before);
  });

  it('increases totalSize', () => {
    const f = new Forest([buildTree()]);
    const before = f.totalSize();
    f.addTree(buildSmallTree());
    assert.equal(f.totalSize(), before + size(buildSmallTree()));
  });

  it('single-node tree can be added', () => {
    const f = new Forest();
    f.addTree(createNode('leaf'));
    assert.equal(f.getRoots().length, 1);
    assert.equal(f.getRoots()[0].value, 'leaf');
  });

  it('added tree is findable via findInAll', () => {
    const f = new Forest([buildTree()]);
    f.addTree(buildSmallTree());
    assert.equal(f.findInAll(20)?.value, 20);
  });

  it('can add many trees', () => {
    const f = new Forest();
    for (let i = 0; i < 50; i++) f.addTree(createNode(i));
    assert.equal(f.getRoots().length, 50);
  });
});

// ─── Forest — removeTree ──────────────────────────────────────────────────────

describe('Forest#removeTree', () => {
  it('returns true and removes a tree by root value', () => {
    const f = new Forest([buildTree(), buildSmallTree()]);
    const removed = f.removeTree(1);
    assert.equal(removed, true);
    assert.equal(f.getRoots().length, 1);
    assert.equal(f.getRoots()[0].value, 10);
  });

  it('returns false when root value is not found', () => {
    const f = new Forest([buildTree()]);
    assert.equal(f.removeTree(99), false);
    assert.equal(f.getRoots().length, 1);
  });

  it('removes only the first matching tree when duplicates exist', () => {
    const f = new Forest([buildTree(), buildTree()]);
    f.removeTree(1);
    assert.equal(f.getRoots().length, 1);
  });

  it('returns false on an empty forest', () => {
    assert.equal(new Forest().removeTree(1), false);
  });

  it('forest is empty after removing the only tree', () => {
    const f = new Forest([buildTree()]);
    f.removeTree(1);
    assert.equal(f.getRoots().length, 0);
  });

  it('does not affect other trees after removal', () => {
    const f = new Forest([buildTree(), buildSmallTree()]);
    f.removeTree(1);
    assert.equal(f.findInAll(20)?.value, 20);
  });

  it('decreases totalSize by the removed tree size', () => {
    const t1 = buildTree();
    const t2 = buildSmallTree();
    const f = new Forest([t1, t2]);
    const before = f.totalSize();
    f.removeTree(10);
    assert.equal(f.totalSize(), before - size(t2));
  });

  it('can re-add a tree after removing it', () => {
    const t = buildTree();
    const f = new Forest([t]);
    f.removeTree(1);
    f.addTree(t);
    assert.equal(f.getRoots().length, 1);
  });
});

// ─── Forest — findInAll ───────────────────────────────────────────────────────

describe('Forest#findInAll', () => {
  it('finds a node in the first tree', () => {
    const f = new Forest([buildTree(), buildSmallTree()]);
    assert.equal(f.findInAll(4)?.value, 4);
  });

  it('finds a node in the second tree', () => {
    const f = new Forest([buildTree(), buildSmallTree()]);
    assert.equal(f.findInAll(20)?.value, 20);
  });

  it('returns null when value is not found in any tree', () => {
    const f = new Forest([buildTree(), buildSmallTree()]);
    assert.equal(f.findInAll(999), null);
  });

  it('returns null for an empty forest', () => {
    assert.equal(new Forest().findInAll(1), null);
  });

  it('returns the root node when value matches a root', () => {
    const t = buildTree();
    const f = new Forest([t]);
    assert.equal(f.findInAll(1), t);
  });

  it('returned node has expected children', () => {
    const f = new Forest([buildTree()]);
    const node = f.findInAll(2);
    assert.deepEqual(node?.children.map((c) => c.value), [4, 5]);
  });

  it('searches first tree before second tree (returns first match)', () => {
    const t1 = createNode(1, [createNode(7)]);
    const t2 = createNode(2, [createNode(7)]);
    const f = new Forest([t1, t2]);
    const found = f.findInAll(7);
    // Should come from t1 (first tree)
    assert.equal(found?.value, 7);
    assert.equal(found, t1.children[0]);
  });

  it('finds a deeply nested node', () => {
    const f = new Forest([buildTree()]);
    assert.equal(f.findInAll(5)?.value, 5);
  });
});

// ─── Forest — allValues ───────────────────────────────────────────────────────

describe('Forest#allValues', () => {
  it('returns all values across all trees in BFS order per tree', () => {
    const f = new Forest([buildTree(), buildSmallTree()]);
    const values = f.allValues();
    // buildTree BFS: [1,2,3,4,5], buildSmallTree BFS: [10,20,30]
    assert.deepEqual(values, [1, 2, 3, 4, 5, 10, 20, 30]);
  });

  it('returns empty array for empty forest', () => {
    assert.deepEqual(new Forest().allValues(), []);
  });

  it('returns all values for a single tree', () => {
    const f = new Forest([buildTree()]);
    assert.deepEqual(f.allValues().sort((a, b) => a - b), [1, 2, 3, 4, 5]);
  });

  it('count of allValues equals totalSize', () => {
    const f = new Forest([buildTree(), buildSmallTree()]);
    assert.equal(f.allValues().length, f.totalSize());
  });

  it('returns values from trees in forest order', () => {
    const f = new Forest([buildSmallTree(), buildTree()]);
    const values = f.allValues();
    // buildSmallTree first: 10 should appear before 1
    assert.equal(values[0], 10);
  });

  it('handles forest with single-node trees', () => {
    const f = new Forest([createNode('a'), createNode('b'), createNode('c')]);
    assert.deepEqual(f.allValues(), ['a', 'b', 'c']);
  });

  it('does not mutate the trees', () => {
    const f = new Forest([buildTree()]);
    const before = f.totalSize();
    f.allValues();
    assert.equal(f.totalSize(), before);
  });

  it('works after adding more trees', () => {
    const f = new Forest([buildTree()]);
    f.addTree(buildSmallTree());
    assert.equal(f.allValues().length, 8);
  });
});

// ─── Forest — totalSize ───────────────────────────────────────────────────────

describe('Forest#totalSize', () => {
  it('returns 0 for an empty forest', () => {
    assert.equal(new Forest().totalSize(), 0);
  });

  it('returns size of one tree for a single-tree forest', () => {
    const f = new Forest([buildTree()]);
    assert.equal(f.totalSize(), 5);
  });

  it('sums sizes across multiple trees', () => {
    const f = new Forest([buildTree(), buildSmallTree()]);
    assert.equal(f.totalSize(), 5 + 3);
  });

  it('equals allValues().length', () => {
    const f = new Forest([buildTree(), buildSmallTree()]);
    assert.equal(f.totalSize(), f.allValues().length);
  });

  it('decreases after removeTree', () => {
    const f = new Forest([buildTree(), buildSmallTree()]);
    f.removeTree(10);
    assert.equal(f.totalSize(), 5);
  });

  it('increases after addTree', () => {
    const f = new Forest([buildTree()]);
    f.addTree(createNode(99));
    assert.equal(f.totalSize(), 6);
  });

  it('handles forest with many single-node trees', () => {
    const f = new Forest(Array.from({ length: 7 }, (_, i) => createNode(i)));
    assert.equal(f.totalSize(), 7);
  });

  it('handles deeply nested tree', () => {
    const deep = createNode(1, [createNode(2, [createNode(3, [createNode(4, [createNode(5)])])])]);
    const f = new Forest([deep]);
    assert.equal(f.totalSize(), 5);
  });
});

// ─── Forest — merge ───────────────────────────────────────────────────────────

describe('Forest#merge', () => {
  it('returns a new forest containing trees from both', () => {
    const f1 = new Forest([buildTree()]);
    const f2 = new Forest([buildSmallTree()]);
    const merged = f1.merge(f2);
    assert.equal(merged.getRoots().length, 2);
  });

  it('does not mutate f1', () => {
    const f1 = new Forest([buildTree()]);
    const f2 = new Forest([buildSmallTree()]);
    f1.merge(f2);
    assert.equal(f1.getRoots().length, 1);
  });

  it('does not mutate f2', () => {
    const f1 = new Forest([buildTree()]);
    const f2 = new Forest([buildSmallTree()]);
    f1.merge(f2);
    assert.equal(f2.getRoots().length, 1);
  });

  it("f1's trees come before f2's trees in the merged forest", () => {
    const f1 = new Forest([buildTree()]);
    const f2 = new Forest([buildSmallTree()]);
    const merged = f1.merge(f2);
    assert.equal(merged.getRoots()[0].value, 1);
    assert.equal(merged.getRoots()[1].value, 10);
  });

  it('merging empty forests yields empty forest', () => {
    const merged = new Forest().merge(new Forest());
    assert.equal(merged.totalSize(), 0);
  });

  it('merging with empty forest returns trees from original', () => {
    const f = new Forest([buildTree()]);
    const merged = f.merge(new Forest());
    assert.equal(merged.totalSize(), 5);
  });

  it('merged forest totalSize equals sum of both forests', () => {
    const f1 = new Forest([buildTree()]);
    const f2 = new Forest([buildSmallTree()]);
    const merged = f1.merge(f2);
    assert.equal(merged.totalSize(), f1.totalSize() + f2.totalSize());
  });

  it('merged forest can find nodes from both originals', () => {
    const f1 = new Forest([buildTree()]);
    const f2 = new Forest([buildSmallTree()]);
    const merged = f1.merge(f2);
    assert.equal(merged.findInAll(5)?.value, 5);
    assert.equal(merged.findInAll(30)?.value, 30);
  });
});

// ─── toAdjacencyList ──────────────────────────────────────────────────────────

describe('toAdjacencyList', () => {
  it('maps root to its children values', () => {
    const root = buildTree();
    const adj = toAdjacencyList(root);
    assert.deepEqual(adj.get(1), [2, 3]);
  });

  it('maps intermediate nodes to their children', () => {
    const adj = toAdjacencyList(buildTree());
    assert.deepEqual(adj.get(2), [4, 5]);
  });

  it('maps leaf nodes to empty arrays', () => {
    const adj = toAdjacencyList(buildTree());
    assert.deepEqual(adj.get(3), []);
    assert.deepEqual(adj.get(4), []);
    assert.deepEqual(adj.get(5), []);
  });

  it('contains an entry for every node', () => {
    const adj = toAdjacencyList(buildTree());
    assert.equal(adj.size, 5);
  });

  it('single-node tree produces one entry with empty children', () => {
    const adj = toAdjacencyList(createNode(42));
    assert.equal(adj.size, 1);
    assert.deepEqual(adj.get(42), []);
  });

  it('returns a Map (not a plain object)', () => {
    assert.ok(toAdjacencyList(buildTree()) instanceof Map);
  });

  it('handles a wide flat tree correctly', () => {
    const root = createNode(0, [createNode(1), createNode(2), createNode(3)]);
    const adj = toAdjacencyList(root);
    assert.deepEqual(adj.get(0), [1, 2, 3]);
    assert.deepEqual(adj.get(1), []);
  });

  it('handles a deep unary chain', () => {
    const root = createNode('a', [createNode('b', [createNode('c')])]);
    const adj = toAdjacencyList(root);
    assert.deepEqual(adj.get('a'), ['b']);
    assert.deepEqual(adj.get('b'), ['c']);
    assert.deepEqual(adj.get('c'), []);
  });
});

// ─── fromAdjacencyList ────────────────────────────────────────────────────────

describe('fromAdjacencyList', () => {
  it('builds the same tree from an adjacency list derived by toAdjacencyList', () => {
    const original = buildTree();
    const adj = toAdjacencyList(original);
    const rebuilt = fromAdjacencyList(adj, 1);
    assert.equal(rebuilt.value, 1);
    assert.equal(rebuilt.children.length, 2);
    assert.equal(rebuilt.children[0].value, 2);
    assert.equal(rebuilt.children[0].children.length, 2);
    assert.equal(rebuilt.children[1].value, 3);
    assert.deepEqual(rebuilt.children[1].children, []);
  });

  it('creates leaf nodes for values with no entry in the map', () => {
    const map = new Map([[1, [2, 3]]]);
    const root = fromAdjacencyList(map, 1);
    assert.equal(root.children[0].children.length, 0);
    assert.equal(root.children[1].children.length, 0);
  });

  it('root with no children (absent from map) becomes a leaf', () => {
    const map = new Map();
    const root = fromAdjacencyList(map, 99);
    assert.equal(root.value, 99);
    assert.deepEqual(root.children, []);
  });

  it('handles a single-node root entry with empty children list', () => {
    const map = new Map([[42, []]]);
    const root = fromAdjacencyList(map, 42);
    assert.equal(root.value, 42);
    assert.deepEqual(root.children, []);
  });

  it('round-trips correctly: toAdjacencyList → fromAdjacencyList', () => {
    const original = buildSmallTree();
    const adj = toAdjacencyList(original);
    const rebuilt = fromAdjacencyList(adj, 10);
    assert.equal(rebuilt.children.length, 2);
    assert.deepEqual(rebuilt.children.map((c) => c.value).sort((a, b) => a - b), [20, 30]);
  });

  it('breaks cycles silently (visited node becomes a leaf on second encounter)', () => {
    // Manual cyclic map: 1 → [2], 2 → [1]
    const map = new Map([[1, [2]], [2, [1]]]);
    const root = fromAdjacencyList(map, 1);
    // 1 → 2 → 1 (leaf, cycle broken)
    assert.equal(root.value, 1);
    assert.equal(root.children[0].value, 2);
    assert.equal(root.children[0].children[0].value, 1);
    assert.deepEqual(root.children[0].children[0].children, []);
  });

  it('works with string keys', () => {
    const map = new Map([['root', ['a', 'b']], ['a', []], ['b', ['c']], ['c', []]]);
    const root = fromAdjacencyList(map, 'root');
    assert.equal(find(root, 'c')?.value, 'c');
  });

  it('produces correct size', () => {
    const adj = toAdjacencyList(buildTree());
    const rebuilt = fromAdjacencyList(adj, 1);
    assert.equal(size(rebuilt), 5);
  });
});

// ─── serialize / deserialize ──────────────────────────────────────────────────

describe('serialize', () => {
  it('produces a valid JSON string', () => {
    const json = serialize(buildTree());
    assert.doesNotThrow(() => JSON.parse(json));
  });

  it('serialised JSON contains the root value', () => {
    const json = serialize(buildTree());
    const parsed = JSON.parse(json);
    assert.equal(parsed.value, 1);
  });

  it('serialised JSON contains children', () => {
    const json = serialize(buildTree());
    const parsed = JSON.parse(json);
    assert.equal(parsed.children.length, 2);
  });

  it('single-node tree serialises to {"value":42,"children":[]}', () => {
    const json = serialize(createNode(42));
    assert.deepEqual(JSON.parse(json), { value: 42, children: [] });
  });

  it('strips parent backlinks (no circular-reference error)', () => {
    const child = createNode(2);
    const root = createNode(1, [child]);
    child.parent = root; // set a parent backlink manually
    assert.doesNotThrow(() => serialize(root));
  });

  it('serialises string values', () => {
    const root = createNode('root', [createNode('child')]);
    const json = serialize(root);
    const parsed = JSON.parse(json);
    assert.equal(parsed.value, 'root');
    assert.equal(parsed.children[0].value, 'child');
  });

  it('serialises nested children recursively', () => {
    const root = buildTree();
    const json = serialize(root);
    const parsed = JSON.parse(json);
    assert.equal(parsed.children[0].children[0].value, 4);
    assert.equal(parsed.children[0].children[1].value, 5);
  });

  it('returns a string type', () => {
    assert.equal(typeof serialize(buildTree()), 'string');
  });
});

describe('deserialize', () => {
  it('restores the tree value', () => {
    const json = serialize(buildTree());
    const tree = deserialize(json);
    assert.equal(tree.value, 1);
  });

  it('restores the full structure', () => {
    const original = buildTree();
    const restored = deserialize(serialize(original));
    assert.equal(restored.children.length, 2);
    assert.equal(restored.children[0].value, 2);
    assert.equal(restored.children[0].children.length, 2);
    assert.equal(restored.children[1].value, 3);
  });

  it('round-trips correctly (serialize → deserialize)', () => {
    const original = buildTree();
    const restored = deserialize(serialize(original));
    assert.equal(size(restored), size(original));
    assert.equal(find(restored, 5)?.value, 5);
  });

  it('single-node tree round-trips', () => {
    const original = createNode(99);
    const restored = deserialize(serialize(original));
    assert.equal(restored.value, 99);
    assert.deepEqual(restored.children, []);
  });

  it('string-valued tree round-trips', () => {
    const original = createNode('root', [createNode('a'), createNode('b')]);
    const restored = deserialize(serialize(original));
    assert.equal(restored.value, 'root');
    assert.deepEqual(restored.children.map((c) => c.value), ['a', 'b']);
  });

  it('restored nodes have no parent backlinks (createNode contract)', () => {
    const restored = deserialize(serialize(buildTree()));
    assert.equal(restored.parent, undefined);
    assert.equal(restored.children[0].parent, undefined);
  });

  it('throws on invalid JSON', () => {
    assert.throws(() => deserialize('not json'));
  });

  it('can deserialize large trees without error', () => {
    // Build a chain of depth 50
    let node = createNode(0);
    for (let i = 1; i < 50; i++) {
      node = createNode(i, [node]);
    }
    const restored = deserialize(serialize(node));
    assert.equal(restored.value, 49);
    assert.equal(size(restored), 50);
  });
});
