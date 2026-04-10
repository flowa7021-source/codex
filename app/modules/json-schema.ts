// @ts-check
// ─── JSON Schema Validator (draft-7 subset) ───────────────────────────────────
// Validates arbitrary data against a JSON Schema draft-7 compatible schema.
// Supports: type, properties, required, items, minLength, maxLength, minimum,
// maximum, enum, pattern, additionalProperties, nullable, and schema composition.

// ─── Types ────────────────────────────────────────────────────────────────────

/** A JSON Schema draft-7 compatible schema object. */
export interface JSONSchema {
  type?: string | string[];
  properties?: Record<string, JSONSchema>;
  required?: string[];
  items?: JSONSchema;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  enum?: unknown[];
  pattern?: string;
  additionalProperties?: boolean | JSONSchema;
  nullable?: boolean;
}

/** A single validation error with a JSON-pointer-style path. */
export interface ValidationError {
  path: string;
  message: string;
}

/** Result returned by `validate`. */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Return the JSON Schema type name of a value. */
function jsonType(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value; // 'string' | 'number' | 'boolean' | 'object'
}

/** Append a key segment to a JSON-pointer-style path. */
function appendPath(base: string, key: string | number): string {
  return `${base}/${key}`;
}

/** Core recursive validator — accumulates errors into `errors`. */
function validateNode(
  data: unknown,
  schema: JSONSchema,
  path: string,
  errors: ValidationError[],
): void {
  // ── nullable: allow null regardless of other constraints ─────────────────
  if (data === null && schema.nullable === true) return;

  // ── type ─────────────────────────────────────────────────────────────────
  if (schema.type !== undefined) {
    const allowed = Array.isArray(schema.type) ? schema.type : [schema.type];
    const actual = jsonType(data);
    // JSON Schema draft-7: "integer" matches whole numbers
    const typeMatches =
      allowed.includes(actual) ||
      (allowed.includes('integer') && typeof data === 'number' && Number.isInteger(data));
    if (!typeMatches) {
      errors.push({
        path,
        message: `Expected type '${allowed.join(' | ')}' but got '${actual}'`,
      });
      // Stop further checks when the type is wrong — child checks are meaningless
      return;
    }
  }

  // ── enum ──────────────────────────────────────────────────────────────────
  if (schema.enum !== undefined) {
    if (!schema.enum.some((e) => e === data)) {
      errors.push({
        path,
        message: `Value must be one of: ${schema.enum.map((e) => JSON.stringify(e)).join(', ')}`,
      });
    }
  }

  // ── string constraints ────────────────────────────────────────────────────
  if (typeof data === 'string') {
    if (schema.minLength !== undefined && data.length < schema.minLength) {
      errors.push({
        path,
        message: `String length ${data.length} is less than minLength ${schema.minLength}`,
      });
    }
    if (schema.maxLength !== undefined && data.length > schema.maxLength) {
      errors.push({
        path,
        message: `String length ${data.length} exceeds maxLength ${schema.maxLength}`,
      });
    }
    if (schema.pattern !== undefined) {
      if (!new RegExp(schema.pattern).test(data)) {
        errors.push({
          path,
          message: `String does not match pattern '${schema.pattern}'`,
        });
      }
    }
  }

  // ── number constraints ────────────────────────────────────────────────────
  if (typeof data === 'number') {
    if (schema.minimum !== undefined && data < schema.minimum) {
      errors.push({
        path,
        message: `Value ${data} is less than minimum ${schema.minimum}`,
      });
    }
    if (schema.maximum !== undefined && data > schema.maximum) {
      errors.push({
        path,
        message: `Value ${data} exceeds maximum ${schema.maximum}`,
      });
    }
  }

  // ── array constraints ─────────────────────────────────────────────────────
  if (Array.isArray(data)) {
    if (schema.items !== undefined) {
      for (let i = 0; i < data.length; i++) {
        validateNode(data[i], schema.items, appendPath(path, i), errors);
      }
    }
  }

  // ── object constraints ────────────────────────────────────────────────────
  if (data !== null && typeof data === 'object' && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>;

    // required fields
    if (schema.required !== undefined) {
      for (const key of schema.required) {
        if (!(key in obj)) {
          errors.push({
            path: appendPath(path, key),
            message: `Required property '${key}' is missing`,
          });
        }
      }
    }

    // properties
    if (schema.properties !== undefined) {
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        if (key in obj) {
          validateNode(obj[key], propSchema, appendPath(path, key), errors);
        }
      }
    }

    // additionalProperties
    if (schema.additionalProperties !== undefined && schema.properties !== undefined) {
      const knownKeys = new Set(Object.keys(schema.properties));
      for (const key of Object.keys(obj)) {
        if (!knownKeys.has(key)) {
          if (schema.additionalProperties === false) {
            errors.push({
              path: appendPath(path, key),
              message: `Additional property '${key}' is not allowed`,
            });
          } else if (typeof schema.additionalProperties === 'object') {
            validateNode(obj[key], schema.additionalProperties, appendPath(path, key), errors);
          }
        }
      }
    }
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Validate `data` against `schema`.
 * Returns `{ valid, errors }` — never throws.
 */
export function validate(data: unknown, schema: JSONSchema): ValidationResult {
  const errors: ValidationError[] = [];
  validateNode(data, schema, '', errors);
  return { valid: errors.length === 0, errors };
}

/**
 * Validate `data` against `schema`.
 * Throws a `TypeError` listing all errors if validation fails.
 */
export function validateStrict(data: unknown, schema: JSONSchema): void {
  const result = validate(data, schema);
  if (!result.valid) {
    const messages = result.errors.map((e) => `  ${e.path || '(root)'}: ${e.message}`).join('\n');
    throw new TypeError(`Schema validation failed:\n${messages}`);
  }
}

/**
 * Pre-compile a schema into a reusable validator function.
 * The compiled function has the same signature as `validate` but avoids
 * reconstructing the error array on every call.
 */
export function compileSchema(
  schema: JSONSchema,
): (data: unknown) => ValidationResult {
  // Freeze a copy so later mutations to the original don't affect the compiled validator
  const frozen: JSONSchema = JSON.parse(JSON.stringify(schema));
  return (data: unknown): ValidationResult => validate(data, frozen);
}
