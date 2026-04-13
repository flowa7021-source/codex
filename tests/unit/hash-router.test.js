// ─── Unit Tests: Hash Router ──────────────────────────────────────────────────
import './setup-dom.js';
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  getCurrentRoute,
  navigateTo,
  goBack,
  onRoute,
  matchRoute,
  startRouter,
  resolveCurrentRoute,
} from '../../app/modules/hash-router.js';

// ─── Reset state between tests ────────────────────────────────────────────────

beforeEach(() => {
  globalThis.window.location.hash = '';
  globalThis.window.history.back = () => {};
});

// ─── getCurrentRoute ──────────────────────────────────────────────────────────

describe('getCurrentRoute', () => {
  it('returns empty string when hash is empty', () => {
    globalThis.window.location.hash = '';
    assert.equal(getCurrentRoute(), '');
  });

  it('returns the route after hash is set with # prefix', () => {
    globalThis.window.location.hash = '#/books';
    assert.equal(getCurrentRoute(), '/books');
  });

  it('returns only the path portion (before ?) from the hash', () => {
    globalThis.window.location.hash = '#/books?sort=title';
    assert.equal(getCurrentRoute(), '/books');
  });

  it('returns the hash value without the leading #', () => {
    globalThis.window.location.hash = '#/settings';
    assert.equal(getCurrentRoute(), '/settings');
  });
});

// ─── navigateTo ───────────────────────────────────────────────────────────────

describe('navigateTo', () => {
  it('sets window.location.hash to the route', () => {
    navigateTo('/home');
    assert.equal(globalThis.window.location.hash, '/home');
  });

  it('sets window.location.hash with query params when provided', () => {
    navigateTo('/book', { id: '42' });
    assert.ok(globalThis.window.location.hash.includes('/book'));
    assert.ok(globalThis.window.location.hash.includes('id=42'));
  });

  it('sets hash without query string when no params given', () => {
    navigateTo('/reader');
    assert.equal(globalThis.window.location.hash, '/reader');
  });

  it('sets hash without query string when empty params given', () => {
    navigateTo('/reader', {});
    assert.equal(globalThis.window.location.hash, '/reader');
  });
});

// ─── goBack ───────────────────────────────────────────────────────────────────

describe('goBack', () => {
  it('calls window.history.back', () => {
    let backCalled = false;
    globalThis.window.history.back = () => { backCalled = true; };
    goBack();
    assert.equal(backCalled, true);
  });

  it('does not throw', () => {
    assert.doesNotThrow(() => goBack());
  });
});

// ─── matchRoute ───────────────────────────────────────────────────────────────

describe('matchRoute', () => {
  it('returns null for a non-matching path', () => {
    const result = matchRoute('/books/:id', '/settings/profile');
    assert.equal(result, null);
  });

  it('returns null when segment counts differ', () => {
    const result = matchRoute('/books/:id', '/books/42/chapters');
    assert.equal(result, null);
  });

  it('returns params for a matching path with :param segments', () => {
    const result = matchRoute('/book/:id/page/:page', '/book/42/page/7');
    assert.deepEqual(result, { id: '42', page: '7' });
  });

  it('matches exact routes without params', () => {
    const result = matchRoute('/settings', '/settings');
    assert.deepEqual(result, {});
  });

  it('returns null when a literal segment does not match', () => {
    const result = matchRoute('/books/detail', '/books/list');
    assert.equal(result, null);
  });

  it('handles a single :param segment', () => {
    const result = matchRoute('/book/:id', '/book/99');
    assert.deepEqual(result, { id: '99' });
  });

  it('matches root route', () => {
    const result = matchRoute('/', '/');
    assert.deepEqual(result, {});
  });

  it('returns empty params for a route with no :param and matching path', () => {
    const result = matchRoute('/about/team', '/about/team');
    assert.deepEqual(result, {});
  });
});

// ─── onRoute + resolveCurrentRoute ───────────────────────────────────────────

describe('onRoute + resolveCurrentRoute', () => {
  it('handler is called for a matching route', () => {
    const received = [];
    const unregister = onRoute('/books/:id', (params) => received.push(params));

    navigateTo('/books/7');
    resolveCurrentRoute();

    assert.equal(received.length, 1);
    assert.deepEqual(received[0], { id: '7' });

    unregister();
  });

  it('handler is not called for a non-matching route', () => {
    const received = [];
    const unregister = onRoute('/settings', (p) => received.push(p));

    navigateTo('/home');
    resolveCurrentRoute();

    assert.equal(received.length, 0);
    unregister();
  });

  it('unregister prevents handler from being called', () => {
    const received = [];
    const unregister = onRoute('/home', (p) => received.push(p));

    navigateTo('/home');
    resolveCurrentRoute();
    assert.equal(received.length, 1);

    unregister();

    resolveCurrentRoute();
    assert.equal(received.length, 1, 'handler should not fire after unregister');
  });

  it('handler receives correct params', () => {
    const received = [];
    const unregister = onRoute('/user/:name/book/:bookId', (p) => received.push(p));

    navigateTo('/user/alice/book/3');
    resolveCurrentRoute();

    assert.deepEqual(received[0], { name: 'alice', bookId: '3' });
    unregister();
  });
});

// ─── startRouter ─────────────────────────────────────────────────────────────

describe('startRouter', () => {
  it('returns a stop function', () => {
    const stop = startRouter();
    assert.equal(typeof stop, 'function');
    stop();
  });

  it('calls resolveCurrentRoute on hashchange event', () => {
    const received = [];
    const unregister = onRoute('/page/:n', (p) => received.push(p));
    const stop = startRouter();

    navigateTo('/page/5');
    globalThis.window.dispatchEvent(new Event('hashchange'));

    assert.equal(received.length, 1);
    assert.deepEqual(received[0], { n: '5' });

    stop();
    unregister();
  });

  it('stop function removes hashchange listener', () => {
    const received = [];
    const unregister = onRoute('/section/:id', (p) => received.push(p));
    const stop = startRouter();

    navigateTo('/section/1');
    globalThis.window.dispatchEvent(new Event('hashchange'));
    assert.equal(received.length, 1);

    stop();

    navigateTo('/section/2');
    globalThis.window.dispatchEvent(new Event('hashchange'));
    assert.equal(received.length, 1, 'handler should not fire after stop');

    unregister();
  });

  it('is safe to call stop multiple times', () => {
    const stop = startRouter();
    assert.doesNotThrow(() => {
      stop();
      stop();
    });
  });
});
