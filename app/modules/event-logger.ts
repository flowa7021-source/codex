// @ts-check
// ─── Event Logger ─────────────────────────────────────────────────────────────
// In-memory event logger with filtering and export/import support.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LogEntry {
  id: string;
  timestamp: number;
  level: 'debug' | 'info' | 'warn' | 'error';
  category: string;
  message: string;
  data?: unknown;
}

export interface EventLoggerOptions {
  maxEntries?: number;
  minLevel?: LogEntry['level'];
}

// ─── Level ordering ───────────────────────────────────────────────────────────

const LEVEL_ORDER: Record<LogEntry['level'], number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// ─── ID generation ────────────────────────────────────────────────────────────

let _counter = 0;

function generateId(): string {
  _counter += 1;
  return `log-${Date.now()}-${_counter}`;
}

// ─── EventLogger ─────────────────────────────────────────────────────────────

export class EventLogger {
  #entries: LogEntry[] = [];
  #maxEntries: number;
  #minLevel: LogEntry['level'];

  constructor(options?: EventLoggerOptions) {
    this.#maxEntries = options?.maxEntries ?? 1000;
    this.#minLevel = options?.minLevel ?? 'debug';
  }

  /** Log an entry at the given level. Returns the created LogEntry or null if filtered. */
  log(
    level: LogEntry['level'],
    category: string,
    message: string,
    data?: unknown,
  ): LogEntry {
    const entry: LogEntry = {
      id: generateId(),
      timestamp: Date.now(),
      level,
      category,
      message,
      ...(data !== undefined ? { data } : {}),
    };

    if (LEVEL_ORDER[level] >= LEVEL_ORDER[this.#minLevel]) {
      this.#entries.push(entry);
      // Drop oldest entries if over capacity
      if (this.#entries.length > this.#maxEntries) {
        this.#entries.splice(0, this.#entries.length - this.#maxEntries);
      }
    }

    return entry;
  }

  debug(category: string, message: string, data?: unknown): LogEntry {
    return this.log('debug', category, message, data);
  }

  info(category: string, message: string, data?: unknown): LogEntry {
    return this.log('info', category, message, data);
  }

  warn(category: string, message: string, data?: unknown): LogEntry {
    return this.log('warn', category, message, data);
  }

  error(category: string, message: string, data?: unknown): LogEntry {
    return this.log('error', category, message, data);
  }

  /**
   * Retrieve entries, optionally filtered.
   * Filters are applied in order: level, category, since, then limit.
   */
  getEntries(filter?: {
    level?: LogEntry['level'];
    category?: string;
    since?: number;
    limit?: number;
  }): LogEntry[] {
    let result = this.#entries.slice();

    if (filter?.level !== undefined) {
      const minOrder = LEVEL_ORDER[filter.level];
      result = result.filter((e) => LEVEL_ORDER[e.level] >= minOrder);
    }

    if (filter?.category !== undefined) {
      const cat = filter.category;
      result = result.filter((e) => e.category === cat);
    }

    if (filter?.since !== undefined) {
      const since = filter.since;
      result = result.filter((e) => e.timestamp >= since);
    }

    if (filter?.limit !== undefined) {
      result = result.slice(0, filter.limit);
    }

    return result;
  }

  /** Remove all log entries. */
  clear(): void {
    this.#entries = [];
  }

  /** Number of stored entries. */
  get size(): number {
    return this.#entries.length;
  }

  /** Export all entries as a JSON string. */
  export(): string {
    return JSON.stringify(this.#entries);
  }

  /**
   * Import entries from a JSON string (merges with existing entries).
   * Entries are sorted by timestamp after merge. Capacity is enforced.
   */
  import(json: string): void {
    const parsed: LogEntry[] = JSON.parse(json);
    this.#entries = [...this.#entries, ...parsed];
    // Sort by timestamp to maintain chronological order
    this.#entries.sort((a, b) => a.timestamp - b.timestamp);
    // Enforce capacity after merge
    if (this.#entries.length > this.#maxEntries) {
      this.#entries.splice(0, this.#entries.length - this.#maxEntries);
    }
  }
}
