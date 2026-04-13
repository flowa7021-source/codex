// ─── Unit Tests: mime-type ────────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  getMimeType,
  getExtensionForMime,
  isImageMime,
  isVideoMime,
  isAudioMime,
  isDocumentMime,
  isTextMime,
  detectMimeFromBytes,
  normalizeMime,
  isMimeAccepted,
} from '../../app/modules/mime-type.js';

// ─── getMimeType ──────────────────────────────────────────────────────────────

describe('getMimeType', () => {
  it("'pdf' → 'application/pdf'", () => {
    assert.equal(getMimeType('pdf'), 'application/pdf');
  });

  it("'jpg' → 'image/jpeg'", () => {
    assert.equal(getMimeType('jpg'), 'image/jpeg');
  });

  it("'jpeg' → 'image/jpeg'", () => {
    assert.equal(getMimeType('jpeg'), 'image/jpeg');
  });

  it("'png' → 'image/png'", () => {
    assert.equal(getMimeType('png'), 'image/png');
  });

  it("'gif' → 'image/gif'", () => {
    assert.equal(getMimeType('gif'), 'image/gif');
  });

  it("'webp' → 'image/webp'", () => {
    assert.equal(getMimeType('webp'), 'image/webp');
  });

  it("'svg' → 'image/svg+xml'", () => {
    assert.equal(getMimeType('svg'), 'image/svg+xml');
  });

  it("'mp4' → 'video/mp4'", () => {
    assert.equal(getMimeType('mp4'), 'video/mp4');
  });

  it("'mp3' → 'audio/mpeg'", () => {
    assert.equal(getMimeType('mp3'), 'audio/mpeg');
  });

  it("'wav' → 'audio/wav'", () => {
    assert.equal(getMimeType('wav'), 'audio/wav');
  });

  it("'ogg' → 'audio/ogg'", () => {
    assert.equal(getMimeType('ogg'), 'audio/ogg');
  });

  it("'html' → 'text/html'", () => {
    assert.equal(getMimeType('html'), 'text/html');
  });

  it("'css' → 'text/css'", () => {
    assert.equal(getMimeType('css'), 'text/css');
  });

  it("'js' → 'text/javascript'", () => {
    assert.equal(getMimeType('js'), 'text/javascript');
  });

  it("'json' → 'application/json'", () => {
    assert.equal(getMimeType('json'), 'application/json');
  });

  it("'txt' → 'text/plain'", () => {
    assert.equal(getMimeType('txt'), 'text/plain');
  });

  it("'xml' → 'application/xml'", () => {
    assert.equal(getMimeType('xml'), 'application/xml');
  });

  it("'zip' → 'application/zip'", () => {
    assert.equal(getMimeType('zip'), 'application/zip');
  });

  it("'djvu' → 'image/vnd.djvu'", () => {
    assert.equal(getMimeType('djvu'), 'image/vnd.djvu');
  });

  it('unknown extension → null', () => {
    assert.equal(getMimeType('xyz123'), null);
  });

  it('empty string → null', () => {
    assert.equal(getMimeType(''), null);
  });

  it('handles uppercase extension', () => {
    assert.equal(getMimeType('PDF'), 'application/pdf');
  });

  it('handles leading dot', () => {
    assert.equal(getMimeType('.png'), 'image/png');
  });
});

// ─── getExtensionForMime ──────────────────────────────────────────────────────

describe('getExtensionForMime', () => {
  it("'image/jpeg' → 'jpg'", () => {
    assert.equal(getExtensionForMime('image/jpeg'), 'jpg');
  });

  it("'application/pdf' → 'pdf'", () => {
    assert.equal(getExtensionForMime('application/pdf'), 'pdf');
  });

  it("'image/png' → 'png'", () => {
    assert.equal(getExtensionForMime('image/png'), 'png');
  });

  it("'audio/mpeg' → 'mp3'", () => {
    assert.equal(getExtensionForMime('audio/mpeg'), 'mp3');
  });

  it("'video/mp4' → 'mp4'", () => {
    assert.equal(getExtensionForMime('video/mp4'), 'mp4');
  });

  it("'application/zip' → 'zip'", () => {
    assert.equal(getExtensionForMime('application/zip'), 'zip');
  });

  it('unknown MIME type → null', () => {
    assert.equal(getExtensionForMime('application/x-unknown-type'), null);
  });

  it('handles MIME with parameters', () => {
    assert.equal(getExtensionForMime('text/plain; charset=utf-8'), 'txt');
  });
});

// ─── isImageMime ──────────────────────────────────────────────────────────────

describe('isImageMime', () => {
  it('returns true for image/jpeg', () => {
    assert.equal(isImageMime('image/jpeg'), true);
  });

  it('returns true for image/png', () => {
    assert.equal(isImageMime('image/png'), true);
  });

  it('returns true for image/gif', () => {
    assert.equal(isImageMime('image/gif'), true);
  });

  it('returns true for image/webp', () => {
    assert.equal(isImageMime('image/webp'), true);
  });

  it('returns true for image/svg+xml', () => {
    assert.equal(isImageMime('image/svg+xml'), true);
  });

  it('returns false for video/mp4', () => {
    assert.equal(isImageMime('video/mp4'), false);
  });

  it('returns false for audio/mpeg', () => {
    assert.equal(isImageMime('audio/mpeg'), false);
  });

  it('returns false for application/pdf', () => {
    assert.equal(isImageMime('application/pdf'), false);
  });

  it('returns false for text/html', () => {
    assert.equal(isImageMime('text/html'), false);
  });
});

// ─── isVideoMime ──────────────────────────────────────────────────────────────

describe('isVideoMime', () => {
  it('returns true for video/mp4', () => {
    assert.equal(isVideoMime('video/mp4'), true);
  });

  it('returns true for video/webm', () => {
    assert.equal(isVideoMime('video/webm'), true);
  });

  it('returns true for video/ogg', () => {
    assert.equal(isVideoMime('video/ogg'), true);
  });

  it('returns false for audio/mpeg', () => {
    assert.equal(isVideoMime('audio/mpeg'), false);
  });

  it('returns false for image/jpeg', () => {
    assert.equal(isVideoMime('image/jpeg'), false);
  });
});

// ─── isAudioMime ──────────────────────────────────────────────────────────────

describe('isAudioMime', () => {
  it('returns true for audio/mpeg', () => {
    assert.equal(isAudioMime('audio/mpeg'), true);
  });

  it('returns true for audio/wav', () => {
    assert.equal(isAudioMime('audio/wav'), true);
  });

  it('returns true for audio/ogg', () => {
    assert.equal(isAudioMime('audio/ogg'), true);
  });

  it('returns true for audio/flac', () => {
    assert.equal(isAudioMime('audio/flac'), true);
  });

  it('returns false for video/mp4', () => {
    assert.equal(isAudioMime('video/mp4'), false);
  });

  it('returns false for image/jpeg', () => {
    assert.equal(isAudioMime('image/jpeg'), false);
  });
});

// ─── isDocumentMime ───────────────────────────────────────────────────────────

describe('isDocumentMime', () => {
  it('returns true for application/pdf', () => {
    assert.equal(isDocumentMime('application/pdf'), true);
  });

  it('returns true for application/msword', () => {
    assert.equal(isDocumentMime('application/msword'), true);
  });

  it('returns true for docx MIME type', () => {
    assert.equal(
      isDocumentMime('application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
      true,
    );
  });

  it('returns true for image/vnd.djvu', () => {
    assert.equal(isDocumentMime('image/vnd.djvu'), true);
  });

  it('returns false for image/jpeg', () => {
    assert.equal(isDocumentMime('image/jpeg'), false);
  });

  it('returns false for text/plain', () => {
    assert.equal(isDocumentMime('text/plain'), false);
  });

  it('returns false for video/mp4', () => {
    assert.equal(isDocumentMime('video/mp4'), false);
  });
});

// ─── isTextMime ───────────────────────────────────────────────────────────────

describe('isTextMime', () => {
  it('returns true for text/plain', () => {
    assert.equal(isTextMime('text/plain'), true);
  });

  it('returns true for text/html', () => {
    assert.equal(isTextMime('text/html'), true);
  });

  it('returns true for text/css', () => {
    assert.equal(isTextMime('text/css'), true);
  });

  it('returns true for text/javascript', () => {
    assert.equal(isTextMime('text/javascript'), true);
  });

  it('returns true for application/json', () => {
    assert.equal(isTextMime('application/json'), true);
  });

  it('returns true for application/xml', () => {
    assert.equal(isTextMime('application/xml'), true);
  });

  it('returns false for image/jpeg', () => {
    assert.equal(isTextMime('image/jpeg'), false);
  });

  it('returns false for application/pdf', () => {
    assert.equal(isTextMime('application/pdf'), false);
  });

  it('returns false for video/mp4', () => {
    assert.equal(isTextMime('video/mp4'), false);
  });
});

// ─── detectMimeFromBytes ──────────────────────────────────────────────────────

describe('detectMimeFromBytes', () => {
  it('detects PDF from %PDF magic bytes', () => {
    const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
    assert.equal(detectMimeFromBytes(bytes), 'application/pdf');
  });

  it('detects PNG from magic bytes', () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    assert.equal(detectMimeFromBytes(bytes), 'image/png');
  });

  it('detects JPEG from FF D8 FF magic bytes', () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    assert.equal(detectMimeFromBytes(bytes), 'image/jpeg');
  });

  it('detects GIF from GIF8 magic bytes', () => {
    const bytes = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
    assert.equal(detectMimeFromBytes(bytes), 'image/gif');
  });

  it('detects WAV from RIFF...WAVE magic bytes', () => {
    const bytes = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, // RIFF
      0x24, 0x00, 0x00, 0x00, // chunk size
      0x57, 0x41, 0x56, 0x45, // WAVE
    ]);
    assert.equal(detectMimeFromBytes(bytes), 'audio/wav');
  });

  it('detects WebP from RIFF...WEBP magic bytes', () => {
    const bytes = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, // RIFF
      0x24, 0x00, 0x00, 0x00, // chunk size
      0x57, 0x45, 0x42, 0x50, // WEBP
    ]);
    assert.equal(detectMimeFromBytes(bytes), 'image/webp');
  });

  it('detects OGG from OggS magic bytes', () => {
    const bytes = new Uint8Array([0x4f, 0x67, 0x67, 0x53, 0x00]);
    assert.equal(detectMimeFromBytes(bytes), 'audio/ogg');
  });

  it('detects ZIP from PK magic bytes', () => {
    const bytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14]);
    assert.equal(detectMimeFromBytes(bytes), 'application/zip');
  });

  it('returns null for unrecognized bytes', () => {
    const bytes = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
    assert.equal(detectMimeFromBytes(bytes), null);
  });

  it('returns null for empty bytes', () => {
    assert.equal(detectMimeFromBytes(new Uint8Array([])), null);
  });

  it('returns null for too-short bytes that match no signature', () => {
    const bytes = new Uint8Array([0x25]); // just '%', not enough for PDF
    assert.equal(detectMimeFromBytes(bytes), null);
  });
});

// ─── normalizeMime ────────────────────────────────────────────────────────────

describe('normalizeMime', () => {
  it('lowercases the MIME type', () => {
    assert.equal(normalizeMime('IMAGE/JPEG'), 'image/jpeg');
  });

  it('strips charset parameter', () => {
    assert.equal(normalizeMime('text/html; charset=utf-8'), 'text/html');
  });

  it('strips multiple parameters', () => {
    assert.equal(normalizeMime('text/plain; charset=utf-8; boundary=xyz'), 'text/plain');
  });

  it('returns already-normalized MIME unchanged', () => {
    assert.equal(normalizeMime('application/json'), 'application/json');
  });

  it('trims whitespace around the type', () => {
    assert.equal(normalizeMime('  image/png  '), 'image/png');
  });

  it('handles mixed case with parameters', () => {
    assert.equal(normalizeMime('Text/HTML; Charset=UTF-8'), 'text/html');
  });
});

// ─── isMimeAccepted ───────────────────────────────────────────────────────────

describe('isMimeAccepted', () => {
  it("'*/*' accepts any MIME type", () => {
    assert.equal(isMimeAccepted('image/jpeg', '*/*'), true);
    assert.equal(isMimeAccepted('video/mp4', '*/*'), true);
    assert.equal(isMimeAccepted('application/pdf', '*/*'), true);
  });

  it("'image/*' accepts all image types", () => {
    assert.equal(isMimeAccepted('image/jpeg', 'image/*'), true);
    assert.equal(isMimeAccepted('image/png', 'image/*'), true);
    assert.equal(isMimeAccepted('image/gif', 'image/*'), true);
  });

  it("'image/*' rejects non-image types", () => {
    assert.equal(isMimeAccepted('video/mp4', 'image/*'), false);
    assert.equal(isMimeAccepted('audio/mpeg', 'image/*'), false);
    assert.equal(isMimeAccepted('application/pdf', 'image/*'), false);
  });

  it('exact match works', () => {
    assert.equal(isMimeAccepted('application/pdf', 'application/pdf'), true);
  });

  it('exact mismatch returns false', () => {
    assert.equal(isMimeAccepted('image/jpeg', 'image/png'), false);
  });

  it('comma-separated accept list works', () => {
    assert.equal(isMimeAccepted('image/jpeg', 'image/png, image/jpeg, image/gif'), true);
    assert.equal(isMimeAccepted('application/pdf', 'image/png, image/jpeg'), false);
  });

  it('mixed accept list with wildcard', () => {
    assert.equal(isMimeAccepted('video/mp4', 'image/*, video/*'), true);
    assert.equal(isMimeAccepted('audio/mpeg', 'image/*, video/*'), false);
  });

  it('is case-insensitive for MIME type', () => {
    assert.equal(isMimeAccepted('IMAGE/JPEG', 'image/jpeg'), true);
  });

  it('handles MIME type with parameters in the accept string', () => {
    assert.equal(isMimeAccepted('text/plain', 'text/plain;charset=utf-8'), true);
  });

  it('extension accept token (.pdf) works', () => {
    assert.equal(isMimeAccepted('application/pdf', '.pdf'), true);
    assert.equal(isMimeAccepted('image/jpeg', '.pdf'), false);
  });
});
