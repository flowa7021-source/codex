// ─── Unit Tests: Scroll Manager ───────────────────────────────────────────────
import './setup-dom.js';
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  scrollTo,
  scrollBy,
  getScrollPosition,
  scrollIntoView,
  onScroll,
  saveScrollPosition,
  restoreScrollPosition,
} from '../../app/modules/scroll-manager.js';

// ─── Mock helpers ─────────────────────────────────────────────────────────────

function makeScrollable(scrollTop = 0, scrollLeft = 0) {
  return {
    scrollTop,
    scrollLeft,
    scrollHeight: 1000,
    scrollWidth: 1000,
    clientHeight: 100,
    clientWidth: 100,
    scrollTo(opts) {
      if (opts.top !== undefined) this.scrollTop = opts.top;
      if (opts.left !== undefined) this.scrollLeft = opts.left;
    },
    scrollBy(opts) {
      if (opts.top !== undefined) this.scrollTop += opts.top;
      if (opts.left !== undefined) this.scrollLeft += opts.left;
    },
    scrollIntoView() {},
    addEventListener(type, fn, opts) {
      this._listeners = this._listeners || {};
      if (!this._listeners[type]) this._listeners[type] = [];
      this._listeners[type].push(fn);
    },
    removeEventListener(type, fn) {
      if (this._listeners?.[type]) {
        this._listeners[type] = this._listeners[type].filter(f => f !== fn);
      }
    },
    dispatchEvent(evt) {
      if (this._listeners?.[evt.type]) {
        this._listeners[evt.type].forEach(fn => fn(evt));
      }
    },
  };
}

// ─── scrollTo ─────────────────────────────────────────────────────────────────

describe('scrollTo', () => {
  it('sets scrollTop on an element', () => {
    const el = makeScrollable(0, 0);
    scrollTo(el, { top: 200 });
    assert.equal(el.scrollTop, 200);
  });

  it('sets scrollLeft on an element', () => {
    const el = makeScrollable(0, 0);
    scrollTo(el, { left: 150 });
    assert.equal(el.scrollLeft, 150);
  });

  it('sets both scrollTop and scrollLeft', () => {
    const el = makeScrollable(0, 0);
    scrollTo(el, { top: 300, left: 100 });
    assert.equal(el.scrollTop, 300);
    assert.equal(el.scrollLeft, 100);
  });

  it('does not change position when called with empty options', () => {
    const el = makeScrollable(50, 75);
    scrollTo(el, {});
    assert.equal(el.scrollTop, 50);
    assert.equal(el.scrollLeft, 75);
  });

  it('falls back to property assignment when scrollTo method is absent', () => {
    const el = makeScrollable(0, 0);
    delete el.scrollTo;
    scrollTo(el, { top: 400 });
    assert.equal(el.scrollTop, 400);
  });
});

// ─── scrollBy ─────────────────────────────────────────────────────────────────

describe('scrollBy', () => {
  it('increments scrollTop by a delta', () => {
    const el = makeScrollable(100, 0);
    scrollBy(el, { top: 50 });
    assert.equal(el.scrollTop, 150);
  });

  it('increments scrollLeft by a delta', () => {
    const el = makeScrollable(0, 100);
    scrollBy(el, { left: 30 });
    assert.equal(el.scrollLeft, 130);
  });

  it('increments both axes simultaneously', () => {
    const el = makeScrollable(200, 50);
    scrollBy(el, { top: 10, left: -20 });
    assert.equal(el.scrollTop, 210);
    assert.equal(el.scrollLeft, 30);
  });

  it('falls back to property arithmetic when scrollBy method is absent', () => {
    const el = makeScrollable(100, 0);
    delete el.scrollBy;
    scrollBy(el, { top: 25 });
    assert.equal(el.scrollTop, 125);
  });
});

// ─── getScrollPosition ────────────────────────────────────────────────────────

describe('getScrollPosition', () => {
  it('returns { x, y } from an element scrollLeft/scrollTop', () => {
    const el = makeScrollable(80, 40);
    const pos = getScrollPosition(el);
    assert.deepEqual(pos, { x: 40, y: 80 });
  });

  it('returns { x: 0, y: 0 } for a freshly created element', () => {
    const el = makeScrollable(0, 0);
    const pos = getScrollPosition(el);
    assert.deepEqual(pos, { x: 0, y: 0 });
  });

  it('returns position from window when element has scrollX/scrollY', () => {
    const fakeWin = {
      scrollX: 10,
      scrollY: 20,
      addEventListener() {},
      removeEventListener() {},
    };
    const pos = getScrollPosition(fakeWin);
    assert.deepEqual(pos, { x: 10, y: 20 });
  });
});

// ─── scrollIntoView ───────────────────────────────────────────────────────────

describe('scrollIntoView', () => {
  it('calls scrollIntoView on the element when available', () => {
    let called = false;
    const el = {
      scrollIntoView(opts) { called = true; },
    };
    scrollIntoView(el, { behavior: 'smooth' });
    assert.ok(called);
  });

  it('does not throw when scrollIntoView is unavailable', () => {
    const el = {};
    assert.doesNotThrow(() => scrollIntoView(el));
  });
});

// ─── onScroll ─────────────────────────────────────────────────────────────────

describe('onScroll', () => {
  it('returns a cleanup function', () => {
    const el = makeScrollable();
    const unsub = onScroll(el, () => {});
    assert.equal(typeof unsub, 'function');
    unsub();
  });

  it('fires callback when a scroll event is dispatched', () => {
    const el = makeScrollable(100, 50);
    const calls = [];
    const unsub = onScroll(el, (x, y) => calls.push({ x, y }));

    el.dispatchEvent({ type: 'scroll' });

    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0], { x: 50, y: 100 });
    unsub();
  });

  it('removes the listener after unsubscribe', () => {
    const el = makeScrollable();
    const calls = [];
    const unsub = onScroll(el, (x, y) => calls.push({ x, y }));

    unsub();
    el.dispatchEvent({ type: 'scroll' });

    assert.equal(calls.length, 0);
  });

  it('fires callback multiple times for multiple events', () => {
    const el = makeScrollable(0, 0);
    const calls = [];
    const unsub = onScroll(el, (x, y) => calls.push({ x, y }));

    el.scrollTop = 10;
    el.dispatchEvent({ type: 'scroll' });
    el.scrollTop = 20;
    el.dispatchEvent({ type: 'scroll' });

    assert.equal(calls.length, 2);
    unsub();
  });
});

// ─── saveScrollPosition / restoreScrollPosition ───────────────────────────────

describe('saveScrollPosition + restoreScrollPosition', () => {
  it('saves and restores a scroll position', () => {
    const el = makeScrollable(200, 100);
    saveScrollPosition('page-1', el);

    // Move away
    el.scrollTop = 0;
    el.scrollLeft = 0;

    const restored = restoreScrollPosition('page-1', el);
    assert.ok(restored);
    assert.equal(el.scrollTop, 200);
    assert.equal(el.scrollLeft, 100);
  });

  it('returns false when no position has been saved for the key', () => {
    const el = makeScrollable();
    const result = restoreScrollPosition('nonexistent-key-xyz', el);
    assert.equal(result, false);
  });

  it('overwrites a previously saved position', () => {
    const el = makeScrollable(100, 0);
    saveScrollPosition('overwrite-key', el);

    el.scrollTop = 500;
    el.scrollLeft = 250;
    saveScrollPosition('overwrite-key', el);

    el.scrollTop = 0;
    el.scrollLeft = 0;

    restoreScrollPosition('overwrite-key', el);
    assert.equal(el.scrollTop, 500);
    assert.equal(el.scrollLeft, 250);
  });

  it('returns true on successful restore', () => {
    const el = makeScrollable(50, 0);
    saveScrollPosition('truthy-key', el);
    const result = restoreScrollPosition('truthy-key', el);
    assert.equal(result, true);
  });
});
