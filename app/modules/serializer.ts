// @ts-check
// ─── Serializer ───────────────────────────────────────────────────────────────
// Data serialization / deserialization utilities:
//   • JSON with optional pretty-printing and a custom replacer
//   • Extended JSON preserving Date, Map, Set, Uint8Array, undefined, BigInt
//   • Key-value (key=value\n…) flat format
//   • packNumbers / unpackNumbers (base64 of Float64Array buffer)
//   • msgpack / msgunpack (simplified MessagePack-inspired binary as base64)
//   • Object diff and patch

// ─── Types ────────────────────────────────────────────────────────────────────

/** Options for `serialize`. */
export interface SerializeOptions {
  /** Pretty-print the output (default false). */
  pretty?: boolean;
  /** Indent spaces when pretty-printing (default 2). */
  indent?: number;
  /** Custom replacer applied before stringification. */
  replacer?: (key: string, value: unknown) => unknown;
}

/** Shape of a type-tagged token stored by `serializeExtended`. */
interface ExtendedTag {
  __type: string;
  value: unknown;
}

/** Result of `diff`. */
export interface DiffResult {
  added: Record<string, unknown>;
  removed: Record<string, unknown>;
  changed: Record<string, { from: unknown; to: unknown }>;
}

/** Argument accepted by `patch`. */
export interface PatchInput {
  added?: Record<string, unknown>;
  removed?: Record<string, unknown>;
  changed?: Record<string, { from: unknown; to: unknown }>;
}

// ─── serialize / deserialize ──────────────────────────────────────────────────

/**
 * Serialize `value` to a JSON string.
 * Supports optional pretty-printing, custom indent, and a replacer function.
 */
export function serialize(value: unknown, options?: SerializeOptions): string {
  const pretty = options?.pretty ?? false;
  const indent = options?.indent ?? 2;
  const replacer = options?.replacer;

  if (replacer) {
    return JSON.stringify(
      value,
      (key, val) => replacer(key, val),
      pretty ? indent : undefined,
    );
  }

  return JSON.stringify(value, null, pretty ? indent : undefined);
}

/**
 * Deserialize a JSON string to a value of type `T`.
 * Throws a `SyntaxError` if the string is not valid JSON.
 */
export function deserialize<T = unknown>(str: string): T {
  return JSON.parse(str) as T;
}

// ─── serializeExtended / deserializeExtended ─────────────────────────────────

/** Tag names used in the extended format. */
const TAG_DATE = 'Date';
const TAG_MAP = 'Map';
const TAG_SET = 'Set';
const TAG_UINT8ARRAY = 'Uint8Array';
const TAG_UNDEFINED = 'undefined';
const TAG_BIGINT = 'BigInt';

// NOTE: JSON.stringify calls Date.prototype.toJSON() before the replacer sees
// the value, so `val` for a Date key will already be an ISO string.  We use
// `this[key]` to obtain the raw, pre-toJSON value so we can detect Date,
// Map, Set, and Uint8Array instances correctly.
function extendedReplacer(this: unknown, key: string, val: unknown): unknown {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw: unknown = key === '' ? val : (this as any)[key];

  if (raw === undefined) {
    return { __type: TAG_UNDEFINED, value: null } satisfies ExtendedTag;
  }
  if (typeof raw === 'bigint') {
    return { __type: TAG_BIGINT, value: raw.toString() } satisfies ExtendedTag;
  }
  if (raw instanceof Date) {
    return { __type: TAG_DATE, value: raw.toISOString() } satisfies ExtendedTag;
  }
  if (raw instanceof Map) {
    return {
      __type: TAG_MAP,
      value: Array.from(raw.entries()),
    } satisfies ExtendedTag;
  }
  if (raw instanceof Set) {
    return { __type: TAG_SET, value: Array.from(raw.values()) } satisfies ExtendedTag;
  }
  if (raw instanceof Uint8Array) {
    return { __type: TAG_UINT8ARRAY, value: Array.from(raw) } satisfies ExtendedTag;
  }
  return val;
}

function extendedReviver(_key: string, val: unknown): unknown {
  if (val !== null && typeof val === 'object' && '__type' in (val as object)) {
    const tagged = val as ExtendedTag;
    switch (tagged.__type) {
      case TAG_DATE:
        return new Date(tagged.value as string);
      case TAG_MAP:
        return new Map(tagged.value as [unknown, unknown][]);
      case TAG_SET:
        return new Set(tagged.value as unknown[]);
      case TAG_UINT8ARRAY:
        return new Uint8Array(tagged.value as number[]);
      case TAG_UNDEFINED:
        return undefined;
      case TAG_BIGINT:
        return BigInt(tagged.value as string);
      default:
        break;
    }
  }
  return val;
}

/**
 * Serialize `value` to JSON preserving special JS types:
 * `Date`, `Map`, `Set`, `Uint8Array`, `undefined`, and `BigInt`.
 *
 * Each special value is stored as `{ "__type": "<Name>", "value": … }`.
 */
export function serializeExtended(value: unknown): string {
  // Top-level `undefined` is not passed through JSON.stringify's replacer, so
  // we handle it explicitly to keep roundtrip behaviour consistent.
  if (value === undefined) {
    return JSON.stringify({ __type: TAG_UNDEFINED, value: null });
  }
  return JSON.stringify(value, extendedReplacer);
}

/**
 * Deserialize an extended JSON string produced by `serializeExtended`,
 * restoring `Date`, `Map`, `Set`, `Uint8Array`, `undefined`, and `BigInt`.
 */
export function deserializeExtended<T = unknown>(str: string): T {
  const raw = JSON.parse(str, extendedReviver);
  return raw as T;
}

// ─── serializeKV / deserializeKV ─────────────────────────────────────────────

/**
 * Serialize a flat object of primitives to a `key=value` string (one pair per
 * line, similar to a `.env` file).
 *
 * Example: `{ a: 1, b: 'hello', c: true }` → `"a=1\nb=hello\nc=true"`
 */
export function serializeKV(obj: Record<string, string | number | boolean>): string {
  return Object.entries(obj)
    .map(([k, v]) => `${k}=${String(v)}`)
    .join('\n');
}

/**
 * Deserialize a `key=value` string back to a `Record<string, string>`.
 * Lines that do not contain `=` are silently ignored.
 * Values may themselves contain `=` — only the first `=` is used as separator.
 */
export function deserializeKV(str: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of str.split('\n')) {
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.slice(0, idx);
    const val = line.slice(idx + 1);
    if (key.length > 0) result[key] = val;
  }
  return result;
}

// ─── packNumbers / unpackNumbers ──────────────────────────────────────────────

/**
 * Pack an array of numbers into a compact base64 string by writing each value
 * as an IEEE-754 Float64 (8 bytes) into a `Float64Array` and then base64-
 * encoding the underlying `ArrayBuffer`.
 */
export function packNumbers(nums: number[]): string {
  const buf = new Float64Array(nums).buffer;
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Unpack a base64 string produced by `packNumbers` back to a `number[]`.
 */
export function unpackNumbers(str: string): number[] {
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return Array.from(new Float64Array(bytes.buffer));
}

// ─── msgpack / msgunpack ──────────────────────────────────────────────────────
//
// Simplified MessagePack-inspired binary format encoded as base64.
// Type tag byte meanings:
//   0x00  null
//   0x01  undefined
//   0x02  boolean false
//   0x03  boolean true
//   0x04  number      (8 bytes big-endian Float64)
//   0x05  string      (4-byte LE uint32 length, then UTF-8 bytes)
//   0x06  Array       (4-byte LE uint32 count, then N encoded items)
//   0x07  plain object (4-byte LE uint32 pair count, then N key-value pairs)
//   0x08  Uint8Array  (4-byte LE uint32 length, then raw bytes)
//   0x09  BigInt      (encoded as its decimal string)
//   0x0A  Date        (8 bytes big-endian Float64 of getTime())

const MP_NULL = 0x00;
const MP_UNDEFINED = 0x01;
const MP_FALSE = 0x02;
const MP_TRUE = 0x03;
const MP_NUMBER = 0x04;
const MP_STRING = 0x05;
const MP_ARRAY = 0x06;
const MP_OBJECT = 0x07;
const MP_UINT8ARRAY = 0x08;
const MP_BIGINT = 0x09;
const MP_DATE = 0x0a;

/** Growable byte buffer used during msgpack encoding. */
class ByteWriter {
  #data: number[] = [];

  writeByte(b: number): void {
    this.#data.push(b & 0xff);
  }

  writeUint32LE(n: number): void {
    this.#data.push(
      n & 0xff,
      (n >>> 8) & 0xff,
      (n >>> 16) & 0xff,
      (n >>> 24) & 0xff,
    );
  }

  /** Write a 64-bit float in big-endian byte order. */
  writeFloat64BE(n: number): void {
    const buf = new ArrayBuffer(8);
    const view = new DataView(buf);
    view.setFloat64(0, n, false); // false = big-endian
    for (let i = 0; i < 8; i++) {
      this.#data.push(view.getUint8(i));
    }
  }

  writeBytes(bytes: Uint8Array): void {
    for (let i = 0; i < bytes.length; i++) {
      this.#data.push(bytes[i]);
    }
  }

  toUint8Array(): Uint8Array {
    return new Uint8Array(this.#data);
  }
}

const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();

function mpEncode(value: unknown, w: ByteWriter): void {
  if (value === null) {
    w.writeByte(MP_NULL);
    return;
  }
  if (value === undefined) {
    w.writeByte(MP_UNDEFINED);
    return;
  }
  if (typeof value === 'boolean') {
    w.writeByte(value ? MP_TRUE : MP_FALSE);
    return;
  }
  if (typeof value === 'number') {
    w.writeByte(MP_NUMBER);
    w.writeFloat64BE(value);
    return;
  }
  if (typeof value === 'bigint') {
    const bytes = TEXT_ENCODER.encode(value.toString());
    w.writeByte(MP_BIGINT);
    w.writeUint32LE(bytes.length);
    w.writeBytes(bytes);
    return;
  }
  if (typeof value === 'string') {
    const bytes = TEXT_ENCODER.encode(value);
    w.writeByte(MP_STRING);
    w.writeUint32LE(bytes.length);
    w.writeBytes(bytes);
    return;
  }
  if (value instanceof Date) {
    w.writeByte(MP_DATE);
    w.writeFloat64BE(value.getTime());
    return;
  }
  if (value instanceof Uint8Array) {
    w.writeByte(MP_UINT8ARRAY);
    w.writeUint32LE(value.length);
    w.writeBytes(value);
    return;
  }
  if (Array.isArray(value)) {
    w.writeByte(MP_ARRAY);
    w.writeUint32LE(value.length);
    for (const item of value) mpEncode(item, w);
    return;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    w.writeByte(MP_OBJECT);
    w.writeUint32LE(entries.length);
    for (const [k, v] of entries) {
      mpEncode(k, w);
      mpEncode(v, w);
    }
    return;
  }
  // Fallback: treat as string
  const bytes = TEXT_ENCODER.encode(String(value));
  w.writeByte(MP_STRING);
  w.writeUint32LE(bytes.length);
  w.writeBytes(bytes);
}

/** Cursor-based byte reader used during msgpack decoding. */
class ByteReader {
  #data: Uint8Array;
  #pos = 0;

  constructor(data: Uint8Array) {
    this.#data = data;
  }

  readByte(): number {
    if (this.#pos >= this.#data.length) {
      throw new RangeError('Unexpected end of msgpack data');
    }
    return this.#data[this.#pos++];
  }

  readUint32LE(): number {
    const a = this.readByte();
    const b = this.readByte();
    const c = this.readByte();
    const d = this.readByte();
    return (a | (b << 8) | (c << 16) | (d << 24)) >>> 0;
  }

  readFloat64BE(): number {
    const buf = new ArrayBuffer(8);
    const view = new DataView(buf);
    for (let i = 0; i < 8; i++) {
      view.setUint8(i, this.readByte());
    }
    return view.getFloat64(0, false); // false = big-endian
  }

  readBytes(n: number): Uint8Array {
    const slice = this.#data.slice(this.#pos, this.#pos + n);
    this.#pos += n;
    return slice;
  }
}

function mpDecode(r: ByteReader): unknown {
  const tag = r.readByte();
  switch (tag) {
    case MP_NULL: return null;
    case MP_UNDEFINED: return undefined;
    case MP_FALSE: return false;
    case MP_TRUE: return true;
    case MP_NUMBER: return r.readFloat64BE();
    case MP_DATE: return new Date(r.readFloat64BE());
    case MP_BIGINT: {
      const len = r.readUint32LE();
      return BigInt(TEXT_DECODER.decode(r.readBytes(len)));
    }
    case MP_STRING: {
      const len = r.readUint32LE();
      return TEXT_DECODER.decode(r.readBytes(len));
    }
    case MP_UINT8ARRAY: {
      const len = r.readUint32LE();
      return r.readBytes(len);
    }
    case MP_ARRAY: {
      const len = r.readUint32LE();
      const arr: unknown[] = [];
      for (let i = 0; i < len; i++) arr.push(mpDecode(r));
      return arr;
    }
    case MP_OBJECT: {
      const len = r.readUint32LE();
      const obj: Record<string, unknown> = {};
      for (let i = 0; i < len; i++) {
        const key = mpDecode(r) as string;
        obj[key] = mpDecode(r);
      }
      return obj;
    }
    default:
      throw new RangeError(`Unknown msgpack tag: 0x${tag.toString(16)}`);
  }
}

/**
 * Encode `value` using a simplified MessagePack-inspired binary format and
 * return the result as a base64 string.
 *
 * Supports: `null`, `undefined`, `boolean`, `number`, `string`, `bigint`,
 * `Date`, `Uint8Array`, plain arrays, and plain objects.
 */
export function msgpack(value: unknown): string {
  const w = new ByteWriter();
  mpEncode(value, w);
  const bytes = w.toUint8Array();
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Decode a base64 string produced by `msgpack` back to its original value.
 */
export function msgunpack<T = unknown>(str: string): T {
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return mpDecode(new ByteReader(bytes)) as T;
}

// ─── diff / patch ─────────────────────────────────────────────────────────────

/**
 * Compute the shallow diff between two plain objects.
 *
 * Returns three buckets:
 * - `added`   — keys present in `modified` but not in `original`
 * - `removed` — keys present in `original` but not in `modified`
 * - `changed` — keys present in both but with structurally different values
 *
 * Equality is determined via `JSON.stringify` so nested objects are compared
 * by value rather than reference.
 */
export function diff(
  original: Record<string, unknown>,
  modified: Record<string, unknown>,
): DiffResult {
  const added: Record<string, unknown> = {};
  const removed: Record<string, unknown> = {};
  const changed: Record<string, { from: unknown; to: unknown }> = {};

  const origKeys = new Set(Object.keys(original));
  const modKeys = new Set(Object.keys(modified));

  for (const key of modKeys) {
    if (!origKeys.has(key)) {
      added[key] = modified[key];
    } else if (JSON.stringify(original[key]) !== JSON.stringify(modified[key])) {
      changed[key] = { from: original[key], to: modified[key] };
    }
  }

  for (const key of origKeys) {
    if (!modKeys.has(key)) {
      removed[key] = original[key];
    }
  }

  return { added, removed, changed };
}

/**
 * Apply a diff produced by `diff` to `original`, returning a new object.
 *
 * - Keys in `added`   are copied into the result.
 * - Keys in `removed` are omitted from the result.
 * - Keys in `changed` have their values replaced with `to`.
 *
 * The `original` object is not mutated.
 */
export function patch<T extends Record<string, unknown>>(original: T, diffInput: PatchInput): T {
  const result: Record<string, unknown> = { ...original };

  for (const key of Object.keys(diffInput.removed ?? {})) {
    delete result[key];
  }

  for (const [key, { to }] of Object.entries(diffInput.changed ?? {})) {
    result[key] = to;
  }

  for (const [key, val] of Object.entries(diffInput.added ?? {})) {
    result[key] = val;
  }

  return result as T;
}
