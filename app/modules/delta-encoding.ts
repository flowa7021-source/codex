// @ts-check
// ─── Delta Encoding ──────────────────────────────────────────────────────────
// Differential / delta encoding utilities for numeric sequences and binary data.

// ─── Sequential encode type ──────────────────────────────────────────────────

/** Result of `sequentialEncode`: minimum baseline + delta sequence. */
export interface SequentialEncoded {
  min: number;
  deltas: number[];
}

// ─── Delta (difference) encoding ─────────────────────────────────────────────

/**
 * Delta-encode an array of numbers as successive differences.
 *
 * The first element is stored as-is; every subsequent element is stored as
 * `values[i] - values[i-1]`.
 *
 * @param values - Input number array.
 * @returns Array of deltas (same length as input).
 */
export function deltaEncode(values: number[]): number[] {
  if (values.length === 0) return [];
  const result: number[] = [values[0]];
  for (let i = 1; i < values.length; i++) {
    result.push(values[i] - values[i - 1]);
  }
  return result;
}

/**
 * Reconstruct the original array from its delta-encoded form.
 *
 * @param deltas - Delta-encoded array produced by `deltaEncode`.
 * @returns Original values.
 */
export function deltaDecode(deltas: number[]): number[] {
  if (deltas.length === 0) return [];
  const result: number[] = [deltas[0]];
  for (let i = 1; i < deltas.length; i++) {
    result.push(result[i - 1] + deltas[i]);
  }
  return result;
}

// ─── XOR-delta encoding (binary / Uint32Array) ───────────────────────────────

/**
 * XOR-delta encode a `Uint32Array`.
 *
 * The first element is stored as-is; each subsequent element is stored as
 * `values[i] ^ values[i-1]`.  This is useful for binary data where adjacent
 * values share many bits (e.g. pixel rows, timestamps).
 *
 * @param values - Input 32-bit unsigned integer array.
 * @returns XOR-delta encoded array of the same length.
 */
export function xorEncode(values: Uint32Array): Uint32Array {
  if (values.length === 0) return new Uint32Array(0);
  const result = new Uint32Array(values.length);
  result[0] = values[0];
  for (let i = 1; i < values.length; i++) {
    result[i] = values[i] ^ values[i - 1];
  }
  return result;
}

/**
 * Reconstruct the original `Uint32Array` from its XOR-delta-encoded form.
 *
 * @param encoded - XOR-delta encoded array produced by `xorEncode`.
 * @returns Original values.
 */
export function xorDecode(encoded: Uint32Array): Uint32Array {
  if (encoded.length === 0) return new Uint32Array(0);
  const result = new Uint32Array(encoded.length);
  result[0] = encoded[0];
  for (let i = 1; i < encoded.length; i++) {
    result[i] = result[i - 1] ^ encoded[i];
  }
  return result;
}

// ─── Zigzag encoding ─────────────────────────────────────────────────────────

/**
 * Zigzag-encode a signed integer to a non-negative integer.
 *
 * Maps: 0→0, -1→1, 1→2, -2→3, 2→4, …
 * Formula: `(n << 1) ^ (n >> 31)` (using arithmetic right-shift semantics).
 *
 * @param n - Signed integer to encode.
 * @returns Non-negative integer.
 */
export function zigzagEncode(n: number): number {
  // Arithmetic right-shift by 31: produces -1 for negative, 0 for non-negative
  const sign = n < 0 ? -1 : 0;
  return (n * 2) ^ sign;
}

/**
 * Decode a zigzag-encoded non-negative integer back to a signed integer.
 *
 * @param n - Non-negative zigzag-encoded value.
 * @returns Original signed integer.
 */
export function zigzagDecode(n: number): number {
  return (n >>> 1) ^ -(n & 1);
}

// ─── Variable-length integer (LEB128) ────────────────────────────────────────

/**
 * Encode a non-negative integer using unsigned LEB128 variable-length encoding.
 *
 * Each output byte carries 7 bits of data; the MSB is set on all bytes except
 * the last.
 *
 * @param value - Non-negative integer to encode.
 * @returns `Uint8Array` of 1–10 bytes.
 */
export function variableIntEncode(value: number): Uint8Array {
  if (value < 0) throw new RangeError('variableIntEncode: value must be >= 0');
  const bytes: number[] = [];
  let remaining = value;
  do {
    let byte = remaining & 0x7f;
    remaining >>>= 7;
    if (remaining !== 0) {
      byte |= 0x80; // more bytes to follow
    }
    bytes.push(byte);
  } while (remaining !== 0);
  return new Uint8Array(bytes);
}

/**
 * Decode the first LEB128-encoded integer from a `Uint8Array`.
 *
 * @param bytes - Byte array containing one or more LEB128 sequences.
 * @returns `{ value, bytesRead }` where `bytesRead` is the number of bytes consumed.
 */
export function variableIntDecode(
  bytes: Uint8Array,
): { value: number; bytesRead: number } {
  let value = 0;
  let shift = 0;
  let i = 0;

  while (i < bytes.length) {
    const byte = bytes[i++];
    value |= (byte & 0x7f) << shift;
    shift += 7;
    if ((byte & 0x80) === 0) {
      return { value: value >>> 0, bytesRead: i };
    }
  }

  throw new RangeError('variableIntDecode: input truncated');
}

// ─── Sequential encoding ─────────────────────────────────────────────────────

/**
 * Sequential encode: subtract the minimum value from all elements, then
 * delta-encode the resulting offsets.
 *
 * Useful for monotonically increasing sequences (e.g. sorted timestamps)
 * where all values are positive and the range is much smaller than the
 * absolute magnitudes.
 *
 * @param values - Input number array.
 * @returns `{ min, deltas }` where `min` is the baseline and `deltas` is the
 *          delta-encoded array of `(value - min)` offsets.
 */
export function sequentialEncode(values: number[]): SequentialEncoded {
  if (values.length === 0) return { min: 0, deltas: [] };
  const min = Math.min(...values);
  const offsets = values.map((v) => v - min);
  const deltas = deltaEncode(offsets);
  return { min, deltas };
}

/**
 * Reconstruct the original array from a `sequentialEncode` result.
 *
 * @param encoded - `{ min, deltas }` produced by `sequentialEncode`.
 * @returns Original values.
 */
export function sequentialDecode(encoded: SequentialEncoded): number[] {
  if (encoded.deltas.length === 0) return [];
  const offsets = deltaDecode(encoded.deltas);
  return offsets.map((v) => v + encoded.min);
}
