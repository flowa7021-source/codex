// ─── Unit Tests: parser-combinator ───────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  literal,
  regex,
  map,
  sequence,
  choice,
  many,
  many1,
  optional,
  between,
  separated,
  ws,
  digit,
  letter,
  number as numParser,
} from '../../app/modules/parser-combinator.js';

// ─── literal ──────────────────────────────────────────────────────────────────

describe('literal', () => {
  it('succeeds when input starts with the string', () => {
    const p = literal('hello');
    const r = p('hello world');
    assert.ok(r.success);
    if (r.success) {
      assert.equal(r.value, 'hello');
      assert.equal(r.remaining, ' world');
    }
  });

  it('fails when input does not start with the string', () => {
    const p = literal('foo');
    const r = p('bar');
    assert.ok(!r.success);
  });

  it('matches an empty string always', () => {
    const p = literal('');
    const r = p('anything');
    assert.ok(r.success);
    if (r.success) {
      assert.equal(r.value, '');
      assert.equal(r.remaining, 'anything');
    }
  });

  it('fails on empty input when pattern is non-empty', () => {
    const p = literal('abc');
    const r = p('');
    assert.ok(!r.success);
  });

  it('succeeds on exact match leaving empty remaining', () => {
    const p = literal('exact');
    const r = p('exact');
    assert.ok(r.success);
    if (r.success) assert.equal(r.remaining, '');
  });

  it('is case-sensitive', () => {
    const p = literal('Hello');
    assert.ok(!p('hello').success);
    assert.ok(p('Hello world').success);
  });

  it('matches multi-character unicode strings', () => {
    const p = literal('日本語');
    const r = p('日本語テスト');
    assert.ok(r.success);
    if (r.success) assert.equal(r.remaining, 'テスト');
  });

  it('includes the expected string in the error message', () => {
    const p = literal('xyz');
    const r = p('abc');
    assert.ok(!r.success);
    if (!r.success) assert.ok(r.error.includes('xyz'));
  });
});

// ─── regex ────────────────────────────────────────────────────────────────────

describe('regex', () => {
  it('matches a simple pattern', () => {
    const p = regex(/[a-z]+/);
    const r = p('hello123');
    assert.ok(r.success);
    if (r.success) {
      assert.equal(r.value, 'hello');
      assert.equal(r.remaining, '123');
    }
  });

  it('fails when pattern does not match', () => {
    const p = regex(/[0-9]+/);
    const r = p('abc');
    assert.ok(!r.success);
  });

  it('does not match in the middle of the string (anchored)', () => {
    const p = regex(/world/);
    const r = p('hello world');
    assert.ok(!r.success);
  });

  it('supports pre-anchored pattern (^)', () => {
    const p = regex(/^[a-z]+/);
    const r = p('abc123');
    assert.ok(r.success);
    if (r.success) assert.equal(r.value, 'abc');
  });

  it('handles empty match (zero-width)', () => {
    const p = regex(/a*/);
    const r = p('bbb');
    assert.ok(r.success);
    if (r.success) {
      assert.equal(r.value, '');
      assert.equal(r.remaining, 'bbb');
    }
  });

  it('respects regex flags (case insensitive)', () => {
    const p = regex(/[a-z]+/i);
    const r = p('HELLO world');
    assert.ok(r.success);
    if (r.success) assert.equal(r.value, 'HELLO');
  });

  it('returns error when no match', () => {
    const p = regex(/\d+/);
    const r = p('no digits');
    assert.ok(!r.success);
    if (!r.success) assert.ok(r.error.length > 0);
  });

  it('matches the entire input when pattern consumes it all', () => {
    const p = regex(/\w+/);
    const r = p('word');
    assert.ok(r.success);
    if (r.success) assert.equal(r.remaining, '');
  });
});

// ─── map ──────────────────────────────────────────────────────────────────────

describe('map', () => {
  it('transforms a successful parse value', () => {
    const p = map(literal('42'), (s) => parseInt(s, 10));
    const r = p('42');
    assert.ok(r.success);
    if (r.success) assert.equal(r.value, 42);
  });

  it('propagates failure without calling fn', () => {
    let called = false;
    const p = map(literal('x'), (v) => { called = true; return v; });
    const r = p('y');
    assert.ok(!r.success);
    assert.ok(!called);
  });

  it('preserves remaining string after transform', () => {
    const p = map(regex(/[a-z]+/), (s) => s.toUpperCase());
    const r = p('hello world');
    assert.ok(r.success);
    if (r.success) {
      assert.equal(r.value, 'HELLO');
      assert.equal(r.remaining, ' world');
    }
  });

  it('can map to a different type (string -> object)', () => {
    const p = map(regex(/\d+/), (s) => ({ n: parseInt(s, 10) }));
    const r = p('123rest');
    assert.ok(r.success);
    if (r.success) assert.deepEqual(r.value, { n: 123 });
  });

  it('can chain two maps', () => {
    const p = map(map(regex(/\d+/), (s) => parseInt(s, 10)), (n) => n * 2);
    const r = p('21');
    assert.ok(r.success);
    if (r.success) assert.equal(r.value, 42);
  });

  it('fn receives the exact matched value', () => {
    const received = [];
    const p = map(literal('hi'), (v) => { received.push(v); return v; });
    p('hi there');
    assert.deepEqual(received, ['hi']);
  });

  it('fn can return null', () => {
    const p = map(literal('skip'), () => null);
    const r = p('skip');
    assert.ok(r.success);
    if (r.success) assert.equal(r.value, null);
  });

  it('fn can return boolean', () => {
    const p = map(regex(/true|false/), (s) => s === 'true');
    const r = p('true');
    assert.ok(r.success);
    if (r.success) assert.equal(r.value, true);
  });
});

// ─── sequence ─────────────────────────────────────────────────────────────────

describe('sequence', () => {
  it('returns array of parsed values in order', () => {
    const p = sequence(literal('('), regex(/[^)]+/), literal(')'));
    const r = p('(hello)');
    assert.ok(r.success);
    if (r.success) assert.deepEqual(r.value, ['(', 'hello', ')']);
  });

  it('fails if first parser fails', () => {
    const p = sequence(literal('a'), literal('b'));
    const r = p('xb');
    assert.ok(!r.success);
  });

  it('fails if middle parser fails', () => {
    const p = sequence(literal('a'), literal('b'), literal('c'));
    const r = p('axc');
    assert.ok(!r.success);
  });

  it('fails if last parser fails', () => {
    const p = sequence(literal('a'), literal('b'), literal('c'));
    const r = p('abx');
    assert.ok(!r.success);
  });

  it('returns empty array for zero parsers', () => {
    const p = sequence();
    const r = p('anything');
    assert.ok(r.success);
    if (r.success) {
      assert.deepEqual(r.value, []);
      assert.equal(r.remaining, 'anything');
    }
  });

  it('passes remaining string from one parser to next', () => {
    const p = sequence(literal('foo'), literal('bar'));
    const r = p('foobar baz');
    assert.ok(r.success);
    if (r.success) assert.equal(r.remaining, ' baz');
  });

  it('composes with map to extract a specific field', () => {
    const p = map(
      sequence(literal('{'), regex(/\w+/), literal('}')),
      (vs) => vs[1],
    );
    const r = p('{name}');
    assert.ok(r.success);
    if (r.success) assert.equal(r.value, 'name');
  });

  it('handles single-parser sequence', () => {
    const p = sequence(literal('only'));
    const r = p('only this');
    assert.ok(r.success);
    if (r.success) assert.deepEqual(r.value, ['only']);
  });
});

// ─── choice ───────────────────────────────────────────────────────────────────

describe('choice', () => {
  it('returns the first successful match', () => {
    const p = choice(literal('foo'), literal('bar'), literal('baz'));
    const r = p('bar qux');
    assert.ok(r.success);
    if (r.success) assert.equal(r.value, 'bar');
  });

  it('fails if no alternative matches', () => {
    const p = choice(literal('a'), literal('b'), literal('c'));
    const r = p('xyz');
    assert.ok(!r.success);
  });

  it('tries alternatives in order (first match wins)', () => {
    const p = choice(literal('fo'), literal('foo'));
    const r = p('foobar');
    assert.ok(r.success);
    if (r.success) assert.equal(r.value, 'fo');
  });

  it('error message mentions failed alternatives', () => {
    const p = choice(literal('a'), literal('b'));
    const r = p('x');
    assert.ok(!r.success);
    if (!r.success) assert.ok(r.error.length > 0);
  });

  it('handles single alternative', () => {
    const p = choice(literal('only'));
    assert.ok(p('only').success);
    assert.ok(!p('other').success);
  });

  it('does not consume input on failure', () => {
    const p = choice(literal('a'), literal('b'));
    const r = p('c rest');
    assert.ok(!r.success);
    if (!r.success) assert.equal(r.remaining, 'c rest');
  });

  it('works with map to normalise variants', () => {
    const p = map(choice(literal('true'), literal('yes'), literal('1')), () => true);
    assert.ok(p('yes').success);
    assert.ok(p('true').success);
    assert.ok(p('1').success);
    assert.ok(!p('no').success);
  });

  it('remaining from the matched alternative is preserved', () => {
    const p = choice(literal('hi'), literal('hello'));
    const r = p('hi there');
    assert.ok(r.success);
    if (r.success) assert.equal(r.remaining, ' there');
  });
});

// ─── many / many1 ─────────────────────────────────────────────────────────────

describe('many', () => {
  it('matches zero occurrences (always succeeds)', () => {
    const p = many(literal('a'));
    const r = p('bbb');
    assert.ok(r.success);
    if (r.success) assert.deepEqual(r.value, []);
  });

  it('matches one occurrence', () => {
    const p = many(literal('a'));
    const r = p('abbb');
    assert.ok(r.success);
    if (r.success) assert.deepEqual(r.value, ['a']);
  });

  it('matches multiple occurrences', () => {
    const p = many(literal('ab'));
    const r = p('ababab!');
    assert.ok(r.success);
    if (r.success) {
      assert.deepEqual(r.value, ['ab', 'ab', 'ab']);
      assert.equal(r.remaining, '!');
    }
  });

  it('stops at the first non-matching character', () => {
    const p = many(digit);
    const r = p('123abc');
    assert.ok(r.success);
    if (r.success) {
      assert.deepEqual(r.value, ['1', '2', '3']);
      assert.equal(r.remaining, 'abc');
    }
  });

  it('returns empty array on empty input', () => {
    const p = many(literal('x'));
    const r = p('');
    assert.ok(r.success);
    if (r.success) assert.deepEqual(r.value, []);
  });

  it('composes with map to join results', () => {
    const p = map(many(digit), (ds) => ds.join(''));
    const r = p('4567rest');
    assert.ok(r.success);
    if (r.success) assert.equal(r.value, '4567');
  });
});

describe('many1', () => {
  it('fails on zero occurrences', () => {
    const p = many1(literal('a'));
    const r = p('bbb');
    assert.ok(!r.success);
  });

  it('succeeds with one occurrence', () => {
    const p = many1(literal('a'));
    const r = p('a');
    assert.ok(r.success);
    if (r.success) assert.deepEqual(r.value, ['a']);
  });

  it('succeeds with multiple occurrences', () => {
    const p = many1(digit);
    const r = p('789 rest');
    assert.ok(r.success);
    if (r.success) assert.deepEqual(r.value, ['7', '8', '9']);
  });

  it('fails on empty input', () => {
    const p = many1(letter);
    assert.ok(!p('').success);
  });

  it('preserves remaining after matches', () => {
    const p = many1(literal('ab'));
    const r = p('ababcd');
    assert.ok(r.success);
    if (r.success) assert.equal(r.remaining, 'cd');
  });

  it('includes error on failure', () => {
    const p = many1(literal('x'));
    const r = p('y');
    assert.ok(!r.success);
    if (!r.success) assert.ok(r.error.length > 0);
  });

  it('can be used inside sequence', () => {
    const p = sequence(literal('('), many1(digit), literal(')'));
    assert.ok(p('(123)').success);
    assert.ok(!p('()').success);
  });

  it('collects all values into array', () => {
    const p = many1(regex(/[a-z]/));
    const r = p('abc1');
    assert.ok(r.success);
    if (r.success) assert.deepEqual(r.value, ['a', 'b', 'c']);
  });
});

// ─── optional ─────────────────────────────────────────────────────────────────

describe('optional', () => {
  it('returns value when parser succeeds', () => {
    const p = optional(literal('+'));
    const r = p('+5');
    assert.ok(r.success);
    if (r.success) assert.equal(r.value, '+');
  });

  it('returns null when parser fails (does not consume input)', () => {
    const p = optional(literal('+'));
    const r = p('5');
    assert.ok(r.success);
    if (r.success) {
      assert.equal(r.value, null);
      assert.equal(r.remaining, '5');
    }
  });

  it('works on empty input', () => {
    const p = optional(literal('x'));
    const r = p('');
    assert.ok(r.success);
    if (r.success) assert.equal(r.value, null);
  });

  it('preserves remaining when matched', () => {
    const p = optional(regex(/\d+/));
    const r = p('123abc');
    assert.ok(r.success);
    if (r.success) assert.equal(r.remaining, 'abc');
  });

  it('does not consume input when not matched', () => {
    const p = optional(literal('x'));
    const r = p('y remainder');
    assert.ok(r.success);
    if (r.success) assert.equal(r.remaining, 'y remainder');
  });

  it('can be used for optional sign in number parsing', () => {
    const p = sequence(optional(literal('-')), regex(/\d+/));
    const pos = p('42');
    const neg = p('-42');
    assert.ok(pos.success);
    assert.ok(neg.success);
    if (pos.success) assert.equal(pos.value[0], null);
    if (neg.success) assert.equal(neg.value[0], '-');
  });

  it('optional of always-failing parser always gives null', () => {
    const never = (_input) => ({ success: false, error: 'never', remaining: _input });
    const p = optional(never);
    const r = p('anything');
    assert.ok(r.success);
    if (r.success) assert.equal(r.value, null);
  });

  it('always returns success', () => {
    const p = optional(literal('z'));
    assert.ok(p('zzz').success);
    assert.ok(p('aaa').success);
    assert.ok(p('').success);
  });
});

// ─── between ──────────────────────────────────────────────────────────────────

describe('between', () => {
  it('extracts value between open and close', () => {
    const p = between(literal('('), literal(')'), regex(/[^)]+/));
    const r = p('(hello)world');
    assert.ok(r.success);
    if (r.success) {
      assert.equal(r.value, 'hello');
      assert.equal(r.remaining, 'world');
    }
  });

  it('fails when open does not match', () => {
    const p = between(literal('['), literal(']'), regex(/\w+/));
    assert.ok(!p('(content)').success);
  });

  it('fails when close does not match', () => {
    const p = between(literal('('), literal(')'), regex(/\w+/));
    assert.ok(!p('(content]').success);
  });

  it('fails when inner parser fails', () => {
    const p = between(literal('"'), literal('"'), literal('must'));
    assert.ok(!p('"nope"').success);
  });

  it('works with ws to allow spaces inside delimiters', () => {
    const p = between(literal('['), literal(']'), sequence(ws, regex(/\w+/), ws));
    const r = p('[ hello ]');
    assert.ok(r.success);
  });

  it('passes remaining after close delimiter', () => {
    const p = between(literal('<'), literal('>'), regex(/\w+/));
    const r = p('<tag> rest');
    assert.ok(r.success);
    if (r.success) assert.equal(r.remaining, ' rest');
  });

  it('works with number parser inside parens', () => {
    const p = between(literal('('), literal(')'), numParser);
    const r = p('(3.14)');
    assert.ok(r.success);
    if (r.success) assert.equal(r.value, 3.14);
  });

  it('works with identical open and close delimiters (quotes)', () => {
    const p = between(literal('"'), literal('"'), regex(/[^"]*/));
    const r = p('"hello world"');
    assert.ok(r.success);
    if (r.success) assert.equal(r.value, 'hello world');
  });
});

// ─── separated ────────────────────────────────────────────────────────────────

describe('separated', () => {
  it('parses comma-separated values', () => {
    const p = separated(regex(/\w+/), literal(','));
    const r = p('foo,bar,baz');
    assert.ok(r.success);
    if (r.success) assert.deepEqual(r.value, ['foo', 'bar', 'baz']);
  });

  it('returns empty array when no items match', () => {
    const p = separated(literal('x'), literal(','));
    const r = p('abc');
    assert.ok(r.success);
    if (r.success) assert.deepEqual(r.value, []);
  });

  it('returns single item when no separator is present', () => {
    const p = separated(regex(/\w+/), literal(','));
    const r = p('only');
    assert.ok(r.success);
    if (r.success) assert.deepEqual(r.value, ['only']);
  });

  it('does not require a trailing separator', () => {
    const p = separated(digit, literal('-'));
    const r = p('1-2-3 done');
    assert.ok(r.success);
    if (r.success) {
      assert.deepEqual(r.value, ['1', '2', '3']);
      assert.equal(r.remaining, ' done');
    }
  });

  it('leaves remaining input after last matched item', () => {
    const p = separated(regex(/[a-z]+/), literal('|'));
    const r = p('a|b|c 123');
    assert.ok(r.success);
    if (r.success) assert.equal(r.remaining, ' 123');
  });

  it('handles two-item list', () => {
    const p = separated(numParser, sequence(ws, literal(','), ws));
    const r = p('1,2');
    assert.ok(r.success);
    if (r.success) assert.deepEqual(r.value, [1, 2]);
  });

  it('stops before trailing separator (no trailing sep)', () => {
    const p = separated(regex(/\d+/), literal(','));
    const r = p('1,2,');
    assert.ok(r.success);
    if (r.success) {
      assert.deepEqual(r.value, ['1', '2']);
      assert.equal(r.remaining, ',');
    }
  });

  it('works with between for array syntax', () => {
    const item = regex(/\w+/);
    const sep = sequence(ws, literal(','), ws);
    const p = between(
      sequence(literal('['), ws),
      sequence(ws, literal(']')),
      separated(item, sep),
    );
    const r = p('[ foo , bar , baz ]');
    assert.ok(r.success);
    if (r.success) assert.deepEqual(r.value, ['foo', 'bar', 'baz']);
  });
});

// ─── ws / digit / letter / number ────────────────────────────────────────────

describe('ws', () => {
  it('consumes leading whitespace', () => {
    const r = ws('   hello');
    assert.ok(r.success);
    if (r.success) {
      assert.equal(r.value, '   ');
      assert.equal(r.remaining, 'hello');
    }
  });

  it('succeeds with no whitespace (returns empty string)', () => {
    const r = ws('hello');
    assert.ok(r.success);
    if (r.success) assert.equal(r.value, '');
  });

  it('succeeds on empty input', () => {
    const r = ws('');
    assert.ok(r.success);
    if (r.success) assert.equal(r.value, '');
  });

  it('consumes tabs and newlines', () => {
    const r = ws('\t\n  x');
    assert.ok(r.success);
    if (r.success) assert.equal(r.remaining, 'x');
  });

  it('is useful for trimming between tokens', () => {
    const p = sequence(regex(/\w+/), ws, regex(/\w+/));
    const r = p('foo   bar');
    assert.ok(r.success);
  });
});

describe('digit', () => {
  it('matches a single digit', () => {
    const r = digit('5abc');
    assert.ok(r.success);
    if (r.success) assert.equal(r.value, '5');
  });

  it('fails on a non-digit', () => {
    assert.ok(!digit('a1').success);
  });

  it('matches 0', () => {
    const r = digit('0');
    assert.ok(r.success);
    if (r.success) assert.equal(r.value, '0');
  });

  it('matches 9', () => {
    const r = digit('9');
    assert.ok(r.success);
    if (r.success) assert.equal(r.value, '9');
  });

  it('fails on empty input', () => {
    assert.ok(!digit('').success);
  });

  it('only matches one character', () => {
    const r = digit('123');
    assert.ok(r.success);
    if (r.success) {
      assert.equal(r.value, '1');
      assert.equal(r.remaining, '23');
    }
  });
});

describe('letter', () => {
  it('matches a lowercase letter', () => {
    const r = letter('abc');
    assert.ok(r.success);
    if (r.success) assert.equal(r.value, 'a');
  });

  it('matches an uppercase letter', () => {
    const r = letter('Abc');
    assert.ok(r.success);
    if (r.success) assert.equal(r.value, 'A');
  });

  it('fails on a digit', () => {
    assert.ok(!letter('1').success);
  });

  it('fails on a space', () => {
    assert.ok(!letter(' ').success);
  });

  it('fails on empty input', () => {
    assert.ok(!letter('').success);
  });

  it('only matches one character', () => {
    const r = letter('hello');
    assert.ok(r.success);
    if (r.success) {
      assert.equal(r.value, 'h');
      assert.equal(r.remaining, 'ello');
    }
  });
});

describe('number', () => {
  it('parses an integer', () => {
    const r = numParser('42 rest');
    assert.ok(r.success);
    if (r.success) assert.equal(r.value, 42);
  });

  it('parses a float', () => {
    const r = numParser('3.14');
    assert.ok(r.success);
    if (r.success) assert.ok(Math.abs(r.value - 3.14) < 1e-10);
  });

  it('parses a negative number', () => {
    const r = numParser('-5.5');
    assert.ok(r.success);
    if (r.success) assert.equal(r.value, -5.5);
  });

  it('parses a positive number with explicit sign', () => {
    const r = numParser('+10');
    assert.ok(r.success);
    if (r.success) assert.equal(r.value, 10);
  });

  it('fails on non-numeric input', () => {
    assert.ok(!numParser('abc').success);
  });

  it('returns a JavaScript number (not string)', () => {
    const r = numParser('7');
    assert.ok(r.success);
    if (r.success) assert.equal(typeof r.value, 'number');
  });

  it('parses zero', () => {
    const r = numParser('0');
    assert.ok(r.success);
    if (r.success) assert.equal(r.value, 0);
  });

  it('leaves non-numeric remaining after number', () => {
    const r = numParser('100px');
    assert.ok(r.success);
    if (r.success) {
      assert.equal(r.value, 100);
      assert.equal(r.remaining, 'px');
    }
  });
});
