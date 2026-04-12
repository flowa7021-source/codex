// @ts-check
// ─── Mathematical Expression Parser & Evaluator ──────────────────────────────
// Tokenizes, parses, and evaluates mathematical expressions with support for
// variables, built-in functions, constants, and correct operator precedence.
//
// Precedence (highest to lowest):
//   ^ (power, right-associative) > unary - > * / % > + -

// ─── Token ───────────────────────────────────────────────────────────────────

/** A single lexical token produced by the tokenizer. */
export interface Token {
  type: 'number' | 'operator' | 'lparen' | 'rparen' | 'identifier';
  value: string;
}

// ─── AST ─────────────────────────────────────────────────────────────────────

/** A numeric literal. */
export interface NumberNode {
  type: 'number';
  value: number;
}

/** A variable or constant reference. */
export interface IdentifierNode {
  type: 'identifier';
  name: string;
}

/** A binary operation (+, -, *, /, %, ^). */
export interface BinaryNode {
  type: 'binary';
  op: string;
  left: ASTNode;
  right: ASTNode;
}

/** A unary operation (negation). */
export interface UnaryNode {
  type: 'unary';
  op: string;
  operand: ASTNode;
}

/** A function call. */
export interface CallNode {
  type: 'call';
  name: string;
  args: ASTNode[];
}

/** Discriminated union of all AST node variants. */
export type ASTNode = NumberNode | IdentifierNode | BinaryNode | UnaryNode | CallNode;

// ─── Constants ───────────────────────────────────────────────────────────────

const CONSTANTS: Record<string, number> = {
  pi: Math.PI,
  e: Math.E,
};

// ─── Built-in Functions ──────────────────────────────────────────────────────

const FUNCTIONS: Record<string, (...args: number[]) => number> = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  sqrt: Math.sqrt,
  abs: Math.abs,
  floor: Math.floor,
  ceil: Math.ceil,
  round: Math.round,
  log: Math.log,
  exp: Math.exp,
  min: (...args) => Math.min(...args),
  max: (...args) => Math.max(...args),
};

// ─── Tokenizer ───────────────────────────────────────────────────────────────

/**
 * Convert an expression string into an ordered list of tokens.
 *
 * Token types:
 *   - `'number'`     — numeric literal (e.g. `3`, `3.14`)
 *   - `'identifier'` — variable, constant, or function name (e.g. `x`, `sin`)
 *   - `'operator'`   — `+`, `-`, `*`, `/`, `%`, `^`, or `,`
 *   - `'lparen'`     — `(`
 *   - `'rparen'`     — `)`
 *
 * @throws {SyntaxError} on unrecognised characters.
 */
export function tokenize(expression: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < expression.length) {
    const ch = expression[i];

    // Skip whitespace
    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    // Number literal (integer or float, including leading-dot form like .5)
    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(expression[i + 1] ?? ''))) {
      let num = '';
      while (i < expression.length && /[0-9.]/.test(expression[i])) {
        num += expression[i++];
      }
      tokens.push({ type: 'number', value: num });
      continue;
    }

    // Identifier (variable / function / constant)
    if (/[a-zA-Z_]/.test(ch)) {
      let ident = '';
      while (i < expression.length && /[a-zA-Z0-9_]/.test(expression[i])) {
        ident += expression[i++];
      }
      tokens.push({ type: 'identifier', value: ident });
      continue;
    }

    // Operators
    if ('+-*/%^'.includes(ch)) {
      tokens.push({ type: 'operator', value: ch });
      i++;
      continue;
    }

    // Parentheses
    if (ch === '(') { tokens.push({ type: 'lparen', value: '(' }); i++; continue; }
    if (ch === ')') { tokens.push({ type: 'rparen', value: ')' }); i++; continue; }

    // Comma — argument separator, modelled as an operator token
    if (ch === ',') { tokens.push({ type: 'operator', value: ',' }); i++; continue; }

    throw new SyntaxError(`Unexpected character: '${ch}' at position ${i}`);
  }

  return tokens;
}

// ─── Parser ──────────────────────────────────────────────────────────────────

/**
 * Recursive-descent parser.
 *
 * Grammar (lowest → highest precedence):
 *   expr           = additive
 *   additive       = multiplicative (('+' | '-') multiplicative)*
 *   multiplicative = unary (('*' | '/' | '%') unary)*
 *   unary          = '-' unary | power
 *   power          = primary ('^' unary)?   ← right-associative
 *   primary        = NUMBER | IDENT | IDENT '(' args ')' | '(' expr ')'
 */
class ExpressionParser {
  #tokens: Token[];
  #pos: number;

  constructor(tokens: Token[]) {
    this.#tokens = tokens;
    this.#pos = 0;
  }

  #peek(): Token | undefined {
    return this.#tokens[this.#pos];
  }

  #consume(): Token {
    const tok = this.#tokens[this.#pos];
    if (tok === undefined) throw new SyntaxError('Unexpected end of expression');
    this.#pos++;
    return tok;
  }

  #expectRparen(): void {
    const tok = this.#consume();
    if (tok.type !== 'rparen') {
      throw new SyntaxError(`Expected ')' but got '${tok.value}'`);
    }
  }

  /** Parse a full expression; asserts no leftover tokens afterwards. */
  parseExpression(): ASTNode {
    const node = this.#parseAdditive();
    const leftover = this.#peek();
    if (leftover !== undefined) {
      throw new SyntaxError(`Unexpected token '${leftover.value}'`);
    }
    return node;
  }

  // additive = multiplicative (('+' | '-') multiplicative)*
  #parseAdditive(): ASTNode {
    let left = this.#parseMultiplicative();
    while (
      this.#peek()?.type === 'operator' &&
      (this.#peek()!.value === '+' || this.#peek()!.value === '-')
    ) {
      const op = this.#consume().value;
      const right = this.#parseMultiplicative();
      left = { type: 'binary', op, left, right };
    }
    return left;
  }

  // multiplicative = unary (('*' | '/' | '%') unary)*
  #parseMultiplicative(): ASTNode {
    let left = this.#parseUnary();
    while (
      this.#peek()?.type === 'operator' &&
      (this.#peek()!.value === '*' ||
        this.#peek()!.value === '/' ||
        this.#peek()!.value === '%')
    ) {
      const op = this.#consume().value;
      const right = this.#parseUnary();
      left = { type: 'binary', op, left, right };
    }
    return left;
  }

  // unary = '-' unary | power
  #parseUnary(): ASTNode {
    if (this.#peek()?.type === 'operator' && this.#peek()!.value === '-') {
      this.#consume();
      const operand = this.#parseUnary();
      return { type: 'unary', op: '-', operand };
    }
    return this.#parsePower();
  }

  // power = primary ('^' unary)?   right-associative
  #parsePower(): ASTNode {
    const base = this.#parsePrimary();
    if (this.#peek()?.type === 'operator' && this.#peek()!.value === '^') {
      this.#consume();
      // Recurse into #parseUnary so that -x^2 = -(x^2) and 2^3^2 = 2^(3^2)
      const exponent = this.#parseUnary();
      return { type: 'binary', op: '^', left: base, right: exponent };
    }
    return base;
  }

  // primary = NUMBER | IDENT | IDENT '(' args ')' | '(' expr ')'
  #parsePrimary(): ASTNode {
    const tok = this.#peek();
    if (tok === undefined) {
      throw new SyntaxError('Unexpected end of expression — expected a value');
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
      return { type: 'number', value: Number(tok.value) };
    }

    // Identifier — either a variable/constant or a function call
    if (tok.type === 'identifier') {
      this.#consume();
      if (this.#peek()?.type === 'lparen') {
        // Function call
        this.#consume(); // consume '('
        const args: ASTNode[] = [];
        if (this.#peek()?.type !== 'rparen') {
          args.push(this.#parseAdditive());
          while (
            this.#peek()?.type === 'operator' &&
            this.#peek()!.value === ','
          ) {
            this.#consume(); // consume ','
            args.push(this.#parseAdditive());
          }
        }
        this.#expectRparen();
        return { type: 'call', name: tok.value, args };
      }
      return { type: 'identifier', name: tok.value };
    }

    throw new SyntaxError(`Unexpected token '${tok.value}'`);
  }
}

// ─── Public: tokenize() — already defined above ───────────────────────────────

// ─── Public: parse() ─────────────────────────────────────────────────────────

/**
 * Parse a mathematical expression string into an AST.
 *
 * @throws {SyntaxError} on invalid syntax or empty input.
 */
export function parse(expression: string): ASTNode {
  const tokens = tokenize(expression);
  if (tokens.length === 0) {
    throw new SyntaxError('Empty expression');
  }
  return new ExpressionParser(tokens).parseExpression();
}

// ─── AST Evaluator ───────────────────────────────────────────────────────────

function evalNode(node: ASTNode, vars: Record<string, number>): number {
  switch (node.type) {
    case 'number':
      return node.value;

    case 'identifier': {
      const { name } = node;
      if (Object.prototype.hasOwnProperty.call(CONSTANTS, name)) return CONSTANTS[name];
      if (Object.prototype.hasOwnProperty.call(vars, name)) return vars[name];
      throw new ReferenceError(`Unknown variable: '${name}'`);
    }

    case 'unary': {
      const val = evalNode(node.operand, vars);
      if (node.op === '-') return -val;
      throw new Error(`Unknown unary operator: '${node.op}'`);
    }

    case 'binary': {
      const l = evalNode(node.left, vars);
      const r = evalNode(node.right, vars);
      switch (node.op) {
        case '+': return l + r;
        case '-': return l - r;
        case '*': return l * r;
        case '/': return l / r;
        case '%': return l % r;
        case '^': return Math.pow(l, r);
        default: throw new Error(`Unknown binary operator: '${node.op}'`);
      }
    }

    case 'call': {
      const fn = FUNCTIONS[node.name];
      if (fn === undefined) {
        throw new ReferenceError(`Unknown function: '${node.name}'`);
      }
      const args = node.args.map((a) => evalNode(a, vars));
      return fn(...args);
    }
  }
}

// ─── Public: evaluate() ──────────────────────────────────────────────────────

/**
 * Parse and evaluate a mathematical expression string in one step.
 *
 * @param expression - E.g. `"2 + x * 3"`.
 * @param variables  - Optional map of variable names → values.
 * @returns The numeric result.
 * @throws {SyntaxError}    on invalid syntax.
 * @throws {ReferenceError} on unknown variables or functions.
 */
export function evaluate(
  expression: string,
  variables: Record<string, number> = {},
): number {
  return evalNode(parse(expression), variables);
}

// ─── Public: compile() ───────────────────────────────────────────────────────

/**
 * Compile an expression into a reusable evaluator function.
 * The expression is parsed once; subsequent calls only run the evaluator.
 *
 * @param expression - The expression to compile.
 * @returns A function `(variables?) => number`.
 * @throws {SyntaxError} eagerly, during compilation.
 */
export function compile(
  expression: string,
): (variables?: Record<string, number>) => number {
  const ast = parse(expression);
  return (variables: Record<string, number> = {}): number => evalNode(ast, variables);
}
