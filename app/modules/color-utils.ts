// @ts-check
// ─── Color Utilities ─────────────────────────────────────────────────────────
// Color manipulation helpers: hex ↔ RGB ↔ HSL, lighten/darken, mix, contrast.

// ─── Hex ↔ RGB ───────────────────────────────────────────────────────────────

/**
 * Parse a hex color string to RGB components.
 * Accepts 3-char (#rgb) and 6-char (#rrggbb) forms.
 * Returns null for invalid input.
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  if (typeof hex !== 'string') return null;
  const clean = hex.startsWith('#') ? hex.slice(1) : hex;
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
    return { r, g, b };
  }
  if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
    return { r, g, b };
  }
  return null;
}

/**
 * Convert RGB components to a hex color string (e.g. '#ff0000').
 */
export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// ─── RGB ↔ HSL ────────────────────────────────────────────────────────────────

/**
 * Convert RGB to HSL.
 * @returns `{ h: 0–360, s: 0–100, l: 0–100 }`
 */
export function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  const l = (max + min) / 2;

  let h = 0;
  let s = 0;

  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));
    if (max === rn) {
      h = ((gn - bn) / delta) % 6;
    } else if (max === gn) {
      h = (bn - rn) / delta + 2;
    } else {
      h = (rn - gn) / delta + 4;
    }
    h = h * 60;
    if (h < 0) h += 360;
  }

  return {
    h: Math.round(h),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

/**
 * Helper: hue → channel value used by hslToRgb.
 */
function hue2rgb(p: number, q: number, t: number): number {
  let tt = t;
  if (tt < 0) tt += 1;
  if (tt > 1) tt -= 1;
  if (tt < 1 / 6) return p + (q - p) * 6 * tt;
  if (tt < 1 / 2) return q;
  if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
  return p;
}

/**
 * Convert HSL to RGB.
 * @param h - Hue 0–360
 * @param s - Saturation 0–100
 * @param l - Lightness 0–100
 */
export function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const sn = s / 100;
  const ln = l / 100;
  if (sn === 0) {
    const v = Math.round(ln * 255);
    return { r: v, g: v, b: v };
  }
  const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn;
  const p = 2 * ln - q;
  const hn = h / 360;
  return {
    r: Math.round(hue2rgb(p, q, hn + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, hn) * 255),
    b: Math.round(hue2rgb(p, q, hn - 1 / 3) * 255),
  };
}

// ─── Lighten / Darken ────────────────────────────────────────────────────────

/**
 * Lighten a hex color by a percentage (0–100).
 * Works via HSL: increases the L component.
 */
export function lighten(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const newL = Math.min(100, hsl.l + amount);
  const result = hslToRgb(hsl.h, hsl.s, newL);
  return rgbToHex(result.r, result.g, result.b);
}

/**
 * Darken a hex color by a percentage (0–100).
 * Works via HSL: decreases the L component.
 */
export function darken(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const newL = Math.max(0, hsl.l - amount);
  const result = hslToRgb(hsl.h, hsl.s, newL);
  return rgbToHex(result.r, result.g, result.b);
}

// ─── Mix ─────────────────────────────────────────────────────────────────────

/**
 * Mix two hex colors by a ratio (0 = all color1, 1 = all color2).
 */
export function mixColors(hex1: string, hex2: string, ratio: number): string {
  const c1 = hexToRgb(hex1);
  const c2 = hexToRgb(hex2);
  if (!c1 || !c2) return hex1;
  const r = Math.round(c1.r + (c2.r - c1.r) * ratio);
  const g = Math.round(c1.g + (c2.g - c1.g) * ratio);
  const b = Math.round(c1.b + (c2.b - c1.b) * ratio);
  return rgbToHex(r, g, b);
}

// ─── Luminance & Contrast ────────────────────────────────────────────────────

/**
 * Get the relative luminance of a hex color (WCAG 2.x sRGB linearization).
 * Returns a value in [0, 1].
 */
export function getLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const linearize = (c: number): number => {
    const sRGB = c / 255;
    return sRGB <= 0.03928 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * linearize(rgb.r) + 0.7152 * linearize(rgb.g) + 0.0722 * linearize(rgb.b);
}

/**
 * Compute WCAG 2.x contrast ratio between two hex colors.
 * Returns a value in [1, 21].
 */
export function getContrastRatio(hex1: string, hex2: string): number {
  const l1 = getLuminance(hex1);
  const l2 = getLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Determine whether text on a given background should be black or white.
 * Returns '#000000' or '#ffffff' whichever has the higher contrast ratio.
 */
export function getReadableTextColor(backgroundHex: string): '#000000' | '#ffffff' {
  const contrastBlack = getContrastRatio(backgroundHex, '#000000');
  const contrastWhite = getContrastRatio(backgroundHex, '#ffffff');
  return contrastBlack >= contrastWhite ? '#000000' : '#ffffff';
}
