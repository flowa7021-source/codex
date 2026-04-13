// ─── Storage Manager API ──────────────────────────────────────────────────────
// Storage Manager API wrapper for checking available disk space before saving
// large PDFs. Uses navigator.storage.estimate() with an optimistic fallback.

export interface StorageQuota {
  usage: number;         // bytes used
  quota: number;         // total quota bytes
  usagePercent: number;  // 0–100
  availableBytes: number;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Whether the Storage Manager estimate API is available in this environment.
 */
export function isStorageEstimateSupported(): boolean {
  return 'storage' in navigator && 'estimate' in navigator.storage;
}

/**
 * Retrieve current storage quota information.
 * Returns all-zeros when the API is unsupported or an error occurs.
 */
export async function getStorageQuota(): Promise<StorageQuota> {
  if (!isStorageEstimateSupported()) {
    return { usage: 0, quota: 0, usagePercent: 0, availableBytes: 0 };
  }

  try {
    const estimate = await navigator.storage.estimate();
    const usage = estimate.usage ?? 0;
    const quota = estimate.quota ?? 0;
    const usagePercent = quota > 0 ? (usage / quota) * 100 : 0;
    const availableBytes = quota - usage;
    return { usage, quota, usagePercent, availableBytes };
  } catch {
    return { usage: 0, quota: 0, usagePercent: 0, availableBytes: 0 };
  }
}

/**
 * Check whether enough storage space is available for the given byte count.
 * Returns true (optimistic) when the API is unsupported.
 *
 * @param requiredBytes - Minimum number of bytes that must be available
 */
export async function hasEnoughSpace(requiredBytes: number): Promise<boolean> {
  if (!isStorageEstimateSupported()) return true;

  const quota = await getStorageQuota();
  return quota.availableBytes >= requiredBytes;
}

/**
 * Poll storage usage every 60 seconds and invoke the handler whenever
 * `usagePercent` meets or exceeds the threshold.
 *
 * @param handler - Callback invoked with the current quota when pressure is detected
 * @param thresholdPercent - Trigger level (default 80%)
 * @returns Stop function — call it to cancel polling
 */
export function onStoragePressure(
  handler: (quota: StorageQuota) => void,
  thresholdPercent: number = 80,
): () => void {
  const id = setInterval(async () => {
    const quota = await getStorageQuota();
    if (quota.usagePercent >= thresholdPercent) {
      handler(quota);
    }
  }, 60_000);

  return () => clearInterval(id);
}

/**
 * Request that the browser persist storage for this origin (prevents eviction).
 * Returns true when granted, false when denied or unsupported.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (!('storage' in navigator) || !('persist' in navigator.storage)) return false;

  try {
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
