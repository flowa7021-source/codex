# OfflineDocStudio

Офлайн-ридер/аннотатор (PDF/DjVu/CBZ/EPUB) для Windows 10–11.

## Текущий статус
Реализовано запускаемое MVP-приложение (CLI + интерактивный shell + сценарии автозапуска + упаковка/инсталлятор):

- форматный реестр `pdf|djvu|djv|cbz|epub`;
- сессии вкладок и режимы чтения;
- page operations: rotate/delete/crop;
- offline OCR index и поиск;
- print planner (`--print-range`, с/без аннотаций);
- command palette (`--command`) и script runner (`--script <file>`);
- navigation history (`--back`, `--forward`);
- библиотека документов: import folder, recent, pinned, search;
- reading settings: `--theme`, `--fit`, `--zoom`;
- hotkeys import/export (`--import-hotkeys`, `--export-hotkeys`);
- интерактивный режим (`--interactive`);
- portable storage + логирование (`logs/app.log`);
- smoke-тесты на ключевые подсистемы;
- CPack ZIP packaging + Inno Setup installer script.
- Windows portable release-бандл + SHA256 checksums script.
- Optional file associations registration helper (explicit user action).
- Windows preflight validator: `scripts/verify_windows_release.ps1`.
- Release artifact manifest generator: `scripts/generate_release_manifest.py`.

Приложение поддерживает `--version` и `--help` для быстрых проверок и onboarding.
Приложение при запуске печатает версию в формате `OfflineDocStudio 1.0.0 (stable)`.

## Быстрый запуск
```bash
cmake -S . -B build
cmake --build build -j
ctest --test-dir build --output-on-failure
./build/offline_doc_studio --interactive --init-layout --import-folder ./samples --list-library --theme dark --fit width --zoom 125
```

## Установить и запустить (Linux)
```bash
./scripts/install_local.sh
./scripts/run_installed.sh
```

## Получить Windows-версию (installer) через CI
```bash
./scripts/fetch_windows_release.sh --repo <owner/repo> --configuration Release --build-installer true
```

Скрипт запускает `workflow_dispatch`, ждёт завершения Windows job и скачивает артефакт
`OfflineDocStudio-windows-release-<Configuration>` в `dist/windows-ci/`.
Поддерживаются два режима: `gh` (GitHub CLI) или fallback через `GITHUB_TOKEN` (GitHub REST API).

## CI
В репозитории добавлен GitHub Actions pipeline (`.github/workflows/ci.yml`) для Linux/Windows сборки, тестов, release-checks, сборки инсталлятора/portable bundle и публикации артефактов (`OfflineDocStudio-windows-release-<Configuration>`).
Также доступен ручной запуск через `workflow_dispatch` с параметрами конфигурации и опцией отключить сборку инсталлятора.

## Сборка инсталлятора
См. `Build.md` и `installer/OfflineDocStudio.iss`.

Собрать полный релиз + инсталлятор одной командой:
```bash
./scripts/release_with_installer.sh
```

Быстрый вариант (авто-выбор доступного способа сборки):
Также доступен другой формат инсталлятора: NSIS (`--format nsis`).
(создаются `dist/OfflineDocStudio-Setup-<version>.exe` и `dist/INSTALLER_METADATA.json`)
```bash
./scripts/build_installer_now.sh
# или принудительный rebuild
./scripts/build_installer_now.sh --force
```

Для Linux-окружения без Windows toolchain доступны fallback-скрипты: `scripts/build_windows_bootstrap_exe.sh` (создаёт `dist/offline_doc_studio_bootstrap.exe`), `scripts/build_windows_stub_installer.sh` (Inno-совместимый self-contained `dist/OfflineDocStudio-Setup-<version>.exe`) и `scripts/build_windows_nsis_installer.sh` (NSIS-совместимый self-contained `dist/OfflineDocStudio-NSIS-Setup-<version>.exe`). Эти fallback `.exe` при запуске на Windows устанавливают payload в `%LOCALAPPDATA%\OfflineDocStudio` (app exe + базовые конфиги/пример); путь можно переопределить параметром запуска `/D=<путь>`.
PE-валидность такого файла можно проверить через `scripts/verify_windows_exe.py`, а целостность installer + manifest — через `scripts/verify_installer_ready.py`.

Инсталлятор может (опционально) зарегистрировать ассоциации файлов только по явному действию пользователя.

## Batch-пример
```bash
./build/offline_doc_studio \
  --open sample.djvu --page 1 --mode continuous --find theorem --overview \
  --rotate 90 --crop-page 1 --print-range 1-3 --print-no-annotations \
  --command "rotate 90" --script ./samples/session.ods \
  --import-hotkeys ./config/hotkeys.json --export-hotkeys ./config/hotkeys.export.json
```

## Важно
Это runnable MVP в терминальном UI. Следующий этап — нативный Win32 GUI (Ribbon + Home/Library window) поверх текущего ядра.
