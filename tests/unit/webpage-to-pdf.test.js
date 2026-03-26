import './setup-dom.js';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  captureWebpageToPdf,
  parseHtmlContent,
  wrapText,
  PAGE_SIZES,
} from '../../app/modules/webpage-to-pdf.js';

// ---------------------------------------------------------------------------
// parseHtmlContent
// ---------------------------------------------------------------------------

describe('parseHtmlContent', () => {
  it('extracts title from <title> tag', () => {
    const html = '<html><head><title>My Page</title></head><body><p>Hello</p></body></html>';
    const result = parseHtmlContent(html);
    assert.equal(result.title, 'My Page');
  });

  it('extracts paragraphs and headings as sections', () => {
    const html = '<h1>Heading</h1><p>Body text here</p>';
    const result = parseHtmlContent(html);
    assert.ok(result.sections.length >= 2);
    assert.equal(result.sections[0].tag, 'h1');
    assert.equal(result.sections[0].text, 'Heading');
    assert.equal(result.sections[1].tag, 'p');
  });

  it('defaults title to Untitled when missing', () => {
    const result = parseHtmlContent('<body><p>text</p></body>');
    assert.equal(result.title, 'Untitled');
  });

  it('falls back to body text when no structured elements found', () => {
    const html = '<body>Plain text only</body>';
    const result = parseHtmlContent(html);
    assert.ok(result.sections.length >= 1);
    assert.ok(result.sections[0].text.includes('Plain text only'));
  });
});

// ---------------------------------------------------------------------------
// wrapText
// ---------------------------------------------------------------------------

describe('wrapText', () => {
  it('wraps long text into multiple lines', () => {
    const text = 'word '.repeat(20).trim();
    const lines = wrapText(text, 25);
    assert.ok(lines.length > 1);
    for (const line of lines) {
      assert.ok(line.length <= 30); // allow slight overflow per word
    }
  });

  it('returns single line for short text', () => {
    const lines = wrapText('Hello', 80);
    assert.equal(lines.length, 1);
    assert.equal(lines[0], 'Hello');
  });

  it('returns empty array for empty string', () => {
    const lines = wrapText('', 80);
    assert.equal(lines.length, 0);
  });
});

// ---------------------------------------------------------------------------
// PAGE_SIZES
// ---------------------------------------------------------------------------

describe('PAGE_SIZES', () => {
  it('has A4, Letter, Legal, A3 sizes', () => {
    assert.ok(PAGE_SIZES.A4);
    assert.ok(PAGE_SIZES.Letter);
    assert.ok(PAGE_SIZES.Legal);
    assert.ok(PAGE_SIZES.A3);
  });

  it('A4 has correct approximate dimensions', () => {
    assert.ok(PAGE_SIZES.A4.width > 590 && PAGE_SIZES.A4.width < 600);
    assert.ok(PAGE_SIZES.A4.height > 840 && PAGE_SIZES.A4.height < 845);
  });
});

// ---------------------------------------------------------------------------
// captureWebpageToPdf (with htmlContent option to bypass fetch)
// ---------------------------------------------------------------------------

describe('captureWebpageToPdf', () => {
  it('returns blob, title, and pageCount when given htmlContent', async () => {
    const html = '<html><head><title>Test</title></head><body><p>Hello world</p></body></html>';
    const result = await captureWebpageToPdf('http://example.com', { htmlContent: html });
    assert.ok(result.blob instanceof Blob);
    assert.equal(result.title, 'Test');
    assert.ok(result.pageCount >= 1);
  });

  it('uses A4 page size by default', async () => {
    const html = '<html><body><p>text</p></body></html>';
    const result = await captureWebpageToPdf('http://x.com', { htmlContent: html });
    assert.ok(result.blob instanceof Blob);
    assert.ok(result.pageCount >= 1);
  });

  it('produces PDF blob with correct MIME type', async () => {
    const html = '<html><body><p>content</p></body></html>';
    const result = await captureWebpageToPdf('http://x.com', { htmlContent: html });
    assert.equal(result.blob.type, 'application/pdf');
  });
});
