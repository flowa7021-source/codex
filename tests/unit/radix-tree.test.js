// ─── Unit Tests: RadixTree ────────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { RadixTree, createRadixTree } from '../../app/modules/radix-tree.js';

// ─── constructor / size ─────────────────────────────────────────────────────

describe('RadixTree – constructor & size', () => {
  it('starts empty with size 0', () => {
    const tree = new RadixTree();
    assert.equal(tree.size, 0);
  });

  it('increments size on insert', () => {
    const tree = new RadixTree();
    tree.set('foo', 1);
    assert.equal(tree.size, 1);
    tree.set('bar', 2);
    assert.equal(tree.size, 2);
  });

  it('does not increment size on update', () => {
    const tree = new RadixTree();
    tree.set('foo', 1);
    tree.set('foo', 2);
    assert.equal(tree.size, 1);
  });
});

// ─── set / get ──────────────────────────────────────────────────────────────

describe('RadixTree – set & get', () => {
  it('stores and retrieves a value', () => {
    const tree = new RadixTree();
    tree.set('hello', 42);
    assert.equal(tree.get('hello'), 42);
  });

  it('returns undefined for missing key', () => {
    const tree = new RadixTree();
    assert.equal(tree.get('missing'), undefined);
  });

  it('handles keys with shared prefixes', () => {
    const tree = new RadixTree();
    tree.set('test', 1);
    tree.set('testing', 2);
    tree.set('tested', 3);
    assert.equal(tree.get('test'), 1);
    assert.equal(tree.get('testing'), 2);
    assert.equal(tree.get('tested'), 3);
    assert.equal(tree.size, 3);
  });

  it('overwrites existing value', () => {
    const tree = new RadixTree();
    tree.set('key', 'old');
    tree.set('key', 'new');
    assert.equal(tree.get('key'), 'new');
  });

  it('handles empty string key', () => {
    const tree = new RadixTree();
    tree.set('', 'empty');
    assert.equal(tree.get(''), 'empty');
    assert.equal(tree.size, 1);
  });

  it('handles single-character keys', () => {
    const tree = new RadixTree();
    tree.set('a', 1);
    tree.set('b', 2);
    tree.set('c', 3);
    assert.equal(tree.get('a'), 1);
    assert.equal(tree.get('b'), 2);
    assert.equal(tree.get('c'), 3);
  });
});

// ─── has ────────────────────────────────────────────────────────────────────

describe('RadixTree – has', () => {
  it('returns true for existing key', () => {
    const tree = new RadixTree();
    tree.set('present', true);
    assert.equal(tree.has('present'), true);
  });

  it('returns false for absent key', () => {
    const tree = new RadixTree();
    assert.equal(tree.has('absent'), false);
  });

  it('returns false for prefix-only match', () => {
    const tree = new RadixTree();
    tree.set('testing', 1);
    assert.equal(tree.has('test'), false);
  });
});

// ─── delete ─────────────────────────────────────────────────────────────────

describe('RadixTree – delete', () => {
  it('removes an existing key', () => {
    const tree = new RadixTree();
    tree.set('remove', 1);
    assert.equal(tree.delete('remove'), true);
    assert.equal(tree.has('remove'), false);
    assert.equal(tree.size, 0);
  });

  it('returns false for non-existent key', () => {
    const tree = new RadixTree();
    assert.equal(tree.delete('ghost'), false);
  });

  it('preserves sibling keys after deletion', () => {
    const tree = new RadixTree();
    tree.set('test', 1);
    tree.set('testing', 2);
    tree.set('tested', 3);
    tree.delete('testing');
    assert.equal(tree.get('test'), 1);
    assert.equal(tree.get('tested'), 3);
    assert.equal(tree.has('testing'), false);
    assert.equal(tree.size, 2);
  });

  it('handles deleting a prefix key while keeping children', () => {
    const tree = new RadixTree();
    tree.set('abc', 1);
    tree.set('abcdef', 2);
    tree.delete('abc');
    assert.equal(tree.has('abc'), false);
    assert.equal(tree.get('abcdef'), 2);
    assert.equal(tree.size, 1);
  });
});

// ─── keys / values / entries ────────────────────────────────────────────────

describe('RadixTree – keys, values, entries', () => {
  it('returns keys in sorted order', () => {
    const tree = new RadixTree();
    tree.set('banana', 2);
    tree.set('apple', 1);
    tree.set('cherry', 3);
    assert.deepEqual(tree.keys(), ['apple', 'banana', 'cherry']);
  });

  it('returns values in key-sorted order', () => {
    const tree = new RadixTree();
    tree.set('banana', 2);
    tree.set('apple', 1);
    tree.set('cherry', 3);
    assert.deepEqual(tree.values(), [1, 2, 3]);
  });

  it('returns entries in key-sorted order', () => {
    const tree = new RadixTree();
    tree.set('banana', 2);
    tree.set('apple', 1);
    assert.deepEqual(tree.entries(), [['apple', 1], ['banana', 2]]);
  });

  it('returns empty arrays for empty tree', () => {
    const tree = new RadixTree();
    assert.deepEqual(tree.keys(), []);
    assert.deepEqual(tree.values(), []);
    assert.deepEqual(tree.entries(), []);
  });
});

// ─── keysWithPrefix ─────────────────────────────────────────────────────────

describe('RadixTree – keysWithPrefix', () => {
  it('finds all keys with a given prefix', () => {
    const tree = new RadixTree();
    tree.set('app', 1);
    tree.set('apple', 2);
    tree.set('application', 3);
    tree.set('banana', 4);
    const result = tree.keysWithPrefix('app');
    assert.deepEqual(result, ['app', 'apple', 'application']);
  });

  it('returns empty array when no keys match', () => {
    const tree = new RadixTree();
    tree.set('hello', 1);
    assert.deepEqual(tree.keysWithPrefix('xyz'), []);
  });

  it('returns all keys for empty prefix', () => {
    const tree = new RadixTree();
    tree.set('a', 1);
    tree.set('b', 2);
    assert.deepEqual(tree.keysWithPrefix(''), ['a', 'b']);
  });
});

// ─── clear ──────────────────────────────────────────────────────────────────

describe('RadixTree – clear', () => {
  it('removes all entries', () => {
    const tree = new RadixTree();
    tree.set('a', 1);
    tree.set('b', 2);
    tree.set('c', 3);
    tree.clear();
    assert.equal(tree.size, 0);
    assert.deepEqual(tree.keys(), []);
    assert.equal(tree.get('a'), undefined);
  });
});

// ─── factory ────────────────────────────────────────────────────────────────

describe('createRadixTree factory', () => {
  it('returns a RadixTree instance', () => {
    const tree = createRadixTree();
    assert.ok(tree instanceof RadixTree);
  });

  it('produced instance works correctly', () => {
    const tree = createRadixTree();
    tree.set('key', 'value');
    assert.equal(tree.get('key'), 'value');
  });
});

// ─── edge cases ─────────────────────────────────────────────────────────────

describe('RadixTree – edge cases', () => {
  it('handles many keys with long shared prefix', () => {
    const tree = new RadixTree();
    for (let i = 0; i < 100; i++) {
      tree.set('prefix' + i, i);
    }
    assert.equal(tree.size, 100);
    assert.equal(tree.get('prefix42'), 42);
    assert.equal(tree.get('prefix99'), 99);
  });

  it('handles inserting keys in reverse order', () => {
    const tree = new RadixTree();
    tree.set('abcdef', 1);
    tree.set('abcd', 2);
    tree.set('ab', 3);
    tree.set('a', 4);
    assert.equal(tree.size, 4);
    assert.equal(tree.get('a'), 4);
    assert.equal(tree.get('ab'), 3);
    assert.equal(tree.get('abcd'), 2);
    assert.equal(tree.get('abcdef'), 1);
  });
});
