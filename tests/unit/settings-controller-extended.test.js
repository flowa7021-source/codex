// ─── Extended Unit Tests: SettingsController ──────────────────────────────────
// Tests for functions not covered in settings-controller.test.js:
// applyUiSizeSettings, loadNotes, saveNotes, hotkeyKeys, loadHotkeys,
// resetHotkeys, saveBookmarks, clearBookmarks, exportNotes, etc.
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  applyUiSizeSettings,
  loadNotes,
  saveNotes,
  getNotesModel,
  setNotesStatus,
  loadAppSettings,
  saveAppSettings,
  hotkeyKeys,
  hotkeyFieldMeta,
  loadHotkeys,
  resetHotkeys,
  saveBookmarks,
  clearBookmarks,
  loadBookmarks,
  setBookmarksStatus,
  insertTimestamp,
  setHotkeysStatus,
  setHotkeysInputErrors,
  autoFixHotkeys,
  exportBookmarksJson,
  renderBookmarks,
} from '../../app/modules/settings-controller.js';
import { state, els as _els, hotkeys, defaultHotkeys, setHotkeys } from '../../app/modules/state.js';

/** @type {Record<string, any>} */
const els = _els;

// ── DOM patching ─────────────────────────────────────────────────────────────
// Augment the minimal DOM mock from setup-dom.js with setProperty / click
if (!document.documentElement.style.setProperty) {
  document.documentElement.style.setProperty = () => {};
}
const _origCreateElement = document.createElement;
document.createElement = (tag) => {
  const el = _origCreateElement(tag);
  if (!el.click) el.click = () => {};
  if (!el.href) el.href = '';
  if (!el.download) el.download = '';
  return el;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function resetState() {
  state.settings = null;
  state.docName = 'test.pdf';
  state.adapter = { type: 'pdf' };
  state.currentPage = 1;
  state.pageCount = 10;
  localStorage.clear();
}

function setupElsMock() {
  // Set up mock elements for the notes functionality
  els.notesTitle = { value: '' };
  els.notesTags = { value: '' };
  els.notes = { value: '', focus() {} };
  els.notesStatus = { textContent: '' };
  els.notesImportMode = { value: 'replace' };

  // Hotkey elements
  els.hotkeysStatus = { textContent: '', classList: { remove() {}, add() {} } };
  els.hkNext = { value: '', classList: { remove() {}, add() {} }, addEventListener() {} };
  els.hkPrev = { value: '', classList: { remove() {}, add() {} }, addEventListener() {} };
  els.hkZoomIn = { value: '', classList: { remove() {}, add() {} }, addEventListener() {} };
  els.hkZoomOut = { value: '', classList: { remove() {}, add() {} }, addEventListener() {} };
  els.hkAnnotate = { value: '', classList: { remove() {}, add() {} }, addEventListener() {} };
  els.hkSearchFocus = { value: '', classList: { remove() {}, add() {} }, addEventListener() {} };
  els.hkOcrPage = { value: '', classList: { remove() {}, add() {} }, addEventListener() {} };
  els.hkFitWidth = { value: '', classList: { remove() {}, add() {} }, addEventListener() {} };
  els.hkFitPage = { value: '', classList: { remove() {}, add() {} }, addEventListener() {} };
  els.hkNextHint = { textContent: '' };
  els.hkPrevHint = { textContent: '' };
  els.hkZoomInHint = { textContent: '' };
  els.hkZoomOutHint = { textContent: '' };
  els.hkAnnotateHint = { textContent: '' };
  els.hkSearchFocusHint = { textContent: '' };
  els.hkOcrPageHint = { textContent: '' };
  els.hkFitWidthHint = { textContent: '' };
  els.hkFitPageHint = { textContent: '' };

  // Bookmark elements
  els.bookmarksStatus = { textContent: '', classList: { remove() {}, add() {} } };
  els.bookmarkList = { innerHTML: '', appendChild() {} };
  els.bookmarkFilter = { value: '' };
}

// ── applyUiSizeSettings ──────────────────────────────────────────────────────

describe('applyUiSizeSettings', () => {
  beforeEach(() => {
    resetState();
    loadAppSettings();
  });

  it('writes to localStorage via uiLayoutKey', () => {
    const keyCalls = [];
    const uiLayoutKey = (k) => { keyCalls.push(k); return `nr-layout-${k}`; };
    applyUiSizeSettings(uiLayoutKey);
    assert.ok(keyCalls.includes('sidebarWidth'));
    assert.ok(keyCalls.includes('pageAreaPx'));
    assert.ok(localStorage.getItem('nr-layout-sidebarWidth'));
    assert.ok(localStorage.getItem('nr-layout-pageAreaPx'));
  });

  it('clamps sidebar width to valid range', () => {
    state.settings.uiSidebarWidth = 50; // below min 160
    const uiLayoutKey = (k) => `nr-layout-${k}`;
    applyUiSizeSettings(uiLayoutKey);
    const val = Number(localStorage.getItem('nr-layout-sidebarWidth'));
    assert.ok(val >= 160);
  });

  it('clamps sidebar width max', () => {
    state.settings.uiSidebarWidth = 999;
    const uiLayoutKey = (k) => `nr-layout-${k}`;
    applyUiSizeSettings(uiLayoutKey);
    const val = Number(localStorage.getItem('nr-layout-sidebarWidth'));
    assert.ok(val <= 360);
  });

  it('uses default settings when state.settings is null', () => {
    state.settings = null;
    const uiLayoutKey = (k) => `nr-layout-${k}`;
    assert.doesNotThrow(() => applyUiSizeSettings(uiLayoutKey));
    assert.ok(localStorage.getItem('nr-layout-sidebarWidth'));
  });
});

// ── loadNotes / saveNotes ──────────────────────────────────────────────────

describe('loadNotes', () => {
  beforeEach(() => {
    resetState();
    setupElsMock();
  });

  it('loads defaults when nothing stored', () => {
    const noteKey = () => 'test-notes';
    loadNotes(noteKey);
    assert.equal(els.notesTitle.value, 'test.pdf');
    assert.equal(els.notesTags.value, '');
    assert.equal(els.notes.value, '');
  });

  it('loads structured notes from localStorage', () => {
    const noteKey = () => 'test-notes';
    const data = { title: 'My Doc', tags: 'tag1, tag2', body: 'Some content' };
    localStorage.setItem('test-notes', JSON.stringify(data));
    loadNotes(noteKey);
    assert.equal(els.notesTitle.value, 'My Doc');
    assert.equal(els.notesTags.value, 'tag1, tag2');
    assert.equal(els.notes.value, 'Some content');
  });

  it('handles legacy plain string format', () => {
    const noteKey = () => 'test-notes';
    localStorage.setItem('test-notes', 'Plain text notes');
    loadNotes(noteKey);
    assert.equal(els.notes.value, 'Plain text notes');
  });

  it('handles corrupt JSON gracefully', () => {
    const noteKey = () => 'test-notes';
    localStorage.setItem('test-notes', '{invalid}');
    assert.doesNotThrow(() => loadNotes(noteKey));
    // Falls back to treating as plain string
    assert.ok(els.notes.value.length > 0);
  });

  it('sets status message', () => {
    const noteKey = () => 'test-notes';
    loadNotes(noteKey);
    assert.ok(els.notesStatus.textContent.length > 0);
  });
});

describe('saveNotes', () => {
  beforeEach(() => {
    resetState();
    setupElsMock();
  });

  it('saves notes to localStorage', () => {
    const noteKey = () => 'test-notes';
    els.notesTitle.value = 'My Title';
    els.notesTags.value = 'a, b';
    els.notes.value = 'Body text';
    saveNotes(noteKey, 'manual');
    const stored = JSON.parse(localStorage.getItem('test-notes'));
    assert.equal(stored.title, 'My Title');
    assert.equal(stored.tags, 'a, b');
    assert.equal(stored.body, 'Body text');
    assert.ok(stored.updatedAt);
  });

  it('sets manual save status message', () => {
    const noteKey = () => 'test-notes';
    saveNotes(noteKey, 'manual');
    assert.ok(els.notesStatus.textContent.includes('Сохранено'));
  });

  it('sets autosave status message', () => {
    const noteKey = () => 'test-notes';
    saveNotes(noteKey, 'auto');
    assert.ok(els.notesStatus.textContent.includes('Автосохранение'));
  });
});

describe('setNotesStatus', () => {
  beforeEach(setupElsMock);

  it('sets the notes status text', () => {
    setNotesStatus('Hello');
    assert.equal(els.notesStatus.textContent, 'Hello');
  });
});

describe('getNotesModel', () => {
  beforeEach(setupElsMock);

  it('returns model from DOM inputs', () => {
    els.notesTitle.value = 'Title';
    els.notesTags.value = 'tag1';
    els.notes.value = 'Body';
    const model = getNotesModel();
    assert.equal(model.title, 'Title');
    assert.equal(model.tags, 'tag1');
    assert.equal(model.body, 'Body');
    assert.ok(model.updatedAt);
  });

  it('trims whitespace from title and tags', () => {
    els.notesTitle.value = '  Title  ';
    els.notesTags.value = '  tag1  ';
    els.notes.value = 'body';
    const model = getNotesModel();
    assert.equal(model.title, 'Title');
    assert.equal(model.tags, 'tag1');
  });
});

describe('insertTimestamp', () => {
  beforeEach(() => {
    resetState();
    setupElsMock();
  });

  it('appends timestamp to notes', () => {
    const noteKey = () => 'test-notes';
    els.notes.value = 'existing text';
    insertTimestamp(noteKey);
    assert.ok(els.notes.value.includes('existing text'));
    assert.ok(els.notes.value.includes('['));
    assert.ok(els.notes.value.includes(']'));
  });

  it('works with empty notes', () => {
    const noteKey = () => 'test-notes';
    els.notes.value = '';
    insertTimestamp(noteKey);
    assert.ok(els.notes.value.includes('['));
  });

  it('saves notes after inserting timestamp', () => {
    const noteKey = () => 'test-notes';
    els.notes.value = '';
    insertTimestamp(noteKey);
    assert.ok(localStorage.getItem('test-notes'));
  });
});

// ── Hotkey helpers ──────────────────────────────────────────────────────────

describe('hotkeyKeys', () => {
  it('returns array of all hotkey field names', () => {
    const keys = hotkeyKeys();
    assert.ok(Array.isArray(keys));
    assert.ok(keys.includes('next'));
    assert.ok(keys.includes('prev'));
    assert.ok(keys.includes('zoomIn'));
    assert.ok(keys.includes('zoomOut'));
    assert.ok(keys.includes('annotate'));
    assert.ok(keys.includes('searchFocus'));
    assert.ok(keys.includes('ocrPage'));
    assert.ok(keys.includes('fitWidth'));
    assert.ok(keys.includes('fitPage'));
  });

  it('matches hotkeyFieldMeta keys', () => {
    const keys = hotkeyKeys();
    const metaKeys = Object.keys(hotkeyFieldMeta);
    assert.deepEqual(keys, metaKeys);
  });
});

describe('hotkeyFieldMeta', () => {
  it('has label for each field', () => {
    for (const [, meta] of Object.entries(hotkeyFieldMeta)) {
      assert.ok(meta.label && meta.label.length > 0);
    }
  });

  it('has input and hint getters', () => {
    for (const [, meta] of Object.entries(hotkeyFieldMeta)) {
      assert.equal(typeof meta.input, 'function');
      assert.equal(typeof meta.hint, 'function');
    }
  });
});

describe('setHotkeysStatus', () => {
  beforeEach(setupElsMock);

  it('sets status text', () => {
    setHotkeysStatus('Test message');
    assert.equal(els.hotkeysStatus.textContent, 'Test message');
  });
});

describe('setHotkeysInputErrors', () => {
  beforeEach(setupElsMock);

  it('does not throw with empty fields', () => {
    assert.doesNotThrow(() => setHotkeysInputErrors([]));
  });

  it('does not throw with unknown field', () => {
    assert.doesNotThrow(() => setHotkeysInputErrors(['nonexistent']));
  });
});

describe('loadHotkeys', () => {
  beforeEach(() => {
    resetState();
    setupElsMock();
  });

  it('loads defaults when nothing stored', () => {
    loadHotkeys();
    assert.equal(hotkeys.next, defaultHotkeys.next);
    assert.equal(hotkeys.prev, defaultHotkeys.prev);
  });

  it('loads stored hotkeys', () => {
    localStorage.setItem('novareader-hotkeys', JSON.stringify({
      next: 'j', prev: 'k', zoomIn: 'ctrl+=', zoomOut: 'ctrl+-',
      annotate: 'a', searchFocus: 'ctrl+f', ocrPage: 'ctrl+o',
      fitWidth: 'ctrl+9', fitPage: 'ctrl+0',
    }));
    loadHotkeys();
    assert.equal(hotkeys.next, 'j');
    assert.equal(hotkeys.prev, 'k');
  });

  it('handles corrupt JSON gracefully', () => {
    localStorage.setItem('novareader-hotkeys', 'not json');
    assert.doesNotThrow(() => loadHotkeys());
    // Falls back to defaults
    assert.equal(hotkeys.next, defaultHotkeys.next);
  });

  it('sets status message', () => {
    loadHotkeys();
    assert.ok(els.hotkeysStatus.textContent.length > 0);
  });
});

describe('resetHotkeys', () => {
  beforeEach(() => {
    resetState();
    setupElsMock();
  });

  it('resets hotkeys to defaults', () => {
    setHotkeys({ next: 'j', prev: 'k' });
    resetHotkeys();
    assert.equal(hotkeys.next, defaultHotkeys.next);
    assert.equal(hotkeys.prev, defaultHotkeys.prev);
  });

  it('saves to localStorage', () => {
    resetHotkeys();
    const stored = JSON.parse(localStorage.getItem('novareader-hotkeys'));
    assert.equal(stored.next, defaultHotkeys.next);
  });

  it('sets success status', () => {
    resetHotkeys();
    assert.ok(els.hotkeysStatus.textContent.includes('сброшены'));
  });
});

describe('autoFixHotkeys', () => {
  beforeEach(() => {
    resetState();
    setupElsMock();
    // Set input values to defaults
    els.hkNext.value = '>';
    els.hkPrev.value = '<';
    els.hkZoomIn.value = 'ctrl+=';
    els.hkZoomOut.value = 'ctrl+-';
    els.hkAnnotate.value = 'ctrl+shift+a';
    els.hkSearchFocus.value = 'ctrl+f';
    els.hkOcrPage.value = 'ctrl+shift+o';
    els.hkFitWidth.value = 'ctrl+9';
    els.hkFitPage.value = 'ctrl+0';
  });

  it('does not throw', () => {
    assert.doesNotThrow(() => autoFixHotkeys());
  });

  it('removes duplicate values', () => {
    els.hkNext.value = 'j';
    els.hkPrev.value = 'j'; // duplicate
    autoFixHotkeys();
    // After auto-fix, next and prev should be different
    assert.notEqual(hotkeys.next, hotkeys.prev);
  });

  it('fills empty fields with defaults or fallbacks', () => {
    els.hkNext.value = '';
    autoFixHotkeys();
    assert.ok(hotkeys.next.length > 0);
  });

  it('saves to localStorage', () => {
    autoFixHotkeys();
    assert.ok(localStorage.getItem('novareader-hotkeys'));
  });
});

// ── Bookmarks ────────────────────────────────────────────────────────────────

describe('saveBookmarks', () => {
  beforeEach(resetState);

  it('saves bookmarks to localStorage', () => {
    let docStatsCalled = false;
    let etaCalled = false;
    const bookmarkKey = () => 'test-bookmarks';
    const bookmarks = [{ page: 1, label: 'Start' }, { page: 5, label: 'Mid' }];

    saveBookmarks(bookmarks, bookmarkKey, () => { docStatsCalled = true; }, () => { etaCalled = true; });
    const stored = JSON.parse(localStorage.getItem('test-bookmarks'));
    assert.equal(stored.length, 2);
    assert.equal(stored[0].page, 1);
    assert.ok(docStatsCalled);
    assert.ok(etaCalled);
  });
});

describe('clearBookmarks', () => {
  beforeEach(() => {
    resetState();
    setupElsMock();
  });

  it('calls save with empty array', () => {
    let savedWith = null;
    let renderCalled = false;
    clearBookmarks((v) => { savedWith = v; }, () => { renderCalled = true; });
    assert.deepEqual(savedWith, []);
    assert.ok(renderCalled);
  });

  it('sets status message', () => {
    clearBookmarks(() => {}, () => {});
    assert.ok(els.bookmarksStatus.textContent.includes('очищены'));
  });
});

describe('setBookmarksStatus', () => {
  beforeEach(setupElsMock);

  it('sets status text', () => {
    setBookmarksStatus('Test');
    assert.equal(els.bookmarksStatus.textContent, 'Test');
  });
});

describe('exportBookmarksJson', () => {
  beforeEach(() => {
    resetState();
    setupElsMock();
  });

  it('exports bookmarks when adapter present', () => {
    state.adapter = { type: 'pdf' };
    state.docName = 'test.pdf';
    const bookmarks = [{ page: 1, label: 'A' }];
    assert.doesNotThrow(() => {
      exportBookmarksJson(() => 'bk-key', () => bookmarks);
    });
    assert.ok(els.bookmarksStatus.textContent.includes('экспортированы'));
  });

  it('shows error when no adapter', () => {
    state.adapter = null;
    exportBookmarksJson(() => 'bk-key', () => []);
    assert.ok(els.bookmarksStatus.textContent.includes('откройте'));
  });
});

describe('renderBookmarks', () => {
  beforeEach(() => {
    resetState();
    setupElsMock();
  });

  it('renders empty message when no bookmarks', () => {
    const bookmarkKey = () => 'test-render-bk';
    let appendedChildren = [];
    els.bookmarkList = {
      innerHTML: '',
      appendChild(child) { appendedChildren.push(child); },
    };
    renderBookmarks(bookmarkKey, () => {}, () => {});
    assert.ok(appendedChildren.length >= 1);
  });

  it('renders bookmark items', () => {
    const bookmarkKey = () => 'test-render-bk';
    localStorage.setItem('test-render-bk', JSON.stringify([
      { page: 1, label: 'Start' },
      { page: 5, label: 'Mid' },
    ]));
    let appendedChildren = [];
    els.bookmarkList = {
      innerHTML: '',
      appendChild(child) { appendedChildren.push(child); },
    };
    renderBookmarks(bookmarkKey, () => {}, () => {});
    assert.equal(appendedChildren.length, 2);
  });
});
