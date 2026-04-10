// @ts-check
// ─── CSV Parser ──────────────────────────────────────────────────────────────
// CSV parsing and generation utilities.

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CSVParseOptions {
  delimiter?: string;       // default ','
  quote?: string;           // default '"'
  hasHeader?: boolean;      // default true
  skipEmptyLines?: boolean; // default true
  trim?: boolean;           // default false
}

/** Options for the new parseCsv / serializeCsv API. */
export interface CsvOptions {
  /** Field delimiter (default: ','). */
  delimiter?: string;
  /** Quote character (default: '"'). */
  quote?: string;
  /** Escape character inside quoted fields (default: same as quote). */
  escape?: string;
  /** Whether the first row is a header row (default: true). */
  header?: boolean;
  /** Trim whitespace from unquoted field values (default: false). */
  trim?: boolean;
}

export interface CSVParseResult {
  headers: string[];
  rows: string[][];
  records: Record<string, string>[];
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Parse a CSV string into rows and records.
 */
export function parseCSV(text: string, options?: CSVParseOptions): CSVParseResult {
  const delimiter = options?.delimiter ?? ',';
  const quote = options?.quote ?? '"';
  const hasHeader = options?.hasHeader ?? true;
  const skipEmptyLines = options?.skipEmptyLines ?? true;
  const trim = options?.trim ?? false;

  const rawLines = splitLines(text, quote, delimiter);

  const lines = skipEmptyLines
    ? rawLines.filter((line) => line.trim().length > 0)
    : rawLines;

  const parsedRows: string[][] = lines.map((line) => {
    const fields = parseCSVLine(line, delimiter, quote);
    return trim ? fields.map((f) => f.trim()) : fields;
  });

  if (parsedRows.length === 0) {
    return { headers: [], rows: [], records: [] };
  }

  let headers: string[] = [];
  let dataRows: string[][];

  if (hasHeader) {
    headers = parsedRows[0];
    dataRows = parsedRows.slice(1);
  } else {
    dataRows = parsedRows;
  }

  const records: Record<string, string>[] = dataRows.map((row) => {
    const record: Record<string, string> = {};
    headers.forEach((header, i) => {
      record[header] = row[i] ?? '';
    });
    return record;
  });

  return { headers, rows: dataRows, records };
}

/**
 * Generate a CSV string from an array of records.
 */
export function generateCSV(
  records: Record<string, unknown>[],
  options?: { delimiter?: string; quote?: string },
): string {
  if (records.length === 0) return '';

  const delimiter = options?.delimiter ?? ',';
  const quote = options?.quote ?? '"';

  const headers = Object.keys(records[0]);
  const headerLine = headers
    .map((h) => quoteField(String(h), delimiter, quote))
    .join(delimiter);

  const dataLines = records.map((record) =>
    headers
      .map((h) => quoteField(String(record[h] ?? ''), delimiter, quote))
      .join(delimiter),
  );

  return [headerLine, ...dataLines].join('\n');
}

/**
 * Parse a single CSV line into fields.
 */
export function parseCSVLine(line: string, delimiter = ',', quote = '"'): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const ch = line[i];

    if (inQuotes) {
      if (ch === quote) {
        // Check for escaped quote (doubled quote)
        if (i + 1 < line.length && line[i + 1] === quote) {
          current += quote;
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        current += ch;
        i++;
      }
    } else {
      if (ch === quote) {
        inQuotes = true;
        i++;
      } else if (line.slice(i, i + delimiter.length) === delimiter) {
        fields.push(current);
        current = '';
        i += delimiter.length;
      } else {
        current += ch;
        i++;
      }
    }
  }

  fields.push(current);
  return fields;
}

/**
 * Check if a string needs quoting in CSV.
 */
export function needsQuoting(value: string, delimiter = ','): boolean {
  return (
    value.includes(delimiter) ||
    value.includes('"') ||
    value.includes('\n') ||
    value.includes('\r')
  );
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Split CSV text into logical lines, respecting quoted fields that may
 * contain embedded newlines.
 */
function splitLines(text: string, quote: string, _delimiter: string): string[] {
  const lines: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (ch === quote) {
      // Doubled quote inside quotes = escaped quote
      if (inQuotes && i + 1 < text.length && text[i + 1] === quote) {
        current += ch + ch;
        i++;
      } else {
        inQuotes = !inQuotes;
        current += ch;
      }
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      // Skip \r\n as a single line ending
      if (ch === '\r' && i + 1 < text.length && text[i + 1] === '\n') {
        i++;
      }
      lines.push(current);
      current = '';
    } else {
      current += ch;
    }
  }

  if (current.length > 0 || text.endsWith('\n') || text.endsWith('\r')) {
    lines.push(current);
  }

  return lines;
}

/**
 * Quote a field value if necessary.
 */
function quoteField(value: string, delimiter: string, quote: string): string {
  if (needsQuoting(value, delimiter)) {
    const escaped = value.split(quote).join(quote + quote);
    return quote + escaped + quote;
  }
  return value;
}

// ─── New parseCsv / serializeCsv API ─────────────────────────────────────────

function resolveCsvOptions(options?: CsvOptions): Required<CsvOptions> {
  return {
    delimiter: options?.delimiter ?? ',',
    quote:     options?.quote     ?? '"',
    escape:    options?.escape    ?? (options?.quote ?? '"'),
    header:    options?.header    ?? true,
    trim:      options?.trim      ?? false,
  };
}

/**
 * Core tokeniser: parse a CSV string into a 2-D array of raw string fields.
 * Handles quoted fields with embedded commas, newlines and escaped quotes.
 * Supports both CRLF and LF line endings and configurable delimiter/quote/escape.
 */
function tokeniseCsv(input: string, opts: Required<CsvOptions>): string[][] {
  const { delimiter, quote, escape } = opts;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  while (i < input.length) {
    const ch = input[i];

    if (inQuotes) {
      if (ch === escape && escape !== quote && input[i + 1] === quote) {
        // Backslash-style escape followed by quote
        field += quote;
        i += 2;
      } else if (ch === quote) {
        if (escape === quote && input[i + 1] === quote) {
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
        row.push(opts.trim ? field.trim() : field);
        field = '';
        i += delimiter.length;
      } else if (ch === '\r' && input[i + 1] === '\n') {
        row.push(opts.trim ? field.trim() : field);
        rows.push(row);
        row = [];
        field = '';
        i += 2;
      } else if (ch === '\n') {
        row.push(opts.trim ? field.trim() : field);
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
  row.push(opts.trim ? field.trim() : field);
  if (row.length > 1 || row[0] !== '' || rows.length === 0) {
    rows.push(row);
  }

  return rows;
}

/** Quote a field for the new API (uses opts object). */
function quoteFieldNew(value: string, opts: Required<CsvOptions>): string {
  const { delimiter, quote, escape } = opts;
  const needsQ =
    value.includes(delimiter) ||
    value.includes(quote) ||
    value.includes('\n') ||
    value.includes('\r');

  if (!needsQ) return value;
  const escaped = value.split(quote).join(escape + quote);
  return `${quote}${escaped}${quote}`;
}

/**
 * Parse a CSV string into a 2-D array of string fields (rows × fields).
 * The first row is NOT treated specially — use parseCsvWithHeaders for that.
 */
export function parseCsv(input: string, options?: CsvOptions): string[][] {
  if (input === '') return [];
  const opts = resolveCsvOptions(options);
  return tokeniseCsv(input, opts);
}

/**
 * Parse a CSV string where the first row contains column headers.
 * Returns an array of objects mapping header name → field value.
 */
export function parseCsvWithHeaders(
  input: string,
  options?: CsvOptions,
): Record<string, string>[] {
  if (input === '') return [];
  const opts = resolveCsvOptions(options);
  const rows = tokeniseCsv(input, opts);
  if (rows.length === 0) return [];

  const headers = rows[0];
  const result: Record<string, string>[] = [];
  for (let r = 1; r < rows.length; r++) {
    const obj: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      obj[headers[c]] = rows[r][c] ?? '';
    }
    result.push(obj);
  }
  return result;
}

/**
 * Serialize a 2-D array of string fields into a CSV string.
 * Fields are quoted automatically when they contain special characters.
 */
export function serializeCsv(rows: string[][], options?: CsvOptions): string {
  const opts = resolveCsvOptions(options);
  return rows
    .map((row) => row.map((f) => quoteFieldNew(f, opts)).join(opts.delimiter))
    .join('\n');
}

/**
 * Serialize an array of objects into a CSV string, including a header row.
 * Column order is determined by the keys of the first object.
 */
export function serializeCsvWithHeaders(
  rows: Record<string, string>[],
  options?: CsvOptions,
): string {
  const opts = resolveCsvOptions(options);
  if (rows.length === 0) return '';

  const headers = Object.keys(rows[0]);
  const headerLine = headers.map((h) => quoteFieldNew(h, opts)).join(opts.delimiter);
  const dataLines = rows.map((row) =>
    headers.map((h) => quoteFieldNew(row[h] ?? '', opts)).join(opts.delimiter),
  );
  return [headerLine, ...dataLines].join('\n');
}

// ─── CsvBuilder ───────────────────────────────────────────────────────────────

/** Fluent builder for constructing CSV output row-by-row. */
export class CsvBuilder {
  private _headers: string[];
  private _rows: Record<string, string>[];

  constructor(headers: string[]) {
    this._headers = headers;
    this._rows = [];
  }

  /** Append a row and return `this` for chaining. */
  addRow(values: Record<string, string>): CsvBuilder {
    this._rows.push(values);
    return this;
  }

  /** Serialize all accumulated rows into a CSV string (header row included). */
  build(options?: CsvOptions): string {
    const opts = resolveCsvOptions(options);
    const headerLine = this._headers
      .map((h) => quoteFieldNew(h, opts))
      .join(opts.delimiter);
    const dataLines = this._rows.map((row) =>
      this._headers.map((h) => quoteFieldNew(row[h] ?? '', opts)).join(opts.delimiter),
    );
    return [headerLine, ...dataLines].join('\n');
  }

  /** Number of data rows added so far (not counting the header). */
  get rowCount(): number {
    return this._rows.length;
  }
}
