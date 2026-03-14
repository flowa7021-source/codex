param(
  [Parameter(Mandatory=$true)]
  [string]$AppPath,
  [switch]$Unregister
)

$ErrorActionPreference = "Stop"
$exts = @(".pdf", ".djvu", ".djv", ".cbz", ".epub")
$progId = "OfflineDocStudio.Document"

if (-not (Test-Path $AppPath) -and -not $Unregister) {
  throw "AppPath not found: $AppPath"
}

function Set-Or-Remove([string]$Path, [string]$Name, [string]$Value) {
  if ($Unregister) {
    if (Test-Path $Path) { Remove-Item $Path -Recurse -Force }
  } else {
    New-Item -Path $Path -Force | Out-Null
    if ($Name -eq "") {
      New-ItemProperty -Path $Path -Name "(default)" -Value $Value -PropertyType String -Force | Out-Null
      Set-ItemProperty -Path $Path -Name "(default)" -Value $Value
    } else {
      New-ItemProperty -Path $Path -Name $Name -Value $Value -PropertyType String -Force | Out-Null
    }
  }
}

if ($Unregister) {
  foreach ($ext in $exts) {
    $k = "HKCU:\Software\Classes\$ext"
    if (Test-Path $k) { Remove-Item $k -Recurse -Force }
  }
  $pk = "HKCU:\Software\Classes\$progId"
  if (Test-Path $pk) { Remove-Item $pk -Recurse -Force }
  Write-Host "File associations removed for OfflineDocStudio (HKCU)."
  exit 0
}

$progKey = "HKCU:\Software\Classes\$progId"
New-Item -Path $progKey -Force | Out-Null
Set-ItemProperty -Path $progKey -Name "(default)" -Value "OfflineDocStudio Document"

$iconKey = "$progKey\DefaultIcon"
New-Item -Path $iconKey -Force | Out-Null
Set-ItemProperty -Path $iconKey -Name "(default)" -Value "`"$AppPath`",0"

$cmdKey = "$progKey\shell\open\command"
New-Item -Path $cmdKey -Force | Out-Null
Set-ItemProperty -Path $cmdKey -Name "(default)" -Value "`"$AppPath`" `"%1`""

foreach ($ext in $exts) {
  $extKey = "HKCU:\Software\Classes\$ext"
  New-Item -Path $extKey -Force | Out-Null
  Set-ItemProperty -Path $extKey -Name "(default)" -Value $progId
}

Write-Host "File associations registered for: $($exts -join ', ')"
Write-Host "Scope: current user only (HKCU), by explicit action."
