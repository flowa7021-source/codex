#!/usr/bin/env bash
set -euo pipefail

./scripts/verify_release.py
./scripts/verify_installer_payload.py

cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build -j
ctest --test-dir build --output-on-failure

# Windows-only product release: produce installer executable.
./scripts/build_installer_now.sh --force

echo "Release artifacts generated (Windows installer)."
