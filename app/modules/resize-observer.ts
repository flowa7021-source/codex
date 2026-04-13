// ─── Resize Observer ──────────────────────────────────────────────────────────
// Wrapper for the ResizeObserver API for tracking element and document size
// changes, with support for one-shot element measurement.

/**
 * Whether ResizeObserver is supported.
 */
export function isResizeObserverSupported(): boolean {
  return typeof ResizeObserver !== 'undefined';
}

/**
 * Observe an element's size changes.
 * Returns a stop function that disconnects the observer.
 *
 * @param element - The element to observe
 * @param callback - Called with (width, height, entry) on each resize
 * @param options - Optional ResizeObserver options (box model)
 */
export function observeResize(
  element: Element,
  callback: (width: number, height: number, entry: ResizeObserverEntry) => void,
  options?: ResizeObserverOptions,
): () => void {
  if (!isResizeObserverSupported()) {
    return () => {};
  }

  const observer = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const rect = entry.contentRect;
      callback(rect.width, rect.height, entry);
    }
  });

  observer.observe(element, options);

  return () => {
    observer.unobserve(element);
    observer.disconnect();
  };
}

/**
 * Observe the document's root element size changes (window resize equivalent).
 * Returns a stop function.
 *
 * @param callback - Called with (width, height) on each resize
 */
export function observeDocumentResize(
  callback: (width: number, height: number) => void,
): () => void {
  return observeResize(document.documentElement, callback);
}

/**
 * Get an element's current size via ResizeObserver (one-shot measurement).
 * Resolves with { width, height } on first observation, then disconnects.
 * Returns null if ResizeObserver is not supported.
 *
 * @param element - The element to measure
 */
export function measureElement(element: Element): Promise<{ width: number; height: number } | null> {
  if (!isResizeObserverSupported()) {
    return Promise.resolve(null);
  }

  return new Promise<{ width: number; height: number }>((resolve) => {
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const rect = entry.contentRect;
        observer.disconnect();
        resolve({ width: rect.width, height: rect.height });
      }
    });

    observer.observe(element);
  });
}
