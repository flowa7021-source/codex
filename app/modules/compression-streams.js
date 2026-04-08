// @ts-check
// ─── Compression Streams ────────────────────────────────────────────────────
// Compression Streams API wrapper with fflate fallback.
// Uses native CompressionStream/DecompressionStream when available,
// falls back to fflate for environments without support.

import { gzipSync, gunzipSync, deflateSync, inflateSync } from 'fflate';

/**
 * @typedef {'gzip' | 'deflate' | 'deflate-raw'} CompressionFormat
 */

/**
 * Check whether the native Compression Streams API is available.
 * @returns {boolean}
 */
export function isCompressionStreamsSupported() {
  return (
    typeof globalThis.CompressionStream === 'function' &&
    typeof globalThis.DecompressionStream === 'function'
  );
}

/**
 * Pipe data through a transform stream and collect the output chunks
 * into a single Uint8Array.
 * @param {Uint8Array} data
 * @param {TransformStream} transform
 * @returns {Promise<Uint8Array>}
 */
async function pipeThrough(data, transform) {
  const readable = new ReadableStream({
    start(controller) {
      controller.enqueue(data);
      controller.close();
    },
  });

  const reader = readable.pipeThrough(transform).getReader();
  /** @type {Uint8Array[]} */
  const chunks = [];
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
 * @param {Uint8Array} data - Raw bytes to compress
 * @param {CompressionFormat} [format='gzip'] - Compression format
 * @returns {Promise<Uint8Array>} Compressed bytes
 */
export async function compress(data, format = 'gzip') {
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
 * @param {Uint8Array} data - Compressed bytes
 * @param {CompressionFormat} [format='gzip'] - Compression format
 * @returns {Promise<Uint8Array>} Decompressed bytes
 */
export async function decompress(data, format = 'gzip') {
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
 * @param {string} str - String to compress
 * @returns {Promise<Uint8Array>} Gzip-compressed bytes
 */
export async function compressString(str) {
  const encoded = new TextEncoder().encode(str);
  return compress(encoded, 'gzip');
}

/**
 * Decompress gzip bytes back to a UTF-8 string.
 * @param {Uint8Array} data - Gzip-compressed bytes
 * @returns {Promise<string>} Decompressed string
 */
export async function decompressString(data) {
  const decompressed = await decompress(data, 'gzip');
  return new TextDecoder().decode(decompressed);
}
