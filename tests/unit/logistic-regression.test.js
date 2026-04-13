// ─── Unit Tests: LogisticRegression ──────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  sigmoid,
  LogisticRegression,
  createLogisticRegression,
} from '../../app/modules/logistic-regression.js';

// ─── sigmoid ─────────────────────────────────────────────────────────────────

describe('sigmoid', () => {
  it('sigmoid(0) equals 0.5', () => {
    assert.equal(sigmoid(0), 0.5);
  });

  it('sigmoid of a large positive number is approximately 1', () => {
    assert.ok(sigmoid(100) > 0.999, 'expected sigmoid(100) > 0.999');
  });

  it('sigmoid of a large negative number is approximately 0', () => {
    assert.ok(sigmoid(-100) < 0.001, 'expected sigmoid(-100) < 0.001');
  });

  it('output is always in (0, 1) for moderate inputs', () => {
    // Extreme values like ±50 saturate to 0 or 1 in floating point, so test
    // only moderate inputs where the strict open interval is preserved.
    for (const x of [-10, -1, 0, 1, 10]) {
      const s = sigmoid(x);
      assert.ok(s > 0 && s < 1, `expected sigmoid(${x}) in (0,1), got ${s}`);
    }
  });

  it('is monotonically increasing', () => {
    assert.ok(sigmoid(-1) < sigmoid(0));
    assert.ok(sigmoid(0) < sigmoid(1));
  });
});

// ─── LogisticRegression – construction & initial state ───────────────────────

describe('LogisticRegression – construction', () => {
  it('isTrained is false before fit', () => {
    const model = new LogisticRegression();
    assert.equal(model.isTrained, false);
  });

  it('uses default hyper-parameters when none are supplied', () => {
    const model = new LogisticRegression();
    assert.equal(model.learningRate, 0.1);
    assert.equal(model.maxIterations, 1000);
    assert.equal(model.tolerance, 1e-6);
  });

  it('accepts custom hyper-parameters', () => {
    const model = new LogisticRegression({
      learningRate: 0.01,
      maxIterations: 500,
      tolerance: 1e-4,
    });
    assert.equal(model.learningRate, 0.01);
    assert.equal(model.maxIterations, 500);
    assert.equal(model.tolerance, 1e-4);
  });

  it('weights array is empty before fit', () => {
    const model = new LogisticRegression();
    assert.equal(model.weights.length, 0);
  });
});

// ─── LogisticRegression – fit validation ─────────────────────────────────────

describe('LogisticRegression – fit validation', () => {
  it('throws when X is empty', () => {
    const model = new LogisticRegression();
    assert.throws(
      () => model.fit([], []),
      /empty/i,
    );
  });

  it('throws when label count does not match sample count', () => {
    const model = new LogisticRegression();
    assert.throws(
      () => model.fit([[1], [2]], [0]),
      /labels|samples/i,
    );
  });

  it('throws when feature counts are inconsistent across rows', () => {
    const model = new LogisticRegression();
    assert.throws(
      () => model.fit([[1, 2], [3]], [0, 1]),
      /features/i,
    );
  });
});

// ─── LogisticRegression – linearly separable classification ──────────────────

describe('LogisticRegression – binary classification', () => {
  // Prepare a simple 1-D linearly separable dataset.
  const X = [[1], [2], [3], [7], [8], [9]];
  const y = [0, 0, 0, 1, 1, 1];
  const model = new LogisticRegression({ learningRate: 0.1, maxIterations: 1000 });

  it('isTrained becomes true after fit', () => {
    model.fit(X, y);
    assert.equal(model.isTrained, true);
  });

  it('predict(1) returns 0 (class "low")', () => {
    assert.equal(model.predict([1]), 0);
  });

  it('predict(8) returns 1 (class "high")', () => {
    assert.equal(model.predict([8]), 1);
  });

  it('predict(2) returns 0', () => {
    assert.equal(model.predict([2]), 0);
  });

  it('predict(9) returns 1', () => {
    assert.equal(model.predict([9]), 1);
  });
});

// ─── LogisticRegression – predictProbability ─────────────────────────────────

describe('LogisticRegression – predictProbability', () => {
  it('always returns a value in [0, 1]', () => {
    const model = new LogisticRegression();
    model.fit([[1], [2], [8], [9]], [0, 0, 1, 1]);

    for (const x of [[0], [1], [5], [10], [100], [-100]]) {
      const p = model.predictProbability(x);
      assert.ok(p >= 0 && p <= 1, `predictProbability([${x}]) = ${p} out of [0,1]`);
    }
  });

  it('probability for class-1 samples is > 0.5 and class-0 samples < 0.5', () => {
    const model = new LogisticRegression();
    model.fit([[1], [2], [3], [7], [8], [9]], [0, 0, 0, 1, 1, 1]);

    assert.ok(model.predictProbability([1]) < 0.5);
    assert.ok(model.predictProbability([9]) > 0.5);
  });
});

// ─── LogisticRegression – predictAll ─────────────────────────────────────────

describe('LogisticRegression – predictAll', () => {
  it('output length matches input length', () => {
    const model = new LogisticRegression();
    model.fit([[1], [2], [8], [9]], [0, 0, 1, 1]);

    const input = [[1], [2], [3], [7], [8], [9]];
    const predictions = model.predictAll(input);
    assert.equal(predictions.length, input.length);
  });

  it('returns an array of 0s and 1s', () => {
    const model = new LogisticRegression();
    model.fit([[1], [9]], [0, 1]);

    const predictions = model.predictAll([[1], [5], [9]]);
    for (const p of predictions) {
      assert.ok(p === 0 || p === 1, `unexpected prediction value: ${p}`);
    }
  });

  it('produces the same results as calling predict individually', () => {
    const model = new LogisticRegression();
    model.fit([[1], [2], [8], [9]], [0, 0, 1, 1]);

    const X = [[1], [2], [8], [9]];
    const batch = model.predictAll(X);
    const individual = X.map(x => model.predict(x));
    assert.deepEqual(batch, individual);
  });
});

// ─── LogisticRegression – weights ────────────────────────────────────────────

describe('LogisticRegression – weights', () => {
  it('length equals n_features + 1 (bias)', () => {
    const model = new LogisticRegression();
    // 2 features
    model.fit([[1, 2], [3, 4], [7, 8], [9, 10]], [0, 0, 1, 1]);
    assert.equal(model.weights.length, 3); // bias + 2 features
  });

  it('length equals 2 for a single-feature dataset', () => {
    const model = new LogisticRegression();
    model.fit([[1], [2], [8], [9]], [0, 0, 1, 1]);
    assert.equal(model.weights.length, 2); // bias + 1 feature
  });

  it('weights are numeric and finite', () => {
    const model = new LogisticRegression();
    model.fit([[1], [9]], [0, 1]);
    for (const w of model.weights) {
      assert.ok(Number.isFinite(w), `weight ${w} is not finite`);
    }
  });
});

// ─── createLogisticRegression factory ────────────────────────────────────────

describe('createLogisticRegression', () => {
  it('returns a LogisticRegression instance', () => {
    const model = createLogisticRegression();
    assert.ok(model instanceof LogisticRegression);
  });

  it('forwards options to the instance', () => {
    const model = createLogisticRegression({ learningRate: 0.05, maxIterations: 200 });
    assert.equal(model.learningRate, 0.05);
    assert.equal(model.maxIterations, 200);
  });

  it('produces a working model', () => {
    const model = createLogisticRegression();
    model.fit([[1], [2], [8], [9]], [0, 0, 1, 1]);
    assert.equal(model.predict([1]), 0);
    assert.equal(model.predict([9]), 1);
  });

  it('works without arguments', () => {
    assert.doesNotThrow(() => createLogisticRegression());
  });
});
