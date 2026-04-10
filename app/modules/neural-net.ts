// @ts-check
// ─── Neural Network ──────────────────────────────────────────────────────────
// Simple feedforward neural network with configurable layer sizes and
// activation functions.

// ─── Types ────────────────────────────────────────────────────────────────────

/** A function that applies a non-linearity element-wise to a scalar value. */
export type ActivationFn = (x: number) => number;

/** A single fully-connected layer with weights, biases, and an activation. */
export interface Layer {
  weights: number[][];
  biases: number[];
  activation: ActivationFn;
}

// ─── Built-in Activation Functions ───────────────────────────────────────────

/** Logistic sigmoid: 1 / (1 + e^−x) → range (0, 1). */
export function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/** Rectified linear unit: max(0, x). */
export function relu(x: number): number {
  return x > 0 ? x : 0;
}

/** Hyperbolic tangent: range (−1, 1). */
export function tanh(x: number): number {
  return Math.tanh(x);
}

/** Leaky ReLU: x if x > 0, else 0.01 * x. */
export function leakyRelu(x: number): number {
  return x > 0 ? x : 0.01 * x;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Pseudo-random initialiser: small weights in (−0.5, 0.5). */
function initWeight(seed: number): number {
  // Deterministic but varied enough for basic use.
  const x = Math.sin(seed) * 10000;
  return (x - Math.floor(x)) - 0.5;
}

/** Build a weight matrix of shape [outputs][inputs] with small random values. */
function makeWeightMatrix(inputs: number, outputs: number, offset: number): number[][] {
  const matrix: number[][] = [];
  for (let o = 0; o < outputs; o++) {
    const row: number[] = [];
    for (let i = 0; i < inputs; i++) {
      row.push(initWeight(offset + o * inputs + i));
    }
    matrix.push(row);
  }
  return matrix;
}

/** Compute the dot product of a weight row with an input vector and add bias. */
function linearCombination(weights: number[], biases_val: number, input: number[]): number {
  let sum = biases_val;
  for (let i = 0; i < weights.length; i++) {
    sum += weights[i] * input[i];
  }
  return sum;
}

// ─── NeuralNet ────────────────────────────────────────────────────────────────

/**
 * Feedforward (multi-layer perceptron) neural network.
 *
 * @example
 * const net = new NeuralNet([2, 4, 1], [relu, sigmoid]);
 * const output = net.forward([0.5, -0.3]);
 */
export class NeuralNet {
  readonly #layers: Layer[];

  /**
   * Construct a neural network.
   * @param layerSizes - Sizes of each layer including input. E.g. [2, 4, 1]
   *   means 2 inputs, one hidden layer of 4, and 1 output.
   * @param activations - Activation function per layer transition (length must
   *   equal `layerSizes.length - 1`). Defaults to sigmoid for every layer.
   */
  constructor(layerSizes: number[], activations?: ActivationFn[]) {
    if (layerSizes.length < 2) {
      throw new RangeError('NeuralNet requires at least 2 layer sizes (input + output).');
    }

    const numLayers = layerSizes.length - 1;
    const acts = activations ?? Array.from({ length: numLayers }, () => sigmoid);

    if (acts.length !== numLayers) {
      throw new RangeError(
        `activations.length (${acts.length}) must equal layerSizes.length - 1 (${numLayers}).`,
      );
    }

    this.#layers = [];
    let weightOffset = 0;
    for (let l = 0; l < numLayers; l++) {
      const inputs = layerSizes[l];
      const outputs = layerSizes[l + 1];
      const weights = makeWeightMatrix(inputs, outputs, weightOffset);
      const biases: number[] = Array.from({ length: outputs }, (_, i) =>
        initWeight(weightOffset + outputs * inputs + i),
      );
      this.#layers.push({ weights, biases, activation: acts[l] });
      weightOffset += outputs * inputs + outputs;
    }
  }

  // ─── Getters ──────────────────────────────────────────────────────────────

  /** Read-only array of all layers. */
  get layers(): Layer[] {
    return this.#layers.slice();
  }

  /** Number of weight layers (= number of layer size transitions). */
  get layerCount(): number {
    return this.#layers.length;
  }

  /** All weight matrices in order. */
  get weights(): number[][][] {
    return this.#layers.map((l) => l.weights.map((row) => row.slice()));
  }

  // ─── Core Operations ──────────────────────────────────────────────────────

  /**
   * Run a forward pass through the network.
   * @param input - Input vector; length must match first layer size.
   * @returns Output vector of the final layer.
   */
  forward(input: number[]): number[] {
    let activation: number[] = input;
    for (const layer of this.#layers) {
      const next: number[] = [];
      for (let o = 0; o < layer.weights.length; o++) {
        const z = linearCombination(layer.weights[o], layer.biases[o], activation);
        next.push(layer.activation(z));
      }
      activation = next;
    }
    return activation;
  }

  /** Alias for `forward`. */
  predict(input: number[]): number[] {
    return this.forward(input);
  }

  /**
   * Replace all weights and biases in the network.
   * @param weights - Outer array indexed by layer, inner arrays are [outputs][inputs].
   * @param biases  - Outer array indexed by layer, inner arrays are [outputs].
   */
  setWeights(weights: number[][][], biases: number[][]): void {
    if (weights.length !== this.#layers.length || biases.length !== this.#layers.length) {
      throw new RangeError('weights and biases must have the same length as the number of layers.');
    }
    for (let l = 0; l < this.#layers.length; l++) {
      const layer = this.#layers[l];
      if (weights[l].length !== layer.weights.length) {
        throw new RangeError(`Layer ${l}: weights row count mismatch.`);
      }
      layer.weights = weights[l].map((row) => row.slice());
      layer.biases = biases[l].slice();
    }
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Create a feedforward neural network with sigmoid activations.
 * @param sizes - Layer sizes including input and output.
 */
export function createNeuralNet(sizes: number[]): NeuralNet {
  return new NeuralNet(sizes);
}
