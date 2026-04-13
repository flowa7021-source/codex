// ─── Page Visibility API ─────────────────────────────────────────────────────
// Page Visibility API wrapper for detecting when the page is hidden or visible.

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Whether the Page Visibility API is supported.
 */
export function isPageVisibilitySupported(): boolean {
  return 'hidden' in document;
}

/**
 * Whether the page is currently hidden.
 */
export function isPageHidden(): boolean {
  return document.hidden ?? false;
}

/**
 * Current visibility state: 'visible' | 'hidden' | 'prerender'
 */
export function getVisibilityState(): 'visible' | 'hidden' | 'prerender' {
  return (document.visibilityState ?? 'visible') as 'visible' | 'hidden' | 'prerender';
}

/**
 * Register a callback for visibility changes.
 * Returns an unsubscribe function.
 *
 * @param callback - Called with (hidden, state) whenever the visibility changes
 */
export function onVisibilityChange(
  callback: (hidden: boolean, state: string) => void,
): () => void {
  const handler = () => {
    callback(document.hidden, document.visibilityState);
  };
  document.addEventListener('visibilitychange', handler);
  return () => {
    document.removeEventListener('visibilitychange', handler);
  };
}
