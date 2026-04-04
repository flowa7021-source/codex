// @ts-check
// ─── Conversion Settings Accessor ─────────────────────────────────────────────
// Single place to read all conversion-related parameters from state.settings.
// Converters import this module instead of reading state directly.
//
// Each getter returns a validated, type-safe value that can be passed directly
// to the corresponding converter function as part of its options object.

import { state } from './state.js';
import { defaultSettings } from './settings-controller.js';

/** @returns {any} */
function s() {
  return state.settings || defaultSettings();
}

// ── Preprocessing ─────────────────────────────────────────────────────────────

/**
 * Options for `preprocessForOcr()` in ocr-preprocess.js.
 * @returns {{ deskew: boolean, denoise: boolean, denoiseStrength: number, sharpen: boolean, binarize: boolean, removeBorders: boolean }}
 */
export function getPreprocessOptions() {
  const cfg = s();
  const denoiseLevel = Number(cfg.convDenoise ?? 1);
  return {
    deskew:         cfg.convDeskew !== false,
    denoise:        denoiseLevel > 0,
    denoiseStrength: denoiseLevel,
    sharpen:        !!cfg.convSharpen,
    binarize:       false,  // LSTM prefers grayscale — never force binarize
    removeBorders:  true,
  };
}

/**
 * Render DPI for OCR page rasterization.
 * @returns {number}  one of 150 / 300 / 400
 */
export function getOcrDpi() {
  const dpi = Number(s().convDpi ?? 300);
  return [150, 300, 400].includes(dpi) ? dpi : 300;
}

// ── Tesseract OCR engine ──────────────────────────────────────────────────────

/**
 * Tesseract OCR Engine Mode (--oem N).
 * 0 = Legacy, 1 = LSTM, 3 = LSTM+Legacy
 * @returns {number}
 */
export function getOcrOem() {
  const oem = Number(s().convOem ?? 3);
  return [0, 1, 2, 3].includes(oem) ? oem : 3;
}

/**
 * Tesseract Page Segmentation Mode (--psm N).
 * @returns {number}
 */
export function getOcrPsm() {
  const psm = Number(s().convPsm ?? 3);
  return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].includes(psm) ? psm : 3;
}

/**
 * Minimum word confidence threshold (0–100).
 * Words below this threshold are filtered or highlighted.
 * @returns {number}
 */
export function getOcrConfidence() {
  return Math.max(0, Math.min(100, Number(s().convConfidence ?? 60)));
}

// ── DOCX output ──────────────────────────────────────────────────────────────

/**
 * Conversion mode for conversion-pipeline.js convertPdfToDocxCompat().
 * Maps UI setting to internal mode string.
 * @returns {'text'|'text+images'|'layout'}
 */
export function getDocxMode() {
  const mode = s().convDocxMode || 'editable';
  if (mode === 'layout') return 'layout';
  if (mode === 'text-only') return 'text';
  // 'editable' → include images if convDocxImages is true
  return s().convDocxImages !== false ? 'text+images' : 'text';
}

/**
 * Whether to preserve text/background colors in DOCX output.
 * @returns {boolean}
 */
export function getDocxKeepColors() {
  return s().convDocxColors !== false;
}

/**
 * Whether to highlight low-confidence OCR words in DOCX with yellow.
 * @returns {boolean}
 */
export function getDocxHighlightUncertain() {
  return !!s().convDocxHighlight;
}

// ── XLSX output ──────────────────────────────────────────────────────────────

/**
 * Table extraction strategy for pdf-to-xlsx.js.
 * @returns {'auto'|'lines'|'text'|'spatial'}
 */
export function getXlsxProfile() {
  const p = s().convXlsxProfile || 'auto';
  return /** @type {any} */ (['auto', 'lines', 'text', 'spatial'].includes(p) ? p : 'auto');
}

/**
 * Options to pass to convertPdfToXlsx().
 * @returns {{ mode: 'auto'|'manual', addFormulas: boolean, autoFilter: boolean, freezeHeader: boolean }}
 */
export function getXlsxOptions() {
  const cfg = s();
  // pdf-to-xlsx.js accepts 'auto'|'manual'; map named profiles to this binary switch
  const profile = getXlsxProfile();
  const mode = /** @type {'auto'|'manual'} */ (profile === 'auto' ? 'auto' : 'manual');
  return {
    mode,
    addFormulas: cfg.convXlsxFormulas !== false,
    autoFilter:  cfg.convXlsxAutoFilter !== false,
    freezeHeader: cfg.convXlsxFreeze !== false,
  };
}

// ── DjVu output ───────────────────────────────────────────────────────────────

/**
 * Quality profile for pdf-to-djvu.js convertPdfToDjvu().
 * @returns {'compact'|'balanced'|'quality'|'archive'}
 */
export function getDjvuQuality() {
  const q = s().convDjvuQuality || 'balanced';
  return /** @type {any} */ (['compact', 'balanced', 'quality', 'archive'].includes(q) ? q : 'balanced');
}

/**
 * Whether to inject TXTa text layer into the DjVu output.
 * (Always true for now — the TXTa injection is handled inside pdf-to-djvu.js
 *  and cannot be disabled per-call; this flag is reserved for future use.)
 * @returns {boolean}
 */
export function getDjvuTextLayer() {
  return s().convDjvuTextLayer !== false;
}

// ── Output handling ──────────────────────────────────────────────────────────

/**
 * Whether to reveal the output file in Explorer/Finder after a successful
 * context-menu conversion.
 * @returns {boolean}
 */
export function getShouldOpenFolder() {
  return s().convOpenFolder !== false;
}

/**
 * What to do when the output file already exists.
 * @returns {'ask'|'overwrite'|'rename'}
 */
export function getFileExistsAction() {
  const v = s().convFileExists || 'ask';
  return /** @type {any} */ (['ask', 'overwrite', 'rename'].includes(v) ? v : 'ask');
}

/**
 * Resolve the output directory for context-menu conversions.
 * Returns null if the setting is 'same' (caller derives it from the input path).
 * @returns {string|null}
 */
export function getOutputDirectory() {
  const loc = s().convOutputLocation || 'same';
  if (loc === 'same') return null;
  if (loc === 'custom') return s().convCustomFolder || null;
  // 'desktop' and 'downloads' are resolved by Rust via find_free_output_path;
  // return a sentinel string that context-menu-handler.js can recognise.
  return loc; // 'desktop' | 'downloads'
}
