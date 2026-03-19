// ─── PDF Ops Controller ─────────────────────────────────────────────────────
// PDF merge, split, page-range operations.
// Extracted from app.js as part of module decomposition.

import { state } from './state.js';

// ─── Late-bound dependencies ────────────────────────────────────────────────
// These are injected from app.js to avoid circular imports.
const _deps = {
  setOcrStatus: () => {},
  safeCreateObjectURL: (blob) => URL.createObjectURL(blob),
  pushDiagnosticEvent: () => {},
  mergePdfDocuments: async () => new Blob(),
  splitPdfDocument: async () => null,
  parsePageRangeLib: () => [],
  nrPrompt: async () => null,
};

/**
 * Inject runtime dependencies that live in other modules.
 * Must be called once during startup before any pdf-ops functions are used.
 */
export function initPdfOpsDeps(deps) {
  Object.assign(_deps, deps);
}

// ─── PDF Merge (via pdf-lib — preserves text, fonts, links, forms) ─────────
export async function mergePdfFiles() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.pdf';
  input.multiple = true;
  input.addEventListener('change', async () => {
    const files = Array.from(input.files || []);
    if (files.length < 2) {
      _deps.setOcrStatus('Выберите 2+ PDF файла для объединения');
      return;
    }
    try {
      _deps.setOcrStatus(`Объединение ${files.length} файлов (без потери данных)...`);
      const mergedBlob = await _deps.mergePdfDocuments(files);

      const url = _deps.safeCreateObjectURL(mergedBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'merged.pdf';
      a.click();
      URL.revokeObjectURL(url);
      _deps.setOcrStatus(`Объединено: ${files.length} файлов (${Math.round(mergedBlob.size / 1024)} КБ)`);
      _deps.pushDiagnosticEvent('pdf.merge', { files: files.length, sizeKb: Math.round(mergedBlob.size / 1024) });
    } catch (err) {
      _deps.setOcrStatus(`Ошибка объединения: ${err?.message || 'неизвестная'}`);
      _deps.pushDiagnosticEvent('pdf.merge.error', { message: err?.message }, 'error');
    }
  });
  input.click();
}

export function buildMergedPdfFromCanvases(pages) {
  // Simple PDF builder with images
  const encoder = new TextEncoder();
  const objects = [];
  const xrefOffsets = [];
  let offset = 0;

  const header = '%PDF-1.4\n';
  offset = header.length;

  // Catalog
  objects.push(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`);
  // Pages
  const pageRefs = pages.map((_, i) => `${3 + i * 3} 0 R`).join(' ');
  objects.push(`2 0 obj\n<< /Type /Pages /Kids [${pageRefs}] /Count ${pages.length} >>\nendobj\n`);

  let objNum = 3;
  const imageObjects = [];

  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    const imgData = p.canvas.toDataURL('image/jpeg', 0.85);
    const base64 = imgData.split(',')[1];
    const imgBytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));

    const pageObjNum = objNum++;
    const contentsObjNum = objNum++;
    const imgObjNum = objNum++;

    const stream = `q ${p.width} 0 0 ${p.height} 0 0 cm /Img${i} Do Q`;

    objects.push(`${pageObjNum} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${p.width} ${p.height}] /Contents ${contentsObjNum} 0 R /Resources << /XObject << /Img${i} ${imgObjNum} 0 R >> >> >>\nendobj\n`);
    objects.push(`${contentsObjNum} 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`);

    imageObjects.push({ objNum: imgObjNum, data: imgBytes, width: p.width, height: p.height });
  }

  // Build the final PDF
  const pdfParts = [header];
  for (const obj of objects) {
    xrefOffsets.push(offset);
    pdfParts.push(obj);
    offset += obj.length;
  }

  // Image stream objects
  for (const img of imageObjects) {
    const imgHeader = `${img.objNum} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.data.length} >>\nstream\n`;
    const imgFooter = `\nendstream\nendobj\n`;
    xrefOffsets.push(offset);
    pdfParts.push(imgHeader);
    offset += imgHeader.length;
    pdfParts.push(img.data);
    offset += img.data.length;
    pdfParts.push(imgFooter);
    offset += imgFooter.length;
  }

  const xrefStart = offset;
  const totalObjs = objects.length + imageObjects.length + 1;
  let xref = `xref\n0 ${totalObjs}\n0000000000 65535 f \n`;
  for (const xo of xrefOffsets) {
    xref += `${String(xo).padStart(10, '0')} 00000 n \n`;
  }
  xref += `trailer\n<< /Size ${totalObjs} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  pdfParts.push(xref);

  // Combine text and binary parts
  const allParts = pdfParts.map(p => typeof p === 'string' ? encoder.encode(p) : p);
  const totalSize = allParts.reduce((s, p) => s + p.length, 0);
  const result = new Uint8Array(totalSize);
  let pos = 0;
  for (const p of allParts) { result.set(p, pos); pos += p.length; }

  return new Blob([result], { type: 'application/pdf' });
}

// ─── PDF Split (via pdf-lib — preserves all content) ────────────────────────
export async function splitPdfPages() {
  if (!state.adapter || state.adapter.type !== 'pdf') {
    _deps.setOcrStatus('Разделение доступно только для PDF');
    return;
  }
  const rangeStr = await _deps.nrPrompt(`Введите диапазон страниц (напр. "1-3" или "1,3,5-7").\nВсего страниц: ${state.pageCount}`);
  if (!rangeStr) return;

  const pageNums = _deps.parsePageRangeLib(rangeStr, state.pageCount);
  if (!pageNums.length) {
    _deps.setOcrStatus('Неверный диапазон страниц');
    return;
  }

  try {
    _deps.setOcrStatus(`Извлечение ${pageNums.length} страниц (без потери данных)...`);
    const arrayBuffer = await state.file.arrayBuffer();
    const blob = await _deps.splitPdfDocument(arrayBuffer, pageNums);

    if (!blob) {
      _deps.setOcrStatus('Ошибка: не удалось извлечь страницы');
      return;
    }

    const url = _deps.safeCreateObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.docName || 'document'}-pages-${rangeStr}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
    _deps.setOcrStatus(`Извлечено ${pageNums.length} страниц (${Math.round(blob.size / 1024)} КБ)`);
    _deps.pushDiagnosticEvent('pdf.split', { pages: pageNums.length, sizeKb: Math.round(blob.size / 1024) });
  } catch (err) {
    _deps.setOcrStatus(`Ошибка: ${err?.message || 'неизвестная'}`);
    _deps.pushDiagnosticEvent('pdf.split.error', { message: err?.message }, 'error');
  }
}

export function parsePageRange(str, maxPage) {
  const parts = str.split(',').map(s => s.trim()).filter(Boolean);
  const result = [];
  for (const part of parts) {
    const rangeParts = part.split('-').map(s => parseInt(s.trim(), 10));
    if (rangeParts.length === 1 && !isNaN(rangeParts[0])) {
      const p = rangeParts[0];
      if (p >= 1 && p <= maxPage) result.push(p);
    } else if (rangeParts.length === 2 && !isNaN(rangeParts[0]) && !isNaN(rangeParts[1])) {
      const from = Math.max(1, rangeParts[0]);
      const to = Math.min(maxPage, rangeParts[1]);
      for (let i = from; i <= to; i++) result.push(i);
    }
  }
  return [...new Set(result)].sort((a, b) => a - b);
}
