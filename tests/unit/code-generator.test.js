// ─── Unit Tests: Code Generator ──────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  num, str, bool, ident, binary, unary, call, ifExpr, block, assign,
} from '../../app/modules/ast-builder.js';

import {
  generateJS, generateMinified, CodeGen,
} from '../../app/modules/code-generator.js';

// ─── generateJS: literals ─────────────────────────────────────────────────────

describe('generateJS() – literals', () => {
  it('generates a number', () => {
    assert.equal(generateJS(num(42)), '42');
  });

  it('generates a negative number', () => {
    assert.equal(generateJS(num(-3.5)), '-3.5');
  });

  it('generates a string with double quotes', () => {
    assert.equal(generateJS(str('hello')), '"hello"');
  });

  it('escapes double quotes in strings', () => {
    assert.equal(generateJS(str('say "hi"')), '"say \\"hi\\""');
  });

  it('escapes newlines in strings', () => {
    assert.equal(generateJS(str('a\nb')), '"a\\nb"');
  });

  it('generates true', () => {
    assert.equal(generateJS(bool(true)), 'true');
  });

  it('generates false', () => {
    assert.equal(generateJS(bool(false)), 'false');
  });

  it('generates an identifier', () => {
    assert.equal(generateJS(ident('myVar')), 'myVar');
  });
});

// ─── generateJS: expressions ──────────────────────────────────────────────────

describe('generateJS() – expressions', () => {
  it('generates a binary expression with parens', () => {
    const code = generateJS(binary('+', num(1), num(2)));
    assert.equal(code, '(1 + 2)');
  });

  it('generates nested binary expressions', () => {
    const code = generateJS(binary('*', binary('+', num(1), num(2)), num(3)));
    assert.equal(code, '((1 + 2) * 3)');
  });

  it('generates a unary expression', () => {
    assert.equal(generateJS(unary('-', num(5))), '-5');
  });

  it('generates logical not', () => {
    assert.equal(generateJS(unary('!', bool(true))), '!true');
  });

  it('generates a call with no args', () => {
    assert.equal(generateJS(call('now', [])), 'now()');
  });

  it('generates a call with one arg', () => {
    assert.equal(generateJS(call('abs', [num(-1)])), 'abs(-1)');
  });

  it('generates a call with multiple args', () => {
    assert.equal(generateJS(call('max', [num(1), num(2), num(3)])), 'max(1, 2, 3)');
  });

  it('generates an if expression (ternary)', () => {
    const code = generateJS(ifExpr(bool(true), num(1), num(0)));
    assert.equal(code, '(true ? 1 : 0)');
  });

  it('generates an assignment', () => {
    assert.equal(generateJS(assign('x', num(42))), 'x = 42');
  });
});

// ─── generateJS: block ────────────────────────────────────────────────────────

describe('generateJS() – block', () => {
  it('generates an empty block', () => {
    const code = generateJS(block([]));
    assert.ok(code.startsWith('{'));
    assert.ok(code.endsWith('}'));
  });

  it('generates a block with statements and semicolons', () => {
    const code = generateJS(block([assign('x', num(1)), assign('y', num(2))]));
    assert.ok(code.includes('x = 1;'));
    assert.ok(code.includes('y = 2;'));
  });

  it('indents block body at indent+1 level', () => {
    const code = generateJS(block([num(1)]), 0);
    const lines = code.split('\n');
    // Body line should be indented with 2 spaces
    assert.ok(lines[1].startsWith('  '), `Expected indentation, got: "${lines[1]}"`);
  });
});

// ─── generateMinified: basics ─────────────────────────────────────────────────

describe('generateMinified()', () => {
  it('generates a number without extra whitespace', () => {
    assert.equal(generateMinified(num(7)), '7');
  });

  it('generates a string', () => {
    assert.equal(generateMinified(str('hi')), '"hi"');
  });

  it('generates binary without spaces', () => {
    assert.equal(generateMinified(binary('+', num(1), num(2))), '(1+2)');
  });

  it('generates unary without spaces', () => {
    assert.equal(generateMinified(unary('-', num(3))), '-3');
  });

  it('generates call without spaces between args', () => {
    assert.equal(generateMinified(call('f', [num(1), num(2)])), 'f(1,2)');
  });

  it('generates ternary without spaces', () => {
    assert.equal(generateMinified(ifExpr(bool(true), num(1), num(0))), '(true?1:0)');
  });

  it('generates assignment without spaces', () => {
    assert.equal(generateMinified(assign('x', num(5))), 'x=5');
  });

  it('generates block without spaces', () => {
    const code = generateMinified(block([assign('a', num(1))]));
    assert.equal(code, '{a=1;}');
  });

  it('generates empty block as {}', () => {
    assert.equal(generateMinified(block([])), '{}');
  });
});

// ─── CodeGen class ────────────────────────────────────────────────────────────

describe('CodeGen – default options', () => {
  it('generates a simple expression', () => {
    const gen = new CodeGen();
    assert.equal(gen.generate(num(99)), '99');
  });

  it('generateMany joins nodes with newlines and semicolons', () => {
    const gen = new CodeGen();
    const result = gen.generateMany([assign('a', num(1)), assign('b', num(2))]);
    assert.ok(result.includes('a = 1;'));
    assert.ok(result.includes('b = 2;'));
    assert.ok(result.includes('\n'));
  });

  it('generates binary with spaces', () => {
    const gen = new CodeGen();
    assert.equal(gen.generate(binary('-', num(10), num(3))), '(10 - 3)');
  });
});

describe('CodeGen – semicolons: false', () => {
  it('generateMany omits trailing semicolons', () => {
    const gen = new CodeGen({ semicolons: false });
    const result = gen.generateMany([assign('x', num(1)), assign('y', num(2))]);
    assert.ok(!result.includes(';'), `Expected no semicolons, got: ${result}`);
  });

  it('block body has no semicolons when disabled', () => {
    const gen = new CodeGen({ semicolons: false });
    const code = gen.generate(block([assign('x', num(1))]));
    assert.ok(!code.includes(';'), `Expected no semicolons, got: ${code}`);
  });
});

describe('CodeGen – custom indent', () => {
  it('uses 4-space indent for blocks', () => {
    const gen = new CodeGen({ indent: 4 });
    const code = gen.generate(block([num(1)]));
    const lines = code.split('\n');
    assert.ok(lines[1].startsWith('    '), `Expected 4-space indent, got: "${lines[1]}"`);
  });
});
