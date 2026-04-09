// @ts-check
// ─── Gradient Utilities ───────────────────────────────────────────────────────
// Functions for generating and parsing CSS gradient strings.

import { hexToRGB, rgbToHex } from './color-palette.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ColorStop {
  color: string;
  position?: number; // 0-100 percentage
}

// ─── Internal helpers ────────────────────────────────────────────────────────

/** Format a single color stop as a CSS fragment, e.g. "#ff0000 50%". */
function formatStop(stop: ColorStop): string {
  return stop.position !== undefined
    ? `${stop.color} ${stop.position}%`
    : stop.color;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Generate a CSS linear-gradient string.
 * @param stops - Array of color stops.
 * @param angle - Gradient angle in degrees (default 90).
 */
export function linearGradient(stops: ColorStop[], angle = 90): string {
  const stopStr = stops.map(formatStop).join(', ');
  return `linear-gradient(${angle}deg, ${stopStr})`;
}

/**
 * Generate a CSS radial-gradient string.
 * @param stops - Array of color stops.
 * @param shape - 'circle' or 'ellipse' (default 'ellipse').
 */
export function radialGradient(stops: ColorStop[], shape: 'circle' | 'ellipse' = 'ellipse'): string {
  const stopStr = stops.map(formatStop).join(', ');
  return `radial-gradient(${shape}, ${stopStr})`;
}

/**
 * Generate a CSS conic-gradient string.
 * @param stops - Array of color stops.
 * @param angle - Starting angle in degrees (default 0).
 */
export function conicGradient(stops: ColorStop[], angle = 0): string {
  const stopStr = stops.map(formatStop).join(', ');
  return `conic-gradient(from ${angle}deg, ${stopStr})`;
}

/**
 * Interpolate between two hex colors at position t (0=colorA, 1=colorB).
 */
export function interpolateColor(colorA: string, colorB: string, t: number): string {
  const a = hexToRGB(colorA);
  const b = hexToRGB(colorB);
  const clampT = Math.min(1, Math.max(0, t));
  const r = Math.round(a.r + (b.r - a.r) * clampT);
  const g = Math.round(a.g + (b.g - a.g) * clampT);
  const bVal = Math.round(a.b + (b.b - a.b) * clampT);
  return rgbToHex(r, g, bVal);
}

/**
 * Generate N interpolated colors between start and end (inclusive).
 */
export function colorRange(start: string, end: string, n: number): string[] {
  if (n <= 0) return [];
  if (n === 1) return [start];
  return Array.from({ length: n }, (_, i) => interpolateColor(start, end, i / (n - 1)));
}

/**
 * Generate a CSS linear-gradient that transitions through an array of colors.
 * @param colors - Array of hex color strings.
 * @param angle - Gradient angle in degrees (default 90).
 */
export function multiStopGradient(colors: string[], angle = 90): string {
  const stops: ColorStop[] = colors.map((color, i) => ({
    color,
    position: colors.length === 1 ? 0 : Math.round((i / (colors.length - 1)) * 100),
  }));
  return linearGradient(stops, angle);
}

/**
 * Parse a CSS linear-gradient string into an angle and an array of ColorStops.
 * Returns null if parsing fails.
 *
 * Handles formats like:
 *   linear-gradient(90deg, #ff0000, #0000ff 50%, #00ff00)
 */
export function parseLinearGradient(css: string): { angle: number; stops: ColorStop[] } | null {
  const match = css.match(/^linear-gradient\(\s*([\s\S]*)\s*\)\s*$/i);
  if (!match) return null;

  const inner = match[1].trim();
  // Split on commas that are NOT inside parentheses
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of inner) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current.trim());

  if (parts.length === 0) return null;

  // First part may be an angle (e.g. "90deg" or "to right")
  let angle = 90;
  let startIdx = 0;

  const angleMatch = parts[0].match(/^(-?[\d.]+)deg$/i);
  const toMatch = parts[0].match(/^to\s+/i);
  if (angleMatch) {
    angle = parseFloat(angleMatch[1]);
    startIdx = 1;
  } else if (toMatch) {
    // Skip keyword directions (not converting them to degrees here)
    startIdx = 1;
  }

  const stops: ColorStop[] = [];
  for (let i = startIdx; i < parts.length; i++) {
    const part = parts[i].trim();
    // Match "color position%" or just "color"
    const stopMatch = part.match(/^(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|[a-zA-Z]+)\s*(?:([\d.]+)%)?$/);
    if (!stopMatch) return null;
    const color = stopMatch[1];
    const pos = stopMatch[2] !== undefined ? parseFloat(stopMatch[2]) : undefined;
    stops.push(pos !== undefined ? { color, position: pos } : { color });
  }

  if (stops.length === 0) return null;

  return { angle, stops };
}
