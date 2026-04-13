// ─── User Activation API ─────────────────────────────────────────────────────
// Wrapper for the User Activation API, which tracks whether the page has had
// recent user interaction. Needed for certain browser APIs (vibrate, fullscreen,
// clipboard-write, etc.) that require a prior user gesture.

// @ts-check

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Whether the User Activation API is supported.
 */
export function isUserActivationSupported(): boolean {
  return 'userActivation' in navigator;
}

/**
 * Whether the page currently has transient user activation (recent gesture, ~5s).
 */
export function hasTransientActivation(): boolean {
  return (navigator as any).userActivation?.isActive ?? false;
}

/**
 * Whether the page has ever had user activation (sticky activation).
 */
export function hasStickyActivation(): boolean {
  return (navigator as any).userActivation?.hasBeenActive ?? false;
}

/**
 * Get a snapshot of the current user activation state.
 */
export function getUserActivationState(): {
  isSupported: boolean;
  hasTransient: boolean;
  hasSticky: boolean;
} {
  return {
    isSupported: isUserActivationSupported(),
    hasTransient: hasTransientActivation(),
    hasSticky: hasStickyActivation(),
  };
}

// ─── Activation-requiring APIs ───────────────────────────────────────────────

/**
 * Set of API names known to require transient user activation.
 * @see https://developer.mozilla.org/en-US/docs/Web/Security/User_activation
 */
const ACTIVATION_REQUIRED_APIS = new Set<string>([
  'vibrate',
  'notification',
  'fullscreen',
  'clipboard-write',
  'payment',
  'popup',
]);

/**
 * Whether a given action requires user activation.
 * Known activation-requiring APIs: 'vibrate', 'notification', 'fullscreen',
 * 'clipboard-write', 'payment', 'popup'.
 */
export function requiresActivation(apiName: string): boolean {
  return ACTIVATION_REQUIRED_APIS.has(apiName);
}
