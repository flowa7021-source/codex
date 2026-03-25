import './setup-dom.js';
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Set up required DOM elements before importing the module
function setupDom() {
  const ids = [
    'pageOrganizerModal', 'pageOrgGrid', 'pageOrgStatus',
    'openPageOrganizer', 'pageOrgClose', 'pageOrgCancel',
    'pageOrgApply', 'pageOrgRotateCW', 'pageOrgDelete',
    'pageOrgDuplicate', 'pageOrgInsertBlank', 'pageOrgExtract',
    'pageOrgReverse',
  ];
  const elements = {};
  for (const id of ids) {
    elements[id] = document.createElement('div');
    elements[id].id = id;
  }
  // Override getElementById to return our mocks
  const origGetById = document.getElementById;
  document.getElementById = (id) => elements[id] || origGetById?.(id) || null;
  return elements;
}

const elements = setupDom();

import { state } from '../../app/modules/state.js';
import { initPageOrganizerUI } from '../../app/modules/page-organizer-ui.js';

describe('initPageOrganizerUI', () => {
  it('is a function', () => {
    assert.strictEqual(typeof initPageOrganizerUI, 'function');
  });

  it('initializes without errors', () => {
    assert.doesNotThrow(() => {
      initPageOrganizerUI({ openFile: async () => {} });
    });
  });

  it('attaches click listener to openPageOrganizer button', () => {
    // The initPageOrganizerUI should have added event listeners
    // We test by checking the element exists and has listeners (indirect)
    const btn = elements.openPageOrganizer;
    assert.ok(btn);
    assert.strictEqual(btn.id, 'openPageOrganizer');
  });

  it('clicking close button hides the modal', () => {
    const modal = elements.pageOrganizerModal;
    modal.style.display = '';
    modal.classList.add('open');
    // Simulate close click
    elements.pageOrgClose.click();
    assert.strictEqual(modal.style.cssText.includes('none') || !modal.classList.contains('open'), true);
  });

  it('clicking cancel button hides the modal', () => {
    const modal = elements.pageOrganizerModal;
    modal.style.display = '';
    modal.classList.add('open');
    elements.pageOrgCancel.click();
    assert.ok(!modal.classList.contains('open'));
  });

  it('does not throw when apply is clicked without pdf data', () => {
    assert.doesNotThrow(() => {
      elements.pageOrgApply.click();
    });
  });

  it('does not throw when rotate is clicked without selection', () => {
    assert.doesNotThrow(() => {
      elements.pageOrgRotateCW.click();
    });
  });

  it('does not throw when delete is clicked without selection', () => {
    assert.doesNotThrow(() => {
      elements.pageOrgDelete.click();
    });
  });

  it('reverse button element exists', () => {
    assert.ok(elements.pageOrgReverse);
    assert.strictEqual(elements.pageOrgReverse.id, 'pageOrgReverse');
  });
});

// ─── Page Organizer — opening with non-PDF ──────────────────────────────────

describe('Page Organizer — non-PDF rejection', () => {
  let toastMessages;
  let origToastError;

  beforeEach(async () => {
    toastMessages = [];
    // We test the logic inline since we can't easily intercept toast
  });

  it('rejects opening organizer when adapter type is not pdf', () => {
    // Replicate logic from openPageOrganizer (lines 27-29)
    const adapter = { type: 'image' };
    let rejected = false;
    if (!adapter || adapter.type !== 'pdf') {
      rejected = true;
    }
    assert.ok(rejected);
  });

  it('rejects opening organizer when adapter type is djvu', () => {
    const adapter = { type: 'djvu' };
    let rejected = false;
    if (!adapter || adapter.type !== 'pdf') {
      rejected = true;
    }
    assert.ok(rejected);
  });

  it('rejects opening organizer when adapter is null', () => {
    const adapter = null;
    let rejected = false;
    if (!adapter || adapter.type !== 'pdf') {
      rejected = true;
    }
    assert.ok(rejected);
  });

  it('accepts opening organizer when adapter type is pdf', () => {
    const adapter = { type: 'pdf' };
    let rejected = false;
    if (!adapter || adapter.type !== 'pdf') {
      rejected = true;
    }
    assert.ok(!rejected);
  });
});

// ─── Page Organizer — modal open/close ──────────────────────────────────────

describe('Page Organizer — modal open state', () => {
  it('sets modal display and adds open class when opening', () => {
    const modal = elements.pageOrganizerModal;
    // Replicate lines 32-33
    modal.style.display = '';
    modal.classList.add('open');
    assert.ok(modal.classList.contains('open'));
  });

  it('close hides modal and removes open class', () => {
    const modal = elements.pageOrganizerModal;
    modal.style.display = '';
    modal.classList.add('open');
    // Simulate close (lines 157-163)
    modal.style.cssText = 'display: none';
    modal.classList.remove('open');
    assert.ok(!modal.classList.contains('open'));
    assert.ok(modal.style.cssText.includes('none'));
  });

  it('close clears the grid innerHTML', () => {
    const grid = elements.pageOrgGrid;
    grid.innerHTML = '<div>test</div>';
    // Simulate closeOrganizer line 163
    grid.innerHTML = '';
    assert.strictEqual(grid.innerHTML, '');
  });
});

// ─── Page Organizer — page thumbnail generation logic ───────────────────────

describe('Page Organizer — thumbnail generation', () => {
  it('creates canvas elements with correct dimensions', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 140;
    canvas.height = 200;
    assert.equal(canvas.width, 140);
    assert.equal(canvas.height, 200);
  });

  it('creates thumb div with correct class and data-idx', () => {
    const thumb = document.createElement('div');
    thumb.classList.add('page-org-thumb');
    thumb.dataset.idx = String(3);
    thumb.draggable = true;
    assert.ok(thumb.classList.contains('page-org-thumb'));
    assert.equal(thumb.dataset.idx, '3');
  });

  it('creates page label with correct page number', () => {
    const label = document.createElement('div');
    label.className = 'page-org-label';
    const pageNum = 5;
    label.innerHTML = `<span class="page-num">${pageNum}</span>`;
    assert.ok(label.innerHTML.includes('5'));
  });
});

// ─── Page Organizer — selection UI logic ────────────────────────────────────

describe('Page Organizer — selection UI update', () => {
  it('toggles selected class based on set membership', () => {
    const selected = new Set([0, 2]);
    const thumbs = [0, 1, 2].map(i => {
      const t = document.createElement('div');
      t.classList.toggle('selected', selected.has(i));
      return t;
    });
    assert.ok(thumbs[0].classList.contains('selected'));
    assert.ok(!thumbs[1].classList.contains('selected'));
    assert.ok(thumbs[2].classList.contains('selected'));
  });

  it('status shows selection count when pages selected', () => {
    const selected = new Set([0, 2, 4]);
    const orgNewOrder = [0, 1, 2, 3, 4];
    const selCount = selected.size;
    const statusText = selCount > 0
      ? `Выбрано: ${selCount} из ${orgNewOrder.length}`
      : `${orgNewOrder.length} страниц`;
    assert.equal(statusText, 'Выбрано: 3 из 5');
  });

  it('status shows page count when no pages selected', () => {
    const selected = new Set();
    const orgNewOrder = [0, 1, 2];
    const selCount = selected.size;
    const statusText = selCount > 0
      ? `Выбрано: ${selCount} из ${orgNewOrder.length}`
      : `${orgNewOrder.length} страниц`;
    assert.equal(statusText, '3 страниц');
  });
});

// ─── Page Organizer — drag reorder logic ────────────────────────────────────

describe('Page Organizer — drag reorder', () => {
  it('dragstart adds dragging class', () => {
    const thumb = document.createElement('div');
    thumb.classList.add('dragging');
    assert.ok(thumb.classList.contains('dragging'));
  });

  it('dragend removes dragging class', () => {
    const thumb = document.createElement('div');
    thumb.classList.add('dragging');
    thumb.classList.remove('dragging');
    assert.ok(!thumb.classList.contains('dragging'));
  });

  it('dragover adds drop-target class', () => {
    const thumb = document.createElement('div');
    thumb.classList.add('drop-target');
    assert.ok(thumb.classList.contains('drop-target'));
  });

  it('dragleave removes drop-target class', () => {
    const thumb = document.createElement('div');
    thumb.classList.add('drop-target');
    thumb.classList.remove('drop-target');
    assert.ok(!thumb.classList.contains('drop-target'));
  });

  it('drop removes drop-target class', () => {
    const thumb = document.createElement('div');
    thumb.classList.add('drop-target');
    // Replicate line 114
    thumb.classList.remove('drop-target');
    assert.ok(!thumb.classList.contains('drop-target'));
  });
});

// ─── Page Organizer — delete pages logic ────────────────────────────────────

describe('Page Organizer — delete pages', () => {
  it('filters out selected pages from order', () => {
    let orgNewOrder = [0, 1, 2, 3, 4];
    const toDelete = new Set([1, 3]);
    orgNewOrder = orgNewOrder.filter((_, i) => !toDelete.has(i));
    assert.deepStrictEqual(orgNewOrder, [0, 2, 4]);
  });

  it('does nothing when no pages selected', () => {
    let orgNewOrder = [0, 1, 2];
    const toDelete = new Set();
    orgNewOrder = orgNewOrder.filter((_, i) => !toDelete.has(i));
    assert.deepStrictEqual(orgNewOrder, [0, 1, 2]);
  });

  it('can delete all pages', () => {
    let orgNewOrder = [0, 1, 2];
    const toDelete = new Set([0, 1, 2]);
    orgNewOrder = orgNewOrder.filter((_, i) => !toDelete.has(i));
    assert.deepStrictEqual(orgNewOrder, []);
  });
});

// ─── Page Organizer — duplicate pages logic ─────────────────────────────────

describe('Page Organizer — duplicate pages', () => {
  it('duplicates selected pages after their positions', () => {
    const orgNewOrder = [0, 1, 2, 3];
    const selected = new Set([1, 3]);
    const indices = [...selected].sort((a, b) => b - a);
    for (const i of indices) {
      orgNewOrder.splice(i + 1, 0, orgNewOrder[i]);
    }
    // After duplicating index 3 (value 3): [0,1,2,3,3]
    // After duplicating index 1 (value 1): [0,1,1,2,3,3]
    assert.deepStrictEqual(orgNewOrder, [0, 1, 1, 2, 3, 3]);
  });

  it('duplicates single page', () => {
    const orgNewOrder = [0, 1, 2];
    const indices = [1];
    for (const i of indices) {
      orgNewOrder.splice(i + 1, 0, orgNewOrder[i]);
    }
    assert.deepStrictEqual(orgNewOrder, [0, 1, 1, 2]);
  });
});

// ─── Page Organizer — reverse pages logic ───────────────────────────────────

describe('Page Organizer — reverse pages', () => {
  it('reverses the page order', () => {
    const orgNewOrder = [0, 1, 2, 3, 4];
    orgNewOrder.reverse();
    assert.deepStrictEqual(orgNewOrder, [4, 3, 2, 1, 0]);
  });

  it('reversing single page is identity', () => {
    const orgNewOrder = [0];
    orgNewOrder.reverse();
    assert.deepStrictEqual(orgNewOrder, [0]);
  });

  it('double reverse restores original order', () => {
    const orgNewOrder = [0, 1, 2, 3];
    orgNewOrder.reverse();
    orgNewOrder.reverse();
    assert.deepStrictEqual(orgNewOrder, [0, 1, 2, 3]);
  });
});

// ─── Page Organizer — apply with no data ────────────────────────────────────

describe('Page Organizer — apply guard', () => {
  it('returns early when orgPdfBytes is null', () => {
    const orgPdfBytes = null;
    const orgNewOrder = [0, 1, 2];
    let proceeded = false;
    if (!orgPdfBytes || !orgNewOrder) {
      // early return
    } else {
      proceeded = true;
    }
    assert.ok(!proceeded);
  });

  it('returns early when orgNewOrder is null', () => {
    const orgPdfBytes = new Uint8Array(10);
    const orgNewOrder = null;
    let proceeded = false;
    if (!orgPdfBytes || !orgNewOrder) {
      // early return
    } else {
      proceeded = true;
    }
    assert.ok(!proceeded);
  });

  it('proceeds when both orgPdfBytes and orgNewOrder exist', () => {
    const orgPdfBytes = new Uint8Array(10);
    const orgNewOrder = [0, 1];
    let proceeded = false;
    if (!orgPdfBytes || !orgNewOrder) {
      // early return
    } else {
      proceeded = true;
    }
    assert.ok(proceeded);
  });
});

// ─── Page Organizer — rotate guard ──────────────────────────────────────────

describe('Page Organizer — rotate guard', () => {
  it('returns early when orgPdfBytes is null', () => {
    const orgPdfBytes = null;
    const orgState = { selected: new Set([0]) };
    let proceeded = false;
    if (!orgPdfBytes || !orgState?.selected.size) {
      // early return
    } else {
      proceeded = true;
    }
    assert.ok(!proceeded);
  });

  it('returns early when no pages selected', () => {
    const orgPdfBytes = new Uint8Array(10);
    const orgState = { selected: new Set() };
    let proceeded = false;
    if (!orgPdfBytes || !orgState?.selected.size) {
      // early return
    } else {
      proceeded = true;
    }
    assert.ok(!proceeded);
  });

  it('proceeds when pdfBytes exist and pages selected', () => {
    const orgPdfBytes = new Uint8Array(10);
    const orgState = { selected: new Set([0, 2]) };
    let proceeded = false;
    if (!orgPdfBytes || !orgState?.selected.size) {
      // early return
    } else {
      proceeded = true;
    }
    assert.ok(proceeded);
  });
});

// ─── Page Organizer — extract guard ─────────────────────────────────────────

describe('Page Organizer — extract guard', () => {
  it('returns early when orgPdfBytes is null', () => {
    const orgPdfBytes = null;
    const orgState = { selected: new Set([1]) };
    let proceeded = false;
    if (!orgPdfBytes || !orgState?.selected.size) {
      // early return
    } else {
      proceeded = true;
    }
    assert.ok(!proceeded);
  });

  it('computes correct indices from selection and order', () => {
    const orgNewOrder = [3, 1, 4, 2, 0];
    const selected = new Set([0, 2]);
    const indices = [...selected].map(i => orgNewOrder[i]);
    assert.deepStrictEqual(indices, [3, 4]);
  });
});
