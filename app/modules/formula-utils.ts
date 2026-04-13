// @ts-check
// ─── Formula Utilities ───────────────────────────────────────────────────────
// Spreadsheet-like formula evaluation: cell references, ranges, and functions.
// No browser APIs — pure logic.

// ─── Types ───────────────────────────────────────────────────────────────────

export type CellValue = number | string | boolean | null;

export interface FormulaContext {
  cells?: Record<string, CellValue>;             // 'A1', 'B2', etc.
  range?: (startCell: string, endCell: string) => CellValue[];
}

// ─── Cell reference helpers ──────────────────────────────────────────────────

const CELL_REF_RE = /^([A-Za-z]+)([0-9]+)$/;

/** Parse a cell reference like 'A1' → { col: 0, row: 0 }. */
export function parseCellRef(ref: string): { col: number; row: number } | null {
  const m = CELL_REF_RE.exec(ref);
  if (!m) return null;
  return {
    col: letterToCol(m[1].toUpperCase()),
    row: parseInt(m[2], 10) - 1,
  };
}

/** Convert column index to letter(s): 0 → 'A', 25 → 'Z', 26 → 'AA'. */
export function colToLetter(col: number): string {
  if (col < 0) throw new RangeError(`Column index must be >= 0, got ${col}`);
  let result = '';
  let n = col;
  do {
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return result;
}

/** Convert letter(s) to column index: 'A' → 0, 'Z' → 25, 'AA' → 26. */
export function letterToCol(letter: string): number {
  const upper = letter.toUpperCase();
  let result = 0;
  for (let i = 0; i < upper.length; i++) {
    result = result * 26 + (upper.charCodeAt(i) - 64);
  }
  return result - 1;
}

// ─── Formula tokeniser ───────────────────────────────────────────────────────

type FTokenType =
  | 'number'
  | 'string'
  | 'bool'
  | 'ident'
  | 'plus'
  | 'minus'
  | 'star'
  | 'slash'
  | 'percent'
  | 'caret'
  | 'lt'
  | 'lte'
  | 'gt'
  | 'gte'
  | 'eq'
  | 'neq'
  | 'amp'
  | 'lparen'
  | 'rparen'
  | 'comma'
  | 'eof';

interface FToken {
  type: FTokenType;
  raw: string;
}

function tokeniseFormula(src: string): FToken[] {
  const tokens: FToken[] = [];
  let i = 0;

  while (i < src.length) {
    const ch = src[i];

    if (/\s/.test(ch)) { i++; continue; }

    // String literal
    if (ch === '"') {
      let s = '';
      i++;
      while (i < src.length && src[i] !== '"') {
        if (src[i] === '\\' && i + 1 < src.length) { i++; }
        s += src[i++];
      }
      if (src[i] === '"') i++;
      tokens.push({ type: 'string', raw: s });
      continue;
    }

    // Number
    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(src[i + 1] ?? ''))) {
      let num = '';
      while (i < src.length && /[0-9.]/.test(src[i])) num += src[i++];
      tokens.push({ type: 'number', raw: num });
      continue;
    }

    // Identifier or boolean literal
    if (/[a-zA-Z_]/.test(ch)) {
      let id = '';
      while (i < src.length && /[a-zA-Z_0-9]/.test(src[i])) id += src[i++];
      const upper = id.toUpperCase();
      if (upper === 'TRUE' || upper === 'FALSE') {
        tokens.push({ type: 'bool', raw: upper });
      } else {
        tokens.push({ type: 'ident', raw: id });
      }
      continue;
    }

    // Multi-char operators
    if (ch === '<') {
      if (src[i + 1] === '=') { tokens.push({ type: 'lte', raw: '<=' }); i += 2; }
      else if (src[i + 1] === '>') { tokens.push({ type: 'neq', raw: '<>' }); i += 2; }
      else { tokens.push({ type: 'lt', raw: '<' }); i++; }
      continue;
    }
    if (ch === '>') {
      if (src[i + 1] === '=') { tokens.push({ type: 'gte', raw: '>=' }); i += 2; }
      else { tokens.push({ type: 'gt', raw: '>' }); i++; }
      continue;
    }

    switch (ch) {
      case '+': tokens.push({ type: 'plus',    raw: ch }); break;
      case '-': tokens.push({ type: 'minus',   raw: ch }); break;
      case '*': tokens.push({ type: 'star',    raw: ch }); break;
      case '/': tokens.push({ type: 'slash',   raw: ch }); break;
      case '%': tokens.push({ type: 'percent', raw: ch }); break;
      case '^': tokens.push({ type: 'caret',   raw: ch }); break;
      case '=': tokens.push({ type: 'eq',      raw: ch }); break;
      case '&': tokens.push({ type: 'amp',     raw: ch }); break;
      case '(': tokens.push({ type: 'lparen',  raw: ch }); break;
      case ')': tokens.push({ type: 'rparen',  raw: ch }); break;
      case ',': tokens.push({ type: 'comma',   raw: ch }); break;
      default: throw new SyntaxError(`Unexpected character in formula: ${ch}`);
    }
    i++;
  }

  tokens.push({ type: 'eof', raw: '' });
  return tokens;
}

// ─── Formula parser / evaluator ──────────────────────────────────────────────
// We evaluate directly during parsing for simplicity.

class FormulaEvaluator {
  private tokens: FToken[];
  private pos: number;
  private ctx: FormulaContext;

  constructor(tokens: FToken[], ctx: FormulaContext) {
    this.tokens = tokens;
    this.pos = 0;
    this.ctx = ctx;
  }

  private peek(): FToken { return this.tokens[this.pos]; }
  private consume(): FToken { return this.tokens[this.pos++]; }

  private expect(type: FTokenType): FToken {
    const tok = this.consume();
    if (tok.type !== type) {
      throw new SyntaxError(`Expected ${type} but got ${tok.type} ("${tok.raw}")`);
    }
    return tok;
  }

  eval(): CellValue {
    const val = this.evalComparison();
    if (this.peek().type !== 'eof') {
      throw new SyntaxError(`Unexpected token: "${this.peek().raw}"`);
    }
    return val;
  }

  private evalComparison(): CellValue {
    let left = this.evalConcat();

    const COMPARISON_TYPES: FTokenType[] = ['lt', 'lte', 'gt', 'gte', 'eq', 'neq'];
    while (COMPARISON_TYPES.includes(this.peek().type)) {
      const op = this.consume().raw;
      const right = this.evalConcat();
      const l = left;
      const r = right;
      switch (op) {
        case '<':  left = (l as number) <  (r as number); break;
        case '<=': left = (l as number) <= (r as number); break;
        case '>':  left = (l as number) >  (r as number); break;
        case '>=': left = (l as number) >= (r as number); break;
        case '=':  left = l === r; break;
        case '<>': left = l !== r; break;
      }
    }

    return left;
  }

  private evalConcat(): CellValue {
    let left = this.evalAdditive();

    while (this.peek().type === 'amp') {
      this.consume();
      const right = this.evalAdditive();
      left = String(left ?? '') + String(right ?? '');
    }

    return left;
  }

  private evalAdditive(): CellValue {
    let left = this.evalMultiplicative();

    while (this.peek().type === 'plus' || this.peek().type === 'minus') {
      const op = this.consume().raw;
      const right = this.evalMultiplicative();
      if (op === '+') left = (left as number) + (right as number);
      else            left = (left as number) - (right as number);
    }

    return left;
  }

  private evalMultiplicative(): CellValue {
    let left = this.evalPower();

    while (
      this.peek().type === 'star' ||
      this.peek().type === 'slash' ||
      this.peek().type === 'percent'
    ) {
      const op = this.consume().raw;
      const right = this.evalPower();
      if (op === '*') left = (left as number) * (right as number);
      else if (op === '/') left = (left as number) / (right as number);
      else left = (left as number) % (right as number);
    }

    return left;
  }

  private evalPower(): CellValue {
    const base = this.evalUnary();

    if (this.peek().type === 'caret') {
      this.consume();
      const exp = this.evalPower(); // right-associative
      return Math.pow(base as number, exp as number);
    }

    return base;
  }

  private evalUnary(): CellValue {
    if (this.peek().type === 'minus') {
      this.consume();
      return -(this.evalUnary() as number);
    }
    return this.evalPrimary();
  }

  private evalPrimary(): CellValue {
    const tok = this.peek();

    if (tok.type === 'number') {
      this.consume();
      return parseFloat(tok.raw);
    }

    if (tok.type === 'string') {
      this.consume();
      return tok.raw;
    }

    if (tok.type === 'bool') {
      this.consume();
      return tok.raw === 'TRUE';
    }

    if (tok.type === 'ident') {
      this.consume();

      // Function call
      if (this.peek().type === 'lparen') {
        this.consume();
        const args: CellValue[] = [];
        if (this.peek().type !== 'rparen') {
          args.push(this.evalComparison());
          while (this.peek().type === 'comma') {
            this.consume();
            args.push(this.evalComparison());
          }
        }
        this.expect('rparen');
        return callFunction(tok.raw.toUpperCase(), args);
      }

      // Cell reference (e.g. A1, B10)
      if (CELL_REF_RE.test(tok.raw)) {
        const cells = this.ctx.cells ?? {};
        const val = cells[tok.raw.toUpperCase()];
        return val !== undefined ? val : null;
      }

      throw new ReferenceError(`Unknown identifier: ${tok.raw}`);
    }

    if (tok.type === 'lparen') {
      this.consume();
      const val = this.evalComparison();
      this.expect('rparen');
      return val;
    }

    throw new SyntaxError(`Unexpected token in formula: "${tok.raw}" (${tok.type})`);
  }
}

// ─── Built-in spreadsheet functions ──────────────────────────────────────────

/** Supported functions: SUM, AVERAGE, MIN, MAX, COUNT, ROUND, IF, CONCAT, LEN, UPPER, LOWER */
export function callFunction(name: string, args: CellValue[]): CellValue {
  const nums = (): number[] => args.map((a) => Number(a));

  switch (name.toUpperCase()) {
    case 'SUM':
      return nums().reduce((acc, n) => acc + n, 0);

    case 'AVERAGE': {
      if (args.length === 0) return 0;
      return nums().reduce((acc, n) => acc + n, 0) / args.length;
    }

    case 'MIN':
      if (args.length === 0) return 0;
      return Math.min(...nums());

    case 'MAX':
      if (args.length === 0) return 0;
      return Math.max(...nums());

    case 'COUNT':
      return args.filter((a) => typeof a === 'number' || (typeof a === 'string' && a !== '' && !isNaN(Number(a)))).length;

    case 'ROUND': {
      const [val, digits = 0] = nums();
      const factor = Math.pow(10, digits);
      return Math.round(val * factor) / factor;
    }

    case 'IF': {
      const [cond, thenVal, elseVal = null] = args;
      return cond ? thenVal : elseVal;
    }

    case 'CONCAT':
      return args.map((a) => String(a ?? '')).join('');

    case 'LEN':
      return String(args[0] ?? '').length;

    case 'UPPER':
      return String(args[0] ?? '').toUpperCase();

    case 'LOWER':
      return String(args[0] ?? '').toLowerCase();

    default:
      throw new ReferenceError(`Unknown function: ${name}`);
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/** Evaluate a spreadsheet formula (starts with =). */
export function evaluateFormula(formula: string, ctx: FormulaContext = {}): CellValue {
  const src = formula.startsWith('=') ? formula.slice(1) : formula;
  const tokens = tokeniseFormula(src);
  const evaluator = new FormulaEvaluator(tokens, ctx);
  return evaluator.eval();
}
