// @ts-check
// ─── Validation Utilities ─────────────────────────────────────────────────────
// Common string and value validation functions.

// ─── Public API ───────────────────────────────────────────────────────────────

/** Check if a string is a valid email address. */
export function isEmail(v: string): boolean {
  // Local part: printable chars except @, domain: label.label pattern
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

/** Check if a string is a valid URL (http or https). */
export function isURL(v: string): boolean {
  try {
    const url = new URL(v);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Check if a string is a valid IPv4 address. */
export function isIPv4(v: string): boolean {
  const parts = v.split('.');
  if (parts.length !== 4) return false;
  return parts.every((part) => {
    if (!/^\d+$/.test(part)) return false;
    const n = Number(part);
    return n >= 0 && n <= 255 && String(n) === part;
  });
}

/** Check if a string is a valid IPv6 address. */
export function isIPv6(v: string): boolean {
  // Full form: 8 groups of 4 hex digits separated by colons
  // Compressed form: :: replaces one or more consecutive zero groups
  if (v === '::') return true;
  // Count :: occurrences — only one is allowed
  const doubleColonCount = (v.match(/::/g) || []).length;
  if (doubleColonCount > 1) return false;
  if (doubleColonCount === 1) {
    // Split on :: and validate each side
    const [left, right] = v.split('::');
    const leftGroups = left ? left.split(':') : [];
    const rightGroups = right ? right.split(':') : [];
    const totalGroups = leftGroups.length + rightGroups.length;
    if (totalGroups > 7) return false;
    return [...leftGroups, ...rightGroups].every((g) => /^[0-9a-fA-F]{1,4}$/.test(g));
  }
  // No ::, must have exactly 8 groups
  const groups = v.split(':');
  if (groups.length !== 8) return false;
  return groups.every((g) => /^[0-9a-fA-F]{1,4}$/.test(g));
}

/** Check if a string is a valid UUID v4. */
export function isUUID(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

/** Check if a string is a valid credit card number using the Luhn algorithm. */
export function isCreditCard(v: string): boolean {
  const digits = v.replace(/[\s-]/g, '');
  if (!/^\d{13,19}$/.test(digits)) return false;
  let sum = 0;
  let isDouble = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = parseInt(digits[i], 10);
    if (isDouble) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    isDouble = !isDouble;
  }
  return sum % 10 === 0;
}

/** Check if a string is a valid hex color (#RGB or #RRGGBB). */
export function isHexColor(v: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v);
}

/** Check if a string is valid base64. */
export function isBase64(v: string): boolean {
  if (v.length === 0) return false;
  return /^[A-Za-z0-9+/]*={0,2}$/.test(v) && v.length % 4 === 0;
}

/** Check if a string is valid JSON. */
export function isJSON(v: string): boolean {
  if (v.trim() === '') return false;
  try {
    JSON.parse(v);
    return true;
  } catch {
    return false;
  }
}

/** Check if a string contains only alphanumeric characters (a-z, A-Z, 0-9). */
export function isAlphanumeric(v: string): boolean {
  return v.length > 0 && /^[a-zA-Z0-9]+$/.test(v);
}

/** Check if a string represents a numeric value (integer or float). */
export function isNumericString(v: string): boolean {
  if (v.trim() === '') return false;
  return !isNaN(Number(v)) && isFinite(Number(v));
}

/**
 * Check if a string looks like a phone number.
 * Accepts digits, +, -, spaces, and parentheses.
 */
export function isPhoneNumber(v: string): boolean {
  if (v.trim() === '') return false;
  // Must contain at least 7 digits
  const digits = v.replace(/\D/g, '');
  if (digits.length < 7) return false;
  return /^[\d+\-\s().]+$/.test(v);
}

/** Check if a number is within the inclusive range [min, max]. */
export function inRange(v: number, min: number, max: number): boolean {
  return v >= min && v <= max;
}

/**
 * Check if a string or array has a length within [min, max].
 * If max is omitted, only the minimum is checked.
 */
export function hasLength(v: string | unknown[], min: number, max?: number): boolean {
  const len = v.length;
  if (len < min) return false;
  if (max !== undefined && len > max) return false;
  return true;
}

/** Check if a string matches a given regular expression pattern. */
export function matchesPattern(v: string, pattern: RegExp): boolean {
  return pattern.test(v);
}
