// @ts-check
// ─── JSON Schema Validation (draft-7 subset) ──────────────────────────────────
// Validates `unknown` data against a JSON Schema descriptor and returns a
// structured result listing every violation found.
//
// Supported keywords: type, properties, required, items, minLength, maxLength,
// minimum, maximum, enum, pattern, additionalProperties.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface JsonSchema {
  type?: string | string[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  enum?: unknown[];
  pattern?: string;
  additionalProperties?: boolean | JsonSchema;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function jsonType(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function validateAt(data: unknown, schema: JsonSchema, path: string): string[] {
  const errors: string[] = [];

  // ── type ─────────────────────────────────────────────────────────────────
  if (schema.type !== undefined) {
    const allowed = Array.isArray(schema.type) ? schema.type : [schema.type];
    const actual = jsonType(data);
    const typeMatches =
      allowed.includes(actual) ||
      (allowed.includes('integer') && typeof data === 'number' && Number.isInteger(data));
    if (!typeMatches) {
      errors.push(`${path}: expected type ${allowed.join('|')}, got ${actual}`);
      // Stop — further keyword checks are meaningless when the type is wrong.
      return errors;
    }
  }

  // ── enum ──────────────────────────────────────────────────────────────────
  if (schema.enum !== undefined) {
    const inEnum = schema.enum.some((e) => JSON.stringify(e) === JSON.stringify(data));
    if (!inEnum) {
      errors.push(
        `${path}: value must be one of [${schema.enum.map((e) => JSON.stringify(e)).join(', ')}]`,
      );
    }
  }

  // ── string constraints ────────────────────────────────────────────────────
  if (typeof data === 'string') {
    if (schema.minLength !== undefined && data.length < schema.minLength) {
      errors.push(
        `${path}: string length ${data.length} is less than minLength ${schema.minLength}`,
      );
    }
    if (schema.maxLength !== undefined && data.length > schema.maxLength) {
      errors.push(
        `${path}: string length ${data.length} exceeds maxLength ${schema.maxLength}`,
      );
    }
    if (schema.pattern !== undefined) {
      if (!new RegExp(schema.pattern).test(data)) {
        errors.push(`${path}: string does not match pattern "${schema.pattern}"`);
      }
    }
  }

  // ── number constraints ────────────────────────────────────────────────────
  if (typeof data === 'number') {
    if (schema.minimum !== undefined && data < schema.minimum) {
      errors.push(`${path}: value ${data} is less than minimum ${schema.minimum}`);
    }
    if (schema.maximum !== undefined && data > schema.maximum) {
      errors.push(`${path}: value ${data} exceeds maximum ${schema.maximum}`);
    }
  }

  // ── array constraints ─────────────────────────────────────────────────────
  if (Array.isArray(data) && schema.items !== undefined) {
    for (let i = 0; i < data.length; i++) {
      const sub = validateAt(data[i], schema.items, `${path}[${i}]`);
      for (const e of sub) errors.push(e);
    }
  }

  // ── object constraints ────────────────────────────────────────────────────
  if (data !== null && typeof data === 'object' && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>;

    // required
    if (schema.required !== undefined) {
      for (const key of schema.required) {
        if (!(key in obj)) {
          errors.push(`${path}: missing required property "${key}"`);
        }
      }
    }

    // properties
    if (schema.properties !== undefined) {
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        if (key in obj) {
          const sub = validateAt(obj[key], propSchema, `${path}.${key}`);
          for (const e of sub) errors.push(e);
        }
      }
    }

    // additionalProperties
    if (schema.additionalProperties !== undefined) {
      const knownKeys = new Set(Object.keys(schema.properties ?? {}));
      for (const key of Object.keys(obj)) {
        if (!knownKeys.has(key)) {
          if (schema.additionalProperties === false) {
            errors.push(`${path}: additional property "${key}" is not allowed`);
          } else if (typeof schema.additionalProperties === 'object') {
            const sub = validateAt(obj[key], schema.additionalProperties, `${path}.${key}`);
            for (const e of sub) errors.push(e);
          }
          // true => any additional property is allowed
        }
      }
    }
  }

  return errors;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Validate `data` against `schema`.
 * Returns `{ valid, errors }` where `errors` is an array of human-readable
 * violation messages. Never throws.
 */
export function validateSchema(data: unknown, schema: JsonSchema): ValidationResult {
  const errors = validateAt(data, schema, '$');
  return { valid: errors.length === 0, errors };
}

/**
 * Compile `schema` into a reusable validator function.
 * The returned function behaves identically to calling
 * `validateSchema(data, schema)` each time, but the schema is captured once
 * so callers can avoid passing it repeatedly.
 */
export function compileSchema(schema: JsonSchema): (data: unknown) => ValidationResult {
  return (data: unknown) => validateSchema(data, schema);
}
