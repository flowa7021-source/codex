// ─── Unit Tests: Router ─────────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  Router,
  parseUrl,
  buildUrl,
  joinPaths,
  normalizePath,
  createRouter,
} from '../../app/modules/router.js';

// ─── Router.add / match — static routes ─────────────────────────────────────

describe('Router.match — static routes', () => {
  it('matches an exact static path', () => {
    const router = new Router();
    router.add('/about', 'about-page');
    const result = router.match('/about');
    assert.ok(result !== null);
    assert.equal(result.data, 'about-page');
    assert.deepEqual(result.params, {});
    assert.deepEqual(result.query, {});
  });

  it('returns null for an unregistered path', () => {
    const router = new Router();
    router.add('/home', 'home');
    assert.equal(router.match('/about'), null);
  });

  it('matches the root path /', () => {
    const router = new Router();
    router.add('/', 'root');
    const result = router.match('/');
    assert.ok(result !== null);
    assert.equal(result.data, 'root');
  });

  it('does not match a longer path against a shorter pattern', () => {
    const router = new Router();
    router.add('/users', 'users-list');
    assert.equal(router.match('/users/42'), null);
  });

  it('does not match a shorter path against a longer pattern', () => {
    const router = new Router();
    router.add('/users/profile', 'profile');
    assert.equal(router.match('/users'), null);
  });

  it('matches the first registered route when multiple match', () => {
    const router = new Router();
    router.add('/page', 'first');
    router.add('/page', 'second');
    const result = router.match('/page');
    assert.equal(result.data, 'first');
  });

  it('handles multi-segment static paths', () => {
    const router = new Router();
    router.add('/api/v1/health', 'health');
    const result = router.match('/api/v1/health');
    assert.ok(result !== null);
    assert.equal(result.data, 'health');
  });
});

// ─── Router.match — param routes ─────────────────────────────────────────────

describe('Router.match — param routes', () => {
  it('extracts a single named param', () => {
    const router = new Router();
    router.add('/users/:id', { name: 'userDetail' });
    const result = router.match('/users/42');
    assert.ok(result !== null);
    assert.deepEqual(result.params, { id: '42' });
    assert.deepEqual(result.data, { name: 'userDetail' });
  });

  it('extracts multiple named params', () => {
    const router = new Router();
    router.add('/posts/:year/:slug', 'post');
    const result = router.match('/posts/2024/hello-world');
    assert.ok(result !== null);
    assert.deepEqual(result.params, { year: '2024', slug: 'hello-world' });
  });

  it('does not match a param route when segment count differs', () => {
    const router = new Router();
    router.add('/users/:id', 'user');
    assert.equal(router.match('/users/42/extra'), null);
  });

  it('matches param alongside static segments', () => {
    const router = new Router();
    router.add('/api/users/:id/posts', 'user-posts');
    const result = router.match('/api/users/99/posts');
    assert.ok(result !== null);
    assert.deepEqual(result.params, { id: '99' });
  });

  it('prefers a static route over a param route when both registered', () => {
    const router = new Router();
    router.add('/users/me', 'me');
    router.add('/users/:id', 'other');
    const result = router.match('/users/me');
    assert.equal(result.data, 'me');
  });

  it('falls through to param route when static does not match', () => {
    const router = new Router();
    router.add('/users/me', 'me');
    router.add('/users/:id', 'other');
    const result = router.match('/users/123');
    assert.equal(result.data, 'other');
    assert.deepEqual(result.params, { id: '123' });
  });

  it('param value can contain hyphens and underscores', () => {
    const router = new Router();
    router.add('/items/:slug', 'item');
    const result = router.match('/items/my-item_v2');
    assert.ok(result !== null);
    assert.deepEqual(result.params, { slug: 'my-item_v2' });
  });
});

// ─── Router.match — wildcard routes ──────────────────────────────────────────

describe('Router.match — wildcard routes', () => {
  it('matches a pure wildcard route /*', () => {
    const router = new Router();
    router.add('/*', 'catch-all');
    const result = router.match('/anything/here');
    assert.ok(result !== null);
    assert.equal(result.data, 'catch-all');
    assert.equal(result.params.wildcard, 'anything/here');
  });

  it('wildcard captures empty string at prefix boundary', () => {
    const router = new Router();
    router.add('/files/*', 'files');
    const result = router.match('/files/');
    assert.ok(result !== null);
    assert.equal(result.params.wildcard, '');
  });

  it('matches prefix + wildcard', () => {
    const router = new Router();
    router.add('/static/*', 'static');
    const result = router.match('/static/css/main.css');
    assert.ok(result !== null);
    assert.equal(result.params.wildcard, 'css/main.css');
  });

  it('wildcard with named param prefix', () => {
    const router = new Router();
    router.add('/users/:id/*', 'user-anything');
    const result = router.match('/users/7/settings/account');
    assert.ok(result !== null);
    assert.deepEqual(result.params, { id: '7', wildcard: 'settings/account' });
  });

  it('wildcard does not match if prefix segments do not match', () => {
    const router = new Router();
    router.add('/admin/*', 'admin');
    assert.equal(router.match('/user/dashboard'), null);
  });

  it('wildcard captures a single segment', () => {
    const router = new Router();
    router.add('/docs/*', 'docs');
    const result = router.match('/docs/intro');
    assert.ok(result !== null);
    assert.equal(result.params.wildcard, 'intro');
  });

  it('non-wildcard route is not shadowed by an unrelated wildcard', () => {
    const router = new Router();
    router.add('/api/*', 'api-catch');
    router.add('/health', 'health');
    assert.equal(router.match('/health').data, 'health');
    assert.equal(router.match('/api/status').data, 'api-catch');
  });
});

// ─── Router.match — query string parsing ─────────────────────────────────────

describe('Router.match — query string handling', () => {
  it('parses a single query param', () => {
    const router = new Router();
    router.add('/search', 'search');
    const result = router.match('/search?q=hello');
    assert.ok(result !== null);
    assert.deepEqual(result.query, { q: 'hello' });
  });

  it('parses multiple query params', () => {
    const router = new Router();
    router.add('/items', 'items');
    const result = router.match('/items?page=2&limit=10');
    assert.ok(result !== null);
    assert.deepEqual(result.query, { page: '2', limit: '10' });
  });

  it('path matching ignores query string', () => {
    const router = new Router();
    router.add('/users/:id', 'user');
    const result = router.match('/users/5?tab=posts&sort=asc');
    assert.ok(result !== null);
    assert.deepEqual(result.params, { id: '5' });
    assert.deepEqual(result.query, { tab: 'posts', sort: 'asc' });
  });

  it('empty query string yields empty query object', () => {
    const router = new Router();
    router.add('/page', 'page');
    const result = router.match('/page?');
    assert.ok(result !== null);
    assert.deepEqual(result.query, {});
  });

  it('URL without query string yields empty query object', () => {
    const router = new Router();
    router.add('/page', 'page');
    const result = router.match('/page');
    assert.deepEqual(result.query, {});
  });
});

// ─── Router.matchAll ──────────────────────────────────────────────────────────

describe('Router.matchAll', () => {
  it('returns all matching routes in registration order', () => {
    const router = new Router();
    router.add('/api/*', 'wildcard');
    router.add('/api/:resource', 'param');
    const results = router.matchAll('/api/users');
    assert.equal(results.length, 2);
    assert.equal(results[0].data, 'wildcard');
    assert.equal(results[1].data, 'param');
  });

  it('returns empty array when no routes match', () => {
    const router = new Router();
    router.add('/home', 'home');
    assert.deepEqual(router.matchAll('/missing'), []);
  });

  it('returns a single result when only one route matches', () => {
    const router = new Router();
    router.add('/exact', 'exact');
    router.add('/other', 'other');
    const results = router.matchAll('/exact');
    assert.equal(results.length, 1);
    assert.equal(results[0].data, 'exact');
  });

  it('each match carries its own params', () => {
    const router = new Router();
    router.add('/:a', 'first');
    router.add('/:b', 'second');
    const results = router.matchAll('/hello');
    assert.equal(results.length, 2);
    assert.deepEqual(results[0].params, { a: 'hello' });
    assert.deepEqual(results[1].params, { b: 'hello' });
  });

  it('all matches share the parsed query object', () => {
    const router = new Router();
    router.add('/page', 'a');
    router.add('/page', 'b');
    const results = router.matchAll('/page?x=1');
    assert.equal(results.length, 2);
    assert.deepEqual(results[0].query, { x: '1' });
    assert.deepEqual(results[1].query, { x: '1' });
  });
});

// ─── Router.routes getter ─────────────────────────────────────────────────────

describe('Router.routes getter', () => {
  it('returns an empty array for a fresh router', () => {
    const router = new Router();
    assert.deepEqual(router.routes, []);
  });

  it('returns patterns in registration order', () => {
    const router = new Router();
    router.add('/a', 1).add('/b', 2).add('/c', 3);
    assert.deepEqual(router.routes, ['/a', '/b', '/c']);
  });

  it('normalizes patterns on registration', () => {
    const router = new Router();
    router.add('//api//users//', 'u');
    assert.deepEqual(router.routes, ['/api/users']);
  });

  it('router.routes is not a live reference (returns fresh array)', () => {
    const router = new Router();
    router.add('/x', 'x');
    const r1 = router.routes;
    router.add('/y', 'y');
    assert.equal(r1.length, 1); // old snapshot unaffected
    assert.equal(router.routes.length, 2);
  });
});

// ─── parseUrl ─────────────────────────────────────────────────────────────────

describe('parseUrl', () => {
  it('splits path and query', () => {
    const { path, query } = parseUrl('/users/5?tab=posts');
    assert.equal(path, '/users/5');
    assert.deepEqual(query, { tab: 'posts' });
  });

  it('handles path with no query string', () => {
    const { path, query } = parseUrl('/about');
    assert.equal(path, '/about');
    assert.deepEqual(query, {});
  });

  it('handles empty string as root', () => {
    const { path, query } = parseUrl('');
    assert.equal(path, '/');
    assert.deepEqual(query, {});
  });

  it('handles root path only', () => {
    const { path } = parseUrl('/');
    assert.equal(path, '/');
  });

  it('parses multiple query pairs', () => {
    const { query } = parseUrl('/search?a=1&b=2&c=3');
    assert.deepEqual(query, { a: '1', b: '2', c: '3' });
  });

  it('decodes percent-encoded query values', () => {
    const { query } = parseUrl('/q?term=hello%20world');
    assert.deepEqual(query, { term: 'hello world' });
  });

  it('handles a query key with no value', () => {
    const { query } = parseUrl('/page?flag');
    assert.deepEqual(query, { flag: '' });
  });

  it('normalizes the path portion', () => {
    const { path } = parseUrl('//api//users');
    assert.equal(path, '/api/users');
  });

  it('query string after ? with no content', () => {
    const { query } = parseUrl('/page?');
    assert.deepEqual(query, {});
  });
});

// ─── buildUrl ─────────────────────────────────────────────────────────────────

describe('buildUrl', () => {
  it('substitutes a single named param', () => {
    assert.equal(buildUrl('/users/:id', { id: '42' }), '/users/42');
  });

  it('substitutes multiple named params', () => {
    assert.equal(
      buildUrl('/posts/:year/:slug', { year: '2024', slug: 'hello' }),
      '/posts/2024/hello',
    );
  });

  it('appends query parameters', () => {
    const url = buildUrl('/search', {}, { q: 'typescript', page: '1' });
    assert.ok(url.includes('q=typescript'));
    assert.ok(url.includes('page=1'));
    assert.ok(url.startsWith('/search?'));
  });

  it('works with params and query together', () => {
    const url = buildUrl('/users/:id', { id: '5' }, { tab: 'posts' });
    assert.equal(url, '/users/5?tab=posts');
  });

  it('returns path unchanged when no params provided', () => {
    assert.equal(buildUrl('/about'), '/about');
  });

  it('returns path unchanged when params is empty', () => {
    assert.equal(buildUrl('/about', {}), '/about');
  });

  it('encodes special characters in param values', () => {
    const url = buildUrl('/search/:term', { term: 'hello world' });
    assert.equal(url, '/search/hello%20world');
  });

  it('encodes special characters in query values', () => {
    const url = buildUrl('/q', {}, { q: 'a&b=c' });
    assert.ok(url.includes('q=a%26b%3Dc'));
  });

  it('numeric param values are accepted', () => {
    assert.equal(buildUrl('/page/:n', { n: 3 }), '/page/3');
  });

  it('omits query string when query object is empty', () => {
    assert.equal(buildUrl('/page', {}, {}), '/page');
  });
});

// ─── joinPaths ────────────────────────────────────────────────────────────────

describe('joinPaths', () => {
  it('joins two simple segments', () => {
    assert.equal(joinPaths('/api', '/users'), '/api/users');
  });

  it('joins three segments', () => {
    assert.equal(joinPaths('/api', '/v1', '/books'), '/api/v1/books');
  });

  it('strips trailing slashes from parts', () => {
    assert.equal(joinPaths('/api/', '/users/'), '/api/users');
  });

  it('handles parts without leading slashes', () => {
    assert.equal(joinPaths('api', 'users'), '/api/users');
  });

  it('handles an empty part in the middle', () => {
    assert.equal(joinPaths('/api', '', '/users'), '/api/users');
  });

  it('single part returns normalized path', () => {
    assert.equal(joinPaths('/api/'), '/api');
  });

  it('no parts returns root', () => {
    assert.equal(joinPaths(), '/');
  });

  it('handles double slashes within a part', () => {
    assert.equal(joinPaths('//api', '//users//'), '/api/users');
  });

  it('preserves leading slash on first segment', () => {
    const result = joinPaths('/root', 'child');
    assert.ok(result.startsWith('/'));
  });
});

// ─── normalizePath ────────────────────────────────────────────────────────────

describe('normalizePath', () => {
  it('collapses double slashes', () => {
    assert.equal(normalizePath('//api//users'), '/api/users');
  });

  it('removes trailing slash', () => {
    assert.equal(normalizePath('/api/users/'), '/api/users');
  });

  it('preserves root path', () => {
    assert.equal(normalizePath('/'), '/');
  });

  it('returns root for empty string', () => {
    assert.equal(normalizePath(''), '/');
  });

  it('handles path with no issues unchanged', () => {
    assert.equal(normalizePath('/api/v1/users'), '/api/v1/users');
  });

  it('collapses three consecutive slashes', () => {
    assert.equal(normalizePath('///deep///path'), '/deep/path');
  });

  it('handles single segment', () => {
    assert.equal(normalizePath('/about'), '/about');
  });

  it('does not add a trailing slash to root-level path', () => {
    const result = normalizePath('/about/');
    assert.ok(!result.endsWith('/'));
  });
});

// ─── createRouter factory ─────────────────────────────────────────────────────

describe('createRouter', () => {
  it('returns a Router instance', () => {
    const router = createRouter();
    assert.ok(router instanceof Router);
  });

  it('returned router starts with no routes', () => {
    assert.deepEqual(createRouter().routes, []);
  });

  it('supports chained add calls', () => {
    const router = createRouter()
      .add('/a', 1)
      .add('/b', 2)
      .add('/c', 3);
    assert.deepEqual(router.routes, ['/a', '/b', '/c']);
  });

  it('is independent — two routers do not share state', () => {
    const r1 = createRouter();
    const r2 = createRouter();
    r1.add('/shared', 'r1');
    assert.equal(r2.match('/shared'), null);
  });

  it('supports a typed generic via data shape', () => {
    const router = createRouter();
    router.add('/typed', { role: 'admin', level: 5 });
    const result = router.match('/typed');
    assert.deepEqual(result.data, { role: 'admin', level: 5 });
  });

  it('add returns the same router instance for chaining', () => {
    const router = createRouter();
    const ret = router.add('/x', 'x');
    assert.equal(ret, router);
  });
});
