let pdfjsLib = null;
let djvuLib = null;
let ocradReady = false;

async function ensurePdfJs() {
  if (pdfjsLib) return pdfjsLib;

  const localPdfUrl = new URL('./vendor/pdf.min.mjs', import.meta.url).href;
  const localWorkerUrl = new URL('./vendor/pdf.worker.min.mjs', import.meta.url).href;

  try {
    pdfjsLib = await import(localPdfUrl);
    if (pdfjsLib?.GlobalWorkerOptions) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = localWorkerUrl;
    }
    return pdfjsLib;
  } catch {
    throw new Error('PDF.js недоступен в локальном runtime пакете');
  }
}

async function ensureDjVuJs() {
  if (djvuLib) return djvuLib;

  const url = new URL('./vendor/djvu.js', import.meta.url).href;
  await new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-djvu-runtime="1"]');
    if (existing) {
      if (window.DjVu) {
        resolve();
      } else {
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(new Error('DjVu runtime load error')), { once: true });
      }
      return;
    }

    const script = document.createElement('script');
    script.src = url;
    script.async = true;
    script.dataset.djvuRuntime = '1';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('DjVu runtime load error'));
    document.head.appendChild(script);
  });

  if (!window.DjVu) {
    throw new Error('DjVu runtime не инициализирован');
  }

  djvuLib = window.DjVu;
  return djvuLib;
}

async function ensureOcrad() {
  if (ocradReady && typeof (globalThis.OCRAD || window.OCRAD) === 'function') {
    if (!window.OCRAD && typeof globalThis.OCRAD === 'function') {
      window.OCRAD = globalThis.OCRAD;
    }
    return;
  }

  const url = new URL('./vendor/ocrad.js', import.meta.url).href;
  await new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-ocrad-runtime="1"]');
    if (existing) {
      if (typeof window.OCRAD === 'function') {
        resolve();
      } else {
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(new Error('OCR runtime load error')), { once: true });
      }
      return;
    }

    const script = document.createElement('script');
    script.src = url;
    script.async = true;
    script.dataset.ocradRuntime = '1';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('OCR runtime load error'));
    document.head.appendChild(script);
  });

  if (typeof window.OCRAD !== 'function') {
    try {
      const code = await fetch(url, { cache: 'force-cache' }).then((r) => {
        if (!r.ok) throw new Error('fetch failed');
        return r.text();
      });
      // eslint-disable-next-line no-eval
      eval(code);
      if (!window.OCRAD && typeof globalThis.OCRAD === 'function') {
        window.OCRAD = globalThis.OCRAD;
      }
    } catch {
      throw new Error('OCR runtime не инициализирован');
    }
  }

  if (typeof window.OCRAD !== 'function') {
    throw new Error('OCR runtime не инициализирован');
  }

  ocradReady = true;
}



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
  djvuBinaryDetected: false,
  currentObjectUrl: null,
  ocrRegionMode: false,
  ocrSelection: null,
  isSelectingOcr: false,
  backgroundOcrToken: 0,
  settings: null,
};

const defaultHotkeys = {
  next: 'pagedown',
  prev: 'pageup',
  zoomIn: 'ctrl+=',
  zoomOut: 'ctrl+-',
  annotate: 'ctrl+shift+a',
};

let hotkeys = { ...defaultHotkeys };


const SIDEBAR_SECTION_CONFIG = [
  { key: 'recent', label: 'Недавние файлы' },
  { key: 'bookmarks', label: 'Закладки' },
  { key: 'outline', label: 'Оглавление' },
  { key: 'previews', label: 'Превью страниц' },
  { key: 'progress', label: 'Прогресс чтения' },
  { key: 'searchResults', label: 'Результаты поиска' },
  { key: 'searchHistory', label: 'История поиска' },
  { key: 'notes', label: 'Заметки' },
];

const TOOLBAR_SECTION_CONFIG = [
  { key: 'navigation', label: 'Навигация (верхняя панель)' },
  { key: 'zoom', label: 'Масштаб и поворот' },
  { key: 'view', label: 'Вид и служебные кнопки' },
  { key: 'tools', label: 'Панель инструментов' },
];

const OCR_MIN_DPI = 1500;
const CSS_BASE_DPI = 96;

const els = {
  fileInput: document.getElementById('fileInput'),
  appVersion: document.getElementById('appVersion'),
  recentList: document.getElementById('recentList'),
  clearRecent: document.getElementById('clearRecent'),
  toggleAdvancedPanels: document.getElementById('toggleAdvancedPanels'),
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
  settingsStatus: document.getElementById('settingsStatus'),
  applyCommonHotkeys: document.getElementById('applyCommonHotkeys'),
  toggleSidebarCompact: document.getElementById('toggleSidebarCompact'),
  collapseSidebarSections: document.getElementById('collapseSidebarSections'),
  expandSidebarSections: document.getElementById('expandSidebarSections'),
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
  toggleSidebar: document.getElementById('toggleSidebar'),
  toggleToolsBar: document.getElementById('toggleToolsBar'),
  toggleTextTools: document.getElementById('toggleTextTools'),
  toggleSearchTools: document.getElementById('toggleSearchTools'),
  toggleAnnotTools: document.getElementById('toggleAnnotTools'),
  toggleTextToolsInline: document.getElementById('toggleTextToolsInline'),
  textToolsSection: document.getElementById('textToolsSection'),
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
  importDjvuDataQuick: document.getElementById('importDjvuDataQuick'),
  docInfo: document.getElementById('docInfo'),
  refreshText: document.getElementById('refreshText'),
  copyText: document.getElementById('copyText'),
  exportText: document.getElementById('exportText'),
  ocrCurrentPage: document.getElementById('ocrCurrentPage'),
  ocrRegionMode: document.getElementById('ocrRegionMode'),
  copyOcrText: document.getElementById('copyOcrText'),
  ocrStatus: document.getElementById('ocrStatus'),
  pageText: document.getElementById('pageText'),
  openSettingsModal: document.getElementById('openSettingsModal'),
  closeSettingsModal: document.getElementById('closeSettingsModal'),
  saveSettingsModal: document.getElementById('saveSettingsModal'),
  settingsModal: document.getElementById('settingsModal'),
  cfgShowSidebar: document.getElementById('cfgShowSidebar'),
  cfgShowSearch: document.getElementById('cfgShowSearch'),
  cfgShowAnnot: document.getElementById('cfgShowAnnot'),
  cfgShowText: document.getElementById('cfgShowText'),
  cfgTheme: document.getElementById('cfgTheme'),
  cfgAppLang: document.getElementById('cfgAppLang'),
  cfgOcrLang: document.getElementById('cfgOcrLang'),
  cfgOcrCyrillicOnly: document.getElementById('cfgOcrCyrillicOnly'),
  cfgOcrQualityMode: document.getElementById('cfgOcrQualityMode'),
  cfgOcrMinW: document.getElementById('cfgOcrMinW'),
  cfgOcrMinH: document.getElementById('cfgOcrMinH'),
  cfgBackgroundOcr: document.getElementById('cfgBackgroundOcr'),
  cfgSidebarSections: document.getElementById('cfgSidebarSections'),
  cfgToolbarSections: document.getElementById('cfgToolbarSections'),
  sidebarResizeHandle: document.getElementById('sidebarResizeHandle'),
  canvasResizeHandle: document.getElementById('canvasResizeHandle'),
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
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const viewport = page.getViewport({ scale: zoom * dpr, rotation });
    const ctx = canvas.getContext('2d');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.style.width = `${Math.round(viewport.width / dpr)}px`;
    canvas.style.height = `${Math.round(viewport.height / dpr)}px`;
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
    const dpr = Math.max(1, window.devicePixelRatio || 1);

    const w = img.width * zoom;
    const h = img.height * zoom;
    const rw = w * dpr;
    const rh = h * dpr;

    if (rotation % 180 === 0) {
      canvas.width = rw;
      canvas.height = rh;
      canvas.style.width = `${Math.round(w)}px`;
      canvas.style.height = `${Math.round(h)}px`;
    } else {
      canvas.width = rh;
      canvas.height = rw;
      canvas.style.width = `${Math.round(h)}px`;
      canvas.style.height = `${Math.round(w)}px`;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.translate(w / 2, h / 2);
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
    this.mode = 'compat';
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
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const w = img.width * zoom;
      const h = img.height * zoom;
      const rw = w * dpr;
      const rh = h * dpr;
      if (rotation % 180 === 0) {
        canvas.width = rw;
        canvas.height = rh;
        canvas.style.width = `${Math.round(w)}px`;
        canvas.style.height = `${Math.round(h)}px`;
      } else {
        canvas.width = rh;
        canvas.height = rw;
        canvas.style.width = `${Math.round(h)}px`;
        canvas.style.height = `${Math.round(w)}px`;
      }
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.translate(w / 2, h / 2);
      ctx.rotate(rad);
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
      ctx.restore();
      return;
    }

    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const viewport = await this.getPageViewport(pageNumber, zoom * dpr, rotation);
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.style.width = `${Math.round(viewport.width / dpr)}px`;
    canvas.style.height = `${Math.round(viewport.height / dpr)}px`;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#10141b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#f8fafc';
    ctx.font = '24px sans-serif';
    ctx.fillText('DjVu документ', 40, 70);
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


class DjVuNativeAdapter {
  constructor(doc, fileName) {
    this.doc = doc;
    this.fileName = fileName;
    this.type = 'djvu';
    this.mode = 'native';
    this.pageSizes = Array.isArray(doc?.getPagesSizes?.()) ? doc.getPagesSizes() : [];
    this.pageCount = Number(doc?.getPagesQuantity?.() || this.pageSizes.length || 1);
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
    const page = await this.doc.getPage(pageNumber);
    const imageData = page.getImageData(true);
    page.reset?.();

    const tmp = document.createElement('canvas');
    tmp.width = imageData.width;
    tmp.height = imageData.height;
    tmp.getContext('2d').putImageData(imageData, 0, 0);

    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const rad = (rotation * Math.PI) / 180;
    const w = tmp.width * zoom;
    const h = tmp.height * zoom;
    const rw = w * dpr;
    const rh = h * dpr;

    if (rotation % 180 === 0) {
      canvas.width = rw;
      canvas.height = rh;
      canvas.style.width = `${Math.round(w)}px`;
      canvas.style.height = `${Math.round(h)}px`;
    } else {
      canvas.width = rh;
      canvas.height = rw;
      canvas.style.width = `${Math.round(h)}px`;
      canvas.style.height = `${Math.round(w)}px`;
    }

    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.translate(w / 2, h / 2);
    ctx.rotate(rad);
    ctx.drawImage(tmp, -w / 2, -h / 2, w, h);
    ctx.restore();
  }

  async getText(pageNumber) {
    const page = await this.doc.getPage(pageNumber);
    const text = page.getText() || '';
    page.reset?.();
    return text;
  }

  async getOutline() {
    const raw = this.doc.getContents?.() || [];
    const mapItems = (items) => (Array.isArray(items) ? items.map((item) => {
      const page = item?.url ? this.doc.getPageNumberByUrl(item.url) : null;
      return {
        title: item?.description || '(без названия)',
        dest: Number.isInteger(page) ? page : null,
        items: mapItems(item?.children || []),
      };
    }) : []);
    return mapItems(raw);
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
    ctx.fillText('Откройте поддерживаемый формат: PDF, DjVu или изображение.', 80, 220);
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


function revokeCurrentObjectUrl() {
  if (state.currentObjectUrl) {
    URL.revokeObjectURL(state.currentObjectUrl);
    state.currentObjectUrl = null;
  }
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

function updateOverlayInteractionState() {
  const enabled = !!(state.drawEnabled || state.ocrRegionMode);
  els.annotationCanvas.classList.toggle('drawing-enabled', enabled);
}

function setDrawMode(enabled) {
  state.drawEnabled = enabled;
  updateOverlayInteractionState();
  els.annotateToggle.textContent = `Аннотации: ${enabled ? 'on' : 'off'}`;
}

function appSettingsKey() {
  return 'novareader-settings';
}

function defaultSettings() {
  return {
    appLang: 'ru',
    ocrLang: 'auto',
    ocrMinW: 24,
    ocrMinH: 24,
    backgroundOcr: false,
    ocrCyrillicOnly: true,
    ocrQualityMode: 'balanced',
    sidebarSections: Object.fromEntries(SIDEBAR_SECTION_CONFIG.map((x) => [x.key, true])),
    toolbarSections: Object.fromEntries(TOOLBAR_SECTION_CONFIG.map((x) => [x.key, true])),
  };
}

function loadAppSettings() {
  try {
    const raw = localStorage.getItem(appSettingsKey());
    const parsed = raw ? JSON.parse(raw) : {};
    state.settings = { ...defaultSettings(), ...(parsed || {}) };
    state.settings.sidebarSections = { ...defaultSettings().sidebarSections, ...(state.settings.sidebarSections || {}) };
    state.settings.toolbarSections = { ...defaultSettings().toolbarSections, ...(state.settings.toolbarSections || {}) };
  } catch {
    state.settings = defaultSettings();
  }
}

function saveAppSettings() {
  localStorage.setItem(appSettingsKey(), JSON.stringify(state.settings || defaultSettings()));
}

function getOcrLang() {
  return state.settings?.ocrLang || 'auto';
}

function getOcrScale() {
  const lang = getOcrLang();
  const qualityScale = state.settings?.ocrQualityMode === 'accurate' ? 1.35 : 1;
  const langScale = (lang === 'rus' ? 3 : 2) * qualityScale;
  const dpiScale = OCR_MIN_DPI / CSS_BASE_DPI;
  return Math.max(langScale, dpiScale);
}

function getConfusableLatinToCyrillicMap() {
  return {
    A: 'А', a: 'а', B: 'В', E: 'Е', e: 'е', K: 'К', k: 'к', M: 'М', m: 'м',
    H: 'Н', h: 'н', O: 'О', o: 'о', P: 'Р', p: 'р', C: 'С', c: 'с', T: 'Т',
    t: 'т', X: 'Х', x: 'х', y: 'у', Y: 'У', r: 'г', n: 'п', N: 'П',
    i: 'і', I: 'І', l: 'ӏ', V: 'Ѵ', v: 'ѵ', S: 'Ѕ', s: 'ѕ',
  };
}

function convertLatinLookalikesToCyrillic(input) {
  const map = getConfusableLatinToCyrillicMap();
  return String(input || '').replace(/[A-Za-z]/g, (ch) => map[ch] || ch);
}

function hasMixedCyrillicLatinToken(text) {
  return /(?=.*[A-Za-z])(?=.*[А-Яа-яЁё])[A-Za-zА-Яа-яЁё]{2,}/.test(text || '');
}

function computeOtsuThreshold(data) {
  const hist = new Uint32Array(256);
  for (let i = 0; i < data.length; i += 4) {
    hist[data[i]] += 1;
  }

  const total = data.length / 4;
  let sum = 0;
  for (let i = 0; i < 256; i += 1) sum += i * hist[i];

  let sumB = 0;
  let wB = 0;
  let best = 127;
  let maxVar = 0;

  for (let t = 0; t < 256; t += 1) {
    wB += hist[t];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > maxVar) {
      maxVar = between;
      best = t;
    }
  }
  return best;
}

function countHistogramPercentile(hist, percentile, total) {
  const target = total * percentile;
  let acc = 0;
  for (let i = 0; i < hist.length; i += 1) {
    acc += hist[i];
    if (acc >= target) return i;
  }
  return hist.length - 1;
}

function scoreCyrillicWordQuality(text) {
  const words = String(text || '').toLowerCase().split(/\s+/).filter(Boolean);
  let score = 0;
  for (const word of words) {
    if (!/[а-яё]/.test(word)) continue;
    if (/([а-яё])\1{3,}/.test(word)) score -= 4;
    if (!/[аеёиоуыэюя]/.test(word) && word.length >= 4) score -= 3;
    if (/[бвгджзйклмнпрстфхцчшщ]{5,}/.test(word)) score -= 2;
    if (word.length >= 3 && /^[а-яё]+$/.test(word)) score += 1;
  }
  return score;
}

function scoreRussianBigrams(text) {
  const normalized = String(text || '').toLowerCase().replace(/[^а-яё\s]/g, ' ');
  const pairs = ['ст', 'но', 'ен', 'то', 'на', 'ов', 'ни', 'ра', 'ко', 'ал', 'пр', 'ро', 'во', 'по', 'ре', 'ос', 'от', 'та', 'го'];
  let score = 0;
  for (const pair of pairs) {
    const hits = normalized.split(pair).length - 1;
    score += Math.min(5, hits);
  }
  return score;
}

function medianDenoiseMonochrome(imageData) {
  const { width, height, data } = imageData;
  if (width < 3 || height < 3) return;
  const copy = new Uint8ClampedArray(data);
  const values = new Array(9);
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      let k = 0;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const idx = ((y + dy) * width + (x + dx)) * 4;
          values[k] = copy[idx];
          k += 1;
        }
      }
      values.sort((a, b) => a - b);
      const v = values[4];
      const outIdx = (y * width + x) * 4;
      data[outIdx] = data[outIdx + 1] = data[outIdx + 2] = v;
    }
  }
}

function estimateSkewAngleFromBinary(imageData) {
  const { width, height, data } = imageData;
  const darkPoints = [];
  const step = Math.max(1, Math.floor(Math.max(width, height) / 900));
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const idx = (y * width + x) * 4;
      if (data[idx] < 128) darkPoints.push([x, y]);
    }
  }
  if (darkPoints.length < 200) return 0;

  let bestAngle = 0;
  let bestScore = -Infinity;
  for (let deg = -6; deg <= 6; deg += 0.5) {
    const rad = (deg * Math.PI) / 180;
    const s = Math.sin(rad);
    const c = Math.cos(rad);
    const bins = new Map();
    for (const [x, y] of darkPoints) {
      const yy = Math.round((x * s) + (y * c));
      bins.set(yy, (bins.get(yy) || 0) + 1);
    }
    let mean = 0;
    for (const v of bins.values()) mean += v;
    mean /= Math.max(1, bins.size);
    let variance = 0;
    for (const v of bins.values()) variance += (v - mean) * (v - mean);
    variance /= Math.max(1, bins.size);
    if (variance > bestScore) {
      bestScore = variance;
      bestAngle = deg;
    }
  }
  return bestAngle;
}

function rotateCanvas(source, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const w = source.width;
  const h = source.height;
  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.round((w * cos) + (h * sin)));
  out.height = Math.max(1, Math.round((w * sin) + (h * cos)));
  const ctx = out.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.translate(out.width / 2, out.height / 2);
  ctx.rotate(rad);
  ctx.drawImage(source, -w / 2, -h / 2);
  return out;
}

async function buildOcrSourceCanvas(pageNumber) {
  const canvas = document.createElement('canvas');
  const fixedZoom = state.settings?.ocrQualityMode === 'accurate' ? 1.7 : 1.35;
  await state.adapter.renderPage(pageNumber, canvas, { zoom: fixedZoom, rotation: state.rotation || 0 });
  return canvas;
}

function cropCanvasByRelativeRect(sourceCanvas, relativeRect) {
  const sx = Math.max(0, Math.floor(sourceCanvas.width * relativeRect.x));
  const sy = Math.max(0, Math.floor(sourceCanvas.height * relativeRect.y));
  const sw = Math.max(1, Math.floor(sourceCanvas.width * relativeRect.w));
  const sh = Math.max(1, Math.floor(sourceCanvas.height * relativeRect.h));
  const out = document.createElement('canvas');
  out.width = sw;
  out.height = sh;
  out.getContext('2d').drawImage(sourceCanvas, sx, sy, sw, sh, 0, 0, sw, sh);
  return out;
}

function preprocessOcrCanvas(inputCanvas, thresholdBias = 0, mode = 'mean', invert = false, extraScale = 1) {
  const canvas = document.createElement('canvas');
  const scale = getOcrScale() * Math.max(0.8, Math.min(1.8, extraScale));
  canvas.width = Math.max(1, Math.floor(inputCanvas.width * scale));
  canvas.height = Math.max(1, Math.floor(inputCanvas.height * scale));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(inputCanvas, 0, 0, canvas.width, canvas.height);

  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  const hist = new Uint32Array(256);
  let mean = 0;
  for (let i = 0; i < d.length; i += 4) {
    const gray = (d[i] * 0.299) + (d[i + 1] * 0.587) + (d[i + 2] * 0.114);
    const g = Math.max(0, Math.min(255, Math.round(gray)));
    d[i] = d[i + 1] = d[i + 2] = g;
    hist[g] += 1;
    mean += g;
  }
  mean /= Math.max(1, d.length / 4);

  const totalPx = d.length / 4;
  const p5 = countHistogramPercentile(hist, 0.05, totalPx);
  const p95 = Math.max(p5 + 1, countHistogramPercentile(hist, 0.95, totalPx));
  const spread = Math.max(1, p95 - p5);
  for (let i = 0; i < d.length; i += 4) {
    const stretched = ((d[i] - p5) * 255) / spread;
    const g = Math.max(0, Math.min(255, Math.round(stretched)));
    d[i] = d[i + 1] = d[i + 2] = g;
  }

  if (state.settings?.ocrQualityMode === 'accurate') {
    medianDenoiseMonochrome(img);
  }

  const thresholdShift = state.settings?.ocrQualityMode === 'accurate' ? 8 : 0;
  const otsu = computeOtsuThreshold(d);
  const thresholdBase = mode === 'otsu' ? otsu : mean;
  const threshold = Math.max(50, Math.min(220, thresholdBase + thresholdBias + thresholdShift));

  for (let i = 0; i < d.length; i += 4) {
    let v = d[i] > threshold ? 255 : 0;
    if (invert) v = 255 - v;
    d[i] = d[i + 1] = d[i + 2] = v;
    d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

function scoreOcrTextByLang(text, lang) {
  const s = String(text || '').trim();
  if (!s) return 0;
  const cyr = (s.match(/[А-Яа-яЁё]/g) || []).length;
  const lat = (s.match(/[A-Za-z]/g) || []).length;
  const digits = (s.match(/[0-9]/g) || []).length;
  const mixedPenalty = hasMixedCyrillicLatinToken(s) ? 120 : 0;
  if (lang === 'rus') {
    return (cyr * 4) - (lat * 3) + digits - mixedPenalty + scoreCyrillicWordQuality(s) + scoreRussianBigrams(s);
  }
  if (lang === 'eng') return (lat * 4) - (cyr * 3) + digits - mixedPenalty;
  return Math.max(cyr, lat) * 2 + digits;
}

async function runOcrOnPreparedCanvas(canvas, options = {}) {
  const fast = !!options.fast;
  const isAccurate = state.settings?.ocrQualityMode === 'accurate';
  const baseVariants = isAccurate
    ? [
      preprocessOcrCanvas(canvas, -32, 'mean', false),
      preprocessOcrCanvas(canvas, -16, 'mean', false),
      preprocessOcrCanvas(canvas, 0, 'mean', false),
      preprocessOcrCanvas(canvas, 16, 'otsu', false),
      preprocessOcrCanvas(canvas, 28, 'otsu', false),
      preprocessOcrCanvas(canvas, 10, 'otsu', true),
      preprocessOcrCanvas(canvas, 6, 'otsu', false, 1.2),
      preprocessOcrCanvas(canvas, -6, 'mean', false, 0.9),
    ]
    : [
      preprocessOcrCanvas(canvas, -20, 'mean', false),
      preprocessOcrCanvas(canvas, 0, 'otsu', false),
      preprocessOcrCanvas(canvas, 20, 'otsu', false),
    ];

  let variants = baseVariants;
  if (!fast) {
    const probe = variants[Math.min(2, variants.length - 1)];
    const probeImg = probe.getContext('2d').getImageData(0, 0, probe.width, probe.height);
    const skew = estimateSkewAngleFromBinary(probeImg);
    if (Math.abs(skew) >= 0.35) {
      variants = variants.flatMap((v) => [v, rotateCanvas(v, -skew)]);
    }
  }

  const lang = getOcrLang();
  let best = '';
  let bestScore = -Infinity;
  for (let i = 0; i < variants.length; i += 1) {
    const variant = variants[i];
    const candidate = normalizeOcrTextByLang(window.OCRAD(variant));
    const score = scoreOcrTextByLang(candidate, lang);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
    if (i % 2 === 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
  return best;
}

function normalizeOcrTextByLang(text) {
  const lang = getOcrLang();
  let out = String(text || '').replace(/\s+/g, ' ').trim();
  if (!out) return '';
  if (lang === 'eng') {
    out = out.replace(/[^A-Za-z0-9 .,;:!?()\-]/g, '');
  } else if (lang === 'rus') {
    out = convertLatinLookalikesToCyrillic(out);
    if (state.settings?.ocrCyrillicOnly !== false) {
      out = out.replace(/[A-Za-z]/g, '');
    }
  } else {
    const cyr = (out.match(/[А-Яа-яЁё]/g) || []).length;
    const lat = (out.match(/[A-Za-z]/g) || []).length;
    if (lat > cyr * 1.4 && /[а-яё]/i.test(out) === false) {
      out = convertLatinLookalikesToCyrillic(out);
      if (state.settings?.ocrCyrillicOnly !== false) {
        out = out.replace(/[A-Za-z]/g, '');
      }
    }
  }
  return out.trim();
}

function applyAppLanguage() {
  const lang = state.settings?.appLang || 'ru';
  const t = {
    ru: {
      openSettings: 'Настройки',
      ocrPage: 'OCR страницы',
      ocrRegionOn: 'OCR область: on',
      ocrRegionOff: 'OCR область: off',
      copyOcr: 'Копировать OCR',
      searchBtn: 'Найти',
      searchPrev: '↑ Совпадение',
      searchNext: '↓ Совпадение',
      fitWidth: 'По ширине',
      fitPage: 'По странице',
      printPage: 'Печать страницы',
      downloadFile: 'Скачать',
      pageTextPlaceholder: 'Здесь появится извлечённый текст текущей страницы',
      settingsTitle: 'Настройки приложения',
      saveSettings: 'Сохранить',
      ocrQualityHint: `OCR DPI: не ниже ${OCR_MIN_DPI}`,
    },
    en: {
      openSettings: 'Settings',
      ocrPage: 'OCR page',
      ocrRegionOn: 'OCR region: on',
      ocrRegionOff: 'OCR region: off',
      copyOcr: 'Copy OCR',
      searchBtn: 'Search',
      searchPrev: '↑ Match',
      searchNext: '↓ Match',
      fitWidth: 'Fit width',
      fitPage: 'Fit page',
      printPage: 'Print page',
      downloadFile: 'Download',
      pageTextPlaceholder: 'Extracted text for current page appears here',
      settingsTitle: 'Application settings',
      saveSettings: 'Save',
      ocrQualityHint: `OCR DPI: not lower than ${OCR_MIN_DPI}`,
    },
  }[lang] || {};

  if (els.openSettingsModal) els.openSettingsModal.textContent = t.openSettings;
  if (els.ocrCurrentPage) els.ocrCurrentPage.textContent = t.ocrPage;
  if (els.copyOcrText) els.copyOcrText.textContent = t.copyOcr;
  if (els.searchBtn) els.searchBtn.textContent = t.searchBtn;
  if (els.searchPrev) els.searchPrev.textContent = t.searchPrev;
  if (els.searchNext) els.searchNext.textContent = t.searchNext;
  if (els.fitWidth) els.fitWidth.textContent = t.fitWidth;
  if (els.fitPage) els.fitPage.textContent = t.fitPage;
  if (els.printPage) els.printPage.textContent = t.printPage;
  if (els.downloadFile) els.downloadFile.textContent = t.downloadFile;
  if (els.pageText) els.pageText.placeholder = t.pageTextPlaceholder;
  if (els.saveSettingsModal) els.saveSettingsModal.textContent = t.saveSettings;
  if (els.ocrStatus && !state.adapter) els.ocrStatus.textContent = t.ocrQualityHint || '';
  const modalTitle = document.querySelector('#settingsModal .modal-head h3');
  if (modalTitle) modalTitle.textContent = t.settingsTitle;

  if (els.ocrRegionMode) {
    els.ocrRegionMode.textContent = state.ocrRegionMode ? t.ocrRegionOn : t.ocrRegionOff;
  }
}

function renderSectionVisibilityControls() {
  if (els.cfgSidebarSections) {
    els.cfgSidebarSections.innerHTML = '<h5>Сайдбар</h5>';
    SIDEBAR_SECTION_CONFIG.forEach((cfg) => {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.dataset.sectionType = 'sidebar';
      input.dataset.sectionKey = cfg.key;
      input.checked = (state.settings?.sidebarSections?.[cfg.key] ?? true);
      label.appendChild(input);
      label.append(` ${cfg.label}`);
      els.cfgSidebarSections.appendChild(label);
    });
  }

  if (els.cfgToolbarSections) {
    els.cfgToolbarSections.innerHTML = '<h5>Тулбар</h5>';
    TOOLBAR_SECTION_CONFIG.forEach((cfg) => {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.dataset.sectionType = 'toolbar';
      input.dataset.sectionKey = cfg.key;
      input.checked = (state.settings?.toolbarSections?.[cfg.key] ?? true);
      label.appendChild(input);
      label.append(` ${cfg.label}`);
      els.cfgToolbarSections.appendChild(label);
    });
  }
}

function applySectionVisibilitySettings() {
  const sidebar = state.settings?.sidebarSections || {};
  const toolbar = state.settings?.toolbarSections || {};

  document.querySelectorAll('[data-sidebar-section]').forEach((node) => {
    const key = node.dataset.sidebarSection;
    const visible = sidebar[key] ?? true;
    node.classList.toggle('section-hidden', !visible);
  });

  document.querySelectorAll('[data-toolbar-section]').forEach((node) => {
    const key = node.dataset.toolbarSection;
    const visible = toolbar[key] ?? true;
    node.classList.toggle('section-hidden', !visible);
  });
}


function openSettingsModal() {
  if (!els.settingsModal) return;
  const sidebarHidden = localStorage.getItem(uiLayoutKey('sidebarHidden')) === '1';
  const searchHidden = localStorage.getItem(uiLayoutKey('searchToolsHidden')) === '1';
  const annotHidden = localStorage.getItem(uiLayoutKey('annotToolsHidden')) === '1';
  const textHidden = localStorage.getItem(uiLayoutKey('textHidden')) === '1';

  if (els.cfgShowSidebar) els.cfgShowSidebar.checked = !sidebarHidden;
  if (els.cfgShowSearch) els.cfgShowSearch.checked = !searchHidden;
  if (els.cfgShowAnnot) els.cfgShowAnnot.checked = !annotHidden;
  if (els.cfgShowText) els.cfgShowText.checked = !textHidden;
  if (els.cfgTheme) els.cfgTheme.value = document.body.classList.contains('light') ? 'light' : 'dark';
  if (els.cfgAppLang) els.cfgAppLang.value = state.settings?.appLang || 'ru';
  if (els.cfgOcrLang) els.cfgOcrLang.value = state.settings?.ocrLang || 'auto';
  if (els.cfgOcrCyrillicOnly) els.cfgOcrCyrillicOnly.checked = state.settings?.ocrCyrillicOnly !== false;
  if (els.cfgOcrQualityMode) els.cfgOcrQualityMode.value = state.settings?.ocrQualityMode || 'balanced';
  if (els.cfgOcrMinW) els.cfgOcrMinW.value = String(state.settings?.ocrMinW || 24);
  if (els.cfgOcrMinH) els.cfgOcrMinH.value = String(state.settings?.ocrMinH || 24);
  if (els.cfgBackgroundOcr) els.cfgBackgroundOcr.checked = !!state.settings?.backgroundOcr;
  renderSectionVisibilityControls();

  els.settingsModal.classList.add('open');
  els.settingsModal.setAttribute('aria-hidden', 'false');
}

function closeSettingsModal() {
  if (!els.settingsModal) return;
  els.settingsModal.classList.remove('open');
  els.settingsModal.setAttribute('aria-hidden', 'true');
}

function saveSettingsFromModal() {
  const setHidden = (k, show) => localStorage.setItem(uiLayoutKey(k), show ? '0' : '1');
  if (els.cfgShowSidebar) setHidden('sidebarHidden', els.cfgShowSidebar.checked);
  if (els.cfgShowSearch) setHidden('searchToolsHidden', els.cfgShowSearch.checked);
  if (els.cfgShowAnnot) setHidden('annotToolsHidden', els.cfgShowAnnot.checked);
  if (els.cfgShowText) setHidden('textHidden', els.cfgShowText.checked);

  if (els.cfgTheme) {
    document.body.classList.toggle('light', els.cfgTheme.value === 'light');
    localStorage.setItem('novareader-theme', els.cfgTheme.value === 'light' ? 'light' : 'dark');
  }

  state.settings = state.settings || defaultSettings();
  if (els.cfgAppLang) state.settings.appLang = els.cfgAppLang.value || 'ru';
  if (els.cfgOcrLang) state.settings.ocrLang = els.cfgOcrLang.value || 'auto';
  if (els.cfgOcrCyrillicOnly) state.settings.ocrCyrillicOnly = !!els.cfgOcrCyrillicOnly.checked;
  if (els.cfgOcrQualityMode) state.settings.ocrQualityMode = els.cfgOcrQualityMode.value === 'accurate' ? 'accurate' : 'balanced';
  if (els.cfgOcrMinW) state.settings.ocrMinW = Math.max(8, Number(els.cfgOcrMinW.value) || 24);
  if (els.cfgOcrMinH) state.settings.ocrMinH = Math.max(8, Number(els.cfgOcrMinH.value) || 24);
  if (els.cfgBackgroundOcr) state.settings.backgroundOcr = !!els.cfgBackgroundOcr.checked;

  document.querySelectorAll('#cfgSidebarSections input[data-section-key]').forEach((input) => {
    state.settings.sidebarSections[input.dataset.sectionKey] = !!input.checked;
  });
  document.querySelectorAll('#cfgToolbarSections input[data-section-key]').forEach((input) => {
    state.settings.toolbarSections[input.dataset.sectionKey] = !!input.checked;
  });

  saveAppSettings();
  applyAppLanguage();
  applyLayoutState();
  applySectionVisibilitySettings();
  closeSettingsModal();
}

function setOcrStatus(text) {
  if (els.ocrStatus) els.ocrStatus.textContent = text;
}

function setOcrRegionMode(enabled) {
  state.ocrRegionMode = !!enabled;
  if (!state.ocrRegionMode) {
    state.isSelectingOcr = false;
    state.ocrSelection = null;
    renderAnnotations();
  }
  updateOverlayInteractionState();
  applyAppLanguage();
  setOcrStatus(state.ocrRegionMode ? 'OCR: выделите область на странице' : 'OCR: idle');
}

function drawOcrSelectionPreview() {
  if (!state.ocrSelection) return;
  const ctx = getCurrentAnnotationCtx();
  const p1 = denormalizePoint(state.ocrSelection.start);
  const p2 = denormalizePoint(state.ocrSelection.end);
  const x = Math.min(p1.x, p2.x);
  const y = Math.min(p1.y, p2.y);
  const w = Math.abs(p2.x - p1.x);
  const h = Math.abs(p2.y - p1.y);
  if (w < 2 || h < 2) return;
  ctx.save();
  ctx.strokeStyle = '#3b82f6';
  ctx.fillStyle = 'rgba(59,130,246,0.12)';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 4]);
  ctx.fillRect(x, y, w, h);
  ctx.strokeRect(x, y, w, h);
  ctx.restore();
}

async function runOcrOnRect(rect) {
  if (!state.adapter || !rect) return;
  try {
    await ensureOcrad();
    const rel = {
      x: rect.x / Math.max(1, els.canvas.width),
      y: rect.y / Math.max(1, els.canvas.height),
      w: rect.w / Math.max(1, els.canvas.width),
      h: rect.h / Math.max(1, els.canvas.height),
    };

    const ocrPageCanvas = await buildOcrSourceCanvas(state.currentPage);
    const src = cropCanvasByRelativeRect(ocrPageCanvas, rel);
    const text = await runOcrOnPreparedCanvas(src);
    if (text) {
      els.pageText.value = text;
      setOcrStatus(`OCR: распознано ${text.length} символов`);
    } else {
      setOcrStatus('OCR: текст не найден в выбранной области');
    }
  } catch {
    setOcrStatus('OCR: встроенный runtime недоступен');
  }
}

async function runOcrForCurrentPage() {
  if (!state.adapter) return;
  await runOcrOnRect({ x: 0, y: 0, w: els.canvas.width, h: els.canvas.height });
}

async function extractTextForPage(pageNumber) {
  if (!state.adapter) return '';
  let text = '';
  try {
    text = String(await state.adapter.getText(pageNumber) || '').trim();
  } catch {
    text = '';
  }
  if (text) return text;

  const cache = loadOcrTextData();
  if (Array.isArray(cache?.pagesText) && cache.pagesText[pageNumber - 1]) {
    return cache.pagesText[pageNumber - 1];
  }

  try {
    await ensureOcrad();
    const canvas = await buildOcrSourceCanvas(pageNumber);
    return await runOcrOnPreparedCanvas(canvas, { fast: true });
  } catch {
    return '';
  }
}

async function startBackgroundOcrScan() {
  if (!state.adapter || !state.pageCount) return;
  const token = Date.now();
  state.backgroundOcrToken = token;

  const existing = loadOcrTextData();
  const pagesText = Array.isArray(existing?.pagesText) ? [...existing.pagesText] : new Array(state.pageCount).fill('');
  const maxPages = Math.min(state.pageCount, 240);

  for (let i = 1; i <= maxPages; i += 1) {
    if (state.backgroundOcrToken != token) return;
    if (state.docName == null) return;
    if (pagesText[i - 1]) continue;

    const txt = await extractTextForPage(i);
    if (txt) {
      pagesText[i - 1] = txt;
      saveOcrTextData({
        pagesText,
        source: 'auto-ocr',
        scannedPages: i,
        totalPages: state.pageCount,
        updatedAt: new Date().toISOString(),
      });

      if (i === state.currentPage && !els.pageText.value) {
        els.pageText.value = txt;
      }
    }

    if (i % 2 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  setOcrStatus('OCR: фоновое распознавание завершено');
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

  if (state.ocrSelection) drawOcrSelectionPreview();

  els.annStats.textContent = `Штрихов: ${strokes.length} • Комментариев: ${comments.length}`;
}

function getCanvasPointFromEvent(e) {
  const rect = els.annotationCanvas.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * els.annotationCanvas.width;
  const y = ((e.clientY - rect.top) / rect.height) * els.annotationCanvas.height;
  return { x, y };
}

function beginStroke(e) {
  if (!state.adapter) return;

  if (state.ocrRegionMode && !state.drawEnabled) {
    const p = getCanvasPointFromEvent(e);
    const point = normalizePoint(p.x, p.y);
    state.isSelectingOcr = true;
    state.ocrSelection = { start: point, end: point };
    renderAnnotations();
    return;
  }

  if (!state.drawEnabled) return;
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
  if (state.ocrRegionMode && state.isSelectingOcr && state.ocrSelection) {
    const p = getCanvasPointFromEvent(e);
    state.ocrSelection.end = normalizePoint(p.x, p.y);
    renderAnnotations();
    return;
  }

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

async function endStroke() {
  if (state.ocrRegionMode && state.isSelectingOcr && state.ocrSelection) {
    state.isSelectingOcr = false;
    const a = denormalizePoint(state.ocrSelection.start);
    const b = denormalizePoint(state.ocrSelection.end);
    const rect = { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) };
    const minW = Math.max(8, Number(state.settings?.ocrMinW) || 24);
    const minH = Math.max(8, Number(state.settings?.ocrMinH) || 24);
    if (rect.w > minW && rect.h > minH) {
      await runOcrOnRect(rect);
    } else {
      setOcrStatus(`OCR: область меньше порога ${minW}x${minH}`);
    }
    state.ocrSelection = null;
    renderAnnotations();
    return;
  }

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
  ].join('\n');

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
      .split(/\r?\n/)
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

${lines.join('\n')}`;
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

async function isLikelyDjvuFile(file) {
  try {
    const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    const text = new TextDecoder('ascii', { fatal: false }).decode(header);
    return text.includes('AT&TFORM') || text.startsWith('AT&T');
  } catch {
    return false;
  }
}

async function extractDjvuFallbackText(file) {
  try {
    const sampleSize = Math.min(file.size, 2 * 1024 * 1024);
    const bytes = new Uint8Array(await file.slice(0, sampleSize).arrayBuffer());
    const latin = new TextDecoder('latin1', { fatal: false }).decode(bytes);
    const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    const merged = `${latin}\n${utf8}`;
    const chunks = merged.match(/[A-Za-zА-Яа-яЁё0-9][A-Za-zА-Яа-яЁё0-9 ,.:;!?()\-]{20,}/g) || [];
    let text = chunks
      .map((x) => x.replace(/\s+/g, ' ').trim())
      .filter((x) => x.length >= 20)
      .slice(0, 40)
      .join('\n');

    if (!text) {
      const normalized = utf8
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      text = normalized.length >= 20 ? normalized : '';
    }

    return text.slice(0, 5000);
  } catch {
    return '';
  }
}


async function openFile(file) {
  revokeCurrentObjectUrl();
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
  ensureTextToolsVisible();
  state.djvuBinaryDetected = false;

  const lower = file.name.toLowerCase();

  if (lower.endsWith('.pdf')) {
    try {
      const pdf = await ensurePdfJs();
      const data = await file.arrayBuffer();
      const pdfDoc = await pdf.getDocument({ data }).promise;
      state.adapter = new PDFAdapter(pdfDoc);
    } catch {
      state.adapter = new UnsupportedAdapter(file.name);
      els.searchStatus.textContent = 'Не удалось загрузить локальный PDF runtime. Проверьте целостность приложения.';
    }
  } else if (lower.endsWith('.djvu') || lower.endsWith('.djv')) {
    const djvuData = loadDjvuData();
    state.djvuBinaryDetected = await isLikelyDjvuFile(file);

    let openedByNative = false;
    try {
      const DjVu = await ensureDjVuJs();
      const data = await file.arrayBuffer();
      const doc = new DjVu.Document(data);
      state.adapter = new DjVuNativeAdapter(doc, file.name);
      openedByNative = true;
      els.searchStatus.textContent = 'DjVu файл открыт встроенным runtime.';
    } catch {
      const hasPageData = Array.isArray(djvuData?.pagesImages) && djvuData.pagesImages.length > 0;
      let effectiveDjvuData = djvuData;

      if (!hasPageData) {
        const fallbackText = await extractDjvuFallbackText(file);
        if (fallbackText) {
          effectiveDjvuData = {
            ...(djvuData || {}),
            pageCount: Math.max(1, Number(djvuData?.pageCount) || 1),
            pagesText: [fallbackText],
          };
        }
      }

      state.adapter = new DjVuAdapter(file.name, effectiveDjvuData);

      if (!hasPageData) {
        els.searchStatus.textContent = effectiveDjvuData?.pagesText?.[0]
          ? 'DjVu открыт в режиме совместимости. Для полного рендера нужен встроенный runtime файл app/vendor/djvu.js.'
          : 'DjVu-данные не найдены. Проверьте наличие app/vendor/djvu.js в поставке.';
      }
    }

    if (openedByNative) {
      saveDjvuData({});
    }
  } else if (/\.(png|jpe?g|webp|gif|bmp)$/i.test(lower)) {
    const url = URL.createObjectURL(file);
    state.currentObjectUrl = url;
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
  if (state.settings?.backgroundOcr) {
    startBackgroundOcrScan();
  } else {
    setOcrStatus('OCR: фоновое распознавание выключено в настройках');
  }
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

  const displayWidth = Math.max(1, Math.round(parseFloat(els.canvas.style.width || String(els.canvas.width))));
  const displayHeight = Math.max(1, Math.round(parseFloat(els.canvas.style.height || String(els.canvas.height))));
  els.annotationCanvas.width = displayWidth;
  els.annotationCanvas.height = displayHeight;
  els.annotationCanvas.style.width = `${displayWidth}px`;
  els.annotationCanvas.style.height = `${displayHeight}px`;

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
    const joinedBody = [current.body, incoming.body].filter(Boolean).join('\n\n');
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
  const prefix = els.notes.value ? '\n' : '';
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
  const v = (value || '').toLowerCase();
  if (v === 'arrowright') return '>';
  if (v === 'arrowleft') return '<';
  return value;
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
    next: normalizeHotkey(els.hkNext.value === '>' ? 'arrowright' : els.hkNext.value, defaultHotkeys.next),
    prev: normalizeHotkey(els.hkPrev.value === '<' ? 'arrowleft' : els.hkPrev.value, defaultHotkeys.prev),
    zoomIn: normalizeHotkey(els.hkZoomIn.value, defaultHotkeys.zoomIn),
    zoomOut: normalizeHotkey(els.hkZoomOut.value, defaultHotkeys.zoomOut),
    annotate: normalizeHotkey(els.hkAnnotate.value, defaultHotkeys.annotate),
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

    const actions = document.createElement('div');
    actions.className = 'inline-actions';

    const renameBtn = document.createElement('button');
    renameBtn.textContent = 'Переим.';
    renameBtn.addEventListener('click', () => {
      const next = prompt('Новое название закладки:', entry.label);
      if (!next) return;
      const all = loadBookmarks();
      const idx = all.findIndex((x) => x.page === entry.page && x.label === entry.label);
      if (idx >= 0) {
        all[idx].label = next.trim();
        saveBookmarks(all);
        renderBookmarks();
      }
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'Удалить';
    deleteBtn.addEventListener('click', () => {
      const all = loadBookmarks().filter((x) => !(x.page === entry.page && x.label === entry.label));
      saveBookmarks(all);
      renderBookmarks();
    });

    actions.appendChild(renameBtn);
    actions.appendChild(deleteBtn);
    li.appendChild(btn);
    li.appendChild(actions);
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
  const isDjvu = state.adapter?.type === 'djvu';
  if (els.importDjvuDataQuick) {
    els.importDjvuDataQuick.classList.toggle('is-hidden', !isDjvu);
  }
  const suffix = isDjvu && state.djvuBinaryDetected ? ' • DjVu binary detected' : '';
  els.docInfo.textContent = `${ext} • ${sizeMb} MB • ${state.pageCount} стр.${suffix}`;
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

function ensureTextToolsVisible() {
  const key = uiLayoutKey('textHidden');
  if (localStorage.getItem(key) === '1') {
    localStorage.setItem(key, '0');
    applyLayoutState();
  }
}

async function refreshPageText() {
  ensureTextToolsVisible();

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
  if (!text && state.adapter?.type === 'djvu') {
    if (state.adapter?.mode === 'compat') {
      els.searchStatus.textContent = 'Для расширенного текста DjVu можно импортировать DjVu data JSON или OCR JSON.';
    } else {
      els.searchStatus.textContent = 'В этом DjVu-документе текстовый слой отсутствует.';
    }
  }
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


function uiLayoutKey(name) {
  return `novareader-ui-layout:${name}`;
}

function applyAdvancedPanelsState() {
  const hidden = localStorage.getItem(uiLayoutKey('advancedHidden')) !== '0';
  document.body.classList.toggle('advanced-hidden', hidden);
  if (els.toggleAdvancedPanels) {
    els.toggleAdvancedPanels.textContent = `Расширенные панели: ${hidden ? 'off' : 'on'}`;
  }
}

function toggleAdvancedPanelsState() {
  const key = uiLayoutKey('advancedHidden');
  const hidden = localStorage.getItem(key) !== '0';
  localStorage.setItem(key, hidden ? '0' : '1');
  applyAdvancedPanelsState();
}

function applyLayoutState() {
  const sidebarRaw = localStorage.getItem(uiLayoutKey('sidebarHidden'));
  const toolsRaw = localStorage.getItem(uiLayoutKey('toolsHidden'));
  const textRaw = localStorage.getItem(uiLayoutKey('textHidden'));
  const searchToolsRaw = localStorage.getItem(uiLayoutKey('searchToolsHidden'));
  const annotToolsRaw = localStorage.getItem(uiLayoutKey('annotToolsHidden'));

  const sidebarHidden = sidebarRaw === '1';
  const toolsHidden = toolsRaw === '1';
  const textHidden = textRaw === null ? false : textRaw === '1';
  const searchToolsHidden = searchToolsRaw === null ? false : searchToolsRaw === '1';
  const annotToolsHidden = annotToolsRaw === null ? false : annotToolsRaw === '1';

  document.querySelector('.app-shell')?.classList.toggle('sidebar-hidden', sidebarHidden);
  document.querySelector('.viewer-area')?.classList.toggle('toolsbar-hidden', toolsHidden);
  document.querySelector('.viewer-area')?.classList.toggle('texttools-hidden', textHidden);
  document.querySelector('.viewer-area')?.classList.toggle('searchtools-hidden', searchToolsHidden);
  document.querySelector('.viewer-area')?.classList.toggle('annottools-hidden', annotToolsHidden);

  if (els.toggleSidebar) els.toggleSidebar.textContent = `Сайдбар: ${sidebarHidden ? 'off' : 'on'}`;
  if (els.toggleToolsBar) els.toggleToolsBar.textContent = `Панель инструментов: ${toolsHidden ? 'off' : 'on'}`;
  if (els.toggleTextTools) els.toggleTextTools.textContent = `Текстовый блок: ${textHidden ? 'off' : 'on'}`;
  if (els.toggleSearchTools) els.toggleSearchTools.textContent = `Поиск-панель: ${searchToolsHidden ? 'off' : 'on'}`;
  if (els.toggleAnnotTools) els.toggleAnnotTools.textContent = `Панель инструментов: ${annotToolsHidden ? 'off' : 'on'}`;
  if (els.toggleTextToolsInline) els.toggleTextToolsInline.textContent = textHidden ? 'Развернуть' : 'Свернуть';
}

function toggleLayoutState(name) {
  const key = uiLayoutKey(name);
  const next = localStorage.getItem(key) === '1' ? '0' : '1';
  localStorage.setItem(key, next);
  applyLayoutState();
}

function applyResizableLayoutState() {
  const sidebarWidth = Number(localStorage.getItem(uiLayoutKey('sidebarWidth')) || 360);
  const pageAreaPx = Number(localStorage.getItem(uiLayoutKey('pageAreaPx')) || 0);
  const safeSidebar = Math.max(260, Math.min(560, sidebarWidth));
  const safePage = Math.max(220, Math.min(2400, pageAreaPx || 0));
  document.querySelector('.app-shell')?.style.setProperty('--sidebar-width', `${safeSidebar}px`);
  if (pageAreaPx > 0) {
    document.querySelector('.viewer-area')?.style.setProperty('--page-area-height', `${safePage}px`);
  }
}

function setupResizableLayout() {
  applyResizableLayoutState();

  if (els.sidebarResizeHandle) {
    let active = false;
    const onMove = (e) => {
      if (!active) return;
      const safe = Math.max(260, Math.min(560, e.clientX));
      localStorage.setItem(uiLayoutKey('sidebarWidth'), String(Math.round(safe)));
      applyResizableLayoutState();
    };
    els.sidebarResizeHandle.addEventListener('pointerdown', (e) => {
      active = true;
      els.sidebarResizeHandle.setPointerCapture?.(e.pointerId);
    });
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', () => { active = false; });
  }

  if (els.canvasResizeHandle) {
    let active = false;
    const onMove = (e) => {
      if (!active) return;
      const viewerArea = document.querySelector('.viewer-area');
      const toolbarBottom = document.querySelector('.toolbar-bottom');
      const textTools = document.getElementById('textToolsSection');
      if (!viewerArea) return;
      if (!toolbarBottom) return;
      const rect = viewerArea.getBoundingClientRect();
      const minTextHeight = textTools && !viewerArea.classList.contains('texttools-hidden') ? 140 : 0;
      const topOffset = toolbarBottom.getBoundingClientRect().bottom - rect.top;
      const maxPageHeight = Math.max(220, rect.height - topOffset - minTextHeight - 8);
      const pageHeight = e.clientY - rect.top - topOffset;
      const safePageHeight = Math.max(220, Math.min(maxPageHeight, pageHeight));
      localStorage.setItem(uiLayoutKey('pageAreaPx'), String(Math.round(safePageHeight)));
      applyResizableLayoutState();
    };
    els.canvasResizeHandle.addEventListener('pointerdown', (e) => {
      active = true;
      els.canvasResizeHandle.setPointerCapture?.(e.pointerId);
    });
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', () => { active = false; });
  }
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
els.toggleAdvancedPanels?.addEventListener('click', toggleAdvancedPanelsState);
els.openSettingsModal?.addEventListener('click', openSettingsModal);
els.closeSettingsModal?.addEventListener('click', closeSettingsModal);
els.saveSettingsModal?.addEventListener('click', saveSettingsFromModal);
els.settingsModal?.addEventListener('click', (e) => { if (e.target === els.settingsModal) closeSettingsModal(); });

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
  if (state.settings?.backgroundOcr) startBackgroundOcrScan();
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
els.applyCommonHotkeys?.addEventListener('click', () => {
  applyCommonHotkeys();
  setSettingsStatus('Применены стандартные hotkeys.');
});
els.toggleSidebarCompact?.addEventListener('click', () => {
  const enabled = !document.body.classList.contains('sidebar-compact');
  setSidebarCompactMode(enabled);
  setSettingsStatus(enabled ? 'Включён компактный режим панели.' : 'Компактный режим отключён.');
});
els.collapseSidebarSections?.addEventListener('click', () => {
  setSidebarSectionsCollapsed(true);
  setSettingsStatus('Разделы панели свернуты.');
});
els.expandSidebarSections?.addEventListener('click', () => {
  setSidebarSectionsCollapsed(false);
  setSettingsStatus('Разделы панели развернуты.');
});
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
els.importDjvuDataQuick?.addEventListener('click', () => els.importDjvuDataJson?.click());
els.refreshText.addEventListener('click', refreshPageText);
els.copyText.addEventListener('click', copyPageText);
els.exportText.addEventListener('click', exportPageText);
els.ocrCurrentPage?.addEventListener('click', async () => {
  await runOcrForCurrentPage();
});
els.ocrRegionMode?.addEventListener('click', () => {
  setOcrRegionMode(!state.ocrRegionMode);
});
els.copyOcrText?.addEventListener('click', async () => {
  if (!els.pageText.value) return;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(els.pageText.value);
      setOcrStatus('OCR: текст скопирован');
    }
  } catch {
    setOcrStatus('OCR: не удалось скопировать текст');
  }
});
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
els.toggleSidebar?.addEventListener('click', () => toggleLayoutState('sidebarHidden'));
els.toggleToolsBar?.addEventListener('click', () => toggleLayoutState('toolsHidden'));
els.toggleTextTools?.addEventListener('click', () => toggleLayoutState('textHidden'));
els.toggleSearchTools?.addEventListener('click', () => toggleLayoutState('searchToolsHidden'));
els.toggleAnnotTools?.addEventListener('click', () => toggleLayoutState('annotToolsHidden'));
els.toggleTextToolsInline?.addEventListener('click', () => toggleLayoutState('textHidden'));

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


function setSettingsStatus(message) {
  if (!els.settingsStatus) return;
  els.settingsStatus.textContent = message;
}

function uiSidebarCompactKey() {
  return 'novareader-ui-compact-sidebar';
}

function setSidebarCompactMode(enabled) {
  document.body.classList.toggle('sidebar-compact', !!enabled);
  if (els.toggleSidebarCompact) {
    els.toggleSidebarCompact.textContent = `Компактная панель: ${enabled ? 'on' : 'off'}`;
  }
  localStorage.setItem(uiSidebarCompactKey(), enabled ? '1' : '0');
}

function loadSidebarCompactMode() {
  const enabled = localStorage.getItem(uiSidebarCompactKey()) === '1';
  setSidebarCompactMode(enabled);
}

function setSidebarSectionsCollapsed(collapsed) {
  document.querySelectorAll('.sidebar > section').forEach((section) => {
    section.classList.toggle('collapsed', collapsed);
  });
  localStorage.setItem(uiLayoutKey('sectionsCollapsed'), collapsed ? '1' : '0');
}

function restoreSidebarSectionsCollapsed() {
  const raw = localStorage.getItem(uiLayoutKey('sectionsCollapsed'));
  const collapsed = raw === null ? true : raw === '1';
  setSidebarSectionsCollapsed(collapsed);
}

function initSidebarSections() {
  document.querySelectorAll('.sidebar > section > h2').forEach((title) => {
    title.classList.add('section-toggle');
    title.title = 'Клик: свернуть/развернуть';
    title.addEventListener('click', () => {
      title.parentElement?.classList.toggle('collapsed');
    });
  });
}

function applyCommonHotkeys() {
  hotkeys = { ...defaultHotkeys };
  localStorage.setItem('novareader-hotkeys', JSON.stringify(hotkeys));
  renderHotkeyInputs();
  setHotkeysInputErrors([]);
  setHotkeysStatus('Применены стандартные hotkeys.', 'success');
}

window.addEventListener('beforeunload', revokeCurrentObjectUrl);

document.addEventListener('keydown', async (e) => {
  const key = e.key.toLowerCase();
  const combo = stringifyHotkeyEvent(e);
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

  if (combo && combo === hotkeys.next) els.nextPage.click();
  if (combo && combo === hotkeys.prev) els.prevPage.click();
  if (combo && combo === hotkeys.zoomIn) els.zoomIn.click();
  if (combo && combo === hotkeys.zoomOut) els.zoomOut.click();
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
  if (combo && combo === hotkeys.annotate) {
    e.preventDefault();
    setDrawMode(!state.drawEnabled);
  }
  if (e.key === 'Escape' && state.drawEnabled) {
    setDrawMode(false);
  }
  if (e.key === 'Escape' && state.ocrRegionMode) {
    setOcrRegionMode(false);
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
loadAppSettings();
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
initSidebarSections();
restoreSidebarSectionsCollapsed();
loadSidebarCompactMode();
initReleaseGuards();
renderEtaStatus();
renderReadingGoalStatus();
setupDragAndDrop();
setupAnnotationEvents();
setupResizableLayout();
applyLayoutState();
applySectionVisibilitySettings();
applyAdvancedPanelsState();
applyAppLanguage();
setDrawMode(false);
setOcrRegionMode(false);
