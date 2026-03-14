#!/usr/bin/env bash
set -euo pipefail

PREFIX="${1:-${HOME}/.local/offline_doc_studio}"
shift $(( $# > 0 ? 1 : 0 ))
BIN_PATH="$PREFIX/bin/offline_doc_studio"

if [[ ! -x "$BIN_PATH" ]]; then
  echo "ERROR: installed binary not found: $BIN_PATH" >&2
  echo "Install first: ./scripts/install_local.sh --prefix $PREFIX" >&2
  exit 1
fi

exec "$BIN_PATH" --interactive --init-layout --doctor "$@"
