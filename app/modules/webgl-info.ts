// ─── WebGL Capability Detection ───────────────────────────────────────────────
// Utilities for detecting WebGL support and querying GPU/renderer information.

// @ts-check

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Whether WebGL is supported.
 */
export function isWebGLSupported(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return canvas.getContext('webgl') !== null;
  } catch {
    return false;
  }
}

/**
 * Whether WebGL2 is supported.
 */
export function isWebGL2Supported(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return canvas.getContext('webgl2') !== null;
  } catch {
    return false;
  }
}

/**
 * Get WebGL renderer info (GPU name, vendor).
 * Returns null if not available or extension absent.
 */
export function getWebGLRendererInfo(): { renderer: string; vendor: string } | null {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') as any;
    if (!gl) return null;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (!ext) return null;
    const renderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
    const vendor = gl.getParameter(ext.UNMASKED_VENDOR_WEBGL);
    return { renderer, vendor };
  } catch {
    return null;
  }
}

/**
 * Get maximum texture size supported by WebGL.
 * Returns 0 if WebGL is unavailable.
 */
export function getMaxTextureSize(): number {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') as any;
    if (!gl) return 0;
    return gl.getParameter(gl.MAX_TEXTURE_SIZE);
  } catch {
    return 0;
  }
}

/**
 * Get a summary of WebGL capabilities.
 */
export function getWebGLCapabilities(): {
  supported: boolean;
  webgl2: boolean;
  renderer: string | null;
  vendor: string | null;
  maxTextureSize: number;
} {
  const supported = isWebGLSupported();
  const webgl2 = isWebGL2Supported();
  const rendererInfo = getWebGLRendererInfo();
  const maxTextureSize = getMaxTextureSize();
  return {
    supported,
    webgl2,
    renderer: rendererInfo?.renderer ?? null,
    vendor: rendererInfo?.vendor ?? null,
    maxTextureSize,
  };
}
