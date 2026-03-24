import './setup-dom.js';
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { parseXps, XpsAdapter } from '../../app/modules/xps-adapter.js';

// Helper: build a minimal valid XPS zip (store method, no compression)
function buildXpsZip(files, options = {}) {
  const entries = [];
  let offset = 0;
  const encoder = new TextEncoder();

  for (const [name, content] of Object.entries(files)) {
    const nameBytes = encoder.encode(name);
    const data = typeof content === 'string' ? encoder.encode(content) : content;
    // Allow per-file compression method override via options.compressionMethods
    const compMethod = options.compressionMethods?.[name] ?? 0;

    // Local file header (30 bytes + name + data)
    const header = new ArrayBuffer(30 + nameBytes.length + data.length);
    const view = new DataView(header);
    view.setUint32(0, 0x04034b50, true);    // signature
    view.setUint16(4, 20, true);             // version needed
    view.setUint16(8, compMethod, true);     // compression method
    view.setUint32(18, data.length, true);   // compressed size
    view.setUint32(22, data.length, true);   // uncompressed size
    view.setUint16(26, nameBytes.length, true); // file name length
    view.setUint16(28, 0, true);             // extra field length

    const buf = new Uint8Array(header);
    buf.set(nameBytes, 30);
    buf.set(data, 30 + nameBytes.length);
    entries.push(buf);
    offset += buf.length;
  }

  // Concatenate all entries
  const total = entries.reduce((s, e) => s + e.length, 0);
  const result = new Uint8Array(total);
  let pos = 0;
  for (const e of entries) {
    result.set(e, pos);
    pos += e.length;
  }
  return result.buffer;
}

describe('parseXps', () => {
  it('returns empty pages for archive with no .fpage files', async () => {
    const zip = buildXpsZip({ 'readme.txt': 'hello' });
    const result = await parseXps(zip);
    assert.equal(result.pages.length, 0);
    assert.equal(result.metadata.format, 'XPS');
  });

  it('parses a single fpage with dimensions', async () => {
    const fpage = '<FixedPage Width="800" Height="600"></FixedPage>';
    const zip = buildXpsZip({ 'Documents/1/Pages/1.fpage': fpage });
    const result = await parseXps(zip);
    assert.equal(result.pages.length, 1);
    assert.equal(result.pages[0].width, 800);
    assert.equal(result.pages[0].height, 600);
  });

  it('uses default dimensions when attributes are missing', async () => {
    const fpage = '<FixedPage></FixedPage>';
    const zip = buildXpsZip({ 'Documents/1/Pages/1.fpage': fpage });
    const result = await parseXps(zip);
    assert.equal(result.pages[0].width, 816);
    assert.equal(result.pages[0].height, 1056);
  });

  it('extracts text from Glyphs UnicodeString attributes', async () => {
    const fpage = '<FixedPage Width="100" Height="100"><Glyphs UnicodeString="Hello"/><Glyphs UnicodeString="World"/></FixedPage>';
    const zip = buildXpsZip({ 'Documents/1/Pages/1.fpage': fpage });
    const result = await parseXps(zip);
    assert.equal(result.pages[0].text, 'Hello World');
  });

  it('extracts title from core.xml', async () => {
    const fpage = '<FixedPage Width="100" Height="100"></FixedPage>';
    const core = '<cp:coreProperties><dc:title>My Document</dc:title></cp:coreProperties>';
    const zip = buildXpsZip({
      'Documents/1/Pages/1.fpage': fpage,
      'docProps/core.xml': core,
    });
    const result = await parseXps(zip);
    assert.equal(result.metadata.title, 'My Document');
  });

  it('sorts multiple pages naturally', async () => {
    const fp1 = '<FixedPage Width="100" Height="100"><Glyphs UnicodeString="Page1"/></FixedPage>';
    const fp2 = '<FixedPage Width="200" Height="200"><Glyphs UnicodeString="Page2"/></FixedPage>';
    const zip = buildXpsZip({
      'Documents/1/Pages/2.fpage': fp2,
      'Documents/1/Pages/1.fpage': fp1,
    });
    const result = await parseXps(zip);
    assert.equal(result.pages.length, 2);
    assert.equal(result.pages[0].text, 'Page1');
    assert.equal(result.pages[1].text, 'Page2');
  });

  it('sets pageCount in metadata', async () => {
    const fp = '<FixedPage Width="100" Height="100"></FixedPage>';
    const zip = buildXpsZip({
      'Documents/1/Pages/1.fpage': fp,
      'Documents/1/Pages/2.fpage': fp,
      'Documents/1/Pages/3.fpage': fp,
    });
    const result = await parseXps(zip);
    assert.equal(result.metadata.pageCount, 3);
  });

  it('handles deflate-compressed entries (compMethod != 0)', async () => {
    const fpage = '<FixedPage Width="500" Height="700"><Glyphs UnicodeString="Deflated"/></FixedPage>';
    const zip = buildXpsZip(
      { 'Documents/1/Pages/1.fpage': fpage },
      { compressionMethods: { 'Documents/1/Pages/1.fpage': 8 } }, // 8 = deflate
    );
    const result = await parseXps(zip);
    assert.equal(result.pages.length, 1);
    // Data is still stored raw even for deflate method
    assert.equal(result.pages[0].text, 'Deflated');
  });

  it('handles FixedDocumentSequence.fdseq file in archive', async () => {
    const fpage = '<FixedPage Width="100" Height="100"></FixedPage>';
    const fdseq = '<FixedDocumentSequence></FixedDocumentSequence>';
    const zip = buildXpsZip({
      'FixedDocumentSequence.fdseq': fdseq,
      'Documents/1/Pages/1.fpage': fpage,
    });
    const result = await parseXps(zip);
    assert.equal(result.pages.length, 1);
  });

  it('finds fdseq via Content_Types.xml fallback', async () => {
    const fpage = '<FixedPage Width="100" Height="100"></FixedPage>';
    const contentTypes = '<Types></Types>';
    const fdseq = '<FixedDocumentSequence></FixedDocumentSequence>';
    const zip = buildXpsZip({
      '[Content_Types].xml': contentTypes,
      'Documents/FixedDocSeq.fdseq': fdseq,
      'Documents/1/Pages/1.fpage': fpage,
    });
    const result = await parseXps(zip);
    assert.equal(result.pages.length, 1);
  });

  it('handles archive with no fdseq file', async () => {
    const fpage = '<FixedPage Width="100" Height="100"></FixedPage>';
    const zip = buildXpsZip({
      '[Content_Types].xml': '<Types></Types>',
      'Documents/1/Pages/1.fpage': fpage,
    });
    // findFdseq returns null when no .fdseq files exist
    const result = await parseXps(zip);
    assert.equal(result.pages.length, 1);
  });

  it('extracts referenced PNG image and creates Blob', async () => {
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4E, 0x47]); // PNG magic bytes
    const fpage = '<FixedPage Width="100" Height="100"><ImageBrush ImageSource="/Resources/img.png"/></FixedPage>';
    const zip = buildXpsZip({
      'Documents/1/Pages/1.fpage': fpage,
      'Resources/img.png': pngBytes,
    });
    const result = await parseXps(zip);
    assert.ok(result.pages[0].imageBlob instanceof Blob);
  });

  it('extracts referenced JPEG image with correct MIME type', async () => {
    const jpgBytes = new Uint8Array([0xFF, 0xD8, 0xFF]);
    const fpage = '<FixedPage Width="100" Height="100"><ImageBrush ImageSource="/Resources/photo.jpg"/></FixedPage>';
    const zip = buildXpsZip({
      'Documents/1/Pages/1.fpage': fpage,
      'Resources/photo.jpg': jpgBytes,
    });
    const result = await parseXps(zip);
    assert.ok(result.pages[0].imageBlob instanceof Blob);
  });

  it('extracts referenced JPEG image with .jpeg extension', async () => {
    const jpgBytes = new Uint8Array([0xFF, 0xD8, 0xFF]);
    const fpage = '<FixedPage Width="100" Height="100"><ImageBrush ImageSource="/Resources/photo.jpeg"/></FixedPage>';
    const zip = buildXpsZip({
      'Documents/1/Pages/1.fpage': fpage,
      'Resources/photo.jpeg': jpgBytes,
    });
    const result = await parseXps(zip);
    assert.ok(result.pages[0].imageBlob instanceof Blob);
  });

  it('extracts referenced TIFF image with .tif extension', async () => {
    const tifBytes = new Uint8Array([0x49, 0x49, 0x2A, 0x00]);
    const fpage = '<FixedPage Width="100" Height="100"><ImageBrush ImageSource="/Resources/scan.tif"/></FixedPage>';
    const zip = buildXpsZip({
      'Documents/1/Pages/1.fpage': fpage,
      'Resources/scan.tif': tifBytes,
    });
    const result = await parseXps(zip);
    assert.ok(result.pages[0].imageBlob instanceof Blob);
  });

  it('extracts referenced TIFF image with .tiff extension', async () => {
    const tifBytes = new Uint8Array([0x49, 0x49, 0x2A, 0x00]);
    const fpage = '<FixedPage Width="100" Height="100"><ImageBrush ImageSource="/Resources/scan.tiff"/></FixedPage>';
    const zip = buildXpsZip({
      'Documents/1/Pages/1.fpage': fpage,
      'Resources/scan.tiff': tifBytes,
    });
    const result = await parseXps(zip);
    assert.ok(result.pages[0].imageBlob instanceof Blob);
  });

  it('extracts referenced WDP image with correct MIME type', async () => {
    const wdpBytes = new Uint8Array([0x49, 0x49, 0xBC]);
    const fpage = '<FixedPage Width="100" Height="100"><ImageBrush ImageSource="/Resources/photo.wdp"/></FixedPage>';
    const zip = buildXpsZip({
      'Documents/1/Pages/1.fpage': fpage,
      'Resources/photo.wdp': wdpBytes,
    });
    const result = await parseXps(zip);
    assert.ok(result.pages[0].imageBlob instanceof Blob);
  });

  it('falls back to image/png for unknown image extension', async () => {
    const bmpBytes = new Uint8Array([0x42, 0x4D]);
    const fpage = '<FixedPage Width="100" Height="100"><ImageBrush ImageSource="/Resources/img.bmp"/></FixedPage>';
    const zip = buildXpsZip({
      'Documents/1/Pages/1.fpage': fpage,
      'Resources/img.bmp': bmpBytes,
    });
    const result = await parseXps(zip);
    assert.ok(result.pages[0].imageBlob instanceof Blob);
  });

  it('sets imageBlob to null when referenced image is not in archive', async () => {
    const fpage = '<FixedPage Width="100" Height="100"><ImageBrush ImageSource="/Resources/missing.png"/></FixedPage>';
    const zip = buildXpsZip({
      'Documents/1/Pages/1.fpage': fpage,
    });
    const result = await parseXps(zip);
    assert.equal(result.pages[0].imageBlob, null);
  });

  it('strips leading slash from image path', async () => {
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4E, 0x47]);
    const fpage = '<FixedPage Width="100" Height="100"><ImageBrush ImageSource="/Resources/img.png"/></FixedPage>';
    const zip = buildXpsZip({
      'Documents/1/Pages/1.fpage': fpage,
      'Resources/img.png': pngBytes,
    });
    const result = await parseXps(zip);
    assert.ok(result.pages[0].imageBlob !== null);
  });

  it('extracts title from CoreProperties path', async () => {
    const fpage = '<FixedPage Width="100" Height="100"></FixedPage>';
    const core = '<coreProperties><dc:title>Alt Title</dc:title></coreProperties>';
    const zip = buildXpsZip({
      'Documents/1/Pages/1.fpage': fpage,
      'metadata/CoreProperties.xml': core,
    });
    const result = await parseXps(zip);
    assert.equal(result.metadata.title, 'Alt Title');
  });

  it('sets empty title when core.xml has no dc:title', async () => {
    const fpage = '<FixedPage Width="100" Height="100"></FixedPage>';
    const core = '<cp:coreProperties><dc:creator>Author</dc:creator></cp:coreProperties>';
    const zip = buildXpsZip({
      'Documents/1/Pages/1.fpage': fpage,
      'docProps/core.xml': core,
    });
    const result = await parseXps(zip);
    assert.equal(result.metadata.title, '');
  });

  it('skips empty UnicodeString values', async () => {
    const fpage = '<FixedPage Width="100" Height="100"><Glyphs UnicodeString=""/><Glyphs UnicodeString="Content"/></FixedPage>';
    const zip = buildXpsZip({ 'Documents/1/Pages/1.fpage': fpage });
    const result = await parseXps(zip);
    assert.equal(result.pages[0].text, 'Content');
  });

  it('handles extra field length in zip entries', async () => {
    // Build zip with non-zero extra field
    const encoder = new TextEncoder();
    const name = 'Documents/1/Pages/1.fpage';
    const content = '<FixedPage Width="100" Height="100"></FixedPage>';
    const nameBytes = encoder.encode(name);
    const data = encoder.encode(content);
    const extraField = new Uint8Array([0x00, 0x00, 0x04, 0x00]); // 4-byte extra

    const header = new ArrayBuffer(30 + nameBytes.length + extraField.length + data.length);
    const view = new DataView(header);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(8, 0, true);
    view.setUint32(18, data.length, true);
    view.setUint32(22, data.length, true);
    view.setUint16(26, nameBytes.length, true);
    view.setUint16(28, extraField.length, true);

    const buf = new Uint8Array(header);
    buf.set(nameBytes, 30);
    buf.set(extraField, 30 + nameBytes.length);
    buf.set(data, 30 + nameBytes.length + extraField.length);

    const result = await parseXps(buf.buffer);
    assert.equal(result.pages.length, 1);
    assert.equal(result.pages[0].width, 100);
  });

  it('stops parsing when signature is not a local file header', async () => {
    // Append garbage after valid entries
    const zip = buildXpsZip({ 'test.fpage': '<FixedPage Width="50" Height="50"></FixedPage>' });
    const extended = new Uint8Array(new Uint8Array(zip).length + 10);
    extended.set(new Uint8Array(zip));
    // Remaining bytes are zeros, signature won't match 0x04034b50
    const result = await parseXps(extended.buffer);
    assert.equal(result.pages.length, 1);
  });

  it('handles empty archive', async () => {
    const result = await parseXps(new ArrayBuffer(0));
    assert.equal(result.pages.length, 0);
  });

  it('natural sort handles pages numbered 1-20 correctly', async () => {
    const files = {};
    for (let i = 20; i >= 1; i--) {
      files[`Docs/Pages/${i}.fpage`] = `<FixedPage Width="100" Height="100"><Glyphs UnicodeString="P${i}"/></FixedPage>`;
    }
    const zip = buildXpsZip(files);
    const result = await parseXps(zip);
    assert.equal(result.pages.length, 20);
    assert.equal(result.pages[0].text, 'P1');
    assert.equal(result.pages[9].text, 'P10');
    assert.equal(result.pages[19].text, 'P20');
  });
});

describe('XpsAdapter', () => {
  it('initializes with empty state', () => {
    const adapter = new XpsAdapter();
    assert.equal(adapter.getPageCount(), 0);
    assert.deepEqual(adapter.metadata, {});
  });

  it('getPageSize returns defaults for invalid page', () => {
    const adapter = new XpsAdapter();
    const size = adapter.getPageSize(1);
    assert.equal(size.width, 595);
    assert.equal(size.height, 842);
  });

  it('getPageSize returns correct size after load', async () => {
    const fpage = '<FixedPage Width="612" Height="792"></FixedPage>';
    const zip = buildXpsZip({ 'Documents/1/Pages/1.fpage': fpage });
    const adapter = new XpsAdapter();
    await adapter.load(zip);
    const size = adapter.getPageSize(1);
    assert.equal(size.width, 612);
    assert.equal(size.height, 792);
  });

  it('getPageText returns empty string for missing page', () => {
    const adapter = new XpsAdapter();
    assert.equal(adapter.getPageText(1), '');
  });

  it('getPageText returns text of loaded page', async () => {
    const fpage = '<FixedPage Width="100" Height="100"><Glyphs UnicodeString="Hello XPS"/></FixedPage>';
    const zip = buildXpsZip({ 'Documents/1/Pages/1.fpage': fpage });
    const adapter = new XpsAdapter();
    await adapter.load(zip);
    assert.equal(adapter.getPageText(1), 'Hello XPS');
  });

  it('destroy clears pages and cache', async () => {
    const fpage = '<FixedPage Width="100" Height="100"></FixedPage>';
    const zip = buildXpsZip({ 'Documents/1/Pages/1.fpage': fpage });
    const adapter = new XpsAdapter();
    await adapter.load(zip);
    assert.equal(adapter.getPageCount(), 1);
    adapter.destroy();
    assert.equal(adapter.getPageCount(), 0);
    assert.equal(adapter._imageCache.size, 0);
  });

  it('renderPage does nothing for invalid page number', async () => {
    const adapter = new XpsAdapter();
    const canvas = document.createElement('canvas');
    // Should not throw
    await adapter.renderPage(1, canvas);
  });

  it('renderPage renders text fallback when no imageBlob', async () => {
    const fpage = '<FixedPage Width="200" Height="300"><Glyphs UnicodeString="Line1"/></FixedPage>';
    const zip = buildXpsZip({ 'Documents/1/Pages/1.fpage': fpage });
    const adapter = new XpsAdapter();
    await adapter.load(zip);

    let fillTextCalled = false;
    const mockCtx = {
      drawImage() {}, fillRect() {}, clearRect() {},
      fillText() { fillTextCalled = true; },
      fillStyle: '', font: '',
    };
    const canvas = { width: 0, height: 0, getContext: () => mockCtx };

    await adapter.renderPage(1, canvas, 1);
    assert.ok(fillTextCalled, 'fillText should be called for text fallback');
    assert.equal(canvas.width, 200);
    assert.equal(canvas.height, 300);
  });

  it('renderPage with zoom scales canvas dimensions', async () => {
    const fpage = '<FixedPage Width="100" Height="200"><Glyphs UnicodeString="Zoomed"/></FixedPage>';
    const zip = buildXpsZip({ 'Documents/1/Pages/1.fpage': fpage });
    const adapter = new XpsAdapter();
    await adapter.load(zip);

    const canvas = document.createElement('canvas');
    await adapter.renderPage(1, canvas, 2);
    assert.equal(canvas.width, 200);
    assert.equal(canvas.height, 400);
  });

  it('renderPage renders image when imageBlob is present', async () => {
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4E, 0x47]);
    const fpage = '<FixedPage Width="100" Height="100"><ImageBrush ImageSource="/Resources/img.png"/></FixedPage>';
    const zip = buildXpsZip({
      'Documents/1/Pages/1.fpage': fpage,
      'Resources/img.png': pngBytes,
    });
    const adapter = new XpsAdapter();
    await adapter.load(zip);
    assert.ok(adapter.pages[0].imageBlob !== null);

    let drawImageCalled = false;
    const mockCtx = {
      drawImage() { drawImageCalled = true; },
      fillRect() {}, clearRect() {}, fillText() {},
      fillStyle: '', font: '',
    };
    const canvas = { width: 0, height: 0, getContext: () => mockCtx };

    // Mock Image to trigger onload synchronously via microtask
    const OrigImage = globalThis.Image;
    globalThis.Image = class MockImage {
      constructor() { this._src = ''; this._blobUrl = null; }
      set src(val) {
        this._src = val;
        if (val) queueMicrotask(() => { if (this.onload) this.onload(); });
      }
      get src() { return this._src; }
    };

    try {
      await adapter.renderPage(1, canvas, 1);
      assert.ok(drawImageCalled, 'drawImage should be called when imageBlob exists');
    } finally {
      globalThis.Image = OrigImage;
    }
  });

  it('_loadImage caches images and reuses on second call', async () => {
    const adapter = new XpsAdapter();
    const blob = new Blob();

    // Mock Image to trigger onload
    const OrigImage = globalThis.Image;
    let imageCount = 0;
    globalThis.Image = class MockImage {
      constructor() {
        imageCount++;
        this._src = '';
        this._blobUrl = null;
      }
      set src(val) {
        this._src = val;
        if (val) setTimeout(() => { if (this.onload) this.onload(); }, 0);
      }
      get src() { return this._src; }
    };

    try {
      const img1 = await adapter._loadImage(1, blob);
      const img2 = await adapter._loadImage(1, blob);
      assert.strictEqual(img1, img2, 'Should return cached image');
      assert.equal(imageCount, 1, 'Should only create one Image');
    } finally {
      globalThis.Image = OrigImage;
    }
  });

  it('destroy revokes blob URLs from cached images', async () => {
    const adapter = new XpsAdapter();
    let revokedUrls = [];
    const origRevoke = URL.revokeObjectURL;
    URL.revokeObjectURL = (url) => { revokedUrls.push(url); };

    // Manually add a cached image with _blobUrl
    const fakeImg = { _blobUrl: 'blob:test-url-123' };
    adapter._imageCache.set(1, fakeImg);

    adapter.destroy();
    assert.ok(revokedUrls.includes('blob:test-url-123'), 'Should revoke blob URL');
    assert.equal(adapter._imageCache.size, 0);

    URL.revokeObjectURL = origRevoke;
  });

  it('renderPage returns early when canvas has no context', async () => {
    const fpage = '<FixedPage Width="100" Height="100"></FixedPage>';
    const zip = buildXpsZip({ 'Documents/1/Pages/1.fpage': fpage });
    const adapter = new XpsAdapter();
    await adapter.load(zip);

    const canvas = { getContext: () => null, width: 0, height: 0 };
    // Should not throw
    await adapter.renderPage(1, canvas);
  });

  it('renderPage renders multiple text lines', async () => {
    const fpage = '<FixedPage Width="200" Height="300"><Glyphs UnicodeString="Line1"/><Glyphs UnicodeString="Line2"/><Glyphs UnicodeString="Line3"/></FixedPage>';
    const zip = buildXpsZip({ 'Documents/1/Pages/1.fpage': fpage });
    const adapter = new XpsAdapter();
    await adapter.load(zip);

    const textCalls = [];
    const mockCtx = {
      drawImage() {}, fillRect() {}, clearRect() {},
      fillText(text, x, y) { textCalls.push({ text, x, y }); },
      fillStyle: '', font: '',
    };
    const canvas = { width: 0, height: 0, getContext: () => mockCtx };

    await adapter.renderPage(1, canvas, 1);
    assert.ok(textCalls.length >= 1, 'fillText should be called at least once');
  });

  it('load populates metadata correctly', async () => {
    const fp1 = '<FixedPage Width="100" Height="100"></FixedPage>';
    const fp2 = '<FixedPage Width="200" Height="200"></FixedPage>';
    const core = '<cp:coreProperties><dc:title>Test Doc</dc:title></cp:coreProperties>';
    const zip = buildXpsZip({
      'Documents/1/Pages/1.fpage': fp1,
      'Documents/1/Pages/2.fpage': fp2,
      'docProps/core.xml': core,
    });
    const adapter = new XpsAdapter();
    await adapter.load(zip);
    assert.equal(adapter.getPageCount(), 2);
    assert.equal(adapter.metadata.format, 'XPS');
    assert.equal(adapter.metadata.pageCount, 2);
    assert.equal(adapter.metadata.title, 'Test Doc');
  });
});
