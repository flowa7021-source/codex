// @ts-check
// ─── CSV Parser & Serializer ─────────────────────────────────────────────────
// RFC 4180-compatible CSV parser and serializer with support for custom
// delimiters, quoting, escaping, header rows, and stream-like line parsing.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ParseOptions {
  /** Field delimiter. Default: `','` */
  delimiter?: string;
  /** Quote character. Default: `'"'` */
  quote?: string;
  /** Escape character for quotes inside quoted fields. Default: `'"'` (doubled-quote) */
  escape?: string;
  /** Treat the first row as column headers. Default: `true` */
  hasHeader?: boolean;
  /** Skip blank lines. Default: `true` */
  skipEmptyLines?: boolean;
  /** Trim whitespace from unquoted field values. Default: `false` */
  trimValues?: boolean;
}

export interface SerializeOptions {
  /** Field delimiter. Default: `','` */
  delimiter?: string;
  /** Quote character. Default: `'"'` */
  quote?: string;
  /** Column headers to use when serializing an array of objects. */
  headers?: string[];
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Core tokeniser: parse a CSV string into a 2-D array of raw string fields.
 * Handles quoted fields with embedded commas, newlines, and escaped quotes.
 * Supports both CRLF and LF line endings and configurable delimiter/quote/escape.
 */
function tokenise(
  input: string,
  delimiter: string,
  quote: string,
  escape: string,
  trimFields: boolean,
  skipEmpty: boolean,
): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let fieldWasQuoted = false;
  let i = 0;

  const pushField = (): void => {
    // Only trim unquoted fields when trimFields is true
    row.push(trimFields && !fieldWasQuoted ? field.trim() : field);
    field = '';
    fieldWasQuoted = false;
  };

  while (i < input.length) {
    const ch = input[i];

    if (inQuotes) {
      // Inside a quoted field — check for escape sequences or closing quote
      if (ch === escape && escape === quote && input[i + 1] === quote) {
        // Doubled-quote escape: "" → "
        field += quote;
        i += 2;
      } else if (ch === escape && escape !== quote && input[i + 1] === quote) {
        // Backslash-style escape: \" → "
        field += quote;
        i += 2;
      } else if (ch === quote) {
        // Closing quote
        inQuotes = false;
        i++;
      } else {
        field += ch;
        i++;
      }
    } else {
      // Outside a quoted field
      if (ch === quote) {
        inQuotes = true;
        fieldWasQuoted = true;
        i++;
      } else if (input.startsWith(delimiter, i)) {
        pushField();
        i += delimiter.length;
      } else if (ch === '\r' && input[i + 1] === '\n') {
        // CRLF line ending
        pushField();
        rows.push(row);
        row = [];
        i += 2;
      } else if (ch === '\n') {
        // LF line ending
        pushField();
        rows.push(row);
        row = [];
        i++;
      } else {
        field += ch;
        i++;
      }
    }
  }

  // Push the final field / row
  pushField();
  if (row.length > 1 || row[0] !== '' || rows.length === 0) {
    rows.push(row);
  }

  if (skipEmpty) {
    return rows.filter((r) => !(r.length === 1 && r[0] === ''));
  }
  return rows;
}

/** Quote a single field value if it contains special characters. */
function quoteField(value: string, delimiter: string, quote: string): string {
  const needsQuoting =
    value.includes(delimiter) ||
    value.includes(quote) ||
    value.includes('\n') ||
    value.includes('\r');

  if (!needsQuoting) return value;

  // Escape existing quote characters by doubling them
  const escaped = value.split(quote).join(quote + quote);
  return `${quote}${escaped}${quote}`;
}

/** Resolve full parse options with defaults applied. */
function resolveParseOpts(options?: ParseOptions): Required<ParseOptions> {
  return {
    delimiter: options?.delimiter ?? ',',
    quote: options?.quote ?? '"',
    escape: options?.escape ?? '"',
    hasHeader: options?.hasHeader ?? true,
    skipEmptyLines: options?.skipEmptyLines ?? true,
    trimValues: options?.trimValues ?? false,
  };
}

/** Resolve full serialize options with defaults applied. */
function resolveSerializeOpts(options?: SerializeOptions): Required<SerializeOptions> {
  return {
    delimiter: options?.delimiter ?? ',',
    quote: options?.quote ?? '"',
    headers: options?.headers ?? [],
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Parse CSV string → array of row arrays (raw, no header handling).
 */
export function parseRaw(csv: string, options?: ParseOptions): string[][] {
  if (csv === '') return [];

  const opts = resolveParseOpts(options);
  return tokenise(
    csv,
    opts.delimiter,
    opts.quote,
    opts.escape,
    opts.trimValues,
    opts.skipEmptyLines,
  );
}

/**
 * Parse CSV string → array of objects (using first row as keys).
 */
export function parse(csv: string, options?: ParseOptions): Record<string, string>[] {
  if (csv === '') return [];

  const opts = resolveParseOpts(options);
  const rows = parseRaw(csv, opts);

  if (rows.length === 0) return [];

  const headers = rows[0];
  const result: Record<string, string>[] = [];

  for (let i = 1; i < rows.length; i++) {
    const obj: Record<string, string> = {};
    const row = rows[i];
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = row[j] ?? '';
    }
    result.push(obj);
  }

  return result;
}

/**
 * Parse CSV string → `{ headers: string[], rows: string[][] }`.
 * The first row becomes `headers`; subsequent rows become `rows`.
 */
export function parseWithHeaders(
  csv: string,
  options?: ParseOptions,
): { headers: string[]; rows: string[][] } {
  if (csv === '') return { headers: [], rows: [] };

  const rows = parseRaw(csv, options);

  if (rows.length === 0) return { headers: [], rows: [] };

  const [headers, ...dataRows] = rows;
  return { headers, rows: dataRows };
}

/**
 * Serialize array of string arrays → CSV string.
 */
export function serializeRaw(data: string[][], options?: SerializeOptions): string {
  const opts = resolveSerializeOpts(options);
  const { delimiter, quote } = opts;

  return data
    .map((row) =>
      row.map((field) => quoteField(field, delimiter, quote)).join(delimiter),
    )
    .join('\n');
}

/**
 * Serialize array of objects → CSV string (infers headers from first object).
 * If `options.headers` is provided, those column names are used (and in that order).
 */
export function serialize(
  data: Record<string, unknown>[],
  options?: SerializeOptions,
): string {
  if (data.length === 0) return '';

  const opts = resolveSerializeOpts(options);
  const headers = opts.headers.length > 0 ? opts.headers : Object.keys(data[0]);

  const rows: string[][] = [
    headers,
    ...data.map((obj) => headers.map((h) => (obj[h] == null ? '' : String(obj[h])))),
  ];

  return serializeRaw(rows, { delimiter: opts.delimiter, quote: opts.quote });
}

/**
 * Stream-like: parse CSV line by line.
 * Each element of `lines` is treated as a separate pre-split line.
 * Embedded newlines are not supported (use `parseRaw` for that).
 */
export function parseLines(lines: string[], options?: ParseOptions): string[][] {
  const opts = resolveParseOpts(options);
  const rows: string[][] = [];

  for (const line of lines) {
    if (opts.skipEmptyLines && line.trim() === '') {
      continue;
    }
    // Tokenise each line individually; result is always a single row
    const parsed = tokenise(
      line,
      opts.delimiter,
      opts.quote,
      opts.escape,
      opts.trimValues,
      false, // skipEmpty handled above
    );
    if (parsed.length > 0) {
      rows.push(parsed[0]);
    }
  }

  return rows;
}
