// @ts-check
// ─── Expression Parser ────────────────────────────────────────────────────────
// Recursive-descent parser that produces an AST from a math expression string.
// Operator precedence (low → high): + - → * / → unary - → ^ → atoms

// ─── Types ────────────────────────────────────────────────────────────────────

export type ASTNode =
  | { type: 'number'; value: number }
  | { type: 'variable'; name: string }
  | { type: 'binary'; op: '+' | '-' | '*' | '/' | '^'; left: ASTNode; right: ASTNode }
  | { type: 'unary'; op: '-'; operand: ASTNode }
  | { type: 'call'; name: string; args: ASTNode[] };

// ─── Tokeniser ────────────────────────────────────────────────────────────────

type TokenType =
  | 'number'
  | 'ident'
  | 'plus'
  | 'minus'
  | 'star'
  | 'slash'
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

    // Skip whitespace
    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    // Number literal (integer or decimal)
    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(expr[i + 1] ?? ''))) {
      let num = '';
      while (i < expr.length && /[0-9.]/.test(expr[i])) {
        num += expr[i++];
      }
      // Support scientific notation: e.g. 1e10, 2.5e-3
      if (i < expr.length && (expr[i] === 'e' || expr[i] === 'E')) {
        num += expr[i++];
        if (i < expr.length && (expr[i] === '+' || expr[i] === '-')) {
          num += expr[i++];
        }
        while (i < expr.length && /[0-9]/.test(expr[i])) {
          num += expr[i++];
        }
      }
      tokens.push({ type: 'number', value: num });
      continue;
    }

    // Identifier (variable name or function name)
    if (/[a-zA-Z_]/.test(ch)) {
      let name = '';
      while (i < expr.length && /[a-zA-Z0-9_]/.test(expr[i])) {
        name += expr[i++];
      }
      tokens.push({ type: 'ident', value: name });
      continue;
    }

    // Single-character tokens
    switch (ch) {
      case '+': tokens.push({ type: 'plus',    value: ch }); break;
      case '-': tokens.push({ type: 'minus',   value: ch }); break;
      case '*': tokens.push({ type: 'star',    value: ch }); break;
      case '/': tokens.push({ type: 'slash',   value: ch }); break;
      case '^': tokens.push({ type: 'caret',   value: ch }); break;
      case '(': tokens.push({ type: 'lparen',  value: ch }); break;
      case ')': tokens.push({ type: 'rparen',  value: ch }); break;
      case ',': tokens.push({ type: 'comma',   value: ch }); break;
      default:
        throw new SyntaxError(`Unexpected character: '${ch}'`);
    }
    i++;
  }
  tokens.push({ type: 'eof', value: '' });
  return tokens;
}

// ─── Parser ───────────────────────────────────────────────────────────────────

class Parser {
  #tokens: Token[];
  #pos: number;

  constructor(tokens: Token[]) {
    this.#tokens = tokens;
    this.#pos = 0;
  }

  // ── Token access ────────────────────────────────────────────────────────────

  #peek(): Token {
    return this.#tokens[this.#pos];
  }

  #consume(): Token {
    return this.#tokens[this.#pos++];
  }

  #expect(type: TokenType): Token {
    const tok = this.#peek();
    if (tok.type !== type) {
      throw new SyntaxError(`Expected '${type}' but got '${tok.type}' ("${tok.value}")`);
    }
    return this.#consume();
  }

  // ── Grammar rules (precedence: additive < multiplicative < unary < power < atom)

  parse(): ASTNode {
    const node = this.#parseAdditive();
    if (this.#peek().type !== 'eof') {
      throw new SyntaxError(`Unexpected token: '${this.#peek().value}'`);
    }
    return node;
  }

  // addition / subtraction  (left-associative)
  #parseAdditive(): ASTNode {
    let left = this.#parseMultiplicative();
    while (this.#peek().type === 'plus' || this.#peek().type === 'minus') {
      const op = this.#consume().value as '+' | '-';
      const right = this.#parseMultiplicative();
      left = { type: 'binary', op, left, right };
    }
    return left;
  }

  // multiplication / division  (left-associative)
  #parseMultiplicative(): ASTNode {
    let left = this.#parseUnary();
    while (this.#peek().type === 'star' || this.#peek().type === 'slash') {
      const op = this.#consume().value as '*' | '/';
      const right = this.#parseUnary();
      left = { type: 'binary', op, left, right };
    }
    return left;
  }

  // unary minus
  #parseUnary(): ASTNode {
    if (this.#peek().type === 'minus') {
      this.#consume();
      const operand = this.#parseUnary(); // right-associative
      return { type: 'unary', op: '-', operand };
    }
    return this.#parsePower();
  }

  // exponentiation  (right-associative)
  #parsePower(): ASTNode {
    const base = this.#parseAtom();
    if (this.#peek().type === 'caret') {
      this.#consume();
      const exp = this.#parseUnary(); // right-associative: parse unary on RHS
      return { type: 'binary', op: '^', left: base, right: exp };
    }
    return base;
  }

  // atom: number | variable | function-call | parenthesised expression
  #parseAtom(): ASTNode {
    const tok = this.#peek();

    if (tok.type === 'number') {
      this.#consume();
      return { type: 'number', value: Number(tok.value) };
    }

    if (tok.type === 'ident') {
      this.#consume();
      // function call: ident '(' args ')'
      if (this.#peek().type === 'lparen') {
        this.#consume(); // '('
        const args: ASTNode[] = [];
        if (this.#peek().type !== 'rparen') {
          args.push(this.#parseAdditive());
          while (this.#peek().type === 'comma') {
            this.#consume();
            args.push(this.#parseAdditive());
          }
        }
        this.#expect('rparen');
        return { type: 'call', name: tok.value, args };
      }
      // plain variable
      return { type: 'variable', name: tok.value };
    }

    if (tok.type === 'lparen') {
      this.#consume();
      const node = this.#parseAdditive();
      this.#expect('rparen');
      return node;
    }

    throw new SyntaxError(`Unexpected token: '${tok.type}' ("${tok.value}")`);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Parser class with explicit constructor + parse method. */
export class ExprParser {
  #parser: Parser;

  constructor(expr: string) {
    this.#parser = new Parser(tokenise(expr));
  }

  /** Parse the expression and return its AST. */
  parse(): ASTNode {
    return this.#parser.parse();
  }
}

/** Convenience: parse an expression string and return its AST. */
export function parseExpr(expr: string): ASTNode {
  return new ExprParser(expr).parse();
}
