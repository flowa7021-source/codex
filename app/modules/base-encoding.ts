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
