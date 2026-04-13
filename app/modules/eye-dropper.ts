// ─── EyeDropper API ──────────────────────────────────────────────────────────
// EyeDropper API wrapper for color picking from the PDF canvas.
// Used for annotation color selection when the user wants to sample a color
// directly from the document.

export interface ColorResult {
  sRGBHex: string; // e.g. '#ff0000'
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Whether the EyeDropper API is available in this environment.
 */
export function isEyeDropperSupported(): boolean {
  return 'EyeDropper' in globalThis;
}

/**
 * Open the system color picker and return the selected color.
 * Returns null if the user cancels, if the API is unavailable, or if an
 * error occurs.
 *
 * @param signal - Optional AbortSignal to cancel the color picker
 */
export async function pickColor(signal?: AbortSignal): Promise<ColorResult | null> {
  if (!isEyeDropperSupported()) return null;

  try {
    const EyeDropperCtor = (globalThis as any).EyeDropper;
    const dropper = new EyeDropperCtor();
    const result = await dropper.open({ signal });
    return result as ColorResult;
  } catch (err: any) {
    // AbortError means the user cancelled — return null silently
    if (err?.name === 'AbortError') return null;
    return null;
  }
}

/**
 * Open the system color picker and return the selected hex color string.
 * Returns null if the user cancels, if the API is unavailable, or if an
 * error occurs.
 *
 * @param signal - Optional AbortSignal to cancel the color picker
 */
export async function pickColorHex(signal?: AbortSignal): Promise<string | null> {
  const result = await pickColor(signal);
  return result?.sRGBHex ?? null;
}

/**
 * Parse a `#rrggbb` or `#rgb` hex color string into RGB components.
 * Returns null if the input is not a valid hex color.
 *
 * @param hex - Hex color string (e.g. `#ff0000` or `#f00`)
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  if (typeof hex !== 'string') return null;

  // Strip leading '#'
  const raw = hex.startsWith('#') ? hex.slice(1) : hex;

  if (raw.length === 3) {
    // Short form: #rgb → #rrggbb
    const r = parseInt(raw[0] + raw[0], 16);
    const g = parseInt(raw[1] + raw[1], 16);
    const b = parseInt(raw[2] + raw[2], 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
    return { r, g, b };
  }

  if (raw.length === 6) {
    const r = parseInt(raw.slice(0, 2), 16);
    const g = parseInt(raw.slice(2, 4), 16);
    const b = parseInt(raw.slice(4, 6), 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
    return { r, g, b };
  }

  return null;
}

/**
 * Convert 0–255 RGB values to a lowercase `#rrggbb` hex string.
 *
 * @param r - Red component (0–255)
 * @param g - Green component (0–255)
 * @param b - Blue component (0–255)
 */
export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}
