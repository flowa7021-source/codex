# NovaReader 3.0 — Мастер-план обновления

> Цель: довести функциональность до уровня Adobe Acrobat Pro, полностью переработать UI/UX, добавить профессиональные инструменты.

---

## Часть I. ПОЛНАЯ ПЕРЕРАБОТКА ИНТЕРФЕЙСА (стиль Adobe Acrobat Pro)

### Проблема текущего UI

Сейчас viewer-area организован вертикально:
```
[toolbar-top 44px] → [toolbar-bottom 86px с 4 табами] → [canvas-wrap] → [resize] → [text-panel 140px]
```

**Проблемы:**
- Панели инструментов **сверху и снизу** канваса сжимают область просмотра по вертикали — остаётся ~60% высоты экрана
- Нижняя toolbar с 4 табами забирает место даже когда неактивна (86px + text-panel 140px = 226px потеряно)
- Нет правой панели — все инструменты втиснуты в горизонтальные полоски
- Канвас с `padding: 8px` и серым фоном не создаёт ощущение "листа бумаги"
- Нет непрерывной прокрутки (continuous scroll) — показывается одна страница
- Миниатюры страниц в sidebar — последний по порядку раздел, до него нужно скроллить

### Новая архитектура UI (по образцу Adobe Acrobat Pro)

```
┌─────────────────────────────────────────────────────────────────┐
│  ВЕРХНЯЯ ПАНЕЛЬ (Command Bar)                                   │
│  [Файл ▾] [Редактирование ▾] [Вид ▾] [Инструменты ▾]          │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Quick Actions: ← → | стр 1/42 | − 100% + | ↻ | ◑ ⛶       ││
│  └─────────────────────────────────────────────────────────────┘│
├──────┬──────────────────────────────────────────────┬───────────┤
│ LEFT │                                              │  RIGHT    │
│PANEL │         ОБЛАСТЬ ДОКУМЕНТА                    │  PANEL    │
│      │                                              │           │
│Миниат│    ┌──────────────────────────┐              │ КОНТЕКСТ- │
│юры   │    │                          │              │ НАЯ       │
│страни│    │      Страница PDF        │              │ ПАНЕЛЬ    │
│ц     │    │      (белый лист         │              │           │
│      │    │       на тёмном фоне)    │              │ Инструм.  │
│──────│    │                          │              │ Аннотации │
│Закла-│    │                          │              │ Формы     │
│дки   │    └──────────────────────────┘              │ OCR       │
│      │    ┌──────────────────────────┐              │ Редактор  │
│──────│    │      Страница 2          │              │ Комментар.│
│Структ│    │      (continuous scroll) │              │           │
│ура   │    │                          │              │           │
│      │    └──────────────────────────┘              │           │
├──────┴──────────────────────────────────────────────┴───────────┤
│  STATUS BAR: Стр 1/42 | 100% | PDF 2.4 MB | Время чтения 45м  │
└─────────────────────────────────────────────────────────────────┘
```

### I-1. Новая структура HTML (app-shell grid)

**Было:**
```
grid-template-columns: [sidebar 280px] [resize 5px] [viewer-area 1fr]
```

**Стало:**
```css
.app-shell {
  display: grid;
  grid-template-columns: var(--left-panel-width, 260px) 1fr var(--right-panel-width, 0px);
  grid-template-rows: auto 1fr auto;
  height: 100vh;
}
/*
  Row 1: Command bar (compact top toolbar)
  Row 2: [Left Panel | Document Area | Right Panel]
  Row 3: Status bar
*/
```

**Правая панель** (0px по умолчанию, 280px при открытии) содержит контекстные инструменты — аналог Tools Panel в Acrobat. При выборе инструмента (аннотации, формы, OCR, редактирование) правая панель открывается с соответствующими настройками.

### I-2. Command Bar (замена двух toolbar)

Объединить `toolbar-top` + `toolbar-bottom` в одну компактную строку:

```
[☰ Menu] [← →] [стр ___/42] [− 100% + ↔ ⊡] [↻] | [✋ Рука] [I Текст] [✎ Аннотации] [📝 Формы] [🔍 OCR] [📎 Инструменты] | [◑ ⛶]
```

- **Высота: 40px** (вместо 44 + 86 = 130px)
- Кнопки инструментов переключают **правую панель**
- Поиск (Ctrl+F) — появляется как **плавающая панель** поверх документа (как в Chrome/Acrobat), не занимает постоянное место
- **Экономия: +186px вертикали для документа**

### I-3. Область документа — Continuous Scroll

**Текущая проблема:** Показывается одна страница за раз. Нужно нажимать кнопки навигации.

**Решение:** Виртуализированный continuous scroll:

```javascript
class ContinuousScrollViewer {
  constructor(container, pdfDocument) {
    this.pages = [];           // Массив {canvas, textLayer, annotLayer}
    this.visibleRange = [0,0]; // Диапазон видимых страниц
    this.pageGap = 12;         // px между страницами
    this.scrollContainer = container;
  }

  // Виртуализация: рендерим только видимые + по 2 буферные сверху/снизу
  onScroll() {
    const scrollTop = this.scrollContainer.scrollTop;
    const viewHeight = this.scrollContainer.clientHeight;

    const firstVisible = this.getPageAtOffset(scrollTop);
    const lastVisible = this.getPageAtOffset(scrollTop + viewHeight);

    const renderFrom = Math.max(0, firstVisible - 2);
    const renderTo = Math.min(this.totalPages - 1, lastVisible + 2);

    // Рендерим новые, удаляем ушедшие за буфер
    for (let i = renderFrom; i <= renderTo; i++) {
      if (!this.pages[i].rendered) this.renderPage(i);
    }
    for (let i = 0; i < renderFrom - 2; i++) {
      this.unloadPage(i); // Освобождаем память
    }
  }

  // Каждая страница — отдельный DOM-элемент с тенью
  renderPage(index) {
    const wrapper = document.createElement('div');
    wrapper.className = 'page-frame';
    wrapper.style.cssText = `
      width: ${pageWidth}px;
      height: ${pageHeight}px;
      margin: 0 auto ${this.pageGap}px;
      background: white;
      box-shadow: 0 2px 12px rgba(0,0,0,0.15);
      position: relative;
    `;
    // Canvas + textLayer + annotationLayer внутри wrapper
  }
}
```

**Режимы отображения** (как в Acrobat):
| Режим | Описание |
|-------|----------|
| **Single Page** | Одна страница (текущее поведение) |
| **Continuous** | Вертикальная прокрутка (по умолчанию в 3.0) |
| **Two-Up** | Две страницы рядом (книжный разворот) |
| **Two-Up Continuous** | Книжный разворот с прокруткой |

### I-4. Стилизация области документа

```css
/* Область документа — тёмный фон, как в Acrobat */
.document-viewport {
  background: #525659;       /* Характерный серый фон Acrobat */
  overflow: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 40px;
  scroll-behavior: smooth;
}
body.light .document-viewport {
  background: #d0d0d0;
}

/* Каждая страница — "лист бумаги" с тенью */
.page-frame {
  background: #ffffff;
  box-shadow: 0 1px 4px rgba(0,0,0,0.2), 0 4px 16px rgba(0,0,0,0.1);
  border-radius: 2px;
  margin-bottom: 12px;
  position: relative;
  overflow: hidden;
  flex-shrink: 0;
}
.page-frame:hover {
  box-shadow: 0 2px 8px rgba(0,0,0,0.25), 0 6px 20px rgba(0,0,0,0.12);
}

/* Номер страницы под каждым листом */
.page-number-label {
  text-align: center;
  font-size: 11px;
  color: #999;
  margin: 4px 0 16px;
}
```

### I-5. Левая панель (Page Thumbnails, Bookmarks, Outline)

Реорганизовать левую панель по модели Acrobat:

```
┌───────────────────────┐
│ [📄] [🔖] [📑] [📎]  │  ← Иконки-переключатели
├───────────────────────┤
│                       │
│  ┌─────┐  ┌─────┐    │
│  │  1  │  │  2  │    │  ← Сетка миниатюр (2 колонки)
│  └─────┘  └─────┘    │
│  ┌─────┐  ┌─────┐    │
│  │  3  │  │  4  │    │
│  └─────┘  └─────┘    │
│          ...          │
│                       │
└───────────────────────┘
```

**Табы левой панели:**
1. **📄 Страницы** — миниатюры в сетке 2 колонки (drag-and-drop для переупорядочивания)
2. **🔖 Закладки** — пользовательские закладки
3. **📑 Структура** — оглавление документа (TOC)
4. **📎 Вложения** — прикреплённые файлы (если есть)

**Миниатюры страниц:**
- Отрисовка через `canvas` 150x200px
- Активная страница — синяя рамка
- Drag-and-drop для изменения порядка страниц
- Контекстное меню (ПКМ): Повернуть, Удалить, Извлечь, Вставить страницу

### I-6. Правая панель (Context Tools)

Правая панель появляется при выборе инструмента:

```
┌───────────────────────┐
│ ✎ Аннотации      [✕]  │
├───────────────────────┤
│                       │
│ Рисование             │
│ [🖊 Перо] [🖍 Маркер] │
│ [⬜ Прямоугольник]     │
│ [⭕ Овал] [→ Стрелка]  │
│ [📝 Текст. комментарий]│
│                       │
│ ─── Настройки ───     │
│ Цвет: [●●●●●●]       │
│ Толщина: ═══●══       │
│ Прозрачность: ══●══   │
│                       │
│ ─── Комментарии ───   │
│ [Список комментариев  │
│  с привязкой к месту  │
│  на странице]         │
│                       │
└───────────────────────┘
```

**Преимущество:** Инструменты не сжимают документ по вертикали. Горизонтальное пространство используется эффективнее.

### I-7. Плавающая панель поиска (Ctrl+F)

```css
.search-floating {
  position: absolute;
  top: 8px;
  right: 16px;
  z-index: 100;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.2);
  padding: 8px 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  width: 380px;
}
```

Содержит: `[🔍 input] [▲ ▼] [2 из 34] [Aa] [.*] [✕]`
- Появляется по Ctrl+F, исчезает по Esc
- Не занимает постоянного места в layout

### I-8. Удаление нижней text-panel

Текущая text-panel (140px внизу с textarea для текста страницы) — **убрать из постоянного layout**. Заменить на:

1. **Выделение текста мышью** прямо на странице (text layer уже есть)
2. **Правая панель → "Текст страницы"** — при необходимости показать извлечённый текст, он отображается в правой панели
3. **Ctrl+C** из text layer — копирование выделенного текста

**Итог: ещё +140px для области документа.**

---

## Часть II. ПРОФЕССИОНАЛЬНЫЕ PDF-ФУНКЦИИ (уровень Acrobat Pro)

### II-1. Redaction (Редактирование конфиденциальных данных)

Ключевая функция Acrobat Pro — безвозвратное удаление конфиденциальной информации.

**Реализация:**
```javascript
// Модуль: modules/pdf-redact.js

import { PDFDocument, rgb, PDFName, PDFString } from 'pdf-lib';

class PdfRedactor {
  constructor() {
    this.redactions = new Map(); // pageNum → [{x, y, w, h, type}]
  }

  // Пометить область для редактирования
  markForRedaction(pageNum, bounds) {
    if (!this.redactions.has(pageNum)) this.redactions.set(pageNum, []);
    this.redactions.get(pageNum).push({
      ...bounds,
      type: 'area',  // area | text-pattern | regex
    });
  }

  // Пометить текст по шаблону (email, телефоны, ИНН и т.д.)
  markPatternForRedaction(pattern, pages = 'all') {
    // Поиск по text layer на каждой странице
    // Сохранение bounds каждого совпадения
  }

  // Применить — НЕОБРАТИМО
  async applyRedactions(pdfBytes) {
    const pdfDoc = await PDFDocument.load(pdfBytes);

    for (const [pageNum, areas] of this.redactions) {
      const page = pdfDoc.getPage(pageNum - 1);
      const { height } = page.getSize();

      for (const area of areas) {
        // 1. Закрасить область чёрным
        page.drawRectangle({
          x: area.x,
          y: height - area.y - area.h,
          width: area.w,
          height: area.h,
          color: rgb(0, 0, 0),
          opacity: 1,
        });

        // 2. Удалить текст под областью из content stream
        // (перезапись content stream без соответствующих операторов)
      }
    }

    // 3. Удалить метаданные
    pdfDoc.setTitle('');
    pdfDoc.setAuthor('');
    pdfDoc.setSubject('');
    pdfDoc.setKeywords([]);
    pdfDoc.setProducer('NovaReader');
    pdfDoc.setCreator('NovaReader');

    return await pdfDoc.save();
  }

  // Предустановленные шаблоны
  static PATTERNS = {
    email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    phone_ru: /(\+7|8)[\s-]?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}/g,
    inn: /\b\d{10,12}\b/g,
    card_number: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
    passport_ru: /\d{2}\s?\d{2}\s?\d{6}/g,
    snils: /\d{3}-\d{3}-\d{3}\s?\d{2}/g,
  };
}
```

**UI (правая панель "Редактирование"):**
- Кнопка "Пометить область" → режим рисования прямоугольника
- Кнопка "Найти по шаблону" → выпадающий список: Email, Телефон, ИНН, Номер карты, Паспорт, Regex...
- Помеченные области отображаются красными полупрозрачными прямоугольниками
- Кнопка "Применить редактирование" → подтверждение → необратимое удаление
- Кнопка "Очистить метаданные" → удаление автора, заголовка, production info

### II-2. Сравнение документов (Document Compare)

```javascript
// Модуль: modules/pdf-compare.js

class PdfCompare {
  // Текстовое сравнение
  async compareText(pdf1Bytes, pdf2Bytes) {
    const text1 = await this.extractAllText(pdf1Bytes);
    const text2 = await this.extractAllText(pdf2Bytes);

    // Алгоритм diff (Myers или patience diff)
    const diffs = this.computeDiff(text1, text2);

    return {
      added: diffs.filter(d => d.type === 'add'),
      removed: diffs.filter(d => d.type === 'remove'),
      changed: diffs.filter(d => d.type === 'change'),
      summary: {
        totalChanges: diffs.length,
        addedWords: ...,
        removedWords: ...,
      }
    };
  }

  // Визуальное сравнение (pixel diff)
  async compareVisual(pdf1Bytes, pdf2Bytes, pageNum) {
    const canvas1 = await this.renderPage(pdf1Bytes, pageNum);
    const canvas2 = await this.renderPage(pdf2Bytes, pageNum);

    const diffCanvas = this.pixelDiff(canvas1, canvas2);
    // Красный = удалено, зелёный = добавлено, серый = без изменений
    return diffCanvas;
  }
}
```

**UI:**
- Кнопка "Сравнить документы" в меню Инструменты
- Выбор двух файлов
- Режимы: Side-by-Side | Overlay | Text Diff
- Список изменений с навигацией ("Следующее изменение →")
- Цветовая маркировка: зелёный (добавлено), красный (удалено), жёлтый (изменено)

### II-3. Оптимизация PDF (Reduce File Size)

```javascript
// Модуль: modules/pdf-optimize.js

class PdfOptimizer {
  async optimize(pdfBytes, options = {}) {
    const pdfDoc = await PDFDocument.load(pdfBytes);

    let savings = 0;

    // 1. Удалить дублирующиеся объекты
    if (options.removeDuplicates !== false) {
      savings += await this.deduplicateObjects(pdfDoc);
    }

    // 2. Сжать изображения (ресемплинг)
    if (options.compressImages !== false) {
      for (const page of pdfDoc.getPages()) {
        // Получить все image XObjects
        // Если разрешение > options.maxDpi (default 150), пересемплировать
        // Конвертировать lossless → JPEG с quality options.jpegQuality (default 75)
      }
    }

    // 3. Удалить встроенные шрифты (subset)
    if (options.subsetFonts) {
      // Оставить только используемые глифы
    }

    // 4. Удалить метаданные, thumbnails, JS actions
    if (options.cleanMetadata) {
      pdfDoc.setTitle('');
      pdfDoc.setAuthor('');
      // Удалить XMP metadata stream
      // Удалить embedded thumbnails
      // Удалить JavaScript actions
    }

    // 5. Линеаризация (fast web view) — порядок объектов для streaming

    const optimizedBytes = await pdfDoc.save({
      useObjectStreams: true, // Сжать через object streams
    });

    return {
      original: pdfBytes.byteLength,
      optimized: optimizedBytes.byteLength,
      savings: pdfBytes.byteLength - optimizedBytes.byteLength,
      savingsPercent: ((1 - optimizedBytes.byteLength / pdfBytes.byteLength) * 100).toFixed(1),
      blob: new Blob([optimizedBytes], { type: 'application/pdf' }),
    };
  }
}
```

**UI (модальное окно):**
- Slider: Качество изображений (Low / Medium / High / Original)
- Checkbox: Удалить метаданные
- Checkbox: Сжать шрифты
- Checkbox: Удалить пустые страницы
- Показ: "Оригинал: 12.4 MB → Оптимизировано: 3.2 MB (74% экономия)"

### II-4. Bates Numbering (нумерация Бейтса)

Стандарт для юридических документов — уникальный идентификатор на каждой странице.

```javascript
async function addBatesNumbering(pdfBytes, options) {
  const { prefix = '', startNum = 1, digits = 6, suffix = '',
          position = 'bottom-right', fontSize = 10 } = options;

  const pdfDoc = await PDFDocument.load(pdfBytes);
  const font = await pdfDoc.embedFont(StandardFonts.Courier);

  let currentNum = startNum;
  for (const page of pdfDoc.getPages()) {
    const { width, height } = page.getSize();
    const batesNum = `${prefix}${String(currentNum).padStart(digits, '0')}${suffix}`;

    const textWidth = font.widthOfTextAtSize(batesNum, fontSize);

    // Позиционирование
    let x, y;
    switch (position) {
      case 'bottom-right': x = width - textWidth - 36; y = 24; break;
      case 'bottom-left':  x = 36; y = 24; break;
      case 'bottom-center': x = (width - textWidth) / 2; y = 24; break;
      case 'top-right': x = width - textWidth - 36; y = height - 36; break;
      // ...
    }

    page.drawText(batesNum, { x, y, size: fontSize, font, color: rgb(0, 0, 0) });
    currentNum++;
  }

  return new Blob([await pdfDoc.save()], { type: 'application/pdf' });
}
```

### II-5. Accessibility Checker (Проверка доступности)

```javascript
// Модуль: modules/pdf-accessibility.js

class AccessibilityChecker {
  async check(pdfDoc) {
    const issues = [];

    // 1. Проверить наличие языка документа
    if (!pdfDoc.catalog?.get(PDFName.of('Lang'))) {
      issues.push({ severity: 'error', rule: 'WCAG 3.1.1',
        message: 'Документ не имеет указания языка' });
    }

    // 2. Проверить наличие заголовка
    if (!pdfDoc.getTitle()) {
      issues.push({ severity: 'error', rule: 'WCAG 2.4.2',
        message: 'Документ не имеет заголовка (Title)' });
    }

    // 3. Проверить tagged PDF (StructTreeRoot)
    if (!pdfDoc.catalog?.get(PDFName.of('MarkInfo'))) {
      issues.push({ severity: 'error', rule: 'PDF/UA',
        message: 'Документ не является tagged PDF — недоступен для screen readers' });
    }

    // 4. Проверить alt-text для изображений
    // 5. Проверить порядок чтения (reading order)
    // 6. Проверить контраст текста
    // 7. Проверить наличие закладок для документов > 20 стр

    // 8. Проверить формы на наличие labels
    try {
      const form = pdfDoc.getForm();
      for (const field of form.getFields()) {
        if (!field.getName()) {
          issues.push({ severity: 'warning', rule: 'WCAG 1.3.1',
            message: `Поле формы без имени/метки` });
        }
      }
    } catch {}

    return {
      passed: issues.filter(i => i.severity === 'pass').length,
      warnings: issues.filter(i => i.severity === 'warning').length,
      errors: issues.filter(i => i.severity === 'error').length,
      issues,
      score: this.calculateScore(issues),
    };
  }
}
```

**UI (модальное окно результатов):**
- Общий score (зелёный/жёлтый/красный)
- Список проблем с severity
- Кнопка "Исправить автоматически" для простых проблем (добавить Title, Lang)

### II-6. PDF/A Validation & Conversion

Проверка соответствия стандарту PDF/A (долгосрочное хранение):

```javascript
class PdfAValidator {
  validate(pdfBytes) {
    const issues = [];

    // PDF/A-1b требования:
    // 1. Все шрифты встроены
    // 2. Нет JavaScript
    // 3. Нет внешних ссылок на контент
    // 4. Нет шифрования
    // 5. Цветовые пространства определены
    // 6. XMP метаданные присутствуют

    return { compliant: issues.length === 0, issues };
  }

  async convertToPdfA(pdfBytes) {
    // Встроить все шрифты
    // Удалить JavaScript
    // Добавить XMP metadata
    // Установить OutputIntent
  }
}
```

### II-7. Распознавание (Enhanced OCR)

Расширение текущего Tesseract OCR:

1. **Автоматическое распознавание при открытии скана** — детекция: если на странице нет text layer, предложить OCR
2. **Batch OCR** — распознать весь документ (все страницы) с progress bar
3. **OCR → searchable PDF** — встроить распознанный текст как невидимый text layer в PDF через pdf-lib
4. **Deskew перед OCR** — автоматическое выравнивание скошенного скана
5. **Язык auto-detect** — определение языка по первым 100 словам

```javascript
// Создание searchable PDF (OCR text layer)
async function createSearchablePdf(pdfBytes, ocrResults) {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  for (const [pageIdx, ocrData] of ocrResults.entries()) {
    const page = pdfDoc.getPage(pageIdx);
    const { width, height } = page.getSize();
    const scaleX = width / ocrData.imageWidth;
    const scaleY = height / ocrData.imageHeight;

    for (const word of ocrData.words) {
      page.drawText(word.text, {
        x: word.x * scaleX,
        y: height - (word.y + word.h) * scaleY,
        size: word.h * scaleY * 0.8,
        font,
        color: rgb(0, 0, 0),
        opacity: 0,  // Невидимый текст — только для поиска и копирования
      });
    }
  }

  return await pdfDoc.save();
}
```

### II-8. Защита PDF (Security)

```javascript
// Модуль: modules/pdf-security.js

class PdfSecurity {
  // Защита паролем (через pdf-lib encryption)
  async encryptPdf(pdfBytes, userPassword, ownerPassword, permissions = {}) {
    // pdf-lib не поддерживает шифрование напрямую
    // Вариант: использовать @cantoo/pdf-lib (форк с шифрованием)
    // Или: LibPDF (@libpdf/core) — поддерживает AES-256
  }

  // Ограничить действия
  setPermissions(pdfDoc, {
    printing: true,       // Разрешить печать
    copying: false,       // Запретить копирование текста
    modifying: false,     // Запретить изменение
    annotating: true,     // Разрешить аннотации
    fillingForms: true,   // Разрешить заполнение форм
  }) {}

  // Удалить пароль (если известен)
  async decryptPdf(pdfBytes, password) {}
}
```

### II-9. Flatten PDF (Выравнивание)

Преобразование интерактивных элементов в статичный контент:

```javascript
async function flattenPdf(pdfBytes, options = {}) {
  const pdfDoc = await PDFDocument.load(pdfBytes);

  if (options.flattenForms) {
    const form = pdfDoc.getForm();
    form.flatten(); // Все поля форм → статичный текст
  }

  if (options.flattenAnnotations) {
    // Все аннотации → часть content stream
    for (const page of pdfDoc.getPages()) {
      // Рендерить annotation appearances в content stream
    }
  }

  if (options.flattenTransparency) {
    // Удалить transparency groups (для совместимости с принтерами)
  }

  return await pdfDoc.save();
}
```

### II-10. Header/Footer (Колонтитулы)

```javascript
async function addHeaderFooter(pdfBytes, options) {
  const {
    headerLeft, headerCenter, headerRight,
    footerLeft, footerCenter, footerRight,
    fontSize = 9,
    startPage = 1,  // Начиная с какой страницы
    skipFirst = false, // Пропустить первую страницу
  } = options;

  const pdfDoc = await PDFDocument.load(pdfBytes);
  const font = await pdfDoc.embedFont(StandardFonts.TimesRoman);

  const pages = pdfDoc.getPages();
  for (let i = 0; i < pages.length; i++) {
    if (skipFirst && i === 0) continue;

    const page = pages[i];
    const { width, height } = page.getSize();
    const pageNum = i + 1;
    const totalPages = pages.length;

    // Замена переменных
    const resolve = (tmpl) => tmpl
      ?.replace('{{page}}', pageNum)
      .replace('{{total}}', totalPages)
      .replace('{{date}}', new Date().toLocaleDateString());

    if (headerCenter) {
      const text = resolve(headerCenter);
      const tw = font.widthOfTextAtSize(text, fontSize);
      page.drawText(text, { x: (width - tw) / 2, y: height - 30, size: fontSize, font });
    }

    if (footerCenter) {
      const text = resolve(footerCenter);
      const tw = font.widthOfTextAtSize(text, fontSize);
      page.drawText(text, { x: (width - tw) / 2, y: 20, size: fontSize, font });
    }

    // ... headerLeft, headerRight, footerLeft, footerRight
  }

  return await pdfDoc.save();
}
```

**UI:** Модальное окно с 6 полями ввода (headerL/C/R + footerL/C/R), превью первой страницы, переменные {{page}}, {{total}}, {{date}}.

### II-11. Page Organization (Организация страниц)

Полноэкранный менеджер страниц (по клику "Организация страниц" в меню):

```
┌─────────────────────────────────────────────────────────────┐
│  Организация страниц                              [✕ Закрыть]│
├─────────────────────────────────────────────────────────────┤
│  [Вставить] [Извлечь] [Заменить] [Разделить] [Повернуть ▾] │
│  [Удалить] [Переместить ▾] [Нумерация Бейтса]             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐    │
│  │     │  │     │  │ ███ │  │     │  │     │  │     │    │
│  │  1  │  │  2  │  │  3  │  │  4  │  │  5  │  │  6  │    │
│  └─────┘  └─────┘  └─────┘  └─────┘  └─────┘  └─────┘    │
│  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐    │
│  │     │  │     │  │     │  │     │  │     │  │     │    │
│  │  7  │  │  8  │  │  9  │  │ 10  │  │ 11  │  │ 12  │    │
│  └─────┘  └─────┘  └─────┘  └─────┘  └─────┘  └─────┘    │
│                                                             │
│  Выбрано: 1 страница | Ctrl+Click для множественного выбора │
└─────────────────────────────────────────────────────────────┘
```

- Drag-and-drop переупорядочивание
- Multi-select (Ctrl+Click, Shift+Click)
- Операции над выбранными: повернуть, удалить, извлечь в новый PDF
- Вставка страниц из другого PDF (drag файл)

---

## Часть III. УЛУЧШЕНИЯ АННОТАЦИЙ

### III-1. Расширенные типы аннотаций

| Инструмент | Описание | Реализация |
|------------|----------|------------|
| **Highlight** | Выделение текста жёлтым/зелёным/розовым | Overlay прямоугольник на text layer coordinates |
| **Underline** | Подчёркивание текста | Линия под словами из text layer |
| **Strikethrough** | Зачёркивание текста | Линия через середину слов |
| **Sticky Note** | Всплывающий комментарий с иконкой на странице | SVG-иконка + popup textarea |
| **Text Box** | Свободный текст на странице | Рисуемый текстовый блок с рамкой |
| **Callout** | Выноска со стрелкой | Текстовый блок + линия-стрелка к точке на странице |
| **Cloud** | Облачная разметка | SVG path вокруг области |
| **Stamp** | Штампы (Approved, Draft, Confidential...) | Растровый/SVG штамп |
| **Measure** | Линейка для измерения расстояний | Линия + подпись длины в mm/px |
| **Link** | Добавление гиперссылок на области страницы | Click-target + URL |

### III-2. Комментарии с Threading (ответы на комментарии)

```javascript
class AnnotationComment {
  constructor(id, pageNum, bounds, text, author, timestamp) {
    this.id = id;
    this.pageNum = pageNum;
    this.bounds = bounds;
    this.text = text;
    this.author = author;
    this.timestamp = timestamp;
    this.replies = [];    // Вложенные ответы
    this.resolved = false;
  }

  addReply(text, author) {
    this.replies.push({
      id: crypto.randomUUID(),
      text, author,
      timestamp: Date.now(),
    });
  }
}
```

### III-3. Экспорт аннотаций в XFDF

XFDF — стандартный формат для обмена аннотациями PDF:

```javascript
function exportAnnotationsToXFDF(annotations, pdfFileName) {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<xfdf xmlns="http://ns.adobe.com/xfdf/" xml:space="preserve">
  <annots>`;

  for (const ann of annotations) {
    if (ann.type === 'highlight') {
      xml += `<highlight page="${ann.page}" rect="${ann.rect}" color="${ann.color}"
               date="${ann.date}" name="${ann.id}">
        <contents-richtext>${ann.comment || ''}</contents-richtext>
      </highlight>`;
    }
    // ... другие типы
  }

  xml += `</annots><f href="${pdfFileName}"/></xfdf>`;
  return xml;
}
```

---

## Часть IV. УЛУЧШЕНИЯ ПРОИЗВОДИТЕЛЬНОСТИ

### IV-1. Web Worker для PDF.js рендеринга

```javascript
// Текущее: рендеринг в main thread блокирует UI
// Новое: Off-screen canvas через worker

// В worker:
self.onmessage = async ({ data }) => {
  const { pdfData, pageNum, scale } = data;
  const pdf = await pdfjsLib.getDocument(pdfData).promise;
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale });

  const offscreen = new OffscreenCanvas(viewport.width, viewport.height);
  const ctx = offscreen.getContext('2d');
  await page.render({ canvasContext: ctx, viewport }).promise;

  const bitmap = offscreen.transferToImageBitmap();
  self.postMessage({ pageNum, bitmap }, [bitmap]);
};
```

### IV-2. Progressive Loading для больших PDF

```javascript
class ProgressivePdfLoader {
  async load(url) {
    // 1. Загрузить первую страницу немедленно (linear PDF)
    // 2. Показать её пока грузится остальное
    // 3. Параллельно загружать остальные страницы
    // 4. Показать progress: "Загружено 12 из 142 страниц"

    const pdf = await pdfjsLib.getDocument({
      url,
      rangeChunkSize: 64 * 1024, // 64KB chunks
      disableAutoFetch: true,     // Загружать только нужные страницы
    }).promise;
  }
}
```

### IV-3. Кэш миниатюр (IndexedDB)

```javascript
// Кэшировать миниатюры страниц в IndexedDB
// Ключ: hash(filename + fileSize + pageNum)
// При повторном открытии — мгновенные превью
class ThumbnailCache {
  async getThumbnail(fileId, pageNum) {
    return await idb.get('thumbnails', `${fileId}_${pageNum}`);
  }
  async setThumbnail(fileId, pageNum, imageData) {
    await idb.put('thumbnails', imageData, `${fileId}_${pageNum}`);
  }
}
```

### IV-4. Rendering Pipeline Optimization

- **Canvas pooling** — переиспользование canvas-элементов вместо создания новых
- **Incremental rendering** — рендерить видимую область первой, остальное — отложенно
- **Memory pressure monitoring** — автоматическая выгрузка страниц при нехватке памяти

---

## Часть V. ДОПОЛНИТЕЛЬНЫЕ УЛУЧШЕНИЯ

### V-1. Quick Actions Bar (Панель быстрых действий)

Плавающая панель при выделении текста (как в Notion/Google Docs):

```
┌──────────────────────────────────────────────┐
│ [Copy] [Highlight] [Underline] [Comment] [OCR] [Translate] │
└──────────────────────────────────────────────┘
```

Появляется автоматически при выделении текста мышью на странице.

### V-2. Tab System (Вкладки документов)

Открытие нескольких документов в одном окне:

```
┌────────┬────────┬────────┬───┐
│ doc1.pdf ✕│ doc2.pdf ✕│ scan.djvu ✕│ + │
└────────┴────────┴────────┴───┘
```

Каждая вкладка — отдельное состояние (page, zoom, bookmarks, annotations).

### V-3. Drag & Drop

- Drop PDF на окно → открыть
- Drop PDF на sidebar thumbnails → вставить страницы
- Drop изображение на страницу → вставить как штамп/подпись
- Drop несколько PDF → предложить merge

### V-4. Горячие клавиши (расширенные)

| Комбинация | Действие |
|------------|----------|
| `Ctrl+F` | Плавающий поиск |
| `Ctrl+G` | Перейти к странице |
| `Ctrl+D` | Свойства документа |
| `Ctrl+Shift+P` | Организация страниц |
| `Ctrl+Shift+R` | Редактирование (redaction mode) |
| `Ctrl+E` | Экспорт |
| `Ctrl+Shift+S` | Сохранить как |
| `H` | Инструмент "рука" (hand tool) |
| `V` | Инструмент "выделение" |
| `T` | Текстовый инструмент |
| `S` | Sticky note |
| `L` | Линия |
| `R` | Прямоугольник |
| `O` | Овал |
| `Ctrl+Shift+A` | Accessibility checker |
| `Space` → drag | Временная рука при удержании Space |

### V-5. Print Dialog (Улучшенная печать)

```javascript
// Модуль: modules/pdf-print.js

class PdfPrinter {
  showPrintDialog() {
    // Модальное окно:
    // - Диапазон страниц (все / текущая / диапазон / чётные / нечётные)
    // - Масштаб: по размеру / фактический / подогнать / буклет
    // - Ориентация: авто / портрет / ландшафт
    // - Страниц на листе: 1 / 2 / 4 / 6 / 9 / 16
    // - Границы страниц: да / нет
    // - Превью печати
  }

  async printAsBooklet(pdfBytes) {
    // Перестановка страниц для печати книжкой (1,n,2,n-1,...)
    // Для двусторонней печати с фальцовкой
  }
}
```

### V-6. Cloud Integration Improvements

- Google Drive / OneDrive / Dropbox — открытие и сохранение
- Share link — генерация ссылки для просмотра
- Real-time collaboration (для аннотаций)

### V-7. AI-powered Features (на базе локальной модели)

- **Smart Summary** — краткое содержание документа
- **Auto-tagging** — автоматическое определение тем и категорий
- **Smart Search** — семантический поиск по содержимому
- **Auto-TOC** — генерация оглавления по структуре документа

### V-8. Многоязычный интерфейс

Расширить i18n за пределы RU/EN:
- Немецкий (DE)
- Французский (FR)
- Испанский (ES)
- Китайский (ZH)
- Японский (JA)
- Арабский (AR) с RTL-поддержкой

---

## Часть VI. НОВЫЕ ФОРМАТЫ

### VI-1. Создание PDF с нуля

```javascript
// Модуль: modules/pdf-create.js

class PdfCreator {
  // Создание PDF из изображений (сканер)
  async createFromImages(images, options = {}) {
    const pdfDoc = await PDFDocument.create();

    for (const img of images) {
      const imageBytes = await img.arrayBuffer();
      let pdfImage;

      if (img.type === 'image/png') pdfImage = await pdfDoc.embedPng(imageBytes);
      else pdfImage = await pdfDoc.embedJpg(imageBytes);

      const page = pdfDoc.addPage([pdfImage.width, pdfImage.height]);
      page.drawImage(pdfImage, {
        x: 0, y: 0,
        width: pdfImage.width,
        height: pdfImage.height,
      });
    }

    return await pdfDoc.save();
  }

  // Создание PDF из HTML
  async createFromHtml(html) {
    // Tauri/Browser: использовать window.print() или pdf-lib
  }

  // Пустой PDF для аннотаций
  createBlank(pageWidth = 595, pageHeight = 842) {
    // A4 default
  }
}
```

### VI-2. Поддержка XPS

Формат Microsoft XPS — XML Paper Specification. Парсинг XML + отрисовка.

### VI-3. CBZ/CBR (Comic Book Archives)

Для чтения комиксов — ZIP/RAR с изображениями. Распаковка → отображение.

---

## Порядок реализации (Roadmap)

### Milestone 1: UI Revolution (2-3 недели)
| # | Задача | Описание |
|---|--------|----------|
| 1 | Layout redesign | 3-column grid: left panel + viewport + right panel |
| 2 | Command bar | Единая компактная верхняя панель |
| 3 | Document viewport | Тёмный фон + белые листы с тенью |
| 4 | Continuous scroll | Виртуализированная прокрутка страниц |
| 5 | Left panel tabs | Миниатюры, закладки, структура, вложения |
| 6 | Right panel | Контекстные инструменты |
| 7 | Floating search | Ctrl+F плавающая панель |
| 8 | View modes | Single / Continuous / Two-Up / Two-Up Continuous |

### Milestone 2: Pro PDF Features (2-3 недели)
| # | Задача | Описание |
|---|--------|----------|
| 9 | Redaction | Пометка и безвозвратное удаление данных |
| 10 | Document compare | Текстовое + визуальное сравнение |
| 11 | PDF optimizer | Уменьшение размера файла |
| 12 | Header/footer | Колонтитулы с переменными |
| 13 | Bates numbering | Юридическая нумерация |
| 14 | Page organizer | Полноэкранный менеджер страниц |
| 15 | Flatten PDF | Выравнивание форм и аннотаций |

### Milestone 3: Enhanced OCR & Security (1-2 недели)
| # | Задача | Описание |
|---|--------|----------|
| 16 | Batch OCR | Распознавание всего документа |
| 17 | Searchable PDF | Встраивание OCR-текста в PDF |
| 18 | Auto-detect scans | Предложение OCR для сканов |
| 19 | PDF encryption | Защита паролем и ограничения |
| 20 | Accessibility checker | Проверка WCAG / PDF/UA |

### Milestone 4: Annotations & UX (1-2 недели)
| # | Задача | Описание |
|---|--------|----------|
| 21 | Extended annotations | Highlight, underline, strikethrough, callout, sticky |
| 22 | Comment threads | Ответы на комментарии, resolve |
| 23 | XFDF export/import | Стандартный обмен аннотациями |
| 24 | Quick actions bar | Плавающая панель при выделении текста |
| 25 | Tab system | Многодокументность |
| 26 | Advanced printing | Буклет, N-up, диапазоны |

### Milestone 5: Extra Features (1-2 недели)
| # | Задача | Описание |
|---|--------|----------|
| 27 | Create PDF from images | Сканер → PDF |
| 28 | PDF/A validation | Проверка стандарта хранения |
| 29 | Extended hotkeys | Professional keyboard shortcuts |
| 30 | Drag & Drop | Файлы, страницы, изображения |
| 31 | Performance tuning | Worker rendering, thumbnail cache |
| 32 | New formats (CBZ/XPS) | Дополнительные форматы документов |

---

## Новые зависимости

```bash
# Уже установлены:
# pdf-lib, @pdf-lib/fontkit, docx, pdfjs-dist, tesseract.js

# Опционально для новых функций:
npm install @cantoo/pdf-lib   # Форк pdf-lib с шифрованием (взамен pdf-lib)
npm install diff              # Для текстового сравнения документов
```

---

## Метрики успеха

| Метрика | Текущее | Цель 3.0 |
|---------|---------|----------|
| Высота viewport при 1080p | ~480px (44%) | ~880px (81%) |
| Режимы просмотра | 1 (single) | 4 (single, continuous, two-up, two-up cont.) |
| Типы аннотаций | 5 | 12+ |
| PDF операции | 6 | 18+ |
| Время merge 10 PDF (100 стр) | ~30с (canvas→JPEG) | ~2с (pdf-lib copy) |
| OCR → searchable PDF | Нет | Да |
| Сравнение документов | Нет | Да |
| Redaction | Нет | Да |
| Accessibility check | Нет | Да |
| Multi-document tabs | Нет | Да |
| Continuous scroll | Нет | Да |
