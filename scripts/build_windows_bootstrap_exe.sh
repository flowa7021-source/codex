#!/usr/bin/env bash
set -euo pipefail

OUT="${1:-dist/offline_doc_studio_bootstrap.exe}"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

for bin in clang llvm-dlltool-20 lld-link; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "ERROR: missing required tool: $bin" >&2
    exit 1
  fi
done

cat > "$TMP_DIR/kernel32.def" <<'DEF'
LIBRARY KERNEL32.dll
EXPORTS
    ExitProcess
DEF

cat > "$TMP_DIR/bootstrap.c" <<'C'
__declspec(dllimport) void __stdcall ExitProcess(unsigned int);
void mainCRTStartup(void) {
  ExitProcess(0);
}
C

llvm-dlltool-20 -d "$TMP_DIR/kernel32.def" -m i386:x86-64 -l "$TMP_DIR/kernel32.lib"
mkdir -p "$(dirname "$OUT")"
clang -target x86_64-pc-windows-msvc -fuse-ld=lld-link "$TMP_DIR/bootstrap.c" \
  -nostdlib -Wl,/entry:mainCRTStartup -Wl,/subsystem:console -Wl,/nodefaultlib \
  "$TMP_DIR/kernel32.lib" -o "$OUT"

echo "OK: generated Windows bootstrap executable: $OUT"
./scripts/verify_windows_exe.py "$OUT"
