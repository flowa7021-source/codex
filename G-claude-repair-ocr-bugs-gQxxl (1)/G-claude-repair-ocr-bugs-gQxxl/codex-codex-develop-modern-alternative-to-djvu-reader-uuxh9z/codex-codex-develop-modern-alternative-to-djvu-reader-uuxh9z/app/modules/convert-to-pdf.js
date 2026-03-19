// convert-to-pdf.js — Convert images and DJVU to PDF
import { PDFDocument } from 'pdf-lib';
import { state } from './state.js';

/**
 * Convert one or more image files (JPG, PNG, TIFF, BMP, WebP) to a PDF.
 * Each image becomes one page. Page size matches image dimensions.
 * @param {File[]} files - Image files to convert
 * @returns {Promise<Uint8Array>} PDF bytes
 */
export async function imagesToPdf(files) {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setCreator('NovaReader');
  pdfDoc.setProducer('NovaReader + pdf-lib');

  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let image;
    const lower = file.name.toLowerCase();

    if (lower.endsWith('.png')) {
      image = await pdfDoc.embedPng(bytes);
    } else if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
      image = await pdfDoc.embedJpg(bytes);
    } else {
      // For WebP, BMP, TIFF — convert via canvas first, then embed as PNG
      const blob = new Blob([bytes], { type: file.type || 'image/png' });
      const url = URL.createObjectURL(blob);
      try {
        const img = await new Promise((resolve, reject) => {
          const el = new Image();
          el.onload = () => resolve(el);
          el.onerror = reject;
          el.src = url;
        });
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const pngBlob = await new Promise(r => canvas.toBlob(r, 'image/png'));
        const pngBytes = new Uint8Array(await pngBlob.arrayBuffer());
        image = await pdfDoc.embedPng(pngBytes);
        canvas.width = 0;
        canvas.height = 0;
      } finally {
        URL.revokeObjectURL(url);
      }
    }

    const page = pdfDoc.addPage([image.width, image.height]);
    page.drawImage(image, {
      x: 0,
      y: 0,
      width: image.width,
      height: image.height,
    });
  }

  return new Uint8Array(await pdfDoc.save());
}

/**
 * Convert the current DJVU document to PDF by rendering each page to canvas
 * and embedding as images in a PDF.
 * @param {object} adapter - DjVuNativeAdapter or DjVuAdapter
 * @param {function} onProgress - (page, total) => void
 * @returns {Promise<Uint8Array>} PDF bytes
 */
export async function djvuToPdf(adapter, onProgress) {
  if (!adapter) throw new Error('No adapter provided');

  const pageCount = adapter.getPageCount();
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setCreator('NovaReader');
  pdfDoc.setProducer('NovaReader — DJVU to PDF');

  for (let i = 1; i <= pageCount; i++) {
    if (onProgress) onProgress(i, pageCount);

    const canvas = document.createElement('canvas');
    await adapter.renderPage(i, canvas, { zoom: 1, rotation: 0 });

    // Get page image as PNG
    const pngBlob = await new Promise(r => canvas.toBlob(r, 'image/png'));
    const pngBytes = new Uint8Array(await pngBlob.arrayBuffer());
    const image = await pdfDoc.embedPng(pngBytes);

    const page = pdfDoc.addPage([image.width, image.height]);
    page.drawImage(image, {
      x: 0,
      y: 0,
      width: image.width,
      height: image.height,
    });

    // Get text for this page and add invisible text layer
    try {
      const text = await adapter.getText(i);
      if (text && text.trim()) {
        // Add text as a simple content stream (for searchability)
        page.drawText(text.substring(0, 5000), {
          x: 0,
          y: -1000, // off-screen but present in text extraction
          size: 1,
          opacity: 0,
        });
      }
    } catch (err) { console.warn('[convert-to-pdf] error:', err?.message); }

    // Release canvas memory
    canvas.width = 0;
    canvas.height = 0;
  }

  return new Uint8Array(await pdfDoc.save());
}

/**
 * Convert current document to PDF and open it in the viewer.
 * @param {function} reloadPdfFromBytes - function from file-controller
 * @param {function} setStatus - status update function
 */
export async function convertCurrentToPdf(reloadPdfFromBytes, setStatus) {
  if (!state.adapter) {
    setStatus('Нет открытого документа');
    return;
  }

  const type = state.adapter.type;

  if (type === 'pdf') {
    setStatus('Документ уже в формате PDF');
    return;
  }

  try {
    if (type === 'image') {
      setStatus('Конвертация изображения в PDF...');
      const file = state.file;
      const pdfBytes = await imagesToPdf([file]);
      state.docName = state.docName.replace(/\.[^.]+$/, '.pdf');
      await reloadPdfFromBytes(pdfBytes);
      setStatus('Изображение конвертировано в PDF');
    } else if (type === 'djvu') {
      setStatus('Конвертация DJVU в PDF...');
      const pdfBytes = await djvuToPdf(state.adapter, (page, total) => {
        setStatus(`Конвертация DJVU → PDF: ${page}/${total}`);
      });
      state.docName = state.docName.replace(/\.[^.]+$/, '.pdf');
      await reloadPdfFromBytes(pdfBytes);
      setStatus(`DJVU конвертирован в PDF (${state.pageCount} стр.)`);
    } else {
      setStatus(`Конвертация формата "${type}" в PDF не поддерживается`);
    }
  } catch (err) {
    setStatus(`Ошибка конвертации: ${err?.message || 'неизвестная'}`);
  }
}
