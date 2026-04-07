// @ts-check
// ─── Full-screen Toolbox Overlay ─────────────────────────────────────────────
// PDF24-style tool grid with tile-per-tool progress and state management.
// Opened via the "Полный Toolbox" sidebar button or the --toolbox CLI action.

import { readFileAsBytes, writeFileBytes, isTauri, saveOrDownload } from './platform.js';
import { yieldToMainThread } from './utils.js';
import {
  getPreprocessOptions, getOcrDpi, getOcrConfidence,
  getDocxMode, getXlsxOptions, getDjvuQuality, getOutputDirectory,
} from './conversion-settings.js';
import { toastError, toastSuccess } from './toast.js';
import { BatchedProgress, CancellationManager } from './perf-utils.js';
import { state } from './state.js';

// ── DOM refs ─────────────────────────────────────────────────────────────────

const _els = {
  overlay:        /** @type {HTMLElement|null}        */ (document.getElementById('toolboxOverlay')),
  closeBtn:       /** @type {HTMLButtonElement|null}  */ (document.getElementById('tbxClose')),
  btnAdd:         /** @type {HTMLButtonElement|null}  */ (document.getElementById('tbxBtnAdd')),
  btnRemove:      /** @type {HTMLButtonElement|null}  */ (document.getElementById('tbxBtnRemove')),
  fileInput:      /** @type {HTMLInputElement|null}   */ (document.getElementById('tbxFileInput')),
  dropZone:       /** @type {HTMLElement|null}        */ (document.getElementById('tbxDropZone')),
  fileList:       /** @type {HTMLElement|null}        */ (document.getElementById('tbxFileList')),
  outputLocation: /** @type {HTMLSelectElement|null}  */ (document.getElementById('tbxOutputLocation')),
  customFolder:   /** @type {HTMLInputElement|null}   */ (document.getElementById('tbxCustomFolder')),
  toolGrid:       /** @type {HTMLElement|null}        */ (document.getElementById('tbxToolGrid')),
  statusText:     /** @type {HTMLElement|null}        */ (document.getElementById('tbxStatusText')),
  settingsBtn:    /** @type {HTMLButtonElement|null}  */ (document.getElementById('tbxSettings')),
  settingsPanel:  /** @type {HTMLElement|null}        */ (document.getElementById('tbxSettingsPanel')),
  settingsPanelClose: /** @type {HTMLButtonElement|null} */ (document.getElementById('tbxSettingsPanelClose')),
  sidebarOpenBtn: /** @type {HTMLButtonElement|null}  */ (document.getElementById('openToolboxOverlay')),
};

// ── File list state ───────────────────────────────────────────────────────────

/** @type {Array<{file: File|null, path: string, name: string}>} */
const _files = [];
let _selectedIdx = -1;

// ── Cancellation ──────────────────────────────────────────────────────────────

const _cancel = new CancellationManager();

// ── Overlay open/close ────────────────────────────────────────────────────────

export function openToolboxOverlay() {
  if (!_els.overlay) return;
  _syncOutputBar();
  _els.overlay.classList.add('open');
  _els.overlay.setAttribute('aria-hidden', 'false');
}

export function closeToolboxOverlay() {
  if (!_els.overlay) return;
  _els.overlay.classList.remove('open');
  _els.overlay.setAttribute('aria-hidden', 'true');
}

/** Open the overlay and preload a list of file paths (from CLI --toolbox action). */
export function openToolboxWithFiles(paths) {
  _addFilePaths(paths);
  openToolboxOverlay();
}

// ── File management ───────────────────────────────────────────────────────────

function _addFiles(filesList) {
  for (const file of filesList) {
    // De-duplicate by name+size
    if (_files.some(f => f.name === file.name && (f.file?.size ?? 0) === file.size)) continue;
    _files.push({ file, path: file.name, name: file.name });
  }
  _renderFileList();
}

function _addFilePaths(paths) {
  for (const p of paths) {
    const name = p.replace(/\\/g, '/').split('/').pop() || p;
    if (_files.some(f => f.path === p)) continue;
    _files.push({ file: null, path: p, name });
  }
  _renderFileList();
}

function _removeSelected() {
  if (_selectedIdx >= 0 && _selectedIdx < _files.length) {
    _files.splice(_selectedIdx, 1);
    _selectedIdx = Math.min(_selectedIdx, _files.length - 1);
  }
  _renderFileList();
}

function _renderFileList() {
  const ul = _els.fileList;
  if (!ul) return;
  ul.innerHTML = '';

  const dz = _els.dropZone;
  if (dz) dz.classList.toggle('hidden', _files.length > 0);

  _files.forEach((entry, i) => {
    const li = document.createElement('li');
    li.classList.toggle('active', i === _selectedIdx);
    li.addEventListener('click', () => { _selectedIdx = i; _renderFileList(); });

    const ico = document.createElement('span');
    ico.textContent = '📄';
    ico.setAttribute('aria-hidden', 'true');

    const nm = document.createElement('span');
    nm.className = 'tbx-file-name';
    nm.title = entry.path;
    nm.textContent = entry.name;

    li.append(ico, nm);
    ul.appendChild(li);
  });

  if (_els.btnRemove) _els.btnRemove.disabled = _files.length === 0;
  _setStatus(_files.length > 0
    ? `${_files.length} файл${_files.length === 1 ? '' : _files.length < 5 ? 'а' : 'ов'}`
    : 'Нет файлов');
}

// ── Output folder ─────────────────────────────────────────────────────────────

function _syncOutputBar() {
  const loc = _els.outputLocation;
  const cf = _els.customFolder;
  if (!loc) return;
  // Sync with settings
  const saved = getOutputDirectory;
  if (cf) cf.hidden = loc.value !== 'custom';
  void saved;
}

function _resolveOutputFolder(inputPath) {
  const loc = _els.outputLocation?.value || 'same';
  const custom = _els.customFolder?.value.trim() || '';
  switch (loc) {
    case 'desktop':
      // In Tauri we can try common desktop paths; fall back to same dir
      return null;   // caller will use saveOrDownload
    case 'downloads':
      return null;
    case 'custom':
      return custom || null;
    default: {
      // 'same' — derive directory from input path
      const sep = inputPath.includes('/') ? '/' : '\\';
      const parts = inputPath.split(sep);
      parts.pop();
      return parts.join(sep) || '.';
    }
  }
}

// ── Tile state helpers ────────────────────────────────────────────────────────

/** @param {string} toolId */
function _getTile(toolId) {
  return /** @type {HTMLElement|null} */ (
    _els.toolGrid?.querySelector(`.tbx-tile[data-tool="${toolId}"]`) ?? null
  );
}

/**
 * @param {string} toolId
 * @param {'idle'|'running'|'success'|'error'} state
 * @param {string} [statusMsg]
 * @param {number} [percent]
 */
function _setTileState(toolId, state, statusMsg = '', percent = 0) {
  const tile = _getTile(toolId);
  if (!tile) return;
  tile.classList.remove('running', 'success', 'error');
  if (state !== 'idle') tile.classList.add(state);

  const bar = /** @type {HTMLElement|null} */ (tile.querySelector('.tbx-tile-bar'));
  const status = /** @type {HTMLElement|null} */ (tile.querySelector('.tbx-tile-status'));
  if (bar) bar.style.width = `${Math.round(percent)}%`;
  if (status) status.textContent = statusMsg;
}

function _setStatus(msg) {
  if (_els.statusText) _els.statusText.textContent = msg;
}

// ── File bytes helper ─────────────────────────────────────────────────────────

async function _getBytes(entry) {
  if (entry.file) {
    return new Uint8Array(await entry.file.arrayBuffer());
  }
  // Path from CLI — use Tauri readFile
  return readFileAsBytes(entry.path);
}

/** Build output path: replace or add extension */
function _outputPath(inputPath, newExt, suffix = '') {
  const slash = inputPath.includes('/') ? '/' : '\\';
  const parts = inputPath.split(slash);
  const base = (parts.pop() || '').replace(/\.[^.]+$/, '');
  parts.push(`${base}${suffix}.${newExt}`);
  return parts.join(slash);
}

// ── Save result ───────────────────────────────────────────────────────────────

/**
 * Save blob to disk. In Tauri with a resolved folder, writes directly.
 * Otherwise falls back to save dialog.
 */
async function _saveResult(blob, inputPath, newExt, suffix = '', mimeFilters = []) {
  const folder = _resolveOutputFolder(inputPath);
  if (folder && isTauri()) {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const outPath = _outputPath(`${folder}${'/' + (inputPath.replace(/\\/g, '/').split('/').pop() || 'output')}`, newExt, suffix);
    await writeFileBytes(outPath, bytes);
    return outPath;
  }
  // No folder resolved or not Tauri → show dialog
  const baseName = inputPath.replace(/\\/g, '/').split('/').pop()?.replace(/\.[^.]+$/, '') || 'output';
  await saveOrDownload(blob, `${baseName}${suffix}.${newExt}`, mimeFilters);
  return null;
}

// ── Tool execution ────────────────────────────────────────────────────────────

async function _runTool(toolId, entry) {
  const bytes = await _getBytes(entry);
  // Validate PDF signature (%PDF-) before attempting to parse
  if (toolId !== 'merge' && bytes.length < 5) throw new Error('Файл пустой или повреждён');
  if (toolId !== 'merge' && !(bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46)) {
    throw new Error(`Файл не является PDF (заголовок не найден): ${entry.name}`);
  }
  const reportPct = (/** @type {number} */ p) => _setTileState(toolId, 'running', `${p}%`, p);

  switch (toolId) {
    case 'docx': {
      const pdfjsMod = await import('pdfjs-dist');
      const getDoc = pdfjsMod.getDocument || pdfjsMod.default?.getDocument;
      const pdfDoc = await getDoc({ data: bytes }).promise;
      const { convertPdfToDocxCompat } = await import('./conversion-pipeline.js');
      const blob = await convertPdfToDocxCompat(pdfDoc, entry.name, pdfDoc.numPages, { mode: getDocxMode() });
      return _saveResult(blob, entry.path, 'docx', '', [{ name: 'Word', extensions: ['docx'] }]);
    }

    case 'xlsx': {
      const { convertPdfToXlsx } = await import('./pdf-to-xlsx.js');
      const result = await convertPdfToXlsx(bytes, getXlsxOptions());
      return _saveResult(result.blob, entry.path, 'xlsx', '', [{ name: 'Excel', extensions: ['xlsx'] }]);
    }

    case 'djvu': {
      const { convertPdfToDjvu } = await import('./pdf-to-djvu.js');
      const result = await convertPdfToDjvu(bytes, {
        quality: getDjvuQuality(),
        onProgress: (cur, tot) => reportPct(Math.round((cur / Math.max(1, tot)) * 90)),
      });
      return _saveResult(result.blob, entry.path, 'djvu', '', [{ name: 'DjVu', extensions: ['djvu'] }]);
    }

    case 'pptx': {
      const { convertPdfToPptx } = await import('./pdf-to-pptx.js');
      const result = await convertPdfToPptx(bytes);
      return _saveResult(result.blob, entry.path, 'pptx', '', [{ name: 'PPTX', extensions: ['pptx'] }]);
    }

    case 'pdfa': {
      const { convertToPdfA } = await import('./pdf-a-converter.js');
      const result = await convertToPdfA(bytes, { title: entry.name });
      return _saveResult(result.blob, entry.path, 'pdf', '-pdfa', [{ name: 'PDF/A', extensions: ['pdf'] }]);
    }

    case 'images': {
      return _runPdfToImages(bytes, entry, reportPct);
    }

    case 'ocr': {
      return _runOcr(bytes, entry, reportPct);
    }

    case 'split': {
      const { splitPdfIntoIndividual } = await import('./pdf-operations.js');
      const blobs = await splitPdfIntoIndividual(bytes.buffer);
      if (!Array.isArray(blobs)) throw new Error('split returned nothing');
      for (let i = 0; i < blobs.length; i++) {
        const b = blobs[i];
        const suffix = `-p${String(i + 1).padStart(3, '0')}`;
        await _saveResult(b instanceof Blob ? b : new Blob([/** @type {any} */ (b)], { type: 'application/pdf' }),
          entry.path, 'pdf', suffix, [{ name: 'PDF', extensions: ['pdf'] }]);
        reportPct(Math.round(((i + 1) / blobs.length) * 100));
      }
      return null;
    }

    case 'merge': {
      if (_files.length < 2) throw new Error('Для объединения нужно минимум 2 файла');
      const { mergePdfDocuments } = await import('./pdf-operations.js');
      // Collect all files as File objects or blobs
      const allFiles = await Promise.all(_files.map(e => {
        if (e.file) return Promise.resolve(e.file);
        // Convert path-based entry to blob
        return _getBytes(e).then(b => new Blob([b], { type: 'application/pdf' }));
      }));
      const blob = await mergePdfDocuments(/** @type {any} */ (allFiles));
      return _saveResult(blob, entry.path, 'pdf', '-merged', [{ name: 'PDF', extensions: ['pdf'] }]);
    }

    case 'compress': {
      const { PDFDocument } = await import('pdf-lib');
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const saved = await doc.save({ useObjectStreams: true });
      const blob = new Blob([/** @type {any} */ (saved)], { type: 'application/pdf' });
      return _saveResult(blob, entry.path, 'pdf', '-compressed', [{ name: 'PDF', extensions: ['pdf'] }]);
    }

    case 'protect': {
      const pwd = await _promptPassword();
      if (!pwd) throw new Error('Пароль не указан');
      const { setPassword, LOCKED_PERMISSIONS } = await import('./pdf-security.js');
      const result = await setPassword(bytes, pwd, '', LOCKED_PERMISSIONS);
      return _saveResult(result.blob ?? new Blob([/** @type {any} */ (result)], { type: 'application/pdf' }),
        entry.path, 'pdf', '-protected', [{ name: 'PDF', extensions: ['pdf'] }]);
    }

    case 'rotate': {
      const { rotatePdfPages } = await import('./pdf-operations.js');
      const pdfjsMod = await import('pdfjs-dist');
      const getDoc = pdfjsMod.getDocument || pdfjsMod.default?.getDocument;
      const pdfDoc = await getDoc({ data: bytes }).promise;
      const allPages = Array.from({ length: pdfDoc.numPages }, (_, i) => i + 1);
      const rotated = await rotatePdfPages(bytes.buffer, allPages, 90);
      const blob = rotated instanceof Blob ? rotated : new Blob([/** @type {any} */ (rotated)], { type: 'application/pdf' });
      return _saveResult(blob, entry.path, 'pdf', '-rotated', [{ name: 'PDF', extensions: ['pdf'] }]);
    }

    default:
      throw new Error(`Unknown tool: ${toolId}`);
  }
}

async function _runOcr(bytes, entry, reportPct) {
  const OCR_SCALE = getOcrDpi() / 72;
  const pdfjsMod = await import('pdfjs-dist');
  const getDoc = pdfjsMod.getDocument || pdfjsMod.default?.getDocument;
  const pdfDoc = await getDoc({ data: bytes }).promise;
  const { createSearchablePdf } = await import('./ocr-batch.js');
  const { initTesseract, recognizeTesseract } = await import('./tesseract-adapter.js');
  const { preprocessForOcr } = await import('./ocr-preprocess.js');

  await initTesseract('auto');

  /** @type {Map<number, any>} */
  const ocrResults = new Map();
  const numPages = pdfDoc.numPages;

  for (let p = 1; p <= numPages; p++) {
    reportPct(Math.round(((p - 1) / numPages) * 85));
    // Yield to the UI thread between pages to prevent freezing
    await yieldToMainThread(0);
    const page = await pdfDoc.getPage(p);
    const vp = page.getViewport({ scale: OCR_SCALE });
    const w = Math.round(vp.width);
    const h = Math.round(vp.height);
    if (w <= 0 || h <= 0) { ocrResults.set(p, { text: '', words: [], imageWidth: w, imageHeight: h, confidence: 0 }); continue; }
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    await yieldToMainThread(0);
    const preprocessed = preprocessForOcr(canvas, getPreprocessOptions());
    const result = await recognizeTesseract(preprocessed);
    ocrResults.set(p, { text: result.text, words: result.words,
      imageWidth: preprocessed.width, imageHeight: preprocessed.height, confidence: result.confidence });
    canvas.width = 0; canvas.height = 0;
  }

  reportPct(90);
  const searchable = await createSearchablePdf(bytes, ocrResults, { minConfidence: getOcrConfidence() });
  const blob = searchable.blob ?? new Blob([/** @type {any} */ (searchable)], { type: 'application/pdf' });
  return _saveResult(blob, entry.path, 'pdf', '-ocr', [{ name: 'PDF', extensions: ['pdf'] }]);
}

async function _runPdfToImages(bytes, entry, reportPct) {
  const RENDER_SCALE = 2; // ~144 dpi
  const pdfjsMod = await import('pdfjs-dist');
  const getDoc = pdfjsMod.getDocument || pdfjsMod.default?.getDocument;
  const pdfDoc = await getDoc({ data: bytes }).promise;
  const numPages = pdfDoc.numPages;

  for (let p = 1; p <= numPages; p++) {
    reportPct(Math.round(((p - 1) / numPages) * 100));
    const page = await pdfDoc.getPage(p);
    const vp = page.getViewport({ scale: RENDER_SCALE });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(vp.width);
    canvas.height = Math.round(vp.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    const pngBlob = await new Promise((resolve) => canvas.toBlob(b => resolve(b || new Blob()), 'image/png'));
    const suffix = `-p${String(p).padStart(3, '0')}`;
    await _saveResult(pngBlob, entry.path, 'png', suffix, [{ name: 'PNG', extensions: ['png'] }]);
    canvas.width = 0; canvas.height = 0;
  }
  return null;
}

/** Minimal inline password prompt for the Protect tool. */
function _promptPassword() {
  return new Promise((resolve) => {
    const { nrPrompt } = /** @type {any} */ (window).__nrPrompt
      ? { nrPrompt: /** @type {any} */ (window).__nrPrompt }
      : { nrPrompt: null };

    if (nrPrompt) { resolve(nrPrompt('Введите пароль для защиты:')); return; }

    // Fallback: browser prompt
    const pwd = window.prompt('Введите пароль для защиты PDF:');
    resolve(pwd || '');
  });
}

// ── Tile click handler ────────────────────────────────────────────────────────

async function _onTileClick(toolId) {
  if (_files.length === 0) {
    // Flash drop zone
    const dz = _els.dropZone;
    if (dz) {
      dz.classList.add('dragover');
      setTimeout(() => dz.classList.remove('dragover'), 700);
    }
    return;
  }

  // Cancel any previous operation on this (or another) tile
  const signal = _cancel.begin();

  // Merge operates on all files; others operate per-file
  const targets = toolId === 'merge' ? [_files[0]] : _files;
  const totalFiles = targets.length;
  let done = 0;

  _setTileState(toolId, 'running', 'Запуск…', 0);
  _setStatus(`${toolId}: запуск…`);

  // Batch tile progress updates to ≤1 per 250ms so rapid file loops don't
  // saturate the DOM with style recalculations.
  const bp = new BatchedProgress(
    (/** @type {string} */ label, /** @type {number} */ pct) => _setTileState(toolId, 'running', label, pct),
  );

  try {
    for (const entry of targets) {
      if (signal.aborted) break;
      bp.report(entry.name, Math.round((done / totalFiles) * 95));
      await _runTool(toolId, entry);
      done++;
      bp.report(`${done}/${totalFiles}`, Math.round((done / totalFiles) * 100));
    }

    bp.done();

    if (signal.aborted) {
      _setTileState(toolId, 'idle');
      return;
    }

    _setTileState(toolId, 'success', '✓ Готово', 100);
    _setStatus(`✓ ${toolId}: готово`);
    toastSuccess(`Готово: ${done} файл${done === 1 ? '' : 'а/ов'}`);
  } catch (err) {
    bp.cancel();
    const msg = err instanceof Error ? err.message : String(err);
    _setTileState(toolId, 'error', '✗ Ошибка', 100);
    _setStatus(`✗ Ошибка: ${msg}`);
    toastError(`Ошибка (${toolId}): ${msg}`);
  }

  // Auto-reset tile after 2 s
  setTimeout(() => _setTileState(toolId, 'idle'), 2000);
}

// ── Settings panel helpers ─────────────────────────────────────────────────────

/** Populate settings panel controls from current state.settings. */
function _loadSettingsPanel() {
  const s = state.settings || {};
  const panel = _els.settingsPanel;
  if (!panel) return;

  /** @param {string} id @param {any} val */
  function _set(id, val) {
    const el = /** @type {any} */ (panel.querySelector(`#${id}`));
    if (!el) return;
    if (el.type === 'checkbox') el.checked = val !== false && val !== 0 && val !== '0';
    else el.value = String(val ?? el.value);
  }

  _set('tbxCfgDpi',            s.convDpi         ?? 600);
  _set('tbxCfgOem',            s.convOem         ?? 1);
  _set('tbxCfgPsm',            s.convPsm         ?? 3);
  _set('tbxCfgConfidence',     s.convConfidence  ?? 60);
  _set('tbxCfgDeskew',         s.convDeskew      !== false);
  _set('tbxCfgDenoise',        s.convDenoise     ?? 1);
  _set('tbxCfgSharpen',        !!s.convSharpen);
  _set('tbxCfgDocxMode',       s.convDocxMode    || 'editable');
  _set('tbxCfgDocxImages',     s.convDocxImages  !== false);
  _set('tbxCfgDocxColors',     s.convDocxColors  !== false);
  _set('tbxCfgDocxHighlight',  !!s.convDocxHighlight);
  _set('tbxCfgXlsxProfile',    s.convXlsxProfile || 'auto');
  _set('tbxCfgXlsxFormulas',   s.convXlsxFormulas !== false);
  _set('tbxCfgXlsxAutoFilter', s.convXlsxAutoFilter !== false);
  _set('tbxCfgXlsxFreeze',     s.convXlsxFreeze !== false);
  _set('tbxCfgDjvuQuality',    s.convDjvuQuality || 'balanced');
  _set('tbxCfgDjvuTextLayer',  s.convDjvuTextLayer !== false);
  _set('tbxCfgFileExists',     s.convFileExists  || 'ask');
  _set('tbxCfgOpenFolder',     s.convOpenFolder  !== false);

  // Update range display value
  const confEl = /** @type {HTMLInputElement|null} */ (panel.querySelector('#tbxCfgConfidence'));
  const confVal = panel.querySelector('#tbxCfgConfidenceVal');
  if (confEl && confVal) confVal.textContent = `${confEl.value}%`;
}

/** Write a changed setting from the panel into state.settings. */
function _onSettingChange(e) {
  const el = /** @type {any} */ (e.target);
  const key = el?.dataset?.setting;
  if (!key) return;
  if (!state.settings) state.settings = {};
  const val = el.type === 'checkbox' ? el.checked
    : (el.type === 'range' || el.tagName === 'SELECT' && /^\d+$/.test(el.value))
      ? Number(el.value)
      : el.value;
  state.settings[key] = val;

  // Update range label
  if (el.id === 'tbxCfgConfidence') {
    const label = _els.settingsPanel?.querySelector('#tbxCfgConfidenceVal');
    if (label) label.textContent = `${el.value}%`;
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────

export function initToolboxOverlay() {
  if (!_els.overlay) return;

  // Close button
  _els.closeBtn?.addEventListener('click', closeToolboxOverlay);

  // Keyboard: Escape to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && _els.overlay?.classList.contains('open')) closeToolboxOverlay();
  });

  // Sidebar "Полный" button
  _els.sidebarOpenBtn?.addEventListener('click', openToolboxOverlay);

  // Settings button — toggle inline settings panel
  _els.settingsBtn?.addEventListener('click', () => {
    if (!_els.settingsPanel) return;
    _loadSettingsPanel();
    _els.settingsPanel.hidden = false;
  });
  _els.settingsPanelClose?.addEventListener('click', () => {
    if (_els.settingsPanel) _els.settingsPanel.hidden = true;
  });
  // Live-sync all settings panel inputs to state.settings
  _els.settingsPanel?.addEventListener('change', _onSettingChange);
  _els.settingsPanel?.addEventListener('input', _onSettingChange);

  // File add/remove buttons
  _els.btnAdd?.addEventListener('click', () => _els.fileInput?.click());
  _els.btnRemove?.addEventListener('click', _removeSelected);
  _els.fileInput?.addEventListener('change', () => {
    if (_els.fileInput?.files?.length) _addFiles(_els.fileInput.files);
    if (_els.fileInput) _els.fileInput.value = '';
  });

  // Drop zone click
  _els.dropZone?.addEventListener('click', () => _els.fileInput?.click());
  _els.dropZone?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') _els.fileInput?.click();
  });

  // Drag & drop on overlay
  _els.overlay.addEventListener('dragover', (e) => {
    e.preventDefault();
    _els.dropZone?.classList.add('dragover');
  });
  _els.overlay.addEventListener('dragleave', (e) => {
    if (e.relatedTarget && /** @type {any} */ (_els.overlay)?.contains(e.relatedTarget)) return;
    _els.dropZone?.classList.remove('dragover');
  });
  _els.overlay.addEventListener('drop', (e) => {
    e.preventDefault();
    _els.dropZone?.classList.remove('dragover');
    if (e.dataTransfer?.files?.length) _addFiles(e.dataTransfer.files);
  });

  // Output location selector
  _els.outputLocation?.addEventListener('change', () => {
    if (_els.customFolder) _els.customFolder.hidden = _els.outputLocation?.value !== 'custom';
  });

  // Tile clicks
  _els.toolGrid?.querySelectorAll('.tbx-tile').forEach((tile) => {
    const toolId = /** @type {HTMLElement} */ (tile).dataset.tool;
    if (!toolId) return;
    tile.addEventListener('click', () => _onTileClick(toolId));
    tile.addEventListener('keydown', (e) => {
      if (/** @type {KeyboardEvent} */ (e).key === 'Enter') _onTileClick(toolId);
    });
  });

  // Sync output location from settings
  _syncOutputBar();
}
