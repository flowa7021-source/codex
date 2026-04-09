// ─── Unit Tests: url-utils ────────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  parseURL,
  getQueryParam,
  setQueryParam,
  removeQueryParam,
  getAllQueryParams,
  isAbsoluteURL,
  joinURL,
  getURLExtension,
  getURLFilename,
  sameOrigin,
  normalizeURL,
} from '../../app/modules/url-utils.js';

// ─── parseURL ─────────────────────────────────────────────────────────────────

describe('parseURL', () => {
  it('returns a URL object for a valid URL', () => {
    const result = parseURL('https://example.com/path?q=1');
    assert.ok(result instanceof URL);
    assert.equal(result.hostname, 'example.com');
  });

  it('returns null for an invalid URL', () => {
    assert.equal(parseURL('not a url'), null);
  });

  it('returns null for an empty string', () => {
    assert.equal(parseURL(''), null);
  });

  it('parses URL with port', () => {
    const result = parseURL('http://localhost:3000/app');
    assert.ok(result instanceof URL);
    assert.equal(result.port, '3000');
  });
});

// ─── getQueryParam ────────────────────────────────────────────────────────────

describe('getQueryParam', () => {
  it('returns the value of an existing query parameter', () => {
    assert.equal(getQueryParam('https://example.com?foo=bar', 'foo'), 'bar');
  });

  it('returns null for a missing query parameter', () => {
    assert.equal(getQueryParam('https://example.com?foo=bar', 'baz'), null);
  });

  it('returns null for an invalid URL', () => {
    assert.equal(getQueryParam('not-a-url', 'foo'), null);
  });

  it('returns empty string for a param with no value', () => {
    assert.equal(getQueryParam('https://example.com?foo=', 'foo'), '');
  });
});

// ─── setQueryParam ────────────────────────────────────────────────────────────

describe('setQueryParam', () => {
  it('adds a new query parameter', () => {
    const result = setQueryParam('https://example.com/', 'page', '2');
    const parsed = new URL(result);
    assert.equal(parsed.searchParams.get('page'), '2');
  });

  it('updates an existing query parameter', () => {
    const result = setQueryParam('https://example.com/?page=1', 'page', '5');
    const parsed = new URL(result);
    assert.equal(parsed.searchParams.get('page'), '5');
  });

  it('preserves existing parameters when adding a new one', () => {
    const result = setQueryParam('https://example.com/?a=1', 'b', '2');
    const parsed = new URL(result);
    assert.equal(parsed.searchParams.get('a'), '1');
    assert.equal(parsed.searchParams.get('b'), '2');
  });

  it('returns original string for invalid URL', () => {
    const invalid = 'not-a-url';
    assert.equal(setQueryParam(invalid, 'foo', 'bar'), invalid);
  });
});

// ─── removeQueryParam ─────────────────────────────────────────────────────────

describe('removeQueryParam', () => {
  it('removes an existing query parameter', () => {
    const result = removeQueryParam('https://example.com/?foo=1&bar=2', 'foo');
    const parsed = new URL(result);
    assert.equal(parsed.searchParams.get('foo'), null);
    assert.equal(parsed.searchParams.get('bar'), '2');
  });

  it('is a no-op for a missing parameter', () => {
    const url = 'https://example.com/?foo=1';
    const result = removeQueryParam(url, 'bar');
    const parsed = new URL(result);
    assert.equal(parsed.searchParams.get('foo'), '1');
  });

  it('returns original string for invalid URL', () => {
    const invalid = 'not-a-url';
    assert.equal(removeQueryParam(invalid, 'foo'), invalid);
  });
});

// ─── getAllQueryParams ────────────────────────────────────────────────────────

describe('getAllQueryParams', () => {
  it('returns all query params as an object', () => {
    const result = getAllQueryParams('https://example.com/?a=1&b=2&c=3');
    assert.deepEqual(result, { a: '1', b: '2', c: '3' });
  });

  it('returns empty object for URL with no query params', () => {
    assert.deepEqual(getAllQueryParams('https://example.com/'), {});
  });

  it('returns empty object for invalid URL', () => {
    assert.deepEqual(getAllQueryParams('not-a-url'), {});
  });

  it('handles URL-encoded values', () => {
    const result = getAllQueryParams('https://example.com/?name=hello%20world');
    assert.deepEqual(result, { name: 'hello world' });
  });
});

// ─── isAbsoluteURL ───────────────────────────────────────────────────────────

describe('isAbsoluteURL', () => {
  it('returns true for http URL', () => {
    assert.equal(isAbsoluteURL('http://example.com'), true);
  });

  it('returns true for https URL', () => {
    assert.equal(isAbsoluteURL('https://example.com/path'), true);
  });

  it('returns true for custom scheme', () => {
    assert.equal(isAbsoluteURL('ftp://files.example.com'), true);
  });

  it('returns false for relative path', () => {
    assert.equal(isAbsoluteURL('/path/to/file'), false);
  });

  it('returns false for bare relative path', () => {
    assert.equal(isAbsoluteURL('path/to/file'), false);
  });

  it('returns false for empty string', () => {
    assert.equal(isAbsoluteURL(''), false);
  });
});

// ─── joinURL ──────────────────────────────────────────────────────────────────

describe('joinURL', () => {
  it('joins base and a single path segment', () => {
    assert.equal(joinURL('https://example.com', 'path'), 'https://example.com/path');
  });

  it('handles trailing slash on base', () => {
    assert.equal(joinURL('https://example.com/', 'path'), 'https://example.com/path');
  });

  it('handles leading slash on segment', () => {
    assert.equal(joinURL('https://example.com', '/path'), 'https://example.com/path');
  });

  it('joins multiple segments', () => {
    assert.equal(
      joinURL('https://example.com', 'a', 'b', 'c'),
      'https://example.com/a/b/c'
    );
  });

  it('strips double slashes between parts', () => {
    assert.equal(joinURL('https://example.com/', '/path/'), 'https://example.com/path');
  });
});

// ─── getURLExtension ─────────────────────────────────────────────────────────

describe('getURLExtension', () => {
  it('returns the extension for a .pdf URL', () => {
    assert.equal(getURLExtension('https://example.com/file.pdf'), 'pdf');
  });

  it('returns the extension for a .jpg URL', () => {
    assert.equal(getURLExtension('https://example.com/images/photo.jpg'), 'jpg');
  });

  it('returns empty string when no extension', () => {
    assert.equal(getURLExtension('https://example.com/path/noext'), '');
  });

  it('ignores query string when determining extension', () => {
    assert.equal(getURLExtension('https://example.com/file.pdf?dl=1'), 'pdf');
  });

  it('returns empty string for root path', () => {
    assert.equal(getURLExtension('https://example.com/'), '');
  });
});

// ─── getURLFilename ──────────────────────────────────────────────────────────

describe('getURLFilename', () => {
  it('extracts the filename with extension', () => {
    assert.equal(getURLFilename('https://example.com/docs/report.pdf'), 'report.pdf');
  });

  it('extracts a filename without extension', () => {
    assert.equal(getURLFilename('https://example.com/path/readme'), 'readme');
  });

  it('does not include query string', () => {
    assert.equal(getURLFilename('https://example.com/file.txt?v=1'), 'file.txt');
  });

  it('does not include hash fragment', () => {
    assert.equal(getURLFilename('https://example.com/doc.html#section'), 'doc.html');
  });
});

// ─── sameOrigin ───────────────────────────────────────────────────────────────

describe('sameOrigin', () => {
  it('returns true for URLs with the same origin', () => {
    assert.equal(
      sameOrigin('https://example.com/page1', 'https://example.com/page2'),
      true
    );
  });

  it('returns false for URLs with different origins', () => {
    assert.equal(
      sameOrigin('https://example.com/', 'https://other.com/'),
      false
    );
  });

  it('returns false for different protocols', () => {
    assert.equal(
      sameOrigin('http://example.com/', 'https://example.com/'),
      false
    );
  });

  it('returns false for different ports', () => {
    assert.equal(
      sameOrigin('https://example.com:8080/', 'https://example.com/'),
      false
    );
  });

  it('returns false when either URL is invalid', () => {
    assert.equal(sameOrigin('not-a-url', 'https://example.com/'), false);
    assert.equal(sameOrigin('https://example.com/', 'not-a-url'), false);
  });
});

// ─── normalizeURL ─────────────────────────────────────────────────────────────

describe('normalizeURL', () => {
  it('lowercases the host', () => {
    const result = normalizeURL('https://EXAMPLE.COM/path');
    assert.ok(result.includes('example.com'));
  });

  it('sorts query params alphabetically', () => {
    const result = normalizeURL('https://example.com/?z=1&a=2&m=3');
    const parsed = new URL(result);
    const keys = [...parsed.searchParams.keys()];
    assert.deepEqual(keys, ['a', 'm', 'z']);
  });

  it('removes default port 80 for http', () => {
    const result = normalizeURL('http://example.com:80/');
    assert.ok(!result.includes(':80'));
  });

  it('removes default port 443 for https', () => {
    const result = normalizeURL('https://example.com:443/');
    assert.ok(!result.includes(':443'));
  });

  it('returns original string for invalid URL', () => {
    assert.equal(normalizeURL('not-a-url'), 'not-a-url');
  });
});
