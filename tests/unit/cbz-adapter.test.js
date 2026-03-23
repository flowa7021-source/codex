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
});
