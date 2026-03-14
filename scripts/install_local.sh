#!/usr/bin/env bash
set -euo pipefail

PREFIX="${HOME}/.local/offline_doc_studio"
BUILD_DIR="build-install"
CONFIG="Release"
GENERATOR=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --prefix)
      PREFIX="$2"; shift 2 ;;
    --build-dir)
      BUILD_DIR="$2"; shift 2 ;;
    --config)
      CONFIG="$2"; shift 2 ;;
    --generator)
      GENERATOR="$2"; shift 2 ;;
    *)
      echo "Unknown option: $1" >&2
      echo "Usage: $0 [--prefix <path>] [--build-dir <dir>] [--config <Release|Debug>] [--generator <cmake-generator>]" >&2
      exit 2 ;;
  esac
done

cmake_args=( -S . -B "$BUILD_DIR" -DCMAKE_BUILD_TYPE="$CONFIG" )
if [[ -n "$GENERATOR" ]]; then
  cmake_args+=( -G "$GENERATOR" )
fi

cmake "${cmake_args[@]}"
cmake --build "$BUILD_DIR" -j
ctest --test-dir "$BUILD_DIR" --output-on-failure
cmake --install "$BUILD_DIR" --prefix "$PREFIX"

BIN_PATH="$PREFIX/bin/offline_doc_studio"
if [[ ! -x "$BIN_PATH" ]]; then
  echo "ERROR: installed binary not found: $BIN_PATH" >&2
  exit 1
fi

"$BIN_PATH" --version

echo "OK: OfflineDocStudio installed to $PREFIX"
echo "Run: $BIN_PATH --interactive --init-layout --doctor"
