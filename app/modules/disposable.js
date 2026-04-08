// @ts-check
// ─── Disposable Resources ───────────────────────────────────────────────────
// Deterministic resource cleanup using Symbol.dispose (TC39 Explicit Resource
// Management). Provides helpers for making objects disposable and a
// DisposableStack for managing multiple resources.
//
// Usage:
//   import { makeDisposable, DisposableStack } from './disposable.js';
//
//   const pool = makeDisposable(new WorkerPool('w.js'), p => p.destroy());
//   // ... use pool ...
//   pool[Symbol.dispose](); // deterministic cleanup
//
//   // Or use DisposableStack for multiple resources:
//   const stack = new DisposableStack();
//   stack.use(pool);
//   stack.defer(() => URL.revokeObjectURL(blobUrl));
//   stack.dispose(); // cleans up everything in reverse order

/**
 * Make any object disposable by attaching a Symbol.dispose method.
 * @template T
 * @param {T} resource - The resource to make disposable
 * @param {(resource: T) => void} cleanupFn - Cleanup function to call on dispose
 * @returns {T & { [Symbol.dispose]: () => void, disposed: boolean }}
 */
export function makeDisposable(resource, cleanupFn) {
  const wrapped = /** @type {any} */ (resource);
  wrapped.disposed = false;
  wrapped[Symbol.dispose] = () => {
    if (wrapped.disposed) return;
    wrapped.disposed = true;
    cleanupFn(resource);
  };
  return wrapped;
}

/**
 * Create a disposable wrapper around a Blob URL.
 * Automatically calls URL.revokeObjectURL on dispose.
 * @param {string} url - The blob URL to manage
 * @returns {{ url: string, [Symbol.dispose]: () => void, disposed: boolean }}
 */
export function disposableBlobUrl(url) {
  return makeDisposable({ url }, (r) => {
    try { URL.revokeObjectURL(r.url); } catch (_e) { /* ignore */ }
  });
}

/**
 * Create a disposable canvas context.
 * Resets transform and clears canvas on dispose.
 * @param {HTMLCanvasElement} canvas
 * @returns {{ ctx: CanvasRenderingContext2D | null, canvas: HTMLCanvasElement, [Symbol.dispose]: () => void, disposed: boolean }}
 */
export function disposableCanvas(canvas) {
  const ctx = canvas.getContext('2d');
  return makeDisposable({ ctx, canvas }, (r) => {
    try {
      if (r.ctx) {
        r.ctx.resetTransform?.();
        r.ctx.clearRect(0, 0, r.canvas.width, r.canvas.height);
      }
    } catch (_e) { /* ignore */ }
  });
}

/**
 * A stack that tracks disposable resources and disposes them in reverse order.
 * Mirrors the TC39 DisposableStack proposal.
 */
export class DisposableStack {
  constructor() {
    /** @type {Array<() => void>} */
    this._cleanups = [];
    this._disposed = false;
  }

  /** @returns {boolean} */
  get disposed() { return this._disposed; }

  /**
   * Add a disposable resource to the stack.
   * @template T
   * @param {T & { [Symbol.dispose]?: () => void }} resource
   * @returns {T}
   */
  use(resource) {
    if (this._disposed) throw new Error('DisposableStack already disposed');
    if (resource && typeof resource[Symbol.dispose] === 'function') {
      this._cleanups.push(() => /** @type {any} */ (resource)[Symbol.dispose]());
    }
    return resource;
  }

  /**
   * Add a cleanup callback to be called on dispose.
   * @param {() => void} fn
   */
  defer(fn) {
    if (this._disposed) throw new Error('DisposableStack already disposed');
    this._cleanups.push(fn);
  }

  /**
   * Dispose all resources in reverse order.
   */
  dispose() {
    if (this._disposed) return;
    this._disposed = true;
    // Dispose in LIFO order
    for (let i = this._cleanups.length - 1; i >= 0; i--) {
      try { this._cleanups[i](); } catch (_e) { /* ignore individual errors */ }
    }
    this._cleanups.length = 0;
  }

  /** Alias for dispose — allows DisposableStack itself to be disposable. */
  [Symbol.dispose]() {
    this.dispose();
  }
}
