# Self-Hosted CI & GitHub Actions — Strategie und Hardware

Stand: 2026-06-26

> **Historisch / optional — NICHT der aktive Gate.** Die maßgebliche CI läuft
> ausschließlich in der **GitHub Cloud** (siehe [ci.md](ci.md)). Self-hosted Runner
> sind hier nur als Referenz/Notfalloption dokumentiert und werden derzeit **nicht**
> verwendet. Ein PR ist mergebar, wenn seine GitHub-Checks grün sind.

Dieses Dokument hält Entscheidungen und Planung für **CI ohne GitHub Actions Minuten** fest — für den Fall, dass Billing-Limits erreicht sind oder keine weiteren Kosten gewünscht sind.

**Aktuelle Entscheidung:** GitHub-hosted Actions (GitHub Cloud) mit **kostenoptimierter Aufteilung** — günstiges PR-Gate, volles Gate nur auf `main`. Self-hosted Runner bleibt **optional/historisch** und ist nicht aktiv.

Siehe auch: [ci.md](ci.md) (aktive Workflows), [cursor-workflow.md](cursor-workflow.md).

---

## Kostenstrategie (aktiv)

| Event | Workflow | Inhalt | GitHub-Minuten |
|-------|----------|--------|----------------|
| **Pull Request** | `pr-check.yml` | `pnpm ci:light` + Lockfile | günstig (~3–5 Min.) |
| **Push `main`** | `ci.yml` | `pnpm quality` + Postgres-Smoke | mittel (~10–15 Min.) |
| **Sonntag 03:00 UTC / Manuell** | `ci.yml` | E2E + Performance-Budget | teuer (~15–25 Min.) |
| **Montag 06:00 UTC / Manuell** | `security.yml` | Audit + Security Tests | mittel |
| **Manuell** | `cursor-agent.yml` | Agent + `ci:light` | mittel |

### Was auf PRs **nicht** mehr läuft

- `ci.yml` (volles `pnpm quality`, E2E, Postgres-Smoke)
- `security.yml` (Audit, Security Tests — Secret Scan läuft via `pnpm ci:light` in PR)
- `docs-check.yml` (läuft in `pr-check.yml` via `pnpm docs:check`)

### Branch Protection

**Required** (einziger PR-Blocker):

- `fast-checks` (`pr-check.yml`)

**Nicht required** (sonst hängen PRs bei path-gefilterten oder post-merge Checks):

- CI: `quality`, `e2e`, `postgres-smoke`
- Security: `security-scan`, `security-tests`
- Docs Check: `docs`

---

## Warum dieses Thema relevant ist

| GitHub-hosted Runner | Self-hosted Runner |
|--------------------|-------------------|
| Minuten aus Free-Tier / Spending Limit | **$0** Actions-Minuten bei GitHub |
| Limit erreicht → Jobs starten nicht (`runner_id: 0`, 0 Steps) | Läuft auf eigenem Linux-Host |
| „Pay to Win“ bei private Repos | Strom + eigene Hardware |

Die **Qualitäts-Pipeline** (`pnpm quality`, `pnpm ci:light`) ist unabhängig von GitHub — lokal identisch. GitHub Actions ist nur der **Automatisierungs-Ort**.

---

## Optionen ohne GitHub-Minuten (Referenz)

### Option A — Self-hosted GitHub Actions Runner (empfohlen für später)

- GitHub → **Settings → Actions → Runners → New self-hosted runner**
- Runner auf Linux installieren (GitHub zeigt Befehle)
- Workflows: `runs-on: self-hosted` (statt `ubuntu-latest`)
- GitHub rechnet **keine Minuten** ab; CPU/RAM/Disk sind lokal

Empfohlene Zuordnung:

| Runner | Workflows |
|--------|-----------|
| Schwacher Runner (4–8 GB) | `pr-check.yml` (`pnpm ci:light`) |
| Starker Runner (16+ GB) | `ci.yml` auf `main`, optional `cursor-agent.yml` |

### Option B — GitHub Actions deaktivieren, nur lokal

```bash
pnpm install --frozen-lockfile
pnpm ci:light   # vor PR
pnpm quality    # vor Merge
```

- Branch protection: Required status checks **entfernen** oder durch lokale Hooks ersetzen
- Agent Jobs: `AGENT_JOBS_DEFAULT_PROVIDER=cursor_cli_local` statt `github_actions`

### Option C — Öffentliches Repo

Unbegrenzte GitHub Actions Minuten auf Free-Tier — für privates UWE meist **keine** Option.

---

## Hardware-Anforderungen (UWE CI-Jobs)

| Job | Inhalt | Spitzenlast |
|-----|--------|-------------|
| `pnpm ci:light` | Lint, typecheck, test:ci, secret scan, docs | gering |
| `pnpm quality` | Lint, Tests, Security, 2× Next.js Build | CPU + RAM |
| E2E (`pnpm test:e2e`) | Playwright + Studio + Portal | RAM |
| PostgreSQL-Smoke | Postgres-Container + Test | gering |
| Docker-Build | Studio + Portal Images | RAM + Disk |

### Stufe 1 — PR-Gate (`pnpm ci:light`)

| | |
|--|--|
| CPU | 2 Kerne (4 angenehmer) |
| RAM | **8 GB** |
| Disk | **50 GB** SSD frei |
| OS | Linux x64, Node 22 |

### Stufe 2 — Volles `pnpm quality` (empfohlenes Minimum)

| | |
|--|--|
| CPU | **4 Kerne** |
| RAM | **8 GB** (16 GB komfortabler) |
| Disk | **80–100 GB** SSD |
| OS | Linux x64, Node 22 |

### Stufe 3 — Wie `ci.yml` scheduled (Quality + E2E + Postgres)

| | |
|--|--|
| CPU | **4–6 Kerne** |
| RAM | **16 GB** (8 GB knapp) |
| Disk | **100–150 GB** SSD |
| Zusatz | Playwright Chromium |

### Speicher (Planung)

| Was | ca. |
|-----|-----|
| Repo + `node_modules` | 2–4 GB |
| pnpm Store | 5–15 GB |
| Playwright Chromium | ~500 MB |

SSD empfohlen — Builds auf HDD sind sehr langsam.

---

## Linux-Laptop mit 4 GB RAM (Homelab-Host)

**Kurz:** Für **volles CI nicht geeignet**. Für **PR-Gate (`ci:light`)** möglich.

### UWE + CI auf dem **gleichen** Gerät

| Komponente | RAM |
|------------|-----|
| Linux | ~1–1,5 GB |
| UWE (Studio + Portal) | ~1,5–3 GB |
| Frei für CI | oft **&lt; 1 GB** |

→ Volles CI parallel zu UWE: **nicht praktikabel**.

### Nur als CI-Runner (UWE woanders)

| Job | 4 GB |
|-----|------|
| `pnpm ci:light` (lint, secret:scan, typecheck, test:ci, docs) | ⚠️ oft ok |
| `pnpm build:release` / `pnpm quality` | ❌ (Spitzen ~4–6 GB+) |
| E2E, Docker-Build | ❌ |

### Workarounds auf 4 GB

1. **PR-Gate:** `pnpm ci:light` (ohne Build)
2. **Swap** (z. B. 8 GB auf SSD) — langsam, 30–90+ Min pro Run
3. **UWE stoppen**, CI laufen lassen, UWE wieder starten
4. RAM-Upgrade auf **8 GB** falls Laptop upgradefähig

---

## UWE-Host + Runner auf einem Rechner

| Gesamt-RAM | + `pnpm ci:light` | + `pnpm quality` | + Full CI (E2E/Docker) |
|------------|-------------------|------------------|------------------------|
| 8 GB | ok | knapp | nicht empfohlen |
| 16 GB | komfortabel | ok | grenzwertig |
| 32 GB | komfortabel | komfortabel | ok |

---

## Umsetzung Self-hosted (Checkliste für später)

1. Linux-Host vorbereiten (siehe Hardware-Stufen oben)
2. GitHub: **Settings → Actions → Runners → New self-hosted runner**
3. Runner installieren und als Service (`svc.sh install`) registrieren
4. Labels setzen, z. B. `self-hosted`, `linux`, `x64`, optional `4gb` / `16gb`
5. Workflows anpassen:
   - `runs-on: [self-hosted, linux]` statt `ubuntu-latest`
   - Schwache Runner: nur `pr-check.yml` / `pnpm ci:light`
   - Starke Runner oder nur `main`: volles `ci.yml`
6. Branch protection: nur `fast-checks` als required check
7. `docs/engineering/ci.md` aktualisieren

### Agent Jobs

`cursor-agent.yml` nutzt heute GitHub-hosted Runner mit `pnpm ci:light`. Für Self-hosted:

- Runner mit ausreichend RAM für `pnpm ci:light` (oder `pnpm quality` wenn gewünscht)
- **Bevorzugt:** `AGENT_JOBS_DEFAULT_PROVIDER=cursor_cli_local` in Studio-ENV — Agent läuft lokal, PR-Gate übernimmt `pr-check.yml`

---

## Billing kurz freischalten (falls Limit erreicht)

Wenn Jobs sofort fehlschlagen (5 s, keine Steps):

1. **Settings → Billing → Spending limits** — Limit erhöhen oder Zyklus abwarten
2. **Branch protection** — Required check: `fast-checks` (nicht alte CI-Job-Namen)
3. Test: **Actions → PR Check → Run workflow** (via Test-PR) oder **CI → Run workflow** auf `main`
4. Lokal parallel: `pnpm ci:light` (PR) bzw. `pnpm quality` (vor Merge)

---

## Raspberry Pi

- Pi 4 (4 GB): `pnpm ci:light` möglich, langsam
- Pi 5 (8 GB): `pnpm quality` möglich, geduldig
- ARM64 — Build-Zeiten und Docker-Kompatibilität schlechter als x64-NUC

---

## Verwandte Dateien

| Datei | Zweck |
|-------|--------|
| `.github/workflows/pr-check.yml` | Günstiges PR-Gate |
| `.github/workflows/ci.yml` | Volles Gate auf `main` |
| `package.json` | `ci:light`, `quality`, `ci:check`, `test:ci` |
| `AGENTS.md` | Agent Quality Gate (lokal `pnpm quality`) |
| `scripts/docs-check.mjs` | Docs-Validierung |

---

## Entscheidungslog

| Datum | Entscheidung |
|-------|--------------|
| 2026-06-18 | GitHub-hosted Actions (Billing) als Step 1; Self-hosted + Hardware-Notes für später dokumentiert |
| 2026-06-20 | Kostenoptimierung: PR = `ci:light` only; main = volles Gate; Security scheduled/main; Windows/Agent manuell |
| 2026-06-26 | Weitere Reduktion: doppelter Prisma-Schritt aus PR entfernt; Security nur noch weekly/manual; E2E/Perf aus Push-main raus, läuft scheduled (So 03:00) + manual |
