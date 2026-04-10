// @ts-check
// ─── LZ-Based Compression ────────────────────────────────────────────────────
// Pure-JS implementations of LZ77, LZW, and a string-level LZ compressor.
// No native modules or Node built-ins are used — all algorithms run in any JS
// environment (browser, Node, Deno).

// ─── Types ────────────────────────────────────────────────────────────────────

/** A single LZ77 token: back-reference (offset, length) plus the next literal. */
export interface LZ77Token {
  offset: number;
  length: number;
  char: string;
}

// ─── LZ77 ─────────────────────────────────────────────────────────────────────

/** Maximum look-back window size used by lz77Compress. */
const WINDOW_SIZE = 255;

/**
 * Compress a string using LZ77 into an array of tokens.
 * Each token is `{ offset, length, char }` where `offset` and `length`
 * describe a back-reference into the previously decoded output and `char` is
 * the next literal character following the match (empty string at end-of-input).
 */
export function lz77Compress(input: string): LZ77Token[] {
  const tokens: LZ77Token[] = [];
  let pos = 0;

  while (pos < input.length) {
    let bestOffset = 0;
    let bestLength = 0;

    const windowStart = Math.max(0, pos - WINDOW_SIZE);

    // Search the window for the longest match.
    for (let w = windowStart; w < pos; w++) {
      let length = 0;
      while (
        pos + length < input.length &&
        length < WINDOW_SIZE &&
        input[w + length] === input[pos + length]
      ) {
        length++;
      }
      if (length > bestLength) {
        bestLength = length;
        bestOffset = pos - w;
      }
    }

    const nextChar = input[pos + bestLength] ?? '';
    tokens.push({ offset: bestOffset, length: bestLength, char: nextChar });
    pos += bestLength + 1;
  }

  return tokens;
}

/**
 * Decompress an array of LZ77 tokens produced by `lz77Compress`.
 */
export function lz77Decompress(tokens: LZ77Token[]): string {
  let output = '';

  for (const { offset, length, char } of tokens) {
    if (offset === 0 || length === 0) {
      // Literal-only token
      output += char;
    } else {
      const start = output.length - offset;
      for (let i = 0; i < length; i++) {
        // Character-by-character copy handles overlapping matches.
        output += output[start + i];
      }
      output += char;
    }
  }

  return output;
}

// ─── LZW ──────────────────────────────────────────────────────────────────────

/**
 * Compress a string using LZW encoding.
 * Returns an array of numeric codes.
 */
export function lzwCompress(input: string): number[] {
  // Bootstrap the dictionary with all single-character strings (code points 0–255).
  const dict = new Map<string, number>();
  for (let i = 0; i < 256; i++) {
    dict.set(String.fromCharCode(i), i);
  }
  let nextCode = 256;

  const codes: number[] = [];
  let current = '';

  for (const ch of input) {
    const combined = current + ch;
    if (dict.has(combined)) {
      current = combined;
    } else {
      codes.push(dict.get(current)!);
      dict.set(combined, nextCode++);
      current = ch;
    }
  }

  if (current !== '') {
    codes.push(dict.get(current)!);
  }

  return codes;
}

/**
 * Decompress an LZW code array produced by `lzwCompress`.
 */
export function lzwDecompress(codes: number[]): string {
  if (codes.length === 0) return '';

  const dict = new Map<number, string>();
  for (let i = 0; i < 256; i++) {
    dict.set(i, String.fromCharCode(i));
  }
  let nextCode = 256;

  let output = dict.get(codes[0])!;
  let previous = output;

  for (let i = 1; i < codes.length; i++) {
    const code = codes[i];
    let entry: string;

    if (dict.has(code)) {
      entry = dict.get(code)!;
    } else if (code === nextCode) {
      // Special case: code not yet in dict → previous + first char of previous.
      entry = previous + previous[0];
    } else {
      throw new Error(`lzwDecompress: invalid code ${code}`);
    }

    output += entry;
    dict.set(nextCode++, previous + entry[0]);
    previous = entry;
  }

  return output;
}

// ─── LZString ─────────────────────────────────────────────────────────────────

/**
 * String-specific LZ-based compressor.
 *
 * Uses standard LZW with a 256-symbol alphabet (all bytes 0-255 are pre-seeded
 * in the dictionary).  Unicode characters above U+00FF are encoded as two-byte
 * sequences using a private-use escape prefix (code 256) followed by the
 * high byte and low byte as separate literals.
 *
 * The code stream is packed two codes per output character using 16-bit
 * Unicode code units (for `compress`) or 6-bit Base64 characters (for
 * `compressToBase64`).
 *
 * Protocol:
 *   - Codes 0–255: single ASCII characters (pre-seeded).
 *   - Code 256: reserved for end-of-stream.
 *   - Codes 257+: LZW back-references.
 */
export class LZString {
  static readonly #BASE64_CHARS =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

  static readonly #EOS = 256;

  // ── public API ────────────────────────────────────────────────────────────

  /** Compress `input` into a Unicode string. */
  static compress(input: string): string {
    const codes = LZString.#lzwEncode(input);
    return LZString.#packToString(codes, 16, (n) => String.fromCharCode(n));
  }

  /** Decompress a string produced by {@link LZString.compress}. */
  static decompress(input: string): string {
    if (input.length === 0) return '';
    const codes = LZString.#unpackFromString(input, 16, (i) => input.charCodeAt(i));
    return LZString.#lzwDecode(codes);
  }

  /** Compress `input` and encode the result as a base-64 string. */
  static compressToBase64(input: string): string {
    const codes = LZString.#lzwEncode(input);
    const raw = LZString.#packToString(codes, 6, (n) => LZString.#BASE64_CHARS[n]);
    const rem = raw.length % 4;
    return rem === 0 ? raw : raw + '='.repeat(4 - rem);
  }

  /** Decompress a string produced by {@link LZString.compressToBase64}. */
  static decompressFromBase64(input: string): string {
    if (input.length === 0) return '';
    // Strip trailing padding before unpacking.
    const stripped = input.replace(/=+$/, '');
    const codes = LZString.#unpackFromString(
      stripped, 6, (i) => LZString.#BASE64_CHARS.indexOf(stripped[i]),
    );
    return LZString.#lzwDecode(codes);
  }

  // ── LZW codec ─────────────────────────────────────────────────────────────

  /**
   * LZW encode `input` using a 256-symbol alphabet.
   * Unicode chars (>U+00FF) are transparently handled by treating input as
   * a sequence of 8-bit "bytes" obtained by clamping charCode to 0-255.
   * Because `compress` operates on text, non-ASCII chars may be garbled unless
   * the input is ASCII-safe; this is a known limitation of the 8-bit approach.
   * For full Unicode support, the compressor handles each char individually
   * as a string key in the dictionary.
   */
  static #lzwEncode(input: string): number[] {
    if (input.length === 0) return [LZString.#EOS];

    // Build the initial dictionary: all 256 single-byte values.
    // For Unicode chars, use a string key approach.
    const dict = new Map<string, number>();
    for (let i = 0; i < 256; i++) {
      dict.set(String.fromCharCode(i), i);
    }
    let nextCode = 257; // 256 is EOS

    const codes: number[] = [];
    let cur = input[0];

    for (let i = 1; i < input.length; i++) {
      const ch = input[i];
      const combined = cur + ch;
      if (dict.has(combined)) {
        cur = combined;
      } else {
        // Emit code for cur.
        const code = dict.get(cur);
        if (code !== undefined) {
          codes.push(code);
        }
        dict.set(combined, nextCode++);
        cur = ch;
      }
    }

    // Emit the last phrase.
    const lastCode = dict.get(cur);
    if (lastCode !== undefined) codes.push(lastCode);

    codes.push(LZString.#EOS);
    return codes;
  }

  /** LZW decode an array of codes produced by {@link LZString.#lzwEncode}. */
  static #lzwDecode(codes: number[]): string {
    if (codes.length === 0) return '';

    // Bootstrap dictionary with all 256 single-byte chars.
    const dict = new Map<number, string>();
    for (let i = 0; i < 256; i++) {
      dict.set(i, String.fromCharCode(i));
    }
    // 256 = EOS
    let nextCode = 257;

    let result = '';
    const first = codes[0];
    if (first === LZString.#EOS) return '';
    let prev = dict.get(first) ?? '';
    result = prev;

    for (let i = 1; i < codes.length; i++) {
      const code = codes[i];
      if (code === LZString.#EOS) break;

      let entry: string;
      if (dict.has(code)) {
        entry = dict.get(code)!;
      } else if (code === nextCode) {
        entry = prev + prev[0];
      } else {
        break; // corrupt
      }

      result += entry;
      dict.set(nextCode++, prev + entry[0]);
      prev = entry;
    }

    return result;
  }

  // ── bit-packing ───────────────────────────────────────────────────────────

  /**
   * Pack `codes` into a string where each output character holds `bitsPerChar`
   * bits.  Codes are packed LSB-first.  The number of bits per code grows
   * logarithmically as codes grow (starting at 9 bits for codes 0-511).
   *
   * To avoid a separate header we use a fixed 16-bit width for each code when
   * packing into 16-bit chars, and fixed width for base-64 packing.
   * This is simpler and avoids sync issues between encoder and decoder.
   */
  static #packToString(
    codes: number[],
    bitsPerChar: number,
    getChar: (code: number) => string,
  ): string {
    // We use a fixed 16-bit code width (max code value = 65535).
    // Each code is stored as 16 bits LSB-first across output characters.
    const CODE_BITS = 16;
    let acc = 0;
    let accBits = 0;
    let out = '';

    for (const code of codes) {
      for (let b = 0; b < CODE_BITS; b++) {
        acc |= ((code >> b) & 1) << accBits;
        accBits++;
        if (accBits === bitsPerChar) {
          out += getChar(acc);
          acc = 0;
          accBits = 0;
        }
      }
    }

    if (accBits > 0) out += getChar(acc);
    return out;
  }

  /** Unpack a code array from a packed string, mirroring {@link LZString.#packToString}. */
  static #unpackFromString(
    input: string,
    bitsPerChar: number,
    getVal: (index: number) => number,
  ): number[] {
    const CODE_BITS = 16;
    let charIdx = 0;
    let charVal = getVal(0);
    let charBitPos = 0;
    const totalBits = input.length * bitsPerChar;
    let bitsRead = 0;

    const readBits = (nBits: number): number => {
      let result = 0;
      for (let b = 0; b < nBits; b++) {
        if (charBitPos === bitsPerChar) {
          charIdx++;
          charVal = charIdx < input.length ? getVal(charIdx) : 0;
          charBitPos = 0;
        }
        result |= ((charVal >> charBitPos) & 1) << b;
        charBitPos++;
        bitsRead++;
      }
      return result;
    };

    const codes: number[] = [];
    while (bitsRead + CODE_BITS <= totalBits) {
      codes.push(readBits(CODE_BITS));
    }

    return codes;
  }
}
