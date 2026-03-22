// @ts-check
// ─── Export Controller (Orchestrator) ────────────────────────────────────────
// Thin orchestrator that re-exports from focused sub-modules:
//   - export-docx.js:  DOCX XML builders, styles, blob generation, import parsing
//   - export-image.js: Image capture, DOCX-with-images generation
//   - export-text.js:  DOCX import workflow, session health report
//
// Page edit state and edit functions remain here as they are used across modules.

import { state } from './state.js';
import { pushDiagnosticEvent } from './diagnostics.js';
import { initExportImageDeps } from './export-image.js';
import { initExportTextDeps } from './export-text.js';

// ─── Re-exports from export-docx.js ────────────────────────────────────────
export {
  buildDocxXml, buildDocxTable, buildDocxStyles, buildDocxNumbering,
  buildDocxSettings, buildCoreProperties, buildContentTypes, buildRels,
  buildWordRels, crc32, generateDocxBlob, extractDocumentXmlFromZip,
  parseDocxTextByPages, createZipBlob,
} from './export-docx.js';

// ─── Re-exports from export-image.js ───────────────────────────────────────
export {
  capturePageAsImageData, buildDocxImageParagraph, generateDocxWithImages,
  _groupWordsIntoLines, buildDocxXmlWithImages, buildContentTypesWithImages,
  buildWordRelsWithImages,
} from './export-image.js';

// ─── Re-exports from export-text.js ────────────────────────────────────────
export {
  importDocxEdits, exportSessionHealthReport,
} from './export-text.js';

// ─── PDF Edit State (module-local) ─────────────────────────────────────────
export const pdfEditState = {
  edits: new Map(),
  undoStack: [],
  redoStack: [],
  maxHistory: 100,
  dirty: false,
};

// ─── Late-bound dependencies ────────────────────────────────────────────────
// These are injected from app.js to avoid circular imports.
const _deps = {
  setOcrStatus: () => {},
  getCachedPage: () => null,
  getOcrLang: () => 'rus',
  _ocrWordCache: new Map(),
};

/**
 * Inject runtime dependencies that live in app.js.
 * Must be called once during startup before any export functions are used.
 * Forwards relevant deps to sub-modules.
 */
export function initExportControllerDeps(deps) {
  Object.assign(_deps, deps);
  // Forward deps to sub-modules
  initExportImageDeps({
    getCachedPage: deps.getCachedPage,
    _ocrWordCache: deps._ocrWordCache,
  });
  initExportTextDeps({
    setOcrStatus: deps.setOcrStatus,
    getOcrLang: deps.getOcrLang,
  });
}

// ─── Page Edit Functions ────────────────────────────────────────────────────

export function getPageEdits(pageNum) {
  return pdfEditState.edits.get(pageNum) || '';
}

export function setPageEdits(pageNum, text) {
  const oldText = pdfEditState.edits.get(pageNum) || '';
  if (oldText === text) return;

  pdfEditState.undoStack.push({ page: pageNum, text: oldText, ts: Date.now() });
  if (pdfEditState.undoStack.length > pdfEditState.maxHistory) {
    pdfEditState.undoStack.shift();
  }
  pdfEditState.redoStack = [];

  pdfEditState.edits.set(pageNum, text);
  pdfEditState.dirty = true;
  pushDiagnosticEvent('pdf-edit.change', { page: pageNum, length: text.length });
}

export function undoPageEdit() {
  if (!pdfEditState.undoStack.length) return null;
  const action = pdfEditState.undoStack.pop();
  const currentText = pdfEditState.edits.get(action.page) || '';
  pdfEditState.redoStack.push({ page: action.page, text: currentText, ts: Date.now() });
  pdfEditState.edits.set(action.page, action.text);
  pdfEditState.dirty = true;
  pushDiagnosticEvent('pdf-edit.undo', { page: action.page });
  return action;
}

export function redoPageEdit() {
  if (!pdfEditState.redoStack.length) return null;
  const action = pdfEditState.redoStack.pop();
  const currentText = pdfEditState.edits.get(action.page) || '';
  pdfEditState.undoStack.push({ page: action.page, text: currentText, ts: Date.now() });
  pdfEditState.edits.set(action.page, action.text);
  pdfEditState.dirty = true;
  pushDiagnosticEvent('pdf-edit.redo', { page: action.page });
  return action;
}

export function getEditHistory() {
  return {
    undoCount: pdfEditState.undoStack.length,
    redoCount: pdfEditState.redoStack.length,
    editedPages: [...pdfEditState.edits.keys()],
    dirty: pdfEditState.dirty,
  };
}

export function clearEditHistory() {
  pdfEditState.undoStack = [];
  pdfEditState.redoStack = [];
  pdfEditState.dirty = false;
}

export function persistEdits() {
  if (!state.docName) return;
  const key = `nr-edits-${state.docName}`;
  const payload = {
    edits: Object.fromEntries(pdfEditState.edits),
    updatedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(key, JSON.stringify(payload));
    pdfEditState.dirty = false;
  } catch (err) { console.warn('[app] storage quota exceeded:', err?.message); }
}

export function loadPersistedEdits() {
  if (!state.docName) return;
  const key = `nr-edits-${state.docName}`;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed?.edits && typeof parsed.edits === 'object') {
      for (const [page, text] of Object.entries(parsed.edits)) {
        pdfEditState.edits.set(Number(page), text);
      }
    }
  } catch (err) { console.warn('[app] non-critical error:', err?.message); }
}
