// @ts-check
// ─── Neural Network ───────────────────────────────────────────────────────────
// Simple feedforward neural network with configurable layers, activation
// functions, and gradient-descent training via backpropagation.

import {
  sigmoid,
  sigmoidDerivative,
  relu,
  reluDerivative,
  tanh_,
  tanhDerivative,
  mseLoss,
} from './activation-fns.js';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Supported activation function names. */
export type ActivationFn = 'sigmoid' | 'relu' | 'tanh' | 'linear';

/** Configuration for a single layer. */
export interface LayerConfig {
  /** Number of neurons in this layer. */
  neurons: number;
  /** Activation function applied to this layer's outputs. Default: 'sigmoid'. */
  activation?: ActivationFn;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Apply the named activation function element-wise to `xs`.
 */
function applyActivation(xs: number[], fn: ActivationFn): number[] {
  switch (fn) {
    case 'sigmoid':
      return xs.map(sigmoid);
    case 'relu':
      return xs.map(relu);
    case 'tanh':
      return xs.map(tanh_);
    case 'linear':
      return xs.slice();
    default: {
      // exhaustive check
      const _never: never = fn;
      void _never;
      return xs.slice();
    }
  }
}

/**
 * Apply the derivative of the named activation function element-wise to
 * the *pre-activation* values `zs`.
 */
function applyActivationDerivative(zs: number[], fn: ActivationFn): number[] {
  switch (fn) {
    case 'sigmoid':
      return zs.map(sigmoidDerivative);
    case 'relu':
      return zs.map(reluDerivative);
    case 'tanh':
      return zs.map(tanhDerivative);
    case 'linear':
      return zs.map(() => 1);
    default: {
      const _never: never = fn;
      void _never;
      return zs.map(() => 1);
    }
  }
}

/**
 * Xavier (Glorot) uniform initialisation: sample from U[−limit, limit]
 * where limit = sqrt(6 / (fanIn + fanOut)).
 */
function xavierWeight(fanIn: number, fanOut: number): number {
  const limit = Math.sqrt(6 / (fanIn + fanOut));
  return (Math.random() * 2 - 1) * limit;
}

/** Deep-copy a 3-D number array. */
function deepCopy3d(m: number[][][]): number[][][] {
  return m.map((layer) => layer.map((row) => row.slice()));
}

// ─── NeuralNetwork ────────────────────────────────────────────────────────────

/**
 * Feedforward neural network trained with gradient descent and MSE loss.
 *
 * `layers` must contain at least 2 entries: one input layer and one output
 * layer.  Hidden layers are anything in between.
 */
export class NeuralNetwork {
  /** Weight matrices: #weights[l][j][i] = weight from neuron i in layer l to neuron j in layer l+1. */
  #weights: number[][][];
  /** Bias vectors: #biases[l][j] = bias for neuron j in layer l+1. */
  #biases: number[][];
  /** Resolved activation function for each non-input layer. */
  #activations: ActivationFn[];
  #learningRate: number;

  constructor(layers: LayerConfig[], learningRate: number = 0.01) {
    if (layers.length < 2) {
      throw new Error('NeuralNetwork requires at least 2 layers (input + output).');
    }

    this.#learningRate = learningRate;
    this.#weights = [];
    this.#biases = [];
    this.#activations = [];

    for (let l = 1; l < layers.length; l++) {
      const fanIn = layers[l - 1].neurons;
      const fanOut = layers[l].neurons;
      const activation: ActivationFn = layers[l].activation ?? 'sigmoid';

      // Weight matrix: [fanOut][fanIn]
      const wMatrix: number[][] = [];
      for (let j = 0; j < fanOut; j++) {
        const row: number[] = [];
        for (let i = 0; i < fanIn; i++) {
          row.push(xavierWeight(fanIn, fanOut));
        }
        wMatrix.push(row);
      }

      // Bias vector: [fanOut], initialised to 0
      const bVector: number[] = new Array(fanOut).fill(0);

      this.#weights.push(wMatrix);
      this.#biases.push(bVector);
      this.#activations.push(activation);
    }
  }

  // ─── Accessors ──────────────────────────────────────────────────────────────

  /** Returns a deep copy of all weight matrices to avoid external mutation. */
  get weights(): number[][][] {
    return deepCopy3d(this.#weights);
  }

  get learningRate(): number {
    return this.#learningRate;
  }

  // ─── Forward pass ───────────────────────────────────────────────────────────

  /**
   * Run a forward pass and store intermediate pre-activation values (z) and
   * activations (a) for use by the backward pass.
   */
  #forwardFull(input: number[]): {
    zs: number[][];
    as: number[][];
  } {
    const zs: number[][] = [];
    const as: number[][] = [input.slice()]; // as[0] = input

    let current = input.slice();

    for (let l = 0; l < this.#weights.length; l++) {
      const wMatrix = this.#weights[l];
      const bVector = this.#biases[l];
      const fn = this.#activations[l];

      // z[j] = Σ_i w[j][i] * a_prev[i] + b[j]
      const z: number[] = wMatrix.map((row, j) => {
        let sum = bVector[j];
        for (let i = 0; i < row.length; i++) {
          sum += row[i] * current[i];
        }
        return sum;
      });

      const a = applyActivation(z, fn);
      zs.push(z);
      as.push(a);
      current = a;
    }

    return { zs, as };
  }

  /**
   * Public forward pass — returns only the output layer activations.
   */
  forward(input: number[]): number[] {
    const { as } = this.#forwardFull(input);
    return as[as.length - 1];
  }

  /** Alias for `forward`. */
  predict(input: number[]): number[] {
    return this.forward(input);
  }

  // ─── Training ───────────────────────────────────────────────────────────────

  /**
   * Perform one forward + backward pass (gradient descent step).
   * Returns the MSE loss on this sample.
   */
  train(input: number[], target: number[]): number {
    const { zs, as } = this.#forwardFull(input);
    const output = as[as.length - 1];
    const loss = mseLoss(output, target);

    // ── Backprop ────────────────────────────────────────────────────────────
    // deltas[l] = error signal for layer l+1 (0-indexed into #weights)
    const numLayers = this.#weights.length;
    const deltas: number[][] = new Array(numLayers);

    // Output layer delta: δ = (a - target) * f'(z)
    const outputZ = zs[numLayers - 1];
    const outputFn = this.#activations[numLayers - 1];
    const dAct = applyActivationDerivative(outputZ, outputFn);
    deltas[numLayers - 1] = output.map((a, j) => (a - target[j]) * dAct[j]);

    // Hidden layers (back-propagate deltas)
    for (let l = numLayers - 2; l >= 0; l--) {
      const wNext = this.#weights[l + 1]; // weight matrix of layer l+2
      const delta: number[] = [];
      const zCur = zs[l];
      const fn = this.#activations[l];
      const dActCur = applyActivationDerivative(zCur, fn);

      for (let i = 0; i < this.#weights[l].length; i++) {
        // Sum over neurons in next layer: Σ_j w_next[j][i] * δ_next[j]
        let err = 0;
        for (let j = 0; j < wNext.length; j++) {
          err += wNext[j][i] * deltas[l + 1][j];
        }
        delta.push(err * dActCur[i]);
      }
      deltas[l] = delta;
    }

    // ── Weight and bias update ──────────────────────────────────────────────
    for (let l = 0; l < numLayers; l++) {
      const aPrev = as[l]; // activations from the previous layer
      for (let j = 0; j < this.#weights[l].length; j++) {
        for (let i = 0; i < this.#weights[l][j].length; i++) {
          this.#weights[l][j][i] -= this.#learningRate * deltas[l][j] * aPrev[i];
        }
        this.#biases[l][j] -= this.#learningRate * deltas[l][j];
      }
    }

    return loss;
  }

  /**
   * Train over multiple epochs on a dataset.
   * Returns an array of average MSE loss values, one per epoch.
   */
  trainBatch(
    data: Array<{ input: number[]; target: number[] }>,
    epochs: number,
  ): number[] {
    const lossPerEpoch: number[] = [];

    for (let epoch = 0; epoch < epochs; epoch++) {
      let totalLoss = 0;
      for (const { input, target } of data) {
        totalLoss += this.train(input, target);
      }
      lossPerEpoch.push(data.length > 0 ? totalLoss / data.length : 0);
    }

    return lossPerEpoch;
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Convenience factory — creates a new `NeuralNetwork` with the given layers
 * and optional learning rate.
 */
export function createNeuralNetwork(
  layers: LayerConfig[],
  learningRate?: number,
): NeuralNetwork {
  return new NeuralNetwork(layers, learningRate);
}
