// @ts-check
// ─── Arithmetic Expression Parser / Evaluator ────────────────────────────────
// Supports: +, -, *, /, ^ (right-associative power), unary minus,
// parentheses, numeric literals, and named variable substitution.
//
// Operator precedence (highest to lowest):
//   ^ (right-associative) > unary - > * / > + -

// ─── Token ───────────────────────────────────────────────────────────────────

/** A single lexical unit produced by the tokenizer. */
export interface Token {
  type: 'number' | 'op' | 'lparen' | 'rparen' | 'ident';
  value: string;
}

// ─── AST Nodes ────────────────────────────────────────────────────────────────

/** A numeric literal node. */
export interface NumberNode {
  type: 'number';
  value: number;
}

/** A binary operation node (+, -, *, /, ^). */
export interface BinaryNode {
  type: 'binary';
  op: string;
  left: ASTNode;
  right: ASTNode;
}

/** A unary operation node (negation). */
export interface UnaryNode {
  type: 'unary';
  op: string;
  operand: ASTNode;
}

/** A variable reference node. */
export interface VariableNode {
  type: 'variable';
  name: string;
}

/** Discriminated union of all AST node variants. */
export type ASTNode = NumberNode | BinaryNode | UnaryNode | VariableNode;

// ─── Error ────────────────────────────────────────────────────────────────────

/** Thrown for any invalid expression — syntax errors, unknown variables, division by zero, etc. */
export class ExpressionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExpressionError';
  }
}

// ─── Tokenizer ────────────────────────────────────────────────────────────────

const OPERATORS = new Set(['+', '-', '*', '/', '^']);

/**
 * Convert an expression string into an ordered array of tokens.
 * Whitespace is ignored. Throws `ExpressionError` on unrecognised characters.
 *
 * @param expr - The raw expression string.
 * @returns Array of `Token` objects.
 */
export function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < expr.length) {
    const ch = expr[i];

    // Skip whitespace
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      i++;
      continue;
    }

    // Numeric literal — integer or decimal, with optional exponent
    if ((ch >= '0' && ch <= '9') || (ch === '.' && i + 1 < expr.length && expr[i + 1] >= '0' && expr[i + 1] <= '9')) {
      const start = i;
      while (i < expr.length && ((expr[i] >= '0' && expr[i] <= '9') || expr[i] === '.')) {
        i++;
      }
      // Optional scientific notation exponent
      if (i < expr.length && (expr[i] === 'e' || expr[i] === 'E')) {
        i++;
        if (i < expr.length && (expr[i] === '+' || expr[i] === '-')) i++;
        while (i < expr.length && expr[i] >= '0' && expr[i] <= '9') i++;
      }
      tokens.push({ type: 'number', value: expr.slice(start, i) });
      continue;
    }

    // Identifier — letter or underscore followed by letters/digits/underscores
    if (ch === '_' || (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z')) {
      const start = i;
      while (
        i < expr.length &&
        (expr[i] === '_' ||
          (expr[i] >= 'a' && expr[i] <= 'z') ||
          (expr[i] >= 'A' && expr[i] <= 'Z') ||
          (expr[i] >= '0' && expr[i] <= '9'))
      ) {
        i++;
      }
      tokens.push({ type: 'ident', value: expr.slice(start, i) });
      continue;
    }

    if (ch === '(') { tokens.push({ type: 'lparen', value: '(' }); i++; continue; }
    if (ch === ')') { tokens.push({ type: 'rparen', value: ')' }); i++; continue; }

    if (OPERATORS.has(ch)) {
      tokens.push({ type: 'op', value: ch });
      i++;
      continue;
    }

    throw new ExpressionError(`Unexpected character '${ch}' at position ${i}`);
  }

  return tokens;
}

// ─── Parser (recursive-descent with correct precedence) ──────────────────────
//
// Grammar:
//   expr           = additive
//   additive       = multiplicative (('+' | '-') multiplicative)*
//   multiplicative = unary          (('*' | '/') unary)*
//   unary          = '-' unary | power
//   power          = primary ('^' unary)?   ← right-associative
//   primary        = NUMBER | IDENT | '(' expr ')'

class Parser {
  #tokens: Token[];
  #pos: number = 0;

  constructor(tokens: Token[]) {
    this.#tokens = tokens;
  }

  #peek(): Token | undefined {
    return this.#tokens[this.#pos];
  }

  #consume(): Token {
    const tok = this.#tokens[this.#pos];
    if (tok === undefined) throw new ExpressionError('Unexpected end of expression');
    this.#pos++;
    return tok;
  }

  #expectRparen(): void {
    const tok = this.#consume();
    if (tok.type !== 'rparen') {
      throw new ExpressionError(`Expected ')' but got '${tok.value}'`);
    }
  }

  // additive = multiplicative (('+' | '-') multiplicative)*
  #parseAdditive(): ASTNode {
    let left = this.#parseMultiplicative();
    let tok = this.#peek();
    while (tok?.type === 'op' && (tok.value === '+' || tok.value === '-')) {
      const op = this.#consume().value;
      const right = this.#parseMultiplicative();
      left = { type: 'binary', op, left, right };
      tok = this.#peek();
    }
    return left;
  }

  // multiplicative = unary (('*' | '/') unary)*
  #parseMultiplicative(): ASTNode {
    let left = this.#parseUnary();
    let tok = this.#peek();
    while (tok?.type === 'op' && (tok.value === '*' || tok.value === '/')) {
      const op = this.#consume().value;
      const right = this.#parseUnary();
      left = { type: 'binary', op, left, right };
      tok = this.#peek();
    }
    return left;
  }

  // unary = '-' unary | power
  #parseUnary(): ASTNode {
    const tok = this.#peek();
    if (tok?.type === 'op' && tok.value === '-') {
      this.#consume();
      const operand = this.#parseUnary();
      return { type: 'unary', op: '-', operand };
    }
    // Unary plus — consume and discard
    if (tok?.type === 'op' && tok.value === '+') {
      this.#consume();
      return this.#parseUnary();
    }
    return this.#parsePower();
  }

  // power = primary ('^' unary)?   right-associative
  #parsePower(): ASTNode {
    const base = this.#parsePrimary();
    const tok = this.#peek();
    if (tok?.type === 'op' && tok.value === '^') {
      this.#consume();
      // Recurse into #parseUnary for right-associativity: 2^3^2 = 2^(3^2)
      const exponent = this.#parseUnary();
      return { type: 'binary', op: '^', left: base, right: exponent };
    }
    return base;
  }

  // primary = NUMBER | IDENT | '(' expr ')'
  #parsePrimary(): ASTNode {
    const tok = this.#peek();
    if (tok === undefined) {
      throw new ExpressionError('Unexpected end of expression — expected a value');
    }

    // Parenthesised sub-expression
    if (tok.type === 'lparen') {
      this.#consume();
      const inner = this.#parseAdditive();
      this.#expectRparen();
      return inner;
    }

    // Numeric literal
    if (tok.type === 'number') {
      this.#consume();
      const n = Number(tok.value);
      if (Number.isNaN(n)) throw new ExpressionError(`Invalid number literal '${tok.value}'`);
      return { type: 'number', value: n };
    }

    // Identifier → variable reference
    if (tok.type === 'ident') {
      this.#consume();
      return { type: 'variable', name: tok.value };
    }

    throw new ExpressionError(`Unexpected token '${tok.value}' (${tok.type})`);
  }

  /** Parse the full token stream and return the root AST node. */
  parse(): ASTNode {
    if (this.#tokens.length === 0) throw new ExpressionError('Empty expression');
    const ast = this.#parseAdditive();
    const leftover = this.#peek();
    if (leftover !== undefined) {
      throw new ExpressionError(`Unexpected token '${leftover.value}'`);
    }
    return ast;
  }
}

// ─── Public: parse() ─────────────────────────────────────────────────────────

/**
 * Parse an arithmetic expression string into an AST.
 * Throws `ExpressionError` on syntax errors or empty input.
 *
 * @param expr - The expression to parse, e.g. `"2 + x * 3"`.
 * @returns Root `ASTNode` of the abstract syntax tree.
 */
export function parse(expr: string): ASTNode {
  return new Parser(tokenize(expr)).parse();
}

// ─── AST Evaluator ───────────────────────────────────────────────────────────

function evalNode(node: ASTNode, vars: Record<string, number>): number {
  switch (node.type) {
    case 'number':
      return node.value;

    case 'variable': {
      if (!Object.prototype.hasOwnProperty.call(vars, node.name)) {
        throw new ExpressionError(`Undefined variable '${node.name}'`);
      }
      return vars[node.name];
    }

    case 'unary': {
      const val = evalNode(node.operand, vars);
      if (node.op === '-') return -val;
      throw new ExpressionError(`Unknown unary operator '${node.op}'`);
    }

    case 'binary': {
      const l = evalNode(node.left, vars);
      const r = evalNode(node.right, vars);
      switch (node.op) {
        case '+': return l + r;
        case '-': return l - r;
        case '*': return l * r;
        case '/':
          if (r === 0) throw new ExpressionError('Division by zero');
          return l / r;
        case '^': return Math.pow(l, r);
        default:
          throw new ExpressionError(`Unknown operator '${node.op}'`);
      }
    }
  }
}

// ─── Public: evaluate() ──────────────────────────────────────────────────────

/**
 * Parse and evaluate an arithmetic expression string in one step.
 * Supports +, -, *, /, ^ (power), unary minus, parentheses, and variables.
 *
 * @param expr - The expression to evaluate, e.g. `"2 + x * 3"`.
 * @param vars - Optional map of variable names to numeric values.
 * @returns The numeric result.
 * @throws {ExpressionError} on syntax errors, undefined variables, or division by zero.
 */
export function evaluate(expr: string, vars: Record<string, number> = {}): number {
  return evalNode(parse(expr), vars);
}
