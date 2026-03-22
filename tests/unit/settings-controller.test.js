// ─── Unit Tests: SettingsController ──────────────────────────────────────────
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  appSettingsKey,
  defaultSettings,
  loadAppSettings,
  saveAppSettings,
  getOcrLang,
  getOcrScale,
  toggleTheme,
  normalizeHotkey,
  normalizeHotkeyForDisplay,
  validateHotkeys,
  stringifyHotkeyEvent,
  normalizeImportedNotes,
  mergeNotesByMode,
  loadBookmarks,
} from '../../app/modules/settings-controller.js';
import { state } from '../../app/modules/state.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function resetState() {
  state.settings = null;
  state.docName = 'test.pdf';
  localStorage.clear();
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('appSettingsKey', () => {
  it('returns the expected localStorage key', () => {
    assert.equal(appSettingsKey(), 'novareader-settings');
  });
});

describe('defaultSettings', () => {
  it('returns an object with all expected keys', () => {
    const defaults = defaultSettings();
    assert.equal(defaults.appLang, 'ru');
    assert.equal(defaults.ocrLang, 'auto');
    assert.equal(defaults.ocrMinW, 24);
    assert.equal(defaults.ocrMinH, 24);
    assert.equal(defaults.backgroundOcr, false);
    assert.equal(defaults.ocrCyrillicOnly, true);
    assert.equal(defaults.ocrQualityMode, 'balanced');
    assert.equal(defaults.uiSidebarWidth, 220);
    assert.equal(defaults.uiToolbarScale, 1);
    assert.ok(defaults.sidebarSections);
    assert.ok(defaults.toolbarSections);
  });

  it('returns a new object each time', () => {
    const a = defaultSettings();
    const b = defaultSettings();
    assert.notEqual(a, b);
    assert.deepEqual(a, b);
  });
});

describe('loadAppSettings / saveAppSettings', () => {
  beforeEach(resetState);

  it('loads defaults when nothing in localStorage', () => {
    loadAppSettings();
    assert.ok(state.settings);
    assert.equal(state.settings.appLang, 'ru');
    assert.equal(state.settings.ocrLang, 'auto');
  });

  it('saves and reloads settings', () => {
    loadAppSettings();
    state.settings.ocrLang = 'eng';
    state.settings.uiSidebarWidth = 300;
    saveAppSettings();

    // Reset and reload
    state.settings = null;
    loadAppSettings();
    assert.equal(state.settings.ocrLang, 'eng');
    assert.equal(state.settings.uiSidebarWidth, 300);
  });

  it('merges saved settings with defaults', () => {
    // Save partial settings
    localStorage.setItem(appSettingsKey(), JSON.stringify({ ocrLang: 'fra' }));
    loadAppSettings();
    assert.equal(state.settings.ocrLang, 'fra');
    // Other defaults should still be present
    assert.equal(state.settings.appLang, 'ru');
    assert.equal(state.settings.ocrMinW, 24);
  });

  it('handles corrupt localStorage gracefully', () => {
    localStorage.setItem(appSettingsKey(), '{invalid json');
    loadAppSettings();
    // Should fall back to defaults
    assert.ok(state.settings);
    assert.equal(state.settings.appLang, 'ru');
  });

  it('deep merges nested objects', () => {
    const defaults = defaultSettings();
    // Save with only one sidebar section
    localStorage.setItem(appSettingsKey(), JSON.stringify({
      sidebarSections: { recent: false },
    }));
    loadAppSettings();
    // The saved key should override
    assert.equal(state.settings.sidebarSections.recent, false);
    // Other keys from defaults should be present
    assert.equal(state.settings.sidebarSections.bookmarks, defaults.sidebarSections.bookmarks);
  });
});

describe('getOcrLang', () => {
  beforeEach(resetState);

  it('returns auto when no settings', () => {
    state.settings = null;
    assert.equal(getOcrLang(), 'auto');
  });

  it('returns configured language', () => {
    state.settings = { ocrLang: 'deu' };
    assert.equal(getOcrLang(), 'deu');
  });
});

describe('getOcrScale', () => {
  beforeEach(resetState);

  it('returns a positive number', () => {
    state.settings = { ocrLang: 'eng', ocrQualityMode: 'balanced' };
    const scale = getOcrScale();
    assert.ok(scale > 0);
  });

  it('returns higher scale for Russian', () => {
    state.settings = { ocrLang: 'rus', ocrQualityMode: 'balanced' };
    const rusScale = getOcrScale();
    state.settings = { ocrLang: 'eng', ocrQualityMode: 'balanced' };
    const engScale = getOcrScale();
    assert.ok(rusScale >= engScale);
  });

  it('accurate mode returns higher scale', () => {
    state.settings = { ocrLang: 'eng', ocrQualityMode: 'accurate' };
    const accurateScale = getOcrScale();
    state.settings = { ocrLang: 'eng', ocrQualityMode: 'balanced' };
    const balancedScale = getOcrScale();
    assert.ok(accurateScale >= balancedScale);
  });
});

describe('toggleTheme', () => {
  beforeEach(() => localStorage.clear());

  it('cycles through themes', () => {
    const applied = [];
    const applyTheme = (name) => {
      applied.push(name);
      localStorage.setItem('novareader-theme', name);
    };

    // Start at dark (default)
    localStorage.setItem('novareader-theme', 'dark');
    toggleTheme(applyTheme);
    assert.equal(applied[0], 'light');

    toggleTheme(applyTheme);
    assert.equal(applied[1], 'sepia');

    toggleTheme(applyTheme);
    assert.equal(applied[2], 'high-contrast');

    toggleTheme(applyTheme);
    assert.equal(applied[3], 'auto');

    toggleTheme(applyTheme);
    assert.equal(applied[4], 'dark'); // wraps around
  });

  it('defaults to dark when no theme set', () => {
    let appliedTheme = null;
    toggleTheme((name) => {
      appliedTheme = name;
      localStorage.setItem('novareader-theme', name);
    });
    // dark -> next is light
    assert.equal(appliedTheme, 'light');
  });
});

describe('normalizeHotkey', () => {
  it('trims and lowercases input', () => {
    assert.equal(normalizeHotkey('  A  ', 'fallback'), 'a');
  });

  it('returns fallback for empty input', () => {
    assert.equal(normalizeHotkey('', 'fallback'), 'fallback');
    assert.equal(normalizeHotkey('  ', 'x'), 'x');
    assert.equal(normalizeHotkey(null, 'y'), 'y');
  });
});

describe('normalizeHotkeyForDisplay', () => {
  it('maps arrowright to >', () => {
    assert.equal(normalizeHotkeyForDisplay('arrowright'), '>');
  });

  it('maps arrowleft to <', () => {
    assert.equal(normalizeHotkeyForDisplay('arrowleft'), '<');
  });

  it('returns value unchanged for regular keys', () => {
    assert.equal(normalizeHotkeyForDisplay('ctrl+f'), 'ctrl+f');
  });
});

describe('validateHotkeys', () => {
  it('accepts valid unique hotkeys', () => {
    const result = validateHotkeys({
      next: 'pagedown',
      prev: 'pageup',
      zoomIn: 'ctrl+=',
      zoomOut: 'ctrl+-',
      annotate: 'ctrl+shift+a',
      searchFocus: 'ctrl+f',
      ocrPage: 'ctrl+shift+o',
      fitWidth: 'ctrl+9',
      fitPage: 'ctrl+0',
    });
    assert.equal(result.ok, true);
  });

  it('rejects empty hotkeys', () => {
    const result = validateHotkeys({
      next: '',
      prev: 'pageup',
    });
    assert.equal(result.ok, false);
    assert.ok(result.fields.includes('next'));
  });

  it('rejects duplicate hotkeys', () => {
    const result = validateHotkeys({
      next: 'pagedown',
      prev: 'pagedown', // duplicate
      zoomIn: 'ctrl+=',
    });
    assert.equal(result.ok, false);
    assert.ok(result.fields.includes('next'));
    assert.ok(result.fields.includes('prev'));
  });
});

describe('stringifyHotkeyEvent', () => {
  it('returns key for simple keypress', () => {
    const result = stringifyHotkeyEvent({ key: 'a', ctrlKey: false, altKey: false, shiftKey: false, metaKey: false });
    assert.equal(result, 'a');
  });

  it('includes ctrl modifier', () => {
    const result = stringifyHotkeyEvent({ key: 'f', ctrlKey: true, altKey: false, shiftKey: false, metaKey: false });
    assert.equal(result, 'ctrl+f');
  });

  it('includes multiple modifiers', () => {
    const result = stringifyHotkeyEvent({ key: 'a', ctrlKey: true, altKey: false, shiftKey: true, metaKey: false });
    assert.equal(result, 'ctrl+shift+a');
  });

  it('maps space key', () => {
    const result = stringifyHotkeyEvent({ key: ' ', ctrlKey: false, altKey: false, shiftKey: false, metaKey: false });
    assert.equal(result, 'space');
  });

  it('maps arrow keys', () => {
    const result = stringifyHotkeyEvent({ key: 'ArrowRight', ctrlKey: false, altKey: false, shiftKey: false, metaKey: false });
    assert.equal(result, 'arrowright');
  });

  it('returns empty string for modifier-only keys', () => {
    const result = stringifyHotkeyEvent({ key: 'Control', ctrlKey: true, altKey: false, shiftKey: false, metaKey: false });
    assert.equal(result, '');
  });
});

describe('normalizeImportedNotes', () => {
  beforeEach(() => { state.docName = 'test.pdf'; });

  it('extracts structured notes', () => {
    const result = normalizeImportedNotes({
      notes: { title: 'My Title', tags: 'tag1, tag2', body: 'Content here' },
    });
    assert.equal(result.title, 'My Title');
    assert.equal(result.tags, 'tag1, tag2');
    assert.equal(result.body, 'Content here');
  });

  it('handles string notes (legacy format)', () => {
    const result = normalizeImportedNotes({ notes: 'Plain text notes' });
    assert.equal(result.body, 'Plain text notes');
    assert.equal(result.title, 'test.pdf');
  });

  it('returns defaults for missing notes', () => {
    const result = normalizeImportedNotes({});
    assert.equal(result.body, '');
    assert.equal(result.title, 'test.pdf');
  });
});

describe('mergeNotesByMode', () => {
  beforeEach(() => { state.docName = 'test.pdf'; });

  it('replace mode uses incoming', () => {
    const current = { title: 'Old', tags: 'a', body: 'old body' };
    const incoming = { title: 'New', tags: 'b', body: 'new body' };
    const result = mergeNotesByMode(current, incoming, 'replace');
    assert.equal(result.title, 'New');
    assert.equal(result.tags, 'b');
    assert.equal(result.body, 'new body');
  });

  it('append mode joins bodies', () => {
    const current = { title: 'Doc', tags: 'a', body: 'first' };
    const incoming = { title: 'Doc', tags: 'b', body: 'second' };
    const result = mergeNotesByMode(current, incoming, 'append');
    assert.ok(result.body.includes('first'));
    assert.ok(result.body.includes('second'));
  });

  it('append mode deduplicates tags', () => {
    const current = { title: '', tags: 'a, b', body: '' };
    const incoming = { title: '', tags: 'b, c', body: '' };
    const result = mergeNotesByMode(current, incoming, 'append');
    const tags = result.tags.split(', ');
    assert.ok(tags.includes('a'));
    assert.ok(tags.includes('b'));
    assert.ok(tags.includes('c'));
    // b should not be duplicated
    assert.equal(tags.filter(t => t === 'b').length, 1);
  });
});

describe('loadBookmarks', () => {
  beforeEach(() => localStorage.clear());

  it('returns empty array when nothing stored', () => {
    const bookmarks = loadBookmarks(() => 'test-bookmarks-key');
    assert.deepEqual(bookmarks, []);
  });

  it('loads stored bookmarks', () => {
    const key = 'test-bookmarks-key';
    localStorage.setItem(key, JSON.stringify([{ page: 1, label: 'Start' }]));
    const bookmarks = loadBookmarks(() => key);
    assert.equal(bookmarks.length, 1);
    assert.equal(bookmarks[0].page, 1);
    assert.equal(bookmarks[0].label, 'Start');
  });
});
