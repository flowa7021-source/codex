// ─── Pointer Events API ───────────────────────────────────────────────────────
// Wraps the Pointer Events API to provide unified mouse/touch/stylus input
// handling for PDF annotations and drawing tools.

export type PointerType = 'mouse' | 'touch' | 'pen' | 'unknown';

export interface PointerPoint {
  x: number;
  y: number;
  pressure: number;    // 0–1
  tiltX: number;       // -90 to 90 degrees
  tiltY: number;
  pointerType: PointerType;
  pointerId: number;
  isPrimary: boolean;
  width: number;       // contact area width
  height: number;      // contact area height
}

export interface PointerHandlers {
  onDown?: (point: PointerPoint) => void;
  onMove?: (point: PointerPoint) => void;
  onUp?: (point: PointerPoint) => void;
  onCancel?: (point: PointerPoint) => void;
}

// ─── Module-level active pointer state ───────────────────────────────────────

const _activePointers = new Map<number, PointerPoint>();

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Whether the Pointer Events API is available in this environment.
 */
export function isPointerEventsSupported(): boolean {
  return 'PointerEvent' in globalThis;
}

/**
 * Convert a PointerEvent to a PointerPoint.
 * Normalizes pointerType to 'mouse' | 'touch' | 'pen' | 'unknown'.
 */
export function eventToPoint(event: PointerEvent): PointerPoint {
  let pointerType: PointerType;
  if (event.pointerType === 'mouse' || event.pointerType === 'touch' || event.pointerType === 'pen') {
    pointerType = event.pointerType;
  } else {
    pointerType = 'unknown';
  }

  return {
    x: event.clientX,
    y: event.clientY,
    pressure: event.pressure,
    tiltX: event.tiltX,
    tiltY: event.tiltY,
    pointerType,
    pointerId: event.pointerId,
    isPrimary: event.isPrimary,
    width: event.width,
    height: event.height,
  };
}

/**
 * Attach pointer event handlers to an element.
 * Manages pointer capture and active pointer tracking.
 * Returns a detach function that removes all attached listeners.
 *
 * @param element - Target element
 * @param handlers - Object with optional onDown/onMove/onUp/onCancel callbacks
 * @returns Detach function
 */
export function attachPointerHandlers(element: Element, handlers: PointerHandlers): () => void {
  const onPointerDown = (event: Event): void => {
    const pe = event as PointerEvent;
    try {
      element.setPointerCapture(pe.pointerId);
    } catch {
      // Element may not be in the DOM yet; ignore capture failure
    }
    const point = eventToPoint(pe);
    _activePointers.set(pe.pointerId, point);
    handlers.onDown?.(point);
  };

  const onPointerMove = (event: Event): void => {
    const pe = event as PointerEvent;
    const point = eventToPoint(pe);
    _activePointers.set(pe.pointerId, point);
    handlers.onMove?.(point);
  };

  const onPointerUp = (event: Event): void => {
    const pe = event as PointerEvent;
    const point = eventToPoint(pe);
    _activePointers.delete(pe.pointerId);
    handlers.onUp?.(point);
  };

  const onPointerCancel = (event: Event): void => {
    const pe = event as PointerEvent;
    const point = eventToPoint(pe);
    _activePointers.delete(pe.pointerId);
    handlers.onCancel?.(point);
  };

  element.addEventListener('pointerdown', onPointerDown);
  element.addEventListener('pointermove', onPointerMove);
  element.addEventListener('pointerup', onPointerUp);
  element.addEventListener('pointercancel', onPointerCancel);

  return () => {
    element.removeEventListener('pointerdown', onPointerDown);
    element.removeEventListener('pointermove', onPointerMove);
    element.removeEventListener('pointerup', onPointerUp);
    element.removeEventListener('pointercancel', onPointerCancel);
  };
}

/**
 * Returns all currently active (tracked) pointers for the given element.
 * The active pointer map is maintained via pointermove/pointerup events
 * wired by attachPointerHandlers.
 *
 * Note: The module-level map tracks pointers across all elements; this
 * function returns a snapshot of all currently active pointers.
 */
export function getActivePointers(_element: Element): PointerPoint[] {
  return Array.from(_activePointers.values());
}

/**
 * Returns true when the pointer type is a stylus/pen.
 */
export function isPenInput(point: PointerPoint): boolean {
  return point.pointerType === 'pen';
}

/**
 * Returns true when the pointer type is touch (finger).
 */
export function isTouchInput(point: PointerPoint): boolean {
  return point.pointerType === 'touch';
}
