import './setup-dom.js';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildChapters,
  escapeXml,
  buildContentOpf,
  buildTocNcx,
  generateUuid,
} from '../../app/modules/pdf-to-epub.js';

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
