// @ts-check
// ─── Fluent Validator ────────────────────────────────────────────────────────
// Fluent, Zod-inspired data validator. No external dependencies.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: ValidationError[];
}

export interface ValidationError {
  path: string[];
  message: string;
}

// ─── Internal error class ─────────────────────────────────────────────────────

class ValidationException extends Error {
  errors: ValidationError[];
  constructor(errors: ValidationError[]) {
    super(
      errors
        .map((e) => (e.path.length > 0 ? `${e.path.join('.')}: ${e.message}` : e.message))
        .join('; '),
    );
    this.name = 'ValidationException';
    this.errors = errors;
  }
}

// ─── Base Schema ──────────────────────────────────────────────────────────────

export abstract class Schema<T> {
  protected _refinements: Array<{ fn: (val: T) => boolean; message: string }> = [];

  abstract parse(input: unknown): T;

  safeParse(input: unknown): ValidationResult<T> {
    try {
      const data = this.parse(input);
      return { success: true, data };
    } catch (err) {
      if (err instanceof ValidationException) {
        return { success: false, errors: err.errors };
      }
      return { success: false, errors: [{ path: [], message: String(err) }] };
    }
  }

  optional(): Schema<T | undefined> {
    const parent = this;
    return new (class extends Schema<T | undefined> {
      parse(input: unknown): T | undefined {
        if (input === undefined) return undefined;
        return parent.parse(input);
      }
    })();
  }

  nullable(): Schema<T | null> {
    const parent = this;
    return new (class extends Schema<T | null> {
      parse(input: unknown): T | null {
        if (input === null) return null;
        return parent.parse(input);
      }
    })();
  }

  refine(fn: (val: T) => boolean, message = 'Refinement failed'): Schema<T> {
    const parent = this;
    return new (class extends Schema<T> {
      parse(input: unknown): T {
        const val = parent.parse(input);
        if (!fn(val)) {
          throw new ValidationException([{ path: [], message }]);
        }
        return val;
      }
    })();
  }

  protected _applyRefinements(val: T, path: string[] = []): void {
    for (const r of this._refinements) {
      if (!r.fn(val)) {
        throw new ValidationException([{ path, message: r.message }]);
      }
    }
  }
}

// ─── StringSchema ─────────────────────────────────────────────────────────────

export class StringSchema extends Schema<string> {
  private _validators: Array<(val: string) => string | null> = [];
  private _doTrim = false;

  parse(input: unknown): string {
    if (typeof input !== 'string') {
      throw new ValidationException([
        { path: [], message: `Expected string, got ${typeof input}` },
      ]);
    }
    const val = this._doTrim ? input.trim() : input;
    for (const validator of this._validators) {
      const err = validator(val);
      if (err !== null) {
        throw new ValidationException([{ path: [], message: err }]);
      }
    }
    this._applyRefinements(val);
    return val;
  }

  private _clone(): StringSchema {
    const s = new StringSchema();
    s._validators = [...this._validators];
    s._refinements = [...this._refinements];
    s._doTrim = this._doTrim;
    return s;
  }

  min(n: number): StringSchema {
    const s = this._clone();
    s._validators.push((val) =>
      val.length < n ? `String must be at least ${n} characters` : null,
    );
    return s;
  }

  max(n: number): StringSchema {
    const s = this._clone();
    s._validators.push((val) =>
      val.length > n ? `String must be at most ${n} characters` : null,
    );
    return s;
  }

  email(): StringSchema {
    const s = this._clone();
    s._validators.push((val) =>
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val) ? null : 'Invalid email address',
    );
    return s;
  }

  url(): StringSchema {
    const s = this._clone();
    s._validators.push((val) => {
      try {
        new URL(val);
        return null;
      } catch {
        return 'Invalid URL';
      }
    });
    return s;
  }

  regex(pattern: RegExp): StringSchema {
    const s = this._clone();
    s._validators.push((val) =>
      pattern.test(val) ? null : `String does not match pattern ${pattern}`,
    );
    return s;
  }

  trim(): StringSchema {
    const s = this._clone();
    s._doTrim = true;
    return s;
  }
}

// ─── NumberSchema ─────────────────────────────────────────────────────────────

export class NumberSchema extends Schema<number> {
  private _validators: Array<(val: number) => string | null> = [];

  parse(input: unknown): number {
    if (typeof input !== 'number' || isNaN(input)) {
      throw new ValidationException([
        { path: [], message: `Expected number, got ${typeof input}` },
      ]);
    }
    for (const validator of this._validators) {
      const err = validator(input);
      if (err !== null) {
        throw new ValidationException([{ path: [], message: err }]);
      }
    }
    this._applyRefinements(input);
    return input;
  }

  private _clone(): NumberSchema {
    const n = new NumberSchema();
    n._validators = [...this._validators];
    n._refinements = [...this._refinements];
    return n;
  }

  min(n: number): NumberSchema {
    const s = this._clone();
    s._validators.push((val) => (val < n ? `Number must be at least ${n}` : null));
    return s;
  }

  max(n: number): NumberSchema {
    const s = this._clone();
    s._validators.push((val) => (val > n ? `Number must be at most ${n}` : null));
    return s;
  }

  int(): NumberSchema {
    const s = this._clone();
    s._validators.push((val) => (Number.isInteger(val) ? null : 'Number must be an integer'));
    return s;
  }

  positive(): NumberSchema {
    const s = this._clone();
    s._validators.push((val) => (val > 0 ? null : 'Number must be positive'));
    return s;
  }

  negative(): NumberSchema {
    const s = this._clone();
    s._validators.push((val) => (val < 0 ? null : 'Number must be negative'));
    return s;
  }
}

// ─── BooleanSchema ────────────────────────────────────────────────────────────

export class BooleanSchema extends Schema<boolean> {
  parse(input: unknown): boolean {
    if (typeof input !== 'boolean') {
      throw new ValidationException([
        { path: [], message: `Expected boolean, got ${typeof input}` },
      ]);
    }
    this._applyRefinements(input);
    return input;
  }
}

// ─── ArraySchema ──────────────────────────────────────────────────────────────

export class ArraySchema<T> extends Schema<T[]> {
  private _itemSchema: Schema<T>;
  private _validators: Array<(val: T[]) => string | null> = [];

  constructor(itemSchema: Schema<T>) {
    super();
    this._itemSchema = itemSchema;
  }

  parse(input: unknown): T[] {
    if (!Array.isArray(input)) {
      throw new ValidationException([
        { path: [], message: `Expected array, got ${typeof input}` },
      ]);
    }
    const result: T[] = [];
    const errors: ValidationError[] = [];
    for (let i = 0; i < input.length; i++) {
      const itemResult = this._itemSchema.safeParse(input[i]);
      if (itemResult.success) {
        result.push(itemResult.data as T);
      } else {
        for (const err of itemResult.errors ?? []) {
          errors.push({ path: [String(i), ...err.path], message: err.message });
        }
      }
    }
    if (errors.length > 0) {
      throw new ValidationException(errors);
    }
    for (const validator of this._validators) {
      const err = validator(result);
      if (err !== null) {
        throw new ValidationException([{ path: [], message: err }]);
      }
    }
    this._applyRefinements(result);
    return result;
  }

  private _clone(): ArraySchema<T> {
    const a = new ArraySchema<T>(this._itemSchema);
    a._validators = [...this._validators];
    a._refinements = [...this._refinements];
    return a;
  }

  min(n: number): ArraySchema<T> {
    const s = this._clone();
    s._validators.push((val) =>
      val.length < n ? `Array must have at least ${n} items` : null,
    );
    return s;
  }

  max(n: number): ArraySchema<T> {
    const s = this._clone();
    s._validators.push((val) =>
      val.length > n ? `Array must have at most ${n} items` : null,
    );
    return s;
  }
}

// ─── ObjectSchema ─────────────────────────────────────────────────────────────

type ShapeToType<S extends Record<string, Schema<unknown>>> = {
  [K in keyof S]: S[K] extends Schema<infer T> ? T : never;
};

export class ObjectSchema<T extends Record<string, unknown>> extends Schema<T> {
  private _shape: Record<string, Schema<unknown>>;

  constructor(shape: Record<string, Schema<unknown>>) {
    super();
    this._shape = shape;
  }

  parse(input: unknown): T {
    if (typeof input !== 'object' || input === null || Array.isArray(input)) {
      throw new ValidationException([
        {
          path: [],
          message: `Expected object, got ${Array.isArray(input) ? 'array' : typeof input}`,
        },
      ]);
    }
    const obj = input as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    const errors: ValidationError[] = [];

    for (const key of Object.keys(this._shape)) {
      const fieldResult = this._shape[key].safeParse(obj[key]);
      if (fieldResult.success) {
        result[key] = fieldResult.data;
      } else {
        for (const err of fieldResult.errors ?? []) {
          errors.push({ path: [key, ...err.path], message: err.message });
        }
      }
    }

    if (errors.length > 0) {
      throw new ValidationException(errors);
    }

    this._applyRefinements(result as T);
    return result as T;
  }

  pick<K extends keyof T>(...keys: K[]): ObjectSchema<Pick<T, K>> {
    const newShape: Record<string, Schema<unknown>> = {};
    for (const key of keys) {
      newShape[key as string] = this._shape[key as string];
    }
    return new ObjectSchema<Pick<T, K>>(newShape);
  }

  omit<K extends keyof T>(...keys: K[]): ObjectSchema<Omit<T, K>> {
    const omitSet = new Set(keys as string[]);
    const newShape: Record<string, Schema<unknown>> = {};
    for (const key of Object.keys(this._shape)) {
      if (!omitSet.has(key)) {
        newShape[key] = this._shape[key];
      }
    }
    return new ObjectSchema<Omit<T, K>>(newShape);
  }
}

// ─── UnionSchema ──────────────────────────────────────────────────────────────

class UnionSchema<T> extends Schema<T> {
  private _schemas: Schema<unknown>[];

  constructor(schemas: Schema<unknown>[]) {
    super();
    this._schemas = schemas;
  }

  parse(input: unknown): T {
    for (const schema of this._schemas) {
      const result = schema.safeParse(input);
      if (result.success) {
        return result.data as T;
      }
    }
    throw new ValidationException([
      { path: [], message: 'Value did not match any union member' },
    ]);
  }
}

// ─── LiteralSchema ────────────────────────────────────────────────────────────

class LiteralSchema<T extends string | number | boolean> extends Schema<T> {
  private _value: T;

  constructor(value: T) {
    super();
    this._value = value;
  }

  parse(input: unknown): T {
    if (input !== this._value) {
      throw new ValidationException([
        {
          path: [],
          message: `Expected literal ${JSON.stringify(this._value)}, got ${JSON.stringify(input)}`,
        },
      ]);
    }
    return input as T;
  }
}

// ─── AnySchema ────────────────────────────────────────────────────────────────

class AnySchema extends Schema<unknown> {
  parse(input: unknown): unknown {
    return input;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const v = {
  string(): StringSchema {
    return new StringSchema();
  },

  number(): NumberSchema {
    return new NumberSchema();
  },

  boolean(): BooleanSchema {
    return new BooleanSchema();
  },

  array<T>(item: Schema<T>): ArraySchema<T> {
    return new ArraySchema<T>(item);
  },

  object<S extends Record<string, Schema<unknown>>>(shape: S): ObjectSchema<ShapeToType<S>> {
    return new ObjectSchema<ShapeToType<S>>(shape as Record<string, Schema<unknown>>);
  },

  union<T extends Schema<unknown>[]>(...schemas: T): Schema<unknown> {
    return new UnionSchema(schemas);
  },

  literal<T extends string | number | boolean>(value: T): Schema<T> {
    return new LiteralSchema<T>(value);
  },

  any(): Schema<unknown> {
    return new AnySchema();
  },
};
