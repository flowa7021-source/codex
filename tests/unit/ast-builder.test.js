// ─── Unit Tests: AST Builder ──────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  num, str, bool, ident, binary, unary, call, ifExpr, block, assign,
  walkAST, transformAST,
  NodeType,
} from '../../app/modules/ast-builder.js';

// ─── Builder: num ─────────────────────────────────────────────────────────────

describe('num()', () => {
  it('creates a NumberLiteral node', () => {
    const node = num(42);
    assert.equal(node.type, 'NumberLiteral');
    assert.equal(node.value, 42);
  });

  it('handles zero', () => {
    const node = num(0);
    assert.equal(node.value, 0);
  });

  it('handles negative numbers', () => {
    const node = num(-3.14);
    assert.equal(node.value, -3.14);
  });
});

// ─── Builder: str ─────────────────────────────────────────────────────────────

describe('str()', () => {
  it('creates a StringLiteral node', () => {
    const node = str('hello');
    assert.equal(node.type, 'StringLiteral');
    assert.equal(node.value, 'hello');
  });

  it('handles empty string', () => {
    const node = str('');
    assert.equal(node.value, '');
  });

  it('preserves special characters', () => {
    const node = str('line1\nline2');
    assert.equal(node.value, 'line1\nline2');
  });
});

// ─── Builder: bool ────────────────────────────────────────────────────────────

describe('bool()', () => {
  it('creates a BoolLiteral node with true', () => {
    const node = bool(true);
    assert.equal(node.type, 'BoolLiteral');
    assert.equal(node.value, true);
  });

  it('creates a BoolLiteral node with false', () => {
    const node = bool(false);
    assert.equal(node.value, false);
  });
});

// ─── Builder: ident ───────────────────────────────────────────────────────────

describe('ident()', () => {
  it('creates an Identifier node', () => {
    const node = ident('x');
    assert.equal(node.type, 'Identifier');
    assert.equal(node.name, 'x');
  });

  it('handles longer names', () => {
    const node = ident('myVariable');
    assert.equal(node.name, 'myVariable');
  });
});

// ─── Builder: binary ──────────────────────────────────────────────────────────

describe('binary()', () => {
  it('creates a BinaryExpr node', () => {
    const node = binary('+', num(1), num(2));
    assert.equal(node.type, 'BinaryExpr');
    assert.equal(node.op, '+');
    assert.deepEqual(node.left, num(1));
    assert.deepEqual(node.right, num(2));
  });

  it('supports nested expressions', () => {
    const node = binary('*', binary('+', num(1), num(2)), num(3));
    assert.equal(node.type, 'BinaryExpr');
    assert.equal(node.left.type, 'BinaryExpr');
  });

  it('stores the operator string verbatim', () => {
    const node = binary('===', ident('a'), ident('b'));
    assert.equal(node.op, '===');
  });
});

// ─── Builder: unary ───────────────────────────────────────────────────────────

describe('unary()', () => {
  it('creates a UnaryExpr node', () => {
    const node = unary('-', num(5));
    assert.equal(node.type, 'UnaryExpr');
    assert.equal(node.op, '-');
    assert.deepEqual(node.operand, num(5));
  });

  it('handles logical not', () => {
    const node = unary('!', bool(true));
    assert.equal(node.op, '!');
    assert.equal(node.operand.type, 'BoolLiteral');
  });
});

// ─── Builder: call ────────────────────────────────────────────────────────────

describe('call()', () => {
  it('creates a CallExpr node', () => {
    const node = call('foo', [num(1), num(2)]);
    assert.equal(node.type, 'CallExpr');
    assert.equal(node.callee, 'foo');
    assert.equal(node.args.length, 2);
  });

  it('allows zero arguments', () => {
    const node = call('now', []);
    assert.equal(node.args.length, 0);
  });

  it('stores args in order', () => {
    const node = call('f', [num(10), str('x'), bool(false)]);
    assert.equal(node.args[0].type, 'NumberLiteral');
    assert.equal(node.args[1].type, 'StringLiteral');
    assert.equal(node.args[2].type, 'BoolLiteral');
  });
});

// ─── Builder: ifExpr ──────────────────────────────────────────────────────────

describe('ifExpr()', () => {
  it('creates an IfExpr node', () => {
    const node = ifExpr(bool(true), num(1), num(0));
    assert.equal(node.type, 'IfExpr');
    assert.deepEqual(node.condition, bool(true));
    assert.deepEqual(node.then, num(1));
    assert.deepEqual(node.else, num(0));
  });

  it('supports nested if expressions', () => {
    const inner = ifExpr(bool(false), num(2), num(3));
    const outer = ifExpr(bool(true), num(1), inner);
    assert.equal(outer.else.type, 'IfExpr');
  });
});

// ─── Builder: block ───────────────────────────────────────────────────────────

describe('block()', () => {
  it('creates a BlockExpr node', () => {
    const node = block([num(1), num(2)]);
    assert.equal(node.type, 'BlockExpr');
    assert.equal(node.body.length, 2);
  });

  it('allows empty block', () => {
    const node = block([]);
    assert.equal(node.body.length, 0);
  });
});

// ─── Builder: assign ──────────────────────────────────────────────────────────

describe('assign()', () => {
  it('creates an Assignment node', () => {
    const node = assign('x', num(42));
    assert.equal(node.type, 'Assignment');
    assert.equal(node.name, 'x');
    assert.deepEqual(node.value, num(42));
  });

  it('supports complex right-hand side', () => {
    const node = assign('result', binary('+', ident('a'), ident('b')));
    assert.equal(node.value.type, 'BinaryExpr');
  });
});

// ─── NodeType constant object ─────────────────────────────────────────────────

describe('NodeType', () => {
  it('exports all expected type strings', () => {
    assert.equal(NodeType.NumberLiteral, 'NumberLiteral');
    assert.equal(NodeType.StringLiteral, 'StringLiteral');
    assert.equal(NodeType.BoolLiteral, 'BoolLiteral');
    assert.equal(NodeType.Identifier, 'Identifier');
    assert.equal(NodeType.BinaryExpr, 'BinaryExpr');
    assert.equal(NodeType.UnaryExpr, 'UnaryExpr');
    assert.equal(NodeType.CallExpr, 'CallExpr');
    assert.equal(NodeType.IfExpr, 'IfExpr');
    assert.equal(NodeType.BlockExpr, 'BlockExpr');
    assert.equal(NodeType.Assignment, 'Assignment');
  });
});

// ─── walkAST ──────────────────────────────────────────────────────────────────

describe('walkAST()', () => {
  it('visits a leaf node exactly once', () => {
    const visited = [];
    walkAST(num(1), n => visited.push(n.type));
    assert.deepEqual(visited, ['NumberLiteral']);
  });

  it('visits nodes in pre-order (parent before children)', () => {
    const tree = binary('+', num(1), num(2));
    const visited = [];
    walkAST(tree, n => visited.push(n.type));
    assert.deepEqual(visited, ['BinaryExpr', 'NumberLiteral', 'NumberLiteral']);
  });

  it('visits all nodes in a call expression', () => {
    const tree = call('f', [num(1), str('a'), bool(true)]);
    const types = [];
    walkAST(tree, n => types.push(n.type));
    assert.deepEqual(types, ['CallExpr', 'NumberLiteral', 'StringLiteral', 'BoolLiteral']);
  });

  it('walks IfExpr: condition, then, else in order', () => {
    const tree = ifExpr(ident('cond'), num(1), num(2));
    const types = [];
    walkAST(tree, n => types.push(n.type));
    assert.deepEqual(types, ['IfExpr', 'Identifier', 'NumberLiteral', 'NumberLiteral']);
  });

  it('walks BlockExpr body in order', () => {
    const tree = block([assign('x', num(1)), assign('y', num(2))]);
    const types = [];
    walkAST(tree, n => types.push(n.type));
    assert.deepEqual(types, [
      'BlockExpr',
      'Assignment', 'NumberLiteral',
      'Assignment', 'NumberLiteral',
    ]);
  });

  it('walks UnaryExpr', () => {
    const tree = unary('!', bool(false));
    const types = [];
    walkAST(tree, n => types.push(n.type));
    assert.deepEqual(types, ['UnaryExpr', 'BoolLiteral']);
  });

  it('counts all nodes in a deep tree', () => {
    const tree = binary('+', binary('*', num(2), num(3)), unary('-', num(4)));
    let count = 0;
    walkAST(tree, () => count++);
    assert.equal(count, 6); // BinaryExpr, BinaryExpr, num, num, UnaryExpr, num
  });
});

// ─── transformAST ─────────────────────────────────────────────────────────────

describe('transformAST()', () => {
  it('returns the same structure when identity function is used', () => {
    const tree = binary('+', num(1), num(2));
    const result = transformAST(tree, n => n);
    assert.deepEqual(result, tree);
  });

  it('replaces all NumberLiteral nodes', () => {
    const tree = binary('+', num(1), num(2));
    const result = transformAST(tree, n =>
      n.type === 'NumberLiteral' ? num(n.value * 10) : n
    );
    assert.equal(result.type, 'BinaryExpr');
    const b = /** @type {import('../../app/modules/ast-builder.js').BinaryExpr} */(result);
    assert.equal(/** @type {import('../../app/modules/ast-builder.js').NumberLiteral} */(b.left).value, 10);
    assert.equal(/** @type {import('../../app/modules/ast-builder.js').NumberLiteral} */(b.right).value, 20);
  });

  it('applies transform bottom-up (children first)', () => {
    const order = [];
    const tree = binary('+', num(1), num(2));
    transformAST(tree, n => {
      order.push(n.type);
      return n;
    });
    // Children (NumberLiterals) should appear before BinaryExpr
    assert.equal(order[0], 'NumberLiteral');
    assert.equal(order[1], 'NumberLiteral');
    assert.equal(order[2], 'BinaryExpr');
  });

  it('does not mutate the original tree', () => {
    const original = num(5);
    transformAST(original, n =>
      n.type === 'NumberLiteral' ? num(999) : n
    );
    assert.equal(original.value, 5);
  });

  it('can flatten unary negation of number into negative literal', () => {
    const tree = unary('-', num(7));
    const result = transformAST(tree, n => {
      if (n.type === 'UnaryExpr' && n.op === '-' && n.operand.type === 'NumberLiteral') {
        return num(-n.operand.value);
      }
      return n;
    });
    assert.equal(result.type, 'NumberLiteral');
    assert.equal(/** @type {import('../../app/modules/ast-builder.js').NumberLiteral} */(result).value, -7);
  });

  it('transforms inside CallExpr args', () => {
    const tree = call('f', [num(1), num(2)]);
    const result = transformAST(tree, n =>
      n.type === 'NumberLiteral' ? num(n.value + 100) : n
    );
    const c = /** @type {import('../../app/modules/ast-builder.js').CallExpr} */(result);
    assert.equal(/** @type {import('../../app/modules/ast-builder.js').NumberLiteral} */(c.args[0]).value, 101);
    assert.equal(/** @type {import('../../app/modules/ast-builder.js').NumberLiteral} */(c.args[1]).value, 102);
  });

  it('transforms inside BlockExpr body', () => {
    const tree = block([assign('x', num(1)), assign('y', num(2))]);
    const result = transformAST(tree, n =>
      n.type === 'NumberLiteral' ? num(n.value * 2) : n
    );
    const b = /** @type {import('../../app/modules/ast-builder.js').BlockExpr} */(result);
    const a0 = /** @type {import('../../app/modules/ast-builder.js').Assignment} */(b.body[0]);
    const a1 = /** @type {import('../../app/modules/ast-builder.js').Assignment} */(b.body[1]);
    assert.equal(/** @type {import('../../app/modules/ast-builder.js').NumberLiteral} */(a0.value).value, 2);
    assert.equal(/** @type {import('../../app/modules/ast-builder.js').NumberLiteral} */(a1.value).value, 4);
  });
});
