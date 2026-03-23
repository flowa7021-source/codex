import './setup-dom.js';
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { parseXps, XpsAdapter } from '../../app/modules/xps-adapter.js';

// Helper: build a minimal valid XPS zip (store method, no compression)
function buildXpsZip(files) {
  const entries = [];
  let offset = 0;
  const encoder = new TextEncoder();

  for (const [name, content] of Object.entries(files)) {
    const nameBytes = encoder.encode(name);
    const data = typeof content === 'string' ? encoder.encode(content) : content;

    // Local file header (30 bytes + name + data)
    const header = new ArrayBuffer(30 + nameBytes.length + data.length);
    const view = new DataView(header);
    view.setUint32(0, 0x04034b50, true);    // signature
    view.setUint16(4, 20, true);             // version needed
    view.setUint16(8, 0, true);              // compression = store
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
});
