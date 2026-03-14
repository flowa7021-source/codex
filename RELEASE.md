# Release (Windows-only)

## Цель релиза
Поставить пользователю единый установщик `.exe` для Windows 10/11.

## Команды релиза
```bash
./scripts/release_with_installer.sh
./scripts/build_final_installer_only.sh --force
```

## Проверки
```bash
./scripts/verify_release.py
./scripts/verify_installer_payload.py
./scripts/verify_installer_ready.py
```

## Результат
Финальный артефакт:
- `dist/OfflineDocStudio-Setup-<version>.exe`

В конечном дистрибутиве остаётся только этот файл.
