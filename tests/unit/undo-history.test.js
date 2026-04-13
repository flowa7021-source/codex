// ─── Unit Tests: UndoHistory ──────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { UndoHistory } from '../../app/modules/undo-history.js';

// ─── Initial state ────────────────────────────────────────────────────────────

describe('UndoHistory – initial state', () => {
  it('current equals the initial state', () => {
    const h = new UndoHistory('hello');
    assert.equal(h.current, 'hello');
  });

  it('canUndo is false', () => {
    const h = new UndoHistory(0);
    assert.equal(h.canUndo, false);
  });

  it('canRedo is false', () => {
    const h = new UndoHistory(0);
    assert.equal(h.canRedo, false);
  });

  it('undoCount is 0', () => {
    const h = new UndoHistory(42);
    assert.equal(h.undoCount, 0);
  });

  it('redoCount is 0', () => {
    const h = new UndoHistory(42);
    assert.equal(h.redoCount, 0);
  });
});

// ─── push ─────────────────────────────────────────────────────────────────────

describe('UndoHistory – push', () => {
  it('updates current to the pushed state', () => {
    const h = new UndoHistory('a');
    h.push('b');
    assert.equal(h.current, 'b');
  });

  it('canUndo becomes true after a push', () => {
    const h = new UndoHistory('a');
    h.push('b');
    assert.equal(h.canUndo, true);
  });

  it('undoCount increments with each push', () => {
    const h = new UndoHistory('a');
    h.push('b');
    assert.equal(h.undoCount, 1);
    h.push('c');
    assert.equal(h.undoCount, 2);
  });

  it('accepts an optional label', () => {
    const h = new UndoHistory('a');
    h.push('b', 'my label');
    const entries = h.getHistory();
    assert.equal(entries[1].label, 'my label');
  });

  it('stores a timestamp', () => {
    const before = Date.now();
    const h = new UndoHistory('a');
    h.push('b');
    const after = Date.now();
    const entries = h.getHistory();
    assert.ok(entries[1].timestamp >= before && entries[1].timestamp <= after);
  });
});

// ─── undo ─────────────────────────────────────────────────────────────────────

describe('UndoHistory – undo', () => {
  it('returns the previous state', () => {
    const h = new UndoHistory('a');
    h.push('b');
    const result = h.undo();
    assert.equal(result, 'a');
  });

  it('current changes to the previous state', () => {
    const h = new UndoHistory('a');
    h.push('b');
    h.undo();
    assert.equal(h.current, 'a');
  });

  it('undo at start returns null', () => {
    const h = new UndoHistory('a');
    assert.equal(h.undo(), null);
  });

  it('undo at start does not change current', () => {
    const h = new UndoHistory('a');
    h.undo();
    assert.equal(h.current, 'a');
  });

  it('canUndo becomes false after undoing to initial state', () => {
    const h = new UndoHistory('a');
    h.push('b');
    h.undo();
    assert.equal(h.canUndo, false);
  });
});

// ─── redo ─────────────────────────────────────────────────────────────────────

describe('UndoHistory – redo', () => {
  it('returns the next state after an undo', () => {
    const h = new UndoHistory('a');
    h.push('b');
    h.undo();
    const result = h.redo();
    assert.equal(result, 'b');
  });

  it('current changes to the redone state', () => {
    const h = new UndoHistory('a');
    h.push('b');
    h.undo();
    h.redo();
    assert.equal(h.current, 'b');
  });

  it('redo at end returns null', () => {
    const h = new UndoHistory('a');
    assert.equal(h.redo(), null);
  });

  it('canRedo becomes false after redoing the last state', () => {
    const h = new UndoHistory('a');
    h.push('b');
    h.undo();
    h.redo();
    assert.equal(h.canRedo, false);
  });
});

// ─── push clears redo ─────────────────────────────────────────────────────────

describe('UndoHistory – push clears redo stack', () => {
  it('canRedo is false after a new push', () => {
    const h = new UndoHistory('a');
    h.push('b');
    h.undo();
    assert.equal(h.canRedo, true);
    h.push('c');
    assert.equal(h.canRedo, false);
  });

  it('redoCount is 0 after a new push', () => {
    const h = new UndoHistory('a');
    h.push('b');
    h.undo();
    h.push('c');
    assert.equal(h.redoCount, 0);
  });

  it('current reflects the newly pushed state, not the cleared redo', () => {
    const h = new UndoHistory('a');
    h.push('b');
    h.undo();
    h.push('c');
    assert.equal(h.current, 'c');
  });
});

// ─── goto ─────────────────────────────────────────────────────────────────────

describe('UndoHistory – goto', () => {
  it('jumps to index 0 (initial state)', () => {
    const h = new UndoHistory('a');
    h.push('b');
    h.push('c');
    const result = h.goto(0);
    assert.equal(result, 'a');
    assert.equal(h.current, 'a');
  });

  it('jumps to an intermediate index', () => {
    const h = new UndoHistory('a');
    h.push('b');
    h.push('c');
    const result = h.goto(1);
    assert.equal(result, 'b');
    assert.equal(h.current, 'b');
  });

  it('jumps to the last index', () => {
    const h = new UndoHistory('a');
    h.push('b');
    h.push('c');
    const result = h.goto(2);
    assert.equal(result, 'c');
  });

  it('returns null for a negative index', () => {
    const h = new UndoHistory('a');
    assert.equal(h.goto(-1), null);
  });

  it('returns null for an index beyond the history', () => {
    const h = new UndoHistory('a');
    assert.equal(h.goto(5), null);
  });

  it('updates undoCount and redoCount correctly after goto', () => {
    const h = new UndoHistory('a');
    h.push('b');
    h.push('c');
    h.goto(1);
    assert.equal(h.undoCount, 1);
    assert.equal(h.redoCount, 1);
  });
});

// ─── maxHistory ───────────────────────────────────────────────────────────────

describe('UndoHistory – maxHistory', () => {
  it('drops oldest entries when maxHistory is exceeded', () => {
    const h = new UndoHistory('init', { maxHistory: 3 });
    h.push('a');
    h.push('b');
    h.push('c'); // now at 4 entries total; drops 'init'
    const entries = h.getHistory();
    assert.equal(entries.length, 3);
    assert.ok(!entries.some((e) => e.state === 'init'));
  });

  it('current is still the latest state after trimming', () => {
    const h = new UndoHistory('init', { maxHistory: 3 });
    h.push('a');
    h.push('b');
    h.push('c');
    assert.equal(h.current, 'c');
  });

  it('undoCount is correctly bounded after trimming', () => {
    const h = new UndoHistory('init', { maxHistory: 3 });
    h.push('a');
    h.push('b');
    h.push('c');
    // 3 entries: ['a','b','c'], index=2, undoCount=2
    assert.equal(h.undoCount, 2);
  });
});

// ─── clear ────────────────────────────────────────────────────────────────────

describe('UndoHistory – clear', () => {
  it('resets canUndo to false', () => {
    const h = new UndoHistory('a');
    h.push('b');
    h.clear();
    assert.equal(h.canUndo, false);
  });

  it('resets canRedo to false', () => {
    const h = new UndoHistory('a');
    h.push('b');
    h.undo();
    h.clear();
    assert.equal(h.canRedo, false);
  });

  it('keeps the current state as the only entry', () => {
    const h = new UndoHistory('a');
    h.push('b');
    h.push('c');
    h.clear();
    assert.equal(h.current, 'c');
    assert.equal(h.getHistory().length, 1);
  });
});

// ─── getHistory ───────────────────────────────────────────────────────────────

describe('UndoHistory – getHistory', () => {
  it('returns one entry for the initial state', () => {
    const h = new UndoHistory('a');
    const entries = h.getHistory();
    assert.equal(entries.length, 1);
    assert.equal(entries[0].state, 'a');
  });

  it('returns all entries including redo stack', () => {
    const h = new UndoHistory('a');
    h.push('b');
    h.push('c');
    h.undo();
    const entries = h.getHistory();
    // 3 entries: a, b, c — undo only moved the pointer
    assert.equal(entries.length, 3);
  });

  it('returns a copy (mutations do not affect internal state)', () => {
    const h = new UndoHistory('a');
    const entries = h.getHistory();
    entries.push({ state: 'injected', timestamp: 0 });
    assert.equal(h.getHistory().length, 1);
  });
});

// ─── undoCount / redoCount ────────────────────────────────────────────────────

describe('UndoHistory – undoCount and redoCount', () => {
  it('undoCount reflects distance from start', () => {
    const h = new UndoHistory('a');
    h.push('b');
    h.push('c');
    assert.equal(h.undoCount, 2);
  });

  it('redoCount reflects distance to end after undo', () => {
    const h = new UndoHistory('a');
    h.push('b');
    h.push('c');
    h.undo();
    assert.equal(h.redoCount, 1);
    h.undo();
    assert.equal(h.redoCount, 2);
  });

  it('undoCount + redoCount = total entries - 1', () => {
    const h = new UndoHistory('a');
    h.push('b');
    h.push('c');
    h.undo();
    assert.equal(h.undoCount + h.redoCount, h.getHistory().length - 1);
  });
});
