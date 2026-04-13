// @ts-check
// ─── Pagination Utilities ─────────────────────────────────────────────────────
// Offset/page-based pagination helpers.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PaginationInfo {
  page: number;        // current page (1-indexed)
  pageSize: number;    // items per page
  total: number;       // total item count
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
  startIndex: number;  // 0-indexed start
  endIndex: number;    // 0-indexed end (exclusive)
}

// ─── Pure Helpers ─────────────────────────────────────────────────────────────

/** Calculate pagination info. */
export function paginate(page: number, pageSize: number, total: number): PaginationInfo {
  const size = Math.max(1, pageSize);
  const totalPages = total <= 0 ? 1 : Math.ceil(total / size);
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const startIndex = (currentPage - 1) * size;
  const endIndex = Math.min(startIndex + size, total);

  return {
    page: currentPage,
    pageSize: size,
    total,
    totalPages,
    hasNext: currentPage < totalPages,
    hasPrev: currentPage > 1,
    startIndex,
    endIndex,
  };
}

/** Slice an array for a specific page. */
export function paginateArray<T>(
  arr: T[],
  page: number,
  pageSize: number,
): { items: T[]; info: PaginationInfo } {
  const info = paginate(page, pageSize, arr.length);
  const items = arr.slice(info.startIndex, info.endIndex);
  return { items, info };
}

/**
 * Generate page numbers for a paginator UI (with ellipsis).
 * Always includes first and last page.
 * Uses '...' to replace omitted ranges.
 */
export function pageNumbers(
  currentPage: number,
  totalPages: number,
  maxVisible = 7,
): (number | '...')[] {
  if (totalPages <= 0) return [];
  if (totalPages <= maxVisible) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages: (number | '...')[] = [];
  // How many pages to show around the current page (besides first/last)
  const sideCount = Math.max(1, Math.floor((maxVisible - 3) / 2));

  const rangeStart = Math.max(2, currentPage - sideCount);
  const rangeEnd = Math.min(totalPages - 1, currentPage + sideCount);

  pages.push(1);

  if (rangeStart > 2) {
    pages.push('...');
  }

  for (let i = rangeStart; i <= rangeEnd; i++) {
    pages.push(i);
  }

  if (rangeEnd < totalPages - 1) {
    pages.push('...');
  }

  pages.push(totalPages);

  return pages;
}

/** Calculate offset from page + pageSize. */
export function pageToOffset(page: number, pageSize: number): number {
  return (Math.max(1, page) - 1) * Math.max(1, pageSize);
}

/** Calculate page from offset + pageSize (1-indexed). */
export function offsetToPage(offset: number, pageSize: number): number {
  return Math.floor(Math.max(0, offset) / Math.max(1, pageSize)) + 1;
}

// ─── Paginator Class ──────────────────────────────────────────────────────────

export class Paginator<T> {
  #allItems: T[];
  #filteredItems: T[];
  #pageSize: number;
  #currentPage: number;

  constructor(items: T[], pageSize = 10) {
    this.#allItems = [...items];
    this.#filteredItems = [...items];
    this.#pageSize = Math.max(1, pageSize);
    this.#currentPage = 1;
  }

  get currentPage(): number {
    return this.#currentPage;
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.#filteredItems.length / this.#pageSize));
  }

  get pageSize(): number {
    return this.#pageSize;
  }

  get total(): number {
    return this.#filteredItems.length;
  }

  get info(): PaginationInfo {
    return paginate(this.#currentPage, this.#pageSize, this.#filteredItems.length);
  }

  /** Get items on current page. */
  items(): T[] {
    const { startIndex, endIndex } = this.info;
    return this.#filteredItems.slice(startIndex, endIndex);
  }

  /** Advance to next page. Returns false if already on last page. */
  next(): boolean {
    if (this.#currentPage >= this.totalPages) return false;
    this.#currentPage++;
    return true;
  }

  /** Go back to previous page. Returns false if already on first page. */
  prev(): boolean {
    if (this.#currentPage <= 1) return false;
    this.#currentPage--;
    return true;
  }

  /** Go to specific page (clamped). Returns false if page is out of range. */
  goto(page: number): boolean {
    if (page < 1 || page > this.totalPages) return false;
    this.#currentPage = page;
    return true;
  }

  /** Apply a filter predicate and reset to page 1. */
  filter(pred: (item: T) => boolean): void {
    this.#filteredItems = this.#allItems.filter(pred);
    this.#currentPage = 1;
  }

  /** Reset filter to show all items and go to page 1. */
  resetFilter(): void {
    this.#filteredItems = [...this.#allItems];
    this.#currentPage = 1;
  }
}
