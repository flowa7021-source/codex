// @ts-check
// ─── Roman Numeral Conversion ────────────────────────────────────────────────
// Converts between integers and Roman numeral strings.
// Valid range: 1–3999.

// ─── Lookup Tables ────────────────────────────────────────────────────────────

/** Descending value/symbol pairs used for integer → Roman conversion. */
const TO_ROMAN_TABLE: { value: number; symbol: string }[] = [
  { value: 1000, symbol: 'M' },
  { value: 900,  symbol: 'CM' },
  { value: 500,  symbol: 'D' },
  { value: 400,  symbol: 'CD' },
  { value: 100,  symbol: 'C' },
  { value: 90,   symbol: 'XC' },
  { value: 50,   symbol: 'L' },
  { value: 40,   symbol: 'XL' },
  { value: 10,   symbol: 'X' },
  { value: 9,    symbol: 'IX' },
  { value: 5,    symbol: 'V' },
  { value: 4,    symbol: 'IV' },
  { value: 1,    symbol: 'I' },
];

/** Symbol → integer value for single Roman numeral characters. */
const ROMAN_VALUES: Record<string, number> = {
  I: 1,
  V: 5,
  X: 10,
  L: 50,
  C: 100,
  D: 500,
  M: 1000,
};

// ─── Validation Regex ─────────────────────────────────────────────────────────

/**
 * Regex that matches valid Roman numeral strings for 1–3999.
 * Follows standard subtractive notation rules.
 */
const ROMAN_PATTERN =
  /^M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/;

// ─── toRoman ─────────────────────────────────────────────────────────────────

/**
 * Convert a positive integer to its Roman numeral representation.
 *
 * @param n - Integer in the range 1–3999 (inclusive).
 * @returns The Roman numeral string.
 * @throws {RangeError} If `n` is not a positive integer in [1, 3999].
 */
export function toRoman(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > 3999) {
    throw new RangeError(
      `toRoman: expected an integer in [1, 3999], got ${n}`,
    );
  }

  let remaining = n;
  let result = '';

  for (const { value, symbol } of TO_ROMAN_TABLE) {
    while (remaining >= value) {
      result += symbol;
      remaining -= value;
    }
  }

  return result;
}

// ─── fromRoman ────────────────────────────────────────────────────────────────

/**
 * Convert a Roman numeral string to an integer.
 *
 * @param roman - A non-empty string using only valid Roman numeral characters
 *   in a valid subtractive-notation pattern.
 * @returns The integer value.
 * @throws {Error} If the string is empty, contains unknown characters, or does
 *   not form a valid Roman numeral pattern.
 */
export function fromRoman(roman: string): number {
  if (typeof roman !== 'string' || roman.length === 0) {
    throw new Error('fromRoman: input must be a non-empty string');
  }

  const upper = roman.toUpperCase();

  if (!ROMAN_PATTERN.test(upper) || upper === '') {
    throw new Error(`fromRoman: invalid Roman numeral "${roman}"`);
  }

  let result = 0;
  let prev = 0;

  // Traverse right-to-left; subtract when a smaller value precedes a larger one.
  for (let i = upper.length - 1; i >= 0; i--) {
    const ch = upper[i];
    if (!(ch in ROMAN_VALUES)) {
      throw new Error(`fromRoman: unknown character "${ch}" in "${roman}"`);
    }
    const curr = ROMAN_VALUES[ch];
    if (curr < prev) {
      result -= curr;
    } else {
      result += curr;
    }
    prev = curr;
  }

  return result;
}

// ─── isValidRoman ─────────────────────────────────────────────────────────────

/**
 * Return `true` if `str` is a valid Roman numeral string for a value in [1, 3999].
 *
 * @param str - Candidate string.
 */
export function isValidRoman(str: string): boolean {
  if (typeof str !== 'string' || str.length === 0) return false;
  const upper = str.toUpperCase();
  return ROMAN_PATTERN.test(upper) && upper.length > 0;
}

// ─── romanAdd ────────────────────────────────────────────────────────────────

/**
 * Add two Roman numeral strings and return the result as a Roman numeral.
 *
 * @param a - First Roman numeral string.
 * @param b - Second Roman numeral string.
 * @returns The sum as a Roman numeral string.
 * @throws {Error} If either input is invalid, or if the sum exceeds 3999.
 */
export function romanAdd(a: string, b: string): string {
  const sum = fromRoman(a) + fromRoman(b);
  if (sum > 3999) {
    throw new RangeError(
      `romanAdd: result ${sum} exceeds maximum Roman numeral value of 3999`,
    );
  }
  return toRoman(sum);
}

// ─── romanCompare ─────────────────────────────────────────────────────────────

/**
 * Compare two Roman numeral strings.
 * Returns a negative number if `a < b`, zero if `a === b`, positive if `a > b`.
 * Compatible with `Array.prototype.sort`.
 *
 * @param a - First Roman numeral string.
 * @param b - Second Roman numeral string.
 * @throws {Error} If either input is an invalid Roman numeral.
 */
export function romanCompare(a: string, b: string): number {
  return fromRoman(a) - fromRoman(b);
}
