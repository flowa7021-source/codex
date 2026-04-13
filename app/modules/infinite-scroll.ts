// @ts-check
// ─── Infinite Scroll ──────────────────────────────────────────────────────────
// State management for infinite scrolling (no DOM dependency).

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InfiniteScrollState<T> {
  items: T[];
  page: number;
  hasMore: boolean;
  loading: boolean;
  error: Error | null;
}

export interface InfiniteScrollOptions<T> {
  fetchPage: (page: number) => Promise<T[]>;
  pageSize?: number;    // default 20
  initialPage?: number; // default 1
}

// ─── Public API ──────────────────────────────────────────────────────────────

export class InfiniteScroll<T> {
  #fetchPage: (page: number) => Promise<T[]>;
  #pageSize: number;
  #initialPage: number;
  #state: InfiniteScrollState<T>;
  #subscribers: Set<(state: InfiniteScrollState<T>) => void>;

  constructor(options: InfiniteScrollOptions<T>) {
    this.#fetchPage = options.fetchPage;
    this.#pageSize = options.pageSize ?? 20;
    this.#initialPage = options.initialPage ?? 1;
    this.#subscribers = new Set();
    this.#state = {
      items: [],
      page: this.#initialPage,
      hasMore: true,
      loading: false,
      error: null,
    };
  }

  get state(): InfiniteScrollState<T> {
    return this.#state;
  }

  /** Load the next page. */
  async loadMore(): Promise<void> {
    if (this.#state.loading || !this.#state.hasMore) return;

    this.#setState({ loading: true, error: null });

    try {
      const results = await this.#fetchPage(this.#state.page);
      const hasMore = results.length >= this.#pageSize;
      this.#setState({
        items: [...this.#state.items, ...results],
        page: this.#state.page + 1,
        hasMore,
        loading: false,
      });
    } catch (err) {
      this.#setState({
        loading: false,
        error: err instanceof Error ? err : new Error(String(err)),
      });
    }
  }

  /** Reset to initial state and reload first page. */
  async reset(): Promise<void> {
    this.#state = {
      items: [],
      page: this.#initialPage,
      hasMore: true,
      loading: false,
      error: null,
    };
    this.#notify();
    await this.loadMore();
  }

  /** Check if more items should be loaded (based on scroll position). */
  shouldLoadMore(
    scrollTop: number,
    scrollHeight: number,
    containerHeight: number,
    threshold = 0.8,
  ): boolean {
    if (this.#state.loading || !this.#state.hasMore) return false;
    const scrolled = scrollTop + containerHeight;
    return scrolled / scrollHeight >= threshold;
  }

  /** Subscribe to state changes. Returns unsubscribe function. */
  subscribe(fn: (state: InfiniteScrollState<T>) => void): () => void {
    this.#subscribers.add(fn);
    return () => {
      this.#subscribers.delete(fn);
    };
  }

  #setState(patch: Partial<InfiniteScrollState<T>>): void {
    this.#state = { ...this.#state, ...patch };
    this.#notify();
  }

  #notify(): void {
    for (const fn of this.#subscribers) {
      fn(this.#state);
    }
  }
}
