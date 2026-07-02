# Review: „Bestandsaufnahme RTX Connector Client" (PDF, 2026-07-02)

Stand: 2026-07-02 · Branch `claude/pdf-analysis-uwe-edx1wj` · Jede Aussage der externen
Bestandsaufnahme wurde gegen den aktuellen Code geprüft (fünf parallele Verifikations-Pässe:
Architektur/Security, Scheduling/Routing, Tests, Desktop-UI, Schwächen).

## Gesamturteil

Die Bestandsaufnahme ist **ehrlich, sorgfältig und zu ~90 % exakt** — erkennbar aus echter
Codebase-Analyse entstanden. Die Gesamtbewertung („architektonisch solide, Beta-reif für
Ollama + Soundboard + Label-Druck") trägt. Alle acht gemeldeten Schwächen bestanden zum
Prüfzeitpunkt unverändert; keine war zwischenzeitlich behoben.

## Bestätigte Kernaussagen (Auswahl)

| Aussage | Beleg |
|---------|-------|
| Zwei-Schichten-Stack: headless Core + Tauri-2-App | `tools/uwe-rtx-connector/src/index.ts`, `apps/rtx-connector-client/src-tauri/Cargo.toml` (`tauri = "=2.0.0"`) |
| Outbound-only, kein inbound Server im Core | einziger Pfad: Bearer-`fetch` in `host-client.ts`; Polling `runner.ts` (`setInterval` → `pollOnce`) |
| Token `uwec_…`, nur SHA-256-Hash auf dem Host | `packages/connector/src/token.ts`, `connector-service.ts` (`createConnector`) |
| Eigener Rate-Limit-Bucket | `packages/security/src/security/rate-limit.ts` (`connector: 240/min`) |
| Strikte Datengrenze bei Claim-Jobs | `apps/studio/app/api/connectors/claim-job/route.ts` |
| Konservative Capabilities | `tools/uwe-rtx-connector/src/local-capabilities.ts` (Stubs nie beworben) |
| Legacy-Inbound-Agent entfernt (P6) | `tools/uwe-rtx-agent/` existiert nicht; `api/inference/hardware` → **410 Gone** |
| Offline-Degradation mit Meldungen | `packages/connector/src/degraded.ts`, Soundboard-/AI-UI |
| aiRouter: Connector-Queue bevorzugt, Fallback `AI_INFERENCE_BASE_URL` | `packages/ai-brain/src/router/aiRouter.ts` |
| 13 Worker-Testdateien, 4 in `@uwe/connector`, kein Live-E2E Worker↔Host, Tauri-App ungetestet | gezählt/verifiziert |
| Desktop-UI: 8-Schritt-Wizard, Host-Test, Cookbook-Fit-Scores, HF-Downloads, Tray+Autostart, `ConnectorShell` | `apps/rtx-connector-client/src/**` |

## Korrekturen an der Bestandsaufnahme

1. **„Timing-safe Verifikation" ist überzeichnet.** Der `timingSafeEqual`-Helper
   (`token.ts`) existiert und ist getestet, wird aber im Live-Auth-Pfad **nicht** benutzt:
   `authenticate()` macht einen indizierten `findUnique({ where: { tokenHash } })`.
   Sicherheitsniveau bleibt in Ordnung (SHA-256-Preimage-Resistenz), aber die Aussage
   beschreibt einen ungenutzten Helper. → `docs/connector-security.md` präzisiert.
2. **Concurrency-Zahlen falsch.** Nur die `audio`-Lane erlaubt 4 parallele Jobs;
   `spotify` = 1 (wie `gpu`). Es gibt fünf Lanes (audio, spotify, gpu, printing,
   maintenance), nicht drei. Kein explizites Anti-Starvation — ergibt sich aus
   Priorität + Lane-Trennung (`packages/connector/src/job-types.ts`).
3. **Testzahlen ungenau.** `connector-service.test.ts` hat 48 `assert.*`-Aufrufe
   (`node:assert/strict`, nicht `expect`) und läuft gegen eine **echte Test-DB**, nicht
   gegen Mocks; `queue-logic.test.ts` testet reine Funktionen ohne DB.
4. **„Drei parallele Inference-Pfade" nur halb richtig.** `RTX_AGENT_URL` ist kein
   lebender LLM-Pfad mehr, sondern deprecated Alias für Image-Worker-Pfad +
   LAN-Boundary + Health. Faktisch zwei LLM-Pfade + ein Legacy-Alias.
5. **Von der PDF unerwähnt, aber vorhanden:** Capability-Allowlist-Durchsetzung
   (`allowedCapabilities`, ADR 2026-06-26), `JobsPanel`/`LogsPanel`/`SecurityPanel`
   im Desktop-Client.

## Abweichende Priorisierung

- **Privacy Mode** war nicht nur Feature-Gap, sondern ein **stiller Erwartungsbruch**:
  UI und `connector-client-config` versprachen reduzierte Metadaten, der Worker las die
  Variable nie. → in diesem Branch behoben (Worker liest `UWE_CONNECTOR_PRIVACY_MODE`,
  Heartbeats senden nur noch Routing-Minimum).
- **Schema-Drift höher gewichten als „mittelfristig":** `reported_capabilities` /
  `allowed_capabilities` existierten nur per Raw-Migration und fehlten im Prisma-Modell —
  jede künftige Migration konnte die Spalten unbemerkt gefährden. → in diesem Branch
  ins Schema aufgenommen, Raw-SQL reduziert.
- **`file_cache`-Doku korrigiert:** Capability ist Protokoll-Reservierung ohne Executor
  und ohne Job-Typ; die Capability-Tabelle behauptete „backed by an implementation".

## Offen (bewusst nicht in diesem Durchgang)

Eigenständige Features mit eigenem Design-Bedarf, Priorisierung der PDF-Kurzfristliste
bleibt sonst gültig:

1. LM-Studio-/llama.cpp-Executor (OpenAI-kompatibler Chat/Embeddings-Pfad)
2. Audio-Stop/-Volume real implementieren (Prozess-Tracking statt Acknowledgement)
3. Connector-E2E-Smoke in CI (Worker starten → Heartbeat → `llm_generate` enqueue/complete)
4. Erstes gebündeltes Image-Backend; Linux/macOS-Tauri-Targets; Auto-Update
