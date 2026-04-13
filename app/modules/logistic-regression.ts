// ─── Logistic Regression ─────────────────────────────────────────────────────
// @ts-check
// Binary logistic regression trained via gradient descent.

// ─── Activation ──────────────────────────────────────────────────────────────

/**
 * Standard sigmoid (logistic) function: 1 / (1 + e^(-x)).
 * Maps any real number to (0, 1).
 *
 * @param x - Input value
 */
export function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

// ─── Classifier ──────────────────────────────────────────────────────────────

/** Options accepted by {@link LogisticRegression}. */
export interface LogisticRegressionOptions {
  /** Gradient-descent step size (default: 0.1). */
  learningRate?: number;
  /** Maximum number of gradient-descent iterations (default: 1000). */
  maxIterations?: number;
  /** Convergence threshold on weight change L2 norm (default: 1e-6). */
  tolerance?: number;
}

/**
 * Binary logistic-regression classifier using batch gradient descent.
 *
 * Weights are stored as `[bias, w1, w2, …, wN]`.  The model is usable only
 * after {@link fit} has been called successfully.
 *
 * @example
 *   const model = new LogisticRegression({ learningRate: 0.1 });
 *   model.fit([[1], [2], [8], [9]], [0, 0, 1, 1]);
 *   console.log(model.predict([1])); // 0
 *   console.log(model.predict([9])); // 1
 */
export class LogisticRegression {
  /** Gradient-descent step size. */
  learningRate: number;
  /** Maximum number of gradient-descent iterations. */
  maxIterations: number;
  /** Convergence threshold on weight change L2 norm. */
  tolerance: number;

  /** Internal weight vector: [bias, w1, …, wN]. */
  #weights: number[] = [];
  /** True once {@link fit} has completed successfully. */
  #isTrained = false;

  /**
   * Create a new logistic-regression model.
   *
   * @param options - Optional hyper-parameters.
   */
  constructor(options: LogisticRegressionOptions = {}) {
    this.learningRate = options.learningRate ?? 0.1;
    this.maxIterations = options.maxIterations ?? 1000;
    this.tolerance = options.tolerance ?? 1e-6;
  }

  // ─── Training ───────────────────────────────────────────────────────────────

  /**
   * Train the model using batch gradient descent.
   *
   * @param X - Feature matrix, shape [n_samples, n_features].
   * @param y - Binary labels (0 or 1), length n_samples.
   * @throws {Error} When X is empty or label count does not match sample count.
   */
  fit(X: number[][], y: number[]): void {
    if (X.length === 0) {
      throw new Error('LogisticRegression.fit: X must not be empty.');
    }
    if (X.length !== y.length) {
      throw new Error(
        `LogisticRegression.fit: X has ${X.length} samples but y has ${y.length} labels.`,
      );
    }

    const nSamples = X.length;
    const nFeatures = X[0].length;

    // Verify that every row has the same feature count.
    for (let i = 1; i < nSamples; i++) {
      if (X[i].length !== nFeatures) {
        throw new Error(
          `LogisticRegression.fit: row ${i} has ${X[i].length} features, expected ${nFeatures}.`,
        );
      }
    }

    // Initialise weights (bias + one per feature) to zero.
    const weights = new Array<number>(nFeatures + 1).fill(0);

    for (let iter = 0; iter < this.maxIterations; iter++) {
      // Compute gradients: dL/dw = sum_i (y_hat_i - y_i) * x_i
      const gradients = new Array<number>(nFeatures + 1).fill(0);

      for (let i = 0; i < nSamples; i++) {
        const linearComb = this.#linearCombination(weights, X[i]);
        const error = sigmoid(linearComb) - y[i];
        // Bias gradient.
        gradients[0] += error;
        // Feature gradients.
        for (let j = 0; j < nFeatures; j++) {
          gradients[j + 1] += error * X[i][j];
        }
      }

      // Update weights and track the L2 norm of the update.
      let delta = 0;
      for (let k = 0; k <= nFeatures; k++) {
        const step = (this.learningRate * gradients[k]) / nSamples;
        weights[k] -= step;
        delta += step * step;
      }

      // Convergence check.
      if (Math.sqrt(delta) < this.tolerance) {
        break;
      }
    }

    this.#weights = weights;
    this.#isTrained = true;
  }

  // ─── Inference ──────────────────────────────────────────────────────────────

  /**
   * Return the predicted probability (in [0, 1]) that `x` belongs to class 1.
   *
   * @param x - Feature vector, length n_features.
   */
  predictProbability(x: number[]): number {
    return sigmoid(this.#linearCombination(this.#weights, x));
  }

  /**
   * Predict the class label (0 or 1) for a single sample.
   * Uses a threshold of 0.5 on the predicted probability.
   *
   * @param x - Feature vector, length n_features.
   */
  predict(x: number[]): number {
    return this.predictProbability(x) >= 0.5 ? 1 : 0;
  }

  /**
   * Predict class labels for every row in X.
   *
   * @param X - Feature matrix, shape [n_samples, n_features].
   */
  predictAll(X: number[][]): number[] {
    return X.map(x => this.predict(x));
  }

  // ─── Accessors ──────────────────────────────────────────────────────────────

  /** Trained weight vector as `[bias, w1, …, wN]` (read-only view). */
  get weights(): readonly number[] {
    return this.#weights;
  }

  /** True once the model has been successfully trained via {@link fit}. */
  get isTrained(): boolean {
    return this.#isTrained;
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  /**
   * Compute `bias + w1*x1 + … + wN*xN`.
   *
   * @param weights - Weight vector [bias, w1, …, wN].
   * @param x       - Feature vector [x1, …, xN].
   */
  #linearCombination(weights: number[], x: number[]): number {
    let sum = weights[0]; // bias
    for (let j = 0; j < x.length; j++) {
      sum += weights[j + 1] * x[j];
    }
    return sum;
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * Convenience factory for {@link LogisticRegression}.
 *
 * @param options - Optional hyper-parameters.
 */
export function createLogisticRegression(
  options?: LogisticRegressionOptions,
): LogisticRegression {
  return new LogisticRegression(options);
}
