// ─── Unit Tests: Pointer Events API ──────────────────────────────────────────
import './setup-dom.js';
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// ─── Mock PointerEvent ────────────────────────────────────────────────────────
// Provide a PointerEvent class before importing the module under test so that
// isPointerEventsSupported() sees it at module load time.
if (typeof globalThis.PointerEvent === 'undefined') {
  globalThis.PointerEvent = class PointerEvent extends Event {
    constructor(type, init) {
      super(type);
      Object.assign(this, {
        pointerId: 1,
        pointerType: 'mouse',
        pressure: 0.5,
        tiltX: 0,
        tiltY: 0,
        clientX: 10,
        clientY: 20,
        width: 1,
        height: 1,
        isPrimary: true,
        ...init,
      });
    }
  };
}

import {
  isPointerEventsSupported,
  eventToPoint,
  attachPointerHandlers,
  getActivePointers,
  isPenInput,
  isTouchInput,
} from '../../app/modules/pointer-events.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a minimal fake element with addEventListener / removeEventListener. */
function makeFakeElement() {
  const _listeners = {};
  return {
    addEventListener(type, fn) {
      if (!_listeners[type]) _listeners[type] = [];
      _listeners[type].push(fn);
    },
    removeEventListener(type, fn) {
      if (_listeners[type]) _listeners[type] = _listeners[type].filter(f => f !== fn);
    },
    dispatch(type, init = {}) {
      const evt = new globalThis.PointerEvent(type, init);
      for (const fn of (_listeners[type] ?? [])) fn(evt);
    },
    listenerCount(type) {
      return (_listeners[type] ?? []).length;
    },
    setPointerCapture() {},
  };
}

/** Build a PointerEvent with given overrides. */
function makePointerEvent(type = 'pointermove', overrides = {}) {
  return new globalThis.PointerEvent(type, overrides);
}

// ─── isPointerEventsSupported ─────────────────────────────────────────────────

describe('isPointerEventsSupported', () => {
  it('returns a boolean', () => {
    assert.equal(typeof isPointerEventsSupported(), 'boolean');
  });

  it('returns true when PointerEvent is defined', () => {
    assert.equal(isPointerEventsSupported(), true);
  });

  it('returns false when PointerEvent is absent', () => {
    const orig = globalThis.PointerEvent;
    delete globalThis.PointerEvent;
    assert.equal(isPointerEventsSupported(), false);
    globalThis.PointerEvent = orig;
  });
});

// ─── eventToPoint ─────────────────────────────────────────────────────────────

describe('eventToPoint', () => {
  it('converts a PointerEvent to a PointerPoint with correct coordinates', () => {
    const evt = makePointerEvent('pointermove', { clientX: 42, clientY: 84 });
    const point = eventToPoint(evt);
    assert.equal(point.x, 42);
    assert.equal(point.y, 84);
  });

  it('copies pressure correctly', () => {
    const evt = makePointerEvent('pointermove', { pressure: 0.75 });
    const point = eventToPoint(evt);
    assert.equal(point.pressure, 0.75);
  });

  it('copies tiltX and tiltY', () => {
    const evt = makePointerEvent('pointermove', { tiltX: 30, tiltY: -15 });
    const point = eventToPoint(evt);
    assert.equal(point.tiltX, 30);
    assert.equal(point.tiltY, -15);
  });

  it('copies pointerId', () => {
    const evt = makePointerEvent('pointermove', { pointerId: 7 });
    const point = eventToPoint(evt);
    assert.equal(point.pointerId, 7);
  });

  it('copies isPrimary', () => {
    const evt = makePointerEvent('pointermove', { isPrimary: false });
    const point = eventToPoint(evt);
    assert.equal(point.isPrimary, false);
  });

  it('copies width and height (contact area)', () => {
    const evt = makePointerEvent('pointermove', { width: 10, height: 12 });
    const point = eventToPoint(evt);
    assert.equal(point.width, 10);
    assert.equal(point.height, 12);
  });

  it('normalizes pointerType "mouse" correctly', () => {
    const evt = makePointerEvent('pointermove', { pointerType: 'mouse' });
    assert.equal(eventToPoint(evt).pointerType, 'mouse');
  });

  it('normalizes pointerType "touch" correctly', () => {
    const evt = makePointerEvent('pointermove', { pointerType: 'touch' });
    assert.equal(eventToPoint(evt).pointerType, 'touch');
  });

  it('normalizes pointerType "pen" correctly', () => {
    const evt = makePointerEvent('pointermove', { pointerType: 'pen' });
    assert.equal(eventToPoint(evt).pointerType, 'pen');
  });

  it('normalizes unknown pointerType to "unknown"', () => {
    const evt = makePointerEvent('pointermove', { pointerType: 'joystick' });
    assert.equal(eventToPoint(evt).pointerType, 'unknown');
  });

  it('normalizes empty string pointerType to "unknown"', () => {
    const evt = makePointerEvent('pointermove', { pointerType: '' });
    assert.equal(eventToPoint(evt).pointerType, 'unknown');
  });
});

// ─── attachPointerHandlers ────────────────────────────────────────────────────

describe('attachPointerHandlers', () => {
  it('returns a function (unsubscribe)', () => {
    const el = makeFakeElement();
    const detach = attachPointerHandlers(el, {});
    assert.equal(typeof detach, 'function');
    detach();
  });

  it('onDown fires on pointerdown', () => {
    const el = makeFakeElement();
    let called = 0;
    const detach = attachPointerHandlers(el, { onDown: () => { called++; } });
    el.dispatch('pointerdown');
    assert.equal(called, 1);
    detach();
  });

  it('onMove fires on pointermove', () => {
    const el = makeFakeElement();
    let called = 0;
    const detach = attachPointerHandlers(el, { onMove: () => { called++; } });
    el.dispatch('pointermove');
    assert.equal(called, 1);
    detach();
  });

  it('onUp fires on pointerup', () => {
    const el = makeFakeElement();
    let called = 0;
    const detach = attachPointerHandlers(el, { onUp: () => { called++; } });
    el.dispatch('pointerup');
    assert.equal(called, 1);
    detach();
  });

  it('onCancel fires on pointercancel', () => {
    const el = makeFakeElement();
    let called = 0;
    const detach = attachPointerHandlers(el, { onCancel: () => { called++; } });
    el.dispatch('pointercancel');
    assert.equal(called, 1);
    detach();
  });

  it('onDown receives a PointerPoint with correct data', () => {
    const el = makeFakeElement();
    let received = null;
    const detach = attachPointerHandlers(el, { onDown: (pt) => { received = pt; } });
    el.dispatch('pointerdown', { clientX: 5, clientY: 15, pointerType: 'touch' });
    assert.ok(received !== null);
    assert.equal(received.x, 5);
    assert.equal(received.y, 15);
    assert.equal(received.pointerType, 'touch');
    detach();
  });

  it('unsubscribe stops onDown callbacks', () => {
    const el = makeFakeElement();
    let called = 0;
    const detach = attachPointerHandlers(el, { onDown: () => { called++; } });
    detach();
    el.dispatch('pointerdown');
    assert.equal(called, 0);
  });

  it('unsubscribe stops onMove callbacks', () => {
    const el = makeFakeElement();
    let called = 0;
    const detach = attachPointerHandlers(el, { onMove: () => { called++; } });
    detach();
    el.dispatch('pointermove');
    assert.equal(called, 0);
  });

  it('unsubscribe removes all four event listeners', () => {
    const el = makeFakeElement();
    attachPointerHandlers(el, {
      onDown: () => {},
      onMove: () => {},
      onUp: () => {},
      onCancel: () => {},
    })();
    assert.equal(el.listenerCount('pointerdown'), 0);
    assert.equal(el.listenerCount('pointermove'), 0);
    assert.equal(el.listenerCount('pointerup'), 0);
    assert.equal(el.listenerCount('pointercancel'), 0);
  });

  it('works when no handlers are provided (does not throw)', () => {
    const el = makeFakeElement();
    const detach = attachPointerHandlers(el, {});
    assert.doesNotThrow(() => {
      el.dispatch('pointerdown');
      el.dispatch('pointermove');
      el.dispatch('pointerup');
      el.dispatch('pointercancel');
    });
    detach();
  });

  it('setPointerCapture failure does not throw (element not in DOM)', () => {
    const el = makeFakeElement();
    el.setPointerCapture = () => { throw new Error('not in DOM'); };
    const detach = attachPointerHandlers(el, { onDown: () => {} });
    assert.doesNotThrow(() => el.dispatch('pointerdown'));
    detach();
  });
});

// ─── getActivePointers ────────────────────────────────────────────────────────

describe('getActivePointers', () => {
  it('returns an array', () => {
    const el = makeFakeElement();
    const result = getActivePointers(el);
    assert.ok(Array.isArray(result));
  });

  it('tracks a pointer after pointerdown', () => {
    const el = makeFakeElement();
    const detach = attachPointerHandlers(el, {});
    el.dispatch('pointerdown', { pointerId: 99, clientX: 1, clientY: 2 });
    const active = getActivePointers(el);
    assert.ok(active.some(p => p.pointerId === 99));
    // Clean up: fire pointerup to remove from map
    el.dispatch('pointerup', { pointerId: 99 });
    detach();
  });

  it('removes pointer after pointerup', () => {
    const el = makeFakeElement();
    const detach = attachPointerHandlers(el, {});
    el.dispatch('pointerdown', { pointerId: 88 });
    el.dispatch('pointerup', { pointerId: 88 });
    const active = getActivePointers(el);
    assert.ok(!active.some(p => p.pointerId === 88));
    detach();
  });
});

// ─── isPenInput ───────────────────────────────────────────────────────────────

describe('isPenInput', () => {
  it('returns true for pen pointerType', () => {
    const pt = eventToPoint(makePointerEvent('pointermove', { pointerType: 'pen' }));
    assert.equal(isPenInput(pt), true);
  });

  it('returns false for mouse pointerType', () => {
    const pt = eventToPoint(makePointerEvent('pointermove', { pointerType: 'mouse' }));
    assert.equal(isPenInput(pt), false);
  });

  it('returns false for touch pointerType', () => {
    const pt = eventToPoint(makePointerEvent('pointermove', { pointerType: 'touch' }));
    assert.equal(isPenInput(pt), false);
  });

  it('returns false for unknown pointerType', () => {
    const pt = eventToPoint(makePointerEvent('pointermove', { pointerType: '' }));
    assert.equal(isPenInput(pt), false);
  });
});

// ─── isTouchInput ─────────────────────────────────────────────────────────────

describe('isTouchInput', () => {
  it('returns true for touch pointerType', () => {
    const pt = eventToPoint(makePointerEvent('pointermove', { pointerType: 'touch' }));
    assert.equal(isTouchInput(pt), true);
  });

  it('returns false for mouse pointerType', () => {
    const pt = eventToPoint(makePointerEvent('pointermove', { pointerType: 'mouse' }));
    assert.equal(isTouchInput(pt), false);
  });

  it('returns false for pen pointerType', () => {
    const pt = eventToPoint(makePointerEvent('pointermove', { pointerType: 'pen' }));
    assert.equal(isTouchInput(pt), false);
  });

  it('returns false for unknown pointerType', () => {
    const pt = eventToPoint(makePointerEvent('pointermove', { pointerType: '' }));
    assert.equal(isTouchInput(pt), false);
  });
});
