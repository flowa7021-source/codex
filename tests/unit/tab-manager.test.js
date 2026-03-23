import './setup-dom.js';
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

import { TabManager } from '../../app/modules/tab-manager.js';

function makeManager(overrides = {}) {
  const tabBar = document.createElement('div');
  return new TabManager({
    tabBar,
    onActivate: mock.fn(),
    onClose: () => true,
    ...overrides,
  });
}

describe('TabManager', () => {
  it('constructor initializes empty state', () => {
    const mgr = makeManager();
    assert.equal(mgr.tabs.size, 0);
    assert.equal(mgr.activeTabId, null);
    assert.equal(mgr.maxTabs, 10);
  });

  it('open creates a new tab and activates it', () => {
    const onActivate = mock.fn();
    const mgr = makeManager({ onActivate });
    const id = mgr.open('test.pdf', 'pdf', new Uint8Array(10));
    assert.ok(id);
    assert.equal(mgr.tabs.size, 1);
    assert.equal(mgr.activeTabId, id);
    assert.equal(onActivate.mock.callCount(), 1);
  });

  it('open returns existing tab id for duplicate name', () => {
    const mgr = makeManager();
    const id1 = mgr.open('test.pdf', 'pdf', new Uint8Array(10));
    const id2 = mgr.open('test.pdf', 'pdf', new Uint8Array(20));
    assert.equal(id1, id2);
    assert.equal(mgr.tabs.size, 1);
  });

  it('close removes tab and switches to another', () => {
    const mgr = makeManager();
    const id1 = mgr.open('a.pdf', 'pdf', new Uint8Array(1));
    const id2 = mgr.open('b.pdf', 'pdf', new Uint8Array(1));
    assert.equal(mgr.activeTabId, id2);

    mgr.close(id2);
    assert.equal(mgr.tabs.size, 1);
    assert.equal(mgr.activeTabId, id1);
  });

  it('close respects onClose veto', () => {
    const mgr = makeManager({ onClose: () => false });
    const id = mgr.open('test.pdf', 'pdf', new Uint8Array(1));
    const closed = mgr.close(id);
    assert.equal(closed, false);
    assert.equal(mgr.tabs.size, 1);
  });

  it('markModified sets modified flag on active tab', () => {
    const mgr = makeManager();
    mgr.open('test.pdf', 'pdf', new Uint8Array(1));
    mgr.markModified();
    const tab = mgr.getActiveTab();
    assert.equal(tab.modified, true);
  });

  it('updateState merges state into active tab', () => {
    const mgr = makeManager();
    mgr.open('test.pdf', 'pdf', new Uint8Array(1));
    mgr.updateState({ currentPage: 5, zoom: 1.5 });
    const tab = mgr.getActiveTab();
    assert.equal(tab.state.currentPage, 5);
    assert.equal(tab.state.zoom, 1.5);
  });

  it('getActiveTab returns null when no tabs', () => {
    const mgr = makeManager();
    assert.equal(mgr.getActiveTab(), null);
  });

  it('getAllTabs returns array of all tabs', () => {
    const mgr = makeManager();
    mgr.open('a.pdf', 'pdf', new Uint8Array(1));
    mgr.open('b.pdf', 'pdf', new Uint8Array(1));
    const all = mgr.getAllTabs();
    assert.equal(all.length, 2);
  });

  it('enforces maxTabs by closing oldest non-modified tab', () => {
    const mgr = makeManager({ maxTabs: 2 });
    mgr.open('a.pdf', 'pdf', new Uint8Array(1));
    mgr.open('b.pdf', 'pdf', new Uint8Array(1));
    mgr.open('c.pdf', 'pdf', new Uint8Array(1));
    assert.equal(mgr.tabs.size, 2);
  });
});
