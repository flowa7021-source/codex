// ─── Unit Tests: StateMachine ─────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  StateMachine,
  createMachine,
} from '../../app/modules/state-machine.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Traffic-light FSM:  red -> green -> yellow -> red  (NEXT cycles)
 * Optional onEnter / onExit hooks for testing.
 */
function makeTrafficLight(extra = {}) {
  return new StateMachine(
    {
      states: ['red', 'green', 'yellow'],
      initial: 'red',
      transitions: [
        { from: 'red',    event: 'NEXT', to: 'green'  },
        { from: 'green',  event: 'NEXT', to: 'yellow' },
        { from: 'yellow', event: 'NEXT', to: 'red'    },
      ],
      ...extra,
    },
    {},
  );
}

// ─── Basic transitions ────────────────────────────────────────────────────────

describe('StateMachine – basic transitions', () => {
  it('starts in the initial state', () => {
    const m = makeTrafficLight();
    assert.equal(m.state, 'red');
  });

  it('red -> green on NEXT, returns new state', () => {
    const m = makeTrafficLight();
    const next = m.send('NEXT');
    assert.equal(next, 'green');
    assert.equal(m.state, 'green');
  });

  it('green -> yellow -> red full cycle', () => {
    const m = makeTrafficLight();
    m.send('NEXT'); // green
    m.send('NEXT'); // yellow
    m.send('NEXT'); // red
    assert.equal(m.state, 'red');
  });

  it('from as array fires from any listed state', () => {
    const m = new StateMachine({
      states: ['a', 'b', 'done'],
      initial: 'a',
      transitions: [
        { from: ['a', 'b'], event: 'GO', to: 'done' },
        { from: 'done',     event: 'BACK', to: 'a'  },
      ],
    });
    m.send('GO');
    assert.equal(m.state, 'done');

    m.send('BACK');
    assert.equal(m.state, 'a');

    // From 'b'
    const m2 = new StateMachine({
      states: ['a', 'b', 'done'],
      initial: 'b',
      transitions: [
        { from: ['a', 'b'], event: 'GO', to: 'done' },
      ],
    });
    m2.send('GO');
    assert.equal(m2.state, 'done');
  });
});

// ─── Invalid transitions throw ────────────────────────────────────────────────

describe('StateMachine – invalid transitions throw', () => {
  it('throws when event is unknown', () => {
    const m = makeTrafficLight();
    assert.throws(() => m.send('BOGUS'), /No valid transition/);
  });

  it('throws when event is valid but not from current state', () => {
    const m = new StateMachine({
      states: ['idle', 'running', 'done'],
      initial: 'idle',
      transitions: [
        { from: 'idle',    event: 'START', to: 'running' },
        { from: 'running', event: 'STOP',  to: 'done'    },
      ],
    });
    // STOP is only from 'running', not 'idle'
    assert.throws(() => m.send('STOP'), /No valid transition/);
    assert.equal(m.state, 'idle');
  });

  it('state does not change after a throw', () => {
    const m = makeTrafficLight();
    try { m.send('UNKNOWN'); } catch (_) { /* expected */ }
    assert.equal(m.state, 'red');
  });
});

// ─── Guards ───────────────────────────────────────────────────────────────────

describe('StateMachine – guards', () => {
  it('transition is blocked and throws when guard returns false', () => {
    const m = new StateMachine(
      {
        states: ['idle', 'running'],
        initial: 'idle',
        transitions: [
          {
            from: 'idle',
            event: 'START',
            to: 'running',
            guard: (ctx) => ctx['ready'] === true,
          },
        ],
      },
      { ready: false },
    );
    assert.throws(() => m.send('START'), /No valid transition/);
    assert.equal(m.state, 'idle');
  });

  it('transition proceeds when guard returns true', () => {
    const m = new StateMachine(
      {
        states: ['idle', 'running'],
        initial: 'idle',
        transitions: [
          {
            from: 'idle',
            event: 'START',
            to: 'running',
            guard: (ctx) => ctx['ready'] === true,
          },
        ],
      },
      { ready: true },
    );
    m.send('START');
    assert.equal(m.state, 'running');
  });

  it('can() returns false when guard blocks the event', () => {
    const m = new StateMachine({
      states: ['idle', 'running'],
      initial: 'idle',
      transitions: [
        { from: 'idle', event: 'START', to: 'running', guard: () => false },
      ],
    });
    assert.equal(m.can('START'), false);
  });

  it('validEvents() excludes events blocked by a guard', () => {
    const m = new StateMachine({
      states: ['idle', 'running'],
      initial: 'idle',
      transitions: [
        { from: 'idle', event: 'START', to: 'running', guard: () => false },
        { from: 'idle', event: 'RESET', to: 'idle' },
      ],
    });
    assert.deepEqual(m.validEvents(), ['RESET']);
  });
});

// ─── Actions ──────────────────────────────────────────────────────────────────

describe('StateMachine – actions', () => {
  it('action is called on transition and can mutate context', () => {
    const m = new StateMachine(
      {
        states: ['a', 'b'],
        initial: 'a',
        transitions: [
          {
            from: 'a',
            event: 'GO',
            to: 'b',
            action: (ctx) => { ctx['visited'] = true; },
          },
        ],
      },
      { visited: false },
    );
    m.send('GO');
    assert.equal(m.context['visited'], true);
  });

  it('action fires between onExit and onEnter', () => {
    const order = [];
    const m = new StateMachine({
      states: ['a', 'b'],
      initial: 'a',
      transitions: [
        {
          from: 'a',
          event: 'GO',
          to: 'b',
          action: () => order.push('action'),
        },
      ],
      onExit:  { a: () => order.push('exitA') },
      onEnter: { b: () => order.push('enterB') },
    });
    m.send('GO');
    assert.deepEqual(order, ['exitA', 'action', 'enterB']);
  });

  it('context accumulates across multiple transitions', () => {
    const m = new StateMachine(
      {
        states: ['counting'],
        initial: 'counting',
        transitions: [
          {
            from: 'counting',
            event: 'INC',
            to: 'counting',
            action: (ctx) => { ctx['count'] = (/** @type {number} */ (ctx['count']) ?? 0) + 1; },
          },
        ],
      },
      { count: 0 },
    );
    m.send('INC');
    m.send('INC');
    m.send('INC');
    assert.equal(m.context['count'], 3);
  });
});

// ─── onEnter / onExit hooks ───────────────────────────────────────────────────

describe('StateMachine – onEnter / onExit hooks', () => {
  it('onEnter fires when entering a state', () => {
    const entered = [];
    const m = makeTrafficLight({
      onEnter: {
        green: () => entered.push('green'),
      },
    });
    m.send('NEXT');
    assert.deepEqual(entered, ['green']);
  });

  it('onExit fires when leaving a state', () => {
    const exited = [];
    const m = makeTrafficLight({
      onExit: {
        red: () => exited.push('red'),
      },
    });
    m.send('NEXT');
    assert.deepEqual(exited, ['red']);
  });

  it('onExit fires before onEnter', () => {
    const order = [];
    const m = makeTrafficLight({
      onExit:  { red:   () => order.push('exit:red')   },
      onEnter: { green: () => order.push('enter:green') },
    });
    m.send('NEXT');
    assert.deepEqual(order, ['exit:red', 'enter:green']);
  });

  it('hooks receive context', () => {
    const received = [];
    const m = new StateMachine(
      {
        states: ['a', 'b'],
        initial: 'a',
        transitions: [{ from: 'a', event: 'GO', to: 'b' }],
        onEnter: { b: (ctx) => received.push(ctx['token']) },
      },
      { token: 42 },
    );
    m.send('GO');
    assert.deepEqual(received, [42]);
  });
});

// ─── can() and validEvents() ──────────────────────────────────────────────────

describe('StateMachine – can() and validEvents()', () => {
  it('can() returns true for a valid event', () => {
    const m = makeTrafficLight();
    assert.equal(m.can('NEXT'), true);
  });

  it('can() returns false for an unknown event', () => {
    const m = makeTrafficLight();
    assert.equal(m.can('STOP'), false);
  });

  it('can() returns false for an event not applicable in current state', () => {
    const m = new StateMachine({
      states: ['idle', 'running'],
      initial: 'idle',
      transitions: [
        { from: 'idle',    event: 'START', to: 'running' },
        { from: 'running', event: 'STOP',  to: 'idle'    },
      ],
    });
    assert.equal(m.can('STOP'), false);
  });

  it('validEvents() lists all current valid events', () => {
    const m = makeTrafficLight();
    assert.deepEqual(m.validEvents(), ['NEXT']);
  });

  it('validEvents() is empty when no transitions apply', () => {
    const m = new StateMachine({
      states: ['start', 'done'],
      initial: 'done',
      transitions: [{ from: 'start', event: 'GO', to: 'done' }],
    });
    assert.deepEqual(m.validEvents(), []);
  });

  it('validEvents() deduplicates events from array-from transitions', () => {
    const m = new StateMachine({
      states: ['a', 'b', 'done'],
      initial: 'a',
      transitions: [
        { from: 'a', event: 'GO', to: 'done' },
        { from: 'a', event: 'GO', to: 'b' }, // duplicate event, different target
      ],
    });
    // Only one 'GO' entry should appear
    assert.deepEqual(m.validEvents(), ['GO']);
  });
});

// ─── history ──────────────────────────────────────────────────────────────────

describe('StateMachine – history', () => {
  it('history starts with the initial state', () => {
    const m = makeTrafficLight();
    assert.deepEqual(m.history, ['red']);
  });

  it('history records each visited state', () => {
    const m = makeTrafficLight();
    m.send('NEXT'); // green
    m.send('NEXT'); // yellow
    assert.deepEqual(m.history, ['red', 'green', 'yellow']);
  });

  it('history() returns a copy (mutations do not affect internal state)', () => {
    const m = makeTrafficLight();
    const h = m.history;
    h.push('tampered');
    assert.equal(m.history.length, 1);
  });
});

// ─── reset() ──────────────────────────────────────────────────────────────────

describe('StateMachine – reset()', () => {
  it('returns to initial state', () => {
    const m = makeTrafficLight();
    m.send('NEXT'); // green
    m.send('NEXT'); // yellow
    m.reset();
    assert.equal(m.state, 'red');
  });

  it('clears history on reset', () => {
    const m = makeTrafficLight();
    m.send('NEXT');
    m.reset();
    assert.deepEqual(m.history, ['red']);
  });

  it('context is preserved after reset', () => {
    const m = new StateMachine(
      {
        states: ['a', 'b'],
        initial: 'a',
        transitions: [
          {
            from: 'a',
            event: 'GO',
            to: 'b',
            action: (ctx) => { ctx['x'] = 99; },
          },
        ],
      },
      { x: 0 },
    );
    m.send('GO');
    assert.equal(m.context['x'], 99);
    m.reset();
    // context should still be the same object with x=99
    assert.equal(m.context['x'], 99);
  });

  it('machine transitions normally after reset', () => {
    const m = makeTrafficLight();
    m.send('NEXT'); // green
    m.reset();
    m.send('NEXT');
    assert.equal(m.state, 'green');
  });
});

// ─── createMachine factory ────────────────────────────────────────────────────

describe('createMachine factory', () => {
  it('returns a StateMachine instance', () => {
    const m = createMachine({
      states: ['idle', 'active'],
      initial: 'idle',
      transitions: [
        { from: 'idle', event: 'ACTIVATE', to: 'active' },
      ],
    });
    assert.ok(m instanceof StateMachine);
    assert.equal(m.state, 'idle');
  });

  it('factory forwards context', () => {
    const m = createMachine(
      {
        states: ['a', 'b'],
        initial: 'a',
        transitions: [{ from: 'a', event: 'GO', to: 'b' }],
      },
      { foo: 'bar' },
    );
    assert.equal(m.context['foo'], 'bar');
  });
});
