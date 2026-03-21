# Техническая архитектура

## 1) Архитектурный подход

Используется client-side SPA без сборки для быстрого старта.

Слои:
1. **Presentation** — UI-компоненты и события (`app/index.html`, `app/styles.css`).
2. **Application** — оркестрация состояния и пользовательских сценариев (`app/app.js`).
3. **Document Adapters** — адаптеры форматов:
   - `PDFAdapter`
   - `ImageAdapter`
   - `DjVuAdapter`
   - `UnsupportedAdapter`
4. **Persistence** — localStorage (библиотека, заметки, тема).

## 2) Ключевые модули

- `state`:
  - текущий документ;
  - текущая страница/масштаб/поворот;
  - список результатов поиска.
- `renderCurrentPage()`:
  - единая точка рендера для всех адаптеров.
- `searchInPdf()` и `jumpToSearchResult()`:
  - извлечение текста по страницам через PDF.js, построение списка совпадений и навигация по результатам.
- `bookmarks`, `notes`, `recent files`:
  - персистентные инструменты продуктивности на localStorage, включая управляемый список recent (remove/clear).
- `exportBookmarksJson()/importBookmarksJson()/renderBookmarks()`:
  - перенос закладок между сессиями/устройствами через валидируемый JSON-формат + фильтрация списка в UI.
- `loadHotkeys()/saveHotkeys()/validateHotkeys()`:
  - пользовательская настройка горячих клавиш, проверка конфликтов, inline-подсказки по полям, захват сочетаний клавиш, авто-исправление и сохранение профиля шорткатов.
- `drawStroke()/beginStroke()/moveStroke()`:
  - рендер и интерактивное построение штрихов/фигур аннотаций (включая прямоугольник, стрелку, линию и окружность).
- `queueNotesAutosave()/saveNotes()/importNotesJson()`:
  - автосохранение заметок при вводе + ручное сохранение и импорт/merge с индикатором статуса сохранения.
- `exportNotesMarkdown()/exportNotesJson()`:
  - перенос заметок между экземплярами приложения и форматами, включая метаданные заметки (title/tags).
- `fitWidth()/fitPage()`:
  - утилитарные режимы масштабирования под задачу чтения.
- `saveViewState()/restoreViewStateIfPresent()/resetReadingProgress()`:
  - автосохранение и восстановление прогресса чтения документа (page/zoom/rotation) с ручным сбросом.
- `capturePageHistoryOnRender()/navigateHistoryBack()/navigateHistoryForward()`:
  - стек истории переходов по страницам с back/forward UI и хоткеями Alt+стрелки.
- `trackVisitedPage()/renderVisitTrail()`:
  - компактный список последних посещённых страниц для быстрого повторного перехода.
- `renderSearchResultsList()/clearSearchResults()/importSearchResultsJson()/importSearchResultsCsv()/exportSearchResultsJson()/exportSearchResultsCsv()/exportSearchResultsSummaryTxt()/copySearchResultsSummary()`:
  - интерактивный список совпадений поиска по страницам с быстрыми переходами, счётчиком, очисткой, импортом JSON/CSV и экспортом JSON/CSV/TXT summary.
- `renderSearchHistory()/clearSearchHistory()/buildSearchHistoryText()/exportSearchHistoryJson()/exportSearchHistoryTxt()/copySearchHistory()/importSearchHistoryJson()`:
  - список последних запросов с быстрым повторным поиском, очисткой, копированием, экспортом JSON/TXT и переносом истории между сессиями через JSON.
- `loadSearchScope()/saveSearchScope()`:
  - персистентная настройка области поиска (весь документ / текущая страница).
- `renderPagePreviews()/updatePreviewSelection()`:
  - миниатюры страниц (первые страницы документа) для быстрого jump-to-page из сайдбара.
- `pushWorkspaceToCloud()/pullWorkspaceFromCloud()` и `toggleCollaborationChannel()/broadcastWorkspaceSnapshot()` используются в release UI (Stage 4).
- `renderDocStats()`:
  - агрегирует рабочие метрики документа (annotations/comments/bookmarks/pace) для утилитарной панели статистики.
- `startReadingTimer()/stopReadingTimer()/resetReadingTime()`:
  - пер-документный трекинг времени чтения с паузой при скрытии вкладки и сохранением в localStorage.
- `renderEtaStatus()`:
  - расчёт ориентировочного времени завершения документа на основе накопленного времени и текущей страницы.
- `saveReadingGoal()/renderReadingGoalStatus()`:
  - локальная цель чтения по странице с прогрессом и ETA до достижения цели.
- `renderOutline()`:
  - построение интерактивного оглавления PDF с резолвом destination → page.
- `refreshPageText()`:
  - извлечение текста текущей страницы для copy/export сценариев.
- `exportAnnotationsJson()/importAnnotationsJson()`:
  - переносимая сериализация аннотаций текущей страницы для бэкапа и обмена.
- `exportAnnotationBundleJson()/importAnnotationBundleJson()`:
  - пакетный обмен аннотациями всего документа.
- `exportWorkspaceBundleJson()/importWorkspaceBundleJson()`:
  - перенос полного рабочего состояния документа одним backup JSON (notes, bookmarks, hotkeys, theme, annotations/comments).
- `commentKey()/renderCommentList()`:
  - пины комментариев на странице с локальной персистентностью и навигацией по содержимому.
- `drawStroke()`:
  - рендер не только свободных штрихов, но и фигурных аннотаций (`rect`/`arrow`).

## 3) Расширяемость

Для добавления нового формата нужен адаптер с интерфейсом:
- `getPageCount()`
- `renderPage(page, canvas, viewport, options)`
- `getText(page)`

Это позволяет добавлять новые форматы без переписывания UI; DjVuAdapter уже подключён, ePub остаётся следующим кандидатом.

## 4) Производительность

- Ленивая перерисовка только текущей страницы.
- Ограничение масштаба и асинхронная загрузка страниц.
- Минимальные зависимости (PDF.js из CDN).

## 5) Безопасность

- Работа только с локально выбранными пользователем файлами.
- Нет отправки контента на сервер.


## 6) Runtime server (release/dev)
- `dev_server.py`:
  - статическая раздача приложения;
  - redirect `/` → `/app/` для быстрого старта;
  - встроенный endpoint `GET/PUT /api/workspace` для Stage-4 cloud sync без внешнего backend;
  - endpoint `GET /api/health` для проверок запуска/мониторинга.

- Desktop runtime (без сервера):
  - `src-tauri/src/lib.rs` — Rust backend (Tauri 2), загружает `app/index.html` через WebView2;
  - сборка Windows `.exe`/`.msi` выполняется через `tauri build` (NSIS + MSI installer).
