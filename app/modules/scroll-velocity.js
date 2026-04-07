// @ts-check
/**
 * ScrollVelocityTracker — tracks page navigation speed and direction.
 * Used to adapt the prefetch window: fast scrolling → wider prefetch.
 */
export class ScrollVelocityTracker {
  constructor() {
    /** @type {Array<{time: number, page: number}>} */
    this._samples = [];
    this._maxSamples = 10;
    this._smoothed = 0;
    this._decay = 0.8;
  }

  /** @param {number} currentPage */
  record(currentPage) {
    const now = performance.now();
    this._samples.push({ time: now, page: currentPage });
    if (this._samples.length > this._maxSamples) this._samples.shift();
    if (this._samples.length >= 2) {
      const oldest = this._samples[0];
      const elapsed = (now - oldest.time) / 1000;
      if (elapsed > 0.01) {
        const instant = Math.abs(currentPage - oldest.page) / elapsed;
        this._smoothed = this._smoothed * this._decay + instant * (1 - this._decay);
      }
    }
  }

  /** @returns {number} pages per second (exponentially smoothed) */
  getSpeed() { return this._smoothed; }

  /** @returns {1|-1} +1 = forward, -1 = backward */
  getDirection() {
    if (this._samples.length < 2) return 1;
    const diff = this._samples[this._samples.length - 1].page - this._samples[0].page;
    return diff >= 0 ? 1 : -1;
  }

  reset() { this._samples = []; this._smoothed = 0; }
}

export const scrollVelocity = new ScrollVelocityTracker();
