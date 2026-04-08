// @ts-check
// ─── Touch Gesture Detection ─────────────────────────────────────────────────
// Utilities for detecting swipe, pinch, and long-press touch gestures.

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Whether touch events are supported in this environment.
 */
export function isTouchSupported(): boolean {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

/**
 * Attach a swipe gesture detector to an element.
 * Returns a cleanup function that removes all attached listeners.
 *
 * @param element  - The element to listen on
 * @param options  - Swipe callbacks and thresholds
 */
export function attachSwipeDetector(
  element: Element,
  options: {
    onSwipeLeft?: () => void;
    onSwipeRight?: () => void;
    onSwipeUp?: () => void;
    onSwipeDown?: () => void;
    threshold?: number;  // pixels, default 50
    maxTime?: number;    // ms, default 300
  },
): () => void {
  const threshold = options.threshold ?? 50;
  const maxTime   = options.maxTime   ?? 300;

  let startX = 0;
  let startY = 0;
  let startTime = 0;

  function onTouchStart(event: Event): void {
    const te = event as TouchEvent;
    const touch = te.touches[0];
    startX    = touch.clientX;
    startY    = touch.clientY;
    startTime = Date.now();
  }

  function onTouchEnd(event: Event): void {
    const te = event as TouchEvent;
    const touch = te.changedTouches[0];
    const elapsed = Date.now() - startTime;
    if (elapsed > maxTime) return;

    const dx = touch.clientX - startX;
    const dy = touch.clientY - startY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (absDx < threshold && absDy < threshold) return;

    if (absDx >= absDy) {
      // Horizontal swipe
      if (dx < 0) {
        options.onSwipeLeft?.();
      } else {
        options.onSwipeRight?.();
      }
    } else {
      // Vertical swipe
      if (dy < 0) {
        options.onSwipeUp?.();
      } else {
        options.onSwipeDown?.();
      }
    }
  }

  element.addEventListener('touchstart', onTouchStart);
  element.addEventListener('touchend',   onTouchEnd);

  return () => {
    element.removeEventListener('touchstart', onTouchStart);
    element.removeEventListener('touchend',   onTouchEnd);
  };
}

/**
 * Attach a pinch/zoom gesture detector to an element.
 * Returns a cleanup function that removes all attached listeners.
 *
 * @param element  - The element to listen on
 * @param options  - Pinch callbacks
 */
export function attachPinchDetector(
  element: Element,
  options: {
    onPinchIn?: (scale: number) => void;   // scale < 1
    onPinchOut?: (scale: number) => void;  // scale > 1
  },
): () => void {
  let initialDistance = 0;

  function _distance(t1: Touch, t2: Touch): number {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.hypot(dx, dy);
  }

  function onTouchStart(event: Event): void {
    const te = event as TouchEvent;
    if (te.touches.length === 2) {
      initialDistance = _distance(te.touches[0], te.touches[1]);
    }
  }

  function onTouchMove(event: Event): void {
    const te = event as TouchEvent;
    if (te.touches.length !== 2 || initialDistance === 0) return;

    const currentDistance = _distance(te.touches[0], te.touches[1]);
    const scale = currentDistance / initialDistance;

    if (scale < 1) {
      options.onPinchIn?.(scale);
    } else if (scale > 1) {
      options.onPinchOut?.(scale);
    }

    // Update for continuous tracking
    initialDistance = currentDistance;
  }

  function onTouchEnd(): void {
    initialDistance = 0;
  }

  element.addEventListener('touchstart', onTouchStart);
  element.addEventListener('touchmove',  onTouchMove);
  element.addEventListener('touchend',   onTouchEnd);

  return () => {
    element.removeEventListener('touchstart', onTouchStart);
    element.removeEventListener('touchmove',  onTouchMove);
    element.removeEventListener('touchend',   onTouchEnd);
  };
}

/**
 * Attach a long-press gesture detector to an element.
 * Returns a cleanup function that removes all attached listeners.
 *
 * @param element  - The element to listen on
 * @param callback - Called when a long press is detected
 * @param delayMs  - Duration before firing, default 500ms
 */
export function attachLongPress(
  element: Element,
  callback: () => void,
  delayMs: number = 500,
): () => void {
  let timerId: ReturnType<typeof setTimeout> | null = null;

  function cancel(): void {
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
  }

  function onTouchStart(event: Event): void {
    void event;
    cancel();
    timerId = setTimeout(() => {
      timerId = null;
      callback();
    }, delayMs);
  }

  function onTouchEnd(): void {
    cancel();
  }

  function onTouchMove(): void {
    cancel();
  }

  element.addEventListener('touchstart', onTouchStart);
  element.addEventListener('touchend',   onTouchEnd);
  element.addEventListener('touchmove',  onTouchMove);

  return () => {
    cancel();
    element.removeEventListener('touchstart', onTouchStart);
    element.removeEventListener('touchend',   onTouchEnd);
    element.removeEventListener('touchmove',  onTouchMove);
  };
}
