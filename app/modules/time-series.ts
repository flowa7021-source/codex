// @ts-check
// ─── Time Series ─────────────────────────────────────────────────────────────
// Time series data structure and utilities.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DataPoint {
  timestamp: number; // Unix ms
  value: number;
}

// ─── TimeSeries ───────────────────────────────────────────────────────────────

export class TimeSeries {
  #data: DataPoint[];

  constructor(data?: DataPoint[]) {
    if (data && data.length > 0) {
      this.#data = [...data].sort((a, b) => a.timestamp - b.timestamp);
    } else {
      this.#data = [];
    }
  }

  /** Add a data point (automatically sorted by timestamp). */
  add(point: DataPoint): void {
    // Binary search insertion to keep array sorted
    let lo = 0;
    let hi = this.#data.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (this.#data[mid].timestamp <= point.timestamp) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    this.#data.splice(lo, 0, point);
  }

  /**
   * Get the value at or before the given timestamp.
   * When interpolate is true, linearly interpolates between the two
   * surrounding points; otherwise returns the most-recent point's value.
   */
  valueAt(timestamp: number, interpolate = false): number | undefined {
    const data = this.#data;
    if (data.length === 0) return undefined;

    // Find the rightmost point with timestamp <= query
    let lo = 0;
    let hi = data.length - 1;
    let idx = -1;

    while (lo <= hi) {
      const mid = (lo + hi) >>> 1;
      if (data[mid].timestamp <= timestamp) {
        idx = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }

    if (idx === -1) return undefined; // all points are after timestamp

    if (!interpolate || idx === data.length - 1) {
      return data[idx].value;
    }

    // Linear interpolation between idx and idx+1
    const p0 = data[idx];
    const p1 = data[idx + 1];
    const t = (timestamp - p0.timestamp) / (p1.timestamp - p0.timestamp);
    return p0.value + t * (p1.value - p0.value);
  }

  /** Return a new TimeSeries containing only points in [start, end]. */
  slice(start: number, end: number): TimeSeries {
    const filtered = this.#data.filter(
      (p) => p.timestamp >= start && p.timestamp <= end,
    );
    // Already sorted, so pass directly (constructor will re-sort, no harm)
    return new TimeSeries(filtered);
  }

  /**
   * Resample to evenly spaced intervals.
   * Produces points from the first timestamp to the last, stepping by
   * intervalMs, using linear interpolation for intermediate values.
   */
  resample(intervalMs: number): TimeSeries {
    const data = this.#data;
    if (data.length === 0 || intervalMs <= 0) return new TimeSeries();
    if (data.length === 1) return new TimeSeries([{ ...data[0] }]);

    const first = data[0].timestamp;
    const last = data[data.length - 1].timestamp;
    const result: DataPoint[] = [];

    for (let ts = first; ts <= last; ts += intervalMs) {
      const value = this.valueAt(ts, true);
      if (value !== undefined) {
        result.push({ timestamp: ts, value });
      }
    }

    return new TimeSeries(result);
  }

  /** Apply a function to all values, returning a new TimeSeries. */
  map(fn: (value: number, timestamp: number) => number): TimeSeries {
    const mapped = this.#data.map((p) => ({
      timestamp: p.timestamp,
      value: fn(p.value, p.timestamp),
    }));
    return new TimeSeries(mapped);
  }

  /** Compute aggregate statistics over the series. */
  stats(): { min: number; max: number; mean: number; stddev: number; count: number } {
    const data = this.#data;
    const count = data.length;

    if (count === 0) {
      return { min: NaN, max: NaN, mean: NaN, stddev: NaN, count: 0 };
    }

    let min = data[0].value;
    let max = data[0].value;
    let sum = 0;

    for (const { value } of data) {
      if (value < min) min = value;
      if (value > max) max = value;
      sum += value;
    }

    const mean = sum / count;

    let variance = 0;
    for (const { value } of data) {
      const diff = value - mean;
      variance += diff * diff;
    }
    variance /= count;

    return { min, max, mean, stddev: Math.sqrt(variance), count };
  }

  /** Underlying data points (sorted by timestamp). */
  get data(): DataPoint[] {
    return this.#data.slice();
  }

  /** Number of data points. */
  get length(): number {
    return this.#data.length;
  }
}
