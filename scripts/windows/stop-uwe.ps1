#Requires -Version 5.1
param(
  [string] $InstallRoot = $(if ($env:LOCALAPPDATA) { Join-Path $env:LOCALAPPDATA "UWE" } else { Join-Path $env:USERPROFILE ".uwe" })
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
& "$ScriptDir\uwe-launcher.ps1" -Action stop -InstallRoot $InstallRoot
