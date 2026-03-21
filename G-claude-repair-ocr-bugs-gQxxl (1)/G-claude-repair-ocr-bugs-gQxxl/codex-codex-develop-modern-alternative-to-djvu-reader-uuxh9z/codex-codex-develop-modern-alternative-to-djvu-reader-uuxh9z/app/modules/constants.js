// ─── Application Constants ──────────────────────────────────────────────────

export const APP_VERSION = '4.0.0';
export const APP_BUILD_DATE = '2026-03-19';
export const APP_NAME = 'NovaReader';
export const NOVAREADER_PLAN_PROGRESS_PERCENT = 100;

// ─── Limits & Timeouts ─────────────────────────────────────────────────────
export const MAX_FILE_SIZE_MB = 500;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
export const MAX_PAGE_COUNT = 10_000;
export const RENDER_TIMEOUT_MS = 30_000;
export const OCR_TIMEOUT_MS = 60_000;
export const SEARCH_DEBOUNCE_MS = 300;
export const AUTOSAVE_INTERVAL_MS = 30_000;

// ─── Memory Management ─────────────────────────────────────────────────────
export const MAX_MEMORY_USAGE_MB = 512;
export const MAX_CANVAS_POOL_SIZE = 20;
export const MAX_RENDER_CACHE_PAGES = 50;
export const MAX_THUMBNAIL_CACHE_PAGES = 100;
export const EVENT_LISTENER_WARN_THRESHOLD = 200;

// ─── Supported Formats ─────────────────────────────────────────────────────
export const SUPPORTED_EXTENSIONS = ['.pdf', '.djvu', '.djv', '.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tiff', '.tif', '.xps', '.oxps', '.epub', '.cbz', '.cbr', '.docx'];
export const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tiff', '.tif'];

export const SIDEBAR_SECTION_CONFIG = [
  { key: 'recent', label: 'Недавние файлы' },
  { key: 'bookmarks', label: 'Закладки' },
  { key: 'outline', label: 'Оглавление' },
  { key: 'previews', label: 'Превью страниц' },
  { key: 'progress', label: 'Прогресс чтения' },
  { key: 'searchResults', label: 'Результаты поиска' },
  { key: 'searchHistory', label: 'История поиска' },
  { key: 'notes', label: 'Заметки' },
];

export const TOOLBAR_SECTION_CONFIG = [
  { key: 'navigation', label: 'Навигация (верхняя панель)' },
  { key: 'zoom', label: 'Масштаб и поворот' },
  { key: 'view', label: 'Вид и служебные кнопки' },
  { key: 'tools', label: 'Панель инструментов' },
];

// ─── OCR Configuration ─────────────────────────────────────────────────────
export const OCR_MIN_DPI = 300;
export const CSS_BASE_DPI = 96;
export const OCR_MAX_SIDE_PX = 4096;
export const OCR_MAX_PIXELS = 8_500_000;
export const OCR_SLOW_TASK_WARN_MS = 3500;
export const OCR_HANG_WARN_MS = 7000;
export const OCR_SOURCE_MAX_PIXELS = 4_800_000;
export const OCR_SOURCE_CACHE_MAX_PIXELS = 12_000_000;
export const OCR_SOURCE_CACHE_TTL_MS = 2 * 60 * 1000;
export const OCR_MAX_CONCURRENT_WORKERS = 2;
export const OCR_CONFIDENCE_THRESHOLD = 60;
