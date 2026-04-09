// ─── Unit Tests: storage-utils ────────────────────────────────────────────────
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// ─── Storage mocks ────────────────────────────────────────────────────────────

function makeStorageMock() {
  const store = new Map();
  return {
    getItem(k) { return store.has(k) ? store.get(k) : null; },
    setItem(k, v) { store.set(k, String(v)); },
    removeItem(k) { store.delete(k); },
    clear() { store.clear(); },
    key(i) { return [...store.keys()][i] ?? null; },
    get length() { return store.size; },
    _store: store,
  };
}
globalThis.localStorage = makeStorageMock();
globalThis.sessionStorage = makeStorageMock();

// Window event support for onStorageChange
const _windowListeners = {};
globalThis.window = {
  addEventListener(type, fn) {
    if (!_windowListeners[type]) _windowListeners[type] = [];
    _windowListeners[type].push(fn);
  },
  removeEventListener(type, fn) {
    if (_windowListeners[type]) {
      _windowListeners[type] = _windowListeners[type].filter(f => f !== fn);
    }
  },
  dispatchEvent(evt) {
    for (const fn of (_windowListeners[evt.type] || [])) fn(evt);
  },
};

import {
  getLocal,
  setLocal,
  removeLocal,
  clearLocal,
  localKeys,
  getSession,
  setSession,
  removeSession,
  clearSession,
  sessionKeys,
  onStorageChange,
} from '../../app/modules/storage-utils.js';

// ─── localStorage ─────────────────────────────────────────────────────────────

describe('getLocal', () => {
  beforeEach(() => { localStorage.clear(); });

  it('returns null for a missing key', () => {
    assert.equal(getLocal('missing'), null);
  });

  it('returns a parsed object', () => {
    localStorage.setItem('obj', JSON.stringify({ x: 1 }));
    assert.deepEqual(getLocal('obj'), { x: 1 });
  });

  it('returns a parsed number', () => {
    localStorage.setItem('num', '42');
    assert.equal(getLocal('num'), 42);
  });

  it('returns a parsed array', () => {
    localStorage.setItem('arr', JSON.stringify([1, 2, 3]));
    assert.deepEqual(getLocal('arr'), [1, 2, 3]);
  });

  it('returns null for invalid JSON', () => {
    localStorage.setItem('bad', '{not valid json}');
    assert.equal(getLocal('bad'), null);
  });
});

describe('setLocal', () => {
  beforeEach(() => { localStorage.clear(); });

  it('stores a string value and returns true', () => {
    const result = setLocal('key', 'hello');
    assert.equal(result, true);
    assert.equal(localStorage.getItem('key'), '"hello"');
  });

  it('stores an object value', () => {
    setLocal('obj', { a: 1 });
    assert.deepEqual(JSON.parse(localStorage.getItem('obj')), { a: 1 });
  });

  it('stores a number value', () => {
    setLocal('num', 99);
    assert.equal(JSON.parse(localStorage.getItem('num')), 99);
  });

  it('stores null value', () => {
    setLocal('nil', null);
    assert.equal(JSON.parse(localStorage.getItem('nil')), null);
  });

  it('overwrites an existing value', () => {
    setLocal('k', 1);
    setLocal('k', 2);
    assert.equal(getLocal('k'), 2);
  });
});

describe('removeLocal', () => {
  beforeEach(() => { localStorage.clear(); });

  it('removes an existing key', () => {
    setLocal('k', 'v');
    removeLocal('k');
    assert.equal(getLocal('k'), null);
  });

  it('does not throw when key does not exist', () => {
    assert.doesNotThrow(() => removeLocal('nonexistent'));
  });
});

describe('clearLocal', () => {
  beforeEach(() => { localStorage.clear(); });

  it('removes all keys', () => {
    setLocal('a', 1);
    setLocal('b', 2);
    clearLocal();
    assert.equal(localStorage.length, 0);
  });

  it('is safe on empty storage', () => {
    assert.doesNotThrow(() => clearLocal());
  });
});

describe('localKeys', () => {
  beforeEach(() => { localStorage.clear(); });

  it('returns empty array when storage is empty', () => {
    assert.deepEqual(localKeys(), []);
  });

  it('returns all keys', () => {
    setLocal('a', 1);
    setLocal('b', 2);
    setLocal('c', 3);
    const keys = localKeys();
    assert.equal(keys.length, 3);
    assert.ok(keys.includes('a'));
    assert.ok(keys.includes('b'));
    assert.ok(keys.includes('c'));
  });
});

// ─── sessionStorage ───────────────────────────────────────────────────────────

describe('getSession', () => {
  beforeEach(() => { sessionStorage.clear(); });

  it('returns null for a missing key', () => {
    assert.equal(getSession('missing'), null);
  });

  it('returns a parsed value', () => {
    sessionStorage.setItem('x', JSON.stringify({ v: 42 }));
    assert.deepEqual(getSession('x'), { v: 42 });
  });

  it('returns null for invalid JSON', () => {
    sessionStorage.setItem('bad', 'not-json');
    assert.equal(getSession('bad'), null);
  });
});

describe('setSession', () => {
  beforeEach(() => { sessionStorage.clear(); });

  it('stores a value and returns true', () => {
    const result = setSession('key', 'world');
    assert.equal(result, true);
    assert.equal(sessionStorage.getItem('key'), '"world"');
  });

  it('stores an object', () => {
    setSession('obj', { z: 9 });
    assert.deepEqual(JSON.parse(sessionStorage.getItem('obj')), { z: 9 });
  });

  it('overwrites an existing value', () => {
    setSession('k', 'old');
    setSession('k', 'new');
    assert.equal(getSession('k'), 'new');
  });
});

describe('removeSession', () => {
  beforeEach(() => { sessionStorage.clear(); });

  it('removes a key', () => {
    setSession('s', 'val');
    removeSession('s');
    assert.equal(getSession('s'), null);
  });

  it('does not throw for missing key', () => {
    assert.doesNotThrow(() => removeSession('nope'));
  });
});

describe('clearSession', () => {
  beforeEach(() => { sessionStorage.clear(); });

  it('clears all session data', () => {
    setSession('a', 1);
    setSession('b', 2);
    clearSession();
    assert.equal(sessionStorage.length, 0);
  });
});

describe('sessionKeys', () => {
  beforeEach(() => { sessionStorage.clear(); });

  it('returns empty array when empty', () => {
    assert.deepEqual(sessionKeys(), []);
  });

  it('returns all session keys', () => {
    setSession('x', 1);
    setSession('y', 2);
    const keys = sessionKeys();
    assert.equal(keys.length, 2);
    assert.ok(keys.includes('x'));
    assert.ok(keys.includes('y'));
  });
});

// ─── onStorageChange ─────────────────────────────────────────────────────────

describe('onStorageChange', () => {
  it('calls callback when storage event fires for matching key', () => {
    let received = null;
    const unsub = onStorageChange('myKey', (newValue, oldValue) => {
      received = { newValue, oldValue };
    });

    window.dispatchEvent({ type: 'storage', key: 'myKey', newValue: 'new', oldValue: 'old' });
    assert.deepEqual(received, { newValue: 'new', oldValue: 'old' });
    unsub();
  });

  it('does not call callback for a different key', () => {
    let called = false;
    const unsub = onStorageChange('targetKey', () => { called = true; });

    window.dispatchEvent({ type: 'storage', key: 'otherKey', newValue: 'x', oldValue: null });
    assert.equal(called, false);
    unsub();
  });

  it('calls callback for any key when key is null', () => {
    const received = [];
    const unsub = onStorageChange(null, (newValue) => { received.push(newValue); });

    window.dispatchEvent({ type: 'storage', key: 'a', newValue: '1', oldValue: null });
    window.dispatchEvent({ type: 'storage', key: 'b', newValue: '2', oldValue: null });
    assert.deepEqual(received, ['1', '2']);
    unsub();
  });

  it('unsubscribe stops receiving events', () => {
    let count = 0;
    const unsub = onStorageChange('k', () => { count++; });

    window.dispatchEvent({ type: 'storage', key: 'k', newValue: 'a', oldValue: null });
    assert.equal(count, 1);

    unsub();
    window.dispatchEvent({ type: 'storage', key: 'k', newValue: 'b', oldValue: 'a' });
    assert.equal(count, 1);
  });

  it('passes null newValue and oldValue from event', () => {
    let result = null;
    const unsub = onStorageChange('gone', (newValue, oldValue) => {
      result = { newValue, oldValue };
    });

    window.dispatchEvent({ type: 'storage', key: 'gone', newValue: null, oldValue: 'prev' });
    assert.deepEqual(result, { newValue: null, oldValue: 'prev' });
    unsub();
  });
});
