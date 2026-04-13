// ─── Unit Tests: easing ───────────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  linear,
  easeInQuad,
  easeOutQuad,
  easeInOutQuad,
  easeInCubic,
  easeOutCubic,
  easeInOutCubic,
  easeInQuart,
  easeOutQuart,
  easeInOutQuart,
  easeInSine,
  easeOutSine,
  easeInOutSine,
  easeInExpo,
  easeOutExpo,
  easeInOutExpo,
  easeInBack,
  easeOutBack,
  easeInOutBack,
  easeInElastic,
  easeOutElastic,
  easeInBounce,
  easeOutBounce,
  getEasing,
} from '../../app/modules/easing.js';

// Helper: assert a function maps 0→0 and 1→1 (within floating-point tolerance)
function assertBoundaries(fn, name) {
  assert.ok(Math.abs(fn(0)) < 1e-9, `${name}(0) should be ~0`);
  assert.ok(Math.abs(fn(1) - 1) < 1e-9, `${name}(1) should be ~1`);
}

// ─── linear ──────────────────────────────────────────────────────────────────

describe('linear', () => {
  it('returns 0 at t=0', () => assert.equal(linear(0), 0));
  it('returns 0.5 at t=0.5', () => assert.equal(linear(0.5), 0.5));
  it('returns 1 at t=1', () => assert.equal(linear(1), 1));
  it('passes through any t unchanged', () => {
    assert.equal(linear(0.25), 0.25);
    assert.equal(linear(0.75), 0.75);
  });
});

// ─── easeInQuad ──────────────────────────────────────────────────────────────

describe('easeInQuad', () => {
  it('satisfies boundary conditions', () => assertBoundaries(easeInQuad, 'easeInQuad'));
  it('is slow start: value at t=0.5 is below 0.5', () => {
    assert.ok(easeInQuad(0.5) < 0.5);
  });
  it('matches t^2 formula', () => {
    assert.ok(Math.abs(easeInQuad(0.3) - 0.09) < 1e-9);
  });
});

// ─── easeOutQuad ─────────────────────────────────────────────────────────────

describe('easeOutQuad', () => {
  it('satisfies boundary conditions', () => assertBoundaries(easeOutQuad, 'easeOutQuad'));
  it('is fast start: value at t=0.5 is above 0.5', () => {
    assert.ok(easeOutQuad(0.5) > 0.5);
  });
});

// ─── easeInOutQuad ───────────────────────────────────────────────────────────

describe('easeInOutQuad', () => {
  it('satisfies boundary conditions', () => assertBoundaries(easeInOutQuad, 'easeInOutQuad'));
  it('is symmetric: value at t=0.5 ≈ 0.5', () => {
    assert.ok(Math.abs(easeInOutQuad(0.5) - 0.5) < 1e-9);
  });
  it('is slow at both ends', () => {
    assert.ok(easeInOutQuad(0.25) < 0.25);
    assert.ok(easeInOutQuad(0.75) > 0.75);
  });
});

// ─── easeInCubic ─────────────────────────────────────────────────────────────

describe('easeInCubic', () => {
  it('satisfies boundary conditions', () => assertBoundaries(easeInCubic, 'easeInCubic'));
  it('is slow start: value at t=0.5 < 0.5', () => {
    assert.ok(easeInCubic(0.5) < 0.5);
  });
  it('matches t^3 formula', () => {
    assert.ok(Math.abs(easeInCubic(0.5) - 0.125) < 1e-9);
  });
});

// ─── easeOutCubic ────────────────────────────────────────────────────────────

describe('easeOutCubic', () => {
  it('satisfies boundary conditions', () => assertBoundaries(easeOutCubic, 'easeOutCubic'));
  it('is fast start: value at t=0.5 > 0.5', () => {
    assert.ok(easeOutCubic(0.5) > 0.5);
  });
});

// ─── easeInOutCubic ──────────────────────────────────────────────────────────

describe('easeInOutCubic', () => {
  it('satisfies boundary conditions', () => assertBoundaries(easeInOutCubic, 'easeInOutCubic'));
  it('is symmetric at t=0.5', () => {
    assert.ok(Math.abs(easeInOutCubic(0.5) - 0.5) < 1e-9);
  });
});

// ─── easeInQuart ─────────────────────────────────────────────────────────────

describe('easeInQuart', () => {
  it('satisfies boundary conditions', () => assertBoundaries(easeInQuart, 'easeInQuart'));
  it('is slower start than easeInCubic at t=0.5', () => {
    assert.ok(easeInQuart(0.5) < easeInCubic(0.5));
  });
});

// ─── easeOutQuart ────────────────────────────────────────────────────────────

describe('easeOutQuart', () => {
  it('satisfies boundary conditions', () => assertBoundaries(easeOutQuart, 'easeOutQuart'));
  it('is fast start: value at t=0.5 > 0.5', () => {
    assert.ok(easeOutQuart(0.5) > 0.5);
  });
});

// ─── easeInOutQuart ──────────────────────────────────────────────────────────

describe('easeInOutQuart', () => {
  it('satisfies boundary conditions', () => assertBoundaries(easeInOutQuart, 'easeInOutQuart'));
  it('is symmetric at t=0.5', () => {
    assert.ok(Math.abs(easeInOutQuart(0.5) - 0.5) < 1e-9);
  });
});

// ─── easeInSine ──────────────────────────────────────────────────────────────

describe('easeInSine', () => {
  it('satisfies boundary conditions', () => assertBoundaries(easeInSine, 'easeInSine'));
  it('is slow start: value at t=0.5 < 0.5', () => {
    assert.ok(easeInSine(0.5) < 0.5);
  });
});

// ─── easeOutSine ─────────────────────────────────────────────────────────────

describe('easeOutSine', () => {
  it('satisfies boundary conditions', () => assertBoundaries(easeOutSine, 'easeOutSine'));
  it('is fast start: value at t=0.5 > 0.5', () => {
    assert.ok(easeOutSine(0.5) > 0.5);
  });
});

// ─── easeInOutSine ───────────────────────────────────────────────────────────

describe('easeInOutSine', () => {
  it('satisfies boundary conditions', () => assertBoundaries(easeInOutSine, 'easeInOutSine'));
  it('is symmetric at t=0.5', () => {
    assert.ok(Math.abs(easeInOutSine(0.5) - 0.5) < 1e-9);
  });
});

// ─── easeInExpo ──────────────────────────────────────────────────────────────

describe('easeInExpo', () => {
  it('returns 0 at t=0', () => assert.equal(easeInExpo(0), 0));
  it('returns 1 at t=1', () => assert.equal(easeInExpo(1), 1));
  it('is slow start: value at t=0.5 < 0.5', () => {
    assert.ok(easeInExpo(0.5) < 0.5);
  });
});

// ─── easeOutExpo ─────────────────────────────────────────────────────────────

describe('easeOutExpo', () => {
  it('returns 0 at t=0', () => assert.equal(easeOutExpo(0), 0));
  it('returns 1 at t=1', () => assert.equal(easeOutExpo(1), 1));
  it('is fast start: value at t=0.5 > 0.5', () => {
    assert.ok(easeOutExpo(0.5) > 0.5);
  });
});

// ─── easeInOutExpo ───────────────────────────────────────────────────────────

describe('easeInOutExpo', () => {
  it('returns 0 at t=0', () => assert.equal(easeInOutExpo(0), 0));
  it('returns 1 at t=1', () => assert.equal(easeInOutExpo(1), 1));
  it('is symmetric at t=0.5', () => {
    assert.ok(Math.abs(easeInOutExpo(0.5) - 0.5) < 1e-9);
  });
});

// ─── easeInBack ──────────────────────────────────────────────────────────────

describe('easeInBack', () => {
  it('returns 0 at t=0', () => assert.equal(easeInBack(0), 0));
  it('returns 1 at t=1', () => assert.equal(easeInBack(1), 1));
  it('may go below 0 (overshoot) during animation', () => {
    // With default overshoot the function dips below 0 near t=0.3
    const hasUndershoot = [0.1, 0.2, 0.3].some((t) => easeInBack(t) < 0);
    assert.ok(hasUndershoot);
  });
  it('accepts a custom overshoot parameter', () => {
    const v0 = easeInBack(0.3, 1);
    const v1 = easeInBack(0.3, 3);
    assert.notEqual(v0, v1);
  });
});

// ─── easeOutBack ─────────────────────────────────────────────────────────────

describe('easeOutBack', () => {
  it('returns 0 at t=0', () => assert.equal(easeOutBack(0), 0));
  it('returns 1 at t=1', () => assert.equal(easeOutBack(1), 1));
  it('may go above 1 (overshoot) during animation', () => {
    const hasOvershoot = [0.7, 0.8, 0.9].some((t) => easeOutBack(t) > 1);
    assert.ok(hasOvershoot);
  });
});

// ─── easeInOutBack ───────────────────────────────────────────────────────────

describe('easeInOutBack', () => {
  it('returns 0 at t=0', () => assert.equal(easeInOutBack(0), 0));
  it('returns 1 at t=1', () => assert.equal(easeInOutBack(1), 1));
  it('is symmetric at t=0.5', () => {
    assert.ok(Math.abs(easeInOutBack(0.5) - 0.5) < 1e-9);
  });
});

// ─── easeInElastic ───────────────────────────────────────────────────────────

describe('easeInElastic', () => {
  it('returns 0 at t=0', () => assert.equal(easeInElastic(0), 0));
  it('returns 1 at t=1', () => assert.equal(easeInElastic(1), 1));
  it('oscillates during the animation', () => {
    // elastic functions go negative before reaching 1
    const hasNegative = [0.2, 0.4, 0.6, 0.8].some((t) => easeInElastic(t) < 0);
    assert.ok(hasNegative);
  });
});

// ─── easeOutElastic ──────────────────────────────────────────────────────────

describe('easeOutElastic', () => {
  it('returns 0 at t=0', () => assert.equal(easeOutElastic(0), 0));
  it('returns 1 at t=1', () => assert.equal(easeOutElastic(1), 1));
  it('overshoots above 1 during the animation', () => {
    const hasOvershoot = [0.2, 0.4, 0.6, 0.8].some((t) => easeOutElastic(t) > 1);
    assert.ok(hasOvershoot);
  });
});

// ─── easeInBounce ────────────────────────────────────────────────────────────

describe('easeInBounce', () => {
  it('returns 0 at t=0', () => assert.equal(easeInBounce(0), 0));
  it('returns 1 at t=1', () => assert.equal(easeInBounce(1), 1));
  it('stays in [0,1] for t in [0,1]', () => {
    for (let i = 0; i <= 10; i++) {
      const v = easeInBounce(i / 10);
      assert.ok(v >= 0 && v <= 1, `easeInBounce(${i / 10}) out of range: ${v}`);
    }
  });
});

// ─── easeOutBounce ───────────────────────────────────────────────────────────

describe('easeOutBounce', () => {
  it('returns 0 at t=0', () => assert.equal(easeOutBounce(0), 0));
  it('returns 1 at t=1', () => assert.equal(easeOutBounce(1), 1));
  it('stays in [0,1] for t in [0,1]', () => {
    for (let i = 0; i <= 10; i++) {
      const v = easeOutBounce(i / 10);
      assert.ok(v >= 0 && v <= 1, `easeOutBounce(${i / 10}) out of range: ${v}`);
    }
  });
});

// ─── getEasing ───────────────────────────────────────────────────────────────

describe('getEasing', () => {
  it('returns the linear function for "linear"', () => {
    const fn = getEasing('linear');
    assert.ok(typeof fn === 'function');
    assert.equal(fn(0.5), 0.5);
  });

  it('returns the correct function for each registered name', () => {
    const names = [
      'easeInQuad', 'easeOutQuad', 'easeInOutQuad',
      'easeInCubic', 'easeOutCubic', 'easeInOutCubic',
      'easeInQuart', 'easeOutQuart', 'easeInOutQuart',
      'easeInSine', 'easeOutSine', 'easeInOutSine',
      'easeInExpo', 'easeOutExpo', 'easeInOutExpo',
      'easeInBack', 'easeOutBack', 'easeInOutBack',
      'easeInElastic', 'easeOutElastic',
      'easeInBounce', 'easeOutBounce',
    ];
    for (const name of names) {
      const fn = getEasing(name);
      assert.ok(typeof fn === 'function', `getEasing('${name}') should return a function`);
    }
  });

  it('returns undefined for unknown name', () => {
    assert.equal(getEasing('nonExistent'), undefined);
  });

  it('getEasing("linear") is the linear function itself', () => {
    assert.strictEqual(getEasing('linear'), linear);
  });
});
