// ─── Unit Tests: Color Scheme Detection ─────────────────────────────────────
import './setup-dom.js';
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  isColorSchemeSupportedByMedia,
  getColorScheme,
  prefersDark,
  prefersLight,
  prefersReducedMotion,
  prefersReducedTransparency,
  prefersHighContrast,
  onColorSchemeChange,
} from '../../app/modules/color-scheme.js';

// ─── Mock setup ──────────────────────────────────────────────────────────────

/** @type {Map<string, Set<Function>>} */
let _listeners;

/**
 * @param {boolean} [darkMode]
 */
function setupMatchMedia(darkMode = false) {
  _listeners = new Map();
  globalThis.window.matchMedia = (query) => {
    const matches = (darkMode && query.includes('dark')) || (!darkMode && query.includes('light'));
    return {
      matches,
      addEventListener(type, fn) {
        if (!_listeners.has(query)) _listeners.set(query, new Set());
        _listeners.get(query).add(fn);
      },
      removeEventListener(type, fn) {
        _listeners.get(query)?.delete(fn);
      },
    };
  };
  return { listeners: _listeners };
}

let _origMatchMedia;

beforeEach(() => {
  _origMatchMedia = globalThis.window.matchMedia;
  setupMatchMedia(false);
});

afterEach(() => {
  globalThis.window.matchMedia = _origMatchMedia;
});

// ─── isColorSchemeSupportedByMedia ───────────────────────────────────────────

describe('isColorSchemeSupportedByMedia', () => {
  it('returns a boolean', () => {
    assert.equal(typeof isColorSchemeSupportedByMedia(), 'boolean');
  });

  it('returns true when matchMedia is present on window', () => {
    assert.equal(isColorSchemeSupportedByMedia(), true);
  });

  it('returns false when matchMedia is absent', () => {
    const orig = globalThis.window.matchMedia;
    delete globalThis.window.matchMedia;
    assert.equal(isColorSchemeSupportedByMedia(), false);
    globalThis.window.matchMedia = orig;
  });
});

// ─── getColorScheme ──────────────────────────────────────────────────────────

describe('getColorScheme', () => {
  it('returns dark when dark mode is active', () => {
    setupMatchMedia(true);
    assert.equal(getColorScheme(), 'dark');
  });

  it('returns light when light mode matches', () => {
    setupMatchMedia(false);
    assert.equal(getColorScheme(), 'light');
  });

  it('returns no-preference as fallback when neither dark nor light matches', () => {
    globalThis.window.matchMedia = () => ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
    });
    assert.equal(getColorScheme(), 'no-preference');
  });

  it('returns no-preference when matchMedia throws', () => {
    globalThis.window.matchMedia = () => { throw new Error('not supported'); };
    assert.equal(getColorScheme(), 'no-preference');
  });
});

// ─── prefersDark ─────────────────────────────────────────────────────────────

describe('prefersDark', () => {
  it('returns a boolean', () => {
    assert.equal(typeof prefersDark(), 'boolean');
  });

  it('returns true when dark mode is active', () => {
    setupMatchMedia(true);
    assert.equal(prefersDark(), true);
  });

  it('returns false when dark mode is not active', () => {
    setupMatchMedia(false);
    assert.equal(prefersDark(), false);
  });

  it('returns false when matchMedia throws', () => {
    globalThis.window.matchMedia = () => { throw new Error('unsupported'); };
    assert.equal(prefersDark(), false);
  });
});

// ─── prefersLight ─────────────────────────────────────────────────────────────

describe('prefersLight', () => {
  it('returns a boolean', () => {
    assert.equal(typeof prefersLight(), 'boolean');
  });

  it('returns true when light mode matches', () => {
    setupMatchMedia(false);
    assert.equal(prefersLight(), true);
  });

  it('returns false when dark mode is active', () => {
    setupMatchMedia(true);
    assert.equal(prefersLight(), false);
  });

  it('returns false when matchMedia throws', () => {
    globalThis.window.matchMedia = () => { throw new Error('unsupported'); };
    assert.equal(prefersLight(), false);
  });
});

// ─── prefersReducedMotion ─────────────────────────────────────────────────────

describe('prefersReducedMotion', () => {
  it('returns a boolean', () => {
    assert.equal(typeof prefersReducedMotion(), 'boolean');
  });

  it('returns true when reduced-motion media query matches', () => {
    globalThis.window.matchMedia = (query) => ({
      matches: query.includes('reduced-motion'),
      addEventListener() {},
      removeEventListener() {},
    });
    assert.equal(prefersReducedMotion(), true);
  });

  it('returns false by default', () => {
    setupMatchMedia(false);
    assert.equal(prefersReducedMotion(), false);
  });

  it('returns false when matchMedia throws', () => {
    globalThis.window.matchMedia = () => { throw new Error('unsupported'); };
    assert.equal(prefersReducedMotion(), false);
  });
});

// ─── prefersReducedTransparency ───────────────────────────────────────────────

describe('prefersReducedTransparency', () => {
  it('returns a boolean', () => {
    assert.equal(typeof prefersReducedTransparency(), 'boolean');
  });

  it('returns true when reduced-transparency media query matches', () => {
    globalThis.window.matchMedia = (query) => ({
      matches: query.includes('reduced-transparency'),
      addEventListener() {},
      removeEventListener() {},
    });
    assert.equal(prefersReducedTransparency(), true);
  });

  it('returns false by default', () => {
    setupMatchMedia(false);
    assert.equal(prefersReducedTransparency(), false);
  });

  it('returns false when matchMedia throws', () => {
    globalThis.window.matchMedia = () => { throw new Error('unsupported'); };
    assert.equal(prefersReducedTransparency(), false);
  });
});

// ─── prefersHighContrast ──────────────────────────────────────────────────────

describe('prefersHighContrast', () => {
  it('returns a boolean', () => {
    assert.equal(typeof prefersHighContrast(), 'boolean');
  });

  it('returns true when high-contrast media query matches', () => {
    globalThis.window.matchMedia = (query) => ({
      matches: query.includes('contrast'),
      addEventListener() {},
      removeEventListener() {},
    });
    assert.equal(prefersHighContrast(), true);
  });

  it('returns false by default', () => {
    setupMatchMedia(false);
    assert.equal(prefersHighContrast(), false);
  });

  it('returns false when matchMedia throws', () => {
    globalThis.window.matchMedia = () => { throw new Error('unsupported'); };
    assert.equal(prefersHighContrast(), false);
  });
});

// ─── onColorSchemeChange ──────────────────────────────────────────────────────

describe('onColorSchemeChange', () => {
  it('returns an unsubscribe function', () => {
    const unsub = onColorSchemeChange(() => {});
    assert.equal(typeof unsub, 'function');
    unsub();
  });

  it('registers a change listener on the dark media query', () => {
    const { listeners } = setupMatchMedia(false);
    onColorSchemeChange(() => {});
    const darkListeners = listeners.get('(prefers-color-scheme: dark)');
    assert.ok(darkListeners && darkListeners.size > 0, 'should have registered a listener on the dark media query');
  });

  it('unsubscribe removes the listener from the media query', () => {
    const { listeners } = setupMatchMedia(false);
    const unsub = onColorSchemeChange(() => {});
    const darkListeners = listeners.get('(prefers-color-scheme: dark)');
    assert.ok(darkListeners && darkListeners.size > 0, 'listener should exist before unsubscribe');
    unsub();
    assert.equal(darkListeners.size, 0, 'listener should be removed after unsubscribe');
  });

  it('calls callback with the current scheme when the media query fires', () => {
    const received = [];
    setupMatchMedia(true);
    onColorSchemeChange((scheme) => received.push(scheme));

    const darkListeners = _listeners.get('(prefers-color-scheme: dark)');
    assert.ok(darkListeners, 'should have a dark listener');
    for (const fn of darkListeners) fn();

    assert.equal(received.length, 1);
    assert.equal(received[0], 'dark');
  });

  it('does not throw when matchMedia throws', () => {
    globalThis.window.matchMedia = () => { throw new Error('unsupported'); };
    assert.doesNotThrow(() => {
      const unsub = onColorSchemeChange(() => {});
      unsub();
    });
  });
});
