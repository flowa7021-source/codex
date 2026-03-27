// @ts-check
// ─── Text Layer Rendering Sub-module ────────────────────────────────────────
// Text layer creation/management: PDF.js TextLayer, OCR text layer,
// inline editing, paragraph editing, and text-to-storage sync.
// Split from render-controller.js for maintainability.

import { state, els as _els } from './state.js';

/** @type {Record<string, any>} */
const els = _els;
import { getPdfjsLib } from './loaders.js';
import { loadOcrTextData } from './workspace-controller.js';
import { setPageEdits, persistEdits } from './export-controller.js';
import { blockEditor } from './pdf-advanced-edit.js';
import { renderConfidenceOverlay } from './ocr-confidence-map.js';
import { PixelPerfectTextLayer, FontWidthProvider } from './pixel-perfect-text-layer.js';
import { estimatePageSkewAngle } from './ocr-image-processing.js';

// ─── Late-bound dependencies ────────────────────────────────────────────────
const _deps = {
  setOcrStatus: () => {},
};

/** @param {any} deps @returns {any} */
export function initRenderTextLayerDeps(deps) {
  Object.assign(_deps, deps);
}

// ─── Module-local state ─────────────────────────────────────────────────────

/** OCR word-level data per page, reused by DOCX export & search */
export const _ocrWordCache = new Map();

/** Track active TextLayer instance for cleanup */
let _activeTextLayer = null;

/** Active inline text editor element */
let _activeInlineEditor = null;

/** Get/set active text layer (used by render-controller for cleanup) */
export function getActiveTextLayer() { return _activeTextLayer; }
/** @param {any} tl @returns {any} */
export function setActiveTextLayer(tl) { _activeTextLayer = tl; }

/** Get/set active inline editor (used by render-controller for cleanup) */
export function getActiveInlineEditor() { return _activeInlineEditor; }
/** @param {any} ed @returns {any} */
export function setActiveInlineEditor(ed) { _activeInlineEditor = ed; }

// ─── PDF.js Annotation Layer ───────────────────────────────────────────────

/**
 * Render PDF.js AnnotationLayer (links, form widgets, etc.)
 */
export async function _renderPdfAnnotationLayer(page, viewport) {
  const container = els.pdfAnnotationLayer;
  if (!container) return;
  container.innerHTML = '';
  container.style.width = `${viewport.width}px`;
  container.style.height = `${viewport.height}px`;

  const pdfjsLib = getPdfjsLib();
  if (!pdfjsLib?.AnnotationLayer) return;

  try {
    const annotations = await page.getAnnotations({ intent: 'display' });
    if (!annotations?.length) return;

    const parameters = {
      viewport: viewport.clone({ dontFlip: true }),
      div: container,
      annotations,
      page,
      linkService: {
        getDestinationHash: (_dest) => `#`,
        getAnchorUrl: (hash) => hash,
        addLinkAttributes: (link, url) => {
          link.href = url;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
        },
        isPageVisible: () => true,
        isPageCached: () => true,
      },
      renderForms: false,
    };

    const annotationLayer = new pdfjsLib.AnnotationLayer(parameters);
    await annotationLayer.render(parameters);
  } catch (err) {
    console.warn('AnnotationLayer render failed:', err);
  }
}

/**
 * Fallback: manual text layer rendering for older pdf.js without TextLayer class
 */
export function _renderManualTextLayer(container, textContent, viewport, zoom) {
  const fragment = document.createDocumentFragment();
  const transform = viewport.transform;

  for (const item of textContent.items) {
    if (!item.str || !item.str.trim()) continue;

    const span = document.createElement('span');
    span.textContent = item.str;

    // Apply viewport transform to get display coordinates
    const tx = item.transform;
    // PDF transform: [scaleX, skewY, skewX, scaleY, translateX, translateY]
    const x = transform[0] * tx[4] + transform[2] * tx[5] + transform[4];
    const y = transform[1] * tx[4] + transform[3] * tx[5] + transform[5];
    const fontSize = Math.sqrt(tx[0] * tx[0] + tx[1] * tx[1]);
    const scaledFontSize = fontSize * zoom;

    span.style.left = `${x}px`;
    span.style.top = `${y - scaledFontSize}px`;
    span.style.fontSize = `${scaledFontSize}px`;
    span.style.fontFamily = item.fontName || 'sans-serif';
    span.style.position = 'absolute';
    span.style.whiteSpace = 'nowrap';
    span.style.color = 'transparent';
    span.style.lineHeight = '1';

    if (item.width) {
      span.style.width = `${item.width * zoom}px`;
      span.style.letterSpacing = '0px';
      span.style.overflow = 'hidden';
    }

    fragment.appendChild(span);
  }

  container.appendChild(fragment);
}

// ─── Main Text Layer Render ────────────────────────────────────────────────

/** @param {any} pageNum @param {any} zoom @param {any} rotation @returns {Promise<any>} */
export async function renderTextLayer(pageNum, zoom, rotation) {
  const container = els.textLayerDiv;
  if (!container) return;

  // Clean up previous TextLayer instance
  if (_activeTextLayer) {
    try { _activeTextLayer.cancel(); } catch (err) { console.warn('[render-controller] error:', err?.message); }
    _activeTextLayer = null;
  }
  container.innerHTML = '';
  if (els.pdfAnnotationLayer) els.pdfAnnotationLayer.innerHTML = '';
  container.style.width = els.canvas.style.width;
  container.style.height = els.canvas.style.height;

  if (!state.adapter) return;

  const dpr = Math.max(1, window.devicePixelRatio || 1);

  // ── Path 1: PDF.js official TextLayer API ──
  if (state.adapter.type === 'pdf') {
    const pdfjsLib = getPdfjsLib();
    const page = await state.adapter.pdfDoc.getPage(pageNum);
    const displayViewport = page.getViewport({ scale: zoom, rotation });

    try {
      const textContent = await page.getTextContent({ normalizeWhitespace: true });

      if (!textContent?.items?.length) {
        container.classList.add('ocr-text-layer');
        await _renderOcrTextLayer(pageNum, zoom, dpr);
        return;
      }
      container.classList.remove('ocr-text-layer');

      // Size container to match display dimensions
      const displayW = parseFloat(els.canvas.style.width) || displayViewport.width;
      const displayH = parseFloat(els.canvas.style.height) || displayViewport.height;
      container.style.width = `${displayW}px`;
      container.style.height = `${displayH}px`;

      // Use pixel-perfect text layer when enabled (experimental)
      if (state.settings?.usePixelPerfectText && textContent?.items?.length) {
        try {
          const provider = new FontWidthProvider();
          await provider.loadFromPage(page);
          const pptl = new PixelPerfectTextLayer(container, displayViewport);
          pptl.render(textContent, provider);
          _activeTextLayer = pptl;
          _renderPdfAnnotationLayer(page, displayViewport).catch((err) => { console.warn('[render-controller] error:', err?.message); });
          return;
        } catch (_err) {
          console.warn('[render-text-layer] Pixel-perfect text layer failed, using standard:', _err?.message);
          // Fall through to standard TextLayer
        }
      }

      // Use official PDF.js TextLayer if available
      if (pdfjsLib?.TextLayer) {
        // Set --scale-factor CSS variable required by PDF.js TextLayer
        container.style.setProperty('--scale-factor', String(zoom));

        const textLayer = new pdfjsLib.TextLayer({
          container,
          textContentSource: textContent,
          viewport: displayViewport,
        });
        _activeTextLayer = textLayer;
        await textLayer.render();

        // Also render AnnotationLayer for interactive elements (links, widgets)
        _renderPdfAnnotationLayer(page, displayViewport).catch((err) => { console.warn('[render-controller] error:', err?.message); });
      } else {
        // Fallback: manual text layer (for older pdf.js without TextLayer class)
        _renderManualTextLayer(container, textContent, displayViewport, zoom);
      }
    } catch (err) {
      console.warn('Text layer render failed:', err);
    }
    // Re-enable active modes after DOM rebuild
    if (state.textEditMode) enableInlineTextEditing();
    if (_eraseMode) enableTextEraseMode();
    return;
  }

  // ── Path 2: OCR-based text layer ──
  await _renderOcrTextLayer(pageNum, zoom, dpr);

  // ── Re-enable active modes after DOM rebuild ──
  // renderTextLayer clears and rebuilds the container (innerHTML = ''),
  // which strips classes and event listeners. Re-attach them.
  if (state.textEditMode) {
    enableInlineTextEditing();
  }
  if (_eraseMode) {
    enableTextEraseMode();
  }
}

// ─── Font family selection for OCR text overlay ─────────────────────────────
// Maps Tesseract font names to CSS font stacks. Covers the most common
// document fonts (serif, sans-serif, monospace, display).
const _FONT_MAP = {
  'times': '"Times New Roman", Times, Georgia, serif',
  'georgia': 'Georgia, "Times New Roman", serif',
  'garamond': 'Garamond, Georgia, serif',
  'palatino': '"Palatino Linotype", Palatino, Georgia, serif',
  'arial': 'Arial, Helvetica, sans-serif',
  'helvetica': 'Helvetica, Arial, sans-serif',
  'verdana': 'Verdana, Geneva, sans-serif',
  'tahoma': 'Tahoma, Geneva, sans-serif',
  'calibri': 'Calibri, "Segoe UI", Tahoma, sans-serif',
  'trebuchet': '"Trebuchet MS", Verdana, sans-serif',
  'courier': '"Courier New", Courier, monospace',
  'consolas': 'Consolas, "Courier New", monospace',
  'impact': 'Impact, "Arial Black", sans-serif',
  'comic': '"Comic Sans MS", cursive, sans-serif',
};
const _FONT_DEFAULT_SANS = 'Arial, Helvetica, "Liberation Sans", sans-serif';
const _FONT_DEFAULT_SERIF = '"Times New Roman", Times, "Liberation Serif", serif';
const _FONT_DEFAULT_MONO = '"Courier New", Courier, monospace';

/**
 * Pick the best CSS font-family for a Tesseract word.
 * Uses the word's font_name if available, otherwise falls back to serif
 * for languages that typically use serif (Cyrillic documents) and
 * sans-serif for others.
 * @param {any} word
 * @returns {string}
 */
function _pickFontFamily(word) {
  const rawFont = String(word.font_name || word.fontName || '').toLowerCase();
  if (rawFont) {
    for (const [key, stack] of Object.entries(_FONT_MAP)) {
      if (rawFont.includes(key)) return stack;
    }
    // Heuristic: mono fonts have fixed-width hints
    if (rawFont.includes('mono') || rawFont.includes('fixed') || rawFont.includes('code')) {
      return _FONT_DEFAULT_MONO;
    }
    // Heuristic: serif detection
    if (rawFont.includes('serif') && !rawFont.includes('sans')) {
      return _FONT_DEFAULT_SERIF;
    }
  }
  // Default: sans-serif is the safest cross-platform choice
  return _FONT_DEFAULT_SANS;
}

/** @param {any} pageNum @param {any} zoom @param {any} dpr @returns {Promise<any>} */
export async function _renderOcrTextLayer(pageNum, zoom, dpr) {
  const container = els.textLayerDiv;
  if (!container) return;

  // Check OCR word cache
  let words = _ocrWordCache.get(pageNum);
  if (!words) {
    const ocr = loadOcrTextData();
    if (ocr?.pagesWords?.[pageNum - 1]) {
      words = ocr.pagesWords[pageNum - 1];
    }
  }
  if (!words || !words.length) return;

  // Word bboxes are in [0,1] normalized coordinates (relative to OCR source canvas).
  // We map them to CSS display dimensions for correct on-screen positioning.
  const displayW = parseFloat(els.canvas.style.width) || (els.canvas.width / dpr);
  const displayH = parseFloat(els.canvas.style.height) || (els.canvas.height / dpr);

  container.style.width = `${displayW}px`;
  container.style.height = `${displayH}px`;

  const measureCanvas = document.createElement('canvas');
  const measureCtx = measureCanvas.getContext('2d');
  if (!measureCtx) return;

  // Sort words into reading order
  const sortedWords = [...words].filter(w => w.text && w.bbox).sort((a, b) => {
    const dy = a.bbox.y0 - b.bbox.y0;
    const avgH = ((a.bbox.y1 - a.bbox.y0) + (b.bbox.y1 - b.bbox.y0)) / 2;
    // avgH is now in [0,1] range; compare proportionally
    return Math.abs(dy) < avgH * 0.4 ? a.bbox.x0 - b.bbox.x0 : dy;
  });

  const fragment = document.createDocumentFragment();

  for (const word of sortedWords) {
    const span = document.createElement('span');
    span.textContent = word.text;
    if (word.confidence != null) {
      span.dataset.confidence = String(word.confidence);
    }

    // Map normalized [0,1] coords -> display pixels
    const x = word.bbox.x0 * displayW;
    const y = word.bbox.y0 * displayH;
    const w = (word.bbox.x1 - word.bbox.x0) * displayW;
    const h = (word.bbox.y1 - word.bbox.y0) * displayH;

    // ── Font selection: pick best-matching family for this word ──
    // Tesseract may report font_name on the word; use it to pick a CSS font.
    const fontFamily = _pickFontFamily(word);
    const fontWeight = word.font_bold ? 'bold' : 'normal';
    const fontStyle = word.font_italic ? 'italic' : 'normal';

    // ── Font sizing: 3-pass iterative fitting for precise bbox match ──
    const fontSpec = `${fontStyle} ${fontWeight} Xpx ${fontFamily}`;
    let fontSize = Math.max(5, h * 0.90);
    if (word.text.length > 0 && h > 5) {
      for (let pass = 0; pass < 3; pass++) {
        measureCtx.font = fontSpec.replace('X', String(fontSize));
        const m = measureCtx.measureText(word.text);
        const asc = m.actualBoundingBoxAscent ?? (fontSize * 0.76);
        const dsc = m.actualBoundingBoxDescent ?? (fontSize * 0.24);
        const actualH = asc + dsc;
        if (actualH > 0) fontSize = Math.max(5, fontSize * (h / actualH));
      }
      // Final 2% shrink to avoid overflow
      fontSize *= 0.98;
    }

    span.style.left = `${x}px`;
    span.style.top = `${y}px`;
    span.style.fontSize = `${fontSize}px`;
    span.style.fontFamily = fontFamily;
    span.style.fontWeight = fontWeight;
    span.style.fontStyle = fontStyle;
    span.style.width = `${w}px`;
    span.style.height = `${h}px`;
    span.style.lineHeight = `${h}px`;

    // ── Width fitting: always use scaleX for precise horizontal match ──
    if (word.text.length >= 1) {
      measureCtx.font = fontSpec.replace('X', String(fontSize));
      const measuredWidth = measureCtx.measureText(word.text).width;
      if (measuredWidth > 0) {
        const ratio = w / measuredWidth;
        span.style.transform = `scaleX(${ratio.toFixed(4)})`;
        span.style.transformOrigin = 'left top';
      }
    }

    // Per-word skew correction from Tesseract baseline data
    if (word.baseline?.angle && Math.abs(word.baseline.angle) > 0.3) {
      span.style.transform = (span.style.transform || '') + ` rotate(${(-word.baseline.angle).toFixed(2)}deg)`;
      if (!span.style.transformOrigin) span.style.transformOrigin = 'left top';
    }

    fragment.appendChild(span);
  }

  container.appendChild(fragment);

  // ── Apply global deskew rotation to the OCR text layer ──
  // OCR variants are internally deskewed, so word positions are relative to
  // the straightened canvas.  Apply the inverse skew to the text layer
  // container so the overlay aligns with the original (skewed) page image.
  try {
    const skewDeg = await estimatePageSkewAngle(pageNum);
    if (Math.abs(skewDeg) >= 0.05) {
      container.style.transform = `rotate(${skewDeg.toFixed(2)}deg)`;
      container.style.transformOrigin = 'center center';
    } else {
      container.style.transform = '';
    }
  } catch (_e) {
    container.style.transform = '';
  }

  // ── Render confidence overlay if enabled ──
  if (state.ocrConfidenceMode && sortedWords.length) {
    const annotCanvas = els.annotationCanvas;
    if (annotCanvas) {
      renderConfidenceOverlay(sortedWords, annotCanvas, displayW, displayH);
    }
  }
}

// ─── Text Layer Erase Mode ──────────────────────────────────────────────────
// Click-to-delete: clicks on text spans remove them from the overlay and
// update the stored OCR text for the page.

let _eraseMode = false;

export function isTextEraseMode() { return _eraseMode; }

export function enableTextEraseMode() {
  const container = els.textLayerDiv;
  if (!container) return;
  _eraseMode = true;
  container.classList.add('erase-mode');
  container.addEventListener('click', _handleEraseClick);
}

export function disableTextEraseMode() {
  const container = els.textLayerDiv;
  if (!container) return;
  _eraseMode = false;
  container.classList.remove('erase-mode');
  container.removeEventListener('click', _handleEraseClick);
}

function _handleEraseClick(e) {
  e.preventDefault();
  e.stopPropagation();
  const span = e.target.closest('span');
  if (!span) return;
  span.remove();
  _syncTextLayerToStorage();
}

// ─── Inline Text Editor (Acrobat-style) ────────────────────────────────────

/** @returns {any} */
export function enableInlineTextEditing() {
  const container = els.textLayerDiv;
  if (!container) return;
  container.classList.add('editing');

  // Single click activates inline editing for better UX (Acrobat-style)
  container.addEventListener('click', _handleTextLayerClick);
  // Keep dblclick as fallback for paragraph-level editing
  container.addEventListener('dblclick', _handleTextLayerDblClick);
}

/** @returns {any} */
export function disableInlineTextEditing() {
  const container = els.textLayerDiv;
  if (!container) return;
  container.classList.remove('editing');
  container.removeEventListener('click', _handleTextLayerClick);
  container.removeEventListener('dblclick', _handleTextLayerDblClick);
  if (_activeInlineEditor) {
    _activeInlineEditor.remove();
    _activeInlineEditor = null;
  }
}

/**
 * Single-click handler: open an inline editor on the clicked span directly.
 * This gives an Acrobat-style "click to edit" experience.
 */
export function _handleTextLayerClick(e) {
  // Ignore clicks on an already-active inline editor
  if (e.target.closest('.inline-editor')) return;

  const span = e.target.closest('span');
  if (!span) {
    // Click on empty area -> create a new text block
    const rect = els.textLayerDiv.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    _createInlineEditor(x, y, '', null, []);
    return;
  }

  // Open single-span editor immediately on click
  const rect = span.getBoundingClientRect();
  const containerRect = els.textLayerDiv.getBoundingClientRect();
  const x = rect.left - containerRect.left;
  const y = rect.top - containerRect.top;
  _createInlineEditor(x, y, span.textContent, span, []);
}

/** @param {any} e @returns {any} */
export function _handleTextLayerDblClick(e) {
  const span = e.target.closest('span');
  if (!span) {
    // Click on empty area -> create new text block
    const rect = els.textLayerDiv.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    _createInlineEditor(x, y, '', null, []);
    return;
  }

  // Group spans into a paragraph by Y-proximity for reflow editing
  const paragraphSpans = _findParagraphSpans(span);
  if (paragraphSpans.length > 1) {
    _createParagraphEditor(paragraphSpans);
  } else {
    // Single span edit (fallback)
    const rect = span.getBoundingClientRect();
    const containerRect = els.textLayerDiv.getBoundingClientRect();
    const x = rect.left - containerRect.left;
    const y = rect.top - containerRect.top;
    _createInlineEditor(x, y, span.textContent, span, []);
  }
}

/**
 * Find all spans that belong to the same paragraph as the target span.
 * Groups by Y-proximity: spans on the same or adjacent lines with similar X range.
 */
export function _findParagraphSpans(targetSpan) {
  const container = els.textLayerDiv;
  if (!container) return [targetSpan];

  const allSpans = Array.from(container.querySelectorAll('span:not(.inline-editor)'));
  if (allSpans.length <= 1) return [targetSpan];

  const targetRect = targetSpan.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  const lineH = targetRect.height || 14;

  // Collect all spans with bounding info
  const spansWithRect = allSpans.map(s => ({
    span: s,
    rect: s.getBoundingClientRect(),
  }));

  // Find all spans on lines near the target span
  const _targetRelY = targetRect.top - containerRect.top;
  const targetLeft = targetRect.left - containerRect.left;
  const _targetRight = targetLeft + targetRect.width;

  // Get all lines (groups of spans with similar Y)
  const lines = [];
  const sorted = [...spansWithRect].sort((a, b) => a.rect.top - b.rect.top);
  let currentLine = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const prev = currentLine[currentLine.length - 1];
    if (Math.abs(sorted[i].rect.top - prev.rect.top) < lineH * 0.6) {
      currentLine.push(sorted[i]);
    } else {
      lines.push(currentLine);
      currentLine = [sorted[i]];
    }
  }
  if (currentLine.length) lines.push(currentLine);

  // Find which line the target is on
  let targetLineIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].some(s => s.span === targetSpan)) {
      targetLineIdx = i;
      break;
    }
  }
  if (targetLineIdx === -1) return [targetSpan];

  // Expand up and down to find paragraph boundaries
  let startLine = targetLineIdx;
  let endLine = targetLineIdx;

  // Expand upward
  for (let i = targetLineIdx - 1; i >= 0; i--) {
    const prevLine = lines[i + 1];
    const thisLine = lines[i];
    const gap = prevLine[0].rect.top - (thisLine[0].rect.top + thisLine[0].rect.height);
    if (gap > lineH * 0.8) break; // Large gap = paragraph break
    startLine = i;
  }

  // Expand downward
  for (let i = targetLineIdx + 1; i < lines.length; i++) {
    const prevLine = lines[i - 1];
    const thisLine = lines[i];
    const gap = thisLine[0].rect.top - (prevLine[0].rect.top + prevLine[0].rect.height);
    if (gap > lineH * 0.8) break;
    endLine = i;
  }

  // Collect all spans in the paragraph
  const result = [];
  for (let i = startLine; i <= endLine; i++) {
    for (const s of lines[i]) {
      result.push(s.span);
    }
  }

  return result.length ? result : [targetSpan];
}

/**
 * Create a paragraph-level contenteditable editor covering all paragraph spans.
 * Supports text reflow: edited text re-wraps within the paragraph bounds.
 */
export function _createParagraphEditor(spans) {
  if (_activeInlineEditor) _activeInlineEditor.remove();

  const containerRect = els.textLayerDiv.getBoundingClientRect();

  // Calculate bounding box of all spans in the paragraph
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const s of spans) {
    const r = s.getBoundingClientRect();
    const relX = r.left - containerRect.left;
    const relY = r.top - containerRect.top;
    minX = Math.min(minX, relX);
    minY = Math.min(minY, relY);
    maxX = Math.max(maxX, relX + r.width);
    maxY = Math.max(maxY, relY + r.height);
  }

  // Determine dominant font size from spans
  const fontSizes = spans.map(s => parseFloat(s.style.fontSize) || 14);
  const dominantFontSize = fontSizes.sort((a, b) => b - a)[0] || 14;

  // Collect text from spans (join with spaces, preserving line breaks)
  const text = spans.map(s => s.textContent).join(' ').replace(/\s+/g, ' ').trim();

  // Hide original spans
  for (const s of spans) s.style.visibility = 'hidden';

  const editor = document.createElement('div');
  editor.className = 'inline-editor paragraph-editor';
  editor.contentEditable = 'true';
  editor.textContent = text;
  editor.style.left = `${minX}px`;
  editor.style.top = `${minY}px`;
  editor.style.width = `${maxX - minX}px`;
  editor.style.minHeight = `${maxY - minY}px`;
  editor.style.fontSize = `${dominantFontSize}px`;
  editor.style.lineHeight = '1.3';
  editor.style.wordWrap = 'break-word';
  editor.style.overflowWrap = 'break-word';
  editor.style.whiteSpace = 'pre-wrap';

  editor.addEventListener('blur', () => {
    const newText = editor.textContent.trim();

    // Restore original spans visibility
    for (const s of spans) s.style.visibility = '';

    if (newText) {
      // Reflow: update the text content of spans to match edited text
      _reflowTextToSpans(spans, newText, dominantFontSize, maxX - minX);
    }

    editor.remove();
    _activeInlineEditor = null;
    _syncTextLayerToStorage();
  });

  editor.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      for (const s of spans) s.style.visibility = '';
      editor.remove();
      _activeInlineEditor = null;
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); editor.blur(); }
  });

  els.textLayerDiv.appendChild(editor);
  _activeInlineEditor = editor;
  editor.focus();

  // Select all text
  const range = document.createRange();
  range.selectNodeContents(editor);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

/**
 * Reflow edited text back into the original spans.
 * Distributes words across spans maintaining original positions.
 */
export function _reflowTextToSpans(spans, newText, _fontSize, _maxWidth) {
  const words = newText.split(/\s+/).filter(Boolean);
  if (!words.length || !spans.length) return;

  // Simple distribution: evenly distribute words across existing spans
  const wordsPerSpan = Math.max(1, Math.ceil(words.length / spans.length));

  for (let i = 0; i < spans.length; i++) {
    const start = i * wordsPerSpan;
    const end = Math.min(start + wordsPerSpan, words.length);
    const spanWords = words.slice(start, end);
    if (spanWords.length) {
      spans[i].textContent = spanWords.join(' ');
      spans[i].style.visibility = '';
    } else {
      // Extra spans: clear their text
      spans[i].textContent = '';
    }
  }

  // If there are remaining words that didn't fit, append to the last span
  const usedWords = spans.length * wordsPerSpan;
  if (usedWords < words.length) {
    const lastSpan = spans[spans.length - 1];
    const remaining = words.slice(usedWords).join(' ');
    lastSpan.textContent += ' ' + remaining;
  }
}

/** @param {any} x @param {any} y @param {any} initialText @param {any} targetSpan @param {any} _paragraphSpans @returns {any} */
export function _createInlineEditor(x, y, initialText, targetSpan, _paragraphSpans) {
  if (_activeInlineEditor) _activeInlineEditor.remove();

  const editor = document.createElement('div');
  editor.className = 'inline-editor';
  editor.contentEditable = 'true';
  editor.textContent = initialText;
  editor.style.left = `${x}px`;
  editor.style.top = `${y}px`;
  if (targetSpan) {
    editor.style.minWidth = `${targetSpan.offsetWidth + 20}px`;
    editor.style.fontSize = targetSpan.style.fontSize;
  }

  editor.addEventListener('blur', () => {
    const newText = editor.textContent.trim();
    if (targetSpan && newText) {
      targetSpan.textContent = newText;
    } else if (!targetSpan && newText) {
      // Create new text block through block editor
      const displayW = parseFloat(els.canvas.style.width) || 1;
      const displayH = parseFloat(els.canvas.style.height) || 1;
      const canvasW = els.canvas.width || 1;
      const canvasH = els.canvas.height || 1;
      blockEditor.addTextBlock(state.currentPage,
        (x / displayW) * canvasW,
        (y / displayH) * canvasH,
        newText,
        { fontSize: parseInt(editor.style.fontSize) || 14 }
      );
      if (blockEditor.active) {
        blockEditor.refreshOverlay(els.canvasWrap, els.canvas);
      }
    }
    editor.remove();
    _activeInlineEditor = null;
    // Save the edited text back to OCR/edit storage
    _syncTextLayerToStorage();
  });

  editor.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { editor.remove(); _activeInlineEditor = null; }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); editor.blur(); }
  });

  els.textLayerDiv.appendChild(editor);
  _activeInlineEditor = editor;
  editor.focus();

  // Select all text
  const range = document.createRange();
  range.selectNodeContents(editor);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

/** @returns {any} */
export function _syncTextLayerToStorage() {
  const container = els.textLayerDiv;
  if (!container || !state.adapter) return;

  // Collect all text from spans
  const spans = container.querySelectorAll('span');
  const text = Array.from(spans).map(s => s.textContent).join(' ');
  if (text.trim()) {
    setPageEdits(state.currentPage, text.trim());
    persistEdits();
  }
}
