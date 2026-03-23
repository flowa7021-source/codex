import './setup-dom.js';
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

// Ensure navigator has vibrate and maxTouchPoints
if (!globalThis.navigator.vibrate) {
  globalThis.navigator.vibrate = () => true;
}
if (!globalThis.navigator.maxTouchPoints) {
  globalThis.navigator.maxTouchPoints = 1;
}

// Provide visualViewport mock
if (!globalThis.window.visualViewport) {
  globalThis.window.visualViewport = {
    height: 1080,
    addEventListener() {},
  };
}

// document.body needs classList
if (!globalThis.document.body.classList) {
  const bodyClasses = new Set();
  globalThis.document.body.classList = {
    add(...cls) { cls.forEach(c => bodyClasses.add(c)); },
    remove(...cls) { cls.forEach(c => bodyClasses.delete(c)); },
    toggle(c, force) { force ? bodyClasses.add(c) : bodyClasses.delete(c); },
    contains(c) { return bodyClasses.has(c); },
  };
}

// document.activeElement
if (!globalThis.document.activeElement) {
  globalThis.document.activeElement = null;
}

// document.dispatchEvent
if (!globalThis.document.dispatchEvent) {
  globalThis.document.dispatchEvent = () => {};
}

const {
  initTouchGestures,
  isTouchDevice,
  hapticFeedback,
  setupVirtualKeyboardAdaptation,
} = await import('../../app/modules/touch-gestures.js');

function makeViewport() {
  return globalThis.document.createElement('div');
}

describe('touch-gestures', () => {
  it('initTouchGestures does not throw with valid deps', () => {
    const viewport = makeViewport();
    assert.doesNotThrow(() => {
      initTouchGestures({
        nextPage: () => {},
        prevPage: () => {},
        viewport,
      });
    });
  });

  it('initTouchGestures handles null viewport gracefully', () => {
    assert.doesNotThrow(() => {
      initTouchGestures({
        nextPage: () => {},
        prevPage: () => {},
        viewport: null,
      });
    });
  });

  it('isTouchDevice returns a boolean', () => {
    const result = isTouchDevice();
    assert.equal(typeof result, 'boolean');
  });

  it('isTouchDevice returns true when maxTouchPoints > 0', () => {
    globalThis.navigator.maxTouchPoints = 5;
    assert.equal(isTouchDevice(), true);
  });

  it('hapticFeedback does not throw', () => {
    assert.doesNotThrow(() => hapticFeedback());
  });

  it('hapticFeedback accepts a custom duration', () => {
    assert.doesNotThrow(() => hapticFeedback(50));
  });

  it('hapticFeedback handles missing vibrate gracefully', () => {
    const origVibrate = globalThis.navigator.vibrate;
    globalThis.navigator.vibrate = undefined;
    assert.doesNotThrow(() => hapticFeedback());
    globalThis.navigator.vibrate = origVibrate;
  });

  it('setupVirtualKeyboardAdaptation does not throw', () => {
    assert.doesNotThrow(() => setupVirtualKeyboardAdaptation());
  });

  it('swipe left triggers nextPage', () => {
    const viewport = makeViewport();
    let nextCalled = false;
    initTouchGestures({
      nextPage: () => { nextCalled = true; },
      prevPage: () => {},
      viewport,
    });
    // Simulate touch start
    viewport.dispatchEvent({
      type: 'touchstart',
      touches: [{ clientX: 300, clientY: 200 }],
    });
    // Simulate touch end (swipe left: endX < startX by > 80px)
    viewport.dispatchEvent({
      type: 'touchend',
      changedTouches: [{ clientX: 100, clientY: 200 }],
    });
    assert.equal(nextCalled, true);
  });

  it('swipe right triggers prevPage', () => {
    const viewport = makeViewport();
    let prevCalled = false;
    initTouchGestures({
      nextPage: () => {},
      prevPage: () => { prevCalled = true; },
      viewport,
    });
    viewport.dispatchEvent({
      type: 'touchstart',
      touches: [{ clientX: 100, clientY: 200 }],
    });
    viewport.dispatchEvent({
      type: 'touchend',
      changedTouches: [{ clientX: 300, clientY: 200 }],
    });
    assert.equal(prevCalled, true);
  });

  it('small swipe does not trigger navigation', () => {
    const viewport = makeViewport();
    let called = false;
    initTouchGestures({
      nextPage: () => { called = true; },
      prevPage: () => { called = true; },
      viewport,
    });
    viewport.dispatchEvent({
      type: 'touchstart',
      touches: [{ clientX: 200, clientY: 200 }],
    });
    viewport.dispatchEvent({
      type: 'touchend',
      changedTouches: [{ clientX: 220, clientY: 200 }],
    });
    assert.equal(called, false);
  });
});
