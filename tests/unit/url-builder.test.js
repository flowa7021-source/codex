// ─── Unit Tests: url-builder ──────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  UrlBuilder,
  parseUrl,
  buildUrl,
  addQueryParam,
  removeQueryParam,
  getQueryParam,
  getAllQueryParams,
  joinPaths,
  isAbsoluteUrl,
  isRelativeUrl,
  normalizeUrl,
} from '../../app/modules/url-builder.js';

// ─── UrlBuilder – constructor ─────────────────────────────────────────────────

describe('UrlBuilder – constructor', () => {
  it('creates an empty builder with no args', () => {
    const b = new UrlBuilder();
    assert.equal(b.build(), '');
  });

  it('parses a full URL on construction', () => {
    const b = new UrlBuilder('https://example.com/path?q=1#sec');
    assert.equal(b.build(), 'https://example.com/path?q=1#sec');
  });

  it('parses host and port from base URL', () => {
    const b = new UrlBuilder('http://localhost:3000/api');
    assert.equal(b.build(), 'http://localhost:3000/api');
  });

  it('preserves existing query params from base URL', () => {
    const b = new UrlBuilder('https://example.com/?foo=bar');
    assert.ok(b.build().includes('foo=bar'));
  });
});

// ─── UrlBuilder – setProtocol ─────────────────────────────────────────────────

describe('UrlBuilder – setProtocol', () => {
  it('sets the protocol', () => {
    const b = new UrlBuilder().setProtocol('https').setHost('example.com');
    assert.ok(b.build().startsWith('https://'));
  });

  it('strips trailing colon and slashes', () => {
    const b = new UrlBuilder().setProtocol('https://').setHost('example.com');
    assert.ok(b.build().startsWith('https://example.com'));
    assert.ok(!b.build().startsWith('https:///'));
  });

  it('returns this for chaining', () => {
    const b = new UrlBuilder();
    assert.strictEqual(b.setProtocol('https'), b);
  });
});

// ─── UrlBuilder – setHost ─────────────────────────────────────────────────────

describe('UrlBuilder – setHost', () => {
  it('sets the host', () => {
    const b = new UrlBuilder().setProtocol('https').setHost('api.example.com');
    assert.ok(b.build().includes('api.example.com'));
  });

  it('returns this for chaining', () => {
    const b = new UrlBuilder();
    assert.strictEqual(b.setHost('example.com'), b);
  });
});

// ─── UrlBuilder – setPort ─────────────────────────────────────────────────────

describe('UrlBuilder – setPort', () => {
  it('includes port in the built URL', () => {
    const b = new UrlBuilder().setProtocol('http').setHost('localhost').setPort(8080);
    assert.ok(b.build().includes(':8080'));
  });

  it('returns this for chaining', () => {
    const b = new UrlBuilder();
    assert.strictEqual(b.setPort(80), b);
  });
});

// ─── UrlBuilder – setPath / appendPath ───────────────────────────────────────

describe('UrlBuilder – setPath', () => {
  it('sets the path with a leading slash', () => {
    const b = new UrlBuilder().setProtocol('https').setHost('example.com').setPath('/api/v1');
    assert.ok(b.build().includes('/api/v1'));
  });

  it('prepends a slash when missing', () => {
    const b = new UrlBuilder().setProtocol('https').setHost('example.com').setPath('api/v1');
    assert.ok(b.build().includes('/api/v1'));
  });

  it('replaces the existing path', () => {
    const b = new UrlBuilder('https://example.com/old').setPath('/new');
    assert.ok(b.build().includes('/new'));
    assert.ok(!b.build().includes('/old'));
  });

  it('returns this for chaining', () => {
    const b = new UrlBuilder();
    assert.strictEqual(b.setPath('/test'), b);
  });
});

describe('UrlBuilder – appendPath', () => {
  it('appends a segment to the existing path', () => {
    const b = new UrlBuilder().setProtocol('https').setHost('example.com')
      .setPath('/api').appendPath('users');
    assert.ok(b.build().includes('/api/users'));
  });

  it('handles leading slash on segment', () => {
    const b = new UrlBuilder().setProtocol('https').setHost('example.com')
      .setPath('/api').appendPath('/users');
    assert.ok(b.build().includes('/api/users'));
    assert.ok(!b.build().includes('/api//users'));
  });

  it('returns this for chaining', () => {
    const b = new UrlBuilder();
    assert.strictEqual(b.appendPath('segment'), b);
  });
});

// ─── UrlBuilder – query params ───────────────────────────────────────────────

describe('UrlBuilder – setQuery', () => {
  it('sets all query parameters at once', () => {
    const b = new UrlBuilder().setProtocol('https').setHost('example.com')
      .setQuery({ page: 2, size: 10 });
    const url = b.build();
    assert.ok(url.includes('page=2'));
    assert.ok(url.includes('size=10'));
  });

  it('replaces existing query params', () => {
    const b = new UrlBuilder('https://example.com/?old=1').setQuery({ new: 'yes' });
    const url = b.build();
    assert.ok(url.includes('new=yes'));
    assert.ok(!url.includes('old=1'));
  });

  it('handles boolean values', () => {
    const b = new UrlBuilder().setProtocol('https').setHost('example.com')
      .setQuery({ active: true });
    assert.ok(b.build().includes('active=true'));
  });

  it('returns this for chaining', () => {
    const b = new UrlBuilder();
    assert.strictEqual(b.setQuery({ k: 'v' }), b);
  });
});

describe('UrlBuilder – addQuery', () => {
  it('adds a single query parameter', () => {
    const b = new UrlBuilder().setProtocol('https').setHost('example.com')
      .addQuery('foo', 'bar');
    assert.ok(b.build().includes('foo=bar'));
  });

  it('replaces an existing parameter with the same key', () => {
    const b = new UrlBuilder('https://example.com/?foo=old').addQuery('foo', 'new');
    const url = b.build();
    assert.ok(url.includes('foo=new'));
    assert.ok(!url.includes('foo=old'));
  });

  it('coerces numeric values to strings', () => {
    const b = new UrlBuilder().setProtocol('https').setHost('example.com')
      .addQuery('page', 3);
    assert.ok(b.build().includes('page=3'));
  });

  it('returns this for chaining', () => {
    const b = new UrlBuilder();
    assert.strictEqual(b.addQuery('k', 'v'), b);
  });
});

describe('UrlBuilder – removeQuery', () => {
  it('removes a query parameter', () => {
    const b = new UrlBuilder('https://example.com/?foo=1&bar=2').removeQuery('foo');
    const url = b.build();
    assert.ok(!url.includes('foo'));
    assert.ok(url.includes('bar=2'));
  });

  it('is a no-op if the key does not exist', () => {
    const b = new UrlBuilder('https://example.com/?bar=2').removeQuery('missing');
    assert.ok(b.build().includes('bar=2'));
  });

  it('returns this for chaining', () => {
    const b = new UrlBuilder();
    assert.strictEqual(b.removeQuery('k'), b);
  });
});

// ─── UrlBuilder – setFragment ─────────────────────────────────────────────────

describe('UrlBuilder – setFragment', () => {
  it('sets the URL fragment', () => {
    const b = new UrlBuilder().setProtocol('https').setHost('example.com').setFragment('section1');
    assert.ok(b.build().endsWith('#section1'));
  });

  it('strips a leading # from the fragment', () => {
    const b = new UrlBuilder().setProtocol('https').setHost('example.com').setFragment('#sec');
    assert.ok(b.build().endsWith('#sec'));
    assert.ok(!b.build().endsWith('##sec'));
  });

  it('returns this for chaining', () => {
    const b = new UrlBuilder();
    assert.strictEqual(b.setFragment('frag'), b);
  });
});

// ─── UrlBuilder – build / toString / toURL ────────────────────────────────────

describe('UrlBuilder – build()', () => {
  it('builds a complete URL', () => {
    const url = new UrlBuilder()
      .setProtocol('https')
      .setHost('api.example.com')
      .setPort(8443)
      .setPath('/v2/items')
      .addQuery('limit', 5)
      .setFragment('top')
      .build();
    assert.equal(url, 'https://api.example.com:8443/v2/items?limit=5#top');
  });

  it('omits port when not set', () => {
    const url = new UrlBuilder().setProtocol('https').setHost('example.com').build();
    // The URL should not contain a port number after the host
    assert.ok(!url.match(/example\.com:\d+/));
  });

  it('omits query string when no params', () => {
    const url = new UrlBuilder().setProtocol('https').setHost('example.com').setPath('/p').build();
    assert.ok(!url.includes('?'));
  });

  it('omits fragment when not set', () => {
    const url = new UrlBuilder().setProtocol('https').setHost('example.com').build();
    assert.ok(!url.includes('#'));
  });
});

describe('UrlBuilder – toString()', () => {
  it('returns the same result as build()', () => {
    const b = new UrlBuilder('https://example.com/path?x=1#y');
    assert.equal(b.toString(), b.build());
  });
});

describe('UrlBuilder – toURL()', () => {
  it('returns a WHATWG URL instance', () => {
    const b = new UrlBuilder('https://example.com/test');
    const u = b.toURL();
    assert.ok(u instanceof URL);
    assert.equal(u.hostname, 'example.com');
  });

  it('throws for non-absolute URLs', () => {
    const b = new UrlBuilder().setPath('/relative');
    assert.throws(() => b.toURL(), /Invalid URL/);
  });
});

// ─── UrlBuilder – clone ───────────────────────────────────────────────────────

describe('UrlBuilder – clone()', () => {
  it('produces an equal URL', () => {
    const b = new UrlBuilder('https://example.com/path?q=1#sec');
    assert.equal(b.clone().build(), b.build());
  });

  it('changes to the clone do not affect the original', () => {
    const b = new UrlBuilder('https://example.com/path');
    const c = b.clone().setPath('/other');
    assert.ok(b.build().includes('/path'));
    assert.ok(c.build().includes('/other'));
  });

  it('changes to the original do not affect the clone', () => {
    const b = new UrlBuilder('https://example.com/?foo=1');
    const c = b.clone();
    b.addQuery('bar', '2');
    assert.ok(!c.build().includes('bar'));
  });
});

// ─── parseUrl ─────────────────────────────────────────────────────────────────

describe('parseUrl()', () => {
  it('parses all components', () => {
    const r = parseUrl('https://user.example.com:9000/api/v1?a=1&b=2#sec');
    assert.equal(r.protocol, 'https');
    assert.equal(r.host, 'user.example.com');
    assert.equal(r.port, '9000');
    assert.equal(r.pathname, '/api/v1');
    assert.equal(r.hash, 'sec');
    assert.deepEqual(r.params, { a: '1', b: '2' });
  });

  it('returns empty port for standard HTTPS', () => {
    const r = parseUrl('https://example.com/');
    assert.equal(r.port, '');
  });

  it('returns empty hash when absent', () => {
    const r = parseUrl('https://example.com/');
    assert.equal(r.hash, '');
  });

  it('returns empty params object when no query string', () => {
    const r = parseUrl('https://example.com/');
    assert.deepEqual(r.params, {});
  });
});

// ─── buildUrl ─────────────────────────────────────────────────────────────────

describe('buildUrl()', () => {
  it('builds a URL from parts', () => {
    const url = buildUrl({
      protocol: 'https',
      host: 'example.com',
      path: '/search',
      params: { q: 'hello', page: 1 },
      fragment: 'top',
    });
    assert.ok(url.startsWith('https://example.com/search'));
    assert.ok(url.includes('q=hello'));
    assert.ok(url.includes('page=1'));
    assert.ok(url.endsWith('#top'));
  });

  it('builds a URL with port', () => {
    const url = buildUrl({ protocol: 'http', host: 'localhost', port: 3000, path: '/api' });
    assert.equal(url, 'http://localhost:3000/api');
  });

  it('builds a URL with no optional parts', () => {
    const url = buildUrl({ protocol: 'https', host: 'example.com' });
    assert.ok(url.startsWith('https://example.com'));
  });
});

// ─── addQueryParam ────────────────────────────────────────────────────────────

describe('addQueryParam()', () => {
  it('adds a parameter to a URL without a query string', () => {
    const url = addQueryParam('https://example.com/path', 'foo', 'bar');
    assert.ok(url.includes('foo=bar'));
  });

  it('adds a parameter alongside existing params', () => {
    const url = addQueryParam('https://example.com/?a=1', 'b', '2');
    assert.ok(url.includes('a=1'));
    assert.ok(url.includes('b=2'));
  });

  it('replaces an existing param with the same key', () => {
    const url = addQueryParam('https://example.com/?foo=old', 'foo', 'new');
    assert.ok(url.includes('foo=new'));
    assert.ok(!url.includes('foo=old'));
  });

  it('coerces numeric values', () => {
    const url = addQueryParam('https://example.com/', 'n', 42);
    assert.ok(url.includes('n=42'));
  });
});

// ─── removeQueryParam ─────────────────────────────────────────────────────────

describe('removeQueryParam()', () => {
  it('removes the specified parameter', () => {
    const url = removeQueryParam('https://example.com/?a=1&b=2', 'a');
    assert.ok(!url.includes('a=1'));
    assert.ok(url.includes('b=2'));
  });

  it('is a no-op when the key does not exist', () => {
    const url = removeQueryParam('https://example.com/?a=1', 'missing');
    assert.ok(url.includes('a=1'));
  });

  it('removes the last param cleanly (no trailing ?)', () => {
    const url = removeQueryParam('https://example.com/?only=1', 'only');
    assert.ok(!url.includes('?'));
  });
});

// ─── getQueryParam ────────────────────────────────────────────────────────────

describe('getQueryParam()', () => {
  it('returns the value of an existing parameter', () => {
    assert.equal(getQueryParam('https://example.com/?foo=bar', 'foo'), 'bar');
  });

  it('returns null when the parameter is absent', () => {
    assert.equal(getQueryParam('https://example.com/', 'missing'), null);
  });

  it('returns the first value for a duplicated key', () => {
    const val = getQueryParam('https://example.com/?k=first&k=second', 'k');
    assert.equal(val, 'first');
  });
});

// ─── getAllQueryParams ────────────────────────────────────────────────────────

describe('getAllQueryParams()', () => {
  it('returns all parameters as a plain object', () => {
    const params = getAllQueryParams('https://example.com/?a=1&b=2&c=three');
    assert.deepEqual(params, { a: '1', b: '2', c: 'three' });
  });

  it('returns an empty object for URLs with no query string', () => {
    const params = getAllQueryParams('https://example.com/');
    assert.deepEqual(params, {});
  });
});

// ─── joinPaths ────────────────────────────────────────────────────────────────

describe('joinPaths()', () => {
  it('joins two simple segments', () => {
    assert.equal(joinPaths('/foo', 'bar'), '/foo/bar');
  });

  it('joins multiple segments', () => {
    assert.equal(joinPaths('/a', 'b', 'c'), '/a/b/c');
  });

  it('collapses duplicate slashes between segments', () => {
    assert.equal(joinPaths('/foo/', '/bar/', '/baz'), '/foo/bar/baz');
  });

  it('preserves leading slash of the first segment', () => {
    assert.ok(joinPaths('/foo', 'bar').startsWith('/'));
  });

  it('returns empty string for no arguments', () => {
    assert.equal(joinPaths(), '');
  });

  it('returns first segment unchanged when only one arg', () => {
    assert.equal(joinPaths('/only'), '/only');
  });

  it('does not add a trailing slash', () => {
    assert.ok(!joinPaths('/foo', 'bar').endsWith('/'));
  });
});

// ─── isAbsoluteUrl ───────────────────────────────────────────────────────────

describe('isAbsoluteUrl()', () => {
  it('returns true for https URLs', () => {
    assert.equal(isAbsoluteUrl('https://example.com/'), true);
  });

  it('returns true for http URLs', () => {
    assert.equal(isAbsoluteUrl('http://example.com/'), true);
  });

  it('returns false for relative paths', () => {
    assert.equal(isAbsoluteUrl('/relative/path'), false);
  });

  it('returns false for protocol-relative URLs', () => {
    assert.equal(isAbsoluteUrl('//example.com/path'), false);
  });

  it('returns false for empty string', () => {
    assert.equal(isAbsoluteUrl(''), false);
  });
});

// ─── isRelativeUrl ────────────────────────────────────────────────────────────

describe('isRelativeUrl()', () => {
  it('returns true for a relative path', () => {
    assert.equal(isRelativeUrl('/relative/path'), true);
  });

  it('returns false for an absolute URL', () => {
    assert.equal(isRelativeUrl('https://example.com/'), false);
  });

  it('returns true for a bare path', () => {
    assert.equal(isRelativeUrl('just/a/path'), true);
  });
});

// ─── normalizeUrl ────────────────────────────────────────────────────────────

describe('normalizeUrl()', () => {
  it('removes default port 80 for http', () => {
    const url = normalizeUrl('http://example.com:80/path');
    assert.ok(!url.includes(':80'));
  });

  it('removes default port 443 for https', () => {
    const url = normalizeUrl('https://example.com:443/path');
    assert.ok(!url.includes(':443'));
  });

  it('keeps non-default ports', () => {
    const url = normalizeUrl('https://example.com:8443/path');
    assert.ok(url.includes(':8443'));
  });

  it('lowercases the scheme', () => {
    const url = normalizeUrl('HTTPS://example.com/');
    assert.ok(url.startsWith('https://'));
  });

  it('lowercases the host', () => {
    const url = normalizeUrl('https://EXAMPLE.COM/');
    assert.ok(url.includes('example.com'));
  });

  it('preserves the path and query string', () => {
    const url = normalizeUrl('https://example.com:443/path?a=1#frag');
    assert.ok(url.includes('/path'));
    assert.ok(url.includes('a=1'));
    assert.ok(url.includes('#frag'));
  });
});
