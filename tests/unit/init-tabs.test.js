import './setup-dom.js';
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { initTabs } from '../../app/modules/init-tabs.js';

// Save and restore document.getElementById so we can mock per-test
const originalGetElementById = document.getElementById;

function makeDeps(overrides = {}) {
  // Create a minimal TabManager class that exposes opts callbacks
  class MockTabManager {
    constructor(opts) {
      this.opts = opts;
      this.activeTabId = null;
      this._tabs = [];
      this.onDeactivate = null;
    }
    open(name, type, bytes, state = {}) {
      const tab = { id: this._tabs.length + 1, name, type, bytes, state, modified: false };
      this._tabs.push(tab);
      this.activeTabId = tab.id;
    }
    getAllTabs() { return this._tabs; }
  }

  return {
    state: { currentPage: 1, pageCount: 10, zoom: 1.0, rotation: 0, pdfBytes: null },
    els: {
      fileInput: document.createElement('input'),
      canvasWrap: document.createElement('div'),
    },
    safeOn: mock.fn(),
    openFile: mock.fn(async () => {}),
    renderCurrentPage: mock.fn(async () => {}),
    TabManager: MockTabManager,
    ...overrides,
  };
}

describe('initTabs', () => {
  beforeEach(() => {
    // Reset getElementById to default
    document.getElementById = originalGetElementById;
    // Ensure window.sessionStorage is available (the mock window doesn't inherit from globalThis)
    if (!window.sessionStorage) {
      window.sessionStorage = globalThis.sessionStorage;
    }
    // Clear sessionStorage
    globalThis.sessionStorage.clear();
  });

  it('exports a function', () => {
    assert.equal(typeof initTabs, 'function');
  });

  it('returns object with tabManager and openFileWithTabs', () => {
    const result = initTabs(makeDeps());
    assert.ok(result.tabManager, 'should return tabManager');
    assert.equal(typeof result.openFileWithTabs, 'function');
  });

  it('does not throw with mock deps', () => {
    assert.doesNotThrow(() => initTabs(makeDeps()));
  });

  it('sets onDeactivate handler on tabManager', () => {
    const result = initTabs(makeDeps());
    assert.equal(typeof result.tabManager.onDeactivate, 'function');
  });

  it('openFileWithTabs opens a tab via tabManager', async () => {
    const deps = makeDeps();
    const result = initTabs(deps);
    const file = new File([new Uint8Array([1, 2, 3])], 'test.pdf', { type: 'application/pdf' });
    await result.openFileWithTabs(file);
    const tabs = result.tabManager.getAllTabs();
    assert.equal(tabs.length, 1);
    assert.equal(tabs[0].name, 'test.pdf');
    assert.equal(tabs[0].type, 'pdf');
  });

  it('assigns _tabManagerInstance to window', () => {
    const result = initTabs(makeDeps());
    assert.ok(window._tabManagerInstance, 'should set window._tabManagerInstance');
  });

  // ─── NEW TESTS: exercise untested functions/callbacks ───

  it('onActivate restores tab state and calls openFile + renderCurrentPage', async () => {
    const deps = makeDeps();
    const result = initTabs(deps);
    const tabBytes = new Uint8Array([1, 2, 3]);
    const tab = {
      bytes: tabBytes,
      name: 'doc.pdf',
      type: 'pdf',
      state: { currentPage: 5, zoom: 2.0, rotation: 90, scrollY: 100 },
    };
    // Call the onActivate callback that was passed to TabManager constructor
    await result.tabManager.opts.onActivate(tab);
    assert.equal(deps.openFile.mock.calls.length, 1);
    assert.equal(deps.renderCurrentPage.mock.calls.length, 1);
    assert.equal(deps.state.currentPage, 5);
    assert.equal(deps.state.zoom, 2.0);
    assert.equal(deps.state.rotation, 90);
  });

  it('onActivate returns early if tab has no bytes', async () => {
    const deps = makeDeps();
    const result = initTabs(deps);
    const tab = { bytes: null, name: 'empty.pdf', type: 'pdf', state: {} };
    await result.tabManager.opts.onActivate(tab);
    assert.equal(deps.openFile.mock.calls.length, 0);
  });

  it('onActivate defaults type to pdf when tab.type is falsy', async () => {
    const deps = makeDeps();
    const result = initTabs(deps);
    const tab = {
      bytes: new Uint8Array([1]),
      name: 'doc',
      type: undefined,
      state: {},
    };
    await result.tabManager.opts.onActivate(tab);
    assert.equal(deps.openFile.mock.calls.length, 1);
    // The File should have been created with application/pdf
    const fileArg = deps.openFile.mock.calls[0].arguments[0];
    assert.equal(fileArg.type, 'application/pdf');
  });

  it('onActivate uses octet-stream for non-pdf type', async () => {
    const deps = makeDeps();
    const result = initTabs(deps);
    const tab = {
      bytes: new Uint8Array([1]),
      name: 'doc.djvu',
      type: 'djvu',
      state: {},
    };
    await result.tabManager.opts.onActivate(tab);
    const fileArg = deps.openFile.mock.calls[0].arguments[0];
    assert.equal(fileArg.type, 'application/octet-stream');
  });

  it('onActivate clamps currentPage to pageCount', async () => {
    const deps = makeDeps();
    deps.state.pageCount = 3;
    const result = initTabs(deps);
    const tab = {
      bytes: new Uint8Array([1]),
      name: 'doc.pdf',
      type: 'pdf',
      state: { currentPage: 999 },
    };
    await result.tabManager.opts.onActivate(tab);
    assert.equal(deps.state.currentPage, 3);
  });

  it('onActivate sets scrollY on canvasWrap', async () => {
    const deps = makeDeps();
    const result = initTabs(deps);
    const tab = {
      bytes: new Uint8Array([1]),
      name: 'doc.pdf',
      type: 'pdf',
      state: { scrollY: 250 },
    };
    await result.tabManager.opts.onActivate(tab);
    assert.equal(deps.els.canvasWrap.scrollTop, 250);
  });

  it('onClose returns true when tab is not modified', () => {
    const deps = makeDeps();
    const result = initTabs(deps);
    const tab = { name: 'doc.pdf', modified: false };
    const canClose = result.tabManager.opts.onClose(tab);
    assert.equal(canClose, true);
  });

  it('onClose calls confirm when tab is modified', () => {
    const deps = makeDeps();
    const result = initTabs(deps);
    // Mock global confirm
    const origConfirm = globalThis.confirm;
    globalThis.confirm = () => false;
    const tab = { name: 'doc.pdf', modified: true };
    const canClose = result.tabManager.opts.onClose(tab);
    assert.equal(canClose, false);
    globalThis.confirm = origConfirm;
  });

  it('onDeactivate saves current state into tab', () => {
    const deps = makeDeps();
    deps.state.currentPage = 7;
    deps.state.zoom = 1.5;
    deps.state.rotation = 180;
    deps.els.canvasWrap.scrollTop = 42;
    const result = initTabs(deps);
    const tab = { type: 'pdf', state: null };
    result.tabManager.onDeactivate(tab);
    assert.deepStrictEqual(tab.state, {
      currentPage: 7,
      zoom: 1.5,
      rotation: 180,
      scrollY: 42,
    });
  });

  it('onDeactivate copies pdfBytes when tab type is pdf', () => {
    const deps = makeDeps();
    const pdfData = new Uint8Array([10, 20, 30]);
    deps.state.pdfBytes = pdfData;
    const result = initTabs(deps);
    const tab = { type: 'pdf', state: null, bytes: null };
    result.tabManager.onDeactivate(tab);
    assert.equal(tab.bytes, pdfData);
  });

  it('onDeactivate does not copy pdfBytes for non-pdf tabs', () => {
    const deps = makeDeps();
    deps.state.pdfBytes = new Uint8Array([10]);
    const result = initTabs(deps);
    const tab = { type: 'djvu', state: null, bytes: null };
    result.tabManager.onDeactivate(tab);
    assert.equal(tab.bytes, null);
  });

  it('openFileWithTabs detects djvu type', async () => {
    const deps = makeDeps();
    const result = initTabs(deps);
    const file = new File([new Uint8Array([1])], 'book.djvu');
    await result.openFileWithTabs(file);
    assert.equal(result.tabManager.getAllTabs()[0].type, 'djvu');
  });

  it('openFileWithTabs detects djv type', async () => {
    const deps = makeDeps();
    const result = initTabs(deps);
    const file = new File([new Uint8Array([1])], 'book.djv');
    await result.openFileWithTabs(file);
    assert.equal(result.tabManager.getAllTabs()[0].type, 'djvu');
  });

  it('openFileWithTabs detects epub type', async () => {
    const deps = makeDeps();
    const result = initTabs(deps);
    const file = new File([new Uint8Array([1])], 'novel.epub');
    await result.openFileWithTabs(file);
    assert.equal(result.tabManager.getAllTabs()[0].type, 'epub');
  });

  it('openFileWithTabs detects image types', async () => {
    const deps = makeDeps();
    const result = initTabs(deps);
    const file = new File([new Uint8Array([1])], 'photo.png');
    await result.openFileWithTabs(file);
    assert.equal(result.tabManager.getAllTabs()[0].type, 'image');
  });

  it('openFileWithTabs detects unknown type', async () => {
    const deps = makeDeps();
    const result = initTabs(deps);
    const file = new File([new Uint8Array([1])], 'data.xyz');
    await result.openFileWithTabs(file);
    assert.equal(result.tabManager.getAllTabs()[0].type, 'unknown');
  });

  it('fileInput change handler calls openFileWithTabs', async () => {
    const deps = makeDeps();
    const result = initTabs(deps);
    // The safeOn was called to register the change handler
    assert.equal(deps.safeOn.mock.calls.length, 1);
    const handler = deps.safeOn.mock.calls[0].arguments[2];
    // Simulate a change event with a file
    const file = new File([new Uint8Array([5, 6])], 'test2.pdf');
    const fakeEvent = { target: { files: [file], value: 'fakepath' } };
    await handler(fakeEvent);
    assert.equal(result.tabManager.getAllTabs().length, 1);
    assert.equal(fakeEvent.target.value, '');
  });

  it('fileInput change handler does nothing when no file selected', async () => {
    const deps = makeDeps();
    const result = initTabs(deps);
    const handler = deps.safeOn.mock.calls[0].arguments[2];
    const fakeEvent = { target: { files: [], value: '' } };
    await handler(fakeEvent);
    assert.equal(result.tabManager.getAllTabs().length, 0);
  });

  it('removes previous _nrChangeHandler if present', () => {
    const deps = makeDeps();
    const oldHandler = () => {};
    deps.els.fileInput._nrChangeHandler = oldHandler;
    const removeSpy = mock.fn();
    deps.els.fileInput.removeEventListener = removeSpy;
    initTabs(deps);
    assert.equal(removeSpy.mock.calls.length, 1);
    assert.equal(removeSpy.mock.calls[0].arguments[0], 'change');
    assert.equal(removeSpy.mock.calls[0].arguments[1], oldHandler);
  });

  it('returns early without error when fileInput is null', () => {
    const deps = makeDeps();
    deps.els.fileInput = null;
    // Should not throw; returns undefined (no tabManager/openFileWithTabs)
    const result = initTabs(deps);
    assert.equal(result, undefined);
  });

  it('saveTabsToSession persists tabs via visibilitychange', () => {
    const deps = makeDeps();
    const result = initTabs(deps);
    // Open a small tab so it gets serialized
    result.tabManager.open('file.pdf', 'pdf', new Uint8Array([1, 2, 3]), {});
    // Simulate page hidden
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    window.dispatchEvent(new Event('visibilitychange'));
    const saved = window.sessionStorage.getItem('novareader-tabs');
    assert.ok(saved, 'should have saved tabs');
    const parsed = JSON.parse(saved);
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].name, 'file.pdf');
    // Restore
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
  });

  it('saveTabsToSession skips bytes larger than 5MB', () => {
    const deps = makeDeps();
    const result = initTabs(deps);
    // Open a tab with bytes > 5MB
    const bigBytes = new Uint8Array(6 * 1024 * 1024);
    result.tabManager.open('big.pdf', 'pdf', bigBytes, {});
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    window.dispatchEvent(new Event('visibilitychange'));
    const saved = JSON.parse(window.sessionStorage.getItem('novareader-tabs'));
    assert.equal(saved[0].bytes, null);
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
  });

  it('saveTabsToSession is called on beforeunload', () => {
    const deps = makeDeps();
    const result = initTabs(deps);
    result.tabManager.open('f.pdf', 'pdf', new Uint8Array([1]), {});
    window.dispatchEvent(new Event('beforeunload'));
    const saved = window.sessionStorage.getItem('novareader-tabs');
    assert.ok(saved);
  });

  it('restores tabs from sessionStorage on init', () => {
    // Pre-populate sessionStorage
    const tabData = [
      { name: 'restored.pdf', type: 'pdf', bytes: [1, 2, 3], state: { currentPage: 2 } },
    ];
    window.sessionStorage.setItem('novareader-tabs', JSON.stringify(tabData));
    const deps = makeDeps();
    const result = initTabs(deps);
    const tabs = result.tabManager.getAllTabs();
    assert.equal(tabs.length, 1);
    assert.equal(tabs[0].name, 'restored.pdf');
  });

  it('skips restoring tabs without bytes or name', () => {
    const tabData = [
      { name: '', type: 'pdf', bytes: [1, 2], state: {} },
      { name: 'ok.pdf', type: 'pdf', bytes: null, state: {} },
    ];
    window.sessionStorage.setItem('novareader-tabs', JSON.stringify(tabData));
    const deps = makeDeps();
    const result = initTabs(deps);
    assert.equal(result.tabManager.getAllTabs().length, 0);
  });

  it('handles invalid sessionStorage data gracefully', () => {
    window.sessionStorage.setItem('novareader-tabs', 'not valid json{{{');
    const deps = makeDeps();
    assert.doesNotThrow(() => initTabs(deps));
  });

  it('tabBarNewTab click triggers fileInput click', () => {
    const deps = makeDeps();
    const tabBarNewTabEl = document.createElement('button');
    tabBarNewTabEl.id = 'tabBarNewTab';
    const tabBarTabsEl = document.createElement('div');
    tabBarTabsEl.id = 'tabBarTabs';
    const clickSpy = mock.fn();
    deps.els.fileInput.click = clickSpy;

    document.getElementById = (id) => {
      if (id === 'tabBarNewTab') return tabBarNewTabEl;
      if (id === 'tabBarTabs') return tabBarTabsEl;
      return null;
    };
    initTabs(deps);
    // Trigger the click on the new tab button
    tabBarNewTabEl.dispatchEvent(new Event('click'));
    assert.equal(clickSpy.mock.calls.length, 1);
  });

  it('visibilitychange does not save when document is not hidden', () => {
    const deps = makeDeps();
    initTabs(deps);
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    window.sessionStorage.removeItem('novareader-tabs');
    window.dispatchEvent(new Event('visibilitychange'));
    const saved = window.sessionStorage.getItem('novareader-tabs');
    assert.equal(saved, null, 'should not save when not hidden');
  });
});
