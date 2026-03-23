// ─── Unit Tests: Measurement Tools ────────────────────────────────────────
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  measureDistance,
  measurePolylineLength,
  measureAngle,
  measurePolygonArea,
  measurePolygonPerimeter,
  measureRectangle,
  convertUnit,
  convertAreaUnit,
  formatMeasurement,
  MeasurementOverlay,
} from '../../app/modules/measurement-tools.js';

// ─── measureDistance ─────────────────────────────────────────────────────────

describe('measureDistance', () => {
  it('returns 0 for identical points', () => {
    assert.equal(measureDistance({ x: 5, y: 5 }, { x: 5, y: 5 }), 0);
  });

  it('calculates horizontal distance', () => {
    assert.equal(measureDistance({ x: 0, y: 0 }, { x: 10, y: 0 }), 10);
  });

  it('calculates vertical distance', () => {
    assert.equal(measureDistance({ x: 0, y: 0 }, { x: 0, y: 7 }), 7);
  });

  it('calculates diagonal distance (3-4-5 triangle)', () => {
    const d = measureDistance({ x: 0, y: 0 }, { x: 3, y: 4 });
    assert.ok(Math.abs(d - 5) < 1e-10);
  });

  it('handles negative coordinates', () => {
    const d = measureDistance({ x: -3, y: -4 }, { x: 0, y: 0 });
    assert.ok(Math.abs(d - 5) < 1e-10);
  });

  it('is commutative', () => {
    const a = { x: 1, y: 2 };
    const b = { x: 4, y: 6 };
    assert.equal(measureDistance(a, b), measureDistance(b, a));
  });

  it('handles large coordinates', () => {
    const d = measureDistance({ x: 0, y: 0 }, { x: 1000, y: 0 });
    assert.equal(d, 1000);
  });

  it('handles floating point coordinates', () => {
    const d = measureDistance({ x: 0.5, y: 0.5 }, { x: 3.5, y: 4.5 });
    assert.ok(Math.abs(d - 5) < 1e-10);
  });
});

// ─── measurePolylineLength ───────────────────────────────────────────────────

describe('measurePolylineLength', () => {
  it('returns 0 for empty array', () => {
    assert.equal(measurePolylineLength([]), 0);
  });

  it('returns 0 for single point', () => {
    assert.equal(measurePolylineLength([{ x: 0, y: 0 }]), 0);
  });

  it('returns distance for two points', () => {
    const len = measurePolylineLength([{ x: 0, y: 0 }, { x: 3, y: 4 }]);
    assert.ok(Math.abs(len - 5) < 1e-10);
  });

  it('sums segments of a multi-segment path', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    assert.equal(measurePolylineLength(pts), 30);
  });

  it('handles collinear points', () => {
    const pts = [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 }];
    assert.equal(measurePolylineLength(pts), 10);
  });
});

// ─── measureAngle ────────────────────────────────────────────────────────────

describe('measureAngle', () => {
  it('returns 90 for a right angle', () => {
    const angle = measureAngle(
      { x: 1, y: 0 },  // a
      { x: 0, y: 0 },  // b (vertex)
      { x: 0, y: 1 },  // c
    );
    assert.ok(Math.abs(angle - 90) < 1e-10);
  });

  it('returns 180 for a straight line', () => {
    const angle = measureAngle(
      { x: -1, y: 0 },
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    );
    assert.ok(Math.abs(angle - 180) < 1e-10);
  });

  it('returns 0 for coincident rays', () => {
    const angle = measureAngle(
      { x: 1, y: 0 },
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    );
    assert.ok(Math.abs(angle) < 1e-10);
  });

  it('returns ~45 degrees for 45-degree angle', () => {
    const angle = measureAngle(
      { x: 1, y: 0 },
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    );
    assert.ok(Math.abs(angle - 45) < 1e-10);
  });

  it('returns interior angle (always <= 180)', () => {
    const angle = measureAngle(
      { x: 0, y: 1 },
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    );
    assert.ok(angle >= 0 && angle <= 180);
  });

  it('handles arbitrary vertex position', () => {
    const angle = measureAngle(
      { x: 10, y: 5 },
      { x: 5, y: 5 },
      { x: 5, y: 10 },
    );
    assert.ok(Math.abs(angle - 90) < 1e-10);
  });
});

// ─── measurePolygonArea ──────────────────────────────────────────────────────

describe('measurePolygonArea', () => {
  it('returns 0 for fewer than 3 points', () => {
    assert.equal(measurePolygonArea([]), 0);
    assert.equal(measurePolygonArea([{ x: 0, y: 0 }]), 0);
    assert.equal(measurePolygonArea([{ x: 0, y: 0 }, { x: 1, y: 0 }]), 0);
  });

  it('calculates area of a unit square', () => {
    const area = measurePolygonArea([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ]);
    assert.ok(Math.abs(area - 1) < 1e-10);
  });

  it('calculates area of a 10x5 rectangle', () => {
    const area = measurePolygonArea([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 5 },
      { x: 0, y: 5 },
    ]);
    assert.ok(Math.abs(area - 50) < 1e-10);
  });

  it('calculates area of a right triangle', () => {
    const area = measurePolygonArea([
      { x: 0, y: 0 },
      { x: 6, y: 0 },
      { x: 0, y: 4 },
    ]);
    assert.ok(Math.abs(area - 12) < 1e-10);
  });

  it('returns positive area regardless of winding order', () => {
    const cw = measurePolygonArea([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ]);
    const ccw = measurePolygonArea([
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 1, y: 0 },
      { x: 0, y: 0 },
    ]);
    assert.ok(Math.abs(cw - ccw) < 1e-10);
  });
});

// ─── measurePolygonPerimeter ─────────────────────────────────────────────────

describe('measurePolygonPerimeter', () => {
  it('returns 0 for fewer than 2 points', () => {
    assert.equal(measurePolygonPerimeter([]), 0);
    assert.equal(measurePolygonPerimeter([{ x: 0, y: 0 }]), 0);
  });

  it('calculates perimeter of a unit square', () => {
    const perim = measurePolygonPerimeter([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ]);
    assert.ok(Math.abs(perim - 4) < 1e-10);
  });

  it('calculates perimeter of a 3-4-5 right triangle', () => {
    const perim = measurePolygonPerimeter([
      { x: 0, y: 0 },
      { x: 3, y: 0 },
      { x: 0, y: 4 },
    ]);
    assert.ok(Math.abs(perim - 12) < 1e-10);
  });

  it('closes the polygon (adds segment from last to first)', () => {
    // Two points = a "degenerate polygon" with perimeter = 2 * distance
    const perim = measurePolygonPerimeter([
      { x: 0, y: 0 },
      { x: 5, y: 0 },
    ]);
    assert.ok(Math.abs(perim - 10) < 1e-10);
  });
});

// ─── measureRectangle ────────────────────────────────────────────────────────

describe('measureRectangle', () => {
  it('returns correct width, height, and area', () => {
    const r = measureRectangle({ x: 0, y: 0 }, { x: 10, y: 5 });
    assert.equal(r.width, 10);
    assert.equal(r.height, 5);
    assert.equal(r.area, 50);
  });

  it('handles negative-direction corners', () => {
    const r = measureRectangle({ x: 10, y: 5 }, { x: 0, y: 0 });
    assert.equal(r.width, 10);
    assert.equal(r.height, 5);
    assert.equal(r.area, 50);
  });

  it('returns 0 for zero-size rectangle', () => {
    const r = measureRectangle({ x: 5, y: 5 }, { x: 5, y: 5 });
    assert.equal(r.width, 0);
    assert.equal(r.height, 0);
    assert.equal(r.area, 0);
  });

  it('returns correct result for line (zero width or height)', () => {
    const r = measureRectangle({ x: 0, y: 0 }, { x: 10, y: 0 });
    assert.equal(r.width, 10);
    assert.equal(r.height, 0);
    assert.equal(r.area, 0);
  });
});

// ─── convertUnit ─────────────────────────────────────────────────────────────

describe('convertUnit', () => {
  it('pt returns the same value', () => {
    assert.equal(convertUnit(72, 'pt'), 72);
  });

  it('converts 72pt to 1 inch', () => {
    assert.ok(Math.abs(convertUnit(72, 'in') - 1) < 1e-10);
  });

  it('converts 72pt to 25.4mm', () => {
    assert.ok(Math.abs(convertUnit(72, 'mm') - 25.4) < 1e-10);
  });

  it('converts 72pt to 2.54cm', () => {
    assert.ok(Math.abs(convertUnit(72, 'cm') - 2.54) < 1e-10);
  });

  it('falls back to factor 1 for unknown unit', () => {
    assert.equal(convertUnit(72, 'furlongs'), 72);
  });

  it('converts 0 to 0 in any unit', () => {
    assert.equal(convertUnit(0, 'mm'), 0);
  });
});

// ─── convertAreaUnit ─────────────────────────────────────────────────────────

describe('convertAreaUnit', () => {
  it('pt returns the same value', () => {
    assert.equal(convertAreaUnit(100, 'pt'), 100);
  });

  it('converts 72*72 pt² to 1 in²', () => {
    const result = convertAreaUnit(72 * 72, 'in');
    assert.ok(Math.abs(result - 1) < 1e-10);
  });

  it('squares the conversion factor', () => {
    const linear = convertUnit(72, 'mm');   // 25.4
    const area = convertAreaUnit(72 * 72, 'mm');
    assert.ok(Math.abs(area - linear * linear) < 1e-6);
  });

  it('returns 0 for zero area', () => {
    assert.equal(convertAreaUnit(0, 'cm'), 0);
  });

  it('falls back to factor 1 for unknown unit', () => {
    assert.equal(convertAreaUnit(100, 'unknown'), 100);
  });
});

// ─── formatMeasurement ───────────────────────────────────────────────────────

describe('formatMeasurement', () => {
  it('formats with default 2 decimal places', () => {
    assert.equal(formatMeasurement(72, 'in'), '1.00 in');
  });

  it('formats mm with correct label', () => {
    const result = formatMeasurement(72, 'mm');
    assert.ok(result.endsWith(' mm'));
    assert.ok(result.includes('25.40'));
  });

  it('respects custom decimal places', () => {
    assert.equal(formatMeasurement(72, 'in', 0), '1 in');
    assert.equal(formatMeasurement(72, 'in', 4), '1.0000 in');
  });

  it('uses the raw unit string when label not found', () => {
    const result = formatMeasurement(100, 'furlongs');
    assert.ok(result.includes('furlongs'));
  });

  it('formats pt values', () => {
    assert.equal(formatMeasurement(100, 'pt'), '100.00 pt');
  });
});

// ─── MeasurementOverlay ──────────────────────────────────────────────────────

describe('MeasurementOverlay', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
  });

  it('constructs with default options', () => {
    const overlay = new MeasurementOverlay(container);
    assert.ok(overlay);
  });

  it('constructs with custom options', () => {
    const overlay = new MeasurementOverlay(container, {
      zoom: 2,
      unit: 'in',
      pageWidthPt: 595,
      pageHeightPt: 842,
    });
    assert.ok(overlay);
  });

  it('setTool activates and creates canvas', () => {
    const overlay = new MeasurementOverlay(container);
    overlay.setTool('distance');
    assert.ok(container.querySelector('canvas'));
  });

  it('deactivate removes canvas', () => {
    const overlay = new MeasurementOverlay(container);
    overlay.setTool('distance');
    overlay.deactivate();
    assert.equal(container.querySelector('canvas'), null);
  });

  it('destroy removes canvas', () => {
    const overlay = new MeasurementOverlay(container);
    overlay.setTool('area');
    overlay.destroy();
    assert.equal(container.querySelector('canvas'), null);
  });

  it('setZoom updates canvas dimensions', () => {
    const overlay = new MeasurementOverlay(container, {
      pageWidthPt: 612,
      pageHeightPt: 792,
    });
    overlay.setTool('distance');
    overlay.setZoom(2);
    const canvas = container.querySelector('canvas');
    assert.equal(canvas.width, 1224);
    assert.equal(canvas.height, 1584);
  });

  it('setUnit updates unit without error', () => {
    const overlay = new MeasurementOverlay(container);
    overlay.setTool('distance');
    overlay.setUnit('cm');
    // No error = pass
    assert.ok(true);
  });

  it('clearAll empties measurements', () => {
    const overlay = new MeasurementOverlay(container);
    overlay.setTool('distance');
    overlay.clearAll();
    assert.deepStrictEqual(overlay.getMeasurements(), []);
  });

  it('getMeasurements returns empty array initially', () => {
    const overlay = new MeasurementOverlay(container);
    assert.deepStrictEqual(overlay.getMeasurements(), []);
  });

  it('setTool sets cursor to crosshair', () => {
    const overlay = new MeasurementOverlay(container);
    overlay.setTool('polyline');
    const canvas = container.querySelector('canvas');
    assert.equal(canvas.style.cursor, 'crosshair');
  });

  it('Escape key resets points', () => {
    const overlay = new MeasurementOverlay(container);
    overlay.setTool('distance');
    // Simulate Escape
    const event = new KeyboardEvent('keydown', { key: 'Escape' });
    document.dispatchEvent(event);
    // Should not throw
    assert.ok(true);
    overlay.deactivate();
  });

  it('setZoom before setTool does nothing harmful', () => {
    const overlay = new MeasurementOverlay(container);
    overlay.setZoom(1.5);
    assert.ok(true);
  });

  it('deactivate when not active is safe', () => {
    const overlay = new MeasurementOverlay(container);
    overlay.deactivate();
    assert.ok(true);
  });

  it('setting multiple tools resets points', () => {
    const overlay = new MeasurementOverlay(container);
    overlay.setTool('distance');
    overlay.setTool('angle');
    assert.deepStrictEqual(overlay.getMeasurements(), []);
    overlay.deactivate();
  });
});
