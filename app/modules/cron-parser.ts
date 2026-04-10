// @ts-check
// ─── Cron Expression Parser ──────────────────────────────────────────────────
// Parses 5-field cron expressions and tests Date objects against them.
// Supports: * */step a-b a-b/step comma lists month/weekday names.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CronField {
  type: 'all' | 'value' | 'range' | 'step' | 'list';
  values: number[];
}

export interface CronExpression {
  minute: CronField;
  hour: CronField;
  dayOfMonth: CronField;
  month: CronField;
  dayOfWeek: CronField;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Field constraints: [min, max] inclusive */
const FIELD_RANGES: [number, number][] = [
  [0, 59], // minute
  [0, 23], // hour
  [1, 31], // dayOfMonth
  [1, 12], // month
  [0, 6],  // dayOfWeek (0=Sun, 6=Sat)
];

const MONTH_NAMES: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

const DOW_NAMES: Record<string, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
};

// ─── Field Parsing ────────────────────────────────────────────────────────────

/**
 * Replace named month/weekday tokens with their numeric equivalents.
 * Field 3 = month (1-12), field 4 = dow (0-6).
 */
function normaliseNames(token: string, fieldIndex: number): string {
  if (fieldIndex === 3) {
    return token.replace(/[a-z]+/gi, m => {
      const n = MONTH_NAMES[m.toLowerCase()];
      return n !== undefined ? String(n) : m;
    });
  }
  if (fieldIndex === 4) {
    return token.replace(/[a-z]+/gi, m => {
      // Handle "7" alias for Sunday
      const n = DOW_NAMES[m.toLowerCase()];
      return n !== undefined ? String(n) : m;
    });
  }
  return token;
}

/**
 * Expand a single segment (no commas) into an array of matching values.
 * Returns the expanded values and the field type.
 */
function expandSegment(
  seg: string,
  min: number,
  max: number,
): { type: CronField['type']; values: number[] } {
  // * (all)
  if (seg === '*') {
    const values: number[] = [];
    for (let i = min; i <= max; i++) values.push(i);
    return { type: 'all', values };
  }

  // */step
  const allStepMatch = seg.match(/^\*\/(\d+)$/);
  if (allStepMatch) {
    const step = parseInt(allStepMatch[1], 10);
    if (step < 1) throw new Error(`Invalid step value in "${seg}"`);
    const values: number[] = [];
    for (let i = min; i <= max; i += step) values.push(i);
    return { type: 'step', values };
  }

  // a-b/step
  const rangeStepMatch = seg.match(/^(\d+)-(\d+)\/(\d+)$/);
  if (rangeStepMatch) {
    const lo = parseInt(rangeStepMatch[1], 10);
    const hi = parseInt(rangeStepMatch[2], 10);
    const step = parseInt(rangeStepMatch[3], 10);
    if (step < 1) throw new Error(`Invalid step value in "${seg}"`);
    if (lo < min || hi > max || lo > hi) throw new Error(`Range out of bounds in "${seg}"`);
    const values: number[] = [];
    for (let i = lo; i <= hi; i += step) values.push(i);
    return { type: 'step', values };
  }

  // a-b
  const rangeMatch = seg.match(/^(\d+)-(\d+)$/);
  if (rangeMatch) {
    const lo = parseInt(rangeMatch[1], 10);
    const hi = parseInt(rangeMatch[2], 10);
    if (lo < min || hi > max || lo > hi) throw new Error(`Range out of bounds in "${seg}"`);
    const values: number[] = [];
    for (let i = lo; i <= hi; i++) values.push(i);
    return { type: 'range', values };
  }

  // plain number
  const numMatch = seg.match(/^(\d+)$/);
  if (numMatch) {
    const v = parseInt(numMatch[1], 10);
    if (v < min || v > max) throw new Error(`Value ${v} out of range [${min}, ${max}]`);
    return { type: 'value', values: [v] };
  }

  throw new Error(`Unrecognised cron segment: "${seg}"`);
}

/**
 * Parse one cron field token (may contain commas) into a CronField.
 */
function parseField(token: string, fieldIndex: number): CronField {
  const [min, max] = FIELD_RANGES[fieldIndex];
  const normalised = normaliseNames(token, fieldIndex);
  const parts = normalised.split(',');

  if (parts.length === 1) {
    const { type, values } = expandSegment(parts[0].trim(), min, max);
    // Normalise dow: 7 is a Sunday alias → map to 0
    const normValues = fieldIndex === 4 ? values.map(v => v === 7 ? 0 : v) : values;
    return { type, values: [...new Set(normValues)].sort((a, b) => a - b) };
  }

  // List
  const allValues: number[] = [];
  for (const part of parts) {
    const { values } = expandSegment(part.trim(), min, max);
    allValues.push(...values);
  }
  const normValues = fieldIndex === 4 ? allValues.map(v => v === 7 ? 0 : v) : allValues;
  const unique = [...new Set(normValues)].sort((a, b) => a - b);
  return { type: 'list', values: unique };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Parse a 5-field cron expression (min hour dom month dow).
 * Throws on invalid syntax.
 */
export function parseCron(expr: string): CronExpression {
  const fields = expr.trim().split(/\s+/);
  if (fields.length !== 5) {
    throw new Error(`Expected 5 cron fields, got ${fields.length}: "${expr}"`);
  }
  return {
    minute:     parseField(fields[0], 0),
    hour:       parseField(fields[1], 1),
    dayOfMonth: parseField(fields[2], 2),
    month:      parseField(fields[3], 3),
    dayOfWeek:  parseField(fields[4], 4),
  };
}

/**
 * Check whether `date` matches a parsed cron expression.
 * Month is 1-based; dayOfWeek 0=Sunday.
 */
function matchesParsed(parsed: CronExpression, date: Date): boolean {
  const minute     = date.getMinutes();
  const hour       = date.getHours();
  const dom        = date.getDate();
  const month      = date.getMonth() + 1; // getMonth() is 0-based
  const dow        = date.getDay();       // 0=Sun

  if (!parsed.minute.values.includes(minute))     return false;
  if (!parsed.hour.values.includes(hour))          return false;
  if (!parsed.month.values.includes(month))        return false;

  // Standard cron: if both dom and dow are restricted (not '*'), either match is
  // sufficient. If only one is restricted, that one must match.
  const domRestricted = parsed.dayOfMonth.type !== 'all';
  const dowRestricted = parsed.dayOfWeek.type  !== 'all';

  if (domRestricted && dowRestricted) {
    // Either dom OR dow must match
    if (
      !parsed.dayOfMonth.values.includes(dom) &&
      !parsed.dayOfWeek.values.includes(dow)
    ) return false;
  } else {
    if (!parsed.dayOfMonth.values.includes(dom)) return false;
    if (!parsed.dayOfWeek.values.includes(dow))  return false;
  }

  return true;
}

/** Check if a Date matches a cron expression string. */
export function matchesCron(expr: string, date: Date): boolean {
  return matchesParsed(parseCron(expr), date);
}

/**
 * Get the next `count` dates (default 1) that match `expr` after `from`.
 * Scans minute-by-minute up to 4 years ahead.
 */
export function nextMatches(expr: string, from: Date, count: number = 1): Date[] {
  const parsed = parseCron(expr);
  const results: Date[] = [];

  // Start from the next minute (truncate seconds/ms, add 1 min).
  const cursor = new Date(from);
  cursor.setSeconds(0, 0);
  cursor.setMinutes(cursor.getMinutes() + 1);

  const limit = new Date(from);
  limit.setFullYear(limit.getFullYear() + 4);

  while (results.length < count && cursor <= limit) {
    if (matchesParsed(parsed, cursor)) {
      results.push(new Date(cursor));
    }
    cursor.setMinutes(cursor.getMinutes() + 1);
  }

  return results;
}
