import './setup-dom.js';
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { initTabs } from '../../app/modules/init-tabs.js';

function makeDeps(overrides = {}) {
  // Create a minimal TabManager class
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
});
