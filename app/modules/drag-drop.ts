// @ts-check
// ─── Drag and Drop File Handling ─────────────────────────────────────────────
// Utilities for extracting files from drag events and attaching drop zones.

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Extract Files from a DragEvent's dataTransfer.
 * Returns an empty array if dataTransfer is null or no files.
 */
export function getDroppedFiles(event: DragEvent): File[] {
  try {
    return Array.from(event.dataTransfer?.files ?? []);
  } catch {
    return [];
  }
}

/**
 * Extract files with a specific MIME type filter from a drag event.
 * Supports wildcard types like 'image/*' by using startsWith matching.
 *
 * @param event - The DragEvent containing dataTransfer files
 * @param mimeTypes - Array of MIME type strings to filter by
 */
export function getDroppedFilesByType(event: DragEvent, mimeTypes: string[]): File[] {
  const files = getDroppedFiles(event);
  if (mimeTypes.length === 0) return [];
  return files.filter((file) =>
    mimeTypes.some((mime) => {
      if (mime.endsWith('/*')) {
        return file.type.startsWith(mime.slice(0, -1));
      }
      return file.type === mime;
    }),
  );
}

/**
 * Whether a drag event contains files.
 *
 * @param event - The DragEvent to check
 */
export function hasFiles(event: DragEvent): boolean {
  return (event.dataTransfer?.files?.length ?? 0) > 0;
}

/**
 * Whether a drag event contains files matching any of the given MIME types.
 *
 * @param event - The DragEvent to check
 * @param mimeTypes - Array of MIME type strings to match against
 */
export function hasFilesOfType(event: DragEvent, mimeTypes: string[]): boolean {
  return getDroppedFilesByType(event, mimeTypes).length > 0;
}

/**
 * Attach drag-and-drop handlers to an element.
 * Handles dragover (preventDefault), dragleave, and drop events.
 * Returns a cleanup function that removes all attached listeners.
 *
 * @param element - The DOM element to attach the drop zone to
 * @param options - Handler callbacks and optional MIME type filter
 */
export function attachDropZone(
  element: Element,
  options: {
    onDrop: (files: File[]) => void;
    onDragOver?: (event: DragEvent) => void;
    onDragLeave?: (event: DragEvent) => void;
    mimeTypes?: string[];
  },
): () => void {
  const handleDragOver = (event: Event): void => {
    event.preventDefault();
    if (options.onDragOver) {
      options.onDragOver(event as DragEvent);
    }
  };

  const handleDragLeave = (event: Event): void => {
    if (options.onDragLeave) {
      options.onDragLeave(event as DragEvent);
    }
  };

  const handleDrop = (event: Event): void => {
    event.preventDefault();
    const dragEvent = event as DragEvent;
    const files = options.mimeTypes
      ? getDroppedFilesByType(dragEvent, options.mimeTypes)
      : getDroppedFiles(dragEvent);
    options.onDrop(files);
  };

  element.addEventListener('dragover', handleDragOver);
  element.addEventListener('dragleave', handleDragLeave);
  element.addEventListener('drop', handleDrop);

  return () => {
    element.removeEventListener('dragover', handleDragOver);
    element.removeEventListener('dragleave', handleDragLeave);
    element.removeEventListener('drop', handleDrop);
  };
}
