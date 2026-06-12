#Requires -Version 5.1
param(
  [string] $InstallRoot = $(if ($env:LOCALAPPDATA) { Join-Path $env:LOCALAPPDATA "UWE" } else { Join-Path $env:USERPROFILE ".uwe" }),
  [switch] $Disable
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Resolve-Path (Join-Path $ScriptDir "..\..")
$InstallerCli = Join-Path $RepoRoot "tools\windows-installer\dist\cli.js"

if (-not (Test-Path $InstallerCli)) {
  Push-Location (Join-Path $RepoRoot "tools\windows-installer")
  pnpm run build | Out-Host
  Pop-Location
}

$command = if ($Disable) { "disable-autostart" } else { "enable-autostart" }
& node $InstallerCli $command --root $InstallRoot
exit $LASTEXITCODE
