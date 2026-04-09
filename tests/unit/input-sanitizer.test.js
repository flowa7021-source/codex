// ─── Unit Tests: input-sanitizer ─────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  stripHTML,
  escapeHTML,
  unescapeHTML,
  sanitizeFilename,
  normalizeWhitespace,
  truncateText,
  removeControlChars,
  sanitizeCssClass,
  sanitizeURL,
  normalizeLineEndings,
} from '../../app/modules/input-sanitizer.js';

// ─── stripHTML ───────────────────────────────────────────────────────────────

describe('stripHTML', () => {
  it('removes simple tags and keeps text', () => {
    assert.equal(stripHTML('<b>bold</b>'), 'bold');
  });

  it('removes multiple tags', () => {
    assert.equal(stripHTML('<p>Hello <em>world</em></p>'), 'Hello world');
  });

  it('removes self-closing tags', () => {
    assert.equal(stripHTML('line<br/>break'), 'linebreak');
  });

  it('returns empty string for tag-only input', () => {
    assert.equal(stripHTML('<div><span></span></div>'), '');
  });

  it('leaves plain text unchanged', () => {
    assert.equal(stripHTML('no tags here'), 'no tags here');
  });

  it('handles input with attributes', () => {
    assert.equal(stripHTML('<a href="http://example.com">link</a>'), 'link');
  });

  it('handles empty string', () => {
    assert.equal(stripHTML(''), '');
  });
});

// ─── escapeHTML ──────────────────────────────────────────────────────────────

describe('escapeHTML', () => {
  it('escapes <', () => {
    assert.equal(escapeHTML('<'), '&lt;');
  });

  it('escapes >', () => {
    assert.equal(escapeHTML('>'), '&gt;');
  });

  it('escapes &', () => {
    assert.equal(escapeHTML('&'), '&amp;');
  });

  it('escapes "', () => {
    assert.equal(escapeHTML('"'), '&quot;');
  });

  it("escapes '", () => {
    assert.equal(escapeHTML("'"), '&#39;');
  });

  it('escapes all special chars in a combined string', () => {
    assert.equal(escapeHTML('<script>alert("xss")</script>'), '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  });

  it('leaves plain text unchanged', () => {
    assert.equal(escapeHTML('hello world'), 'hello world');
  });

  it('handles empty string', () => {
    assert.equal(escapeHTML(''), '');
  });
});

// ─── unescapeHTML ────────────────────────────────────────────────────────────

describe('unescapeHTML', () => {
  it('unescapes &lt; to <', () => {
    assert.equal(unescapeHTML('&lt;'), '<');
  });

  it('unescapes &gt; to >', () => {
    assert.equal(unescapeHTML('&gt;'), '>');
  });

  it('unescapes &amp; to &', () => {
    assert.equal(unescapeHTML('&amp;'), '&');
  });

  it('unescapes &quot; to "', () => {
    assert.equal(unescapeHTML('&quot;'), '"');
  });

  it("unescapes &#39; to '", () => {
    assert.equal(unescapeHTML('&#39;'), "'");
  });

  it('roundtrips with escapeHTML', () => {
    const original = '<div class="test">Hello & \'world\'</div>';
    assert.equal(unescapeHTML(escapeHTML(original)), original);
  });

  it('handles empty string', () => {
    assert.equal(unescapeHTML(''), '');
  });

  it('leaves plain text unchanged', () => {
    assert.equal(unescapeHTML('hello world'), 'hello world');
  });
});

// ─── sanitizeFilename ────────────────────────────────────────────────────────

describe('sanitizeFilename', () => {
  it('removes forward slashes', () => {
    assert.equal(sanitizeFilename('path/to/file.txt'), 'pathtof ile.txt'.replace(' ', ''));
    assert.equal(sanitizeFilename('path/to/file.txt'), 'pathtofile.txt');
  });

  it('removes backslashes', () => {
    assert.equal(sanitizeFilename('path\\file.txt'), 'pathfile.txt');
  });

  it('removes directory traversal sequences', () => {
    assert.equal(sanitizeFilename('../../etc/passwd'), 'etcpasswd');
  });

  it('removes Windows-reserved characters', () => {
    const input = 'file<>:"|?*.txt';
    const result = sanitizeFilename(input);
    assert.ok(!result.includes('<'));
    assert.ok(!result.includes('>'));
    assert.ok(!result.includes(':'));
    assert.ok(!result.includes('"'));
    assert.ok(!result.includes('|'));
    assert.ok(!result.includes('?'));
    assert.ok(!result.includes('*'));
  });

  it('preserves valid filename characters', () => {
    assert.equal(sanitizeFilename('my-file_2024.txt'), 'my-file_2024.txt');
  });

  it('handles empty string', () => {
    assert.equal(sanitizeFilename(''), '');
  });
});

// ─── normalizeWhitespace ─────────────────────────────────────────────────────

describe('normalizeWhitespace', () => {
  it('trims leading and trailing whitespace', () => {
    assert.equal(normalizeWhitespace('  hello  '), 'hello');
  });

  it('collapses multiple internal spaces to one', () => {
    assert.equal(normalizeWhitespace('hello   world'), 'hello world');
  });

  it('collapses tabs and newlines to single space', () => {
    assert.equal(normalizeWhitespace('hello\t\nworld'), 'hello world');
  });

  it('handles string with only whitespace', () => {
    assert.equal(normalizeWhitespace('   '), '');
  });

  it('leaves already-normalized string unchanged', () => {
    assert.equal(normalizeWhitespace('hello world'), 'hello world');
  });

  it('handles empty string', () => {
    assert.equal(normalizeWhitespace(''), '');
  });
});

// ─── truncateText ─────────────────────────────────────────────────────────────

describe('truncateText', () => {
  it('returns string unchanged when within max length', () => {
    assert.equal(truncateText('hello', 10), 'hello');
  });

  it('returns string unchanged when equal to max length', () => {
    assert.equal(truncateText('hello', 5), 'hello');
  });

  it('truncates and adds default ellipsis when over max length', () => {
    const result = truncateText('hello world', 8);
    assert.equal(result.length, 8);
    assert.ok(result.endsWith('…'));
  });

  it('uses custom ellipsis when provided', () => {
    const result = truncateText('hello world', 8, '...');
    assert.equal(result.length, 8);
    assert.ok(result.endsWith('...'));
  });

  it('handles maxLength smaller than ellipsis length gracefully', () => {
    // When maxLength < ellipsis.length, returns first maxLength chars of ellipsis
    const result = truncateText('hello world', 2, '...');
    assert.equal(result, '..');
    assert.ok(result.length <= 2);
  });

  it('handles empty string', () => {
    assert.equal(truncateText('', 5), '');
  });
});

// ─── removeControlChars ──────────────────────────────────────────────────────

describe('removeControlChars', () => {
  it('removes null byte', () => {
    assert.equal(removeControlChars('hel\x00lo'), 'hello');
  });

  it('removes all control characters in \\x00-\\x1f range', () => {
    const input = '\x00\x01\x1f\x1e normal text';
    const result = removeControlChars(input);
    assert.equal(result, ' normal text');
  });

  it('removes DEL character (\\x7f)', () => {
    assert.equal(removeControlChars('hello\x7fworld'), 'helloworld');
  });

  it('preserves regular ASCII text', () => {
    assert.equal(removeControlChars('Hello, World!'), 'Hello, World!');
  });

  it('preserves tab and newline are removed (they are control chars)', () => {
    const result = removeControlChars('a\tb\nc');
    // \t = \x09, \n = \x0a — both in control range
    assert.equal(result, 'abc');
  });

  it('handles empty string', () => {
    assert.equal(removeControlChars(''), '');
  });
});

// ─── sanitizeCssClass ────────────────────────────────────────────────────────

describe('sanitizeCssClass', () => {
  it('lowercases input', () => {
    assert.equal(sanitizeCssClass('MyClass'), 'myclass');
  });

  it('replaces spaces with hyphens', () => {
    assert.equal(sanitizeCssClass('my class'), 'my-class');
  });

  it('replaces invalid chars with hyphens', () => {
    // @ and ! are invalid; trailing hyphens are stripped
    assert.equal(sanitizeCssClass('foo@bar!'), 'foo-bar');
  });

  it('collapses consecutive hyphens', () => {
    assert.equal(sanitizeCssClass('foo  bar'), 'foo-bar');
  });

  it('removes leading and trailing hyphens', () => {
    assert.equal(sanitizeCssClass('!myclass!'), 'myclass');
  });

  it('preserves valid class names unchanged', () => {
    assert.equal(sanitizeCssClass('my-class_name'), 'my-class_name');
  });

  it('preserves numbers in class name', () => {
    assert.equal(sanitizeCssClass('item-1'), 'item-1');
  });

  it('handles empty string', () => {
    assert.equal(sanitizeCssClass(''), '');
  });
});

// ─── sanitizeURL ─────────────────────────────────────────────────────────────

describe('sanitizeURL', () => {
  it('allows http URLs', () => {
    assert.equal(sanitizeURL('http://example.com'), 'http://example.com');
  });

  it('allows https URLs', () => {
    assert.equal(sanitizeURL('https://example.com/path'), 'https://example.com/path');
  });

  it('blocks javascript: scheme', () => {
    assert.equal(sanitizeURL('javascript:alert(1)'), null);
  });

  it('blocks data: scheme', () => {
    assert.equal(sanitizeURL('data:text/html,<h1>test</h1>'), null);
  });

  it('blocks file: scheme', () => {
    assert.equal(sanitizeURL('file:///etc/passwd'), null);
  });

  it('blocks ftp: scheme', () => {
    assert.equal(sanitizeURL('ftp://example.com'), null);
  });

  it('returns null for plain text', () => {
    assert.equal(sanitizeURL('not a url'), null);
  });

  it('returns null for empty string', () => {
    assert.equal(sanitizeURL(''), null);
  });

  it('trims whitespace before checking', () => {
    assert.equal(sanitizeURL('  https://example.com  '), 'https://example.com');
  });
});

// ─── normalizeLineEndings ────────────────────────────────────────────────────

describe('normalizeLineEndings', () => {
  it('converts \\r\\n to \\n', () => {
    assert.equal(normalizeLineEndings('hello\r\nworld'), 'hello\nworld');
  });

  it('converts \\r to \\n', () => {
    assert.equal(normalizeLineEndings('hello\rworld'), 'hello\nworld');
  });

  it('leaves \\n unchanged', () => {
    assert.equal(normalizeLineEndings('hello\nworld'), 'hello\nworld');
  });

  it('handles mixed line endings', () => {
    const input = 'a\r\nb\rc\nd';
    assert.equal(normalizeLineEndings(input), 'a\nb\nc\nd');
  });

  it('handles string with no line endings', () => {
    assert.equal(normalizeLineEndings('no newlines here'), 'no newlines here');
  });

  it('handles empty string', () => {
    assert.equal(normalizeLineEndings(''), '');
  });
});
