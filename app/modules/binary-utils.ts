// @ts-check
// ─── Binary Utilities ─────────────────────────────────────────────────────────
// Low-level binary data manipulation helpers using DataView and typed arrays.

// ─── Public API ───────────────────────────────────────────────────────────────

/** Create a DataView over a Uint8Array (shares the same buffer and byte offset). */
export function dataView(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

/** Read a little-endian uint32 from bytes at offset. */
export function readUint32LE(bytes: Uint8Array, offset: number): number {
  return dataView(bytes).getUint32(offset, true);
}

/** Write a little-endian uint32 into bytes at offset. */
export function writeUint32LE(bytes: Uint8Array, offset: number, value: number): void {
  dataView(bytes).setUint32(offset, value, true);
}

/** Read a big-endian uint32 from bytes at offset. */
export function readUint32BE(bytes: Uint8Array, offset: number): number {
  return dataView(bytes).getUint32(offset, false);
}

/** Write a big-endian uint32 into bytes at offset. */
export function writeUint32BE(bytes: Uint8Array, offset: number, value: number): void {
  dataView(bytes).setUint32(offset, value, false);
}

/** Read a little-endian uint16 from bytes at offset. */
export function readUint16LE(bytes: Uint8Array, offset: number): number {
  return dataView(bytes).getUint16(offset, true);
}

/** Write a little-endian uint16 into bytes at offset. */
export function writeUint16LE(bytes: Uint8Array, offset: number, value: number): void {
  dataView(bytes).setUint16(offset, value, true);
}

/** Read a little-endian float32 from bytes at offset. */
export function readFloat32LE(bytes: Uint8Array, offset: number): number {
  return dataView(bytes).getFloat32(offset, true);
}

/** Write a little-endian float32 into bytes at offset. */
export function writeFloat32LE(bytes: Uint8Array, offset: number, value: number): void {
  dataView(bytes).setFloat32(offset, value, true);
}

/** Check if the current JavaScript engine uses little-endian byte order. */
export function isLittleEndian(): boolean {
  const buf = new ArrayBuffer(2);
  new DataView(buf).setUint16(0, 0x0102, true);
  return new Uint8Array(buf)[0] === 0x02;
}

/**
 * Reverse the byte order of `length` bytes in-place starting at `offset`.
 * Useful for converting between big-endian and little-endian representations.
 */
export function swapBytes(bytes: Uint8Array, offset: number, length: number): void {
  let lo = offset;
  let hi = offset + length - 1;
  while (lo < hi) {
    const tmp = bytes[lo];
    bytes[lo] = bytes[hi];
    bytes[hi] = tmp;
    lo++;
    hi--;
  }
}

/** Fill a range of bytes with `value` (defaults to the full array). */
export function fillBytes(
  bytes: Uint8Array,
  value: number,
  start = 0,
  end = bytes.length,
): void {
  bytes.fill(value, start, end);
}

/**
 * Find the first occurrence of `needle` in `haystack`.
 * Returns the byte offset, or -1 if not found.
 */
export function findBytes(haystack: Uint8Array, needle: Uint8Array): number {
  if (needle.length === 0) return 0;
  if (needle.length > haystack.length) return -1;
  outer: for (let i = 0; i <= haystack.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}

/**
 * XOR two Uint8Arrays element-wise.
 * The result length equals the shorter of the two inputs.
 */
export function xorBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  const len = Math.min(a.length, b.length);
  const result = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    result[i] = a[i] ^ b[i];
  }
  return result;
}
