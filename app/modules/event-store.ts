// @ts-check
// ─── Event Store ─────────────────────────────────────────────────────────────
// Append-only event store with per-stream versioning and optimistic concurrency.

/**
 * @typedef {object} StoredEvent
 * @property {string} id        - Auto-generated unique event id
 * @property {string} streamId  - Logical stream the event belongs to
 * @property {string} type      - Domain event type name
 * @property {unknown} data     - Arbitrary event payload
 * @property {number} version   - 1-based position within the stream
 * @property {number} timestamp - Unix millisecond timestamp (Date.now())
 */

/** Monotonic counter used to generate unique event ids. */
let _counter = 0;

/** @returns {string} */
function _newId() {
  return `evt-${Date.now()}-${++_counter}`;
}

// ─── EventStore class ─────────────────────────────────────────────────────────

export class EventStore {
  /** @type {Map<string, StoredEvent[]>} */
  _streams;

  constructor() {
    this._streams = new Map();
  }

  /**
   * Append an event to a stream.
   *
   * @param {string}  streamId        - Target stream
   * @param {string}  type            - Event type name
   * @param {unknown} data            - Event payload
   * @param {number}  [expectedVersion] - If provided, throws when stream version differs
   * @returns {StoredEvent}
   */
  append(streamId, type, data, expectedVersion) {
    const events = this._streams.get(streamId) ?? [];

    if (expectedVersion !== undefined && events.length !== expectedVersion) {
      throw new Error(
        `Concurrency conflict on stream "${streamId}": ` +
        `expected version ${expectedVersion}, actual version ${events.length}`
      );
    }

    /** @type {StoredEvent} */
    const event = {
      id: _newId(),
      streamId,
      type,
      data,
      version: events.length + 1,
      timestamp: Date.now(),
    };

    events.push(event);
    this._streams.set(streamId, events);
    return event;
  }

  /**
   * Return all events for a stream in append order.
   * @param {string} streamId
   * @returns {StoredEvent[]}
   */
  getStream(streamId) {
    return [...(this._streams.get(streamId) ?? [])];
  }

  /**
   * Return events for a stream starting at (and including) the given version.
   * @param {string} streamId
   * @param {number} fromVersion - 1-based version to start from
   * @returns {StoredEvent[]}
   */
  getStreamFrom(streamId, fromVersion) {
    return this.getStream(streamId).filter((e) => e.version >= fromVersion);
  }

  /**
   * Return every event across all streams, in global append order.
   * @returns {StoredEvent[]}
   */
  getAll() {
    /** @type {StoredEvent[]} */
    const all = [];
    for (const events of this._streams.values()) {
      all.push(...events);
    }
    // Stable order by version within each stream; across streams sort by id
    // (id encodes time + counter so insertion order is preserved).
    all.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return all;
  }

  /**
   * Current version (= number of events) of a stream. Returns 0 if the stream
   * has no events or does not exist.
   * @param {string} streamId
   * @returns {number}
   */
  streamVersion(streamId) {
    return this._streams.get(streamId)?.length ?? 0;
  }

  /**
   * @param {string} streamId
   * @returns {boolean}
   */
  streamExists(streamId) {
    return this._streams.has(streamId) && /** @type {StoredEvent[]} */ (this._streams.get(streamId)).length > 0;
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/** @returns {EventStore} */
export function createEventStore() {
  return new EventStore();
}

// ─── replayStream ─────────────────────────────────────────────────────────────

/**
 * Fold all events in a stream through a reducer to reconstruct state.
 *
 * @template T
 * @param {EventStore} store
 * @param {string} streamId
 * @param {(state: T, event: StoredEvent) => T} reducer
 * @param {T} initial
 * @returns {T}
 */
export function replayStream(store, streamId, reducer, initial) {
  return store.getStream(streamId).reduce(reducer, initial);
}
