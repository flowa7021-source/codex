// page-organizer-ui.js — Page Organizer modal UI, extracted from app.js
import { state, els as _els } from './state.js';
import { toastSuccess, toastError } from './toast.js';
import {
  getPageInfoList, reorderPages, rotatePages, extractPages,
  insertBlankPage, createOrganizerState, togglePageSelection,
  selectPageRange, computeReorderFromDrag,
} from './page-organizer.js';

/**
 * Initialize the Page Organizer UI.
 * @param {object} deps
 * @param {function} deps.openFile — re-open a file after reorganization
 */
export function initPageOrganizerUI(deps) {
  const { openFile } = deps;

  const orgModal = document.getElementById('pageOrganizerModal');
  const orgGrid = document.getElementById('pageOrgGrid');
  const orgStatus = document.getElementById('pageOrgStatus');
  let orgState = null;
  let orgPdfBytes = null;
  let orgNewOrder = null;

  async function openPageOrganizer() {
    if (!state.adapter || state.adapter.type !== 'pdf') {
      toastError('Организатор страниц доступен только для PDF');
      return;
    }
    orgModal.style.display = '';
    orgModal.classList.add('open');
    orgStatus.textContent = 'Загрузка страниц...';

    try {
      orgPdfBytes = await state.adapter.getRawBytes();
      const pages = await getPageInfoList(orgPdfBytes);
      orgState = createOrganizerState(pages);
      orgNewOrder = pages.map((_, i) => i);
      await renderOrgGrid();
      orgStatus.textContent = `${pages.length} страниц`;
    } catch (err) {
      orgStatus.textContent = `Ошибка: ${err.message}`;
    }
  }

  async function renderOrgGrid() {
    if (!orgState || !orgGrid) return;
    orgGrid.innerHTML = '';

    for (let i = 0; i < orgNewOrder.length; i++) {
      const pageIdx = orgNewOrder[i];
      const pageNum = pageIdx + 1;

      const thumb = document.createElement('div');
      thumb.className = 'page-org-thumb';
      thumb.dataset.idx = String(i);
      thumb.draggable = true;
      if (orgState.selected.has(i)) thumb.classList.add('selected');

      // Render thumbnail
      const canvas = document.createElement('canvas');
      canvas.width = 140;
      canvas.height = 200;
      thumb.appendChild(canvas);

      // Label
      const label = document.createElement('div');
      label.className = 'page-org-label';
      label.innerHTML = `<span class="page-num">${pageNum}</span>`;
      thumb.appendChild(label);

      // Click to select
      thumb.addEventListener('click', (e) => {
        const idx = parseInt(thumb.dataset.idx);
        if (e.shiftKey && orgState.selected.size > 0) {
          const lastSelected = [...orgState.selected].pop();
          orgState = selectPageRange(orgState, lastSelected, idx);
        } else {
          orgState = togglePageSelection(orgState, idx, e.ctrlKey || e.metaKey);
        }
        updateOrgSelectionUI();
      });

      // Drag events
      thumb.addEventListener('dragstart', (e) => {
        if (!orgState.selected.has(i)) {
          orgState = togglePageSelection(orgState, i, false);
          updateOrgSelectionUI();
        }
        orgState.dragSource = i;
        thumb.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });

      thumb.addEventListener('dragend', () => {
        thumb.classList.remove('dragging');
        orgGrid.querySelectorAll('.drop-target').forEach(el => el.classList.remove('drop-target'));
      });

      thumb.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        thumb.classList.add('drop-target');
      });

      thumb.addEventListener('dragleave', () => {
        thumb.classList.remove('drop-target');
      });

      thumb.addEventListener('drop', (e) => {
        e.preventDefault();
        thumb.classList.remove('drop-target');
        const dropIdx = parseInt(thumb.dataset.idx);
        if (orgState.selected.size > 0) {
          const newOrd = computeReorderFromDrag(orgState, dropIdx);
          orgNewOrder = newOrd.map(ni => orgNewOrder[ni] ?? ni);
          orgState.selected.clear();
          renderOrgGrid();
        }
      });

      orgGrid.appendChild(thumb);

      // Render page thumbnail asynchronously
      renderThumbnailAsync(canvas, pageNum).catch((err) => { console.warn('[page-organizer-ui] error:', err?.message); });
    }
  }

  async function renderThumbnailAsync(canvas, pageNum) {
    try {
      const page = await state.adapter.pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 0.25 });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport }).promise;
    } catch (err) { console.warn('[page-org] render error (non-critical):', err?.message); }
  }

  function updateOrgSelectionUI() {
    const thumbs = orgGrid.querySelectorAll('.page-org-thumb');
    thumbs.forEach((thumb, i) => {
      thumb.classList.toggle('selected', orgState.selected.has(i));
    });
    const selCount = orgState.selected.size;
    orgStatus.textContent = selCount > 0
      ? `Выбрано: ${selCount} из ${orgNewOrder.length}`
      : `${orgNewOrder.length} страниц`;
  }

  document.getElementById('openPageOrganizer')?.addEventListener('click', openPageOrganizer);

  document.getElementById('pageOrgClose')?.addEventListener('click', () => {
    orgModal.style.display = 'none';
    orgModal.classList.remove('open');
  });

  document.getElementById('pageOrgCancel')?.addEventListener('click', () => {
    orgModal.style.display = 'none';
    orgModal.classList.remove('open');
  });

  document.getElementById('pageOrgApply')?.addEventListener('click', async () => {
    if (!orgPdfBytes || !orgNewOrder) return;
    orgStatus.textContent = 'Применение изменений...';
    try {
      const newPdf = await reorderPages(orgPdfBytes, orgNewOrder);
      // Reload the document with new PDF bytes
      const blob = new Blob([newPdf], { type: 'application/pdf' });
      const file = new File([blob], state.docName || 'reorganized.pdf', { type: 'application/pdf' });
      orgModal.style.display = 'none';
      orgModal.classList.remove('open');
      // Re-open the file
      await openFile(file);
      toastSuccess('Страницы реорганизованы');
    } catch (err) {
      orgStatus.textContent = `Ошибка: ${err.message}`;
    }
  });

  document.getElementById('pageOrgRotateCW')?.addEventListener('click', async () => {
    if (!orgPdfBytes || !orgState?.selected.size) return;
    const indices = [...orgState.selected].map(i => orgNewOrder[i]);
    orgPdfBytes = await rotatePages(orgPdfBytes, indices, 90);
    await renderOrgGrid();
  });

  document.getElementById('pageOrgDelete')?.addEventListener('click', async () => {
    if (!orgState?.selected.size) return;
    const toDelete = new Set([...orgState.selected]);
    orgNewOrder = orgNewOrder.filter((_, i) => !toDelete.has(i));
    orgState.selected.clear();
    orgState = createOrganizerState(orgNewOrder.map((_, i) => ({ index: i })));
    await renderOrgGrid();
  });

  document.getElementById('pageOrgDuplicate')?.addEventListener('click', async () => {
    if (!orgPdfBytes || !orgState?.selected.size) return;
    const indices = [...orgState.selected].sort((a, b) => b - a);
    for (const i of indices) {
      orgNewOrder.splice(i + 1, 0, orgNewOrder[i]);
    }
    orgState.selected.clear();
    orgState = createOrganizerState(orgNewOrder.map((_, i) => ({ index: i })));
    await renderOrgGrid();
  });

  document.getElementById('pageOrgInsertBlank')?.addEventListener('click', async () => {
    if (!orgPdfBytes) return;
    orgPdfBytes = await insertBlankPage(orgPdfBytes, orgNewOrder.length);
    const newIdx = (await getPageInfoList(orgPdfBytes)).length - 1;
    orgNewOrder.push(newIdx);
    orgState = createOrganizerState(orgNewOrder.map((_, i) => ({ index: i })));
    await renderOrgGrid();
  });

  document.getElementById('pageOrgExtract')?.addEventListener('click', async () => {
    if (!orgPdfBytes || !orgState?.selected.size) return;
    const indices = [...orgState.selected].map(i => orgNewOrder[i]);
    const extracted = await extractPages(orgPdfBytes, indices);
    const blob = new Blob([extracted], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `extracted_pages.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById('pageOrgReverse')?.addEventListener('click', async () => {
    orgNewOrder.reverse();
    orgState.selected.clear();
    orgState = createOrganizerState(orgNewOrder.map((_, i) => ({ index: i })));
    await renderOrgGrid();
  });
}
