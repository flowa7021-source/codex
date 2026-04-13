// @ts-check
// ─── Run-Length Encoding ─────────────────────────────────────────────────────
// Implements RLE for strings and typed arrays, the Burrows-Wheeler Transform
// (BWT) for improved compressibility, and Move-to-Front (MTF) coding which is
// typically applied after BWT to convert BWT output into small integers.

// ─── String RLE ──────────────────────────────────────────────────────────────

/**
 * RLE-encode a string.
 * Runs of 2+ identical characters are represented as `<count><char>`.
 * Single occurrences are written as just the character.
 *
 * Example: `"AAABBC"` → `"3A2BC"`
 */
export function rleEncode(input: string): string {
  if (input.length === 0) return '';

  let result = '';
  let i = 0;

  while (i < input.length) {
    const ch = input[i];
    let count = 1;
    while (i + count < input.length && input[i + count] === ch) {
      count++;
    }
    result += count > 1 ? `${count}${ch}` : ch;
    i += count;
  }

  return result;
}

/**
 * RLE-decode a string produced by `rleEncode`.
 * Tokens are an optional decimal count followed by a single character.
 *
 * Example: `"3A2BC"` → `"AAABBC"`
 */
export function rleDecode(encoded: string): string {
  if (encoded.length === 0) return '';

  let result = '';
  let i = 0;

  while (i < encoded.length) {
    // Collect leading digits (the run-length count)
    let numStr = '';
    while (i < encoded.length && encoded[i] >= '0' && encoded[i] <= '9') {
      numStr += encoded[i];
      i++;
    }

    if (i >= encoded.length) {
      throw new Error('RLE decode error: trailing digits without a symbol');
    }

    const ch = encoded[i];
    i++;
    const count = numStr.length > 0 ? parseInt(numStr, 10) : 1;
    result += ch.repeat(count);
  }

  return result;
}

// ─── Array RLE ────────────────────────────────────────────────────────────────

/**
 * RLE-encode an array of values.
 * Returns an array of `{ value, count }` run descriptors.
 */
export function rleEncodeArray<T>(data: T[]): Array<{ value: T; count: number }> {
  if (data.length === 0) return [];

  const result: Array<{ value: T; count: number }> = [];
  let i = 0;

  while (i < data.length) {
    const value = data[i];
    let count = 1;
    while (i + count < data.length && data[i + count] === value) {
      count++;
    }
    result.push({ value, count });
    i += count;
  }

  return result;
}

/**
 * RLE-decode an array produced by `rleEncodeArray`.
 */
export function rleDecodeArray<T>(encoded: Array<{ value: T; count: number }>): T[] {
  const result: T[] = [];
  for (const { value, count } of encoded) {
    for (let i = 0; i < count; i++) {
      result.push(value);
    }
  }
  return result;
}

// ─── Burrows-Wheeler Transform ────────────────────────────────────────────────

/**
 * Apply the Burrows-Wheeler Transform to `text`.
 *
 * Appends a sentinel character `\0` (must not appear in `text`) to make the
 * transform invertible, forms all cyclic rotations, sorts them lexicographically,
 * then returns the last column and the index of the original string in the
 * sorted order.
 */
export function bwt(text: string): { transformed: string; index: number } {
  const s = text + '\0'; // sentinel
  const n = s.length;

  // Build and sort rotation indices without materialising full strings
  const indices = Array.from({ length: n }, (_, i) => i);
  indices.sort((a, b) => {
    for (let k = 0; k < n; k++) {
      const ca = s[(a + k) % n];
      const cb = s[(b + k) % n];
      if (ca < cb) return -1;
      if (ca > cb) return 1;
    }
    return 0;
  });

  // Last column: character just before each rotation's start
  const transformed = indices.map(i => s[(i + n - 1) % n]).join('');

  // The row whose rotation starts at index 0 is the original string
  const index = indices.indexOf(0);

  return { transformed, index };
}

/**
 * Invert the Burrows-Wheeler Transform.
 *
 * Uses the standard "T-mapping" algorithm:
 *   1. Sort the last column (L) to obtain the first column (F).
 *   2. Build a `next[]` array: next[i] is the row in the sorted table whose
 *      last-column character is L[i] and has the same occurrence rank as the
 *      i-th occurrence of L[i] in L.  Equivalently, next[i] is the position
 *      in F of the character that immediately follows the character in L at row
 *      i when reading the original circular rotation.
 *   3. Walk the chain: start at `index`, output F[row], advance row = next[row],
 *      stopping after n steps.
 *   4. Strip the appended sentinel '\0'.
 */
export function ibwt(transformed: string, index: number): string {
  const n = transformed.length;
  if (n === 0) return '';

  // Step 1: first column = sorted last column
  const firstCol = transformed.split('').sort();

  // Step 2: build next[] (the "LF-mapping")
  //
  // For each position i in L (= transformed), rank = how many times L[i] has
  // appeared in L[0..i-1].  The corresponding position in F is the rank-th
  // occurrence of that character in F.
  //
  // Pre-compute: for each char, the list of F-positions in order.
  const firstColPositions = new Map<string, number[]>();
  for (let i = 0; i < n; i++) {
    const ch = firstCol[i];
    const arr = firstColPositions.get(ch);
    if (arr) arr.push(i);
    else firstColPositions.set(ch, [i]);
  }

  const next = new Array<number>(n);
  const rankCounter = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    const ch = transformed[i];
    const rank = rankCounter.get(ch) ?? 0;
    rankCounter.set(ch, rank + 1);
    next[i] = firstColPositions.get(ch)![rank];
  }

  // Step 3: walk the LF-chain to reconstruct (prepend last-column chars)
  //
  // Starting at the row that holds the original string (row = index), we read
  // L[row] = transformed[row] and prepend it, then advance via LF to the next
  // row.  After n iterations the accumulated string equals `text + '\0'`.
  let result = '';
  let row = index;
  for (let i = 0; i < n; i++) {
    result = transformed[row] + result;
    row = next[row];
  }

  // Step 4: remove the sentinel '\0'
  return result.replace('\0', '');
}

// ─── Move-to-Front Encoding ───────────────────────────────────────────────────

/**
 * Move-to-Front encode a string.
 *
 * Maintains an alphabet list initialised to all distinct characters in sorted
 * order. For each input character, outputs the index of that character in the
 * list, then moves the character to the front of the list.
 *
 * Used after BWT to turn the repetitive BWT output into small integers that
 * compress well with entropy coding.
 */
export function mtfEncode(text: string): number[] {
  if (text.length === 0) return [];

  // Initialise alphabet from sorted unique characters in text
  const alphabet: string[] = [...new Set(text)].sort();
  const result: number[] = [];

  for (const ch of text) {
    const idx = alphabet.indexOf(ch);
    if (idx === -1) throw new Error(`MTF encode: character "${ch}" not in alphabet`);
    result.push(idx);
    // Move to front
    alphabet.splice(idx, 1);
    alphabet.unshift(ch);
  }

  return result;
}

/**
 * Move-to-Front decode an array of indices produced by `mtfEncode`.
 *
 * Requires the same initial alphabet (sorted unique characters).
 * Since we don't persist the alphabet separately, you must pass the original
 * text (or at least its unique characters) so the alphabet can be reconstructed.
 *
 * @param codes - indices from `mtfEncode`
 * @param alphabetSource - the original text whose unique sorted chars form the alphabet
 */
export function mtfDecode(codes: number[], alphabetSource?: string): string {
  if (codes.length === 0) return '';

  // Reconstruct the alphabet. If no source is provided we cannot know the
  // original alphabet, so callers must supply it (or the text).
  // When called in a round-trip context the caller supplies the original text.
  if (!alphabetSource) {
    throw new Error('mtfDecode requires the original alphabet source text');
  }

  const alphabet: string[] = [...new Set(alphabetSource)].sort();
  let result = '';

  for (const idx of codes) {
    if (idx < 0 || idx >= alphabet.length) {
      throw new Error(`MTF decode: index ${idx} out of range`);
    }
    const ch = alphabet[idx];
    result += ch;
    alphabet.splice(idx, 1);
    alphabet.unshift(ch);
  }

  return result;
}
