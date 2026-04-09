// ─── Unit Tests: CommandExecutor / createCommand ──────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { CommandExecutor, createCommand } from '../../app/modules/command-pattern.js';

// ─── createCommand ────────────────────────────────────────────────────────────

describe('createCommand', () => {
  it('creates a command with an execute function', () => {
    const cmd = createCommand(() => 42);
    assert.equal(typeof cmd.execute, 'function');
  });

  it('execute returns the provided value', () => {
    const cmd = createCommand(() => 99);
    assert.equal(cmd.execute(), 99);
  });

  it('attaches undo when provided', () => {
    const cmd = createCommand(() => {}, () => {});
    assert.equal(typeof cmd.undo, 'function');
  });

  it('undo is undefined when not provided', () => {
    const cmd = createCommand(() => {});
    assert.equal(cmd.undo, undefined);
  });

  it('attaches label when provided', () => {
    const cmd = createCommand(() => {}, undefined, 'my-label');
    assert.equal(cmd.label, 'my-label');
  });

  it('label is undefined when not provided', () => {
    const cmd = createCommand(() => {});
    assert.equal(cmd.label, undefined);
  });
});

// ─── execute ──────────────────────────────────────────────────────────────────

describe('CommandExecutor – execute', () => {
  it('calls the command execute function', async () => {
    const executor = new CommandExecutor();
    let called = false;
    await executor.execute(createCommand(() => { called = true; }));
    assert.equal(called, true);
  });

  it('returns the result of the execute function', async () => {
    const executor = new CommandExecutor();
    const result = await executor.execute(createCommand(() => 'hello'));
    assert.equal(result, 'hello');
  });

  it('increments historyLength for undoable commands', async () => {
    const executor = new CommandExecutor();
    await executor.execute(createCommand(() => {}, () => {}));
    assert.equal(executor.historyLength, 1);
  });

  it('does NOT increment historyLength for commands without undo', async () => {
    const executor = new CommandExecutor();
    await executor.execute(createCommand(() => {}));
    assert.equal(executor.historyLength, 0);
  });
});

// ─── canUndo / canRedo ────────────────────────────────────────────────────────

describe('CommandExecutor – canUndo / canRedo', () => {
  it('canUndo is false initially', () => {
    const executor = new CommandExecutor();
    assert.equal(executor.canUndo, false);
  });

  it('canRedo is false initially', () => {
    const executor = new CommandExecutor();
    assert.equal(executor.canRedo, false);
  });

  it('canUndo is true after executing an undoable command', async () => {
    const executor = new CommandExecutor();
    await executor.execute(createCommand(() => {}, () => {}));
    assert.equal(executor.canUndo, true);
  });

  it('canUndo remains false for non-undoable command', async () => {
    const executor = new CommandExecutor();
    await executor.execute(createCommand(() => {}));
    assert.equal(executor.canUndo, false);
  });

  it('canRedo is true after an undo', async () => {
    const executor = new CommandExecutor();
    await executor.execute(createCommand(() => {}, () => {}));
    await executor.undo();
    assert.equal(executor.canRedo, true);
  });

  it('canRedo becomes false after a new execute (redo stack cleared)', async () => {
    const executor = new CommandExecutor();
    await executor.execute(createCommand(() => {}, () => {}));
    await executor.undo();
    assert.equal(executor.canRedo, true);
    await executor.execute(createCommand(() => {}, () => {}));
    assert.equal(executor.canRedo, false);
  });
});

// ─── undo ─────────────────────────────────────────────────────────────────────

describe('CommandExecutor – undo', () => {
  it('calls the command undo function', async () => {
    const executor = new CommandExecutor();
    let undoCalled = false;
    await executor.execute(createCommand(() => {}, () => { undoCalled = true; }));
    await executor.undo();
    assert.equal(undoCalled, true);
  });

  it('returns true when undo succeeds', async () => {
    const executor = new CommandExecutor();
    await executor.execute(createCommand(() => {}, () => {}));
    const result = await executor.undo();
    assert.equal(result, true);
  });

  it('returns false when nothing to undo', async () => {
    const executor = new CommandExecutor();
    const result = await executor.undo();
    assert.equal(result, false);
  });

  it('decrements historyLength after undo', async () => {
    const executor = new CommandExecutor();
    await executor.execute(createCommand(() => {}, () => {}));
    await executor.undo();
    assert.equal(executor.historyLength, 0);
  });

  it('command without undo: undo returns false', async () => {
    const executor = new CommandExecutor();
    await executor.execute(createCommand(() => 'value'));
    const result = await executor.undo();
    assert.equal(result, false);
  });
});

// ─── redo ─────────────────────────────────────────────────────────────────────

describe('CommandExecutor – redo', () => {
  it('returns false when nothing to redo', async () => {
    const executor = new CommandExecutor();
    const result = await executor.redo();
    assert.equal(result, false);
  });

  it('re-executes the command after undo', async () => {
    const executor = new CommandExecutor();
    let execCount = 0;
    const cmd = createCommand(() => { execCount++; }, () => {});
    await executor.execute(cmd);
    await executor.undo();
    assert.equal(execCount, 1);
    await executor.redo();
    assert.equal(execCount, 2);
  });

  it('returns true when redo succeeds', async () => {
    const executor = new CommandExecutor();
    await executor.execute(createCommand(() => {}, () => {}));
    await executor.undo();
    const result = await executor.redo();
    assert.equal(result, true);
  });

  it('canRedo is false after redoing the last command', async () => {
    const executor = new CommandExecutor();
    await executor.execute(createCommand(() => {}, () => {}));
    await executor.undo();
    await executor.redo();
    assert.equal(executor.canRedo, false);
  });

  it('canUndo is true after redo', async () => {
    const executor = new CommandExecutor();
    await executor.execute(createCommand(() => {}, () => {}));
    await executor.undo();
    await executor.redo();
    assert.equal(executor.canUndo, true);
  });
});

// ─── historyLength ────────────────────────────────────────────────────────────

describe('CommandExecutor – historyLength', () => {
  it('starts at 0', () => {
    const executor = new CommandExecutor();
    assert.equal(executor.historyLength, 0);
  });

  it('increments for each undoable command', async () => {
    const executor = new CommandExecutor();
    await executor.execute(createCommand(() => {}, () => {}));
    await executor.execute(createCommand(() => {}, () => {}));
    assert.equal(executor.historyLength, 2);
  });

  it('does not count non-undoable commands', async () => {
    const executor = new CommandExecutor();
    await executor.execute(createCommand(() => {}));
    await executor.execute(createCommand(() => {}, () => {}));
    assert.equal(executor.historyLength, 1);
  });
});

// ─── clearHistory ─────────────────────────────────────────────────────────────

describe('CommandExecutor – clearHistory', () => {
  it('resets historyLength to 0', async () => {
    const executor = new CommandExecutor();
    await executor.execute(createCommand(() => {}, () => {}));
    executor.clearHistory();
    assert.equal(executor.historyLength, 0);
  });

  it('canUndo is false after clear', async () => {
    const executor = new CommandExecutor();
    await executor.execute(createCommand(() => {}, () => {}));
    executor.clearHistory();
    assert.equal(executor.canUndo, false);
  });

  it('canRedo is false after clear', async () => {
    const executor = new CommandExecutor();
    await executor.execute(createCommand(() => {}, () => {}));
    await executor.undo();
    executor.clearHistory();
    assert.equal(executor.canRedo, false);
  });
});

// ─── async commands ───────────────────────────────────────────────────────────

describe('CommandExecutor – async commands', () => {
  it('handles async execute', async () => {
    const executor = new CommandExecutor();
    const result = await executor.execute(
      createCommand(async () => {
        await Promise.resolve();
        return 'async-result';
      }),
    );
    assert.equal(result, 'async-result');
  });

  it('handles async undo', async () => {
    const executor = new CommandExecutor();
    let undoExecuted = false;
    await executor.execute(
      createCommand(
        async () => { await Promise.resolve(); },
        async () => {
          await Promise.resolve();
          undoExecuted = true;
        },
      ),
    );
    await executor.undo();
    assert.equal(undoExecuted, true);
  });

  it('handles async redo', async () => {
    const executor = new CommandExecutor();
    let execCount = 0;
    await executor.execute(
      createCommand(
        async () => { await Promise.resolve(); execCount++; },
        async () => { await Promise.resolve(); },
      ),
    );
    await executor.undo();
    await executor.redo();
    assert.equal(execCount, 2);
  });
});

// ─── maxHistory ───────────────────────────────────────────────────────────────

describe('CommandExecutor – maxHistory', () => {
  it('caps the undo stack at maxHistory', async () => {
    const executor = new CommandExecutor({ maxHistory: 2 });
    await executor.execute(createCommand(() => {}, () => {}));
    await executor.execute(createCommand(() => {}, () => {}));
    await executor.execute(createCommand(() => {}, () => {}));
    assert.equal(executor.historyLength, 2);
  });
});
