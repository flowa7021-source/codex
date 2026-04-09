// ─── Unit Tests: Event Sourcing ─────────────────────────────────────────────
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  EventStore,
  Aggregate,
  createEventStore,
  createAggregate,
} from '../../app/modules/event-sourcing.js';

// ─── EventStore ─────────────────────────────────────────────────────────────

describe('EventStore', () => {
  let store;

  beforeEach(() => {
    store = new EventStore();
  });

  it('starts empty with size 0', () => {
    assert.equal(store.size, 0);
    assert.deepEqual(store.getAllEvents(), []);
  });

  it('append() adds an event and increments size', () => {
    const event = { type: 'Created', payload: { name: 'Alice' }, timestamp: 1000, aggregateId: 'a1' };
    store.append(event);
    assert.equal(store.size, 1);
  });

  it('getAllEvents() returns a copy of all events', () => {
    const e1 = { type: 'A', payload: null, timestamp: 1, aggregateId: 'x' };
    const e2 = { type: 'B', payload: null, timestamp: 2, aggregateId: 'y' };
    store.append(e1);
    store.append(e2);
    const all = store.getAllEvents();
    assert.equal(all.length, 2);
    // Returned array is a copy — mutating it should not affect the store
    all.pop();
    assert.equal(store.size, 2);
  });

  it('getEvents() filters by aggregateId', () => {
    store.append({ type: 'A', payload: 1, timestamp: 1, aggregateId: 'agg-1' });
    store.append({ type: 'B', payload: 2, timestamp: 2, aggregateId: 'agg-2' });
    store.append({ type: 'C', payload: 3, timestamp: 3, aggregateId: 'agg-1' });
    const result = store.getEvents('agg-1');
    assert.equal(result.length, 2);
    assert.equal(result[0].type, 'A');
    assert.equal(result[1].type, 'C');
  });

  it('getEvents() returns empty array for unknown aggregateId', () => {
    assert.deepEqual(store.getEvents('nonexistent'), []);
  });

  it('getEventsByType() filters by event type', () => {
    store.append({ type: 'ItemAdded', payload: 'a', timestamp: 1, aggregateId: '1' });
    store.append({ type: 'ItemRemoved', payload: 'b', timestamp: 2, aggregateId: '1' });
    store.append({ type: 'ItemAdded', payload: 'c', timestamp: 3, aggregateId: '2' });
    const added = store.getEventsByType('ItemAdded');
    assert.equal(added.length, 2);
    assert.equal(added[0].payload, 'a');
    assert.equal(added[1].payload, 'c');
  });

  it('getEventsAfter() returns events with timestamp strictly greater', () => {
    store.append({ type: 'A', payload: null, timestamp: 100, aggregateId: 'x' });
    store.append({ type: 'B', payload: null, timestamp: 200, aggregateId: 'x' });
    store.append({ type: 'C', payload: null, timestamp: 300, aggregateId: 'x' });
    const result = store.getEventsAfter(100);
    assert.equal(result.length, 2);
    assert.equal(result[0].type, 'B');
    assert.equal(result[1].type, 'C');
  });

  it('getEventsAfter() returns empty when no events qualify', () => {
    store.append({ type: 'A', payload: null, timestamp: 50, aggregateId: 'x' });
    assert.deepEqual(store.getEventsAfter(100), []);
  });

  it('clear() removes all events', () => {
    store.append({ type: 'A', payload: null, timestamp: 1, aggregateId: '1' });
    store.append({ type: 'B', payload: null, timestamp: 2, aggregateId: '2' });
    assert.equal(store.size, 2);
    store.clear();
    assert.equal(store.size, 0);
    assert.deepEqual(store.getAllEvents(), []);
  });

  it('clear() is safe to call on an empty store', () => {
    assert.doesNotThrow(() => store.clear());
    assert.equal(store.size, 0);
  });
});

// ─── Aggregate ──────────────────────────────────────────────────────────────

describe('Aggregate', () => {
  /** A simple counter reducer. */
  function counterReducer(state, event) {
    if (event.type === 'Incremented') return state + 1;
    if (event.type === 'Decremented') return state - 1;
    return state;
  }

  it('has initial state and version 0', () => {
    const agg = new Aggregate('agg-1', 0, counterReducer);
    assert.equal(agg.state, 0);
    assert.equal(agg.version, 0);
    assert.equal(agg.id, 'agg-1');
  });

  it('apply() updates state via reducer', () => {
    const agg = new Aggregate('c1', 0, counterReducer);
    agg.apply({ type: 'Incremented', payload: null });
    assert.equal(agg.state, 1);
  });

  it('apply() increments version', () => {
    const agg = new Aggregate('c1', 0, counterReducer);
    agg.apply({ type: 'Incremented', payload: null });
    agg.apply({ type: 'Incremented', payload: null });
    assert.equal(agg.version, 2);
  });

  it('apply() auto-fills aggregateId on the event', () => {
    const agg = new Aggregate('my-id', 0, counterReducer);
    agg.apply({ type: 'Incremented', payload: null });
    const events = agg.uncommittedEvents;
    assert.equal(events[0].aggregateId, 'my-id');
  });

  it('apply() auto-fills timestamp on the event', () => {
    const before = Date.now();
    const agg = new Aggregate('t1', 0, counterReducer);
    agg.apply({ type: 'Incremented', payload: null });
    const after = Date.now();
    const ts = agg.uncommittedEvents[0].timestamp;
    assert.ok(ts >= before && ts <= after);
  });

  it('uncommittedEvents returns a copy', () => {
    const agg = new Aggregate('c1', 0, counterReducer);
    agg.apply({ type: 'Incremented', payload: null });
    const events = agg.uncommittedEvents;
    events.pop();
    assert.equal(agg.uncommittedEvents.length, 1);
  });

  it('markCommitted() clears uncommitted events', () => {
    const agg = new Aggregate('c1', 0, counterReducer);
    agg.apply({ type: 'Incremented', payload: null });
    agg.apply({ type: 'Incremented', payload: null });
    assert.equal(agg.uncommittedEvents.length, 2);
    agg.markCommitted();
    assert.equal(agg.uncommittedEvents.length, 0);
  });

  it('markCommitted() does not change state or version', () => {
    const agg = new Aggregate('c1', 0, counterReducer);
    agg.apply({ type: 'Incremented', payload: null });
    agg.markCommitted();
    assert.equal(agg.state, 1);
    assert.equal(agg.version, 1);
  });

  it('rehydrate() rebuilds state from historical events', () => {
    const agg = new Aggregate('c1', 0, counterReducer);
    const history = [
      { type: 'Incremented', payload: null, timestamp: 1, aggregateId: 'c1' },
      { type: 'Incremented', payload: null, timestamp: 2, aggregateId: 'c1' },
      { type: 'Decremented', payload: null, timestamp: 3, aggregateId: 'c1' },
    ];
    agg.rehydrate(history);
    assert.equal(agg.state, 1);
    assert.equal(agg.version, 3);
  });

  it('rehydrate() does not produce uncommitted events', () => {
    const agg = new Aggregate('c1', 0, counterReducer);
    agg.rehydrate([
      { type: 'Incremented', payload: null, timestamp: 1, aggregateId: 'c1' },
    ]);
    assert.equal(agg.uncommittedEvents.length, 0);
  });

  it('rehydrate() with empty array leaves state unchanged', () => {
    const agg = new Aggregate('c1', 10, counterReducer);
    agg.rehydrate([]);
    assert.equal(agg.state, 10);
    assert.equal(agg.version, 0);
  });
});

// ─── Factory Functions ──────────────────────────────────────────────────────

describe('createEventStore()', () => {
  it('returns an EventStore instance', () => {
    const store = createEventStore();
    assert.ok(store instanceof EventStore);
    assert.equal(store.size, 0);
  });
});

describe('createAggregate()', () => {
  it('returns an Aggregate instance with correct initial state', () => {
    const agg = createAggregate('id-1', { count: 0 }, (state, event) => {
      if (event.type === 'Inc') return { count: state.count + 1 };
      return state;
    });
    assert.ok(agg instanceof Aggregate);
    assert.deepEqual(agg.state, { count: 0 });
    assert.equal(agg.id, 'id-1');
  });
});

// ─── Integration: Aggregate + EventStore ────────────────────────────────────

describe('Aggregate + EventStore integration', () => {
  it('uncommitted events can be appended to a store, then used to rehydrate a new aggregate', () => {
    function todoReducer(state, event) {
      if (event.type === 'TodoAdded') return [...state, event.payload];
      if (event.type === 'TodoRemoved') return state.filter((t) => t !== event.payload);
      return state;
    }

    const store = createEventStore();
    const agg = createAggregate('todo-1', [], todoReducer);

    agg.apply({ type: 'TodoAdded', payload: 'Buy milk' });
    agg.apply({ type: 'TodoAdded', payload: 'Read book' });
    agg.apply({ type: 'TodoRemoved', payload: 'Buy milk' });

    // Commit events to the store
    for (const e of agg.uncommittedEvents) {
      store.append(e);
    }
    agg.markCommitted();

    // Rehydrate a fresh aggregate from the store
    const agg2 = createAggregate('todo-1', [], todoReducer);
    agg2.rehydrate(store.getEvents('todo-1'));

    assert.deepEqual(agg2.state, ['Read book']);
    assert.equal(agg2.version, 3);
    assert.equal(agg2.uncommittedEvents.length, 0);
  });
});
