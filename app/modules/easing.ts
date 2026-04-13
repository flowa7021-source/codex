// @ts-check
// ─── Easing Functions ────────────────────────────────────────────────────────
// A complete collection of animation easing functions (Robert Penner style).
// All easing functions take t ∈ [0, 1] and return a number (usually in [0, 1],
// though elastic/back variants may temporarily exceed that range).
// No browser APIs — pure math.

const PI = Math.PI;
const HALF_PI = Math.PI / 2;

// ─── Linear ──────────────────────────────────────────────────────────────────

/** Linear easing — no acceleration. */
export function linear(t: number): number {
  return t;
}

// ─── Quadratic ───────────────────────────────────────────────────────────────

/** Quadratic ease-in: accelerates from zero velocity. */
export function easeInQuad(t: number): number {
  return t * t;
}

/** Quadratic ease-out: decelerates to zero velocity. */
export function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

/** Quadratic ease-in-out: accelerates then decelerates. */
export function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

// ─── Cubic ───────────────────────────────────────────────────────────────────

/** Cubic ease-in. */
export function easeInCubic(t: number): number {
  return t * t * t;
}

/** Cubic ease-out. */
export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/** Cubic ease-in-out. */
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// ─── Quartic ─────────────────────────────────────────────────────────────────

/** Quartic ease-in. */
export function easeInQuart(t: number): number {
  return t * t * t * t;
}

/** Quartic ease-out. */
export function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

/** Quartic ease-in-out. */
export function easeInOutQuart(t: number): number {
  return t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;
}

// ─── Quintic ─────────────────────────────────────────────────────────────────

/** Quintic ease-in. */
export function easeInQuint(t: number): number {
  return t * t * t * t * t;
}

/** Quintic ease-out. */
export function easeOutQuint(t: number): number {
  return 1 - Math.pow(1 - t, 5);
}

/** Quintic ease-in-out. */
export function easeInOutQuint(t: number): number {
  return t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2;
}

// ─── Sine ────────────────────────────────────────────────────────────────────

/** Sinusoidal ease-in. */
export function easeInSine(t: number): number {
  return 1 - Math.cos(t * HALF_PI);
}

/** Sinusoidal ease-out. */
export function easeOutSine(t: number): number {
  return Math.sin(t * HALF_PI);
}

/** Sinusoidal ease-in-out. */
export function easeInOutSine(t: number): number {
  return -(Math.cos(PI * t) - 1) / 2;
}

// ─── Exponential ─────────────────────────────────────────────────────────────

/** Exponential ease-in. Returns 0 at t=0 exactly. */
export function easeInExpo(t: number): number {
  return t === 0 ? 0 : Math.pow(2, 10 * t - 10);
}

/** Exponential ease-out. Returns 1 at t=1 exactly. */
export function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

/** Exponential ease-in-out. Returns 0/1 at boundaries exactly. */
export function easeInOutExpo(t: number): number {
  if (t === 0) return 0;
  if (t === 1) return 1;
  return t < 0.5
    ? Math.pow(2, 20 * t - 10) / 2
    : (2 - Math.pow(2, -20 * t + 10)) / 2;
}

// ─── Circular ────────────────────────────────────────────────────────────────

/** Circular ease-in: starts slowly, accelerates like a quarter circle. */
export function easeInCirc(t: number): number {
  return 1 - Math.sqrt(1 - t * t);
}

/** Circular ease-out. */
export function easeOutCirc(t: number): number {
  return Math.sqrt(1 - Math.pow(t - 1, 2));
}

/** Circular ease-in-out. */
export function easeInOutCirc(t: number): number {
  return t < 0.5
    ? (1 - Math.sqrt(1 - Math.pow(2 * t, 2))) / 2
    : (Math.sqrt(1 - Math.pow(-2 * t + 2, 2)) + 1) / 2;
}

// ─── Elastic ─────────────────────────────────────────────────────────────────

const ELASTIC_C4 = (2 * PI) / 3;
const ELASTIC_C5 = (2 * PI) / 4.5;

/**
 * Elastic ease-in: overshoots below 0 before returning to 1.
 * fn(0) = 0, fn(1) = 1; may dip below 0.
 */
export function easeInElastic(t: number): number {
  if (t === 0) return 0;
  if (t === 1) return 1;
  return -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * ELASTIC_C4);
}

/**
 * Elastic ease-out: overshoots above 1 before settling.
 * fn(0) = 0, fn(1) = 1; may exceed 1.
 */
export function easeOutElastic(t: number): number {
  if (t === 0) return 0;
  if (t === 1) return 1;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ELASTIC_C4) + 1;
}

/**
 * Elastic ease-in-out.
 * fn(0) = 0, fn(1) = 1; may dip below 0 or exceed 1.
 */
export function easeInOutElastic(t: number): number {
  if (t === 0) return 0;
  if (t === 1) return 1;
  if (t < 0.5) {
    return -(Math.pow(2, 20 * t - 10) * Math.sin((20 * t - 11.125) * ELASTIC_C5)) / 2;
  }
  return (Math.pow(2, -20 * t + 10) * Math.sin((20 * t - 11.125) * ELASTIC_C5)) / 2 + 1;
}

// ─── Back (overshoot) ────────────────────────────────────────────────────────

const BACK_DEFAULT_OVERSHOOT = 1.70158;

/**
 * Back ease-in: backs up slightly before moving forward.
 * fn(0) = 0, fn(1) = 1; may dip below 0.
 */
export function easeInBack(t: number, overshoot = BACK_DEFAULT_OVERSHOOT): number {
  if (t === 0) return 0;
  if (t === 1) return 1;
  const c3 = overshoot + 1;
  return c3 * t * t * t - overshoot * t * t;
}

/**
 * Back ease-out: overshoots before settling.
 * fn(0) = 0, fn(1) = 1; may exceed 1.
 */
export function easeOutBack(t: number, overshoot = BACK_DEFAULT_OVERSHOOT): number {
  if (t === 0) return 0;
  if (t === 1) return 1;
  const c3 = overshoot + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + overshoot * Math.pow(t - 1, 2);
}

/**
 * Back ease-in-out.
 * fn(0) = 0, fn(1) = 1; may dip below 0 or exceed 1.
 */
export function easeInOutBack(t: number, overshoot = BACK_DEFAULT_OVERSHOOT): number {
  if (t === 0) return 0;
  if (t === 1) return 1;
  const c2 = overshoot * 1.525;
  return t < 0.5
    ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
    : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (2 * t - 2) + c2) + 2) / 2;
}

// ─── Bounce ──────────────────────────────────────────────────────────────────

/** Bounce ease-out: bouncing deceleration toward the target. */
export function easeOutBounce(t: number): number {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (t < 1 / d1) {
    return n1 * t * t;
  } else if (t < 2 / d1) {
    const t2 = t - 1.5 / d1;
    return n1 * t2 * t2 + 0.75;
  } else if (t < 2.5 / d1) {
    const t2 = t - 2.25 / d1;
    return n1 * t2 * t2 + 0.9375;
  } else {
    const t2 = t - 2.625 / d1;
    return n1 * t2 * t2 + 0.984375;
  }
}

/** Bounce ease-in: bouncing acceleration away from the start. */
export function easeInBounce(t: number): number {
  return 1 - easeOutBounce(1 - t);
}

/** Bounce ease-in-out. */
export function easeInOutBounce(t: number): number {
  return t < 0.5
    ? (1 - easeOutBounce(1 - 2 * t)) / 2
    : (1 + easeOutBounce(2 * t - 1)) / 2;
}

// ─── Utility functions ────────────────────────────────────────────────────────

/** Clamp t to [0, 1]. */
export function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

/**
 * Linear interpolation between `a` and `b` at normalised time `t`.
 * lerp(a, b, 0) = a, lerp(a, b, 1) = b.
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Inverse of lerp: given a `value` between `a` and `b`, returns the
 * normalised t that produces it. Returns 0 when a === b.
 */
export function inverseLerp(a: number, b: number, value: number): number {
  if (a === b) return 0;
  return (value - a) / (b - a);
}

/**
 * Smoothstep: a cubic Hermite interpolation.
 * smoothstep(0) = 0, smoothstep(1) = 1.
 * Formula: 3t² − 2t³
 */
export function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

/**
 * Smootherstep (Ken Perlin's improved smoothstep).
 * smootherstep(0) = 0, smootherstep(1) = 1.
 * Formula: 6t⁵ − 15t⁴ + 10t³
 */
export function smootherstep(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/**
 * Apply any easing function to interpolate between `from` and `to` at time `t`.
 * Equivalent to lerp(from, to, fn(t)).
 */
export function ease(fn: (t: number) => number, from: number, to: number, t: number): number {
  return from + (to - from) * fn(t);
}

// ─── Cubic Bézier ────────────────────────────────────────────────────────────

/**
 * Create a CSS-style cubic Bézier easing function from two control points.
 * (x1, y1) and (x2, y2) are the interior handles; endpoints are fixed at
 * (0, 0) and (1, 1). Uses Newton-Raphson iteration for accuracy.
 *
 * @param x1 - X of first control point, must be in [0, 1].
 * @param y1 - Y of first control point (may be outside [0, 1] for overshoot).
 * @param x2 - X of second control point, must be in [0, 1].
 * @param y2 - Y of second control point (may be outside [0, 1] for overshoot).
 * @returns Easing function (t: number) => number.
 */
export function cubicBezier(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): (t: number) => number {
  // Precompute cubic Bézier coefficients for x and y
  const ax = 3 * x1;
  const bx = 3 * (x2 - x1) - ax;
  const cx_ = 1 - ax - bx;

  const ay = 3 * y1;
  const by = 3 * (y2 - y1) - ay;
  const cy_ = 1 - ay - by;

  function sampleCurveX(t: number): number {
    return ((cx_ * t + bx) * t + ax) * t;
  }

  function sampleCurveY(t: number): number {
    return ((cy_ * t + by) * t + ay) * t;
  }

  function sampleCurveDerivativeX(t: number): number {
    return (3 * cx_ * t + 2 * bx) * t + ax;
  }

  // Solve sampleCurveX(t) = x using Newton-Raphson + binary search fallback
  function solveCurveX(x: number): number {
    let t = x;
    // Newton-Raphson iterations
    for (let i = 0; i < 8; i++) {
      const dx = sampleCurveX(t) - x;
      if (Math.abs(dx) < 1e-7) return t;
      const d = sampleCurveDerivativeX(t);
      if (Math.abs(d) < 1e-6) break;
      t -= dx / d;
    }
    // Binary search fallback
    let lo = 0;
    let hi = 1;
    t = x;
    if (t < lo) return lo;
    if (t > hi) return hi;
    while (lo < hi) {
      const xMid = sampleCurveX(t);
      if (Math.abs(xMid - x) < 1e-7) return t;
      if (x > xMid) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return t;
  }

  return function bezierEasing(t: number): number {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return sampleCurveY(solveCurveX(t));
  };
}

// ─── Registry ──────────────────────────────────────────────────────────────────

type EasingFn = (t: number) => number;

const EASING_REGISTRY: Record<string, EasingFn> = {
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
  easeInQuint,
  easeOutQuint,
  easeInOutQuint,
  easeInSine,
  easeOutSine,
  easeInOutSine,
  easeInExpo,
  easeOutExpo,
  easeInOutExpo,
  easeInCirc,
  easeOutCirc,
  easeInOutCirc,
  easeInElastic,
  easeOutElastic,
  easeInOutElastic,
  easeInBack,
  easeOutBack,
  easeInOutBack,
  easeOutBounce,
  easeInBounce,
};

/**
 * Look up an easing function by name.
 * Returns the function if found, or `undefined` if the name is not registered.
 */
export function getEasing(name: string): EasingFn | undefined {
  return EASING_REGISTRY[name];
}
