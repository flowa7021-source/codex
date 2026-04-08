// ─── Compression Streams ────────────────────────────────────────────────────
// Compression Streams API wrapper with fflate fallback.
// Uses native CompressionStream/DecompressionStream when available,
// falls back to fflate for environments without support.

import { gzipSync, gunzipSync, deflateSync, inflateSync } from 'fflate';

declare const CompressionStream: any;
declare const DecompressionStream: any;

type CompressionFormat = 'gzip' | 'deflate' | 'deflate-raw';

/**
 * Check whether the native Compression Streams API is available.
 */
export function isCompressionStreamsSupported(): boolean {
  return (
    typeof globalThis.CompressionStream === 'function' &&
    typeof globalThis.DecompressionStream === 'function'
  );
}

/**
 * Pipe data through a transform stream and collect the output chunks
 * into a single Uint8Array.
 */
async function pipeThrough(data: Uint8Array, transform: TransformStream): Promise<Uint8Array> {
  const readable = new ReadableStream({
    start(controller) {
      controller.enqueue(data);
      controller.close();
    },
  });

  const reader = readable.pipeThrough(transform).getReader();
  const chunks: Uint8Array[] = [];
  let totalLength = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    totalLength += value.length;
  }

  // Fast path: single chunk
  if (chunks.length === 1) return chunks[0];

  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

/**
 * Compress data using the specified format.
 * Uses native CompressionStream when available, otherwise fflate.
 */
export async function compress(data: Uint8Array, format: CompressionFormat = 'gzip'): Promise<Uint8Array> {
  if (isCompressionStreamsSupported()) {
    return pipeThrough(data, new CompressionStream(format));
  }

  // fflate fallback
  switch (format) {
    case 'gzip':
      return gzipSync(data);
    case 'deflate':
    case 'deflate-raw':
      return deflateSync(data);
    default:
      throw new Error(`Unsupported compression format: ${format}`);
  }
}

/**
 * Decompress data using the specified format.
 * Uses native DecompressionStream when available, otherwise fflate.
 */
export async function decompress(data: Uint8Array, format: CompressionFormat = 'gzip'): Promise<Uint8Array> {
  if (isCompressionStreamsSupported()) {
    return pipeThrough(data, new DecompressionStream(format));
  }

  // fflate fallback
  switch (format) {
    case 'gzip':
      return gunzipSync(data);
    case 'deflate':
    case 'deflate-raw':
      return inflateSync(data);
    default:
      throw new Error(`Unsupported compression format: ${format}`);
  }
}

/**
 * Compress a UTF-8 string to gzip bytes.
 */
export async function compressString(str: string): Promise<Uint8Array> {
  const encoded = new TextEncoder().encode(str);
  return compress(encoded, 'gzip');
}

/**
 * Decompress gzip bytes back to a UTF-8 string.
 */
export async function decompressString(data: Uint8Array): Promise<string> {
  const decompressed = await decompress(data, 'gzip');
  return new TextDecoder().decode(decompressed);
}
