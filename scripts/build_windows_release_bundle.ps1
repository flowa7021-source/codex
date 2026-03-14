param(
  [string]$Configuration = "Release"
)

$ErrorActionPreference = "Stop"

python scripts/verify_release.py
python scripts/verify_installer_payload.py
$version = (python scripts/verify_release.py --print-version).Trim()

$root = Resolve-Path .
$outDir = Join-Path $root "dist\OfflineDocStudio-$version-portable"

cmake -S . -B build -G "Visual Studio 17 2022" -A x64
cmake --build build --config $Configuration
ctest --test-dir build -C $Configuration --output-on-failure
python scripts/verify_windows_exe.py "build\$Configuration\offline_doc_studio.exe"

if (Test-Path $outDir) { Remove-Item $outDir -Recurse -Force }
New-Item -ItemType Directory -Path $outDir | Out-Null
New-Item -ItemType Directory -Path (Join-Path $outDir "config") | Out-Null
New-Item -ItemType Directory -Path (Join-Path $outDir "samples") | Out-Null

Copy-Item "build\$Configuration\offline_doc_studio.exe" $outDir
Copy-Item "config\hotkeys.json" (Join-Path $outDir "config\hotkeys.json")
Copy-Item "samples\session.ods" (Join-Path $outDir "samples\session.ods")
Copy-Item "README.md" $outDir
Copy-Item "UserGuide_ru.md" $outDir

$hashFile = Join-Path $outDir "SHA256SUMS.txt"
Get-ChildItem $outDir -File -Recurse | ForEach-Object {
  $h = Get-FileHash $_.FullName -Algorithm SHA256
  "$($h.Hash)  $($_.FullName.Substring($outDir.Length + 1))" | Out-File -FilePath $hashFile -Append -Encoding ascii
}

Write-Host "Portable release bundle prepared: $outDir"

$zipOut = Join-Path $root "dist\OfflineDocStudio-$version-portable.zip"
if (Test-Path $zipOut) { Remove-Item $zipOut -Force }
Compress-Archive -Path (Join-Path $outDir "*") -DestinationPath $zipOut -CompressionLevel Optimal
python scripts/generate_release_manifest.py
Write-Host "Portable ZIP created: $zipOut"
