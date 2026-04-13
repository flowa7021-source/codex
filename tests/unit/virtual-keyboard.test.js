// ─── Unit Tests: Virtual Keyboard API ────────────────────────────────────────
import './setup-dom.js';
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  isVirtualKeyboardSupported,
  getKeyboardGeometry,
  enableOverlaysPolicy,
  disableOverlaysPolicy,
  onKeyboardGeometryChange,
  showVirtualKeyboard,
  hideVirtualKeyboard,
} from '../../app/modules/virtual-keyboard.js';

// ─── Fake virtualKeyboard ─────────────────────────────────────────────────────

beforeEach(() => {
  globalThis.navigator.virtualKeyboard = {
    boundingRect: { top: 0, left: 0, width: 0, height: 0 },
    overlaysContent: false,
    show() {},
    hide() {},
    addEventListener(type, fn) {
      this._listeners = this._listeners ?? {};
      (this._listeners[type] = this._listeners[type] ?? []).push(fn);
    },
    removeEventListener(type, fn) {
      this._listeners?.[type]?.filter(f => f !== fn);
    },
    dispatchGeometryChange(rect) {
      const r = { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
      this.boundingRect = r;
      (this._listeners?.geometrychange ?? []).forEach(f => f());
    },
  };
});

afterEach(() => {
  delete globalThis.navigator.virtualKeyboard;
});

// ─── isVirtualKeyboardSupported ───────────────────────────────────────────────

describe('isVirtualKeyboardSupported', () => {
  it('returns a boolean', () => {
    const result = isVirtualKeyboardSupported();
    assert.equal(typeof result, 'boolean');
  });

  it('returns true when virtualKeyboard is present', () => {
    assert.equal(isVirtualKeyboardSupported(), true);
  });

  it('returns false when virtualKeyboard is absent', () => {
    delete globalThis.navigator.virtualKeyboard;
    assert.equal(isVirtualKeyboardSupported(), false);
  });
});

// ─── getKeyboardGeometry ──────────────────────────────────────────────────────

describe('getKeyboardGeometry', () => {
  it('returns an object with top, left, width, height keys', () => {
    const geo = getKeyboardGeometry();
    assert.ok('top' in geo);
    assert.ok('left' in geo);
    assert.ok('width' in geo);
    assert.ok('height' in geo);
  });

  it('reads values from the mock boundingRect', () => {
    globalThis.navigator.virtualKeyboard.boundingRect = { top: 300, left: 10, width: 360, height: 250 };
    const geo = getKeyboardGeometry();
    assert.equal(geo.top, 300);
    assert.equal(geo.left, 10);
    assert.equal(geo.width, 360);
    assert.equal(geo.height, 250);
  });

  it('returns all zeros when API is absent', () => {
    delete globalThis.navigator.virtualKeyboard;
    const geo = getKeyboardGeometry();
    assert.deepEqual(geo, { top: 0, left: 0, width: 0, height: 0 });
  });
});

// ─── enableOverlaysPolicy ─────────────────────────────────────────────────────

describe('enableOverlaysPolicy', () => {
  it('sets overlaysContent to true', () => {
    globalThis.navigator.virtualKeyboard.overlaysContent = false;
    enableOverlaysPolicy();
    assert.equal(globalThis.navigator.virtualKeyboard.overlaysContent, true);
  });

  it('does not throw when API is absent', () => {
    delete globalThis.navigator.virtualKeyboard;
    assert.doesNotThrow(() => enableOverlaysPolicy());
  });
});

// ─── disableOverlaysPolicy ────────────────────────────────────────────────────

describe('disableOverlaysPolicy', () => {
  it('sets overlaysContent to false', () => {
    globalThis.navigator.virtualKeyboard.overlaysContent = true;
    disableOverlaysPolicy();
    assert.equal(globalThis.navigator.virtualKeyboard.overlaysContent, false);
  });

  it('does not throw when API is absent', () => {
    delete globalThis.navigator.virtualKeyboard;
    assert.doesNotThrow(() => disableOverlaysPolicy());
  });
});

// ─── onKeyboardGeometryChange ─────────────────────────────────────────────────

describe('onKeyboardGeometryChange', () => {
  it('returns an unsubscribe function', () => {
    const unsub = onKeyboardGeometryChange(() => {});
    assert.equal(typeof unsub, 'function');
    unsub();
  });

  it('fires the handler when geometrychange is dispatched', () => {
    let callCount = 0;
    let lastGeo = null;
    const unsub = onKeyboardGeometryChange((geo) => {
      callCount++;
      lastGeo = geo;
    });

    globalThis.navigator.virtualKeyboard.dispatchGeometryChange(
      { top: 400, left: 0, width: 375, height: 300 },
    );

    assert.equal(callCount, 1);
    assert.equal(lastGeo.top, 400);
    assert.equal(lastGeo.height, 300);
    unsub();
  });

  it('handler receives correct geometry values on each change', () => {
    const received = [];
    const unsub = onKeyboardGeometryChange((geo) => received.push({ ...geo }));

    globalThis.navigator.virtualKeyboard.dispatchGeometryChange(
      { top: 200, left: 0, width: 320, height: 180 },
    );
    globalThis.navigator.virtualKeyboard.dispatchGeometryChange(
      { top: 0, left: 0, width: 0, height: 0 },
    );

    assert.equal(received.length, 2);
    assert.equal(received[0].top, 200);
    assert.equal(received[1].top, 0);
    unsub();
  });

  it('does not throw when API is absent', () => {
    delete globalThis.navigator.virtualKeyboard;
    let unsub;
    assert.doesNotThrow(() => {
      unsub = onKeyboardGeometryChange(() => {});
    });
    assert.doesNotThrow(() => unsub());
  });

  it('unsubscribe prevents future handler calls', () => {
    // Replace removeEventListener with a real filtering implementation
    // so we can verify the handler is truly removed.
    const vk = globalThis.navigator.virtualKeyboard;
    vk.removeEventListener = function (type, fn) {
      if (this._listeners?.[type]) {
        this._listeners[type] = this._listeners[type].filter(f => f !== fn);
      }
    };

    let callCount = 0;
    const unsub = onKeyboardGeometryChange(() => { callCount++; });

    vk.dispatchGeometryChange({ top: 100, left: 0, width: 320, height: 200 });
    assert.equal(callCount, 1);

    unsub();

    vk.dispatchGeometryChange({ top: 50, left: 0, width: 320, height: 100 });
    assert.equal(callCount, 1, 'handler must not fire after unsubscribe');
  });
});

// ─── showVirtualKeyboard ──────────────────────────────────────────────────────

describe('showVirtualKeyboard', () => {
  it('calls show() on the virtualKeyboard object', () => {
    let showCalled = false;
    globalThis.navigator.virtualKeyboard.show = () => { showCalled = true; };
    showVirtualKeyboard();
    assert.equal(showCalled, true);
  });

  it('does not throw when API is absent', () => {
    delete globalThis.navigator.virtualKeyboard;
    assert.doesNotThrow(() => showVirtualKeyboard());
  });
});

// ─── hideVirtualKeyboard ──────────────────────────────────────────────────────

describe('hideVirtualKeyboard', () => {
  it('calls hide() on the virtualKeyboard object', () => {
    let hideCalled = false;
    globalThis.navigator.virtualKeyboard.hide = () => { hideCalled = true; };
    hideVirtualKeyboard();
    assert.equal(hideCalled, true);
  });

  it('does not throw when API is absent', () => {
    delete globalThis.navigator.virtualKeyboard;
    assert.doesNotThrow(() => hideVirtualKeyboard());
  });
});
