// @ts-check
// ─── Virtual List ─────────────────────────────────────────────────────────────
// Pure calculation utilities for virtual scrolling (no DOM dependency).

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VirtualListOptions {
  itemHeight: number;       // fixed height per item in px
  containerHeight: number;  // visible container height in px
  itemCount: number;        // total number of items
  overscan?: number;        // extra items to render above/below (default 3)
}

export interface VirtualListState {
  startIndex: number;   // first item to render
  endIndex: number;     // last item to render (exclusive)
  offsetY: number;      // top padding in px (for positioning)
  totalHeight: number;  // total scroll height
  visibleCount: number; // number of visible items
}

// ─── Public API ──────────────────────────────────────────────────────────────

/** Calculate which items to render based on scroll position. */
export function calculateVirtualRange(
  options: VirtualListOptions,
  scrollTop: number,
): VirtualListState {
  const { itemHeight, containerHeight, itemCount, overscan = 3 } = options;
  const totalHeight = itemHeight * itemCount;
  const visibleCount = Math.ceil(containerHeight / itemHeight);

  const rawStart = Math.floor(scrollTop / itemHeight);
  const startIndex = Math.max(0, rawStart - overscan);
  const rawEnd = rawStart + visibleCount;
  const endIndex = Math.min(itemCount, rawEnd + overscan);

  const offsetY = startIndex * itemHeight;

  return { startIndex, endIndex, offsetY, totalHeight, visibleCount };
}

/** Calculate scroll position to bring an item into view. */
export function scrollToItem(
  options: VirtualListOptions,
  itemIndex: number,
  align: 'start' | 'center' | 'end' = 'start',
): number {
  const { itemHeight, containerHeight, itemCount } = options;
  const clampedIndex = Math.max(0, Math.min(itemCount - 1, itemIndex));
  const itemTop = clampedIndex * itemHeight;

  let scrollTop: number;
  if (align === 'start') {
    scrollTop = itemTop;
  } else if (align === 'center') {
    scrollTop = itemTop - (containerHeight - itemHeight) / 2;
  } else {
    // 'end'
    scrollTop = itemTop - containerHeight + itemHeight;
  }

  const maxScroll = Math.max(0, itemCount * itemHeight - containerHeight);
  return Math.max(0, Math.min(maxScroll, scrollTop));
}

/** Variable-height virtual list calculation.
 *  itemHeights: array of heights for each item.
 */
export function calculateVariableVirtualRange(
  itemHeights: number[],
  containerHeight: number,
  scrollTop: number,
  overscan = 3,
): VirtualListState {
  const itemCount = itemHeights.length;

  // Build cumulative offsets
  const offsets: number[] = new Array(itemCount + 1);
  offsets[0] = 0;
  for (let i = 0; i < itemCount; i++) {
    offsets[i + 1] = offsets[i] + itemHeights[i];
  }
  const totalHeight = offsets[itemCount];

  // Find first visible item (last item whose offset <= scrollTop)
  let rawStart = 0;
  for (let i = 0; i < itemCount; i++) {
    if (offsets[i] <= scrollTop) rawStart = i;
    else break;
  }

  // Find last visible item
  const scrollBottom = scrollTop + containerHeight;
  let rawEnd = rawStart;
  for (let i = rawStart; i < itemCount; i++) {
    rawEnd = i;
    if (offsets[i + 1] >= scrollBottom) break;
  }

  const startIndex = Math.max(0, rawStart - overscan);
  const endIndex = Math.min(itemCount, rawEnd + 1 + overscan);
  const offsetY = offsets[startIndex];

  // Count fully visible items
  let visibleCount = 0;
  for (let i = 0; i < itemCount; i++) {
    if (offsets[i] >= scrollTop && offsets[i + 1] <= scrollBottom) visibleCount++;
  }

  return { startIndex, endIndex, offsetY, totalHeight, visibleCount };
}

/** Get the item index at a given scroll position (fixed height). */
export function getItemAtScrollPosition(
  options: VirtualListOptions,
  scrollTop: number,
): number {
  const { itemHeight, itemCount } = options;
  const index = Math.floor(scrollTop / itemHeight);
  return Math.max(0, Math.min(itemCount - 1, index));
}
