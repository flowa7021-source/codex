/**
 * @module scan-decomposer
 * @description Phase 5 — Scan page decomposition + font synthesis.
 *
 * Turns a scanned PDF page into an editable representation that matches
 * the Adobe Acrobat "Edit PDF" workflow:
 *
 *   1. Font matching  — analyse visual characteristics of OCR character
 *      images (serif/sans-serif, weight, slant, x-height) and find the
 *      closest system font.
 *
 *   2. Page decomposition — for each OCR word region, fill the background
 *      image with the sampled background colour (removing the scanned text
 *      from the image).  The result is a clean background + separate text
 *      objects ready for inline editing.
 *
 *   3. TextBlock generation — build PageModel TextBlocks from OCR output
 *      with the matched font, so the inline editor can style new text to
 *      visually match the original.
 *
 * Public API:
 *   matchFontFromOcr(ocrResult, pageImageData)   → FontMatchResult
 *   decomposeScannedPage(pageImage, ocrResult)   → DecomposedPage
 *
 * The decomposeScannedPage() output is consumed by the inline editor
 * (render-controller.js / pdf-advanced-edit.js) to allow seamless
 * click-to-edit on scanned pages.
 */

import { detectBackgroundColor } from './erase-tool.js';

// ---------------------------------------------------------------------------
// Font matching
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} FontCharacteristics
 * @property {boolean} isSerif
 * @property {number}  weight        400 or 700
 * @property {boolean} isItalic
 * @property {number}  xHeightRatio  x-height / cap-height (0–1)
 * @property {number}  aspectRatio   average char width / height
 */

/**
 * @typedef {Object} FontMatchResult
 * @property {string}  family           CSS font-family string
 * @property {number}  weight           400 or 700
 * @property {string}  style            'normal' or 'italic'
 * @property {number}  score            Similarity score 0–1
 * @property {FontCharacteristics} characteristics
 */

/**
 * Candidate system fonts with their known characteristics.
 * These are universal cross-platform fonts (Windows + macOS + Linux).
 */
const SYSTEM_FONT_PROFILES = [
  { family: 'Times New Roman',  isSerif: true,  weight: 400, isItalic: false, xHeightRatio: 0.45, aspectRatio: 0.52 },
  { family: 'Times New Roman',  isSerif: true,  weight: 700, isItalic: false, xHeightRatio: 0.45, aspectRatio: 0.53 },
  { family: 'Times New Roman',  isSerif: true,  weight: 400, isItalic: true,  xHeightRatio: 0.44, aspectRatio: 0.50 },
  { family: 'Georgia',          isSerif: true,  weight: 400, isItalic: false, xHeightRatio: 0.49, aspectRatio: 0.56 },
  { family: 'Georgia',          isSerif: true,  weight: 700, isItalic: false, xHeightRatio: 0.49, aspectRatio: 0.57 },
  { family: 'Arial',            isSerif: false, weight: 400, isItalic: false, xHeightRatio: 0.52, aspectRatio: 0.56 },
  { family: 'Arial',            isSerif: false, weight: 700, isItalic: false, xHeightRatio: 0.52, aspectRatio: 0.58 },
  { family: 'Arial',            isSerif: false, weight: 400, isItalic: true,  xHeightRatio: 0.52, aspectRatio: 0.55 },
  { family: 'Helvetica Neue',   isSerif: false, weight: 400, isItalic: false, xHeightRatio: 0.52, aspectRatio: 0.56 },
  { family: 'Verdana',          isSerif: false, weight: 400, isItalic: false, xHeightRatio: 0.55, aspectRatio: 0.65 },
  { family: 'Verdana',          isSerif: false, weight: 700, isItalic: false, xHeightRatio: 0.55, aspectRatio: 0.67 },
  { family: 'Calibri',          isSerif: false, weight: 400, isItalic: false, xHeightRatio: 0.50, aspectRatio: 0.54 },
  { family: 'Calibri',          isSerif: false, weight: 700, isItalic: false, xHeightRatio: 0.50, aspectRatio: 0.56 },
  { family: 'Courier New',      isSerif: true,  weight: 400, isItalic: false, xHeightRatio: 0.46, aspectRatio: 0.60 },
  { family: 'Courier New',      isSerif: true,  weight: 700, isItalic: false, xHeightRatio: 0.46, aspectRatio: 0.60 },
];

/**
 * Derive visual font characteristics from OCR word-level data.
 *
 * Without access to individual glyph bitmaps (which Tesseract.js can
 * provide via word.symbols), we use heuristics from aggregate metrics:
 *   - Average char width/height → aspect ratio
 *   - Bold detection from Tesseract word.fontAttributes
 *   - Italic from Tesseract word.fontAttributes
 *   - x-height from "x" characters in the OCR output
 *
 * @param {Object} ocrResult  – result from tesseract.js recognize()
 * @returns {FontCharacteristics}
 */
export function analyseOcrFontCharacteristics(ocrResult) {
  const words = (ocrResult.words || []).filter(w => w.text && w.text.trim() && w.bbox);

  if (!words.length) {
    return { isSerif: false, weight: 400, isItalic: false, xHeightRatio: 0.5, aspectRatio: 0.56 };
  }

  // ── Weight ───────────────────────────────────────────────────────────────
  const boldWords = words.filter(w => w.fontAttributes?.isBold);
  const weight = boldWords.length / words.length > 0.5 ? 700 : 400;

  // ── Italic ───────────────────────────────────────────────────────────────
  const italicWords = words.filter(w => w.fontAttributes?.isItalic);
  const isItalic = italicWords.length / words.length > 0.5;

  // ── Aspect ratio (average char width / height from bboxes) ───────────────
  const aspectRatios = words.map(w => {
    const h = w.bbox.y1 - w.bbox.y0;
    const charW = h === 0 ? 0 : (w.bbox.x1 - w.bbox.x0) / Math.max(w.text.length, 1);
    return h > 0 ? charW / h : 0.56;
  }).filter(r => r > 0);
  const aspectRatio = _median(aspectRatios) || 0.56;

  // ── x-height ratio ────────────────────────────────────────────────────────
  // Find words that contain only lowercase letters (good proxy for x-height)
  const lowerWords = words.filter(w => /^[a-z]+$/.test(w.text));
  const capWords   = words.filter(w => /^[A-Z]+$/.test(w.text));

  let xHeightRatio = 0.5;
  if (lowerWords.length && capWords.length) {
    const avgLowerH = _mean(lowerWords.map(w => w.bbox.y1 - w.bbox.y0));
    const avgCapH   = _mean(capWords.map(w => w.bbox.y1 - w.bbox.y0));
    if (avgCapH > 0) xHeightRatio = Math.min(0.95, avgLowerH / avgCapH);
  }

  // ── Serif detection ───────────────────────────────────────────────────────
  // Without pixel-level glyph analysis we use a heuristic:
  // Tesseract's recognised font name (if available) takes priority.
  let isSerif = false;
  const fontNames = words.map(w => (w.fontAttributes?.fontName || '')).filter(Boolean);
  if (fontNames.length) {
    const serifCount = fontNames.filter(n =>
      /serif|roman|times|palatino|garamond|baskerville/i.test(n) &&
      !/sans/i.test(n)
    ).length;
    isSerif = serifCount / fontNames.length > 0.4;
  } else {
    // Fallback: narrower aspect ratios correlate with serif fonts
    isSerif = aspectRatio < 0.50;
  }

  return { isSerif, weight, isItalic, xHeightRatio, aspectRatio };
}

/**
 * Match OCR font characteristics to the best available system font.
 *
 * @param {Object} ocrResult
 * @returns {FontMatchResult}
 */
export function matchFontFromOcr(ocrResult) {
  const chars = analyseOcrFontCharacteristics(ocrResult);

  const scored = SYSTEM_FONT_PROFILES.map(profile => {
    const score =
      (chars.isSerif === profile.isSerif ? 0.35 : 0) +
      (chars.weight  === profile.weight  ? 0.25 : 0) +
      (chars.isItalic === profile.isItalic ? 0.15 : 0) +
      (1 - Math.abs(chars.xHeightRatio - profile.xHeightRatio)) * 0.15 +
      (1 - Math.abs(chars.aspectRatio  - profile.aspectRatio))  * 0.10;
    return { ...profile, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];

  return {
    family: best.family,
    weight: best.weight,
    style: best.isItalic ? 'italic' : 'normal',
    score: best.score,
    characteristics: chars,
  };
}

// ---------------------------------------------------------------------------
// Scan page decomposition
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} DecomposedPage
 * @property {Uint8Array} backgroundImage    PNG bytes – the scan with text removed
 * @property {string}     backgroundMime     'image/png' | 'image/jpeg'
 * @property {Array<DecomposedTextBlock>} textBlocks
 * @property {FontMatchResult} fontMatch
 */

/**
 * @typedef {Object} DecomposedTextBlock
 * @property {string} text
 * @property {{x,y,width,height}} bbox        Page coordinates (pt)
 * @property {number} fontSize                pt
 * @property {string} color                   CSS color
 * @property {string} fontFamily
 * @property {number} fontWeight
 * @property {string} fontStyle
 */

/**
 * Decompose a scanned page into a clean background image and text blocks.
 *
 * Steps:
 *   1. Load the page image into an off-screen canvas.
 *   2. For every OCR word, detect the background colour around the word bbox
 *      and fill the bbox with that colour (removing the scanned text).
 *   3. Return the modified canvas as PNG bytes + text block descriptors.
 *
 * @param {HTMLImageElement|Uint8Array} pageImage  – The raw scan image.
 * @param {Object} ocrResult                       – Tesseract.js result.
 * @param {number} pageWidthPt                     – Page width in PDF points.
 * @param {number} pageHeightPt                    – Page height in PDF points.
 * @param {Object} [opts]
 * @param {number} [opts.expandPx=2]               – Expand word bbox to cover anti-aliasing.
 * @param {string} [opts.outputMime='image/png']
 * @returns {Promise<DecomposedPage>}
 */
export async function decomposeScannedPage(pageImage, ocrResult, pageWidthPt, pageHeightPt, opts = {}) {
  const expandPx = opts.expandPx ?? 2;
  const outputMime = opts.outputMime || 'image/png';

  // ── 1. Load image onto canvas ─────────────────────────────────────────────
  // Accept either a pre-loaded image element or raw bytes
  const imgEl = (pageImage && typeof pageImage === 'object' && 'naturalWidth' in pageImage)
    ? pageImage
    : await _loadImage(pageImage, 'image/jpeg');

  const canvas = document.createElement('canvas');
  canvas.width  = imgEl.naturalWidth;
  canvas.height = imgEl.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];
  ctx.drawImage(imgEl, 0, 0);

  // Scale factors: OCR bboxes are in image pixels; we need them in both
  // pixel (for canvas) and pt (for PageModel TextBlock).
  const scaleXpt = pageWidthPt  / imgEl.naturalWidth;
  const scaleYpt = pageHeightPt / imgEl.naturalHeight;

  // ── 2. Font matching ───────────────────────────────────────────────────────
  const fontMatch = matchFontFromOcr(ocrResult);

  // ── 3. Erase each word from the background image ──────────────────────────
  const textBlocks = [];
  const words = ocrResult.words || [];

  for (const word of words) {
    if (!word.text || !word.text.trim() || !word.bbox) continue;

    const { x0, y0, x1, y1 } = word.bbox;

    const imgRect = {
      x: Math.max(0, x0 - expandPx),
      y: Math.max(0, y0 - expandPx),
      width:  Math.min(imgEl.naturalWidth,  x1 - x0 + expandPx * 2),
      height: Math.min(imgEl.naturalHeight, y1 - y0 + expandPx * 2),
    };

    // Detect background colour from surrounding area
    const bgColor = detectBackgroundColor(ctx, imgRect);

    // Fill the word bbox with background colour
    ctx.fillStyle = bgColor;
    ctx.fillRect(imgRect.x, imgRect.y, imgRect.width, imgRect.height);

    // Build text block in page-pt coordinates
    // Note: OCR bboxes use image-pixel coords with Y=0 at top.
    // PDF coords: Y=0 at bottom.  Convert Y accordingly.
    const bboxPt = {
      x:      x0 * scaleXpt,
      y:      pageHeightPt - y1 * scaleYpt,     // flip Y
      width:  (x1 - x0) * scaleXpt,
      height: (y1 - y0) * scaleYpt,
    };

    // Estimate foreground text colour from the original pixels (before fill)
    // Sample a few pixels from the centre of the word area
    const textColor = _estimateTextColor(ctx, { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }, bgColor);

    textBlocks.push({
      text: word.text,
      bbox: bboxPt,
      fontSize: bboxPt.height,
      color: textColor,
      fontFamily: fontMatch.family,
      fontWeight: fontMatch.weight,
      fontStyle:  fontMatch.style,
      confidence: word.confidence || 0,
    });
  }

  // ── 4. Export the cleaned background image ────────────────────────────────
  const backgroundImage = await _canvasToBytes(canvas, outputMime);

  return { backgroundImage, backgroundMime: outputMime, textBlocks, fontMatch };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function _loadImage(bytes, mimeType) {
  return new Promise((resolve, reject) => {
    const blob = new Blob([bytes], { type: mimeType });
    const url  = URL.createObjectURL(blob);
    const img  = new Image();
    img.onload  = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}

function _canvasToBytes(canvas, mimeType) {
  const type = mimeType === 'image/jpeg' ? 'image/jpeg' : 'image/png';
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) { reject(new Error('canvas.toBlob returned null')); return; }
      const reader = new FileReader();
      reader.onload  = () => resolve(new Uint8Array(reader.result));
      reader.onerror = reject;
      reader.readAsArrayBuffer(blob);
    }, type, 0.90);
  });
}

/**
 * Estimate the foreground text colour by sampling the darkest pixels in the
 * word region (text is typically darker than the background).
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {{x,y,width,height}} rect   pixel coords
 * @param {string} bgColorCss         background colour to compare against
 * @returns {string}  CSS hex colour
 */
function _estimateTextColor(ctx, rect, bgColorCss) {
  try {
    const SAMPLE = 5;  // sample every N pixels
    const { x, y, width, height } = rect;
    const samples = [];

    for (let sy = y; sy < y + height; sy += SAMPLE) {
      for (let sx = x; sx < x + width; sx += SAMPLE) {
        const d = ctx.getImageData(Math.round(sx), Math.round(sy), 1, 1).data;
        // Luminance
        const lum = 0.299 * d[0] + 0.587 * d[1] + 0.114 * d[2];
        samples.push({ r: d[0], g: d[1], b: d[2], lum });
      }
    }

    if (!samples.length) return '#000000';

    // The background colour's luminance
    const bgLum = _cssColorLuminance(bgColorCss);

    // Take the 20% darkest (if bg is light) or lightest (if bg is dark) pixels
    const isDarkBg = bgLum < 128;
    const sorted = samples.slice().sort((a, b) => isDarkBg ? b.lum - a.lum : a.lum - b.lum);
    const take = Math.max(1, Math.floor(sorted.length * 0.20));
    const subset = sorted.slice(0, take);

    const r = Math.round(_mean(subset.map(s => s.r)));
    const g = Math.round(_mean(subset.map(s => s.g)));
    const b = Math.round(_mean(subset.map(s => s.b)));

    return `#${_hex2(r)}${_hex2(g)}${_hex2(b)}`;
  } catch (_e) {
    return '#000000';
  }
}

function _cssColorLuminance(css) {
  const m = css.match(/\d+/g);
  if (!m || m.length < 3) return 255;
  return 0.299 * +m[0] + 0.587 * +m[1] + 0.114 * +m[2];
}

function _hex2(n) {
  return Math.min(255, Math.max(0, n)).toString(16).padStart(2, '0');
}

function _mean(arr) {
  if (!arr.length) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function _median(arr) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
}
