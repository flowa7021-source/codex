// @ts-check
// ─── Time Utilities ───────────────────────────────────────────────────────────
// Time measurement and formatting utilities. No external libraries.

// ─── Public API ──────────────────────────────────────────────────────────────

/** Format milliseconds as a human-readable duration (e.g., "1h 23m 45s"). */
export function formatDuration(ms: number): string {
  if (ms < 0) ms = 0;
  const totalSeconds = Math.floor(ms / 1000);
  const hours   = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts: string[] = [];
  if (hours > 0)   parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
  return parts.join(' ');
}

/** Format milliseconds as MM:SS or HH:MM:SS. */
export function formatTime(ms: number): string {
  if (ms < 0) ms = 0;
  const totalSeconds = Math.floor(ms / 1000);
  const hours   = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');

  if (hours > 0) {
    return `${hours}:${mm}:${ss}`;
  }
  return `${minutes}:${ss}`;
}

/** Parse a duration string ("1h 23m", "45s", "1:23:45") to milliseconds. Returns NaN on failure. */
export function parseDuration(str: string): number {
  if (!str || typeof str !== 'string') return NaN;
  const trimmed = str.trim();
  if (!trimmed) return NaN;

  // Try HH:MM:SS or MM:SS colon format first
  const colonMatch = trimmed.match(/^(\d+):(\d{2}):(\d{2})$/) ??
                     trimmed.match(/^(\d+):(\d{2})$/);
  if (colonMatch) {
    if (colonMatch.length === 4) {
      // HH:MM:SS
      const h = parseInt(colonMatch[1], 10);
      const m = parseInt(colonMatch[2], 10);
      const s = parseInt(colonMatch[3], 10);
      return (h * 3600 + m * 60 + s) * 1000;
    } else {
      // MM:SS
      const m = parseInt(colonMatch[1], 10);
      const s = parseInt(colonMatch[2], 10);
      return (m * 60 + s) * 1000;
    }
  }

  // Try natural language format: 1h 23m 45s (any subset, in order)
  const naturalRe = /^(?:(\d+)\s*h\s*)?(?:(\d+)\s*m\s*)?(?:(\d+)\s*s)?$/i;
  const naturalMatch = trimmed.match(naturalRe);
  if (naturalMatch && trimmed.length > 0 && (naturalMatch[1] ?? naturalMatch[2] ?? naturalMatch[3])) {
    const h = parseInt(naturalMatch[1] ?? '0', 10);
    const m = parseInt(naturalMatch[2] ?? '0', 10);
    const s = parseInt(naturalMatch[3] ?? '0', 10);
    return (h * 3600 + m * 60 + s) * 1000;
  }

  return NaN;
}

/** Create a stopwatch that returns elapsed milliseconds. */
export function createStopwatch(): {
  start(): void;
  stop(): void;
  reset(): void;
  elapsed(): number;
  isRunning: boolean;
} {
  let startTime: number | null = null;
  let accumulated = 0;
  let running = false;

  return {
    start() {
      if (running) return;
      running = true;
      startTime = Date.now();
    },
    stop() {
      if (!running || startTime === null) return;
      accumulated += Date.now() - startTime;
      startTime = null;
      running = false;
    },
    reset() {
      running = false;
      startTime = null;
      accumulated = 0;
    },
    elapsed() {
      if (running && startTime !== null) {
        return accumulated + (Date.now() - startTime);
      }
      return accumulated;
    },
    get isRunning() {
      return running;
    },
  };
}

/** Sleep for N milliseconds (uses setTimeout). */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Debounce a function (returns a wrapper that delays invocation). */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delayMs: number,
): T & { cancel(): void } {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const debounced = function (this: unknown, ...args: unknown[]) {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn.apply(this, args);
    }, delayMs);
  } as T & { cancel(): void };

  debounced.cancel = function () {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  return debounced;
}

/** Throttle a function to at most once per delayMs. */
export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delayMs: number,
): T & { cancel(): void } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: unknown[] | null = null;
  let lastThis: unknown = undefined;

  const throttled = function (this: unknown, ...args: unknown[]) {
    lastArgs = args;
    lastThis = this;
    if (timer === null) {
      fn.apply(this, args);
      timer = setTimeout(() => {
        timer = null;
        if (lastArgs !== null) {
          // nothing pending — trailing call not needed here; leading edge only
          lastArgs = null;
        }
      }, delayMs);
    }
  } as T & { cancel(): void };

  throttled.cancel = function () {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    lastArgs = null;
  };

  return throttled;
}

/** Measure execution time of a function. Returns { result, ms }. */
export function measure<T>(fn: () => T): { result: T; ms: number } {
  const start = Date.now();
  const result = fn();
  const ms = Date.now() - start;
  return { result, ms };
}

/** Measure execution time of an async function. Returns { result, ms }. */
export async function measureAsync<T>(fn: () => Promise<T>): Promise<{ result: T; ms: number }> {
  const start = Date.now();
  const result = await fn();
  const ms = Date.now() - start;
  return { result, ms };
}
