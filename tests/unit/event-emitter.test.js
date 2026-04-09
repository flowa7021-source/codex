// ─── Unit Tests: EventEmitter ─────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { EventEmitter, createEventEmitter } from '../../app/modules/event-emitter.js';

// ─── Constructor ─────────────────────────────────────────────────────────────

describe('new EventEmitter()', () => {
  it('creates an instance of EventEmitter', () => {
    const emitter = new EventEmitter();
    assert.ok(emitter instanceof EventEmitter);
  });

  it('starts with no event names', () => {
    const emitter = new EventEmitter();
    assert.deepEqual(emitter.eventNames(), []);
  });
});

// ─── on() ────────────────────────────────────────────────────────────────────

describe('on()', () => {
  it('registers a listener that is called when the event is emitted', () => {
    const emitter = new EventEmitter();
    const calls = [];
    emitter.on('test', (value) => calls.push(value));
    emitter.emit('test', 42);
    assert.deepEqual(calls, [42]);
  });

  it('calls the listener with multiple arguments', () => {
    const emitter = new EventEmitter();
    const calls = [];
    emitter.on('multi', (a, b, c) => calls.push([a, b, c]));
    emitter.emit('multi', 1, 'hello', true);
    assert.deepEqual(calls, [[1, 'hello', true]]);
  });

  it('supports multiple listeners for the same event', () => {
    const emitter = new EventEmitter();
    const calls = [];
    emitter.on('evt', () => calls.push('first'));
    emitter.on('evt', () => calls.push('second'));
    emitter.emit('evt');
    assert.deepEqual(calls, ['first', 'second']);
  });

  it('returns `this` for chaining', () => {
    const emitter = new EventEmitter();
    const result = emitter.on('a', () => {}).on('b', () => {});
    assert.ok(result instanceof EventEmitter);
  });

  it('registers listeners for different events independently', () => {
    const emitter = new EventEmitter();
    const aValues = [];
    const bValues = [];
    emitter.on('a', (v) => aValues.push(v));
    emitter.on('b', (v) => bValues.push(v));
    emitter.emit('a', 1);
    emitter.emit('b', 2);
    assert.deepEqual(aValues, [1]);
    assert.deepEqual(bValues, [2]);
  });
});

// ─── once() ──────────────────────────────────────────────────────────────────

describe('once()', () => {
  it('calls the listener exactly once, then auto-removes it', () => {
    const emitter = new EventEmitter();
    const calls = [];
    emitter.once('tick', (v) => calls.push(v));
    emitter.emit('tick', 1);
    emitter.emit('tick', 2);
    emitter.emit('tick', 3);
    assert.deepEqual(calls, [1]);
  });

  it('returns `this` for chaining', () => {
    const emitter = new EventEmitter();
    const result = emitter.once('x', () => {});
    assert.ok(result instanceof EventEmitter);
  });

  it('does not affect other persistent listeners on the same event', () => {
    const emitter = new EventEmitter();
    const persistent = [];
    const oneShot = [];
    emitter.on('ev', (v) => persistent.push(v));
    emitter.once('ev', (v) => oneShot.push(v));
    emitter.emit('ev', 'a');
    emitter.emit('ev', 'b');
    assert.deepEqual(oneShot, ['a']);
    assert.deepEqual(persistent, ['a', 'b']);
  });

  it('removes the listener so listenerCount drops back down', () => {
    const emitter = new EventEmitter();
    emitter.once('go', () => {});
    assert.equal(emitter.listenerCount('go'), 1);
    emitter.emit('go');
    assert.equal(emitter.listenerCount('go'), 0);
  });
});

// ─── off() ───────────────────────────────────────────────────────────────────

describe('off()', () => {
  it('removes a specific listener so it is no longer called', () => {
    const emitter = new EventEmitter();
    const calls = [];
    const listener = (v) => calls.push(v);
    emitter.on('data', listener);
    emitter.off('data', listener);
    emitter.emit('data', 99);
    assert.deepEqual(calls, []);
  });

  it('does not remove other listeners for the same event', () => {
    const emitter = new EventEmitter();
    const a = [];
    const b = [];
    const listenerA = (v) => a.push(v);
    const listenerB = (v) => b.push(v);
    emitter.on('ev', listenerA);
    emitter.on('ev', listenerB);
    emitter.off('ev', listenerA);
    emitter.emit('ev', 7);
    assert.deepEqual(a, []);
    assert.deepEqual(b, [7]);
  });

  it('is safe to call with a listener that was never registered', () => {
    const emitter = new EventEmitter();
    assert.doesNotThrow(() => emitter.off('unknown', () => {}));
  });

  it('is safe to call off() on an event with no listeners', () => {
    const emitter = new EventEmitter();
    assert.doesNotThrow(() => emitter.off('nope', () => {}));
  });

  it('returns `this` for chaining', () => {
    const emitter = new EventEmitter();
    const fn = () => {};
    emitter.on('x', fn);
    const result = emitter.off('x', fn);
    assert.ok(result instanceof EventEmitter);
  });

  it('removes the event name from eventNames when last listener is removed', () => {
    const emitter = new EventEmitter();
    const fn = () => {};
    emitter.on('solo', fn);
    assert.ok(emitter.eventNames().includes('solo'));
    emitter.off('solo', fn);
    assert.ok(!emitter.eventNames().includes('solo'));
  });
});

// ─── emit() ──────────────────────────────────────────────────────────────────

describe('emit()', () => {
  it('returns true when at least one listener was called', () => {
    const emitter = new EventEmitter();
    emitter.on('ping', () => {});
    assert.equal(emitter.emit('ping'), true);
  });

  it('returns false when no listeners exist for the event', () => {
    const emitter = new EventEmitter();
    assert.equal(emitter.emit('ghost'), false);
  });

  it('passes all arguments to each listener', () => {
    const emitter = new EventEmitter();
    let received = null;
    emitter.on('msg', (...args) => { received = args; });
    emitter.emit('msg', 'a', 'b', 'c');
    assert.deepEqual(received, ['a', 'b', 'c']);
  });

  it('calls all registered listeners', () => {
    const emitter = new EventEmitter();
    let count = 0;
    emitter.on('inc', () => count++);
    emitter.on('inc', () => count++);
    emitter.on('inc', () => count++);
    emitter.emit('inc');
    assert.equal(count, 3);
  });

  it('is safe to call when no listeners exist (returns false, no throw)', () => {
    const emitter = new EventEmitter();
    assert.doesNotThrow(() => {
      const result = emitter.emit('empty');
      assert.equal(result, false);
    });
  });

  it('snapshot listeners so off() inside a listener does not skip later ones', () => {
    const emitter = new EventEmitter();
    const calls = [];
    const fnA = () => { emitter.off('chain', fnA); calls.push('A'); };
    const fnB = () => calls.push('B');
    emitter.on('chain', fnA);
    emitter.on('chain', fnB);
    emitter.emit('chain');
    assert.deepEqual(calls, ['A', 'B']);
  });
});

// ─── removeAllListeners() ────────────────────────────────────────────────────

describe('removeAllListeners()', () => {
  it('removes all listeners for a specific event', () => {
    const emitter = new EventEmitter();
    const calls = [];
    emitter.on('x', () => calls.push(1));
    emitter.on('x', () => calls.push(2));
    emitter.removeAllListeners('x');
    emitter.emit('x');
    assert.deepEqual(calls, []);
  });

  it('does not remove listeners for other events when event is specified', () => {
    const emitter = new EventEmitter();
    const aCalls = [];
    const bCalls = [];
    emitter.on('a', () => aCalls.push(1));
    emitter.on('b', () => bCalls.push(1));
    emitter.removeAllListeners('a');
    emitter.emit('a');
    emitter.emit('b');
    assert.deepEqual(aCalls, []);
    assert.deepEqual(bCalls, [1]);
  });

  it('removes all listeners for all events when called with no argument', () => {
    const emitter = new EventEmitter();
    const calls = [];
    emitter.on('a', () => calls.push('a'));
    emitter.on('b', () => calls.push('b'));
    emitter.on('c', () => calls.push('c'));
    emitter.removeAllListeners();
    emitter.emit('a');
    emitter.emit('b');
    emitter.emit('c');
    assert.deepEqual(calls, []);
    assert.deepEqual(emitter.eventNames(), []);
  });

  it('returns `this` for chaining', () => {
    const emitter = new EventEmitter();
    emitter.on('x', () => {});
    const result = emitter.removeAllListeners('x');
    assert.ok(result instanceof EventEmitter);
  });

  it('is safe to call for an event that has no listeners', () => {
    const emitter = new EventEmitter();
    assert.doesNotThrow(() => emitter.removeAllListeners('nope'));
  });
});

// ─── listenerCount() ─────────────────────────────────────────────────────────

describe('listenerCount()', () => {
  it('returns 0 for an event with no listeners', () => {
    const emitter = new EventEmitter();
    assert.equal(emitter.listenerCount('missing'), 0);
  });

  it('returns the correct count after adding listeners', () => {
    const emitter = new EventEmitter();
    emitter.on('ev', () => {});
    emitter.on('ev', () => {});
    emitter.on('ev', () => {});
    assert.equal(emitter.listenerCount('ev'), 3);
  });

  it('decrements after off() removes a listener', () => {
    const emitter = new EventEmitter();
    const fn = () => {};
    emitter.on('ev', fn);
    emitter.on('ev', () => {});
    assert.equal(emitter.listenerCount('ev'), 2);
    emitter.off('ev', fn);
    assert.equal(emitter.listenerCount('ev'), 1);
  });

  it('returns 0 after removeAllListeners for that event', () => {
    const emitter = new EventEmitter();
    emitter.on('ev', () => {});
    emitter.removeAllListeners('ev');
    assert.equal(emitter.listenerCount('ev'), 0);
  });
});

// ─── eventNames() ────────────────────────────────────────────────────────────

describe('eventNames()', () => {
  it('returns an empty array when no events are registered', () => {
    const emitter = new EventEmitter();
    assert.deepEqual(emitter.eventNames(), []);
  });

  it('returns names for events that have listeners', () => {
    const emitter = new EventEmitter();
    emitter.on('alpha', () => {});
    emitter.on('beta', () => {});
    const names = emitter.eventNames();
    assert.ok(names.includes('alpha'));
    assert.ok(names.includes('beta'));
    assert.equal(names.length, 2);
  });

  it('excludes an event name once all its listeners are removed', () => {
    const emitter = new EventEmitter();
    const fn = () => {};
    emitter.on('temp', fn);
    assert.ok(emitter.eventNames().includes('temp'));
    emitter.off('temp', fn);
    assert.ok(!emitter.eventNames().includes('temp'));
  });

  it('is empty after removeAllListeners() with no argument', () => {
    const emitter = new EventEmitter();
    emitter.on('x', () => {});
    emitter.on('y', () => {});
    emitter.removeAllListeners();
    assert.deepEqual(emitter.eventNames(), []);
  });
});

// ─── listeners() ─────────────────────────────────────────────────────────────

describe('listeners()', () => {
  it('returns empty array for unknown event', () => {
    const emitter = new EventEmitter();
    assert.deepEqual(emitter.listeners('missing'), []);
  });

  it('returns the registered listener functions', () => {
    const emitter = new EventEmitter();
    const fn1 = () => {};
    const fn2 = () => {};
    emitter.on('ev', fn1);
    emitter.on('ev', fn2);
    const list = emitter.listeners('ev');
    assert.equal(list.length, 2);
    assert.ok(list.includes(fn1));
    assert.ok(list.includes(fn2));
  });

  it('returns the original (unwrapped) function for once() listeners', () => {
    const emitter = new EventEmitter();
    const original = () => {};
    emitter.once('tick', original);
    const list = emitter.listeners('tick');
    assert.equal(list.length, 1);
    assert.equal(list[0], original);
  });

  it('returns a copy — mutating it does not affect the emitter', () => {
    const emitter = new EventEmitter();
    emitter.on('ev', () => {});
    const list = emitter.listeners('ev');
    list.length = 0;
    assert.equal(emitter.listenerCount('ev'), 1);
  });
});

// ─── setMaxListeners() / getMaxListeners() ────────────────────────────────────

describe('setMaxListeners() / getMaxListeners()', () => {
  it('default max listeners is 10', () => {
    const emitter = new EventEmitter();
    assert.equal(emitter.getMaxListeners(), 10);
  });

  it('setMaxListeners updates the limit', () => {
    const emitter = new EventEmitter();
    emitter.setMaxListeners(20);
    assert.equal(emitter.getMaxListeners(), 20);
  });

  it('setMaxListeners returns this for chaining', () => {
    const emitter = new EventEmitter();
    const result = emitter.setMaxListeners(5);
    assert.ok(result instanceof EventEmitter);
  });

  it('setting limit to 0 disables the warning (unlimited)', () => {
    const emitter = new EventEmitter();
    emitter.setMaxListeners(0);
    // Should not warn; add more than 10 listeners without console.warn being called
    const warned = [];
    const originalWarn = console.warn;
    console.warn = (...args) => warned.push(args);
    try {
      for (let i = 0; i < 15; i++) emitter.on('ev', () => {});
    } finally {
      console.warn = originalWarn;
    }
    assert.equal(warned.length, 0);
  });
});

// ─── createEventEmitter() ────────────────────────────────────────────────────

describe('createEventEmitter()', () => {
  it('creates and returns a new EventEmitter instance', () => {
    const emitter = createEventEmitter();
    assert.ok(emitter instanceof EventEmitter);
  });

  it('the returned instance is fully functional', () => {
    const emitter = createEventEmitter();
    const calls = [];
    emitter.on('hello', (v) => calls.push(v));
    emitter.emit('hello', 'world');
    assert.deepEqual(calls, ['world']);
  });

  it('each call returns a distinct instance', () => {
    const e1 = createEventEmitter();
    const e2 = createEventEmitter();
    assert.notEqual(e1, e2);
  });
});
