// @ts-check
// ─── OCR & Text Processing Wiring ───────────────────────────────────────────
// Extracted from app.js — pure refactor, no behavior changes.

/**
 * Wire up OCR storage management, confidence overlays, text editing
 * undo/redo and related OCR UI controls.
 *
 * @param {object} deps  External references.
 */
export function initOcr(deps) {
  const {
    state,
    els,
    safeOn,
    setOcrStatus,
    getOcrLang,
    runOcrForCurrentPage,
    setOcrRegionMode,
    cancelAllOcrWork,
    resetTesseractAvailability,
    markLowConfidenceWords,
    getPageQualitySummary,
    listOcrDocuments,
    getOcrStorageSize,
    deleteOcrData,
    undoPageEdit,
    redoPageEdit,
    setTextEditMode,
    saveCurrentPageTextEdits,
    exportSessionHealthReport,
  } = deps;

  // ── OCR Confidence Overlay Toggle ──────────────────────────────────────
  safeOn(els.toggleOcrConfidence, 'click', () => {
    state.ocrConfidenceMode = !state.ocrConfidenceMode;
    if (els.toggleOcrConfidence) {
      els.toggleOcrConfidence.classList.toggle('active', state.ocrConfidenceMode);
      els.toggleOcrConfidence.textContent = state.ocrConfidenceMode ? 'Качество: on' : 'Качество';
    }
    const currentText = els.pageText?.value || '';
    if (state.ocrConfidenceMode && currentText) {
      const lang = getOcrLang();
      const marked = markLowConfidenceWords(currentText, lang);
      els.pageText.value = marked;
      const summary = getPageQualitySummary(currentText, lang);
      setOcrStatus(`Качество: ${summary.quality} | avg ${summary.avgScore}% | low: ${summary.lowCount} | medium: ${summary.mediumCount}`);
    } else if (!state.ocrConfidenceMode && currentText) {
      els.pageText.value = currentText.replace(/\[\?/g, '').replace(/\?\]/g, '');
      setOcrStatus('OCR: idle');
    }
  });

  // ── OCR Storage Management ─────────────────────────────────────────────
  async function refreshOcrStorageInfo() {
    try {
      const docs = await listOcrDocuments();
      const sizeBytes = await getOcrStorageSize();
      const sizeMb = (sizeBytes / (1024 * 1024)).toFixed(2);
      if (els.ocrStorageInfo) {
        els.ocrStorageInfo.textContent = `${docs.length} документ(ов) | ~${sizeMb} MB`;
      }
      if (els.ocrDocumentsList) {
        els.ocrDocumentsList.innerHTML = '';
        for (const docName of docs) {
          const li = document.createElement('li');
          li.textContent = docName;
          const delBtn = document.createElement('button');
          delBtn.className = 'btn-ghost btn-xs';
          delBtn.textContent = '✕';
          delBtn.addEventListener('click', async () => {
            await deleteOcrData(docName);
            await refreshOcrStorageInfo();
          });
          li.appendChild(delBtn);
          els.ocrDocumentsList.appendChild(li);
        }
      }
    } catch (err) {
      console.warn('[ocr] error:', err?.message);
      if (els.ocrStorageInfo) els.ocrStorageInfo.textContent = 'Ошибка чтения хранилища';
    }
  }

  safeOn(els.refreshOcrStorage, 'click', refreshOcrStorageInfo);

  safeOn(els.clearCurrentOcrData, 'click', async () => {
    if (!state.docName) return;
    await deleteOcrData(state.docName);
    await refreshOcrStorageInfo();
    setOcrStatus('OCR: данные текущего документа очищены');
  });

  safeOn(els.clearAllOcrData, 'click', async () => {
    const docs = await listOcrDocuments();
    for (const doc of docs) {
      await deleteOcrData(doc);
    }
    await refreshOcrStorageInfo();
    setOcrStatus('OCR: все данные OCR очищены');
  });

  // ── OCR Controls ───────────────────────────────────────────────────────
  safeOn(els.ocrCurrentPage, 'click', async () => {
    await runOcrForCurrentPage();
  });

  // "Continue / retry OCR of current page" — resets Tesseract failure state
  // before starting so a previous init error doesn't permanently block OCR.
  safeOn(els.continueOcrPage, 'click', async () => {
    resetTesseractAvailability();
    setOcrStatus('OCR: повтор...');
    await runOcrForCurrentPage();
  });

  safeOn(els.ocrRegionMode, 'click', () => {
    setOcrRegionMode(!state.ocrRegionMode);
  });

  safeOn(els.copyOcrText, 'click', async () => {
    if (!els.pageText?.value) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(els.pageText.value);
        setOcrStatus('OCR: текст скопирован');
      }
    } catch (err) {
      console.warn('[ocr] error:', err?.message);
      setOcrStatus('OCR: не удалось скопировать текст');
    }
  });

  safeOn(els.cancelBackgroundOcr, 'click', () => {
    cancelAllOcrWork('manual-button');
  });

  // ── Text Edit Undo/Redo ────────────────────────────────────────────────
  safeOn(els.undoTextEdit, 'click', () => {
    const action = undoPageEdit();
    if (action && els.pageText) {
      els.pageText.value = action.text;
      setOcrStatus(`Отмена: страница ${action.page}`);
    }
  });

  safeOn(els.redoTextEdit, 'click', () => {
    const action = redoPageEdit();
    if (action && els.pageText) {
      els.pageText.value = action.text;
      setOcrStatus(`Повтор: страница ${action.page}`);
    }
  });

  safeOn(els.exportHealthReport, 'click', exportSessionHealthReport);
  safeOn(els.toggleTextEdit, 'click', () => setTextEditMode(!state.textEditMode));

  // Text layer erase mode: click to delete spans
  safeOn(els.eraseTextLayer, 'click', async () => {
    const { enableTextEraseMode, disableTextEraseMode, isTextEraseMode } = await import('./render-text-layer.js');
    if (isTextEraseMode()) {
      disableTextEraseMode();
      if (els.eraseTextLayer) els.eraseTextLayer.classList.remove('active');
      setOcrStatus('Режим стирания: ВЫКЛ');
    } else {
      enableTextEraseMode();
      if (els.eraseTextLayer) els.eraseTextLayer.classList.add('active');
      setOcrStatus('Режим стирания: кликните по словам для удаления');
    }
  });
  safeOn(els.saveTextEdits, 'click', saveCurrentPageTextEdits);

  return { refreshOcrStorageInfo };
}
