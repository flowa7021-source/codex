// ─── Virtual Keyboard API ────────────────────────────────────────────────────
// Wraps the VirtualKeyboard API (Chrome 94+) so NovaReader can adapt its
// layout when the on-screen keyboard appears on mobile/tablet devices,
// preventing the keyboard from obscuring the PDF toolbar or annotation inputs.

export interface KeyboardGeometry {
  top: number;
  left: number;
  width: number;
  height: number;
}

// ─── Internal helper ─────────────────────────────────────────────────────────

function vk(): any {
  return (navigator as any).virtualKeyboard;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Whether the VirtualKeyboard API is available in this environment.
 */
export function isVirtualKeyboardSupported(): boolean {
  return 'virtualKeyboard' in navigator;
}

/**
 * Read the current keyboard bounding rectangle.
 * Returns zeros when the API is unavailable or the keyboard is not shown.
 */
export function getKeyboardGeometry(): KeyboardGeometry {
  if (!isVirtualKeyboardSupported()) {
    return { top: 0, left: 0, width: 0, height: 0 };
  }
  const rect: DOMRect = vk().boundingRect as DOMRect;
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
}

/**
 * Tell the browser that NovaReader will handle keyboard overlap itself.
 * Sets `overlaysContent = true` so CSS env() variables are populated.
 * No-op if the API is unavailable.
 */
export function enableOverlaysPolicy(): void {
  if (!isVirtualKeyboardSupported()) return;
  vk().overlaysContent = true;
}

/**
 * Restore the default browser behaviour (keyboard scrolls content).
 * No-op if the API is unavailable.
 */
export function disableOverlaysPolicy(): void {
  if (!isVirtualKeyboardSupported()) return;
  vk().overlaysContent = false;
}

/**
 * Subscribe to virtual keyboard geometry changes.
 *
 * @param handler - Called with the new geometry whenever the keyboard
 *                  appears, disappears, or resizes.
 * @returns An unsubscribe function.
 */
export function onKeyboardGeometryChange(
  handler: (geometry: KeyboardGeometry) => void,
): () => void {
  if (!isVirtualKeyboardSupported()) {
    return () => {};
  }

  const listener = () => {
    handler(getKeyboardGeometry());
  };

  vk().addEventListener('geometrychange', listener);

  return () => {
    vk().removeEventListener('geometrychange', listener);
  };
}

/**
 * Programmatically show the virtual keyboard.
 * No-op if the API is unavailable.
 */
export function showVirtualKeyboard(): void {
  if (!isVirtualKeyboardSupported()) return;
  vk().show();
}

/**
 * Programmatically hide the virtual keyboard.
 * No-op if the API is unavailable.
 */
export function hideVirtualKeyboard(): void {
  if (!isVirtualKeyboardSupported()) return;
  vk().hide();
}
