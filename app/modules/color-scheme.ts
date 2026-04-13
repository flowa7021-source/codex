// @ts-check
// ─── Color Scheme / Dark Mode Detection ──────────────────────────────────────
// Utilities for detecting and observing the user's preferred color scheme
// and other accessibility media query preferences.

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Whether the prefers-color-scheme media query is supported.
 */
export function isColorSchemeSupportedByMedia(): boolean {
  return 'matchMedia' in window;
}

/**
 * Get the current color scheme preference.
 * Returns 'dark' | 'light' | 'no-preference'
 */
export function getColorScheme(): 'dark' | 'light' | 'no-preference' {
  try {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
    if (window.matchMedia('(prefers-color-scheme: light)').matches) return 'light';
  } catch {
    // silently ignore
  }
  return 'no-preference';
}

/**
 * Whether the user prefers dark mode.
 */
export function prefersDark(): boolean {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

/**
 * Whether the user prefers light mode.
 */
export function prefersLight(): boolean {
  try {
    return window.matchMedia('(prefers-color-scheme: light)').matches;
  } catch {
    return false;
  }
}

/**
 * Whether the user prefers reduced motion.
 */
export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/**
 * Whether the user prefers reduced transparency.
 */
export function prefersReducedTransparency(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-transparency: reduce)').matches;
  } catch {
    return false;
  }
}

/**
 * Whether the user prefers high contrast.
 */
export function prefersHighContrast(): boolean {
  try {
    return window.matchMedia('(prefers-contrast: more)').matches;
  } catch {
    return false;
  }
}

/**
 * Subscribe to color scheme changes.
 * Returns an unsubscribe function.
 */
export function onColorSchemeChange(
  callback: (scheme: 'dark' | 'light' | 'no-preference') => void,
): () => void {
  try {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      callback(getColorScheme());
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  } catch {
    return () => {};
  }
}
