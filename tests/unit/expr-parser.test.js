// ─── Unit Tests: Expression Parser ───────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { ExprParser, parseExpr } from '../../app/modules/expr-parser.js';

// ─── Number literals ──────────────────────────────────────────────────────────

describe('parseExpr – number literals', () => {
  it('parses an integer', () => {
    const node = parseExpr('42');
    assert.deepEqual(node, { type: 'number', value: 42 });
  });

  it('parses a decimal', () => {
    const node = parseExpr('3.14');
    assert.deepEqual(node, { type: 'number', value: 3.14 });
  });

  it('parses zero', () => {
    const node = parseExpr('0');
    assert.deepEqual(node, { type: 'number', value: 0 });
  });

  it('parses scientific notation', () => {
    const node = parseExpr('1e3');
    assert.deepEqual(node, { type: 'number', value: 1000 });
  });

  it('parses negative scientific notation', () => {
    const node = parseExpr('2.5e-2');
    assert.ok(node.type === 'number');
    assert.ok(Math.abs(node.value - 0.025) < 1e-10);
  });
});

// ─── Variables ────────────────────────────────────────────────────────────────

describe('parseExpr – variables', () => {
  it('parses a single letter variable', () => {
    assert.deepEqual(parseExpr('x'), { type: 'variable', name: 'x' });
  });

  it('parses a multi-character variable', () => {
    assert.deepEqual(parseExpr('myVar'), { type: 'variable', name: 'myVar' });
  });

  it('parses a variable with underscores and digits', () => {
    assert.deepEqual(parseExpr('x_1'), { type: 'variable', name: 'x_1' });
  });
});

// ─── Unary minus ──────────────────────────────────────────────────────────────

describe('parseExpr – unary minus', () => {
  it('parses unary minus on a number', () => {
    const node = parseExpr('-5');
    assert.deepEqual(node, { type: 'unary', op: '-', operand: { type: 'number', value: 5 } });
  });

  it('parses double unary minus', () => {
    const node = parseExpr('--x');
    assert.deepEqual(node, {
      type: 'unary', op: '-',
      operand: { type: 'unary', op: '-', operand: { type: 'variable', name: 'x' } },
    });
  });

  it('unary minus binds tighter than multiplication', () => {
    // -x * y  →  (-x) * y
    const node = parseExpr('-x * y');
    assert.equal(node.type, 'binary');
    assert.ok(node.type === 'binary');
    assert.equal(node.op, '*');
    assert.deepEqual(node.left, { type: 'unary', op: '-', operand: { type: 'variable', name: 'x' } });
  });
});

// ─── Binary operators ─────────────────────────────────────────────────────────

describe('parseExpr – binary operators', () => {
  it('parses addition', () => {
    const node = parseExpr('a + b');
    assert.deepEqual(node, {
      type: 'binary', op: '+',
      left: { type: 'variable', name: 'a' },
      right: { type: 'variable', name: 'b' },
    });
  });

  it('parses subtraction', () => {
    const node = parseExpr('a - b');
    assert.ok(node.type === 'binary');
    assert.equal(node.op, '-');
  });

  it('parses multiplication', () => {
    const node = parseExpr('a * b');
    assert.ok(node.type === 'binary');
    assert.equal(node.op, '*');
  });

  it('parses division', () => {
    const node = parseExpr('a / b');
    assert.ok(node.type === 'binary');
    assert.equal(node.op, '/');
  });

  it('parses exponentiation', () => {
    const node = parseExpr('x ^ 2');
    assert.ok(node.type === 'binary');
    assert.equal(node.op, '^');
    assert.deepEqual(node.left, { type: 'variable', name: 'x' });
    assert.deepEqual(node.right, { type: 'number', value: 2 });
  });
});

// ─── Operator precedence ──────────────────────────────────────────────────────

describe('parseExpr – operator precedence', () => {
  it('* binds tighter than +', () => {
    // 1 + 2 * 3  →  1 + (2 * 3)
    const node = parseExpr('1 + 2 * 3');
    assert.ok(node.type === 'binary');
    assert.equal(node.op, '+');
    assert.deepEqual(node.left, { type: 'number', value: 1 });
    assert.ok(node.right.type === 'binary');
    assert.equal(node.right.op, '*');
  });

  it('* binds tighter than -', () => {
    // 6 - 2 * 3  →  6 - (2 * 3)
    const node = parseExpr('6 - 2 * 3');
    assert.ok(node.type === 'binary');
    assert.equal(node.op, '-');
    assert.ok(node.right.type === 'binary' && node.right.op === '*');
  });

  it('^ binds tighter than *', () => {
    // 2 * x ^ 3  →  2 * (x ^ 3)
    const node = parseExpr('2 * x ^ 3');
    assert.ok(node.type === 'binary');
    assert.equal(node.op, '*');
    assert.ok(node.right.type === 'binary' && node.right.op === '^');
  });

  it('^ is right-associative', () => {
    // 2 ^ 3 ^ 2  →  2 ^ (3 ^ 2)
    const node = parseExpr('2 ^ 3 ^ 2');
    assert.ok(node.type === 'binary');
    assert.equal(node.op, '^');
    assert.ok(node.right.type === 'binary' && node.right.op === '^');
  });

  it('+ and - are left-associative', () => {
    // 1 - 2 + 3  →  (1 - 2) + 3
    const node = parseExpr('1 - 2 + 3');
    assert.ok(node.type === 'binary');
    assert.equal(node.op, '+');
    assert.ok(node.left.type === 'binary' && node.left.op === '-');
  });
});

// ─── Parentheses ──────────────────────────────────────────────────────────────

describe('parseExpr – parentheses', () => {
  it('parentheses override precedence', () => {
    // (1 + 2) * 3  →  * with + on left
    const node = parseExpr('(1 + 2) * 3');
    assert.ok(node.type === 'binary');
    assert.equal(node.op, '*');
    assert.ok(node.left.type === 'binary' && node.left.op === '+');
  });

  it('nested parentheses', () => {
    const node = parseExpr('((x))');
    assert.deepEqual(node, { type: 'variable', name: 'x' });
  });

  it('parentheses around unary minus', () => {
    const node = parseExpr('(-x)');
    assert.deepEqual(node, { type: 'unary', op: '-', operand: { type: 'variable', name: 'x' } });
  });
});

// ─── Function calls ───────────────────────────────────────────────────────────

describe('parseExpr – function calls', () => {
  it('parses a no-arg call', () => {
    const node = parseExpr('f()');
    assert.deepEqual(node, { type: 'call', name: 'f', args: [] });
  });

  it('parses a single-arg call', () => {
    const node = parseExpr('sin(x)');
    assert.deepEqual(node, {
      type: 'call', name: 'sin',
      args: [{ type: 'variable', name: 'x' }],
    });
  });

  it('parses a two-arg call', () => {
    const node = parseExpr('max(a, b)');
    assert.ok(node.type === 'call');
    assert.equal(node.name, 'max');
    assert.equal(node.args.length, 2);
    assert.deepEqual(node.args[0], { type: 'variable', name: 'a' });
    assert.deepEqual(node.args[1], { type: 'variable', name: 'b' });
  });

  it('parses a multi-arg call with expressions', () => {
    const node = parseExpr('pow(x + 1, 2)');
    assert.ok(node.type === 'call');
    assert.equal(node.name, 'pow');
    assert.equal(node.args.length, 2);
  });

  it('parses nested function calls', () => {
    const node = parseExpr('sin(cos(x))');
    assert.ok(node.type === 'call' && node.name === 'sin');
    assert.ok(node.args[0].type === 'call' && node.args[0].name === 'cos');
  });
});

// ─── ExprParser class ─────────────────────────────────────────────────────────

describe('ExprParser class', () => {
  it('parse() returns the same result as parseExpr()', () => {
    const expr = '2 + 3 * x';
    assert.deepEqual(new ExprParser(expr).parse(), parseExpr(expr));
  });

  it('throws SyntaxError on invalid input', () => {
    assert.throws(() => parseExpr('1 + '), SyntaxError);
  });

  it('throws SyntaxError on unexpected character', () => {
    assert.throws(() => parseExpr('1 @ 2'), SyntaxError);
  });

  it('throws SyntaxError on unmatched paren', () => {
    assert.throws(() => parseExpr('(1 + 2'), SyntaxError);
  });

  it('throws SyntaxError on trailing tokens', () => {
    assert.throws(() => parseExpr('1 2'), SyntaxError);
  });
});
