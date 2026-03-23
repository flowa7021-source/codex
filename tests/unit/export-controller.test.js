// ─── Unit Tests: Export Controller ───────────────────────────────────────────
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { state } from '../../app/modules/state.js';

import {
  pdfEditState,
  initExportControllerDeps,
  getPageEdits,
  setPageEdits,
  undoPageEdit,
  redoPageEdit,
  getEditHistory,
  clearEditHistory,
  persistEdits,
  loadPersistedEdits,
} from '../../app/modules/export-controller.js';

// ─── Setup ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  pdfEditState.edits.clear();
  pdfEditState.undoStack = [];
  pdfEditState.redoStack = [];
  pdfEditState.dirty = false;
  state.docName = '';
  localStorage.clear();
});

// ─── pdfEditState ───────────────────────────────────────────────────────────

describe('pdfEditState', () => {
  it('has correct initial values', () => {
    assert.ok(pdfEditState.edits instanceof Map);
    assert.equal(pdfEditState.maxHistory, 100);
    assert.equal(pdfEditState.dirty, false);
  });
});

// ─── initExportControllerDeps ───────────────────────────────────────────────

describe('initExportControllerDeps', () => {
  it('injects deps without throwing', () => {
    assert.doesNotThrow(() => {
      initExportControllerDeps({
        setOcrStatus: () => {},
        getCachedPage: () => null,
        getOcrLang: () => 'eng',
        _ocrWordCache: new Map(),
      });
    });
  });
});

// ─── getPageEdits ───────────────────────────────────────────────────────────

describe('getPageEdits', () => {
  it('returns empty string for non-existent page', () => {
    assert.equal(getPageEdits(1), '');
  });

  it('returns stored text for existing page', () => {
    pdfEditState.edits.set(5, 'hello world');
    assert.equal(getPageEdits(5), 'hello world');
  });
});

// ─── setPageEdits ───────────────────────────────────────────────────────────

describe('setPageEdits', () => {
  it('stores text in edits map', () => {
    setPageEdits(1, 'new text');
    assert.equal(pdfEditState.edits.get(1), 'new text');
  });

  it('marks state as dirty', () => {
    setPageEdits(1, 'abc');
    assert.equal(pdfEditState.dirty, true);
  });

  it('pushes undo entry with old text', () => {
    pdfEditState.edits.set(1, 'old');
    setPageEdits(1, 'new');
    assert.equal(pdfEditState.undoStack.length, 1);
    assert.equal(pdfEditState.undoStack[0].text, 'old');
    assert.equal(pdfEditState.undoStack[0].page, 1);
  });

  it('clears redo stack on new edit', () => {
    pdfEditState.redoStack.push({ page: 1, text: 'x', ts: Date.now() });
    setPageEdits(1, 'y');
    assert.equal(pdfEditState.redoStack.length, 0);
  });

  it('does nothing when text is unchanged', () => {
    pdfEditState.edits.set(1, 'same');
    setPageEdits(1, 'same');
    assert.equal(pdfEditState.undoStack.length, 0);
    assert.equal(pdfEditState.dirty, false);
  });

  it('trims undo stack beyond maxHistory', () => {
    pdfEditState.maxHistory = 3;
    for (let i = 0; i < 5; i++) {
      setPageEdits(1, `text-${i}`);
    }
    assert.equal(pdfEditState.undoStack.length, 3);
    // Restore default
    pdfEditState.maxHistory = 100;
  });
});

// ─── undoPageEdit ───────────────────────────────────────────────────────────

describe('undoPageEdit', () => {
  it('returns null when undo stack is empty', () => {
    assert.equal(undoPageEdit(), null);
  });

  it('restores previous text and returns action', () => {
    setPageEdits(1, 'version1');
    setPageEdits(1, 'version2');
    const action = undoPageEdit();
    assert.ok(action);
    assert.equal(action.page, 1);
    assert.equal(action.text, 'version1');
    assert.equal(pdfEditState.edits.get(1), 'version1');
  });

  it('pushes current text onto redo stack', () => {
    setPageEdits(1, 'v1');
    setPageEdits(1, 'v2');
    undoPageEdit();
    assert.equal(pdfEditState.redoStack.length, 1);
    assert.equal(pdfEditState.redoStack[0].text, 'v2');
  });

  it('sets dirty flag', () => {
    setPageEdits(1, 'abc');
    pdfEditState.dirty = false;
    undoPageEdit();
    assert.equal(pdfEditState.dirty, true);
  });
});

// ─── redoPageEdit ───────────────────────────────────────────────────────────

describe('redoPageEdit', () => {
  it('returns null when redo stack is empty', () => {
    assert.equal(redoPageEdit(), null);
  });

  it('restores text from redo stack', () => {
    setPageEdits(1, 'v1');
    setPageEdits(1, 'v2');
    undoPageEdit();
    const action = redoPageEdit();
    assert.ok(action);
    assert.equal(action.text, 'v2');
    assert.equal(pdfEditState.edits.get(1), 'v2');
  });

  it('pushes current text onto undo stack', () => {
    setPageEdits(1, 'v1');
    setPageEdits(1, 'v2');
    undoPageEdit();
    const undoBefore = pdfEditState.undoStack.length;
    redoPageEdit();
    assert.equal(pdfEditState.undoStack.length, undoBefore + 1);
  });

  it('sets dirty flag', () => {
    setPageEdits(1, 'abc');
    undoPageEdit();
    pdfEditState.dirty = false;
    redoPageEdit();
    assert.equal(pdfEditState.dirty, true);
  });
});

// ─── getEditHistory ─────────────────────────────────────────────────────────

describe('getEditHistory', () => {
  it('returns counts and dirty flag', () => {
    const history = getEditHistory();
    assert.equal(history.undoCount, 0);
    assert.equal(history.redoCount, 0);
    assert.deepEqual(history.editedPages, []);
    assert.equal(history.dirty, false);
  });

  it('reflects edits', () => {
    setPageEdits(3, 'text');
    setPageEdits(5, 'more');
    const history = getEditHistory();
    assert.equal(history.undoCount, 2);
    assert.equal(history.dirty, true);
    assert.ok(history.editedPages.includes(3));
    assert.ok(history.editedPages.includes(5));
  });
});

// ─── clearEditHistory ───────────────────────────────────────────────────────

describe('clearEditHistory', () => {
  it('resets undo/redo stacks and dirty flag', () => {
    setPageEdits(1, 'text');
    clearEditHistory();
    assert.equal(pdfEditState.undoStack.length, 0);
    assert.equal(pdfEditState.redoStack.length, 0);
    assert.equal(pdfEditState.dirty, false);
  });
});

// ─── persistEdits ───────────────────────────────────────────────────────────

describe('persistEdits', () => {
  it('does nothing when docName is empty', () => {
    state.docName = '';
    pdfEditState.edits.set(1, 'test');
    persistEdits();
    assert.equal(localStorage.length, 0);
  });

  it('saves edits to localStorage', () => {
    state.docName = 'test.pdf';
    pdfEditState.edits.set(1, 'page one');
    pdfEditState.dirty = true;
    persistEdits();
    const stored = JSON.parse(localStorage.getItem('nr-edits-test.pdf'));
    assert.equal(stored.edits['1'], 'page one');
    assert.ok(stored.updatedAt);
    assert.equal(pdfEditState.dirty, false);
  });
});

// ─── loadPersistedEdits ─────────────────────────────────────────────────────

describe('loadPersistedEdits', () => {
  it('does nothing when docName is empty', () => {
    state.docName = '';
    loadPersistedEdits();
    assert.equal(pdfEditState.edits.size, 0);
  });

  it('does nothing when no stored data', () => {
    state.docName = 'missing.pdf';
    loadPersistedEdits();
    assert.equal(pdfEditState.edits.size, 0);
  });

  it('restores edits from localStorage', () => {
    state.docName = 'test.pdf';
    localStorage.setItem('nr-edits-test.pdf', JSON.stringify({
      edits: { '1': 'restored text', '3': 'page three' },
      updatedAt: new Date().toISOString(),
    }));
    loadPersistedEdits();
    assert.equal(pdfEditState.edits.get(1), 'restored text');
    assert.equal(pdfEditState.edits.get(3), 'page three');
  });

  it('handles corrupted JSON gracefully', () => {
    state.docName = 'bad.pdf';
    localStorage.setItem('nr-edits-bad.pdf', 'not valid json{{{');
    assert.doesNotThrow(() => loadPersistedEdits());
  });

  it('handles missing edits field gracefully', () => {
    state.docName = 'empty.pdf';
    localStorage.setItem('nr-edits-empty.pdf', JSON.stringify({ updatedAt: 'x' }));
    assert.doesNotThrow(() => loadPersistedEdits());
  });
});
