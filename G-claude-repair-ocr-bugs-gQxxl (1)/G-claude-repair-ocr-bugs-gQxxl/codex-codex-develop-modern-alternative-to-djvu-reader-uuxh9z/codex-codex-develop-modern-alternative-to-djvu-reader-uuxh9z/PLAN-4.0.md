# PLAN-4.0 — NovaReader: Adobe Acrobat Pro Parity

> Цель: довести NovaReader до уровня качества функций Adobe Acrobat Pro DC 2025.
> Каждый пункт содержит оценку сложности (S/M/L/XL) и ссылку на текущий статус.

---

## Фаза 1: Качество рендеринга и текстового слоя (Критическое)

### 1.1 [XL] Перейти на официальный PDF.js TextLayer API
**Текущее состояние:** Ручное создание `<span>` с вычислением координат через viewport.transform.
**Проблема:** Хрупко, не учитывает CFF hinting, font substitution, лигатуры.
**Решение:** Использовать `new pdfjsLib.TextLayer({ container, textContentSource, viewport })` из pdfjs-dist v4.4+.
- Включить `pdf_viewer.css` для класса `.textLayer`
- Установить CSS-переменную `--scale-factor` равной `viewport.scale`
- Это автоматически исправит: выделение текста, поиск, копирование, позиционирование
- Наш кастомный `_renderOcrTextLayer()` останется для DjVu/ePub/OCR
**Источники:** [PDF.js TextLayer API](https://github.com/mozilla/pdf.js/issues/18206), [PDF.js Layers in React](https://blog.react-pdf.dev/understanding-pdfjs-layers-and-how-to-use-them-in-reactjs)

### 1.2 [L] Официальный PDF.js AnnotationLayer
**Текущее состояние:** Кастомный canvas-based рендер аннотаций.
**Решение:** Добавить `pdfjsLib.AnnotationLayer` для корректного отображения встроенных PDF-аннотаций (ссылки, формы, виджеты).
- `viewport.clone({ dontFlip: true })` для правильной ориентации
- Обработка кликов по ссылкам внутри PDF

### 1.3 [M] Рендеринг при высоком DPI
- Canvas уже использует `devicePixelRatio`, но добавить:
  - Адаптивный минимальный zoom (авто-fit по ширине страницы)
  - Отложенный рендер при изменении zoom (debounced re-render)
  - Progressive rendering: сначала показать низкокачественную версию, затем HQ

### 1.4 [S] CSS `image-rendering` для разных режимов
- `auto` для текстовых документов
- `crisp-edges` для чертежей/CAD
- Пользовательский переключатель в настройках

---

## Фаза 2: Редактирование PDF (Ядро Adobe Acrobat Pro)

### 2.1 [XL] Intelligent Text Flow — редактирование с автопереносом
**Текущее состояние:** Inline editor заменяет один span, без reflow.
**Решение:**
- Группировать текстовые spans в параграфы по bbox proximity
- При редактировании пересчитывать layout: word wrap, hyphenation
- Отображать параграф как `contenteditable` блок с автоматическим reflow
- Сохранять изменения через pdf-lib `page.drawText()` с whiteout старого текста

### 2.2 [L] Редактирование изображений в PDF
**Текущее состояние:** blockEditor поддерживает `addImageBlock`, но нет UI для замены/crop.
**Решение:**
- Выделение изображения кликом → контекстное меню: заменить, crop, resize, extract
- Извлечение изображений из PDF через `page.getOperatorList()` + image extraction
- Замена изображений через pdf-lib `page.drawImage()`

### 2.3 [M] Добавление/удаление страниц с визуальным drag&drop
**Текущее состояние:** `page-organizer.js` имеет API, но UI минимален.
**Решение:**
- Полноэкранный page organizer (как в Acrobat)
- Drag&drop reorder с анимацией
- Multi-select + bulk operations
- Вставка страниц из другого PDF (drag файла в organizer)
- Split/merge с предпросмотром

### 2.4 [M] Spellcheck для текстового слоя
- Подключить словарь (hunspell.js или typo.js)
- Подсветка орфографических ошибок в `contenteditable` spans
- Контекстное меню с вариантами исправления
- Поддержка RU/EN минимум

### 2.5 [L] Undo/Redo для всех операций над PDF
**Текущее состояние:** `undo-redo.js` для текстовых правок.
**Расширить на:** аннотации, блоки, повороты страниц, удаления, crop.
- Единая history stack для всех типов операций
- Ctrl+Z / Ctrl+Shift+Z с визуальным feedback

---

## Фаза 3: Формы и подписи

### 3.1 [L] Полноценные интерактивные PDF-формы
**Текущее состояние:** `pdf-forms.js` — базовое заполнение форм.
**Расширить:**
- Автоматическое распознавание полей (AcroForm parsing)
- Чекбоксы, radio buttons, dropdown, date picker
- Tab-навигация между полями
- Валидация (обязательные поля, формат)
- Вычисляемые поля (сумма, дата, формулы)
- Экспорт данных форм (FDF/XFDF)

### 3.2 [XL] Электронные подписи
**Текущее состояние:** `addSignatureToPdf()` — stamp-подпись.
**Расширить до полноценного eSign:**
- Рисование подписи от руки (canvas pad)
- Загрузка изображения подписи
- Typed signature (набор имени шрифтом)
- Placement guide (перетаскивание подписи на нужное место)
- Хранение подписей в профиле
- Множественные подписи на одном документе
- Инициалы + дата

### 3.3 [L] Создание форм из нуля
- Визуальный конструктор форм: drag&drop текстовых полей, чекбоксов, кнопок
- Автодетект форм из сканированного документа (OCR + layout analysis)
- Экспорт формы как интерактивного PDF

---

## Фаза 4: Конвертация и экспорт

### 4.1 [L] PDF → Word с сохранением форматирования
**Текущее состояние:** `docx-converter.js` — базовый экспорт текста.
**Улучшить:**
- Сохранение стилей (bold, italic, underline, font size, font family)
- Таблицы (layout-analysis.js → DOCX table)
- Встроенные изображения с правильным размером
- Колонки текста
- Списки (numbered/bulleted)
- Заголовки (H1-H6) по размеру шрифта

### 4.2 [M] PDF → Excel
- Извлечение таблиц из PDF через `detectTable()` → CSV/XLSX
- Автоопределение структуры таблицы (заголовки, ячейки)
- Поддержка multi-page таблиц

### 4.3 [M] PDF → PowerPoint
- Каждая страница → слайд
- Извлечение текстовых блоков → текстовые фреймы слайда
- Изображения как фоны или встроенные объекты

### 4.4 [S] PDF → HTML (улучшенный)
**Текущее состояние:** `html-converter.js` существует.
- Улучшить CSS-стили
- Добавить responsive layout
- Сохранение ссылок и навигации

### 4.5 [M] Batch конвертация
- Массовая конвертация: PDF→DOCX, Images→PDF, PDF→Images
- Очередь задач с прогрессом
- Настройки качества/сжатия per-batch

---

## Фаза 5: OCR Pro

### 5.1 [L] Ускорение OCR в 5-10x
**Текущее состояние:** 28 секунд на 1 страницу (из логов).
**Решение:**
- Web Worker pool для параллельного распознавания
- `worker-pool.js` уже есть — использовать для OCR
- Обработка variant-ов параллельно, а не последовательно
- Кэширование Tesseract worker (не пересоздавать)
- Уменьшить количество вариантов preprocessing для "balanced" режима

### 5.2 [M] OCR с сохранением шрифтов
- После OCR: определить font по визуальному анализу
- Embedding OCR текста в PDF с matching font (searchable PDF)
- `createSearchablePdf()` уже есть — улучшить font matching

### 5.3 [M] Batch OCR с прогрессом
**Текущее состояние:** `batch-ocr-enhanced.js` — есть, но UI минимален.
- Progress bar per-page + total
- Estimate time remaining
- Pause/resume
- Качество per-page (confidence heatmap)

### 5.4 [S] Авто-определение сканированных страниц
- При открытии PDF: анализировать какие страницы — скан, какие — текст
- Предложить OCR только для сканов
- Badge "OCR needed" на thumbnail-ах

---

## Фаза 6: Аннотации и рецензирование

### 6.1 [L] Полный набор инструментов аннотирования
**Текущее состояние:** Pen, rect, arrow, line, circle, comment.
**Добавить (как в Acrobat):**
- Highlight text (выделение текста цветом)
- Underline, strikethrough, squiggly underline
- Sticky notes (sticky note прикреплённая к точке)
- Text box (прямоугольник с текстом внутри)
- Callout (стрелка + текст)
- Cloud shape, polygon, polyline
- Stamp library (больше штампов)
- Measurement tools (расстояние, площадь, периметр)

### 6.2 [M] Комментарии и рецензирование
- Sidebar с деревом комментариев (threaded)
- Reply to comment
- Resolve/unresolve
- Filter comments by author/type/status
- Export comments as summary PDF/CSV

### 6.3 [M] Сравнение документов
**Текущее состояние:** `pdf-compare.js` — базовое сравнение.
**Улучшить:**
- Side-by-side view
- Overlay mode (наложение с разностью)
- Highlight changes (добавленный/удалённый текст)
- Summary report: что изменилось

---

## Фаза 7: Безопасность и соответствие

### 7.1 [M] Certificate-based подписи (PKCS#7)
- Загрузка сертификата (.pfx/.p12)
- Верификация подписей в открытом PDF
- Визуальный badge: "Подписано / Не подписано / Подпись недействительна"

### 7.2 [M] Расширенное редактирование (Redaction Pro)
**Текущее состояние:** `pdf-redact.js` — pattern matching + whiteout.
**Улучшить:**
- Визуальный выбор области для редактирования
- Search & redact across all pages
- Custom redaction marks (цвет, текст)
- Redaction summary/audit log
- Flatten after redact (необратимо)

### 7.3 [S] PDF/A-3 compliance
**Текущее состояние:** `pdf-a-converter.js` — PDF/A-1b.
- Добавить PDF/A-2b, PDF/A-3b
- Attachment embedding (PDF/A-3)
- Compliance validation report

---

## Фаза 8: UI/UX уровня Adobe

### 8.1 [L] Панель инструментов в стиле Acrobat
**Текущее состояние:** ribbon-toolbar.js + sidebar.
**Улучшить:**
- Контекстная панель: при выборе инструмента показывать его опции
- Quick tools bar (настраиваемая панель быстрого доступа)
- Tool presets (сохранение настроек инструмента)
- Minimizable panels

### 8.2 [M] Multi-tab documents
**Текущее состояние:** `tab-manager.js` — базовый API.
**Реализовать:**
- Вкладки документов в верхней части окна
- Перетаскивание вкладок
- Быстрое переключение (Ctrl+Tab)
- Compare mode: два документа рядом

### 8.3 [M] Полная i18n
**Текущее состояние:** ~540 хардкодированных русских строк в app.js.
- Вынести все строки в i18n.js
- DE, FR, ES, ZH, JA, AR уже добавлены (Wave 7)
- Перевести все новые строки

### 8.4 [S] Dark/Light/System theme
**Текущее состояние:** Dark theme по умолчанию.
- Полноценная Light theme
- Auto-detect system preference
- Smooth transition animation

### 8.5 [M] Keyboard shortcuts customization
- UI для настройки горячих клавиш
- Import/export keybindings
- Cheatsheet modal (все шорткаты в одном окне)

---

## Фаза 9: Производительность

### 9.1 [L] Virtual scrolling для больших документов
**Текущее состояние:** `virtual-scroll.js` — базовый API.
**Довести до production:**
- Рендерить только видимые страницы + 1 буфер
- Lazy-load thumbnails
- Progressive rendering при быстрой прокрутке (placeholder → render)
- Smooth 60fps скролл для 1000+ страниц

### 9.2 [M] Web Worker для тяжёлых операций
- PDF merge/split в worker
- Image processing в worker
- PDF encryption/decryption в worker
- Не блокировать main thread

### 9.3 [M] IndexedDB кэширование
**Текущее состояние:** `indexed-storage.js` — есть.
- Кэшировать отрендеренные страницы между сессиями
- Кэшировать OCR результаты
- LRU eviction policy
- Storage quota management

---

## Фаза 10: Интеграции

### 10.1 [L] Cloud Storage (полноценная)
**Текущее состояние:** `cloud-integration.js` — framework.
**Реализовать:**
- Google Drive: OAuth + file picker
- OneDrive: OAuth + file picker
- Dropbox: OAuth + file picker
- Save back to cloud

### 10.2 [M] Print production
- Preflight check
- Color separation preview
- Bleed/trim marks
- Overprint simulation

### 10.3 [S] Multimedia
- Embedded audio/video player
- Rich media annotations

---

## Приоритеты реализации

### Волна A (критическое — максимальный ROI)
1. **1.1** PDF.js TextLayer API — [XL] исправит 80% проблем с текстом
2. **5.1** Ускорение OCR — [L] с 28с до ~3-5с на страницу
3. **2.1** Intelligent Text Flow — [XL] ключевая фича Acrobat
4. **6.1** Полные аннотации — [L] highlight/underline/sticky notes

### Волна B (важное)
5. **3.2** Электронные подписи Pro — [XL]
6. **4.1** PDF→Word с форматированием — [L]
7. **1.2** AnnotationLayer — [L]
8. **2.3** Page organizer UI — [M]

### Волна C (расширение функций)
9. **3.1** Интерактивные формы — [L]
10. **6.2** Комментарии и рецензирование — [M]
11. **4.2** PDF→Excel — [M]
12. **9.1** Virtual scrolling production — [L]

### Волна D (polish)
13. **8.3** Полная i18n — [M]
14. **7.1** Certificate подписи — [M]
15. **8.2** Multi-tab — [M]
16. **8.1** Панель инструментов Acrobat-style — [L]

---

## GAP Analysis: NovaReader vs Adobe Acrobat Pro

| Функция | Adobe Acrobat Pro | NovaReader | GAP |
|---------|------------------|------------|-----|
| PDF рендеринг | Отлично | Хорошо | Малый |
| Текстовый слой | Точный | Исправлен (кастомный) | Средний — нужен TextLayer API |
| Inline text editing | Полный reflow | Одиночный span | Большой |
| Image editing | Crop/replace/resize | Базовый block | Большой |
| Аннотации | 20+ типов | 6 типов | Большой |
| Формы | Полные AcroForm | Базовое заполнение | Средний |
| eSign | Полноценный | Stamp-only | Большой |
| OCR | 2-3 сек/стр | 28 сек/стр | Критический |
| Конвертация | Word/Excel/PPT | Word (базовый) | Большой |
| Сравнение | Side-by-side + overlay | Базовый diff | Средний |
| Безопасность | Certificate + encrypt | Password + redact | Средний |
| i18n | 30+ языков | 8 (540 хардкод) | Средний |
| Производительность | 1000+ стр | Базовый | Средний |
| Cloud | Full integration | Framework only | Средний |

---

*Источники: [Adobe Acrobat features](https://www.adobe.com/acrobat/features.html), [Adobe Acrobat Pro vs Standard](https://www.pdfgear.com/pdf-editor-reader/adobe-acrobat-pro-vs-standard.htm), [PDF.js TextLayer](https://github.com/mozilla/pdf.js/issues/18206)*
