// ─── Unit Tests: readability ─────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  syllableCount,
  complexWordCount,
  totalSyllableCount,
  fleschKincaid,
  gunningFog,
  smogIndex,
  automatedReadabilityIndex,
  colemanLiau,
  textSummary,
} from '../../app/modules/readability.js';

import { wordCount } from '../../app/modules/text-statistics.js';

// ─── syllableCount ────────────────────────────────────────────────────────────

describe('syllableCount', () => {
  it('returns 1 for a one-syllable word', () => {
    assert.equal(syllableCount('cat'), 1);
  });

  it('returns 2 for a two-syllable word', () => {
    assert.equal(syllableCount('happy'), 2);
  });

  it('returns 3 for a three-syllable word', () => {
    assert.equal(syllableCount('beautiful'), 3);
  });

  it('handles silent trailing e', () => {
    // "cake" has 1 syllable despite 2 vowel groups (a, e)
    assert.equal(syllableCount('cake'), 1);
  });

  it('returns at least 1 for any non-empty word', () => {
    assert.ok(syllableCount('rhythm') >= 1);
  });

  it('returns 0 for empty string', () => {
    assert.equal(syllableCount(''), 0);
  });

  it('is case-insensitive', () => {
    assert.equal(syllableCount('Happy'), syllableCount('happy'));
  });

  it('returns 1 for single vowel word', () => {
    assert.equal(syllableCount('a'), 1);
  });
});

// ─── complexWordCount ─────────────────────────────────────────────────────────

describe('complexWordCount', () => {
  it('counts words with 3+ syllables', () => {
    // "beautiful" = 3 syllables → complex
    const count = complexWordCount('beautiful day');
    assert.equal(count, 1);
  });

  it('returns 0 when no complex words are present', () => {
    assert.equal(complexWordCount('the cat sat'), 0);
  });

  it('returns 0 for empty string', () => {
    assert.equal(complexWordCount(''), 0);
  });

  it('counts multiple complex words', () => {
    const count = complexWordCount('understanding educational technology');
    assert.ok(count >= 2);
  });
});

// ─── totalSyllableCount ───────────────────────────────────────────────────────

describe('totalSyllableCount', () => {
  it('sums syllables across all words', () => {
    // "cat" (1) + "happy" (2) = 3
    assert.equal(totalSyllableCount('cat happy'), 3);
  });

  it('returns 0 for empty string', () => {
    assert.equal(totalSyllableCount(''), 0);
  });

  it('is always >= wordCount for non-empty text', () => {
    const text = 'the quick brown fox jumps';
    assert.ok(totalSyllableCount(text) >= wordCount(text));
  });
});

// ─── fleschKincaid ────────────────────────────────────────────────────────────

describe('fleschKincaid', () => {
  it('returns an object with readingEase and gradeLevel', () => {
    const result = fleschKincaid('The cat sat on the mat.');
    assert.ok('readingEase' in result);
    assert.ok('gradeLevel' in result);
  });

  it('returns {0, 0} for empty text', () => {
    assert.deepEqual(fleschKincaid(''), { readingEase: 0, gradeLevel: 0 });
  });

  it('readingEase is a number', () => {
    const { readingEase } = fleschKincaid('Simple text here.');
    assert.equal(typeof readingEase, 'number');
  });

  it('gradeLevel is a number', () => {
    const { gradeLevel } = fleschKincaid('Simple text here.');
    assert.equal(typeof gradeLevel, 'number');
  });

  it('more complex text yields lower readingEase than simple text', () => {
    const simple = fleschKincaid('The cat sat. The dog ran.');
    const complex = fleschKincaid(
      'The implementation of sophisticated algorithms necessitates considerable computational resources.',
    );
    assert.ok(simple.readingEase > complex.readingEase);
  });
});

// ─── gunningFog ───────────────────────────────────────────────────────────────

describe('gunningFog', () => {
  it('returns a number', () => {
    assert.equal(typeof gunningFog('The cat sat on the mat.'), 'number');
  });

  it('returns 0 for empty text', () => {
    assert.equal(gunningFog(''), 0);
  });

  it('is higher for more complex text', () => {
    const simple = gunningFog('The cat sat. The dog ran.');
    const complex = gunningFog(
      'Sophisticated implementation necessitates considerable computational understanding.',
    );
    assert.ok(complex > simple);
  });

  it('is always non-negative for valid text', () => {
    assert.ok(gunningFog('Hello world.') >= 0);
  });
});

// ─── smogIndex ────────────────────────────────────────────────────────────────

describe('smogIndex', () => {
  it('returns a number', () => {
    assert.equal(typeof smogIndex('The cat sat on the mat.'), 'number');
  });

  it('returns 0 for empty text', () => {
    assert.equal(smogIndex(''), 0);
  });

  it('returns at least 3 for non-empty text (SMOG base offset)', () => {
    assert.ok(smogIndex('Hello world.') >= 3);
  });

  it('increases with more polysyllabic words', () => {
    const low = smogIndex('Cat sat. Dog ran. Sun set.');
    const high = smogIndex(
      'Understanding sophisticated implementation. Considerable educational administration. Mathematical approximation.',
    );
    assert.ok(high > low);
  });
});

// ─── automatedReadabilityIndex ────────────────────────────────────────────────

describe('automatedReadabilityIndex', () => {
  it('returns a number', () => {
    assert.equal(typeof automatedReadabilityIndex('The cat sat.'), 'number');
  });

  it('returns 0 for empty text', () => {
    assert.equal(automatedReadabilityIndex(''), 0);
  });

  it('is higher for longer words and sentences', () => {
    const simple = automatedReadabilityIndex('I run. She hops.');
    const complex = automatedReadabilityIndex(
      'The implementation requires substantial computational infrastructure.',
    );
    assert.ok(complex > simple);
  });
});

// ─── colemanLiau ──────────────────────────────────────────────────────────────

describe('colemanLiau', () => {
  it('returns a number', () => {
    assert.equal(typeof colemanLiau('The cat sat on the mat.'), 'number');
  });

  it('returns 0 for empty text', () => {
    assert.equal(colemanLiau(''), 0);
  });

  it('longer average word length increases score', () => {
    // Words of length 3 vs longer academic words
    const simple = colemanLiau('cat sat mat. hat bat.') ;
    const complex = colemanLiau(
      'Identification implementation. Sophisticated administration.',
    );
    assert.ok(complex > simple);
  });
});

// ─── textSummary ──────────────────────────────────────────────────────────────

describe('textSummary', () => {
  it('returns an object with all required fields', () => {
    const result = textSummary('The cat sat on the mat.');
    assert.ok('wordCount' in result);
    assert.ok('sentenceCount' in result);
    assert.ok('averageWordLength' in result);
    assert.ok('averageSentenceLength' in result);
    assert.ok('fleschReadingEase' in result);
    assert.ok('gradeLevel' in result);
  });

  it('wordCount matches text-statistics wordCount', () => {
    const text = 'Hello world. This is a test.';
    assert.equal(textSummary(text).wordCount, wordCount(text));
  });

  it('returns zeroed summary for empty text', () => {
    const result = textSummary('');
    assert.equal(result.wordCount, 0);
    assert.equal(result.sentenceCount, 0);
    assert.equal(result.averageWordLength, 0);
    assert.equal(result.averageSentenceLength, 0);
    assert.equal(result.fleschReadingEase, 0);
    assert.equal(result.gradeLevel, 0);
  });

  it('averageSentenceLength is wordCount / sentenceCount', () => {
    const text = 'One two three. Four five.';
    const s = textSummary(text);
    assert.equal(s.averageSentenceLength, Math.round((s.wordCount / s.sentenceCount) * 10) / 10);
  });

  it('all numeric fields are numbers', () => {
    const result = textSummary('A simple sentence.');
    for (const [key, val] of Object.entries(result)) {
      assert.equal(typeof val, 'number', `${key} should be a number`);
    }
  });
});
