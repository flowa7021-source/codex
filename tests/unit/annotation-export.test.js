// ─── Unit Tests: AnnotationExport ────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  exportAnnotationsAsSvg,
  exportAnnotationsAsPdf,
} from '../../app/modules/annotation-export.js';

// ── SVG Export ──────────────────────────────────────────────────────────────

describe('exportAnnotationsAsSvg', () => {
  it('returns valid SVG wrapper for empty strokes', () => {
    const svg = exportAnnotationsAsSvg([], 800, 600);
    assert.ok(svg.startsWith('<svg'));
    assert.ok(svg.includes('width="800"'));
    assert.ok(svg.includes('height="600"'));
    assert.ok(svg.endsWith('</svg>'));
  });

  it('skips strokes with no points', () => {
    const svg = exportAnnotationsAsSvg([{ tool: 'pen', points: [] }], 800, 600);
    // Should only have svg wrapper + transparent rect
    assert.ok(!svg.includes('<path'));
    assert.ok(!svg.includes('<line'));
  });

  it('skips null strokes', () => {
    const svg = exportAnnotationsAsSvg([null, { points: null }], 800, 600);
    assert.ok(svg.includes('<svg'));
    assert.ok(svg.includes('</svg>'));
  });

  it('renders a pen stroke as a path', () => {
    const strokes = [{
      tool: 'pen',
      color: '#ff0000',
      size: 3,
      points: [{ x: 10, y: 20 }, { x: 30, y: 40 }, { x: 50, y: 60 }],
    }];
    const svg = exportAnnotationsAsSvg(strokes, 800, 600);
    assert.ok(svg.includes('<path'));
    assert.ok(svg.includes('M10,20'));
    assert.ok(svg.includes('L30,40'));
    assert.ok(svg.includes('L50,60'));
    assert.ok(svg.includes('stroke="#ff0000"'));
    assert.ok(svg.includes('stroke-width="3"'));
  });

  it('renders a single-point pen stroke as a circle', () => {
    const strokes = [{
      tool: 'pen',
      color: '#00ff00',
      size: 4,
      points: [{ x: 100, y: 200 }],
    }];
    const svg = exportAnnotationsAsSvg(strokes, 800, 600);
    assert.ok(svg.includes('<circle'));
    assert.ok(svg.includes('cx="100"'));
    assert.ok(svg.includes('cy="200"'));
    assert.ok(svg.includes('r="2"')); // size/2 = 4/2 = 2
  });

  it('renders a rect stroke', () => {
    const strokes = [{
      tool: 'rect',
      color: '#0000ff',
      size: 2,
      points: [{ x: 10, y: 20 }, { x: 110, y: 120 }],
    }];
    const svg = exportAnnotationsAsSvg(strokes, 800, 600);
    assert.ok(svg.includes('<rect'));
    assert.ok(svg.includes('x="10"'));
    assert.ok(svg.includes('y="20"'));
    assert.ok(svg.includes('width="100"'));
    assert.ok(svg.includes('height="100"'));
  });

  it('renders a circle (ellipse) stroke', () => {
    const strokes = [{
      tool: 'circle',
      color: '#ff00ff',
      size: 2,
      points: [{ x: 0, y: 0 }, { x: 100, y: 50 }],
    }];
    const svg = exportAnnotationsAsSvg(strokes, 800, 600);
    assert.ok(svg.includes('<ellipse'));
    assert.ok(svg.includes('cx="50"'));
    assert.ok(svg.includes('cy="25"'));
    assert.ok(svg.includes('rx="50"'));
    assert.ok(svg.includes('ry="25"'));
  });

  it('renders a line stroke', () => {
    const strokes = [{
      tool: 'line',
      color: '#123456',
      size: 1,
      points: [{ x: 10, y: 20 }, { x: 200, y: 300 }],
    }];
    const svg = exportAnnotationsAsSvg(strokes, 800, 600);
    assert.ok(svg.includes('<line'));
    assert.ok(svg.includes('x1="10"'));
    assert.ok(svg.includes('y1="20"'));
    assert.ok(svg.includes('x2="200"'));
    assert.ok(svg.includes('y2="300"'));
  });

  it('renders an arrow stroke with marker', () => {
    const strokes = [{
      tool: 'arrow',
      color: '#abcdef',
      size: 2,
      points: [{ x: 0, y: 0 }, { x: 100, y: 100 }],
    }];
    const svg = exportAnnotationsAsSvg(strokes, 800, 600);
    assert.ok(svg.includes('<defs>'));
    assert.ok(svg.includes('<marker'));
    assert.ok(svg.includes('marker-end='));
    assert.ok(svg.includes('<line'));
  });

  it('renders a comment stroke', () => {
    const strokes = [{
      tool: 'comment',
      color: '#ffd84d',
      text: 'My note',
      points: [{ x: 50, y: 50 }],
    }];
    const svg = exportAnnotationsAsSvg(strokes, 800, 600);
    assert.ok(svg.includes('<circle'));
    assert.ok(svg.includes('My note'));
  });

  it('escapes XML in comment text', () => {
    const strokes = [{
      tool: 'comment',
      color: '#ffd84d',
      text: '<script>alert("xss")</script>',
      points: [{ x: 50, y: 50 }],
    }];
    const svg = exportAnnotationsAsSvg(strokes, 800, 600);
    assert.ok(!svg.includes('<script>'));
    assert.ok(svg.includes('&lt;script&gt;'));
  });

  it('renders highlighter with opacity 0.4', () => {
    const strokes = [{
      tool: 'highlighter',
      color: '#ffff00',
      size: 10,
      points: [{ x: 10, y: 20 }, { x: 100, y: 20 }],
    }];
    const svg = exportAnnotationsAsSvg(strokes, 800, 600);
    assert.ok(svg.includes('opacity="0.4"'));
  });

  it('uses default color when none specified', () => {
    const strokes = [{
      tool: 'pen',
      points: [{ x: 10, y: 20 }, { x: 30, y: 40 }],
    }];
    const svg = exportAnnotationsAsSvg(strokes, 800, 600);
    assert.ok(svg.includes('#ffd84d'));
  });

  it('uses default size when none specified', () => {
    const strokes = [{
      tool: 'pen',
      points: [{ x: 10, y: 20 }, { x: 30, y: 40 }],
    }];
    const svg = exportAnnotationsAsSvg(strokes, 800, 600);
    assert.ok(svg.includes('stroke-width="2"'));
  });

  it('handles rect with inverted points', () => {
    const strokes = [{
      tool: 'rect',
      color: '#0000ff',
      size: 2,
      points: [{ x: 110, y: 120 }, { x: 10, y: 20 }],
    }];
    const svg = exportAnnotationsAsSvg(strokes, 800, 600);
    assert.ok(svg.includes('x="10"'));
    assert.ok(svg.includes('y="20"'));
    assert.ok(svg.includes('width="100"'));
    assert.ok(svg.includes('height="100"'));
  });

  it('renders multiple strokes', () => {
    const strokes = [
      { tool: 'pen', color: '#ff0000', size: 2, points: [{ x: 0, y: 0 }, { x: 10, y: 10 }] },
      { tool: 'rect', color: '#00ff00', size: 1, points: [{ x: 20, y: 20 }, { x: 40, y: 40 }] },
    ];
    const svg = exportAnnotationsAsSvg(strokes, 800, 600);
    assert.ok(svg.includes('<path'));
    assert.ok(svg.includes('<rect'));
  });
});

// ── PDF Export ──────────────────────────────────────────────────────────────

describe('exportAnnotationsAsPdf', () => {
  it('returns a Blob', () => {
    const result = exportAnnotationsAsPdf([], 595, 842);
    assert.ok(result instanceof Blob);
  });

  it('returns a Blob for pen strokes', () => {
    const strokes = [{
      tool: 'pen',
      color: '#ff0000',
      size: 2,
      points: [{ x: 10, y: 20 }, { x: 100, y: 200 }],
    }];
    const result = exportAnnotationsAsPdf(strokes, 595, 842);
    assert.ok(result instanceof Blob);
  });

  it('returns a Blob for rect strokes', () => {
    const strokes = [{
      tool: 'rect',
      color: '#0000ff',
      size: 2,
      points: [{ x: 10, y: 20 }, { x: 110, y: 120 }],
    }];
    const result = exportAnnotationsAsPdf(strokes, 595, 842);
    assert.ok(result instanceof Blob);
  });

  it('returns a Blob for circle strokes', () => {
    const strokes = [{
      tool: 'circle',
      color: '#00ff00',
      size: 3,
      points: [{ x: 50, y: 50 }, { x: 150, y: 100 }],
    }];
    const result = exportAnnotationsAsPdf(strokes, 595, 842);
    assert.ok(result instanceof Blob);
  });

  it('returns a Blob for arrow strokes', () => {
    const strokes = [{
      tool: 'arrow',
      color: '#ff00ff',
      size: 2,
      points: [{ x: 0, y: 0 }, { x: 100, y: 100 }],
    }];
    const result = exportAnnotationsAsPdf(strokes, 595, 842);
    assert.ok(result instanceof Blob);
  });

  it('returns a Blob for line strokes', () => {
    const strokes = [{
      tool: 'line',
      color: '#000000',
      size: 1,
      points: [{ x: 0, y: 0 }, { x: 200, y: 200 }],
    }];
    const result = exportAnnotationsAsPdf(strokes, 595, 842);
    assert.ok(result instanceof Blob);
  });

  it('returns a Blob for highlighter strokes', () => {
    const strokes = [{
      tool: 'highlighter',
      color: '#ffff00',
      size: 10,
      points: [{ x: 10, y: 20 }, { x: 100, y: 20 }],
    }];
    const result = exportAnnotationsAsPdf(strokes, 595, 842);
    assert.ok(result instanceof Blob);
  });

  it('handles empty strokes array', () => {
    const result = exportAnnotationsAsPdf([], 595, 842);
    assert.ok(result instanceof Blob);
  });

  it('skips strokes with no points', () => {
    const strokes = [{ tool: 'pen', points: [] }];
    const result = exportAnnotationsAsPdf(strokes, 595, 842);
    assert.ok(result instanceof Blob);
  });
});
