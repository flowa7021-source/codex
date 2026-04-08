// ─── Event Bus ──────────────────────────────────────────────────────────────
// Decoupled inter-module communication. Modules emit events; others subscribe.
// This replaces direct function calls between unrelated modules.

const _bus = new EventTarget();

let _listeners: Array<{ event: string; wrapper: EventListener }> = [];

/**
 * Emit a named event with optional detail payload.
 * @param event - Event name, e.g. 'ocr:page-done', 'file:opened'
 */
export function emit(event: string, detail?: unknown): void {
  _bus.dispatchEvent(new CustomEvent(event, { detail }));
}

/**
 * Subscribe to a named event.
 * @returns unsubscribe function
 */
export function on(event: string, handler: (detail: unknown) => void): () => void {
  const wrapper = (e: Event) => handler((e as CustomEvent).detail);
  _bus.addEventListener(event, wrapper);
  _listeners.push({ event, wrapper });
  return () => {
    _bus.removeEventListener(event, wrapper);
    _listeners = _listeners.filter(l => l.wrapper !== wrapper);
  };
}

/**
 * Subscribe to a named event, but only fire once.
 * @returns unsubscribe function
 */
export function once(event: string, handler: (detail: unknown) => void): () => void {
  const wrapper = (e: Event) => handler((e as CustomEvent).detail);
  _bus.addEventListener(event, wrapper, { once: true });
  _listeners.push({ event, wrapper });
  return () => {
    _bus.removeEventListener(event, wrapper);
    _listeners = _listeners.filter(l => l.wrapper !== wrapper);
  };
}

/**
 * Subscribe with tracking for bulk removal.
 * @returns unsubscribe
 */
export function subscribe(event: string, handler: (detail: unknown) => void): () => void {
  const wrapper = (e: Event) => handler((e as CustomEvent).detail);
  _bus.addEventListener(event, wrapper);
  _listeners.push({ event, wrapper });
  return () => {
    _bus.removeEventListener(event, wrapper);
    _listeners = _listeners.filter(l => l.wrapper !== wrapper);
  };
}

/**
 * Remove all tracked subscriptions.
 */
export function removeAllListeners(): void {
  const toRemove = [..._listeners];
  _listeners = [];
  for (const { event, wrapper } of toRemove) {
    _bus.removeEventListener(event, wrapper);
  }
}
