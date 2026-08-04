# Command Center — Architektur-Referenz

Handgepflegt; Stand 2026-08-04 (HEAD `692f0440`). Bei Widerspruch gewinnt der Code.

## Spawn-Tabelle (wer ruft wen)

| Zweck | Rust-Aufrufer | Kommando |
|---|---|---|
| Worker (Dauerprozess) | `lib.rs` `start_connector` | `node --import tsx tools/uwe-engine-connector/src/desktop-launcher.ts` |
| Client-CLI (one-shot) | `lib.rs` | `node --import tsx tools/uwe-engine-connector/src/client-cli.ts <cmd>` |
| HuggingFace-Pull | `lib.rs` | `node --import tsx tools/uwe-engine-connector/src/huggingface-cli.ts pull …` |
| Host-Steuerung | `command_center.rs` | `node tools/uwe-host-command-center/src/desktop-host-cli.ts <aktion> --root <root>` — **ohne** tsx! |
| Bundle-Fallback | `command_center.rs` | `<resources>/host-runtime/node.exe host-cli.cjs <aktion>` (nur im Release-Bundle befüllt) |
| Benutzer | `command_center.rs` | `node --import tsx … user-admin-cli.ts <aktion>` (Passwörter nur via stdin) |
| Cloudflare | `command_center.rs` | `node --import tsx … cloudflare-tunnel-cli.ts <aktion>` |
| Ops-Brücke | `command_center.rs` | `node --import tsx … ops-cli.ts <aktion>` (27 whitelisted Aktionen, Payload via stdin) |

Alle Kinder `CREATE_NO_WINDOW`; nur `open` zusätzlich `CREATE_BREAKAWAY_FROM_JOB`.
Worker-Env: `UWE_RUNTIME_ROLE=engine-connector`, `UWE_HOST_URL`, `UWE_CONNECTOR_TOKEN`,
`UWE_CONNECTOR_{NAME,CLIENT_DATA_DIR,TRANSPORT,QUEUE_ENABLED,PRIVACY_MODE,AUDIO_CMD,IMAGE_CMD,PRINT_CMD}`, `SPOTIFY_*`.
Host-CLI-Env: `UWE_MONOREPO_ROOT`, `UWE_COMMAND_CENTER_DATA_DIR`, `UWE_COMMAND_CENTER_VERSION` (aus `CARGO_PKG_VERSION`).

Protokoll Rust ↔ CLI: NDJSON auf stdout — `{type:"progress",…}`-Zeilen bei
`setup`/`update`, genau eine `{type:"result",payload:…}` am Ende
(Parser: `extract_result_payload`, `command_center.rs` — ungetestet).

## Tauri-Commands (61, gruppiert)

- **Lebenszyklus/Config** (`lib.rs`): `exit_app` (Tunnel→Dienste→exit), `read_config`, `write_config` (normalisiert + `sync_autostart`), `get_connector_status`, `start_connector`, `stop_connector`, `test_host_connection`
- **Modelle/Drucker/Runner** (via `client-cli.ts`): `get/save_model_store`, `scan_models`, `get/save_printer_store`, `scan_printers`, `pull_ollama_model` (streamt `ollama-pull-progress`), `delete_ollama_model`, `pull_huggingface_model`, `list_connector_jobs`, `list_connector_logs`, `cookbook_dashboard`, `probe_runners`, `start_ollama`, `test_runner`
- **Spotify/Executoren**: `spotify_{auth_url,exchange_code,devices,set_device,test,disconnect}`, `test_{audio,image,print}`
- **Host** (`command_center.rs`, via `desktop-host-cli.ts`): `get_host_status`, `setup_host`*, `start_host`, `stop_host`, `restart_host`, `backup_host`, `get_host_logs`, `open_host_target`, `check_host_update`, `update_host`*, `get/set_host_env`, `get/set_install_selection`, `start/stop/restart_service`, `list_backups`, `restore_backup` (* = streamend, Event `host-action-progress`)
- **Benutzer**: `list/create/update/delete_user`, `set_user_password`
- **Cloudflare**: `cloudflare_{status,set_token,clear_token,start,stop}`
- **Ops**: `ops_invoke` — eine Brücke für alle 27 Ops-Aktionen

Frontend-Bridge: `src/lib/tauri.ts` (einzige invoke-Stelle; Browser-Fallback
`tauri-browser-mock.ts` mit localStorage). Routen/Panels: `src/app-runtime.ts`
+ `App.tsx`; Haupt-Panel `CommandCenterPanel` (Polling 15 s, pausiert während
Aktionen) → `CommandCenterOverview` + `CommandCenterMaintenance` („Lokales
Hosting" = dritte Disclosure-Section mit den 5 Schaltern).

## config.json (Ort: `%LOCALAPPDATA%\UWE\engine-connector-client\config.json`)

Doppelt definiert: Rust `ConnectorClientConfig` (`lib.rs`, camelCase) und Zod
(`packages/connector-client-config/src/config.ts`). **Rust filtert beim
Speichern** — Felder ohne Rust-Gegenstück gehen verloren.

Felder (Default): `hostUrl` (""), `token` (""), `name` ("UWE Maschinenraum"),
`transportMode` (queue|direct|hybrid, "queue"), `queueEnabled` (abgeleitet:
`≠ direct`), `wizardCompleted` (false), `installWizardCompleted` (false, ⚠ nur
Zod), `autoConnect` (true), `minimizedStart` (false), `autostartWindows`
(false), `trayMode` (minimize_to_tray), `privacyMode` (false),
`spotifyClientId/Secret/RedirectUri`, `audioCommand`, `imageCommand`,
`sttCommand` (⚠ nur Zod), `printCommand`, `defaultPrinterId`, `localHostRoot`,
`autoStartHost` (false), `autoStartTunnel` (false), `stopServicesOnExit`
(**true**, gilt auch für Alt-Configs ohne das Feld).

Host-URL-Validierung: nur http(s); `http` ausschließlich für Loopback.
Autostart: `HKCU\…\Run` „UWE Command Center", synchronisiert **nur** aus
`write_config` — nicht beim App-Start (Falle nach Neuinstallation).

## Setup-Plan (`setup-plan.ts`, Reihenfolge)

1. `pnpm install --frozen-lockfile`
2. `pnpm --filter @uwe/database db:generate`
3. `db:deploy` (immer) · `db:deploy:brain` / `db:deploy:family` (nur wenn gewählt)
4. `db:seed` mit `UWE_ALLOW_PROD_SEED=1` (nur `seedDemoContent` + frische DB)
5. `provision-local-connector.ts` (Connector „UWE Command Center (lokal)", rotiert Token, sichert Remote-Config)
6. je gewählter App `pnpm --filter @uwe/<app> build`
7. `scripts/materialize-standalone-prisma-deps.mjs` (static/ + public/ + Prisma in den Standalone-Baum)

`pnpm` läuft über einen `corepack pnpm`-Shim in `host\runtime\bin`;
`CI=true`, `TURBO_DAEMON=false`. `.env`-Vorlage: `buildLocalHostEnv`
(`host-env-file.ts`) — Secrets random, KI-Defaults Ollama; nie überschreibend.
Portwechsel ziehen die Loopback-`NEXT_PUBLIC_*`-URL mit (`companionUrlUpdates`),
öffentliche Tunnel-URLs nie.

## Update-Kontrakt

- `check-update`: Monorepo → `git fetch --tags`, neuester `uwe-v*`-Tag; ohne
  Tag Fallback `HEAD` vs `origin/main`. Bundle → `uwe-release.json` des
  neuesten GitHub-Releases (ohne git/gh auf dem Zielrechner).
- `update`: Stop (falls lief) → `syncRepositoryToTarget` (stash bei dirty;
  Tag → detach; main → ff oder `checkout -B` + Backup-Ref
  `refs/backup/command-center-before-update/<ts>`) → kompletter Setup-Plan →
  Start. Liegt die App selbst zurück: NSIS-Installer-URL wird geöffnet.
- Versionsquelle der App: `CARGO_PKG_VERSION` — Release-Bump muss
  `src-tauri/Cargo.toml` mitnehmen; `pnpm release:version X.Y.Z --pr` setzt
  alle fünf Stellen (PR #44).
- Release baut `uwe-windows-release.yml`; **die Pipeline erzeugt den Tag nach
  grünem Build**, Tag-Push ist nur Nachbau-Eingang.

## Worker-Protokoll (`tools/uwe-engine-connector`)

Outbound-only, Bearer-Token, 10 s Timeout: `POST /api/connectors/heartbeat`
(alle 15 s; Discovery **vor jedem** Heartbeat), `claim-job` (Poll 2 s, nur
transportMode ≠ direct), `jobs/:id/complete|fail`. 401/403 ⇒ sofortiger Stop
(Token tot), sonst Backoff bis 60 s. Direct-Transport: NDJSON-Stream mit
Reconnect 1→30 s. Host-URL kommt ausschließlich aus `UWE_HOST_URL` (nirgends
hartkodiert); `http://` nur für Loopback erlaubt.

Lanes (Concurrency): audio 4 · spotify 1 · gpu 1 · printing 1 · maintenance 1.
Job-Typen (16): `sound_play/stop/stop_all/volume`, `spotify_*` (4),
`label_print`, `printer_discover`, `connector_refresh_models`, `llm_generate`
(Default `llama3.2`), `audio_transcribe` (`UWE_CONNECTOR_STT_CMD`),
`vision_extract` (Default `frob/unlimited-ocr:q8_0`), `image_generate`,
`embedding_generate` (`nomic-embed-text`). Job-Timeout 120 s.

Gemeldet werden **nur `enabledForUwe`-Profile** aus `model-store.json`
(`<dataDir>`, Fallback `~/.uwe-engine-connector` — ⚠ ohne Lese-Rückfall auf
`~/.uwe-rtx-connector`). Capabilities nur für `status: ready` + ausführbaren
Provider (ollama/lmstudio/llamacpp). Ollama-Ausfall: Hysterese hält den
letzten guten Stand 5 min. `privacyMode` reduziert Metadaten, nie Capabilities.

## Befunde vom 2026-08-04 und ihr Stand

Am 2026-08-04 in vier PRs behoben (#88 Datadir-Migration, #89 Brain-Port,
#90 Rust/App, #91 Host-CLI):

- ~~`installWizardCompleted`/`sttCommand` fallen beim Speichern weg~~ → im
  Rust-Struct, inkl. `UWE_CONNECTOR_STT_CMD`-Durchreichung (#90)
- ~~`stopServicesOnExit: false` wirkungslos~~ → Breakaway-Spawn für
  dienststartende Aktionen; wirkt ab dem nächsten Dienststart (#90)
- ~~Bundle-Erstinstallation unerreichbar~~ → `setup` hat jetzt die
  Checkout/Bundle-Weiche (`setup-action.ts`, #91)
- ~~2 Testdateien liefen nie~~ → rekursiver Runner (#91)
- ~~`open`-Meldung, `cloudflared.log`, Stash-Stapel unsichtbar~~ → Registry-
  Label, Log-Target `cloudflared`, Stash-Hinweis in Update-Meldung (#91)
- ~~`UWE_RUNTIME_ROLE`-Wert ungültig, `root`-Parameter ignoriert~~ → (#90)
- ~~Brain-Port-Widerspruch~~ → `uwe-health.ts` liest `BRAIN_PORT`,
  `.env.production.example` vervollständigt (#89)
- ~~`~/.uwe-rtx-connector` ohne Migrations-Rückfall~~ → einmaliges Rename mit
  Lese-Fallback (#88)

Nachtrag Release-Pipeline (2026-08-04): erstmals End-to-End grün — Lauf 5
(30893069439) erzeugte das **Draft-Release „UWE 0.2.0"** mit allen Assets.
Drei Fehlerschichten mussten vorher weg: Versions-Bump auf 0.2.0 nötig (#98,
0.1.0 war im CHANGELOG vergeben), Idempotenz-Bug in `set-release-version.mjs`
(#99), pnpm reichte `--` wörtlich an die Tauri-CLI durch → cargo brach an
`--bundles` ab (#100); dazu EBUSY-Race in `copy-terra.mjs` (#101, Retry wie
in copy-scenes). **Der Tag `uwe-v0.2.0` entsteht erst beim Veröffentlichen
des Drafts** — bis dahin läuft der Update-Kontrakt auf dem
`origin/main`-Fallback.

Noch offen:

1. Draft-Release „UWE 0.2.0" veröffentlichen (Owner-Entscheidung) — erst
   dann existiert der Tag und der Update-Knopf misst gegen das Release.
2. `glib` <0.20 im Tauri-Cargo-Lock (Dependabot MEDIUM) ist durch die harte
   Pin-Kette `tauri =2.11.5 → gtk ^0.18` nicht fixbar — wartet auf den
   nächsten Tauri-Bump (dokumentiert in PR #94).
3. Untracked Leichen `apps/rtx-connector-client\` (3,8 GB!),
   `tools/uwe-rtx-connector\`, `tools/uwe-rtx-agent\` — verifiziert ohne
   Quellcode, gefahrlos löschbar.
