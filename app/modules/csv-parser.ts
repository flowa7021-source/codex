// @ts-check
// ─── CSV Parser & Formatter ──────────────────────────────────────────────────
// A zero-dependency CSV parsing and formatting library that handles RFC 4180
// features: quoted fields, embedded commas, embedded newlines, escaped quotes.

// ─── Types ────────────────────────────────────────────────────────────────────

/** Options controlling how a CSV string is parsed. */
export interface ParseOptions {
  /** Field delimiter character. Default: `','` */
  delimiter?: string;
  /** Quote character used to wrap fields with special characters. Default: `'"'` */
  quote?: string;
  /** Escape character inside quoted fields (doubling). Default: `'"'` */
  escape?: string;
  /** Treat the first row as column headers. Default: `true` */
  header?: boolean;
  /** Skip rows that are entirely empty. Default: `true` */
  skipEmpty?: boolean;
  /** Trim leading/trailing whitespace from each field value. Default: `false` */
  trim?: boolean;
}

/** Options controlling how data is serialised to a CSV string. */
export interface StringifyOptions {
  /** Field delimiter character. Default: `','` */
  delimiter?: string;
  /** Quote character. Default: `'"'` */
  quote?: string;
  /** Include a header row derived from object keys. Default: `true` */
  header?: boolean;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Core tokeniser: parse a CSV string into a 2-D array of raw string fields.
 * Handles quoted fields with embedded commas, newlines and escaped quotes.
 * Supports both CRLF and LF line endings and configurable delimiter/quote.
 */
function tokenise(
  input: string,
  delimiter: string,
  quote: string,
  trimFields: boolean,
  skipEmpty: boolean,
): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  while (i < input.length) {
    const ch = input[i];

    if (inQuotes) {
      if (ch === quote) {
        if (input[i + 1] === quote) {
          // RFC 4180 doubled-quote escape
          field += quote;
          i += 2;
        } else {
          // Closing quote
          inQuotes = false;
          i++;
        }
      } else {
        field += ch;
        i++;
      }
    } else {
      if (ch === quote) {
        inQuotes = true;
        i++;
      } else if (input.startsWith(delimiter, i)) {
        row.push(trimFields ? field.trim() : field);
        field = '';
        i += delimiter.length;
      } else if (ch === '\r' && input[i + 1] === '\n') {
        row.push(trimFields ? field.trim() : field);
        rows.push(row);
        row = [];
        field = '';
        i += 2;
      } else if (ch === '\n') {
        row.push(trimFields ? field.trim() : field);
        rows.push(row);
        row = [];
        field = '';
        i++;
      } else {
        field += ch;
        i++;
      }
    }
  }

  // Push the final field / row
  row.push(trimFields ? field.trim() : field);
  if (row.length > 1 || row[0] !== '' || rows.length === 0) {
    rows.push(row);
  }

  if (skipEmpty) {
    return rows.filter((r) => !(r.length === 1 && r[0] === ''));
  }
  return rows;
}

/** Quote a single field value if it contains special characters. */
function quoteField(
  value: string,
  delimiter: string,
  quote: string,
): string {
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

// ─── parse ────────────────────────────────────────────────────────────────────

/**
 * Parse a CSV string into an array of objects keyed by the header row.
 *
 * When `options.header` is `false` the function still returns
 * `Record<string, string>[]` for API consistency — the objects will have
 * numeric-string keys (`"0"`, `"1"`, …).
 */
export function parse(
  csv: string,
  options?: ParseOptions,
): Record<string, string>[] {
  if (csv === '') return [];

  const delimiter = options?.delimiter ?? ',';
  const quote = options?.quote ?? '"';
  const header = options?.header ?? true;
  const skipEmpty = options?.skipEmpty ?? true;
  const trim = options?.trim ?? false;

  const rows = tokenise(csv, delimiter, quote, trim, skipEmpty);
  if (rows.length === 0) return [];

  if (!header) {
    return rows.map((row) => {
      const obj: Record<string, string> = {};
      row.forEach((val, idx) => {
        obj[String(idx)] = val;
      });
      return obj;
    });
  }

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

// ─── parseRows ────────────────────────────────────────────────────────────────

/**
 * Parse a CSV string into a 2-D array of strings.  Every row (including the
 * first) is returned as-is — no header processing is performed.
 */
export function parseRows(
  csv: string,
  options?: Omit<ParseOptions, 'header'>,
): string[][] {
  if (csv === '') return [];

  const delimiter = options?.delimiter ?? ',';
  const quote = options?.quote ?? '"';
  const skipEmpty = options?.skipEmpty ?? true;
  const trim = options?.trim ?? false;

  return tokenise(csv, delimiter, quote, trim, skipEmpty);
}

// ─── stringify ────────────────────────────────────────────────────────────────

/**
 * Serialise an array of objects to a CSV string.
 * Column order is determined by the keys of the first object.
 */
export function stringify(
  data: Record<string, unknown>[],
  options?: StringifyOptions,
): string {
  const delimiter = options?.delimiter ?? ',';
  const quote = options?.quote ?? '"';
  const includeHeader = options?.header ?? true;

  if (data.length === 0) return '';

  const headers = Object.keys(data[0]);
  const lines: string[] = [];

  if (includeHeader) {
    lines.push(
      headers
        .map((h) => quoteField(String(h), delimiter, quote))
        .join(delimiter),
    );
  }

  for (const obj of data) {
    const row = headers.map((h) =>
      quoteField(obj[h] == null ? '' : String(obj[h]), delimiter, quote),
    );
    lines.push(row.join(delimiter));
  }

  return lines.join('\n');
}

// ─── stringifyRows ────────────────────────────────────────────────────────────

/**
 * Serialise a 2-D array of values (and an optional header row) to a CSV string.
 */
export function stringifyRows(
  rows: unknown[][],
  headers?: string[],
  options?: Omit<StringifyOptions, 'header'>,
): string {
  const delimiter = options?.delimiter ?? ',';
  const quote = options?.quote ?? '"';

  const lines: string[] = [];

  if (headers && headers.length > 0) {
    lines.push(
      headers
        .map((h) => quoteField(String(h), delimiter, quote))
        .join(delimiter),
    );
  }

  for (const row of rows) {
    const serialised = row.map((cell) =>
      quoteField(cell == null ? '' : String(cell), delimiter, quote),
    );
    lines.push(serialised.join(delimiter));
  }

  return lines.join('\n');
}

// ─── detectDelimiter ─────────────────────────────────────────────────────────

/**
 * Heuristically detect the delimiter used in a CSV string.
 * Inspects only the first non-empty line and counts occurrences of each
 * candidate character outside of quoted sections.
 *
 * Returns one of `','`, `';'`, `'\t'`, or `'|'`.  Falls back to `','` if
 * no candidate is found.
 */
export function detectDelimiter(csv: string): string {
  const candidates = [',', ';', '\t', '|'] as const;

  // Take the first meaningful line for analysis
  const firstLine = csv.split(/\r?\n/).find((l) => l.trim() !== '') ?? '';

  const counts: Record<string, number> = { ',': 0, ';': 0, '\t': 0, '|': 0 };
  let inQuote = false;

  for (let i = 0; i < firstLine.length; i++) {
    const ch = firstLine[i];
    if (ch === '"') {
      inQuote = !inQuote;
    } else if (!inQuote) {
      if (ch in counts) counts[ch]++;
    }
  }

  let best: string = ',';
  let bestCount = -1;
  for (const c of candidates) {
    if (counts[c] > bestCount) {
      bestCount = counts[c];
      best = c;
    }
  }

  return best;
}

// ─── countRows ────────────────────────────────────────────────────────────────

/**
 * Count the number of data rows in a CSV string without fully parsing every
 * field.  When `options.header` is `true` (the default) the header row is
 * excluded from the count.
 */
export function countRows(csv: string, options?: ParseOptions): number {
  if (csv === '') return 0;

  const quote = options?.quote ?? '"';
  const header = options?.header ?? true;
  const skipEmpty = options?.skipEmpty ?? true;

  // We only need row boundaries — use the tokeniser and count
  const delimiter = options?.delimiter ?? ',';
  const rows = tokenise(csv, delimiter, quote, false, skipEmpty);

  let count = rows.length;

  // Subtract the header row if applicable
  if (header && count > 0) count--;

  return count;
}
