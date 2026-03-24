// ─── Unit Tests: Measurement Tools ────────────────────────────────────────
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// ─── DOM / Canvas mocks ─────────────────────────────────────────────────────

const _docListeners = {};

function makeCtx() {
  return {
    clearRect() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    arc() {},
    closePath() {},
    stroke() {},
    fill() {},
    fillRect() {},
    strokeRect() {},
    fillText() {},
    setLineDash() {},
    measureText() { return { width: 40 }; },
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
  };
}

function makeMockElement(tag) {
  const _children = [];
  const _listeners = {};
  const el = {
    tagName: (tag || 'DIV').toUpperCase(),
    style: {},
    width: 0,
    height: 0,
    parentNode: null,
    appendChild(child) { _children.push(child); child.parentNode = el; return child; },
    remove() {
      const idx = el.parentNode ? el.parentNode._children.indexOf(el) : -1;
      if (idx >= 0) el.parentNode._children.splice(idx, 1);
      el.parentNode = null;
    },
    addEventListener(ev, fn) {
      if (!_listeners[ev]) _listeners[ev] = [];
      _listeners[ev].push(fn);
    },
    removeEventListener(ev, fn) {
      if (_listeners[ev]) _listeners[ev] = _listeners[ev].filter(f => f !== fn);
    },
    getContext() { return makeCtx(); },
    getBoundingClientRect() { return { left: 0, top: 0, width: 100, height: 100 }; },
    querySelector(sel) {
      if (sel === 'canvas') return _children.find(c => c.tagName === 'CANVAS') || null;
      return null;
    },
    _children,
  };
  return el;
}

globalThis.document = {
  createElement(tag) { return makeMockElement(tag); },
  addEventListener(ev, fn) {
    if (!_docListeners[ev]) _docListeners[ev] = [];
    _docListeners[ev].push(fn);
  },
  removeEventListener(ev, fn) {
    if (_docListeners[ev]) _docListeners[ev] = _docListeners[ev].filter(f => f !== fn);
  },
  dispatchEvent(ev) {
    (_docListeners[ev.type] || []).forEach(fn => fn(ev));
  },
};

globalThis.KeyboardEvent = class KeyboardEvent {
  constructor(type, opts = {}) {
    this.type = type;
    this.key = opts.key || '';
  }
};

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

  // ── Mouse interaction: distance tool ────────────────────────────────────

  it('distance tool commits after two clicks', () => {
    const overlay = new MeasurementOverlay(container, { zoom: 1, unit: 'mm' });
    overlay.setTool('distance');

    // Simulate two mouse clicks via the bound handler
    overlay._onMouseDown({ clientX: 0, clientY: 0 });
    overlay._onMouseDown({ clientX: 72, clientY: 0 });

    const ms = overlay.getMeasurements();
    assert.equal(ms.length, 1);
    assert.equal(ms[0].tool, 'distance');
    assert.equal(ms[0].unit, 'mm');
    assert.ok(ms[0].formatted.includes('mm'));
    overlay.deactivate();
  });

  // ── Mouse interaction: rectangle tool ───────────────────────────────────

  it('rectangle tool commits after two clicks', () => {
    const overlay = new MeasurementOverlay(container, { zoom: 1, unit: 'in' });
    overlay.setTool('rectangle');

    overlay._onMouseDown({ clientX: 10, clientY: 10 });
    overlay._onMouseDown({ clientX: 82, clientY: 82 });

    const ms = overlay.getMeasurements();
    assert.equal(ms.length, 1);
    assert.equal(ms[0].tool, 'rectangle');
    assert.ok(ms[0].formatted.includes('×'));
    overlay.deactivate();
  });

  // ── Mouse interaction: angle tool ───────────────────────────────────────

  it('angle tool commits after three clicks', () => {
    const overlay = new MeasurementOverlay(container, { zoom: 1, unit: 'pt' });
    overlay.setTool('angle');

    overlay._onMouseDown({ clientX: 100, clientY: 0 });
    overlay._onMouseDown({ clientX: 0, clientY: 0 });
    overlay._onMouseDown({ clientX: 0, clientY: 100 });

    const ms = overlay.getMeasurements();
    assert.equal(ms.length, 1);
    assert.equal(ms[0].tool, 'angle');
    assert.ok(ms[0].formatted.includes('°'));
    overlay.deactivate();
  });

  it('angle tool does not commit with only two clicks', () => {
    const overlay = new MeasurementOverlay(container, { zoom: 1 });
    overlay.setTool('angle');

    overlay._onMouseDown({ clientX: 100, clientY: 0 });
    overlay._onMouseDown({ clientX: 0, clientY: 0 });

    assert.equal(overlay.getMeasurements().length, 0);
    overlay.deactivate();
  });

  // ── Mouse interaction: polyline tool ────────────────────────────────────

  it('polyline tool commits on double-click', () => {
    const overlay = new MeasurementOverlay(container, { zoom: 1, unit: 'cm' });
    overlay.setTool('polyline');

    overlay._onMouseDown({ clientX: 0, clientY: 0 });
    overlay._onMouseDown({ clientX: 72, clientY: 0 });
    overlay._onMouseDown({ clientX: 72, clientY: 72 });
    overlay._onDblClick({});

    const ms = overlay.getMeasurements();
    assert.equal(ms.length, 1);
    assert.equal(ms[0].tool, 'polyline');
    assert.ok(ms[0].formatted.includes('cm'));
    overlay.deactivate();
  });

  it('polyline tool does not commit with fewer than 2 points on dblclick', () => {
    const overlay = new MeasurementOverlay(container, { zoom: 1 });
    overlay.setTool('polyline');

    overlay._onMouseDown({ clientX: 10, clientY: 10 });
    overlay._onDblClick({});

    assert.equal(overlay.getMeasurements().length, 0);
    overlay.deactivate();
  });

  // ── Mouse interaction: area tool ────────────────────────────────────────

  it('area tool commits on double-click with polygon', () => {
    const overlay = new MeasurementOverlay(container, { zoom: 1, unit: 'mm' });
    overlay.setTool('area');

    overlay._onMouseDown({ clientX: 0, clientY: 0 });
    overlay._onMouseDown({ clientX: 72, clientY: 0 });
    overlay._onMouseDown({ clientX: 72, clientY: 72 });
    overlay._onMouseDown({ clientX: 0, clientY: 72 });
    overlay._onDblClick({});

    const ms = overlay.getMeasurements();
    assert.equal(ms.length, 1);
    assert.equal(ms[0].tool, 'area');
    assert.ok(ms[0].formatted.includes('²'));
    assert.ok(ms[0].formatted.includes('perim'));
    overlay.deactivate();
  });

  it('area tool does not commit with fewer than 2 points', () => {
    const overlay = new MeasurementOverlay(container, { zoom: 1 });
    overlay.setTool('area');

    overlay._onMouseDown({ clientX: 10, clientY: 10 });
    overlay._onDblClick({});

    assert.equal(overlay.getMeasurements().length, 0);
    overlay.deactivate();
  });

  // ── Mouse move (hover preview) ─────────────────────────────────────────

  it('mouse move sets hover point for distance preview', () => {
    const overlay = new MeasurementOverlay(container, { zoom: 1 });
    overlay.setTool('distance');

    overlay._onMouseDown({ clientX: 0, clientY: 0 });
    overlay._onMouseMove({ clientX: 50, clientY: 50 });

    // Should not throw and hover point should be set
    assert.ok(overlay._hoverPt);
    assert.equal(overlay._hoverPt.x, 50);
    assert.equal(overlay._hoverPt.y, 50);
    overlay.deactivate();
  });

  it('mouse move does nothing when not active', () => {
    const overlay = new MeasurementOverlay(container, { zoom: 1 });
    overlay.setTool('distance');
    overlay._active = false;

    overlay._onMouseMove({ clientX: 50, clientY: 50 });
    assert.equal(overlay._hoverPt, undefined);
    overlay.deactivate();
  });

  it('mouse move does nothing when no points', () => {
    const overlay = new MeasurementOverlay(container, { zoom: 1 });
    overlay.setTool('distance');

    overlay._onMouseMove({ clientX: 50, clientY: 50 });
    assert.equal(overlay._hoverPt, undefined);
    overlay.deactivate();
  });

  // ── Mouse down when not active ──────────────────────────────────────────

  it('mouse down does nothing when not active', () => {
    const overlay = new MeasurementOverlay(container, { zoom: 1 });
    overlay.setTool('distance');
    overlay._active = false;

    overlay._onMouseDown({ clientX: 50, clientY: 50 });
    assert.equal(overlay._points.length, 0);
    overlay.deactivate();
  });

  // ── Escape key clears points and hoverPt ────────────────────────────────

  it('Escape key clears in-progress points and hover', () => {
    const overlay = new MeasurementOverlay(container, { zoom: 1 });
    overlay.setTool('polyline');

    overlay._onMouseDown({ clientX: 10, clientY: 10 });
    overlay._onMouseDown({ clientX: 20, clientY: 20 });
    overlay._onMouseMove({ clientX: 30, clientY: 30 });
    assert.equal(overlay._points.length, 2);

    overlay._onKeyDown({ key: 'Escape' });
    assert.equal(overlay._points.length, 0);
    assert.equal(overlay._hoverPt, null);
    overlay.deactivate();
  });

  it('non-Escape key does not clear points', () => {
    const overlay = new MeasurementOverlay(container, { zoom: 1 });
    overlay.setTool('distance');

    overlay._onMouseDown({ clientX: 10, clientY: 10 });
    overlay._onKeyDown({ key: 'Enter' });
    assert.equal(overlay._points.length, 1);
    overlay.deactivate();
  });

  // ── clearAll after measurements ─────────────────────────────────────────

  it('clearAll removes completed measurements', () => {
    const overlay = new MeasurementOverlay(container, { zoom: 1, unit: 'pt' });
    overlay.setTool('distance');

    overlay._onMouseDown({ clientX: 0, clientY: 0 });
    overlay._onMouseDown({ clientX: 100, clientY: 0 });
    assert.equal(overlay.getMeasurements().length, 1);

    overlay.clearAll();
    assert.equal(overlay.getMeasurements().length, 0);
    overlay.deactivate();
  });

  // ── getMeasurements returns correct data ─────────────────────────────────

  it('getMeasurements returns correct structure for distance', () => {
    const overlay = new MeasurementOverlay(container, { zoom: 1, unit: 'pt' });
    overlay.setTool('distance');

    overlay._onMouseDown({ clientX: 0, clientY: 0 });
    overlay._onMouseDown({ clientX: 100, clientY: 0 });

    const ms = overlay.getMeasurements();
    assert.equal(ms.length, 1);
    assert.equal(ms[0].tool, 'distance');
    assert.ok(Array.isArray(ms[0].points));
    assert.equal(ms[0].points.length, 2);
    assert.equal(typeof ms[0].value, 'number');
    assert.equal(ms[0].unit, 'pt');
    assert.equal(typeof ms[0].formatted, 'string');
    overlay.deactivate();
  });

  // ── Multiple measurements ───────────────────────────────────────────────

  it('supports multiple sequential measurements', () => {
    const overlay = new MeasurementOverlay(container, { zoom: 1, unit: 'mm' });
    overlay.setTool('distance');

    overlay._onMouseDown({ clientX: 0, clientY: 0 });
    overlay._onMouseDown({ clientX: 100, clientY: 0 });

    overlay._onMouseDown({ clientX: 50, clientY: 50 });
    overlay._onMouseDown({ clientX: 150, clientY: 50 });

    const ms = overlay.getMeasurements();
    assert.equal(ms.length, 2);
    overlay.deactivate();
  });

  // ── Draw with hover preview for various tools ───────────────────────────

  it('polyline draw preview with hover', () => {
    const overlay = new MeasurementOverlay(container, { zoom: 1 });
    overlay.setTool('polyline');

    overlay._onMouseDown({ clientX: 0, clientY: 0 });
    overlay._onMouseDown({ clientX: 50, clientY: 0 });
    overlay._onMouseMove({ clientX: 50, clientY: 50 });

    // Trigger draw explicitly to exercise polyline preview path
    overlay._draw();
    assert.ok(true);
    overlay.deactivate();
  });

  it('area draw preview with hover', () => {
    const overlay = new MeasurementOverlay(container, { zoom: 1 });
    overlay.setTool('area');

    overlay._onMouseDown({ clientX: 0, clientY: 0 });
    overlay._onMouseDown({ clientX: 50, clientY: 0 });
    overlay._onMouseMove({ clientX: 50, clientY: 50 });

    overlay._draw();
    assert.ok(true);
    overlay.deactivate();
  });

  it('angle draw preview with two points and hover', () => {
    const overlay = new MeasurementOverlay(container, { zoom: 1 });
    overlay.setTool('angle');

    overlay._onMouseDown({ clientX: 100, clientY: 0 });
    overlay._onMouseDown({ clientX: 0, clientY: 0 });
    overlay._onMouseMove({ clientX: 0, clientY: 100 });

    overlay._draw();
    assert.ok(true);
    overlay.deactivate();
  });

  it('rectangle draw preview with hover', () => {
    const overlay = new MeasurementOverlay(container, { zoom: 1 });
    overlay.setTool('rectangle');

    overlay._onMouseDown({ clientX: 10, clientY: 10 });
    overlay._onMouseMove({ clientX: 80, clientY: 80 });

    overlay._draw();
    assert.ok(true);
    overlay.deactivate();
  });

  it('distance draw preview with hover', () => {
    const overlay = new MeasurementOverlay(container, { zoom: 1 });
    overlay.setTool('distance');

    overlay._onMouseDown({ clientX: 10, clientY: 10 });
    overlay._onMouseMove({ clientX: 80, clientY: 10 });

    overlay._draw();
    assert.ok(true);
    overlay.deactivate();
  });

  // ── Drawing completed measurements ──────────────────────────────────────

  it('draws completed polyline measurement', () => {
    const overlay = new MeasurementOverlay(container, { zoom: 1, unit: 'mm' });
    overlay.setTool('polyline');

    overlay._onMouseDown({ clientX: 0, clientY: 0 });
    overlay._onMouseDown({ clientX: 50, clientY: 0 });
    overlay._onMouseDown({ clientX: 50, clientY: 50 });
    overlay._onDblClick({});

    // Draw is called internally after commit; call again to exercise completed path
    overlay._draw();
    assert.equal(overlay.getMeasurements().length, 1);
    overlay.deactivate();
  });

  it('draws completed area measurement', () => {
    const overlay = new MeasurementOverlay(container, { zoom: 1, unit: 'mm' });
    overlay.setTool('area');

    overlay._onMouseDown({ clientX: 0, clientY: 0 });
    overlay._onMouseDown({ clientX: 72, clientY: 0 });
    overlay._onMouseDown({ clientX: 72, clientY: 72 });
    overlay._onDblClick({});

    overlay._draw();
    assert.equal(overlay.getMeasurements().length, 1);
    overlay.deactivate();
  });

  it('draws completed angle measurement', () => {
    const overlay = new MeasurementOverlay(container, { zoom: 1, unit: 'pt' });
    overlay.setTool('angle');

    overlay._onMouseDown({ clientX: 100, clientY: 0 });
    overlay._onMouseDown({ clientX: 0, clientY: 0 });
    overlay._onMouseDown({ clientX: 0, clientY: 100 });

    overlay._draw();
    assert.equal(overlay.getMeasurements().length, 1);
    overlay.deactivate();
  });

  it('draws completed rectangle measurement', () => {
    const overlay = new MeasurementOverlay(container, { zoom: 1, unit: 'in' });
    overlay.setTool('rectangle');

    overlay._onMouseDown({ clientX: 10, clientY: 10 });
    overlay._onMouseDown({ clientX: 82, clientY: 82 });

    overlay._draw();
    assert.equal(overlay.getMeasurements().length, 1);
    overlay.deactivate();
  });

  // ── _canvasToPagePt with zoom ───────────────────────────────────────────

  it('canvasToPagePt respects zoom', () => {
    const overlay = new MeasurementOverlay(container, { zoom: 2 });
    overlay.setTool('distance');

    overlay._onMouseDown({ clientX: 100, clientY: 200 });
    // With zoom=2, coordinates should be halved
    assert.equal(overlay._points[0].x, 50);
    assert.equal(overlay._points[0].y, 100);
    overlay.deactivate();
  });

  // ── setUnit changes formatted output ────────────────────────────────────

  it('setUnit changes unit on subsequent getMeasurements', () => {
    const overlay = new MeasurementOverlay(container, { zoom: 1, unit: 'mm' });
    overlay.setTool('distance');

    overlay._onMouseDown({ clientX: 0, clientY: 0 });
    overlay._onMouseDown({ clientX: 72, clientY: 0 });

    assert.equal(overlay.getMeasurements()[0].unit, 'mm');
    overlay.setUnit('in');
    assert.equal(overlay.getMeasurements()[0].unit, 'in');
    overlay.deactivate();
  });

  // ── _draw with no ctx is safe ───────────────────────────────────────────

  it('_draw with no ctx does nothing', () => {
    const overlay = new MeasurementOverlay(container);
    // Don't call setTool, so _ctx is null
    overlay._draw();
    assert.ok(true);
  });

  // ── _drawPolyline with fewer than 2 points ─────────────────────────────

  it('_drawPolyline with fewer than 2 points does nothing', () => {
    const overlay = new MeasurementOverlay(container, { zoom: 1 });
    overlay.setTool('distance');
    const ctx = overlay._ctx;
    // Should not throw
    overlay._drawPolyline(ctx, [{ x: 0, y: 0 }], 1, false);
    overlay._drawPolyline(ctx, [], 1, true);
    assert.ok(true);
    overlay.deactivate();
  });

  // ── _drawAnglePreview with fewer than 2 points ─────────────────────────

  it('_drawAnglePreview with fewer than 2 points does nothing', () => {
    const overlay = new MeasurementOverlay(container, { zoom: 1 });
    overlay.setTool('distance');
    const ctx = overlay._ctx;
    overlay._drawAnglePreview(ctx, [{ x: 0, y: 0 }], 1);
    overlay._drawAnglePreview(ctx, [], 1);
    assert.ok(true);
    overlay.deactivate();
  });

  // ── _drawAnglePreview with exactly 2 points (no arc) ───────────────────

  it('_drawAnglePreview with 2 points draws ray but no arc', () => {
    const overlay = new MeasurementOverlay(container, { zoom: 1 });
    overlay.setTool('distance');
    const ctx = overlay._ctx;
    overlay._drawAnglePreview(ctx, [{ x: 100, y: 0 }, { x: 0, y: 0 }], 1);
    assert.ok(true);
    overlay.deactivate();
  });

  // ── _drawPolyline with closed=true fills ────────────────────────────────

  it('_drawPolyline with closed=true calls fill', () => {
    const overlay = new MeasurementOverlay(container, { zoom: 1 });
    overlay.setTool('distance');
    const ctx = overlay._ctx;
    let fillCalled = false;
    ctx.fill = () => { fillCalled = true; };
    overlay._drawPolyline(ctx, [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], 1, true);
    assert.ok(fillCalled);
    overlay.deactivate();
  });

  // ── Area tool with unknown unit label ───────────────────────────────────

  it('area tool uses raw unit string for unknown units', () => {
    const overlay = new MeasurementOverlay(container, { zoom: 1, unit: 'furlongs' });
    overlay.setTool('area');

    overlay._onMouseDown({ clientX: 0, clientY: 0 });
    overlay._onMouseDown({ clientX: 72, clientY: 0 });
    overlay._onMouseDown({ clientX: 72, clientY: 72 });
    overlay._onDblClick({});

    const ms = overlay.getMeasurements();
    assert.equal(ms.length, 1);
    assert.ok(ms[0].formatted.includes('furlongs'));
    overlay.deactivate();
  });
});
