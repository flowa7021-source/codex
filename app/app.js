import * as pdfjsLib from 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs';

const state = {
  adapter: null,
  file: null,
  docName: null,
  currentPage: 1,
  pageCount: 0,
  zoom: 1,
  rotation: 0,
  searchResults: [],
  searchCursor: -1,
  outline: [],
  drawEnabled: false,
  isDrawing: false,
  currentStroke: null,
};

const els = {
  fileInput: document.getElementById('fileInput'),
  recentList: document.getElementById('recentList'),
  notes: document.getElementById('notes'),
  saveNotes: document.getElementById('saveNotes'),
  exportNotes: document.getElementById('exportNotes'),
  prevPage: document.getElementById('prevPage'),
  nextPage: document.getElementById('nextPage'),
  pageStatus: document.getElementById('pageStatus'),
  pageInput: document.getElementById('pageInput'),
  goToPage: document.getElementById('goToPage'),
  zoomOut: document.getElementById('zoomOut'),
  zoomIn: document.getElementById('zoomIn'),
  fitWidth: document.getElementById('fitWidth'),
  fitPage: document.getElementById('fitPage'),
  zoomStatus: document.getElementById('zoomStatus'),
  rotate: document.getElementById('rotate'),
  canvas: document.getElementById('viewerCanvas'),
  annotationCanvas: document.getElementById('annotationCanvas'),
  emptyState: document.getElementById('emptyState'),
  searchInput: document.getElementById('searchInput'),
  searchBtn: document.getElementById('searchBtn'),
  searchPrev: document.getElementById('searchPrev'),
  searchNext: document.getElementById('searchNext'),
  searchStatus: document.getElementById('searchStatus'),
  themeToggle: document.getElementById('themeToggle'),
  fullscreen: document.getElementById('fullscreen'),
  canvasWrap: document.getElementById('canvasWrap'),
  addBookmark: document.getElementById('addBookmark'),
  clearBookmarks: document.getElementById('clearBookmarks'),
  bookmarkList: document.getElementById('bookmarkList'),
  outlineList: document.getElementById('outlineList'),
  downloadFile: document.getElementById('downloadFile'),
  printPage: document.getElementById('printPage'),
  docInfo: document.getElementById('docInfo'),
  refreshText: document.getElementById('refreshText'),
  copyText: document.getElementById('copyText'),
  exportText: document.getElementById('exportText'),
  pageText: document.getElementById('pageText'),
  annotateToggle: document.getElementById('annotateToggle'),
  drawTool: document.getElementById('drawTool'),
  drawColor: document.getElementById('drawColor'),
  drawSize: document.getElementById('drawSize'),
  undoStroke: document.getElementById('undoStroke'),
  clearStrokes: document.getElementById('clearStrokes'),
  exportAnnotated: document.getElementById('exportAnnotated'),
};

class PDFAdapter {
  constructor(pdfDoc) {
    this.pdfDoc = pdfDoc;
    this.type = 'pdf';
  }

  getPageCount() {
    return this.pdfDoc.numPages;
  }

  async getPageViewport(pageNumber, scale, rotation) {
    const page = await this.pdfDoc.getPage(pageNumber);
    return page.getViewport({ scale, rotation });
  }

  async renderPage(pageNumber, canvas, { zoom, rotation }) {
    const page = await this.pdfDoc.getPage(pageNumber);
    const viewport = page.getViewport({ scale: zoom, rotation });
    const ctx = canvas.getContext('2d');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: ctx, viewport }).promise;
  }

  async getText(pageNumber) {
    const page = await this.pdfDoc.getPage(pageNumber);
    const content = await page.getTextContent();
    return content.items.map((item) => item.str).join(' ');
  }

  async getOutline() {
    return this.pdfDoc.getOutline();
  }

  async resolveDestToPage(dest) {
    let targetDest = dest;
    if (typeof targetDest === 'string') {
      targetDest = await this.pdfDoc.getDestination(targetDest);
    }

    if (!targetDest || !Array.isArray(targetDest) || targetDest.length === 0) {
      return null;
    }

    const pageRef = targetDest[0];
    const pageIndex = await this.pdfDoc.getPageIndex(pageRef);
    return pageIndex + 1;
  }
}

class ImageAdapter {
  constructor(imageUrl, imageMeta) {
    this.imageUrl = imageUrl;
    this.imageMeta = imageMeta;
    this.type = 'image';
  }

  getPageCount() {
    return 1;
  }

  async getPageViewport(_pageNumber, scale, rotation) {
    const w = this.imageMeta.width * scale;
    const h = this.imageMeta.height * scale;
    if (rotation % 180 === 0) return { width: w, height: h };
    return { width: h, height: w };
  }

  async renderPage(_pageNumber, canvas, { zoom, rotation }) {
    const img = await loadImage(this.imageUrl);
    const ctx = canvas.getContext('2d');
    const rad = (rotation * Math.PI) / 180;

    const w = img.width * zoom;
    const h = img.height * zoom;

    if (rotation % 180 === 0) {
      canvas.width = w;
      canvas.height = h;
    } else {
      canvas.width = h;
      canvas.height = w;
    }

    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(rad);
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();
  }

  async getText() {
    return '';
  }
}

class UnsupportedAdapter {
  constructor(fileName) {
    this.fileName = fileName;
    this.type = 'unsupported';
  }

  getPageCount() {
    return 1;
  }

  async getPageViewport() {
    return { width: 1200, height: 700 };
  }

  async renderPage(_pageNumber, canvas) {
    canvas.width = 1200;
    canvas.height = 700;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#10141b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#f8fafc';
    ctx.font = '26px sans-serif';
    ctx.fillText('Формат пока не поддержан в MVP', 80, 130);
    ctx.font = '20px sans-serif';
    ctx.fillStyle = '#9aa6b8';
    ctx.fillText(`Файл: ${this.fileName}`, 80, 180);
    ctx.fillText('Этап 2: полноценный DjVuAdapter + текстовый слой', 80, 220);
  }

  async getText() {
    return '';
  }
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function noteKey() {
  return `novareader-notes:${state.docName || 'global'}`;
}

function bookmarkKey() {
  return `novareader-bookmarks:${state.docName || 'global'}`;
}

function annotationKey(page) {
  return `novareader-annotations:${state.docName || 'global'}:${page}`;
}

function getCurrentAnnotationCtx() {
  return els.annotationCanvas.getContext('2d');
}

function loadStrokes(page = state.currentPage) {
  return JSON.parse(localStorage.getItem(annotationKey(page)) || '[]');
}

function saveStrokes(strokes, page = state.currentPage) {
  localStorage.setItem(annotationKey(page), JSON.stringify(strokes));
}

function setDrawMode(enabled) {
  state.drawEnabled = enabled;
  els.annotationCanvas.classList.toggle('drawing-enabled', enabled);
  els.annotateToggle.textContent = `Аннотации: ${enabled ? 'on' : 'off'}`;
}

function normalizePoint(x, y) {
  return {
    x: x / Math.max(1, els.annotationCanvas.width),
    y: y / Math.max(1, els.annotationCanvas.height),
  };
}

function denormalizePoint(point) {
  return {
    x: point.x * els.annotationCanvas.width,
    y: point.y * els.annotationCanvas.height,
  };
}

function applyStrokeStyle(ctx, stroke) {
  if (stroke.tool === 'highlighter') {
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.size * 2;
  } else if (stroke.tool === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(0,0,0,1)';
    ctx.lineWidth = stroke.size * 2;
  } else {
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.size;
  }
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
}

function drawStroke(ctx, stroke) {
  if (!stroke.points?.length) return;
  ctx.save();
  applyStrokeStyle(ctx, stroke);

  const start = denormalizePoint(stroke.points[0]);
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);

  for (let i = 1; i < stroke.points.length; i += 1) {
    const p = denormalizePoint(stroke.points[i]);
    ctx.lineTo(p.x, p.y);
  }

  if (stroke.points.length === 1) {
    ctx.lineTo(start.x + 0.1, start.y + 0.1);
  }

  ctx.stroke();
  ctx.restore();
}

function renderAnnotations() {
  const ctx = getCurrentAnnotationCtx();
  ctx.clearRect(0, 0, els.annotationCanvas.width, els.annotationCanvas.height);
  const strokes = loadStrokes();
  strokes.forEach((stroke) => drawStroke(ctx, stroke));
}

function getCanvasPointFromEvent(e) {
  const rect = els.annotationCanvas.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * els.annotationCanvas.width;
  const y = ((e.clientY - rect.top) / rect.height) * els.annotationCanvas.height;
  return { x, y };
}

function beginStroke(e) {
  if (!state.drawEnabled || !state.adapter) return;
  state.isDrawing = true;
  const p = getCanvasPointFromEvent(e);
  state.currentStroke = {
    tool: els.drawTool.value,
    color: els.drawColor.value,
    size: Number(els.drawSize.value),
    points: [normalizePoint(p.x, p.y)],
  };
  renderAnnotations();
  const ctx = getCurrentAnnotationCtx();
  drawStroke(ctx, state.currentStroke);
}

function moveStroke(e) {
  if (!state.isDrawing || !state.currentStroke) return;
  const p = getCanvasPointFromEvent(e);
  state.currentStroke.points.push(normalizePoint(p.x, p.y));
  renderAnnotations();
  const ctx = getCurrentAnnotationCtx();
  drawStroke(ctx, state.currentStroke);
}

function endStroke() {
  if (!state.isDrawing || !state.currentStroke) return;
  const strokes = loadStrokes();
  strokes.push(state.currentStroke);
  saveStrokes(strokes);
  state.isDrawing = false;
  state.currentStroke = null;
  renderAnnotations();
}

function undoStroke() {
  const strokes = loadStrokes();
  if (!strokes.length) return;
  strokes.pop();
  saveStrokes(strokes);
  renderAnnotations();
}

function clearStrokes() {
  saveStrokes([]);
  renderAnnotations();
}

function exportAnnotatedPng() {
  if (!state.adapter) return;
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = els.canvas.width;
  exportCanvas.height = els.canvas.height;
  const ctx = exportCanvas.getContext('2d');
  ctx.drawImage(els.canvas, 0, 0);
  ctx.drawImage(els.annotationCanvas, 0, 0);
  const url = exportCanvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.docName || 'document'}-page-${state.currentPage}-annotated.png`;
  a.click();
}

async function openFile(file) {
  state.file = file;
  state.docName = file.name;
  state.currentPage = 1;
  state.zoom = 1;
  state.rotation = 0;
  state.searchResults = [];
  state.searchCursor = -1;
  state.outline = [];
  els.searchStatus.textContent = '';
  els.pageText.value = '';

  const lower = file.name.toLowerCase();

  if (lower.endsWith('.pdf')) {
    const data = await file.arrayBuffer();
    const pdfDoc = await pdfjsLib.getDocument({ data }).promise;
    state.adapter = new PDFAdapter(pdfDoc);
  } else if (/\.(png|jpe?g|webp|gif|bmp)$/i.test(lower)) {
    const url = URL.createObjectURL(file);
    const imageMeta = await loadImage(url);
    state.adapter = new ImageAdapter(url, { width: imageMeta.width, height: imageMeta.height });
  } else {
    state.adapter = new UnsupportedAdapter(file.name);
  }

  state.pageCount = state.adapter.getPageCount();
  els.pageInput.max = String(state.pageCount);
  els.pageInput.value = String(state.currentPage);

  saveRecent(file.name);
  renderRecent();
  loadNotes();
  renderBookmarks();
  renderDocInfo();
  await renderOutline();
  await renderCurrentPage();
}

async function renderCurrentPage() {
  if (!state.adapter) return;

  els.emptyState.style.display = 'none';
  await state.adapter.renderPage(state.currentPage, els.canvas, {
    zoom: state.zoom,
    rotation: state.rotation,
  });

  els.annotationCanvas.width = els.canvas.width;
  els.annotationCanvas.height = els.canvas.height;
  els.annotationCanvas.style.width = `${els.canvas.width}px`;
  els.annotationCanvas.style.height = `${els.canvas.height}px`;

  renderAnnotations();

  els.pageStatus.textContent = `Страница ${state.currentPage} / ${state.pageCount}`;
  els.zoomStatus.textContent = `${Math.round(state.zoom * 100)}%`;
  els.pageInput.value = String(state.currentPage);
}

function saveRecent(fileName) {
  const recent = JSON.parse(localStorage.getItem('novareader-recent') || '[]');
  const next = [fileName, ...recent.filter((x) => x !== fileName)].slice(0, 12);
  localStorage.setItem('novareader-recent', JSON.stringify(next));
}

function renderRecent() {
  const recent = JSON.parse(localStorage.getItem('novareader-recent') || '[]');
  els.recentList.innerHTML = '';
  recent.forEach((name) => {
    const li = document.createElement('li');
    li.className = 'recent-item';
    li.textContent = name;
    els.recentList.appendChild(li);
  });
}

function loadTheme() {
  const theme = localStorage.getItem('novareader-theme') || 'dark';
  document.body.classList.toggle('light', theme === 'light');
}

function toggleTheme() {
  const isLight = document.body.classList.toggle('light');
  localStorage.setItem('novareader-theme', isLight ? 'light' : 'dark');
}

function loadNotes() {
  els.notes.value = localStorage.getItem(noteKey()) || '';
}

function saveNotes() {
  localStorage.setItem(noteKey(), els.notes.value);
}

function exportNotes() {
  const blob = new Blob([els.notes.value], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.docName || 'notes'}.notes.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

function loadBookmarks() {
  return JSON.parse(localStorage.getItem(bookmarkKey()) || '[]');
}

function saveBookmarks(next) {
  localStorage.setItem(bookmarkKey(), JSON.stringify(next));
}

function renderBookmarks() {
  const bookmarks = loadBookmarks();
  els.bookmarkList.innerHTML = '';
  bookmarks.forEach((entry) => {
    const li = document.createElement('li');
    li.className = 'bookmark-item';
    const btn = document.createElement('button');
    btn.textContent = `Стр. ${entry.page} — ${entry.label}`;
    btn.addEventListener('click', async () => {
      state.currentPage = entry.page;
      await renderCurrentPage();
    });
    li.appendChild(btn);
    els.bookmarkList.appendChild(li);
  });
}

function addBookmark() {
  if (!state.adapter) return;
  const label = prompt('Название закладки:', `Метка ${state.currentPage}`) || `Метка ${state.currentPage}`;
  const bookmarks = loadBookmarks();
  if (!bookmarks.some((x) => x.page === state.currentPage && x.label === label)) {
    bookmarks.push({ page: state.currentPage, label });
    bookmarks.sort((a, b) => a.page - b.page);
    saveBookmarks(bookmarks);
    renderBookmarks();
  }
}

function clearBookmarks() {
  saveBookmarks([]);
  renderBookmarks();
}

function renderDocInfo() {
  if (!state.file) {
    els.docInfo.textContent = '';
    return;
  }

  const sizeMb = (state.file.size / (1024 * 1024)).toFixed(2);
  const ext = state.file.name.split('.').pop()?.toUpperCase() || 'FILE';
  els.docInfo.textContent = `${ext} • ${sizeMb} MB • ${state.pageCount} стр.`;
}

async function buildOutlineItems(items = [], level = 0) {
  if (!state.adapter || state.adapter.type !== 'pdf') return [];
  const result = [];

  for (const item of items) {
    let page = null;
    if (item.dest) {
      try {
        page = await state.adapter.resolveDestToPage(item.dest);
      } catch {
        page = null;
      }
    }

    result.push({ title: item.title || '(без названия)', page, level });

    if (item.items?.length) {
      const children = await buildOutlineItems(item.items, level + 1);
      result.push(...children);
    }
  }

  return result;
}

async function renderOutline() {
  els.outlineList.innerHTML = '';
  state.outline = [];

  if (!state.adapter || state.adapter.type !== 'pdf') {
    const li = document.createElement('li');
    li.className = 'outline-item';
    li.textContent = 'Оглавление доступно только для PDF';
    els.outlineList.appendChild(li);
    return;
  }

  const raw = await state.adapter.getOutline();
  if (!raw?.length) {
    const li = document.createElement('li');
    li.className = 'outline-item';
    li.textContent = 'В PDF нет оглавления';
    els.outlineList.appendChild(li);
    return;
  }

  state.outline = await buildOutlineItems(raw, 0);

  state.outline.forEach((entry) => {
    const li = document.createElement('li');
    li.className = 'outline-item';
    li.style.paddingLeft = `${8 + entry.level * 10}px`;
    const btn = document.createElement('button');
    btn.textContent = entry.page ? `${entry.title} (стр. ${entry.page})` : `${entry.title} (без ссылки)`;
    btn.disabled = !entry.page;
    btn.addEventListener('click', async () => {
      if (!entry.page) return;
      state.currentPage = entry.page;
      await renderCurrentPage();
    });
    li.appendChild(btn);
    els.outlineList.appendChild(li);
  });
}

async function refreshPageText() {
  if (!state.adapter || state.adapter.type !== 'pdf') {
    els.pageText.value = 'Извлечение текста доступно только для PDF';
    return;
  }

  const text = await state.adapter.getText(state.currentPage);
  els.pageText.value = text || '(На этой странице не найден текстовый слой)';
}

async function copyPageText() {
  if (!els.pageText.value) {
    await refreshPageText();
  }

  if (!els.pageText.value) return;

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(els.pageText.value);
    return;
  }

  els.pageText.focus();
  els.pageText.select();
  document.execCommand('copy');
}

function exportPageText() {
  const text = els.pageText.value || '';
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.docName || 'document'}-page-${state.currentPage}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

async function searchInPdf(query) {
  state.searchResults = [];
  state.searchCursor = -1;

  if (!query || !state.adapter || state.adapter.type !== 'pdf') {
    els.searchStatus.textContent = 'Поиск доступен только для PDF';
    return;
  }

  const normalized = query.trim().toLowerCase();
  for (let i = 1; i <= state.pageCount; i += 1) {
    const txt = (await state.adapter.getText(i)).toLowerCase();
    if (txt.includes(normalized)) state.searchResults.push(i);
  }

  if (state.searchResults.length) {
    state.searchCursor = 0;
    await jumpToSearchResult(0);
  } else {
    els.searchStatus.textContent = 'Ничего не найдено';
  }
}

async function jumpToSearchResult(index) {
  if (!state.searchResults.length) return;
  state.searchCursor = (index + state.searchResults.length) % state.searchResults.length;
  state.currentPage = state.searchResults[state.searchCursor];
  els.searchStatus.textContent = `Совпадение ${state.searchCursor + 1}/${state.searchResults.length}`;
  await renderCurrentPage();
}

function normalizePageInput() {
  const raw = Number.parseInt(els.pageInput.value, 10);
  if (Number.isNaN(raw)) return 1;
  return Math.max(1, Math.min(state.pageCount || 1, raw));
}

async function goToPage() {
  if (!state.adapter) return;
  state.currentPage = normalizePageInput();
  await renderCurrentPage();
}

async function fitWidth() {
  if (!state.adapter) return;
  const viewport = await state.adapter.getPageViewport(state.currentPage, 1, state.rotation);
  const available = Math.max(200, els.canvasWrap.clientWidth - 80);
  state.zoom = Math.max(0.3, Math.min(4, available / viewport.width));
  await renderCurrentPage();
}

async function fitPage() {
  if (!state.adapter) return;
  const viewport = await state.adapter.getPageViewport(state.currentPage, 1, state.rotation);
  const availableWidth = Math.max(200, els.canvasWrap.clientWidth - 80);
  const availableHeight = Math.max(200, els.canvasWrap.clientHeight - 80);
  state.zoom = Math.max(0.3, Math.min(4, Math.min(availableWidth / viewport.width, availableHeight / viewport.height)));
  await renderCurrentPage();
}

function downloadCurrentFile() {
  if (!state.file) return;
  const url = URL.createObjectURL(state.file);
  const a = document.createElement('a');
  a.href = url;
  a.download = state.file.name;
  a.click();
  URL.revokeObjectURL(url);
}

function printCanvasPage() {
  if (!state.adapter) return;
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = els.canvas.width;
  exportCanvas.height = els.canvas.height;
  const ctx = exportCanvas.getContext('2d');
  ctx.drawImage(els.canvas, 0, 0);
  ctx.drawImage(els.annotationCanvas, 0, 0);

  const dataUrl = exportCanvas.toDataURL('image/png');
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(`<!doctype html><title>Print</title><img src="${dataUrl}" style="width:100%;"/>`);
  win.document.close();
  win.focus();
  win.print();
}

function setupDragAndDrop() {
  ['dragenter', 'dragover'].forEach((evt) => {
    window.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
  });

  window.addEventListener('drop', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer?.files?.[0];
    if (file) await openFile(file);
  });
}

function setupAnnotationEvents() {
  const target = els.annotationCanvas;
  target.addEventListener('pointerdown', beginStroke);
  target.addEventListener('pointermove', moveStroke);
  target.addEventListener('pointerup', endStroke);
  target.addEventListener('pointerleave', endStroke);
}

els.fileInput.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  await openFile(file);
});

els.prevPage.addEventListener('click', async () => {
  if (!state.adapter || state.currentPage <= 1) return;
  state.currentPage -= 1;
  await renderCurrentPage();
});

els.nextPage.addEventListener('click', async () => {
  if (!state.adapter || state.currentPage >= state.pageCount) return;
  state.currentPage += 1;
  await renderCurrentPage();
});

els.goToPage.addEventListener('click', goToPage);
els.pageInput.addEventListener('keydown', async (e) => {
  if (e.key === 'Enter') await goToPage();
});

els.zoomIn.addEventListener('click', async () => {
  state.zoom = Math.min(4, state.zoom + 0.1);
  await renderCurrentPage();
});

els.zoomOut.addEventListener('click', async () => {
  state.zoom = Math.max(0.3, state.zoom - 0.1);
  await renderCurrentPage();
});

els.fitWidth.addEventListener('click', fitWidth);
els.fitPage.addEventListener('click', fitPage);

els.rotate.addEventListener('click', async () => {
  state.rotation = (state.rotation + 90) % 360;
  await renderCurrentPage();
});

els.saveNotes.addEventListener('click', saveNotes);
els.exportNotes.addEventListener('click', exportNotes);
els.themeToggle.addEventListener('click', toggleTheme);
els.addBookmark.addEventListener('click', addBookmark);
els.clearBookmarks.addEventListener('click', clearBookmarks);
els.downloadFile.addEventListener('click', downloadCurrentFile);
els.printPage.addEventListener('click', printCanvasPage);
els.refreshText.addEventListener('click', refreshPageText);
els.copyText.addEventListener('click', copyPageText);
els.exportText.addEventListener('click', exportPageText);
els.annotateToggle.addEventListener('click', () => setDrawMode(!state.drawEnabled));
els.undoStroke.addEventListener('click', undoStroke);
els.clearStrokes.addEventListener('click', clearStrokes);
els.exportAnnotated.addEventListener('click', exportAnnotatedPng);

els.searchBtn.addEventListener('click', async () => {
  await searchInPdf(els.searchInput.value);
});

els.searchPrev.addEventListener('click', async () => {
  await jumpToSearchResult(state.searchCursor - 1);
});

els.searchNext.addEventListener('click', async () => {
  await jumpToSearchResult(state.searchCursor + 1);
});

els.fullscreen.addEventListener('click', async () => {
  if (!document.fullscreenElement) {
    await document.documentElement.requestFullscreen();
  } else {
    await document.exitFullscreen();
  }
});

els.canvasWrap.addEventListener('wheel', async (e) => {
  if (!e.ctrlKey) return;
  e.preventDefault();
  const step = e.deltaY < 0 ? 0.08 : -0.08;
  state.zoom = Math.min(4, Math.max(0.3, state.zoom + step));
  await renderCurrentPage();
}, { passive: false });

document.addEventListener('keydown', async (e) => {
  if (e.key === 'ArrowRight') els.nextPage.click();
  if (e.key === 'ArrowLeft') els.prevPage.click();
  if (e.key === '+') els.zoomIn.click();
  if (e.key === '-') els.zoomOut.click();
  if (e.key.toLowerCase() === 'b' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    addBookmark();
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
    e.preventDefault();
    els.searchInput.focus();
  }
});

renderRecent();
loadTheme();
loadNotes();
renderBookmarks();
renderOutline();
setupDragAndDrop();
setupAnnotationEvents();
setDrawMode(false);
