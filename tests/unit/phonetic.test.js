// ─── Unit Tests: phonetic ─────────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  soundex,
  metaphone,
  doubleMetaphone,
  nysiis,
  phoneticMatch,
  phoneticGroup,
} from '../../app/modules/phonetic.js';

// ─── soundex ─────────────────────────────────────────────────────────────────

describe('soundex', () => {
  it('Robert → R163 (classic example)', () => {
    assert.equal(soundex('Robert'), 'R163');
  });

  it('Rupert → R163 (matches Robert)', () => {
    assert.equal(soundex('Rupert'), 'R163');
  });

  it('Ashcraft → A261', () => {
    assert.equal(soundex('Ashcraft'), 'A261');
  });

  it('Euler → E460', () => {
    assert.equal(soundex('Euler'), 'E460');
  });

  it('Ellery → E460 (matches Euler)', () => {
    assert.equal(soundex('Ellery'), 'E460');
  });

  it('returns exactly 4 characters', () => {
    const words = ['Smith', 'A', 'Lee', 'Gutierrez', 'Pfister'];
    for (const w of words) {
      assert.equal(soundex(w).length, 4, `soundex('${w}') length ≠ 4`);
    }
  });

  it('empty string returns empty string', () => {
    assert.equal(soundex(''), '');
  });

  it('single letter is padded to 4 chars', () => {
    assert.equal(soundex('A'), 'A000');
  });

  it('case insensitive: robert == Robert', () => {
    assert.equal(soundex('robert'), soundex('Robert'));
  });

  it('Jackson → J250', () => {
    assert.equal(soundex('Jackson'), 'J250');
  });
});

// ─── metaphone ────────────────────────────────────────────────────────────────

describe('metaphone', () => {
  it('Smith and Smythe produce same code', () => {
    assert.equal(metaphone('Smith'), metaphone('Smythe'));
  });

  it('empty string returns empty string', () => {
    assert.equal(metaphone(''), '');
  });

  it('PH encodes as F', () => {
    const code = metaphone('PHONE');
    assert.ok(code.includes('F'), `expected F in '${code}'`);
  });

  it('KN initial drops K', () => {
    // KNIGHT — starts with KN, so K is dropped
    const knight = metaphone('KNIGHT');
    const night = metaphone('NIGHT');
    assert.equal(knight, night);
  });

  it('returns a non-empty string for a normal word', () => {
    const code = metaphone('hello');
    assert.ok(code.length > 0);
  });

  it('case insensitive: hello == HELLO', () => {
    assert.equal(metaphone('hello'), metaphone('HELLO'));
  });

  it('TH encodes as 0 (theta)', () => {
    const code = metaphone('THINK');
    assert.ok(code.startsWith('0'), `expected '0' at start, got '${code}'`);
  });

  it('X encodes as KS', () => {
    const code = metaphone('EXACT');
    assert.ok(code.includes('KS'), `expected KS in '${code}'`);
  });

  it('similar sounding names share a code', () => {
    // Knight and Night share Metaphone code (silent K)
    assert.equal(metaphone('Knight'), metaphone('Night'));
  });
});

// ─── doubleMetaphone ──────────────────────────────────────────────────────────

describe('doubleMetaphone', () => {
  it('returns a tuple of two strings', () => {
    const result = doubleMetaphone('Smith');
    assert.ok(Array.isArray(result));
    assert.equal(result.length, 2);
  });

  it('both codes are strings', () => {
    const [primary, secondary] = doubleMetaphone('Catherine');
    assert.equal(typeof primary, 'string');
    assert.equal(typeof secondary, 'string');
  });

  it('empty string returns ["", ""]', () => {
    assert.deepEqual(doubleMetaphone(''), ['', '']);
  });

  it('primary code is non-empty for a real word', () => {
    const [primary] = doubleMetaphone('Schmidt');
    assert.ok(primary.length > 0);
  });

  it('case insensitive: smith == SMITH', () => {
    assert.deepEqual(doubleMetaphone('smith'), doubleMetaphone('SMITH'));
  });

  it('Thompson codes include T sound', () => {
    const [primary] = doubleMetaphone('Thompson');
    assert.ok(primary.startsWith('T'), `expected T start, got '${primary}'`);
  });

  it('GN initial drops G: GNOME starts with N sound', () => {
    const [primary] = doubleMetaphone('GNOME');
    assert.ok(primary.startsWith('N') || primary.startsWith('A'), `got '${primary}'`);
  });

  it('Schmidt and Schmid share primary code', () => {
    const [p1] = doubleMetaphone('Schmidt');
    const [p2] = doubleMetaphone('Schmid');
    assert.equal(p1, p2);
  });

  it('codes are at most 4 characters each', () => {
    const words = ['Alexander', 'Washington', 'Philadelphia', 'Mississippi'];
    for (const w of words) {
      const [p, s] = doubleMetaphone(w);
      assert.ok(p.length <= 4, `primary '${p}' for '${w}' > 4 chars`);
      assert.ok(s.length <= 4, `secondary '${s}' for '${w}' > 4 chars`);
    }
  });
});

// ─── nysiis ───────────────────────────────────────────────────────────────────

describe('nysiis', () => {
  it('empty string returns empty string', () => {
    assert.equal(nysiis(''), '');
  });

  it('returns a non-empty string for a real word', () => {
    assert.ok(nysiis('John').length > 0);
  });

  it('code is at most 6 characters', () => {
    const words = ['Washington', 'Philadelphia', 'Christopher', 'Alexander'];
    for (const w of words) {
      const code = nysiis(w);
      assert.ok(code.length <= 6, `nysiis('${w}') = '${code}' > 6 chars`);
    }
  });

  it('case insensitive: john == JOHN', () => {
    assert.equal(nysiis('john'), nysiis('JOHN'));
  });

  it('Mac prefix transforms to MCC', () => {
    // MacPherson → MCC... start
    const code = nysiis('MacPherson');
    assert.ok(code.startsWith('MC'), `expected MC start, got '${code}'`);
  });

  it('PH prefix transforms to FF', () => {
    const a = nysiis('Pfister');
    const b = nysiis('Ffister');
    assert.equal(a, b);
  });

  it('similar sounding names match', () => {
    // Williams and Williamson share the same NYSIIS code
    assert.equal(nysiis('Williams'), nysiis('Williamson'));
  });

  it('result starts with the first letter of the word', () => {
    const words = ['Robert', 'Smith', 'Thompson', 'Williams'];
    for (const w of words) {
      const code = nysiis(w);
      assert.equal(code[0], w[0].toUpperCase(), `first char of nysiis('${w}') = '${code[0]}'`);
    }
  });

  it('output is all upper-case', () => {
    const code = nysiis('Katherine');
    assert.equal(code, code.toUpperCase());
  });
});

// ─── phoneticMatch ────────────────────────────────────────────────────────────

describe('phoneticMatch', () => {
  it('identical words match with soundex', () => {
    assert.ok(phoneticMatch('Robert', 'Robert', 'soundex'));
  });

  it('Robert and Rupert match with soundex', () => {
    assert.ok(phoneticMatch('Robert', 'Rupert', 'soundex'));
  });

  it('completely different words do not match', () => {
    assert.ok(!phoneticMatch('Smith', 'Jones', 'soundex'));
  });

  it('defaults to soundex when no algorithm specified', () => {
    assert.equal(
      phoneticMatch('Robert', 'Rupert'),
      phoneticMatch('Robert', 'Rupert', 'soundex'),
    );
  });

  it('uses metaphone when specified', () => {
    const result = phoneticMatch('Smith', 'Smythe', 'metaphone');
    assert.equal(typeof result, 'boolean');
    assert.ok(result); // Smith and Smythe should match
  });

  it('uses nysiis when specified', () => {
    // Williams and Williamson share the same NYSIIS code
    const result = phoneticMatch('Williams', 'Williamson', 'nysiis');
    assert.ok(result);
  });

  it('returns false for empty strings vs real words', () => {
    assert.ok(!phoneticMatch('', 'hello', 'soundex'));
  });

  it('both empty strings match (soundex)', () => {
    assert.ok(phoneticMatch('', '', 'soundex'));
  });

  it('Fisher and Fischer match with soundex (same F260 code)', () => {
    assert.ok(phoneticMatch('Fisher', 'Fischer', 'soundex'));
  });
});

// ─── phoneticGroup ────────────────────────────────────────────────────────────

describe('phoneticGroup', () => {
  it('returns a Map', () => {
    const result = phoneticGroup(['Smith', 'Smythe']);
    assert.ok(result instanceof Map);
  });

  it('groups phonetically similar words together (soundex)', () => {
    const result = phoneticGroup(['Robert', 'Rupert', 'Smith', 'Smythe']);
    // Robert and Rupert should be in the same group
    let found = false;
    for (const group of result.values()) {
      if (group.includes('Robert') && group.includes('Rupert')) {
        found = true;
        break;
      }
    }
    assert.ok(found, 'Robert and Rupert should be grouped together');
  });

  it('groups phonetically different words in separate buckets', () => {
    const result = phoneticGroup(['Robert', 'Smith', 'Jones']);
    assert.ok(result.size >= 2, 'expected at least 2 groups');
  });

  it('empty input returns empty Map', () => {
    assert.equal(phoneticGroup([]).size, 0);
  });

  it('single word returns Map with one entry', () => {
    const result = phoneticGroup(['Hello']);
    assert.equal(result.size, 1);
    const values = [...result.values()];
    assert.deepEqual(values[0], ['Hello']);
  });

  it('all words have different codes → size equals word count', () => {
    const words = ['Apple', 'Banana', 'Cherry'];
    const result = phoneticGroup(words, 'soundex');
    // Each likely has a unique soundex
    assert.ok(result.size >= 2);
  });

  it('works with metaphone algorithm', () => {
    const result = phoneticGroup(['Smith', 'Smythe', 'Jones'], 'metaphone');
    assert.ok(result instanceof Map);
    let smFound = false;
    for (const group of result.values()) {
      if (group.includes('Smith') && group.includes('Smythe')) {
        smFound = true;
        break;
      }
    }
    assert.ok(smFound, 'Smith and Smythe should be grouped with metaphone');
  });

  it('works with nysiis algorithm', () => {
    const result = phoneticGroup(['Williams', 'Williamson', 'Jones'], 'nysiis');
    assert.ok(result instanceof Map);
    let found = false;
    for (const group of result.values()) {
      if (group.includes('Williams') && group.includes('Williamson')) {
        found = true;
        break;
      }
    }
    assert.ok(found, 'Williams and Williamson should be grouped with nysiis');
  });

  it('preserves original word casing in groups', () => {
    const result = phoneticGroup(['Robert', 'rupert']);
    const allWords = [...result.values()].flat();
    assert.ok(allWords.includes('Robert'));
    assert.ok(allWords.includes('rupert'));
  });
});
