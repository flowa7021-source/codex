// ─── Unit Tests: Geohash Encoding / Decoding ─────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { encode, decode, bounds, neighbors, distance } from '../../app/modules/geohash.js';

// ─── encode ───────────────────────────────────────────────────────────────────

describe('encode', () => {
  it('returns a string of the requested precision', () => {
    assert.equal(encode(51.5074, -0.1278, 6).length, 6);
    assert.equal(encode(0, 0, 1).length, 1);
    assert.equal(encode(0, 0, 12).length, 12);
  });

  it('default precision is 9', () => {
    assert.equal(encode(51.5074, -0.1278).length, 9);
  });

  it('known value – London at precision 6 starts with gcpvj', () => {
    // lat=51.5074, lon=-0.1278 → gcpvj0 (standard geohash)
    const h = encode(51.5074, -0.1278, 6);
    assert.ok(
      h.startsWith('gcpvj'),
      `expected hash starting with 'gcpvj', got '${h}'`,
    );
  });

  it('known value – London at precision 9', () => {
    assert.equal(encode(51.5074, -0.1278, 9), 'gcpvj0duq');
  });

  it('known value – equator/prime-meridian', () => {
    // (0, 0) should hash to an all-s…  cell around the origin
    const h = encode(0, 0, 5);
    assert.equal(typeof h, 'string');
    assert.equal(h.length, 5);
  });

  it('throws RangeError for lat > 90', () => {
    assert.throws(() => encode(91, 0), RangeError);
  });

  it('throws RangeError for lat < -90', () => {
    assert.throws(() => encode(-91, 0), RangeError);
  });

  it('throws RangeError for lon > 180', () => {
    assert.throws(() => encode(0, 181), RangeError);
  });

  it('throws RangeError for lon < -180', () => {
    assert.throws(() => encode(0, -181), RangeError);
  });

  it('throws RangeError for precision < 1', () => {
    assert.throws(() => encode(0, 0, 0), RangeError);
  });

  it('accepts boundary lat/lon values', () => {
    assert.equal(encode(90, 180, 5).length, 5);
    assert.equal(encode(-90, -180, 5).length, 5);
  });
});

// ─── decode ───────────────────────────────────────────────────────────────────

describe('decode', () => {
  it('returns an object with lat and lon properties', () => {
    const result = decode('gcpvj0');
    assert.ok(typeof result.lat === 'number');
    assert.ok(typeof result.lon === 'number');
  });

  it('encode → decode roundtrip within tolerance for precision 9', () => {
    // At precision 9 the cell is ~±0.000021° lat × ±0.000021° lon
    const tolerance = 0.0001;
    const lat = 48.8566;
    const lon = 2.3522;
    const result = decode(encode(lat, lon, 9));
    assert.ok(
      Math.abs(result.lat - lat) <= tolerance,
      `lat drift: ${Math.abs(result.lat - lat)}`,
    );
    assert.ok(
      Math.abs(result.lon - lon) <= tolerance,
      `lon drift: ${Math.abs(result.lon - lon)}`,
    );
  });

  it('encode → decode roundtrip for various precisions', () => {
    const points = [
      { lat: 35.6762, lon: 139.6503 }, // Tokyo
      { lat: -33.8688, lon: 151.2093 }, // Sydney
      { lat: 40.7128, lon: -74.006 },   // New York
    ];
    // At precision p the error is at most 360 / 2^(5p/2 - 1) degrees ≈ a few km
    for (const { lat, lon } of points) {
      for (const precision of [5, 7, 9]) {
        const result = decode(encode(lat, lon, precision));
        // Rough tolerance: cell half-width grows as precision drops
        const tolerance = precision >= 9 ? 0.001 : precision >= 7 ? 0.05 : 1.5;
        assert.ok(
          Math.abs(result.lat - lat) <= tolerance,
          `lat drift at p${precision}: ${Math.abs(result.lat - lat)}`,
        );
        assert.ok(
          Math.abs(result.lon - lon) <= tolerance,
          `lon drift at p${precision}: ${Math.abs(result.lon - lon)}`,
        );
      }
    }
  });

  it('throws for empty string', () => {
    assert.throws(() => decode(''), /empty/i);
  });

  it('throws for string with invalid character', () => {
    // 'a', 'i', 'l', 'o' are not in the base32 charset
    assert.throws(() => decode('gcpvia'), Error);
  });

  it('throws for string containing only invalid characters', () => {
    assert.throws(() => decode('!!!!'), Error);
  });

  it('decoded center lies inside the bounds of the same hash', () => {
    const hash = 'gcpvj0';
    const { lat, lon } = decode(hash);
    const b = bounds(hash);
    assert.ok(lat >= b.minLat && lat <= b.maxLat, 'lat inside bounds');
    assert.ok(lon >= b.minLon && lon <= b.maxLon, 'lon inside bounds');
  });
});

// ─── bounds ───────────────────────────────────────────────────────────────────

describe('bounds', () => {
  it('returns object with minLat, maxLat, minLon, maxLon', () => {
    const b = bounds('gcpvj0');
    assert.ok('minLat' in b && 'maxLat' in b && 'minLon' in b && 'maxLon' in b);
  });

  it('minLat < maxLat', () => {
    const b = bounds('gcpvj0');
    assert.ok(b.minLat < b.maxLat, `minLat=${b.minLat} maxLat=${b.maxLat}`);
  });

  it('minLon < maxLon', () => {
    const b = bounds('gcpvj0');
    assert.ok(b.minLon < b.maxLon, `minLon=${b.minLon} maxLon=${b.maxLon}`);
  });

  it('area decreases as precision increases', () => {
    const area = (b) => (b.maxLat - b.minLat) * (b.maxLon - b.minLon);
    const base = encode(51.5074, -0.1278, 1);
    let prev = area(bounds(base));
    for (let p = 2; p <= 8; p++) {
      const h = encode(51.5074, -0.1278, p);
      const curr = area(bounds(h));
      assert.ok(curr < prev, `area at p${p} (${curr}) should be < p${p - 1} (${prev})`);
      prev = curr;
    }
  });

  it('bounds at precision 1 covers a large area', () => {
    const b = bounds(encode(0, 0, 1));
    const latSpan = b.maxLat - b.minLat;
    const lonSpan = b.maxLon - b.minLon;
    // A precision-1 cell spans 45° lat × 45° lon
    assert.ok(latSpan > 10, `expected wide lat span, got ${latSpan}`);
    assert.ok(lonSpan > 10, `expected wide lon span, got ${lonSpan}`);
  });

  it('throws for empty string', () => {
    assert.throws(() => bounds(''), /empty/i);
  });

  it('throws for invalid characters', () => {
    assert.throws(() => bounds('aaaa'), Error);
  });
});

// ─── neighbors ────────────────────────────────────────────────────────────────

describe('neighbors', () => {
  const hash = 'gcpvj0';

  it('returns exactly 8 keys', () => {
    const n = neighbors(hash);
    assert.equal(Object.keys(n).length, 8);
  });

  it('returns all required direction keys', () => {
    const n = neighbors(hash);
    const expected = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
    for (const key of expected) {
      assert.ok(key in n, `missing key: ${key}`);
    }
  });

  it('all neighbor hashes have the same precision', () => {
    const n = neighbors(hash);
    for (const [dir, nh] of Object.entries(n)) {
      assert.equal(
        nh.length,
        hash.length,
        `neighbor '${dir}' has wrong length: ${nh.length}`,
      );
    }
  });

  it('northern neighbor center is north of the original center', () => {
    const center = decode(hash);
    const northCenter = decode(neighbors(hash).n);
    assert.ok(
      northCenter.lat > center.lat,
      `north (${northCenter.lat}) should be > center (${center.lat})`,
    );
  });

  it('southern neighbor center is south of the original center', () => {
    const center = decode(hash);
    const southCenter = decode(neighbors(hash).s);
    assert.ok(
      southCenter.lat < center.lat,
      `south (${southCenter.lat}) should be < center (${center.lat})`,
    );
  });

  it('eastern neighbor center is east of the original center', () => {
    const center = decode(hash);
    const eastCenter = decode(neighbors(hash).e);
    assert.ok(
      eastCenter.lon > center.lon,
      `east (${eastCenter.lon}) should be > center (${center.lon})`,
    );
  });

  it('western neighbor center is west of the original center', () => {
    const center = decode(hash);
    const westCenter = decode(neighbors(hash).w);
    assert.ok(
      westCenter.lon < center.lon,
      `west (${westCenter.lon}) should be < center (${center.lon})`,
    );
  });

  it('neighbor of a neighbor is not the original hash', () => {
    const n = neighbors(hash);
    // Two steps north should differ from the original
    const nn = neighbors(n.n).n;
    assert.notEqual(nn, hash);
  });

  it('throws for empty string', () => {
    assert.throws(() => neighbors(''), /empty/i);
  });
});

// ─── distance ─────────────────────────────────────────────────────────────────

describe('distance', () => {
  it('two identical hashes have 0 distance', () => {
    assert.equal(distance('gcpvj0', 'gcpvj0'), 0);
  });

  it('is symmetric', () => {
    const london = encode(51.5074, -0.1278, 6);
    const paris = encode(48.8566, 2.3522, 6);
    assert.equal(distance(london, paris), distance(paris, london));
  });

  it('London to Paris is approximately 340 km', () => {
    const london = encode(51.5074, -0.1278, 9);
    const paris = encode(48.8566, 2.3522, 9);
    const km = distance(london, paris);
    // Actual great-circle ~340 km; allow ±10 km for cell-center rounding
    assert.ok(km > 330 && km < 350, `expected ~340 km, got ${km.toFixed(1)} km`);
  });

  it('New York to Los Angeles is approximately 3940 km', () => {
    const nyc = encode(40.7128, -74.006, 9);
    const lax = encode(34.0522, -118.2437, 9);
    const km = distance(nyc, lax);
    // Actual ~3940 km; allow ±50 km
    assert.ok(km > 3890 && km < 3990, `expected ~3940 km, got ${km.toFixed(1)} km`);
  });

  it('adjacent neighbors are closer than non-adjacent cells', () => {
    const h = 'gcpvj0';
    const n = neighbors(h);
    const dNorth = distance(h, n.n);
    const dFar = distance(h, encode(0, 0, h.length)); // far away
    assert.ok(dNorth < dFar, `adjacent (${dNorth}) should be < far (${dFar})`);
  });

  it('returns a non-negative number', () => {
    const d = distance(encode(10, 10, 6), encode(20, 20, 6));
    assert.ok(d >= 0, `distance should be non-negative, got ${d}`);
  });

  it('throws for empty hash1', () => {
    assert.throws(() => distance('', 'gcpvj0'), Error);
  });

  it('throws for invalid characters in hash2', () => {
    assert.throws(() => distance('gcpvj0', 'aaaaaaa'), Error);
  });
});
