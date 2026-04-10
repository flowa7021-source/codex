// ─── Unit Tests: CubicSpline ──────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { CubicSpline, createCubicSpline } from '../../app/modules/cubic-spline.js';

describe('CubicSpline – construction errors', () => {
  it('throws RangeError for fewer than 2 points', () => {
    assert.throws(() => new CubicSpline([1], [1]), RangeError);
    assert.throws(() => new CubicSpline([], []), RangeError);
  });
  it('throws if xs and ys have different lengths', () => {
    assert.throws(() => new CubicSpline([0, 1], [0, 1, 2]), RangeError);
  });
  it('throws if xs not strictly increasing', () => {
    assert.throws(() => new CubicSpline([0, 0, 1], [0, 0, 1]), RangeError);
    assert.throws(() => new CubicSpline([0, 2, 1], [0, 2, 1]), RangeError);
  });
});

describe('CubicSpline – interpolation', () => {
  it('interpolates exactly at knot points', () => {
    const xs = [0, 1, 2, 3];
    const ys = [0, 1, 0, 1];
    const spline = new CubicSpline(xs, ys);
    for (let i = 0; i < xs.length; i++) {
      assert.ok(Math.abs(spline.evaluate(xs[i]) - ys[i]) < 1e-9, `knot ${i}`);
    }
  });

  it('linear data: y=x is interpolated exactly', () => {
    const spline = new CubicSpline([0, 1, 2, 3], [0, 1, 2, 3]);
    assert.ok(Math.abs(spline.evaluate(0.5) - 0.5) < 1e-9);
    assert.ok(Math.abs(spline.evaluate(1.5) - 1.5) < 1e-9);
  });

  it('two-point linear spline evaluates midpoint correctly', () => {
    const spline = new CubicSpline([0, 2], [0, 4]);
    assert.ok(Math.abs(spline.evaluate(1) - 2) < 1e-9);
  });

  it('evaluate returns a finite number for out-of-range x', () => {
    const spline = new CubicSpline([1, 2, 3], [1, 4, 9]);
    assert.ok(Number.isFinite(spline.evaluate(0)));
    assert.ok(Number.isFinite(spline.evaluate(4)));
  });

  it('xs and ys are accessible and match input', () => {
    const spline = new CubicSpline([0, 1, 2], [3, 5, 7]);
    assert.deepEqual([...spline.xs], [0, 1, 2]);
    assert.deepEqual([...spline.ys], [3, 5, 7]);
  });
});

describe('CubicSpline – evaluateAll', () => {
  it('returns correct length', () => {
    const spline = new CubicSpline([0, 1, 2], [0, 1, 4]);
    const results = spline.evaluateAll([0, 0.5, 1, 1.5, 2]);
    assert.equal(results.length, 5);
  });
  it('matches evaluate() for each value', () => {
    const spline = new CubicSpline([0, 1, 2, 3], [0, 1, 4, 9]);
    const points = [0, 0.5, 1, 1.5, 2, 2.5, 3];
    const batch = spline.evaluateAll(points);
    for (let i = 0; i < points.length; i++) {
      assert.ok(Math.abs(batch[i] - spline.evaluate(points[i])) < 1e-12);
    }
  });
});

describe('CubicSpline – derivative', () => {
  it('derivative is finite at all interior points', () => {
    const spline = new CubicSpline([0, 1, 2, 3], [0, 1, 4, 9]);
    for (let x = 0.5; x < 3; x += 0.5) {
      const d = spline.derivative(x);
      assert.ok(Number.isFinite(d), `derivative at ${x} should be finite`);
    }
  });
  it('derivative of linear spline ≈ slope', () => {
    const spline = new CubicSpline([0, 1, 2, 3], [0, 2, 4, 6]);
    assert.ok(Math.abs(spline.derivative(1) - 2) < 1e-9);
  });
});

describe('createCubicSpline factory', () => {
  it('returns a CubicSpline instance', () => {
    const spline = createCubicSpline([0, 1, 2], [0, 1, 4]);
    assert.ok(spline instanceof CubicSpline);
  });
});
