// ─── Unit Tests: Focus Manager ───────────────────────────────────────────────
import './setup-dom.js';
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  isFocusable,
  getFocusableElements,
  trapFocus,
  focusElement,
  focusNext,
  focusPrev,
  getActiveElement,
} from '../../app/modules/focus-manager.js';

// ─── Mock helpers ─────────────────────────────────────────────────────────────

/**
 * Create a focusable button mock (or disabled if disabled=true).
 */
function makeButton(disabled = false) {
  const el = globalThis.document.createElement('button');
  el.disabled = disabled;
  el.tabIndex = 0;
  let focused = false;
  el.focus = () => {
    focused = true;
    el._focused = true;
  };
  el.blur = () => {
    focused = false;
    el._focused = false;
  };
  return el;
}

/**
 * Create a non-focusable plain div.
 */
function makeDiv() {
  const el = globalThis.document.createElement('div');
  el.tabIndex = -1;
  return el;
}

/**
 * Build a container element whose querySelectorAll returns the given elements.
 * This bypasses the limited CSS selector support in setup-dom.js.
 */
function makeContainer(elements = []) {
  const container = globalThis.document.createElement('div');
  const _keydownListeners = [];

  container.addEventListener = (type, fn, opts) => {
    if (type === 'keydown') _keydownListeners.push(fn);
  };
  container.removeEventListener = (type, fn) => {
    if (type === 'keydown') {
      const idx = _keydownListeners.indexOf(fn);
      if (idx !== -1) _keydownListeners.splice(idx, 1);
    }
  };
  container.dispatchKeydown = (event) => {
    _keydownListeners.forEach(fn => fn(event));
  };
  container.querySelectorAll = () => elements;

  return container;
}

// ─── Mock document.activeElement ─────────────────────────────────────────────

let _activeEl = null;
Object.defineProperty(globalThis.document, 'activeElement', {
  get: () => _activeEl,
  configurable: true,
});

// ─── isFocusable ──────────────────────────────────────────────────────────────

describe('isFocusable', () => {
  it('returns true for a button element', () => {
    const btn = makeButton();
    assert.equal(isFocusable(btn), true);
  });

  it('returns false for a disabled button', () => {
    const btn = makeButton(true);
    assert.equal(isFocusable(btn), false);
  });

  it('returns true for an input element', () => {
    const input = globalThis.document.createElement('input');
    input.tabIndex = 0;
    assert.equal(isFocusable(input), true);
  });

  it('returns false for a plain div with no tabIndex', () => {
    const div = globalThis.document.createElement('div');
    // tabIndex is undefined by default in the mock
    assert.equal(isFocusable(div), false);
  });

  it('returns true for a div with tabIndex >= 0', () => {
    const div = globalThis.document.createElement('div');
    div.tabIndex = 0;
    assert.equal(isFocusable(div), true);
  });

  it('returns false for an element with tabIndex < 0', () => {
    const div = globalThis.document.createElement('div');
    div.tabIndex = -1;
    assert.equal(isFocusable(div), false);
  });

  it('returns true for a select element', () => {
    const sel = globalThis.document.createElement('select');
    sel.tabIndex = 0;
    assert.equal(isFocusable(sel), true);
  });

  it('returns true for a textarea element', () => {
    const ta = globalThis.document.createElement('textarea');
    ta.tabIndex = 0;
    assert.equal(isFocusable(ta), true);
  });
});

// ─── getFocusableElements ──────────────────────────────────────────────────────

describe('getFocusableElements', () => {
  it('returns only focusable elements within a container', () => {
    const btn1 = makeButton();
    const btn2 = makeButton();
    const disabled = makeButton(true);
    const div = makeDiv();

    const container = makeContainer([btn1, btn2, disabled, div]);
    const result = getFocusableElements(container);

    assert.ok(result.includes(btn1));
    assert.ok(result.includes(btn2));
    assert.ok(!result.includes(disabled));
    assert.ok(!result.includes(div));
  });

  it('returns an empty array when no focusable elements exist', () => {
    const container = makeContainer([makeDiv(), makeDiv()]);
    assert.deepEqual(getFocusableElements(container), []);
  });

  it('returns all focusable elements when all are enabled', () => {
    const btns = [makeButton(), makeButton(), makeButton()];
    const container = makeContainer(btns);
    assert.equal(getFocusableElements(container).length, 3);
  });
});

// ─── focusElement ─────────────────────────────────────────────────────────────

describe('focusElement', () => {
  it('calls focus() on the element and returns true', () => {
    const btn = makeButton();
    const result = focusElement(btn);
    assert.equal(result, true);
    assert.equal(btn._focused, true);
  });

  it('returns false if focus() throws an error', () => {
    const el = globalThis.document.createElement('div');
    el.focus = () => { throw new Error('focus not allowed'); };
    const result = focusElement(el);
    assert.equal(result, false);
  });
});

// ─── getActiveElement ─────────────────────────────────────────────────────────

describe('getActiveElement', () => {
  beforeEach(() => {
    _activeEl = null;
  });

  it('returns null when no element is focused', () => {
    _activeEl = null;
    assert.equal(getActiveElement(), null);
  });

  it('returns document.activeElement when set', () => {
    const btn = makeButton();
    _activeEl = btn;
    assert.equal(getActiveElement(), btn);
  });
});

// ─── trapFocus ────────────────────────────────────────────────────────────────

describe('trapFocus', () => {
  beforeEach(() => {
    _activeEl = null;
  });

  it('returns a cleanup/release function', () => {
    const container = makeContainer([makeButton()]);
    const release = trapFocus(container);
    assert.equal(typeof release, 'function');
    release();
  });

  it('wraps focus from last to first on Tab press at end', () => {
    const btn1 = makeButton();
    const btn2 = makeButton();
    const container = makeContainer([btn1, btn2]);
    const release = trapFocus(container);

    // Simulate focus on the last element
    _activeEl = btn2;

    let defaultPrevented = false;
    container.dispatchKeydown({
      key: 'Tab',
      shiftKey: false,
      preventDefault: () => { defaultPrevented = true; },
    });

    assert.equal(btn1._focused, true, 'focus should wrap to first element');
    assert.equal(defaultPrevented, true);
    release();
  });

  it('wraps focus from first to last on Shift+Tab press at start', () => {
    const btn1 = makeButton();
    const btn2 = makeButton();
    const container = makeContainer([btn1, btn2]);
    const release = trapFocus(container);

    // Simulate focus on the first element
    _activeEl = btn1;

    let defaultPrevented = false;
    container.dispatchKeydown({
      key: 'Tab',
      shiftKey: true,
      preventDefault: () => { defaultPrevented = true; },
    });

    assert.equal(btn2._focused, true, 'focus should wrap to last element');
    assert.equal(defaultPrevented, true);
    release();
  });

  it('does nothing on non-Tab key events', () => {
    const btn1 = makeButton();
    const btn2 = makeButton();
    const container = makeContainer([btn1, btn2]);
    const release = trapFocus(container);

    _activeEl = btn2;

    let defaultPrevented = false;
    container.dispatchKeydown({
      key: 'Enter',
      shiftKey: false,
      preventDefault: () => { defaultPrevented = true; },
    });

    assert.equal(defaultPrevented, false);
    release();
  });

  it('removes the listener when released', () => {
    const btn1 = makeButton();
    const btn2 = makeButton();
    const container = makeContainer([btn1, btn2]);
    const release = trapFocus(container);

    release();

    _activeEl = btn2;
    let defaultPrevented = false;
    container.dispatchKeydown({
      key: 'Tab',
      shiftKey: false,
      preventDefault: () => { defaultPrevented = true; },
    });

    // After release, no focus-wrapping should occur
    assert.equal(defaultPrevented, false);
    assert.equal(btn1._focused, undefined);
  });
});

// ─── focusNext ────────────────────────────────────────────────────────────────

describe('focusNext', () => {
  beforeEach(() => {
    _activeEl = null;
  });

  it('focuses the first element when no element is currently focused', () => {
    const btn1 = makeButton();
    const btn2 = makeButton();
    const container = makeContainer([btn1, btn2]);

    focusNext(container);
    assert.equal(btn1._focused, true);
  });

  it('moves focus to the next element in sequence', () => {
    const btn1 = makeButton();
    const btn2 = makeButton();
    const container = makeContainer([btn1, btn2]);

    _activeEl = btn1;
    focusNext(container);
    assert.equal(btn2._focused, true);
  });

  it('wraps from last element back to first', () => {
    const btn1 = makeButton();
    const btn2 = makeButton();
    const container = makeContainer([btn1, btn2]);

    _activeEl = btn2;
    focusNext(container);
    assert.equal(btn1._focused, true);
  });
});

// ─── focusPrev ────────────────────────────────────────────────────────────────

describe('focusPrev', () => {
  beforeEach(() => {
    _activeEl = null;
  });

  it('focuses the last element when no element is currently focused', () => {
    const btn1 = makeButton();
    const btn2 = makeButton();
    const container = makeContainer([btn1, btn2]);

    focusPrev(container);
    assert.equal(btn2._focused, true);
  });

  it('moves focus to the previous element in sequence', () => {
    const btn1 = makeButton();
    const btn2 = makeButton();
    const container = makeContainer([btn1, btn2]);

    _activeEl = btn2;
    focusPrev(container);
    assert.equal(btn1._focused, true);
  });

  it('wraps from first element back to last', () => {
    const btn1 = makeButton();
    const btn2 = makeButton();
    const container = makeContainer([btn1, btn2]);

    _activeEl = btn1;
    focusPrev(container);
    assert.equal(btn2._focused, true);
  });
});
