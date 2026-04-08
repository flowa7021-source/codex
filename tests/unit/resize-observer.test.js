// ─── Unit Tests: Resize Observer ─────────────────────────────────────────────
import './setup-dom.js';
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  isResizeObserverSupported,
  observeResize,
  observeDocumentResize,
  measureElement,
} from '../../app/modules/resize-observer.js';

// ─── Mock ResizeObserver ──────────────────────────────────────────────────────

const instances = [];

class MockResizeObserver {
  constructor(cb) {
    this._cb = cb;
    this._el = null;
    this._opts = undefined;
    instances.push(this);
  }
  observe(el, opts) {
    this._el = el;
    this._opts = opts;
  }
  unobserve(_el) {}
  disconnect() {}
  trigger(width, height) {
    this._cb([{ contentRect: { width, height }, target: this._el }]);
  }
}

// ─── Setup / teardown ────────────────────────────────────────────────────────

beforeEach(() => {
  instances.length = 0;
  globalThis.ResizeObserver = MockResizeObserver;
});

afterEach(() => {
  instances.length = 0;
});

// ─── isResizeObserverSupported ────────────────────────────────────────────────

describe('isResizeObserverSupported', () => {
  it('returns a boolean', () => {
    assert.equal(typeof isResizeObserverSupported(), 'boolean');
  });

  it('returns true when ResizeObserver is present', () => {
    globalThis.ResizeObserver = MockResizeObserver;
    assert.equal(isResizeObserverSupported(), true);
  });

  it('returns false when ResizeObserver is absent', () => {
    delete globalThis.ResizeObserver;
    assert.equal(isResizeObserverSupported(), false);
    // restore
    globalThis.ResizeObserver = MockResizeObserver;
  });
});

// ─── observeResize ────────────────────────────────────────────────────────────

describe('observeResize', () => {
  it('returns a function', () => {
    const el = {};
    const stop = observeResize(el, () => {});
    assert.equal(typeof stop, 'function');
  });

  it('creates a ResizeObserver instance', () => {
    const el = {};
    observeResize(el, () => {});
    assert.equal(instances.length, 1);
  });

  it('observes the given element', () => {
    const el = {};
    observeResize(el, () => {});
    assert.equal(instances[0]._el, el);
  });

  it('calls callback with width and height when triggered', () => {
    const el = {};
    const calls = [];
    observeResize(el, (width, height) => {
      calls.push({ width, height });
    });
    instances[0].trigger(800, 600);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].width, 800);
    assert.equal(calls[0].height, 600);
  });

  it('passes the entry as the third argument to callback', () => {
    const el = {};
    let receivedEntry = null;
    observeResize(el, (width, height, entry) => {
      receivedEntry = entry;
    });
    instances[0].trigger(320, 240);
    assert.ok(receivedEntry !== null);
    assert.equal(receivedEntry.contentRect.width, 320);
  });

  it('can be triggered multiple times', () => {
    const el = {};
    const widths = [];
    observeResize(el, (width) => { widths.push(width); });
    instances[0].trigger(100, 50);
    instances[0].trigger(200, 100);
    instances[0].trigger(300, 150);
    assert.deepEqual(widths, [100, 200, 300]);
  });

  it('stop function returns without throwing', () => {
    const el = {};
    const stop = observeResize(el, () => {});
    assert.doesNotThrow(() => stop());
  });

  it('passes options to observe()', () => {
    const el = {};
    const options = { box: 'border-box' };
    observeResize(el, () => {}, options);
    assert.deepEqual(instances[0]._opts, options);
  });

  it('returns a no-op when ResizeObserver is absent', () => {
    delete globalThis.ResizeObserver;
    const el = {};
    const stop = observeResize(el, () => {});
    assert.equal(typeof stop, 'function');
    assert.doesNotThrow(() => stop());
    // restore
    globalThis.ResizeObserver = MockResizeObserver;
  });
});

// ─── observeDocumentResize ────────────────────────────────────────────────────

describe('observeDocumentResize', () => {
  it('returns a function', () => {
    const stop = observeDocumentResize(() => {});
    assert.equal(typeof stop, 'function');
  });

  it('creates a ResizeObserver', () => {
    observeDocumentResize(() => {});
    assert.equal(instances.length, 1);
  });

  it('observes document.documentElement', () => {
    observeDocumentResize(() => {});
    assert.equal(instances[0]._el, document.documentElement);
  });

  it('calls callback with width and height when triggered', () => {
    const sizes = [];
    observeDocumentResize((width, height) => { sizes.push({ width, height }); });
    instances[0].trigger(1920, 1080);
    assert.equal(sizes.length, 1);
    assert.equal(sizes[0].width, 1920);
    assert.equal(sizes[0].height, 1080);
  });

  it('stop function returns without throwing', () => {
    const stop = observeDocumentResize(() => {});
    assert.doesNotThrow(() => stop());
  });
});

// ─── measureElement ───────────────────────────────────────────────────────────

describe('measureElement', () => {
  it('returns a promise', () => {
    const el = {};
    const result = measureElement(el);
    assert.ok(result instanceof Promise);
    // Trigger the observer so the promise resolves cleanly
    instances[0].trigger(0, 0);
    return result;
  });

  it('resolves with width and height from the first observation', async () => {
    const el = {};
    const promise = measureElement(el);
    // Trigger after starting observation
    instances[0].trigger(640, 480);
    const result = await promise;
    assert.ok(result !== null);
    assert.equal(result.width, 640);
    assert.equal(result.height, 480);
  });

  it('resolves with zero dimensions when triggered with zeros', async () => {
    const el = {};
    const promise = measureElement(el);
    instances[0].trigger(0, 0);
    const result = await promise;
    assert.ok(result !== null);
    assert.equal(result.width, 0);
    assert.equal(result.height, 0);
  });

  it('resolves with null when ResizeObserver is absent', async () => {
    delete globalThis.ResizeObserver;
    const el = {};
    const result = await measureElement(el);
    assert.equal(result, null);
    // restore
    globalThis.ResizeObserver = MockResizeObserver;
  });

  it('creates a ResizeObserver and observes the element', () => {
    const el = {};
    const promise = measureElement(el);
    assert.equal(instances.length, 1);
    assert.equal(instances[0]._el, el);
    // Resolve promise to avoid unhandled rejection
    instances[0].trigger(1, 1);
    return promise;
  });

  it('resolves only with the first observation dimensions', async () => {
    const el = {};
    const promise = measureElement(el);
    instances[0].trigger(100, 200);
    const result = await promise;
    assert.equal(result.width, 100);
    assert.equal(result.height, 200);
  });
});
