// ─── Unit Tests: expression-parser ────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  evaluate,
  tokenize,
  parse,
  compile,
} from '../../app/modules/expression-parser.js';

// ─── Basic Arithmetic ────────────────────────────────────────────────────────

describe('basic arithmetic — integers', () => {
  it('adds two integers', () => {
    assert.equal(evaluate('2 + 3'), 5);
  });

  it('subtracts two integers', () => {
    assert.equal(evaluate('10 - 4'), 6);
  });

  it('multiplies two integers', () => {
    assert.equal(evaluate('3 * 4'), 12);
  });

  it('divides two integers', () => {
    assert.equal(evaluate('8 / 2'), 4);
  });

  it('computes modulo', () => {
    assert.equal(evaluate('10 % 3'), 1);
  });

  it('chains multiple additions', () => {
    assert.equal(evaluate('1 + 2 + 3 + 4'), 10);
  });

  it('handles negative integer literal via unary minus', () => {
    assert.equal(evaluate('-7'), -7);
  });
});

describe('basic arithmetic — floats', () => {
  it('adds two floats', () => {
    assert.ok(Math.abs(evaluate('1.5 + 2.5') - 4.0) < 1e-10);
  });

  it('multiplies by a float', () => {
    assert.ok(Math.abs(evaluate('3.14 * 2') - 6.28) < 1e-10);
  });

  it('handles leading-dot float (.5)', () => {
    assert.ok(Math.abs(evaluate('.5 + .5') - 1.0) < 1e-10);
  });

  it('division producing a float', () => {
    assert.ok(Math.abs(evaluate('1 / 4') - 0.25) < 1e-10);
  });
});

// ─── Operator Precedence ─────────────────────────────────────────────────────

describe('operator precedence', () => {
  it('2 + 3 * 4 = 14, not 20', () => {
    assert.equal(evaluate('2 + 3 * 4'), 14);
  });

  it('2 * 3 + 4 * 5 = 26', () => {
    assert.equal(evaluate('2 * 3 + 4 * 5'), 26);
  });

  it('2 * 3^2 = 18 (power before multiply)', () => {
    assert.equal(evaluate('2 * 3^2'), 18);
  });

  it('subtraction then multiplication: 10 - 2 * 3 = 4', () => {
    assert.equal(evaluate('10 - 2 * 3'), 4);
  });

  it('modulo has same precedence as multiplication', () => {
    assert.equal(evaluate('2 + 7 % 3'), 3);
  });
});

// ─── Parentheses ─────────────────────────────────────────────────────────────

describe('parentheses', () => {
  it('overrides precedence: (2 + 3) * 4 = 20', () => {
    assert.equal(evaluate('(2 + 3) * 4'), 20);
  });

  it('nested parentheses', () => {
    assert.equal(evaluate('((2 + 3) * (4 - 1))'), 15);
  });

  it('single-item parentheses', () => {
    assert.equal(evaluate('(42)'), 42);
  });

  it('parentheses after operator', () => {
    assert.equal(evaluate('10 / (2 + 3)'), 2);
  });
});

// ─── Power Operator ──────────────────────────────────────────────────────────

describe('power operator', () => {
  it('2^3 = 8', () => {
    assert.equal(evaluate('2^3'), 8);
  });

  it('2^8 = 256', () => {
    assert.equal(evaluate('2^8'), 256);
  });

  it('is right-associative: 2^3^2 = 2^(3^2) = 512', () => {
    assert.equal(evaluate('2^3^2'), 512);
  });

  it('x^0 = 1', () => {
    assert.equal(evaluate('5^0'), 1);
  });

  it('x^1 = x', () => {
    assert.equal(evaluate('7^1'), 7);
  });

  it('has higher precedence than multiplication', () => {
    // 3 * 2^3 = 3 * 8 = 24
    assert.equal(evaluate('3 * 2^3'), 24);
  });
});

// ─── Variables ───────────────────────────────────────────────────────────────

describe('variables', () => {
  it('evaluates a single variable', () => {
    assert.equal(evaluate('x', { x: 42 }), 42);
  });

  it('uses variable in simple expression', () => {
    assert.equal(evaluate('x + 1', { x: 5 }), 6);
  });

  it('uses multiple variables', () => {
    assert.equal(evaluate('x + y', { x: 3, y: 7 }), 10);
  });

  it('uses variable in polynomial expression', () => {
    // 2 * x^2 + 1  for x=3 → 2*9+1 = 19
    assert.equal(evaluate('2 * x^2 + 1', { x: 3 }), 19);
  });

  it('supports camelCase variable names', () => {
    assert.equal(evaluate('myVar * 2', { myVar: 5 }), 10);
  });

  it('variable with zero value', () => {
    assert.equal(evaluate('x + 5', { x: 0 }), 5);
  });

  it('throws ReferenceError for undefined variable', () => {
    assert.throws(() => evaluate('z'), ReferenceError);
  });
});

// ─── Built-in Functions ──────────────────────────────────────────────────────

describe('built-in functions — single-arg', () => {
  it('sin(0) = 0', () => {
    assert.equal(evaluate('sin(0)'), 0);
  });

  it('cos(0) = 1', () => {
    assert.equal(evaluate('cos(0)'), 1);
  });

  it('tan(0) = 0', () => {
    assert.equal(evaluate('tan(0)'), 0);
  });

  it('sqrt(16) = 4', () => {
    assert.equal(evaluate('sqrt(16)'), 4);
  });

  it('sqrt(2) ≈ Math.SQRT2', () => {
    assert.ok(Math.abs(evaluate('sqrt(2)') - Math.SQRT2) < 1e-10);
  });

  it('abs(-5) = 5', () => {
    assert.equal(evaluate('abs(-5)'), 5);
  });

  it('abs(3) = 3', () => {
    assert.equal(evaluate('abs(3)'), 3);
  });

  it('floor(3.7) = 3', () => {
    assert.equal(evaluate('floor(3.7)'), 3);
  });

  it('ceil(3.2) = 4', () => {
    assert.equal(evaluate('ceil(3.2)'), 4);
  });

  it('round(3.5) = 4', () => {
    assert.equal(evaluate('round(3.5)'), 4);
  });

  it('round(3.4) = 3', () => {
    assert.equal(evaluate('round(3.4)'), 3);
  });

  it('log(e) ≈ 1', () => {
    assert.ok(Math.abs(evaluate('log(2.718281828459045)') - 1) < 1e-6);
  });

  it('exp(0) = 1', () => {
    assert.equal(evaluate('exp(0)'), 1);
  });
});

describe('built-in functions — multi-arg', () => {
  it('min(3, 7) = 3', () => {
    assert.equal(evaluate('min(3, 7)'), 3);
  });

  it('max(3, 7) = 7', () => {
    assert.equal(evaluate('max(3, 7)'), 7);
  });

  it('min with negative', () => {
    assert.equal(evaluate('min(-1, 0)'), -1);
  });

  it('max with negative', () => {
    assert.equal(evaluate('max(-1, 0)'), 0);
  });

  it('nested function calls: abs(min(-3, -7)) = 7', () => {
    assert.equal(evaluate('abs(min(-3, -7))'), 7);
  });
});

// ─── Constants ───────────────────────────────────────────────────────────────

describe('constants', () => {
  it('pi resolves to Math.PI', () => {
    assert.equal(evaluate('pi'), Math.PI);
  });

  it('e resolves to Math.E', () => {
    assert.equal(evaluate('e'), Math.E);
  });

  it('2 * pi', () => {
    assert.ok(Math.abs(evaluate('2 * pi') - 2 * Math.PI) < 1e-10);
  });

  it('pi in trig: sin(pi) ≈ 0', () => {
    assert.ok(Math.abs(evaluate('sin(pi)')) < 1e-10);
  });

  it('log(e) = 1', () => {
    assert.ok(Math.abs(evaluate('log(e)') - 1) < 1e-10);
  });
});

// ─── Unary Minus ─────────────────────────────────────────────────────────────

describe('unary minus', () => {
  it('-3 = -3', () => {
    assert.equal(evaluate('-3'), -3);
  });

  it('-(2+1) = -3', () => {
    assert.equal(evaluate('-(2+1)'), -3);
  });

  it('--5 = 5 (double negation)', () => {
    assert.equal(evaluate('--5'), 5);
  });

  it('-2 * 3 = -6', () => {
    assert.equal(evaluate('-2 * 3'), -6);
  });

  it('10 + -3 = 7', () => {
    assert.equal(evaluate('10 + -3'), 7);
  });

  it('-x with variable', () => {
    assert.equal(evaluate('-x', { x: 4 }), -4);
  });

  it('-x^2 = -(x^2), not (-x)^2', () => {
    // -x^2 with x=3 → -(3^2) = -9, NOT (-3)^2 = 9
    assert.equal(evaluate('-x^2', { x: 3 }), -9);
  });
});

// ─── tokenize() ──────────────────────────────────────────────────────────────

describe('tokenize()', () => {
  it('tokenizes a number', () => {
    const toks = tokenize('42');
    assert.equal(toks.length, 1);
    assert.equal(toks[0].type, 'number');
    assert.equal(toks[0].value, '42');
  });

  it('tokenizes a float', () => {
    const toks = tokenize('3.14');
    assert.equal(toks[0].type, 'number');
    assert.equal(toks[0].value, '3.14');
  });

  it('tokenizes an identifier', () => {
    const toks = tokenize('myVar');
    assert.equal(toks[0].type, 'identifier');
    assert.equal(toks[0].value, 'myVar');
  });

  it('tokenizes operators', () => {
    const toks = tokenize('+ - * / % ^');
    const ops = toks.filter((t) => t.type === 'operator').map((t) => t.value);
    assert.deepEqual(ops, ['+', '-', '*', '/', '%', '^']);
  });

  it('tokenizes parentheses', () => {
    const toks = tokenize('(x)');
    assert.equal(toks[0].type, 'lparen');
    assert.equal(toks[1].type, 'identifier');
    assert.equal(toks[2].type, 'rparen');
  });

  it('tokenizes a full expression', () => {
    const toks = tokenize('2 + 3 * x');
    assert.equal(toks.length, 5);
    assert.equal(toks[0].type, 'number');
    assert.equal(toks[1].type, 'operator');
    assert.equal(toks[2].type, 'number');
    assert.equal(toks[3].type, 'operator');
    assert.equal(toks[4].type, 'identifier');
  });

  it('skips whitespace', () => {
    const toks = tokenize('  1  +  2  ');
    assert.equal(toks.length, 3);
  });

  it('throws SyntaxError on unknown character', () => {
    assert.throws(() => tokenize('1 @ 2'), SyntaxError);
  });
});

// ─── parse() — AST node types ────────────────────────────────────────────────

describe('parse() — AST structure', () => {
  it('number literal produces NumberNode', () => {
    const ast = parse('42');
    assert.equal(ast.type, 'number');
    assert.equal(ast.value, 42);
  });

  it('identifier produces IdentifierNode', () => {
    const ast = parse('x');
    assert.equal(ast.type, 'identifier');
    assert.equal(ast.name, 'x');
  });

  it('addition produces BinaryNode with op "+"', () => {
    const ast = parse('1 + 2');
    assert.equal(ast.type, 'binary');
    assert.equal(ast.op, '+');
  });

  it('binary node has left and right children', () => {
    const ast = parse('3 * 4');
    assert.equal(ast.type, 'binary');
    assert.equal(ast.left.type, 'number');
    assert.equal(ast.right.type, 'number');
  });

  it('unary minus produces UnaryNode', () => {
    const ast = parse('-5');
    assert.equal(ast.type, 'unary');
    assert.equal(ast.op, '-');
    assert.equal(ast.operand.type, 'number');
  });

  it('function call produces CallNode', () => {
    const ast = parse('sqrt(9)');
    assert.equal(ast.type, 'call');
    assert.equal(ast.name, 'sqrt');
    assert.equal(ast.args.length, 1);
    assert.equal(ast.args[0].type, 'number');
  });

  it('multi-arg call has correct arg count', () => {
    const ast = parse('max(1, 2)');
    assert.equal(ast.type, 'call');
    assert.equal(ast.args.length, 2);
  });

  it('nested binary: correct tree for 2 + 3 * 4', () => {
    // Should parse as 2 + (3*4), so root is binary '+', right is binary '*'
    const ast = parse('2 + 3 * 4');
    assert.equal(ast.type, 'binary');
    assert.equal(ast.op, '+');
    assert.equal(ast.right.type, 'binary');
    assert.equal(ast.right.op, '*');
  });

  it('throws SyntaxError on empty input', () => {
    assert.throws(() => parse(''), SyntaxError);
  });

  it('throws SyntaxError on missing closing parenthesis', () => {
    assert.throws(() => parse('(1 + 2'), SyntaxError);
  });

  it('throws SyntaxError on unexpected operator', () => {
    assert.throws(() => parse('1 + * 2'), SyntaxError);
  });
});

// ─── compile() ───────────────────────────────────────────────────────────────

describe('compile()', () => {
  it('returns a function', () => {
    const fn = compile('2 + 3');
    assert.equal(typeof fn, 'function');
  });

  it('compiled function returns correct result with no variables', () => {
    const fn = compile('2 + 3');
    assert.equal(fn(), 5);
  });

  it('compiled function accepts variable bindings', () => {
    const fn = compile('x * 2');
    assert.equal(fn({ x: 5 }), 10);
    assert.equal(fn({ x: 7 }), 14);
  });

  it('compiled function is reusable with different variable sets', () => {
    const fn = compile('a + b');
    assert.equal(fn({ a: 1, b: 2 }), 3);
    assert.equal(fn({ a: 10, b: 20 }), 30);
  });

  it('parses the expression only once (reuse AST)', () => {
    // Call many times — no error is a proxy for stability
    const fn = compile('sin(x)^2 + cos(x)^2');
    for (let x = 0; x <= 1; x += 0.1) {
      const result = fn({ x });
      assert.ok(Math.abs(result - 1) < 1e-10, `Pythagorean identity failed at x=${x}`);
    }
  });

  it('throws SyntaxError at compile time for bad expression', () => {
    assert.throws(() => compile('1 +'), SyntaxError);
  });

  it('compiled function with constants (pi, e)', () => {
    const fn = compile('2 * pi');
    assert.ok(Math.abs(fn() - 2 * Math.PI) < 1e-10);
  });
});

// ─── Error Cases ─────────────────────────────────────────────────────────────

describe('error cases', () => {
  it('unknown variable throws ReferenceError', () => {
    assert.throws(() => evaluate('unknownVar'), ReferenceError);
  });

  it('division by zero gives Infinity (not an exception)', () => {
    assert.equal(evaluate('1 / 0'), Infinity);
  });

  it('negative division by zero gives -Infinity', () => {
    assert.equal(evaluate('-1 / 0'), -Infinity);
  });

  it('bad syntax throws SyntaxError', () => {
    assert.throws(() => evaluate('1 +'), SyntaxError);
  });

  it('unknown function throws ReferenceError', () => {
    assert.throws(() => evaluate('foo(1)'), ReferenceError);
  });

  it('unknown character throws SyntaxError', () => {
    assert.throws(() => evaluate('1 @ 2'), SyntaxError);
  });

  it('trailing garbage throws SyntaxError', () => {
    assert.throws(() => evaluate('1 + 2 garbage'), SyntaxError);
  });

  it('empty expression throws SyntaxError', () => {
    assert.throws(() => evaluate(''), SyntaxError);
  });
});
