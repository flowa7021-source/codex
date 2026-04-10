// ─── Unit Tests: Parser Combinators ──────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  literal,
  regex,
  choice,
  sequence,
  many,
  many1,
  optional,
  map,
  whitespace,
  between,
  sepBy,
  skipLeft,
  skipRight,
} from '../../app/modules/parser-combinators.js';

// ─── literal ─────────────────────────────────────────────────────────────────

describe('literal', () => {
  it('matches an exact string at start', () => {
    const p = literal('hello');
    const r = p('hello world');
    assert.equal(r.success, true);
    assert.equal(r.value, 'hello');
    assert.equal(r.rest, ' world');
  });

  it('fails when input does not start with the literal', () => {
    const r = literal('foo')('bar');
    assert.equal(r.success, false);
    assert.ok(r.error);
  });

  it('succeeds on exact match leaving empty rest', () => {
    const r = literal('abc')('abc');
    assert.equal(r.success, true);
    assert.equal(r.rest, '');
  });

  it('matches the empty string literal', () => {
    const r = literal('')('anything');
    assert.equal(r.success, true);
    assert.equal(r.value, '');
    assert.equal(r.rest, 'anything');
  });
});

// ─── regex ────────────────────────────────────────────────────────────────────

describe('regex', () => {
  it('matches digits at the start', () => {
    const p = regex(/\d+/);
    const r = p('123abc');
    assert.equal(r.success, true);
    assert.equal(r.value, '123');
    assert.equal(r.rest, 'abc');
  });

  it('fails when pattern does not match', () => {
    const r = regex(/\d+/)('abc');
    assert.equal(r.success, false);
  });

  it('is anchored — does not match mid-string', () => {
    const r = regex(/\d+/)('abc123');
    assert.equal(r.success, false);
  });

  it('respects flags like case-insensitive', () => {
    const r = regex(/[a-z]+/i)('ABC123');
    assert.equal(r.success, true);
    assert.equal(r.value, 'ABC');
  });
});

// ─── choice ───────────────────────────────────────────────────────────────────

describe('choice', () => {
  it('returns the first matching alternative', () => {
    const p = choice(literal('foo'), literal('bar'));
    assert.equal(p('foobar').value, 'foo');
    assert.equal(p('barbaz').value, 'bar');
  });

  it('fails when no alternative matches', () => {
    const p = choice(literal('a'), literal('b'));
    assert.equal(p('c').success, false);
  });

  it('tries alternatives in order', () => {
    const p = choice(literal('ab'), literal('a'));
    const r = p('abc');
    assert.equal(r.value, 'ab');
  });

  it('works with a single alternative', () => {
    const p = choice(literal('only'));
    assert.equal(p('only').success, true);
    assert.equal(p('other').success, false);
  });
});

// ─── sequence ────────────────────────────────────────────────────────────────

describe('sequence', () => {
  it('parses two parsers in order', () => {
    const p = sequence(literal('foo'), literal('bar'));
    const r = p('foobar');
    assert.equal(r.success, true);
    assert.deepEqual(r.value, ['foo', 'bar']);
    assert.equal(r.rest, '');
  });

  it('fails if any parser in the sequence fails', () => {
    const p = sequence(literal('foo'), literal('bar'));
    const r = p('foobaz');
    assert.equal(r.success, false);
  });

  it('threads the rest string through all parsers', () => {
    const p = sequence(regex(/\d+/), literal('-'), regex(/[a-z]+/));
    const r = p('42-hello world');
    assert.deepEqual(r.value, ['42', '-', 'hello']);
    assert.equal(r.rest, ' world');
  });
});

// ─── many ─────────────────────────────────────────────────────────────────────

describe('many', () => {
  it('collects zero or more matches', () => {
    const p = many(literal('a'));
    assert.deepEqual(p('aaab').value, ['a', 'a', 'a']);
    assert.equal(p('aaab').rest, 'b');
  });

  it('succeeds with zero matches', () => {
    const r = many(literal('x'))('yyy');
    assert.equal(r.success, true);
    assert.deepEqual(r.value, []);
    assert.equal(r.rest, 'yyy');
  });

  it('succeeds on empty input', () => {
    const r = many(literal('x'))('');
    assert.equal(r.success, true);
    assert.deepEqual(r.value, []);
  });
});

// ─── many1 ────────────────────────────────────────────────────────────────────

describe('many1', () => {
  it('succeeds with one or more matches', () => {
    const r = many1(regex(/\d/))('123x');
    assert.equal(r.success, true);
    assert.deepEqual(r.value, ['1', '2', '3']);
  });

  it('fails with zero matches', () => {
    const r = many1(literal('x'))('yyy');
    assert.equal(r.success, false);
  });
});

// ─── optional ────────────────────────────────────────────────────────────────

describe('optional', () => {
  it('returns the value when present', () => {
    const r = optional(literal('?'))('?rest');
    assert.equal(r.success, true);
    assert.equal(r.value, '?');
    assert.equal(r.rest, 'rest');
  });

  it('returns undefined when absent without failing', () => {
    const r = optional(literal('?'))('rest');
    assert.equal(r.success, true);
    assert.equal(r.value, undefined);
    assert.equal(r.rest, 'rest');
  });

  it('does not consume input on miss', () => {
    const r = optional(literal('nope'))('yes');
    assert.equal(r.rest, 'yes');
  });
});

// ─── map ─────────────────────────────────────────────────────────────────────

describe('map', () => {
  it('transforms a successful result', () => {
    const p = map(regex(/\d+/), Number);
    const r = p('42rest');
    assert.equal(r.success, true);
    assert.equal(r.value, 42);
    assert.equal(r.rest, 'rest');
  });

  it('propagates failure unchanged', () => {
    const p = map(literal('x'), s => s.toUpperCase());
    assert.equal(p('y').success, false);
  });

  it('supports complex transformations', () => {
    const p = map(many1(regex(/\d/)), digits => digits.join(''));
    const r = p('1234abc');
    assert.equal(r.value, '1234');
  });
});

// ─── whitespace ──────────────────────────────────────────────────────────────

describe('whitespace', () => {
  it('matches spaces and tabs', () => {
    const r = whitespace()('   \t  next');
    assert.equal(r.success, true);
    assert.equal(r.value, '   \t  ');
    assert.equal(r.rest, 'next');
  });

  it('succeeds with zero whitespace', () => {
    const r = whitespace()('abc');
    assert.equal(r.success, true);
    assert.equal(r.value, '');
    assert.equal(r.rest, 'abc');
  });

  it('matches newlines', () => {
    const r = whitespace()('\n\r\nabc');
    assert.equal(r.success, true);
    assert.equal(r.rest, 'abc');
  });
});

// ─── between ─────────────────────────────────────────────────────────────────

describe('between', () => {
  it('parses content between delimiters', () => {
    const p = between(literal('('), regex(/[^)]+/), literal(')'));
    const r = p('(hello)world');
    assert.equal(r.success, true);
    assert.equal(r.value, 'hello');
    assert.equal(r.rest, 'world');
  });

  it('fails if open delimiter missing', () => {
    const p = between(literal('['), regex(/\w+/), literal(']'));
    assert.equal(p('foo]').success, false);
  });

  it('fails if close delimiter missing', () => {
    const p = between(literal('['), regex(/\w+/), literal(']'));
    assert.equal(p('[foo').success, false);
  });

  it('can be used to parse quoted strings', () => {
    const p = between(literal('"'), regex(/[^"]*/), literal('"'));
    const r = p('"hello world" extra');
    assert.equal(r.value, 'hello world');
    assert.equal(r.rest, ' extra');
  });
});

// ─── sepBy ────────────────────────────────────────────────────────────────────

describe('sepBy', () => {
  const word = regex(/[a-z]+/);
  const comma = literal(',');

  it('parses a list of items', () => {
    const r = sepBy(word, comma)('a,b,c rest');
    assert.deepEqual(r.value, ['a', 'b', 'c']);
    assert.equal(r.rest, ' rest');
  });

  it('handles a single item', () => {
    const r = sepBy(word, comma)('hello world');
    assert.deepEqual(r.value, ['hello']);
    assert.equal(r.rest, ' world');
  });

  it('returns empty array when nothing matches', () => {
    const r = sepBy(word, comma)('123');
    assert.deepEqual(r.value, []);
    assert.equal(r.rest, '123');
  });

  it('does not consume trailing separator', () => {
    // "a," — comma is trailing; should only consume "a"
    const r = sepBy(word, comma)('a,123');
    assert.deepEqual(r.value, ['a']);
    assert.equal(r.rest, ',123');
  });
});

// ─── skipLeft / skipRight ─────────────────────────────────────────────────────

describe('skipLeft', () => {
  it('discards the first result, returns the second', () => {
    const p = skipLeft(whitespace(), regex(/\w+/));
    const r = p('   hello rest');
    assert.equal(r.value, 'hello');
    assert.equal(r.rest, ' rest');
  });

  it('fails if the kept parser fails', () => {
    const p = skipLeft(literal('>>'), regex(/\d+/));
    assert.equal(p('>>abc').success, false);
  });
});

describe('skipRight', () => {
  it('returns the first result, discards the second', () => {
    const p = skipRight(regex(/\w+/), whitespace());
    const r = p('hello   world');
    assert.equal(r.value, 'hello');
    assert.equal(r.rest, 'world');
  });

  it('fails if the discarded parser fails', () => {
    const p = skipRight(regex(/\d+/), literal(';'));
    assert.equal(p('42').success, false);
  });
});

// ─── Composition: realistic CSV-like parsing ─────────────────────────────────

describe('composed parsers', () => {
  it('parses a simple arithmetic expression tokens', () => {
    // number (+|-) number
    const num = map(regex(/\d+/), Number);
    const op = choice(literal('+'), literal('-'));
    const ws = whitespace();
    const expr = sequence(
      skipRight(num, ws),
      skipRight(op, ws),
      num,
    );
    const r = expr('10 + 42');
    assert.deepEqual(r.value, [10, '+', 42]);
  });

  it('parses a parenthesised comma list', () => {
    const ws = whitespace();
    const num = skipLeft(ws, map(regex(/\d+/), Number));
    const sep = skipLeft(ws, skipRight(literal(','), ws));
    const list = between(
      literal('('),
      sepBy(num, sep),
      skipLeft(ws, literal(')')),
    );
    const r = list('( 1 , 2 , 3 )');
    assert.deepEqual(r.value, [1, 2, 3]);
  });
});
