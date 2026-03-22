import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { throttle, debounce, downloadBlob, loadImage, yieldToMainThread } from '../../app/modules/utils.js';

const _origCreate = document.createElement;
document.createElement = (tag) => { const el = _origCreate(tag); if (!el.click) el.click = () => {}; return el; };

describe('throttle returns a function', () => {
  it('returns a function', () => { assert.equal(typeof throttle(() => {}, 100), 'function'); });
});

describe('downloadBlob', () => {
  it('does not throw', () => { assert.doesNotThrow(() => downloadBlob(new Blob(['test']), 'test.txt')); });
});

describe('loadImage', () => {
  it('returns a promise', () => { assert.ok(loadImage('data:image/png;base64,') instanceof Promise); });
});

describe('yieldToMainThread extended', () => {
  it('resolves normally', async () => { await yieldToMainThread(10); assert.ok(true); });
});

describe('debounce extended', () => {
  it('preserves this context', async () => {
    let ctx = null;
    const obj = { fn: debounce(function () { ctx = this; }, 10) };
    obj.fn();
    await new Promise(r => setTimeout(r, 30));
    assert.equal(ctx, obj);
  });
});
