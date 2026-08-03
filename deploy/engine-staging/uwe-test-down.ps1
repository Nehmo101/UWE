#requires -Version 5
<#
.SYNOPSIS
  Stoppt die UWE-Staging-Umgebung auf dem Maschinenraum-PC (Studio :3002, Portal :3003, cloudflared).

.PARAMETER Wipe
  Zusaetzlich die Test-DB loeschen. Der naechste 'uwe-test-up.ps1 -Fresh' startet dann
  wieder mit der Demo-Welt (kein echter Datenbestand auf dem Maschinenraum-PC).

.EXAMPLE
  .\uwe-test-down.ps1
  .\uwe-test-down.ps1 -Wipe
#>
[CmdletBinding()]
param([switch]$Wipe)
$ErrorActionPreference = 'SilentlyContinue'

# --- Konfiguration (mit uwe-test-up.ps1 konsistent halten) -------------------
$TestDb = 'C:\uwe-test\data\uwe-test.db'
# -----------------------------------------------------------------------------

# Studio/Portal ueber ihre Listen-Ports beenden
foreach ($port in 3002, 3003) {
  Get-NetTCPConnection -LocalPort $port -State Listen |
    Select-Object -ExpandProperty OwningProcess -Unique |
    ForEach-Object { Stop-Process -Id $_ -Force }
}

# Tunnel beenden
Get-Process cloudflared | Stop-Process -Force

Write-Host "[uwe-test] gestoppt (Studio :3002, Portal :3003, cloudflared)."

if ($Wipe) {
  Remove-Item $TestDb -Force
  Write-Host "[uwe-test] Test-DB geloescht — naechster 'up -Fresh' startet mit Demo-Seed."
}
