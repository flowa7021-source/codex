// ─── Unit Tests: StateMachine ─────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  StateMachine,
  createStateMachine,
} from '../../app/modules/state-machine.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Traffic-light FSM: red → green → yellow → red (NEXT cycles).
 * Accepts an optional spread of extra config properties (onEnter, onExit …).
 */
function makeTrafficLight(extra = {}) {
  return new StateMachine(
    {
      initial: 'red',
      transitions: [
        { from: 'red',    event: 'NEXT', to: 'green'  },
        { from: 'green',  event: 'NEXT', to: 'yellow' },
        { from: 'yellow', event: 'NEXT', to: 'red'    },
      ],
      ...extra,
    },
  );
}

// ─── 1. Initial state / state getter ─────────────────────────────────────────

describe('StateMachine – initial state and state getter', () => {
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

  it('context getter returns undefined when no context was provided', () => {
    const m = makeTrafficLight();
    assert.equal(m.context, undefined);
  });

  it('context getter returns the supplied context object', () => {
    const ctx = { count: 0 };
    const m = new StateMachine(
      { initial: 'a', transitions: [] },
      ctx,
    );
    assert.equal(m.context, ctx);
  });
});

// ─── 2. send – valid and invalid transitions ──────────────────────────────────

describe('StateMachine – send()', () => {
  it('returns true when a valid transition fires', () => {
    const m = makeTrafficLight();
    assert.equal(m.send('NEXT'), true);
  });

  it('returns false for an unknown event', () => {
    const m = makeTrafficLight();
    assert.equal(m.send('BOGUS'), false);
  });

  it('returns false when event is valid elsewhere but not in current state', () => {
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

  it('state does not change when send returns false', () => {
    const m = makeTrafficLight();
    m.send('BOGUS');
    assert.equal(m.state, 'red');
  });

  it('state updates correctly after a successful send', () => {
    const m = makeTrafficLight();
    m.send('NEXT');
    assert.equal(m.state, 'green');
  });

  it('full red → green → yellow → red cycle', () => {
    const m = makeTrafficLight();
    m.send('NEXT'); // green
    m.send('NEXT'); // yellow
    m.send('NEXT'); // red
    assert.equal(m.state, 'red');
  });

  it('repeated valid sends accumulate state changes', () => {
    const m = makeTrafficLight();
    m.send('NEXT');
    m.send('NEXT');
    assert.equal(m.state, 'yellow');
  });
});

// ─── 3. can() ─────────────────────────────────────────────────────────────────

describe('StateMachine – can()', () => {
  it('returns true for a valid event in the current state', () => {
    const m = makeTrafficLight();
    assert.equal(m.can('NEXT'), true);
  });

  it('returns false for a completely unknown event', () => {
    const m = makeTrafficLight();
    assert.equal(m.can('STOP'), false);
  });

  it('returns false for an event that exists but not from current state', () => {
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
    // NEXT is still valid from green
    assert.equal(m.can('NEXT'), true);
  });
});

// ─── 4. matches() ─────────────────────────────────────────────────────────────

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
});

// ─── 5. guard – blocks transition ────────────────────────────────────────────

describe('StateMachine – guard', () => {
  it('transition is blocked when guard returns false', () => {
    const m = new StateMachine(
      {
        initial: 'idle',
        transitions: [
          {
            from: 'idle',
            event: 'START',
            to: 'running',
            guard: (ctx) => /** @type {any} */ (ctx).ready === true,
          },
        ],
      },
      { ready: false },
    );
    const result = m.send('START');
    assert.equal(result, false);
    assert.equal(m.state, 'idle');
  });

  it('transition proceeds when guard returns true', () => {
    const m = new StateMachine(
      {
        initial: 'idle',
        transitions: [
          {
            from: 'idle',
            event: 'START',
            to: 'running',
            guard: (ctx) => /** @type {any} */ (ctx).ready === true,
          },
        ],
      },
      { ready: true },
    );
    assert.equal(m.send('START'), true);
    assert.equal(m.state, 'running');
  });

  it('guard returning false also makes can() return false', () => {
    const m = new StateMachine({
      initial: 'idle',
      transitions: [
        { from: 'idle', event: 'GO', to: 'done', guard: () => false },
      ],
    });
    assert.equal(m.can('GO'), false);
  });

  it('guard receives the context object', () => {
    let received;
    const ctx = { key: 'value' };
    const m = new StateMachine(
      {
        initial: 'a',
        transitions: [
          {
            from: 'a',
            event: 'GO',
            to: 'b',
            guard: (c) => { received = c; return true; },
          },
        ],
      },
      ctx,
    );
    m.send('GO');
    assert.equal(received, ctx);
  });

  it('absent guard is treated as always-true', () => {
    const m = new StateMachine({
      initial: 'a',
      transitions: [{ from: 'a', event: 'GO', to: 'b' }],
    });
    assert.equal(m.send('GO'), true);
  });
});

// ─── 6. action – called on transition ────────────────────────────────────────

describe('StateMachine – action', () => {
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

  it('action receives the context object', () => {
    let received;
    const ctx = { flag: 1 };
    const m = new StateMachine(
      {
        initial: 'a',
        transitions: [
          { from: 'a', event: 'GO', to: 'b', action: (c) => { received = c; } },
        ],
      },
      ctx,
    );
    m.send('GO');
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
    const m = new StateMachine(
      {
        initial: 'a',
        transitions: [
          { from: 'a', event: 'INC', to: 'a', action: (c) => { /** @type {any} */ (c).count++; } },
        ],
      },
      ctx,
    );
    m.send('INC');
    m.send('INC');
    assert.equal(ctx.count, 2);
  });
});

// ─── 7. onEnter / onExit hooks ───────────────────────────────────────────────

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

  it('hooks receive the context object', () => {
    const received = [];
    const ctx = { token: 42 };
    const m = new StateMachine(
      {
        initial: 'a',
        transitions: [{ from: 'a', event: 'GO', to: 'b' }],
        onEnter: { b: (c) => received.push(/** @type {any} */ (c).token) },
      },
      ctx,
    );
    m.send('GO');
    assert.deepEqual(received, [42]);
  });

  it('onEnter and onExit are not called when transition is blocked', () => {
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

// ─── 8. onTransition listener and unsubscribe ─────────────────────────────────

describe('StateMachine – onTransition listener', () => {
  it('listener is called after a successful transition', () => {
    const calls = [];
    const m = makeTrafficLight();
    m.onTransition((from, event, to) => calls.push({ from, event, to }));
    m.send('NEXT');
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0], { from: 'red', event: 'NEXT', to: 'green' });
  });

  it('listener is NOT called when transition is blocked', () => {
    const calls = [];
    const m = new StateMachine({
      initial: 'a',
      transitions: [
        { from: 'a', event: 'GO', to: 'b', guard: () => false },
      ],
    });
    m.onTransition(() => calls.push(1));
    m.send('GO');
    assert.equal(calls.length, 0);
  });

  it('multiple listeners are each called', () => {
    const a = [];
    const b = [];
    const m = makeTrafficLight();
    m.onTransition(() => a.push(1));
    m.onTransition(() => b.push(1));
    m.send('NEXT');
    assert.equal(a.length, 1);
    assert.equal(b.length, 1);
  });

  it('unsubscribe function stops the listener from firing', () => {
    const calls = [];
    const m = makeTrafficLight();
    const unsub = m.onTransition(() => calls.push(1));
    unsub();
    m.send('NEXT');
    assert.equal(calls.length, 0);
  });

  it('unsubscribing one listener does not affect others', () => {
    const a = [];
    const b = [];
    const m = makeTrafficLight();
    const unsubA = m.onTransition(() => a.push(1));
    m.onTransition(() => b.push(1));
    unsubA();
    m.send('NEXT');
    assert.equal(a.length, 0);
    assert.equal(b.length, 1);
  });

  it('listener receives correct (from, event, to) for each transition', () => {
    const calls = [];
    const m = makeTrafficLight();
    m.onTransition((from, event, to) => calls.push([from, event, to]));
    m.send('NEXT'); // red → green
    m.send('NEXT'); // green → yellow
    m.send('NEXT'); // yellow → red
    assert.deepEqual(calls, [
      ['red',    'NEXT', 'green'],
      ['green',  'NEXT', 'yellow'],
      ['yellow', 'NEXT', 'red'],
    ]);
  });
});

// ─── 9. reset() ───────────────────────────────────────────────────────────────

describe('StateMachine – reset()', () => {
  it('resets state to the initial value', () => {
    const m = makeTrafficLight();
    m.send('NEXT'); // green
    m.send('NEXT'); // yellow
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
    m.onTransition(() => { listenerCalled = true; });
    m.send('NEXT'); // move away from red first
    hookCalled = false;
    listenerCalled = false;
    m.reset();
    assert.equal(hookCalled, false);
    assert.equal(listenerCalled, false);
  });

  it('context is preserved after reset', () => {
    const ctx = { x: 0 };
    const m = new StateMachine(
      {
        initial: 'a',
        transitions: [
          { from: 'a', event: 'GO', to: 'b', action: (c) => { /** @type {any} */ (c).x = 99; } },
        ],
      },
      ctx,
    );
    m.send('GO');
    m.reset();
    assert.equal(/** @type {any} */ (m.context).x, 99);
    assert.equal(m.state, 'a');
  });
});

// ─── 10. Multiple 'from' states ───────────────────────────────────────────────

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

  it('can() returns true for both listed from states', () => {
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
});

// ─── 11. createStateMachine factory ──────────────────────────────────────────

describe('createStateMachine factory', () => {
  it('returns a StateMachine instance', () => {
    const m = createStateMachine({
      initial: 'idle',
      transitions: [{ from: 'idle', event: 'START', to: 'active' }],
    });
    assert.ok(m instanceof StateMachine);
  });

  it('factory instance starts in the correct initial state', () => {
    const m = createStateMachine({
      initial: 'idle',
      transitions: [],
    });
    assert.equal(m.state, 'idle');
  });

  it('factory forwards an optional context', () => {
    const ctx = { foo: 'bar' };
    const m = createStateMachine(
      { initial: 'a', transitions: [] },
      ctx,
    );
    assert.equal(m.context, ctx);
  });

  it('factory instance behaves identically to new StateMachine()', () => {
    const config = {
      initial: 'a',
      transitions: [{ from: 'a', event: 'GO', to: 'b' }],
    };
    const viaFactory = createStateMachine(config);
    const viaCtor    = new StateMachine(config);

    assert.equal(viaFactory.state, viaCtor.state);
    viaFactory.send('GO');
    viaCtor.send('GO');
    assert.equal(viaFactory.state, viaCtor.state);
  });

  it('factory with no context has undefined context', () => {
    const m = createStateMachine({ initial: 'a', transitions: [] });
    assert.equal(m.context, undefined);
  });
});

// ─── 12. Traffic light end-to-end ────────────────────────────────────────────

describe('StateMachine – traffic light end-to-end', () => {
  it('traffic light cycles through all three states correctly', () => {
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

  it('can() is true at every step of the cycle', () => {
    const m = makeTrafficLight();
    for (let i = 0; i < 6; i++) {
      assert.equal(m.can('NEXT'), true);
      m.send('NEXT');
    }
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

  it('onTransition fires on every step of a cycle', () => {
    const log = [];
    const m = makeTrafficLight();
    m.onTransition((from, _ev, to) => log.push(`${from}->${to}`));
    m.send('NEXT');
    m.send('NEXT');
    m.send('NEXT');
    assert.deepEqual(log, ['red->green', 'green->yellow', 'yellow->red']);
  });

  it('unknown event returns false at any phase of the cycle', () => {
    const m = makeTrafficLight();
    for (let i = 0; i < 3; i++) {
      assert.equal(m.send('STOP'), false);
      m.send('NEXT');
    }
  });
});
