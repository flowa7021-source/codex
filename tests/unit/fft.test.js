// ─── Unit Tests: Fast Fourier Transform ───────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  complexAdd,
  complexMul,
  complexMag,
  fft,
  ifft,
  realFft,
  fftMagnitudes,
} from '../../app/modules/fft.js';

// ─── complexAdd ───────────────────────────────────────────────────────────────

describe('complexAdd', () => {
  it('adds real parts and imaginary parts independently', () => {
    const result = complexAdd({ re: 1, im: 2 }, { re: 3, im: 4 });
    assert.equal(result.re, 4);
    assert.equal(result.im, 6);
  });

  it('identity: adding zero returns original', () => {
    const a = { re: 5, im: -3 };
    const result = complexAdd(a, { re: 0, im: 0 });
    assert.equal(result.re, a.re);
    assert.equal(result.im, a.im);
  });

  it('is commutative', () => {
    const a = { re: 1, im: 2 };
    const b = { re: -4, im: 7 };
    const ab = complexAdd(a, b);
    const ba = complexAdd(b, a);
    assert.equal(ab.re, ba.re);
    assert.equal(ab.im, ba.im);
  });

  it('works with negative components', () => {
    const result = complexAdd({ re: -1, im: -2 }, { re: -3, im: -4 });
    assert.equal(result.re, -4);
    assert.equal(result.im, -6);
  });
});

// ─── complexMul ───────────────────────────────────────────────────────────────

describe('complexMul', () => {
  it('multiplies (1+0i)*(1+0i) = 1', () => {
    const result = complexMul({ re: 1, im: 0 }, { re: 1, im: 0 });
    assert.ok(Math.abs(result.re - 1) < 1e-12);
    assert.ok(Math.abs(result.im) < 1e-12);
  });

  it('multiplies i*i = -1', () => {
    const result = complexMul({ re: 0, im: 1 }, { re: 0, im: 1 });
    assert.ok(Math.abs(result.re - (-1)) < 1e-12);
    assert.ok(Math.abs(result.im) < 1e-12);
  });

  it('multiplies (1+i)*(1-i) = 2', () => {
    const result = complexMul({ re: 1, im: 1 }, { re: 1, im: -1 });
    assert.ok(Math.abs(result.re - 2) < 1e-12);
    assert.ok(Math.abs(result.im) < 1e-12);
  });

  it('multiplies (2+3i)*(4+5i) = -7+22i', () => {
    const result = complexMul({ re: 2, im: 3 }, { re: 4, im: 5 });
    assert.ok(Math.abs(result.re - (-7)) < 1e-12);
    assert.ok(Math.abs(result.im - 22) < 1e-12);
  });

  it('identity: multiply by (1+0i) returns original', () => {
    const a = { re: 3, im: -5 };
    const result = complexMul(a, { re: 1, im: 0 });
    assert.ok(Math.abs(result.re - a.re) < 1e-12);
    assert.ok(Math.abs(result.im - a.im) < 1e-12);
  });
});

// ─── complexMag ───────────────────────────────────────────────────────────────

describe('complexMag', () => {
  it('magnitude of (1+0i) is 1', () => {
    assert.ok(Math.abs(complexMag({ re: 1, im: 0 }) - 1) < 1e-12);
  });

  it('magnitude of (0+1i) is 1', () => {
    assert.ok(Math.abs(complexMag({ re: 0, im: 1 }) - 1) < 1e-12);
  });

  it('magnitude of (3+4i) is 5', () => {
    assert.ok(Math.abs(complexMag({ re: 3, im: 4 }) - 5) < 1e-12);
  });

  it('magnitude of (0+0i) is 0', () => {
    assert.equal(complexMag({ re: 0, im: 0 }), 0);
  });

  it('magnitude is always non-negative', () => {
    for (const c of [
      { re: -1, im: 0 },
      { re: 0, im: -1 },
      { re: -3, im: -4 },
    ]) {
      assert.ok(complexMag(c) >= 0);
    }
  });

  it('magnitude of (-3+4i) is 5', () => {
    assert.ok(Math.abs(complexMag({ re: -3, im: 4 }) - 5) < 1e-12);
  });
});

// ─── fft — error handling ─────────────────────────────────────────────────────

describe('fft RangeError for invalid lengths', () => {
  it('throws RangeError for length 0', () => {
    assert.throws(() => fft([]), RangeError);
  });

  it('throws RangeError for length 3 (not a power of 2)', () => {
    assert.throws(
      () => fft([{ re: 1, im: 0 }, { re: 2, im: 0 }, { re: 3, im: 0 }]),
      RangeError,
    );
  });

  it('throws RangeError for length 5', () => {
    const input = Array.from({ length: 5 }, (_, i) => ({ re: i, im: 0 }));
    assert.throws(() => fft(input), RangeError);
  });

  it('throws RangeError for length 6', () => {
    const input = Array.from({ length: 6 }, () => ({ re: 1, im: 0 }));
    assert.throws(() => fft(input), RangeError);
  });

  it('does not throw for length 1 (2^0)', () => {
    assert.doesNotThrow(() => fft([{ re: 1, im: 0 }]));
  });

  it('does not throw for power-of-2 lengths: 2, 4, 8, 16', () => {
    for (const len of [2, 4, 8, 16]) {
      const input = Array.from({ length: len }, () => ({ re: 1, im: 0 }));
      assert.doesNotThrow(() => fft(input));
    }
  });
});

// ─── fft — DC component of constant signal ────────────────────────────────────

describe('fft DC component of constant signal', () => {
  it('fft([1,1,1,1]) has DC bin = 4, others near 0', () => {
    const input = [1, 1, 1, 1].map((v) => ({ re: v, im: 0 }));
    const out = fft(input);
    // DC bin (index 0) should equal N * value = 4
    assert.ok(Math.abs(out[0].re - 4) < 1e-9, `DC re=${out[0].re}`);
    assert.ok(Math.abs(out[0].im) < 1e-9, `DC im=${out[0].im}`);
    // All other bins should be near 0
    for (let i = 1; i < out.length; i++) {
      assert.ok(complexMag(out[i]) < 1e-9, `bin ${i} mag=${complexMag(out[i])}`);
    }
  });

  it('fft of constant-2 signal of length 8: DC = 16, rest near 0', () => {
    const n = 8;
    const value = 2;
    const input = Array.from({ length: n }, () => ({ re: value, im: 0 }));
    const out = fft(input);
    assert.ok(Math.abs(out[0].re - n * value) < 1e-9);
    assert.ok(Math.abs(out[0].im) < 1e-9);
    for (let i = 1; i < out.length; i++) {
      assert.ok(complexMag(out[i]) < 1e-9);
    }
  });
});

// ─── fft / ifft roundtrip ─────────────────────────────────────────────────────

describe('fft then ifft roundtrip', () => {
  it('roundtrip recovers original signal within 1e-9', () => {
    const original = [1, 2, 3, 4, 5, 6, 7, 8].map((v) => ({ re: v, im: 0 }));
    const recovered = ifft(fft(original));
    for (let i = 0; i < original.length; i++) {
      assert.ok(
        Math.abs(recovered[i].re - original[i].re) < 1e-9,
        `re[${i}]: expected ${original[i].re}, got ${recovered[i].re}`,
      );
      assert.ok(
        Math.abs(recovered[i].im - original[i].im) < 1e-9,
        `im[${i}]: expected ${original[i].im}, got ${recovered[i].im}`,
      );
    }
  });

  it('roundtrip works for complex-valued input', () => {
    const original = [
      { re: 1, im: -1 },
      { re: 2, im: 3 },
      { re: -1, im: 0 },
      { re: 0, im: 4 },
    ];
    const recovered = ifft(fft(original));
    for (let i = 0; i < original.length; i++) {
      assert.ok(Math.abs(recovered[i].re - original[i].re) < 1e-9);
      assert.ok(Math.abs(recovered[i].im - original[i].im) < 1e-9);
    }
  });

  it('roundtrip of length-16 signal', () => {
    const original = Array.from({ length: 16 }, (_, i) => ({
      re: Math.sin((2 * Math.PI * i) / 16),
      im: 0,
    }));
    const recovered = ifft(fft(original));
    for (let i = 0; i < original.length; i++) {
      assert.ok(Math.abs(recovered[i].re - original[i].re) < 1e-9);
      assert.ok(Math.abs(recovered[i].im - original[i].im) < 1e-9);
    }
  });

  it('ifft throws RangeError for non-power-of-2 length', () => {
    const input = Array.from({ length: 3 }, () => ({ re: 1, im: 0 }));
    assert.throws(() => ifft(input), RangeError);
  });
});

// ─── realFft ──────────────────────────────────────────────────────────────────

describe('realFft', () => {
  it('pads non-power-of-2 input to next power of 2', () => {
    // length 3 → padded to 4
    const result = realFft([1, 2, 3]);
    assert.equal(result.length, 4);
  });

  it('pads length-5 input to 8', () => {
    const result = realFft([1, 2, 3, 4, 5]);
    assert.equal(result.length, 8);
  });

  it('exact power-of-2 input is not over-padded', () => {
    const result = realFft([1, 2, 3, 4]);
    assert.equal(result.length, 4);
  });

  it('DC component of all-ones signal of length 4 is 4', () => {
    const result = realFft([1, 1, 1, 1]);
    assert.ok(Math.abs(result[0].re - 4) < 1e-9);
    assert.ok(Math.abs(result[0].im) < 1e-9);
  });

  it('all output imaginary parts of zero-padded signal are finite', () => {
    const result = realFft([1, 2, 3, 4, 5, 6, 7]);
    for (const c of result) {
      assert.ok(Number.isFinite(c.re));
      assert.ok(Number.isFinite(c.im));
    }
  });

  it('empty signal returns length-1 output (next power of 2 of 0 is 1)', () => {
    // nextPowerOfTwo(0) → 1, single DC bin of 0
    const result = realFft([]);
    assert.equal(result.length, 1);
    assert.ok(Math.abs(result[0].re) < 1e-12);
  });
});

// ─── fftMagnitudes ────────────────────────────────────────────────────────────

describe('fftMagnitudes', () => {
  it('returns N/2 + 1 values for power-of-2 input of length 4', () => {
    const mags = fftMagnitudes([1, 0, 1, 0]);
    // FFT length = 4, so N/2+1 = 3
    assert.equal(mags.length, 3);
  });

  it('returns N/2 + 1 values for non-power-of-2 input of length 5 (padded to 8)', () => {
    const mags = fftMagnitudes([1, 2, 3, 4, 5]);
    // FFT length = 8, so N/2+1 = 5
    assert.equal(mags.length, 5);
  });

  it('all magnitudes are non-negative', () => {
    const mags = fftMagnitudes([1, -1, 1, -1, 1, -1, 1, -1]);
    for (const m of mags) {
      assert.ok(m >= 0, `magnitude ${m} is negative`);
    }
  });

  it('all magnitudes are finite', () => {
    const mags = fftMagnitudes([3, 1, 4, 1, 5, 9, 2, 6]);
    for (const m of mags) {
      assert.ok(Number.isFinite(m));
    }
  });

  it('DC peak: [1,1,1,1] has DC magnitude of 4', () => {
    const mags = fftMagnitudes([1, 1, 1, 1]);
    // mags[0] is the DC bin; DC magnitude = N * value = 4 * 1 = 4
    assert.ok(Math.abs(mags[0] - 4) < 1e-9, `DC magnitude = ${mags[0]}`);
  });

  it('DC is the largest bin for a constant signal', () => {
    const mags = fftMagnitudes([2, 2, 2, 2, 2, 2, 2, 2]);
    const maxMag = Math.max(...mags);
    assert.ok(Math.abs(mags[0] - maxMag) < 1e-9);
  });
});
