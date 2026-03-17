// ─── Internationalization Module ─────────────────────────────────────────────

const translations = {
  ru: {
    // Sidebar
    'sidebar.open': 'Открыть',
    'sidebar.recent': 'Недавние',
    'sidebar.clearRecent': 'Очистить',
    'sidebar.bookmarks': 'Закладки',
    'sidebar.addBookmark': '+ Добавить',
    'sidebar.clearBookmarks': 'Очистить',
    'sidebar.exportJson': '↗ .json',
    'sidebar.importJson': '↙ .json',
    'sidebar.filterPlaceholder': 'Фильтр…',
    'sidebar.outline': 'Оглавление',
    'sidebar.previews': 'Превью',
    'sidebar.progress': 'Прогресс',
    'sidebar.goalPlaceholder': 'Цель (стр.)',
    'sidebar.setGoal': 'Задать',
    'sidebar.resetProgress': 'Сбросить прогресс',
    'sidebar.resetTime': 'Сбросить время',
    'sidebar.searchResults': 'Результаты поиска',
    'sidebar.searchHistory': 'История поиска',
    'sidebar.copy': 'Копировать',
    'sidebar.stats': 'Статистика',
    'sidebar.transitions': 'Переходы',
    'sidebar.comments': 'Комментарии',
    'sidebar.notes': 'Заметки',
    'sidebar.noteTitlePlaceholder': 'Заголовок',
    'sidebar.noteTagsPlaceholder': 'Теги',
    'sidebar.noteTextPlaceholder': 'Заметки…',
    'sidebar.save': 'Сохранить',
    'sidebar.replace': 'Заменить',
    'sidebar.append': 'Добавить',
    'sidebar.workspace': 'Workspace',
    'sidebar.export': '↗ Экспорт',
    'sidebar.import': '↙ Импорт',
    'sidebar.cloudCollab': 'Cloud & Collab',
    'sidebar.push': '↑ Push',
    'sidebar.pull': '↓ Pull',
    'sidebar.collabOff': 'Collab: off',
    'sidebar.collabOn': 'Collab: on',
    'sidebar.send': 'Отправить',
    'sidebar.settings': 'Настройки',
    'sidebar.advancedOff': 'Расширенные: off',
    'sidebar.advancedOn': 'Расширенные: on',
    'sidebar.compactOff': 'Компакт: off',
    'sidebar.compactOn': 'Компакт: on',
    'sidebar.collapse': '▴ Свернуть',
    'sidebar.expand': '▾ Развернуть',
    'sidebar.standardHotkeys': 'Стандартные hotkeys',
    'sidebar.diagnosticsExport': '↗ Диагностика',
    'sidebar.clearDiag': 'Очистить диаг.',
    'sidebar.selfCheck': 'Self-check',

    // Toolbar
    'toolbar.back': 'Назад',
    'toolbar.forward': 'Вперёд',
    'toolbar.prevPage': 'Предыдущая страница',
    'toolbar.nextPage': 'Следующая страница',
    'toolbar.goTo': 'Перейти',
    'toolbar.zoomOut': 'Уменьшить',
    'toolbar.zoomIn': 'Увеличить',
    'toolbar.fitWidth': 'По ширине',
    'toolbar.fitPage': 'По странице',
    'toolbar.rotate': 'Повернуть',
    'toolbar.theme': 'Тема',
    'toolbar.fullscreen': 'Полный экран',
    'toolbar.shortcuts': 'Горячие клавиши',
    'toolbar.settingsBtn': 'Настройки',
    'toolbar.sidebar': 'Сайдбар',
    'toolbar.tools': 'Инструменты',
    'toolbar.text': 'Текст',
    'toolbar.search': 'Поиск',
    'toolbar.annotations': 'Аннотации',

    // Search
    'search.placeholder': 'Поиск…',
    'search.allDoc': 'Весь документ',
    'search.currentPage': 'Текущая страница',
    'search.find': 'Найти',

    // Annotations
    'annot.off': '✎ off',
    'annot.on': '✎ on',
    'annot.pen': 'Перо',
    'annot.highlighter': 'Маркер',
    'annot.eraser': 'Ластик',
    'annot.comment': '💬',
    'annot.rect': '▭',
    'annot.arrow': '→',
    'annot.line': '╱',
    'annot.circle': '◯',
    'annot.undo': 'Отмена',
    'annot.clearPage': 'Очистить страницу',
    'annot.exportSvg': 'SVG',
    'annot.exportPdf': 'PDF',

    // Utilities
    'util.download': 'Скачать',
    'util.print': 'Печать',

    // Text tools
    'text.extract': 'Текст',
    'text.copy': '📋',
    'text.edit': 'Ред.',
    'text.ocr': 'OCR',
    'text.region': 'Область',
    'text.copyOcr': '📋 OCR',
    'text.cancelBg': '⏹ Фон',
    'text.health': 'Health',
    'text.placeholder': 'Текст страницы',

    // Canvas
    'canvas.empty': 'Откройте PDF, DjVu, ePub или изображение',

    // Settings modal
    'settings.title': 'Настройки',
    'settings.panels': 'Панели',
    'settings.sectionVisibility': 'Видимость разделов',
    'settings.dimensions': 'Размеры',
    'settings.appearance': 'Оформление',
    'settings.theme': 'Тема',
    'settings.themeDark': 'Тёмная',
    'settings.themeLight': 'Светлая',
    'settings.language': 'Язык',
    'settings.ocrLang': 'OCR',
    'settings.ocrAuto': 'Auto',
    'settings.ocrRus': 'Русский',
    'settings.ocrEng': 'English',
    'settings.ocrDeu': 'Deutsch',
    'settings.ocrFra': 'Français',
    'settings.ocrSpa': 'Español',
    'settings.ocrIta': 'Italiano',
    'settings.ocrPor': 'Português',
    'settings.accuracy': 'Точность',
    'settings.balanced': 'Баланс',
    'settings.accurate': 'Точность',
    'settings.cyrOnly': 'Кириллица: очищать латиницу',
    'settings.hotkeys': 'Горячие клавиши',
    'settings.saveHotkeys': 'Сохранить',
    'settings.resetHotkeys': 'Сбросить',
    'settings.autofix': 'Авто-фикс',
    'settings.ocrRegion': 'OCR область',
    'settings.bgOcr': 'Фоновое OCR при открытии',
    'settings.saveBtn': 'Сохранить',

    // PDF forms
    'forms.fill': 'Заполнить формы',
    'forms.export': 'Экспорт форм',
    'forms.clear': 'Очистить формы',
    'forms.noFields': 'Форма: нет полей в документе',
    'forms.loaded': 'Форма: загружено {count} полей',
    'forms.saved': 'Форма: данные сохранены',

    // Conversion
    'convert.table': 'Табл. плагин',
    'convert.invoice': 'Счёт-фактура',
    'convert.report': 'Отчёт',
    'convert.custom': 'Своя таблица',

    // Dimensions labels
    'dim.sidebar': 'Сайдбар (px)',
    'dim.toolbarScale': 'Масштаб панели (%)',
    'dim.textMinHeight': 'Текст мин. (px)',
    'dim.pageArea': 'Область (px)',
    'dim.topToolbar': 'Верх (px)',
    'dim.bottomToolbar': 'Низ (px)',
    'dim.textPanel': 'Текст (px)',
    'dim.annotCanvas': 'Аннот. холст (%)',

    // Hotkey labels
    'hk.next': 'Стр.→',
    'hk.prev': 'Стр.←',
    'hk.zoomIn': 'Zoom+',
    'hk.zoomOut': 'Zoom−',
    'hk.annotate': 'Аннот.',
    'hk.search': 'Поиск',
    'hk.ocr': 'OCR',
    'hk.fitWidth': 'Ширина',
    'hk.fitPage': 'Страница',

    // OCR region
    'ocr.minW': 'Мин. W (px)',
    'ocr.minH': 'Мин. H (px)',
    'ocr.selectRegion': 'OCR: выделите область на странице',
    'ocr.noData': 'OCR: нет данных для экспорта индекса',
    'ocr.exported': 'OCR индекс: экспортировано {count} страниц',
    'ocr.textCopied': 'OCR: текст скопирован',
    'ocr.copyFail': 'OCR: не удалось скопировать текст',
    'ocr.undo': 'Отмена: страница {page}',
    'ocr.redo': 'Повтор: страница {page}',

    // Progressive loading
    'progressive.loading': 'Загрузка: {percent}%',
    'progressive.complete': 'Документ загружен полностью',
    'progressive.streaming': 'Потоковая загрузка...',

    // Unsupported
    'unsupported.title': 'Формат пока не поддержан',
    'unsupported.hint': 'Откройте поддерживаемый формат: PDF, DjVu, ePub или изображение.',
  },

  en: {
    // Sidebar
    'sidebar.open': 'Open',
    'sidebar.recent': 'Recent',
    'sidebar.clearRecent': 'Clear',
    'sidebar.bookmarks': 'Bookmarks',
    'sidebar.addBookmark': '+ Add',
    'sidebar.clearBookmarks': 'Clear',
    'sidebar.exportJson': '↗ .json',
    'sidebar.importJson': '↙ .json',
    'sidebar.filterPlaceholder': 'Filter…',
    'sidebar.outline': 'Outline',
    'sidebar.previews': 'Previews',
    'sidebar.progress': 'Progress',
    'sidebar.goalPlaceholder': 'Goal (page)',
    'sidebar.setGoal': 'Set',
    'sidebar.resetProgress': 'Reset progress',
    'sidebar.resetTime': 'Reset time',
    'sidebar.searchResults': 'Search results',
    'sidebar.searchHistory': 'Search history',
    'sidebar.copy': 'Copy',
    'sidebar.stats': 'Statistics',
    'sidebar.transitions': 'Transitions',
    'sidebar.comments': 'Comments',
    'sidebar.notes': 'Notes',
    'sidebar.noteTitlePlaceholder': 'Title',
    'sidebar.noteTagsPlaceholder': 'Tags',
    'sidebar.noteTextPlaceholder': 'Notes…',
    'sidebar.save': 'Save',
    'sidebar.replace': 'Replace',
    'sidebar.append': 'Append',
    'sidebar.workspace': 'Workspace',
    'sidebar.export': '↗ Export',
    'sidebar.import': '↙ Import',
    'sidebar.cloudCollab': 'Cloud & Collab',
    'sidebar.push': '↑ Push',
    'sidebar.pull': '↓ Pull',
    'sidebar.collabOff': 'Collab: off',
    'sidebar.collabOn': 'Collab: on',
    'sidebar.send': 'Send',
    'sidebar.settings': 'Settings',
    'sidebar.advancedOff': 'Advanced: off',
    'sidebar.advancedOn': 'Advanced: on',
    'sidebar.compactOff': 'Compact: off',
    'sidebar.compactOn': 'Compact: on',
    'sidebar.collapse': '▴ Collapse',
    'sidebar.expand': '▾ Expand',
    'sidebar.standardHotkeys': 'Standard hotkeys',
    'sidebar.diagnosticsExport': '↗ Diagnostics',
    'sidebar.clearDiag': 'Clear diag.',
    'sidebar.selfCheck': 'Self-check',

    // Toolbar
    'toolbar.back': 'Back',
    'toolbar.forward': 'Forward',
    'toolbar.prevPage': 'Previous page',
    'toolbar.nextPage': 'Next page',
    'toolbar.goTo': 'Go to',
    'toolbar.zoomOut': 'Zoom out',
    'toolbar.zoomIn': 'Zoom in',
    'toolbar.fitWidth': 'Fit width',
    'toolbar.fitPage': 'Fit page',
    'toolbar.rotate': 'Rotate',
    'toolbar.theme': 'Theme',
    'toolbar.fullscreen': 'Fullscreen',
    'toolbar.shortcuts': 'Shortcuts',
    'toolbar.settingsBtn': 'Settings',
    'toolbar.sidebar': 'Sidebar',
    'toolbar.tools': 'Tools',
    'toolbar.text': 'Text',
    'toolbar.search': 'Search',
    'toolbar.annotations': 'Annotations',

    // Search
    'search.placeholder': 'Search…',
    'search.allDoc': 'Entire document',
    'search.currentPage': 'Current page',
    'search.find': 'Find',

    // Annotations
    'annot.off': '✎ off',
    'annot.on': '✎ on',
    'annot.pen': 'Pen',
    'annot.highlighter': 'Highlighter',
    'annot.eraser': 'Eraser',
    'annot.comment': '💬',
    'annot.rect': '▭',
    'annot.arrow': '→',
    'annot.line': '╱',
    'annot.circle': '◯',
    'annot.undo': 'Undo',
    'annot.clearPage': 'Clear page',
    'annot.exportSvg': 'SVG',
    'annot.exportPdf': 'PDF',

    // Utilities
    'util.download': 'Download',
    'util.print': 'Print',

    // Text tools
    'text.extract': 'Text',
    'text.copy': '📋',
    'text.edit': 'Edit',
    'text.ocr': 'OCR',
    'text.region': 'Region',
    'text.copyOcr': '📋 OCR',
    'text.cancelBg': '⏹ Bg',
    'text.health': 'Health',
    'text.placeholder': 'Page text',

    // Canvas
    'canvas.empty': 'Open a PDF, DjVu, ePub or image file',

    // Settings modal
    'settings.title': 'Settings',
    'settings.panels': 'Panels',
    'settings.sectionVisibility': 'Section visibility',
    'settings.dimensions': 'Dimensions',
    'settings.appearance': 'Appearance',
    'settings.theme': 'Theme',
    'settings.themeDark': 'Dark',
    'settings.themeLight': 'Light',
    'settings.language': 'Language',
    'settings.ocrLang': 'OCR',
    'settings.ocrAuto': 'Auto',
    'settings.ocrRus': 'Russian',
    'settings.ocrEng': 'English',
    'settings.ocrDeu': 'German',
    'settings.ocrFra': 'French',
    'settings.ocrSpa': 'Spanish',
    'settings.ocrIta': 'Italian',
    'settings.ocrPor': 'Portuguese',
    'settings.accuracy': 'Accuracy',
    'settings.balanced': 'Balanced',
    'settings.accurate': 'Accurate',
    'settings.cyrOnly': 'Cyrillic: clean Latin chars',
    'settings.hotkeys': 'Hotkeys',
    'settings.saveHotkeys': 'Save',
    'settings.resetHotkeys': 'Reset',
    'settings.autofix': 'Auto-fix',
    'settings.ocrRegion': 'OCR region',
    'settings.bgOcr': 'Background OCR on open',
    'settings.saveBtn': 'Save',

    // PDF forms
    'forms.fill': 'Fill forms',
    'forms.export': 'Export forms',
    'forms.clear': 'Clear forms',
    'forms.noFields': 'Form: no fields in document',
    'forms.loaded': 'Form: loaded {count} fields',
    'forms.saved': 'Form: data saved',

    // Conversion
    'convert.table': 'Table plugin',
    'convert.invoice': 'Invoice',
    'convert.report': 'Report',
    'convert.custom': 'Custom table',

    // Dimensions labels
    'dim.sidebar': 'Sidebar (px)',
    'dim.toolbarScale': 'Toolbar scale (%)',
    'dim.textMinHeight': 'Text min. (px)',
    'dim.pageArea': 'Page area (px)',
    'dim.topToolbar': 'Top (px)',
    'dim.bottomToolbar': 'Bottom (px)',
    'dim.textPanel': 'Text (px)',
    'dim.annotCanvas': 'Annot. canvas (%)',

    // Hotkey labels
    'hk.next': 'Page→',
    'hk.prev': 'Page←',
    'hk.zoomIn': 'Zoom+',
    'hk.zoomOut': 'Zoom−',
    'hk.annotate': 'Annot.',
    'hk.search': 'Search',
    'hk.ocr': 'OCR',
    'hk.fitWidth': 'Width',
    'hk.fitPage': 'Page',

    // OCR region
    'ocr.minW': 'Min. W (px)',
    'ocr.minH': 'Min. H (px)',
    'ocr.selectRegion': 'OCR: select a region on the page',
    'ocr.noData': 'OCR: no data for index export',
    'ocr.exported': 'OCR index: exported {count} pages',
    'ocr.textCopied': 'OCR: text copied',
    'ocr.copyFail': 'OCR: failed to copy text',
    'ocr.undo': 'Undo: page {page}',
    'ocr.redo': 'Redo: page {page}',

    // Progressive loading
    'progressive.loading': 'Loading: {percent}%',
    'progressive.complete': 'Document fully loaded',
    'progressive.streaming': 'Streaming load...',

    // Unsupported
    'unsupported.title': 'Format not yet supported',
    'unsupported.hint': 'Open a supported format: PDF, DjVu, ePub or image.',
  },
};

let currentLang = 'ru';

export function setLanguage(lang) {
  if (translations[lang]) {
    currentLang = lang;
    localStorage.setItem('novareader-ui-lang', lang);
  }
}

export function getLanguage() {
  return currentLang;
}

export function loadLanguage() {
  const saved = localStorage.getItem('novareader-ui-lang');
  if (saved && translations[saved]) {
    currentLang = saved;
  }
  return currentLang;
}

export function t(key, params = {}) {
  const dict = translations[currentLang] || translations.ru;
  let text = dict[key] || translations.ru[key] || key;
  for (const [k, v] of Object.entries(params)) {
    text = text.replace(`{${k}}`, String(v));
  }
  return text;
}

export function applyI18nToDOM() {
  const lang = currentLang;

  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (key) el.textContent = t(key);
  });

  document.querySelectorAll('[data-i18n-title]').forEach((el) => {
    const key = el.getAttribute('data-i18n-title');
    if (key) el.title = t(key);
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (key) el.placeholder = t(key);
  });

  document.documentElement.lang = lang === 'en' ? 'en' : 'ru';
}

export function getAvailableLanguages() {
  return Object.keys(translations);
}
