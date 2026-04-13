// ─── Page Navigation API ─────────────────────────────────────────────────────
// Wraps the modern Navigation API (window.navigation) to track PDF page
// navigation as browser history entries, with fallback to History API.

export interface PageState {
  docName: string | null;
  page: number;
  zoom?: number;
}

// ─── Navigation API type stubs ───────────────────────────────────────────────
// The Navigation API is not yet in standard TypeScript lib types.

interface NavigationHistoryEntry {
  getState(): unknown;
}

interface NavigateEvent extends Event {
  destination: {
    getState(): unknown;
    sameDocument: boolean;
    url: string;
  };
  canIntercept: boolean;
}

interface Navigation extends EventTarget {
  currentEntry: NavigationHistoryEntry | null;
  entries(): NavigationHistoryEntry[];
  navigate(url: string, options?: { state?: unknown; history?: 'push' | 'replace' | 'auto' }): { committed: Promise<NavigationHistoryEntry>; finished: Promise<NavigationHistoryEntry> };
}

declare global {
  interface Window {
    navigation?: Navigation;
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Whether the modern Navigation API is available in this environment.
 */
export function isNavigationApiSupported(): boolean {
  return 'navigation' in window;
}

/**
 * Push a new history entry for the given page state.
 * Uses the Navigation API when available, otherwise falls back to History API.
 */
export function navigateToPage(state: PageState): void {
  const url = _buildUrl(state);

  if (isNavigationApiSupported() && window.navigation) {
    window.navigation.navigate(url, { state, history: 'push' });
  } else {
    window.history.pushState(state, '', url);
  }
}

/**
 * Replace the current history entry with the given page state.
 * Uses the Navigation API when available, otherwise falls back to History API.
 */
export function replaceCurrentPage(state: PageState): void {
  const url = _buildUrl(state);

  if (isNavigationApiSupported() && window.navigation) {
    window.navigation.navigate(url, { state, history: 'replace' });
  } else {
    window.history.replaceState(state, '', url);
  }
}

/**
 * Returns the current page state from the active history entry.
 * Returns null if no state is stored or the state is not a valid PageState.
 */
export function getCurrentPageState(): PageState | null {
  let raw: unknown;

  if (isNavigationApiSupported() && window.navigation) {
    raw = window.navigation.currentEntry?.getState() ?? null;
  } else {
    raw = window.history.state;
  }

  return _isPageState(raw) ? raw : null;
}

/**
 * Subscribe to back/forward navigation events.
 * Only fires the handler when the page number in the new state differs from
 * the current state, filtering out same-document navigations for non-page events.
 *
 * @returns An unsubscribe function — call it to stop receiving events.
 */
export function onPageNavigate(handler: (state: PageState) => void): () => void {
  if (isNavigationApiSupported() && window.navigation) {
    const listener = (event: Event) => {
      const navEvent = event as NavigateEvent;

      // Only handle same-document navigations
      if (!navEvent.destination.sameDocument) return;

      const newState = navEvent.destination.getState();
      if (!_isPageState(newState)) return;

      const currentState = getCurrentPageState();
      if (currentState && currentState.page === newState.page) return;

      handler(newState);
    };

    window.navigation.addEventListener('navigate', listener);
    return () => window.navigation!.removeEventListener('navigate', listener);
  } else {
    const listener = (_event: Event) => {
      const state = window.history.state;
      if (!_isPageState(state)) return;

      handler(state);
    };

    window.addEventListener('popstate', listener);
    return () => window.removeEventListener('popstate', listener);
  }
}

/**
 * Whether there is a previous history entry to go back to.
 */
export function canGoBack(): boolean {
  if (isNavigationApiSupported() && window.navigation) {
    const entries = window.navigation.entries();
    const currentIdx = entries.findIndex(
      (e) => e === window.navigation!.currentEntry,
    );
    return currentIdx > 0;
  }
  return window.history.length > 1;
}

/**
 * Whether there is a next history entry to go forward to.
 */
export function canGoForward(): boolean {
  if (isNavigationApiSupported() && window.navigation) {
    const entries = window.navigation.entries();
    const currentIdx = entries.findIndex(
      (e) => e === window.navigation!.currentEntry,
    );
    return currentIdx >= 0 && currentIdx < entries.length - 1;
  }
  // History API does not expose forward entries — assume false
  return false;
}

/**
 * Navigate back in history.
 * No-op when there is no previous entry or navigation is not supported.
 */
export function goBack(): void {
  if (isNavigationApiSupported() && window.navigation) {
    if (canGoBack()) {
      const entries = window.navigation.entries();
      const currentIdx = entries.findIndex(
        (e) => e === window.navigation!.currentEntry,
      );
      if (currentIdx > 0) {
        window.navigation.navigate(
          // navigate to the URL of the previous entry by going back
          // Since Navigation API exposes entries, we can use history.back() as well
          (entries[currentIdx - 1] as unknown as { url: string }).url,
        );
      }
    }
  } else {
    window.history.back();
  }
}

/**
 * Navigate forward in history.
 * No-op when there is no next entry or navigation is not supported.
 */
export function goForward(): void {
  if (isNavigationApiSupported() && window.navigation) {
    if (canGoForward()) {
      const entries = window.navigation.entries();
      const currentIdx = entries.findIndex(
        (e) => e === window.navigation!.currentEntry,
      );
      if (currentIdx >= 0 && currentIdx < entries.length - 1) {
        window.navigation.navigate(
          (entries[currentIdx + 1] as unknown as { url: string }).url,
        );
      }
    }
  } else {
    window.history.forward();
  }
}

/**
 * Returns the total number of history entries in the session.
 */
export function getHistoryLength(): number {
  if (isNavigationApiSupported() && window.navigation) {
    return window.navigation.entries().length;
  }
  return window.history.length;
}

// ─── Internal helpers ────────────────────────────────────────────────────────

/**
 * Build the URL hash for a given page state.
 */
function _buildUrl(state: PageState): string {
  return state.docName ? `#page-${state.page}` : '#';
}

/**
 * Type guard: check if a value is a valid PageState object.
 */
function _isPageState(value: unknown): value is PageState {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return typeof obj['page'] === 'number';
}
