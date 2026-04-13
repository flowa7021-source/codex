// @ts-check
// ─── Gradient Descent Optimizers ─────────────────────────────────────────────
// Vanilla gradient descent, stochastic gradient descent, numerical gradient
// approximation, and 1-D golden-section minimisation.

// ─── Types ────────────────────────────────────────────────────────────────────

/** Options shared by all gradient-descent variants. */
export interface GradientDescentOptions {
  /** Step size multiplied by the gradient. Default: 0.01. */
  learningRate?: number;
  /** Maximum number of update steps. Default: 1000. */
  maxIterations?: number;
  /** Convergence threshold: stop when ‖gradient‖ < tolerance. Default: 1e-6. */
  tolerance?: number;
}

/** Summary returned alongside the optimised parameters. */
export interface OptimizationResult {
  /** Objective value at the returned parameters. */
  value: number;
  /** Number of iterations performed. */
  iterations: number;
  /** Whether the run converged within tolerance before hitting maxIterations. */
  converged: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Euclidean norm of a vector. */
function norm(v: number[]): number {
  let sum = 0;
  for (const x of v) sum += x * x;
  return Math.sqrt(sum);
}

/** Subtract `lr * grad[i]` from each element of `x` (in-place). */
function step(x: number[], grad: number[], lr: number): void {
  for (let i = 0; i < x.length; i++) {
    x[i] -= lr * grad[i];
  }
}

// ─── Vanilla Gradient Descent ─────────────────────────────────────────────────

/**
 * Batch gradient descent minimiser.
 *
 * @param fn       - Objective function f(x).
 * @param gradient - Analytic gradient ∇f(x).
 * @param x0       - Initial parameter vector (will not be mutated).
 * @param opts     - Optional hyperparameters.
 * @returns Final parameter vector and convergence metadata.
 */
export function gradientDescent(
  fn: (x: number[]) => number,
  gradient: (x: number[]) => number[],
  x0: number[],
  opts?: GradientDescentOptions,
): { params: number[]; result: OptimizationResult } {
  const lr = opts?.learningRate ?? 0.01;
  const maxIter = opts?.maxIterations ?? 1000;
  const tol = opts?.tolerance ?? 1e-6;

  const x = x0.slice();
  let iterations = 0;
  let converged = false;

  for (let i = 0; i < maxIter; i++) {
    const grad = gradient(x);
    iterations++;
    if (norm(grad) < tol) {
      converged = true;
      break;
    }
    step(x, grad, lr);
  }

  return {
    params: x,
    result: { value: fn(x), iterations, converged },
  };
}

// ─── Stochastic Gradient Descent ─────────────────────────────────────────────

/**
 * Stochastic gradient descent: each iteration picks one sample index uniformly
 * at random and updates parameters using only that sample's gradient.
 *
 * @param fn         - Per-sample objective f(x, sampleIndex).
 * @param gradient   - Per-sample gradient ∇f(x, sampleIndex).
 * @param x0         - Initial parameter vector (will not be mutated).
 * @param numSamples - Number of samples to draw from [0, numSamples).
 * @param opts       - Optional hyperparameters.
 */
export function stochasticGradientDescent(
  fn: (x: number[], sample: number) => number,
  gradient: (x: number[], sample: number) => number[],
  x0: number[],
  numSamples: number,
  opts?: GradientDescentOptions,
): { params: number[]; result: OptimizationResult } {
  const lr = opts?.learningRate ?? 0.01;
  const maxIter = opts?.maxIterations ?? 1000;
  const tol = opts?.tolerance ?? 1e-6;

  const x = x0.slice();
  let iterations = 0;
  let converged = false;

  // Simple LCG for deterministic reproducibility (seed = 42).
  let rngState = 42;
  const nextInt = (): number => {
    rngState = (rngState * 1664525 + 1013904223) & 0x7fffffff;
    return rngState;
  };

  for (let i = 0; i < maxIter; i++) {
    const sampleIdx = nextInt() % numSamples;
    const grad = gradient(x, sampleIdx);
    iterations++;
    if (norm(grad) < tol) {
      converged = true;
      break;
    }
    step(x, grad, lr);
  }

  // Use the average objective over all samples as the reported value.
  let totalValue = 0;
  for (let s = 0; s < numSamples; s++) {
    totalValue += fn(x, s);
  }

  return {
    params: x,
    result: { value: totalValue / numSamples, iterations, converged },
  };
}

// ─── Numerical Gradient ───────────────────────────────────────────────────────

/**
 * Approximate the gradient of `fn` at point `x` via central finite differences.
 *
 * @param fn  - Scalar-valued function.
 * @param x   - Point at which to evaluate the gradient.
 * @param eps - Finite-difference step size. Default: 1e-5.
 */
export function numericalGradient(
  fn: (x: number[]) => number,
  x: number[],
  eps: number = 1e-5,
): number[] {
  const grad: number[] = new Array(x.length);
  const xCopy = x.slice();
  for (let i = 0; i < x.length; i++) {
    const orig = xCopy[i];
    xCopy[i] = orig + eps;
    const fPlus = fn(xCopy);
    xCopy[i] = orig - eps;
    const fMinus = fn(xCopy);
    xCopy[i] = orig;
    grad[i] = (fPlus - fMinus) / (2 * eps);
  }
  return grad;
}

// ─── 1-D Golden-Section Search ────────────────────────────────────────────────

/** Golden ratio constant. */
const PHI = (Math.sqrt(5) - 1) / 2; // ≈ 0.618

/**
 * Find the minimum of a unimodal function on `[a, b]` using the golden-section
 * search algorithm.
 *
 * @param fn        - Unimodal scalar function.
 * @param a         - Left bracket.
 * @param b         - Right bracket.
 * @param tolerance - Convergence criterion on the bracket width. Default: 1e-6.
 * @returns The approximate minimiser x* ∈ [a, b].
 */
export function minimize1D(
  fn: (x: number) => number,
  a: number,
  b: number,
  tolerance: number = 1e-6,
): number {
  let lo = a;
  let hi = b;

  let c = hi - PHI * (hi - lo);
  let d = lo + PHI * (hi - lo);
  let fc = fn(c);
  let fd = fn(d);

  while (Math.abs(hi - lo) > tolerance) {
    if (fc < fd) {
      hi = d;
      d = c;
      fd = fc;
      c = hi - PHI * (hi - lo);
      fc = fn(c);
    } else {
      lo = c;
      c = d;
      fc = fd;
      d = lo + PHI * (hi - lo);
      fd = fn(d);
    }
  }

  return (lo + hi) / 2;
}
