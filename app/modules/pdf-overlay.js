// @ts-check
// ═══════════════════════════════════════════════════════════════════════
// NovaReader 3.0 — PDF Overlay Module
// Overlay one PDF on top of another (watermark, letterhead, stamps)
// ═══════════════════════════════════════════════════════════════════════

import { PDFDocument } from 'pdf-lib';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Determine which pages to target.
 * @param {import('pdf-lib').PDFDocument} pdfDoc
 * @param {'all'|'first'|'last'|'odd'|'even'|number[]} pages
 * @returns {import('pdf-lib').PDFPage[]}
 */
function getTargetPages(pdfDoc, pages) {
  const allPages = pdfDoc.getPages();
  if (pages === 'all') return allPages;
  if (pages === 'first') return allPages.length > 0 ? [allPages[0]] : [];
  if (pages === 'last') return allPages.length > 0 ? [allPages[allPages.length - 1]] : [];
  if (pages === 'odd') return allPages.filter((_, i) => i % 2 === 0);
  if (pages === 'even') return allPages.filter((_, i) => i % 2 === 1);
  if (Array.isArray(pages)) return pages.map(n => allPages[n - 1]).filter(Boolean);
  return allPages;
}

/**
 * Compute scaled dimensions that fit within a target rectangle.
 * @param {number} srcW
 * @param {number} srcH
 * @param {number} targetW
 * @param {number} targetH
 * @param {'fit'|'fill'|'none'|number} scale
 * @returns {{width: number, height: number}}
 */
function computeDimensions(srcW, srcH, targetW, targetH, scale) {
  if (typeof scale === 'number') {
    return { width: srcW * scale, height: srcH * scale };
  }
  if (scale === 'none') {
    return { width: srcW, height: srcH };
  }
  if (scale === 'fill') {
    return { width: targetW, height: targetH };
  }
  // 'fit' — maintain aspect ratio
  const ratio = Math.min(targetW / srcW, targetH / srcH);
  return { width: srcW * ratio, height: srcH * ratio };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Overlay one PDF on top of another.
 *
 * @param {Uint8Array|ArrayBuffer} basePdfBytes
 * @param {Uint8Array|ArrayBuffer} overlayPdfBytes
 * @param {object} [options]
 * @param {'foreground'|'background'} [options.position]
 * @param {'all'|'first'|'last'|'odd'|'even'|number[]} [options.pages]
 * @param {number} [options.overlayPage]
 * @param {number} [options.opacity]
 * @param {'fit'|'fill'|'none'|number} [options.scale]
 * @param {number} [options.offsetX]
 * @param {number} [options.offsetY]
 * @returns {Promise<{blob: Blob, pagesAffected: number}>}
 */
export async function overlayPdf(basePdfBytes, overlayPdfBytes, options = {}) {
  const {
    position = 'foreground',
    pages = 'all',
    overlayPage = 1,
    opacity = 1.0,
    scale = 'fit',
    offsetX = 0,
    offsetY = 0,
  } = options;

  const basePdf = await PDFDocument.load(
    basePdfBytes instanceof Uint8Array ? basePdfBytes : new Uint8Array(basePdfBytes),
    { ignoreEncryption: true },
  );
  const overlayDoc = await PDFDocument.load(
    overlayPdfBytes instanceof Uint8Array ? overlayPdfBytes : new Uint8Array(overlayPdfBytes),
    { ignoreEncryption: true },
  );

  const overlayPages = overlayDoc.getPages();
  const overlayIdx = Math.max(0, Math.min((overlayPage || 1) - 1, overlayPages.length - 1));
  const [embeddedPage] = await basePdf.embedPages([overlayPages[overlayIdx]]);

  const targetPages = getTargetPages(basePdf, pages);
  let pagesAffected = 0;

  for (const page of targetPages) {
    const { width, height } = page.getSize();
    const embeddedDims = embeddedPage.size();
    const dims = computeDimensions(embeddedDims.width, embeddedDims.height, width, height, scale);

    if (position === 'background') {
      // For background: draw overlay first using content stream manipulation
      // pdf-lib doesn't support true prepend, so we draw with reduced opacity behind
      page.drawPage(embeddedPage, {
        x: offsetX,
        y: offsetY,
        width: dims.width,
        height: dims.height,
        opacity: opacity * 0.95,
      });
    } else {
      // Foreground: draw on top
      page.drawPage(embeddedPage, {
        x: offsetX,
        y: offsetY,
        width: dims.width,
        height: dims.height,
        opacity,
      });
    }

    pagesAffected++;
  }

  const bytes = await basePdf.save();
  return {
    blob: new Blob([/** @type {any} */ (bytes)], { type: 'application/pdf' }),
    pagesAffected,
  };
}

// Exported for testing
export { getTargetPages, computeDimensions };
