// ─── Unit Tests: FSM Builder ─────────────────────────────────────────────────
// Tests the fluent FSM builder and the resulting FSM behavior.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { FSMBuilder, FSM, createFSMBuilder } from '../../app/modules/fsm-builder.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const States = /** @type {const} */ ({
  IDLE: 'idle',
  LOADING: 'loading',
  LOADED: 'loaded',
  ERROR: 'error',
});

const Events = /** @type {const} */ ({
  FETCH: 'fetch',
  SUCCESS: 'success',
  FAIL: 'fail',
  RETRY: 'retry',
  RESET: 'reset',
});

function makeDataFSM() {
  return createFSMBuilder(States.IDLE)
    .addState(States.LOADING)
    .addState(States.LOADED)
    .addState(States.ERROR)
    .addTransition(States.IDLE, Events.FETCH, States.LOADING)
    .addTransition(States.LOADING, Events.SUCCESS, States.LOADED)
    .addTransition(States.LOADING, Events.FAIL, States.ERROR)
    .addTransition(States.ERROR, Events.RETRY, States.LOADING)
    .addTransition(States.LOADED, Events.RESET, States.IDLE)
    .addTransition(States.ERROR, Events.RESET, States.IDLE)
    .addFinalState(States.LOADED)
    .build();
}

// ─── FSMBuilder ──────────────────────────────────────────────────────────────

describe('FSMBuilder — construction', () => {
  it('createFSMBuilder returns an FSMBuilder instance', () => {
    const builder = createFSMBuilder('start');
    assert.ok(builder instanceof FSMBuilder);
  });

  it('build() returns an FSM instance', () => {
    const fsm = createFSMBuilder('start').build();
    assert.ok(fsm instanceof FSM);
  });

  it('initial state is set correctly', () => {
    const fsm = createFSMBuilder('myState').build();
    assert.equal(fsm.current, 'myState');
  });

  it('builder methods are chainable', () => {
    const builder = createFSMBuilder('a');
    const result = builder
      .addState('b')
      .addTransition('a', 'go', 'b')
      .addFinalState('b')
      .onEnter('b', () => {})
      .onExit('a', () => {});
    assert.ok(result instanceof FSMBuilder);
  });
});

// ─── FSM.send() ──────────────────────────────────────────────────────────────

describe('FSM — send()', () => {
  it('transitions to the correct state', () => {
    const fsm = makeDataFSM();
    fsm.send(Events.FETCH);
    assert.equal(fsm.current, States.LOADING);
  });

  it('returns true on valid transition', () => {
    const fsm = makeDataFSM();
    assert.equal(fsm.send(Events.FETCH), true);
  });

  it('returns false when no transition exists', () => {
    const fsm = makeDataFSM();
    assert.equal(fsm.send(Events.SUCCESS), false);
  });

  it('handles multi-step transitions', () => {
    const fsm = makeDataFSM();
    fsm.send(Events.FETCH);
    fsm.send(Events.SUCCESS);
    assert.equal(fsm.current, States.LOADED);
  });

  it('stays in current state when transition is invalid', () => {
    const fsm = makeDataFSM();
    fsm.send(Events.SUCCESS); // invalid from IDLE
    assert.equal(fsm.current, States.IDLE);
  });
});

// ─── FSM.canSend() ───────────────────────────────────────────────────────────

describe('FSM — canSend()', () => {
  it('returns true for a valid event from the current state', () => {
    const fsm = makeDataFSM();
    assert.equal(fsm.canSend(Events.FETCH), true);
  });

  it('returns false for an invalid event from the current state', () => {
    const fsm = makeDataFSM();
    assert.equal(fsm.canSend(Events.SUCCESS), false);
  });
});

// ─── FSM.isInFinalState ──────────────────────────────────────────────────────

describe('FSM — isInFinalState', () => {
  it('is false when in initial (non-final) state', () => {
    const fsm = makeDataFSM();
    assert.equal(fsm.isInFinalState, false);
  });

  it('is true after reaching a final state', () => {
    const fsm = makeDataFSM();
    fsm.send(Events.FETCH);
    fsm.send(Events.SUCCESS);
    assert.equal(fsm.isInFinalState, true);
  });

  it('is false after transitioning away from a final state', () => {
    const fsm = makeDataFSM();
    fsm.send(Events.FETCH);
    fsm.send(Events.SUCCESS);
    fsm.send(Events.RESET);
    assert.equal(fsm.isInFinalState, false);
  });
});

// ─── FSM.reset() ─────────────────────────────────────────────────────────────

describe('FSM — reset()', () => {
  it('returns to initial state', () => {
    const fsm = makeDataFSM();
    fsm.send(Events.FETCH);
    fsm.send(Events.FAIL);
    fsm.reset();
    assert.equal(fsm.current, States.IDLE);
  });

  it('clears history back to initial state', () => {
    const fsm = makeDataFSM();
    fsm.send(Events.FETCH);
    fsm.reset();
    assert.deepEqual(fsm.history, [States.IDLE]);
  });
});

// ─── FSM.history ─────────────────────────────────────────────────────────────

describe('FSM — history', () => {
  it('starts with the initial state', () => {
    const fsm = makeDataFSM();
    assert.deepEqual(fsm.history, [States.IDLE]);
  });

  it('records each transition', () => {
    const fsm = makeDataFSM();
    fsm.send(Events.FETCH);
    fsm.send(Events.FAIL);
    fsm.send(Events.RETRY);
    assert.deepEqual(fsm.history, [
      States.IDLE,
      States.LOADING,
      States.ERROR,
      States.LOADING,
    ]);
  });

  it('does not record failed transitions', () => {
    const fsm = makeDataFSM();
    fsm.send(Events.SUCCESS); // invalid
    assert.deepEqual(fsm.history, [States.IDLE]);
  });

  it('returns a copy (not a reference)', () => {
    const fsm = makeDataFSM();
    const h1 = fsm.history;
    fsm.send(Events.FETCH);
    const h2 = fsm.history;
    assert.notDeepEqual(h1, h2);
  });
});

// ─── Hooks (onEnter / onExit) ────────────────────────────────────────────────

describe('FSM — hooks', () => {
  it('calls onEnter when entering a state', () => {
    let entered = false;
    const fsm = createFSMBuilder('a')
      .addTransition('a', 'go', 'b')
      .onEnter('b', () => { entered = true; })
      .build();
    fsm.send('go');
    assert.equal(entered, true);
  });

  it('calls onExit when leaving a state', () => {
    let exited = false;
    const fsm = createFSMBuilder('a')
      .addTransition('a', 'go', 'b')
      .onExit('a', () => { exited = true; })
      .build();
    fsm.send('go');
    assert.equal(exited, true);
  });

  it('calls action during transition', () => {
    let actionCalled = false;
    const fsm = createFSMBuilder('a')
      .addTransition('a', 'go', 'b', () => { actionCalled = true; })
      .build();
    fsm.send('go');
    assert.equal(actionCalled, true);
  });

  it('calls hooks in order: exit -> action -> enter', () => {
    const order = [];
    const fsm = createFSMBuilder('a')
      .addTransition('a', 'go', 'b', () => { order.push('action'); })
      .onExit('a', () => { order.push('exit'); })
      .onEnter('b', () => { order.push('enter'); })
      .build();
    fsm.send('go');
    assert.deepEqual(order, ['exit', 'action', 'enter']);
  });
});
