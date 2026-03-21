// ─── CBZ/CBR Adapter ────────────────────────────────────────────────────────
// Support for comic book archive formats (CBZ = ZIP, CBR = info only).

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];

/**
 * Parse a CBZ (ZIP) file and extract images.
 * @param {ArrayBuffer|Uint8Array} data
 * @returns {Promise<{pages: Array<{name: string, blob: Blob, index: number}>, metadata: object}>}
 */
export async function parseCbz(data) {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);

  // Find ZIP entries using local file headers
  const entries = [];
  let offset = 0;

  while (offset < bytes.length - 4) {
    // Local file header signature: 0x04034b50
    if (bytes[offset] === 0x50 && bytes[offset + 1] === 0x4b &&
        bytes[offset + 2] === 0x03 && bytes[offset + 3] === 0x04) {

      const view = new DataView(bytes.buffer, bytes.byteOffset + offset);
      const compMethod = view.getUint16(8, true);
      const compSize = view.getUint32(18, true);
      const uncompSize = view.getUint32(22, true);
      const nameLen = view.getUint16(26, true);
      const extraLen = view.getUint16(28, true);

      const nameBytes = bytes.slice(offset + 30, offset + 30 + nameLen);
      const name = new TextDecoder().decode(nameBytes);

      const dataStart = offset + 30 + nameLen + extraLen;
      const fileData = bytes.slice(dataStart, dataStart + compSize);

      if (compMethod === 0 && isImageFile(name)) { // Store method only
        entries.push({
          name,
          data: fileData,
          size: uncompSize,
        });
      }

      offset = dataStart + compSize;
    } else {
      offset++;
    }
  }

  // Sort by filename (natural sort for page ordering)
  entries.sort((a, b) => naturalSort(a.name, b.name));

  const pages = entries.map((entry, index) => ({
    name: entry.name,
    blob: new Blob([entry.data], { type: getMimeType(entry.name) }),
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
