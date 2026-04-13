// ─── Unit Tests: url-parser ───────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  parseUrl,
  buildUrl,
  resolveUrl,
  isAbsolute,
  isRelative,
  getOrigin,
  stripHash,
  stripSearch,
  normalizeUrl,
} from '../../app/modules/url-parser.js';

// ─── parseUrl ─────────────────────────────────────────────────────────────────

describe('parseUrl – protocol and host', () => {
  it('parses a simple https URL', () => {
    const p = parseUrl('https://example.com/path');
    assert.equal(p.protocol, 'https:');
    assert.equal(p.hostname, 'example.com');
    assert.equal(p.host, 'example.com');
    assert.equal(p.port, '');
    assert.equal(p.pathname, '/path');
  });

  it('parses a URL with an explicit port', () => {
    const p = parseUrl('http://localhost:8080/api');
    assert.equal(p.protocol, 'http:');
    assert.equal(p.hostname, 'localhost');
    assert.equal(p.port, '8080');
    assert.equal(p.host, 'localhost:8080');
    assert.equal(p.pathname, '/api');
  });

  it('parses a URL with no path (sets pathname to /)', () => {
    const p = parseUrl('https://example.com');
    assert.equal(p.pathname, '/');
  });

  it('parses the hash fragment', () => {
    const p = parseUrl('https://example.com/page#section');
    assert.equal(p.hash, '#section');
    assert.equal(p.pathname, '/page');
  });

  it('parses the query string', () => {
    const p = parseUrl('https://example.com/search?q=hello&lang=en');
    assert.equal(p.search, '?q=hello&lang=en');
    assert.equal(p.pathname, '/search');
  });

  it('parses both search and hash together', () => {
    const p = parseUrl('https://example.com/page?x=1#top');
    assert.equal(p.search, '?x=1');
    assert.equal(p.hash, '#top');
  });

  it('parses username and password from userinfo', () => {
    const p = parseUrl('ftp://user:pass@ftp.example.com/files');
    assert.equal(p.username, 'user');
    assert.equal(p.password, 'pass');
    assert.equal(p.hostname, 'ftp.example.com');
  });

  it('parses username without password', () => {
    const p = parseUrl('https://alice@example.com/');
    assert.equal(p.username, 'alice');
    assert.equal(p.password, '');
  });

  it('sets the origin correctly', () => {
    const p = parseUrl('https://example.com:443/path');
    assert.equal(p.origin, 'https://example.com:443');
  });

  it('stores the full href', () => {
    const url = 'https://example.com/path?q=1#top';
    const p = parseUrl(url);
    assert.equal(p.href, url);
  });

  it('handles an IPv6 host', () => {
    const p = parseUrl('http://[::1]:3000/api');
    assert.equal(p.hostname, '[::1]');
    assert.equal(p.port, '3000');
    assert.equal(p.pathname, '/api');
  });

  it('returns empty fields for a relative path-only URL', () => {
    const p = parseUrl('/relative/path');
    assert.equal(p.protocol, '');
    assert.equal(p.hostname, '');
    assert.equal(p.pathname, '/relative/path');
  });

  it('handles an empty string without throwing', () => {
    const p = parseUrl('');
    assert.equal(p.href, '');
    assert.equal(p.pathname, '');
  });
});

// ─── buildUrl ─────────────────────────────────────────────────────────────────

describe('buildUrl – construct from parts', () => {
  it('builds a basic https URL', () => {
    const url = buildUrl({ protocol: 'https:', hostname: 'example.com', pathname: '/path' });
    assert.equal(url, 'https://example.com/path');
  });

  it('includes port when provided', () => {
    const url = buildUrl({ protocol: 'http:', hostname: 'localhost', port: '3000', pathname: '/' });
    assert.equal(url, 'http://localhost:3000/');
  });

  it('appends the search string with leading ?', () => {
    const url = buildUrl({ protocol: 'https:', hostname: 'example.com', pathname: '/', search: '?q=test' });
    assert.equal(url, 'https://example.com/?q=test');
  });

  it('appends the hash with leading #', () => {
    const url = buildUrl({ protocol: 'https:', hostname: 'example.com', pathname: '/', hash: '#anchor' });
    assert.equal(url, 'https://example.com/#anchor');
  });

  it('includes username and password in the authority', () => {
    const url = buildUrl({ protocol: 'ftp:', username: 'user', password: 'pass', hostname: 'ftp.host.com', pathname: '/' });
    assert.equal(url, 'ftp://user:pass@ftp.host.com/');
  });

  it('includes username without password', () => {
    const url = buildUrl({ protocol: 'https:', username: 'alice', hostname: 'example.com', pathname: '/' });
    assert.equal(url, 'https://alice@example.com/');
  });

  it('builds a path-only URL from pathname alone', () => {
    const url = buildUrl({ pathname: '/foo/bar' });
    assert.equal(url, '/foo/bar');
  });

  it('adds ? before search when it is missing the leading character', () => {
    const url = buildUrl({ protocol: 'https:', hostname: 'example.com', pathname: '/', search: 'key=val' });
    assert.equal(url, 'https://example.com/?key=val');
  });

  it('adds # before hash when it is missing the leading character', () => {
    const url = buildUrl({ protocol: 'https:', hostname: 'example.com', pathname: '/', hash: 'section' });
    assert.equal(url, 'https://example.com/#section');
  });

  it('returns empty string for empty parts object', () => {
    const url = buildUrl({});
    assert.equal(url, '');
  });
});

// ─── resolveUrl ───────────────────────────────────────────────────────────────

describe('resolveUrl – resolve relative against base', () => {
  const base = 'https://example.com/foo/bar/page.html';

  it('returns absolute relative URL unchanged', () => {
    const result = resolveUrl(base, 'https://other.com/path');
    assert.equal(result, 'https://other.com/path');
  });

  it('resolves a relative file in the same directory', () => {
    const result = resolveUrl(base, 'other.html');
    assert.equal(result, 'https://example.com/foo/bar/other.html');
  });

  it('resolves .. to parent directory', () => {
    const result = resolveUrl(base, '../sibling.html');
    assert.equal(result, 'https://example.com/foo/sibling.html');
  });

  it('resolves an absolute path', () => {
    const result = resolveUrl(base, '/absolute/path');
    assert.equal(result, 'https://example.com/absolute/path');
  });

  it('resolves a fragment-only relative URL', () => {
    const result = resolveUrl(base, '#section');
    assert.equal(result, 'https://example.com/foo/bar/page.html#section');
  });

  it('resolves a query-only relative URL', () => {
    const result = resolveUrl(base, '?q=new');
    assert.equal(result, 'https://example.com/foo/bar/page.html?q=new');
  });

  it('resolves a protocol-relative URL using the base scheme', () => {
    const result = resolveUrl('https://example.com/', '//cdn.example.com/script.js');
    assert.equal(result, 'https://cdn.example.com/script.js');
  });

  it('returns base when relative is empty', () => {
    const result = resolveUrl(base, '');
    assert.equal(result, base);
  });

  it('resolves multiple .. segments', () => {
    const result = resolveUrl('https://example.com/a/b/c/page.html', '../../other.html');
    assert.equal(result, 'https://example.com/a/other.html');
  });
});

// ─── isAbsolute / isRelative ──────────────────────────────────────────────────

describe('isAbsolute / isRelative', () => {
  it('recognises https:// as absolute', () => {
    assert.equal(isAbsolute('https://example.com/'), true);
    assert.equal(isRelative('https://example.com/'), false);
  });

  it('recognises http:// as absolute', () => {
    assert.equal(isAbsolute('http://example.com'), true);
  });

  it('recognises ftp:// as absolute', () => {
    assert.equal(isAbsolute('ftp://files.example.com'), true);
  });

  it('treats a path starting with / as relative', () => {
    assert.equal(isAbsolute('/foo/bar'), false);
    assert.equal(isRelative('/foo/bar'), true);
  });

  it('treats a bare path as relative', () => {
    assert.equal(isAbsolute('relative/path'), false);
    assert.equal(isRelative('relative/path'), true);
  });

  it('treats a fragment-only string as relative', () => {
    assert.equal(isAbsolute('#hash'), false);
    assert.equal(isRelative('#hash'), true);
  });

  it('treats an empty string as relative', () => {
    assert.equal(isAbsolute(''), false);
    assert.equal(isRelative(''), true);
  });

  it('treats protocol-relative URL (//) as relative', () => {
    assert.equal(isAbsolute('//cdn.example.com/script.js'), false);
    assert.equal(isRelative('//cdn.example.com/script.js'), true);
  });
});

// ─── getOrigin ────────────────────────────────────────────────────────────────

describe('getOrigin', () => {
  it('returns scheme + host for https URL', () => {
    assert.equal(getOrigin('https://example.com/path?q=1'), 'https://example.com');
  });

  it('includes port in origin when present', () => {
    assert.equal(getOrigin('http://localhost:8080/api'), 'http://localhost:8080');
  });

  it('returns empty string for a relative URL', () => {
    assert.equal(getOrigin('/relative/path'), '');
  });

  it('returns empty string for an empty string', () => {
    assert.equal(getOrigin(''), '');
  });

  it('works for ftp scheme', () => {
    assert.equal(getOrigin('ftp://files.example.com/data'), 'ftp://files.example.com');
  });
});

// ─── stripHash ────────────────────────────────────────────────────────────────

describe('stripHash', () => {
  it('removes the hash fragment', () => {
    assert.equal(stripHash('https://example.com/page#section'), 'https://example.com/page');
  });

  it('returns URL unchanged when there is no hash', () => {
    assert.equal(stripHash('https://example.com/page?q=1'), 'https://example.com/page?q=1');
  });

  it('handles URL that is only a hash', () => {
    assert.equal(stripHash('#only-hash'), '');
  });

  it('removes hash but keeps search string', () => {
    assert.equal(stripHash('https://example.com/?q=1#top'), 'https://example.com/?q=1');
  });

  it('handles empty string', () => {
    assert.equal(stripHash(''), '');
  });
});

// ─── stripSearch ──────────────────────────────────────────────────────────────

describe('stripSearch', () => {
  it('removes the query string', () => {
    assert.equal(stripSearch('https://example.com/page?q=1&lang=en'), 'https://example.com/page');
  });

  it('returns URL unchanged when there is no search', () => {
    assert.equal(stripSearch('https://example.com/page#hash'), 'https://example.com/page#hash');
  });

  it('removes search but preserves hash', () => {
    assert.equal(stripSearch('https://example.com/page?q=1#top'), 'https://example.com/page#top');
  });

  it('handles URL with only a query string', () => {
    assert.equal(stripSearch('?key=val'), '');
  });

  it('handles empty string', () => {
    assert.equal(stripSearch(''), '');
  });
});

// ─── normalizeUrl ─────────────────────────────────────────────────────────────

describe('normalizeUrl', () => {
  it('lowercases the scheme', () => {
    const result = normalizeUrl('HTTPS://Example.COM/path');
    assert.ok(result.startsWith('https://'));
  });

  it('lowercases the hostname', () => {
    const result = normalizeUrl('https://EXAMPLE.COM/');
    assert.ok(result.includes('example.com'));
  });

  it('removes default port 80 for http', () => {
    const result = normalizeUrl('http://example.com:80/path');
    assert.ok(!result.includes(':80'), `expected no :80 in "${result}"`);
  });

  it('removes default port 443 for https', () => {
    const result = normalizeUrl('https://example.com:443/path');
    assert.ok(!result.includes(':443'), `expected no :443 in "${result}"`);
  });

  it('keeps non-default port', () => {
    const result = normalizeUrl('https://example.com:8443/path');
    assert.ok(result.includes(':8443'));
  });

  it('ensures pathname is at least /', () => {
    const result = normalizeUrl('https://example.com');
    assert.ok(result.endsWith('/'));
  });

  it('returns relative URL unchanged', () => {
    const rel = '/relative/path';
    assert.equal(normalizeUrl(rel), rel);
  });

  it('preserves search and hash after normalization', () => {
    const result = normalizeUrl('HTTPS://EXAMPLE.COM:443/p?q=1#h');
    assert.ok(result.includes('?q=1'));
    assert.ok(result.includes('#h'));
  });
});
