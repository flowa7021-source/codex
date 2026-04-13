// ─── Cookie Store API ─────────────────────────────────────────────────────────
// Cookie Store API wrapper for reading and writing cookies without relying on
// the `document.cookie` string-parsing interface.

export interface CookieEntry {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: number;    // Unix timestamp ms
  secure?: boolean;
  sameSite?: 'strict' | 'lax' | 'none';
}

// ─── Internal helpers ────────────────────────────────────────────────────────

/** Retrieve the cookieStore global safely. */
function _store(): any {
  return (globalThis as any).cookieStore;
}

/** Map a raw cookie-store result object to a `CookieEntry`. */
function _map(raw: any): CookieEntry {
  return {
    name: raw.name,
    value: raw.value,
    domain: raw.domain,
    path: raw.path,
    expires: raw.expires,
    secure: raw.secure,
    sameSite: raw.sameSite,
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Whether the Cookie Store API is available in this environment.
 */
export function isCookieStoreSupported(): boolean {
  return 'cookieStore' in globalThis;
}

/**
 * Read a single cookie by name.
 * Returns `null` when the cookie does not exist, the API is unsupported, or
 * an error occurs.
 *
 * @param name - Cookie name to look up
 */
export async function getCookie(name: string): Promise<CookieEntry | null> {
  const store = _store();
  if (!store) return null;

  try {
    const raw = await store.get(name);
    if (!raw) return null;
    return _map(raw);
  } catch {
    return null;
  }
}

/**
 * Write a cookie.
 * Returns `true` on success, `false` when the API is unsupported or an error
 * occurs.
 *
 * @param cookie - Cookie data to write
 */
export async function setCookie(cookie: CookieEntry): Promise<boolean> {
  const store = _store();
  if (!store) return false;

  try {
    const { name, value, domain, path, expires, secure, sameSite } = cookie;
    await store.set({ name, value, domain, path, expires, secure, sameSite });
    return true;
  } catch {
    return false;
  }
}

/**
 * Delete a cookie by name.
 * Returns `true` on success, `false` when the API is unsupported or an error
 * occurs.
 *
 * @param name - Cookie name to delete
 */
export async function deleteCookie(name: string): Promise<boolean> {
  const store = _store();
  if (!store) return false;

  try {
    await store.delete(name);
    return true;
  } catch {
    return false;
  }
}

/**
 * Retrieve all cookies visible to the current context.
 * Returns an empty array when the API is unsupported or an error occurs.
 */
export async function getAllCookies(): Promise<CookieEntry[]> {
  const store = _store();
  if (!store) return [];

  try {
    const raws: any[] = await store.getAll();
    return raws.map(_map);
  } catch {
    return [];
  }
}

/**
 * Listen for cookie changes (set or deleted) via the Cookie Store API.
 * Returns an unsubscribe function — call it to remove the listener.
 * When the API is unsupported the returned function is a no-op.
 *
 * @param handler - Callback receiving arrays of changed and deleted cookie names
 */
export function onCookieChange(
  handler: (changed: CookieEntry[], deleted: string[]) => void,
): () => void {
  const store = _store();
  if (!store) return () => {};

  const listener = (event: any) => {
    const changed: CookieEntry[] = (event.changed ?? []).map(_map);
    const deleted: string[] = (event.deleted ?? []).map((d: any) => d.name as string);
    handler(changed, deleted);
  };

  store.addEventListener('change', listener);
  return () => store.removeEventListener('change', listener);
}
