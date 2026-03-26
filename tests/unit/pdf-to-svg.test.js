import './setup-dom.js';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// We test pdf-to-svg directly since it takes a pdfDoc mock, not raw bytes.
const { convertPdfPageToSvg } = await import('../../app/modules/pdf-to-svg.js');

// Mock PDF.js page and document
const mockTextContent = {
  items: [
    { str: 'Hello World', fontName: 'Helvetica', width: 80, transform: [1, 0, 0, 14, 72, 700] },
    { str: 'Line Two', fontName: 'Helvetica-Bold', width: 60, transform: [1, 0, 0, 12, 72, 680] },
    { str: '', fontName: '', width: 0, transform: [1, 0, 0, 12, 0, 0] }, // empty, should be skipped
  ],
};

const mockPage = {
  getViewport: () => ({ width: 612, height: 792 }),
  getTextContent: async () => mockTextContent,
  cleanup: () => {},
};

const mockPdfDoc = {
  getPage: async (/** @type {number} */ _num) => mockPage,
};

describe('pdf-to-svg', () => {
  it('convertPdfPageToSvg is a function', () => {
    assert.equal(typeof convertPdfPageToSvg, 'function');
  });

  it('output starts with <svg', async () => {
    const svg = await convertPdfPageToSvg(mockPdfDoc, 1);
    assert.ok(svg.startsWith('<svg'));
  });

  it('output ends with </svg>', async () => {
    const svg = await convertPdfPageToSvg(mockPdfDoc, 1);
    assert.ok(svg.trimEnd().endsWith('</svg>'));
  });

  it('output contains viewBox matching page dimensions', async () => {
    const svg = await convertPdfPageToSvg(mockPdfDoc, 1);
    assert.ok(svg.includes('viewBox="0 0 612 792"'));
  });

  it('output contains <text> elements for non-empty text items', async () => {
    const svg = await convertPdfPageToSvg(mockPdfDoc, 1);
    assert.ok(svg.includes('<text'));
    assert.ok(svg.includes('Hello World'));
    assert.ok(svg.includes('Line Two'));
  });

  it('output contains a white background rect', async () => {
    const svg = await convertPdfPageToSvg(mockPdfDoc, 1);
    assert.ok(svg.includes('<rect'));
    assert.ok(svg.includes('fill="white"'));
  });

  it('flips Y coordinates (PDF bottom-left to SVG top-left)', async () => {
    const svg = await convertPdfPageToSvg(mockPdfDoc, 1);
    // "Hello World" has transform Y=700, page height=792
    // SVG y = 792 - 700 = 92
    assert.ok(svg.includes('y="92.00"'));
  });

  it('includes font-weight bold for bold font names', async () => {
    const svg = await convertPdfPageToSvg(mockPdfDoc, 1);
    assert.ok(svg.includes('font-weight: bold'));
  });

  it('does not include empty text items', async () => {
    const svg = await convertPdfPageToSvg(mockPdfDoc, 1);
    // Count <text> elements — should be exactly 2 (not 3)
    const textCount = (svg.match(/<text /g) || []).length;
    assert.equal(textCount, 2);
  });

  it('escapes XML special characters in text', async () => {
    const specialPage = {
      getViewport: () => ({ width: 100, height: 100 }),
      getTextContent: async () => ({
        items: [{ str: '<script>&"test"</script>', fontName: 'Arial', width: 50, transform: [1, 0, 0, 12, 10, 50] }],
      }),
      cleanup: () => {},
    };
    const specialDoc = { getPage: async () => specialPage };

    const svg = await convertPdfPageToSvg(specialDoc, 1);
    assert.ok(svg.includes('&lt;script&gt;'));
    assert.ok(svg.includes('&amp;'));
    assert.ok(!svg.includes('<script>'));
  });
});
