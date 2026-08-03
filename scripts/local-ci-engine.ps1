param(
[switch]$SkipInstall,
[switch]$SkipAudit,
[switch]$FullQuality,
[switch]$ContinueOnError
)

$ErrorActionPreference = "Stop"

function Step {
param(
[string]$Name,
[scriptblock]$Command
)

Write-Host ""
Write-Host "============================================================" -ForegroundColor DarkGray
Write-Host "▶ $Name" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor DarkGray

$started = Get-Date

try {
& $Command
$duration = (Get-Date) - $started
Write-Host "✅ OK: $Name ($([math]::Round($duration.TotalSeconds, 1))s)" -ForegroundColor Green
}
catch {
$duration = (Get-Date) - $started
Write-Host "❌ FEHLER: $Name ($([math]::Round($duration.TotalSeconds, 1))s)" -ForegroundColor Red
Write-Host $_.Exception.Message -ForegroundColor Red

```
if (-not $ContinueOnError) {
  exit 1
}
```

}
}

$repoRoot = Resolve-Path "$PSScriptRoot.."
Set-Location $repoRoot

Write-Host ""
Write-Host "UWE lokale CI auf Maschinenraum-Laptop" -ForegroundColor Magenta
Write-Host "Repo: $repoRoot"
Write-Host "Node: $(node -v 2>$null)"
Write-Host "pnpm: $(pnpm -v 2>$null)"

Step "Corepack aktivieren" {
corepack enable
}

if (-not $SkipInstall) {
Step "Dependencies installieren" {
pnpm install --frozen-lockfile
}
}

Step "Prisma Client generieren" {
pnpm --filter "@uwe/database" db:generate
}

Step "Lint" {
pnpm lint
}

Step "Typecheck" {
pnpm typecheck
}

Step "CI Tests" {
pnpm test:ci
}

Step "Security Tests" {
pnpm test:security
}

if (-not $SkipAudit) {
Step "Production Audit" {
pnpm audit:prod
}
}

Step "Release Build" {
pnpm build:release
}

if (Test-Path "scripts/bundle-budget-check.mjs") {
Step "Bundle Budget Check" {
node scripts/bundle-budget-check.mjs
}
}

if ($FullQuality) {
Step "Full pnpm quality" {
pnpm quality
}
}

Write-Host ""
Write-Host "✅ Lokale CI fertig." -ForegroundColor Green
Write-Host ""
