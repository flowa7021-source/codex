// ─── Virtual Scroll ─────────────────────────────────────────────────────────
// Virtualized rendering for continuous scroll mode. Only renders visible pages.

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

    // Resize observer
    this._resizeObserver = new ResizeObserver(() => {
      this._onScroll();
    });
    this._resizeObserver.observe(this.container);

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
    return this.offsets[this.pageCount] || 0;
  }

  _onScroll() {
    if (this._destroyed) return;

    const scrollTop = this.container.scrollTop;
    const viewportHeight = this.container.clientHeight;
    const viewTop = scrollTop - this.overscan * viewportHeight;
    const viewBottom = scrollTop + viewportHeight + this.overscan * viewportHeight;

    // Find visible pages
    const visiblePages = new Set();
    for (let i = 1; i <= this.pageCount; i++) {
      const top = this.offsets[i - 1];
      const bottom = this.offsets[i];
      if (bottom >= viewTop && top <= viewBottom) {
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

    // Render newly visible pages
    for (const pageNum of visiblePages) {
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
      if (!this._destroyed) {
        this.renderedPages.set(pageNum, element);
      }
    } catch {
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

// Simple throttle utility
function throttle(fn, ms) {
  let last = 0;
  let timer = null;
  return function (...args) {
    const now = Date.now();
    if (now - last >= ms) {
      last = now;
      fn.apply(this, args);
    } else if (!timer) {
      timer = setTimeout(() => {
        last = Date.now();
        timer = null;
        fn.apply(this, args);
      }, ms - (now - last));
    }
  };
}
