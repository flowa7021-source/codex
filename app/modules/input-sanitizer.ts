// @ts-check
// ─── Input Sanitizer ─────────────────────────────────────────────────────────
// Utilities for sanitizing and normalizing user-provided strings.

// ─── Public API ──────────────────────────────────────────────────────────────

/** Strip HTML tags from a string. */
export function stripHTML(input: string): string {
  return input.replace(/<[^>]*>/g, '');
}

/** Escape HTML special characters (<, >, &, ", '). */
export function escapeHTML(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Unescape HTML entities back to characters. */
export function unescapeHTML(input: string): string {
  return input
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&');
}

/** Sanitize a filename: remove path separators and dangerous chars. */
export function sanitizeFilename(input: string): string {
  // Remove null bytes, path separators, Windows-reserved chars, and leading dots/spaces
  return input
    .replace(/[\x00/\\]/g, '')       // null bytes, forward slash, backslash
    .replace(/\.\./g, '')             // directory traversal sequences
    .replace(/[<>:"|?*]/g, '')        // Windows-reserved characters
    .trim();
}

/** Normalize whitespace: trim and collapse multiple spaces to one. */
export function normalizeWhitespace(input: string): string {
  return input.trim().replace(/\s+/g, ' ');
}

/** Truncate to max length, adding ellipsis if needed. */
export function truncateText(input: string, maxLength: number, ellipsis = '…'): string {
  if (input.length <= maxLength) return input;
  return input.slice(0, maxLength - ellipsis.length) + ellipsis;
}

/** Remove non-printable/control characters (U+0000–U+001F and U+007F). */
export function removeControlChars(input: string): string {
  // eslint-disable-next-line no-control-regex
  return input.replace(/[\x00-\x1f\x7f]/g, '');
}

/** Sanitize a CSS class name: lowercase, replace invalid chars with hyphens. */
export function sanitizeCssClass(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '-')  // replace invalid chars with hyphens
    .replace(/-+/g, '-')            // collapse consecutive hyphens
    .replace(/^-+|-+$/g, '');       // remove leading/trailing hyphens
}

/** Sanitize a URL: only allow http/https schemes, return null for dangerous URLs. */
export function sanitizeURL(input: string): string | null {
  const trimmed = input.trim();
  try {
    const url = new URL(trimmed);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return trimmed;
    }
    return null;
  } catch {
    return null;
  }
}

/** Normalize line endings to \n. */
export function normalizeLineEndings(input: string): string {
  return input.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}
