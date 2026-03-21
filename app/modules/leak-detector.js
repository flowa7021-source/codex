// ─── Memory Leak Detector (dev mode) ────────────────────────────────────────
// Activate by setting localStorage 'novareader-dev-mode' to '1'.
// Usage: import { installLeakDetector, getLeakReport } from './leak-detector.js';

import { els } from './state.js';

const listenerMap = new Map();   // target -> Map<type+capture, Set<{handler, stack}>>
const unrevokedUrls = new Set();
let liveCanvasCount = 0;
let installed = false;

function listenerKey(type, options) {
  const capture = typeof options === 'boolean' ? options
    : (options && options.capture) ? true : false;
  return `${type}:${capture}`;
}

function trackTarget(target, label) {
  if (!listenerMap.has(target)) {
    listenerMap.set(target, { label, events: new Map() });
  }
}

function patchEventTarget(target, label) {
  trackTarget(target, label);
  const entry = listenerMap.get(target);
  const origAdd = target.addEventListener.bind(target);
  const origRemove = target.removeEventListener.bind(target);

  target.addEventListener = function (type, handler, options) {
    const key = listenerKey(type, options);
    if (!entry.events.has(key)) entry.events.set(key, new Set());
    entry.events.get(key).add(handler);
    return origAdd(type, handler, options);
  };

  target.removeEventListener = function (type, handler, options) {
    const key = listenerKey(type, options);
    const set = entry.events.get(key);
    if (set) set.delete(handler);
    return origRemove(type, handler, options);
  };
}

function patchObjectURL() {
  const origCreate = URL.createObjectURL.bind(URL);
  const origRevoke = URL.revokeObjectURL.bind(URL);

  URL.createObjectURL = function (blob) {
    const url = origCreate(blob);
    unrevokedUrls.add(url);
    return url;
  };

  URL.revokeObjectURL = function (url) {
    unrevokedUrls.delete(url);
    return origRevoke(url);
  };
}

function patchCreateElement() {
  const origCreate = document.createElement.bind(document);

  document.createElement = function (tagName, options) {
    const el = origCreate(tagName, options);
    if (tagName.toLowerCase() === 'canvas') {
      liveCanvasCount++;
      const origRemove = el.remove.bind(el);
      let counted = true;
      el.remove = function () {
        if (counted) { liveCanvasCount--; counted = false; }
        return origRemove();
      };
    }
    return el;
  };
}

/**
 * Install monkey-patches on common targets. Safe to call multiple times (no-op after first).
 */
export function installLeakDetector() {
  if (installed) return;
  if (typeof localStorage === 'undefined') return;
  if (localStorage.getItem('novareader-dev-mode') !== '1') return;
  installed = true;

  // Patch event listeners on common targets
  patchEventTarget(document, 'document');
  patchEventTarget(window, 'window');
  if (els.canvas) patchEventTarget(els.canvas, 'els.canvas');
  if (els.canvasWrap) patchEventTarget(els.canvasWrap, 'els.canvasWrap');

  // Patch URL object-url tracking
  patchObjectURL();

  // Patch canvas allocation tracking
  patchCreateElement();


  console.info('[LeakDetector] installed — call getLeakReport() to inspect');
}

/**
 * Returns a snapshot of potential leaks.
 */
export function getLeakReport() {
  const unremovedListeners = [];
  for (const [, { label, events }] of listenerMap) {
    for (const [key, handlers] of events) {
      if (handlers.size > 0) {
        const [type, capture] = key.split(':');
        unremovedListeners.push({
          target: label,
          type,
          capture: capture === 'true',
          count: handlers.size,
        });
      }
    }
  }

  return {
    unremovedListeners,
    unrevokedUrls: [...unrevokedUrls],
    liveCanvases: liveCanvasCount,
  };
}
