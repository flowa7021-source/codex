import './setup-dom.js';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  mode, buildOutlineMap, fuzzyMatch,
  detectHeadings, detectLists, detectFootnotes,
  detectFormulas, detectTocEntries, detectCaptions,
  detectSections, enrichSemantics,
} from '../../app/modules/semantic-enricher.js';

// Helper: create a paragraph region with text runs
function mkRegion(text, opts = {}) {
  return {
    type: 'paragraph',
    content: {
      lines: [{ runs: [{ text, fontSize: opts.fontSize || 12, bold: opts.bold || false, fontName: opts.fontName || 'Arial', superscript: opts.superscript || false, subscript: opts.subscript || false }] }],
      alignment: opts.alignment || 'left',
    },
    x: opts.x || 72,
    y: opts.y || 100,
    height: opts.height || 14,
    ...opts.extra,
  };
}

describe('mode', () => {
  it('returns undefined for empty array', () => {
    assert.strictEqual(mode([]), undefined);
  });

  it('returns the most frequent value', () => {
    assert.strictEqual(mode([12, 12, 14, 12, 14]), 12);
  });

  it('returns undefined for null input', () => {
    assert.strictEqual(mode(null), undefined);
  });
});

describe('buildOutlineMap', () => {
  it('returns null for null input', () => {
    assert.strictEqual(buildOutlineMap(null), null);
  });

  it('builds a map from an array of outline entries', () => {
    const outline = [
      { title: 'Chapter 1', dest: { page: 0 } },
      { title: 'Chapter 2', dest: { page: 5 } },
    ];
    const map = buildOutlineMap(outline);
    assert.ok(map instanceof Map);
    assert.strictEqual(map.get(0).length, 1);
    assert.strictEqual(map.get(0)[0].title, 'Chapter 1');
  });

  it('handles nested outline items', () => {
    const outline = [
      { title: 'Ch 1', dest: { page: 0 }, items: [
        { title: 'Section 1.1', dest: { page: 1 } },
      ] },
    ];
    const map = buildOutlineMap(outline);
    assert.strictEqual(map.get(0)[0].level, 1);
    assert.strictEqual(map.get(1)[0].level, 2);
  });
});

describe('fuzzyMatch', () => {
  it('returns false for empty strings', () => {
    assert.strictEqual(fuzzyMatch('', 'hello'), false);
    assert.strictEqual(fuzzyMatch(null, 'hello'), false);
  });

  it('matches identical strings', () => {
    assert.strictEqual(fuzzyMatch('Chapter 1', 'Chapter 1'), true);
  });

  it('matches case-insensitively', () => {
    assert.strictEqual(fuzzyMatch('CHAPTER ONE', 'chapter one'), true);
  });

  it('matches prefix with >=80% overlap', () => {
    assert.strictEqual(fuzzyMatch('Introduction to Prog', 'Introduction to Program'), true);
  });

  it('rejects completely different strings', () => {
    assert.strictEqual(fuzzyMatch('Hello', 'World'), false);
  });
});

describe('detectHeadings', () => {
  it('does nothing with empty regions', () => {
    const regions = [];
    detectHeadings(regions, 12, null, 1);
    assert.strictEqual(regions.length, 0);
  });

  it('detects heading by large bold font', () => {
    const regions = [mkRegion('Title Here', { fontSize: 20, bold: true })];
    detectHeadings(regions, 12, null, 1);
    assert.strictEqual(regions[0].type, 'heading');
    assert.strictEqual(regions[0].headingLevel, 1);
  });

  it('detects heading by semantic pattern', () => {
    const regions = [mkRegion('Introduction')];
    detectHeadings(regions, 12, null, 1);
    assert.strictEqual(regions[0].type, 'heading');
    assert.strictEqual(regions[0].headingLevel, 3);
  });

  it('detects heading via outline matching', () => {
    const outline = new Map([[1, [{ title: 'My Chapter', level: 2, dest: null }]]]);
    const regions = [mkRegion('My Chapter')];
    detectHeadings(regions, 12, outline, 1);
    assert.strictEqual(regions[0].type, 'heading');
    assert.strictEqual(regions[0].headingLevel, 2);
  });
});

describe('detectLists', () => {
  it('detects bullet list items', () => {
    const regions = [mkRegion('• Item one')];
    detectLists(regions);
    assert.strictEqual(regions[0].type, 'list-item');
    assert.strictEqual(regions[0].listInfo.type, 'bullet');
  });

  it('detects numbered list items', () => {
    const regions = [mkRegion('1. First item')];
    detectLists(regions);
    assert.strictEqual(regions[0].type, 'list-item');
    assert.strictEqual(regions[0].listInfo.type, 'ordered');
    assert.strictEqual(regions[0].listInfo.format, 'decimal');
  });

  it('leaves non-list paragraphs unchanged', () => {
    const regions = [mkRegion('Regular paragraph text')];
    detectLists(regions);
    assert.strictEqual(regions[0].type, 'paragraph');
  });
});

describe('detectFootnotes', () => {
  it('detects footnotes at page bottom with matching superscript refs', () => {
    const bodyRegion = mkRegion('Some text', { y: 100 });
    bodyRegion.content.lines[0].runs.push({ text: '1', fontSize: 8, superscript: true });
    const footnoteRegion = mkRegion('1 This is a footnote.', { fontSize: 9, y: 700 });
    const regions = [bodyRegion, footnoteRegion];
    detectFootnotes(regions, 792, 12);
    assert.strictEqual(regions[1].type, 'footnote');
    assert.strictEqual(regions[1].footnoteId, '1');
  });
});

describe('detectFormulas', () => {
  it('detects formula regions with math symbols', () => {
    const regions = [mkRegion('∑ x² + ∫ f(x) dx = ∞', { alignment: 'center', extra: {} })];
    regions[0].content.alignment = 'center';
    regions[0].alignment = 'center';
    detectFormulas(regions);
    assert.strictEqual(regions[0].type, 'formula');
    assert.ok(regions[0].formulaScore >= 5);
  });

  it('leaves normal text as paragraph', () => {
    const regions = [mkRegion('Regular text without math')];
    detectFormulas(regions);
    assert.strictEqual(regions[0].type, 'paragraph');
  });
});

describe('detectTocEntries', () => {
  it('detects 3+ consecutive TOC-like entries', () => {
    const regions = [
      mkRegion('Chapter 1 .............. 5'),
      mkRegion('Chapter 2 .............. 12'),
      mkRegion('Chapter 3 .............. 20'),
    ];
    detectTocEntries(regions);
    assert.strictEqual(regions[0].type, 'toc-entry');
    assert.strictEqual(regions[2].type, 'toc-entry');
  });

  it('does not tag fewer than 3 consecutive TOC candidates', () => {
    const regions = [
      mkRegion('Chapter 1 .............. 5'),
      mkRegion('Chapter 2 .............. 12'),
    ];
    detectTocEntries(regions);
    assert.strictEqual(regions[0].type, 'paragraph');
  });
});

describe('detectCaptions', () => {
  it('detects caption adjacent to image', () => {
    const regions = [
      { type: 'image', content: {}, x: 72, y: 100 },
      mkRegion('Figure 1. A diagram'),
    ];
    detectCaptions(regions);
    assert.strictEqual(regions[1].type, 'caption');
  });

  it('does not mark caption without adjacent image/table', () => {
    const regions = [
      mkRegion('Some text'),
      mkRegion('Figure 1. A diagram'),
    ];
    detectCaptions(regions);
    assert.strictEqual(regions[1].type, 'paragraph');
  });
});

describe('detectSections', () => {
  it('returns empty for no pages', () => {
    assert.deepStrictEqual(detectSections([]), []);
  });

  it('groups pages with same geometry into one section', () => {
    const pages = [
      { pageNumber: 1, width: 612, height: 792, margins: { top: 72, right: 72, bottom: 72, left: 72 }, body: [] },
      { pageNumber: 2, width: 612, height: 792, margins: { top: 72, right: 72, bottom: 72, left: 72 }, body: [] },
    ];
    const sections = detectSections(pages);
    assert.strictEqual(sections.length, 1);
    assert.strictEqual(sections[0].startPage, 1);
    assert.strictEqual(sections[0].endPage, 2);
  });

  it('starts new section on page size change', () => {
    const pages = [
      { pageNumber: 1, width: 612, height: 792, body: [] },
      { pageNumber: 2, width: 842, height: 595, body: [] },
    ];
    const sections = detectSections(pages);
    assert.strictEqual(sections.length, 2);
  });
});

describe('enrichSemantics', () => {
  it('returns empty for no pages', () => {
    assert.deepStrictEqual(enrichSemantics([]), []);
    assert.deepStrictEqual(enrichSemantics(null), []);
  });

  it('enriches pages and returns sections', () => {
    const pages = [{
      pageNumber: 1, width: 612, height: 792,
      margins: { top: 72, right: 72, bottom: 72, left: 72 },
      body: [mkRegion('Introduction')],
    }];
    const sections = enrichSemantics(pages);
    assert.strictEqual(sections.length, 1);
    assert.ok(sections[0].blocks.length >= 1);
  });
});
