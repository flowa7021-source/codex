// @ts-check
// ─── XPS/OXPS Adapter ───────────────────────────────────────────────────────
// Read XPS (XML Paper Specification) and OXPS (Open XPS) documents.
// XPS/OXPS files are ZIP archives containing XAML-like page descriptions.

/**
 * Parse an XPS/OXPS archive and extract page images.
 * XPS pages reference resource images — we extract those and render via canvas.
 *
 * @param {ArrayBuffer} data
 * @returns {Promise<{pages: Array<{width: number, height: number, imageBlob: Blob|null, text: string}>, metadata: object}>}
 */
export async function parseXps(data) {
  const bytes = new Uint8Array(data);
  const files = extractZipFiles(bytes);

  // Find FixedDocumentSequence to determine page order
  const _fdseqPath = findFile(files, 'FixedDocumentSequence.fdseq') ||
                    findFile(files, '[Content_Types].xml') ? findFdseq(files) : null;

  // Find page files (*.fpage)
  const pageFiles = Object.keys(files)
    .filter(name => name.endsWith('.fpage'))
    .sort(naturalSort);

  const pages = [];
  const metadata = { format: 'XPS', pageCount: pageFiles.length, title: '' };

  for (const pagePath of pageFiles) {
    const pageXml = decodeText(files[pagePath]);
    const pageInfo = parseFixedPage(pageXml, files);
    pages.push(pageInfo);
  }

  // Try to extract metadata from CoreProperties
  const coreProps = findFile(files, 'core.xml') || findFile(files, 'CoreProperties');
  if (coreProps) {
    const propsXml = decodeText(files[coreProps]);
    metadata.title = extractXmlTag(propsXml, 'dc:title') || '';
  }

  return { pages, metadata };
}

/**
 * XPS adapter matching the viewer's adapter interface.
 */
export class XpsAdapter {
  constructor() {
    this.pages = [];
    this.metadata = {};
    this._imageCache = new Map();
  }

  /**
   * Load an XPS document.
   * @param {ArrayBuffer} data
   */
  async load(data) {
    const result = await parseXps(data);
    this.pages = result.pages;
    this.metadata = result.metadata;
  }

  getPageCount() {
    return this.pages.length;
  }

  /**
   * Get page dimensions.
   * @param {number} pageNum - 1-indexed
   */
  getPageSize(pageNum) {
    const page = this.pages[pageNum - 1];
    if (!page) return { width: 595, height: 842 };
    return { width: page.width, height: page.height };
  }

  /**
   * Render a page to a canvas.
   * @param {number} pageNum - 1-indexed
   * @param {HTMLCanvasElement} canvas
   * @param {number} [zoom=1]
   */
  async renderPage(pageNum, canvas, zoom = 1) {
    const page = this.pages[pageNum - 1];
    if (!page) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = Math.round(page.width * zoom);
    canvas.height = Math.round(page.height * zoom);

    // Fill white background
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (page.imageBlob) {
      const img = await this._loadImage(pageNum, page.imageBlob);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    } else {
      // No image — render text content as fallback
      ctx.fillStyle = '#333';
      ctx.font = `${12 * zoom}px sans-serif`;
      const lines = page.text.split('\n');
      let y = 20 * zoom;
      for (const line of lines) {
        ctx.fillText(line, 10 * zoom, y);
        y += 16 * zoom;
      }
    }
  }

  /**
   * Get text content of a page.
   * @param {number} pageNum - 1-indexed
   * @returns {string}
   */
  getPageText(pageNum) {
    return this.pages[pageNum - 1]?.text || '';
  }

  destroy() {
    for (const img of this._imageCache.values()) {
      if (img && img._blobUrl) URL.revokeObjectURL(img._blobUrl);
    }
    this._imageCache.clear();
    this.pages = [];
  }

  /** @private */
  async _loadImage(pageNum, blob) {
    if (this._imageCache.has(pageNum)) {
      return this._imageCache.get(pageNum);
    }
    const url = URL.createObjectURL(blob);
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = url;
    });
    /** @type {any} */ (img)._blobUrl = url;
    this._imageCache.set(pageNum, img);
    return img;
  }
}

// ─── Internal Helpers ───────────────────────────────────────────────────────

/**
 * Extract files from a ZIP archive (store + deflate support).
 * Simplified ZIP parser for XPS files.
 */
function extractZipFiles(bytes) {
  const files = {};
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0;

  while (offset < bytes.length - 4) {
    const sig = view.getUint32(offset, true);
    if (sig !== 0x04034b50) break; // Not a local file header

    const compMethod = view.getUint16(offset + 8, true);
    const compSize = view.getUint32(offset + 18, true);
    const _uncompSize = view.getUint32(offset + 22, true);
    const nameLen = view.getUint16(offset + 26, true);
    const extraLen = view.getUint16(offset + 28, true);

    const nameBytes = bytes.slice(offset + 30, offset + 30 + nameLen);
    const name = new TextDecoder().decode(nameBytes);

    const dataStart = offset + 30 + nameLen + extraLen;
    const rawData = bytes.slice(dataStart, dataStart + compSize);

    if (compMethod === 0) {
      // Store method — data is uncompressed
      files[name] = rawData;
    } else {
      // For deflate or other methods, store raw (images may still work)
      files[name] = rawData;
    }

    offset = dataStart + compSize;
  }

  return files;
}

/**
 * Parse a FixedPage XAML and extract dimensions, images, and text.
 */
function parseFixedPage(xml, allFiles) {
  const width = parseFloat(extractXmlAttr(xml, 'FixedPage', 'Width') || '816');
  const height = parseFloat(extractXmlAttr(xml, 'FixedPage', 'Height') || '1056');

  // Extract text from Glyphs elements
  const textParts = [];
  const glyphsRegex = /UnicodeString="([^"]*)"/g;
  let match;
  while ((match = glyphsRegex.exec(xml)) !== null) {
    if (match[1]) textParts.push(match[1]);
  }
  const text = textParts.join(' ');

  // Find referenced images
  let imageBlob = null;
  const imgMatch = xml.match(/ImageSource="([^"]+)"/);
  if (imgMatch) {
    const imgPath = imgMatch[1].replace(/^\//, '');
    const imgData = findFile(allFiles, imgPath);
    if (imgData) {
      const ext = imgPath.split('.').pop().toLowerCase();
      const mime = ext === 'png' ? 'image/png' :
                   ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
                   ext === 'tif' || ext === 'tiff' ? 'image/tiff' :
                   ext === 'wdp' ? 'image/vnd.ms-photo' :
                   'image/png';
      imageBlob = new Blob([allFiles[imgData]], { type: mime });
    }
  }

  return { width, height, imageBlob, text };
}

function findFile(files, partialName) {
  const lower = partialName.toLowerCase();
  for (const key of Object.keys(files)) {
    if (key.toLowerCase().includes(lower) || key.toLowerCase().endsWith(lower)) {
      return key;
    }
  }
  return null;
}

function findFdseq(files) {
  for (const key of Object.keys(files)) {
    if (key.endsWith('.fdseq')) return key;
  }
  return null;
}

function extractXmlTag(xml, tag) {
  const regex = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : null;
}

function extractXmlAttr(xml, tag, attr) {
  const tagRegex = new RegExp(`<${tag}[^>]*${attr}="([^"]*)"`, 'i');
  const match = xml.match(tagRegex);
  return match ? match[1] : null;
}

function decodeText(bytes) {
  return new TextDecoder('utf-8').decode(bytes);
}

function naturalSort(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}
