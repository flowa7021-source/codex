import './setup-dom.js';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  makeDisposable,
  disposableBlobUrl,
  disposableCanvas,
  DisposableStack,
} from '../../app/modules/disposable.js';

// ── makeDisposable ──────────────────────────────────────────────────────────

describe('makeDisposable', () => {
  it('attaches Symbol.dispose to resource', () => {
    const obj = { value: 42 };
    const d = makeDisposable(obj, () => {});
    assert.equal(typeof d[Symbol.dispose], 'function');
    assert.equal(d.disposed, false);
  });

  it('calls cleanup function on dispose', () => {
    let cleaned = false;
    const obj = { value: 1 };
    const d = makeDisposable(obj, () => { cleaned = true; });
    d[Symbol.dispose]();
    assert.equal(cleaned, true);
    assert.equal(d.disposed, true);
  });

  it('only calls cleanup once (idempotent)', () => {
    let count = 0;
    const d = makeDisposable({}, () => { count++; });
    d[Symbol.dispose]();
    d[Symbol.dispose]();
    d[Symbol.dispose]();
    assert.equal(count, 1);
  });

  it('passes original resource to cleanup fn', () => {
    const obj = { name: 'test' };
    let received = null;
    const d = makeDisposable(obj, (r) => { received = r; });
    d[Symbol.dispose]();
    assert.equal(received, obj);
    assert.equal(received.name, 'test');
  });
});

// ── disposableBlobUrl ───────────────────────────────────────────────────────

describe('disposableBlobUrl', () => {
  it('wraps a blob URL with dispose', () => {
    const d = disposableBlobUrl('blob:mock');
    assert.equal(d.url, 'blob:mock');
    assert.equal(typeof d[Symbol.dispose], 'function');
    assert.equal(d.disposed, false);
  });

  it('revokes URL on dispose', () => {
    const d = disposableBlobUrl('blob:test');
    assert.doesNotThrow(() => d[Symbol.dispose]());
    assert.equal(d.disposed, true);
  });
});

// ── disposableCanvas ────────────────────────────────────────────────────────

describe('disposableCanvas', () => {
  it('returns ctx and canvas with dispose', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    const d = disposableCanvas(canvas);
    assert.ok(d.ctx);
    assert.equal(d.canvas, canvas);
    assert.equal(typeof d[Symbol.dispose], 'function');
  });

  it('clears canvas on dispose', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 50;
    canvas.height = 50;
    const d = disposableCanvas(canvas);
    assert.doesNotThrow(() => d[Symbol.dispose]());
    assert.equal(d.disposed, true);
  });
});

// ── DisposableStack ─────────────────────────────────────────────────────────

describe('DisposableStack', () => {
  it('starts not disposed', () => {
    const stack = new DisposableStack();
    assert.equal(stack.disposed, false);
  });

  it('disposes resources in reverse order (LIFO)', () => {
    const order = [];
    const stack = new DisposableStack();
    stack.defer(() => order.push('first'));
    stack.defer(() => order.push('second'));
    stack.defer(() => order.push('third'));
    stack.dispose();
    assert.deepStrictEqual(order, ['third', 'second', 'first']);
  });

  it('use() adds disposable resource', () => {
    let disposed = false;
    const resource = { [Symbol.dispose]: () => { disposed = true; } };
    const stack = new DisposableStack();
    const returned = stack.use(resource);
    assert.equal(returned, resource);
    stack.dispose();
    assert.equal(disposed, true);
  });

  it('dispose is idempotent', () => {
    let count = 0;
    const stack = new DisposableStack();
    stack.defer(() => count++);
    stack.dispose();
    stack.dispose();
    assert.equal(count, 1);
    assert.equal(stack.disposed, true);
  });

  it('throws on use after dispose', () => {
    const stack = new DisposableStack();
    stack.dispose();
    assert.throws(() => stack.use({}), /already disposed/);
  });

  it('throws on defer after dispose', () => {
    const stack = new DisposableStack();
    stack.dispose();
    assert.throws(() => stack.defer(() => {}), /already disposed/);
  });

  it('handles errors in individual cleanups gracefully', () => {
    const order = [];
    const stack = new DisposableStack();
    stack.defer(() => order.push('A'));
    stack.defer(() => { throw new Error('boom'); });
    stack.defer(() => order.push('C'));
    // Should not throw even though one cleanup throws
    assert.doesNotThrow(() => stack.dispose());
    // Both A and C should still execute
    assert.deepStrictEqual(order, ['C', 'A']);
  });

  it('itself is disposable via Symbol.dispose', () => {
    let called = false;
    const stack = new DisposableStack();
    stack.defer(() => { called = true; });
    stack[Symbol.dispose]();
    assert.equal(called, true);
    assert.equal(stack.disposed, true);
  });

  it('use() with non-disposable resource does not error', () => {
    const stack = new DisposableStack();
    const plain = { value: 42 };
    const returned = stack.use(plain);
    assert.equal(returned, plain);
    assert.doesNotThrow(() => stack.dispose());
  });
});

// ── Integration: WorkerPool has Symbol.dispose ──────────────────────────────

describe('WorkerPool Symbol.dispose integration', () => {
  it('WorkerPool has Symbol.dispose method', async () => {
    const { WorkerPool } = await import('../../app/modules/worker-pool.js');
    const pool = new WorkerPool('fake-worker.js', { maxWorkers: 1 });
    assert.equal(typeof pool[Symbol.dispose], 'function');
    // Calling dispose should not throw
    assert.doesNotThrow(() => pool[Symbol.dispose]());
  });
});
