// @ts-check
// ─── Tokenizer ────────────────────────────────────────────────────────────────
// A general-purpose, configuration-driven tokenizer that splits source text
// into a stream of typed tokens with accurate line/column tracking.

// ─── Types ────────────────────────────────────────────────────────────────────

export type TokenType =
  | 'keyword'
  | 'identifier'
  | 'number'
  | 'string'
  | 'operator'
  | 'punctuation'
  | 'whitespace'
  | 'comment'
  | 'unknown';

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
}

export interface TokenizerConfig {
  /** Reserved words that take priority over identifiers. */
  keywords?: string[];
  /** Operator strings, sorted longest-first for greedy matching. */
  operators?: string[];
  /** Characters that start a quoted string (e.g. `'"` or `'"\``). */
  stringDelimiters?: string[];
  /** When true (default) whitespace tokens are omitted from the output. */
  skipWhitespace?: boolean;
  /** When true (default) comment tokens are omitted from the output. */
  skipComments?: boolean;
  /** Prefix that begins a single-line comment (e.g. `'//'`). */
  lineComment?: string;
  /** Start and end markers for a block comment (e.g. `['/*', '*/']`). */
  blockComment?: [string, string];
}

// ─── Tokenizer ────────────────────────────────────────────────────────────────

export class Tokenizer {
  readonly #keywords: Set<string>;
  readonly #operators: string[];
  readonly #stringDelimiters: Set<string>;
  readonly #skipWhitespace: boolean;
  readonly #skipComments: boolean;
  readonly #lineComment: string | undefined;
  readonly #blockComment: [string, string] | undefined;

  constructor(config?: TokenizerConfig) {
    this.#keywords = new Set(config?.keywords ?? []);
    // Sort operators longest-first so multi-char ops match before sub-strings.
    this.#operators = (config?.operators ?? []).slice().sort((a, b) => b.length - a.length);
    this.#stringDelimiters = new Set(config?.stringDelimiters ?? ['"', "'`"]);
    this.#skipWhitespace = config?.skipWhitespace ?? true;
    this.#skipComments = config?.skipComments ?? true;
    this.#lineComment = config?.lineComment;
    this.#blockComment = config?.blockComment;
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  tokenize(input: string): Token[] {
    const tokens: Token[] = [];
    let pos = 0;
    let line = 1;
    let col = 1;

    const advance = (n: number): string => {
      const chunk = input.slice(pos, pos + n);
      for (const ch of chunk) {
        if (ch === '\n') { line++; col = 1; }
        else { col++; }
      }
      pos += n;
      return chunk;
    };

    const push = (type: TokenType, value: string, startLine: number, startCol: number): void => {
      const skip =
        (type === 'whitespace' && this.#skipWhitespace) ||
        (type === 'comment' && this.#skipComments);
      if (!skip) {
        tokens.push({ type, value, line: startLine, column: startCol });
      }
    };

    while (pos < input.length) {
      const startLine = line;
      const startCol = col;
      const ch = input[pos];

      // ── Line comment ───────────────────────────────────────────────────────
      if (this.#lineComment && input.startsWith(this.#lineComment, pos)) {
        const end = input.indexOf('\n', pos);
        const commentText = end === -1
          ? advance(input.length - pos)
          : advance(end - pos); // do NOT consume the newline itself
        push('comment', commentText, startLine, startCol);
        continue;
      }

      // ── Block comment ──────────────────────────────────────────────────────
      if (this.#blockComment && input.startsWith(this.#blockComment[0], pos)) {
        const [open, close] = this.#blockComment;
        advance(open.length);
        let body = '';
        while (pos < input.length && !input.startsWith(close, pos)) {
          body += advance(1);
        }
        if (pos < input.length) advance(close.length);
        push('comment', open + body + close, startLine, startCol);
        continue;
      }

      // ── Whitespace ────────────────────────────────────────────────────────
      if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
        let ws = '';
        while (pos < input.length) {
          const c = input[pos];
          if (c !== ' ' && c !== '\t' && c !== '\r' && c !== '\n') break;
          ws += advance(1);
        }
        push('whitespace', ws, startLine, startCol);
        continue;
      }

      // ── String literal ────────────────────────────────────────────────────
      if (this.#stringDelimiters.has(ch)) {
        const delim = ch;
        let str = advance(1); // consume opening delimiter
        while (pos < input.length) {
          const c = input[pos];
          if (c === '\\') {
            str += advance(1); // backslash
            if (pos < input.length) str += advance(1); // escaped char
          } else if (c === delim) {
            str += advance(1); // closing delimiter
            break;
          } else {
            str += advance(1);
          }
        }
        push('string', str, startLine, startCol);
        continue;
      }

      // ── Number ────────────────────────────────────────────────────────────
      if (isDigit(ch) || (ch === '.' && pos + 1 < input.length && isDigit(input[pos + 1]))) {
        let num = '';
        // Integer or float part
        while (pos < input.length && isDigit(input[pos])) num += advance(1);
        if (pos < input.length && input[pos] === '.') {
          num += advance(1);
          while (pos < input.length && isDigit(input[pos])) num += advance(1);
        }
        // Exponent
        if (pos < input.length && (input[pos] === 'e' || input[pos] === 'E')) {
          num += advance(1);
          if (pos < input.length && (input[pos] === '+' || input[pos] === '-')) {
            num += advance(1);
          }
          while (pos < input.length && isDigit(input[pos])) num += advance(1);
        }
        push('number', num, startLine, startCol);
        continue;
      }

      // ── Identifier / keyword ──────────────────────────────────────────────
      if (isIdentStart(ch)) {
        let ident = '';
        while (pos < input.length && isIdentPart(input[pos])) ident += advance(1);
        const type: TokenType = this.#keywords.has(ident) ? 'keyword' : 'identifier';
        push(type, ident, startLine, startCol);
        continue;
      }

      // ── Operator ──────────────────────────────────────────────────────────
      let matchedOp = false;
      for (const op of this.#operators) {
        if (input.startsWith(op, pos)) {
          push('operator', advance(op.length), startLine, startCol);
          matchedOp = true;
          break;
        }
      }
      if (matchedOp) continue;

      // ── Punctuation ───────────────────────────────────────────────────────
      if ('()[]{}.,;:'.includes(ch)) {
        push('punctuation', advance(1), startLine, startCol);
        continue;
      }

      // ── Unknown ───────────────────────────────────────────────────────────
      push('unknown', advance(1), startLine, startCol);
    }

    return tokens;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isDigit(ch: string): boolean {
  return ch >= '0' && ch <= '9';
}

function isIdentStart(ch: string): boolean {
  return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_' || ch === '$';
}

function isIdentPart(ch: string): boolean {
  return isIdentStart(ch) || isDigit(ch);
}
