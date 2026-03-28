// @ts-check
// ─── Toolbox Controller (PDF24-style batch processing) ──────────────────────
// Allows processing files without opening them in the viewer:
// OCR + text layer, deskew, conversion, merge, protect, optimize.

import { pushDiagnosticEvent } from './diagnostics.js';
import { toastSuccess, toastError, toastWarning } from './toast.js';

/** @type {File[]} */
const _files = [];
let _cancelled = false;

// ─── DOM refs ───────────────────────────────────────────────────────────────
const _els = {
  dropZone: /** @type {HTMLElement|null} */ (document.getElementById('toolboxDropZone')),
  fileInput: /** @type {HTMLInputElement|null} */ (document.getElementById('toolboxFileInput')),
  fileList: /** @type {HTMLElement|null} */ (document.getElementById('toolboxFileList')),
  action: /** @type {HTMLSelectElement|null} */ (document.getElementById('toolboxAction')),
  runBtn: /** @type {HTMLButtonElement|null} */ (document.getElementById('toolboxRun')),
  cancelBtn: /** @type {HTMLButtonElement|null} */ (document.getElementById('toolboxCancel')),
  progress: /** @type {HTMLElement|null} */ (document.getElementById('toolboxProgress')),
  progressBar: /** @type {HTMLElement|null} */ (document.getElementById('toolboxProgressBar')),
  status: /** @type {HTMLElement|null} */ (document.getElementById('toolboxStatus')),
};

// ─── File management ────────────────────────────────────────────────────────

function renderFileList() {
  const list = _els.fileList;
  if (!list) return;
  list.innerHTML = '';
  for (let i = 0; i < _files.length; i++) {
    const li = document.createElement('li');
    li.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:3px 0;border-bottom:1px solid var(--border)';
    const name = document.createElement('span');
    name.textContent = `📄 ${_files[i].name}`;
    name.style.cssText = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1';
    const del = document.createElement('button');
    del.textContent = '✕';
    del.className = 'btn-ghost btn-xs';
    del.style.cssText = 'flex:0;padding:2px 6px;font-size:11px';
    del.addEventListener('click', () => { _files.splice(i, 1); renderFileList(); });
    li.appendChild(name);
    li.appendChild(del);
    list.appendChild(li);
  }
}

function addFiles(fileListInput) {
  const newFiles = Array.from(fileListInput);
  _files.push(...newFiles);
  renderFileList();
}

// ─── Progress UI ────────────────────────────────────────────────────────────

function showProgress(text, pct) {
  if (_els.progress) _els.progress.style.display = '';
  if (_els.progressBar) _els.progressBar.style.width = `${Math.max(0, Math.min(100, pct))}%`;
  if (_els.status) _els.status.textContent = text;
}

function hideProgress() {
  if (_els.progress) _els.progress.style.display = 'none';
}

// ─── Pipeline runners ───────────────────────────────────────────────────────

async function runOcrPipeline(file, idx, total) {
  showProgress(`OCR: ${file.name} (${idx + 1}/${total})`, (idx / total) * 100);
  const bytes = new Uint8Array(await file.arrayBuffer());

  // Lazy imports to keep initial bundle small
  const pdfjsMod = await import('pdfjs-dist');
  const getDocument = pdfjsMod.getDocument || pdfjsMod.default?.getDocument;
  const pdfDoc = await getDocument({ data: bytes }).promise;
  const { createSearchablePdf } = await import('./ocr-batch.js');
  // Run OCR on each page and build searchable PDF
  const { initTesseract, recognizeTesseract } = await import('./tesseract-adapter.js');
  await initTesseract('auto');
  /** @type {Map<number, any>} */
  const ocrResults = new Map();
  for (let p = 1; p <= pdfDoc.numPages; p++) {
    if (_cancelled) break;
    const pct = (idx / total) * 100 + (p / pdfDoc.numPages) * (100 / total);
    showProgress(`OCR: ${file.name} — стр. ${p}/${pdfDoc.numPages}`, pct);
    try {
      const canvas = document.createElement('canvas');
      // @ts-ignore — adapter-like render for standalone use
      const page = await pdfDoc.getPage(p);
      const vp = page.getViewport({ scale: 2 });
      canvas.width = vp.width;
      canvas.height = vp.height;
      const ctx = canvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
      const result = await recognizeTesseract(canvas);
      ocrResults.set(p, { text: result.text, words: result.words, imageWidth: vp.width, imageHeight: vp.height });
      canvas.width = 0; canvas.height = 0;
    } catch (_e) {
      ocrResults.set(p, { text: '', words: [], imageWidth: 0, imageHeight: 0 });
    }
  }
  const searchable = await createSearchablePdf(bytes, ocrResults);
  return new Blob([/** @type {any} */ (searchable).blob ?? searchable], { type: 'application/pdf' });
}

async function runConversion(file, format) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  switch (format) {
    case 'docx': {
      const pdfjsMod = await import('pdfjs-dist');
      const getDoc = pdfjsMod.getDocument || pdfjsMod.default?.getDocument;
      const pdfDoc = await getDoc({ data: bytes }).promise;
      const { convertPdfToDocx } = await import('./docx-converter.js');
      return convertPdfToDocx(pdfDoc, file.name, pdfDoc.numPages, { mode: 'text' });
    }
    case 'xlsx': {
      const { convertPdfToXlsx } = await import('./pdf-to-xlsx.js');
      const result = await convertPdfToXlsx(bytes);
      return result.blob;
    }
    case 'pptx': {
      const { convertPdfToPptx } = await import('./pdf-to-pptx.js');
      const result = await convertPdfToPptx(bytes);
      return result.blob;
    }
    case 'pdfa': {
      const { convertToPdfA } = await import('./pdf-a-converter.js');
      const result = await convertToPdfA(bytes, { title: file.name });
      return result.blob;
    }
    default:
      throw new Error(`Unknown format: ${format}`);
  }
}

async function runMerge(files) {
  const { mergePdfDocuments } = await import('./pdf-operations.js');
  return mergePdfDocuments(files);
}

async function runProtect(file) {
  const { setPassword, LOCKED_PERMISSIONS } = await import('./pdf-security.js');
  const { nrPrompt } = await import('./modal-prompt.js');
  const pwd = await nrPrompt('Введите пароль для защиты:');
  if (!pwd) throw new Error('Пароль не указан');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const result = await setPassword(bytes, pwd, '', LOCKED_PERMISSIONS);
  return result.blob;
}

async function runOptimize(file) {
  // pdf-lib re-save strips unused objects, compresses streams
  const { PDFDocument } = await import('pdf-lib');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const saved = await doc.save();
  return new Blob([/** @type {any} */ (saved)], { type: 'application/pdf' });
}

// ─── Main run handler ───────────────────────────────────────────────────────

async function run() {
  if (!_files.length) { toastWarning('Добавьте файлы для обработки'); return; }
  const action = _els.action?.value || 'ocr';
  _cancelled = false;

  if (_els.runBtn) _els.runBtn.disabled = true;
  pushDiagnosticEvent('toolbox.start', { action, files: _files.length });

  try {
    const { saveOrDownload } = await import('./platform.js');
    const extMap = { docx: 'docx', xlsx: 'xlsx', pptx: 'pptx', pdfa: 'pdf' };

    if (action === 'merge') {
      showProgress('Объединение...', 50);
      const blob = await runMerge(_files);
      await saveOrDownload(blob, 'merged.pdf', [{ name: 'PDF', extensions: ['pdf'] }]);
      showProgress('Готово!', 100);
      toastSuccess(`Объединено ${_files.length} файлов`);
    } else {
      let done = 0;
      for (const file of _files) {
        if (_cancelled) break;
        const baseName = file.name.replace(/\.[^.]+$/, '');
        let blob;

        if (action === 'ocr' || action === 'deskew') {
          blob = await runOcrPipeline(file, done, _files.length);
          await saveOrDownload(blob, `${baseName}-ocr.pdf`, [{ name: 'PDF', extensions: ['pdf'] }]);
        } else if (action === 'protect') {
          blob = await runProtect(file);
          await saveOrDownload(blob, `${baseName}-protected.pdf`, [{ name: 'PDF', extensions: ['pdf'] }]);
        } else if (action === 'optimize') {
          blob = await runOptimize(file);
          await saveOrDownload(blob, `${baseName}-optimized.pdf`, [{ name: 'PDF', extensions: ['pdf'] }]);
        } else {
          const ext = extMap[action] || action;
          blob = await runConversion(file, action);
          await saveOrDownload(blob, `${baseName}.${ext}`, [{ name: ext.toUpperCase(), extensions: [ext] }]);
        }

        done++;
        showProgress(`${done}/${_files.length} готово`, (done / _files.length) * 100);
      }
      toastSuccess(`Обработано: ${done} файлов`);
    }

    pushDiagnosticEvent('toolbox.finish', { action, files: _files.length });
  } catch (err) {
    toastError(`Ошибка: ${err?.message || 'неизвестная'}`);
    pushDiagnosticEvent('toolbox.error', { action, message: err?.message }, 'error');
  } finally {
    if (_els.runBtn) _els.runBtn.disabled = false;
    setTimeout(hideProgress, 2000);
  }
}

// ─── Init event listeners ───────────────────────────────────────────────────

export function initToolbox() {
  const dz = _els.dropZone;
  const fi = _els.fileInput;

  if (dz && fi) {
    dz.addEventListener('click', () => fi.click());
    dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.style.borderColor = 'var(--accent)'; });
    dz.addEventListener('dragleave', () => { dz.style.borderColor = ''; });
    dz.addEventListener('drop', (e) => {
      e.preventDefault();
      dz.style.borderColor = '';
      if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files);
    });
    fi.addEventListener('change', () => {
      if (fi.files?.length) addFiles(fi.files);
      fi.value = '';
    });
  }

  _els.runBtn?.addEventListener('click', run);
  _els.cancelBtn?.addEventListener('click', () => { _cancelled = true; showProgress('Отменено', 0); });
}
