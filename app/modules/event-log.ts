// @ts-check
// ─── Event Log ──────────────────────────────────────────────────────────────
// Append-only event log with sequence numbers, timestamp-based queries,
// and typed subscriptions.

// ─── Types ──────────────────────────────────────────────────────────────────

/** A single immutable entry in the event log. */
export interface LogEntry {
  id: string;
  type: string;
  payload: unknown;
  timestamp: number;
  sequence: number;
}

// ─── ID generation ──────────────────────────────────────────────────────────

let _counter = 0;

function generateId(): string {
  _counter += 1;
  return `log-${Date.now()}-${_counter}`;
}

// ─── EventLog ───────────────────────────────────────────────────────────────

/**
 * An append-only event log with sequence numbers and subscriptions.
 *
 * @example
 *   const log = createEventLog();
 *   log.subscribe('UserCreated', (entry) => console.log(entry));
 *   log.append('UserCreated', { name: 'Alice' });
 */
export class EventLog {
  private _entries: LogEntry[];
  private _sequence: number;
  private _clock: () => number;
  private _typedHandlers: Map<string, Set<(entry: LogEntry) => void>>;
  private _globalHandlers: Set<(entry: LogEntry) => void>;

  constructor(clock: () => number = Date.now) {
    this._entries = [];
    this._sequence = 0;
    this._clock = clock;
    this._typedHandlers = new Map();
    this._globalHandlers = new Set();
  }

  /**
   * Append a new entry to the log.
   * Auto-generates id, timestamp (via clock), and sequence number.
   */
  append(type: string, payload: unknown): LogEntry {
    this._sequence += 1;
    const entry: LogEntry = {
      id: generateId(),
      type,
      payload,
      timestamp: this._clock(),
      sequence: this._sequence,
    };
    this._entries.push(entry);

    // Notify typed subscribers
    const handlers = this._typedHandlers.get(type);
    if (handlers) {
      for (const handler of handlers) {
        handler(entry);
      }
    }

    // Notify global subscribers
    for (const handler of this._globalHandlers) {
      handler(entry);
    }

    return entry;
  }

  /** Look up a single entry by its id. Returns undefined if not found. */
  getById(id: string): LogEntry | undefined {
    return this._entries.find((e) => e.id === id);
  }

  /** Return all entries of a given type. */
  getByType(type: string): LogEntry[] {
    return this._entries.filter((e) => e.type === type);
  }

  /**
   * Return entries whose sequence number is within [from, to] (inclusive).
   */
  getRange(from: number, to: number): LogEntry[] {
    return this._entries.filter((e) => e.sequence >= from && e.sequence <= to);
  }

  /** Return all entries whose timestamp is greater than or equal to the given value. */
  since(timestamp: number): LogEntry[] {
    return this._entries.filter((e) => e.timestamp >= timestamp);
  }

  /**
   * Subscribe to entries of a specific type.
   * Returns an unsubscribe function.
   */
  subscribe(type: string, handler: (entry: LogEntry) => void): () => void {
    let handlers = this._typedHandlers.get(type);
    if (!handlers) {
      handlers = new Set();
      this._typedHandlers.set(type, handlers);
    }
    handlers.add(handler);
    return () => {
      handlers!.delete(handler);
    };
  }

  /**
   * Subscribe to all entries regardless of type.
   * Returns an unsubscribe function.
   */
  subscribeAll(handler: (entry: LogEntry) => void): () => void {
    this._globalHandlers.add(handler);
    return () => {
      this._globalHandlers.delete(handler);
    };
  }

  /** The total number of entries in the log. */
  get size(): number {
    return this._entries.length;
  }

  /** Remove all entries and reset the sequence counter. Subscriptions are kept. */
  clear(): void {
    this._entries = [];
    this._sequence = 0;
  }
}

// ─── Factory ────────────────────────────────────────────────────────────────

/** Create a new EventLog instance. */
export function createEventLog(clock?: () => number): EventLog {
  return new EventLog(clock);
}
