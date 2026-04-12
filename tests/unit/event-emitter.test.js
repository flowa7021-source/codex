// ─── Unit Tests: EventEmitter ─────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { EventEmitter, SimpleEmitter, createEmitter } from '../../app/modules/event-emitter.js';

// ─── on() / emit() basic usage ───────────────────────────────────────────────

describe('EventEmitter – on() / emit() basic', () => {
  it('creates an instance of EventEmitter', () => {
    const emitter = new EventEmitter();
    assert.ok(emitter instanceof EventEmitter);
  });

  it('starts with no event names', () => {
    const emitter = new EventEmitter();
    assert.deepEqual(emitter.eventNames(), []);
  });

  it('listener is called when the event is emitted', () => {
    const emitter = new EventEmitter();
    const calls = [];
    emitter.on('test', (value) => calls.push(value));
    emitter.emit('test', 42);
    assert.deepEqual(calls, [42]);
  });

  it('listener receives multiple arguments', () => {
    const emitter = new EventEmitter();
    const calls = [];
    emitter.on('multi', (a, b, c) => calls.push([a, b, c]));
    emitter.emit('multi', 1, 'hello', true);
    assert.deepEqual(calls, [[1, 'hello', true]]);
  });

  it('emit returns true when at least one listener was called', () => {
    const emitter = new EventEmitter();
    emitter.on('ping', () => {});
    assert.equal(emitter.emit('ping'), true);
  });

  it('emit returns false when no listeners exist for the event', () => {
    const emitter = new EventEmitter();
    assert.equal(emitter.emit('ghost'), false);
  });

  it('emit returns false after all listeners for that event are removed', () => {
    const emitter = new EventEmitter();
    const fn = () => {};
    emitter.on('ev', fn);
    emitter.off('ev', fn);
    assert.equal(emitter.emit('ev'), false);
  });

  it('passes all arguments to each listener', () => {
    const emitter = new EventEmitter();
    let received = null;
    emitter.on('msg', (...args) => { received = args; });
    emitter.emit('msg', 'a', 'b', 'c');
    assert.deepEqual(received, ['a', 'b', 'c']);
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

  it('emit is safe to call when no listeners exist (returns false, no throw)', () => {
    const emitter = new EventEmitter();
    assert.doesNotThrow(() => {
      const result = emitter.emit('empty');
      assert.equal(result, false);
    });
  });
});

// ─── once() ──────────────────────────────────────────────────────────────────

describe('EventEmitter – once()', () => {
  it('calls the listener exactly once', () => {
    const emitter = new EventEmitter();
    const calls = [];
    emitter.once('tick', (v) => calls.push(v));
    emitter.emit('tick', 1);
    emitter.emit('tick', 2);
    emitter.emit('tick', 3);
    assert.deepEqual(calls, [1]);
  });

  it('subsequent emits are ignored after first call', () => {
    const emitter = new EventEmitter();
    let count = 0;
    emitter.once('ev', () => count++);
    emitter.emit('ev');
    emitter.emit('ev');
    emitter.emit('ev');
    assert.equal(count, 1);
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

  it('listenerCount drops to 0 after first emit', () => {
    const emitter = new EventEmitter();
    emitter.once('go', () => {});
    assert.equal(emitter.listenerCount('go'), 1);
    emitter.emit('go');
    assert.equal(emitter.listenerCount('go'), 0);
  });

  it('once() returns an unsubscribe function', () => {
    const emitter = new EventEmitter();
    const off = emitter.once('x', () => {});
    assert.equal(typeof off, 'function');
  });

  it('calling the returned unsubscribe prevents the listener from firing', () => {
    const emitter = new EventEmitter();
    const calls = [];
    const off = emitter.once('ev', (v) => calls.push(v));
    off();
    emitter.emit('ev', 99);
    assert.deepEqual(calls, []);
  });
});

// ─── off() ───────────────────────────────────────────────────────────────────

describe('EventEmitter – off()', () => {
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

  it('removes the event name from eventNames when last listener is removed', () => {
    const emitter = new EventEmitter();
    const fn = () => {};
    emitter.on('solo', fn);
    assert.ok(emitter.eventNames().includes('solo'));
    emitter.off('solo', fn);
    assert.ok(!emitter.eventNames().includes('solo'));
  });

  it('off() returns void', () => {
    const emitter = new EventEmitter();
    const fn = () => {};
    emitter.on('x', fn);
    const result = emitter.off('x', fn);
    assert.equal(result, undefined);
  });
});

// ─── removeAllListeners() ────────────────────────────────────────────────────

describe('EventEmitter – removeAllListeners()', () => {
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

  it('is safe to call for an event that has no listeners', () => {
    const emitter = new EventEmitter();
    assert.doesNotThrow(() => emitter.removeAllListeners('nope'));
  });

  it('removeAllListeners() returns void', () => {
    const emitter = new EventEmitter();
    emitter.on('x', () => {});
    const result = emitter.removeAllListeners('x');
    assert.equal(result, undefined);
  });

  it('listenerCount is 0 after removeAllListeners for that event', () => {
    const emitter = new EventEmitter();
    emitter.on('ev', () => {});
    emitter.on('ev', () => {});
    emitter.removeAllListeners('ev');
    assert.equal(emitter.listenerCount('ev'), 0);
  });
});

// ─── listenerCount() / eventNames() ─────────────────────────────────────────

describe('EventEmitter – listenerCount() / eventNames()', () => {
  it('listenerCount returns 0 for an event with no listeners', () => {
    const emitter = new EventEmitter();
    assert.equal(emitter.listenerCount('missing'), 0);
  });

  it('listenerCount returns the correct count after adding listeners', () => {
    const emitter = new EventEmitter();
    emitter.on('ev', () => {});
    emitter.on('ev', () => {});
    emitter.on('ev', () => {});
    assert.equal(emitter.listenerCount('ev'), 3);
  });

  it('listenerCount decrements after off() removes a listener', () => {
    const emitter = new EventEmitter();
    const fn = () => {};
    emitter.on('ev', fn);
    emitter.on('ev', () => {});
    assert.equal(emitter.listenerCount('ev'), 2);
    emitter.off('ev', fn);
    assert.equal(emitter.listenerCount('ev'), 1);
  });

  it('eventNames returns an empty array when no events are registered', () => {
    const emitter = new EventEmitter();
    assert.deepEqual(emitter.eventNames(), []);
  });

  it('eventNames returns names for events that have listeners', () => {
    const emitter = new EventEmitter();
    emitter.on('alpha', () => {});
    emitter.on('beta', () => {});
    const names = emitter.eventNames();
    assert.ok(names.includes('alpha'));
    assert.ok(names.includes('beta'));
    assert.equal(names.length, 2);
  });

  it('eventNames excludes an event name once all its listeners are removed', () => {
    const emitter = new EventEmitter();
    const fn = () => {};
    emitter.on('temp', fn);
    assert.ok(emitter.eventNames().includes('temp'));
    emitter.off('temp', fn);
    assert.ok(!emitter.eventNames().includes('temp'));
  });

  it('eventNames is empty after removeAllListeners() with no argument', () => {
    const emitter = new EventEmitter();
    emitter.on('x', () => {});
    emitter.on('y', () => {});
    emitter.removeAllListeners();
    assert.deepEqual(emitter.eventNames(), []);
  });
});

// ─── on() returns unsubscribe function ───────────────────────────────────────

describe('EventEmitter – on() returns unsubscribe function', () => {
  it('on() returns a function', () => {
    const emitter = new EventEmitter();
    const off = emitter.on('ev', () => {});
    assert.equal(typeof off, 'function');
  });

  it('calling the returned function removes the listener', () => {
    const emitter = new EventEmitter();
    const calls = [];
    const off = emitter.on('ev', (v) => calls.push(v));
    emitter.emit('ev', 1);
    off();
    emitter.emit('ev', 2);
    assert.deepEqual(calls, [1]);
  });

  it('calling the returned function is idempotent', () => {
    const emitter = new EventEmitter();
    const calls = [];
    const off = emitter.on('ev', (v) => calls.push(v));
    off();
    off(); // second call should not throw
    emitter.emit('ev', 42);
    assert.deepEqual(calls, []);
  });

  it('unsubscribing one listener does not affect others', () => {
    const emitter = new EventEmitter();
    const a = [];
    const b = [];
    const offA = emitter.on('ev', (v) => a.push(v));
    emitter.on('ev', (v) => b.push(v));
    offA();
    emitter.emit('ev', 7);
    assert.deepEqual(a, []);
    assert.deepEqual(b, [7]);
  });
});

// ─── Multiple listeners for same event ───────────────────────────────────────

describe('EventEmitter – multiple listeners for same event', () => {
  it('all listeners are called in registration order', () => {
    const emitter = new EventEmitter();
    const calls = [];
    emitter.on('ev', () => calls.push('first'));
    emitter.on('ev', () => calls.push('second'));
    emitter.on('ev', () => calls.push('third'));
    emitter.emit('ev');
    assert.deepEqual(calls, ['first', 'second', 'third']);
  });

  it('each listener receives the same arguments', () => {
    const emitter = new EventEmitter();
    const received = [];
    emitter.on('ev', (v) => received.push(['A', v]));
    emitter.on('ev', (v) => received.push(['B', v]));
    emitter.emit('ev', 42);
    assert.deepEqual(received, [['A', 42], ['B', 42]]);
  });

  it('emit returns true when multiple listeners exist', () => {
    const emitter = new EventEmitter();
    emitter.on('ev', () => {});
    emitter.on('ev', () => {});
    assert.equal(emitter.emit('ev'), true);
  });
});

// ─── Listener removed during emit (safe iteration) ───────────────────────────

describe('EventEmitter – listener removed during emit', () => {
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

  it('a listener that removes itself during emit does not fire again', () => {
    const emitter = new EventEmitter();
    let count = 0;
    const fn = () => {
      count++;
      emitter.off('ev', fn);
    };
    emitter.on('ev', fn);
    emitter.emit('ev');
    emitter.emit('ev');
    assert.equal(count, 1);
  });

  it('adding a new listener during emit does not cause it to fire in that emit', () => {
    const emitter = new EventEmitter();
    const calls = [];
    emitter.on('ev', () => {
      calls.push('original');
      emitter.on('ev', () => calls.push('added-during-emit'));
    });
    emitter.emit('ev');
    // The newly added listener should NOT fire in this emit cycle
    assert.deepEqual(calls, ['original']);
    // But it should fire in the next emit
    emitter.emit('ev');
    assert.ok(calls.includes('added-during-emit'));
  });
});

// ─── setMaxListeners / getMaxListeners ───────────────────────────────────────

describe('EventEmitter – setMaxListeners / getMaxListeners', () => {
  it('default max listeners is 10', () => {
    const emitter = new EventEmitter();
    assert.equal(emitter.getMaxListeners(), 10);
  });

  it('setMaxListeners updates the limit', () => {
    const emitter = new EventEmitter();
    emitter.setMaxListeners(20);
    assert.equal(emitter.getMaxListeners(), 20);
  });

  it('setMaxListeners returns void', () => {
    const emitter = new EventEmitter();
    const result = emitter.setMaxListeners(5);
    assert.equal(result, undefined);
  });

  it('setting limit to 0 disables the warning (unlimited)', () => {
    const emitter = new EventEmitter();
    emitter.setMaxListeners(0);
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

  it('a warning is emitted when listener count exceeds max', () => {
    const emitter = new EventEmitter();
    emitter.setMaxListeners(3);
    const warned = [];
    const originalWarn = console.warn;
    console.warn = (...args) => warned.push(args);
    try {
      emitter.on('ev', () => {});
      emitter.on('ev', () => {});
      emitter.on('ev', () => {});
      assert.equal(warned.length, 0); // exactly at limit — no warn
      emitter.on('ev', () => {}); // exceeds limit
      assert.equal(warned.length, 1);
    } finally {
      console.warn = originalWarn;
    }
  });

  it('getMaxListeners returns updated value after multiple sets', () => {
    const emitter = new EventEmitter();
    emitter.setMaxListeners(5);
    assert.equal(emitter.getMaxListeners(), 5);
    emitter.setMaxListeners(100);
    assert.equal(emitter.getMaxListeners(), 100);
  });
});

// ─── SimpleEmitter class ─────────────────────────────────────────────────────

describe('SimpleEmitter', () => {
  it('creates an instance of SimpleEmitter', () => {
    const emitter = new SimpleEmitter();
    assert.ok(emitter instanceof SimpleEmitter);
  });

  it('on() registers a listener called on emit', () => {
    const emitter = new SimpleEmitter();
    const calls = [];
    emitter.on('event', (v) => calls.push(v));
    emitter.emit('event', 42);
    assert.deepEqual(calls, [42]);
  });

  it('on() returns an unsubscribe function', () => {
    const emitter = new SimpleEmitter();
    const off = emitter.on('ev', () => {});
    assert.equal(typeof off, 'function');
  });

  it('unsubscribe returned by on() stops listener from firing', () => {
    const emitter = new SimpleEmitter();
    const calls = [];
    const off = emitter.on('ev', (v) => calls.push(v));
    emitter.emit('ev', 1);
    off();
    emitter.emit('ev', 2);
    assert.deepEqual(calls, [1]);
  });

  it('once() fires only once', () => {
    const emitter = new SimpleEmitter();
    let count = 0;
    emitter.once('ev', () => count++);
    emitter.emit('ev');
    emitter.emit('ev');
    assert.equal(count, 1);
  });

  it('once() returns an unsubscribe function', () => {
    const emitter = new SimpleEmitter();
    const off = emitter.once('ev', () => {});
    assert.equal(typeof off, 'function');
  });

  it('off() removes a specific listener', () => {
    const emitter = new SimpleEmitter();
    const calls = [];
    const fn = (v) => calls.push(v);
    emitter.on('ev', fn);
    emitter.off('ev', fn);
    emitter.emit('ev', 1);
    assert.deepEqual(calls, []);
  });

  it('emit() returns true when listeners exist', () => {
    const emitter = new SimpleEmitter();
    emitter.on('ev', () => {});
    assert.equal(emitter.emit('ev'), true);
  });

  it('emit() returns false when no listeners exist', () => {
    const emitter = new SimpleEmitter();
    assert.equal(emitter.emit('nope'), false);
  });

  it('removeAllListeners() without arg removes everything', () => {
    const emitter = new SimpleEmitter();
    emitter.on('a', () => {});
    emitter.on('b', () => {});
    emitter.removeAllListeners();
    assert.deepEqual(emitter.eventNames(), []);
  });

  it('removeAllListeners(event) removes only that event', () => {
    const emitter = new SimpleEmitter();
    const calls = [];
    emitter.on('a', () => calls.push('a'));
    emitter.on('b', () => calls.push('b'));
    emitter.removeAllListeners('a');
    emitter.emit('a');
    emitter.emit('b');
    assert.deepEqual(calls, ['b']);
  });

  it('listenerCount returns correct number of listeners', () => {
    const emitter = new SimpleEmitter();
    emitter.on('ev', () => {});
    emitter.on('ev', () => {});
    assert.equal(emitter.listenerCount('ev'), 2);
  });

  it('eventNames returns registered event names', () => {
    const emitter = new SimpleEmitter();
    emitter.on('foo', () => {});
    emitter.on('bar', () => {});
    const names = emitter.eventNames();
    assert.ok(names.includes('foo'));
    assert.ok(names.includes('bar'));
  });
});

// ─── createEmitter factory ───────────────────────────────────────────────────

describe('createEmitter()', () => {
  it('creates and returns a new EventEmitter instance', () => {
    const emitter = createEmitter();
    assert.ok(emitter instanceof EventEmitter);
  });

  it('the returned instance is fully functional', () => {
    const emitter = createEmitter();
    const calls = [];
    emitter.on('hello', (v) => calls.push(v));
    emitter.emit('hello', 'world');
    assert.deepEqual(calls, ['world']);
  });

  it('each call returns a distinct instance', () => {
    const e1 = createEmitter();
    const e2 = createEmitter();
    assert.notEqual(e1, e2);
  });

  it('instances created by the factory are independent', () => {
    const e1 = createEmitter();
    const e2 = createEmitter();
    const a = [];
    const b = [];
    e1.on('ev', (v) => a.push(v));
    e2.on('ev', (v) => b.push(v));
    e1.emit('ev', 1);
    assert.deepEqual(a, [1]);
    assert.deepEqual(b, []);
  });

  it('factory result supports once()', () => {
    const emitter = createEmitter();
    let count = 0;
    emitter.once('tick', () => count++);
    emitter.emit('tick');
    emitter.emit('tick');
    assert.equal(count, 1);
  });

  it('factory result supports removeAllListeners()', () => {
    const emitter = createEmitter();
    emitter.on('a', () => {});
    emitter.on('b', () => {});
    emitter.removeAllListeners();
    assert.deepEqual(emitter.eventNames(), []);
  });
});
