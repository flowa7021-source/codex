// ─── Unit Tests: Tokenizer ────────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { Tokenizer } from '../../app/modules/tokenizer.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build a default-config tokenizer that keeps whitespace. */
function makeTokenizer(extra = {}) {
  return new Tokenizer({ skipWhitespace: false, ...extra });
}

// ─── Default tokenizer ────────────────────────────────────────────────────────

describe('Tokenizer – defaults', () => {
  it('returns an empty array for empty input', () => {
    const t = new Tokenizer();
    assert.deepEqual(t.tokenize(''), []);
  });

  it('skips whitespace by default', () => {
    const t = new Tokenizer();
    const tokens = t.tokenize('  hello  ');
    assert.equal(tokens.length, 1);
    assert.equal(tokens[0].type, 'identifier');
    assert.equal(tokens[0].value, 'hello');
  });
});

// ─── Numbers ─────────────────────────────────────────────────────────────────

describe('Tokenizer – numbers', () => {
  const t = new Tokenizer();

  it('tokenizes an integer', () => {
    const [tok] = t.tokenize('42');
    assert.equal(tok.type, 'number');
    assert.equal(tok.value, '42');
  });

  it('tokenizes a float', () => {
    const [tok] = t.tokenize('3.14');
    assert.equal(tok.type, 'number');
    assert.equal(tok.value, '3.14');
  });

  it('tokenizes scientific notation', () => {
    const [tok] = t.tokenize('1e10');
    assert.equal(tok.type, 'number');
    assert.equal(tok.value, '1e10');
  });

  it('tokenizes negative exponent', () => {
    const [tok] = t.tokenize('2.5e-3');
    assert.equal(tok.type, 'number');
    assert.equal(tok.value, '2.5e-3');
  });

  it('tokenizes a number followed by an identifier', () => {
    const tokens = t.tokenize('42px');
    assert.equal(tokens[0].type, 'number');
    assert.equal(tokens[0].value, '42');
    assert.equal(tokens[1].type, 'identifier');
    assert.equal(tokens[1].value, 'px');
  });
});

// ─── Identifiers ─────────────────────────────────────────────────────────────

describe('Tokenizer – identifiers', () => {
  const t = new Tokenizer();

  it('tokenizes a simple identifier', () => {
    const [tok] = t.tokenize('hello');
    assert.equal(tok.type, 'identifier');
    assert.equal(tok.value, 'hello');
  });

  it('tokenizes underscore-prefixed identifier', () => {
    const [tok] = t.tokenize('_private');
    assert.equal(tok.type, 'identifier');
    assert.equal(tok.value, '_private');
  });

  it('tokenizes dollar-prefixed identifier', () => {
    const [tok] = t.tokenize('$var');
    assert.equal(tok.type, 'identifier');
    assert.equal(tok.value, '$var');
  });

  it('tokenizes mixed-case identifiers', () => {
    const [tok] = t.tokenize('camelCase42');
    assert.equal(tok.type, 'identifier');
    assert.equal(tok.value, 'camelCase42');
  });
});

// ─── Keywords ────────────────────────────────────────────────────────────────

describe('Tokenizer – keywords', () => {
  const t = new Tokenizer({ keywords: ['if', 'else', 'return', 'function'] });

  it('recognises a keyword', () => {
    const [tok] = t.tokenize('if');
    assert.equal(tok.type, 'keyword');
    assert.equal(tok.value, 'if');
  });

  it('does not promote a non-keyword identifier', () => {
    const [tok] = t.tokenize('iffy');
    assert.equal(tok.type, 'identifier');
  });

  it('handles multiple keywords in sequence', () => {
    const tokens = t.tokenize('if else return');
    assert.equal(tokens.length, 3);
    assert.ok(tokens.every(tk => tk.type === 'keyword'));
  });
});

// ─── Strings ─────────────────────────────────────────────────────────────────

describe('Tokenizer – strings', () => {
  const t = new Tokenizer({ stringDelimiters: ['"', "'"] });

  it('tokenizes a double-quoted string', () => {
    const [tok] = t.tokenize('"hello world"');
    assert.equal(tok.type, 'string');
    assert.equal(tok.value, '"hello world"');
  });

  it('tokenizes a single-quoted string', () => {
    const [tok] = t.tokenize("'test'");
    assert.equal(tok.type, 'string');
    assert.equal(tok.value, "'test'");
  });

  it('handles escape sequences inside strings', () => {
    const [tok] = t.tokenize('"say \\"hi\\""');
    assert.equal(tok.type, 'string');
    assert.ok(tok.value.startsWith('"'));
    assert.ok(tok.value.endsWith('"'));
  });

  it('tokenizes empty string', () => {
    const [tok] = t.tokenize('""');
    assert.equal(tok.type, 'string');
    assert.equal(tok.value, '""');
  });
});

// ─── Operators ───────────────────────────────────────────────────────────────

describe('Tokenizer – operators', () => {
  const t = new Tokenizer({
    operators: ['+', '-', '*', '/', '===', '==', '!=', '>=', '<=', '>', '<', '='],
  });

  it('tokenizes a simple operator', () => {
    const [tok] = t.tokenize('+');
    assert.equal(tok.type, 'operator');
    assert.equal(tok.value, '+');
  });

  it('greedily matches the longest operator', () => {
    const [tok] = t.tokenize('===');
    assert.equal(tok.type, 'operator');
    assert.equal(tok.value, '===');
  });

  it('prefers == over = when input is ==', () => {
    const [tok] = t.tokenize('==');
    assert.equal(tok.value, '==');
  });
});

// ─── Punctuation ─────────────────────────────────────────────────────────────

describe('Tokenizer – punctuation', () => {
  const t = new Tokenizer();

  it('tokenizes parentheses', () => {
    const tokens = t.tokenize('()');
    assert.equal(tokens[0].type, 'punctuation');
    assert.equal(tokens[0].value, '(');
    assert.equal(tokens[1].type, 'punctuation');
    assert.equal(tokens[1].value, ')');
  });

  it('tokenizes braces and brackets', () => {
    const tokens = t.tokenize('{}[]');
    assert.ok(tokens.every(t => t.type === 'punctuation'));
  });

  it('tokenizes semicolon and colon', () => {
    const tokens = t.tokenize(';:');
    assert.ok(tokens.every(t => t.type === 'punctuation'));
  });
});

// ─── Whitespace ──────────────────────────────────────────────────────────────

describe('Tokenizer – whitespace', () => {
  it('includes whitespace tokens when skipWhitespace is false', () => {
    const t = makeTokenizer();
    const tokens = t.tokenize('a b');
    const ws = tokens.filter(tk => tk.type === 'whitespace');
    assert.equal(ws.length, 1);
    assert.equal(ws[0].value, ' ');
  });

  it('skips whitespace tokens by default', () => {
    const t = new Tokenizer();
    const tokens = t.tokenize('a   b');
    assert.equal(tokens.length, 2);
    assert.ok(tokens.every(tk => tk.type !== 'whitespace'));
  });
});

// ─── Line / column tracking ───────────────────────────────────────────────────

describe('Tokenizer – line and column tracking', () => {
  it('starts at line 1, column 1', () => {
    const t = new Tokenizer();
    const [tok] = t.tokenize('hello');
    assert.equal(tok.line, 1);
    assert.equal(tok.column, 1);
  });

  it('increments column for tokens on the same line', () => {
    const t = new Tokenizer({ skipWhitespace: false });
    const tokens = t.tokenize('ab cd');
    // 'ab' starts at col 1, ' ' at col 3, 'cd' at col 4
    assert.equal(tokens[0].column, 1);
    assert.equal(tokens[2].column, 4);
  });

  it('increments line after newline', () => {
    const t = new Tokenizer();
    const tokens = t.tokenize('a\nb');
    assert.equal(tokens[0].line, 1);
    assert.equal(tokens[1].line, 2);
    assert.equal(tokens[1].column, 1);
  });

  it('tracks multi-line input correctly', () => {
    const t = new Tokenizer({ keywords: ['let'] });
    const tokens = t.tokenize('let x\nlet y');
    assert.equal(tokens[0].line, 1);
    assert.equal(tokens[2].line, 2);
  });
});

// ─── Comments ────────────────────────────────────────────────────────────────

describe('Tokenizer – line comments', () => {
  const t = new Tokenizer({
    lineComment: '//',
    skipComments: false,
    skipWhitespace: true,
  });

  it('tokenizes a line comment', () => {
    const tokens = t.tokenize('// this is a comment\nhello');
    const comment = tokens.find(tk => tk.type === 'comment');
    assert.ok(comment);
    assert.ok(comment.value.startsWith('//'));
    assert.ok(comment.value.includes('comment'));
  });

  it('skips comment tokens when skipComments is true', () => {
    const t2 = new Tokenizer({ lineComment: '//', skipComments: true });
    const tokens = t2.tokenize('// ignored\nhello');
    assert.equal(tokens.length, 1);
    assert.equal(tokens[0].value, 'hello');
  });

  it('comment runs to end of line only', () => {
    const tokens = t.tokenize('// line one\nnext');
    const ident = tokens.find(tk => tk.type === 'identifier');
    assert.ok(ident);
    assert.equal(ident.value, 'next');
  });
});

describe('Tokenizer – block comments', () => {
  const t = new Tokenizer({
    blockComment: ['/*', '*/'],
    skipComments: false,
    skipWhitespace: true,
  });

  it('tokenizes a block comment', () => {
    const tokens = t.tokenize('/* block */ hello');
    const comment = tokens.find(tk => tk.type === 'comment');
    assert.ok(comment);
    assert.equal(comment.value, '/* block */');
  });

  it('block comment can span multiple lines', () => {
    const tokens = t.tokenize('/*\nline1\nline2\n*/end');
    const comment = tokens.find(tk => tk.type === 'comment');
    assert.ok(comment);
    assert.ok(comment.value.includes('line1'));
    const ident = tokens.find(tk => tk.type === 'identifier');
    assert.equal(ident?.value, 'end');
  });

  it('skips block comment tokens when skipComments is true', () => {
    const t2 = new Tokenizer({ blockComment: ['/*', '*/'], skipComments: true });
    const tokens = t2.tokenize('/* ignored */ hello');
    assert.equal(tokens.length, 1);
    assert.equal(tokens[0].value, 'hello');
  });
});

// ─── Combined / realistic ─────────────────────────────────────────────────────

describe('Tokenizer – realistic source snippet', () => {
  const t = new Tokenizer({
    keywords: ['function', 'return', 'const'],
    operators: ['===', '==', '+=', '+', '-', '*', '/', '='],
    lineComment: '//',
    blockComment: ['/*', '*/'],
  });

  it('tokenizes a JS-like snippet', () => {
    const src = `const x = 42; // answer\nreturn x + 1;`;
    const tokens = t.tokenize(src);
    const types = tokens.map(tk => tk.type);
    assert.ok(types.includes('keyword'));
    assert.ok(types.includes('identifier'));
    assert.ok(types.includes('number'));
    assert.ok(types.includes('operator'));
    assert.ok(types.includes('punctuation'));
    // comment skipped by default
    assert.ok(!types.includes('comment'));
  });

  it('correctly identifies keywords vs identifiers', () => {
    const tokens = t.tokenize('function foo() { return 1; }');
    const kws = tokens.filter(tk => tk.type === 'keyword').map(tk => tk.value);
    assert.deepEqual(kws, ['function', 'return']);
    const idents = tokens.filter(tk => tk.type === 'identifier').map(tk => tk.value);
    assert.ok(idents.includes('foo'));
  });
});
