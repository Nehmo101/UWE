# Umsetzungspakete: UWE Brain + Mail + Cloudflare + RTX-Inferenz

Diese Datei teilt die Umsetzung in sinnvolle Cursor-Pakete. Cursor soll nicht alles in einem riesigen Schritt bauen.

## Reihenfolge

```txt
0. Repo-Analyse und technische Bestandsaufnahme
1. Production Host Baseline für alten Laptop
2. Cloudflare + Auth Hardening
3. Mail Center
4. Brain Knowledge Store
5. Inference Connector zum RTX-Rechner
6. AI Run History
7. Context Builder
8. Review/Apply/Undo
9. Erste Brain-Aktionen
10. Embedding Pipeline / Vektorindex
11. Admin Status Dashboard
12. Job Queue finalisieren
13. Dokumentation, Tests, Hardening
```

## Paket 0: Repo-Analyse und Bestandsaufnahme

Ziel: Cursor soll zuerst verstehen, wie UWE aktuell gebaut ist.

Prüfen:

- Framework und Routing
- Datenbank/ORM
- Auth/Login-Status
- vorhandene Settings-Struktur
- vorhandene Job-/Log-Struktur
- vorhandene Mail-/Notification-Struktur
- vorhandene AI-/Provider-Struktur
- Docker/Windows/Production-Start
- Player Preview Sichtbarkeitsregeln
- vorhandene Tests

Output:

- kurze technische Analyse
- Liste bestehender Anknüpfpunkte
- Risiken
- Umsetzungsplan je Paket

## Paket 1: Production Host Baseline für alten Laptop

Ziel: UWE läuft stabil auf dem alten Laptop.

Umsetzen:

- Produktionsstart dokumentieren
- Healthcheck Endpoint
- persistente Datenpfade
- Upload-/Media-Pfad
- Backup-Pfad
- `.env.example` erweitern
- Start/Stop/Restart kompatibel mit Windows/Linux
- Autostart nach Neustart vorbereiten
- keine Demo-Daten in Production erzwingen

Akzeptanz:

- UWE startet im Production Mode.
- Daten bleiben nach Neustart erhalten.
- Healthcheck zeigt App/DB/Storage Status.
- Konfiguration ist über `.env` möglich.

## Paket 2: Cloudflare + Auth Hardening

Ziel: UWE funktioniert sicher hinter Cloudflare Tunnel.

Umsetzen:

- `PUBLIC_APP_URL`
- `TRUST_PROXY`
- sichere Cookies hinter HTTPS Proxy
- Studio Login erzwingen
- Player Preview Sicherheitsmodus
- Warnung bei öffentlichem Studio ohne Auth
- Dokumentation Cloudflare Tunnel
- optional Cloudflare Access Hinweise

Akzeptanz:

- `https://uweanddragons.org` kann UWE öffnen.
- Login funktioniert hinter Cloudflare.
- Cookies funktionieren korrekt.
- Studio ist nicht anonym erreichbar.
- Player Preview leakt keine DM-only Inhalte.

## Paket 3: Mail Center

Ziel: Mail ist als Pflichtmodul verfügbar.

Umsetzen:

- SMTP Settings serverseitig
- Secrets sicher speichern oder über ENV laden
- Testmail
- Mail Templates
- Empfängergruppen
- Spieler-Kontakte/Adressen anbinden, falls vorhanden
- Mail Compose Dialog
- Session-Recap-Mail vorbereiten
- Handout-Mail vorbereiten
- Player-Preview-Link-Mail vorbereiten
- Mail Log
- Fehlerdiagnose

Datenmodell grob:

```txt
MailAccountConfig
MailTemplate
MailRecipientGroup
MailRecipient
MailMessageLog
MailAttachmentRef
```

Akzeptanz:

- Testmail kann gesendet werden.
- Mail-Versand wird geloggt.
- Fehler sind sichtbar und verständlich.
- Session-Recap oder Handout kann als Mail vorbereitet werden.
- DM-only Inhalte werden nicht automatisch an Spieler verschickt.

## Paket 4: Brain Knowledge Store

Ziel: Brain-Wissen wird dauerhaft auf dem alten Laptop in UWE gespeichert.

Umsetzen:

- Brain-Dokumente
- Brain-Chunks
- Brain-Fakten
- Brain-Links
- Sichtbarkeit je Eintrag
- Quelle/Origin je Eintrag
- Vertrauens-/Statusfeld
- Änderungszeitpunkt
- Bezug zu Welt/Kampagne/Session/Objekt

Datenmodell grob:

```txt
BrainDocument
BrainChunk
BrainFact
BrainLink
BrainSource
BrainVisibility: dm_only | player_visible | public
BrainStatus: draft | reviewed | canonical | deprecated
```

Akzeptanz:

- Brain-Wissen liegt in UWE DB/Storage.
- Es gibt keine dauerhafte Brain-Datenhaltung auf dem RTX-Rechner.
- Brain-Einträge können Objekten zugeordnet werden.
- Sichtbarkeit wird gespeichert.

## Paket 5: Inference Connector zum RTX-Rechner

Ziel: UWE kann lokale Modelle auf dem RTX-Rechner nutzen.

Umsetzen:

- Provider Interface
- MockProvider
- Ollama Provider
- OpenAI-compatible Provider für LM Studio
- Healthcheck
- Modellliste, falls Provider unterstützt
- Timeout Handling
- Offline Status
- Settings UI oder ENV-Konfiguration
- keine Secrets im Frontend

ENV-Idee:

```env
AI_INFERENCE_PROVIDER=ollama
AI_INFERENCE_BASE_URL=http://192.168.178.50:11434
AI_INFERENCE_DEFAULT_MODEL=qwen2.5-coder:7b
AI_INFERENCE_TIMEOUT_SECONDS=120
AI_INFERENCE_ALLOW_PUBLIC_URL=false
```

Akzeptanz:

- UWE erkennt, ob RTX-Brain online ist.
- UWE kann einen Testprompt ausführen.
- RTX offline verursacht keinen Crash.
- Endpoint wird nicht öffentlich benötigt.

## Paket 6: AI Run History

Ziel: Alle KI-Läufe sind nachvollziehbar.

Umsetzen:

- AiRun
- AiRunContextItem
- AiRunResult
- AiRunError
- Statusmodell
- Run Detail UI
- Ergebnis kopieren/exportieren
- Provider/Modell speichern
- Dauer/Token Usage speichern, falls verfügbar

Status:

```txt
pending
running
completed
failed
cancelled
applied
discarded
```

Akzeptanz:

- Jeder Run ist später sichtbar.
- Prompt, Kontext, Ergebnis und Fehler sind einsehbar.
- Nichts wird durch AI Run automatisch überschrieben.

## Paket 7: Context Builder

Ziel: UWE baut automatisch passenden Kontext.

Umsetzen:

- Kontext je Aktion sammeln
- Welt/Kampagne/Session berücksichtigen
- verlinkte Objekte berücksichtigen
- Brain Knowledge Store durchsuchen
- Sichtbarkeit filtern
- Token-/Längenbudget
- Quellenhinweise
- Debug-Ansicht: welcher Kontext wurde genutzt?

Akzeptanz:

- Session-Prep sammelt relevante Sessiondaten.
- Kanonprüfung sammelt relevante Kanon-Fakten.
- Mail/Handout-Kontext enthält keine DM-only Daten, außer explizit bestätigt.

## Paket 8: Review/Apply/Undo

Ziel: KI-Ergebnisse werden kontrolliert übernommen.

Umsetzen:

- GeneratedPatch Modell
- ApplyLog
- Vorschläge anzeigen
- übernehmen
- teilweise übernehmen, falls machbar
- verwerfen
- erneut generieren
- optional Snapshot vor Apply

Akzeptanz:

- KI-Ergebnisse ändern nicht blind produktive Daten.
- Übernahme wird geloggt.
- Verwerfen ist möglich.
- Undo/Snapshot ist vorbereitet oder umgesetzt.

## Paket 9: Erste Brain-Aktionen

Ziel: Direkt nutzbare UWE-Brain-Features.

Erste Aktionen:

1. Session Recap erstellen
2. Nächste Session vorbereiten
3. Wissenstext erweitern
4. Kanon-Konfliktprüfung
5. Spieler-Handout erstellen
6. Dungeonraum füllen
7. Mail aus Recap/Handout vorbereiten

Akzeptanz:

- Mindestens drei Aktionen funktionieren end-to-end.
- Ergebnisse landen in AI Run History.
- Ergebnisse sind Vorschläge.
- Mail kann aus einem KI-Ergebnis vorbereitet werden.

## Paket 10: Embedding Pipeline / Vektorindex

Ziel: Semantische Brain-Suche.

Umsetzen:

- Chunking
- Embedding Provider
- Speicherung der Vektoren in UWE
- Reindex Job
- Suche nach relevanten Chunks
- Fallback ohne RTX

Wichtig:

- RTX darf Embeddings berechnen.
- UWE speichert die Vektoren dauerhaft.
- RTX speichert keine UWE-Daten dauerhaft.

Akzeptanz:

- Brain-Chunks können indexiert werden.
- Relevante Chunks können gefunden werden.
- Index liegt bei UWE.

## Paket 11: Admin Status Dashboard

Ziel: Sofort sehen, ob das Zwei-Maschinen-Setup funktioniert.

Anzeigen:

```txt
UWE: online
Database: OK
Storage: OK
Cloudflare Mode: aktiv/konfiguriert
Auth: aktiv
Mail: OK/Fehler
Brain Store: OK
RTX Inference: online/offline
Aktuelles Modell
Letzter AI Run
Fehlgeschlagene Jobs
Offene Vorschläge
```

Akzeptanz:

- Admin sieht Brain/Mail/Cloudflare Status zentral.
- Fehler enthalten sinnvolle nächste Schritte.

## Paket 12: Job Queue finalisieren

Ziel: Längere Tasks blockieren UWE nicht.

Jobs:

- Mail senden
- AI Run
- Embeddings berechnen
- Reindex
- Import verarbeiten
- Backup
- Kanonprüfung

Akzeptanz:

- Jobs haben Status.
- Fehler werden geloggt.
- UI hängt nicht bei langen Brain-Tasks.

## Paket 13: Dokumentation, Tests, Hardening

Ziel: Wartbar und sicher.

Tests:

- Mail Config ohne Secrets im Frontend
- Testmail Fehlerfall
- Brain offline
- MockProvider
- Ollama Provider Fehler
- Context Builder Sichtbarkeit
- AI Run History
- Review/Apply
- Player Preview DM-only Schutz

Dokumentation:

- Setup alter Laptop
- Setup Cloudflare
- Setup RTX-Rechner mit Ollama/LM Studio
- Mail Setup
- Brain Setup
- Backup/Restore
- Troubleshooting
