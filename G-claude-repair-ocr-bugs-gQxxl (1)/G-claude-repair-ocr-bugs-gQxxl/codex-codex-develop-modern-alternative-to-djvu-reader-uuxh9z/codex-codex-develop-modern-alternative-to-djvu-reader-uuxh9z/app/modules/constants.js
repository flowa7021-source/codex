// ─── Application Constants ──────────────────────────────────────────────────

export const APP_VERSION = '2.0.0-alpha';
export const NOVAREADER_PLAN_PROGRESS_PERCENT = 100;

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

export const OCR_MIN_DPI = 300;
export const CSS_BASE_DPI = 96;
export const OCR_MAX_SIDE_PX = 4096;
export const OCR_MAX_PIXELS = 8_500_000;
export const OCR_SLOW_TASK_WARN_MS = 3500;
export const OCR_HANG_WARN_MS = 7000;
export const OCR_SOURCE_MAX_PIXELS = 4_800_000;
export const OCR_SOURCE_CACHE_MAX_PIXELS = 12_000_000;
export const OCR_SOURCE_CACHE_TTL_MS = 2 * 60 * 1000;
