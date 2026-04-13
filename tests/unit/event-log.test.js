// ─── Unit Tests: EventLog ────────────────────────────────────────────────────
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  EventLog,
  createEventLog,
} from '../../app/modules/event-log.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Create a deterministic clock that increments by 1 per call. */
function makeClock(start = 1000) {
  let t = start;
  return () => t++;
}

// ─── EventLog ────────────────────────────────────────────────────────────────

describe('EventLog', () => {
  let log;

  beforeEach(() => {
    log = new EventLog(makeClock());
  });

  it('starts empty with size 0', () => {
    assert.equal(log.size, 0);
  });

  it('append() returns a LogEntry with correct fields', () => {
    const entry = log.append('UserCreated', { name: 'Alice' });
    assert.equal(typeof entry.id, 'string');
    assert.equal(entry.type, 'UserCreated');
    assert.deepEqual(entry.payload, { name: 'Alice' });
    assert.equal(typeof entry.timestamp, 'number');
    assert.equal(entry.sequence, 1);
  });

  it('append() increments size', () => {
    log.append('A', null);
    log.append('B', null);
    assert.equal(log.size, 2);
  });

  it('append() assigns monotonically increasing sequence numbers', () => {
    const e1 = log.append('A', null);
    const e2 = log.append('B', null);
    const e3 = log.append('C', null);
    assert.equal(e1.sequence, 1);
    assert.equal(e2.sequence, 2);
    assert.equal(e3.sequence, 3);
  });

  it('append() uses the injected clock for timestamp', () => {
    const clock = makeClock(5000);
    const testLog = new EventLog(clock);
    const e1 = testLog.append('X', null);
    const e2 = testLog.append('Y', null);
    assert.equal(e1.timestamp, 5000);
    assert.equal(e2.timestamp, 5001);
  });

  it('getById() returns the correct entry', () => {
    const e = log.append('Foo', 42);
    const found = log.getById(e.id);
    assert.ok(found !== undefined);
    assert.equal(found.id, e.id);
    assert.equal(found.payload, 42);
  });

  it('getById() returns undefined for unknown id', () => {
    log.append('Foo', null);
    assert.equal(log.getById('nonexistent-id'), undefined);
  });

  it('getByType() returns all entries of a given type', () => {
    log.append('Click', 1);
    log.append('Hover', 2);
    log.append('Click', 3);
    const clicks = log.getByType('Click');
    assert.equal(clicks.length, 2);
    assert.equal(clicks[0].payload, 1);
    assert.equal(clicks[1].payload, 3);
  });

  it('getByType() returns empty array for unknown type', () => {
    log.append('Exists', null);
    assert.deepEqual(log.getByType('NoSuchType'), []);
  });

  it('getRange() returns entries with sequence in [from, to] inclusive', () => {
    log.append('A', null); // seq 1
    log.append('B', null); // seq 2
    log.append('C', null); // seq 3
    log.append('D', null); // seq 4
    const range = log.getRange(2, 3);
    assert.equal(range.length, 2);
    assert.equal(range[0].type, 'B');
    assert.equal(range[1].type, 'C');
  });

  it('getRange() returns empty array when range matches nothing', () => {
    log.append('A', null);
    assert.deepEqual(log.getRange(5, 10), []);
  });

  it('getRange() includes boundary sequences', () => {
    log.append('A', null); // seq 1
    log.append('B', null); // seq 2
    log.append('C', null); // seq 3
    const range = log.getRange(1, 3);
    assert.equal(range.length, 3);
  });

  it('since() returns entries at or after the given timestamp', () => {
    const clock = makeClock(100);
    const testLog = new EventLog(clock);
    testLog.append('A', null); // ts 100
    testLog.append('B', null); // ts 101
    testLog.append('C', null); // ts 102
    const result = testLog.since(101);
    assert.equal(result.length, 2);
    assert.equal(result[0].type, 'B');
    assert.equal(result[1].type, 'C');
  });

  it('since() returns all entries when timestamp is very early', () => {
    log.append('A', null);
    log.append('B', null);
    const result = log.since(0);
    assert.equal(result.length, 2);
  });

  it('since() returns empty when all entries are older', () => {
    const clock = makeClock(50);
    const testLog = new EventLog(clock);
    testLog.append('A', null); // ts 50
    assert.deepEqual(testLog.since(200), []);
  });

  it('subscribe() handler is called when a matching type is appended', () => {
    const received = [];
    log.subscribe('OrderPlaced', (entry) => received.push(entry));
    log.append('OrderPlaced', { orderId: 1 });
    log.append('OrderCancelled', { orderId: 1 });
    assert.equal(received.length, 1);
    assert.equal(received[0].type, 'OrderPlaced');
  });

  it('subscribe() unsubscribe function stops further notifications', () => {
    const received = [];
    const unsub = log.subscribe('E', (entry) => received.push(entry));
    log.append('E', 1);
    unsub();
    log.append('E', 2);
    assert.equal(received.length, 1);
    assert.equal(received[0].payload, 1);
  });

  it('subscribe() can register multiple handlers for the same type', () => {
    const a = [];
    const b = [];
    log.subscribe('T', (e) => a.push(e.payload));
    log.subscribe('T', (e) => b.push(e.payload));
    log.append('T', 'hello');
    assert.deepEqual(a, ['hello']);
    assert.deepEqual(b, ['hello']);
  });

  it('subscribeAll() receives every appended entry regardless of type', () => {
    const received = [];
    log.subscribeAll((entry) => received.push(entry.type));
    log.append('X', null);
    log.append('Y', null);
    log.append('Z', null);
    assert.deepEqual(received, ['X', 'Y', 'Z']);
  });

  it('subscribeAll() unsubscribe function stops further notifications', () => {
    const received = [];
    const unsub = log.subscribeAll((e) => received.push(e));
    log.append('P', 1);
    unsub();
    log.append('P', 2);
    assert.equal(received.length, 1);
  });

  it('clear() resets size to 0 and sequence counter', () => {
    log.append('A', null);
    log.append('B', null);
    assert.equal(log.size, 2);
    log.clear();
    assert.equal(log.size, 0);
    // Sequence restarts from 1 after clear
    const entry = log.append('C', null);
    assert.equal(entry.sequence, 1);
  });

  it('clear() is safe to call on an empty log', () => {
    assert.doesNotThrow(() => log.clear());
    assert.equal(log.size, 0);
  });

  it('clear() does not remove subscriptions', () => {
    const received = [];
    log.subscribe('Evt', (e) => received.push(e.payload));
    log.append('Evt', 'before');
    log.clear();
    log.append('Evt', 'after');
    assert.deepEqual(received, ['before', 'after']);
  });
});

// ─── Factory Function ─────────────────────────────────────────────────────────

describe('createEventLog()', () => {
  it('returns an EventLog instance', () => {
    const log = createEventLog();
    assert.ok(log instanceof EventLog);
    assert.equal(log.size, 0);
  });

  it('accepts an optional clock parameter', () => {
    let t = 9999;
    const log = createEventLog(() => t++);
    const entry = log.append('Test', null);
    assert.equal(entry.timestamp, 9999);
  });

  it('works end-to-end without arguments', () => {
    const log = createEventLog();
    const before = Date.now();
    const entry = log.append('Boot', { version: 1 });
    const after = Date.now();
    assert.ok(entry.timestamp >= before && entry.timestamp <= after);
    assert.equal(entry.sequence, 1);
    assert.equal(log.size, 1);
  });
});

// ─── Integration scenarios ───────────────────────────────────────────────────

describe('EventLog integration', () => {
  it('subscribe + subscribeAll both fire for the same append', () => {
    const log = createEventLog(makeClock());
    const typed = [];
    const all = [];
    log.subscribe('Sale', (e) => typed.push(e.payload));
    log.subscribeAll((e) => all.push(e.payload));
    log.append('Sale', 100);
    log.append('Refund', 50);
    assert.deepEqual(typed, [100]);
    assert.deepEqual(all, [100, 50]);
  });

  it('getRange + getByType compose correctly over mixed entries', () => {
    const log = createEventLog(makeClock());
    log.append('A', 1); // seq 1
    log.append('B', 2); // seq 2
    log.append('A', 3); // seq 3
    log.append('B', 4); // seq 4
    log.append('A', 5); // seq 5
    // Range 2-4 gives B(2), A(3), B(4)
    const range = log.getRange(2, 4);
    assert.equal(range.length, 3);
    // Among those, only type A
    const aInRange = range.filter((e) => e.type === 'A');
    assert.equal(aInRange.length, 1);
    assert.equal(aInRange[0].payload, 3);
  });
});
