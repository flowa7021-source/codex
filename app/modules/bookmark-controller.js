// @ts-check
// bookmark-controller.js — Bookmark management for NovaReader
import { state, els } from './state.js';

const MAX_BOOKMARKS = 500;

function storageKey() {
  return `novareader-bookmarks:${state.docName || 'global'}`;
}

function loadBookmarks() {
  try {
    const raw = localStorage.getItem(storageKey());
    return raw ? JSON.parse(raw) : [];
  } catch (err) { console.warn('[bookmark-controller storage] error:', err?.message); return []; }
}

function saveBookmarks(bookmarks) {
  localStorage.setItem(storageKey(), JSON.stringify(bookmarks));
}

export function addBookmark(page, title) {
  const bookmarks = loadBookmarks();
  if (bookmarks.some(b => b.page === page)) return false;
  if (bookmarks.length >= MAX_BOOKMARKS) return false;
  bookmarks.push({ page, title: title || `Страница ${page}`, createdAt: Date.now() });
  bookmarks.sort((a, b) => a.page - b.page);
  saveBookmarks(bookmarks);
  renderBookmarkList();
  updateBookmarkButton();
  return true;
}

export function removeBookmark(page) {
  const bookmarks = loadBookmarks().filter(b => b.page !== page);
  saveBookmarks(bookmarks);
  renderBookmarkList();
  updateBookmarkButton();
}

export function toggleBookmark(page) {
  if (isBookmarked(page)) {
    removeBookmark(page);
  } else {
    addBookmark(page);
  }
}

export function isBookmarked(page) {
  return loadBookmarks().some(b => b.page === page);
}

export function getBookmarks() {
  return loadBookmarks();
}

export function clearAllBookmarks() {
  saveBookmarks([]);
  renderBookmarkList();
  updateBookmarkButton();
}

export function updateBookmarkButton() {
  const btn = els.addBookmarkToolbar;
  if (!btn) return;
  const bookmarked = isBookmarked(state.currentPage);
  btn.textContent = bookmarked ? '★' : '☆';
  btn.title = bookmarked ? 'Убрать закладку' : 'Добавить закладку';
  btn.classList.toggle('active', bookmarked);
}

export function renderBookmarkList() {
  const list = els.bookmarkList;
  if (!list) return;
  list.innerHTML = '';

  const bookmarks = loadBookmarks();
  const filterEl = els.bookmarkFilter;
  const filterText = (/** @type {any} */ (filterEl)?.value || '').toLowerCase().trim();

  const filtered = filterText
    ? bookmarks.filter(b => b.title.toLowerCase().includes(filterText) || String(b.page).includes(filterText))
    : bookmarks;

  if (!filtered.length) {
    list.innerHTML = '<div style="color:var(--text-muted,#888);padding:8px;font-size:12px;">Нет закладок</div>';
    return;
  }

  for (const bm of filtered) {
    const item = document.createElement('div');
    item.className = 'bookmark-item';
    item.style.cssText = 'display:flex;align-items:center;gap:6px;padding:4px 8px;cursor:pointer;border-radius:4px;font-size:13px;';
    item.addEventListener('mouseenter', () => { item.style.background = 'var(--hover,#2a2a3a)'; });
    item.addEventListener('mouseleave', () => { item.style.background = ''; });

    const pageSpan = document.createElement('span');
    pageSpan.textContent = `${bm.page}`;
    pageSpan.style.cssText = 'min-width:30px;color:var(--accent,#3b82f6);font-weight:600;';

    const titleSpan = document.createElement('span');
    titleSpan.textContent = bm.title;
    titleSpan.style.cssText = 'flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';

    const removeBtn = document.createElement('button');
    removeBtn.textContent = '✕';
    removeBtn.title = 'Удалить';
    removeBtn.style.cssText = 'border:none;background:transparent;color:var(--text-muted,#888);cursor:pointer;font-size:12px;padding:2px 4px;border-radius:3px;';
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeBookmark(bm.page);
    });

    item.appendChild(pageSpan);
    item.appendChild(titleSpan);
    item.appendChild(removeBtn);
    item.addEventListener('click', () => {
      // Dispatch custom event for navigation
      window.dispatchEvent(new CustomEvent('bookmark-navigate', { detail: { page: bm.page } }));
    });
    list.appendChild(item);
  }
}

export function exportBookmarks() {
  const bookmarks = loadBookmarks();
  const json = JSON.stringify(bookmarks, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.docName || 'bookmarks'}-bookmarks.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importBookmarks(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(/** @type {string} */ (reader.result));
      if (!Array.isArray(imported)) return;
      const current = loadBookmarks();
      const merged = [...current];
      for (const bm of imported) {
        if (bm.page && !merged.some(b => b.page === bm.page)) {
          merged.push({ page: bm.page, title: bm.title || `Страница ${bm.page}`, createdAt: bm.createdAt || Date.now() });
        }
      }
      merged.sort((a, b) => a.page - b.page);
      saveBookmarks(merged.slice(0, MAX_BOOKMARKS));
      renderBookmarkList();
      updateBookmarkButton();
    } catch (err) { console.warn('[bookmark-controller] error:', err?.message); }
  };
  reader.readAsText(file);
}

export function initBookmarkController() {
  // Toolbar bookmark button
  if (els.addBookmarkToolbar) {
    els.addBookmarkToolbar.addEventListener('click', () => {
      toggleBookmark(state.currentPage);
    });
  }

  // Sidebar add bookmark button
  if (els.addBookmark) {
    els.addBookmark.addEventListener('click', () => {
      toggleBookmark(state.currentPage);
    });
  }

  // Clear all
  if (els.clearBookmarks) {
    els.clearBookmarks.addEventListener('click', () => {
      if (confirm('Удалить все закладки?')) {
        clearAllBookmarks();
      }
    });
  }

  // Export
  if (els.exportBookmarks) {
    els.exportBookmarks.addEventListener('click', exportBookmarks);
  }

  // Import
  if (els.importBookmarks) {
    els.importBookmarks.addEventListener('change', (e) => {
      importBookmarks(/** @type {any} */ (e.target).files?.[0]);
      /** @type {any} */ (e.target).value = '';
    });
  }

  // Filter
  if (els.bookmarkFilter) {
    els.bookmarkFilter.addEventListener('input', () => renderBookmarkList());
  }
  if (els.clearBookmarkFilter) {
    els.clearBookmarkFilter.addEventListener('click', () => {
      if (els.bookmarkFilter) /** @type {any} */ (els.bookmarkFilter).value = '';
      renderBookmarkList();
    });
  }

  // Navigation event listener
  window.addEventListener('bookmark-navigate', (e) => {
    const page = /** @type {any} */ (e).detail?.page;
    if (page && page >= 1 && page <= state.pageCount) {
      state.currentPage = page;
      // Will be picked up by app.js renderCurrentPage dep
      window.dispatchEvent(new CustomEvent('novareader-goto-page', { detail: { page } }));
    }
  });

  renderBookmarkList();
  updateBookmarkButton();
}
