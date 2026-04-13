// ─── Unit Tests: Haversine / Geocoordinate Utilities ─────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  toRadians,
  toDegrees,
  normalize,
  haversine,
  bearing,
  destination,
  midpoint,
  boundingBox,
} from '../../app/modules/haversine.js';

describe('toRadians / toDegrees', () => {
  it('toRadians: 180° = π', () => { assert.ok(Math.abs(toRadians(180) - Math.PI) < 1e-12); });
  it('toRadians: 0° = 0', () => { assert.equal(toRadians(0), 0); });
  it('toDegrees: π = 180°', () => { assert.ok(Math.abs(toDegrees(Math.PI) - 180) < 1e-10); });
  it('roundtrip', () => { assert.ok(Math.abs(toDegrees(toRadians(45)) - 45) < 1e-10); });
});

describe('normalize', () => {
  it('clamps lat to -90', () => { assert.equal(normalize({ lat: -100, lon: 0 }).lat, -90); });
  it('clamps lat to 90', () => { assert.equal(normalize({ lat: 100, lon: 0 }).lat, 90); });
  it('wraps lon 190 to -170', () => {
    const { lon } = normalize({ lat: 0, lon: 190 });
    assert.ok(Math.abs(lon - (-170)) < 1e-10);
  });
  it('leaves valid coordinates unchanged', () => {
    const p = normalize({ lat: 51.5, lon: -0.1 });
    assert.ok(Math.abs(p.lat - 51.5) < 1e-10);
    assert.ok(Math.abs(p.lon - (-0.1)) < 1e-10);
  });
});

describe('haversine', () => {
  it('same point → 0', () => {
    const london = { lat: 51.5074, lon: -0.1278 };
    assert.equal(haversine(london, london), 0);
  });
  it('London to Paris ≈ 340 km (within 5 km)', () => {
    const d = haversine({ lat: 51.5074, lon: -0.1278 }, { lat: 48.8566, lon: 2.3522 });
    assert.ok(d > 335 && d < 345, `expected ~340, got ${d}`);
  });
  it('NY to London ≈ 5570 km (within 100 km)', () => {
    const d = haversine({ lat: 40.7128, lon: -74.0060 }, { lat: 51.5074, lon: -0.1278 });
    assert.ok(d > 5470 && d < 5670, `expected ~5570, got ${d}`);
  });
  it('is symmetric', () => {
    const a = { lat: 48.8566, lon: 2.3522 };
    const b = { lat: 52.5200, lon: 13.4050 };
    assert.ok(Math.abs(haversine(a, b) - haversine(b, a)) < 1e-6);
  });
});

describe('bearing', () => {
  it('due north → ~0', () => {
    const b = bearing({ lat: 0, lon: 0 }, { lat: 10, lon: 0 });
    assert.ok(b < 1 || b > 359, `expected ~0, got ${b}`);
  });
  it('due east → ~90', () => {
    const b = bearing({ lat: 0, lon: 0 }, { lat: 0, lon: 10 });
    assert.ok(Math.abs(b - 90) < 1, `expected ~90, got ${b}`);
  });
  it('due south → ~180', () => {
    const b = bearing({ lat: 10, lon: 0 }, { lat: 0, lon: 0 });
    assert.ok(Math.abs(b - 180) < 1, `expected ~180, got ${b}`);
  });
  it('returns value in [0, 360)', () => {
    const b = bearing({ lat: 51.5, lon: -0.1 }, { lat: 48.8, lon: 2.3 });
    assert.ok(b >= 0 && b < 360);
  });
});

describe('destination', () => {
  it('0 km → same point', () => {
    const start = { lat: 51.5, lon: -0.1 };
    const end = destination(start, 0, 0);
    assert.ok(Math.abs(end.lat - start.lat) < 1e-10);
    assert.ok(Math.abs(end.lon - start.lon) < 1e-10);
  });
  it('heading north 100 km → lat increases', () => {
    const end = destination({ lat: 0, lon: 0 }, 0, 100);
    assert.ok(end.lat > 0);
  });
  it('destination is ~correct distance from start', () => {
    const start = { lat: 48.8566, lon: 2.3522 };
    const end = destination(start, 90, 100);
    const d = haversine(start, end);
    assert.ok(Math.abs(d - 100) < 1, `expected ~100, got ${d}`);
  });
});

describe('midpoint', () => {
  it('midpoint of same point is that point', () => {
    const p = { lat: 51.5, lon: -0.1 };
    const m = midpoint(p, p);
    assert.ok(Math.abs(m.lat - p.lat) < 1e-6);
    assert.ok(Math.abs(m.lon - p.lon) < 1e-6);
  });
  it('midpoint is equidistant from both ends', () => {
    const a = { lat: 0, lon: 0 };
    const b_ = { lat: 10, lon: 0 };
    const m = midpoint(a, b_);
    const da = haversine(a, m);
    const db = haversine(b_, m);
    assert.ok(Math.abs(da - db) < 1, `da=${da}, db=${db}`);
  });
});

describe('boundingBox', () => {
  it('center is inside bounding box', () => {
    const c = { lat: 51.5, lon: -0.1 };
    const box = boundingBox(c, 50);
    assert.ok(box.minLat < c.lat && c.lat < box.maxLat);
    assert.ok(box.minLon < c.lon && c.lon < box.maxLon);
  });
  it('minLat < maxLat and minLon < maxLon', () => {
    const box = boundingBox({ lat: 0, lon: 0 }, 100);
    assert.ok(box.minLat < box.maxLat);
    assert.ok(box.minLon < box.maxLon);
  });
  it('larger radius → larger box', () => {
    const c = { lat: 48.8, lon: 2.3 };
    const small = boundingBox(c, 10);
    const large = boundingBox(c, 100);
    assert.ok(large.maxLat - large.minLat > small.maxLat - small.minLat);
  });
});
