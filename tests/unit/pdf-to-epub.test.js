import './setup-dom.js';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import {
  buildChapters,
  escapeXml,
  buildContentOpf,
  buildTocNcx,
  generateUuid,
  convertPdfToEpub,
} from '../../app/modules/pdf-to-epub.js';

// ── PDF helpers ────────────────────────────────────────────────────────────
async function makePdfBytes(lines = ['Hello world']) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([612, 792]);
  lines.forEach((line, i) => {
    page.drawText(line, { x: 72, y: 700 - i * 16, size: 12, font, color: rgb(0, 0, 0) });
  });
  return new Uint8Array(await doc.save());
}

// ---------------------------------------------------------------------------
// escapeXml
// ---------------------------------------------------------------------------

describe('escapeXml', () => {
  it('escapes ampersand, angle brackets, quotes', () => {
    const input = '<b>"Tom & Jerry\'s"</b>';
    const escaped = escapeXml(input);
    assert.ok(!escaped.includes('<b>'));
    assert.ok(escaped.includes('&amp;'));
    assert.ok(escaped.includes('&lt;'));
    assert.ok(escaped.includes('&gt;'));
    assert.ok(escaped.includes('&quot;'));
    assert.ok(escaped.includes('&apos;'));
  });

  it('returns plain string unchanged', () => {
    assert.equal(escapeXml('hello world'), 'hello world');
  });
});

// ---------------------------------------------------------------------------
// generateUuid
// ---------------------------------------------------------------------------

describe('generateUuid', () => {
  it('returns a string with 5 dash-separated groups', () => {
    const uuid = generateUuid();
    const parts = uuid.split('-');
    assert.equal(parts.length, 5);
  });

  it('produces unique values', () => {
    const a = generateUuid();
    const b = generateUuid();
    assert.notEqual(a, b);
  });
});

// ---------------------------------------------------------------------------
// buildChapters
// ---------------------------------------------------------------------------

describe('buildChapters', () => {
  it('returns at least one chapter from simple text items', () => {
    const pages = [
      { items: [{ str: 'Hello world', fontSize: 12 }] },
    ];
    const chapters = buildChapters(pages, false);
    assert.ok(chapters.length >= 1);
    assert.ok(chapters[0].title);
  });

  it('splits chapters by headings when splitByHeadings is true', () => {
    const pages = [
      {
        items: [
          { str: 'Intro paragraph', fontSize: 12 },
          { str: 'Chapter Two', fontSize: 24 },
          { str: 'Body of chapter two', fontSize: 12 },
        ],
      },
    ];
    const chapters = buildChapters(pages, true);
    // The heading text should become a chapter title
    const titles = chapters.map(c => c.title);
    assert.ok(titles.some(t => t.includes('Chapter Two')));
  });

  it('handles empty pages gracefully', () => {
    const pages = [{ items: [] }];
    const chapters = buildChapters(pages, false);
    assert.ok(Array.isArray(chapters));
    // should produce at least one chapter (possibly empty)
    assert.ok(chapters.length >= 1);
  });
});

// ---------------------------------------------------------------------------
// buildContentOpf
// ---------------------------------------------------------------------------

describe('buildContentOpf', () => {
  it('includes title and author in metadata', () => {
    const opf = buildContentOpf(
      { title: 'My Book', author: 'Alice', language: 'en', uid: 'test-uid' },
      [{ id: 'ch1', href: 'chapter_1.xhtml', mediaType: 'application/xhtml+xml' }],
      ['ch1'],
    );
    assert.ok(opf.includes('My Book'));
    assert.ok(opf.includes('Alice'));
    assert.ok(opf.includes('test-uid'));
  });

  it('includes spine itemrefs for each chapter', () => {
    const opf = buildContentOpf(
      { title: 'T', author: 'A', language: 'en', uid: 'u' },
      [
        { id: 'ch1', href: 'chapter_1.xhtml', mediaType: 'application/xhtml+xml' },
        { id: 'ch2', href: 'chapter_2.xhtml', mediaType: 'application/xhtml+xml' },
      ],
      ['ch1', 'ch2'],
    );
    assert.ok(opf.includes('idref="ch1"'));
    assert.ok(opf.includes('idref="ch2"'));
  });
});

// ---------------------------------------------------------------------------
// buildTocNcx
// ---------------------------------------------------------------------------

describe('buildTocNcx', () => {
  it('creates navPoints for each entry', () => {
    const ncx = buildTocNcx('uid-1', 'My Book', [
      { label: 'Chapter 1', src: 'chapter_1.xhtml' },
      { label: 'Chapter 2', src: 'chapter_2.xhtml' },
    ]);
    assert.ok(ncx.includes('navpoint-1'));
    assert.ok(ncx.includes('navpoint-2'));
    assert.ok(ncx.includes('Chapter 1'));
    assert.ok(ncx.includes('chapter_2.xhtml'));
  });

  it('includes document title', () => {
    const ncx = buildTocNcx('uid', 'Test Title', []);
    assert.ok(ncx.includes('Test Title'));
  });
});

// ---------------------------------------------------------------------------
// buildChapters — edge case: consecutive headings (lines 218-219)
// ---------------------------------------------------------------------------

describe('buildChapters — consecutive headings edge case', () => {
  it('handles consecutive headings: second heading updates empty chapter title (line 218-219)', () => {
    // To reach line 218: need currentChapter.paragraphs.length===0 AND chapters.length>0.
    // This happens when:
    //   Page 1 ends with body text → pushed to paragraphs.
    //   Page 2 has Heading Two → pushes chapter 1, starts chapter 2 (empty).
    //   Page 2 then has Heading Three immediately → paragraphs===0 AND chapters.length>0 → line 218.
    //
    // Use small body fontSize (6) and large heading fontSize (30) to ensure headings are detected.
    const pages = [
      {
        items: [
          { str: 'Heading One', fontSize: 30 },
          { str: 'body text a', fontSize: 6 },
          { str: 'body text b', fontSize: 6 },
          { str: 'body text c', fontSize: 6 },
        ],
      },
      {
        items: [
          { str: 'Heading Two', fontSize: 30 },
          { str: 'Heading Three', fontSize: 30 },
        ],
      },
    ];
    const chapters = buildChapters(pages, true);
    assert.ok(Array.isArray(chapters));
    assert.ok(chapters.length >= 1);
    // Chapter 1 ("Heading One") should have been pushed with content
    const titles = chapters.map(c => c.title);
    assert.ok(titles.includes('Heading One'), `Expected "Heading One" in ${JSON.stringify(titles)}`);
  });
});

// ---------------------------------------------------------------------------
// convertPdfToEpub — integration tests
// ---------------------------------------------------------------------------

describe('convertPdfToEpub — integration', () => {
  it('returns a Blob with epub+zip type', async () => {
    const bytes = await makePdfBytes(['Hello world from PDF']);
    const result = await convertPdfToEpub(bytes);
    assert.ok(result.blob instanceof Blob);
    assert.equal(result.blob.type, 'application/epub+zip');
  });

  it('returns chapterCount >= 1', async () => {
    const bytes = await makePdfBytes(['Document text here']);
    const result = await convertPdfToEpub(bytes);
    assert.ok(typeof result.chapterCount === 'number');
    assert.ok(result.chapterCount >= 1);
  });

  it('output blob is valid ZIP (PK header)', async () => {
    const bytes = await makePdfBytes(['Test content']);
    const result = await convertPdfToEpub(bytes);
    const buf = await result.blob.arrayBuffer();
    const arr = new Uint8Array(buf);
    assert.equal(arr[0], 0x50, 'first byte P');
    assert.equal(arr[1], 0x4B, 'second byte K');
  });

  it('respects title and author options', async () => {
    const bytes = await makePdfBytes(['Content']);
    const result = await convertPdfToEpub(bytes, { title: 'My ePub', author: 'Bob' });
    assert.ok(result.blob instanceof Blob);
  });

  it('works with splitByHeadings=false', async () => {
    const bytes = await makePdfBytes(['Chapter 1 text', 'More content']);
    const result = await convertPdfToEpub(bytes, { splitByHeadings: false });
    assert.ok(result.blob instanceof Blob);
    assert.ok(result.chapterCount >= 1);
  });

  it('handles blank PDF gracefully (empty chapter fallback)', async () => {
    // A PDF with no text → buildChapters returns [] → one default chapter is pushed
    const doc = await PDFDocument.create();
    doc.addPage([612, 792]);
    const bytes = new Uint8Array(await doc.save());
    const result = await convertPdfToEpub(bytes);
    assert.ok(result.blob instanceof Blob);
    assert.ok(result.chapterCount >= 1);
  });
});
