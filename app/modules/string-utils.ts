// @ts-check
// ─── String Utilities ─────────────────────────────────────────────────────────
// General-purpose string manipulation helpers.

// ─── Internal helpers ────────────────────────────────────────────────────────

/** Split a string into words (handles camelCase, PascalCase, snake_case, kebab-case, spaces). */
function splitIntoWords(str: string): string[] {
  // Insert space before uppercase letters following lowercase (camelCase)
  const withSpaces = str
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');

  return withSpaces
    .split(/[-_\s]+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 0);
}

// ─── Case conversion ─────────────────────────────────────────────────────────

/** Convert a string to camelCase. e.g. 'hello world' → 'helloWorld' */
export function camelCase(str: string): string {
  const ws = splitIntoWords(str);
  if (ws.length === 0) return '';
  return ws[0].toLowerCase() + ws.slice(1).map((w) => capitalize(w.toLowerCase())).join('');
}

/** Convert a string to snake_case. e.g. 'helloWorld' → 'hello_world' */
export function snakeCase(str: string): string {
  return splitIntoWords(str).map((w) => w.toLowerCase()).join('_');
}

/** Convert a string to kebab-case. e.g. 'helloWorld' → 'hello-world' */
export function kebabCase(str: string): string {
  return splitIntoWords(str).map((w) => w.toLowerCase()).join('-');
}

/** Convert a string to PascalCase. e.g. 'hello world' → 'HelloWorld' */
export function pascalCase(str: string): string {
  return splitIntoWords(str).map((w) => capitalize(w.toLowerCase())).join('');
}

/** Convert a string to Title Case. e.g. 'hello world' → 'Hello World' */
export function titleCase(str: string): string {
  return splitIntoWords(str).map((w) => capitalize(w.toLowerCase())).join(' ');
}

// ─── Padding / truncation ────────────────────────────────────────────────────

/**
 * Pad a string on the left to at least `length` characters.
 * Uses `char` as the pad character (default `' '`).
 */
export function padLeft(str: string, length: number, char = ' '): string {
  const pad = char.length > 0 ? char[0] : ' ';
  if (str.length >= length) return str;
  return pad.repeat(length - str.length) + str;
}

/**
 * Pad a string on the right to at least `length` characters.
 * Uses `char` as the pad character (default `' '`).
 */
export function padRight(str: string, length: number, char = ' '): string {
  const pad = char.length > 0 ? char[0] : ' ';
  if (str.length >= length) return str;
  return str + pad.repeat(length - str.length);
}

/**
 * Truncate `str` to `maxLength` characters (including `ellipsis`).
 * Default ellipsis is `'...'`. Returns the original string if it fits.
 */
export function truncate(str: string, maxLength: number, ellipsis = '...'): string {
  if (str.length <= maxLength) return str;
  const cutAt = maxLength - ellipsis.length;
  if (cutAt <= 0) return ellipsis.slice(0, maxLength);
  return str.slice(0, cutAt) + ellipsis;
}

// ─── Checking / searching ────────────────────────────────────────────────────

/** Return true if the string reads the same forwards and backwards (ignores case and non-alphanumeric). */
export function isPalindrome(str: string): boolean {
  const cleaned = str.toLowerCase().replace(/[^a-z0-9]/g, '');
  return cleaned === [...cleaned].reverse().join('');
}

/**
 * Return true if `a` and `b` are anagrams of each other.
 * Case-insensitive; ignores non-alphabetic characters.
 */
export function isAnagram(a: string, b: string): boolean {
  const normalise = (s: string) =>
    s.toLowerCase().replace(/[^a-z]/g, '').split('').sort().join('');
  return normalise(a) === normalise(b);
}

/**
 * Count non-overlapping occurrences of `sub` in `str`.
 * Returns 0 if `sub` is empty.
 */
export function countOccurrences(str: string, sub: string): number {
  if (!sub) return 0;
  let count = 0;
  let pos = 0;
  while ((pos = str.indexOf(sub, pos)) !== -1) {
    count++;
    pos += sub.length;
  }
  return count;
}

// ─── Transformation ──────────────────────────────────────────────────────────

/** Reverse a string (Unicode-aware via spread). */
export function reverse(str: string): string {
  return [...str].reverse().join('');
}

/** Capitalise the first character of a string; leave the rest unchanged. */
export function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Split a string into words on whitespace and Unicode punctuation boundaries.
 * Returns an empty array for empty or whitespace-only input.
 */
export function words(str: string): string[] {
  return str.split(/[\s\p{P}]+/u).filter((w) => w.length > 0);
}

/**
 * Word-wrap `str` so that no line exceeds `lineWidth` characters.
 * Wraps on word boundaries; words longer than `lineWidth` are placed on their own line.
 */
export function wrap(str: string, lineWidth: number, newline = '\n'): string {
  if (lineWidth <= 0) return str;
  const ws = str.split(/\s+/).filter((w) => w.length > 0);
  if (ws.length === 0) return '';
  const lines: string[] = [];
  let current = '';

  for (const word of ws) {
    if (!current) {
      current = word;
    } else if (current.length + 1 + word.length <= lineWidth) {
      current += ' ' + word;
    } else {
      lines.push(current);
      current = word;
    }
  }

  if (current) lines.push(current);
  return lines.join(newline);
}

/**
 * Strip diacritical marks (accents) from a string using Unicode NFD normalisation.
 * e.g. `'café'` → `'cafe'`.
 */
export function stripDiacritics(str: string): string {
  return str.normalize('NFD').replace(/\p{M}/gu, '');
}

// ─── Template ────────────────────────────────────────────────────────────────

/**
 * Simple template interpolation: replace `{key}` placeholders with values from `vars`.
 * e.g. `interpolate('Hello {name}!', { name: 'World' })` → `'Hello World!'`
 * Unknown placeholders are left unchanged.
 */
export function interpolate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => {
    return key in vars ? String(vars[key]) : _match;
  });
}

// ─── Similarity ──────────────────────────────────────────────────────────────

/**
 * Compute the Hamming distance between two strings.
 * Throws a `RangeError` if the strings have different lengths.
 */
export function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) {
    throw new RangeError(
      `hammingDistance: strings must have the same length (got ${a.length} and ${b.length})`,
    );
  }
  let distance = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) distance++;
  }
  return distance;
}

/**
 * Find the longest common prefix shared by all strings in the array.
 * Returns an empty string for an empty input array or when there is no common prefix.
 */
export function longestCommonPrefix(strings: string[]): string {
  if (strings.length === 0) return '';
  let prefix = strings[0];
  for (let i = 1; i < strings.length; i++) {
    while (!strings[i].startsWith(prefix)) {
      prefix = prefix.slice(0, -1);
      if (prefix.length === 0) return '';
    }
  }
  return prefix;
}
