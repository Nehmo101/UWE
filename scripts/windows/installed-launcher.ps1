#Requires -Version 5.1
param(
  [ValidateSet("menu", "install", "start", "stop", "restart", "status", "check", "logs", "open-studio", "open-portal", "panel", "wizard")]
  [string] $Action = "start",
  [string] $InstallRoot = $(Split-Path -Parent $PSScriptRoot),
  [ValidateSet("dev", "release")]
  [string] $Mode = "release",
  [switch] $DryRun
)

$ErrorActionPreference = "Stop"
$InstallerCli = Join-Path $InstallRoot "config\uwe-installer-cli.js"
$FallbackCli = Join-Path $InstallRoot "app\tools\windows-installer\dist\cli.js"
$ControlPanel = Join-Path $InstallRoot "config\control-panel.ps1"
$ControlPanelSource = Join-Path $InstallRoot "app\scripts\windows\uwe-control-panel.ps1"

function Get-InstallerCli {
  if (Test-Path $InstallerCli) { return $InstallerCli }
  if (Test-Path $FallbackCli) { return $FallbackCli }
  throw "Installer CLI not found. Re-run install from the UWE repository."
}

function Invoke-UweInstaller {
  param([string[]] $Args)
  $cli = Get-InstallerCli
  $allArgs = @($Args + @("--root", $InstallRoot))
  if ($DryRun) { $allArgs += "--dry-run" }
  & node $cli @allArgs
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

function Open-Url {
  param([string] $Url)
  Start-Process $Url
}

function Show-Menu {
  Write-Host ""
  Write-Host "UWE Launcher"
  Write-Host "Install root: $InstallRoot"
  Write-Host ""
  Write-Host "1) Status"
  Write-Host "2) Start UWE (Browser öffnet sich)"
  Write-Host "3) Stop UWE"
  Write-Host "4) Steuerung öffnen"
  Write-Host "5) Logs öffnen"
  Write-Host "6) Studio im Browser"
  Write-Host "7) Portal im Browser"
  Write-Host "0) Exit"
  $choice = Read-Host "Auswahl"
  switch ($choice) {
    "1" { Invoke-UweInstaller @("status") }
    "2" { Invoke-UweInstaller @("start") }
    "3" { Invoke-UweInstaller @("stop") }
    "4" {
      $panel = if (Test-Path $ControlPanel) { $ControlPanel } else { $ControlPanelSource }
      if (Test-Path $panel) {
        & powershell -NoProfile -ExecutionPolicy Bypass -File $panel -InstallRoot $InstallRoot
      } else {
        Write-Host "Steuerung nicht gefunden."
      }
    }
    "5" { Invoke-Item (Join-Path $InstallRoot "logs") }
    "6" { Open-Url "http://localhost:3000" }
    "7" { Open-Url "http://localhost:3001" }
    "0" { return }
    default { Write-Host "Unbekannte Option." }
  }
}

switch ($Action) {
  "menu" { Show-Menu }
  "wizard" {
    $wizard = Join-Path $InstallRoot "app\scripts\windows\uwe-wizard.ps1"
    if (-not (Test-Path $wizard)) {
      $wizard = Join-Path (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)) "scripts\windows\uwe-wizard.ps1"
    }
    & powershell -NoProfile -ExecutionPolicy Bypass -File $wizard -InstallRoot $InstallRoot -Mode $Mode
  }
  "panel" {
    $panel = if (Test-Path $ControlPanel) { $ControlPanel } else { $ControlPanelSource }
    & powershell -NoProfile -ExecutionPolicy Bypass -File $panel -InstallRoot $InstallRoot
  }
  "start" { Invoke-UweInstaller @("start") }
  "stop" { Invoke-UweInstaller @("stop") }
  "restart" { Invoke-UweInstaller @("restart") }
  "status" { Invoke-UweInstaller @("status") }
  "logs" { Invoke-Item (Join-Path $InstallRoot "logs") }
  "open-studio" { Open-Url "http://localhost:3000" }
  "open-portal" { Open-Url "http://localhost:3001" }
  default { Invoke-UweInstaller @($Action) }
}
