// @ts-check
// ─── Expression Parser ───────────────────────────────────────────────────────
// Recursive-descent parser and evaluator for mathematical expressions.
// No browser APIs — pure logic.

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ParseNode {
  type: 'number' | 'variable' | 'binary' | 'unary' | 'call';
  value?: number;       // for 'number'
  name?: string;        // for 'variable' or 'call'
  op?: string;          // for 'binary' or 'unary'
  left?: ParseNode;     // for 'binary'
  right?: ParseNode;    // for 'binary'
  operand?: ParseNode;  // for 'unary'
  args?: ParseNode[];   // for 'call'
}

// ─── Tokeniser ───────────────────────────────────────────────────────────────

type TokenType =
  | 'number'
  | 'ident'
  | 'plus'
  | 'minus'
  | 'star'
  | 'slash'
  | 'percent'
  | 'caret'
  | 'lparen'
  | 'rparen'
  | 'comma'
  | 'eof';

interface Token {
  type: TokenType;
  value: string;
}

function tokenise(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < expr.length) {
    const ch = expr[i];

    // Whitespace
    if (/\s/.test(ch)) { i++; continue; }

    // Number (integer or decimal)
    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(expr[i + 1] ?? ''))) {
      let num = '';
      while (i < expr.length && /[0-9.]/.test(expr[i])) num += expr[i++];
      tokens.push({ type: 'number', value: num });
      continue;
    }

    // Identifier
    if (/[a-zA-Z_]/.test(ch)) {
      let ident = '';
      while (i < expr.length && /[a-zA-Z_0-9]/.test(expr[i])) ident += expr[i++];
      tokens.push({ type: 'ident', value: ident });
      continue;
    }

    // Operators and punctuation
    switch (ch) {
      case '+': tokens.push({ type: 'plus',    value: ch }); break;
      case '-': tokens.push({ type: 'minus',   value: ch }); break;
      case '*': tokens.push({ type: 'star',    value: ch }); break;
      case '/': tokens.push({ type: 'slash',   value: ch }); break;
      case '%': tokens.push({ type: 'percent', value: ch }); break;
      case '^': tokens.push({ type: 'caret',   value: ch }); break;
      case '(': tokens.push({ type: 'lparen',  value: ch }); break;
      case ')': tokens.push({ type: 'rparen',  value: ch }); break;
      case ',': tokens.push({ type: 'comma',   value: ch }); break;
      default: throw new SyntaxError(`Unexpected character: ${ch}`);
    }
    i++;
  }

  tokens.push({ type: 'eof', value: '' });
  return tokens;
}

// ─── Parser ──────────────────────────────────────────────────────────────────
// Grammar (lowest → highest precedence):
//   expr       = additive
//   additive   = multiplicative (('+' | '-') multiplicative)*
//   multiplicative = power (('*' | '/' | '%') power)*
//   power      = unary ('^' unary)*     (right-associative)
//   unary      = '-' unary | primary
//   primary    = NUMBER | IDENT | IDENT '(' args ')' | '(' expr ')'

class Parser {
  private tokens: Token[];
  private pos: number;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
    this.pos = 0;
  }

  private peek(): Token {
    return this.tokens[this.pos];
  }

  private consume(): Token {
    return this.tokens[this.pos++];
  }

  private expect(type: TokenType): Token {
    const tok = this.consume();
    if (tok.type !== type) {
      throw new SyntaxError(`Expected ${type} but got ${tok.type} ("${tok.value}")`);
    }
    return tok;
  }

  parse(): ParseNode {
    const node = this.parseAdditive();
    if (this.peek().type !== 'eof') {
      throw new SyntaxError(`Unexpected token: "${this.peek().value}"`);
    }
    return node;
  }

  private parseAdditive(): ParseNode {
    let left = this.parseMultiplicative();

    while (this.peek().type === 'plus' || this.peek().type === 'minus') {
      const op = this.consume().value;
      const right = this.parseMultiplicative();
      left = { type: 'binary', op, left, right };
    }

    return left;
  }

  private parseMultiplicative(): ParseNode {
    let left = this.parsePower();

    while (
      this.peek().type === 'star' ||
      this.peek().type === 'slash' ||
      this.peek().type === 'percent'
    ) {
      const op = this.consume().value;
      const right = this.parsePower();
      left = { type: 'binary', op, left, right };
    }

    return left;
  }

  private parsePower(): ParseNode {
    const base = this.parseUnary();

    if (this.peek().type === 'caret') {
      this.consume();
      // Right-associative: recurse into parsePower
      const exp = this.parsePower();
      return { type: 'binary', op: '^', left: base, right: exp };
    }

    return base;
  }

  private parseUnary(): ParseNode {
    if (this.peek().type === 'minus') {
      this.consume();
      const operand = this.parseUnary();
      return { type: 'unary', op: '-', operand };
    }

    return this.parsePrimary();
  }

  private parsePrimary(): ParseNode {
    const tok = this.peek();

    if (tok.type === 'number') {
      this.consume();
      return { type: 'number', value: parseFloat(tok.value) };
    }

    if (tok.type === 'ident') {
      this.consume();
      // Function call?
      if (this.peek().type === 'lparen') {
        this.consume(); // '('
        const args: ParseNode[] = [];
        if (this.peek().type !== 'rparen') {
          args.push(this.parseAdditive());
          while (this.peek().type === 'comma') {
            this.consume();
            args.push(this.parseAdditive());
          }
        }
        this.expect('rparen');
        return { type: 'call', name: tok.value, args };
      }
      return { type: 'variable', name: tok.value };
    }

    if (tok.type === 'lparen') {
      this.consume();
      const node = this.parseAdditive();
      this.expect('rparen');
      return node;
    }

    throw new SyntaxError(`Unexpected token: "${tok.value}" (${tok.type})`);
  }
}

// ─── Built-in functions ──────────────────────────────────────────────────────

const BUILTINS: Record<string, (...args: number[]) => number> = {
  abs:   (x) => Math.abs(x),
  sqrt:  (x) => Math.sqrt(x),
  sin:   (x) => Math.sin(x),
  cos:   (x) => Math.cos(x),
  tan:   (x) => Math.tan(x),
  log:   (x) => Math.log(x),
  floor: (x) => Math.floor(x),
  ceil:  (x) => Math.ceil(x),
  round: (x) => Math.round(x),
  max:   (a, b) => Math.max(a, b),
  min:   (a, b) => Math.min(a, b),
};

// ─── Public API ──────────────────────────────────────────────────────────────

/** Parse an expression string into an AST. Throws on syntax error. */
export function parseExpression(expr: string): ParseNode {
  const tokens = tokenise(expr);
  const parser = new Parser(tokens);
  return parser.parse();
}

/** Evaluate a parsed AST with variable bindings. */
export function evaluateAST(node: ParseNode, vars: Record<string, number> = {}): number {
  switch (node.type) {
    case 'number':
      return node.value!;

    case 'variable': {
      const name = node.name!;
      if (!(name in vars)) throw new ReferenceError(`Undefined variable: ${name}`);
      return vars[name];
    }

    case 'unary':
      if (node.op === '-') return -evaluateAST(node.operand!, vars);
      throw new Error(`Unknown unary operator: ${node.op}`);

    case 'binary': {
      const l = evaluateAST(node.left!, vars);
      const r = evaluateAST(node.right!, vars);
      switch (node.op) {
        case '+': return l + r;
        case '-': return l - r;
        case '*': return l * r;
        case '/': return l / r;
        case '%': return l % r;
        case '^': return Math.pow(l, r);
        default:  throw new Error(`Unknown binary operator: ${node.op}`);
      }
    }

    case 'call': {
      const fn = BUILTINS[node.name!];
      if (!fn) throw new ReferenceError(`Unknown function: ${node.name}`);
      const argVals = (node.args ?? []).map((a) => evaluateAST(a, vars));
      return fn(...argVals);
    }

    default:
      throw new Error(`Unknown node type: ${(node as ParseNode).type}`);
  }
}

/** Parse and evaluate in one step. */
export function evaluate(expr: string, vars?: Record<string, number>): number {
  return evaluateAST(parseExpression(expr), vars);
}
