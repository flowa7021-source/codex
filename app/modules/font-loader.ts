// ─── Font Loading API ─────────────────────────────────────────────────────────
// Font Loading API wrapper for tracking web font readiness before PDF text
// layer rendering. Ensures fonts are available before measuring or rendering text.

export interface FontLoadResult {
  family: string;
  loaded: boolean;
  error?: string;
}

/** Default timeout in milliseconds when waiting for a font to load. */
const DEFAULT_TIMEOUT_MS = 3000;

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Whether the CSS Font Loading API is available in this environment.
 */
export function isFontLoadingSupported(): boolean {
  return 'fonts' in document;
}

/**
 * Wait for a specific font family to finish loading.
 * Resolves with `{ family, loaded: true }` on success,
 * or `{ family, loaded: false, error }` on timeout or error.
 *
 * @param family - Font family name, e.g. `"Arial"`
 * @param opts - Optional weight, style, and timeout overrides
 */
export async function waitForFont(
  family: string,
  opts?: { weight?: string; style?: string; timeout?: number },
): Promise<FontLoadResult> {
  if (!isFontLoadingSupported()) {
    return { family, loaded: false, error: 'Font Loading API not supported' };
  }

  const weight = opts?.weight ?? 'normal';
  const style = opts?.style ?? 'normal';
  const timeout = opts?.timeout ?? DEFAULT_TIMEOUT_MS;
  const descriptor = `${style} ${weight} 16px "${family}"`;

  const fontSet = (document as any).fonts as FontFaceSet;

  const loadPromise = fontSet.load(descriptor).then(() => ({ family, loaded: true as const }));

  const timeoutPromise = new Promise<FontLoadResult>((resolve) => {
    setTimeout(() => {
      resolve({ family, loaded: false, error: `Timeout waiting for font "${family}"` });
    }, timeout);
  });

  try {
    return await Promise.race([loadPromise, timeoutPromise]);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { family, loaded: false, error: message };
  }
}

/**
 * Wait for multiple font families to load in parallel.
 * Returns an array of results in the same order as the input array.
 *
 * @param families - Array of font family names
 */
export async function waitForFonts(families: string[]): Promise<FontLoadResult[]> {
  return Promise.all(families.map(family => waitForFont(family)));
}

/**
 * Check synchronously whether a font is already loaded.
 * Uses `document.fonts.check()` — returns false if the API is unavailable.
 *
 * @param family - Font family name, e.g. `"Arial"`
 */
export function isFontLoaded(family: string): boolean {
  if (!isFontLoadingSupported()) return false;
  try {
    return (document as any).fonts.check(`16px "${family}"`);
  } catch {
    return false;
  }
}

/**
 * Subscribe to font loading completion events.
 * The handler is called whenever one or more fonts finish loading.
 * Returns an unsubscribe function — call it to remove the listener.
 *
 * @param handler - Called with `{ family }` for each loaded font face
 */
export function onFontLoad(handler: (fontFace: { family: string }) => void): () => void {
  if (!isFontLoadingSupported()) {
    return () => {};
  }

  const fontSet = (document as any).fonts as FontFaceSet;

  const listener = (event: FontFaceSetLoadEvent) => {
    for (const face of event.fontfaces) {
      handler({ family: face.family });
    }
  };

  fontSet.addEventListener('loadingdone', listener as EventListener);

  return () => {
    fontSet.removeEventListener('loadingdone', listener as EventListener);
  };
}
