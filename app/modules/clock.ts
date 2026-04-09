// @ts-check
// ─── Clock ───────────────────────────────────────────────────────────────────
// Mockable clock abstractions for deterministic testing.
// No browser APIs — pure Node.js / universal JS.

// ─── ClockInterface ──────────────────────────────────────────────────────────

export interface ClockInterface {
  now(): number;
  readonly Date: typeof Date;
}

// ─── RealClock ───────────────────────────────────────────────────────────────

/** Real clock using actual Date.now(). */
export class RealClock implements ClockInterface {
  now(): number {
    return Date.now();
  }

  get Date(): typeof Date {
    return Date;
  }
}

// ─── FakeClock ───────────────────────────────────────────────────────────────

interface Scheduled {
  at: number;
  callback: () => void;
}

/** Fake clock for testing. Advances time manually and fires scheduled callbacks. */
export class FakeClock implements ClockInterface {
  #time: number;
  #pending: Scheduled[] = [];

  constructor(startTime = 0) {
    this.#time = startTime;
  }

  now(): number {
    return this.#time;
  }

  get Date(): typeof Date {
    // Return a proxy so callers can do `new clock.Date()` and get the fake time.
    const self = this;
    return new Proxy(Date, {
      construct(_target, args) {
        if (args.length === 0) {
          return new Date(self.#time);
        }
        // @ts-ignore — spread args through to native Date constructor
        return new Date(...(args as [unknown, ...unknown[]]));
      },
      apply(_target, _thisArg, args) {
        if (args.length === 0) {
          return new Date(self.#time).toString();
        }
        // @ts-ignore
        return Date(...(args as [unknown, ...unknown[]]));
      },
      get(target, prop, receiver) {
        if (prop === 'now') {
          return () => self.#time;
        }
        return Reflect.get(target, prop, receiver);
      },
    }) as typeof Date;
  }

  /** Advance time by N ms. Runs any scheduled callbacks whose time has come. */
  tick(ms: number): void {
    const target = this.#time + ms;
    // Run callbacks in chronological order, advancing time as we go.
    while (true) {
      const next = this.#pending
        .filter((s) => s.at <= target)
        .sort((a, b) => a.at - b.at)[0];

      if (!next) break;

      // Remove it before calling (in case callback schedules more work).
      this.#pending = this.#pending.filter((s) => s !== next);
      this.#time = next.at;
      next.callback();
    }
    this.#time = target;
  }

  /** Set absolute time. Does not fire any callbacks. */
  setTime(ts: number): void {
    this.#time = ts;
  }

  /** Schedule a callback at an absolute timestamp. */
  schedule(callback: () => void, at: number): void {
    this.#pending.push({ at, callback });
  }

  /** Schedule a callback after N ms. */
  scheduleIn(callback: () => void, ms: number): void {
    this.schedule(callback, this.#time + ms);
  }

  /** Get all pending scheduled callbacks. */
  getPending(): { at: number; callback: () => void }[] {
    return this.#pending.map((s) => ({ at: s.at, callback: s.callback }));
  }

  /** Run all pending callbacks up to current time. */
  flush(): void {
    const now = this.#time;
    // Sort chronologically and run all that are <= now.
    const due = this.#pending
      .filter((s) => s.at <= now)
      .sort((a, b) => a.at - b.at);

    // Remove due entries first.
    this.#pending = this.#pending.filter((s) => s.at > now);

    for (const s of due) {
      s.callback();
    }
  }
}

// ─── Stopwatch ───────────────────────────────────────────────────────────────

/** Stopwatch: measure elapsed time with lap support. */
export class Stopwatch {
  #startTime: number | null = null;
  #stopTime: number | null = null;
  #lapMark: number | null = null;
  #laps: number[] = [];

  start(): void {
    this.#startTime = Date.now();
    this.#stopTime = null;
    this.#lapMark = this.#startTime;
  }

  stop(): number {
    if (this.#startTime === null) return 0;
    this.#stopTime = Date.now();
    return this.#stopTime - this.#startTime;
  }

  reset(): void {
    this.#startTime = null;
    this.#stopTime = null;
    this.#lapMark = null;
    this.#laps = [];
  }

  get elapsed(): number {
    if (this.#startTime === null) return 0;
    const end = this.#stopTime ?? Date.now();
    return end - this.#startTime;
  }

  get isRunning(): boolean {
    return this.#startTime !== null && this.#stopTime === null;
  }

  /** Returns ms since last lap (or start). Records the lap. */
  lap(): number {
    if (this.#startTime === null) return 0;
    const now = Date.now();
    const mark = this.#lapMark ?? this.#startTime;
    const lapTime = now - mark;
    this.#laps.push(lapTime);
    this.#lapMark = now;
    return lapTime;
  }

  getLaps(): number[] {
    return [...this.#laps];
  }
}
