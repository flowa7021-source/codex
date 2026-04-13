// ─── Unit Tests: Keyboard Shortcut Manager ────────────────────────────────────
import './setup-dom.js';
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  matchesShortcut,
  formatShortcut,
  registerShortcut,
  unregisterShortcut,
  getRegisteredShortcuts,
  clearShortcuts,
} from '../../app/modules/keyboard-shortcuts.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fireKey(key, opts = {}) {
  const evt = Object.assign(
    new Event('keydown'),
    { key, ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, ...opts },
  );
  globalThis.window.dispatchEvent(evt);
}

// Reset shortcuts before each test so state does not leak between tests
beforeEach(() => {
  clearShortcuts();
});

// ─── matchesShortcut ──────────────────────────────────────────────────────────

describe('matchesShortcut', () => {
  it('matches an exact key with no modifiers', () => {
    const evt = Object.assign(new Event('keydown'), {
      key: 'k', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false,
    });
    assert.equal(matchesShortcut(evt, { key: 'k' }), true);
  });

  it('is case-insensitive for the key', () => {
    const evt = Object.assign(new Event('keydown'), {
      key: 'K', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false,
    });
    assert.equal(matchesShortcut(evt, { key: 'k' }), true);
  });

  it('matches a key with multiple modifiers', () => {
    const evt = Object.assign(new Event('keydown'), {
      key: 'z', ctrlKey: true, shiftKey: true, altKey: false, metaKey: false,
    });
    assert.equal(matchesShortcut(evt, { key: 'z', ctrl: true, shift: true }), true);
  });

  it('returns false when the key does not match', () => {
    const evt = Object.assign(new Event('keydown'), {
      key: 'x', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false,
    });
    assert.equal(matchesShortcut(evt, { key: 'k' }), false);
  });

  it('returns false when a required modifier is missing from the event', () => {
    const evt = Object.assign(new Event('keydown'), {
      key: 'k', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false,
    });
    assert.equal(matchesShortcut(evt, { key: 'k', ctrl: true }), false);
  });

  it('returns false when the event has an extra modifier not in the definition', () => {
    const evt = Object.assign(new Event('keydown'), {
      key: 'k', ctrlKey: true, shiftKey: false, altKey: false, metaKey: false,
    });
    assert.equal(matchesShortcut(evt, { key: 'k' }), false);
  });

  it('matches ArrowUp key', () => {
    const evt = Object.assign(new Event('keydown'), {
      key: 'ArrowUp', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false,
    });
    assert.equal(matchesShortcut(evt, { key: 'ArrowUp' }), true);
  });

  it('matches alt modifier', () => {
    const evt = Object.assign(new Event('keydown'), {
      key: 'f', ctrlKey: false, shiftKey: false, altKey: true, metaKey: false,
    });
    assert.equal(matchesShortcut(evt, { key: 'f', alt: true }), true);
  });

  it('matches meta modifier', () => {
    const evt = Object.assign(new Event('keydown'), {
      key: 's', ctrlKey: false, shiftKey: false, altKey: false, metaKey: true,
    });
    assert.equal(matchesShortcut(evt, { key: 's', meta: true }), true);
  });
});

// ─── formatShortcut ──────────────────────────────────────────────────────────

describe('formatShortcut', () => {
  it("formats { ctrl: true, key: 'k' } as 'Ctrl+K'", () => {
    assert.equal(formatShortcut({ key: 'k', ctrl: true }), 'Ctrl+K');
  });

  it("formats { shift: true, alt: true, key: 'f' } as 'Shift+Alt+F'", () => {
    assert.equal(formatShortcut({ key: 'f', shift: true, alt: true }), 'Shift+Alt+F');
  });

  it('formats a key with no modifiers', () => {
    assert.equal(formatShortcut({ key: 'escape' }), 'Escape');
  });

  it('formats a single uppercase letter key', () => {
    assert.equal(formatShortcut({ key: 'a' }), 'A');
  });

  it('formats all four modifiers', () => {
    assert.equal(
      formatShortcut({ key: 'z', ctrl: true, shift: true, alt: true, meta: true }),
      'Ctrl+Shift+Alt+Meta+Z',
    );
  });

  it("formats 'ArrowUp' with shift", () => {
    assert.equal(formatShortcut({ key: 'ArrowUp', shift: true }), 'Shift+ArrowUp');
  });

  it('formats meta + key', () => {
    assert.equal(formatShortcut({ key: 's', meta: true }), 'Meta+S');
  });
});

// ─── registerShortcut ────────────────────────────────────────────────────────

describe('registerShortcut', () => {
  it('returns a function (unregister)', () => {
    const unregister = registerShortcut({ key: 'k' }, () => {});
    assert.equal(typeof unregister, 'function');
  });

  it('calls the handler when a matching keydown event fires', () => {
    let called = 0;
    registerShortcut({ key: 'k' }, () => { called++; });
    fireKey('k');
    assert.equal(called, 1);
  });

  it('calls handler for Ctrl+S', () => {
    let called = 0;
    registerShortcut({ key: 's', ctrl: true }, () => { called++; });
    fireKey('s', { ctrlKey: true });
    assert.equal(called, 1);
  });

  it('does not call handler when key does not match', () => {
    let called = 0;
    registerShortcut({ key: 'k' }, () => { called++; });
    fireKey('j');
    assert.equal(called, 0);
  });

  it('does not call handler when modifier does not match', () => {
    let called = 0;
    registerShortcut({ key: 'k', ctrl: true }, () => { called++; });
    fireKey('k'); // no ctrlKey
    assert.equal(called, 0);
  });

  it('supports multiple handlers on the same key', () => {
    let a = 0;
    let b = 0;
    registerShortcut({ key: 'm' }, () => { a++; });
    registerShortcut({ key: 'm' }, () => { b++; });
    fireKey('m');
    assert.equal(a, 1);
    assert.equal(b, 1);
  });

  it('supports registering handlers for different keys', () => {
    let a = 0;
    let b = 0;
    registerShortcut({ key: 'a' }, () => { a++; });
    registerShortcut({ key: 'b' }, () => { b++; });
    fireKey('a');
    assert.equal(a, 1);
    assert.equal(b, 0);
    fireKey('b');
    assert.equal(a, 1);
    assert.equal(b, 1);
  });
});

// ─── unregister function (returned by registerShortcut) ───────────────────────

describe('registerShortcut – unregister', () => {
  it('removes the handler so it is no longer called', () => {
    let called = 0;
    const unregister = registerShortcut({ key: 'k' }, () => { called++; });
    fireKey('k');
    assert.equal(called, 1);

    unregister();
    fireKey('k');
    assert.equal(called, 1); // still 1 — handler was removed
  });

  it('only removes the specific handler, leaving others intact', () => {
    let a = 0;
    let b = 0;
    const unregisterA = registerShortcut({ key: 'q' }, () => { a++; });
    registerShortcut({ key: 'q' }, () => { b++; });

    unregisterA();
    fireKey('q');

    assert.equal(a, 0);
    assert.equal(b, 1);
  });

  it('calling unregister twice is safe', () => {
    let called = 0;
    const unregister = registerShortcut({ key: 'x' }, () => { called++; });
    unregister();
    assert.doesNotThrow(() => unregister());
    fireKey('x');
    assert.equal(called, 0);
  });
});

// ─── unregisterShortcut ──────────────────────────────────────────────────────

describe('unregisterShortcut', () => {
  it('removes all handlers for a given key combination', () => {
    let a = 0;
    let b = 0;
    registerShortcut({ key: 'p' }, () => { a++; });
    registerShortcut({ key: 'p' }, () => { b++; });

    unregisterShortcut({ key: 'p' });
    fireKey('p');

    assert.equal(a, 0);
    assert.equal(b, 0);
  });

  it('does not affect handlers for a different key', () => {
    let a = 0;
    let b = 0;
    registerShortcut({ key: 'r' }, () => { a++; });
    registerShortcut({ key: 't' }, () => { b++; });

    unregisterShortcut({ key: 'r' });
    fireKey('t');

    assert.equal(a, 0);
    assert.equal(b, 1);
  });
});

// ─── getRegisteredShortcuts ──────────────────────────────────────────────────

describe('getRegisteredShortcuts', () => {
  it('returns an empty array when no shortcuts are registered', () => {
    assert.deepEqual(getRegisteredShortcuts(), []);
  });

  it('returns an entry for each registered handler', () => {
    registerShortcut({ key: 'a', description: 'Go to A' }, () => {});
    registerShortcut({ key: 'b', ctrl: true }, () => {});

    const shortcuts = getRegisteredShortcuts();
    assert.equal(shortcuts.length, 2);
  });

  it('includes the shortcut definition in each entry', () => {
    registerShortcut({ key: 'h', ctrl: true, description: 'Help' }, () => {});
    const shortcuts = getRegisteredShortcuts();
    assert.equal(shortcuts.length, 1);
    assert.equal(shortcuts[0].shortcut.key, 'h');
    assert.equal(shortcuts[0].shortcut.ctrl, true);
  });

  it('includes description when provided', () => {
    registerShortcut({ key: 'd', description: 'Delete' }, () => {});
    const shortcuts = getRegisteredShortcuts();
    assert.equal(shortcuts[0].description, 'Delete');
  });

  it('has undefined description when not provided', () => {
    registerShortcut({ key: 'n' }, () => {});
    const shortcuts = getRegisteredShortcuts();
    assert.equal(shortcuts[0].description, undefined);
  });
});

// ─── clearShortcuts ──────────────────────────────────────────────────────────

describe('clearShortcuts', () => {
  it('removes all registered shortcuts', () => {
    registerShortcut({ key: 'c' }, () => {});
    registerShortcut({ key: 'v' }, () => {});

    clearShortcuts();

    assert.deepEqual(getRegisteredShortcuts(), []);
  });

  it('handlers are no longer called after clearShortcuts', () => {
    let called = 0;
    registerShortcut({ key: 'w' }, () => { called++; });

    clearShortcuts();
    fireKey('w');

    assert.equal(called, 0);
  });

  it('calling clearShortcuts on an empty registry is safe', () => {
    assert.doesNotThrow(() => clearShortcuts());
  });

  it('can register new shortcuts after clearing', () => {
    let called = 0;
    registerShortcut({ key: 'y' }, () => { called++; });
    clearShortcuts();

    registerShortcut({ key: 'y' }, () => { called++; });
    fireKey('y');

    assert.equal(called, 1);
  });
});
