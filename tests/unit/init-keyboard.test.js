import './setup-dom.js';
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { initKeyboard } from '../../app/modules/init-keyboard.js';

function makeDeps(overrides = {}) {
  return {
    state: { drawEnabled: false, textEditMode: false, ocrRegionMode: false },
    els: {
      nextPage: document.createElement('button'),
      prevPage: document.createElement('button'),
      zoomIn: document.createElement('button'),
      zoomOut: document.createElement('button'),
      fitWidth: document.createElement('button'),
      fitPage: document.createElement('button'),
      ocrCurrentPage: document.createElement('button'),
      searchInput: document.createElement('input'),
      pageText: document.createElement('textarea'),
      settingsModal: document.createElement('div'),
    },
    hotkeys: {
      next: 'ctrl+right', prev: 'ctrl+left',
      zoomIn: 'ctrl+=', zoomOut: 'ctrl+-',
      fitWidth: '', fitPage: '',
      ocrPage: 'ctrl+o', searchFocus: 'ctrl+f',
      annotate: 'ctrl+d',
    },
    stringifyHotkeyEvent: mock.fn((e) => {
      const parts = [];
      if (e.ctrlKey || e.metaKey) parts.push('ctrl');
      if (e.shiftKey) parts.push('shift');
      if (e.altKey) parts.push('alt');
      parts.push(e.key.toLowerCase());
      return parts.join('+');
    }),
    navigateHistoryBack: mock.fn(async () => {}),
    navigateHistoryForward: mock.fn(async () => {}),
    addBookmark: mock.fn(),
    setDrawMode: mock.fn(),
    setOcrRegionMode: mock.fn(),
    setOcrStatus: mock.fn(),
    undoStroke: mock.fn(),
    undoPageEdit: mock.fn(() => null),
    redoPageEdit: mock.fn(() => null),
    showShortcutsHelp: mock.fn(),
    closeSettingsModal: mock.fn(),
    ...overrides,
  };
}

describe('initKeyboard', () => {
  it('exports a function', () => {
    assert.equal(typeof initKeyboard, 'function');
  });

  it('does not throw with mock deps', () => {
    assert.doesNotThrow(() => initKeyboard(makeDeps()));
  });

  it('registers a keydown listener on document', () => {
    const original = document.addEventListener;
    let called = false;
    document.addEventListener = (type) => { if (type === 'keydown') called = true; };
    initKeyboard(makeDeps());
    document.addEventListener = original;
    assert.ok(called, 'should add keydown listener to document');
  });

  it('calls showShortcutsHelp on ? key press', () => {
    const deps = makeDeps();
    let handler;
    const original = document.addEventListener;
    document.addEventListener = (type, fn) => { if (type === 'keydown') handler = fn; };
    initKeyboard(deps);
    document.addEventListener = original;

    // Simulate ? key press (not in input)
    const fakeActiveEl = document.createElement('div');
    const origActiveElement = Object.getOwnPropertyDescriptor(document, 'activeElement');
    Object.defineProperty(document, 'activeElement', { value: fakeActiveEl, configurable: true });
    handler({ key: '?', ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, preventDefault: () => {} });
    if (origActiveElement) Object.defineProperty(document, 'activeElement', origActiveElement);
    else delete document.activeElement;

    assert.equal(deps.showShortcutsHelp.mock.callCount(), 1);
  });

  it('calls addBookmark on Ctrl+B', () => {
    const deps = makeDeps();
    let handler;
    const original = document.addEventListener;
    document.addEventListener = (type, fn) => { if (type === 'keydown') handler = fn; };
    initKeyboard(deps);
    document.addEventListener = original;

    handler({ key: 'b', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, preventDefault: () => {} });
    assert.equal(deps.addBookmark.mock.callCount(), 1);
  });
});

// ── Ctrl+Z undo in draw mode ────────────────────────────────────────────────

describe('initKeyboard — Ctrl+Z undo', () => {
  function setupHandler(deps) {
    let handler;
    const original = document.addEventListener;
    document.addEventListener = (type, fn) => { if (type === 'keydown') handler = fn; };
    initKeyboard(deps);
    document.addEventListener = original;
    return handler;
  }

  it('calls undoStroke when drawEnabled=true', () => {
    const deps = makeDeps();
    deps.state.drawEnabled = true;
    const handler = setupHandler(deps);
    handler({ key: 'z', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, preventDefault: mock.fn() });
    assert.equal(deps.undoStroke.mock.callCount(), 1);
  });

  it('does not call undoStroke when drawEnabled=false', () => {
    const deps = makeDeps();
    deps.state.drawEnabled = false;
    const handler = setupHandler(deps);
    handler({ key: 'z', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, preventDefault: mock.fn() });
    assert.equal(deps.undoStroke.mock.callCount(), 0);
  });

  it('calls undoPageEdit in textEditMode when not drawing', () => {
    const deps = makeDeps();
    deps.state.textEditMode = true;
    deps.state.drawEnabled = false;
    const undoAction = { text: 'restored text', page: 3 };
    deps.undoPageEdit = mock.fn(() => undoAction);
    const handler = setupHandler(deps);
    handler({ key: 'z', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, preventDefault: mock.fn() });
    assert.equal(deps.undoPageEdit.mock.callCount(), 1);
    assert.equal(deps.els.pageText.value, 'restored text');
    assert.equal(deps.setOcrStatus.mock.callCount(), 1);
  });

  it('does not update pageText when undoPageEdit returns null', () => {
    const deps = makeDeps();
    deps.state.textEditMode = true;
    deps.state.drawEnabled = false;
    deps.undoPageEdit = mock.fn(() => null);
    deps.els.pageText.value = 'original';
    const handler = setupHandler(deps);
    handler({ key: 'z', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, preventDefault: mock.fn() });
    assert.equal(deps.els.pageText.value, 'original');
  });

  it('does not call undoPageEdit when Shift is held (Ctrl+Shift+Z)', () => {
    const deps = makeDeps();
    deps.state.textEditMode = true;
    deps.state.drawEnabled = false;
    const handler = setupHandler(deps);
    handler({ key: 'z', ctrlKey: true, metaKey: false, altKey: false, shiftKey: true, preventDefault: mock.fn() });
    assert.equal(deps.undoPageEdit.mock.callCount(), 0);
  });

  it('draw mode takes priority over textEditMode for Ctrl+Z', () => {
    const deps = makeDeps();
    deps.state.drawEnabled = true;
    deps.state.textEditMode = true;
    const handler = setupHandler(deps);
    handler({ key: 'z', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, preventDefault: mock.fn() });
    assert.equal(deps.undoStroke.mock.callCount(), 1);
    assert.equal(deps.undoPageEdit.mock.callCount(), 0);
  });
});

// ── Ctrl+Y redo ─────────────────────────────────────────────────────────────

describe('initKeyboard — Ctrl+Y redo', () => {
  function setupHandler(deps) {
    let handler;
    const original = document.addEventListener;
    document.addEventListener = (type, fn) => { if (type === 'keydown') handler = fn; };
    initKeyboard(deps);
    document.addEventListener = original;
    return handler;
  }

  it('calls redoPageEdit when textEditMode=true', () => {
    const deps = makeDeps();
    deps.state.textEditMode = true;
    const redoAction = { text: 'redo text', page: 2 };
    deps.redoPageEdit = mock.fn(() => redoAction);
    const handler = setupHandler(deps);
    handler({ key: 'y', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, preventDefault: mock.fn() });
    assert.equal(deps.redoPageEdit.mock.callCount(), 1);
    assert.equal(deps.els.pageText.value, 'redo text');
  });

  it('does not call redoPageEdit when textEditMode=false', () => {
    const deps = makeDeps();
    deps.state.textEditMode = false;
    const handler = setupHandler(deps);
    handler({ key: 'y', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, preventDefault: mock.fn() });
    assert.equal(deps.redoPageEdit.mock.callCount(), 0);
  });

  it('does not update pageText when redoPageEdit returns null', () => {
    const deps = makeDeps();
    deps.state.textEditMode = true;
    deps.redoPageEdit = mock.fn(() => null);
    deps.els.pageText.value = 'original';
    const handler = setupHandler(deps);
    handler({ key: 'y', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, preventDefault: mock.fn() });
    assert.equal(deps.els.pageText.value, 'original');
  });

  it('sets OCR status with page number on redo', () => {
    const deps = makeDeps();
    deps.state.textEditMode = true;
    deps.redoPageEdit = mock.fn(() => ({ text: 'redone', page: 7 }));
    const handler = setupHandler(deps);
    handler({ key: 'y', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, preventDefault: mock.fn() });
    assert.equal(deps.setOcrStatus.mock.callCount(), 1);
    const statusMsg = deps.setOcrStatus.mock.calls[0].arguments[0];
    assert.ok(statusMsg.includes('7'), 'Status message should contain the page number');
  });
});

// ── Alt+Arrow navigation ────────────────────────────────────────────────────

describe('initKeyboard — Alt+Arrow navigation', () => {
  function setupHandler(deps) {
    let handler;
    const original = document.addEventListener;
    document.addEventListener = (type, fn) => { if (type === 'keydown') handler = fn; };
    initKeyboard(deps);
    document.addEventListener = original;
    return handler;
  }

  it('calls navigateHistoryBack on Alt+Left', () => {
    const deps = makeDeps();
    const handler = setupHandler(deps);
    const pd = mock.fn();
    handler({ key: 'arrowleft', ctrlKey: false, metaKey: false, altKey: true, shiftKey: false, preventDefault: pd });
    assert.equal(deps.navigateHistoryBack.mock.callCount(), 1);
    assert.equal(pd.mock.callCount(), 1);
  });

  it('calls navigateHistoryForward on Alt+Right', () => {
    const deps = makeDeps();
    const handler = setupHandler(deps);
    const pd = mock.fn();
    handler({ key: 'arrowright', ctrlKey: false, metaKey: false, altKey: true, shiftKey: false, preventDefault: pd });
    assert.equal(deps.navigateHistoryForward.mock.callCount(), 1);
    assert.equal(pd.mock.callCount(), 1);
  });

  it('does not navigate back without Alt key', () => {
    const deps = makeDeps();
    const handler = setupHandler(deps);
    handler({ key: 'arrowleft', ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, preventDefault: mock.fn() });
    assert.equal(deps.navigateHistoryBack.mock.callCount(), 0);
  });
});

// ── Escape handling ─────────────────────────────────────────────────────────

describe('initKeyboard — Escape handling', () => {
  function setupHandler(deps) {
    let handler;
    const original = document.addEventListener;
    document.addEventListener = (type, fn) => { if (type === 'keydown') handler = fn; };
    initKeyboard(deps);
    document.addEventListener = original;
    return handler;
  }

  it('disables draw mode on Escape when drawEnabled', () => {
    const deps = makeDeps();
    deps.state.drawEnabled = true;
    const handler = setupHandler(deps);
    handler({ key: 'Escape', ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, preventDefault: mock.fn() });
    assert.equal(deps.setDrawMode.mock.callCount(), 1);
    assert.equal(deps.setDrawMode.mock.calls[0].arguments[0], false);
  });

  it('disables OCR region mode on Escape', () => {
    const deps = makeDeps();
    deps.state.ocrRegionMode = true;
    const handler = setupHandler(deps);
    handler({ key: 'Escape', ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, preventDefault: mock.fn() });
    assert.equal(deps.setOcrRegionMode.mock.callCount(), 1);
    assert.equal(deps.setOcrRegionMode.mock.calls[0].arguments[0], false);
  });

  it('closes settings modal on Escape when open', () => {
    const deps = makeDeps();
    deps.els.settingsModal.classList.add('open');
    const handler = setupHandler(deps);
    handler({ key: 'Escape', ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, preventDefault: mock.fn() });
    assert.equal(deps.closeSettingsModal.mock.callCount(), 1);
  });

  it('does not close settings modal when not open', () => {
    const deps = makeDeps();
    // settingsModal does not have 'open' class
    const handler = setupHandler(deps);
    handler({ key: 'Escape', ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, preventDefault: mock.fn() });
    assert.equal(deps.closeSettingsModal.mock.callCount(), 0);
  });

  it('does not call setDrawMode when drawEnabled=false', () => {
    const deps = makeDeps();
    deps.state.drawEnabled = false;
    const handler = setupHandler(deps);
    handler({ key: 'Escape', ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, preventDefault: mock.fn() });
    assert.equal(deps.setDrawMode.mock.callCount(), 0);
  });

  it('handles all three Escape conditions simultaneously', () => {
    const deps = makeDeps();
    deps.state.drawEnabled = true;
    deps.state.ocrRegionMode = true;
    deps.els.settingsModal.classList.add('open');
    const handler = setupHandler(deps);
    handler({ key: 'Escape', ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, preventDefault: mock.fn() });
    assert.equal(deps.setDrawMode.mock.callCount(), 1);
    assert.equal(deps.setOcrRegionMode.mock.callCount(), 1);
    assert.equal(deps.closeSettingsModal.mock.callCount(), 1);
  });
});

// ── Draw mode toggle (annotate hotkey) ──────────────────────────────────────

describe('initKeyboard — annotate hotkey toggle', () => {
  function setupHandler(deps) {
    let handler;
    const original = document.addEventListener;
    document.addEventListener = (type, fn) => { if (type === 'keydown') handler = fn; };
    initKeyboard(deps);
    document.addEventListener = original;
    return handler;
  }

  it('toggles draw mode on Ctrl+D', () => {
    const deps = makeDeps();
    deps.state.drawEnabled = false;
    const handler = setupHandler(deps);
    handler({ key: 'd', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, preventDefault: mock.fn() });
    assert.equal(deps.setDrawMode.mock.callCount(), 1);
    assert.equal(deps.setDrawMode.mock.calls[0].arguments[0], true);
  });

  it('toggles draw mode off when already enabled', () => {
    const deps = makeDeps();
    deps.state.drawEnabled = true;
    const handler = setupHandler(deps);
    handler({ key: 'd', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, preventDefault: mock.fn() });
    assert.equal(deps.setDrawMode.mock.callCount(), 1);
    assert.equal(deps.setDrawMode.mock.calls[0].arguments[0], false);
  });
});

// ── ? shortcut help ─────────────────────────────────────────────────────────

describe('initKeyboard — ? shortcut help', () => {
  function setupHandler(deps) {
    let handler;
    const original = document.addEventListener;
    document.addEventListener = (type, fn) => { if (type === 'keydown') handler = fn; };
    initKeyboard(deps);
    document.addEventListener = original;
    return handler;
  }

  it('does not show help when active element is INPUT', () => {
    const deps = makeDeps();
    const handler = setupHandler(deps);
    const fakeInput = document.createElement('input');
    fakeInput.tagName = 'INPUT';
    const origDesc = Object.getOwnPropertyDescriptor(document, 'activeElement');
    Object.defineProperty(document, 'activeElement', { value: fakeInput, configurable: true });
    handler({ key: '?', ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, preventDefault: mock.fn() });
    if (origDesc) Object.defineProperty(document, 'activeElement', origDesc);
    else delete document.activeElement;
    assert.equal(deps.showShortcutsHelp.mock.callCount(), 0);
  });

  it('does not show help when active element is TEXTAREA', () => {
    const deps = makeDeps();
    const handler = setupHandler(deps);
    const fakeTextarea = document.createElement('textarea');
    fakeTextarea.tagName = 'TEXTAREA';
    const origDesc = Object.getOwnPropertyDescriptor(document, 'activeElement');
    Object.defineProperty(document, 'activeElement', { value: fakeTextarea, configurable: true });
    handler({ key: '?', ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, preventDefault: mock.fn() });
    if (origDesc) Object.defineProperty(document, 'activeElement', origDesc);
    else delete document.activeElement;
    assert.equal(deps.showShortcutsHelp.mock.callCount(), 0);
  });

  it('does not show help when active element is SELECT', () => {
    const deps = makeDeps();
    const handler = setupHandler(deps);
    const fakeSelect = document.createElement('select');
    fakeSelect.tagName = 'SELECT';
    const origDesc = Object.getOwnPropertyDescriptor(document, 'activeElement');
    Object.defineProperty(document, 'activeElement', { value: fakeSelect, configurable: true });
    handler({ key: '?', ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, preventDefault: mock.fn() });
    if (origDesc) Object.defineProperty(document, 'activeElement', origDesc);
    else delete document.activeElement;
    assert.equal(deps.showShortcutsHelp.mock.callCount(), 0);
  });
});

// ── Configurable hotkeys (next, prev, zoom, etc.) ───────────────────────────

describe('initKeyboard — configurable hotkeys', () => {
  function setupHandler(deps) {
    let handler;
    const original = document.addEventListener;
    document.addEventListener = (type, fn) => { if (type === 'keydown') handler = fn; };
    initKeyboard(deps);
    document.addEventListener = original;
    return handler;
  }

  it('clicks ocrCurrentPage on ocrPage hotkey', () => {
    const deps = makeDeps();
    let clicked = false;
    deps.els.ocrCurrentPage.addEventListener('click', () => { clicked = true; });
    const handler = setupHandler(deps);
    handler({ key: 'o', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, preventDefault: mock.fn() });
    assert.ok(clicked);
  });

  it('focuses searchInput on searchFocus hotkey', () => {
    const deps = makeDeps();
    let focused = false;
    deps.els.searchInput.focus = mock.fn(() => { focused = true; });
    const handler = setupHandler(deps);
    handler({ key: 'f', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, preventDefault: mock.fn() });
    assert.ok(focused);
  });

  it('does not click elements for unmatched hotkeys', () => {
    const deps = makeDeps();
    let nextClicked = false;
    deps.els.nextPage.addEventListener('click', () => { nextClicked = true; });
    const handler = setupHandler(deps);
    // 'a' with ctrl does not match any hotkey
    handler({ key: 'a', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, preventDefault: mock.fn() });
    assert.equal(nextClicked, false);
  });

  it('handles hotkey with metaKey (macOS Cmd)', () => {
    const deps = makeDeps();
    const handler = setupHandler(deps);
    const pd = mock.fn();
    // Ctrl+B via metaKey
    handler({ key: 'b', ctrlKey: false, metaKey: true, altKey: false, shiftKey: false, preventDefault: pd });
    assert.equal(deps.addBookmark.mock.callCount(), 1);
  });
});
