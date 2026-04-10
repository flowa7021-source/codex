// @ts-check
// ─── Parser Combinators ───────────────────────────────────────────────────────
// A composable parser combinator library. Each parser is a function that takes
// a string input and returns a ParseResult describing success or failure.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ParseResult<T> {
  success: boolean;
  value?: T;
  rest?: string;
  error?: string;
}

export type Parser<T> = (input: string) => ParseResult<T>;

// ─── Primitives ───────────────────────────────────────────────────────────────

/** Match a literal string at the start of input. */
export function literal(s: string): Parser<string> {
  return (input: string): ParseResult<string> => {
    if (input.startsWith(s)) {
      return { success: true, value: s, rest: input.slice(s.length) };
    }
    return { success: false, error: `Expected "${s}" but got "${input.slice(0, s.length || 10)}"` };
  };
}

/** Match a regular expression anchored at the start of input. */
export function regex(pattern: RegExp): Parser<string> {
  // Build an anchored copy of the pattern (flags preserved, no double-anchor)
  const anchored = new RegExp(
    `^(?:${pattern.source})`,
    pattern.flags.replace('g', ''),
  );
  return (input: string): ParseResult<string> => {
    const m = anchored.exec(input);
    if (m !== null) {
      return { success: true, value: m[0], rest: input.slice(m[0].length) };
    }
    return { success: false, error: `Pattern ${pattern} did not match "${input.slice(0, 20)}"` };
  };
}

// ─── Combinators ──────────────────────────────────────────────────────────────

/** Try parsers in order; return the first success. */
export function choice<T>(...parsers: Parser<T>[]): Parser<T> {
  return (input: string): ParseResult<T> => {
    const errors: string[] = [];
    for (const p of parsers) {
      const result = p(input);
      if (result.success) return result;
      if (result.error) errors.push(result.error);
    }
    return { success: false, error: `No alternative matched: ${errors.join('; ')}` };
  };
}

/** Run parsers in sequence; collect results into a tuple. */
export function sequence<T extends unknown[]>(
  ...parsers: { [K in keyof T]: Parser<T[K]> }
): Parser<T> {
  return (input: string): ParseResult<T> => {
    const values: unknown[] = [];
    let rest = input;
    for (const p of parsers as Parser<unknown>[]) {
      const result = p(rest);
      if (!result.success) {
        return { success: false, error: result.error };
      }
      values.push(result.value);
      rest = result.rest ?? '';
    }
    return { success: true, value: values as T, rest };
  };
}

/** Zero or more repetitions. Always succeeds. */
export function many<T>(parser: Parser<T>): Parser<T[]> {
  return (input: string): ParseResult<T[]> => {
    const values: T[] = [];
    let rest = input;
    while (true) {
      const result = parser(rest);
      if (!result.success) break;
      values.push(result.value as T);
      // Guard against infinite loops on zero-width matches
      if (result.rest === rest) break;
      rest = result.rest ?? '';
    }
    return { success: true, value: values, rest };
  };
}

/** One or more repetitions. Fails if zero matches. */
export function many1<T>(parser: Parser<T>): Parser<T[]> {
  return (input: string): ParseResult<T[]> => {
    const result = many(parser)(input);
    if (!result.success || !result.value || result.value.length === 0) {
      return { success: false, error: `Expected one or more matches` };
    }
    return result;
  };
}

/** Zero or one occurrence. Always succeeds; value is undefined when absent. */
export function optional<T>(parser: Parser<T>): Parser<T | undefined> {
  return (input: string): ParseResult<T | undefined> => {
    const result = parser(input);
    if (result.success) {
      return { success: true, value: result.value, rest: result.rest };
    }
    return { success: true, value: undefined, rest: input };
  };
}

/** Transform the parsed value with a mapping function. */
export function map<T, U>(parser: Parser<T>, fn: (val: T) => U): Parser<U> {
  return (input: string): ParseResult<U> => {
    const result = parser(input);
    if (!result.success) {
      return { success: false, error: result.error };
    }
    return { success: true, value: fn(result.value as T), rest: result.rest };
  };
}

/** Match optional whitespace. Always succeeds. */
export function whitespace(): Parser<string> {
  return regex(/[ \t\r\n]*/);
}

/** Parse content between open and close parsers; returns only the content. */
export function between<T>(
  open: Parser<unknown>,
  content: Parser<T>,
  close: Parser<unknown>,
): Parser<T> {
  return (input: string): ParseResult<T> => {
    const openResult = open(input);
    if (!openResult.success) return { success: false, error: openResult.error };

    const contentResult = content(openResult.rest ?? '');
    if (!contentResult.success) return { success: false, error: contentResult.error };

    const closeResult = close(contentResult.rest ?? '');
    if (!closeResult.success) return { success: false, error: closeResult.error };

    return { success: true, value: contentResult.value, rest: closeResult.rest };
  };
}

/** Parse a separator-delimited list of items. Always succeeds (empty list ok). */
export function sepBy<T>(item: Parser<T>, separator: Parser<unknown>): Parser<T[]> {
  return (input: string): ParseResult<T[]> => {
    const first = item(input);
    if (!first.success) {
      return { success: true, value: [], rest: input };
    }

    const values: T[] = [first.value as T];
    let rest = first.rest ?? '';

    while (true) {
      const sepResult = separator(rest);
      if (!sepResult.success) break;

      const itemResult = item(sepResult.rest ?? '');
      if (!itemResult.success) break;

      values.push(itemResult.value as T);
      // Guard against zero-width infinite loop
      if (itemResult.rest === rest) break;
      rest = itemResult.rest ?? '';
    }

    return { success: true, value: values, rest };
  };
}

/** Run both parsers; discard the left result and return the right. */
export function skipLeft<T>(skip: Parser<unknown>, keep: Parser<T>): Parser<T> {
  return (input: string): ParseResult<T> => {
    const skipResult = skip(input);
    if (!skipResult.success) return { success: false, error: skipResult.error };
    return keep(skipResult.rest ?? '');
  };
}

/** Run both parsers; return the left result and discard the right. */
export function skipRight<T>(keep: Parser<T>, skip: Parser<unknown>): Parser<T> {
  return (input: string): ParseResult<T> => {
    const keepResult = keep(input);
    if (!keepResult.success) return { success: false, error: keepResult.error };

    const skipResult = skip(keepResult.rest ?? '');
    if (!skipResult.success) return { success: false, error: skipResult.error };

    return { success: true, value: keepResult.value, rest: skipResult.rest };
  };
}
