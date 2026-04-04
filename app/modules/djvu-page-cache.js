// @ts-check
// ─── DjVu Page LRU Cache ──────────────────────────────────────────────────────
// Caches decoded DjVu page ImageData objects with a strict memory-byte limit.
// Evicts least-recently-used entries when the limit is exceeded.
//
// Byte accounting: ImageData.data.byteLength = width × height × 4 (RGBA)
// Default limit: 200 MB — enough for ~50 A4 pages at 300 DPI.

export class DjVuPageCache {
  /**
   * @param {number} [maxMb=200] Maximum cache size in megabytes
   */
  constructor(maxMb = 200) {
    this._maxBytes = maxMb * 1024 * 1024;
    this._usedBytes = 0;
    /** @type {Map<string, {data: ImageData, bytes: number}>} */
    this._map = new Map();        // key → {data, bytes}   (Map preserves insertion order)
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * @param {number} pageNumber  1-based page number
   * @param {boolean} lowRes     true = low-resolution thumbnail entry
   * @returns {ImageData|null}
   */
  get(pageNumber, lowRes) {
    const key = this._key(pageNumber, lowRes);
    const entry = this._map.get(key);
    if (!entry) return null;
    // Refresh to MRU position
    this._map.delete(key);
    this._map.set(key, entry);
    return entry.data;
  }

  /**
   * @param {number} pageNumber
   * @param {boolean} lowRes
   * @param {ImageData} imageData
   */
  put(pageNumber, lowRes, imageData) {
    const key = this._key(pageNumber, lowRes);
    const bytes = imageData.data.byteLength;

    // Remove existing entry for the same key
    if (this._map.has(key)) {
      this._usedBytes -= /** @type {any} */ (this._map.get(key)).bytes;
      this._map.delete(key);
    }

    // Evict LRU entries until there is room
    while (this._usedBytes + bytes > this._maxBytes && this._map.size > 0) {
      const lruKey = this._map.keys().next().value;
      const lruEntry = this._map.get(lruKey);
      this._usedBytes -= lruEntry.bytes;
      this._map.delete(lruKey);
    }

    // If a single entry exceeds the limit entirely, skip caching (don't crash)
    if (bytes > this._maxBytes) return;

    this._map.set(key, { data: imageData, bytes });
    this._usedBytes += bytes;
  }

  /** Remove all cached entries for a file (used when a new file is opened). */
  clear() {
    this._map.clear();
    this._usedBytes = 0;
  }

  get usedBytes() { return this._usedBytes; }
  get maxBytes()  { return this._maxBytes; }
  get size()      { return this._map.size; }

  // ── Internal ────────────────────────────────────────────────────────────────

  _key(pageNumber, lowRes) {
    return `${pageNumber}:${lowRes ? '0' : '1'}`;
  }
}
