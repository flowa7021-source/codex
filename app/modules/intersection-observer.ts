// ─── Intersection Observer ────────────────────────────────────────────────────
// Wrapper for the IntersectionObserver API for lazy loading and visibility
// detection, with a synchronous fallback for environments without support.

// @ts-check

/**
 * Whether IntersectionObserver is supported.
 */
export function isIntersectionObserverSupported(): boolean {
  return typeof IntersectionObserver !== 'undefined';
}

/**
 * Observe an element and call the callback when its intersection changes.
 * Returns a stop/unobserve function.
 *
 * Falls back to immediately calling callback with (true, 1.0) when
 * IntersectionObserver is not supported.
 *
 * @param element - The element to observe
 * @param callback - Called with (isIntersecting, ratio, entry)
 * @param options - Optional IntersectionObserver options
 */
export function observeIntersection(
  element: Element,
  callback: (isIntersecting: boolean, ratio: number, entry: IntersectionObserverEntry) => void,
  options?: IntersectionObserverInit,
): () => void {
  if (!isIntersectionObserverSupported()) {
    // Fallback: treat everything as immediately visible
    const fakeEntry = {
      target: element,
      isIntersecting: true,
      intersectionRatio: 1.0,
      boundingClientRect: {} as DOMRectReadOnly,
      intersectionRect: {} as DOMRectReadOnly,
      rootBounds: null,
      time: 0,
    } as IntersectionObserverEntry;
    callback(true, 1.0, fakeEntry);
    return () => {};
  }

  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      callback(entry.isIntersecting, entry.intersectionRatio, entry);
    }
  }, options);

  observer.observe(element);

  return () => {
    observer.unobserve(element);
    observer.disconnect();
  };
}

/**
 * Create a lazy-load observer that calls onVisible when an element first
 * becomes visible. Automatically unobserves after first trigger (one-shot).
 * Returns an unobserve function.
 *
 * Falls back to calling onVisible() immediately when IntersectionObserver is
 * not supported.
 *
 * @param element - The element to watch
 * @param onVisible - Called once when the element first intersects
 * @param threshold - Intersection ratio threshold (default 0)
 */
export function lazyLoad(
  element: Element,
  onVisible: () => void,
  threshold: number = 0,
): () => void {
  if (!isIntersectionObserverSupported()) {
    onVisible();
    return () => {};
  }

  let stopped = false;
  let stop: (() => void) | null = null;

  stop = observeIntersection(
    element,
    (isIntersecting) => {
      if (stopped) return;
      if (isIntersecting) {
        stopped = true;
        if (stop) stop();
        onVisible();
      }
    },
    { threshold },
  );

  return () => {
    stopped = true;
    if (stop) stop();
  };
}

/**
 * Observe multiple elements with a single shared observer.
 * Returns a stop function that disconnects the observer.
 *
 * Falls back to calling callback immediately with (element, true) for each
 * element when IntersectionObserver is not supported.
 *
 * @param elements - Elements to observe
 * @param callback - Called with (element, isIntersecting) on each change
 * @param options - Optional IntersectionObserver options
 */
export function observeMany(
  elements: Element[],
  callback: (element: Element, isIntersecting: boolean) => void,
  options?: IntersectionObserverInit,
): () => void {
  if (!isIntersectionObserverSupported()) {
    for (const element of elements) {
      callback(element, true);
    }
    return () => {};
  }

  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      callback(entry.target, entry.isIntersecting);
    }
  }, options);

  for (const element of elements) {
    observer.observe(element);
  }

  return () => {
    observer.disconnect();
  };
}
