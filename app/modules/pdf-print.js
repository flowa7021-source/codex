// ─── PDF Print Module ───────────────────────────────────────────────────────
// Advanced print dialog: page ranges, N-up, booklet, scaling.

import { safeTimeout } from './safe-timers.js';

/**
 * @typedef {object} PrintOptions
 * @property {'all' | 'current' | 'range' | 'odd' | 'even'} pages
 * @property {string} [pageRange] - e.g. "1-5, 8, 11-13"
 * @property {number} currentPage
 * @property {number} totalPages
 * @property {'fit' | 'actual' | 'shrink' | 'custom'} scaling
 * @property {number} [customScale=1]
 * @property {'auto' | 'portrait' | 'landscape'} orientation
 * @property {1 | 2 | 4 | 6 | 9 | 16} pagesPerSheet
 * @property {boolean} borders
 * @property {boolean} booklet
 */

const _DEFAULT_OPTIONS = {
  pages: 'all',
  pageRange: '',
  currentPage: 1,
  totalPages: 1,
  scaling: 'fit',
  customScale: 1,
  orientation: 'auto',
  pagesPerSheet: 1,
  borders: false,
  booklet: false,
};

/**
 * Parse a page range string into an array of page numbers.
 * @param {string} rangeStr - e.g. "1-5, 8, 11-13"
 * @param {number} maxPage
 * @returns {number[]}
 */
export function parsePageRange(rangeStr, maxPage) {
  if (!rangeStr) return [];
  const pages = new Set();
  const parts = rangeStr.split(',');

  for (const part of parts) {
    const trimmed = part.trim();
    const rangeMatch = trimmed.match(/^(\d+)\s*-\s*(\d+)$/);

    if (rangeMatch) {
      const start = Math.max(1, parseInt(rangeMatch[1], 10));
      const end = Math.min(maxPage, parseInt(rangeMatch[2], 10));
      for (let i = start; i <= end; i++) pages.add(i);
    } else {
      const num = parseInt(trimmed, 10);
      if (num >= 1 && num <= maxPage) pages.add(num);
    }
  }

  return [...pages].sort((a, b) => a - b);
}

/**
 * Get pages to print based on options.
 * @param {PrintOptions} options
 * @returns {number[]}
 */
export function getPagesToPrint(options) {
  const total = options.totalPages;

  switch (options.pages) {
    case 'current':
      return [options.currentPage];
    case 'range':
      return parsePageRange(options.pageRange, total);
    case 'odd':
      return Array.from({ length: total }, (_, i) => i + 1).filter(n => n % 2 === 1);
    case 'even':
      return Array.from({ length: total }, (_, i) => i + 1).filter(n => n % 2 === 0);
    case 'all':
    default:
      return Array.from({ length: total }, (_, i) => i + 1);
  }
}

/**
 * Arrange pages for booklet printing (saddle stitch).
 * @param {number[]} pages - Original page order
 * @returns {number[][]} Array of sheet sides, each [front-left, front-right, back-left, back-right]
 */
export function arrangeBooklet(pages) {
  // Pad to multiple of 4
  const padded = [...pages];
  while (padded.length % 4 !== 0) padded.push(0); // 0 = blank

  const sheets = [];
  const n = padded.length;

  for (let i = 0; i < n / 2; i += 2) {
    sheets.push([
      padded[n - 1 - i], padded[i],         // Front: last, first
      padded[i + 1], padded[n - 2 - i],     // Back: second, second-last
    ]);
  }

  return sheets;
}

/**
 * Arrange pages for N-up printing.
 * @param {number[]} pages
 * @param {number} perSheet - 1, 2, 4, 6, 9, 16
 * @returns {number[][]} Array of sheets, each containing page numbers
 */
export function arrangeNup(pages, perSheet) {
  const sheets = [];
  for (let i = 0; i < pages.length; i += perSheet) {
    sheets.push(pages.slice(i, i + perSheet));
  }
  return sheets;
}

/**
 * Create a print-ready canvas for N-up layout.
 * @param {HTMLCanvasElement[]} pageCanvases - Rendered page canvases
 * @param {number} perSheet
 * @param {boolean} borders
 * @returns {HTMLCanvasElement}
 */
export function renderNupSheet(pageCanvases, perSheet, borders = false) {
  const cols = perSheet <= 2 ? perSheet : Math.ceil(Math.sqrt(perSheet));
  const rows = Math.ceil(perSheet / cols);

  // Assume A4 at 96 DPI (794 x 1123 px)
  const sheetWidth = 794;
  const sheetHeight = 1123;
  const margin = 20;

  const cellWidth = (sheetWidth - margin * 2) / cols;
  const cellHeight = (sheetHeight - margin * 2) / rows;

  const canvas = document.createElement('canvas');
  canvas.width = sheetWidth;
  canvas.height = sheetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, sheetWidth, sheetHeight);

  for (let i = 0; i < pageCanvases.length; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = margin + col * cellWidth;
    const y = margin + row * cellHeight;

    const pageCanvas = pageCanvases[i];
    if (!pageCanvas) continue;

    // Scale to fit cell
    const scaleX = (cellWidth - 4) / pageCanvas.width;
    const scaleY = (cellHeight - 4) / pageCanvas.height;
    const scale = Math.min(scaleX, scaleY);

    const dw = pageCanvas.width * scale;
    const dh = pageCanvas.height * scale;
    const dx = x + (cellWidth - dw) / 2;
    const dy = y + (cellHeight - dh) / 2;

    ctx.drawImage(pageCanvas, dx, dy, dw, dh);

    if (borders) {
      ctx.strokeStyle = '#ccc';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(dx, dy, dw, dh);
    }
  }

  return canvas;
}

/**
 * Trigger native print dialog with arranged pages.
 * @param {HTMLCanvasElement[]} canvases - Canvases to print
 */
export function triggerPrint(canvases) {
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  doc.open();
  doc.write(`
    <!doctype html>
    <html><head>
      <style>
        @media print { @page { margin: 0; } body { margin: 0; } }
        img { display: block; max-width: 100%; height: auto; page-break-after: always; }
        img:last-child { page-break-after: avoid; }
      </style>
    </head><body>
  `);

  for (const canvas of canvases) {
    const dataUrl = canvas.toDataURL('image/png');
    doc.write(`<img src="${dataUrl}" />`);
  }

  doc.write('</body></html>');
  doc.close();

  iframe.contentWindow.focus();
  iframe.contentWindow.print();

  safeTimeout(() => document.body.removeChild(iframe), 5000);
}
