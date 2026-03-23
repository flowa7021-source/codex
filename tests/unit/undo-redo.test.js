// ─── Unit Tests: Undo/Redo ──────────────────────────────────────────────────
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  undoRedoManager,
  textEditCommand,
  strokeCommand,
  bindUndoRedoKeys,
} from '../../app/modules/undo-redo.js';

beforeEach(() => {
  undoRedoManager.clear();
  // Remove all change listeners between tests
  undoRedoManager._listeners.length = 0;
});

// ─── UndoRedoManager.execute ────────────────────────────────────────────────

describe('UndoRedoManager.execute', () => {
  it('executes the command immediately', () => {
    let value = 0;
    undoRedoManager.execute({
      name: 'inc',
      execute: () => { value = 1; },
      undo: () => { value = 0; },
    });
    assert.equal(value, 1);
  });

  it('pushes onto undo stack', () => {
    undoRedoManager.execute({
      name: 'a',
      execute: () => {},
      undo: () => {},
    });
    assert.equal(undoRedoManager.canUndo(), true);
    assert.equal(undoRedoManager.status().undoCount, 1);
  });

  it('clears the redo stack', () => {
    undoRedoManager.execute({ name: 'a', execute: () => {}, undo: () => {} });
    undoRedoManager.undo();
    assert.equal(undoRedoManager.canRedo(), true);
    // Execute a new command — redo should be cleared
    undoRedoManager.execute({ name: 'b', execute: () => {}, undo: () => {} });
    assert.equal(undoRedoManager.canRedo(), false);
  });

  it('caps undo stack at 100 entries', () => {
    for (let i = 0; i < 110; i++) {
      undoRedoManager.execute({ name: `cmd-${i}`, execute: () => {}, undo: () => {} });
    }
    assert.equal(undoRedoManager.status().undoCount, 100);
  });
});

// ─── UndoRedoManager.push ───────────────────────────────────────────────────

describe('UndoRedoManager.push', () => {
  it('adds command without calling execute', () => {
    let executed = false;
    undoRedoManager.push({
      name: 'no-exec',
      execute: () => { executed = true; },
      undo: () => {},
    });
    assert.equal(executed, false);
    assert.equal(undoRedoManager.canUndo(), true);
  });

  it('clears the redo stack', () => {
    undoRedoManager.execute({ name: 'a', execute: () => {}, undo: () => {} });
    undoRedoManager.undo();
    undoRedoManager.push({ name: 'b', execute: () => {}, undo: () => {} });
    assert.equal(undoRedoManager.canRedo(), false);
  });

  it('caps undo stack at 100 entries', () => {
    for (let i = 0; i < 105; i++) {
      undoRedoManager.push({ name: `p-${i}`, execute: () => {}, undo: () => {} });
    }
    assert.equal(undoRedoManager.status().undoCount, 100);
  });
});

// ─── UndoRedoManager.undo ───────────────────────────────────────────────────

describe('UndoRedoManager.undo', () => {
  it('calls cmd.undo() and moves command to redo stack', () => {
    let value = 0;
    undoRedoManager.execute({
      name: 'set-1',
      execute: () => { value = 1; },
      undo: () => { value = 0; },
    });
    const result = undoRedoManager.undo();
    assert.equal(value, 0);
    assert.equal(result.name, 'set-1');
    assert.equal(undoRedoManager.canUndo(), false);
    assert.equal(undoRedoManager.canRedo(), true);
  });

  it('returns null when nothing to undo', () => {
    const result = undoRedoManager.undo();
    assert.equal(result, null);
  });

  it('undoes most recent command first (LIFO)', () => {
    const log = [];
    undoRedoManager.execute({ name: 'a', execute: () => log.push('exec-a'), undo: () => log.push('undo-a') });
    undoRedoManager.execute({ name: 'b', execute: () => log.push('exec-b'), undo: () => log.push('undo-b') });
    undoRedoManager.undo();
    undoRedoManager.undo();
    assert.deepEqual(log, ['exec-a', 'exec-b', 'undo-b', 'undo-a']);
  });
});

// ─── UndoRedoManager.redo ───────────────────────────────────────────────────

describe('UndoRedoManager.redo', () => {
  it('re-executes the undone command', () => {
    let value = 0;
    undoRedoManager.execute({
      name: 'set-1',
      execute: () => { value = 1; },
      undo: () => { value = 0; },
    });
    undoRedoManager.undo();
    assert.equal(value, 0);
    const result = undoRedoManager.redo();
    assert.equal(value, 1);
    assert.equal(result.name, 'set-1');
    assert.equal(undoRedoManager.canUndo(), true);
    assert.equal(undoRedoManager.canRedo(), false);
  });

  it('returns null when nothing to redo', () => {
    const result = undoRedoManager.redo();
    assert.equal(result, null);
  });

  it('supports multiple undo then redo in correct order', () => {
    const log = [];
    undoRedoManager.execute({ name: 'a', execute: () => log.push('a'), undo: () => log.push('~a') });
    undoRedoManager.execute({ name: 'b', execute: () => log.push('b'), undo: () => log.push('~b') });
    undoRedoManager.undo(); // ~b
    undoRedoManager.undo(); // ~a
    undoRedoManager.redo(); // a
    undoRedoManager.redo(); // b
    assert.deepEqual(log, ['a', 'b', '~b', '~a', 'a', 'b']);
  });
});

// ─── UndoRedoManager.clear ──────────────────────────────────────────────────

describe('UndoRedoManager.clear', () => {
  it('empties both stacks', () => {
    undoRedoManager.execute({ name: 'x', execute: () => {}, undo: () => {} });
    undoRedoManager.undo();
    assert.equal(undoRedoManager.canRedo(), true);
    undoRedoManager.clear();
    assert.equal(undoRedoManager.canUndo(), false);
    assert.equal(undoRedoManager.canRedo(), false);
  });
});

// ─── UndoRedoManager.status ─────────────────────────────────────────────────

describe('UndoRedoManager.status', () => {
  it('returns null names when stacks are empty', () => {
    const s = undoRedoManager.status();
    assert.equal(s.undoName, null);
    assert.equal(s.redoName, null);
    assert.equal(s.undoCount, 0);
    assert.equal(s.redoCount, 0);
  });

  it('returns correct names and counts', () => {
    undoRedoManager.execute({ name: 'first', execute: () => {}, undo: () => {} });
    undoRedoManager.execute({ name: 'second', execute: () => {}, undo: () => {} });
    const s1 = undoRedoManager.status();
    assert.equal(s1.undoName, 'second');
    assert.equal(s1.undoCount, 2);

    undoRedoManager.undo();
    const s2 = undoRedoManager.status();
    assert.equal(s2.undoName, 'first');
    assert.equal(s2.redoName, 'second');
    assert.equal(s2.undoCount, 1);
    assert.equal(s2.redoCount, 1);
  });
});

// ─── UndoRedoManager.onChange ───────────────────────────────────────────────

describe('UndoRedoManager.onChange', () => {
  it('calls listener on execute', () => {
    let notified = false;
    undoRedoManager.onChange(() => { notified = true; });
    undoRedoManager.execute({ name: 'a', execute: () => {}, undo: () => {} });
    assert.equal(notified, true);
  });

  it('calls listener on undo/redo/clear', () => {
    let count = 0;
    undoRedoManager.onChange(() => { count++; });
    undoRedoManager.execute({ name: 'a', execute: () => {}, undo: () => {} }); // 1
    undoRedoManager.undo();  // 2
    undoRedoManager.redo();  // 3
    undoRedoManager.clear(); // 4
    assert.equal(count, 4);
  });

  it('calls listener on push', () => {
    let count = 0;
    undoRedoManager.onChange(() => { count++; });
    undoRedoManager.push({ name: 'a', execute: () => {}, undo: () => {} });
    assert.equal(count, 1);
  });

  it('passes canUndo/canRedo state', () => {
    let state = null;
    undoRedoManager.onChange((s) => { state = s; });
    undoRedoManager.execute({ name: 'a', execute: () => {}, undo: () => {} });
    assert.deepEqual(state, { canUndo: true, canRedo: false });
    undoRedoManager.undo();
    assert.deepEqual(state, { canUndo: false, canRedo: true });
  });

  it('returns an unsubscribe function', () => {
    let count = 0;
    const unsub = undoRedoManager.onChange(() => { count++; });
    undoRedoManager.execute({ name: 'a', execute: () => {}, undo: () => {} });
    assert.equal(count, 1);
    unsub();
    undoRedoManager.execute({ name: 'b', execute: () => {}, undo: () => {} });
    assert.equal(count, 1);
  });

  it('does not crash when listener throws', () => {
    undoRedoManager.onChange(() => { throw new Error('boom'); });
    let secondCalled = false;
    undoRedoManager.onChange(() => { secondCalled = true; });
    // Should not throw
    undoRedoManager.execute({ name: 'a', execute: () => {}, undo: () => {} });
    assert.equal(secondCalled, true);
  });
});

// ─── canUndo / canRedo ──────────────────────────────────────────────────────

describe('canUndo / canRedo', () => {
  it('initially both false', () => {
    assert.equal(undoRedoManager.canUndo(), false);
    assert.equal(undoRedoManager.canRedo(), false);
  });
});

// ─── textEditCommand ────────────────────────────────────────────────────────

describe('textEditCommand', () => {
  it('creates a command with correct name', () => {
    const cmd = textEditCommand(5, 'old', 'new', () => {});
    assert.ok(cmd.name.includes('5'));
  });

  it('execute calls applyFn with newText', () => {
    let applied = null;
    const cmd = textEditCommand(1, 'old', 'new', (v) => { applied = v; });
    cmd.execute();
    assert.equal(applied, 'new');
  });

  it('undo calls applyFn with oldText', () => {
    let applied = null;
    const cmd = textEditCommand(1, 'old', 'new', (v) => { applied = v; });
    cmd.undo();
    assert.equal(applied, 'old');
  });
});

// ─── strokeCommand ──────────────────────────────────────────────────────────

describe('strokeCommand', () => {
  it('creates a command with correct name', () => {
    const cmd = strokeCommand(3, { id: 1 }, () => {}, () => {});
    assert.ok(cmd.name.includes('3'));
  });

  it('execute calls addFn with stroke', () => {
    let added = null;
    const stroke = { points: [1, 2, 3] };
    const cmd = strokeCommand(1, stroke, (s) => { added = s; }, () => {});
    cmd.execute();
    assert.equal(added, stroke);
  });

  it('undo calls removeFn with stroke', () => {
    let removed = null;
    const stroke = { points: [1, 2, 3] };
    const cmd = strokeCommand(1, stroke, () => {}, (s) => { removed = s; });
    cmd.undo();
    assert.equal(removed, stroke);
  });
});

// ─── bindUndoRedoKeys ───────────────────────────────────────────────────────

describe('bindUndoRedoKeys', () => {
  it('is a function', () => {
    assert.equal(typeof bindUndoRedoKeys, 'function');
  });

  it('calls document.addEventListener', () => {
    let listenerAdded = false;
    const origAddEventListener = document.addEventListener;
    document.addEventListener = (event) => {
      if (event === 'keydown') listenerAdded = true;
    };
    bindUndoRedoKeys();
    assert.equal(listenerAdded, true);
    document.addEventListener = origAddEventListener;
  });
});
