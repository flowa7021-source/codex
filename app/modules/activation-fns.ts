// @ts-check
// ─── Activation Functions & Loss Functions ────────────────────────────────────
// Pure mathematical functions used in neural network forward and backward passes.

// ─── Sigmoid ──────────────────────────────────────────────────────────────────

/** Sigmoid activation: maps any real number to (0, 1). */
export function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/**
 * Derivative of sigmoid, expressed in terms of the sigmoid output.
 * Caller may pass the pre-activation value `x` or the already-computed
 * sigmoid value; both are equivalent because σ'(x) = σ(x)(1 − σ(x)).
 */
export function sigmoidDerivative(x: number): number {
  const s = sigmoid(x);
  return s * (1 - s);
}

// ─── ReLU ─────────────────────────────────────────────────────────────────────

/** Rectified Linear Unit: max(0, x). */
export function relu(x: number): number {
  return x > 0 ? x : 0;
}

/** Derivative of ReLU: 1 for x > 0, 0 otherwise. */
export function reluDerivative(x: number): number {
  return x > 0 ? 1 : 0;
}

// ─── Tanh ─────────────────────────────────────────────────────────────────────

/** Hyperbolic tangent activation: maps any real number to (−1, 1). */
export function tanh_(x: number): number {
  return Math.tanh(x);
}

/** Derivative of tanh: 1 − tanh²(x). */
export function tanhDerivative(x: number): number {
  const t = Math.tanh(x);
  return 1 - t * t;
}

// ─── Softmax ──────────────────────────────────────────────────────────────────

/**
 * Softmax over a vector of logits.
 * Subtracts the max for numerical stability.
 * Returns a probability distribution that sums to 1.
 */
export function softmax(xs: number[]): number[] {
  if (xs.length === 0) return [];
  const max = Math.max(...xs);
  const exps = xs.map((x) => Math.exp(x - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

// ─── Loss Functions ───────────────────────────────────────────────────────────

/**
 * Mean Squared Error loss.
 * MSE = (1/n) * Σ (predicted_i − target_i)²
 */
export function mseLoss(predicted: number[], target: number[]): number {
  if (predicted.length !== target.length) {
    throw new Error(
      `mseLoss: length mismatch (predicted=${predicted.length}, target=${target.length})`,
    );
  }
  if (predicted.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < predicted.length; i++) {
    const diff = predicted[i] - target[i];
    sum += diff * diff;
  }
  return sum / predicted.length;
}

/**
 * Categorical Cross-Entropy loss.
 * CE = −Σ target_i * log(predicted_i)
 * Predicted values are clipped to [1e-15, 1] to avoid log(0).
 */
export function crossEntropyLoss(predicted: number[], target: number[]): number {
  if (predicted.length !== target.length) {
    throw new Error(
      `crossEntropyLoss: length mismatch (predicted=${predicted.length}, target=${target.length})`,
    );
  }
  if (predicted.length === 0) return 0;
  const eps = 1e-15;
  let sum = 0;
  for (let i = 0; i < predicted.length; i++) {
    const clipped = Math.max(eps, Math.min(1, predicted[i]));
    sum += target[i] * Math.log(clipped);
  }
  return -sum;
}

/**
 * Binary Cross-Entropy loss for a single prediction.
 * BCE = −[target * log(predicted) + (1 − target) * log(1 − predicted)]
 * Predicted value is clipped to [1e-15, 1−1e-15] to avoid log(0).
 */
export function binaryCrossEntropy(predicted: number, target: number): number {
  const eps = 1e-15;
  const p = Math.max(eps, Math.min(1 - eps, predicted));
  return -(target * Math.log(p) + (1 - target) * Math.log(1 - p));
}
