// ─── Unit Tests: Intersection Observer ───────────────────────────────────────
import './setup-dom.js';
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  isIntersectionObserverSupported,
  observeIntersection,
  lazyLoad,
  observeMany,
} from '../../app/modules/intersection-observer.js';

// ─── Mock IntersectionObserver ───────────────────────────────────────────────

class MockIntersectionObserver {
  constructor(callback, options) {
    this._callback = callback;
    this._options = options;
    this._observed = new Set();
    MockIntersectionObserver._instances.push(this);
  }
  observe(el) { this._observed.add(el); }
  unobserve(el) { this._observed.delete(el); }
  disconnect() { this._observed.clear(); }
  // Test helper: simulate intersection (only fires if element is still observed)
  trigger(el, isIntersecting, ratio = isIntersecting ? 1.0 : 0) {
    if (!this._observed.has(el)) return;
    this._callback([{
      target: el,
      isIntersecting,
      intersectionRatio: ratio,
      boundingClientRect: {},
      intersectionRect: {},
      rootBounds: null,
      time: 0,
    }]);
  }
  static _instances = [];
  static reset() { MockIntersectionObserver._instances = []; }
}

// ─── Test helpers ─────────────────────────────────────────────────────────────

function makeElement() {
  return { tagName: 'DIV' };
}

// ─── isIntersectionObserverSupported ─────────────────────────────────────────

describe('isIntersectionObserverSupported', () => {
  afterEach(() => {
    delete globalThis.IntersectionObserver;
  });

  it('returns false when IntersectionObserver is absent', () => {
    delete globalThis.IntersectionObserver;
    assert.equal(isIntersectionObserverSupported(), false);
  });

  it('returns true when IntersectionObserver is present', () => {
    globalThis.IntersectionObserver = MockIntersectionObserver;
    assert.equal(isIntersectionObserverSupported(), true);
  });

  it('returns a boolean', () => {
    assert.equal(typeof isIntersectionObserverSupported(), 'boolean');
  });
});

// ─── observeIntersection ─────────────────────────────────────────────────────

describe('observeIntersection', () => {
  beforeEach(() => {
    MockIntersectionObserver.reset();
    globalThis.IntersectionObserver = MockIntersectionObserver;
  });

  afterEach(() => {
    delete globalThis.IntersectionObserver;
  });

  it('returns a function', () => {
    const el = makeElement();
    const stop = observeIntersection(el, () => {});
    assert.equal(typeof stop, 'function');
  });

  it('creates an IntersectionObserver instance', () => {
    const el = makeElement();
    observeIntersection(el, () => {});
    assert.equal(MockIntersectionObserver._instances.length, 1);
  });

  it('observes the given element', () => {
    const el = makeElement();
    observeIntersection(el, () => {});
    const observer = MockIntersectionObserver._instances[0];
    assert.ok(observer._observed.has(el));
  });

  it('calls callback with isIntersecting=true when triggered entering', () => {
    const el = makeElement();
    const calls = [];
    observeIntersection(el, (isIntersecting, ratio) => {
      calls.push({ isIntersecting, ratio });
    });
    const observer = MockIntersectionObserver._instances[0];
    observer.trigger(el, true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].isIntersecting, true);
    assert.equal(calls[0].ratio, 1.0);
  });

  it('calls callback with isIntersecting=false when triggered leaving', () => {
    const el = makeElement();
    const calls = [];
    observeIntersection(el, (isIntersecting, ratio) => {
      calls.push({ isIntersecting, ratio });
    });
    const observer = MockIntersectionObserver._instances[0];
    observer.trigger(el, false);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].isIntersecting, false);
    assert.equal(calls[0].ratio, 0);
  });

  it('passes the entry object as the third argument to callback', () => {
    const el = makeElement();
    let receivedEntry = null;
    observeIntersection(el, (isIntersecting, ratio, entry) => {
      receivedEntry = entry;
    });
    const observer = MockIntersectionObserver._instances[0];
    observer.trigger(el, true);
    assert.ok(receivedEntry !== null);
    assert.equal(receivedEntry.target, el);
  });

  it('stop function disconnects the observer', () => {
    const el = makeElement();
    const stop = observeIntersection(el, () => {});
    const observer = MockIntersectionObserver._instances[0];
    assert.ok(observer._observed.has(el));
    stop();
    assert.equal(observer._observed.size, 0);
  });

  it('can be triggered multiple times', () => {
    const el = makeElement();
    let count = 0;
    observeIntersection(el, () => { count++; });
    const observer = MockIntersectionObserver._instances[0];
    observer.trigger(el, true);
    observer.trigger(el, false);
    observer.trigger(el, true);
    assert.equal(count, 3);
  });

  it('passes options to the IntersectionObserver constructor', () => {
    const el = makeElement();
    const options = { threshold: 0.5, rootMargin: '10px' };
    observeIntersection(el, () => {}, options);
    const observer = MockIntersectionObserver._instances[0];
    assert.deepEqual(observer._options, options);
  });

  it('calls callback immediately with true when IntersectionObserver is absent (fallback)', () => {
    delete globalThis.IntersectionObserver;
    const el = makeElement();
    const calls = [];
    observeIntersection(el, (isIntersecting, ratio) => {
      calls.push({ isIntersecting, ratio });
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].isIntersecting, true);
    assert.equal(calls[0].ratio, 1.0);
  });

  it('returns a no-op stop function when IntersectionObserver is absent', () => {
    delete globalThis.IntersectionObserver;
    const el = makeElement();
    const stop = observeIntersection(el, () => {});
    assert.doesNotThrow(() => stop());
  });
});

// ─── lazyLoad ────────────────────────────────────────────────────────────────

describe('lazyLoad', () => {
  beforeEach(() => {
    MockIntersectionObserver.reset();
    globalThis.IntersectionObserver = MockIntersectionObserver;
  });

  afterEach(() => {
    delete globalThis.IntersectionObserver;
  });

  it('returns a function', () => {
    const el = makeElement();
    const stop = lazyLoad(el, () => {});
    assert.equal(typeof stop, 'function');
  });

  it('calls onVisible when the element first becomes visible', () => {
    const el = makeElement();
    let called = 0;
    lazyLoad(el, () => { called++; });
    const observer = MockIntersectionObserver._instances[0];
    observer.trigger(el, true);
    assert.equal(called, 1);
  });

  it('does NOT call onVisible again after the second trigger', () => {
    const el = makeElement();
    let called = 0;
    lazyLoad(el, () => { called++; });
    const observer = MockIntersectionObserver._instances[0];
    observer.trigger(el, true);
    // After trigger, observer is disconnected — we verify called only once
    assert.equal(called, 1);
    // Manually trigger again (simulating a re-attach scenario) — should not re-fire
    // because the observer was already disconnected on first visible
    observer.trigger(el, true);
    assert.equal(called, 1);
  });

  it('does not call onVisible when not intersecting', () => {
    const el = makeElement();
    let called = 0;
    lazyLoad(el, () => { called++; });
    const observer = MockIntersectionObserver._instances[0];
    observer.trigger(el, false);
    assert.equal(called, 0);
  });

  it('unobserves the element after first visible trigger', () => {
    const el = makeElement();
    lazyLoad(el, () => {});
    const observer = MockIntersectionObserver._instances[0];
    assert.ok(observer._observed.has(el));
    observer.trigger(el, true);
    assert.equal(observer._observed.size, 0);
  });

  it('stop function prevents future calls', () => {
    const el = makeElement();
    let called = 0;
    const stop = lazyLoad(el, () => { called++; });
    stop();
    const observer = MockIntersectionObserver._instances[0];
    observer.trigger(el, true);
    assert.equal(called, 0);
  });

  it('calls onVisible immediately when IntersectionObserver is absent (fallback)', () => {
    delete globalThis.IntersectionObserver;
    const el = makeElement();
    let called = 0;
    lazyLoad(el, () => { called++; });
    assert.equal(called, 1);
  });

  it('accepts a custom threshold option', () => {
    const el = makeElement();
    lazyLoad(el, () => {}, 0.5);
    const observer = MockIntersectionObserver._instances[0];
    assert.equal(observer._options.threshold, 0.5);
  });
});

// ─── observeMany ─────────────────────────────────────────────────────────────

describe('observeMany', () => {
  beforeEach(() => {
    MockIntersectionObserver.reset();
    globalThis.IntersectionObserver = MockIntersectionObserver;
  });

  afterEach(() => {
    delete globalThis.IntersectionObserver;
  });

  it('returns a function', () => {
    const stop = observeMany([], () => {});
    assert.equal(typeof stop, 'function');
  });

  it('creates a single shared observer for all elements', () => {
    const elements = [makeElement(), makeElement(), makeElement()];
    observeMany(elements, () => {});
    assert.equal(MockIntersectionObserver._instances.length, 1);
  });

  it('observes all provided elements', () => {
    const elements = [makeElement(), makeElement()];
    observeMany(elements, () => {});
    const observer = MockIntersectionObserver._instances[0];
    for (const el of elements) {
      assert.ok(observer._observed.has(el));
    }
  });

  it('calls callback for each element when triggered', () => {
    const el1 = makeElement();
    const el2 = makeElement();
    const calls = [];
    observeMany([el1, el2], (element, isIntersecting) => {
      calls.push({ element, isIntersecting });
    });
    const observer = MockIntersectionObserver._instances[0];
    observer.trigger(el1, true);
    observer.trigger(el2, false);
    assert.equal(calls.length, 2);
    assert.equal(calls[0].element, el1);
    assert.equal(calls[0].isIntersecting, true);
    assert.equal(calls[1].element, el2);
    assert.equal(calls[1].isIntersecting, false);
  });

  it('stop function disconnects the shared observer', () => {
    const elements = [makeElement(), makeElement()];
    const stop = observeMany(elements, () => {});
    const observer = MockIntersectionObserver._instances[0];
    assert.equal(observer._observed.size, 2);
    stop();
    assert.equal(observer._observed.size, 0);
  });

  it('handles an empty elements array without throwing', () => {
    assert.doesNotThrow(() => observeMany([], () => {}));
  });

  it('calls callback immediately for each element when IntersectionObserver is absent (fallback)', () => {
    delete globalThis.IntersectionObserver;
    const elements = [makeElement(), makeElement(), makeElement()];
    const calls = [];
    observeMany(elements, (element, isIntersecting) => {
      calls.push({ element, isIntersecting });
    });
    assert.equal(calls.length, 3);
    for (let i = 0; i < elements.length; i++) {
      assert.equal(calls[i].element, elements[i]);
      assert.equal(calls[i].isIntersecting, true);
    }
  });
});
