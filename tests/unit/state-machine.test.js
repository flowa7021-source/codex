// ─── Unit Tests: StateMachine ─────────────────────────────────────────────────
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { createMachine, StateMachine } from '../../app/modules/state-machine.js';

// ─── Shared traffic-light config factory ─────────────────────────────────────

function trafficLightConfig() {
  return {
    initial: 'red',
    states: {
      red:    { on: { NEXT: 'green' } },
      green:  { on: { NEXT: 'yellow' } },
      yellow: { on: { NEXT: 'red' } },
    },
  };
}

// ─── createMachine() ─────────────────────────────────────────────────────────

describe('createMachine()', () => {
  it('returns a StateMachine instance', () => {
    const m = createMachine(trafficLightConfig());
    assert.ok(m instanceof StateMachine);
  });

  it('starts in the configured initial state', () => {
    const m = createMachine(trafficLightConfig());
    assert.equal(m.current, 'red');
  });

  it('different initial states are respected', () => {
    const m = createMachine({
      initial: 'green',
      states: {
        red:    { on: { NEXT: 'green' } },
        green:  { on: { NEXT: 'yellow' } },
        yellow: { on: { NEXT: 'red' } },
      },
    });
    assert.equal(m.current, 'green');
  });
});

// ─── matches() ───────────────────────────────────────────────────────────────

describe('matches()', () => {
  it('returns true for the current state', () => {
    const m = createMachine(trafficLightConfig());
    assert.equal(m.matches('red'), true);
  });

  it('returns false for other states', () => {
    const m = createMachine(trafficLightConfig());
    assert.equal(m.matches('green'), false);
    assert.equal(m.matches('yellow'), false);
  });

  it('updates after a transition', () => {
    const m = createMachine(trafficLightConfig());
    m.send('NEXT');
    assert.equal(m.matches('green'), true);
    assert.equal(m.matches('red'), false);
  });
});

// ─── send() ──────────────────────────────────────────────────────────────────

describe('send()', () => {
  it('transitions to the correct next state', () => {
    const m = createMachine(trafficLightConfig());
    m.send('NEXT');
    assert.equal(m.current, 'green');
  });

  it('returns the new state', () => {
    const m = createMachine(trafficLightConfig());
    const next = m.send('NEXT');
    assert.equal(next, 'green');
  });

  it('chains multiple transitions correctly', () => {
    const m = createMachine(trafficLightConfig());
    m.send('NEXT'); // red -> green
    m.send('NEXT'); // green -> yellow
    m.send('NEXT'); // yellow -> red
    assert.equal(m.current, 'red');
  });

  it('stays in current state when no transition is defined', () => {
    const m = createMachine(trafficLightConfig());
    const result = m.send('UNKNOWN_EVENT');
    assert.equal(result, 'red');
    assert.equal(m.current, 'red');
  });

  it('returns current state when no transition is defined', () => {
    const m = createMachine(trafficLightConfig());
    m.send('NEXT'); // -> green
    const result = m.send('BOGUS');
    assert.equal(result, 'green');
    assert.equal(m.current, 'green');
  });
});

// ─── can() ───────────────────────────────────────────────────────────────────

describe('can()', () => {
  it('returns true when a transition exists for the event', () => {
    const m = createMachine(trafficLightConfig());
    assert.equal(m.can('NEXT'), true);
  });

  it('returns false when no transition exists for the event', () => {
    const m = createMachine(trafficLightConfig());
    assert.equal(m.can('STOP'), false);
  });

  it('reflects the current state (not initial)', () => {
    const m = createMachine({
      initial: 'idle',
      states: {
        idle:    { on: { START: 'running' } },
        running: { on: { STOP: 'idle' } },
      },
    });
    assert.equal(m.can('START'), true);
    assert.equal(m.can('STOP'), false);
    m.send('START');
    assert.equal(m.can('START'), false);
    assert.equal(m.can('STOP'), true);
  });
});

// ─── onTransition() ──────────────────────────────────────────────────────────

describe('onTransition()', () => {
  it('callback is called with from, to, event on a valid transition', () => {
    const m = createMachine(trafficLightConfig());
    const calls = [];
    m.onTransition((from, to, event) => calls.push({ from, to, event }));

    m.send('NEXT');
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0], { from: 'red', to: 'green', event: 'NEXT' });
  });

  it('callback not called when no transition occurs', () => {
    const m = createMachine(trafficLightConfig());
    const calls = [];
    m.onTransition(() => calls.push(true));

    m.send('INVALID');
    assert.equal(calls.length, 0);
  });

  it('multiple callbacks are all called', () => {
    const m = createMachine(trafficLightConfig());
    let count = 0;
    m.onTransition(() => count++);
    m.onTransition(() => count++);

    m.send('NEXT');
    assert.equal(count, 2);
  });

  it('returns an unsubscribe function', () => {
    const m = createMachine(trafficLightConfig());
    const calls = [];
    const unsub = m.onTransition(() => calls.push(true));

    assert.equal(typeof unsub, 'function');
    unsub();
    m.send('NEXT');
    assert.equal(calls.length, 0);
  });

  it('after unsubscribe the callback is no longer called', () => {
    const m = createMachine(trafficLightConfig());
    const calls = [];
    const unsub = m.onTransition(() => calls.push(true));

    m.send('NEXT'); // should fire
    unsub();
    m.send('NEXT'); // should NOT fire
    m.send('NEXT'); // should NOT fire

    assert.equal(calls.length, 1);
  });

  it('unsubscribing one listener does not affect others', () => {
    const m = createMachine(trafficLightConfig());
    const a = [];
    const b = [];
    const unsubA = m.onTransition(() => a.push(true));
    m.onTransition(() => b.push(true));

    unsubA();
    m.send('NEXT');

    assert.equal(a.length, 0);
    assert.equal(b.length, 1);
  });
});

// ─── Entry / exit callbacks ───────────────────────────────────────────────────

describe('entry / exit callbacks', () => {
  it('exit callback is called on the state being left', () => {
    const log = [];
    const m = createMachine({
      initial: 'idle',
      states: {
        idle:    { on: { GO: 'active' }, exit: () => log.push('exit:idle') },
        active:  { on: { STOP: 'idle' } },
      },
    });

    m.send('GO');
    assert.deepEqual(log, ['exit:idle']);
  });

  it('entry callback is called on the state being entered', () => {
    const log = [];
    const m = createMachine({
      initial: 'idle',
      states: {
        idle:    { on: { GO: 'active' } },
        active:  { on: { STOP: 'idle' }, entry: () => log.push('entry:active') },
      },
    });

    m.send('GO');
    assert.deepEqual(log, ['entry:active']);
  });

  it('exit is called before entry', () => {
    const log = [];
    const m = createMachine({
      initial: 'a',
      states: {
        a: { on: { NEXT: 'b' }, exit: () => log.push('exit:a') },
        b: { on: { NEXT: 'a' }, entry: () => log.push('entry:b') },
      },
    });

    m.send('NEXT');
    assert.deepEqual(log, ['exit:a', 'entry:b']);
  });

  it('entry callback fires for the initial state on construction', () => {
    const log = [];
    createMachine({
      initial: 'start',
      states: {
        start: { entry: () => log.push('entry:start') },
      },
    });
    assert.deepEqual(log, ['entry:start']);
  });

  it('callbacks not called when no transition occurs', () => {
    const log = [];
    const m = createMachine({
      initial: 'idle',
      states: {
        idle: {
          exit:  () => log.push('exit:idle'),
          entry: () => log.push('entry:idle'),
        },
      },
    });

    // Clear the initial entry
    log.length = 0;
    m.send('BOGUS');
    assert.deepEqual(log, []);
  });
});

// ─── reset() ─────────────────────────────────────────────────────────────────

describe('reset()', () => {
  it('returns the machine to its initial state', () => {
    const m = createMachine(trafficLightConfig());
    m.send('NEXT'); // -> green
    m.send('NEXT'); // -> yellow
    m.reset();
    assert.equal(m.current, 'red');
  });

  it('matches initial state after reset', () => {
    const m = createMachine(trafficLightConfig());
    m.send('NEXT');
    m.reset();
    assert.equal(m.matches('red'), true);
  });

  it('machine can transition normally after reset', () => {
    const m = createMachine(trafficLightConfig());
    m.send('NEXT'); // -> green
    m.reset();
    m.send('NEXT'); // -> green again
    assert.equal(m.current, 'green');
  });

  it('calls exit on current state and entry on initial state during reset', () => {
    const log = [];
    const m = createMachine({
      initial: 'idle',
      states: {
        idle:   { on: { GO: 'active' }, entry: () => log.push('entry:idle') },
        active: { on: { STOP: 'idle' }, exit: () => log.push('exit:active') },
      },
    });

    log.length = 0; // ignore construction entry
    m.send('GO');
    log.length = 0; // start fresh

    m.reset();
    assert.deepEqual(log, ['exit:active', 'entry:idle']);
  });
});
