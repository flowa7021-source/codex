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

// Patch createElement to handle append() with string arguments (text nodes)
const _origCreateElement = document.createElement;
document.createElement = function (tag) {
  const el = _origCreateElement(tag);
  const _origAppend = el.append.bind(el);
  el.append = function (...nodes) {
    for (const node of nodes) {
      if (node != null && typeof node !== 'string') {
        el.appendChild(node);
      }
      // Strings (text nodes) are silently accepted without setting parentNode
    }
  };
  return el;
};

// Ensure document.documentElement.style has setProperty for previewUiSizeFromModal
if (!document.documentElement.style.setProperty) {
  const _props = {};
  document.documentElement.style.setProperty = (k, v) => { _props[k] = v; };
  document.documentElement.style.getPropertyValue = (k) => _props[k] || '';
  document.documentElement.style._props = _props;
}

// Ensure document.documentElement has dataset for saveSettingsFromModal theme handling
if (!document.documentElement.dataset) {
  document.documentElement.dataset = {};
}

import { state, els } from '../../app/modules/state.js';
import {
  initSettingsUiDeps,
  applyAppLanguage,
  readUiSizeSettingsFromModal,
  applySectionVisibilitySettings,
  renderSectionVisibilityControls,
  previewUiSizeFromModal,
  saveSettingsFromModal,
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

let mockDeps;

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

  mockDeps = {
    uiLayoutKey: (name) => `novareader-ui-layout:${name}`,
    refreshOcrStorageInfo: mock.fn(),
    applyUiSizeSettings: mock.fn(),
    defaultSettings,
    saveAppSettings: mock.fn(),
    clearOcrRuntimeCaches: mock.fn(),
    applyLayoutState: mock.fn(),
    applyLayoutWithTransition: mock.fn(),
  };

  initSettingsUiDeps(mockDeps);
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

    it('sets aria-label and title on openSettingsModal', () => {
      applyAppLanguage();
      assert.equal(els.openSettingsModal.getAttribute('aria-label'), 'Настройки');
      assert.equal(els.openSettingsModal.title, 'Настройки');
    });

    it('sets aria-label to English when appLang is en', () => {
      state.settings.appLang = 'en';
      applyAppLanguage();
      assert.equal(els.openSettingsModal.getAttribute('aria-label'), 'Settings');
    });

    it('falls back to empty translations for unknown language', () => {
      state.settings.appLang = 'xx';
      applyAppLanguage();
      // With unknown lang, t is empty, so fallback 'Settings' is used
      assert.equal(els.openSettingsModal.getAttribute('aria-label'), 'Settings');
    });

    it('sets ocrCurrentPage textContent', () => {
      applyAppLanguage();
      assert.equal(els.ocrCurrentPage.textContent, 'OCR');
    });

    it('sets copyOcrText textContent', () => {
      state.settings.appLang = 'en';
      applyAppLanguage();
      assert.ok(els.copyOcrText.textContent.includes('OCR'));
    });

    it('sets pageText placeholder', () => {
      applyAppLanguage();
      assert.equal(els.pageText.placeholder, 'Текст страницы');
    });

    it('sets saveSettingsModal textContent', () => {
      applyAppLanguage();
      assert.equal(els.saveSettingsModal.textContent, 'Сохранить');
    });

    it('toggles ocrRegionMode active class', () => {
      state.ocrRegionMode = true;
      applyAppLanguage();
      assert.ok(els.ocrRegionMode.classList.contains('active'));
    });

    it('removes ocrRegionMode active class when false', () => {
      state.ocrRegionMode = false;
      els.ocrRegionMode.classList.add('active');
      applyAppLanguage();
      assert.ok(!els.ocrRegionMode.classList.contains('active'));
    });

    it('handles null settings gracefully', () => {
      state.settings = null;
      assert.doesNotThrow(() => applyAppLanguage());
    });
  });

  describe('renderSectionVisibilityControls', () => {
    it('renders sidebar section checkboxes', () => {
      renderSectionVisibilityControls();
      const inputs = els.cfgSidebarSections.querySelectorAll('input');
      assert.ok(inputs.length > 0, 'should render sidebar checkboxes');
    });

    it('renders toolbar section checkboxes', () => {
      renderSectionVisibilityControls();
      const inputs = els.cfgToolbarSections.querySelectorAll('input');
      assert.ok(inputs.length > 0, 'should render toolbar checkboxes');
    });

    it('sets toolbar checkbox data attributes', () => {
      renderSectionVisibilityControls();
      const inputs = els.cfgToolbarSections.querySelectorAll('input');
      const first = inputs[0];
      assert.equal(first.dataset.sectionType, 'toolbar');
      assert.ok(first.dataset.sectionKey, 'should have a sectionKey');
    });

    it('sidebar checkboxes default to checked when no settings', () => {
      state.settings.sidebarSections = {};
      renderSectionVisibilityControls();
      const inputs = els.cfgSidebarSections.querySelectorAll('input');
      for (const input of inputs) {
        assert.equal(input.checked, true, `${input.dataset.sectionKey} should be checked by default`);
      }
    });

    it('toolbar checkboxes default to checked when no settings', () => {
      state.settings.toolbarSections = {};
      renderSectionVisibilityControls();
      const inputs = els.cfgToolbarSections.querySelectorAll('input');
      for (const input of inputs) {
        assert.equal(input.checked, true, `${input.dataset.sectionKey} should be checked by default`);
      }
    });

    it('respects existing toolbar section visibility settings', () => {
      state.settings.toolbarSections = { navigation: false };
      renderSectionVisibilityControls();
      const inputs = els.cfgToolbarSections.querySelectorAll('input');
      const navInput = inputs.find(i => i.dataset.sectionKey === 'navigation');
      assert.equal(navInput.checked, false, 'navigation should be unchecked');
    });

    it('respects existing sidebar section visibility settings', () => {
      state.settings.sidebarSections = { bookmarks: false };
      renderSectionVisibilityControls();
      const inputs = els.cfgSidebarSections.querySelectorAll('input');
      const bmInput = inputs.find(i => i.dataset.sectionKey === 'bookmarks');
      assert.equal(bmInput.checked, false, 'bookmarks should be unchecked');
    });

    it('skips rendering if cfgSidebarSections is null', () => {
      els.cfgSidebarSections = null;
      assert.doesNotThrow(() => renderSectionVisibilityControls());
    });

    it('skips rendering if cfgToolbarSections is null', () => {
      els.cfgToolbarSections = null;
      assert.doesNotThrow(() => renderSectionVisibilityControls());
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

    it('clamps textMin to min 24', () => {
      els.cfgTextMinHeight.value = '10';
      const values = readUiSizeSettingsFromModal();
      assert.equal(values.textMin, 24);
    });

    it('clamps textMin to max 180', () => {
      els.cfgTextMinHeight.value = '999';
      const values = readUiSizeSettingsFromModal();
      assert.equal(values.textMin, 180);
    });

    it('clamps topToolbar to min 28', () => {
      els.cfgTopToolbarHeight.value = '10';
      const values = readUiSizeSettingsFromModal();
      assert.equal(values.topToolbar, 28);
    });

    it('clamps bottomToolbar to max 220', () => {
      els.cfgBottomToolbarHeight.value = '999';
      const values = readUiSizeSettingsFromModal();
      assert.equal(values.bottomToolbar, 220);
    });

    it('clamps textPanel range', () => {
      els.cfgTextPanelHeight.value = '10';
      assert.equal(readUiSizeSettingsFromModal().textPanel, 72);
      els.cfgTextPanelHeight.value = '999';
      assert.equal(readUiSizeSettingsFromModal().textPanel, 360);
    });

    it('clamps annotationScale range', () => {
      els.cfgAnnotationCanvasScale.value = '10';
      assert.equal(readUiSizeSettingsFromModal().annotationScale, 50);
      els.cfgAnnotationCanvasScale.value = '999';
      assert.equal(readUiSizeSettingsFromModal().annotationScale, 100);
    });

    it('clamps toolbarScale to min 0.1', () => {
      els.cfgToolbarScale.value = '1';
      const values = readUiSizeSettingsFromModal();
      assert.equal(values.toolbarScale, 0.1);
    });
  });

  describe('previewUiSizeFromModal', () => {
    it('does nothing when modal is not open', () => {
      // Modal does not have 'open' class by default
      assert.doesNotThrow(() => previewUiSizeFromModal());
    });

    it('sets CSS custom properties when modal is open', () => {
      els.cfgSidebarSections = null;
      els.cfgToolbarSections = null;
      openSettingsModal();
      // Modal is now open, call preview
      els.cfgSidebarWidth.value = '250';
      els.cfgToolbarScale.value = '80';
      els.cfgTextMinHeight.value = '50';
      els.cfgPageAreaHeight.value = '900';
      els.cfgTopToolbarHeight.value = '40';
      els.cfgBottomToolbarHeight.value = '100';
      els.cfgTextPanelHeight.value = '150';
      els.cfgAnnotationCanvasScale.value = '80';
      previewUiSizeFromModal();
      const style = document.documentElement.style;
      assert.equal(style.getPropertyValue('--ui-toolbar-scale'), '0.8');
      assert.equal(style.getPropertyValue('--ui-text-min-height'), '50px');
      assert.equal(style.getPropertyValue('--ui-toolbar-top-height'), '40px');
      assert.equal(style.getPropertyValue('--ui-toolbar-bottom-height'), '100px');
      assert.equal(style.getPropertyValue('--ui-text-panel-height'), '150px');
      assert.equal(style.getPropertyValue('--ui-annotation-canvas-scale'), '0.80');
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

    it('reads layout state from localStorage', () => {
      els.cfgSidebarSections = null;
      els.cfgToolbarSections = null;
      localStorage.setItem('novareader-ui-layout:sidebarHidden', '1');
      localStorage.setItem('novareader-ui-layout:searchToolsHidden', '1');
      openSettingsModal();
      assert.equal(els.cfgShowSidebar.checked, false);
      assert.equal(els.cfgShowSearch.checked, false);
    });

    it('populates OCR settings from state', () => {
      els.cfgSidebarSections = null;
      els.cfgToolbarSections = null;
      state.settings.ocrLang = 'eng';
      state.settings.ocrCyrillicOnly = false;
      state.settings.ocrQualityMode = 'accurate';
      state.settings.ocrMinW = 32;
      state.settings.ocrMinH = 48;
      state.settings.backgroundOcr = true;
      openSettingsModal();
      assert.equal(els.cfgOcrLang.value, 'eng');
      assert.equal(els.cfgOcrCyrillicOnly.checked, false);
      assert.equal(els.cfgOcrQualityMode.value, 'accurate');
      assert.equal(els.cfgOcrMinW.value, '32');
      assert.equal(els.cfgOcrMinH.value, '48');
      assert.equal(els.cfgBackgroundOcr.checked, true);
    });

    it('populates UI size settings from state', () => {
      els.cfgSidebarSections = null;
      els.cfgToolbarSections = null;
      state.settings.uiSidebarWidth = 300;
      state.settings.uiToolbarScale = 0.8;
      state.settings.uiTextMinHeight = 60;
      state.settings.uiPageAreaPx = 1000;
      state.settings.uiToolbarTopPx = 50;
      state.settings.uiToolbarBottomPx = 100;
      state.settings.uiTextPanelPx = 150;
      state.settings.uiAnnotationCanvasScale = 75;
      openSettingsModal();
      assert.equal(els.cfgSidebarWidth.value, '300');
      assert.equal(els.cfgToolbarScale.value, '80');
      assert.equal(els.cfgTextMinHeight.value, '60');
      assert.equal(els.cfgPageAreaHeight.value, '1000');
      assert.equal(els.cfgTopToolbarHeight.value, '50');
      assert.equal(els.cfgBottomToolbarHeight.value, '100');
      assert.equal(els.cfgTextPanelHeight.value, '150');
      assert.equal(els.cfgAnnotationCanvasScale.value, '75');
    });

    it('calls refreshOcrStorageInfo', () => {
      els.cfgSidebarSections = null;
      els.cfgToolbarSections = null;
      openSettingsModal();
      assert.equal(mockDeps.refreshOcrStorageInfo.mock.calls.length, 1);
    });

    it('adds settings-modal-open class to body', () => {
      els.cfgSidebarSections = null;
      els.cfgToolbarSections = null;
      openSettingsModal();
      assert.ok(document.body.classList.contains('settings-modal-open'));
    });

    it('does nothing when settingsModal is null', () => {
      els.settingsModal = null;
      assert.doesNotThrow(() => openSettingsModal());
    });

    it('renders section visibility controls when containers exist', () => {
      // Keep section containers, so renderSectionVisibilityControls runs
      openSettingsModal();
      const sidebarInputs = els.cfgSidebarSections.querySelectorAll('input');
      const toolbarInputs = els.cfgToolbarSections.querySelectorAll('input');
      assert.ok(sidebarInputs.length > 0);
      assert.ok(toolbarInputs.length > 0);
    });

    it('populates theme from localStorage', () => {
      els.cfgSidebarSections = null;
      els.cfgToolbarSections = null;
      localStorage.setItem('novareader-theme', 'sepia');
      openSettingsModal();
      assert.equal(els.cfgTheme.value, 'sepia');
    });

    it('populates appLang from state', () => {
      els.cfgSidebarSections = null;
      els.cfgToolbarSections = null;
      state.settings.appLang = 'en';
      openSettingsModal();
      assert.equal(els.cfgAppLang.value, 'en');
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

    it('removes settings-modal-open from body', () => {
      els.cfgSidebarSections = null;
      els.cfgToolbarSections = null;
      openSettingsModal();
      assert.ok(document.body.classList.contains('settings-modal-open'));
      closeSettingsModal(false);
      assert.ok(!document.body.classList.contains('settings-modal-open'));
    });

    it('sets aria-hidden to true', () => {
      els.cfgSidebarSections = null;
      els.cfgToolbarSections = null;
      openSettingsModal();
      closeSettingsModal(false);
      assert.equal(els.settingsModal.getAttribute('aria-hidden'), 'true');
    });

    it('calls applyLayoutWithTransition', () => {
      els.cfgSidebarSections = null;
      els.cfgToolbarSections = null;
      openSettingsModal();
      mockDeps.applyLayoutWithTransition.mock.resetCalls();
      closeSettingsModal(true);
      assert.equal(mockDeps.applyLayoutWithTransition.mock.calls.length, 1);
    });

    it('calls applyUiSizeSettings', () => {
      els.cfgSidebarSections = null;
      els.cfgToolbarSections = null;
      openSettingsModal();
      mockDeps.applyUiSizeSettings.mock.resetCalls();
      closeSettingsModal(true);
      assert.equal(mockDeps.applyUiSizeSettings.mock.calls.length, 1);
    });

    it('does nothing when settingsModal is null', () => {
      els.settingsModal = null;
      assert.doesNotThrow(() => closeSettingsModal(false));
    });
  });

  describe('saveSettingsFromModal', () => {
    it('saves layout visibility to localStorage', () => {
      els.cfgSidebarSections = null;
      els.cfgToolbarSections = null;
      openSettingsModal();
      els.cfgShowSidebar.checked = true;
      els.cfgShowSearch.checked = false;
      els.cfgShowAnnot.checked = true;
      els.cfgShowText.checked = false;
      saveSettingsFromModal();
      assert.equal(localStorage.getItem('novareader-ui-layout:sidebarHidden'), '0');
      assert.equal(localStorage.getItem('novareader-ui-layout:searchToolsHidden'), '1');
      assert.equal(localStorage.getItem('novareader-ui-layout:annotToolsHidden'), '0');
      assert.equal(localStorage.getItem('novareader-ui-layout:textHidden'), '1');
    });

    it('applies dark theme', () => {
      els.cfgSidebarSections = null;
      els.cfgToolbarSections = null;
      openSettingsModal();
      els.cfgTheme.value = 'dark';
      saveSettingsFromModal();
      assert.equal(localStorage.getItem('novareader-theme'), 'dark');
      assert.equal(document.documentElement.dataset.theme, 'dark');
    });

    it('applies light theme', () => {
      els.cfgSidebarSections = null;
      els.cfgToolbarSections = null;
      openSettingsModal();
      els.cfgTheme.value = 'light';
      saveSettingsFromModal();
      assert.equal(localStorage.getItem('novareader-theme'), 'light');
      assert.ok(document.body.classList.contains('light'));
      assert.equal(document.documentElement.dataset.theme, 'light');
    });

    it('applies sepia theme', () => {
      els.cfgSidebarSections = null;
      els.cfgToolbarSections = null;
      openSettingsModal();
      els.cfgTheme.value = 'sepia';
      saveSettingsFromModal();
      assert.ok(document.body.classList.contains('sepia'));
      assert.equal(document.documentElement.dataset.theme, 'light');
    });

    it('applies high-contrast theme', () => {
      els.cfgSidebarSections = null;
      els.cfgToolbarSections = null;
      openSettingsModal();
      els.cfgTheme.value = 'high-contrast';
      saveSettingsFromModal();
      assert.ok(document.body.classList.contains('high-contrast'));
      assert.equal(document.documentElement.dataset.theme, 'dark');
    });

    it('applies auto theme', () => {
      els.cfgSidebarSections = null;
      els.cfgToolbarSections = null;
      openSettingsModal();
      els.cfgTheme.value = 'auto';
      saveSettingsFromModal();
      assert.ok(document.body.classList.contains('theme-auto'));
      assert.equal(document.documentElement.dataset.theme, 'dark');
    });

    it('saves appLang setting', () => {
      els.cfgSidebarSections = null;
      els.cfgToolbarSections = null;
      openSettingsModal();
      els.cfgAppLang.value = 'en';
      saveSettingsFromModal();
      assert.equal(state.settings.appLang, 'en');
    });

    it('saves ocrLang setting', () => {
      els.cfgSidebarSections = null;
      els.cfgToolbarSections = null;
      openSettingsModal();
      els.cfgOcrLang.value = 'eng';
      saveSettingsFromModal();
      assert.equal(state.settings.ocrLang, 'eng');
    });

    it('saves ocrCyrillicOnly setting', () => {
      els.cfgSidebarSections = null;
      els.cfgToolbarSections = null;
      openSettingsModal();
      els.cfgOcrCyrillicOnly.checked = false;
      saveSettingsFromModal();
      assert.equal(state.settings.ocrCyrillicOnly, false);
    });

    it('saves ocrQualityMode accurate', () => {
      els.cfgSidebarSections = null;
      els.cfgToolbarSections = null;
      openSettingsModal();
      els.cfgOcrQualityMode.value = 'accurate';
      saveSettingsFromModal();
      assert.equal(state.settings.ocrQualityMode, 'accurate');
    });

    it('defaults ocrQualityMode to balanced for unknown values', () => {
      els.cfgSidebarSections = null;
      els.cfgToolbarSections = null;
      openSettingsModal();
      els.cfgOcrQualityMode.value = 'unknown';
      saveSettingsFromModal();
      assert.equal(state.settings.ocrQualityMode, 'balanced');
    });

    it('calls clearOcrRuntimeCaches when quality mode changes', () => {
      els.cfgSidebarSections = null;
      els.cfgToolbarSections = null;
      state.settings.ocrQualityMode = 'balanced';
      openSettingsModal();
      els.cfgOcrQualityMode.value = 'accurate';
      mockDeps.clearOcrRuntimeCaches.mock.resetCalls();
      saveSettingsFromModal();
      assert.ok(mockDeps.clearOcrRuntimeCaches.mock.calls.length >= 1);
    });

    it('does not call clearOcrRuntimeCaches when quality mode unchanged', () => {
      els.cfgSidebarSections = null;
      els.cfgToolbarSections = null;
      state.settings.ocrQualityMode = 'balanced';
      openSettingsModal();
      els.cfgOcrQualityMode.value = 'balanced';
      mockDeps.clearOcrRuntimeCaches.mock.resetCalls();
      saveSettingsFromModal();
      assert.equal(mockDeps.clearOcrRuntimeCaches.mock.calls.length, 0);
    });

    it('saves ocrMinW with clamping', () => {
      els.cfgSidebarSections = null;
      els.cfgToolbarSections = null;
      openSettingsModal();
      els.cfgOcrMinW.value = '3';
      saveSettingsFromModal();
      assert.equal(state.settings.ocrMinW, 8);
    });

    it('saves ocrMinH with clamping', () => {
      els.cfgSidebarSections = null;
      els.cfgToolbarSections = null;
      openSettingsModal();
      els.cfgOcrMinH.value = '2';
      saveSettingsFromModal();
      assert.equal(state.settings.ocrMinH, 8);
    });

    it('saves backgroundOcr setting', () => {
      els.cfgSidebarSections = null;
      els.cfgToolbarSections = null;
      openSettingsModal();
      els.cfgBackgroundOcr.checked = true;
      saveSettingsFromModal();
      assert.equal(state.settings.backgroundOcr, true);
    });

    it('saves UI size settings with clamping', () => {
      els.cfgSidebarSections = null;
      els.cfgToolbarSections = null;
      openSettingsModal();
      els.cfgSidebarWidth.value = '50';  // Below min 160
      els.cfgToolbarScale.value = '200'; // Above max (1 * 100)
      els.cfgPageAreaHeight.value = '100'; // Below min 520
      saveSettingsFromModal();
      assert.equal(state.settings.uiSidebarWidth, 160);
      assert.equal(state.settings.uiToolbarScale, 1);
      assert.equal(state.settings.uiPageAreaPx, 520);
    });

    it('saves uiToolbarTopPx, uiToolbarBottomPx, uiTextPanelPx', () => {
      els.cfgSidebarSections = null;
      els.cfgToolbarSections = null;
      openSettingsModal();
      els.cfgTopToolbarHeight.value = '50';
      els.cfgBottomToolbarHeight.value = '100';
      els.cfgTextPanelHeight.value = '200';
      saveSettingsFromModal();
      assert.equal(state.settings.uiToolbarTopPx, 50);
      assert.equal(state.settings.uiToolbarBottomPx, 100);
      assert.equal(state.settings.uiTextPanelPx, 200);
    });

    it('saves uiAnnotationCanvasScale', () => {
      els.cfgSidebarSections = null;
      els.cfgToolbarSections = null;
      openSettingsModal();
      els.cfgAnnotationCanvasScale.value = '80';
      saveSettingsFromModal();
      assert.equal(state.settings.uiAnnotationCanvasScale, 80);
    });

    it('saves uiTextMinHeight', () => {
      els.cfgSidebarSections = null;
      els.cfgToolbarSections = null;
      openSettingsModal();
      els.cfgTextMinHeight.value = '60';
      saveSettingsFromModal();
      assert.equal(state.settings.uiTextMinHeight, 60);
    });

    it('calls saveAppSettings', () => {
      els.cfgSidebarSections = null;
      els.cfgToolbarSections = null;
      openSettingsModal();
      mockDeps.saveAppSettings.mock.resetCalls();
      saveSettingsFromModal();
      assert.equal(mockDeps.saveAppSettings.mock.calls.length, 1);
    });

    it('calls applyLayoutState', () => {
      els.cfgSidebarSections = null;
      els.cfgToolbarSections = null;
      openSettingsModal();
      mockDeps.applyLayoutState.mock.resetCalls();
      saveSettingsFromModal();
      assert.equal(mockDeps.applyLayoutState.mock.calls.length, 1);
    });

    it('closes the modal after saving', () => {
      els.cfgSidebarSections = null;
      els.cfgToolbarSections = null;
      openSettingsModal();
      saveSettingsFromModal();
      assert.ok(!els.settingsModal.classList.contains('open'));
    });

    it('initializes state.settings from defaultSettings if null', () => {
      els.cfgSidebarSections = null;
      els.cfgToolbarSections = null;
      openSettingsModal();
      state.settings = null;
      saveSettingsFromModal();
      assert.ok(state.settings != null, 'state.settings should be initialized');
      assert.equal(state.settings.appLang, 'ru');
    });

    it('initializes sidebarSections and toolbarSections if missing', () => {
      els.cfgSidebarSections = null;
      els.cfgToolbarSections = null;
      openSettingsModal();
      delete state.settings.sidebarSections;
      delete state.settings.toolbarSections;
      saveSettingsFromModal();
      assert.ok(state.settings.sidebarSections != null);
      assert.ok(state.settings.toolbarSections != null);
    });

    it('reads section checkboxes from DOM into state', () => {
      // Use renderSectionVisibilityControls to populate section checkboxes
      openSettingsModal();

      // Uncheck all sidebar checkboxes
      const sidebarInputs = els.cfgSidebarSections.querySelectorAll('input');
      for (const input of sidebarInputs) {
        input.checked = false;
      }

      // Store the original querySelectorAll to restore later
      const origQSA = document.querySelectorAll;
      // Mock document.querySelectorAll to return the section checkboxes
      document.querySelectorAll = (selector) => {
        if (selector === '#cfgSidebarSections input[data-section-key]') {
          return els.cfgSidebarSections.querySelectorAll('input');
        }
        if (selector === '#cfgToolbarSections input[data-section-key]') {
          return els.cfgToolbarSections.querySelectorAll('input');
        }
        return origQSA.call(document, selector);
      };

      saveSettingsFromModal();

      // Restore
      document.querySelectorAll = origQSA;

      // All sidebar sections should be false
      for (const input of sidebarInputs) {
        assert.equal(
          state.settings.sidebarSections[input.dataset.sectionKey],
          false,
          `${input.dataset.sectionKey} should be false`
        );
      }
    });
  });

  describe('resetUiSizeToDefaults', () => {
    it('resets input values to defaults', () => {
      els.cfgSidebarWidth.value = '300';
      resetUiSizeToDefaults();
      assert.equal(els.cfgSidebarWidth.value, '220');
    });

    it('resets all size inputs', () => {
      els.cfgToolbarScale.value = '50';
      els.cfgTextMinHeight.value = '100';
      els.cfgPageAreaHeight.value = '2000';
      els.cfgTopToolbarHeight.value = '60';
      els.cfgBottomToolbarHeight.value = '200';
      els.cfgTextPanelHeight.value = '300';
      els.cfgAnnotationCanvasScale.value = '50';
      resetUiSizeToDefaults();
      assert.equal(els.cfgToolbarScale.value, '100');
      assert.equal(els.cfgTextMinHeight.value, '40');
      assert.equal(els.cfgPageAreaHeight.value, '860');
      assert.equal(els.cfgTopToolbarHeight.value, '34');
      assert.equal(els.cfgBottomToolbarHeight.value, '86');
      assert.equal(els.cfgTextPanelHeight.value, '120');
      assert.equal(els.cfgAnnotationCanvasScale.value, '90');
    });

    it('does nothing when defaultSettings dep is null', () => {
      initSettingsUiDeps({ defaultSettings: null });
      assert.doesNotThrow(() => resetUiSizeToDefaults());
    });
  });

  describe('applySectionVisibilitySettings', () => {
    it('does not throw with no section elements', () => {
      assert.doesNotThrow(() => applySectionVisibilitySettings());
    });
  });
});
