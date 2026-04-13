// @ts-check
// ─── Color Palette Utilities ──────────────────────────────────────────────────
// Functions for generating color palettes and converting between color formats.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HSL { h: number; s: number; l: number; }
export interface RGB { r: number; g: number; b: number; }

// ─── Internal helpers ────────────────────────────────────────────────────────

/** Clamp a number to [0, max]. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Wrap hue to [0, 360). */
function wrapHue(h: number): number {
  return ((h % 360) + 360) % 360;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Convert HSL components to a hex string (#rrggbb).
 * h in [0, 360), s and l in [0, 100].
 */
export function hslToHex(h: number, s: number, l: number): string {
  const sn = clamp(s, 0, 100) / 100;
  const ln = clamp(l, 0, 100) / 100;
  const hn = wrapHue(h);

  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs((hn / 60) % 2 - 1));
  const m = ln - c / 2;

  let r = 0, g = 0, b = 0;

  if (hn < 60)       { r = c; g = x; b = 0; }
  else if (hn < 120) { r = x; g = c; b = 0; }
  else if (hn < 180) { r = 0; g = c; b = x; }
  else if (hn < 240) { r = 0; g = x; b = c; }
  else if (hn < 300) { r = x; g = 0; b = c; }
  else               { r = c; g = 0; b = x; }

  const toHex = (n: number): string => {
    const byte = Math.round((n + m) * 255);
    return clamp(byte, 0, 255).toString(16).padStart(2, '0');
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Convert a hex color string (#rrggbb or #rgb) to HSL.
 */
export function hexToHSL(hex: string): HSL {
  const { r, g, b } = hexToRGB(hex);
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;

  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === rn)      h = ((gn - bn) / delta) % 6;
    else if (max === gn) h = (bn - rn) / delta + 2;
    else                 h = (rn - gn) / delta + 4;
    h = wrapHue(h * 60);
  }

  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

  return {
    h: Math.round(h),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

/**
 * Convert a hex color string (#rrggbb or #rgb) to RGB.
 */
export function hexToRGB(hex: string): RGB {
  let h = hex.replace('#', '');
  if (h.length === 3) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  }
  const n = parseInt(h, 16);
  return {
    r: (n >> 16) & 0xff,
    g: (n >> 8) & 0xff,
    b: n & 0xff,
  };
}

/**
 * Convert RGB components to a hex string (#rrggbb).
 */
export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number): string => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Generate N evenly-spaced hues at given saturation and lightness.
 * Returns an array of hex strings.
 */
export function generatePalette(n: number, saturation = 70, lightness = 50): string[] {
  if (n <= 0) return [];
  return Array.from({ length: n }, (_, i) => {
    const hue = (360 / n) * i;
    return hslToHex(hue, saturation, lightness);
  });
}

/**
 * Generate a monochromatic palette (shades of one hue) by varying lightness.
 */
export function monochromaticPalette(hue: number, n: number): string[] {
  if (n <= 0) return [];
  if (n === 1) return [hslToHex(hue, 70, 50)];
  return Array.from({ length: n }, (_, i) => {
    // Range lightness from 20% to 80%
    const l = 20 + (60 / (n - 1)) * i;
    return hslToHex(hue, 70, l);
  });
}

/**
 * Generate complementary colors (two colors 180° apart).
 */
export function complementaryPair(hue: number): [string, string] {
  const h1 = wrapHue(hue);
  const h2 = wrapHue(hue + 180);
  return [hslToHex(h1, 70, 50), hslToHex(h2, 70, 50)];
}

/**
 * Generate triadic colors (three colors 120° apart).
 */
export function triadicPalette(hue: number): [string, string, string] {
  const h1 = wrapHue(hue);
  const h2 = wrapHue(hue + 120);
  const h3 = wrapHue(hue + 240);
  return [hslToHex(h1, 70, 50), hslToHex(h2, 70, 50), hslToHex(h3, 70, 50)];
}

/**
 * Generate analogous colors (n colors spread ±(spread/2)° around base hue).
 * Default n=5, spread=60°.
 */
export function analogousPalette(hue: number, n = 5): string[] {
  if (n <= 0) return [];
  const spread = 60;
  const step = n === 1 ? 0 : spread / (n - 1);
  const start = hue - spread / 2;
  return Array.from({ length: n }, (_, i) => {
    const h = wrapHue(start + step * i);
    return hslToHex(h, 70, 50);
  });
}

/**
 * Get the relative luminance of a hex color (per WCAG 2.1).
 * Returns a value in [0, 1] where 0=black and 1=white.
 */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRGB(hex);
  const linearize = (c: number): number => {
    const sRGB = c / 255;
    return sRGB <= 0.04045 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/**
 * Calculate WCAG contrast ratio between two hex colors.
 * Returns a value in [1, 21].
 */
export function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}
