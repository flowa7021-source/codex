// ─── Unit Tests: Text Fragment URL Utilities ─────────────────────────────────
import './setup-dom.js';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildTextFragmentUrl,
  parseTextFragment,
  isTextFragmentSupported,
  scrollToTextFragment,
  stripTextFragment,
} from '../../app/modules/text-fragment.js';

// ─── buildTextFragmentUrl ─────────────────────────────────────────────────────

describe('buildTextFragmentUrl', () => {
  it('builds a basic text fragment URL', () => {
    const url = buildTextFragmentUrl('https://example.com', 'hello');
    assert.equal(url, 'https://example.com#:~:text=hello');
  });

  it('encodes special characters in the text', () => {
    const url = buildTextFragmentUrl('https://example.com', 'hello world');
    assert.equal(url, 'https://example.com#:~:text=hello%20world');
  });

  it('includes prefix when provided', () => {
    const url = buildTextFragmentUrl('https://example.com', 'quick', { prefix: 'the' });
    assert.equal(url, 'https://example.com#:~:text=the-,quick');
  });

  it('includes suffix when provided', () => {
    const url = buildTextFragmentUrl('https://example.com', 'quick', { suffix: 'brown' });
    assert.equal(url, 'https://example.com#:~:text=quick,-brown');
  });

  it('includes both prefix and suffix when provided', () => {
    const url = buildTextFragmentUrl('https://example.com', 'quick', { prefix: 'the', suffix: 'brown' });
    assert.equal(url, 'https://example.com#:~:text=the-,quick,-brown');
  });

  it('encodes special chars in prefix and suffix', () => {
    const url = buildTextFragmentUrl('https://example.com', 'fox', {
      prefix: 'lazy dog',
      suffix: 'jumps over',
    });
    assert.ok(url.includes('lazy%20dog-,'));
    assert.ok(url.includes(',-jumps%20over'));
  });

  it('handles empty text', () => {
    const url = buildTextFragmentUrl('https://example.com', '');
    assert.equal(url, 'https://example.com#:~:text=');
  });

  it('works with a base URL that already has a path', () => {
    const url = buildTextFragmentUrl('https://example.com/doc.pdf', 'section');
    assert.equal(url, 'https://example.com/doc.pdf#:~:text=section');
  });

  it('encodes ampersands in text', () => {
    const url = buildTextFragmentUrl('https://example.com', 'cats & dogs');
    assert.ok(url.includes('cats%20%26%20dogs'));
  });
});

// ─── parseTextFragment ────────────────────────────────────────────────────────

describe('parseTextFragment', () => {
  it('returns parsed object for a simple text fragment', () => {
    const result = parseTextFragment('https://example.com#:~:text=hello');
    assert.ok(result !== null);
    assert.equal(result.text, 'hello');
    assert.equal(result.prefix, undefined);
    assert.equal(result.suffix, undefined);
  });

  it('returns null for a normal hash anchor', () => {
    const result = parseTextFragment('https://example.com#section-1');
    assert.equal(result, null);
  });

  it('returns null for a URL without any hash', () => {
    const result = parseTextFragment('https://example.com');
    assert.equal(result, null);
  });

  it('parses encoded characters back to the original text', () => {
    const result = parseTextFragment('https://example.com#:~:text=hello%20world');
    assert.ok(result !== null);
    assert.equal(result.text, 'hello world');
  });

  it('parses prefix correctly', () => {
    const result = parseTextFragment('https://example.com#:~:text=the-,quick');
    assert.ok(result !== null);
    assert.equal(result.text, 'quick');
    assert.equal(result.prefix, 'the');
  });

  it('parses suffix correctly', () => {
    const result = parseTextFragment('https://example.com#:~:text=quick,-brown');
    assert.ok(result !== null);
    assert.equal(result.text, 'quick');
    assert.equal(result.suffix, 'brown');
  });

  it('parses both prefix and suffix correctly', () => {
    const result = parseTextFragment('https://example.com#:~:text=the-,quick,-brown');
    assert.ok(result !== null);
    assert.equal(result.text, 'quick');
    assert.equal(result.prefix, 'the');
    assert.equal(result.suffix, 'brown');
  });

  it('round-trips with buildTextFragmentUrl', () => {
    const original = { text: 'jumps over', prefix: 'fox', suffix: 'the' };
    const url = buildTextFragmentUrl('https://example.com', original.text, {
      prefix: original.prefix,
      suffix: original.suffix,
    });
    const parsed = parseTextFragment(url);
    assert.ok(parsed !== null);
    assert.equal(parsed.text, original.text);
    assert.equal(parsed.prefix, original.prefix);
    assert.equal(parsed.suffix, original.suffix);
  });

  it('returns null for an empty string', () => {
    const result = parseTextFragment('');
    assert.equal(result, null);
  });
});

// ─── isTextFragmentSupported ──────────────────────────────────────────────────

describe('isTextFragmentSupported', () => {
  it('returns true (text fragments are a URL feature, always constructible)', () => {
    assert.equal(isTextFragmentSupported(), true);
  });

  it('returns a boolean', () => {
    assert.equal(typeof isTextFragmentSupported(), 'boolean');
  });
});

// ─── scrollToTextFragment ─────────────────────────────────────────────────────

describe('scrollToTextFragment', () => {
  it('does not throw when location is available', () => {
    assert.doesNotThrow(() => scrollToTextFragment('hello'));
  });

  it('sets location.hash with encoded text', () => {
    // setup-dom provides window.location; make location accessible
    if (typeof globalThis.location === 'undefined') {
      globalThis.location = { hash: '' };
    }
    globalThis.location.hash = '';
    scrollToTextFragment('hello world');
    assert.equal(globalThis.location.hash, '#:~:text=hello%20world');
  });
});

// ─── stripTextFragment ────────────────────────────────────────────────────────

describe('stripTextFragment', () => {
  it('removes #:~:text=... from a URL', () => {
    const result = stripTextFragment('https://example.com#:~:text=hello');
    assert.equal(result, 'https://example.com');
  });

  it('keeps a normal #anchor fragment intact', () => {
    const result = stripTextFragment('https://example.com#section-1');
    assert.equal(result, 'https://example.com#section-1');
  });

  it('handles a URL without any hash', () => {
    const result = stripTextFragment('https://example.com');
    assert.equal(result, 'https://example.com');
  });

  it('removes text fragment with prefix and suffix', () => {
    const result = stripTextFragment('https://example.com#:~:text=the-,quick,-brown');
    assert.equal(result, 'https://example.com');
  });

  it('handles empty string input', () => {
    const result = stripTextFragment('');
    assert.equal(result, '');
  });
});
