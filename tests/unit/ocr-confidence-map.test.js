import './setup-dom.js';
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { renderConfidenceOverlay, clearConfidenceOverlay } from '../../app/modules/ocr-confidence-map.js';
import { state } from '../../app/modules/state.js';

describe('renderConfidenceOverlay', () => {
  beforeEach(() => {
    state.ocrConfidenceMode = true;
  });

  it('does nothing when canvas is null', () => {
    // Should not throw
    renderConfidenceOverlay([{ text: 'a', bbox: { x0: 0, y0: 0, x1: 0.5, y1: 0.5 }, confidence: 95 }], null, 100, 100);
  });

  it('does nothing when words is null or empty', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    renderConfidenceOverlay(null, canvas, 100, 100);
    renderConfidenceOverlay([], canvas, 100, 100);
  });

  it('does nothing when ocrConfidenceMode is false', () => {
    state.ocrConfidenceMode = false;
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    const words = [{ text: 'hello', bbox: { x0: 0, y0: 0, x1: 0.5, y1: 0.1 }, confidence: 95 }];
    // Should not throw
    renderConfidenceOverlay(words, canvas, 100, 100);
  });

  it('skips words with null confidence', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    const words = [{ text: 'hello', bbox: { x0: 0, y0: 0, x1: 0.5, y1: 0.1 }, confidence: null }];
    renderConfidenceOverlay(words, canvas, 100, 100);
    // No assertion needed — just verifying no crash
  });

  it('skips words with no bbox', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    const words = [{ text: 'hello', bbox: null, confidence: 80 }];
    renderConfidenceOverlay(words, canvas, 100, 100);
  });

  it('skips words with out-of-range coordinates', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    const words = [{ text: 'hello', bbox: { x0: -0.1, y0: 0, x1: 0.5, y1: 0.1 }, confidence: 80 }];
    renderConfidenceOverlay(words, canvas, 100, 100);
  });

  it('processes valid words without error', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 200;
    const words = [
      { text: 'hi', bbox: { x0: 0, y0: 0, x1: 0.5, y1: 0.1 }, confidence: 95 },
      { text: 'med', bbox: { x0: 0, y0: 0.2, x1: 0.3, y1: 0.3 }, confidence: 75 },
      { text: 'low', bbox: { x0: 0, y0: 0.4, x1: 0.4, y1: 0.5 }, confidence: 50 },
    ];
    renderConfidenceOverlay(words, canvas, 200, 200);
  });
});

describe('clearConfidenceOverlay', () => {
  it('does nothing when canvas is null', () => {
    clearConfidenceOverlay(null);
  });

  it('clears the canvas without error', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    clearConfidenceOverlay(canvas);
  });
});
