// @ts-check
// ─── Schema Builder ───────────────────────────────────────────────────────────
// Fluent schema builder for runtime validation (minimal Zod-like API).

// ─── Public Types ─────────────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface Schema<T = unknown> {
  validate(value: unknown): ValidationResult;
  /** Parse and return value, throws Error listing all errors if invalid. */
  parse(value: unknown): T;
  /** Wrap schema: if value is undefined, return undefined without validation. */
  optional(): Schema<T | undefined>;
  /** Wrap schema: if value is null, return null without validation. */
  nullable(): Schema<T | null>;
  /** If value is undefined, substitute val before validating. */
  default(val: T): Schema<T>;
}

// ─── Internal Base ────────────────────────────────────────────────────────────

abstract class BaseSchema<T> implements Schema<T> {
  abstract validate(value: unknown): ValidationResult;

  parse(value: unknown): T {
    const result = this.validate(value);
    if (!result.valid) {
      throw new Error(result.errors.join('; '));
    }
    return this._coerce(value) as T;
  }

  /** Override in subclasses that perform coercion (e.g. trim). */
  protected _coerce(value: unknown): unknown {
    return value;
  }

  optional(): Schema<T | undefined> {
    return new OptionalSchema<T>(this);
  }

  nullable(): Schema<T | null> {
    return new NullableSchema<T>(this);
  }

  default(val: T): Schema<T> {
    return new DefaultSchema<T>(this, val);
  }
}

// ─── Wrapper Schemas ──────────────────────────────────────────────────────────

class OptionalSchema<T> extends BaseSchema<T | undefined> {
  #inner: Schema<T>;
  constructor(inner: Schema<T>) {
    super();
    this.#inner = inner;
  }
  validate(value: unknown): ValidationResult {
    if (value === undefined) return { valid: true, errors: [] };
    return this.#inner.validate(value);
  }
  protected _coerce(value: unknown): unknown {
    if (value === undefined) return undefined;
    return (this.#inner as BaseSchema<T>)._coerce(value);
  }
}

class NullableSchema<T> extends BaseSchema<T | null> {
  #inner: Schema<T>;
  constructor(inner: Schema<T>) {
    super();
    this.#inner = inner;
  }
  validate(value: unknown): ValidationResult {
    if (value === null) return { valid: true, errors: [] };
    return this.#inner.validate(value);
  }
  protected _coerce(value: unknown): unknown {
    if (value === null) return null;
    return (this.#inner as BaseSchema<T>)._coerce(value);
  }
}

class DefaultSchema<T> extends BaseSchema<T> {
  #inner: Schema<T>;
  #defaultVal: T;
  constructor(inner: Schema<T>, defaultVal: T) {
    super();
    this.#inner = inner;
    this.#defaultVal = defaultVal;
  }
  validate(value: unknown): ValidationResult {
    if (value === undefined) return this.#inner.validate(this.#defaultVal);
    return this.#inner.validate(value);
  }
  protected _coerce(value: unknown): unknown {
    const effective = value === undefined ? this.#defaultVal : value;
    return (this.#inner as BaseSchema<T>)._coerce(effective);
  }
}

// ─── String Schema ────────────────────────────────────────────────────────────

export class StringSchema extends BaseSchema<string> {
  #minLen: number | undefined;
  #maxLen: number | undefined;
  #emailCheck = false;
  #urlCheck = false;
  #pattern: RegExp | undefined;
  #trimEnabled = false;

  validate(value: unknown): ValidationResult {
    const errors: string[] = [];
    const raw = this.#trimEnabled && typeof value === 'string' ? value.trim() : value;
    if (typeof raw !== 'string') {
      errors.push(`Expected string, got ${typeof value}`);
      return { valid: false, errors };
    }
    if (this.#minLen !== undefined && raw.length < this.#minLen) {
      errors.push(`String must be at least ${this.#minLen} character(s)`);
    }
    if (this.#maxLen !== undefined && raw.length > this.#maxLen) {
      errors.push(`String must be at most ${this.#maxLen} character(s)`);
    }
    if (this.#emailCheck && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) {
      errors.push('Expected a valid email address');
    }
    if (this.#urlCheck) {
      let validUrl = false;
      try {
        const url = new URL(raw);
        validUrl = url.protocol === 'http:' || url.protocol === 'https:';
      } catch {
        validUrl = false;
      }
      if (!validUrl) errors.push('Expected a valid URL');
    }
    if (this.#pattern && !this.#pattern.test(raw)) {
      errors.push(`String does not match pattern ${this.#pattern}`);
    }
    return { valid: errors.length === 0, errors };
  }

  protected _coerce(value: unknown): unknown {
    if (this.#trimEnabled && typeof value === 'string') return value.trim();
    return value;
  }

  /** Require minimum string length. */
  min(n: number): this {
    this.#minLen = n;
    return this;
  }

  /** Require maximum string length. */
  max(n: number): this {
    this.#maxLen = n;
    return this;
  }

  /** Require a valid email format. */
  email(): this {
    this.#emailCheck = true;
    return this;
  }

  /** Require a valid http/https URL. */
  url(): this {
    this.#urlCheck = true;
    return this;
  }

  /** Require the string to match a regular expression. */
  pattern(re: RegExp): this {
    this.#pattern = re;
    return this;
  }

  /** Trim whitespace before validation and parsing. */
  trim(): this {
    this.#trimEnabled = true;
    return this;
  }
}

// ─── Number Schema ────────────────────────────────────────────────────────────

export class NumberSchema extends BaseSchema<number> {
  #minVal: number | undefined;
  #maxVal: number | undefined;
  #integerCheck = false;
  #positiveCheck = false;

  validate(value: unknown): ValidationResult {
    const errors: string[] = [];
    if (typeof value !== 'number' || isNaN(value)) {
      errors.push(`Expected number, got ${typeof value}`);
      return { valid: false, errors };
    }
    if (this.#minVal !== undefined && value < this.#minVal) {
      errors.push(`Number must be >= ${this.#minVal}`);
    }
    if (this.#maxVal !== undefined && value > this.#maxVal) {
      errors.push(`Number must be <= ${this.#maxVal}`);
    }
    if (this.#integerCheck && !Number.isInteger(value)) {
      errors.push('Expected an integer');
    }
    if (this.#positiveCheck && value <= 0) {
      errors.push('Expected a positive number');
    }
    return { valid: errors.length === 0, errors };
  }

  /** Require value >= n. */
  min(n: number): this {
    this.#minVal = n;
    return this;
  }

  /** Require value <= n. */
  max(n: number): this {
    this.#maxVal = n;
    return this;
  }

  /** Require an integer value. */
  integer(): this {
    this.#integerCheck = true;
    return this;
  }

  /** Require a strictly positive value (> 0). */
  positive(): this {
    this.#positiveCheck = true;
    return this;
  }
}

// ─── Boolean Schema ───────────────────────────────────────────────────────────

export class BooleanSchema extends BaseSchema<boolean> {
  validate(value: unknown): ValidationResult {
    if (typeof value !== 'boolean') {
      return { valid: false, errors: [`Expected boolean, got ${typeof value}`] };
    }
    return { valid: true, errors: [] };
  }
}

// ─── Object Schema ────────────────────────────────────────────────────────────

type SchemaMap = Record<string, Schema<unknown>>;
type InferObject<T extends SchemaMap> = {
  [K in keyof T]: T[K] extends Schema<infer V> ? V : never;
};

export class ObjectSchema<T extends SchemaMap> extends BaseSchema<InferObject<T>> {
  #shape: T;
  #strictMode = false;

  constructor(shape: T) {
    super();
    this.#shape = shape;
  }

  validate(value: unknown): ValidationResult {
    const errors: string[] = [];
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      errors.push(`Expected object, got ${value === null ? 'null' : typeof value}`);
      return { valid: false, errors };
    }
    const obj = value as Record<string, unknown>;
    if (this.#strictMode) {
      const knownKeys = new Set(Object.keys(this.#shape));
      for (const key of Object.keys(obj)) {
        if (!knownKeys.has(key)) {
          errors.push(`Unknown key: ${key}`);
        }
      }
    }
    for (const [key, schema] of Object.entries(this.#shape)) {
      const fieldResult = schema.validate(obj[key]);
      if (!fieldResult.valid) {
        for (const err of fieldResult.errors) {
          errors.push(`${key}: ${err}`);
        }
      }
    }
    return { valid: errors.length === 0, errors };
  }

  protected _coerce(value: unknown): unknown {
    const obj = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const [key, schema] of Object.entries(this.#shape)) {
      result[key] = (schema as BaseSchema<unknown>)._coerce(obj[key]);
    }
    return result;
  }

  /** Reject objects with keys not defined in the shape. */
  strict(): this {
    this.#strictMode = true;
    return this;
  }
}

// ─── Array Schema ─────────────────────────────────────────────────────────────

export class ArraySchema<T> extends BaseSchema<T[]> {
  #item: Schema<T>;
  #minLen: number | undefined;
  #maxLen: number | undefined;
  #uniqueCheck = false;

  constructor(item: Schema<T>) {
    super();
    this.#item = item;
  }

  validate(value: unknown): ValidationResult {
    const errors: string[] = [];
    if (!Array.isArray(value)) {
      errors.push(`Expected array, got ${typeof value}`);
      return { valid: false, errors };
    }
    if (this.#minLen !== undefined && value.length < this.#minLen) {
      errors.push(`Array must have at least ${this.#minLen} item(s)`);
    }
    if (this.#maxLen !== undefined && value.length > this.#maxLen) {
      errors.push(`Array must have at most ${this.#maxLen} item(s)`);
    }
    if (this.#uniqueCheck) {
      const seen = new Set();
      for (const item of value) {
        const key = JSON.stringify(item);
        if (seen.has(key)) {
          errors.push('Array items must be unique');
          break;
        }
        seen.add(key);
      }
    }
    for (let i = 0; i < value.length; i++) {
      const itemResult = this.#item.validate(value[i]);
      if (!itemResult.valid) {
        for (const err of itemResult.errors) {
          errors.push(`[${i}]: ${err}`);
        }
      }
    }
    return { valid: errors.length === 0, errors };
  }

  protected _coerce(value: unknown): unknown {
    const arr = value as unknown[];
    return arr.map((item) => (this.#item as BaseSchema<T>)._coerce(item));
  }

  /** Require minimum array length. */
  min(n: number): this {
    this.#minLen = n;
    return this;
  }

  /** Require maximum array length. */
  max(n: number): this {
    this.#maxLen = n;
    return this;
  }

  /** Require all items to be unique (compared by JSON serialization). */
  unique(): this {
    this.#uniqueCheck = true;
    return this;
  }
}

// ─── Literal Schema ───────────────────────────────────────────────────────────

class LiteralSchema<T extends string | number | boolean> extends BaseSchema<T> {
  #expected: T;
  constructor(expected: T) {
    super();
    this.#expected = expected;
  }
  validate(value: unknown): ValidationResult {
    if (value !== this.#expected) {
      return {
        valid: false,
        errors: [`Expected literal ${JSON.stringify(this.#expected)}, got ${JSON.stringify(value)}`],
      };
    }
    return { valid: true, errors: [] };
  }
}

// ─── Union Schema ─────────────────────────────────────────────────────────────

class UnionSchema<T> extends BaseSchema<T> {
  #schemas: Schema<T>[];
  constructor(schemas: Schema<T>[]) {
    super();
    this.#schemas = schemas;
  }
  validate(value: unknown): ValidationResult {
    for (const schema of this.#schemas) {
      const result = schema.validate(value);
      if (result.valid) return { valid: true, errors: [] };
    }
    return { valid: false, errors: ['Value did not match any schema in union'] };
  }
}

// ─── Any Schema ───────────────────────────────────────────────────────────────

class AnySchema extends BaseSchema<unknown> {
  validate(_value: unknown): ValidationResult {
    return { valid: true, errors: [] };
  }
}

// ─── Public Builder ───────────────────────────────────────────────────────────

export const s = {
  /** Create a string schema. */
  string(): StringSchema {
    return new StringSchema();
  },
  /** Create a number schema. */
  number(): NumberSchema {
    return new NumberSchema();
  },
  /** Create a boolean schema. */
  boolean(): BooleanSchema {
    return new BooleanSchema();
  },
  /** Create an object schema with the given shape. */
  object<T extends SchemaMap>(shape: T): ObjectSchema<T> {
    return new ObjectSchema(shape);
  },
  /** Create an array schema with item validation. */
  array<T>(item: Schema<T>): ArraySchema<T> {
    return new ArraySchema(item);
  },
  /** Create a literal schema that matches a single exact value. */
  literal<T extends string | number | boolean>(value: T): Schema<T> {
    return new LiteralSchema(value);
  },
  /** Create a union schema that matches if any of the given schemas match. */
  union<T>(...schemas: Schema<T>[]): Schema<T> {
    return new UnionSchema(schemas);
  },
  /** Create a schema that accepts any value. */
  any(): Schema<unknown> {
    return new AnySchema();
  },
};
