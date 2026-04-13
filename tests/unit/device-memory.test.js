// ─── Unit Tests: Device Memory API ───────────────────────────────────────────
import './setup-dom.js';
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  isDeviceMemorySupported,
  getDeviceMemory,
  getMemoryTier,
  isLowMemoryDevice,
  getMemoryAdaptiveSettings,
} from '../../app/modules/device-memory.js';

// ─── Mock helpers ─────────────────────────────────────────────────────────────

function setDeviceMemory(value) {
  Object.defineProperty(globalThis.navigator, 'deviceMemory', {
    value,
    configurable: true,
    writable: true,
  });
}

function removeDeviceMemory() {
  // Delete the property so 'deviceMemory' in navigator returns false
  try {
    delete globalThis.navigator.deviceMemory;
  } catch {
    // If non-configurable, redefine as undefined and remove via Object.defineProperty
    Object.defineProperty(globalThis.navigator, 'deviceMemory', {
      value: undefined,
      configurable: true,
      writable: true,
    });
  }
}

beforeEach(() => {
  // Ensure a clean state before each test
  removeDeviceMemory();
});

afterEach(() => {
  removeDeviceMemory();
});

// ─── isDeviceMemorySupported ──────────────────────────────────────────────────

describe('isDeviceMemorySupported', () => {
  it('returns true when deviceMemory is present on navigator', () => {
    setDeviceMemory(4);
    assert.equal(isDeviceMemorySupported(), true);
  });

  it('returns false when deviceMemory is absent', () => {
    removeDeviceMemory();
    assert.equal(isDeviceMemorySupported(), false);
  });

  it('returns a boolean', () => {
    setDeviceMemory(2);
    assert.equal(typeof isDeviceMemorySupported(), 'boolean');
  });
});

// ─── getDeviceMemory ──────────────────────────────────────────────────────────

describe('getDeviceMemory', () => {
  it('returns the numeric value when supported', () => {
    setDeviceMemory(8);
    assert.equal(getDeviceMemory(), 8);
  });

  it('returns 0.5 when deviceMemory is 0.5', () => {
    setDeviceMemory(0.5);
    assert.equal(getDeviceMemory(), 0.5);
  });

  it('returns 1 when deviceMemory is 1', () => {
    setDeviceMemory(1);
    assert.equal(getDeviceMemory(), 1);
  });

  it('returns null when deviceMemory is absent', () => {
    removeDeviceMemory();
    assert.equal(getDeviceMemory(), null);
  });
});

// ─── getMemoryTier ────────────────────────────────────────────────────────────

describe('getMemoryTier', () => {
  it('returns "low" for 0.5 GiB', () => {
    setDeviceMemory(0.5);
    assert.equal(getMemoryTier(), 'low');
  });

  it('returns "low" for 1 GiB', () => {
    setDeviceMemory(1);
    assert.equal(getMemoryTier(), 'low');
  });

  it('returns "medium" for 2 GiB', () => {
    setDeviceMemory(2);
    assert.equal(getMemoryTier(), 'medium');
  });

  it('returns "medium" for 4 GiB', () => {
    setDeviceMemory(4);
    assert.equal(getMemoryTier(), 'medium');
  });

  it('returns "high" for 8 GiB', () => {
    setDeviceMemory(8);
    assert.equal(getMemoryTier(), 'high');
  });

  it('returns "unknown" when deviceMemory is absent', () => {
    removeDeviceMemory();
    assert.equal(getMemoryTier(), 'unknown');
  });
});

// ─── isLowMemoryDevice ────────────────────────────────────────────────────────

describe('isLowMemoryDevice', () => {
  it('returns true for 0.5 GiB', () => {
    setDeviceMemory(0.5);
    assert.equal(isLowMemoryDevice(), true);
  });

  it('returns true for 1 GiB', () => {
    setDeviceMemory(1);
    assert.equal(isLowMemoryDevice(), true);
  });

  it('returns false for 4 GiB', () => {
    setDeviceMemory(4);
    assert.equal(isLowMemoryDevice(), false);
  });

  it('returns false for 8 GiB', () => {
    setDeviceMemory(8);
    assert.equal(isLowMemoryDevice(), false);
  });

  it('returns false when deviceMemory is unknown', () => {
    removeDeviceMemory();
    assert.equal(isLowMemoryDevice(), false);
  });
});

// ─── getMemoryAdaptiveSettings ────────────────────────────────────────────────

describe('getMemoryAdaptiveSettings', () => {
  it('returns low-tier settings for 0.5 GiB', () => {
    setDeviceMemory(0.5);
    const settings = getMemoryAdaptiveSettings();
    assert.equal(settings.maxCachePages, 3);
    assert.equal(settings.enableAnimations, false);
    assert.equal(settings.prefetchAhead, 1);
  });

  it('returns low-tier settings for 1 GiB', () => {
    setDeviceMemory(1);
    const settings = getMemoryAdaptiveSettings();
    assert.equal(settings.maxCachePages, 3);
    assert.equal(settings.enableAnimations, false);
    assert.equal(settings.prefetchAhead, 1);
  });

  it('returns medium-tier settings for 2 GiB', () => {
    setDeviceMemory(2);
    const settings = getMemoryAdaptiveSettings();
    assert.equal(settings.maxCachePages, 10);
    assert.equal(settings.enableAnimations, true);
    assert.equal(settings.prefetchAhead, 3);
  });

  it('returns medium-tier settings for 4 GiB', () => {
    setDeviceMemory(4);
    const settings = getMemoryAdaptiveSettings();
    assert.equal(settings.maxCachePages, 10);
    assert.equal(settings.enableAnimations, true);
    assert.equal(settings.prefetchAhead, 3);
  });

  it('returns high-tier settings for 8 GiB', () => {
    setDeviceMemory(8);
    const settings = getMemoryAdaptiveSettings();
    assert.equal(settings.maxCachePages, 25);
    assert.equal(settings.enableAnimations, true);
    assert.equal(settings.prefetchAhead, 5);
  });

  it('returns high-tier settings when deviceMemory is unknown', () => {
    removeDeviceMemory();
    const settings = getMemoryAdaptiveSettings();
    assert.equal(settings.maxCachePages, 25);
    assert.equal(settings.enableAnimations, true);
    assert.equal(settings.prefetchAhead, 5);
  });

  it('returns an object with all three required keys', () => {
    setDeviceMemory(4);
    const settings = getMemoryAdaptiveSettings();
    assert.ok('maxCachePages' in settings);
    assert.ok('enableAnimations' in settings);
    assert.ok('prefetchAhead' in settings);
  });
});
