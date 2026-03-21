// ─── Page Organizer ─────────────────────────────────────────────────────────
// Fullscreen page management: reorder, insert, delete, rotate, extract pages.
// Operates on PDF bytes via pdf-lib.

import { PDFDocument, degrees } from 'pdf-lib';

/**
 * @typedef {object} PageInfo
 * @property {number} index - 0-based page index
 * @property {number} width
 * @property {number} height
 * @property {number} rotation
 * @property {string} [label]
 */

/**
 * Get metadata for all pages in a PDF.
 * @param {Uint8Array} pdfBytes
 * @returns {Promise<PageInfo[]>}
 */
export async function getPageInfoList(pdfBytes) {
  const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const pages = doc.getPages();
  return pages.map((page, i) => {
    const { width, height } = page.getSize();
    const rotation = page.getRotation().angle;
    return { index: i, width, height, rotation, label: `${i + 1}` };
  });
}

/**
 * Reorder pages in a PDF document.
 * @param {Uint8Array} pdfBytes
 * @param {number[]} newOrder - Array of 0-based page indices in new order
 * @returns {Promise<Uint8Array>}
 */
export async function reorderPages(pdfBytes, newOrder) {
  const srcDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const destDoc = await PDFDocument.create();

  const copiedPages = await destDoc.copyPages(srcDoc, newOrder);
  for (const page of copiedPages) {
    destDoc.addPage(page);
  }

  return destDoc.save();
}

/**
 * Delete pages from a PDF.
 * @param {Uint8Array} pdfBytes
 * @param {number[]} pageIndices - 0-based indices to remove
 * @returns {Promise<Uint8Array>}
 */
export async function deletePages(pdfBytes, pageIndices) {
  const srcDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const totalPages = srcDoc.getPageCount();
  const keepIndices = [];

  for (let i = 0; i < totalPages; i++) {
    if (!pageIndices.includes(i)) keepIndices.push(i);
  }

  if (keepIndices.length === 0) {
    throw new Error('Cannot delete all pages');
  }

  return reorderPages(pdfBytes, keepIndices);
}

/**
 * Rotate specific pages.
 * @param {Uint8Array} pdfBytes
 * @param {number[]} pageIndices - 0-based indices to rotate
 * @param {90|180|270} angle - Rotation angle (clockwise)
 * @returns {Promise<Uint8Array>}
 */
export async function rotatePages(pdfBytes, pageIndices, angle) {
  const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const pages = doc.getPages();

  for (const idx of pageIndices) {
    if (idx >= 0 && idx < pages.length) {
      const current = pages[idx].getRotation().angle;
      pages[idx].setRotation(degrees((current + angle) % 360));
    }
  }

  return doc.save();
}

/**
 * Extract specific pages into a new PDF.
 * @param {Uint8Array} pdfBytes
 * @param {number[]} pageIndices - 0-based indices to extract
 * @returns {Promise<Uint8Array>}
 */
export async function extractPages(pdfBytes, pageIndices) {
  return reorderPages(pdfBytes, pageIndices);
}

/**
 * Insert pages from another PDF at a specific position.
 * @param {Uint8Array} targetPdfBytes
 * @param {Uint8Array} sourcePdfBytes - Pages to insert
 * @param {number} insertAt - 0-based position to insert at
 * @param {number[]} [sourcePageIndices] - Which pages to take from source (all if omitted)
 * @returns {Promise<Uint8Array>}
 */
export async function insertPages(targetPdfBytes, sourcePdfBytes, insertAt, sourcePageIndices) {
  const targetDoc = await PDFDocument.load(targetPdfBytes, { ignoreEncryption: true });
  const sourceDoc = await PDFDocument.load(sourcePdfBytes, { ignoreEncryption: true });

  const indices = sourcePageIndices || Array.from({ length: sourceDoc.getPageCount() }, (_, i) => i);
  const copiedPages = await targetDoc.copyPages(sourceDoc, indices);

  // Insert in reverse to maintain order at insertAt position
  for (let i = copiedPages.length - 1; i >= 0; i--) {
    targetDoc.insertPage(insertAt, copiedPages[i]);
  }

  return targetDoc.save();
}

/**
 * Insert a blank page at a specific position.
 * @param {Uint8Array} pdfBytes
 * @param {number} insertAt - 0-based position
 * @param {number} [width=595.28] - Page width (A4 default)
 * @param {number} [height=841.89] - Page height (A4 default)
 * @returns {Promise<Uint8Array>}
 */
export async function insertBlankPage(pdfBytes, insertAt, width = 595.28, height = 841.89) {
  const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  doc.insertPage(insertAt, [width, height]);
  return doc.save();
}

/**
 * Duplicate specific pages.
 * @param {Uint8Array} pdfBytes
 * @param {number[]} pageIndices - 0-based indices to duplicate
 * @returns {Promise<Uint8Array>} - PDF with duplicated pages appended after originals
 */
export async function duplicatePages(pdfBytes, pageIndices) {
  const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const copiedPages = await doc.copyPages(doc, pageIndices);

  // Insert each duplicate right after its original (offset by previous insertions)
  let offset = 0;
  for (let i = 0; i < pageIndices.length; i++) {
    const insertPos = pageIndices[i] + 1 + offset;
    doc.insertPage(insertPos, copiedPages[i]);
    offset++;
  }

  return doc.save();
}

/**
 * Reverse page order.
 * @param {Uint8Array} pdfBytes
 * @returns {Promise<Uint8Array>}
 */
export async function reversePages(pdfBytes) {
  const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const indices = Array.from({ length: doc.getPageCount() }, (_, i) => i).reverse();
  return reorderPages(pdfBytes, indices);
}

// ─── Page Organizer UI State ────────────────────────────────────────────────

/**
 * @typedef {object} OrganizerState
 * @property {PageInfo[]} pages
 * @property {Set<number>} selected - Selected page indices
 * @property {number} dragSource - Index being dragged
 * @property {number} dropTarget - Drop position indicator
 */

/**
 * Create a new organizer state from page info.
 * @param {PageInfo[]} pages
 * @returns {OrganizerState}
 */
export function createOrganizerState(pages) {
  return {
    pages: [...pages],
    selected: new Set(),
    dragSource: -1,
    dropTarget: -1,
  };
}

/**
 * Toggle page selection.
 * @param {OrganizerState} state
 * @param {number} index
 * @param {boolean} [multiSelect=false]
 * @returns {OrganizerState}
 */
export function togglePageSelection(state, index, multiSelect = false) {
  const selected = new Set(multiSelect ? state.selected : []);
  if (selected.has(index)) {
    selected.delete(index);
  } else {
    selected.add(index);
  }
  return { ...state, selected };
}

/**
 * Select a range of pages (Shift+click behavior).
 * @param {OrganizerState} state
 * @param {number} from
 * @param {number} to
 * @returns {OrganizerState}
 */
export function selectPageRange(state, from, to) {
  const selected = new Set(state.selected);
  const [start, end] = from < to ? [from, to] : [to, from];
  for (let i = start; i <= end; i++) {
    selected.add(i);
  }
  return { ...state, selected };
}

/**
 * Get the new order array after moving selected pages to a target position.
 * @param {OrganizerState} state
 * @param {number} targetIndex - Where to move selected pages
 * @returns {number[]} New order of 0-based page indices
 */
export function computeReorderFromDrag(state, targetIndex) {
  const selectedArr = [...state.selected].sort((a, b) => a - b);
  const remaining = state.pages
    .map((_, i) => i)
    .filter(i => !state.selected.has(i));

  // Insert selected at target position
  const insertPos = Math.min(targetIndex, remaining.length);
  remaining.splice(insertPos, 0, ...selectedArr);
  return remaining;
}
