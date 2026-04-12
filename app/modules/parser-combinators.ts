// @ts-check
// ─── Parser Combinator Library ───────────────────────────────────────────────
// A pure-functional parser combinator library. Every parser is a plain
// function (input: string) => ParseResult<T> with no side effects.

// ─── Result types ─────────────────────────────────────────────────────────────

export interface ParseSuccess<T> {
  success: true;
  value: T;
  remaining: string;
}

export interface ParseFailure {
  success: false;
  expected: string;
  /** Character offset into the original input where parsing failed. */
  at: number;
}

export type ParseResult<T> = ParseSuccess<T> | ParseFailure;

export type Parser<T> = (input: string) => ParseResult<T>;

// ─── Internal helpers ─────────────────────────────────────────────────────────

function ok<T>(value: T, remaining: string): ParseSuccess<T> {
  return { success: true, value, remaining };
}

function fail(expected: string, at: number): ParseFailure {
  return { success: false, expected, at };
}

// ─── Primitive parsers ────────────────────────────────────────────────────────

/**
 * Matches a single exact character `c`.
 * Fails when the input does not start with that character.
 */
export function char(c: string): Parser<string> {
  return (input) =>
    input.startsWith(c)
      ? ok(c, input.slice(c.length))
      : fail(`'${c}'`, 0);
}

/**
 * Matches the exact string `s`.
 * Fails when the input does not start with that string.
 */
export function str(s: string): Parser<string> {
  return (input) =>
    input.startsWith(s)
      ? ok(s, input.slice(s.length))
      : fail(`"${s}"`, 0);
}

/**
 * Matches `re` anchored to the start of the remaining input.
 * A `^` anchor in the supplied regex is preserved; otherwise one is added.
 * The `g` flag is stripped to avoid stateful `lastIndex` issues.
 */
export function regex(re: RegExp): Parser<string> {
  const flags = re.flags.replace('g', '');
  const anchored = re.source.startsWith('^')
    ? new RegExp(re.source, flags)
    : new RegExp('^(?:' + re.source + ')', flags);

  return (input) => {
    const m = anchored.exec(input);
    return m !== null
      ? ok(m[0], input.slice(m[0].length))
      : fail(`/${re.source}/`, 0);
  };
}

/** Matches a single decimal digit `[0-9]`. */
export function digit(): Parser<string> {
  return (input) => {
    const ch = input[0];
    return ch !== undefined && ch >= '0' && ch <= '9'
      ? ok(ch, input.slice(1))
      : fail('digit [0-9]', 0);
  };
}

/** Matches a single ASCII letter `[a-zA-Z]`. */
export function letter(): Parser<string> {
  return (input) => {
    const ch = input[0];
    return ch !== undefined && /^[a-zA-Z]$/.test(ch)
      ? ok(ch, input.slice(1))
      : fail('letter [a-zA-Z]', 0);
  };
}

/** Matches one or more whitespace characters `\s+`. */
export function whitespace(): Parser<string> {
  return regex(/\s+/);
}

/** Matches zero or more whitespace characters `\s*`. Always succeeds. */
export function optionalWhitespace(): Parser<string> {
  return (input) => {
    const m = /^\s*/.exec(input);
    const matched = m ? m[0] : '';
    return ok(matched, input.slice(matched.length));
  };
}

/** Matches any single character. Fails only on empty input. */
export function anyChar(): Parser<string> {
  return (input) =>
    input.length > 0
      ? ok(input[0], input.slice(1))
      : fail('any character', 0);
}

/**
 * Matches end of input.
 * Succeeds with value `null` when nothing remains; fails otherwise.
 */
export function eof(): Parser<null> {
  return (input) =>
    input.length === 0
      ? ok(null, '')
      : fail('end of input', 0);
}

// ─── Combinators ──────────────────────────────────────────────────────────────

/**
 * Runs parsers left-to-right, collecting their results into a tuple.
 * Fails at the first parser that fails; the `at` offset is cumulative.
 */
export function seq<T extends unknown[]>(
  ...parsers: { [K in keyof T]: Parser<T[K]> }
): Parser<T> {
  return (input) => {
    const values: unknown[] = [];
    let remaining = input;
    let consumed = 0;

    for (const parser of parsers as Parser<unknown>[]) {
      const result = parser(remaining);
      if (!result.success) {
        return fail(result.expected, consumed + result.at);
      }
      consumed += remaining.length - result.remaining.length;
      remaining = result.remaining;
      values.push(result.value);
    }

    return ok(values as T, remaining);
  };
}

/**
 * Tries each parser in order and returns the first success.
 * If all fail, returns the failure with the largest `at` position (most
 * informative error). Ties keep the last candidate.
 */
export function alt<T>(...parsers: Parser<T>[]): Parser<T> {
  return (input) => {
    let bestFailure: ParseFailure = fail('(no alternatives)', 0);

    for (const parser of parsers) {
      const result = parser(input);
      if (result.success) return result;
      if (result.at >= bestFailure.at) bestFailure = result;
    }

    return bestFailure;
  };
}

/**
 * Applies `parser` zero or more times, collecting results into an array.
 * Always succeeds; guards against infinite loops from zero-width matches.
 */
export function many<T>(parser: Parser<T>): Parser<T[]> {
  return (input) => {
    const values: T[] = [];
    let remaining = input;

    for (;;) {
      const result = parser(remaining);
      if (!result.success) break;
      // Guard: if no input was consumed, stop to prevent infinite loop.
      if (result.remaining.length === remaining.length) break;
      values.push(result.value);
      remaining = result.remaining;
    }

    return ok(values, remaining);
  };
}

/**
 * Applies `parser` one or more times.
 * Fails if the parser does not match at least once.
 */
export function many1<T>(parser: Parser<T>): Parser<T[]> {
  return (input) => {
    const first = parser(input);
    if (!first.success) return first;

    const rest = many(parser)(first.remaining) as ParseSuccess<T[]>;
    return ok([first.value, ...rest.value], rest.remaining);
  };
}

/**
 * Applies `parser` optionally.
 * Returns `null` as the value when the parser does not match (never fails).
 */
export function optional<T>(parser: Parser<T>): Parser<T | null> {
  return (input) => {
    const result = parser(input);
    return result.success ? result : ok(null, input);
  };
}

/**
 * Transforms the successful value of `parser` with `fn`.
 * Failures pass through unchanged.
 */
export function map<T, U>(parser: Parser<T>, fn: (v: T) => U): Parser<U> {
  return (input) => {
    const result = parser(input);
    return result.success ? ok(fn(result.value), result.remaining) : result;
  };
}

/**
 * Parses `open`, then `parser`, then `close`, returning only the inner value.
 */
export function between<T>(
  open: Parser<unknown>,
  close: Parser<unknown>,
  parser: Parser<T>,
): Parser<T> {
  return map(
    seq(open, parser, close) as Parser<[unknown, T, unknown]>,
    ([, v]) => v,
  );
}

/**
 * Parses zero or more occurrences of `parser` separated by `sep`.
 * Returns the list of `parser` values; separators are discarded.
 * Does not consume a trailing separator.
 */
export function sepBy<T>(parser: Parser<T>, sep: Parser<unknown>): Parser<T[]> {
  return (input) => {
    const first = parser(input);
    if (!first.success) return ok([], input);

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

/**
 * Defers parser construction until the first call.
 * Necessary for mutually recursive (left-recursive-free) grammars.
 */
export function lazy<T>(fn: () => Parser<T>): Parser<T> {
  let cached: Parser<T> | null = null;
  return (input) => {
    if (cached === null) cached = fn();
    return cached(input);
  };
}

// ─── Convenience parsers ──────────────────────────────────────────────────────

/**
 * Parses an optional leading `-` followed by one or more digits.
 * Returns the value as a JavaScript `number` (via `parseInt`).
 */
export function integer(): Parser<number> {
  return map(regex(/^-?[0-9]+/), (s) => parseInt(s, 10));
}

/**
 * Parses an optional leading `-`, digits, an optional fractional part, and an
 * optional exponent (`e`/`E` with optional sign).
 * Returns the value as a JavaScript `number` (via `parseFloat`).
 */
export function float(): Parser<number> {
  return map(
    regex(/^-?[0-9]+(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/),
    (s) => parseFloat(s),
  );
}

/**
 * Parses a double-quoted string literal with `\"` and `\\` escape support.
 * Returns the unescaped content without the surrounding quotes.
 * Fails if the closing `"` is missing.
 */
export function quoted(): Parser<string> {
  return (input) => {
    if (!input.startsWith('"')) {
      return fail('double-quoted string', 0);
    }

    let i = 1; // skip opening quote
    let value = '';

    while (i < input.length) {
      const ch = input[i];
      if (ch === '"') {
        return ok(value, input.slice(i + 1));
      }
      if (ch === '\\') {
        i += 1;
        if (i >= input.length) break;
        const esc = input[i];
        if (esc === '"')       value += '"';
        else if (esc === '\\') value += '\\';
        else if (esc === 'n')  value += '\n';
        else if (esc === 't')  value += '\t';
        else if (esc === 'r')  value += '\r';
        else                   value += '\\' + esc;
      } else {
        value += ch;
      }
      i += 1;
    }

    return fail('closing double-quote "', i);
  };
}
