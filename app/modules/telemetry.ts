// @ts-check
// ─── Telemetry ────────────────────────────────────────────────────────────────
// Performance telemetry and timing: timers, counters, and gauges.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TimingEntry {
  name: string;
  startTime: number;
  endTime: number;
  duration: number;
  metadata?: Record<string, unknown>;
}

export interface CounterEntry {
  name: string;
  value: number;
  tags?: Record<string, string>;
}

// ─── Telemetry ────────────────────────────────────────────────────────────────

export class Telemetry {
  #timings: TimingEntry[] = [];
  #counters: Map<string, CounterEntry> = new Map();

  // ─── Timers ───────────────────────────────────────────────────────────────

  /** Start a timer. Returns a stop function that records the timing. */
  startTimer(name: string, metadata?: Record<string, unknown>): () => TimingEntry {
    const startTime = Date.now();
    return (): TimingEntry => {
      const endTime = Date.now();
      const entry: TimingEntry = {
        name,
        startTime,
        endTime,
        duration: endTime - startTime,
        ...(metadata !== undefined ? { metadata } : {}),
      };
      this.#timings.push(entry);
      return entry;
    };
  }

  /** Time an async operation. */
  async time<T>(
    name: string,
    fn: () => Promise<T>,
    metadata?: Record<string, unknown>,
  ): Promise<T> {
    const stop = this.startTimer(name, metadata);
    const result = await fn();
    stop();
    return result;
  }

  /** Time a sync operation. */
  timeSync<T>(name: string, fn: () => T, metadata?: Record<string, unknown>): T {
    const stop = this.startTimer(name, metadata);
    const result = fn();
    stop();
    return result;
  }

  // ─── Counters ─────────────────────────────────────────────────────────────

  /** Increment a counter. */
  increment(name: string, by = 1, tags?: Record<string, string>): void {
    const existing = this.#counters.get(name);
    const current = existing?.value ?? 0;
    const entry: CounterEntry = {
      name,
      value: current + by,
      ...(tags !== undefined ? { tags } : {}),
    };
    this.#counters.set(name, entry);
  }

  /** Decrement a counter. */
  decrement(name: string, by = 1, tags?: Record<string, string>): void {
    this.increment(name, -by, tags);
  }

  /** Set a gauge value. */
  gauge(name: string, value: number, tags?: Record<string, string>): void {
    const entry: CounterEntry = {
      name,
      value,
      ...(tags !== undefined ? { tags } : {}),
    };
    this.#counters.set(name, entry);
  }

  // ─── Getters ──────────────────────────────────────────────────────────────

  /** Get all timing entries. */
  getTimings(): TimingEntry[] {
    return [...this.#timings];
  }

  /** Get all counter entries (latest value per name). */
  getCounters(): CounterEntry[] {
    return [...this.#counters.values()];
  }

  /** Get a specific counter value (0 if never set). */
  getCounter(name: string): number {
    return this.#counters.get(name)?.value ?? 0;
  }

  /** Clear all data. */
  clear(): void {
    this.#timings = [];
    this.#counters = new Map();
  }
}
