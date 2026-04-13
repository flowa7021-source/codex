// @ts-check
// ─── Env Config ───────────────────────────────────────────────────────────────
// Environment-variable-based configuration with schema-driven type coercion
// and validation. Accepts an injectable `env` map for hermetic testing.

// ─── Types ────────────────────────────────────────────────────────────────────

export type EnvFieldType = 'string' | 'number' | 'boolean' | 'json';

export interface EnvFieldDef {
  type: EnvFieldType;
  required?: boolean;
  default?: unknown;
  description?: string;
}

export type EnvSchema = Record<string, EnvFieldDef>;

// ─── Coercion helpers ─────────────────────────────────────────────────────────

function coerce(raw: string, type: EnvFieldType): unknown {
  switch (type) {
    case 'string':
      return raw;
    case 'number': {
      const n = Number(raw);
      if (!Number.isFinite(n)) {
        throw new TypeError(`Cannot coerce "${raw}" to number`);
      }
      return n;
    }
    case 'boolean': {
      const lower = raw.trim().toLowerCase();
      if (lower === 'true' || lower === '1' || lower === 'yes') return true;
      if (lower === 'false' || lower === '0' || lower === 'no') return false;
      throw new TypeError(`Cannot coerce "${raw}" to boolean`);
    }
    case 'json': {
      try {
        return JSON.parse(raw);
      } catch {
        throw new TypeError(`Cannot parse "${raw}" as JSON`);
      }
    }
    default:
      return raw;
  }
}

// ─── EnvConfig ────────────────────────────────────────────────────────────────

/**
 * Environment-based configuration with schema-defined types, defaults, and
 * required-field validation.
 *
 * @example
 *   const cfg = new EnvConfig(
 *     { PORT: { type: 'number', default: 8080 } },
 *     { PORT: '3000' },
 *   );
 *   cfg.getNumber('PORT'); // 3000
 */
export class EnvConfig {
  #schema: EnvSchema;
  #env: Record<string, string>;
  /** Resolved value cache (lazy). */
  #cache: Map<string, unknown> = new Map();

  constructor(
    schema: EnvSchema,
    env?: Record<string, string>,
  ) {
    this.#schema = schema;
    // Default to process.env when no injectable env is provided.
    this.#env =
      env ??
      (typeof process !== 'undefined'
        ? (process.env as Record<string, string>)
        : {});
  }

  // ─── Resolve ──────────────────────────────────────────────────────────────

  /** Resolve and cache the typed value for `key`. */
  #resolve(key: string): unknown {
    if (this.#cache.has(key)) return this.#cache.get(key);

    const def = this.#schema[key];
    if (def === undefined) {
      throw new RangeError(`Unknown env key: "${key}"`);
    }

    const raw = this.#env[key];

    let value: unknown;
    if (raw !== undefined && raw !== '') {
      value = coerce(raw, def.type);
    } else if ('default' in def) {
      value = def.default;
    } else {
      value = undefined;
    }

    this.#cache.set(key, value);
    return value;
  }

  // ─── Access ───────────────────────────────────────────────────────────────

  /** Return the typed value for `key` (may be `undefined`). */
  get(key: string): unknown {
    return this.#resolve(key);
  }

  /** Return a string value, or `fallback` when not set. */
  getString(key: string, fallback?: string): string {
    const v = this.#resolve(key);
    if (v === undefined || v === null) {
      if (fallback !== undefined) return fallback;
      throw new TypeError(`Missing string value for key "${key}"`);
    }
    return String(v);
  }

  /** Return a number value, or `fallback` when not set. */
  getNumber(key: string, fallback?: number): number {
    const v = this.#resolve(key);
    if (v === undefined || v === null) {
      if (fallback !== undefined) return fallback;
      throw new TypeError(`Missing number value for key "${key}"`);
    }
    if (typeof v !== 'number') {
      throw new TypeError(`Value for "${key}" is not a number`);
    }
    return v;
  }

  /** Return a boolean value, or `fallback` when not set. */
  getBoolean(key: string, fallback?: boolean): boolean {
    const v = this.#resolve(key);
    if (v === undefined || v === null) {
      if (fallback !== undefined) return fallback;
      throw new TypeError(`Missing boolean value for key "${key}"`);
    }
    if (typeof v !== 'boolean') {
      throw new TypeError(`Value for "${key}" is not a boolean`);
    }
    return v;
  }

  /** Return a JSON-parsed value, or `fallback` when not set. */
  getJSON<T = unknown>(key: string, fallback?: T): T {
    const v = this.#resolve(key);
    if (v === undefined || v === null) {
      if (fallback !== undefined) return fallback;
      throw new TypeError(`Missing JSON value for key "${key}"`);
    }
    return v as T;
  }

  // ─── Validation ───────────────────────────────────────────────────────────

  /**
   * Validate that all `required` fields are present in the environment.
   * Returns `{ valid: true, errors: [] }` on success.
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const [key, def] of Object.entries(this.#schema)) {
      if (!def.required) continue;

      let value: unknown;
      try {
        value = this.#resolve(key);
      } catch {
        errors.push(`"${key}" is required but could not be resolved`);
        continue;
      }

      if (value === undefined || value === null) {
        errors.push(`"${key}" is required but is missing or empty`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  // ─── Export ───────────────────────────────────────────────────────────────

  /** Return all resolved values for keys defined in the schema. */
  toObject(): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(this.#schema)) {
      result[key] = this.#resolve(key);
    }
    return result;
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/** Create a new `EnvConfig` without `new`. */
export function createEnvConfig(
  schema: EnvSchema,
  env?: Record<string, string>,
): EnvConfig {
  return new EnvConfig(schema, env);
}
