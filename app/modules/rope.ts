// @ts-check
// ─── Rope Data Structure ────────────────────────────────────────────────────
// A balanced binary tree of string fragments for efficient insert/delete on
// large texts.  Every mutation returns a new Rope (persistent / immutable).

// ─── Internal node representation ───────────────────────────────────────────

interface RopeNode {
  left: RopeNode | null;
  right: RopeNode | null;
  /** Text stored only in leaf nodes. */
  text: string | null;
  /** Total character weight of the left subtree (or leaf length). */
  weight: number;
  /** Total length of all text under this node. */
  length: number;
}

function leafNode(text: string): RopeNode {
  return { left: null, right: null, text, weight: text.length, length: text.length };
}

function branchNode(left: RopeNode, right: RopeNode): RopeNode {
  return {
    left,
    right,
    text: null,
    weight: left.length,
    length: left.length + right.length,
  };
}

/** Threshold below which we keep a single leaf. */
const LEAF_MAX = 512;

function buildBalanced(str: string): RopeNode {
  if (str.length <= LEAF_MAX) return leafNode(str);
  const mid = Math.floor(str.length / 2);
  return branchNode(buildBalanced(str.slice(0, mid)), buildBalanced(str.slice(mid)));
}

// ─── Collect full text ──────────────────────────────────────────────────────

function collectText(node: RopeNode | null, parts: string[]): void {
  if (!node) return;
  if (node.text !== null) {
    parts.push(node.text);
    return;
  }
  collectText(node.left, parts);
  collectText(node.right, parts);
}

// ─── charAt ─────────────────────────────────────────────────────────────────

function charAtNode(node: RopeNode, index: number): string {
  if (node.text !== null) return node.text[index];
  if (index < node.weight) return charAtNode(node.left!, index);
  return charAtNode(node.right!, index - node.weight);
}

// ─── split ──────────────────────────────────────────────────────────────────

function splitNode(node: RopeNode, index: number): [RopeNode | null, RopeNode | null] {
  if (index <= 0) return [null, node];
  if (index >= node.length) return [node, null];

  if (node.text !== null) {
    const left = node.text.slice(0, index);
    const right = node.text.slice(index);
    return [left ? leafNode(left) : null, right ? leafNode(right) : null];
  }

  if (index < node.weight) {
    const [ll, lr] = splitNode(node.left!, index);
    const right = lr ? branchNode(lr, node.right!) : node.right!;
    return [ll, right];
  }
  if (index > node.weight) {
    const [rl, rr] = splitNode(node.right!, index - node.weight);
    const left = rl ? branchNode(node.left!, rl) : node.left!;
    return [left, rr];
  }
  // index === weight — split exactly at the boundary
  return [node.left, node.right];
}

// ─── concat nodes ───────────────────────────────────────────────────────────

function concatNodes(a: RopeNode | null, b: RopeNode | null): RopeNode {
  if (!a && !b) return leafNode('');
  if (!a) return b!;
  if (!b) return a;
  return branchNode(a, b);
}

// ─── Rope class ─────────────────────────────────────────────────────────────

export class Rope {
  /** @internal */
  private readonly root: RopeNode;

  constructor(input?: string | RopeNode) {
    if (input === undefined || input === null) {
      this.root = leafNode('');
    } else if (typeof input === 'string') {
      this.root = input.length === 0 ? leafNode('') : buildBalanced(input);
    } else {
      this.root = input;
    }
  }

  // ── accessors ───────────────────────────────────────────────────────────

  get length(): number {
    return this.root.length;
  }

  charAt(index: number): string {
    if (index < 0 || index >= this.root.length) return '';
    return charAtNode(this.root, index);
  }

  toString(): string {
    const parts: string[] = [];
    collectText(this.root, parts);
    return parts.join('');
  }

  // ── structural ops ────────────────────────────────────────────────────

  concat(other: Rope): Rope {
    return new Rope(concatNodes(this.root, other.root));
  }

  split(index: number): [Rope, Rope] {
    const [left, right] = splitNode(this.root, index);
    return [new Rope(left ?? leafNode('')), new Rope(right ?? leafNode(''))];
  }

  substring(start: number, end?: number): string {
    const s = Math.max(0, start);
    const e = end === undefined ? this.root.length : Math.min(end, this.root.length);
    if (s >= e) return '';
    // Split twice to isolate the range
    const [, rightOfStart] = splitNode(this.root, s);
    if (!rightOfStart) return '';
    const [middle] = splitNode(rightOfStart, e - s);
    if (!middle) return '';
    const parts: string[] = [];
    collectText(middle, parts);
    return parts.join('');
  }

  // ── mutation (returns new Rope) ────────────────────────────────────────

  insert(index: number, text: string): Rope {
    if (text.length === 0) return this;
    const [left, right] = splitNode(this.root, index);
    const middle = buildBalanced(text);
    return new Rope(concatNodes(concatNodes(left, middle), right));
  }

  delete(start: number, end: number): Rope {
    const s = Math.max(0, start);
    const e = Math.min(end, this.root.length);
    if (s >= e) return this;
    const [left] = splitNode(this.root, s);
    const [, right] = splitNode(this.root, e);
    return new Rope(concatNodes(left, right));
  }

  // ── search ─────────────────────────────────────────────────────────────

  indexOf(str: string): number {
    // Simple approach: materialise and delegate.  For a production Rope we
    // would walk the tree, but correctness first.
    return this.toString().indexOf(str);
  }

  // ── line access ────────────────────────────────────────────────────────

  get lineCount(): number {
    const text = this.toString();
    if (text.length === 0) return 1;
    let count = 1;
    for (let i = 0; i < text.length; i++) {
      if (text[i] === '\n') count++;
    }
    return count;
  }

  lineAt(lineNumber: number): string {
    const text = this.toString();
    const lines = text.split('\n');
    if (lineNumber < 0 || lineNumber >= lines.length) return '';
    return lines[lineNumber];
  }
}

// ─── Factory ────────────────────────────────────────────────────────────────

export function createRope(str?: string): Rope {
  return new Rope(str);
}
