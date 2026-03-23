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
