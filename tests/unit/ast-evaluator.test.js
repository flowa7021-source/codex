// ─── Unit Tests: AST Evaluator ───────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { evalAST, evaluate, builtins } from '../../app/modules/ast-evaluator.js';
import { parseExpr } from '../../app/modules/expr-parser.js';

// ─── Helper ───────────────────────────────────────────────────────────────────

/** Assert two numbers are approximately equal (within epsilon). */
function assertClose(actual, expected, eps = 1e-10) {
  assert.ok(
    Math.abs(actual - expected) <= eps,
    `Expected ${actual} ≈ ${expected} (eps=${eps})`,
  );
}

// ─── Simple arithmetic ────────────────────────────────────────────────────────

describe('evaluate – simple arithmetic', () => {
  it('evaluates integer addition', () => {
    assert.equal(evaluate('1 + 2'), 3);
  });

  it('evaluates subtraction', () => {
    assert.equal(evaluate('10 - 4'), 6);
  });

  it('evaluates multiplication', () => {
    assert.equal(evaluate('3 * 4'), 12);
  });

  it('evaluates division', () => {
    assert.equal(evaluate('10 / 4'), 2.5);
  });

  it('evaluates exponentiation', () => {
    assert.equal(evaluate('2 ^ 10'), 1024);
  });

  it('respects operator precedence', () => {
    assert.equal(evaluate('2 + 3 * 4'), 14);
  });

  it('parentheses override precedence', () => {
    assert.equal(evaluate('(2 + 3) * 4'), 20);
  });

  it('evaluates unary minus', () => {
    assert.equal(evaluate('-5'), -5);
  });

  it('unary minus in expression', () => {
    assert.equal(evaluate('10 + -3'), 7);
  });

  it('chained operations', () => {
    assert.equal(evaluate('1 + 2 + 3 + 4'), 10);
  });

  it('evaluates a number literal', () => {
    assert.equal(evaluate('42'), 42);
  });

  it('right-associative exponentiation', () => {
    // 2^3^2 = 2^(3^2) = 2^9 = 512
    assert.equal(evaluate('2 ^ 3 ^ 2'), 512);
  });
});

// ─── Variables ────────────────────────────────────────────────────────────────

describe('evaluate – variables', () => {
  it('evaluates a single variable', () => {
    assert.equal(evaluate('x', { x: 7 }), 7);
  });

  it('evaluates an expression with variables', () => {
    assert.equal(evaluate('x + y', { x: 3, y: 4 }), 7);
  });

  it('evaluates quadratic with substitution', () => {
    // x^2 + 2x + 1 at x=3  →  9 + 6 + 1 = 16
    assert.equal(evaluate('x ^ 2 + 2 * x + 1', { x: 3 }), 16);
  });

  it('throws ReferenceError for undefined variable', () => {
    assert.throws(() => evaluate('z'), ReferenceError);
  });

  it('throws ReferenceError for missing variable in expression', () => {
    assert.throws(() => evaluate('x + y', { x: 1 }), ReferenceError);
  });

  it('env variable overrides built-in constant', () => {
    // Override PI with 3
    assert.equal(evaluate('PI', { PI: 3 }), 3);
  });
});

// ─── Built-in functions ───────────────────────────────────────────────────────

describe('evaluate – built-in functions', () => {
  it('sin(0) = 0', () => {
    assertClose(evaluate('sin(0)'), 0);
  });

  it('cos(0) = 1', () => {
    assertClose(evaluate('cos(0)'), 1);
  });

  it('sqrt(4) = 2', () => {
    assertClose(evaluate('sqrt(4)'), 2);
  });

  it('abs(-7) = 7', () => {
    assert.equal(evaluate('abs(-7)'), 7);
  });

  it('floor(3.7) = 3', () => {
    assert.equal(evaluate('floor(3.7)'), 3);
  });

  it('ceil(3.2) = 4', () => {
    assert.equal(evaluate('ceil(3.2)'), 4);
  });

  it('round(2.5) = 3', () => {
    assert.equal(evaluate('round(2.5)'), 3);
  });

  it('exp(0) = 1', () => {
    assertClose(evaluate('exp(0)'), 1);
  });

  it('log(E) = 1', () => {
    assertClose(evaluate('log(E)'), 1);
  });

  it('max(3, 5) = 5', () => {
    assert.equal(evaluate('max(3, 5)'), 5);
  });

  it('min(3, 5) = 3', () => {
    assert.equal(evaluate('min(3, 5)'), 3);
  });

  it('pow(2, 8) = 256', () => {
    assert.equal(evaluate('pow(2, 8)'), 256);
  });

  it('PI is approximately 3.14159…', () => {
    assertClose(evaluate('PI'), Math.PI, 1e-10);
  });

  it('E is approximately 2.71828…', () => {
    assertClose(evaluate('E'), Math.E, 1e-10);
  });

  it('sin(PI / 2) = 1', () => {
    assertClose(evaluate('sin(PI / 2)'), 1, 1e-10);
  });

  it('tan(PI / 4) ≈ 1', () => {
    assertClose(evaluate('tan(PI / 4)'), 1, 1e-10);
  });
});

// ─── Custom functions ─────────────────────────────────────────────────────────

describe('evaluate – custom functions', () => {
  it('supports a custom single-arg function', () => {
    assert.equal(evaluate('double(x)', { x: 5, double: (n) => n * 2 }), 10);
  });

  it('supports a custom two-arg function', () => {
    const add = (a, b) => a + b;
    assert.equal(evaluate('add(3, 4)', { add }), 7);
  });

  it('custom function can call itself indirectly via expression', () => {
    const env = {
      x: 4,
      half: (n) => n / 2,
    };
    assert.equal(evaluate('half(x) + half(x)', env), 4);
  });

  it('throws TypeError when calling a number as a function', () => {
    assert.throws(() => evaluate('x(1)', { x: 5 }), TypeError);
  });

  it('throws ReferenceError for undefined function', () => {
    assert.throws(() => evaluate('unknownFn(1)'), ReferenceError);
  });
});

// ─── evalAST directly ─────────────────────────────────────────────────────────

describe('evalAST – direct node evaluation', () => {
  it('evaluates a number node', () => {
    assert.equal(evalAST({ type: 'number', value: 99 }), 99);
  });

  it('evaluates a binary node', () => {
    const node = parseExpr('7 * 6');
    assert.equal(evalAST(node), 42);
  });

  it('evaluates with no env (uses only builtins)', () => {
    const node = parseExpr('sqrt(16)');
    assert.equal(evalAST(node), 4);
  });
});

// ─── builtins object ─────────────────────────────────────────────────────────

describe('builtins', () => {
  it('contains sin, cos, tan', () => {
    assert.equal(typeof builtins.sin, 'function');
    assert.equal(typeof builtins.cos, 'function');
    assert.equal(typeof builtins.tan, 'function');
  });

  it('contains sqrt, abs, floor, ceil, round, log, exp', () => {
    for (const name of ['sqrt', 'abs', 'floor', 'ceil', 'round', 'log', 'exp']) {
      assert.equal(typeof builtins[name], 'function', `${name} should be a function`);
    }
  });

  it('contains max, min, pow', () => {
    assert.equal(typeof builtins.max, 'function');
    assert.equal(typeof builtins.min, 'function');
    assert.equal(typeof builtins.pow, 'function');
  });

  it('contains numeric constants PI and E', () => {
    assert.equal(typeof builtins.PI, 'number');
    assert.equal(typeof builtins.E, 'number');
    assertClose(/** @type {number} */(builtins.PI), Math.PI, 1e-15);
    assertClose(/** @type {number} */(builtins.E), Math.E, 1e-15);
  });
});
