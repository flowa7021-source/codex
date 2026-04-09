// @ts-check
// ─── Run-Length Encoding ────────────────────────────────────────────────────
// Simple lossless compression that replaces consecutive runs of identical
// values with a count + value pair. Works on both strings and byte arrays.

// ─── Types ──────────────────────────────────────────────────────────────────

/** A single run of consecutive identical characters. */
export interface RLERun {
  char: string;
  count: number;
}

// ─── String-based RLE ───────────────────────────────────────────────────────

/**
 * Encode a string using run-length encoding.
 * E.g. `"AAABBC"` → `"3A2B1C"`.
 */
export function rleEncode(input: string): string {
  if (input.length === 0) return '';

  let result = '';
  let count = 1;

  for (let i = 1; i <= input.length; i++) {
    if (i < input.length && input[i] === input[i - 1]) {
      count++;
    } else {
      result += `${count}${input[i - 1]}`;
      count = 1;
    }
  }
  return result;
}

/**
 * Decode an RLE-encoded string back to the original.
 * E.g. `"3A2B1C"` → `"AAABBC"`.
 */
export function rleDecode(encoded: string): string {
  if (encoded.length === 0) return '';

  let result = '';
  let i = 0;

  while (i < encoded.length) {
    // Parse the numeric count (one or more digits)
    let numStr = '';
    while (i < encoded.length && encoded[i] >= '0' && encoded[i] <= '9') {
      numStr += encoded[i];
      i++;
    }
    if (numStr.length === 0 || i >= encoded.length) {
      throw new Error('Invalid RLE encoding: expected count followed by character');
    }
    const count = parseInt(numStr, 10);
    const char = encoded[i];
    i++;
    result += char.repeat(count);
  }

  return result;
}

// ─── Byte-based RLE ─────────────────────────────────────────────────────────

/**
 * Binary run-length encoding on a `Uint8Array`.
 * Output format: pairs of `[count, byte]` where count is 1–255. Runs longer
 * than 255 are split into multiple pairs.
 */
export function rleEncodeBytes(data: Uint8Array): Uint8Array {
  if (data.length === 0) return new Uint8Array(0);

  const pairs: number[] = [];
  let count = 1;

  for (let i = 1; i <= data.length; i++) {
    if (i < data.length && data[i] === data[i - 1] && count < 255) {
      count++;
    } else {
      pairs.push(count, data[i - 1]);
      count = 1;
    }
  }

  return new Uint8Array(pairs);
}

/**
 * Decode a binary RLE `Uint8Array` produced by `rleEncodeBytes`.
 */
export function rleDecodeBytes(encoded: Uint8Array): Uint8Array {
  if (encoded.length === 0) return new Uint8Array(0);
  if (encoded.length % 2 !== 0) {
    throw new Error('Invalid binary RLE: length must be even');
  }

  // First pass: compute total output length
  let total = 0;
  for (let i = 0; i < encoded.length; i += 2) {
    total += encoded[i];
  }

  const result = new Uint8Array(total);
  let offset = 0;
  for (let i = 0; i < encoded.length; i += 2) {
    const count = encoded[i];
    const byte = encoded[i + 1];
    result.fill(byte, offset, offset + count);
    offset += count;
  }

  return result;
}

// ─── Analytics ──────────────────────────────────────────────────────────────

/**
 * Return the compression ratio `encoded.length / original.length`.
 * Values < 1 indicate compression; > 1 indicates expansion.
 * Returns `Infinity` if the original is empty.
 */
export function compressionRatio(original: string, encoded: string): number {
  if (original.length === 0) return Infinity;
  return encoded.length / original.length;
}

// ─── Runs helpers ───────────────────────────────────────────────────────────

/**
 * Break a string into an array of `RLERun` objects.
 */
export function rleToRuns(input: string): RLERun[] {
  if (input.length === 0) return [];

  const runs: RLERun[] = [];
  let count = 1;

  for (let i = 1; i <= input.length; i++) {
    if (i < input.length && input[i] === input[i - 1]) {
      count++;
    } else {
      runs.push({ char: input[i - 1], count });
      count = 1;
    }
  }

  return runs;
}

/**
 * Convert an array of `RLERun` objects back to a string.
 */
export function runsToString(runs: RLERun[]): string {
  let result = '';
  for (const run of runs) {
    result += run.char.repeat(run.count);
  }
  return result;
}
