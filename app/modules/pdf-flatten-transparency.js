// @ts-check
// ═══════════════════════════════════════════════════════════════════════
// NovaReader 3.0 — PDF Flatten Transparency
// Remove transparency groups from PDF pages for print compatibility
// ═══════════════════════════════════════════════════════════════════════

import { PDFDocument, PDFName, PDFDict } from 'pdf-lib';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Check whether a page has a transparency group.
 * @param {import('pdf-lib').PDFPage} page
 * @returns {boolean}
 */
function hasTransparencyGroup(page) {
  try {
    const group = page.node.get(PDFName.of('Group'));
    if (group instanceof PDFDict) {
      const s = group.get(PDFName.of('S'));
      return s !== undefined && s.toString() === '/Transparency';
    }
  } catch (_e) { /* skip */ }
  return false;
}

/**
 * Remove soft mask (/SMask) entries from a page's ExtGState resources.
 * @param {import('pdf-lib').PDFPage} page
 * @returns {number} number of soft masks removed
 */
function removeSoftMasks(page) {
  let removed = 0;
  try {
    const resources = page.node.get(PDFName.of('Resources'));
    if (!(resources instanceof PDFDict)) return 0;

    const extGState = resources.get(PDFName.of('ExtGState'));
    if (!(extGState instanceof PDFDict)) return 0;

    const entries = extGState.entries();
    for (const [_key, value] of entries) {
      if (value instanceof PDFDict) {
        if (value.has(PDFName.of('SMask'))) {
          value.delete(PDFName.of('SMask'));
          removed++;
        }
      }
    }
  } catch (_e) { /* skip */ }
  return removed;
}

/**
 * Remove the transparency group and related entries from a page.
 * @param {import('pdf-lib').PDFPage} page
 * @returns {boolean} true if transparency was removed
 */
function flattenPageTransparency(page) {
  let changed = false;

  try {
    const group = page.node.get(PDFName.of('Group'));
    if (group instanceof PDFDict) {
      const s = group.get(PDFName.of('S'));
      if (s && s.toString() === '/Transparency') {
        page.node.delete(PDFName.of('Group'));
        changed = true;
      }
    }
  } catch (_e) { /* skip */ }

  // Also remove soft masks from ExtGState
  const smRemoved = removeSoftMasks(page);
  if (smRemoved > 0) changed = true;

  return changed;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Flatten transparency in a PDF document.
 * Removes transparency groups and soft masks from pages.
 *
 * @param {Uint8Array|ArrayBuffer} pdfBytes
 * @param {object} [options]
 * @param {number} [options.resolution] - Resolution for rasterized output (not yet used)
 * @param {number[]} [options.pages] - 1-based page numbers to flatten (default: all)
 * @returns {Promise<{blob: Blob, pagesFlattened: number, softMasksRemoved: number}>}
 */
export async function flattenTransparency(pdfBytes, options = {}) {
  const { pages } = options;
  const data = pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes);
  const pdfDoc = await PDFDocument.load(data, { ignoreEncryption: true });

  let pagesFlattened = 0;
  let softMasksRemoved = 0;
  const allPages = pdfDoc.getPages();

  const targetIndices = pages
    ? pages.map(n => n - 1).filter(i => i >= 0 && i < allPages.length)
    : allPages.map((_, i) => i);

  for (const idx of targetIndices) {
    const page = allPages[idx];

    // Check for transparency group
    if (hasTransparencyGroup(page)) {
      page.node.delete(PDFName.of('Group'));
      pagesFlattened++;
    }

    // Remove soft masks
    const sm = removeSoftMasks(page);
    softMasksRemoved += sm;
    if (sm > 0 && !hasTransparencyGroup(page)) {
      // Page had soft masks but no transparency group — still counts
    }
  }

  const bytes = await pdfDoc.save();
  return {
    blob: new Blob([/** @type {any} */ (bytes)], { type: 'application/pdf' }),
    pagesFlattened,
    softMasksRemoved,
  };
}

/**
 * Analyse a PDF for transparency usage without modifying it.
 *
 * @param {Uint8Array|ArrayBuffer} pdfBytes
 * @returns {Promise<{totalPages: number, transparentPages: number[], hasTransparency: boolean}>}
 */
export async function analyzeTransparency(pdfBytes) {
  const data = pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes);
  const pdfDoc = await PDFDocument.load(data, { ignoreEncryption: true });
  const allPages = pdfDoc.getPages();

  /** @type {number[]} */
  const transparentPages = [];

  for (let i = 0; i < allPages.length; i++) {
    if (hasTransparencyGroup(allPages[i])) {
      transparentPages.push(i + 1);
    }
  }

  return {
    totalPages: allPages.length,
    transparentPages,
    hasTransparency: transparentPages.length > 0,
  };
}

// Exported for testing
export { hasTransparencyGroup, removeSoftMasks, flattenPageTransparency };
