// @ts-check
// ─── State Snapshot ───────────────────────────────────────────────────────────
// Snapshot management: capture, restore, list, and delete named state snapshots.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Snapshot<T> {
  id: string;
  state: T;
  timestamp: number;
  label?: string;
}

export interface SnapshotManagerOptions {
  maxSnapshots?: number;
  clock?: () => number;
}

// ─── ID generation ────────────────────────────────────────────────────────────

let _counter = 0;

function generateId(): string {
  _counter += 1;
  return `snap-${Date.now()}-${_counter}`;
}

// ─── SnapshotManager ──────────────────────────────────────────────────────────

export class SnapshotManager<T> {
  #snapshots: Snapshot<T>[] = [];
  #maxSnapshots: number;
  #clock: () => number;

  constructor(options?: SnapshotManagerOptions) {
    this.#maxSnapshots = options?.maxSnapshots ?? 100;
    this.#clock = options?.clock ?? (() => Date.now());
  }

  /**
   * Capture the current state as a snapshot.
   * Returns the generated snapshot id.
   */
  capture(state: T, label?: string): string {
    const id = generateId();
    const snapshot: Snapshot<T> = {
      id,
      state,
      timestamp: this.#clock(),
      ...(label !== undefined ? { label } : {}),
    };

    this.#snapshots.push(snapshot);

    // Drop oldest when over capacity
    if (this.#snapshots.length > this.#maxSnapshots) {
      this.#snapshots.splice(0, this.#snapshots.length - this.#maxSnapshots);
    }

    return id;
  }

  /**
   * Restore a snapshot by id.
   * Returns the saved state, or null if not found.
   */
  restore(id: string): T | null {
    const snapshot = this.#snapshots.find((s) => s.id === id);
    return snapshot !== undefined ? snapshot.state : null;
  }

  /**
   * Delete a snapshot by id.
   * Returns true if it existed and was removed, false otherwise.
   */
  delete(id: string): boolean {
    const index = this.#snapshots.findIndex((s) => s.id === id);
    if (index === -1) return false;
    this.#snapshots.splice(index, 1);
    return true;
  }

  /** Remove all snapshots. */
  clear(): void {
    this.#snapshots = [];
  }

  /** All snapshots, newest first. */
  list(): Snapshot<T>[] {
    return this.#snapshots.slice().reverse();
  }

  /** The most recently captured snapshot, or null if none. */
  latest(): Snapshot<T> | null {
    if (this.#snapshots.length === 0) return null;
    return this.#snapshots[this.#snapshots.length - 1];
  }

  /** Total number of stored snapshots. */
  get size(): number {
    return this.#snapshots.length;
  }

  /** Whether a snapshot with the given id exists. */
  has(id: string): boolean {
    return this.#snapshots.some((s) => s.id === id);
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Create a new SnapshotManager.
 * @template T
 */
export function createSnapshotManager<T>(
  options?: SnapshotManagerOptions,
): SnapshotManager<T> {
  return new SnapshotManager<T>(options);
}
