// @ts-check
// ─── Lexer / Tokenizer ────────────────────────────────────────────────────────
// Rule-based tokenizer that converts a string into a stream of typed tokens.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TokenDef {
  type: string;
  pattern: RegExp | string;
}

export interface Token {
  type: string;
  value: string;
  line: number;
  col: number;
  offset: number;
}

export interface LexerOptions {
  skipWhitespace?: boolean;
  caseSensitive?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Compile a TokenDef pattern to a RegExp anchored at the start of string.
 * When caseSensitive is false the `i` flag is added.
 */
function compilePattern(pattern: RegExp | string, caseSensitive: boolean): RegExp {
  if (typeof pattern === 'string') {
    // Escape special regex characters in literal strings
    const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp('^(?:' + escaped + ')', caseSensitive ? '' : 'i');
  }
  // RegExp — anchor to start if not already
  const src = pattern.source.startsWith('^')
    ? pattern.source
    : '^(?:' + pattern.source + ')';
  const flags = caseSensitive
    ? pattern.flags.replace('i', '')
    : pattern.flags.includes('i')
      ? pattern.flags
      : pattern.flags + 'i';
  return new RegExp(src, flags);
}

// ─── Lexer ────────────────────────────────────────────────────────────────────

export class Lexer {
  #rules: Array<{ type: string; re: RegExp }>;
  #skipWhitespace: boolean;

  constructor(rules: TokenDef[], options: LexerOptions = {}) {
    const caseSensitive = options.caseSensitive ?? true;
    this.#skipWhitespace = options.skipWhitespace ?? false;
    this.#rules = rules.map(({ type, pattern }) => ({
      type,
      re: compilePattern(pattern, caseSensitive),
    }));
  }

  /**
   * Tokenize the entire input string.
   * Throws an error when an unknown token is encountered.
   */
  tokenize(input: string): Token[] {
    const tokens: Token[] = [];
    let offset = 0;
    let line = 1;
    let col = 1;

    while (offset < input.length) {
      const remaining = input.slice(offset);

      // Optionally skip leading whitespace
      if (this.#skipWhitespace) {
        const wsMatch = /^\s+/.exec(remaining);
        if (wsMatch) {
          const chunk = wsMatch[0];
          for (const ch of chunk) {
            if (ch === '\n') {
              line++;
              col = 1;
            } else {
              col++;
            }
          }
          offset += chunk.length;
          continue;
        }
      }

      let matched = false;
      for (const { type, re } of this.#rules) {
        const m = re.exec(remaining);
        if (m !== null) {
          const value = m[0];
          tokens.push({ type, value, line, col, offset });
          // Advance line/col tracking
          for (const ch of value) {
            if (ch === '\n') {
              line++;
              col = 1;
            } else {
              col++;
            }
          }
          offset += value.length;
          matched = true;
          break;
        }
      }

      if (!matched) {
        const snippet = input.slice(offset, offset + 20).replace(/\n/g, '\\n');
        throw new Error(`Unexpected token at line ${line}, col ${col}: "${snippet}"`);
      }
    }

    return tokens;
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/** Convenience factory for creating a Lexer. */
export function createLexer(rules: TokenDef[], options?: LexerOptions): Lexer {
  return new Lexer(rules, options);
}

// ─── TokenStream ──────────────────────────────────────────────────────────────

export class TokenStream {
  #tokens: Token[];
  #pos: number;

  constructor(tokens: Token[]) {
    this.#tokens = tokens;
    this.#pos = 0;
  }

  /** True when all tokens have been consumed. */
  get eof(): boolean {
    return this.#pos >= this.#tokens.length;
  }

  /** Return the current token without consuming it, or null at EOF. */
  peek(): Token | null {
    return this.#pos < this.#tokens.length ? this.#tokens[this.#pos] : null;
  }

  /** Consume and return the current token, or null at EOF. */
  next(): Token | null {
    if (this.#pos < this.#tokens.length) {
      return this.#tokens[this.#pos++];
    }
    return null;
  }

  /**
   * Consume and return the current token if its type matches.
   * Throws a descriptive error if the type does not match or if at EOF.
   */
  expect(type: string): Token {
    const token = this.peek();
    if (token === null) {
      throw new Error(`Expected token "${type}" but reached end of input`);
    }
    if (token.type !== type) {
      throw new Error(
        `Expected token "${type}" but got "${token.type}" ("${token.value}") at line ${token.line}, col ${token.col}`,
      );
    }
    this.#pos++;
    return token;
  }

  /**
   * Consume and return the current token if its type matches, otherwise null.
   */
  match(type: string): Token | null {
    const token = this.peek();
    if (token !== null && token.type === type) {
      this.#pos++;
      return token;
    }
    return null;
  }
}
