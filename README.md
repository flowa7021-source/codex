# OfflineDocStudio (Windows-only)

OfflineDocStudio — оффлайн-приложение для работы с документами.

## Поддержка платформ
- Windows 10
- Windows 11

Linux/macOS сценарии сборки и установки исключены из основного продукта.

## Быстрый старт для пользователя
1. Возьмите готовый инсталлятор `OfflineDocStudio-Setup-<version>.exe`.
2. Запустите `.exe` и установите приложение.
3. После установки инсталлятор автоматически запускает приложение.

## Сборка продукта (для разработки, Windows)
```powershell
cmake -S . -B build -G "Visual Studio 17 2022" -A x64
cmake --build build --config Release
ctest --test-dir build -C Release --output-on-failure
```

## Сборка инсталлятора
```powershell
./scripts/build_windows_installer.ps1 -Configuration Release -RequireInno
```

Либо единый entrypoint:
```bash
./scripts/build_installer_now.sh --format inno
```

## Финальный дистрибутив (только инсталлятор)
```bash
./scripts/build_final_installer_only.sh --force
```

После выполнения в `dist/` остаётся только готовый `.exe` инсталлятор.
