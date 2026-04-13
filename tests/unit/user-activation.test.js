// ─── Unit Tests: User Activation API ─────────────────────────────────────────
import './setup-dom.js';
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  isUserActivationSupported,
  hasTransientActivation,
  hasStickyActivation,
  getUserActivationState,
  requiresActivation,
} from '../../app/modules/user-activation.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function setUserActivation(value) {
  Object.defineProperty(navigator, 'userActivation', {
    configurable: true,
    value,
  });
}

function removeUserActivation() {
  // Delete the property so 'userActivation' in navigator returns false
  try {
    Object.defineProperty(navigator, 'userActivation', {
      configurable: true,
      value: undefined,
    });
    delete /** @type {any} */ (navigator).userActivation;
  } catch {
    // silently ignore if not deletable
  }
}

// ─── isUserActivationSupported ───────────────────────────────────────────────

describe('isUserActivationSupported', () => {
  afterEach(() => {
    removeUserActivation();
  });

  it('returns a boolean', () => {
    assert.equal(typeof isUserActivationSupported(), 'boolean');
  });

  it('returns true when navigator.userActivation is present', () => {
    setUserActivation({ isActive: false, hasBeenActive: false });
    assert.equal(isUserActivationSupported(), true);
  });

  it('returns false when navigator.userActivation is absent', () => {
    removeUserActivation();
    assert.equal(isUserActivationSupported(), false);
  });
});

// ─── hasTransientActivation ──────────────────────────────────────────────────

describe('hasTransientActivation', () => {
  afterEach(() => {
    removeUserActivation();
  });

  it('returns a boolean', () => {
    assert.equal(typeof hasTransientActivation(), 'boolean');
  });

  it('returns true when isActive is true', () => {
    setUserActivation({ isActive: true, hasBeenActive: true });
    assert.equal(hasTransientActivation(), true);
  });

  it('returns false when isActive is false', () => {
    setUserActivation({ isActive: false, hasBeenActive: true });
    assert.equal(hasTransientActivation(), false);
  });

  it('returns false when userActivation is absent', () => {
    removeUserActivation();
    assert.equal(hasTransientActivation(), false);
  });
});

// ─── hasStickyActivation ─────────────────────────────────────────────────────

describe('hasStickyActivation', () => {
  afterEach(() => {
    removeUserActivation();
  });

  it('returns a boolean', () => {
    assert.equal(typeof hasStickyActivation(), 'boolean');
  });

  it('returns true when hasBeenActive is true', () => {
    setUserActivation({ isActive: false, hasBeenActive: true });
    assert.equal(hasStickyActivation(), true);
  });

  it('returns false when hasBeenActive is false', () => {
    setUserActivation({ isActive: false, hasBeenActive: false });
    assert.equal(hasStickyActivation(), false);
  });

  it('returns false when userActivation is absent', () => {
    removeUserActivation();
    assert.equal(hasStickyActivation(), false);
  });
});

// ─── getUserActivationState ──────────────────────────────────────────────────

describe('getUserActivationState', () => {
  afterEach(() => {
    removeUserActivation();
  });

  it('returns an object with isSupported, hasTransient, hasSticky fields', () => {
    setUserActivation({ isActive: false, hasBeenActive: false });
    const state = getUserActivationState();
    assert.ok(state !== null && typeof state === 'object');
    assert.ok('isSupported' in state);
    assert.ok('hasTransient' in state);
    assert.ok('hasSticky' in state);
  });

  it('all fields are booleans', () => {
    setUserActivation({ isActive: true, hasBeenActive: true });
    const state = getUserActivationState();
    assert.equal(typeof state.isSupported, 'boolean');
    assert.equal(typeof state.hasTransient, 'boolean');
    assert.equal(typeof state.hasSticky, 'boolean');
  });

  it('reflects supported + transient + sticky when all active', () => {
    setUserActivation({ isActive: true, hasBeenActive: true });
    const state = getUserActivationState();
    assert.equal(state.isSupported, true);
    assert.equal(state.hasTransient, true);
    assert.equal(state.hasSticky, true);
  });

  it('reflects supported but no transient or sticky', () => {
    setUserActivation({ isActive: false, hasBeenActive: false });
    const state = getUserActivationState();
    assert.equal(state.isSupported, true);
    assert.equal(state.hasTransient, false);
    assert.equal(state.hasSticky, false);
  });

  it('reflects not supported when userActivation is absent', () => {
    removeUserActivation();
    const state = getUserActivationState();
    assert.equal(state.isSupported, false);
    assert.equal(state.hasTransient, false);
    assert.equal(state.hasSticky, false);
  });
});

// ─── requiresActivation ──────────────────────────────────────────────────────

describe('requiresActivation', () => {
  it('returns a boolean', () => {
    assert.equal(typeof requiresActivation('vibrate'), 'boolean');
  });

  it('returns true for "vibrate"', () => {
    assert.equal(requiresActivation('vibrate'), true);
  });

  it('returns true for "notification"', () => {
    assert.equal(requiresActivation('notification'), true);
  });

  it('returns true for "fullscreen"', () => {
    assert.equal(requiresActivation('fullscreen'), true);
  });

  it('returns true for "clipboard-write"', () => {
    assert.equal(requiresActivation('clipboard-write'), true);
  });

  it('returns true for "payment"', () => {
    assert.equal(requiresActivation('payment'), true);
  });

  it('returns true for "popup"', () => {
    assert.equal(requiresActivation('popup'), true);
  });

  it('returns false for an unknown API name', () => {
    assert.equal(requiresActivation('unknown-api'), false);
  });

  it('returns false for an empty string', () => {
    assert.equal(requiresActivation(''), false);
  });

  it('returns false for "geolocation" (does not require activation)', () => {
    assert.equal(requiresActivation('geolocation'), false);
  });
});
