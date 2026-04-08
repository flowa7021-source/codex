// ─── Unit Tests: Page Visibility ────────────────────────────────────────────
import './setup-dom.js';
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  isPageVisibilitySupported,
  isPageHidden,
  getVisibilityState,
  onVisibilityChange,
} from '../../app/modules/page-visibility.js';

// ─── Mock setup ──────────────────────────────────────────────────────────────
// Replace document with a version that supports the Page Visibility API
// and has a functional addEventListener/removeEventListener for 'visibilitychange'.

/** @type {Map<string, Set<Function>>} */
let _docListeners;
let _origDocument;

beforeEach(() => {
  _origDocument = globalThis.document;
  _docListeners = new Map();

  globalThis.document = {
    ..._origDocument,
    hidden: false,
    visibilityState: 'visible',
    addEventListener(type, fn) {
      if (!_docListeners.has(type)) _docListeners.set(type, new Set());
      _docListeners.get(type).add(fn);
    },
    removeEventListener(type, fn) {
      const set = _docListeners.get(type);
      if (set) set.delete(fn);
    },
    dispatchEvent(evt) {
      const set = _docListeners.get(evt.type);
      if (set) for (const fn of set) fn(evt);
    },
  };
});

afterEach(() => {
  globalThis.document = _origDocument;
  _docListeners = new Map();
});

/** Simulate a visibility change by updating document state and firing listeners. */
function simulateVisibilityChange(hidden, state) {
  globalThis.document.hidden = hidden;
  globalThis.document.visibilityState = state;
  const set = _docListeners.get('visibilitychange');
  if (set) {
    for (const fn of set) fn(new Event('visibilitychange'));
  }
}

// ─── isPageVisibilitySupported ───────────────────────────────────────────────

describe('isPageVisibilitySupported', () => {
  it('returns a boolean', () => {
    assert.equal(typeof isPageVisibilitySupported(), 'boolean');
  });

  it('returns true when hidden property is present on document', () => {
    assert.equal(isPageVisibilitySupported(), true);
  });

  it('returns false when hidden property is absent from document', () => {
    const doc = globalThis.document;
    delete doc.hidden;
    assert.equal(isPageVisibilitySupported(), false);
    doc.hidden = false; // restore
  });
});

// ─── isPageHidden ────────────────────────────────────────────────────────────

describe('isPageHidden', () => {
  it('returns a boolean', () => {
    assert.equal(typeof isPageHidden(), 'boolean');
  });

  it('returns false when document.hidden is false', () => {
    globalThis.document.hidden = false;
    assert.equal(isPageHidden(), false);
  });

  it('returns true when document.hidden is true', () => {
    globalThis.document.hidden = true;
    assert.equal(isPageHidden(), true);
  });

  it('returns false by default (page starts visible)', () => {
    assert.equal(isPageHidden(), false);
  });
});

// ─── getVisibilityState ──────────────────────────────────────────────────────

describe('getVisibilityState', () => {
  it('returns a string', () => {
    assert.equal(typeof getVisibilityState(), 'string');
  });

  it('returns visible by default', () => {
    assert.equal(getVisibilityState(), 'visible');
  });

  it('returns hidden when visibilityState is hidden', () => {
    globalThis.document.visibilityState = 'hidden';
    assert.equal(getVisibilityState(), 'hidden');
  });

  it('returns prerender when visibilityState is prerender', () => {
    globalThis.document.visibilityState = 'prerender';
    assert.equal(getVisibilityState(), 'prerender');
  });

  it('returns visible when visibilityState is visible', () => {
    globalThis.document.visibilityState = 'visible';
    assert.equal(getVisibilityState(), 'visible');
  });
});

// ─── onVisibilityChange ──────────────────────────────────────────────────────

describe('onVisibilityChange', () => {
  it('returns an unsubscribe function', () => {
    const unsub = onVisibilityChange(() => {});
    assert.equal(typeof unsub, 'function');
    unsub();
  });

  it('registers a visibilitychange listener on document', () => {
    onVisibilityChange(() => {});
    assert.ok(
      _docListeners.has('visibilitychange') && _docListeners.get('visibilitychange').size > 0,
      'expected a visibilitychange listener to be registered',
    );
  });

  it('fires callback with (hidden=true, state=hidden) when page becomes hidden', () => {
    const calls = [];
    onVisibilityChange((hidden, state) => calls.push({ hidden, state }));

    simulateVisibilityChange(true, 'hidden');

    assert.equal(calls.length, 1);
    assert.equal(calls[0].hidden, true);
    assert.equal(calls[0].state, 'hidden');
  });

  it('fires callback with (hidden=false, state=visible) when page becomes visible', () => {
    const calls = [];
    onVisibilityChange((hidden, state) => calls.push({ hidden, state }));

    simulateVisibilityChange(false, 'visible');

    assert.equal(calls.length, 1);
    assert.equal(calls[0].hidden, false);
    assert.equal(calls[0].state, 'visible');
  });

  it('fires callback multiple times on multiple changes', () => {
    const calls = [];
    onVisibilityChange((hidden, state) => calls.push({ hidden, state }));

    simulateVisibilityChange(true, 'hidden');
    simulateVisibilityChange(false, 'visible');
    simulateVisibilityChange(true, 'hidden');

    assert.equal(calls.length, 3);
  });

  it('unsubscribe removes the listener so callback is no longer called', () => {
    const calls = [];
    const unsub = onVisibilityChange((hidden, state) => calls.push({ hidden, state }));

    simulateVisibilityChange(true, 'hidden');
    assert.equal(calls.length, 1);

    unsub();
    simulateVisibilityChange(false, 'visible');
    assert.equal(calls.length, 1, 'callback should not fire after unsubscribe');
  });

  it('multiple listeners can be registered independently', () => {
    const callsA = [];
    const callsB = [];
    const unsubA = onVisibilityChange((h) => callsA.push(h));
    const unsubB = onVisibilityChange((h) => callsB.push(h));

    simulateVisibilityChange(true, 'hidden');
    assert.equal(callsA.length, 1);
    assert.equal(callsB.length, 1);

    unsubA();
    simulateVisibilityChange(false, 'visible');
    assert.equal(callsA.length, 1, 'A should not fire after its unsubscribe');
    assert.equal(callsB.length, 2, 'B should still fire');

    unsubB();
  });
});
