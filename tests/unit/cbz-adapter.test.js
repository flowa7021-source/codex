import './setup-dom.js';
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { parseCbz, CbzAdapter } from '../../app/modules/cbz-adapter.js';
import { zipSync } from 'fflate';

function makeZip(entries) {
  const data = {};
  for (const [name, content] of Object.entries(entries)) {
    data[name] = typeof content === 'string'
      ? new TextEncoder().encode(content)
      : content;
  }
  return zipSync(data).buffer;
}

describe('parseCbz', () => {
  it('returns empty pages for zip with no images', async () => {
    const buf = makeZip({ 'readme.txt': 'hello' });
    const result = await parseCbz(buf);
    assert.equal(result.pages.length, 0);
    assert.equal(result.metadata.format, 'cbz');
    assert.equal(result.metadata.pageCount, 0);
  });

  it('filters to image files only', async () => {
    const buf = makeZip({
      'page1.jpg': new Uint8Array([0xFF, 0xD8]),
      'page2.png': new Uint8Array([0x89, 0x50]),
      'notes.txt': 'text',
    });
    const result = await parseCbz(buf);
    assert.equal(result.pages.length, 2);
    assert.deepEqual(result.metadata.fileNames, ['page1.jpg', 'page2.png']);
  });

  it('sorts pages naturally by name', async () => {
    const buf = makeZip({
      'page10.jpg': new Uint8Array([1]),
      'page2.jpg': new Uint8Array([2]),
      'page1.jpg': new Uint8Array([3]),
    });
    const result = await parseCbz(buf);
    assert.deepEqual(result.metadata.fileNames, ['page1.jpg', 'page2.jpg', 'page10.jpg']);
  });

  it('assigns correct mime type for PNG', async () => {
    const buf = makeZip({ 'a.png': new Uint8Array([0x89]) });
    const result = await parseCbz(buf);
    assert.equal(result.pages[0].blob.type, 'image/png');
  });

  it('assigns correct mime type for GIF', async () => {
    const buf = makeZip({ 'a.gif': new Uint8Array([0x47]) });
    const result = await parseCbz(buf);
    assert.equal(result.pages[0].blob.type, 'image/gif');
  });

  it('assigns image/jpeg for .jpg and .jpeg', async () => {
    const buf = makeZip({
      'a.jpg': new Uint8Array([1]),
      'b.jpeg': new Uint8Array([2]),
    });
    const result = await parseCbz(buf);
    assert.equal(result.pages[0].blob.type, 'image/jpeg');
    assert.equal(result.pages[1].blob.type, 'image/jpeg');
  });

  it('assigns 0-based indices to pages', async () => {
    const buf = makeZip({
      'p1.jpg': new Uint8Array([1]),
      'p2.jpg': new Uint8Array([2]),
    });
    const result = await parseCbz(buf);
    assert.equal(result.pages[0].index, 0);
    assert.equal(result.pages[1].index, 1);
  });
});

describe('CbzAdapter', () => {
  it('initializes with empty state', () => {
    const adapter = new CbzAdapter();
    assert.equal(adapter.getPageCount(), 0);
    assert.equal(adapter.getTextContent(), '');
    assert.equal(adapter.metadata, null);
  });

  it('load populates pages and metadata', async () => {
    const buf = makeZip({
      'img1.png': new Uint8Array([1]),
      'img2.png': new Uint8Array([2]),
    });
    const adapter = new CbzAdapter();
    const result = await adapter.load(buf);
    assert.equal(result, adapter);
    assert.equal(adapter.getPageCount(), 2);
    assert.equal(adapter.metadata.format, 'cbz');
  });

  it('renderPage throws for invalid page number', async () => {
    const adapter = new CbzAdapter();
    await assert.rejects(
      () => adapter.renderPage(1, document.createElement('canvas')),
      /Page 1 not found/,
    );
  });

  it('getTextContent always returns empty string', () => {
    assert.equal(new CbzAdapter().getTextContent(), '');
  });

  it('destroy clears caches and pages', async () => {
    const buf = makeZip({ 'img1.png': new Uint8Array([1]) });
    const adapter = new CbzAdapter();
    await adapter.load(buf);
    assert.equal(adapter.getPageCount(), 1);
    adapter.destroy();
    assert.equal(adapter.getPageCount(), 0);
    assert.equal(adapter._imageCache.size, 0);
  });

  it('_getImage loads and caches image on load success', async () => {
    const buf = makeZip({ 'img1.png': new Uint8Array([1]) });
    const adapter = new CbzAdapter();
    await adapter.load(buf);

    // Override Image to fire onload with dimensions
    const OrigImage = globalThis.Image;
    globalThis.Image = class MockImg {
      constructor() { this.naturalWidth = 100; this.naturalHeight = 200; this.onload = null; this.onerror = null; }
      set src(_v) { queueMicrotask(() => { if (this.onload) this.onload(); }); }
    };

    try {
      const img = await adapter._getImage(1);
      assert.equal(img.naturalWidth, 100);
      assert.equal(img.naturalHeight, 200);
      // Calling again should return cached
      const img2 = await adapter._getImage(1);
      assert.equal(img2, img);
    } finally {
      globalThis.Image = OrigImage;
    }
  });

  it('getPageSize returns image dimensions', async () => {
    const buf = makeZip({ 'img1.png': new Uint8Array([1]) });
    const adapter = new CbzAdapter();
    await adapter.load(buf);

    const OrigImage = globalThis.Image;
    globalThis.Image = class MockImg {
      constructor() { this.naturalWidth = 300; this.naturalHeight = 400; this.onload = null; this.onerror = null; }
      set src(_v) { queueMicrotask(() => { if (this.onload) this.onload(); }); }
    };

    try {
      const size = await adapter.getPageSize(1);
      assert.equal(size.width, 300);
      assert.equal(size.height, 400);
    } finally {
      globalThis.Image = OrigImage;
    }
  });

  it('renderPage draws image to canvas', async () => {
    const buf = makeZip({ 'img1.png': new Uint8Array([1]) });
    const adapter = new CbzAdapter();
    await adapter.load(buf);

    const OrigImage = globalThis.Image;
    globalThis.Image = class MockImg {
      constructor() { this.naturalWidth = 50; this.naturalHeight = 80; this.onload = null; this.onerror = null; }
      set src(_v) { queueMicrotask(() => { if (this.onload) this.onload(); }); }
    };

    try {
      const canvas = document.createElement('canvas');
      const result = await adapter.renderPage(1, canvas, 2);
      assert.equal(result.width, 100);
      assert.equal(result.height, 160);
    } finally {
      globalThis.Image = OrigImage;
    }
  });

  it('_getImage rejects when image fails to load', async () => {
    const buf = makeZip({ 'img1.png': new Uint8Array([1]) });
    const adapter = new CbzAdapter();
    await adapter.load(buf);
    // Override Image mock to fire onerror for this test
    const OrigImage = globalThis.Image;
    globalThis.Image = class MockImage {
      constructor() { this._src = ''; this.onload = null; this.onerror = null; }
      set src(v) {
        this._src = v;
        queueMicrotask(() => { if (this.onerror) this.onerror(new Error('load failed')); });
      }
      get src() { return this._src; }
    };
    try {
      await assert.rejects(
        () => adapter._getImage(1),
        /Failed to load image/,
      );
    } finally {
      globalThis.Image = OrigImage;
    }
  });

  it('destroy revokes blob URLs for cached images', async () => {
    const buf = makeZip({ 'img1.png': new Uint8Array([1]) });
    const adapter = new CbzAdapter();
    await adapter.load(buf);

    // Manually inject a cached "image" with a _blobUrl to test the revoke branch
    const fakeImg = { _blobUrl: 'blob:fake' };
    adapter._imageCache.set(1, fakeImg);

    let revokedUrl = null;
    const origRevoke = URL.revokeObjectURL.bind(URL);
    URL.revokeObjectURL = (url) => { revokedUrl = url; };

    try {
      adapter.destroy();
      assert.equal(revokedUrl, 'blob:fake');
    } finally {
      URL.revokeObjectURL = origRevoke;
    }
  });
});
