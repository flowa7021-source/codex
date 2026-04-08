// ─── Clipboard API ────────────────────────────────────────────────────────────
// Clipboard API wrapper for reading and writing text and images.

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Whether the Clipboard API (async read/write) is available.
 */
export function isClipboardSupported(): boolean {
  return 'clipboard' in navigator;
}

/**
 * Copy text to clipboard. Returns true on success, false on failure.
 *
 * @param text - The text string to copy to the clipboard
 */
export async function copyText(text: string): Promise<boolean> {
  if (!isClipboardSupported()) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read text from clipboard. Returns null if not available or denied.
 */
export async function readText(): Promise<string | null> {
  if (!isClipboardSupported()) return null;
  try {
    return await navigator.clipboard.readText();
  } catch {
    return null;
  }
}

/**
 * Copy an image (Blob) to the clipboard. Returns true on success.
 *
 * @param blob - The image Blob to copy (should be image/png)
 */
export async function copyImage(blob: Blob): Promise<boolean> {
  if (!isClipboardSupported()) return false;
  try {
    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': blob }),
    ]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Whether clipboard read permission is granted (best-effort check).
 * Returns 'granted' | 'denied' | 'prompt' | 'unknown'.
 */
export async function getClipboardReadPermission(): Promise<'granted' | 'denied' | 'prompt' | 'unknown'> {
  if (!navigator.permissions) return 'unknown';
  try {
    const result = await navigator.permissions.query({ name: 'clipboard-read' as PermissionName });
    return result.state as 'granted' | 'denied' | 'prompt';
  } catch {
    return 'unknown';
  }
}
