// @ts-check
// ─── String Utilities ────────────────────────────────────────────────────────
// Comprehensive string manipulation helpers.

// ─── Public API ──────────────────────────────────────────────────────────────

/** Split a string into words (handles camelCase, PascalCase, snake_case, kebab-case, spaces). */
export function splitWords(str: string): string[] {
  // Insert space before uppercase letters following lowercase (camelCase)
  const withSpaces = str
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');

  return withSpaces
    .split(/[-_\s]+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 0);
}

/** Convert a string to camelCase. 'hello world' → 'helloWorld' */
export function camelCase(str: string): string {
  const words = splitWords(str);
  if (words.length === 0) return '';
  return words[0].toLowerCase() + words.slice(1).map((w) => capitalize(w.toLowerCase())).join('');
}

/** Convert a string to snake_case. 'helloWorld' → 'hello_world' */
export function snakeCase(str: string): string {
  return splitWords(str).map((w) => w.toLowerCase()).join('_');
}

/** Convert a string to kebab-case. 'helloWorld' → 'hello-world' */
export function kebabCase(str: string): string {
  return splitWords(str).map((w) => w.toLowerCase()).join('-');
}

/** Convert a string to PascalCase. 'hello world' → 'HelloWorld' */
export function pascalCase(str: string): string {
  return splitWords(str).map((w) => capitalize(w.toLowerCase())).join('');
}

/** Convert a string to Title Case. 'hello world' → 'Hello World' */
export function titleCase(str: string): string {
  return splitWords(str).map((w) => capitalize(w.toLowerCase())).join(' ');
}

/** Capitalize the first letter of a string. 'hello' → 'Hello' */
export function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/** Uncapitalize the first letter of a string. 'Hello' → 'hello' */
export function uncapitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toLowerCase() + str.slice(1);
}

/** Pad the start of a string to reach `len`, using `char` (default space). */
export function padStart(str: string, len: number, char = ' '): string {
  const pad = char.charAt(0) || ' ';
  if (str.length >= len) return str;
  return pad.repeat(len - str.length) + str;
}

/** Pad the end of a string to reach `len`, using `char` (default space). */
export function padEnd(str: string, len: number, char = ' '): string {
  const pad = char.charAt(0) || ' ';
  if (str.length >= len) return str;
  return str + pad.repeat(len - str.length);
}

/** Repeat a string `n` times. */
export function repeat(str: string, n: number): string {
  if (n <= 0) return '';
  return str.repeat(n);
}

/** Reverse a string (unicode-aware). */
export function reverse(str: string): string {
  return [...str].reverse().join('');
}

/** Check if a string is a palindrome (ignores case and non-alphanumeric). */
export function isPalindrome(str: string): boolean {
  const cleaned = str.toLowerCase().replace(/[^a-z0-9]/g, '');
  return cleaned === [...cleaned].reverse().join('');
}

/** Count non-overlapping occurrences of `sub` in `str`. */
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

/** Replace all occurrences of `search` with `replacement` (no regex). */
export function replaceAll(str: string, search: string, replacement: string): string {
  if (!search) return str;
  return str.split(search).join(replacement);
}

/** Trim a specific character from both ends of a string. */
export function trimChar(str: string, char: string): string {
  if (!char) return str;
  const c = char.charAt(0);
  const escaped = c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return str.replace(new RegExp(`^${escaped}+|${escaped}+$`, 'g'), '');
}

/** Word-wrap a string at `width` characters. Uses `newline` as line separator (default '\n'). */
export function wrap(str: string, width: number, newline = '\n'): string {
  if (width <= 0) return str;
  const words = str.split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return '';
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
  return lines.join(newline);
}

/** Generate a URL-safe slug from a string. 'Hello World!' → 'hello-world' */
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Interpolate a template string. 'Hi {name}' + {name: 'Alice'} → 'Hi Alice' */
export function interpolate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => {
    return key in vars ? String(vars[key]) : _match;
  });
}
