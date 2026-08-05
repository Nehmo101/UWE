<#
.SYNOPSIS
Richtet die Terra-Art-Werkzeugkette unter Windows ein.

.DESCRIPTION
Baut den .exe-Starter fuer die glTF-Transform-CLI (Node kann die .cmd-Shims
von npm nicht direkt starten) und setzt BLENDER_BIN sowie GLTF_TRANSFORM_BIN
dauerhaft im Benutzerprofil. Danach erkennt `pnpm terra:art:doctor --strict`
beide Werkzeuge.

Voraussetzungen: Blender und `npm install -g @gltf-transform/cli` sind bereits
installiert. Der C#-Compiler stammt aus dem .NET Framework und ist auf Windows
vorhanden; es wird nichts zusaetzlich heruntergeladen.
#>
param(
  [string]$BlenderBin,
  [string]$TargetDir = "$env:USERPROFILE\.local\bin",
  [switch]$SkipEnvironment
)

$ErrorActionPreference = "Stop"

function Info([string]$Text) { Write-Host $Text -ForegroundColor Cyan }
function Ok([string]$Text) { Write-Host "OK: $Text" -ForegroundColor Green }
function Warn([string]$Text) { Write-Host "WARN: $Text" -ForegroundColor Yellow }

$source = Join-Path $PSScriptRoot "gltf-transform-shim.cs"
$target = Join-Path $TargetDir "gltf-transform.exe"

# 1. Starter bauen
$compiler = Join-Path $env:WINDIR "Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if (-not (Test-Path $compiler)) {
  throw "C#-Compiler nicht gefunden: $compiler"
}
if (-not (Test-Path $TargetDir)) {
  New-Item -ItemType Directory -Force -Path $TargetDir | Out-Null
}
Info "Baue $target"
& $compiler /nologo /target:exe /platform:anycpu /out:$target $source
if ($LASTEXITCODE -ne 0) { throw "Kompilieren fehlgeschlagen" }
$version = & $target --version
Ok "glTF Transform $version ueber den Starter erreichbar"

# 2. Blender finden
if (-not $BlenderBin) {
  $BlenderBin = Get-ChildItem "$env:ProgramFiles\Blender Foundation" -Directory -ErrorAction SilentlyContinue |
    Sort-Object Name -Descending |
    ForEach-Object { Join-Path $_.FullName "blender.exe" } |
    Where-Object { Test-Path $_ } |
    Select-Object -First 1
}
if ($BlenderBin -and (Test-Path $BlenderBin)) {
  Ok "Blender gefunden: $BlenderBin"
} else {
  Warn 'Blender nicht gefunden. Ohne Blender bleibt terra:art:generate gesperrt.'
  $BlenderBin = $null
}

# 3. Umgebungsvariablen dauerhaft setzen
if ($SkipEnvironment) {
  Info "Umgebungsvariablen bleiben unveraendert (-SkipEnvironment)."
} else {
  [Environment]::SetEnvironmentVariable("GLTF_TRANSFORM_BIN", $target, "User")
  $env:GLTF_TRANSFORM_BIN = $target
  Ok "GLTF_TRANSFORM_BIN = $target"
  if ($BlenderBin) {
    [Environment]::SetEnvironmentVariable("BLENDER_BIN", $BlenderBin, "User")
    $env:BLENDER_BIN = $BlenderBin
    Ok "BLENDER_BIN = $BlenderBin"
  }
}

Write-Host ""
Info "Naechster Schritt: pnpm terra:art:doctor --strict"
Write-Host "Bereits offene Terminals kennen die neuen Variablen erst nach einem Neustart." -ForegroundColor DarkGray
