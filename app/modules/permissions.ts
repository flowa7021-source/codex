// @ts-check
// ─── Permissions API ─────────────────────────────────────────────────────────
// Permissions API wrapper for querying and monitoring browser permission states.

// ─── Types ───────────────────────────────────────────────────────────────────

type PermissionState = 'granted' | 'denied' | 'prompt' | 'unknown';
type KnownPermissionState = 'granted' | 'denied' | 'prompt';

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Whether the Permissions API is supported.
 */
export function isPermissionsSupported(): boolean {
  return 'permissions' in navigator;
}

/**
 * Query the state of a named permission.
 * Returns 'granted' | 'denied' | 'prompt' | 'unknown'
 */
export async function queryPermission(name: string): Promise<PermissionState> {
  if (!isPermissionsSupported()) return 'unknown';
  try {
    const status = await navigator.permissions.query({ name: name as PermissionName });
    return status.state;
  } catch {
    return 'unknown';
  }
}

/**
 * Query multiple permissions at once. Returns a map of name → state.
 */
export async function queryPermissions(names: string[]): Promise<Record<string, PermissionState>> {
  const entries = await Promise.all(
    names.map(async (name) => [name, await queryPermission(name)] as const),
  );
  return Object.fromEntries(entries);
}

/**
 * Subscribe to permission state changes for a given permission name.
 * Returns an unsubscribe function.
 */
export async function onPermissionChange(
  name: string,
  callback: (state: KnownPermissionState) => void,
): Promise<() => void> {
  if (!isPermissionsSupported()) return () => {};
  try {
    const status = await navigator.permissions.query({ name: name as PermissionName });
    const handler = () => callback(status.state as KnownPermissionState);
    status.addEventListener('change', handler);
    return () => status.removeEventListener('change', handler);
  } catch {
    return () => {};
  }
}
