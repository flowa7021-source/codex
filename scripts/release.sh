#!/usr/bin/env bash
set -euo pipefail

./scripts/verify_release.py
./scripts/verify_installer_payload.py

cmake -S . -B build
cmake --build build -j
ctest --test-dir build --output-on-failure
cpack --config build/CPackConfig.cmake
if [[ "${OSTYPE:-}" == linux* ]] && command -v clang >/dev/null 2>&1 && command -v llvm-dlltool-20 >/dev/null 2>&1 && command -v lld-link >/dev/null 2>&1; then
  ./scripts/build_windows_bootstrap_exe.sh
  ./scripts/build_windows_stub_installer.sh
fi
./scripts/generate_release_manifest.py
if [[ -f "dist/OfflineDocStudio-Setup-$(./scripts/verify_release.py --print-version).exe" ]]; then
  ./scripts/verify_installer_ready.py
  ./scripts/export_installer_metadata.py
fi

echo "Release artifacts generated (ZIP via CPack)."
