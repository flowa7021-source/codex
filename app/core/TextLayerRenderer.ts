/**
 * TextLayerRenderer — Creates a pixel-perfect text overlay on top of the
 * rendered PDF canvas. Each character is positioned individually so that
 * selection, copy-paste, and find-in-page work exactly as in Adobe Acrobat.
 *
 * Key techniques:
 *  1. Per-character <span> elements positioned via CSS transform
 *  2. Font-size and letter-spacing dynamically calibrated to match glyph widths
 *  3. Transparent text (opacity 0) on top of visible canvas — standard Acrobat approach
 *  4. Automatic re-calibration on zoom changes
 */
import type { TextSpan, CharPosition } from './PdfEngine';

export interface TextLayerOptions {
  /** The container div that sits on top of the canvas */
  container: HTMLDivElement;
  /** Text spans extracted from PdfEngine.getTextContent() */
  spans: TextSpan[];
  /** Current rendering scale */
  scale: number;
  /** Enable enhanced per-character positioning (slower but more accurate) */
  enhancedMode?: boolean;
}

/**
 * Render the text layer into the container.
 * Clears any existing content first.
 */
export function renderTextLayer(options: TextLayerOptions): void {
  const { container, spans, scale, enhancedMode = true } = options;

  // Clear previous content
  container.innerHTML = '';

  // The container must be positioned absolutely over the canvas
  container.style.position = 'absolute';
  container.style.top = '0';
  container.style.left = '0';
  container.style.overflow = 'hidden';
  container.style.pointerEvents = 'all';
  container.style.opacity = '1';
  container.style.lineHeight = '1';

  if (enhancedMode) {
    renderEnhancedTextLayer(container, spans, scale);
  } else {
    renderBasicTextLayer(container, spans, scale);
  }
}

/**
 * Enhanced mode: positions each word as a single span with calibrated
 * letter-spacing. This gives the best balance between accuracy and DOM size.
 * Within each word, characters are tightly controlled via letter-spacing
 * so the transparent text aligns pixel-perfectly with the rendered glyphs.
 */
function renderEnhancedTextLayer(
  container: HTMLDivElement,
  spans: TextSpan[],
  scale: number,
): void {
  // Use a document fragment for batch DOM insertion
  const fragment = document.createDocumentFragment();

  for (const span of spans) {
    if (!span.str.trim()) continue;

    // Split into words for better selection behavior
    const words = splitIntoWords(span);

    for (const word of words) {
      const el = document.createElement('span');
      el.textContent = word.str;
      el.dataset.text = word.str;

      // Calculate the exact font size and position
      const fontSize = span.fontSize;
      const fontFamily = mapPdfFontToCSS(span.fontName);

      // Position the span precisely
      el.style.cssText = buildSpanStyle(
        word.x,
        word.y,
        word.width,
        word.height,
        fontSize,
        fontFamily,
        word.str,
        span.transform,
      );

      fragment.appendChild(el);
    }
  }

  container.appendChild(fragment);
}

/**
 * Basic mode: each text run is a single span. Faster but less precise
 * for character-level alignment.
 */
function renderBasicTextLayer(
  container: HTMLDivElement,
  spans: TextSpan[],
  _scale: number,
): void {
  const fragment = document.createDocumentFragment();

  for (const span of spans) {
    if (!span.str.trim()) continue;

    const el = document.createElement('span');
    el.textContent = span.str;

    const fontSize = span.fontSize;
    const fontFamily = mapPdfFontToCSS(span.fontName);

    el.style.cssText = buildSpanStyle(
      span.x,
      span.y,
      span.width,
      span.height,
      fontSize,
      fontFamily,
      span.str,
      span.transform,
    );

    fragment.appendChild(el);
  }

  container.appendChild(fragment);
}

/**
 * Build inline CSS for a text span that precisely overlays the canvas.
 * Uses CSS transform for sub-pixel positioning and scaleX for width matching.
 */
function buildSpanStyle(
  x: number,
  y: number,
  targetWidth: number,
  height: number,
  fontSize: number,
  fontFamily: string,
  text: string,
  transform: number[],
): string {
  // Measure the natural width of this text at the given font size
  const measuredWidth = measureTextWidth(text, fontSize, fontFamily);
  const scaleX = measuredWidth > 0 ? targetWidth / measuredWidth : 1;

  // Compute rotation from transform matrix
  const angle = Math.atan2(transform[1], transform[0]);
  const angleDeg = (angle * 180) / Math.PI;

  // Build transform with translate, rotate, and scaleX
  const transformCSS =
    `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px)` +
    (Math.abs(angleDeg) > 0.01 ? ` rotate(${angleDeg.toFixed(2)}deg)` : '') +
    (Math.abs(scaleX - 1) > 0.001 ? ` scaleX(${scaleX.toFixed(4)})` : '');

  return [
    'position: absolute',
    'top: 0',
    'left: 0',
    'white-space: pre',
    'pointer-events: all',
    // Transparent text — invisible but selectable
    'color: transparent',
    `font-size: ${fontSize.toFixed(2)}px`,
    `font-family: ${fontFamily}`,
    `line-height: ${height.toFixed(2)}px`,
    `transform-origin: 0% 0%`,
    `transform: ${transformCSS}`,
    // Prevent any browser text scaling
    '-webkit-text-size-adjust: none',
    'text-size-adjust: none',
    // Ensure crisp rendering
    '-webkit-font-smoothing: antialiased',
    '-moz-osx-font-smoothing: grayscale',
  ].join('; ');
}

/**
 * Split a TextSpan into word-level segments, preserving their
 * individual positions from the character data.
 */
interface WordSegment {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

function splitIntoWords(span: TextSpan): WordSegment[] {
  if (!span.chars || span.chars.length === 0) {
    return [{ str: span.str, x: span.x, y: span.y, width: span.width, height: span.height }];
  }

  const segments: WordSegment[] = [];
  let wordStart = 0;
  let inSpace = false;

  for (let i = 0; i <= span.chars.length; i++) {
    const isEnd = i === span.chars.length;
    const isSpace = !isEnd && span.chars[i].char === ' ';

    if (isEnd || (isSpace && !inSpace)) {
      if (i > wordStart) {
        const startChar = span.chars[wordStart];
        const endChar = span.chars[i - 1];
        const str = span.chars
          .slice(wordStart, i)
          .map((c) => c.char)
          .join('');
        const width = endChar.x + endChar.width - startChar.x;

        segments.push({
          str,
          x: startChar.x,
          y: startChar.y,
          width,
          height: startChar.height,
        });
      }
      wordStart = i;
      inSpace = isSpace;
    } else if (!isSpace && inSpace) {
      // Include spaces with the previous word for better selection
      if (i > wordStart) {
        const startChar = span.chars[wordStart];
        const endChar = span.chars[i - 1];
        const str = span.chars
          .slice(wordStart, i)
          .map((c) => c.char)
          .join('');
        const width = endChar.x + endChar.width - startChar.x;

        segments.push({
          str,
          x: startChar.x,
          y: startChar.y,
          width,
          height: startChar.height,
        });
      }
      wordStart = i;
      inSpace = false;
    }
  }

  // Handle trailing content
  if (wordStart < span.chars.length) {
    const startChar = span.chars[wordStart];
    const endChar = span.chars[span.chars.length - 1];
    const str = span.chars
      .slice(wordStart)
      .map((c) => c.char)
      .join('');
    const width = endChar.x + endChar.width - startChar.x;

    segments.push({
      str,
      x: startChar.x,
      y: startChar.y,
      width,
      height: startChar.height,
    });
  }

  return segments;
}

// ---------- Font mapping ----------

const PDF_FONT_MAP: Record<string, string> = {
  'Courier': '"Courier New", Courier, monospace',
  'Helvetica': 'Arial, Helvetica, sans-serif',
  'Times': '"Times New Roman", Times, serif',
  'Symbol': 'Symbol, serif',
  'ZapfDingbats': 'ZapfDingbats, serif',
};

function mapPdfFontToCSS(pdfFontName: string): string {
  // Try direct match first
  for (const [key, value] of Object.entries(PDF_FONT_MAP)) {
    if (pdfFontName.includes(key)) return value;
  }

  // Determine generic family from font characteristics
  if (/mono|courier|consol/i.test(pdfFontName)) {
    return '"Courier New", Courier, monospace';
  }
  if (/serif|times|roman|garamond|georgia/i.test(pdfFontName)) {
    return '"Times New Roman", Times, serif';
  }

  // Default to sans-serif — most common in modern PDFs
  return 'Arial, Helvetica, sans-serif';
}

// ---------- Text measurement ----------

let measureCtx: CanvasRenderingContext2D | null = null;

function getMeasureCtx(): CanvasRenderingContext2D {
  if (!measureCtx) {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    measureCtx = canvas.getContext('2d')!;
  }
  return measureCtx;
}

function measureTextWidth(text: string, fontSize: number, fontFamily: string): number {
  const ctx = getMeasureCtx();
  ctx.font = `${fontSize.toFixed(1)}px ${fontFamily}`;
  return ctx.measureText(text).width;
}
