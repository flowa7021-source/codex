// ─── CRC Checksums ───────────────────────────────────────────────────────────
// @ts-check
// Cyclic Redundancy Check (CRC) implementations using pre-computed lookup
// tables for efficiency.  Covers CRC-8, CRC-16/CCITT, and CRC-32/IEEE 802.3.

// ─── CRC-8 Table (polynomial 0x07, CRC-8/SMBUS) ─────────────────────────────

const CRC8_TABLE: Uint8Array = ((): Uint8Array => {
  const table = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    let crc = i;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc & 0x80) ? ((crc << 1) ^ 0x07) & 0xff : (crc << 1) & 0xff;
    }
    table[i] = crc;
  }
  return table;
})();

// ─── CRC-16/CCITT Table (polynomial 0x1021, init 0xFFFF) ────────────────────

const CRC16_TABLE: Uint16Array = ((): Uint16Array => {
  const table = new Uint16Array(256);
  for (let i = 0; i < 256; i++) {
    let crc = i << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
    table[i] = crc;
  }
  return table;
})();

// ─── CRC-32 Table (polynomial 0xEDB88320, IEEE 802.3 reflected) ─────────────

const CRC32_TABLE: Uint32Array = ((): Uint32Array => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let crc = i;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc & 1) ? ((crc >>> 1) ^ 0xedb88320) : (crc >>> 1);
    }
    table[i] = crc >>> 0;
  }
  return table;
})();

// ─── CRC-8 ───────────────────────────────────────────────────────────────────

/**
 * Compute CRC-8 (polynomial 0x07, CRC-8/SMBUS) of the given data.
 * Returns 0 for an empty input.
 *
 * @param data - Input bytes
 */
export function crc8(data: Uint8Array | number[]): number {
  let crc = 0;
  for (let i = 0; i < data.length; i++) {
    crc = CRC8_TABLE[(crc ^ (data[i] & 0xff)) & 0xff];
  }
  return crc;
}

// ─── CRC-16/CCITT ─────────────────────────────────────────────────────────────

/**
 * Compute CRC-16/CCITT (polynomial 0x1021, initial value 0xFFFF) of the given
 * data.  Returns 0xFFFF for an empty input (the initial register value).
 *
 * @param data - Input bytes
 */
export function crc16(data: Uint8Array | number[]): number {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc = ((crc << 8) ^ CRC16_TABLE[((crc >>> 8) ^ (data[i] & 0xff)) & 0xff]) & 0xffff;
  }
  return crc;
}

// ─── CRC-32/IEEE 802.3 ───────────────────────────────────────────────────────

/**
 * Compute CRC-32 (IEEE 802.3, polynomial 0xEDB88320 reflected) of the given
 * data.  Returns 0 for an empty input after the final XOR with 0xFFFFFFFF.
 *
 * @param data - Input bytes
 */
export function crc32(data: Uint8Array | number[]): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = (CRC32_TABLE[(crc ^ (data[i] & 0xff)) & 0xff] ^ (crc >>> 8)) >>> 0;
  }
  return ((crc ^ 0xffffffff) >>> 0);
}

/**
 * Compute CRC-32 of a UTF-8 encoded string.
 *
 * @param str - Input string (encoded to UTF-8 before hashing)
 */
export function crc32String(str: string): number {
  const bytes = new TextEncoder().encode(str);
  return crc32(bytes);
}

/**
 * Verify that the CRC-32 of `data` matches `expected`.
 * Returns true when the checksums are equal.
 *
 * @param data     - Input bytes
 * @param expected - Expected CRC-32 value
 */
export function verifyCrc32(data: Uint8Array | number[], expected: number): boolean {
  return crc32(data) === expected;
}

/**
 * Build and return the 256-entry CRC-32 lookup table (IEEE 802.3).
 * The table is pre-computed on module load; this function returns a copy.
 */
export function buildCrc32Table(): Uint32Array {
  return CRC32_TABLE.slice();
}
