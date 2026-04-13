// ─── Unit Tests: file-tree ────────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { FileTree } from '../../app/modules/file-tree.js';

// ─── constructor ──────────────────────────────────────────────────────────────

describe('FileTree – constructor', () => {
  it('creates root node with default path /', () => {
    const tree = new FileTree();
    const root = tree.get('/');
    assert.ok(root);
    assert.equal(root.type, 'directory');
    assert.equal(root.path, '/');
  });

  it('creates root node with custom name', () => {
    const tree = new FileTree('myroot');
    const root = tree.get('/');
    assert.ok(root);
    assert.equal(root.type, 'directory');
  });

  it('root exists immediately', () => {
    const tree = new FileTree();
    assert.equal(tree.exists('/'), true);
  });
});

// ─── addFile ──────────────────────────────────────────────────────────────────

describe('FileTree – addFile', () => {
  it('adds a file at a top-level path', () => {
    const tree = new FileTree();
    const node = tree.addFile('/readme.txt');
    assert.equal(node.type, 'file');
    assert.equal(node.path, '/readme.txt');
    assert.equal(node.name, 'readme.txt');
  });

  it('creates intermediate directories automatically', () => {
    const tree = new FileTree();
    tree.addFile('/a/b/c/file.txt');
    assert.equal(tree.exists('/a'), true);
    assert.equal(tree.exists('/a/b'), true);
    assert.equal(tree.exists('/a/b/c'), true);
    assert.equal(tree.exists('/a/b/c/file.txt'), true);
  });

  it('stores size on the file node', () => {
    const tree = new FileTree();
    const node = tree.addFile('/file.txt', 1024);
    assert.equal(node.size, 1024);
  });

  it('stores metadata on the file node', () => {
    const tree = new FileTree();
    const node = tree.addFile('/file.txt', undefined, { author: 'alice' });
    assert.deepEqual(node.metadata, { author: 'alice' });
  });

  it('replaces an existing file at the same path', () => {
    const tree = new FileTree();
    tree.addFile('/file.txt', 100);
    tree.addFile('/file.txt', 200);
    const node = tree.get('/file.txt');
    assert.equal(node?.size, 200);
  });

  it('get returns the added file', () => {
    const tree = new FileTree();
    tree.addFile('/foo/bar.js', 42);
    const node = tree.get('/foo/bar.js');
    assert.ok(node);
    assert.equal(node.type, 'file');
    assert.equal(node.size, 42);
  });
});

// ─── addDir ───────────────────────────────────────────────────────────────────

describe('FileTree – addDir', () => {
  it('adds a directory', () => {
    const tree = new FileTree();
    const node = tree.addDir('/src');
    assert.equal(node.type, 'directory');
    assert.equal(node.path, '/src');
  });

  it('returns root for /', () => {
    const tree = new FileTree();
    const node = tree.addDir('/');
    assert.equal(node.path, '/');
  });

  it('creates intermediate directories', () => {
    const tree = new FileTree();
    tree.addDir('/a/b/c');
    assert.equal(tree.exists('/a'), true);
    assert.equal(tree.exists('/a/b'), true);
    assert.equal(tree.exists('/a/b/c'), true);
  });

  it('is idempotent: calling twice is fine', () => {
    const tree = new FileTree();
    tree.addDir('/foo');
    tree.addDir('/foo');
    assert.equal(tree.exists('/foo'), true);
    assert.equal(tree.list('/').length, 1);
  });
});

// ─── remove ───────────────────────────────────────────────────────────────────

describe('FileTree – remove', () => {
  it('removes an existing file', () => {
    const tree = new FileTree();
    tree.addFile('/file.txt');
    const removed = tree.remove('/file.txt');
    assert.equal(removed, true);
    assert.equal(tree.exists('/file.txt'), false);
  });

  it('removes a directory and its children', () => {
    const tree = new FileTree();
    tree.addFile('/src/index.js');
    tree.addFile('/src/util.js');
    const removed = tree.remove('/src');
    assert.equal(removed, true);
    assert.equal(tree.exists('/src'), false);
    assert.equal(tree.exists('/src/index.js'), false);
  });

  it('returns false for non-existent path', () => {
    const tree = new FileTree();
    assert.equal(tree.remove('/ghost.txt'), false);
  });

  it('returns false when trying to remove root', () => {
    const tree = new FileTree();
    assert.equal(tree.remove('/'), false);
  });
});

// ─── get / exists ─────────────────────────────────────────────────────────────

describe('FileTree – get / exists', () => {
  it('get returns undefined for non-existent path', () => {
    const tree = new FileTree();
    assert.equal(tree.get('/nope'), undefined);
  });

  it('exists returns false for non-existent path', () => {
    const tree = new FileTree();
    assert.equal(tree.exists('/nope'), false);
  });

  it('get returns the node for a directory', () => {
    const tree = new FileTree();
    tree.addDir('/lib');
    const node = tree.get('/lib');
    assert.ok(node);
    assert.equal(node.type, 'directory');
  });

  it('get returns the node for a file', () => {
    const tree = new FileTree();
    tree.addFile('/lib/main.ts', 512);
    const node = tree.get('/lib/main.ts');
    assert.ok(node);
    assert.equal(node.size, 512);
  });
});

// ─── list ─────────────────────────────────────────────────────────────────────

describe('FileTree – list', () => {
  it('lists children of a directory', () => {
    const tree = new FileTree();
    tree.addFile('/src/a.js');
    tree.addFile('/src/b.js');
    const children = tree.list('/src');
    assert.equal(children.length, 2);
    const names = children.map((c) => c.name).sort();
    assert.deepEqual(names, ['a.js', 'b.js']);
  });

  it('returns empty array for empty directory', () => {
    const tree = new FileTree();
    tree.addDir('/empty');
    assert.deepEqual(tree.list('/empty'), []);
  });

  it('returns empty array for non-existent path', () => {
    const tree = new FileTree();
    assert.deepEqual(tree.list('/ghost'), []);
  });

  it('returns empty array for a file path', () => {
    const tree = new FileTree();
    tree.addFile('/file.txt');
    assert.deepEqual(tree.list('/file.txt'), []);
  });

  it('lists only direct children, not grandchildren', () => {
    const tree = new FileTree();
    tree.addFile('/a/b/c.txt');
    const children = tree.list('/a');
    assert.equal(children.length, 1);
    assert.equal(children[0].name, 'b');
  });
});

// ─── move ─────────────────────────────────────────────────────────────────────

describe('FileTree – move', () => {
  it('moves a file to a new path', () => {
    const tree = new FileTree();
    tree.addFile('/old.txt', 100);
    const ok = tree.move('/old.txt', '/new.txt');
    assert.equal(ok, true);
    assert.equal(tree.exists('/old.txt'), false);
    assert.equal(tree.exists('/new.txt'), true);
    assert.equal(tree.get('/new.txt')?.size, 100);
  });

  it('moves a file into a different directory', () => {
    const tree = new FileTree();
    tree.addFile('/src/file.ts', 50);
    tree.move('/src/file.ts', '/dist/file.js');
    assert.equal(tree.exists('/src/file.ts'), false);
    assert.equal(tree.exists('/dist/file.js'), true);
  });

  it('moves a directory with its children', () => {
    const tree = new FileTree();
    tree.addFile('/old/a.txt');
    tree.addFile('/old/b.txt');
    tree.move('/old', '/new');
    assert.equal(tree.exists('/old'), false);
    assert.equal(tree.exists('/new'), true);
    assert.equal(tree.exists('/new/a.txt'), true);
    assert.equal(tree.exists('/new/b.txt'), true);
  });

  it('returns true when moving to the same path', () => {
    const tree = new FileTree();
    tree.addFile('/file.txt');
    assert.equal(tree.move('/file.txt', '/file.txt'), true);
  });

  it('returns false for non-existent source', () => {
    const tree = new FileTree();
    assert.equal(tree.move('/ghost.txt', '/new.txt'), false);
  });

  it('updates the path property after move', () => {
    const tree = new FileTree();
    tree.addFile('/a/b.txt');
    tree.move('/a/b.txt', '/c/d.txt');
    const node = tree.get('/c/d.txt');
    assert.equal(node?.path, '/c/d.txt');
    assert.equal(node?.name, 'd.txt');
  });
});

// ─── allFiles / allDirs ───────────────────────────────────────────────────────

describe('FileTree – allFiles', () => {
  it('returns all files recursively', () => {
    const tree = new FileTree();
    tree.addFile('/a.txt');
    tree.addFile('/src/b.ts');
    tree.addFile('/src/lib/c.js');
    const files = tree.allFiles();
    assert.equal(files.length, 3);
    assert.ok(files.every((f) => f.type === 'file'));
  });

  it('returns empty array when no files exist', () => {
    const tree = new FileTree();
    tree.addDir('/empty');
    assert.deepEqual(tree.allFiles(), []);
  });
});

describe('FileTree – allDirs', () => {
  it('returns all directories recursively (excluding root)', () => {
    const tree = new FileTree();
    tree.addFile('/src/index.ts');
    tree.addFile('/tests/unit/test.js');
    const dirs = tree.allDirs();
    const paths = dirs.map((d) => d.path).sort();
    assert.ok(paths.includes('/src'));
    assert.ok(paths.includes('/tests'));
    assert.ok(paths.includes('/tests/unit'));
    assert.ok(!paths.includes('/'), 'root should not appear in allDirs');
  });

  it('returns empty array for tree with no subdirs', () => {
    const tree = new FileTree();
    tree.addFile('/file.txt');
    assert.deepEqual(tree.allDirs(), []);
  });
});

// ─── find ─────────────────────────────────────────────────────────────────────

describe('FileTree – find', () => {
  it('finds files matching a predicate', () => {
    const tree = new FileTree();
    tree.addFile('/a.ts', 10);
    tree.addFile('/b.js', 20);
    tree.addFile('/c.ts', 30);
    const tsFiles = tree.find((n) => n.name.endsWith('.ts'));
    assert.equal(tsFiles.length, 2);
    assert.ok(tsFiles.every((f) => f.name.endsWith('.ts')));
  });

  it('returns empty array when no match', () => {
    const tree = new FileTree();
    tree.addFile('/file.js');
    assert.deepEqual(tree.find((n) => n.name.endsWith('.ts')), []);
  });

  it('can match directories too', () => {
    const tree = new FileTree();
    tree.addFile('/src/index.js');
    tree.addDir('/tests');
    const dirs = tree.find((n) => n.type === 'directory');
    assert.ok(dirs.some((d) => d.name === 'src'));
    assert.ok(dirs.some((d) => d.name === 'tests'));
  });
});

// ─── totalSize ────────────────────────────────────────────────────────────────

describe('FileTree – totalSize', () => {
  it('returns sum of all file sizes', () => {
    const tree = new FileTree();
    tree.addFile('/a.txt', 100);
    tree.addFile('/b.txt', 200);
    tree.addFile('/src/c.ts', 300);
    assert.equal(tree.totalSize(), 600);
  });

  it('returns 0 for empty tree', () => {
    const tree = new FileTree();
    assert.equal(tree.totalSize(), 0);
  });

  it('treats missing size as 0', () => {
    const tree = new FileTree();
    tree.addFile('/no-size.txt');
    tree.addFile('/with-size.txt', 50);
    assert.equal(tree.totalSize(), 50);
  });
});

// ─── toObject ─────────────────────────────────────────────────────────────────

describe('FileTree – toObject', () => {
  it('serializes to a plain FileNode tree', () => {
    const tree = new FileTree();
    tree.addFile('/src/index.ts', 128, { lang: 'ts' });
    const obj = tree.toObject();
    assert.equal(obj.type, 'directory');
    assert.equal(obj.path, '/');
    const src = obj.children?.find((c) => c.name === 'src');
    assert.ok(src);
    assert.equal(src.type, 'directory');
    const idx = src.children?.find((c) => c.name === 'index.ts');
    assert.ok(idx);
    assert.equal(idx.type, 'file');
    assert.equal(idx.size, 128);
    assert.deepEqual(idx.metadata, { lang: 'ts' });
  });

  it('returns a deep clone (mutations do not affect the original tree)', () => {
    const tree = new FileTree();
    tree.addFile('/file.txt', 10);
    const obj = tree.toObject();
    // Mutate the clone
    if (obj.children) obj.children.length = 0;
    // Original tree should still have the file
    assert.equal(tree.exists('/file.txt'), true);
  });

  it('serializes an empty tree', () => {
    const tree = new FileTree();
    const obj = tree.toObject();
    assert.equal(obj.type, 'directory');
    assert.deepEqual(obj.children, []);
  });
});
