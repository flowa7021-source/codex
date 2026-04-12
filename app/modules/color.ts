// @ts-check
// ─── Color Manipulation & Conversion ─────────────────────────────────────────
// Pure functions for parsing, converting, and manipulating CSS colors.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface HSL {
  h: number;
  s: number;
  l: number;
}

export interface HSV {
  h: number;
  s: number;
  v: number;
}

// ─── Parsing ──────────────────────────────────────────────────────────────────

/**
 * Parse a hex color string into an RGB object.
 * Accepts '#rgb', '#rrggbb' (case-insensitive).
 * Throws for invalid input.
 */
export function parseHex(hex: string): RGB {
  const clean = hex.trim();
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(clean);
  if (short) {
    return {
      r: parseInt(short[1] + short[1], 16),
      g: parseInt(short[2] + short[2], 16),
      b: parseInt(short[3] + short[3], 16),
    };
  }
  const long = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(clean);
  if (long) {
    return {
      r: parseInt(long[1], 16),
      g: parseInt(long[2], 16),
      b: parseInt(long[3], 16),
    };
  }
  throw new Error(`parseHex: invalid hex color "${hex}"`);
}

/**
 * Parse an 'rgb(r, g, b)' string into an RGB object.
 * Values are clamped to [0, 255].
 */
export function parseRgb(str: string): RGB {
  const match = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i.exec(str.trim());
  if (!match) {
    throw new Error(`parseRgb: invalid rgb string "${str}"`);
  }
  return {
    r: Math.min(255, parseInt(match[1], 10)),
    g: Math.min(255, parseInt(match[2], 10)),
    b: Math.min(255, parseInt(match[3], 10)),
  };
}

/**
 * Auto-detect and parse a hex or rgb() color string into an RGB object.
 * Throws if neither format matches.
 */
export function parseColor(str: string): RGB {
  const s = str.trim();
  if (s.startsWith('#')) return parseHex(s);
  if (/^rgb\(/i.test(s)) return parseRgb(s);
  throw new Error(`parseColor: unrecognised color format "${str}"`);
}

// ─── Conversion ───────────────────────────────────────────────────────────────

/**
 * Convert an RGB object to a lowercase '#rrggbb' hex string.
 */
export function rgbToHex(rgb: RGB): string {
  const toHex = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0');
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

/**
 * Convert RGB to HSL.
 * h: 0–360, s: 0–100, l: 0–100.
 */
export function rgbToHsl(rgb: RGB): HSL {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const l = (max + min) / 2;

  if (delta === 0) {
    return { h: 0, s: 0, l: Math.round(l * 100) };
  }

  const s = delta / (1 - Math.abs(2 * l - 1));

  let h = 0;
  if (max === r) {
    h = ((g - b) / delta) % 6;
  } else if (max === g) {
    h = (b - r) / delta + 2;
  } else {
    h = (r - g) / delta + 4;
  }

  h = h * 60;
  if (h < 0) h += 360;

  return {
    h: Math.round(h),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

/**
 * Convert HSL to RGB.
 * h: 0–360, s: 0–100, l: 0–100.
 */
export function hslToRgb(hsl: HSL): RGB {
  const h = hsl.h / 360;
  const s = hsl.s / 100;
  const l = hsl.l / 100;

  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }

  const hue2rgb = (p: number, q: number, t: number): number => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  return {
    r: Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, h) * 255),
    b: Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  };
}

/**
 * Convert RGB to HSV.
 * h: 0–360, s: 0–100, v: 0–100.
 */
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

  return {
    h: Math.round(h),
    s: Math.round(s * 100),
    v: Math.round(v * 100),
  };
}

/**
 * Convert HSV to RGB.
 * h: 0–360, s: 0–100, v: 0–100.
 */
export function hsvToRgb(hsv: HSV): RGB {
  const h = hsv.h / 60;
  const s = hsv.s / 100;
  const v = hsv.v / 100;

  const i = Math.floor(h);
  const f = h - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);

  let r = 0;
  let g = 0;
  let b = 0;

  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    case 5: r = v; g = p; b = q; break;
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

// ─── Manipulation ─────────────────────────────────────────────────────────────

/**
 * Lighten a hex color by increasing its HSL lightness.
 * amount: 0–100 (percentage points added to lightness).
 */
export function lighten(hex: string, amount: number): string {
  const hsl = rgbToHsl(parseHex(hex));
  return rgbToHex(hslToRgb({ ...hsl, l: Math.min(100, hsl.l + amount) }));
}

/**
 * Darken a hex color by decreasing its HSL lightness.
 * amount: 0–100 (percentage points subtracted from lightness).
 */
export function darken(hex: string, amount: number): string {
  const hsl = rgbToHsl(parseHex(hex));
  return rgbToHex(hslToRgb({ ...hsl, l: Math.max(0, hsl.l - amount) }));
}

/**
 * Increase saturation of a hex color.
 * amount: 0–100 (percentage points added to HSL saturation).
 */
export function saturate(hex: string, amount: number): string {
  const hsl = rgbToHsl(parseHex(hex));
  return rgbToHex(hslToRgb({ ...hsl, s: Math.min(100, hsl.s + amount) }));
}

/**
 * Decrease saturation of a hex color.
 * amount: 0–100 (percentage points subtracted from HSL saturation).
 */
export function desaturate(hex: string, amount: number): string {
  const hsl = rgbToHsl(parseHex(hex));
  return rgbToHex(hslToRgb({ ...hsl, s: Math.max(0, hsl.s - amount) }));
}

/**
 * Mix two hex colors together.
 * weight: 0–1, where 0 = fully hex2, 1 = fully hex1. Default 0.5.
 */
export function mix(hex1: string, hex2: string, weight: number = 0.5): string {
  const c1 = parseHex(hex1);
  const c2 = parseHex(hex2);
  const w = Math.max(0, Math.min(1, weight));
  return rgbToHex({
    r: Math.round(c1.r * w + c2.r * (1 - w)),
    g: Math.round(c1.g * w + c2.g * (1 - w)),
    b: Math.round(c1.b * w + c2.b * (1 - w)),
  });
}

/**
 * Invert a hex color (255 minus each channel).
 */
export function invert(hex: string): string {
  const { r, g, b } = parseHex(hex);
  return rgbToHex({ r: 255 - r, g: 255 - g, b: 255 - b });
}

/**
 * Convert a hex color to grayscale using luminance weights.
 */
export function grayscale(hex: string): string {
  const { r, g, b } = parseHex(hex);
  const gray = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
  return rgbToHex({ r: gray, g: gray, b: gray });
}

/**
 * Apply an alpha value to a hex color, returning 'rgba(r,g,b,a)'.
 * a: 0–1.
 */
export function alpha(hex: string, a: number): string {
  const { r, g, b } = parseHex(hex);
  const clampedA = Math.max(0, Math.min(1, a));
  return `rgba(${r},${g},${b},${clampedA})`;
}

// ─── Analysis ─────────────────────────────────────────────────────────────────

/**
 * Compute the WCAG relative luminance of an RGB color.
 * Returns a value in [0, 1].
 * See https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */
export function luminance(rgb: RGB): number {
  const linearise = (c: number): number => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * linearise(rgb.r) + 0.7152 * linearise(rgb.g) + 0.0722 * linearise(rgb.b);
}

/**
 * Compute the WCAG contrast ratio between two hex colors.
 * Returns a value in [1, 21].
 */
export function contrast(hex1: string, hex2: string): number {
  const l1 = luminance(parseHex(hex1));
  const l2 = luminance(parseHex(hex2));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Return true if the hex color is perceptually light (luminance > 0.179).
 */
export function isLight(hex: string): boolean {
  return luminance(parseHex(hex)) > 0.179;
}

/**
 * Return true if the hex color is perceptually dark (luminance <= 0.179).
 */
export function isDark(hex: string): boolean {
  return !isLight(hex);
}
