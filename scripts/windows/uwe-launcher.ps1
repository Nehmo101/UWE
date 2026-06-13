#Requires -Version 5.1
<#
.SYNOPSIS
  Interactive launcher for UWE on Windows.
#>
param(
  [ValidateSet("menu", "install", "wizard", "panel", "start", "stop", "restart", "status", "check", "logs", "open-studio", "open-portal", "doctor", "repair", "backup", "diagnostics")]
  [string] $Action = "menu",

  [string] $InstallRoot = $(if ($env:LOCALAPPDATA) { Join-Path $env:LOCALAPPDATA "UWE" } else { Join-Path $env:USERPROFILE ".uwe" }),

  [ValidateSet("dev", "release")]
  [string] $Mode = "dev",

  [string] $BundlePath = "",
  [string] $RepoPath = "",
  [switch] $DryRun
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Resolve-Path (Join-Path $ScriptDir "..\..")
$InstallerCli = Join-Path $RepoRoot "tools\windows-installer\dist\cli.js"

function Ensure-InstallerBuilt {
  if (-not (Test-Path $InstallerCli)) {
    Write-Host "Building Windows installer CLI..."
    Push-Location (Join-Path $RepoRoot "tools\windows-installer")
    pnpm run build | Out-Host
    Pop-Location
  }
}

function Invoke-UweInstaller {
  param([string[]] $Args)
  Ensure-InstallerBuilt
  $allArgs = @($Args + @("--root", $InstallRoot))
  if ($DryRun) { $allArgs += "--dry-run" }
  & node $InstallerCli @allArgs
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

function Open-Url {
  param([string] $Url)
  Start-Process $Url
}

function Show-Menu {
  Write-Host ""
  Write-Host "UWE Windows Launcher"
  Write-Host "Install root: $InstallRoot"
  Write-Host ""
  Write-Host "1) Installations-Assistent (Wizard)"
  Write-Host "2) System check / Doctor"
  Write-Host "3) Install / Update"
  Write-Host "4) Start UWE"
  Write-Host "5) Stop UWE"
  Write-Host "6) Status"
  Write-Host "7) Steuerung öffnen"
  Write-Host "8) Logs öffnen"
  Write-Host "9) Backup erstellen"
  Write-Host "10) Reparieren"
  Write-Host "11) Diagnosepaket"
  Write-Host "0) Exit"
  Write-Host ""
  $choice = Read-Host "Select option"
  switch ($choice) {
    "1" { & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $ScriptDir "uwe-wizard.ps1") -InstallRoot $InstallRoot -Mode $Mode -BundlePath $BundlePath -RepoPath $RepoPath }
    "2" { Invoke-UweInstaller @("doctor") }
    "3" {
      $args = @("install", "--mode", $Mode)
      if ($BundlePath) { $args += @("--bundle", $BundlePath) }
      if ($RepoPath) { $args += @("--repo", $RepoPath) }
      Invoke-UweInstaller $args
    }
    "4" { Invoke-UweInstaller @("start") }
    "5" { Invoke-UweInstaller @("stop") }
    "6" { Invoke-UweInstaller @("status") }
    "7" { & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $ScriptDir "uwe-control-panel.ps1") -InstallRoot $InstallRoot }
    "8" { Invoke-Item (Join-Path $InstallRoot "logs") }
    "9" { Invoke-UweInstaller @("backup") }
    "10" { Invoke-UweInstaller @("repair", "--fix-all") }
    "11" { Invoke-UweInstaller @("diagnostics") }
    "0" { return }
    default { Write-Host "Unknown option." }
  }
}

switch ($Action) {
  "menu" { Show-Menu }
  "wizard" { & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $ScriptDir "uwe-wizard.ps1") -InstallRoot $InstallRoot -Mode $Mode -BundlePath $BundlePath -RepoPath $RepoPath }
  "panel" { & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $ScriptDir "uwe-control-panel.ps1") -InstallRoot $InstallRoot }
  "install" {
    $args = @("install", "--mode", $Mode)
    if ($BundlePath) { $args += @("--bundle", $BundlePath) }
    if ($RepoPath) { $args += @("--repo", $RepoPath) }
    Invoke-UweInstaller $args
  }
  "check" { Invoke-UweInstaller @("check", "--mode", $Mode) }
  "doctor" { Invoke-UweInstaller @("doctor") }
  "repair" { Invoke-UweInstaller @("repair", "--fix-all") }
  "backup" { Invoke-UweInstaller @("backup") }
  "diagnostics" { Invoke-UweInstaller @("diagnostics") }
  "start" { Invoke-UweInstaller @("start") }
  "stop" { Invoke-UweInstaller @("stop") }
  "restart" { Invoke-UweInstaller @("restart") }
  "status" { Invoke-UweInstaller @("status") }
  "logs" { Invoke-Item (Join-Path $InstallRoot "logs") }
  "open-studio" { Open-Url "http://localhost:3000" }
  "open-portal" { Open-Url "http://localhost:3001" }
}
