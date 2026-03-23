// ─── Unit Tests: ePub Adapter ────────────────────────────────────────────────
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// epub-adapter.js imports zip-utils which uses fflate — mock before import
// We test the pure functions by importing the module and mocking zip-utils
// at the module level.

// Since parseEpub depends on zip-utils (browser-only), we test the class and
// pure helpers by constructing EpubAdapter directly with mock data.

import { EpubAdapter, EPUB_READER_DEFAULTS } from '../../app/modules/epub-adapter.js';

// ─── EPUB_READER_DEFAULTS ────────────────────────────────────────────────────

describe('EPUB_READER_DEFAULTS', () => {
  it('has expected default values', () => {
    assert.equal(EPUB_READER_DEFAULTS.fontSize, 16);
    assert.equal(EPUB_READER_DEFAULTS.lineHeight, 1.6);
    assert.equal(EPUB_READER_DEFAULTS.fontFamily, 'serif');
    assert.equal(EPUB_READER_DEFAULTS.marginH, 40);
    assert.equal(EPUB_READER_DEFAULTS.theme, 'auto');
  });

  it('is a plain object', () => {
    assert.equal(typeof EPUB_READER_DEFAULTS, 'object');
    assert.ok(!Array.isArray(EPUB_READER_DEFAULTS));
  });
});

// ─── EpubAdapter constructor ─────────────────────────────────────────────────

describe('EpubAdapter – constructor', () => {
  it('stores chapters, toc, bytes and sets type to epub', () => {
    const chapters = [{ title: 'Ch1', text: 'Hello', html: '<p>Hello</p>', href: 'ch1.xhtml' }];
    const toc = [{ title: 'Chapter 1', src: 'ch1.xhtml' }];
    const bytes = new Uint8Array([1, 2, 3]);
    const adapter = new EpubAdapter({ chapters, toc, bytes, css: [], fonts: [] }, 'test.epub');

    assert.equal(adapter.type, 'epub');
    assert.equal(adapter.fileName, 'test.epub');
    assert.deepEqual(adapter.chapters, chapters);
    assert.deepEqual(adapter.toc, toc);
    assert.equal(adapter.epubBytes, bytes);
    assert.equal(adapter.pageCount, 1);
  });

  it('sets pageCount to chapters.length or 1 if empty', () => {
    const adapter = new EpubAdapter({ chapters: [], toc: [], bytes: new Uint8Array(), css: [], fonts: [] }, 'empty.epub');
    assert.equal(adapter.pageCount, 1);

    const adapter2 = new EpubAdapter({
      chapters: [{ title: 'A', text: 'a' }, { title: 'B', text: 'b' }, { title: 'C', text: 'c' }],
      toc: [], bytes: new Uint8Array(), css: [], fonts: [],
    }, 'three.epub');
    assert.equal(adapter2.pageCount, 3);
  });

  it('defaults css and fonts to empty arrays if not provided', () => {
    const adapter = new EpubAdapter({ chapters: [], toc: [], bytes: new Uint8Array() }, 'no-extras.epub');
    assert.deepEqual(adapter.css, []);
    assert.deepEqual(adapter.fonts, []);
  });

  it('copies EPUB_READER_DEFAULTS into readerSettings', () => {
    const adapter = new EpubAdapter({ chapters: [], toc: [], bytes: new Uint8Array(), css: [], fonts: [] }, 'x.epub');
    assert.deepEqual(adapter.readerSettings, { ...EPUB_READER_DEFAULTS });
    // Mutation of adapter settings should not affect defaults
    adapter.readerSettings.fontSize = 99;
    assert.equal(EPUB_READER_DEFAULTS.fontSize, 16);
  });
});

// ─── EpubAdapter – setReaderSettings ─────────────────────────────────────────

describe('EpubAdapter – setReaderSettings', () => {
  let adapter;
  beforeEach(() => {
    adapter = new EpubAdapter({ chapters: [], toc: [], bytes: new Uint8Array(), css: [], fonts: [] }, 'x.epub');
  });

  it('merges partial settings into readerSettings', () => {
    adapter.setReaderSettings({ fontSize: 24, theme: 'sepia' });
    assert.equal(adapter.readerSettings.fontSize, 24);
    assert.equal(adapter.readerSettings.theme, 'sepia');
    // Other defaults preserved
    assert.equal(adapter.readerSettings.lineHeight, 1.6);
    assert.equal(adapter.readerSettings.fontFamily, 'serif');
  });

  it('overwrites existing custom settings', () => {
    adapter.setReaderSettings({ fontSize: 20 });
    adapter.setReaderSettings({ fontSize: 30 });
    assert.equal(adapter.readerSettings.fontSize, 30);
  });
});

// ─── EpubAdapter – getPageCount ──────────────────────────────────────────────

describe('EpubAdapter – getPageCount', () => {
  it('returns the pageCount property', () => {
    const adapter = new EpubAdapter({
      chapters: [{ title: 'A', text: 'a' }, { title: 'B', text: 'b' }],
      toc: [], bytes: new Uint8Array(), css: [], fonts: [],
    }, 'x.epub');
    assert.equal(adapter.getPageCount(), 2);
  });
});

// ─── EpubAdapter – getPageViewport ───────────────────────────────────────────

describe('EpubAdapter – getPageViewport', () => {
  let adapter;
  beforeEach(() => {
    adapter = new EpubAdapter({ chapters: [], toc: [], bytes: new Uint8Array(), css: [], fonts: [] }, 'x.epub');
  });

  it('returns scaled dimensions for rotation=0', async () => {
    const vp = await adapter.getPageViewport(1, 1.5, 0);
    assert.equal(vp.width, 800 * 1.5);
    assert.equal(vp.height, 1100 * 1.5);
  });

  it('returns scaled dimensions for rotation=360 (multiple of 180)', async () => {
    const vp = await adapter.getPageViewport(1, 2, 360);
    assert.equal(vp.width, 800 * 2);
    assert.equal(vp.height, 1100 * 2);
  });

  it('swaps width and height for rotation=90', async () => {
    const vp = await adapter.getPageViewport(1, 1, 90);
    assert.equal(vp.width, 1100);
    assert.equal(vp.height, 800);
  });

  it('swaps width and height for rotation=270', async () => {
    const vp = await adapter.getPageViewport(1, 2, 270);
    assert.equal(vp.width, 1100 * 2);
    assert.equal(vp.height, 800 * 2);
  });

  it('does not swap for rotation=180', async () => {
    const vp = await adapter.getPageViewport(1, 1, 180);
    assert.equal(vp.width, 800);
    assert.equal(vp.height, 1100);
  });
});

// ─── EpubAdapter – getText ───────────────────────────────────────────────────

describe('EpubAdapter – getText', () => {
  it('returns text of the specified chapter (1-indexed)', async () => {
    const adapter = new EpubAdapter({
      chapters: [
        { title: 'Ch1', text: 'First chapter text', html: '', href: '' },
        { title: 'Ch2', text: 'Second chapter text', html: '', href: '' },
      ],
      toc: [], bytes: new Uint8Array(), css: [], fonts: [],
    }, 'x.epub');

    assert.equal(await adapter.getText(1), 'First chapter text');
    assert.equal(await adapter.getText(2), 'Second chapter text');
  });

  it('returns empty string for out-of-range page', async () => {
    const adapter = new EpubAdapter({
      chapters: [{ title: 'Ch1', text: 'Some text', html: '', href: '' }],
      toc: [], bytes: new Uint8Array(), css: [], fonts: [],
    }, 'x.epub');

    assert.equal(await adapter.getText(0), '');
    assert.equal(await adapter.getText(5), '');
  });

  it('returns empty string when chapter has no text', async () => {
    const adapter = new EpubAdapter({
      chapters: [{ title: 'Ch1', html: '', href: '' }],
      toc: [], bytes: new Uint8Array(), css: [], fonts: [],
    }, 'x.epub');

    assert.equal(await adapter.getText(1), '');
  });
});

// ─── EpubAdapter – getOutline ────────────────────────────────────────────────

describe('EpubAdapter – getOutline', () => {
  it('returns toc-based outline when toc is present', async () => {
    const adapter = new EpubAdapter({
      chapters: [{ title: 'Ch1', text: '', html: '', href: '' }],
      toc: [
        { title: 'Introduction', src: 'intro.xhtml' },
        { title: 'Main Content', src: 'main.xhtml' },
      ],
      bytes: new Uint8Array(), css: [], fonts: [],
    }, 'x.epub');

    const outline = await adapter.getOutline();
    assert.equal(outline.length, 2);
    assert.equal(outline[0].title, 'Introduction');
    assert.equal(outline[0].dest, 1);
    assert.deepEqual(outline[0].items, []);
    assert.equal(outline[1].title, 'Main Content');
    assert.equal(outline[1].dest, 2);
  });

  it('falls back to chapter titles when toc is empty', async () => {
    const adapter = new EpubAdapter({
      chapters: [
        { title: 'Chapter One', text: '', html: '', href: '' },
        { title: null, text: '', html: '', href: '' },
      ],
      toc: [],
      bytes: new Uint8Array(), css: [], fonts: [],
    }, 'x.epub');

    const outline = await adapter.getOutline();
    assert.equal(outline.length, 2);
    assert.equal(outline[0].title, 'Chapter One');
    assert.equal(outline[1].title, 'Chapter 2');
  });
});

// ─── EpubAdapter – resolveDestToPage ─────────────────────────────────────────

describe('EpubAdapter – resolveDestToPage', () => {
  let adapter;
  beforeEach(() => {
    adapter = new EpubAdapter({
      chapters: [{ title: 'A', text: '' }, { title: 'B', text: '' }, { title: 'C', text: '' }],
      toc: [], bytes: new Uint8Array(), css: [], fonts: [],
    }, 'x.epub');
  });

  it('returns the page number for valid integer dest', async () => {
    assert.equal(await adapter.resolveDestToPage(1), 1);
    assert.equal(await adapter.resolveDestToPage(3), 3);
  });

  it('returns the page number for string dest that parses to valid integer', async () => {
    assert.equal(await adapter.resolveDestToPage('2'), 2);
  });

  it('returns null for dest=0 (out of range)', async () => {
    assert.equal(await adapter.resolveDestToPage(0), null);
  });

  it('returns null for dest exceeding page count', async () => {
    assert.equal(await adapter.resolveDestToPage(4), null);
  });

  it('returns null for non-numeric dest', async () => {
    assert.equal(await adapter.resolveDestToPage('abc'), null);
  });

  it('returns null for fractional dest', async () => {
    assert.equal(await adapter.resolveDestToPage(1.5), null);
  });

  it('returns null for negative dest', async () => {
    assert.equal(await adapter.resolveDestToPage(-1), null);
  });
});

// ─── EpubAdapter – destroy ───────────────────────────────────────────────────

describe('EpubAdapter – destroy', () => {
  it('clears _fontUrls array', () => {
    const adapter = new EpubAdapter({ chapters: [], toc: [], bytes: new Uint8Array(), css: [], fonts: [] }, 'x.epub');
    // Simulate some font URLs
    adapter._fontUrls = ['blob:url1', 'blob:url2'];
    adapter.destroy();
    assert.deepEqual(adapter._fontUrls, []);
  });
});

// ─── EpubAdapter – _getThemeColors ───────────────────────────────────────────

describe('EpubAdapter – _getThemeColors', () => {
  let adapter;
  beforeEach(() => {
    adapter = new EpubAdapter({ chapters: [], toc: [], bytes: new Uint8Array(), css: [], fonts: [] }, 'x.epub');
  });

  it('returns light theme colors', () => {
    const colors = adapter._getThemeColors('light');
    assert.equal(colors.bg, '#fffef8');
    assert.equal(colors.text, '#333');
    assert.equal(colors.title, '#1a1a1a');
    assert.equal(colors.muted, '#666');
  });

  it('returns sepia theme colors', () => {
    const colors = adapter._getThemeColors('sepia');
    assert.equal(colors.bg, '#f5ead0');
    assert.equal(colors.text, '#3a2e1a');
  });

  it('returns dark theme colors for dark', () => {
    const colors = adapter._getThemeColors('dark');
    assert.equal(colors.bg, '#1a1d23');
    assert.equal(colors.text, '#cbd5e1');
  });

  it('returns dark theme colors for unknown theme (default)', () => {
    const colors = adapter._getThemeColors('unknown');
    assert.equal(colors.bg, '#1a1d23');
  });
});
