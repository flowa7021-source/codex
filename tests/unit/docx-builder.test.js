import './setup-dom.js';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { buildDocxDocument } from '../../app/modules/docx-builder.js';

describe('buildDocxDocument', () => {
  it('returns a Blob for empty sections', async () => {
    const result = await buildDocxDocument([], { title: 'Test' });
    assert.ok(result);
  });

  it('handles a section with no blocks', async () => {
    const sections = [{ startPage: 1, endPage: 1, blocks: [] }];
    const blob = await buildDocxDocument(sections, { title: 'Empty' });
    assert.ok(blob);
  });

  it('handles a paragraph block', async () => {
    const sections = [{
      startPage: 1, endPage: 1,
      blocks: [{
        type: 'paragraph',
        content: { lines: [{ runs: [{ text: 'Hello world', fontSize: 12 }] }] },
      }],
    }];
    const blob = await buildDocxDocument(sections, { title: 'Para' });
    assert.ok(blob);
  });

  it('handles a heading block', async () => {
    const sections = [{
      startPage: 1, endPage: 1,
      blocks: [{
        type: 'heading',
        headingLevel: 1,
        content: { lines: [{ runs: [{ text: 'Title', fontSize: 24 }] }] },
      }],
    }];
    const blob = await buildDocxDocument(sections, { title: 'Head' });
    assert.ok(blob);
  });

  it('handles a list-item block', async () => {
    const sections = [{
      startPage: 1, endPage: 1,
      blocks: [{
        type: 'list-item',
        listInfo: { type: 'bullet', level: 0 },
        content: { lines: [{ runs: [{ text: 'Item 1', fontSize: 12 }] }] },
      }],
    }];
    const blob = await buildDocxDocument(sections, { title: 'List' });
    assert.ok(blob);
  });

  it('handles a table block', async () => {
    const sections = [{
      startPage: 1, endPage: 1,
      blocks: [{
        type: 'table',
        rows: [
          { cells: [{ text: 'A' }, { text: 'B' }] },
          { cells: [{ text: '1' }, { text: '2' }] },
        ],
      }],
    }];
    const blob = await buildDocxDocument(sections, { title: 'Table' });
    assert.ok(blob);
  });

  it('includes header when includeHeader is true', async () => {
    const sections = [{ startPage: 1, endPage: 1, blocks: [] }];
    const blob = await buildDocxDocument(sections, { title: 'H', includeHeader: true });
    assert.ok(blob);
  });

  it('includes footer by default', async () => {
    const sections = [{ startPage: 1, endPage: 1, blocks: [] }];
    const blob = await buildDocxDocument(sections, { title: 'F' });
    assert.ok(blob);
  });

  it('handles image block without data', async () => {
    const sections = [{
      startPage: 1, endPage: 1,
      blocks: [{
        type: 'image',
        content: {},
        altText: 'test image',
      }],
    }];
    const blob = await buildDocxDocument(sections, { title: 'Img' });
    assert.ok(blob);
  });

  it('handles page-break block type', async () => {
    const sections = [{
      startPage: 1, endPage: 2,
      blocks: [
        { type: 'paragraph', content: { lines: [{ runs: [{ text: 'Page 1' }] }] } },
        { type: 'page-break' },
        { type: 'paragraph', content: { lines: [{ runs: [{ text: 'Page 2' }] }] } },
      ],
    }];
    const blob = await buildDocxDocument(sections, { title: 'PB' });
    assert.ok(blob);
  });

  it('handles runs with underline, strikethrough, superscript formatting', async () => {
    const sections = [{
      startPage: 1, endPage: 1,
      blocks: [{
        type: 'paragraph',
        content: {
          lines: [{
            runs: [
              { text: 'underlined', underline: true, fontSize: 12 },
              { text: 'struck', strikethrough: true, fontSize: 12 },
              { text: 'sup', superscript: true, fontSize: 8 },
            ],
          }],
        },
      }],
    }];
    const blob = await buildDocxDocument(sections, { title: 'Format' });
    assert.ok(blob);
  });

  it('handles runs with subscript and color formatting', async () => {
    const sections = [{
      startPage: 1, endPage: 1,
      blocks: [{
        type: 'paragraph',
        content: {
          lines: [{
            runs: [
              { text: 'sub', subscript: true, fontSize: 8 },
              { text: 'colored', color: '#FF0000', fontSize: 12 },
              { text: 'charspaced', charSpacing: 2, fontSize: 12 },
            ],
          }],
        },
      }],
    }];
    const blob = await buildDocxDocument(sections, { title: 'Sub' });
    assert.ok(blob);
  });

  it('handles runs with URL (hyperlinks)', async () => {
    const sections = [{
      startPage: 1, endPage: 1,
      blocks: [{
        type: 'paragraph',
        content: {
          lines: [{
            runs: [
              { text: 'Visit site', url: 'https://example.com', fontSize: 12 },
              { text: 'normal text', fontSize: 12 },
            ],
          }],
        },
      }],
    }];
    const blob = await buildDocxDocument(sections, { title: 'Links' });
    assert.ok(blob);
  });

  it('uses buildRunsFromContentLines for header content', async () => {
    const sections = [{
      startPage: 1, endPage: 1,
      blocks: [],
      header: [{
        lines: [{
          runs: [{ text: 'Header Title', fontSize: 14 }],
        }],
      }],
    }];
    const blob = await buildDocxDocument(sections, { title: 'Header', includeHeader: true });
    assert.ok(blob);
  });

  it('uses buildRunsFromContentLines for footer content', async () => {
    const sections = [{
      startPage: 1, endPage: 1,
      blocks: [],
      footer: [{
        lines: [{
          runs: [{ text: 'Footer text', fontSize: 10 }],
        }],
      }],
    }];
    const blob = await buildDocxDocument(sections, { title: 'Footer', includeFooter: true });
    assert.ok(blob);
  });

  it('handles empty buildRunsFromContentLines regions (fallback to empty run)', async () => {
    const sections = [{
      startPage: 1, endPage: 1,
      blocks: [],
      header: [],
    }];
    const blob = await buildDocxDocument(sections, { title: 'H', includeHeader: true });
    assert.ok(blob);
  });
});
