// ─── Notification Manager ────────────────────────────────────────────────────
// Web Notifications API wrapper for document processing alerts
// (OCR complete, download done, etc.)

export type NotificationPermission = 'default' | 'granted' | 'denied';

export interface NotificationOpts {
  body?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  silent?: boolean;
  requireInteraction?: boolean;
  data?: unknown;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Whether the Web Notifications API is available in this environment.
 */
export function isNotificationSupported(): boolean {
  return 'Notification' in (globalThis as any);
}

/**
 * Returns the current notification permission status.
 * Returns 'denied' if the API is not supported.
 */
export function getPermissionStatus(): NotificationPermission {
  if (!isNotificationSupported()) return 'denied';
  return Notification.permission as NotificationPermission;
}

/**
 * Requests permission to show notifications.
 * Resolves to the resulting permission status.
 * Returns 'denied' if the API is not supported.
 */
export async function requestPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) return 'denied';
  const result = await Notification.requestPermission();
  return result as NotificationPermission;
}

/**
 * Shows a notification if permission is already granted.
 * Returns null if permission is not granted or the API is unsupported.
 * Catches any constructor errors and returns null.
 *
 * @param title - The notification title
 * @param opts  - Optional notification options
 */
export function showNotification(title: string, opts?: NotificationOpts): Notification | null {
  if (!isNotificationSupported()) return null;
  if (Notification.permission !== 'granted') return null;
  try {
    return new Notification(title, opts);
  } catch {
    return null;
  }
}

/**
 * Requests permission if the status is 'default', then shows the notification.
 * Returns null if permission is denied.
 *
 * @param title - The notification title
 * @param opts  - Optional notification options
 */
export async function showIfPermitted(title: string, opts?: NotificationOpts): Promise<Notification | null> {
  if (!isNotificationSupported()) return null;
  if (Notification.permission === 'default') {
    await requestPermission();
  }
  return showNotification(title, opts);
}
