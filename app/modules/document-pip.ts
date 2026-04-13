// ─── Document Picture-in-Picture API ─────────────────────────────────────────
// Wraps the Document Picture-in-Picture API (Chrome 116+) so NovaReader can
// open a floating always-on-top window showing the current PDF page.

export interface PiPOptions {
  width?: number;
  height?: number;
  disallowReturnToOpener?: boolean;
}

export interface PiPHandle {
  window: Window;
  close(): void;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Whether the Document Picture-in-Picture API is available in this environment.
 */
export function isDocumentPiPSupported(): boolean {
  return 'documentPictureInPicture' in window;
}

/**
 * Open a Document Picture-in-Picture window.
 * Returns a PiPHandle on success, or null if unsupported or an error occurs.
 */
export async function openPiPWindow(opts?: PiPOptions): Promise<PiPHandle | null> {
  if (!isDocumentPiPSupported()) return null;
  try {
    const pip = (window as any).documentPictureInPicture;
    const pipWin: Window = await pip.requestWindow(opts ?? {});
    return {
      window: pipWin,
      close: () => pipWin.close(),
    };
  } catch {
    return null;
  }
}

/**
 * Close the current Document Picture-in-Picture window if one is open.
 * No-op if the API is unsupported or no window is open.
 */
export function closePiPWindow(): void {
  const pip = (window as any).documentPictureInPicture;
  if (!pip) return;
  pip.window?.close();
}

/**
 * Whether a Document Picture-in-Picture window is currently open.
 */
export function isPiPOpen(): boolean {
  return !!((window as any).documentPictureInPicture?.window);
}

/**
 * Subscribe to the 'enter' event fired when a PiP window is opened.
 * Returns an unsubscribe function. No-op (with noop unsubscribe) if unsupported.
 */
export function onPiPEnter(handler: () => void): () => void {
  const pip = (window as any).documentPictureInPicture;
  if (!pip) return () => {};
  pip.addEventListener('enter', handler);
  return () => pip.removeEventListener('enter', handler);
}
