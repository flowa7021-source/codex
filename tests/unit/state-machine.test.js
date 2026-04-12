// ─── Unit Tests: StateMachine ─────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  StateMachine,
  createMachine,
} from '../../app/modules/state-machine.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Traffic-light FSM: red → green → yellow → red (NEXT cycles).
 * Accepts an optional spread of extra config properties (onEnter, onExit …).
 */
function makeTrafficLight(extra = {}) {
  return new StateMachine({
    initial: 'red',
    transitions: [
      { from: 'red',    event: 'NEXT', to: 'green'  },
      { from: 'green',  event: 'NEXT', to: 'yellow' },
      { from: 'yellow', event: 'NEXT', to: 'red'    },
    ],
    ...extra,
  });
}

// ─── 1. Basic transitions ─────────────────────────────────────────────────────

describe('StateMachine – basic transitions', () => {
  it('state getter returns initial state right after construction', () => {
    const m = makeTrafficLight();
    assert.equal(m.state, 'red');
  });

  it('initial state is respected for any starting state value', () => {
    const m = new StateMachine({
      initial: 'loading',
      transitions: [{ from: 'loading', event: 'DONE', to: 'idle' }],
    });
    assert.equal(m.state, 'loading');
  });

  it('send returns true when a valid transition fires', () => {
    const m = makeTrafficLight();
    assert.equal(m.send('NEXT'), true);
  });

  it('send updates state correctly after a successful transition', () => {
    const m = makeTrafficLight();
    m.send('NEXT');
    assert.equal(m.state, 'green');
  });

  it('send returns false for an unknown event', () => {
    const m = makeTrafficLight();
    assert.equal(m.send('BOGUS'), false);
  });

  it('state does not change when send returns false', () => {
    const m = makeTrafficLight();
    m.send('BOGUS');
    assert.equal(m.state, 'red');
  });

  it('send returns false when event is valid elsewhere but not in current state', () => {
    const m = new StateMachine({
      initial: 'idle',
      transitions: [
        { from: 'idle',    event: 'START', to: 'running' },
        { from: 'running', event: 'STOP',  to: 'idle'    },
      ],
    });
    // STOP is only valid from 'running'
    assert.equal(m.send('STOP'), false);
  });

  it('full red → green → yellow → red cycle', () => {
    const m = makeTrafficLight();
    m.send('NEXT'); // green
    m.send('NEXT'); // yellow
    m.send('NEXT'); // red
    assert.equal(m.state, 'red');
  });

  it('repeated sends accumulate state changes', () => {
    const m = makeTrafficLight();
    m.send('NEXT');
    m.send('NEXT');
    assert.equal(m.state, 'yellow');
  });

  it('traffic light cycles through all three states correctly over six transitions', () => {
    const m = makeTrafficLight();
    const states = [m.state];
    for (let i = 0; i < 6; i++) {
      m.send('NEXT');
      states.push(m.state);
    }
    assert.deepEqual(states, [
      'red', 'green', 'yellow', 'red', 'green', 'yellow', 'red',
    ]);
  });
});

// ─── 2. Guard conditions ──────────────────────────────────────────────────────

describe('StateMachine – guard conditions', () => {
  it('transition is blocked when guard returns false', () => {
    const m = new StateMachine({
      initial: 'idle',
      transitions: [
        {
          from: 'idle',
          event: 'START',
          to: 'running',
          guard: (ctx) => /** @type {any} */ (ctx).ready === true,
        },
      ],
    });
    const result = m.send('START', { ready: false });
    assert.equal(result, false);
    assert.equal(m.state, 'idle');
  });

  it('transition proceeds when guard returns true', () => {
    const m = new StateMachine({
      initial: 'idle',
      transitions: [
        {
          from: 'idle',
          event: 'START',
          to: 'running',
          guard: (ctx) => /** @type {any} */ (ctx).ready === true,
        },
      ],
    });
    assert.equal(m.send('START', { ready: true }), true);
    assert.equal(m.state, 'running');
  });

  it('guard returning false makes can() return false', () => {
    const m = new StateMachine({
      initial: 'idle',
      transitions: [
        { from: 'idle', event: 'GO', to: 'done', guard: () => false },
      ],
    });
    assert.equal(m.can('GO'), false);
  });

  it('guard returning true allows can() to return true', () => {
    const m = new StateMachine({
      initial: 'idle',
      transitions: [
        { from: 'idle', event: 'GO', to: 'done', guard: () => true },
      ],
    });
    assert.equal(m.can('GO'), true);
  });

  it('guard receives the context passed to send()', () => {
    let received;
    const ctx = { key: 'value' };
    const m = new StateMachine({
      initial: 'a',
      transitions: [
        {
          from: 'a',
          event: 'GO',
          to: 'b',
          guard: (c) => { received = c; return true; },
        },
      ],
    });
    m.send('GO', ctx);
    assert.equal(received, ctx);
  });

  it('absent guard is treated as always-true', () => {
    const m = new StateMachine({
      initial: 'a',
      transitions: [{ from: 'a', event: 'GO', to: 'b' }],
    });
    assert.equal(m.send('GO'), true);
  });

  it('guard receives the context passed to can()', () => {
    let received;
    const ctx = { ok: true };
    const m = new StateMachine({
      initial: 'a',
      transitions: [
        {
          from: 'a',
          event: 'GO',
          to: 'b',
          guard: (c) => { received = c; return true; },
        },
      ],
    });
    m.can('GO', ctx);
    assert.equal(received, ctx);
  });
});

// ─── 3. Actions on transitions ────────────────────────────────────────────────

describe('StateMachine – actions on transitions', () => {
  it('action is called when a transition fires', () => {
    let called = false;
    const m = new StateMachine({
      initial: 'a',
      transitions: [
        { from: 'a', event: 'GO', to: 'b', action: () => { called = true; } },
      ],
    });
    m.send('GO');
    assert.equal(called, true);
  });

  it('action is NOT called when the transition is blocked by a guard', () => {
    let called = false;
    const m = new StateMachine({
      initial: 'a',
      transitions: [
        {
          from: 'a',
          event: 'GO',
          to: 'b',
          guard: () => false,
          action: () => { called = true; },
        },
      ],
    });
    m.send('GO');
    assert.equal(called, false);
  });

  it('action receives the context passed to send()', () => {
    let received;
    const ctx = { flag: 1 };
    const m = new StateMachine({
      initial: 'a',
      transitions: [
        { from: 'a', event: 'GO', to: 'b', action: (c) => { received = c; } },
      ],
    });
    m.send('GO', ctx);
    assert.equal(received, ctx);
  });

  it('action fires between onExit and onEnter (correct order)', () => {
    const order = [];
    const m = new StateMachine({
      initial: 'a',
      transitions: [
        { from: 'a', event: 'GO', to: 'b', action: () => order.push('action') },
      ],
      onExit:  { a: () => order.push('exitA')  },
      onEnter: { b: () => order.push('enterB') },
    });
    m.send('GO');
    assert.deepEqual(order, ['exitA', 'action', 'enterB']);
  });

  it('action can mutate the context object', () => {
    const ctx = { count: 0 };
    const m = new StateMachine({
      initial: 'a',
      transitions: [
        { from: 'a', event: 'INC', to: 'a', action: (c) => { /** @type {any} */ (c).count++; } },
      ],
    });
    m.send('INC', ctx);
    m.send('INC', ctx);
    assert.equal(ctx.count, 2);
  });
});

// ─── 4. onEnter / onExit hooks ───────────────────────────────────────────────

describe('StateMachine – onEnter / onExit hooks', () => {
  it('onEnter fires when entering a state', () => {
    const entered = [];
    const m = makeTrafficLight({
      onEnter: { green: () => entered.push('green') },
    });
    m.send('NEXT');
    assert.deepEqual(entered, ['green']);
  });

  it('onExit fires when leaving a state', () => {
    const exited = [];
    const m = makeTrafficLight({
      onExit: { red: () => exited.push('red') },
    });
    m.send('NEXT');
    assert.deepEqual(exited, ['red']);
  });

  it('onExit fires before onEnter', () => {
    const order = [];
    const m = makeTrafficLight({
      onExit:  { red:   () => order.push('exit:red')    },
      onEnter: { green: () => order.push('enter:green') },
    });
    m.send('NEXT');
    assert.deepEqual(order, ['exit:red', 'enter:green']);
  });

  it('hooks receive the context passed to send()', () => {
    const received = [];
    const ctx = { token: 42 };
    const m = new StateMachine({
      initial: 'a',
      transitions: [{ from: 'a', event: 'GO', to: 'b' }],
      onEnter: { b: (c) => received.push(/** @type {any} */ (c).token) },
    });
    m.send('GO', ctx);
    assert.deepEqual(received, [42]);
  });

  it('onEnter and onExit are not called when transition is blocked by guard', () => {
    let called = false;
    const m = new StateMachine({
      initial: 'a',
      transitions: [
        { from: 'a', event: 'GO', to: 'b', guard: () => false },
      ],
      onExit:  { a: () => { called = true; } },
      onEnter: { b: () => { called = true; } },
    });
    m.send('GO');
    assert.equal(called, false);
  });

  it('multiple hooks fire on a full traffic-light cycle', () => {
    const log = [];
    const m = makeTrafficLight({
      onEnter: {
        green:  () => log.push('enter:green'),
        yellow: () => log.push('enter:yellow'),
        red:    () => log.push('enter:red'),
      },
    });
    m.send('NEXT');
    m.send('NEXT');
    m.send('NEXT');
    assert.deepEqual(log, ['enter:green', 'enter:yellow', 'enter:red']);
  });
});

// ─── 5. History tracking ──────────────────────────────────────────────────────

describe('StateMachine – history tracking', () => {
  it('history includes only the initial state right after construction', () => {
    const m = makeTrafficLight();
    assert.deepEqual(m.history, ['red']);
  });

  it('history grows by one entry per successful transition', () => {
    const m = makeTrafficLight();
    m.send('NEXT');
    assert.deepEqual(m.history, ['red', 'green']);
    m.send('NEXT');
    assert.deepEqual(m.history, ['red', 'green', 'yellow']);
  });

  it('history is not modified when a transition is blocked', () => {
    const m = makeTrafficLight();
    m.send('BOGUS');
    assert.deepEqual(m.history, ['red']);
  });

  it('history records duplicate states when cycling back', () => {
    const m = makeTrafficLight();
    m.send('NEXT'); // green
    m.send('NEXT'); // yellow
    m.send('NEXT'); // back to red
    assert.deepEqual(m.history, ['red', 'green', 'yellow', 'red']);
  });

  it('history getter returns a snapshot (mutation does not affect internal state)', () => {
    const m = makeTrafficLight();
    const snap = m.history;
    snap.push('hacked');
    assert.deepEqual(m.history, ['red']);
  });

  it('history is cleared to just the initial state after reset()', () => {
    const m = makeTrafficLight();
    m.send('NEXT');
    m.send('NEXT');
    m.reset();
    assert.deepEqual(m.history, ['red']);
  });
});

// ─── 6. can() method ─────────────────────────────────────────────────────────

describe('StateMachine – can()', () => {
  it('returns true for a valid event in the current state', () => {
    const m = makeTrafficLight();
    assert.equal(m.can('NEXT'), true);
  });

  it('returns false for a completely unknown event', () => {
    const m = makeTrafficLight();
    assert.equal(m.can('STOP'), false);
  });

  it('returns false for an event that exists but not from the current state', () => {
    const m = new StateMachine({
      initial: 'idle',
      transitions: [
        { from: 'idle',    event: 'START', to: 'running' },
        { from: 'running', event: 'STOP',  to: 'idle'    },
      ],
    });
    assert.equal(m.can('STOP'), false);
    m.send('START');
    assert.equal(m.can('STOP'), true);
  });

  it('can() reflects the updated state after a send', () => {
    const m = makeTrafficLight();
    assert.equal(m.can('NEXT'), true);
    m.send('NEXT'); // now in 'green'
    assert.equal(m.can('NEXT'), true);
  });

  it('can() is true at every step of the traffic-light cycle', () => {
    const m = makeTrafficLight();
    for (let i = 0; i < 6; i++) {
      assert.equal(m.can('NEXT'), true);
      m.send('NEXT');
    }
  });
});

// ─── 7. reset() ───────────────────────────────────────────────────────────────

describe('StateMachine – reset()', () => {
  it('resets state to the initial value', () => {
    const m = makeTrafficLight();
    m.send('NEXT');
    m.send('NEXT');
    m.reset();
    assert.equal(m.state, 'red');
  });

  it('machine can transition normally after reset', () => {
    const m = makeTrafficLight();
    m.send('NEXT');
    m.reset();
    m.send('NEXT');
    assert.equal(m.state, 'green');
  });

  it('reset does NOT fire hooks or listeners', () => {
    let hookCalled = false;
    let listenerCalled = false;
    const m = makeTrafficLight({
      onEnter: { red: () => { hookCalled = true; } },
    });
    m.on('transition', () => { listenerCalled = true; });
    m.send('NEXT'); // move away from red first
    hookCalled = false;
    listenerCalled = false;
    m.reset();
    assert.equal(hookCalled, false);
    assert.equal(listenerCalled, false);
  });

  it('reset clears history back to just the initial state', () => {
    const m = makeTrafficLight();
    m.send('NEXT');
    m.send('NEXT');
    m.reset();
    assert.deepEqual(m.history, ['red']);
  });

  it('matches() reflects initial state after reset', () => {
    const m = makeTrafficLight();
    m.send('NEXT');
    m.reset();
    assert.equal(m.matches('red'), true);
    assert.equal(m.matches('green'), false);
  });
});

// ─── 8. Event listeners — on('transition', ...) ───────────────────────────────

describe("StateMachine – on('transition', handler)", () => {
  it('listener is called after a successful transition', () => {
    const calls = [];
    const m = makeTrafficLight();
    m.on('transition', (from, to, ev) => calls.push({ from, to, ev }));
    m.send('NEXT');
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0], { from: 'red', to: 'green', ev: 'NEXT' });
  });

  it('listener receives (from, to, event) in that order', () => {
    let args;
    const m = makeTrafficLight();
    m.on('transition', (...a) => { args = a; });
    m.send('NEXT');
    assert.deepEqual(args, ['red', 'green', 'NEXT']);
  });

  it('listener is NOT called when transition is blocked', () => {
    const calls = [];
    const m = new StateMachine({
      initial: 'a',
      transitions: [
        { from: 'a', event: 'GO', to: 'b', guard: () => false },
      ],
    });
    m.on('transition', () => calls.push(1));
    m.send('GO');
    assert.equal(calls.length, 0);
  });

  it('multiple listeners are each called', () => {
    const a = [];
    const b = [];
    const m = makeTrafficLight();
    m.on('transition', () => a.push(1));
    m.on('transition', () => b.push(1));
    m.send('NEXT');
    assert.equal(a.length, 1);
    assert.equal(b.length, 1);
  });

  it('on() returns an unsubscribe function', () => {
    const m = makeTrafficLight();
    const unsub = m.on('transition', () => {});
    assert.equal(typeof unsub, 'function');
  });

  it('unsubscribe function stops the listener from firing', () => {
    const calls = [];
    const m = makeTrafficLight();
    const unsub = m.on('transition', () => calls.push(1));
    unsub();
    m.send('NEXT');
    assert.equal(calls.length, 0);
  });

  it('unsubscribing one listener does not affect others', () => {
    const a = [];
    const b = [];
    const m = makeTrafficLight();
    const unsubA = m.on('transition', () => a.push(1));
    m.on('transition', () => b.push(1));
    unsubA();
    m.send('NEXT');
    assert.equal(a.length, 0);
    assert.equal(b.length, 1);
  });

  it('listener receives correct (from, to, event) for each transition in a cycle', () => {
    const calls = [];
    const m = makeTrafficLight();
    m.on('transition', (from, to, ev) => calls.push([from, to, ev]));
    m.send('NEXT'); // red → green
    m.send('NEXT'); // green → yellow
    m.send('NEXT'); // yellow → red
    assert.deepEqual(calls, [
      ['red',    'green',  'NEXT'],
      ['green',  'yellow', 'NEXT'],
      ['yellow', 'red',    'NEXT'],
    ]);
  });
});

// ─── 9. Multiple source states in from array ──────────────────────────────────

describe('StateMachine – multiple from states', () => {
  it('transition fires from any state listed in the from array', () => {
    const m = new StateMachine({
      initial: 'a',
      transitions: [
        { from: ['a', 'b'], event: 'DONE', to: 'end' },
        { from: 'end',      event: 'BACK', to: 'a'   },
        { from: 'a',        event: 'NEXT', to: 'b'   },
      ],
    });

    // Transition from 'a'
    assert.equal(m.send('DONE'), true);
    assert.equal(m.state, 'end');

    // Back to 'a', then advance to 'b'
    m.send('BACK');
    m.send('NEXT');
    assert.equal(m.state, 'b');

    // Transition from 'b'
    assert.equal(m.send('DONE'), true);
    assert.equal(m.state, 'end');
  });

  it('can() returns true for all listed from states', () => {
    const makeM = (initial) => new StateMachine({
      initial,
      transitions: [{ from: ['x', 'y'], event: 'GO', to: 'z' }],
    });
    assert.equal(makeM('x').can('GO'), true);
    assert.equal(makeM('y').can('GO'), true);
  });

  it('can() returns false when current state is not in the from array', () => {
    const m = new StateMachine({
      initial: 'z',
      transitions: [{ from: ['x', 'y'], event: 'GO', to: 'z' }],
    });
    assert.equal(m.can('GO'), false);
  });

  it('guard is still evaluated for array-from transitions', () => {
    const m = new StateMachine({
      initial: 'a',
      transitions: [
        { from: ['a', 'b'], event: 'GO', to: 'end', guard: () => false },
      ],
    });
    assert.equal(m.send('GO'), false);
    assert.equal(m.state, 'a');
  });

  it('history records all states when bouncing through multiple from states', () => {
    const m = new StateMachine({
      initial: 'a',
      transitions: [
        { from: ['a', 'b'], event: 'DONE', to: 'end' },
        { from: 'end',      event: 'BACK', to: 'b'   },
      ],
    });
    m.send('DONE'); // a → end
    m.send('BACK'); // end → b
    m.send('DONE'); // b → end
    assert.deepEqual(m.history, ['a', 'end', 'b', 'end']);
  });
});

// ─── 10. Invalid events ───────────────────────────────────────────────────────

describe('StateMachine – invalid events (send returns false)', () => {
  it('completely unknown event returns false', () => {
    const m = makeTrafficLight();
    assert.equal(m.send('UNKNOWN'), false);
  });

  it('event valid in another state returns false from current state', () => {
    const m = new StateMachine({
      initial: 'idle',
      transitions: [
        { from: 'idle',    event: 'RUN',  to: 'active' },
        { from: 'active',  event: 'STOP', to: 'idle'   },
      ],
    });
    assert.equal(m.send('STOP'), false);
  });

  it('multiple unknown events all return false without changing state', () => {
    const m = makeTrafficLight();
    assert.equal(m.send('A'), false);
    assert.equal(m.send('B'), false);
    assert.equal(m.send('C'), false);
    assert.equal(m.state, 'red');
  });

  it('unknown event at any phase of a cycle returns false', () => {
    const m = makeTrafficLight();
    for (let i = 0; i < 3; i++) {
      assert.equal(m.send('STOP'), false);
      m.send('NEXT');
    }
  });

  it('guard-blocked event also returns false', () => {
    const m = new StateMachine({
      initial: 'a',
      transitions: [
        { from: 'a', event: 'GO', to: 'b', guard: () => false },
      ],
    });
    assert.equal(m.send('GO'), false);
  });
});

// ─── 11. createMachine factory ───────────────────────────────────────────────

describe('createMachine factory', () => {
  it('returns a StateMachine instance', () => {
    const m = createMachine({
      initial: 'idle',
      transitions: [{ from: 'idle', event: 'START', to: 'active' }],
    });
    assert.ok(m instanceof StateMachine);
  });

  it('factory instance starts in the correct initial state', () => {
    const m = createMachine({ initial: 'idle', transitions: [] });
    assert.equal(m.state, 'idle');
  });

  it('factory instance behaves identically to new StateMachine()', () => {
    const config = {
      initial: 'a',
      transitions: [{ from: 'a', event: 'GO', to: 'b' }],
    };
    const viaFactory = createMachine(config);
    const viaCtor    = new StateMachine(config);

    assert.equal(viaFactory.state, viaCtor.state);
    viaFactory.send('GO');
    viaCtor.send('GO');
    assert.equal(viaFactory.state, viaCtor.state);
  });

  it('factory forwards onEnter hooks', () => {
    const log = [];
    const m = createMachine({
      initial: 'a',
      transitions: [{ from: 'a', event: 'GO', to: 'b' }],
      onEnter: { b: () => log.push('entered:b') },
    });
    m.send('GO');
    assert.deepEqual(log, ['entered:b']);
  });

  it('factory forwards onExit hooks', () => {
    const log = [];
    const m = createMachine({
      initial: 'a',
      transitions: [{ from: 'a', event: 'GO', to: 'b' }],
      onExit: { a: () => log.push('exited:a') },
    });
    m.send('GO');
    assert.deepEqual(log, ['exited:a']);
  });

  it('factory instance supports on() and history', () => {
    const events = [];
    const m = createMachine({
      initial: 'x',
      transitions: [{ from: 'x', event: 'MOVE', to: 'y' }],
    });
    m.on('transition', (from, to, ev) => events.push([from, to, ev]));
    m.send('MOVE');
    assert.deepEqual(m.history, ['x', 'y']);
    assert.deepEqual(events, [['x', 'y', 'MOVE']]);
  });

  it('factory supports reset', () => {
    const m = createMachine({
      initial: 'start',
      transitions: [{ from: 'start', event: 'GO', to: 'end' }],
    });
    m.send('GO');
    m.reset();
    assert.equal(m.state, 'start');
    assert.deepEqual(m.history, ['start']);
  });
});

// ─── 12. matches() ────────────────────────────────────────────────────────────

describe('StateMachine – matches()', () => {
  it('returns true when the machine is in the queried state', () => {
    const m = makeTrafficLight();
    assert.equal(m.matches('red'), true);
  });

  it('returns false when the machine is NOT in the queried state', () => {
    const m = makeTrafficLight();
    assert.equal(m.matches('green'), false);
  });

  it('returns true for the new state after a transition', () => {
    const m = makeTrafficLight();
    m.send('NEXT');
    assert.equal(m.matches('green'), true);
    assert.equal(m.matches('red'), false);
  });

  it('matches() tracks state through the full cycle', () => {
    const m = makeTrafficLight();
    assert.equal(m.matches('red'), true);
    m.send('NEXT');
    assert.equal(m.matches('green'), true);
    m.send('NEXT');
    assert.equal(m.matches('yellow'), true);
    m.send('NEXT');
    assert.equal(m.matches('red'), true);
  });
});
