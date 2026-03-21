// ─── Enhanced Text Layer Builder ────────────────────────────────────────────
// High-quality text layer overlay with CJK/RTL support, selection, and search highlight.

/**
 * Build a text layer overlay on top of a rendered PDF page.
 * Positions text spans to match the PDF text content precisely.
 *
 * @param {object} options
 * @param {HTMLElement} options.container - Text layer container element
 * @param {object} options.textContent - PDF.js getTextContent() result
 * @param {object} options.viewport - PDF.js viewport
 * @param {boolean} [options.enhanceSmallText=true]
 */
export function buildTextLayer(options) {
  const { container, textContent, viewport, enhanceSmallText = true } = options;
  if (!container || !textContent || !viewport) return;

  container.innerHTML = '';
  container.style.position = 'absolute';
  container.style.left = '0';
  container.style.top = '0';
  container.style.right = '0';
  container.style.bottom = '0';
  container.style.overflow = 'hidden';
  container.style.opacity = '0.25';
  container.style.lineHeight = '1';
  container.setAttribute('role', 'textbox');
  container.setAttribute('aria-label', 'Текстовый слой страницы');

  const items = textContent.items || [];
  const styles = textContent.styles || {};

  for (const item of items) {
    if (!item.str || item.str.trim() === '') continue;

    const span = document.createElement('span');
    span.textContent = item.str;

    // Get transform from PDF coordinates to viewport
    const tx = item.transform;
    if (!tx || tx.length < 6) continue;

    const [a, b, _c, _d, e, f] = tx;
    const fontSize = Math.hypot(a, b);
    const angle = Math.atan2(b, a);

    // Apply viewport transform
    const [va, vb, vc, vd, ve, vf] = viewport.transform;
    const x = va * e + vc * f + ve;
    const y = vb * e + vd * f + vf;

    // Calculate scaled font size
    const scaledFontSize = fontSize * Math.abs(va);

    span.style.position = 'absolute';
    span.style.left = `${x}px`;
    span.style.top = `${y - scaledFontSize}px`;
    span.style.fontSize = `${scaledFontSize}px`;
    span.style.fontFamily = getTextLayerFont(item, styles);
    span.style.transformOrigin = '0% 0%';

    // Handle text direction
    const dir = detectTextDirection(item.str);
    if (dir === 'rtl') {
      span.style.direction = 'rtl';
      span.style.unicodeBidi = 'bidi-override';
    }

    // Handle rotation
    if (Math.abs(angle) > 0.01) {
      span.style.transform = `rotate(${angle}rad)`;
    }

    // Handle width scaling to match PDF text width
    if (item.width && item.width > 0) {
      const scaledWidth = item.width * Math.abs(va);
      span.style.width = `${scaledWidth}px`;
      span.style.display = 'inline-block';

      // Adjust letter-spacing if text is wider/narrower than natural
      const naturalWidth = estimateTextWidth(item.str, scaledFontSize);
      if (naturalWidth > 0 && Math.abs(scaledWidth - naturalWidth) > 2) {
        const ratio = scaledWidth / naturalWidth;
        if (ratio > 0.5 && ratio < 3) {
          span.style.transform = (span.style.transform || '') + ` scaleX(${ratio})`;
        }
      }
    }

    // Small text enhancement
    if (enhanceSmallText && scaledFontSize < 8) {
      span.classList.add('text-layer-small');
    }

    // CJK detection
    if (isCJK(item.str)) {
      span.classList.add('text-layer-cjk');
    }

    container.appendChild(span);
  }
}

/**
 * Highlight search matches in the text layer.
 * @param {HTMLElement} container - Text layer container
 * @param {string} query - Search string
 * @param {object} [options]
 * @param {boolean} [options.caseSensitive=false]
 * @param {boolean} [options.wholeWord=false]
 * @returns {number} Number of matches found
 */
export function highlightSearchMatches(container, query, options = {}) {
  if (!container || !query) return 0;

  clearSearchHighlights(container);

  const { caseSensitive = false, wholeWord = false } = options;
  let pattern = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (wholeWord) pattern = `\\b${pattern}\\b`;
  const regex = new RegExp(pattern, caseSensitive ? 'g' : 'gi');

  let totalMatches = 0;
  const spans = container.querySelectorAll('span:not(.search-highlight)');

  for (const span of spans) {
    const text = span.textContent;
    const matches = [...text.matchAll(regex)];
    if (matches.length === 0) continue;

    totalMatches += matches.length;

    // Wrap matches in highlight spans
    const fragment = document.createDocumentFragment();
    let lastIndex = 0;

    for (const match of matches) {
      if (match.index > lastIndex) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
      }
      const highlight = document.createElement('mark');
      highlight.className = 'search-highlight';
      highlight.textContent = match[0];
      fragment.appendChild(highlight);
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
    }

    span.textContent = '';
    span.appendChild(fragment);
  }

  return totalMatches;
}

/**
 * Clear all search highlights from the text layer.
 */
export function clearSearchHighlights(container) {
  if (!container) return;
  const highlights = container.querySelectorAll('.search-highlight');
  for (const h of highlights) {
    const parent = h.parentNode;
    parent.replaceChild(document.createTextNode(h.textContent), h);
    parent.normalize();
  }
}

/**
 * Get selected text from the text layer.
 * @param {HTMLElement} container
 * @returns {string}
 */
export function getSelectedText(container) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return '';
  if (!container?.contains(selection.anchorNode)) return '';
  return selection.toString();
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getTextLayerFont(item, styles) {
  const styleName = item.fontName;
  if (styleName && styles[styleName]) {
    const style = styles[styleName];
    const family = style.fontFamily || 'sans-serif';
    return family;
  }
  return 'sans-serif';
}

function detectTextDirection(text) {
  // Check for RTL characters (Arabic, Hebrew)
  const rtlRegex = /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
  if (rtlRegex.test(text)) return 'rtl';
  return 'ltr';
}

function isCJK(text) {
  return /[\u4E00-\u9FFF\u3400-\u4DBF\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF]/.test(text);
}

function estimateTextWidth(text, fontSize) {
  // Rough estimate: average char width is ~0.6 of font size
  const avgCharWidth = fontSize * 0.6;
  let width = 0;
  for (const ch of text) {
    if (isCJK(ch)) {
      width += fontSize; // CJK chars are roughly square
    } else if (ch === ' ') {
      width += fontSize * 0.3;
    } else {
      width += avgCharWidth;
    }
  }
  return width;
}
