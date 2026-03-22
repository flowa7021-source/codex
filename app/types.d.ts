// ─── NovaReader Global Type Declarations ────────────────────────────────────

// ─── DOM Element Map (els) ──────────────────────────────────────────────────

/**
 * Typed map of all DOM element references used in the application.
 * Mirrors the `els` export from app/modules/state.js.
 */
interface NovaEls {
  // File input
  fileInput: HTMLInputElement | null;
  insertImageInput: HTMLInputElement | null;
  importDjvuDataJson: HTMLElement | null;
  importDjvuDataQuick: HTMLElement | null;

  // App info
  appVersion: HTMLElement | null;

  // Recent files
  recentList: HTMLElement | null;
  clearRecent: HTMLElement | null;

  // Advanced panels
  toggleAdvancedPanels: HTMLElement | null;

  // Notes
  notesTitle: HTMLInputElement | null;
  notesTags: HTMLInputElement | null;
  notes: HTMLTextAreaElement | null;
  notesStatus: HTMLElement | null;
  saveNotes: HTMLElement | null;
  exportNotes: HTMLElement | null;
  exportNotesMd: HTMLElement | null;
  exportNotesJson: HTMLElement | null;
  importNotesJson: HTMLElement | null;
  notesImportMode: HTMLSelectElement | null;
  insertTimestamp: HTMLElement | null;

  // Hotkey inputs (text inputs for key bindings)
  hkNext: HTMLInputElement | null;
  hkPrev: HTMLInputElement | null;
  hkZoomIn: HTMLInputElement | null;
  hkZoomOut: HTMLInputElement | null;
  hkAnnotate: HTMLInputElement | null;
  hkSearchFocus: HTMLInputElement | null;
  hkOcrPage: HTMLInputElement | null;
  hkFitWidth: HTMLInputElement | null;
  hkFitPage: HTMLInputElement | null;

  // Hotkey hints
  hkNextHint: HTMLElement | null;
  hkPrevHint: HTMLElement | null;
  hkZoomInHint: HTMLElement | null;
  hkZoomOutHint: HTMLElement | null;
  hkAnnotateHint: HTMLElement | null;
  hkSearchFocusHint: HTMLElement | null;
  hkOcrPageHint: HTMLElement | null;
  hkFitWidthHint: HTMLElement | null;
  hkFitPageHint: HTMLElement | null;

  // Hotkey actions
  saveHotkeys: HTMLElement | null;
  resetHotkeys: HTMLElement | null;
  autoFixHotkeys: HTMLElement | null;
  hotkeysStatus: HTMLElement | null;
  applyCommonHotkeys: HTMLElement | null;

  // Settings / Diagnostics
  settingsStatus: HTMLElement | null;
  exportDiagnostics: HTMLElement | null;
  clearDiagnostics: HTMLElement | null;
  diagnosticsStatus: HTMLElement | null;
  runRuntimeSelfCheck: HTMLElement | null;
  runtimeCheckStatus: HTMLElement | null;

  // Sidebar controls
  toggleSidebarCompact: HTMLElement | null;
  collapseSidebarSections: HTMLElement | null;
  expandSidebarSections: HTMLElement | null;

  // Workspace
  exportWorkspace: HTMLElement | null;
  importWorkspace: HTMLElement | null;
  workspaceStatus: HTMLElement | null;
  importOcrJson: HTMLElement | null;

  // Cloud sync
  cloudSyncUrl: HTMLInputElement | null;
  saveCloudSyncUrl: HTMLElement | null;
  pushCloudSync: HTMLElement | null;
  pullCloudSync: HTMLElement | null;
  toggleCollab: HTMLElement | null;
  broadcastCollab: HTMLElement | null;
  stage4Status: HTMLElement | null;

  // Reading progress
  progressStatus: HTMLElement | null;
  resetProgress: HTMLElement | null;
  readingTimeStatus: HTMLElement | null;
  resetReadingTime: HTMLElement | null;
  etaStatus: HTMLElement | null;
  readingGoalPage: HTMLInputElement | null;
  saveReadingGoal: HTMLElement | null;
  clearReadingGoal: HTMLElement | null;
  readingGoalStatus: HTMLElement | null;
  visitTrailList: HTMLElement | null;
  clearVisitTrail: HTMLElement | null;
  docStats: HTMLElement | null;

  // Search history
  searchHistoryList: HTMLElement | null;
  clearSearchHistory: HTMLElement | null;
  exportSearchHistory: HTMLElement | null;
  exportSearchHistoryTxt: HTMLElement | null;
  copySearchHistory: HTMLElement | null;
  importSearchHistoryJson: HTMLElement | null;

  // Search results
  searchResultsList: HTMLElement | null;
  clearSearchResults: HTMLElement | null;
  exportSearchResults: HTMLElement | null;
  exportSearchResultsCsv: HTMLElement | null;
  exportSearchSummaryTxt: HTMLElement | null;
  importSearchResultsJson: HTMLElement | null;
  importSearchResultsCsv: HTMLElement | null;
  copySearchResults: HTMLElement | null;

  // Navigation
  historyBack: HTMLElement | null;
  historyForward: HTMLElement | null;
  prevPage: HTMLElement | null;
  nextPage: HTMLElement | null;
  pageStatus: HTMLElement | null;
  pageInput: HTMLInputElement | null;
  goToPage: HTMLElement | null;

  // Zoom / Rotate
  zoomOut: HTMLElement | null;
  zoomIn: HTMLElement | null;
  fitWidth: HTMLElement | null;
  fitPage: HTMLElement | null;
  zoomStatus: HTMLElement | null;
  rotate: HTMLElement | null;

  // Canvas
  canvas: HTMLCanvasElement | null;
  annotationCanvas: HTMLCanvasElement | null;
  canvasWrap: HTMLElement | null;
  canvasStack: HTMLElement | null;
  emptyState: HTMLElement | null;

  // Search bar
  searchInput: HTMLInputElement | null;
  searchScope: HTMLSelectElement | null;
  searchBtn: HTMLElement | null;
  searchPrev: HTMLElement | null;
  searchNext: HTMLElement | null;
  searchStatus: HTMLElement | null;
  searchToolsGroup: HTMLElement | null;

  // Status bar
  statusBar: HTMLElement | null;
  sbPage: HTMLElement | null;
  sbZoom: HTMLElement | null;
  sbOcr: HTMLElement | null;
  sbFileSize: HTMLElement | null;
  sbReadingTime: HTMLElement | null;

  // Theme / Fullscreen / Sidebar
  themeToggle: HTMLElement | null;
  fullscreen: HTMLElement | null;
  shortcutsHelp: HTMLElement | null;
  toggleSidebar: HTMLElement | null;
  toggleToolsBar: HTMLElement | null;
  toggleTextTools: HTMLElement | null;
  toggleSearchTools: HTMLElement | null;
  toggleAnnotTools: HTMLElement | null;
  toggleTextToolsInline: HTMLElement | null;
  textToolsSection: HTMLElement | null;

  // Bookmarks
  addBookmark: HTMLElement | null;
  clearBookmarks: HTMLElement | null;
  exportBookmarks: HTMLElement | null;
  importBookmarks: HTMLElement | null;
  bookmarkFilter: HTMLInputElement | null;
  clearBookmarkFilter: HTMLElement | null;
  bookmarksStatus: HTMLElement | null;
  bookmarkList: HTMLElement | null;
  addBookmarkToolbar: HTMLElement | null;

  // Outline / Page preview
  outlineList: HTMLElement | null;
  pagePreviewList: HTMLElement | null;

  // File actions
  downloadFile: HTMLElement | null;
  printPage: HTMLElement | null;
  docInfo: HTMLElement | null;

  // Text tools
  refreshText: HTMLElement | null;
  copyText: HTMLElement | null;
  exportText: HTMLElement | null;
  exportWord: HTMLElement | null;
  importDocx: HTMLElement | null;
  exportOcrIndex: HTMLElement | null;
  undoTextEdit: HTMLElement | null;
  redoTextEdit: HTMLElement | null;
  exportHealthReport: HTMLElement | null;
  toggleTextEdit: HTMLElement | null;
  saveTextEdits: HTMLElement | null;
  pageText: HTMLElement | null;

  // OCR
  ocrCurrentPage: HTMLElement | null;
  ocrRegionMode: HTMLElement | null;
  copyOcrText: HTMLElement | null;
  cancelBackgroundOcr: HTMLElement | null;
  ocrStatus: HTMLElement | null;
  toggleOcrConfidence: HTMLElement | null;
  ocrStorageInfo: HTMLElement | null;
  refreshOcrStorage: HTMLElement | null;
  clearCurrentOcrData: HTMLElement | null;
  clearAllOcrData: HTMLElement | null;
  ocrDocumentsList: HTMLElement | null;

  // Settings modal
  openSettingsModal: HTMLElement | null;
  closeSettingsModal: HTMLElement | null;
  saveSettingsModal: HTMLElement | null;
  resetUiSizeDefaults: HTMLElement | null;
  settingsModal: HTMLElement | null;

  // Settings: checkboxes
  cfgShowSidebar: HTMLInputElement | null;
  cfgShowSearch: HTMLInputElement | null;
  cfgShowAnnot: HTMLInputElement | null;
  cfgShowText: HTMLInputElement | null;
  cfgOcrCyrillicOnly: HTMLInputElement | null;
  cfgBackgroundOcr: HTMLInputElement | null;

  // Settings: number inputs
  cfgSidebarWidth: HTMLInputElement | null;
  cfgToolbarScale: HTMLInputElement | null;
  cfgTextMinHeight: HTMLInputElement | null;
  cfgPageAreaHeight: HTMLInputElement | null;
  cfgTopToolbarHeight: HTMLInputElement | null;
  cfgBottomToolbarHeight: HTMLInputElement | null;
  cfgTextPanelHeight: HTMLInputElement | null;
  cfgAnnotationCanvasScale: HTMLInputElement | null;
  cfgOcrMinW: HTMLInputElement | null;
  cfgOcrMinH: HTMLInputElement | null;

  // Settings: selects
  cfgTheme: HTMLSelectElement | null;
  cfgAppLang: HTMLSelectElement | null;
  cfgOcrLang: HTMLSelectElement | null;
  cfgOcrQualityMode: HTMLSelectElement | null;

  // Settings: section containers
  cfgSidebarSections: HTMLElement | null;
  cfgToolbarSections: HTMLElement | null;

  // Sidebar resize
  sidebarResizeHandle: HTMLElement | null;
  canvasResizeHandle: HTMLElement | null;

  // Annotation tools
  annotateToggle: HTMLElement | null;
  drawTool: HTMLSelectElement | null;
  drawColor: HTMLInputElement | null;
  drawSize: HTMLInputElement | null;
  undoStroke: HTMLElement | null;
  clearStrokes: HTMLElement | null;
  exportAnnotated: HTMLElement | null;
  exportAnnJson: HTMLElement | null;
  importAnnJson: HTMLElement | null;
  exportAnnBundle: HTMLElement | null;
  importAnnBundle: HTMLElement | null;
  annStats: HTMLElement | null;
  commentList: HTMLElement | null;
  clearComments: HTMLElement | null;
  exportAnnSvg: HTMLElement | null;
  exportAnnPdf: HTMLElement | null;

  // PDF form / edit
  pdfFormFill: HTMLElement | null;
  pdfFormExport: HTMLElement | null;
  pdfFormImport: HTMLElement | null;
  pdfFormClear: HTMLElement | null;
  pdfBlockEdit: HTMLElement | null;
  addWatermark: HTMLElement | null;
  addStamp: HTMLElement | null;
  addSignature: HTMLElement | null;
  mergePages: HTMLElement | null;
  splitPages: HTMLElement | null;

  // Text / annotation layers
  textLayerDiv: HTMLElement | null;
  pdfAnnotationLayer: HTMLElement | null;

  // Conversion tools
  conversionInvoice: HTMLElement | null;
  conversionReport: HTMLElement | null;
  conversionTable: HTMLElement | null;
}

// ─── Window Augmentation (global _nova* properties) ─────────────────────────

interface Window {
  // Listener registry
  _listenerRegistry: any;
  _cleanupAllListeners: () => void;

  // Toast notifications
  _toast: {
    toast: (msg: string, opts?: any) => any;
    toastSuccess: (msg: string, opts?: any) => any;
    toastError: (msg: string, opts?: any) => any;
    toastWarning: (msg: string, opts?: any) => any;
    toastInfo: (msg: string, opts?: any) => any;
    toastProgress: (msg: string, opts?: any) => any;
    dismissAllToasts: () => void;
  };

  // View modes
  _viewModes: {
    setViewMode: (mode: string) => void;
    getCurrentMode: () => string;
    VIEW_MODES: Record<string, string>;
  };

  // Advanced tools
  _advancedToolsHandle: { destroy: () => void } | null;
  _bootstrapAdvancedTools: () => void;

  // Event bus
  _eventBus: any;

  // PDF security
  _pdfSecurity: {
    setPassword: (...args: any[]) => any;
    cleanMetadata: (...args: any[]) => any;
    getSecurityInfo: (...args: any[]) => any;
    sanitizePdf: (...args: any[]) => any;
  };

  // Text editing
  _textEdit: {
    applyTextEdits: (...args: any[]) => any;
    addTextBlock: (...args: any[]) => any;
    findAndReplace: (...args: any[]) => any;
    spellCheck: (...args: any[]) => any;
    getAvailableFonts: (...args: any[]) => any;
  };

  // OCR correction
  _ocrCorrect: {
    correctOcrText: (...args: any[]) => any;
    buildDictionary: (...args: any[]) => any;
    recoverParagraphs: (...args: any[]) => any;
    computeQualityScore: (...args: any[]) => any;
  };

  // Text extraction
  _textExtractor: {
    extractTextInReadingOrder: (...args: any[]) => any;
    extractMultiPageText: (...args: any[]) => any;
    downloadText: (...args: any[]) => any;
  };

  // Worker pool
  _workerPool: {
    WorkerPool: any;
    initOcrPool: (...args: any[]) => any;
    getOcrPool: (...args: any[]) => any;
    runInWorker: (...args: any[]) => any;
  };

  // Indexed storage
  _indexedStorage: {
    openDatabase: (...args: any[]) => any;
    cachePageRender: (...args: any[]) => any;
    getCachedPageRender: (...args: any[]) => any;
    clearDocumentCache: (...args: any[]) => any;
    getStorageUsage: (...args: any[]) => any;
    clearAllCache: (...args: any[]) => any;
  };

  // Error handling
  _errorHandler: {
    reportError: (...args: any[]) => any;
    getErrorLog: (...args: any[]) => any;
    withRetry: (...args: any[]) => any;
    saveStateSnapshot: (...args: any[]) => any;
    restoreStateSnapshot: (...args: any[]) => any;
  };

  // PDF/A
  _pdfA: {
    convertToPdfA: (...args: any[]) => any;
    checkPdfACompliance: (...args: any[]) => any;
  };

  // Virtual scroll
  _virtualScroll: any;

  // Memory manager
  _memoryManager: {
    getMemoryStats: (...args: any[]) => any;
    forceCleanup: (...args: any[]) => any;
    acquireCanvas: (...args: any[]) => any;
    releaseCanvas: (...args: any[]) => any;
  };

  // Text layer
  _textLayer: {
    buildTextLayer: (...args: any[]) => any;
    highlightSearchMatches: (...args: any[]) => any;
    clearSearchHighlights: (...args: any[]) => any;
    getSelectedText: (...args: any[]) => any;
  };

  // Layout analysis
  _layoutAnalysis: {
    analyzeLayout: (...args: any[]) => any;
    detectTable: (...args: any[]) => any;
    sortByReadingOrder: (...args: any[]) => any;
    tableToHtml: (...args: any[]) => any;
  };

  // Batch OCR
  _batchOcrEngine: any;

  // Ribbon toolbar
  _ribbon: {
    initRibbonToolbar: (...args: any[]) => any;
    switchTab: (...args: any[]) => any;
    setContextualTab: (...args: any[]) => any;
  };

  // Tab manager
  _tabManager: any;

  // Print
  _print: {
    parsePrintRange: (...args: any[]) => any;
    getPagesToPrint: (...args: any[]) => any;
    arrangeBooklet: (...args: any[]) => any;
    arrangeNup: (...args: any[]) => any;
    triggerPrint: (...args: any[]) => any;
  };

  // PDF creation
  _pdfCreate: {
    createPdfFromImages: (...args: any[]) => any;
    createBlankPdf: (...args: any[]) => any;
    canvasesToPdf: (...args: any[]) => any;
  };

  // Quick actions
  _quickActions: {
    initQuickActions: (...args: any[]) => any;
    hideQuickActions: (...args: any[]) => any;
  };

  // Hotkeys
  _hotkeys: {
    initHotkeys: (...args: any[]) => any;
    onHotkey: (...args: any[]) => any;
    registerHotkeyHandlers: (...args: any[]) => any;
    isSpaceHeld: (...args: any[]) => any;
    getBindings: (...args: any[]) => any;
    getCheatsheet: (...args: any[]) => any;
  };

  // CBZ adapter
  _cbzAdapter: any;

  // App persistence
  _appPersistence: any;

  // OCR search index
  _ocrSearchIndex: {
    search: (query: string, options?: any) => any[];
    [key: string]: any;
  };

  // Render pipeline
  _renderPipeline: {
    renderPage: (...args: any[]) => any;
    schedulePreRender: (...args: any[]) => any;
    invalidateCache: (...args: any[]) => any;
    getCacheStats: (...args: any[]) => any;
  };

  // Annotation controller
  _annotationController: any;

  // Page organizer
  _pageOrganizer: {
    getPageInfoList: (...args: any[]) => any;
    reorderPages: (...args: any[]) => any;
    deletePages: (...args: any[]) => any;
    rotatePages: (...args: any[]) => any;
    extractPages: (...args: any[]) => any;
    insertPages: (...args: any[]) => any;
    insertBlankPage: (...args: any[]) => any;
    duplicatePages: (...args: any[]) => any;
    reversePages: (...args: any[]) => any;
    createOrganizerState: (...args: any[]) => any;
    togglePageSelection: (...args: any[]) => any;
    selectPageRange: (...args: any[]) => any;
    computeReorderFromDrag: (...args: any[]) => any;
  };

  // Floating search
  _floatingSearch: any;

  // XPS adapter
  _xpsAdapter: any;

  // Cloud providers
  _cloud: {
    registerProvider: (...args: any[]) => any;
    getProviders: (...args: any[]) => any;
    authenticate: (...args: any[]) => any;
    listFiles: (...args: any[]) => any;
    openFile: (...args: any[]) => any;
    saveFile: (...args: any[]) => any;
    getShareLink: (...args: any[]) => any;
    signOut: (...args: any[]) => any;
    getConnectionStatus: (...args: any[]) => any;
    onStatusChange: (...args: any[]) => any;
    createGoogleDriveProvider: (...args: any[]) => any;
    createOneDriveProvider: (...args: any[]) => any;
    createDropboxProvider: (...args: any[]) => any;
  };

  // AI features
  _ai: {
    summarizeText: (...args: any[]) => any;
    extractTags: (...args: any[]) => any;
    semanticSearch: (...args: any[]) => any;
    generateToc: (...args: any[]) => any;
  };

  // Activity log
  _activityLog: {
    novaLog: (...args: any[]) => any;
    exportLogsAsJson: (...args: any[]) => any;
    clearActivityLog: (...args: any[]) => any;
    getLogEntries: (...args: any[]) => any;
  };

  // Minimap
  _minimap: {
    initMinimap: (...args: any[]) => any;
    updateMinimap: (...args: any[]) => any;
    showMinimap: (...args: any[]) => any;
    hideMinimap: (...args: any[]) => any;
    toggleMinimap: (...args: any[]) => any;
  };

  // Auto scroll
  _autoScroll: {
    startAutoScroll: (...args: any[]) => any;
    stopAutoScroll: (...args: any[]) => any;
    toggleAutoScroll: (...args: any[]) => any;
    setAutoScrollSpeed: (...args: any[]) => any;
    isAutoScrolling: (...args: any[]) => any;
  };

  // Autosave
  _autosave: {
    triggerAutosave: (...args: any[]) => any;
    markCleanExit: (...args: any[]) => any;
    checkForRecovery: (...args: any[]) => any;
    clearRecoveryData: (...args: any[]) => any;
    startAutosaveTimer: (...args: any[]) => any;
    stopAutosaveTimer: (...args: any[]) => any;
  };

  // Command palette
  _commandPalette: {
    showCommandPalette: (...args: any[]) => any;
    hideCommandPalette: (...args: any[]) => any;
    registerCommand: (...args: any[]) => any;
  };
}

// ─── Performance.memory (Chrome-only API) ───────────────────────────────────

interface PerformanceMemory {
  jsHeapSizeLimit: number;
  totalJSHeapSize: number;
  usedJSHeapSize: number;
}

interface Performance {
  memory?: PerformanceMemory;
}
