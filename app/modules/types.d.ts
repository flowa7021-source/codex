// ─── NovaReader Type Definitions ─────────────────────────────────────────────
// Incremental TypeScript adoption: ambient types for key interfaces.
// These types describe the runtime shapes used across the JS codebase.

// ─── App State (state.js → createReactiveState initial) ─────────────────────

export interface Diagnostics {
  events: unknown[];
  maxEvents: number;
  sessionId: string;
}

export interface OcrSelection {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface AppState {
  adapter: AdapterInterface | null;
  file: File | null;
  pdfBytes: ArrayBuffer | Uint8Array | null;
  docName: string | null;
  currentPage: number;
  pageCount: number;
  zoom: number;
  rotation: number;
  searchResults: unknown[];
  searchCursor: number;
  searchResultCounts: Record<number, number>;
  lastSearchQuery: string;
  lastSearchScope: string;
  outline: OutlineItem[];
  drawEnabled: boolean;
  isDrawing: boolean;
  currentStroke: unknown | null;
  historyBack: number[];
  historyForward: number[];
  isHistoryNavigation: boolean;
  lastRenderedPage: number | null;
  readingTotalMs: number;
  readingStartedAt: number | null;
  visitTrail: number[];
  readingGoalPage: number | null;
  collabChannel: unknown | null;
  collabEnabled: boolean;
  djvuBinaryDetected: boolean;
  currentObjectUrl: string | null;
  ocrRegionMode: boolean;
  ocrSelection: OcrSelection | null;
  isSelectingOcr: boolean;
  backgroundOcrToken: number;
  backgroundOcrTimer: number | null;
  backgroundOcrRunning: boolean;
  settings: Settings | null;
  pageSkewAngles: Record<number, number>;
  pageSkewPromises: Record<number, Promise<number>>;
  ocrTaskId: number;
  ocrJobRunning: boolean;
  ocrQueue: Promise<void>;
  ocrQueueEpoch: number;
  ocrLatestByReason: Record<string, number>;
  ocrLastProgressUiAt: number;
  ocrLastProgressText: string;
  ocrConfidenceMode: boolean;
  ocrSourceCache: Map<string, unknown>;
  ocrCacheLastDiagAt: number;
  ocrCacheLastHitDiagAt: number;
  ocrCacheHitCount: number;
  ocrCacheExpireCount: number;
  ocrCacheLastExpireDiagAt: number;
  ocrCacheMissCount: number;
  ocrCacheLastMissDiagAt: number;
  ocrCacheOpsCount: number;
  textEditMode: boolean;
  pdfEditState: unknown | null;
  lastDocxImportHtml: string | null;
  lastDocxImportBlocks: unknown[] | null;
  eventListenerRegistry: Map<string, unknown>;
  minimapEnabled: boolean;
  initComplete: boolean;
  diagnostics: Diagnostics;

  // Reactive helpers added by createReactiveState proxy
  on(field: string, cb: (newValue: unknown, oldValue: unknown, field: string) => void): void;
  off(field: string, cb: (newValue: unknown, oldValue: unknown, field: string) => void): void;
  batch(fn: () => void): void;
}

// ─── App Elements (state.js → els) ──────────────────────────────────────────

export interface AppElements {
  fileInput: HTMLInputElement | null;
  appVersion: HTMLElement | null;
  recentList: HTMLElement | null;
  clearRecent: HTMLElement | null;
  toggleAdvancedPanels: HTMLElement | null;
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
  canvas: HTMLCanvasElement | null;
  annotationCanvas: HTMLCanvasElement | null;
  emptyState: HTMLElement | null;
  searchInput: HTMLInputElement | null;
  searchScope: HTMLSelectElement | null;
  searchBtn: HTMLElement | null;
  searchPrev: HTMLElement | null;
  searchNext: HTMLElement | null;
  searchStatus: HTMLElement | null;
  searchToolsGroup: HTMLElement | null;
  statusBar: HTMLElement | null;
  sbPage: HTMLElement | null;
  sbZoom: HTMLElement | null;
  sbOcr: HTMLElement | null;
  sbFileSize: HTMLElement | null;
  sbReadingTime: HTMLElement | null;
  themeToggle: HTMLElement | null;
  fullscreen: HTMLElement | null;
  shortcutsHelp: HTMLElement | null;
  toggleSidebar: HTMLElement | null;
  toggleToolsBar: HTMLElement | null;
  canvasWrap: HTMLElement | null;
  pageInput: HTMLInputElement | null;
  goToPage: HTMLElement | null;
  prevPage: HTMLElement | null;
  nextPage: HTMLElement | null;
  pageStatus: HTMLElement | null;
  zoomIn: HTMLElement | null;
  zoomOut: HTMLElement | null;
  fitWidth: HTMLElement | null;
  fitPage: HTMLElement | null;
  zoomStatus: HTMLElement | null;
  rotate: HTMLElement | null;
  pageText: HTMLElement | null;
  ocrCurrentPage: HTMLElement | null;
  ocrRegionMode: HTMLElement | null;
  ocrStatus: HTMLElement | null;
  copyOcrText: HTMLElement | null;
  cancelBackgroundOcr: HTMLElement | null;
  bookmarkList: HTMLElement | null;
  bookmarkFilter: HTMLInputElement | null;
  clearBookmarkFilter: HTMLElement | null;
  bookmarksStatus: HTMLElement | null;
  outlineList: HTMLElement | null;
  pagePreviewList: HTMLElement | null;
  settingsModal: HTMLElement | null;
  openSettingsModal: HTMLElement | null;
  closeSettingsModal: HTMLElement | null;
  saveSettingsModal: HTMLElement | null;
  textLayerDiv: HTMLElement | null;
  pdfAnnotationLayer: HTMLElement | null;
  canvasStack: HTMLElement | null;
  [key: string]: HTMLElement | null;
}

// ─── Adapter Interface (adapters.js — common contract) ──────────────────────

export interface Viewport {
  width: number;
  height: number;
}

export interface RenderOptions {
  zoom: number;
  rotation: number;
  dpr?: number;
}

export interface OutlineItem {
  title: string;
  dest: unknown;
  items?: OutlineItem[];
}

export interface AdapterInterface {
  type: string;
  getPageCount(): number;
  getPageViewport?(pageNumber: number, scale: number, rotation: number): Promise<Viewport>;
  renderPage(pageNumber: number, canvas: HTMLCanvasElement, opts: RenderOptions): Promise<void>;
  getText(pageNumber: number): Promise<string>;
  getOutline?(): Promise<OutlineItem[] | null>;
  resolveDestToPage?(dest: unknown): Promise<number | null>;
  destroy?(): void;
}

// ─── OCR Result (ocr-controller.js → runOcrOnPreparedCanvas return) ─────────

export interface WordBbox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface OcrWord {
  text: string;
  confidence: number;
  bbox: WordBbox;
}

export interface OcrResult {
  text: string;
  words: OcrWord[];
  confidence: number;
  lang: string;
  preprocessMs: number;
  ocrMs: number;
}

export interface OcrConfidence {
  score: number;
  level: 'high' | 'medium' | 'low' | 'very-low' | 'none';
  details: Record<string, number>;
}

// ─── Perf Metrics (perf.js) ─────────────────────────────────────────────────

export interface PerfMetrics {
  renderTimes: number[];
  ocrTimes: number[];
  searchTimes: number[];
  pageLoadTimes: number[];
  maxSamples: number;
}

export interface PerfSummaryEntry {
  count: number;
  min: number;
  max: number;
  median: number;
  p95: number;
  avg: number;
}

export type PerfSummary = Record<string, PerfSummaryEntry | null>;

// ─── Toast Options (toast.js) ───────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'progress';

export interface ToastOptions {
  type?: ToastType;
  duration?: number;
  progress?: number;
  id?: string | number;
}

export interface ToastHandle {
  id: string | number;
  update(message: string, opts?: ToastOptions): ToastHandle;
  dismiss(): void;
}

// ─── Settings (settings-controller.js → defaultSettings) ────────────────────

export interface Settings {
  appLang: string;
  ocrLang: string;
  ocrMinW: number;
  ocrMinH: number;
  backgroundOcr: boolean;
  ocrCyrillicOnly: boolean;
  ocrQualityMode: 'balanced' | 'accurate';
  uiSidebarWidth: number;
  uiToolbarScale: number;
  uiTextMinHeight: number;
  uiPageAreaPx: number;
  uiToolbarTopPx: number;
  uiToolbarBottomPx: number;
  uiTextPanelPx: number;
  uiAnnotationCanvasScale: number;
  sidebarSections: Record<string, boolean>;
  toolbarSections: Record<string, boolean>;
}

// ─── Hotkeys (state.js → defaultHotkeys) ────────────────────────────────────

export interface Hotkeys {
  next: string;
  prev: string;
  zoomIn: string;
  zoomOut: string;
  annotate: string;
  searchFocus: string;
  ocrPage: string;
  fitWidth: string;
  fitPage: string;
}
