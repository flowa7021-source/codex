import './setup-dom.js';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { postCorrectText, estimateImageDpi, detectSkewAngle, deskewCanvas, preprocessCanvas } from '../../app/modules/ocr-char-layer.js';

describe('postCorrectText', () => {
  it('returns empty string for null/undefined', () => {
    assert.equal(postCorrectText(null), '');
    assert.equal(postCorrectText(undefined), '');
    assert.equal(postCorrectText(''), '');
  });

  it('collapses multiple spaces', () => {
    assert.equal(postCorrectText('hello   world'), 'hello world');
  });

  it('replaces soft hyphens with regular hyphens', () => {
    assert.equal(postCorrectText('hello\u00ADworld'), 'hello-world');
  });

  it('normalizes guillemets to straight quotes', () => {
    // \u00AB = « and \u00BB = » are in the COMMON_FIXES double-quote pattern
    assert.equal(postCorrectText('\u00ABHello\u00BB'), '"Hello"');
  });

  it('removes space before punctuation', () => {
    assert.equal(postCorrectText('Hello , world .'), 'Hello, world.');
  });

  it('removes space inside parentheses', () => {
    assert.equal(postCorrectText('( hello )'), '(hello)');
  });

  it('rejoins hyphenated words across lines', () => {
    assert.equal(postCorrectText('hyphen-\nated'), 'hyphenated');
  });

  it('restores ligatures', () => {
    assert.equal(postCorrectText('ﬁnd ﬂow oﬀer'), 'find flow offer');
    assert.equal(postCorrectText('ﬃx ﬄ ﬅ'), 'ffix ffl st');
  });

  it('normalizes backtick and modifier apostrophe', () => {
    // Backtick (U+0060) and modifier letter apostrophe (U+02BC) are in the regex
    assert.equal(postCorrectText('\u0060test\u02BC'), "'test'");
  });

  it('trims whitespace', () => {
    assert.equal(postCorrectText('  hello  '), 'hello');
  });
});

describe('estimateImageDpi', () => {
  it('computes DPI from canvas width and physical width in mm', () => {
    const canvas = { width: 2550, height: 3300 };
    // 2550 pixels / (215.9mm / 25.4mm/in) = 2550 / 8.5 = 300 DPI
    const dpi = estimateImageDpi(canvas, 215.9);
    assert.ok(Math.abs(dpi - 300) < 1);
  });

  it('returns higher DPI for wider pixel canvas', () => {
    const lo = { width: 1000, height: 1000 };
    const hi = { width: 2000, height: 1000 };
    assert.ok(estimateImageDpi(hi, 210) > estimateImageDpi(lo, 210));
  });
});

describe('detectSkewAngle', () => {
  it('returns 0 when context is null', () => {
    const canvas = { width: 100, height: 100, getContext: () => null };
    assert.equal(detectSkewAngle(canvas), 0);
  });
});

describe('deskewCanvas', () => {
  it('returns a canvas with same dimensions', () => {
    const src = document.createElement('canvas');
    src.width = 50;
    src.height = 50;
    const result = deskewCanvas(src, 2);
    assert.equal(result.width, 50);
    assert.equal(result.height, 50);
  });
});

describe('preprocessCanvas', () => {
  it('returns a canvas with same dimensions as source', () => {
    const src = document.createElement('canvas');
    src.width = 40;
    src.height = 30;
    const result = preprocessCanvas(src);
    assert.equal(result.width, 40);
    assert.equal(result.height, 30);
  });

  it('respects denoise=false, normalise=false (returns early copy)', () => {
    const src = document.createElement('canvas');
    src.width = 20;
    src.height = 20;
    const result = preprocessCanvas(src, { denoise: false, normalise: false });
    assert.equal(result.width, 20);
    assert.equal(result.height, 20);
  });
});
