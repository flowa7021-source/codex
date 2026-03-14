#!/usr/bin/env bash
set -euo pipefail

cmake -S . -B build
cmake --build build -j
ctest --test-dir build --output-on-failure
cpack --config build/CPackConfig.cmake

echo "Release artifacts generated (ZIP via CPack)."
