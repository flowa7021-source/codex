// ─── Unit Tests: Naive Bayes Text Classifier ─────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { tokenize, NaiveBayes, createNaiveBayes } from '../../app/modules/naive-bayes.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Train a classifier with a standard sports / politics corpus. */
function trainedClassifier() {
  const nb = new NaiveBayes();
  nb.train('football game score', 'sports');
  nb.train('basketball player wins', 'sports');
  nb.train('president vote election', 'politics');
  nb.train('senate bill law', 'politics');
  return nb;
}

// ─── tokenize ─────────────────────────────────────────────────────────────────

describe('tokenize – edge cases', () => {
  it('returns an empty array for an empty string', () => {
    assert.deepEqual(tokenize(''), []);
  });

  it('returns an empty array for a whitespace-only string', () => {
    assert.deepEqual(tokenize('   \t\n  '), []);
  });
});

describe('tokenize – basic word splitting', () => {
  it('splits a simple sentence into words', () => {
    assert.deepEqual(tokenize('hello world'), ['hello', 'world']);
  });

  it('handles a single word', () => {
    assert.deepEqual(tokenize('word'), ['word']);
  });

  it('collapses multiple spaces between words', () => {
    assert.deepEqual(tokenize('foo   bar'), ['foo', 'bar']);
  });

  it('ignores leading and trailing whitespace', () => {
    assert.deepEqual(tokenize('  hello world  '), ['hello', 'world']);
  });
});

describe('tokenize – lowercasing', () => {
  it('lowercases uppercase letters', () => {
    assert.deepEqual(tokenize('Hello World'), ['hello', 'world']);
  });

  it('lowercases mixed-case input', () => {
    assert.deepEqual(tokenize('NaiveBayes TEXT'), ['naivebayes', 'text']);
  });
});

describe('tokenize – punctuation stripping', () => {
  it('strips punctuation from a word', () => {
    assert.deepEqual(tokenize('hello!'), ['hello']);
  });

  it('strips commas and periods', () => {
    assert.deepEqual(tokenize('cats, dogs. fish'), ['cats', 'dogs', 'fish']);
  });

  it('strips apostrophes', () => {
    assert.deepEqual(tokenize("it's fine"), ['its', 'fine']);
  });

  it('keeps alphanumeric characters intact', () => {
    assert.deepEqual(tokenize('a1b2 c3'), ['a1b2', 'c3']);
  });

  it('strips all punctuation, leaving only alphanumeric tokens', () => {
    assert.deepEqual(tokenize('Hello, World! How are you?'), [
      'hello',
      'world',
      'how',
      'are',
      'you',
    ]);
  });

  it('returns empty array for punctuation-only string', () => {
    assert.deepEqual(tokenize('!!! ???'), []);
  });
});

// ─── NaiveBayes – isTrained ───────────────────────────────────────────────────

describe('NaiveBayes – isTrained', () => {
  it('is false before any training', () => {
    const nb = new NaiveBayes();
    assert.equal(nb.isTrained, false);
  });

  it('becomes true after the first train call', () => {
    const nb = new NaiveBayes();
    nb.train('hello world', 'greetings');
    assert.equal(nb.isTrained, true);
  });

  it('remains true after multiple train calls', () => {
    const nb = trainedClassifier();
    assert.equal(nb.isTrained, true);
  });
});

// ─── NaiveBayes – classify (untrained guard) ──────────────────────────────────

describe('NaiveBayes – classify throws when untrained', () => {
  it('throws an Error if classify is called before training', () => {
    const nb = new NaiveBayes();
    assert.throws(
      () => nb.classify('anything'),
      (err) => err instanceof Error && /trained/i.test(err.message),
    );
  });
});

// ─── NaiveBayes – categories ──────────────────────────────────────────────────

describe('NaiveBayes – categories getter', () => {
  it('returns an empty array before training', () => {
    const nb = new NaiveBayes();
    assert.deepEqual(nb.categories, []);
  });

  it('returns a single category after training one category', () => {
    const nb = new NaiveBayes();
    nb.train('hello', 'greetings');
    assert.deepEqual(nb.categories, ['greetings']);
  });

  it('returns all trained categories', () => {
    const nb = trainedClassifier();
    assert.deepEqual(nb.categories, ['sports', 'politics']);
  });

  it('preserves insertion order', () => {
    const nb = new NaiveBayes();
    nb.train('alpha', 'first');
    nb.train('beta', 'second');
    nb.train('gamma', 'third');
    assert.deepEqual(nb.categories, ['first', 'second', 'third']);
  });

  it('does not duplicate a category trained multiple times', () => {
    const nb = new NaiveBayes();
    nb.train('doc one', 'sports');
    nb.train('doc two', 'sports');
    assert.deepEqual(nb.categories, ['sports']);
  });
});

// ─── NaiveBayes – train + classify ───────────────────────────────────────────

describe('NaiveBayes – classify after training', () => {
  it('classifies a clear sports phrase as sports', () => {
    const nb = trainedClassifier();
    assert.equal(nb.classify('game score'), 'sports');
  });

  it('classifies a clear politics phrase as politics', () => {
    const nb = trainedClassifier();
    assert.equal(nb.classify('vote election'), 'politics');
  });

  it('classifies a sports keyword correctly', () => {
    const nb = trainedClassifier();
    assert.equal(nb.classify('basketball'), 'sports');
  });

  it('classifies a politics keyword correctly', () => {
    const nb = trainedClassifier();
    assert.equal(nb.classify('senate'), 'politics');
  });

  it('classifies a document matching training text exactly', () => {
    const nb = trainedClassifier();
    assert.equal(nb.classify('football game score'), 'sports');
  });
});

// ─── NaiveBayes – probabilities ───────────────────────────────────────────────

describe('NaiveBayes – probabilities', () => {
  it('returns a Map with all trained categories as keys', () => {
    const nb = trainedClassifier();
    const probs = nb.probabilities('game');
    assert.ok(probs instanceof Map);
    assert.ok(probs.has('sports'));
    assert.ok(probs.has('politics'));
  });

  it('probabilities sum to approximately 1', () => {
    const nb = trainedClassifier();
    const probs = nb.probabilities('vote election game score');
    let total = 0;
    for (const p of probs.values()) total += p;
    assert.ok(Math.abs(total - 1) < 1e-9, `expected sum ≈ 1, got ${total}`);
  });

  it('probabilities sum to approximately 1 for a single-word query', () => {
    const nb = trainedClassifier();
    const probs = nb.probabilities('football');
    let total = 0;
    for (const p of probs.values()) total += p;
    assert.ok(Math.abs(total - 1) < 1e-9, `expected sum ≈ 1, got ${total}`);
  });

  it('each probability is in the [0, 1] range', () => {
    const nb = trainedClassifier();
    const probs = nb.probabilities('football election');
    for (const [cat, p] of probs) {
      assert.ok(p >= 0 && p <= 1, `${cat} probability ${p} out of [0,1]`);
    }
  });

  it('returns higher probability for the more relevant category', () => {
    const nb = trainedClassifier();
    const probs = nb.probabilities('game score');
    assert.ok(
      probs.get('sports') > probs.get('politics'),
      'sports probability should exceed politics for a sports query',
    );
  });

  it('probabilities sum to 1 for a three-category classifier', () => {
    const nb = new NaiveBayes();
    nb.train('cat kitten paw', 'cats');
    nb.train('dog puppy bark', 'dogs');
    nb.train('bird feather fly', 'birds');
    const probs = nb.probabilities('cat bird');
    let total = 0;
    for (const p of probs.values()) total += p;
    assert.ok(Math.abs(total - 1) < 1e-9, `expected sum ≈ 1, got ${total}`);
  });
});

// ─── NaiveBayes – out-of-vocabulary words ────────────────────────────────────

describe('NaiveBayes – out-of-vocabulary (OOV) words', () => {
  it('classifies without throwing when input has no known words', () => {
    const nb = trainedClassifier();
    // "zzz" was never seen during training; Laplace smoothing handles it
    assert.doesNotThrow(() => nb.classify('zzz'));
  });

  it('probabilities still sum to 1 for a fully OOV input', () => {
    const nb = trainedClassifier();
    const probs = nb.probabilities('zzz qqq xxx');
    let total = 0;
    for (const p of probs.values()) total += p;
    assert.ok(Math.abs(total - 1) < 1e-9, `expected sum ≈ 1, got ${total}`);
  });

  it('all categories are present in probabilities for OOV input', () => {
    const nb = trainedClassifier();
    const probs = nb.probabilities('unknownword');
    assert.equal(probs.size, 2);
    assert.ok(probs.has('sports'));
    assert.ok(probs.has('politics'));
  });

  it('mixed known and unknown words does not throw', () => {
    const nb = trainedClassifier();
    assert.doesNotThrow(() => nb.classify('football zzz'));
  });
});

// ─── createNaiveBayes factory ─────────────────────────────────────────────────

describe('createNaiveBayes – factory function', () => {
  it('returns a NaiveBayes instance', () => {
    const nb = createNaiveBayes();
    assert.ok(nb instanceof NaiveBayes);
  });

  it('returned instance starts untrained', () => {
    const nb = createNaiveBayes();
    assert.equal(nb.isTrained, false);
  });

  it('each call returns a distinct instance', () => {
    const nb1 = createNaiveBayes();
    const nb2 = createNaiveBayes();
    nb1.train('hello', 'a');
    assert.equal(nb2.isTrained, false);
  });

  it('returned instance is fully functional after training', () => {
    const nb = createNaiveBayes();
    nb.train('game score', 'sports');
    nb.train('vote election', 'politics');
    assert.equal(nb.classify('game'), 'sports');
    assert.equal(nb.classify('vote'), 'politics');
  });
});
