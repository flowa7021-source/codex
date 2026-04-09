// ─── Validator ───────────────────────────────────────────────────────────────
// @ts-check
// Data validation utilities for NovaReader.

// ─── String Format Validators ────────────────────────────────────────────────

/**
 * Whether a string is a valid email address.
 * Uses a pragmatic RFC-5321–style check: local@domain.tld.
 *
 * @param str - Candidate string
 */
export function isEmail(str: string): boolean {
  // Must have exactly one @, non-empty local part, domain with at least one dot
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(str);
}

/**
 * Whether a string is a valid URL (http or https scheme).
 *
 * @param str - Candidate string
 */
export function isURL(str: string): boolean {
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Whether a string is a valid IPv4 address (dotted-decimal, 0–255 per octet).
 *
 * @param str - Candidate string
 */
export function isIPv4(str: string): boolean {
  const parts = str.split('.');
  if (parts.length !== 4) return false;
  return parts.every(part => {
    if (!/^\d+$/.test(part)) return false;
    const n = parseInt(part, 10);
    return n >= 0 && n <= 255;
  });
}

/**
 * Whether a string is a valid UUID (v4 format:
 * xxxxxxxx-xxxx-4xxx-[89ab]xxx-xxxxxxxxxxxx).
 *
 * @param str - Candidate string
 */
export function isUUID(str: string): boolean {
  const re =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return re.test(str);
}

// ─── Type Guards ─────────────────────────────────────────────────────────────

/**
 * Whether a value is a finite number (not NaN, not ±Infinity).
 *
 * @param value - Value to check
 */
export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && isFinite(value);
}

/**
 * Whether a value is a non-empty string.
 *
 * @param value - Value to check
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

// ─── Object Validators ───────────────────────────────────────────────────────

/**
 * Whether an object has all the required keys (own or inherited).
 *
 * @param obj  - Object to inspect
 * @param keys - List of required keys
 */
export function hasRequiredKeys<T extends object>(
  obj: T,
  keys: (keyof T)[],
): boolean {
  return keys.every(key => key in obj);
}

// ─── Pattern Matching ────────────────────────────────────────────────────────

/**
 * Whether a string matches a pattern.
 * Accepts either a RegExp or a string pattern that is converted to a RegExp.
 *
 * @param str     - String to test
 * @param pattern - RegExp or pattern string
 */
export function matchesPattern(str: string, pattern: string | RegExp): boolean {
  const re = pattern instanceof RegExp ? pattern : new RegExp(pattern);
  return re.test(str);
}

// ─── Schema Validation ───────────────────────────────────────────────────────

interface ValidationSchema {
  type?: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  enum?: unknown[];
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate a value against a simple schema.
 * Returns `{ valid, errors }` where errors is an array of human-readable
 * messages describing each constraint violation.
 *
 * @param value  - Value to validate
 * @param schema - Validation schema
 */
export function validate(
  value: unknown,
  schema: ValidationSchema,
): ValidationResult {
  const errors: string[] = [];

  // Required check
  if (schema.required && (value === null || value === undefined)) {
    errors.push('Value is required');
    return { valid: false, errors };
  }

  // If not required and absent, nothing more to check
  if (value === null || value === undefined) {
    return { valid: true, errors };
  }

  // Type check
  if (schema.type !== undefined) {
    let typeOk: boolean;
    if (schema.type === 'array') {
      typeOk = Array.isArray(value);
    } else if (schema.type === 'object') {
      // Arrays are not considered plain objects
      typeOk = typeof value === 'object' && !Array.isArray(value);
    } else {
      typeOk = typeof value === schema.type;
    }
    if (!typeOk) {
      errors.push(`Expected type '${schema.type}' but got '${Array.isArray(value) ? 'array' : typeof value}'`);
    }
  }

  // String constraints
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push(`String length ${value.length} is less than minLength ${schema.minLength}`);
    }
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.push(`String length ${value.length} exceeds maxLength ${schema.maxLength}`);
    }
    if (schema.pattern !== undefined && !schema.pattern.test(value)) {
      errors.push(`Value does not match pattern ${schema.pattern}`);
    }
  }

  // Numeric constraints
  if (typeof value === 'number') {
    if (schema.min !== undefined && value < schema.min) {
      errors.push(`Value ${value} is less than min ${schema.min}`);
    }
    if (schema.max !== undefined && value > schema.max) {
      errors.push(`Value ${value} exceeds max ${schema.max}`);
    }
  }

  // Enum constraint
  if (schema.enum !== undefined && !schema.enum.includes(value)) {
    errors.push(`Value '${value}' is not one of [${schema.enum.join(', ')}]`);
  }

  return { valid: errors.length === 0, errors };
}
