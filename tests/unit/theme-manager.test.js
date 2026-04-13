// ─── Unit Tests: Theme Manager ────────────────────────────────────────────────
import './setup-dom.js';
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  applyTheme,
  getCSSVariable,
  setCSSVariable,
  removeCSSVariable,
  createTheme,
  saveTheme,
  loadTheme,
} from '../../app/modules/theme-manager.js';

// ─── DOM Mock Setup ───────────────────────────────────────────────────────────

let cssVars;

beforeEach(() => {
  cssVars = new Map();
  globalThis.document.documentElement.style = {
    setProperty(name, value) { cssVars.set(name, value); },
    removeProperty(name) { cssVars.delete(name); },
  };
  globalThis.getComputedStyle = (el) => ({
    getPropertyValue(name) { return cssVars.get(name) ?? ''; },
  });
  // Clear localStorage between tests
  globalThis.localStorage.clear();
});

// ─── applyTheme ──────────────────────────────────────────────────────────────

describe('applyTheme', () => {
  it('sets all CSS variables from a theme', () => {
    applyTheme({ '--color-primary': '#336699', '--color-bg': '#ffffff' });
    assert.equal(cssVars.get('--color-primary'), '#336699');
    assert.equal(cssVars.get('--color-bg'), '#ffffff');
  });

  it('sets a single-variable theme', () => {
    applyTheme({ '--font-size': '16px' });
    assert.equal(cssVars.get('--font-size'), '16px');
  });

  it('does nothing for an empty theme', () => {
    applyTheme({});
    assert.equal(cssVars.size, 0);
  });

  it('overwrites an existing variable', () => {
    applyTheme({ '--color-primary': '#ff0000' });
    applyTheme({ '--color-primary': '#0000ff' });
    assert.equal(cssVars.get('--color-primary'), '#0000ff');
  });

  it('applies to a custom element when provided', () => {
    const elementVars = new Map();
    const customEl = {
      style: {
        setProperty(name, value) { elementVars.set(name, value); },
        removeProperty(name) { elementVars.delete(name); },
      },
    };
    applyTheme({ '--accent': 'red' }, /** @type {any} */ (customEl));
    assert.equal(elementVars.get('--accent'), 'red');
    // Confirm root element was NOT touched
    assert.equal(cssVars.has('--accent'), false);
  });
});

// ─── getCSSVariable ──────────────────────────────────────────────────────────

describe('getCSSVariable', () => {
  it('returns the value set by applyTheme', () => {
    applyTheme({ '--spacing': '8px' });
    assert.equal(getCSSVariable('--spacing'), '8px');
  });

  it('returns an empty string for an unset variable', () => {
    assert.equal(getCSSVariable('--does-not-exist'), '');
  });

  it('reads from a custom element when provided', () => {
    const elementVars = new Map();
    const customEl = {
      style: {
        setProperty(name, value) { elementVars.set(name, value); },
        removeProperty(name) { elementVars.delete(name); },
      },
    };
    globalThis.getComputedStyle = (el) => ({
      getPropertyValue(name) {
        return el === customEl ? (elementVars.get(name) ?? '') : (cssVars.get(name) ?? '');
      },
    });
    elementVars.set('--custom', 'yes');
    assert.equal(getCSSVariable('--custom', /** @type {any} */ (customEl)), 'yes');
  });
});

// ─── setCSSVariable ──────────────────────────────────────────────────────────

describe('setCSSVariable', () => {
  it('sets a single CSS variable', () => {
    setCSSVariable('--border-radius', '4px');
    assert.equal(cssVars.get('--border-radius'), '4px');
  });

  it('overwrites an existing variable', () => {
    setCSSVariable('--border-radius', '4px');
    setCSSVariable('--border-radius', '8px');
    assert.equal(cssVars.get('--border-radius'), '8px');
  });

  it('applies to a custom element when provided', () => {
    const elementVars = new Map();
    const customEl = {
      style: {
        setProperty(name, value) { elementVars.set(name, value); },
        removeProperty(name) { elementVars.delete(name); },
      },
    };
    setCSSVariable('--x', '1', /** @type {any} */ (customEl));
    assert.equal(elementVars.get('--x'), '1');
    assert.equal(cssVars.has('--x'), false);
  });
});

// ─── removeCSSVariable ───────────────────────────────────────────────────────

describe('removeCSSVariable', () => {
  it('removes a CSS variable', () => {
    setCSSVariable('--to-remove', 'yes');
    assert.ok(cssVars.has('--to-remove'));
    removeCSSVariable('--to-remove');
    assert.equal(cssVars.has('--to-remove'), false);
  });

  it('does not throw when removing a non-existent variable', () => {
    assert.doesNotThrow(() => removeCSSVariable('--ghost'));
  });

  it('removes from a custom element when provided', () => {
    const elementVars = new Map([['--y', 'val']]);
    const customEl = {
      style: {
        setProperty(name, value) { elementVars.set(name, value); },
        removeProperty(name) { elementVars.delete(name); },
      },
    };
    removeCSSVariable('--y', /** @type {any} */ (customEl));
    assert.equal(elementVars.has('--y'), false);
  });
});

// ─── createTheme ─────────────────────────────────────────────────────────────

describe('createTheme', () => {
  it('merges base and overrides', () => {
    const base = { '--color-primary': 'blue', '--color-bg': 'white' };
    const overrides = { '--color-primary': 'red' };
    const theme = createTheme(base, overrides);
    assert.equal(theme['--color-primary'], 'red');
    assert.equal(theme['--color-bg'], 'white');
  });

  it('adds new keys from overrides', () => {
    const base = { '--a': '1' };
    const overrides = { '--b': '2' };
    const theme = createTheme(base, overrides);
    assert.equal(theme['--a'], '1');
    assert.equal(theme['--b'], '2');
  });

  it('does not mutate the base theme', () => {
    const base = { '--color': 'blue' };
    createTheme(base, { '--color': 'red' });
    assert.equal(base['--color'], 'blue');
  });

  it('returns a complete copy when overrides is empty', () => {
    const base = { '--a': '1', '--b': '2' };
    const theme = createTheme(base, {});
    assert.deepEqual(theme, base);
    assert.notEqual(theme, base); // different object
  });
});

// ─── saveTheme + loadTheme ────────────────────────────────────────────────────

describe('saveTheme + loadTheme', () => {
  it('round-trips a theme through localStorage', () => {
    const theme = { '--color-primary': '#336699', '--font-size': '16px' };
    saveTheme('my-theme', theme);
    const loaded = loadTheme('my-theme');
    assert.deepEqual(loaded, theme);
  });

  it('loadTheme returns null when key is not found', () => {
    assert.equal(loadTheme('nonexistent-key'), null);
  });

  it('loadTheme returns null for corrupt JSON', () => {
    globalThis.localStorage.setItem('bad-theme', 'not-valid-json{{{');
    assert.equal(loadTheme('bad-theme'), null);
  });

  it('overwrites a previously saved theme', () => {
    const first = { '--color': 'blue' };
    const second = { '--color': 'red' };
    saveTheme('theme-key', first);
    saveTheme('theme-key', second);
    assert.deepEqual(loadTheme('theme-key'), second);
  });

  it('saves and loads an empty theme', () => {
    saveTheme('empty', {});
    assert.deepEqual(loadTheme('empty'), {});
  });
});
