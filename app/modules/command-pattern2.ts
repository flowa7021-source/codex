// @ts-check
// ─── Command Pattern with History ─────────────────────────────────────────────
// Implements the Command design pattern with undo/redo history management.

// ─── Types ────────────────────────────────────────────────────────────────────

/** A reversible operation on state S. */
export interface CommandAction<S> {
  execute(state: S): S;
  undo(state: S): S;
  name?: string;
}

// ─── CommandHistory ───────────────────────────────────────────────────────────

/** Manages a stack of executed commands with undo/redo support. */
export class CommandHistory<S> {
  #state: S;
  #undoStack: CommandAction<S>[] = [];
  #redoStack: CommandAction<S>[] = [];
  #maxHistory: number;

  constructor(initialState: S, options?: { maxHistory?: number }) {
    this.#state = initialState;
    this.#maxHistory = options?.maxHistory ?? Infinity;
  }

  /** Current state after all executed commands. */
  get state(): S {
    return this.#state;
  }

  /** Whether there is at least one command that can be undone. */
  get canUndo(): boolean {
    return this.#undoStack.length > 0;
  }

  /** Whether there is at least one command that can be redone. */
  get canRedo(): boolean {
    return this.#redoStack.length > 0;
  }

  /** Number of commands in the undo stack. */
  get historySize(): number {
    return this.#undoStack.length;
  }

  /** Number of commands in the redo stack. */
  get redoSize(): number {
    return this.#redoStack.length;
  }

  /**
   * Execute a command, push it onto the undo stack, and clear the redo stack.
   * Returns the new state.
   */
  execute(command: CommandAction<S>): S {
    this.#state = command.execute(this.#state);
    this.#undoStack.push(command);
    this.#redoStack = [];

    // Trim undo stack to maxHistory
    if (this.#undoStack.length > this.#maxHistory) {
      this.#undoStack.shift();
    }

    return this.#state;
  }

  /**
   * Undo the most recent command.
   * Returns the new state, or undefined if there is nothing to undo.
   */
  undo(): S | undefined {
    const command = this.#undoStack.pop();
    if (command === undefined) return undefined;

    this.#state = command.undo(this.#state);
    this.#redoStack.push(command);
    return this.#state;
  }

  /**
   * Redo the most recently undone command.
   * Returns the new state, or undefined if there is nothing to redo.
   */
  redo(): S | undefined {
    const command = this.#redoStack.pop();
    if (command === undefined) return undefined;

    this.#state = command.execute(this.#state);
    this.#undoStack.push(command);
    return this.#state;
  }

  /**
   * Clear both undo and redo stacks while keeping the current state.
   */
  clear(): void {
    this.#undoStack = [];
    this.#redoStack = [];
  }

  /**
   * Return the names of commands in the undo stack (oldest → newest).
   * Commands without a name appear as an empty string.
   */
  getHistory(): string[] {
    return this.#undoStack.map((c) => c.name ?? '');
  }
}

// ─── compose ─────────────────────────────────────────────────────────────────

/**
 * Compose multiple commands into a single atomic command.
 * `execute` applies them left-to-right; `undo` reverses in right-to-left order.
 */
export function compose<S>(...commands: CommandAction<S>[]): CommandAction<S> {
  return {
    name: commands.map((c) => c.name ?? '').join('+') || undefined,
    execute(state: S): S {
      return commands.reduce((s, cmd) => cmd.execute(s), state);
    },
    undo(state: S): S {
      return [...commands].reverse().reduce((s, cmd) => cmd.undo(s), state);
    },
  };
}

// ─── createCommandHistory ────────────────────────────────────────────────────

/** Factory function — convenience wrapper around `new CommandHistory`. */
export function createCommandHistory<S>(
  initialState: S,
  options?: { maxHistory?: number },
): CommandHistory<S> {
  return new CommandHistory(initialState, options);
}
