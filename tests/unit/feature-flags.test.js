// ─── Unit Tests: FeatureFlags ─────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { FeatureFlags, createFeatureFlags } from '../../app/modules/feature-flags.js';

// ─── constructor / register ───────────────────────────────────────────────────

describe('FeatureFlags – constructor', () => {
  it('creates an empty registry when no flags provided', () => {
    const ff = new FeatureFlags();
    assert.deepEqual(ff.list(), []);
  });

  it('populates flags passed to the constructor', () => {
    const ff = new FeatureFlags([
      { name: 'dark-mode', enabled: true },
      { name: 'beta', enabled: false },
    ]);
    assert.equal(ff.list().length, 2);
  });

  it('constructor flags are retrievable via getFlag', () => {
    const ff = new FeatureFlags([{ name: 'x', enabled: true }]);
    assert.ok(ff.getFlag('x'));
    assert.equal(ff.getFlag('x').name, 'x');
  });
});

describe('FeatureFlags – register', () => {
  it('register adds a new flag', () => {
    const ff = new FeatureFlags();
    ff.register({ name: 'feat', enabled: true });
    assert.equal(ff.list().length, 1);
  });

  it('register replaces an existing flag', () => {
    const ff = new FeatureFlags();
    ff.register({ name: 'feat', enabled: false });
    ff.register({ name: 'feat', enabled: true });
    assert.equal(ff.list().length, 1);
    assert.equal(ff.getFlag('feat').enabled, true);
  });
});

// ─── isEnabled – basic ────────────────────────────────────────────────────────

describe('FeatureFlags – isEnabled (basic)', () => {
  it('returns false for unknown flag', () => {
    const ff = new FeatureFlags();
    assert.equal(ff.isEnabled('ghost'), false);
  });

  it('returns true for an enabled flag with no restrictions', () => {
    const ff = new FeatureFlags();
    ff.register({ name: 'feat', enabled: true });
    assert.equal(ff.isEnabled('feat'), true);
  });

  it('returns false for a disabled flag', () => {
    const ff = new FeatureFlags();
    ff.register({ name: 'feat', enabled: false });
    assert.equal(ff.isEnabled('feat'), false);
  });

  it('context is optional for simple enabled flags', () => {
    const ff = new FeatureFlags();
    ff.register({ name: 'simple', enabled: true });
    assert.equal(ff.isEnabled('simple'), true);
    assert.equal(ff.isEnabled('simple', {}), true);
  });
});

// ─── isEnabled – allowList ────────────────────────────────────────────────────

describe('FeatureFlags – isEnabled with allowList', () => {
  it('returns true for a userId in the allowList', () => {
    const ff = new FeatureFlags();
    ff.register({ name: 'f', enabled: true, allowList: ['alice', 'bob'] });
    assert.equal(ff.isEnabled('f', { userId: 'alice' }), true);
    assert.equal(ff.isEnabled('f', { userId: 'bob' }), true);
  });

  it('returns false for a userId NOT in the allowList', () => {
    const ff = new FeatureFlags();
    ff.register({ name: 'f', enabled: true, allowList: ['alice'] });
    assert.equal(ff.isEnabled('f', { userId: 'charlie' }), false);
  });

  it('returns false when no userId provided and allowList is set', () => {
    const ff = new FeatureFlags();
    ff.register({ name: 'f', enabled: true, allowList: ['alice'] });
    assert.equal(ff.isEnabled('f', {}), false);
    assert.equal(ff.isEnabled('f'), false);
  });

  it('returns false for disabled flag even if userId is in allowList', () => {
    const ff = new FeatureFlags();
    ff.register({ name: 'f', enabled: false, allowList: ['alice'] });
    assert.equal(ff.isEnabled('f', { userId: 'alice' }), false);
  });
});

// ─── isEnabled – rolloutPercent ───────────────────────────────────────────────

describe('FeatureFlags – isEnabled with rolloutPercent', () => {
  it('rollout 100 enables flag for any userId', () => {
    const ff = new FeatureFlags();
    ff.register({ name: 'r', enabled: true, rolloutPercent: 100 });
    for (let i = 0; i < 20; i++) {
      assert.equal(ff.isEnabled('r', { userId: `user-${i}` }), true);
    }
  });

  it('rollout 0 disables flag for all userIds', () => {
    const ff = new FeatureFlags();
    ff.register({ name: 'r', enabled: true, rolloutPercent: 0 });
    for (let i = 0; i < 20; i++) {
      assert.equal(ff.isEnabled('r', { userId: `user-${i}` }), false);
    }
  });

  it('rollout is deterministic — same userId always gets the same result', () => {
    const ff = new FeatureFlags();
    ff.register({ name: 'det', enabled: true, rolloutPercent: 50 });
    const r1 = ff.isEnabled('det', { userId: 'stable-user' });
    const r2 = ff.isEnabled('det', { userId: 'stable-user' });
    assert.equal(r1, r2);
  });

  it('rollout 50 gives roughly half the users access (statistical)', () => {
    const ff = new FeatureFlags();
    ff.register({ name: 'half', enabled: true, rolloutPercent: 50 });
    let enabled = 0;
    for (let i = 0; i < 200; i++) {
      if (ff.isEnabled('half', { userId: `u-${i}` })) enabled++;
    }
    // With 200 users expect between 70 and 130 (generous bounds)
    assert.ok(enabled >= 70 && enabled <= 130, `enabled=${enabled} out of 200`);
  });

  it('returns false when rolloutPercent set but no userId provided', () => {
    const ff = new FeatureFlags();
    ff.register({ name: 'r', enabled: true, rolloutPercent: 100 });
    assert.equal(ff.isEnabled('r', {}), false);
    assert.equal(ff.isEnabled('r'), false);
  });
});

// ─── isEnabled – conditions ───────────────────────────────────────────────────

describe('FeatureFlags – isEnabled with conditions', () => {
  it('returns true when all conditions match context', () => {
    const ff = new FeatureFlags();
    ff.register({ name: 'c', enabled: true, conditions: { env: 'prod', tier: 'premium' } });
    assert.equal(ff.isEnabled('c', { env: 'prod', tier: 'premium' }), true);
  });

  it('returns false when one condition does not match', () => {
    const ff = new FeatureFlags();
    ff.register({ name: 'c', enabled: true, conditions: { env: 'prod' } });
    assert.equal(ff.isEnabled('c', { env: 'staging' }), false);
  });

  it('returns false when no context provided and conditions are set', () => {
    const ff = new FeatureFlags();
    ff.register({ name: 'c', enabled: true, conditions: { env: 'prod' } });
    assert.equal(ff.isEnabled('c'), false);
  });

  it('extra context keys beyond conditions are ignored', () => {
    const ff = new FeatureFlags();
    ff.register({ name: 'c', enabled: true, conditions: { env: 'prod' } });
    assert.equal(ff.isEnabled('c', { env: 'prod', extra: 'ignored' }), true);
  });
});

// ─── enable / disable ─────────────────────────────────────────────────────────

describe('FeatureFlags – enable / disable', () => {
  it('enable turns a disabled flag on', () => {
    const ff = new FeatureFlags();
    ff.register({ name: 'f', enabled: false });
    ff.enable('f');
    assert.equal(ff.isEnabled('f'), true);
  });

  it('disable turns an enabled flag off', () => {
    const ff = new FeatureFlags();
    ff.register({ name: 'f', enabled: true });
    ff.disable('f');
    assert.equal(ff.isEnabled('f'), false);
  });

  it('enable on unknown flag is a no-op', () => {
    const ff = new FeatureFlags();
    assert.doesNotThrow(() => ff.enable('ghost'));
  });

  it('disable on unknown flag is a no-op', () => {
    const ff = new FeatureFlags();
    assert.doesNotThrow(() => ff.disable('ghost'));
  });

  it('enable preserves other flag properties', () => {
    const ff = new FeatureFlags();
    ff.register({ name: 'f', enabled: false, rolloutPercent: 50 });
    ff.enable('f');
    assert.equal(ff.getFlag('f').rolloutPercent, 50);
  });
});

// ─── setRollout ───────────────────────────────────────────────────────────────

describe('FeatureFlags – setRollout', () => {
  it('updates the rollout percent', () => {
    const ff = new FeatureFlags();
    ff.register({ name: 'r', enabled: true, rolloutPercent: 0 });
    ff.setRollout('r', 100);
    assert.equal(ff.getFlag('r').rolloutPercent, 100);
    assert.equal(ff.isEnabled('r', { userId: 'anyone' }), true);
  });

  it('setRollout on unknown flag is a no-op', () => {
    const ff = new FeatureFlags();
    assert.doesNotThrow(() => ff.setRollout('ghost', 50));
  });

  it('preserves other properties when rollout is updated', () => {
    const ff = new FeatureFlags();
    ff.register({ name: 'r', enabled: true, allowList: ['alice'] });
    ff.setRollout('r', 80);
    assert.deepEqual(ff.getFlag('r').allowList, ['alice']);
  });
});

// ─── list / getFlag ───────────────────────────────────────────────────────────

describe('FeatureFlags – list / getFlag', () => {
  it('list returns all registered flags', () => {
    const ff = new FeatureFlags();
    ff.register({ name: 'a', enabled: true });
    ff.register({ name: 'b', enabled: false });
    assert.equal(ff.list().length, 2);
  });

  it('list returns copies — mutations do not affect internal state', () => {
    const ff = new FeatureFlags();
    ff.register({ name: 'f', enabled: true });
    const flags = ff.list();
    flags[0].enabled = false;
    assert.equal(ff.getFlag('f').enabled, true);
  });

  it('getFlag returns undefined for unknown flag', () => {
    const ff = new FeatureFlags();
    assert.equal(ff.getFlag('nope'), undefined);
  });

  it('getFlag returns a copy — mutations do not affect internal state', () => {
    const ff = new FeatureFlags();
    ff.register({ name: 'f', enabled: true });
    const copy = ff.getFlag('f');
    copy.enabled = false;
    assert.equal(ff.getFlag('f').enabled, true);
  });

  it('list is empty for a new instance', () => {
    const ff = new FeatureFlags();
    assert.deepEqual(ff.list(), []);
  });
});

// ─── createFeatureFlags factory ───────────────────────────────────────────────

describe('createFeatureFlags factory', () => {
  it('returns a FeatureFlags instance', () => {
    const ff = createFeatureFlags();
    assert.ok(ff instanceof FeatureFlags);
  });

  it('factory with no args creates an empty registry', () => {
    const ff = createFeatureFlags();
    assert.deepEqual(ff.list(), []);
  });

  it('factory accepts initial flags', () => {
    const ff = createFeatureFlags([{ name: 'f', enabled: true }]);
    assert.equal(ff.list().length, 1);
    assert.equal(ff.isEnabled('f'), true);
  });

  it('factory-created instance supports all standard operations', () => {
    const ff = createFeatureFlags([{ name: 'x', enabled: false }]);
    ff.enable('x');
    assert.equal(ff.isEnabled('x'), true);
    ff.disable('x');
    assert.equal(ff.isEnabled('x'), false);
  });
});
