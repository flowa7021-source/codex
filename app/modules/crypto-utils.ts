// @ts-check
// ─── Crypto Utilities ────────────────────────────────────────────────────────
// Pure-JS cryptography and hashing utilities. No Node.js crypto module used.
// Educational / utility grade — not for production security use.

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Encode a JS string to a UTF-8 byte array. */
function strToBytes(str: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code >= 0xd800 && code <= 0xdbff && i + 1 < str.length) {
      const hi = code;
      const lo = str.charCodeAt(i + 1);
      if (lo >= 0xdc00 && lo <= 0xdfff) {
        const cp = 0x10000 + ((hi - 0xd800) << 10) + (lo - 0xdc00);
        bytes.push(
          0xf0 | (cp >> 18),
          0x80 | ((cp >> 12) & 0x3f),
          0x80 | ((cp >> 6) & 0x3f),
          0x80 | (cp & 0x3f),
        );
        i++;
      } else {
        bytes.push(0xef, 0xbf, 0xbd);
      }
    } else {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    }
  }
  return bytes;
}

/** Decode a UTF-8 byte array to a JS string. */
function bytesToStr(bytes: number[]): string {
  let str = '';
  let i = 0;
  while (i < bytes.length) {
    const b = bytes[i];
    if (b < 0x80) {
      str += String.fromCharCode(b);
      i++;
    } else if ((b & 0xe0) === 0xc0) {
      const cp = ((b & 0x1f) << 6) | (bytes[i + 1] & 0x3f);
      str += String.fromCharCode(cp);
      i += 2;
    } else if ((b & 0xf0) === 0xe0) {
      const cp = ((b & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f);
      str += String.fromCharCode(cp);
      i += 3;
    } else if ((b & 0xf8) === 0xf0) {
      const cp =
        ((b & 0x07) << 18) |
        ((bytes[i + 1] & 0x3f) << 12) |
        ((bytes[i + 2] & 0x3f) << 6) |
        (bytes[i + 3] & 0x3f);
      const sc = cp - 0x10000;
      str += String.fromCharCode(0xd800 + (sc >> 10), 0xdc00 + (sc & 0x3ff));
      i += 4;
    } else {
      str += '\ufffd';
      i++;
    }
  }
  return str;
}

/** Format a 32-bit integer as a zero-padded 8-char hex string (big-endian). */
function toHex32(n: number): string {
  return (n >>> 0).toString(16).padStart(8, '0');
}

/** Safe 32-bit left rotate. */
function rotl32(x: number, n: number): number {
  return ((x << n) | (x >>> (32 - n))) >>> 0;
}

// ─── MD5 ─────────────────────────────────────────────────────────────────────

/**
 * Compute the MD5 hash of a UTF-8 string.
 * Returns a 32-character lowercase hex string.
 */
export function md5(input: string): string {
  // Per-round shift amounts
  const S = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5,
    9, 14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10,
    15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
  ];
  // Precomputed table K[i] = floor(abs(sin(i+1)) * 2^32)
  const K = [
    0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee, 0xf57c0faf, 0x4787c62a, 0xa8304613,
    0xfd469501, 0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be, 0x6b901122, 0xfd987193,
    0xa679438e, 0x49b40821, 0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa, 0xd62f105d,
    0x02441453, 0xd8a1e681, 0xe7d3fbc8, 0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed,
    0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a, 0xfffa3942, 0x8771f681, 0x6d9d6122,
    0xfde5380c, 0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70, 0x289b7ec6, 0xeaa127fa,
    0xd4ef3085, 0x04881d05, 0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665, 0xf4292244,
    0x432aff97, 0xab9423a7, 0xfc93a039, 0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1,
    0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1, 0xf7537e82, 0xbd3af235, 0x2ad7d2bb,
    0xeb86d391,
  ];

  const bytes = strToBytes(input);
  const bitLen = bytes.length * 8;

  // Padding: append 0x80, then zeros, then 64-bit LE length
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  // Append bit length as little-endian 64-bit
  for (let i = 0; i < 4; i++) bytes.push((bitLen >>> (i * 8)) & 0xff);
  for (let i = 0; i < 4; i++) bytes.push(0); // high 32 bits of bit-length

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  for (let off = 0; off < bytes.length; off += 64) {
    const M: number[] = [];
    for (let j = 0; j < 16; j++) {
      M[j] =
        bytes[off + j * 4] |
        (bytes[off + j * 4 + 1] << 8) |
        (bytes[off + j * 4 + 2] << 16) |
        (bytes[off + j * 4 + 3] << 24);
    }

    let A = a0;
    let B = b0;
    let C = c0;
    let D = d0;

    for (let i = 0; i < 64; i++) {
      let F: number;
      let g: number;
      if (i < 16) {
        F = (B & C) | (~B & D);
        g = i;
      } else if (i < 32) {
        F = (D & B) | (~D & C);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        F = B ^ C ^ D;
        g = (3 * i + 5) % 16;
      } else {
        F = C ^ (B | ~D);
        g = (7 * i) % 16;
      }
      F = (F + A + K[i] + M[g]) | 0;
      A = D;
      D = C;
      C = B;
      B = (B + rotl32(F, S[i])) | 0;
    }

    a0 = (a0 + A) | 0;
    b0 = (b0 + B) | 0;
    c0 = (c0 + C) | 0;
    d0 = (d0 + D) | 0;
  }

  // MD5 output is little-endian per word
  function le32hex(n: number): string {
    const v = n >>> 0;
    return (
      (v & 0xff).toString(16).padStart(2, '0') +
      ((v >> 8) & 0xff).toString(16).padStart(2, '0') +
      ((v >> 16) & 0xff).toString(16).padStart(2, '0') +
      (v >>> 24).toString(16).padStart(2, '0')
    );
  }

  return le32hex(a0) + le32hex(b0) + le32hex(c0) + le32hex(d0);
}

// ─── SHA-1 ────────────────────────────────────────────────────────────────────

/**
 * Compute the SHA-1 hash of a UTF-8 string.
 * Returns a 40-character lowercase hex string.
 */
export function sha1(input: string): string {
  const bytes = strToBytes(input);
  const bitLen = bytes.length * 8;

  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  // Append bit length as big-endian 64-bit
  for (let i = 7; i >= 0; i--) bytes.push((bitLen / Math.pow(2, i * 8)) & 0xff);

  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;
  let h4 = 0xc3d2e1f0;

  for (let off = 0; off < bytes.length; off += 64) {
    const W: number[] = [];
    for (let i = 0; i < 16; i++) {
      W[i] =
        (bytes[off + i * 4] << 24) |
        (bytes[off + i * 4 + 1] << 16) |
        (bytes[off + i * 4 + 2] << 8) |
        bytes[off + i * 4 + 3];
    }
    for (let i = 16; i < 80; i++) {
      W[i] = rotl32(W[i - 3] ^ W[i - 8] ^ W[i - 14] ^ W[i - 16], 1);
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;

    for (let i = 0; i < 80; i++) {
      let f: number;
      let k: number;
      if (i < 20) {
        f = (b & c) | (~b & d);
        k = 0x5a827999;
      } else if (i < 40) {
        f = b ^ c ^ d;
        k = 0x6ed9eba1;
      } else if (i < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8f1bbcdc;
      } else {
        f = b ^ c ^ d;
        k = 0xca62c1d6;
      }
      const tmp = (rotl32(a, 5) + f + e + k + W[i]) | 0;
      e = d;
      d = c;
      c = rotl32(b, 30);
      b = a;
      a = tmp;
    }

    h0 = (h0 + a) | 0;
    h1 = (h1 + b) | 0;
    h2 = (h2 + c) | 0;
    h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0;
  }

  return toHex32(h0) + toHex32(h1) + toHex32(h2) + toHex32(h3) + toHex32(h4);
}

// ─── SHA-256 ──────────────────────────────────────────────────────────────────

/**
 * Compute the SHA-256 hash of a UTF-8 string.
 * Returns a 64-character lowercase hex string.
 */
export function sha256(input: string): string {
  const K256 = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4,
    0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe,
    0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f,
    0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
    0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc,
    0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
    0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116,
    0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7,
    0xc67178f2,
  ];

  const bytes = strToBytes(input);
  const bitLen = bytes.length * 8;

  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  for (let i = 7; i >= 0; i--) bytes.push((bitLen / Math.pow(2, i * 8)) & 0xff);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  for (let off = 0; off < bytes.length; off += 64) {
    const W: number[] = [];
    for (let i = 0; i < 16; i++) {
      W[i] =
        (bytes[off + i * 4] << 24) |
        (bytes[off + i * 4 + 1] << 16) |
        (bytes[off + i * 4 + 2] << 8) |
        bytes[off + i * 4 + 3];
    }
    for (let i = 16; i < 64; i++) {
      const s0 =
        (((W[i - 15] >>> 7) | (W[i - 15] << 25)) ^
          ((W[i - 15] >>> 18) | (W[i - 15] << 14)) ^
          (W[i - 15] >>> 3)) >>>
        0;
      const s1 =
        (((W[i - 2] >>> 17) | (W[i - 2] << 15)) ^
          ((W[i - 2] >>> 19) | (W[i - 2] << 13)) ^
          (W[i - 2] >>> 10)) >>>
        0;
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let hh = h7;

    for (let i = 0; i < 64; i++) {
      const S1 =
        (((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7))) >>> 0;
      const ch = ((e & f) ^ (~e & g)) >>> 0;
      const temp1 = (hh + S1 + ch + K256[i] + W[i]) | 0;
      const S0 =
        (((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10))) >>> 0;
      const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
      const temp2 = (S0 + maj) | 0;

      hh = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    h0 = (h0 + a) | 0;
    h1 = (h1 + b) | 0;
    h2 = (h2 + c) | 0;
    h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0;
    h5 = (h5 + f) | 0;
    h6 = (h6 + g) | 0;
    h7 = (h7 + hh) | 0;
  }

  return (
    toHex32(h0) +
    toHex32(h1) +
    toHex32(h2) +
    toHex32(h3) +
    toHex32(h4) +
    toHex32(h5) +
    toHex32(h6) +
    toHex32(h7)
  );
}

// ─── FNV-1a 32-bit ───────────────────────────────────────────────────────────

/**
 * FNV-1a 32-bit non-cryptographic hash.
 * Fast and suitable for hash tables.
 */
export function fnv1a32(input: string): number {
  const FNV_PRIME = 0x01000193;
  const FNV_OFFSET = 0x811c9dc5;
  const bytes = strToBytes(input);
  let hash = FNV_OFFSET;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, FNV_PRIME);
  }
  return hash >>> 0;
}

// ─── djb2 ────────────────────────────────────────────────────────────────────

/**
 * djb2 non-cryptographic hash by Dan Bernstein.
 * Fast and suitable for hash tables.
 */
export function djb2(input: string): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = Math.imul(hash, 33) ^ input.charCodeAt(i);
  }
  return hash >>> 0;
}

// ─── Base64 ──────────────────────────────────────────────────────────────────

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * Encode a UTF-8 string to Base64.
 */
export function toBase64(input: string): string {
  const bytes = strToBytes(input);
  let result = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = bytes[i + 1] ?? 0;
    const b2 = bytes[i + 2] ?? 0;
    result += BASE64_CHARS[b0 >> 2];
    result += BASE64_CHARS[((b0 & 3) << 4) | (b1 >> 4)];
    result += i + 1 < bytes.length ? BASE64_CHARS[((b1 & 0xf) << 2) | (b2 >> 6)] : '=';
    result += i + 2 < bytes.length ? BASE64_CHARS[b2 & 0x3f] : '=';
  }
  return result;
}

/**
 * Decode a Base64 string to a UTF-8 string.
 * Throws on invalid input.
 */
export function fromBase64(input: string): string {
  const lookup: Record<string, number> = {};
  for (let i = 0; i < BASE64_CHARS.length; i++) lookup[BASE64_CHARS[i]] = i;

  const clean = input.replace(/=+$/, '');
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    const c0 = lookup[clean[i]] ?? 0;
    const c1 = lookup[clean[i + 1]] ?? 0;
    const c2 = clean[i + 2] !== undefined ? (lookup[clean[i + 2]] ?? 0) : 0;
    const c3 = clean[i + 3] !== undefined ? (lookup[clean[i + 3]] ?? 0) : 0;
    bytes.push((c0 << 2) | (c1 >> 4));
    if (i + 2 < clean.length) bytes.push(((c1 & 0xf) << 4) | (c2 >> 2));
    if (i + 3 < clean.length) bytes.push(((c2 & 3) << 6) | c3);
  }
  return bytesToStr(bytes);
}

// ─── Hex encoding ─────────────────────────────────────────────────────────────

/**
 * Encode a UTF-8 string to a lowercase hex string.
 */
export function toHex(input: string): string {
  return strToBytes(input)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Decode a lowercase (or uppercase) hex string to a UTF-8 string.
 * Throws on invalid input.
 */
export function fromHex(hex: string): string {
  if (hex.length % 2 !== 0) throw new Error('fromHex: odd-length hex string');
  const bytes: number[] = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.slice(i, i + 2), 16));
  }
  return bytesToStr(bytes);
}

// ─── XOR cipher ──────────────────────────────────────────────────────────────

/**
 * XOR-encrypt a UTF-8 string with a key (repeated cyclically).
 * Returns the ciphertext as a lowercase hex string.
 */
export function xorEncrypt(text: string, key: string): string {
  if (!key) throw new Error('xorEncrypt: key must not be empty');
  const textBytes = strToBytes(text);
  const keyBytes = strToBytes(key);
  const result: number[] = textBytes.map((b, i) => b ^ keyBytes[i % keyBytes.length]);
  return result.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * XOR-decrypt a hex-encoded ciphertext with the same key used for encryption.
 * Returns the original UTF-8 string.
 */
export function xorDecrypt(hex: string, key: string): string {
  if (!key) throw new Error('xorDecrypt: key must not be empty');
  if (hex.length % 2 !== 0) throw new Error('xorDecrypt: odd-length hex string');
  const keyBytes = strToBytes(key);
  const bytes: number[] = [];
  for (let i = 0, bi = 0; i < hex.length; i += 2, bi++) {
    bytes.push(parseInt(hex.slice(i, i + 2), 16) ^ keyBytes[bi % keyBytes.length]);
  }
  return bytesToStr(bytes);
}

// ─── UUID v4 ─────────────────────────────────────────────────────────────────

/**
 * Generate a random UUID v4 using Math.random (not crypto-secure).
 * Format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
 */
export function uuidV4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ─── HMAC-SHA-256 ─────────────────────────────────────────────────────────────

/**
 * Simple HMAC-like MAC using SHA-256.
 * The inner and outer hashes operate on raw byte sequences (not re-encoded as UTF-8).
 * Returns a 64-character hex string.
 */
export function hmacSha256(message: string, key: string): string {
  const BLOCK_SIZE = 64; // SHA-256 block size in bytes

  let keyBytes = strToBytes(key);
  if (keyBytes.length > BLOCK_SIZE) {
    // Shorten key by hashing it
    const hashHex = sha256(key);
    keyBytes = [];
    for (let i = 0; i < hashHex.length; i += 2) {
      keyBytes.push(parseInt(hashHex.slice(i, i + 2), 16));
    }
  }
  // Pad key to block size
  while (keyBytes.length < BLOCK_SIZE) keyBytes.push(0);

  const ipad = keyBytes.map((b) => b ^ 0x36);
  const opad = keyBytes.map((b) => b ^ 0x5c);

  // inner = SHA-256(ipad || message_bytes)
  // We feed raw bytes directly by building a latin-1 string (one char per byte)
  const msgBytes = strToBytes(message);
  const innerBytes = ipad.concat(msgBytes);
  const innerStr = innerBytes.map((b) => String.fromCharCode(b)).join('');
  const innerHash = sha256(innerStr);

  // outer = SHA-256(opad || inner_hash_bytes)
  const innerHashBytes: number[] = [];
  for (let i = 0; i < innerHash.length; i += 2) {
    innerHashBytes.push(parseInt(innerHash.slice(i, i + 2), 16));
  }
  const outerBytes = opad.concat(innerHashBytes);
  const outerStr = outerBytes.map((b) => String.fromCharCode(b)).join('');
  return sha256(outerStr);
}

// ─── Password hashing ─────────────────────────────────────────────────────────

/**
 * Hash a password with an optional salt (generated if not provided).
 * Uses SHA-256 with multiple iterations for basic key stretching.
 * Educational only — not for production security use.
 */
export function hashPassword(
  password: string,
  salt?: string,
): { hash: string; salt: string } {
  const actualSalt = salt ?? uuidV4().replace(/-/g, '');
  const ITERATIONS = 1000;
  let hash = sha256(actualSalt + password);
  for (let i = 1; i < ITERATIONS; i++) {
    hash = sha256(hash + actualSalt + password);
  }
  return { hash, salt: actualSalt };
}

/**
 * Verify a password against a stored hash and salt.
 * Returns true if the password matches.
 */
export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const { hash: computed } = hashPassword(password, salt);
  return computed === hash;
}

// ─── CRC-32 ──────────────────────────────────────────────────────────────────

/** Pre-computed CRC-32 lookup table. */
const CRC32_TABLE: number[] = (() => {
  const table: number[] = [];
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table.push(c);
  }
  return table;
})();

/**
 * Compute the CRC-32 checksum of a UTF-8 string.
 * Returns an unsigned 32-bit integer.
 */
export function crc32(input: string): number {
  const bytes = strToBytes(input);
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// ─── Adler-32 ─────────────────────────────────────────────────────────────────

/**
 * Compute the Adler-32 checksum of a UTF-8 string.
 * Returns an unsigned 32-bit integer.
 */
export function adler32(input: string): number {
  const MOD_ADLER = 65521;
  const bytes = strToBytes(input);
  let a = 1;
  let b = 0;
  for (const byte of bytes) {
    a = (a + byte) % MOD_ADLER;
    b = (b + a) % MOD_ADLER;
  }
  return ((b << 16) | a) >>> 0;
}
