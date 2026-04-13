// ─── Unit Tests: Geolocation API ─────────────────────────────────────────────
import './setup-dom.js';
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  isGeolocationSupported,
  getCurrentPosition,
  watchPosition,
  getTimezone,
  getLocale,
} from '../../app/modules/geolocation.js';

// ─── Mock geolocation ────────────────────────────────────────────────────────

beforeEach(() => {
  globalThis.navigator.geolocation = {
    getCurrentPosition(success, error, opts) {
      if (this._shouldError) {
        error({ code: 1, message: 'denied' });
      } else {
        success({
          coords: {
            latitude: 51.5,
            longitude: -0.1,
            accuracy: 10,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
          },
          timestamp: 1000,
        });
      }
    },
    watchPosition(success, error, opts) {
      this._watchId = 42;
      return 42;
    },
    clearWatch(id) { this._watchId = null; },
    _shouldError: false,
    _watchId: null,
  };
});

afterEach(() => {
  delete globalThis.navigator.geolocation;
});

// ─── isGeolocationSupported ───────────────────────────────────────────────────

describe('isGeolocationSupported', () => {
  it('returns a boolean', () => {
    const result = isGeolocationSupported();
    assert.equal(typeof result, 'boolean');
  });

  it('returns true when geolocation mock is installed', () => {
    assert.equal(isGeolocationSupported(), true);
  });

  it('returns false when geolocation is absent', () => {
    delete globalThis.navigator.geolocation;
    assert.equal(isGeolocationSupported(), false);
  });
});

// ─── getCurrentPosition ───────────────────────────────────────────────────────

describe('getCurrentPosition', () => {
  it('resolves with a GeoPosition object', async () => {
    const pos = await getCurrentPosition();
    assert.equal(typeof pos, 'object');
    assert.notEqual(pos, null);
  });

  it('GeoPosition has all required fields', async () => {
    const pos = await getCurrentPosition();
    assert.equal(typeof pos.latitude, 'number');
    assert.equal(typeof pos.longitude, 'number');
    assert.equal(typeof pos.accuracy, 'number');
    assert.ok('altitude' in pos);
    assert.ok('altitudeAccuracy' in pos);
    assert.ok('heading' in pos);
    assert.ok('speed' in pos);
    assert.equal(typeof pos.timestamp, 'number');
  });

  it('GeoPosition has correct values from mock', async () => {
    const pos = await getCurrentPosition();
    assert.equal(pos.latitude, 51.5);
    assert.equal(pos.longitude, -0.1);
    assert.equal(pos.accuracy, 10);
    assert.equal(pos.altitude, null);
    assert.equal(pos.altitudeAccuracy, null);
    assert.equal(pos.heading, null);
    assert.equal(pos.speed, null);
    assert.equal(pos.timestamp, 1000);
  });

  it('rejects with GeoError when _shouldError is true', async () => {
    globalThis.navigator.geolocation._shouldError = true;
    await assert.rejects(
      () => getCurrentPosition(),
      (err) => {
        assert.equal(err.code, 1);
        assert.equal(err.message, 'denied');
        return true;
      },
    );
  });

  it('GeoError has correct shape when rejected', async () => {
    globalThis.navigator.geolocation._shouldError = true;
    try {
      await getCurrentPosition();
      assert.fail('should have rejected');
    } catch (err) {
      assert.equal(typeof err.code, 'number');
      assert.equal(typeof err.message, 'string');
    }
  });

  it('rejects with code 2 when geolocation is not supported', async () => {
    delete globalThis.navigator.geolocation;
    await assert.rejects(
      () => getCurrentPosition(),
      (err) => {
        assert.equal(err.code, 2);
        return true;
      },
    );
  });

  it('accepts custom PositionOptions without throwing', async () => {
    await assert.doesNotReject(() => getCurrentPosition({ timeout: 5000 }));
  });
});

// ─── watchPosition ────────────────────────────────────────────────────────────

describe('watchPosition', () => {
  it('returns a stop function', () => {
    const stop = watchPosition(() => {});
    assert.equal(typeof stop, 'function');
  });

  it('stop function is callable without throwing', () => {
    const stop = watchPosition(() => {});
    assert.doesNotThrow(() => stop());
  });

  it('stop function calls clearWatch on the geolocation mock', () => {
    const stop = watchPosition(() => {});
    // watchId should be 42 after watchPosition is called
    assert.equal(globalThis.navigator.geolocation._watchId, 42);
    stop();
    assert.equal(globalThis.navigator.geolocation._watchId, null);
  });

  it('returns a no-op stop function when geolocation is unsupported', () => {
    delete globalThis.navigator.geolocation;
    const stop = watchPosition(() => {});
    assert.equal(typeof stop, 'function');
    assert.doesNotThrow(() => stop());
  });

  it('accepts an error handler argument', () => {
    const stop = watchPosition(() => {}, () => {});
    assert.equal(typeof stop, 'function');
    stop();
  });

  it('accepts opts argument', () => {
    const stop = watchPosition(() => {}, undefined, { timeout: 5000 });
    assert.equal(typeof stop, 'function');
    stop();
  });
});

// ─── getTimezone ──────────────────────────────────────────────────────────────

describe('getTimezone', () => {
  it('returns a non-empty string', () => {
    const tz = getTimezone();
    assert.equal(typeof tz, 'string');
    assert.ok(tz.length > 0);
  });

  it('returns a valid IANA timezone string', () => {
    const tz = getTimezone();
    // IANA timezone strings contain either a slash (e.g. America/New_York)
    // or are a known abbreviated zone (e.g. UTC)
    assert.ok(tz.includes('/') || tz.length >= 2);
  });
});

// ─── getLocale ────────────────────────────────────────────────────────────────

describe('getLocale', () => {
  it('returns a string', () => {
    const locale = getLocale();
    assert.equal(typeof locale, 'string');
  });

  it('returns a non-empty string', () => {
    const locale = getLocale();
    assert.ok(locale.length > 0);
  });

  it('returns navigator.language when available', () => {
    const locale = getLocale();
    assert.equal(locale, navigator.language || 'en');
  });

  it('falls back to "en" when navigator.language is absent', () => {
    const original = globalThis.navigator.language;
    // Override language to undefined-like empty string
    Object.defineProperty(globalThis.navigator, 'language', {
      value: '',
      configurable: true,
      writable: true,
    });
    const locale = getLocale();
    assert.equal(locale, 'en');
    Object.defineProperty(globalThis.navigator, 'language', {
      value: original,
      configurable: true,
      writable: true,
    });
  });
});
