// @ts-check
// ─── Parser Combinators ───────────────────────────────────────────────────────
// Functional parser combinators for building composable parsers.

// ─── Types ────────────────────────────────────────────────────────────────────

export type ParseSuccess<T> = { success: true; value: T; remaining: string };
export type ParseFailure = { success: false; error: string; remaining: string };
export type ParseResult<T> = ParseSuccess<T> | ParseFailure;

export type Parser<T> = (input: string) => ParseResult<T>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ok<T>(value: T, remaining: string): ParseSuccess<T> {
  return { success: true, value, remaining };
}

function fail(error: string, remaining: string): ParseFailure {
  return { success: false, error, remaining };
}

// ─── Core Combinators ─────────────────────────────────────────────────────────

/**
 * Match an exact string literal at the start of input.
 * Returns the matched string on success.
 */
export function literal(str: string): Parser<string> {
  return (input: string) => {
    if (input.startsWith(str)) {
      return ok(str, input.slice(str.length));
    }
    return fail(`Expected "${str}" but got "${input.slice(0, str.length || 1)}"`, input);
  };
}

/**
 * Match a regular expression at the start of input.
 * The regex is automatically anchored to the start (^) if not already.
 * Returns the matched string on success.
 */
export function regex(re: RegExp): Parser<string> {
  const anchored = re.source.startsWith('^')
    ? new RegExp(re.source, re.flags)
    : new RegExp('^(?:' + re.source + ')', re.flags);
  return (input: string) => {
    const m = anchored.exec(input);
    if (m !== null) {
      return ok(m[0], input.slice(m[0].length));
    }
    return fail(`Expected pattern /${re.source}/ at "${input.slice(0, 20)}"`, input);
  };
}

/**
 * Transform the value of a successful parse result using a mapping function.
 */
export function map<T, U>(parser: Parser<T>, fn: (v: T) => U): Parser<U> {
  return (input: string) => {
    const result = parser(input);
    if (result.success) {
      return ok(fn(result.value), result.remaining);
    }
    return result;
  };
}

/**
 * Run all parsers in order. Returns an array of all parsed values.
 * Fails if any parser fails.
 */
export function sequence(...parsers: Parser<unknown>[]): Parser<unknown[]> {
  return (input: string) => {
    const values: unknown[] = [];
    let remaining = input;
    for (const parser of parsers) {
      const result = parser(remaining);
      if (!result.success) {
        return result;
      }
      values.push(result.value);
      remaining = result.remaining;
    }
    return ok(values, remaining);
  };
}

/**
 * Try each parser in order and return the result of the first one that succeeds.
 * Fails if none succeed.
 */
export function choice<T>(...parsers: Parser<T>[]): Parser<T> {
  return (input: string) => {
    const errors: string[] = [];
    for (const parser of parsers) {
      const result = parser(input);
      if (result.success) {
        return result;
      }
      errors.push(result.error);
    }
    return fail(`No alternative matched: ${errors.join('; ')}`, input);
  };
}

/**
 * Match zero or more occurrences of parser. Always succeeds.
 * Returns an array of all matched values.
 */
export function many<T>(parser: Parser<T>): Parser<T[]> {
  return (input: string) => {
    const values: T[] = [];
    let remaining = input;
    for (;;) {
      const result = parser(remaining);
      if (!result.success) break;
      // Guard against infinite loop on zero-width matches
      if (result.remaining === remaining) break;
      values.push(result.value);
      remaining = result.remaining;
    }
    return ok(values, remaining);
  };
}

/**
 * Match one or more occurrences of parser.
 * Fails if zero occurrences are found.
 */
export function many1<T>(parser: Parser<T>): Parser<T[]> {
  return (input: string) => {
    const result = many(parser)(input);
    if (!result.success) return result;
    if (result.value.length === 0) {
      return fail('Expected at least one match', input);
    }
    return result;
  };
}

/**
 * Match zero or one occurrence of parser.
 * Returns null if the parser fails.
 */
export function optional<T>(parser: Parser<T>): Parser<T | null> {
  return (input: string) => {
    const result = parser(input);
    if (result.success) {
      return result as ParseSuccess<T>;
    }
    return ok(null, input);
  };
}

/**
 * Parse open, then parser, then close. Returns only the inner value.
 */
export function between<T>(
  open: Parser<unknown>,
  close: Parser<unknown>,
  parser: Parser<T>,
): Parser<T> {
  return (input: string) => {
    const openResult = open(input);
    if (!openResult.success) return openResult;
    const innerResult = parser(openResult.remaining);
    if (!innerResult.success) return innerResult;
    const closeResult = close(innerResult.remaining);
    if (!closeResult.success) return closeResult;
    return ok(innerResult.value, closeResult.remaining);
  };
}

/**
 * Parse zero or more occurrences of parser separated by sep.
 * Returns an array of the parsed values (not the separators).
 */
export function separated<T>(parser: Parser<T>, sep: Parser<unknown>): Parser<T[]> {
  return (input: string) => {
    const first = parser(input);
    if (!first.success) {
      return ok([], input);
    }
    const values: T[] = [first.value];
    let remaining = first.remaining;
    for (;;) {
      const sepResult = sep(remaining);
      if (!sepResult.success) break;
      const itemResult = parser(sepResult.remaining);
      if (!itemResult.success) break;
      values.push(itemResult.value);
      remaining = itemResult.remaining;
    }
    return ok(values, remaining);
  };
}

// ─── Primitive Parsers ────────────────────────────────────────────────────────

/** Optional whitespace — always succeeds, consuming any leading spaces/tabs/newlines. */
export const ws: Parser<string> = regex(/\s*/);

/** Single ASCII digit (0–9). */
export const digit: Parser<string> = regex(/[0-9]/);

/** Single ASCII letter (a–z or A–Z). */
export const letter: Parser<string> = regex(/[a-zA-Z]/);

/** Decimal number — integer or floating point. Returns a JavaScript number. */
export const number: Parser<number> = map(
  regex(/[+-]?(?:\d+\.?\d*|\.\d+)/),
  (s) => parseFloat(s),
);
