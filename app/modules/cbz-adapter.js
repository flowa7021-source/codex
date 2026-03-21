// ─── CBZ/CBR Adapter ────────────────────────────────────────────────────────
// Support for comic book archive formats (CBZ = ZIP, CBR = info only).
// Uses fflate (via zip-utils) for proper DEFLATE + Store ZIP support.

import { extractZip } from './zip-utils.js';

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];

/**
 * Parse a CBZ (ZIP) file and extract images.
 * @param {ArrayBuffer|Uint8Array} data
 * @returns {Promise<{pages: Array<{name: string, blob: Blob, index: number}>, metadata: object}>}
 */
export async function parseCbz(data) {
  const zipEntries = extractZip(data);

  // Filter to image files and sort naturally
  const imageEntries = Object.entries(zipEntries)
    .filter(([name]) => isImageFile(name))
    .sort(([a], [b]) => naturalSort(a, b));

  const pages = imageEntries.map(([name, bytes], index) => ({
    name,
    blob: new Blob([bytes], { type: getMimeType(name) }),
    index,
  }));

  return {
    pages,
    metadata: {
      format: 'cbz',
      pageCount: pages.length,
      fileNames: pages.map(p => p.name),
    },
  };
}

/**
 * CBZ Adapter class matching the adapter interface used by the viewer.
 */
export class CbzAdapter {
  constructor() {
    this.pages = [];
    this.metadata = null;
    this._imageCache = new Map();
  }

  /**
   * Load a CBZ file.
   * @param {ArrayBuffer|Uint8Array} data
   */
  async load(data) {
    const result = await parseCbz(data);
    this.pages = result.pages;
    this.metadata = result.metadata;
    return this;
  }

  /**
   * Get total page count.
   * @returns {number}
   */
  getPageCount() {
    return this.pages.length;
  }

  /**
   * Render a page to a canvas.
   * @param {number} pageNum - 1-indexed
   * @param {HTMLCanvasElement} canvas
   * @param {number} [zoom=1]
   */
  async renderPage(pageNum, canvas, zoom = 1) {
    const page = this.pages[pageNum - 1];
    if (!page) throw new Error(`Page ${pageNum} not found`);

    const img = await this._getImage(pageNum);
    const ctx = canvas.getContext('2d');
    if (!ctx) return { width: 0, height: 0 };

    canvas.width = Math.round(img.naturalWidth * zoom);
    canvas.height = Math.round(img.naturalHeight * zoom);

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    return { width: canvas.width, height: canvas.height };
  }

  /**
   * Get page dimensions without rendering.
   * @param {number} pageNum
   * @returns {Promise<{width: number, height: number}>}
   */
  async getPageSize(pageNum) {
    const img = await this._getImage(pageNum);
    return { width: img.naturalWidth, height: img.naturalHeight };
  }

  /**
   * Get text content (comics don't have text).
   * @returns {string}
   */
  getTextContent() {
    return '';
  }

  /**
   * Cleanup resources.
   */
  destroy() {
    for (const [, url] of this._imageCache) {
      if (typeof url === 'string') URL.revokeObjectURL(url);
    }
    this._imageCache.clear();
    this.pages = [];
  }

  /** @private */
  async _getImage(pageNum) {
    if (this._imageCache.has(pageNum)) {
      return this._imageCache.get(pageNum);
    }

    const page = this.pages[pageNum - 1];
    if (!page) throw new Error(`Page ${pageNum} not found`);

    const url = URL.createObjectURL(page.blob);
    const img = new Image();

    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error(`Failed to load image: ${page.name}`));
      img.src = url;
    });

    // Cache the loaded image element (keep URL for cleanup)
    img._blobUrl = url;
    this._imageCache.set(pageNum, img);
    return img;
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function isImageFile(name) {
  const lower = name.toLowerCase();
  return IMAGE_EXTENSIONS.some(ext => lower.endsWith(ext)) && !lower.includes('__MACOSX');
}

function getMimeType(name) {
  const lower = name.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.bmp')) return 'image/bmp';
  return 'image/jpeg';
}

function naturalSort(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}
