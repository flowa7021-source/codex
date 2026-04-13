// @ts-check
// ─── Math Expression Evaluator ───────────────────────────────────────────────
// Recursive descent parser for arithmetic expressions.
// Supports: +, -, *, /, ^ (right-associative), unary minus, parentheses,
// integer and floating-point literals, and named variables.

// ─── AST Node Types ──────────────────────────────────────────────────────────

/** A numeric literal node. */
export interface NumberNode {
  type: 'number';
  value: number;
}

/** A named-variable reference node. */
export interface VariableNode {
  type: 'variable';
  name: string;
}

/** A binary-operator node. */
export interface BinaryNode {
  type: 'binary';
  op: '+' | '-' | '*' | '/' | '^';
  left: ExprNode;
  right: ExprNode;
}

/** A unary-minus node. */
export interface UnaryNode {
  type: 'unary';
  op: '-';
  operand: ExprNode;
}

/** Discriminated union of all AST node kinds. */
export type ExprNode = NumberNode | VariableNode | BinaryNode | UnaryNode;

// ─── Tokeniser ───────────────────────────────────────────────────────────────

/** Internal token kinds produced by the tokeniser. */
type TokenKind =
  | 'number'
  | 'ident'
  | '+'
  | '-'
  | '*'
  | '/'
  | '^'
  | '('
  | ')'
  | 'eof';

interface Token {
  kind: TokenKind;
  value: string;
  pos: number;
}

/**
 * Tokenise `input` into an array of tokens.
 * Throws `SyntaxError` on unrecognised characters.
 */
function tokenise(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    // Skip whitespace.
    if (/\s/.test(input[i])) {
      i++;
      continue;
    }

    // Number literal (integer or decimal).
    if (/[0-9]/.test(input[i]) || (input[i] === '.' && /[0-9]/.test(input[i + 1] ?? ''))) {
      const start = i;
      while (i < input.length && /[0-9]/.test(input[i])) i++;
      if (i < input.length && input[i] === '.') {
        i++;
        while (i < input.length && /[0-9]/.test(input[i])) i++;
      }
      // Optional exponent part: e/E followed by optional sign and digits.
      if (i < input.length && /[eE]/.test(input[i])) {
        i++;
        if (i < input.length && /[+\-]/.test(input[i])) i++;
        if (i >= input.length || !/[0-9]/.test(input[i])) {
          throw new SyntaxError(`Malformed number literal at position ${start}`);
        }
        while (i < input.length && /[0-9]/.test(input[i])) i++;
      }
      tokens.push({ kind: 'number', value: input.slice(start, i), pos: start });
      continue;
    }

    // Identifier (variable name): starts with letter or underscore.
    if (/[a-zA-Z_]/.test(input[i])) {
      const start = i;
      while (i < input.length && /[a-zA-Z0-9_]/.test(input[i])) i++;
      tokens.push({ kind: 'ident', value: input.slice(start, i), pos: start });
      continue;
    }

    // Single-character operators and parentheses.
    const ch = input[i] as TokenKind;
    if ('+-*/^()'.includes(ch)) {
      tokens.push({ kind: ch, value: ch, pos: i });
      i++;
      continue;
    }

    throw new SyntaxError(
      `Unexpected character '${input[i]}' at position ${i}`,
    );
  }

  tokens.push({ kind: 'eof', value: '', pos: input.length });
  return tokens;
}

// ─── Parser ──────────────────────────────────────────────────────────────────

/**
 * Recursive-descent parser that converts a token stream into an ExprNode AST.
 *
 * Grammar (precedence, low → high):
 *   expr       := term ( ('+' | '-') term )*
 *   term       := exponent ( ('*' | '/') exponent )*
 *   exponent   := unary ('^' exponent)?        — right-associative
 *   unary      := '-' unary | primary
 *   primary    := number | ident | '(' expr ')'
 */
class Parser {
  readonly #tokens: Token[];
  #pos: number;

  constructor(tokens: Token[]) {
    this.#tokens = tokens;
    this.#pos = 0;
  }

  /** Return the current token without consuming it. */
  #peek(): Token {
    return this.#tokens[this.#pos];
  }

  /** Consume and return the current token. */
  #consume(): Token {
    return this.#tokens[this.#pos++];
  }

  /**
   * Expect the current token to have `kind`, consume it, and return it.
   * Throws `SyntaxError` if the kind does not match.
   */
  #expect(kind: TokenKind): Token {
    const tok = this.#peek();
    if (tok.kind !== kind) {
      throw new SyntaxError(
        `Expected '${kind}' at position ${tok.pos}, got '${tok.kind === 'eof' ? 'end of input' : tok.value}'`,
      );
    }
    return this.#consume();
  }

  /** Parse the full expression and assert that all input was consumed. */
  parseExpression(): ExprNode {
    const node = this.#parseExpr();
    const tok = this.#peek();
    if (tok.kind !== 'eof') {
      throw new SyntaxError(
        `Unexpected token '${tok.value}' at position ${tok.pos}`,
      );
    }
    return node;
  }

  /** expr := term ( ('+' | '-') term )* */
  #parseExpr(): ExprNode {
    let left = this.#parseTerm();
    while (this.#peek().kind === '+' || this.#peek().kind === '-') {
      const op = this.#consume().kind as '+' | '-';
      const right = this.#parseTerm();
      const node: BinaryNode = { type: 'binary', op, left, right };
      left = node;
    }
    return left;
  }

  /** term := exponent ( ('*' | '/') exponent )* */
  #parseTerm(): ExprNode {
    let left = this.#parseExponent();
    while (this.#peek().kind === '*' || this.#peek().kind === '/') {
      const op = this.#consume().kind as '*' | '/';
      const right = this.#parseExponent();
      const node: BinaryNode = { type: 'binary', op, left, right };
      left = node;
    }
    return left;
  }

  /** exponent := unary ('^' exponent)?  — right-associative */
  #parseExponent(): ExprNode {
    const base = this.#parseUnary();
    if (this.#peek().kind === '^') {
      this.#consume(); // consume '^'
      const exp = this.#parseExponent(); // right-recursive for right-associativity
      const node: BinaryNode = { type: 'binary', op: '^', left: base, right: exp };
      return node;
    }
    return base;
  }

  /** unary := '-' unary | primary */
  #parseUnary(): ExprNode {
    if (this.#peek().kind === '-') {
      this.#consume();
      const operand = this.#parseUnary();
      const node: UnaryNode = { type: 'unary', op: '-', operand };
      return node;
    }
    return this.#parsePrimary();
  }

  /** primary := number | ident | '(' expr ')' */
  #parsePrimary(): ExprNode {
    const tok = this.#peek();

    if (tok.kind === 'number') {
      this.#consume();
      const node: NumberNode = { type: 'number', value: parseFloat(tok.value) };
      return node;
    }

    if (tok.kind === 'ident') {
      this.#consume();
      const node: VariableNode = { type: 'variable', name: tok.value };
      return node;
    }

    if (tok.kind === '(') {
      this.#consume(); // consume '('
      const inner = this.#parseExpr();
      this.#expect(')');
      return inner;
    }

    if (tok.kind === 'eof') {
      throw new SyntaxError('Unexpected end of input: expected a number, variable, or "("');
    }

    throw new SyntaxError(
      `Unexpected token '${tok.value}' at position ${tok.pos}`,
    );
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Parse `expression` into an AST without evaluating it.
 * Throws `SyntaxError` for malformed expressions.
 */
export function parse(expression: string): ExprNode {
  const tokens = tokenise(expression);
  const parser = new Parser(tokens);
  return parser.parseExpression();
}

/**
 * Evaluate an already-parsed AST node, resolving variable references from
 * `variables`.  Throws `Error` for unknown variables or division by zero.
 */
export function evaluateNode(
  node: ExprNode,
  variables: Record<string, number> = {},
): number {
  switch (node.type) {
    case 'number':
      return node.value;

    case 'variable': {
      if (!Object.prototype.hasOwnProperty.call(variables, node.name)) {
        throw new Error(`Unknown variable: '${node.name}'`);
      }
      return variables[node.name];
    }

    case 'unary':
      return -evaluateNode(node.operand, variables);

    case 'binary': {
      const left = evaluateNode(node.left, variables);
      const right = evaluateNode(node.right, variables);
      switch (node.op) {
        case '+': return left + right;
        case '-': return left - right;
        case '*': return left * right;
        case '/':
          if (right === 0) throw new Error('Division by zero');
          return left / right;
        case '^': return Math.pow(left, right);
      }
    }
  }
}

/**
 * Parse and immediately evaluate `expression`.
 * Throws `SyntaxError` for malformed expressions.
 * Throws `Error` for unknown variables or division by zero.
 */
export function evaluate(
  expression: string,
  variables: Record<string, number> = {},
): number {
  const ast = parse(expression);
  return evaluateNode(ast, variables);
}

/**
 * Return an evaluator object whose `eval` method is pre-bound to `variables`.
 * Individual calls may not override the bound variables.
 */
export function createEvaluator(
  variables: Record<string, number> = {},
): { eval: (expr: string) => number } {
  return {
    eval(expr: string): number {
      return evaluate(expr, variables);
    },
  };
}
