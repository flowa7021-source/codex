// @ts-check
// ─── View Transitions API ───────────────────────────────────────────────────
// Smooth page transitions using the View Transitions API.
// Falls back to direct DOM updates when the API is unavailable.

/**
 * Check whether the View Transitions API is available.
 * @returns {boolean}
 */
export function isViewTransitionsSupported() {
  return typeof document !== 'undefined' && 'startViewTransition' in document;
}

/**
 * Wrap a DOM-updating callback in a view transition.
 *
 * If the View Transitions API is available, the callback runs inside
 * `document.startViewTransition()`. Otherwise it is called directly.
 *
 * @param {() => void | Promise<void>} updateCallback — mutates the DOM
 * @param {{ classNames?: string[] }} [options]
 * @returns {Promise<void>}
 */
export async function withViewTransition(updateCallback, options) {
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
    // @ts-ignore — startViewTransition is not yet in all TS libs
    const transition = document.startViewTransition(updateCallback);
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
 * @param {() => void | Promise<void>} updateFn
 * @returns {Promise<void>}
 */
export function navigateToPage(updateFn) {
  return withViewTransition(updateFn, { classNames: ['page-nav'] });
}

/**
 * Crossfade view transition.
 * @param {() => void | Promise<void>} updateFn
 * @returns {Promise<void>}
 */
export function crossfade(updateFn) {
  return withViewTransition(updateFn, { classNames: ['crossfade'] });
}

/**
 * Slide-left view transition.
 * @param {() => void | Promise<void>} updateFn
 * @returns {Promise<void>}
 */
export function slideLeft(updateFn) {
  return withViewTransition(updateFn, { classNames: ['slide-left'] });
}

/**
 * Slide-right view transition.
 * @param {() => void | Promise<void>} updateFn
 * @returns {Promise<void>}
 */
export function slideRight(updateFn) {
  return withViewTransition(updateFn, { classNames: ['slide-right'] });
}
