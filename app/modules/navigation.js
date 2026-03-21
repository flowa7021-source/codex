// ─── Navigation Enhancements ────────────────────────────────────────────────
// Minimap, page labels, reading position memory, link following.

const POSITION_KEY = 'novareader-positions';
const MAX_POSITIONS = 100;

// ─── Page Labels ────────────────────────────────────────────────────────────

/**
 * Generate page labels from a PDF document's PageLabels entry.
 * Falls back to standard numbering if not available.
 * @param {number} pageCount
 * @param {Array} [labelsArray] - PDF PageLabels number tree
 * @returns {string[]} Labels indexed from 0
 */
export function generatePageLabels(pageCount, labelsArray) {
  const labels = [];

  if (!labelsArray || labelsArray.length === 0) {
    for (let i = 1; i <= pageCount; i++) labels.push(String(i));
    return labels;
  }

  // labelsArray format: [{startPage, style, prefix, start}]
  let currentStyle = 'D'; // Decimal
  let currentPrefix = '';
  let currentStart = 1;
  let labelIndex = 0;

  for (let page = 0; page < pageCount; page++) {
    // Check if a new label range starts at this page
    if (labelIndex < labelsArray.length && labelsArray[labelIndex].startPage === page) {
      const entry = labelsArray[labelIndex];
      currentStyle = entry.style || 'D';
      currentPrefix = entry.prefix || '';
      currentStart = entry.start ?? 1;
      labelIndex++;
    }

    const num = currentStart + (page - (labelIndex > 0 ? labelsArray[labelIndex - 1].startPage : 0));
    labels.push(currentPrefix + formatPageNumber(num, currentStyle));
  }

  return labels;
}

function formatPageNumber(num, style) {
  switch (style) {
    case 'r': return toRoman(num).toLowerCase();
    case 'R': return toRoman(num);
    case 'a': return toLetter(num).toLowerCase();
    case 'A': return toLetter(num);
    case 'D': default: return String(num);
  }
}

function toRoman(num) {
  const vals = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
  const syms = ['M', 'CM', 'D', 'CD', 'C', 'XC', 'L', 'XL', 'X', 'IX', 'V', 'IV', 'I'];
  let result = '';
  for (let i = 0; i < vals.length; i++) {
    while (num >= vals[i]) {
      result += syms[i];
      num -= vals[i];
    }
  }
  return result;
}

function toLetter(num) {
  let result = '';
  while (num > 0) {
    num--;
    result = String.fromCharCode(65 + (num % 26)) + result;
    num = Math.floor(num / 26);
  }
  return result;
}

// ─── Reading Position Memory ────────────────────────────────────────────────

/**
 * Save reading position for a document.
 * @param {string} docName
 * @param {object} position
 * @param {number} position.page
 * @param {number} [position.scrollY]
 * @param {number} [position.zoom]
 */
export function saveReadingPosition(docName, position) {
  if (!docName) return;
  try {
    const data = JSON.parse(localStorage.getItem(POSITION_KEY) || '{}');
    data[docName] = {
      ...position,
      timestamp: Date.now(),
    };
    // Evict oldest entries if over limit
    const keys = Object.keys(data);
    if (keys.length > MAX_POSITIONS) {
      keys.sort((a, b) => (data[a].timestamp || 0) - (data[b].timestamp || 0));
      for (let i = 0; i < keys.length - MAX_POSITIONS; i++) {
        delete data[keys[i]];
      }
    }
    localStorage.setItem(POSITION_KEY, JSON.stringify(data));
  } catch (err) { console.warn('[navigation storage] error:', err?.message); }
}

/**
 * Load reading position for a document.
 * @param {string} docName
 * @returns {object|null} { page, scrollY, zoom, timestamp }
 */
export function loadReadingPosition(docName) {
  if (!docName) return null;
  try {
    const data = JSON.parse(localStorage.getItem(POSITION_KEY) || '{}');
    return data[docName] || null;
  } catch (err) {
    console.warn('[navigation storage] error:', err?.message);
    return null;
  }
}

// ─── Minimap ────────────────────────────────────────────────────────────────

let minimapEl = null;
let minimapCanvas = null;
let minimapCtx = null;

/**
 * Create and render a minimap showing the current page position.
 * @param {HTMLElement} container - Where to append the minimap
 * @param {HTMLCanvasElement} mainCanvas - The main viewer canvas
 * @param {HTMLElement} scrollContainer - The scrollable viewport
 */
export function initMinimap(container, mainCanvas, scrollContainer) {
  if (!container) return;

  minimapEl = document.createElement('div');
  minimapEl.className = 'minimap';
  minimapEl.setAttribute('aria-hidden', 'true');

  minimapCanvas = document.createElement('canvas');
  minimapCanvas.className = 'minimap-canvas';
  minimapEl.appendChild(minimapCanvas);

  const viewportIndicator = document.createElement('div');
  viewportIndicator.className = 'minimap-viewport';
  minimapEl.appendChild(viewportIndicator);

  container.appendChild(minimapEl);

  // Update on scroll
  scrollContainer?.addEventListener('scroll', () => {
    updateMinimapViewport(scrollContainer, viewportIndicator);
  }, { passive: true });

  // Click to navigate
  minimapEl.addEventListener('click', (e) => {
    const rect = minimapEl.getBoundingClientRect();
    const ratio = (e.clientY - rect.top) / rect.height;
    if (scrollContainer) {
      scrollContainer.scrollTop = scrollContainer.scrollHeight * ratio - scrollContainer.clientHeight / 2;
    }
  });
}

export function updateMinimap(mainCanvas) {
  if (!minimapCanvas || !mainCanvas) return;
  const scale = 0.15;
  minimapCanvas.width = Math.max(1, Math.round(mainCanvas.width * scale));
  minimapCanvas.height = Math.max(1, Math.round(mainCanvas.height * scale));

  minimapCtx = minimapCanvas.getContext('2d');
  if (!minimapCtx) return;
  minimapCtx.drawImage(mainCanvas, 0, 0, minimapCanvas.width, minimapCanvas.height);
}

function updateMinimapViewport(scrollContainer, indicator) {
  if (!indicator || !scrollContainer) return;
  const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
  const topRatio = scrollTop / scrollHeight;
  const heightRatio = clientHeight / scrollHeight;
  indicator.style.top = `${topRatio * 100}%`;
  indicator.style.height = `${heightRatio * 100}%`;
}

// ─── Internal PDF Link Following ────────────────────────────────────────────

/**
 * Set up click handlers on the text layer to follow internal PDF links.
 * @param {HTMLElement} textLayer
 * @param {Function} goToPage - (pageNum) => void
 * @param {Function} resolveDestToPage - (dest) => Promise<number|null>
 */
export function setupLinkFollowing(textLayer, goToPage, resolveDestToPage) {
  if (!textLayer) return;

  textLayer.addEventListener('click', async (e) => {
    const link = e.target.closest('a[href]');
    if (!link) return;

    const href = link.getAttribute('href');
    if (!href) return;

    // Internal link (page reference)
    if (href.startsWith('#')) {
      e.preventDefault();
      const dest = href.slice(1);
      const page = await resolveDestToPage(dest);
      if (page) goToPage(page);
      return;
    }

    // Internal page link like "page=5"
    const pageMatch = href.match(/page=(\d+)/i);
    if (pageMatch) {
      e.preventDefault();
      goToPage(parseInt(pageMatch[1], 10));
    }
  });
}

// ─── Thumbnail Grid ─────────────────────────────────────────────────────────

/**
 * Render a thumbnail grid for quick page navigation.
 * @param {HTMLElement} container
 * @param {number} pageCount
 * @param {Function} renderThumb - (pageNum, canvas) => Promise
 * @param {Function} goToPage
 */
export function renderThumbnailGrid(container, pageCount, renderThumb, goToPage) {
  if (!container) return;
  container.innerHTML = '';
  container.className = 'thumbnail-grid';

  for (let i = 1; i <= pageCount; i++) {
    const cell = document.createElement('button');
    cell.className = 'thumbnail-cell';
    cell.dataset.page = i;
    cell.title = `Страница ${i}`;
    cell.setAttribute('aria-label', `Перейти к странице ${i}`);

    const canvas = document.createElement('canvas');
    canvas.className = 'thumbnail-canvas';
    cell.appendChild(canvas);

    const label = document.createElement('span');
    label.className = 'thumbnail-label';
    label.textContent = String(i);
    cell.appendChild(label);

    cell.addEventListener('click', () => goToPage(i));
    container.appendChild(cell);

    // Lazy render thumbnail
    if (renderThumb) {
      const observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            renderThumb(i, canvas);
            observer.disconnect();
          }
        }
      }, { rootMargin: '100px' });
      observer.observe(cell);
    }
  }
}
