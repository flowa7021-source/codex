// @ts-check
// ─── Color Utilities ─────────────────────────────────────────────────────────
// Color manipulation helpers — no browser APIs.

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RGB { r: number; g: number; b: number; }
export interface HSL { h: number; s: number; l: number; }
export interface RGBA extends RGB { a: number; }

// ─── Public API ──────────────────────────────────────────────────────────────

/** Parse hex color string to RGB. Supports #RGB and #RRGGBB. */
export function hexToRgb(hex: string): RGB {
  const cleaned = hex.startsWith('#') ? hex.slice(1) : hex;
  if (cleaned.length === 3) {
    const r = parseInt(cleaned[0] + cleaned[0], 16);
    const g = parseInt(cleaned[1] + cleaned[1], 16);
    const b = parseInt(cleaned[2] + cleaned[2], 16);
    return { r, g, b };
  }
  const r = parseInt(cleaned.slice(0, 2), 16);
  const g = parseInt(cleaned.slice(2, 4), 16);
  const b = parseInt(cleaned.slice(4, 6), 16);
  return { r, g, b };
}

/** Convert RGB to hex string (#rrggbb). */
export function rgbToHex(rgb: RGB): string {
  const toHex = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0');
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

/** Convert RGB to HSL. */
export function rgbToHsl(rgb: RGB): HSL {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) {
    return { h: 0, s: 0, l: l * 100 };
  }

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h: number;
  if (max === r) {
    h = (g - b) / d + (g < b ? 6 : 0);
  } else if (max === g) {
    h = (b - r) / d + 2;
  } else {
    h = (r - g) / d + 4;
  }
  h /= 6;

  return { h: h * 360, s: s * 100, l: l * 100 };
}

/** Convert HSL to RGB. */
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

/** Mix two colors by a factor t (0=color1, 1=color2). */
export function mixColors(c1: RGB, c2: RGB, t: number): RGB {
  const clampedT = Math.max(0, Math.min(1, t));
  return {
    r: Math.round(c1.r + (c2.r - c1.r) * clampedT),
    g: Math.round(c1.g + (c2.g - c1.g) * clampedT),
    b: Math.round(c1.b + (c2.b - c1.b) * clampedT),
  };
}

/** Lighten a color by percentage (0-100). */
export function lighten(color: RGB, amount: number): RGB {
  const hsl = rgbToHsl(color);
  hsl.l = Math.min(100, hsl.l + amount);
  return hslToRgb(hsl);
}

/** Darken a color by percentage (0-100). */
export function darken(color: RGB, amount: number): RGB {
  const hsl = rgbToHsl(color);
  hsl.l = Math.max(0, hsl.l - amount);
  return hslToRgb(hsl);
}

/** Calculate relative luminance (for WCAG contrast). */
export function luminance(color: RGB): number {
  const toLinear = (c: number): number => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(color.r) + 0.7152 * toLinear(color.g) + 0.0722 * toLinear(color.b);
}

/** Calculate WCAG contrast ratio between two colors. */
export function contrastRatio(c1: RGB, c2: RGB): number {
  const l1 = luminance(c1);
  const l2 = luminance(c2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Check if contrast meets WCAG AA (ratio >= 4.5 for normal text). */
export function meetsWCAGAA(c1: RGB, c2: RGB): boolean {
  return contrastRatio(c1, c2) >= 4.5;
}

/** Invert a color. */
export function invertColor(color: RGB): RGB {
  return {
    r: 255 - color.r,
    g: 255 - color.g,
    b: 255 - color.b,
  };
}

/** Convert RGBA to CSS rgba() string. */
export function toRgbString(color: RGB | RGBA): string {
  const a = 'a' in color ? (color as RGBA).a : undefined;
  if (a !== undefined) {
    return `rgba(${Math.round(color.r)}, ${Math.round(color.g)}, ${Math.round(color.b)}, ${a})`;
  }
  return `rgb(${Math.round(color.r)}, ${Math.round(color.g)}, ${Math.round(color.b)})`;
}

/** Parse any CSS color string (hex, rgb(), hsl()) to RGB. Returns null if invalid. */
export function parseCssColor(css: string): RGB | null {
  const trimmed = css.trim();

  // Hex colors
  if (trimmed.startsWith('#')) {
    const cleaned = trimmed.slice(1);
    if (cleaned.length === 3 && /^[0-9a-fA-F]{3}$/.test(cleaned)) {
      return hexToRgb(trimmed);
    }
    if (cleaned.length === 6 && /^[0-9a-fA-F]{6}$/.test(cleaned)) {
      return hexToRgb(trimmed);
    }
    return null;
  }

  // rgb() or rgba()
  const rgbMatch = trimmed.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*[\d.]+)?\s*\)$/);
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1], 10),
      g: parseInt(rgbMatch[2], 10),
      b: parseInt(rgbMatch[3], 10),
    };
  }

  // hsl() or hsla()
  const hslMatch = trimmed.match(/^hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%(?:\s*,\s*[\d.]+)?\s*\)$/);
  if (hslMatch) {
    return hslToRgb({
      h: parseFloat(hslMatch[1]),
      s: parseFloat(hslMatch[2]),
      l: parseFloat(hslMatch[3]),
    });
  }

  return null;
}
