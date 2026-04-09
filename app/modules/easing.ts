// @ts-check
// ─── Easing Functions ────────────────────────────────────────────────────────
// Standard easing functions for animation. All take t in [0,1].
// Some functions (Back, Elastic) may overshoot/undershoot [0,1].

// ─── Basic ───────────────────────────────────────────────────────────────────

/** Linear — no easing. */
export function linear(t: number): number {
  return t;
}

// ─── Quadratic ───────────────────────────────────────────────────────────────

/** Ease in quadratic — slow start. */
export function easeInQuad(t: number): number {
  return t * t;
}

/** Ease out quadratic — slow end. */
export function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

/** Ease in-out quadratic — slow start and end. */
export function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

// ─── Cubic ───────────────────────────────────────────────────────────────────

/** Ease in cubic — slow start. */
export function easeInCubic(t: number): number {
  return t * t * t;
}

/** Ease out cubic — slow end. */
export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/** Ease in-out cubic — slow start and end. */
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// ─── Quartic ─────────────────────────────────────────────────────────────────

/** Ease in quartic — slow start. */
export function easeInQuart(t: number): number {
  return t * t * t * t;
}

/** Ease out quartic — slow end. */
export function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

/** Ease in-out quartic — slow start and end. */
export function easeInOutQuart(t: number): number {
  return t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;
}

// ─── Sine ────────────────────────────────────────────────────────────────────

/** Ease in sine. */
export function easeInSine(t: number): number {
  return 1 - Math.cos((t * Math.PI) / 2);
}

/** Ease out sine. */
export function easeOutSine(t: number): number {
  return Math.sin((t * Math.PI) / 2);
}

/** Ease in-out sine. */
export function easeInOutSine(t: number): number {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

// ─── Exponential ─────────────────────────────────────────────────────────────

/** Ease in exponential. Returns 0 at t=0 exactly. */
export function easeInExpo(t: number): number {
  return t === 0 ? 0 : Math.pow(2, 10 * t - 10);
}

/** Ease out exponential. Returns 1 at t=1 exactly. */
export function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

/** Ease in-out exponential. Returns 0/1 at boundaries exactly. */
export function easeInOutExpo(t: number): number {
  if (t === 0) return 0;
  if (t === 1) return 1;
  return t < 0.5
    ? Math.pow(2, 20 * t - 10) / 2
    : (2 - Math.pow(2, -20 * t + 10)) / 2;
}

// ─── Back (overshoot) ────────────────────────────────────────────────────────

const BACK_DEFAULT_OVERSHOOT = 1.70158;

/** Ease in back — overshoots at the end. */
export function easeInBack(t: number, overshoot = BACK_DEFAULT_OVERSHOOT): number {
  if (t === 0) return 0;
  if (t === 1) return 1;
  const c3 = overshoot + 1;
  return c3 * t * t * t - overshoot * t * t;
}

/** Ease out back — overshoots at the start. */
export function easeOutBack(t: number, overshoot = BACK_DEFAULT_OVERSHOOT): number {
  if (t === 0) return 0;
  if (t === 1) return 1;
  const c3 = overshoot + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + overshoot * Math.pow(t - 1, 2);
}

/** Ease in-out back. */
export function easeInOutBack(t: number, overshoot = BACK_DEFAULT_OVERSHOOT): number {
  if (t === 0) return 0;
  if (t === 1) return 1;
  const c2 = overshoot * 1.525;
  return t < 0.5
    ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
    : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (2 * t - 2) + c2) + 2) / 2;
}

// ─── Elastic ─────────────────────────────────────────────────────────────────

const ELASTIC_C4 = (2 * Math.PI) / 3;
const ELASTIC_C5 = (2 * Math.PI) / 4.5;

/** Ease in elastic — springy at the end. */
export function easeInElastic(t: number): number {
  if (t === 0) return 0;
  if (t === 1) return 1;
  return -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * ELASTIC_C4);
}

/** Ease out elastic — springy at the start. */
export function easeOutElastic(t: number): number {
  if (t === 0) return 0;
  if (t === 1) return 1;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ELASTIC_C4) + 1;
}

// ─── Bounce ──────────────────────────────────────────────────────────────────

/** Ease out bounce — bouncing deceleration. */
export function easeOutBounce(t: number): number {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (t < 1 / d1) {
    return n1 * t * t;
  } else if (t < 2 / d1) {
    t -= 1.5 / d1;
    return n1 * t * t + 0.75;
  } else if (t < 2.5 / d1) {
    t -= 2.25 / d1;
    return n1 * t * t + 0.9375;
  } else {
    t -= 2.625 / d1;
    return n1 * t * t + 0.984375;
  }
}

/** Ease in bounce — bouncing acceleration. */
export function easeInBounce(t: number): number {
  return 1 - easeOutBounce(1 - t);
}

// ─── Registry ────────────────────────────────────────────────────────────────

type EasingFn = (t: number) => number;

const EASING_MAP: Record<string, EasingFn> = {
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
};

/** Get an easing function by name, or undefined if not found. */
export function getEasing(name: string): EasingFn | undefined {
  return EASING_MAP[name];
}
