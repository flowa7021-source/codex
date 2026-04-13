// ─── Unit Tests: Command Pattern ─────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  CommandHistory,
  MacroCommand,
  createCommand,
  createHistory,
} from '../../app/modules/command.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a simple increment/decrement command that mutates a counter object. */
function makeCountCmd(counter, amount = 1, description = undefined) {
  return createCommand(
    () => { counter.value += amount; },
    () => { counter.value -= amount; },
    description,
  );
}

// ─── CommandHistory: execute ──────────────────────────────────────────────────

describe('CommandHistory – execute', () => {
  it('calls execute() on the command', () => {
    const history = new CommandHistory();
    const counter = { value: 0 };
    history.execute(makeCountCmd(counter));
    assert.equal(counter.value, 1);
  });

  it('multiple executes accumulate', () => {
    const history = new CommandHistory();
    const counter = { value: 0 };
    history.execute(makeCountCmd(counter));
    history.execute(makeCountCmd(counter));
    history.execute(makeCountCmd(counter));
    assert.equal(counter.value, 3);
  });

  it('historySize increases after each execute', () => {
    const history = new CommandHistory();
    const counter = { value: 0 };
    assert.equal(history.historySize, 0);
    history.execute(makeCountCmd(counter));
    assert.equal(history.historySize, 1);
    history.execute(makeCountCmd(counter));
    assert.equal(history.historySize, 2);
  });

  it('execute with a command object (not createCommand)', () => {
    const history = new CommandHistory();
    let executed = false;
    const cmd = { execute: () => { executed = true; }, undo: () => { executed = false; } };
    history.execute(cmd);
    assert.equal(executed, true);
  });
});

// ─── CommandHistory: undo ─────────────────────────────────────────────────────

describe('CommandHistory – undo', () => {
  it('undo reverses the last command', () => {
    const history = new CommandHistory();
    const counter = { value: 0 };
    history.execute(makeCountCmd(counter));
    assert.equal(counter.value, 1);
    history.undo();
    assert.equal(counter.value, 0);
  });

  it('undo returns true when there is something to undo', () => {
    const history = new CommandHistory();
    const counter = { value: 0 };
    history.execute(makeCountCmd(counter));
    assert.equal(history.undo(), true);
  });

  it('undo returns false when history is empty', () => {
    const history = new CommandHistory();
    assert.equal(history.undo(), false);
  });

  it('multiple undos in sequence', () => {
    const history = new CommandHistory();
    const counter = { value: 0 };
    history.execute(makeCountCmd(counter, 1));
    history.execute(makeCountCmd(counter, 10));
    history.execute(makeCountCmd(counter, 100));
    assert.equal(counter.value, 111);
    history.undo();
    assert.equal(counter.value, 11);
    history.undo();
    assert.equal(counter.value, 1);
    history.undo();
    assert.equal(counter.value, 0);
  });

  it('undo reduces historySize by 1', () => {
    const history = new CommandHistory();
    const counter = { value: 0 };
    history.execute(makeCountCmd(counter));
    history.execute(makeCountCmd(counter));
    assert.equal(history.historySize, 2);
    history.undo();
    assert.equal(history.historySize, 1);
  });

  it('undo on empty history after all commands undone returns false', () => {
    const history = new CommandHistory();
    const counter = { value: 0 };
    history.execute(makeCountCmd(counter));
    history.undo();
    assert.equal(history.undo(), false);
  });
});

// ─── CommandHistory: redo ─────────────────────────────────────────────────────

describe('CommandHistory – redo', () => {
  it('redo re-executes the last undone command', () => {
    const history = new CommandHistory();
    const counter = { value: 0 };
    history.execute(makeCountCmd(counter));
    history.undo();
    assert.equal(counter.value, 0);
    history.redo();
    assert.equal(counter.value, 1);
  });

  it('redo returns true when there is something to redo', () => {
    const history = new CommandHistory();
    const counter = { value: 0 };
    history.execute(makeCountCmd(counter));
    history.undo();
    assert.equal(history.redo(), true);
  });

  it('redo returns false when redo stack is empty', () => {
    const history = new CommandHistory();
    assert.equal(history.redo(), false);
  });

  it('redo after execute without undo returns false', () => {
    const history = new CommandHistory();
    const counter = { value: 0 };
    history.execute(makeCountCmd(counter));
    assert.equal(history.redo(), false);
  });

  it('redo increases historySize', () => {
    const history = new CommandHistory();
    const counter = { value: 0 };
    history.execute(makeCountCmd(counter));
    history.undo();
    assert.equal(history.historySize, 0);
    history.redo();
    assert.equal(history.historySize, 1);
  });

  it('multiple redos restore state in order', () => {
    const history = new CommandHistory();
    const counter = { value: 0 };
    history.execute(makeCountCmd(counter, 1));
    history.execute(makeCountCmd(counter, 10));
    history.execute(makeCountCmd(counter, 100));
    history.undo();
    history.undo();
    history.undo();
    assert.equal(counter.value, 0);
    history.redo();
    assert.equal(counter.value, 1);
    history.redo();
    assert.equal(counter.value, 11);
    history.redo();
    assert.equal(counter.value, 111);
  });
});

// ─── canUndo / canRedo ────────────────────────────────────────────────────────

describe('CommandHistory – canUndo / canRedo', () => {
  it('canUndo is false on fresh history', () => {
    const history = new CommandHistory();
    assert.equal(history.canUndo, false);
  });

  it('canUndo is true after execute', () => {
    const history = new CommandHistory();
    const counter = { value: 0 };
    history.execute(makeCountCmd(counter));
    assert.equal(history.canUndo, true);
  });

  it('canUndo becomes false after undoing all', () => {
    const history = new CommandHistory();
    const counter = { value: 0 };
    history.execute(makeCountCmd(counter));
    history.undo();
    assert.equal(history.canUndo, false);
  });

  it('canRedo is false on fresh history', () => {
    const history = new CommandHistory();
    assert.equal(history.canRedo, false);
  });

  it('canRedo is true after undo', () => {
    const history = new CommandHistory();
    const counter = { value: 0 };
    history.execute(makeCountCmd(counter));
    history.undo();
    assert.equal(history.canRedo, true);
  });

  it('canRedo is false after redo exhausts stack', () => {
    const history = new CommandHistory();
    const counter = { value: 0 };
    history.execute(makeCountCmd(counter));
    history.undo();
    history.redo();
    assert.equal(history.canRedo, false);
  });
});

// ─── historySize / redoSize ───────────────────────────────────────────────────

describe('CommandHistory – historySize / redoSize', () => {
  it('starts at 0 / 0', () => {
    const history = new CommandHistory();
    assert.equal(history.historySize, 0);
    assert.equal(history.redoSize, 0);
  });

  it('redoSize increases after undo', () => {
    const history = new CommandHistory();
    const counter = { value: 0 };
    history.execute(makeCountCmd(counter));
    history.execute(makeCountCmd(counter));
    history.undo();
    assert.equal(history.redoSize, 1);
    history.undo();
    assert.equal(history.redoSize, 2);
  });

  it('redoSize decreases after redo', () => {
    const history = new CommandHistory();
    const counter = { value: 0 };
    history.execute(makeCountCmd(counter));
    history.undo();
    assert.equal(history.redoSize, 1);
    history.redo();
    assert.equal(history.redoSize, 0);
  });

  it('historySize and redoSize sum tracks total commands', () => {
    const history = new CommandHistory();
    const counter = { value: 0 };
    history.execute(makeCountCmd(counter));
    history.execute(makeCountCmd(counter));
    history.execute(makeCountCmd(counter));
    history.undo();
    // 2 on undo stack, 1 on redo stack
    assert.equal(history.historySize + history.redoSize, 3);
  });
});

// ─── maxHistory limit ─────────────────────────────────────────────────────────

describe('CommandHistory – maxHistory', () => {
  it('does not exceed maxHistory on undo stack', () => {
    const history = new CommandHistory({ maxHistory: 3 });
    const counter = { value: 0 };
    for (let i = 0; i < 10; i++) {
      history.execute(makeCountCmd(counter));
    }
    assert.equal(history.historySize, 3);
    assert.equal(counter.value, 10);
  });

  it('oldest commands are dropped when limit exceeded', () => {
    const history = new CommandHistory({ maxHistory: 2 });
    const log = [];
    const makeCmd = (id) => ({
      execute: () => log.push(`exec:${id}`),
      undo: () => log.push(`undo:${id}`),
      description: `cmd-${id}`,
    });
    history.execute(makeCmd('A'));
    history.execute(makeCmd('B'));
    history.execute(makeCmd('C')); // A is dropped
    assert.equal(history.historySize, 2);
    // Undo stack should contain B and C (A is gone)
    const stack = history.getUndoStack();
    assert.deepEqual(stack, ['cmd-C', 'cmd-B']);
  });

  it('maxHistory of 1 keeps only the most recent command', () => {
    const history = new CommandHistory({ maxHistory: 1 });
    const counter = { value: 0 };
    history.execute(makeCountCmd(counter, 1, 'first'));
    history.execute(makeCountCmd(counter, 2, 'second'));
    assert.equal(history.historySize, 1);
    assert.deepEqual(history.getUndoStack(), ['second']);
  });

  it('defaults to 100 when no maxHistory specified', () => {
    const history = new CommandHistory();
    const counter = { value: 0 };
    for (let i = 0; i < 100; i++) {
      history.execute(makeCountCmd(counter));
    }
    assert.equal(history.historySize, 100);
    history.execute(makeCountCmd(counter));
    assert.equal(history.historySize, 100);
  });
});

// ─── clear() ─────────────────────────────────────────────────────────────────

describe('CommandHistory – clear()', () => {
  it('clears the undo stack', () => {
    const history = new CommandHistory();
    const counter = { value: 0 };
    history.execute(makeCountCmd(counter));
    history.execute(makeCountCmd(counter));
    history.clear();
    assert.equal(history.historySize, 0);
    assert.equal(history.canUndo, false);
  });

  it('clears the redo stack', () => {
    const history = new CommandHistory();
    const counter = { value: 0 };
    history.execute(makeCountCmd(counter));
    history.undo();
    history.clear();
    assert.equal(history.redoSize, 0);
    assert.equal(history.canRedo, false);
  });

  it('clears both stacks simultaneously', () => {
    const history = new CommandHistory();
    const counter = { value: 0 };
    history.execute(makeCountCmd(counter));
    history.execute(makeCountCmd(counter));
    history.undo();
    history.clear();
    assert.equal(history.historySize, 0);
    assert.equal(history.redoSize, 0);
  });

  it('clear on empty history is safe', () => {
    const history = new CommandHistory();
    assert.doesNotThrow(() => history.clear());
    assert.equal(history.historySize, 0);
    assert.equal(history.redoSize, 0);
  });
});

// ─── getUndoStack / getRedoStack ──────────────────────────────────────────────

describe('CommandHistory – getUndoStack() / getRedoStack()', () => {
  it('getUndoStack() returns empty array when empty', () => {
    const history = new CommandHistory();
    assert.deepEqual(history.getUndoStack(), []);
  });

  it('getRedoStack() returns empty array when empty', () => {
    const history = new CommandHistory();
    assert.deepEqual(history.getRedoStack(), []);
  });

  it('getUndoStack() returns descriptions most-recent first', () => {
    const history = new CommandHistory();
    const counter = { value: 0 };
    history.execute(makeCountCmd(counter, 1, 'first'));
    history.execute(makeCountCmd(counter, 1, 'second'));
    history.execute(makeCountCmd(counter, 1, 'third'));
    assert.deepEqual(history.getUndoStack(), ['third', 'second', 'first']);
  });

  it('getRedoStack() returns descriptions next-to-redo first', () => {
    const history = new CommandHistory();
    const counter = { value: 0 };
    history.execute(makeCountCmd(counter, 1, 'first'));
    history.execute(makeCountCmd(counter, 1, 'second'));
    history.execute(makeCountCmd(counter, 1, 'third'));
    history.undo();
    history.undo();
    // redo stack order: next-to-redo is 'second', then 'third'
    assert.deepEqual(history.getRedoStack(), ['second', 'third']);
  });

  it('commands without description appear as empty string', () => {
    const history = new CommandHistory();
    const counter = { value: 0 };
    history.execute(makeCountCmd(counter)); // no description
    const stack = history.getUndoStack();
    assert.deepEqual(stack, ['']);
  });

  it('getUndoStack() does not mutate internal state', () => {
    const history = new CommandHistory();
    const counter = { value: 0 };
    history.execute(makeCountCmd(counter, 1, 'a'));
    const stack = history.getUndoStack();
    stack.push('tamper');
    assert.equal(history.historySize, 1);
  });
});

// ─── Redo stack cleared after new execute ────────────────────────────────────

describe('CommandHistory – redo stack cleared after new execute', () => {
  it('executing a new command clears redo stack', () => {
    const history = new CommandHistory();
    const counter = { value: 0 };
    history.execute(makeCountCmd(counter, 1));
    history.undo();
    assert.equal(history.canRedo, true);
    history.execute(makeCountCmd(counter, 5));
    assert.equal(history.canRedo, false);
    assert.equal(history.redoSize, 0);
  });

  it('redo is not available after execute on new branch', () => {
    const history = new CommandHistory();
    const counter = { value: 0 };
    history.execute(makeCountCmd(counter, 1, 'A'));
    history.execute(makeCountCmd(counter, 1, 'B'));
    history.undo();
    history.undo();
    history.execute(makeCountCmd(counter, 10, 'C'));
    assert.equal(history.redo(), false);
    assert.equal(history.historySize, 1);
    assert.deepEqual(history.getUndoStack(), ['C']);
  });

  it('redoSize becomes 0 after new execute', () => {
    const history = new CommandHistory();
    const counter = { value: 0 };
    history.execute(makeCountCmd(counter));
    history.execute(makeCountCmd(counter));
    history.undo();
    history.undo();
    assert.equal(history.redoSize, 2);
    history.execute(makeCountCmd(counter));
    assert.equal(history.redoSize, 0);
  });
});

// ─── MacroCommand ─────────────────────────────────────────────────────────────

describe('MacroCommand', () => {
  it('execute calls all sub-commands in order', () => {
    const log = [];
    const a = createCommand(() => log.push('A'), () => log.push('undoA'));
    const b = createCommand(() => log.push('B'), () => log.push('undoB'));
    const c = createCommand(() => log.push('C'), () => log.push('undoC'));
    const macro = new MacroCommand([a, b, c]);
    macro.execute();
    assert.deepEqual(log, ['A', 'B', 'C']);
  });

  it('undo calls sub-commands in reverse order', () => {
    const log = [];
    const a = createCommand(() => log.push('A'), () => log.push('undoA'));
    const b = createCommand(() => log.push('B'), () => log.push('undoB'));
    const c = createCommand(() => log.push('C'), () => log.push('undoC'));
    const macro = new MacroCommand([a, b, c]);
    macro.execute();
    log.length = 0;
    macro.undo();
    assert.deepEqual(log, ['undoC', 'undoB', 'undoA']);
  });

  it('stores optional description', () => {
    const macro = new MacroCommand([], 'batch operation');
    assert.equal(macro.description, 'batch operation');
  });

  it('description is undefined when not provided', () => {
    const macro = new MacroCommand([]);
    assert.equal(macro.description, undefined);
  });

  it('works with CommandHistory (treated as single unit)', () => {
    const history = new CommandHistory();
    const counter = { value: 0 };
    const a = makeCountCmd(counter, 1);
    const b = makeCountCmd(counter, 10);
    const macro = new MacroCommand([a, b], 'add 11');
    history.execute(macro);
    assert.equal(counter.value, 11);
    history.undo();
    assert.equal(counter.value, 0);
    history.redo();
    assert.equal(counter.value, 11);
  });

  it('execute / undo with a single sub-command', () => {
    const counter = { value: 0 };
    const macro = new MacroCommand([makeCountCmd(counter, 5)]);
    macro.execute();
    assert.equal(counter.value, 5);
    macro.undo();
    assert.equal(counter.value, 0);
  });

  it('empty MacroCommand does not throw', () => {
    const macro = new MacroCommand([]);
    assert.doesNotThrow(() => macro.execute());
    assert.doesNotThrow(() => macro.undo());
  });

  it('does not share state between two MacroCommand instances', () => {
    const log = [];
    const a = createCommand(() => log.push('A'), () => {});
    const macro1 = new MacroCommand([a]);
    const macro2 = new MacroCommand([a]);
    macro1.execute();
    macro2.execute();
    assert.deepEqual(log, ['A', 'A']);
  });
});

// ─── createCommand helper ─────────────────────────────────────────────────────

describe('createCommand', () => {
  it('returns an object with execute and undo', () => {
    const cmd = createCommand(() => {}, () => {});
    assert.equal(typeof cmd.execute, 'function');
    assert.equal(typeof cmd.undo, 'function');
  });

  it('execute function is called correctly', () => {
    let called = false;
    const cmd = createCommand(() => { called = true; }, () => {});
    cmd.execute();
    assert.equal(called, true);
  });

  it('undo function is called correctly', () => {
    let called = false;
    const cmd = createCommand(() => {}, () => { called = true; });
    cmd.undo();
    assert.equal(called, true);
  });

  it('description is set when provided', () => {
    const cmd = createCommand(() => {}, () => {}, 'my command');
    assert.equal(cmd.description, 'my command');
  });

  it('description is undefined when not provided', () => {
    const cmd = createCommand(() => {}, () => {});
    assert.equal(cmd.description, undefined);
  });

  it('execute and undo can access closure state', () => {
    const state = { x: 0 };
    const cmd = createCommand(
      () => { state.x += 10; },
      () => { state.x -= 10; },
    );
    cmd.execute();
    assert.equal(state.x, 10);
    cmd.undo();
    assert.equal(state.x, 0);
  });
});

// ─── createHistory factory ────────────────────────────────────────────────────

describe('createHistory', () => {
  it('returns a CommandHistory instance', () => {
    const history = createHistory();
    assert.ok(history instanceof CommandHistory);
  });

  it('createHistory() with no args creates default history', () => {
    const history = createHistory();
    assert.equal(history.historySize, 0);
    assert.equal(history.canUndo, false);
  });

  it('createHistory({ maxHistory }) respects limit', () => {
    const history = createHistory({ maxHistory: 2 });
    const counter = { value: 0 };
    history.execute(makeCountCmd(counter));
    history.execute(makeCountCmd(counter));
    history.execute(makeCountCmd(counter));
    assert.equal(history.historySize, 2);
  });

  it('createHistory instances are independent', () => {
    const h1 = createHistory();
    const h2 = createHistory();
    const counter = { value: 0 };
    h1.execute(makeCountCmd(counter));
    assert.equal(h1.historySize, 1);
    assert.equal(h2.historySize, 0);
  });
});
