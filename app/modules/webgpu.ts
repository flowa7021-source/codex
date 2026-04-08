// ─── WebGPU API Wrapper ───────────────────────────────────────────────────────
// Utilities for detecting and using the WebGPU API.

// @ts-check

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Whether the WebGPU API is supported.
 */
export function isWebGPUSupported(): boolean {
  return 'gpu' in navigator;
}

/**
 * Request a WebGPU adapter. Returns null if unavailable or unsupported.
 */
export async function requestGPUAdapter(
  options?: any,
): Promise<any | null> {
  if (!isWebGPUSupported()) return null;
  try {
    return await (navigator as any).gpu.requestAdapter(options) ?? null;
  } catch {
    return null;
  }
}

/**
 * Request a WebGPU device from an adapter.
 * Returns null on failure.
 */
export async function requestGPUDevice(
  adapter: any,
  descriptor?: any,
): Promise<any | null> {
  try {
    return await adapter.requestDevice(descriptor) ?? null;
  } catch {
    return null;
  }
}

/**
 * Get a summary of GPU capabilities from an adapter.
 */
export function getAdapterInfo(adapter: any): {
  isFallbackAdapter: boolean;
  limits: Record<string, number>;
} {
  return {
    isFallbackAdapter: adapter.isFallbackAdapter ?? false,
    limits: {},
  };
}
