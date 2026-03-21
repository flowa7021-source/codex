# NovaReader — План технического улучшения PDF-функций

## Сводка текущих проблем

### 1. PDF→DOCX конвертер (КРИТИЧНО)
**Текущее состояние:** Ручной генератор OOXML + ручной ZIP-архиватор (строки 261-922 в app.js)
**Проблемы:**
- Собственная реализация ZIP (без сжатия!) — файлы в 5-10 раз больше, чем нужно
- Примитивная генерация XML: ни одного стиля кроме Title/Heading2/TableGrid
- Нет поддержки: шрифтов, цветов текста, выравнивания, колонтитулов, нумерации, списков
- Таблицы определяются эвристикой `split(/\t|  {2,}|\|/)` — ненадёжно
- Изображения страниц добавляются с фиксированными размерами `5800000 x 7500000 EMU` (не пропорционально)
- `buildDocxXmlWithImages()` при наличии OCR-данных группирует слова по Y-координатам, но теряет форматирование
- Heading detection: `lineHeight > avgFontSize * 1.3` — грубая эвристика
- Нет numbering.xml → нумерованные списки невозможны
- Нет header/footer → колонтитулы невозможны

### 2. PDF Merge (строки 5815-5943)
**Проблемы:**
- Рендерит каждую страницу в canvas как JPEG, затем собирает новый PDF из изображений
- **Полная потеря текстового слоя, закладок, ссылок, форм, метаданных**
- Размер выходного файла огромный (все страницы как JPEG)
- Собственная реализация PDF-структуры (строки 5865-5943) — хрупкая, не поддерживает сжатие

### 3. PDF Split (строки 5946-6004)
**Проблемы:**
- Та же проблема что и merge: рендерит страницы как картинки, потом собирает PDF
- Теряет текст, формы, закладки, аннотации
- Использует `prompt()` для ввода — неудобно

### 4. Аннотации и экспорт (строки 7815-7845)
**Проблемы:**
- Экспорт аннотаций только как растровые PNG/SVG поверх canvas
- Нет сохранения аннотаций в PDF-формат (annotation layer в PDF)
- Экспортированный PDF — это просто изображение страницы с наложенными рисунками

### 5. PDF Forms (строки 7845-7889)
**Проблемы:**
- Читает AcroForm поля через PDF.js, но заполнение работает только как overlay
- Нет записи заполненных данных обратно в PDF
- Нет поддержки checkbox, radio, dropdown в формах

### 6. Block Editor (pdf-advanced-edit.js)
**Проблемы:**
- Блоки рисуются на отдельном canvas overlay, но не сохраняются в PDF
- Image блок использует `new Image()` синхронно — мерцание при первой загрузке
- Нет снэппинга к сетке, нет направляющих

### 7. Watermark / Stamp / Signature
**Проблемы:**
- Рисуются на `annotationCanvas` — при экспорте/сохранении теряются
- Нет возможности вставить watermark на все страницы сразу
- Stamp использует фиксированные 5 типов, нет кастомных

### 8. Conversion Plugins (Счёт/Отчёт/Таблица)
**Проблемы:** Заглушки без реальной логики конвертации

---

## Рекомендуемые open-source библиотеки

| Библиотека | npm | Лицензия | Назначение |
|---|---|---|---|
| **docx** | `docx` v9.6+ | MIT | Создание DOCX с полным API (таблицы, изображения, стили, колонтитулы, списки) |
| **pdf-lib** | `pdf-lib` | MIT | Манипуляция PDF: merge, split, формы, аннотации, водяные знаки — без потери данных |
| **@pdf-lib/fontkit** | `@pdf-lib/fontkit` | MIT | Подключение кастомных шрифтов в pdf-lib |
| **pdfjs-dist** | уже установлен | Apache 2.0 | Извлечение текста с позиционированием |

---

## Фаза 1: DOCX конвертер — полная переработка (Приоритет: ВЫСШИЙ)

### 1.1 Установка библиотеки `docx`
```bash
npm install docx
```
Размер: ~300KB (browser bundle). MIT лицензия. Работает в browser/Tauri.

### 1.2 Новая архитектура конвертера

**Вместо** ручного XML → использовать `docx` API:

```javascript
import { Document, Packer, Paragraph, TextRun, Table, TableRow,
         TableCell, ImageRun, HeadingLevel, AlignmentType,
         Header, Footer, PageNumber, NumberFormat,
         BorderStyle, WidthType } from 'docx';
```

**Пайплайн конвертации:**
```
PDF страница → PDF.js getTextContent() → структурированные текстовые блоки
  ↓
Анализ layout (позиции, размеры шрифтов, отступы)
  ↓
docx Document → Paragraph[] с правильными стилями
  ↓
Packer.toBlob() → DOCX файл (сжатый ZIP, правильная структура)
```

### 1.3 Извлечение структурированного текста из PDF

**Ключевая функция: `extractStructuredContent(pageNum)`**

PDF.js `getTextContent()` возвращает массив `items` с:
- `str` — текст
- `transform[4], transform[5]` — позиция X, Y
- `transform[0]` — масштаб шрифта (ширина)
- `height` — высота строки
- `fontName` — имя шрифта

**Алгоритм:**
1. Сортировка items по Y (сверху вниз), затем по X (слева направо)
2. Группировка в строки: items с |Y1 - Y2| < threshold → одна строка
3. Детекция заголовков: fontSize > среднего * 1.3 → HeadingLevel.HEADING_1/2/3
4. Детекция таблиц: несколько столбцов текста с одинаковыми X-позициями → Table
5. Детекция списков: строки начинающиеся с "•", "–", "1.", "a)" → BulletList/NumberedList
6. Детекция отступов: X > leftMargin + threshold → indent level

### 1.4 Маппинг шрифтов

```javascript
const FONT_MAP = {
  // PDF standard fonts → Word fonts
  'Times-Roman': 'Times New Roman',
  'Times-Bold': 'Times New Roman',
  'Times-Italic': 'Times New Roman',
  'Helvetica': 'Arial',
  'Helvetica-Bold': 'Arial',
  'Courier': 'Courier New',
  // CJK, Cyrillic defaults
  default: 'Arial',
};

function mapPdfFont(pdfFontName) {
  const base = pdfFontName.replace(/[,-].*/g, '');
  return FONT_MAP[pdfFontName] || FONT_MAP[base] || FONT_MAP.default;
}
```

### 1.5 Генерация DOCX через `docx` API

```javascript
async function convertPdfToDocx(title, pageCount) {
  const sections = [];

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const content = await extractStructuredContent(pageNum);
    const children = [];

    for (const block of content.blocks) {
      if (block.type === 'heading') {
        children.push(new Paragraph({
          text: block.text,
          heading: block.level, // HeadingLevel.HEADING_1, etc.
          spacing: { before: 240, after: 120 },
        }));
      } else if (block.type === 'paragraph') {
        children.push(new Paragraph({
          children: block.runs.map(run => new TextRun({
            text: run.text,
            bold: run.bold,
            italics: run.italic,
            font: run.fontFamily,
            size: run.fontSize * 2, // half-points
            color: run.color,
          })),
          indent: block.indent ? { left: block.indent * 720 } : undefined,
          alignment: block.alignment,
        }));
      } else if (block.type === 'table') {
        children.push(buildDocxTableFromBlocks(block));
      } else if (block.type === 'list') {
        // Numbered or bullet list
        for (const item of block.items) {
          children.push(new Paragraph({
            text: item.text,
            bullet: { level: item.level },
          }));
        }
      } else if (block.type === 'image') {
        const imageData = await capturePageRegionAsImage(pageNum, block.bounds);
        if (imageData) {
          children.push(new Paragraph({
            children: [new ImageRun({
              data: imageData,
              transformation: { width: block.width, height: block.height },
            })],
          }));
        }
      }
    }

    sections.push({
      properties: pageNum > 1 ? { page: { pageBreakBefore: true } } : {},
      children,
    });
  }

  const doc = new Document({
    title,
    creator: 'NovaReader',
    sections,
    styles: { ... }, // define default styles
  });

  return await Packer.toBlob(doc);
}
```

### 1.6 Режимы конвертации (выбор пользователя)

| Режим | Описание |
|---|---|
| **Текстовый** | Только текст с форматированием, без изображений |
| **Текст + Изображения** | Текст + изображения страниц как фон (для проверки) |
| **Точный layout** | Каждая страница как таблица 1x1 с изображением + overlay текст |
| **Только изображения** | Страницы как картинки (для сканов без OCR) |

**UI**: модальное окно перед конвертацией с выбором режима и диапазона страниц.

### 1.7 Обработка таблиц

```javascript
function detectTableBlocks(items, pageWidth) {
  // 1. Найти вертикальные линии (колонки)
  // 2. Кластеризация X-позиций текста
  // 3. Если 3+ кластеров с 3+ строками → это таблица
  // 4. Определить границы строк по Y-позициям
  // 5. Создать Table с правильными TableRow/TableCell
}
```

---

## Фаза 2: pdf-lib для Merge/Split/Forms (Приоритет: ВЫСШИЙ)

### 2.1 Установка
```bash
npm install pdf-lib @pdf-lib/fontkit
```
Размер: ~400KB. MIT лицензия. Работает в browser.

### 2.2 PDF Merge — без потери данных

**Вместо** canvas→JPEG→новый PDF:
```javascript
import { PDFDocument } from 'pdf-lib';

async function mergePdfFiles(files) {
  const mergedPdf = await PDFDocument.create();

  for (const file of files) {
    const arrayBuffer = await file.arrayBuffer();
    const sourcePdf = await PDFDocument.load(arrayBuffer);
    const pages = await mergedPdf.copyPages(sourcePdf,
      sourcePdf.getPageIndices());
    pages.forEach(page => mergedPdf.addPage(page));
  }

  // Сохраняет: текст, шрифты, изображения, формы, ссылки
  const mergedBytes = await mergedPdf.save();
  return new Blob([mergedBytes], { type: 'application/pdf' });
}
```

**Преимущества:**
- Текстовый слой сохраняется
- Закладки и ссылки сохраняются
- Размер файла такой же, как оригинал (без перекодирования)
- На порядок быстрее (нет рендеринга)

### 2.3 PDF Split — без потери данных

```javascript
async function splitPdfPages(pageNums) {
  const arrayBuffer = state.file.arrayBuffer();
  const sourcePdf = await PDFDocument.load(arrayBuffer);
  const newPdf = await PDFDocument.create();

  const copiedPages = await newPdf.copyPages(sourcePdf,
    pageNums.map(n => n - 1)); // 0-indexed
  copiedPages.forEach(page => newPdf.addPage(page));

  return new Blob([await newPdf.save()], { type: 'application/pdf' });
}
```

### 2.4 Диалог Split вместо prompt()

Модальное окно:
- Визуальный выбор страниц (чекбоксы с превью)
- Поле ввода диапазона "1-3, 5, 7-10"
- Предпросмотр результата
- Кнопка "Разделить на отдельные файлы" (каждая страница в свой PDF)

### 2.5 PDF Forms — полноценное заполнение

```javascript
import { PDFDocument } from 'pdf-lib';

async function fillPdfForm(formData) {
  const pdfBytes = await state.file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const form = pdfDoc.getForm();

  for (const [fieldName, value] of Object.entries(formData)) {
    const field = form.getField(fieldName);
    if (field instanceof PDFTextField) field.setText(value);
    if (field instanceof PDFCheckBox) value ? field.check() : field.uncheck();
    if (field instanceof PDFDropdown) field.select(value);
    if (field instanceof PDFRadioGroup) field.select(value);
  }

  // Сохраняем заполненный PDF
  const filledBytes = await pdfDoc.save();
  return new Blob([filledBytes], { type: 'application/pdf' });
}
```

### 2.6 Экспорт заполненной формы как нового PDF

Кнопка "Сохранить заполненный PDF" → скачивает PDF с заполненными полями.

---

## Фаза 3: Аннотации — сохранение в PDF (Приоритет: ВЫСОКИЙ)

### 3.1 Встраивание аннотаций в PDF через pdf-lib

```javascript
async function exportAnnotatedPdf() {
  const pdfBytes = await state.file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(pdfBytes);

  // Для каждой страницы с аннотациями
  for (const [pageNum, strokes] of annotationStore) {
    const page = pdfDoc.getPage(pageNum - 1);
    const { width, height } = page.getSize();

    for (const stroke of strokes) {
      if (stroke.tool === 'highlighter') {
        // Добавить highlight annotation
        page.drawRectangle({
          x: stroke.x, y: height - stroke.y - stroke.h,
          width: stroke.w, height: stroke.h,
          color: rgb(1, 0.85, 0.3),
          opacity: 0.3,
        });
      } else if (stroke.tool === 'pen') {
        // Нарисовать линии
        for (let i = 1; i < stroke.points.length; i++) {
          page.drawLine({
            start: { x: stroke.points[i-1].x, y: height - stroke.points[i-1].y },
            end: { x: stroke.points[i].x, y: height - stroke.points[i].y },
            thickness: stroke.size,
            color: parseColor(stroke.color),
          });
        }
      }
      // ... rect, circle, arrow, text comments
    }
  }

  return new Blob([await pdfDoc.save()], { type: 'application/pdf' });
}
```

### 3.2 Text-annotation (комментарии)

Использовать `pdf-lib` для добавления настоящих PDF text annotations:
```javascript
page.doc.context.register(
  page.doc.context.obj({
    Type: 'Annot',
    Subtype: 'Text',
    Rect: [x, y, x+24, y+24],
    Contents: commentText,
    C: [1, 1, 0], // yellow
  })
);
```

---

## Фаза 4: Watermark / Stamp через pdf-lib (Приоритет: СРЕДНИЙ)

### 4.1 Watermark на все страницы

```javascript
async function addWatermarkToPdf(text, options = {}) {
  const pdfBytes = await state.file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  for (const page of pdfDoc.getPages()) {
    const { width, height } = page.getSize();
    page.drawText(text, {
      x: width / 4,
      y: height / 2,
      size: options.fontSize || 60,
      font,
      color: rgb(0.7, 0.7, 0.7),
      opacity: options.opacity || 0.3,
      rotate: degrees(-45),
    });
  }

  return new Blob([await pdfDoc.save()], { type: 'application/pdf' });
}
```

### 4.2 Кастомные штампы
- Возможность загрузить изображение штампа
- Размещение штампа на выбранных страницах (или всех)
- Поддержка "УТВЕРЖДЕНО", "СОГЛАСОВАНО", "КОНФИДЕНЦИАЛЬНО" + custom

### 4.3 Электронная подпись
- Вставка изображения подписи через pdf-lib в PDF
- Позиционирование через drag&drop

---

## Фаза 5: Block Editor — улучшения (Приоритет: СРЕДНИЙ)

### 5.1 Снэппинг и направляющие
- Snap to grid (8px шаг)
- Smart guides при перемещении (линии до ближайших блоков)
- Snap to center/edges других блоков

### 5.2 Предзагрузка изображений
```javascript
// Вместо синхронного new Image()
addImageBlock(pageNum, x, y, imageDataUrl, width, height) {
  const img = new Image();
  img.onload = () => this._notify('imageReady', pageNum, block);
  img.src = imageDataUrl;
  block._imgElement = img; // cache loaded image
}
```

### 5.3 Сохранение блоков в PDF
При экспорте — блоки рисуются на страницах через pdf-lib:
```javascript
for (const block of blocks) {
  if (block.type === 'text') {
    page.drawText(block.content, { x, y, size, font, color });
  } else if (block.type === 'image') {
    const img = await pdfDoc.embedPng(block.imageData);
    page.drawImage(img, { x, y, width, height });
  }
}
```

---

## Фаза 6: Conversion Plugins (Приоритет: НИЗКИЙ)

### 6.1 Счёт-фактура
Шаблон DOCX с полями: поставщик, покупатель, товары, суммы. Заполнение через `docx` API.

### 6.2 Отчёт
Извлечение текста + структурирование в разделы + экспорт в DOCX с заголовками и оглавлением.

### 6.3 Таблица
Интеллектуальное извлечение таблиц из PDF → экспорт в CSV / XLSX / DOCX-таблицу.

---

## Фаза 7: Текстовая панель — улучшения (Приоритет: СРЕДНИЙ)

### 7.1 Структурированное извлечение текста
Использовать PDF.js `getTextContent()` с `includeMarkedContent: true` для получения:
- Параграфов с правильными переносами
- Заголовков (по размеру шрифта)
- Списков (по маркерам)

### 7.2 Copy с форматированием
При копировании из текстовой панели — копировать HTML с форматированием в clipboard:
```javascript
const htmlText = '<b>Заголовок</b><p>Параграф текста...</p>';
navigator.clipboard.write([
  new ClipboardItem({
    'text/html': new Blob([htmlText], { type: 'text/html' }),
    'text/plain': new Blob([plainText], { type: 'text/plain' }),
  })
]);
```

### 7.3 Поиск — multi-page highlight
При поиске по всему документу — показывать total найдено, навигация ↑↓ между страницами.

---

## Порядок реализации

| # | Фаза | Описание | Приоритет | Оценка сложности |
|---|---|---|---|---|
| **1** | DOCX конвертер | Библиотека `docx`, извлечение layout | ВЫСШИЙ | Высокая |
| **2** | Merge/Split через pdf-lib | `pdf-lib` без потери данных | ВЫСШИЙ | Средняя |
| **3** | PDF Forms через pdf-lib | Заполнение + экспорт | ВЫСОКИЙ | Средняя |
| **4** | Аннотации в PDF | pdf-lib annotation export | ВЫСОКИЙ | Средняя |
| **5** | Watermark/Stamp/Signature | pdf-lib на все страницы | СРЕДНИЙ | Низкая |
| **6** | Block Editor | Snap, guides, pdf-lib export | СРЕДНИЙ | Средняя |
| **7** | Текст + Поиск | Структурированное извлечение | СРЕДНИЙ | Низкая |
| **8** | Conversion Plugins | Счёт/Отчёт/Таблица шаблоны | НИЗКИЙ | Средняя |

---

## Зависимости для установки

```bash
npm install docx pdf-lib @pdf-lib/fontkit
```

Все три библиотеки — MIT лицензия, работают в browser/Tauri, не требуют серверной стороны.
