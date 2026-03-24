import './setup-dom.js';
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { initSettings } from '../../app/modules/init-settings.js';

// Ensure document.documentElement.dataset exists for applyTheme
if (!document.documentElement.dataset) {
  document.documentElement.dataset = {};
}

function makeDeps(overrides = {}) {
  return {
    SettingsController: {
      defaultSettings: mock.fn(() => ({})),
      loadAppSettings: mock.fn(),
      saveAppSettings: mock.fn(),
      applyUiSizeSettings: mock.fn(),
      getOcrLang: mock.fn(() => 'eng'),
      toggleTheme: mock.fn((applyCb) => applyCb('dark')),
      getNotesModel: mock.fn(() => ({})),
      normalizeImportedNotes: mock.fn((p) => p),
      loadNotes: mock.fn(),
      saveNotes: mock.fn(),
      queueNotesAutosave: mock.fn(),
      exportNotes: mock.fn(),
      exportNotesMarkdown: mock.fn(),
      exportNotesJson: mock.fn(),
      importNotesJson: mock.fn(async () => {}),
      insertTimestamp: mock.fn(),
      normalizeHotkey: mock.fn((v, f) => v || f),
      setHotkeysStatus: mock.fn(),
      setHotkeysInputErrors: mock.fn(),
      validateHotkeys: mock.fn(() => ({ valid: true })),
      renderHotkeyInputs: mock.fn(),
      saveHotkeys: mock.fn(),
      loadHotkeys: mock.fn(),
      resetHotkeys: mock.fn(),
      stringifyHotkeyEvent: mock.fn(() => 'Ctrl+A'),
      bindHotkeyCapture: mock.fn(),
      autoFixHotkeys: mock.fn(),
      setBookmarksStatus: mock.fn(),
      exportBookmarksJson: mock.fn(),
      importBookmarksJson: mock.fn(async () => {}),
      loadBookmarks: mock.fn(() => []),
      saveBookmarks: mock.fn(),
      renderBookmarks: mock.fn(),
      addBookmark: mock.fn(async () => {}),
      clearBookmarks: mock.fn(),
    },
    noteKey: 'test-notes',
    bookmarkKey: 'test-bookmarks',
    uiLayoutKey: 'test-ui-layout',
    state: { adapter: null, currentPage: 1, pageCount: 1 },
    els: { searchStatus: document.createElement('div'), pageInput: document.createElement('input') },
    saveDjvuData: mock.fn(),
    renderOutline: mock.fn(async () => {}),
    renderPagePreviews: mock.fn(async () => {}),
    renderCurrentPage: mock.fn(async () => {}),
    renderDocStats: mock.fn(),
    renderEtaStatus: mock.fn(),
    ...overrides,
  };
}

describe('initSettings', () => {
  it('exports a function', () => {
    assert.equal(typeof initSettings, 'function');
  });

  it('returns object with all expected wrapper functions', () => {
    const result = initSettings(makeDeps());
    const expectedKeys = [
      'defaultSettings', 'loadAppSettings', 'saveAppSettings', 'applyUiSizeSettings',
      'getOcrLang', 'importDjvuDataJson', 'applyTheme', 'loadTheme', 'toggleTheme',
      'getNotesModel', 'normalizeImportedNotes',
      'loadNotes', 'saveNotes', '_queueNotesAutosave',
      '_exportNotes', '_exportNotesMarkdown', '_exportNotesJson',
      '_importNotesJson', '_insertTimestamp',
      'normalizeHotkey', 'setHotkeysStatus', 'setHotkeysInputErrors',
      'validateHotkeys', 'renderHotkeyInputs',
      'saveHotkeys', 'loadHotkeys', 'resetHotkeys',
      'stringifyHotkeyEvent', 'bindHotkeyCapture', 'autoFixHotkeys',
      'setBookmarksStatus', '_exportBookmarksJson', '_importBookmarksJson',
      'loadBookmarks', 'saveBookmarks', 'renderBookmarks', 'addBookmark', '_clearBookmarks',
      'THEME_CLASSES',
    ];
    for (const key of expectedKeys) {
      assert.ok(key in result, `missing ${key}`);
    }
  });

  // ─── Basic settings ──────────────────────────────────────────────────────

  it('defaultSettings delegates to SettingsController', () => {
    const deps = makeDeps();
    const result = initSettings(deps);
    const ret = result.defaultSettings();
    assert.equal(deps.SettingsController.defaultSettings.mock.callCount(), 1);
    assert.deepEqual(ret, {});
  });

  it('loadAppSettings delegates to SettingsController', () => {
    const deps = makeDeps();
    const result = initSettings(deps);
    result.loadAppSettings();
    assert.equal(deps.SettingsController.loadAppSettings.mock.callCount(), 1);
  });

  it('saveAppSettings delegates to SettingsController', () => {
    const deps = makeDeps();
    const result = initSettings(deps);
    result.saveAppSettings();
    assert.equal(deps.SettingsController.saveAppSettings.mock.callCount(), 1);
  });

  it('applyUiSizeSettings delegates with uiLayoutKey', () => {
    const deps = makeDeps();
    const result = initSettings(deps);
    result.applyUiSizeSettings();
    assert.equal(deps.SettingsController.applyUiSizeSettings.mock.callCount(), 1);
    assert.equal(deps.SettingsController.applyUiSizeSettings.mock.calls[0].arguments[0], 'test-ui-layout');
  });

  it('getOcrLang delegates and returns value', () => {
    const deps = makeDeps();
    const result = initSettings(deps);
    const lang = result.getOcrLang();
    assert.equal(lang, 'eng');
    assert.equal(deps.SettingsController.getOcrLang.mock.callCount(), 1);
  });

  // ─── Theme ─────────────────────────────────────────────────────────────

  it('THEME_CLASSES is the expected array', () => {
    const result = initSettings(makeDeps());
    assert.deepEqual(result.THEME_CLASSES, ['light', 'sepia', 'high-contrast', 'theme-auto']);
  });

  it('applyTheme light adds light class and sets data-theme to light', () => {
    const result = initSettings(makeDeps());
    result.applyTheme('light');
    assert.ok(document.body.classList.contains('light'));
    assert.equal(document.documentElement.dataset.theme, 'light');
    assert.equal(localStorage.getItem('novareader-theme'), 'light');
    // cleanup
    document.body.classList.remove('light');
  });

  it('applyTheme sepia adds sepia class and sets data-theme to light', () => {
    const result = initSettings(makeDeps());
    result.applyTheme('sepia');
    assert.ok(document.body.classList.contains('sepia'));
    assert.equal(document.documentElement.dataset.theme, 'light');
    assert.equal(localStorage.getItem('novareader-theme'), 'sepia');
    document.body.classList.remove('sepia');
  });

  it('applyTheme high-contrast adds high-contrast class', () => {
    const result = initSettings(makeDeps());
    result.applyTheme('high-contrast');
    assert.ok(document.body.classList.contains('high-contrast'));
    assert.equal(document.documentElement.dataset.theme, 'dark');
    document.body.classList.remove('high-contrast');
  });

  it('applyTheme auto adds theme-auto class', () => {
    const result = initSettings(makeDeps());
    result.applyTheme('auto');
    assert.ok(document.body.classList.contains('theme-auto'));
    assert.equal(document.documentElement.dataset.theme, 'dark');
    document.body.classList.remove('theme-auto');
  });

  it('applyTheme dark adds no class (default)', () => {
    const result = initSettings(makeDeps());
    result.applyTheme('dark');
    assert.ok(!document.body.classList.contains('light'));
    assert.ok(!document.body.classList.contains('sepia'));
    assert.ok(!document.body.classList.contains('high-contrast'));
    assert.ok(!document.body.classList.contains('theme-auto'));
    assert.equal(document.documentElement.dataset.theme, 'dark');
  });

  it('loadTheme reads from localStorage and applies', () => {
    localStorage.setItem('novareader-theme', 'sepia');
    const result = initSettings(makeDeps());
    result.loadTheme();
    assert.ok(document.body.classList.contains('sepia'));
    assert.equal(localStorage.getItem('novareader-theme'), 'sepia');
    // cleanup
    document.body.classList.remove('sepia');
    localStorage.removeItem('novareader-theme');
  });

  it('loadTheme defaults to dark when no localStorage value', () => {
    localStorage.removeItem('novareader-theme');
    const result = initSettings(makeDeps());
    result.loadTheme();
    assert.equal(localStorage.getItem('novareader-theme'), 'dark');
  });

  it('toggleTheme delegates to SettingsController with applyTheme callback', () => {
    const deps = makeDeps();
    const result = initSettings(deps);
    result.toggleTheme();
    assert.equal(deps.SettingsController.toggleTheme.mock.callCount(), 1);
    // The mock calls applyTheme('dark'), so check localStorage
    assert.equal(localStorage.getItem('novareader-theme'), 'dark');
  });

  // ─── Notes ─────────────────────────────────────────────────────────────

  it('getNotesModel delegates to SettingsController', () => {
    const deps = makeDeps();
    const result = initSettings(deps);
    const model = result.getNotesModel();
    assert.deepEqual(model, {});
    assert.equal(deps.SettingsController.getNotesModel.mock.callCount(), 1);
  });

  it('normalizeImportedNotes delegates to SettingsController', () => {
    const deps = makeDeps();
    const result = initSettings(deps);
    const payload = { notes: 'test' };
    const normalized = result.normalizeImportedNotes(payload);
    assert.deepEqual(normalized, payload);
    assert.equal(deps.SettingsController.normalizeImportedNotes.mock.callCount(), 1);
  });

  it('loadNotes delegates with noteKey', () => {
    const deps = makeDeps();
    const result = initSettings(deps);
    result.loadNotes();
    assert.equal(deps.SettingsController.loadNotes.mock.callCount(), 1);
    assert.equal(deps.SettingsController.loadNotes.mock.calls[0].arguments[0], 'test-notes');
  });

  it('saveNotes delegates with noteKey and source', () => {
    const deps = makeDeps();
    const result = initSettings(deps);
    result.saveNotes('auto');
    assert.equal(deps.SettingsController.saveNotes.mock.callCount(), 1);
    assert.equal(deps.SettingsController.saveNotes.mock.calls[0].arguments[0], 'test-notes');
    assert.equal(deps.SettingsController.saveNotes.mock.calls[0].arguments[1], 'auto');
  });

  it('saveNotes defaults source to manual', () => {
    const deps = makeDeps();
    const result = initSettings(deps);
    result.saveNotes();
    assert.equal(deps.SettingsController.saveNotes.mock.calls[0].arguments[1], 'manual');
  });

  it('_queueNotesAutosave delegates with noteKey', () => {
    const deps = makeDeps();
    const result = initSettings(deps);
    result._queueNotesAutosave();
    assert.equal(deps.SettingsController.queueNotesAutosave.mock.callCount(), 1);
    assert.equal(deps.SettingsController.queueNotesAutosave.mock.calls[0].arguments[0], 'test-notes');
  });

  it('_exportNotes delegates to SettingsController', () => {
    const deps = makeDeps();
    const result = initSettings(deps);
    result._exportNotes();
    assert.equal(deps.SettingsController.exportNotes.mock.callCount(), 1);
  });

  it('_exportNotesMarkdown delegates to SettingsController', () => {
    const deps = makeDeps();
    const result = initSettings(deps);
    result._exportNotesMarkdown();
    assert.equal(deps.SettingsController.exportNotesMarkdown.mock.callCount(), 1);
  });

  it('_exportNotesJson delegates to SettingsController', () => {
    const deps = makeDeps();
    const result = initSettings(deps);
    result._exportNotesJson();
    assert.equal(deps.SettingsController.exportNotesJson.mock.callCount(), 1);
  });

  it('_importNotesJson delegates with file and noteKey', async () => {
    const deps = makeDeps();
    const result = initSettings(deps);
    const fakeFile = { name: 'notes.json' };
    await result._importNotesJson(fakeFile);
    assert.equal(deps.SettingsController.importNotesJson.mock.callCount(), 1);
    assert.equal(deps.SettingsController.importNotesJson.mock.calls[0].arguments[0], fakeFile);
    assert.equal(deps.SettingsController.importNotesJson.mock.calls[0].arguments[1], 'test-notes');
  });

  it('_insertTimestamp delegates with noteKey', () => {
    const deps = makeDeps();
    const result = initSettings(deps);
    result._insertTimestamp();
    assert.equal(deps.SettingsController.insertTimestamp.mock.callCount(), 1);
    assert.equal(deps.SettingsController.insertTimestamp.mock.calls[0].arguments[0], 'test-notes');
  });

  // ─── Hotkeys ───────────────────────────────────────────────────────────

  it('normalizeHotkey delegates and returns value', () => {
    const deps = makeDeps();
    const result = initSettings(deps);
    const val = result.normalizeHotkey('Ctrl+S', 'Ctrl+D');
    assert.equal(val, 'Ctrl+S');
    assert.equal(deps.SettingsController.normalizeHotkey.mock.callCount(), 1);
  });

  it('normalizeHotkey returns fallback when value is empty', () => {
    const deps = makeDeps();
    const result = initSettings(deps);
    const val = result.normalizeHotkey('', 'Ctrl+D');
    assert.equal(val, 'Ctrl+D');
  });

  it('setHotkeysStatus delegates to SettingsController', () => {
    const deps = makeDeps();
    const result = initSettings(deps);
    result.setHotkeysStatus('Saved', 'success');
    assert.equal(deps.SettingsController.setHotkeysStatus.mock.callCount(), 1);
    assert.equal(deps.SettingsController.setHotkeysStatus.mock.calls[0].arguments[0], 'Saved');
    assert.equal(deps.SettingsController.setHotkeysStatus.mock.calls[0].arguments[1], 'success');
  });

  it('setHotkeysStatus defaults type to empty string', () => {
    const deps = makeDeps();
    const result = initSettings(deps);
    result.setHotkeysStatus('Info');
    assert.equal(deps.SettingsController.setHotkeysStatus.mock.calls[0].arguments[1], '');
  });

  it('setHotkeysInputErrors delegates to SettingsController', () => {
    const deps = makeDeps();
    const result = initSettings(deps);
    result.setHotkeysInputErrors(['field1'], { field1: 'error' });
    assert.equal(deps.SettingsController.setHotkeysInputErrors.mock.callCount(), 1);
    assert.deepEqual(deps.SettingsController.setHotkeysInputErrors.mock.calls[0].arguments[0], ['field1']);
  });

  it('setHotkeysInputErrors defaults to empty args', () => {
    const deps = makeDeps();
    const result = initSettings(deps);
    result.setHotkeysInputErrors();
    assert.deepEqual(deps.SettingsController.setHotkeysInputErrors.mock.calls[0].arguments[0], []);
    assert.deepEqual(deps.SettingsController.setHotkeysInputErrors.mock.calls[0].arguments[1], {});
  });

  it('validateHotkeys delegates and returns result', () => {
    const deps = makeDeps();
    const result = initSettings(deps);
    const validation = result.validateHotkeys({ next: true });
    assert.deepEqual(validation, { valid: true });
    assert.equal(deps.SettingsController.validateHotkeys.mock.callCount(), 1);
  });

  it('renderHotkeyInputs delegates to SettingsController', () => {
    const deps = makeDeps();
    const result = initSettings(deps);
    result.renderHotkeyInputs();
    assert.equal(deps.SettingsController.renderHotkeyInputs.mock.callCount(), 1);
  });

  it('saveHotkeys delegates to SettingsController', () => {
    const deps = makeDeps();
    const result = initSettings(deps);
    result.saveHotkeys();
    assert.equal(deps.SettingsController.saveHotkeys.mock.callCount(), 1);
  });

  it('loadHotkeys delegates to SettingsController', () => {
    const deps = makeDeps();
    const result = initSettings(deps);
    result.loadHotkeys();
    assert.equal(deps.SettingsController.loadHotkeys.mock.callCount(), 1);
  });

  it('resetHotkeys delegates to SettingsController', () => {
    const deps = makeDeps();
    const result = initSettings(deps);
    result.resetHotkeys();
    assert.equal(deps.SettingsController.resetHotkeys.mock.callCount(), 1);
  });

  it('stringifyHotkeyEvent delegates and returns string', () => {
    const deps = makeDeps();
    const result = initSettings(deps);
    const str = result.stringifyHotkeyEvent({ key: 'a', ctrlKey: true });
    assert.equal(str, 'Ctrl+A');
    assert.equal(deps.SettingsController.stringifyHotkeyEvent.mock.callCount(), 1);
  });

  it('bindHotkeyCapture delegates to SettingsController', () => {
    const deps = makeDeps();
    const result = initSettings(deps);
    result.bindHotkeyCapture();
    assert.equal(deps.SettingsController.bindHotkeyCapture.mock.callCount(), 1);
  });

  it('autoFixHotkeys delegates to SettingsController', () => {
    const deps = makeDeps();
    const result = initSettings(deps);
    result.autoFixHotkeys();
    assert.equal(deps.SettingsController.autoFixHotkeys.mock.callCount(), 1);
  });

  // ─── Bookmarks ─────────────────────────────────────────────────────────

  it('setBookmarksStatus delegates to SettingsController', () => {
    const deps = makeDeps();
    const result = initSettings(deps);
    result.setBookmarksStatus('Loaded', 'info');
    assert.equal(deps.SettingsController.setBookmarksStatus.mock.callCount(), 1);
    assert.equal(deps.SettingsController.setBookmarksStatus.mock.calls[0].arguments[0], 'Loaded');
    assert.equal(deps.SettingsController.setBookmarksStatus.mock.calls[0].arguments[1], 'info');
  });

  it('setBookmarksStatus defaults type to empty string', () => {
    const deps = makeDeps();
    const result = initSettings(deps);
    result.setBookmarksStatus('OK');
    assert.equal(deps.SettingsController.setBookmarksStatus.mock.calls[0].arguments[1], '');
  });

  it('_exportBookmarksJson delegates with bookmarkKey and loadBookmarks', () => {
    const deps = makeDeps();
    const result = initSettings(deps);
    result._exportBookmarksJson();
    assert.equal(deps.SettingsController.exportBookmarksJson.mock.callCount(), 1);
    assert.equal(deps.SettingsController.exportBookmarksJson.mock.calls[0].arguments[0], 'test-bookmarks');
    // second arg is the loadBookmarks function
    assert.equal(typeof deps.SettingsController.exportBookmarksJson.mock.calls[0].arguments[1], 'function');
  });

  it('_importBookmarksJson delegates with file, saveBookmarks, renderBookmarks', async () => {
    const deps = makeDeps();
    const result = initSettings(deps);
    const fakeFile = { name: 'bookmarks.json' };
    await result._importBookmarksJson(fakeFile);
    assert.equal(deps.SettingsController.importBookmarksJson.mock.callCount(), 1);
    assert.equal(deps.SettingsController.importBookmarksJson.mock.calls[0].arguments[0], fakeFile);
  });

  it('loadBookmarks delegates with bookmarkKey', () => {
    const deps = makeDeps();
    const result = initSettings(deps);
    const bookmarks = result.loadBookmarks();
    assert.deepEqual(bookmarks, []);
    assert.equal(deps.SettingsController.loadBookmarks.mock.callCount(), 1);
    assert.equal(deps.SettingsController.loadBookmarks.mock.calls[0].arguments[0], 'test-bookmarks');
  });

  it('saveBookmarks delegates with next, bookmarkKey, renderDocStats, renderEtaStatus', () => {
    const deps = makeDeps();
    const result = initSettings(deps);
    const nextBookmarks = [{ page: 1 }];
    result.saveBookmarks(nextBookmarks);
    assert.equal(deps.SettingsController.saveBookmarks.mock.callCount(), 1);
    assert.deepEqual(deps.SettingsController.saveBookmarks.mock.calls[0].arguments[0], nextBookmarks);
    assert.equal(deps.SettingsController.saveBookmarks.mock.calls[0].arguments[1], 'test-bookmarks');
    assert.equal(deps.SettingsController.saveBookmarks.mock.calls[0].arguments[2], deps.renderDocStats);
    assert.equal(deps.SettingsController.saveBookmarks.mock.calls[0].arguments[3], deps.renderEtaStatus);
  });

  it('renderBookmarks delegates with bookmarkKey, saveBookmarks, renderCurrentPage', () => {
    const deps = makeDeps();
    const result = initSettings(deps);
    result.renderBookmarks();
    assert.equal(deps.SettingsController.renderBookmarks.mock.callCount(), 1);
    assert.equal(deps.SettingsController.renderBookmarks.mock.calls[0].arguments[0], 'test-bookmarks');
    // saveBookmarks and renderCurrentPage are functions
    assert.equal(typeof deps.SettingsController.renderBookmarks.mock.calls[0].arguments[1], 'function');
    assert.equal(deps.SettingsController.renderBookmarks.mock.calls[0].arguments[2], deps.renderCurrentPage);
  });

  it('addBookmark delegates with bookmarkKey, saveBookmarks, renderBookmarks', async () => {
    const deps = makeDeps();
    const result = initSettings(deps);
    await result.addBookmark();
    assert.equal(deps.SettingsController.addBookmark.mock.callCount(), 1);
    assert.equal(deps.SettingsController.addBookmark.mock.calls[0].arguments[0], 'test-bookmarks');
  });

  it('_clearBookmarks delegates with saveBookmarks and renderBookmarks', () => {
    const deps = makeDeps();
    const result = initSettings(deps);
    result._clearBookmarks();
    assert.equal(deps.SettingsController.clearBookmarks.mock.callCount(), 1);
    // saveBookmarks and renderBookmarks are function arguments
    assert.equal(typeof deps.SettingsController.clearBookmarks.mock.calls[0].arguments[0], 'function');
    assert.equal(typeof deps.SettingsController.clearBookmarks.mock.calls[0].arguments[1], 'function');
  });

  // ─── DjVu data import ─────────────────────────────────────────────────

  it('importDjvuDataJson shows message when adapter is null', async () => {
    const deps = makeDeps();
    deps.state.adapter = null;
    const result = initSettings(deps);
    const fakeFile = { text: mock.fn(async () => '{}') };
    await result.importDjvuDataJson(fakeFile);
    assert.ok(deps.els.searchStatus.textContent.includes('DjVu'));
  });

  it('importDjvuDataJson shows message when adapter is not djvu', async () => {
    const deps = makeDeps();
    deps.state.adapter = { type: 'pdf' };
    const result = initSettings(deps);
    const fakeFile = { text: mock.fn(async () => '{}') };
    await result.importDjvuDataJson(fakeFile);
    assert.ok(deps.els.searchStatus.textContent.includes('DjVu'));
  });

  it('importDjvuDataJson imports data for djvu adapter', async () => {
    const deps = makeDeps();
    const mockData = { pages: [{ text: 'hello' }] };
    deps.state.adapter = {
      type: 'djvu',
      setData: mock.fn(),
      exportData: mock.fn(() => mockData),
      getPageCount: mock.fn(() => 5),
    };
    deps.state.currentPage = 1;
    const result = initSettings(deps);
    const fakeFile = { text: mock.fn(async () => JSON.stringify(mockData)) };
    await result.importDjvuDataJson(fakeFile);
    assert.equal(deps.state.adapter.setData.mock.callCount(), 1);
    assert.equal(deps.saveDjvuData.mock.callCount(), 1);
    assert.equal(deps.state.pageCount, 5);
    assert.equal(deps.els.pageInput.max, '5');
    assert.equal(deps.renderOutline.mock.callCount(), 1);
    assert.equal(deps.renderPagePreviews.mock.callCount(), 1);
    assert.equal(deps.renderCurrentPage.mock.callCount(), 1);
    assert.ok(deps.els.searchStatus.textContent.includes('импортирован'));
  });

  it('importDjvuDataJson adjusts currentPage when exceeding pageCount', async () => {
    const deps = makeDeps();
    deps.state.adapter = {
      type: 'djvu',
      setData: mock.fn(),
      exportData: mock.fn(() => ({})),
      getPageCount: mock.fn(() => 3),
    };
    deps.state.currentPage = 10;
    const result = initSettings(deps);
    const fakeFile = { text: mock.fn(async () => '{}') };
    await result.importDjvuDataJson(fakeFile);
    assert.equal(deps.state.currentPage, 3);
    assert.equal(deps.els.pageInput.value, '3');
  });

  it('importDjvuDataJson handles parse errors gracefully', async () => {
    const deps = makeDeps();
    deps.state.adapter = { type: 'djvu' };
    const result = initSettings(deps);
    const fakeFile = { text: mock.fn(async () => 'not json') };
    await result.importDjvuDataJson(fakeFile);
    assert.ok(deps.els.searchStatus.textContent.includes('Ошибка'));
  });

  it('importDjvuDataJson works when searchStatus is null', async () => {
    const deps = makeDeps();
    deps.els.searchStatus = null;
    deps.state.adapter = null;
    const result = initSettings(deps);
    const fakeFile = { text: mock.fn(async () => '{}') };
    // Should not throw when searchStatus is null
    await result.importDjvuDataJson(fakeFile);
  });
});
