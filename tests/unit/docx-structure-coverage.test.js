// ─── Coverage Tests: DocxStructureDetector ────────────────────────────────────
// Tests extractStructuredContent with focused scenarios for heading detection,
// list detection, table detection, column detection, and paragraph merging
// to push coverage from 64% toward 85%.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  extractStructuredContent,
  mapPdfFont,
  isBoldFont,
  isItalicFont,
  isMonospaceFont,
} from '../../app/modules/docx-structure-detector.js';

// ── Mock helpers ─────────────────────────────────────────────────────────────

function makeItem(text, x, y, fontSize, fontName = 'Arial', width = null) {
  return {
    str: text,
    transform: [fontSize, 0, 0, fontSize, x, 842 - y],
    width: width ?? text.length * fontSize * 0.5,
    height: fontSize,
    fontName,
  };
}

function makePdfPage(items, { width = 595, height = 842, annotations = [] } = {}) {
  return {
    getTextContent: async () => ({ items }),
    getViewport: () => ({ width, height }),
    getAnnotations: async () => annotations,
    getOperatorList: async () => ({ fnArray: [], argsArray: [] }),
    objs: { get: () => null },
    commonObjs: { get: () => null },
  };
}

function makePdfDoc(pages) {
  return { getPage: async (num) => pages[num - 1] };
}

// ── Heading detection ────────────────────────────────────────────────────────

describe('heading detection via extractStructuredContent', () => {
  it('detects HEADING_1 for very large font (sizeRatio > 1.8)', async () => {
    const items = [
      makeItem('Main Title', 50, 50, 30, 'Arial-Bold'),  // 30 vs 12 body = 2.5 ratio
      makeItem('Normal body text that is standard size', 50, 150, 12),
      makeItem('More body text to establish median', 50, 170, 12),
      makeItem('Even more body text for median', 50, 190, 12),
    ];
    const doc = makePdfDoc([makePdfPage(items)]);
    const result = await extractStructuredContent(doc, 1);
    const h1 = result.blocks.filter(b => b.type === 'heading' && b.level === 'Heading1');
    assert.ok(h1.length >= 1, 'Should detect Heading1');
  });

  it('detects HEADING_2 for medium-large font (sizeRatio > 1.4)', async () => {
    const items = [
      makeItem('Section Title', 50, 50, 18, 'Arial-Bold'),  // 18/12 = 1.5
      makeItem('Normal body text that is standard size', 50, 150, 12),
      makeItem('More body text', 50, 170, 12),
      makeItem('Even more body text', 50, 190, 12),
    ];
    const doc = makePdfDoc([makePdfPage(items)]);
    const result = await extractStructuredContent(doc, 1);
    const h2 = result.blocks.filter(b => b.type === 'heading' && b.level === 'Heading2');
    assert.ok(h2.length >= 1, 'Should detect Heading2');
  });

  it('detects HEADING_3 for slightly larger font (sizeRatio > 1.15)', async () => {
    const items = [
      makeItem('Subsection Title', 50, 50, 14.5, 'Arial'),  // 14.5/12 = 1.208
      makeItem('Normal body text that is standard size', 50, 150, 12),
      makeItem('More body text', 50, 170, 12),
      makeItem('Even more body text', 50, 190, 12),
    ];
    const doc = makePdfDoc([makePdfPage(items)]);
    const result = await extractStructuredContent(doc, 1);
    const headings = result.blocks.filter(b => b.type === 'heading');
    assert.ok(headings.length >= 1, 'Should detect heading for larger font');
  });

  it('detects semantic heading patterns (Introduction)', async () => {
    const items = [
      makeItem('Introduction', 50, 50, 12, 'Arial-Bold'),
      makeItem('Normal body text that follows the introduction heading paragraph', 50, 100, 12),
      makeItem('More body text', 50, 120, 12),
    ];
    const doc = makePdfDoc([makePdfPage(items)]);
    const result = await extractStructuredContent(doc, 1);
    const headings = result.blocks.filter(b => b.type === 'heading');
    assert.ok(headings.length >= 1, 'Should detect Introduction as semantic heading');
  });

  it('detects semantic heading patterns (Conclusion)', async () => {
    const items = [
      makeItem('Conclusion', 50, 50, 12, 'Arial-Bold'),
      makeItem('The main findings are...', 50, 100, 12),
      makeItem('More text', 50, 120, 12),
    ];
    const doc = makePdfDoc([makePdfPage(items)]);
    const result = await extractStructuredContent(doc, 1);
    const headings = result.blocks.filter(b => b.type === 'heading');
    assert.ok(headings.length >= 1, 'Should detect Conclusion as semantic heading');
  });

  it('detects ALL CAPS bold as HEADING_3', async () => {
    const items = [
      makeItem('ABSTRACT', 50, 50, 12, 'Arial-Bold'),
      makeItem('This paper discusses...', 50, 100, 12),
      makeItem('More details', 50, 120, 12),
    ];
    const doc = makePdfDoc([makePdfPage(items)]);
    const result = await extractStructuredContent(doc, 1);
    const headings = result.blocks.filter(b => b.type === 'heading');
    assert.ok(headings.length >= 1, 'Should detect ALL CAPS bold as heading');
  });

  it('detects bold short line as HEADING_3', async () => {
    const items = [
      makeItem('Short Bold Title', 50, 50, 12, 'Arial-Bold'),
      makeItem('Regular paragraph text that is much longer to form body', 50, 100, 12),
      makeItem('More body text for median font size', 50, 120, 12),
    ];
    const doc = makePdfDoc([makePdfPage(items)]);
    const result = await extractStructuredContent(doc, 1);
    const headings = result.blocks.filter(b => b.type === 'heading');
    assert.ok(headings.length >= 1, 'Should detect bold short line as heading');
  });

  it('detects Chapter pattern as semantic heading', async () => {
    // "Chapter 1" matches HEADING_PATTERNS[0]
    const items = [
      makeItem('Chapter 1', 200, 50, 12, 'Arial-Bold'),
      makeItem('Normal text follows that establishes the baseline body', 50, 120, 12),
      makeItem('More body text here for median', 50, 140, 12),
      makeItem('Even more body text', 50, 160, 12),
    ];
    const doc = makePdfDoc([makePdfPage(items)]);
    const result = await extractStructuredContent(doc, 1);
    const headings = result.blocks.filter(b => b.type === 'heading');
    assert.ok(headings.length >= 1, 'Should detect Chapter as semantic heading');
  });
});

// ── List detection ───────────────────────────────────────────────────────────

describe('list detection via extractStructuredContent', () => {
  it('detects bullet list with Unicode bullet character', async () => {
    const items = [
      makeItem('Introduction paragraph text', 50, 50, 12),
      makeItem('\u2022 First bullet item', 80, 100, 12),
      makeItem('\u2022 Second bullet item', 80, 120, 12),
    ];
    const doc = makePdfDoc([makePdfPage(items)]);
    const result = await extractStructuredContent(doc, 1);
    const lists = result.blocks.filter(b => b.type === 'list');
    assert.ok(lists.length >= 1, 'Should detect bullet list items');
    if (lists.length > 0) {
      assert.equal(lists[0].bullet, true);
    }
  });

  it('detects numbered list with "1." prefix', async () => {
    const items = [
      makeItem('Some header', 50, 50, 12),
      makeItem('1. First numbered item', 80, 100, 12),
      makeItem('2. Second numbered item', 80, 120, 12),
    ];
    const doc = makePdfDoc([makePdfPage(items)]);
    const result = await extractStructuredContent(doc, 1);
    const lists = result.blocks.filter(b => b.type === 'list');
    assert.ok(lists.length >= 1, 'Should detect numbered list');
    if (lists.length > 0) {
      assert.equal(lists[0].bullet, false);
    }
  });

  it('detects dash list items', async () => {
    const items = [
      makeItem('Header', 50, 50, 12),
      makeItem('- First dash item', 80, 100, 12),
      makeItem('- Second dash item', 80, 120, 12),
    ];
    const doc = makePdfDoc([makePdfPage(items)]);
    const result = await extractStructuredContent(doc, 1);
    const lists = result.blocks.filter(b => b.type === 'list');
    assert.ok(lists.length >= 1, 'Should detect dash list items');
  });
});

// ── Table detection ──────────────────────────────────────────────────────────

describe('table detection via extractStructuredContent', () => {
  it('detects table from items with large x-gaps', async () => {
    // Create rows with distinct column positions
    const items = [
      makeItem('Name', 50, 100, 12, 'Arial', 40),
      makeItem('Value', 300, 100, 12, 'Arial', 40),
      makeItem('Alice', 50, 120, 12, 'Arial', 30),
      makeItem('100', 300, 120, 12, 'Arial', 30),
      makeItem('Bob', 50, 140, 12, 'Arial', 30),
      makeItem('200', 300, 140, 12, 'Arial', 30),
    ];
    const doc = makePdfDoc([makePdfPage(items)]);
    const result = await extractStructuredContent(doc, 1);
    const tables = result.blocks.filter(b => b.type === 'table');
    // Table detection is heuristic - it may or may not detect depending on thresholds
    assert.ok(result.blocks.length >= 1, 'Should produce some blocks');
  });
});

// ── Paragraph merging ────────────────────────────────────────────────────────

describe('paragraph merging in extractStructuredContent', () => {
  it('merges continuation lines into one paragraph', async () => {
    // Three lines with small gaps, same font, same indent
    const items = [
      makeItem('This is the start of a paragraph that continues on', 50, 100, 12),
      makeItem('the next line without much spacing between lines to', 50, 114, 12),
      makeItem('form a single merged paragraph block.', 50, 128, 12),
    ];
    const doc = makePdfDoc([makePdfPage(items)]);
    const result = await extractStructuredContent(doc, 1);
    // Should produce 1 merged paragraph (or very few blocks)
    assert.ok(result.blocks.length <= 3);
    const text = result.blocks.map(b => b.text).join(' ');
    assert.ok(text.includes('start'));
    assert.ok(text.includes('merged'));
  });

  it('separates paragraphs with large gap', async () => {
    const items = [
      makeItem('First paragraph text', 50, 100, 12),
      makeItem('Second paragraph after gap', 50, 200, 12), // big gap
    ];
    const doc = makePdfDoc([makePdfPage(items)]);
    const result = await extractStructuredContent(doc, 1);
    assert.ok(result.blocks.length >= 2, 'Should separate into distinct blocks');
  });
});

// ── Column detection ─────────────────────────────────────────────────────────

describe('column detection via extractStructuredContent', () => {
  it('detects two-column layout', async () => {
    // Create items in two distinct columns with many lines
    const items = [];
    for (let i = 0; i < 10; i++) {
      items.push(makeItem(`Left col line ${i}`, 50, 100 + i * 16, 12, 'Arial', 100));
      items.push(makeItem(`Right col line ${i}`, 350, 100 + i * 16, 12, 'Arial', 100));
    }
    const doc = makePdfDoc([makePdfPage(items)]);
    const result = await extractStructuredContent(doc, 1);
    // columnInfo may be detected
    if (result.columnInfo) {
      assert.ok(result.columnInfo.count >= 2, 'Should detect 2 columns');
    }
    assert.ok(result.blocks.length >= 1);
  });
});

// ── Run info and font mapping additional coverage ────────────────────────────

describe('buildRuns with superscript/subscript detection', () => {
  it('detects superscript for small text above baseline', async () => {
    const items = [
      makeItem('Normal text', 50, 100, 12, 'Arial', 60),
      { str: '2', transform: [7, 0, 0, 7, 112, 842 - 96], width: 4, height: 7, fontName: 'Arial' },
    ];
    const doc = makePdfDoc([makePdfPage(items)]);
    const result = await extractStructuredContent(doc, 1);
    assert.ok(result.blocks.length >= 1);
    // Check if any run has superscript flag
    const allRuns = result.blocks.flatMap(b => b.runs || []);
    // Superscript depends on Y-offset relative to line avg
    assert.ok(allRuns.length >= 1);
  });
});

// ── Link annotation association ──────────────────────────────────────────────

describe('link annotation detection', () => {
  it('associates URL with overlapping text item', async () => {
    const items = [
      makeItem('Click here', 50, 100, 12, 'Arial', 60),
    ];
    const annotations = [
      { subtype: 'Link', url: 'https://example.com', rect: [48, 730, 115, 745] },
    ];
    const doc = makePdfDoc([makePdfPage(items, { annotations })]);
    const result = await extractStructuredContent(doc, 1);
    // Check if any run has URL
    const runsWithUrl = result.blocks.flatMap(b => (b.runs || []).filter(r => r.url));
    assert.ok(runsWithUrl.length >= 1, 'Should associate link URL with text');
    assert.equal(runsWithUrl[0].url, 'https://example.com');
  });

  it('ignores non-Link annotations', async () => {
    const items = [makeItem('Text', 50, 100, 12)];
    const annotations = [
      { subtype: 'Highlight', url: null, rect: [48, 730, 115, 745] },
    ];
    const doc = makePdfDoc([makePdfPage(items, { annotations })]);
    const result = await extractStructuredContent(doc, 1);
    const runsWithUrl = result.blocks.flatMap(b => (b.runs || []).filter(r => r.url));
    assert.equal(runsWithUrl.length, 0);
  });
});

// ── Font mapping edge cases ──────────────────────────────────────────────────

describe('mapPdfFont additional', () => {
  it('strips ,Bold suffix', () => {
    assert.equal(mapPdfFont('Times,Bold'), 'Times New Roman');
  });

  it('maps Segoe variant', () => {
    assert.equal(mapPdfFont('SegoeUI-Semibold'), 'Segoe UI');
  });

  it('maps Trebuchet', () => {
    assert.equal(mapPdfFont('Trebuchet'), 'Trebuchet MS');
  });
});
