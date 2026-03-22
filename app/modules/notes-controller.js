// @ts-check
// notes-controller.js - Notes management for NovaReader
import { state, els } from './state.js';
import { safeTimeout, clearSafeTimeout } from './safe-timers.js';

function storageKey() {
  return `novareader-notes:${state.docName || 'global'}`;
}

function loadNotes() {
  try {
    const raw = localStorage.getItem(storageKey());
    return raw ? JSON.parse(raw) : { title: '', tags: '', text: '' };
  } catch (err) { console.warn('[notes-controller storage] error:', err?.message); return { title: '', tags: '', text: '' }; }
}

function saveNotesData(data) {
  localStorage.setItem(storageKey(), JSON.stringify(data));
}

export function loadNotesIntoUI() {
  const data = loadNotes();
  if (els.notesTitle) /** @type {any} */ (els.notesTitle).value = data.title || '';
  if (els.notesTags) /** @type {any} */ (els.notesTags).value = data.tags || '';
  if (els.notes) /** @type {any} */ (els.notes).value = data.text || '';
  updateNotesStatus('Заметки загружены');
}

export function saveNotesFromUI() {
  const data = {
    title: /** @type {any} */ (els.notesTitle)?.value || '',
    tags: /** @type {any} */ (els.notesTags)?.value || '',
    text: /** @type {any} */ (els.notes)?.value || '',
    updatedAt: Date.now(),
  };
  saveNotesData(data);
  updateNotesStatus('Сохранено');
}

function updateNotesStatus(msg) {
  if (els.notesStatus) {
    els.notesStatus.textContent = msg;
    safeTimeout(() => { if (els.notesStatus) els.notesStatus.textContent = ''; }, 2000);
  }
}

export function exportNotesText() {
  const data = loadNotes();
  let content = '';
  if (data.title) content += `# ${data.title}\n\n`;
  if (data.tags) content += `Теги: ${data.tags}\n\n`;
  content += data.text || '';

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.docName || 'notes'}-notes.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportNotesMd() {
  const data = loadNotes();
  let content = '';
  if (data.title) content += `# ${data.title}\n\n`;
  if (data.tags) content += `> Теги: ${data.tags}\n\n`;
  content += data.text || '';

  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.docName || 'notes'}-notes.md`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportNotesJson() {
  const data = loadNotes();
  data.docName = state.docName;
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.docName || 'notes'}-notes.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importNotesJson(file, mode) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(/** @type {string} */ (reader.result));
      if (mode === 'replace') {
        saveNotesData({ title: imported.title || '', tags: imported.tags || '', text: imported.text || '' });
      } else {
        // merge/append
        const current = loadNotes();
        saveNotesData({
          title: current.title || imported.title || '',
          tags: [current.tags, imported.tags].filter(Boolean).join(', '),
          text: [current.text, imported.text].filter(Boolean).join('\n\n---\n\n'),
        });
      }
      loadNotesIntoUI();
      updateNotesStatus('Заметки импортированы');
    } catch (err) { console.warn('[notes-controller] error:', err?.message); updateNotesStatus('Ошибка импорта'); }
  };
  reader.readAsText(file);
}

export function insertTimestamp() {
  if (!els.notes) return;
  const now = new Date();
  const ts = `[${now.toLocaleDateString('ru-RU')} ${now.toLocaleTimeString('ru-RU')}]`;
  const notesEl = /** @type {any} */ (els.notes);
  const pos = notesEl.selectionStart || notesEl.value.length;
  notesEl.value = notesEl.value.slice(0, pos) + ts + ' ' + notesEl.value.slice(pos);
  notesEl.focus();
  notesEl.selectionStart = notesEl.selectionEnd = pos + ts.length + 1;
}

export function initNotesController() {
  if (els.saveNotes) {
    els.saveNotes.addEventListener('click', saveNotesFromUI);
  }

  if (els.exportNotes) {
    els.exportNotes.addEventListener('click', exportNotesText);
  }

  if (els.exportNotesMd) {
    els.exportNotesMd.addEventListener('click', exportNotesMd);
  }

  if (els.exportNotesJson) {
    els.exportNotesJson.addEventListener('click', exportNotesJson);
  }

  if (els.importNotesJson) {
    els.importNotesJson.addEventListener('change', (e) => {
      const mode = /** @type {any} */ (els.notesImportMode)?.value || 'append';
      importNotesJson(/** @type {any} */ (e.target).files?.[0], mode);
      /** @type {any} */ (e.target).value = '';
    });
  }

  if (els.insertTimestamp) {
    els.insertTimestamp.addEventListener('click', insertTimestamp);
  }

  // Auto-save on textarea changes (debounced)
  if (els.notes) {
    let saveTimer = null;
    els.notes.addEventListener('input', () => {
      clearSafeTimeout(saveTimer);
      saveTimer = safeTimeout(saveNotesFromUI, 2000);
    });
  }

  loadNotesIntoUI();
}
