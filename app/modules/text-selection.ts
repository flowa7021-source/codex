// @ts-check
// ─── Text Selection Management ───────────────────────────────────────────────
// Utility functions for working with the browser's text selection API.

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Get the current text selection as a string.
 * Returns empty string if no selection.
 */
export function getSelectedText(): string {
  return window.getSelection()?.toString() ?? '';
}

/**
 * Get the bounding rectangle of the current selection.
 * Returns null if no selection.
 */
export function getSelectionBounds(): DOMRect | null {
  try {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;
    return selection.getRangeAt(0).getBoundingClientRect();
  } catch {
    return null;
  }
}

/**
 * Clear the current text selection.
 */
export function clearSelection(): void {
  window.getSelection()?.removeAllRanges();
}

/**
 * Select all text within an element.
 */
export function selectAllIn(element: Element): void {
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  range.selectNodeContents(element);
  selection.removeAllRanges();
  selection.addRange(range);
}

/**
 * Whether the current selection is within a given element.
 */
export function isSelectionIn(element: Element): boolean {
  const selection = window.getSelection();
  if (!selection || !selection.anchorNode) return false;
  return element.contains(selection.anchorNode);
}

/**
 * Subscribe to selection change events.
 * Returns an unsubscribe function.
 */
export function onSelectionChange(
  callback: (text: string, hasBounds: boolean) => void,
): () => void {
  const handler = () => {
    const text = getSelectedText();
    const bounds = getSelectionBounds();
    callback(text, bounds !== null);
  };
  document.addEventListener('selectionchange', handler);
  return () => document.removeEventListener('selectionchange', handler);
}
