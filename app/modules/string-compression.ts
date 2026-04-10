// @ts-check
// ─── String Compression ──────────────────────────────────────────────────────
// LZ77 and LZ78 lossless compression algorithms for strings.

// ─── Types ───────────────────────────────────────────────────────────────────

/** A single LZ77 token: back-reference offset + match length + next literal. */
export interface LZ77Token {
  offset: number;
  length: number;
  char: string;
}

/** A single LZ78 token: dictionary code + next literal. */
export interface LZ78Token {
  code: number;
  char: string;
}

/** Compression statistics comparing original vs compressed size. */
export interface CompressionStats {
  originalSize: number;
  compressedSize: number;
  ratio: number;
}

// ─── LZ77 ────────────────────────────────────────────────────────────────────

/**
 * Encode a string using the LZ77 sliding-window algorithm.
 *
 * Each output token `{ offset, length, char }` means:
 *   - Copy `length` characters from `offset` positions back in the output,
 *   - then emit the literal `char`.
 *
 * @param input      - The string to compress.
 * @param windowSize - Sliding window size (default 255).
 */
export function lz77Encode(
  input: string,
  windowSize: number = 255,
): LZ77Token[] {
  const tokens: LZ77Token[] = [];
  let i = 0;

  while (i < input.length) {
    let bestOffset = 0;
    let bestLength = 0;

    // Search the sliding window for the longest match
    const windowStart = Math.max(0, i - windowSize);

    for (let j = windowStart; j < i; j++) {
      let len = 0;
      while (
        i + len < input.length &&
        input[j + len] === input[i + len] &&
        len < 255
      ) {
        len++;
      }
      if (len > bestLength) {
        bestLength = len;
        bestOffset = i - j;
      }
    }

    const nextChar = i + bestLength < input.length
      ? input[i + bestLength]
      : '';

    tokens.push({ offset: bestOffset, length: bestLength, char: nextChar });
    i += bestLength + 1;
  }

  return tokens;
}

/**
 * Decode a sequence of LZ77 tokens back to the original string.
 *
 * @param tokens - Array of `{ offset, length, char }` tokens.
 */
export function lz77Decode(tokens: LZ77Token[]): string {
  let output = '';

  for (const { offset, length, char } of tokens) {
    if (length > 0 && offset > 0) {
      const start = output.length - offset;
      for (let i = 0; i < length; i++) {
        // Use modular index to support overlapping (run-length) copies
        output += output[start + (i % offset)];
      }
    }
    if (char !== '') {
      output += char;
    }
  }

  return output;
}

// ─── LZ78 ────────────────────────────────────────────────────────────────────

/**
 * Encode a string using the LZ78 dictionary algorithm.
 *
 * Each output token `{ code, char }` means:
 *   - Emit the string referenced by dictionary entry `code`,
 *   - then append the literal `char`.
 * Code 0 means "no prior entry" (empty prefix).
 *
 * @param input - The string to compress.
 */
export function lz78Encode(input: string): LZ78Token[] {
  const tokens: LZ78Token[] = [];
  // Dictionary maps phrase → assigned code (1-based)
  const dict = new Map<string, number>();
  let nextCode = 1;
  let i = 0;

  while (i < input.length) {
    let phrase = '';
    let code = 0;

    // Greedily extend the current phrase using the dictionary
    while (i < input.length) {
      const extended = phrase + input[i];
      if (dict.has(extended)) {
        phrase = extended;
        code = dict.get(extended) as number;
        i++;
      } else {
        // Emit token and add new entry to dictionary
        tokens.push({ code, char: input[i] });
        dict.set(extended, nextCode++);
        i++;
        break;
      }
    }

    // Handle the case where the loop ended without a new literal
    if (i === input.length && phrase.length > 0 && !tokens.length ||
        i === input.length && phrase.length > 0 &&
        tokens[tokens.length - 1].code !== code) {
      // Remaining phrase with no following character
      tokens.push({ code, char: '' });
    }
  }

  return tokens;
}

/**
 * Decode a sequence of LZ78 tokens back to the original string.
 *
 * @param tokens - Array of `{ code, char }` tokens.
 */
export function lz78Decode(tokens: LZ78Token[]): string {
  let output = '';
  // Dictionary maps code → phrase (1-based)
  const dict = new Map<number, string>();
  let nextCode = 1;

  for (const { code, char } of tokens) {
    const prefix = code === 0 ? '' : (dict.get(code) ?? '');
    const phrase = prefix + char;
    output += phrase;
    if (phrase.length > 0) {
      dict.set(nextCode++, phrase);
    }
  }

  return output;
}

// ─── Statistics ──────────────────────────────────────────────────────────────

/**
 * Compute compression statistics.
 *
 * `compressedSize` is derived by serialising the compressed data as JSON and
 * measuring the character count of that JSON string — a simple proxy for the
 * information content of the compressed representation.
 *
 * `ratio` = compressedSize / originalSize (< 1 means actual compression).
 *
 * @param original   - The original string.
 * @param compressed - The compressed data (any serialisable value).
 */
export function compressionStats(
  original: string,
  compressed: unknown,
): CompressionStats {
  const originalSize = original.length;
  const compressedSize = JSON.stringify(compressed).length;
  const ratio = originalSize === 0 ? Infinity : compressedSize / originalSize;
  return { originalSize, compressedSize, ratio };
}
