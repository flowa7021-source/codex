import './setup-dom.js';
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

const { initRibbonToolbar, switchTab, setContextualTab } = await import('../../app/modules/ribbon-toolbar.js');

describe('ribbon-toolbar', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
  });

  it('initRibbonToolbar is a function', () => {
    assert.equal(typeof initRibbonToolbar, 'function');
  });

  it('initRibbonToolbar returns early if no container', () => {
    assert.doesNotThrow(() => initRibbonToolbar({ container: null }));
  });

  it('initRibbonToolbar adds ribbon-toolbar class to container', () => {
    initRibbonToolbar({ container });
    assert.ok(container.classList.contains('ribbon-toolbar'));
  });

  it('initRibbonToolbar creates tab bar and content area', () => {
    initRibbonToolbar({ container });
    const tabBar = container.children.find(c => c.className?.includes('ribbon-tab-bar'));
    const contentArea = container.children.find(c => c.className?.includes('ribbon-content-area'));
    assert.ok(tabBar, 'tab bar should be created');
    assert.ok(contentArea, 'content area should be created');
  });

  it('initRibbonToolbar uses custom tabs', () => {
    const tabs = [
      { id: 'custom', label: 'Custom', groups: [] },
    ];
    initRibbonToolbar({ container, tabs });
    const tabBar = container.children.find(c => c.className?.includes('ribbon-tab-bar'));
    // Tab bar should have tab button + collapse button = 2 children
    const tabBtns = tabBar.children.filter(c => c.className?.includes('ribbon-tab-btn'));
    assert.equal(tabBtns.length, 1);
  });

  it('switchTab is a function', () => {
    assert.equal(typeof switchTab, 'function');
  });

  it('switchTab does nothing with null container', () => {
    assert.doesNotThrow(() => switchTab(null, 'home'));
  });

  it('setContextualTab is a function', () => {
    assert.equal(typeof setContextualTab, 'function');
  });

  it('setContextualTab does nothing with null container', () => {
    assert.doesNotThrow(() => setContextualTab(null, 'pdf', true));
  });

  it('initRibbonToolbar sets specified activeTab as selected', () => {
    const tabs = [
      { id: 'first', label: 'First', groups: [] },
      { id: 'second', label: 'Second', groups: [] },
    ];
    initRibbonToolbar({ container, tabs, activeTab: 'first' });
    const tabBar = container.children.find(c => c.className?.includes('ribbon-tab-bar'));
    const firstTab = tabBar.children.find(c => c.dataset?.ribbonTab === 'first');
    assert.equal(firstTab.getAttribute('aria-selected'), 'true');
  });

  it('tab panels have role=tabpanel', () => {
    const tabs = [{ id: 'test', label: 'Test', groups: [] }];
    initRibbonToolbar({ container, tabs });
    const contentArea = container.children.find(c => c.className?.includes('ribbon-content-area'));
    const panel = contentArea.children.find(c => c.dataset?.ribbonPanel === 'test');
    assert.equal(panel.getAttribute('role'), 'tabpanel');
  });

  it('tab buttons have role=tab', () => {
    const tabs = [{ id: 'test', label: 'Test', groups: [] }];
    initRibbonToolbar({ container, tabs });
    const tabBar = container.children.find(c => c.className?.includes('ribbon-tab-bar'));
    const btn = tabBar.children.find(c => c.dataset?.ribbonTab === 'test');
    assert.equal(btn.getAttribute('role'), 'tab');
  });
});
