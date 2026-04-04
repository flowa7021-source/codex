// ─── Unit Tests: perf-utils.js ───────────────────────────────────────────────
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

// Stub safe-timers before importing the module
import { createRequire } from 'node:module';

// Minimal stubs so the module loads in Node.js (no real DOM)
const _timers = new Map();
let _nextId = 1;

const safeTimeoutMock = (fn, ms) => {
  const id = _nextId++;
  _timers.set(id, { fn, ms });
  return id;
};
const clearSafeTimeoutMock = (id) => { _timers.delete(id); };

// Register mocks before dynamic import
import { register } from 'node:module';

// Use a workaround: mock via global override and direct import
globalThis._testSafeTimeout = safeTimeoutMock;
globalThis._testClearSafeTimeout = clearSafeTimeoutMock;

// Provide navigator stub for Node.js
if (typeof navigator === 'undefined') {
  globalThis.navigator = { hardwareConcurrency: 4 };
}

// Import with unstable mocking by patching the module cache
// Since we can't easily mock ESM imports here, we test via a thin wrapper approach.
// We import the module with stubs provided through the global setup file.

import {
  BatchedProgress,
  CancellationManager,
  DegradationDetector,
  getSystemProfile,
  getAdaptiveDjvuCacheMb,
} from '../../app/modules/perf-utils.js';

// ─── getSystemProfile ─────────────────────────────────────────────────────────

describe('getSystemProfile', () => {
  it('returns an object with tier, cores, djvuCacheMb', () => {
    const p = getSystemProfile();
    assert.ok(['low', 'medium', 'high'].includes(p.tier), `unexpected tier: ${p.tier}`);
    assert.ok(typeof p.cores === 'number' && p.cores > 0);
    assert.ok(typeof p.djvuCacheMb === 'number' && p.djvuCacheMb > 0);
    assert.ok(typeof p.ocrConcurrency === 'number' && p.ocrConcurrency >= 1);
    assert.ok(typeof p.renderCachePx === 'number' && p.renderCachePx > 0);
  });

  it('returns the same object on repeated calls (cached)', () => {
    const p1 = getSystemProfile();
    const p2 = getSystemProfile();
    assert.strictEqual(p1, p2);
  });

  it('getAdaptiveDjvuCacheMb returns djvuCacheMb from profile', () => {
    assert.strictEqual(getAdaptiveDjvuCacheMb(), getSystemProfile().djvuCacheMb);
  });
});

// ─── BatchedProgress ──────────────────────────────────────────────────────────

describe('BatchedProgress', () => {
  it('calls callback immediately on first report', () => {
    const calls = [];
    const bp = new BatchedProgress((...args) => calls.push(args), 9999);
    bp.report('a', 10);
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0], ['a', 10]);
  });

  it('does not emit a second call within the interval', () => {
    const calls = [];
    const bp = new BatchedProgress((...args) => calls.push(args), 9999);
    bp.report('a', 10);    // emits immediately
    bp.report('b', 20);    // within interval — deferred
    assert.equal(calls.length, 1, 'second call should be deferred');
  });

  it('done() flushes the pending call', () => {
    const calls = [];
    const bp = new BatchedProgress((...args) => calls.push(args), 9999);
    bp.report('a', 10);    // emitted immediately
    bp.report('b', 20);    // pending
    bp.done();
    assert.equal(calls.length, 2);
    assert.deepEqual(calls[1], ['b', 20]);
  });

  it('done() is a no-op when nothing is pending', () => {
    const calls = [];
    const bp = new BatchedProgress((...args) => calls.push(args), 9999);
    bp.done();
    assert.equal(calls.length, 0);
  });

  it('cancel() drops the pending call', () => {
    const calls = [];
    const bp = new BatchedProgress((...args) => calls.push(args), 9999);
    bp.report('a', 10);   // emitted
    bp.report('b', 20);   // pending
    bp.cancel();
    bp.done();             // nothing to flush
    assert.equal(calls.length, 1);
  });

  it('emits immediately again after interval has passed', () => {
    const calls = [];
    // Simulate elapsed time by manipulating _lastEmit
    const bp = new BatchedProgress((...args) => calls.push(args), 0);
    bp.report('a', 10);   // emits immediately (interval = 0)
    bp.report('b', 20);   // also emits immediately (interval = 0)
    assert.equal(calls.length, 2);
  });

  it('swallows errors thrown by the callback', () => {
    const bp = new BatchedProgress(() => { throw new Error('boom'); }, 0);
    assert.doesNotThrow(() => bp.report('x', 1));
  });
});

// ─── CancellationManager ─────────────────────────────────────────────────────

describe('CancellationManager', () => {
  it('begin() returns an AbortSignal', () => {
    const cm = new CancellationManager();
    const sig = cm.begin();
    assert.ok(sig instanceof AbortSignal);
  });

  it('signal is not aborted after begin()', () => {
    const cm = new CancellationManager();
    const sig = cm.begin();
    assert.equal(sig.aborted, false);
  });

  it('cancel() aborts the current signal', () => {
    const cm = new CancellationManager();
    const sig = cm.begin();
    cm.cancel();
    assert.equal(sig.aborted, true);
  });

  it('isActive is true after begin()', () => {
    const cm = new CancellationManager();
    cm.begin();
    assert.equal(cm.isActive, true);
  });

  it('isActive is false after cancel()', () => {
    const cm = new CancellationManager();
    cm.begin();
    cm.cancel();
    assert.equal(cm.isActive, false);
  });

  it('second begin() cancels the first signal', () => {
    const cm = new CancellationManager();
    const sig1 = cm.begin();
    const sig2 = cm.begin();
    assert.equal(sig1.aborted, true,  'first signal should be aborted');
    assert.equal(sig2.aborted, false, 'second signal should be active');
  });

  it('signal getter returns pre-aborted signal when no operation active', () => {
    const cm = new CancellationManager();
    assert.equal(cm.signal.aborted, true);
  });

  it('cancel() is safe to call when no operation is active', () => {
    const cm = new CancellationManager();
    assert.doesNotThrow(() => cm.cancel());
  });
});

// ─── DegradationDetector ─────────────────────────────────────────────────────

describe('DegradationDetector', () => {
  it('accepts measurements without error', () => {
    const dd = new DegradationDetector();
    for (let i = 0; i < 25; i++) dd.record(10);
    assert.ok(true, 'no error');
  });

  it('recentAvgMs returns 0 when no samples', () => {
    const dd = new DegradationDetector();
    assert.equal(dd.recentAvgMs, 0);
  });

  it('recentAvgMs reflects recorded values', () => {
    const dd = new DegradationDetector({ window: 4 });
    dd.record(10); dd.record(20); dd.record(30); dd.record(40);
    assert.equal(dd.recentAvgMs, 25);
  });

  it('fires onDegrade when recent avg exceeds threshold × baseline', () => {
    let fired = false;
    const dd = new DegradationDetector({
      window: 5,
      threshold: 2.0,
      onDegrade: () => { fired = true; },
    });
    // Establish baseline: 5 samples at 10ms
    for (let i = 0; i < 5; i++) dd.record(10);
    // Degrade: 5 more at 30ms (3× baseline)
    for (let i = 0; i < 5; i++) dd.record(30);
    assert.equal(fired, true, 'onDegrade should have fired');
  });

  it('does not fire onDegrade when below threshold', () => {
    let fired = false;
    const dd = new DegradationDetector({
      window: 5,
      threshold: 3.0,
      onDegrade: () => { fired = true; },
    });
    for (let i = 0; i < 5; i++) dd.record(10);
    for (let i = 0; i < 5; i++) dd.record(20); // 2× — below threshold of 3×
    assert.equal(fired, false);
  });

  it('does not fire onDegrade twice without recovery', () => {
    let count = 0;
    const dd = new DegradationDetector({
      window: 5,
      threshold: 2.0,
      onDegrade: () => { count++; },
    });
    for (let i = 0; i < 5; i++) dd.record(10);
    for (let i = 0; i < 10; i++) dd.record(30); // sustained degradation
    assert.equal(count, 1, 'onDegrade should fire only once without recovery');
  });

  it('reset() clears all state', () => {
    const dd = new DegradationDetector({ window: 3 });
    dd.record(10); dd.record(20); dd.record(30);
    dd.reset();
    assert.equal(dd.recentAvgMs, 0);
  });
});
