// @ts-check
// ─── Event Store ─────────────────────────────────────────────────────────────
// Append-only event store with per-stream versioning and optimistic concurrency.

export interface StoredEvent {
  /** Auto-generated unique event id */
  id: string;
  /** Logical stream the event belongs to */
  streamId: string;
  /** Domain event type name */
  type: string;
  /** Arbitrary event payload */
  data: unknown;
  /** 1-based position within the stream */
  version: number;
  /** Unix millisecond timestamp (Date.now()) */
  timestamp: number;
}

/** Monotonic counter used to generate unique event ids. */
let _counter = 0;

function _newId(): string {
  return `evt-${Date.now()}-${++_counter}`;
}

// ─── EventStore class ─────────────────────────────────────────────────────────

export class EventStore {
  _streams: Map<string, StoredEvent[]>;

  constructor() {
    this._streams = new Map();
  }

  /**
   * Append an event to a stream.
   *
   * @param streamId        - Target stream
   * @param type            - Event type name
   * @param data            - Event payload
   * @param expectedVersion - If provided, throws when stream version differs
   */
  append(streamId: string, type: string, data: unknown, expectedVersion?: number): StoredEvent {
    const events = this._streams.get(streamId) ?? [];

    if (expectedVersion !== undefined && events.length !== expectedVersion) {
      throw new Error(
        `Concurrency conflict on stream "${streamId}": ` +
        `expected version ${expectedVersion}, actual version ${events.length}`
      );
    }

    const event: StoredEvent = {
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

  /** Return all events for a stream in append order. */
  getStream(streamId: string): StoredEvent[] {
    return [...(this._streams.get(streamId) ?? [])];
  }

  /**
   * Return events for a stream starting at (and including) the given version.
   * @param fromVersion - 1-based version to start from
   */
  getStreamFrom(streamId: string, fromVersion: number): StoredEvent[] {
    return this.getStream(streamId).filter((e) => e.version >= fromVersion);
  }

  /** Return every event across all streams, in global append order. */
  getAll(): StoredEvent[] {
    const all: StoredEvent[] = [];
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
   */
  streamVersion(streamId: string): number {
    return this._streams.get(streamId)?.length ?? 0;
  }

  streamExists(streamId: string): boolean {
    return this._streams.has(streamId) && (this._streams.get(streamId) as StoredEvent[]).length > 0;
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createEventStore(): EventStore {
  return new EventStore();
}

// ─── replayStream ─────────────────────────────────────────────────────────────

/**
 * Fold all events in a stream through a reducer to reconstruct state.
 */
export function replayStream<T>(
  store: EventStore,
  streamId: string,
  reducer: (state: T, event: StoredEvent) => T,
  initial: T,
): T {
  return store.getStream(streamId).reduce(reducer, initial);
}
