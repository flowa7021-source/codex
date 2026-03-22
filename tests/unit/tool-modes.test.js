// ─── Unit Tests: ToolModes ─────────────────────────────────────────────────
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  ToolMode,
  toolStateMachine,
  initToolModeDeps,
  activateAnnotateMode,
  deactivateAnnotateMode,
  activateOcrRegionMode,
  deactivateOcrRegionMode,
  activateTextEditMode,
  deactivateTextEditMode,
  deactivateSearchMode,
  activateSearchMode,
  activateEraseMode,
  deactivateEraseMode,
} from '../../app/modules/tool-modes.js';
import { state, els } from '../../app/modules/state.js';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeMockDeps() {
  return {
    renderAnnotations: () => {},
    updateOverlayInteractionState: () => {},
    setOcrStatus: () => {},
    activateEraseOverlay: () => {},
    deactivateEraseOverlay: () => {},
  };
}

function resetMachine() {
  toolStateMachine.current = ToolMode.IDLE;
  toolStateMachine.previous = ToolMode.IDLE;
  toolStateMachine.listeners.length = 0;
}

// ── ToolMode Constants ─────────────────────────────────────────────────────

describe('ToolMode constants', () => {
  it('defines IDLE', () => {
    assert.equal(ToolMode.IDLE, 'idle');
  });

  it('defines ANNOTATE', () => {
    assert.equal(ToolMode.ANNOTATE, 'annotate');
  });

  it('defines OCR_REGION', () => {
    assert.equal(ToolMode.OCR_REGION, 'ocr-region');
  });

  it('defines TEXT_EDIT', () => {
    assert.equal(ToolMode.TEXT_EDIT, 'text-edit');
  });

  it('defines SEARCH', () => {
    assert.equal(ToolMode.SEARCH, 'search');
  });

  it('defines ERASE', () => {
    assert.equal(ToolMode.ERASE, 'erase');
  });
});

// ── toolStateMachine ───────────────────────────────────────────────────────

describe('toolStateMachine', () => {
  beforeEach(() => {
    resetMachine();
    initToolModeDeps(makeMockDeps());
  });

  it('starts in IDLE mode', () => {
    assert.equal(toolStateMachine.current, ToolMode.IDLE);
  });

  it('transition changes current mode', () => {
    toolStateMachine.transition(ToolMode.ANNOTATE);
    assert.equal(toolStateMachine.current, ToolMode.ANNOTATE);
  });

  it('transition stores previous mode', () => {
    toolStateMachine.transition(ToolMode.ANNOTATE);
    assert.equal(toolStateMachine.previous, ToolMode.IDLE);
    toolStateMachine.transition(ToolMode.OCR_REGION);
    assert.equal(toolStateMachine.previous, ToolMode.ANNOTATE);
  });

  it('transition to same mode is a no-op', () => {
    toolStateMachine.transition(ToolMode.ANNOTATE);
    const prev = toolStateMachine.previous;
    toolStateMachine.transition(ToolMode.ANNOTATE);
    assert.equal(toolStateMachine.previous, prev);
    assert.equal(toolStateMachine.current, ToolMode.ANNOTATE);
  });

  it('transition notifies listeners', () => {
    const events = [];
    toolStateMachine.onTransition((newMode, oldMode) => {
      events.push({ newMode, oldMode });
    });

    toolStateMachine.transition(ToolMode.ANNOTATE);
    assert.equal(events.length, 1);
    assert.equal(events[0].newMode, ToolMode.ANNOTATE);
    assert.equal(events[0].oldMode, ToolMode.IDLE);
  });

  it('transition notifies multiple listeners', () => {
    let count1 = 0;
    let count2 = 0;
    toolStateMachine.onTransition(() => { count1++; });
    toolStateMachine.onTransition(() => { count2++; });

    toolStateMachine.transition(ToolMode.SEARCH);
    assert.equal(count1, 1);
    assert.equal(count2, 1);
  });

  it('toggle activates mode from IDLE', () => {
    toolStateMachine.toggle(ToolMode.ANNOTATE);
    assert.equal(toolStateMachine.current, ToolMode.ANNOTATE);
  });

  it('toggle deactivates mode back to IDLE', () => {
    toolStateMachine.toggle(ToolMode.ANNOTATE);
    toolStateMachine.toggle(ToolMode.ANNOTATE);
    assert.equal(toolStateMachine.current, ToolMode.IDLE);
  });

  it('toggle switches from one mode to another', () => {
    toolStateMachine.toggle(ToolMode.ANNOTATE);
    toolStateMachine.toggle(ToolMode.OCR_REGION);
    assert.equal(toolStateMachine.current, ToolMode.OCR_REGION);
  });

  it('can transition through all modes', () => {
    const modes = [ToolMode.ANNOTATE, ToolMode.OCR_REGION, ToolMode.TEXT_EDIT, ToolMode.SEARCH, ToolMode.ERASE, ToolMode.IDLE];
    for (const mode of modes) {
      toolStateMachine.transition(mode);
      assert.equal(toolStateMachine.current, mode);
    }
  });
});

// ── initToolModeDeps ───────────────────────────────────────────────────────

describe('initToolModeDeps', () => {
  it('does not throw', () => {
    assert.doesNotThrow(() => initToolModeDeps(makeMockDeps()));
  });

  it('accepts partial deps', () => {
    assert.doesNotThrow(() => initToolModeDeps({ renderAnnotations: () => {} }));
  });
});

// ── activateAnnotateMode / deactivateAnnotateMode ──────────────────────────

describe('activateAnnotateMode', () => {
  beforeEach(() => {
    state.drawEnabled = false;
    initToolModeDeps(makeMockDeps());
  });

  it('sets drawEnabled to true', () => {
    activateAnnotateMode();
    assert.equal(state.drawEnabled, true);
  });

  it('calls updateOverlayInteractionState', () => {
    let called = false;
    initToolModeDeps({ ...makeMockDeps(), updateOverlayInteractionState: () => { called = true; } });
    activateAnnotateMode();
    assert.equal(called, true);
  });
});

describe('deactivateAnnotateMode', () => {
  beforeEach(() => {
    state.drawEnabled = true;
    initToolModeDeps(makeMockDeps());
  });

  it('sets drawEnabled to false', () => {
    deactivateAnnotateMode();
    assert.equal(state.drawEnabled, false);
  });

  it('calls renderAnnotations', () => {
    let called = false;
    initToolModeDeps({ ...makeMockDeps(), renderAnnotations: () => { called = true; } });
    deactivateAnnotateMode();
    assert.equal(called, true);
  });
});

// ── activateOcrRegionMode / deactivateOcrRegionMode ────────────────────────

describe('activateOcrRegionMode', () => {
  beforeEach(() => {
    state.ocrRegionMode = false;
    initToolModeDeps(makeMockDeps());
  });

  it('sets ocrRegionMode to true', () => {
    activateOcrRegionMode();
    assert.equal(state.ocrRegionMode, true);
  });

  it('calls setOcrStatus with message', () => {
    let statusMsg = '';
    initToolModeDeps({ ...makeMockDeps(), setOcrStatus: (msg) => { statusMsg = msg; } });
    activateOcrRegionMode();
    assert.ok(statusMsg.length > 0);
  });
});

describe('deactivateOcrRegionMode', () => {
  beforeEach(() => {
    state.ocrRegionMode = true;
    state.isSelectingOcr = true;
    state.ocrSelection = { x: 0, y: 0 };
    initToolModeDeps(makeMockDeps());
  });

  it('sets ocrRegionMode to false', () => {
    deactivateOcrRegionMode();
    assert.equal(state.ocrRegionMode, false);
  });

  it('clears isSelectingOcr', () => {
    deactivateOcrRegionMode();
    assert.equal(state.isSelectingOcr, false);
  });

  it('clears ocrSelection', () => {
    deactivateOcrRegionMode();
    assert.equal(state.ocrSelection, null);
  });
});

// ── activateTextEditMode / deactivateTextEditMode ──────────────────────────

describe('activateTextEditMode', () => {
  beforeEach(() => {
    state.textEditMode = false;
    initToolModeDeps(makeMockDeps());
  });

  it('sets textEditMode to true', () => {
    activateTextEditMode();
    assert.equal(state.textEditMode, true);
  });
});

describe('deactivateTextEditMode', () => {
  beforeEach(() => {
    state.textEditMode = true;
    initToolModeDeps(makeMockDeps());
  });

  it('sets textEditMode to false', () => {
    deactivateTextEditMode();
    assert.equal(state.textEditMode, false);
  });
});

// ── activateSearchMode / deactivateSearchMode ──────────────────────────────

describe('activateSearchMode', () => {
  it('does not throw', () => {
    assert.doesNotThrow(() => activateSearchMode());
  });
});

describe('deactivateSearchMode', () => {
  it('does not throw', () => {
    assert.doesNotThrow(() => deactivateSearchMode());
  });
});

// ── activateEraseMode / deactivateEraseMode ────────────────────────────────

describe('activateEraseMode', () => {
  beforeEach(() => {
    state.eraseMode = false;
    initToolModeDeps(makeMockDeps());
  });

  it('sets eraseMode to true', () => {
    activateEraseMode();
    assert.equal(state.eraseMode, true);
  });

  it('calls activateEraseOverlay', () => {
    let called = false;
    initToolModeDeps({ ...makeMockDeps(), activateEraseOverlay: () => { called = true; } });
    activateEraseMode();
    assert.equal(called, true);
  });
});

describe('deactivateEraseMode', () => {
  beforeEach(() => {
    state.eraseMode = true;
    initToolModeDeps(makeMockDeps());
  });

  it('sets eraseMode to false', () => {
    deactivateEraseMode();
    assert.equal(state.eraseMode, false);
  });

  it('calls deactivateEraseOverlay', () => {
    let called = false;
    initToolModeDeps({ ...makeMockDeps(), deactivateEraseOverlay: () => { called = true; } });
    deactivateEraseMode();
    assert.equal(called, true);
  });

  it('calls updateOverlayInteractionState', () => {
    let called = false;
    initToolModeDeps({ ...makeMockDeps(), updateOverlayInteractionState: () => { called = true; } });
    deactivateEraseMode();
    assert.equal(called, true);
  });
});
