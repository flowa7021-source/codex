// @ts-check
/**
 * ThumbnailStore — generates and caches low-resolution page thumbnails.
 *
 * Ensures any page can be shown instantly (<16 ms) when navigating,
 * even before the full render completes. Works for PDF, DjVu, images, epub.
 *
 * Storage:
 *   L1: In-memory Map<pageNum, ImageBitmap>          — instant (0 ms)
 *   L2: IndexedDB via indexed-storage.js             — warm (<10 ms)
 *
 * Background generation: requestIdleCallback spiral from current page.
 */

import { cachePageRender, getCachedPageRender } from './indexed-storage.js';

const THUMB_MAX_DIM = 200;  // px on longest side
const THUMB_QUALITY = 0.7;

export class ThumbnailStore {
  constructor() {
    /** @type {Map<number, ImageBitmap>} */
    this._memory = new Map();
    /** @type {any} adapter */
    this._adapter = null;
    this._pageCount = 0;
    this._docKey = '';   // used as docName for indexed-storage
    /** @type {Set<number>} currently generating */
    this._generating = new Set();
    /** @type {Map<number, Array<(v: ImageBitmap|null) => void>>} waiters for in-progress generation */
    this._waiters = new Map();
    /** @type {number|null} requestIdleCallback handle */
    this._idleHandle = null;
    /** @type {number[]} background queue */
    this._bgQueue = [];
    /** @type {((pageNum: number) => void)|null} callback when thumbnail is ready */
    this.onThumbnailReady = null;
  }

  /**
   * Initialize for a newly opened document. Clears previous state.
   * @param {any} adapter
   * @param {number} pageCount
   * @param {string} docName - used for disk cache key (e.g. "document.pdf")
   */
  init(adapter, pageCount, docName) {
    // Cancel ongoing background work
    if (this._idleHandle !== null) {
      cancelIdleCallback(this._idleHandle);
      this._idleHandle = null;
    }
    this._bgQueue = [];
    // Release old ImageBitmaps
    this._memory.forEach(bmp => { try { bmp.close(); } catch (_e) { /* non-critical */ } });
    this._memory.clear();
    this._generating.clear();
    this._waiters.clear();

    this._adapter = adapter;
    this._pageCount = pageCount;
    // Prefix to avoid collision with full-res renders in indexed-storage
    this._docKey = `__thumb__:${docName}`;
  }

  /**
   * Return thumbnail ImageBitmap for pageNum (1-based), or null if not ready.
   * Does NOT trigger generation — call generateUrgent or scheduleBackground.
   * @param {number} pageNum
   * @returns {ImageBitmap|null}
   */
  get(pageNum) {
    return this._memory.get(pageNum) ?? null;
  }

  /**
   * Return thumbnail, waiting for generation if needed.
   * @param {number} pageNum
   * @returns {Promise<ImageBitmap|null>}
   */
  async getOrGenerate(pageNum) {
    const mem = this._memory.get(pageNum);
    if (mem) return mem;
    // Try disk cache first
    try {
      const blob = await getCachedPageRender(this._docKey, pageNum);
      if (blob) {
        const bmp = await createImageBitmap(blob);
        this._memory.set(pageNum, bmp);
        return bmp;
      }
    } catch (_) {}
    return this._generate(pageNum);
  }

  /**
   * Urgently generate thumbnails for listed pages (fire-and-forget).
   * Returns when ALL listed pages have been generated (or failed).
   * @param {number[]} pageNums
   */
  async generateUrgent(pageNums) {
    const needed = pageNums.filter(p => !this._memory.has(p) && p >= 1 && p <= this._pageCount);
    if (needed.length === 0) return;
    await Promise.allSettled(needed.map(p => this.getOrGenerate(p)));
  }

  /**
   * Schedule background generation for all pages (spiral from currentPage).
   * Uses requestIdleCallback so it never blocks the UI.
   * @param {number} currentPage
   */
  scheduleBackground(currentPage) {
    if (this._idleHandle !== null) {
      cancelIdleCallback(this._idleHandle);
      this._idleHandle = null;
    }
    // Build spiral order: current, current+1, current-1, current+2, ...
    const order = [];
    for (let d = 0; d < this._pageCount; d++) {
      if (d === 0) {
        order.push(currentPage);
      } else {
        const fwd = currentPage + d;
        const bwd = currentPage - d;
        if (fwd <= this._pageCount) order.push(fwd);
        if (bwd >= 1)               order.push(bwd);
      }
    }
    this._bgQueue = order.filter(p => !this._memory.has(p));
    this._drainBackground();
  }

  // ── Internal ────────────────────────────────────────────────────────────────

  _drainBackground() {
    if (this._bgQueue.length === 0) return;
    this._idleHandle = requestIdleCallback(async (deadline) => {
      this._idleHandle = null;
      while (this._bgQueue.length > 0 && deadline.timeRemaining() > 8) {
        const pageNum = this._bgQueue.shift();
        if (pageNum === undefined) break;
        if (this._memory.has(pageNum)) continue;
        // Try disk first (cheap)
        let loaded = false;
        try {
          const blob = await getCachedPageRender(this._docKey, pageNum);
          if (blob) {
            const bmp = await createImageBitmap(blob);
            this._memory.set(pageNum, bmp);
            this.onThumbnailReady?.(pageNum);
            loaded = true;
          }
        } catch (_) {}
        if (!loaded) {
          await this._generate(pageNum);
        }
      }
      if (this._bgQueue.length > 0) this._drainBackground();
    }, { timeout: 3000 });
  }

  /**
   * @param {number} pageNum
   * @returns {Promise<ImageBitmap|null>}
   */
  async _generate(pageNum) {
    // Deduplicate concurrent requests for the same page
    if (this._generating.has(pageNum)) {
      return new Promise(resolve => {
        const w = this._waiters.get(pageNum) ?? [];
        w.push(resolve);
        this._waiters.set(pageNum, w);
      });
    }
    if (!this._adapter || pageNum < 1 || pageNum > this._pageCount) return null;

    this._generating.add(pageNum);
    let bmp = null;
    try {
      // Get page dimensions to compute scale
      const vp = await this._adapter.getPageViewport(pageNum, 1.0, 0);
      const scale = THUMB_MAX_DIM / Math.max(1, Math.max(vp.width, vp.height));

      const offscreen = document.createElement('canvas');
      await this._adapter.renderPage(pageNum, offscreen, { zoom: scale, rotation: 0 });
      if (offscreen.width > 0 && offscreen.height > 0) {
        bmp = await createImageBitmap(offscreen);
        this._memory.set(pageNum, bmp);
        this.onThumbnailReady?.(pageNum);
        // Save to disk cache asynchronously (best-effort)
        offscreen.toBlob(async (blob) => {
          if (!blob) return;
          try { await cachePageRender(this._docKey, pageNum, blob, { zoom: scale }); } catch (_) {}
        }, 'image/jpeg', THUMB_QUALITY);
        // Release the offscreen canvas
        offscreen.width = 0; offscreen.height = 0;
      }
    } catch (_) {
      // Thumbnail generation failure is non-critical
    } finally {
      this._generating.delete(pageNum);
      // Resolve any waiters
      const waiters = this._waiters.get(pageNum);
      if (waiters) {
        this._waiters.delete(pageNum);
        waiters.forEach(fn => fn(bmp));
      }
    }
    return bmp;
  }

  /** Release all memory and cancel background work. */
  dispose() {
    if (this._idleHandle !== null) { cancelIdleCallback(this._idleHandle); this._idleHandle = null; }
    this._bgQueue = [];
    this._memory.forEach(bmp => { try { bmp.close(); } catch (_e) { /* non-critical */ } });
    this._memory.clear();
    this._generating.clear();
    this._waiters.clear();
    this._adapter = null;
  }
}

/** Singleton used across the app. */
export const thumbnailStore = new ThumbnailStore();
