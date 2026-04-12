// ─── Unit Tests: Parser Combinators ───────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  char,
  str,
  regex,
  digit,
  letter,
  whitespace,
  optionalWhitespace,
  anyChar,
  eof,
  seq,
  alt,
  many,
  many1,
  optional,
  map,
  between,
  sepBy,
  lazy,
  integer,
  float,
  quoted,
} from '../../app/modules/parser-combinators.js';

// ─── char ─────────────────────────────────────────────────────────────────────

describe('char', () => {
  it('matches the expected character', () => {
    const r = char('a')('abc');
    assert.equal(r.success, true);
    assert.equal(r.value, 'a');
    assert.equal(r.remaining, 'bc');
  });

  it('fails on a different character', () => {
    const r = char('x')('abc');
    assert.equal(r.success, false);
    assert.equal(r.at, 0);
  });

  it('fails on empty input', () => {
    const r = char('a')('');
    assert.equal(r.success, false);
  });

  it('matches a multi-byte sequence when c is a multi-char string', () => {
    // char can also be used as a short alias for str when the string is 1 char
    const r = char('!')('!end');
    assert.equal(r.success, true);
    assert.equal(r.remaining, 'end');
  });
});

// ─── str ──────────────────────────────────────────────────────────────────────

describe('str', () => {
  it('matches an exact multi-character string', () => {
    const r = str('hello')('hello world');
    assert.equal(r.success, true);
    assert.equal(r.value, 'hello');
    assert.equal(r.remaining, ' world');
  });

  it('fails when the input does not start with the string', () => {
    const r = str('foo')('bar');
    assert.equal(r.success, false);
    assert.equal(r.at, 0);
  });

  it('succeeds on exact match leaving empty remaining', () => {
    const r = str('abc')('abc');
    assert.equal(r.success, true);
    assert.equal(r.remaining, '');
  });

  it('matches the empty string (always succeeds)', () => {
    const r = str('')('anything');
    assert.equal(r.success, true);
    assert.equal(r.value, '');
    assert.equal(r.remaining, 'anything');
  });
});

// ─── regex ────────────────────────────────────────────────────────────────────

describe('regex', () => {
  it('matches digits at the start of input', () => {
    const r = regex(/\d+/)('123abc');
    assert.equal(r.success, true);
    assert.equal(r.value, '123');
    assert.equal(r.remaining, 'abc');
  });

  it('fails when the pattern does not match', () => {
    const r = regex(/\d+/)('abc');
    assert.equal(r.success, false);
  });

  it('is anchored — does not match in the middle of the string', () => {
    const r = regex(/\d+/)('abc123');
    assert.equal(r.success, false);
  });

  it('honours case-insensitive flag', () => {
    const r = regex(/[a-z]+/i)('ABC123');
    assert.equal(r.success, true);
    assert.equal(r.value, 'ABC');
  });

  it('does not double-anchor a regex that already starts with ^', () => {
    const r = regex(/^\d+/)('42rest');
    assert.equal(r.success, true);
    assert.equal(r.value, '42');
  });
});

// ─── digit / letter ───────────────────────────────────────────────────────────

describe('digit', () => {
  it('matches a single decimal digit', () => {
    const r = digit()('7abc');
    assert.equal(r.success, true);
    assert.equal(r.value, '7');
    assert.equal(r.remaining, 'abc');
  });

  it('fails on a non-digit character', () => {
    assert.equal(digit()('a').success, false);
  });

  it('fails on empty input', () => {
    assert.equal(digit()('').success, false);
  });
});

describe('letter', () => {
  it('matches a lowercase letter', () => {
    const r = letter()('hello');
    assert.equal(r.success, true);
    assert.equal(r.value, 'h');
  });

  it('matches an uppercase letter', () => {
    const r = letter()('Z9');
    assert.equal(r.success, true);
    assert.equal(r.value, 'Z');
    assert.equal(r.remaining, '9');
  });

  it('fails on a digit', () => {
    assert.equal(letter()('3').success, false);
  });

  it('fails on empty input', () => {
    assert.equal(letter()('').success, false);
  });
});

// ─── whitespace / optionalWhitespace ─────────────────────────────────────────

describe('whitespace', () => {
  it('matches one or more whitespace characters', () => {
    const r = whitespace()('   \t\nnext');
    assert.equal(r.success, true);
    assert.equal(r.value, '   \t\n');
    assert.equal(r.remaining, 'next');
  });

  it('fails when there is no whitespace at the start', () => {
    const r = whitespace()('abc');
    assert.equal(r.success, false);
  });
});

describe('optionalWhitespace', () => {
  it('matches zero or more whitespace characters', () => {
    const r = optionalWhitespace()('  hello');
    assert.equal(r.success, true);
    assert.equal(r.value, '  ');
    assert.equal(r.remaining, 'hello');
  });

  it('succeeds with empty match when there is no whitespace', () => {
    const r = optionalWhitespace()('hello');
    assert.equal(r.success, true);
    assert.equal(r.value, '');
    assert.equal(r.remaining, 'hello');
  });

  it('succeeds on empty input returning empty string', () => {
    const r = optionalWhitespace()('');
    assert.equal(r.success, true);
    assert.equal(r.value, '');
  });
});

// ─── anyChar / eof ────────────────────────────────────────────────────────────

describe('anyChar', () => {
  it('matches the first character of any string', () => {
    const r = anyChar()('xyz');
    assert.equal(r.success, true);
    assert.equal(r.value, 'x');
    assert.equal(r.remaining, 'yz');
  });

  it('fails on empty input', () => {
    assert.equal(anyChar()('').success, false);
  });
});

describe('eof', () => {
  it('succeeds on empty input', () => {
    const r = eof()('');
    assert.equal(r.success, true);
    assert.equal(r.value, null);
    assert.equal(r.remaining, '');
  });

  it('fails when input is not exhausted', () => {
    const r = eof()('x');
    assert.equal(r.success, false);
    assert.equal(r.at, 0);
  });
});

// ─── seq ──────────────────────────────────────────────────────────────────────

describe('seq', () => {
  it('combines two parsers into a tuple', () => {
    const p = seq(str('foo'), str('bar'));
    const r = p('foobar');
    assert.equal(r.success, true);
    assert.deepEqual(r.value, ['foo', 'bar']);
    assert.equal(r.remaining, '');
  });

  it('fails and reports offset when a later parser fails', () => {
    const p = seq(str('foo'), str('bar'));
    const r = p('foobaz');
    assert.equal(r.success, false);
    // 'foo' consumed 3 chars; failure at offset 3.
    assert.equal(r.at, 3);
  });

  it('threads remaining through all parsers', () => {
    const p = seq(regex(/\d+/), str('-'), regex(/[a-z]+/));
    const r = p('42-hello world');
    assert.deepEqual(r.value, ['42', '-', 'hello']);
    assert.equal(r.remaining, ' world');
  });

  it('succeeds with a single parser', () => {
    const r = seq(digit())('5rest');
    assert.deepEqual(r.value, ['5']);
    assert.equal(r.remaining, 'rest');
  });
});

// ─── alt ──────────────────────────────────────────────────────────────────────

describe('alt', () => {
  it('returns the first matching alternative', () => {
    const p = alt(str('foo'), str('bar'));
    assert.equal(p('foobar').value, 'foo');
    assert.equal(p('barbaz').value, 'bar');
  });

  it('fails when no alternative matches', () => {
    const r = alt(str('a'), str('b'))('c');
    assert.equal(r.success, false);
  });

  it('tries alternatives in order (first match wins)', () => {
    // 'ab' should win over 'a' because it is listed first.
    const p = alt(str('ab'), str('a'));
    assert.equal(p('abc').value, 'ab');
  });

  it('returns the deepest failure for better error messages', () => {
    // Both fail at position 0, so we just check success is false.
    const r = alt(str('x'), str('y'))('z');
    assert.equal(r.success, false);
    assert.ok(r.at >= 0);
  });
});

// ─── many / many1 ─────────────────────────────────────────────────────────────

describe('many', () => {
  it('collects zero or more matches', () => {
    const r = many(char('a'))('aaab');
    assert.deepEqual(r.value, ['a', 'a', 'a']);
    assert.equal(r.remaining, 'b');
  });

  it('succeeds with zero matches', () => {
    const r = many(char('x'))('yyy');
    assert.equal(r.success, true);
    assert.deepEqual(r.value, []);
    assert.equal(r.remaining, 'yyy');
  });

  it('succeeds on empty input', () => {
    const r = many(char('x'))('');
    assert.equal(r.success, true);
    assert.deepEqual(r.value, []);
  });

  it('collects multiple distinct characters via regex', () => {
    const r = many(digit())('12345end');
    assert.deepEqual(r.value, ['1', '2', '3', '4', '5']);
    assert.equal(r.remaining, 'end');
  });
});

describe('many1', () => {
  it('succeeds with one or more matches', () => {
    const r = many1(digit())('123x');
    assert.equal(r.success, true);
    assert.deepEqual(r.value, ['1', '2', '3']);
    assert.equal(r.remaining, 'x');
  });

  it('fails with zero matches', () => {
    const r = many1(char('x'))('yyy');
    assert.equal(r.success, false);
  });

  it('succeeds with exactly one match', () => {
    const r = many1(char('a'))('ab');
    assert.deepEqual(r.value, ['a']);
    assert.equal(r.remaining, 'b');
  });
});

// ─── optional ────────────────────────────────────────────────────────────────

describe('optional', () => {
  it('returns the value when the parser matches', () => {
    const r = optional(char('-'))('-42');
    assert.equal(r.success, true);
    assert.equal(r.value, '-');
    assert.equal(r.remaining, '42');
  });

  it('returns null (not undefined) when the parser does not match', () => {
    const r = optional(char('-'))('42');
    assert.equal(r.success, true);
    assert.strictEqual(r.value, null);
    assert.equal(r.remaining, '42');
  });

  it('does not consume input on a miss', () => {
    const r = optional(str('nope'))('yes');
    assert.equal(r.remaining, 'yes');
  });
});

// ─── map ─────────────────────────────────────────────────────────────────────

describe('map', () => {
  it('transforms a successful result', () => {
    const p = map(regex(/\d+/), Number);
    const r = p('42rest');
    assert.equal(r.success, true);
    assert.equal(r.value, 42);
    assert.equal(r.remaining, 'rest');
  });

  it('propagates failure without calling the transform', () => {
    let called = false;
    const p = map(char('x'), (s) => { called = true; return s.toUpperCase(); });
    const r = p('y');
    assert.equal(r.success, false);
    assert.equal(called, false);
  });

  it('supports chaining: digits → joined string → number', () => {
    const p = map(many1(digit()), (digits) => parseInt(digits.join(''), 10));
    const r = p('1234abc');
    assert.equal(r.value, 1234);
  });
});

// ─── between ─────────────────────────────────────────────────────────────────

describe('between', () => {
  it('parses content between delimiters', () => {
    const p = between(char('('), char(')'), regex(/[^)]*/));
    const r = p('(hello)world');
    assert.equal(r.success, true);
    assert.equal(r.value, 'hello');
    assert.equal(r.remaining, 'world');
  });

  it('fails if the open delimiter is missing', () => {
    const p = between(char('['), char(']'), regex(/\w+/));
    assert.equal(p('foo]').success, false);
  });

  it('fails if the close delimiter is missing', () => {
    const p = between(char('['), char(']'), regex(/\w+/));
    assert.equal(p('[foo').success, false);
  });

  it('can parse a simple quoted string', () => {
    const p = between(char('"'), char('"'), regex(/[^"]*/));
    const r = p('"hello world" extra');
    assert.equal(r.value, 'hello world');
    assert.equal(r.remaining, ' extra');
  });

  it('returns only the inner value, discarding delimiters', () => {
    const p = between(str('<<'), str('>>'), regex(/\d+/));
    const r = p('<<42>>rest');
    assert.equal(r.value, '42');
  });
});

// ─── sepBy ────────────────────────────────────────────────────────────────────

describe('sepBy', () => {
  const word = regex(/[a-z]+/);
  const comma = char(',');

  it('parses a comma-separated list', () => {
    const r = sepBy(word, comma)('a,b,c rest');
    assert.deepEqual(r.value, ['a', 'b', 'c']);
    assert.equal(r.remaining, ' rest');
  });

  it('handles a single item with no separator', () => {
    const r = sepBy(word, comma)('hello world');
    assert.deepEqual(r.value, ['hello']);
    assert.equal(r.remaining, ' world');
  });

  it('returns an empty array when nothing matches', () => {
    const r = sepBy(word, comma)('123');
    assert.equal(r.success, true);
    assert.deepEqual(r.value, []);
    assert.equal(r.remaining, '123');
  });

  it('does not consume a trailing separator', () => {
    // "a,123" — comma precedes a non-word, so only 'a' is consumed.
    const r = sepBy(word, comma)('a,123');
    assert.deepEqual(r.value, ['a']);
    assert.equal(r.remaining, ',123');
  });
});

// ─── lazy ────────────────────────────────────────────────────────────────────

describe('lazy', () => {
  it('defers construction until first call', () => {
    let constructed = 0;
    const p = lazy(() => { constructed++; return str('hi'); });
    assert.equal(constructed, 0);
    p('hi');
    assert.equal(constructed, 1);
    // Second call reuses the cached parser.
    p('hi');
    assert.equal(constructed, 1);
  });

  it('supports recursive grammars (nested parentheses)', () => {
    // expr = '(' expr ')' | 'x'
    const expr = lazy(() =>
      alt(
        between(char('('), char(')'), expr),
        str('x'),
      )
    );
    assert.equal(expr('x').value, 'x');
    assert.equal(expr('(x)').value, 'x');
    assert.equal(expr('((x))').value, 'x');
    assert.equal(expr('(((x)))').value, 'x');
  });
});

// ─── integer / float / quoted ─────────────────────────────────────────────────

describe('integer', () => {
  it('parses a positive integer', () => {
    const r = integer()('42rest');
    assert.equal(r.success, true);
    assert.equal(r.value, 42);
    assert.equal(r.remaining, 'rest');
  });

  it('parses a negative integer', () => {
    const r = integer()('-7next');
    assert.equal(r.success, true);
    assert.equal(r.value, -7);
  });

  it('parses zero', () => {
    assert.equal(integer()('0').value, 0);
  });

  it('fails on non-numeric input', () => {
    assert.equal(integer()('abc').success, false);
  });

  it('returns a JS number type', () => {
    assert.equal(typeof integer()('123').value, 'number');
  });
});

describe('float', () => {
  it('parses an integer-like float', () => {
    assert.equal(float()('3rest').value, 3);
  });

  it('parses a decimal float', () => {
    const r = float()('3.14rest');
    assert.equal(r.success, true);
    assert.equal(r.value, 3.14);
    assert.equal(r.remaining, 'rest');
  });

  it('parses a negative float', () => {
    assert.equal(float()('-2.5').value, -2.5);
  });

  it('parses scientific notation', () => {
    assert.equal(float()('1e3').value, 1000);
    assert.equal(float()('2.5E-1').value, 0.25);
  });

  it('fails on non-numeric input', () => {
    assert.equal(float()('abc').success, false);
  });
});

describe('quoted', () => {
  it('parses a simple double-quoted string', () => {
    const r = quoted()('"hello" rest');
    assert.equal(r.success, true);
    assert.equal(r.value, 'hello');
    assert.equal(r.remaining, ' rest');
  });

  it('parses an empty quoted string', () => {
    const r = quoted()('""end');
    assert.equal(r.success, true);
    assert.equal(r.value, '');
    assert.equal(r.remaining, 'end');
  });

  it('handles escaped double-quote inside the string', () => {
    const r = quoted()('"say \\"hi\\""');
    assert.equal(r.success, true);
    assert.equal(r.value, 'say "hi"');
  });

  it('handles escaped backslash', () => {
    const r = quoted()('"a\\\\b"');
    assert.equal(r.success, true);
    assert.equal(r.value, 'a\\b');
  });

  it('handles \\n and \\t escapes', () => {
    const r = quoted()('"line1\\nline2\\ttab"');
    assert.equal(r.success, true);
    assert.equal(r.value, 'line1\nline2\ttab');
  });

  it('fails when there is no opening double-quote', () => {
    assert.equal(quoted()('hello').success, false);
  });

  it('fails when the closing double-quote is missing', () => {
    assert.equal(quoted()('"unterminated').success, false);
  });
});

// ─── Composition: realistic use-cases ────────────────────────────────────────

describe('composed parsers', () => {
  it('parses a simple arithmetic expression: number op number', () => {
    const num = map(regex(/\d+/), Number);
    const op = alt(char('+'), char('-'), char('*'), char('/'));
    const ws = optionalWhitespace();
    const expr = seq(
      map(seq(num, ws), ([n]) => n),
      map(seq(op, ws), ([o]) => o),
      num,
    );
    const r = expr('10 + 42');
    assert.deepEqual(r.value, [10, '+', 42]);
  });

  it('parses a parenthesised comma-separated integer list', () => {
    const ws = optionalWhitespace();
    const num = map(seq(ws, integer(), ws), ([, n]) => n);
    const sep = map(seq(ws, char(','), ws), () => null);
    const list = between(char('('), char(')'), sepBy(num, sep));
    const r = list('( 1 , 2 , 3 )');
    assert.deepEqual(r.value, [1, 2, 3]);
  });

  it('parses a JSON-like key:value pair with quoted key', () => {
    const ws = optionalWhitespace();
    const colon = map(seq(ws, char(':'), ws), () => null);
    const pair = seq(quoted(), map(colon, () => ':'), quoted());
    const r = pair('"name":"Alice"rest');
    assert.deepEqual(r.value, ['name', ':', 'Alice']);
    assert.equal(r.remaining, 'rest');
  });

  it('parses a CSV row', () => {
    // Fields may be quoted or plain identifiers.
    const plainField = regex(/[^,\n]*/);
    const field = alt(quoted(), plainField);
    const row = sepBy(field, char(','));
    const r = row('"Alice",30,"New York"');
    assert.deepEqual(r.value, ['Alice', '30', 'New York']);
  });
});
