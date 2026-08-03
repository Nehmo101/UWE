# Umzug: RTX-Namen raus (2026-08)

„RTX“ ist eine NVIDIA-Produktlinie. UWE hat nie eine davon vorausgesetzt — die
lokale Inferenz spricht Ollama, LM Studio oder jeden OpenAI-kompatiblen Server
an, und ein guter Teil des Maschinenraums (OCR, Audio, Spotify, Diktat,
Etikettendruck) läuft ohnehin auf der CPU. Der Name legte trotzdem das Gegenteil
nahe, deshalb ist er jetzt vollständig verschwunden: aus der Oberfläche, aus den
Bezeichnern, aus den Pfaden, aus den Env-Vars und aus den DB-Enums.

Das Vokabular ist ab sofort **Maschinenraum** (Produktname, UI) und
**`engine…` / `ENGINE_…`** (Code, Pfade, Env-Vars).

Der Umzug ist **nicht abwärtskompatibel**. Ein laufender Host braucht einmalig
die Schritte unten. Was automatisch läuft, ist markiert.

## Was sich geändert hat

| Was | Alt | Neu |
|---|---|---|
| Worker-Ordner | `tools/uwe-rtx-connector` | `tools/uwe-engine-connector` |
| Desktop-App | `apps/rtx-connector-client` | `apps/engine-connector-client` |
| Paketname (App) | `@uwe/rtx-connector-client` | `@uwe/engine-connector-client` |
| Paketname (Worker) | `@uwe/rtx-connector` | `@uwe/engine-connector` |
| systemd-Unit | `uwe-rtx-connector.service` | `uwe-engine-connector.service` |
| Host-State | `/var/lib/uwe/rtx-connector` | `/var/lib/uwe/engine-connector` |
| Windows-Daten | `%LOCALAPPDATA%\UWE\rtx-connector-client` | `%LOCALAPPDATA%\UWE\engine-connector-client` |
| Linux-Daten | `~/.local/share/UWE/rtx-connector-client` | `~/.local/share/UWE/engine-connector-client` |
| Runtime-Rolle | `UWE_RUNTIME_ROLE=rtx-connector` | `UWE_RUNTIME_ROLE=engine-connector` |
| Studio-API | `/api/worlds/<welt>/soundboard/rtx` | `/api/worlds/<welt>/soundboard/engine` |
| DB-Enum | `ConnectorType.rtx_connector` | `ConnectorType.engine_connector` |
| DB-Enum | `ScanDocumentStatus.waiting_for_rtx` | `ScanDocumentStatus.waiting_for_engine` |

### Env-Vars

Jede `RTX_*`-Variable heißt jetzt `ENGINE_*`. Es gibt **keinen Fallback** auf
die alten Namen — eine `.env` mit `RTX_BASE_URL` wird stillschweigend ignoriert,
und UWE verhält sich, als wäre kein Worker konfiguriert.

| Alt | Neu |
|---|---|
| `RTX_BASE_URL` | `ENGINE_BASE_URL` |
| `RTX_SERVICE_TOKEN` | `ENGINE_SERVICE_TOKEN` |
| `RTX_HMAC_SECRET` | `ENGINE_HMAC_SECRET` |
| `RTX_USE_CONNECTOR_IMAGE` | `ENGINE_USE_CONNECTOR_IMAGE` |
| `RTX_HEALTHCHECK_INTERVAL_MS` | `ENGINE_HEALTHCHECK_INTERVAL_MS` |
| `RTX_TIMEOUT_MS` | `ENGINE_TIMEOUT_MS` |
| `RTX_MAX_RETRIES` | `ENGINE_MAX_RETRIES` |
| `RTX_AGENT_URL`, `RTX_AGENT_TOKEN` | `ENGINE_AGENT_URL`, `ENGINE_AGENT_TOKEN` (Legacy-Pfad) |
| `RTX_ATLAS_ASSET_CATALOG_PATH` | `ENGINE_ATLAS_ASSET_CATALOG_PATH` |
| `RTX_ATLAS_ASSET_STYLEGUIDE_PATH` | `ENGINE_ATLAS_ASSET_STYLEGUIDE_PATH` |

**Unverändert**, weil sie den alten Markennamen nie trugen: `UWE_CONNECTOR_*`,
`UWE_HOST_URL`, `AI_INFERENCE_*`, das Token-Präfix `uwec_…` und alle
Connector-Tokens selbst. Tokens müssen **nicht** neu ausgestellt werden.

## UWE-Host (Linux, systemd)

1. Aktualisieren und die Datenbanken migrieren:

   ```bash
   cd /opt/uwe
   git pull
   pnpm install
   pnpm --filter @uwe/database db:deploy
   pnpm --filter @uwe/database db:deploy:family
   ```

   Die beiden Migrationen `20260803180000_engine_rename_connector_type` und
   `20260803180000_engine_rename_scan_status` schreiben die Enum-Werte der
   Bestandszeilen um. Registrierte Connectors und Dokumente im Scan-Eingang
   bleiben erhalten.

2. `.env` durchsehen und jede `RTX_`-Zeile auf `ENGINE_` umstellen:

   ```bash
   sed -i 's/^RTX_/ENGINE_/' /opt/uwe/.env
   ```

3. Setup-Skript laufen lassen — es übernimmt Unit, State-Ordner und die
   Connector-`.env` **automatisch** (`migrate_legacy_engine_connector` in
   `deploy/scripts/lib/uwe-host-connector-install.sh`):

   ```bash
   sudo ./deploy/scripts/setup-uwe-host.sh
   ```

   Dabei wird `uwe-rtx-connector.service` gestoppt, deaktiviert und entfernt,
   `/var/lib/uwe/rtx-connector` nach `/var/lib/uwe/engine-connector` verschoben
   und `tools/uwe-rtx-connector/.env` nach `tools/uwe-engine-connector/.env`.

4. Prüfen:

   ```bash
   systemctl status uwe-engine-connector.service
   ```

## Command Center (Desktop-App)

Beim ersten Start nach dem Update **automatisch**:

- Das Datenverzeichnis `…/UWE/rtx-connector-client` wird nach
  `…/UWE/engine-connector-client` umbenannt — samt `host/`, also inklusive
  `uwe.db`, Uploads, Backups und Logs (`migrate_legacy_app_data_dir`).
- Der alte Linux-Autostart-Eintrag `uwe-rtx-connector-client.desktop` wird
  entfernt, der alte Windows-Registry-Wert „UWE RTX Connector Client“ ebenfalls.

Der Tauri-Bundle-Identifier heißt jetzt `local.uwe.engine-connector-client`.
Windows und Linux behandeln die App damit als neue Installation: **die alte
Version vorher deinstallieren**, sonst stehen beide parallel im Startmenü. Die
Daten sind davon nicht betroffen, die liegen außerhalb des Installationsordners.

## Maschinenraum-Rechner (Worker)

Läuft der Worker auf einem eigenen PC:

```bash
cd <uwe-checkout>
git pull
pnpm install
sed -i 's/^RTX_/ENGINE_/' tools/uwe-engine-connector/.env   # falls vorhanden
```

Liegt die alte `.env` noch unter `tools/uwe-rtx-connector/.env`, vorher
herüberkopieren — `git pull` löscht keine unversionierten Dateien, legt sie
aber auch nicht am neuen Ort an.

## Kontrolle

Nach dem Umzug darf nichts mehr auf den alten Namen zeigen:

```bash
grep -rin "rtx" /opt/uwe --exclude-dir=node_modules --exclude-dir=.git
```

Erwartete Treffer sind nur die Migrations-Dokumente und die Legacy-Literale, die
absichtlich stehen bleiben, damit Bestandsinstallationen gefunden werden:

- `LEGACY_AUTOSTART_VALUE_NAME` (Windows-Registry) in
  `apps/engine-connector-client/src-tauri/src/lib.rs`
- `LEGACY_APP_NAME_DIR`, `LEGACY_AUTOSTART_DESKTOP_FILE` ebenda
- `LEGACY_CONNECTOR_UNIT`, `LEGACY_CONNECTOR_ENV_REL` in
  `deploy/scripts/lib/uwe-host-connector-install.sh`
- `LEGACY_APP_DIR` in `tools/uwe-host-command-center/src/desktop-host-paths.ts`
- die `UPDATE`-Zeilen in den beiden Enum-Migrationen

`startxref` in `packages/database/src/label-export.ts` und `startX` im
Label-Editor sind zufällige Treffer und haben mit dem Thema nichts zu tun.
