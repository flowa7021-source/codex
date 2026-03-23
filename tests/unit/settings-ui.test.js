import './setup-dom.js';
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

// Ensure document.body has classList for settings-ui functions
if (!document.body.classList) {
  const _bodyClasses = new Set();
  document.body.classList = {
    add(...cls) { cls.forEach(c => _bodyClasses.add(c)); },
    remove(...cls) { cls.forEach(c => _bodyClasses.delete(c)); },
    toggle(c, force) {
      if (force !== undefined) { force ? _bodyClasses.add(c) : _bodyClasses.delete(c); }
      else if (_bodyClasses.has(c)) { _bodyClasses.delete(c); }
      else { _bodyClasses.add(c); }
    },
    contains(c) { return _bodyClasses.has(c); },
  };
}

import { state, els } from '../../app/modules/state.js';
import {
  initSettingsUiDeps,
  applyAppLanguage,
  readUiSizeSettingsFromModal,
  applySectionVisibilitySettings,
  openSettingsModal,
  closeSettingsModal,
  resetUiSizeToDefaults,
} from '../../app/modules/settings-ui.js';

const defaultSettings = () => ({
  appLang: 'ru',
  ocrLang: 'auto',
  ocrCyrillicOnly: true,
  ocrQualityMode: 'balanced',
  ocrMinW: 24,
  ocrMinH: 24,
  backgroundOcr: false,
  uiSidebarWidth: 220,
  uiToolbarScale: 1,
  uiTextMinHeight: 40,
  uiPageAreaPx: 860,
  uiToolbarTopPx: 34,
  uiToolbarBottomPx: 86,
  uiTextPanelPx: 120,
  uiAnnotationCanvasScale: 90,
  sidebarSections: {},
  toolbarSections: {},
});

function resetState() {
  localStorage.clear();
  state.settings = defaultSettings();
  state.ocrRegionMode = false;

  els.openSettingsModal = document.createElement('button');
  els.ocrCurrentPage = document.createElement('button');
  els.copyOcrText = document.createElement('button');
  els.searchBtn = document.createElement('button');
  els.pageText = document.createElement('textarea');
  els.saveSettingsModal = document.createElement('button');
  els.ocrRegionMode = document.createElement('button');
  els.settingsModal = document.createElement('div');
  els.cfgSidebarWidth = document.createElement('input');
  els.cfgToolbarScale = document.createElement('input');
  els.cfgTextMinHeight = document.createElement('input');
  els.cfgPageAreaHeight = document.createElement('input');
  els.cfgTopToolbarHeight = document.createElement('input');
  els.cfgBottomToolbarHeight = document.createElement('input');
  els.cfgTextPanelHeight = document.createElement('input');
  els.cfgAnnotationCanvasScale = document.createElement('input');
  els.cfgShowSidebar = document.createElement('input');
  els.cfgShowSearch = document.createElement('input');
  els.cfgShowAnnot = document.createElement('input');
  els.cfgShowText = document.createElement('input');
  els.cfgTheme = document.createElement('select');
  els.cfgAppLang = document.createElement('select');
  els.cfgOcrLang = document.createElement('select');
  els.cfgOcrCyrillicOnly = document.createElement('input');
  els.cfgOcrQualityMode = document.createElement('select');
  els.cfgOcrMinW = document.createElement('input');
  els.cfgOcrMinH = document.createElement('input');
  els.cfgBackgroundOcr = document.createElement('input');
  els.cfgSidebarSections = document.createElement('div');
  els.cfgToolbarSections = document.createElement('div');

  initSettingsUiDeps({
    uiLayoutKey: (name) => `novareader-ui-layout:${name}`,
    refreshOcrStorageInfo: () => {},
    applyUiSizeSettings: () => {},
    defaultSettings,
    saveAppSettings: () => {},
    clearOcrRuntimeCaches: () => {},
    applyLayoutState: () => {},
    applyLayoutWithTransition: () => {},
  });
}

describe('settings-ui', () => {
  beforeEach(() => resetState());

  describe('applyAppLanguage', () => {
    it('sets Russian labels by default', () => {
      applyAppLanguage();
      assert.equal(els.searchBtn.textContent, 'Найти');
    });

    it('sets English labels when appLang is en', () => {
      state.settings.appLang = 'en';
      applyAppLanguage();
      assert.equal(els.searchBtn.textContent, 'Search');
    });

    it('sets settings icon on openSettingsModal', () => {
      applyAppLanguage();
      assert.equal(els.openSettingsModal.textContent, '⚙');
    });
  });

  describe('readUiSizeSettingsFromModal', () => {
    it('returns defaults when inputs are empty', () => {
      const values = readUiSizeSettingsFromModal();
      assert.equal(values.sidebar, 220);
      assert.equal(values.toolbarScale, 1);
      assert.equal(values.pageArea, 860);
    });

    it('clamps sidebar to min 160', () => {
      els.cfgSidebarWidth.value = '50';
      const values = readUiSizeSettingsFromModal();
      assert.equal(values.sidebar, 160);
    });

    it('clamps sidebar to max 360', () => {
      els.cfgSidebarWidth.value = '500';
      const values = readUiSizeSettingsFromModal();
      assert.equal(values.sidebar, 360);
    });

    it('parses toolbar scale as percentage', () => {
      els.cfgToolbarScale.value = '80';
      const values = readUiSizeSettingsFromModal();
      assert.equal(values.toolbarScale, 0.8);
    });
  });

  describe('openSettingsModal', () => {
    it('adds open class to modal', () => {
      // Nullify section containers to skip renderSectionVisibilityControls DOM ops
      els.cfgSidebarSections = null;
      els.cfgToolbarSections = null;
      openSettingsModal();
      assert.ok(els.settingsModal.classList.contains('open'));
    });

    it('sets aria-hidden to false', () => {
      els.cfgSidebarSections = null;
      els.cfgToolbarSections = null;
      openSettingsModal();
      assert.equal(els.settingsModal.getAttribute('aria-hidden'), 'false');
    });
  });

  describe('closeSettingsModal', () => {
    it('removes open class from modal', () => {
      els.cfgSidebarSections = null;
      els.cfgToolbarSections = null;
      openSettingsModal();
      closeSettingsModal(false);
      assert.ok(!els.settingsModal.classList.contains('open'));
    });

    it('reverts settings when closed without saving', () => {
      els.cfgSidebarSections = null;
      els.cfgToolbarSections = null;
      const original = { ...state.settings };
      openSettingsModal();
      state.settings.appLang = 'en';
      closeSettingsModal(false);
      assert.equal(state.settings.appLang, original.appLang);
    });

    it('keeps settings when saved=true', () => {
      els.cfgSidebarSections = null;
      els.cfgToolbarSections = null;
      openSettingsModal();
      state.settings.appLang = 'en';
      closeSettingsModal(true);
      assert.equal(state.settings.appLang, 'en');
    });
  });

  describe('resetUiSizeToDefaults', () => {
    it('resets input values to defaults', () => {
      els.cfgSidebarWidth.value = '300';
      resetUiSizeToDefaults();
      assert.equal(els.cfgSidebarWidth.value, '220');
    });
  });

  describe('applySectionVisibilitySettings', () => {
    it('does not throw with no section elements', () => {
      assert.doesNotThrow(() => applySectionVisibilitySettings());
    });
  });
});
