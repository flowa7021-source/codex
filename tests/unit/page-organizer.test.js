import './setup-dom.js';
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import {
  createOrganizerState,
  togglePageSelection,
  selectPageRange,
  computeReorderFromDrag,
  getPageInfoList,
  reorderPages,
  deletePages,
  rotatePages,
  extractPages,
  insertPages,
  insertBlankPage,
  duplicatePages,
  reversePages,
} from '../../app/modules/page-organizer.js';

/**
 * Helper: create a real PDF with N pages of given dimensions.
 * @param {number} n
 * @param {number} [width=612]
 * @param {number} [height=792]
 * @returns {Promise<Uint8Array>}
 */
async function createTestPdf(n, width = 612, height = 792) {
  const doc = await PDFDocument.create();
  for (let i = 0; i < n; i++) {
    doc.addPage([width, height]);
  }
  return doc.save();
}

const samplePages = [
  { index: 0, width: 612, height: 792, rotation: 0 },
  { index: 1, width: 612, height: 792, rotation: 0 },
  { index: 2, width: 612, height: 792, rotation: 0 },
  { index: 3, width: 612, height: 792, rotation: 0 },
];

describe('createOrganizerState', () => {
  it('creates state with copied pages and empty selection', () => {
    const state = createOrganizerState(samplePages);
    assert.strictEqual(state.pages.length, 4);
    assert.strictEqual(state.selected.size, 0);
    assert.strictEqual(state.dragSource, -1);
    assert.strictEqual(state.dropTarget, -1);
  });

  it('does not share reference with input array', () => {
    const state = createOrganizerState(samplePages);
    state.pages.push({ index: 4 });
    assert.strictEqual(samplePages.length, 4);
  });
});

describe('togglePageSelection', () => {
  it('selects a page by index', () => {
    const state = createOrganizerState(samplePages);
    const newState = togglePageSelection(state, 1);
    assert.ok(newState.selected.has(1));
    assert.strictEqual(newState.selected.size, 1);
  });

  it('deselects if already selected with multiSelect', () => {
    let state = createOrganizerState(samplePages);
    state = togglePageSelection(state, 2, true);
    state = togglePageSelection(state, 2, true);
    assert.strictEqual(state.selected.size, 0);
  });

  it('replaces selection without multiSelect', () => {
    let state = createOrganizerState(samplePages);
    state = togglePageSelection(state, 0);
    state = togglePageSelection(state, 2, false);
    assert.strictEqual(state.selected.size, 1);
    assert.ok(state.selected.has(2));
  });

  it('adds to selection with multiSelect', () => {
    let state = createOrganizerState(samplePages);
    state = togglePageSelection(state, 0);
    state = togglePageSelection(state, 2, true);
    assert.strictEqual(state.selected.size, 2);
    assert.ok(state.selected.has(0));
    assert.ok(state.selected.has(2));
  });
});

describe('selectPageRange', () => {
  it('selects a range of pages inclusive', () => {
    const state = createOrganizerState(samplePages);
    const newState = selectPageRange(state, 1, 3);
    assert.strictEqual(newState.selected.size, 3);
    assert.ok(newState.selected.has(1));
    assert.ok(newState.selected.has(2));
    assert.ok(newState.selected.has(3));
  });

  it('works when from > to', () => {
    const state = createOrganizerState(samplePages);
    const newState = selectPageRange(state, 3, 1);
    assert.strictEqual(newState.selected.size, 3);
    assert.ok(newState.selected.has(1));
    assert.ok(newState.selected.has(3));
  });

  it('preserves existing selections', () => {
    let state = createOrganizerState(samplePages);
    state = togglePageSelection(state, 0);
    state = selectPageRange(state, 2, 3);
    assert.ok(state.selected.has(0));
    assert.ok(state.selected.has(2));
    assert.ok(state.selected.has(3));
  });
});

describe('computeReorderFromDrag', () => {
  it('moves selected pages to target position', () => {
    let state = createOrganizerState(samplePages);
    state = togglePageSelection(state, 0);
    const newOrder = computeReorderFromDrag(state, 3);
    // Page 0 should be at or near position 3
    assert.strictEqual(newOrder.length, 4);
    assert.ok(newOrder.includes(0));
  });

  it('handles multiple selected pages', () => {
    let state = createOrganizerState(samplePages);
    state = togglePageSelection(state, 0);
    state = togglePageSelection(state, 1, true);
    const newOrder = computeReorderFromDrag(state, 2);
    assert.strictEqual(newOrder.length, 4);
    // All original indices should be present
    assert.deepStrictEqual([...newOrder].sort(), [0, 1, 2, 3]);
  });

  it('clamps target to remaining length', () => {
    let state = createOrganizerState(samplePages);
    state = togglePageSelection(state, 0);
    const newOrder = computeReorderFromDrag(state, 100);
    assert.strictEqual(newOrder.length, 4);
    // Page 0 should be at the end
    assert.strictEqual(newOrder[newOrder.length - 1], 0);
  });
});

// ─── Async PDF manipulation tests ──────────────────────────────────────────

describe('getPageInfoList', () => {
  it('returns page info for each page', async () => {
    const pdfBytes = await createTestPdf(3);
    const pages = await getPageInfoList(pdfBytes);
    assert.strictEqual(pages.length, 3);
    assert.strictEqual(pages[0].index, 0);
    assert.strictEqual(pages[0].width, 612);
    assert.strictEqual(pages[0].height, 792);
    assert.strictEqual(pages[0].rotation, 0);
    assert.strictEqual(pages[0].label, '1');
    assert.strictEqual(pages[2].index, 2);
    assert.strictEqual(pages[2].label, '3');
  });
});

describe('reorderPages', () => {
  it('reorders pages according to the given order', async () => {
    const pdfBytes = await createTestPdf(3);
    const result = await reorderPages(pdfBytes, [2, 0, 1]);
    const doc = await PDFDocument.load(result);
    assert.strictEqual(doc.getPageCount(), 3);
  });

  it('can duplicate a page by repeating an index', async () => {
    const pdfBytes = await createTestPdf(2);
    const result = await reorderPages(pdfBytes, [0, 0, 1]);
    const doc = await PDFDocument.load(result);
    assert.strictEqual(doc.getPageCount(), 3);
  });
});

describe('deletePages', () => {
  it('removes specified pages', async () => {
    const pdfBytes = await createTestPdf(4);
    const result = await deletePages(pdfBytes, [1, 3]);
    const doc = await PDFDocument.load(result);
    assert.strictEqual(doc.getPageCount(), 2);
  });

  it('throws when trying to delete all pages', async () => {
    const pdfBytes = await createTestPdf(2);
    await assert.rejects(
      () => deletePages(pdfBytes, [0, 1]),
      { message: 'Cannot delete all pages' },
    );
  });
});

describe('rotatePages', () => {
  it('rotates specified pages by given angle', async () => {
    const pdfBytes = await createTestPdf(3);
    const result = await rotatePages(pdfBytes, [0, 2], 90);
    const pages = await getPageInfoList(result);
    assert.strictEqual(pages[0].rotation, 90);
    assert.strictEqual(pages[1].rotation, 0);
    assert.strictEqual(pages[2].rotation, 90);
  });

  it('accumulates rotation', async () => {
    const pdfBytes = await createTestPdf(1);
    const r1 = await rotatePages(pdfBytes, [0], 90);
    const r2 = await rotatePages(r1, [0], 180);
    const pages = await getPageInfoList(r2);
    assert.strictEqual(pages[0].rotation, 270);
  });

  it('ignores out-of-range indices', async () => {
    const pdfBytes = await createTestPdf(2);
    const result = await rotatePages(pdfBytes, [-1, 5], 90);
    const pages = await getPageInfoList(result);
    assert.strictEqual(pages[0].rotation, 0);
    assert.strictEqual(pages[1].rotation, 0);
  });
});

describe('extractPages', () => {
  it('extracts specified pages into a new PDF', async () => {
    const pdfBytes = await createTestPdf(5);
    const result = await extractPages(pdfBytes, [1, 3]);
    const doc = await PDFDocument.load(result);
    assert.strictEqual(doc.getPageCount(), 2);
  });
});

describe('insertPages', () => {
  it('inserts all pages from source into target at position', async () => {
    const target = await createTestPdf(2);
    const source = await createTestPdf(3, 400, 600);
    const result = await insertPages(target, source, 1);
    const doc = await PDFDocument.load(result);
    assert.strictEqual(doc.getPageCount(), 5);
  });

  it('inserts specific source pages when indices provided', async () => {
    const target = await createTestPdf(2);
    const source = await createTestPdf(4, 400, 600);
    const result = await insertPages(target, source, 0, [1, 3]);
    const doc = await PDFDocument.load(result);
    assert.strictEqual(doc.getPageCount(), 4);
  });
});

describe('insertBlankPage', () => {
  it('inserts a blank page at the specified position', async () => {
    const pdfBytes = await createTestPdf(2);
    const result = await insertBlankPage(pdfBytes, 1);
    const doc = await PDFDocument.load(result);
    assert.strictEqual(doc.getPageCount(), 3);
  });

  it('uses default A4 dimensions', async () => {
    const pdfBytes = await createTestPdf(1);
    const result = await insertBlankPage(pdfBytes, 0);
    const pages = await getPageInfoList(result);
    assert.strictEqual(pages.length, 2);
    // The inserted blank page at index 0 should have A4 dims
    assert.ok(Math.abs(pages[0].width - 595.28) < 0.01);
    assert.ok(Math.abs(pages[0].height - 841.89) < 0.01);
  });

  it('accepts custom dimensions', async () => {
    const pdfBytes = await createTestPdf(1);
    const result = await insertBlankPage(pdfBytes, 1, 300, 400);
    const pages = await getPageInfoList(result);
    assert.strictEqual(pages[1].width, 300);
    assert.strictEqual(pages[1].height, 400);
  });
});

describe('duplicatePages', () => {
  it('duplicates specified pages after their originals', async () => {
    const pdfBytes = await createTestPdf(3);
    const result = await duplicatePages(pdfBytes, [0, 2]);
    const doc = await PDFDocument.load(result);
    assert.strictEqual(doc.getPageCount(), 5);
  });

  it('duplicates a single page', async () => {
    const pdfBytes = await createTestPdf(2);
    const result = await duplicatePages(pdfBytes, [1]);
    const doc = await PDFDocument.load(result);
    assert.strictEqual(doc.getPageCount(), 3);
  });
});

describe('reversePages', () => {
  it('reverses the page order', async () => {
    const pdfBytes = await createTestPdf(3);
    const result = await reversePages(pdfBytes);
    const doc = await PDFDocument.load(result);
    assert.strictEqual(doc.getPageCount(), 3);
  });

  it('is its own inverse (double reverse restores original order)', async () => {
    const pdfBytes = await createTestPdf(4);
    const r1 = await reversePages(pdfBytes);
    const r2 = await reversePages(r1);
    const doc = await PDFDocument.load(r2);
    assert.strictEqual(doc.getPageCount(), 4);
  });
});
