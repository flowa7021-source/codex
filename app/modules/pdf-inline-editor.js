// @ts-check
// ═══════════════════════════════════════════════════════════════════════════════
// NovaReader — Inline PDF Text Editor
// Frontend module that coordinates with the Python sidecar engine for
// editing text directly inside both digital and scanned PDFs.
//
// Two modes:
//   A) Digital PDF  — Python (PyMuPDF) redacts old text, inserts new text
//   B) Scanned PDF  — Python OCR-locates text, inpaints, re-renders on image
//
// Communication: JS ↔ Tauri invoke("run_pdf_edit_engine") ↔ Python stdin/stdout
// ═══════════════════════════════════════════════════════════════════════════════

import { state, els } from './state.js';
import { isTauri } from './platform.js';

// ─── Late-bound dependencies ────────────────────────────────────────────────
/** @type {any} */
const _deps = {
  reloadPdfFromBytes: async (_bytes) => {},
  renderCurrentPage: async () => {},
  setOcrStatus: (_msg) => {},
  toastSuccess: (_msg) => {},
  toastError: (_msg) => {},
  pushDiagnosticEvent: () => {},
};

export function initInlineEditorDeps(deps) {
  Object.assign(_deps, deps);
}

// ─── Engine communication ───────────────────────────────────────────────────

/**
 * Send a command to the Python PDF edit engine via Tauri.
 * @param {object} cmd - JSON command object
 * @returns {Promise<any>}
 */
async function callEngine(cmd) {
  if (!isTauri()) {
    throw new Error('Inline PDF editor requires Tauri runtime (Python sidecar)');
  }
  const { invoke } = await import('@tauri-apps/api/core');
  const jsonInput = JSON.stringify(cmd);
  const rawResult = await invoke('run_pdf_edit_engine', { jsonInput });
  const result = JSON.parse(/** @type {string} */ (rawResult));
  if (!result.ok) {
    throw new Error(result.error || 'Engine returned error');
  }
  return result;
}

// ─── Temp file helpers (write state.pdfBytes to temp, read back after edit) ──

async function writeTempPdf(suffix = '') {
  const { invoke } = await import('@tauri-apps/api/core');
  /** @type {string} */
  const dir = await invoke('get_app_data_dir');
  const name = `_nova_edit_${Date.now()}${suffix}.pdf`;
  // Use the same separator as the returned dir to avoid mixed-separator paths on Windows
  const sep = dir.includes('\\') ? '\\' : '/';
  const path = `${dir}${sep}${name}`;
  const bytes = state.pdfBytes;
  if (!bytes) throw new Error('No PDF loaded');
  await invoke('write_file_bytes', { path, data: Array.from(bytes) });
  return path;
}

async function readTempPdf(path) {
  const { invoke } = await import('@tauri-apps/api/core');
  /** @type {number[]} */
  const data = await invoke('read_file_bytes', { path });
  return new Uint8Array(data);
}

async function deleteTempFile(path) {
  try {
    // Use Tauri fs plugin to actually remove the temp file
    const { remove } = await import('@tauri-apps/plugin-fs');
    await remove(path);
  } catch (_e) { /* non-critical — best-effort cleanup */ }
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Classify page types in the current document.
 * @returns {Promise<Array<{page: number, type: string}>>}
 */
export async function classifyPages() {
  const inputPath = await writeTempPdf('_classify');
  try {
    const result = await callEngine({ action: 'classify', input_path: inputPath });
    return result.pages;
  } finally {
    deleteTempFile(inputPath);
  }
}

/**
 * Extract text spans with full style metadata from a page.
 * @param {number} pageNum - 1-based
 * @returns {Promise<{spans: any[], page_type: string}>}
 */
export async function extractSpans(pageNum) {
  const inputPath = await writeTempPdf('_spans');
  try {
    const result = await callEngine({
      action: 'extract_spans',
      input_path: inputPath,
      page: pageNum,
    });
    return { spans: result.spans, page_type: result.page_type };
  } finally {
    deleteTempFile(inputPath);
  }
}

/**
 * Locate text on a scanned page via OCR.
 * @param {number} pageNum - 1-based
 * @param {string} searchText
 * @param {string} [lang]
 * @returns {Promise<any[]>}
 */
export async function ocrLocateText(pageNum, searchText, lang = 'rus+eng') {
  const inputPath = await writeTempPdf('_ocr');
  try {
    const result = await callEngine({
      action: 'ocr_locate',
      input_path: inputPath,
      page: pageNum,
      search_text: searchText,
      lang,
      dpi: 300,
    });
    return result.results;
  } finally {
    deleteTempFile(inputPath);
  }
}

/**
 * Edit text inline in the PDF — works on both digital and scanned pages.
 * The heavy lifting happens in the Python engine.
 *
 * @param {Array<{page: number, old_text: string, new_text: string}>} edits
 * @param {object} [options]
 * @param {string} [options.lang='rus+eng']
 * @param {number} [options.dpi=300]
 * @returns {Promise<{results: any[]}>}
 */
export async function editTextInline(edits, options = {}) {
  if (!state.pdfBytes) throw new Error('No PDF loaded');

  const inputPath = await writeTempPdf('_in');
  const outputPath = inputPath.replace('_in.pdf', '_out.pdf');

  _deps.setOcrStatus('Редактирование текста...');

  try {
    const result = await callEngine({
      action: 'edit',
      input_path: inputPath,
      output_path: outputPath,
      edits,
      lang: options.lang || 'rus+eng',
      dpi: options.dpi || 300,
    });

    // Read modified PDF and reload in-place
    const newBytes = await readTempPdf(outputPath);
    await _deps.reloadPdfFromBytes(newBytes);
    await _deps.renderCurrentPage();

    const succeeded = result.results.filter((/** @type {any} */ r) => r.ok).length;
    const failed = result.results.filter((/** @type {any} */ r) => !r.ok).length;

    if (failed === 0) {
      _deps.setOcrStatus(`Текст изменён: ${succeeded} правк${succeeded === 1 ? 'а' : 'и/ок'}`);
      _deps.toastSuccess(`Текст изменён (${succeeded})`);
    } else {
      _deps.setOcrStatus(`Изменено ${succeeded}, ошибок ${failed}`);
    }

    _deps.pushDiagnosticEvent('inline-edit.done', {
      edits: edits.length, succeeded, failed,
    });

    return { results: result.results };
  } finally {
    deleteTempFile(inputPath);
    deleteTempFile(outputPath);
  }
}

// ─── Interactive Edit UI ────────────────────────────────────────────────────

/** @type {HTMLElement|null} */
let _editPanel = null;

/**
 * Open the inline text editor panel.
 * Allows the user to enter old text → new text and apply edits.
 */
export function openInlineEditPanel() {
  if (_editPanel) {
    _editPanel.remove();
    _editPanel = null;
  }

  const panel = document.createElement('div');
  panel.id = 'inlineEditPanel';
  panel.style.cssText = [
    'position:fixed', 'top:50%', 'left:50%', 'transform:translate(-50%,-50%)',
    'background:#2a2a2a', 'border:1px solid #555', 'border-radius:10px',
    'padding:24px', 'z-index:10000', 'min-width:460px', 'max-width:600px',
    'box-shadow:0 12px 48px rgba(0,0,0,.7)', 'color:#eee', 'font-family:sans-serif',
  ].join(';');

  panel.innerHTML = `
    <h3 style="margin:0 0 16px;font-size:16px;font-weight:600">
      Редактирование текста в PDF
    </h3>
    <div style="margin-bottom:12px">
      <label style="font-size:12px;color:#aaa;display:block;margin-bottom:4px">Страница</label>
      <input id="iePageNum" type="number" min="1" max="${state.pageCount || 1}"
             value="${state.currentPage || 1}"
             style="padding:6px 10px;border:1px solid #555;border-radius:4px;background:#1e1e1e;color:#eee;font-size:13px;width:80px" />
      <span id="iePageType" style="font-size:11px;color:#888;margin-left:8px"></span>
    </div>
    <div style="margin-bottom:12px">
      <label style="font-size:12px;color:#aaa;display:block;margin-bottom:4px">Исходный текст (найти)</label>
      <input id="ieOldText" type="text" placeholder="Текст для замены..."
             style="width:100%;padding:8px 10px;border:1px solid #555;border-radius:4px;background:#1e1e1e;color:#eee;font-size:14px;box-sizing:border-box" />
    </div>
    <div style="margin-bottom:16px">
      <label style="font-size:12px;color:#aaa;display:block;margin-bottom:4px">Новый текст (заменить на)</label>
      <input id="ieNewText" type="text" placeholder="Новый текст..."
             style="width:100%;padding:8px 10px;border:1px solid #555;border-radius:4px;background:#1e1e1e;color:#eee;font-size:14px;box-sizing:border-box" />
    </div>
    <div style="margin-bottom:12px">
      <details style="font-size:12px;color:#888">
        <summary style="cursor:pointer;user-select:none">Дополнительно</summary>
        <div style="margin-top:8px;display:grid;grid-template-columns:100px 1fr;gap:6px 10px;align-items:center">
          <label>OCR язык</label>
          <input id="ieLang" value="rus+eng" style="padding:3px 6px;border:1px solid #444;border-radius:3px;background:#1e1e1e;color:#ccc;font-size:12px;width:120px" />
          <label>DPI (скан)</label>
          <input id="ieDpi" type="number" value="300" min="150" max="600" step="50"
                 style="padding:3px 6px;border:1px solid #444;border-radius:3px;background:#1e1e1e;color:#ccc;font-size:12px;width:80px" />
        </div>
      </details>
    </div>
    <div id="ieStatus" style="font-size:12px;color:#888;min-height:18px;margin-bottom:12px"></div>
    <div style="display:flex;gap:10px;justify-content:flex-end">
      <button id="ieLocate" style="padding:6px 14px;border:1px solid #666;border-radius:4px;background:transparent;color:#ccc;cursor:pointer;font-size:13px">
        Найти
      </button>
      <button id="ieCancel" style="padding:6px 14px;border:1px solid #666;border-radius:4px;background:transparent;color:#ccc;cursor:pointer;font-size:13px">
        Отмена
      </button>
      <button id="ieApply" style="padding:6px 14px;border:none;border-radius:4px;background:#0078d4;color:#fff;cursor:pointer;font-weight:600;font-size:13px">
        Применить
      </button>
    </div>
  `;

  document.body.appendChild(panel);
  _editPanel = panel;

  // Focus old text input
  /** @type {HTMLInputElement} */ (panel.querySelector('#ieOldText')).focus();

  // Wire buttons
  panel.querySelector('#ieCancel')?.addEventListener('click', closeInlineEditPanel);

  panel.querySelector('#ieLocate')?.addEventListener('click', async () => {
    const pageNum = Number(/** @type {HTMLInputElement} */ (panel.querySelector('#iePageNum')).value);
    const oldText = /** @type {HTMLInputElement} */ (panel.querySelector('#ieOldText')).value.trim();
    const lang = /** @type {HTMLInputElement} */ (panel.querySelector('#ieLang')).value;
    const statusEl = panel.querySelector('#ieStatus');
    if (!oldText) { if (statusEl) statusEl.textContent = 'Введите текст для поиска'; return; }
    if (statusEl) statusEl.textContent = 'Поиск...';
    try {
      const results = await ocrLocateText(pageNum, oldText, lang);
      if (results.length === 0) {
        if (statusEl) statusEl.textContent = 'Текст не найден (OCR)';
      } else {
        const r = results[0];
        if (statusEl) statusEl.textContent = `Найдено: "${r.text}" (${r.conf}%) bbox=[${r.bbox.join(',')}]`;
      }
    } catch (err) {
      if (statusEl) statusEl.textContent = `Ошибка: ${err?.message}`;
    }
  });

  panel.querySelector('#ieApply')?.addEventListener('click', async () => {
    const pageNum = Number(/** @type {HTMLInputElement} */ (panel.querySelector('#iePageNum')).value);
    const oldText = /** @type {HTMLInputElement} */ (panel.querySelector('#ieOldText')).value.trim();
    const newText = /** @type {HTMLInputElement} */ (panel.querySelector('#ieNewText')).value;
    const lang = /** @type {HTMLInputElement} */ (panel.querySelector('#ieLang')).value;
    const dpi = Number(/** @type {HTMLInputElement} */ (panel.querySelector('#ieDpi')).value) || 300;
    const statusEl = panel.querySelector('#ieStatus');

    if (!oldText) { if (statusEl) statusEl.textContent = 'Введите исходный текст'; return; }
    if (statusEl) statusEl.textContent = 'Применение правки...';

    try {
      const { results } = await editTextInline(
        [{ page: pageNum, old_text: oldText, new_text: newText }],
        { lang, dpi },
      );
      const r = results[0];
      if (r.ok) {
        if (statusEl) statusEl.textContent = `Готово (${r.mode}): bbox=[${(r.bbox || []).join(',')}]`;
        // Auto-close after 1.5s on success
        setTimeout(closeInlineEditPanel, 1500);
      } else {
        if (statusEl) statusEl.textContent = `Ошибка: ${r.error}`;
      }
    } catch (err) {
      if (statusEl) statusEl.textContent = `Ошибка: ${err?.message}`;
    }
  });

  // Escape to close
  const onKey = (/** @type {KeyboardEvent} */ e) => {
    if (e.key === 'Escape') { closeInlineEditPanel(); document.removeEventListener('keydown', onKey); }
  };
  document.addEventListener('keydown', onKey);
}

export function closeInlineEditPanel() {
  if (_editPanel) {
    _editPanel.remove();
    _editPanel = null;
  }
}

/**
 * Quick edit: replace text on the current page.
 * @param {string} oldText
 * @param {string} newText
 */
export async function quickEditText(oldText, newText) {
  return editTextInline([{
    page: state.currentPage,
    old_text: oldText,
    new_text: newText,
  }]);
}
