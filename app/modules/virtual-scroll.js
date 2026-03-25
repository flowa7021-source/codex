// @ts-check
// ─── Virtual Scroll ─────────────────────────────────────────────────────────
// Virtualized rendering for continuous scroll mode. Only renders visible pages.

import { safeTimeout, clearSafeTimeout } from './safe-timers.js';

/**
 * @typedef {object} VirtualScrollOptions
 * @property {HTMLElement} container - Scrollable container
 * @property {number} pageCount - Total number of pages
 * @property {Function} getPageHeight - (pageNum: number) => number
 * @property {Function} renderPage - (pageNum: number, element: HTMLElement) => Promise<void>
 * @property {Function} [destroyPage] - (pageNum: number, element: HTMLElement) => void
 * @property {number} [overscan=2] - Pages to render beyond viewport
 * @property {number} [gap=8] - Gap between pages in px
 */

export class VirtualScroll {
  /**
   * @param {VirtualScrollOptions} options
   */
  constructor(options) {
    this.container = options.container;
    this.pageCount = options.pageCount;
    this.getPageHeight = options.getPageHeight;
    this.renderPage = options.renderPage;
    this.destroyPage = options.destroyPage || (() => {});
    this.overscan = options.overscan ?? 2;
    this.gap = options.gap ?? 8;

    /** @type {Map<number, HTMLElement>} Currently rendered page elements */
    this.renderedPages = new Map();
    /** @type {Set<number>} Pages currently being rendered */
    this.rendering = new Set();
    /** Max concurrent renders to prevent memory pressure */
    this._maxConcurrent = 3;
    /** @type {number[]} Cumulative Y offsets for each page */
    this.offsets = [];

    this._scrollHandler = null;
    this._resizeObserver = null;
    this._spacer = null;
    this._content = null;
    this._destroyed = false;

    this._init();
  }

  _init() {
    // Calculate total height and offsets
    this._computeOffsets();

    // Create spacer for scroll height
    this._content = document.createElement('div');
    this._content.className = 'virtual-scroll-content';
    this._content.style.position = 'relative';
    this._content.style.width = '100%';
    this._content.style.height = `${this._totalHeight()}px`;

    this.container.innerHTML = '';
    this.container.appendChild(this._content);

    // Scroll handler
    this._scrollHandler = throttle(() => this._onScroll(), 16);
    this.container.addEventListener('scroll', this._scrollHandler, { passive: true });

    // Resize observer — use same throttled handler to avoid double-calls
    try {
      this._resizeObserver = new ResizeObserver(() => {
        this._scrollHandler();
      });
      this._resizeObserver.observe(this.container);
    } catch (err) {
      console.warn('[virtual-scroll] ResizeObserver not available:', err?.message);
    }

    // Initial render
    this._onScroll();
  }

  _computeOffsets() {
    this.offsets = [0];
    for (let i = 1; i <= this.pageCount; i++) {
      const prevHeight = this.getPageHeight(i);
      this.offsets.push(this.offsets[i - 1] + prevHeight + this.gap);
    }
  }

  _totalHeight() {
    return this.offsets[Math.min(this.pageCount, this.offsets.length - 1)] || 0;
  }

  _onScroll() {
    if (this._destroyed) return;

    const scrollTop = this.container.scrollTop;
    const viewportHeight = this.container.clientHeight;
    const viewTop = scrollTop - this.overscan * viewportHeight;
    const viewBottom = scrollTop + viewportHeight + this.overscan * viewportHeight;

    // Find first visible page via binary search with -1 guard to include boundary page
    let startIdx = 1;
    let lo = 1, hi = this.pageCount;
    while (lo <= hi) {
      const mid = (lo + hi) >>> 1;
      if (this.offsets[mid] < viewTop) {
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    startIdx = Math.max(1, lo - 1); // -1 to include the boundary page

    const visiblePages = new Set();
    for (let i = startIdx; i <= this.pageCount; i++) {
      const top = this.offsets[i - 1];
      if (top > viewBottom) break;
      const bottom = this.offsets[i];
      if (bottom >= viewTop) {
        visiblePages.add(i);
      }
    }

    // Remove pages that are no longer visible
    for (const [pageNum, element] of this.renderedPages) {
      if (!visiblePages.has(pageNum)) {
        this.destroyPage(pageNum, element);
        element.remove();
        this.renderedPages.delete(pageNum);
      }
    }

    // Render newly visible pages (limit concurrency to avoid memory pressure)
    for (const pageNum of visiblePages) {
      if (this.rendering.size >= this._maxConcurrent) break;
      if (!this.renderedPages.has(pageNum) && !this.rendering.has(pageNum)) {
        this._renderPageElement(pageNum);
      }
    }
  }

  async _renderPageElement(pageNum) {
    if (this._destroyed) return;
    this.rendering.add(pageNum);

    const element = document.createElement('div');
    element.className = 'virtual-page';
    element.dataset.page = pageNum;
    element.style.position = 'absolute';
    element.style.top = `${this.offsets[pageNum - 1]}px`;
    element.style.left = '0';
    element.style.right = '0';
    element.style.height = `${this.getPageHeight(pageNum)}px`;

    this._content.appendChild(element);

    try {
      await this.renderPage(pageNum, element);
      if (this._destroyed) {
        element.remove();
        return;
      }
      this.renderedPages.set(pageNum, element);
    } catch (err) {
      if (this._destroyed) {
        element.remove();
        return;
      }
      console.warn('[virtual-scroll] error:', err?.message);
      element.innerHTML = `<div class="virtual-page-error">Ошибка загрузки страницы ${pageNum}</div>`;
      this.renderedPages.set(pageNum, element);
    } finally {
      this.rendering.delete(pageNum);
    }
  }

  /**
   * Scroll to a specific page.
   * @param {number} pageNum - 1-indexed page number
   * @param {boolean} [smooth=true]
   */
  scrollToPage(pageNum, smooth = true) {
    if (pageNum < 1 || pageNum > this.pageCount) return;
    const top = this.offsets[pageNum - 1];
    this.container.scrollTo({ top, behavior: smooth ? 'smooth' : 'instant' });
  }

  /**
   * Get the currently most-visible page number.
   * @returns {number}
   */
  getCurrentPage() {
    const scrollTop = this.container.scrollTop;
    const viewportMid = scrollTop + this.container.clientHeight / 2;

    for (let i = 1; i <= this.pageCount; i++) {
      if (this.offsets[i] > viewportMid) return i;
    }
    return this.pageCount;
  }

  /**
   * Update page count (e.g., after document reload).
   * @param {number} newCount
   */
  setPageCount(newCount) {
    this.pageCount = newCount;
    this._computeOffsets();
    this._content.style.height = `${this._totalHeight()}px`;
    this._onScroll();
  }

  /**
   * Force re-render of all visible pages.
   */
  refresh() {
    for (const [pageNum, element] of this.renderedPages) {
      this.destroyPage(pageNum, element);
      element.remove();
    }
    this.renderedPages.clear();
    this._computeOffsets();
    this._content.style.height = `${this._totalHeight()}px`;
    this._onScroll();
  }

  /**
   * Destroy the virtual scroll instance.
   */
  destroy() {
    this._destroyed = true;
    if (this._scrollHandler) {
      this.container.removeEventListener('scroll', this._scrollHandler);
      this._scrollHandler.cancel?.();
    }
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
    }
    for (const [pageNum, element] of this.renderedPages) {
      this.destroyPage(pageNum, element);
      element.remove();
    }
    this.renderedPages.clear();
    if (this._content?.parentNode) {
      this._content.remove();
    }
  }
}

/**
 * Throttle utility that returns a function with a `.cancel()` method
 * to clean up pending timers on destroy.
 */
function throttle(fn, ms) {
  let last = 0;
  let timer = null;
  const throttled = function (...args) {
    const now = Date.now();
    if (now - last >= ms) {
      last = now;
      fn.apply(this, args);
    } else if (!timer) {
      timer = safeTimeout(() => {
        last = Date.now();
        timer = null;
        fn.apply(this, args);
      }, ms - (now - last));
    }
  };
  throttled.cancel = () => {
    if (timer) { clearSafeTimeout(timer); timer = null; }
  };
  return throttled;
}
