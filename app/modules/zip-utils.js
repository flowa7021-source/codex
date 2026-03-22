// @ts-check
// ─── ZIP Utilities ──────────────────────────────────────────────────────────
// Shared ZIP extraction using fflate (supports DEFLATE + Store methods).
// Used by epub-adapter.js and cbz-adapter.js.

import { unzipSync } from 'fflate';

/**
 * Extract all files from a ZIP archive.
 * @param {ArrayBuffer|Uint8Array} data - Raw ZIP bytes
 * @returns {Record<string, Uint8Array>} Map of path → file bytes
 */
export function extractZip(data) {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  return unzipSync(bytes);
}

/**
 * Extract a single text file from a ZIP.
 * @param {Record<string, Uint8Array>} zipEntries - Extracted ZIP entries
 * @param {string} fileName - Exact path or suffix to match
 * @returns {string|null}
 */
export function extractTextFile(zipEntries, fileName) {
  const entry = findEntry(zipEntries, fileName);
  if (!entry) return null;
  return new TextDecoder('utf-8').decode(entry);
}

/**
 * Extract a single binary file from a ZIP.
 * @param {Record<string, Uint8Array>} zipEntries - Extracted ZIP entries
 * @param {string} fileName - Exact path or suffix to match
 * @returns {Uint8Array|null}
 */
export function extractBinaryFile(zipEntries, fileName) {
  return findEntry(zipEntries, fileName);
}

/**
 * List all entry paths in a ZIP.
 * @param {Record<string, Uint8Array>} zipEntries - Extracted ZIP entries
 * @returns {string[]}
 */
export function listEntries(zipEntries) {
  return Object.keys(zipEntries);
}

/**
 * Find an entry by exact path or suffix match.
 * @param {Record<string, Uint8Array>} entries
 * @param {string} name
 * @returns {Uint8Array|null}
 */
function findEntry(entries, name) {
  if (entries[name]) return entries[name];
  // Try suffix match
  for (const key of Object.keys(entries)) {
    if (key === name || key.endsWith('/' + name)) {
      return entries[key];
    }
  }
  return null;
}
