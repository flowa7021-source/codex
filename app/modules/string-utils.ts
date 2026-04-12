// @ts-check
// ─── String Utilities ────────────────────────────────────────────────────────
// Pure string helper functions: case conversion, padding, truncation,
// HTML escaping, slug generation, validation, and more.

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Split a string into word tokens, handling camelCase, PascalCase, spaces,
 * dashes, and underscores.
 */
function splitWords(str: string): string[] {
  if (!str) return [];
  const spaced = str
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return spaced.split(/[^a-zA-Z\d]+/).filter((w) => w.length > 0);
}

// ─── Case conversions ─────────────────────────────────────────────────────────

/** Convert a string to camelCase. 'hello world' → 'helloWorld' */
export function camelCase(str: string): string {
  const parts = splitWords(str);
  if (parts.length === 0) return '';
  return (
    parts[0].toLowerCase() +
    parts
      .slice(1)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join('')
  );
}

/** Convert a string to PascalCase. 'hello world' → 'HelloWorld' */
export function pascalCase(str: string): string {
  return splitWords(str)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('');
}

/** Convert a string to snake_case. 'helloWorld' → 'hello_world' */
export function snakeCase(str: string): string {
  return splitWords(str)
    .map((w) => w.toLowerCase())
    .join('_');
}

/** Convert a string to kebab-case. 'helloWorld' → 'hello-world' */
export function kebabCase(str: string): string {
  return splitWords(str)
    .map((w) => w.toLowerCase())
    .join('-');
}

/**
 * Convert a string to Title Case (first letter of each whitespace-delimited
 * word uppercased, rest lowercased). 'hello world' → 'Hello World'
 */
export function titleCase(str: string): string {
  if (str === '') return '';
  return str.replace(/\S+/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

/**
 * Uppercase the very first character; leave the rest of the string unchanged.
 * 'hello World' → 'Hello World'
 */
export function capitalize(str: string): string {
  if (str === '') return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ─── Truncation & padding ─────────────────────────────────────────────────────

/**
 * Truncate `str` to at most `maxLength` characters.
 * If the string is longer, it is cut and `ellipsis` (default `'...'`) is appended.
 * The total result length will not exceed `maxLength`.
 */
export function truncate(str: string, maxLength: number, ellipsis = '...'): string {
  if (str.length <= maxLength) return str;
  const cutAt = Math.max(0, maxLength - ellipsis.length);
  return str.slice(0, cutAt) + ellipsis;
}

/**
 * Pad `str` on the left to `length` using `char` (default `' '`).
 * If `str` is already at least `length` characters, it is returned unchanged.
 */
export function padStart(str: string, length: number, char = ' '): string {
  const fill = char.length > 0 ? char[0] : ' ';
  if (str.length >= length) return str;
  return fill.repeat(length - str.length) + str;
}

/**
 * Pad `str` on the right to `length` using `char` (default `' '`).
 * If `str` is already at least `length` characters, it is returned unchanged.
 */
export function padEnd(str: string, length: number, char = ' '): string {
  const fill = char.length > 0 ? char[0] : ' ';
  if (str.length >= length) return str;
  return str + fill.repeat(length - str.length);
}

// ─── Repetition & reversal ────────────────────────────────────────────────────

/**
 * Repeat `str` exactly `count` times.
 * Throws a `RangeError` for negative `count`.
 */
export function repeat(str: string, count: number): string {
  if (count < 0) throw new RangeError(`repeat count must be non-negative, got ${count}`);
  return str.repeat(count);
}

/** Reverse the characters in `str`. */
export function reverse(str: string): string {
  return [...str].reverse().join('');
}

// ─── Palindrome ───────────────────────────────────────────────────────────────

/**
 * Return `true` if `str` is a palindrome.
 * The comparison is case-insensitive and ignores all non-alphanumeric characters.
 */
export function isPalindrome(str: string): boolean {
  const clean = str.toLowerCase().replace(/[^a-z0-9]/g, '');
  const rev = [...clean].reverse().join('');
  return clean === rev;
}

// ─── Occurrences ──────────────────────────────────────────────────────────────

/**
 * Count the number of non-overlapping occurrences of `sub` within `str`.
 * Returns 0 if `sub` is an empty string.
 */
export function countOccurrences(str: string, sub: string): number {
  if (sub === '') return 0;
  let count = 0;
  let pos = 0;
  while ((pos = str.indexOf(sub, pos)) !== -1) {
    count++;
    pos += sub.length;
  }
  return count;
}

// ─── HTML ─────────────────────────────────────────────────────────────────────

/** Remove all HTML tags from `str`. */
export function stripHtml(str: string): string {
  return str.replace(/<[^>]*>/g, '');
}

/**
 * Escape `&`, `<`, `>`, `"`, and `'` for safe embedding in HTML.
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Reverse the escaping applied by `escapeHtml`.
 */
export function unescapeHtml(str: string): string {
  return str
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&');
}

// ─── Slugify ──────────────────────────────────────────────────────────────────

/**
 * Convert `str` to a URL-friendly slug: lowercase, replace spaces and
 * special characters with hyphens, collapse consecutive hyphens, and trim
 * leading/trailing hyphens.
 */
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ─── Counting ─────────────────────────────────────────────────────────────────

/**
 * Count the number of words in `str` (split by whitespace).
 * An empty or whitespace-only string has 0 words.
 */
export function wordCount(str: string): number {
  const trimmed = str.trim();
  if (trimmed === '') return 0;
  return trimmed.split(/\s+/).length;
}

/**
 * Count the number of lines in `str` (split by `\n`).
 * An empty string is considered to have 1 line.
 */
export function lineCount(str: string): number {
  return str.split('\n').length;
}

// ─── Line manipulation ────────────────────────────────────────────────────────

/** Trim leading and trailing whitespace from each line in `str`. */
export function trimLines(str: string): string {
  return str
    .split('\n')
    .map((line) => line.trim())
    .join('\n');
}

/**
 * Remove the common leading whitespace prefix from every non-empty line in `str`.
 * Whitespace-only lines are preserved unchanged; they do not influence the
 * common-indent calculation.
 */
export function dedent(str: string): string {
  const lines = str.split('\n');
  const nonEmpty = lines.filter((l) => l.trim() !== '');
  if (nonEmpty.length === 0) return str;

  const minIndent = nonEmpty.reduce((min, line) => {
    const match = line.match(/^(\s*)/);
    const indent = match ? match[1].length : 0;
    return Math.min(min, indent);
  }, Infinity);

  return lines
    .map((line) => (line.trim() === '' ? line : line.slice(minIndent)))
    .join('\n');
}

// ─── Interpolation ────────────────────────────────────────────────────────────

/**
 * Replace `{{key}}` placeholders in `template` with the corresponding values
 * from `vars`. Unknown keys are left as-is (the placeholder text is kept).
 */
export function interpolate(template: string, vars: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    return Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : match;
  });
}

// ─── Random string ────────────────────────────────────────────────────────────

const DEFAULT_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/**
 * Generate a random string of exactly `length` characters chosen from `chars`.
 * Default character set is alphanumeric (A-Z, a-z, 0-9).
 */
export function randomString(length: number, chars = DEFAULT_CHARS): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

// ─── Validation ───────────────────────────────────────────────────────────────

/** Return `true` if `str` looks like a valid email address (basic regex check). */
export function isEmail(str: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
}

/** Return `true` if `str` looks like a valid http or https URL (basic regex check). */
export function isUrl(str: string): boolean {
  return /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(str);
}
