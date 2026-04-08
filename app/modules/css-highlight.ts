// ─── CSS Custom Highlight API ─────────────────────────────────────────────────
// Wrapper for the CSS Custom Highlight API for programmatic text highlighting.

// @ts-check

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Whether the CSS Custom Highlight API is supported.
 */
export function isCSSHighlightSupported(): boolean {
  return typeof (globalThis as any).Highlight !== 'undefined' && 'highlights' in CSS;
}

/**
 * Create or update a named highlight from an array of ranges.
 * Returns true on success, false if unsupported.
 */
export function setHighlight(name: string, ranges: Range[]): boolean {
  if (!isCSSHighlightSupported()) return false;
  try {
    const highlight = new (globalThis as any).Highlight(...ranges);
    (CSS as any).highlights.set(name, highlight);
    return true;
  } catch {
    return false;
  }
}

/**
 * Remove a named highlight.
 * Returns true on success.
 */
export function removeHighlight(name: string): boolean {
  if (!isCSSHighlightSupported()) return false;
  try {
    (CSS as any).highlights.delete(name);
    return true;
  } catch {
    return false;
  }
}

/**
 * Remove all highlights.
 */
export function clearHighlights(): void {
  if (!isCSSHighlightSupported()) return;
  try {
    (CSS as any).highlights.clear();
  } catch {
    // silently ignore
  }
}

/**
 * Get the names of all registered highlights.
 */
export function getHighlightNames(): string[] {
  if (!isCSSHighlightSupported()) return [];
  try {
    return [...(CSS as any).highlights.keys()];
  } catch {
    return [];
  }
}

/**
 * Highlight search matches in a text node.
 * Creates Range objects for each match of the query string in the node.
 * Returns the highlight name used, or null if no matches or unsupported.
 */
export function highlightTextMatches(
  node: Text,
  query: string,
  highlightName: string = 'search-highlight',
): string | null {
  if (!isCSSHighlightSupported()) return null;
  if (!query) return null;

  const text = node.textContent ?? '';
  if (!text) return null;

  const ranges: Range[] = [];
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  let offset = 0;

  while (offset < lowerText.length) {
    const index = lowerText.indexOf(lowerQuery, offset);
    if (index === -1) break;

    const range = document.createRange();
    range.setStart(node, index);
    range.setEnd(node, index + query.length);
    ranges.push(range as Range);

    offset = index + query.length;
  }

  if (ranges.length === 0) return null;

  const success = setHighlight(highlightName, ranges);
  return success ? highlightName : null;
}
