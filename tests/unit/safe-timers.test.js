// ─── Unit Tests: Safe Timers ────────────────────────────────────────────────
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  safeTimeout,
  safeInterval,
  clearSafeTimeout,
  clearSafeInterval,
  clearAllTimers,
  getTimerStats,
} from '../../app/modules/safe-timers.js';

beforeEach(() => {
  clearAllTimers();
});

describe('safeTimeout', () => {
  it('creates a tracked timeout and returns a timer id', () => {
    const id = safeTimeout(() => {}, 100000);
    assert.ok(id != null, 'should return a timer id');
    const stats = getTimerStats();
    assert.equal(stats.timeouts, 1);
    clearSafeTimeout(id);
  });

  it('auto-removes from tracking after execution', async () => {
    let executed = false;
    safeTimeout(() => { executed = true; }, 10);
    await new Promise(r => setTimeout(r, 50));
    assert.equal(executed, true);
    assert.equal(getTimerStats().timeouts, 0);
  });
});

describe('safeInterval', () => {
  it('creates a tracked interval', () => {
    const id = safeInterval(() => {}, 100000);
    assert.ok(id != null, 'should return a timer id');
    assert.equal(getTimerStats().intervals, 1);
    clearSafeInterval(id);
  });

  it('fires repeatedly until cleared', async () => {
    let count = 0;
    const id = safeInterval(() => { count++; }, 15);
    await new Promise(r => setTimeout(r, 80));
    clearSafeInterval(id);
    assert.ok(count >= 2, `expected at least 2 calls, got ${count}`);
  });
});

describe('clearSafeTimeout', () => {
  it('prevents execution and removes tracking', async () => {
    let executed = false;
    const id = safeTimeout(() => { executed = true; }, 30);
    clearSafeTimeout(id);
    await new Promise(r => setTimeout(r, 60));
    assert.equal(executed, false);
    assert.equal(getTimerStats().timeouts, 0);
  });
});

describe('clearSafeInterval', () => {
  it('stops interval and removes tracking', () => {
    const id = safeInterval(() => {}, 100000);
    assert.equal(getTimerStats().intervals, 1);
    clearSafeInterval(id);
    assert.equal(getTimerStats().intervals, 0);
  });
});

describe('clearAllTimers', () => {
  it('clears all tracked timeouts and intervals', () => {
    safeTimeout(() => {}, 100000);
    safeTimeout(() => {}, 100000);
    safeInterval(() => {}, 100000);
    assert.equal(getTimerStats().timeouts, 2);
    assert.equal(getTimerStats().intervals, 1);
    clearAllTimers();
    assert.equal(getTimerStats().timeouts, 0);
    assert.equal(getTimerStats().intervals, 0);
  });
});

describe('getTimerStats', () => {
  it('returns object with timeouts and intervals counts', () => {
    const stats = getTimerStats();
    assert.equal(typeof stats.timeouts, 'number');
    assert.equal(typeof stats.intervals, 'number');
  });
});
