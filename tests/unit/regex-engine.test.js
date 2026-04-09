// ─── Unit Tests: Regex Engine ────────────────────────────────────────────────
// Tests the NFA-based regex engine implementation.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { RegexEngine, createRegexEngine } from '../../app/modules/regex-engine.js';

// ─── Factory ─────────────────────────────────────────────────────────────────

describe('RegexEngine — factory', () => {
  it('createRegexEngine returns a RegexEngine instance', () => {
    const engine = createRegexEngine('abc');
    assert.ok(engine instanceof RegexEngine);
  });

  it('pattern getter returns the original pattern', () => {
    const engine = new RegexEngine('a.b');
    assert.equal(engine.pattern, 'a.b');
  });
});

// ─── test() — literal matches ────────────────────────────────────────────────

describe('RegexEngine — test() literals', () => {
  it('matches an exact literal string', () => {
    assert.equal(createRegexEngine('hello').test('hello'), true);
  });

  it('rejects a different string', () => {
    assert.equal(createRegexEngine('hello').test('world'), false);
  });

  it('rejects a partial match (input too long)', () => {
    assert.equal(createRegexEngine('hel').test('hello'), false);
  });

  it('rejects a partial match (input too short)', () => {
    assert.equal(createRegexEngine('hello').test('hel'), false);
  });

  it('matches empty pattern against empty input', () => {
    assert.equal(createRegexEngine('').test(''), true);
  });
});

// ─── test() — dot ────────────────────────────────────────────────────────────

describe('RegexEngine — test() dot', () => {
  it('. matches any single character', () => {
    const re = createRegexEngine('a.c');
    assert.equal(re.test('abc'), true);
    assert.equal(re.test('axc'), true);
    assert.equal(re.test('a1c'), true);
  });

  it('. does not match empty', () => {
    assert.equal(createRegexEngine('.').test(''), false);
  });
});

// ─── test() — star ───────────────────────────────────────────────────────────

describe('RegexEngine — test() star', () => {
  it('a* matches zero a chars', () => {
    assert.equal(createRegexEngine('a*').test(''), true);
  });

  it('a* matches multiple a chars', () => {
    assert.equal(createRegexEngine('a*').test('aaa'), true);
  });

  it('a*b matches b with no a prefix', () => {
    assert.equal(createRegexEngine('a*b').test('b'), true);
  });

  it('a*b matches aab', () => {
    assert.equal(createRegexEngine('a*b').test('aab'), true);
  });
});

// ─── test() — plus ───────────────────────────────────────────────────────────

describe('RegexEngine — test() plus', () => {
  it('a+ does not match empty', () => {
    assert.equal(createRegexEngine('a+').test(''), false);
  });

  it('a+ matches one or more a chars', () => {
    assert.equal(createRegexEngine('a+').test('a'), true);
    assert.equal(createRegexEngine('a+').test('aaa'), true);
  });
});

// ─── test() — question ───────────────────────────────────────────────────────

describe('RegexEngine — test() question', () => {
  it('a? matches empty', () => {
    assert.equal(createRegexEngine('a?').test(''), true);
  });

  it('a? matches single a', () => {
    assert.equal(createRegexEngine('a?').test('a'), true);
  });

  it('a? does not match aa', () => {
    assert.equal(createRegexEngine('a?').test('aa'), false);
  });
});

// ─── test() — alternation ────────────────────────────────────────────────────

describe('RegexEngine — test() alternation', () => {
  it('a|b matches a', () => {
    assert.equal(createRegexEngine('a|b').test('a'), true);
  });

  it('a|b matches b', () => {
    assert.equal(createRegexEngine('a|b').test('b'), true);
  });

  it('a|b does not match c', () => {
    assert.equal(createRegexEngine('a|b').test('c'), false);
  });

  it('cat|dog matches both words', () => {
    const re = createRegexEngine('cat|dog');
    assert.equal(re.test('cat'), true);
    assert.equal(re.test('dog'), true);
    assert.equal(re.test('rat'), false);
  });
});

// ─── test() — groups ─────────────────────────────────────────────────────────

describe('RegexEngine — test() groups', () => {
  it('(ab)+ matches abab', () => {
    assert.equal(createRegexEngine('(ab)+').test('abab'), true);
  });

  it('(ab)+ does not match empty', () => {
    assert.equal(createRegexEngine('(ab)+').test(''), false);
  });

  it('(a|b)c matches ac and bc', () => {
    const re = createRegexEngine('(a|b)c');
    assert.equal(re.test('ac'), true);
    assert.equal(re.test('bc'), true);
    assert.equal(re.test('cc'), false);
  });
});

// ─── test() — character classes ──────────────────────────────────────────────

describe('RegexEngine — test() character classes', () => {
  it('[abc] matches individual characters', () => {
    const re = createRegexEngine('[abc]');
    assert.equal(re.test('a'), true);
    assert.equal(re.test('b'), true);
    assert.equal(re.test('c'), true);
    assert.equal(re.test('d'), false);
  });

  it('[a-z] matches lowercase letters', () => {
    const re = createRegexEngine('[a-z]');
    assert.equal(re.test('m'), true);
    assert.equal(re.test('A'), false);
    assert.equal(re.test('5'), false);
  });

  it('[a-z]+ matches a word', () => {
    assert.equal(createRegexEngine('[a-z]+').test('hello'), true);
  });

  it('[0-9]+ matches digits', () => {
    assert.equal(createRegexEngine('[0-9]+').test('42'), true);
    assert.equal(createRegexEngine('[0-9]+').test('abc'), false);
  });
});

// ─── search() ────────────────────────────────────────────────────────────────

describe('RegexEngine — search()', () => {
  it('finds a literal pattern in a string', () => {
    const result = createRegexEngine('world').search('hello world');
    assert.notEqual(result, null);
    assert.equal(result.match, 'world');
    assert.equal(result.index, 6);
  });

  it('returns null when no match exists', () => {
    const result = createRegexEngine('xyz').search('hello');
    assert.equal(result, null);
  });

  it('finds the first occurrence', () => {
    const result = createRegexEngine('ab').search('xxabxxab');
    assert.notEqual(result, null);
    assert.equal(result.index, 2);
  });

  it('finds pattern with quantifiers', () => {
    const result = createRegexEngine('[0-9]+').search('abc123def');
    assert.notEqual(result, null);
    assert.equal(result.match, '123');
    assert.equal(result.index, 3);
  });
});

// ─── searchAll() ─────────────────────────────────────────────────────────────

describe('RegexEngine — searchAll()', () => {
  it('finds all occurrences of a literal', () => {
    const results = createRegexEngine('ab').searchAll('ababab');
    assert.equal(results.length, 3);
    assert.equal(results[0].index, 0);
    assert.equal(results[1].index, 2);
    assert.equal(results[2].index, 4);
  });

  it('returns empty array when no matches', () => {
    const results = createRegexEngine('xyz').searchAll('hello');
    assert.equal(results.length, 0);
  });

  it('finds non-overlapping digit groups', () => {
    const results = createRegexEngine('[0-9]+').searchAll('a12b34c5');
    assert.equal(results.length, 3);
    assert.equal(results[0].match, '12');
    assert.equal(results[1].match, '34');
    assert.equal(results[2].match, '5');
  });
});

// ─── Complex patterns ────────────────────────────────────────────────────────

describe('RegexEngine — complex patterns', () => {
  it('nested groups with alternation', () => {
    const re = createRegexEngine('((ab)|(cd))+');
    assert.equal(re.test('abcd'), true);
    assert.equal(re.test('cdab'), true);
    assert.equal(re.test('abab'), true);
    assert.equal(re.test('ef'), false);
  });

  it('dot star matches everything', () => {
    const re = createRegexEngine('.*');
    assert.equal(re.test(''), true);
    assert.equal(re.test('anything goes'), true);
  });

  it('complex: a(b|c)*d', () => {
    const re = createRegexEngine('a(b|c)*d');
    assert.equal(re.test('ad'), true);
    assert.equal(re.test('abd'), true);
    assert.equal(re.test('acd'), true);
    assert.equal(re.test('abcbcbd'), true);
    assert.equal(re.test('aed'), false);
  });
});
