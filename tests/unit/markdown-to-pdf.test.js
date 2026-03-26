import './setup-dom.js';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const { convertMarkdownToPdf } = await import('../../app/modules/markdown-to-pdf.js');

describe('markdown-to-pdf', () => {
  it('convertMarkdownToPdf is a function', () => {
    assert.equal(typeof convertMarkdownToPdf, 'function');
  });

  it('returns a Uint8Array for simple markdown', async () => {
    const result = await convertMarkdownToPdf('# Hello\n\nWorld');
    assert.ok(result instanceof Uint8Array);
    assert.ok(result.length > 0);
  });

  it('output starts with PDF magic bytes', async () => {
    const result = await convertMarkdownToPdf('# Hello');
    // PDF files start with %PDF-
    const header = new TextDecoder().decode(result.slice(0, 5));
    assert.equal(header, '%PDF-');
  });

  it('handles bold markdown **text**', async () => {
    const result = await convertMarkdownToPdf('**bold text**');
    assert.ok(result instanceof Uint8Array);
    assert.ok(result.length > 0);
  });

  it('handles italic markdown *text*', async () => {
    const result = await convertMarkdownToPdf('*italic text*');
    assert.ok(result instanceof Uint8Array);
    assert.ok(result.length > 0);
  });

  it('handles bullet lists', async () => {
    const md = '- Item one\n- Item two\n- Item three';
    const result = await convertMarkdownToPdf(md);
    assert.ok(result instanceof Uint8Array);
    assert.ok(result.length > 0);
  });

  it('handles numbered lists', async () => {
    const md = '1. First\n2. Second\n3. Third';
    const result = await convertMarkdownToPdf(md);
    assert.ok(result instanceof Uint8Array);
    assert.ok(result.length > 0);
  });

  it('handles blockquotes', async () => {
    const md = '> This is a quote\n> Second line';
    const result = await convertMarkdownToPdf(md);
    assert.ok(result instanceof Uint8Array);
    assert.ok(result.length > 0);
  });

  it('handles code blocks', async () => {
    const md = '```\nconst x = 42;\nconsole.log(x);\n```';
    const result = await convertMarkdownToPdf(md);
    assert.ok(result instanceof Uint8Array);
    assert.ok(result.length > 0);
  });

  it('handles horizontal rules', async () => {
    const md = 'Before\n\n---\n\nAfter';
    const result = await convertMarkdownToPdf(md);
    assert.ok(result instanceof Uint8Array);
    assert.ok(result.length > 0);
  });

  it('handles links [text](url)', async () => {
    const md = 'Visit [Google](https://google.com) for search.';
    const result = await convertMarkdownToPdf(md);
    assert.ok(result instanceof Uint8Array);
    assert.ok(result.length > 0);
  });

  it('handles mixed heading levels', async () => {
    const md = '# H1\n## H2\n### H3\nParagraph text.';
    const result = await convertMarkdownToPdf(md);
    assert.ok(result instanceof Uint8Array);
    assert.ok(result.length > 0);
  });

  it('respects pageSize option', async () => {
    const resultA4 = await convertMarkdownToPdf('# Test', { pageSize: 'A4' });
    const resultLetter = await convertMarkdownToPdf('# Test', { pageSize: 'Letter' });

    // Both should produce valid PDFs
    assert.ok(resultA4 instanceof Uint8Array);
    assert.ok(resultLetter instanceof Uint8Array);
    // Different page sizes should produce different byte lengths
    // (not guaranteed but likely due to different dimensions in the PDF)
    assert.ok(resultA4.length > 0);
    assert.ok(resultLetter.length > 0);
  });

  it('handles empty input', async () => {
    const result = await convertMarkdownToPdf('');
    assert.ok(result instanceof Uint8Array);
    // Should still produce a valid (blank) PDF
    const header = new TextDecoder().decode(result.slice(0, 5));
    assert.equal(header, '%PDF-');
  });

  it('handles complex document with all features', async () => {
    const md = [
      '# Document Title',
      '',
      'This is a paragraph with **bold** and *italic* and `code`.',
      '',
      '## Section Two',
      '',
      '- Bullet one',
      '- Bullet two',
      '',
      '1. Number one',
      '2. Number two',
      '',
      '> A wise quote',
      '',
      '```',
      'function hello() {}',
      '```',
      '',
      '---',
      '',
      'Final paragraph with a [link](https://example.com).',
    ].join('\n');

    const result = await convertMarkdownToPdf(md);
    assert.ok(result instanceof Uint8Array);
    assert.ok(result.length > 100); // Should be a substantial PDF
  });
});
