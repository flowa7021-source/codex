// ─── Unit Tests: FeatureFlags ─────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { FeatureFlags } from '../../app/modules/feature-flags.js';

// ─── constructor / defaults ───────────────────────────────────────────────────

describe('FeatureFlags – constructor', () => {
  it('creates an empty registry when no options provided', () => {
    const ff = new FeatureFlags();
    assert.deepEqual(ff.getAll(), []);
  });

  it('populates defaults from options', () => {
    const ff = new FeatureFlags({ defaults: { dark: true, beta: false } });
    assert.equal(ff.get('dark'), true);
    assert.equal(ff.get('beta'), false);
  });

  it('defaults are enabled by default', () => {
    const ff = new FeatureFlags({ defaults: { feature: true } });
    assert.equal(ff.isEnabled('feature'), true);
  });
});

// ─── set / get ────────────────────────────────────────────────────────────────

describe('FeatureFlags – set / get', () => {
  it('set stores a flag retrievable by get', () => {
    const ff = new FeatureFlags();
    ff.set('x', 42);
    assert.equal(ff.get('x'), 42);
  });

  it('set with boolean value', () => {
    const ff = new FeatureFlags();
    ff.set('flag', true);
    assert.equal(ff.get('flag'), true);
  });

  it('set with string value', () => {
    const ff = new FeatureFlags();
    ff.set('theme', 'dark');
    assert.equal(ff.get('theme'), 'dark');
  });

  it('set overwrites an existing flag', () => {
    const ff = new FeatureFlags();
    ff.set('k', 1);
    ff.set('k', 2);
    assert.equal(ff.get('k'), 2);
  });

  it('get returns undefined for unknown key', () => {
    const ff = new FeatureFlags();
    assert.equal(ff.get('nope'), undefined);
  });

  it('set accepts explicit enabled=false', () => {
    const ff = new FeatureFlags();
    ff.set('k', true, false);
    assert.equal(ff.isEnabled('k'), false);
  });
});

// ─── isEnabled ────────────────────────────────────────────────────────────────

describe('FeatureFlags – isEnabled', () => {
  it('returns false for unknown key', () => {
    const ff = new FeatureFlags();
    assert.equal(ff.isEnabled('ghost'), false);
  });

  it('returns true when enabled=true and value is truthy', () => {
    const ff = new FeatureFlags();
    ff.set('on', true, true);
    assert.equal(ff.isEnabled('on'), true);
  });

  it('returns false when enabled=false even if value is truthy', () => {
    const ff = new FeatureFlags();
    ff.set('off', true, false);
    assert.equal(ff.isEnabled('off'), false);
  });

  it('returns false when enabled=true but value is falsy (false)', () => {
    const ff = new FeatureFlags();
    ff.set('zero-val', false, true);
    assert.equal(ff.isEnabled('zero-val'), false);
  });

  it('returns false when enabled=true but value is 0', () => {
    const ff = new FeatureFlags();
    ff.set('zero', 0, true);
    assert.equal(ff.isEnabled('zero'), false);
  });

  it('returns false when enabled=true but value is empty string', () => {
    const ff = new FeatureFlags();
    ff.set('empty', '', true);
    assert.equal(ff.isEnabled('empty'), false);
  });

  it('returns true when value is a non-zero number', () => {
    const ff = new FeatureFlags();
    ff.set('num', 5, true);
    assert.equal(ff.isEnabled('num'), true);
  });
});

// ─── getAll ───────────────────────────────────────────────────────────────────

describe('FeatureFlags – getAll', () => {
  it('returns empty array when no flags set', () => {
    const ff = new FeatureFlags();
    assert.deepEqual(ff.getAll(), []);
  });

  it('returns all set flags', () => {
    const ff = new FeatureFlags();
    ff.set('a', true);
    ff.set('b', 'hello');
    const all = ff.getAll();
    assert.equal(all.length, 2);
    const keys = all.map((f) => f.key).sort();
    assert.deepEqual(keys, ['a', 'b']);
  });

  it('each flag has key, value, and enabled fields', () => {
    const ff = new FeatureFlags();
    ff.set('f', 99, true);
    const flags = ff.getAll();
    assert.equal(flags[0].key, 'f');
    assert.equal(flags[0].value, 99);
    assert.equal(flags[0].enabled, true);
  });
});

// ─── enable / disable ─────────────────────────────────────────────────────────

describe('FeatureFlags – enable / disable', () => {
  it('enable turns an existing disabled flag on', () => {
    const ff = new FeatureFlags();
    ff.set('f', true, false);
    ff.enable('f');
    assert.equal(ff.isEnabled('f'), true);
  });

  it('disable turns an existing enabled flag off', () => {
    const ff = new FeatureFlags();
    ff.set('f', true, true);
    ff.disable('f');
    assert.equal(ff.isEnabled('f'), false);
  });

  it('enable keeps the original value', () => {
    const ff = new FeatureFlags();
    ff.set('v', 'hello', false);
    ff.enable('v');
    assert.equal(ff.get('v'), 'hello');
  });

  it('disable keeps the original value', () => {
    const ff = new FeatureFlags();
    ff.set('v', 'world', true);
    ff.disable('v');
    assert.equal(ff.get('v'), 'world');
  });

  it('enable on unknown key is a no-op', () => {
    const ff = new FeatureFlags();
    assert.doesNotThrow(() => ff.enable('nokey'));
  });

  it('disable on unknown key is a no-op', () => {
    const ff = new FeatureFlags();
    assert.doesNotThrow(() => ff.disable('nokey'));
  });
});

// ─── remove ───────────────────────────────────────────────────────────────────

describe('FeatureFlags – remove', () => {
  it('removes a flag so get returns undefined', () => {
    const ff = new FeatureFlags();
    ff.set('r', true);
    ff.remove('r');
    assert.equal(ff.get('r'), undefined);
  });

  it('isEnabled returns false after remove', () => {
    const ff = new FeatureFlags();
    ff.set('r', true);
    ff.remove('r');
    assert.equal(ff.isEnabled('r'), false);
  });

  it('remove on unknown key is a no-op', () => {
    const ff = new FeatureFlags();
    assert.doesNotThrow(() => ff.remove('phantom'));
  });

  it('decrements getAll count', () => {
    const ff = new FeatureFlags();
    ff.set('a', true);
    ff.set('b', true);
    ff.remove('a');
    assert.equal(ff.getAll().length, 1);
  });
});

// ─── load ─────────────────────────────────────────────────────────────────────

describe('FeatureFlags – load', () => {
  it('loads plain value flags (enabled defaults to true)', () => {
    const ff = new FeatureFlags();
    ff.load({ theme: 'dark', count: 3 });
    assert.equal(ff.get('theme'), 'dark');
    assert.equal(ff.get('count'), 3);
    assert.equal(ff.isEnabled('theme'), true);
  });

  it('loads object flags with explicit value and enabled', () => {
    const ff = new FeatureFlags();
    ff.load({ feat: { value: true, enabled: false } });
    assert.equal(ff.get('feat'), true);
    assert.equal(ff.isEnabled('feat'), false);
  });

  it('load merges — does not clear existing flags', () => {
    const ff = new FeatureFlags();
    ff.set('existing', 1);
    ff.load({ new: 2 });
    assert.equal(ff.get('existing'), 1);
    assert.equal(ff.get('new'), 2);
  });

  it('load overwrites flag with same key', () => {
    const ff = new FeatureFlags();
    ff.set('k', 1);
    ff.load({ k: 99 });
    assert.equal(ff.get('k'), 99);
  });
});

// ─── subscribe ────────────────────────────────────────────────────────────────

describe('FeatureFlags – subscribe', () => {
  it('calls subscriber when set is called', () => {
    const ff = new FeatureFlags();
    const calls = [];
    ff.subscribe('watch', (value, enabled) => calls.push({ value, enabled }));
    ff.set('watch', true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].value, true);
    assert.equal(calls[0].enabled, true);
  });

  it('calls subscriber when enable is called', () => {
    const ff = new FeatureFlags();
    ff.set('w', true, false);
    const calls = [];
    ff.subscribe('w', (value, enabled) => calls.push({ value, enabled }));
    ff.enable('w');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].enabled, true);
  });

  it('calls subscriber when disable is called', () => {
    const ff = new FeatureFlags();
    ff.set('w', true, true);
    const calls = [];
    ff.subscribe('w', (value, enabled) => calls.push({ value, enabled }));
    ff.disable('w');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].enabled, false);
  });

  it('calls subscriber with undefined value and enabled=false when removed', () => {
    const ff = new FeatureFlags();
    ff.set('w', 42);
    const calls = [];
    ff.subscribe('w', (value, enabled) => calls.push({ value, enabled }));
    ff.remove('w');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].value, undefined);
    assert.equal(calls[0].enabled, false);
  });

  it('unsubscribe stops future notifications', () => {
    const ff = new FeatureFlags();
    const calls = [];
    const unsub = ff.subscribe('u', (v) => calls.push(v));
    ff.set('u', 1);
    unsub();
    ff.set('u', 2);
    assert.equal(calls.length, 1);
    assert.equal(calls[0], 1);
  });

  it('multiple subscribers on same key all get notified', () => {
    const ff = new FeatureFlags();
    const a = [];
    const b = [];
    ff.subscribe('m', (v) => a.push(v));
    ff.subscribe('m', (v) => b.push(v));
    ff.set('m', true);
    assert.equal(a.length, 1);
    assert.equal(b.length, 1);
  });

  it('subscriber on key A is not called when key B changes', () => {
    const ff = new FeatureFlags();
    const calls = [];
    ff.subscribe('a', () => calls.push(1));
    ff.set('b', true);
    assert.equal(calls.length, 0);
  });
});
