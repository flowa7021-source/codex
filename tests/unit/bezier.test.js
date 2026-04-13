// ─── Unit Tests: Bezier Curves ───────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  lerp, lerpPoint, quadratic, cubic, BezierCurve, createBezier,
} from '../../app/modules/bezier.js';

describe('lerp', () => {
  it('t=0 → a', () => { assert.equal(lerp(3, 7, 0), 3); });
  it('t=1 → b', () => { assert.equal(lerp(3, 7, 1), 7); });
  it('t=0.5 → midpoint', () => { assert.equal(lerp(0, 10, 0.5), 5); });
});

describe('lerpPoint', () => {
  it('t=0 → first point', () => {
    const p = lerpPoint({ x: 0, y: 0 }, { x: 10, y: 20 }, 0);
    assert.equal(p.x, 0); assert.equal(p.y, 0);
  });
  it('t=1 → second point', () => {
    const p = lerpPoint({ x: 0, y: 0 }, { x: 10, y: 20 }, 1);
    assert.equal(p.x, 10); assert.equal(p.y, 20);
  });
  it('t=0.5 → midpoint', () => {
    const p = lerpPoint({ x: 0, y: 0 }, { x: 4, y: 8 }, 0.5);
    assert.equal(p.x, 2); assert.equal(p.y, 4);
  });
});

describe('quadratic Bezier', () => {
  const p0 = { x: 0, y: 0 }, p1 = { x: 5, y: 10 }, p2 = { x: 10, y: 0 };
  it('t=0 → p0', () => {
    const p = quadratic(p0, p1, p2, 0);
    assert.ok(Math.abs(p.x) < 1e-10); assert.ok(Math.abs(p.y) < 1e-10);
  });
  it('t=1 → p2', () => {
    const p = quadratic(p0, p1, p2, 1);
    assert.ok(Math.abs(p.x - 10) < 1e-10); assert.ok(Math.abs(p.y) < 1e-10);
  });
  it('t=0.5 → elevated y', () => {
    const p = quadratic(p0, p1, p2, 0.5);
    assert.ok(p.y > 0); assert.ok(Math.abs(p.x - 5) < 1e-10);
  });
});

describe('cubic Bezier', () => {
  const p0 = { x: 0, y: 0 }, p1 = { x: 1, y: 3 }, p2 = { x: 3, y: 3 }, p3 = { x: 4, y: 0 };
  it('t=0 → p0', () => {
    const p = cubic(p0, p1, p2, p3, 0);
    assert.ok(Math.abs(p.x) < 1e-10); assert.ok(Math.abs(p.y) < 1e-10);
  });
  it('t=1 → p3', () => {
    const p = cubic(p0, p1, p2, p3, 1);
    assert.ok(Math.abs(p.x - 4) < 1e-10); assert.ok(Math.abs(p.y) < 1e-10);
  });
});

describe('BezierCurve – construction', () => {
  it('throws RangeError for < 2 control points', () => {
    assert.throws(() => new BezierCurve([{ x: 0, y: 0 }]), RangeError);
    assert.throws(() => new BezierCurve([]), RangeError);
  });
  it('order = controlPoints.length - 1', () => {
    const b = new BezierCurve([{ x: 0, y: 0 }, { x: 1, y: 1 }]);
    assert.equal(b.order, 1);
  });
});

describe('BezierCurve – at', () => {
  const pts = [{ x: 0, y: 0 }, { x: 5, y: 5 }, { x: 10, y: 0 }];
  const b = new BezierCurve(pts);
  it('t=0 → first point', () => {
    const p = b.at(0); assert.ok(Math.abs(p.x) < 1e-10); assert.ok(Math.abs(p.y) < 1e-10);
  });
  it('t=1 → last point', () => {
    const p = b.at(1); assert.ok(Math.abs(p.x - 10) < 1e-10); assert.ok(Math.abs(p.y) < 1e-10);
  });
  it('clamps t<0 to t=0', () => { const p = b.at(-1); assert.ok(Math.abs(p.x) < 1e-10); });
  it('clamps t>1 to t=1', () => { const p = b.at(2); assert.ok(Math.abs(p.x - 10) < 1e-10); });
});

describe('BezierCurve – sample', () => {
  const pts = [{ x: 0, y: 0 }, { x: 5, y: 5 }, { x: 10, y: 0 }];
  const b = new BezierCurve(pts);
  it('returns n points', () => { assert.equal(b.sample(5).length, 5); });
  it('first=p0, last=pN', () => {
    const s = b.sample(10);
    assert.ok(Math.abs(s[0].x) < 1e-10); assert.ok(Math.abs(s[9].x - 10) < 1e-10);
  });
  it('throws for n < 2', () => { assert.throws(() => b.sample(1)); });
});

describe('BezierCurve – length', () => {
  it('straight line length ≈ 5 (3-4-5 triangle)', () => {
    const b = new BezierCurve([{ x: 0, y: 0 }, { x: 3, y: 4 }]);
    assert.ok(Math.abs(b.length() - 5) < 0.01);
  });
  it('positive for non-degenerate curve', () => {
    const b = new BezierCurve([{ x: 0, y: 0 }, { x: 5, y: 5 }, { x: 10, y: 0 }]);
    assert.ok(b.length() > 0);
  });
});

describe('createBezier', () => {
  it('returns a BezierCurve instance', () => {
    const b = createBezier([{ x: 0, y: 0 }, { x: 1, y: 1 }]);
    assert.ok(b instanceof BezierCurve);
  });
});
