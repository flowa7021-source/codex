# Build.md

## Linux/macOS (разработка и запуск MVP)

```bash
cmake -S . -B build
cmake --build build -j
ctest --test-dir build --output-on-failure
./build/offline_doc_studio --interactive --init-layout --doctor --import-folder ./samples --list-library
./build/offline_doc_studio --help
./build/offline_doc_studio --version
```

## Windows 10/11 (Visual Studio 2022)

```powershell
cmake -S . -B build -G "Visual Studio 17 2022" -A x64
cmake --build build --config Release
ctest --test-dir build -C Release --output-on-failure
./build/Release/offline_doc_studio.exe --interactive --import-folder .\samples --list-library
```


## Быстрый релизный прогон

```bash
./scripts/release.sh
```

Внутри релизного скрипта автоматически вызываются `scripts/verify_release.py` (проверка консистентности версии), `scripts/verify_installer_payload.py` (проверка payload инсталлятора) и `scripts/generate_release_manifest.py` (манифест артефактов с SHA256 в `dist/RELEASE_ARTIFACTS.txt`).

## Сборка ZIP-пакета через CPack

```bash
cmake -S . -B build
cmake --build build -j
cpack --config build/CPackConfig.cmake
```

Готовый архив появится в корне проекта (например, `OfflineDocStudio-<version>-Linux.zip`).

## Сборка Windows-инсталлятора (Inno Setup)
Быстрый универсальный запуск:

```bash
./scripts/build_installer_now.sh
```

Скрипт пытается сначала использовать `build_windows_installer.ps1` (Inno Setup), а если это невозможно в текущем окружении — автоматически собирает fallback installer `.exe` через `build_windows_stub_installer.sh`. Fallback-инсталлятор является self-contained PE-файлом и при запуске на Windows устанавливает payload в `%LOCALAPPDATA%\OfflineDocStudio`.

Полезные опции:
```bash
./scripts/build_installer_now.sh --force
./scripts/build_installer_now.sh --require-native
```

Ручной путь через Inno Setup:
1. Установите **Inno Setup 6**.
2. Выполните:

```powershell
./scripts/build_windows_installer.ps1
```

Скрипт дополнительно выполняет проверки: `verify_release.py`, `verify_installer_payload.py`, `verify_windows_release.ps1`, `verify_windows_exe.py`, затем создаёт `.exe` инсталлятор в `dist/`.

Для CI/строгого режима можно требовать наличие Inno Setup (ошибка вместо warning):

```powershell
./scripts/build_windows_installer.ps1 -Configuration Release -RequireInno
```

## Пример запуска (batch/script)

```bash
./build/offline_doc_studio \
  --open sample.djvu --mode overview --find theorem \
  --rotate 90 --delete-page 2 --crop-page 1 --print-range 1-3 --print-no-annotations \
  --command "pages overview" --script ./samples/session.ods \
  --import-hotkeys ./config/hotkeys.json --export-hotkeys ./config/hotkeys.export.json
```

## Offline policy
- Никаких сетевых запросов.
- Никаких проверок обновлений.
- Все данные и настройки — в portable-структуре рядом с приложением.


## Подготовка portable release-бандла (Windows)
```powershell
./scripts/build_windows_release_bundle.ps1
```

Скрипт автоматически берёт текущую релизную версию из `scripts/verify_release.py --print-version`, выполняет `verify_windows_exe.py` для собранного `offline_doc_studio.exe`, и создаёт `dist/OfflineDocStudio-<version>-portable`, файл `SHA256SUMS.txt`, `dist/OfflineDocStudio-<version>-portable.zip` и обновляет `dist/RELEASE_ARTIFACTS.txt`.


## Готовый инсталлятор из CI
В GitHub Actions (job `windows-build-test`) добавлена публикация артефактов через `actions/upload-artifact`.
После успешного прогона можно скачать `OfflineDocStudio-windows-release-<Configuration>`, где будут `dist/OfflineDocStudio-Setup-<version>.exe` и portable-артефакты.


## Запуск Windows-сборки из GitHub Actions (ручной)
1. Откройте `Actions` → workflow `ci` → `Run workflow`.
2. Укажите:
   - `windows_configuration`: `Release` или `RelWithDebInfo`;
   - `build_windows_installer`: `true/false` (для теста portable-only можно `false`).
3. Скачайте артефакт `OfflineDocStudio-windows-release-<Configuration>`.


## Linux fallback: сгенерировать проверочный `.exe`
Если нужен именно `.exe` в текущем Linux-окружении без полного MinGW/MSVC toolchain,
можно сгенерировать минимальный bootstrap PE-файл:

```bash
./scripts/build_windows_bootstrap_exe.sh
```

Будет создан `dist/offline_doc_studio_bootstrap.exe` (технический smoke-артефакт для проверки PE/CI цепочки).
Проверка формата файла:

```bash
./scripts/verify_windows_exe.py dist/offline_doc_studio_bootstrap.exe
```
Полноценный `offline_doc_studio.exe` для Windows формируется в Windows CI (`OfflineDocStudio-windows-release-<Configuration>`).


## Установка и запуск (Linux, локальный prefix)
```bash
./scripts/install_local.sh
./scripts/run_installed.sh
```

По умолчанию установка выполняется в `~/.local/offline_doc_studio`.
Можно указать свой путь: `./scripts/install_local.sh --prefix /opt/offline_doc_studio`.


## Получение Windows installer из GitHub Actions
```bash
./scripts/fetch_windows_release.sh --repo <owner/repo> --configuration Release --build-installer true
```

Предпочтительно: установленный `gh` и авторизация (`gh auth login`).
Fallback: без `gh`, но с `GITHUB_TOKEN` (используется `scripts/fetch_windows_release.py`).
Скрипт скачивает артефакт в `dist/windows-ci/OfflineDocStudio-windows-release-<Configuration>/`.
Installer: `dist/windows-ci/.../dist/OfflineDocStudio-Setup-<version>.exe`.


## Linux fallback: сгенерировать Windows installer `.exe`
```bash
./scripts/build_windows_stub_installer.sh
```

Создаёт `dist/OfflineDocStudio-Setup-<version>.exe` (fallback self-contained installer, который копирует payload в `%LOCALAPPDATA%\OfflineDocStudio`; путь установки можно переопределить при запуске инсталлятора через `/D=<путь>`).
Для production payload используйте артефакт Windows CI `OfflineDocStudio-windows-release-<Configuration>`.


## Проверка готовности installer артефакта
```bash
./scripts/verify_installer_ready.py
```


## Полный релиз с инсталлятором (one-shot)
```bash
./scripts/release_with_installer.sh
```

Скрипт выполняет `release.sh`, затем форсированно пересобирает installer и проверяет `verify_installer_ready.py`.


## Installer metadata
После сборки инсталлятора формируется `dist/INSTALLER_METADATA.json` (версия, путь, SHA256, размер).


## Альтернативный формат installer: NSIS
```bash
./scripts/build_installer_now.sh --force --format nsis
# или напрямую
./scripts/build_windows_nsis_installer.sh
```
