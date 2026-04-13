// ─── Unit Tests: TextClassifier ───────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { TextClassifier } from '../../app/modules/text-classifier.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build a small sentiment-like dataset (positive / negative). */
function sentimentData() {
  const texts = [
    'great movie amazing film',
    'wonderful performance loved it',
    'excellent fantastic brilliant',
    'superb enjoyable entertaining',
    'loved the actors great story',
    'terrible movie awful film',
    'horrible performance hated it',
    'dreadful boring disgusting',
    'worst film ever disappointing',
    'bad acting terrible screenplay',
  ];
  const labels = [
    'positive', 'positive', 'positive', 'positive', 'positive',
    'negative', 'negative', 'negative', 'negative', 'negative',
  ];
  return { texts, labels };
}

/** Build a simple topic dataset (sports / tech). */
function topicData() {
  const texts = [
    'football game match player goal',
    'basketball court scoring dunk',
    'tennis racket tournament serve',
    'soccer stadium fans team match',
    'baseball pitcher batting home run',
    'laptop processor memory hard drive',
    'software program code algorithm',
    'internet browser server network',
    'database query server table index',
    'keyboard mouse screen monitor',
  ];
  const labels = [
    'sports', 'sports', 'sports', 'sports', 'sports',
    'tech',   'tech',   'tech',   'tech',   'tech',
  ];
  return { texts, labels };
}

// ─── Constructor / getters ───────────────────────────────────────────────────

describe('TextClassifier – constructor and getters', () => {
  it('classes is empty before training', () => {
    const clf = new TextClassifier();
    assert.deepEqual(clf.classes, []);
  });

  it('vocabulary is empty before training', () => {
    const clf = new TextClassifier();
    assert.deepEqual(clf.vocabulary, []);
  });

  it('classes getter returns a copy (mutations do not affect internal state)', () => {
    const clf = new TextClassifier();
    const { texts, labels } = sentimentData();
    clf.train(texts, labels);
    const c = clf.classes;
    c.push('surprise');
    assert.equal(clf.classes.length, 2); // unchanged
  });

  it('vocabulary getter returns a copy', () => {
    const clf = new TextClassifier();
    const { texts, labels } = sentimentData();
    clf.train(texts, labels);
    const v = clf.vocabulary;
    const originalLen = v.length;
    v.push('bogus');
    assert.equal(clf.vocabulary.length, originalLen);
  });

  it('accepts custom alpha', () => {
    assert.doesNotThrow(() => new TextClassifier({ alpha: 0.5 }));
  });

  it('accepts removeStopWords: false', () => {
    assert.doesNotThrow(() => new TextClassifier({ removeStopWords: false }));
  });
});

// ─── train ───────────────────────────────────────────────────────────────────

describe('TextClassifier – train', () => {
  it('populates classes after training', () => {
    const clf = new TextClassifier();
    const { texts, labels } = sentimentData();
    clf.train(texts, labels);
    assert.equal(clf.classes.length, 2);
    assert.ok(clf.classes.includes('positive'));
    assert.ok(clf.classes.includes('negative'));
  });

  it('populates vocabulary after training', () => {
    const clf = new TextClassifier();
    const { texts, labels } = sentimentData();
    clf.train(texts, labels);
    assert.ok(clf.vocabulary.length > 0);
  });

  it('throws when texts and labels have different lengths', () => {
    const clf = new TextClassifier();
    assert.throws(() => clf.train(['hello'], []), { message: /same length/ });
  });

  it('handles a single training example', () => {
    const clf = new TextClassifier();
    clf.train(['hello world'], ['greeting']);
    assert.deepEqual(clf.classes, ['greeting']);
  });

  it('handles empty strings in training data gracefully', () => {
    const clf = new TextClassifier();
    assert.doesNotThrow(() => clf.train(['', 'hello', ''], ['a', 'b', 'a']));
  });
});

// ─── predict ─────────────────────────────────────────────────────────────────

describe('TextClassifier – predict', () => {
  it('predicts "positive" for clearly positive text', () => {
    const clf = new TextClassifier();
    const { texts, labels } = sentimentData();
    clf.train(texts, labels);
    const pred = clf.predict('amazing great wonderful movie');
    assert.equal(pred, 'positive');
  });

  it('predicts "negative" for clearly negative text', () => {
    const clf = new TextClassifier();
    const { texts, labels } = sentimentData();
    clf.train(texts, labels);
    const pred = clf.predict('terrible horrible awful film');
    assert.equal(pred, 'negative');
  });

  it('predicts a sports topic', () => {
    const clf = new TextClassifier();
    const { texts, labels } = topicData();
    clf.train(texts, labels);
    assert.equal(clf.predict('football goal player team'), 'sports');
  });

  it('predicts a tech topic', () => {
    const clf = new TextClassifier();
    const { texts, labels } = topicData();
    clf.train(texts, labels);
    assert.equal(clf.predict('laptop processor software code'), 'tech');
  });

  it('returns a class string for entirely unknown tokens', () => {
    const clf = new TextClassifier();
    clf.train(['hello world', 'foo bar'], ['a', 'b']);
    const pred = clf.predict('zzzzunknowntoken1234');
    assert.ok(clf.classes.includes(pred));
  });
});

// ─── predictProba ────────────────────────────────────────────────────────────

describe('TextClassifier – predictProba', () => {
  it('returns one entry per class', () => {
    const clf = new TextClassifier();
    const { texts, labels } = sentimentData();
    clf.train(texts, labels);
    const proba = clf.predictProba('great film');
    assert.ok('positive' in proba);
    assert.ok('negative' in proba);
  });

  it('probabilities sum to approximately 1', () => {
    const clf = new TextClassifier();
    const { texts, labels } = sentimentData();
    clf.train(texts, labels);
    const proba = clf.predictProba('amazing fantastic');
    const sum = Object.values(proba).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 1) < 1e-9, `Sum should be 1, got ${sum}`);
  });

  it('all probabilities are in [0, 1]', () => {
    const clf = new TextClassifier();
    const { texts, labels } = sentimentData();
    clf.train(texts, labels);
    const proba = clf.predictProba('some random text');
    for (const [cls, p] of Object.entries(proba)) {
      assert.ok(p >= 0 && p <= 1, `P(${cls}) = ${p} is out of [0,1]`);
    }
  });

  it('higher probability for correct class on clear examples', () => {
    const clf = new TextClassifier();
    const { texts, labels } = sentimentData();
    clf.train(texts, labels);
    const proba = clf.predictProba('great amazing wonderful');
    assert.ok(proba.positive > proba.negative, 'positive should dominate');
  });

  it('probabilities sum to 1 with 3-class dataset', () => {
    const clf = new TextClassifier();
    clf.train(
      ['red color paint', 'blue ocean sky', 'green grass leaf', 'red rose blood', 'blue river water', 'green forest tree'],
      ['red',             'blue',           'green',            'red',            'blue',              'green'],
    );
    const proba = clf.predictProba('color paint');
    const sum = Object.values(proba).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 1) < 1e-9);
  });
});

// ─── predictBatch ────────────────────────────────────────────────────────────

describe('TextClassifier – predictBatch', () => {
  it('returns same length as input', () => {
    const clf = new TextClassifier();
    const { texts, labels } = sentimentData();
    clf.train(texts, labels);
    const preds = clf.predictBatch(['good movie', 'bad film', 'amazing']);
    assert.equal(preds.length, 3);
  });

  it('each prediction is a known class', () => {
    const clf = new TextClassifier();
    const { texts, labels } = sentimentData();
    clf.train(texts, labels);
    const preds = clf.predictBatch(['great movie', 'terrible film']);
    for (const p of preds) {
      assert.ok(clf.classes.includes(p));
    }
  });

  it('returns empty array for empty input', () => {
    const clf = new TextClassifier();
    clf.train(['hello'], ['a']);
    assert.deepEqual(clf.predictBatch([]), []);
  });

  it('batch results match individual predict calls', () => {
    const clf = new TextClassifier();
    const { texts, labels } = topicData();
    clf.train(texts, labels);
    const testTexts = ['football goal score', 'processor memory disk'];
    const batch = clf.predictBatch(testTexts);
    for (let i = 0; i < testTexts.length; i++) {
      assert.equal(batch[i], clf.predict(testTexts[i]));
    }
  });
});

// ─── evaluate ────────────────────────────────────────────────────────────────

describe('TextClassifier – evaluate', () => {
  it('returns accuracy > 0.8 on the training data (clean dataset)', () => {
    const clf = new TextClassifier();
    const { texts, labels } = sentimentData();
    clf.train(texts, labels);
    const acc = clf.evaluate(texts, labels);
    assert.ok(acc > 0.8, `Expected accuracy > 0.8, got ${acc}`);
  });

  it('returns 1.0 when all predictions are correct', () => {
    const clf = new TextClassifier();
    clf.train(['hello world', 'foo bar baz'], ['a', 'b']);
    const acc = clf.evaluate(['hello world', 'foo bar baz'], ['a', 'b']);
    assert.equal(acc, 1.0);
  });

  it('returns 0 for empty test set', () => {
    const clf = new TextClassifier();
    clf.train(['hello'], ['a']);
    assert.equal(clf.evaluate([], []), 0);
  });

  it('accuracy is in [0, 1]', () => {
    const clf = new TextClassifier();
    const { texts, labels } = topicData();
    clf.train(texts, labels);
    const acc = clf.evaluate(texts, labels);
    assert.ok(acc >= 0 && acc <= 1);
  });

  it('topic classifier has accuracy > 0.8 on training data', () => {
    const clf = new TextClassifier();
    const { texts, labels } = topicData();
    clf.train(texts, labels);
    const acc = clf.evaluate(texts, labels);
    assert.ok(acc > 0.8, `Expected accuracy > 0.8, got ${acc}`);
  });
});

// ─── Edge cases and options ───────────────────────────────────────────────────

describe('TextClassifier – options and edge cases', () => {
  it('removeStopWords: false still trains and predicts', () => {
    const clf = new TextClassifier({ removeStopWords: false });
    const { texts, labels } = sentimentData();
    clf.train(texts, labels);
    const pred = clf.predict('this is a great movie');
    assert.ok(clf.classes.includes(pred));
  });

  it('alpha=0.01 produces a valid classifier', () => {
    const clf = new TextClassifier({ alpha: 0.01 });
    const { texts, labels } = sentimentData();
    clf.train(texts, labels);
    const proba = clf.predictProba('great movie');
    const sum = Object.values(proba).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 1) < 1e-9);
  });

  it('handles text with only stop words', () => {
    const clf = new TextClassifier();
    const { texts, labels } = sentimentData();
    clf.train(texts, labels);
    // "the and or" — all stop words — should still return a valid class
    const pred = clf.predict('the and or');
    assert.ok(clf.classes.includes(pred));
  });

  it('handles purely numeric text', () => {
    const clf = new TextClassifier();
    clf.train(['one two three', '100 200 300'], ['letters', 'numbers']);
    const pred = clf.predict('100 200');
    assert.ok(clf.classes.includes(pred));
  });
});
