#!/usr/bin/env python3
from pathlib import Path
import argparse
import sys


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Verify a file is a Windows PE executable")
    parser.add_argument("path", help="path to .exe file")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    exe = Path(args.path)

    if not exe.exists() or not exe.is_file():
        print(f"ERROR: executable not found: {exe}")
        return 1

    data = exe.read_bytes()
    if len(data) < 0x40:
        print(f"ERROR: file too small to be a PE executable: {exe}")
        return 1

    if data[0:2] != b"MZ":
        print(f"ERROR: missing MZ header: {exe}")
        return 1

    pe_offset = int.from_bytes(data[0x3C:0x40], "little")
    if pe_offset + 4 > len(data):
        print(f"ERROR: invalid PE header offset: {exe}")
        return 1

    if data[pe_offset:pe_offset + 4] != b"PE\x00\x00":
        print(f"ERROR: missing PE signature: {exe}")
        return 1

    print(f"OK: valid Windows PE executable: {exe}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
