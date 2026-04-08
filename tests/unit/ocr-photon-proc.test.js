// ─── Unit Tests: ocr-photon-proc ─────────────────────────────────────────────
import './setup-dom.js';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const {
  looksLikeScannedPage,
  photonEnhanceCanvas,
  warmupPhoton,
} = await import('../../app/modules/ocr-photon-proc.js');

// ─── looksLikeScannedPage ─────────────────────────────────────────────────────

describe('looksLikeScannedPage', () => {
  it('returns false for a zero-size canvas', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 0;
    canvas.height = 0;
    assert.equal(looksLikeScannedPage(canvas), false);
  });

  it('returns false for a small canvas (dx or dy < 1)', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 4;
    canvas.height = 4;
    // With SAMPLES=16, dx = floor(4/16) = 0 → returns false
    assert.equal(looksLikeScannedPage(canvas), false);
  });

  it('returns false for a uniform white canvas (low variance → vector)', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 200;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 200, 200);
    }
    // Uniform fill → variance ≈ 0 → not scanned
    assert.equal(looksLikeScannedPage(canvas), false);
  });

  it('returns a boolean', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    const result = looksLikeScannedPage(canvas);
    assert.equal(typeof result, 'boolean');
  });

  it('returns false when getContext returns null', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 200;
    // Temporarily break getContext
    const orig = canvas.getContext.bind(canvas);
    // @ts-ignore
    canvas.getContext = () => null;
    assert.equal(looksLikeScannedPage(canvas), false);
    // @ts-ignore
    canvas.getContext = orig;
  });
});

// ─── photonEnhanceCanvas ──────────────────────────────────────────────────────

describe('photonEnhanceCanvas', () => {
  it('returns the same canvas when Photon WASM is unavailable', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    // In Node.js test env, @silvia-odwyer/photon is not installed → falls back
    const result = await photonEnhanceCanvas(canvas);
    assert.ok(result === canvas || result instanceof HTMLCanvasElement,
      'Should return original canvas or a canvas element');
  });

  it('returns srcCanvas immediately for zero-width canvas', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 0;
    canvas.height = 0;
    const result = await photonEnhanceCanvas(canvas);
    assert.strictEqual(result, canvas);
  });
});

// ─── warmupPhoton ─────────────────────────────────────────────────────────────

describe('warmupPhoton', () => {
  it('does not throw when Photon WASM is unavailable', () => {
    assert.doesNotThrow(() => warmupPhoton());
  });

  it('returns undefined', () => {
    assert.equal(warmupPhoton(), undefined);
  });
});
