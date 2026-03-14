param(
  [string]$Generator = "Visual Studio 17 2022",
  [string]$Arch = "x64",
  [string]$Configuration = "Release",
  [string]$InnoCompiler = "C:\Program Files (x86)\Inno Setup 6\ISCC.exe",
  [switch]$RequireInno
)

$ErrorActionPreference = "Stop"

Write-Host "[0/6] Verify metadata"
python scripts/verify_release.py
python scripts/verify_installer_payload.py

Write-Host "[1/6] Configure"
cmake -S . -B build -G $Generator -A $Arch

Write-Host "[2/6] Build"
cmake --build build --config $Configuration

Write-Host "[3/6] Test"
ctest --test-dir build -C $Configuration --output-on-failure
python scripts/verify_windows_exe.py "build\$Configuration\offline_doc_studio.exe"

Write-Host "[4/6] Validate windows prerequisites"
& powershell -ExecutionPolicy Bypass -File scripts/verify_windows_release.ps1 -Configuration $Configuration

Write-Host "[5/6] Create installer"
if (Test-Path $InnoCompiler) {
  & $InnoCompiler installer/OfflineDocStudio.iss
  Write-Host "Installer created in dist/"
} else {
  if ($RequireInno) {
    throw "Inno Setup compiler not found: $InnoCompiler"
  }
  Write-Warning "Inno Setup compiler not found: $InnoCompiler"
  Write-Warning "Install Inno Setup 6 and rerun this script."
}

Write-Host "[6/7] Generate release artifact manifest"
python scripts/generate_release_manifest.py

Write-Host "[7/7] Done"
