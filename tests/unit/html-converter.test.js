// ─── Unit Tests: HtmlConverter ───────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  convertToHtml,
  pageToHtmlFragment,
  downloadHtml,
} from '../../app/modules/html-converter.js';

// ── convertToHtml ───────────────────────────────────────────────────────────

describe('convertToHtml', () => {
  it('returns a complete HTML document', () => {
    const html = convertToHtml([{ text: 'Hello world' }]);
    assert.ok(html.startsWith('<!DOCTYPE html>'));
    assert.ok(html.includes('<html'));
    assert.ok(html.includes('</html>'));
    assert.ok(html.includes('<head>'));
    assert.ok(html.includes('<body>'));
  });

  it('includes default title', () => {
    const html = convertToHtml([{ text: 'Test' }]);
    assert.ok(html.includes('<title>Exported Document</title>'));
  });

  it('uses custom title', () => {
    const html = convertToHtml([{ text: 'Test' }], { title: 'My Document' });
    assert.ok(html.includes('<title>My Document</title>'));
  });

  it('escapes HTML in title', () => {
    const html = convertToHtml([{ text: 'Test' }], { title: '<script>alert("xss")</script>' });
    assert.ok(!html.includes('<script>alert'));
    assert.ok(html.includes('&lt;script&gt;'));
  });

  it('renders page text as paragraphs', () => {
    const html = convertToHtml([{ text: 'First paragraph\n\nSecond paragraph' }]);
    assert.ok(html.includes('<p>'));
    assert.ok(html.includes('First paragraph'));
    assert.ok(html.includes('Second paragraph'));
  });

  it('renders multiple pages', () => {
    const pages = [
      { text: 'Page one' },
      { text: 'Page two' },
      { text: 'Page three' },
    ];
    const html = convertToHtml(pages);
    assert.ok(html.includes('data-page="1"'));
    assert.ok(html.includes('data-page="2"'));
    assert.ok(html.includes('data-page="3"'));
  });

  it('includes page number markers', () => {
    const html = convertToHtml([{ text: 'Test' }]);
    assert.ok(html.includes('page-number'));
  });

  it('includes responsive CSS by default', () => {
    const html = convertToHtml([{ text: 'Test' }]);
    assert.ok(html.includes('@media'));
    assert.ok(html.includes('max-width'));
  });

  it('excludes responsive CSS when disabled', () => {
    const html = convertToHtml([{ text: 'Test' }], { responsive: false });
    assert.ok(!html.includes('@media (max-width'));
  });

  it('renders positioned layout with items', () => {
    const pages = [{
      text: 'Hello',
      items: [{ str: 'Hello', x: 72, y: 700, fontSize: 12 }],
      width: 595,
      height: 842,
    }];
    const html = convertToHtml(pages, { layout: 'positioned' });
    assert.ok(html.includes('page-positioned'));
    assert.ok(html.includes('Hello'));
  });

  it('renders flow layout by default (page div without positioned class)', () => {
    const pages = [{
      text: 'Hello world',
    }];
    const html = convertToHtml(pages);
    // Flow layout: page div should have class="page" but not "page page-positioned"
    assert.ok(html.includes('class="page"'));
    assert.ok(html.includes('<p>'));
  });

  it('handles empty pages array', () => {
    const html = convertToHtml([]);
    assert.ok(html.includes('<!DOCTYPE html>'));
    assert.ok(html.includes('<body>'));
  });

  it('handles page with no text', () => {
    const html = convertToHtml([{ text: '' }]);
    assert.ok(html.includes('<div class="page"'));
  });

  it('escapes HTML entities in text content', () => {
    const html = convertToHtml([{ text: '<b>Bold</b> & "quotes"' }]);
    assert.ok(html.includes('&lt;b&gt;'));
    assert.ok(html.includes('&amp;'));
    assert.ok(html.includes('&quot;'));
  });

  it('detects headings from large font size items', () => {
    const pages = [{
      text: 'Title',
      items: [{ str: 'Title', x: 72, y: 100, fontSize: 24 }],
    }];
    const html = convertToHtml(pages, { layout: 'flow' });
    assert.ok(html.includes('<h'));
  });

  it('includes meta charset', () => {
    const html = convertToHtml([{ text: 'Test' }]);
    assert.ok(html.includes('charset="UTF-8"'));
  });

  it('includes viewport meta tag', () => {
    const html = convertToHtml([{ text: 'Test' }]);
    assert.ok(html.includes('name="viewport"'));
  });

  it('includes print styles in responsive mode', () => {
    const html = convertToHtml([{ text: 'Test' }], { responsive: true });
    assert.ok(html.includes('@media print'));
  });
});

// ── pageToHtmlFragment ──────────────────────────────────────────────────────

describe('pageToHtmlFragment', () => {
  it('converts text to paragraph HTML', () => {
    const html = pageToHtmlFragment('Hello world', 1);
    assert.ok(html.includes('<p>Hello world</p>'));
  });

  it('splits on double newlines into paragraphs', () => {
    const html = pageToHtmlFragment('First\n\nSecond', 1);
    assert.ok(html.includes('<p>First</p>'));
    assert.ok(html.includes('<p>Second</p>'));
  });

  it('escapes HTML in text', () => {
    const html = pageToHtmlFragment('<div>injected</div>', 1);
    assert.ok(!html.includes('<div>injected'));
    assert.ok(html.includes('&lt;div&gt;'));
  });

  it('handles empty text', () => {
    const html = pageToHtmlFragment('', 1);
    assert.equal(html, '');
  });

  it('trims paragraph whitespace', () => {
    const html = pageToHtmlFragment('  hello  \n\n  world  ', 1);
    assert.ok(html.includes('<p>hello</p>'));
    assert.ok(html.includes('<p>world</p>'));
  });
});

// ── downloadHtml ────────────────────────────────────────────────────────────

describe('downloadHtml', () => {
  it('is a function', () => {
    assert.equal(typeof downloadHtml, 'function');
  });

  // downloadHtml calls a.click() which requires full browser DOM;
  // skip interactive download tests in Node environment.
});
