// @ts-check
// ─── Animation Utilities ─────────────────────────────────────────────────────
// Timing, interpolation, and sequencing helpers for animation.
// No browser APIs (no DOM, no RAF) — pure math.

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AnimationOptions {
  /** Duration in milliseconds. */
  duration: number;
  /** Easing function: t in [0,1] → value (default linear). */
  easing?: (t: number) => number;
  /** Start value. */
  from?: number;
  /** End value. */
  to?: number;
}

// ─── Core interpolation ──────────────────────────────────────────────────────

/**
 * Interpolate a single value at normalised time t (0 = start, 1 = end).
 * Optionally applies an easing function to t before interpolating.
 */
export function interpolate(
  from: number,
  to: number,
  t: number,
  easing?: (t: number) => number,
): number {
  const easedT = easing ? easing(t) : t;
  return from + (to - from) * easedT;
}

/**
 * Interpolate multiple values simultaneously.
 * `from` and `to` must have the same length; extra elements in the longer
 * array are ignored.
 */
export function interpolateMulti(
  from: number[],
  to: number[],
  t: number,
  easing?: (t: number) => number,
): number[] {
  const len = Math.min(from.length, to.length);
  const result: number[] = new Array(len);
  for (let i = 0; i < len; i++) {
    result[i] = interpolate(from[i], to[i], t, easing);
  }
  return result;
}

// ─── Color interpolation ─────────────────────────────────────────────────────

export interface RGB {
  r: number;
  g: number;
  b: number;
}

/**
 * Interpolate between two RGB colours at normalised time t.
 * Channel values are rounded to the nearest integer.
 */
export function interpolateColor(from: RGB, to: RGB, t: number): RGB {
  return {
    r: Math.round(interpolate(from.r, to.r, t)),
    g: Math.round(interpolate(from.g, to.g, t)),
    b: Math.round(interpolate(from.b, to.b, t)),
  };
}

// ─── Time helpers ────────────────────────────────────────────────────────────

/** Clamp t to [0, 1]. */
export function clampT(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

/**
 * Calculate normalised time t for a given elapsed time and total duration.
 * Returns a value clamped to [0, 1].
 */
export function calcT(elapsed: number, duration: number): number {
  if (duration <= 0) return 1;
  return clampT(elapsed / duration);
}

// ─── Frame sequencing ────────────────────────────────────────────────────────

/**
 * Build an evenly-spaced time array for a frame sequence.
 * Returns an array of `frames` timestamps (in ms) spread over `duration`.
 * For frames=1 the single timestamp is 0. For frames≤0 returns [].
 */
export function frameSequence(frames: number, duration: number): number[] {
  if (frames <= 0) return [];
  if (frames === 1) return [0];
  const result: number[] = new Array(frames);
  for (let i = 0; i < frames; i++) {
    result[i] = (i / (frames - 1)) * duration;
  }
  return result;
}

// ─── Ping-pong ───────────────────────────────────────────────────────────────

/**
 * Ping-pong: maps t∈[0,1] to a value that rises 0→1 in the first half
 * and falls 1→0 in the second half.
 * t=0 → 0, t=0.5 → 1, t=1 → 0.
 */
export function pingPong(t: number): number {
  // t * 2 mod 2, then mirror if > 1
  const v = (t * 2) % 2;
  return v <= 1 ? v : 2 - v;
}

// ─── Spring ──────────────────────────────────────────────────────────────────

/**
 * Overdamped spring from 0 to 1.
 * Returns 0 at t=0, approaches 1 asymptotically (returns 1 exactly at t=1).
 *
 * @param t - Normalised time [0, 1].
 * @param stiffness - Controls speed of approach (default 10).
 * @param damping   - Damping ratio (default 1 = critically damped).
 */
export function spring(t: number, stiffness = 10, damping = 1): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  // Simple critically-damped approximation: 1 - e^(-stiffness * damping * t)
  // normalised so that at t=1 we clamp to 1 via the boundary guards above.
  return 1 - Math.exp(-stiffness * damping * t);
}
