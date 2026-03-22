// ─── Annotations & Drawing Tool Wiring ──────────────────────────────────────
// Extracted from app.js — pure refactor, no behavior changes.

/**
 * Wire up annotation toggle, tool selection, undo/clear, SVG/PDF export,
 * import/export JSON bundles.
 *
 * @param {object} deps  External references.
 */
export function initAnnotations(deps) {
  const {
    state,
    els,
    safeOn,
    setDrawMode,
    undoStroke,
    clearStrokes,
    clearComments,
    exportAnnotatedPng,
    exportAnnotationsJson,
    importAnnotationsJson,
    exportAnnotationBundleJson,
    importAnnotationBundleJson,
    exportAnnotationsAsSvg,
    exportAnnotationsAsPdf,
    exportAnnotationsIntoPdf,
    loadStrokes,
    safeCreateObjectURL,
    setOcrStatus,
  } = deps;

  safeOn(els.annotateToggle, 'click', () => setDrawMode(!state.drawEnabled));
  safeOn(els.drawTool, 'change', () => { if (!state.drawEnabled) setDrawMode(true); });
  safeOn(els.undoStroke, 'click', undoStroke);
  safeOn(els.clearStrokes, 'click', clearStrokes);
  safeOn(els.clearComments, 'click', clearComments);
  safeOn(els.exportAnnotated, 'click', exportAnnotatedPng);
  safeOn(els.exportAnnJson, 'click', exportAnnotationsJson);

  safeOn(els.importAnnJson, 'change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await importAnnotationsJson(file);
    e.target.value = '';
  });

  safeOn(els.exportAnnBundle, 'click', exportAnnotationBundleJson);
  safeOn(els.importAnnBundle, 'change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await importAnnotationBundleJson(file);
    e.target.value = '';
  });

  // ── Annotation SVG export ──────────────────────────────────────────────
  safeOn(els.exportAnnSvg, 'click', () => {
    if (!state.adapter) return;
    const strokes = loadStrokes();
    const blob = exportAnnotationsAsSvg(strokes, els.annotationCanvas.width, els.annotationCanvas.height);
    if (!blob) { setOcrStatus('Ошибка экспорта SVG'); return; }
    const url = safeCreateObjectURL(blob);
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.docName || 'document'}-page-${state.currentPage}-annotations.svg`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // ── Annotation PDF export ──────────────────────────────────────────────
  safeOn(els.exportAnnPdf, 'click', async () => {
    if (!state.adapter) return;

    // If we have the original PDF file, use pdf-lib to embed annotations directly
    if (state.adapter?.type === 'pdf' && state.file) {
      try {
        setOcrStatus('Экспорт PDF с аннотациями (pdf-lib)...');
        const arrayBuffer = await state.file.arrayBuffer();
        const annotStore = new Map();
        for (let p = 1; p <= state.pageCount; p++) {
          const key = `annotations_${state.docName}_page_${p}`;
          try {
            const stored = localStorage.getItem(key);
            if (stored) {
              const data = JSON.parse(stored);
              if (data?.strokes?.length) annotStore.set(p, data.strokes);
            }
          } catch (err) { console.warn('[app] skipped:', err?.message); }
        }
        if (annotStore.size === 0) {
          setOcrStatus('Нет аннотаций для экспорта');
          return;
        }
        const canvasSize = { width: els.canvas.width, height: els.canvas.height };
        const blob = await exportAnnotationsIntoPdf(arrayBuffer, annotStore, canvasSize);
        const url = safeCreateObjectURL(blob);
        if (!url) return;
        const a = document.createElement('a');
        a.href = url;
        a.download = `${state.docName || 'document'}-annotated.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        setOcrStatus(`PDF с аннотациями: ${annotStore.size} страниц, ${Math.round(blob.size / 1024)} КБ`);
        return;
      } catch (err) {
        console.warn('pdf-lib annotation export failed, falling back:', err);
      }
    }

    // Legacy fallback: single page raster export
    const strokes = loadStrokes();
    const pageImageDataUrl = els.canvas.toDataURL('image/png');
    const blob = exportAnnotationsAsPdf(strokes, els.annotationCanvas.width, els.annotationCanvas.height, pageImageDataUrl);
    if (!blob) { setOcrStatus('Ошибка экспорта PDF'); return; }
    const url = safeCreateObjectURL(blob);
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.docName || 'document'}-page-${state.currentPage}-annotations.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  });
}
