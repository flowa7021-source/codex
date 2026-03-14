# UserGuide_ru.md

## Назначение
OfflineDocStudio — офлайн-ридер/аннотатор документов для Windows 10–11 с portable-хранилищем.

## Установка
- Windows: используйте готовый инсталлятор из папки `dist/` (собирается скриптом `scripts/build_windows_installer.ps1`).
- Portable: можно запускать бинарник напрямую из папки сборки/распаковки.

## Ассоциации файлов
- Ассоциации `.pdf/.djvu/.djv/.cbz/.epub` регистрируются только по явному действию пользователя.
- Инсталлятор предлагает опциональную задачу регистрации ассоциаций (текущий пользователь, HKCU).
- Вручную: `scripts/register_file_associations.ps1 -AppPath <path-to-exe>`

## Режимы запуска
- **Batch**: передайте флаги CLI.
- **Interactive**: запустите с `--interactive`.
- **Script**: передайте `--script <файл>` со списком команд (по одной на строку).
- **Справка/версия**: `--help` и `--version`.

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

## Диагностика
- Инициализация структуры данных (`config/cache/logs`): `--init-layout`
- Отчёт о состоянии среды: `--doctor`

## Интерактивные команды
`open`, `find`, `mode`, `fit`, `zoom`, `overview`, `rotate`, `crop`, `delete`, `ocr`, `screenshot`, `print`, `library`, `pin`, `unpin`, `searchlib`, `back`, `forward`, `hotkeys`, `help`, `quit`.

## Принцип offline-first
Приложение не выполняет сетевых запросов: без телеметрии, AI/API, CDN и автообновлений.
