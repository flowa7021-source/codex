// ─── Drag & Drop Improvements ───────────────────────────────────────────────
// Page reorder, file merge, annotation drag, drop zone UI.

/**
 * Initialize drag-and-drop for the application.
 * @param {object} deps
 * @param {HTMLElement} deps.viewport - Main document viewport
 * @param {HTMLElement} deps.thumbnailGrid - Thumbnail panel
 * @param {Function} deps.openFile - (file: File) => void
 * @param {Function} deps.mergePdf - (files: File[]) => void
 * @param {Function} deps.reorderPages - (from: number, to: number) => void
 */
export function initDragDrop(deps) {
  const { viewport, thumbnailGrid, openFile, mergePdf, reorderPages } = deps;

  // ── File Drop Zone ──
  if (viewport) {
    initFileDropZone(viewport, openFile, mergePdf);
  }

  // ── Thumbnail Reorder ──
  if (thumbnailGrid) {
    initThumbnailReorder(thumbnailGrid, reorderPages);
  }
}

/**
 * Set up file drop zone with visual feedback.
 */
function initFileDropZone(element, openFile, mergePdf) {
  let overlay = null;

  function showOverlay() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.className = 'drop-zone-overlay';
    overlay.innerHTML = `
      <div class="drop-zone-content">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M12 15V3m0 0L8 7m4-4l4 4"/>
          <path d="M2 17l.621 2.485A2 2 0 0 0 4.561 21h14.878a2 2 0 0 0 1.94-1.515L22 17"/>
        </svg>
        <p>Перетащите файл сюда</p>
        <span class="drop-zone-hint">PDF, DjVu, EPUB, изображения</span>
      </div>
    `;
    element.appendChild(overlay);
  }

  function hideOverlay() {
    if (overlay) {
      overlay.remove();
      overlay = null;
    }
  }

  let dragCounter = 0;

  element.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragCounter++;
    if (dragCounter === 1) showOverlay();
  });

  element.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter <= 0) {
      dragCounter = 0;
      hideOverlay();
    }
  });

  element.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });

  element.addEventListener('drop', (e) => {
    e.preventDefault();
    dragCounter = 0;
    hideOverlay();

    const files = [...(e.dataTransfer?.files || [])];
    if (files.length === 0) return;

    // Multiple PDF files → merge
    const pdfFiles = files.filter(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'));
    if (pdfFiles.length > 1 && mergePdf) {
      mergePdf(pdfFiles);
      return;
    }

    // Single file → open
    if (files.length >= 1 && openFile) {
      openFile(files[0]);
    }
  });
}

/**
 * Enable drag-to-reorder for thumbnail cells.
 */
function initThumbnailReorder(container, reorderPages) {
  let draggedItem = null;
  let draggedPage = null;
  let placeholder = null;

  container.addEventListener('dragstart', (e) => {
    const cell = e.target.closest('.thumbnail-cell');
    if (!cell) return;

    draggedItem = cell;
    draggedPage = parseInt(cell.dataset.page, 10);
    cell.classList.add('dragging');

    // Create placeholder
    placeholder = document.createElement('div');
    placeholder.className = 'thumbnail-placeholder';

    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(draggedPage));

    // Use timeout to allow the drag image to render
    setTimeout(() => {
      cell.style.opacity = '0.4';
    }, 0);
  });

  container.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const target = e.target.closest('.thumbnail-cell');
    if (!target || target === draggedItem) return;

    const rect = target.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;

    if (e.clientY < midY) {
      target.parentNode.insertBefore(placeholder, target);
    } else {
      target.parentNode.insertBefore(placeholder, target.nextSibling);
    }
  });

  container.addEventListener('dragend', (e) => {
    if (draggedItem) {
      draggedItem.classList.remove('dragging');
      draggedItem.style.opacity = '';
    }
    if (placeholder?.parentNode) {
      placeholder.remove();
    }
    draggedItem = null;
    placeholder = null;
  });

  container.addEventListener('drop', (e) => {
    e.preventDefault();
    const target = e.target.closest('.thumbnail-cell');
    if (!target || !draggedItem) return;

    const targetPage = parseInt(target.dataset.page, 10);
    if (draggedPage && targetPage && draggedPage !== targetPage && reorderPages) {
      reorderPages(draggedPage, targetPage);
    }

    if (draggedItem) {
      draggedItem.classList.remove('dragging');
      draggedItem.style.opacity = '';
    }
    if (placeholder?.parentNode) {
      placeholder.remove();
    }
    draggedItem = null;
    placeholder = null;
  });

  // Make thumbnail cells draggable
  const observer = new MutationObserver(() => {
    container.querySelectorAll('.thumbnail-cell').forEach(cell => {
      cell.draggable = true;
    });
  });
  observer.observe(container, { childList: true });

  // Set existing cells
  container.querySelectorAll('.thumbnail-cell').forEach(cell => {
    cell.draggable = true;
  });
}

/**
 * Create a drop zone for annotation elements (stamps, images).
 * @param {HTMLCanvasElement} canvas
 * @param {Function} onDrop - (x, y, dataTransfer) => void
 */
export function initAnnotationDrop(canvas, onDrop) {
  if (!canvas) return;

  canvas.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    canvas.classList.add('annotation-drop-hover');
  });

  canvas.addEventListener('dragleave', () => {
    canvas.classList.remove('annotation-drop-hover');
  });

  canvas.addEventListener('drop', (e) => {
    e.preventDefault();
    canvas.classList.remove('annotation-drop-hover');

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (onDrop) onDrop(x, y, e.dataTransfer);
  });
}
