# Self-Hosted CI & GitHub Actions — Strategie und Hardware

Stand: 2026-06-18

Dieses Dokument hält Entscheidungen und Planung für **CI ohne GitHub Actions Minuten** fest — für den Fall, dass Billing-Limits erreicht sind oder keine weiteren Kosten gewünscht sind.

**Aktuelle Entscheidung (Step 1):** GitHub-hosted Actions nutzen (Spending Limit / Free-Tier auffüllen). Self-hosted Runner ist **geplant für später**, nicht aktiv.

Siehe auch: [ci.md](ci.md) (aktive Workflows), [cursor-workflow.md](cursor-workflow.md).

---

## Warum dieses Thema relevant ist

| GitHub-hosted Runner | Self-hosted Runner |
|--------------------|-------------------|
| Minuten aus Free-Tier / Spending Limit | **$0** Actions-Minuten bei GitHub |
| Limit erreicht → Jobs starten nicht (`runner_id: 0`, 0 Steps) | Läuft auf eigenem Linux-Host |
| „Pay to Win“ bei private Repos | Strom + eigene Hardware |

Die **Qualitäts-Pipeline** (`pnpm quality`, `pnpm ci:check`) ist unabhängig von GitHub — lokal identisch. GitHub Actions ist nur der **Automatisierungs-Ort**.

---

## Optionen ohne GitHub-Minuten (Referenz)

### Option A — Self-hosted GitHub Actions Runner (empfohlen für später)

- GitHub → **Settings → Actions → Runners → New self-hosted runner**
- Runner auf Linux installieren (GitHub zeigt Befehle)
- Workflows: `runs-on: self-hosted` (statt `ubuntu-latest`)
- GitHub rechnet **keine Minuten** ab; CPU/RAM/Disk sind lokal

### Option B — GitHub Actions deaktivieren, nur lokal

```bash
pnpm install --frozen-lockfile
pnpm quality   # vor jedem Merge
```

- Branch protection: Required status checks **entfernen**
- Optional: pre-push Hook für `pnpm ci:check`
- Agent Jobs: `AGENT_JOBS_DEFAULT_PROVIDER=cursor_cli_local` statt `github_actions`

### Option C — Öffentliches Repo

Unbegrenzte GitHub Actions Minuten auf Free-Tier — für privates UWE meist **keine** Option.

---

## Hardware-Anforderungen (UWE CI-Jobs)

| Job | Inhalt | Spitzenlast |
|-----|--------|-------------|
| `pnpm quality` | Lint, Tests, Security, 2× Next.js Build | CPU + RAM |
| `pnpm ci:check` | Lint, Typecheck, Tests, Build | etwas weniger |
| E2E (`pnpm test:e2e`) | Playwright + Studio + Portal | RAM |
| PostgreSQL-Smoke | Postgres-Container + Test | gering |
| Docker-Build | Studio + Portal Images | RAM + Disk |

### Stufe 1 — Leichtes PR-Gate (`ci:check` ohne Full-Build)

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

### Stufe 3 — Wie `ci.yml` heute (Quality + E2E + Postgres + Docker)

| | |
|--|--|
| CPU | **4–6 Kerne** |
| RAM | **16 GB** (8 GB knapp) |
| Disk | **100–200 GB** SSD + Docker |
| Zusatz | Docker, optional BuildKit-Cache |

### Speicher (Planung)

| Was | ca. |
|-----|-----|
| Repo + `node_modules` | 2–4 GB |
| pnpm Store | 5–15 GB |
| Playwright Chromium | ~500 MB |
| Docker Layer (Studio + Portal) | 10–30 GB |

SSD empfohlen — Builds auf HDD sind sehr langsam.

---

## Linux-Laptop mit 4 GB RAM (Homelab-Host)

**Kurz:** Für **volles CI nicht geeignet**. Für **reduziertes Gate** möglich.

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
| `pnpm lint`, `secret:scan`, `docs:check` | ✅ |
| `pnpm typecheck` | ⚠️ oft ok |
| `pnpm build:release` / `pnpm quality` | ❌ (Spitzen ~4–6 GB+) |
| E2E, Docker-Build | ❌ |

### Workarounds auf 4 GB

1. **Leichtes Gate:** lint + secret:scan + typecheck + docs (ohne Build)
2. **Swap** (z. B. 8 GB auf SSD) — langsam, 30–90+ Min pro Run
3. **UWE stoppen**, CI laufen lassen, UWE wieder starten
4. RAM-Upgrade auf **8 GB** falls Laptop upgradefähig

### Geplantes `ci-light` für schwache Runner (noch nicht implementiert)

```bash
pnpm lint && pnpm secret:scan && pnpm typecheck && pnpm docs:check
# kein build:release, kein E2E, kein Docker in CI
```

---

## UWE-Host + Runner auf einem Rechner

| Gesamt-RAM | + `pnpm quality` | + Full CI (E2E/Docker) |
|------------|------------------|------------------------|
| 8 GB | knapp | nicht empfohlen |
| 16 GB | ok | grenzwertig |
| 32 GB | komfortabel | ok |

---

## Minuten sparen (falls wieder GitHub-hosted, ohne Extra-Kosten)

Aktuell laufen auf **jedem PR** mehrere Workflows parallel — das verbraucht schnell Free-Tier:

| Workflow | PR | Inhalt |
|----------|-----|--------|
| `ci.yml` | ✅ | volles `pnpm quality` (~10+ Min.) |
| `pr-check.yml` | ✅ | lint, typecheck, test:ci |
| `security.yml` | ✅ | secret scan, audit, security tests |
| `docs-check.yml` | ✅ (Doc-Pfade) | docs:check |

**Empfohlene Aufteilung:**

| Event | Workflow |
|-------|----------|
| Pull Request | nur `pr-check.yml` (`pnpm ci:check` + docs) |
| Push `main` | `ci.yml` (volles Gate + E2E + …) |
| Security | nur `schedule` + `push main`, **nicht** jedes PR |

---

## Umsetzung Self-hosted (Checkliste für später)

1. Linux-Host vorbereiten (siehe Hardware-Stufen oben)
2. GitHub: **Settings → Actions → Runners → New self-hosted runner**
3. Runner installieren und als Service (`svc.sh install`) registrieren
4. Labels setzen, z. B. `self-hosted`, `linux`, `x64`, optional `4gb` / `16gb`
5. Workflows anpassen:
   - `runs-on: [self-hosted, linux]` statt `ubuntu-latest`
   - Schwache Runner: nur `ci-light` / `pr-check.yml`
   - Starke Runner oder nur `main`: volles `ci.yml`
6. Branch protection: Check-Namen auf neue Job-Namen prüfen
7. `docs/engineering/ci.md` aktualisieren

### Agent Jobs

`cursor-agent.yml` nutzt heute GitHub-hosted Runner. Für Self-hosted:

- Runner mit ausreichend RAM für `pnpm quality`
- oder `AGENT_JOBS_DEFAULT_PROVIDER=cursor_cli_local` in Studio-ENV

---

## Billing kurz freischalten (aktueller Step 1)

Wenn Jobs sofort fehlschlagen (5 s, keine Steps):

1. **Settings → Billing → Spending limits** — Limit erhöhen oder Zyklus abwarten
2. **Branch protection** — Required checks passend zu Job-Namen (`quality`, `fast-checks`, …)
3. Test: **Actions → CI → Run workflow**
4. Lokal parallel: `pnpm quality`

---

## Raspberry Pi

- Pi 4 (4 GB): nur leichtes Gate, langsam
- Pi 5 (8 GB): `pnpm quality` möglich, geduldig
- ARM64 — Build-Zeiten und Docker-Kompatibilität schlechter als x64-NUC

---

## Verwandte Dateien

| Datei | Zweck |
|-------|--------|
| `.github/workflows/ci.yml` | Volles Gate auf `main` |
| `.github/workflows/pr-check.yml` | Schnelles PR-Gate |
| `package.json` | `quality`, `ci:check`, `test:ci` |
| `AGENTS.md` | Agent Quality Gate |
| `scripts/docs-check.mjs` | Docs-Validierung |

---

## Entscheidungslog

| Datum | Entscheidung |
|-------|--------------|
| 2026-06-18 | GitHub-hosted Actions (Billing) als Step 1; Self-hosted + Hardware-Notes für später dokumentiert |
