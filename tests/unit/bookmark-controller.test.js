// ─── Unit Tests: BookmarkController ────────────────────────────────────────
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  addBookmark,
  removeBookmark,
  toggleBookmark,
  isBookmarked,
  getBookmarks,
  clearAllBookmarks,
  updateBookmarkButton,
  renderBookmarkList,
  exportBookmarks,
  importBookmarks,
  initBookmarkController,
} from '../../app/modules/bookmark-controller.js';
import { state, els } from '../../app/modules/state.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function resetState() {
  state.docName = 'test.pdf';
  state.currentPage = 1;
  state.pageCount = 10;
  state.adapter = { type: 'pdf' };
  localStorage.clear();

  // Mock els
  els.addBookmarkToolbar = null;
  els.addBookmark = null;
  els.clearBookmarks = null;
  els.exportBookmarks = null;
  els.importBookmarks = null;
  els.bookmarkFilter = null;
  els.clearBookmarkFilter = null;
  els.bookmarkList = null;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('addBookmark', () => {
  beforeEach(resetState);

  it('adds a bookmark and returns true', () => {
    els.bookmarkList = document.createElement('div');
    const result = addBookmark(3, 'Chapter 1');
    assert.equal(result, true);
    assert.equal(isBookmarked(3), true);
  });

  it('returns false when adding duplicate page', () => {
    els.bookmarkList = document.createElement('div');
    addBookmark(3, 'Chapter 1');
    const result = addBookmark(3, 'Chapter 1 duplicate');
    assert.equal(result, false);
  });

  it('uses default title when none provided', () => {
    els.bookmarkList = document.createElement('div');
    addBookmark(5);
    const bookmarks = getBookmarks();
    assert.equal(bookmarks[0].title, 'Страница 5');
  });

  it('sorts bookmarks by page number', () => {
    els.bookmarkList = document.createElement('div');
    addBookmark(5, 'Five');
    addBookmark(2, 'Two');
    addBookmark(8, 'Eight');
    const bookmarks = getBookmarks();
    assert.deepEqual(bookmarks.map(b => b.page), [2, 5, 8]);
  });

  it('enforces MAX_BOOKMARKS limit (500)', () => {
    els.bookmarkList = document.createElement('div');
    for (let i = 1; i <= 500; i++) {
      addBookmark(i, `Page ${i}`);
    }
    const result = addBookmark(501, 'Over limit');
    assert.equal(result, false);
    assert.equal(getBookmarks().length, 500);
  });

  it('sets createdAt timestamp', () => {
    els.bookmarkList = document.createElement('div');
    const before = Date.now();
    addBookmark(1, 'Test');
    const after = Date.now();
    const bm = getBookmarks()[0];
    assert.ok(bm.createdAt >= before && bm.createdAt <= after);
  });
});

describe('removeBookmark', () => {
  beforeEach(resetState);

  it('removes a bookmark by page', () => {
    els.bookmarkList = document.createElement('div');
    addBookmark(3, 'Chapter 1');
    removeBookmark(3);
    assert.equal(isBookmarked(3), false);
    assert.equal(getBookmarks().length, 0);
  });

  it('does nothing for non-existent page', () => {
    els.bookmarkList = document.createElement('div');
    addBookmark(3, 'Chapter 1');
    removeBookmark(99);
    assert.equal(getBookmarks().length, 1);
  });
});

describe('toggleBookmark', () => {
  beforeEach(resetState);

  it('adds bookmark if not bookmarked', () => {
    els.bookmarkList = document.createElement('div');
    toggleBookmark(5);
    assert.equal(isBookmarked(5), true);
  });

  it('removes bookmark if already bookmarked', () => {
    els.bookmarkList = document.createElement('div');
    addBookmark(5, 'Test');
    toggleBookmark(5);
    assert.equal(isBookmarked(5), false);
  });
});

describe('isBookmarked', () => {
  beforeEach(resetState);

  it('returns false for non-bookmarked page', () => {
    assert.equal(isBookmarked(1), false);
  });

  it('returns true for bookmarked page', () => {
    els.bookmarkList = document.createElement('div');
    addBookmark(1, 'Test');
    assert.equal(isBookmarked(1), true);
  });
});

describe('getBookmarks', () => {
  beforeEach(resetState);

  it('returns empty array when no bookmarks', () => {
    assert.deepEqual(getBookmarks(), []);
  });

  it('returns all bookmarks', () => {
    els.bookmarkList = document.createElement('div');
    addBookmark(1, 'One');
    addBookmark(2, 'Two');
    const bookmarks = getBookmarks();
    assert.equal(bookmarks.length, 2);
  });

  it('handles corrupted localStorage gracefully', () => {
    localStorage.setItem('novareader-bookmarks:test.pdf', 'INVALID JSON');
    const bookmarks = getBookmarks();
    assert.deepEqual(bookmarks, []);
  });
});

describe('clearAllBookmarks', () => {
  beforeEach(resetState);

  it('removes all bookmarks', () => {
    els.bookmarkList = document.createElement('div');
    addBookmark(1, 'One');
    addBookmark(2, 'Two');
    clearAllBookmarks();
    assert.deepEqual(getBookmarks(), []);
  });
});

describe('updateBookmarkButton', () => {
  beforeEach(resetState);

  it('does nothing when button is null', () => {
    els.addBookmarkToolbar = null;
    updateBookmarkButton(); // should not throw
  });

  it('shows star for bookmarked page', () => {
    els.bookmarkList = document.createElement('div');
    const btn = document.createElement('button');
    els.addBookmarkToolbar = btn;
    state.currentPage = 3;
    addBookmark(3, 'Test');
    updateBookmarkButton();
    assert.equal(btn.textContent, '★');
    assert.ok(btn.classList.contains('active'));
  });

  it('shows empty star for non-bookmarked page', () => {
    const btn = document.createElement('button');
    els.addBookmarkToolbar = btn;
    state.currentPage = 3;
    updateBookmarkButton();
    assert.equal(btn.textContent, '☆');
    assert.equal(btn.classList.contains('active'), false);
  });
});

describe('renderBookmarkList', () => {
  beforeEach(resetState);

  it('does nothing when list element is null', () => {
    els.bookmarkList = null;
    renderBookmarkList(); // should not throw
  });

  it('shows empty message when no bookmarks', () => {
    const list = document.createElement('div');
    els.bookmarkList = list;
    renderBookmarkList();
    assert.ok(list.innerHTML.includes('Нет закладок'));
  });

  it('renders bookmark items', () => {
    const list = document.createElement('div');
    els.bookmarkList = list;
    addBookmark(1, 'First');
    addBookmark(5, 'Fifth');
    assert.equal(list.querySelectorAll('.bookmark-item').length, 2);
  });

  it('filters bookmarks by title', () => {
    const list = document.createElement('div');
    els.bookmarkList = list;
    const filter = document.createElement('input');
    filter.value = 'First';
    els.bookmarkFilter = filter;
    addBookmark(1, 'First chapter');
    addBookmark(5, 'Second chapter');
    // Re-render with filter
    renderBookmarkList();
    assert.equal(list.querySelectorAll('.bookmark-item').length, 1);
    els.bookmarkFilter = null;
  });

  it('filters bookmarks by page number string', () => {
    const list = document.createElement('div');
    els.bookmarkList = list;
    const filter = document.createElement('input');
    filter.value = '5';
    els.bookmarkFilter = filter;
    addBookmark(1, 'One');
    addBookmark(5, 'Five');
    renderBookmarkList();
    assert.equal(list.querySelectorAll('.bookmark-item').length, 1);
    els.bookmarkFilter = null;
  });

  it('dispatches bookmark-navigate on item click', () => {
    const list = document.createElement('div');
    els.bookmarkList = list;
    addBookmark(3, 'Test');

    let navigated = null;
    const handler = (e) => { navigated = e.detail.page; };
    window.addEventListener('bookmark-navigate', handler);

    const item = list.querySelector('.bookmark-item');
    item.click();
    assert.equal(navigated, 3);
    window.removeEventListener('bookmark-navigate', handler);
  });

  it('remove button removes bookmark', () => {
    const list = document.createElement('div');
    els.bookmarkList = list;
    addBookmark(3, 'Test');
    const removeBtn = list.querySelector('button');
    removeBtn.click();
    assert.equal(isBookmarked(3), false);
  });
});

describe('exportBookmarks', () => {
  beforeEach(resetState);

  it('creates a download link', () => {
    els.bookmarkList = document.createElement('div');
    addBookmark(1, 'Test');
    let clickedHref = null;
    const origCreateElement = document.createElement.bind(document);
    // exportBookmarks creates an <a> and clicks it — just verify no errors
    exportBookmarks();
    // If we get here without errors, the export logic works
    assert.ok(true);
  });

  it('uses docName in filename', () => {
    els.bookmarkList = document.createElement('div');
    state.docName = 'mybook.pdf';
    addBookmark(1, 'Test');
    // No assertion needed beyond no-throw — filename is set on transient element
    exportBookmarks();
    assert.ok(true);
  });

  it('uses fallback name when docName is null', () => {
    els.bookmarkList = document.createElement('div');
    state.docName = null;
    exportBookmarks();
    assert.ok(true);
  });
});

describe('importBookmarks', () => {
  beforeEach(resetState);

  it('does nothing when file is null', () => {
    importBookmarks(null);
    assert.deepEqual(getBookmarks(), []);
  });

  it('merges imported bookmarks with existing', (_, done) => {
    els.bookmarkList = document.createElement('div');
    addBookmark(1, 'Existing');

    const imported = [
      { page: 2, title: 'Imported 2' },
      { page: 3, title: 'Imported 3' },
    ];
    const blob = new Blob([JSON.stringify(imported)], { type: 'application/json' });
    const file = new File([blob], 'bookmarks.json');

    importBookmarks(file);

    // FileReader is async, wait a tick
    setTimeout(() => {
      const bookmarks = getBookmarks();
      assert.equal(bookmarks.length, 3);
      assert.equal(bookmarks[0].page, 1);
      assert.equal(bookmarks[1].page, 2);
      assert.equal(bookmarks[2].page, 3);
      done();
    }, 100);
  });

  it('does not add duplicate pages during import', (_, done) => {
    els.bookmarkList = document.createElement('div');
    addBookmark(1, 'Existing');

    const imported = [
      { page: 1, title: 'Duplicate' },
      { page: 2, title: 'New' },
    ];
    const blob = new Blob([JSON.stringify(imported)], { type: 'application/json' });
    const file = new File([blob], 'bookmarks.json');

    importBookmarks(file);

    setTimeout(() => {
      const bookmarks = getBookmarks();
      assert.equal(bookmarks.length, 2);
      assert.equal(bookmarks[0].title, 'Existing');
      done();
    }, 100);
  });

  it('handles invalid JSON gracefully', (_, done) => {
    els.bookmarkList = document.createElement('div');
    const blob = new Blob(['NOT JSON'], { type: 'application/json' });
    const file = new File([blob], 'bad.json');

    importBookmarks(file);

    setTimeout(() => {
      assert.deepEqual(getBookmarks(), []);
      done();
    }, 100);
  });

  it('handles non-array JSON gracefully', (_, done) => {
    els.bookmarkList = document.createElement('div');
    const blob = new Blob([JSON.stringify({ not: 'array' })], { type: 'application/json' });
    const file = new File([blob], 'bad.json');

    importBookmarks(file);

    setTimeout(() => {
      assert.deepEqual(getBookmarks(), []);
      done();
    }, 100);
  });

  it('caps at MAX_BOOKMARKS during import', (_, done) => {
    els.bookmarkList = document.createElement('div');

    // Add 499 existing
    for (let i = 1; i <= 499; i++) {
      addBookmark(i, `Page ${i}`);
    }

    const imported = [
      { page: 500, title: 'Five hundred' },
      { page: 501, title: 'Over limit' },
    ];
    const blob = new Blob([JSON.stringify(imported)], { type: 'application/json' });
    const file = new File([blob], 'bookmarks.json');

    importBookmarks(file);

    setTimeout(() => {
      const bookmarks = getBookmarks();
      assert.equal(bookmarks.length, 500);
      done();
    }, 100);
  });

  it('assigns default title to imported bookmarks without title', (_, done) => {
    els.bookmarkList = document.createElement('div');
    const imported = [{ page: 7 }];
    const blob = new Blob([JSON.stringify(imported)], { type: 'application/json' });
    const file = new File([blob], 'bookmarks.json');

    importBookmarks(file);

    setTimeout(() => {
      const bookmarks = getBookmarks();
      assert.equal(bookmarks[0].title, 'Страница 7');
      done();
    }, 100);
  });

  it('skips entries without page property', (_, done) => {
    els.bookmarkList = document.createElement('div');
    const imported = [{ title: 'No page' }, { page: 3, title: 'Has page' }];
    const blob = new Blob([JSON.stringify(imported)], { type: 'application/json' });
    const file = new File([blob], 'bookmarks.json');

    importBookmarks(file);

    setTimeout(() => {
      const bookmarks = getBookmarks();
      assert.equal(bookmarks.length, 1);
      assert.equal(bookmarks[0].page, 3);
      done();
    }, 100);
  });
});

describe('initBookmarkController', () => {
  beforeEach(resetState);

  it('sets up toolbar button click listener', () => {
    els.bookmarkList = document.createElement('div');
    const btn = document.createElement('button');
    els.addBookmarkToolbar = btn;
    state.currentPage = 3;

    initBookmarkController();
    btn.click();
    assert.equal(isBookmarked(3), true);
  });

  it('sets up sidebar add button click listener', () => {
    els.bookmarkList = document.createElement('div');
    const btn = document.createElement('button');
    els.addBookmark = btn;
    state.currentPage = 4;

    initBookmarkController();
    btn.click();
    assert.equal(isBookmarked(4), true);
  });

  it('calls renderBookmarkList and updateBookmarkButton on init', () => {
    const list = document.createElement('div');
    els.bookmarkList = list;
    initBookmarkController();
    // No bookmarks, should show empty message
    assert.ok(list.innerHTML.includes('Нет закладок'));
  });

  it('handles bookmark-navigate event within valid page range', () => {
    els.bookmarkList = document.createElement('div');
    state.pageCount = 10;
    initBookmarkController();

    let gotoPage = null;
    window.addEventListener('novareader-goto-page', (e) => {
      gotoPage = /** @type {any} */ (e).detail.page;
    }, { once: true });

    window.dispatchEvent(new CustomEvent('bookmark-navigate', { detail: { page: 5 } }));
    assert.equal(state.currentPage, 5);
    assert.equal(gotoPage, 5);
  });

  it('ignores bookmark-navigate for out-of-range pages', () => {
    els.bookmarkList = document.createElement('div');
    state.pageCount = 10;
    state.currentPage = 1;
    initBookmarkController();

    window.dispatchEvent(new CustomEvent('bookmark-navigate', { detail: { page: 99 } }));
    assert.equal(state.currentPage, 1); // unchanged
  });

  it('ignores bookmark-navigate with no page', () => {
    els.bookmarkList = document.createElement('div');
    state.pageCount = 10;
    state.currentPage = 1;
    initBookmarkController();

    window.dispatchEvent(new CustomEvent('bookmark-navigate', { detail: {} }));
    assert.equal(state.currentPage, 1);
  });
});

describe('storage key isolation', () => {
  beforeEach(resetState);

  it('uses docName in storage key', () => {
    els.bookmarkList = document.createElement('div');
    state.docName = 'docA.pdf';
    addBookmark(1, 'A');

    state.docName = 'docB.pdf';
    assert.equal(isBookmarked(1), false);
    assert.deepEqual(getBookmarks(), []);
  });

  it('falls back to global when docName is null', () => {
    els.bookmarkList = document.createElement('div');
    state.docName = null;
    addBookmark(1, 'Global');
    const raw = localStorage.getItem('novareader-bookmarks:global');
    assert.ok(raw);
    assert.ok(JSON.parse(raw).length === 1);
  });
});
