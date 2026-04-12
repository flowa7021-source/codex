// @ts-check
// ─── Color Utilities ─────────────────────────────────────────────────────────
// Color manipulation and conversion library.
// No external dependencies — pure math.

// ─── Types ───────────────────────────────────────────────────────────────────

/** Red/Green/Blue color, each channel 0–255. */
export interface RGB {
  r: number;
  g: number;
  b: number;
}

/** Red/Green/Blue/Alpha color, channels 0–255 and alpha 0–1. */
export interface RGBA {
  r: number;
  g: number;
  b: number;
  /** Opacity: 0 (transparent) to 1 (opaque). */
  a: number;
}

/** Hue/Saturation/Lightness — h: 0–360, s: 0–100, l: 0–100. */
export interface HSL {
  h: number;
  s: number;
  l: number;
}

/** Hue/Saturation/Value — h: 0–360, s: 0–100, v: 0–100. */
export interface HSV {
  h: number;
  s: number;
  v: number;
}

// ─── Parsing ─────────────────────────────────────────────────────────────────

/**
 * Parse a CSS hex color string ('#rgb' or '#rrggbb') into an RGB object.
 * The leading '#' is optional.
 */
export function parseHex(hex: string): RGB {
  const s = hex.startsWith('#') ? hex.slice(1) : hex;
  let r: number, g: number, b: number;
  if (s.length === 3) {
    r = parseInt(s[0] + s[0], 16);
    g = parseInt(s[1] + s[1], 16);
    b = parseInt(s[2] + s[2], 16);
  } else {
    r = parseInt(s.slice(0, 2), 16);
    g = parseInt(s.slice(2, 4), 16);
    b = parseInt(s.slice(4, 6), 16);
  }
  return { r, g, b };
}

/**
 * Parse a CSS 'rgb(r, g, b)' string into an RGB object.
 * Spaces around values are tolerated.
 */
export function parseRgb(str: string): RGB {
  const m = str.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
  if (!m) throw new Error(`parseRgb: invalid format "${str}"`);
  return { r: parseInt(m[1], 10), g: parseInt(m[2], 10), b: parseInt(m[3], 10) };
}

/**
 * Parse a CSS 'rgba(r, g, b, a)' string into an RGBA object.
 * Alpha may be expressed as a decimal (0.5) or integer (0, 1).
 */
export function parseRgba(str: string): RGBA {
  const m = str.match(/rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/i);
  if (!m) throw new Error(`parseRgba: invalid format "${str}"`);
  return {
    r: parseInt(m[1], 10),
    g: parseInt(m[2], 10),
    b: parseInt(m[3], 10),
    a: parseFloat(m[4]),
  };
}

/**
 * Parse any supported CSS color string (hex, rgb, rgba) into an RGB object.
 * For rgba inputs the alpha channel is discarded.
 */
export function parseColor(str: string): RGB {
  const trimmed = str.trim();
  if (trimmed.startsWith('#')) return parseHex(trimmed);
  if (/^rgba\s*\(/i.test(trimmed)) {
    const { r, g, b } = parseRgba(trimmed);
    return { r, g, b };
  }
  if (/^rgb\s*\(/i.test(trimmed)) return parseRgb(trimmed);
  throw new Error(`parseColor: unsupported format "${str}"`);
}

// ─── Formatting ──────────────────────────────────────────────────────────────

/** Format an RGB color as a lowercase hex string, e.g. '#ff0000'. */
export function toHex(color: RGB): string {
  const hex = (n: number) =>
    Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0');
  return `#${hex(color.r)}${hex(color.g)}${hex(color.b)}`;
}

/** Format an RGB color as a CSS 'rgb(r, g, b)' string. */
export function toRgbString(color: RGB): string {
  return `rgb(${Math.round(color.r)}, ${Math.round(color.g)}, ${Math.round(color.b)})`;
}

/** Format an RGBA color as a CSS 'rgba(r, g, b, a)' string. */
export function toRgbaString(color: RGBA): string {
  return `rgba(${Math.round(color.r)}, ${Math.round(color.g)}, ${Math.round(color.b)}, ${color.a})`;
}

// ─── Conversions ─────────────────────────────────────────────────────────────

/** Convert an RGB color to HSL (h: 0–360, s: 0–100, l: 0–100). */
export function rgbToHsl(rgb: RGB): HSL {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  const l = (max + min) / 2;

  if (delta === 0) {
    return { h: 0, s: 0, l: l * 100 };
  }

  const s = delta / (1 - Math.abs(2 * l - 1));

  let h: number;
  if (max === r) {
    h = ((g - b) / delta) % 6;
  } else if (max === g) {
    h = (b - r) / delta + 2;
  } else {
    h = (r - g) / delta + 4;
  }
  h = h * 60;
  if (h < 0) h += 360;

  return { h, s: s * 100, l: l * 100 };
}

/** Convert an HSL color to RGB (h: 0–360, s: 0–100, l: 0–100). */
export function hslToRgb(hsl: HSL): RGB {
  const s = hsl.s / 100;
  const l = hsl.l / 100;
  const h = hsl.h;

  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let r = 0, g = 0, b = 0;

  if (h < 60)       { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else              { r = c; g = 0; b = x; }

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

/** Convert an RGB color to HSV (h: 0–360, s: 0–100, v: 0–100). */
export function rgbToHsv(rgb: RGB): HSV {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  const v = max;
  const s = max === 0 ? 0 : delta / max;

  let h = 0;
  if (delta !== 0) {
    if (max === r) {
      h = ((g - b) / delta) % 6;
    } else if (max === g) {
      h = (b - r) / delta + 2;
    } else {
      h = (r - g) / delta + 4;
    }
    h = h * 60;
    if (h < 0) h += 360;
  }

  return { h, s: s * 100, v: v * 100 };
}

/** Convert an HSV color to RGB (h: 0–360, s: 0–100, v: 0–100). */
export function hsvToRgb(hsv: HSV): RGB {
  const s = hsv.s / 100;
  const v = hsv.v / 100;
  const h = hsv.h;

  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;

  let r = 0, g = 0, b = 0;

  if (h < 60)       { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else              { r = c; g = 0; b = x; }

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

// ─── Operations ──────────────────────────────────────────────────────────────

/**
 * Mix two RGB colors by linear interpolation.
 * t=0 returns `a`, t=1 returns `b`.  Default t=0.5.
 */
export function mix(a: RGB, b: RGB, t = 0.5): RGB {
  return {
    r: Math.round(a.r + (b.r - a.r) * t),
    g: Math.round(a.g + (b.g - a.g) * t),
    b: Math.round(a.b + (b.b - a.b) * t),
  };
}

/**
 * Lighten a color by increasing the HSL lightness by `amount` percentage points.
 * `amount` is 0–100.
 */
export function lighten(color: RGB, amount: number): RGB {
  const hsl = rgbToHsl(color);
  hsl.l = Math.min(100, hsl.l + amount);
  return hslToRgb(hsl);
}

/**
 * Darken a color by decreasing the HSL lightness by `amount` percentage points.
 * `amount` is 0–100.
 */
export function darken(color: RGB, amount: number): RGB {
  const hsl = rgbToHsl(color);
  hsl.l = Math.max(0, hsl.l - amount);
  return hslToRgb(hsl);
}

/**
 * Increase the HSL saturation by `amount` percentage points (0–100).
 */
export function saturate(color: RGB, amount: number): RGB {
  const hsl = rgbToHsl(color);
  hsl.s = Math.min(100, hsl.s + amount);
  return hslToRgb(hsl);
}

/**
 * Decrease the HSL saturation by `amount` percentage points (0–100).
 */
export function desaturate(color: RGB, amount: number): RGB {
  const hsl = rgbToHsl(color);
  hsl.s = Math.max(0, hsl.s - amount);
  return hslToRgb(hsl);
}

/** Invert an RGB color (255 - each channel). */
export function invert(color: RGB): RGB {
  return { r: 255 - color.r, g: 255 - color.g, b: 255 - color.b };
}

/**
 * Convert a color to grayscale using the luminosity method
 * (ITU-R BT.601 coefficients).
 */
export function grayscale(color: RGB): RGB {
  const v = Math.round(0.299 * color.r + 0.587 * color.g + 0.114 * color.b);
  return { r: v, g: v, b: v };
}

/** Wrap an RGB color in an RGBA object with the given alpha (0–1). */
export function opacity(color: RGB, alpha: number): RGBA {
  return { r: color.r, g: color.g, b: color.b, a: alpha };
}

// ─── Analysis ────────────────────────────────────────────────────────────────

/**
 * Calculate the relative luminance of an RGB color per WCAG 2.x.
 * Returns a value in [0, 1] where 0 is black and 1 is white.
 */
export function luminance(color: RGB): number {
  const linearize = (c: number): number => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const r = linearize(color.r);
  const g = linearize(color.g);
  const b = linearize(color.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Calculate the WCAG contrast ratio between two colors.
 * Returns a value in [1, 21].
 */
export function contrast(a: RGB, b: RGB): number {
  const l1 = luminance(a);
  const l2 = luminance(b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Return true if the color's relative luminance is greater than 0.5. */
export function isLight(color: RGB): boolean {
  return luminance(color) > 0.5;
}

/** Return true if the color's relative luminance is 0.5 or less. */
export function isDark(color: RGB): boolean {
  return !isLight(color);
}

/**
 * Return the complementary color (hue rotated 180°) of the given RGB color.
 */
export function complementary(color: RGB): RGB {
  const hsl = rgbToHsl(color);
  hsl.h = (hsl.h + 180) % 360;
  return hslToRgb(hsl);
}

// ─── Aliases matching test file imports ──────────────────────────────────────
export const hexToRgb = parseHex;
export const rgbToHex = toHex;
export const mixColors = mix;
export const invertColor = invert;
export const parseCssColor = parseColor;
export function contrastRatio(a: RGB, b: RGB): number { return contrast(a, b); }
export function meetsWCAGAA(a: RGB, b: RGB, large = false): boolean {
  const ratio = contrast(a, b);
  return large ? ratio >= 3 : ratio >= 4.5;
}
