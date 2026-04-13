// ─── Unit Tests: Wavelet Transform ───────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  haarForward,
  haarInverse,
  WaveletTransform,
  createWaveletTransform,
  nextPowerOfTwo,
  padToPowerOfTwo,
} from '../../app/modules/wavelet.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Check that two arrays are element-wise equal within `eps`. */
function assertArraysClose(actual, expected, eps = 1e-10) {
  assert.equal(actual.length, expected.length, 'array lengths must match');
  for (let i = 0; i < expected.length; i++) {
    assert.ok(
      Math.abs(actual[i] - expected[i]) <= eps,
      `index ${i}: expected ${expected[i]}, got ${actual[i]} (delta=${Math.abs(actual[i] - expected[i])})`,
    );
  }
}

/** Returns true if n is a positive power of 2. */
function isPow2(n) {
  return n > 0 && (n & (n - 1)) === 0;
}

// ─── nextPowerOfTwo ───────────────────────────────────────────────────────────

describe('nextPowerOfTwo', () => {
  it('nextPowerOfTwo(1) === 1', () => {
    assert.equal(nextPowerOfTwo(1), 1);
  });

  it('nextPowerOfTwo(5) === 8', () => {
    assert.equal(nextPowerOfTwo(5), 8);
  });

  it('nextPowerOfTwo(8) === 8 (already a power of 2)', () => {
    assert.equal(nextPowerOfTwo(8), 8);
  });

  it('nextPowerOfTwo(0) === 1', () => {
    assert.equal(nextPowerOfTwo(0), 1);
  });

  it('nextPowerOfTwo(16) === 16', () => {
    assert.equal(nextPowerOfTwo(16), 16);
  });

  it('nextPowerOfTwo(17) === 32', () => {
    assert.equal(nextPowerOfTwo(17), 32);
  });
});

// ─── padToPowerOfTwo ─────────────────────────────────────────────────────────

describe('padToPowerOfTwo', () => {
  it('padded length is a power of 2', () => {
    const padded = padToPowerOfTwo([1, 2, 3, 4, 5]);
    assert.ok(isPow2(padded.length), `length ${padded.length} is not a power of 2`);
  });

  it('original values are preserved', () => {
    const original = [3, 1, 4, 1, 5, 9];
    const padded = padToPowerOfTwo(original);
    for (let i = 0; i < original.length; i++) {
      assert.equal(padded[i], original[i]);
    }
  });

  it('padding values are zero', () => {
    const padded = padToPowerOfTwo([1, 2, 3]);
    // length should be 4; index 3 is the pad
    assert.equal(padded.length, 4);
    assert.equal(padded[3], 0);
  });

  it('already-power-of-2 input is returned at same length', () => {
    const signal = [1, 2, 3, 4];
    const padded = padToPowerOfTwo(signal);
    assert.equal(padded.length, 4);
  });

  it('single-element signal padded to length 1', () => {
    const padded = padToPowerOfTwo([7]);
    assert.equal(padded.length, 1);
    assert.equal(padded[0], 7);
  });
});

// ─── haarForward ─────────────────────────────────────────────────────────────

describe('haarForward', () => {
  it('throws RangeError for non-power-of-2 input length', () => {
    assert.throws(
      () => haarForward([1, 2, 3]),
      RangeError,
    );
  });

  it('throws RangeError for empty array', () => {
    assert.throws(
      () => haarForward([]),
      RangeError,
    );
  });

  it('haarForward([1,1,1,1]): first coefficient equals 2 (sum/scaling)', () => {
    // With the normalised Haar transform applied recursively:
    //   level 1: averages=[sqrt(2), sqrt(2)], diffs=[0,0]
    //   level 2: averages=[2],                diffs=[0]
    // So coefficients[0] === 2.
    const coeffs = haarForward([1, 1, 1, 1]);
    assert.ok(
      Math.abs(coeffs[0] - 2) < 1e-10,
      `expected coeffs[0] === 2, got ${coeffs[0]}`,
    );
  });

  it('haarForward([1,1,1,1]): all detail coefficients are 0', () => {
    const coeffs = haarForward([1, 1, 1, 1]);
    for (let i = 1; i < coeffs.length; i++) {
      assert.ok(
        Math.abs(coeffs[i]) < 1e-10,
        `expected coeffs[${i}] === 0, got ${coeffs[i]}`,
      );
    }
  });

  it('output has the same length as input', () => {
    const signal = [1, 2, 3, 4, 5, 6, 7, 8];
    assert.equal(haarForward(signal).length, signal.length);
  });

  it('does not mutate the input array', () => {
    const signal = [4, 2, 6, 8];
    const copy = signal.slice();
    haarForward(signal);
    assert.deepEqual(signal, copy);
  });
});

// ─── haarForward + haarInverse roundtrip ─────────────────────────────────────

describe('haarForward / haarInverse roundtrip', () => {
  it('reconstructs [1, 2, 3, 4] exactly', () => {
    const signal = [1, 2, 3, 4];
    assertArraysClose(haarInverse(haarForward(signal)), signal);
  });

  it('reconstructs [4, 2, 6, 8] exactly', () => {
    const signal = [4, 2, 6, 8];
    assertArraysClose(haarInverse(haarForward(signal)), signal);
  });

  it('reconstructs an 8-element signal exactly', () => {
    const signal = [3, 1, 4, 1, 5, 9, 2, 6];
    assertArraysClose(haarInverse(haarForward(signal)), signal);
  });

  it('reconstructs a 16-element signal exactly', () => {
    const signal = Array.from({ length: 16 }, (_, i) => Math.sin(i * 0.5));
    assertArraysClose(haarInverse(haarForward(signal)), signal);
  });

  it('reconstructs a constant signal', () => {
    const signal = new Array(8).fill(7);
    assertArraysClose(haarInverse(haarForward(signal)), signal);
  });
});

// ─── WaveletTransform class ───────────────────────────────────────────────────

describe('WaveletTransform', () => {
  it("constructor accepts 'haar'", () => {
    assert.doesNotThrow(() => new WaveletTransform('haar'));
  });

  it('throws for an unknown wavelet type', () => {
    assert.throws(
      // @ts-ignore — intentional invalid argument for test
      () => new WaveletTransform('daubechies'),
      Error,
    );
  });

  it('waveletType property is set correctly', () => {
    const wt = new WaveletTransform('haar');
    assert.equal(wt.waveletType, 'haar');
  });

  it('forward() delegates to haarForward', () => {
    const wt = new WaveletTransform('haar');
    const signal = [1, 2, 3, 4];
    assertArraysClose(wt.forward(signal), haarForward(signal));
  });

  it('inverse() delegates to haarInverse', () => {
    const wt = new WaveletTransform('haar');
    const coeffs = haarForward([1, 2, 3, 4]);
    assertArraysClose(wt.inverse(coeffs), haarInverse(coeffs));
  });

  it('forward + inverse roundtrip via class methods', () => {
    const wt = new WaveletTransform('haar');
    const signal = [5, 3, 8, 1, 4, 7, 2, 6];
    assertArraysClose(wt.inverse(wt.forward(signal)), signal);
  });
});

// ─── WaveletTransform.denoise ─────────────────────────────────────────────────

describe('WaveletTransform.denoise', () => {
  it('constant signal is preserved under denoising', () => {
    // A perfectly constant signal has all energy in the first coefficient;
    // detail coefficients are 0 and survive any positive threshold.
    const wt = new WaveletTransform('haar');
    const signal = new Array(8).fill(4);
    assertArraysClose(wt.denoise(signal, 0.5), signal);
  });

  it('removes a small noisy spike added to an otherwise zero signal', () => {
    // Signal: all zeros except one small value below threshold.
    // After thresholding, every coefficient is zeroed → output is all zeros.
    const wt = new WaveletTransform('haar');
    const signal = new Array(8).fill(0);
    signal[3] = 0.05; // small spike
    const denoised = wt.denoise(signal, 1.0); // high threshold removes spike
    for (const v of denoised) {
      assert.ok(Math.abs(v) < 1e-10, `expected ~0, got ${v}`);
    }
  });

  it('threshold=0 is a lossless roundtrip', () => {
    const wt = new WaveletTransform('haar');
    const signal = [1, 2, 3, 4, 5, 6, 7, 8];
    // threshold 0 keeps all coefficients (|c| >= 0 is always true, but we
    // use strict < so 0-valued coefficients are also kept).
    assertArraysClose(wt.denoise(signal, 0), signal);
  });

  it('returns array of same length as input', () => {
    const wt = new WaveletTransform('haar');
    const signal = [1, 1, 2, 2, 3, 3, 4, 4];
    assert.equal(wt.denoise(signal, 0.5).length, signal.length);
  });
});

// ─── createWaveletTransform factory ──────────────────────────────────────────

describe('createWaveletTransform', () => {
  it("returns a WaveletTransform instance for 'haar'", () => {
    const wt = createWaveletTransform('haar');
    assert.ok(wt instanceof WaveletTransform);
  });

  it('factory instance performs correct roundtrip', () => {
    const wt = createWaveletTransform('haar');
    const signal = [2, 4, 6, 8];
    assertArraysClose(wt.inverse(wt.forward(signal)), signal);
  });

  it('factory instance has waveletType property set', () => {
    const wt = createWaveletTransform('haar');
    assert.equal(wt.waveletType, 'haar');
  });
});
