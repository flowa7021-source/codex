// @ts-check
// ─── String Utilities ────────────────────────────────────────────────────────
// Comprehensive string manipulation helpers: case conversions, trimming,
// padding, truncation, testing, and transformation. No DOM, no side-effects.

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Split a string into lowercase word tokens, handling camelCase, PascalCase,
 * spaces, dashes, and underscores.
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

/** Convert a string to Title Case. 'hello world' → 'Hello World' */
export function titleCase(str: string): string {
  return splitWords(str)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/** Convert a string to CONSTANT_CASE. 'helloWorld' → 'HELLO_WORLD' */
export function constantCase(str: string): string {
  return splitWords(str)
    .map((w) => w.toUpperCase())
    .join('_');
}

// ─── Trimming & padding ───────────────────────────────────────────────────────

/**
 * Trim leading and trailing characters from a string.
 * When `chars` is omitted, trims whitespace (same as String.prototype.trim).
 * When provided, trims any character in the `chars` set from both ends.
 */
export function trim(str: string, chars?: string): string {
  if (chars === undefined) return str.trim();
  return trimStart(trimEnd(str, chars), chars);
}

/**
 * Trim leading characters from a string.
 * When `chars` is omitted, trims whitespace.
 */
export function trimStart(str: string, chars?: string): string {
  if (chars === undefined) return str.trimStart();
  let start = 0;
  while (start < str.length && chars.includes(str[start])) start++;
  return str.slice(start);
}

/**
 * Trim trailing characters from a string.
 * When `chars` is omitted, trims whitespace.
 */
export function trimEnd(str: string, chars?: string): string {
  if (chars === undefined) return str.trimEnd();
  let end = str.length;
  while (end > 0 && chars.includes(str[end - 1])) end--;
  return str.slice(0, end);
}

/**
 * Pad the start of a string to a target length with a fill character.
 * Default fill character is a space ' '.
 */
export function padStart(str: string, len: number, char = ' '): string {
  const fill = char.length > 0 ? char[0] : ' ';
  if (str.length >= len) return str;
  return fill.repeat(len - str.length) + str;
}

/**
 * Pad the end of a string to a target length with a fill character.
 * Default fill character is a space ' '.
 */
export function padEnd(str: string, len: number, char = ' '): string {
  const fill = char.length > 0 ? char[0] : ' ';
  if (str.length >= len) return str;
  return str + fill.repeat(len - str.length);
}

// ─── Truncation ───────────────────────────────────────────────────────────────

/**
 * Truncate a string to at most `maxLen` characters (including the suffix).
 * Default suffix is '...'. Returns the original string if it fits.
 */
export function truncate(str: string, maxLen: number, suffix = '...'): string {
  if (str.length <= maxLen) return str;
  const cutAt = Math.max(0, maxLen - suffix.length);
  return str.slice(0, cutAt) + suffix;
}

/**
 * Truncate a string to at most `maxWords` words, appending `suffix` if truncated.
 * Default suffix is '...'.
 */
export function truncateWords(str: string, maxWords: number, suffix = '...'): string {
  const wordList = str.trim().split(/\s+/);
  if (wordList.length <= maxWords || (wordList.length === 1 && wordList[0] === '')) {
    return str;
  }
  return wordList.slice(0, maxWords).join(' ') + suffix;
}

// ─── Testing ──────────────────────────────────────────────────────────────────

/** Return true if `str` starts with `prefix`. */
export function startsWith(str: string, prefix: string): boolean {
  return str.startsWith(prefix);
}

/** Return true if `str` ends with `suffix`. */
export function endsWith(str: string, suffix: string): boolean {
  return str.endsWith(suffix);
}

/** Return true if `str` contains `substr`. */
export function includes(str: string, substr: string): boolean {
  return str.includes(substr);
}

/** Return true if `str` is empty or contains only whitespace. */
export function isBlank(str: string): boolean {
  return str.trim().length === 0;
}

/**
 * Return true if `str` is a palindrome.
 * Ignores case and all non-alphanumeric characters.
 */
export function isPalindrome(str: string): boolean {
  const cleaned = str.toLowerCase().replace(/[^a-z0-9]/g, '');
  const reversed = cleaned.split('').reverse().join('');
  return cleaned === reversed;
}

// ─── Transformation ───────────────────────────────────────────────────────────

/** Reverse a string. */
export function reverse(str: string): string {
  return str.split('').reverse().join('');
}

/**
 * Repeat a string `n` times.
 * Returns an empty string for n ≤ 0.
 */
export function repeat(str: string, n: number): string {
  if (n <= 0) return '';
  return str.repeat(n);
}

/**
 * Replace all occurrences of `search` in `str` with `replacement`.
 * Uses literal string matching (not regex).
 */
export function replaceAll(str: string, search: string, replacement: string): string {
  if (search === '') return str;
  return str.split(search).join(replacement);
}

/**
 * Count the number of non-overlapping occurrences of `substr` in `str`.
 * Returns 0 when `substr` is empty.
 */
export function countOccurrences(str: string, substr: string): number {
  if (substr === '') return 0;
  let count = 0;
  let pos = 0;
  while ((pos = str.indexOf(substr, pos)) !== -1) {
    count++;
    pos += substr.length;
  }
  return count;
}

/**
 * Split a string into words, handling camelCase, PascalCase, spaces, dashes,
 * and underscores. Returns segments with their original casing preserved.
 */
export function words(str: string): string[] {
  if (!str) return [];
  const spaced = str
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return spaced.split(/[^a-zA-Z\d]+/).filter((w) => w.length > 0);
}

/**
 * Convert a string to a URL-friendly slug.
 * 'Hello World!' → 'hello-world'
 */
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s-]+/g, '-');
}

/**
 * Escape HTML special characters in a string.
 * & < > " ' are replaced with their HTML entities.
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
 * Unescape HTML entities back to their original characters.
 * Reverses the output of `escapeHtml`.
 */
export function unescapeHtml(str: string): string {
  return str
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&');
}

/** Strip all HTML tags from a string, leaving only text content. */
export function stripHtml(str: string): string {
  return str.replace(/<[^>]*>/g, '');
}

/**
 * Wrap a string at word boundaries so no line exceeds `width` characters.
 * Lines are joined with '\n'. Words longer than `width` are placed on their
 * own line without splitting.
 */
export function wrapAt(str: string, width: number): string {
  const wordList = str.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of wordList) {
    if (word === '') continue;
    if (currentLine === '') {
      currentLine = word;
    } else if (currentLine.length + 1 + word.length <= width) {
      currentLine += ' ' + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine !== '') lines.push(currentLine);
  return lines.join('\n');
}

/**
 * Interpolate a template string, replacing `{key}` placeholders with values
 * from the `vars` record.
 * 'Hello {name}!' with { name: 'Alice' } → 'Hello Alice!'
 * Missing keys are left unchanged.
 */
export function interpolate(template: string, vars: Record<string, unknown>): string {
  return template.replace(/\{([^{}]+)\}/g, (match, key: string) => {
    const k = key.trim();
    return Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k]) : match;
  });
}
