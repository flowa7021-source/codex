// @ts-check
// ─── Theme Manager ────────────────────────────────────────────────────────────
// CSS custom properties (CSS variables) based theme manager.
// Provides helpers to apply, read, write and persist themes.

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Theme definition: a Record of CSS variable names to values.
 * Keys should be valid CSS custom property names (e.g. '--color-primary').
 */
export type Theme = Record<string, string>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function rootElement(element?: Element): HTMLElement {
  return (element as HTMLElement | undefined) ?? document.documentElement;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Apply a theme by setting all CSS custom properties on an element.
 * Defaults to `document.documentElement`.
 */
export function applyTheme(theme: Theme, element?: Element): void {
  const el = rootElement(element);
  for (const [name, value] of Object.entries(theme)) {
    el.style.setProperty(name, value);
  }
}

/**
 * Get the current computed value of a CSS custom property.
 * Defaults to `document.documentElement`.
 */
export function getCSSVariable(name: string, element?: Element): string {
  const el = rootElement(element);
  return getComputedStyle(el).getPropertyValue(name).trim();
}

/**
 * Set a single CSS custom property on an element.
 * Defaults to `document.documentElement`.
 */
export function setCSSVariable(name: string, value: string, element?: Element): void {
  const el = rootElement(element);
  el.style.setProperty(name, value);
}

/**
 * Remove a CSS custom property from an element.
 * Defaults to `document.documentElement`.
 */
export function removeCSSVariable(name: string, element?: Element): void {
  const el = rootElement(element);
  el.style.removeProperty(name);
}

/**
 * Create a new theme by merging a base theme with partial overrides.
 * Override keys replace matching base keys; all other base keys are kept.
 */
export function createTheme(base: Theme, overrides: Partial<Theme>): Theme {
  const result: Theme = { ...base };
  for (const [key, value] of Object.entries(overrides)) {
    if (value !== undefined) result[key] = value;
  }
  return result;
}

/**
 * Persist a theme to localStorage under the given key.
 */
export function saveTheme(key: string, theme: Theme): void {
  localStorage.setItem(key, JSON.stringify(theme));
}

/**
 * Load a theme from localStorage.
 * Returns null if the key is absent or the stored value cannot be parsed.
 */
export function loadTheme(key: string): Theme | null {
  const raw = localStorage.getItem(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as Theme;
  } catch {
    return null;
  }
}
