// ─── Worker Pool ────────────────────────────────────────────────────────────
// Manages a pool of Web Workers for parallel OCR and PDF processing tasks.

import { safeTimeout, clearSafeTimeout } from './safe-timers.js';

/**
 * @typedef {object} PoolTask
 * @property {string} id
 * @property {string} type
 * @property {any} payload
 * @property {Function} resolve
 * @property {Function} reject
 * @property {number} priority
 * @property {number} createdAt
 */

let taskIdCounter = 0;

export class WorkerPool {
  /**
   * @param {string} workerUrl - URL to the worker script
   * @param {object} [options]
   * @param {number} [options.maxWorkers=4]
   * @param {number} [options.taskTimeout=60000]
   * @param {boolean} [options.autoScale=true]
   */
  constructor(workerUrl, options = {}) {
    this.workerUrl = workerUrl;
    this.maxWorkers = options.maxWorkers ?? Math.min(navigator.hardwareConcurrency || 4, 8);
    this.taskTimeout = options.taskTimeout ?? 60000;
    this.autoScale = options.autoScale !== false;

    /** @type {Array<{worker: Worker, busy: boolean, taskId: string|null, timer: number|null}>} */
    this.workers = [];
    /** @type {PoolTask[]} */
    this.queue = [];
    /** @type {Map<string, PoolTask>} */
    this.activeTasks = new Map();

    this.stats = { completed: 0, failed: 0, totalTime: 0 };
    this._destroyed = false;
  }

  /**
   * Submit a task to the pool.
   * @param {string} type - Task type identifier
   * @param {any} payload - Data to send to worker
   * @param {object} [options]
   * @param {number} [options.priority=0] - Higher = higher priority
   * @param {Transferable[]} [options.transfer] - Transferable objects
   * @returns {Promise<any>}
   */
  submit(type, payload, options = {}) {
    if (this._destroyed) return Promise.reject(new Error('Pool destroyed'));

    const { priority = 0, transfer } = options;

    return new Promise((resolve, reject) => {
      const task = {
        id: `task-${++taskIdCounter}`,
        type,
        payload,
        resolve,
        reject,
        priority,
        transfer,
        createdAt: Date.now(),
      };

      this.queue.push(task);
      this.queue.sort((a, b) => b.priority - a.priority);
      this._dispatch();
    });
  }

  /**
   * Get pool status.
   */
  getStatus() {
    return {
      workers: this.workers.length,
      busy: this.workers.filter(w => w.busy).length,
      queued: this.queue.length,
      ...this.stats,
      avgTime: this.stats.completed > 0
        ? Math.round(this.stats.totalTime / this.stats.completed)
        : 0,
    };
  }

  /**
   * Cancel all pending tasks.
   */
  cancelPending() {
    for (const task of this.queue) {
      task.reject(new Error('Cancelled'));
    }
    this.queue = [];
  }

  /**
   * Destroy the pool and terminate all workers.
   */
  destroy() {
    this._destroyed = true;
    this.cancelPending();
    for (const entry of this.workers) {
      if (entry.timer) clearSafeTimeout(entry.timer);
      entry.worker.terminate();
    }
    this.workers = [];
    this.activeTasks.clear();
  }

  /** @private */
  _dispatch() {
    if (this.queue.length === 0) return;

    // Find or create an available worker
    let available = this.workers.find(w => !w.busy);

    if (!available && this.workers.length < this.maxWorkers) {
      available = this._createWorker();
    }

    if (!available) return; // All workers busy, will dispatch when one frees up

    const task = this.queue.shift();
    available.busy = true;
    available.taskId = task.id;
    this.activeTasks.set(task.id, task);

    // Set timeout
    available.timer = safeTimeout(() => {
      this._handleTimeout(available, task);
    }, this.taskTimeout);

    try {
      const message = { id: task.id, type: task.type, payload: task.payload };
      if (task.transfer) {
        available.worker.postMessage(message, task.transfer);
      } else {
        available.worker.postMessage(message);
      }
    } catch (err) {
      this._completeTask(available, task, null, err);
    }
  }

  /** @private */
  _createWorker() {
    const worker = new Worker(this.workerUrl);
    const entry = { worker, busy: false, taskId: null, timer: null };

    worker.onmessage = (e) => {
      const { id, result, error } = e.data;
      const task = this.activeTasks.get(id);
      if (task) {
        this._completeTask(entry, task, result, error ? new Error(error) : null);
      }
    };

    worker.onerror = (e) => {
      const task = this.activeTasks.get(entry.taskId);
      if (task) {
        this._completeTask(entry, task, null, new Error(e.message || 'Worker error'));
      }
    };

    this.workers.push(entry);
    return entry;
  }

  /** @private */
  _completeTask(workerEntry, task, result, error) {
    if (workerEntry.timer) {
      clearSafeTimeout(workerEntry.timer);
      workerEntry.timer = null;
    }

    workerEntry.busy = false;
    workerEntry.taskId = null;
    this.activeTasks.delete(task.id);

    const elapsed = Date.now() - task.createdAt;

    if (error) {
      this.stats.failed++;
      task.reject(error);
    } else {
      this.stats.completed++;
      this.stats.totalTime += elapsed;
      task.resolve(result);
    }

    // Scale down idle workers
    if (this.autoScale && this.queue.length === 0) {
      this._scaleDown();
    }

    // Dispatch next task
    this._dispatch();
  }

  /** @private */
  _handleTimeout(workerEntry, task) {
    // Terminate and replace the timed-out worker
    const idx = this.workers.indexOf(workerEntry);
    workerEntry.worker.terminate();

    if (idx !== -1) {
      this.workers.splice(idx, 1);
    }

    this.activeTasks.delete(task.id);
    this.stats.failed++;
    task.reject(new Error(`Task timed out after ${this.taskTimeout}ms`));

    this._dispatch();
  }

  /** @private */
  _scaleDown() {
    // Keep at least 1 worker, remove idle workers above that
    const idle = this.workers.filter(w => !w.busy);
    while (idle.length > 1) {
      const toRemove = idle.pop();
      toRemove.worker.terminate();
      const idx = this.workers.indexOf(toRemove);
      if (idx !== -1) this.workers.splice(idx, 1);
    }
  }
}

/**
 * Singleton pool for OCR tasks.
 * Initialize with `initOcrPool(workerUrl)`.
 */
let ocrPool = null;

export function initOcrPool(workerUrl, options) {
  if (ocrPool) ocrPool.destroy();
  ocrPool = new WorkerPool(workerUrl, options);
  return ocrPool;
}

export function getOcrPool() {
  return ocrPool;
}

/**
 * Generic worker task runner that wraps a function into a worker via blob URL.
 * Useful for running CPU-intensive code off the main thread.
 *
 * @param {Function} fn - Function to run in worker (receives payload, returns result)
 * @param {any} payload - Data to pass to the function
 * @param {Transferable[]} [transfer]
 * @returns {Promise<any>}
 */
export function runInWorker(fn, payload, transfer) {
  const code = `
    self.onmessage = async function(e) {
      try {
        const fn = ${fn.toString()};
        const result = await fn(e.data.payload);
        self.postMessage({ id: e.data.id, result });
      } catch (err) {
        self.postMessage({ id: e.data.id, error: err.message });
      }
    };
  `;
  const blob = new Blob([code], { type: 'application/javascript' });
  const url = URL.createObjectURL(blob);

  return new Promise((resolve, reject) => {
    const worker = new Worker(url);
    const id = `inline-${++taskIdCounter}`;

    const timer = safeTimeout(() => {
      worker.terminate();
      URL.revokeObjectURL(url);
      reject(new Error('Inline worker timed out'));
    }, 30000);

    worker.onmessage = (e) => {
      clearSafeTimeout(timer);
      worker.terminate();
      URL.revokeObjectURL(url);
      if (e.data.error) reject(new Error(e.data.error));
      else resolve(e.data.result);
    };

    worker.onerror = (e) => {
      clearSafeTimeout(timer);
      worker.terminate();
      URL.revokeObjectURL(url);
      reject(new Error(e.message || 'Worker error'));
    };

    if (transfer) {
      worker.postMessage({ id, payload }, transfer);
    } else {
      worker.postMessage({ id, payload });
    }
  });
}
