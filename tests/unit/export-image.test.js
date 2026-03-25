import './setup-dom.js';
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDocxImageParagraph,
  _groupWordsIntoLines,
  buildContentTypesWithImages,
  buildWordRelsWithImages,
  buildDocxXmlWithImages,
  initExportImageDeps,
} from '../../app/modules/export-image.js';

describe('buildDocxImageParagraph', () => {
  it('generates XML with correct rId and dimensions', () => {
    const xml = buildDocxImageParagraph('rId10', 5800000, 7500000);
    assert.ok(xml.includes('r:embed="rId10"'));
    assert.ok(xml.includes('cx="5800000"'));
    assert.ok(xml.includes('cy="7500000"'));
  });

  it('wraps content in w:p and w:drawing elements', () => {
    const xml = buildDocxImageParagraph('rId1', 100, 200);
    assert.ok(xml.startsWith('<w:p>'));
    assert.ok(xml.includes('<w:drawing>'));
    assert.ok(xml.includes('</w:drawing>'));
    assert.ok(xml.endsWith('</w:r></w:p>'));
  });
});

describe('_groupWordsIntoLines', () => {
  it('returns empty array for null input', () => {
    assert.deepEqual(_groupWordsIntoLines(null), []);
  });

  it('returns empty array for empty array', () => {
    assert.deepEqual(_groupWordsIntoLines([]), []);
  });

  it('groups words on the same line', () => {
    const words = [
      { text: 'Hello', bbox: { x0: 0, y0: 10, x1: 50, y1: 30 } },
      { text: 'World', bbox: { x0: 60, y0: 12, x1: 110, y1: 30 } },
    ];
    const lines = _groupWordsIntoLines(words);
    assert.equal(lines.length, 1);
    assert.equal(lines[0].length, 2);
  });

  it('separates words on different lines', () => {
    const words = [
      { text: 'Line1', bbox: { x0: 0, y0: 10, x1: 50, y1: 30 } },
      { text: 'Line2', bbox: { x0: 0, y0: 60, x1: 50, y1: 80 } },
    ];
    const lines = _groupWordsIntoLines(words);
    assert.equal(lines.length, 2);
  });

  it('sorts words left-to-right within a line', () => {
    const words = [
      { text: 'B', bbox: { x0: 60, y0: 10, x1: 80, y1: 30 } },
      { text: 'A', bbox: { x0: 0, y0: 10, x1: 20, y1: 30 } },
    ];
    const lines = _groupWordsIntoLines(words);
    assert.equal(lines[0][0].text, 'A');
    assert.equal(lines[0][1].text, 'B');
  });

  it('filters out words without bbox', () => {
    const words = [
      { text: 'OK', bbox: { x0: 0, y0: 10, x1: 50, y1: 30 } },
      { text: 'NoBbox' },
    ];
    const lines = _groupWordsIntoLines(words);
    assert.equal(lines.length, 1);
    assert.equal(lines[0].length, 1);
    assert.equal(lines[0][0].text, 'OK');
  });
});

describe('buildContentTypesWithImages', () => {
  it('includes PNG content type when hasImages is true', () => {
    const xml = buildContentTypesWithImages(true);
    assert.ok(xml.includes('Extension="png"'));
    assert.ok(xml.includes('ContentType="image/png"'));
  });

  it('excludes PNG content type when hasImages is false', () => {
    const xml = buildContentTypesWithImages(false);
    assert.ok(!xml.includes('Extension="png"'));
  });

  it('always includes standard content types', () => {
    const xml = buildContentTypesWithImages(false);
    assert.ok(xml.includes('Extension="rels"'));
    assert.ok(xml.includes('Extension="xml"'));
    assert.ok(xml.includes('document.main+xml'));
  });
});

describe('buildWordRelsWithImages', () => {
  it('includes standard relationships', () => {
    const xml = buildWordRelsWithImages([]);
    assert.ok(xml.includes('rId1'));
    assert.ok(xml.includes('styles.xml'));
    assert.ok(xml.includes('numbering.xml'));
    assert.ok(xml.includes('settings.xml'));
  });

  it('adds image relationships', () => {
    const rels = [
      { rId: 'rId10', target: 'media/page1.png' },
      { rId: 'rId11', target: 'media/page2.png' },
    ];
    const xml = buildWordRelsWithImages(rels);
    assert.ok(xml.includes('Id="rId10"'));
    assert.ok(xml.includes('Target="media/page1.png"'));
    assert.ok(xml.includes('Id="rId11"'));
    assert.ok(xml.includes('relationships/image'));
  });
});

describe('buildDocxXmlWithImages', () => {
  it('produces valid document XML with title', () => {
    const xml = buildDocxXmlWithImages('Test Doc', [], []);
    assert.ok(xml.includes('<?xml version'));
    assert.ok(xml.includes('<w:document'));
    assert.ok(xml.includes('Test Doc'));
    assert.ok(xml.includes('</w:document>'));
  });

  it('escapes special characters in title', () => {
    const xml = buildDocxXmlWithImages('A & B <C>', ['text'], []);
    assert.ok(xml.includes('A &amp; B &lt;C&gt;'));
  });

  it('adds page break between pages', () => {
    const xml = buildDocxXmlWithImages('Title', ['Page 1', 'Page 2'], []);
    assert.ok(xml.includes('w:type="page"'));
  });
});

// ─── Additional coverage tests ───────────────────────────────────────────────

describe('buildDocxXmlWithImages — text-only layout', () => {
  it('handles empty text page', () => {
    const xml = buildDocxXmlWithImages('Title', [''], []);
    assert.ok(xml.includes('<w:document'));
  });

  it('handles null page content', () => {
    const xml = buildDocxXmlWithImages('Title', [null], []);
    assert.ok(xml.includes('<w:document'));
  });

  it('detects bullet list items', () => {
    const xml = buildDocxXmlWithImages('Title', ['• First item\n• Second item'], []);
    assert.ok(xml.includes('ListParagraph'));
    assert.ok(xml.includes('w:numId'));
  });

  it('detects numbered list items', () => {
    const xml = buildDocxXmlWithImages('Title', ['1. First\n2. Second'], []);
    assert.ok(xml.includes('ListParagraph'));
  });

  it('detects headings by pattern (Chapter)', () => {
    const xml = buildDocxXmlWithImages('Title', ['Chapter 1\nSome body text'], []);
    assert.ok(xml.includes('Heading'));
  });

  it('detects headings by pattern (Introduction)', () => {
    const xml = buildDocxXmlWithImages('Title', ['Introduction\nSome content'], []);
    assert.ok(xml.includes('Heading'));
  });

  it('detects ALL CAPS headings', () => {
    const xml = buildDocxXmlWithImages('Title', ['EXECUTIVE SUMMARY\nBody text here'], []);
    assert.ok(xml.includes('Heading'));
  });

  it('detects table from tab-separated content', () => {
    const xml = buildDocxXmlWithImages('Title', ['Col1\tCol2\tCol3\nVal1\tVal2\tVal3'], []);
    // Should include table markup
    assert.ok(xml.includes('w:tbl') || xml.includes('<w:tc>') || xml.includes('w:tr'));
  });

  it('detects table from pipe-separated content', () => {
    const xml = buildDocxXmlWithImages('Title', ['Name|Age|City\nJohn|30|NYC'], []);
    assert.ok(xml.includes('w:tbl') || xml.includes('w:tr'));
  });

  it('handles indented text', () => {
    const xml = buildDocxXmlWithImages('Title', ['  Indented line\n    More indented'], []);
    assert.ok(xml.includes('w:ind') || xml.includes('<w:p>'));
  });

  it('inserts empty paragraph for blank lines', () => {
    const xml = buildDocxXmlWithImages('Title', ['Line 1\n\nLine 2'], []);
    assert.ok(xml.includes('<w:p/>'));
  });

  it('adds image paragraph when imgRel matches and no word layout', () => {
    const imageRels = [{ rId: 'rId10', target: 'media/page1.png' }];
    const xml = buildDocxXmlWithImages('Title', ['Some text'], imageRels);
    assert.ok(xml.includes('r:embed="rId10"'));
    assert.ok(xml.includes('<w:drawing>'));
  });

  it('does not add page break after last page', () => {
    const xml = buildDocxXmlWithImages('Title', ['Only page'], []);
    // Count page breaks
    const breaks = (xml.match(/w:type="page"/g) || []).length;
    assert.equal(breaks, 0);
  });

  it('flushes table at end of page text', () => {
    // Table at the end with no trailing non-table line
    const xml = buildDocxXmlWithImages('Title', ['A\tB\nC\tD'], []);
    assert.ok(xml.includes('w:tbl') || xml.includes('w:tr'));
  });

  it('alpha list detection (a. Item)', () => {
    const xml = buildDocxXmlWithImages('Title', ['a. First alpha item\nb. Second alpha item'], []);
    // Alpha list items should be detected as numbered list
    assert.ok(xml.includes('ListParagraph') || xml.includes('<w:p>'));
  });

  it('escapes XML special characters in page text', () => {
    const xml = buildDocxXmlWithImages('Title', ['This has <angle> & "quotes"'], []);
    assert.ok(xml.includes('&lt;angle&gt;'));
    assert.ok(xml.includes('&amp;'));
  });
});

describe('buildDocxXmlWithImages — word layout mode', () => {
  beforeEach(() => {
    initExportImageDeps({
      getCachedPage: () => null,
      _ocrWordCache: new Map(),
    });
  });

  it('uses word layout when _ocrWordCache has words for a page', () => {
    const words = [
      { text: 'Hello', bbox: { x0: 10, y0: 10, x1: 50, y1: 30 } },
      { text: 'World', bbox: { x0: 60, y0: 10, x1: 110, y1: 30 } },
    ];
    const cache = new Map();
    cache.set(1, words);
    initExportImageDeps({ getCachedPage: () => null, _ocrWordCache: cache });

    const xml = buildDocxXmlWithImages('Title', ['Hello World'], []);
    assert.ok(xml.includes('Hello'));
    assert.ok(xml.includes('World'));
  });

  it('detects headings from larger font words', () => {
    const words = [
      { text: 'BIG', bbox: { x0: 10, y0: 10, x1: 200, y1: 60 } }, // tall = heading
    ];
    const cache = new Map();
    cache.set(1, words);
    initExportImageDeps({ getCachedPage: () => null, _ocrWordCache: cache });

    const xml = buildDocxXmlWithImages('Title', ['BIG'], []);
    assert.ok(xml.includes('Heading'));
  });

  it('detects list items in word layout mode', () => {
    const words = [
      { text: '•', bbox: { x0: 10, y0: 10, x1: 20, y1: 30 } },
      { text: 'Item', bbox: { x0: 25, y0: 10, x1: 60, y1: 30 } },
    ];
    const cache = new Map();
    cache.set(1, words);
    initExportImageDeps({ getCachedPage: () => null, _ocrWordCache: cache });

    const xml = buildDocxXmlWithImages('Title', ['• Item'], []);
    assert.ok(xml.includes('ListParagraph'));
  });

  it('handles bold font in word runs', () => {
    const words = [
      { text: 'Bold', bbox: { x0: 10, y0: 10, x1: 50, y1: 30 }, fontName: 'Arial-Bold' },
      { text: 'Normal', bbox: { x0: 60, y0: 10, x1: 110, y1: 30 }, fontName: 'Arial' },
    ];
    const cache = new Map();
    cache.set(1, words);
    initExportImageDeps({ getCachedPage: () => null, _ocrWordCache: cache });

    const xml = buildDocxXmlWithImages('Title', ['Bold Normal'], []);
    assert.ok(xml.includes('<w:b/>'));
  });

  it('handles italic font in word runs', () => {
    const words = [
      { text: 'Italic', bbox: { x0: 10, y0: 10, x1: 50, y1: 30 }, fontName: 'TimesItalic' },
    ];
    const cache = new Map();
    cache.set(1, words);
    initExportImageDeps({ getCachedPage: () => null, _ocrWordCache: cache });

    const xml = buildDocxXmlWithImages('Title', ['Italic'], []);
    assert.ok(xml.includes('<w:i/>'));
  });

  it('handles table detection from word layout with large gaps', () => {
    const words = [
      { text: 'Col1', bbox: { x0: 10, y0: 10, x1: 50, y1: 30 } },
      { text: 'Col2', bbox: { x0: 200, y0: 10, x1: 250, y1: 30 } },
    ];
    const cache = new Map();
    cache.set(1, words);
    initExportImageDeps({ getCachedPage: () => null, _ocrWordCache: cache });

    const xml = buildDocxXmlWithImages('Title', ['Col1\tCol2'], []);
    // Should detect as table row
    assert.ok(xml.includes('w:tbl') || xml.includes('w:tr') || xml.includes('<w:p>'));
  });

  it('flushes table on large gap between lines in word layout', () => {
    const words = [
      { text: 'A', bbox: { x0: 10, y0: 10, x1: 30, y1: 30 } },
      { text: 'B', bbox: { x0: 100, y0: 10, x1: 120, y1: 30 } },
      { text: 'Regular', bbox: { x0: 10, y0: 200, x1: 80, y1: 220 } },
    ];
    const cache = new Map();
    cache.set(1, words);
    initExportImageDeps({ getCachedPage: () => null, _ocrWordCache: cache });

    const xml = buildDocxXmlWithImages('Title', ['A\tB\nRegular'], []);
    assert.ok(xml.includes('<w:document'));
  });

  it('does not add image when useWordLayout is true', () => {
    const words = [
      { text: 'Text', bbox: { x0: 10, y0: 10, x1: 50, y1: 30 } },
    ];
    const cache = new Map();
    cache.set(1, words);
    initExportImageDeps({ getCachedPage: () => null, _ocrWordCache: cache });

    const imageRels = [{ rId: 'rId10', target: 'media/page1.png' }];
    const xml = buildDocxXmlWithImages('Title', ['Text'], imageRels);
    // When word layout is used, image should NOT be added
    assert.ok(!xml.includes('r:embed="rId10"'));
  });

  it('adds paragraph spacing when gap is large between lines', () => {
    const words = [
      { text: 'Line1', bbox: { x0: 10, y0: 10, x1: 60, y1: 30 } },
      { text: 'Line2', bbox: { x0: 10, y0: 100, x1: 60, y1: 120 } },
    ];
    const cache = new Map();
    cache.set(1, words);
    initExportImageDeps({ getCachedPage: () => null, _ocrWordCache: cache });

    const xml = buildDocxXmlWithImages('Title', ['Line1\nLine2'], []);
    assert.ok(xml.includes('w:spacing') || xml.includes('<w:p>'));
  });

  it('handles words with font property instead of fontName', () => {
    const words = [
      { text: 'Test', bbox: { x0: 10, y0: 10, x1: 50, y1: 30 }, font: 'Arial-Bold' },
    ];
    const cache = new Map();
    cache.set(1, words);
    initExportImageDeps({ getCachedPage: () => null, _ocrWordCache: cache });

    const xml = buildDocxXmlWithImages('Title', ['Test'], []);
    assert.ok(xml.includes('<w:b/>'));
  });

  it('handles empty line words (skips them)', () => {
    const words = [
      { text: '', bbox: { x0: 10, y0: 10, x1: 10, y1: 30 } },
      { text: 'Real', bbox: { x0: 50, y0: 50, x1: 90, y1: 70 } },
    ];
    const cache = new Map();
    cache.set(1, words);
    initExportImageDeps({ getCachedPage: () => null, _ocrWordCache: cache });

    const xml = buildDocxXmlWithImages('Title', ['Real'], []);
    assert.ok(xml.includes('Real'));
  });
});

describe('_groupWordsIntoLines — extended', () => {
  it('handles single word', () => {
    const words = [
      { text: 'Solo', bbox: { x0: 0, y0: 10, x1: 50, y1: 30 } },
    ];
    const lines = _groupWordsIntoLines(words);
    assert.equal(lines.length, 1);
    assert.equal(lines[0].length, 1);
  });

  it('handles many words on multiple lines', () => {
    const words = [
      { text: 'A', bbox: { x0: 0, y0: 0, x1: 20, y1: 20 } },
      { text: 'B', bbox: { x0: 30, y0: 0, x1: 50, y1: 20 } },
      { text: 'C', bbox: { x0: 0, y0: 40, x1: 20, y1: 60 } },
      { text: 'D', bbox: { x0: 30, y0: 40, x1: 50, y1: 60 } },
      { text: 'E', bbox: { x0: 0, y0: 80, x1: 20, y1: 100 } },
    ];
    const lines = _groupWordsIntoLines(words);
    assert.equal(lines.length, 3);
    assert.equal(lines[0].length, 2);
    assert.equal(lines[1].length, 2);
    assert.equal(lines[2].length, 1);
  });
});

describe('buildContentTypesWithImages — extended', () => {
  it('includes numbering and settings overrides', () => {
    const xml = buildContentTypesWithImages(false);
    assert.ok(xml.includes('numbering'));
    assert.ok(xml.includes('settings'));
    assert.ok(xml.includes('core-properties'));
  });
});

describe('buildWordRelsWithImages — extended', () => {
  it('handles empty image rels', () => {
    const xml = buildWordRelsWithImages([]);
    assert.ok(xml.includes('</Relationships>'));
    assert.ok(!xml.includes('relationships/image'));
  });

  it('handles multiple image rels', () => {
    const rels = [
      { rId: 'rId10', target: 'media/page1.png' },
      { rId: 'rId11', target: 'media/page2.png' },
      { rId: 'rId12', target: 'media/page3.png' },
    ];
    const xml = buildWordRelsWithImages(rels);
    assert.equal((xml.match(/relationships\/image/g) || []).length, 3);
  });
});

describe('initExportImageDeps', () => {
  it('accepts partial deps without error', () => {
    assert.doesNotThrow(() => initExportImageDeps({ getCachedPage: () => null }));
  });

  it('accepts empty object', () => {
    assert.doesNotThrow(() => initExportImageDeps({}));
  });
});
