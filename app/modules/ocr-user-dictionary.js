// @ts-check
// ─── OCR User Dictionary for Post-Correction ────────────────────────────────
// Stores user-defined word corrections in localStorage so that recurring OCR
// mistakes can be fixed automatically on subsequent recognitions.
//
// Storage key: "novareader-user-dict"
// Format: JSON array of [wrong, correct] pairs (serialised Map).
// Maximum 500 entries — oldest entries are evicted when the limit is reached.

const STORAGE_KEY = 'novareader-user-dict';
const MAX_ENTRIES = 500;

/**
 * Internal corrections map (lazy-loaded from localStorage on first access).
 * @type {Map<string, string>|null}
 */
let _cache = null;

// ─── Persistence helpers ────────────────────────────────────────────────────

/**
 * Load the corrections map from localStorage.
 * @returns {Map<string, string>}
 */
function _load() {
  if (_cache) return _cache;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const entries = JSON.parse(raw);
      if (Array.isArray(entries)) {
        _cache = new Map(entries.slice(-MAX_ENTRIES));
        return _cache;
      }
    }
  } catch (err) {
    console.warn('[ocr-user-dictionary] Failed to load from localStorage:', err?.message);
  }
  _cache = new Map();
  return _cache;
}

/**
 * Persist the current corrections map to localStorage.
 */
function _save() {
  const map = _load();
  try {
    const entries = [...map.entries()].slice(-MAX_ENTRIES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch (err) {
    console.warn('[ocr-user-dictionary] Failed to save to localStorage:', err?.message);
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Add a correction mapping.  If the dictionary already contains 500 entries,
 * the oldest entry is removed to make room.
 *
 * @param {string} wrong   - The incorrect OCR text (key).
 * @param {string} correct - The correct replacement text (value).
 */
export function addWord(wrong, correct) {
  if (!wrong || !correct || wrong === correct) return;
  const map = _load();

  // Evict oldest entry if at capacity and this is a new key
  if (!map.has(wrong) && map.size >= MAX_ENTRIES) {
    const oldest = map.keys().next().value;
    map.delete(oldest);
  }

  map.set(wrong, correct);
  _save();
}

/**
 * Remove a correction mapping by its "wrong" key.
 *
 * @param {string} wrong - The key to remove.
 */
export function removeWord(wrong) {
  if (!wrong) return;
  const map = _load();
  if (map.delete(wrong)) {
    _save();
  }
}

/**
 * Return the full corrections map (read-only copy).
 *
 * @returns {Map<string, string>}
 */
export function getCorrections() {
  return new Map(_load());
}

/**
 * Apply all user-dictionary corrections to a text string.
 *
 * Replacements are done using whole-word matching (word-boundary aware) so
 * that a correction for "teh" does not accidentally modify "tehran".
 * The function is intentionally simple and fast — it iterates the dictionary
 * once and performs a global regex replace for each entry.
 *
 * @param {string} text - The OCR text to correct.
 * @returns {string} The corrected text.
 */
export function applyUserDictionary(text) {
  if (!text) return text;
  const map = _load();
  if (map.size === 0) return text;

  let result = text;
  for (const [wrong, correct] of map) {
    // Escape special regex characters in the "wrong" string
    const escaped = wrong.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Use Unicode word-boundary-like assertion:  (?<!\p{L}) and (?!\p{L})
    // to avoid partial-word replacements while supporting Cyrillic and Latin.
    try {
      const re = new RegExp(`(?<!\\p{L})${escaped}(?!\\p{L})`, 'gu');
      result = result.replace(re, correct);
    } catch (_err) {
      // Fallback: simple global string replace (no boundary check)
      result = result.split(wrong).join(correct);
    }
  }
  return result;
}
