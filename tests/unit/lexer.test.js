// ─── Unit Tests: lexer ────────────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { Lexer, createLexer, TokenStream } from '../../app/modules/lexer.js';

// ─── Shared rule sets ─────────────────────────────────────────────────────────

/** Simple arithmetic token rules. */
const MATH_RULES = [
  { type: 'NUMBER', pattern: /[0-9]+(?:\.[0-9]+)?/ },
  { type: 'PLUS', pattern: '+' },
  { type: 'MINUS', pattern: '-' },
  { type: 'STAR', pattern: '*' },
  { type: 'SLASH', pattern: '/' },
  { type: 'LPAREN', pattern: '(' },
  { type: 'RPAREN', pattern: ')' },
  { type: 'WS', pattern: /\s+/ },
];

/** Keyword + identifier rules. */
const KEYWORD_RULES = [
  { type: 'IF', pattern: 'if' },
  { type: 'ELSE', pattern: 'else' },
  { type: 'IDENT', pattern: /[a-zA-Z_]\w*/ },
  { type: 'WS', pattern: /\s+/ },
];

// ─── Lexer – tokenize ─────────────────────────────────────────────────────────

describe('Lexer – tokenize basic tokens', () => {
  it('tokenizes a simple arithmetic expression', () => {
    const lexer = new Lexer(MATH_RULES);
    const tokens = lexer.tokenize('1 + 2');
    const types = tokens.map((t) => t.type);
    assert.deepEqual(types, ['NUMBER', 'WS', 'PLUS', 'WS', 'NUMBER']);
  });

  it('returns correct token values', () => {
    const lexer = new Lexer(MATH_RULES);
    const tokens = lexer.tokenize('42+7');
    assert.equal(tokens[0].value, '42');
    assert.equal(tokens[1].value, '+');
    assert.equal(tokens[2].value, '7');
  });

  it('returns empty array for empty input', () => {
    const lexer = new Lexer(MATH_RULES);
    assert.deepEqual(lexer.tokenize(''), []);
  });

  it('throws on unrecognised input', () => {
    const lexer = new Lexer([{ type: 'NUM', pattern: /\d+/ }]);
    assert.throws(() => lexer.tokenize('123 @@@'), /Unexpected token/);
  });

  it('tracks line and col correctly across newlines', () => {
    const lexer = new Lexer([
      { type: 'WORD', pattern: /[a-z]+/ },
      { type: 'NL', pattern: /\n/ },
      { type: 'WS', pattern: /[ \t]+/ },
    ]);
    const tokens = lexer.tokenize('foo\nbar');
    const bar = tokens.find((t) => t.value === 'bar');
    assert.ok(bar);
    assert.equal(bar.line, 2);
    assert.equal(bar.col, 1);
  });

  it('tracks offset correctly', () => {
    const lexer = new Lexer([
      { type: 'A', pattern: /a+/ },
      { type: 'B', pattern: /b+/ },
    ]);
    const tokens = lexer.tokenize('aaabbb');
    assert.equal(tokens[0].offset, 0);
    assert.equal(tokens[1].offset, 3);
  });

  it('col advances correctly within a line', () => {
    const lexer = new Lexer(MATH_RULES);
    const tokens = lexer.tokenize('1+2');
    assert.equal(tokens[0].col, 1);
    assert.equal(tokens[1].col, 2);
    assert.equal(tokens[2].col, 3);
  });

  it('first token always starts at line 1, col 1', () => {
    const lexer = new Lexer(MATH_RULES);
    const tokens = lexer.tokenize('99');
    assert.equal(tokens[0].line, 1);
    assert.equal(tokens[0].col, 1);
  });

  it('handles multi-character operators', () => {
    const lexer = new Lexer([
      { type: 'EQ', pattern: '==' },
      { type: 'ASSIGN', pattern: '=' },
      { type: 'IDENT', pattern: /[a-z]+/ },
    ]);
    const tokens = lexer.tokenize('a==b');
    assert.equal(tokens[1].type, 'EQ');
    assert.equal(tokens[1].value, '==');
  });
});

// ─── Lexer – options ──────────────────────────────────────────────────────────

describe('Lexer – options', () => {
  it('skipWhitespace omits whitespace tokens', () => {
    const lexer = new Lexer(MATH_RULES, { skipWhitespace: true });
    const tokens = lexer.tokenize('1 + 2');
    const types = tokens.map((t) => t.type);
    assert.deepEqual(types, ['NUMBER', 'PLUS', 'NUMBER']);
  });

  it('skipWhitespace: false preserves whitespace tokens', () => {
    const lexer = new Lexer(MATH_RULES, { skipWhitespace: false });
    const tokens = lexer.tokenize('1 + 2');
    assert.ok(tokens.some((t) => t.type === 'WS'));
  });

  it('caseSensitive: false matches keywords case-insensitively (string pattern)', () => {
    const lexer = new Lexer(
      [{ type: 'KW', pattern: 'select' }],
      { caseSensitive: false },
    );
    assert.doesNotThrow(() => lexer.tokenize('SELECT'));
    const tokens = lexer.tokenize('SELECT');
    assert.equal(tokens[0].type, 'KW');
  });

  it('caseSensitive: true (default) does not match wrong case', () => {
    const lexer = new Lexer(
      [{ type: 'KW', pattern: 'select' }],
      { caseSensitive: true },
    );
    assert.throws(() => lexer.tokenize('SELECT'), /Unexpected token/);
  });

  it('skipWhitespace adjusts col tracking across skipped whitespace', () => {
    const lexer = new Lexer(
      [{ type: 'W', pattern: /\w+/ }],
      { skipWhitespace: true },
    );
    const tokens = lexer.tokenize('hello world');
    assert.equal(tokens[0].col, 1);
    assert.equal(tokens[1].col, 7);
  });

  it('skipWhitespace adjusts line tracking after newline', () => {
    const lexer = new Lexer(
      [{ type: 'W', pattern: /\w+/ }],
      { skipWhitespace: true },
    );
    const tokens = lexer.tokenize('foo\nbar');
    assert.equal(tokens[1].line, 2);
  });

  it('default options produce expected behaviour (no skip, case-sensitive)', () => {
    const lexer = new Lexer([
      { type: 'A', pattern: 'a' },
      { type: 'SP', pattern: ' ' },
    ]);
    const tokens = lexer.tokenize('a a');
    assert.equal(tokens.length, 3);
    assert.equal(tokens[1].type, 'SP');
  });

  it('rules array may be empty — tokenizing non-empty input throws', () => {
    const lexer = new Lexer([]);
    assert.deepEqual(lexer.tokenize(''), []);
    assert.throws(() => lexer.tokenize('x'), /Unexpected token/);
  });
});

// ─── createLexer factory ──────────────────────────────────────────────────────

describe('createLexer', () => {
  it('returns a Lexer instance', () => {
    const lexer = createLexer([{ type: 'N', pattern: /\d+/ }]);
    assert.ok(lexer instanceof Lexer);
  });

  it('produces identical results to new Lexer()', () => {
    const rules = [{ type: 'N', pattern: /\d+/ }, { type: 'W', pattern: /\s+/ }];
    const a = new Lexer(rules);
    const b = createLexer(rules);
    assert.deepEqual(a.tokenize('1 2 3'), b.tokenize('1 2 3'));
  });

  it('passes options to the underlying Lexer', () => {
    const lexer = createLexer(
      [{ type: 'N', pattern: /\d+/ }],
      { skipWhitespace: true },
    );
    const tokens = lexer.tokenize('  42  ');
    assert.equal(tokens.length, 1);
    assert.equal(tokens[0].value, '42');
  });

  it('can tokenize keywords after creation', () => {
    const lexer = createLexer([
      { type: 'IF', pattern: 'if' },
      { type: 'WS', pattern: /\s+/ },
      { type: 'IDENT', pattern: /[a-z]+/ },
    ]);
    const tokens = lexer.tokenize('if foo');
    assert.equal(tokens[0].type, 'IF');
    assert.equal(tokens[2].type, 'IDENT');
  });

  it('throws on unrecognised token just like Lexer constructor', () => {
    const lexer = createLexer([{ type: 'N', pattern: /\d+/ }]);
    assert.throws(() => lexer.tokenize('abc'), /Unexpected token/);
  });

  it('handles empty input gracefully', () => {
    const lexer = createLexer([{ type: 'N', pattern: /\d+/ }]);
    assert.deepEqual(lexer.tokenize(''), []);
  });

  it('works with string patterns', () => {
    const lexer = createLexer([{ type: 'PLUS', pattern: '+' }]);
    const tokens = lexer.tokenize('+');
    assert.equal(tokens[0].type, 'PLUS');
    assert.equal(tokens[0].value, '+');
  });

  it('preserves rule order (first match wins)', () => {
    const lexer = createLexer([
      { type: 'KEYWORD', pattern: 'if' },
      { type: 'IDENT', pattern: /[a-z]+/ },
    ]);
    const tokens = lexer.tokenize('if');
    assert.equal(tokens[0].type, 'KEYWORD');
  });
});

// ─── TokenStream – peek / next / eof ─────────────────────────────────────────

describe('TokenStream – peek / next / eof', () => {
  function makeStream(input) {
    const lexer = new Lexer(MATH_RULES, { skipWhitespace: true });
    return new TokenStream(lexer.tokenize(input));
  }

  it('peek returns the current token without consuming it', () => {
    const stream = makeStream('1+2');
    const first = stream.peek();
    assert.ok(first);
    assert.equal(first.type, 'NUMBER');
    // Call again — same token
    assert.equal(stream.peek(), first);
  });

  it('next consumes and returns the current token', () => {
    const stream = makeStream('1+2');
    const t = stream.next();
    assert.ok(t);
    assert.equal(t.type, 'NUMBER');
    assert.equal(t.value, '1');
  });

  it('next advances position so subsequent peek is different', () => {
    const stream = makeStream('1+2');
    stream.next();
    const t = stream.peek();
    assert.ok(t);
    assert.equal(t.type, 'PLUS');
  });

  it('eof is false when tokens remain', () => {
    const stream = makeStream('1+2');
    assert.equal(stream.eof, false);
  });

  it('eof is true after all tokens consumed', () => {
    const stream = makeStream('1');
    stream.next();
    assert.equal(stream.eof, true);
  });

  it('peek returns null at EOF', () => {
    const stream = makeStream('1');
    stream.next();
    assert.equal(stream.peek(), null);
  });

  it('next returns null at EOF', () => {
    const stream = makeStream('1');
    stream.next();
    assert.equal(stream.next(), null);
  });

  it('eof is true on an empty token array', () => {
    const stream = new TokenStream([]);
    assert.equal(stream.eof, true);
  });

  it('can iterate all tokens using next until null', () => {
    const stream = makeStream('1+2');
    const collected = [];
    let t;
    while ((t = stream.next()) !== null) {
      collected.push(t.type);
    }
    assert.deepEqual(collected, ['NUMBER', 'PLUS', 'NUMBER']);
  });
});

// ─── TokenStream – expect ─────────────────────────────────────────────────────

describe('TokenStream – expect', () => {
  function makeStream(input) {
    const lexer = new Lexer(MATH_RULES, { skipWhitespace: true });
    return new TokenStream(lexer.tokenize(input));
  }

  it('returns the token when type matches', () => {
    const stream = makeStream('42');
    const t = stream.expect('NUMBER');
    assert.equal(t.type, 'NUMBER');
    assert.equal(t.value, '42');
  });

  it('consumes the matched token', () => {
    const stream = makeStream('1+2');
    stream.expect('NUMBER');
    const next = stream.peek();
    assert.ok(next);
    assert.equal(next.type, 'PLUS');
  });

  it('throws when type does not match', () => {
    const stream = makeStream('1+2');
    assert.throws(() => stream.expect('PLUS'), /Expected token "PLUS"/);
  });

  it('throws at EOF', () => {
    const stream = new TokenStream([]);
    assert.throws(() => stream.expect('NUMBER'), /end of input/);
  });

  it('error message includes expected type', () => {
    const stream = makeStream('+');
    try {
      stream.expect('NUMBER');
      assert.fail('Should have thrown');
    } catch (e) {
      assert.ok(e.message.includes('NUMBER'));
    }
  });

  it('error message includes actual type', () => {
    const stream = makeStream('+');
    try {
      stream.expect('NUMBER');
      assert.fail('Should have thrown');
    } catch (e) {
      assert.ok(e.message.includes('PLUS'));
    }
  });

  it('can be chained to parse a sequence', () => {
    const stream = makeStream('1+2');
    const num1 = stream.expect('NUMBER');
    stream.expect('PLUS');
    const num2 = stream.expect('NUMBER');
    assert.equal(num1.value, '1');
    assert.equal(num2.value, '2');
    assert.equal(stream.eof, true);
  });

  it('leaves stream at EOF after consuming last token', () => {
    const stream = makeStream('99');
    stream.expect('NUMBER');
    assert.equal(stream.eof, true);
  });
});

// ─── TokenStream – match ──────────────────────────────────────────────────────

describe('TokenStream – match', () => {
  function makeStream(input) {
    const lexer = new Lexer(MATH_RULES, { skipWhitespace: true });
    return new TokenStream(lexer.tokenize(input));
  }

  it('returns token and advances when type matches', () => {
    const stream = makeStream('42+1');
    const t = stream.match('NUMBER');
    assert.ok(t);
    assert.equal(t.value, '42');
    const next = stream.peek();
    assert.ok(next);
    assert.equal(next.type, 'PLUS');
  });

  it('returns null and does not advance when type does not match', () => {
    const stream = makeStream('42+1');
    const t = stream.match('PLUS');
    assert.equal(t, null);
    // Still at first token
    const peek = stream.peek();
    assert.ok(peek);
    assert.equal(peek.type, 'NUMBER');
  });

  it('returns null at EOF', () => {
    const stream = new TokenStream([]);
    assert.equal(stream.match('NUMBER'), null);
  });

  it('can be used for optional token consumption', () => {
    const stream = makeStream('1+2');
    stream.expect('NUMBER');
    // Optionally consume a MINUS (not present)
    const minus = stream.match('MINUS');
    assert.equal(minus, null);
    // PLUS is still there
    const plus = stream.match('PLUS');
    assert.ok(plus);
    assert.equal(plus.type, 'PLUS');
  });

  it('does not throw on mismatch (unlike expect)', () => {
    const stream = makeStream('(1)');
    assert.doesNotThrow(() => stream.match('NUMBER'));
  });

  it('consecutive match calls consume tokens in order', () => {
    const stream = makeStream('1+2');
    const n1 = stream.match('NUMBER');
    const op = stream.match('PLUS');
    const n2 = stream.match('NUMBER');
    assert.ok(n1);
    assert.ok(op);
    assert.ok(n2);
    assert.equal(stream.eof, true);
  });

  it('match after failed match retries the same position', () => {
    const stream = makeStream('+');
    stream.match('NUMBER'); // fails, no advance
    const plus = stream.match('PLUS'); // succeeds from same position
    assert.ok(plus);
  });

  it('match on a single-token stream leaves stream at EOF on success', () => {
    const stream = makeStream('7');
    stream.match('NUMBER');
    assert.equal(stream.eof, true);
  });
});
