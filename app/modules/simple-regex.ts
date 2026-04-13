// @ts-check
// ─── Simple Regular Expression Engine ────────────────────────────────────────
// Recursive backtracking regex engine supporting:
//   literals, . (any char), * + ? (quantifiers), | (alternation), () grouping,
//   ^ $ (anchors)

// ─── AST Node Types ──────────────────────────────────────────────────────────

type RegexNode =
  | { kind: 'literal'; char: string }
  | { kind: 'any' }
  | { kind: 'concat'; left: RegexNode; right: RegexNode }
  | { kind: 'alt'; left: RegexNode; right: RegexNode }
  | { kind: 'star'; child: RegexNode }
  | { kind: 'plus'; child: RegexNode }
  | { kind: 'question'; child: RegexNode }
  | { kind: 'anchor_start' }
  | { kind: 'anchor_end' };

// ─── Parser ──────────────────────────────────────────────────────────────────

class Parser {
  readonly #src: string;
  #pos: number;

  constructor(src: string) {
    this.#src = src;
    this.#pos = 0;
  }

  #peek(): string | undefined {
    return this.#src[this.#pos];
  }

  #consume(): string {
    return this.#src[this.#pos++];
  }

  #atEnd(): boolean {
    return this.#pos >= this.#src.length;
  }

  /** Top-level: alternation */
  parseExpr(): RegexNode {
    let node = this.parseConcat();
    while (this.#peek() === '|') {
      this.#consume(); // eat '|'
      const right = this.parseConcat();
      node = { kind: 'alt', left: node, right };
    }
    return node;
  }

  /** Concatenation */
  parseConcat(): RegexNode {
    const nodes: RegexNode[] = [];
    while (!this.#atEnd() && this.#peek() !== ')' && this.#peek() !== '|') {
      nodes.push(this.parseQuantified());
    }
    if (nodes.length === 0) return { kind: 'literal', char: '' };
    return nodes.reduce((a, b) => ({ kind: 'concat', left: a, right: b }));
  }

  /** Quantifier wrapping: *, +, ? */
  parseQuantified(): RegexNode {
    const base = this.parseAtom();
    const ch = this.#peek();
    if (ch === '*') { this.#consume(); return { kind: 'star', child: base }; }
    if (ch === '+') { this.#consume(); return { kind: 'plus', child: base }; }
    if (ch === '?') { this.#consume(); return { kind: 'question', child: base }; }
    return base;
  }

  /** Atomic element */
  parseAtom(): RegexNode {
    const ch = this.#peek();
    if (ch === '(') {
      this.#consume(); // eat '('
      const inner = this.parseExpr();
      if (this.#peek() === ')') this.#consume(); // eat ')'
      return inner;
    }
    if (ch === '.') { this.#consume(); return { kind: 'any' }; }
    if (ch === '^') { this.#consume(); return { kind: 'anchor_start' }; }
    if (ch === '$') { this.#consume(); return { kind: 'anchor_end' }; }
    if (ch === '\\') {
      this.#consume(); // eat backslash
      const escaped = this.#consume();
      return { kind: 'literal', char: escaped };
    }
    this.#consume();
    return { kind: 'literal', char: ch ?? '' };
  }
}

// ─── Continuation-passing backtracking engine ─────────────────────────────────
// Each matchWith call tries to match `node` starting at `pos`, then calls
// `cont(endPos)` with every possible end position.  The continuation returns
// true if the rest of the pattern succeeds, enabling full backtracking.

type Cont = (pos: number) => boolean;

/** The trivial success continuation: always succeeds. */
const succeed: Cont = () => true;

/**
 * Try to match `node` at `pos` in `text`.
 * Calls `cont` with each candidate end position (greedy first).
 * Returns true if any path to success exists.
 */
function matchWith(node: RegexNode, text: string, pos: number, cont: Cont): boolean {
  switch (node.kind) {

    case 'anchor_start':
      return pos === 0 && cont(pos);

    case 'anchor_end':
      return pos === text.length && cont(pos);

    case 'literal': {
      if (node.char === '') return cont(pos); // empty literal from empty group
      if (pos < text.length && text[pos] === node.char) return cont(pos + 1);
      return false;
    }

    case 'any': {
      if (pos < text.length) return cont(pos + 1);
      return false;
    }

    case 'concat': {
      return matchWith(node.left, text, pos, mid =>
        matchWith(node.right, text, mid, cont),
      );
    }

    case 'alt': {
      return (
        matchWith(node.left, text, pos, cont) ||
        matchWith(node.right, text, pos, cont)
      );
    }

    case 'star': {
      // Greedy: collect all possible positions first, then try longest to shortest
      const positions: number[] = [pos];
      let cur = pos;
      while (true) {
        let advanced = -1;
        matchWith(node.child, text, cur, next => {
          if (next > cur) { advanced = next; return true; }
          return false;
        });
        if (advanced === -1) break;
        cur = advanced;
        positions.push(cur);
      }
      // Try from longest match downward (greedy with backtracking)
      for (let i = positions.length - 1; i >= 0; i--) {
        if (cont(positions[i])) return true;
      }
      return false;
    }

    case 'plus': {
      // At least one: match child once, then behave like star
      return matchWith(node.child, text, pos, mid => {
        if (mid === pos) return false; // no progress
        return matchWith({ kind: 'star', child: node.child }, text, mid, cont);
      });
    }

    case 'question': {
      // Greedy: try with child first, then without
      return (
        matchWith(node.child, text, pos, cont) ||
        cont(pos)
      );
    }

    default:
      return false;
  }
}

// ─── Anchor extraction ────────────────────────────────────────────────────────

interface AnchorInfo {
  anchorStart: boolean;
  anchorEnd: boolean;
  inner: RegexNode;
}

function extractAnchors(node: RegexNode): AnchorInfo {
  let anchorStart = false;
  let anchorEnd = false;
  let inner = node;

  // Peel leading ^ from concat chain
  if (inner.kind === 'concat' && inner.left.kind === 'anchor_start') {
    anchorStart = true;
    inner = inner.right;
  } else if (inner.kind === 'anchor_start') {
    anchorStart = true;
    inner = { kind: 'literal', char: '' };
  }

  // Peel trailing $ from concat chain
  if (inner.kind === 'concat' && inner.right.kind === 'anchor_end') {
    anchorEnd = true;
    inner = inner.left;
  } else if (inner.kind === 'anchor_end') {
    anchorEnd = true;
    inner = { kind: 'literal', char: '' };
  }

  return { anchorStart, anchorEnd, inner };
}

// ─── Match result type ────────────────────────────────────────────────────────

export interface RegexMatch {
  index: number;
  length: number;
  value: string;
}

// ─── SimpleRegex ─────────────────────────────────────────────────────────────

export class SimpleRegex {
  readonly #ast: RegexNode;
  readonly #anchorStart: boolean;
  readonly #anchorEnd: boolean;
  readonly #pattern: string;

  constructor(pattern: string) {
    this.#pattern = pattern;
    const parser = new Parser(pattern);
    const raw = parser.parseExpr();
    const { anchorStart, anchorEnd, inner } = extractAnchors(raw);
    this.#anchorStart = anchorStart;
    this.#anchorEnd = anchorEnd;
    this.#ast = inner;
  }

  /**
   * Try to match starting at `start`.
   * Returns the greedy end position, or -1 if no match.
   */
  #tryAt(text: string, start: number): number {
    let result = -1;
    matchWith(this.#ast, text, start, end => {
      if (this.#anchorEnd && end !== text.length) return false;
      result = end;
      return true; // take the first (greedy) success
    });
    return result;
  }

  /** Test if pattern matches anywhere in text (like /pattern/.test(text)). */
  test(text: string): boolean {
    return this.match(text) !== null;
  }

  /** Find first match in text. Returns null if no match. */
  match(text: string): RegexMatch | null {
    const startRange = this.#anchorStart ? [0] : range(text.length + 1);
    for (const i of startRange) {
      const end = this.#tryAt(text, i);
      if (end !== -1) {
        return { index: i, length: end - i, value: text.slice(i, end) };
      }
    }
    return null;
  }

  /** Find all non-overlapping matches. */
  matchAll(text: string): RegexMatch[] {
    const results: RegexMatch[] = [];
    let i = 0;
    while (i <= text.length) {
      if (this.#anchorStart && i > 0) break;
      const end = this.#tryAt(text, i);
      if (end !== -1) {
        results.push({ index: i, length: end - i, value: text.slice(i, end) });
        // Advance past this match; avoid infinite loop on zero-length match
        i = end > i ? end : i + 1;
      } else {
        i++;
      }
    }
    return results;
  }

  toString(): string {
    return `/${this.#pattern}/`;
  }
}

function range(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i);
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/** Compile a pattern string into a SimpleRegex. */
export function compileRegex(pattern: string): SimpleRegex {
  return new SimpleRegex(pattern);
}
