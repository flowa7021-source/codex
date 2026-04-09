// ─── Unit Tests: StateMachine ─────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { StateMachine } from '../../app/modules/state-machine.js';

// ─── Traffic-light machine factory ───────────────────────────────────────────
//
// States:  red -> green -> yellow -> red  (cyclic)
// Event:   NEXT triggers every hop

function makeTrafficLight(onTransition) {
  return new StateMachine({
    initial: 'red',
    transitions: [
      { from: 'red',    event: 'NEXT', to: 'green'  },
      { from: 'green',  event: 'NEXT', to: 'yellow' },
      { from: 'yellow', event: 'NEXT', to: 'red'    },
    ],
    onTransition,
  });
}

// ─── Basic transitions ────────────────────────────────────────────────────────

describe('StateMachine – basic transitions', () => {
  it('starts in the initial state', () => {
    const m = makeTrafficLight();
    assert.equal(m.state, 'red');
  });

  it('red -> green on NEXT', () => {
    const m = makeTrafficLight();
    const result = m.send('NEXT');
    assert.equal(result, true);
    assert.equal(m.state, 'green');
  });

  it('green -> yellow on NEXT', () => {
    const m = makeTrafficLight();
    m.send('NEXT'); // red -> green
    m.send('NEXT'); // green -> yellow
    assert.equal(m.state, 'yellow');
  });

  it('yellow -> red on NEXT (full cycle)', () => {
    const m = makeTrafficLight();
    m.send('NEXT');
    m.send('NEXT');
    m.send('NEXT');
    assert.equal(m.state, 'red');
  });
});

// ─── Invalid event ────────────────────────────────────────────────────────────

describe('StateMachine – invalid event', () => {
  it('send() returns false for an unknown event', () => {
    const m = makeTrafficLight();
    assert.equal(m.send('STOP'), false);
  });

  it('state does not change after an invalid event', () => {
    const m = makeTrafficLight();
    m.send('BOGUS');
    assert.equal(m.state, 'red');
  });

  it('send() returns false for a valid event in the wrong state', () => {
    const m = makeTrafficLight();
    m.send('NEXT'); // now green
    // NEXT from red is defined but we are in green — still valid here
    // Use a machine where BACK is only from yellow
    const m2 = new StateMachine({
      initial: 'red',
      transitions: [
        { from: 'red',    event: 'NEXT', to: 'green'  },
        { from: 'yellow', event: 'BACK', to: 'red'    },
      ],
    });
    assert.equal(m2.send('BACK'), false); // no BACK from red
  });
});

// ─── can() and validEvents() ─────────────────────────────────────────────────

describe('StateMachine – can() and validEvents()', () => {
  it('can() returns true for NEXT when in red', () => {
    const m = makeTrafficLight();
    assert.equal(m.can('NEXT'), true);
  });

  it('can() returns false for an unregistered event', () => {
    const m = makeTrafficLight();
    assert.equal(m.can('STOP'), false);
  });

  it('validEvents() lists available events from current state', () => {
    const m = makeTrafficLight();
    assert.deepEqual(m.validEvents(), ['NEXT']);
  });

  it('validEvents() is empty when no events apply', () => {
    const m = new StateMachine({
      initial: 'done',
      transitions: [{ from: 'start', event: 'GO', to: 'done' }],
    });
    assert.deepEqual(m.validEvents(), []);
  });
});

// ─── Guard condition ──────────────────────────────────────────────────────────

describe('StateMachine – guard condition', () => {
  it('transition is blocked when guard returns false', () => {
    const m = new StateMachine({
      initial: 'idle',
      transitions: [
        {
          from: 'idle',
          event: 'START',
          to: 'running',
          guard: (ctx) => ctx === 'ready',
        },
      ],
    });
    const result = m.send('START', 'not-ready');
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
          guard: (ctx) => ctx === 'ready',
        },
      ],
    });
    const result = m.send('START', 'ready');
    assert.equal(result, true);
    assert.equal(m.state, 'running');
  });

  it('can() returns false when guard blocks the event', () => {
    const m = new StateMachine({
      initial: 'idle',
      transitions: [
        {
          from: 'idle',
          event: 'START',
          to: 'running',
          guard: () => false,
        },
      ],
    });
    assert.equal(m.can('START'), false);
  });

  it('validEvents() excludes events blocked by guard', () => {
    const m = new StateMachine({
      initial: 'idle',
      transitions: [
        { from: 'idle', event: 'START', to: 'running', guard: () => false },
        { from: 'idle', event: 'RESET', to: 'idle' },
      ],
    });
    assert.deepEqual(m.validEvents(), ['RESET']);
  });
});

// ─── Action updates context ───────────────────────────────────────────────────

describe('StateMachine – action updates context', () => {
  it('action receives context and event, its return value becomes new context', () => {
    const m = new StateMachine({
      initial: 'counting',
      transitions: [
        {
          from: 'counting',
          event: 'INC',
          to: 'counting',
          action: (ctx, _event) => (/** @type {number} */ (ctx) ?? 0) + 1,
        },
      ],
    });

    m.send('INC');
    assert.equal(m.context, 1);

    m.send('INC');
    assert.equal(m.context, 2);

    m.send('INC');
    assert.equal(m.context, 3);
  });

  it('context passed to send() is forwarded to the action', () => {
    const received = [];
    const m = new StateMachine({
      initial: 'a',
      transitions: [
        {
          from: 'a',
          event: 'GO',
          to: 'b',
          action: (ctx, event) => {
            received.push({ ctx, event });
            return ctx;
          },
        },
      ],
    });
    m.send('GO', 'hello');
    assert.deepEqual(received, [{ ctx: 'hello', event: 'GO' }]);
  });

  it('context is undefined initially', () => {
    const m = makeTrafficLight();
    assert.equal(m.context, undefined);
  });
});

// ─── subscribe / unsubscribe ──────────────────────────────────────────────────

describe('StateMachine – subscribe / unsubscribe', () => {
  it('listener is called after a successful transition', () => {
    const m = makeTrafficLight();
    const calls = [];
    m.subscribe((state, event) => calls.push({ state, event }));

    m.send('NEXT');
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0], { state: 'green', event: 'NEXT' });
  });

  it('listener is NOT called when transition is blocked', () => {
    const m = makeTrafficLight();
    const calls = [];
    m.subscribe(() => calls.push(true));

    m.send('UNKNOWN');
    assert.equal(calls.length, 0);
  });

  it('multiple listeners are all called', () => {
    const m = makeTrafficLight();
    let count = 0;
    m.subscribe(() => count++);
    m.subscribe(() => count++);

    m.send('NEXT');
    assert.equal(count, 2);
  });

  it('subscribe() returns an unsubscribe function', () => {
    const m = makeTrafficLight();
    const calls = [];
    const unsub = m.subscribe(() => calls.push(true));

    assert.equal(typeof unsub, 'function');
    unsub();
    m.send('NEXT');
    assert.equal(calls.length, 0);
  });

  it('unsubscribed listener is no longer called', () => {
    const m = makeTrafficLight();
    const calls = [];
    const unsub = m.subscribe(() => calls.push(true));

    m.send('NEXT'); // fires
    unsub();
    m.send('NEXT'); // should NOT fire
    m.send('NEXT'); // should NOT fire

    assert.equal(calls.length, 1);
  });

  it('unsubscribing one does not affect others', () => {
    const m = makeTrafficLight();
    const a = [];
    const b = [];
    const unsubA = m.subscribe(() => a.push(true));
    m.subscribe(() => b.push(true));

    unsubA();
    m.send('NEXT');

    assert.equal(a.length, 0);
    assert.equal(b.length, 1);
  });
});

// ─── reset() ─────────────────────────────────────────────────────────────────

describe('StateMachine – reset()', () => {
  it('returns the machine to its initial state', () => {
    const m = makeTrafficLight();
    m.send('NEXT'); // green
    m.send('NEXT'); // yellow
    m.reset();
    assert.equal(m.state, 'red');
  });

  it('clears context on reset', () => {
    const m = new StateMachine({
      initial: 'counting',
      transitions: [
        {
          from: 'counting',
          event: 'INC',
          to: 'counting',
          action: (ctx) => (/** @type {number} */ (ctx) ?? 0) + 1,
        },
      ],
    });
    m.send('INC'); // context = 1
    assert.equal(m.context, 1);
    m.reset();
    assert.equal(m.context, undefined);
  });

  it('machine transitions normally after reset', () => {
    const m = makeTrafficLight();
    m.send('NEXT'); // green
    m.reset();
    const ok = m.send('NEXT');
    assert.equal(ok, true);
    assert.equal(m.state, 'green');
  });
});

// ─── onTransition callback ────────────────────────────────────────────────────

describe('StateMachine – onTransition option', () => {
  it('onTransition is called with from, to, event after each transition', () => {
    const calls = [];
    const m = makeTrafficLight((from, to, event) => calls.push({ from, to, event }));

    m.send('NEXT');
    assert.deepEqual(calls, [{ from: 'red', to: 'green', event: 'NEXT' }]);
  });

  it('onTransition is NOT called when transition is invalid', () => {
    const calls = [];
    const m = makeTrafficLight(() => calls.push(true));

    m.send('BOGUS');
    assert.equal(calls.length, 0);
  });
});

// ─── from array ───────────────────────────────────────────────────────────────

describe('StateMachine – from as array', () => {
  it('transition with from array fires from any listed state', () => {
    const m = new StateMachine({
      initial: 'a',
      transitions: [
        { from: ['a', 'b'], event: 'GO', to: 'done' },
        { from: 'done',     event: 'BACK', to: 'a'  },
      ],
    });

    assert.equal(m.send('GO'), true);
    assert.equal(m.state, 'done');

    m.send('BACK'); // back to a
    m.send('GO');   // transition to done from a... but test from b
    // reset to test from 'b'
    const m2 = new StateMachine({
      initial: 'b',
      transitions: [
        { from: ['a', 'b'], event: 'GO', to: 'done' },
      ],
    });
    assert.equal(m2.send('GO'), true);
    assert.equal(m2.state, 'done');
  });
});
