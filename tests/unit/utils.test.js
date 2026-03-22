// ─── Unit Tests: Utils ──────────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Mock browser globals
globalThis.window = globalThis.window || { addEventListener: () => {} };
globalThis.performance = globalThis.performance || { now: Date.now };
globalThis.Image = globalThis.Image || class Image {
  set src(v) { if (this.onload) this.onload(); }
};

import {
  throttle,
  debounce,
  yieldToMainThread,
  downloadBlob,
} from '../../app/modules/utils.js';

describe('debounce', () => {
  it('delays function execution', async () => {
    let callCount = 0;
    const debounced = debounce(() => { callCount++; }, 30);
    debounced();
    debounced();
    debounced();
    assert.equal(callCount, 0);
    await new Promise(r => setTimeout(r, 60));
    assert.equal(callCount, 1);
  });

  it('resets delay on each call', async () => {
    let callCount = 0;
    const debounced = debounce(() => { callCount++; }, 40);
    debounced();
    await new Promise(r => setTimeout(r, 20));
    debounced(); // reset
    await new Promise(r => setTimeout(r, 20));
    assert.equal(callCount, 0); // still waiting
    await new Promise(r => setTimeout(r, 40));
    assert.equal(callCount, 1);
  });

  it('passes arguments to the debounced function', async () => {
    let received = null;
    const debounced = debounce((a, b) => { received = [a, b]; }, 20);
    debounced('x', 'y');
    await new Promise(r => setTimeout(r, 50));
    assert.deepEqual(received, ['x', 'y']);
  });
});

describe('throttle', () => {
  it('calls function immediately on first call', () => {
    let called = false;
    const throttled = throttle(() => { called = true; }, 100);
    throttled();
    assert.equal(called, true);
  });

  it('suppresses repeated calls within window', () => {
    let callCount = 0;
    const throttled = throttle(() => { callCount++; }, 100);
    throttled();
    throttled();
    throttled();
    assert.equal(callCount, 1);
  });

  it('schedules trailing call after window expires', async () => {
    let callCount = 0;
    const throttled = throttle(() => { callCount++; }, 30);
    throttled(); // immediate
    throttled(); // trailing scheduled
    assert.equal(callCount, 1);
    await new Promise(r => setTimeout(r, 60));
    assert.equal(callCount, 2);
  });
});

describe('yieldToMainThread', () => {
  it('resolves without error', async () => {
    // In Node.js, requestIdleCallback is not defined, so it falls back to setTimeout(0)
    await yieldToMainThread();
    assert.ok(true);
  });

  it('accepts optional timeout parameter', async () => {
    await yieldToMainThread(50);
    assert.ok(true);
  });
});
