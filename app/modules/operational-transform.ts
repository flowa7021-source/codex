// @ts-check
// ─── Operational Transformation ──────────────────────────────────────────────
// OT primitives for collaborative plain-text editing.
// Supports insert, delete, and retain operations with transform/compose/invert.

// ─── Types ────────────────────────────────────────────────────────────────────

export type OpType = 'insert' | 'delete' | 'retain';

export interface Op {
  type: OpType;
  position: number;
  /** Text to insert (only for 'insert' ops). */
  content?: string;
  /** Number of characters affected (for 'delete' and 'retain'). */
  length?: number;
}

export interface TextDocument {
  content: string;
  version: number;
}

// ─── applyOp ─────────────────────────────────────────────────────────────────

/**
 * Apply a single operation to a document, returning a new document.
 * Does not mutate the input document.
 */
export function applyOp(doc: TextDocument, op: Op): TextDocument {
  const { content, version } = doc;

  switch (op.type) {
    case 'insert': {
      const pos = clamp(op.position, 0, content.length);
      const text = op.content ?? '';
      return {
        content: content.slice(0, pos) + text + content.slice(pos),
        version: version + 1,
      };
    }

    case 'delete': {
      const pos = clamp(op.position, 0, content.length);
      const len = op.length ?? 0;
      return {
        content: content.slice(0, pos) + content.slice(pos + len),
        version: version + 1,
      };
    }

    case 'retain':
      // Retain does not change content; it is used as a no-op / cursor marker.
      return { content, version: version + 1 };

    default:
      return { content, version };
  }
}

// ─── transform ───────────────────────────────────────────────────────────────

/**
 * Transform `op1` against `op2`, assuming both were generated against the same
 * document state.  Returns a new op that can be applied after `op2` to achieve
 * the same logical intent as `op1`.
 */
export function transform(op1: Op, op2: Op): Op {
  // Retain ops are positional no-ops — only update position if needed.
  if (op1.type === 'retain') return { ...op1, position: transformPosition(op1.position, op2) };
  if (op2.type === 'retain') return { ...op1 };

  // insert vs insert
  if (op1.type === 'insert' && op2.type === 'insert') {
    const len2 = op2.content?.length ?? 0;
    if (op2.position < op1.position) {
      // op2 inserts strictly before op1 — op1 shifts right unconditionally.
      return { ...op1, position: op1.position + len2 };
    }
    if (op2.position === op1.position) {
      // Tie-break by content so both peers converge to the same ordering.
      // The op whose content sorts lexicographically smaller goes first;
      // if op2.content <= op1.content, op2 is placed first and op1 shifts.
      const c1 = op1.content ?? '';
      const c2 = op2.content ?? '';
      if (c2 <= c1) {
        return { ...op1, position: op1.position + len2 };
      }
      // op1.content < op2.content → op1 goes first, unchanged.
      return { ...op1 };
    }
    // op2 inserts strictly after op1's position — op1 unchanged.
    return { ...op1 };
  }

  // insert vs delete
  if (op1.type === 'insert' && op2.type === 'delete') {
    const del2Start = op2.position;
    const del2End = op2.position + (op2.length ?? 0);
    if (op1.position >= del2End) {
      // op1 is entirely after the deleted range — shift left.
      return { ...op1, position: op1.position - (op2.length ?? 0) };
    }
    if (op1.position > del2Start) {
      // op1 is inside the deleted range — snap to deletion point.
      return { ...op1, position: del2Start };
    }
    // op1 is before the deleted range — unchanged.
    return { ...op1 };
  }

  // delete vs insert
  if (op1.type === 'delete' && op2.type === 'insert') {
    const ins2Pos = op2.position;
    const len2 = op2.content?.length ?? 0;
    const del1Start = op1.position;
    const del1End = op1.position + (op1.length ?? 0);

    if (ins2Pos <= del1Start) {
      // Insert is before or at the start of our delete — shift delete right.
      return { ...op1, position: op1.position + len2 };
    }
    if (ins2Pos < del1End) {
      // Insert is inside our delete range — expand delete to cover inserted text.
      return { ...op1, length: (op1.length ?? 0) + len2 };
    }
    // Insert is after our delete range — unchanged.
    return { ...op1 };
  }

  // delete vs delete
  if (op1.type === 'delete' && op2.type === 'delete') {
    const s1 = op1.position;
    const e1 = op1.position + (op1.length ?? 0);
    const s2 = op2.position;
    const e2 = op2.position + (op2.length ?? 0);

    if (e1 <= s2) {
      // op1 is entirely before op2 — unchanged.
      return { ...op1 };
    }
    if (s1 >= e2) {
      // op1 is entirely after op2 — shift left by op2's length.
      return { ...op1, position: op1.position - (op2.length ?? 0) };
    }

    // Overlapping deletes — the overlapping region is already deleted by op2,
    // so op1 only needs to delete the non-overlapping portion.
    const overlapStart = Math.max(s1, s2);
    const overlapEnd = Math.min(e1, e2);
    const overlap = overlapEnd - overlapStart;
    const newLen = (op1.length ?? 0) - overlap;

    const newPos = s1 < s2 ? s1 : Math.max(s1 - (op2.length ?? 0), s2);
    return { ...op1, position: newPos, length: Math.max(0, newLen) };
  }

  return { ...op1 };
}

// ─── composeOps ───────────────────────────────────────────────────────────────

/**
 * Compose a sequence of operations into a minimal equivalent list.
 * Adjacent compatible operations of the same type and adjacent position are
 * merged; retain ops are dropped since they carry no content change.
 */
export function composeOps(ops: Op[]): Op[] {
  if (ops.length === 0) return [];

  const result: Op[] = [];

  for (const op of ops) {
    if (op.type === 'retain') continue; // retain carries no state change

    const last = result[result.length - 1];

    if (last && last.type === op.type) {
      if (op.type === 'insert') {
        // Merge adjacent inserts only when op inserts at the end of last.
        const lastEnd = last.position + (last.content?.length ?? 0);
        if (op.position === lastEnd) {
          result[result.length - 1] = {
            ...last,
            content: (last.content ?? '') + (op.content ?? ''),
          };
          continue;
        }
      } else if (op.type === 'delete') {
        // Merge adjacent deletes when contiguous.
        const lastEnd = last.position + (last.length ?? 0);
        if (op.position === last.position || op.position === lastEnd) {
          const newLen = (last.length ?? 0) + (op.length ?? 0);
          result[result.length - 1] = {
            ...last,
            position: Math.min(last.position, op.position),
            length: newLen,
          };
          continue;
        }
      }
    }

    result.push({ ...op });
  }

  return result;
}

// ─── invertOp ─────────────────────────────────────────────────────────────────

/**
 * Return the inverse of `op` with respect to `doc` (the document state before
 * `op` was applied).  Applying the inverse undoes the original operation.
 */
export function invertOp(op: Op, doc: TextDocument): Op {
  switch (op.type) {
    case 'insert': {
      const len = op.content?.length ?? 0;
      return { type: 'delete', position: op.position, length: len };
    }

    case 'delete': {
      const pos = clamp(op.position, 0, doc.content.length);
      const len = op.length ?? 0;
      const deleted = doc.content.slice(pos, pos + len);
      return { type: 'insert', position: pos, content: deleted };
    }

    case 'retain':
      return { ...op };

    default:
      return { ...op };
  }
}

// ─── CollaborativeDocument ───────────────────────────────────────────────────

/**
 * A collaborative text document that tracks local and remote operations with
 * operational transformation.
 */
export class CollaborativeDocument {
  #content: string;
  #version: number;
  /** All operations applied so far (local + remote, in application order). */
  readonly #history: Op[];
  /** Only locally-applied operations, for undo support. */
  readonly #localHistory: Op[];

  constructor(initialContent: string = '') {
    this.#content = initialContent;
    this.#version = 0;
    this.#history = [];
    this.#localHistory = [];
  }

  get content(): string {
    return this.#content;
  }

  get version(): number {
    return this.#version;
  }

  /** Apply a local operation and record it in history. */
  apply(op: Op): void {
    const result = applyOp({ content: this.#content, version: this.#version }, op);
    this.#content = result.content;
    this.#version = result.version;
    this.#history.push(op);
    this.#localHistory.push(op);
  }

  /**
   * Apply a remote operation.
   * The op was generated against the document at `baseVersion`; it is
   * transformed against all local ops applied since that version before
   * being applied.
   */
  applyRemote(op: Op, baseVersion: number): void {
    // Collect local ops applied after baseVersion.
    const localOpsAfterBase = this.#localHistory.slice(baseVersion);

    // Transform the incoming op against each local op in sequence.
    let transformed = op;
    for (const localOp of localOpsAfterBase) {
      transformed = transform(transformed, localOp);
    }

    const result = applyOp({ content: this.#content, version: this.#version }, transformed);
    this.#content = result.content;
    this.#version = result.version;
    this.#history.push(transformed);
    // Remote ops do not go into #localHistory (they're not undo-able by this peer).
  }

  /** Return a copy of the full operation history. */
  history(): Op[] {
    return [...this.#history];
  }

  /**
   * Undo the last local operation.
   * Returns `true` if an op was undone, `false` if history is empty.
   */
  undo(): boolean {
    if (this.#localHistory.length === 0) return false;

    const lastOp = this.#localHistory.pop()!;

    // Build the document state just before the last op was applied.
    // Walk forward from an empty doc through all but the last local op.
    let docBefore: TextDocument = { content: '', version: 0 };
    for (const op of this.#localHistory) {
      docBefore = applyOp(docBefore, op);
    }
    // Use original content reconstruction if we have it — but since we only
    // track ops, re-derive content before lastOp was applied.
    // Simpler: track the document content before each apply.
    // For correctness with the current design, re-apply from scratch:
    let rebuilt: TextDocument = { content: '', version: 0 };
    for (const op of this.#localHistory) {
      rebuilt = applyOp(rebuilt, op);
    }

    const inverse = invertOp(lastOp, rebuilt);
    const result = applyOp({ content: this.#content, version: this.#version }, inverse);
    this.#content = result.content;
    this.#version = result.version;
    this.#history.push(inverse);

    return true;
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function transformPosition(pos: number, op: Op): number {
  if (op.type === 'insert') {
    const len = op.content?.length ?? 0;
    return op.position <= pos ? pos + len : pos;
  }
  if (op.type === 'delete') {
    const start = op.position;
    const end = op.position + (op.length ?? 0);
    if (pos <= start) return pos;
    if (pos < end) return start;
    return pos - (op.length ?? 0);
  }
  return pos;
}
