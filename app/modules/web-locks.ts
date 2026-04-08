// ─── Web Locks API ───────────────────────────────────────────────────────────
// Cross-tab mutex using navigator.locks.request() for coordinating exclusive
// operations (cloud sync, OCR, autosave) across browser tabs.
// Falls back to an in-memory mutex when the Locks API is unavailable.

/** The mode of a lock: exclusive (writer) or shared (reader). */
export type LockMode = 'exclusive' | 'shared';

/** Information about a held or pending lock. */
export interface LockInfo {
  name: string;
  mode: LockMode;
  clientId?: string;
}

/** Options for acquiring a lock. */
export interface LockOptions {
  /** Lock mode — defaults to 'exclusive'. */
  mode?: LockMode;
  /** Resolve with null immediately if the lock is not available (non-blocking). */
  ifAvailable?: boolean;
  /** Force-take the lock, breaking any existing holder. Use only in tests. */
  steal?: boolean;
  /** AbortSignal to cancel waiting for the lock. */
  signal?: AbortSignal;
  /** Milliseconds to wait before rejecting. Implemented in wrapper via AbortController. */
  timeout?: number;
}

// ─── Fallback in-memory lock ─────────────────────────────────────────────────

/**
 * Map of lock name → Promise chain used as a FIFO queue for the fallback
 * in-memory implementation. Only works within a single tab.
 */
const _fallbackChains = new Map<string, Promise<void>>();

/**
 * Acquire a named lock using the in-memory fallback.
 * Exclusive only — shared mode is treated as exclusive in the fallback.
 */
function _fallbackAcquire<T>(
  name: string,
  callback: () => Promise<T>,
  ifAvailable: boolean,
): Promise<T | null> {
  if (ifAvailable) {
    // If there is already a pending chain, the lock is held — return null.
    if (_fallbackChains.has(name)) {
      return Promise.resolve(null);
    }
  }

  let releaseNext!: () => void;
  const lockPromise = new Promise<void>(resolve => {
    releaseNext = resolve;
  });

  const previous = _fallbackChains.get(name) ?? Promise.resolve();
  const chain = previous.then(async () => {
    try {
      return await callback();
    } finally {
      releaseNext();
      // Clean up the chain entry only when it equals our chain
      if (_fallbackChains.get(name) === chain) {
        _fallbackChains.delete(name);
      }
    }
  });

  _fallbackChains.set(name, lockPromise);

  return chain as Promise<T>;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Whether the Web Locks API is available in this environment.
 */
export function isWebLocksSupported(): boolean {
  return typeof navigator !== 'undefined' && 'locks' in navigator;
}

/**
 * Acquire a named lock, run `callback`, then release the lock.
 *
 * Falls back to an in-memory lock when `navigator.locks` is absent.
 * Implements `timeout` via an internal AbortController that cancels waiting.
 *
 * @param name     - Lock name (shared across all tabs).
 * @param callback - Async work to perform while holding the lock.
 * @param opts     - Lock options (mode, ifAvailable, steal, signal, timeout).
 * @returns The value returned by `callback`.
 */
export function withLock<T>(
  name: string,
  callback: () => Promise<T>,
  opts: LockOptions = {},
): Promise<T> {
  const { mode = 'exclusive', ifAvailable = false, steal = false, signal, timeout } = opts;

  if (!isWebLocksSupported()) {
    return _fallbackAcquire(name, callback, ifAvailable) as Promise<T>;
  }

  // Build abort signal — merge caller's signal with an optional timeout signal.
  let combinedSignal: AbortSignal | undefined;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  if (timeout !== undefined || signal !== undefined) {
    const controllers: AbortController[] = [];

    if (timeout !== undefined) {
      const tc = new AbortController();
      timeoutId = setTimeout(() => {
        tc.abort(new Error(`Lock "${name}" timed out after ${timeout}ms`));
      }, timeout);
      controllers.push(tc);
    }

    if (signal !== undefined) {
      // If we only have the caller's signal (no timeout), use it directly.
      if (controllers.length === 0) {
        combinedSignal = signal;
      } else {
        // Combine: abort if either fires.
        const sc = new AbortController();
        signal.addEventListener('abort', () => sc.abort(signal.reason), { once: true });
        controllers.push(sc);
        // Use the timeout controller's signal (it already covers its side).
        // We need a single merged signal — use the timeout controller and chain the user signal.
        const tc = controllers[0];
        signal.addEventListener('abort', () => tc.abort(signal.reason), { once: true });
        combinedSignal = tc.signal;
      }
    } else {
      combinedSignal = controllers[0].signal;
    }
  }

  const requestOpts: Record<string, unknown> = { mode };
  if (ifAvailable) requestOpts['ifAvailable'] = true;
  if (steal) requestOpts['steal'] = true;
  if (combinedSignal) requestOpts['signal'] = combinedSignal;

  // Wrap callback to clear the timeout once the lock is acquired.
  const wrappedCallback = (lock: Lock | null): Promise<T> => {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
    if (lock === null) {
      // ifAvailable was set and lock was not available.
      return Promise.resolve(null as unknown as T);
    }
    return callback();
  };

  return navigator.locks.request(name, requestOpts as LockOptions, wrappedCallback) as Promise<T>;
}

/**
 * Acquire a shared (read) lock and run `callback`.
 * Multiple tabs can hold the same shared lock simultaneously.
 *
 * @param name     - Lock name.
 * @param callback - Async work to perform while holding the shared lock.
 */
export function withSharedLock<T>(name: string, callback: () => Promise<T>): Promise<T> {
  return withLock(name, callback, { mode: 'shared' });
}

/**
 * Try to acquire a lock non-blockingly.
 * Returns `null` if the lock is not immediately available.
 *
 * @param name     - Lock name.
 * @param callback - Async work to perform while holding the lock.
 * @returns The callback's return value, or `null` if the lock was unavailable.
 */
export function tryLock<T>(name: string, callback: () => Promise<T>): Promise<T | null> {
  return withLock(name, callback, { ifAvailable: true }) as Promise<T | null>;
}

/**
 * Query the current state of the Web Locks API.
 * Returns empty arrays when the Locks API is not supported.
 */
export async function getLockState(): Promise<{ held: LockInfo[]; pending: LockInfo[] }> {
  if (!isWebLocksSupported()) {
    return { held: [], pending: [] };
  }

  const snapshot = await navigator.locks.query();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toInfo = (l: any): LockInfo => ({
    name: (l.name as string | undefined) ?? '',
    mode: (l.mode as LockMode | undefined) ?? 'exclusive',
    ...(l.clientId !== undefined ? { clientId: String(l.clientId) } : {}),
  });

  return {
    held: (snapshot.held ?? []).map(toInfo),
    pending: (snapshot.pending ?? []).map(toInfo),
  };
}

/**
 * Check whether any tab currently holds a lock with the given name.
 *
 * @param name - The lock name to query.
 * @returns `true` if the lock is held, `false` otherwise.
 */
export async function isLockHeld(name: string): Promise<boolean> {
  const { held } = await getLockState();
  return held.some(l => l.name === name);
}
