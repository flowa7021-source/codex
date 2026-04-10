// ─── Unit Tests: NeuralNetwork ────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  NeuralNetwork,
  createNeuralNetwork,
} from '../../app/modules/neural-net.js';

// ─── Constructor ──────────────────────────────────────────────────────────────

describe('NeuralNetwork constructor', () => {
  it('creates a network without error for valid config', () => {
    assert.doesNotThrow(() => new NeuralNetwork([{ neurons: 2 }, { neurons: 1 }]));
  });

  it('throws when fewer than 2 layers are given', () => {
    assert.throws(() => new NeuralNetwork([{ neurons: 3 }]), /at least 2/);
  });

  it('uses default learning rate of 0.01', () => {
    const net = new NeuralNetwork([{ neurons: 2 }, { neurons: 1 }]);
    assert.equal(net.learningRate, 0.01);
  });

  it('accepts a custom learning rate', () => {
    const net = new NeuralNetwork([{ neurons: 2 }, { neurons: 1 }], 0.1);
    assert.equal(net.learningRate, 0.1);
  });

  it('supports all four activation functions', () => {
    for (const activation of ['sigmoid', 'relu', 'tanh', 'linear']) {
      assert.doesNotThrow(() =>
        new NeuralNetwork(
          [{ neurons: 2 }, { neurons: 2, activation }, { neurons: 1, activation }],
        ),
      );
    }
  });

  it('defaults activation to sigmoid when omitted', () => {
    const net = new NeuralNetwork([{ neurons: 2 }, { neurons: 1 }]);
    // Sigmoid keeps output in (0, 1) — verify forward pass reflects this.
    const out = net.forward([1, -1]);
    assert.ok(out[0] > 0 && out[0] < 1);
  });
});

// ─── weights getter ───────────────────────────────────────────────────────────

describe('NeuralNetwork weights getter', () => {
  it('returns correct shape for a 2→3→1 network', () => {
    const net = new NeuralNetwork([{ neurons: 2 }, { neurons: 3 }, { neurons: 1 }]);
    const w = net.weights;
    assert.equal(w.length, 2);       // 2 weight matrices
    assert.equal(w[0].length, 3);    // 3 rows (fanOut)
    assert.equal(w[0][0].length, 2); // 2 cols (fanIn)
    assert.equal(w[1].length, 1);    // 1 row
    assert.equal(w[1][0].length, 3); // 3 cols
  });

  it('returns a deep copy — external mutation does not affect the network', () => {
    const net = new NeuralNetwork([{ neurons: 2 }, { neurons: 1 }]);
    const wBefore = net.weights[0][0][0];
    const copy = net.weights;
    copy[0][0][0] = wBefore + 9999;
    assert.equal(net.weights[0][0][0], wBefore);
  });

  it('weights are finite numbers (Xavier initialisation)', () => {
    const net = new NeuralNetwork([{ neurons: 4 }, { neurons: 8 }, { neurons: 2 }]);
    for (const matrix of net.weights) {
      for (const row of matrix) {
        for (const w of row) {
          assert.ok(Number.isFinite(w), `weight ${w} is not finite`);
        }
      }
    }
  });
});

// ─── forward pass ─────────────────────────────────────────────────────────────

describe('NeuralNetwork forward', () => {
  it('returns output vector of correct length', () => {
    const net = new NeuralNetwork([{ neurons: 3 }, { neurons: 4 }, { neurons: 2 }]);
    const out = net.forward([1, 2, 3]);
    assert.equal(out.length, 2);
  });

  it('sigmoid activation keeps outputs in (0, 1)', () => {
    const net = new NeuralNetwork([
      { neurons: 3 },
      { neurons: 4, activation: 'sigmoid' },
      { neurons: 2, activation: 'sigmoid' },
    ]);
    const out = net.forward([1, -1, 0.5]);
    for (const v of out) {
      assert.ok(v > 0 && v < 1, `expected sigmoid output in (0,1), got ${v}`);
    }
  });

  it('relu activation keeps outputs non-negative', () => {
    const net = new NeuralNetwork([
      { neurons: 2 },
      { neurons: 3, activation: 'relu' },
      { neurons: 2, activation: 'relu' },
    ]);
    const out = net.forward([1, 1]);
    for (const v of out) {
      assert.ok(v >= 0, `expected relu output >= 0, got ${v}`);
    }
  });

  it('linear activation can produce negative outputs', () => {
    // With linear activations and Xavier weights, outputs can be negative.
    // Run multiple networks until we see a negative value.
    let sawNegative = false;
    for (let i = 0; i < 20; i++) {
      const net = new NeuralNetwork([
        { neurons: 2 },
        { neurons: 4, activation: 'linear' },
        { neurons: 1, activation: 'linear' },
      ]);
      if (net.forward([-5, -5])[0] < 0) {
        sawNegative = true;
        break;
      }
    }
    assert.ok(sawNegative, 'expected at least one linear net to produce a negative output');
  });

  it('is deterministic — same input returns same output', () => {
    const net = new NeuralNetwork([{ neurons: 2 }, { neurons: 4 }, { neurons: 1 }]);
    const input = [0.3, 0.7];
    assert.deepEqual(net.forward(input), net.forward(input));
  });

  it('predict is an alias for forward', () => {
    const net = new NeuralNetwork([{ neurons: 2 }, { neurons: 1 }]);
    const input = [0.5, -0.5];
    assert.deepEqual(net.forward(input), net.predict(input));
  });

  it('all output values are finite numbers', () => {
    const net = new NeuralNetwork([{ neurons: 4 }, { neurons: 8 }, { neurons: 3 }]);
    const out = net.forward([1, 2, -1, 0]);
    for (const v of out) {
      assert.ok(Number.isFinite(v), `output ${v} is not finite`);
    }
  });
});

// ─── train ────────────────────────────────────────────────────────────────────

describe('NeuralNetwork train', () => {
  it('returns a finite non-negative MSE loss', () => {
    const net = new NeuralNetwork([{ neurons: 2 }, { neurons: 1 }]);
    const loss = net.train([1, 0], [0.5]);
    assert.ok(Number.isFinite(loss));
    assert.ok(loss >= 0);
  });

  it('loss decreases over repeated training steps on a fixed example', () => {
    const net = new NeuralNetwork([{ neurons: 2 }, { neurons: 1 }], 0.5);
    const input = [1, 0];
    const target = [1];
    const firstLoss = net.train(input, target);
    let latestLoss = firstLoss;
    for (let i = 0; i < 100; i++) {
      latestLoss = net.train(input, target);
    }
    assert.ok(latestLoss < firstLoss, `loss did not decrease: ${firstLoss} → ${latestLoss}`);
  });

  it('weights change after a train step', () => {
    const net = new NeuralNetwork([{ neurons: 2 }, { neurons: 1 }], 0.1);
    const wBefore = net.weights[0][0][0];
    net.train([1, 1], [0]);
    const wAfter = net.weights[0][0][0];
    assert.notEqual(wBefore, wAfter);
  });

  it('returns 0 loss when output already equals target', () => {
    // With a sigmoid output layer it is impossible to reach exactly 0 or 1,
    // but we can still verify that a very small loss is ≥ 0.
    const net = new NeuralNetwork([{ neurons: 1 }, { neurons: 1, activation: 'linear' }], 0.1);
    // Train many steps toward target 0.5
    for (let i = 0; i < 500; i++) net.train([0], [0.5]);
    const loss = net.train([0], [0.5]);
    assert.ok(loss >= 0);
    assert.ok(loss < 0.01, `expected near-zero loss, got ${loss}`);
  });
});

// ─── trainBatch ───────────────────────────────────────────────────────────────

describe('NeuralNetwork trainBatch', () => {
  it('returns an array with one loss per epoch', () => {
    const net = new NeuralNetwork([{ neurons: 2 }, { neurons: 1 }]);
    const data = [{ input: [1, 0], target: [1] }];
    const losses = net.trainBatch(data, 5);
    assert.equal(losses.length, 5);
  });

  it('each loss value is a finite non-negative number', () => {
    const net = new NeuralNetwork([{ neurons: 2 }, { neurons: 1 }]);
    const data = [{ input: [1, 0], target: [0] }, { input: [0, 1], target: [1] }];
    const losses = net.trainBatch(data, 10);
    for (const l of losses) {
      assert.ok(Number.isFinite(l));
      assert.ok(l >= 0);
    }
  });

  it('loss generally decreases over epochs on a learnable dataset', () => {
    const net = new NeuralNetwork([{ neurons: 1 }, { neurons: 4, activation: 'sigmoid' }, { neurons: 1, activation: 'sigmoid' }], 0.5);
    const data = [{ input: [1], target: [1] }, { input: [0], target: [0] }];
    const losses = net.trainBatch(data, 200);
    assert.ok(losses[losses.length - 1] < losses[0], 'loss should decrease over 200 epochs');
  });

  it('returns empty array when epochs === 0', () => {
    const net = new NeuralNetwork([{ neurons: 2 }, { neurons: 1 }]);
    const losses = net.trainBatch([{ input: [1, 0], target: [1] }], 0);
    assert.deepEqual(losses, []);
  });

  it('handles empty data array gracefully', () => {
    const net = new NeuralNetwork([{ neurons: 2 }, { neurons: 1 }]);
    const losses = net.trainBatch([], 3);
    assert.equal(losses.length, 3);
    for (const l of losses) {
      assert.equal(l, 0);
    }
  });
});

// ─── predict ─────────────────────────────────────────────────────────────────

describe('NeuralNetwork predict (post-training)', () => {
  it('approaches target after many training epochs', () => {
    const net = new NeuralNetwork(
      [{ neurons: 1 }, { neurons: 8, activation: 'sigmoid' }, { neurons: 1, activation: 'sigmoid' }],
      0.5,
    );
    const data = [{ input: [1], target: [0.9] }];
    net.trainBatch(data, 500);
    const out = net.predict([1])[0];
    assert.ok(Math.abs(out - 0.9) < 0.1, `expected ~0.9, got ${out}`);
  });

  it('distinct inputs produce distinct outputs after training', () => {
    const net = new NeuralNetwork(
      [{ neurons: 1 }, { neurons: 4, activation: 'sigmoid' }, { neurons: 1, activation: 'sigmoid' }],
      0.3,
    );
    net.trainBatch([{ input: [0], target: [0] }, { input: [1], target: [1] }], 300);
    const out0 = net.predict([0])[0];
    const out1 = net.predict([1])[0];
    assert.ok(out1 > out0, `expected predict([1]) > predict([0]), got ${out1} vs ${out0}`);
  });
});

// ─── createNeuralNetwork factory ──────────────────────────────────────────────

describe('createNeuralNetwork factory', () => {
  it('returns a NeuralNetwork instance', () => {
    const net = createNeuralNetwork([{ neurons: 2 }, { neurons: 1 }]);
    assert.ok(net instanceof NeuralNetwork);
  });

  it('forward pass works on the factory-created network', () => {
    const net = createNeuralNetwork([{ neurons: 3 }, { neurons: 2 }]);
    const out = net.forward([1, 2, 3]);
    assert.equal(out.length, 2);
  });

  it('accepts an optional learning rate', () => {
    const net = createNeuralNetwork([{ neurons: 2 }, { neurons: 1 }], 0.05);
    assert.equal(net.learningRate, 0.05);
  });

  it('uses default learning rate when none provided', () => {
    const net = createNeuralNetwork([{ neurons: 2 }, { neurons: 1 }]);
    assert.equal(net.learningRate, 0.01);
  });

  it('created network can be trained', () => {
    const net = createNeuralNetwork([{ neurons: 2 }, { neurons: 1 }], 0.1);
    assert.doesNotThrow(() => net.train([0.5, 0.5], [1]));
  });
});
