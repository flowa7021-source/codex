// ─── HTML Sanitizer ───────────────────────────────────────────────────────────
// Safe HTML sanitization for OCR output, paste content, and search highlights.
// Uses the native Sanitizer API (Chrome 105+) with a DOMParser fallback.

// ─── Default Allowed Tags / Attributes ───────────────────────────────────────

const DEFAULT_ALLOWED_TAGS = ['b', 'i', 'u', 'strong', 'em', 'p', 'br', 'span', 'a', 'mark'];
const DEFAULT_ALLOWED_ATTRS = ['href', 'title', 'class', 'id'];
const DANGEROUS_ATTRS = ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur',
  'onchange', 'onsubmit', 'onkeydown', 'onkeyup', 'onkeypress', 'style'];

// ─── Sanitizer API Types ──────────────────────────────────────────────────────

interface SanitizerConfig {
  allowElements?: string[];
  allowAttributes?: Record<string, string[]>;
}

interface NativeSanitizer {
  sanitize(el: Element | DocumentFragment): DocumentFragment;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Sanitizer: new (config?: SanitizerConfig) => NativeSanitizer;

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns true if the native Sanitizer API is available.
 */
export function isSanitizerSupported(): boolean {
  return 'Sanitizer' in globalThis;
}

/**
 * Sanitizes an HTML string. Uses the native Sanitizer API if available;
 * falls back to DOMParser + manual DOM traversal otherwise.
 */
export function sanitizeHtml(
  html: string,
  opts?: { allowedTags?: string[]; allowedAttributes?: string[] },
): string {
  const allowedTags = opts?.allowedTags ?? DEFAULT_ALLOWED_TAGS;
  const allowedAttrs = opts?.allowedAttributes ?? DEFAULT_ALLOWED_ATTRS;

  if (isSanitizerSupported()) {
    return _sanitizeWithNativeApi(html, allowedTags, allowedAttrs);
  }
  return _sanitizeWithFallback(html, allowedTags, allowedAttrs);
}

function _sanitizeWithNativeApi(
  html: string,
  allowedTags: string[],
  allowedAttrs: string[],
): string {
  try {
    const container = document.createElement('div');
    container.innerHTML = html;
    const attrRecord: Record<string, string[]> = {};
    for (const attr of allowedAttrs) {
      attrRecord[attr] = ['*'];
    }
    const sanitizer = new Sanitizer({
      allowElements: allowedTags,
      allowAttributes: attrRecord,
    });
    const fragment = sanitizer.sanitize(container);
    const out = document.createElement('div');
    out.appendChild(fragment);
    return out.innerHTML;
  } catch {
    return _sanitizeWithFallback(html, allowedTags, allowedAttrs);
  }
}

function _sanitizeWithFallback(
  html: string,
  allowedTags: string[],
  allowedAttrs: string[],
): string {
  // Pre-strip dangerous block elements (script, style, iframe, etc.) including
  // their content before DOM parsing, because minimal DOM mocks may not parse
  // HTML into a real node tree.
  const dangerous = ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button'];
  let sanitized = html;
  for (const tag of dangerous) {
    sanitized = sanitized.replace(new RegExp(`<${tag}[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi'), '');
    sanitized = sanitized.replace(new RegExp(`<${tag}[^>]*/?>`, 'gi'), '');
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(sanitized, 'text/html');
    const body = doc.body;
    _cleanNode(body, allowedTags, allowedAttrs);
    return body.innerHTML;
  } catch {
    // Last resort: strip all remaining tags
    return stripTags(sanitized);
  }
}

function _cleanNode(node: Element, allowedTags: string[], allowedAttrs: string[]): void {
  const children = Array.from(node.childNodes);
  for (const child of children) {
    if (child.nodeType === 3 /* TEXT_NODE */) {
      // Text nodes are safe
      continue;
    }
    if (child.nodeType === 1 /* ELEMENT_NODE */) {
      const el = child as Element;
      const tag = el.tagName.toLowerCase();
      if (!allowedTags.includes(tag)) {
        // Replace the element with its children (unwrap)
        while (el.firstChild) {
          node.insertBefore(el.firstChild, el);
        }
        node.removeChild(el);
      } else {
        // Strip dangerous and non-allowed attributes
        const attrsToRemove: string[] = [];
        for (let i = 0; i < el.attributes.length; i++) {
          const attr = el.attributes[i];
          const attrLower = attr.name.toLowerCase();
          if (!allowedAttrs.includes(attrLower) || DANGEROUS_ATTRS.includes(attrLower)) {
            attrsToRemove.push(attr.name);
          }
        }
        for (const attr of attrsToRemove) {
          el.removeAttribute(attr);
        }
        // Recurse into allowed element
        _cleanNode(el, allowedTags, allowedAttrs);
      }
    } else {
      // Remove comments, processing instructions, etc.
      node.removeChild(child);
    }
  }
}

/**
 * Escapes HTML special characters for safe text insertion.
 */
export function sanitizeText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Returns HTML with <mark> tags wrapping all occurrences of the query string.
 * Both the text and the query are escaped to prevent XSS.
 */
export function sanitizeSearchHighlight(text: string, query: string): string {
  if (!query || !query.trim()) {
    return sanitizeText(text);
  }
  // Escape regex special characters in the query
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escapedQuery})`, 'gi');

  const parts = text.split(regex);
  return parts
    .map((part) => {
      if (part.toLowerCase() === query.toLowerCase()) {
        return `<mark>${sanitizeText(part)}</mark>`;
      }
      return sanitizeText(part);
    })
    .join('');
}

/**
 * Removes all HTML tags from a string and returns plain text.
 */
export function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

/**
 * Returns true if the URL is safe (http, https, or data:image/*).
 * Rejects javascript: URLs and data: URLs for non-image content.
 */
export function isSafeUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim().toLowerCase();

  // Block javascript: protocol
  if (trimmed.startsWith('javascript:')) return false;

  // Allow http and https
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return true;

  // Allow data: only for images
  if (trimmed.startsWith('data:image/')) return true;

  // Block all other data: URLs (e.g., data:text/html)
  if (trimmed.startsWith('data:')) return false;

  return false;
}

/**
 * Strips all HTML from OCR output, returning plain text only.
 */
export function sanitizeOcrOutput(raw: string): string {
  return stripTags(raw);
}
