#Requires -Version 5.1
<#
.SYNOPSIS
    Удаляет NovaReader из контекстного меню Windows Explorer.

.PARAMETER ForCurrentUserOnly
    Удалять из HKCU (без прав администратора).
    Используйте тот же флаг, что и при установке.

.EXAMPLE
    # Удаление (системная регистрация, нужен admin):
    .\uninstall-context-menu.ps1

.EXAMPLE
    # Удаление (регистрация только для пользователя):
    .\uninstall-context-menu.ps1 -ForCurrentUserOnly
#>

param(
    [switch] $ForCurrentUserOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$removed = $false

# Удаляем из HKCU (per-user) всегда — без UAC
$hkcuKey = "HKCU:\Software\Classes\SystemFileAssociations\.pdf\shell\NovaReader"
if (Test-Path $hkcuKey) {
    Remove-Item -Path $hkcuKey -Recurse -Force
    Write-Host "✓ Удалено из HKCU (per-user)" -ForegroundColor Green
    $removed = $true
}

# Удаляем из HKCR (all-users), если НЕ ForCurrentUserOnly
if (-not $ForCurrentUserOnly) {
    $isAdmin = ([Security.Principal.WindowsPrincipal]
        [Security.Principal.WindowsIdentity]::GetCurrent()
    ).IsInRole([Security.Principal.WindowsBuiltInRole]"Administrator")

    $hkcrKey = "HKCR:\SystemFileAssociations\.pdf\shell\NovaReader"
    if ($isAdmin -and (Test-Path $hkcrKey)) {
        Remove-Item -Path $hkcrKey -Recurse -Force
        Write-Host "✓ Удалено из HKCR (all-users)" -ForegroundColor Green
        $removed = $true
    } elseif (-not $isAdmin -and (Test-Path $hkcrKey)) {
        Write-Warning "Запись в HKCR существует, но скрипт запущен без прав администратора."
        Write-Warning "Запустите от имени администратора или используйте -ForCurrentUserOnly."
    }
}

if (-not $removed) {
    Write-Host "Записи NovaReader в реестре не найдены — ничего не удалено." -ForegroundColor Yellow
}
