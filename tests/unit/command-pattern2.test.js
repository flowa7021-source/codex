// ─── Unit Tests: command-pattern2 ─────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  CommandHistory,
  compose,
  createCommandHistory,
} from '../../app/modules/command-pattern2.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Simple counter command: add n */
function addCmd(n, name) {
  return {
    name,
    execute: (state) => state + n,
    undo: (state) => state - n,
  };
}

/** String-append command */
function appendCmd(str) {
  return {
    name: `append(${str})`,
    execute: (state) => state + str,
    undo: (state) => state.slice(0, -str.length),
  };
}

// ─── CommandHistory – basic execute / state ────────────────────────────────────

describe('CommandHistory – execute and state', () => {
  it('initial state is the value passed to constructor', () => {
    const h = new CommandHistory(0);
    assert.equal(h.state, 0);
  });

  it('execute applies command and returns new state', () => {
    const h = new CommandHistory(10);
    const result = h.execute(addCmd(5));
    assert.equal(result, 15);
    assert.equal(h.state, 15);
  });

  it('multiple executes accumulate state', () => {
    const h = new CommandHistory(0);
    h.execute(addCmd(3));
    h.execute(addCmd(7));
    assert.equal(h.state, 10);
  });

  it('execute with string state', () => {
    const h = new CommandHistory('');
    h.execute(appendCmd('hello'));
    h.execute(appendCmd(' world'));
    assert.equal(h.state, 'hello world');
  });

  it('execute increases historySize', () => {
    const h = new CommandHistory(0);
    assert.equal(h.historySize, 0);
    h.execute(addCmd(1));
    h.execute(addCmd(1));
    assert.equal(h.historySize, 2);
  });

  it('execute clears redo stack', () => {
    const h = new CommandHistory(0);
    h.execute(addCmd(1));
    h.undo();
    assert.equal(h.redoSize, 1);
    h.execute(addCmd(2));
    assert.equal(h.redoSize, 0);
  });

  it('canUndo is false on fresh history', () => {
    const h = new CommandHistory(42);
    assert.equal(h.canUndo, false);
  });

  it('canUndo is true after execute', () => {
    const h = new CommandHistory(0);
    h.execute(addCmd(1));
    assert.equal(h.canUndo, true);
  });
});

// ─── CommandHistory – undo ─────────────────────────────────────────────────────

describe('CommandHistory – undo', () => {
  it('undo reverses the last command', () => {
    const h = new CommandHistory(0);
    h.execute(addCmd(5));
    h.undo();
    assert.equal(h.state, 0);
  });

  it('undo returns the new state', () => {
    const h = new CommandHistory(10);
    h.execute(addCmd(5));
    const result = h.undo();
    assert.equal(result, 10);
  });

  it('undo returns undefined when nothing to undo', () => {
    const h = new CommandHistory(0);
    const result = h.undo();
    assert.equal(result, undefined);
  });

  it('undo reduces historySize', () => {
    const h = new CommandHistory(0);
    h.execute(addCmd(1));
    h.execute(addCmd(1));
    h.undo();
    assert.equal(h.historySize, 1);
  });

  it('undo increases redoSize', () => {
    const h = new CommandHistory(0);
    h.execute(addCmd(1));
    assert.equal(h.redoSize, 0);
    h.undo();
    assert.equal(h.redoSize, 1);
  });

  it('multiple undos restore earlier states', () => {
    const h = new CommandHistory(0);
    h.execute(addCmd(10));
    h.execute(addCmd(20));
    h.execute(addCmd(30));
    h.undo();
    h.undo();
    assert.equal(h.state, 10);
  });

  it('canUndo becomes false after undoing everything', () => {
    const h = new CommandHistory(0);
    h.execute(addCmd(1));
    h.undo();
    assert.equal(h.canUndo, false);
  });

  it('undo string state correctly', () => {
    const h = new CommandHistory('');
    h.execute(appendCmd('foo'));
    h.execute(appendCmd('bar'));
    h.undo();
    assert.equal(h.state, 'foo');
  });
});

// ─── CommandHistory – redo ─────────────────────────────────────────────────────

describe('CommandHistory – redo', () => {
  it('redo re-applies an undone command', () => {
    const h = new CommandHistory(0);
    h.execute(addCmd(7));
    h.undo();
    h.redo();
    assert.equal(h.state, 7);
  });

  it('redo returns new state', () => {
    const h = new CommandHistory(0);
    h.execute(addCmd(3));
    h.undo();
    const result = h.redo();
    assert.equal(result, 3);
  });

  it('redo returns undefined when nothing to redo', () => {
    const h = new CommandHistory(0);
    h.execute(addCmd(1));
    const result = h.redo();
    assert.equal(result, undefined);
  });

  it('canRedo is false initially', () => {
    const h = new CommandHistory(0);
    assert.equal(h.canRedo, false);
  });

  it('canRedo is true after undo', () => {
    const h = new CommandHistory(0);
    h.execute(addCmd(1));
    h.undo();
    assert.equal(h.canRedo, true);
  });

  it('canRedo becomes false after redo exhausts the stack', () => {
    const h = new CommandHistory(0);
    h.execute(addCmd(1));
    h.undo();
    h.redo();
    assert.equal(h.canRedo, false);
  });

  it('redo after partial undo re-applies correct commands', () => {
    const h = new CommandHistory(0);
    h.execute(addCmd(10));
    h.execute(addCmd(20));
    h.execute(addCmd(30));
    h.undo(); // removes 30 → state 30
    h.undo(); // removes 20 → state 10
    h.redo(); // re-applies 20 → state 30
    assert.equal(h.state, 30);
  });

  it('redo pushes command back to undo stack', () => {
    const h = new CommandHistory(0);
    h.execute(addCmd(1));
    h.undo();
    h.redo();
    assert.equal(h.historySize, 1);
    assert.equal(h.redoSize, 0);
  });
});

// ─── CommandHistory – maxHistory ──────────────────────────────────────────────

describe('CommandHistory – maxHistory option', () => {
  it('respects maxHistory by dropping oldest commands', () => {
    const h = new CommandHistory(0, { maxHistory: 3 });
    h.execute(addCmd(1, 'a'));
    h.execute(addCmd(2, 'b'));
    h.execute(addCmd(3, 'c'));
    h.execute(addCmd(4, 'd'));
    // oldest ('a') should be dropped
    assert.equal(h.historySize, 3);
    assert.deepEqual(h.getHistory(), ['b', 'c', 'd']);
  });

  it('state is still correct after dropping old history', () => {
    const h = new CommandHistory(0, { maxHistory: 2 });
    h.execute(addCmd(1));
    h.execute(addCmd(2));
    h.execute(addCmd(3));
    // state should be 1+2+3 = 6 regardless of dropped history
    assert.equal(h.state, 6);
  });

  it('maxHistory of 1 keeps only the last command', () => {
    const h = new CommandHistory(0, { maxHistory: 1 });
    h.execute(addCmd(10, 'first'));
    h.execute(addCmd(20, 'second'));
    assert.equal(h.historySize, 1);
    assert.deepEqual(h.getHistory(), ['second']);
  });
});

// ─── CommandHistory – clear and getHistory ────────────────────────────────────

describe('CommandHistory – clear and getHistory', () => {
  it('clear empties undo and redo stacks', () => {
    const h = new CommandHistory(0);
    h.execute(addCmd(1));
    h.execute(addCmd(2));
    h.undo();
    h.clear();
    assert.equal(h.historySize, 0);
    assert.equal(h.redoSize, 0);
  });

  it('clear preserves current state', () => {
    const h = new CommandHistory(0);
    h.execute(addCmd(5));
    h.clear();
    assert.equal(h.state, 5);
  });

  it('getHistory returns command names oldest to newest', () => {
    const h = new CommandHistory(0);
    h.execute(addCmd(1, 'first'));
    h.execute(addCmd(2, 'second'));
    h.execute(addCmd(3, 'third'));
    assert.deepEqual(h.getHistory(), ['first', 'second', 'third']);
  });

  it('getHistory returns empty string for unnamed commands', () => {
    const h = new CommandHistory(0);
    h.execute(addCmd(1)); // no name
    assert.deepEqual(h.getHistory(), ['']);
  });

  it('getHistory returns empty array when history is empty', () => {
    const h = new CommandHistory(0);
    assert.deepEqual(h.getHistory(), []);
  });

  it('getHistory reflects undo (command removed)', () => {
    const h = new CommandHistory(0);
    h.execute(addCmd(1, 'a'));
    h.execute(addCmd(2, 'b'));
    h.undo();
    assert.deepEqual(h.getHistory(), ['a']);
  });

  it('getHistory reflects redo (command added back)', () => {
    const h = new CommandHistory(0);
    h.execute(addCmd(1, 'a'));
    h.undo();
    h.redo();
    assert.deepEqual(h.getHistory(), ['a']);
  });

  it('canUndo is false after clear', () => {
    const h = new CommandHistory(0);
    h.execute(addCmd(1));
    h.clear();
    assert.equal(h.canUndo, false);
  });
});

// ─── compose ──────────────────────────────────────────────────────────────────

describe('compose', () => {
  it('composed command applies all sub-commands in order', () => {
    const multi = compose(addCmd(10), addCmd(20), addCmd(30));
    const h = new CommandHistory(0);
    h.execute(multi);
    assert.equal(h.state, 60);
  });

  it('undoing a composed command reverses all sub-commands', () => {
    const multi = compose(addCmd(10), addCmd(20));
    const h = new CommandHistory(0);
    h.execute(multi);
    h.undo();
    assert.equal(h.state, 0);
  });

  it('compose names the result with joined sub-command names', () => {
    const multi = compose(addCmd(1, 'a'), addCmd(2, 'b'), addCmd(3, 'c'));
    assert.equal(multi.name, 'a+b+c');
  });

  it('compose with unnamed commands produces plus-separated empties', () => {
    const multi = compose(addCmd(1), addCmd(2));
    assert.equal(multi.name, '+');
  });

  it('compose of single command works correctly', () => {
    const single = compose(addCmd(7, 'seven'));
    const h = new CommandHistory(0);
    h.execute(single);
    assert.equal(h.state, 7);
    h.undo();
    assert.equal(h.state, 0);
  });

  it('composed command counts as one entry in history', () => {
    const multi = compose(addCmd(1), addCmd(2), addCmd(3));
    const h = new CommandHistory(0);
    h.execute(multi);
    assert.equal(h.historySize, 1);
  });

  it('undo/redo roundtrip with composed command', () => {
    const multi = compose(addCmd(5), addCmd(5));
    const h = new CommandHistory(0);
    h.execute(multi);
    h.undo();
    h.redo();
    assert.equal(h.state, 10);
  });

  it('string state with composed appends and undo', () => {
    const multi = compose(appendCmd('foo'), appendCmd('bar'));
    const h = new CommandHistory('');
    h.execute(multi);
    assert.equal(h.state, 'foobar');
    h.undo();
    assert.equal(h.state, '');
  });
});

// ─── createCommandHistory factory ─────────────────────────────────────────────

describe('createCommandHistory factory', () => {
  it('returns a CommandHistory instance', () => {
    const h = createCommandHistory(0);
    assert.ok(h instanceof CommandHistory);
  });

  it('initial state matches the argument', () => {
    const h = createCommandHistory({ count: 42 });
    assert.deepEqual(h.state, { count: 42 });
  });

  it('accepts maxHistory option', () => {
    const h = createCommandHistory(0, { maxHistory: 2 });
    h.execute(addCmd(1, 'a'));
    h.execute(addCmd(2, 'b'));
    h.execute(addCmd(3, 'c'));
    assert.equal(h.historySize, 2);
  });

  it('works with object state', () => {
    const inc = {
      name: 'increment',
      execute: (s) => ({ ...s, count: s.count + 1 }),
      undo: (s) => ({ ...s, count: s.count - 1 }),
    };
    const h = createCommandHistory({ count: 0 });
    h.execute(inc);
    h.execute(inc);
    assert.equal(h.state.count, 2);
    h.undo();
    assert.equal(h.state.count, 1);
  });

  it('factory history starts empty', () => {
    const h = createCommandHistory('start');
    assert.equal(h.historySize, 0);
    assert.equal(h.redoSize, 0);
  });
});
