// ─── Unit Tests: ConfigManager ───────────────────────────────────────────────
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Provide a localStorage stub before importing the module
const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
  clear: () => storage.clear(),
};

import { ConfigManager, createConfig } from '../../app/modules/config-manager.js';

const DEFAULTS = { theme: 'dark', fontSize: 14, autoSave: true };

// ─── new ConfigManager() ─────────────────────────────────────────────────────

describe('new ConfigManager()', () => {
  it('creates an instance with defaults accessible via get()', () => {
    const cfg = new ConfigManager(DEFAULTS);
    assert.equal(cfg.get('theme'), 'dark');
    assert.equal(cfg.get('fontSize'), 14);
    assert.equal(cfg.get('autoSave'), true);
  });

  it('does not require storageKey', () => {
    assert.doesNotThrow(() => new ConfigManager(DEFAULTS));
  });

  it('loads persisted values from localStorage when storageKey is given', () => {
    storage.set('cfg_test', JSON.stringify({ theme: 'light' }));
    const cfg = new ConfigManager(DEFAULTS, 'cfg_test');
    assert.equal(cfg.get('theme'), 'light');
    // non-persisted key still uses default
    assert.equal(cfg.get('fontSize'), 14);
    storage.clear();
  });

  it('falls back to defaults when stored JSON is corrupt', () => {
    storage.set('cfg_corrupt', 'not-json');
    const cfg = new ConfigManager(DEFAULTS, 'cfg_corrupt');
    assert.equal(cfg.get('theme'), 'dark');
    storage.clear();
  });
});

// ─── get() ───────────────────────────────────────────────────────────────────

describe('get()', () => {
  it('returns default values when no changes have been made', () => {
    const cfg = new ConfigManager(DEFAULTS);
    assert.equal(cfg.get('theme'), 'dark');
    assert.equal(cfg.get('fontSize'), 14);
  });

  it('returns updated value after set()', () => {
    const cfg = new ConfigManager(DEFAULTS);
    cfg.set('theme', 'light');
    assert.equal(cfg.get('theme'), 'light');
  });
});

// ─── set() ───────────────────────────────────────────────────────────────────

describe('set()', () => {
  it('changes the value, observable via get()', () => {
    const cfg = new ConfigManager(DEFAULTS);
    cfg.set('fontSize', 18);
    assert.equal(cfg.get('fontSize'), 18);
  });

  it('persists to localStorage when storageKey is given', () => {
    beforeEach(() => storage.clear());
    const cfg = new ConfigManager(DEFAULTS, 'cfg_persist');
    cfg.set('theme', 'sepia');
    const stored = JSON.parse(storage.get('cfg_persist'));
    assert.equal(stored.theme, 'sepia');
    storage.clear();
  });

  it('does not write to localStorage when no storageKey', () => {
    const sizeBefore = storage.size;
    const cfg = new ConfigManager(DEFAULTS);
    cfg.set('theme', 'solarized');
    assert.equal(storage.size, sizeBefore);
  });
});

// ─── setMany() ───────────────────────────────────────────────────────────────

describe('setMany()', () => {
  it('sets multiple values at once', () => {
    const cfg = new ConfigManager(DEFAULTS);
    cfg.setMany({ theme: 'light', fontSize: 20 });
    assert.equal(cfg.get('theme'), 'light');
    assert.equal(cfg.get('fontSize'), 20);
    // untouched key stays at default
    assert.equal(cfg.get('autoSave'), true);
  });

  it('persists all values to localStorage', () => {
    const cfg = new ConfigManager(DEFAULTS, 'cfg_setmany');
    cfg.setMany({ theme: 'solarized', autoSave: false });
    const stored = JSON.parse(storage.get('cfg_setmany'));
    assert.equal(stored.theme, 'solarized');
    assert.equal(stored.autoSave, false);
    storage.clear();
  });
});

// ─── reset() ─────────────────────────────────────────────────────────────────

describe('reset()', () => {
  it('restores a key to its default value', () => {
    const cfg = new ConfigManager(DEFAULTS);
    cfg.set('theme', 'light');
    cfg.reset('theme');
    assert.equal(cfg.get('theme'), 'dark');
  });

  it('does not affect other keys', () => {
    const cfg = new ConfigManager(DEFAULTS);
    cfg.set('theme', 'light');
    cfg.set('fontSize', 22);
    cfg.reset('theme');
    assert.equal(cfg.get('fontSize'), 22);
  });
});

// ─── resetAll() ──────────────────────────────────────────────────────────────

describe('resetAll()', () => {
  it('restores all keys to defaults', () => {
    const cfg = new ConfigManager(DEFAULTS);
    cfg.set('theme', 'light');
    cfg.set('fontSize', 22);
    cfg.set('autoSave', false);
    cfg.resetAll();
    assert.equal(cfg.get('theme'), 'dark');
    assert.equal(cfg.get('fontSize'), 14);
    assert.equal(cfg.get('autoSave'), true);
  });

  it('persists the reset state to localStorage', () => {
    const cfg = new ConfigManager(DEFAULTS, 'cfg_resetall');
    cfg.set('theme', 'light');
    cfg.resetAll();
    const stored = JSON.parse(storage.get('cfg_resetall'));
    assert.equal(stored.theme, 'dark');
    storage.clear();
  });
});

// ─── onChange() ──────────────────────────────────────────────────────────────

describe('onChange()', () => {
  it('callback is called when value changes', () => {
    const cfg = new ConfigManager(DEFAULTS);
    const received = [];
    cfg.onChange('theme', (v) => received.push(v));
    cfg.set('theme', 'light');
    assert.deepEqual(received, ['light']);
  });

  it('callback is called for each set()', () => {
    const cfg = new ConfigManager(DEFAULTS);
    const received = [];
    cfg.onChange('fontSize', (v) => received.push(v));
    cfg.set('fontSize', 16);
    cfg.set('fontSize', 20);
    assert.deepEqual(received, [16, 20]);
  });

  it('callback is called when key is changed via setMany()', () => {
    const cfg = new ConfigManager(DEFAULTS);
    const received = [];
    cfg.onChange('theme', (v) => received.push(v));
    cfg.setMany({ theme: 'solarized', fontSize: 16 });
    assert.deepEqual(received, ['solarized']);
  });

  it('callback is called on reset() with the default value', () => {
    const cfg = new ConfigManager(DEFAULTS);
    const received = [];
    cfg.set('theme', 'light');
    cfg.onChange('theme', (v) => received.push(v));
    cfg.reset('theme');
    assert.deepEqual(received, ['dark']);
  });

  it('callback is called on resetAll() for each key', () => {
    const cfg = new ConfigManager(DEFAULTS);
    const themes = [];
    const sizes = [];
    cfg.set('theme', 'light');
    cfg.set('fontSize', 22);
    cfg.onChange('theme', (v) => themes.push(v));
    cfg.onChange('fontSize', (v) => sizes.push(v));
    cfg.resetAll();
    assert.deepEqual(themes, ['dark']);
    assert.deepEqual(sizes, [14]);
  });

  it('returns an unsubscribe function', () => {
    const cfg = new ConfigManager(DEFAULTS);
    const received = [];
    const unsub = cfg.onChange('theme', (v) => received.push(v));
    cfg.set('theme', 'light');
    unsub();
    cfg.set('theme', 'dark');
    // Only the first change should have been recorded
    assert.deepEqual(received, ['light']);
  });
});

// ─── onChange() unsubscribe ───────────────────────────────────────────────────

describe('onChange() unsubscribe', () => {
  it('stops receiving changes after unsubscribe', () => {
    const cfg = new ConfigManager(DEFAULTS);
    const received = [];
    const unsub = cfg.onChange('autoSave', (v) => received.push(v));
    cfg.set('autoSave', false);
    unsub();
    cfg.set('autoSave', true);
    assert.deepEqual(received, [false]);
  });

  it('other subscribers are unaffected by one unsubscribing', () => {
    const cfg = new ConfigManager(DEFAULTS);
    const a = [];
    const b = [];
    const unsubA = cfg.onChange('theme', (v) => a.push(v));
    cfg.onChange('theme', (v) => b.push(v));
    cfg.set('theme', 'light');
    unsubA();
    cfg.set('theme', 'dark');
    assert.deepEqual(a, ['light']);
    assert.deepEqual(b, ['light', 'dark']);
  });
});

// ─── getAll() ─────────────────────────────────────────────────────────────────

describe('getAll()', () => {
  it('returns all current values', () => {
    const cfg = new ConfigManager(DEFAULTS);
    cfg.set('theme', 'light');
    const all = cfg.getAll();
    assert.equal(all.theme, 'light');
    assert.equal(all.fontSize, 14);
    assert.equal(all.autoSave, true);
  });

  it('returns a shallow copy — mutations do not affect the config', () => {
    const cfg = new ConfigManager(DEFAULTS);
    const all = cfg.getAll();
    all.theme = 'mutated';
    assert.equal(cfg.get('theme'), 'dark');
  });
});

// ─── isModified() ─────────────────────────────────────────────────────────────

describe('isModified()', () => {
  it('returns false for an unmodified key', () => {
    const cfg = new ConfigManager(DEFAULTS);
    assert.equal(cfg.isModified('theme'), false);
  });

  it('returns true after set()', () => {
    const cfg = new ConfigManager(DEFAULTS);
    cfg.set('theme', 'light');
    assert.equal(cfg.isModified('theme'), true);
  });

  it('returns false after reset() restores to default', () => {
    const cfg = new ConfigManager(DEFAULTS);
    cfg.set('theme', 'light');
    cfg.reset('theme');
    assert.equal(cfg.isModified('theme'), false);
  });

  it('returns false for all keys after resetAll()', () => {
    const cfg = new ConfigManager(DEFAULTS);
    cfg.set('theme', 'light');
    cfg.set('fontSize', 22);
    cfg.resetAll();
    assert.equal(cfg.isModified('theme'), false);
    assert.equal(cfg.isModified('fontSize'), false);
  });
});

// ─── createConfig() ───────────────────────────────────────────────────────────

describe('createConfig()', () => {
  it('factory function returns a ConfigManager instance', () => {
    const cfg = createConfig({ color: 'red', count: 0 });
    assert.ok(cfg instanceof ConfigManager);
    assert.equal(cfg.get('color'), 'red');
    assert.equal(cfg.get('count'), 0);
  });

  it('factory function accepts an optional storageKey', () => {
    const cfg = createConfig({ x: 1 }, 'cfg_factory');
    cfg.set('x', 99);
    assert.ok(storage.has('cfg_factory'));
    storage.clear();
  });
});
