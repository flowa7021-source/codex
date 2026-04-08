// ─── Content Index API ───────────────────────────────────────────────────────
// Wraps the Content Index API to register PDF documents for offline search
// and discovery in the browser's offline content index.

export interface ContentEntry {
  id: string;
  title: string;
  description?: string;
  url: string;
  category: 'article' | 'video' | 'audio' | 'homepage' | 'undetermined';
  icons?: Array<{ src: string; sizes?: string; type?: string }>;
  launchUrl?: string;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Whether the Content Index API is available in this environment.
 * Requires Service Worker support in navigator and the `index` property
 * on the service worker container object.
 */
export function isContentIndexSupported(): boolean {
  try {
    if (!('serviceWorker' in navigator)) return false;
    const sw = (navigator as any).serviceWorker;
    return !!(sw && 'index' in sw);
  } catch {
    return false;
  }
}

/**
 * Register a content entry in the browser's Content Index.
 * Returns true on success, false when the API is unsupported or an error occurs.
 *
 * @param entry - The content entry to register
 */
export async function addToContentIndex(entry: ContentEntry): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return false;

  try {
    const swReg = await (navigator as any).serviceWorker.ready;
    if (!(swReg as any).index) return false;
    await (swReg as any).index.add(entry);
    return true;
  } catch {
    return false;
  }
}

/**
 * Remove a content entry from the browser's Content Index by ID.
 * Returns true on success, false when the API is unsupported or an error occurs.
 *
 * @param id - The entry ID to remove
 */
export async function removeFromContentIndex(id: string): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return false;

  try {
    const swReg = await (navigator as any).serviceWorker.ready;
    if (!(swReg as any).index) return false;
    await (swReg as any).index.delete(id);
    return true;
  } catch {
    return false;
  }
}

/**
 * Retrieve all entries currently registered in the Content Index.
 * Returns an empty array when the API is unsupported or an error occurs.
 */
export async function getContentIndexEntries(): Promise<ContentEntry[]> {
  if (!('serviceWorker' in navigator)) return [];

  try {
    const swReg = await (navigator as any).serviceWorker.ready;
    if (!(swReg as any).index) return [];
    const entries = await (swReg as any).index.getAll();
    return entries as ContentEntry[];
  } catch {
    return [];
  }
}

/**
 * Convenience wrapper that registers a PDF document in the Content Index
 * with `category: 'article'`.
 * Returns true on success, false when the API is unsupported or an error occurs.
 *
 * @param doc - Minimal document descriptor
 */
export async function syncDocumentToIndex(doc: {
  id: string;
  title: string;
  url: string;
  description?: string;
}): Promise<boolean> {
  return addToContentIndex({
    id: doc.id,
    title: doc.title,
    url: doc.url,
    description: doc.description,
    category: 'article',
  });
}
