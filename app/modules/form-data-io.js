// @ts-check
// ─── Form Data Import/Export (FDF, XFDF, CSV, XML) ─────────────────────────

/**
 * Escape a string for FDF parenthesized-string encoding.
 * @param {string} s
 * @returns {string}
 */
function fdfEscape(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

/**
 * Escape a string for XML text content.
 * @param {string} s
 * @returns {string}
 */
function xmlEscape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Escape a value for CSV (RFC 4180).
 * @param {string} s
 * @returns {string}
 */
function csvEscape(s) {
  const str = String(s);
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

// ─── Export Functions ────────────────────────────────────────────────────────

/**
 * Export form field data as FDF (Forms Data Format) string.
 * @param {Array<{name: string, value: string}>} fields
 * @returns {string}
 */
export function exportFormDataFdf(fields) {
  if (!Array.isArray(fields) || fields.length === 0) {
    return '%FDF-1.2\n1 0 obj<</FDF<</Fields[]>>>>\nendobj\ntrailer<</Root 1 0 R>>\n%%EOF';
  }

  const entries = fields.map(f =>
    `<</T(${fdfEscape(f.name)})/V(${fdfEscape(f.value ?? '')})>>`
  ).join('\n');

  return `%FDF-1.2\n1 0 obj<</FDF<</Fields[\n${entries}\n]>>>>\nendobj\ntrailer<</Root 1 0 R>>\n%%EOF`;
}

/**
 * Export form field data as XFDF (XML Forms Data Format) string.
 * @param {Array<{name: string, value: string}>} fields
 * @returns {string}
 */
export function exportFormDataXfdf(fields) {
  const fieldElements = (fields || []).map(f =>
    `    <field name="${xmlEscape(f.name)}"><value>${xmlEscape(f.value ?? '')}</value></field>`
  ).join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<xfdf xmlns="http://ns.adobe.com/xfdf/">',
    '  <fields>',
    fieldElements,
    '  </fields>',
    '</xfdf>',
  ].join('\n');
}

/**
 * Export form field data as CSV string with header row.
 * @param {Array<{name: string, value: string}>} fields
 * @returns {string}
 */
export function exportFormDataCsv(fields) {
  if (!Array.isArray(fields) || fields.length === 0) return 'name,value\n';

  const header = 'name,value';
  const rows = fields.map(f =>
    `${csvEscape(f.name)},${csvEscape(f.value ?? '')}`
  );
  return [header, ...rows].join('\n') + '\n';
}

/**
 * Export form field data as simple XML string.
 * @param {Array<{name: string, value: string}>} fields
 * @returns {string}
 */
export function exportFormDataXml(fields) {
  const entries = (fields || []).map(f =>
    `  <field name="${xmlEscape(f.name)}">${xmlEscape(f.value ?? '')}</field>`
  ).join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<form-data>',
    entries,
    '</form-data>',
  ].join('\n');
}

// ─── Import Functions ────────────────────────────────────────────────────────

/**
 * Parse FDF string and return a Map of field name -> value.
 * @param {string} fdfString
 * @returns {Map<string, string>}
 */
export function importFormDataFdf(fdfString) {
  const result = new Map();
  if (!fdfString || typeof fdfString !== 'string') return result;

  // Match <</T(name)/V(value)>> patterns
  // FDF field entries have /T (title/name) and /V (value)
  const fieldRegex = /<<\/T\(((?:[^()\\]|\\.)*)\)\/V\(((?:[^()\\]|\\.)*)\)>>/g;
  let match;
  while ((match = fieldRegex.exec(fdfString)) !== null) {
    const name = match[1].replace(/\\([()\\])/g, '$1');
    const value = match[2].replace(/\\([()\\])/g, '$1');
    result.set(name, value);
  }
  return result;
}

/**
 * Parse XFDF string and return a Map of field name -> value.
 * @param {string} xfdfString
 * @returns {Map<string, string>}
 */
export function importFormDataXfdf(xfdfString) {
  const result = new Map();
  if (!xfdfString || typeof xfdfString !== 'string') return result;

  // Parse <field name="..."><value>...</value></field> patterns
  const fieldRegex = /<field\s+name="([^"]*)">\s*<value>([\s\S]*?)<\/value>\s*<\/field>/g;
  let match;
  while ((match = fieldRegex.exec(xfdfString)) !== null) {
    const name = match[1]
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");
    const value = match[2]
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");
    result.set(name, value);
  }
  return result;
}

/**
 * Parse CSV string (header: name,value) and return a Map of field name -> value.
 * @param {string} csvString
 * @returns {Map<string, string>}
 */
export function importFormDataCsv(csvString) {
  const result = new Map();
  if (!csvString || typeof csvString !== 'string') return result;

  const lines = csvString.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length < 2) return result; // Need at least header + 1 data row

  // Skip header row (assumed to be "name,value")
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    // Simple CSV parse handling quoted fields
    const parsed = _parseCsvLine(line);
    if (parsed.length >= 2) {
      result.set(parsed[0], parsed[1]);
    }
  }
  return result;
}

/**
 * Parse a single CSV line respecting quoted fields.
 * @param {string} line
 * @returns {string[]}
 */
function _parseCsvLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
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
      if (ch === '"') {
        inQuotes = true;
        i++;
      } else if (ch === ',') {
        fields.push(current);
        current = '';
        i++;
      } else {
        current += ch;
        i++;
      }
    }
  }
  fields.push(current);
  return fields;
}
