// @ts-check
// ─── JSON Patch (RFC 6902) ────────────────────────────────────────────────────
// Implements apply, create, invert and validate for JSON Patch operations.

// ─── Types ────────────────────────────────────────────────────────────────────

export type PatchOp =
  | { op: 'add'; path: string; value: unknown }
  | { op: 'remove'; path: string }
  | { op: 'replace'; path: string; value: unknown }
  | { op: 'move'; from: string; path: string }
  | { op: 'copy'; from: string; path: string }
  | { op: 'test'; path: string; value: unknown };

export interface PatchResult {
  success: boolean;
  doc: unknown;
  error?: string;
}

// ─── JSON Pointer helpers (RFC 6901) ─────────────────────────────────────────

/** Parse a JSON Pointer string into path segments. */
function parsePointer(pointer: string): string[] {
  if (pointer === '') return [];
  if (!pointer.startsWith('/')) {
    throw new Error(`Invalid JSON Pointer: ${pointer}`);
  }
  return pointer
    .slice(1)
    .split('/')
    .map((seg) => seg.replace(/~1/g, '/').replace(/~0/g, '~'));
}

/** Encode a path segment for use in a JSON Pointer. */
function encodeSegment(seg: string): string {
  return seg.replace(/~/g, '~0').replace(/\//g, '~1');
}

/** Build a JSON Pointer string from an array of segments. */
function buildPointer(segments: string[]): string {
  if (segments.length === 0) return '';
  return '/' + segments.map(encodeSegment).join('/');
}

/** Deep-clone a value (JSON-safe). */
function cloneDeep(val: unknown): unknown {
  if (val === null || typeof val !== 'object') return val;
  if (Array.isArray(val)) return val.map(cloneDeep);
  const obj = val as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    result[key] = cloneDeep(obj[key]);
  }
  return result;
}

/** Deep-equal comparison (JSON-safe). */
function deepEqualInternal(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, i) => deepEqualInternal(item, (b as unknown[])[i]));
  }
  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  const aKeys = Object.keys(ao);
  const bKeys = Object.keys(bo);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((k) => Object.prototype.hasOwnProperty.call(bo, k) && deepEqualInternal(ao[k], bo[k]));
}

// ─── Low-level get / set / remove on a cloned document ───────────────────────

/**
 * Get the value at the given pointer in the document.
 * Throws if the path does not exist.
 */
function getAt(doc: unknown, segments: string[]): unknown {
  let cur: unknown = doc;
  for (const seg of segments) {
    if (cur === null || typeof cur !== 'object') {
      throw new Error(`Path not found: segment "${seg}" on non-object`);
    }
    if (Array.isArray(cur)) {
      const idx = Number(seg);
      if (!Number.isInteger(idx) || idx < 0 || idx >= cur.length) {
        throw new Error(`Array index out of bounds: ${seg}`);
      }
      cur = cur[idx];
    } else {
      const obj = cur as Record<string, unknown>;
      if (!Object.prototype.hasOwnProperty.call(obj, seg)) {
        throw new Error(`Key not found: ${seg}`);
      }
      cur = obj[seg];
    }
  }
  return cur;
}

/**
 * Set a value at the given pointer (mutates a cloned document in place).
 * The parent must exist. Use isAdd=true for 'add' semantics on arrays (inserts).
 */
function setAt(doc: unknown, segments: string[], value: unknown, isAdd: boolean): void {
  if (segments.length === 0) {
    throw new Error('Cannot replace the root document via setAt');
  }
  const parentSegs = segments.slice(0, -1);
  const lastSeg = segments[segments.length - 1];
  let parent: unknown = doc;
  for (const seg of parentSegs) {
    if (parent === null || typeof parent !== 'object') {
      throw new Error(`Path not found: segment "${seg}" on non-object`);
    }
    if (Array.isArray(parent)) {
      const idx = Number(seg);
      if (!Number.isInteger(idx) || idx < 0 || idx >= parent.length) {
        throw new Error(`Array index out of bounds: ${seg}`);
      }
      parent = parent[idx];
    } else {
      const obj = parent as Record<string, unknown>;
      if (!Object.prototype.hasOwnProperty.call(obj, seg)) {
        throw new Error(`Key not found: ${seg}`);
      }
      parent = obj[seg];
    }
  }
  if (Array.isArray(parent)) {
    if (lastSeg === '-') {
      parent.push(value);
    } else {
      const idx = Number(lastSeg);
      if (!Number.isInteger(idx) || idx < 0) {
        throw new Error(`Invalid array index: ${lastSeg}`);
      }
      if (isAdd) {
        if (idx > parent.length) throw new Error(`Array index out of bounds for add: ${idx}`);
        parent.splice(idx, 0, value);
      } else {
        if (idx >= parent.length) throw new Error(`Array index out of bounds: ${idx}`);
        parent[idx] = value;
      }
    }
  } else if (parent !== null && typeof parent === 'object') {
    (parent as Record<string, unknown>)[lastSeg] = value;
  } else {
    throw new Error(`Cannot set on non-object parent`);
  }
}

/**
 * Remove the value at the given pointer (mutates a cloned document in place).
 */
function removeAt(doc: unknown, segments: string[]): void {
  if (segments.length === 0) {
    throw new Error('Cannot remove the root document');
  }
  const parentSegs = segments.slice(0, -1);
  const lastSeg = segments[segments.length - 1];
  let parent: unknown = doc;
  for (const seg of parentSegs) {
    if (parent === null || typeof parent !== 'object') {
      throw new Error(`Path not found: segment "${seg}" on non-object`);
    }
    if (Array.isArray(parent)) {
      const idx = Number(seg);
      if (!Number.isInteger(idx) || idx < 0 || idx >= parent.length) {
        throw new Error(`Array index out of bounds: ${seg}`);
      }
      parent = parent[idx];
    } else {
      const obj = parent as Record<string, unknown>;
      if (!Object.prototype.hasOwnProperty.call(obj, seg)) {
        throw new Error(`Key not found: ${seg}`);
      }
      parent = obj[seg];
    }
  }
  if (Array.isArray(parent)) {
    const idx = Number(lastSeg);
    if (!Number.isInteger(idx) || idx < 0 || idx >= parent.length) {
      throw new Error(`Array index out of bounds: ${lastSeg}`);
    }
    parent.splice(idx, 1);
  } else if (parent !== null && typeof parent === 'object') {
    const obj = parent as Record<string, unknown>;
    if (!Object.prototype.hasOwnProperty.call(obj, lastSeg)) {
      throw new Error(`Key not found: ${lastSeg}`);
    }
    delete obj[lastSeg];
  } else {
    throw new Error(`Cannot remove from non-object parent`);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Apply a single operation. Returns new document or throws on error. */
export function applyOp(doc: unknown, op: PatchOp): unknown {
  // Work on a deep clone so we never mutate the input.
  let root = cloneDeep(doc);

  switch (op.op) {
    case 'add': {
      const segs = parsePointer(op.path);
      if (segs.length === 0) {
        root = cloneDeep(op.value);
      } else {
        setAt(root, segs, cloneDeep(op.value), true);
      }
      break;
    }
    case 'remove': {
      const segs = parsePointer(op.path);
      removeAt(root, segs);
      break;
    }
    case 'replace': {
      const segs = parsePointer(op.path);
      if (segs.length === 0) {
        root = cloneDeep(op.value);
      } else {
        // Verify the path exists first
        getAt(root, segs);
        setAt(root, segs, cloneDeep(op.value), false);
      }
      break;
    }
    case 'move': {
      const fromSegs = parsePointer(op.from);
      const toSegs = parsePointer(op.path);
      const value = cloneDeep(getAt(root, fromSegs));
      removeAt(root, fromSegs);
      if (toSegs.length === 0) {
        root = value;
      } else {
        setAt(root, toSegs, value, true);
      }
      break;
    }
    case 'copy': {
      const fromSegs = parsePointer(op.from);
      const toSegs = parsePointer(op.path);
      const value = cloneDeep(getAt(root, fromSegs));
      if (toSegs.length === 0) {
        root = value;
      } else {
        setAt(root, toSegs, value, true);
      }
      break;
    }
    case 'test': {
      const segs = parsePointer(op.path);
      const actual = getAt(root, segs);
      if (!deepEqualInternal(actual, op.value)) {
        throw new Error(`Test failed at path "${op.path}": expected ${JSON.stringify(op.value)}, got ${JSON.stringify(actual)}`);
      }
      break;
    }
    default: {
      const _exhaustive: never = op;
      throw new Error(`Unknown op: ${(_exhaustive as PatchOp).op}`);
    }
  }

  return root;
}

/** Apply a JSON Patch to a document. Returns new document (immutable). */
export function applyPatch(doc: unknown, ops: PatchOp[]): PatchResult {
  let current = doc;
  for (const op of ops) {
    try {
      current = applyOp(current, op);
    } catch (err) {
      return {
        success: false,
        doc: current,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
  return { success: true, doc: current };
}

/** Test if a patch can be applied to a document without errors. */
export function validatePatch(doc: unknown, ops: PatchOp[]): boolean {
  return applyPatch(doc, ops).success;
}

// ─── createPatch ──────────────────────────────────────────────────────────────

/** Generate a patch to transform doc1 into doc2. */
export function createPatch(doc1: unknown, doc2: unknown): PatchOp[] {
  const ops: PatchOp[] = [];
  diffValues(doc1, doc2, '', ops);
  return ops;
}

function diffValues(oldVal: unknown, newVal: unknown, path: string, ops: PatchOp[]): void {
  if (deepEqualInternal(oldVal, newVal)) return;

  const isOldObj = oldVal !== null && typeof oldVal === 'object' && !Array.isArray(oldVal);
  const isNewObj = newVal !== null && typeof newVal === 'object' && !Array.isArray(newVal);

  if (isOldObj && isNewObj) {
    const oldObj = oldVal as Record<string, unknown>;
    const newObj = newVal as Record<string, unknown>;
    const oldKeys = new Set(Object.keys(oldObj));
    const newKeys = new Set(Object.keys(newObj));

    // Removed keys
    for (const key of oldKeys) {
      if (!newKeys.has(key)) {
        ops.push({ op: 'remove', path: path + '/' + encodeSegment(key) });
      }
    }
    // Added keys
    for (const key of newKeys) {
      if (!oldKeys.has(key)) {
        ops.push({ op: 'add', path: path + '/' + encodeSegment(key), value: cloneDeep(newObj[key]) });
      }
    }
    // Changed keys
    for (const key of newKeys) {
      if (oldKeys.has(key)) {
        diffValues(oldObj[key], newObj[key], path + '/' + encodeSegment(key), ops);
      }
    }
    return;
  }

  if (path === '') {
    // Root replacement — add with empty path acts as replace
    ops.push({ op: 'add', path: '', value: cloneDeep(newVal) });
  } else {
    ops.push({ op: 'replace', path, value: cloneDeep(newVal) });
  }
}

// ─── invertPatch ──────────────────────────────────────────────────────────────

/** Invert a patch (so applying the inverted patch to doc2 yields doc1). */
export function invertPatch(patch: PatchOp[], doc: unknown): PatchOp[] {
  const inverse: PatchOp[] = [];
  let current = doc;

  for (const op of patch) {
    switch (op.op) {
      case 'add': {
        // Inverse of add is remove
        const segs = parsePointer(op.path);
        if (segs.length === 0) {
          // add to root: the inverse is replacing back with the old value
          inverse.push({ op: 'replace', path: op.path, value: cloneDeep(current) });
        } else {
          inverse.push({ op: 'remove', path: op.path });
        }
        break;
      }
      case 'remove': {
        // Inverse of remove is add with the old value
        const segs = parsePointer(op.path);
        const oldValue = cloneDeep(getAt(current, segs));
        inverse.push({ op: 'add', path: op.path, value: oldValue });
        break;
      }
      case 'replace': {
        // Inverse of replace is replace with the old value
        const segs = parsePointer(op.path);
        const oldValue = segs.length === 0 ? cloneDeep(current) : cloneDeep(getAt(current, segs));
        inverse.push({ op: 'replace', path: op.path, value: oldValue });
        break;
      }
      case 'move': {
        // Inverse of move is move back
        inverse.push({ op: 'move', from: op.path, path: op.from });
        break;
      }
      case 'copy': {
        // Inverse of copy is remove the destination
        inverse.push({ op: 'remove', path: op.path });
        break;
      }
      case 'test': {
        // test is its own inverse
        inverse.push({ ...op });
        break;
      }
    }
    // Advance current state so subsequent ops see the correct pre-state.
    try {
      current = applyOp(current, op);
    } catch {
      // If an op can't be applied we stop collecting state — remaining ops
      // will invert using whatever state we have accumulated.
    }
  }

  return inverse.reverse();
}

// ─── Re-export pointer helpers for tests ─────────────────────────────────────
export { buildPointer, parsePointer };
