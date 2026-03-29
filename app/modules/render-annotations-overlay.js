// @ts-check
// ─── Annotations Overlay Sub-module ──────────────────────────────────────────
// Annotation canvas overlay logic: watermarks, stamps, signatures,
// image insertion, and safe URL creation.
// Split from render-controller.js for maintainability.

import { state, els } from './state.js';
import { blockEditor } from './pdf-advanced-edit.js';
import { addSignatureToPdf } from './pdf-operations.js';

// ─── Late-bound dependencies ────────────────────────────────────────────────
const _deps = {
  setOcrStatus: () => {},
};

export function initRenderAnnotationsOverlayDeps(deps) {
  Object.assign(_deps, deps);
}

// ─── Safe createObjectURL wrapper ──────────────────────────────────────────

export function safeCreateObjectURL(data) {
  if (data instanceof Blob || data instanceof File) {
    return URL.createObjectURL(data);
  }
  // Wrap raw data in a Blob as fallback
  if (data instanceof ArrayBuffer || data instanceof Uint8Array) {
    return URL.createObjectURL(new Blob([/** @type {any} */ (data)]));
  }
  if (typeof data === 'string') {
    return URL.createObjectURL(new Blob([data], { type: 'text/plain' }));
  }
  console.warn('safeCreateObjectURL: invalid argument type', typeof data);
  return '';
}

// ─── Image Insertion ───────────────────────────────────────────────────────

export function handleImageInsertion(file) {
  if (!file || !state.adapter) return;

  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = /** @type {string} */ (reader.result);
    const img = new Image();
    img.onload = () => {
      // Insert at center of visible area
      const canvasW = parseFloat(els.canvas.style.width) || 400;
      const canvasH = parseFloat(els.canvas.style.height) || 600;
      const maxW = canvasW * 0.5;
      const maxH = canvasH * 0.5;
      let w = img.width;
      let h = img.height;
      if (w > maxW) { h *= maxW / w; w = maxW; }
      if (h > maxH) { w *= maxH / h; h = maxH; }

      const x = (canvasW - w) / 2;
      const y = (canvasH - h) / 2;

      // Enable block editor if not active
      if (!blockEditor.active) {
        els.pdfBlockEdit?.classList.add('active');
        blockEditor.enable(els.canvasWrap, els.canvas);
      }

      blockEditor.addImageBlock(state.currentPage, x, y, dataUrl, w, h);
      blockEditor.refreshOverlay(els.canvasWrap, els.canvas);
      /** @type {any} */ (_deps).setOcrStatus?.('Изображение вставлено. Перемещайте и масштабируйте в режиме "Блоки".');
    };
    img.src = dataUrl;
  };
  reader.readAsDataURL(file);
}

// ─── Watermark ─────────────────────────────────────────────────────────────

export function addWatermarkToPage(text, options = {}) {
  if (!state.adapter) return;
  const {
    fontSize = 60,
    color = 'rgba(200, 200, 200, 0.3)',
    angle = -45,
  } = options;

  if (!els.annotationCanvas) return;
  const ctx = /** @type {any} */ (els.annotationCanvas).getContext('2d');
  if (!ctx) return;
  const w = /** @type {any} */ (els.annotationCanvas).width;
  const h = /** @type {any} */ (els.annotationCanvas).height;
  const dpr = Math.max(1, window.devicePixelRatio || 1);

  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate((angle * Math.PI) / 180);
  ctx.font = `${fontSize * dpr}px sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

// ─── Stamp ─────────────────────────────────────────────────────────────────

export function addStampToPage(stampType) {
  if (!state.adapter) return;
  const stamps = {
    approved: { text: 'УТВЕРЖДЕНО', color: 'rgba(0, 150, 0, 0.5)', border: '#00aa00' },
    rejected: { text: 'ОТКЛОНЕНО', color: 'rgba(200, 0, 0, 0.5)', border: '#cc0000' },
    draft: { text: 'ЧЕРНОВИК', color: 'rgba(150, 150, 0, 0.5)', border: '#aaaa00' },
    confidential: { text: 'КОНФИДЕНЦИАЛЬНО', color: 'rgba(200, 0, 0, 0.5)', border: '#cc0000' },
    copy: { text: 'КОПИЯ', color: 'rgba(0, 0, 200, 0.5)', border: '#0000cc' },
  };

  const stamp = stamps[stampType] || stamps.approved;
  const ctx = /** @type {any} */ (els.annotationCanvas).getContext('2d');
  if (!ctx) return;
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const w = /** @type {any} */ (els.annotationCanvas).width;

  const boxW = 300 * dpr;
  const boxH = 80 * dpr;
  const x = w - boxW - 40 * dpr;
  const y = 40 * dpr;

  ctx.save();
  ctx.strokeStyle = stamp.border;
  ctx.lineWidth = 3 * dpr;
  ctx.setLineDash([6 * dpr, 3 * dpr]);
  ctx.strokeRect(x, y, boxW, boxH);
  ctx.setLineDash([]);

  ctx.fillStyle = stamp.color;
  ctx.font = `bold ${24 * dpr}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(stamp.text, x + boxW / 2, y + boxH / 2);
  ctx.restore();
}

// ─── Signature Pad ─────────────────────────────────────────────────────────

export function openSignaturePad() {
  // Create modal with canvas for drawing signature
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:1000;display:flex;align-items:center;justify-content:center;';

  const card = document.createElement('div');
  card.style.cssText = 'background:white;border-radius:8px;padding:16px;min-width:400px;';
  card.innerHTML = '<h3 style="margin:0 0 8px">Нарисуйте подпись</h3>';

  const sigCanvas = document.createElement('canvas');
  sigCanvas.width = 400;
  sigCanvas.height = 200;
  sigCanvas.style.cssText = 'border:1px solid #ccc;border-radius:4px;cursor:crosshair;display:block;background:white;';

  const sigCtx = sigCanvas.getContext('2d');
  if (!sigCtx) return;
  sigCtx.lineWidth = 2;
  sigCtx.lineCap = 'round';
  sigCtx.lineJoin = 'round';
  sigCtx.strokeStyle = '#000';

  let drawing = false;
  sigCanvas.addEventListener('pointerdown', (e) => {
    drawing = true;
    sigCtx.beginPath();
    sigCtx.moveTo(e.offsetX, e.offsetY);
  });
  sigCanvas.addEventListener('pointermove', (e) => {
    if (!drawing) return;
    sigCtx.lineTo(e.offsetX, e.offsetY);
    sigCtx.stroke();
  });
  sigCanvas.addEventListener('pointerup', () => { drawing = false; });

  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:8px;margin-top:8px;justify-content:flex-end;';

  const clearBtn = document.createElement('button');
  clearBtn.textContent = 'Очистить';
  clearBtn.className = 'btn-xs';
  clearBtn.addEventListener('click', () => {
    sigCtx.clearRect(0, 0, 400, 200);
  });

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Отмена';
  cancelBtn.className = 'btn-xs';
  cancelBtn.addEventListener('click', () => modal.remove());

  const insertBtn = document.createElement('button');
  insertBtn.textContent = 'Вставить';
  insertBtn.className = 'btn-xs';
  insertBtn.style.background = '#3b82f6';
  insertBtn.style.color = 'white';
  insertBtn.addEventListener('click', async () => {
    const dataUrl = sigCanvas.toDataURL('image/png');
    // Visual preview via block editor
    if (!blockEditor.active) {
      els.pdfBlockEdit?.classList.add('active');
      blockEditor.enable(els.canvasWrap, els.canvas);
    }
    const canvasW = parseFloat(els.canvas.style.width) || 400;
    const canvasH = parseFloat(els.canvas.style.height) || 600;
    // Place at center — user can drag to reposition via block editor
    const sigX = canvasW * 0.5;
    const sigY = canvasH * 0.7;
    const sigW = 200;
    const sigH = 100;
    blockEditor.addImageBlock(state.currentPage, sigX, sigY, dataUrl, sigW, sigH);
    blockEditor.refreshOverlay(els.canvasWrap, els.canvas);
    /** @type {any} */ (_deps).setOcrStatus?.('Подпись вставлена — перетащите на нужное место, затем сохраните PDF');

    // Also embed into actual PDF via pdf-lib
    if (state.adapter?.type === 'pdf' && state.file) {
      try {
        /** @type {any} */ (_deps).setOcrStatus?.('Встраивание подписи в PDF...');
        const pngBlob = await (await fetch(dataUrl)).blob();
        const pngBytes = new Uint8Array(await pngBlob.arrayBuffer());
        const arrayBuffer = await state.file.arrayBuffer();
        // Use the block editor's position if the block was already moved by the user
        const blocks = blockEditor.exportAllBlocks();
        const pageBlocks = blocks[state.currentPage] || [];
        const sigBlock = pageBlocks.find(b => b.type === 'image' && b.dataUrl === dataUrl);
        const pdfScaleX = 595 / canvasW; // approximate PDF pts / CSS px
        const pdfScaleY = 842 / canvasH;
        const finalX = sigBlock ? sigBlock.x * pdfScaleX : 350;
        const finalY = sigBlock ? (canvasH - sigBlock.y - sigBlock.height) * pdfScaleY : 50;
        const finalW = sigBlock ? sigBlock.width * pdfScaleX : sigW;
        const finalH = sigBlock ? sigBlock.height * pdfScaleY : sigH;
        const pdfBlob = await addSignatureToPdf(arrayBuffer, pngBytes, {
          pageNum: state.currentPage,
          x: finalX,
          y: finalY,
          width: finalW,
          height: finalH,
        });
        const { saveOrDownload } = await import('./platform.js');
        await saveOrDownload(pdfBlob, `${state.docName || 'document'}-signed.pdf`, [{ name: 'PDF', extensions: ['pdf'] }]);
        /** @type {any} */ (_deps).setOcrStatus?.('Подпись встроена в PDF и сохранена');
      } catch (err) {
        /** @type {any} */ (_deps).setOcrStatus?.(`Подпись на canvas (PDF ошибка: ${err?.message || 'неизвестная'})`);
      }
    }
    modal.remove();
  });

  btnRow.append(clearBtn, cancelBtn, insertBtn);
  card.append(sigCanvas, btnRow);
  modal.appendChild(card);
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}
