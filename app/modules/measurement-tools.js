// @ts-check
/**
 * @module measurement-tools
 * @description PDF measurement toolkit — distance, area, angle, perimeter.
 *
 * All measurements work in PDF points (1 pt = 1/72 inch) and can be
 * converted to mm / cm / inches via the scale factor.
 *
 * Tools:
 *   • **Distance** — straight line between two points
 *   • **Polyline distance** — total length of a multi-segment path
 *   • **Area** — polygon area (Shoelace formula)
 *   • **Perimeter** — polygon perimeter
 *   • **Angle** — three-point angle measurement
 *   • **Rectangle** — width × height of a bounding box
 *
 * UI overlay draws calibrated rulers / shapes on a transparent canvas.
 *
 * Usage:
 *   import { MeasurementOverlay, measureDistance, measureAngle } from './measurement-tools.js';
 *
 *   const overlay = new MeasurementOverlay(pageContainer, { scale: 1, unit: 'mm' });
 *   overlay.setTool('distance');
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PT_PER_INCH = 72;
const MM_PER_INCH = 25.4;
const CM_PER_INCH = 2.54;

const UNIT_FACTORS = {
  pt:     1,
  in:     1 / PT_PER_INCH,
  mm:     MM_PER_INCH / PT_PER_INCH,
  cm:     CM_PER_INCH / PT_PER_INCH,
};

const UNIT_LABELS = { pt: 'pt', in: 'in', mm: 'mm', cm: 'cm' };

const OVERLAY_STYLES = {
  lineColor:   '#0078d4',
  lineWidth:   2,
  handleSize:  6,
  fontSize:    12,
  fontFamily:  'sans-serif',
  fillColor:   'rgba(0, 120, 212, 0.08)',
  angleColor:  '#e65100',
  labelBg:     'rgba(30, 30, 30, 0.85)',
  labelColor:  '#fff',
};

// ---------------------------------------------------------------------------
// Pure measurement functions
// ---------------------------------------------------------------------------

/**
 * Distance between two points in PDF pt.
 * @param {{ x: number, y: number }} a
 * @param {{ x: number, y: number }} b
 * @returns {number}
 */
export function measureDistance(a, b) {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
}

/**
 * Total length of a polyline (array of points).
 * @param {{ x: number, y: number }[]} points
 * @returns {number}
 */
export function measurePolylineLength(points) {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += measureDistance(points[i - 1], points[i]);
  }
  return total;
}

/**
 * Angle in degrees at vertex B formed by segments BA and BC.
 * @param {{ x: number, y: number }} a
 * @param {{ x: number, y: number }} b – vertex
 * @param {{ x: number, y: number }} c
 * @returns {number} – angle in degrees [0..360)
 */
export function measureAngle(a, b, c) {
  const ba = { x: a.x - b.x, y: a.y - b.y };
  const bc = { x: c.x - b.x, y: c.y - b.y };

  const dot   = ba.x * bc.x + ba.y * bc.y;
  const cross = ba.x * bc.y - ba.y * bc.x;
  let angle   = Math.atan2(Math.abs(cross), dot) * (180 / Math.PI);

  // Always return the interior angle [0..180]
  if (angle < 0) angle += 360;
  return angle;
}

/**
 * Area of a polygon (Shoelace formula). Result in pt².
 * @param {{ x: number, y: number }[]} vertices – at least 3 points, not closed
 * @returns {number}
 */
export function measurePolygonArea(vertices) {
  const n = vertices.length;
  if (n < 3) return 0;

  let area = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += vertices[i].x * vertices[j].y;
    area -= vertices[j].x * vertices[i].y;
  }

  return Math.abs(area) / 2;
}

/**
 * Perimeter of a polygon in pt.
 * @param {{ x: number, y: number }[]} vertices
 * @returns {number}
 */
export function measurePolygonPerimeter(vertices) {
  if (vertices.length < 2) return 0;
  const closed = [...vertices, vertices[0]];
  return measurePolylineLength(closed);
}

/**
 * Rectangle dimensions from two corner points.
 * @param {{ x: number, y: number }} a
 * @param {{ x: number, y: number }} b
 * @returns {{ width: number, height: number, area: number }}
 */
export function measureRectangle(a, b) {
  const width  = Math.abs(b.x - a.x);
  const height = Math.abs(b.y - a.y);
  return { width, height, area: width * height };
}

/**
 * Convert a measurement from pt to the specified unit.
 * @param {number} valuePt
 * @param {string} unit – 'pt' | 'in' | 'mm' | 'cm'
 * @returns {number}
 */
export function convertUnit(valuePt, unit) {
  return valuePt * (UNIT_FACTORS[unit] ?? 1);
}

/**
 * Convert an area measurement from pt² to the specified unit².
 * @param {number} areaPtSq
 * @param {string} unit
 * @returns {number}
 */
export function convertAreaUnit(areaPtSq, unit) {
  const f = UNIT_FACTORS[unit] ?? 1;
  return areaPtSq * f * f;
}

/**
 * Format a measurement value with unit label.
 * @param {number} valuePt
 * @param {string} unit
 * @param {number} [decimals=2]
 * @returns {string}
 */
export function formatMeasurement(valuePt, unit, decimals = 2) {
  const converted = convertUnit(valuePt, unit);
  return `${converted.toFixed(decimals)} ${UNIT_LABELS[unit] ?? unit}`;
}

// ---------------------------------------------------------------------------
// MeasurementOverlay — interactive UI
// ---------------------------------------------------------------------------

/**
 * @typedef {'distance'|'polyline'|'area'|'angle'|'rectangle'} MeasureTool
 */

export class MeasurementOverlay {
  /**
   * @param {HTMLElement} pageContainer – element containing the page canvas
   * @param {Object} [opts]
   * @param {number} [opts.zoom=1]
   * @param {string} [opts.unit='mm']
   * @param {number} [opts.pageWidthPt]
   * @param {number} [opts.pageHeightPt]
   */
  constructor(pageContainer, opts = {}) {
    this._container   = pageContainer;
    this._zoom        = opts.zoom        ?? 1;
    this._unit        = opts.unit        ?? 'mm';
    this._pageWidthPt = opts.pageWidthPt ?? 612;
    this._pageHeightPt = opts.pageHeightPt ?? 792;

    /** @type {MeasureTool|null} */
    this._tool   = null;
    this._points = [];
    this._active = false;
    this._measurements = [];   // completed measurements

    this._canvas = null;
    this._ctx    = null;

    this._onMouseDown = this._onMouseDown.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onDblClick  = this._onDblClick.bind(this);
    this._onKeyDown   = this._onKeyDown.bind(this);
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Activate a measurement tool.
   * @param {MeasureTool} tool
   */
  setTool(tool) {
    this._tool   = tool;
    this._points = [];
    this._active = true;

    if (!this._canvas) this._createCanvas();
    this._canvas.style.cursor = 'crosshair';
    this._draw();
  }

  /** Deactivate and remove the overlay. */
  deactivate() {
    this._active = false;
    this._tool   = null;
    this._points = [];
    this._removeCanvas();
  }

  setZoom(zoom) {
    this._zoom = zoom;
    if (this._canvas) {
      this._canvas.width  = Math.round(this._pageWidthPt * zoom);
      this._canvas.height = Math.round(this._pageHeightPt * zoom);
      this._draw();
    }
  }

  setUnit(unit) {
    this._unit = unit;
    this._draw();
  }

  /** Clear all completed measurements. */
  clearAll() {
    this._measurements = [];
    this._draw();
  }

  /** Get all completed measurements as data. */
  getMeasurements() {
    return this._measurements.map(m => ({
      tool:       m.tool,
      points:     m.points,
      value:      m.value,
      unit:       this._unit,
      formatted:  m.formatted,
    }));
  }

  destroy() {
    this.deactivate();
  }

  // ── Canvas management ──────────────────────────────────────────────────────

  _createCanvas() {
    this._canvas = document.createElement('canvas');
    this._canvas.width  = Math.round(this._pageWidthPt * this._zoom);
    this._canvas.height = Math.round(this._pageHeightPt * this._zoom);
    this._canvas.style.cssText = [
      'position:absolute', 'top:0', 'left:0',
      'pointer-events:auto', 'z-index:50',
    ].join(';');

    this._ctx = this._canvas.getContext('2d');
    if (!this._ctx) return;

    this._canvas.addEventListener('mousedown', this._onMouseDown);
    this._canvas.addEventListener('mousemove', this._onMouseMove);
    this._canvas.addEventListener('dblclick',  this._onDblClick);
    document.addEventListener('keydown', this._onKeyDown);

    this._container.style.position = 'relative';
    this._container.appendChild(this._canvas);
  }

  _removeCanvas() {
    if (this._canvas) {
      this._canvas.removeEventListener('mousedown', this._onMouseDown);
      this._canvas.removeEventListener('mousemove', this._onMouseMove);
      this._canvas.removeEventListener('dblclick',  this._onDblClick);
      document.removeEventListener('keydown', this._onKeyDown);
      this._canvas.remove();
      this._canvas = null;
      this._ctx    = null;
    }
  }

  // ── Event handlers ─────────────────────────────────────────────────────────

  _onMouseDown(e) {
    if (!this._active) return;
    const pt = this._canvasToPagePt(e);

    if (this._tool === 'distance') {
      this._points.push(pt);
      if (this._points.length === 2) this._commitMeasurement();
    } else if (this._tool === 'rectangle') {
      this._points.push(pt);
      if (this._points.length === 2) this._commitMeasurement();
    } else if (this._tool === 'angle') {
      this._points.push(pt);
      if (this._points.length === 3) this._commitMeasurement();
    } else if (this._tool === 'polyline' || this._tool === 'area') {
      this._points.push(pt);
    }

    this._draw();
  }

  _onMouseMove(e) {
    if (!this._active || this._points.length === 0) return;
    this._hoverPt = this._canvasToPagePt(e);
    this._draw();
  }

  _onDblClick(_e) {
    // Finish polyline / area
    if ((this._tool === 'polyline' || this._tool === 'area') && this._points.length >= 2) {
      this._commitMeasurement();
    }
  }

  _onKeyDown(e) {
    if (e.key === 'Escape') {
      this._points = [];
      this._hoverPt = null;
      this._draw();
    }
  }

  // ── Commit ─────────────────────────────────────────────────────────────────

  _commitMeasurement() {
    const pts  = [...this._points];
    const tool = this._tool;
    let value, formatted;

    if (tool === 'distance') {
      value     = measureDistance(pts[0], pts[1]);
      formatted = formatMeasurement(value, this._unit);
    } else if (tool === 'polyline') {
      value     = measurePolylineLength(pts);
      formatted = formatMeasurement(value, this._unit);
    } else if (tool === 'area') {
      const area = measurePolygonArea(pts);
      const perim = measurePolygonPerimeter(pts);
      value     = area;
      const u   = UNIT_LABELS[this._unit] ?? this._unit;
      formatted = `${convertAreaUnit(area, this._unit).toFixed(2)} ${u}²  (${formatMeasurement(perim, this._unit)} perim)`;
    } else if (tool === 'angle') {
      value     = measureAngle(pts[0], pts[1], pts[2]);
      formatted = `${value.toFixed(1)}°`;
    } else if (tool === 'rectangle') {
      const r   = measureRectangle(pts[0], pts[1]);
      value     = r.area;
      formatted = `${formatMeasurement(r.width, this._unit)} × ${formatMeasurement(r.height, this._unit)}`;
    }

    this._measurements.push({ tool, points: pts, value, formatted });
    this._points  = [];
    this._hoverPt = null;
    this._draw();
  }

  // ── Drawing ────────────────────────────────────────────────────────────────

  _draw() {
    if (!this._ctx) return;
    const ctx  = this._ctx;
    const z    = this._zoom;
    ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);

    // Draw completed measurements
    for (const m of this._measurements) {
      this._drawMeasurement(ctx, m, z, false);
    }

    // Draw in-progress
    if (this._points.length > 0) {
      const pts = [...this._points];
      if (this._hoverPt) pts.push(this._hoverPt);

      // Live measurement preview
      if (this._tool === 'distance' && pts.length >= 2) {
        this._drawLine(ctx, pts[0], pts[1], z, OVERLAY_STYLES.lineColor);
        this._drawLabel(ctx, _midpoint(pts[0], pts[1]), formatMeasurement(measureDistance(pts[0], pts[1]), this._unit), z);
      } else if (this._tool === 'polyline' && pts.length >= 2) {
        this._drawPolyline(ctx, pts, z, false);
        this._drawLabel(ctx, pts[pts.length - 1], formatMeasurement(measurePolylineLength(pts), this._unit), z);
      } else if (this._tool === 'area' && pts.length >= 2) {
        this._drawPolyline(ctx, pts, z, true);
      } else if (this._tool === 'angle' && pts.length >= 2) {
        this._drawAnglePreview(ctx, pts, z);
      } else if (this._tool === 'rectangle' && pts.length >= 2) {
        this._drawRect(ctx, pts[0], pts[1], z);
      }

      // Draw handles
      for (const p of this._points) {
        this._drawHandle(ctx, p, z);
      }
    }
  }

  _drawMeasurement(ctx, m, z, _isPreview) {
    const pts = m.points;

    if (m.tool === 'distance') {
      this._drawLine(ctx, pts[0], pts[1], z, OVERLAY_STYLES.lineColor);
      this._drawLabel(ctx, _midpoint(pts[0], pts[1]), m.formatted, z);
      this._drawHandle(ctx, pts[0], z);
      this._drawHandle(ctx, pts[1], z);
    } else if (m.tool === 'polyline') {
      this._drawPolyline(ctx, pts, z, false);
      this._drawLabel(ctx, pts[pts.length - 1], m.formatted, z);
    } else if (m.tool === 'area') {
      this._drawPolyline(ctx, pts, z, true);
      this._drawLabel(ctx, _centroid(pts), m.formatted, z);
    } else if (m.tool === 'angle') {
      this._drawAnglePreview(ctx, pts, z);
      this._drawLabel(ctx, pts[1], m.formatted, z);
    } else if (m.tool === 'rectangle') {
      this._drawRect(ctx, pts[0], pts[1], z);
      this._drawLabel(ctx, _midpoint(pts[0], pts[1]), m.formatted, z);
    }
  }

  _drawLine(ctx, a, b, z, color) {
    ctx.beginPath();
    ctx.moveTo(a.x * z, a.y * z);
    ctx.lineTo(b.x * z, b.y * z);
    ctx.strokeStyle = color;
    ctx.lineWidth   = OVERLAY_STYLES.lineWidth;
    ctx.setLineDash([6, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  _drawPolyline(ctx, pts, z, closed) {
    if (pts.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(pts[0].x * z, pts[0].y * z);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x * z, pts[i].y * z);
    }
    if (closed) ctx.closePath();
    if (closed) {
      ctx.fillStyle = OVERLAY_STYLES.fillColor;
      ctx.fill();
    }
    ctx.strokeStyle = OVERLAY_STYLES.lineColor;
    ctx.lineWidth   = OVERLAY_STYLES.lineWidth;
    ctx.stroke();

    for (const p of pts) this._drawHandle(ctx, p, z);
  }

  _drawRect(ctx, a, b, z) {
    const x = Math.min(a.x, b.x) * z;
    const y = Math.min(a.y, b.y) * z;
    const w = Math.abs(b.x - a.x) * z;
    const h = Math.abs(b.y - a.y) * z;

    ctx.fillStyle   = OVERLAY_STYLES.fillColor;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = OVERLAY_STYLES.lineColor;
    ctx.lineWidth   = OVERLAY_STYLES.lineWidth;
    ctx.setLineDash([6, 3]);
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);

    this._drawHandle(ctx, a, z);
    this._drawHandle(ctx, b, z);

    const r = measureRectangle(a, b);
    const label = `${formatMeasurement(r.width, this._unit)} × ${formatMeasurement(r.height, this._unit)}`;
    this._drawLabel(ctx, _midpoint(a, b), label, z);
  }

  _drawAnglePreview(ctx, pts, z) {
    if (pts.length < 2) return;

    // Draw the two rays
    this._drawLine(ctx, pts[1], pts[0], z, OVERLAY_STYLES.angleColor);
    if (pts.length >= 3) {
      this._drawLine(ctx, pts[1], pts[2], z, OVERLAY_STYLES.angleColor);

      // Draw arc
      const angle1 = Math.atan2(pts[0].y - pts[1].y, pts[0].x - pts[1].x);
      const angle2 = Math.atan2(pts[2].y - pts[1].y, pts[2].x - pts[1].x);
      const radius = 30;

      ctx.beginPath();
      ctx.arc(pts[1].x * z, pts[1].y * z, radius, angle1, angle2, false);
      ctx.strokeStyle = OVERLAY_STYLES.angleColor;
      ctx.lineWidth   = 1.5;
      ctx.stroke();

      const deg = measureAngle(pts[0], pts[1], pts[2]);
      this._drawLabel(ctx, pts[1], `${deg.toFixed(1)}°`, z);
    }

    for (const p of pts) this._drawHandle(ctx, p, z);
  }

  _drawHandle(ctx, p, z) {
    const s = OVERLAY_STYLES.handleSize;
    ctx.fillStyle = OVERLAY_STYLES.lineColor;
    ctx.fillRect(p.x * z - s / 2, p.y * z - s / 2, s, s);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth   = 1;
    ctx.strokeRect(p.x * z - s / 2, p.y * z - s / 2, s, s);
  }

  _drawLabel(ctx, p, text, z) {
    ctx.font      = `${OVERLAY_STYLES.fontSize}px ${OVERLAY_STYLES.fontFamily}`;
    const metrics = ctx.measureText(text);
    const padX    = 6;
    const padY    = 3;
    const lx      = p.x * z + 12;
    const ly      = p.y * z - 12;

    ctx.fillStyle = OVERLAY_STYLES.labelBg;
    ctx.fillRect(lx - padX, ly - OVERLAY_STYLES.fontSize - padY, metrics.width + padX * 2, OVERLAY_STYLES.fontSize + padY * 2);
    ctx.fillStyle = OVERLAY_STYLES.labelColor;
    ctx.fillText(text, lx, ly);
  }

  // ── Coordinate conversion ──────────────────────────────────────────────────

  _canvasToPagePt(e) {
    const rect = this._canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / this._zoom,
      y: (e.clientY - rect.top)  / this._zoom,
    };
  }
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

function _midpoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function _centroid(pts) {
  const n = pts.length;
  if (n === 0) return { x: 0, y: 0 };
  let sx = 0, sy = 0;
  for (const p of pts) { sx += p.x; sy += p.y; }
  return { x: sx / n, y: sy / n };
}
