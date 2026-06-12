#Requires -Version 5.1
param(
  [string] $InstallRoot = $(if ($env:LOCALAPPDATA) { Join-Path $env:LOCALAPPDATA "UWE" } else { Join-Path $env:USERPROFILE ".uwe" }),
  [ValidateSet("dev", "release")]
  [string] $Mode = "dev",
  [string] $BundlePath = "",
  [string] $RepoPath = "",
  [switch] $DryRun
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
& "$ScriptDir\uwe-launcher.ps1" -Action install -InstallRoot $InstallRoot -Mode $Mode -BundlePath $BundlePath -RepoPath $RepoPath -DryRun:$DryRun
