// ─── Unit Tests: URL Pattern API ──────────────────────────────────────────────
import './setup-dom.js';
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

import {
  isURLPatternSupported,
  matchURLPattern,
  testURLPattern,
  extractURLGroups,
  routeURL,
} from '../../app/modules/url-pattern.js';

// ─── Mock setup ───────────────────────────────────────────────────────────────

// Check if URLPattern is available (Node 19+); mock if not
if (typeof globalThis.URLPattern === 'undefined') {
  // Simple mock that handles both full-URL and pathname-only patterns
  globalThis.URLPattern = class URLPattern {
    constructor(pattern) {
      this._rawPattern = typeof pattern === 'string' ? pattern : (pattern.pathname || '');
      this._isFullURL = this._rawPattern.startsWith('http://') || this._rawPattern.startsWith('https://');
    }
    test(url) {
      try {
        if (this._isFullURL) {
          // For full URL patterns: compare full URL or prefix
          const pat = this._rawPattern.replace(/\*$/, '');
          return url === this._rawPattern || url.startsWith(pat);
        }
        // For pathname patterns: compare pathname
        const pathname = new URL(url).pathname;
        const pat = this._rawPattern.replace(/\*$/, '');
        return pathname === this._rawPattern || pathname.startsWith(pat);
      } catch { return false; }
    }
    exec(url) {
      if (!this.test(url)) return null;
      let pathname;
      try { pathname = new URL(url).pathname; } catch { pathname = url; }
      return {
        pathname: { groups: {}, input: pathname },
        search: { groups: {}, input: '' },
        hash: { groups: {}, input: '' },
      };
    }
  };
}

// ─── isURLPatternSupported ────────────────────────────────────────────────────

describe('isURLPatternSupported', () => {
  it('returns a boolean', () => {
    assert.equal(typeof isURLPatternSupported(), 'boolean');
  });

  it('returns true when URLPattern is defined', () => {
    // Mock is installed above, so URLPattern is always defined at this point
    assert.equal(isURLPatternSupported(), true);
  });

  it('returns false when URLPattern is undefined', () => {
    const original = globalThis.URLPattern;
    delete globalThis.URLPattern;
    assert.equal(isURLPatternSupported(), false);
    globalThis.URLPattern = original;
  });
});

// ─── matchURLPattern ──────────────────────────────────────────────────────────

describe('matchURLPattern', () => {
  it('returns a result object for a matching URL', () => {
    const result = matchURLPattern('https://example.com/docs', 'https://example.com/docs');
    assert.notEqual(result, null);
    assert.equal(typeof result, 'object');
  });

  it('returns null for a non-matching URL', () => {
    const result = matchURLPattern('https://example.com/docs', 'https://example.com/other');
    assert.equal(result, null);
  });

  it('returns null when URLPattern is unsupported', () => {
    const original = globalThis.URLPattern;
    delete globalThis.URLPattern;
    const result = matchURLPattern('/some/path', 'https://example.com/some/path');
    assert.equal(result, null);
    globalThis.URLPattern = original;
  });

  it('returns null on constructor error (invalid pattern)', () => {
    const badURLPattern = class {
      constructor() { throw new Error('bad pattern'); }
    };
    const original = globalThis.URLPattern;
    globalThis.URLPattern = badURLPattern;
    const result = matchURLPattern('invalid', 'https://example.com/');
    assert.equal(result, null);
    globalThis.URLPattern = original;
  });

  it('returns result with pathname property for matching URL', () => {
    const result = matchURLPattern('https://example.com/docs', 'https://example.com/docs');
    assert.ok(result !== null && 'pathname' in result);
  });
});

// ─── testURLPattern ───────────────────────────────────────────────────────────

describe('testURLPattern', () => {
  it('returns true for a matching URL', () => {
    assert.equal(testURLPattern('https://example.com/docs', 'https://example.com/docs'), true);
  });

  it('returns false for a non-matching URL', () => {
    assert.equal(testURLPattern('https://example.com/docs', 'https://example.com/other'), false);
  });

  it('returns false when URLPattern is unsupported', () => {
    const original = globalThis.URLPattern;
    delete globalThis.URLPattern;
    assert.equal(testURLPattern('/path', 'https://example.com/path'), false);
    globalThis.URLPattern = original;
  });

  it('returns false on constructor error', () => {
    const badURLPattern = class {
      constructor() { throw new Error('error'); }
    };
    const original = globalThis.URLPattern;
    globalThis.URLPattern = badURLPattern;
    assert.equal(testURLPattern('x', 'https://example.com/'), false);
    globalThis.URLPattern = original;
  });
});

// ─── extractURLGroups ─────────────────────────────────────────────────────────

describe('extractURLGroups', () => {
  it('returns an object for a matching URL', () => {
    const groups = extractURLGroups('https://example.com/docs', 'https://example.com/docs');
    assert.notEqual(groups, null);
    assert.equal(typeof groups, 'object');
  });

  it('returns null for a non-matching URL', () => {
    const groups = extractURLGroups('https://example.com/docs', 'https://example.com/other');
    assert.equal(groups, null);
  });

  it('returns null when URLPattern is unsupported', () => {
    const original = globalThis.URLPattern;
    delete globalThis.URLPattern;
    const groups = extractURLGroups('/path', 'https://example.com/path');
    assert.equal(groups, null);
    globalThis.URLPattern = original;
  });

  it('returns named groups from the match result', () => {
    // Use a mock that returns groups to verify extraction
    const original = globalThis.URLPattern;
    globalThis.URLPattern = class {
      test() { return true; }
      exec() {
        return {
          pathname: { groups: { id: '42', slug: 'hello' }, input: '/article/42/hello' },
          search: { groups: {}, input: '' },
          hash: { groups: {}, input: '' },
        };
      }
    };
    const groups = extractURLGroups('/article/:id/:slug', 'https://example.com/article/42/hello');
    assert.equal(groups?.id, '42');
    assert.equal(groups?.slug, 'hello');
    globalThis.URLPattern = original;
  });

  it('merges groups from multiple URL components', () => {
    const original = globalThis.URLPattern;
    globalThis.URLPattern = class {
      test() { return true; }
      exec() {
        return {
          pathname: { groups: { section: 'news' }, input: '/news' },
          search: { groups: { q: 'latest' }, input: '?q=latest' },
          hash: { groups: {}, input: '' },
        };
      }
    };
    const groups = extractURLGroups('/:section', 'https://example.com/news?q=latest');
    assert.equal(groups?.section, 'news');
    assert.equal(groups?.q, 'latest');
    globalThis.URLPattern = original;
  });
});

// ─── routeURL ─────────────────────────────────────────────────────────────────

describe('routeURL', () => {
  it('calls the matching handler', () => {
    let called = false;
    const routes = [
      {
        pattern: 'https://example.com/docs',
        handler: () => { called = true; },
      },
    ];
    const matched = routeURL('https://example.com/docs', routes);
    assert.equal(matched, true);
    assert.equal(called, true);
  });

  it('passes groups to the handler', () => {
    const original = globalThis.URLPattern;
    globalThis.URLPattern = class {
      test() { return true; }
      exec() {
        return {
          pathname: { groups: { id: '99' }, input: '/item/99' },
          search: { groups: {}, input: '' },
          hash: { groups: {}, input: '' },
        };
      }
    };

    let receivedGroups = null;
    const routes = [
      {
        pattern: '/item/:id',
        handler: (groups) => { receivedGroups = groups; },
      },
    ];
    routeURL('https://example.com/item/99', routes);
    assert.equal(receivedGroups?.id, '99');
    globalThis.URLPattern = original;
  });

  it('returns false when no route matches', () => {
    const routes = [
      {
        pattern: 'https://example.com/docs',
        handler: () => {},
      },
    ];
    const matched = routeURL('https://example.com/other', routes);
    assert.equal(matched, false);
  });

  it('returns false for empty routes array', () => {
    const matched = routeURL('https://example.com/docs', []);
    assert.equal(matched, false);
  });

  it('calls only the first matching handler', () => {
    const original = globalThis.URLPattern;
    globalThis.URLPattern = class {
      constructor(pattern) { this._pattern = pattern; }
      test() { return true; }
      exec() {
        return {
          pathname: { groups: {}, input: '/docs' },
          search: { groups: {}, input: '' },
          hash: { groups: {}, input: '' },
        };
      }
    };

    const calls = [];
    const routes = [
      { pattern: 'https://example.com/docs', handler: () => { calls.push('first'); } },
      { pattern: 'https://example.com/docs', handler: () => { calls.push('second'); } },
    ];
    routeURL('https://example.com/docs', routes);
    assert.deepEqual(calls, ['first']);
    globalThis.URLPattern = original;
  });

  it('returns false when URLPattern is unsupported', () => {
    const original = globalThis.URLPattern;
    delete globalThis.URLPattern;
    let called = false;
    const routes = [{ pattern: '/path', handler: () => { called = true; } }];
    const matched = routeURL('https://example.com/path', routes);
    assert.equal(matched, false);
    assert.equal(called, false);
    globalThis.URLPattern = original;
  });
});
