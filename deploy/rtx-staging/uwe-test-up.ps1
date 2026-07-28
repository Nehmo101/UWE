#requires -Version 5
<#
.SYNOPSIS
  Bringt die UWE-Staging-Umgebung on-demand auf dem RTX-PC hoch (dev-Branch).

.DESCRIPTION
  Pullt dev, wendet Migrationen auf die getrennte Test-DB an, baut prod-nah und
  startet Studio (:3002), Portal (:3003) und den cloudflared-Tunnel.
  Der Prod-Host wird nicht angefasst. Details: docs/engineering/staging-rtx.md.

.PARAMETER Mode
  build (Default) = next build + next start (prod-nah).  dev = next dev (schneller, Prod-abweichend).

.PARAMETER Restore
  Pfad zu einem Prod-Backup-ZIP, das nach dem Build in die Test-DB gespielt wird (Debug-Modus).

.PARAMETER Fresh
  Test-DB verwerfen und mit Demo-Daten neu seeden.

.EXAMPLE
  .\uwe-test-up.ps1
  .\uwe-test-up.ps1 -Fresh
  .\uwe-test-up.ps1 -Restore C:\backups\uwe-full.zip
  .\uwe-test-up.ps1 -Mode dev
#>
[CmdletBinding()]
param(
  [ValidateSet('build', 'dev')] [string]$Mode = 'build',
  [string]$Restore,
  [switch]$Fresh
)
$ErrorActionPreference = 'Stop'

# --- Konfiguration (einmalig anpassen) ---------------------------------------
$TestRoot = 'C:\uwe-test'                  # eigener Clone, tracked dev
$EnvFile  = Join-Path $TestRoot '.env'     # aus uwe-test.env.example kopiert
$TestDb   = 'C:\uwe-test\data\uwe-test.db'
$Branch   = 'dev'
$Tunnel   = 'uwe-test'
# -----------------------------------------------------------------------------

if (-not (Test-Path $EnvFile)) {
  throw "Test-.env fehlt: $EnvFile. Kopiere deploy/rtx-staging/uwe-test.env.example dorthin und passe die Werte an."
}

Set-Location $TestRoot

# .env in die Prozess-Umgebung laden — gilt fuer alle Child-Prozesse (prisma, next, cloudflared).
# Split auf das erste '=' (Base64-Secrets koennen '=' enthalten).
Get-Content $EnvFile | Where-Object { $_ -match '^\s*[^#].*=' } | ForEach-Object {
  $pair = $_ -split '=', 2
  [Environment]::SetEnvironmentVariable($pair[0].Trim(), $pair[1].Trim(), 'Process')
}

# 1. Code auf dev aktualisieren (verwirft lokale Aenderungen im Test-Checkout; .env ist gitignored)
git fetch origin $Branch
git checkout $Branch
git reset --hard "origin/$Branch"

# 2. Dependencies
pnpm install --frozen-lockfile

# 3. Migrationen auf die Test-DB — der eigentliche Wert von Staging
if ($Fresh) {
  Write-Host "[uwe-test] Fresh: Test-DB verwerfen und neu seeden ..."
  Remove-Item $TestDb -ErrorAction SilentlyContinue
  pnpm db:deploy
  pnpm db:seed
}
else {
  pnpm db:deploy
}

# 4. Optionaler Prod-Backup-Import (bewusster Debug-Modus)
if ($Restore) {
  if (-not (Test-Path $Restore)) { throw "Backup-ZIP nicht gefunden: $Restore" }
  Write-Host "[uwe-test] Restore aus $Restore in die Test-DB ..."
  node --import tsx packages/backup/src/cli-restore.ts $Restore
}

# 5. Build (prod-nah) — nur im build-Modus
if ($Mode -eq 'build') {
  Write-Host "[uwe-test] Build (build:release) ..."
  pnpm build:release
}

# 6. Prozesse starten: Studio 3002, Portal 3003, Tunnel (jeweils eigenes Fenster)
$sub = if ($Mode -eq 'build') { 'start' } else { 'dev' }
Start-Process pnpm        -WorkingDirectory $TestRoot -ArgumentList @('--filter', '@uwe/studio', 'exec', 'next', $sub, '--port', '3002')
Start-Process pnpm        -WorkingDirectory $TestRoot -ArgumentList @('--filter', '@uwe/portal', 'exec', 'next', $sub, '--port', '3003')
Start-Process cloudflared -ArgumentList @('tunnel', 'run', $Tunnel)

Write-Host ""
Write-Host "[uwe-test] Staging live:"
Write-Host "  Studio -> https://test.studio.uwe.example  (lokal :3002)"
Write-Host "  Portal -> https://test.portal.uwe.example  (lokal :3003)"
Write-Host "  Stoppen: .\uwe-test-down.ps1"
