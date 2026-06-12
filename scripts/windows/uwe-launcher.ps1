#Requires -Version 5.1
<#
.SYNOPSIS
  Interactive launcher for UWE on Windows.
#>
param(
  [ValidateSet("menu", "install", "start", "stop", "status", "check", "logs", "open-studio", "open-portal")]
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
  Write-Host "1) System check"
  Write-Host "2) Install / Update"
  Write-Host "3) Start UWE"
  Write-Host "4) Stop UWE"
  Write-Host "5) Status"
  Write-Host "6) Open logs folder"
  Write-Host "7) Open Studio in browser"
  Write-Host "8) Open Portal in browser"
  Write-Host "9) Enable auto-start"
  Write-Host "10) Disable auto-start"
  Write-Host "11) Create Desktop shortcut"
  Write-Host "12) Create Start Menu shortcut"
  Write-Host "0) Exit"
  Write-Host ""
  $choice = Read-Host "Select option"
  switch ($choice) {
    "1" { Invoke-UweInstaller @("check", "--mode", $Mode) }
    "2" {
      $args = @("install", "--mode", $Mode)
      if ($BundlePath) { $args += @("--bundle", $BundlePath) }
      if ($RepoPath) { $args += @("--repo", $RepoPath) }
      Invoke-UweInstaller $args
    }
    "3" { Invoke-UweInstaller @("start") }
    "4" { Invoke-UweInstaller @("stop") }
    "5" { Invoke-UweInstaller @("status") }
    "6" { Invoke-Item (Join-Path $InstallRoot "logs") }
    "7" { Open-Url "http://localhost:3000" }
    "8" { Open-Url "http://localhost:3001" }
    "9" { Invoke-UweInstaller @("enable-autostart") }
    "10" { Invoke-UweInstaller @("disable-autostart") }
    "11" { Invoke-UweInstaller @("shortcut-desktop") }
    "12" { Invoke-UweInstaller @("shortcut-startmenu") }
    "0" { return }
    default { Write-Host "Unknown option." }
  }
}

switch ($Action) {
  "menu" { Show-Menu }
  "install" {
    $args = @("install", "--mode", $Mode)
    if ($BundlePath) { $args += @("--bundle", $BundlePath) }
    if ($RepoPath) { $args += @("--repo", $RepoPath) }
    Invoke-UweInstaller $args
  }
  "check" { Invoke-UweInstaller @("check", "--mode", $Mode) }
  "start" { Invoke-UweInstaller @("start") }
  "stop" { Invoke-UweInstaller @("stop") }
  "status" { Invoke-UweInstaller @("status") }
  "logs" { Invoke-Item (Join-Path $InstallRoot "logs") }
  "open-studio" { Open-Url "http://localhost:3000" }
  "open-portal" { Open-Url "http://localhost:3001" }
}
