// ─── Undo/Redo System (Command Pattern) ─────────────────────────────────────
// Global undo/redo stack with named commands.

const MAX_STACK = 100;

class UndoRedoManager {
  constructor() {
    this.undoStack = [];
    this.redoStack = [];
    this._listeners = [];
  }

  /** Register a change listener */
  onChange(fn) {
    this._listeners.push(fn);
    return () => { this._listeners = this._listeners.filter(f => f !== fn); };
  }

  _notify() {
    for (const fn of this._listeners) {
      try { fn({ canUndo: this.canUndo(), canRedo: this.canRedo() }); } catch (err) { console.warn('[undo-redo] error:', err?.message); }
    }
  }

  /**
   * Execute a command and push it onto the undo stack.
   * @param {object} cmd
   * @param {string} cmd.name - Human-readable description
   * @param {Function} cmd.execute - Perform the action (called immediately)
   * @param {Function} cmd.undo - Reverse the action
   */
  execute(cmd) {
    cmd.execute();
    this.undoStack.push(cmd);
    if (this.undoStack.length > MAX_STACK) this.undoStack.shift();
    this.redoStack.length = 0;
    this._notify();
  }

  /**
   * Push an already-executed command (no execute() call).
   */
  push(cmd) {
    this.undoStack.push(cmd);
    if (this.undoStack.length > MAX_STACK) this.undoStack.shift();
    this.redoStack.length = 0;
    this._notify();
  }

  canUndo() { return this.undoStack.length > 0; }
  canRedo() { return this.redoStack.length > 0; }

  undo() {
    const cmd = this.undoStack.pop();
    if (!cmd) return null;
    cmd.undo();
    this.redoStack.push(cmd);
    this._notify();
    return cmd;
  }

  redo() {
    const cmd = this.redoStack.pop();
    if (!cmd) return null;
    cmd.execute();
    this.undoStack.push(cmd);
    this._notify();
    return cmd;
  }

  clear() {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this._notify();
  }

  /** Get description of next undo/redo actions */
  status() {
    return {
      undoName: this.undoStack.length ? this.undoStack[this.undoStack.length - 1].name : null,
      redoName: this.redoStack.length ? this.redoStack[this.redoStack.length - 1].name : null,
      undoCount: this.undoStack.length,
      redoCount: this.redoStack.length,
    };
  }
}

export const undoRedoManager = new UndoRedoManager();

/**
 * Create a command for text edit.
 */
export function textEditCommand(page, oldText, newText, applyFn) {
  return {
    name: `Редактирование текста (стр. ${page})`,
    execute: () => applyFn(newText),
    undo: () => applyFn(oldText),
  };
}

/**
 * Create a command for annotation stroke.
 */
export function strokeCommand(page, stroke, addFn, removeFn) {
  return {
    name: `Штрих (стр. ${page})`,
    execute: () => addFn(stroke),
    undo: () => removeFn(stroke),
  };
}

/**
 * Bind global Ctrl+Z / Ctrl+Shift+Z to the undo/redo manager.
 */
export function bindUndoRedoKeys() {
  document.addEventListener('keydown', (e) => {
    // Don't intercept if in input/textarea
    if (e.target.matches('input, textarea, [contenteditable]')) return;

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
