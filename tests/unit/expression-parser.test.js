// ─── Unit Tests: expression-parser ────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  parseExpression,
  evaluateAST,
  evaluate,
} from '../../app/modules/expression-parser.js';

// ─── Basic arithmetic ─────────────────────────────────────────────────────────

describe('basic arithmetic', () => {
  it('evaluates addition', () => {
    assert.equal(evaluate('2 + 3'), 5);
  });

  it('evaluates subtraction', () => {
    assert.equal(evaluate('10 - 4'), 6);
  });

  it('evaluates multiplication', () => {
    assert.equal(evaluate('3 * 4'), 12);
  });

  it('evaluates division', () => {
    assert.equal(evaluate('8 / 2'), 4);
  });

  it('evaluates modulo', () => {
    assert.equal(evaluate('10 % 3'), 1);
  });

  it('respects operator precedence: multiplication before addition', () => {
    assert.equal(evaluate('2 + 3 * 4'), 14);
  });

  it('respects parentheses', () => {
    assert.equal(evaluate('(2 + 3) * 4'), 20);
  });

  it('handles chained addition', () => {
    assert.equal(evaluate('1 + 2 + 3 + 4'), 10);
  });

  it('handles decimal numbers', () => {
    assert.ok(Math.abs(evaluate('3.14 * 2') - 6.28) < 1e-10);
  });
});

// ─── Power operator ───────────────────────────────────────────────────────────

describe('power operator', () => {
  it('evaluates 2^8', () => {
    assert.equal(evaluate('2^8'), 256);
  });

  it('evaluates 3^3', () => {
    assert.equal(evaluate('3^3'), 27);
  });

  it('is right-associative: 2^3^2 = 2^(3^2) = 512', () => {
    assert.equal(evaluate('2^3^2'), 512);
  });

  it('evaluates power with precedence over multiplication', () => {
    assert.equal(evaluate('2 * 3^2'), 18);
  });
});

// ─── Unary minus ──────────────────────────────────────────────────────────────

describe('unary minus', () => {
  it('negates a number literal', () => {
    assert.equal(evaluate('-5'), -5);
  });

  it('negates a parenthesised expression', () => {
    assert.equal(evaluate('-(2+3)'), -5);
  });

  it('double negation', () => {
    assert.equal(evaluate('--5'), 5);
  });

  it('unary minus with multiplication', () => {
    assert.equal(evaluate('-2 * 3'), -6);
  });

  it('unary minus in expression', () => {
    assert.equal(evaluate('10 + -3'), 7);
  });
});

// ─── Variables ────────────────────────────────────────────────────────────────

describe('variables', () => {
  it('evaluates a single variable', () => {
    assert.equal(evaluate('x', { x: 42 }), 42);
  });

  it('uses variable in expression', () => {
    assert.equal(evaluate('x + 1', { x: 5 }), 6);
  });

  it('uses multiple variables', () => {
    assert.equal(evaluate('x + y', { x: 3, y: 7 }), 10);
  });

  it('uses variable in complex expression', () => {
    assert.equal(evaluate('2 * x^2 + 1', { x: 3 }), 19);
  });

  it('throws ReferenceError for undefined variable', () => {
    assert.throws(() => evaluate('z'), (err) => err instanceof ReferenceError);
  });
});

// ─── Built-in functions ───────────────────────────────────────────────────────

describe('built-in functions', () => {
  it('abs of negative', () => {
    assert.equal(evaluate('abs(-5)'), 5);
  });

  it('abs of positive', () => {
    assert.equal(evaluate('abs(3)'), 3);
  });

  it('sqrt of 16', () => {
    assert.equal(evaluate('sqrt(16)'), 4);
  });

  it('sqrt of 2 is approximately 1.414', () => {
    assert.ok(Math.abs(evaluate('sqrt(2)') - Math.SQRT2) < 1e-10);
  });

  it('sin of 0', () => {
    assert.equal(evaluate('sin(0)'), 0);
  });

  it('cos of 0', () => {
    assert.equal(evaluate('cos(0)'), 1);
  });

  it('tan of 0', () => {
    assert.equal(evaluate('tan(0)'), 0);
  });

  it('log of e is 1', () => {
    assert.ok(Math.abs(evaluate('log(2.718281828459045)') - 1) < 1e-6);
  });

  it('floor of 3.7', () => {
    assert.equal(evaluate('floor(3.7)'), 3);
  });

  it('ceil of 3.2', () => {
    assert.equal(evaluate('ceil(3.2)'), 4);
  });

  it('round of 3.5', () => {
    assert.equal(evaluate('round(3.5)'), 4);
  });

  it('round of 3.4', () => {
    assert.equal(evaluate('round(3.4)'), 3);
  });

  it('max of 3 and 7', () => {
    assert.equal(evaluate('max(3, 7)'), 7);
  });

  it('min of 3 and 7', () => {
    assert.equal(evaluate('min(3, 7)'), 3);
  });

  it('nested function call', () => {
    assert.equal(evaluate('abs(min(-3, -7))'), 7);
  });
});

// ─── parseExpression and evaluateAST ─────────────────────────────────────────

describe('parseExpression', () => {
  it('returns a ParseNode with the correct structure for a number', () => {
    const node = parseExpression('42');
    assert.equal(node.type, 'number');
    assert.equal(node.value, 42);
  });

  it('returns binary node for addition', () => {
    const node = parseExpression('1 + 2');
    assert.equal(node.type, 'binary');
    assert.equal(node.op, '+');
  });

  it('returns call node for function', () => {
    const node = parseExpression('sqrt(9)');
    assert.equal(node.type, 'call');
    assert.equal(node.name, 'sqrt');
    assert.equal(node.args?.length, 1);
  });
});

describe('evaluateAST', () => {
  it('evaluates a pre-parsed AST', () => {
    const ast = parseExpression('3 * (4 + 5)');
    assert.equal(evaluateAST(ast), 27);
  });

  it('evaluates with variable bindings', () => {
    const ast = parseExpression('a * b');
    assert.equal(evaluateAST(ast, { a: 6, b: 7 }), 42);
  });
});

// ─── Error handling ───────────────────────────────────────────────────────────

describe('syntax errors', () => {
  it('throws on empty expression', () => {
    assert.throws(() => parseExpression(''), (err) => err instanceof SyntaxError);
  });

  it('throws on missing closing parenthesis', () => {
    assert.throws(() => parseExpression('(1 + 2'), (err) => err instanceof SyntaxError);
  });

  it('throws on unexpected operator', () => {
    assert.throws(() => parseExpression('1 + * 2'), (err) => err instanceof SyntaxError);
  });

  it('throws on unknown character', () => {
    assert.throws(() => parseExpression('1 @ 2'), (err) => err instanceof SyntaxError);
  });

  it('throws on unknown function', () => {
    assert.throws(() => evaluate('foo(1)'), (err) => err instanceof ReferenceError);
  });

  it('throws on trailing garbage', () => {
    assert.throws(() => parseExpression('1 + 2 garbage'), (err) => err instanceof SyntaxError);
  });
});
