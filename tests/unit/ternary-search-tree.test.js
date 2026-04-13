// ─── Unit Tests: TernarySearchTree ────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { TernarySearchTree, createTernarySearchTree } from '../../app/modules/ternary-search-tree.js';

// ─── constructor / size ─────────────────────────────────────────────────────

describe('TernarySearchTree – constructor & size', () => {
  it('starts empty with size 0', () => {
    const tree = new TernarySearchTree();
    assert.equal(tree.size, 0);
  });

  it('increments size on insert', () => {
    const tree = new TernarySearchTree();
    tree.set('foo', 1);
    assert.equal(tree.size, 1);
    tree.set('bar', 2);
    assert.equal(tree.size, 2);
  });

  it('does not increment size on update', () => {
    const tree = new TernarySearchTree();
    tree.set('foo', 1);
    tree.set('foo', 2);
    assert.equal(tree.size, 1);
  });

  it('ignores empty string keys', () => {
    const tree = new TernarySearchTree();
    tree.set('', 42);
    assert.equal(tree.size, 0);
    assert.equal(tree.get(''), undefined);
  });
});

// ─── set / get ──────────────────────────────────────────────────────────────

describe('TernarySearchTree – set & get', () => {
  it('stores and retrieves a value', () => {
    const tree = new TernarySearchTree();
    tree.set('hello', 42);
    assert.equal(tree.get('hello'), 42);
  });

  it('returns undefined for missing key', () => {
    const tree = new TernarySearchTree();
    assert.equal(tree.get('missing'), undefined);
  });

  it('handles keys with shared prefixes', () => {
    const tree = new TernarySearchTree();
    tree.set('test', 1);
    tree.set('testing', 2);
    tree.set('tested', 3);
    assert.equal(tree.get('test'), 1);
    assert.equal(tree.get('testing'), 2);
    assert.equal(tree.get('tested'), 3);
    assert.equal(tree.size, 3);
  });

  it('overwrites existing value', () => {
    const tree = new TernarySearchTree();
    tree.set('key', 'old');
    tree.set('key', 'new');
    assert.equal(tree.get('key'), 'new');
  });

  it('handles single-character keys', () => {
    const tree = new TernarySearchTree();
    tree.set('a', 1);
    tree.set('b', 2);
    tree.set('z', 26);
    assert.equal(tree.get('a'), 1);
    assert.equal(tree.get('b'), 2);
    assert.equal(tree.get('z'), 26);
  });
});

// ─── has ────────────────────────────────────────────────────────────────────

describe('TernarySearchTree – has', () => {
  it('returns true for existing key', () => {
    const tree = new TernarySearchTree();
    tree.set('present', true);
    assert.equal(tree.has('present'), true);
  });

  it('returns false for absent key', () => {
    const tree = new TernarySearchTree();
    assert.equal(tree.has('absent'), false);
  });

  it('returns false for prefix-only match', () => {
    const tree = new TernarySearchTree();
    tree.set('testing', 1);
    assert.equal(tree.has('test'), false);
  });

  it('returns false for empty key', () => {
    const tree = new TernarySearchTree();
    tree.set('a', 1);
    assert.equal(tree.has(''), false);
  });
});

// ─── delete ─────────────────────────────────────────────────────────────────

describe('TernarySearchTree – delete', () => {
  it('removes an existing key', () => {
    const tree = new TernarySearchTree();
    tree.set('remove', 1);
    assert.equal(tree.delete('remove'), true);
    assert.equal(tree.has('remove'), false);
    assert.equal(tree.size, 0);
  });

  it('returns false for non-existent key', () => {
    const tree = new TernarySearchTree();
    assert.equal(tree.delete('ghost'), false);
  });

  it('returns false for empty key', () => {
    const tree = new TernarySearchTree();
    assert.equal(tree.delete(''), false);
  });

  it('preserves other keys after deletion', () => {
    const tree = new TernarySearchTree();
    tree.set('alpha', 1);
    tree.set('beta', 2);
    tree.set('gamma', 3);
    tree.delete('beta');
    assert.equal(tree.get('alpha'), 1);
    assert.equal(tree.get('gamma'), 3);
    assert.equal(tree.has('beta'), false);
    assert.equal(tree.size, 2);
  });

  it('handles deleting a prefix key while keeping children', () => {
    const tree = new TernarySearchTree();
    tree.set('abc', 1);
    tree.set('abcdef', 2);
    tree.delete('abc');
    assert.equal(tree.has('abc'), false);
    assert.equal(tree.get('abcdef'), 2);
    assert.equal(tree.size, 1);
  });
});

// ─── keys ───────────────────────────────────────────────────────────────────

describe('TernarySearchTree – keys', () => {
  it('returns keys in sorted order', () => {
    const tree = new TernarySearchTree();
    tree.set('banana', 2);
    tree.set('apple', 1);
    tree.set('cherry', 3);
    assert.deepEqual(tree.keys(), ['apple', 'banana', 'cherry']);
  });

  it('returns empty array for empty tree', () => {
    const tree = new TernarySearchTree();
    assert.deepEqual(tree.keys(), []);
  });
});

// ─── keysWithPrefix ─────────────────────────────────────────────────────────

describe('TernarySearchTree – keysWithPrefix', () => {
  it('finds all keys with a given prefix', () => {
    const tree = new TernarySearchTree();
    tree.set('app', 1);
    tree.set('apple', 2);
    tree.set('application', 3);
    tree.set('banana', 4);
    const result = tree.keysWithPrefix('app');
    assert.deepEqual(result, ['app', 'apple', 'application']);
  });

  it('returns empty array when no keys match', () => {
    const tree = new TernarySearchTree();
    tree.set('hello', 1);
    assert.deepEqual(tree.keysWithPrefix('xyz'), []);
  });

  it('returns all keys for empty prefix', () => {
    const tree = new TernarySearchTree();
    tree.set('a', 1);
    tree.set('b', 2);
    const result = tree.keysWithPrefix('');
    assert.deepEqual(result, ['a', 'b']);
  });

  it('returns exact match when prefix is a stored key', () => {
    const tree = new TernarySearchTree();
    tree.set('car', 1);
    const result = tree.keysWithPrefix('car');
    assert.deepEqual(result, ['car']);
  });
});

// ─── longestPrefixOf ────────────────────────────────────────────────────────

describe('TernarySearchTree – longestPrefixOf', () => {
  it('finds the longest key that is a prefix of query', () => {
    const tree = new TernarySearchTree();
    tree.set('a', 1);
    tree.set('ab', 2);
    tree.set('abc', 3);
    assert.equal(tree.longestPrefixOf('abcdef'), 'abc');
  });

  it('returns null when no key is a prefix', () => {
    const tree = new TernarySearchTree();
    tree.set('xyz', 1);
    assert.equal(tree.longestPrefixOf('abc'), null);
  });

  it('returns null for empty query', () => {
    const tree = new TernarySearchTree();
    tree.set('a', 1);
    assert.equal(tree.longestPrefixOf(''), null);
  });

  it('returns null for empty tree', () => {
    const tree = new TernarySearchTree();
    assert.equal(tree.longestPrefixOf('hello'), null);
  });

  it('returns exact key when query equals a key', () => {
    const tree = new TernarySearchTree();
    tree.set('hello', 1);
    assert.equal(tree.longestPrefixOf('hello'), 'hello');
  });

  it('skips intermediate nodes without values', () => {
    const tree = new TernarySearchTree();
    tree.set('she', 1);
    tree.set('shells', 2);
    // 'shel' is not a key, so longest prefix of 'shell' is 'she'
    assert.equal(tree.longestPrefixOf('shell'), 'she');
  });
});

// ─── clear ──────────────────────────────────────────────────────────────────

describe('TernarySearchTree – clear', () => {
  it('removes all entries', () => {
    const tree = new TernarySearchTree();
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

describe('createTernarySearchTree factory', () => {
  it('returns a TernarySearchTree instance', () => {
    const tree = createTernarySearchTree();
    assert.ok(tree instanceof TernarySearchTree);
  });

  it('produced instance works correctly', () => {
    const tree = createTernarySearchTree();
    tree.set('key', 'value');
    assert.equal(tree.get('key'), 'value');
  });
});

// ─── edge cases ─────────────────────────────────────────────────────────────

describe('TernarySearchTree – edge cases', () => {
  it('handles many keys', () => {
    const tree = new TernarySearchTree();
    for (let i = 0; i < 100; i++) {
      tree.set('key' + i, i);
    }
    assert.equal(tree.size, 100);
    assert.equal(tree.get('key42'), 42);
    assert.equal(tree.get('key99'), 99);
  });

  it('handles keys inserted in reverse sorted order', () => {
    const tree = new TernarySearchTree();
    tree.set('z', 3);
    tree.set('m', 2);
    tree.set('a', 1);
    assert.deepEqual(tree.keys(), ['a', 'm', 'z']);
    assert.equal(tree.size, 3);
  });
});
