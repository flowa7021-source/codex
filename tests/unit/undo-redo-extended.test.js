// ─── Unit Tests: Undo/Redo (Extended Coverage) ──────────────────────────────
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
  undoRedoManager._listeners.length = 0;
});

// ─── MAX_STACK boundary ────────────────────────────────────────────────────

describe('UndoRedoManager MAX_STACK boundary', () => {
  it('oldest command is removed when stack exceeds 100 via execute', () => {
    for (let i = 0; i < 101; i++) {
      undoRedoManager.execute({ name: `cmd-${i}`, execute: () => {}, undo: () => {} });
    }
    assert.equal(undoRedoManager.status().undoCount, 100);
    // The first command (cmd-0) should have been shifted off
    assert.equal(undoRedoManager.undoStack[0].name, 'cmd-1');
  });

  it('oldest command is removed when stack exceeds 100 via push', () => {
    for (let i = 0; i < 101; i++) {
      undoRedoManager.push({ name: `p-${i}`, execute: () => {}, undo: () => {} });
    }
    assert.equal(undoRedoManager.status().undoCount, 100);
    assert.equal(undoRedoManager.undoStack[0].name, 'p-1');
  });

  it('exactly 100 items stays at 100', () => {
    for (let i = 0; i < 100; i++) {
      undoRedoManager.execute({ name: `cmd-${i}`, execute: () => {}, undo: () => {} });
    }
    assert.equal(undoRedoManager.status().undoCount, 100);
    assert.equal(undoRedoManager.undoStack[0].name, 'cmd-0');
  });
});

// ─── Redo stack clearing ───────────────────────────────────────────────────

describe('UndoRedoManager redo stack interaction', () => {
  it('execute after undo clears redo and forks history', () => {
    let val = 0;
    undoRedoManager.execute({ name: 'a', execute: () => { val = 1; }, undo: () => { val = 0; } });
    undoRedoManager.execute({ name: 'b', execute: () => { val = 2; }, undo: () => { val = 1; } });
    undoRedoManager.undo(); // val=1, redo has 'b'
    assert.equal(undoRedoManager.canRedo(), true);
    undoRedoManager.execute({ name: 'c', execute: () => { val = 3; }, undo: () => { val = 1; } });
    assert.equal(val, 3);
    assert.equal(undoRedoManager.canRedo(), false);
    assert.equal(undoRedoManager.status().undoCount, 2); // 'a' + 'c'
  });

  it('push after undo clears redo', () => {
    undoRedoManager.execute({ name: 'a', execute: () => {}, undo: () => {} });
    undoRedoManager.undo();
    assert.equal(undoRedoManager.canRedo(), true);
    undoRedoManager.push({ name: 'b', execute: () => {}, undo: () => {} });
    assert.equal(undoRedoManager.canRedo(), false);
  });
});

// ─── Empty stack operations ────────────────────────────────────────────────

describe('UndoRedoManager empty stack operations', () => {
  it('undo on empty stack returns null and does not crash', () => {
    assert.equal(undoRedoManager.undo(), null);
    assert.equal(undoRedoManager.canUndo(), false);
    assert.equal(undoRedoManager.canRedo(), false);
  });

  it('redo on empty stack returns null and does not crash', () => {
    assert.equal(undoRedoManager.redo(), null);
    assert.equal(undoRedoManager.canRedo(), false);
  });

  it('clear on already-empty stacks is safe', () => {
    undoRedoManager.clear();
    assert.equal(undoRedoManager.status().undoCount, 0);
    assert.equal(undoRedoManager.status().redoCount, 0);
  });

  it('status on empty stacks returns all nulls and zeros', () => {
    const s = undoRedoManager.status();
    assert.equal(s.undoName, null);
    assert.equal(s.redoName, null);
    assert.equal(s.undoCount, 0);
    assert.equal(s.redoCount, 0);
  });
});

// ─── onChange edge cases ───────────────────────────────────────────────────

describe('UndoRedoManager.onChange edge cases', () => {
  it('multiple listeners all receive notifications', () => {
    let count1 = 0, count2 = 0, count3 = 0;
    undoRedoManager.onChange(() => { count1++; });
    undoRedoManager.onChange(() => { count2++; });
    undoRedoManager.onChange(() => { count3++; });
    undoRedoManager.execute({ name: 'a', execute: () => {}, undo: () => {} });
    assert.equal(count1, 1);
    assert.equal(count2, 1);
    assert.equal(count3, 1);
  });

  it('unsubscribing one listener does not affect others', () => {
    let count1 = 0, count2 = 0;
    const unsub1 = undoRedoManager.onChange(() => { count1++; });
    undoRedoManager.onChange(() => { count2++; });
    undoRedoManager.execute({ name: 'a', execute: () => {}, undo: () => {} });
    unsub1();
    undoRedoManager.execute({ name: 'b', execute: () => {}, undo: () => {} });
    assert.equal(count1, 1);
    assert.equal(count2, 2);
  });

  it('listener throwing does not prevent notification to other listeners', () => {
    const results = [];
    undoRedoManager.onChange(() => { results.push('first'); });
    undoRedoManager.onChange(() => { throw new Error('fail'); });
    undoRedoManager.onChange(() => { results.push('third'); });
    undoRedoManager.execute({ name: 'a', execute: () => {}, undo: () => {} });
    assert.deepEqual(results, ['first', 'third']);
  });

  it('listener receives correct state after undo empties undo stack', () => {
    let lastState = null;
    undoRedoManager.onChange((s) => { lastState = s; });
    undoRedoManager.execute({ name: 'only', execute: () => {}, undo: () => {} });
    undoRedoManager.undo();
    assert.deepEqual(lastState, { canUndo: false, canRedo: true });
  });

  it('listener receives correct state after redo empties redo stack', () => {
    let lastState = null;
    undoRedoManager.onChange((s) => { lastState = s; });
    undoRedoManager.execute({ name: 'only', execute: () => {}, undo: () => {} });
    undoRedoManager.undo();
    undoRedoManager.redo();
    assert.deepEqual(lastState, { canUndo: true, canRedo: false });
  });

  it('listener receives correct state on clear', () => {
    let lastState = null;
    undoRedoManager.onChange((s) => { lastState = s; });
    undoRedoManager.execute({ name: 'a', execute: () => {}, undo: () => {} });
    undoRedoManager.clear();
    assert.deepEqual(lastState, { canUndo: false, canRedo: false });
  });

  it('double unsubscribe is safe', () => {
    let count = 0;
    const unsub = undoRedoManager.onChange(() => { count++; });
    unsub();
    unsub(); // Should not throw
    undoRedoManager.execute({ name: 'a', execute: () => {}, undo: () => {} });
    assert.equal(count, 0);
  });
});

// ─── textEditCommand details ───────────────────────────────────────────────

describe('textEditCommand edge cases', () => {
  it('works with empty strings', () => {
    let result = null;
    const cmd = textEditCommand(1, '', 'new', (v) => { result = v; });
    cmd.execute();
    assert.equal(result, 'new');
    cmd.undo();
    assert.equal(result, '');
  });

  it('command name includes page number', () => {
    const cmd = textEditCommand(42, 'a', 'b', () => {});
    assert.ok(cmd.name.includes('42'));
  });

  it('integrates with undoRedoManager', () => {
    let current = 'original';
    const cmd = textEditCommand(1, 'original', 'modified', (v) => { current = v; });
    undoRedoManager.execute(cmd);
    assert.equal(current, 'modified');
    undoRedoManager.undo();
    assert.equal(current, 'original');
    undoRedoManager.redo();
    assert.equal(current, 'modified');
  });
});

// ─── strokeCommand details ─────────────────────────────────────────────────

describe('strokeCommand edge cases', () => {
  it('works with complex stroke objects', () => {
    const stroke = { id: 'abc', points: [[0, 0], [1, 1]], color: '#ff0000', width: 3 };
    let added = null, removed = null;
    const cmd = strokeCommand(7, stroke, (s) => { added = s; }, (s) => { removed = s; });
    cmd.execute();
    assert.equal(added, stroke);
    cmd.undo();
    assert.equal(removed, stroke);
  });

  it('command name includes page number', () => {
    const cmd = strokeCommand(99, {}, () => {}, () => {});
    assert.ok(cmd.name.includes('99'));
  });

  it('integrates with undoRedoManager', () => {
    const strokes = [];
    const stroke = { id: 1 };
    const cmd = strokeCommand(1, stroke, (s) => strokes.push(s), (s) => {
      const idx = strokes.indexOf(s);
      if (idx >= 0) strokes.splice(idx, 1);
    });
    undoRedoManager.execute(cmd);
    assert.equal(strokes.length, 1);
    undoRedoManager.undo();
    assert.equal(strokes.length, 0);
    undoRedoManager.redo();
    assert.equal(strokes.length, 1);
  });
});

// ─── bindUndoRedoKeys keyboard simulation ──────────────────────────────────

describe('bindUndoRedoKeys keyboard handling', () => {
  it('Ctrl+Z triggers undo', () => {
    let listeners = [];
    const origAddEventListener = document.addEventListener;
    document.addEventListener = (event, fn) => { if (event === 'keydown') listeners.push(fn); };

    bindUndoRedoKeys();

    // Set up a command to undo
    let value = 0;
    undoRedoManager.execute({ name: 'test', execute: () => { value = 1; }, undo: () => { value = 0; } });
    assert.equal(value, 1);

    // Simulate Ctrl+Z
    const event = {
      key: 'z',
      ctrlKey: true,
      shiftKey: false,
      altKey: false,
      metaKey: false,
      target: { matches: () => false },
      preventDefault: () => {},
    };
    listeners[listeners.length - 1](event);
    assert.equal(value, 0);

    document.addEventListener = origAddEventListener;
  });

  it('Ctrl+Shift+Z triggers redo', () => {
    let listeners = [];
    const origAddEventListener = document.addEventListener;
    document.addEventListener = (event, fn) => { if (event === 'keydown') listeners.push(fn); };

    bindUndoRedoKeys();

    let value = 0;
    undoRedoManager.execute({ name: 'test', execute: () => { value = 1; }, undo: () => { value = 0; } });
    undoRedoManager.undo();
    assert.equal(value, 0);

    // Simulate Ctrl+Shift+Z
    const event = {
      key: 'z',
      ctrlKey: true,
      shiftKey: true,
      altKey: false,
      metaKey: false,
      target: { matches: () => false },
      preventDefault: () => {},
    };
    listeners[listeners.length - 1](event);
    assert.equal(value, 1);

    document.addEventListener = origAddEventListener;
  });

  it('Ctrl+Y triggers redo', () => {
    let listeners = [];
    const origAddEventListener = document.addEventListener;
    document.addEventListener = (event, fn) => { if (event === 'keydown') listeners.push(fn); };

    bindUndoRedoKeys();

    let value = 0;
    undoRedoManager.execute({ name: 'test', execute: () => { value = 1; }, undo: () => { value = 0; } });
    undoRedoManager.undo();

    const event = {
      key: 'y',
      ctrlKey: true,
      shiftKey: false,
      altKey: false,
      metaKey: false,
      target: { matches: () => false },
      preventDefault: () => {},
    };
    listeners[listeners.length - 1](event);
    assert.equal(value, 1);

    document.addEventListener = origAddEventListener;
  });

  it('ignores key events when target is an input element', () => {
    let listeners = [];
    const origAddEventListener = document.addEventListener;
    document.addEventListener = (event, fn) => { if (event === 'keydown') listeners.push(fn); };

    bindUndoRedoKeys();

    let value = 0;
    undoRedoManager.execute({ name: 'test', execute: () => { value = 1; }, undo: () => { value = 0; } });

    let preventDefaultCalled = false;
    const event = {
      key: 'z',
      ctrlKey: true,
      shiftKey: false,
      altKey: false,
      metaKey: false,
      target: { matches: (sel) => sel.includes('input') },
      preventDefault: () => { preventDefaultCalled = true; },
    };
    listeners[listeners.length - 1](event);
    assert.equal(value, 1); // Value unchanged - undo not triggered
    assert.equal(preventDefaultCalled, false);

    document.addEventListener = origAddEventListener;
  });

  it('ignores Ctrl+Alt+Z (altKey blocks shortcut)', () => {
    let listeners = [];
    const origAddEventListener = document.addEventListener;
    document.addEventListener = (event, fn) => { if (event === 'keydown') listeners.push(fn); };

    bindUndoRedoKeys();

    let value = 0;
    undoRedoManager.execute({ name: 'test', execute: () => { value = 1; }, undo: () => { value = 0; } });

    let preventDefaultCalled = false;
    const event = {
      key: 'z',
      ctrlKey: true,
      shiftKey: false,
      altKey: true,
      metaKey: false,
      target: { matches: () => false },
      preventDefault: () => { preventDefaultCalled = true; },
    };
    listeners[listeners.length - 1](event);
    assert.equal(value, 1); // Not undone
    assert.equal(preventDefaultCalled, false);

    document.addEventListener = origAddEventListener;
  });

  it('metaKey (Cmd on Mac) also triggers undo', () => {
    let listeners = [];
    const origAddEventListener = document.addEventListener;
    document.addEventListener = (event, fn) => { if (event === 'keydown') listeners.push(fn); };

    bindUndoRedoKeys();

    let value = 0;
    undoRedoManager.execute({ name: 'test', execute: () => { value = 1; }, undo: () => { value = 0; } });

    const event = {
      key: 'z',
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      metaKey: true,
      target: { matches: () => false },
      preventDefault: () => {},
    };
    listeners[listeners.length - 1](event);
    assert.equal(value, 0);

    document.addEventListener = origAddEventListener;
  });
});
