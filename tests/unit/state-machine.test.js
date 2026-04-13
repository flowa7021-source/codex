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
 * Uses the states-map config expected by the spec.
 */
function makeTrafficLight() {
  return new StateMachine({
    initial: 'red',
    states: {
      red:    { on: { NEXT: 'green'  } },
      green:  { on: { NEXT: 'yellow' } },
      yellow: { on: { NEXT: 'red'   } },
    },
  });
}

// ─── 1. Basic transitions ─────────────────────────────────────────────────────

describe('StateMachine – basic transitions', () => {
  it('current getter returns initial state right after construction', () => {
    const m = makeTrafficLight();
    assert.equal(m.current, 'red');
  });

  it('initial state is respected for any starting state value', () => {
    const m = new StateMachine({
      initial: 'loading',
      states: {
        loading: { on: { DONE: 'idle' } },
        idle: {},
      },
    });
    assert.equal(m.current, 'loading');
  });

  it('send returns true when a valid transition fires', () => {
    const m = makeTrafficLight();
    assert.equal(m.send('NEXT'), true);
  });

  it('send updates current correctly after a successful transition', () => {
    const m = makeTrafficLight();
    m.send('NEXT');
    assert.equal(m.current, 'green');
  });

  it('send returns false for an unknown event', () => {
    const m = makeTrafficLight();
    assert.equal(m.send('BOGUS'), false);
  });

  it('current does not change when send returns false', () => {
    const m = makeTrafficLight();
    m.send('BOGUS');
    assert.equal(m.current, 'red');
  });

  it('send returns false when event is valid elsewhere but not in current state', () => {
    const m = new StateMachine({
      initial: 'idle',
      states: {
        idle:    { on: { START: 'running' } },
        running: { on: { STOP:  'idle'    } },
      },
    });
    // STOP is only valid from 'running'
    assert.equal(m.send('STOP'), false);
  });

  it('full red → green → yellow → red cycle', () => {
    const m = makeTrafficLight();
    m.send('NEXT'); // green
    m.send('NEXT'); // yellow
    m.send('NEXT'); // red
    assert.equal(m.current, 'red');
  });

  it('repeated sends accumulate state changes', () => {
    const m = makeTrafficLight();
    m.send('NEXT');
    m.send('NEXT');
    assert.equal(m.current, 'yellow');
  });

  it('traffic light cycles through all three states correctly over six transitions', () => {
    const m = makeTrafficLight();
    const states = [m.current];
    for (let i = 0; i < 6; i++) {
      m.send('NEXT');
      states.push(m.current);
    }
    assert.deepEqual(states, [
      'red', 'green', 'yellow', 'red', 'green', 'yellow', 'red',
    ]);
  });

  it('self-transition is valid when explicitly configured', () => {
    const m = new StateMachine({
      initial: 'ping',
      states: { ping: { on: { TICK: 'ping' } } },
    });
    assert.equal(m.send('TICK'), true);
    assert.equal(m.current, 'ping');
  });

  it('multiple distinct events can coexist in a single state', () => {
    const m = new StateMachine({
      initial: 'idle',
      states: {
        idle:  { on: { START: 'running', SKIP: 'done' } },
        running: {},
        done: {},
      },
    });
    // pick SKIP path
    assert.equal(m.send('SKIP'), true);
    assert.equal(m.current, 'done');
  });
});

// ─── 2. onEnter / onExit hooks ───────────────────────────────────────────────

describe('StateMachine – onEnter / onExit hooks', () => {
  it('onEnter fires when entering a state', () => {
    const entered = [];
    const m = new StateMachine({
      initial: 'red',
      states: {
        red:    { on: { NEXT: 'green' } },
        green:  { on: { NEXT: 'yellow' }, onEnter: () => entered.push('green') },
        yellow: { on: { NEXT: 'red'   } },
      },
    });
    m.send('NEXT');
    assert.deepEqual(entered, ['green']);
  });

  it('onExit fires when leaving a state', () => {
    const exited = [];
    const m = new StateMachine({
      initial: 'red',
      states: {
        red:    { on: { NEXT: 'green' }, onExit: () => exited.push('red') },
        green:  { on: { NEXT: 'yellow' } },
        yellow: { on: { NEXT: 'red'   } },
      },
    });
    m.send('NEXT');
    assert.deepEqual(exited, ['red']);
  });

  it('onExit fires before onEnter', () => {
    const order = [];
    const m = new StateMachine({
      initial: 'red',
      states: {
        red:    { on: { NEXT: 'green' }, onExit: () => order.push('exit:red') },
        green:  { on: { NEXT: 'yellow' }, onEnter: () => order.push('enter:green') },
        yellow: { on: { NEXT: 'red'   } },
      },
    });
    m.send('NEXT');
    assert.deepEqual(order, ['exit:red', 'enter:green']);
  });

  it('onEnter for initial state fires during construction', () => {
    const log = [];
    new StateMachine({
      initial: 'a',
      states: { a: { onEnter: () => log.push('entered:a') } },
    });
    assert.deepEqual(log, ['entered:a']);
  });

  it('onEnter does not fire for non-initial states at construction', () => {
    const log = [];
    new StateMachine({
      initial: 'a',
      states: {
        a: { on: { GO: 'b' } },
        b: { onEnter: () => log.push('entered:b') },
      },
    });
    assert.deepEqual(log, []);
  });

  it('onEnter and onExit are not called when no transition occurs', () => {
    let called = false;
    const m = new StateMachine({
      initial: 'a',
      states: {
        a: { onExit: () => { called = true; } },
        b: { onEnter: () => { called = true; } },
      },
    });
    m.send('BOGUS');
    assert.equal(called, false);
  });

  it('multiple hooks fire on a full traffic-light cycle', () => {
    const log = [];
    const m = new StateMachine({
      initial: 'red',
      states: {
        red:    { on: { NEXT: 'green'  }, onEnter: () => log.push('enter:red')    },
        green:  { on: { NEXT: 'yellow' }, onEnter: () => log.push('enter:green')  },
        yellow: { on: { NEXT: 'red'   }, onEnter: () => log.push('enter:yellow') },
      },
    });
    // clear the initial onEnter
    log.length = 0;
    m.send('NEXT');
    m.send('NEXT');
    m.send('NEXT');
    assert.deepEqual(log, ['enter:green', 'enter:yellow', 'enter:red']);
  });

  it('both onExit and onEnter fire correctly in a multi-step sequence', () => {
    const log = [];
    const m = new StateMachine({
      initial: 'a',
      states: {
        a: { on: { GO: 'b' }, onExit: () => log.push('exit:a') },
        b: { on: { GO: 'c' }, onEnter: () => log.push('enter:b'), onExit: () => log.push('exit:b') },
        c: { onEnter: () => log.push('enter:c') },
      },
    });
    m.send('GO'); // a → b
    m.send('GO'); // b → c
    assert.deepEqual(log, ['exit:a', 'enter:b', 'exit:b', 'enter:c']);
  });
});

// ─── 3. History tracking ──────────────────────────────────────────────────────

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

  it('history getter returns a snapshot — mutation does not affect internal state', () => {
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

  it('history length equals transition count plus one', () => {
    const m = makeTrafficLight();
    for (let i = 0; i < 5; i++) m.send('NEXT');
    assert.equal(m.history.length, 6);
  });

  it('history accumulates correctly across a long sequence', () => {
    const m = makeTrafficLight();
    m.send('NEXT'); // green
    m.send('NEXT'); // yellow
    m.send('NEXT'); // red
    m.send('NEXT'); // green
    assert.deepEqual(m.history, ['red', 'green', 'yellow', 'red', 'green']);
  });
});

// ─── 4. can() method ─────────────────────────────────────────────────────────

describe('StateMachine – can()', () => {
  it('returns true for a valid event in the current state', () => {
    const m = makeTrafficLight();
    assert.equal(m.can('NEXT'), true);
  });

  it('returns false for a completely unknown event', () => {
    const m = makeTrafficLight();
    assert.equal(m.can('STOP'), false);
  });

  it('returns false for an event that exists elsewhere but not in the current state', () => {
    const m = new StateMachine({
      initial: 'idle',
      states: {
        idle:    { on: { START: 'running' } },
        running: { on: { STOP:  'idle'    } },
      },
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

  it('can() returns false in a state with no on map at all', () => {
    const m = new StateMachine({
      initial: 'terminal',
      states: { terminal: {} },
    });
    assert.equal(m.can('ANY'), false);
  });

  it('can() returns false after reaching a state with empty on map', () => {
    const m = new StateMachine({
      initial: 'a',
      states: {
        a: { on: { GO: 'b' } },
        b: {},
      },
    });
    m.send('GO');
    assert.equal(m.can('GO'), false);
  });
});

// ─── 5. reset() ───────────────────────────────────────────────────────────────

describe('StateMachine – reset()', () => {
  it('resets current to the initial value', () => {
    const m = makeTrafficLight();
    m.send('NEXT');
    m.send('NEXT');
    m.reset();
    assert.equal(m.current, 'red');
  });

  it('machine can transition normally after reset', () => {
    const m = makeTrafficLight();
    m.send('NEXT');
    m.reset();
    m.send('NEXT');
    assert.equal(m.current, 'green');
  });

  it('reset does NOT fire transition listeners', () => {
    let listenerCalled = false;
    const m = makeTrafficLight();
    m.on('transition', () => { listenerCalled = true; });
    m.send('NEXT'); // move away from red first
    listenerCalled = false;
    m.reset();
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

  it('reset from a non-initial state fires onExit on current and onEnter on initial', () => {
    const log = [];
    const m = new StateMachine({
      initial: 'a',
      states: {
        a: { on: { GO: 'b' }, onEnter: () => log.push('enter:a') },
        b: { onExit: () => log.push('exit:b') },
      },
    });
    log.length = 0; // clear construction onEnter
    m.send('GO');
    log.length = 0; // clear send hooks
    m.reset();
    assert.deepEqual(log, ['exit:b', 'enter:a']);
  });

  it('reset when already at initial state does not fire onExit or onEnter', () => {
    const log = [];
    const m = new StateMachine({
      initial: 'a',
      states: {
        a: { onEnter: () => log.push('enter:a'), onExit: () => log.push('exit:a') },
      },
    });
    log.length = 0;
    m.reset(); // already at initial — no hooks should fire
    assert.deepEqual(log, []);
  });

  it('history after two resets contains only the initial state', () => {
    const m = makeTrafficLight();
    m.send('NEXT');
    m.reset();
    m.send('NEXT');
    m.reset();
    assert.deepEqual(m.history, ['red']);
  });
});

// ─── 6. Event listeners — on('transition', ...) ───────────────────────────────

describe("StateMachine – on('transition', handler)", () => {
  it('listener is called after a successful transition', () => {
    const calls = [];
    const m = makeTrafficLight();
    m.on('transition', (from, to, via) => calls.push({ from, to, via }));
    m.send('NEXT');
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0], { from: 'red', to: 'green', via: 'NEXT' });
  });

  it('listener receives (from, to, via) in that order', () => {
    let args;
    const m = makeTrafficLight();
    m.on('transition', (...a) => { args = a; });
    m.send('NEXT');
    assert.deepEqual(args, ['red', 'green', 'NEXT']);
  });

  it('listener is NOT called when no transition occurs', () => {
    const calls = [];
    const m = makeTrafficLight();
    m.on('transition', () => calls.push(1));
    m.send('BOGUS');
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

  it('listener receives correct args for each transition in a cycle', () => {
    const calls = [];
    const m = makeTrafficLight();
    m.on('transition', (from, to, via) => calls.push([from, to, via]));
    m.send('NEXT'); // red → green
    m.send('NEXT'); // green → yellow
    m.send('NEXT'); // yellow → red
    assert.deepEqual(calls, [
      ['red',    'green',  'NEXT'],
      ['green',  'yellow', 'NEXT'],
      ['yellow', 'red',    'NEXT'],
    ]);
  });

  it('calling unsubscribe twice is safe and does not throw', () => {
    const m = makeTrafficLight();
    const unsub = m.on('transition', () => {});
    unsub();
    assert.doesNotThrow(() => unsub());
  });

  it('listener fires after onEnter hook has run', () => {
    const order = [];
    const m = new StateMachine({
      initial: 'a',
      states: {
        a: { on: { GO: 'b' } },
        b: { onEnter: () => order.push('onEnter') },
      },
    });
    m.on('transition', () => order.push('listener'));
    m.send('GO');
    assert.deepEqual(order, ['onEnter', 'listener']);
  });

  it('three consecutive sends each notify listeners once', () => {
    let count = 0;
    const m = makeTrafficLight();
    m.on('transition', () => count++);
    m.send('NEXT');
    m.send('NEXT');
    m.send('NEXT');
    assert.equal(count, 3);
  });
});

// ─── 7. matches() ────────────────────────────────────────────────────────────

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

// ─── 8. createMachine factory ───────────────────────────────────────────────

describe('createMachine factory', () => {
  it('returns a StateMachine instance', () => {
    const m = createMachine({
      initial: 'idle',
      states: {
        idle: { on: { START: 'active' } },
        active: {},
      },
    });
    assert.ok(m instanceof StateMachine);
  });

  it('factory instance starts in the correct initial state', () => {
    const m = createMachine({ initial: 'idle', states: { idle: {} } });
    assert.equal(m.current, 'idle');
  });

  it('factory instance behaves identically to new StateMachine()', () => {
    const config = {
      initial: 'a',
      states: {
        a: { on: { GO: 'b' } },
        b: {},
      },
    };
    const viaFactory = createMachine(config);
    const viaCtor    = new StateMachine(config);

    assert.equal(viaFactory.current, viaCtor.current);
    viaFactory.send('GO');
    viaCtor.send('GO');
    assert.equal(viaFactory.current, viaCtor.current);
  });

  it('factory forwards onEnter hooks', () => {
    const log = [];
    const m = createMachine({
      initial: 'a',
      states: {
        a: { on: { GO: 'b' } },
        b: { onEnter: () => log.push('entered:b') },
      },
    });
    m.send('GO');
    assert.deepEqual(log, ['entered:b']);
  });

  it('factory forwards onExit hooks', () => {
    const log = [];
    const m = createMachine({
      initial: 'a',
      states: {
        a: { on: { GO: 'b' }, onExit: () => log.push('exited:a') },
        b: {},
      },
    });
    m.send('GO');
    assert.deepEqual(log, ['exited:a']);
  });

  it('factory instance supports on() and history', () => {
    const events = [];
    const m = createMachine({
      initial: 'x',
      states: {
        x: { on: { MOVE: 'y' } },
        y: {},
      },
    });
    m.on('transition', (from, to, via) => events.push([from, to, via]));
    m.send('MOVE');
    assert.deepEqual(m.history, ['x', 'y']);
    assert.deepEqual(events, [['x', 'y', 'MOVE']]);
  });

  it('factory supports reset', () => {
    const m = createMachine({
      initial: 'start',
      states: {
        start: { on: { GO: 'end' } },
        end: {},
      },
    });
    m.send('GO');
    m.reset();
    assert.equal(m.current, 'start');
    assert.deepEqual(m.history, ['start']);
  });
});

// ─── 9. Edge cases ────────────────────────────────────────────────────────────

describe('StateMachine – edge cases', () => {
  it('machine with a single state and no transitions is valid', () => {
    const m = new StateMachine({
      initial: 'alone',
      states: { alone: {} },
    });
    assert.equal(m.current, 'alone');
    assert.equal(m.send('ANY'), false);
  });

  it('sending unknown event many times never changes state', () => {
    const m = makeTrafficLight();
    for (let i = 0; i < 20; i++) m.send('UNKNOWN');
    assert.equal(m.current, 'red');
    assert.deepEqual(m.history, ['red']);
  });

  it('can() returns false for empty string event name', () => {
    const m = makeTrafficLight();
    assert.equal(m.can(''), false);
  });

  it('send does not throw for events with no `on` map', () => {
    const m = new StateMachine({
      initial: 'term',
      states: { term: {} },
    });
    assert.doesNotThrow(() => m.send('ANYTHING'));
  });

  it('history is an array, not a reference to internal state', () => {
    const m = makeTrafficLight();
    const h1 = m.history;
    m.send('NEXT');
    const h2 = m.history;
    assert.equal(h1.length, 1);
    assert.equal(h2.length, 2);
  });

  it('multiple distinct unsubscribers each clean up their own listener', () => {
    const log = [];
    const m = makeTrafficLight();
    const u1 = m.on('transition', () => log.push('L1'));
    const u2 = m.on('transition', () => log.push('L2'));
    const u3 = m.on('transition', () => log.push('L3'));
    u2(); // remove middle listener
    m.send('NEXT');
    assert.deepEqual(log, ['L1', 'L3']);
    u1();
    u3();
    log.length = 0;
    m.send('NEXT');
    assert.deepEqual(log, []);
  });

  it('current matches the last entry of history after every send', () => {
    const m = makeTrafficLight();
    for (let i = 0; i < 9; i++) {
      m.send('NEXT');
      const h = m.history;
      assert.equal(m.current, h[h.length - 1]);
    }
  });

  it('reset followed by transitions builds fresh history', () => {
    const m = makeTrafficLight();
    m.send('NEXT');
    m.send('NEXT');
    m.reset();
    m.send('NEXT');
    assert.deepEqual(m.history, ['red', 'green']);
  });
});
