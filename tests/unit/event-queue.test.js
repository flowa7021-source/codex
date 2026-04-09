// ─── Unit Tests: event-queue ──────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  EventQueue,
  createEventQueue,
} from '../../app/modules/event-queue.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Deterministic clock for reproducible timestamp ordering. */
function makeClock(start = 0) {
  let t = start;
  return () => t++;
}

// ─── EventQueue – enqueue / size / isEmpty ────────────────────────────────────

describe('EventQueue – enqueue, size, isEmpty', () => {
  it('starts empty', () => {
    const q = new EventQueue();
    assert.equal(q.size, 0);
    assert.equal(q.isEmpty, true);
  });

  it('size increments with each enqueue', () => {
    const q = new EventQueue();
    q.enqueue('a', 1);
    assert.equal(q.size, 1);
    q.enqueue('b', 2);
    assert.equal(q.size, 2);
  });

  it('isEmpty is false after enqueue', () => {
    const q = new EventQueue();
    q.enqueue('t', 'x');
    assert.equal(q.isEmpty, false);
  });

  it('enqueue stores type, payload, priority, and timestamp', () => {
    const clock = makeClock(1000);
    const q = new EventQueue({ clock });
    q.enqueue('resize', { w: 800 }, 5);
    const event = q.dequeue();
    assert.equal(event.type, 'resize');
    assert.deepEqual(event.payload, { w: 800 });
    assert.equal(event.priority, 5);
    assert.equal(event.timestamp, 1000);
  });

  it('enqueue without priority stores undefined priority', () => {
    const q = new EventQueue();
    q.enqueue('click', null);
    const event = q.dequeue();
    assert.equal(event.priority, undefined);
  });

  it('custom clock is used for timestamp', () => {
    let tick = 42;
    const q = new EventQueue({ clock: () => tick });
    q.enqueue('t', 'p');
    const event = q.dequeue();
    assert.equal(event.timestamp, 42);
  });

  it('enqueuing many events reflects in size', () => {
    const q = new EventQueue();
    for (let i = 0; i < 50; i++) q.enqueue('e', i);
    assert.equal(q.size, 50);
  });

  it('maxSize limits queue length by dropping lowest-priority events', () => {
    const q = new EventQueue({ maxSize: 3 });
    q.enqueue('low',  'L', 0);
    q.enqueue('mid',  'M', 5);
    q.enqueue('high', 'H', 10);
    q.enqueue('top',  'T', 15); // exceeds maxSize; lowest (priority 0) is dropped
    assert.equal(q.size, 3);
    const types = q.drainAll().map((e) => e.type);
    assert.ok(!types.includes('low'), 'lowest-priority event should have been dropped');
    assert.ok(types.includes('top'));
  });
});

// ─── EventQueue – dequeue ─────────────────────────────────────────────────────

describe('EventQueue – dequeue', () => {
  it('returns null when empty', () => {
    const q = new EventQueue();
    assert.equal(q.dequeue(), null);
  });

  it('returns the only event and empties the queue', () => {
    const q = new EventQueue();
    q.enqueue('sole', 'value');
    const event = q.dequeue();
    assert.equal(event.type, 'sole');
    assert.equal(q.size, 0);
    assert.equal(q.isEmpty, true);
  });

  it('dequeues highest-priority event first', () => {
    const q = new EventQueue({ clock: makeClock() });
    q.enqueue('low',  'L', 1);
    q.enqueue('high', 'H', 100);
    q.enqueue('mid',  'M', 50);
    const first = q.dequeue();
    assert.equal(first.type, 'high');
  });

  it('breaks priority ties by insertion order (FIFO)', () => {
    const q = new EventQueue({ clock: makeClock() });
    q.enqueue('first',  'a', 5);
    q.enqueue('second', 'b', 5);
    q.enqueue('third',  'c', 5);
    assert.equal(q.dequeue().type, 'first');
    assert.equal(q.dequeue().type, 'second');
    assert.equal(q.dequeue().type, 'third');
  });

  it('events without explicit priority default to 0', () => {
    const q = new EventQueue({ clock: makeClock() });
    q.enqueue('default', 'x');          // priority defaults to 0
    q.enqueue('explicit', 'y', 1);      // priority 1 → wins
    assert.equal(q.dequeue().type, 'explicit');
    assert.equal(q.dequeue().type, 'default');
  });

  it('size decrements with each dequeue', () => {
    const q = new EventQueue();
    q.enqueue('a', 1);
    q.enqueue('b', 2);
    q.dequeue();
    assert.equal(q.size, 1);
    q.dequeue();
    assert.equal(q.size, 0);
  });

  it('dequeue after drainAll returns null', () => {
    const q = new EventQueue();
    q.enqueue('x', 1);
    q.drainAll();
    assert.equal(q.dequeue(), null);
  });

  it('multiple dequeues on empty queue all return null', () => {
    const q = new EventQueue();
    assert.equal(q.dequeue(), null);
    assert.equal(q.dequeue(), null);
  });
});

// ─── EventQueue – peek ────────────────────────────────────────────────────────

describe('EventQueue – peek', () => {
  it('returns null on empty queue', () => {
    const q = new EventQueue();
    assert.equal(q.peek(), null);
  });

  it('returns the highest-priority event without removing it', () => {
    const q = new EventQueue({ clock: makeClock() });
    q.enqueue('lo', 'a', 1);
    q.enqueue('hi', 'b', 99);
    const event = q.peek();
    assert.equal(event.type, 'hi');
    assert.equal(q.size, 2); // not removed
  });

  it('peek is idempotent', () => {
    const q = new EventQueue({ clock: makeClock() });
    q.enqueue('only', 'x', 10);
    const e1 = q.peek();
    const e2 = q.peek();
    assert.equal(e1.type, e2.type);
    assert.equal(q.size, 1);
  });

  it('peek result matches what dequeue will return', () => {
    const q = new EventQueue({ clock: makeClock() });
    q.enqueue('alpha', 1, 3);
    q.enqueue('beta',  2, 7);
    const peeked = q.peek();
    const dequeued = q.dequeue();
    assert.equal(peeked.type, dequeued.type);
  });

  it('peek on a single-item queue does not empty it', () => {
    const q = new EventQueue();
    q.enqueue('solo', 'data');
    q.peek();
    assert.equal(q.size, 1);
    assert.equal(q.isEmpty, false);
  });

  it('peek after dequeue reflects the new front', () => {
    const q = new EventQueue({ clock: makeClock() });
    q.enqueue('hi', 'a', 10);
    q.enqueue('lo', 'b', 1);
    q.dequeue(); // removes 'hi'
    assert.equal(q.peek().type, 'lo');
  });

  it('peek returns correct event when all priorities are equal', () => {
    const q = new EventQueue({ clock: makeClock() });
    q.enqueue('first',  'x', 0);
    q.enqueue('second', 'y', 0);
    assert.equal(q.peek().type, 'first');
  });

  it('peek then clear leaves queue empty', () => {
    const q = new EventQueue();
    q.enqueue('e', 1);
    q.peek();
    q.clear();
    assert.equal(q.isEmpty, true);
  });
});

// ─── EventQueue – clear ───────────────────────────────────────────────────────

describe('EventQueue – clear', () => {
  it('empties a populated queue', () => {
    const q = new EventQueue();
    q.enqueue('a', 1);
    q.enqueue('b', 2);
    q.clear();
    assert.equal(q.size, 0);
    assert.equal(q.isEmpty, true);
  });

  it('clear on an empty queue does not throw', () => {
    const q = new EventQueue();
    assert.doesNotThrow(() => q.clear());
  });

  it('can enqueue again after clear', () => {
    const q = new EventQueue();
    q.enqueue('old', 1);
    q.clear();
    q.enqueue('new', 2);
    assert.equal(q.size, 1);
    assert.equal(q.dequeue().type, 'new');
  });

  it('dequeue returns null immediately after clear', () => {
    const q = new EventQueue();
    q.enqueue('x', 0);
    q.clear();
    assert.equal(q.dequeue(), null);
  });

  it('peek returns null immediately after clear', () => {
    const q = new EventQueue();
    q.enqueue('x', 0);
    q.clear();
    assert.equal(q.peek(), null);
  });
});

// ─── EventQueue – drainAll ───────────────────────────────────────────────────

describe('EventQueue – drainAll', () => {
  it('returns empty array when queue is empty', () => {
    const q = new EventQueue();
    assert.deepEqual(q.drainAll(), []);
  });

  it('returns all events in priority-descending order', () => {
    const q = new EventQueue({ clock: makeClock() });
    q.enqueue('c', 3, 3);
    q.enqueue('a', 1, 1);
    q.enqueue('b', 2, 2);
    const types = q.drainAll().map((e) => e.type);
    assert.deepEqual(types, ['c', 'b', 'a']);
  });

  it('empties the queue after drain', () => {
    const q = new EventQueue();
    q.enqueue('x', 1);
    q.drainAll();
    assert.equal(q.size, 0);
    assert.equal(q.isEmpty, true);
  });

  it('drainAll returns a snapshot; queue is unaffected by mutating result', () => {
    const q = new EventQueue();
    q.enqueue('x', 1);
    const all = q.drainAll();
    all.push({ type: 'injected', payload: null, timestamp: 0 }); // mutate return value
    assert.equal(q.size, 0); // queue still empty
  });

  it('preserves FIFO order for equal-priority events', () => {
    const q = new EventQueue({ clock: makeClock() });
    q.enqueue('first',  1, 5);
    q.enqueue('second', 2, 5);
    q.enqueue('third',  3, 5);
    const types = q.drainAll().map((e) => e.type);
    assert.deepEqual(types, ['first', 'second', 'third']);
  });

  it('returns all payloads correctly', () => {
    const q = new EventQueue({ clock: makeClock() });
    q.enqueue('ev', { id: 1 }, 10);
    q.enqueue('ev', { id: 2 }, 5);
    const drained = q.drainAll();
    assert.equal(drained[0].payload.id, 1);
    assert.equal(drained[1].payload.id, 2);
  });

  it('can enqueue and drain multiple times', () => {
    const q = new EventQueue({ clock: makeClock() });
    q.enqueue('a', 1, 1);
    q.drainAll();
    q.enqueue('b', 2, 2);
    const second = q.drainAll();
    assert.equal(second.length, 1);
    assert.equal(second[0].type, 'b');
  });
});

// ─── EventQueue – filter ─────────────────────────────────────────────────────

describe('EventQueue – filter', () => {
  it('returns empty array when nothing matches', () => {
    const q = new EventQueue();
    q.enqueue('click', 1);
    const result = q.filter((e) => e.type === 'scroll');
    assert.deepEqual(result, []);
  });

  it('does not remove matched events from the queue', () => {
    const q = new EventQueue();
    q.enqueue('click', 1);
    q.filter((e) => e.type === 'click');
    assert.equal(q.size, 1);
  });

  it('returns events matching the predicate', () => {
    const q = new EventQueue({ clock: makeClock() });
    q.enqueue('click',  1, 1);
    q.enqueue('scroll', 2, 2);
    q.enqueue('click',  3, 3);
    const result = q.filter((e) => e.type === 'click');
    assert.equal(result.length, 2);
    assert.ok(result.every((e) => e.type === 'click'));
  });

  it('filtered results are in priority order', () => {
    const q = new EventQueue({ clock: makeClock() });
    q.enqueue('e', 'low',  1);
    q.enqueue('e', 'high', 9);
    q.enqueue('e', 'mid',  5);
    const result = q.filter(() => true);
    const priorities = result.map((e) => e.payload);
    assert.deepEqual(priorities, ['high', 'mid', 'low']);
  });

  it('filter by payload property', () => {
    const q = new EventQueue({ clock: makeClock() });
    q.enqueue('update', { urgent: true },  10);
    q.enqueue('update', { urgent: false }, 5);
    q.enqueue('update', { urgent: true },  8);
    const result = q.filter((e) => e.payload.urgent === true);
    assert.equal(result.length, 2);
  });

  it('filter returns a new array; mutating it does not affect the queue', () => {
    const q = new EventQueue();
    q.enqueue('x', 1);
    const result = q.filter(() => true);
    result.pop();
    assert.equal(q.size, 1);
  });

  it('filter with always-false predicate returns empty array', () => {
    const q = new EventQueue();
    q.enqueue('a', 1);
    q.enqueue('b', 2);
    const result = q.filter(() => false);
    assert.deepEqual(result, []);
    assert.equal(q.size, 2); // queue unchanged
  });

  it('filter on empty queue returns empty array', () => {
    const q = new EventQueue();
    assert.deepEqual(q.filter(() => true), []);
  });
});

// ─── EventQueue – maxSize ─────────────────────────────────────────────────────

describe('EventQueue – maxSize', () => {
  it('queue never exceeds maxSize', () => {
    const q = new EventQueue({ maxSize: 5 });
    for (let i = 0; i < 20; i++) q.enqueue('e', i, i);
    assert.equal(q.size, 5);
  });

  it('retains the highest-priority events when over limit', () => {
    const q = new EventQueue({ maxSize: 2, clock: makeClock() });
    q.enqueue('lo',  'a', 1);
    q.enqueue('mid', 'b', 5);
    q.enqueue('hi',  'c', 10); // 'lo' should be dropped
    const types = q.drainAll().map((e) => e.type);
    assert.ok(types.includes('hi'));
    assert.ok(types.includes('mid'));
    assert.ok(!types.includes('lo'));
  });

  it('maxSize of 1 keeps only the single highest-priority event', () => {
    const q = new EventQueue({ maxSize: 1, clock: makeClock() });
    q.enqueue('low',  'a', 0);
    q.enqueue('high', 'b', 100);
    assert.equal(q.size, 1);
    assert.equal(q.dequeue().type, 'high');
  });

  it('without maxSize the queue grows unbounded', () => {
    const q = new EventQueue();
    for (let i = 0; i < 1000; i++) q.enqueue('e', i);
    assert.equal(q.size, 1000);
  });
});

// ─── createEventQueue factory ─────────────────────────────────────────────────

describe('createEventQueue – factory', () => {
  it('returns an EventQueue instance', () => {
    const q = createEventQueue();
    assert.ok(q instanceof EventQueue);
  });

  it('the created queue is immediately usable', () => {
    const q = createEventQueue();
    q.enqueue('test', 'payload');
    assert.equal(q.size, 1);
    assert.equal(q.dequeue().type, 'test');
  });

  it('options are passed through to the queue', () => {
    const q = createEventQueue({ maxSize: 2 });
    q.enqueue('a', 1);
    q.enqueue('b', 2);
    q.enqueue('c', 3);
    assert.equal(q.size, 2);
  });

  it('each call returns a distinct queue', () => {
    const a = createEventQueue();
    const b = createEventQueue();
    assert.notEqual(a, b);
    a.enqueue('only-a', 1);
    assert.equal(b.size, 0);
  });

  it('custom clock passed via factory is used', () => {
    let tick = 999;
    const q = createEventQueue({ clock: () => tick });
    q.enqueue('e', 'p');
    const event = q.dequeue();
    assert.equal(event.timestamp, 999);
  });
});
