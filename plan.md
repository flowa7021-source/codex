# План реализации: Улучшения NovaReader (8 пунктов)

## Анализ текущего состояния

### Ключевые проблемы:
1. **Текстовый редактор** — кнопка "Ред." только переключает `readOnly` у `<textarea>` внизу. Нет inline-редактирования НА канвасе как в Acrobat.
2. **Текстовый слой** — полностью отсутствует. В `canvas-stack` есть только `viewerCanvas` + `annotationCanvas`. Нет слоя для выделения/копирования текста мышью.
3. **Поиск** — работает по данным `adapter.getText()` и OCR кэшу, но результаты НЕ подсвечиваются на странице (только переход на страницу).
4. **OCR** — Tesseract настроен с 2 вариантами preprocessing (balanced) или 6 (accurate), но: не используется PSM, не настроены whitelist/параметры, данные о слов. bbox (recognizeWithBoxes) не используются.
5. **DOCX** — экспортирует OCR текст построчно + картинки страниц целиком. Нет сохранения позиций/шрифтов/форматирования из Tesseract word data.
6. **Вставка изображений** — `blockEditor.addImageBlock()` существует, но нет UI для загрузки/вставки картинки.
7. **createObjectURL ошибка** (лог #53) — вероятно вызвана передачей не-Blob аргумента (возможно undefined).

---

## Пункт 1: Исправить редактор текста (inline на canvas)

### Что делаем:
- Добавляем текстовый слой (`<div id="textLayerDiv">`) в `canvas-stack` между canvas'ами
- При активации "Ред." режима текст в text layer становится `contenteditable`
- Клик по слову — появляется inline textarea/contenteditable прямо на позиции слова
- Изменения сохраняются через `blockEditor` и в edit layer

### Файлы:
- `index.html` — добавить `<div id="textLayerDiv">` в `canvas-stack`
- `styles.css` — стили для text layer (position: absolute, прозрачный фон, z-index между canvas'ами)
- `app.js` — `setTextEditMode()` включает contenteditable на text layer div
- `modules/pdf-advanced-edit.js` — интеграция с block editor

---

## Пункт 2: Добавить текстовый слой поверх картинки

### Что делаем:
- **Для PDF**: используем PDF.js `page.getTextContent()` + рендерим `<span>` элементы с позициями из transform
- **Для OCR**: используем `recognizeWithBoxes()` (уже есть в tesseract-adapter.js) для получения bbox каждого слова
- Слой рендерится в `<div id="textLayerDiv">` поверх canvas
- Позволяет нативное выделение текста мышью и Ctrl+C

### Реализация:
1. Добавить HTML контейнер `textLayerDiv` в canvas-stack
2. Новая функция `renderTextLayer(page, viewport)`:
   - Для PDF: `page.getTextContent()` → рендер spans с CSS transform
   - Для OCR: word boxes → рендер spans
3. Вызывать из `renderCurrentPage()` после рендера canvas
4. Стили: `color: transparent; ::selection { background: rgba(0,100,255,0.3) }`

---

## Пункт 3: Исправить поиск по документу

### Что делаем:
- При нахождении совпадения — подсвечиваем его НА странице (highlight spans в text layer)
- Добавляем CSS класс `.search-highlight` для визуального выделения
- При переходе между результатами — скролл к подсвеченному слову

### Реализация:
1. Функция `highlightSearchMatches(query)` — ищет spans в textLayerDiv, оборачивает совпадения в `<mark>`
2. При переключении между результатами (`searchNext/searchPrev`) — прокрутка к активному `<mark>`
3. CSS: `.search-highlight { background: #ffd84d; }` `.search-highlight.active { background: #ff9500; }`

---

## Пункт 4: Повысить качество OCR Tesseract

### Что делаем:
1. **Настроить Tesseract parameters** через `worker.setParameters()`:
   - `tessedit_pageseg_mode: '6'` (Assume uniform block of text)
   - `preserve_interword_spaces: '1'`
   - `textord_heavy_nr: '1'` (heavy noise removal)
2. **Улучшить preprocessing**:
   - Добавить adaptive threshold (Sauvola/Niblack) вместо только Otsu
   - Добавить морфологические операции (dilation + erosion) для чистки
   - Увеличить DPI рендера для OCR (2x вместо текущего adaptive)
3. **Multi-pass OCR**: сначала быстрый проход, если confidence < 80 → повторный с другими параметрами
4. **Сохранять word-level data** (bbox, confidence) для text layer и DOCX

### Файлы:
- `modules/tesseract-adapter.js` — добавить `setParameters()` после init
- `app.js` — улучшить `preprocessOcrCanvas()`, сохранять word data

---

## Пункт 5: Переписать конвертер PDF → Word

### Что делаем:
Полностью переписать DOCX экспорт с сохранением layout:

1. **Текст с позиционированием**:
   - Использовать word-level bbox данные из OCR/PDF.js textContent
   - Каждый текстовый блок → `<w:r>` с позицией через `<w:pPr><w:framePr>`
   - Шрифт, размер, стиль из OCR/PDF metadata

2. **Картинки**:
   - Только реальные картинки/иллюстрации (не скриншоты целых страниц)
   - Для сканированных документов: фоновое изображение + текстовый слой поверх

3. **Таблицы**:
   - Улучшенное определение таблиц на основе bbox координат (не только по табуляции)

4. **Структура**:
   - Абзацы определяются по расстоянию между строками
   - Заголовки — по размеру шрифта

### Файлы:
- `app.js` — переписать `buildDocxXmlWithImages()`, `generateDocxWithImages()`
- Новая логика: OCR word data → DOCX paragraphs с proper formatting

---

## Пункт 6: Добавить вставку рисунков/картинок в PDF

### Что делаем:
1. **Кнопка "Вставить изображение"** в toolbar text tools
2. При клике — file picker (PNG/JPG/SVG)
3. Картинка загружается → добавляется как block через `blockEditor.addImageBlock()`
4. Пользователь может перемещать/масштабировать картинку на canvas
5. Экспорт: картинка включается в annotated PDF/PNG

### UI:
- Новая кнопка `<button id="insertImage">🖼 Вставить</button>` в text tools
- При клике: `<input type="file" accept="image/*">` → FileReader → dataURL → addImageBlock

### Файлы:
- `index.html` — кнопка insertImage
- `app.js` — обработчик загрузки и вставки
- Block editor overlay уже поддерживает image blocks

---

## Пункт 7: Добавить функции уровня Adobe Acrobat PRO

### Новые функции:
1. **Штампы/водяные знаки** — текст/изображение с прозрачностью на каждую страницу
2. **Нумерация страниц** — Bates numbering overlay
3. **Объединение PDF** — drag & drop нескольких файлов → merge
4. **Разделение PDF** — выбрать диапазон страниц → extract
5. **Поворот отдельных страниц** (уже есть глобальный поворот, добавить per-page)
6. **Сравнение документов** — diff двух PDF (overlay mode)
7. **Закладки** — переход к именованным позициям
8. **Подпись** — рисование подписи стилусом/мышью и вставка

### Приоритет реализации:
- [Высокий] Штампы/водяные знаки, нумерация, закладки
- [Средний] Объединение/разделение PDF, подпись
- [Низкий] Сравнение документов

---

## Пункт 8 (bugfix): Исправить createObjectURL ошибку

### Проблема:
Лог #53: `Failed to execute 'createObjectURL' on 'URL': Overload resolution failed`
Это значит что в `URL.createObjectURL()` передан не Blob. Нужно найти все вызовы и добавить проверки.

### Исправление:
- Обернуть все `URL.createObjectURL()` вызовы в helper с проверкой instanceof Blob
- Добавить fallback/error handling

---

## Порядок реализации:

1. **createObjectURL bugfix** (быстрый fix)
2. **Text layer** (пункты 2 + 1) — фундамент для всего остального
3. **Search highlighting** (пункт 3) — зависит от text layer
4. **OCR quality** (пункт 4)
5. **DOCX export** (пункт 5) — зависит от OCR word data
6. **Image insertion** (пункт 6)
7. **Acrobat features** (пункт 7) — самое масштабное, в конце
