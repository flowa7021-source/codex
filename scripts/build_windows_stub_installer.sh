#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

OUT_OVERRIDE=""
WINDOW_TITLE="OfflineDocStudio Setup"
SUCCESS_MESSAGE="OfflineDocStudio has been installed to %LOCALAPPDATA%\\OfflineDocStudio"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --output)
      OUT_OVERRIDE="$2"; shift 2 ;;
    --title)
      WINDOW_TITLE="$2"; shift 2 ;;
    --success-message)
      SUCCESS_MESSAGE="$2"; shift 2 ;;
    -h|--help)
      cat <<'USAGE'
Usage: scripts/build_windows_stub_installer.sh [--output <path>] [--title <caption>] [--success-message <text>]

Build a fallback Windows .exe installer that writes OfflineDocStudio files.
By default installs into %LOCALAPPDATA%\\OfflineDocStudio.
At runtime on Windows you can override target path with /D=<absolute_path>.
USAGE
      exit 0 ;;
    *)
      echo "Unknown option: $1" >&2
      exit 2 ;;
  esac
done

for bin in clang llvm-dlltool-20 lld-link; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "ERROR: missing required tool: $bin" >&2
    exit 1
  fi
done

VERSION="$(python3 scripts/verify_release.py --print-version)"
OUT="${OUT_OVERRIDE:-dist/OfflineDocStudio-Setup-${VERSION}.exe}"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

PAYLOAD_DIR="$TMP_DIR/payload"
if ! mkdir -p "$PAYLOAD_DIR"; then
  echo "ERROR: unable to create payload directory: $PAYLOAD_DIR" >&2
  exit 1
fi

APP_SRC="build/Release/offline_doc_studio.exe"
if [[ ! -f "$APP_SRC" ]]; then
  APP_SRC="dist/offline_doc_studio_bootstrap.exe"
  if [[ ! -f "$APP_SRC" ]]; then
    ./scripts/build_windows_bootstrap_exe.sh "$APP_SRC"
  fi
fi

cp "$APP_SRC" "$PAYLOAD_DIR/offline_doc_studio.exe"
cp config/hotkeys.json "$PAYLOAD_DIR/hotkeys.json"
cp samples/session.ods "$PAYLOAD_DIR/session.ods"
cp README.md "$PAYLOAD_DIR/README.txt"

python3 - <<'PY' "$PAYLOAD_DIR" "$TMP_DIR/payload_arrays.h"
from pathlib import Path
import sys

payload_dir = Path(sys.argv[1])
out = Path(sys.argv[2])

entries = [
    ("offline_doc_studio.exe", "offline_doc_studio_exe"),
    ("hotkeys.json", "hotkeys_json"),
    ("session.ods", "session_ods"),
    ("README.txt", "readme_txt"),
]

with out.open("w", encoding="utf-8") as f:
    f.write("// Auto-generated payload bytes.\n")
    for filename, symbol in entries:
        b = (payload_dir / filename).read_bytes()
        hex_bytes = ",".join(f"0x{v:02x}" for v in b)
        if hex_bytes:
            hex_bytes += ","
        f.write(f"static const unsigned char {symbol}[] = {{{hex_bytes}}};\n")
        f.write(f"static const unsigned int {symbol}_len = {len(b)};\n\n")
PY

cat > "$TMP_DIR/kernel32.def" <<'DEF'
LIBRARY KERNEL32.dll
EXPORTS
    CreateDirectoryA
    CreateFileA
    CloseHandle
    ExitProcess
    GetCommandLineA
    GetEnvironmentVariableA
    GetFileAttributesA
    SetCurrentDirectoryA
    WriteFile
DEF

cat > "$TMP_DIR/user32.def" <<'DEF'
LIBRARY USER32.dll
EXPORTS
    MessageBoxA
DEF

cat > "$TMP_DIR/setup_installer.c" <<'C'
#define INVALID_FILE_ATTRIBUTES ((unsigned int)-1)
#define GENERIC_WRITE 0x40000000
#define CREATE_ALWAYS 2
#define FILE_ATTRIBUTE_NORMAL 0x80
#define MB_OK 0x00000000
#define MB_ICONERROR 0x00000010
#define MAX_PATH 260

__declspec(dllimport) int __stdcall MessageBoxA(void* hWnd, const char* lpText, const char* lpCaption, unsigned int uType);
__declspec(dllimport) char* __stdcall GetCommandLineA(void);
__declspec(dllimport) unsigned int __stdcall GetEnvironmentVariableA(const char* lpName, char* lpBuffer, unsigned int nSize);
__declspec(dllimport) int __stdcall CreateDirectoryA(const char* lpPathName, void* lpSecurityAttributes);
__declspec(dllimport) unsigned int __stdcall GetFileAttributesA(const char* lpFileName);
__declspec(dllimport) void* __stdcall CreateFileA(const char* lpFileName, unsigned int dwDesiredAccess, unsigned int dwShareMode, void* lpSecurityAttributes, unsigned int dwCreationDisposition, unsigned int dwFlagsAndAttributes, void* hTemplateFile);
__declspec(dllimport) int __stdcall WriteFile(void* hFile, const void* lpBuffer, unsigned int nNumberOfBytesToWrite, unsigned int* lpNumberOfBytesWritten, void* lpOverlapped);
__declspec(dllimport) int __stdcall CloseHandle(void* hObject);
__declspec(dllimport) void __stdcall ExitProcess(unsigned int uExitCode);

#include "payload_arrays.h"

void* memcpy(void* dst, const void* src, unsigned long long n) {
  unsigned char* d = (unsigned char*)dst;
  const unsigned char* s = (const unsigned char*)src;
  unsigned long long i;
  for (i = 0; i < n; ++i) {
    d[i] = s[i];
  }
  return dst;
}

struct PayloadFile {
  const char* name;
  const unsigned char* data;
  unsigned int size;
};

static unsigned int str_len(const char* s) {
  unsigned int n = 0;
  while (s[n] != 0) { n++; }
  return n;
}

static void copy_str(char* dst, const char* src) {
  while (*src) { *dst++ = *src++; }
  *dst = 0;
}

static void append_str(char* dst, const char* src) {
  while (*dst) { dst++; }
  copy_str(dst, src);
}

static int ensure_directory(const char* path) {
  unsigned int attrs = GetFileAttributesA(path);
  if (attrs != INVALID_FILE_ATTRIBUTES) {
    return 1;
  }
  return CreateDirectoryA(path, 0) != 0;
}

static int write_payload_file(const char* base_dir, const struct PayloadFile* file) {
  char path[MAX_PATH * 2];
  copy_str(path, base_dir);
  append_str(path, "\\");
  append_str(path, file->name);

  void* handle = CreateFileA(path, GENERIC_WRITE, 0, 0, CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, 0);
  if (handle == (void*)(long long)-1) {
    return 0;
  }
  unsigned int written = 0;
  int ok = WriteFile(handle, file->data, file->size, &written, 0);
  CloseHandle(handle);
  return ok != 0 && written == file->size;
}

static int extract_install_dir_arg(const char* cmd, char* out, unsigned int out_size) {
  const char* p = cmd;
  while (*p) {
    while (*p == ' ' || *p == '\t') {
      ++p;
    }

    if ((*p == '/' || *p == '-') && (p[1] == 'D' || p[1] == 'd') && p[2] == '=') {
      p += 3;
      unsigned int i = 0;
      int quoted = 0;
      if (*p == '"') {
        quoted = 1;
        ++p;
      }
      while (*p && ((quoted && *p != '"') || (!quoted && *p != ' ' && *p != '\t'))) {
        if (i + 1 >= out_size) {
          return 0;
        }
        out[i++] = *p++;
      }
      out[i] = 0;
      return i > 0;
    }

    while (*p && *p != ' ' && *p != '\t') {
      if (*p == '"') {
        ++p;
        while (*p && *p != '"') {
          ++p;
        }
        if (*p == '"') {
          ++p;
        }
      } else {
        ++p;
      }
    }
  }
  return 0;
}

void mainCRTStartup(void) {
  const char* caption = "__WINDOW_TITLE__";
  char install_dir[MAX_PATH * 2];
  if (!extract_install_dir_arg(GetCommandLineA(), install_dir, sizeof(install_dir))) {
    char local_app_data[MAX_PATH * 2];
    unsigned int len = GetEnvironmentVariableA("LOCALAPPDATA", local_app_data, sizeof(local_app_data));
    if (len == 0 || len >= sizeof(local_app_data) - 32) {
      MessageBoxA(0, "Cannot resolve LOCALAPPDATA", caption, MB_OK | MB_ICONERROR);
      ExitProcess(1);
    }
    copy_str(install_dir, local_app_data);
    append_str(install_dir, "\\OfflineDocStudio");
  }

  if (!ensure_directory(install_dir)) {
    MessageBoxA(0, "Cannot create install directory", caption, MB_OK | MB_ICONERROR);
    ExitProcess(1);
  }

  struct PayloadFile files[] = {
      {"offline_doc_studio.exe", offline_doc_studio_exe, offline_doc_studio_exe_len},
      {"hotkeys.json", hotkeys_json, hotkeys_json_len},
      {"session.ods", session_ods, session_ods_len},
      {"README.txt", readme_txt, readme_txt_len},
  };

  unsigned int i;
  for (i = 0; i < (sizeof(files) / sizeof(files[0])); ++i) {
    if (!write_payload_file(install_dir, &files[i])) {
      MessageBoxA(0, "Cannot write one of payload files", caption, MB_OK | MB_ICONERROR);
      ExitProcess(1);
    }
  }

  MessageBoxA(0, "__SUCCESS_MESSAGE__", caption, MB_OK);
  ExitProcess(0);
}
C

escape_c() {
  python3 - <<'PY' "$1"
import sys
s=sys.argv[1]
print(s.replace('\\','\\\\').replace('"','\\"'))
PY
}

TITLE_ESCAPED="$(escape_c "$WINDOW_TITLE")"
SUCCESS_ESCAPED="$(escape_c "$SUCCESS_MESSAGE")"
python3 - <<'PY' "$TMP_DIR/setup_installer.c" "$TITLE_ESCAPED" "$SUCCESS_ESCAPED"
from pathlib import Path
import sys
p = Path(sys.argv[1])
text = p.read_text(encoding='utf-8')
text = text.replace('__WINDOW_TITLE__', sys.argv[2]).replace('__SUCCESS_MESSAGE__', sys.argv[3])
p.write_text(text, encoding='utf-8')
PY

llvm-dlltool-20 -d "$TMP_DIR/kernel32.def" -m i386:x86-64 -l "$TMP_DIR/kernel32.lib"
llvm-dlltool-20 -d "$TMP_DIR/user32.def" -m i386:x86-64 -l "$TMP_DIR/user32.lib"

mkdir -p "$(dirname "$OUT")"
clang -target x86_64-pc-windows-msvc -fuse-ld=lld-link "$TMP_DIR/setup_installer.c" \
  -I"$TMP_DIR" -nostdlib -Wl,/entry:mainCRTStartup -Wl,/subsystem:windows -Wl,/nodefaultlib \
  "$TMP_DIR/kernel32.lib" "$TMP_DIR/user32.lib" -o "$OUT"

python3 scripts/verify_windows_exe.py "$OUT"
echo "OK: generated Windows fallback installer executable: $OUT"
