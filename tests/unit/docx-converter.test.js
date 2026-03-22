// ─── Unit Tests: DocxConverter / DocxStructureDetector ────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// We test the re-exported structure detector helpers that don't require
// the heavy 'docx' library (which is lazily loaded). The main convertPdfToDocx
// function requires a real pdfDoc object and the docx library, so we focus on
// the pure functions that are exported for unit testing.
import {
  mapPdfFont,
  isBoldFont,
  isItalicFont,
  isMonospaceFont,
} from '../../app/modules/docx-converter.js';

// ── mapPdfFont ───────────────────────────────────────────────────────────────

describe('mapPdfFont', () => {
  it('maps Helvetica to Arial', () => {
    assert.equal(mapPdfFont('Helvetica'), 'Arial');
  });

  it('maps Times-Roman to Times New Roman', () => {
    assert.equal(mapPdfFont('Times-Roman'), 'Times New Roman');
  });

  it('maps Courier to Courier New', () => {
    assert.equal(mapPdfFont('Courier'), 'Courier New');
  });

  it('maps ArialMT to Arial', () => {
    assert.equal(mapPdfFont('ArialMT'), 'Arial');
  });

  it('maps TimesNewRomanPSMT to Times New Roman', () => {
    assert.equal(mapPdfFont('TimesNewRomanPSMT'), 'Times New Roman');
  });

  it('strips Bold suffix when mapping', () => {
    const mapped = mapPdfFont('Helvetica-Bold');
    // Should map to Arial (base font of Helvetica)
    assert.equal(mapped, 'Arial');
  });

  it('strips Italic suffix when mapping', () => {
    const mapped = mapPdfFont('Helvetica-Oblique');
    assert.equal(mapped, 'Arial');
  });

  it('returns Arial for empty/null input', () => {
    assert.equal(mapPdfFont(''), 'Arial');
    assert.equal(mapPdfFont(null), 'Arial');
    assert.equal(mapPdfFont(undefined), 'Arial');
  });

  it('returns input-based mapping for unknown fonts', () => {
    // Unknown fonts fall through to heuristic matching
    const result = mapPdfFont('MyCustomFont-Regular');
    assert.ok(typeof result === 'string');
    assert.ok(result.length > 0);
  });
});

// ── isBoldFont ───────────────────────────────────────────────────────────────

describe('isBoldFont', () => {
  it('detects Bold in font name', () => {
    assert.equal(isBoldFont('Helvetica-Bold'), true);
    assert.equal(isBoldFont('ArialBold'), true);
  });

  it('detects Black weight', () => {
    assert.equal(isBoldFont('Arial-Black'), true);
  });

  it('detects Heavy weight', () => {
    assert.equal(isBoldFont('FontHeavy'), true);
  });

  it('returns false for regular fonts', () => {
    assert.equal(isBoldFont('Helvetica'), false);
    assert.equal(isBoldFont('Arial'), false);
    assert.equal(isBoldFont('Times-Roman'), false);
  });

  it('handles empty/null input', () => {
    assert.equal(isBoldFont(''), false);
    assert.equal(isBoldFont(null), false);
    assert.equal(isBoldFont(undefined), false);
  });
});

// ── isItalicFont ─────────────────────────────────────────────────────────────

describe('isItalicFont', () => {
  it('detects Italic in font name', () => {
    assert.equal(isItalicFont('Times-Italic'), true);
    assert.equal(isItalicFont('ArialItalic'), true);
  });

  it('detects Oblique in font name', () => {
    assert.equal(isItalicFont('Helvetica-Oblique'), true);
  });

  it('returns false for non-italic fonts', () => {
    assert.equal(isItalicFont('Helvetica'), false);
    assert.equal(isItalicFont('Times-Bold'), false);
  });

  it('handles empty/null input', () => {
    assert.equal(isItalicFont(''), false);
    assert.equal(isItalicFont(null), false);
  });
});

// ── isMonospaceFont ──────────────────────────────────────────────────────────

describe('isMonospaceFont', () => {
  it('detects Courier', () => {
    assert.equal(isMonospaceFont('Courier'), true);
    assert.equal(isMonospaceFont('Courier-Bold'), true);
    assert.equal(isMonospaceFont('CourierNewPSMT'), true);
  });

  it('detects Consolas', () => {
    assert.equal(isMonospaceFont('Consolas'), true);
  });

  it('detects monospace keyword', () => {
    assert.equal(isMonospaceFont('SomeMonospaceFont'), true);
  });

  it('detects fixed keyword', () => {
    assert.equal(isMonospaceFont('FixedSys'), true);
  });

  it('returns false for proportional fonts', () => {
    assert.equal(isMonospaceFont('Arial'), false);
    assert.equal(isMonospaceFont('Times-Roman'), false);
    assert.equal(isMonospaceFont('Helvetica'), false);
  });

  it('handles empty/null input', () => {
    assert.equal(isMonospaceFont(''), false);
    assert.equal(isMonospaceFont(null), false);
  });
});
