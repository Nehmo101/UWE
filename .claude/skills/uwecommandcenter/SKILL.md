---
name: uwecommandcenter
description: UWE Command Center — die Tauri-Desktop-App, die UWE auf einem PC betreibt. Dienste starten/stoppen, Ersteinrichtung, Updates, Cloudflare-Tunnel, Backups und der Maschinenraum-Worker. Nutze das für jede Aufgabe in apps/engine-connector-client, tools/uwe-host-command-center und tools/uwe-engine-connector, für Rebuild/Reinstall/Neustart der App und für die Frage „warum ist uweanddragons.org offline?".
---

# UWE Command Center

Die Desktop-Anlaufstation für das All-in-one-Setup: eine Tauri-v2-App, die alle
UWE-Dienste, den Cloudflare-Tunnel und den Maschinenraum-Worker auf demselben
Rechner orchestriert. Es gibt **keinen zweiten lokalen Webserver** — die App
spawnt Node-CLIs und liest deren letzte JSON-Zeile (NDJSON-Protokoll).

## Bausteine

| Baustein | Ort | Rolle |
|---|---|---|
| Desktop-App | `apps/engine-connector-client` | Rust (`src-tauri/`: `lib.rs`, `command_center.rs`, `process_guard.rs`) + React/Vite-Frontend; ~61 Tauri-Commands |
| Host-Steuerung | `tools/uwe-host-command-center` | `desktop-host-cli.ts` (Setup/Start/Stopp/Update/Backup), dazu `ops-cli.ts`, `user-admin-cli.ts`, `cloudflare-tunnel-cli.ts`, `provision-local-connector.ts` |
| Maschinenraum-Worker | `tools/uwe-engine-connector` | `desktop-launcher.ts` (Dauerprozess: Heartbeat/Claim, outbound-only) + `client-cli.ts` (One-shot für die UI) |
| Config-Schema | `packages/connector-client-config` | Zod-Gegenstück zum Rust-Struct von `config.json` |

Vollständige Command-Listen, Spawn-Tabelle, Setup-Plan, Job-Typen und
Config-Schema: `references/architektur.md`.

## Prozessmodell — das Wichtigste zuerst

- **Alle Kindprozesse hängen in einem Windows Job Object mit
  `KILL_ON_JOB_CLOSE`** (`process_guard.rs`). Stirbt die App — egal wie —,
  nimmt der Kernel Dienste und `cloudflared` mit. Öffentliche Erreichbarkeit
  hängt damit am offenen Command Center: **weiterlaufen lassen heißt
  minimieren, nicht schließen** (`trayMode: minimize_to_tray`).
- Beenden (X-Dialog und Tray) stoppt **erst den Tunnel, dann die Dienste** —
  Cloudflare liefert danach 530, nicht 502.
- Einzige Job-Ausnahme: „Im Browser öffnen" bricht per
  `CREATE_BREAKAWAY_FROM_JOB` aus.
- Beenden-Pfade nutzen `TerminateProcess` direkt, **nie `taskkill`** — das
  scheiterte beim Windows-Shutdown mit 0xc0000142 und blockierenden Dialogen
  (PR #53). Diese Konvention beibehalten.
- Der Worker wird **nicht** automatisch mit der App gestartet — nur der
  „Connector starten"-Knopf bzw. `autoConnect` beim App-Start tut das.

## Ports und Pfade

Ports kommen aus der Root-`.env` (`SERVICE_PORT_ENV` in
`desktop-host-types.ts`); die Code-Fallbacks weichen von typischen
Installationen ab:

| Dienst | Env-Key | Fallback | dieser Rechner | Bind |
|---|---|---|---|---|
| studio | `STUDIO_PORT` | 3000 | 3100 | 0.0.0.0 |
| portal | `PORTAL_PORT` | 3001 | 3101 | 0.0.0.0 |
| brain | `BRAIN_PORT` | 3102 | 3102 | 127.0.0.1 |
| landing | `LANDING_PORT` | 3103 | 3103 | 0.0.0.0 |
| family | `FAMILY_PORT` | 3004 | 3104 | 127.0.0.1 |

Daten liegen **außerhalb** des Checkouts unter
`%LOCALAPPDATA%\UWE\engine-connector-client`: `config.json`, Model-/Printer-Store,
Tunnel-Token, dazu `host\` mit `data\` (die drei `.db`), `logs\`, `runtime\`
(PID-Dateien, pnpm-Shim). Root-Auflösung: `UWE_MONOREPO_ROOT` (User-Env, hier
`C:\git\UWE`) → `localHostRoot` aus der Config → Aufwärtssuche nach
`pnpm-workspace.yaml`.

## Was geht ohne Rebuild live?

Die App spawnt die Node-Seite **aus dem Arbeitsbaum**:

- Änderungen an `tools/uwe-host-command-center/**` und
  `tools/uwe-engine-connector/**` greifen nach `git pull` beim nächsten
  CLI-Aufruf bzw. nach einem Worker-Neustart (Stop → Start in der App). Kein
  App-Rebuild.
- Nur Rust (`src-tauri/`) und React-Frontend brauchen den vollen Weg:

```powershell
# aus apps/engine-connector-client; ~2–3 min
pnpm tauri build
Get-Process uwe_engine_connector_client | Stop-Process -Force
Start-Process "...\bundle\nsis\UWE Command Center_0.1.0_x64-setup.exe" -ArgumentList '/S' -Wait
Start-Process "$env:LOCALAPPDATA\UWE Command Center\uwe_engine_connector_client.exe"
```

Install ist per-user (NSIS `currentUser`), `/S` braucht kein UAC. Headless ohne
GUI-Knöpfe: `pnpm --filter @uwe/host-command-center exec tsx
src/desktop-host-cli.ts {status|setup|start|stop|restart|backup|check-update|update}`.
⚠ `stop` reißt auch `cloudflared` mit — Tunnel separat wieder hochziehen
(`src/cloudflare-tunnel-cli.ts start`).

## Setup und Update

„UWE einrichten" = `setupHost` (`desktop-host.ts`): `.env` nur anlegen wenn
fehlend (`wx`-Flag, nie überschreiben) → `pnpm install` → Prisma generate →
Migrationen **nur der gewählten Bereiche** (`install-selection.json`) →
optional Seed → Connector provisionieren → Builds der gewählten Apps →
`materialize-standalone-prisma-deps.mjs` (ohne den 404en alle
`/_next/static/*` — PR #35).

„Update installieren" (`desktop-host-update.ts`): Ziel ist der neueste
**Release-Tag `uwe-v*`** — existiert keiner (Stand 2026-08-04: keiner!),
Fallback auf `origin/main`. Dirty Worktree wird gestasht (nie gepoppt — Stapel
wächst), bei Tag-Ziel `checkout --detach`, sonst ff-merge oder `checkout -B
main origin/main` mit Backup-Ref. Danach kompletter Setup-Lauf. **Jede lokale
Auslieferung von einem Branch überlebt den nächsten Update-Klick nicht** —
zügig nach `main` mergen.

## Fallen

- **`main` ist nicht verlässlich grün.** Beide GUI-Knöpfe bauen Studio + Portal
  produktiv; ein roter `main` bricht erst nach ~10 min mitten im Build. Vor
  jedem Neubau `pnpm lint` + `pnpm typecheck` fahren.
- **Nie `taskkill /IM node.exe /T`** — killt die laufenden Dienste und legt die
  öffentliche Seite still.
- Abgebrochene Setup-Läufe lassen `next build` als Enkelprozess weiter laufen
  (hält seine Sperre). Erst per `Get-CimInstance Win32_Process` prüfen.
- **Vierfache Wahrheit für Dienste/Ports**: `desktop-host-types.ts` (Quelle),
  `install-catalog.ts`, `InstallWizard.tsx`, `TARGET_ENV_KEYS` in
  `desktop-host.ts`. Ein neuer Dienst muss **alle** Stellen nachziehen; ein
  Konsistenztest fehlt. Gleiches gilt für `OPS_ACTIONS` (Rust) ↔ `ACTIONS`
  (`ops-cli.ts`) ↔ `OpsAction` (`tauri.ts`).
- **`config.json` wird durch den Rust-Struct gefiltert** (`lib.rs`,
  `ConnectorClientConfig`): Felder, die dort fehlen, verwirft jedes Speichern
  stillschweigend (traf bis 2026-08-04 `installWizardCompleted` und
  `sttCommand`, gefixt in PR #90) — neue Config-Felder immer in Rust **und**
  `packages/connector-client-config` ergänzen.
- **`stopServicesOnExit: false` wirkt erst ab dem nächsten Dienststart** (seit
  PR #90): dienststartende Aktionen spawnen dann mit
  `CREATE_BREAKAWAY_FROM_JOB`. Bereits laufende Dienste bleiben im Job Object
  und sterben mit der App; bei `false` gibt es keine Kernel-Aufräumgarantie
  bei App-Absturz mehr.
- `desktop-host-cli.ts` läuft mit **nacktem `node`** (natives Type-Stripping)
  → Importe dort brauchen explizite `.ts`-Endungen. Die anderen CLIs laufen
  mit `--import tsx`. Ein endungsloser Import bricht die Bundle-Installation,
  ohne dass Typecheck es sieht.
- Gerades `"` als schließendes deutsches Anführungszeichen bricht TS-Strings
  sofort und JSX als Lint-Fehler — immer `„…“` (U+201E/U+201C).
- Brain-Port ist doppelt dokumentiert: Code-Fallback **3102**, aber
  `.env.example`/Doku/`uwe-health.ts` sagen 3002. Die `.env` entscheidet.

## Tests und Qualität

```powershell
pnpm --filter @uwe/engine-connector-client test      # App-Frontend (node --test)
pnpm --filter @uwe/host-command-center test          # rekursiv (seit PR #91)
pnpm --filter @uwe/engine-connector test             # rekursiv, vollständig
cargo fmt --check; cargo clippy --all-targets -- -D warnings   # in src-tauri/
```

Rust-Tests existieren nur für die Config-Normalisierung in `lib.rs`;
`command_center.rs` und `process_guard.rs` sind ungetestet. Keine E2E für die
App. Vor dem Push gezielt `npx eslint <pfade>` — `pnpm lint` friert Warnungen
per `--max-warnings` exakt ein, jede neue bricht die CI.

## Typische Aufgaben

| Aufgabe | Weg |
|---|---|
| „Seite ist offline" | Läuft die App? (Dienste sterben mit ihr.) Dann `desktop-host-cli.ts status`, dann Tunnel (`cloudflare-tunnel-cli.ts status`) |
| CLI-/Worker-Fix ausliefern | `git pull` + Worker-Neustart bzw. nächster CLI-Aufruf — kein Rebuild |
| Rust-/UI-Fix ausliefern | `pnpm tauri build` + NSIS `/S`-Reinstall (Block oben) |
| Neues Config-Feld | Rust-Struct + Zod-Schema + ggf. Spawn-Env in `start_connector` — alle drei |
| Neue Ops-Aktion | `ops-cli.ts` + `OPS_ACTIONS` (Rust) + `OpsAction`-Union (`tauri.ts`) |
| Neuer Dienst | `HOST_SERVICE_IDS` + alle vier Kopien + `open`-Meldung + Log-Whitelist |
| Modell taucht im Studio nicht auf | `enabledForUwe` im Model-Store? Discovery läuft vor jedem Heartbeat (~15 s); Ollama-Hysterese hält alte Stände bis 5 min |
| Release schneiden | `pnpm release:version X.Y.Z --pr`, Merge, dann `uwe-windows-release.yml` per `workflow_dispatch` — die Pipeline erzeugt den Tag |

Depth: `docs/command-center.md`, `docs/engine-connector.md`,
`docs/engineering/engine-rename-migration.md`, `references/architektur.md`
