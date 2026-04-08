// ─── WebCodecs ──────────────────────────────────────────────────────────────
// Hardware-accelerated image decoding using the WebCodecs API.
// Falls back to Canvas 2D drawImage for environments without WebCodecs.

// ImageDecoder is not yet in all TS libs
declare const ImageDecoder: any;

/** Maximum number of concurrent image decodes in batchDecode. */
const BATCH_CONCURRENCY = 4;

/**
 * Check whether the WebCodecs ImageDecoder API is available.
 */
export function isWebCodecsSupported(): boolean {
  return typeof ImageDecoder !== 'undefined';
}

/**
 * Decode an image Blob to an ImageBitmap using the best available method.
 *
 * Priority:
 *  1. WebCodecs ImageDecoder (hardware-accelerated)
 *  2. createImageBitmap (off-main-thread)
 *  3. Canvas 2D fallback
 */
export async function decodeImage(blob: Blob): Promise<ImageBitmap | null> {
  if (!blob || blob.size === 0) return null;

  // 1. Try WebCodecs ImageDecoder
  if (isWebCodecsSupported()) {
    try {
      return await _decodeWithImageDecoder(blob);
    } catch (_) {
      // fall through to next strategy
    }
  }

  // 2. Try createImageBitmap
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(blob);
    } catch (_) {
      // fall through
    }
  }

  // 3. Canvas 2D fallback
  try {
    return await _decodeWithCanvas(blob);
  } catch (_) {
    return null;
  }
}

/**
 * Decode an image Blob and draw it onto the given canvas element.
 * Returns true if the image was drawn successfully.
 */
export async function decodeImageToCanvas(blob: Blob, canvas: HTMLCanvasElement): Promise<boolean> {
  if (!blob || !canvas || blob.size === 0) return false;

  try {
    const bitmap = await decodeImage(blob);
    if (!bitmap) return false;

    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;
    ctx.drawImage(bitmap, 0, 0);
    if (typeof bitmap.close === 'function') bitmap.close();
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Retrieve image dimensions and MIME type without a full pixel decode.
 */
export async function getImageInfo(
  blob: Blob
): Promise<{ width: number; height: number; type: string } | null> {
  if (!blob || blob.size === 0) return null;

  const type = blob.type || 'image/unknown';

  // 1. Try WebCodecs for fast metadata
  if (isWebCodecsSupported()) {
    try {
      const decoder = new ImageDecoder({
        data: blob.stream(),
        type,
      });
      await decoder.decode();
      const track = decoder.tracks.selectedTrack as any;
      const info = {
        width: track?.displayWidth ?? 0,
        height: track?.displayHeight ?? 0,
        type,
      };
      decoder.close();
      return info;
    } catch (_) {
      // fall through
    }
  }

  // 2. Fallback: full decode and read dimensions
  try {
    const bitmap = await decodeImage(blob);
    if (!bitmap) return null;
    const info = { width: bitmap.width, height: bitmap.height, type };
    if (typeof bitmap.close === 'function') bitmap.close();
    return info;
  } catch (_) {
    return null;
  }
}

/**
 * Decode multiple image Blobs in parallel with bounded concurrency.
 */
export async function batchDecode(blobs: Blob[]): Promise<Array<ImageBitmap | null>> {
  if (!blobs || blobs.length === 0) return [];

  const results: Array<ImageBitmap | null> = new Array(blobs.length).fill(null);

  for (let i = 0; i < blobs.length; i += BATCH_CONCURRENCY) {
    const chunk = blobs.slice(i, i + BATCH_CONCURRENCY);
    const decoded = await Promise.all(chunk.map(b => decodeImage(b)));
    for (let j = 0; j < decoded.length; j++) {
      results[i + j] = decoded[j];
    }
  }

  return results;
}

// ─── Internal helpers ───────────────────────────────────────────────────────

/**
 * Decode a Blob via the WebCodecs ImageDecoder API.
 */
async function _decodeWithImageDecoder(blob: Blob): Promise<ImageBitmap> {
  const decoder = new ImageDecoder({
    data: blob.stream(),
    type: blob.type || 'image/png',
  });

  const { image: videoFrame } = await decoder.decode();
  const bitmap = await createImageBitmap(videoFrame);
  videoFrame.close();
  decoder.close();
  return bitmap;
}

/**
 * Decode a Blob via an Image element + Canvas 2D (universal fallback).
 */
function _decodeWithCanvas(blob: Blob): Promise<ImageBitmap | null> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      if (img.width === 0 || img.height === 0) {
        resolve(null);
        return;
      }
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(null); return; }
        ctx.drawImage(img, 0, 0);
        // Return a pseudo-bitmap with width/height so callers can use it
        resolve({
          width: canvas.width,
          height: canvas.height,
          close() {},
        } as unknown as ImageBitmap);
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image load failed'));
    };
    img.src = url;
  });
}
