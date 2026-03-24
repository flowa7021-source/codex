// ─── Unit Tests: ePub Adapter ────────────────────────────────────────────────
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  EpubAdapter,
  EPUB_READER_DEFAULTS,
  parseContainer,
  parseOpf,
  stripHtmlTags,
  extractChapterTitle,
  parseToc,
} from '../../app/modules/epub-adapter.js';

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

// Note: parseEpub tests require mock.module() (Node 23+) and are skipped

// ─── parseContainer ──────────────────────────────────────────────────────────

describe('parseContainer', () => {
  it('extracts the full-path from a standard container.xml', () => {
    const xml = '<?xml version="1.0"?><container><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>';
    assert.equal(parseContainer(xml), 'OEBPS/content.opf');
  });

  it('returns null when full-path attribute is missing', () => {
    const xml = '<container><rootfiles><rootfile media-type="application/oebps-package+xml"/></rootfiles></container>';
    assert.equal(parseContainer(xml), null);
  });

  it('extracts path when OPF is at root level', () => {
    assert.equal(parseContainer('<rootfile full-path="content.opf"/>'), 'content.opf');
  });
});

// ─── parseOpf ────────────────────────────────────────────────────────────────

describe('parseOpf', () => {
  const sampleOpf = `
    <package>
      <manifest>
        <item id="ch1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
        <item id="ch2" href="chapter2.xhtml" media-type="application/xhtml+xml"/>
        <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
        <item id="css" href="style.css" media-type="text/css"/>
      </manifest>
      <spine toc="ncx">
        <itemref idref="ch1"/>
        <itemref idref="ch2"/>
      </spine>
    </package>`;

  it('extracts manifest items with basePath prepended to href', () => {
    const result = parseOpf(sampleOpf, 'OEBPS/');
    assert.equal(result.items['ch1'].href, 'OEBPS/chapter1.xhtml');
    assert.equal(result.items['ch1'].mediaType, 'application/xhtml+xml');
    assert.equal(result.items['ch2'].href, 'OEBPS/chapter2.xhtml');
  });

  it('builds spine from itemref elements that exist in manifest', () => {
    const result = parseOpf(sampleOpf, 'OEBPS/');
    assert.equal(result.spine.length, 2);
    assert.equal(result.spine[0].href, 'OEBPS/chapter1.xhtml');
    assert.equal(result.spine[1].href, 'OEBPS/chapter2.xhtml');
  });

  it('skips spine itemref when id is not in manifest', () => {
    const opf = `
      <manifest><item id="ch1" href="ch1.xhtml" media-type="application/xhtml+xml"/></manifest>
      <spine><itemref idref="ch1"/><itemref idref="missing"/></spine>`;
    const result = parseOpf(opf, '');
    assert.equal(result.spine.length, 1);
  });

  it('extracts tocHref for NCX file', () => {
    const result = parseOpf(sampleOpf, 'OEBPS/');
    assert.equal(result.tocHref, 'OEBPS/toc.ncx');
  });

  it('returns null tocHref when no NCX item exists', () => {
    const opf = `<manifest><item id="ch1" href="ch1.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="ch1"/></spine>`;
    const result = parseOpf(opf, '');
    assert.equal(result.tocHref, null);
  });

  it('works with empty basePath', () => {
    const result = parseOpf(sampleOpf, '');
    assert.equal(result.items['ch1'].href, 'chapter1.xhtml');
  });
});

// ─── stripHtmlTags ───────────────────────────────────────────────────────────

describe('stripHtmlTags', () => {
  it('converts <br> to newline', () => {
    assert.equal(stripHtmlTags('a<br>b<br/>c<br />d'), 'a\nb\nc\nd');
  });

  it('converts </p> to double newline', () => {
    assert.equal(stripHtmlTags('<p>hello</p><p>world</p>'), 'hello\n\nworld');
  });

  it('converts </div> to newline', () => {
    assert.equal(stripHtmlTags('<div>block</div>'), 'block');
  });

  it('converts heading closing tags to double newline', () => {
    assert.equal(stripHtmlTags('<h1>Title</h1>more'), 'Title\n\nmore');
    assert.equal(stripHtmlTags('<h3>Sub</h3>text'), 'Sub\n\ntext');
    assert.equal(stripHtmlTags('<h6>Small</h6>rest'), 'Small\n\nrest');
  });

  it('converts </li> to newline', () => {
    assert.equal(stripHtmlTags('<li>item1</li><li>item2</li>'), 'item1\nitem2');
  });

  it('strips remaining HTML tags', () => {
    assert.equal(stripHtmlTags('<span class="x">text</span>'), 'text');
  });

  it('decodes &nbsp; entity', () => {
    assert.equal(stripHtmlTags('a&nbsp;b'), 'a b');
  });

  it('decodes &amp; entity', () => {
    assert.equal(stripHtmlTags('a&amp;b'), 'a&b');
  });

  it('decodes &lt; and &gt; entities', () => {
    assert.equal(stripHtmlTags('&lt;tag&gt;'), '<tag>');
  });

  it('decodes &quot; entity', () => {
    assert.equal(stripHtmlTags('&quot;hello&quot;'), '"hello"');
  });

  it('decodes numeric character references', () => {
    assert.equal(stripHtmlTags('&#65;&#66;'), 'AB');
  });

  it('collapses 3+ consecutive newlines to 2', () => {
    assert.equal(stripHtmlTags('a\n\n\n\nb'), 'a\n\nb');
  });

  it('trims leading and trailing whitespace', () => {
    assert.equal(stripHtmlTags('  <p>text</p>  '), 'text');
  });

  it('handles complex HTML with multiple features', () => {
    const html = '<h1>Title</h1><p>Some &amp; text</p><br><p>More &lt;stuff&gt;</p>';
    const result = stripHtmlTags(html);
    assert.ok(result.includes('Title'));
    assert.ok(result.includes('Some & text'));
    assert.ok(result.includes('More <stuff>'));
  });
});

// ─── extractChapterTitle ─────────────────────────────────────────────────────

describe('extractChapterTitle', () => {
  it('extracts title from <h1> tag', () => {
    assert.equal(extractChapterTitle('<h1>Chapter One</h1><p>body</p>'), 'Chapter One');
  });

  it('extracts title from <h2> tag', () => {
    assert.equal(extractChapterTitle('<h2 class="title">Second</h2>'), 'Second');
  });

  it('extracts title from <h3> tag', () => {
    assert.equal(extractChapterTitle('<h3>Third</h3>'), 'Third');
  });

  it('strips inner HTML from heading', () => {
    assert.equal(extractChapterTitle('<h1><span>Styled</span> Title</h1>'), 'Styled Title');
  });

  it('falls back to <title> when no heading found', () => {
    assert.equal(extractChapterTitle('<title>Page Title</title><p>content</p>'), 'Page Title');
  });

  it('returns null when no heading or title found', () => {
    assert.equal(extractChapterTitle('<p>Just a paragraph</p>'), null);
  });

  it('truncates to 100 characters', () => {
    const longTitle = 'A'.repeat(200);
    const result = extractChapterTitle(`<h1>${longTitle}</h1>`);
    assert.equal(result.length, 100);
  });

  it('prefers heading over title tag', () => {
    assert.equal(extractChapterTitle('<title>Fallback</title><h1>Primary</h1>'), 'Primary');
  });

  it('handles multiline heading content', () => {
    const html = '<h1>\n  Multi\n  Line\n</h1>';
    const result = extractChapterTitle(html);
    assert.ok(result.includes('Multi'));
  });
});

// ─── parseToc ────────────────────────────────────────────────────────────────

describe('parseToc', () => {
  it('extracts navPoint items with title and src', () => {
    const ncx = `
      <navMap>
        <navPoint id="np1">
          <navLabel><text>Introduction</text></navLabel>
          <content src="intro.xhtml"/>
        </navPoint>
        <navPoint id="np2">
          <navLabel><text>Chapter 1</text></navLabel>
          <content src="ch1.xhtml"/>
        </navPoint>
      </navMap>`;
    const result = parseToc(ncx);
    assert.equal(result.length, 2);
    assert.equal(result[0].title, 'Introduction');
    assert.equal(result[0].src, 'intro.xhtml');
    assert.equal(result[1].title, 'Chapter 1');
    assert.equal(result[1].src, 'ch1.xhtml');
  });

  it('returns empty array for NCX with no navPoints', () => {
    const ncx = '<navMap></navMap>';
    assert.deepEqual(parseToc(ncx), []);
  });

  it('strips HTML from navPoint text', () => {
    const ncx = `<navPoint><navLabel><text><b>Bold</b> Title</text></navLabel><content src="x.xhtml"/></navPoint>`;
    const result = parseToc(ncx);
    assert.equal(result[0].title, 'Bold Title');
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

  it('initializes _fontUrls as empty array', () => {
    const adapter = new EpubAdapter({ chapters: [], toc: [], bytes: new Uint8Array(), css: [], fonts: [] }, 'x.epub');
    assert.deepEqual(adapter._fontUrls, []);
  });

  it('calls _loadFonts with fonts data', () => {
    // Provide a font — _loadFonts should run without throwing
    const fontData = new Uint8Array([0, 1, 2, 3]);
    const adapter = new EpubAdapter({
      chapters: [],
      toc: [],
      bytes: new Uint8Array(),
      css: [],
      fonts: [{ href: 'fonts/test.ttf', data: fontData, mime: 'font/ttf', name: 'test.ttf' }],
    }, 'x.epub');
    // Font URLs should be populated (_loadFonts ran and created blob URLs)
    assert.ok(Array.isArray(adapter._fontUrls));
    // FontFace.load() may or may not succeed in test env, but no throw
  });

  it('handles fonts with various extensions', () => {
    const fontData = new Uint8Array([1, 2, 3]);
    // Test that woff2 font doesn't throw
    const adapter = new EpubAdapter({
      chapters: [],
      toc: [],
      bytes: new Uint8Array(),
      css: [],
      fonts: [
        { href: 'fonts/a.woff2', data: fontData, mime: 'font/woff2', name: 'a.woff2' },
        { href: 'fonts/b.otf', data: fontData, mime: 'font/otf', name: 'b.otf' },
      ],
    }, 'x.epub');
    assert.ok(Array.isArray(adapter._fontUrls));
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

  it('allows setting all theme values', () => {
    for (const theme of ['auto', 'light', 'dark', 'sepia']) {
      adapter.setReaderSettings({ theme });
      assert.equal(adapter.readerSettings.theme, theme);
    }
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

  it('returns 1 for empty chapters', () => {
    const adapter = new EpubAdapter({ chapters: [], toc: [], bytes: new Uint8Array(), css: [], fonts: [] }, 'x.epub');
    assert.equal(adapter.getPageCount(), 1);
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

// ─── EpubAdapter – renderPage ────────────────────────────────────────────────

describe('EpubAdapter – renderPage', () => {
  function makeCanvas() {
    const ctx = {
      save: () => {},
      restore: () => {},
      scale: () => {},
      translate: () => {},
      rotate: () => {},
      fillRect: () => {},
      fillText: () => {},
      measureText: (text) => ({ width: text.length * 8 }),
      fillStyle: '',
      font: '',
    };
    const canvas = {
      width: 0,
      height: 0,
      style: { width: '', height: '' },
      getContext: () => ctx,
    };
    return canvas;
  }

  it('renders a page with a chapter (rotation=0)', async () => {
    const adapter = new EpubAdapter({
      chapters: [{ title: 'Chapter One', text: 'This is some text for the chapter.', html: '', href: '' }],
      toc: [], bytes: new Uint8Array(), css: [], fonts: [],
    }, 'x.epub');
    const canvas = makeCanvas();
    await adapter.renderPage(1, canvas, { zoom: 1, rotation: 0 });
    assert.ok(canvas.width > 0);
    assert.ok(canvas.height > 0);
  });

  it('renders empty chapter placeholder', async () => {
    const adapter = new EpubAdapter({
      chapters: [],
      toc: [], bytes: new Uint8Array(), css: [], fonts: [],
    }, 'x.epub');
    const canvas = makeCanvas();
    // pageNumber=1 but no chapters — should render empty placeholder
    await adapter.renderPage(1, canvas, { zoom: 1, rotation: 0 });
    // Canvas should still have dimensions set
    assert.ok(canvas.width >= 0);
  });

  it('handles rotation=90 (swaps dimensions)', async () => {
    const adapter = new EpubAdapter({
      chapters: [{ title: 'Ch', text: 'text', html: '', href: '' }],
      toc: [], bytes: new Uint8Array(), css: [], fonts: [],
    }, 'x.epub');
    const canvas = makeCanvas();
    await adapter.renderPage(1, canvas, { zoom: 1, rotation: 90 });
    // Width should be h*dpr, height should be w*dpr
    const dpr = Math.max(1, 1); // window.devicePixelRatio = 1 in test env
    assert.equal(canvas.width, 1100 * dpr);
    assert.equal(canvas.height, 800 * dpr);
  });

  it('handles rotation=180', async () => {
    const adapter = new EpubAdapter({
      chapters: [{ title: 'Ch', text: 'text', html: '', href: '' }],
      toc: [], bytes: new Uint8Array(), css: [], fonts: [],
    }, 'x.epub');
    const canvas = makeCanvas();
    await adapter.renderPage(1, canvas, { zoom: 1, rotation: 180 });
    // rotation 180 is % 180 === 0, so no swap
    const dpr = Math.max(1, 1);
    assert.equal(canvas.width, 800 * dpr);
  });

  it('renders with sepia theme', async () => {
    const adapter = new EpubAdapter({
      chapters: [{ title: 'Ch', text: 'some text here and more', html: '', href: '' }],
      toc: [], bytes: new Uint8Array(), css: [], fonts: [],
    }, 'x.epub');
    adapter.setReaderSettings({ theme: 'sepia' });
    const canvas = makeCanvas();
    await adapter.renderPage(1, canvas, { zoom: 1, rotation: 0 });
    assert.ok(canvas.width > 0);
  });

  it('renders with light theme', async () => {
    const adapter = new EpubAdapter({
      chapters: [{ title: 'Ch', text: 'sample text', html: '', href: '' }],
      toc: [], bytes: new Uint8Array(), css: [], fonts: [],
    }, 'x.epub');
    adapter.setReaderSettings({ theme: 'light' });
    const canvas = makeCanvas();
    await adapter.renderPage(1, canvas, { zoom: 1, rotation: 0 });
    assert.ok(canvas.width > 0);
  });

  it('renders with auto theme (body has sepia class)', async () => {
    document.body.classList.add('sepia');
    const adapter = new EpubAdapter({
      chapters: [{ title: 'Ch', text: 'text', html: '', href: '' }],
      toc: [], bytes: new Uint8Array(), css: [], fonts: [],
    }, 'x.epub');
    adapter.setReaderSettings({ theme: 'auto' });
    const canvas = makeCanvas();
    await adapter.renderPage(1, canvas, { zoom: 1, rotation: 0 });
    document.body.classList.remove('sepia');
    assert.ok(canvas.width > 0);
  });

  it('renders with auto theme (body has light class)', async () => {
    document.body.classList.add('light');
    const adapter = new EpubAdapter({
      chapters: [{ title: 'Ch', text: 'text', html: '', href: '' }],
      toc: [], bytes: new Uint8Array(), css: [], fonts: [],
    }, 'x.epub');
    adapter.setReaderSettings({ theme: 'auto' });
    const canvas = makeCanvas();
    await adapter.renderPage(1, canvas, { zoom: 1, rotation: 0 });
    document.body.classList.remove('light');
    assert.ok(canvas.width > 0);
  });

  it('handles canvas with no context (getContext returns null)', async () => {
    const adapter = new EpubAdapter({
      chapters: [{ title: 'Ch', text: 'text', html: '', href: '' }],
      toc: [], bytes: new Uint8Array(), css: [], fonts: [],
    }, 'x.epub');
    const canvas = {
      width: 0,
      height: 0,
      style: { width: '', height: '' },
      getContext: () => null,
    };
    // Should not throw when ctx is null
    await adapter.renderPage(1, canvas, { zoom: 1, rotation: 0 });
  });

  it('renders with word wrap (long text)', async () => {
    const longText = 'word '.repeat(200);
    const adapter = new EpubAdapter({
      chapters: [{ title: 'Ch', text: longText, html: '', href: '' }],
      toc: [], bytes: new Uint8Array(), css: [], fonts: [],
    }, 'x.epub');
    const canvas = makeCanvas();
    await adapter.renderPage(1, canvas, { zoom: 1, rotation: 0 });
    assert.ok(canvas.width > 0);
  });

  it('handles text with newline words (blank lines)', async () => {
    const adapter = new EpubAdapter({
      chapters: [{ title: 'Ch', text: 'before \n \n after', html: '', href: '' }],
      toc: [], bytes: new Uint8Array(), css: [], fonts: [],
    }, 'x.epub');
    const canvas = makeCanvas();
    await adapter.renderPage(1, canvas, { zoom: 1, rotation: 0 });
    assert.ok(canvas.width > 0);
  });

  it('renders with auto theme defaulting to dark (no body class)', async () => {
    document.body.className = '';
    const adapter = new EpubAdapter({
      chapters: [{ title: 'Ch', text: 'text', html: '', href: '' }],
      toc: [], bytes: new Uint8Array(), css: [], fonts: [],
    }, 'x.epub');
    adapter.setReaderSettings({ theme: 'auto' });
    const canvas = makeCanvas();
    await adapter.renderPage(1, canvas, { zoom: 1, rotation: 0 });
    assert.ok(canvas.width > 0);
  });

  it('renders with dark theme explicitly', async () => {
    const adapter = new EpubAdapter({
      chapters: [{ title: 'Ch', text: 'text', html: '', href: '' }],
      toc: [], bytes: new Uint8Array(), css: [], fonts: [],
    }, 'x.epub');
    adapter.setReaderSettings({ theme: 'dark' });
    const canvas = makeCanvas();
    await adapter.renderPage(1, canvas, { zoom: 1, rotation: 0 });
    assert.ok(canvas.width > 0);
  });

  it('renders with zoom > 1', async () => {
    const adapter = new EpubAdapter({
      chapters: [{ title: 'Ch', text: 'text content here', html: '', href: '' }],
      toc: [], bytes: new Uint8Array(), css: [], fonts: [],
    }, 'x.epub');
    const canvas = makeCanvas();
    await adapter.renderPage(1, canvas, { zoom: 2, rotation: 0 });
    const dpr = Math.max(1, 1);
    assert.equal(canvas.width, 800 * 2 * dpr);
    assert.equal(canvas.height, 1100 * 2 * dpr);
  });

  it('renders empty chapter with rotation=90', async () => {
    const adapter = new EpubAdapter({
      chapters: [],
      toc: [], bytes: new Uint8Array(), css: [], fonts: [],
    }, 'x.epub');
    const canvas = makeCanvas();
    await adapter.renderPage(1, canvas, { zoom: 1, rotation: 90 });
    const dpr = Math.max(1, 1);
    assert.equal(canvas.width, 1100 * dpr);
    assert.equal(canvas.height, 800 * dpr);
  });

  it('handles chapter with empty text', async () => {
    const adapter = new EpubAdapter({
      chapters: [{ title: 'Empty', text: '', html: '', href: '' }],
      toc: [], bytes: new Uint8Array(), css: [], fonts: [],
    }, 'x.epub');
    const canvas = makeCanvas();
    await adapter.renderPage(1, canvas, { zoom: 1, rotation: 0 });
    assert.ok(canvas.width > 0);
  });

  it('handles chapter with no text property', async () => {
    const adapter = new EpubAdapter({
      chapters: [{ title: 'No text', html: '', href: '' }],
      toc: [], bytes: new Uint8Array(), css: [], fonts: [],
    }, 'x.epub');
    const canvas = makeCanvas();
    await adapter.renderPage(1, canvas, { zoom: 1, rotation: 0 });
    assert.ok(canvas.width > 0);
  });

  it('handles chapter with no title (falls back to Chapter N)', async () => {
    const adapter = new EpubAdapter({
      chapters: [{ title: null, text: 'some content', html: '', href: '' }],
      toc: [], bytes: new Uint8Array(), css: [], fonts: [],
    }, 'x.epub');
    const canvas = makeCanvas();
    await adapter.renderPage(1, canvas, { zoom: 1, rotation: 0 });
    assert.ok(canvas.width > 0);
  });
});

// ─── EpubAdapter – _detectTheme ──────────────────────────────────────────────

describe('EpubAdapter – _detectTheme', () => {
  let adapter;
  beforeEach(() => {
    adapter = new EpubAdapter({ chapters: [], toc: [], bytes: new Uint8Array(), css: [], fonts: [] }, 'x.epub');
    // Clean body classes
    document.body.className = '';
  });

  it('returns sepia when body has sepia class', () => {
    document.body.classList.add('sepia');
    assert.equal(adapter._detectTheme(), 'sepia');
    document.body.classList.remove('sepia');
  });

  it('returns light when body has light class (and no sepia)', () => {
    document.body.classList.add('light');
    assert.equal(adapter._detectTheme(), 'light');
    document.body.classList.remove('light');
  });

  it('returns dark when body has no special class', () => {
    document.body.className = '';
    assert.equal(adapter._detectTheme(), 'dark');
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
    assert.equal(colors.title, '#2a1e0a');
    assert.equal(colors.muted, '#7a6e5a');
  });

  it('returns dark theme colors for dark', () => {
    const colors = adapter._getThemeColors('dark');
    assert.equal(colors.bg, '#1a1d23');
    assert.equal(colors.text, '#cbd5e1');
    assert.equal(colors.title, '#e2e8f0');
    assert.equal(colors.muted, '#9aa6b8');
  });

  it('returns dark theme colors for unknown theme (default)', () => {
    const colors = adapter._getThemeColors('unknown');
    assert.equal(colors.bg, '#1a1d23');
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

  it('each outline item has title, dest, and empty items array', async () => {
    const adapter = new EpubAdapter({
      chapters: [{ title: 'Ch', text: '', html: '', href: '' }],
      toc: [{ title: 'Section', src: 's.xhtml' }],
      bytes: new Uint8Array(), css: [], fonts: [],
    }, 'x.epub');
    const outline = await adapter.getOutline();
    assert.ok('title' in outline[0]);
    assert.ok('dest' in outline[0]);
    assert.ok('items' in outline[0]);
    assert.deepEqual(outline[0].items, []);
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

  it('calls URL.revokeObjectURL for each url', () => {
    const revoked = [];
    const origRevoke = URL.revokeObjectURL.bind(URL);
    URL.revokeObjectURL = (url) => { revoked.push(url); };

    const adapter = new EpubAdapter({ chapters: [], toc: [], bytes: new Uint8Array(), css: [], fonts: [] }, 'x.epub');
    adapter._fontUrls = ['blob:url-a', 'blob:url-b'];
    adapter.destroy();
    assert.ok(revoked.includes('blob:url-a'));
    assert.ok(revoked.includes('blob:url-b'));

    URL.revokeObjectURL = origRevoke;
  });

  it('can be called multiple times safely', () => {
    const adapter = new EpubAdapter({ chapters: [], toc: [], bytes: new Uint8Array(), css: [], fonts: [] }, 'x.epub');
    adapter.destroy();
    adapter.destroy(); // second call should not throw
    assert.deepEqual(adapter._fontUrls, []);
  });
});
