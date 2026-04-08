// @ts-check
// ─── Scroll Manager ──────────────────────────────────────────────────────────
// Utilities for scrolling elements/window, tracking scroll positions, and
// subscribing to scroll events with optional throttling.

const _savedPositions = new Map<string, { x: number; y: number }>();

/**
 * Scroll an element to a position with optional smooth behavior.
 */
export function scrollTo(
  element: Element | Window,
  options: { top?: number; left?: number; behavior?: 'smooth' | 'instant' | 'auto' },
): void {
  if (typeof (element as Window | Element & { scrollTo?: unknown }).scrollTo === 'function') {
    (element as Window).scrollTo(options as ScrollToOptions);
  } else {
    const el = element as Element;
    if (options.top !== undefined) (el as HTMLElement).scrollTop = options.top;
    if (options.left !== undefined) (el as HTMLElement).scrollLeft = options.left;
  }
}

/**
 * Scroll an element by a delta with optional smooth behavior.
 */
export function scrollBy(
  element: Element | Window,
  options: { top?: number; left?: number; behavior?: 'smooth' | 'instant' | 'auto' },
): void {
  if (typeof (element as Window | Element & { scrollBy?: unknown }).scrollBy === 'function') {
    (element as Window).scrollBy(options as ScrollToOptions);
  } else {
    const el = element as HTMLElement;
    if (options.top !== undefined) el.scrollTop += options.top;
    if (options.left !== undefined) el.scrollLeft += options.left;
  }
}

/**
 * Get the current scroll position of an element or window.
 */
export function getScrollPosition(element?: Element | Window): { x: number; y: number } {
  const target = element ?? globalThis.window;
  if (!target) return { x: 0, y: 0 };

  // Window / global
  if (target === globalThis.window || (target as Window).scrollX !== undefined) {
    const win = target as Window;
    return { x: win.scrollX ?? 0, y: win.scrollY ?? 0 };
  }

  const el = target as HTMLElement;
  return { x: el.scrollLeft ?? 0, y: el.scrollTop ?? 0 };
}

/**
 * Scroll an element into view.
 */
export function scrollIntoView(element: Element, options?: ScrollIntoViewOptions): void {
  if (typeof element.scrollIntoView === 'function') {
    element.scrollIntoView(options);
  }
}

/**
 * Subscribe to scroll events on an element.
 * Returns an unsubscribe function.
 */
export function onScroll(
  element: Element | Window,
  callback: (x: number, y: number) => void,
  options?: { passive?: boolean; throttleMs?: number },
): () => void {
  const throttleMs = options?.throttleMs ?? 0;
  const passive = options?.passive ?? true;

  let pending = false;
  let lastX = 0;
  let lastY = 0;

  const handler = () => {
    const pos = getScrollPosition(element);
    lastX = pos.x;
    lastY = pos.y;

    if (throttleMs > 0) {
      if (!pending) {
        pending = true;
        setTimeout(() => {
          pending = false;
          callback(lastX, lastY);
        }, throttleMs);
      }
    } else {
      callback(lastX, lastY);
    }
  };

  element.addEventListener('scroll', handler, { passive } as AddEventListenerOptions);

  return () => {
    element.removeEventListener('scroll', handler);
  };
}

/**
 * Save the current scroll position for a key.
 */
export function saveScrollPosition(key: string, element?: Element | Window): void {
  const pos = getScrollPosition(element);
  _savedPositions.set(key, pos);
}

/**
 * Restore a previously saved scroll position.
 * Returns true if restored, false if no saved position.
 */
export function restoreScrollPosition(key: string, element?: Element | Window): boolean {
  const pos = _savedPositions.get(key);
  if (!pos) return false;
  const target = element ?? globalThis.window;
  scrollTo(target, { top: pos.y, left: pos.x });
  return true;
}
