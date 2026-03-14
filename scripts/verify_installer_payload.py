#!/usr/bin/env python3
from pathlib import Path
import re
import sys

root = Path(__file__).resolve().parent.parent
iss = root / "installer" / "OfflineDocStudio.iss"
if not iss.exists():
    print("ERROR: installer script missing")
    sys.exit(1)

text = iss.read_text(encoding="utf-8")

required_sources = [
    r"\.\.?\\build\\Release\\offline_doc_studio\.exe",
    r"\.\.?\\config\\hotkeys\.json",
    r"\.\.?\\samples\\session\.ods",
    r"\.\.?\\UserGuide_ru\.md",
    r"\.\.?\\scripts\\register_file_associations\.ps1",
]

for pat in required_sources:
    if not re.search(pat, text, re.IGNORECASE):
        print(f"ERROR: missing installer payload source pattern: {pat}")
        sys.exit(1)

if "registerassoc" not in text:
    print("ERROR: optional association task not found")
    sys.exit(1)

print("OK: installer payload and tasks look valid")
