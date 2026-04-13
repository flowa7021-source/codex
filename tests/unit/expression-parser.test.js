// ─── Unit Tests: expression-parser ────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  evaluate,
  tokenize,
  parse,
  ExpressionError,
} from '../../app/modules/expression-parser.js';

// ─── ExpressionError ─────────────────────────────────────────────────────────

describe('ExpressionError', () => {
  it('is an instance of Error', () => {
    const err = new ExpressionError('test');
    assert.ok(err instanceof Error);
  });

  it('has name "ExpressionError"', () => {
    const err = new ExpressionError('oops');
    assert.equal(err.name, 'ExpressionError');
  });

  it('carries the message', () => {
    const err = new ExpressionError('bad input');
    assert.equal(err.message, 'bad input');
  });

  it('is an instance of ExpressionError', () => {
    const err = new ExpressionError('x');
    assert.ok(err instanceof ExpressionError);
  });
});

// ─── tokenize() — basic tokens ───────────────────────────────────────────────

describe('tokenize() — numbers', () => {
  it('tokenizes an integer', () => {
    const toks = tokenize('42');
    assert.equal(toks.length, 1);
    assert.equal(toks[0].type, 'number');
    assert.equal(toks[0].value, '42');
  });

  it('tokenizes a decimal float', () => {
    const toks = tokenize('3.14');
    assert.equal(toks.length, 1);
    assert.equal(toks[0].type, 'number');
    assert.equal(toks[0].value, '3.14');
  });

  it('tokenizes a leading-dot float', () => {
    const toks = tokenize('.5');
    assert.equal(toks.length, 1);
    assert.equal(toks[0].type, 'number');
    assert.equal(toks[0].value, '.5');
  });

  it('tokenizes zero', () => {
    const toks = tokenize('0');
    assert.equal(toks[0].type, 'number');
    assert.equal(toks[0].value, '0');
  });
});

describe('tokenize() — identifiers', () => {
  it('tokenizes a simple identifier with type "ident"', () => {
    const toks = tokenize('x');
    assert.equal(toks.length, 1);
    assert.equal(toks[0].type, 'ident');
    assert.equal(toks[0].value, 'x');
  });

  it('tokenizes a camelCase identifier', () => {
    const toks = tokenize('myVar');
    assert.equal(toks[0].type, 'ident');
    assert.equal(toks[0].value, 'myVar');
  });

  it('tokenizes an identifier with underscore', () => {
    const toks = tokenize('_foo');
    assert.equal(toks[0].type, 'ident');
    assert.equal(toks[0].value, '_foo');
  });

  it('tokenizes an identifier with digits (not at start)', () => {
    const toks = tokenize('x2');
    assert.equal(toks[0].type, 'ident');
    assert.equal(toks[0].value, 'x2');
  });
});

describe('tokenize() — operators', () => {
  it('tokenizes "+" with type "op"', () => {
    const toks = tokenize('+');
    assert.equal(toks[0].type, 'op');
    assert.equal(toks[0].value, '+');
  });

  it('tokenizes "-" with type "op"', () => {
    const toks = tokenize('-');
    assert.equal(toks[0].type, 'op');
    assert.equal(toks[0].value, '-');
  });

  it('tokenizes "*" with type "op"', () => {
    const toks = tokenize('*');
    assert.equal(toks[0].type, 'op');
    assert.equal(toks[0].value, '*');
  });

  it('tokenizes "/" with type "op"', () => {
    const toks = tokenize('/');
    assert.equal(toks[0].type, 'op');
    assert.equal(toks[0].value, '/');
  });

  it('tokenizes "^" with type "op"', () => {
    const toks = tokenize('^');
    assert.equal(toks[0].type, 'op');
    assert.equal(toks[0].value, '^');
  });

  it('tokenizes all five operators from expression', () => {
    const toks = tokenize('a+b-c*d/e^f');
    const ops = toks.filter(t => t.type === 'op').map(t => t.value);
    assert.deepEqual(ops, ['+', '-', '*', '/', '^']);
  });
});

describe('tokenize() — parentheses and whitespace', () => {
  it('tokenizes "(" with type "lparen"', () => {
    const toks = tokenize('(');
    assert.equal(toks[0].type, 'lparen');
    assert.equal(toks[0].value, '(');
  });

  it('tokenizes ")" with type "rparen"', () => {
    const toks = tokenize(')');
    assert.equal(toks[0].type, 'rparen');
    assert.equal(toks[0].value, ')');
  });

  it('skips spaces', () => {
    const toks = tokenize('  1  +  2  ');
    assert.equal(toks.length, 3);
  });

  it('skips tabs and newlines', () => {
    const toks = tokenize('1\t+\n2');
    assert.equal(toks.length, 3);
  });

  it('tokenizes a full expression correctly', () => {
    const toks = tokenize('2 + 3 * x');
    assert.equal(toks.length, 5);
    assert.equal(toks[0].type, 'number');
    assert.equal(toks[1].type, 'op');
    assert.equal(toks[2].type, 'number');
    assert.equal(toks[3].type, 'op');
    assert.equal(toks[4].type, 'ident');
  });

  it('tokenizes parenthesised expression', () => {
    const toks = tokenize('(x)');
    assert.equal(toks[0].type, 'lparen');
    assert.equal(toks[1].type, 'ident');
    assert.equal(toks[2].type, 'rparen');
  });
});

describe('tokenize() — error cases', () => {
  it('throws ExpressionError on "@" character', () => {
    assert.throws(() => tokenize('1 @ 2'), ExpressionError);
  });

  it('throws ExpressionError on "#" character', () => {
    assert.throws(() => tokenize('1 # 2'), ExpressionError);
  });

  it('throws ExpressionError on "%" character (not supported)', () => {
    assert.throws(() => tokenize('7 % 3'), ExpressionError);
  });

  it('returns empty array for empty string', () => {
    assert.deepEqual(tokenize(''), []);
  });

  it('returns empty array for whitespace-only string', () => {
    assert.deepEqual(tokenize('   '), []);
  });
});

// ─── parse() — AST structure ──────────────────────────────────────────────────

describe('parse() — NumberNode', () => {
  it('integer literal produces NumberNode', () => {
    const ast = parse('42');
    assert.equal(ast.type, 'number');
    assert.equal(ast.value, 42);
  });

  it('float literal produces NumberNode', () => {
    const ast = parse('3.14');
    assert.equal(ast.type, 'number');
    assert.ok(Math.abs(ast.value - 3.14) < 1e-10);
  });

  it('zero produces NumberNode with value 0', () => {
    const ast = parse('0');
    assert.equal(ast.type, 'number');
    assert.equal(ast.value, 0);
  });
});

describe('parse() — VariableNode', () => {
  it('identifier produces VariableNode with type "variable"', () => {
    const ast = parse('x');
    assert.equal(ast.type, 'variable');
    assert.equal(ast.name, 'x');
  });

  it('multi-char identifier produces VariableNode', () => {
    const ast = parse('myVar');
    assert.equal(ast.type, 'variable');
    assert.equal(ast.name, 'myVar');
  });

  it('underscore-prefixed identifier produces VariableNode', () => {
    const ast = parse('_x');
    assert.equal(ast.type, 'variable');
    assert.equal(ast.name, '_x');
  });
});

describe('parse() — UnaryNode', () => {
  it('unary minus produces UnaryNode', () => {
    const ast = parse('-5');
    assert.equal(ast.type, 'unary');
    assert.equal(ast.op, '-');
  });

  it('unary node has operand that is a NumberNode', () => {
    const ast = parse('-5');
    assert.equal(ast.type, 'unary');
    assert.equal(ast.operand.type, 'number');
    assert.equal(ast.operand.value, 5);
  });

  it('double unary minus wraps correctly', () => {
    const ast = parse('--3');
    assert.equal(ast.type, 'unary');
    assert.equal(ast.op, '-');
    assert.equal(ast.operand.type, 'unary');
  });
});

describe('parse() — BinaryNode', () => {
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

  it('lower precedence op is root: 2 + 3 * 4', () => {
    const ast = parse('2 + 3 * 4');
    assert.equal(ast.type, 'binary');
    assert.equal(ast.op, '+');
    assert.equal(ast.right.type, 'binary');
    assert.equal(ast.right.op, '*');
  });

  it('power is right-associative in AST: 2^3^2', () => {
    // should parse as 2 ^ (3 ^ 2), so right child of root ^ is also ^
    const ast = parse('2^3^2');
    assert.equal(ast.type, 'binary');
    assert.equal(ast.op, '^');
    assert.equal(ast.right.type, 'binary');
    assert.equal(ast.right.op, '^');
  });

  it('parentheses override precedence in AST', () => {
    // (2+3)*4: root is *, left is + wrapped
    const ast = parse('(2 + 3) * 4');
    assert.equal(ast.type, 'binary');
    assert.equal(ast.op, '*');
    assert.equal(ast.left.type, 'binary');
    assert.equal(ast.left.op, '+');
  });
});

describe('parse() — error cases', () => {
  it('throws ExpressionError on empty string', () => {
    assert.throws(() => parse(''), ExpressionError);
  });

  it('throws ExpressionError on missing closing paren', () => {
    assert.throws(() => parse('(1 + 2'), ExpressionError);
  });

  it('throws ExpressionError on dangling operator: "1 +"', () => {
    assert.throws(() => parse('1 +'), ExpressionError);
  });

  it('throws ExpressionError on leading operator: "* 2"', () => {
    assert.throws(() => parse('* 2'), ExpressionError);
  });

  it('throws ExpressionError on consecutive operators: "1 + * 2"', () => {
    assert.throws(() => parse('1 + * 2'), ExpressionError);
  });

  it('throws ExpressionError on trailing garbage: "1 + 2 x"', () => {
    assert.throws(() => parse('1 + 2 x'), ExpressionError);
  });

  it('throws ExpressionError on mismatched paren: "1 + 2)"', () => {
    assert.throws(() => parse('1 + 2)'), ExpressionError);
  });
});

// ─── evaluate() — basic arithmetic ───────────────────────────────────────────

describe('evaluate() — integers', () => {
  it('adds two integers: 2 + 3 = 5', () => {
    assert.equal(evaluate('2 + 3'), 5);
  });

  it('subtracts: 10 - 4 = 6', () => {
    assert.equal(evaluate('10 - 4'), 6);
  });

  it('multiplies: 3 * 4 = 12', () => {
    assert.equal(evaluate('3 * 4'), 12);
  });

  it('divides: 8 / 2 = 4', () => {
    assert.equal(evaluate('8 / 2'), 4);
  });

  it('chains multiple additions: 1+2+3+4 = 10', () => {
    assert.equal(evaluate('1 + 2 + 3 + 4'), 10);
  });

  it('single integer literal', () => {
    assert.equal(evaluate('99'), 99);
  });

  it('zero plus zero', () => {
    assert.equal(evaluate('0 + 0'), 0);
  });
});

describe('evaluate() — floats', () => {
  it('adds floats: 1.5 + 2.5 = 4.0', () => {
    assert.ok(Math.abs(evaluate('1.5 + 2.5') - 4.0) < 1e-10);
  });

  it('multiplies by a float: 3.14 * 2 ≈ 6.28', () => {
    assert.ok(Math.abs(evaluate('3.14 * 2') - 6.28) < 1e-10);
  });

  it('leading-dot float: .5 + .5 = 1.0', () => {
    assert.ok(Math.abs(evaluate('.5 + .5') - 1.0) < 1e-10);
  });

  it('division producing float: 1 / 4 = 0.25', () => {
    assert.ok(Math.abs(evaluate('1 / 4') - 0.25) < 1e-10);
  });
});

// ─── evaluate() — operator precedence ────────────────────────────────────────

describe('evaluate() — operator precedence', () => {
  it('2 + 3 * 4 = 14, not 20', () => {
    assert.equal(evaluate('2 + 3 * 4'), 14);
  });

  it('2 * 3 + 4 * 5 = 26', () => {
    assert.equal(evaluate('2 * 3 + 4 * 5'), 26);
  });

  it('2 * 3^2 = 18 (power before multiply)', () => {
    assert.equal(evaluate('2 * 3^2'), 18);
  });

  it('10 - 2 * 3 = 4', () => {
    assert.equal(evaluate('10 - 2 * 3'), 4);
  });

  it('left-associative subtraction: 10 - 3 - 2 = 5', () => {
    assert.equal(evaluate('10 - 3 - 2'), 5);
  });

  it('left-associative division: 24 / 4 / 2 = 3', () => {
    assert.equal(evaluate('24 / 4 / 2'), 3);
  });
});

// ─── evaluate() — parentheses ─────────────────────────────────────────────────

describe('evaluate() — parentheses', () => {
  it('(2 + 3) * 4 = 20', () => {
    assert.equal(evaluate('(2 + 3) * 4'), 20);
  });

  it('((2 + 3) * (4 - 1)) = 15', () => {
    assert.equal(evaluate('((2 + 3) * (4 - 1))'), 15);
  });

  it('(42) = 42', () => {
    assert.equal(evaluate('(42)'), 42);
  });

  it('10 / (2 + 3) = 2', () => {
    assert.equal(evaluate('10 / (2 + 3)'), 2);
  });

  it('deeply nested: ((((1)))) = 1', () => {
    assert.equal(evaluate('((((1))))'), 1);
  });
});

// ─── evaluate() — power operator ─────────────────────────────────────────────

describe('evaluate() — power operator ^', () => {
  it('2^3 = 8', () => {
    assert.equal(evaluate('2^3'), 8);
  });

  it('2^8 = 256', () => {
    assert.equal(evaluate('2^8'), 256);
  });

  it('right-associative: 2^3^2 = 2^(3^2) = 512', () => {
    assert.equal(evaluate('2^3^2'), 512);
  });

  it('x^0 = 1', () => {
    assert.equal(evaluate('5^0'), 1);
  });

  it('x^1 = x', () => {
    assert.equal(evaluate('7^1'), 7);
  });

  it('higher precedence than multiply: 3 * 2^3 = 24', () => {
    assert.equal(evaluate('3 * 2^3'), 24);
  });

  it('fractional exponent: 4^0.5 = 2', () => {
    assert.ok(Math.abs(evaluate('4^0.5') - 2) < 1e-10);
  });
});

// ─── evaluate() — unary minus ─────────────────────────────────────────────────

describe('evaluate() — unary minus', () => {
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

  it('-x^2 = -(x^2), not (-x)^2 (unary minus has lower precedence than ^)', () => {
    // -3^2 should be -(3^2) = -9, not (-3)^2 = 9
    assert.equal(evaluate('-3^2'), -9);
  });
});

// ─── evaluate() — variables ───────────────────────────────────────────────────

describe('evaluate() — variables', () => {
  it('evaluates a single variable', () => {
    assert.equal(evaluate('x', { x: 42 }), 42);
  });

  it('uses variable in simple expression', () => {
    assert.equal(evaluate('x + 1', { x: 5 }), 6);
  });

  it('uses multiple variables', () => {
    assert.equal(evaluate('x + y', { x: 3, y: 7 }), 10);
  });

  it('uses variable in polynomial: 2*x^2 + 1 with x=3 → 19', () => {
    assert.equal(evaluate('2 * x^2 + 1', { x: 3 }), 19);
  });

  it('supports camelCase variable names', () => {
    assert.equal(evaluate('myVar * 2', { myVar: 5 }), 10);
  });

  it('variable with zero value', () => {
    assert.equal(evaluate('x + 5', { x: 0 }), 5);
  });

  it('variable with negative value', () => {
    assert.equal(evaluate('x * 2', { x: -3 }), -6);
  });

  it('underscore variable name', () => {
    assert.equal(evaluate('_x + 1', { _x: 9 }), 10);
  });

  it('two-letter variable', () => {
    assert.equal(evaluate('ab + cd', { ab: 2, cd: 3 }), 5);
  });
});

// ─── evaluate() — division by zero ────────────────────────────────────────────

describe('evaluate() — division by zero', () => {
  it('throws ExpressionError on integer division by zero', () => {
    assert.throws(() => evaluate('1 / 0'), ExpressionError);
  });

  it('throws ExpressionError on variable-driven division by zero', () => {
    assert.throws(() => evaluate('x / y', { x: 5, y: 0 }), ExpressionError);
  });
});

// ─── evaluate() — error cases ─────────────────────────────────────────────────

describe('evaluate() — error cases', () => {
  it('throws ExpressionError on empty string', () => {
    assert.throws(() => evaluate(''), ExpressionError);
  });

  it('throws ExpressionError on undefined variable', () => {
    assert.throws(() => evaluate('z'), ExpressionError);
  });

  it('throws ExpressionError on unknown character', () => {
    assert.throws(() => evaluate('1 @ 2'), ExpressionError);
  });

  it('throws ExpressionError on dangling operator', () => {
    assert.throws(() => evaluate('1 +'), ExpressionError);
  });

  it('throws ExpressionError on unclosed paren', () => {
    assert.throws(() => evaluate('(1 + 2'), ExpressionError);
  });

  it('throws ExpressionError on trailing token', () => {
    assert.throws(() => evaluate('1 + 2 3'), ExpressionError);
  });

  it('throws ExpressionError when vars not provided for a variable', () => {
    assert.throws(() => evaluate('x + 1'), ExpressionError);
  });
});

// ─── evaluate() — edge / combination cases ────────────────────────────────────

describe('evaluate() — edge cases', () => {
  it('unary plus is accepted: +3 = 3', () => {
    assert.equal(evaluate('+3'), 3);
  });

  it('unary plus on variable: +x with x=7 → 7', () => {
    assert.equal(evaluate('+x', { x: 7 }), 7);
  });

  it('expression with no spaces', () => {
    assert.equal(evaluate('2+3*4'), 14);
  });

  it('expression with extra spaces everywhere', () => {
    assert.equal(evaluate('  2  +  3  *  4  '), 14);
  });

  it('large number: 1000000 * 1000000', () => {
    assert.equal(evaluate('1000000 * 1000000'), 1e12);
  });

  it('chained power then multiply: 2^2^3 = 2^8 = 256 (right-assoc)', () => {
    assert.equal(evaluate('2^2^3'), 256);
  });

  it('negative result from subtraction', () => {
    assert.equal(evaluate('3 - 10'), -7);
  });

  it('multiply by zero gives zero', () => {
    assert.equal(evaluate('999 * 0'), 0);
  });

  it('mixed operators with parentheses: (1+2) * (3+4) = 21', () => {
    assert.equal(evaluate('(1 + 2) * (3 + 4)'), 21);
  });
});
