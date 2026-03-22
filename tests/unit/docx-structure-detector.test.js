// ─── Unit Tests: DocxStructureDetector ───────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  mapPdfFont,
  isBoldFont,
  isItalicFont,
  isMonospaceFont,
  isUnderlineFont,
  isStrikethroughFont,
} from '../../app/modules/docx-structure-detector.js';

// ── mapPdfFont ──────────────────────────────────────────────────────────────

describe('mapPdfFont', () => {
  it('maps Times-Roman to Times New Roman', () => {
    assert.equal(mapPdfFont('Times-Roman'), 'Times New Roman');
  });

  it('maps Times-Bold to Times New Roman', () => {
    assert.equal(mapPdfFont('Times-Bold'), 'Times New Roman');
  });

  it('maps Times-BoldItalic to Times New Roman', () => {
    assert.equal(mapPdfFont('Times-BoldItalic'), 'Times New Roman');
  });

  it('maps TimesNewRomanPSMT to Times New Roman', () => {
    assert.equal(mapPdfFont('TimesNewRomanPSMT'), 'Times New Roman');
  });

  it('maps Helvetica to Arial', () => {
    assert.equal(mapPdfFont('Helvetica'), 'Arial');
  });

  it('maps Helvetica-Bold to Arial', () => {
    assert.equal(mapPdfFont('Helvetica-Bold'), 'Arial');
  });

  it('maps ArialMT to Arial', () => {
    assert.equal(mapPdfFont('ArialMT'), 'Arial');
  });

  it('maps Courier to Courier New', () => {
    assert.equal(mapPdfFont('Courier'), 'Courier New');
  });

  it('maps CourierNewPSMT to Courier New', () => {
    assert.equal(mapPdfFont('CourierNewPSMT'), 'Courier New');
  });

  it('maps Symbol to Symbol', () => {
    assert.equal(mapPdfFont('Symbol'), 'Symbol');
  });

  it('maps ZapfDingbats to Wingdings', () => {
    assert.equal(mapPdfFont('ZapfDingbats'), 'Wingdings');
  });

  it('maps Tahoma to Tahoma', () => {
    assert.equal(mapPdfFont('Tahoma'), 'Tahoma');
  });

  it('maps Garamond to Garamond', () => {
    assert.equal(mapPdfFont('Garamond'), 'Garamond');
  });

  it('maps Consolas to Consolas', () => {
    assert.equal(mapPdfFont('Consolas'), 'Consolas');
  });

  it('returns Arial for null/undefined', () => {
    assert.equal(mapPdfFont(null), 'Arial');
    assert.equal(mapPdfFont(undefined), 'Arial');
  });

  it('returns Arial for unknown fonts', () => {
    assert.equal(mapPdfFont('SomeRandomFont'), 'Arial');
  });

  it('maps fonts with pattern matching (times variant)', () => {
    assert.equal(mapPdfFont('TimesNewRomanCustom'), 'Times New Roman');
  });

  it('maps fonts with pattern matching (courier variant)', () => {
    assert.equal(mapPdfFont('CourierStd-Bold'), 'Courier New');
  });

  it('maps Georgia via pattern matching', () => {
    assert.equal(mapPdfFont('Georgia-Bold'), 'Georgia');
  });

  it('maps Verdana via pattern matching', () => {
    assert.equal(mapPdfFont('Verdana-Italic'), 'Verdana');
  });

  it('maps Calibri via pattern matching', () => {
    assert.equal(mapPdfFont('Calibri-Light'), 'Calibri');
  });

  it('maps Cambria via pattern matching', () => {
    assert.equal(mapPdfFont('Cambria-Regular'), 'Cambria');
  });

  it('maps Segoe via pattern matching', () => {
    assert.equal(mapPdfFont('SegoeUI-Bold'), 'Segoe UI');
  });

  it('maps Century Gothic', () => {
    assert.equal(mapPdfFont('CenturyGothic'), 'Century Gothic');
  });
});

// ── isBoldFont ──────────────────────────────────────────────────────────────

describe('isBoldFont', () => {
  it('detects Bold in font name', () => {
    assert.equal(isBoldFont('Arial-Bold'), true);
  });

  it('detects Black weight', () => {
    assert.equal(isBoldFont('Arial-Black'), true);
  });

  it('detects Heavy weight', () => {
    assert.equal(isBoldFont('Helvetica-Heavy'), true);
  });

  it('detects Demi weight', () => {
    assert.equal(isBoldFont('SomeFont-DemiBold'), true);
  });

  it('returns false for regular font', () => {
    assert.equal(isBoldFont('Arial'), false);
  });

  it('returns false for italic-only font', () => {
    assert.equal(isBoldFont('Arial-Italic'), false);
  });

  it('returns false for null/empty', () => {
    assert.equal(isBoldFont(null), false);
    assert.equal(isBoldFont(''), false);
  });
});

// ── isItalicFont ────────────────────────────────────────────────────────────

describe('isItalicFont', () => {
  it('detects Italic in font name', () => {
    assert.equal(isItalicFont('Arial-Italic'), true);
  });

  it('detects Oblique in font name', () => {
    assert.equal(isItalicFont('Helvetica-Oblique'), true);
  });

  it('detects Slant in font name', () => {
    assert.equal(isItalicFont('SomeFont-Slant'), true);
  });

  it('returns false for regular font', () => {
    assert.equal(isItalicFont('Arial'), false);
  });

  it('returns false for bold-only font', () => {
    assert.equal(isItalicFont('Arial-Bold'), false);
  });

  it('returns false for null/empty', () => {
    assert.equal(isItalicFont(null), false);
    assert.equal(isItalicFont(''), false);
  });
});

// ── isMonospaceFont ─────────────────────────────────────────────────────────

describe('isMonospaceFont', () => {
  it('detects Courier', () => {
    assert.equal(isMonospaceFont('Courier'), true);
  });

  it('detects fonts with mono keyword', () => {
    assert.equal(isMonospaceFont('DejaVuSansMono'), true);
  });

  it('detects Consolas', () => {
    assert.equal(isMonospaceFont('Consolas'), true);
  });

  it('detects fonts with fixed keyword', () => {
    assert.equal(isMonospaceFont('FixedSys'), true);
  });

  it('returns false for proportional font', () => {
    assert.equal(isMonospaceFont('Arial'), false);
  });

  it('returns false for null/empty', () => {
    assert.equal(isMonospaceFont(null), false);
    assert.equal(isMonospaceFont(''), false);
  });
});

// ── isUnderlineFont ─────────────────────────────────────────────────────────

describe('isUnderlineFont', () => {
  it('detects underline in font name', () => {
    assert.equal(isUnderlineFont('SomeFont-Underline'), true);
  });

  it('returns false for regular font', () => {
    assert.equal(isUnderlineFont('Arial'), false);
  });

  it('returns false for null/empty', () => {
    assert.equal(isUnderlineFont(null), false);
    assert.equal(isUnderlineFont(''), false);
  });
});

// ── isStrikethroughFont ─────────────────────────────────────────────────────

describe('isStrikethroughFont', () => {
  it('detects strikethrough in font name', () => {
    assert.equal(isStrikethroughFont('SomeFont-Strikethrough'), true);
  });

  it('detects strikeout in font name', () => {
    assert.equal(isStrikethroughFont('SomeFont-Strikeout'), true);
  });

  it('detects strike in font name', () => {
    assert.equal(isStrikethroughFont('SomeFont-Strike'), true);
  });

  it('returns false for regular font', () => {
    assert.equal(isStrikethroughFont('Arial'), false);
  });

  it('returns false for null/empty', () => {
    assert.equal(isStrikethroughFont(null), false);
    assert.equal(isStrikethroughFont(''), false);
  });
});
