import './setup-dom.js';
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { initSettings } from '../../app/modules/init-settings.js';

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
      stringifyHotkeyEvent: mock.fn(() => ''),
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
      'loadNotes', 'saveNotes', 'saveHotkeys', 'loadHotkeys', 'resetHotkeys',
      'loadBookmarks', 'saveBookmarks', 'renderBookmarks', 'addBookmark',
    ];
    for (const key of expectedKeys) {
      assert.equal(typeof result[key], 'function', `missing ${key}`);
    }
  });

  it('wrapper functions delegate to SettingsController', () => {
    const deps = makeDeps();
    const result = initSettings(deps);
    result.defaultSettings();
    assert.equal(deps.SettingsController.defaultSettings.mock.callCount(), 1);
    result.loadAppSettings();
    assert.equal(deps.SettingsController.loadAppSettings.mock.callCount(), 1);
    result.getOcrLang();
    assert.equal(deps.SettingsController.getOcrLang.mock.callCount(), 1);
  });

  it('applyTheme sets localStorage', () => {
    // Ensure document.body has classList for applyTheme
    if (!document.body.classList) {
      const _cls = new Set();
      document.body.classList = {
        add: (...c) => c.forEach(x => _cls.add(x)),
        remove: (...c) => c.forEach(x => _cls.delete(x)),
        contains: (c) => _cls.has(c),
        toggle: (c) => { if (_cls.has(c)) _cls.delete(c); else _cls.add(c); },
      };
    }
    if (!document.documentElement.dataset) {
      document.documentElement.dataset = {};
    }
    const result = initSettings(makeDeps());
    result.applyTheme('sepia');
    assert.equal(localStorage.getItem('novareader-theme'), 'sepia');
  });

  it('loadTheme reads from localStorage', () => {
    if (!document.body.classList) {
      const _cls = new Set();
      document.body.classList = {
        add: (...c) => c.forEach(x => _cls.add(x)),
        remove: (...c) => c.forEach(x => _cls.delete(x)),
        contains: (c) => _cls.has(c),
        toggle: (c) => { if (_cls.has(c)) _cls.delete(c); else _cls.add(c); },
      };
    }
    if (!document.documentElement.dataset) {
      document.documentElement.dataset = {};
    }
    localStorage.setItem('novareader-theme', 'light');
    const result = initSettings(makeDeps());
    result.loadTheme();
    assert.equal(localStorage.getItem('novareader-theme'), 'light');
    localStorage.removeItem('novareader-theme');
  });
});
