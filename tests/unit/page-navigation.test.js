// ─── Unit Tests: Page Navigation ─────────────────────────────────────────────
import './setup-dom.js';
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  isNavigationApiSupported,
  navigateToPage,
  replaceCurrentPage,
  getCurrentPageState,
  onPageNavigate,
  canGoBack,
  canGoForward,
  goBack,
  goForward,
  getHistoryLength,
} from '../../app/modules/page-navigation.js';

// ─── History API mock helpers ────────────────────────────────────────────────

/** Capture calls to history.pushState / history.replaceState. */
let _pushStateCalls = [];
let _replaceStateCalls = [];
let _historyState = null;
let _historyLength = 1;

function _installHistoryMock() {
  // Ensure navigation API is absent so fallback path is taken
  if ('navigation' in globalThis.window) {
    delete globalThis.window.navigation;
  }
  globalThis.window.history = {
    get state() { return _historyState; },
    get length() { return _historyLength; },
    pushState(state, _title, url) {
      _historyState = state;
      _historyLength += 1;
      _pushStateCalls.push({ state, url });
    },
    replaceState(state, _title, url) {
      _historyState = state;
      _replaceStateCalls.push({ state, url });
    },
    back() {},
    forward() {},
  };
}

function _resetHistoryMock() {
  _pushStateCalls = [];
  _replaceStateCalls = [];
  _historyState = null;
  _historyLength = 1;
}

// ─── Setup / teardown ────────────────────────────────────────────────────────

beforeEach(() => {
  _installHistoryMock();
  _resetHistoryMock();
});

afterEach(() => {
  _resetHistoryMock();
});

// ─── isNavigationApiSupported ────────────────────────────────────────────────

describe('isNavigationApiSupported', () => {
  it('returns a boolean', () => {
    const result = isNavigationApiSupported();
    assert.equal(typeof result, 'boolean');
  });

  it('returns false when navigation is absent from window', () => {
    // _installHistoryMock removed navigation
    assert.equal(isNavigationApiSupported(), false);
  });
});

// ─── navigateToPage ──────────────────────────────────────────────────────────

describe('navigateToPage', () => {
  it("doesn't throw", () => {
    assert.doesNotThrow(() => navigateToPage({ docName: 'doc.pdf', page: 3 }));
  });

  it('calls history.pushState with History API fallback', () => {
    const state = { docName: 'test.pdf', page: 5, zoom: 1.5 };
    navigateToPage(state);
    assert.equal(_pushStateCalls.length, 1);
    assert.deepEqual(_pushStateCalls[0].state, state);
  });

  it('builds URL with page hash when docName is set', () => {
    navigateToPage({ docName: 'doc.pdf', page: 7 });
    assert.equal(_pushStateCalls[0].url, '#page-7');
  });

  it('builds bare hash URL when docName is null', () => {
    navigateToPage({ docName: null, page: 1 });
    assert.equal(_pushStateCalls[0].url, '#');
  });
});

// ─── replaceCurrentPage ──────────────────────────────────────────────────────

describe('replaceCurrentPage', () => {
  it("doesn't throw", () => {
    assert.doesNotThrow(() => replaceCurrentPage({ docName: 'doc.pdf', page: 2 }));
  });

  it('calls history.replaceState with History API fallback', () => {
    const state = { docName: 'book.pdf', page: 10 };
    replaceCurrentPage(state);
    assert.equal(_replaceStateCalls.length, 1);
    assert.deepEqual(_replaceStateCalls[0].state, state);
  });
});

// ─── getCurrentPageState ─────────────────────────────────────────────────────

describe('getCurrentPageState', () => {
  it('returns null or a PageState object', () => {
    const result = getCurrentPageState();
    const isNull = result === null;
    const isPageState = typeof result === 'object' && result !== null && typeof result.page === 'number';
    assert.ok(isNull || isPageState, 'must be null or PageState');
  });

  it('returns null when history.state is null', () => {
    _historyState = null;
    assert.equal(getCurrentPageState(), null);
  });

  it('returns null when history.state is not a PageState', () => {
    _historyState = { foo: 'bar' };
    assert.equal(getCurrentPageState(), null);
  });

  it('returns the state when history.state is a valid PageState', () => {
    const state = { docName: 'a.pdf', page: 4, zoom: 1.0 };
    _historyState = state;
    const result = getCurrentPageState();
    assert.deepEqual(result, state);
  });
});

// ─── State round-trip ────────────────────────────────────────────────────────

describe('state round-trip (History API fallback)', () => {
  it('navigateToPage → getCurrentPageState returns same state', () => {
    const state = { docName: 'roundtrip.pdf', page: 11, zoom: 2.0 };
    navigateToPage(state);
    const retrieved = getCurrentPageState();
    assert.deepEqual(retrieved, state);
  });
});

// ─── onPageNavigate ──────────────────────────────────────────────────────────

describe('onPageNavigate', () => {
  it('returns an unsubscribe function', () => {
    const unsub = onPageNavigate(() => {});
    assert.equal(typeof unsub, 'function');
    unsub();
  });

  it('unsubscribe removes handler', () => {
    const received = [];
    const unsub = onPageNavigate((state) => received.push(state));

    // Subscribe and then immediately unsubscribe
    unsub();

    // Fire a popstate event — handler should not be called
    const state = { docName: 'doc.pdf', page: 3 };
    _historyState = state;
    const evt = new Event('popstate');
    globalThis.window.dispatchEvent(evt);

    assert.equal(received.length, 0, 'handler must not be called after unsubscribe');
  });

  it('fires handler on popstate with valid PageState', () => {
    const received = [];
    const unsub = onPageNavigate((state) => received.push(state));

    const state = { docName: 'test.pdf', page: 5 };
    _historyState = state;
    const evt = new Event('popstate');
    globalThis.window.dispatchEvent(evt);

    assert.equal(received.length, 1);
    assert.deepEqual(received[0], state);

    unsub();
  });

  it('does not fire handler when history.state is not a valid PageState', () => {
    const received = [];
    const unsub = onPageNavigate((state) => received.push(state));

    _historyState = { notAPage: true };
    const evt = new Event('popstate');
    globalThis.window.dispatchEvent(evt);

    assert.equal(received.length, 0);
    unsub();
  });
});

// ─── canGoBack / canGoForward ────────────────────────────────────────────────

describe('canGoBack', () => {
  it('returns a boolean', () => {
    assert.equal(typeof canGoBack(), 'boolean');
  });

  it('returns false when history length is 1', () => {
    _historyLength = 1;
    assert.equal(canGoBack(), false);
  });

  it('returns true when history length is > 1', () => {
    _historyLength = 3;
    assert.equal(canGoBack(), true);
  });
});

describe('canGoForward', () => {
  it('returns a boolean', () => {
    assert.equal(typeof canGoForward(), 'boolean');
  });

  it('returns false with History API fallback (cannot detect forward entries)', () => {
    assert.equal(canGoForward(), false);
  });
});

// ─── goBack / goForward ──────────────────────────────────────────────────────

describe('goBack', () => {
  it("doesn't throw when there's no history", () => {
    _historyLength = 1;
    assert.doesNotThrow(() => goBack());
  });

  it("doesn't throw when history has entries", () => {
    _historyLength = 3;
    assert.doesNotThrow(() => goBack());
  });
});

describe('goForward', () => {
  it("doesn't throw when no history to go forward", () => {
    assert.doesNotThrow(() => goForward());
  });
});

// ─── getHistoryLength ────────────────────────────────────────────────────────

describe('getHistoryLength', () => {
  it('returns a number >= 0', () => {
    const len = getHistoryLength();
    assert.equal(typeof len, 'number');
    assert.ok(len >= 0, `expected >= 0, got ${len}`);
  });

  it('reflects History API length', () => {
    _historyLength = 5;
    assert.equal(getHistoryLength(), 5);
  });
});
