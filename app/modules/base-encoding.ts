// @ts-check
// ─── Base Encoding ───────────────────────────────────────────────────────────
// Multiple base encoding schemes: Base32, Base58, Base85, and custom-alphabet.
// No browser APIs — pure algorithmic implementations.

// ─── Base32 (RFC 4648) ───────────────────────────────────────────────────────

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const BASE32_PADDING = '=';

/** Base32 encode (RFC 4648). */
export function base32Encode(data: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < data.length; i++) {
    value = (value << 8) | data[i];
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      output += BASE32_ALPHABET[(value >>> bits) & 0x1f];
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f];
  }

  // Pad to multiple of 8
  while (output.length % 8 !== 0) {
    output += BASE32_PADDING;
  }

  return output;
}

/** Base32 decode. */
export function base32Decode(str: string): Uint8Array {
  const upper = str.toUpperCase().replace(/=+$/, '');
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;

  for (let i = 0; i < upper.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(upper[i]);
    if (idx < 0) {
      throw new Error(`Invalid base32 character: ${upper[i]}`);
    }
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((value >>> bits) & 0xff);
    }
  }

  return new Uint8Array(bytes);
}

// ─── Base58 (Bitcoin alphabet) ───────────────────────────────────────────────

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/** Base58 encode (Bitcoin alphabet). */
export function base58Encode(data: Uint8Array): string {
  if (data.length === 0) return '';

  // Count leading zeros
  let leadingZeros = 0;
  for (let i = 0; i < data.length && data[i] === 0; i++) {
    leadingZeros++;
  }

  // Convert bytes to a big integer (as an array of digits in base 58)
  const digits: number[] = [0];
  for (let i = 0; i < data.length; i++) {
    let carry = data[i];
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] * 256;
      digits[j] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }

  // Build string: leading '1's for zero bytes, then significant digits in reverse
  let result = BASE58_ALPHABET[0].repeat(leadingZeros);
  // Skip leading zero digits (the value is already represented by leadingZeros)
  let i = digits.length - 1;
  while (i > 0 && digits[i] === 0) i--;
  // Only emit the significant part when there are non-zero bytes
  if (leadingZeros < data.length) {
    for (; i >= 0; i--) {
      result += BASE58_ALPHABET[digits[i]];
    }
  }

  return result;
}

/** Base58 decode. */
export function base58Decode(str: string): Uint8Array {
  if (str.length === 0) return new Uint8Array(0);

  // Count leading '1's (represent zero bytes)
  let leadingZeros = 0;
  for (let i = 0; i < str.length && str[i] === '1'; i++) {
    leadingZeros++;
  }

  // Convert base58 string to big integer as byte array
  const bytes: number[] = [0];
  for (let i = 0; i < str.length; i++) {
    const idx = BASE58_ALPHABET.indexOf(str[i]);
    if (idx < 0) {
      throw new Error(`Invalid base58 character: ${str[i]}`);
    }
    let carry = idx;
    for (let j = 0; j < bytes.length; j++) {
      carry += bytes[j] * 58;
      bytes[j] = carry & 0xff;
      carry >>>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>>= 8;
    }
  }

  // Remove trailing zeros (which are leading zeros after reversal)
  while (bytes.length > 1 && bytes[bytes.length - 1] === 0) {
    bytes.pop();
  }

  // If the entire value is zero (only leading '1's processed), no extra bytes
  const hasNonZeroValue = leadingZeros < str.length;

  // Build result: leading zero bytes, then reversed significant bytes
  const sigBytes = hasNonZeroValue ? bytes.length : 0;
  const result = new Uint8Array(leadingZeros + sigBytes);
  for (let i = 0; i < leadingZeros; i++) {
    result[i] = 0;
  }
  for (let i = 0; i < sigBytes; i++) {
    result[leadingZeros + i] = bytes[bytes.length - 1 - i];
  }

  return result;
}

// ─── Base85 / Ascii85 ────────────────────────────────────────────────────────

const BASE85_OFFSET = 33; // '!' character

/** Base85/Ascii85 encode. */
export function base85Encode(data: Uint8Array): string {
  let output = '';
  const len = data.length;

  for (let i = 0; i < len; i += 4) {
    // Assemble a 32-bit value from up to 4 bytes (pad with zeros)
    const remaining = Math.min(4, len - i);
    let value = 0;
    for (let j = 0; j < 4; j++) {
      value = value * 256 + (j < remaining ? data[i + j] : 0);
    }

    // Special case: all-zero group encodes as 'z'
    if (remaining === 4 && value === 0) {
      output += 'z';
      continue;
    }

    // Encode as 5 base-85 digits
    const chars: string[] = new Array(5);
    for (let j = 4; j >= 0; j--) {
      chars[j] = String.fromCharCode((value % 85) + BASE85_OFFSET);
      value = Math.floor(value / 85);
    }

    // For partial groups, only output (remaining + 1) chars
    output += chars.slice(0, remaining + 1).join('');
  }

  return output;
}

/** Base85/Ascii85 decode. */
export function base85Decode(str: string): Uint8Array {
  const bytes: number[] = [];
  let i = 0;

  while (i < str.length) {
    // Special 'z' abbreviation for all-zero group
    if (str[i] === 'z') {
      bytes.push(0, 0, 0, 0);
      i++;
      continue;
    }

    // Read up to 5 characters
    const groupLen = Math.min(5, str.length - i);
    let value = 0;

    for (let j = 0; j < 5; j++) {
      const ch = j < groupLen ? str.charCodeAt(i + j) - BASE85_OFFSET : 84;
      if (ch < 0 || ch > 84) {
        throw new Error(`Invalid base85 character: ${str[i + j]}`);
      }
      value = value * 85 + ch;
    }

    // Extract bytes; partial groups produce (groupLen - 1) bytes
    const outBytes = groupLen === 5 ? 4 : groupLen - 1;
    const extracted: number[] = new Array(4);
    for (let j = 3; j >= 0; j--) {
      extracted[j] = value & 0xff;
      value >>>= 8;
    }

    for (let j = 0; j < outBytes; j++) {
      bytes.push(extracted[j]);
    }

    i += groupLen;
  }

  return new Uint8Array(bytes);
}

// ─── Custom-alphabet base encoding ───────────────────────────────────────────

/** Encode a number in base N using a custom alphabet. */
export function encodeBase(value: number, alphabet: string): string {
  if (alphabet.length < 2) {
    throw new Error('Alphabet must have at least 2 characters');
  }
  if (!Number.isFinite(value) || value < 0 || !Number.isInteger(value)) {
    throw new Error('Value must be a non-negative integer');
  }
  if (value === 0) return alphabet[0];

  const base = alphabet.length;
  let result = '';
  let v = value;

  while (v > 0) {
    result = alphabet[v % base] + result;
    v = Math.floor(v / base);
  }

  return result;
}

/** Decode a number encoded in a custom alphabet. */
export function decodeBase(str: string, alphabet: string): number {
  if (alphabet.length < 2) {
    throw new Error('Alphabet must have at least 2 characters');
  }
  const base = alphabet.length;
  let value = 0;

  for (let i = 0; i < str.length; i++) {
    const idx = alphabet.indexOf(str[i]);
    if (idx < 0) {
      throw new Error(`Character '${str[i]}' not found in alphabet`);
    }
    value = value * base + idx;
  }

  return value;
}

// ─── Numeric base conversion (2–36) ──────────────────────────────────────────

const NUMERIC_DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz';

/**
 * Convert a non-negative integer `n` to its string representation in `base`.
 * Supports bases 2–36; digits above 9 use lower-case letters.
 */
export function toBase(n: number, base: number): string {
  if (!Number.isInteger(base) || base < 2 || base > 36) {
    throw new RangeError(`toBase: base must be an integer between 2 and 36, got ${base}`);
  }
  if (!Number.isInteger(n) || n < 0) {
    throw new RangeError(`toBase: n must be a non-negative integer, got ${n}`);
  }
  if (n === 0) return '0';

  let result = '';
  let remaining = n;
  while (remaining > 0) {
    result = NUMERIC_DIGITS[remaining % base] + result;
    remaining = Math.floor(remaining / base);
  }
  return result;
}

/**
 * Parse a string `s` in the given `base` (2–36) and return the decimal integer.
 */
export function fromBase(s: string, base: number): number {
  if (!Number.isInteger(base) || base < 2 || base > 36) {
    throw new RangeError(`fromBase: base must be an integer between 2 and 36, got ${base}`);
  }
  const lower = s.toLowerCase();
  let result = 0;
  for (const ch of lower) {
    const digit = NUMERIC_DIGITS.indexOf(ch);
    if (digit < 0 || digit >= base) {
      throw new RangeError(`fromBase: invalid digit '${ch}' for base ${base}`);
    }
    result = result * base + digit;
  }
  return result;
}

/** Convert a non-negative integer to its binary (base-2) string. */
export function toBinary(n: number): string {
  return toBase(n, 2);
}

/** Parse a binary string and return the corresponding integer. */
export function fromBinary(s: string): number {
  return fromBase(s, 2);
}

/** Convert a non-negative integer to its octal (base-8) string. */
export function toOctal(n: number): string {
  return toBase(n, 8);
}

/** Parse an octal string and return the corresponding integer. */
export function fromOctal(s: string): number {
  return fromBase(s, 8);
}

/** Convert a non-negative integer to its hexadecimal (base-16) lower-case string. */
export function toHex(n: number): string {
  return toBase(n, 16);
}

/** Parse a hexadecimal string (case-insensitive) and return the integer. */
export function fromHex(s: string): number {
  return fromBase(s, 16);
}

// ─── Varint encoding ─────────────────────────────────────────────────────────

/**
 * Encode a non-negative integer as a variable-length integer (varint) using
 * little-endian 7-bits-per-byte encoding (Protocol Buffer style).
 */
export function encodeVarint(n: number): Uint8Array {
  if (!Number.isInteger(n) || n < 0) {
    throw new RangeError(`encodeVarint: n must be a non-negative integer, got ${n}`);
  }
  const bytes: number[] = [];
  let remaining = n;
  do {
    let byte = remaining & 0x7f;
    remaining >>>= 7;
    if (remaining > 0) byte |= 0x80;
    bytes.push(byte);
  } while (remaining > 0);
  return new Uint8Array(bytes);
}

/**
 * Decode a varint from a `Uint8Array`.
 * Returns the decoded value and the number of bytes consumed.
 */
export function decodeVarint(bytes: Uint8Array): { value: number; bytesRead: number } {
  let value = 0;
  let shift = 0;
  let bytesRead = 0;

  for (const byte of bytes) {
    bytesRead++;
    value |= (byte & 0x7f) << shift;
    shift += 7;
    if ((byte & 0x80) === 0) break;
    if (shift >= 35) {
      throw new RangeError('decodeVarint: varint is too wide for a 32-bit integer');
    }
  }

  return { value: value >>> 0, bytesRead };
}

// ─── Zigzag encoding ─────────────────────────────────────────────────────────

/**
 * Map a signed integer to a non-negative integer using zigzag encoding:
 * 0 → 0, -1 → 1, 1 → 2, -2 → 3, 2 → 4, …
 */
export function zigzagEncode(n: number): number {
  return (n << 1) ^ (n >> 31);
}

/** Reverse the zigzag mapping: recover a signed integer from an unsigned one. */
export function zigzagDecode(n: number): number {
  return (n >>> 1) ^ -(n & 1);
}
