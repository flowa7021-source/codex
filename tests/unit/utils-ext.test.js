// ─── Extended Unit Tests: Utilities Module ──────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { throttle, debounce, yieldToMainThread, loadImage } from '../../app/modules/utils.js';

describe('throttle', () => {
  it('calls function after ms have elapsed', async () => {
    let count = 0;
    const fn = throttle(() => count++, 10);
    // performance.now() starts at 0 in test env, first call should go through
    // since remaining = 10 - (now - 0) and if now >= 10 then remaining <= 0
    await new Promise(r => setTimeout(r, 15));
    fn();
    assert.equal(count, 1);
  });

  it('schedules trailing call when within window', async () => {
    let count = 0;
    const fn = throttle(() => count++, 5);
    await new Promise(r => setTimeout(r, 10));
    fn(); // immediate
    fn(); // scheduled
    assert.equal(count, 1);
    await new Promise(r => setTimeout(r, 20));
    assert.equal(count, 2);
  });
});

describe('debounce', () => {
  it('does not call function immediately', () => {
    let count = 0;
    const fn = debounce(() => count++, 10);
    fn();
    assert.equal(count, 0);
  });

  it('calls function after delay', async () => {
    let count = 0;
    const fn = debounce(() => count++, 10);
    fn();
    await new Promise(r => setTimeout(r, 50));
    assert.equal(count, 1);
  });

  it('resets timer on subsequent calls', async () => {
    let count = 0;
    const fn = debounce(() => count++, 20);
    fn();
    fn();
    fn();
    await new Promise(r => setTimeout(r, 80));
    assert.equal(count, 1);
  });
});

describe('yieldToMainThread', () => {
  it('resolves successfully', async () => {
    await yieldToMainThread();
    assert.ok(true);
  });

  it('accepts custom timeout', async () => {
    await yieldToMainThread(50);
    assert.ok(true);
  });
});

describe('loadImage', () => {
  it('returns a promise', async () => {
    const result = loadImage('data:image/png;base64,');
    assert.ok(result instanceof Promise);
    // Consume the rejection so the mock Image onerror doesn't leak after test end
    await result.catch(() => {});
  });
});
