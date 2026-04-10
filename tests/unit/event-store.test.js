// ─── Unit Tests: EventStore ───────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { EventStore, createEventStore, replayStream } from '../../app/modules/event-store.js';

// ─── append ───────────────────────────────────────────────────────────────────

describe('EventStore – append', () => {
  it('returns a stored event with id, version, and timestamp', () => {
    const store = new EventStore();
    const before = Date.now();
    const event = store.append('orders', 'OrderPlaced', { amount: 42 });
    const after = Date.now();

    assert.ok(typeof event.id === 'string' && event.id.length > 0, 'id should be a non-empty string');
    assert.equal(event.streamId, 'orders');
    assert.equal(event.type, 'OrderPlaced');
    assert.deepEqual(event.data, { amount: 42 });
    assert.equal(event.version, 1);
    assert.ok(event.timestamp >= before && event.timestamp <= after, 'timestamp should be current time');
  });

  it('first event in a stream has version 1', () => {
    const store = new EventStore();
    const event = store.append('stream-a', 'Init', null);
    assert.equal(event.version, 1);
  });

  it('subsequent events have incrementing versions', () => {
    const store = new EventStore();
    const e1 = store.append('s', 'A', 1);
    const e2 = store.append('s', 'B', 2);
    const e3 = store.append('s', 'C', 3);
    assert.equal(e1.version, 1);
    assert.equal(e2.version, 2);
    assert.equal(e3.version, 3);
  });

  it('each event gets a unique id', () => {
    const store = new EventStore();
    const ids = new Set();
    for (let i = 0; i < 10; i++) {
      ids.add(store.append('s', 'Evt', i).id);
    }
    assert.equal(ids.size, 10);
  });

  it('events in different streams are versioned independently', () => {
    const store = new EventStore();
    store.append('stream-1', 'A', null);
    store.append('stream-1', 'B', null);
    const first = store.append('stream-2', 'C', null);
    assert.equal(first.version, 1);
  });
});

// ─── getStream ────────────────────────────────────────────────────────────────

describe('EventStore – getStream', () => {
  it('returns events in append order', () => {
    const store = new EventStore();
    store.append('s', 'First', 'a');
    store.append('s', 'Second', 'b');
    store.append('s', 'Third', 'c');

    const events = store.getStream('s');
    assert.equal(events.length, 3);
    assert.equal(events[0].type, 'First');
    assert.equal(events[1].type, 'Second');
    assert.equal(events[2].type, 'Third');
  });

  it('returns empty array for an unknown stream', () => {
    const store = new EventStore();
    assert.deepEqual(store.getStream('nonexistent'), []);
  });

  it('returned array is a copy (mutations do not affect the store)', () => {
    const store = new EventStore();
    store.append('s', 'A', null);
    const copy = store.getStream('s');
    copy.pop();
    assert.equal(store.getStream('s').length, 1);
  });
});

// ─── streamVersion ────────────────────────────────────────────────────────────

describe('EventStore – streamVersion', () => {
  it('returns 0 for an empty / unknown stream', () => {
    const store = new EventStore();
    assert.equal(store.streamVersion('ghost'), 0);
  });

  it('increments by 1 with each append', () => {
    const store = new EventStore();
    assert.equal(store.streamVersion('s'), 0);
    store.append('s', 'A', null);
    assert.equal(store.streamVersion('s'), 1);
    store.append('s', 'B', null);
    assert.equal(store.streamVersion('s'), 2);
  });
});

// ─── streamExists ─────────────────────────────────────────────────────────────

describe('EventStore – streamExists', () => {
  it('returns false before any event is appended', () => {
    const store = new EventStore();
    assert.equal(store.streamExists('new-stream'), false);
  });

  it('returns true after the first event is appended', () => {
    const store = new EventStore();
    store.append('new-stream', 'Created', null);
    assert.equal(store.streamExists('new-stream'), true);
  });
});

// ─── Optimistic concurrency ───────────────────────────────────────────────────

describe('EventStore – optimistic concurrency', () => {
  it('append with correct expectedVersion succeeds', () => {
    const store = new EventStore();
    store.append('s', 'A', null); // version is now 1
    // Expect version 1 (one event already written) before writing the second
    assert.doesNotThrow(() => store.append('s', 'B', null, 1));
    assert.equal(store.streamVersion('s'), 2);
  });

  it('append with expectedVersion 0 on empty stream succeeds', () => {
    const store = new EventStore();
    assert.doesNotThrow(() => store.append('s', 'Init', null, 0));
  });

  it('append with wrong expectedVersion throws an Error', () => {
    const store = new EventStore();
    store.append('s', 'A', null); // version 1
    assert.throws(
      () => store.append('s', 'B', null, 0), // expects 0, actual 1
      { message: /Concurrency conflict/ }
    );
  });

  it('store is unchanged after a concurrency conflict', () => {
    const store = new EventStore();
    store.append('s', 'A', null);
    try {
      store.append('s', 'B', null, 99);
    } catch {
      // expected
    }
    assert.equal(store.streamVersion('s'), 1);
  });

  it('omitting expectedVersion always succeeds regardless of version', () => {
    const store = new EventStore();
    for (let i = 0; i < 5; i++) store.append('s', 'Evt', i);
    assert.doesNotThrow(() => store.append('s', 'Late', null));
    assert.equal(store.streamVersion('s'), 6);
  });
});

// ─── getStreamFrom ────────────────────────────────────────────────────────────

describe('EventStore – getStreamFrom', () => {
  it('returns events from the given version onwards (inclusive)', () => {
    const store = new EventStore();
    store.append('s', 'A', 1); // v1
    store.append('s', 'B', 2); // v2
    store.append('s', 'C', 3); // v3
    store.append('s', 'D', 4); // v4

    const slice = store.getStreamFrom('s', 3);
    assert.equal(slice.length, 2);
    assert.equal(slice[0].version, 3);
    assert.equal(slice[1].version, 4);
  });

  it('returns all events when fromVersion is 1', () => {
    const store = new EventStore();
    store.append('s', 'A', null);
    store.append('s', 'B', null);
    assert.equal(store.getStreamFrom('s', 1).length, 2);
  });

  it('returns empty array when fromVersion exceeds stream length', () => {
    const store = new EventStore();
    store.append('s', 'A', null);
    assert.deepEqual(store.getStreamFrom('s', 99), []);
  });

  it('returns empty array for unknown stream', () => {
    const store = new EventStore();
    assert.deepEqual(store.getStreamFrom('ghost', 1), []);
  });
});

// ─── getAll ───────────────────────────────────────────────────────────────────

describe('EventStore – getAll', () => {
  it('returns events from multiple streams', () => {
    const store = new EventStore();
    store.append('orders', 'OrderPlaced', null);
    store.append('inventory', 'ItemReserved', null);
    store.append('orders', 'OrderShipped', null);

    const all = store.getAll();
    assert.equal(all.length, 3);

    const types = all.map((e) => e.type);
    assert.ok(types.includes('OrderPlaced'));
    assert.ok(types.includes('ItemReserved'));
    assert.ok(types.includes('OrderShipped'));
  });

  it('returns empty array when store is empty', () => {
    const store = new EventStore();
    assert.deepEqual(store.getAll(), []);
  });

  it('preserves global insertion order', () => {
    const store = new EventStore();
    const appended = [];
    appended.push(store.append('s1', 'E1', null));
    appended.push(store.append('s2', 'E2', null));
    appended.push(store.append('s1', 'E3', null));

    const all = store.getAll();
    assert.equal(all[0].type, appended[0].type);
    assert.equal(all[1].type, appended[1].type);
    assert.equal(all[2].type, appended[2].type);
  });
});

// ─── replayStream ─────────────────────────────────────────────────────────────

describe('replayStream', () => {
  it('builds correct state from a counter stream', () => {
    const store = new EventStore();
    store.append('counter', 'Incremented', { by: 1 });
    store.append('counter', 'Incremented', { by: 5 });
    store.append('counter', 'Decremented', { by: 2 });

    const result = replayStream(
      store,
      'counter',
      (state, event) => {
        const payload = /** @type {{ by: number }} */ (event.data);
        if (event.type === 'Incremented') return state + payload.by;
        if (event.type === 'Decremented') return state - payload.by;
        return state;
      },
      0
    );

    assert.equal(result, 4); // 0 + 1 + 5 - 2
  });

  it('returns initial state for an empty / unknown stream', () => {
    const store = new EventStore();
    const result = replayStream(store, 'empty', (s) => s, 42);
    assert.equal(result, 42);
  });

  it('works with object state', () => {
    const store = new EventStore();
    store.append('user', 'NameSet', { name: 'Alice' });
    store.append('user', 'EmailSet', { email: 'alice@example.com' });

    const result = replayStream(
      store,
      'user',
      (state, event) => ({ ...state, .../** @type {object} */ (event.data) }),
      /** @type {Record<string, string>} */ ({})
    );

    assert.deepEqual(result, { name: 'Alice', email: 'alice@example.com' });
  });
});

// ─── createEventStore factory ─────────────────────────────────────────────────

describe('createEventStore', () => {
  it('returns an EventStore instance', () => {
    const store = createEventStore();
    assert.ok(store instanceof EventStore);
  });

  it('each call returns an independent store', () => {
    const s1 = createEventStore();
    const s2 = createEventStore();
    s1.append('shared', 'Evt', null);
    assert.equal(s2.streamVersion('shared'), 0);
  });

  it('the returned store is fully functional', () => {
    const store = createEventStore();
    store.append('test', 'Hello', { msg: 'world' });
    assert.equal(store.streamVersion('test'), 1);
    assert.equal(store.streamExists('test'), true);
  });
});
