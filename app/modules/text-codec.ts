// @ts-check
// ─── Text Codec ──────────────────────────────────────────────────────────────
// Text encoding/decoding utilities for various character encodings.

// ─── Public API ──────────────────────────────────────────────────────────────

/** Encode a string to UTF-8 Uint8Array. */
export function encodeUTF8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

/** Decode a UTF-8 Uint8Array to string. */
export function decodeUTF8(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes);
}

/** Encode a string to UTF-16LE Uint8Array. */
export function encodeUTF16LE(text: string): Uint8Array {
  const buffer = new ArrayBuffer(text.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < text.length; i++) {
    view.setUint16(i * 2, text.charCodeAt(i), true /* little-endian */);
  }
  return new Uint8Array(buffer);
}

/** Decode a UTF-16LE Uint8Array to string. */
export function decodeUTF16LE(bytes: Uint8Array): string {
  return new TextDecoder('utf-16le').decode(bytes);
}

/** Encode a string to Latin-1 (ISO-8859-1) Uint8Array. Non-Latin-1 chars become '?'. */
export function encodeLatin1(text: string): Uint8Array {
  const result = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    result[i] = code <= 0xff ? code : 0x3f /* '?' */;
  }
  return result;
}

/** Decode a Latin-1 Uint8Array to string. */
export function decodeLatin1(bytes: Uint8Array): string {
  return new TextDecoder('latin1').decode(bytes);
}

/** Detect probable encoding from BOM or byte patterns. Returns 'utf-8', 'utf-16le', 'utf-16be', or 'unknown'. */
export function detectEncoding(bytes: Uint8Array): 'utf-8' | 'utf-16le' | 'utf-16be' | 'unknown' {
  // Check for BOM sequences
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return 'utf-8';
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return 'utf-16le';
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return 'utf-16be';
  }
  return 'unknown';
}

/** Count characters (not bytes) in a UTF-8 encoded byte array. */
export function countChars(bytes: Uint8Array): number {
  const text = new TextDecoder('utf-8').decode(bytes);
  // Use spread to count actual Unicode code points (handles surrogate pairs)
  return [...text].length;
}
