// @ts-check
// ─── Monte Carlo Simulation Utilities ────────────────────────────────────────
// A collection of Monte Carlo methods: π estimation, numerical integration
// in 1-D and 2-D, rejection sampling, and bootstrap confidence intervals.

// ─── estimatePi ──────────────────────────────────────────────────────────────

/**
 * Estimate π via the unit-circle dart-throw method.
 *
 * Randomly samples `samples` points in [0,1)² and counts those falling inside
 * the quarter-circle of radius 1.  π ≈ 4 × (inside / total).
 *
 * @param samples  Number of random samples (must be ≥ 1).
 * @param rng      PRNG returning [0, 1) (default `Math.random`).
 */
export function estimatePi(
  samples: number,
  rng: () => number = Math.random,
): number {
  if (samples < 1) throw new RangeError(`samples must be ≥ 1, got ${samples}`);

  let inside = 0;
  for (let i = 0; i < samples; i++) {
    const x = rng();
    const y = rng();
    if (x * x + y * y <= 1) inside++;
  }
  return (4 * inside) / samples;
}

// ─── monteCarloIntegrate ─────────────────────────────────────────────────────

/**
 * Estimate ∫_a^b f(x) dx using Monte Carlo uniform sampling.
 *
 * @param fn       Integrand.
 * @param a        Lower bound.
 * @param b        Upper bound.
 * @param samples  Number of random samples (must be ≥ 1).
 * @param rng      PRNG returning [0, 1) (default `Math.random`).
 */
export function monteCarloIntegrate(
  fn: (x: number) => number,
  a: number,
  b: number,
  samples: number,
  rng: () => number = Math.random,
): number {
  if (samples < 1) throw new RangeError(`samples must be ≥ 1, got ${samples}`);
  if (a >= b) throw new RangeError(`a must be < b, got a=${a}, b=${b}`);

  const width = b - a;
  let sum = 0;
  for (let i = 0; i < samples; i++) {
    const x = a + rng() * width;
    sum += fn(x);
  }
  return (sum / samples) * width;
}

// ─── monteCarloIntegrate2D ────────────────────────────────────────────────────

/** Axis-aligned bounds for a 2-D region. */
export interface Bounds2D {
  x: [number, number];
  y: [number, number];
}

/**
 * Estimate ∬ f(x,y) dx dy over the rectangular region `bounds` using Monte
 * Carlo uniform sampling.
 *
 * @param fn      Integrand.
 * @param bounds  `{ x: [xMin, xMax], y: [yMin, yMax] }`.
 * @param samples Number of random samples (must be ≥ 1).
 * @param rng     PRNG returning [0, 1) (default `Math.random`).
 */
export function monteCarloIntegrate2D(
  fn: (x: number, y: number) => number,
  bounds: Bounds2D,
  samples: number,
  rng: () => number = Math.random,
): number {
  if (samples < 1) throw new RangeError(`samples must be ≥ 1, got ${samples}`);

  const [xMin, xMax] = bounds.x;
  const [yMin, yMax] = bounds.y;

  if (xMin >= xMax) throw new RangeError(`bounds.x[0] must be < bounds.x[1]`);
  if (yMin >= yMax) throw new RangeError(`bounds.y[0] must be < bounds.y[1]`);

  const xWidth = xMax - xMin;
  const yWidth = yMax - yMin;
  const area = xWidth * yWidth;

  let sum = 0;
  for (let i = 0; i < samples; i++) {
    const x = xMin + rng() * xWidth;
    const y = yMin + rng() * yWidth;
    sum += fn(x, y);
  }
  return (sum / samples) * area;
}

// ─── rejectionSampling ────────────────────────────────────────────────────────

/**
 * Draw `samples` values from a target distribution using rejection sampling.
 *
 * The algorithm proposes candidates via `proposal(rng)` and accepts each with
 * probability `target(x) / (proposalMax * proposal_pdf(x))`.  Because only
 * the ratio matters, `proposalMax` should satisfy:
 *   proposalMax ≥ max_x [ target(x) / proposal_pdf(x) ]
 *
 * In practice the caller provides a `target` density function and a
 * `proposalMax` that upper-bounds `target(x)` over the support of `proposal`.
 * The uniform-envelope form is used here: we accept x when
 *   U(0,1) * proposalMax ≤ target(x).
 *
 * This formulation is valid when `proposal` samples uniformly from the support
 * and `proposalMax` is an upper bound of `target` over that support.
 *
 * @param target       Unnormalised target density function.
 * @param proposal     Sampler that returns a candidate given a PRNG.
 * @param proposalMax  Upper bound of `target` over the proposal support.
 * @param samples      Number of accepted samples to collect.
 * @param rng          PRNG returning [0, 1) (default `Math.random`).
 */
export function rejectionSampling(
  target: (x: number) => number,
  proposal: (rng: () => number) => number,
  proposalMax: number,
  samples: number,
  rng: () => number = Math.random,
): number[] {
  if (samples < 1) throw new RangeError(`samples must be ≥ 1, got ${samples}`);
  if (proposalMax <= 0) throw new RangeError(`proposalMax must be > 0, got ${proposalMax}`);

  const accepted: number[] = [];

  while (accepted.length < samples) {
    const candidate = proposal(rng);
    const u = rng() * proposalMax;
    if (u <= target(candidate)) {
      accepted.push(candidate);
    }
  }

  return accepted;
}

// ─── bootstrapConfidenceInterval ─────────────────────────────────────────────

/** Result returned by `bootstrapConfidenceInterval`. */
export interface BootstrapCI {
  lower: number;
  upper: number;
  estimate: number;
}

/**
 * Compute a bootstrap confidence interval for a statistic of a dataset.
 *
 * Re-samples `data` with replacement `iterations` times, computes `statistic`
 * on each re-sample, and returns the (1−confidence)/2 and (1+confidence)/2
 * percentiles as the interval bounds together with the point estimate on the
 * original data.
 *
 * @param data        Observed dataset.
 * @param statistic   Function mapping a sample to a scalar (e.g. mean).
 * @param confidence  Desired confidence level in (0, 1), e.g. 0.95.
 * @param iterations  Number of bootstrap re-samples (default 1000).
 * @param rng         PRNG returning [0, 1) (default `Math.random`).
 */
export function bootstrapConfidenceInterval(
  data: number[],
  statistic: (d: number[]) => number,
  confidence: number,
  iterations: number = 1000,
  rng: () => number = Math.random,
): BootstrapCI {
  if (data.length === 0) throw new RangeError('data must not be empty');
  if (confidence <= 0 || confidence >= 1) {
    throw new RangeError(`confidence must be in (0, 1), got ${confidence}`);
  }
  if (iterations < 1) throw new RangeError(`iterations must be ≥ 1, got ${iterations}`);

  const n = data.length;
  const bootstrapStats: number[] = new Array(iterations);

  for (let b = 0; b < iterations; b++) {
    // Resample with replacement
    const resample: number[] = new Array(n);
    for (let i = 0; i < n; i++) {
      resample[i] = data[Math.floor(rng() * n)];
    }
    bootstrapStats[b] = statistic(resample);
  }

  bootstrapStats.sort((a, b) => a - b);

  const alpha = 1 - confidence;
  const lowerIdx = Math.floor((alpha / 2) * iterations);
  const upperIdx = Math.min(Math.ceil((1 - alpha / 2) * iterations) - 1, iterations - 1);

  return {
    lower: bootstrapStats[lowerIdx],
    upper: bootstrapStats[upperIdx],
    estimate: statistic(data),
  };
}
