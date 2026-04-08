// ─── View Transitions API ───────────────────────────────────────────────────
// Smooth page transitions using the View Transitions API.
// Falls back to direct DOM updates when the API is unavailable.

// ViewTransition is not yet in all TS libs
declare const document: Document & {
  startViewTransition?: (callback: () => void | Promise<void>) => { finished: Promise<void> };
};

/**
 * Check whether the View Transitions API is available.
 */
export function isViewTransitionsSupported(): boolean {
  return typeof document !== 'undefined' && 'startViewTransition' in document;
}

/**
 * Wrap a DOM-updating callback in a view transition.
 *
 * If the View Transitions API is available, the callback runs inside
 * `document.startViewTransition()`. Otherwise it is called directly.
 */
export async function withViewTransition(
  updateCallback: () => void | Promise<void>,
  options?: { classNames?: string[] }
): Promise<void> {
  if (!isViewTransitionsSupported()) {
    await updateCallback();
    return;
  }

  const classNames = options?.classNames ?? [];
  const root = document.documentElement;

  // Add transition class names to the root element
  for (const cls of classNames) {
    root.classList.add(cls);
  }

  try {
    const transition = document.startViewTransition!(updateCallback);
    await transition.finished;
  } finally {
    // Always clean up class names, even if the transition fails
    for (const cls of classNames) {
      root.classList.remove(cls);
    }
  }
}

/**
 * Navigate to a page with a page-nav view transition.
 */
export function navigateToPage(updateFn: () => void | Promise<void>): Promise<void> {
  return withViewTransition(updateFn, { classNames: ['page-nav'] });
}

/**
 * Crossfade view transition.
 */
export function crossfade(updateFn: () => void | Promise<void>): Promise<void> {
  return withViewTransition(updateFn, { classNames: ['crossfade'] });
}

/**
 * Slide-left view transition.
 */
export function slideLeft(updateFn: () => void | Promise<void>): Promise<void> {
  return withViewTransition(updateFn, { classNames: ['slide-left'] });
}

/**
 * Slide-right view transition.
 */
export function slideRight(updateFn: () => void | Promise<void>): Promise<void> {
  return withViewTransition(updateFn, { classNames: ['slide-right'] });
}
