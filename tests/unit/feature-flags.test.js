// ─── Unit Tests: feature-flags ───────────────────────────────────────────────
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  registerFlag,
  isEnabled,
  setEnabled,
  getFlags,
  getFlag,
  removeFlag,
  clearFlags,
  loadFlags,
} from '../../app/modules/feature-flags.js';

// Reset flag registry before every test
beforeEach(() => {
  clearFlags();
});

// ─── registerFlag() ───────────────────────────────────────────────────────────

describe('registerFlag()', () => {
  it('adds a flag that can be retrieved', () => {
    registerFlag({ name: 'dark-mode', enabled: true });
    const flag = getFlag('dark-mode');
    assert.ok(flag);
    assert.equal(flag.name, 'dark-mode');
    assert.equal(flag.enabled, true);
  });

  it('replaces an existing flag with the same name', () => {
    registerFlag({ name: 'feat', enabled: false });
    registerFlag({ name: 'feat', enabled: true, description: 'updated' });
    const flag = getFlag('feat');
    assert.equal(flag?.enabled, true);
    assert.equal(flag?.description, 'updated');
  });

  it('stores optional description and rolloutPercentage', () => {
    registerFlag({ name: 'rollout', enabled: true, description: 'gradual', rolloutPercentage: 50 });
    const flag = getFlag('rollout');
    assert.equal(flag?.description, 'gradual');
    assert.equal(flag?.rolloutPercentage, 50);
  });
});

// ─── isEnabled() ─────────────────────────────────────────────────────────────

describe('isEnabled()', () => {
  it('returns false for an unknown flag', () => {
    assert.equal(isEnabled('nonexistent'), false);
  });

  it('returns true for an enabled flag', () => {
    registerFlag({ name: 'feat-on', enabled: true });
    assert.equal(isEnabled('feat-on'), true);
  });

  it('returns false for a disabled flag', () => {
    registerFlag({ name: 'feat-off', enabled: false });
    assert.equal(isEnabled('feat-off'), false);
  });
});

// ─── isEnabled() with rolloutPercentage ───────────────────────────────────────

describe('isEnabled() with rolloutPercentage', () => {
  it('uses a deterministic hash of userId to decide eligibility', () => {
    // djb2('user-42') % 100 can be pre-computed to verify determinism
    registerFlag({ name: 'partial', enabled: false, rolloutPercentage: 100 });
    // 100% rollout — every userId should be enabled
    assert.equal(isEnabled('partial', 'any-user'), true);
  });

  it('returns false for 0% rollout regardless of userId', () => {
    registerFlag({ name: 'zero-rollout', enabled: true, rolloutPercentage: 0 });
    assert.equal(isEnabled('zero-rollout', 'user-a'), false);
    assert.equal(isEnabled('zero-rollout', 'user-b'), false);
  });

  it('is deterministic for the same userId', () => {
    registerFlag({ name: 'det', enabled: false, rolloutPercentage: 50 });
    const first = isEnabled('det', 'stable-user');
    const second = isEnabled('det', 'stable-user');
    assert.equal(first, second);
  });

  it('can produce different results for different userIds at 50% rollout', () => {
    // With a 50% rollout, at least some users will be in and some out.
    // Iterate a few IDs and ensure we get both true and false.
    registerFlag({ name: 'half', enabled: false, rolloutPercentage: 50 });
    const results = new Set();
    for (let i = 0; i < 20; i++) {
      results.add(isEnabled('half', `user-${i}`));
    }
    assert.ok(results.has(true), 'expected at least one user to be enabled');
    assert.ok(results.has(false), 'expected at least one user to be disabled');
  });

  it('falls back to flag.enabled when no userId supplied', () => {
    registerFlag({ name: 'nouserid', enabled: true, rolloutPercentage: 0 });
    // No userId → rollout branch not taken → uses flag.enabled
    assert.equal(isEnabled('nouserid'), true);
  });
});

// ─── setEnabled() ─────────────────────────────────────────────────────────────

describe('setEnabled()', () => {
  it('enables a disabled flag', () => {
    registerFlag({ name: 'toggle', enabled: false });
    setEnabled('toggle', true);
    assert.equal(isEnabled('toggle'), true);
  });

  it('disables an enabled flag', () => {
    registerFlag({ name: 'toggle2', enabled: true });
    setEnabled('toggle2', false);
    assert.equal(isEnabled('toggle2'), false);
  });

  it('is a no-op for an unknown flag', () => {
    assert.doesNotThrow(() => setEnabled('ghost', true));
    assert.equal(isEnabled('ghost'), false);
  });
});

// ─── getFlags() ───────────────────────────────────────────────────────────────

describe('getFlags()', () => {
  it('returns all registered flags', () => {
    registerFlag({ name: 'a', enabled: true });
    registerFlag({ name: 'b', enabled: false });
    const all = getFlags();
    assert.equal(all.length, 2);
    const names = all.map((f) => f.name).sort();
    assert.deepEqual(names, ['a', 'b']);
  });

  it('returns an empty array when no flags are registered', () => {
    assert.deepEqual(getFlags(), []);
  });

  it('returns shallow copies — mutations do not affect the registry', () => {
    registerFlag({ name: 'copy-test', enabled: true });
    const flags = getFlags();
    flags[0].enabled = false;
    assert.equal(isEnabled('copy-test'), true);
  });
});

// ─── getFlag() ────────────────────────────────────────────────────────────────

describe('getFlag()', () => {
  it('returns the flag matching the given name', () => {
    registerFlag({ name: 'exact', enabled: true, description: 'hello' });
    const flag = getFlag('exact');
    assert.ok(flag);
    assert.equal(flag.description, 'hello');
  });

  it('returns undefined when flag does not exist', () => {
    assert.equal(getFlag('nope'), undefined);
  });

  it('returns a shallow copy — mutations do not affect the registry', () => {
    registerFlag({ name: 'immutable', enabled: true });
    const flag = getFlag('immutable');
    flag.enabled = false;
    assert.equal(isEnabled('immutable'), true);
  });
});

// ─── removeFlag() ─────────────────────────────────────────────────────────────

describe('removeFlag()', () => {
  it('removes the flag from the registry', () => {
    registerFlag({ name: 'to-remove', enabled: true });
    removeFlag('to-remove');
    assert.equal(getFlag('to-remove'), undefined);
  });

  it('isEnabled() returns false after removal', () => {
    registerFlag({ name: 'gone', enabled: true });
    removeFlag('gone');
    assert.equal(isEnabled('gone'), false);
  });

  it('is a no-op for an unknown flag', () => {
    assert.doesNotThrow(() => removeFlag('phantom'));
  });
});

// ─── clearFlags() ─────────────────────────────────────────────────────────────

describe('clearFlags()', () => {
  it('removes all registered flags', () => {
    registerFlag({ name: 'x', enabled: true });
    registerFlag({ name: 'y', enabled: false });
    clearFlags();
    assert.deepEqual(getFlags(), []);
  });

  it('isEnabled() returns false for all previously registered flags', () => {
    registerFlag({ name: 'was-on', enabled: true });
    clearFlags();
    assert.equal(isEnabled('was-on'), false);
  });
});

// ─── loadFlags() ──────────────────────────────────────────────────────────────

describe('loadFlags()', () => {
  it('replaces all flags with the provided set', () => {
    registerFlag({ name: 'old', enabled: true });
    loadFlags([
      { name: 'new-a', enabled: true },
      { name: 'new-b', enabled: false },
    ]);
    assert.equal(getFlag('old'), undefined);
    assert.ok(getFlag('new-a'));
    assert.ok(getFlag('new-b'));
  });

  it('resulting flags are accessible via isEnabled()', () => {
    loadFlags([{ name: 'loaded', enabled: true }]);
    assert.equal(isEnabled('loaded'), true);
  });

  it('replacing with an empty array clears all flags', () => {
    registerFlag({ name: 'existing', enabled: true });
    loadFlags([]);
    assert.deepEqual(getFlags(), []);
  });

  it('flags loaded from array are independent copies', () => {
    const source = [{ name: 'src', enabled: true }];
    loadFlags(source);
    source[0].enabled = false;
    // Mutation of source array must not affect the registry
    assert.equal(isEnabled('src'), true);
  });
});
