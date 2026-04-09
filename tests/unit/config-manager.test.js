// ─── Unit Tests: ConfigManager ────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { ConfigManager } from '../../app/modules/config-manager.js';

// ─── constructor ──────────────────────────────────────────────────────────────

describe('ConfigManager – constructor', () => {
  it('creates an instance with no options', () => {
    assert.doesNotThrow(() => new ConfigManager());
  });

  it('creates an instance with defaults', () => {
    const cfg = new ConfigManager({ defaults: { host: 'localhost', port: 5432 } });
    assert.equal(cfg.get('host'), 'localhost');
    assert.equal(cfg.get('port'), 5432);
  });

  it('starts empty when no defaults are provided', () => {
    const cfg = new ConfigManager();
    assert.equal(cfg.get('anything'), undefined);
  });
});

// ─── set / get ────────────────────────────────────────────────────────────────

describe('ConfigManager – set/get (simple keys)', () => {
  it('set and get a simple string value', () => {
    const cfg = new ConfigManager();
    cfg.set('name', 'Alice');
    assert.equal(cfg.get('name'), 'Alice');
  });

  it('set and get a numeric value', () => {
    const cfg = new ConfigManager();
    cfg.set('count', 42);
    assert.equal(cfg.get('count'), 42);
  });

  it('set and get a boolean value', () => {
    const cfg = new ConfigManager();
    cfg.set('enabled', false);
    assert.equal(cfg.get('enabled'), false);
  });

  it('set and get an object value', () => {
    const cfg = new ConfigManager();
    cfg.set('meta', { version: 1 });
    assert.deepEqual(cfg.get('meta'), { version: 1 });
  });

  it('overwrites a previously set value', () => {
    const cfg = new ConfigManager();
    cfg.set('x', 1);
    cfg.set('x', 2);
    assert.equal(cfg.get('x'), 2);
  });

  it('returns undefined for a missing key', () => {
    const cfg = new ConfigManager();
    assert.equal(cfg.get('missing'), undefined);
  });
});

describe('ConfigManager – set/get (dot-notation)', () => {
  it('creates nested objects via dot-notation set', () => {
    const cfg = new ConfigManager();
    cfg.set('db.host', 'localhost');
    assert.equal(cfg.get('db.host'), 'localhost');
  });

  it('get on parent key returns the nested object', () => {
    const cfg = new ConfigManager();
    cfg.set('db.host', 'localhost');
    assert.deepEqual(cfg.get('db'), { host: 'localhost' });
  });

  it('supports three-level nesting', () => {
    const cfg = new ConfigManager();
    cfg.set('a.b.c', 'deep');
    assert.equal(cfg.get('a.b.c'), 'deep');
    assert.deepEqual(cfg.get('a.b'), { c: 'deep' });
    assert.deepEqual(cfg.get('a'), { b: { c: 'deep' } });
  });

  it('sets sibling keys independently', () => {
    const cfg = new ConfigManager();
    cfg.set('db.host', 'localhost');
    cfg.set('db.port', 5432);
    assert.equal(cfg.get('db.host'), 'localhost');
    assert.equal(cfg.get('db.port'), 5432);
  });

  it('overwrites an intermediate non-object with an object', () => {
    const cfg = new ConfigManager();
    cfg.set('a', 'string');
    cfg.set('a.b', 'nested');
    assert.equal(cfg.get('a.b'), 'nested');
  });
});

// ─── getOrDefault ─────────────────────────────────────────────────────────────

describe('ConfigManager – getOrDefault', () => {
  it('returns the stored value when key exists', () => {
    const cfg = new ConfigManager();
    cfg.set('theme', 'dark');
    assert.equal(cfg.getOrDefault('theme', 'light'), 'dark');
  });

  it('returns the fallback when key is absent', () => {
    const cfg = new ConfigManager();
    assert.equal(cfg.getOrDefault('theme', 'light'), 'light');
  });

  it('works with dot-notation', () => {
    const cfg = new ConfigManager();
    cfg.set('server.port', 8080);
    assert.equal(cfg.getOrDefault('server.port', 3000), 8080);
    assert.equal(cfg.getOrDefault('server.host', '0.0.0.0'), '0.0.0.0');
  });

  it('returns the fallback for a numeric default', () => {
    const cfg = new ConfigManager();
    assert.equal(cfg.getOrDefault('timeout', 5000), 5000);
  });
});

// ─── has ──────────────────────────────────────────────────────────────────────

describe('ConfigManager – has', () => {
  it('returns false for an absent key', () => {
    const cfg = new ConfigManager();
    assert.equal(cfg.has('missing'), false);
  });

  it('returns true for a set key', () => {
    const cfg = new ConfigManager();
    cfg.set('foo', 'bar');
    assert.equal(cfg.has('foo'), true);
  });

  it('returns true for a nested dot-notation key', () => {
    const cfg = new ConfigManager();
    cfg.set('db.host', 'localhost');
    assert.equal(cfg.has('db.host'), true);
  });

  it('returns true for a parent key that was implicitly created', () => {
    const cfg = new ConfigManager();
    cfg.set('db.host', 'localhost');
    assert.equal(cfg.has('db'), true);
  });

  it('returns false for a key that was deleted', () => {
    const cfg = new ConfigManager();
    cfg.set('x', 1);
    cfg.delete('x');
    assert.equal(cfg.has('x'), false);
  });
});

// ─── delete ───────────────────────────────────────────────────────────────────

describe('ConfigManager – delete', () => {
  it('deletes a simple key, returns true', () => {
    const cfg = new ConfigManager();
    cfg.set('a', 1);
    assert.equal(cfg.delete('a'), true);
    assert.equal(cfg.get('a'), undefined);
  });

  it('returns false when key does not exist', () => {
    const cfg = new ConfigManager();
    assert.equal(cfg.delete('ghost'), false);
  });

  it('deletes a dot-notation leaf, leaving parent intact', () => {
    const cfg = new ConfigManager();
    cfg.set('db.host', 'localhost');
    cfg.set('db.port', 5432);
    cfg.delete('db.host');
    assert.equal(cfg.get('db.host'), undefined);
    assert.equal(cfg.get('db.port'), 5432);
    assert.deepEqual(cfg.get('db'), { port: 5432 });
  });

  it('leaves parent object after deleting only child', () => {
    const cfg = new ConfigManager();
    cfg.set('db.host', 'localhost');
    cfg.delete('db.host');
    assert.deepEqual(cfg.get('db'), {});
  });

  it('returns false for a non-existent nested key', () => {
    const cfg = new ConfigManager();
    cfg.set('db', {});
    assert.equal(cfg.delete('db.host'), false);
  });
});

// ─── merge ────────────────────────────────────────────────────────────────────

describe('ConfigManager – merge', () => {
  it('merges a flat object at root level', () => {
    const cfg = new ConfigManager();
    cfg.merge({ a: 1, b: 2 });
    assert.equal(cfg.get('a'), 1);
    assert.equal(cfg.get('b'), 2);
  });

  it('overwrites existing keys (shallow, Object.assign style)', () => {
    const cfg = new ConfigManager();
    cfg.set('a', 'old');
    cfg.merge({ a: 'new', c: 3 });
    assert.equal(cfg.get('a'), 'new');
    assert.equal(cfg.get('c'), 3);
  });

  it('does not affect keys not present in the merged object', () => {
    const cfg = new ConfigManager();
    cfg.set('x', 100);
    cfg.merge({ y: 200 });
    assert.equal(cfg.get('x'), 100);
    assert.equal(cfg.get('y'), 200);
  });

  it('merging a nested object replaces the whole subtree', () => {
    const cfg = new ConfigManager();
    cfg.set('db', { host: 'localhost', port: 5432 });
    cfg.merge({ db: { host: 'remotehost' } });
    assert.deepEqual(cfg.get('db'), { host: 'remotehost' });
  });
});

// ─── toObject ─────────────────────────────────────────────────────────────────

describe('ConfigManager – toObject', () => {
  it('returns a plain object with all current values', () => {
    const cfg = new ConfigManager();
    cfg.set('a', 1);
    cfg.set('b', 'hello');
    const obj = cfg.toObject();
    assert.equal(obj['a'], 1);
    assert.equal(obj['b'], 'hello');
  });

  it('returns empty object when no keys are set', () => {
    const cfg = new ConfigManager();
    assert.deepEqual(cfg.toObject(), {});
  });

  it('mutations to the returned object do not affect the config', () => {
    const cfg = new ConfigManager();
    cfg.set('x', 10);
    const obj = cfg.toObject();
    obj['x'] = 999;
    assert.equal(cfg.get('x'), 10);
  });

  it('includes nested structures', () => {
    const cfg = new ConfigManager();
    cfg.set('db.host', 'localhost');
    cfg.set('db.port', 5432);
    const obj = cfg.toObject();
    assert.deepEqual(obj['db'], { host: 'localhost', port: 5432 });
  });
});

// ─── reset ────────────────────────────────────────────────────────────────────

describe('ConfigManager – reset', () => {
  it('resets to empty when no defaults were given', () => {
    const cfg = new ConfigManager();
    cfg.set('a', 1);
    cfg.reset();
    assert.deepEqual(cfg.toObject(), {});
  });

  it('restores defaults after changes', () => {
    const cfg = new ConfigManager({ defaults: { theme: 'dark', fontSize: 14 } });
    cfg.set('theme', 'light');
    cfg.set('fontSize', 20);
    cfg.reset();
    assert.equal(cfg.get('theme'), 'dark');
    assert.equal(cfg.get('fontSize'), 14);
  });

  it('restores nested defaults accessible via dot-notation', () => {
    const cfg = new ConfigManager({ defaults: { db: { host: 'localhost' } } });
    cfg.set('db.host', 'remotehost');
    cfg.reset();
    assert.equal(cfg.get('db.host'), 'localhost');
  });

  it('removes keys that were added after construction', () => {
    const cfg = new ConfigManager({ defaults: { a: 1 } });
    cfg.set('b', 2);
    cfg.reset();
    assert.equal(cfg.has('b'), false);
    assert.equal(cfg.get('a'), 1);
  });
});

// ─── onChange ─────────────────────────────────────────────────────────────────

describe('ConfigManager – onChange subscription', () => {
  it('fires callback when key is set', () => {
    const cfg = new ConfigManager();
    const received = [];
    cfg.onChange('theme', (v) => received.push(v));
    cfg.set('theme', 'light');
    assert.deepEqual(received, ['light']);
  });

  it('fires callback on each subsequent set', () => {
    const cfg = new ConfigManager();
    const received = [];
    cfg.onChange('count', (v) => received.push(v));
    cfg.set('count', 1);
    cfg.set('count', 2);
    cfg.set('count', 3);
    assert.deepEqual(received, [1, 2, 3]);
  });

  it('fires callback with undefined when key is deleted', () => {
    const cfg = new ConfigManager();
    const received = [];
    cfg.set('x', 42);
    cfg.onChange('x', (v) => received.push(v));
    cfg.delete('x');
    assert.deepEqual(received, [undefined]);
  });

  it('fires callback during merge for matching keys', () => {
    const cfg = new ConfigManager();
    const received = [];
    cfg.onChange('a', (v) => received.push(v));
    cfg.merge({ a: 'hello', b: 'world' });
    assert.deepEqual(received, ['hello']);
  });

  it('supports multiple subscribers on the same key', () => {
    const cfg = new ConfigManager();
    const a = [];
    const b = [];
    cfg.onChange('x', (v) => a.push(v));
    cfg.onChange('x', (v) => b.push(v));
    cfg.set('x', 99);
    assert.deepEqual(a, [99]);
    assert.deepEqual(b, [99]);
  });
});

describe('ConfigManager – onChange unsubscribe', () => {
  it('unsubscribe stops future callbacks', () => {
    const cfg = new ConfigManager();
    const received = [];
    const unsub = cfg.onChange('x', (v) => received.push(v));
    cfg.set('x', 1);
    unsub();
    cfg.set('x', 2);
    assert.deepEqual(received, [1]);
  });

  it('unsubscribing is idempotent (safe to call twice)', () => {
    const cfg = new ConfigManager();
    const received = [];
    const unsub = cfg.onChange('x', (v) => received.push(v));
    unsub();
    assert.doesNotThrow(() => unsub());
    cfg.set('x', 1);
    assert.deepEqual(received, []);
  });

  it('other subscribers are unaffected when one unsubscribes', () => {
    const cfg = new ConfigManager();
    const a = [];
    const b = [];
    const unsubA = cfg.onChange('y', (v) => a.push(v));
    cfg.onChange('y', (v) => b.push(v));
    cfg.set('y', 'first');
    unsubA();
    cfg.set('y', 'second');
    assert.deepEqual(a, ['first']);
    assert.deepEqual(b, ['first', 'second']);
  });
});

// ─── strict mode ──────────────────────────────────────────────────────────────

describe('ConfigManager – strict mode', () => {
  it('throws when accessing an undefined key', () => {
    const cfg = new ConfigManager({ strict: true });
    assert.throws(() => cfg.get('missing'), /key "missing" is not defined/);
  });

  it('does not throw for a key that exists', () => {
    const cfg = new ConfigManager({ strict: true });
    cfg.set('present', 42);
    assert.doesNotThrow(() => cfg.get('present'));
    assert.equal(cfg.get('present'), 42);
  });

  it('does not throw in non-strict mode (default)', () => {
    const cfg = new ConfigManager();
    assert.doesNotThrow(() => cfg.get('missing'));
    assert.equal(cfg.get('missing'), undefined);
  });
});
