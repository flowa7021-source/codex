// ─── Unit Tests: Activation Functions ────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  sigmoid, sigmoidDerivative,
  relu, reluDerivative,
  tanh_, tanhDerivative,
  softmax,
  mseLoss, crossEntropyLoss, binaryCrossEntropy,
} from '../../app/modules/activation-fns.js';

describe('sigmoid', () => {
  it('sigmoid(0) = 0.5', () => assert.ok(Math.abs(sigmoid(0) - 0.5) < 1e-9));
  it('sigmoid is in (0, 1)', () => {
    assert.ok(sigmoid(10) < 1 && sigmoid(10) > 0);
    assert.ok(sigmoid(-10) < 1 && sigmoid(-10) > 0);
  });
  it('derivative at 0 = 0.25', () => assert.ok(Math.abs(sigmoidDerivative(0) - 0.25) < 1e-9));
});

describe('relu', () => {
  it('relu(x) = x for x > 0', () => assert.equal(relu(5), 5));
  it('relu(x) = 0 for x <= 0', () => {
    assert.equal(relu(0), 0);
    assert.equal(relu(-3), 0);
  });
  it('derivative is 1 for x > 0', () => assert.equal(reluDerivative(5), 1));
  it('derivative is 0 for x <= 0', () => assert.equal(reluDerivative(-1), 0));
});

describe('tanh_', () => {
  it('tanh_(0) = 0', () => assert.ok(Math.abs(tanh_(0)) < 1e-9));
  it('tanh_ is in (-1, 1)', () => {
    assert.ok(tanh_(10) > 0 && tanh_(10) < 1);
    assert.ok(tanh_(-10) > -1 && tanh_(-10) < 0);
  });
  it('derivative at 0 = 1', () => assert.ok(Math.abs(tanhDerivative(0) - 1) < 1e-9));
});

describe('softmax', () => {
  it('outputs sum to 1', () => {
    const out = softmax([1, 2, 3]);
    const sum = out.reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 1) < 1e-9);
  });
  it('all outputs are positive', () => {
    softmax([1, 2, 3]).forEach(v => assert.ok(v > 0));
  });
  it('largest input gets largest output', () => {
    const out = softmax([1, 5, 2]);
    assert.ok(out[1] === Math.max(...out));
  });
});

describe('mseLoss', () => {
  it('zero loss for perfect prediction', () => {
    assert.ok(Math.abs(mseLoss([1, 2, 3], [1, 2, 3])) < 1e-9);
  });
  it('positive loss for mismatch', () => {
    assert.ok(mseLoss([1, 0], [0, 1]) > 0);
  });
});

describe('crossEntropyLoss', () => {
  it('low loss for correct prediction', () => {
    const loss = crossEntropyLoss([0.99, 0.01], [1, 0]);
    assert.ok(loss < 0.1);
  });
  it('higher loss for wrong prediction', () => {
    const low = crossEntropyLoss([0.99, 0.01], [1, 0]);
    const high = crossEntropyLoss([0.01, 0.99], [1, 0]);
    assert.ok(high > low);
  });
});

describe('binaryCrossEntropy', () => {
  it('near 0 loss for correct prediction', () => {
    assert.ok(binaryCrossEntropy(0.99, 1) < 0.1);
  });
  it('high loss for wrong prediction', () => {
    assert.ok(binaryCrossEntropy(0.01, 1) > 1);
  });
});
