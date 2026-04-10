// ─── Unit Tests: Math Expression Evaluator ────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  evaluate,
  parse,
  evaluateNode,
  createEvaluator,
} from '../../app/modules/expression-evaluator.js';

// ─── evaluate() ──────────────────────────────────────────────────────────────

describe('evaluate – basic arithmetic', () => {
  it('adds two numbers', () => {
    assert.equal(evaluate('2+3'), 5);
  });

  it('respects operator precedence (* before +)', () => {
    assert.equal(evaluate('2*3+4'), 10);
  });

  it('respects parentheses', () => {
    assert.equal(evaluate('2*(3+4)'), 14);
  });

  it('raises to a power with ^', () => {
    assert.equal(evaluate('2^3'), 8);
  });

  it('evaluates unary minus', () => {
    assert.equal(evaluate('-5'), -5);
  });

  it('divides two numbers', () => {
    assert.equal(evaluate('10/2'), 5);
  });

  it('evaluates subtraction', () => {
    assert.equal(evaluate('9-4'), 5);
  });

  it('evaluates a float literal', () => {
    assert.ok(Math.abs(evaluate('1.5+0.5') - 2) < 1e-12);
  });
});

describe('evaluate – variables', () => {
  it('resolves a named variable', () => {
    assert.equal(evaluate('x+1', { x: 3 }), 4);
  });

  it('resolves multiple variables in one expression', () => {
    assert.equal(evaluate('a*b', { a: 6, b: 7 }), 42);
  });

  it('resolves a variable used in a nested expression', () => {
    assert.equal(evaluate('(x+2)*3', { x: 4 }), 18);
  });

  it('throws Error for an unknown variable', () => {
    assert.throws(() => evaluate('y+1'), (err) => {
      assert.ok(err instanceof Error);
      assert.match(err.message, /unknown variable/i);
      return true;
    });
  });
});

describe('evaluate – error cases', () => {
  it('throws SyntaxError for a trailing operator (\'2+\')', () => {
    assert.throws(() => evaluate('2+'), (err) => {
      assert.ok(err instanceof SyntaxError);
      return true;
    });
  });

  it('throws SyntaxError for an empty string', () => {
    assert.throws(() => evaluate(''), (err) => {
      assert.ok(err instanceof SyntaxError);
      return true;
    });
  });

  it('throws SyntaxError for unmatched parenthesis', () => {
    assert.throws(() => evaluate('(2+3'), (err) => {
      assert.ok(err instanceof SyntaxError);
      return true;
    });
  });

  it('throws SyntaxError for a stray closing parenthesis', () => {
    assert.throws(() => evaluate('2+3)'), (err) => {
      assert.ok(err instanceof SyntaxError);
      return true;
    });
  });

  it('throws SyntaxError for an unrecognised character', () => {
    assert.throws(() => evaluate('2@3'), (err) => {
      assert.ok(err instanceof SyntaxError);
      return true;
    });
  });

  it('throws Error for division by zero', () => {
    assert.throws(() => evaluate('1/0'), (err) => {
      assert.ok(err instanceof Error);
      assert.match(err.message, /division by zero/i);
      return true;
    });
  });
});

describe('evaluate – precedence and associativity', () => {
  it('power is right-associative (2^3^2 = 2^9 = 512)', () => {
    assert.equal(evaluate('2^3^2'), 512);
  });

  it('unary minus has higher precedence than *', () => {
    // -2 * 3 = -6  (not -(2*3) which would be the same, but let us also test)
    assert.equal(evaluate('-2*3'), -6);
  });

  it('double unary minus gives positive', () => {
    assert.equal(evaluate('--4'), 4);
  });

  it('division before addition', () => {
    assert.equal(evaluate('6/2+1'), 4);
  });
});

// ─── parse() ─────────────────────────────────────────────────────────────────

describe('parse – returns ExprNode', () => {
  it('returns a number node for a literal', () => {
    const node = parse('42');
    assert.equal(node.type, 'number');
    assert.equal(/** @type {any} */ (node).value, 42);
  });

  it('returns a variable node for an identifier', () => {
    const node = parse('x');
    assert.equal(node.type, 'variable');
    assert.equal(/** @type {any} */ (node).name, 'x');
  });

  it('returns a binary node for an addition', () => {
    const node = parse('1+2');
    assert.equal(node.type, 'binary');
    assert.equal(/** @type {any} */ (node).op, '+');
  });

  it('returns a unary node for negation', () => {
    const node = parse('-x');
    assert.equal(node.type, 'unary');
    assert.equal(/** @type {any} */ (node).op, '-');
  });

  it('nests nodes correctly for 2*(3+4)', () => {
    const node = parse('2*(3+4)');
    assert.equal(node.type, 'binary');
    const bin = /** @type {any} */ (node);
    assert.equal(bin.op, '*');
    assert.equal(bin.left.type, 'number');
    assert.equal(bin.right.type, 'binary');
    assert.equal(bin.right.op, '+');
  });

  it('throws SyntaxError for malformed input', () => {
    assert.throws(() => parse('1+'), (err) => {
      assert.ok(err instanceof SyntaxError);
      return true;
    });
  });
});

// ─── evaluateNode() ──────────────────────────────────────────────────────────

describe('evaluateNode – evaluates a pre-parsed AST', () => {
  it('evaluates a number node', () => {
    const node = parse('7');
    assert.equal(evaluateNode(node), 7);
  });

  it('evaluates a binary expression node', () => {
    const node = parse('3*4');
    assert.equal(evaluateNode(node), 12);
  });

  it('evaluates a unary node', () => {
    const node = parse('-10');
    assert.equal(evaluateNode(node), -10);
  });

  it('resolves variables when passed to evaluateNode', () => {
    const node = parse('x+y');
    assert.equal(evaluateNode(node, { x: 1, y: 2 }), 3);
  });

  it('throws Error for a variable node when variables is omitted', () => {
    const node = parse('z');
    assert.throws(() => evaluateNode(node), (err) => {
      assert.ok(err instanceof Error);
      return true;
    });
  });

  it('can reuse the same AST with different variable bindings', () => {
    const node = parse('n^2');
    assert.equal(evaluateNode(node, { n: 3 }), 9);
    assert.equal(evaluateNode(node, { n: 5 }), 25);
  });
});

// ─── createEvaluator() ───────────────────────────────────────────────────────

describe('createEvaluator – factory with bound variables', () => {
  it('eval() works without extra arguments', () => {
    const ev = createEvaluator({ x: 10 });
    assert.equal(ev.eval('x*2'), 20);
  });

  it('multiple calls share the same binding', () => {
    const ev = createEvaluator({ pi: Math.PI });
    assert.ok(Math.abs(ev.eval('pi*2') - 2 * Math.PI) < 1e-10);
    assert.ok(Math.abs(ev.eval('pi^2') - Math.PI ** 2) < 1e-10);
  });

  it('throws for variables not in the bound set', () => {
    const ev = createEvaluator({ a: 1 });
    assert.throws(() => ev.eval('b+1'), (err) => {
      assert.ok(err instanceof Error);
      return true;
    });
  });

  it('throws SyntaxError on bad expressions', () => {
    const ev = createEvaluator({});
    assert.throws(() => ev.eval('2*/3'), (err) => {
      assert.ok(err instanceof SyntaxError);
      return true;
    });
  });

  it('returns an object with only an eval method', () => {
    const ev = createEvaluator();
    assert.equal(typeof ev.eval, 'function');
  });

  it('createEvaluator with no arguments evaluates pure arithmetic', () => {
    const ev = createEvaluator();
    assert.equal(ev.eval('1+2+3'), 6);
  });
});
