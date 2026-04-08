// ─── Text Fragment URL Utilities ─────────────────────────────────────────────
// Utilities for building and parsing Text Fragment URLs (#:~:text=...) used
// for deep-linking to specific text within PDFs.
// See: https://wicg.github.io/scroll-to-text-fragment/

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Build a URL with a Text Fragment directive pointing to the given text.
 * Optionally includes a prefix and/or suffix for disambiguation.
 *
 * Format: `baseUrl#:~:text=prefix-,text,-suffix`
 *
 * @param baseUrl - The base URL (without fragment)
 * @param text    - The text to highlight/scroll to
 * @param opts    - Optional prefix and suffix for disambiguation
 */
export function buildTextFragmentUrl(
  baseUrl: string,
  text: string,
  opts?: { prefix?: string; suffix?: string },
): string {
  const parts: string[] = [];

  if (opts?.prefix) {
    parts.push(encodeURIComponent(opts.prefix) + '-,');
  }

  parts.push(encodeURIComponent(text));

  if (opts?.suffix) {
    parts.push(',-' + encodeURIComponent(opts.suffix));
  }

  return baseUrl + '#:~:text=' + parts.join('');
}

/**
 * Parse a `#:~:text=...` Text Fragment from a URL.
 * Returns null if no text fragment directive is present.
 *
 * @param url - The full URL string to parse
 */
export function parseTextFragment(
  url: string,
): { text: string; prefix?: string; suffix?: string } | null {
  const hashIdx = url.indexOf('#:~:text=');
  if (hashIdx === -1) return null;

  const raw = url.slice(hashIdx + '#:~:text='.length);

  // The raw value may have additional directives separated by '&'
  const directive = raw.split('&')[0];

  // Format: [prefix-,]text[,-suffix]
  // prefix ends with '-,' and suffix starts with ',-'
  let remaining = directive;
  let prefix: string | undefined;
  let suffix: string | undefined;

  // Extract prefix: anything before '-,'
  const prefixMatch = remaining.match(/^(.*?)-,([\s\S]*)$/);
  if (prefixMatch) {
    prefix = decodeURIComponent(prefixMatch[1]);
    remaining = prefixMatch[2];
  }

  // Extract suffix: anything after ',-'
  const suffixMatch = remaining.match(/^([\s\S]*?),-(.*)$/);
  if (suffixMatch) {
    suffix = decodeURIComponent(suffixMatch[2]);
    remaining = suffixMatch[1];
  }

  const text = decodeURIComponent(remaining);
  if (!text) return null;

  const result: { text: string; prefix?: string; suffix?: string } = { text };
  if (prefix !== undefined) result.prefix = prefix;
  if (suffix !== undefined) result.suffix = suffix;

  return result;
}

/**
 * Whether text fragment navigation is supported.
 * Text fragments are a URL feature (not a JS API), so this always returns
 * true — the URL can always be constructed, even if the browser doesn't
 * visually scroll to the text.
 */
export function isTextFragmentSupported(): boolean {
  return true;
}

/**
 * Set `location.hash` to a text fragment directive to trigger native
 * scroll-to-text behaviour. No-op if `location` is not available.
 *
 * @param text - The text to scroll to
 */
export function scrollToTextFragment(text: string): void {
  try {
    if (typeof location === 'undefined') return;
    location.hash = '#:~:text=' + encodeURIComponent(text);
  } catch {
    // location not available or not writable — ignore
  }
}

/**
 * Remove any `#:~:text=...` Text Fragment directive from a URL, returning
 * the base URL. Normal `#anchor` fragments are preserved.
 *
 * @param url - The full URL string to strip
 */
export function stripTextFragment(url: string): string {
  const idx = url.indexOf('#:~:text=');
  if (idx === -1) return url;
  return url.slice(0, idx);
}
