#Requires -Version 5.1
param(
  [ValidateSet("menu", "install", "start", "stop", "status", "check", "logs", "open-studio", "open-portal")]
  [string] $Action = "menu",
  [string] $InstallRoot = $(Split-Path -Parent $PSScriptRoot),
  [ValidateSet("dev", "release")]
  [string] $Mode = "dev",
  [switch] $DryRun
)

$ErrorActionPreference = "Stop"
$InstallerCli = Join-Path $InstallRoot "app\tools\windows-installer\dist\cli.js"
$FallbackCli = Join-Path $InstallRoot "config\uwe-installer-cli.js"

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
  Write-Host "2) Start UWE"
  Write-Host "3) Stop UWE"
  Write-Host "4) Open logs"
  Write-Host "5) Open Studio"
  Write-Host "6) Open Portal"
  Write-Host "0) Exit"
  $choice = Read-Host "Select option"
  switch ($choice) {
    "1" { Invoke-UweInstaller @("status") }
    "2" { Invoke-UweInstaller @("start") }
    "3" { Invoke-UweInstaller @("stop") }
    "4" { Invoke-Item (Join-Path $InstallRoot "logs") }
    "5" { Open-Url "http://localhost:3000" }
    "6" { Open-Url "http://localhost:3001" }
    "0" { return }
    default { Write-Host "Unknown option." }
  }
}

switch ($Action) {
  "menu" { Show-Menu }
  "start" { Invoke-UweInstaller @("start") }
  "stop" { Invoke-UweInstaller @("stop") }
  "status" { Invoke-UweInstaller @("status") }
  "logs" { Invoke-Item (Join-Path $InstallRoot "logs") }
  "open-studio" { Open-Url "http://localhost:3000" }
  "open-portal" { Open-Url "http://localhost:3001" }
  default { Invoke-UweInstaller @($Action) }
}
