// @ts-check
// ─── Command Pattern ──────────────────────────────────────────────────────────
// Execute/undo command pattern with async support and history management.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Command<T = void> {
  execute(): T | Promise<T>;
  undo?(): void | Promise<void>;
  label?: string;
}

// ─── createCommand ────────────────────────────────────────────────────────────

/**
 * Create a simple reversible command from plain functions.
 *
 * @param executeFn - Function to call on execute.
 * @param undoFn - Optional function to call on undo.
 * @param label - Optional human-readable label.
 */
export function createCommand<T>(
  executeFn: () => T | Promise<T>,
  undoFn?: () => void | Promise<void>,
  label?: string,
): Command<T> {
  const cmd: Command<T> = { execute: executeFn };
  if (undoFn !== undefined) cmd.undo = undoFn;
  if (label !== undefined) cmd.label = label;
  return cmd;
}

// ─── CommandExecutor ──────────────────────────────────────────────────────────

/**
 * Executes commands and maintains an undo/redo history.
 *
 * Only commands that provide an `undo` function participate in undo history.
 * Commands without `undo` are executed but not pushed onto the undo stack.
 * After undo the command can be redone; pushing a new command clears redo stack.
 *
 * @example
 *   const exec = new CommandExecutor();
 *   await exec.execute(createCommand(() => doSomething(), () => undoSomething()));
 *   await exec.undo();
 *   await exec.redo();
 */
export class CommandExecutor {
  #undoStack: Command<unknown>[];
  #redoStack: Command<unknown>[];
  #maxHistory: number;

  /**
   * @param options.maxHistory - Maximum undo stack depth (default 100).
   */
  constructor(options?: { maxHistory?: number }) {
    this.#maxHistory = options?.maxHistory ?? 100;
    this.#undoStack = [];
    this.#redoStack = [];
  }

  // ─── Getters ────────────────────────────────────────────────────────────────

  /** Whether undo is available (at least one undoable command in history). */
  get canUndo(): boolean {
    return this.#undoStack.length > 0;
  }

  /** Whether redo is available. */
  get canRedo(): boolean {
    return this.#redoStack.length > 0;
  }

  /** Number of commands currently in the undo history. */
  get historyLength(): number {
    return this.#undoStack.length;
  }

  // ─── Execute / Undo / Redo ───────────────────────────────────────────────────

  /**
   * Execute a command and, if it supports undo, push it onto the undo stack.
   * Clears the redo stack on a new execute.
   *
   * @returns The result of the command's execute function.
   */
  async execute<T>(command: Command<T>): Promise<T> {
    const result = await command.execute();

    if (typeof command.undo === 'function') {
      // Cast so the heterogeneous stack is typed consistently
      this.#undoStack.push(command as unknown as Command<unknown>);
      this.#redoStack = [];

      // Trim oldest entries if over budget
      if (this.#undoStack.length > this.#maxHistory) {
        this.#undoStack.shift();
      }
    }

    return result;
  }

  /**
   * Undo the most recently executed undoable command.
   * @returns true if undo was performed, false if nothing to undo.
   */
  async undo(): Promise<boolean> {
    if (!this.canUndo) return false;
    const command = this.#undoStack.pop()!;
    await command.undo!();
    this.#redoStack.push(command);
    return true;
  }

  /**
   * Redo the most recently undone command.
   * @returns true if redo was performed, false if nothing to redo.
   */
  async redo(): Promise<boolean> {
    if (!this.canRedo) return false;
    const command = this.#redoStack.pop()!;
    await command.execute();
    this.#undoStack.push(command);
    return true;
  }

  // ─── History ─────────────────────────────────────────────────────────────────

  /** Clear the undo and redo history. */
  clearHistory(): void {
    this.#undoStack = [];
    this.#redoStack = [];
  }
}
