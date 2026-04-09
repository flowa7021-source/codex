// ─── Unit Tests: path-utils ───────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  join,
  normalize,
  dirname,
  basename,
  extname,
  isAbsolute,
  relative,
  resolve,
  split,
  isSubPath,
  commonAncestor,
  changeExt,
} from '../../app/modules/path-utils.js';

// ─── normalize ────────────────────────────────────────────────────────────────

describe('normalize', () => {
  it('collapses double slashes', () => {
    assert.equal(normalize('//foo//bar'), '/foo/bar');
  });

  it('resolves single dot', () => {
    assert.equal(normalize('/foo/./bar'), '/foo/bar');
  });

  it('resolves double dot', () => {
    assert.equal(normalize('/foo/bar/..'), '/foo');
  });

  it('resolves multiple double dots', () => {
    assert.equal(normalize('/a/b/../../c'), '/c');
  });

  it('handles root path', () => {
    assert.equal(normalize('/'), '/');
  });

  it('handles empty string', () => {
    assert.equal(normalize(''), '.');
  });

  it('handles relative path', () => {
    assert.equal(normalize('foo/bar'), 'foo/bar');
  });

  it('handles relative path with dot segments', () => {
    assert.equal(normalize('foo/./bar/../baz'), 'foo/baz');
  });

  it('does not go above root', () => {
    assert.equal(normalize('/../../foo'), '/foo');
  });

  it('trailing slash is removed', () => {
    assert.equal(normalize('/foo/bar/'), '/foo/bar');
  });
});

// ─── join ─────────────────────────────────────────────────────────────────────

describe('join', () => {
  it('joins two segments', () => {
    assert.equal(join('foo', 'bar'), 'foo/bar');
  });

  it('joins absolute + relative', () => {
    assert.equal(join('/foo', 'bar'), '/foo/bar');
  });

  it('handles empty parts', () => {
    assert.equal(join('foo', '', 'bar'), 'foo/bar');
  });

  it('returns . for no args', () => {
    assert.equal(join(), '.');
  });

  it('resolves dot segments within join', () => {
    assert.equal(join('/foo', '../bar'), '/bar');
  });

  it('joins multiple segments', () => {
    assert.equal(join('a', 'b', 'c', 'd'), 'a/b/c/d');
  });

  it('handles already-slashed parts', () => {
    assert.equal(join('/foo/', '/bar'), '/foo/bar');
  });
});

// ─── dirname ──────────────────────────────────────────────────────────────────

describe('dirname', () => {
  it('returns directory of a file path', () => {
    assert.equal(dirname('/foo/bar/baz.ts'), '/foo/bar');
  });

  it('returns / for top-level path', () => {
    assert.equal(dirname('/foo'), '/');
  });

  it('returns / for root', () => {
    assert.equal(dirname('/'), '/');
  });

  it('returns . for bare filename', () => {
    assert.equal(dirname('file.txt'), '.');
  });

  it('returns parent dir for relative path', () => {
    assert.equal(dirname('foo/bar/baz'), 'foo/bar');
  });
});

// ─── basename ─────────────────────────────────────────────────────────────────

describe('basename', () => {
  it('returns filename from absolute path', () => {
    assert.equal(basename('/foo/bar/baz.ts'), 'baz.ts');
  });

  it('strips extension when provided', () => {
    assert.equal(basename('/foo/bar/baz.ts', '.ts'), 'baz');
  });

  it('does not strip non-matching ext', () => {
    assert.equal(basename('/foo/bar/baz.ts', '.js'), 'baz.ts');
  });

  it('returns filename from relative path', () => {
    assert.equal(basename('foo/bar'), 'bar');
  });

  it('returns bare name for filename only', () => {
    assert.equal(basename('file.txt'), 'file.txt');
  });

  it('handles root', () => {
    assert.equal(basename('/'), '/');
  });
});

// ─── extname ──────────────────────────────────────────────────────────────────

describe('extname', () => {
  it('returns extension including dot', () => {
    assert.equal(extname('file.ts'), '.ts');
  });

  it('returns empty string for no extension', () => {
    assert.equal(extname('Makefile'), '');
  });

  it('returns last extension for multiple dots', () => {
    assert.equal(extname('archive.tar.gz'), '.gz');
  });

  it('returns empty string for dotfile', () => {
    assert.equal(extname('.gitignore'), '');
  });

  it('works with a full path', () => {
    assert.equal(extname('/foo/bar/main.js'), '.js');
  });

  it('returns empty string for path ending in dot only effectively', () => {
    assert.equal(extname('foo'), '');
  });
});

// ─── isAbsolute ───────────────────────────────────────────────────────────────

describe('isAbsolute', () => {
  it('returns true for paths starting with /', () => {
    assert.equal(isAbsolute('/foo/bar'), true);
  });

  it('returns false for relative paths', () => {
    assert.equal(isAbsolute('foo/bar'), false);
  });

  it('returns true for root /', () => {
    assert.equal(isAbsolute('/'), true);
  });

  it('returns false for empty string', () => {
    assert.equal(isAbsolute(''), false);
  });

  it('returns false for paths starting with ./', () => {
    assert.equal(isAbsolute('./foo'), false);
  });
});

// ─── relative ─────────────────────────────────────────────────────────────────

describe('relative', () => {
  it('returns relative path from one dir to another', () => {
    assert.equal(relative('/foo/bar', '/foo/baz'), '../baz');
  });

  it('returns . when paths are equal', () => {
    assert.equal(relative('/foo/bar', '/foo/bar'), '.');
  });

  it('descends into subdirectory', () => {
    assert.equal(relative('/foo', '/foo/bar/baz'), 'bar/baz');
  });

  it('climbs multiple levels', () => {
    assert.equal(relative('/a/b/c', '/a'), '../..');
  });

  it('handles paths with no common ancestor except root', () => {
    assert.equal(relative('/foo', '/bar'), '../bar');
  });

  it('handles relative paths', () => {
    assert.equal(relative('a/b', 'a/c'), '../c');
  });
});

// ─── resolve ──────────────────────────────────────────────────────────────────

describe('resolve', () => {
  it('resolves a single absolute path', () => {
    assert.equal(resolve('/foo/bar'), '/foo/bar');
  });

  it('resolves relative segment against base', () => {
    assert.equal(resolve('/foo', 'bar'), '/foo/bar');
  });

  it('a later absolute path resets the base', () => {
    assert.equal(resolve('/foo', '/bar', 'baz'), '/bar/baz');
  });

  it('resolves .. segments', () => {
    assert.equal(resolve('/foo/bar', '../baz'), '/foo/baz');
  });

  it('handles no arguments by returning root', () => {
    assert.equal(resolve(), '/');
  });

  it('handles deeply nested resolution', () => {
    assert.equal(resolve('/a', 'b', 'c', '../../d'), '/a/d');
  });
});

// ─── split ────────────────────────────────────────────────────────────────────

describe('split', () => {
  it('splits absolute path', () => {
    assert.deepEqual(split('/foo/bar/baz'), ['/', 'foo', 'bar', 'baz']);
  });

  it('splits relative path', () => {
    assert.deepEqual(split('foo/bar'), ['foo', 'bar']);
  });

  it('returns just / for root', () => {
    assert.deepEqual(split('/'), ['/']);
  });

  it('handles single segment', () => {
    assert.deepEqual(split('file.txt'), ['file.txt']);
  });

  it('resolves dot segments', () => {
    assert.deepEqual(split('/foo/./bar'), ['/', 'foo', 'bar']);
  });
});

// ─── isSubPath ────────────────────────────────────────────────────────────────

describe('isSubPath', () => {
  it('returns true when child is inside parent', () => {
    assert.equal(isSubPath('/foo', '/foo/bar'), true);
  });

  it('returns false when paths are equal', () => {
    assert.equal(isSubPath('/foo', '/foo'), false);
  });

  it('returns false when child is parent', () => {
    assert.equal(isSubPath('/foo/bar', '/foo'), false);
  });

  it('returns false for unrelated paths', () => {
    assert.equal(isSubPath('/foo', '/bar'), false);
  });

  it('returns true for deeply nested child', () => {
    assert.equal(isSubPath('/a', '/a/b/c/d'), true);
  });

  it('does not match prefix-only (no trailing slash confusion)', () => {
    assert.equal(isSubPath('/foo', '/foobar'), false);
  });
});

// ─── commonAncestor ───────────────────────────────────────────────────────────

describe('commonAncestor', () => {
  it('returns shared parent directory', () => {
    assert.equal(commonAncestor('/foo/bar', '/foo/baz'), '/foo');
  });

  it('returns root when no common segments', () => {
    assert.equal(commonAncestor('/foo', '/bar'), '/');
  });

  it('returns parent when one is ancestor of other', () => {
    assert.equal(commonAncestor('/foo', '/foo/bar'), '/foo');
  });

  it('returns same path for identical inputs', () => {
    assert.equal(commonAncestor('/foo/bar', '/foo/bar'), '/foo/bar');
  });

  it('works for relative paths', () => {
    assert.equal(commonAncestor('a/b/c', 'a/b/d'), 'a/b');
  });

  it('returns . for relative paths with no common ancestor', () => {
    assert.equal(commonAncestor('foo', 'bar'), '.');
  });
});

// ─── changeExt ────────────────────────────────────────────────────────────────

describe('changeExt', () => {
  it('changes existing extension', () => {
    assert.equal(changeExt('file.ts', '.js'), 'file.js');
  });

  it('adds extension when there is none', () => {
    assert.equal(changeExt('Makefile', '.mk'), 'Makefile.mk');
  });

  it('removes extension when newExt is empty string', () => {
    assert.equal(changeExt('file.ts', ''), 'file');
  });

  it('works with full path', () => {
    assert.equal(changeExt('/foo/bar/baz.ts', '.js'), '/foo/bar/baz.js');
  });

  it('accepts ext without leading dot', () => {
    assert.equal(changeExt('file.ts', 'mjs'), 'file.mjs');
  });

  it('changes last extension only for multiple dots', () => {
    assert.equal(changeExt('archive.tar.gz', '.bz2'), 'archive.tar.bz2');
  });
});
