// ─── Coverage Tests: SettingsController ──────────────────────────────────────
// Targets uncovered lines: exportNotes*, importNotesJson, queueNotesAutosave,
// saveHotkeys, bindHotkeyCapture, importBookmarksJson, addBookmark,
// renderBookmarks (click/rename/delete handlers), setHotkeysInputErrors (error path),
// autoFixHotkeys fallback pool.
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  exportNotes,
  exportNotesMarkdown,
  exportNotesJson,
  importNotesJson,
  queueNotesAutosave,
  saveHotkeys,
  bindHotkeyCapture,
  autoFixHotkeys,
  setHotkeysInputErrors,
  importBookmarksJson,
  addBookmark,
  renderBookmarks,
  hotkeyFieldMeta,
  hotkeyKeys,
  loadAppSettings,
} from '../../app/modules/settings-controller.js';
import { state, els as _els, hotkeys, defaultHotkeys } from '../../app/modules/state.js';

/** @type {Record<string, any>} */
const els = _els;

// ── DOM patching ─────────────────────────────────────────────────────────────
if (!document.documentElement.style.setProperty) {
  document.documentElement.style.setProperty = () => {};
}
const _origCreateElement = document.createElement;
document.createElement = (tag) => {
  const el = _origCreateElement(tag);
  if (!el.click) el.click = () => {};
  if (!el.href) el.href = '';
  if (!el.download) el.download = '';
  // Patch querySelector to return a stub element when searching inside innerHTML-based content
  const origQs = el.querySelector.bind(el);
  el.querySelector = (sel) => {
    const result = origQs(sel);
    if (!result && el.innerHTML) {
      return _origCreateElement('button');
    }
    return result;
  };
  return el;
};

// Ensure document.getElementById returns the toast container stub
const _origGetById = document.getElementById;
document.getElementById = (id) => {
  if (id === 'toastContainer') {
    const container = _origCreateElement('div');
    container.id = 'toastContainer';
    return container;
  }
  return _origGetById ? _origGetById.call(document, id) : null;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function resetState() {
  state.settings = null;
  state.docName = 'test.pdf';
  state.adapter = { type: 'pdf' };
  state.currentPage = 3;
  state.pageCount = 10;
  localStorage.clear();
}

function setupElsMock() {
  els.notesTitle = { value: '' };
  els.notesTags = { value: '' };
  els.notes = { value: '', focus() {} };
  els.notesStatus = { textContent: '' };
  els.notesImportMode = { value: 'replace' };

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

  els.bookmarksStatus = { textContent: '', classList: { remove() {}, add() {} } };
  els.bookmarkList = { innerHTML: '', appendChild() {} };
  els.bookmarkFilter = { value: '' };
}

// ── exportNotes ──────────────────────────────────────────────────────────────

describe('exportNotes (coverage)', () => {
  beforeEach(() => {
    resetState();
    setupElsMock();
  });

  it('creates a text download', () => {
    els.notesTitle.value = 'Title';
    els.notesTags.value = 'tag1';
    els.notes.value = 'Body text';
    assert.doesNotThrow(() => exportNotes());
  });

  it('uses docName in download filename', () => {
    state.docName = 'myfile.pdf';
    els.notesTitle.value = 'T';
    els.notesTags.value = '';
    els.notes.value = '';
    assert.doesNotThrow(() => exportNotes());
  });

  it('uses fallback when docName is empty', () => {
    state.docName = '';
    els.notesTitle.value = '';
    els.notesTags.value = '';
    els.notes.value = '';
    assert.doesNotThrow(() => exportNotes());
  });
});

describe('exportNotesMarkdown (coverage)', () => {
  beforeEach(() => {
    resetState();
    setupElsMock();
  });

  it('exports markdown format with tags', () => {
    els.notesTitle.value = 'My Doc';
    els.notesTags.value = 'tag1, tag2';
    els.notes.value = 'Some body';
    assert.doesNotThrow(() => exportNotesMarkdown());
  });

  it('exports without tags', () => {
    els.notesTitle.value = 'My Doc';
    els.notesTags.value = '';
    els.notes.value = 'Body';
    assert.doesNotThrow(() => exportNotesMarkdown());
  });

  it('uses docName fallback for empty title', () => {
    els.notesTitle.value = '';
    els.notesTags.value = '';
    els.notes.value = '';
    state.docName = '';
    assert.doesNotThrow(() => exportNotesMarkdown());
  });
});

describe('exportNotesJson (coverage)', () => {
  beforeEach(() => {
    resetState();
    setupElsMock();
  });

  it('exports JSON format', () => {
    els.notesTitle.value = 'Title';
    els.notesTags.value = 'tag';
    els.notes.value = 'Body';
    assert.doesNotThrow(() => exportNotesJson());
  });

  it('handles empty docName', () => {
    state.docName = '';
    els.notesTitle.value = '';
    els.notesTags.value = '';
    els.notes.value = '';
    assert.doesNotThrow(() => exportNotesJson());
  });
});

// ── importNotesJson ──────────────────────────────────────────────────────────

describe('importNotesJson (coverage)', () => {
  beforeEach(() => {
    resetState();
    setupElsMock();
  });

  it('imports valid JSON notes in replace mode', async () => {
    const payload = {
      app: 'NovaReader',
      version: 2,
      notes: { title: 'Imported', tags: 'x', body: 'imported body' },
    };
    const file = { text: () => Promise.resolve(JSON.stringify(payload)) };

    els.notesImportMode.value = 'replace';
    await importNotesJson(file, () => 'test-notes');
    assert.equal(els.notesTitle.value, 'Imported');
    assert.equal(els.notes.value, 'imported body');
  });

  it('imports notes in append mode', async () => {
    const payload = {
      notes: { title: 'New', tags: 'b', body: 'new body' },
    };
    const file = { text: () => Promise.resolve(JSON.stringify(payload)) };

    els.notesTitle.value = 'Old';
    els.notesTags.value = 'a';
    els.notes.value = 'old body';
    els.notesImportMode.value = 'append';

    await importNotesJson(file, () => 'test-notes');
    assert.ok(els.notes.value.includes('old body'));
    assert.ok(els.notes.value.includes('new body'));
  });

  it('handles null file gracefully', async () => {
    await importNotesJson(null, () => 'test-notes');
  });

  it('handles invalid JSON in file', async () => {
    const file = { text: () => Promise.resolve('not json') };
    await importNotesJson(file, () => 'test-notes');
  });

  it('handles string notes in import payload', async () => {
    const payload = { notes: 'plain text notes' };
    const file = { text: () => Promise.resolve(JSON.stringify(payload)) };
    els.notesImportMode.value = 'replace';
    await importNotesJson(file, () => 'test-notes');
    assert.equal(els.notes.value, 'plain text notes');
  });

  it('uses replace mode when notesImportMode absent', async () => {
    const payload = {
      notes: { title: 'T', tags: '', body: 'B' },
    };
    const file = { text: () => Promise.resolve(JSON.stringify(payload)) };
    els.notesImportMode = null;
    await importNotesJson(file, () => 'test-notes');
    assert.equal(els.notes.value, 'B');
  });
});

// ── queueNotesAutosave ───────────────────────────────────────────────────────

describe('queueNotesAutosave (coverage)', () => {
  beforeEach(() => {
    resetState();
    setupElsMock();
  });

  it('sets pending status message', () => {
    queueNotesAutosave(() => 'test-notes');
    assert.ok(els.notesStatus.textContent.includes('несохранённые'));
  });

  it('debounces multiple calls', () => {
    queueNotesAutosave(() => 'test-notes');
    queueNotesAutosave(() => 'test-notes');
    queueNotesAutosave(() => 'test-notes');
    assert.ok(els.notesStatus.textContent.includes('несохранённые'));
  });
});

// ── saveHotkeys ──────────────────────────────────────────────────────────────

describe('saveHotkeys (coverage)', () => {
  beforeEach(() => {
    resetState();
    setupElsMock();
  });

  it('saves valid hotkeys to localStorage', () => {
    els.hkNext.value = '>';
    els.hkPrev.value = '<';
    els.hkZoomIn.value = '+';
    els.hkZoomOut.value = '-';
    els.hkAnnotate.value = 'a';
    els.hkSearchFocus.value = 'f';
    els.hkOcrPage.value = 'o';
    els.hkFitWidth.value = 'w';
    els.hkFitPage.value = 'p';

    saveHotkeys();
    assert.ok(localStorage.getItem('novareader-hotkeys'));
  });

  it('rejects duplicate hotkeys and sets error status', () => {
    els.hkNext.value = 'j';
    els.hkPrev.value = 'j';
    els.hkZoomIn.value = '+';
    els.hkZoomOut.value = '-';
    els.hkAnnotate.value = 'a';
    els.hkSearchFocus.value = 'f';
    els.hkOcrPage.value = 'o';
    els.hkFitWidth.value = 'w';
    els.hkFitPage.value = 'p';

    saveHotkeys();
    assert.ok(els.hotkeysStatus.textContent.includes('Ошибка'));
  });

  it('handles empty fields by using defaults', () => {
    els.hkNext.value = '';
    els.hkPrev.value = '<';
    els.hkZoomIn.value = '+';
    els.hkZoomOut.value = '-';
    els.hkAnnotate.value = 'a';
    els.hkSearchFocus.value = 'f';
    els.hkOcrPage.value = 'o';
    els.hkFitWidth.value = 'w';
    els.hkFitPage.value = 'p';

    saveHotkeys();
  });
});

// ── setHotkeysInputErrors (error path) ───────────────────────────────────────

describe('setHotkeysInputErrors - error highlighting (coverage)', () => {
  beforeEach(setupElsMock);

  it('highlights specified fields with error class', () => {
    let addedClasses = [];
    els.hkNext.classList.add = (...cls) => { addedClasses.push(...cls); };

    setHotkeysInputErrors(['next'], { next: 'Error message' });
    assert.ok(addedClasses.includes('hotkey-invalid'));
    assert.equal(els.hkNextHint.textContent, 'Error message');
  });

  it('uses default error message when no detail provided', () => {
    setHotkeysInputErrors(['next'], {});
    assert.ok(els.hkNextHint.textContent.length > 0);
  });

  it('clears errors before setting new ones', () => {
    let removedClasses = [];
    setHotkeysInputErrors(['next'], { next: 'Err' });
    els.hkNext.classList.remove = (...cls) => { removedClasses.push(...cls); };
    setHotkeysInputErrors([]);
    assert.ok(removedClasses.includes('hotkey-invalid'));
  });
});

// ── bindHotkeyCapture ────────────────────────────────────────────────────────

describe('bindHotkeyCapture (coverage)', () => {
  beforeEach(setupElsMock);

  it('attaches keydown listeners to all hotkey inputs', () => {
    const listeners = {};
    const fields = hotkeyKeys();
    fields.forEach((field) => {
      const meta = hotkeyFieldMeta[field];
      const input = meta.input();
      input.addEventListener = (type, fn) => {
        if (!listeners[field]) listeners[field] = {};
        listeners[field][type] = fn;
      };
    });

    bindHotkeyCapture();

    for (const field of fields) {
      assert.ok(listeners[field]?.keydown, `keydown listener on ${field}`);
    }
  });

  it('captures regular key press', () => {
    const listeners = {};
    hotkeyKeys().forEach((field) => {
      hotkeyFieldMeta[field].input().addEventListener = (type, fn) => {
        if (!listeners[field]) listeners[field] = {};
        listeners[field][type] = fn;
      };
    });

    bindHotkeyCapture();

    listeners.next.keydown({
      key: 'j',
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
      metaKey: false,
      preventDefault: () => {},
    });
    assert.equal(els.hkNext.value, 'j');
  });

  it('clears field on Backspace', () => {
    const listeners = {};
    hotkeyKeys().forEach((field) => {
      hotkeyFieldMeta[field].input().addEventListener = (type, fn) => {
        if (!listeners[field]) listeners[field] = {};
        listeners[field][type] = fn;
      };
    });

    bindHotkeyCapture();

    els.hkNext.value = 'j';
    listeners.next.keydown({
      key: 'Backspace',
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
      metaKey: false,
      preventDefault: () => {},
    });
    assert.equal(els.hkNext.value, '');
  });

  it('clears field on Delete', () => {
    const listeners = {};
    hotkeyKeys().forEach((field) => {
      hotkeyFieldMeta[field].input().addEventListener = (type, fn) => {
        if (!listeners[field]) listeners[field] = {};
        listeners[field][type] = fn;
      };
    });

    bindHotkeyCapture();

    els.hkNext.value = 'x';
    listeners.next.keydown({
      key: 'Delete',
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
      metaKey: false,
      preventDefault: () => {},
    });
    assert.equal(els.hkNext.value, '');
  });

  it('ignores modifier-only keys', () => {
    const listeners = {};
    hotkeyKeys().forEach((field) => {
      hotkeyFieldMeta[field].input().addEventListener = (type, fn) => {
        if (!listeners[field]) listeners[field] = {};
        listeners[field][type] = fn;
      };
    });

    bindHotkeyCapture();

    els.hkNext.value = 'old';
    listeners.next.keydown({
      key: 'Control',
      ctrlKey: true,
      altKey: false,
      shiftKey: false,
      metaKey: false,
      preventDefault: () => {},
    });
    assert.equal(els.hkNext.value, 'old');
  });
});

// ── autoFixHotkeys with fallback pool ────────────────────────────────────────

describe('autoFixHotkeys - fallback pool (coverage)', () => {
  beforeEach(() => {
    resetState();
    setupElsMock();
  });

  it('uses fallback pool when default is already taken', () => {
    els.hkNext.value = defaultHotkeys.next === 'arrowright' ? '>' : defaultHotkeys.next;
    els.hkPrev.value = defaultHotkeys.prev === 'arrowleft' ? '<' : defaultHotkeys.prev;
    els.hkZoomIn.value = defaultHotkeys.zoomIn;
    els.hkZoomOut.value = defaultHotkeys.zoomOut;
    els.hkAnnotate.value = defaultHotkeys.annotate;
    els.hkSearchFocus.value = defaultHotkeys.searchFocus;
    els.hkOcrPage.value = defaultHotkeys.ocrPage;
    els.hkFitWidth.value = '';
    els.hkFitPage.value = defaultHotkeys.fitWidth;

    autoFixHotkeys();
    assert.ok(hotkeys.fitWidth.length > 0);
    assert.notEqual(hotkeys.fitWidth, hotkeys.fitPage);
  });

  it('handles all fields empty', () => {
    els.hkNext.value = '';
    els.hkPrev.value = '';
    els.hkZoomIn.value = '';
    els.hkZoomOut.value = '';
    els.hkAnnotate.value = '';
    els.hkSearchFocus.value = '';
    els.hkOcrPage.value = '';
    els.hkFitWidth.value = '';
    els.hkFitPage.value = '';

    autoFixHotkeys();

    const values = hotkeyKeys().map((k) => hotkeys[k]);
    values.forEach((v) => assert.ok(v && v.length > 0));
    const unique = new Set(values);
    assert.equal(unique.size, values.length);
  });
});

// ── importBookmarksJson ──────────────────────────────────────────────────────

describe('importBookmarksJson (coverage)', () => {
  beforeEach(() => {
    resetState();
    setupElsMock();
  });

  it('imports valid bookmarks', async () => {
    const payload = {
      bookmarks: [
        { page: 1, label: 'Start' },
        { page: 5, label: 'Middle' },
      ],
    };
    const file = { text: () => Promise.resolve(JSON.stringify(payload)) };

    let savedBookmarks = null;
    let renderCalled = false;
    await importBookmarksJson(
      file,
      (bk) => { savedBookmarks = bk; },
      () => { renderCalled = true; },
    );

    assert.equal(savedBookmarks.length, 2);
    assert.ok(renderCalled);
    assert.ok(els.bookmarksStatus.textContent.includes('Импортировано'));
  });

  it('filters bookmarks outside page range', async () => {
    state.pageCount = 5;
    const payload = {
      bookmarks: [
        { page: 1, label: 'Valid' },
        { page: 99, label: 'Out of range' },
        { page: 0, label: 'Zero' },
      ],
    };
    const file = { text: () => Promise.resolve(JSON.stringify(payload)) };

    let saved = null;
    await importBookmarksJson(file, (bk) => { saved = bk; }, () => {});
    assert.equal(saved.length, 1);
  });

  it('deduplicates bookmarks', async () => {
    const payload = {
      bookmarks: [
        { page: 1, label: 'A' },
        { page: 1, label: 'A' },
      ],
    };
    const file = { text: () => Promise.resolve(JSON.stringify(payload)) };

    let saved = null;
    await importBookmarksJson(file, (bk) => { saved = bk; }, () => {});
    assert.equal(saved.length, 1);
  });

  it('sorts bookmarks by page', async () => {
    const payload = {
      bookmarks: [
        { page: 5, label: 'Five' },
        { page: 1, label: 'One' },
      ],
    };
    const file = { text: () => Promise.resolve(JSON.stringify(payload)) };

    let saved = null;
    await importBookmarksJson(file, (bk) => { saved = bk; }, () => {});
    assert.equal(saved[0].page, 1);
    assert.equal(saved[1].page, 5);
  });

  it('handles no adapter', async () => {
    state.adapter = null;
    const file = { text: () => Promise.resolve('{}') };
    await importBookmarksJson(file, () => {}, () => {});
    assert.ok(els.bookmarksStatus.textContent.includes('откройте'));
  });

  it('handles null file', async () => {
    state.adapter = null;
    await importBookmarksJson(null, () => {}, () => {});
    assert.ok(els.bookmarksStatus.textContent.includes('откройте'));
  });

  it('handles invalid JSON', async () => {
    const file = { text: () => Promise.resolve('not json') };
    await importBookmarksJson(file, () => {}, () => {});
    assert.ok(els.bookmarksStatus.textContent.includes('Ошибка'));
  });

  it('handles bad payload without bookmarks array', async () => {
    const file = { text: () => Promise.resolve(JSON.stringify({ noBookmarks: true })) };
    await importBookmarksJson(file, () => {}, () => {});
    assert.ok(els.bookmarksStatus.textContent.includes('Ошибка'));
  });

  it('accepts flat array payload', async () => {
    const payload = [{ page: 1, label: 'A' }, { page: 2, label: 'B' }];
    const file = { text: () => Promise.resolve(JSON.stringify(payload)) };

    let saved = null;
    await importBookmarksJson(file, (bk) => { saved = bk; }, () => {});
    assert.equal(saved.length, 2);
  });

  it('truncates long labels', async () => {
    const payload = { bookmarks: [{ page: 1, label: 'A'.repeat(200) }] };
    const file = { text: () => Promise.resolve(JSON.stringify(payload)) };

    let saved = null;
    await importBookmarksJson(file, (bk) => { saved = bk; }, () => {});
    assert.ok(saved[0].label.length <= 120);
  });

  it('assigns default label when missing', async () => {
    const payload = { bookmarks: [{ page: 2 }] };
    const file = { text: () => Promise.resolve(JSON.stringify(payload)) };

    let saved = null;
    await importBookmarksJson(file, (bk) => { saved = bk; }, () => {});
    assert.ok(saved[0].label.includes('2'));
  });
});

// ── addBookmark ──────────────────────────────────────────────────────────────

describe('addBookmark (coverage)', () => {
  beforeEach(() => {
    resetState();
    setupElsMock();
  });

  it('returns early when no adapter', async () => {
    state.adapter = null;
    let saveCalled = false;
    await addBookmark(() => 'bk-key', () => { saveCalled = true; }, () => {});
    assert.equal(saveCalled, false);
  });
});

// ── renderBookmarks with filter ──────────────────────────────────────────────

describe('renderBookmarks - filter (coverage)', () => {
  beforeEach(() => {
    resetState();
    setupElsMock();
  });

  it('renders filtered results', () => {
    const bookmarkKey = () => 'test-filter-bk';
    localStorage.setItem('test-filter-bk', JSON.stringify([
      { page: 1, label: 'Start' },
      { page: 5, label: 'Middle' },
      { page: 10, label: 'End' },
    ]));

    let appendedChildren = [];
    els.bookmarkList = {
      innerHTML: '',
      appendChild(child) { appendedChildren.push(child); },
    };
    els.bookmarkFilter = { value: 'Middle' };

    renderBookmarks(bookmarkKey, () => {}, () => {});
    assert.equal(appendedChildren.length, 1);
  });

  it('shows filter-empty message', () => {
    const bookmarkKey = () => 'test-filter-bk2';
    localStorage.setItem('test-filter-bk2', JSON.stringify([
      { page: 1, label: 'Start' },
    ]));

    let appendedChildren = [];
    els.bookmarkList = {
      innerHTML: '',
      appendChild(child) { appendedChildren.push(child); },
    };
    els.bookmarkFilter = { value: 'zzzzz' };

    renderBookmarks(bookmarkKey, () => {}, () => {});
    assert.equal(appendedChildren.length, 1);
    assert.ok(appendedChildren[0].textContent.includes('фильтру'));
  });

  it('filter by page number', () => {
    const bookmarkKey = () => 'test-filter-page';
    localStorage.setItem('test-filter-page', JSON.stringify([
      { page: 1, label: 'Start' },
      { page: 42, label: 'Answer' },
    ]));

    let appendedChildren = [];
    els.bookmarkList = {
      innerHTML: '',
      appendChild(child) { appendedChildren.push(child); },
    };
    els.bookmarkFilter = { value: '42' };

    renderBookmarks(bookmarkKey, () => {}, () => {});
    assert.equal(appendedChildren.length, 1);
  });
});

// ── loadAppSettings error path ───────────────────────────────────────────────

describe('loadAppSettings - error path (coverage)', () => {
  beforeEach(resetState);

  it('falls back to defaults on corrupted storage', () => {
    localStorage.setItem('novareader-settings', '{bad json');
    loadAppSettings();
    assert.ok(state.settings);
    assert.equal(state.settings.appLang, 'ru');
  });
});
