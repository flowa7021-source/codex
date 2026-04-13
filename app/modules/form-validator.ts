// @ts-check
// ─── Form Validator ──────────────────────────────────────────────────────────
// Validate form fields and full form objects against rule arrays.

// ─── Types ───────────────────────────────────────────────────────────────────

export type ValidationRule<T = string> = (value: T) => string | null; // null = valid

export interface FieldResult {
  valid: boolean;
  errors: string[];
}

export interface FormResult {
  valid: boolean;
  errors: Record<string, string[]>;
}

// ─── Built-in rules ──────────────────────────────────────────────────────────

export const rules = {
  /** Value must be non-empty (not null, undefined, or blank string). */
  required(msg?: string): ValidationRule<string> {
    return (value) => {
      if (value == null || String(value).trim() === '') {
        return msg ?? 'This field is required.';
      }
      return null;
    };
  },

  /** String must be at least n characters long. */
  minLength(n: number, msg?: string): ValidationRule<string> {
    return (value) => {
      if (value.length < n) {
        return msg ?? `Must be at least ${n} character${n === 1 ? '' : 's'}.`;
      }
      return null;
    };
  },

  /** String must be at most n characters long. */
  maxLength(n: number, msg?: string): ValidationRule<string> {
    return (value) => {
      if (value.length > n) {
        return msg ?? `Must be at most ${n} character${n === 1 ? '' : 's'}.`;
      }
      return null;
    };
  },

  /** String must match the given regular expression. */
  pattern(regex: RegExp, msg?: string): ValidationRule<string> {
    return (value) => {
      if (!regex.test(value)) {
        return msg ?? `Must match pattern ${regex}.`;
      }
      return null;
    };
  },

  /** String must be a valid email address. */
  email(msg?: string): ValidationRule<string> {
    return (value) => {
      // RFC-5322 simplified: local@domain.tld
      const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!re.test(value)) {
        return msg ?? 'Must be a valid email address.';
      }
      return null;
    };
  },

  /** String must be a valid http or https URL. */
  url(msg?: string): ValidationRule<string> {
    return (value) => {
      try {
        const u = new URL(value);
        if (u.protocol !== 'http:' && u.protocol !== 'https:') {
          return msg ?? 'Must be a valid URL.';
        }
        return null;
      } catch {
        return msg ?? 'Must be a valid URL.';
      }
    };
  },

  /** Number must be >= n. */
  min(n: number, msg?: string): ValidationRule<number> {
    return (value) => {
      if (value < n) {
        return msg ?? `Must be at least ${n}.`;
      }
      return null;
    };
  },

  /** Number must be <= n. */
  max(n: number, msg?: string): ValidationRule<number> {
    return (value) => {
      if (value > n) {
        return msg ?? `Must be at most ${n}.`;
      }
      return null;
    };
  },

  /** Number must be an integer (no fractional part). */
  integer(msg?: string): ValidationRule<number> {
    return (value) => {
      if (!Number.isInteger(value)) {
        return msg ?? 'Must be an integer.';
      }
      return null;
    };
  },

  /** Value must be one of the given options. */
  oneOf<T>(options: T[], msg?: string): ValidationRule<T> {
    return (value) => {
      if (!options.includes(value)) {
        return msg ?? `Must be one of: ${options.join(', ')}.`;
      }
      return null;
    };
  },
};

// ─── Public API ──────────────────────────────────────────────────────────────

/** Validate a single value against multiple rules, collecting all errors. */
export function validateField<T>(value: T, fieldRules: ValidationRule<T>[]): FieldResult {
  const errors: string[] = [];
  for (const rule of fieldRules) {
    const error = rule(value);
    if (error !== null) {
      errors.push(error);
    }
  }
  return { valid: errors.length === 0, errors };
}

/** Validate a form object against a schema, returning per-field errors. */
export function validateForm<T extends Record<string, unknown>>(
  data: T,
  schema: { [K in keyof T]?: ValidationRule<T[K]>[] },
): FormResult {
  const errors: Record<string, string[]> = {};
  let valid = true;

  for (const key of Object.keys(schema) as (keyof T)[]) {
    const fieldRules = schema[key];
    if (!fieldRules || fieldRules.length === 0) continue;

    const result = validateField(data[key], fieldRules as ValidationRule<T[keyof T]>[]);
    if (!result.valid) {
      valid = false;
      errors[key as string] = result.errors;
    }
  }

  return { valid, errors };
}
