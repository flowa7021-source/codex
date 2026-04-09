// @ts-check
// ─── Event Sourcing ─────────────────────────────────────────────────────────
// Append-only event store with aggregate root pattern for rebuilding state
// from an ordered sequence of domain events.

// ─── Types ──────────────────────────────────────────────────────────────────

/** A domain event representing something that happened in the system. */
export interface DomainEvent {
  type: string;
  payload: unknown;
  timestamp: number;
  aggregateId: string;
}

// ─── EventStore ─────────────────────────────────────────────────────────────

/**
 * An append-only store for domain events.
 *
 * @example
 *   const store = createEventStore();
 *   store.append({ type: 'Created', payload: { name: 'Alice' }, timestamp: Date.now(), aggregateId: '1' });
 *   store.getEvents('1'); // [{ type: 'Created', ... }]
 */
export class EventStore {
  private _events: DomainEvent[];

  constructor() {
    this._events = [];
  }

  /** Append an event to the store. */
  append(event: DomainEvent): void {
    this._events.push(event);
  }

  /** Get all events for a specific aggregate. */
  getEvents(aggregateId: string): DomainEvent[] {
    return this._events.filter((e) => e.aggregateId === aggregateId);
  }

  /** Get all events in the store. */
  getAllEvents(): DomainEvent[] {
    return [...this._events];
  }

  /** Get all events of a specific type. */
  getEventsByType(type: string): DomainEvent[] {
    return this._events.filter((e) => e.type === type);
  }

  /** Get all events after a given timestamp. */
  getEventsAfter(timestamp: number): DomainEvent[] {
    return this._events.filter((e) => e.timestamp > timestamp);
  }

  /** The total number of events in the store. */
  get size(): number {
    return this._events.length;
  }

  /** Remove all events from the store. */
  clear(): void {
    this._events = [];
  }
}

// ─── Aggregate ──────────────────────────────────────────────────────────────

/**
 * An aggregate root that derives its state by folding domain events through a
 * reducer. Tracks uncommitted events so they can be persisted to an EventStore.
 *
 * @example
 *   const counter = createAggregate('c1', 0, (state, event) => {
 *     if (event.type === 'Incremented') return state + 1;
 *     return state;
 *   });
 *   counter.apply({ type: 'Incremented', payload: null });
 *   counter.state; // 1
 */
export class Aggregate<S> {
  private _id: string;
  private _state: S;
  private _reducer: (state: S, event: DomainEvent) => S;
  private _version: number;
  private _uncommittedEvents: DomainEvent[];

  constructor(
    id: string,
    initialState: S,
    reducer: (state: S, event: DomainEvent) => S,
  ) {
    this._id = id;
    this._state = initialState;
    this._reducer = reducer;
    this._version = 0;
    this._uncommittedEvents = [];
  }

  /**
   * Apply a partial event (without aggregateId and timestamp).
   * The aggregate auto-fills aggregateId and timestamp, then reduces the state.
   */
  apply(event: Omit<DomainEvent, 'aggregateId' | 'timestamp'>): void {
    const fullEvent: DomainEvent = {
      ...event,
      aggregateId: this._id,
      timestamp: Date.now(),
    };
    this._state = this._reducer(this._state, fullEvent);
    this._version++;
    this._uncommittedEvents.push(fullEvent);
  }

  /** The current derived state. */
  get state(): S {
    return this._state;
  }

  /** The aggregate identifier. */
  get id(): string {
    return this._id;
  }

  /** The number of events that have been applied. */
  get version(): number {
    return this._version;
  }

  /** Events that have been applied but not yet committed to a store. */
  get uncommittedEvents(): DomainEvent[] {
    return [...this._uncommittedEvents];
  }

  /** Mark all uncommitted events as committed (clears the list). */
  markCommitted(): void {
    this._uncommittedEvents = [];
  }

  /** Rebuild state from a sequence of historical events. */
  rehydrate(events: DomainEvent[]): void {
    for (const event of events) {
      this._state = this._reducer(this._state, event);
      this._version++;
    }
  }
}

// ─── Factory Functions ──────────────────────────────────────────────────────

/** Create a new EventStore instance. */
export function createEventStore(): EventStore {
  return new EventStore();
}

/** Create a new Aggregate instance. */
export function createAggregate<S>(
  id: string,
  initial: S,
  reducer: (state: S, event: DomainEvent) => S,
): Aggregate<S> {
  return new Aggregate<S>(id, initial, reducer);
}
