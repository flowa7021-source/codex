// ─── Unit Tests: OPFS Storage ───────────────────────────────────────────────
import './setup-dom.js';
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

// ── OPFS Mock ───────────────────────────────────────────────────────────────

class MockFileHandle {
  constructor(name) {
    this.name = name;
    this.kind = 'file';
    /** @type {Uint8Array|null} */
    this._data = null;
  }
  async getFile() {
    const data = this._data || new Uint8Array();
    return new Blob([data]);
  }
  async createWritable() {
    const handle = this;
    return {
      async write(/** @type {any} */ d) {
        if (d instanceof Blob) {
          const ab = await d.arrayBuffer();
          handle._data = new Uint8Array(ab);
        } else if (d instanceof ArrayBuffer) {
          handle._data = new Uint8Array(d);
        } else if (d instanceof Uint8Array) {
          handle._data = new Uint8Array(d);
        } else {
          handle._data = d;
        }
      },
      async close() {},
    };
  }
}

class MockDirHandle {
  constructor() {
    /** @type {Map<string, MockFileHandle>} */
    this._files = new Map();
    /** @type {Map<string, MockDirHandle>} */
    this._dirs = new Map();
    this.kind = 'directory';
    this.name = '';
  }
  async getFileHandle(name, opts) {
    if (!this._files.has(name) && opts?.create) {
      this._files.set(name, new MockFileHandle(name));
    }
    if (!this._files.has(name)) {
      throw new DOMException('Not found', 'NotFoundError');
    }
    return this._files.get(name);
  }
  async getDirectoryHandle(name, opts) {
    if (!this._dirs.has(name) && opts?.create) {
      this._dirs.set(name, new MockDirHandle());
    }
    if (!this._dirs.has(name)) {
      throw new DOMException('Not found', 'NotFoundError');
    }
    return this._dirs.get(name);
  }
  async removeEntry(name) {
    if (!this._files.has(name) && !this._dirs.has(name)) {
      throw new DOMException('Not found', 'NotFoundError');
    }
    this._files.delete(name);
    this._dirs.delete(name);
  }
  async *values() {
    for (const h of this._files.values()) yield h;
    for (const d of this._dirs.values()) yield d;
  }
}

/** @type {MockDirHandle|null} */
let mockRoot = null;
let savedStorage;

function installMock() {
  mockRoot = new MockDirHandle();
  savedStorage = navigator.storage;
  /** @type {any} */ (navigator).storage = {
    getDirectory: async () => mockRoot,
  };
}

function removeMock() {
  /** @type {any} */ (navigator).storage = savedStorage;
  mockRoot = null;
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('opfs-storage', () => {
  /** @type {typeof import('../../app/modules/opfs-storage.js')} */
  let mod;

  beforeEach(async () => {
    installMock();
    // Dynamic import so the module picks up the mock each time
    mod = await import('../../app/modules/opfs-storage.js');
  });

  afterEach(() => {
    removeMock();
  });

  describe('isOpfsSupported', () => {
    it('returns true when OPFS is available', async () => {
      const result = await mod.isOpfsSupported();
      assert.equal(result, true);
    });

    it('returns false when API is unavailable', async () => {
      /** @type {any} */ (navigator).storage = undefined;
      const result = await mod.isOpfsSupported();
      assert.equal(result, false);
    });

    it('returns false when getDirectory throws', async () => {
      /** @type {any} */ (navigator).storage = {
        getDirectory: async () => { throw new Error('denied'); },
      };
      const result = await mod.isOpfsSupported();
      assert.equal(result, false);
    });
  });

  describe('writeFile + readFile roundtrip', () => {
    it('writes and reads back Uint8Array data', async () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      await mod.writeFile('test/data.bin', data);
      const result = await mod.readFile('test/data.bin');
      assert.ok(result);
      assert.deepEqual([...result], [1, 2, 3, 4, 5]);
    });

    it('writes and reads back ArrayBuffer data', async () => {
      const buf = new Uint8Array([10, 20, 30]).buffer;
      await mod.writeFile('buftest.bin', buf);
      const result = await mod.readFile('buftest.bin');
      assert.ok(result);
      assert.deepEqual([...result], [10, 20, 30]);
    });

    it('handles nested directory paths', async () => {
      const data = new Uint8Array([99]);
      await mod.writeFile('a/b/c/deep.bin', data);
      const result = await mod.readFile('a/b/c/deep.bin');
      assert.ok(result);
      assert.deepEqual([...result], [99]);
    });
  });

  describe('readFile', () => {
    it('returns null for missing file', async () => {
      const result = await mod.readFile('nonexistent/file.bin');
      assert.equal(result, null);
    });

    it('returns null for missing directory', async () => {
      const result = await mod.readFile('no-such-dir/file.bin');
      assert.equal(result, null);
    });
  });

  describe('deleteFile', () => {
    it('removes an existing file and returns true', async () => {
      await mod.writeFile('del/target.bin', new Uint8Array([1]));
      const deleted = await mod.deleteFile('del/target.bin');
      assert.equal(deleted, true);

      const result = await mod.readFile('del/target.bin');
      assert.equal(result, null);
    });

    it('returns false for missing file', async () => {
      const deleted = await mod.deleteFile('nope/missing.bin');
      assert.equal(deleted, false);
    });
  });

  describe('listFiles', () => {
    it('lists files in a directory', async () => {
      await mod.writeFile('imgs/a.png', new Uint8Array([1]));
      await mod.writeFile('imgs/b.png', new Uint8Array([2]));
      await mod.writeFile('imgs/c.png', new Uint8Array([3]));

      const files = await mod.listFiles('imgs');
      assert.equal(files.length, 3);
      assert.ok(files.includes('a.png'));
      assert.ok(files.includes('b.png'));
      assert.ok(files.includes('c.png'));
    });

    it('returns empty array for missing directory', async () => {
      const files = await mod.listFiles('nodir');
      assert.deepEqual(files, []);
    });

    it('does not include subdirectories', async () => {
      // Create a file and a nested subdir
      await mod.writeFile('parent/file.txt', new Uint8Array([1]));
      await mod.writeFile('parent/sub/nested.txt', new Uint8Array([2]));

      const files = await mod.listFiles('parent');
      assert.deepEqual(files, ['file.txt']);
    });
  });

  describe('getFileSize', () => {
    it('returns correct byte size', async () => {
      const data = new Uint8Array([10, 20, 30, 40, 50]);
      await mod.writeFile('sized/file.bin', data);
      const size = await mod.getFileSize('sized/file.bin');
      assert.equal(size, 5);
    });

    it('returns -1 for missing file', async () => {
      const size = await mod.getFileSize('nope/missing.bin');
      assert.equal(size, -1);
    });
  });

  describe('clearDirectory', () => {
    it('removes all files and returns count', async () => {
      await mod.writeFile('cache/a.bin', new Uint8Array([1]));
      await mod.writeFile('cache/b.bin', new Uint8Array([2]));
      await mod.writeFile('cache/c.bin', new Uint8Array([3]));

      const count = await mod.clearDirectory('cache');
      assert.equal(count, 3);

      const files = await mod.listFiles('cache');
      assert.deepEqual(files, []);
    });

    it('returns 0 for empty directory', async () => {
      // Create empty dir by creating then clearing
      await mod.writeFile('empty-dir/temp.bin', new Uint8Array([1]));
      await mod.deleteFile('empty-dir/temp.bin');

      const count = await mod.clearDirectory('empty-dir');
      assert.equal(count, 0);
    });

    it('returns 0 for missing directory', async () => {
      const count = await mod.clearDirectory('nonexistent');
      assert.equal(count, 0);
    });
  });
});
