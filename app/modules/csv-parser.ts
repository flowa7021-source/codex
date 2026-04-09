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
