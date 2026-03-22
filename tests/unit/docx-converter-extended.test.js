// ─── Extended Unit Tests: DocxConverter / DocxStructureDetector ──────────────
// Tests exports beyond mapPdfFont/isBoldFont/isItalicFont/isMonospaceFont
// which are covered in docx-converter.test.js.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  isUnderlineFont,
  isStrikethroughFont,
} from '../../app/modules/docx-structure-detector.js';

// ── isUnderlineFont ─────────────────────────────────────────────────────────

describe('isUnderlineFont', () => {
  it('detects Underline in font name', () => {
    assert.equal(isUnderlineFont('Arial-Underline'), true);
    assert.equal(isUnderlineFont('TimesUnderline'), true);
  });

  it('is case-insensitive', () => {
    assert.equal(isUnderlineFont('UNDERLINE'), true);
    assert.equal(isUnderlineFont('underline'), true);
  });

  it('returns false for regular fonts', () => {
    assert.equal(isUnderlineFont('Arial'), false);
    assert.equal(isUnderlineFont('Helvetica-Bold'), false);
    assert.equal(isUnderlineFont('Courier'), false);
  });

  it('handles empty/null/undefined input', () => {
    assert.equal(isUnderlineFont(''), false);
    assert.equal(isUnderlineFont(null), false);
    assert.equal(isUnderlineFont(undefined), false);
  });
});

// ── isStrikethroughFont ─────────────────────────────────────────────────────

describe('isStrikethroughFont', () => {
  it('detects Strikethrough in font name', () => {
    assert.equal(isStrikethroughFont('Arial-Strikethrough'), true);
  });

  it('detects Strikeout in font name', () => {
    assert.equal(isStrikethroughFont('FontStrikeout'), true);
  });

  it('detects Strike in font name', () => {
    assert.equal(isStrikethroughFont('MyStrikeFont'), true);
  });

  it('is case-insensitive', () => {
    assert.equal(isStrikethroughFont('STRIKETHROUGH'), true);
    assert.equal(isStrikethroughFont('strikeout'), true);
  });

  it('returns false for regular fonts', () => {
    assert.equal(isStrikethroughFont('Arial'), false);
    assert.equal(isStrikethroughFont('Helvetica'), false);
    assert.equal(isStrikethroughFont('Times-Roman'), false);
  });

  it('handles empty/null/undefined input', () => {
    assert.equal(isStrikethroughFont(''), false);
    assert.equal(isStrikethroughFont(null), false);
    assert.equal(isStrikethroughFont(undefined), false);
  });
});

// ── convertPdfToDocx is async and requires the 'docx' library ───────────────
// We test that the export exists and is a function.

describe('convertPdfToDocx export', () => {
  it('is exported as an async function', async () => {
    const mod = await import('../../app/modules/docx-converter.js');
    assert.equal(typeof mod.convertPdfToDocx, 'function');
  });

  it('re-exports mapPdfFont from structure detector', async () => {
    const mod = await import('../../app/modules/docx-converter.js');
    assert.equal(typeof mod.mapPdfFont, 'function');
    assert.equal(mod.mapPdfFont('Helvetica'), 'Arial');
  });

  it('re-exports isBoldFont from structure detector', async () => {
    const mod = await import('../../app/modules/docx-converter.js');
    assert.equal(typeof mod.isBoldFont, 'function');
  });

  it('re-exports isItalicFont from structure detector', async () => {
    const mod = await import('../../app/modules/docx-converter.js');
    assert.equal(typeof mod.isItalicFont, 'function');
  });

  it('re-exports isMonospaceFont from structure detector', async () => {
    const mod = await import('../../app/modules/docx-converter.js');
    assert.equal(typeof mod.isMonospaceFont, 'function');
  });
});
