import './setup-dom.js';
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

import { state, els } from '../../app/modules/state.js';
import {
  uiLayoutKey,
  applyAdvancedPanelsState,
  toggleAdvancedPanelsState,
  toggleLayoutState,
  applyLayoutWithTransition,
  initLayoutControllerDeps,
} from '../../app/modules/layout-controller.js';

function resetState() {
  localStorage.clear();
  state.settings = null;
  // Minimal els stubs
  els.toggleAdvancedPanels = document.createElement('button');
  els.toggleSidebar = document.createElement('button');
  els.toggleToolsBar = document.createElement('button');
  els.toggleTextTools = document.createElement('button');
  els.toggleSearchTools = document.createElement('button');
  els.toggleAnnotTools = document.createElement('button');
  els.toggleTextToolsInline = document.createElement('button');
  els.searchToolsGroup = null;
  els.searchInput = null;
  initLayoutControllerDeps({});
}

describe('layout-controller', () => {
  beforeEach(() => resetState());

  describe('uiLayoutKey', () => {
    it('returns prefixed key', () => {
      assert.equal(uiLayoutKey('sidebarHidden'), 'novareader-ui-layout:sidebarHidden');
    });

    it('works with arbitrary names', () => {
      assert.equal(uiLayoutKey('foo'), 'novareader-ui-layout:foo');
    });
  });

  describe('applyAdvancedPanelsState', () => {
    it('defaults to hidden when no localStorage value', () => {
      applyAdvancedPanelsState();
      assert.ok(document.body.classList?.contains?.('advanced-hidden') !== false);
      // Button text should indicate off
      assert.ok(els.toggleAdvancedPanels.textContent.includes('off'));
    });

    it('shows panels when localStorage is 0', () => {
      localStorage.setItem(uiLayoutKey('advancedHidden'), '0');
      applyAdvancedPanelsState();
      assert.ok(els.toggleAdvancedPanels.textContent.includes('on'));
    });
  });

  describe('toggleAdvancedPanelsState', () => {
    it('toggles from hidden to visible', () => {
      // default is hidden (no localStorage value => hidden)
      toggleAdvancedPanelsState();
      assert.equal(localStorage.getItem(uiLayoutKey('advancedHidden')), '0');
    });

    it('toggles from visible back to hidden', () => {
      localStorage.setItem(uiLayoutKey('advancedHidden'), '0');
      toggleAdvancedPanelsState();
      assert.equal(localStorage.getItem(uiLayoutKey('advancedHidden')), '1');
    });
  });

  describe('toggleLayoutState', () => {
    it('toggles a layout key from default to 1', () => {
      toggleLayoutState('sidebarHidden');
      assert.equal(localStorage.getItem(uiLayoutKey('sidebarHidden')), '1');
    });

    it('toggles a layout key from 1 to 0', () => {
      localStorage.setItem(uiLayoutKey('toolsHidden'), '1');
      toggleLayoutState('toolsHidden');
      assert.equal(localStorage.getItem(uiLayoutKey('toolsHidden')), '0');
    });
  });

  describe('applyLayoutWithTransition', () => {
    it('does not throw when no app-shell element exists', () => {
      assert.doesNotThrow(() => applyLayoutWithTransition());
    });
  });
});
