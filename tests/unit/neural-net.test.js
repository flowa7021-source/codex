// ─── Unit Tests: Neural Network ───────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  sigmoid,
  relu,
  tanh,
  leakyRelu,
  NeuralNet,
  createNeuralNet,
} from '../../app/modules/neural-net.js';

// ─── Built-in Activation Functions ──────────────────────────────────────────

describe('sigmoid', () => {
  it('returns 0.5 at x = 0', () => {
    assert.ok(Math.abs(sigmoid(0) - 0.5) < 1e-10);
  });

  it('approaches 1 for large positive x', () => {
    assert.ok(sigmoid(100) > 0.999);
  });

  it('approaches 0 for large negative x', () => {
    assert.ok(sigmoid(-100) < 0.001);
  });

  it('output is in (0, 1) for arbitrary inputs', () => {
    for (const x of [-5, -1, 0, 1, 5]) {
      const y = sigmoid(x);
      assert.ok(y > 0 && y < 1, `sigmoid(${x}) = ${y} out of range`);
    }
  });
});

describe('relu', () => {
  it('returns 0 for negative values', () => {
    assert.equal(relu(-3), 0);
    assert.equal(relu(-0.001), 0);
  });

  it('returns 0 for x = 0', () => {
    assert.equal(relu(0), 0);
  });

  it('returns x for positive values', () => {
    assert.equal(relu(5), 5);
    assert.equal(relu(0.1), 0.1);
  });
});

describe('tanh', () => {
  it('returns 0 at x = 0', () => {
    assert.ok(Math.abs(tanh(0)) < 1e-10);
  });

  it('output is in (-1, 1)', () => {
    for (const x of [-10, -1, 0, 1, 10]) {
      const y = tanh(x);
      assert.ok(y > -1 && y < 1);
    }
  });

  it('is odd-symmetric: tanh(-x) = -tanh(x)', () => {
    assert.ok(Math.abs(tanh(-2) + tanh(2)) < 1e-10);
  });
});

describe('leakyRelu', () => {
  it('returns x for positive values', () => {
    assert.equal(leakyRelu(3), 3);
  });

  it('returns 0.01 * x for negative values', () => {
    assert.ok(Math.abs(leakyRelu(-4) - (-0.04)) < 1e-10);
  });

  it('returns 0 at x = 0', () => {
    assert.equal(leakyRelu(0), 0);
  });
});

// ─── NeuralNet Constructor ───────────────────────────────────────────────────

describe('NeuralNet constructor', () => {
  it('creates the correct number of layers', () => {
    const net = new NeuralNet([2, 3, 1]);
    assert.equal(net.layerCount, 2);
  });

  it('throws when fewer than 2 layer sizes are given', () => {
    assert.throws(() => new NeuralNet([3]), { name: 'RangeError' });
  });

  it('throws when activations length does not match layer transitions', () => {
    assert.throws(() => new NeuralNet([2, 4, 1], [sigmoid]), { name: 'RangeError' });
  });

  it('accepts custom activation functions', () => {
    const net = new NeuralNet([2, 2, 1], [relu, sigmoid]);
    assert.equal(net.layerCount, 2);
  });
});

// ─── NeuralNet Getters ───────────────────────────────────────────────────────

describe('NeuralNet getters', () => {
  it('layers getter returns array with correct length', () => {
    const net = new NeuralNet([3, 5, 2]);
    assert.equal(net.layers.length, 2);
  });

  it('layers getter returns a copy (mutation does not affect internal state)', () => {
    const net = new NeuralNet([2, 2]);
    const layers = net.layers;
    layers.pop();
    assert.equal(net.layerCount, 1);
  });

  it('weights getter returns correct shape', () => {
    const net = new NeuralNet([2, 3, 1]);
    const w = net.weights;
    assert.equal(w.length, 2);      // 2 layers
    assert.equal(w[0].length, 3);   // 3 outputs in layer 0
    assert.equal(w[0][0].length, 2); // 2 inputs in layer 0
    assert.equal(w[1].length, 1);   // 1 output in layer 1
    assert.equal(w[1][0].length, 3); // 3 inputs in layer 1
  });
});

// ─── NeuralNet forward / predict ────────────────────────────────────────────

describe('NeuralNet forward pass', () => {
  it('returns output vector of correct length', () => {
    const net = new NeuralNet([4, 3, 2]);
    const out = net.forward([1, 2, 3, 4]);
    assert.equal(out.length, 2);
  });

  it('predict is an alias for forward', () => {
    const net = new NeuralNet([2, 3, 1]);
    const input = [0.5, -0.5];
    assert.deepEqual(net.forward(input), net.predict(input));
  });

  it('single-layer network with identity-like activation', () => {
    // relu keeps positives intact
    const net = new NeuralNet([1, 1], [relu]);
    // Override weights to known values: weight = 1, bias = 0
    net.setWeights([[[1]]], [[0]]);
    const out = net.forward([5]);
    assert.ok(out[0] > 0); // relu(5) = 5 after linear combination
  });

  it('all-sigmoid network outputs values in (0, 1)', () => {
    const net = new NeuralNet([3, 4, 2], [sigmoid, sigmoid]);
    const out = net.forward([1, -1, 0.5]);
    for (const v of out) {
      assert.ok(v > 0 && v < 1, `output ${v} not in (0,1)`);
    }
  });

  it('deterministic: same input → same output', () => {
    const net = new NeuralNet([2, 4, 2]);
    const input = [0.3, 0.7];
    assert.deepEqual(net.forward(input), net.forward(input));
  });
});

// ─── NeuralNet setWeights ────────────────────────────────────────────────────

describe('NeuralNet setWeights', () => {
  it('changes output after weights are replaced', () => {
    const net = new NeuralNet([2, 1], [relu]);
    const before = net.forward([1, 1])[0];
    // Set weights to all-zeros: output should be relu(0) = 0
    net.setWeights([[[0, 0]]], [[0]]);
    const after = net.forward([1, 1])[0];
    assert.notEqual(before, after);
    assert.equal(after, 0);
  });

  it('throws when weights array length mismatches layer count', () => {
    const net = new NeuralNet([2, 2, 1]);
    assert.throws(() => net.setWeights([[[ 1, 1]]], [[0]]), { name: 'RangeError' });
  });

  it('known weights produce correct output', () => {
    // 2→1 net, relu, weight=[2, 3], bias=1 → relu(2*0.5 + 3*0.5 + 1) = relu(3.5) = 3.5
    const net = new NeuralNet([2, 1], [relu]);
    net.setWeights([[[2, 3]]], [[1]]);
    const out = net.forward([0.5, 0.5]);
    assert.ok(Math.abs(out[0] - 3.5) < 1e-9);
  });
});

// ─── createNeuralNet factory ─────────────────────────────────────────────────

describe('createNeuralNet', () => {
  it('creates a NeuralNet with the given sizes', () => {
    const net = createNeuralNet([4, 8, 4, 1]);
    assert.equal(net.layerCount, 3);
  });

  it('forward pass works on the factory-created net', () => {
    const net = createNeuralNet([2, 2]);
    const out = net.forward([1, 0]);
    assert.equal(out.length, 2);
  });
});
