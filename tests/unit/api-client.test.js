// ─── Unit Tests: ApiClient ────────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { ApiClient } from '../../app/modules/api-client.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build a mock fetch function that captures requests and returns a preset
 * response.  Each call pushes the received ApiRequest onto `calls`.
 *
 * @param {object} [response] - Partial ApiResponse to return (defaults filled in).
 */
function makeMockFetch(response = {}) {
  const calls = [];
  const fetch = async (req) => {
    calls.push({ ...req });
    return {
      data: response.data ?? null,
      status: response.status ?? 200,
      headers: response.headers ?? {},
      url: req.url,
      ...response,
    };
  };
  return { fetch, calls };
}

// ─── HTTP verbs ───────────────────────────────────────────────────────────────

describe('ApiClient – get()', () => {
  it('makes a GET request to the given path', async () => {
    const { fetch, calls } = makeMockFetch({ data: [1, 2, 3] });
    const client = new ApiClient({ baseURL: 'http://api.test', fetch });
    const res = await client.get('/items');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].method, 'GET');
    assert.equal(calls[0].url, 'http://api.test/items');
    assert.deepEqual(res.data, [1, 2, 3]);
  });

  it('appends query params', async () => {
    const { fetch, calls } = makeMockFetch({ data: {} });
    const client = new ApiClient({ baseURL: 'http://api.test', fetch });
    await client.get('/search', { q: 'hello', page: '2' });
    const url = calls[0].url;
    assert.ok(url.includes('q=hello'), `expected q=hello in ${url}`);
    assert.ok(url.includes('page=2'), `expected page=2 in ${url}`);
  });

  it('returns the full ApiResponse shape', async () => {
    const { fetch } = makeMockFetch({ data: 'body', status: 200, headers: { 'x-id': '42' } });
    const client = new ApiClient({ baseURL: 'http://api.test', fetch });
    const res = await client.get('/');
    assert.equal(res.status, 200);
    assert.equal(res.headers['x-id'], '42');
    assert.equal(res.url, 'http://api.test/');
  });
});

describe('ApiClient – post()', () => {
  it('makes a POST request with body', async () => {
    const { fetch, calls } = makeMockFetch({ data: { created: true } });
    const client = new ApiClient({ baseURL: 'http://api.test', fetch });
    const res = await client.post('/items', { name: 'thing' });
    assert.equal(calls[0].method, 'POST');
    assert.deepEqual(calls[0].body, { name: 'thing' });
    assert.deepEqual(res.data, { created: true });
  });

  it('post() with no body passes undefined body', async () => {
    const { fetch, calls } = makeMockFetch();
    const client = new ApiClient({ baseURL: 'http://api.test', fetch });
    await client.post('/trigger');
    assert.equal(calls[0].method, 'POST');
    assert.equal(calls[0].body, undefined);
  });
});

describe('ApiClient – put()', () => {
  it('makes a PUT request', async () => {
    const { fetch, calls } = makeMockFetch({ data: { updated: true } });
    const client = new ApiClient({ fetch });
    await client.put('/items/1', { name: 'updated' });
    assert.equal(calls[0].method, 'PUT');
    assert.deepEqual(calls[0].body, { name: 'updated' });
  });
});

describe('ApiClient – patch()', () => {
  it('makes a PATCH request', async () => {
    const { fetch, calls } = makeMockFetch({ data: {} });
    const client = new ApiClient({ fetch });
    await client.patch('/items/1', { active: false });
    assert.equal(calls[0].method, 'PATCH');
    assert.deepEqual(calls[0].body, { active: false });
  });
});

describe('ApiClient – delete()', () => {
  it('makes a DELETE request', async () => {
    const { fetch, calls } = makeMockFetch({ status: 204, data: null });
    const client = new ApiClient({ fetch });
    const res = await client.delete('/items/1');
    assert.equal(calls[0].method, 'DELETE');
    assert.equal(res.status, 204);
  });
});

// ─── baseURL ──────────────────────────────────────────────────────────────────

describe('ApiClient – baseURL', () => {
  it('prepends baseURL to the path', async () => {
    const { fetch, calls } = makeMockFetch();
    const client = new ApiClient({ baseURL: 'https://my.api.io', fetch });
    await client.get('/v1/users');
    assert.equal(calls[0].url, 'https://my.api.io/v1/users');
  });

  it('works without a baseURL', async () => {
    const { fetch, calls } = makeMockFetch();
    const client = new ApiClient({ fetch });
    await client.get('http://absolute.url/path');
    assert.equal(calls[0].url, 'http://absolute.url/path');
  });

  it('avoids double slashes when base ends with / and path starts with /', async () => {
    const { fetch, calls } = makeMockFetch();
    const client = new ApiClient({ baseURL: 'http://api.test/', fetch });
    await client.get('/endpoint');
    assert.equal(calls[0].url, 'http://api.test/endpoint');
  });
});

// ─── default headers ─────────────────────────────────────────────────────────

describe('ApiClient – default headers', () => {
  it('merges default headers into every request', async () => {
    const { fetch, calls } = makeMockFetch();
    const client = new ApiClient({
      headers: { Authorization: 'Bearer tok', 'X-App': 'nova' },
      fetch,
    });
    await client.get('/me');
    assert.equal(calls[0].headers['Authorization'], 'Bearer tok');
    assert.equal(calls[0].headers['X-App'], 'nova');
  });

  it('per-request headers override defaults', async () => {
    const { fetch, calls } = makeMockFetch();
    const client = new ApiClient({ headers: { 'X-Version': '1' }, fetch });
    await client.request({ url: '/x', method: 'GET', headers: { 'X-Version': '2' } });
    assert.equal(calls[0].headers['X-Version'], '2');
  });
});

// ─── middleware ───────────────────────────────────────────────────────────────

describe('ApiClient – middleware', () => {
  it('use() returns `this` for chaining', () => {
    const client = new ApiClient({ fetch: async () => ({ data: null, status: 200, headers: {}, url: '' }) });
    const result = client.use(async (req, next) => next(req));
    assert.strictEqual(result, client);
  });

  it('middleware runs in the order added', async () => {
    const order = [];
    const { fetch } = makeMockFetch({ data: 'result' });
    const client = new ApiClient({ fetch });

    client.use(async (req, next) => { order.push(1); return next(req); });
    client.use(async (req, next) => { order.push(2); return next(req); });
    client.use(async (req, next) => { order.push(3); return next(req); });

    await client.get('/');
    assert.deepEqual(order, [1, 2, 3]);
  });

  it('middleware can modify the request (add headers)', async () => {
    const { fetch, calls } = makeMockFetch({ data: {} });
    const client = new ApiClient({ fetch });

    client.use(async (req, next) => {
      return next({ ...req, headers: { ...req.headers, 'X-Injected': 'yes' } });
    });

    await client.get('/');
    assert.equal(calls[0].headers['X-Injected'], 'yes');
  });

  it('middleware can modify the response', async () => {
    const { fetch } = makeMockFetch({ data: { raw: true } });
    const client = new ApiClient({ fetch });

    client.use(async (req, next) => {
      const res = await next(req);
      return { ...res, data: { ...res.data, enriched: true } };
    });

    const res = await client.get('/');
    assert.equal(res.data.enriched, true);
    assert.equal(res.data.raw, true);
  });

  it('middleware can short-circuit without calling next', async () => {
    const { fetch, calls } = makeMockFetch({ data: 'real' });
    const client = new ApiClient({ fetch });

    client.use(async (_req, _next) => ({
      data: 'intercepted',
      status: 200,
      headers: {},
      url: 'mocked',
    }));

    const res = await client.get('/');
    assert.equal(res.data, 'intercepted');
    assert.equal(calls.length, 0); // real fetch was never called
  });

  it('middleware errors propagate as rejections', async () => {
    const { fetch } = makeMockFetch();
    const client = new ApiClient({ fetch });

    client.use(async () => { throw new Error('middleware boom'); });

    await assert.rejects(() => client.get('/'), /middleware boom/);
  });
});

// ─── scope() ─────────────────────────────────────────────────────────────────

describe('ApiClient – scope()', () => {
  it('prepends the prefix to all request URLs', async () => {
    const { fetch, calls } = makeMockFetch({ data: {} });
    const client = new ApiClient({ baseURL: 'http://api.test', fetch });
    const users = client.scope('/users');

    await users.get('/profile');
    assert.equal(calls[0].url, 'http://api.test/users/profile');
  });

  it('inherits default headers from the parent', async () => {
    const { fetch, calls } = makeMockFetch({ data: {} });
    const client = new ApiClient({
      headers: { 'X-Token': 'abc' },
      fetch,
    });
    const scoped = client.scope('/v2');
    await scoped.get('/items');
    assert.equal(calls[0].headers['X-Token'], 'abc');
  });

  it('inherits parent middleware', async () => {
    const order = [];
    const { fetch } = makeMockFetch({ data: {} });
    const client = new ApiClient({ fetch });
    client.use(async (req, next) => { order.push('parent'); return next(req); });

    const scoped = client.scope('/api');
    await scoped.get('/x');
    assert.ok(order.includes('parent'));
  });

  it('middleware added to scope does not affect the parent', async () => {
    const parentCalls = [];
    const scopeCalls = [];
    const { fetch } = makeMockFetch({ data: {} });
    const client = new ApiClient({ fetch });

    const scoped = client.scope('/v2');
    scoped.use(async (req, next) => { scopeCalls.push(1); return next(req); });
    client.use(async (req, next) => { parentCalls.push(1); return next(req); });

    await client.get('/parent-only');
    await scoped.get('/scoped-only');

    assert.equal(parentCalls.length, 1); // parent middleware ran once for parent call
    assert.equal(scopeCalls.length, 1);  // scope middleware ran once for scoped call
  });

  it('scoped client can be scoped again', async () => {
    const { fetch, calls } = makeMockFetch({ data: {} });
    const client = new ApiClient({ baseURL: 'http://api.test', fetch });
    const v2 = client.scope('/v2');
    const users = v2.scope('/users');
    await users.get('/me');
    assert.equal(calls[0].url, 'http://api.test/v2/users/me');
  });
});

// ─── request() ───────────────────────────────────────────────────────────────

describe('ApiClient – request()', () => {
  it('accepts partial ApiRequest with only url required', async () => {
    const { fetch, calls } = makeMockFetch({ data: 'ok' });
    const client = new ApiClient({ fetch });
    const res = await client.request({ url: 'http://any.com/path' });
    assert.equal(calls[0].method, 'GET'); // default method
    assert.equal(res.data, 'ok');
  });

  it('passes body through', async () => {
    const { fetch, calls } = makeMockFetch({ data: {} });
    const client = new ApiClient({ fetch });
    await client.request({ url: '/x', method: 'POST', body: { key: 'val' } });
    assert.deepEqual(calls[0].body, { key: 'val' });
  });
});
