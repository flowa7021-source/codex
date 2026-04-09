// @ts-check
// ─── CSS Generator ───────────────────────────────────────────────────────────
// CSS class and style generation utilities — no DOM.

// ─── Types ───────────────────────────────────────────────────────────────────

export interface StyleMap {
  [property: string]: string | number;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/** Convert a style object to inline CSS string. */
export function styleToString(styles: StyleMap): string {
  return Object.entries(styles)
    .map(([prop, value]) => `${camelToKebab(prop)}: ${value};`)
    .join(' ');
}

/** Convert a CSS string to style object. */
export function parseInlineStyle(css: string): StyleMap {
  const result: StyleMap = {};
  for (const declaration of css.split(';')) {
    const trimmed = declaration.trim();
    if (!trimmed) continue;
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;
    const prop = trimmed.slice(0, colonIdx).trim();
    const value = trimmed.slice(colonIdx + 1).trim();
    if (prop && value) {
      result[kebabToCamel(prop)] = value;
    }
  }
  return result;
}

/** Generate CSS custom property (variable) declarations. */
export function cssVars(vars: Record<string, string | number>, prefix = ''): string {
  const fullPrefix = prefix ? `--${prefix}-` : '--';
  return Object.entries(vars)
    .map(([key, value]) => `${fullPrefix}${key}: ${value};`)
    .join(' ');
}

/** Build a CSS class selector string from conditional classes. */
export function classNames(...args: (string | Record<string, boolean> | null | undefined | false)[]): string {
  const classes: string[] = [];
  for (const arg of args) {
    if (!arg) continue;
    if (typeof arg === 'string') {
      const trimmed = arg.trim();
      if (trimmed) classes.push(trimmed);
    } else if (typeof arg === 'object') {
      for (const [key, enabled] of Object.entries(arg)) {
        if (enabled) classes.push(key);
      }
    }
  }
  return classes.join(' ');
}

/** Convert camelCase property to kebab-case CSS property. */
export function camelToKebab(prop: string): string {
  return prop.replace(/([A-Z])/g, (match) => `-${match.toLowerCase()}`);
}

/** Convert kebab-case CSS property to camelCase. */
export function kebabToCamel(prop: string): string {
  return prop.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}

/** Generate a media query string. */
export function mediaQuery(condition: string, styles: StyleMap): string {
  const body = styleToString(styles);
  return `@media ${condition} { ${body} }`;
}

/** Generate CSS keyframe animation string. */
export function keyframes(name: string, frames: Record<string, StyleMap>): string {
  const frameStrings = Object.entries(frames)
    .map(([stop, styles]) => {
      const body = styleToString(styles);
      return `${stop} { ${body} }`;
    })
    .join(' ');
  return `@keyframes ${name} { ${frameStrings} }`;
}

/** Escape a CSS selector string. */
export function escapeSelector(selector: string): string {
  // Escape characters that have special meaning in CSS selectors
  return selector.replace(/([!"#$%&'()*+,.\/:;<=>?@[\\\]^`{|}~])/g, '\\$1');
}

/** Merge multiple StyleMaps (later ones override earlier). */
export function mergeStyles(...styles: StyleMap[]): StyleMap {
  return Object.assign({}, ...styles);
}
