// @ts-check
// ─── Undo/Redo ────────────────────────────────────────────────────────────────
// Generic command-pattern UndoRedoHistory<T> class, plus the legacy singleton
// undoRedoManager used by the application layer.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Command<T> {
  execute: (state: T) => T;
  undo: (state: T) => T;
  label?: string;
}

export interface UndoRedoOptions {
  maxHistory?: number;
}

// ─── UndoRedoHistory ──────────────────────────────────────────────────────────

export class UndoRedoHistory<T> {
  #state: T;
  #undoStack: Command<T>[] = [];
  #redoStack: Command<T>[] = [];
  #maxHistory: number;

  constructor(initialState: T, options?: UndoRedoOptions) {
    this.#state = initialState;
    this.#maxHistory = options?.maxHistory ?? 100;
  }

  /**
   * Execute a command: apply it to the current state, push it onto the undo
   * stack, and clear the redo stack.
   */
  execute(command: Command<T>): void {
    this.#state = command.execute(this.#state);
    this.#undoStack.push(command);
    this.#redoStack = [];

    // Enforce max history — drop oldest undo entry
    if (this.#undoStack.length > this.#maxHistory) {
      this.#undoStack.splice(0, this.#undoStack.length - this.#maxHistory);
    }
  }

  /**
   * Undo the last command.
   * Returns false if there is nothing to undo.
   */
  undo(): boolean {
    if (this.#undoStack.length === 0) return false;
    const command = this.#undoStack.pop()!;
    this.#state = command.undo(this.#state);
    this.#redoStack.push(command);
    return true;
  }

  /**
   * Redo the next undone command.
   * Returns false if there is nothing to redo.
   */
  redo(): boolean {
    if (this.#redoStack.length === 0) return false;
    const command = this.#redoStack.pop()!;
    this.#state = command.execute(this.#state);
    this.#undoStack.push(command);
    return true;
  }

  /** Whether there are commands available to undo. */
  get canUndo(): boolean {
    return this.#undoStack.length > 0;
  }

  /** Whether there are commands available to redo. */
  get canRedo(): boolean {
    return this.#redoStack.length > 0;
  }

  /** Current state. */
  get state(): T {
    return this.#state;
  }

  /** Labels of commands in the undo stack (oldest first). */
  get undoStack(): string[] {
    return this.#undoStack.map((c) => c.label ?? '');
  }

  /** Labels of commands in the redo stack (most-recently-undone first). */
  get redoStack(): string[] {
    return this.#redoStack.map((c) => c.label ?? '');
  }

  /** Clear all undo and redo history, keeping the current state. */
  clear(): void {
    this.#undoStack = [];
    this.#redoStack = [];
  }

  /**
   * Jump N steps through history.
   * Positive steps redo; negative steps undo.
   * Stops naturally if the boundary is reached.
   */
  jump(steps: number): void {
    if (steps > 0) {
      for (let i = 0; i < steps; i++) {
        if (!this.redo()) break;
      }
    } else if (steps < 0) {
      const back = -steps;
      for (let i = 0; i < back; i++) {
        if (!this.undo()) break;
      }
    }
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Create a new UndoRedoHistory with the given initial state.
 * @template T
 */
export function createUndoRedoHistory<T>(
  initialState: T,
  options?: UndoRedoOptions,
): UndoRedoHistory<T> {
  return new UndoRedoHistory<T>(initialState, options);
}

// ─── Legacy singleton (application layer) ────────────────────────────────────

const MAX_STACK = 100;

interface LegacyCmd {
  name: string;
  execute: () => void;
  undo: () => void;
}

class UndoRedoManager {
  undoStack: LegacyCmd[] = [];
  redoStack: LegacyCmd[] = [];
  _listeners: Array<(state: { canUndo: boolean; canRedo: boolean }) => void> = [];

  onChange(fn: (state: { canUndo: boolean; canRedo: boolean }) => void): () => void {
    this._listeners.push(fn);
    return () => { this._listeners = this._listeners.filter((f) => f !== fn); };
  }

  _notify(): void {
    for (const fn of this._listeners) {
      try { fn({ canUndo: this.canUndo(), canRedo: this.canRedo() }); } catch (err: unknown) {
        console.warn('[undo-redo] error:', (err as Error)?.message);
      }
    }
  }

  execute(cmd: LegacyCmd): void {
    cmd.execute();
    this.undoStack.push(cmd);
    if (this.undoStack.length > MAX_STACK) this.undoStack.shift();
    this.redoStack.length = 0;
    this._notify();
  }

  push(cmd: LegacyCmd): void {
    this.undoStack.push(cmd);
    if (this.undoStack.length > MAX_STACK) this.undoStack.shift();
    this.redoStack.length = 0;
    this._notify();
  }

  canUndo(): boolean { return this.undoStack.length > 0; }
  canRedo(): boolean { return this.redoStack.length > 0; }

  undo(): LegacyCmd | null {
    const cmd = this.undoStack.pop();
    if (!cmd) return null;
    cmd.undo();
    this.redoStack.push(cmd);
    this._notify();
    return cmd;
  }

  redo(): LegacyCmd | null {
    const cmd = this.redoStack.pop();
    if (!cmd) return null;
    cmd.execute();
    this.undoStack.push(cmd);
    this._notify();
    return cmd;
  }

  clear(): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this._notify();
  }

  status(): { undoName: string | null; redoName: string | null; undoCount: number; redoCount: number } {
    return {
      undoName: this.undoStack.length ? this.undoStack[this.undoStack.length - 1].name : null,
      redoName: this.redoStack.length ? this.redoStack[this.redoStack.length - 1].name : null,
      undoCount: this.undoStack.length,
      redoCount: this.redoStack.length,
    };
  }
}

export const undoRedoManager = new UndoRedoManager();

export function textEditCommand(
  page: number,
  oldText: string,
  newText: string,
  applyFn: (text: string) => void,
): LegacyCmd {
  return {
    name: `Редактирование текста (стр. ${page})`,
    execute: () => applyFn(newText),
    undo: () => applyFn(oldText),
  };
}

export function strokeCommand(
  page: number,
  stroke: unknown,
  addFn: (s: unknown) => void,
  removeFn: (s: unknown) => void,
): LegacyCmd {
  return {
    name: `Штрих (стр. ${page})`,
    execute: () => addFn(stroke),
    undo: () => removeFn(stroke),
  };
}

export function bindUndoRedoKeys(): void {
  document.addEventListener('keydown', (e) => {
    if ((e.target as Element).matches('input, textarea, [contenteditable]')) return;
    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undoRedoManager.undo();
      } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
        e.preventDefault();
        undoRedoManager.redo();
      }
    }
  });
}
