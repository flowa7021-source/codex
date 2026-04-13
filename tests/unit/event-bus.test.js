// ─── Unit Tests: EventBus ────────────────────────────────────────────────────
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  EventBus,
  createEventBus,
  globalBus,
} from '../../app/modules/event-bus.js';

// ─── on: handler called with payload ─────────────────────────────────────────

describe('on', () => {
  it('calls handler with emitted payload', () => {
    const bus = new EventBus();
    let received;
    bus.on('test', (val) => { received = val; });
    bus.emit('test', 42);
    assert.equal(received, 42);
  });

  it('calls multiple handlers for the same event', () => {
    const bus = new EventBus();
    const results = [];
    bus.on('multi', (v) => results.push('a:' + v));
    bus.on('multi', (v) => results.push('b:' + v));
    bus.emit('multi', 1);
    assert.deepEqual(results, ['a:1', 'b:1']);
  });
});

// ─── once: handler called once then removed ───────────────────────────────────

describe('once', () => {
  it('calls handler only once', () => {
    const bus = new EventBus();
    let count = 0;
    bus.once('ping', () => { count++; });
    bus.emit('ping', undefined);
    bus.emit('ping', undefined);
    assert.equal(count, 1);
  });

  it('passes payload on the single call', () => {
    const bus = new EventBus();
    let received;
    bus.once('val', (v) => { received = v; });
    bus.emit('val', 'hello');
    assert.equal(received, 'hello');
  });
});

// ─── emit: multiple handlers called ──────────────────────────────────────────

describe('emit', () => {
  it('does nothing when no handlers registered', () => {
    const bus = new EventBus();
    assert.doesNotThrow(() => bus.emit('nothing', null));
  });

  it('passes object payload to all handlers', () => {
    const bus = new EventBus();
    const calls = [];
    bus.on('data', (d) => calls.push(d));
    bus.on('data', (d) => calls.push(d));
    bus.emit('data', { x: 1 });
    assert.equal(calls.length, 2);
    assert.deepEqual(calls[0], { x: 1 });
  });
});

// ─── off with event: removes handlers for that event ─────────────────────────

describe('off with event', () => {
  it('removes all handlers for the specified event', () => {
    const bus = new EventBus();
    let count = 0;
    bus.on('remove-me', () => count++);
    bus.on('remove-me', () => count++);
    bus.off('remove-me');
    bus.emit('remove-me', undefined);
    assert.equal(count, 0);
  });

  it('does not affect handlers for other events', () => {
    const bus = new EventBus();
    let aCount = 0;
    let bCount = 0;
    bus.on('a', () => aCount++);
    bus.on('b', () => bCount++);
    bus.off('a');
    bus.emit('a', undefined);
    bus.emit('b', undefined);
    assert.equal(aCount, 0);
    assert.equal(bCount, 1);
  });
});

// ─── off without event: removes all handlers ─────────────────────────────────

describe('off without event', () => {
  it('removes all handlers when called with no argument', () => {
    const bus = new EventBus();
    let count = 0;
    bus.on('x', () => count++);
    bus.on('y', () => count++);
    bus.off();
    bus.emit('x', undefined);
    bus.emit('y', undefined);
    assert.equal(count, 0);
  });
});

// ─── listenerCount ───────────────────────────────────────────────────────────

describe('listenerCount', () => {
  it('returns 0 for an event with no handlers', () => {
    const bus = new EventBus();
    assert.equal(bus.listenerCount('nothing'), 0);
  });

  it('returns correct count per event', () => {
    const bus = new EventBus();
    bus.on('ev', () => {});
    bus.on('ev', () => {});
    assert.equal(bus.listenerCount('ev'), 2);
  });

  it('returns total count across all events when called with no argument', () => {
    const bus = new EventBus();
    bus.on('a', () => {});
    bus.on('b', () => {});
    bus.on('b', () => {});
    assert.equal(bus.listenerCount(), 3);
  });
});

// ─── eventNames ──────────────────────────────────────────────────────────────

describe('eventNames', () => {
  it('returns empty array when no handlers registered', () => {
    const bus = new EventBus();
    assert.deepEqual(bus.eventNames(), []);
  });

  it('returns event names that have handlers', () => {
    const bus = new EventBus();
    bus.on('alpha', () => {});
    bus.on('beta', () => {});
    const names = bus.eventNames().sort();
    assert.deepEqual(names, ['alpha', 'beta']);
  });

  it('excludes events whose handlers were removed via off', () => {
    const bus = new EventBus();
    bus.on('gone', () => {});
    bus.on('stay', () => {});
    bus.off('gone');
    assert.deepEqual(bus.eventNames(), ['stay']);
  });
});

// ─── globalBus: accessible and functional ────────────────────────────────────

describe('globalBus', () => {
  it('is an EventBus instance', () => {
    assert.ok(globalBus instanceof EventBus);
  });

  it('can emit and receive events', () => {
    let received;
    const unsub = globalBus.on('global:test', (v) => { received = v; });
    globalBus.emit('global:test', 'world');
    unsub();
    assert.equal(received, 'world');
  });
});

// ─── createEventBus factory ──────────────────────────────────────────────────

describe('createEventBus', () => {
  it('returns a new EventBus instance', () => {
    const bus = createEventBus();
    assert.ok(bus instanceof EventBus);
  });

  it('instances are independent', () => {
    const busA = createEventBus();
    const busB = createEventBus();
    let aCount = 0;
    let bCount = 0;
    busA.on('ev', () => aCount++);
    busB.on('ev', () => bCount++);
    busA.emit('ev', undefined);
    assert.equal(aCount, 1);
    assert.equal(bCount, 0);
  });
});

// ─── unsubscribe function: removes individual handler ────────────────────────

describe('unsubscribe', () => {
  it('returned function removes only that specific handler', () => {
    const bus = new EventBus();
    let aCount = 0;
    let bCount = 0;
    const unsub = bus.on('shared', () => aCount++);
    bus.on('shared', () => bCount++);
    unsub();
    bus.emit('shared', undefined);
    assert.equal(aCount, 0);
    assert.equal(bCount, 1);
  });

  it('calling unsubscribe twice is safe', () => {
    const bus = new EventBus();
    const unsub = bus.on('safe', () => {});
    unsub();
    assert.doesNotThrow(() => unsub());
  });
});
