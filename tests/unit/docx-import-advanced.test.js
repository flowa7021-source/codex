import './setup-dom.js';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  parseDocxAdvanced,
  formattedBlocksToHtml,
  mergeDocxIntoWorkspace,
} from '../../app/modules/docx-import-advanced.js';

// Helper: build a minimal uncompressed DOCX-like ZIP with word/document.xml
function buildFakeDocxBytes(documentXml, stylesXml) {
  const encoder = new TextEncoder();

  function localFileEntry(name, content) {
    const nameBytes = encoder.encode(name);
    const contentBytes = encoder.encode(content);
    const header = new Uint8Array(30 + nameBytes.length);
    const view = new DataView(header.buffer);
    view.setUint32(0, 0x04034b50, true); // local file header signature
    view.setUint16(4, 20, true);
    view.setUint16(26, nameBytes.length, true);
    view.setUint16(28, 0, true);
    // compressed and uncompressed sizes
    view.setUint32(18, contentBytes.length, true);
    view.setUint32(22, contentBytes.length, true);
    header.set(nameBytes, 30);
    const result = new Uint8Array(header.length + contentBytes.length);
    result.set(header);
    result.set(contentBytes, header.length);
    return result;
  }

  const parts = [localFileEntry('word/document.xml', documentXml)];
  if (stylesXml) {
    parts.push(localFileEntry('word/styles.xml', stylesXml));
  }

  const total = parts.reduce((s, p) => s + p.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    result.set(p, offset);
    offset += p.length;
  }
  return result.buffer;
}

describe('parseDocxAdvanced', () => {
  it('throws for invalid DOCX (missing document.xml)', () => {
    const buf = new ArrayBuffer(100);
    assert.throws(() => parseDocxAdvanced(buf), /Invalid DOCX/);
  });

  it('parses a minimal document with one paragraph', () => {
    const xml = '<w:body><w:p><w:r><w:t>Hello World</w:t></w:r></w:p></w:body>';
    const buf = buildFakeDocxBytes(xml);
    const result = parseDocxAdvanced(buf);
    assert.ok(result.pages.length >= 1);
    assert.ok(result.pages[0].includes('Hello World'));
    assert.ok(result.formattedBlocks.length >= 1);
  });

  it('returns empty pages when body is missing', () => {
    const xml = '<w:document></w:document>';
    const buf = buildFakeDocxBytes(xml);
    const result = parseDocxAdvanced(buf);
    assert.equal(result.pages.length, 0);
  });

  it('parses tables', () => {
    const xml = '<w:body><w:tbl><w:tr><w:tc><w:p><w:r><w:t>Cell1</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body>';
    const buf = buildFakeDocxBytes(xml);
    const result = parseDocxAdvanced(buf);
    assert.ok(result.tables.length >= 1);
  });

  it('detects bold and italic run properties', () => {
    const xml = '<w:body><w:p><w:r><w:rPr><w:b/><w:i/></w:rPr><w:t>Bold Italic</w:t></w:r></w:p></w:body>';
    const buf = buildFakeDocxBytes(xml);
    const result = parseDocxAdvanced(buf);
    const block = result.formattedBlocks[0][0];
    assert.equal(block.runs[0].bold, true);
    assert.equal(block.runs[0].italic, true);
  });
});

describe('formattedBlocksToHtml', () => {
  it('converts a paragraph block to HTML', () => {
    const blocks = [{
      type: 'paragraph',
      text: 'Hello',
      runs: [{ text: 'Hello' }],
      styleName: null,
      align: 'left',
    }];
    const html = formattedBlocksToHtml(blocks);
    assert.ok(html.includes('<p>'));
    assert.ok(html.includes('Hello'));
  });

  it('wraps bold runs in <b> tags', () => {
    const blocks = [{
      type: 'paragraph',
      text: 'Bold',
      runs: [{ text: 'Bold', bold: true }],
      styleName: null,
      align: 'left',
    }];
    const html = formattedBlocksToHtml(blocks);
    assert.ok(html.includes('<b>'));
  });

  it('renders table blocks', () => {
    const blocks = [{
      type: 'table',
      rows: [['A', 'B'], ['1', '2']],
    }];
    const html = formattedBlocksToHtml(blocks);
    assert.ok(html.includes('<table'));
    assert.ok(html.includes('<td>'));
  });

  it('maps heading styles to h tags', () => {
    const blocks = [{
      type: 'paragraph',
      text: 'Title',
      runs: [{ text: 'Title' }],
      styleName: 'heading 1',
      align: 'left',
    }];
    const html = formattedBlocksToHtml(blocks);
    assert.ok(html.includes('<h1'));
  });
});

describe('mergeDocxIntoWorkspace', () => {
  it('merges imported pages into existing text', () => {
    const parsed = { pages: ['New content'] };
    const existing = ['Old content', 'Page 2'];
    const { pagesText, merged } = mergeDocxIntoWorkspace(parsed, existing, 2);
    assert.equal(pagesText[0], 'New content');
    assert.equal(pagesText[1], 'Page 2');
    assert.equal(merged, 1);
  });

  it('does not merge identical pages', () => {
    const parsed = { pages: ['Same'] };
    const existing = ['Same'];
    const { merged } = mergeDocxIntoWorkspace(parsed, existing, 1);
    assert.equal(merged, 0);
  });

  it('respects pageCount limit', () => {
    const parsed = { pages: ['A', 'B', 'C'] };
    const existing = ['X'];
    const { pagesText } = mergeDocxIntoWorkspace(parsed, existing, 1);
    assert.equal(pagesText.length, 1);
  });
});
