param(
  [string]$Generator = "Visual Studio 17 2022",
  [string]$Arch = "x64",
  [string]$Configuration = "Release",
  [string]$InnoCompiler = "C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
)

$ErrorActionPreference = "Stop"

Write-Host "[1/4] Configure"
cmake -S . -B build -G $Generator -A $Arch

Write-Host "[2/4] Build"
cmake --build build --config $Configuration

Write-Host "[3/4] Test"
ctest --test-dir build -C $Configuration --output-on-failure

Write-Host "[4/4] Create installer"
if (Test-Path $InnoCompiler) {
  & $InnoCompiler installer/OfflineDocStudio.iss
  Write-Host "Installer created in dist/"
} else {
  Write-Warning "Inno Setup compiler not found: $InnoCompiler"
  Write-Warning "Install Inno Setup 6 and rerun this script."
}
