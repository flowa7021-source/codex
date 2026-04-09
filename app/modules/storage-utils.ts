// @ts-check
// ─── Storage Utilities ───────────────────────────────────────────────────────
// Utilities for localStorage/sessionStorage with JSON serialization.

// ─── localStorage ────────────────────────────────────────────────────────────

/** Get a JSON-parsed value from localStorage. Returns null if absent or invalid. */
export function getLocal<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Set a JSON-serialized value in localStorage. Returns true on success. */
export function setLocal<T>(key: string, value: T): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/** Remove a key from localStorage. */
export function removeLocal(key: string): void {
  localStorage.removeItem(key);
}

/** Clear all localStorage data. */
export function clearLocal(): void {
  localStorage.clear();
}

/** Get all keys in localStorage. */
export function localKeys(): string[] {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k !== null) keys.push(k);
  }
  return keys;
}

// ─── sessionStorage ──────────────────────────────────────────────────────────

/** Get a JSON-parsed value from sessionStorage. Returns null if absent or invalid. */
export function getSession<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Set a JSON-serialized value in sessionStorage. Returns true on success. */
export function setSession<T>(key: string, value: T): boolean {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/** Remove a key from sessionStorage. */
export function removeSession(key: string): void {
  sessionStorage.removeItem(key);
}

/** Clear all sessionStorage data. */
export function clearSession(): void {
  sessionStorage.clear();
}

/** Get all keys in sessionStorage. */
export function sessionKeys(): string[] {
  const keys: string[] = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const k = sessionStorage.key(i);
    if (k !== null) keys.push(k);
  }
  return keys;
}

// ─── Cross-tab storage events ────────────────────────────────────────────────

/** Listen for storage events (cross-tab). Returns unsubscribe function. */
export function onStorageChange(
  key: string | null,
  callback: (newValue: string | null, oldValue: string | null) => void,
): () => void {
  const handler = (event: StorageEvent) => {
    if (key !== null && event.key !== key) return;
    callback(event.newValue, event.oldValue);
  };
  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}
