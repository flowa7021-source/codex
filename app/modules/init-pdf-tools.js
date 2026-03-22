// ─── PDF Operations (Forms, Stamps, Watermark, Block Editor) ────────────────
// Extracted from app.js — pure refactor, no behavior changes.

/**
 * Wire up form filling, block editor, image insertion, watermark, stamps,
 * signature and related PDF tool UI.
 *
 * @param {object} deps  External references.
 */
export function initPdfTools(deps) {
  const {
    state,
    els,
    safeOn,
    setOcrStatus,
    formManager,
    blockEditor,
    fillPdfForm,
    addWatermarkToPdf,
    addStampToPdf,
    safeCreateObjectURL,
    handleImageInsertion,
    addWatermarkToPage,
    addStampToPage,
    openSignaturePad,
    nrPrompt,
  } = deps;

  // ── PDF Forms ──────────────────────────────────────────────────────────
  safeOn(els.pdfFormFill, 'click', async () => {
    if (!state.adapter || state.adapter.type !== 'pdf') {
      setOcrStatus('Формы доступны только для PDF');
      return;
    }
    await formManager.loadFromAdapter(state.adapter);
    const fctx = els.annotationCanvas.getContext('2d');
    formManager.renderFormOverlay(fctx, state.currentPage, state.zoom);
    const totalFields = formManager.getAllFields().length;
    setOcrStatus(`Формы: ${totalFields} полей найдено`);
  });

  safeOn(els.pdfFormExport, 'click', async () => {
    const data = formManager.exportFormData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.docName || 'document'}-form-data.json`;
    a.click();
    URL.revokeObjectURL(url);

    if (state.adapter?.type === 'pdf' && state.file) {
      try {
        const formData = {};
        for (const field of formManager.getAllFields()) {
          if (field.value !== '' && field.value !== field.defaultValue) {
            formData[field.name] = field.value;
          }
        }
        if (Object.keys(formData).length === 0) {
          setOcrStatus('Форма экспортирована (JSON). Нет заполненных полей для PDF.');
          return;
        }
        setOcrStatus('Сохранение заполненной формы в PDF...');
        const arrayBuffer = await state.file.arrayBuffer();
        const pdfBlob = await fillPdfForm(arrayBuffer, formData, false);
        const pdfUrl = safeCreateObjectURL(pdfBlob);
        const a2 = document.createElement('a');
        a2.href = pdfUrl;
        a2.download = `${state.docName || 'document'}-filled.pdf`;
        a2.click();
        URL.revokeObjectURL(pdfUrl);
        setOcrStatus('Форма сохранена: JSON + заполненный PDF');
      } catch (err) {
        setOcrStatus(`JSON экспортирован (PDF ошибка: ${err?.message || 'неизвестная'})`);
      }
    }
  });

  safeOn(els.pdfFormImport, 'change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      formManager.importFormData(data);
      const fctx = els.annotationCanvas.getContext('2d');
      formManager.renderFormOverlay(fctx, state.currentPage, state.zoom);
      setOcrStatus('Данные формы импортированы');
    } catch (err) {
      setOcrStatus(`Ошибка импорта формы: ${err?.message || 'неизвестная'}`);
    }
    e.target.value = '';
  });

  safeOn(els.pdfFormClear, 'click', () => {
    formManager.clearAll();
    setOcrStatus('Формы очищены');
  });

  // ── PDF Block Editor ───────────────────────────────────────────────────
  safeOn(els.pdfBlockEdit, 'click', () => {
    if (!state.adapter || state.adapter.type !== 'pdf') {
      setOcrStatus('Редактор блоков доступен только для PDF');
      return;
    }
    const isActive = els.pdfBlockEdit.classList.toggle('active');
    if (isActive) {
      blockEditor.enable(els.canvasWrap, els.canvas);
      setOcrStatus('Редактор блоков: ВКЛ (привязка к сетке активна)');
    } else {
      blockEditor.clearGuides();
      blockEditor.disable();
      setOcrStatus('Редактор блоков: ВЫКЛ');
    }
  });

  async function exportBlockEditsToPdf() {
    if (!state.adapter || state.adapter.type !== 'pdf' || !state.file) {
      setOcrStatus('Экспорт блоков: нужен открытый PDF');
      return;
    }
    const allBlocks = blockEditor.exportAllBlocks();
    if (!Object.keys(allBlocks).length) {
      setOcrStatus('Нет блоков для экспорта');
      return;
    }
    try {
      setOcrStatus('Экспорт блоков в PDF...');
      const arrayBuffer = await state.file.arrayBuffer();
      const canvasW = parseFloat(els.canvas.style.width) || els.canvas.width;
      const canvasH = parseFloat(els.canvas.style.height) || els.canvas.height;
      const pdfBlob = await blockEditor.exportBlocksToPdf(arrayBuffer, { width: canvasW, height: canvasH });
      const url = safeCreateObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${state.docName || 'document'}-edited.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      setOcrStatus('Блоки экспортированы в PDF');
    } catch (err) {
      setOcrStatus(`Ошибка экспорта блоков: ${err?.message || 'неизвестная'}`);
    }
  }

  safeOn(els.pdfBlockEdit, 'dblclick', exportBlockEditsToPdf);
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'E' && blockEditor.active) {
      e.preventDefault();
      exportBlockEditsToPdf();
    }
  });

  // ── Image Insertion ────────────────────────────────────────────────────
  safeOn(els.insertImageInput, 'change', (e) => {
    const file = e.target.files?.[0];
    if (file) handleImageInsertion(file);
    e.target.value = '';
  });

  // ── Watermark ──────────────────────────────────────────────────────────
  safeOn(els.addWatermark, 'click', async () => {
    if (!state.adapter) return;
    const text = await nrPrompt('Текст водяного знака:', 'КОНФИДЕНЦИАЛЬНО');
    if (!text) return;

    addWatermarkToPage(text);

    if (state.adapter?.type === 'pdf' && state.file) {
      try {
        setOcrStatus('Добавление водяного знака в PDF...');
        const arrayBuffer = await state.file.arrayBuffer();
        const blob = await addWatermarkToPdf(arrayBuffer, text, {
          fontSize: 60,
          opacity: 0.25,
          rotation: -45,
        });
        const url = safeCreateObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${state.docName || 'document'}-watermark.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        setOcrStatus(`Водяной знак "${text}" — PDF сохранён`);
      } catch (err) {
        setOcrStatus(`Водяной знак "${text}" добавлен на canvas (PDF ошибка: ${err.message})`);
      }
    } else {
      setOcrStatus(`Водяной знак "${text}" добавлен`);
    }
  });

  // ── Stamps ─────────────────────────────────────────────────────────────
  safeOn(els.addStamp, 'click', async () => {
    if (!state.adapter) return;
    const types = ['approved', 'rejected', 'draft', 'confidential', 'copy'];
    const labels = ['УТВЕРЖДЕНО', 'ОТКЛОНЕНО', 'ЧЕРНОВИК', 'КОНФИДЕНЦИАЛЬНО', 'КОПИЯ'];
    const choice = await nrPrompt(`Выберите штамп (1-5):\n${labels.map((l, i) => `${i + 1}. ${l}`).join('\n')}`, '1');
    const idx = parseInt(choice, 10) - 1;
    if (idx >= 0 && idx < types.length) {
      addStampToPage(types[idx]);

      if (state.adapter?.type === 'pdf' && state.file) {
        try {
          const arrayBuffer = await state.file.arrayBuffer();
          const blob = await addStampToPdf(arrayBuffer, types[idx], { pageNum: state.currentPage });
          const url = safeCreateObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${state.docName || 'document'}-stamp.pdf`;
          a.click();
          URL.revokeObjectURL(url);
          setOcrStatus(`Штамп "${labels[idx]}" — PDF сохранён`);
        } catch (err) {
          console.warn('[ocr] error:', err?.message);
          setOcrStatus(`Штамп "${labels[idx]}" добавлен на canvas`);
        }
      } else {
        setOcrStatus(`Штамп "${labels[idx]}" добавлен`);
      }
    }
  });

  // ── Signature ──────────────────────────────────────────────────────────
  safeOn(els.addSignature, 'click', () => {
    if (!state.adapter) return;
    openSignaturePad();
  });
}
