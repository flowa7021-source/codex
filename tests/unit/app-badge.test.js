// ─── Unit Tests: App Badge API ────────────────────────────────────────────────
import './setup-dom.js';
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  isBadgeSupported,
  setBadge,
  clearBadge,
  updateBadge,
} from '../../app/modules/app-badge.js';

// ─── Mock setup ──────────────────────────────────────────────────────────────

let calls;

beforeEach(() => {
  calls = { set: [], clear: 0 };
  globalThis.navigator.setAppBadge = async (count) => { calls.set.push(count); };
  globalThis.navigator.clearAppBadge = async () => { calls.clear++; };
});

afterEach(() => {
  delete globalThis.navigator.setAppBadge;
  delete globalThis.navigator.clearAppBadge;
});

// ─── isBadgeSupported ─────────────────────────────────────────────────────────

describe('isBadgeSupported', () => {
  it('returns a boolean', () => {
    assert.equal(typeof isBadgeSupported(), 'boolean');
  });

  it('returns true when setAppBadge is present on navigator', () => {
    assert.equal(isBadgeSupported(), true);
  });

  it('returns false when setAppBadge is absent', () => {
    delete globalThis.navigator.setAppBadge;
    assert.equal(isBadgeSupported(), false);
  });
});

// ─── setBadge ─────────────────────────────────────────────────────────────────

describe('setBadge', () => {
  it('calls setAppBadge with the provided count', async () => {
    await setBadge(5);
    assert.equal(calls.set.length, 1);
    assert.equal(calls.set[0], 5);
  });

  it('calls setAppBadge with undefined (dot badge) when no count provided', async () => {
    await setBadge();
    assert.equal(calls.set.length, 1);
    assert.equal(calls.set[0], undefined);
  });

  it('calls setAppBadge with 0 when count is 0', async () => {
    await setBadge(0);
    assert.equal(calls.set.length, 1);
    assert.equal(calls.set[0], 0);
  });

  it('does not throw when setAppBadge is absent', async () => {
    delete globalThis.navigator.setAppBadge;
    await assert.doesNotReject(() => setBadge(3));
  });

  it('does not throw when setAppBadge rejects', async () => {
    globalThis.navigator.setAppBadge = async () => { throw new Error('badge error'); };
    await assert.doesNotReject(() => setBadge(1));
  });
});

// ─── clearBadge ───────────────────────────────────────────────────────────────

describe('clearBadge', () => {
  it('calls clearAppBadge', async () => {
    await clearBadge();
    assert.equal(calls.clear, 1);
  });

  it('calls clearAppBadge only once per call', async () => {
    await clearBadge();
    await clearBadge();
    assert.equal(calls.clear, 2);
  });

  it('does not throw when clearAppBadge is absent', async () => {
    delete globalThis.navigator.setAppBadge;
    delete globalThis.navigator.clearAppBadge;
    await assert.doesNotReject(() => clearBadge());
  });

  it('does not throw when clearAppBadge rejects', async () => {
    globalThis.navigator.clearAppBadge = async () => { throw new Error('clear error'); };
    await assert.doesNotReject(() => clearBadge());
  });
});

// ─── updateBadge ──────────────────────────────────────────────────────────────

describe('updateBadge', () => {
  it('calls setBadge (setAppBadge) when count > 0', async () => {
    await updateBadge(3);
    assert.equal(calls.set.length, 1);
    assert.equal(calls.set[0], 3);
    assert.equal(calls.clear, 0);
  });

  it('calls clearBadge (clearAppBadge) when count is 0', async () => {
    await updateBadge(0);
    assert.equal(calls.clear, 1);
    assert.equal(calls.set.length, 0);
  });

  it('calls clearBadge for negative count', async () => {
    await updateBadge(-1);
    assert.equal(calls.clear, 1);
    assert.equal(calls.set.length, 0);
  });

  it('calls setBadge with count 1', async () => {
    await updateBadge(1);
    assert.equal(calls.set[0], 1);
  });

  it('does not throw when API is absent', async () => {
    delete globalThis.navigator.setAppBadge;
    delete globalThis.navigator.clearAppBadge;
    await assert.doesNotReject(() => updateBadge(5));
    await assert.doesNotReject(() => updateBadge(0));
  });
});
