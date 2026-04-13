// ─── Base58 Encoding / Decoding ───────────────────────────────────────────────
// @ts-check
// Standard Bitcoin Base58 codec with optional checksum variants.
// No external crypto dependency — checksum uses a CRC-32 substitute.

// ─── Alphabet ────────────────────────────────────────────────────────────────

/** The 58-character Bitcoin Base58 alphabet (no 0, O, I, l). */
export const ALPHABET: string =
  '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/** Lookup table: char code → Base58 digit (−1 for invalid). */
const DECODE_MAP: Int8Array = (() => {
  const map = new Int8Array(128).fill(-1);
  for (let i = 0; i < ALPHABET.length; i++) {
    map[ALPHABET.charCodeAt(i)] = i;
  }
  return map;
})();

// ─── Core encode / decode ─────────────────────────────────────────────────────

/**
 * Encode a byte array to a Base58 string.
 * Leading zero bytes become leading '1' characters.
 *
 * @param bytes - Raw bytes to encode (Uint8Array or plain number array)
 * @returns Base58-encoded string
 */
export function encode(bytes: Uint8Array | number[]): string {
  const input = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);

  // Count leading zero bytes.
  let leadingZeros = 0;
  while (leadingZeros < input.length && input[leadingZeros] === 0) {
    leadingZeros++;
  }

  // Encode the integer (big-endian) in base 58.
  // Working buffer — worst-case length is ceil(len * log(256) / log(58)).
  const size = Math.ceil(input.length * 1.3696) + 1;
  const digits = new Uint8Array(size);
  let length = 0;

  for (let i = leadingZeros; i < input.length; i++) {
    let carry = input[i];
    let j = 0;
    for (let k = size - 1; (carry !== 0 || j < length); k--, j++) {
      carry += 256 * digits[k];
      digits[k] = carry % 58;
      carry = (carry / 58) | 0;
    }
    length = j;
  }

  // Find start of result in digits buffer (skip leading zeros of the buffer).
  let start = size - length;
  while (start < size && digits[start] === 0) {
    start++;
  }

  // Build output string: leading '1's + encoded digits.
  let result = '1'.repeat(leadingZeros);
  for (let i = start; i < size; i++) {
    result += ALPHABET[digits[i]];
  }
  return result;
}

/**
 * Decode a Base58 string to a Uint8Array.
 * Leading '1' characters become leading zero bytes.
 *
 * @param str - Base58-encoded string
 * @returns Decoded bytes
 * @throws {Error} If the string contains any character not in the alphabet
 */
export function decode(str: string): Uint8Array {
  if (str.length === 0) return new Uint8Array(0);

  // Validate all characters and build digit stream.
  const digits58: number[] = [];
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    const digit = code < 128 ? DECODE_MAP[code] : -1;
    if (digit === -1) {
      throw new Error(`Invalid Base58 character: '${str[i]}' at index ${i}`);
    }
    digits58.push(digit);
  }

  // Count leading '1's.
  let leadingZeros = 0;
  while (leadingZeros < digits58.length && digits58[leadingZeros] === 0) {
    leadingZeros++;
  }

  // Decode the base-58 integer into bytes (big-endian).
  const size = Math.ceil(str.length * 0.7321) + 1;
  const bytes = new Uint8Array(size);
  let length = 0;

  for (let i = leadingZeros; i < digits58.length; i++) {
    let carry = digits58[i];
    let j = 0;
    for (let k = size - 1; (carry !== 0 || j < length); k--, j++) {
      carry += 58 * bytes[k];
      bytes[k] = carry & 0xff;
      carry >>= 8;
    }
    length = j;
  }

  // Find start of result bytes.
  let start = size - length;
  while (start < size && bytes[start] === 0) {
    start++;
  }

  // Prepend leading zero bytes.
  const result = new Uint8Array(leadingZeros + (size - start));
  result.fill(0, 0, leadingZeros);
  result.set(bytes.subarray(start), leadingZeros);
  return result;
}

// ─── Checksum helpers ─────────────────────────────────────────────────────────

/**
 * Compute a 4-byte CRC-32 checksum over `data`.
 * Uses the standard IEEE 802.3 polynomial (0xEDB88320).
 * This is a pure JS CRC-32 — no external crypto dependency.
 *
 * @param data - Input bytes
 * @returns 4-byte checksum as a Uint8Array (big-endian)
 */
function crc32Checksum(data: Uint8Array): Uint8Array {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let bit = 0; bit < 8; bit++) {
      if (crc & 1) {
        crc = (crc >>> 1) ^ 0xedb88320;
      } else {
        crc >>>= 1;
      }
    }
  }
  crc ^= 0xffffffff;
  // Return as 4 big-endian bytes.
  return new Uint8Array([
    (crc >>> 24) & 0xff,
    (crc >>> 16) & 0xff,
    (crc >>> 8) & 0xff,
    crc & 0xff,
  ]);
}

// ─── Checksum encode / decode ─────────────────────────────────────────────────

/**
 * Encode bytes with a 4-byte CRC-32 checksum appended.
 * The checksum is computed over the original bytes and the 4-byte suffix
 * is included before Base58 encoding.
 *
 * @param bytes - Raw bytes to encode (Uint8Array or plain number array)
 * @returns Base58Check-encoded string
 */
export function encodeCheck(bytes: Uint8Array | number[]): string {
  const input = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const checksum = crc32Checksum(input);
  const payload = new Uint8Array(input.length + 4);
  payload.set(input, 0);
  payload.set(checksum, input.length);
  return encode(payload);
}

/**
 * Decode a Base58Check string and verify the 4-byte checksum.
 * Returns the original bytes without the checksum suffix.
 *
 * @param str - Base58Check-encoded string
 * @returns Decoded bytes (without the 4-byte checksum)
 * @throws {Error} If the string contains invalid Base58 characters
 * @throws {Error} If the checksum does not match
 */
export function decodeCheck(str: string): Uint8Array {
  const payload = decode(str);
  if (payload.length < 4) {
    throw new Error('Base58Check decode: payload too short to contain checksum');
  }
  const data = payload.subarray(0, payload.length - 4);
  const storedChecksum = payload.subarray(payload.length - 4);
  const expectedChecksum = crc32Checksum(data);

  for (let i = 0; i < 4; i++) {
    if (storedChecksum[i] !== expectedChecksum[i]) {
      throw new Error('Base58Check decode: checksum mismatch');
    }
  }
  return data;
}

// ─── String helpers ───────────────────────────────────────────────────────────

/**
 * Encode a UTF-8 string as Base58.
 *
 * @param str - UTF-8 string to encode
 * @returns Base58-encoded string
 */
export function encodeString(str: string): string {
  const encoded = new TextEncoder().encode(str);
  return encode(encoded);
}

/**
 * Decode a Base58 string to a UTF-8 string.
 *
 * @param b58 - Base58-encoded string
 * @returns Decoded UTF-8 string
 * @throws {Error} If the string contains invalid Base58 characters
 */
export function decodeString(b58: string): string {
  const bytes = decode(b58);
  return new TextDecoder().decode(bytes);
}
