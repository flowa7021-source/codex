// @ts-check
// ─── Command Pattern ─────────────────────────────────────────────────────────
// Implements the Command design pattern with undo/redo support.
// Supports macro commands (composite), history with configurable max size,
// and simple factory helpers.

/**
 * A reversible operation.
 */
export interface Command {
  /** Perform the operation. */
  execute(): void;
  /** Reverse the operation. */
  undo(): void;
  /** Human-readable description (optional). */
  description?: string;
}

// ─── CommandHistory ───────────────────────────────────────────────────────────

/**
 * Manages a bounded undo/redo history of Commands.
 *
 * @example
 *   const history = new CommandHistory({ maxHistory: 50 });
 *   history.execute(someCommand);
 *   history.undo();
 *   history.redo();
 */
export class CommandHistory {
  #undoStack: Command[] = [];
  #redoStack: Command[] = [];
  #maxHistory: number;

  /**
   * @param options.maxHistory - Maximum number of commands retained (default: 100).
   */
  constructor(options?: { maxHistory?: number }) {
    this.#maxHistory = options?.maxHistory ?? 100;
  }

  /**
   * Execute a command and push it onto the undo stack.
   * Clears the redo stack because a new branch has been created.
   * If the undo stack exceeds maxHistory, the oldest entry is dropped.
   */
  execute(command: Command): void {
    command.execute();
    this.#undoStack.push(command);
    if (this.#undoStack.length > this.#maxHistory) {
      this.#undoStack.shift();
    }
    // New command invalidates any redo branch
    this.#redoStack = [];
  }

  /**
   * Undo the most recent command.
   * @returns `false` if there is nothing to undo.
   */
  undo(): boolean {
    const command = this.#undoStack.pop();
    if (command === undefined) return false;
    command.undo();
    this.#redoStack.push(command);
    return true;
  }

  /**
   * Redo the most recently undone command.
   * @returns `false` if there is nothing to redo.
   */
  redo(): boolean {
    const command = this.#redoStack.pop();
    if (command === undefined) return false;
    command.execute();
    this.#undoStack.push(command);
    return true;
  }

  /** `true` when there is at least one command that can be undone. */
  get canUndo(): boolean {
    return this.#undoStack.length > 0;
  }

  /** `true` when there is at least one command that can be redone. */
  get canRedo(): boolean {
    return this.#redoStack.length > 0;
  }

  /** Number of commands currently on the undo stack. */
  get historySize(): number {
    return this.#undoStack.length;
  }

  /** Number of commands currently on the redo stack. */
  get redoSize(): number {
    return this.#redoStack.length;
  }

  /** Clear both the undo and redo stacks. */
  clear(): void {
    this.#undoStack = [];
    this.#redoStack = [];
  }

  /**
   * Return descriptions from the undo stack, most recent first.
   * Commands without a description are represented by an empty string.
   */
  getUndoStack(): string[] {
    return this.#undoStack.map(c => c.description ?? '').reverse();
  }

  /**
   * Return descriptions from the redo stack, next-to-redo first.
   * Commands without a description are represented by an empty string.
   */
  getRedoStack(): string[] {
    return this.#redoStack.map(c => c.description ?? '').reverse();
  }
}

// ─── MacroCommand ─────────────────────────────────────────────────────────────

/**
 * A composite command that executes multiple commands as a single unit.
 * Undo reverses all sub-commands in the opposite order.
 *
 * @example
 *   const macro = new MacroCommand([cmdA, cmdB], 'Do A then B');
 *   macro.execute(); // runs cmdA.execute(), then cmdB.execute()
 *   macro.undo();    // runs cmdB.undo(),    then cmdA.undo()
 */
export class MacroCommand implements Command {
  #commands: Command[];
  description?: string;

  constructor(commands: Command[], description?: string) {
    this.#commands = commands.slice();
    this.description = description;
  }

  execute(): void {
    for (const cmd of this.#commands) {
      cmd.execute();
    }
  }

  undo(): void {
    for (let i = this.#commands.length - 1; i >= 0; i--) {
      this.#commands[i].undo();
    }
  }
}

// ─── Factory helpers ──────────────────────────────────────────────────────────

/**
 * Create a lightweight Command from plain execute/undo functions.
 *
 * @example
 *   const cmd = createCommand(
 *     () => list.push(item),
 *     () => list.pop(),
 *     'Add item'
 *   );
 */
export function createCommand(
  executeFn: () => void,
  undoFn: () => void,
  description?: string,
): Command {
  return {
    execute: executeFn,
    undo: undoFn,
    description,
  };
}

/**
 * Create a new CommandHistory instance.
 *
 * @example
 *   const history = createHistory({ maxHistory: 20 });
 */
export function createHistory(options?: { maxHistory?: number }): CommandHistory {
  return new CommandHistory(options);
}
