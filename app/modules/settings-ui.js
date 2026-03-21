/**
 * settings-ui.js
 * Settings modal UI functions extracted from app.js.
 */

import { state, els } from './state.js';
import { SIDEBAR_SECTION_CONFIG, TOOLBAR_SECTION_CONFIG } from './constants.js';

/* Late-bound cross-module dependencies */
const _deps = {
  uiLayoutKey: null,
  refreshOcrStorageInfo: null,
  applyUiSizeSettings: null,
  defaultSettings: null,
  saveAppSettings: null,
  clearOcrRuntimeCaches: null,
  applyLayoutState: null,
  applyLayoutWithTransition: null,
};

export function initSettingsUiDeps(deps) {
  Object.assign(_deps, deps);
}

export function applyAppLanguage() {
  const lang = state.settings?.appLang || 'ru';
  const t = {
    ru: {
      openSettings: 'Настройки',
      ocrPage: 'OCR',
      copyOcr: '📋 OCR',
      searchBtn: 'Найти',
      pageTextPlaceholder: 'Текст страницы',
      settingsTitle: 'Настройки',
      saveSettings: 'Сохранить',
    },
    en: {
      openSettings: 'Settings',
      ocrPage: 'OCR',
      copyOcr: '📋 OCR',
      searchBtn: 'Search',
      pageTextPlaceholder: 'Page text',
      settingsTitle: 'Settings',
      saveSettings: 'Save',
    },
  }[lang] || {};

  if (els.openSettingsModal) {
    els.openSettingsModal.textContent = '⚙';
    els.openSettingsModal.title = t.openSettings || 'Settings';
    els.openSettingsModal.setAttribute('aria-label', t.openSettings || 'Settings');
  }
  if (els.ocrCurrentPage) els.ocrCurrentPage.textContent = t.ocrPage;
  if (els.copyOcrText) els.copyOcrText.textContent = t.copyOcr;
  if (els.searchBtn) els.searchBtn.textContent = t.searchBtn;
  // Icon buttons (↑↓↔⊡⬇🖨) — not overridden by language
  if (els.pageText) els.pageText.placeholder = t.pageTextPlaceholder;
  if (els.saveSettingsModal) els.saveSettingsModal.textContent = t.saveSettings;
  const modalTitle = document.querySelector('#settingsModal .modal-head h3');
  if (modalTitle) modalTitle.textContent = t.settingsTitle;

  if (els.ocrRegionMode) {
    els.ocrRegionMode.classList.toggle('active', state.ocrRegionMode);
  }
}

export function renderSectionVisibilityControls() {
  if (els.cfgSidebarSections) {
    els.cfgSidebarSections.innerHTML = '<h5>Сайдбар</h5>';
    SIDEBAR_SECTION_CONFIG.forEach((cfg) => {
      const label = document.createElement('label');
      label.className = 'checkbox-row';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.dataset.sectionType = 'sidebar';
      input.dataset.sectionKey = cfg.key;
      input.checked = (state.settings?.sidebarSections?.[cfg.key] ?? true);
      label.appendChild(input);
      label.append(` ${cfg.label}`);
      els.cfgSidebarSections.appendChild(label);
    });
  }

  if (els.cfgToolbarSections) {
    els.cfgToolbarSections.innerHTML = '<h5>Тулбар</h5>';
    TOOLBAR_SECTION_CONFIG.forEach((cfg) => {
      const label = document.createElement('label');
      label.className = 'checkbox-row';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.dataset.sectionType = 'toolbar';
      input.dataset.sectionKey = cfg.key;
      input.checked = (state.settings?.toolbarSections?.[cfg.key] ?? true);
      label.appendChild(input);
      label.append(` ${cfg.label}`);
      els.cfgToolbarSections.appendChild(label);
    });
  }
}

export function applySectionVisibilitySettings() {
  const sidebar = state.settings?.sidebarSections || {};
  const toolbar = state.settings?.toolbarSections || {};

  document.querySelectorAll('[data-sidebar-section]').forEach((node) => {
    const key = node.dataset.sidebarSection;
    const visible = sidebar[key] ?? true;
    node.classList.toggle('section-hidden', !visible);
  });

  document.querySelectorAll('[data-toolbar-section]').forEach((node) => {
    const key = node.dataset.toolbarSection;
    const visible = toolbar[key] ?? true;
    node.classList.toggle('section-hidden', !visible);
  });
}


/** All UI size input IDs that should trigger live preview on change */
const _uiSizeInputIds = [
  'cfgSidebarWidth', 'cfgToolbarScale', 'cfgTextMinHeight',
  'cfgPageAreaHeight', 'cfgTopToolbarHeight', 'cfgBottomToolbarHeight',
  'cfgTextPanelHeight', 'cfgAnnotationCanvasScale',
];

/** Snapshot of settings before modal opened, for cancel/revert */
let _settingsSnapshot = null;

/** Abort controller for live-preview event listeners */
let _previewAbort = null;

export function openSettingsModal() {
  if (!els.settingsModal) return;

  // Snapshot current state for revert on close without save
  _settingsSnapshot = {
    settings: state.settings ? JSON.parse(JSON.stringify(state.settings)) : null,
  };

  const sidebarHidden = localStorage.getItem(_deps.uiLayoutKey('sidebarHidden')) === '1';
  const searchHidden = localStorage.getItem(_deps.uiLayoutKey('searchToolsHidden')) === '1';
  const annotHidden = localStorage.getItem(_deps.uiLayoutKey('annotToolsHidden')) === '1';
  const textHidden = localStorage.getItem(_deps.uiLayoutKey('textHidden')) === '1';

  if (els.cfgShowSidebar) els.cfgShowSidebar.checked = !sidebarHidden;
  if (els.cfgShowSearch) els.cfgShowSearch.checked = !searchHidden;
  if (els.cfgShowAnnot) els.cfgShowAnnot.checked = !annotHidden;
  if (els.cfgShowText) els.cfgShowText.checked = !textHidden;
  if (els.cfgTheme) els.cfgTheme.value = document.body.classList.contains('light') ? 'light' : 'dark';
  if (els.cfgAppLang) els.cfgAppLang.value = state.settings?.appLang || 'ru';
  if (els.cfgOcrLang) els.cfgOcrLang.value = state.settings?.ocrLang || 'auto';
  if (els.cfgOcrCyrillicOnly) els.cfgOcrCyrillicOnly.checked = state.settings?.ocrCyrillicOnly !== false;
  if (els.cfgOcrQualityMode) els.cfgOcrQualityMode.value = state.settings?.ocrQualityMode || 'balanced';
  if (els.cfgOcrMinW) els.cfgOcrMinW.value = String(state.settings?.ocrMinW || 24);
  if (els.cfgOcrMinH) els.cfgOcrMinH.value = String(state.settings?.ocrMinH || 24);
  if (els.cfgBackgroundOcr) els.cfgBackgroundOcr.checked = !!state.settings?.backgroundOcr;
  if (els.cfgSidebarWidth) els.cfgSidebarWidth.value = String(state.settings?.uiSidebarWidth || 220);
  if (els.cfgToolbarScale) els.cfgToolbarScale.value = String(Math.round((state.settings?.uiToolbarScale || 1) * 100));
  if (els.cfgTextMinHeight) els.cfgTextMinHeight.value = String(state.settings?.uiTextMinHeight || 40);
  if (els.cfgPageAreaHeight) els.cfgPageAreaHeight.value = String(state.settings?.uiPageAreaPx || 860);
  if (els.cfgTopToolbarHeight) els.cfgTopToolbarHeight.value = String(state.settings?.uiToolbarTopPx || 34);
  if (els.cfgBottomToolbarHeight) els.cfgBottomToolbarHeight.value = String(state.settings?.uiToolbarBottomPx || 86);
  if (els.cfgTextPanelHeight) els.cfgTextPanelHeight.value = String(state.settings?.uiTextPanelPx || 120);
  if (els.cfgAnnotationCanvasScale) els.cfgAnnotationCanvasScale.value = String(state.settings?.uiAnnotationCanvasScale || 90);
  renderSectionVisibilityControls();
  previewUiSizeFromModal();

  els.settingsModal.classList.add('open');
  els.settingsModal.setAttribute('aria-hidden', 'false');

  // Add zone highlight indicators
  document.body.classList.add('settings-modal-open');

  // Wire up real-time preview: listen for input events on all size sliders
  if (_previewAbort) _previewAbort.abort();
  _previewAbort = new AbortController();
  const psignal = _previewAbort.signal;
  _uiSizeInputIds.forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', () => previewUiSizeFromModal(), { signal: psignal });
    }
  });

  // Populate OCR storage info when modal opens
  if (typeof _deps.refreshOcrStorageInfo === 'function') _deps.refreshOcrStorageInfo();
}

export function closeSettingsModal(saved = false) {
  if (!els.settingsModal) return;
  els.settingsModal.classList.remove('open');
  els.settingsModal.setAttribute('aria-hidden', 'true');

  // Remove zone highlight indicators
  document.body.classList.remove('settings-modal-open');

  // Tear down live-preview listeners
  if (_previewAbort) { _previewAbort.abort(); _previewAbort = null; }

  // If modal closed without saving, revert to snapshot
  if (!saved && _settingsSnapshot?.settings) {
    state.settings = _settingsSnapshot.settings;
  }
  _settingsSnapshot = null;

  // Re-apply persisted settings and add smooth transition
  if (typeof _deps.applyLayoutWithTransition === 'function') _deps.applyLayoutWithTransition();
  _deps.applyUiSizeSettings();
}

export function readUiSizeSettingsFromModal() {
  return {
    sidebar: Math.max(160, Math.min(360, Number(els.cfgSidebarWidth?.value) || 220)),
    toolbarScale: Math.max(0.1, Math.min(1, (Number(els.cfgToolbarScale?.value) || 100) / 100)),
    textMin: Math.max(24, Math.min(180, Number(els.cfgTextMinHeight?.value) || 40)),
    pageArea: Math.max(520, Math.min(2600, Number(els.cfgPageAreaHeight?.value) || 860)),
    topToolbar: Math.max(28, Math.min(72, Number(els.cfgTopToolbarHeight?.value) || 34)),
    bottomToolbar: Math.max(48, Math.min(220, Number(els.cfgBottomToolbarHeight?.value) || 86)),
    textPanel: Math.max(72, Math.min(360, Number(els.cfgTextPanelHeight?.value) || 120)),
    annotationScale: Math.max(50, Math.min(100, Number(els.cfgAnnotationCanvasScale?.value) || 90)),
  };
}

export function previewUiSizeFromModal() {
  if (!els.settingsModal?.classList.contains('open')) return;
  const values = readUiSizeSettingsFromModal();
  document.documentElement.style.setProperty('--ui-toolbar-scale', String(values.toolbarScale));
  document.documentElement.style.setProperty('--ui-text-min-height', `${Math.round(values.textMin)}px`);
  document.querySelector('.app-shell')?.style.setProperty('--sidebar-width', `${Math.round(values.sidebar)}px`);
  document.querySelector('.viewer-area')?.style.setProperty('--page-area-height', `${Math.round(values.pageArea)}px`);
  document.documentElement.style.setProperty('--ui-toolbar-top-height', `${Math.round(values.topToolbar)}px`);
  document.documentElement.style.setProperty('--ui-toolbar-bottom-height', `${Math.round(values.bottomToolbar)}px`);
  document.documentElement.style.setProperty('--ui-text-panel-height', `${Math.round(values.textPanel)}px`);
  document.documentElement.style.setProperty('--ui-annotation-canvas-scale', (values.annotationScale / 100).toFixed(2));
}

export function saveSettingsFromModal() {
  const setHidden = (k, show) => localStorage.setItem(_deps.uiLayoutKey(k), show ? '0' : '1');
  if (els.cfgShowSidebar) setHidden('sidebarHidden', els.cfgShowSidebar.checked);
  if (els.cfgShowSearch) setHidden('searchToolsHidden', els.cfgShowSearch.checked);
  if (els.cfgShowAnnot) setHidden('annotToolsHidden', els.cfgShowAnnot.checked);
  if (els.cfgShowText) setHidden('textHidden', els.cfgShowText.checked);

  if (els.cfgTheme) {
    document.body.classList.toggle('light', els.cfgTheme.value === 'light');
    localStorage.setItem('novareader-theme', els.cfgTheme.value === 'light' ? 'light' : 'dark');
  }

  state.settings = state.settings || _deps.defaultSettings();
  const prevOcrQualityMode = state.settings.ocrQualityMode || 'balanced';
  if (els.cfgAppLang) state.settings.appLang = els.cfgAppLang.value || 'ru';
  if (els.cfgOcrLang) state.settings.ocrLang = els.cfgOcrLang.value || 'auto';
  if (els.cfgOcrCyrillicOnly) state.settings.ocrCyrillicOnly = !!els.cfgOcrCyrillicOnly.checked;
  if (els.cfgOcrQualityMode) state.settings.ocrQualityMode = els.cfgOcrQualityMode.value === 'accurate' ? 'accurate' : 'balanced';
  if ((state.settings.ocrQualityMode || 'balanced') !== prevOcrQualityMode) _deps.clearOcrRuntimeCaches('ocr-quality-mode-changed');
  if (els.cfgOcrMinW) state.settings.ocrMinW = Math.max(8, Number(els.cfgOcrMinW.value) || 24);
  if (els.cfgOcrMinH) state.settings.ocrMinH = Math.max(8, Number(els.cfgOcrMinH.value) || 24);
  if (els.cfgBackgroundOcr) state.settings.backgroundOcr = !!els.cfgBackgroundOcr.checked;
  if (els.cfgSidebarWidth) state.settings.uiSidebarWidth = Math.max(160, Math.min(360, Number(els.cfgSidebarWidth.value) || 220));
  if (els.cfgToolbarScale) state.settings.uiToolbarScale = Math.max(0.1, Math.min(1, (Number(els.cfgToolbarScale.value) || 100) / 100));
  if (els.cfgTextMinHeight) state.settings.uiTextMinHeight = Math.max(24, Math.min(180, Number(els.cfgTextMinHeight.value) || 40));
  if (els.cfgPageAreaHeight) state.settings.uiPageAreaPx = Math.max(520, Math.min(2600, Number(els.cfgPageAreaHeight.value) || 860));
  if (els.cfgTopToolbarHeight) state.settings.uiToolbarTopPx = Math.max(28, Math.min(72, Number(els.cfgTopToolbarHeight.value) || 34));
  if (els.cfgBottomToolbarHeight) state.settings.uiToolbarBottomPx = Math.max(48, Math.min(220, Number(els.cfgBottomToolbarHeight.value) || 86));
  if (els.cfgTextPanelHeight) state.settings.uiTextPanelPx = Math.max(72, Math.min(360, Number(els.cfgTextPanelHeight.value) || 120));
  if (els.cfgAnnotationCanvasScale) state.settings.uiAnnotationCanvasScale = Math.max(50, Math.min(100, Number(els.cfgAnnotationCanvasScale.value) || 90));

  if (!state.settings.sidebarSections) state.settings.sidebarSections = {};
  if (!state.settings.toolbarSections) state.settings.toolbarSections = {};
  document.querySelectorAll('#cfgSidebarSections input[data-section-key]').forEach((input) => {
    state.settings.sidebarSections[input.dataset.sectionKey] = !!input.checked;
  });
  document.querySelectorAll('#cfgToolbarSections input[data-section-key]').forEach((input) => {
    state.settings.toolbarSections[input.dataset.sectionKey] = !!input.checked;
  });

  _deps.saveAppSettings();
  if (typeof _deps.applyLayoutWithTransition === 'function') _deps.applyLayoutWithTransition();
  _deps.applyUiSizeSettings();
  applyAppLanguage();
  _deps.applyLayoutState();
  applySectionVisibilitySettings();
  closeSettingsModal(true);
}

/**
 * Reset all UI size settings to defaults and update the modal inputs accordingly.
 */
export function resetUiSizeToDefaults() {
  if (!_deps.defaultSettings) return;
  const defaults = _deps.defaultSettings();
  if (els.cfgSidebarWidth) els.cfgSidebarWidth.value = String(defaults.uiSidebarWidth);
  if (els.cfgToolbarScale) els.cfgToolbarScale.value = String(Math.round((defaults.uiToolbarScale || 1) * 100));
  if (els.cfgTextMinHeight) els.cfgTextMinHeight.value = String(defaults.uiTextMinHeight);
  if (els.cfgPageAreaHeight) els.cfgPageAreaHeight.value = String(defaults.uiPageAreaPx);
  if (els.cfgTopToolbarHeight) els.cfgTopToolbarHeight.value = String(defaults.uiToolbarTopPx);
  if (els.cfgBottomToolbarHeight) els.cfgBottomToolbarHeight.value = String(defaults.uiToolbarBottomPx);
  if (els.cfgTextPanelHeight) els.cfgTextPanelHeight.value = String(defaults.uiTextPanelPx);
  if (els.cfgAnnotationCanvasScale) els.cfgAnnotationCanvasScale.value = String(defaults.uiAnnotationCanvasScale);
  // Immediately preview defaults
  previewUiSizeFromModal();
}
