// @ts-check
// ─── Undo History ─────────────────────────────────────────────────────────────
// Generic undo/redo history management with configurable max size.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HistoryEntry<T> {
  state: T;
  label?: string;
  timestamp: number;
}

// ─── UndoHistory ──────────────────────────────────────────────────────────────

/**
 * Generic undo/redo history stack.
 *
 * Maintains a list of history entries and a current index pointer.
 * Pushing a new state clears the redo stack (entries after the pointer).
 * maxHistory limits total entries; oldest entries are dropped when exceeded.
 *
 * @example
 *   const h = new UndoHistory('hello');
 *   h.push('world');
 *   h.undo(); // => 'hello'
 *   h.redo(); // => 'world'
 */
export class UndoHistory<T> {
  #entries: HistoryEntry<T>[];
  #index: number;
  #maxHistory: number;

  /**
   * @param initialState - The starting state (index 0).
   * @param options.maxHistory - Maximum number of history entries (default 100).
   */
  constructor(initialState: T, options?: { maxHistory?: number }) {
    this.#maxHistory = options?.maxHistory ?? 100;
    this.#entries = [{ state: initialState, timestamp: Date.now() }];
    this.#index = 0;
  }

  // ─── Getters ────────────────────────────────────────────────────────────────

  /** Current state. */
  get current(): T {
    return this.#entries[this.#index].state;
  }

  /** Number of undo steps available. */
  get undoCount(): number {
    return this.#index;
  }

  /** Number of redo steps available. */
  get redoCount(): number {
    return this.#entries.length - 1 - this.#index;
  }

  /** Whether undo is possible. */
  get canUndo(): boolean {
    return this.#index > 0;
  }

  /** Whether redo is possible. */
  get canRedo(): boolean {
    return this.#index < this.#entries.length - 1;
  }

  // ─── Mutation ────────────────────────────────────────────────────────────────

  /**
   * Push a new state. Clears any redo history beyond the current index.
   * If maxHistory is exceeded, the oldest entries are removed.
   *
   * @param state - The new state to record.
   * @param label - Optional human-readable label.
   */
  push(state: T, label?: string): void {
    // Drop everything after current index (redo stack)
    this.#entries.splice(this.#index + 1);

    const entry: HistoryEntry<T> = { state, timestamp: Date.now() };
    if (label !== undefined) entry.label = label;
    this.#entries.push(entry);
    this.#index = this.#entries.length - 1;

    // Trim oldest entries if over budget
    if (this.#entries.length > this.#maxHistory) {
      const excess = this.#entries.length - this.#maxHistory;
      this.#entries.splice(0, excess);
      this.#index -= excess;
    }
  }

  /**
   * Undo to the previous state.
   * @returns The previous state, or null if already at the initial state.
   */
  undo(): T | null {
    if (!this.canUndo) return null;
    this.#index -= 1;
    return this.#entries[this.#index].state;
  }

  /**
   * Redo to the next state.
   * @returns The next state, or null if nothing to redo.
   */
  redo(): T | null {
    if (!this.canRedo) return null;
    this.#index += 1;
    return this.#entries[this.#index].state;
  }

  /**
   * Jump to a specific history index (0 = initial state).
   * @param index - Target index in the history array.
   * @returns The state at that index, or null if the index is out of range.
   */
  goto(index: number): T | null {
    if (index < 0 || index >= this.#entries.length) return null;
    this.#index = index;
    return this.#entries[this.#index].state;
  }

  /**
   * Clear all history, keeping only the current state as the new initial state.
   */
  clear(): void {
    const current = this.#entries[this.#index];
    this.#entries = [{ state: current.state, timestamp: Date.now() }];
    this.#index = 0;
  }

  // ─── Inspection ──────────────────────────────────────────────────────────────

  /**
   * Get a shallow copy of all history entries.
   * Index 0 is the initial state; the last entry is the most recent push.
   */
  getHistory(): HistoryEntry<T>[] {
    return this.#entries.slice();
  }
}
