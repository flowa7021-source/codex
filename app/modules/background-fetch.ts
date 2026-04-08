// ─── Background Fetch API ─────────────────────────────────────────────────────
// Background Fetch API wrapper for downloading large PDF files in the background.
// Allows downloads to continue even when the user navigates away or closes the tab.

export interface FetchRegistration {
  id: string;
  uploadTotal: number;
  uploaded: number;
  downloadTotal: number;
  downloaded: number;
  result: '' | 'success' | 'failure' | 'aborted';
  failureReason: '' | 'aborted' | 'bad-status' | 'fetch-error' | 'quota-exceeded' | 'download-total-exceeded';
  recordsAvailable: boolean;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Whether the Background Fetch API is available in this environment.
 * Requires both Service Worker and the backgroundFetch extension on the SW registration.
 */
export function isBackgroundFetchSupported(): boolean {
  try {
    return (
      'serviceWorker' in navigator &&
      'backgroundFetch' in ServiceWorkerRegistration.prototype
    );
  } catch {
    return false;
  }
}

/**
 * Start a background fetch for one or more URLs.
 * Returns null if the API is unsupported or no active Service Worker is found.
 *
 * @param id - Unique identifier for this fetch registration
 * @param urls - Array of URLs to download
 * @param opts - Optional title and downloadTotal hint
 */
export async function startBackgroundFetch(
  id: string,
  urls: string[],
  opts?: { title?: string; downloadTotal?: number },
): Promise<FetchRegistration | null> {
  if (!isBackgroundFetchSupported()) return null;

  try {
    const swReg = await (navigator as any).serviceWorker.ready;
    if (!swReg) return null;
    const registration = await (swReg as any).backgroundFetch.fetch(id, urls, opts);
    return registration as FetchRegistration;
  } catch {
    return null;
  }
}

/**
 * Retrieve an existing background fetch registration by ID.
 * Returns null if not found or the API is unsupported.
 *
 * @param id - The fetch registration ID to look up
 */
export async function getBackgroundFetch(id: string): Promise<FetchRegistration | null> {
  if (!isBackgroundFetchSupported()) return null;

  try {
    const swReg = await (navigator as any).serviceWorker.ready;
    if (!swReg) return null;
    const registration = await (swReg as any).backgroundFetch.get(id);
    return registration ?? null;
  } catch {
    return null;
  }
}

/**
 * Abort an in-progress background fetch.
 * Returns true if the abort succeeded, false otherwise.
 *
 * @param id - The fetch registration ID to abort
 */
export async function abortBackgroundFetch(id: string): Promise<boolean> {
  try {
    const registration = await getBackgroundFetch(id);
    if (!registration) return false;
    await (registration as any).abort();
    return true;
  } catch {
    return false;
  }
}

/**
 * List all active background fetch registration IDs and return their registrations.
 * Returns an empty array if the API is unsupported or an error occurs.
 */
export async function listBackgroundFetches(): Promise<FetchRegistration[]> {
  if (!isBackgroundFetchSupported()) return [];

  try {
    const swReg = await (navigator as any).serviceWorker.ready;
    if (!swReg) return [];
    const ids: string[] = await (swReg as any).backgroundFetch.getIds();
    const results = await Promise.all(ids.map(id => getBackgroundFetch(id)));
    return results.filter((r): r is FetchRegistration => r !== null);
  } catch {
    return [];
  }
}
