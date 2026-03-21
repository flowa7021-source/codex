// @ts-check
// ─── Event Bus ──────────────────────────────────────────────────────────────
// Decoupled inter-module communication. Modules emit events; others subscribe.
// This replaces direct function calls between unrelated modules.

/** @type {EventTarget} */
const _bus = new EventTarget();

/** @type {Array<{event: string, wrapper: EventListener}>} */
let _listeners = [];

/**
 * Emit a named event with optional detail payload.
 * @param {string} event - Event name, e.g. 'ocr:page-done', 'file:opened'
 * @param {object} [detail] - Arbitrary data
 */
export function emit(event, detail) {
  _bus.dispatchEvent(new CustomEvent(event, { detail }));
}

/**
 * Subscribe to a named event.
 * @param {string} event
 * @param {(detail: any) => void} handler
 * @returns {() => void} unsubscribe function
 */
export function on(event, handler) {
  const wrapper = (e) => handler(e.detail);
  _bus.addEventListener(event, wrapper);
  _listeners.push({ event, wrapper });
  return () => {
    _bus.removeEventListener(event, wrapper);
    _listeners = _listeners.filter(l => l.wrapper !== wrapper);
  };
}

/**
 * Subscribe to a named event, but only fire once.
 * @param {string} event
 * @param {(detail: any) => void} handler
 * @returns {() => void} unsubscribe function
 */
export function once(event, handler) {
  const wrapper = (e) => handler(e.detail);
  _bus.addEventListener(event, wrapper, { once: true });
  _listeners.push({ event, wrapper });
  return () => {
    _bus.removeEventListener(event, wrapper);
    _listeners = _listeners.filter(l => l.wrapper !== wrapper);
  };
}

/**
 * Subscribe with tracking for bulk removal.
 * @param {string} event
 * @param {(detail: any) => void} handler
 * @returns {() => void} unsubscribe
 */
export function subscribe(event, handler) {
  const wrapper = (e) => handler(e.detail);
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
export function removeAllListeners() {
  for (const { event, wrapper } of _listeners) {
    _bus.removeEventListener(event, wrapper);
  }
  _listeners = [];
}
