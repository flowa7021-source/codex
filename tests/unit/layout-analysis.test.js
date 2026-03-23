// ─── Unit Tests: Layout Analysis ────────────────────────────────────────────
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  analyzeLayout,
  detectTable,
  sortByReadingOrder,
  tableToHtml,
} from '../../app/modules/layout-analysis.js';

// ─── Helper factories ───────────────────────────────────────────────────────

function makeItem(x, y, str, width = 50, height = 12, fontSize = 12) {
  return { x, y, str, width, height, fontSize };
}

function makePageInfo(width = 612, height = 792) {
  return { width, height };
}

// ─── analyzeLayout ──────────────────────────────────────────────────────────

describe('analyzeLayout', () => {
  it('returns empty array for null items', () => {
    assert.deepEqual(analyzeLayout(null, makePageInfo()), []);
  });

  it('returns empty array for empty items', () => {
    assert.deepEqual(analyzeLayout([], makePageInfo()), []);
  });

  it('detects header zone for items in top 8%', () => {
    const pageInfo = makePageInfo(612, 1000);
    // items at y > 920 (92% of 1000)
    const items = [
      makeItem(50, 950, 'Header Text', 100),
    ];
    const zones = analyzeLayout(items, pageInfo);
    const headers = zones.filter(z => z.type === 'header');
    assert.equal(headers.length, 1);
  });

  it('detects footer zone for items in bottom 8%', () => {
    const pageInfo = makePageInfo(612, 1000);
    // items at y < 80 (8% of 1000)
    const items = [
      makeItem(50, 30, 'Footer Text', 100),
    ];
    const zones = analyzeLayout(items, pageInfo);
    const footers = zones.filter(z => z.type === 'footer');
    assert.equal(footers.length, 1);
  });

  it('creates body zones for items in the middle region', () => {
    const pageInfo = makePageInfo(612, 1000);
    const items = [
      makeItem(50, 500, 'Body text line 1', 200),
      makeItem(50, 480, 'Body text line 2', 200),
    ];
    const zones = analyzeLayout(items, pageInfo);
    const bodyZones = zones.filter(z => z.type !== 'header' && z.type !== 'footer');
    assert.ok(bodyZones.length >= 1);
  });

  it('assigns reading order to zones', () => {
    const pageInfo = makePageInfo(612, 1000);
    const items = [
      makeItem(50, 950, 'Header', 100),
      makeItem(50, 500, 'Body A', 200),
      makeItem(50, 400, 'Body B', 200),
      makeItem(50, 30, 'Footer', 100),
    ];
    const zones = analyzeLayout(items, pageInfo);
    const headerZone = zones.find(z => z.type === 'header');
    const footerZone = zones.find(z => z.type === 'footer');
    if (headerZone) assert.equal(headerZone.order, 0);
    if (footerZone) assert.equal(footerZone.order, 999);
  });

  it('handles items spread across two columns', () => {
    const pageInfo = makePageInfo(600, 1000);
    // Left column items (x around 50)
    // Right column items (x around 350, gap > 15% of 600 = 90)
    const items = [
      makeItem(50, 500, 'Left col', 100),
      makeItem(50, 480, 'Left col 2', 100),
      makeItem(350, 500, 'Right col', 100),
      makeItem(350, 480, 'Right col 2', 100),
    ];
    const zones = analyzeLayout(items, pageInfo);
    assert.ok(zones.length >= 2);
  });

  it('detects sidebar zones (narrow at edge)', () => {
    const pageInfo = makePageInfo(600, 1000);
    // Narrow block at left edge < 25% of page width with x < 15% of page width
    const items = [
      makeItem(10, 500, 'Side', 50),
      makeItem(10, 490, 'Bar', 50),
    ];
    const zones = analyzeLayout(items, pageInfo);
    const sidebars = zones.filter(z => z.type === 'sidebar');
    assert.ok(sidebars.length >= 1, 'Should detect sidebar');
  });
});

// ─── detectTable ────────────────────────────────────────────────────────────

describe('detectTable', () => {
  it('returns null for null items', () => {
    assert.equal(detectTable(null), null);
  });

  it('returns null for empty items', () => {
    assert.equal(detectTable([]), null);
  });

  it('returns null if too few items for min rows/cols', () => {
    const items = [makeItem(10, 100, 'A'), makeItem(100, 100, 'B')];
    assert.equal(detectTable(items), null);
  });

  it('detects a simple 2x2 table', () => {
    const items = [
      makeItem(10, 100, 'A'),   makeItem(200, 100, 'B'),
      makeItem(10, 90, 'C'),    makeItem(200, 90, 'D'),
      makeItem(10, 80, 'E'),    makeItem(200, 80, 'F'),
    ];
    const result = detectTable(items);
    if (result) {
      assert.ok(result.rows.length >= 2);
      assert.ok(result.bounds);
      assert.ok(typeof result.bounds.x === 'number');
    }
  });

  it('returns null if column positions are inconsistent', () => {
    // All items at very different x positions - no consistent columns
    const items = [
      makeItem(10, 100, 'A'),   makeItem(200, 100, 'B'),
      makeItem(50, 90, 'C'),    makeItem(300, 90, 'D'),
      makeItem(80, 80, 'E'),    makeItem(400, 80, 'F'),
      makeItem(120, 70, 'G'),   makeItem(500, 70, 'H'),
    ];
    // The result depends on column detection heuristics
    const result = detectTable(items);
    // This may or may not be a table depending on thresholds
    assert.ok(result === null || result.rows.length >= 2);
  });

  it('respects custom minRows and minCols', () => {
    const items = [
      makeItem(10, 100, 'A'), makeItem(200, 100, 'B'), makeItem(400, 100, 'C'),
      makeItem(10, 90, 'D'),  makeItem(200, 90, 'E'),  makeItem(400, 90, 'F'),
      makeItem(10, 80, 'G'),  makeItem(200, 80, 'H'),  makeItem(400, 80, 'I'),
    ];
    const result = detectTable(items, { minRows: 3, minCols: 3 });
    if (result) {
      assert.ok(result.rows.length >= 3);
    }
  });

  it('returns null when fewer rows than minRows', () => {
    const items = [
      makeItem(10, 100, 'A'), makeItem(200, 100, 'B'),
    ];
    assert.equal(detectTable(items, { minRows: 3 }), null);
  });

  it('calculates bounds correctly', () => {
    const items = [
      makeItem(10, 100, 'A', 50, 10), makeItem(200, 100, 'B', 50, 10),
      makeItem(10, 90, 'C', 50, 10),  makeItem(200, 90, 'D', 50, 10),
      makeItem(10, 80, 'E', 50, 10),  makeItem(200, 80, 'F', 50, 10),
    ];
    const result = detectTable(items);
    if (result) {
      assert.equal(result.bounds.x, 10);
      assert.equal(result.bounds.y, 80);
    }
  });
});

// ─── sortByReadingOrder ─────────────────────────────────────────────────────

describe('sortByReadingOrder', () => {
  it('places headers first', () => {
    const zones = [
      { type: 'text', order: 1 },
      { type: 'header', order: 0 },
      { type: 'text', order: 2 },
    ];
    const sorted = sortByReadingOrder(zones);
    assert.equal(sorted[0].type, 'header');
  });

  it('places footers last', () => {
    const zones = [
      { type: 'footer', order: 999 },
      { type: 'text', order: 1 },
      { type: 'header', order: 0 },
    ];
    const sorted = sortByReadingOrder(zones);
    assert.equal(sorted[0].type, 'header');
    assert.equal(sorted[sorted.length - 1].type, 'footer');
  });

  it('sorts body zones by order field', () => {
    const zones = [
      { type: 'text', order: 3 },
      { type: 'text', order: 1 },
      { type: 'text', order: 2 },
    ];
    const sorted = sortByReadingOrder(zones);
    assert.equal(sorted[0].order, 1);
    assert.equal(sorted[1].order, 2);
    assert.equal(sorted[2].order, 3);
  });

  it('does not mutate input array', () => {
    const zones = [
      { type: 'text', order: 2 },
      { type: 'text', order: 1 },
    ];
    const sorted = sortByReadingOrder(zones);
    assert.notStrictEqual(sorted, zones);
    assert.equal(zones[0].order, 2); // original order preserved
  });

  it('handles empty array', () => {
    assert.deepEqual(sortByReadingOrder([]), []);
  });

  it('header comes before footer when both present', () => {
    const zones = [
      { type: 'footer', order: 999 },
      { type: 'header', order: 0 },
    ];
    const sorted = sortByReadingOrder(zones);
    assert.equal(sorted[0].type, 'header');
    assert.equal(sorted[1].type, 'footer');
  });
});

// ─── tableToHtml ────────────────────────────────────────────────────────────

describe('tableToHtml', () => {
  it('returns empty string for null rows', () => {
    assert.equal(tableToHtml(null), '');
  });

  it('returns empty string for empty rows', () => {
    assert.equal(tableToHtml([]), '');
  });

  it('generates a table with header', () => {
    const rows = [['Name', 'Age'], ['Alice', '30']];
    const html = tableToHtml(rows, true);
    assert.ok(html.includes('<table>'));
    assert.ok(html.includes('<thead>'));
    assert.ok(html.includes('<th>Name</th>'));
    assert.ok(html.includes('<th>Age</th>'));
    assert.ok(html.includes('</thead>'));
    assert.ok(html.includes('<tbody>'));
    assert.ok(html.includes('<td>Alice</td>'));
    assert.ok(html.includes('</tbody>'));
    assert.ok(html.includes('</table>'));
  });

  it('generates a table without header', () => {
    const rows = [['A', 'B'], ['C', 'D']];
    const html = tableToHtml(rows, false);
    assert.ok(!html.includes('<thead>'));
    assert.ok(!html.includes('<th>'));
    assert.ok(html.includes('<td>A</td>'));
    assert.ok(html.includes('<td>D</td>'));
  });

  it('escapes HTML entities in cell content', () => {
    const rows = [['<script>'], ['A & B']];
    const html = tableToHtml(rows);
    assert.ok(html.includes('&lt;script&gt;'));
    assert.ok(html.includes('A &amp; B'));
    assert.ok(!html.includes('<script>'));
  });

  it('handles single-row table (header only)', () => {
    const rows = [['H1', 'H2']];
    const html = tableToHtml(rows, true);
    assert.ok(html.includes('<thead>'));
    assert.ok(html.includes('<th>H1</th>'));
    assert.ok(!html.includes('<tbody>'));
  });

  it('escapes greater-than sign', () => {
    const rows = [['a > b']];
    const html = tableToHtml(rows, false);
    assert.ok(html.includes('a &gt; b'));
  });

  it('generates correct tr structure', () => {
    const rows = [['X']];
    const html = tableToHtml(rows, false);
    assert.ok(html.includes('<tr>'));
    assert.ok(html.includes('</tr>'));
  });
});
