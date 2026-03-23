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
});
