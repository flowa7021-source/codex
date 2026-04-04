// @ts-check
// ─── Windows Shell Context Menu Handler ──────────────────────────────────────
// When NovaReader is launched from the Windows Explorer context menu, the Rust
// backend parses the CLI args and emits a 'cli-action' Tauri event. This module
// listens for that event, runs the appropriate conversion, saves the result next
// to the source PDF, and then reveals the output file in Explorer.
//
// Supported CLI flags (registered in the Windows registry by install-context-menu.ps1):
//   --convert-word  "file.pdf"   → file.docx
//   --convert-excel "file.pdf"   → file.xlsx
//   --convert-djvu  "file.pdf"   → file.djvu
//   --ocr           "file.pdf"   → file_ocr.pdf
//   --settings                   → (opens settings panel — handled separately)

import { initPlatform, isTauri, readFileAsBytes, writeFileBytes } from './platform.js';
import {
  getPreprocessOptions, getOcrDpi, getOcrConfidence,
  getDocxMode, getDjvuQuality,
} from './conversion-settings.js';

// ── Progress overlay (injected into document.body) ───────────────────────────

/** @type {HTMLElement|null} */
let _overlay = null;
/** @type {HTMLElement|null} */
let _progressBar = null;
/** @type {HTMLElement|null} */
let _statusText = null;

function ensureOverlay() {
  if (_overlay) return;

  _overlay = document.createElement('div');
  _overlay.id = 'ctxmenu-overlay';
  Object.assign(_overlay.style, {
    position:        'fixed',
    inset:           '0',
    zIndex:          '99999',
    background:      'rgba(18,18,24,0.96)',
    display:         'flex',
    flexDirection:   'column',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             '20px',
    fontFamily:      'system-ui, sans-serif',
    color:           '#e8e8ef',
  });

  // App name
  const title = document.createElement('div');
  title.textContent = 'NovaReader — Конвертация';
  Object.assign(title.style, { fontSize: '18px', fontWeight: '600', opacity: '0.9' });

  // File name (set later)
  const fileLabel = document.createElement('div');
  fileLabel.id = 'ctxmenu-file';
  Object.assign(fileLabel.style, { fontSize: '13px', opacity: '0.55', maxWidth: '520px',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });

  // Status text
  _statusText = document.createElement('div');
  _statusText.id = 'ctxmenu-status';
  _statusText.textContent = 'Подготовка…';
  Object.assign(_statusText.style, { fontSize: '14px', opacity: '0.8' });

  // Progress bar container
  const barWrap = document.createElement('div');
  Object.assign(barWrap.style, {
    width: '420px', height: '6px', background: 'rgba(255,255,255,0.1)',
    borderRadius: '3px', overflow: 'hidden',
  });

  _progressBar = document.createElement('div');
  Object.assign(_progressBar.style, {
    height: '100%', width: '0%', background: '#5b8ff9',
    borderRadius: '3px', transition: 'width 0.25s ease',
  });
  barWrap.appendChild(_progressBar);

  _overlay.append(title, fileLabel, _statusText, barWrap);
  document.body.appendChild(_overlay);
}

/**
 * @param {string} status
 * @param {number} pct  0–100
 */
function updateProgress(status, pct) {
  if (_statusText) _statusText.textContent = status;
  if (_progressBar) _progressBar.style.width = `${Math.max(0, Math.min(100, pct))}%`;
}

function showDone(outputPath) {
  if (!_overlay) return;
  if (_statusText) _statusText.textContent = '✓ Готово!';
  if (_progressBar) _progressBar.style.width = '100%';
  if (_progressBar) _progressBar.style.background = '#4caf7d';

  const btn = document.createElement('button');
  btn.textContent = 'Показать в проводнике';
  Object.assign(btn.style, {
    marginTop: '8px', padding: '9px 22px', borderRadius: '6px',
    background: '#5b8ff9', color: '#fff', border: 'none',
    fontSize: '14px', cursor: 'pointer',
  });
  btn.onclick = async () => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('reveal_in_explorer', { path: outputPath });
    } catch (_e) { /* ignore */ }
  };
  _overlay.appendChild(btn);

  // Auto-close after 4 s
  setTimeout(async () => {
    try {
      const { exit } = await import('@tauri-apps/plugin-process');
      await exit(0);
    } catch (_e) { window.close(); }
  }, 4000);
}

function showError(message) {
  if (!_overlay) return;
  if (_statusText) {
    _statusText.textContent = `Ошибка: ${message}`;
    _statusText.style.color = '#f27878';
  }
  if (_progressBar) _progressBar.style.background = '#e05555';

  // Close on click
  const btn = document.createElement('button');
  btn.textContent = 'Закрыть';
  Object.assign(btn.style, {
    marginTop: '8px', padding: '9px 22px', borderRadius: '6px',
    background: '#555', color: '#fff', border: 'none',
    fontSize: '14px', cursor: 'pointer',
  });
  btn.onclick = async () => {
    try {
      const { exit } = await import('@tauri-apps/plugin-process');
      await exit(1);
    } catch (_e) { window.close(); }
  };
  _overlay.appendChild(btn);
}

// ── Output path helpers ───────────────────────────────────────────────────────

/**
 * Derive output path from input path and target extension.
 * Delegates free-name search to the Rust command.
 * @param {string} inputPath  absolute path to source .pdf
 * @param {string} suffix     e.g. '.docx' | '.xlsx' | '.djvu' | '_ocr.pdf'
 * @returns {Promise<string>}
 */
async function resolveOutputPath(inputPath, suffix) {
  // Strip ".pdf" (case-insensitive) and append new suffix
  const base = inputPath.replace(/\.pdf$/i, '');
  const candidate = base + suffix;
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke('find_free_output_path', { path: candidate });
}

// ── Conversion runners ────────────────────────────────────────────────────────

/** @param {Uint8Array} bytes @param {string} fileName */
async function convertToDocx(bytes, fileName) {
  updateProgress('Загрузка PDF…', 5);
  const pdfjsMod = await import('pdfjs-dist');
  const getDoc = pdfjsMod.getDocument || /** @type {any} */ (pdfjsMod.default)?.getDocument;
  const pdfDoc = await getDoc({ data: bytes }).promise;
  updateProgress('Конвертация в Word…', 20);
  const { convertPdfToDocxCompat } = await import('./conversion-pipeline.js');
  return convertPdfToDocxCompat(pdfDoc, fileName, pdfDoc.numPages, { mode: getDocxMode() });
}

/** @param {Uint8Array} bytes @param {string} _fileName */
async function convertToXlsx(bytes, _fileName) {
  updateProgress('Конвертация в Excel…', 20);
  const { convertPdfToXlsx } = await import('./pdf-to-xlsx.js');
  const result = await convertPdfToXlsx(bytes);
  return result.blob;
}

/** @param {Uint8Array} bytes @param {string} _fileName */
async function convertToDjvu(bytes, _fileName) {
  const { convertPdfToDjvu } = await import('./pdf-to-djvu.js');
  const result = await convertPdfToDjvu(bytes, {
    quality: getDjvuQuality(),
    onProgress: (cur, tot, stage) => {
      updateProgress(
        `DjVu ${stage}: стр. ${cur}/${tot}`,
        10 + ((cur - 1) / Math.max(1, tot)) * 80,
      );
    },
  });
  return result.blob;
}

/** @param {Uint8Array} bytes @param {string} _fileName */
async function convertOcr(bytes, _fileName) {
  const pdfjsMod = await import('pdfjs-dist');
  const getDoc = pdfjsMod.getDocument || /** @type {any} */ (pdfjsMod.default)?.getDocument;
  const pdfDoc = await getDoc({ data: bytes }).promise;
  const numPages = pdfDoc.numPages;

  const { preprocessForOcr } = await import('./ocr-preprocess.js');
  const { recognizeTesseract } = await import('./ocr-engine.js');
  const { createSearchablePdf } = await import('./ocr-batch.js');

  const OCR_SCALE = getOcrDpi() / 72;
  /** @type {Map<number, any>} */
  const ocrResults = new Map();

  for (let p = 1; p <= numPages; p++) {
    updateProgress(`OCR: стр. ${p}/${numPages}…`, 10 + ((p - 1) / numPages) * 70);
    const page = await pdfDoc.getPage(p);
    const vp = page.getViewport({ scale: OCR_SCALE });
    const canvas = document.createElement('canvas');
    canvas.width  = Math.round(vp.width);
    canvas.height = Math.round(vp.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    const preprocessed = preprocessForOcr(canvas, getPreprocessOptions());
    const result = await recognizeTesseract(preprocessed);
    ocrResults.set(p, {
      text: result.text, words: result.words,
      imageWidth: preprocessed.width, imageHeight: preprocessed.height,
      confidence: result.confidence,
    });
    canvas.width = 0; canvas.height = 0;
  }

  updateProgress('Создание текстового слоя…', 85);
  const { blob } = await createSearchablePdf(bytes, ocrResults, { minConfidence: getOcrConfidence() });
  return blob;
}

// ── Main handler ──────────────────────────────────────────────────────────────

/**
 * @param {{ action: string, file_path: string|null }} payload
 */
async function handleCliAction(payload) {
  const { action, file_path: filePath } = payload;

  if (action === 'settings') {
    // Settings panel — let the normal UI handle it; no overlay needed.
    const settingsBtn = /** @type {HTMLElement|null} */ (document.querySelector('[data-action="settings"]'));
    settingsBtn?.click();
    return;
  }

  if (action === 'toolbox') {
    // Open full toolbox overlay, pre-loading the file if one was provided.
    const { openToolboxWithFiles, openToolboxOverlay } = await import('./toolbox-grid.js');
    if (filePath) {
      openToolboxWithFiles([filePath]);
    } else {
      openToolboxOverlay();
    }
    return;
  }

  if (!filePath) {
    console.warn('[context-menu] No file path provided for action:', action);
    return;
  }

  // Show progress overlay immediately
  ensureOverlay();
  const fileLabel = document.getElementById('ctxmenu-file');
  if (fileLabel) fileLabel.textContent = filePath;

  try {
    updateProgress('Чтение файла…', 3);
    const bytes = await readFileAsBytes(filePath);

    const fileName = filePath.split(/[\\/]/).pop() ?? 'document.pdf';

    /** @type {Blob} */
    let blob;
    /** @type {string} */
    let outputPath;

    switch (action) {
      case 'convert-word': {
        blob = await convertToDocx(bytes, fileName);
        outputPath = await resolveOutputPath(filePath, '.docx');
        break;
      }
      case 'convert-excel': {
        blob = await convertToXlsx(bytes, fileName);
        outputPath = await resolveOutputPath(filePath, '.xlsx');
        break;
      }
      case 'convert-djvu': {
        blob = await convertToDjvu(bytes, fileName);
        outputPath = await resolveOutputPath(filePath, '.djvu');
        break;
      }
      case 'ocr': {
        blob = await convertOcr(bytes, fileName);
        outputPath = await resolveOutputPath(filePath, '_ocr.pdf');
        break;
      }
      default:
        throw new Error(`Неизвестное действие: ${action}`);
    }

    updateProgress('Сохранение…', 95);
    const resultBytes = new Uint8Array(await blob.arrayBuffer());
    await writeFileBytes(outputPath, resultBytes);

    showDone(outputPath);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[context-menu] Conversion failed:', msg);
    showError(msg);
  }
}

// ── Init ─────────────────────────────────────────────────────────────────────

/**
 * Register the 'cli-action' Tauri event listener.
 * Must be called after initPlatform() resolves.
 * No-op in browser mode.
 */
export async function initContextMenuHandler() {
  await initPlatform();
  if (!isTauri()) return;

  try {
    const { listen } = await import('@tauri-apps/api/event');
    await listen('cli-action', (event) => {
      handleCliAction(/** @type {any} */ (event.payload));
    });
  } catch (err) {
    console.warn('[context-menu] Failed to register cli-action listener:', err);
  }
}
