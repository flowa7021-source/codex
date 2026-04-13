// ─── Unit Tests: Touch Gesture Detection ──────────────────────────────────────
import './setup-dom.js';
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  isTouchSupported,
  attachSwipeDetector,
  attachPinchDetector,
  attachLongPress,
} from '../../app/modules/gesture-detection.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build a minimal touch-event-like object from an array of [x, y] coordinates.
 */
function makeTouchEvent(type, touches) {
  return Object.assign(new Event(type), {
    touches: touches.map(([x, y]) => ({ clientX: x, clientY: y })),
    changedTouches: touches.map(([x, y]) => ({ clientX: x, clientY: y })),
    preventDefault() {},
  });
}

/**
 * Return a DOM element that supports addEventListener/removeEventListener/dispatchEvent.
 */
function makeEl() {
  return globalThis.document.createElement('div');
}

// ─── isTouchSupported ────────────────────────────────────────────────────────

describe('isTouchSupported', () => {
  it('returns a boolean', () => {
    assert.equal(typeof isTouchSupported(), 'boolean');
  });

  it('returns true when ontouchstart is present on window', () => {
    globalThis.window.ontouchstart = null;
    assert.equal(isTouchSupported(), true);
    delete globalThis.window.ontouchstart;
  });

  it('returns true when navigator.maxTouchPoints > 0', () => {
    const orig = globalThis.navigator.maxTouchPoints;
    globalThis.navigator.maxTouchPoints = 5;
    assert.equal(isTouchSupported(), true);
    globalThis.navigator.maxTouchPoints = orig;
  });
});

// ─── attachSwipeDetector ─────────────────────────────────────────────────────

describe('attachSwipeDetector', () => {
  it('returns a cleanup function', () => {
    const el = makeEl();
    const cleanup = attachSwipeDetector(el, {});
    assert.equal(typeof cleanup, 'function');
    cleanup();
  });

  it('calls onSwipeLeft when swiping left beyond threshold', () => {
    const el = makeEl();
    let swipedLeft = false;

    const cleanup = attachSwipeDetector(el, {
      onSwipeLeft: () => { swipedLeft = true; },
      threshold: 50,
      maxTime: 300,
    });

    el.dispatchEvent(makeTouchEvent('touchstart', [[200, 100]]));
    el.dispatchEvent(makeTouchEvent('touchend',   [[100, 100]])); // dx = -100

    assert.equal(swipedLeft, true);
    cleanup();
  });

  it('calls onSwipeRight when swiping right beyond threshold', () => {
    const el = makeEl();
    let swipedRight = false;

    const cleanup = attachSwipeDetector(el, {
      onSwipeRight: () => { swipedRight = true; },
      threshold: 50,
      maxTime: 300,
    });

    el.dispatchEvent(makeTouchEvent('touchstart', [[100, 100]]));
    el.dispatchEvent(makeTouchEvent('touchend',   [[200, 100]])); // dx = +100

    assert.equal(swipedRight, true);
    cleanup();
  });

  it('calls onSwipeUp when swiping up beyond threshold', () => {
    const el = makeEl();
    let swipedUp = false;

    const cleanup = attachSwipeDetector(el, {
      onSwipeUp: () => { swipedUp = true; },
      threshold: 50,
      maxTime: 300,
    });

    el.dispatchEvent(makeTouchEvent('touchstart', [[100, 200]]));
    el.dispatchEvent(makeTouchEvent('touchend',   [[100, 100]])); // dy = -100

    assert.equal(swipedUp, true);
    cleanup();
  });

  it('calls onSwipeDown when swiping down beyond threshold', () => {
    const el = makeEl();
    let swipedDown = false;

    const cleanup = attachSwipeDetector(el, {
      onSwipeDown: () => { swipedDown = true; },
      threshold: 50,
      maxTime: 300,
    });

    el.dispatchEvent(makeTouchEvent('touchstart', [[100, 100]]));
    el.dispatchEvent(makeTouchEvent('touchend',   [[100, 200]])); // dy = +100

    assert.equal(swipedDown, true);
    cleanup();
  });

  it('does not fire when movement is below threshold', () => {
    const el = makeEl();
    let fired = false;

    const cleanup = attachSwipeDetector(el, {
      onSwipeLeft: () => { fired = true; },
      onSwipeRight: () => { fired = true; },
      threshold: 100,
      maxTime: 300,
    });

    el.dispatchEvent(makeTouchEvent('touchstart', [[100, 100]]));
    el.dispatchEvent(makeTouchEvent('touchend',   [[140, 100]])); // dx = 40, below threshold

    assert.equal(fired, false);
    cleanup();
  });

  it('cleanup removes listeners so swipe is no longer detected', () => {
    const el = makeEl();
    let called = 0;

    const cleanup = attachSwipeDetector(el, {
      onSwipeLeft: () => { called++; },
      threshold: 50,
      maxTime: 300,
    });

    // Verify handler works before cleanup
    el.dispatchEvent(makeTouchEvent('touchstart', [[200, 100]]));
    el.dispatchEvent(makeTouchEvent('touchend',   [[100, 100]]));
    assert.equal(called, 1);

    // Remove listeners and verify handler no longer fires
    cleanup();
    el.dispatchEvent(makeTouchEvent('touchstart', [[200, 100]]));
    el.dispatchEvent(makeTouchEvent('touchend',   [[100, 100]]));
    assert.equal(called, 1);
  });
});

// ─── attachPinchDetector ─────────────────────────────────────────────────────

describe('attachPinchDetector', () => {
  it('returns a cleanup function', () => {
    const el = makeEl();
    const cleanup = attachPinchDetector(el, {});
    assert.equal(typeof cleanup, 'function');
    cleanup();
  });

  it('calls onPinchOut when fingers move apart', () => {
    const el = makeEl();
    let outScale = null;

    const cleanup = attachPinchDetector(el, {
      onPinchOut: (scale) => { outScale = scale; },
    });

    // Start with fingers 100px apart
    el.dispatchEvent(makeTouchEvent('touchstart', [[0, 0], [100, 0]]));
    // Move fingers to 200px apart
    el.dispatchEvent(makeTouchEvent('touchmove',  [[0, 0], [200, 0]]));

    assert.ok(outScale !== null, 'onPinchOut should have been called');
    assert.ok(outScale > 1, `scale should be > 1, got ${outScale}`);
    cleanup();
  });

  it('calls onPinchIn when fingers move together', () => {
    const el = makeEl();
    let inScale = null;

    const cleanup = attachPinchDetector(el, {
      onPinchIn: (scale) => { inScale = scale; },
    });

    // Start with fingers 200px apart
    el.dispatchEvent(makeTouchEvent('touchstart', [[0, 0], [200, 0]]));
    // Move fingers to 100px apart
    el.dispatchEvent(makeTouchEvent('touchmove',  [[0, 0], [100, 0]]));

    assert.ok(inScale !== null, 'onPinchIn should have been called');
    assert.ok(inScale < 1, `scale should be < 1, got ${inScale}`);
    cleanup();
  });

  it('does not fire when there is only one touch', () => {
    const el = makeEl();
    let fired = false;

    const cleanup = attachPinchDetector(el, {
      onPinchIn:  () => { fired = true; },
      onPinchOut: () => { fired = true; },
    });

    el.dispatchEvent(makeTouchEvent('touchstart', [[0, 0]]));
    el.dispatchEvent(makeTouchEvent('touchmove',  [[100, 0]]));

    assert.equal(fired, false);
    cleanup();
  });

  it('cleanup removes listeners', () => {
    const el = makeEl();
    let called = 0;

    const cleanup = attachPinchDetector(el, {
      onPinchOut: () => { called++; },
    });

    el.dispatchEvent(makeTouchEvent('touchstart', [[0, 0], [100, 0]]));
    el.dispatchEvent(makeTouchEvent('touchmove',  [[0, 0], [200, 0]]));
    assert.equal(called, 1);

    cleanup();
    el.dispatchEvent(makeTouchEvent('touchstart', [[0, 0], [100, 0]]));
    el.dispatchEvent(makeTouchEvent('touchmove',  [[0, 0], [200, 0]]));
    assert.equal(called, 1);
  });
});

// ─── attachLongPress ─────────────────────────────────────────────────────────

describe('attachLongPress', () => {
  it('returns a cleanup function', () => {
    const el = makeEl();
    const cleanup = attachLongPress(el, () => {});
    assert.equal(typeof cleanup, 'function');
    cleanup();
  });

  it('fires the callback after the delay when touchstart is held', async () => {
    const el = makeEl();
    let fired = false;

    const cleanup = attachLongPress(el, () => { fired = true; }, 20);

    el.dispatchEvent(makeTouchEvent('touchstart', [[0, 0]]));

    await new Promise((resolve) => setTimeout(resolve, 40));

    assert.equal(fired, true);
    cleanup();
  });

  it('does not fire the callback when touch ends before the delay', async () => {
    const el = makeEl();
    let fired = false;

    const cleanup = attachLongPress(el, () => { fired = true; }, 100);

    el.dispatchEvent(makeTouchEvent('touchstart', [[0, 0]]));
    el.dispatchEvent(makeTouchEvent('touchend',   [[0, 0]]));

    await new Promise((resolve) => setTimeout(resolve, 150));

    assert.equal(fired, false);
    cleanup();
  });

  it('does not fire the callback when touch moves before the delay', async () => {
    const el = makeEl();
    let fired = false;

    const cleanup = attachLongPress(el, () => { fired = true; }, 100);

    el.dispatchEvent(makeTouchEvent('touchstart', [[0,   0]]));
    el.dispatchEvent(makeTouchEvent('touchmove',  [[10,  0]]));

    await new Promise((resolve) => setTimeout(resolve, 150));

    assert.equal(fired, false);
    cleanup();
  });

  it('uses the default delay of 500ms', () => {
    const el = makeEl();
    // Just verify the function signature works with default delay
    const cleanup = attachLongPress(el, () => {});
    assert.equal(typeof cleanup, 'function');
    cleanup();
  });

  it('cleanup cancels any pending timer and removes listeners', async () => {
    const el = makeEl();
    let fired = false;

    const cleanup = attachLongPress(el, () => { fired = true; }, 30);

    el.dispatchEvent(makeTouchEvent('touchstart', [[0, 0]]));
    // Immediately clean up — timer should be cancelled
    cleanup();

    await new Promise((resolve) => setTimeout(resolve, 60));

    assert.equal(fired, false);
  });
});
