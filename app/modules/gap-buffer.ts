// @ts-check
// ─── Gap Buffer ─────────────────────────────────────────────────────────────
// A gap buffer for efficient text editing. The internal array keeps a "gap"
// (contiguous block of unused slots) at the cursor position so that inserts
// and deletes near the cursor are O(1) amortised, while moves only pay for
// shifting the gap.

// ─── GapBuffer ──────────────────────────────────────────────────────────────

const DEFAULT_GAP_SIZE = 64;

/**
 * A gap buffer for text editing.
 *
 * Internally the text is stored as a `string[]` with a gap of empty slots
 * centred on the cursor position. Insertions/deletions at the cursor are
 * constant-time; random access requires moving the gap first.
 *
 * @example
 *   const buf = new GapBuffer('Hello');
 *   buf.moveTo(5);
 *   buf.insert(' world');
 *   buf.toString(); // 'Hello world'
 */
export class GapBuffer {
  #buf: string[];
  #gapStart: number;
  #gapEnd: number;
  #gapSize: number;

  constructor(initialText?: string, gapSize?: number) {
    this.#gapSize = gapSize != null && gapSize > 0 ? gapSize : DEFAULT_GAP_SIZE;
    const text = initialText ?? '';
    const len = text.length;
    this.#buf = new Array<string>(len + this.#gapSize);

    // Place text before the gap — cursor starts at end of initial text.
    for (let i = 0; i < len; i++) {
      this.#buf[i] = text[i];
    }
    this.#gapStart = len;
    this.#gapEnd = len + this.#gapSize;
  }

  // ─── Cursor / length ────────────────────────────────────────────────────

  /** Current cursor position (0-based index into the logical text). */
  get cursor(): number {
    return this.#gapStart;
  }

  /** Length of the logical text (excludes the gap). */
  get length(): number {
    return this.#buf.length - this.#gapLength;
  }

  /** Number of lines (1 for empty string, counts newlines + 1). */
  get lineCount(): number {
    let count = 1;
    const len = this.length;
    for (let i = 0; i < len; i++) {
      if (this.charAt(i) === '\n') count++;
    }
    return count;
  }

  // ─── Cursor movement ───────────────────────────────────────────────────

  /** Move the cursor to an absolute position. Clamped to [0, length]. */
  moveTo(position: number): void {
    const target = Math.max(0, Math.min(position, this.length));
    if (target < this.#gapStart) {
      // Move gap left: shift characters from before gap into gap tail.
      const shift = this.#gapStart - target;
      for (let i = shift - 1; i >= 0; i--) {
        this.#buf[this.#gapEnd - shift + i] = this.#buf[target + i];
      }
    } else if (target > this.#gapStart) {
      // Move gap right: shift characters from after gap into gap head.
      const shift = target - this.#gapStart;
      for (let i = 0; i < shift; i++) {
        this.#buf[this.#gapStart + i] = this.#buf[this.#gapEnd + i];
      }
    }
    const gapLen = this.#gapLength;
    this.#gapStart = target;
    this.#gapEnd = target + gapLen;
  }

  /** Move the cursor by a relative offset. */
  moveBy(offset: number): void {
    this.moveTo(this.#gapStart + offset);
  }

  // ─── Insertion ──────────────────────────────────────────────────────────

  /** Insert text at the current cursor position. Cursor advances past it. */
  insert(text: string): void {
    if (text.length === 0) return;
    this.#ensureGap(text.length);
    for (let i = 0; i < text.length; i++) {
      this.#buf[this.#gapStart + i] = text[i];
    }
    this.#gapStart += text.length;
  }

  // ─── Deletion ───────────────────────────────────────────────────────────

  /**
   * Delete `count` characters **forward** from the cursor (like the Delete key).
   * Returns the deleted text.
   */
  delete(count?: number): string {
    const n = Math.min(count ?? 1, this.length - this.#gapStart);
    if (n <= 0) return '';
    let deleted = '';
    for (let i = 0; i < n; i++) {
      deleted += this.#buf[this.#gapEnd + i];
    }
    this.#gapEnd += n;
    return deleted;
  }

  /**
   * Delete `count` characters **backward** from the cursor (like Backspace).
   * Returns the deleted text.
   */
  backspace(count?: number): string {
    const n = Math.min(count ?? 1, this.#gapStart);
    if (n <= 0) return '';
    let deleted = '';
    for (let i = n; i > 0; i--) {
      deleted += this.#buf[this.#gapStart - i];
    }
    this.#gapStart -= n;
    return deleted;
  }

  // ─── Access ─────────────────────────────────────────────────────────────

  /**
   * Return the character at the given logical index.
   * Returns an empty string if the index is out of range.
   */
  charAt(index: number): string {
    if (index < 0 || index >= this.length) return '';
    const raw = index < this.#gapStart ? index : index + this.#gapLength;
    return this.#buf[raw];
  }

  /** Materialise the full text content. */
  toString(): string {
    let result = '';
    for (let i = 0; i < this.#gapStart; i++) {
      result += this.#buf[i];
    }
    for (let i = this.#gapEnd; i < this.#buf.length; i++) {
      result += this.#buf[i];
    }
    return result;
  }

  /**
   * Return a substring of the logical text.
   * Semantics match `String.prototype.substring`.
   */
  substring(start: number, end?: number): string {
    const len = this.length;
    const s = Math.max(0, Math.min(start, len));
    const e = end === undefined ? len : Math.max(0, Math.min(end, len));
    const from = Math.min(s, e);
    const to = Math.max(s, e);
    let result = '';
    for (let i = from; i < to; i++) {
      result += this.charAt(i);
    }
    return result;
  }

  /**
   * Return the text of a given line (0-based line number).
   * Returns an empty string if the line number is out of range.
   */
  lineAt(line: number): string {
    if (line < 0) return '';
    const text = this.toString();
    const lines = text.split('\n');
    if (line >= lines.length) return '';
    return lines[line];
  }

  // ─── Internal helpers ───────────────────────────────────────────────────

  get #gapLength(): number {
    return this.#gapEnd - this.#gapStart;
  }

  /** Ensure the gap has at least `needed` slots. Grows the buffer if not. */
  #ensureGap(needed: number): void {
    if (this.#gapLength >= needed) return;

    const grow = Math.max(needed, this.#gapSize);
    const oldLen = this.#buf.length;
    const newBuf = new Array<string>(oldLen + grow);

    // Copy before gap.
    for (let i = 0; i < this.#gapStart; i++) {
      newBuf[i] = this.#buf[i];
    }
    // Copy after gap — shifted right by `grow`.
    const afterGapLen = oldLen - this.#gapEnd;
    for (let i = 0; i < afterGapLen; i++) {
      newBuf[this.#gapEnd + grow + i] = this.#buf[this.#gapEnd + i];
    }

    this.#gapEnd += grow;
    this.#buf = newBuf;
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * Create a gap buffer, optionally pre-loaded with text.
 *
 * @example
 *   const buf = createGapBuffer('Hello world');
 */
export function createGapBuffer(text?: string): GapBuffer {
  return new GapBuffer(text);
}
