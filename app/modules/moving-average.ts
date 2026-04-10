// @ts-check
// ─── Moving Average & Technical Indicators ───────────────────────────────────
// Common moving averages and financial technical indicators.

// ─── Simple Moving Average ────────────────────────────────────────────────────

/**
 * Simple Moving Average.
 * Returns an array of length max(0, data.length - period + 1).
 */
export function sma(data: number[], period: number): number[] {
  if (period <= 0 || period > data.length) return [];
  const result: number[] = [];
  let windowSum = 0;

  for (let i = 0; i < period; i++) {
    windowSum += data[i];
  }
  result.push(windowSum / period);

  for (let i = period; i < data.length; i++) {
    windowSum += data[i] - data[i - period];
    result.push(windowSum / period);
  }

  return result;
}

// ─── Exponential Moving Average ───────────────────────────────────────────────

/**
 * Exponential Moving Average.
 * The first value equals data[0]; subsequent values use the smoothing factor
 * k = 2 / (period + 1).
 */
export function ema(data: number[], period: number): number[] {
  if (data.length === 0 || period <= 0) return [];
  const k = 2 / (period + 1);
  const result: number[] = [data[0]];

  for (let i = 1; i < data.length; i++) {
    result.push(data[i] * k + result[i - 1] * (1 - k));
  }

  return result;
}

// ─── Weighted Moving Average ──────────────────────────────────────────────────

/**
 * Weighted Moving Average.
 * Weights are 1, 2, …, period (most recent gets the highest weight).
 * Returns an array of length max(0, data.length - period + 1).
 */
export function wma(data: number[], period: number): number[] {
  if (period <= 0 || period > data.length) return [];

  // denominator = period * (period + 1) / 2
  const denom = (period * (period + 1)) / 2;
  const result: number[] = [];

  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += data[i - period + 1 + j] * (j + 1);
    }
    result.push(sum / denom);
  }

  return result;
}

// ─── Cumulative Moving Average ────────────────────────────────────────────────

/**
 * Cumulative Moving Average.
 * Each element i is the mean of data[0..i].
 */
export function cma(data: number[]): number[] {
  if (data.length === 0) return [];
  const result: number[] = [];
  let sum = 0;

  for (let i = 0; i < data.length; i++) {
    sum += data[i];
    result.push(sum / (i + 1));
  }

  return result;
}

// ─── Rolling Standard Deviation ───────────────────────────────────────────────

/**
 * Rolling standard deviation (population std dev over a window of `period`).
 * Returns an array of length max(0, data.length - period + 1).
 */
export function rollingStdDev(data: number[], period: number): number[] {
  if (period <= 0 || period > data.length) return [];
  const result: number[] = [];

  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sum += data[j];
    }
    const mean = sum / period;
    let variance = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const diff = data[j] - mean;
      variance += diff * diff;
    }
    result.push(Math.sqrt(variance / period));
  }

  return result;
}

// ─── Bollinger Bands ──────────────────────────────────────────────────────────

/**
 * Bollinger Bands.
 * Returns { upper, middle, lower } arrays each of length
 * max(0, data.length - period + 1).
 * Defaults: multiplier = 2.
 */
export function bollingerBands(
  data: number[],
  period: number,
  multiplier = 2,
): { upper: number[]; middle: number[]; lower: number[] } {
  const middle = sma(data, period);
  const stddev = rollingStdDev(data, period);

  const upper = middle.map((m, i) => m + multiplier * stddev[i]);
  const lower = middle.map((m, i) => m - multiplier * stddev[i]);

  return { upper, middle, lower };
}

// ─── MACD ─────────────────────────────────────────────────────────────────────

/**
 * MACD (Moving Average Convergence Divergence).
 * Returns { macd, signal, histogram }.
 * All three arrays are aligned to the same length (signal length).
 * Defaults: fastPeriod = 12, slowPeriod = 26, signalPeriod = 9.
 */
export function macd(
  data: number[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9,
): { macd: number[]; signal: number[]; histogram: number[] } {
  const fastEma = ema(data, fastPeriod);
  const slowEma = ema(data, slowPeriod);

  // MACD line: fastEma - slowEma (both are same length as data)
  const macdLine = fastEma.map((f, i) => f - slowEma[i]);

  // Signal line: EMA of MACD line
  const signalLine = ema(macdLine, signalPeriod);

  // Histogram: MACD - signal (same length as both)
  const histogram = macdLine.map((m, i) => m - signalLine[i]);

  return { macd: macdLine, signal: signalLine, histogram };
}

// ─── RSI ──────────────────────────────────────────────────────────────────────

/**
 * Relative Strength Index.
 * Returns values in [0, 100]. The result array has length
 * max(0, data.length - period).
 * Default period = 14.
 */
export function rsi(data: number[], period = 14): number[] {
  if (data.length <= period || period <= 0) return [];

  const result: number[] = [];

  // Initial average gain / loss over the first `period` changes
  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 1; i <= period; i++) {
    const change = data[i] - data[i - 1];
    if (change > 0) {
      avgGain += change;
    } else {
      avgLoss += -change;
    }
  }

  avgGain /= period;
  avgLoss /= period;

  const firstRsi =
    avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  result.push(firstRsi);

  // Smooth subsequent values with Wilder's smoothing
  for (let i = period + 1; i < data.length; i++) {
    const change = data[i] - data[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    const rsiVal =
      avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    result.push(rsiVal);
  }

  return result;
}
