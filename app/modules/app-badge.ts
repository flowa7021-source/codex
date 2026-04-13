// ─── App Badge API ────────────────────────────────────────────────────────────
// App Badge API wrapper for showing unread document count on the app icon.

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Whether the App Badge API is available in this environment.
 */
export function isBadgeSupported(): boolean {
  return 'setAppBadge' in navigator;
}

/**
 * Sets the app badge. Pass a count to display a number, or omit for a dot badge.
 * No-op if the API is unsupported. Silently catches errors.
 *
 * @param count - Optional numeric badge value; omit for a plain dot badge
 */
export async function setBadge(count?: number): Promise<void> {
  if (!isBadgeSupported()) return;
  try {
    await (navigator as any).setAppBadge(count);
  } catch {
    // silently ignore
  }
}

/**
 * Clears the app badge from the icon.
 * No-op if the API is unsupported. Silently catches errors.
 */
export async function clearBadge(): Promise<void> {
  if (!isBadgeSupported()) return;
  try {
    await (navigator as any).clearAppBadge();
  } catch {
    // silently ignore
  }
}

/**
 * Updates the badge based on a count: sets the badge when count > 0,
 * clears it when count is 0.
 *
 * @param count - The document count to display (0 clears the badge)
 */
export async function updateBadge(count: number): Promise<void> {
  if (count > 0) {
    await setBadge(count);
  } else {
    await clearBadge();
  }
}
