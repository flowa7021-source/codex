// ─── Lamport Clock ───────────────────────────────────────────────────────────
// Lamport logical clocks for establishing a total order of events
// across distributed nodes.

// @ts-check

/**
 * A Lamport timestamp carried between nodes.
 */
export interface LamportTimestamp {
  nodeId: string;
  time: number;
}

/**
 * Immutable Lamport logical clock.
 *
 * @example
 *   const a = createLamportClock('A');
 *   const { clock: a2, timestamp } = a.send();
 *   const b = createLamportClock('B').receive(timestamp);
 */
export class LamportClock {
  private readonly _nodeId: string;
  private readonly _time: number;

  constructor(nodeId: string, time: number = 0) {
    this._nodeId = nodeId;
    this._time = time;
  }

  /** The owning node identifier. */
  get nodeId(): string {
    return this._nodeId;
  }

  /** Current logical time. */
  get time(): number {
    return this._time;
  }

  /**
   * Increment the clock and return a new LamportClock.
   */
  increment(): LamportClock {
    return new LamportClock(this._nodeId, this._time + 1);
  }

  /**
   * Increment the clock (a local "send" event) and return both the updated
   * clock and the timestamp to transmit.
   */
  send(): { clock: LamportClock; timestamp: number } {
    const next = this._time + 1;
    return {
      clock: new LamportClock(this._nodeId, next),
      timestamp: next,
    };
  }

  /**
   * Receive a remote timestamp: set local time to max(local, remote) + 1.
   * Returns a new LamportClock.
   */
  receive(timestamp: number): LamportClock {
    return new LamportClock(this._nodeId, Math.max(this._time, timestamp) + 1);
  }

  /**
   * Create a deep copy.
   */
  clone(): LamportClock {
    return new LamportClock(this._nodeId, this._time);
  }
}

/**
 * Compare two LamportTimestamps to establish a total order.
 * Ties in `time` are broken by lexicographic nodeId comparison.
 *
 * Returns a negative number if `a < b`, positive if `a > b`, 0 if equal.
 */
export function compareLamport(a: LamportTimestamp, b: LamportTimestamp): number {
  if (a.time !== b.time) return a.time - b.time;
  if (a.nodeId < b.nodeId) return -1;
  if (a.nodeId > b.nodeId) return 1;
  return 0;
}

/**
 * Factory: create a fresh LamportClock for a given nodeId.
 */
export function createLamportClock(nodeId: string): LamportClock {
  return new LamportClock(nodeId);
}
