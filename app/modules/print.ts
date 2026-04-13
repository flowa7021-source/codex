// @ts-check
// ─── Window Print / Before-After-Print Hooks ─────────────────────────────────
// Utilities for triggering the browser print dialog and registering
// before/after print lifecycle callbacks.

// ─── Module-level state ──────────────────────────────────────────────────────

let _isPrinting = false;
let _printStateInitialized = false;

/** Initialize the beforeprint/afterprint listeners once. */
function _ensurePrintStateListeners(): void {
  if (_printStateInitialized) return;
  _printStateInitialized = true;
  window.addEventListener('beforeprint', () => { _isPrinting = true; });
  window.addEventListener('afterprint', () => { _isPrinting = false; });
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Trigger the browser print dialog.
 */
export function printPage(): void {
  if (typeof window !== 'undefined' && typeof (window as any).print === 'function') {
    (window as any).print();
  }
}

/**
 * Register a callback to run before the print dialog opens.
 * Returns an unsubscribe function.
 */
export function onBeforePrint(callback: () => void): () => void {
  window.addEventListener('beforeprint', callback);
  return () => window.removeEventListener('beforeprint', callback);
}

/**
 * Register a callback to run after the print dialog closes.
 * Returns an unsubscribe function.
 */
export function onAfterPrint(callback: () => void): () => void {
  window.addEventListener('afterprint', callback);
  return () => window.removeEventListener('afterprint', callback);
}

/**
 * Whether the page is currently being printed (between beforeprint and afterprint).
 */
export function isPrinting(): boolean {
  _ensurePrintStateListeners();
  return _isPrinting;
}

/**
 * Set CSS that applies only during printing using a <style> element.
 * Returns a cleanup function that removes the style.
 */
export function applyPrintStyles(css: string): () => void {
  const style = document.createElement('style');
  style.textContent = `@media print { ${css} }`;
  document.head.appendChild(style);
  return () => style.remove();
}

/**
 * Hide elements matching the selector from print output.
 * Returns a cleanup function.
 */
export function hideDuringPrint(selector: string): () => void {
  return applyPrintStyles(`${selector} { display: none !important; }`);
}
