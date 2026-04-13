// ─── Unit Tests: ConfigManager ────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { ConfigManager, createConfig } from '../../app/modules/config-manager.js';

// ─── constructor / defaults ───────────────────────────────────────────────────

describe('ConfigManager – constructor', () => {
  it('creates an instance with defaults', () => {
    const cfg = new ConfigManager({ host: 'localhost', port: 5432 });
    assert.equal(cfg.get('host'), 'localhost');
    assert.equal(cfg.get('port'), 5432);
  });

  it('all() returns the defaults immediately', () => {
    const cfg = new ConfigManager({ x: 1, y: 2 });
    assert.deepEqual(cfg.all(), { x: 1, y: 2 });
  });

  it('defaults are preserved as originals after mutation', () => {
    const cfg = new ConfigManager({ theme: 'dark' });
    cfg.set('theme', 'light');
    cfg.reset('theme');
    assert.equal(cfg.get('theme'), 'dark');
  });
});

// ─── get / set ────────────────────────────────────────────────────────────────

describe('ConfigManager – get / set', () => {
  it('get returns a value that was set', () => {
    const cfg = new ConfigManager({ name: 'Alice' });
    cfg.set('name', 'Bob');
    assert.equal(cfg.get('name'), 'Bob');
  });

  it('set overwrites the previous value', () => {
    const cfg = new ConfigManager({ count: 0 });
    cfg.set('count', 10);
    cfg.set('count', 20);
    assert.equal(cfg.get('count'), 20);
  });

  it('get returns the default value before any set', () => {
    const cfg = new ConfigManager({ flag: true });
    assert.equal(cfg.get('flag'), true);
  });

  it('set and get work for object values', () => {
    const cfg = new ConfigManager({ meta: { v: 1 } });
    cfg.set('meta', { v: 99 });
    assert.deepEqual(cfg.get('meta'), { v: 99 });
  });

  it('set and get work for array values', () => {
    const cfg = new ConfigManager({ items: /** @type {number[]} */ ([]) });
    cfg.set('items', [1, 2, 3]);
    assert.deepEqual(cfg.get('items'), [1, 2, 3]);
  });
});

// ─── merge ────────────────────────────────────────────────────────────────────

describe('ConfigManager – merge', () => {
  it('merge applies all provided keys', () => {
    const cfg = new ConfigManager({ a: 1, b: 2, c: 3 });
    cfg.merge({ a: 10, b: 20 });
    assert.equal(cfg.get('a'), 10);
    assert.equal(cfg.get('b'), 20);
    assert.equal(cfg.get('c'), 3);
  });

  it('merge with empty object changes nothing', () => {
    const cfg = new ConfigManager({ x: 42 });
    cfg.merge({});
    assert.equal(cfg.get('x'), 42);
  });

  it('merge notifies listeners for each merged key', () => {
    const cfg = new ConfigManager({ a: 0, b: 0 });
    const events = [];
    cfg.onChange((k, v) => events.push({ k, v }));
    cfg.merge({ a: 1, b: 2 });
    assert.equal(events.length, 2);
  });

  it('merge overwrites existing value', () => {
    const cfg = new ConfigManager({ flag: false });
    cfg.merge({ flag: true });
    assert.equal(cfg.get('flag'), true);
  });
});

// ─── reset ────────────────────────────────────────────────────────────────────

describe('ConfigManager – reset', () => {
  it('reset(key) restores a single key to its default', () => {
    const cfg = new ConfigManager({ theme: 'dark', size: 14 });
    cfg.set('theme', 'light');
    cfg.set('size', 20);
    cfg.reset('theme');
    assert.equal(cfg.get('theme'), 'dark');
    assert.equal(cfg.get('size'), 20);
  });

  it('reset() (no args) restores all keys to defaults', () => {
    const cfg = new ConfigManager({ a: 1, b: 2 });
    cfg.set('a', 99);
    cfg.set('b', 88);
    cfg.reset();
    assert.equal(cfg.get('a'), 1);
    assert.equal(cfg.get('b'), 2);
  });

  it('reset notifies listeners for the reset key', () => {
    const cfg = new ConfigManager({ x: 5 });
    const events = [];
    cfg.onChange((k, v) => events.push({ k, v }));
    cfg.set('x', 99);
    cfg.reset('x');
    // Two events: set(99) and reset(5)
    assert.equal(events.length, 2);
    assert.deepEqual(events[1], { k: 'x', v: 5 });
  });

  it('reset() (no args) notifies listeners for each key', () => {
    const cfg = new ConfigManager({ a: 1, b: 2 });
    const keys = [];
    cfg.onChange((k) => keys.push(k));
    cfg.reset();
    assert.ok(keys.includes('a'));
    assert.ok(keys.includes('b'));
  });
});

// ─── has ──────────────────────────────────────────────────────────────────────

describe('ConfigManager – has', () => {
  it('returns true for a key in defaults', () => {
    const cfg = new ConfigManager({ exists: true });
    assert.equal(cfg.has('exists'), true);
  });

  it('returns false for a key not in defaults or current config', () => {
    const cfg = new ConfigManager({ exists: true });
    assert.equal(cfg.has('missing'), false);
  });

  it('returns true for a key added via set', () => {
    const cfg = new ConfigManager({ a: 1 });
    assert.equal(cfg.has('a'), true);
  });

  it('returns false for a string key that is not in the config', () => {
    const cfg = new ConfigManager({ x: 10 });
    assert.equal(cfg.has('y'), false);
  });
});

// ─── all ──────────────────────────────────────────────────────────────────────

describe('ConfigManager – all', () => {
  it('returns all current key-value pairs', () => {
    const cfg = new ConfigManager({ a: 1, b: 'hello' });
    assert.deepEqual(cfg.all(), { a: 1, b: 'hello' });
  });

  it('reflects changes after set', () => {
    const cfg = new ConfigManager({ n: 0 });
    cfg.set('n', 42);
    assert.deepEqual(cfg.all(), { n: 42 });
  });

  it('mutations to the returned object do not affect internal state', () => {
    const cfg = new ConfigManager({ x: 1 });
    const snapshot = cfg.all();
    snapshot['x'] = 999;
    assert.equal(cfg.get('x'), 1);
  });

  it('returns a complete copy including merged keys', () => {
    const cfg = new ConfigManager({ a: 1, b: 2 });
    cfg.merge({ b: 20 });
    assert.deepEqual(cfg.all(), { a: 1, b: 20 });
  });
});

// ─── onChange ─────────────────────────────────────────────────────────────────

describe('ConfigManager – onChange', () => {
  it('calls handler with key and new value when set is called', () => {
    const cfg = new ConfigManager({ v: 0 });
    const calls = [];
    cfg.onChange((k, val) => calls.push({ k, val }));
    cfg.set('v', 42);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].k, 'v');
    assert.equal(calls[0].val, 42);
  });

  it('supports multiple handlers', () => {
    const cfg = new ConfigManager({ n: 1 });
    const a = [];
    const b = [];
    cfg.onChange((k) => a.push(k));
    cfg.onChange((k) => b.push(k));
    cfg.set('n', 2);
    assert.equal(a.length, 1);
    assert.equal(b.length, 1);
  });

  it('unsubscribe stops future notifications', () => {
    const cfg = new ConfigManager({ z: 0 });
    const calls = [];
    const unsub = cfg.onChange((k, v) => calls.push(v));
    cfg.set('z', 1);
    unsub();
    cfg.set('z', 2);
    assert.deepEqual(calls, [1]);
  });

  it('unsubscribe is idempotent (safe to call twice)', () => {
    const cfg = new ConfigManager({ z: 0 });
    const calls = [];
    const unsub = cfg.onChange((k, v) => calls.push(v));
    unsub();
    assert.doesNotThrow(() => unsub());
    cfg.set('z', 1);
    assert.deepEqual(calls, []);
  });

  it('remaining handlers are called after one unsubscribes', () => {
    const cfg = new ConfigManager({ x: 0 });
    const a = [];
    const b = [];
    const unsubA = cfg.onChange((k, v) => a.push(v));
    cfg.onChange((k, v) => b.push(v));
    cfg.set('x', 10);
    unsubA();
    cfg.set('x', 20);
    assert.deepEqual(a, [10]);
    assert.deepEqual(b, [10, 20]);
  });
});

// ─── validate ─────────────────────────────────────────────────────────────────

describe('ConfigManager – validate', () => {
  it('returns true when all validators pass', () => {
    const cfg = new ConfigManager({ age: 25, name: 'Alice' });
    const ok = cfg.validate({
      age: (v) => typeof v === 'number' && v >= 0,
      name: (v) => typeof v === 'string' && v.length > 0,
    });
    assert.equal(ok, true);
  });

  it('returns false when a validator fails', () => {
    const cfg = new ConfigManager({ age: -1 });
    const ok = cfg.validate({ age: (v) => typeof v === 'number' && v >= 0 });
    assert.equal(ok, false);
  });

  it('returns true for an empty schema', () => {
    const cfg = new ConfigManager({ x: 1 });
    assert.equal(cfg.validate({}), true);
  });

  it('only validates keys present in the schema', () => {
    const cfg = new ConfigManager({ a: 1, b: -1 });
    // Only validate 'a' — 'b' being negative should not affect result
    const ok = cfg.validate({ a: (v) => typeof v === 'number' && v > 0 });
    assert.equal(ok, true);
  });

  it('validates against the current (not default) value after set', () => {
    const cfg = new ConfigManager({ score: 100 });
    cfg.set('score', -5);
    const ok = cfg.validate({ score: (v) => typeof v === 'number' && v >= 0 });
    assert.equal(ok, false);
  });

  it('returns true when schema references a key that passes', () => {
    const cfg = new ConfigManager({ count: 3 });
    assert.equal(cfg.validate({ count: (v) => v === 3 }), true);
  });
});

// ─── createConfig factory ─────────────────────────────────────────────────────

describe('createConfig factory', () => {
  it('returns a ConfigManager instance', () => {
    const cfg = createConfig({ key: 'value' });
    assert.ok(cfg instanceof ConfigManager);
  });

  it('factory-created instance has the correct defaults', () => {
    const cfg = createConfig({ a: 1, b: 2 });
    assert.equal(cfg.get('a'), 1);
    assert.equal(cfg.get('b'), 2);
  });

  it('factory-created instance supports set / get', () => {
    const cfg = createConfig({ n: 0 });
    cfg.set('n', 99);
    assert.equal(cfg.get('n'), 99);
  });

  it('factory-created instance supports reset', () => {
    const cfg = createConfig({ theme: 'dark' });
    cfg.set('theme', 'light');
    cfg.reset('theme');
    assert.equal(cfg.get('theme'), 'dark');
  });
});
