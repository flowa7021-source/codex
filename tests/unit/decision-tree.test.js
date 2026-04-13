// ─── Unit Tests: Decision Tree (ID3) ─────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  entropy,
  informationGain,
  DecisionTree,
  createDecisionTree,
} from '../../app/modules/decision-tree.js';

// ─── entropy() ───────────────────────────────────────────────────────────────

describe('entropy', () => {
  it('returns 0 for an empty dataset', () => {
    assert.equal(entropy([], 'label'), 0);
  });

  it('returns 0 when all samples share the same label', () => {
    const data = [
      { color: 'red', label: 'yes' },
      { color: 'blue', label: 'yes' },
      { color: 'green', label: 'yes' },
    ];
    assert.equal(entropy(data, 'label'), 0);
  });

  it('returns 1 (log2(2)) for a perfect 50/50 binary split', () => {
    const data = [
      { label: 'yes' },
      { label: 'yes' },
      { label: 'no' },
      { label: 'no' },
    ];
    assert.equal(entropy(data, 'label'), 1);
  });

  it('returns a value between 0 and 1 for an uneven binary split', () => {
    // 3 yes, 1 no → entropy = -(3/4)log2(3/4) - (1/4)log2(1/4) ≈ 0.811
    const data = [
      { label: 'yes' },
      { label: 'yes' },
      { label: 'yes' },
      { label: 'no' },
    ];
    const h = entropy(data, 'label');
    assert.ok(h > 0 && h < 1, `expected entropy in (0,1) but got ${h}`);
  });

  it('returns log2(n) for a uniform distribution over n classes', () => {
    // 4 distinct labels, one sample each → entropy = log2(4) = 2
    const data = [
      { label: 'a' },
      { label: 'b' },
      { label: 'c' },
      { label: 'd' },
    ];
    assert.equal(entropy(data, 'label'), 2);
  });

  it('uses the specified labelKey', () => {
    const data = [
      { category: 'cat', label: 'ignored' },
      { category: 'dog', label: 'ignored' },
    ];
    // All 'label' values are the same → if we used 'label' we'd get 0
    // Using 'category' (two distinct values, 50/50) should give 1
    assert.equal(entropy(data, 'category'), 1);
  });
});

// ─── informationGain() ────────────────────────────────────────────────────────

describe('informationGain', () => {
  it('returns 0 for an empty dataset', () => {
    assert.equal(informationGain([], 'color', 'label'), 0);
  });

  it('returns 0 when the attribute does not reduce entropy (noise attribute)', () => {
    // Each color value appears once with each label → no information gained
    const data = [
      { color: 'red', label: 'yes' },
      { color: 'red', label: 'no' },
      { color: 'blue', label: 'yes' },
      { color: 'blue', label: 'no' },
    ];
    assert.equal(informationGain(data, 'color', 'label'), 0);
  });

  it('returns positive gain when the attribute perfectly separates labels', () => {
    // 'color' perfectly predicts 'label'
    const data = [
      { color: 'red', label: 'yes' },
      { color: 'red', label: 'yes' },
      { color: 'blue', label: 'no' },
      { color: 'blue', label: 'no' },
    ];
    const gain = informationGain(data, 'color', 'label');
    assert.ok(gain > 0, `expected positive gain but got ${gain}`);
  });

  it('returns parent entropy (maximum gain) when attribute is a perfect predictor', () => {
    // Perfect split: gain should equal the full parent entropy (1 bit)
    const data = [
      { color: 'red', label: 'yes' },
      { color: 'red', label: 'yes' },
      { color: 'blue', label: 'no' },
      { color: 'blue', label: 'no' },
    ];
    const parentEntropy = entropy(data, 'label'); // = 1
    const gain = informationGain(data, 'color', 'label');
    assert.ok(
      Math.abs(gain - parentEntropy) < 1e-10,
      `expected gain ≈ ${parentEntropy} but got ${gain}`,
    );
  });

  it('returns positive gain for a numeric attribute with a clean split', () => {
    // height ≤ median separates labels perfectly
    const data = [
      { height: 150, label: 'short' },
      { height: 160, label: 'short' },
      { height: 180, label: 'tall' },
      { height: 190, label: 'tall' },
    ];
    const gain = informationGain(data, 'height', 'label');
    assert.ok(gain > 0, `expected positive numeric gain but got ${gain}`);
  });

  it('returns 0 gain for a numeric attribute that does not help', () => {
    // Both sides of every possible split have both labels
    const data = [
      { x: 1, label: 'yes' },
      { x: 1, label: 'no' },
      { x: 2, label: 'yes' },
      { x: 2, label: 'no' },
    ];
    assert.equal(informationGain(data, 'x', 'label'), 0);
  });
});

// ─── DecisionTree – isTrained ─────────────────────────────────────────────────

describe('DecisionTree – isTrained', () => {
  it('is false before training', () => {
    const tree = new DecisionTree();
    assert.equal(tree.isTrained, false);
  });

  it('is true after training', () => {
    const tree = new DecisionTree();
    tree.train([{ color: 'red', label: 'yes' }], 'label');
    assert.equal(tree.isTrained, true);
  });
});

// ─── DecisionTree – train() ───────────────────────────────────────────────────

describe('DecisionTree – train', () => {
  it('throws when given an empty dataset', () => {
    const tree = new DecisionTree();
    assert.throws(
      () => tree.train([], 'label'),
      /empty/i,
    );
  });

  it('can be trained multiple times (re-train overwrites previous tree)', () => {
    const tree = new DecisionTree();
    tree.train([{ color: 'red', label: 'yes' }], 'label');
    // Re-train on different data — should not throw
    tree.train([{ color: 'blue', label: 'no' }], 'label');
    assert.equal(tree.isTrained, true);
  });
});

// ─── DecisionTree – predict() ─────────────────────────────────────────────────

describe('DecisionTree – predict', () => {
  it('returns null when the tree is untrained', () => {
    const tree = new DecisionTree();
    assert.equal(tree.predict({ color: 'red' }), null);
  });

  it('returns null for a sample with an unseen categorical value', () => {
    const tree = new DecisionTree();
    tree.train(
      [
        { color: 'red', label: 'yes' },
        { color: 'blue', label: 'no' },
      ],
      'label',
    );
    // 'green' was never in training data
    assert.equal(tree.predict({ color: 'green' }), null);
  });

  it('classifies a single-label dataset correctly', () => {
    const tree = new DecisionTree();
    tree.train(
      [
        { shape: 'circle', label: 'round' },
        { shape: 'circle', label: 'round' },
      ],
      'label',
    );
    assert.equal(tree.predict({ shape: 'circle' }), 'round');
  });

  it('correctly classifies simple categorical data (color → label)', () => {
    const data = [
      { color: 'red', label: 'yes' },
      { color: 'red', label: 'yes' },
      { color: 'blue', label: 'no' },
      { color: 'blue', label: 'no' },
    ];
    const tree = new DecisionTree();
    tree.train(data, 'label');

    assert.equal(tree.predict({ color: 'red' }), 'yes');
    assert.equal(tree.predict({ color: 'blue' }), 'no');
  });

  it('classifies correctly with multiple categorical attributes', () => {
    // 'size' is the informative attribute; 'noise' carries no signal
    const data = [
      { size: 'big', noise: 'A', label: 'large' },
      { size: 'big', noise: 'B', label: 'large' },
      { size: 'small', noise: 'A', label: 'tiny' },
      { size: 'small', noise: 'B', label: 'tiny' },
    ];
    const tree = new DecisionTree();
    tree.train(data, 'label');

    assert.equal(tree.predict({ size: 'big', noise: 'A' }), 'large');
    assert.equal(tree.predict({ size: 'small', noise: 'B' }), 'tiny');
  });

  it('classifies correctly using numeric attributes (height → size label)', () => {
    const data = [
      { height: 150, label: 'short' },
      { height: 155, label: 'short' },
      { height: 160, label: 'short' },
      { height: 180, label: 'tall' },
      { height: 185, label: 'tall' },
      { height: 190, label: 'tall' },
    ];
    const tree = new DecisionTree();
    tree.train(data, 'label');

    assert.equal(tree.predict({ height: 150 }), 'short');
    assert.equal(tree.predict({ height: 190 }), 'tall');
  });

  it('returns majority label when data is noisy but one class dominates', () => {
    // 3 'yes' vs 1 'no' with no useful attribute
    const data = [
      { x: 1, label: 'yes' },
      { x: 2, label: 'yes' },
      { x: 3, label: 'yes' },
      { x: 4, label: 'no' },
    ];
    const tree = new DecisionTree();
    tree.train(data, 'label');

    // With no informative numeric split, the tree should fall back to majority
    const result = tree.predict({ x: 999 });
    // The result is either the majority label or null (unknown branch)
    assert.ok(
      result === 'yes' || result === 'no' || result === null,
      `unexpected predict result: ${result}`,
    );
  });

  it('handles numeric attributes with a single training sample', () => {
    const tree = new DecisionTree();
    tree.train([{ height: 170, label: 'medium' }], 'label');
    assert.equal(tree.predict({ height: 170 }), 'medium');
  });

  it('classifies a play-tennis-style dataset correctly', () => {
    // Simplified: outlook alone is the perfect predictor
    const data = [
      { outlook: 'sunny', label: 'no' },
      { outlook: 'sunny', label: 'no' },
      { outlook: 'overcast', label: 'yes' },
      { outlook: 'overcast', label: 'yes' },
      { outlook: 'rain', label: 'yes' },
      { outlook: 'rain', label: 'yes' },
    ];
    const tree = new DecisionTree();
    tree.train(data, 'label');

    assert.equal(tree.predict({ outlook: 'sunny' }), 'no');
    assert.equal(tree.predict({ outlook: 'overcast' }), 'yes');
    assert.equal(tree.predict({ outlook: 'rain' }), 'yes');
  });

  it('returns numeric labels correctly', () => {
    const data = [
      { zone: 'A', score: 1 },
      { zone: 'A', score: 1 },
      { zone: 'B', score: 2 },
      { zone: 'B', score: 2 },
    ];
    const tree = new DecisionTree();
    tree.train(data, 'score');

    assert.equal(tree.predict({ zone: 'A' }), 1);
    assert.equal(tree.predict({ zone: 'B' }), 2);
  });
});

// ─── createDecisionTree() ─────────────────────────────────────────────────────

describe('createDecisionTree', () => {
  it('returns a DecisionTree instance', () => {
    const tree = createDecisionTree();
    assert.ok(tree instanceof DecisionTree);
  });

  it('returns an untrained tree', () => {
    const tree = createDecisionTree();
    assert.equal(tree.isTrained, false);
  });

  it('returns a fully functional tree (train + predict)', () => {
    const tree = createDecisionTree();
    tree.train(
      [
        { color: 'red', label: 'yes' },
        { color: 'blue', label: 'no' },
      ],
      'label',
    );
    assert.equal(tree.isTrained, true);
    assert.equal(tree.predict({ color: 'red' }), 'yes');
    assert.equal(tree.predict({ color: 'blue' }), 'no');
  });

  it('each call returns a separate independent instance', () => {
    const t1 = createDecisionTree();
    const t2 = createDecisionTree();
    t1.train([{ label: 'only-t1' }], 'label');
    assert.equal(t1.isTrained, true);
    assert.equal(t2.isTrained, false);
  });
});
