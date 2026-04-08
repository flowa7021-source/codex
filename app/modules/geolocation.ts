// ─── Geolocation API ─────────────────────────────────────────────────────────
// Geolocation API wrapper for locale-aware PDF metadata and regional content detection.

export interface GeoPosition {
  latitude: number;
  longitude: number;
  accuracy: number;        // meters
  altitude: number | null;
  altitudeAccuracy: number | null;
  heading: number | null;
  speed: number | null;
  timestamp: number;
}

export interface GeoError {
  code: 1 | 2 | 3;  // PERMISSION_DENIED | POSITION_UNAVAILABLE | TIMEOUT
  message: string;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Whether the Geolocation API is available in this environment.
 */
export function isGeolocationSupported(): boolean {
  return 'geolocation' in navigator;
}

/**
 * Get the current geographic position.
 * Resolves with a GeoPosition on success; rejects with a GeoError on failure.
 *
 * @param opts - Optional PositionOptions; defaults to { timeout: 10000 }
 */
export function getCurrentPosition(opts?: PositionOptions): Promise<GeoPosition> {
  return new Promise((resolve, reject) => {
    if (!isGeolocationSupported()) {
      const err: GeoError = { code: 2, message: 'Geolocation is not supported' };
      reject(err);
      return;
    }

    const options: PositionOptions = { timeout: 10000, ...opts };

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          altitude: pos.coords.altitude,
          altitudeAccuracy: pos.coords.altitudeAccuracy,
          heading: pos.coords.heading,
          speed: pos.coords.speed,
          timestamp: pos.timestamp,
        });
      },
      (err) => {
        const geoErr: GeoError = {
          code: err.code as 1 | 2 | 3,
          message: err.message,
        };
        reject(geoErr);
      },
      options,
    );
  });
}

/**
 * Watch the current geographic position continuously.
 * Returns a stop function that clears the watcher.
 *
 * @param handler - Called on each position update
 * @param errHandler - Optional error callback
 * @param opts - Optional PositionOptions
 */
export function watchPosition(
  handler: (pos: GeoPosition) => void,
  errHandler?: (err: GeoError) => void,
  opts?: PositionOptions,
): () => void {
  if (!isGeolocationSupported()) {
    return () => { /* no-op */ };
  }

  const watchId = navigator.geolocation.watchPosition(
    (pos) => {
      handler({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        altitude: pos.coords.altitude,
        altitudeAccuracy: pos.coords.altitudeAccuracy,
        heading: pos.coords.heading,
        speed: pos.coords.speed,
        timestamp: pos.timestamp,
      });
    },
    errHandler
      ? (err) => {
          errHandler({ code: err.code as 1 | 2 | 3, message: err.message });
        }
      : undefined,
    opts,
  );

  return () => {
    navigator.geolocation.clearWatch(watchId);
  };
}

/**
 * Returns the IANA timezone string for the current locale.
 * Always available via the Intl API.
 */
export function getTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Returns the primary BCP 47 language tag for the user's locale.
 * Falls back to 'en' if navigator.language is not available.
 */
export function getLocale(): string {
  return navigator.language || 'en';
}
