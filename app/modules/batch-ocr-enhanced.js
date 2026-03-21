// ─── Enhanced Batch OCR ─────────────────────────────────────────────────────
// Parallel workers, priority queue, pause/resume/cancel for batch OCR.

/**
 * @typedef {object} OcrJob
 * @property {number} pageNum
 * @property {string} status - 'pending' | 'running' | 'done' | 'error' | 'cancelled'
 * @property {string} [text]
 * @property {number} [confidence]
 * @property {string} [error]
 * @property {number} priority
 */

export class BatchOcrEngine {
  /**
   * @param {object} options
   * @param {Function} options.ocrFn - (pageNum: number) => Promise<{text: string, confidence: number}>
   * @param {number} [options.concurrency=2]
   * @param {Function} [options.onProgress] - (completed, total, job) => void
   * @param {Function} [options.onComplete] - (results) => void
   */
  constructor(options) {
    this.ocrFn = options.ocrFn;
    this.concurrency = options.concurrency ?? Math.min(navigator.hardwareConcurrency || 2, 4);
    this.onProgress = options.onProgress || (() => {});
    this.onComplete = options.onComplete || (() => {});

    /** @type {OcrJob[]} */
    this.jobs = [];
    /** @type {Set<number>} */
    this.running = new Set();
    this.completed = 0;
    this.paused = false;
    this.cancelled = false;
    this._resolveAll = null;
  }

  /**
   * Add pages to the OCR queue.
   * @param {number[]} pageNums - 1-indexed page numbers
   * @param {number} [priority=0] - Higher = processed first
   */
  addPages(pageNums, priority = 0) {
    for (const pageNum of pageNums) {
      if (!this.jobs.find(j => j.pageNum === pageNum)) {
        this.jobs.push({
          pageNum,
          status: 'pending',
          priority,
        });
      }
    }
    // Sort by priority (descending) then page number (ascending)
    this.jobs.sort((a, b) => b.priority - a.priority || a.pageNum - b.pageNum);
  }

  /**
   * Start processing the queue.
   * @returns {Promise<OcrJob[]>}
   */
  async start() {
    this.cancelled = false;
    this.paused = false;
    this.completed = 0;

    return new Promise((resolve) => {
      this._resolveAll = resolve;
      this._processQueue();
    });
  }

  /**
   * Pause processing (running jobs will finish).
   */
  pause() {
    this.paused = true;
  }

  /**
   * Resume processing after pause.
   */
  resume() {
    if (!this.paused) return;
    this.paused = false;
    this._processQueue();
  }

  /**
   * Cancel all pending jobs (running jobs will finish).
   */
  cancel() {
    this.cancelled = true;
    for (const job of this.jobs) {
      if (job.status === 'pending') {
        job.status = 'cancelled';
      }
    }
    this._checkComplete();
  }

  /**
   * Reprioritize a specific page.
   * @param {number} pageNum
   * @param {number} newPriority
   */
  prioritize(pageNum, newPriority) {
    const job = this.jobs.find(j => j.pageNum === pageNum);
    if (job && job.status === 'pending') {
      job.priority = newPriority;
      this.jobs.sort((a, b) => b.priority - a.priority || a.pageNum - b.pageNum);
    }
  }

  /**
   * Get current status.
   */
  getStatus() {
    const total = this.jobs.length;
    const done = this.jobs.filter(j => j.status === 'done').length;
    const errors = this.jobs.filter(j => j.status === 'error').length;
    const pending = this.jobs.filter(j => j.status === 'pending').length;
    const running = this.running.size;
    const avgConfidence = this.jobs
      .filter(j => j.confidence != null)
      .reduce((sum, j) => sum + j.confidence, 0) / (done || 1);

    return {
      total,
      done,
      errors,
      pending,
      running,
      paused: this.paused,
      cancelled: this.cancelled,
      progress: total > 0 ? Math.round((done / total) * 100) : 0,
      avgConfidence: Math.round(avgConfidence),
    };
  }

  /**
   * Get results for completed pages.
   * @returns {Map<number, {text: string, confidence: number}>}
   */
  getResults() {
    const results = new Map();
    for (const job of this.jobs) {
      if (job.status === 'done') {
        results.set(job.pageNum, { text: job.text, confidence: job.confidence });
      }
    }
    return results;
  }

  /** @private */
  async _processQueue() {
    if (this.paused || this.cancelled) return;

    // Fill up to concurrency limit
    while (this.running.size < this.concurrency) {
      const nextJob = this.jobs.find(j => j.status === 'pending');
      if (!nextJob) break;

      nextJob.status = 'running';
      this.running.add(nextJob.pageNum);
      this._runJob(nextJob);
    }
  }

  /** @private */
  async _runJob(job) {
    try {
      const result = await this.ocrFn(job.pageNum);
      job.status = 'done';
      job.text = result.text;
      job.confidence = result.confidence;
    } catch (err) {
      job.status = 'error';
      job.error = err.message;
    } finally {
      this.running.delete(job.pageNum);
      this.completed++;
      this.onProgress(this.completed, this.jobs.length, job);
      this._checkComplete();
      if (!this.paused && !this.cancelled) {
        this._processQueue();
      }
    }
  }

  /** @private */
  _checkComplete() {
    const allDone = this.jobs.every(j => j.status !== 'pending' && j.status !== 'running');
    if (allDone && this._resolveAll) {
      this.onComplete(this.jobs);
      this._resolveAll(this.jobs);
      this._resolveAll = null;
    }
  }
}
