// ─── Haversine / Geocoordinate Utilities ─────────────────────────────────────
// @ts-check
// Geographic distance, bearing, and coordinate utilities for NovaReader.
// Earth radius constant: 6371 km (mean radius).

// ─── Types ───────────────────────────────────────────────────────────────────

/** A geographic coordinate expressed in decimal degrees. */
export interface GeoPoint {
  lat: number;
  lon: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** Mean Earth radius in kilometres (IUGG recommendation). */
const EARTH_RADIUS_KM = 6371;

// ─── Angle Helpers ───────────────────────────────────────────────────────────

/**
 * Convert decimal degrees to radians.
 *
 * @param deg - Angle in degrees
 */
export function toRadians(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Convert radians to decimal degrees.
 *
 * @param rad - Angle in radians
 */
export function toDegrees(rad: number): number {
  return rad * (180 / Math.PI);
}

// ─── Normalization ───────────────────────────────────────────────────────────

/**
 * Normalize a GeoPoint so that:
 *  - lat is clamped to [-90, 90]
 *  - lon is wrapped to [-180, 180)
 *
 * @param point - The coordinate to normalize
 */
export function normalize(point: GeoPoint): GeoPoint {
  const lat = Math.min(90, Math.max(-90, point.lat));

  // Wrap lon into [-180, 180) using modulo arithmetic.
  let lon = point.lon % 360;
  if (lon >= 180) lon -= 360;
  else if (lon < -180) lon += 360;

  return { lat, lon };
}

// ─── Haversine Distance ───────────────────────────────────────────────────────

/**
 * Compute the great-circle distance between two points using the Haversine
 * formula.  Both inputs are in decimal degrees; the result is in kilometres.
 *
 * @param a - First geographic point
 * @param b - Second geographic point
 */
export function haversine(a: GeoPoint, b: GeoPoint): number {
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);

  const h =
    sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

// ─── Bearing ─────────────────────────────────────────────────────────────────

/**
 * Compute the initial bearing (forward azimuth) from one point to another.
 * The result is in degrees, clockwise from true north, in the range [0, 360).
 *
 * @param from - Starting geographic point
 * @param to   - Destination geographic point
 */
export function bearing(from: GeoPoint, to: GeoPoint): number {
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);
  const dLon = toRadians(to.lon - from.lon);

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

  const theta = Math.atan2(y, x);
  return (toDegrees(theta) + 360) % 360;
}

// ─── Destination Point ───────────────────────────────────────────────────────

/**
 * Given a start point, an initial bearing (degrees clockwise from north), and
 * a distance (km), compute the destination point along a great-circle arc.
 *
 * @param start      - Origin geographic point
 * @param bearingDeg - Initial bearing in degrees (clockwise from north)
 * @param distanceKm - Distance to travel in kilometres
 */
export function destination(
  start: GeoPoint,
  bearingDeg: number,
  distanceKm: number,
): GeoPoint {
  const delta = distanceKm / EARTH_RADIUS_KM; // angular distance in radians
  const theta = toRadians(bearingDeg);

  const lat1 = toRadians(start.lat);
  const lon1 = toRadians(start.lon);

  const sinLat1 = Math.sin(lat1);
  const cosLat1 = Math.cos(lat1);
  const sinDelta = Math.sin(delta);
  const cosDelta = Math.cos(delta);

  const sinLat2 =
    sinLat1 * cosDelta + cosLat1 * sinDelta * Math.cos(theta);
  const lat2 = Math.asin(sinLat2);

  const y = Math.sin(theta) * sinDelta * cosLat1;
  const x = cosDelta - sinLat1 * sinLat2;
  const lon2 = lon1 + Math.atan2(y, x);

  return {
    lat: toDegrees(lat2),
    lon: ((toDegrees(lon2) + 540) % 360) - 180, // normalise to [-180, 180)
  };
}

// ─── Midpoint ────────────────────────────────────────────────────────────────

/**
 * Compute the geographic midpoint (centre of the great-circle arc) between
 * two points.
 *
 * @param a - First geographic point
 * @param b - Second geographic point
 */
export function midpoint(a: GeoPoint, b: GeoPoint): GeoPoint {
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const lon1 = toRadians(a.lon);
  const dLon = toRadians(b.lon - a.lon);

  const Bx = Math.cos(lat2) * Math.cos(dLon);
  const By = Math.cos(lat2) * Math.sin(dLon);

  const latMid = Math.atan2(
    Math.sin(lat1) + Math.sin(lat2),
    Math.sqrt((Math.cos(lat1) + Bx) ** 2 + By ** 2),
  );
  const lonMid = lon1 + Math.atan2(By, Math.cos(lat1) + Bx);

  return {
    lat: toDegrees(latMid),
    lon: ((toDegrees(lonMid) + 540) % 360) - 180,
  };
}

// ─── Bounding Box ────────────────────────────────────────────────────────────

/**
 * Compute the axis-aligned bounding box around a center point that entirely
 * contains all points within the given radius.
 *
 * Longitude extents are widened by 1/cos(lat) to account for meridian
 * convergence (approximate; valid for radii well below pole distances).
 *
 * @param center   - Center geographic point
 * @param radiusKm - Radius in kilometres
 */
export function boundingBox(
  center: GeoPoint,
  radiusKm: number,
): { minLat: number; maxLat: number; minLon: number; maxLon: number } {
  const latDelta = toDegrees(radiusKm / EARTH_RADIUS_KM);

  // Guard against division by zero at the poles.
  const cosLat = Math.cos(toRadians(center.lat));
  const lonDelta = cosLat > 1e-10 ? latDelta / cosLat : 360;

  return {
    minLat: center.lat - latDelta,
    maxLat: center.lat + latDelta,
    minLon: center.lon - lonDelta,
    maxLon: center.lon + lonDelta,
  };
}
