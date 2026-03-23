import './setup-dom.js';
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { analyseOcrFontCharacteristics, matchFontFromOcr } from '../../app/modules/scan-decomposer.js';

describe('analyseOcrFontCharacteristics', () => {
  it('returns defaults for empty OCR result', () => {
    const result = analyseOcrFontCharacteristics({ words: [] });
    assert.equal(result.isSerif, false);
    assert.equal(result.weight, 400);
    assert.equal(result.isItalic, false);
    assert.equal(result.xHeightRatio, 0.5);
    assert.equal(result.aspectRatio, 0.56);
  });

  it('returns defaults for null words', () => {
    const result = analyseOcrFontCharacteristics({});
    assert.equal(result.weight, 400);
    assert.equal(result.isItalic, false);
  });

  it('detects bold when majority of words are bold', () => {
    const words = [
      { text: 'Hello', bbox: { x0: 0, y0: 0, x1: 50, y1: 20 }, fontAttributes: { isBold: true } },
      { text: 'World', bbox: { x0: 60, y0: 0, x1: 110, y1: 20 }, fontAttributes: { isBold: true } },
      { text: 'test', bbox: { x0: 120, y0: 0, x1: 160, y1: 20 }, fontAttributes: { isBold: false } },
    ];
    const result = analyseOcrFontCharacteristics({ words });
    assert.equal(result.weight, 700);
  });

  it('detects non-bold when minority are bold', () => {
    const words = [
      { text: 'Hello', bbox: { x0: 0, y0: 0, x1: 50, y1: 20 }, fontAttributes: { isBold: false } },
      { text: 'World', bbox: { x0: 60, y0: 0, x1: 110, y1: 20 }, fontAttributes: { isBold: false } },
      { text: 'test', bbox: { x0: 120, y0: 0, x1: 160, y1: 20 }, fontAttributes: { isBold: true } },
    ];
    const result = analyseOcrFontCharacteristics({ words });
    assert.equal(result.weight, 400);
  });

  it('detects italic when majority are italic', () => {
    const words = [
      { text: 'Hello', bbox: { x0: 0, y0: 0, x1: 50, y1: 20 }, fontAttributes: { isItalic: true } },
      { text: 'World', bbox: { x0: 60, y0: 0, x1: 110, y1: 20 }, fontAttributes: { isItalic: true } },
    ];
    const result = analyseOcrFontCharacteristics({ words });
    assert.equal(result.isItalic, true);
  });

  it('detects serif fonts from fontName attributes', () => {
    const words = [
      { text: 'Hello', bbox: { x0: 0, y0: 0, x1: 50, y1: 20 }, fontAttributes: { fontName: 'TimesNewRoman' } },
      { text: 'World', bbox: { x0: 60, y0: 0, x1: 110, y1: 20 }, fontAttributes: { fontName: 'TimesRoman' } },
    ];
    const result = analyseOcrFontCharacteristics({ words });
    assert.equal(result.isSerif, true);
  });

  it('detects sans-serif from fontName attributes', () => {
    const words = [
      { text: 'Hello', bbox: { x0: 0, y0: 0, x1: 50, y1: 20 }, fontAttributes: { fontName: 'Arial' } },
      { text: 'World', bbox: { x0: 60, y0: 0, x1: 110, y1: 20 }, fontAttributes: { fontName: 'Helvetica' } },
    ];
    const result = analyseOcrFontCharacteristics({ words });
    assert.equal(result.isSerif, false);
  });

  it('computes aspect ratio from bounding boxes', () => {
    const words = [
      { text: 'MMMM', bbox: { x0: 0, y0: 0, x1: 40, y1: 20 } }, // charW=10, h=20, ratio=0.5
      { text: 'MMMM', bbox: { x0: 50, y0: 0, x1: 90, y1: 20 } }, // same
    ];
    const result = analyseOcrFontCharacteristics({ words });
    assert.equal(typeof result.aspectRatio, 'number');
    assert.ok(result.aspectRatio > 0);
    assert.ok(result.aspectRatio < 1);
  });

  it('filters out words without text or bbox', () => {
    const words = [
      { text: '', bbox: { x0: 0, y0: 0, x1: 50, y1: 20 } },
      { text: 'Valid', bbox: { x0: 60, y0: 0, x1: 110, y1: 20 } },
      { text: '  ', bbox: { x0: 120, y0: 0, x1: 170, y1: 20 } },
    ];
    const result = analyseOcrFontCharacteristics({ words });
    assert.equal(typeof result.weight, 'number');
  });
});

describe('matchFontFromOcr', () => {
  it('returns a FontMatchResult with required properties', () => {
    const result = matchFontFromOcr({ words: [] });
    assert.ok('family' in result);
    assert.ok('weight' in result);
    assert.ok('style' in result);
    assert.ok('score' in result);
    assert.ok('characteristics' in result);
  });

  it('returns normal style for non-italic text', () => {
    const words = [
      { text: 'Hello', bbox: { x0: 0, y0: 0, x1: 50, y1: 20 }, fontAttributes: { isItalic: false } },
    ];
    const result = matchFontFromOcr({ words });
    assert.equal(result.style, 'normal');
  });

  it('returns italic style for italic text', () => {
    const words = [
      { text: 'Hello', bbox: { x0: 0, y0: 0, x1: 50, y1: 20 }, fontAttributes: { isItalic: true } },
      { text: 'World', bbox: { x0: 60, y0: 0, x1: 110, y1: 20 }, fontAttributes: { isItalic: true } },
    ];
    const result = matchFontFromOcr({ words });
    assert.equal(result.style, 'italic');
  });

  it('returns a score between 0 and 1', () => {
    const result = matchFontFromOcr({ words: [] });
    assert.ok(result.score >= 0 && result.score <= 1);
  });

  it('matches serif font for serif OCR input', () => {
    const words = [
      { text: 'Hello', bbox: { x0: 0, y0: 0, x1: 50, y1: 20 }, fontAttributes: { fontName: 'TimesNewRoman' } },
      { text: 'World', bbox: { x0: 60, y0: 0, x1: 110, y1: 20 }, fontAttributes: { fontName: 'TimesRoman' } },
    ];
    const result = matchFontFromOcr({ words });
    // Should match a serif font like Times New Roman or Georgia
    assert.ok(['Times New Roman', 'Georgia', 'Courier New'].includes(result.family),
      `Expected serif font, got ${result.family}`);
  });

  it('matches bold weight for bold OCR input', () => {
    const words = [
      { text: 'Hello', bbox: { x0: 0, y0: 0, x1: 50, y1: 20 }, fontAttributes: { isBold: true } },
      { text: 'World', bbox: { x0: 60, y0: 0, x1: 110, y1: 20 }, fontAttributes: { isBold: true } },
    ];
    const result = matchFontFromOcr({ words });
    assert.equal(result.weight, 700);
  });
});
