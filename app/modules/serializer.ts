// @ts-check
// ─── Serializer ───────────────────────────────────────────────────────────────
// Type-safe serialization utilities: JSON, Map/Set, base64, deep clone/merge.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SerializeOptions {
  /** JSON indent spaces, default 0 */
  indent?: number;
  /** Serialize undefined values as null, default false */
  includeUndefined?: boolean;
  /** How to serialize Date objects */
  dateFormat?: 'iso' | 'timestamp';
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

type MapMarker = { __type: 'Map'; entries: [unknown, unknown][] };
type SetMarker = { __type: 'Set'; values: unknown[] };

function makeReplacer(
  options: SerializeOptions,
  seen: WeakSet<object>,
): (key: string, value: unknown) => unknown {
  return function replacer(this: unknown, key: string, value: unknown): unknown {
    // `this` is the containing object; `value` is already the result of toJSON
    // We need the raw value from `this[key]` to catch Date/Map/Set properly.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw: unknown = (this as any)[key];

    if (raw instanceof Date) {
      return options.dateFormat === 'timestamp' ? raw.getTime() : raw.toISOString();
    }

    if (raw instanceof Map) {
      if (seen.has(raw)) throw new Error('Circular reference detected');
      seen.add(raw);
      const marker: MapMarker = {
        __type: 'Map',
        entries: [...raw.entries()],
      };
      return marker;
    }

    if (raw instanceof Set) {
      if (seen.has(raw)) throw new Error('Circular reference detected');
      seen.add(raw);
      const marker: SetMarker = {
        __type: 'Set',
        values: [...raw.values()],
      };
      return marker;
    }

    if (typeof raw === 'object' && raw !== null) {
      if (seen.has(raw as object)) throw new Error('Circular reference detected');
      seen.add(raw as object);
    }

    if (raw === undefined) {
      return options.includeUndefined ? null : undefined;
    }

    return value;
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Serialize a value to JSON string. Handles Date, Map, Set, undefined. */
export function serialize(value: unknown, options: SerializeOptions = {}): string {
  const seen = new WeakSet<object>();
  const indent = options.indent ?? 0;
  return JSON.stringify(value, makeReplacer(options, seen), indent || undefined);
}

/** Deserialize a JSON string back to a value. Restores Map and Set. */
export function deserialize<T = unknown>(json: string): T {
  return JSON.parse(json, (_key: string, value: unknown): unknown => {
    if (
      value !== null &&
      typeof value === 'object' &&
      (value as Record<string, unknown>).__type === 'Map'
    ) {
      const marker = value as MapMarker;
      return new Map(marker.entries);
    }
    if (
      value !== null &&
      typeof value === 'object' &&
      (value as Record<string, unknown>).__type === 'Set'
    ) {
      const marker = value as SetMarker;
      return new Set(marker.values);
    }
    return value;
  }) as T;
}

/** Deep clone a value via serialize/deserialize cycle. */
export function deepClone<T>(value: T): T {
  return deserialize<T>(serialize(value));
}

/** Check if a value is serializable (no functions, symbols, circular refs). */
export function isSerializable(value: unknown): boolean {
  try {
    const seen = new WeakSet<object>();

    function check(val: unknown): boolean {
      if (val === null || val === undefined) return true;
      const t = typeof val;
      if (t === 'function' || t === 'symbol' || t === 'bigint') return false;
      if (t !== 'object') return true;

      const obj = val as object;
      if (seen.has(obj)) return false; // circular
      seen.add(obj);

      if (val instanceof Date) return true;
      if (val instanceof Map) {
        for (const [k, v] of val) {
          if (!check(k) || !check(v)) return false;
        }
        return true;
      }
      if (val instanceof Set) {
        for (const v of val) {
          if (!check(v)) return false;
        }
        return true;
      }
      if (Array.isArray(val)) {
        return (val as unknown[]).every(check);
      }
      // plain object
      for (const v of Object.values(val as Record<string, unknown>)) {
        if (!check(v)) return false;
      }
      return true;
    }

    return check(value);
  } catch {
    return false;
  }
}

/** Serialize to base64 string. */
export function serializeToBase64(value: unknown): string {
  const json = serialize(value);
  return Buffer.from(json, 'utf8').toString('base64');
}

/** Deserialize from base64 string. */
export function deserializeFromBase64<T = unknown>(base64: string): T {
  const json = Buffer.from(base64, 'base64').toString('utf8');
  return deserialize<T>(json);
}

/** Merge two serializable objects deeply. */
export function deepMerge<T extends object>(target: T, source: Partial<T>): T {
  const result: Record<string, unknown> = { ...(target as Record<string, unknown>) };
  for (const [key, srcVal] of Object.entries(source as Record<string, unknown>)) {
    const tgtVal = result[key];
    if (
      srcVal !== null &&
      typeof srcVal === 'object' &&
      !Array.isArray(srcVal) &&
      !(srcVal instanceof Date) &&
      !(srcVal instanceof Map) &&
      !(srcVal instanceof Set) &&
      tgtVal !== null &&
      typeof tgtVal === 'object' &&
      !Array.isArray(tgtVal) &&
      !(tgtVal instanceof Date) &&
      !(tgtVal instanceof Map) &&
      !(tgtVal instanceof Set)
    ) {
      result[key] = deepMerge(
        tgtVal as Record<string, unknown>,
        srcVal as Record<string, unknown>,
      );
    } else {
      result[key] = srcVal;
    }
  }
  return result as T;
}
