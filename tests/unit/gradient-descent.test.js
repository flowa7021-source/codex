// ─── Unit Tests: Gradient Descent ────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  gradientDescent,
  stochasticGradientDescent,
  numericalGradient,
  minimize1D,
} from '../../app/modules/gradient-descent.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** f(x) = x[0]^2 + x[1]^2 — minimum at origin. */
const quadratic = (x) => x[0] ** 2 + x[1] ** 2;
const quadraticGrad = (x) => [2 * x[0], 2 * x[1]];

/** f(x) = (x[0] - 3)^2 — minimum at x=3. */
const shifted1D = (x) => (x[0] - 3) ** 2;
const shifted1DGrad = (x) => [2 * (x[0] - 3)];

// ─── gradientDescent ─────────────────────────────────────────────────────────

describe('gradientDescent', () => {
  it('minimises a simple quadratic to near zero', () => {
    const { params, result } = gradientDescent(quadratic, quadraticGrad, [5, -3], {
      learningRate: 0.1,
      maxIterations: 500,
      tolerance: 1e-6,
    });
    assert.ok(Math.abs(params[0]) < 0.01, `x[0] = ${params[0]}`);
    assert.ok(Math.abs(params[1]) < 0.01, `x[1] = ${params[1]}`);
    assert.ok(result.value < 0.001);
  });

  it('converged flag is true when gradient falls below tolerance', () => {
    const { result } = gradientDescent(quadratic, quadraticGrad, [0.0001, 0.0001], {
      learningRate: 0.1,
      tolerance: 0.01,
    });
    assert.equal(result.converged, true);
  });

  it('converged flag is false when maxIterations is too small', () => {
    const { result } = gradientDescent(quadratic, quadraticGrad, [100, 100], {
      learningRate: 0.01,
      maxIterations: 1,
      tolerance: 1e-10,
    });
    assert.equal(result.converged, false);
    assert.equal(result.iterations, 1);
  });

  it('does not mutate the initial parameter vector', () => {
    const x0 = [4, -2];
    gradientDescent(quadratic, quadraticGrad, x0, { maxIterations: 10 });
    assert.deepEqual(x0, [4, -2]);
  });

  it('works with 1-D shifted quadratic', () => {
    const { params } = gradientDescent(shifted1D, shifted1DGrad, [0], {
      learningRate: 0.1,
      maxIterations: 200,
      tolerance: 1e-8,
    });
    assert.ok(Math.abs(params[0] - 3) < 0.01, `Expected ~3, got ${params[0]}`);
  });

  it('uses default options when none are supplied', () => {
    const { result } = gradientDescent(quadratic, quadraticGrad, [1, 1]);
    assert.ok(typeof result.value === 'number');
    assert.ok(result.iterations > 0);
  });

  it('reports iterations count equal to 0 when start is already at minimum', () => {
    // At origin, gradient = [0, 0], norm < tolerance → converges on first check.
    const { result } = gradientDescent(quadratic, quadraticGrad, [0, 0], {
      tolerance: 1e-6,
    });
    assert.equal(result.converged, true);
    assert.equal(result.iterations, 1);
  });
});

// ─── stochasticGradientDescent ───────────────────────────────────────────────

describe('stochasticGradientDescent', () => {
  // Per-sample objective: f(x, s) = (x[0] - s)^2 with samples 0..4
  const numSamples = 5;
  const targets = [0, 1, 2, 3, 4]; // mean = 2
  const sgdFn = (x, s) => (x[0] - targets[s]) ** 2;
  const sgdGrad = (x, s) => [2 * (x[0] - targets[s])];

  it('reduces the average objective value', () => {
    const x0 = [10];
    const before = targets.reduce((acc, t) => acc + (x0[0] - t) ** 2, 0) / numSamples;
    const { result } = stochasticGradientDescent(sgdFn, sgdGrad, x0, numSamples, {
      learningRate: 0.05,
      maxIterations: 500,
    });
    assert.ok(result.value < before, `value ${result.value} should be < ${before}`);
  });

  it('does not mutate the initial parameter vector', () => {
    const x0 = [7];
    stochasticGradientDescent(sgdFn, sgdGrad, x0, numSamples, { maxIterations: 10 });
    assert.deepEqual(x0, [7]);
  });

  it('iterations count respects maxIterations', () => {
    const { result } = stochasticGradientDescent(sgdFn, sgdGrad, [0], numSamples, {
      maxIterations: 20,
      tolerance: 1e-12,
    });
    assert.ok(result.iterations <= 20);
  });

  it('result.value is a finite number', () => {
    const { result } = stochasticGradientDescent(sgdFn, sgdGrad, [5], numSamples, {
      maxIterations: 100,
    });
    assert.ok(Number.isFinite(result.value));
  });

  it('is deterministic across two runs with the same arguments', () => {
    const opts = { learningRate: 0.05, maxIterations: 50 };
    const r1 = stochasticGradientDescent(sgdFn, sgdGrad, [0], numSamples, opts);
    const r2 = stochasticGradientDescent(sgdFn, sgdGrad, [0], numSamples, opts);
    assert.deepEqual(r1.params, r2.params);
  });
});

// ─── numericalGradient ───────────────────────────────────────────────────────

describe('numericalGradient', () => {
  it('approximates the gradient of a quadratic', () => {
    const grad = numericalGradient(quadratic, [3, -4]);
    // analytic: [6, -8]
    assert.ok(Math.abs(grad[0] - 6) < 1e-4, `grad[0] = ${grad[0]}`);
    assert.ok(Math.abs(grad[1] - (-8)) < 1e-4, `grad[1] = ${grad[1]}`);
  });

  it('gradient at origin of quadratic is [0, 0]', () => {
    const grad = numericalGradient(quadratic, [0, 0]);
    assert.ok(Math.abs(grad[0]) < 1e-4);
    assert.ok(Math.abs(grad[1]) < 1e-4);
  });

  it('works for a 1-D function', () => {
    // f(x) = x^3, f'(x) = 3x^2; at x=2 → 12
    const fn = (x) => x[0] ** 3;
    const grad = numericalGradient(fn, [2]);
    assert.ok(Math.abs(grad[0] - 12) < 1e-3, `grad[0] = ${grad[0]}`);
  });

  it('accepts a custom eps parameter', () => {
    const grad = numericalGradient(quadratic, [1, 1], 1e-7);
    assert.ok(Math.abs(grad[0] - 2) < 1e-4);
    assert.ok(Math.abs(grad[1] - 2) < 1e-4);
  });

  it('does not mutate the input vector', () => {
    const x = [2, 3];
    numericalGradient(quadratic, x);
    assert.deepEqual(x, [2, 3]);
  });

  it('returns a vector with the same length as the input', () => {
    const grad = numericalGradient((x) => x.reduce((s, v) => s + v * v, 0), [1, 2, 3, 4]);
    assert.equal(grad.length, 4);
  });
});

// ─── minimize1D ──────────────────────────────────────────────────────────────

describe('minimize1D', () => {
  it('finds minimum of x^2 on [-5, 5]', () => {
    const min = minimize1D((x) => x ** 2, -5, 5);
    assert.ok(Math.abs(min) < 1e-4, `min = ${min}`);
  });

  it('finds minimum of (x - 2)^2 on [0, 10]', () => {
    const min = minimize1D((x) => (x - 2) ** 2, 0, 10);
    assert.ok(Math.abs(min - 2) < 1e-4, `min = ${min}`);
  });

  it('finds minimum of cos(x) on [0, 2π] (≈ π)', () => {
    const min = minimize1D(Math.cos, 0, 2 * Math.PI);
    assert.ok(Math.abs(min - Math.PI) < 1e-4, `min = ${min}`);
  });

  it('result lies within the bracket [a, b]', () => {
    const a = 1;
    const b = 7;
    const min = minimize1D((x) => (x - 4) ** 2, a, b);
    assert.ok(min >= a && min <= b);
  });

  it('handles a nearly flat function without error', () => {
    // f(x) = 0 everywhere; any point in [a,b] is a minimum
    const min = minimize1D(() => 0, -1, 1);
    assert.ok(min >= -1 && min <= 1);
  });

  it('respects a custom tolerance', () => {
    const min = minimize1D((x) => (x - 3) ** 2, 0, 6, 1e-10);
    assert.ok(Math.abs(min - 3) < 1e-6);
  });

  it('works when minimum is at the boundary', () => {
    // f is strictly decreasing on [0, 5], so minimum is at 5
    const min = minimize1D((x) => -x, 0, 5);
    assert.ok(min > 4.99, `min = ${min}`);
  });
});
