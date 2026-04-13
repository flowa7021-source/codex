// ─── Unit Tests: KalmanFilter ─────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { KalmanFilter, createKalmanFilter, smoothSignal } from '../../app/modules/kalman-filter.js';

describe('KalmanFilter – construction', () => {
  it('estimate starts at initialValue', () => {
    const kf = new KalmanFilter({ initialValue: 5 });
    assert.equal(kf.estimate, 5);
  });
  it('defaults to initialValue=0', () => {
    const kf = new KalmanFilter();
    assert.equal(kf.estimate, 0);
  });
});

describe('KalmanFilter – update', () => {
  it('update returns a number', () => {
    const kf = new KalmanFilter();
    const result = kf.update(10);
    assert.ok(typeof result === 'number');
  });
  it('update moves estimate toward measurement', () => {
    const kf = new KalmanFilter({ initialValue: 0 });
    const result = kf.update(100);
    assert.ok(result > 0, 'estimate should move toward 100');
    assert.ok(result < 100, 'but not reach 100 on first update');
  });
  it('repeated updates converge to constant signal', () => {
    const kf = new KalmanFilter({ initialValue: 0, processNoise: 1, measurementNoise: 1 });
    for (let i = 0; i < 100; i++) kf.update(50);
    assert.ok(Math.abs(kf.estimate - 50) < 1, `estimate should be ~50, got ${kf.estimate}`);
  });
});

describe('KalmanFilter – error', () => {
  it('error property is finite and positive', () => {
    const kf = new KalmanFilter();
    assert.ok(kf.error > 0 && Number.isFinite(kf.error));
  });
  it('error decreases after updates', () => {
    const kf = new KalmanFilter({ estimateError: 100 });
    const e0 = kf.error;
    kf.update(5);
    assert.ok(kf.error < e0, 'error should decrease after update');
  });
});

describe('KalmanFilter – reset', () => {
  it('reset restores initial state', () => {
    const kf = new KalmanFilter({ initialValue: 10 });
    kf.update(100);
    kf.update(100);
    kf.reset();
    assert.equal(kf.estimate, 10);
  });
  it('reset with new value sets that value', () => {
    const kf = new KalmanFilter({ initialValue: 0 });
    kf.update(50);
    kf.reset(20);
    assert.equal(kf.estimate, 20);
  });
});

describe('KalmanFilter – predict', () => {
  it('predict returns current estimate', () => {
    const kf = new KalmanFilter({ initialValue: 7 });
    const pred = kf.predict();
    assert.ok(typeof pred === 'number');
  });
});

describe('smoothSignal', () => {
  it('returns same length as input', () => {
    const signal = [1, 2, 3, 4, 5];
    const smoothed = smoothSignal(signal);
    assert.equal(smoothed.length, signal.length);
  });
  it('returns empty array for empty input', () => {
    assert.deepEqual(smoothSignal([]), []);
  });
  it('smoothed signal is closer to true value than noisy measurements', () => {
    const trueValue = 50;
    const noisy = Array.from({ length: 50 }, (_, i) => trueValue + (i % 5 === 0 ? 20 : -10));
    const smoothed = smoothSignal(noisy, 1, 10);
    const noisyMSE = noisy.reduce((s, v) => s + (v - trueValue) ** 2, 0) / noisy.length;
    const smoothedMSE = smoothed.reduce((s, v) => s + (v - trueValue) ** 2, 0) / smoothed.length;
    assert.ok(smoothedMSE < noisyMSE, `smoothed MSE ${smoothedMSE} should be < noisy MSE ${noisyMSE}`);
  });
});

describe('createKalmanFilter', () => {
  it('returns a KalmanFilter instance', () => {
    const kf = createKalmanFilter({ initialValue: 3 });
    assert.ok(kf instanceof KalmanFilter);
    assert.equal(kf.estimate, 3);
  });
});
