// ─── Unit Tests: Cookie Store API ────────────────────────────────────────────
import './setup-dom.js';
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  isCookieStoreSupported,
  getCookie,
  setCookie,
  deleteCookie,
  getAllCookies,
  onCookieChange,
} from '../../app/modules/cookie-store.js';

// ─── beforeEach / afterEach ───────────────────────────────────────────────────

beforeEach(() => {
  const _store = new Map();
  globalThis.cookieStore = {
    _listeners: {},
    get: async (name) => _store.has(name) ? { name, value: _store.get(name), path: '/' } : undefined,
    set: async (opts) => { _store.set(opts.name, opts.value); },
    delete: async (name) => { _store.delete(name); },
    getAll: async () => [..._store.entries()].map(([name, value]) => ({ name, value })),
    addEventListener(type, fn) { (this._listeners[type] = this._listeners[type] ?? []).push(fn); },
    removeEventListener(type, fn) { this._listeners[type] = (this._listeners[type] ?? []).filter(f => f !== fn); },
  };
});

afterEach(() => {
  delete globalThis.cookieStore;
});

// ─── isCookieStoreSupported ───────────────────────────────────────────────────

describe('isCookieStoreSupported', () => {
  it('returns a boolean', () => {
    const result = isCookieStoreSupported();
    assert.equal(typeof result, 'boolean');
  });

  it('returns true when cookieStore is present', () => {
    assert.equal(isCookieStoreSupported(), true);
  });

  it('returns false when cookieStore is absent', () => {
    delete globalThis.cookieStore;
    assert.equal(isCookieStoreSupported(), false);
  });
});

// ─── getCookie ────────────────────────────────────────────────────────────────

describe('getCookie', () => {
  it('returns null when the cookie does not exist', async () => {
    const result = await getCookie('nonexistent');
    assert.equal(result, null);
  });

  it('returns a mapped entry when the cookie is present', async () => {
    await setCookie({ name: 'session', value: 'abc123' });
    const result = await getCookie('session');
    assert.ok(result !== null);
    assert.equal(result.name, 'session');
    assert.equal(result.value, 'abc123');
  });

  it('returns null when the API is absent', async () => {
    delete globalThis.cookieStore;
    const result = await getCookie('session');
    assert.equal(result, null);
  });

  it('includes path in the returned entry when provided by store', async () => {
    await setCookie({ name: 'pref', value: 'dark' });
    const result = await getCookie('pref');
    assert.ok(result !== null);
    assert.equal(result.path, '/');
  });
});

// ─── setCookie ────────────────────────────────────────────────────────────────

describe('setCookie', () => {
  it('returns true on success', async () => {
    const result = await setCookie({ name: 'token', value: 'xyz' });
    assert.equal(result, true);
  });

  it('persists the value so getCookie can retrieve it', async () => {
    await setCookie({ name: 'theme', value: 'dark' });
    const entry = await getCookie('theme');
    assert.ok(entry !== null);
    assert.equal(entry.value, 'dark');
  });

  it('returns false when the API is absent', async () => {
    delete globalThis.cookieStore;
    const result = await setCookie({ name: 'x', value: '1' });
    assert.equal(result, false);
  });

  it('overwrites existing cookie with the same name', async () => {
    await setCookie({ name: 'color', value: 'blue' });
    await setCookie({ name: 'color', value: 'red' });
    const entry = await getCookie('color');
    assert.ok(entry !== null);
    assert.equal(entry.value, 'red');
  });
});

// ─── deleteCookie ─────────────────────────────────────────────────────────────

describe('deleteCookie', () => {
  it('returns true on success', async () => {
    await setCookie({ name: 'tmp', value: '1' });
    const result = await deleteCookie('tmp');
    assert.equal(result, true);
  });

  it('removes the cookie so getCookie returns null afterwards', async () => {
    await setCookie({ name: 'gone', value: 'soon' });
    await deleteCookie('gone');
    const entry = await getCookie('gone');
    assert.equal(entry, null);
  });

  it('returns false when the API is absent', async () => {
    delete globalThis.cookieStore;
    const result = await deleteCookie('any');
    assert.equal(result, false);
  });

  it('returns true even when deleting a nonexistent cookie', async () => {
    // Mock delete always resolves — should still return true
    const result = await deleteCookie('does-not-exist');
    assert.equal(result, true);
  });
});

// ─── getAllCookies ────────────────────────────────────────────────────────────

describe('getAllCookies', () => {
  it('returns an array', async () => {
    const result = await getAllCookies();
    assert.ok(Array.isArray(result));
  });

  it('returns all set cookies', async () => {
    await setCookie({ name: 'a', value: '1' });
    await setCookie({ name: 'b', value: '2' });
    const result = await getAllCookies();
    assert.equal(result.length, 2);
    const names = result.map(c => c.name);
    assert.ok(names.includes('a'));
    assert.ok(names.includes('b'));
  });

  it('returns an empty array when no cookies are set', async () => {
    const result = await getAllCookies();
    assert.deepEqual(result, []);
  });

  it('returns an empty array when the API is absent', async () => {
    delete globalThis.cookieStore;
    const result = await getAllCookies();
    assert.deepEqual(result, []);
  });

  it('maps each entry to a CookieEntry with name and value', async () => {
    await setCookie({ name: 'foo', value: 'bar' });
    const result = await getAllCookies();
    const entry = result.find(c => c.name === 'foo');
    assert.ok(entry !== undefined);
    assert.equal(entry.value, 'bar');
  });
});

// ─── onCookieChange ───────────────────────────────────────────────────────────

describe('onCookieChange', () => {
  it('returns an unsubscribe function', () => {
    const unsub = onCookieChange(() => {});
    assert.equal(typeof unsub, 'function');
    unsub();
  });

  it('unsubscribe does not throw when called', () => {
    const unsub = onCookieChange(() => {});
    assert.doesNotThrow(() => unsub());
  });

  it('returns a no-op function and does not throw when API is absent', () => {
    delete globalThis.cookieStore;
    let unsub;
    assert.doesNotThrow(() => {
      unsub = onCookieChange(() => {});
    });
    assert.doesNotThrow(() => unsub());
  });

  it('registers a change listener on cookieStore', () => {
    const unsub = onCookieChange(() => {});
    const listeners = globalThis.cookieStore._listeners['change'] ?? [];
    assert.equal(listeners.length, 1);
    unsub();
  });

  it('removes the listener when unsubscribed', () => {
    const unsub = onCookieChange(() => {});
    unsub();
    const listeners = globalThis.cookieStore._listeners['change'] ?? [];
    assert.equal(listeners.length, 0);
  });

  it('invokes handler with changed and deleted arrays when event fires', () => {
    let receivedChanged = null;
    let receivedDeleted = null;

    const unsub = onCookieChange((changed, deleted) => {
      receivedChanged = changed;
      receivedDeleted = deleted;
    });

    // Simulate a change event
    const event = {
      type: 'change',
      changed: [{ name: 'session', value: 'newval' }],
      deleted: [{ name: 'oldcookie' }],
    };

    const listeners = globalThis.cookieStore._listeners['change'] ?? [];
    for (const fn of listeners) fn(event);

    assert.ok(Array.isArray(receivedChanged));
    assert.equal(receivedChanged.length, 1);
    assert.equal(receivedChanged[0].name, 'session');
    assert.ok(Array.isArray(receivedDeleted));
    assert.equal(receivedDeleted.length, 1);
    assert.equal(receivedDeleted[0], 'oldcookie');

    unsub();
  });
});
