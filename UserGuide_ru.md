# UserGuide_ru.md

## Назначение
OfflineDocStudio — офлайн-ридер/аннотатор документов для Windows 10–11 с portable-хранилищем.

## Режимы запуска
- **Batch**: передайте флаги CLI.
- **Interactive**: запустите с `--interactive`.
- **Script**: передайте `--script <файл>` со списком команд (по одной на строку).

## Библиотека
- Импорт папки: `--import-folder <path>`
- Просмотр: `--list-library`
- Закрепление: `--pin <path>` / `--unpin <path>`

## Настройки чтения
- Тема: `--theme light|dark`
- Fit: `--fit page|width|height|minside|actual`
- Масштаб: `--zoom <процент>`

## Hotkeys
- Импорт: `--import-hotkeys <json>`
- Экспорт: `--export-hotkeys <json>`

## Интерактивные команды
`open`, `find`, `mode`, `fit`, `zoom`, `overview`, `rotate`, `crop`, `delete`, `ocr`, `screenshot`, `print`, `library`, `pin`, `unpin`, `searchlib`, `back`, `forward`, `hotkeys`, `help`, `quit`.

## Принцип offline-first
Приложение не выполняет сетевых запросов: без телеметрии, AI/API, CDN и автообновлений.
