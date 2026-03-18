/**
 * PdfEngine — core PDF document management.
 * Wraps pdfjs-dist to load, cache, and render PDF pages.
 */
import * as pdfjsLib from 'pdfjs-dist';
import type {
  PDFDocumentProxy,
  PDFPageProxy,
  TextItem,
  TextMarkedContent,
} from 'pdfjs-dist/types/src/display/api';

// Worker will be served from the dist root via CopyWebpackPlugin
pdfjsLib.GlobalWorkerOptions.workerSrc = './pdf.worker.min.mjs';

export interface PageInfo {
  index: number; // 0-based
  width: number;
  height: number;
  rotation: number;
}

export interface TextSpan {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontName: string;
  fontSize: number;
  /** Individual character positions for per-character overlay */
  chars: CharPosition[];
  transform: number[];
  direction: 'ltr' | 'rtl';
}

export interface CharPosition {
  char: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export class PdfEngine {
  private doc: PDFDocumentProxy | null = null;
  private pageCache = new Map<number, PDFPageProxy>();
  private url: string | Uint8Array | null = null;

  get pageCount(): number {
    return this.doc?.numPages ?? 0;
  }

  get isLoaded(): boolean {
    return this.doc !== null;
  }

  async load(source: string | ArrayBuffer | Uint8Array): Promise<void> {
    this.dispose();
    const src =
      source instanceof ArrayBuffer
        ? { data: new Uint8Array(source) }
        : source instanceof Uint8Array
          ? { data: source }
          : { url: source };

    this.doc = await pdfjsLib.getDocument(src).promise;
    if (typeof source === 'string') this.url = source;
  }

  async getPageInfo(pageIndex: number): Promise<PageInfo> {
    const page = await this.getPage(pageIndex);
    const vp = page.getViewport({ scale: 1 });
    return {
      index: pageIndex,
      width: vp.width,
      height: vp.height,
      rotation: page.rotate,
    };
  }

  /**
   * Render a page onto a canvas at the given scale.
   * Returns the actual pixel dimensions used.
   */
  async renderPage(
    pageIndex: number,
    canvas: HTMLCanvasElement,
    scale: number,
    devicePixelRatio: number = window.devicePixelRatio || 1,
  ): Promise<{ width: number; height: number }> {
    const page = await this.getPage(pageIndex);
    const totalScale = scale * devicePixelRatio;
    const viewport = page.getViewport({ scale: totalScale });

    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.style.width = `${viewport.width / devicePixelRatio}px`;
    canvas.style.height = `${viewport.height / devicePixelRatio}px`;

    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, viewport.width, viewport.height);

    await page.render({
      canvasContext: ctx,
      viewport,
    }).promise;

    return {
      width: viewport.width / devicePixelRatio,
      height: viewport.height / devicePixelRatio,
    };
  }

  /**
   * Extract text content with precise per-character positioning.
   * This is the key to Adobe-quality text overlay — each character
   * gets its own computed bounding box.
   */
  async getTextContent(
    pageIndex: number,
    scale: number,
  ): Promise<TextSpan[]> {
    const page = await this.getPage(pageIndex);
    const viewport = page.getViewport({ scale });
    const textContent = await page.getTextContent({
      includeMarkedContent: false,
    });

    const spans: TextSpan[] = [];

    for (const item of textContent.items) {
      if (isMarkedContent(item)) continue;
      const textItem = item as TextItem;
      if (!textItem.str || textItem.str.length === 0) continue;

      const tx = pdfjsLib.Util.transform(
        viewport.transform,
        textItem.transform,
      );

      // tx is [scaleX, skewY, skewX, scaleY, translateX, translateY]
      const fontHeight = Math.hypot(tx[2], tx[3]);
      const fontWidth = Math.hypot(tx[0], tx[1]);
      const angle = Math.atan2(tx[1], tx[0]);

      // Base position (bottom-left of the text run in CSS coords)
      const baseX = tx[4];
      const baseY = tx[5];

      // Total width of the text run as reported by pdf.js
      const totalWidth = textItem.width * scale;
      const totalHeight = textItem.height * scale;

      const str = textItem.str;
      const direction = (textItem.dir as 'ltr' | 'rtl') || 'ltr';

      // Compute per-character widths using the font metrics
      // pdf.js provides total width; we distribute proportionally
      // using a canvas measurement fallback for accurate char widths
      const chars = computeCharPositions(
        str,
        baseX,
        baseY,
        totalWidth,
        fontHeight,
        fontWidth,
        angle,
        direction,
        textItem.fontName,
      );

      spans.push({
        str,
        x: baseX,
        y: baseY - fontHeight,
        width: totalWidth,
        height: fontHeight,
        fontName: textItem.fontName,
        fontSize: fontHeight,
        chars,
        transform: tx,
        direction,
      });
    }

    return spans;
  }

  /**
   * Get the underlying pdfjs page (cached).
   */
  async getPage(pageIndex: number): Promise<PDFPageProxy> {
    if (!this.doc) throw new Error('No document loaded');
    if (pageIndex < 0 || pageIndex >= this.doc.numPages) {
      throw new RangeError(`Page index ${pageIndex} out of range`);
    }
    let page = this.pageCache.get(pageIndex);
    if (!page) {
      page = await this.doc.getPage(pageIndex + 1); // pdfjs is 1-based
      this.pageCache.set(pageIndex, page);
    }
    return page;
  }

  /**
   * Get document metadata.
   */
  async getMetadata() {
    if (!this.doc) return null;
    const meta = await this.doc.getMetadata();
    return {
      title: (meta.info as Record<string, unknown>)?.['Title'] as string || '',
      author: (meta.info as Record<string, unknown>)?.['Author'] as string || '',
      subject: (meta.info as Record<string, unknown>)?.['Subject'] as string || '',
      creator: (meta.info as Record<string, unknown>)?.['Creator'] as string || '',
      producer: (meta.info as Record<string, unknown>)?.['Producer'] as string || '',
      creationDate: (meta.info as Record<string, unknown>)?.['CreationDate'] as string || '',
    };
  }

  /**
   * Get document outline (bookmarks).
   */
  async getOutline() {
    if (!this.doc) return [];
    const outline = await this.doc.getOutline();
    return outline || [];
  }

  dispose(): void {
    if (this.doc) {
      this.doc.destroy();
      this.doc = null;
    }
    this.pageCache.clear();
    this.url = null;
  }
}

// ---------- Helpers ----------

function isMarkedContent(item: TextItem | TextMarkedContent): item is TextMarkedContent {
  return 'type' in item && item.type === 'beginMarkedContent';
}

/**
 * Off-screen canvas used to measure character widths for proportional
 * distribution. This gives us near-exact per-character x offsets.
 */
const measureCanvas = (() => {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = 1;
  c.height = 1;
  return c;
})();

function measureCharWidths(str: string, fontName: string, fontSize: number): number[] {
  if (!measureCanvas || str.length === 0) return [];
  const ctx = measureCanvas.getContext('2d')!;

  // Use a generic sans-serif as approximation; the proportional distribution
  // will be scaled to match the actual total width from pdf.js anyway.
  const cssFontName = fontName.includes('Bold')
    ? 'bold'
    : fontName.includes('Italic')
      ? 'italic'
      : 'normal';
  ctx.font = `${cssFontName} ${fontSize}px sans-serif`;

  const widths: number[] = [];
  for (let i = 0; i < str.length; i++) {
    widths.push(ctx.measureText(str[i]).width);
  }
  return widths;
}

function computeCharPositions(
  str: string,
  baseX: number,
  baseY: number,
  totalWidth: number,
  fontHeight: number,
  _fontWidth: number,
  angle: number,
  direction: 'ltr' | 'rtl',
  fontName: string,
): CharPosition[] {
  const chars: CharPosition[] = [];
  if (str.length === 0) return chars;

  // Measure relative widths
  const rawWidths = measureCharWidths(str, fontName, fontHeight);
  const rawTotal = rawWidths.reduce((a, b) => a + b, 0);

  // Scale to actual total width
  const scaleFactor = rawTotal > 0 ? totalWidth / rawTotal : 1;
  const charWidths = rawWidths.map((w) => w * scaleFactor);

  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  let offsetX = 0;
  const indices =
    direction === 'rtl'
      ? Array.from({ length: str.length }, (_, i) => str.length - 1 - i)
      : Array.from({ length: str.length }, (_, i) => i);

  for (const i of indices) {
    const w = charWidths[i] || totalWidth / str.length;
    const cx = baseX + offsetX * cos;
    const cy = baseY + offsetX * sin;

    chars.push({
      char: str[i],
      x: cx,
      y: cy - fontHeight,
      width: w,
      height: fontHeight,
    });

    offsetX += w;
  }

  return chars;
}
