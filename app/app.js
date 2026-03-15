import * as pdfjsLib from 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs';

const APP_VERSION = '1.0.0';

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
  searchResultCounts: {},
  lastSearchQuery: '',
  lastSearchScope: 'all',
  outline: [],
  drawEnabled: false,
  isDrawing: false,
  currentStroke: null,
  historyBack: [],
  historyForward: [],
  isHistoryNavigation: false,
  lastRenderedPage: null,
  readingTotalMs: 0,
  readingStartedAt: null,
  visitTrail: [],
  readingGoalPage: null,
  collabChannel: null,
  collabEnabled: false,
};

const defaultHotkeys = {
  next: 'arrowright',
  prev: 'arrowleft',
  zoomIn: '+',
  zoomOut: '-',
  annotate: 'a',
};

let hotkeys = { ...defaultHotkeys };

const els = {
  fileInput: document.getElementById('fileInput'),
  appVersion: document.getElementById('appVersion'),
  recentList: document.getElementById('recentList'),
  clearRecent: document.getElementById('clearRecent'),
  notesTitle: document.getElementById('notesTitle'),
  notesTags: document.getElementById('notesTags'),
  notes: document.getElementById('notes'),
  notesStatus: document.getElementById('notesStatus'),
  saveNotes: document.getElementById('saveNotes'),
  exportNotes: document.getElementById('exportNotes'),
  exportNotesMd: document.getElementById('exportNotesMd'),
  exportNotesJson: document.getElementById('exportNotesJson'),
  importNotesJson: document.getElementById('importNotesJson'),
  notesImportMode: document.getElementById('notesImportMode'),
  insertTimestamp: document.getElementById('insertTimestamp'),
  hkNext: document.getElementById('hkNext'),
  hkPrev: document.getElementById('hkPrev'),
  hkZoomIn: document.getElementById('hkZoomIn'),
  hkZoomOut: document.getElementById('hkZoomOut'),
  hkAnnotate: document.getElementById('hkAnnotate'),
  hkNextHint: document.getElementById('hkNextHint'),
  hkPrevHint: document.getElementById('hkPrevHint'),
  hkZoomInHint: document.getElementById('hkZoomInHint'),
  hkZoomOutHint: document.getElementById('hkZoomOutHint'),
  hkAnnotateHint: document.getElementById('hkAnnotateHint'),
  saveHotkeys: document.getElementById('saveHotkeys'),
  resetHotkeys: document.getElementById('resetHotkeys'),
  autoFixHotkeys: document.getElementById('autoFixHotkeys'),
  hotkeysStatus: document.getElementById('hotkeysStatus'),
  exportWorkspace: document.getElementById('exportWorkspace'),
  importWorkspace: document.getElementById('importWorkspace'),
  workspaceStatus: document.getElementById('workspaceStatus'),
  importOcrJson: document.getElementById('importOcrJson'),
  cloudSyncUrl: document.getElementById('cloudSyncUrl'),
  saveCloudSyncUrl: document.getElementById('saveCloudSyncUrl'),
  pushCloudSync: document.getElementById('pushCloudSync'),
  pullCloudSync: document.getElementById('pullCloudSync'),
  toggleCollab: document.getElementById('toggleCollab'),
  broadcastCollab: document.getElementById('broadcastCollab'),
  stage4Status: document.getElementById('stage4Status'),
  progressStatus: document.getElementById('progressStatus'),
  resetProgress: document.getElementById('resetProgress'),
  readingTimeStatus: document.getElementById('readingTimeStatus'),
  resetReadingTime: document.getElementById('resetReadingTime'),
  etaStatus: document.getElementById('etaStatus'),
  readingGoalPage: document.getElementById('readingGoalPage'),
  saveReadingGoal: document.getElementById('saveReadingGoal'),
  clearReadingGoal: document.getElementById('clearReadingGoal'),
  readingGoalStatus: document.getElementById('readingGoalStatus'),
  visitTrailList: document.getElementById('visitTrailList'),
  clearVisitTrail: document.getElementById('clearVisitTrail'),
  docStats: document.getElementById('docStats'),
  searchHistoryList: document.getElementById('searchHistoryList'),
  clearSearchHistory: document.getElementById('clearSearchHistory'),
  exportSearchHistory: document.getElementById('exportSearchHistory'),
  exportSearchHistoryTxt: document.getElementById('exportSearchHistoryTxt'),
  copySearchHistory: document.getElementById('copySearchHistory'),
  importSearchHistoryJson: document.getElementById('importSearchHistoryJson'),
  searchResultsList: document.getElementById('searchResultsList'),
  clearSearchResults: document.getElementById('clearSearchResults'),
  exportSearchResults: document.getElementById('exportSearchResults'),
  exportSearchResultsCsv: document.getElementById('exportSearchResultsCsv'),
  exportSearchSummaryTxt: document.getElementById('exportSearchSummaryTxt'),
  importSearchResultsJson: document.getElementById('importSearchResultsJson'),
  importSearchResultsCsv: document.getElementById('importSearchResultsCsv'),
  copySearchResults: document.getElementById('copySearchResults'),
  historyBack: document.getElementById('historyBack'),
  historyForward: document.getElementById('historyForward'),
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
  searchScope: document.getElementById('searchScope'),
  searchBtn: document.getElementById('searchBtn'),
  searchPrev: document.getElementById('searchPrev'),
  searchNext: document.getElementById('searchNext'),
  searchStatus: document.getElementById('searchStatus'),
  importDjvuDataJson: document.getElementById('importDjvuDataJson'),
  themeToggle: document.getElementById('themeToggle'),
  fullscreen: document.getElementById('fullscreen'),
  shortcutsHelp: document.getElementById('shortcutsHelp'),
  canvasWrap: document.getElementById('canvasWrap'),
  addBookmark: document.getElementById('addBookmark'),
  clearBookmarks: document.getElementById('clearBookmarks'),
  exportBookmarks: document.getElementById('exportBookmarks'),
  importBookmarks: document.getElementById('importBookmarks'),
  bookmarkFilter: document.getElementById('bookmarkFilter'),
  clearBookmarkFilter: document.getElementById('clearBookmarkFilter'),
  bookmarksStatus: document.getElementById('bookmarksStatus'),
  bookmarkList: document.getElementById('bookmarkList'),
  outlineList: document.getElementById('outlineList'),
  pagePreviewList: document.getElementById('pagePreviewList'),
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
  exportAnnJson: document.getElementById('exportAnnJson'),
  importAnnJson: document.getElementById('importAnnJson'),
  exportAnnBundle: document.getElementById('exportAnnBundle'),
  importAnnBundle: document.getElementById('importAnnBundle'),
  annStats: document.getElementById('annStats'),
  commentList: document.getElementById('commentList'),
  clearComments: document.getElementById('clearComments'),
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

class DjVuAdapter {
  constructor(fileName, data = null) {
    this.fileName = fileName;
    this.type = 'djvu';
    this.setData(data);
  }

  setData(data) {
    const pagesText = Array.isArray(data?.pagesText)
      ? data.pagesText.map((x) => (typeof x === 'string' ? x : ''))
      : [];
    const pagesImages = Array.isArray(data?.pagesImages)
      ? data.pagesImages.map((x) => (typeof x === 'string' ? x : ''))
      : [];
    const pageSizes = Array.isArray(data?.pageSizes)
      ? data.pageSizes.map((x) => ({
        width: Number(x?.width) > 0 ? Number(x.width) : null,
        height: Number(x?.height) > 0 ? Number(x.height) : null,
      }))
      : [];

    this.pagesText = pagesText;
    this.pagesImages = pagesImages;
    this.pageSizes = pageSizes;
    const inferredCount = Math.max(pagesText.length, pagesImages.length, pageSizes.length, 1);
    this.pageCount = Number.isInteger(data?.pageCount) && data.pageCount > 0
      ? Math.max(data.pageCount, inferredCount)
      : inferredCount;
    this.outline = Array.isArray(data?.outline) ? data.outline : [];
  }

  exportData() {
    return {
      pageCount: this.pageCount,
      pagesText: this.pagesText,
      pagesImages: this.pagesImages,
      pageSizes: this.pageSizes,
      outline: this.outline,
    };
  }

  getPageCount() {
    return this.pageCount;
  }

  async getPageViewport(pageNumber, scale, rotation) {
    const size = this.pageSizes[pageNumber - 1] || {};
    const baseW = Number(size.width) > 0 ? Number(size.width) : 1200;
    const baseH = Number(size.height) > 0 ? Number(size.height) : 1600;
    const w = baseW * scale;
    const h = baseH * scale;
    if (rotation % 180 === 0) return { width: w, height: h };
    return { width: h, height: w };
  }

  async renderPage(pageNumber, canvas, { zoom, rotation }) {
    const imageUrl = this.pagesImages[pageNumber - 1];
    if (imageUrl) {
      const img = await loadImage(imageUrl);
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
      return;
    }

    const viewport = await this.getPageViewport(pageNumber, zoom, rotation);
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#10141b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#f8fafc';
    ctx.font = '24px sans-serif';
    ctx.fillText('DjVuAdapter (stage 2)', 40, 70);
    ctx.fillStyle = '#9aa6b8';
    ctx.font = '16px sans-serif';
    ctx.fillText(`Файл: ${this.fileName}`, 40, 105);
    ctx.fillText(`Страница: ${pageNumber}/${this.pageCount}`, 40, 132);
    const txt = (this.pagesText[pageNumber - 1] || '').trim();
    ctx.fillText(txt ? 'Текстовый слой: загружен' : 'Текстовый слой: не загружен', 40, 159);
    ctx.fillText('Импортируйте DjVu data JSON для рендера страниц/поиска.', 40, 186);
  }

  async getText(pageNumber) {
    return this.pagesText[pageNumber - 1] || '';
  }

  async getOutline() {
    return this.outline;
  }

  async resolveDestToPage(dest) {
    const n = Number(dest);
    if (!Number.isInteger(n) || n < 1 || n > this.pageCount) return null;
    return n;
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

function canSearchCurrentDoc() {
  return !!(state.adapter && (state.adapter.type === 'pdf' || state.adapter.type === 'djvu'));
}

function djvuTextKey() {
  return `novareader-djvu-data:${state.docName || 'global'}`;
}

function loadDjvuData() {
  try {
    const raw = localStorage.getItem(djvuTextKey());
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveDjvuData(payload) {
  localStorage.setItem(djvuTextKey(), JSON.stringify(payload));
}

function searchScopeKey() {
  return 'novareader-search-scope';
}

function loadSearchScope() {
  const scope = localStorage.getItem(searchScopeKey());
  if (scope === 'current' || scope === 'all') {
    els.searchScope.value = scope;
  } else {
    els.searchScope.value = 'all';
  }
}

function saveSearchScope() {
  const scope = els.searchScope.value === 'current' ? 'current' : 'all';
  localStorage.setItem(searchScopeKey(), scope);
}

function noteKey() {
  return `novareader-notes:${state.docName || 'global'}`;
}

function bookmarkKey() {
  return `novareader-bookmarks:${state.docName || 'global'}`;
}

function viewStateKey() {
  return `novareader-view:${state.docName || 'global'}`;
}

function readingTimeKey() {
  return `novareader-reading-time:${state.docName || 'global'}`;
}

function searchHistoryKey() {
  return `novareader-search-history:${state.docName || 'global'}`;
}

function readingGoalKey() {
  return `novareader-reading-goal:${state.docName || 'global'}`;
}

function annotationKey(page) {
  return `novareader-annotations:${state.docName || 'global'}:${page}`;
}

function commentKey(page) {
  return `novareader-comments:${state.docName || 'global'}:${page}`;
}

function getCurrentAnnotationCtx() {
  return els.annotationCanvas.getContext('2d');
}

function loadStrokes(page = state.currentPage) {
  return JSON.parse(localStorage.getItem(annotationKey(page)) || '[]');
}

function saveStrokes(strokes, page = state.currentPage) {
  localStorage.setItem(annotationKey(page), JSON.stringify(strokes));
  renderDocStats();
  renderReadingGoalStatus();
  renderEtaStatus();
}


function loadComments(page = state.currentPage) {
  return JSON.parse(localStorage.getItem(commentKey(page)) || '[]');
}

function saveComments(comments, page = state.currentPage) {
  localStorage.setItem(commentKey(page), JSON.stringify(comments));
  renderDocStats();
  renderEtaStatus();
}

function clearDocumentCommentStorage() {
  if (!state.pageCount) return;
  for (let page = 1; page <= state.pageCount; page += 1) {
    localStorage.removeItem(commentKey(page));
  }
}

function renderCommentList() {
  const comments = loadComments();
  els.commentList.innerHTML = '';

  if (!comments.length) {
    const li = document.createElement('li');
    li.className = 'recent-item';
    li.textContent = 'Нет комментариев';
    els.commentList.appendChild(li);
    return;
  }

  comments.forEach((comment, idx) => {
    const li = document.createElement('li');
    li.className = 'recent-item';

    const text = document.createElement('div');
    text.textContent = `${idx + 1}. ${comment.text}`;
    li.appendChild(text);

    const actions = document.createElement('div');
    actions.className = 'inline-actions';

    const del = document.createElement('button');
    del.textContent = 'Удалить';
    del.addEventListener('click', () => {
      const next = loadComments().filter((_, i) => i !== idx);
      saveComments(next);
      renderAnnotations();
      renderCommentList();
    });

    actions.appendChild(del);
    li.appendChild(actions);
    els.commentList.appendChild(li);
  });
}


function clearDocumentAnnotationStorage() {
  if (!state.pageCount) return;
  for (let page = 1; page <= state.pageCount; page += 1) {
    localStorage.removeItem(annotationKey(page));
  }
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

  if (stroke.tool === 'rect') {
    const end = denormalizePoint(stroke.points[stroke.points.length - 1]);
    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);
    const w = Math.abs(end.x - start.x);
    const h = Math.abs(end.y - start.y);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.size;
    ctx.strokeRect(x, y, w, h);
    ctx.restore();
    return;
  }

  if (stroke.tool === 'arrow') {
    const end = denormalizePoint(stroke.points[stroke.points.length - 1]);
    const headLen = Math.max(10, stroke.size * 2);
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.size;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(end.x - headLen * Math.cos(angle - Math.PI / 6), end.y - headLen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(end.x - headLen * Math.cos(angle + Math.PI / 6), end.y - headLen * Math.sin(angle + Math.PI / 6));
    ctx.lineTo(end.x, end.y);
    ctx.fillStyle = stroke.color;
    ctx.fill();
    ctx.restore();
    return;
  }

  if (stroke.tool === 'line') {
    const end = denormalizePoint(stroke.points[stroke.points.length - 1]);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.size;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (stroke.tool === 'circle') {
    const end = denormalizePoint(stroke.points[stroke.points.length - 1]);
    const cx = (start.x + end.x) / 2;
    const cy = (start.y + end.y) / 2;
    const rx = Math.abs(end.x - start.x) / 2;
    const ry = Math.abs(end.y - start.y) / 2;
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.size;
    ctx.beginPath();
    if (typeof ctx.ellipse === 'function') {
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    } else {
      const r = Math.max(rx, ry);
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
    }
    ctx.stroke();
    ctx.restore();
    return;
  }

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
  const comments = loadComments();

  strokes.forEach((stroke) => drawStroke(ctx, stroke));

  comments.forEach((comment, idx) => {
    const p = denormalizePoint(comment.point);
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#1d6fe9';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(idx + 1), p.x, p.y);
    ctx.restore();
  });

  els.annStats.textContent = `Штрихов: ${strokes.length} • Комментариев: ${comments.length}`;
}

function getCanvasPointFromEvent(e) {
  const rect = els.annotationCanvas.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * els.annotationCanvas.width;
  const y = ((e.clientY - rect.top) / rect.height) * els.annotationCanvas.height;
  return { x, y };
}

function beginStroke(e) {
  if (!state.drawEnabled || !state.adapter) return;
  const p = getCanvasPointFromEvent(e);
  const point = normalizePoint(p.x, p.y);

  if (els.drawTool.value === 'comment') {
    const text = prompt('Текст комментария:');
    if (!text) return;
    const comments = loadComments();
    comments.push({ point, text: text.trim() });
    saveComments(comments);
    renderAnnotations();
    renderCommentList();
    return;
  }

  state.isDrawing = true;
  const shapeTool = ['rect', 'arrow', 'line', 'circle'].includes(els.drawTool.value);
  state.currentStroke = {
    tool: els.drawTool.value,
    color: els.drawColor.value,
    size: Number(els.drawSize.value),
    points: shapeTool ? [point, point] : [point],
  };
  renderAnnotations();
  const ctx = getCurrentAnnotationCtx();
  drawStroke(ctx, state.currentStroke);
}

function moveStroke(e) {
  if (!state.isDrawing || !state.currentStroke) return;
  const p = getCanvasPointFromEvent(e);
  const point = normalizePoint(p.x, p.y);

  if (['rect', 'arrow', 'line', 'circle'].includes(state.currentStroke.tool)) {
    state.currentStroke.points[1] = point;
  } else {
    state.currentStroke.points.push(point);
  }

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

function clearComments() {
  saveComments([]);
  renderAnnotations();
  renderCommentList();
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


function exportAnnotationsJson() {
  if (!state.adapter) return;
  const payload = {
    app: 'NovaReader',
    version: 1,
    docName: state.docName,
    page: state.currentPage,
    strokes: loadStrokes(),
    comments: loadComments(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.docName || 'document'}-page-${state.currentPage}-annotations.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function importAnnotationsJson(file) {
  if (!state.adapter || !file) return;

  try {
    const raw = await file.text();
    const payload = JSON.parse(raw);
    if (!payload || !Array.isArray(payload.strokes)) {
      throw new Error('bad payload');
    }

    const normalized = payload.strokes.filter((stroke) => (
      stroke && ['pen', 'highlighter', 'eraser', 'rect', 'arrow', 'line', 'circle'].includes(stroke.tool)
      && typeof stroke.size === 'number'
      && Array.isArray(stroke.points)
    ));

    const comments = Array.isArray(payload.comments) ? payload.comments.filter((x) => x && x.point && typeof x.text === 'string') : [];
    saveStrokes(normalized);
    saveComments(comments);
    renderAnnotations();
    renderCommentList();
  } catch {
    alert('Не удалось импортировать JSON аннотаций. Проверьте формат файла.');
  }
}

function showShortcutsHelp() {
  alert([
    'Горячие клавиши NovaReader:',
    `След/пред страница — ${hotkeys.next} / ${hotkeys.prev}`,
    `Zoom +/- — ${hotkeys.zoomIn} / ${hotkeys.zoomOut}`,
    'Ctrl/Cmd + F — фокус на поиск',
    'Ctrl/Cmd + B — добавить закладку',
    `Аннотации toggle — ${hotkeys.annotate}`,
    'Ctrl/Cmd + Z — undo последнего штриха',
    'Esc — выключить режим аннотаций',
    'Инструменты: Перо/Маркер/Ластик/Комментарий/Прямоугольник/Стрелка',
  ].join('\n'));
}


function exportAnnotationBundleJson() {
  if (!state.adapter) return;
  const pages = {};
  for (let page = 1; page <= state.pageCount; page += 1) {
    const strokes = loadStrokes(page);
    const comments = loadComments(page);
    if (strokes.length || comments.length) {
      pages[String(page)] = { strokes, comments };
    }
  }

  const payload = {
    app: 'NovaReader',
    version: 1,
    docName: state.docName,
    pageCount: state.pageCount,
    pages,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.docName || 'document'}-annotations-bundle.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function importAnnotationBundleJson(file) {
  if (!state.adapter || !file) return;
  try {
    const raw = await file.text();
    const payload = JSON.parse(raw);
    if (!payload || typeof payload.pages !== 'object') {
      throw new Error('bad bundle');
    }

    clearDocumentAnnotationStorage();
    clearDocumentCommentStorage();

    Object.entries(payload.pages).forEach(([pageRaw, entry]) => {
      const page = Number.parseInt(pageRaw, 10);
      const strokes = Array.isArray(entry) ? entry : entry?.strokes;
      const comments = Array.isArray(entry?.comments) ? entry.comments : [];
      if (!Number.isInteger(page) || page < 1 || page > state.pageCount || !Array.isArray(strokes)) {
        return;
      }
      const normalized = strokes.filter((stroke) => (
        stroke && ['pen', 'highlighter', 'eraser', 'rect', 'arrow', 'line', 'circle'].includes(stroke.tool)
        && typeof stroke.size === 'number'
        && Array.isArray(stroke.points)
      ));
      const normalizedComments = comments.filter((x) => x && x.point && typeof x.text === 'string');
      saveStrokes(normalized, page);
      saveComments(normalizedComments, page);
    });

    renderAnnotations();
    renderCommentList();
  } catch {
    alert('Не удалось импортировать bundle JSON аннотаций. Проверьте формат файла.');
  }
}


function setWorkspaceStatus(message, type = '') {
  els.workspaceStatus.textContent = message;
  els.workspaceStatus.classList.remove('error', 'success');
  if (type) {
    els.workspaceStatus.classList.add(type);
  }
}

function setStage4Status(message, type = '') {
  if (!els.stage4Status) return;
  els.stage4Status.textContent = message;
  els.stage4Status.classList.remove('error', 'success');
  if (type) {
    els.stage4Status.classList.add(type);
  }
}

function initReleaseGuards() {
  if (els.appVersion) {
    els.appVersion.textContent = `Version: ${APP_VERSION}`;
  }

  if (typeof fetch !== 'function') {
    els.pushCloudSync.disabled = true;
    els.pullCloudSync.disabled = true;
    setStage4Status('Cloud sync недоступен: fetch API отсутствует.', 'error');
  }

  if (typeof BroadcastChannel !== 'function') {
    els.toggleCollab.disabled = true;
    els.broadcastCollab.disabled = true;
    setStage4Status('Collaboration недоступна: BroadcastChannel отсутствует.', 'error');
  }
}

function cloudSyncUrlKey() {
  return 'novareader-cloud-sync-url';
}

function loadCloudSyncUrl() {
  const saved = localStorage.getItem(cloudSyncUrlKey());
  if (saved) return saved;
  if (typeof location !== 'undefined') {
    const isHttp = location.protocol === 'http:' || location.protocol === 'https:';
    if (isHttp && location.origin) {
      return `${location.origin}/api/workspace`;
    }
  }
  return '';
}

function saveCloudSyncUrl() {
  const value = (els.cloudSyncUrl.value || '').trim();
  localStorage.setItem(cloudSyncUrlKey(), value);
  setStage4Status(value ? 'Cloud URL сохранён.' : 'Cloud URL очищен.', 'success');
}

function ocrTextKey() {
  return `novareader-ocr-text:${state.docName || 'global'}`;
}

function loadOcrTextData() {
  try {
    const raw = localStorage.getItem(ocrTextKey());
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveOcrTextData(payload) {
  localStorage.setItem(ocrTextKey(), JSON.stringify(payload));
}


function buildWorkspacePayload() {
  const pages = {};
  for (let page = 1; page <= state.pageCount; page += 1) {
    const strokes = loadStrokes(page);
    const comments = loadComments(page);
    if (strokes.length || comments.length) {
      pages[String(page)] = { strokes, comments };
    }
  }

  return {
    app: 'NovaReader',
    type: 'workspace-backup',
    version: 1,
    docName: state.docName,
    pageCount: state.pageCount,
    exportedAt: new Date().toISOString(),
    notes: getNotesModel(),
    bookmarks: loadBookmarks(),
    hotkeys,
    theme: localStorage.getItem('novareader-theme') || 'dark',
    pages,
    ocrText: loadOcrTextData(),
  };
}

async function applyWorkspacePayload(payload, { skipConfirm = false } = {}) {
  if (!payload || typeof payload !== 'object' || payload.type !== 'workspace-backup') {
    throw new Error('bad workspace payload');
  }

  const sourceDoc = payload.docName || 'unknown';
  if (!skipConfirm && payload.docName && payload.docName !== state.docName) {
    const proceed = confirm(`Backup создан для «${sourceDoc}». Импортировать в «${state.docName}»?`);
    if (!proceed) {
      setWorkspaceStatus('Импорт отменён пользователем.');
      return false;
    }
  }

  const normalizedNotes = normalizeImportedNotes(payload.notes);
  els.notesTitle.value = normalizedNotes.title;
  els.notesTags.value = normalizedNotes.tags;
  els.notes.value = normalizedNotes.body;
  saveNotes('manual');

  const bookmarks = Array.isArray(payload.bookmarks)
    ? payload.bookmarks.filter((x) => Number.isInteger(x?.page) && x.page >= 1 && x.page <= state.pageCount)
    : [];
  saveBookmarks(bookmarks);
  renderBookmarks();
  setBookmarksStatus('');

  if (payload.hotkeys && typeof payload.hotkeys === 'object') {
    const candidate = {
      next: normalizeHotkey(payload.hotkeys.next, defaultHotkeys.next),
      prev: normalizeHotkey(payload.hotkeys.prev, defaultHotkeys.prev),
      zoomIn: normalizeHotkey(payload.hotkeys.zoomIn, defaultHotkeys.zoomIn),
      zoomOut: normalizeHotkey(payload.hotkeys.zoomOut, defaultHotkeys.zoomOut),
      annotate: normalizeHotkey(payload.hotkeys.annotate, defaultHotkeys.annotate),
    };
    const validation = validateHotkeys(candidate);
    if (validation.ok) {
      hotkeys = candidate;
      localStorage.setItem('novareader-hotkeys', JSON.stringify(hotkeys));
      renderHotkeyInputs();
      setHotkeysInputErrors([]);
      setHotkeysStatus('Hotkeys импортированы из backup.', 'success');
    }
  }

  if (payload.theme === 'light' || payload.theme === 'dark') {
    localStorage.setItem('novareader-theme', payload.theme);
    document.body.classList.toggle('light', payload.theme === 'light');
  }

  if (payload.ocrText && typeof payload.ocrText === 'object') {
    saveOcrTextData(payload.ocrText);
  }

  clearDocumentAnnotationStorage();
  clearDocumentCommentStorage();
  const pages = payload.pages && typeof payload.pages === 'object' ? payload.pages : {};
  Object.entries(pages).forEach(([pageRaw, entry]) => {
    const page = Number.parseInt(pageRaw, 10);
    const strokes = Array.isArray(entry?.strokes) ? entry.strokes : [];
    const comments = Array.isArray(entry?.comments) ? entry.comments : [];
    if (!Number.isInteger(page) || page < 1 || page > state.pageCount) return;
    const normalizedStrokes = strokes.filter((stroke) => (
      stroke && ['pen', 'highlighter', 'eraser', 'rect', 'arrow', 'line', 'circle'].includes(stroke.tool)
      && typeof stroke.size === 'number'
      && Array.isArray(stroke.points)
    ));
    const normalizedComments = comments.filter((x) => x && x.point && typeof x.text === 'string');
    saveStrokes(normalizedStrokes, page);
    saveComments(normalizedComments, page);
  });

  renderAnnotations();
  renderCommentList();
  return true;
}

async function pushWorkspaceToCloud() {
  if (!state.adapter) {
    setStage4Status('Сначала откройте документ.', 'error');
    return;
  }
  const endpoint = (els.cloudSyncUrl.value || '').trim();
  if (!endpoint) {
    setStage4Status('Укажите Cloud endpoint URL.', 'error');
    return;
  }

  const payload = buildWorkspacePayload();
  const response = await fetch(endpoint, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`push failed: ${response.status}`);
  }
  setStage4Status('Workspace отправлен в cloud.', 'success');
}

async function pullWorkspaceFromCloud() {
  if (!state.adapter) {
    setStage4Status('Сначала откройте документ.', 'error');
    return;
  }
  const endpoint = (els.cloudSyncUrl.value || '').trim();
  if (!endpoint) {
    setStage4Status('Укажите Cloud endpoint URL.', 'error');
    return;
  }

  const response = await fetch(endpoint, { method: 'GET' });
  if (!response.ok) {
    throw new Error(`pull failed: ${response.status}`);
  }
  const payload = await response.json();
  const ok = await applyWorkspacePayload(payload, { skipConfirm: true });
  if (ok) {
    setWorkspaceStatus('Workspace подтянут из cloud.', 'success');
    setStage4Status('Cloud pull завершён.', 'success');
  }
}

function collabChannelName() {
  return `novareader-collab:${state.docName || 'global'}`;
}

function broadcastWorkspaceSnapshot(reason = 'manual') {
  if (!state.collabEnabled || !state.collabChannel) return;
  state.collabChannel.postMessage({
    type: 'workspace-sync',
    reason,
    payload: buildWorkspacePayload(),
    at: Date.now(),
  });
  setStage4Status(`Snapshot отправлен (${reason}).`, 'success');
}

function toggleCollaborationChannel() {
  if (!state.adapter) {
    setStage4Status('Сначала откройте документ.', 'error');
    return;
  }

  if (state.collabEnabled) {
    state.collabEnabled = false;
    if (state.collabChannel) {
      state.collabChannel.close();
      state.collabChannel = null;
    }
    els.toggleCollab.textContent = 'Collab: off';
    setStage4Status('Collab выключен.');
    return;
  }

  state.collabChannel = new BroadcastChannel(collabChannelName());
  state.collabChannel.onmessage = async (e) => {
    const msg = e.data;
    if (!msg || msg.type !== 'workspace-sync' || !msg.payload) return;
    try {
      const ok = await applyWorkspacePayload(msg.payload, { skipConfirm: true });
      if (ok) {
        setWorkspaceStatus('Workspace получен из collab-канала.', 'success');
        setStage4Status('Collab snapshot применён.', 'success');
      }
    } catch {
      setStage4Status('Ошибка применения collab snapshot.', 'error');
    }
  };
  state.collabEnabled = true;
  els.toggleCollab.textContent = 'Collab: on';
  setStage4Status('Collab включен.', 'success');
}

async function importOcrJson(file) {
  if (!state.adapter || !file) {
    setStage4Status('Сначала откройте документ.', 'error');
    return;
  }
  try {
    const raw = await file.text();
    const payload = JSON.parse(raw);
    const pagesText = Array.isArray(payload?.pagesText)
      ? payload.pagesText.map((x) => (typeof x === 'string' ? x : ''))
      : [];
    if (!pagesText.length) {
      setStage4Status('OCR JSON: нет pagesText.', 'error');
      return;
    }
    const normalized = {
      pageCount: Math.max(state.pageCount, pagesText.length),
      pagesText,
      importedAt: new Date().toISOString(),
      source: payload?.source || 'ocr-import',
    };
    saveOcrTextData(normalized);
    if (state.adapter.type === 'djvu' && typeof state.adapter.setData === 'function') {
      state.adapter.setData({ ...state.adapter.exportData(), pagesText: normalized.pagesText, pageCount: normalized.pageCount });
      state.pageCount = state.adapter.getPageCount();
      els.pageInput.max = String(state.pageCount);
      await renderPagePreviews();
      await renderCurrentPage();
    }
    setStage4Status('OCR JSON импортирован.', 'success');
  } catch {
    setStage4Status('Ошибка импорта OCR JSON.', 'error');
  }
}

function exportWorkspaceBundleJson() {
  if (!state.adapter) {
    setWorkspaceStatus('Сначала откройте документ.', 'error');
    return;
  }

  const payload = buildWorkspacePayload();

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.docName || 'document'}-workspace-backup.json`;
  a.click();
  URL.revokeObjectURL(url);
  setWorkspaceStatus('Workspace экспортирован.', 'success');
}

async function importWorkspaceBundleJson(file) {
  if (!state.adapter || !file) {
    setWorkspaceStatus('Сначала откройте документ.', 'error');
    return;
  }

  try {
    const raw = await file.text();
    const payload = JSON.parse(raw);
    const ok = await applyWorkspacePayload(payload);
    if (ok) {
      setWorkspaceStatus('Workspace импортирован.', 'success');
    }
  } catch {
    setWorkspaceStatus('Ошибка импорта workspace backup.', 'error');
  }
}








function buildSearchResultsSummaryText() {
  const rows = state.searchResults.map((page, idx) => {
    const count = state.searchResultCounts[page] || 0;
    return `${idx + 1}. Страница ${page}${count ? ` — ${count} совп.` : ''}`;
  });
  const scopeLabel = state.lastSearchScope === 'page' ? 'текущая страница' : 'весь документ';
  const header = [
    `Документ: ${state.docName || 'document'}`,
    `Запрос: ${state.lastSearchQuery || '—'}`,
    `Область: ${scopeLabel}`,
    `Результатов: ${state.searchResults.length}`,
  ];
  return `${header.join('\n')}\n\n${rows.join('\n')}`;
}

async function copySearchResultsSummary() {
  if (!canSearchCurrentDoc()) {
    els.searchStatus.textContent = 'Копирование доступно для PDF/DjVu';
    return;
  }
  if (!state.searchResults.length) {
    els.searchStatus.textContent = 'Нет результатов для копирования';
    return;
  }

  const text = buildSearchResultsSummaryText();

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    els.searchStatus.textContent = `Скопировано результатов: ${state.searchResults.length}`;
  } catch {
    els.searchStatus.textContent = 'Не удалось скопировать список';
  }
}

function exportSearchResultsSummaryTxt() {
  if (!canSearchCurrentDoc()) {
    els.searchStatus.textContent = 'Экспорт доступен для PDF/DjVu';
    return;
  }
  if (!state.searchResults.length) {
    els.searchStatus.textContent = 'Нет результатов для экспорта';
    return;
  }

  const text = buildSearchResultsSummaryText();
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.docName || 'document'}-search-results-summary.txt`;
  a.click();
  URL.revokeObjectURL(url);

  els.searchStatus.textContent = `Summary экспортирован: ${state.searchResults.length}`;
}

function exportSearchResultsCsv() {
  if (!canSearchCurrentDoc()) {
    els.searchStatus.textContent = 'Экспорт доступен для PDF/DjVu';
    return;
  }

  if (!state.searchResults.length) {
    els.searchStatus.textContent = 'Нет результатов для экспорта';
    return;
  }

  const escapeCsv = (value) => `"${String(value).replaceAll('"', '""')}"`;
  const header = ['index', 'page', 'matches', 'query', 'scope'];
  const rows = state.searchResults.map((page, idx) => {
    const matches = state.searchResultCounts[page] || 0;
    return [
      idx + 1,
      page,
      matches,
      state.lastSearchQuery || '',
      state.lastSearchScope,
    ];
  });

  const csv = [
    header.join(','),
    ...rows.map((row) => row.map(escapeCsv).join(',')),
  ].join('
');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.docName || 'document'}-search-results.csv`;
  a.click();
  URL.revokeObjectURL(url);

  els.searchStatus.textContent = `CSV экспортирован: ${rows.length}`;
}

function exportSearchResultsJson() {
  if (!canSearchCurrentDoc()) {
    els.searchStatus.textContent = 'Экспорт доступен для PDF/DjVu';
    return;
  }

  if (!state.searchResults.length) {
    els.searchStatus.textContent = 'Нет результатов для экспорта';
    return;
  }

  const rows = state.searchResults.map((page, idx) => ({
    index: idx + 1,
    page,
    matches: state.searchResultCounts[page] || 0,
  }));

  const payload = {
    app: 'NovaReader',
    version: 1,
    docName: state.docName,
    exportedAt: new Date().toISOString(),
    query: state.lastSearchQuery,
    scope: state.lastSearchScope,
    totalResults: rows.length,
    rows,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.docName || 'document'}-search-results.json`;
  a.click();
  URL.revokeObjectURL(url);
  els.searchStatus.textContent = `Экспортировано результатов: ${rows.length}`;
}

async function importSearchResultsJson(file) {
  if (!canSearchCurrentDoc()) {
    els.searchStatus.textContent = 'Импорт доступен для PDF/DjVu';
    return;
  }

  try {
    const raw = await file.text();
    const payload = JSON.parse(raw);
    const rows = Array.isArray(payload?.rows) ? payload.rows : [];
    const pages = rows
      .map((row) => Number(row?.page))
      .filter((page) => Number.isInteger(page) && page >= 1 && page <= state.pageCount);

    if (!pages.length) {
      els.searchStatus.textContent = 'Нет валидных результатов в JSON';
      return;
    }

    const uniquePages = [...new Set(pages)].sort((a, b) => a - b);
    state.searchResults = uniquePages;
    state.searchCursor = 0;
    state.searchResultCounts = {};

    rows.forEach((row) => {
      const page = Number(row?.page);
      const matches = Number(row?.matches);
      if (Number.isInteger(page) && page >= 1 && page <= state.pageCount && Number.isFinite(matches) && matches >= 0) {
        state.searchResultCounts[page] = Math.floor(matches);
      }
    });

    state.lastSearchQuery = typeof payload?.query === 'string' ? payload.query : '';
    state.lastSearchScope = payload?.scope === 'page' ? 'page' : 'all';

    els.searchInput.value = state.lastSearchQuery;
    els.searchScope.value = state.lastSearchScope;
    saveSearchScope();

    renderSearchResultsList();
    els.searchStatus.textContent = `Импортировано результатов: ${state.searchResults.length}`;
  } catch {
    els.searchStatus.textContent = 'Ошибка импорта результатов поиска';
  }
}

function parseCsvLine(line) {
  const cells = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      cells.push(current);
      current = '';
    } else {
      current += ch;
    }
  }

  cells.push(current);
  return cells.map((x) => x.trim());
}

async function importSearchResultsCsv(file) {
  if (!canSearchCurrentDoc()) {
    els.searchStatus.textContent = 'Импорт доступен для PDF/DjVu';
    return;
  }

  try {
    const raw = await file.text();
    const lines = raw
      .split(/
?
/)
      .map((x) => x.trim())
      .filter(Boolean);

    if (lines.length < 2) {
      els.searchStatus.textContent = 'CSV не содержит данных';
      return;
    }

    const header = parseCsvLine(lines[0]).map((x) => x.toLowerCase());
    const pageIdx = header.indexOf('page');
    const matchesIdx = header.indexOf('matches');
    const queryIdx = header.indexOf('query');
    const scopeIdx = header.indexOf('scope');

    if (pageIdx === -1) {
      els.searchStatus.textContent = 'CSV должен содержать колонку page';
      return;
    }

    const parsedRows = lines.slice(1).map((line) => parseCsvLine(line));
    const pages = parsedRows
      .map((row) => Number(row[pageIdx]))
      .filter((page) => Number.isInteger(page) && page >= 1 && page <= state.pageCount);

    if (!pages.length) {
      els.searchStatus.textContent = 'Нет валидных страниц в CSV';
      return;
    }

    const uniquePages = [...new Set(pages)].sort((a, b) => a - b);
    state.searchResults = uniquePages;
    state.searchCursor = 0;
    state.searchResultCounts = {};

    if (matchesIdx !== -1) {
      parsedRows.forEach((row) => {
        const page = Number(row[pageIdx]);
        const matches = Number(row[matchesIdx]);
        if (Number.isInteger(page) && page >= 1 && page <= state.pageCount && Number.isFinite(matches) && matches >= 0) {
          state.searchResultCounts[page] = Math.floor(matches);
        }
      });
    }

    if (queryIdx !== -1) {
      state.lastSearchQuery = parsedRows[0]?.[queryIdx] || '';
    }
    if (scopeIdx !== -1) {
      state.lastSearchScope = parsedRows[0]?.[scopeIdx] === 'page' ? 'page' : 'all';
    }

    els.searchInput.value = state.lastSearchQuery || '';
    els.searchScope.value = state.lastSearchScope || 'all';
    saveSearchScope();

    renderSearchResultsList();
    els.searchStatus.textContent = `Импортировано из CSV: ${state.searchResults.length}`;
  } catch {
    els.searchStatus.textContent = 'Ошибка импорта CSV';
  }
}

async function importDjvuDataJson(file) {
  if (!state.adapter || state.adapter.type !== 'djvu') {
    els.searchStatus.textContent = 'Импорт DjVu data доступен только для DjVu';
    return;
  }

  try {
    const raw = await file.text();
    const payload = JSON.parse(raw);
    state.adapter.setData(payload);
    saveDjvuData(state.adapter.exportData());
    state.pageCount = state.adapter.getPageCount();
    els.pageInput.max = String(state.pageCount);
    if (state.currentPage > state.pageCount) {
      state.currentPage = state.pageCount;
      els.pageInput.value = String(state.currentPage);
    }
    await renderOutline();
    await renderPagePreviews();
    await renderCurrentPage();
    els.searchStatus.textContent = 'DjVu data JSON импортирован';
  } catch {
    els.searchStatus.textContent = 'Ошибка импорта DjVu data JSON';
  }
}

function clearSearchResults() {
  state.searchResults = [];
  state.searchCursor = -1;
  state.searchResultCounts = {};
  state.lastSearchQuery = '';
  state.lastSearchScope = 'all';
  els.searchStatus.textContent = '';
  renderSearchResultsList();
}

function renderSearchResultsList() {
  els.searchResultsList.innerHTML = '';

  if (!canSearchCurrentDoc()) {
    const li = document.createElement('li');
    li.className = 'recent-item';
    li.textContent = 'Результаты поиска доступны для PDF/DjVu';
    els.searchResultsList.appendChild(li);
    return;
  }

  if (!state.searchResults.length) {
    const li = document.createElement('li');
    li.className = 'recent-item';
    li.textContent = 'Нет активных результатов';
    els.searchResultsList.appendChild(li);
    return;
  }

  state.searchResults.forEach((page, idx) => {
    const li = document.createElement('li');
    li.className = 'recent-item';
    const btn = document.createElement('button');
    const count = state.searchResultCounts[page] || 0;
    btn.textContent = `#${idx + 1} · Стр. ${page}${count ? ` · ${count} совп.` : ''}`;
    if (idx == state.searchCursor) {
      btn.textContent += ' (текущее)';
    }
    btn.addEventListener('click', async () => {
      await jumpToSearchResult(idx);
    });
    li.appendChild(btn);
    els.searchResultsList.appendChild(li);
  });
}

function loadSearchHistory() {
  try {
    return JSON.parse(localStorage.getItem(searchHistoryKey()) || '[]');
  } catch {
    return [];
  }
}

function saveSearchHistory(history) {
  localStorage.setItem(searchHistoryKey(), JSON.stringify(history));
}

function renderSearchHistory() {
  els.searchHistoryList.innerHTML = '';
  const history = loadSearchHistory();
  if (!canSearchCurrentDoc()) {
    const li = document.createElement('li');
    li.className = 'recent-item';
    li.textContent = 'История поиска доступна для PDF/DjVu';
    els.searchHistoryList.appendChild(li);
    return;
  }

  if (!history.length) {
    const li = document.createElement('li');
    li.className = 'recent-item';
    li.textContent = 'Запросов пока нет';
    els.searchHistoryList.appendChild(li);
    return;
  }

  history.forEach((query) => {
    const li = document.createElement('li');
    li.className = 'recent-item';
    const btn = document.createElement('button');
    btn.textContent = query;
    btn.addEventListener('click', async () => {
      els.searchInput.value = query;
      await searchInPdf(query);
    });
    li.appendChild(btn);
    els.searchHistoryList.appendChild(li);
  });
}

function rememberSearchQuery(query) {
  if (!canSearchCurrentDoc()) return;
  const normalized = (query || '').trim();
  if (!normalized) return;
  const history = loadSearchHistory();
  const next = [normalized, ...history.filter((x) => x !== normalized)].slice(0, 10);
  saveSearchHistory(next);
  renderSearchHistory();
}

function buildSearchHistoryText() {
  const history = loadSearchHistory();
  const lines = history.map((query, idx) => `${idx + 1}. ${query}`);
  return `Документ: ${state.docName || 'document'}
Запросов: ${history.length}

${lines.join('
')}`;
}

function exportSearchHistoryJson() {
  if (!canSearchCurrentDoc()) {
    els.searchStatus.textContent = 'Экспорт доступен для PDF/DjVu';
    return;
  }

  const history = loadSearchHistory();
  if (!history.length) {
    els.searchStatus.textContent = 'История поиска пуста';
    return;
  }

  const payload = {
    app: 'NovaReader',
    version: 1,
    docName: state.docName,
    exportedAt: new Date().toISOString(),
    history,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.docName || 'document'}-search-history.json`;
  a.click();
  URL.revokeObjectURL(url);

  els.searchStatus.textContent = `Экспортировано запросов: ${history.length}`;
}

function exportSearchHistoryTxt() {
  if (!canSearchCurrentDoc()) {
    els.searchStatus.textContent = 'Экспорт доступен для PDF/DjVu';
    return;
  }
  const history = loadSearchHistory();
  if (!history.length) {
    els.searchStatus.textContent = 'История поиска пуста';
    return;
  }

  const text = buildSearchHistoryText();
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.docName || 'document'}-search-history.txt`;
  a.click();
  URL.revokeObjectURL(url);

  els.searchStatus.textContent = `TXT экспортирован: ${history.length}`;
}

async function copySearchHistory() {
  if (!canSearchCurrentDoc()) {
    els.searchStatus.textContent = 'Копирование доступно для PDF/DjVu';
    return;
  }
  const history = loadSearchHistory();
  if (!history.length) {
    els.searchStatus.textContent = 'История поиска пуста';
    return;
  }

  const text = buildSearchHistoryText();
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    els.searchStatus.textContent = `Скопировано запросов: ${history.length}`;
  } catch {
    els.searchStatus.textContent = 'Не удалось скопировать историю';
  }
}

async function importSearchHistoryJson(file) {
  if (!canSearchCurrentDoc()) {
    els.searchStatus.textContent = 'Импорт доступен для PDF/DjVu';
    return;
  }

  try {
    const raw = await file.text();
    const payload = JSON.parse(raw);
    const incoming = Array.isArray(payload?.history) ? payload.history : [];
    const normalized = incoming
      .map((x) => (typeof x === 'string' ? x.trim() : ''))
      .filter(Boolean);

    if (!normalized.length) {
      els.searchStatus.textContent = 'Нет валидных запросов в JSON';
      return;
    }

    const unique = [...new Set(normalized)].slice(0, 10);
    saveSearchHistory(unique);
    renderSearchHistory();
    els.searchStatus.textContent = `Импортировано запросов: ${unique.length}`;
  } catch {
    els.searchStatus.textContent = 'Ошибка импорта истории поиска';
  }
}

function clearSearchHistory() {
  saveSearchHistory([]);
  renderSearchHistory();
}



function loadReadingGoal() {
  try {
    const raw = localStorage.getItem(readingGoalKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Number.isInteger(parsed?.page)) return null;
    return parsed.page;
  } catch {
    return null;
  }
}

function saveReadingGoal() {
  if (!state.adapter || !state.pageCount) {
    els.readingGoalStatus.textContent = 'Сначала откройте документ';
    return;
  }
  const raw = Number.parseInt(els.readingGoalPage.value, 10);
  if (Number.isNaN(raw)) {
    els.readingGoalStatus.textContent = 'Введите корректный номер страницы';
    return;
  }
  const goal = Math.max(1, Math.min(state.pageCount, raw));
  state.readingGoalPage = goal;
  localStorage.setItem(readingGoalKey(), JSON.stringify({ page: goal }));
  renderReadingGoalStatus();
}

function clearReadingGoal() {
  state.readingGoalPage = null;
  localStorage.removeItem(readingGoalKey());
  els.readingGoalPage.value = '';
  renderReadingGoalStatus();
}

function renderReadingGoalStatus() {
  if (!state.adapter || !state.pageCount) {
    els.readingGoalStatus.textContent = 'Цель чтения не задана';
    return;
  }

  const goal = state.readingGoalPage;
  if (!goal) {
    els.readingGoalStatus.textContent = 'Цель чтения не задана';
    return;
  }

  els.readingGoalPage.value = String(goal);
  const remaining = goal - state.currentPage;
  if (remaining <= 0) {
    els.readingGoalStatus.textContent = `Цель достигнута (стр. ${goal})`; 
    return;
  }

  const activeMs = state.readingStartedAt ? Date.now() - state.readingStartedAt : 0;
  const totalMs = state.readingTotalMs + activeMs;
  const pagesDone = Math.max(1, state.currentPage);
  const msPerPage = totalMs / pagesDone;
  const goalEta = Number.isFinite(msPerPage) && msPerPage > 0 ? formatEta(msPerPage * remaining) : '—';
  els.readingGoalStatus.textContent = `До цели стр. ${goal}: осталось ${remaining} стр., ETA ${goalEta}`;
}

function formatEta(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return '—';
  const d = new Date(Date.now() + ms);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

function renderEtaStatus() {
  if (!state.adapter || !state.pageCount) {
    els.etaStatus.textContent = 'ETA завершения: —';
    renderReadingGoalStatus();
    return;
  }

  const activeMs = state.readingStartedAt ? Date.now() - state.readingStartedAt : 0;
  const totalMs = state.readingTotalMs + activeMs;
  const pagesDone = Math.max(1, state.currentPage);
  const msPerPage = totalMs / pagesDone;
  const remainingPages = Math.max(0, state.pageCount - state.currentPage);

  if (!Number.isFinite(msPerPage) || msPerPage <= 0 || remainingPages === 0) {
    els.etaStatus.textContent = remainingPages === 0 ? 'ETA завершения: документ пройден' : 'ETA завершения: —';
    renderReadingGoalStatus();
    return;
  }

  const etaMs = msPerPage * remainingPages;
  els.etaStatus.textContent = `ETA завершения: ${formatEta(etaMs)}`;
  renderReadingGoalStatus();
}

function renderDocStats() {
  if (!state.adapter || !state.pageCount) {
    els.docStats.textContent = 'Откройте документ для статистики';
    return;
  }

  let totalStrokes = 0;
  let totalComments = 0;
  for (let page = 1; page <= state.pageCount; page += 1) {
    totalStrokes += loadStrokes(page).length;
    totalComments += loadComments(page).length;
  }

  const bookmarks = loadBookmarks().length;
  const activeMs = state.readingStartedAt ? Date.now() - state.readingStartedAt : 0;
  const totalHours = (state.readingTotalMs + activeMs) / 3600000;
  const pace = totalHours > 0.01 ? `${(state.currentPage / totalHours).toFixed(1)} стр/ч` : '—';

  els.docStats.textContent = `Аннотации: ${totalStrokes} · Комментарии: ${totalComments} · Закладки: ${bookmarks} · Темп: ${pace}`;
}

function renderVisitTrail() {
  els.visitTrailList.innerHTML = '';

  if (!state.adapter || !state.visitTrail.length) {
    const li = document.createElement('li');
    li.className = 'recent-item';
    li.textContent = 'История переходов пуста';
    els.visitTrailList.appendChild(li);
    return;
  }

  state.visitTrail.forEach((page) => {
    const li = document.createElement('li');
    li.className = 'recent-item';

    const btn = document.createElement('button');
    btn.textContent = `Стр. ${page}`;
    btn.addEventListener('click', async () => {
      if (!state.adapter) return;
      state.currentPage = page;
      await renderCurrentPage();
    });

    li.appendChild(btn);
    els.visitTrailList.appendChild(li);
  });
}

function trackVisitedPage(page) {
  if (!state.adapter || !Number.isInteger(page)) return;
  state.visitTrail = [page, ...state.visitTrail.filter((x) => x !== page)].slice(0, 12);
  renderVisitTrail();
}

function clearVisitTrail() {
  state.visitTrail = [];
  renderVisitTrail();
}

function updateHistoryButtons() {
  if (!els.historyBack || !els.historyForward) return;
  els.historyBack.disabled = state.historyBack.length === 0;
  els.historyForward.disabled = state.historyForward.length === 0;
}

function resetHistory() {
  state.historyBack = [];
  state.historyForward = [];
  state.lastRenderedPage = null;
  updateHistoryButtons();
}

function capturePageHistoryOnRender() {
  if (!state.adapter) return;
  const prev = state.lastRenderedPage;
  const curr = state.currentPage;
  if (typeof prev === 'number' && prev !== curr && !state.isHistoryNavigation) {
    const top = state.historyBack[state.historyBack.length - 1];
    if (top !== prev) {
      state.historyBack.push(prev);
      if (state.historyBack.length > 100) {
        state.historyBack.shift();
      }
    }
    state.historyForward = [];
  }
  state.lastRenderedPage = curr;
  updateHistoryButtons();
}

async function navigateHistoryBack() {
  if (!state.adapter || !state.historyBack.length) return;
  const target = state.historyBack.pop();
  if (!Number.isInteger(target)) return;
  state.historyForward.push(state.currentPage);
  state.isHistoryNavigation = true;
  state.currentPage = target;
  await renderCurrentPage();
  state.isHistoryNavigation = false;
  updateHistoryButtons();
}

async function navigateHistoryForward() {
  if (!state.adapter || !state.historyForward.length) return;
  const target = state.historyForward.pop();
  if (!Number.isInteger(target)) return;
  state.historyBack.push(state.currentPage);
  state.isHistoryNavigation = true;
  state.currentPage = target;
  await renderCurrentPage();
  state.isHistoryNavigation = false;
  updateHistoryButtons();
}


let readingTimerId = null;

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
  const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const s = String(totalSeconds % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function saveReadingTime() {
  if (!state.docName) return;
  localStorage.setItem(readingTimeKey(), JSON.stringify({ totalMs: Math.max(0, Math.floor(state.readingTotalMs)) }));
}

function loadReadingTime() {
  try {
    const raw = localStorage.getItem(readingTimeKey());
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    return Number.isFinite(parsed?.totalMs) ? Math.max(0, parsed.totalMs) : 0;
  } catch {
    return 0;
  }
}

function updateReadingTimeStatus() {
  if (!state.adapter || !state.docName) {
    els.readingTimeStatus.textContent = 'Время чтения: 00:00:00';
    return;
  }
  const activeMs = state.readingStartedAt ? Date.now() - state.readingStartedAt : 0;
  els.readingTimeStatus.textContent = `Время чтения: ${formatDuration(state.readingTotalMs + activeMs)}`;
  renderDocStats();
  renderEtaStatus();
}

function stopReadingTimer(commit = true) {
  if (readingTimerId) {
    clearInterval(readingTimerId);
    readingTimerId = null;
  }
  if (state.readingStartedAt) {
    state.readingTotalMs += Date.now() - state.readingStartedAt;
    state.readingStartedAt = null;
    if (commit) saveReadingTime();
  }
  updateReadingTimeStatus();
}

function startReadingTimer() {
  if (!state.adapter || !state.docName) return;
  if (document.hidden) return;
  if (state.readingStartedAt) return;

  state.readingStartedAt = Date.now();
  if (!readingTimerId) {
    readingTimerId = setInterval(updateReadingTimeStatus, 1000);
  }
  updateReadingTimeStatus();
}

function syncReadingTimerWithVisibility() {
  if (!state.adapter) return;
  if (document.hidden) {
    stopReadingTimer(true);
  } else {
    startReadingTimer();
  }
}

async function resetReadingTime() {
  if (!state.adapter) {
    els.readingTimeStatus.textContent = 'Сначала откройте документ';
    return;
  }
  stopReadingTimer(false);
  state.readingTotalMs = 0;
  saveReadingTime();
  updateReadingTimeStatus();
  renderEtaStatus();
  startReadingTimer();
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
  state.visitTrail = [];
  resetHistory();
  els.searchStatus.textContent = '';
  setWorkspaceStatus('');
  setBookmarksStatus('');
  els.pageText.value = '';

  const lower = file.name.toLowerCase();

  if (lower.endsWith('.pdf')) {
    const data = await file.arrayBuffer();
    const pdfDoc = await pdfjsLib.getDocument({ data }).promise;
    state.adapter = new PDFAdapter(pdfDoc);
  } else if (lower.endsWith('.djvu')) {
    const djvuData = loadDjvuData();
    state.adapter = new DjVuAdapter(file.name, djvuData);
  } else if (/\.(png|jpe?g|webp|gif|bmp)$/i.test(lower)) {
    const url = URL.createObjectURL(file);
    const imageMeta = await loadImage(url);
    state.adapter = new ImageAdapter(url, { width: imageMeta.width, height: imageMeta.height });
  } else {
    state.adapter = new UnsupportedAdapter(file.name);
  }

  state.pageCount = state.adapter.getPageCount();
  restoreViewStateIfPresent();
  stopReadingTimer(false);
  state.readingTotalMs = loadReadingTime();
  state.readingStartedAt = null;
  state.readingGoalPage = loadReadingGoal();
  els.pageInput.max = String(state.pageCount);
  els.pageInput.value = String(state.currentPage);
  if (els.cloudSyncUrl) {
    els.cloudSyncUrl.value = loadCloudSyncUrl();
  }
  if (state.collabEnabled) {
    toggleCollaborationChannel();
  }

  saveRecent(file.name);
  renderRecent();
  loadNotes();
  renderBookmarks();
  renderDocInfo();
  renderVisitTrail();
  renderSearchHistory();
  renderSearchResultsList();
  renderDocStats();
  await renderOutline();
  await renderPagePreviews();
  await renderCurrentPage();
  renderCommentList();
  updateReadingTimeStatus();
  renderEtaStatus();
  startReadingTimer();
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
  renderCommentList();

  els.pageStatus.textContent = `Страница ${state.currentPage} / ${state.pageCount}`;
  els.zoomStatus.textContent = `${Math.round(state.zoom * 100)}%`;
  els.pageInput.value = String(state.currentPage);
  capturePageHistoryOnRender();
  trackVisitedPage(state.currentPage);
  renderReadingProgress();
  saveViewState();
}


function saveViewState() {
  if (!state.adapter || !state.docName) return;
  const payload = {
    page: state.currentPage,
    zoom: Number(state.zoom.toFixed(3)),
    rotation: state.rotation,
    pageCount: state.pageCount,
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(viewStateKey(), JSON.stringify(payload));
}

function loadViewState() {
  try {
    const raw = localStorage.getItem(viewStateKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

function clearViewState() {
  localStorage.removeItem(viewStateKey());
}

function renderReadingProgress() {
  if (!state.adapter || !state.pageCount) {
    els.progressStatus.textContent = 'Нет открытого документа';
    return;
  }

  const percent = Math.round((state.currentPage / state.pageCount) * 100);
  els.progressStatus.textContent = `Страница ${state.currentPage} из ${state.pageCount} (${percent}%)`;
  renderEtaStatus();
}

function restoreViewStateIfPresent() {
  const saved = loadViewState();
  if (!saved) return;

  if (Number.isInteger(saved.page) && saved.page >= 1 && saved.page <= state.pageCount) {
    state.currentPage = saved.page;
  }
  if (typeof saved.zoom === 'number' && Number.isFinite(saved.zoom)) {
    state.zoom = Math.min(4, Math.max(0.3, saved.zoom));
  }
  if (typeof saved.rotation === 'number' && Number.isFinite(saved.rotation)) {
    state.rotation = ((saved.rotation % 360) + 360) % 360;
  }
}

async function resetReadingProgress() {
  if (!state.adapter) {
    els.progressStatus.textContent = 'Сначала откройте документ';
    return;
  }
  state.currentPage = 1;
  state.zoom = 1;
  state.rotation = 0;
  clearViewState();
  await renderCurrentPage();
  renderSearchResultsList();
}

function saveRecent(fileName) {
  const recent = JSON.parse(localStorage.getItem('novareader-recent') || '[]');
  const next = [fileName, ...recent.filter((x) => x !== fileName)].slice(0, 12);
  localStorage.setItem('novareader-recent', JSON.stringify(next));
}

function removeRecent(name) {
  const recent = JSON.parse(localStorage.getItem('novareader-recent') || '[]');
  const next = recent.filter((x) => x !== name);
  localStorage.setItem('novareader-recent', JSON.stringify(next));
  renderRecent();
}

function clearRecent() {
  localStorage.removeItem('novareader-recent');
  renderRecent();
}

function renderRecent() {
  const recent = JSON.parse(localStorage.getItem('novareader-recent') || '[]');
  els.recentList.innerHTML = '';

  if (!recent.length) {
    const li = document.createElement('li');
    li.className = 'recent-item';
    li.textContent = 'Список пуст';
    els.recentList.appendChild(li);
    return;
  }

  recent.forEach((name) => {
    const li = document.createElement('li');
    li.className = 'recent-item';

    const nameEl = document.createElement('div');
    nameEl.textContent = name;

    const actions = document.createElement('div');
    actions.className = 'inline-actions';

    const removeBtn = document.createElement('button');
    removeBtn.textContent = 'Удалить';
    removeBtn.addEventListener('click', () => removeRecent(name));

    actions.appendChild(removeBtn);
    li.appendChild(nameEl);
    li.appendChild(actions);
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

function getNotesModel() {
  return {
    title: (els.notesTitle.value || '').trim(),
    tags: (els.notesTags.value || '').trim(),
    body: els.notes.value || '',
    updatedAt: new Date().toISOString(),
  };
}


function normalizeImportedNotes(payload) {
  if (payload && payload.notes && typeof payload.notes === 'object') {
    return {
      title: payload.notes.title || state.docName || '',
      tags: payload.notes.tags || '',
      body: payload.notes.body || '',
    };
  }

  if (payload && typeof payload.notes === 'string') {
    return {
      title: state.docName || '',
      tags: '',
      body: payload.notes,
    };
  }

  return null;
}

function mergeNotesByMode(current, incoming, mode) {
  if (mode === 'append') {
    const joinedBody = [current.body, incoming.body].filter(Boolean).join('

');
    const mergedTags = [current.tags, incoming.tags]
      .filter(Boolean)
      .join(',')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
    const dedupTags = [...new Set(mergedTags)].join(', ');

    return {
      title: current.title || incoming.title || state.docName || '',
      tags: dedupTags,
      body: joinedBody,
    };
  }

  return {
    title: incoming.title || state.docName || '',
    tags: incoming.tags || '',
    body: incoming.body || '',
  };
}

function loadNotes() {
  const raw = localStorage.getItem(noteKey());
  if (!raw) {
    els.notesTitle.value = state.docName || '';
    els.notesTags.value = '';
    els.notes.value = '';
    setNotesStatus('Заметки загружены');
    return;
  }

  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && ('body' in parsed || 'title' in parsed || 'tags' in parsed)) {
      els.notesTitle.value = parsed.title || state.docName || '';
      els.notesTags.value = parsed.tags || '';
      els.notes.value = parsed.body || '';
      setNotesStatus('Заметки загружены');
      return;
    }
  } catch {
    // Backward compatibility with old plain-string format.
  }

  els.notesTitle.value = state.docName || '';
  els.notesTags.value = '';
  els.notes.value = raw;
  setNotesStatus('Заметки загружены');
}


let notesAutosaveTimer = null;

function setNotesStatus(message) {
  els.notesStatus.textContent = message;
}

function saveNotes(source = 'manual') {
  localStorage.setItem(noteKey(), JSON.stringify(getNotesModel()));
  if (source === 'manual') {
    setNotesStatus(`Сохранено вручную: ${new Date().toLocaleTimeString()}`);
  } else {
    setNotesStatus(`Автосохранение: ${new Date().toLocaleTimeString()}`);
  }
}

function queueNotesAutosave() {
  setNotesStatus('Есть несохранённые изменения...');
  if (notesAutosaveTimer) {
    clearTimeout(notesAutosaveTimer);
  }
  notesAutosaveTimer = setTimeout(() => {
    saveNotes('auto');
    notesAutosaveTimer = null;
  }, 600);
}


function exportNotes() {
  const m = getNotesModel();
  const plain = `Заголовок: ${m.title}
Теги: ${m.tags}
Обновлено: ${m.updatedAt}

${m.body}`;
  const blob = new Blob([plain], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.docName || 'notes'}.notes.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportNotesMarkdown() {
  const m = getNotesModel();
  const title = m.title || state.docName || 'Документ';
  const tags = m.tags ? `**Теги:** ${m.tags}

` : '';
  const markdown = `# Заметки: ${title}

${tags}${m.body}

_Обновлено: ${m.updatedAt}_
`;
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.docName || 'notes'}.notes.md`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportNotesJson() {
  const payload = {
    app: 'NovaReader',
    version: 2,
    docName: state.docName || null,
    notes: getNotesModel(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.docName || 'notes'}.notes.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function importNotesJson(file) {
  if (!file) return;
  try {
    const raw = await file.text();
    const payload = JSON.parse(raw);
    const incoming = normalizeImportedNotes(payload);
    if (!incoming) {
      throw new Error('bad notes payload');
    }

    const current = {
      title: els.notesTitle.value || state.docName || '',
      tags: els.notesTags.value || '',
      body: els.notes.value || '',
    };

    const mode = els.notesImportMode?.value || 'replace';
    const merged = mergeNotesByMode(current, incoming, mode);

    els.notesTitle.value = merged.title;
    els.notesTags.value = merged.tags;
    els.notes.value = merged.body;
    saveNotes('manual');
  } catch {
    alert('Не удалось импортировать заметки JSON. Проверьте формат файла.');
  }
}


function insertTimestamp() {
  const stamp = new Date().toLocaleString();
  const prefix = els.notes.value ? '
' : '';
  els.notes.value += `${prefix}[${stamp}] `;
  els.notes.focus();
  saveNotes('manual');
}


function normalizeHotkey(value, fallback) {
  const v = (value || '').trim().toLowerCase();
  return v || fallback;
}

function setHotkeysStatus(message, type = '') {
  els.hotkeysStatus.textContent = message;
  els.hotkeysStatus.classList.remove('error', 'success');
  if (type) {
    els.hotkeysStatus.classList.add(type);
  }
}

const hotkeyFieldMeta = {
  next: { input: () => els.hkNext, hint: () => els.hkNextHint, label: 'След. стр.' },
  prev: { input: () => els.hkPrev, hint: () => els.hkPrevHint, label: 'Пред. стр.' },
  zoomIn: { input: () => els.hkZoomIn, hint: () => els.hkZoomInHint, label: 'Zoom +' },
  zoomOut: { input: () => els.hkZoomOut, hint: () => els.hkZoomOutHint, label: 'Zoom -' },
  annotate: { input: () => els.hkAnnotate, hint: () => els.hkAnnotateHint, label: 'Аннотации' },
};

function normalizeHotkeyForDisplay(value) {
  return value === 'arrowright' ? '>' : (value === 'arrowleft' ? '<' : value);
}

function setHotkeysInputErrors(fields = [], details = {}) {
  Object.values(hotkeyFieldMeta).forEach((meta) => {
    const input = meta.input();
    const hint = meta.hint();
    input.classList.remove('hotkey-invalid');
    hint.textContent = '';
  });

  fields.forEach((field) => {
    const meta = hotkeyFieldMeta[field];
    if (!meta) return;
    const input = meta.input();
    const hint = meta.hint();
    input.classList.add('hotkey-invalid');
    hint.textContent = details[field] || 'Проверьте значение поля.';
  });
}

function validateHotkeys(nextHotkeys) {
  const entries = Object.entries(nextHotkeys);
  const emptyFields = entries.filter(([, value]) => !value || value.length < 1).map(([field]) => field);
  if (emptyFields.length) {
    const fieldMessages = Object.fromEntries(emptyFields.map((field) => [field, 'Пустое значение.']));
    return { ok: false, message: 'Ошибка: есть пустые хоткеи.', fields: emptyFields, fieldMessages };
  }

  const byValue = new Map();
  entries.forEach(([field, value]) => {
    if (!byValue.has(value)) byValue.set(value, []);
    byValue.get(value).push(field);
  });

  const duplicateValues = [...byValue.entries()].filter(([, arr]) => arr.length > 1);
  if (duplicateValues.length) {
    const duplicateFields = duplicateValues.flatMap(([, arr]) => arr);
    const fieldMessages = {};
    duplicateValues.forEach(([value, fields]) => {
      const labels = fields.map((field) => hotkeyFieldMeta[field]?.label || field).join(', ');
      fields.forEach((field) => {
        fieldMessages[field] = `Конфликт: «${normalizeHotkeyForDisplay(value)}» уже используется в ${labels}.`;
      });
    });
    const duplicates = duplicateValues.map(([v]) => normalizeHotkeyForDisplay(v));
    return {
      ok: false,
      message: `Ошибка: дублирующиеся хоткеи (${duplicates.join(', ')})`,
      fields: duplicateFields,
      fieldMessages,
    };
  }

  return { ok: true, message: 'Hotkeys сохранены.', fields: [], fieldMessages: {} };
}

function renderHotkeyInputs() {
  els.hkNext.value = normalizeHotkeyForDisplay(hotkeys.next);
  els.hkPrev.value = normalizeHotkeyForDisplay(hotkeys.prev);
  els.hkZoomIn.value = hotkeys.zoomIn;
  els.hkZoomOut.value = hotkeys.zoomOut;
  els.hkAnnotate.value = hotkeys.annotate;
}

function saveHotkeys() {
  const candidate = {
    next: normalizeHotkey(els.hkNext.value === '>' ? 'arrowright' : els.hkNext.value, 'arrowright'),
    prev: normalizeHotkey(els.hkPrev.value === '<' ? 'arrowleft' : els.hkPrev.value, 'arrowleft'),
    zoomIn: normalizeHotkey(els.hkZoomIn.value, '+'),
    zoomOut: normalizeHotkey(els.hkZoomOut.value, '-'),
    annotate: normalizeHotkey(els.hkAnnotate.value, 'a'),
  };

  const validation = validateHotkeys(candidate);
  if (!validation.ok) {
    setHotkeysInputErrors(validation.fields, validation.fieldMessages);
    setHotkeysStatus(validation.message, 'error');
    return;
  }

  setHotkeysInputErrors([]);
  hotkeys = candidate;
  localStorage.setItem('novareader-hotkeys', JSON.stringify(hotkeys));
  renderHotkeyInputs();
  setHotkeysStatus(validation.message, 'success');
}

function loadHotkeys() {
  const raw = localStorage.getItem('novareader-hotkeys');
  if (!raw) {
    hotkeys = { ...defaultHotkeys };
    renderHotkeyInputs();
    setHotkeysInputErrors([]);
    setHotkeysStatus('Используются значения по умолчанию.');
    return;
  }

  try {
    const parsed = JSON.parse(raw);
    hotkeys = {
      next: normalizeHotkey(parsed.next, defaultHotkeys.next),
      prev: normalizeHotkey(parsed.prev, defaultHotkeys.prev),
      zoomIn: normalizeHotkey(parsed.zoomIn, defaultHotkeys.zoomIn),
      zoomOut: normalizeHotkey(parsed.zoomOut, defaultHotkeys.zoomOut),
      annotate: normalizeHotkey(parsed.annotate, defaultHotkeys.annotate),
    };
  } catch {
    hotkeys = { ...defaultHotkeys };
  }
  renderHotkeyInputs();
  setHotkeysInputErrors([]);
  setHotkeysStatus('Hotkeys загружены.');
}

function resetHotkeys() {
  hotkeys = { ...defaultHotkeys };
  localStorage.setItem('novareader-hotkeys', JSON.stringify(hotkeys));
  renderHotkeyInputs();
  setHotkeysInputErrors([]);
  setHotkeysStatus('Hotkeys сброшены к умолчанию.', 'success');
}

function stringifyHotkeyEvent(e) {
  const base = e.key.toLowerCase();
  const specialMap = {
    ' ': 'space',
    arrowup: 'arrowup',
    arrowdown: 'arrowdown',
    arrowleft: 'arrowleft',
    arrowright: 'arrowright',
    escape: 'escape',
  };
  const normalizedBase = specialMap[base] || base;
  if (['control', 'shift', 'alt', 'meta'].includes(normalizedBase)) return '';

  const combo = [];
  if (e.ctrlKey) combo.push('ctrl');
  if (e.altKey) combo.push('alt');
  if (e.shiftKey) combo.push('shift');
  if (e.metaKey) combo.push('meta');
  combo.push(normalizedBase);
  return combo.join('+');
}

function bindHotkeyCapture() {
  const fields = ['next', 'prev', 'zoomIn', 'zoomOut', 'annotate'];
  fields.forEach((field) => {
    const input = hotkeyFieldMeta[field].input();
    input.addEventListener('keydown', (e) => {
      e.preventDefault();
      if (e.key === 'Backspace' || e.key === 'Delete') {
        input.value = '';
        setHotkeysStatus('Поле очищено. Сохраните или примените авто-фикс.');
        setHotkeysInputErrors([]);
        return;
      }

      const value = stringifyHotkeyEvent(e);
      if (!value) return;
      input.value = normalizeHotkeyForDisplay(value);
      setHotkeysStatus(`Назначено: ${hotkeyFieldMeta[field].label} = ${input.value}`);
      setHotkeysInputErrors([]);
    });
  });
}

function autoFixHotkeys() {
  const fields = ['next', 'prev', 'zoomIn', 'zoomOut', 'annotate'];
  const candidate = {
    next: normalizeHotkey(els.hkNext.value === '>' ? 'arrowright' : els.hkNext.value, ''),
    prev: normalizeHotkey(els.hkPrev.value === '<' ? 'arrowleft' : els.hkPrev.value, ''),
    zoomIn: normalizeHotkey(els.hkZoomIn.value, ''),
    zoomOut: normalizeHotkey(els.hkZoomOut.value, ''),
    annotate: normalizeHotkey(els.hkAnnotate.value, ''),
  };

  const used = new Set();
  for (const key of fields) {
    const value = candidate[key];
    if (!value || used.has(value)) {
      candidate[key] = '';
      continue;
    }
    used.add(value);
  }

  for (const key of fields) {
    if (candidate[key]) continue;
    const preferred = defaultHotkeys[key];
    if (!used.has(preferred)) {
      candidate[key] = preferred;
      used.add(preferred);
      continue;
    }

    const fallbackPool = ['j', 'k', 'i', 'o', 'u', 'p', 'n', 'm'];
    const fallback = fallbackPool.find((x) => !used.has(x)) || preferred;
    candidate[key] = fallback;
    used.add(fallback);
  }

  hotkeys = candidate;
  localStorage.setItem('novareader-hotkeys', JSON.stringify(hotkeys));
  renderHotkeyInputs();
  setHotkeysInputErrors([]);
  setHotkeysStatus('Hotkeys авто-исправлены и сохранены.', 'success');
}


function setBookmarksStatus(message, type = '') {
  els.bookmarksStatus.textContent = message;
  els.bookmarksStatus.classList.remove('error', 'success');
  if (type) {
    els.bookmarksStatus.classList.add(type);
  }
}

function exportBookmarksJson() {
  if (!state.adapter) {
    setBookmarksStatus('Сначала откройте документ', 'error');
    return;
  }

  const payload = {
    app: 'NovaReader',
    version: 1,
    docName: state.docName,
    exportedAt: new Date().toISOString(),
    bookmarks: loadBookmarks(),
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.docName || 'document'}-bookmarks.json`;
  a.click();
  URL.revokeObjectURL(url);
  setBookmarksStatus('Закладки экспортированы', 'success');
}

async function importBookmarksJson(file) {
  if (!state.adapter || !file) {
    setBookmarksStatus('Сначала откройте документ', 'error');
    return;
  }

  try {
    const raw = await file.text();
    const payload = JSON.parse(raw);
    const list = Array.isArray(payload?.bookmarks) ? payload.bookmarks : (Array.isArray(payload) ? payload : null);
    if (!list) throw new Error('bad payload');

    const normalized = list
      .filter((x) => Number.isInteger(x?.page) && x.page >= 1 && x.page <= state.pageCount)
      .map((x) => ({
        page: x.page,
        label: (x.label || `Метка ${x.page}`).toString().slice(0, 120),
      }));

    const unique = [];
    const seen = new Set();
    normalized.forEach((x) => {
      const key = `${x.page}:${x.label}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(x);
      }
    });

    unique.sort((a, b) => a.page - b.page);
    saveBookmarks(unique);
    renderBookmarks();
    setBookmarksStatus(`Импортировано закладок: ${unique.length}`, 'success');
  } catch {
    setBookmarksStatus('Ошибка импорта закладок', 'error');
  }
}

function loadBookmarks() {
  return JSON.parse(localStorage.getItem(bookmarkKey()) || '[]');
}

function saveBookmarks(next) {
  localStorage.setItem(bookmarkKey(), JSON.stringify(next));
  renderDocStats();
  renderEtaStatus();
}

function renderBookmarks() {
  const bookmarks = loadBookmarks();
  const filter = (els.bookmarkFilter?.value || '').trim().toLowerCase();
  const filtered = filter
    ? bookmarks.filter((entry) => (`${entry.label} ${entry.page}`).toLowerCase().includes(filter))
    : bookmarks;

  els.bookmarkList.innerHTML = '';

  if (!filtered.length) {
    const li = document.createElement('li');
    li.className = 'bookmark-item';
    li.textContent = filter ? 'Нет закладок по фильтру' : 'Закладок пока нет';
    els.bookmarkList.appendChild(li);
    return;
  }

  filtered.forEach((entry) => {
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
  setBookmarksStatus('Закладки очищены', 'success');
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
  if (!canSearchCurrentDoc()) return [];
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

  if (!canSearchCurrentDoc()) {
    const li = document.createElement('li');
    li.className = 'outline-item';
    li.textContent = 'Оглавление доступно для PDF/DjVu';
    els.outlineList.appendChild(li);
    return;
  }

  const raw = await state.adapter.getOutline();
  if (!raw?.length) {
    const li = document.createElement('li');
    li.className = 'outline-item';
    li.textContent = 'Оглавление отсутствует';
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

function updatePreviewSelection() {
  const buttons = els.pagePreviewList.querySelectorAll('button[data-page]');
  buttons.forEach((btn) => {
    const page = Number(btn.dataset.page);
    btn.classList.toggle('is-active', page === state.currentPage);
  });
}

async function renderPagePreviews() {
  els.pagePreviewList.innerHTML = '';

  if (!state.adapter) {
    const li = document.createElement('li');
    li.className = 'recent-item';
    li.textContent = 'Откройте документ для превью';
    els.pagePreviewList.appendChild(li);
    return;
  }

  const maxPages = state.adapter.type === 'pdf' ? Math.min(state.pageCount, 24) : Math.min(state.pageCount, 4);

  for (let i = 1; i <= maxPages; i += 1) {
    const li = document.createElement('li');
    li.className = 'recent-item';
    const btn = document.createElement('button');
    btn.className = 'preview-btn';
    btn.dataset.page = String(i);

    const canvas = document.createElement('canvas');
    canvas.width = 120;
    canvas.height = 160;

    try {
      const viewport = await state.adapter.getPageViewport(i, 1, state.rotation);
      const scale = Math.min(120 / Math.max(1, viewport.width), 160 / Math.max(1, viewport.height));
      await state.adapter.renderPage(i, canvas, { zoom: scale, rotation: state.rotation });
    } catch {
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#10141b';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#cbd5e1';
      ctx.font = '12px sans-serif';
      ctx.fillText(`Стр. ${i}`, 12, 20);
    }

    const label = document.createElement('span');
    label.className = 'preview-label';
    label.textContent = `Страница ${i}`;

    btn.appendChild(canvas);
    btn.appendChild(label);
    btn.addEventListener('click', async () => {
      state.currentPage = i;
      await renderCurrentPage();
    });

    li.appendChild(btn);
    els.pagePreviewList.appendChild(li);
  }

  if (state.pageCount > maxPages) {
    const li = document.createElement('li');
    li.className = 'recent-item tiny muted';
    li.textContent = `Показаны первые ${maxPages} из ${state.pageCount} страниц`;
    els.pagePreviewList.appendChild(li);
  }

  updatePreviewSelection();
}

async function refreshPageText() {
  if (!canSearchCurrentDoc()) {
    els.pageText.value = 'Извлечение текста доступно для PDF/DjVu';
    return;
  }

  let text = await state.adapter.getText(state.currentPage);
  if (!text) {
    const ocr = loadOcrTextData();
    text = String(ocr?.pagesText?.[state.currentPage - 1] || '');
  }
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

  if (!canSearchCurrentDoc()) {
    els.searchStatus.textContent = 'Поиск доступен для PDF/DjVu';
    renderSearchResultsList();
    return;
  }

  const normalized = (query || '').trim().toLowerCase();
  if (!normalized) {
    els.searchStatus.textContent = 'Введите запрос';
    renderSearchResultsList();
    return;
  }

  const scope = els.searchScope.value === 'current' ? 'current' : 'all';
  state.lastSearchQuery = query.trim();
  state.lastSearchScope = scope;
  rememberSearchQuery(query);

  if (scope === 'current') {
    let txt = (await state.adapter.getText(state.currentPage)).toLowerCase();
    if (!txt) {
      const ocr = loadOcrTextData();
      txt = String(ocr?.pagesText?.[state.currentPage - 1] || '').toLowerCase();
    }
    const count = txt.split(normalized).length - 1;
    if (count > 0) {
      state.searchResults = [state.currentPage];
      state.searchResultCounts[state.currentPage] = count;
    }
  } else {
    for (let i = 1; i <= state.pageCount; i += 1) {
      let txt = (await state.adapter.getText(i)).toLowerCase();
      if (!txt) {
        const ocr = loadOcrTextData();
        txt = String(ocr?.pagesText?.[i - 1] || '').toLowerCase();
      }
      const count = txt.split(normalized).length - 1;
      if (count > 0) {
        state.searchResults.push(i);
        state.searchResultCounts[i] = count;
      }
    }
  }

  if (state.searchResults.length) {
    state.searchCursor = 0;
    await jumpToSearchResult(0);
    const suffix = scope === 'current' ? ' (текущая страница)' : '';
    els.searchStatus.textContent = `Совпадение 1/${state.searchResults.length}${suffix}`;
  } else {
    els.searchStatus.textContent = scope === 'current' ? 'На текущей странице не найдено' : 'Ничего не найдено';
    renderSearchResultsList();
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
  target.addEventListener('dblclick', (e) => {
    const p = getCanvasPointFromEvent(e);
    const comments = loadComments();
    for (let i = 0; i < comments.length; i += 1) {
      const c = denormalizePoint(comments[i].point);
      const d = Math.hypot(c.x - p.x, c.y - p.y);
      if (d <= 14) {
        alert(comments[i].text);
        break;
      }
    }
  });
}

els.clearRecent.addEventListener('click', clearRecent);

els.fileInput.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  await openFile(file);
});

els.historyBack.addEventListener('click', navigateHistoryBack);
els.historyForward.addEventListener('click', navigateHistoryForward);

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
  await renderPagePreviews();
  await renderCurrentPage();
});

els.saveNotes.addEventListener('click', () => saveNotes('manual'));
[els.notesTitle, els.notesTags, els.notes].forEach((el) => {
  el.addEventListener('input', queueNotesAutosave);
});
els.exportNotes.addEventListener('click', exportNotes);
els.exportNotesMd.addEventListener('click', exportNotesMarkdown);
els.exportNotesJson.addEventListener('click', exportNotesJson);
els.importNotesJson.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  await importNotesJson(file);
  e.target.value = '';
});
els.insertTimestamp.addEventListener('click', insertTimestamp);
els.saveHotkeys.addEventListener('click', saveHotkeys);
els.resetHotkeys.addEventListener('click', resetHotkeys);
els.autoFixHotkeys.addEventListener('click', autoFixHotkeys);
els.exportWorkspace.addEventListener('click', exportWorkspaceBundleJson);
els.importWorkspace.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  await importWorkspaceBundleJson(file);
  e.target.value = '';
});
els.importOcrJson.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  await importOcrJson(file);
  e.target.value = '';
});
els.saveCloudSyncUrl.addEventListener('click', saveCloudSyncUrl);
els.pushCloudSync.addEventListener('click', async () => {
  try {
    await pushWorkspaceToCloud();
  } catch {
    setStage4Status('Ошибка cloud push.', 'error');
  }
});
els.pullCloudSync.addEventListener('click', async () => {
  try {
    await pullWorkspaceFromCloud();
  } catch {
    setStage4Status('Ошибка cloud pull.', 'error');
  }
});
els.toggleCollab.addEventListener('click', toggleCollaborationChannel);
els.broadcastCollab.addEventListener('click', () => broadcastWorkspaceSnapshot('manual'));
els.resetProgress.addEventListener('click', async () => {
  await resetReadingProgress();
});
els.resetReadingTime.addEventListener('click', async () => {
  await resetReadingTime();
});
els.clearVisitTrail.addEventListener('click', clearVisitTrail);
els.clearSearchHistory.addEventListener('click', clearSearchHistory);
els.exportSearchHistory.addEventListener('click', exportSearchHistoryJson);
els.exportSearchHistoryTxt.addEventListener('click', exportSearchHistoryTxt);
els.copySearchHistory.addEventListener('click', async () => {
  await copySearchHistory();
});
els.importSearchHistoryJson.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  await importSearchHistoryJson(file);
  e.target.value = '';
});
els.clearSearchResults.addEventListener('click', clearSearchResults);
els.exportSearchResults.addEventListener('click', exportSearchResultsJson);
els.exportSearchResultsCsv.addEventListener('click', exportSearchResultsCsv);
els.exportSearchSummaryTxt.addEventListener('click', exportSearchResultsSummaryTxt);
els.importSearchResultsJson.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  await importSearchResultsJson(file);
  e.target.value = '';
});
els.importSearchResultsCsv.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  await importSearchResultsCsv(file);
  e.target.value = '';
});
els.copySearchResults.addEventListener('click', async () => {
  await copySearchResultsSummary();
});
els.saveReadingGoal.addEventListener('click', saveReadingGoal);
els.clearReadingGoal.addEventListener('click', clearReadingGoal);
els.themeToggle.addEventListener('click', toggleTheme);
els.addBookmark.addEventListener('click', addBookmark);
els.clearBookmarks.addEventListener('click', clearBookmarks);
els.exportBookmarks.addEventListener('click', exportBookmarksJson);
els.importBookmarks.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  await importBookmarksJson(file);
  e.target.value = '';
});
els.bookmarkFilter.addEventListener('input', renderBookmarks);
els.clearBookmarkFilter.addEventListener('click', () => {
  els.bookmarkFilter.value = '';
  renderBookmarks();
});
els.downloadFile.addEventListener('click', downloadCurrentFile);
els.printPage.addEventListener('click', printCanvasPage);
els.refreshText.addEventListener('click', refreshPageText);
els.copyText.addEventListener('click', copyPageText);
els.exportText.addEventListener('click', exportPageText);
els.annotateToggle.addEventListener('click', () => setDrawMode(!state.drawEnabled));
els.undoStroke.addEventListener('click', undoStroke);
els.clearStrokes.addEventListener('click', clearStrokes);
els.clearComments.addEventListener('click', clearComments);
els.exportAnnotated.addEventListener('click', exportAnnotatedPng);
els.exportAnnJson.addEventListener('click', exportAnnotationsJson);
els.importAnnJson.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  await importAnnotationsJson(file);
  e.target.value = '';
});
els.exportAnnBundle.addEventListener('click', exportAnnotationBundleJson);
els.importAnnBundle.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  await importAnnotationBundleJson(file);
  e.target.value = '';
});

els.importDjvuDataJson.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  await importDjvuDataJson(file);
  e.target.value = '';
});
els.searchBtn.addEventListener('click', async () => {
  await searchInPdf(els.searchInput.value);
});
els.searchScope.addEventListener('change', () => {
  saveSearchScope();
});

els.searchPrev.addEventListener('click', async () => {
  await jumpToSearchResult(state.searchCursor - 1);
});

els.searchNext.addEventListener('click', async () => {
  await jumpToSearchResult(state.searchCursor + 1);
});

els.shortcutsHelp.addEventListener('click', showShortcutsHelp);

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
  const key = e.key.toLowerCase();
  if (e.altKey && key === 'arrowleft') {
    e.preventDefault();
    await navigateHistoryBack();
    return;
  }
  if (e.altKey && key === 'arrowright') {
    e.preventDefault();
    await navigateHistoryForward();
    return;
  }

  if (key === hotkeys.next) els.nextPage.click();
  if (key === hotkeys.prev) els.prevPage.click();
  if (key === hotkeys.zoomIn) els.zoomIn.click();
  if (key === hotkeys.zoomOut) els.zoomOut.click();
  if (key === 'b' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    addBookmark();
  }
  if ((e.ctrlKey || e.metaKey) && key === 'f') {
    e.preventDefault();
    els.searchInput.focus();
  }
  if ((e.ctrlKey || e.metaKey) && key === 'z') {
    if (state.drawEnabled) {
      e.preventDefault();
      undoStroke();
    }
  }
  if (key === hotkeys.annotate && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    setDrawMode(!state.drawEnabled);
  }
  if (e.key === 'Escape' && state.drawEnabled) {
    setDrawMode(false);
  }
  if (e.key === '?') {
    e.preventDefault();
    showShortcutsHelp();
  }
});

document.addEventListener('visibilitychange', syncReadingTimerWithVisibility);
window.addEventListener('beforeunload', () => {
  stopReadingTimer(true);
});

renderRecent();
loadTheme();
loadSearchScope();
renderReadingProgress();
updateHistoryButtons();
loadNotes();
loadHotkeys();
bindHotkeyCapture();
renderBookmarks();
renderOutline();
renderCommentList();
renderVisitTrail();
renderSearchHistory();
renderSearchResultsList();
renderDocStats();
initReleaseGuards();
renderEtaStatus();
renderReadingGoalStatus();
setupDragAndDrop();
setupAnnotationEvents();
setDrawMode(false);
