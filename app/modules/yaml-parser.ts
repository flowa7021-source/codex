// @ts-check
// ─── YAML Parser (subset) ─────────────────────────────────────────────────────
// A lightweight YAML parser that handles the most common YAML patterns:
//   • scalars: strings, numbers, booleans, null
//   • quoted strings (single and double, with escape sequences in double)
//   • block scalars: literal (|) and folded (>)
//   • sequences (block form with "- " and inline [])
//   • mappings (block form "key: value" and inline {})
//   • comments (# …)
//   • multi-document files are NOT supported (only first document)

// ─── Public Error type ────────────────────────────────────────────────────────

/** Thrown when the YAML input cannot be parsed. */
export class YAMLError extends Error {
  line: number;
  column: number;

  constructor(message: string, line: number, column: number) {
    super(`YAMLError at line ${line}, column ${column}: ${message}`);
    this.name = 'YAMLError';
    this.line = line;
    this.column = column;
  }
}

// ─── Internal scanner types ───────────────────────────────────────────────────

interface Line {
  /** 1-based line number */
  no: number;
  /** Raw content (comments stripped, trailing whitespace trimmed) */
  text: string;
  /** Number of leading spaces (indentation) */
  indent: number;
  /** Whether this line is completely empty (or was comment-only) */
  empty: boolean;
}

// ─── Preprocessing ────────────────────────────────────────────────────────────

/** Split raw input into structured Line objects. */
function splitLines(input: string): Line[] {
  const rawLines = input.split(/\r?\n/);
  return rawLines.map((raw, i) => {
    // Strip inline comments that are NOT inside strings.
    // We do a simple approach: only strip " # …" that appears outside quotes.
    const text = stripComment(raw).trimEnd();
    const indent = text.length - text.trimStart().length;
    return {
      no: i + 1,
      text,
      indent,
      empty: text.trim().length === 0,
    };
  });
}

/** Remove a trailing inline comment from a line, respecting quoted regions. */
function stripComment(raw: string): string {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
    } else if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
    } else if (ch === '#' && !inSingle && !inDouble) {
      // Inline comment only if preceded by whitespace (or at start)
      if (i === 0 || raw[i - 1] === ' ' || raw[i - 1] === '\t') {
        return raw.slice(0, i);
      }
    }
  }
  return raw;
}

// ─── Scalar coercion ──────────────────────────────────────────────────────────

/** Coerce an unquoted scalar string to the appropriate JS value. */
function coerceScalar(raw: string): unknown {
  const s = raw.trim();
  if (s === 'null' || s === '~' || s === '') return null;
  if (s === 'true' || s === 'True' || s === 'TRUE') return true;
  if (s === 'false' || s === 'False' || s === 'FALSE') return false;
  // Integer
  if (/^-?(?:0|[1-9]\d*)$/.test(s)) return Number(s);
  // Float
  if (/^-?(?:\d+\.\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(s)) return Number(s);
  if (s === '.inf' || s === '.Inf' || s === '.INF') return Infinity;
  if (s === '-.inf' || s === '-.Inf' || s === '-.INF') return -Infinity;
  if (s === '.nan' || s === '.NaN' || s === '.NAN') return NaN;
  // Hex / octal integers
  if (/^0x[0-9a-fA-F]+$/.test(s)) return parseInt(s, 16);
  if (/^0o[0-7]+$/.test(s)) return parseInt(s.slice(2), 8);
  return s;
}

/** Parse a double-quoted string, handling \n \t \\ \" \uXXXX escapes. */
function parseDoubleQuoted(s: string): string {
  let result = '';
  let i = 0;
  while (i < s.length) {
    if (s[i] === '\\') {
      i++;
      switch (s[i]) {
        case 'n':  result += '\n'; break;
        case 't':  result += '\t'; break;
        case 'r':  result += '\r'; break;
        case '\\': result += '\\'; break;
        case '"':  result += '"'; break;
        case '0':  result += '\0'; break;
        case 'u': {
          const hex = s.slice(i + 1, i + 5);
          result += String.fromCharCode(parseInt(hex, 16));
          i += 4;
          break;
        }
        default: result += s[i];
      }
    } else {
      result += s[i];
    }
    i++;
  }
  return result;
}

/** Parse a single-quoted string (only '' escape for literal '). */
function parseSingleQuoted(s: string): string {
  return s.replace(/''/g, "'");
}

/**
 * Parse an inline scalar value (may be quoted, unquoted, or a flow
 * collection started inline). Returns the parsed value.
 * Does NOT handle flow collections here — those are handled by parseInline.
 */
function parseScalarValue(raw: string): unknown {
  const s = raw.trim();
  if (s.startsWith('"')) {
    const inner = s.slice(1, s.endsWith('"') ? -1 : s.length);
    return parseDoubleQuoted(inner);
  }
  if (s.startsWith("'")) {
    const inner = s.slice(1, s.endsWith("'") ? -1 : s.length);
    return parseSingleQuoted(inner);
  }
  return coerceScalar(s);
}

// ─── Inline (flow) parser ─────────────────────────────────────────────────────

/**
 * Parse a YAML flow value (scalar, [], or {}) starting at position `pos`
 * in `text`. Returns [value, endPosition].
 */
function parseInline(text: string, pos: number): [unknown, number] {
  const ch = text[pos];

  // Flow sequence
  if (ch === '[') {
    return parseInlineArray(text, pos);
  }

  // Flow mapping
  if (ch === '{') {
    return parseInlineObject(text, pos);
  }

  // Double-quoted string
  if (ch === '"') {
    let i = pos + 1;
    while (i < text.length) {
      if (text[i] === '\\') { i += 2; continue; }
      if (text[i] === '"') { i++; break; }
      i++;
    }
    return [parseDoubleQuoted(text.slice(pos + 1, i - 1)), i];
  }

  // Single-quoted string
  if (ch === "'") {
    let i = pos + 1;
    while (i < text.length) {
      if (text[i] === "'" && text[i + 1] === "'") { i += 2; continue; }
      if (text[i] === "'") { i++; break; }
      i++;
    }
    return [parseSingleQuoted(text.slice(pos + 1, i - 1)), i];
  }

  // Unquoted scalar — read until , ] } or end
  let i = pos;
  while (i < text.length && text[i] !== ',' && text[i] !== ']' && text[i] !== '}') {
    i++;
  }
  return [coerceScalar(text.slice(pos, i)), i];
}

function parseInlineArray(text: string, pos: number): [unknown[], number] {
  const result: unknown[] = [];
  let i = pos + 1; // skip '['
  while (i < text.length) {
    // skip whitespace and commas
    while (i < text.length && (text[i] === ' ' || text[i] === '\t' || text[i] === ',')) i++;
    if (text[i] === ']') { i++; break; }
    const [val, end] = parseInline(text, i);
    result.push(val);
    i = end;
  }
  return [result, i];
}

function parseInlineObject(text: string, pos: number): [Record<string, unknown>, number] {
  const result: Record<string, unknown> = {};
  let i = pos + 1; // skip '{'
  while (i < text.length) {
    while (i < text.length && (text[i] === ' ' || text[i] === '\t' || text[i] === ',')) i++;
    if (text[i] === '}') { i++; break; }
    // parse key
    const [key, keyEnd] = parseInline(text, i);
    i = keyEnd;
    // skip ': '
    while (i < text.length && (text[i] === ':' || text[i] === ' ')) i++;
    const [val, valEnd] = parseInline(text, i);
    result[String(key)] = val;
    i = valEnd;
  }
  return [result, i];
}

// ─── Block parser ─────────────────────────────────────────────────────────────

/**
 * Parse block lines starting at `start` with indentation >= `minIndent`.
 * Returns [value, nextLineIndex].
 */
function parseBlock(lines: Line[], start: number, minIndent: number): [unknown, number] {
  // Skip empty lines at start
  while (start < lines.length && lines[start].empty) start++;
  if (start >= lines.length) return [null, start];

  const firstLine = lines[start];

  // ── Block sequence ─────────────────────────────────────────────────────────
  if (firstLine.text.trimStart().startsWith('- ') || firstLine.text.trimStart() === '-') {
    return parseBlockSequence(lines, start, firstLine.indent);
  }

  // ── Block mapping ──────────────────────────────────────────────────────────
  if (isKeyLine(firstLine.text)) {
    return parseBlockMapping(lines, start, firstLine.indent);
  }

  // ── Scalar ─────────────────────────────────────────────────────────────────
  return [parseScalarValue(firstLine.text.trimStart()), start + 1];
}

/** Return true if the (trimmed) line looks like a mapping key. */
function isKeyLine(text: string): boolean {
  const t = text.trimStart();
  // Check for "key:" or "key: value" but not "- key:" mistaken as key
  // A key line is "word: …" or "'…': …" or '"…": …'
  // Use a simple heuristic: find an unquoted colon not at position 0
  return findMappingColon(t) > 0;
}

/**
 * Find the position of the mapping colon in a trimmed line.
 * Returns -1 if none found.
 */
function findMappingColon(t: string): number {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (ch === "'" && !inDouble) inSingle = !inSingle;
    else if (ch === '"' && !inSingle) inDouble = !inDouble;
    else if (ch === ':' && !inSingle && !inDouble) {
      // Must be followed by space, newline, or end of string
      if (i + 1 === t.length || t[i + 1] === ' ' || t[i + 1] === '\t') {
        return i;
      }
    }
  }
  return -1;
}

/** Parse a block sequence starting at line `start` with indentation `seqIndent`. */
function parseBlockSequence(lines: Line[], start: number, seqIndent: number): [unknown[], number] {
  const result: unknown[] = [];
  let i = start;

  while (i < lines.length) {
    const line = lines[i];
    if (line.empty) { i++; continue; }
    if (line.indent < seqIndent) break;
    if (line.indent > seqIndent) break; // indent increased without '- ' — shouldn't happen here

    const trimmed = line.text.trimStart();
    if (!trimmed.startsWith('-')) break;

    // The value after "- "
    const rest = trimmed.slice(1);
    if (rest === '' || rest === ' ' || rest.trimStart() === '') {
      // Value is on the next line(s) — parse as nested block
      i++;
      while (i < lines.length && lines[i].empty) i++;
      if (i < lines.length && lines[i].indent > seqIndent) {
        const [val, nextI] = parseBlock(lines, i, lines[i].indent);
        result.push(val);
        i = nextI;
      } else {
        result.push(null);
      }
    } else {
      const valueText = rest.trimStart();
      // Block scalar indicators
      if (valueText === '|' || valueText === '>') {
        const [blockVal, nextI] = parseBlockScalar(lines, i + 1, seqIndent + 2, valueText === '>');
        result.push(blockVal);
        i = nextI;
      } else if (valueText.startsWith('[') || valueText.startsWith('{')) {
        const [inlineVal] = parseInline(valueText, 0);
        result.push(inlineVal);
        i++;
      } else if (isKeyLine(valueText)) {
        // Nested mapping inline after '- '
        const nestedLines: Line[] = [{ no: line.no, text: ' '.repeat(seqIndent + 2) + valueText, indent: seqIndent + 2, empty: false }];
        i++;
        // Collect continuation lines
        while (i < lines.length && (lines[i].empty || lines[i].indent > seqIndent)) {
          nestedLines.push(lines[i]);
          i++;
        }
        const [nestedVal] = parseBlock(nestedLines, 0, seqIndent + 2);
        result.push(nestedVal);
      } else {
        result.push(parseScalarValue(valueText));
        i++;
      }
    }
  }
  return [result, i];
}

/** Parse a block mapping starting at line `start` with indentation `mapIndent`. */
function parseBlockMapping(
  lines: Line[],
  start: number,
  mapIndent: number,
): [Record<string, unknown>, number] {
  const result: Record<string, unknown> = {};
  let i = start;

  while (i < lines.length) {
    const line = lines[i];
    if (line.empty) { i++; continue; }
    if (line.indent < mapIndent) break;
    if (line.indent > mapIndent) break;

    const trimmed = line.text.trimStart();
    const colonPos = findMappingColon(trimmed);
    if (colonPos < 0) break;

    const rawKey = trimmed.slice(0, colonPos);
    const key = String(parseScalarValue(rawKey));
    const afterColon = trimmed.slice(colonPos + 1).trim();

    if (afterColon === '' || afterColon === null) {
      // Value on next block
      i++;
      while (i < lines.length && lines[i].empty) i++;
      if (i < lines.length && lines[i].indent > mapIndent) {
        const [val, nextI] = parseBlock(lines, i, lines[i].indent);
        result[key] = val;
        i = nextI;
      } else {
        result[key] = null;
      }
    } else if (afterColon === '|' || afterColon === '>') {
      const [blockVal, nextI] = parseBlockScalar(lines, i + 1, mapIndent + 2, afterColon === '>');
      result[key] = blockVal;
      i = nextI;
    } else if (afterColon.startsWith('[') || afterColon.startsWith('{')) {
      const [inlineVal] = parseInline(afterColon, 0);
      result[key] = inlineVal;
      i++;
    } else {
      result[key] = parseScalarValue(afterColon);
      i++;
    }
  }
  return [result, i];
}

/**
 * Parse a literal (|) or folded (>) block scalar.
 * Lines must have indentation >= `blockIndent`.
 */
function parseBlockScalar(
  lines: Line[],
  start: number,
  blockIndent: number,
  folded: boolean,
): [string, number] {
  const contentLines: string[] = [];
  let i = start;

  // Determine actual indentation from first non-empty line
  let actualIndent = blockIndent;
  for (let j = i; j < lines.length; j++) {
    if (!lines[j].empty) {
      actualIndent = lines[j].indent;
      break;
    }
  }

  while (i < lines.length) {
    const line = lines[i];
    if (line.empty) {
      contentLines.push('');
      i++;
      continue;
    }
    if (line.indent < actualIndent) break;
    contentLines.push(line.text.slice(actualIndent));
    i++;
  }

  // Remove trailing empty lines
  while (contentLines.length > 0 && contentLines[contentLines.length - 1] === '') {
    contentLines.pop();
  }

  let result: string;
  if (folded) {
    // Fold: join consecutive non-empty lines with space, empty lines become newline
    result = contentLines.reduce((acc: string, line: string, idx: number) => {
      if (idx === 0) return line;
      if (line === '' || contentLines[idx - 1] === '') return acc + '\n' + line;
      return acc + ' ' + line;
    }, '');
  } else {
    result = contentLines.join('\n');
  }
  return [result + '\n', i];
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Parse a YAML string into a JavaScript value.
 * Throws `YAMLError` on syntax errors.
 */
export function parseYAML(input: string): unknown {
  if (typeof input !== 'string') {
    throw new YAMLError('Input must be a string', 1, 1);
  }

  // Strip document start/end markers
  const stripped = input.replace(/^---\s*\n?/, '').replace(/\n?\.\.\.\s*$/, '');
  const lines = splitLines(stripped);

  // Skip leading empty lines
  let start = 0;
  while (start < lines.length && lines[start].empty) start++;

  if (start >= lines.length) return null;

  try {
    const [value] = parseBlock(lines, start, 0);
    return value;
  } catch (e) {
    if (e instanceof YAMLError) throw e;
    throw new YAMLError(String(e), 1, 1);
  }
}

// ─── Stringifier ─────────────────────────────────────────────────────────────

/**
 * Convert a JavaScript value to a YAML string.
 * `indent` controls the number of spaces per indentation level (default 2).
 */
export function stringifyYAML(value: unknown, indent = 2): string {
  return stringifyValue(value, 0, indent) + '\n';
}

function stringifyValue(value: unknown, depth: number, indentSize: number): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (Number.isNaN(value)) return '.nan';
    if (!Number.isFinite(value)) return value > 0 ? '.inf' : '-.inf';
    return String(value);
  }
  if (typeof value === 'string') return stringifyString(value);
  if (Array.isArray(value)) return stringifyArray(value, depth, indentSize);
  if (typeof value === 'object') return stringifyObject(value as Record<string, unknown>, depth, indentSize);
  return String(value);
}

function stringifyString(s: string): string {
  // Determine if quoting is necessary
  const needsQuoting =
    s === '' ||
    s === 'null' || s === '~' ||
    s === 'true' || s === 'false' ||
    s === 'True' || s === 'False' ||
    /^-?(?:0|[1-9]\d*)$/.test(s) ||
    /^-?(?:\d+\.\d*|\.\d+)/.test(s) ||
    s.startsWith('#') ||
    s.startsWith('-') ||
    s.startsWith(':') ||
    s.includes('\n') ||
    s.includes(': ') ||
    s.includes(' #');

  if (!needsQuoting) return s;
  if (s.includes('\n')) {
    // Use literal block scalar
    const lines = s.split('\n');
    // Remove trailing newline for display
    const last = lines[lines.length - 1] === '' ? lines.slice(0, -1) : lines;
    return '|\n' + last.map((l) => '  ' + l).join('\n');
  }
  // Double-quoted, escaping special characters
  const escaped = s
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t')
    .replace(/\r/g, '\\r');
  return `"${escaped}"`;
}

function stringifyArray(arr: unknown[], depth: number, indentSize: number): string {
  if (arr.length === 0) return '[]';
  const pad = ' '.repeat(depth * indentSize);
  return arr
    .map((item) => {
      const val = stringifyValue(item, depth + 1, indentSize);
      // If val is multiline (nested object/array), indent it
      if (val.includes('\n')) {
        const lines = val.split('\n');
        return `${pad}- ${lines[0]}\n${lines.slice(1).map((l) => (l ? `${pad}  ${l}` : '')).join('\n')}`;
      }
      return `${pad}- ${val}`;
    })
    .join('\n');
}

function stringifyObject(obj: Record<string, unknown>, depth: number, indentSize: number): string {
  const keys = Object.keys(obj);
  if (keys.length === 0) return '{}';
  const pad = ' '.repeat(depth * indentSize);
  return keys
    .map((key) => {
      const k = stringifyString(key);
      const val = stringifyValue(obj[key], depth + 1, indentSize);
      if (val.includes('\n')) {
        const lines = val.split('\n');
        // Block scalar or nested block
        if (val.startsWith('|') || val.startsWith('>')) {
          return `${pad}${k}: ${lines[0]}\n${lines.slice(1).map((l) => (l ? `${pad}  ${l}` : '')).join('\n')}`;
        }
        return `${pad}${k}:\n${lines.map((l) => (l ? `${pad}${' '.repeat(indentSize)}${l}` : '')).join('\n')}`;
      }
      return `${pad}${k}: ${val}`;
    })
    .join('\n');
}
