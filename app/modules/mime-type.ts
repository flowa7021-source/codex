// @ts-check
// ─── MIME Type Utilities ──────────────────────────────────────────────────────
// MIME type detection, mapping, and validation helpers.

// ─── Internal Maps ────────────────────────────────────────────────────────────

const EXT_TO_MIME: Record<string, string> = {
  // Documents
  pdf: 'application/pdf',
  djvu: 'image/vnd.djvu',
  djv: 'image/vnd.djvu',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  // Images
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
  bmp: 'image/bmp',
  tiff: 'image/tiff',
  tif: 'image/tiff',
  avif: 'image/avif',
  // Video
  mp4: 'video/mp4',
  webm: 'video/webm',
  ogv: 'video/ogg',
  avi: 'video/x-msvideo',
  mov: 'video/quicktime',
  mkv: 'video/x-matroska',
  // Audio
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  aac: 'audio/aac',
  flac: 'audio/flac',
  m4a: 'audio/mp4',
  // Text / Web
  html: 'text/html',
  htm: 'text/html',
  css: 'text/css',
  js: 'text/javascript',
  mjs: 'text/javascript',
  ts: 'text/typescript',
  txt: 'text/plain',
  md: 'text/markdown',
  csv: 'text/csv',
  // Data
  json: 'application/json',
  xml: 'application/xml',
  yaml: 'application/yaml',
  yml: 'application/yaml',
  // Archive
  zip: 'application/zip',
  gz: 'application/gzip',
  tar: 'application/x-tar',
  rar: 'application/vnd.rar',
  '7z': 'application/x-7z-compressed',
  // Font
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  otf: 'font/otf',
};

// Build reverse map (mime → first matching extension)
const MIME_TO_EXT: Record<string, string> = {};
for (const [ext, mime] of Object.entries(EXT_TO_MIME)) {
  if (!(mime in MIME_TO_EXT)) {
    MIME_TO_EXT[mime] = ext;
  }
}

// ─── Magic Bytes ──────────────────────────────────────────────────────────────

const MAGIC_SIGNATURES: Array<{ bytes: number[]; mask?: number[]; mime: string }> = [
  { bytes: [0x25, 0x50, 0x44, 0x46], mime: 'application/pdf' },           // %PDF
  { bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], mime: 'image/png' }, // PNG
  { bytes: [0xff, 0xd8, 0xff], mime: 'image/jpeg' },                       // JPEG
  { bytes: [0x47, 0x49, 0x46, 0x38], mime: 'image/gif' },                  // GIF8
  { bytes: [0x52, 0x49, 0x46, 0x46], mime: 'image/webp' },                 // RIFF (WebP check below)
  { bytes: [0x49, 0x49, 0x2a, 0x00], mime: 'image/tiff' },                 // TIFF LE
  { bytes: [0x4d, 0x4d, 0x00, 0x2a], mime: 'image/tiff' },                 // TIFF BE
  { bytes: [0x42, 0x4d], mime: 'image/bmp' },                              // BM
  { bytes: [0x50, 0x4b, 0x03, 0x04], mime: 'application/zip' },           // PK zip
  { bytes: [0x1f, 0x8b], mime: 'application/gzip' },                       // gzip
  { bytes: [0x49, 0x44, 0x33], mime: 'audio/mpeg' },                       // ID3 (MP3)
  { bytes: [0xff, 0xfb], mime: 'audio/mpeg' },                             // MP3 frame
  { bytes: [0xff, 0xf3], mime: 'audio/mpeg' },                             // MP3 frame
  { bytes: [0xff, 0xf2], mime: 'audio/mpeg' },                             // MP3 frame
  { bytes: [0x52, 0x49, 0x46, 0x46], mime: 'audio/wav' },                  // RIFF (WAV check below)
  { bytes: [0x4f, 0x67, 0x67, 0x53], mime: 'audio/ogg' },                  // OggS
  { bytes: [0x66, 0x4c, 0x61, 0x43], mime: 'audio/flac' },                 // fLaC
  { bytes: [0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70], mime: 'video/mp4' }, // ftyp box
  { bytes: [0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70], mime: 'video/mp4' }, // ftyp box variant
  { bytes: [0x1a, 0x45, 0xdf, 0xa3], mime: 'video/webm' },                 // EBML (WebM/MKV)
  { bytes: [0x41, 0x54, 0x26, 0x54, 0x46, 0x4f, 0x52, 0x4d], mime: 'image/vnd.djvu' }, // AT&TFORM (DJVU)
];

// ─── Public API ──────────────────────────────────────────────────────────────

/** Get MIME type for a file extension (e.g., 'pdf' → 'application/pdf'). */
export function getMimeType(ext: string): string | null {
  const normalized = ext.toLowerCase().replace(/^\./, '');
  return EXT_TO_MIME[normalized] ?? null;
}

/** Get file extension for a MIME type (e.g., 'image/jpeg' → 'jpg'). */
export function getExtensionForMime(mime: string): string | null {
  const normalized = normalizeMime(mime);
  return MIME_TO_EXT[normalized] ?? null;
}

/** Check if a MIME type is an image. */
export function isImageMime(mime: string): boolean {
  return normalizeMime(mime).startsWith('image/');
}

/** Check if a MIME type is a video. */
export function isVideoMime(mime: string): boolean {
  return normalizeMime(mime).startsWith('video/');
}

/** Check if a MIME type is audio. */
export function isAudioMime(mime: string): boolean {
  return normalizeMime(mime).startsWith('audio/');
}

/** Check if a MIME type is a document (PDF, Word, etc.). */
export function isDocumentMime(mime: string): boolean {
  const normalized = normalizeMime(mime);
  const documentTypes = new Set([
    'application/pdf',
    'image/vnd.djvu',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ]);
  return documentTypes.has(normalized);
}

/** Check if a MIME type is text-based. */
export function isTextMime(mime: string): boolean {
  const normalized = normalizeMime(mime);
  if (normalized.startsWith('text/')) return true;
  const textAppTypes = new Set([
    'application/json',
    'application/xml',
    'application/yaml',
    'application/javascript',
    'application/ecmascript',
    'application/x-yaml',
  ]);
  return textAppTypes.has(normalized);
}

/** Detect MIME type from file magic bytes (first few bytes of file). */
export function detectMimeFromBytes(bytes: Uint8Array): string | null {
  for (const sig of MAGIC_SIGNATURES) {
    if (bytes.length < sig.bytes.length) continue;
    const match = sig.bytes.every((b, i) => bytes[i] === b);
    if (!match) continue;

    // Disambiguate RIFF container: could be WAV or WebP
    if (sig.bytes[0] === 0x52 && sig.bytes[1] === 0x49 && sig.bytes[2] === 0x46 && sig.bytes[3] === 0x46) {
      // Check bytes 8-11 for "WAVE" or "WEBP"
      if (bytes.length >= 12) {
        const tag = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
        if (tag === 'WAVE') return 'audio/wav';
        if (tag === 'WEBP') return 'image/webp';
      }
      continue; // Skip ambiguous RIFF
    }

    return sig.mime;
  }
  return null;
}

/** Normalize a MIME type string (lowercase, strip parameters). */
export function normalizeMime(mime: string): string {
  return mime.toLowerCase().split(';')[0].trim();
}

/** Check if a MIME type is acceptable given an accept string (like the `accept` attribute). */
export function isMimeAccepted(mime: string, accept: string): boolean {
  const normalizedMime = normalizeMime(mime);
  const tokens = accept.split(',').map((s) => s.trim().toLowerCase().split(';')[0].trim());

  for (const token of tokens) {
    if (token === '*/*') return true;
    if (token === normalizedMime) return true;
    if (token.endsWith('/*')) {
      const category = token.slice(0, token.length - 2);
      if (normalizedMime.startsWith(category + '/')) return true;
    }
    // Extension token like ".pdf"
    if (token.startsWith('.')) {
      const ext = token.slice(1);
      const mimeForExt = getMimeType(ext);
      if (mimeForExt === normalizedMime) return true;
    }
  }
  return false;
}
