// @ts-check
// ─── String Utilities ────────────────────────────────────────────────────────
// General-purpose string manipulation helpers.

// ─── Public API ──────────────────────────────────────────────────────────────

/** Capitalize the first letter of a string. */
export function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/** Convert camelCase to kebab-case. */
export function camelToKebab(str: string): string {
  return str.replace(/([A-Z])/g, (match) => `-${match.toLowerCase()}`);
}

/** Convert kebab-case to camelCase. */
export function kebabToCamel(str: string): string {
  return str.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());
}

/** Convert a string to snake_case. */
export function toSnakeCase(str: string): string {
  return splitWords(str)
    .map((w) => w.toLowerCase())
    .join('_');
}

/** Truncate a string to maxLength, appending suffix if truncated. */
export function truncate(str: string, maxLength: number, suffix = '...'): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - suffix.length) + suffix;
}

/** Pad a string to the left with a character. */
export function padLeft(str: string, length: number, char = ' '): string {
  if (str.length >= length) return str;
  const pad = char.charAt(0) || ' ';
  return pad.repeat(length - str.length) + str;
}

/** Pad a string to the right with a character. */
export function padRight(str: string, length: number, char = ' '): string {
  if (str.length >= length) return str;
  const pad = char.charAt(0) || ' ';
  return str + pad.repeat(length - str.length);
}

/** Count occurrences of a substring in a string. */
export function countOccurrences(str: string, substring: string): number {
  if (!substring) return 0;
  let count = 0;
  let pos = 0;
  while ((pos = str.indexOf(substring, pos)) !== -1) {
    count++;
    pos += substring.length;
  }
  return count;
}

/** Reverse a string. */
export function reverseString(str: string): string {
  return [...str].reverse().join('');
}

/** Check if a string is a palindrome (ignores case and non-alphanumeric). */
export function isPalindrome(str: string): boolean {
  const cleaned = str.toLowerCase().replace(/[^a-z0-9]/g, '');
  return cleaned === [...cleaned].reverse().join('');
}

/** Escape regex special characters in a string. */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Generate a simple slug from a string (lowercase, hyphens). */
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Split a string into words (handles camelCase, snake_case, kebab-case). */
export function splitWords(str: string): string[] {
  // Insert space before uppercase letters (camelCase)
  const withSpaces = str
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');

  // Split on underscores, hyphens, and spaces
  return withSpaces
    .split(/[-_\s]+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 0);
}

/** Wrap text at a given column width, preserving words. */
export function wordWrap(str: string, width: number): string[] {
  if (width <= 0) return [str];

  const words = str.split(/\s+/).filter((w) => w.length > 0);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    if (!current) {
      current = word;
    } else if (current.length + 1 + word.length <= width) {
      current += ' ' + word;
    } else {
      lines.push(current);
      current = word;
    }
  }

  if (current) lines.push(current);

  return lines;
}
