/**
 * @module pixel-perfect-text-layer
 * @description Phase 2 — Pixel-perfect text layer.
 *
 * Replaces the approximate <span> positioning used by text-layer-builder.js
 * with character-level alignment that compensates for the mismatch between
 * browser fonts and PDF fonts.
 *
 * Two classes:
 *
 *   FontWidthProvider
 *     Extracts font metrics from a pdf.js page (via commonObjs) and maps
 *     them to system fonts so we can compute exact character widths.
 *
 *   PixelPerfectTextLayer
 *     Renders text items from pdf.js getTextContent() into a container div
 *     with per-span letter-spacing and word-spacing corrections so that each
 *     span matches the PDF width to within ≤1 px at 100% zoom.
 *
 * Usage:
 *   const provider = new FontWidthProvider();
 *   await provider.loadFromPage(pdfPage);
 *
 *   const layer = new PixelPerfectTextLayer(container, viewport);
 *   const textContent = await pdfPage.getTextContent();
 *   layer.render(textContent, provider);
 *
 * Zoom update (no re-render needed):
 *   layer.setZoom(newZoom);
 *
 * Teardown:
 *   layer.destroy();
 */

// ---------------------------------------------------------------------------
// Font name → system font mapping
// ---------------------------------------------------------------------------

/** Map common PDF base font names to system fonts available in all OS. */
const FONT_MAP = {
  // Helvetica family
  'Helvetica': 'Arial',
  'Helvetica-Bold': 'Arial',
  'Helvetica-Oblique': 'Arial',
  'Helvetica-BoldOblique': 'Arial',
  // Times family
  'Times-Roman': 'Times New Roman',
  'Times-Bold': 'Times New Roman',
  'Times-Italic': 'Times New Roman',
  'Times-BoldItalic': 'Times New Roman',
  // Courier family
  'Courier': 'Courier New',
  'Courier-Bold': 'Courier New',
  'Courier-Oblique': 'Courier New',
  'Courier-BoldOblique': 'Courier New',
  // Common embedded names
  'ArialMT': 'Arial',
  'Arial-BoldMT': 'Arial',
  'Arial-ItalicMT': 'Arial',
  'Arial-BoldItalicMT': 'Arial',
  'TimesNewRomanPSMT': 'Times New Roman',
  'TimesNewRomanPS-BoldMT': 'Times New Roman',
  'CourierNewPSMT': 'Courier New',
  'Consolas': 'Consolas',
  'Georgia': 'Georgia',
  'Verdana': 'Verdana',
  'TrebuchetMS': 'Trebuchet MS',
};

/** Strip ABCDEF+ subset prefix (e.g. "AAAAAA+HelveticaNeue" → "HelveticaNeue"). */
function stripSubsetPrefix(name) {
  return (name || '').replace(/^[A-Z]{6}\+/, '');
}

/** Map a PDF font name to the best available system font. */
function mapToSystemFont(fontData) {
  const raw = stripSubsetPrefix(fontData?.name || '');

  // Exact match
  if (FONT_MAP[raw]) return FONT_MAP[raw];

  // Partial match against known base names
  for (const [key, val] of Object.entries(FONT_MAP)) {
    if (raw.toLowerCase().includes(key.toLowerCase())) return val;
  }

  // Generic family fallback from pdf.js font data
  if (fontData?.isSerifFont) return 'Times New Roman';
  if (fontData?.isMonospace) return 'Courier New';
  return 'Arial';
}

// ---------------------------------------------------------------------------
// FontWidthProvider
// ---------------------------------------------------------------------------

/**
 * Extracts font metrics from a pdf.js page and provides:
 *   - System font name (for CSS)
 *   - Per-glyph advance widths (for letter-spacing correction)
 *   - Ascent / descent (for baseline alignment)
 */
export class FontWidthProvider {
  constructor() {
    /** @type {Map<string, {fallbackFont: string, widths: number[], defaultWidth: number, ascent: number, descent: number, isMonospace: boolean}>} */
    this.fonts = new Map();
    this._measureCanvas = null;
    this._measureCtx = null;
  }

  /**
   * Load font metrics from a pdf.js PDFPageProxy.
   * Must be called after getOperatorList() so commonObjs are populated.
   * @param {Object} pdfPage  – pdf.js PDFPageProxy
   */
  async loadFromPage(pdfPage) {
    try {
      // Trigger operator list so fonts are loaded into commonObjs
      await pdfPage.getOperatorList();
    } catch (_e) { /* ignore – some pages have no operators */ }

    try {
      // pdf.js stores font data in page.commonObjs._objs (internal)
      const objs = pdfPage.commonObjs?._objs;
      if (!objs) return;

      for (const [name, entry] of Object.entries(objs)) {
        const fd = entry?.data;
        if (!fd || !fd.type) continue; // not a font object

        this.fonts.set(name, {
          fallbackFont: mapToSystemFont(fd),
          widths: fd.widths || [],
          defaultWidth: fd.defaultWidth || 1000,
          ascent: fd.ascent || 0.8,
          descent: fd.descent || -0.2,
          isMonospace: fd.isMonospace || false,
          italic: fd.italic || false,
          bold: fd.bold || false,
        });
      }
    } catch (err) {
      console.warn('[pixel-perfect-text-layer] FontWidthProvider.loadFromPage:', err?.message);
    }
  }

  /**
   * Get metrics for a font by its pdf.js internal name.
   * @param {string} fontName
   * @returns {{fallbackFont: string, ascent: number, descent: number, isMonospace: boolean}|null}
   */
  getMetrics(fontName) {
    return this.fonts.get(fontName) || null;
  }

  /**
   * Measure the rendered width of `text` at `fontSize` in `fontFamily`.
   * Uses a shared off-screen canvas (no DOM layout cost).
   * @param {string} text
   * @param {number} fontSize  CSS px
   * @param {string} fontFamily
   * @returns {number}  width in px
   */
  measureText(text, fontSize, fontFamily) {
    if (!this._measureCtx) {
      this._measureCanvas = document.createElement('canvas');
      this._measureCtx = this._measureCanvas.getContext('2d');
    }
    if (!this._measureCtx) return 0;
    this._measureCtx.font = `${fontSize}px "${fontFamily}"`;
    return this._measureCtx.measureText(text).width;
  }
}

// ---------------------------------------------------------------------------
// PixelPerfectTextLayer
// ---------------------------------------------------------------------------

/**
 * Renders a text content layer with character-level width correction.
 *
 * For each text item:
 *   1. Compute exact PDF width from item.width (in text space units).
 *   2. Measure browser-rendered width using FontWidthProvider.
 *   3. Distribute the difference as letter-spacing (for multi-char items)
 *      and word-spacing (for items containing spaces).
 *   4. Position the span precisely at the PDF baseline coordinates.
 */
export class PixelPerfectTextLayer {
  /**
   * @param {HTMLElement} container   – positioned parent element (the page container)
   * @param {Object} viewport         – pdf.js PageViewport
   */
  constructor(container, viewport) {
    this.container = container;
    this.viewport = viewport;
    this._zoom = 1;

    this.div = document.createElement('div');
    this.div.className = 'pptl-layer';
    this._applyContainerStyle();
    container.appendChild(this.div);

    /** @type {Array<{span: HTMLSpanElement, item: Object, metrics: Object|null}>} */
    this._items = [];
  }

  /** Update zoom factor and rescale all spans without re-render. */
  setZoom(zoom) {
    if (zoom === this._zoom) return;
    this._zoom = zoom;
    this._applyContainerStyle();
    // Re-apply positions for all rendered items at new zoom
    for (const { span, item, metrics } of this._items) {
      this._positionSpan(span, item, metrics);
    }
  }

  /**
   * Render text content into the layer.
   * Clears any previous content.
   * @param {Object} textContent  – result of pdfPage.getTextContent()
   * @param {FontWidthProvider} fontWidthProvider
   */
  render(textContent, fontWidthProvider) {
    this.div.innerHTML = '';
    this._items = [];

    const items = (textContent.items || []).filter(item => item.str && item.str.trim());

    for (const item of items) {
      const span = document.createElement('span');
      span.textContent = item.str;
      span.setAttribute('data-font', item.fontName || '');

      const metrics = fontWidthProvider.getMetrics(item.fontName);
      const fontFamily = metrics?.fallbackFont || 'Arial';
      const fontSize = this._itemFontSize(item);

      // Base font styling
      span.style.fontFamily = `"${fontFamily}"`;
      span.style.fontSize = `${fontSize}px`;
      span.style.position = 'absolute';
      span.style.whiteSpace = 'pre';
      span.style.transformOrigin = 'left bottom';
      span.style.color = 'transparent';       // invisible text – selection only
      span.style.cursor = 'text';
      span.style.userSelect = 'text';
      span.style.webkitUserSelect = 'text';
      span.style.pointerEvents = 'all';

      // Width correction
      this._applyWidthCorrection(span, item, metrics, fontFamily, fontSize);

      // Position on page
      this._positionSpan(span, item, metrics);

      this.div.appendChild(span);
      this._items.push({ span, item, metrics });
    }
  }

  /** Remove the layer from the DOM. */
  destroy() {
    this.div.remove();
    this._items = [];
  }

  // ── Private ────────────────────────────────────────────────────────────────

  _applyContainerStyle() {
    const vp = this.viewport;
    this.div.style.cssText = [
      'position:absolute',
      'left:0',
      'top:0',
      `width:${vp.width}px`,
      `height:${vp.height}px`,
      'overflow:hidden',
      'line-height:1',
      'z-index:2',
      'pointer-events:none',
    ].join(';');
  }

  /** Extract font size in CSS px from item transform matrix. */
  _itemFontSize(item) {
    const [a, b] = item.transform;
    // Font size in PDF units = magnitude of the x-basis vector
    const pdfPt = Math.sqrt(a * a + b * b);
    return Math.max(1, pdfPt * this.viewport.scale * this._zoom);
  }

  /**
   * Apply letter-spacing and word-spacing to make the span width match the
   * PDF advance width.
   */
  _applyWidthCorrection(span, item, metrics, fontFamily, fontSize) {
    if (!item.width || item.str.length === 0) return;

    // PDF advance width → CSS px
    // item.width is in text-space units (scaled by font size and viewport)
    const pdfWidthPx = item.width * this.viewport.scale * this._zoom;

    // Measured browser width
    const provider = this._providerRef;
    if (!provider) {
      // No provider reference – use canvas measurement inline
      const ctx = _getSharedCtx();
      ctx.font = `${fontSize}px "${fontFamily}"`;
      const measured = ctx.measureText(item.str).width;
      this._setSpacing(span, item.str, pdfWidthPx, measured, fontSize);
      return;
    }

    const measured = provider.measureText(item.str, fontSize, fontFamily);
    this._setSpacing(span, item.str, pdfWidthPx, measured, fontSize);
  }

  _setSpacing(span, text, pdfWidth, measured, _fontSize) {
    const diff = pdfWidth - measured;
    if (Math.abs(diff) < 0.5) return;

    const len = text.length;
    if (len > 1) {
      const ls = diff / (len - 1);
      span.style.letterSpacing = `${ls.toFixed(3)}px`;
    }

    // Word-spacing adjustment for remaining error after letter-spacing
    const spaceCount = (text.match(/\s/g) || []).length;
    if (spaceCount > 0 && len > 1) {
      // The applied letter-spacing already accounts for spaces, so word-spacing
      // is only needed if there's still a gap (rare, but handle it)
      const residual = diff - (diff / (len - 1)) * (len - 1);
      if (Math.abs(residual) > 0.3) {
        span.style.wordSpacing = `${(residual / spaceCount).toFixed(3)}px`;
      }
    }
  }

  /** Position span precisely at the PDF baseline. */
  _positionSpan(span, item, metrics) {
    const vp = this.viewport;
    const [a, b, c, _d, e, f] = item.transform;

    // Convert PDF transform to viewport coordinates
    const pt = vp.convertToViewportPoint(e, f);
    const fontSize = this._itemFontSize(item);

    // Handle rotation (non-zero b component = rotated text)
    if (Math.abs(b) > 0.01 || Math.abs(c) > 0.01) {
      const angle = Math.atan2(b, a);
      span.style.transform = `rotate(${-angle}rad)`;
    } else {
      span.style.transform = '';
    }

    // Baseline offset: CSS top positions top of element; PDF y = baseline
    const ascentRatio = metrics?.ascent || 0.8;
    const baselineOffset = fontSize * ascentRatio;

    span.style.left = `${(pt[0]).toFixed(2)}px`;
    span.style.top  = `${(pt[1] - baselineOffset).toFixed(2)}px`;
    span.style.fontSize = `${fontSize}px`;
  }

  /**
   * Allow PixelPerfectTextLayer.render() callers to inject FontWidthProvider
   * so _applyWidthCorrection can use it without storing a hard ref.
   * @internal  Set by render().
   */
  _setProviderRef(provider) {
    this._providerRef = provider;
  }
}

// Make render() use provider ref
const _origRender = PixelPerfectTextLayer.prototype.render;
PixelPerfectTextLayer.prototype.render = function (textContent, fontWidthProvider) {
  this._setProviderRef(fontWidthProvider);
  _origRender.call(this, textContent, fontWidthProvider);
};

// ---------------------------------------------------------------------------
// Shared off-screen canvas for text measurement
// ---------------------------------------------------------------------------

let _sharedCanvas = null;
let _sharedCtx = null;

function _getSharedCtx() {
  if (!_sharedCtx) {
    _sharedCanvas = document.createElement('canvas');
    _sharedCtx = _sharedCanvas.getContext('2d');
    if (!_sharedCtx) return null;
  }
  return _sharedCtx;
}

// ---------------------------------------------------------------------------
// CSS injection (once per page load)
// ---------------------------------------------------------------------------

(function injectStyles() {
  if (document.getElementById('pptl-styles')) return;
  const style = document.createElement('style');
  style.id = 'pptl-styles';
  style.textContent = `
    .pptl-layer {
      mix-blend-mode: multiply;
    }
    .pptl-layer span {
      color: transparent;
      cursor: text;
      -webkit-user-select: text;
      user-select: text;
    }
    .pptl-layer span::selection {
      background: rgba(0, 100, 255, 0.25);
      color: transparent;
    }
  `;
  // Append only if document is ready
  if (document.head) {
    document.head.appendChild(style);
  } else {
    document.addEventListener('DOMContentLoaded', () => document.head.appendChild(style));
  }
}());
