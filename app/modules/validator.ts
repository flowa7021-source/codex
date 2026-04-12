// ─── Validator ───────────────────────────────────────────────────────────────
// @ts-check
// Data validation library for NovaReader.
// Provides individual string-format validators, schema-based object validation,
// and per-field validation with rich error reporting.

// ─── Types ───────────────────────────────────────────────────────────────────

/** Result returned by `validate` and `validateField`. */
interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Schema descriptor for a single field.
 * Supports nested arrays (`items`) and nested objects (`properties`).
 */
interface SchemaField {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  validate?: (value: unknown) => boolean;
  items?: SchemaField;
  properties?: Record<string, SchemaField>;
}

/** Top-level schema: a map of field names to their descriptors. */
type Schema = Record<string, SchemaField>;

// ─── Individual Validators ───────────────────────────────────────────────────

/**
 * Collection of standalone boolean-returning validators.
 * Each function accepts a single string and returns `true` when it conforms
 * to the named format, `false` otherwise.
 */
const validators = {
  /**
   * Whether `str` is a valid email address (RFC-5321-style pragmatic check).
   * Requires a non-empty local part, exactly one `@`, and a domain with at
   * least one dot separator and a non-empty TLD.
   */
  isEmail(str: string): boolean {
    // local@domain.tld — no whitespace, no @ in local or domain parts
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(str);
  },

  /**
   * Whether `str` is a valid URL with an http, https, or ftp scheme.
   * Delegates to the WHATWG `URL` parser for structural correctness.
   */
  isUrl(str: string): boolean {
    try {
      const url = new URL(str);
      return url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'ftp:';
    } catch {
      return false;
    }
  },

  /**
   * Whether `str` is a valid dotted-decimal IPv4 address.
   * Each of the four octets must be an integer in [0, 255] with no leading
   * zeros (e.g. "01" is rejected).
   */
  isIPv4(str: string): boolean {
    const parts = str.split('.');
    if (parts.length !== 4) return false;
    return parts.every(part => {
      if (!/^\d+$/.test(part)) return false;
      // Reject leading zeros ("01", "001", …)
      if (part.length > 1 && part[0] === '0') return false;
      const n = Number(part);
      return n >= 0 && n <= 255;
    });
  },

  /**
   * Whether `str` is a valid IPv6 address.
   * Accepts the full 8-group form as well as `::` compressed forms and
   * mixed IPv4-mapped addresses.
   */
  isIPv6(str: string): boolean {
    // Full form: eight groups of 1-4 hex digits separated by colons
    const fullRe = /^([0-9a-f]{1,4}:){7}[0-9a-f]{1,4}$/i;
    if (fullRe.test(str)) return true;

    // Compressed form with "::" (at most one occurrence)
    if ((str.match(/::/g) ?? []).length !== 1) return false;

    // Split on "::" into left and right halves
    const [left, right] = str.split('::');
    const leftGroups  = left  ? left.split(':')  : [];
    const rightGroups = right ? right.split(':') : [];

    // Check for IPv4-mapped suffix in the right half (e.g. "::ffff:192.0.2.1")
    if (rightGroups.length > 0) {
      const last = rightGroups[rightGroups.length - 1];
      if (last.includes('.')) {
        // last token must be a valid IPv4 address; counts as 2 groups
        if (!validators.isIPv4(last)) return false;
        rightGroups.splice(rightGroups.length - 1, 1, 'ffff', 'ffff');
      }
    }

    const totalGroups = leftGroups.length + rightGroups.length;
    if (totalGroups > 7) return false; // "::" itself replaces ≥1 group

    const hexGroup = /^[0-9a-f]{1,4}$/i;
    return [...leftGroups, ...rightGroups].every(g => hexGroup.test(g));
  },

  /**
   * Whether `str` is a valid credit-card number (Luhn algorithm).
   * Strips spaces and dashes before validation; rejects non-digit characters.
   * Accepts card numbers between 13 and 19 digits long.
   */
  isCreditCard(str: string): boolean {
    const digits = str.replace(/[\s-]/g, '');
    if (!/^\d{13,19}$/.test(digits)) return false;

    // Luhn algorithm
    let sum = 0;
    let double = false;
    for (let i = digits.length - 1; i >= 0; i--) {
      let d = Number(digits[i]);
      if (double) {
        d *= 2;
        if (d > 9) d -= 9;
      }
      sum += d;
      double = !double;
    }
    return sum % 10 === 0;
  },

  /**
   * Whether `str` is a v4 UUID
   * (xxxxxxxx-xxxx-4xxx-[89ab]xxx-xxxxxxxxxxxx, case-insensitive).
   */
  isUUID(str: string): boolean {
    const re =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return re.test(str);
  },

  /**
   * Whether `str` is an ISO 8601 date or date-time string.
   * Accepts YYYY-MM-DD, YYYY-MM-DDTHH:mm:ss, and variants with timezone
   * offsets or trailing Z.
   */
  isISO8601(str: string): boolean {
    // Basic date: YYYY-MM-DD (optional T... suffix)
    const re =
      /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;
    if (!re.test(str)) return false;
    // Also verify the date portion is a real calendar date via Date parsing
    const date = new Date(str);
    return !isNaN(date.getTime());
  },

  /**
   * Whether `str` contains only ASCII letters (a-z, A-Z).
   * Returns `false` for an empty string.
   */
  isAlpha(str: string): boolean {
    return /^[a-zA-Z]+$/.test(str);
  },

  /**
   * Whether `str` contains only ASCII letters and digits.
   * Returns `false` for an empty string.
   */
  isAlphanumeric(str: string): boolean {
    return /^[a-zA-Z0-9]+$/.test(str);
  },

  /**
   * Whether `str` contains only decimal digits (0-9).
   * Returns `false` for an empty string.
   */
  isNumeric(str: string): boolean {
    return /^\d+$/.test(str);
  },

  /**
   * Whether `str` is a valid CSS hex color.
   * Accepts 3-digit (`#fff`) and 6-digit (`#ffffff`) forms, case-insensitive.
   */
  isHexColor(str: string): boolean {
    return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(str);
  },

  /**
   * Whether `str` is valid JSON (parseable by `JSON.parse`).
   * An empty string is not valid JSON.
   */
  isJSON(str: string): boolean {
    if (!str || !str.trim()) return false;
    try {
      JSON.parse(str);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Whether `str` is valid Base64-encoded data.
   * Accepts standard Base64 with optional `=` padding and ignores whitespace.
   */
  isBase64(str: string): boolean {
    if (!str) return false;
    // Remove all whitespace to allow multi-line base64
    const s = str.replace(/\s/g, '');
    if (s.length === 0) return false;
    return /^[A-Za-z0-9+/]*={0,2}$/.test(s) && s.length % 4 === 0;
  },

  /**
   * Whether the value is "empty": `null`, `undefined`, an empty string, or a
   * string containing only whitespace.
   * The parameter is typed `unknown` so callers can pass any value without
   * a cast.
   */
  isEmpty(str: unknown): boolean {
    if (str === null || str === undefined) return true;
    if (typeof str !== 'string') return false;
    return str.trim().length === 0;
  },

  /**
   * Whether `str` is a phone number in international E.164-compatible format.
   * Accepts an optional leading `+`, then 7–15 digits (spaces/dashes/parens
   * allowed as separators).
   */
  isPhoneNumber(str: string): boolean {
    // Strip common separator characters
    const stripped = str.replace(/[\s\-().]/g, '');
    return /^\+?\d{7,15}$/.test(stripped);
  },
};

// ─── Per-field Validation ────────────────────────────────────────────────────

/**
 * Validate a single `value` against a `SchemaField` descriptor.
 *
 * @param value - The value to validate (any type)
 * @param field - Field descriptor with constraints
 * @param name  - Optional field name used in error messages (default `"value"`)
 * @returns `{ valid, errors }`
 */
function validateField(
  value: unknown,
  field: SchemaField,
  name = 'value',
): ValidationResult {
  const errors: string[] = [];

  // ── Required / absence ────────────────────────────────────────────────────
  const absent = value === null || value === undefined;
  if (absent) {
    if (field.required) {
      errors.push(`'${name}' is required`);
    }
    return { valid: errors.length === 0, errors };
  }

  // ── Type check ────────────────────────────────────────────────────────────
  let typeOk: boolean;
  if (field.type === 'array') {
    typeOk = Array.isArray(value);
  } else if (field.type === 'object') {
    typeOk = typeof value === 'object' && !Array.isArray(value);
  } else {
    typeOk = typeof value === field.type;
  }

  if (!typeOk) {
    const actual = Array.isArray(value) ? 'array' : typeof value;
    errors.push(`'${name}' must be of type '${field.type}' (got '${actual}')`);
    // Don't apply further constraints when the type is wrong
    return { valid: false, errors };
  }

  // ── String constraints ────────────────────────────────────────────────────
  if (typeof value === 'string') {
    if (field.minLength !== undefined && value.length < field.minLength) {
      errors.push(
        `'${name}' must be at least ${field.minLength} character(s) long (got ${value.length})`,
      );
    }
    if (field.maxLength !== undefined && value.length > field.maxLength) {
      errors.push(
        `'${name}' must be at most ${field.maxLength} character(s) long (got ${value.length})`,
      );
    }
    if (field.pattern !== undefined && !field.pattern.test(value)) {
      errors.push(`'${name}' does not match required pattern ${field.pattern}`);
    }
  }

  // ── Numeric constraints ────────────────────────────────────────────────────
  if (typeof value === 'number') {
    if (field.min !== undefined && value < field.min) {
      errors.push(`'${name}' must be >= ${field.min} (got ${value})`);
    }
    if (field.max !== undefined && value > field.max) {
      errors.push(`'${name}' must be <= ${field.max} (got ${value})`);
    }
  }

  // ── Array item constraints ────────────────────────────────────────────────
  if (Array.isArray(value) && field.items !== undefined) {
    const itemField = field.items;
    value.forEach((item, idx) => {
      const itemResult = validateField(item, itemField, `${name}[${idx}]`);
      errors.push(...itemResult.errors);
    });
  }

  // ── Nested object properties ───────────────────────────────────────────────
  if (
    typeof value === 'object' &&
    !Array.isArray(value) &&
    field.properties !== undefined
  ) {
    const obj = value as Record<string, unknown>;
    const result = validate(obj, field.properties);
    errors.push(...result.errors);
  }

  // ── Custom validator ──────────────────────────────────────────────────────
  if (field.validate !== undefined && !field.validate(value)) {
    errors.push(`'${name}' failed custom validation`);
  }

  return { valid: errors.length === 0, errors };
}

// ─── Schema-based Validation ─────────────────────────────────────────────────

/**
 * Validate a plain data object against a schema.
 * Each key in `schema` is validated against the corresponding value in `data`.
 * Keys present in `data` but absent from `schema` are ignored.
 *
 * @param data   - Object whose fields are to be validated
 * @param schema - Map of field names to their `SchemaField` descriptors
 * @returns `{ valid, errors }` — errors is an array of human-readable messages
 */
function validate(
  data: Record<string, unknown>,
  schema: Schema,
): ValidationResult {
  const errors: string[] = [];

  for (const [fieldName, fieldDef] of Object.entries(schema)) {
    const value = data[fieldName];
    const result = validateField(value, fieldDef, fieldName);
    errors.push(...result.errors);
  }

  return { valid: errors.length === 0, errors };
}

// ─── Exports ─────────────────────────────────────────────────────────────────

export { validators, validate, validateField };
export type { ValidationResult, SchemaField, Schema };
