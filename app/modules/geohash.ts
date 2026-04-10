// @ts-check
// ─── Geohash Encoding / Decoding ─────────────────────────────────────────────
// Implements the standard Geohash algorithm (Gustavo Niemeyer, 2008).
// Base32 charset: 0123456789bcdefghjkmnpqrstuvwxyz

// ─── Types ────────────────────────────────────────────────────────────────────

/** Axis-aligned bounding box of a geohash cell. */
export interface GeohashBounds {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

/** Reverse lookup: character → 5-bit integer. */
const DECODE_MAP: Map<string, number> = new Map(
  BASE32.split('').map((ch, i) => [ch, i] as [string, number]),
);

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Decode a geohash string into its bounding box.
 * Used internally by `decode`, `bounds`, and `neighbors`.
 */
function decodeBounds(hash: string): GeohashBounds {
  if (hash.length === 0) {
    throw new Error('geohash: hash must not be empty');
  }

  let minLat = -90;
  let maxLat = 90;
  let minLon = -180;
  let maxLon = 180;
  let isLon = true; // longitude bits come first

  for (const ch of hash) {
    const bits = DECODE_MAP.get(ch);
    if (bits === undefined) {
      throw new Error(`geohash: invalid character '${ch}'`);
    }
    // Each character contributes 5 bits, MSB first.
    for (let shift = 4; shift >= 0; shift--) {
      const bit = (bits >> shift) & 1;
      if (isLon) {
        const mid = (minLon + maxLon) / 2;
        if (bit) minLon = mid;
        else maxLon = mid;
      } else {
        const mid = (minLat + maxLat) / 2;
        if (bit) minLat = mid;
        else maxLat = mid;
      }
      isLon = !isLon;
    }
  }

  return { minLat, maxLat, minLon, maxLon };
}

// ─── encode ───────────────────────────────────────────────────────────────────

/**
 * Encode a latitude/longitude pair to a geohash string.
 *
 * @param lat       Latitude in degrees  [-90, 90].
 * @param lon       Longitude in degrees [-180, 180].
 * @param precision Number of geohash characters (default 9).
 * @returns Geohash string of the requested length.
 * @throws {RangeError} If lat or lon is out of range, or precision < 1.
 */
export function encode(lat: number, lon: number, precision: number = 9): string {
  if (lat < -90 || lat > 90) {
    throw new RangeError(`geohash: lat must be in [-90, 90], got ${lat}`);
  }
  if (lon < -180 || lon > 180) {
    throw new RangeError(`geohash: lon must be in [-180, 180], got ${lon}`);
  }
  if (precision < 1 || !Number.isInteger(precision)) {
    throw new RangeError(`geohash: precision must be an integer ≥ 1, got ${precision}`);
  }

  let minLat = -90;
  let maxLat = 90;
  let minLon = -180;
  let maxLon = 180;
  let isLon = true;

  let result = '';
  let bits = 0;
  let bitsCount = 0;

  while (result.length < precision) {
    if (isLon) {
      const mid = (minLon + maxLon) / 2;
      if (lon >= mid) {
        bits = (bits << 1) | 1;
        minLon = mid;
      } else {
        bits = bits << 1;
        maxLon = mid;
      }
    } else {
      const mid = (minLat + maxLat) / 2;
      if (lat >= mid) {
        bits = (bits << 1) | 1;
        minLat = mid;
      } else {
        bits = bits << 1;
        maxLat = mid;
      }
    }
    isLon = !isLon;
    bitsCount++;

    if (bitsCount === 5) {
      result += BASE32[bits];
      bits = 0;
      bitsCount = 0;
    }
  }

  return result;
}

// ─── decode ───────────────────────────────────────────────────────────────────

/**
 * Decode a geohash string to the center latitude/longitude of its cell.
 *
 * @param hash Geohash string (non-empty, valid base32 characters only).
 * @returns `{ lat, lon }` at the center of the cell.
 * @throws {Error} If `hash` is empty or contains invalid characters.
 */
export function decode(hash: string): { lat: number; lon: number } {
  const b = decodeBounds(hash);
  return {
    lat: (b.minLat + b.maxLat) / 2,
    lon: (b.minLon + b.maxLon) / 2,
  };
}

// ─── bounds ───────────────────────────────────────────────────────────────────

/**
 * Return the bounding box for the given geohash cell.
 *
 * @param hash Geohash string.
 * @returns `GeohashBounds` with minLat, maxLat, minLon, maxLon.
 * @throws {Error} If `hash` is empty or contains invalid characters.
 */
export function bounds(hash: string): GeohashBounds {
  return decodeBounds(hash);
}

// ─── neighbors ────────────────────────────────────────────────────────────────

/**
 * Return the 8 neighboring geohashes of the given cell, at the same precision.
 *
 * @param hash Geohash string.
 * @returns Record keyed by 'n','s','e','w','ne','nw','se','sw'.
 * @throws {Error} If `hash` is empty or contains invalid characters.
 */
export function neighbors(
  hash: string,
): Record<'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw', string> {
  if (hash.length === 0) {
    throw new Error('geohash: hash must not be empty');
  }

  const b = decodeBounds(hash);
  const precision = hash.length;

  const latStep = b.maxLat - b.minLat;
  const lonStep = b.maxLon - b.minLon;
  const centerLat = (b.minLat + b.maxLat) / 2;
  const centerLon = (b.minLon + b.maxLon) / 2;

  // Clamp helper — wraps longitude, clamps latitude.
  const neighborHash = (dLat: number, dLon: number): string => {
    let nLat = centerLat + dLat * latStep;
    let nLon = centerLon + dLon * lonStep;
    // Wrap longitude
    if (nLon > 180) nLon -= 360;
    if (nLon < -180) nLon += 360;
    // Clamp latitude
    nLat = Math.max(-90, Math.min(90, nLat));
    return encode(nLat, nLon, precision);
  };

  return {
    n: neighborHash(1, 0),
    s: neighborHash(-1, 0),
    e: neighborHash(0, 1),
    w: neighborHash(0, -1),
    ne: neighborHash(1, 1),
    nw: neighborHash(1, -1),
    se: neighborHash(-1, 1),
    sw: neighborHash(-1, -1),
  };
}

// ─── distance ─────────────────────────────────────────────────────────────────

const EARTH_RADIUS_KM = 6371;

/**
 * Approximate great-circle distance in kilometres between the centers of two
 * geohash cells, using the haversine formula.
 *
 * @param hash1 First geohash string.
 * @param hash2 Second geohash string.
 * @returns Distance in kilometres.
 * @throws {Error} If either hash is empty or contains invalid characters.
 */
export function distance(hash1: string, hash2: string): number {
  const c1 = decode(hash1);
  const c2 = decode(hash2);

  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(c2.lat - c1.lat);
  const dLon = toRad(c2.lon - c1.lon);
  const lat1 = toRad(c1.lat);
  const lat2 = toRad(c2.lat);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
}
