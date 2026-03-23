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
