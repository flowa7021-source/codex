#Requires -Version 5.1
<#
.SYNOPSIS
    Регистрирует NovaReader в контекстном меню Windows Explorer для .pdf файлов.

.DESCRIPTION
    Добавляет подменю «NovaReader» при правом клике на .pdf файле. Пункты меню:
      • Конвертировать в Word (.docx)
      • Конвертировать в Excel (.xlsx)
      • Конвертировать в DjVu
      • ──────────────────────
      • Создать PDF с текстовым слоем (OCR)
      • Настройки...

    Используется ключ HKCR\SystemFileAssociations\.pdf\shell\, который работает
    независимо от того, какой PDF-ридер установлен по умолчанию.

.PARAMETER ExePath
    Полный путь к NovaReader.exe. По умолчанию ищется рядом со скриптом.

.PARAMETER ForCurrentUserOnly
    Если указан — регистрация в HKCU (не нужны права администратора).
    По умолчанию регистрация в HKCR (требует прав администратора).

.PARAMETER Uninstall
    Если указан — удаляет записи меню из реестра.

.EXAMPLE
    # Установка от имени администратора (для всех пользователей):
    .\install-context-menu.ps1

.EXAMPLE
    # Установка без прав администратора (только для текущего пользователя):
    .\install-context-menu.ps1 -ForCurrentUserOnly

.EXAMPLE
    # Удаление:
    .\install-context-menu.ps1 -Uninstall
    .\install-context-menu.ps1 -Uninstall -ForCurrentUserOnly
#>

param(
    [string] $ExePath          = "",
    [switch] $ForCurrentUserOnly,
    [switch] $Uninstall
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ── Найти NovaReader.exe ──────────────────────────────────────────────────────
if (-not $ExePath) {
    # 1. Рядом со скриптом
    $candidate = Join-Path $PSScriptRoot "NovaReader.exe"
    if (Test-Path $candidate) {
        $ExePath = $candidate
    }
    # 2. Стандартное расположение после NSIS-установки (LocalAppData, per-user)
    elseif (Test-Path "$env:LOCALAPPDATA\NovaReader\NovaReader.exe") {
        $ExePath = "$env:LOCALAPPDATA\NovaReader\NovaReader.exe"
    }
    # 3. Program Files (machine-wide install)
    elseif (Test-Path "$env:ProgramFiles\NovaReader\NovaReader.exe") {
        $ExePath = "$env:ProgramFiles\NovaReader\NovaReader.exe"
    }
    else {
        Write-Error "NovaReader.exe не найден. Укажите путь через параметр -ExePath."
        exit 1
    }
}

# ── Определить корень реестра ─────────────────────────────────────────────────
if ($ForCurrentUserOnly) {
    # HKCU\Software\Classes перекрывает HKCR для текущего пользователя (без UAC)
    $RootKey = "HKCU:\Software\Classes"
    Write-Host "Режим: текущий пользователь (HKCU)" -ForegroundColor Cyan
} else {
    # HKCR требует прав администратора
    $isAdmin = ([Security.Principal.WindowsPrincipal]
        [Security.Principal.WindowsIdentity]::GetCurrent()
    ).IsInRole([Security.Principal.WindowsBuiltInRole]"Administrator")

    if (-not $isAdmin) {
        Write-Warning "Скрипт не запущен от администратора. Переключаемся на -ForCurrentUserOnly."
        $RootKey = "HKCU:\Software\Classes"
    } else {
        $RootKey = "HKCR:"
        Write-Host "Режим: все пользователи (HKCR)" -ForegroundColor Cyan
    }
}

$ShellKey  = "$RootKey\SystemFileAssociations\.pdf\shell\NovaReader"
$ExeQ      = "`"$ExePath`""   # Путь в кавычках для аргументов с пробелами

# ── Удаление ──────────────────────────────────────────────────────────────────
if ($Uninstall) {
    if (Test-Path $ShellKey) {
        Remove-Item -Path $ShellKey -Recurse -Force
        Write-Host ""
        Write-Host "✓ NovaReader удалён из контекстного меню." -ForegroundColor Green
    } else {
        Write-Host "Запись не найдена — ничего не удалено." -ForegroundColor Yellow
    }
    exit 0
}

# ── Проверить наличие .exe ────────────────────────────────────────────────────
if (-not (Test-Path $ExePath)) {
    Write-Error "Файл не найден: $ExePath"
    exit 1
}

# ── Вспомогательная функция записи в реестр ───────────────────────────────────
function Set-RegValue {
    param(
        [string] $Path,
        [string] $Name,
               $Value,
        [string] $Type = "String"
    )
    if (-not (Test-Path $Path)) {
        New-Item -Path $Path -Force | Out-Null
    }
    Set-ItemProperty -Path $Path -Name $Name -Value $Value -Type $Type
}

# ── Корневой пункт меню ───────────────────────────────────────────────────────
Set-RegValue $ShellKey "(Default)"    "NovaReader"
Set-RegValue $ShellKey "MUIVerb"      "NovaReader"
Set-RegValue $ShellKey "Icon"         "$ExePath,0"
# Пустая строка SubCommands активирует подменю из shell\<подключи>
Set-RegValue $ShellKey "SubCommands"  ""

# ── 01. Конвертировать в Word ─────────────────────────────────────────────────
$k = "$ShellKey\shell\01_ToWord"
Set-RegValue $k           "(Default)"  "Конвертировать в Word (.docx)"
Set-RegValue $k           "Icon"       "$ExePath,1"
Set-RegValue "$k\command" "(Default)"  "$ExeQ --convert-word `"%1`""

# ── 02. Конвертировать в Excel ────────────────────────────────────────────────
$k = "$ShellKey\shell\02_ToExcel"
Set-RegValue $k           "(Default)"  "Конвертировать в Excel (.xlsx)"
Set-RegValue $k           "Icon"       "$ExePath,2"
Set-RegValue "$k\command" "(Default)"  "$ExeQ --convert-excel `"%1`""

# ── 03. Конвертировать в DjVu ────────────────────────────────────────────────
$k = "$ShellKey\shell\03_ToDjVu"
Set-RegValue $k           "(Default)"  "Конвертировать в DjVu"
Set-RegValue $k           "Icon"       "$ExePath,3"
Set-RegValue "$k\command" "(Default)"  "$ExeQ --convert-djvu `"%1`""

# ── 04. Разделитель ───────────────────────────────────────────────────────────
$k = "$ShellKey\shell\04_Sep"
Set-RegValue $k "(Default)"     ""
Set-RegValue $k "CommandFlags"  0x40  "DWord"    # MF_SEPARATOR = 64

# ── 05. OCR — PDF с текстовым слоем ──────────────────────────────────────────
$k = "$ShellKey\shell\05_OCR"
Set-RegValue $k           "(Default)"  "Создать PDF с текстовым слоем (OCR)"
Set-RegValue $k           "Icon"       "$ExePath,4"
Set-RegValue "$k\command" "(Default)"  "$ExeQ --ocr `"%1`""

# ── 06. Настройки ─────────────────────────────────────────────────────────────
$k = "$ShellKey\shell\06_Settings"
Set-RegValue $k           "(Default)"  "Настройки..."
Set-RegValue "$k\command" "(Default)"  "$ExeQ --settings"

# ── Вывод результата ──────────────────────────────────────────────────────────
Write-Host ""
Write-Host "✓ NovaReader успешно зарегистрирован в контекстном меню Explorer." -ForegroundColor Green
Write-Host "  Исполняемый файл : $ExePath"       -ForegroundColor Gray
Write-Host "  Раздел реестра   : $ShellKey"      -ForegroundColor Gray
Write-Host ""
Write-Host "Для проверки: нажмите правую кнопку мыши на любом .pdf файле." -ForegroundColor Cyan
if ($RootKey -eq "HKCR:") {
    Write-Host "(На Windows 11 выберите «Показать дополнительные параметры», если пункт не виден.)" -ForegroundColor DarkCyan
}
Write-Host ""
