// @ts-check
// ─── Text Buffer (Piece Table) ───────────────────────────────────────────────
// A mutable text buffer backed by a piece table, supporting efficient insert,
// delete, replace, undo, and redo.  Suitable for editor-style workloads.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Position {
  line: number;
  column: number;
}

// ─── Piece Table internals ────────────────────────────────────────────────────

/**
 * Which buffer the piece references — the original read-only buffer that held
 * the initial content, or the append-only "add" buffer for new text.
 */
const BufferType = { Original: 0, Add: 1 } as const;
type BufferTypeValue = (typeof BufferType)[keyof typeof BufferType];

interface Piece {
  bufferType: BufferTypeValue;
  /** Start offset into the referenced buffer. */
  start: number;
  /** Number of characters in this piece. */
  length: number;
}

/** A snapshot of the piece list for undo/redo. */
interface Snapshot {
  pieces: Piece[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function clonePieces(pieces: Piece[]): Piece[] {
  return pieces.map(p => ({ ...p }));
}

// ─── TextBuffer ───────────────────────────────────────────────────────────────

export class TextBuffer {
  /** The original, immutable content. */
  readonly #original: string;
  /** Append-only buffer for all new text inserted after construction. */
  #addBuffer: string = '';
  /** Current list of pieces describing the logical text. */
  #pieces: Piece[] = [];
  /** Undo stack — each entry is a full snapshot of #pieces before an op. */
  readonly #undoStack: Snapshot[] = [];
  /** Redo stack — entries pushed on undo, cleared on new edit. */
  readonly #redoStack: Snapshot[] = [];

  constructor(initialContent?: string) {
    const content = initialContent ?? '';
    this.#original = content;
    if (content.length > 0) {
      this.#pieces = [{ bufferType: BufferType.Original, start: 0, length: content.length }];
    }
  }

  // ── Private helpers ─────────────────────────────────────────────────────

  /** Materialise the entire text from the piece list. */
  #build(pieces: Piece[]): string {
    let out = '';
    for (const p of pieces) {
      const buf = p.bufferType === BufferType.Original ? this.#original : this.#addBuffer;
      out += buf.slice(p.start, p.start + p.length);
    }
    return out;
  }

  /**
   * Save current #pieces onto the undo stack and clear the redo stack.
   * Called before every destructive operation.
   */
  #saveSnapshot(): void {
    this.#undoStack.push({ pieces: clonePieces(this.#pieces) });
    this.#redoStack.length = 0;
  }

  /**
   * Split the piece list so that there is a clean boundary at logical offset
   * `offset`.  Returns the index at which a new piece can be inserted.
   */
  #splitAt(offset: number): number {
    let pos = 0;
    for (let i = 0; i < this.#pieces.length; i++) {
      const p = this.#pieces[i];
      if (pos === offset) return i;
      if (pos + p.length > offset) {
        // Split piece[i] into two
        const before: Piece = { bufferType: p.bufferType, start: p.start, length: offset - pos };
        const after: Piece = {
          bufferType: p.bufferType,
          start: p.start + before.length,
          length: p.length - before.length,
        };
        this.#pieces.splice(i, 1, before, after);
        return i + 1;
      }
      pos += p.length;
    }
    return this.#pieces.length; // offset is at the end
  }

  /** Convert a Position to a linear character offset. */
  positionToOffset(pos: Position): number {
    const text = this.getText();
    let line = 0;
    let col = 0;
    for (let i = 0; i < text.length; i++) {
      if (line === pos.line && col === pos.column) return i;
      if (text[i] === '\n') {
        line++;
        col = 0;
      } else {
        col++;
      }
    }
    // End-of-text position
    if (line === pos.line && col === pos.column) return text.length;
    // Clamp to text length if position is beyond the text
    return text.length;
  }

  /** Convert a linear offset to a Position. */
  offsetToPosition(offset: number): Position {
    const text = this.getText();
    const clamped = Math.max(0, Math.min(offset, text.length));
    let line = 0;
    let col = 0;
    for (let i = 0; i < clamped; i++) {
      if (text[i] === '\n') {
        line++;
        col = 0;
      } else {
        col++;
      }
    }
    return { line, column: col };
  }

  // ── Public API ──────────────────────────────────────────────────────────

  /** Insert `text` at position `pos`. */
  insert(pos: Position, text: string): void {
    if (text.length === 0) return;
    this.#saveSnapshot();

    const offset = this.positionToOffset(pos);
    const addStart = this.#addBuffer.length;
    this.#addBuffer += text;

    const idx = this.#splitAt(offset);
    const newPiece: Piece = { bufferType: BufferType.Add, start: addStart, length: text.length };
    this.#pieces.splice(idx, 0, newPiece);
  }

  /** Delete the range from `start` (inclusive) to `end` (exclusive) by position. */
  delete(start: Position, end: Position): void {
    const s = this.positionToOffset(start);
    const e = this.positionToOffset(end);
    if (s >= e) return;
    this.#saveSnapshot();

    // Split at the lower boundary first, then at the upper boundary.
    // Splitting at s may add a piece, so we split s first and then e.
    const startIdx = this.#splitAt(s);
    const endIdx = this.#splitAt(e);
    this.#pieces.splice(startIdx, endIdx - startIdx);
  }

  /** Replace the range [start, end) with `text`. */
  replace(start: Position, end: Position, text: string): void {
    const s = this.positionToOffset(start);
    const e = this.positionToOffset(end);
    if (s === e && text.length === 0) return;
    this.#saveSnapshot();

    // Split at lower boundary first, then upper.
    const startIdx = this.#splitAt(s);
    const endIdx = this.#splitAt(e);
    this.#pieces.splice(startIdx, endIdx - startIdx);

    // Insert new text at the same location
    if (text.length > 0) {
      const addStart = this.#addBuffer.length;
      this.#addBuffer += text;
      const newPiece: Piece = { bufferType: BufferType.Add, start: addStart, length: text.length };
      this.#pieces.splice(startIdx, 0, newPiece);
    }
  }

  /** Return the entire text content. */
  getText(): string {
    return this.#build(this.#pieces);
  }

  /** Return a single line by 0-based line index. Returns '' if out of range. */
  getLine(line: number): string {
    const text = this.getText();
    const lines = text.split('\n');
    if (line < 0 || line >= lines.length) return '';
    return lines[line];
  }

  /** Number of lines in the buffer (always >= 1). */
  get lineCount(): number {
    const text = this.getText();
    let count = 1;
    for (let i = 0; i < text.length; i++) {
      if (text[i] === '\n') count++;
    }
    return count;
  }

  /** Return the character at `pos`. Returns '' if out of range. */
  getChar(pos: Position): string {
    const offset = this.positionToOffset(pos);
    const text = this.getText();
    return offset < text.length ? text[offset] : '';
  }

  /** Undo the last operation. Returns true if an undo was applied. */
  undo(): boolean {
    const snapshot = this.#undoStack.pop();
    if (!snapshot) return false;
    this.#redoStack.push({ pieces: clonePieces(this.#pieces) });
    this.#pieces = snapshot.pieces;
    return true;
  }

  /** Redo the last undone operation. Returns true if a redo was applied. */
  redo(): boolean {
    const snapshot = this.#redoStack.pop();
    if (!snapshot) return false;
    this.#undoStack.push({ pieces: clonePieces(this.#pieces) });
    this.#pieces = snapshot.pieces;
    return true;
  }
}
