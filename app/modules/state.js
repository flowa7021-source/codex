// @ts-check
// ─── Reactive State Store ────────────────────────────────────────────────────

function createReactiveState(initial) {
  const listeners = {};       // field -> Set<callback>
  const data = { ...initial };
  let batchDepth = 0;
  const batchedChanges = new Map(); // field -> { oldValue, newValue }

  function getListenerSet(field) {
    if (!listeners[field]) listeners[field] = new Set();
    return listeners[field];
  }

  function emitChange(field, oldValue, newValue) {
    const set = listeners[field];
    if (!set) return;
    for (const cb of set) {
      try { cb(newValue, oldValue, field); } catch (_) { /* observer must not break state */ }
    }
  }

  const proxy = new Proxy(data, {
    get(target, prop) {
      if (prop === 'on') return (field, cb) => { getListenerSet(field).add(cb); };
      if (prop === 'off') return (field, cb) => { getListenerSet(field).delete(cb); };
      if (prop === 'batch') return (fn) => {
        if (batchDepth > 0) { fn(); return; }
        batchDepth++;
        try {
          fn();
        } finally {
          batchDepth--;
          if (batchDepth === 0) {
            const pending = new Map(batchedChanges);
            batchedChanges.clear();
            for (const [field, { oldValue, newValue }] of pending) {
              emitChange(field, oldValue, newValue);
            }
          }
        }
      };
      return target[prop];
    },
    set(target, prop, value) {
      const oldValue = target[prop];
      if (oldValue === value) return true;  // shallow equality — skip
      target[prop] = value;
      if (batchDepth > 0) {
        // Keep the original oldValue from before the batch started
        const existing = batchedChanges.get(prop);
        if (existing) {
          existing.newValue = value;
          // If batched back to original, remove from pending
          if (existing.oldValue === value) batchedChanges.delete(prop);
        } else {
          batchedChanges.set(prop, { oldValue, newValue: value });
        }
      } else {
        emitChange(prop, oldValue, value);
      }
      return true;
    }
  });

  return proxy;
}

export const state = createReactiveState({
  adapter: null,
  file: null,
  pdfBytes: null,
  pdfLibDoc: null,
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
  backgroundOcrTimer: null,
  backgroundOcrRunning: false,
  settings: null,
  pageSkewAngles: {},
  pageSkewPromises: {},
  ocrTaskId: 0,
  ocrJobRunning: false,
  ocrQueue: Promise.resolve(),
  ocrQueueEpoch: 0,
  ocrLatestByReason: {},
  ocrLastProgressUiAt: 0,
  ocrLastProgressText: '',
  ocrConfidenceMode: false,
  ocrSourceCache: new Map(),
  ocrCacheLastDiagAt: 0,
  ocrCacheLastHitDiagAt: 0,
  ocrCacheHitCount: 0,
  ocrCacheExpireCount: 0,
  ocrCacheLastExpireDiagAt: 0,
  ocrCacheMissCount: 0,
  ocrCacheLastMissDiagAt: 0,
  ocrCacheOpsCount: 0,
  textEditMode: false,
  pdfEditState: null,
  lastDocxImportHtml: null,
  lastDocxImportBlocks: null,
  eventListenerRegistry: new Map(),
  minimapEnabled: true,
  initComplete: false,
  diagnostics: { events: [], maxEvents: 500, sessionId: `nr-${Date.now().toString(36)}` },
});

export const defaultHotkeys = {
  next: 'pagedown',
  prev: 'pageup',
  zoomIn: 'ctrl+=',
  zoomOut: 'ctrl+-',
  annotate: 'ctrl+shift+a',
  searchFocus: 'ctrl+f',
  ocrPage: 'ctrl+shift+o',
  fitWidth: 'ctrl+9',
  fitPage: 'ctrl+0',
};

export let hotkeys = { ...defaultHotkeys };

export function setHotkeys(newHotkeys) {
  hotkeys = newHotkeys;
}

export const els = {
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
  hkSearchFocus: document.getElementById('hkSearchFocus'),
  hkOcrPage: document.getElementById('hkOcrPage'),
  hkFitWidth: document.getElementById('hkFitWidth'),
  hkFitPage: document.getElementById('hkFitPage'),
  hkNextHint: document.getElementById('hkNextHint'),
  hkPrevHint: document.getElementById('hkPrevHint'),
  hkZoomInHint: document.getElementById('hkZoomInHint'),
  hkZoomOutHint: document.getElementById('hkZoomOutHint'),
  hkAnnotateHint: document.getElementById('hkAnnotateHint'),
  hkSearchFocusHint: document.getElementById('hkSearchFocusHint'),
  hkOcrPageHint: document.getElementById('hkOcrPageHint'),
  hkFitWidthHint: document.getElementById('hkFitWidthHint'),
  hkFitPageHint: document.getElementById('hkFitPageHint'),
  saveHotkeys: document.getElementById('saveHotkeys'),
  resetHotkeys: document.getElementById('resetHotkeys'),
  autoFixHotkeys: document.getElementById('autoFixHotkeys'),
  hotkeysStatus: document.getElementById('hotkeysStatus'),
  settingsStatus: document.getElementById('settingsStatus'),
  exportDiagnostics: document.getElementById('exportDiagnostics'),
  clearDiagnostics: document.getElementById('clearDiagnostics'),
  diagnosticsStatus: document.getElementById('diagnosticsStatus'),
  runRuntimeSelfCheck: document.getElementById('runRuntimeSelfCheck'),
  runtimeCheckStatus: document.getElementById('runtimeCheckStatus'),
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
  searchToolsGroup: document.getElementById('searchToolsGroup'),  // may be null in redesigned UI
  statusBar: document.getElementById('statusBar'),
  sbPage: document.getElementById('sbPage'),
  sbZoom: document.getElementById('sbZoom'),
  sbOcr: document.getElementById('sbOcr'),
  sbFileSize: document.getElementById('sbFileSize'),
  sbReadingTime: document.getElementById('sbReadingTime'),
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
  exportWord: document.getElementById('exportWord'),
  importDocx: document.getElementById('importDocx'),
  exportOcrIndex: document.getElementById('exportOcrIndex'),
  undoTextEdit: document.getElementById('undoTextEdit'),
  redoTextEdit: document.getElementById('redoTextEdit'),
  exportHealthReport: document.getElementById('exportHealthReport'),
  toggleTextEdit: document.getElementById('toggleTextEdit'),
  saveTextEdits: document.getElementById('saveTextEdits'),
  ocrCurrentPage: document.getElementById('ocrCurrentPage'),
  ocrRegionMode: document.getElementById('ocrRegionMode'),
  copyOcrText: document.getElementById('copyOcrText'),
  cancelBackgroundOcr: document.getElementById('cancelBackgroundOcr'),
  ocrStatus: document.getElementById('ocrStatus'),
  pageText: document.getElementById('pageText'),
  openSettingsModal: document.getElementById('openSettingsModal'),
  closeSettingsModal: document.getElementById('closeSettingsModal'),
  saveSettingsModal: document.getElementById('saveSettingsModal'),
  resetUiSizeDefaults: document.getElementById('resetUiSizeDefaults'),
  settingsModal: document.getElementById('settingsModal'),
  cfgShowSidebar: document.getElementById('cfgShowSidebar'),
  cfgShowSearch: document.getElementById('cfgShowSearch'),
  cfgShowAnnot: document.getElementById('cfgShowAnnot'),
  cfgShowText: document.getElementById('cfgShowText'),
  cfgSidebarWidth: document.getElementById('cfgSidebarWidth'),
  cfgToolbarScale: document.getElementById('cfgToolbarScale'),
  cfgTextMinHeight: document.getElementById('cfgTextMinHeight'),
  cfgPageAreaHeight: document.getElementById('cfgPageAreaHeight'),
  cfgTopToolbarHeight: document.getElementById('cfgTopToolbarHeight'),
  cfgBottomToolbarHeight: document.getElementById('cfgBottomToolbarHeight'),
  cfgTextPanelHeight: document.getElementById('cfgTextPanelHeight'),
  cfgAnnotationCanvasScale: document.getElementById('cfgAnnotationCanvasScale'),
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
  exportAnnSvg: document.getElementById('exportAnnSvg'),
  exportAnnPdf: document.getElementById('exportAnnPdf'),
  pdfFormFill: document.getElementById('pdfFormFill'),
  pdfFormExport: document.getElementById('pdfFormExport'),
  pdfFormImport: document.getElementById('pdfFormImport'),
  pdfFormClear: document.getElementById('pdfFormClear'),
  pdfBlockEdit: document.getElementById('pdfBlockEdit'),
  insertImageInput: document.getElementById('insertImageInput'),
  addWatermark: document.getElementById('addWatermark'),
  addStamp: document.getElementById('addStamp'),
  addSignature: document.getElementById('addSignature'),
  mergePages: document.getElementById('mergePages'),
  splitPages: document.getElementById('splitPages'),
  textLayerDiv: document.getElementById('textLayerDiv'),
  pdfAnnotationLayer: document.getElementById('pdfAnnotationLayer'),
  canvasStack: document.getElementById('canvasStack'),
  addBookmarkToolbar: document.getElementById('addBookmarkToolbar'),
  conversionInvoice: document.getElementById('conversionInvoice'),
  conversionReport: document.getElementById('conversionReport'),
  conversionTable: document.getElementById('conversionTable'),
  toggleOcrConfidence: document.getElementById('toggleOcrConfidence'),
  ocrStorageInfo: document.getElementById('ocrStorageInfo'),
  refreshOcrStorage: document.getElementById('refreshOcrStorage'),
  clearCurrentOcrData: document.getElementById('clearCurrentOcrData'),
  clearAllOcrData: document.getElementById('clearAllOcrData'),
  ocrDocumentsList: document.getElementById('ocrDocumentsList'),
};
