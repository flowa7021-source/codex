// @ts-check
// ─── Tool State Machine Module ───────────────────────────────────────────────
// Self-contained tool mode management with dependency injection.

import { state, els } from './state.js';
import { pushDiagnosticEvent } from './diagnostics.js';

// Dependencies injected from app.js at runtime
const _deps = {
  renderAnnotations: () => {},
  updateOverlayInteractionState: () => {},
  setOcrStatus: () => {},
  activateEraseOverlay: () => {},
  deactivateEraseOverlay: () => {},
};

export function initToolModeDeps(deps) {
  Object.assign(_deps, deps);
}

export const ToolMode = {
  IDLE: 'idle',
  ANNOTATE: 'annotate',
  OCR_REGION: 'ocr-region',
  TEXT_EDIT: 'text-edit',
  SEARCH: 'search',
  ERASE: 'erase',
};

export const toolStateMachine = {
  current: ToolMode.IDLE,
  previous: ToolMode.IDLE,
  listeners: [],

  transition(newMode) {
    if (newMode === this.current) return;
    const oldMode = this.current;
    this.previous = oldMode;
    this.current = newMode;

    if (oldMode === ToolMode.ANNOTATE) deactivateAnnotateMode();
    if (oldMode === ToolMode.OCR_REGION) deactivateOcrRegionMode();
    if (oldMode === ToolMode.TEXT_EDIT) deactivateTextEditMode();
    if (oldMode === ToolMode.SEARCH) deactivateSearchMode();
    if (oldMode === ToolMode.ERASE) deactivateEraseMode();

    if (newMode === ToolMode.ANNOTATE) activateAnnotateMode();
    if (newMode === ToolMode.OCR_REGION) activateOcrRegionMode();
    if (newMode === ToolMode.TEXT_EDIT) activateTextEditMode();
    if (newMode === ToolMode.SEARCH) activateSearchMode();
    if (newMode === ToolMode.ERASE) activateEraseMode();

    pushDiagnosticEvent('tool.transition', { from: oldMode, to: newMode });
    for (const fn of this.listeners) fn(newMode, oldMode);
  },

  toggle(mode) {
    this.transition(this.current === mode ? ToolMode.IDLE : mode);
  },

  onTransition(fn) {
    this.listeners.push(fn);
  },
};

export function deactivateAnnotateMode() {
  state.drawEnabled = false;
  if (els.annotateToggle) {
    els.annotateToggle.classList.remove('active');
    els.annotateToggle.textContent = '✎ off';
  }
  _deps.renderAnnotations();
}

export function activateAnnotateMode() {
  state.drawEnabled = true;
  if (els.annotateToggle) {
    els.annotateToggle.classList.add('active');
    els.annotateToggle.textContent = '✎ on';
  }
  _deps.updateOverlayInteractionState();
}

export function deactivateOcrRegionMode() {
  state.ocrRegionMode = false;
  state.isSelectingOcr = false;
  state.ocrSelection = null;
  if (els.ocrRegionMode) els.ocrRegionMode.classList.remove('active');
  _deps.renderAnnotations();
}

export function activateOcrRegionMode() {
  state.ocrRegionMode = true;
  if (els.ocrRegionMode) els.ocrRegionMode.classList.add('active');
  _deps.updateOverlayInteractionState();
  // @ts-ignore - setOcrStatus accepts a string message
  _deps.setOcrStatus('OCR: выделите область на странице');
}

export function deactivateTextEditMode() {
  state.textEditMode = false;
  if (els.pageText) /** @type {any} */ (els.pageText).readOnly = true;
  if (els.toggleTextEdit) {
    els.toggleTextEdit.textContent = 'Ред.';
    els.toggleTextEdit.classList.remove('active');
  }
}

export function activateTextEditMode() {
  state.textEditMode = true;
  if (els.pageText) /** @type {any} */ (els.pageText).readOnly = false;
  if (els.toggleTextEdit) {
    els.toggleTextEdit.textContent = 'Ред.';
    els.toggleTextEdit.classList.add('active');
  }
}

export function deactivateSearchMode() {
  // Search mode deactivation is passive - just unfocus
}

export function activateSearchMode() {
  if (els.searchInput) els.searchInput.focus();
}

export function deactivateEraseMode() {
  state.eraseMode = false;
  const btn = document.getElementById('eraseTool');
  if (btn) btn.classList.remove('active');
  _deps.deactivateEraseOverlay();
  _deps.updateOverlayInteractionState();
}

export function activateEraseMode() {
  state.eraseMode = true;
  const btn = document.getElementById('eraseTool');
  if (btn) btn.classList.add('active');
  _deps.activateEraseOverlay();
  _deps.updateOverlayInteractionState();
  pushDiagnosticEvent('erase.activated', {});
}
