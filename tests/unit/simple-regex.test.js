// ─── Unit Tests: SimpleRegex ─────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { SimpleRegex, compileRegex } from '../../app/modules/simple-regex.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function re(pattern) {
  return new SimpleRegex(pattern);
}

// ─── Literals ────────────────────────────────────────────────────────────────

describe('SimpleRegex – literals', () => {
  it('matches exact single character', () => {
    assert.equal(re('a').test('a'), true);
  });

  it('matches a literal substring', () => {
    assert.equal(re('abc').test('xabcx'), true);
  });

  it('does not match different character', () => {
    assert.equal(re('z').test('abc'), false);
  });

  it('returns correct match for literal', () => {
    const m = re('bc').match('abcd');
    assert.ok(m !== null);
    assert.equal(m.index, 1);
    assert.equal(m.length, 2);
    assert.equal(m.value, 'bc');
  });

  it('returns null when literal not in text', () => {
    assert.equal(re('xyz').match('abc'), null);
  });

  it('empty pattern matches at start', () => {
    const m = re('').match('abc');
    assert.ok(m !== null);
    assert.equal(m.index, 0);
    assert.equal(m.length, 0);
  });
});

// ─── Dot (any character) ─────────────────────────────────────────────────────

describe('SimpleRegex – dot (.)', () => {
  it('. matches any single character', () => {
    assert.equal(re('.').test('a'), true);
    assert.equal(re('.').test('z'), true);
    assert.equal(re('.').test('5'), true);
  });

  it('. does not match empty string', () => {
    assert.equal(re('.').test(''), false);
  });

  it('a.c matches "abc"', () => {
    assert.equal(re('a.c').test('abc'), true);
  });

  it('a.c matches "axc"', () => {
    assert.equal(re('a.c').test('axc'), true);
  });

  it('a.c does not match "ac"', () => {
    assert.equal(re('a.c').test('ac'), false);
  });

  it('returns correct match position for dot', () => {
    const m = re('.').match('xyz');
    assert.ok(m !== null);
    assert.equal(m.index, 0);
    assert.equal(m.value, 'x');
  });
});

// ─── Star (*) ────────────────────────────────────────────────────────────────

describe('SimpleRegex – star (*)', () => {
  it('a* matches ""', () => {
    assert.equal(re('a*').test(''), true);
  });

  it('a* matches "a"', () => {
    assert.equal(re('a*').test('a'), true);
  });

  it('a* matches "aaa"', () => {
    assert.equal(re('a*').test('aaa'), true);
  });

  it('a* matches when embedded in longer string', () => {
    assert.equal(re('a*').test('bbb'), true); // zero-length match at start
  });

  it('ab* matches "a"', () => {
    assert.equal(re('ab*').test('a'), true);
  });

  it('ab* matches "abbb"', () => {
    assert.equal(re('ab*').test('abbb'), true);
  });

  it('a*b matches "b"', () => {
    assert.equal(re('a*b').test('b'), true);
  });

  it('a*b matches "aaab"', () => {
    assert.equal(re('a*b').test('aaab'), true);
  });

  it('greedy star returns longest match', () => {
    const m = re('a*').match('aaab');
    assert.ok(m !== null);
    assert.equal(m.value, 'aaa');
  });
});

// ─── Plus (+) ────────────────────────────────────────────────────────────────

describe('SimpleRegex – plus (+)', () => {
  it('a+ does not match ""', () => {
    // test searches everywhere; empty string has no position with >=1 'a'
    assert.equal(re('a+').test(''), false);
  });

  it('a+ matches "a"', () => {
    assert.equal(re('a+').test('a'), true);
  });

  it('a+ matches "aaa"', () => {
    assert.equal(re('a+').test('aaa'), true);
  });

  it('a+ does not match "b"', () => {
    assert.equal(re('a+').match('b'), null);
  });

  it('a+ returns longest match', () => {
    const m = re('a+').match('aaab');
    assert.ok(m !== null);
    assert.equal(m.value, 'aaa');
  });

  it('a+b matches "ab"', () => {
    assert.equal(re('a+b').test('ab'), true);
  });

  it('a+b matches "aaab"', () => {
    assert.equal(re('a+b').test('aaab'), true);
  });

  it('a+b does not match "b"', () => {
    assert.equal(re('a+b').test('b'), false);
  });
});

// ─── Question (?) ────────────────────────────────────────────────────────────

describe('SimpleRegex – question (?)', () => {
  it('a? matches ""', () => {
    // zero-length match at start
    assert.equal(re('a?').test('b'), true);
  });

  it('a? matches "a"', () => {
    assert.equal(re('a?').test('a'), true);
  });

  it('colou?r matches "color"', () => {
    assert.equal(re('colou?r').test('color'), true);
  });

  it('colou?r matches "colour"', () => {
    assert.equal(re('colou?r').test('colour'), true);
  });

  it('colou?r does not match "colouur"', () => {
    assert.equal(re('colou?r').match('colouur'), null);
  });

  it('a? match value is "a" when present', () => {
    const m = re('a?').match('abc');
    assert.ok(m !== null);
    assert.equal(m.value, 'a');
  });
});

// ─── Alternation (|) ─────────────────────────────────────────────────────────

describe('SimpleRegex – alternation (|)', () => {
  it('a|b matches "a"', () => {
    assert.equal(re('a|b').test('a'), true);
  });

  it('a|b matches "b"', () => {
    assert.equal(re('a|b').test('b'), true);
  });

  it('a|b does not match "c"', () => {
    assert.equal(re('a|b').match('c'), null);
  });

  it('cat|dog matches "cat"', () => {
    assert.equal(re('cat|dog').test('cat'), true);
  });

  it('cat|dog matches "dog"', () => {
    assert.equal(re('cat|dog').test('dog'), true);
  });

  it('cat|dog does not match "cow"', () => {
    assert.equal(re('cat|dog').test('cow'), false);
  });

  it('alternation with groups: (ab)|(cd) matches "cd"', () => {
    assert.equal(re('(ab)|(cd)').test('cd'), true);
  });

  it('alternation picks correct branch', () => {
    const m = re('cat|dog').match('I have a dog');
    assert.ok(m !== null);
    assert.equal(m.value, 'dog');
  });
});

// ─── Grouping (()) ───────────────────────────────────────────────────────────

describe('SimpleRegex – grouping', () => {
  it('(ab)+ matches "ab"', () => {
    assert.equal(re('(ab)+').test('ab'), true);
  });

  it('(ab)+ matches "ababab"', () => {
    assert.equal(re('(ab)+').test('ababab'), true);
  });

  it('(ab)+ does not match "a"', () => {
    assert.equal(re('(ab)+').match('a'), null);
  });

  it('(a|b)+ matches "aabba"', () => {
    assert.equal(re('(a|b)+').test('aabba'), true);
  });

  it('(a|b)* matches ""', () => {
    assert.equal(re('(a|b)*').test(''), true);
  });

  it('a(bc)d matches "abcd"', () => {
    assert.equal(re('a(bc)d').test('abcd'), true);
  });

  it('a(bc)d does not match "acd"', () => {
    assert.equal(re('a(bc)d').test('acd'), false);
  });
});

// ─── Anchors (^ and $) ───────────────────────────────────────────────────────

describe('SimpleRegex – anchors', () => {
  it('^a matches "abc" (starts with a)', () => {
    assert.equal(re('^a').test('abc'), true);
  });

  it('^a does not match "bac" (does not start with a)', () => {
    assert.equal(re('^a').test('bac'), false);
  });

  it('^abc matches "abcdef"', () => {
    assert.equal(re('^abc').test('abcdef'), true);
  });

  it('^abc does not match "xabc"', () => {
    assert.equal(re('^abc').test('xabc'), false);
  });

  it('b$ matches "ab" (ends with b)', () => {
    assert.equal(re('b$').test('ab'), true);
  });

  it('b$ does not match "ba"', () => {
    assert.equal(re('b$').test('ba'), false);
  });

  it('^abc$ matches exactly "abc"', () => {
    assert.equal(re('^abc$').test('abc'), true);
  });

  it('^abc$ does not match "xabc"', () => {
    assert.equal(re('^abc$').test('xabc'), false);
  });

  it('^abc$ does not match "abcx"', () => {
    assert.equal(re('^abc$').test('abcx'), false);
  });

  it('^a*$ matches "aaa"', () => {
    assert.equal(re('^a*$').test('aaa'), true);
  });

  it('^a*$ matches ""', () => {
    assert.equal(re('^a*$').test(''), true);
  });

  it('^a*$ does not match "aab"', () => {
    assert.equal(re('^a*$').test('aab'), false);
  });

  it('anchor match has index 0 for ^', () => {
    const m = re('^abc').match('abcdef');
    assert.ok(m !== null);
    assert.equal(m.index, 0);
  });
});

// ─── match() ─────────────────────────────────────────────────────────────────

describe('SimpleRegex – match()', () => {
  it('returns index, length, value for first match', () => {
    const m = re('foo').match('barfoobar');
    assert.ok(m !== null);
    assert.equal(m.index, 3);
    assert.equal(m.length, 3);
    assert.equal(m.value, 'foo');
  });

  it('returns first (leftmost) match', () => {
    const m = re('a+').match('xaaaxaa');
    assert.ok(m !== null);
    assert.equal(m.index, 1);
    assert.equal(m.value, 'aaa');
  });

  it('returns null when no match', () => {
    assert.equal(re('xyz').match('abcdef'), null);
  });

  it('match on empty string with zero-length pattern', () => {
    const m = re('a*').match('bbb');
    assert.ok(m !== null);
    assert.equal(m.index, 0);
    assert.equal(m.length, 0);
  });
});

// ─── matchAll() ──────────────────────────────────────────────────────────────

describe('SimpleRegex – matchAll()', () => {
  it('returns all non-overlapping literal matches', () => {
    const matches = re('ab').matchAll('ababab');
    assert.equal(matches.length, 3);
    assert.equal(matches[0].index, 0);
    assert.equal(matches[1].index, 2);
    assert.equal(matches[2].index, 4);
  });

  it('returns empty array when no match', () => {
    assert.deepEqual(re('z').matchAll('abc'), []);
  });

  it('matchAll a+ finds all runs of a', () => {
    const matches = re('a+').matchAll('aabba');
    assert.equal(matches.length, 2);
    assert.equal(matches[0].value, 'aa');
    assert.equal(matches[1].value, 'a');
  });

  it('matchAll with alternation', () => {
    const matches = re('cat|dog').matchAll('I have a cat and a dog');
    assert.equal(matches.length, 2);
    assert.equal(matches[0].value, 'cat');
    assert.equal(matches[1].value, 'dog');
  });

  it('matchAll with ^ returns at most one result', () => {
    const matches = re('^a').matchAll('aaa');
    assert.equal(matches.length, 1);
    assert.equal(matches[0].index, 0);
  });

  it('matchAll with $ returns at most one result at end', () => {
    const matches = re('a$').matchAll('bca');
    assert.equal(matches.length, 1);
    assert.equal(matches[0].value, 'a');
  });

  it('every match has correct value equal to text slice', () => {
    const text = 'abXabYab';
    const matches = re('ab').matchAll(text);
    for (const m of matches) {
      assert.equal(m.value, text.slice(m.index, m.index + m.length));
    }
  });
});

// ─── compileRegex factory ─────────────────────────────────────────────────────

describe('compileRegex factory', () => {
  it('returns a SimpleRegex instance', () => {
    const r = compileRegex('abc');
    assert.ok(r instanceof SimpleRegex);
  });

  it('compiled regex works correctly', () => {
    const r = compileRegex('a+b');
    assert.equal(r.test('aaab'), true);
    assert.equal(r.test('b'), false);
  });

  it('toString returns /pattern/', () => {
    const r = compileRegex('a+b');
    assert.equal(r.toString(), '/a+b/');
  });
});

// ─── Complex patterns ────────────────────────────────────────────────────────

describe('SimpleRegex – complex patterns', () => {
  it('(a|b)*c matches "c"', () => {
    assert.equal(re('(a|b)*c').test('c'), true);
  });

  it('(a|b)*c matches "abc"', () => {
    assert.equal(re('(a|b)*c').test('abc'), true);
  });

  it('(a|b)*c matches "baabc"', () => {
    assert.equal(re('(a|b)*c').test('baabc'), true);
  });

  it('(a|b)*c does not match "ab"', () => {
    assert.equal(re('(a|b)*c').match('ab'), null);
  });

  it('.* matches any string', () => {
    assert.equal(re('.*').test('hello world'), true);
    assert.equal(re('.*').test(''), true);
  });

  it('a.+b matches "axb"', () => {
    assert.equal(re('a.+b').test('axb'), true);
  });

  it('a.+b does not match "ab"', () => {
    assert.equal(re('a.+b').match('ab'), null);
  });

  it('digits pattern [using alternation]: 0|1|2 matches single digits', () => {
    assert.equal(re('0|1|2').test('1'), true);
    assert.equal(re('0|1|2').test('3'), false);
  });

  it('nested groups: ((ab)+)c matches "ababc"', () => {
    assert.equal(re('((ab)+)c').test('ababc'), true);
  });
});
