// ─── Unit Tests: Export DOCX ─────────────────────────────────────────────────
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildDocxXml,
  buildDocxTable,
  buildDocxStyles,
  buildDocxNumbering,
  buildDocxSettings,
  buildCoreProperties,
  buildContentTypes,
  buildRels,
  buildWordRels,
  crc32,
  generateDocxBlob,
  extractDocumentXmlFromZip,
  parseDocxTextByPages,
  createZipBlob,
} from '../../app/modules/export-docx.js';

// ─── buildDocxXml ───────────────────────────────────────────────────────────

describe('buildDocxXml', () => {
  it('returns valid XML with document root element', () => {
    const xml = buildDocxXml('Test', ['Page 1 text']);
    assert.ok(xml.startsWith('<?xml'));
    assert.ok(xml.includes('<w:document'));
    assert.ok(xml.includes('</w:document>'));
  });

  it('includes escaped title', () => {
    const xml = buildDocxXml('Title & <Special>', ['text']);
    assert.ok(xml.includes('Title &amp; &lt;Special&gt;'));
  });

  it('adds page headers for each page', () => {
    const xml = buildDocxXml('Doc', ['p1', 'p2']);
    assert.ok(xml.includes('Страница 1'));
    assert.ok(xml.includes('Страница 2'));
  });

  it('inserts page breaks between pages', () => {
    const xml = buildDocxXml('Doc', ['p1', 'p2']);
    assert.ok(xml.includes('w:type="page"'));
  });

  it('does not add page break after last page', () => {
    const xml = buildDocxXml('Doc', ['only one']);
    // Count page breaks
    const breaks = (xml.match(/w:type="page"/g) || []).length;
    assert.equal(breaks, 0);
  });

  it('skips empty pages', () => {
    const xml = buildDocxXml('Doc', ['', 'page2']);
    assert.ok(!xml.includes('Страница 1'));
    assert.ok(xml.includes('Страница 2'));
  });

  it('detects bullet lists', () => {
    const xml = buildDocxXml('Doc', ['• Item one\n• Item two']);
    assert.ok(xml.includes('ListParagraph'));
    assert.ok(xml.includes('w:numId w:val="1"'));
  });

  it('detects numbered lists', () => {
    const xml = buildDocxXml('Doc', ['1. First item\n2. Second item']);
    assert.ok(xml.includes('ListParagraph'));
    assert.ok(xml.includes('w:numId w:val="2"'));
  });

  it('detects headings from semantic patterns', () => {
    const xml = buildDocxXml('Doc', ['Chapter 1\nSome text']);
    assert.ok(xml.includes('Heading2'));
  });

  it('detects ALL CAPS as heading', () => {
    const xml = buildDocxXml('Doc', ['IMPORTANT NOTICE\nBody text here.']);
    assert.ok(xml.includes('Heading3'));
  });

  it('detects tab-separated content as table', () => {
    const xml = buildDocxXml('Doc', ['Col1\tCol2\nVal1\tVal2']);
    assert.ok(xml.includes('<w:tbl>'));
    assert.ok(xml.includes('Col1'));
    assert.ok(xml.includes('Val2'));
  });

  it('preserves indentation via w:ind', () => {
    const xml = buildDocxXml('Doc', ['First line\n    Indented line']);
    assert.ok(xml.includes('w:ind'));
  });

  it('handles null/undefined pages', () => {
    const xml = buildDocxXml('Doc', [null, undefined, '']);
    assert.ok(xml.includes('<w:body>'));
  });

  it('handles special characters in text', () => {
    const xml = buildDocxXml('Doc', ['Text with <angle> & "quotes" and \'apos\'']);
    assert.ok(xml.includes('&lt;angle&gt;'));
    assert.ok(xml.includes('&amp;'));
    assert.ok(xml.includes('&quot;'));
    assert.ok(xml.includes('&apos;'));
  });
});

// ─── buildDocxTable ─────────────────────────────────────────────────────────

describe('buildDocxTable', () => {
  it('builds table XML from rows', () => {
    const xml = buildDocxTable([['A', 'B'], ['C', 'D']]);
    assert.ok(xml.includes('<w:tbl>'));
    assert.ok(xml.includes('</w:tbl>'));
    assert.ok(xml.includes('A'));
    assert.ok(xml.includes('D'));
  });

  it('pads rows with fewer cells', () => {
    const xml = buildDocxTable([['A', 'B', 'C'], ['X']]);
    // Second row should have 3 cells (padded)
    const trs = xml.split('<w:tr>');
    assert.equal(trs.length, 3); // 1 prefix + 2 rows
  });

  it('escapes special characters in cells', () => {
    const xml = buildDocxTable([['<b>&</b>']]);
    assert.ok(xml.includes('&lt;b&gt;&amp;&lt;/b&gt;'));
  });

  it('uses gridCol for column layout', () => {
    const xml = buildDocxTable([['A', 'B']]);
    assert.ok(xml.includes('<w:gridCol'));
  });
});

// ─── buildDocxStyles ────────────────────────────────────────────────────────

describe('buildDocxStyles', () => {
  it('returns valid styles XML', () => {
    const xml = buildDocxStyles();
    assert.ok(xml.startsWith('<?xml'));
    assert.ok(xml.includes('<w:styles'));
    assert.ok(xml.includes('Normal'));
    assert.ok(xml.includes('Title'));
    assert.ok(xml.includes('Heading1'));
    assert.ok(xml.includes('Heading2'));
    assert.ok(xml.includes('Heading3'));
    assert.ok(xml.includes('ListParagraph'));
    assert.ok(xml.includes('TableGrid'));
  });
});

// ─── buildDocxNumbering ─────────────────────────────────────────────────────

describe('buildDocxNumbering', () => {
  it('returns numbering XML with bullet and numbered lists', () => {
    const xml = buildDocxNumbering();
    assert.ok(xml.includes('<w:numbering'));
    assert.ok(xml.includes('bullet'));
    assert.ok(xml.includes('decimal'));
  });
});

// ─── buildDocxSettings ──────────────────────────────────────────────────────

describe('buildDocxSettings', () => {
  it('returns settings XML', () => {
    const xml = buildDocxSettings();
    assert.ok(xml.includes('<w:settings'));
    assert.ok(xml.includes('compatibilityMode'));
    assert.ok(xml.includes('w:val="15"'));
  });
});

// ─── buildCoreProperties ────────────────────────────────────────────────────

describe('buildCoreProperties', () => {
  it('includes title and creator', () => {
    const xml = buildCoreProperties('My Document');
    assert.ok(xml.includes('My Document'));
    assert.ok(xml.includes('NovaReader'));
  });

  it('escapes XML in title', () => {
    const xml = buildCoreProperties('Title & <more>');
    assert.ok(xml.includes('Title &amp; &lt;more&gt;'));
  });

  it('uses default title when empty', () => {
    const xml = buildCoreProperties('');
    assert.ok(xml.includes('NovaReader Export'));
  });

  it('uses default title when null', () => {
    const xml = buildCoreProperties(null);
    assert.ok(xml.includes('NovaReader Export'));
  });

  it('includes timestamps', () => {
    const xml = buildCoreProperties('Test');
    assert.ok(xml.includes('dcterms:created'));
    assert.ok(xml.includes('dcterms:modified'));
  });
});

// ─── buildContentTypes ──────────────────────────────────────────────────────

describe('buildContentTypes', () => {
  it('returns content types XML with required parts', () => {
    const xml = buildContentTypes();
    assert.ok(xml.includes('document.xml'));
    assert.ok(xml.includes('styles.xml'));
    assert.ok(xml.includes('numbering.xml'));
    assert.ok(xml.includes('settings.xml'));
    assert.ok(xml.includes('core.xml'));
  });
});

// ─── buildRels ──────────────────────────────────────────────────────────────

describe('buildRels', () => {
  it('returns rels XML with document and core properties', () => {
    const xml = buildRels();
    assert.ok(xml.includes('word/document.xml'));
    assert.ok(xml.includes('core-properties'));
  });
});

// ─── buildWordRels ──────────────────────────────────────────────────────────

describe('buildWordRels', () => {
  it('returns word rels with styles, numbering and settings', () => {
    const xml = buildWordRels();
    assert.ok(xml.includes('styles.xml'));
    assert.ok(xml.includes('numbering.xml'));
    assert.ok(xml.includes('settings.xml'));
  });
});

// ─── crc32 ──────────────────────────────────────────────────────────────────

describe('crc32', () => {
  it('returns a number for empty data', () => {
    const result = crc32(new Uint8Array(0));
    assert.equal(typeof result, 'number');
    assert.equal(result, 0); // CRC-32 of empty data = 0
  });

  it('returns correct CRC for known input', () => {
    // CRC-32 of "123456789" = 0xCBF43926
    const data = new TextEncoder().encode('123456789');
    const result = crc32(data);
    assert.equal(result, 0xCBF43926);
  });

  it('returns different values for different inputs', () => {
    const a = crc32(new TextEncoder().encode('hello'));
    const b = crc32(new TextEncoder().encode('world'));
    assert.notEqual(a, b);
  });

  it('is deterministic', () => {
    const data = new TextEncoder().encode('test');
    assert.equal(crc32(data), crc32(data));
  });
});

// ─── generateDocxBlob ───────────────────────────────────────────────────────

describe('generateDocxBlob', () => {
  it('returns a Blob with DOCX mime type', async () => {
    const blob = await generateDocxBlob('Test', ['Hello']);
    assert.ok(blob instanceof Blob);
    assert.equal(blob.type, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  });

  it('returns non-empty blob', async () => {
    const blob = await generateDocxBlob('Test', ['Content']);
    assert.ok(blob.size > 0);
  });

  it('handles empty pages', async () => {
    const blob = await generateDocxBlob('Empty', []);
    assert.ok(blob instanceof Blob);
    assert.ok(blob.size > 0);
  });

  it('produces valid ZIP structure (starts with PK header)', async () => {
    const blob = await generateDocxBlob('Zip', ['data']);
    const buf = await blob.arrayBuffer();
    const bytes = new Uint8Array(buf);
    // PK zip signature
    assert.equal(bytes[0], 0x50);
    assert.equal(bytes[1], 0x4B);
    assert.equal(bytes[2], 0x03);
    assert.equal(bytes[3], 0x04);
  });
});

// ─── extractDocumentXmlFromZip ──────────────────────────────────────────────

describe('extractDocumentXmlFromZip', () => {
  it('extracts document.xml from a generated DOCX', async () => {
    const blob = await generateDocxBlob('Extract', ['Test content']);
    const buf = await blob.arrayBuffer();
    const bytes = new Uint8Array(buf);
    const xml = extractDocumentXmlFromZip(bytes);
    assert.ok(xml);
    assert.ok(xml.includes('<w:document'));
    assert.ok(xml.includes('Test content'));
  });

  it('returns null for non-zip data', () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    assert.equal(extractDocumentXmlFromZip(bytes), null);
  });

  it('returns null for empty data', () => {
    assert.equal(extractDocumentXmlFromZip(new Uint8Array(0)), null);
  });
});

// ─── parseDocxTextByPages ───────────────────────────────────────────────────

describe('parseDocxTextByPages', () => {
  it('parses single page', () => {
    const xml = '<w:body><w:p><w:r><w:t>Hello</w:t></w:r></w:p></w:body>';
    const pages = parseDocxTextByPages(xml);
    assert.equal(pages.length, 1);
    assert.equal(pages[0], 'Hello');
  });

  it('splits on page breaks', () => {
    const xml = `
      <w:p><w:r><w:t>Page 1</w:t></w:r></w:p>
      <w:p><w:r><w:br w:type="page"/></w:r></w:p>
      <w:p><w:r><w:t>Page 2</w:t></w:r></w:p>
    `;
    const pages = parseDocxTextByPages(xml);
    assert.equal(pages.length, 2);
    assert.ok(pages[0].includes('Page 1'));
    assert.ok(pages[1].includes('Page 2'));
  });

  it('filters out empty pages', () => {
    const xml = '<w:p><w:r><w:br w:type="page"/></w:r></w:p><w:p><w:r><w:t>Only</w:t></w:r></w:p>';
    const pages = parseDocxTextByPages(xml);
    assert.ok(pages.every(p => p.length > 0));
  });

  it('handles multiple text runs per paragraph', () => {
    const xml = '<w:p><w:r><w:t>Hello </w:t></w:r><w:r><w:t>World</w:t></w:r></w:p>';
    const pages = parseDocxTextByPages(xml);
    assert.equal(pages[0], 'Hello World');
  });

  it('handles xml:space preserve attribute', () => {
    const xml = '<w:p><w:r><w:t xml:space="preserve">Text  here</w:t></w:r></w:p>';
    const pages = parseDocxTextByPages(xml);
    assert.equal(pages[0], 'Text  here');
  });

  it('returns empty array for XML with no text', () => {
    const xml = '<w:body><w:p></w:p></w:body>';
    const pages = parseDocxTextByPages(xml);
    assert.equal(pages.length, 0);
  });
});

// ─── createZipBlob ──────────────────────────────────────────────────────────

describe('createZipBlob', () => {
  it('returns a Blob with DOCX mime type', () => {
    const encoder = new TextEncoder();
    const blob = createZipBlob([
      { name: 'test.txt', data: encoder.encode('hello') },
    ]);
    assert.ok(blob instanceof Blob);
    assert.equal(blob.type, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  });

  it('produces valid ZIP header', async () => {
    const encoder = new TextEncoder();
    const blob = createZipBlob([
      { name: 'file.xml', data: encoder.encode('<root/>') },
    ]);
    const buf = await blob.arrayBuffer();
    const bytes = new Uint8Array(buf);
    assert.equal(bytes[0], 0x50);
    assert.equal(bytes[1], 0x4B);
  });

  it('handles multiple files', async () => {
    const encoder = new TextEncoder();
    const blob = createZipBlob([
      { name: 'a.txt', data: encoder.encode('aaa') },
      { name: 'b.txt', data: encoder.encode('bbb') },
      { name: 'c.txt', data: encoder.encode('ccc') },
    ]);
    assert.ok(blob.size > 0);
  });

  it('handles empty file list', () => {
    const blob = createZipBlob([]);
    assert.ok(blob instanceof Blob);
  });
});

// ─── Round-trip: generate then extract ──────────────────────────────────────

describe('round-trip generate and extract', () => {
  it('can extract text from a generated DOCX', async () => {
    const blob = await generateDocxBlob('Round Trip', ['Hello world', 'Page two content']);
    const buf = await blob.arrayBuffer();
    const bytes = new Uint8Array(buf);
    const xml = extractDocumentXmlFromZip(bytes);
    assert.ok(xml);
    const pages = parseDocxTextByPages(xml);
    assert.ok(pages.length >= 1);
    // Verify content is present (may be on different pages due to headings)
    const allText = pages.join(' ');
    assert.ok(allText.includes('Hello world'));
    assert.ok(allText.includes('Page two content'));
  });
});
