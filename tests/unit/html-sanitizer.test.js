// ─── Unit Tests: HTML Sanitizer ──────────────────────────────────────────────
import './setup-dom.js';

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Ensure DOMParser is available for the fallback path (setup-dom.js may not
// provide it). We add a minimal implementation that delegates to Node's
// document.createElement for parsing.
if (typeof globalThis.DOMParser === 'undefined') {
  globalThis.DOMParser = class DOMParser {
    parseFromString(html, _mimeType) {
      const body = globalThis.document.createElement('body');
      body.innerHTML = html;
      return { body };
    }
  };
}

const S = await import('../../app/modules/html-sanitizer.js');

describe('html-sanitizer – isSanitizerSupported()', () => {
  it('isSanitizerSupported() returns a boolean', () => {
    const result = S.isSanitizerSupported();
    assert.equal(typeof result, 'boolean');
  });

  it('isSanitizerSupported() returns false in Node.js (no native Sanitizer)', () => {
    // Node.js does not have the native Sanitizer API
    assert.equal(S.isSanitizerSupported(), false);
  });
});

describe('html-sanitizer – sanitizeHtml()', () => {
  it('sanitizeHtml("<b>bold</b>") returns string containing "bold"', () => {
    const result = S.sanitizeHtml('<b>bold</b>');
    assert.equal(typeof result, 'string');
    assert.ok(result.includes('bold'), `expected 'bold' in: ${result}`);
  });

  it('sanitizeHtml strips <script> tags', () => {
    const result = S.sanitizeHtml('<script>alert(1)</script><b>safe</b>');
    assert.ok(!result.includes('<script>'), `<script> tag should be stripped: ${result}`);
    assert.ok(!result.includes('alert'), `script content should be stripped: ${result}`);
  });

  it('sanitizeHtml strips onerror attribute', () => {
    const result = S.sanitizeHtml('<img onerror="alert(1)" src="x">');
    assert.ok(!result.includes('onerror'), `onerror attribute should be stripped: ${result}`);
  });

  it('sanitizeHtml preserves allowed tags (b, i, strong, em)', () => {
    const result = S.sanitizeHtml('<b>bold</b> <i>italic</i>');
    assert.ok(result.includes('bold'), `expected 'bold' in: ${result}`);
    assert.ok(result.includes('italic'), `expected 'italic' in: ${result}`);
  });

  it('sanitizeHtml with custom allowedTags strips disallowed tags', () => {
    const result = S.sanitizeHtml('<b>keep</b><div>drop</div>', { allowedTags: ['b'] });
    assert.ok(result.includes('keep'), `expected 'keep' in: ${result}`);
    assert.ok(!result.includes('<div>'), `<div> tag should be stripped: ${result}`);
  });

  it('sanitizeHtml returns a string for empty input', () => {
    const result = S.sanitizeHtml('');
    assert.equal(typeof result, 'string');
  });
});

describe('html-sanitizer – sanitizeText()', () => {
  it('sanitizeText escapes <', () => {
    const result = S.sanitizeText('<script>');
    assert.ok(result.includes('&lt;'), `expected &lt; in: ${result}`);
    assert.ok(!result.includes('<'), `< should not appear in: ${result}`);
  });

  it('sanitizeText escapes >', () => {
    const result = S.sanitizeText('a > b');
    assert.ok(result.includes('&gt;'), `expected &gt; in: ${result}`);
  });

  it('sanitizeText escapes &', () => {
    const result = S.sanitizeText('a & b');
    assert.ok(result.includes('&amp;'), `expected &amp; in: ${result}`);
  });

  it('sanitizeText escapes " and \'', () => {
    const result = S.sanitizeText('"hello" \'world\'');
    assert.ok(result.includes('&quot;'), `expected &quot; in: ${result}`);
    assert.ok(result.includes('&#39;'), `expected &#39; in: ${result}`);
  });

  it('sanitizeText leaves plain text unchanged', () => {
    const result = S.sanitizeText('hello world');
    assert.equal(result, 'hello world');
  });
});

describe('html-sanitizer – sanitizeSearchHighlight()', () => {
  it('sanitizeSearchHighlight wraps matches in <mark> tags', () => {
    const result = S.sanitizeSearchHighlight('hello world', 'world');
    assert.ok(result.includes('<mark>'), `expected <mark> in: ${result}`);
    assert.ok(result.includes('</mark>'), `expected </mark> in: ${result}`);
    assert.ok(result.includes('world'), `expected 'world' in: ${result}`);
  });

  it('sanitizeSearchHighlight is case-insensitive', () => {
    const result = S.sanitizeSearchHighlight('Hello World', 'hello');
    assert.ok(result.includes('<mark>'), `expected <mark> in: ${result}`);
    assert.ok(result.includes('Hello'), `expected 'Hello' in: ${result}`);
  });

  it('sanitizeSearchHighlight handles empty query (returns escaped text)', () => {
    const result = S.sanitizeSearchHighlight('hello', '');
    assert.equal(typeof result, 'string');
    assert.ok(!result.includes('<mark>'), `no <mark> expected for empty query: ${result}`);
    assert.ok(result.includes('hello'), `expected 'hello' in: ${result}`);
  });

  it('sanitizeSearchHighlight handles whitespace-only query', () => {
    const result = S.sanitizeSearchHighlight('hello world', '   ');
    assert.ok(!result.includes('<mark>'), `no <mark> expected for whitespace query: ${result}`);
  });

  it('sanitizeSearchHighlight escapes text outside matches', () => {
    const result = S.sanitizeSearchHighlight('a & b match c', 'match');
    assert.ok(result.includes('&amp;'), `expected &amp; in: ${result}`);
    assert.ok(result.includes('<mark>match</mark>'), `expected <mark>match</mark> in: ${result}`);
  });

  it('sanitizeSearchHighlight handles multiple matches', () => {
    const result = S.sanitizeSearchHighlight('foo bar foo', 'foo');
    const count = (result.match(/<mark>/g) || []).length;
    assert.equal(count, 2, `expected 2 <mark> tags, got ${count}: ${result}`);
  });
});

describe('html-sanitizer – stripTags()', () => {
  it('stripTags("<b>hello</b>") returns "hello"', () => {
    const result = S.stripTags('<b>hello</b>');
    assert.equal(result, 'hello');
  });

  it('stripTags removes nested tags', () => {
    const result = S.stripTags('<div><p>text</p></div>');
    assert.equal(result, 'text');
  });

  it('stripTags returns empty string for tags-only input', () => {
    const result = S.stripTags('<br><hr/>');
    assert.equal(result, '');
  });

  it('stripTags leaves plain text unchanged', () => {
    const result = S.stripTags('no tags here');
    assert.equal(result, 'no tags here');
  });
});

describe('html-sanitizer – isSafeUrl()', () => {
  it('isSafeUrl("https://example.com") returns true', () => {
    assert.equal(S.isSafeUrl('https://example.com'), true);
  });

  it('isSafeUrl("http://example.com") returns true', () => {
    assert.equal(S.isSafeUrl('http://example.com'), true);
  });

  it('isSafeUrl("javascript:alert(1)") returns false', () => {
    assert.equal(S.isSafeUrl('javascript:alert(1)'), false);
  });

  it('isSafeUrl("data:text/html,<script>") returns false', () => {
    assert.equal(S.isSafeUrl('data:text/html,<script>'), false);
  });

  it('isSafeUrl("data:image/png;base64,...") returns true', () => {
    assert.equal(S.isSafeUrl('data:image/png;base64,abc123'), true);
  });

  it('isSafeUrl("data:image/jpeg;base64,...") returns true', () => {
    assert.equal(S.isSafeUrl('data:image/jpeg;base64,abc'), true);
  });

  it('isSafeUrl("data:application/pdf") returns false', () => {
    assert.equal(S.isSafeUrl('data:application/pdf'), false);
  });

  it('isSafeUrl empty string returns false', () => {
    assert.equal(S.isSafeUrl(''), false);
  });
});

describe('html-sanitizer – sanitizeOcrOutput()', () => {
  it('sanitizeOcrOutput returns plain text (no HTML tags)', () => {
    const result = S.sanitizeOcrOutput('Hello World');
    assert.equal(result, 'Hello World');
  });

  it('sanitizeOcrOutput strips any HTML tags', () => {
    const result = S.sanitizeOcrOutput('<b>OCR</b> text <script>bad()</script>');
    assert.ok(!result.includes('<'), `expected no tags in: ${result}`);
    assert.ok(!result.includes('>'), `expected no tags in: ${result}`);
    assert.ok(result.includes('OCR'), `expected 'OCR' in: ${result}`);
    assert.ok(result.includes('text'), `expected 'text' in: ${result}`);
  });

  it('sanitizeOcrOutput returns empty string for empty input', () => {
    const result = S.sanitizeOcrOutput('');
    assert.equal(result, '');
  });

  it('sanitizeOcrOutput strips self-closing tags', () => {
    const result = S.sanitizeOcrOutput('line1<br/>line2');
    assert.ok(!result.includes('<'), `expected no < in: ${result}`);
  });
});
