// @ts-check
// ─── Schema Validator ────────────────────────────────────────────────────────
// Simple JSON schema-like validator for runtime value validation.

// ─── Types ───────────────────────────────────────────────────────────────────

export type SchemaType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'array'
  | 'object'
  | 'null'
  | 'any';

export interface Schema {
  type?: SchemaType | SchemaType[];
  required?: boolean;
  minLength?: number;       // for strings
  maxLength?: number;       // for strings
  pattern?: string;         // for strings (regex)
  min?: number;             // for numbers
  max?: number;             // for numbers
  items?: Schema;           // for arrays
  minItems?: number;        // for arrays
  maxItems?: number;        // for arrays
  properties?: Record<string, Schema>;  // for objects
  additionalProperties?: boolean;       // for objects, default true
  enum?: unknown[];
  nullable?: boolean;
}

export interface ValidationError {
  path: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getActualType(value: unknown): SchemaType {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value as SchemaType;
}

function joinPath(base: string, key: string | number): string {
  if (base === '') return String(key);
  return `${base}.${String(key)}`;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/** Validate a value against a schema. */
export function validate(value: unknown, schema: Schema, path = ''): ValidationResult {
  const errors: ValidationError[] = [];

  // Handle null/undefined with nullable/required
  if (value === null || value === undefined) {
    if (schema.nullable && (value === null || value === undefined)) {
      return { valid: true, errors: [] };
    }
    if (schema.required) {
      errors.push({ path, message: 'Value is required' });
      return { valid: false, errors };
    }
    // If no required and no type constraint, null/undefined is ok
    if (!schema.type) {
      return { valid: true, errors: [] };
    }
  }

  const actualType = getActualType(value);

  // Type check
  if (schema.type !== undefined) {
    const allowedTypes = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!allowedTypes.includes('any') && !allowedTypes.includes(actualType)) {
      // Allow nullable check here too
      if (!(schema.nullable && value === null)) {
        errors.push({
          path,
          message: `Expected type '${allowedTypes.join(' | ')}' but got '${actualType}'`,
        });
        return { valid: false, errors };
      }
    }
  }

  // Enum check
  if (schema.enum !== undefined) {
    if (!schema.enum.some((e) => e === value)) {
      errors.push({
        path,
        message: `Value must be one of: ${schema.enum.map((e) => JSON.stringify(e)).join(', ')}`,
      });
    }
  }

  // String-specific checks
  if (actualType === 'string') {
    const str = value as string;
    if (schema.minLength !== undefined && str.length < schema.minLength) {
      errors.push({
        path,
        message: `String length ${str.length} is less than minLength ${schema.minLength}`,
      });
    }
    if (schema.maxLength !== undefined && str.length > schema.maxLength) {
      errors.push({
        path,
        message: `String length ${str.length} exceeds maxLength ${schema.maxLength}`,
      });
    }
    if (schema.pattern !== undefined) {
      const regex = new RegExp(schema.pattern);
      if (!regex.test(str)) {
        errors.push({
          path,
          message: `String does not match pattern '${schema.pattern}'`,
        });
      }
    }
  }

  // Number-specific checks
  if (actualType === 'number') {
    const num = value as number;
    if (schema.min !== undefined && num < schema.min) {
      errors.push({
        path,
        message: `Number ${num} is less than min ${schema.min}`,
      });
    }
    if (schema.max !== undefined && num > schema.max) {
      errors.push({
        path,
        message: `Number ${num} exceeds max ${schema.max}`,
      });
    }
  }

  // Array-specific checks
  if (actualType === 'array') {
    const arr = value as unknown[];
    if (schema.minItems !== undefined && arr.length < schema.minItems) {
      errors.push({
        path,
        message: `Array length ${arr.length} is less than minItems ${schema.minItems}`,
      });
    }
    if (schema.maxItems !== undefined && arr.length > schema.maxItems) {
      errors.push({
        path,
        message: `Array length ${arr.length} exceeds maxItems ${schema.maxItems}`,
      });
    }
    if (schema.items !== undefined) {
      for (let i = 0; i < arr.length; i++) {
        const itemResult = validate(arr[i], schema.items, joinPath(path, i));
        if (!itemResult.valid) {
          errors.push(...itemResult.errors);
        }
      }
    }
  }

  // Object-specific checks
  if (actualType === 'object') {
    const obj = value as Record<string, unknown>;
    if (schema.properties !== undefined) {
      for (const [propKey, propSchema] of Object.entries(schema.properties)) {
        const propPath = joinPath(path, propKey);
        const propValue = obj[propKey];
        if (propValue === undefined) {
          if (propSchema.required) {
            errors.push({ path: propPath, message: 'Value is required' });
          }
        } else {
          const propResult = validate(propValue, propSchema, propPath);
          if (!propResult.valid) {
            errors.push(...propResult.errors);
          }
        }
      }
    }
    if (schema.additionalProperties === false && schema.properties !== undefined) {
      const allowedKeys = new Set(Object.keys(schema.properties));
      for (const key of Object.keys(obj)) {
        if (!allowedKeys.has(key)) {
          errors.push({
            path: joinPath(path, key),
            message: `Additional property '${key}' is not allowed`,
          });
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/** Check if a value matches a schema (no error details). */
export function matches(value: unknown, schema: Schema): boolean {
  return validate(value, schema).valid;
}

/** Create a validator function for a given schema. */
export function createValidator(schema: Schema): (value: unknown) => ValidationResult {
  return (value: unknown) => validate(value, schema);
}
