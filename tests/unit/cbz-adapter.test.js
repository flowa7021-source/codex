import './setup-dom.js';
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

// Mock zip-utils before importing cbz-adapter
const mockExtractZip = mock.fn(() => ({}));
mock.module('../../app/modules/zip-utils.js', {
  namedExports: { extractZip: mockExtractZip },
});

const { parseCbz, CbzAdapter } = await import('../../app/modules/cbz-adapter.js');

describe('parseCbz', () => {
  beforeEach(() => mockExtractZip.mock.resetCalls());

  it('returns empty pages for zip with no images', async () => {
    mockExtractZip.mock.mockImplementation(() => ({ 'readme.txt': new Uint8Array() }));
    const result = await parseCbz(new ArrayBuffer(0));
    assert.equal(result.pages.length, 0);
    assert.equal(result.metadata.format, 'cbz');
    assert.equal(result.metadata.pageCount, 0);
  });

  it('filters to image files only', async () => {
    mockExtractZip.mock.mockImplementation(() => ({
      'page1.jpg': new Uint8Array([1]),
      'page2.png': new Uint8Array([2]),
      'notes.txt': new Uint8Array([3]),
      'data.xml': new Uint8Array([4]),
    }));
    const result = await parseCbz(new ArrayBuffer(0));
    assert.equal(result.pages.length, 2);
    assert.deepEqual(result.metadata.fileNames, ['page1.jpg', 'page2.png']);
  });

  it('excludes __MACOSX entries', async () => {
    mockExtractZip.mock.mockImplementation(() => ({
      'page1.jpg': new Uint8Array([1]),
      '__MACOSX/page1.jpg': new Uint8Array([2]),
    }));
    const result = await parseCbz(new ArrayBuffer(0));
    assert.equal(result.pages.length, 1);
    assert.equal(result.pages[0].name, 'page1.jpg');
  });

  it('sorts pages naturally', async () => {
    mockExtractZip.mock.mockImplementation(() => ({
      'page10.jpg': new Uint8Array([1]),
      'page2.jpg': new Uint8Array([2]),
      'page1.jpg': new Uint8Array([3]),
    }));
    const result = await parseCbz(new ArrayBuffer(0));
    assert.deepEqual(result.metadata.fileNames, ['page1.jpg', 'page2.jpg', 'page10.jpg']);
  });

  it('assigns correct mime types', async () => {
    mockExtractZip.mock.mockImplementation(() => ({
      'a.png': new Uint8Array([1]),
      'b.gif': new Uint8Array([2]),
      'c.webp': new Uint8Array([3]),
      'd.bmp': new Uint8Array([4]),
      'e.jpeg': new Uint8Array([5]),
    }));
    const result = await parseCbz(new ArrayBuffer(0));
    assert.equal(result.pages[0].blob.type, 'image/png');
    assert.equal(result.pages[1].blob.type, 'image/gif');
    assert.equal(result.pages[2].blob.type, 'image/webp');
    assert.equal(result.pages[3].blob.type, 'image/bmp');
    assert.equal(result.pages[4].blob.type, 'image/jpeg');
  });

  it('assigns 0-based indices to pages', async () => {
    mockExtractZip.mock.mockImplementation(() => ({
      'p1.jpg': new Uint8Array([1]),
      'p2.jpg': new Uint8Array([2]),
    }));
    const result = await parseCbz(new ArrayBuffer(0));
    assert.equal(result.pages[0].index, 0);
    assert.equal(result.pages[1].index, 1);
  });
});

describe('CbzAdapter', () => {
  it('initializes with empty state', () => {
    const adapter = new CbzAdapter();
    assert.equal(adapter.getPageCount(), 0);
    assert.equal(adapter.getTextContent(), '');
    assert.equal(adapter.pages.length, 0);
    assert.equal(adapter.metadata, null);
  });

  it('load populates pages and metadata', async () => {
    mockExtractZip.mock.mockImplementation(() => ({
      'img1.png': new Uint8Array([1]),
      'img2.png': new Uint8Array([2]),
    }));
    const adapter = new CbzAdapter();
    const result = await adapter.load(new ArrayBuffer(0));
    assert.equal(result, adapter); // returns this
    assert.equal(adapter.getPageCount(), 2);
    assert.equal(adapter.metadata.format, 'cbz');
  });

  it('renderPage throws for invalid page number', async () => {
    const adapter = new CbzAdapter();
    adapter.pages = [];
    await assert.rejects(() => adapter.renderPage(1, document.createElement('canvas')), /Page 1 not found/);
  });

  it('getTextContent always returns empty string', () => {
    const adapter = new CbzAdapter();
    assert.equal(adapter.getTextContent(), '');
  });

  it('destroy clears caches and pages', async () => {
    mockExtractZip.mock.mockImplementation(() => ({
      'img1.png': new Uint8Array([1]),
    }));
    const adapter = new CbzAdapter();
    await adapter.load(new ArrayBuffer(0));
    assert.equal(adapter.getPageCount(), 1);
    adapter.destroy();
    assert.equal(adapter.getPageCount(), 0);
    assert.equal(adapter._imageCache.size, 0);
  });
});
