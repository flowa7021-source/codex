// @ts-check
/**
 * @module page-model
 * @description Unified Document Model (Phase 0).
 *
 * Represents a PDF page (native or scanned) as a typed collection of
 * VisualObjects: TextBlock, ImageBlock, PathBlock.  Abstracts over the
 * difference between native-text PDFs and scan+OCR PDFs so that every
 * higher-level tool (Erase, Edit, Search, …) works the same way regardless
 * of document origin.
 *
 * Architecture:
 *   PageModel              – top-level page container
 *   ├── VisualObject[]     – ordered list: TextBlock | ImageBlock | PathBlock
 *   └── TextLayerModel     – pixel-perfect text overlay (from OCR or native)
 *
 * All coordinates are in PDF "user space" points (pt) with origin at the
 * bottom-left corner of the page, Y increasing upward – the same coordinate
 * system used by pdf.js and pdf-lib.
 */

// ---------------------------------------------------------------------------
// VisualObject types
// ---------------------------------------------------------------------------

/** @typedef {'text'|'image'|'path'} VisualObjectType */

/**
 * @typedef {Object} BoundingBox
 * @property {number} x       - Left edge (pt, from page left)
 * @property {number} y       - Bottom edge (pt, from page bottom)
 * @property {number} width
 * @property {number} height
 */

/**
 * @typedef {Object} TextRun
 * @property {string} text
 * @property {string} font        - CSS font-family string
 * @property {number} fontSize    - In pt
 * @property {string} color       - Hex '#RRGGBB'
 * @property {number} x           - Glyph origin x (pt)
 * @property {number} y           - Baseline y (pt)
 * @property {number} width       - Run advance width (pt)
 * @property {boolean} bold
 * @property {boolean} italic
 * @property {string|null} url    - Hyperlink target, if any
 */

/**
 * @typedef {Object} TextLine
 * @property {TextRun[]} runs
 * @property {number} baseline    - Y coordinate of the baseline (pt)
 */

/**
 * A text region from either the native PDF content stream or the OCR engine.
 * @typedef {Object} TextBlock
 * @property {'text'} type
 * @property {'native'|'ocr'} source
 * @property {string} id
 * @property {BoundingBox} boundingBox
 * @property {TextLine[]} lines
 * @property {boolean} editable
 * @property {number} confidence  - 0–1 (1.0 for native PDF text)
 * @property {string|null} synthesizedFont
 * @property {string|null} matchedSystemFont
 */

/**
 * @typedef {Object} ImageBlock
 * @property {'image'} type
 * @property {string} id
 * @property {BoundingBox} boundingBox
 * @property {Uint8Array|null} data   - Raw image bytes (PNG/JPEG)
 * @property {string} mimeType        - 'image/png' | 'image/jpeg'
 * @property {boolean} isBackground   - true for scan page background image
 * @property {number} naturalWidth    - Image's own pixel width
 * @property {number} naturalHeight
 */

/**
 * @typedef {Object} PathOp
 * @property {'moveTo'|'lineTo'|'curveTo'|'closePath'} op
 * @property {number[]} args
 */

/**
 * @typedef {Object} PathBlock
 * @property {'path'} type
 * @property {string} id
 * @property {BoundingBox} boundingBox
 * @property {PathOp[]} operations
 * @property {{color: string, width: number, dash: number[]|null}} stroke
 * @property {{color: string}|null} fill
 */

// ---------------------------------------------------------------------------
// TextLayerModel
// ---------------------------------------------------------------------------

export class TextLayerModel {
  /**
   * @param {Array<{char: string, bbox: {x0,y0,x1,y1}, confidence: number, wordText: string, lineBaseline: number, fontSize: number}>} charBoxes
   * @param {string} source  'native'|'ocr'
   */
  constructor(charBoxes = [], source = 'native') {
    this.charBoxes = charBoxes;
    this.source = source;
  }

  /**
   * Remove all characters whose centre falls inside the given rect.
   * @param {{x,y,width,height}} rect  PDF coordinates (pt)
   */
  removeTextInRect(rect) {
    this.charBoxes = this.charBoxes.filter(cb => {
      const cx = (cb.bbox.x0 + cb.bbox.x1) / 2;
      const cy = (cb.bbox.y0 + cb.bbox.y1) / 2;
      return !_pointInRect(cx, cy, rect);
    });
  }

  /**
   * Return plain-text string for a rectangular region.
   * @param {{x,y,width,height}} rect
   * @returns {string}
   */
  getTextInRect(rect) {
    return this.charBoxes
      .filter(cb => {
        const cx = (cb.bbox.x0 + cb.bbox.x1) / 2;
        const cy = (cb.bbox.y0 + cb.bbox.y1) / 2;
        return _pointInRect(cx, cy, rect);
      })
      .map(cb => cb.char)
      .join('');
  }

  /** Full plain-text content of the layer. */
  get plainText() {
    return this.charBoxes.map(cb => cb.char).join('');
  }
}

// ---------------------------------------------------------------------------
// PageModel
// ---------------------------------------------------------------------------

let _idSeq = 0;
function nextId(prefix) {
  return `${prefix}-${++_idSeq}`;
}

export class PageModel {
  /**
   * @param {number} pageNumber   1-based
   * @param {number} width        Page width in pt
   * @param {number} height       Page height in pt
   */
  constructor(pageNumber, width, height) {
    /** @type {number} */
    this.pageNumber = pageNumber;
    /** @type {number} */
    this.width = width;
    /** @type {number} */
    this.height = height;

    /** @type {Array<TextBlock|ImageBlock|PathBlock>} */
    this.objects = [];

    /** @type {TextLayerModel} */
    this.textLayer = new TextLayerModel();

    /** @type {Object} */
    this.metadata = {
      isScanned: false,
      hasOcrText: false,
      isProtected: false,
      hasNativeText: false,
      rotation: 0,
    };
  }

  // ── Factory helpers ──────────────────────────────────────────────────────

  /**
   * Add a native-text block extracted from the PDF content stream.
   * @param {BoundingBox} bbox
   * @param {TextLine[]} lines
   * @param {Object} [opts]
   * @returns {TextBlock}
   */
  addNativeTextBlock(bbox, lines, opts = {}) {
    const block = {
      type: 'text',
      source: 'native',
      id: nextId('tb'),
      boundingBox: bbox,
      lines,
      editable: !this.metadata.isProtected,
      confidence: 1.0,
      synthesizedFont: null,
      matchedSystemFont: opts.matchedSystemFont || null,
    };
// @ts-ignore
    this.objects.push(block);
    this.metadata.hasNativeText = true;
// @ts-ignore
    return block;
  }

  /**
   * Add an OCR-derived text block.
   * @param {BoundingBox} bbox
   * @param {TextLine[]} lines
   * @param {number} confidence   0–1
   * @param {Object} [opts]
   * @returns {TextBlock}
   */
  addOcrTextBlock(bbox, lines, confidence, opts = {}) {
    const block = {
      type: 'text',
      source: 'ocr',
      id: nextId('tb'),
      boundingBox: bbox,
      lines,
      editable: !this.metadata.isProtected,
      confidence,
      synthesizedFont: opts.synthesizedFont || null,
      matchedSystemFont: opts.matchedSystemFont || null,
    };
// @ts-ignore
    this.objects.push(block);
    this.metadata.hasOcrText = true;
// @ts-ignore
    return block;
  }

  /**
   * Add an image block.
   * @param {BoundingBox} bbox
   * @param {Uint8Array|null} data
   * @param {string} mimeType
   * @param {boolean} [isBackground=false]
   * @returns {ImageBlock}
   */
  addImageBlock(bbox, data, mimeType, isBackground = false) {
    const block = {
      type: 'image',
      id: nextId('ib'),
      boundingBox: bbox,
      data,
      mimeType: mimeType || 'image/png',
      isBackground,
      naturalWidth: bbox.width,
      naturalHeight: bbox.height,
    };
// @ts-ignore
    this.objects.push(block);
    if (isBackground) this.metadata.isScanned = true;
// @ts-ignore
    return block;
  }

  /**
   * Add a vector path block.
   * @param {BoundingBox} bbox
   * @param {PathOp[]} operations
   * @param {{color:string,width:number,dash:number[]|null}} stroke
   * @param {{color:string}|null} fill
   * @returns {PathBlock}
   */
  addPathBlock(bbox, operations, stroke, fill = null) {
    const block = {
      type: 'path',
      id: nextId('pb'),
      boundingBox: bbox,
      operations,
      stroke,
      fill,
    };
// @ts-ignore
    this.objects.push(block);
// @ts-ignore
    return block;
  }

  // ── Query helpers ────────────────────────────────────────────────────────

  /**
   * Return every VisualObject whose bounding box intersects the given rect.
   * @param {{x,y,width,height}} rect
   * @returns {Array<TextBlock|ImageBlock|PathBlock>}
   */
  objectsInRect(rect) {
    return this.objects.filter(obj => _rectsIntersect(obj.boundingBox, rect));
  }

  /**
   * Return the top-most object (last in z-order) whose bbox contains the
   * given point.  Returns `null` if nothing found.
   * @param {{x,y}} pt
   * @returns {TextBlock|ImageBlock|PathBlock|null}
   */
  objectAtPoint(pt) {
    for (let i = this.objects.length - 1; i >= 0; i--) {
      if (_pointInRect(pt.x, pt.y, this.objects[i].boundingBox)) {
        return this.objects[i];
      }
    }
    return null;
  }

  /** Background image (for scanned pages), or null. */
  get backgroundImage() {
    return this.objects.find(o => o.type === 'image' && o.isBackground) || null;
  }

  /** All TextBlocks in reading order (top-to-bottom, left-to-right). */
  get textBlocks() {
    return this.objects
      .filter(o => o.type === 'text')
      .sort((a, b) => {
        const dy = b.boundingBox.y - a.boundingBox.y; // PDF y: top = high value
        return Math.abs(dy) > 4 ? dy : a.boundingBox.x - b.boundingBox.x;
      });
  }

  /** Plain text of the entire page (from text layer or text blocks). */
  get plainText() {
    if (this.textLayer.charBoxes.length) return this.textLayer.plainText;
    return this.textBlocks
      .map(tb => tb.lines.flatMap(l => l.runs.map(r => r.text)).join(' '))
      .join('\n');
  }

  // ── Mutation helpers ─────────────────────────────────────────────────────

  /**
   * Remove a VisualObject by id.
   * @param {string} id
   * @returns {boolean}  true if found and removed
   */
  removeObject(id) {
    const idx = this.objects.findIndex(o => o.id === id);
    if (idx < 0) return false;
    this.objects.splice(idx, 1);
    return true;
  }

  /**
   * Remove all objects (of any type) fully contained within the given rect.
   * Partially overlapping objects are kept (caller can split them if needed).
   * @param {{x,y,width,height}} rect
   * @returns {Array<TextBlock|ImageBlock|PathBlock>}  removed objects
   */
  removeObjectsInRect(rect) {
    const removed = [];
    this.objects = this.objects.filter(obj => {
      if (_rectContains(rect, obj.boundingBox)) {
        removed.push(obj);
        return false;
      }
      return true;
    });
    return removed;
  }
}

// ---------------------------------------------------------------------------
// DocumentModel
// ---------------------------------------------------------------------------

/**
 * Thin container for multi-page document state.
 */
export class DocumentModel {
  constructor() {
    /** @type {Map<number, PageModel>}  pageNumber → PageModel */
    this.pages = new Map();

    /** @type {{isEncrypted: boolean, permissions: import('./pdf-security.js').PermissionFlags|null}} */
    this.security = { isEncrypted: false, permissions: null };

    /** @type {string}  'unknown'|'native'|'scanned'|'mixed' */
    this.documentType = 'unknown';
  }

  /**
   * Get or create a PageModel for the given 1-based page number.
   * @param {number} pageNumber
   * @param {number} [width=595]
   * @param {number} [height=842]
   * @returns {PageModel}
   */
  getPage(pageNumber, width = 595, height = 842) {
    if (!this.pages.has(pageNumber)) {
      this.pages.set(pageNumber, new PageModel(pageNumber, width, height));
    }
    return this.pages.get(pageNumber);
  }

  /**
   * Build a PageModel from an ExtractedPage (Layer 1 output).
   * @param {any} extracted
   * @returns {PageModel}
   */
  static fromExtractedPage(extracted) {
    const page = new PageModel(extracted.pageNumber, extracted.width, extracted.height);
    page.metadata.rotation = extracted.rotation || 0;

    // --- Text blocks -------------------------------------------------------
    // Group text runs by proximity into blocks
    const lineGroups = _groupRunsIntoLines(extracted.textRuns || []);
    for (const lineRuns of lineGroups) {
      const bbox = _bboxOfRuns(lineRuns);
      const line = { runs: lineRuns.map(_convertRun), baseline: bbox.y };
      page.addNativeTextBlock(bbox, [line]);
    }

    // --- Image blocks -------------------------------------------------------
    for (const img of extracted.images || []) {
      page.addImageBlock(
        { x: img.x, y: img.y, width: img.width, height: img.height },
        img.data,
        img.mimeType,
        false,
      );
    }

    // --- Path blocks --------------------------------------------------------
    for (const path of extracted.paths || []) {
      const bbox = {
        x: Math.min(path.x1, path.x2),
        y: Math.min(path.y1, path.y2),
        width: Math.abs(path.x2 - path.x1) || 1,
        height: Math.abs(path.y2 - path.y1) || 1,
      };
      const ops = /** @type {any[]} */ (path.type === 'line'
        ? [{ op: 'moveTo', args: [path.x1, path.y1] }, { op: 'lineTo', args: [path.x2, path.y2] }]
        : [{ op: 'moveTo', args: [path.x1, path.y1] },
           { op: 'lineTo', args: [path.x2, path.y1] },
           { op: 'lineTo', args: [path.x2, path.y2] },
           { op: 'lineTo', args: [path.x1, path.y2] },
           { op: 'closePath', args: [] }]);
      page.addPathBlock(bbox, ops,
        { color: path.strokeColor || '#000000', width: path.lineWidth || 1, dash: null },
        path.fillColor ? { color: path.fillColor } : null,
      );
    }

    return page;
  }

  /**
   * Build a PageModel from OCR results.
   * @param {number} pageNumber
   * @param {number} pageWidth   pt
   * @param {number} pageHeight  pt
   * @param {Object} ocrResult   – as returned by ocrWithCharBoxes()
   * @param {Uint8Array|null} bgImageData
   * @returns {PageModel}
   */
  static fromOcrResult(pageNumber, pageWidth, pageHeight, ocrResult, bgImageData = null) {
    const page = new PageModel(pageNumber, pageWidth, pageHeight);
    page.metadata.isScanned = true;
    page.metadata.hasOcrText = true;

    // Background image
    if (bgImageData) {
      page.addImageBlock(
        { x: 0, y: 0, width: pageWidth, height: pageHeight },
        bgImageData, 'image/jpeg', true,
      );
    }

    // Text blocks from OCR words
    for (const word of (ocrResult.words || [])) {
      const bbox = {
        x: word.bbox.x0, y: word.bbox.y0,
        width: word.bbox.x1 - word.bbox.x0,
        height: word.bbox.y1 - word.bbox.y0,
      };
      const run = {
        text: word.text,
        font: 'Arial',
        fontSize: bbox.height,
        color: '#000000',
        x: bbox.x,
        y: bbox.y + bbox.height,
        width: bbox.width,
        bold: false,
        italic: false,
        url: null,
      };
      page.addOcrTextBlock(bbox, [{ runs: [run], baseline: bbox.y + bbox.height }],
        (word.confidence || 0) / 100);
    }

    // Text layer with character-level bboxes
    page.textLayer = new TextLayerModel(ocrResult.charBoxes || [], 'ocr');

    return page;
  }
}

// ---------------------------------------------------------------------------
// Internal geometry helpers
// ---------------------------------------------------------------------------

function _pointInRect(x, y, r) {
  return x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height;
}

function _rectsIntersect(a, b) {
  return a.x < b.x + b.width &&
         a.x + a.width > b.x &&
         a.y < b.y + b.height &&
         a.y + a.height > b.y;
}

function _rectContains(outer, inner) {
  return inner.x >= outer.x &&
         inner.y >= outer.y &&
         inner.x + inner.width <= outer.x + outer.width &&
         inner.y + inner.height <= outer.y + outer.height;
}

function _bboxOfRuns(runs) {
  const xs = runs.map(r => r.x);
  const ys = runs.map(r => r.y);
  const x2s = runs.map(r => r.x + (r.width || 0));
  const y2s = runs.map(r => r.y + (r.height || 0));
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...x2s) - x, height: Math.max(...y2s) - y };
}

function _convertRun(r) {
  return {
    text: r.text,
    font: r.fontFamily || 'Arial',
    fontSize: r.fontSize || 12,
    color: r.color || '#000000',
    x: r.x,
    y: r.y,
    width: r.width || 0,
    bold: r.bold || false,
    italic: r.italic || false,
    url: r.url || null,
  };
}

/** Very simple line grouping by Y proximity. */
function _groupRunsIntoLines(runs) {
  if (!runs.length) return [];
  const sorted = [...runs].sort((a, b) => a.y - b.y || a.x - b.x);
  const lines = [];
  let current = [sorted[0]];
  let currentY = sorted[0].y;
  const avgH = sorted.reduce((s, r) => s + (r.height || r.fontSize || 12), 0) / sorted.length;

  for (let i = 1; i < sorted.length; i++) {
    const r = sorted[i];
    if (Math.abs(r.y - currentY) <= avgH * 0.5) {
      current.push(r);
    } else {
      lines.push(current);
      current = [r];
      currentY = r.y;
    }
  }
  lines.push(current);
  return lines;
}
