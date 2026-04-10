// ─── Unit Tests: Activation Functions & Loss Functions ────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  sigmoid,
  sigmoidDerivative,
  relu,
  reluDerivative,
  tanh_,
  tanhDerivative,
  softmax,
  mseLoss,
  crossEntropyLoss,
  binaryCrossEntropy,
} from '../../app/modules/activation-fns.js';

// ─── sigmoid ──────────────────────────────────────────────────────────────────

describe('sigmoid', () => {
  it('sigmoid(0) === 0.5', () => {
    assert.ok(Math.abs(sigmoid(0) - 0.5) < 1e-10);
  });

  it('sigmoid(large positive) approaches 1', () => {
    assert.ok(sigmoid(100) > 0.999);
  });

  it('sigmoid(large negative) approaches 0', () => {
    assert.ok(sigmoid(-100) < 0.001);
  });

  it('output is always in (0, 1)', () => {
    for (const x of [-10, -1, 0, 1, 10]) {
      const s = sigmoid(x);
      assert.ok(s > 0 && s < 1, `sigmoid(${x}) = ${s} not in (0,1)`);
    }
  });

  it('is symmetric around 0: sigmoid(-x) = 1 - sigmoid(x)', () => {
    for (const x of [0.5, 1, 2, 5]) {
      assert.ok(Math.abs(sigmoid(-x) - (1 - sigmoid(x))) < 1e-10);
    }
  });
});

// ─── sigmoidDerivative ────────────────────────────────────────────────────────

describe('sigmoidDerivative', () => {
  it('sigmoidDerivative(0) === 0.25', () => {
    assert.ok(Math.abs(sigmoidDerivative(0) - 0.25) < 1e-10);
  });

  it('is always positive', () => {
    for (const x of [-5, -1, 0, 1, 5]) {
      assert.ok(sigmoidDerivative(x) > 0);
    }
  });

  it('approaches 0 for large |x|', () => {
    assert.ok(sigmoidDerivative(100) < 1e-5);
    assert.ok(sigmoidDerivative(-100) < 1e-5);
  });

  it('matches numerical formula σ(x)*(1-σ(x))', () => {
    for (const x of [-2, -0.5, 0, 0.5, 2]) {
      const s = sigmoid(x);
      const expected = s * (1 - s);
      assert.ok(Math.abs(sigmoidDerivative(x) - expected) < 1e-10);
    }
  });
});

// ─── relu ─────────────────────────────────────────────────────────────────────

describe('relu', () => {
  it('relu(0) === 0', () => {
    assert.equal(relu(0), 0);
  });

  it('relu(positive) returns the value unchanged', () => {
    assert.equal(relu(3.5), 3.5);
    assert.equal(relu(100), 100);
  });

  it('relu(negative) returns 0', () => {
    assert.equal(relu(-1), 0);
    assert.equal(relu(-100), 0);
  });

  it('relu is linear for positive inputs', () => {
    assert.ok(Math.abs(relu(7) - 7) < 1e-10);
  });
});

// ─── reluDerivative ──────────────────────────────────────────────────────────

describe('reluDerivative', () => {
  it('reluDerivative(positive) === 1', () => {
    assert.equal(reluDerivative(1), 1);
    assert.equal(reluDerivative(0.001), 1);
  });

  it('reluDerivative(0) === 0 (sub-gradient convention)', () => {
    assert.equal(reluDerivative(0), 0);
  });

  it('reluDerivative(negative) === 0', () => {
    assert.equal(reluDerivative(-1), 0);
    assert.equal(reluDerivative(-1000), 0);
  });
});

// ─── tanh_ ───────────────────────────────────────────────────────────────────

describe('tanh_', () => {
  it('tanh_(0) === 0', () => {
    assert.ok(Math.abs(tanh_(0)) < 1e-10);
  });

  it('output is in (-1, 1) for finite inputs', () => {
    for (const x of [-10, -1, 0, 1, 10]) {
      const t = tanh_(x);
      assert.ok(t > -1 && t < 1, `tanh_(${x}) = ${t} not in (-1,1)`);
    }
  });

  it('is anti-symmetric: tanh_(-x) === -tanh_(x)', () => {
    for (const x of [0.5, 1, 2]) {
      assert.ok(Math.abs(tanh_(-x) + tanh_(x)) < 1e-10);
    }
  });

  it('matches Math.tanh', () => {
    for (const x of [-3, -1, 0, 1, 3]) {
      assert.ok(Math.abs(tanh_(x) - Math.tanh(x)) < 1e-12);
    }
  });
});

// ─── tanhDerivative ──────────────────────────────────────────────────────────

describe('tanhDerivative', () => {
  it('tanhDerivative(0) === 1', () => {
    assert.ok(Math.abs(tanhDerivative(0) - 1) < 1e-10);
  });

  it('is always positive', () => {
    for (const x of [-5, -1, 0, 1, 5]) {
      assert.ok(tanhDerivative(x) > 0);
    }
  });

  it('approaches 0 for large |x|', () => {
    assert.ok(tanhDerivative(10) < 0.01);
    assert.ok(tanhDerivative(-10) < 0.01);
  });

  it('matches formula 1 - tanh²(x)', () => {
    for (const x of [-2, -0.5, 0, 0.5, 2]) {
      const t = Math.tanh(x);
      const expected = 1 - t * t;
      assert.ok(Math.abs(tanhDerivative(x) - expected) < 1e-10);
    }
  });
});

// ─── softmax ─────────────────────────────────────────────────────────────────

describe('softmax', () => {
  it('outputs sum to 1', () => {
    const result = softmax([1, 2, 3]);
    const sum = result.reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 1) < 1e-10);
  });

  it('all outputs are in (0, 1)', () => {
    for (const p of softmax([1, 2, 3])) {
      assert.ok(p > 0 && p < 1);
    }
  });

  it('largest logit gets highest probability', () => {
    const result = softmax([1, 5, 2]);
    const maxIdx = result.indexOf(Math.max(...result));
    assert.equal(maxIdx, 1);
  });

  it('returns empty array for empty input', () => {
    assert.deepEqual(softmax([]), []);
  });

  it('single element returns [1]', () => {
    const result = softmax([42]);
    assert.ok(Math.abs(result[0] - 1) < 1e-10);
  });

  it('is numerically stable for large values', () => {
    const result = softmax([1000, 1001, 1002]);
    const sum = result.reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 1) < 1e-10);
    for (const p of result) {
      assert.ok(Number.isFinite(p));
    }
  });

  it('uniform logits produce uniform probabilities', () => {
    const result = softmax([2, 2, 2]);
    for (const p of result) {
      assert.ok(Math.abs(p - 1 / 3) < 1e-10);
    }
  });
});

// ─── mseLoss ─────────────────────────────────────────────────────────────────

describe('mseLoss', () => {
  it('returns 0 for identical vectors', () => {
    assert.equal(mseLoss([1, 2, 3], [1, 2, 3]), 0);
  });

  it('computes correct MSE: ([0,1],[1,0]) → 1', () => {
    assert.ok(Math.abs(mseLoss([0, 1], [1, 0]) - 1) < 1e-10);
  });

  it('returns 0 for empty arrays', () => {
    assert.equal(mseLoss([], []), 0);
  });

  it('throws on length mismatch', () => {
    assert.throws(() => mseLoss([1, 2], [1]), /length/);
  });

  it('is always non-negative', () => {
    assert.ok(mseLoss([0.3, 0.7], [1, 0]) >= 0);
  });

  it('single-element: (3-1)²/1 = 4', () => {
    assert.ok(Math.abs(mseLoss([3], [1]) - 4) < 1e-10);
  });
});

// ─── crossEntropyLoss ─────────────────────────────────────────────────────────

describe('crossEntropyLoss', () => {
  it('perfect prediction has near-zero loss', () => {
    const loss = crossEntropyLoss([0.9999, 0.0001], [1, 0]);
    assert.ok(loss < 0.01);
  });

  it('worst prediction has large loss', () => {
    const loss = crossEntropyLoss([0.0001, 0.9999], [1, 0]);
    assert.ok(loss > 5);
  });

  it('returns 0 for empty arrays', () => {
    assert.equal(crossEntropyLoss([], []), 0);
  });

  it('throws on length mismatch', () => {
    assert.throws(() => crossEntropyLoss([0.5, 0.5], [1]), /length/);
  });

  it('is always non-negative', () => {
    const loss = crossEntropyLoss([0.3, 0.7], [1, 0]);
    assert.ok(loss >= 0);
  });

  it('clips predictions to avoid log(0) — result is finite', () => {
    assert.doesNotThrow(() => crossEntropyLoss([0, 1], [1, 0]));
    assert.ok(Number.isFinite(crossEntropyLoss([0, 1], [1, 0])));
  });
});

// ─── binaryCrossEntropy ───────────────────────────────────────────────────────

describe('binaryCrossEntropy', () => {
  it('perfect positive prediction has near-zero loss', () => {
    const loss = binaryCrossEntropy(0.9999, 1);
    assert.ok(loss < 0.01);
  });

  it('perfect negative prediction has near-zero loss', () => {
    const loss = binaryCrossEntropy(0.0001, 0);
    assert.ok(loss < 0.01);
  });

  it('wrong prediction has large loss', () => {
    assert.ok(binaryCrossEntropy(0.0001, 1) > 5);
    assert.ok(binaryCrossEntropy(0.9999, 0) > 5);
  });

  it('is symmetric: BCE(0.5,1) === BCE(0.5,0)', () => {
    assert.ok(Math.abs(binaryCrossEntropy(0.5, 1) - binaryCrossEntropy(0.5, 0)) < 1e-10);
  });

  it('is always non-negative', () => {
    for (const p of [0.1, 0.5, 0.9]) {
      assert.ok(binaryCrossEntropy(p, 1) >= 0);
      assert.ok(binaryCrossEntropy(p, 0) >= 0);
    }
  });

  it('clips predicted=0 and predicted=1 — results are finite', () => {
    assert.doesNotThrow(() => binaryCrossEntropy(0, 1));
    assert.doesNotThrow(() => binaryCrossEntropy(1, 0));
    assert.ok(Number.isFinite(binaryCrossEntropy(0, 1)));
    assert.ok(Number.isFinite(binaryCrossEntropy(1, 0)));
  });
});
