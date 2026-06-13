# Cursor Copy-Paste-Prompts: UWE Brain + Mail + Cloudflare

Diese Datei enthält direkt nutzbare Cursor-Prompts. Jeder Prompt verweist auf die relevanten Architekturdateien.

Grundregel für alle Prompts:

```txt
UWE ist der alleinige Besitzer aller Daten und allen Brain-Wissens.
Der RTX-Rechner ist nur ein austauschbarer Inference Worker.
Er darf keine UWE-Daten dauerhaft speichern und ist nicht öffentlich erreichbar.
```

## Prompt 0: Repo analysieren und Umsetzungsplan erstellen

```md
Bitte analysiere das UWE Repository und lies zuerst diese Dateien:

- docs/ai-brain-mail/README.md
- docs/ai-brain-mail/ARCHITECTURE.md
- docs/ai-brain-mail/IMPLEMENTATION_PACKAGES.md
- docs/ai-brain-mail/ENV_AND_DEPLOYMENT.md

Ziel:
UWE soll auf einem alten Laptop gehostet und über Cloudflare erreichbar sein. Das gesamte Brain-Wissen bleibt auf dem alten Laptop in UWE gespeichert. Der RTX-Rechner im Heimnetz führt nur LLM-/Embedding-Inferenz aus und speichert keine UWE-Daten dauerhaft. Mail ist ein Pflichtmodul.

Bitte mache zuerst nur eine technische Bestandsaufnahme:

1. Framework, Routing und App-Struktur
2. Datenbank/ORM/Storage
3. Auth/Login-Status
4. Player Preview Sichtbarkeitsregeln
5. vorhandene Settings-Struktur
6. vorhandene Mail-/Notification-Struktur
7. vorhandene AI-/Provider-Struktur
8. vorhandene Job-/Log-Struktur
9. Docker/Windows/Production-Start
10. Tests

Danach bitte einen konkreten Umsetzungsplan ausgeben:

- welche vorhandenen Dateien/Module weiterverwendet werden können
- welche neuen Module nötig sind
- welche Risiken bestehen
- welche Pakete zuerst umgesetzt werden sollten
- welche Tests nötig sind

Bitte noch keine großen Implementierungen durchführen, außer kleine risikoarme Analyse-Hilfen oder TODO-Dokumentation.
```

## Prompt 1: Production Host Baseline für alten Laptop

```md
Bitte implementiere Paket 1 aus:

- docs/ai-brain-mail/IMPLEMENTATION_PACKAGES.md
- docs/ai-brain-mail/ENV_AND_DEPLOYMENT.md

Ziel:
UWE soll stabil auf einem alten Laptop im Production Mode laufen können. Der alte Laptop ist der dauerhafte Host für UWE, Datenbank, Medien, Mail, Brain-Wissen, AI Run History und Cloudflare Tunnel.

Bitte umsetzen:

1. Production-Start prüfen und stabilisieren
2. Healthcheck Endpoint für App/DB/Storage
3. persistente Datenpfade über ENV
4. Upload-/Media-Pfad über ENV
5. Backup-/Export-Pfad über ENV
6. `.env.example` erweitern
7. klare Trennung von Dev und Production
8. keine Demo-Daten in Production erzwingen
9. Start/Stop/Restart-Doku für Windows und Linux ergänzen

Wichtig:
- Noch keine Brain-Features bauen.
- Noch keine Mail-Features bauen.
- Bestehende Funktionen nicht brechen.
- Falls es bereits eine Windows-One-Click-Installer-Struktur gibt, diese respektieren und nicht duplizieren.

Akzeptanz:
- UWE startet im Production Mode.
- Daten bleiben nach Neustart erhalten.
- Healthcheck zeigt App/DB/Storage Status.
- ENV-Konfiguration ist dokumentiert.
- Tests oder mindestens Smoke-Checks sind ergänzt.
```

## Prompt 2: Cloudflare + Auth Hardening

```md
Bitte implementiere Paket 2 aus:

- docs/ai-brain-mail/ARCHITECTURE.md
- docs/ai-brain-mail/IMPLEMENTATION_PACKAGES.md
- docs/ai-brain-mail/ENV_AND_DEPLOYMENT.md

Ziel:
UWE soll sicher hinter Cloudflare Tunnel unter `https://uweanddragons.org` laufen. Cloudflare zeigt nur auf UWE auf dem alten Laptop, niemals auf Ollama/LM Studio/RTX.

Bitte umsetzen:

1. `PUBLIC_APP_URL` Unterstützung
2. `TRUST_PROXY` Unterstützung
3. sichere Cookie-Konfiguration hinter HTTPS Proxy
4. Studio/Auth muss in Production erzwungen werden können
5. Warnung, falls Studio öffentlich ohne Auth läuft
6. Player Preview Sicherheitsmodus prüfen/härten
7. `PLAYER_PREVIEW_PUBLIC`, `PLAYER_PREVIEW_REQUIRE_TOKEN`, `PLAYER_PREVIEW_ALLOW_DM_ONLY` vorbereiten oder passend zur bestehenden Struktur integrieren
8. Dokumentation für Cloudflare Tunnel ergänzen
9. keine direkte Verbindung von Cloudflare zum RTX-Rechner zulassen oder dokumentieren

Wichtig:
- Player Preview darf keine DM-only Inhalte leaken.
- Studio/Admin darf nicht anonym öffentlich erreichbar sein.
- Cloudflare Access darf optional zusätzlich möglich sein, ersetzt aber nicht zwingend UWE-Auth.

Akzeptanz:
- UWE funktioniert hinter Cloudflare/Reverse Proxy.
- Login/Cookies funktionieren mit HTTPS Public URL.
- Studio ist nicht anonym öffentlich erreichbar, wenn AUTH_REQUIRED aktiv ist.
- Player Preview Sichtbarkeit ist abgesichert.
- Doku enthält konkrete ENV-Beispiele.
```

## Prompt 3: Mail Center als Pflichtmodul

```md
Bitte implementiere Paket 3 aus:

- docs/ai-brain-mail/ARCHITECTURE.md
- docs/ai-brain-mail/IMPLEMENTATION_PACKAGES.md
- docs/ai-brain-mail/ENV_AND_DEPLOYMENT.md

Ziel:
UWE braucht ein Mail Center als Pflichtmodul. Für Version 1 reicht Outbound-Mail. Eingehende Mails sind später optional.

Bitte umsetzen:

1. serverseitige SMTP-Konfiguration über ENV und/oder vorhandene Settings-Struktur
2. SMTP Secrets niemals ins Frontend geben
3. Testmail-Funktion
4. Mail Templates
5. Empfängergruppen, insbesondere Spielergruppe
6. Mail Compose Dialog
7. Session-Recap-Mail vorbereiten
8. Handout-Mail vorbereiten
9. Player-Preview-Link-Mail vorbereiten
10. Mail Log mit Status und Fehlern
11. verständliche Fehlerdiagnose
12. Tests für Erfolg und Fehlerfälle

Datenmodell grob:

- MailAccountConfig oder ENV-basierte MailConfig
- MailTemplate
- MailRecipientGroup
- MailRecipient
- MailMessageLog
- MailAttachmentRef, falls Attachments/Handouts schon sinnvoll möglich sind

Sicherheitsregeln:
- Keine SMTP Passwörter im Frontend.
- Logs dürfen keine Secrets enthalten.
- DM-only Inhalte dürfen nicht automatisch an Spieler verschickt werden.
- Bei AI-generierten Mails immer Entwurf/Review vor Senden, außer der User klickt explizit Senden.

Akzeptanz:
- Testmail kann versendet werden.
- Mail-Versand wird geloggt.
- Fehler sind sichtbar.
- Session-Recap oder Handout kann als Mail vorbereitet werden.
- Keine Secrets im Client-Bundle oder API-Response.
```

## Prompt 4: Brain Knowledge Store auf altem Laptop

```md
Bitte implementiere Paket 4 aus:

- docs/ai-brain-mail/ARCHITECTURE.md
- docs/ai-brain-mail/IMPLEMENTATION_PACKAGES.md

Ziel:
Das Brain-Wissen muss dauerhaft auf dem alten Laptop in UWE gespeichert werden. Der RTX-Rechner darf nur Inferenz ausführen und keine UWE-Daten dauerhaft speichern.

Bitte umsetzen:

1. Brain Knowledge Store Datenmodell
2. BrainDocument
3. BrainChunk
4. BrainFact
5. BrainLink/Source/Origin
6. Sichtbarkeit: dm_only, player_visible, public
7. Status: draft, reviewed, canonical, deprecated
8. Bezug zu Welt/Kampagne/Session/Objekt
9. UI oder Admin-Ansicht zum Anzeigen erster Brain-Einträge
10. Server-APIs zum Erstellen/Lesen/Aktualisieren
11. Tests für Sichtbarkeit und Persistenz

Wichtig:
- Brain-Wissen liegt in UWE DB/Storage.
- Keine dauerhafte Speicherung auf RTX.
- Noch keine LLM-Ausführung nötig.
- Sichtbarkeit muss von Anfang an Teil des Modells sein.

Akzeptanz:
- Brain-Einträge können gespeichert werden.
- Brain-Einträge sind UWE-Objekten zuordenbar.
- Sichtbarkeit wird gespeichert und abgefragt.
- Es gibt keine Annahme, dass Brain-Wissen auf dem RTX-Rechner liegt.
```

## Prompt 5: Inference Connector zum RTX-Rechner

```md
Bitte implementiere Paket 5 aus:

- docs/ai-brain-mail/ARCHITECTURE.md
- docs/ai-brain-mail/IMPLEMENTATION_PACKAGES.md
- docs/ai-brain-mail/ENV_AND_DEPLOYMENT.md

Ziel:
UWE läuft auf dem alten Laptop und ruft den RTX-Rechner im Heimnetz nur für Modell-Inferenz auf. Der RTX-Rechner ist ein austauschbarer Worker und speichert keine UWE-Daten dauerhaft.

Bitte umsetzen:

1. AI Provider Interface
2. MockProvider für Tests
3. Ollama Provider
4. OpenAI-compatible Provider für LM Studio
5. Healthcheck für Inference Endpoint
6. Modellliste abrufen, falls Provider das unterstützt
7. Timeout Handling
8. Offline Status
9. Server-seitige API-Routes
10. Settings UI oder ENV-Konfiguration
11. Tests für online/offline/timeout

ENV-Beispiele stehen in:
- docs/ai-brain-mail/ENV_AND_DEPLOYMENT.md

Wichtig:
- Keine Inference Secrets ins Frontend.
- Kein Crash, wenn RTX offline ist.
- Kein öffentlicher Ollama/LM Studio Endpoint.
- `AI_INFERENCE_ALLOW_PUBLIC_URL=false` respektieren oder eine gleichwertige Schutzlogik bauen.

Akzeptanz:
- UWE erkennt RTX-Brain online/offline.
- UWE kann Testprompt an Ollama oder OpenAI-compatible Endpoint senden.
- RTX offline führt zu kontrolliertem Fehlerstatus.
- MockProvider funktioniert in Tests.
```

## Prompt 6: AI Run History

```md
Bitte implementiere Paket 6 aus:

- docs/ai-brain-mail/ARCHITECTURE.md
- docs/ai-brain-mail/IMPLEMENTATION_PACKAGES.md

Ziel:
Jeder KI-Lauf in UWE muss nachvollziehbar gespeichert werden. KI-Ergebnisse dürfen produktive UWE-Daten nicht automatisch überschreiben.

Bitte umsetzen:

1. AiRun Datenmodell
2. AiRunContextItem
3. AiRunResult / Ergebnisfeld
4. AiRunError / Fehlerfeld
5. Statusmodell: pending, running, completed, failed, cancelled, applied, discarded
6. Provider/Modell speichern
7. Prompt und Kontext speichern
8. Dauer und Token Usage speichern, falls verfügbar
9. Run-Liste im AI/Brain-Bereich
10. Run Detail View
11. Ergebnis kopieren/exportieren
12. Tests

Wichtig:
- Ergebnisse sind zunächst Vorschläge.
- Keine automatische Datenänderung durch AI Run.
- Kontext muss später debugbar sein: Was wurde an das Modell geschickt?

Akzeptanz:
- Jeder AI Run ist später sichtbar.
- Prompt, Kontext, Ergebnis und Fehler sind einsehbar.
- Statuswechsel funktionieren.
- Nichts wird ungefragt überschrieben.
```

## Prompt 7: Context Builder

```md
Bitte implementiere Paket 7 aus:

- docs/ai-brain-mail/ARCHITECTURE.md
- docs/ai-brain-mail/IMPLEMENTATION_PACKAGES.md

Ziel:
UWE soll für Brain-Aktionen automatisch passenden Kontext aus der eigenen Datenbank und dem Brain Knowledge Store bauen.

Bitte umsetzen:

1. Context Builder Service
2. Kontext je Aktionstyp sammeln
3. Welt/Kampagne/Session berücksichtigen
4. aktuelles Objekt und verlinkte Objekte berücksichtigen
5. Brain Knowledge Store durchsuchen
6. Sichtbarkeit filtern: dm_only, player_visible, public
7. Token-/Längenbudget
8. Quellenhinweise im Kontext
9. Debug-Ansicht oder Log: welche Kontextteile wurden verwendet?
10. Tests für Sichtbarkeit und Budget

Use Cases:
- Session vorbereiten
- Kanon prüfen
- Wissenstext erweitern
- Spieler-Handout erstellen
- Mail aus Recap/Handout vorbereiten

Wichtig:
- Player-/Mail-Kontext darf keine DM-only Daten enthalten, außer explizit bestätigt.
- Brain-Wissen liegt lokal bei UWE.
- Der RTX-Rechner bekommt nur den final gefilterten Prompt/Kontext.

Akzeptanz:
- Session-Prep sammelt relevante Sessiondaten.
- Kanonprüfung sammelt relevante Kanon-Fakten.
- Mail/Handout-Kontext filtert DM-only korrekt.
- Kontextgröße wird begrenzt.
```

## Prompt 8: Review/Apply/Undo

```md
Bitte implementiere Paket 8 aus:

- docs/ai-brain-mail/ARCHITECTURE.md
- docs/ai-brain-mail/IMPLEMENTATION_PACKAGES.md

Ziel:
KI-Ergebnisse werden in UWE immer zuerst als Vorschlag gespeichert. Der User kann übernehmen, bearbeiten, teilweise übernehmen, verwerfen oder erneut generieren.

Bitte umsetzen:

1. GeneratedPatch Modell oder passende vorhandene Patch-Struktur
2. ApplyLog
3. UI für Vorschläge
4. Button: übernehmen
5. Button: verwerfen
6. Button: erneut generieren
7. optional: manuell bearbeiten und übernehmen
8. optional: Snapshot vor Apply, falls Versionierung vorhanden ist
9. Tests

Wichtig:
- Kein blindes Überschreiben produktiver Daten.
- Apply muss nachvollziehbar sein.
- Wenn Undo noch nicht vollständig möglich ist, mindestens ApplyLog und Snapshot-Hook vorbereiten.

Akzeptanz:
- KI-Ergebnis kann als Vorschlag angezeigt werden.
- Übernahme wird geloggt.
- Verwerfen ist möglich.
- Produktive Daten ändern sich nur durch explizites Apply.
```

## Prompt 9: Erste Brain-Aktionen

```md
Bitte implementiere Paket 9 aus:

- docs/ai-brain-mail/ARCHITECTURE.md
- docs/ai-brain-mail/IMPLEMENTATION_PACKAGES.md
- docs/ai-brain-mail/CURSOR_PROMPTS.md

Voraussetzung:
Brain Knowledge Store, Inference Connector, AI Run History und Context Builder sollten vorhanden oder vorbereitet sein.

Ziel:
Erste produktiv nützliche UWE-Brain-Aktionen bauen.

Bitte implementiere mindestens diese drei end-to-end:

1. Session Recap erstellen
2. Nächste Session vorbereiten
3. Wissenstext erweitern

Danach, falls sinnvoll direkt ergänzen:

4. Kanon-Konfliktprüfung
5. Spieler-Handout erstellen
6. Dungeonraum füllen
7. Mail aus Recap/Handout vorbereiten

Regeln:
- Ergebnisse landen in AI Run History.
- Ergebnisse sind Vorschläge.
- Produktive Daten werden nur nach Review/Apply geändert.
- Mail wird nur vorbereitet, nicht ungefragt gesendet.
- DM-only/player-visible Regeln beachten.

Akzeptanz:
- Mindestens drei Aktionen funktionieren end-to-end.
- AI Run speichert Prompt, Kontext, Ergebnis, Modell, Status.
- Ergebnisse können übernommen oder verworfen werden.
- Mail-Entwurf kann aus einem Recap/Handout vorbereitet werden.
```

## Prompt 10: Embedding Pipeline / Vektorindex

```md
Bitte implementiere Paket 10 aus:

- docs/ai-brain-mail/ARCHITECTURE.md
- docs/ai-brain-mail/IMPLEMENTATION_PACKAGES.md
- docs/ai-brain-mail/ENV_AND_DEPLOYMENT.md

Ziel:
UWE soll Brain-Wissen semantisch durchsuchen können. Embeddings dürfen auf dem RTX-Rechner berechnet werden, aber die Vektoren werden dauerhaft in UWE auf dem alten Laptop gespeichert.

Bitte umsetzen:

1. Chunking für Brain-Dokumente
2. Embedding Provider Interface
3. Ollama Embedding Provider
4. OpenAI-compatible Embedding Provider, falls sinnvoll
5. Speicherung der Vektoren in UWE DB/Storage
6. Reindex Job
7. semantische Suche nach relevanten Chunks
8. Fallback, wenn RTX offline ist
9. Tests

Wichtig:
- RTX berechnet nur und speichert nicht dauerhaft.
- UWE speichert Vektoren dauerhaft.
- Sichtbarkeit muss auch bei semantischer Suche respektiert werden.

Akzeptanz:
- Brain-Chunks können indexiert werden.
- Relevante Chunks können gefunden werden.
- RTX offline wird kontrolliert behandelt.
- Keine DM-only Leaks in player-visible Kontexten.
```

## Prompt 11: Admin Status Dashboard

```md
Bitte implementiere Paket 11 aus:

- docs/ai-brain-mail/ARCHITECTURE.md
- docs/ai-brain-mail/IMPLEMENTATION_PACKAGES.md
- docs/ai-brain-mail/ENV_AND_DEPLOYMENT.md

Ziel:
Im UWE Admin/Studio soll ein Status Dashboard sichtbar sein, das das Zwei-Maschinen-Setup verständlich diagnostiziert.

Bitte anzeigen:

- UWE App Status
- Database Status
- Storage/Uploads/Backups Status
- Cloudflare/Proxy-Konfiguration
- Auth aktiv/inaktiv
- Mail Status
- Brain Knowledge Store Status
- RTX Inference online/offline
- aktueller Provider
- aktuelles Modell
- Embedding Status
- letzter AI Run
- fehlgeschlagene Jobs
- offene AI-Vorschläge

Wichtig:
- Fehler sollen verständliche nächste Schritte nennen.
- Keine Secrets anzeigen.
- Dashboard darf nur im geschützten Studio/Admin sichtbar sein.

Akzeptanz:
- Admin sieht sofort, ob UWE, Mail, Brain und RTX funktionieren.
- RTX offline wird sauber angezeigt.
- SMTP-Fehler werden sauber angezeigt.
- Keine Secrets in der UI.
```

## Prompt 12: Job Queue finalisieren

```md
Bitte implementiere Paket 12 aus:

- docs/ai-brain-mail/IMPLEMENTATION_PACKAGES.md

Ziel:
Lange Tasks dürfen die UWE UI nicht blockieren. Mail, AI Runs, Embeddings, Reindex, Import und Backup sollen als Jobs laufen oder an eine vorhandene Job-Struktur angebunden werden.

Bitte umsetzen:

1. Job-Modell oder vorhandenes Job-System prüfen/erweitern
2. Status: pending, running, completed, failed, cancelled
3. Fehler speichern
4. Retry-Möglichkeit für geeignete Jobs
5. Job-Liste im Admin/Studio
6. AI Runs als Jobs integrieren, falls sinnvoll
7. Mail-Versand als Job integrieren, falls sinnvoll
8. Embedding/Reindex als Job integrieren
9. Tests

Akzeptanz:
- UI blockiert nicht bei langen KI-Aufgaben.
- Job-Fehler sind sichtbar.
- Jobs können diagnostiziert werden.
- Mail/AI/Embedding-Aufgaben sind nachvollziehbar.
```

## Prompt 13: Finales Hardening und Tests

```md
Bitte führe ein finales Hardening für UWE Brain + Mail + Cloudflare durch.

Lies zuerst:

- docs/ai-brain-mail/README.md
- docs/ai-brain-mail/ARCHITECTURE.md
- docs/ai-brain-mail/IMPLEMENTATION_PACKAGES.md
- docs/ai-brain-mail/ENV_AND_DEPLOYMENT.md

Bitte prüfen und ergänzen:

1. Secrets gelangen nicht ins Frontend
2. SMTP-Fehlerfälle sind getestet
3. RTX offline ist getestet
4. Ollama/LM Studio Timeout ist getestet
5. MockProvider Tests
6. Context Builder Sichtbarkeitsfilter
7. Player Preview DM-only Schutz
8. Mail an Spieler ohne DM-only Leak
9. AI Run History vollständig
10. Review/Apply ohne blindes Überschreiben
11. Cloudflare/Proxy Cookie Setup
12. Health Dashboard
13. Backup/Restore Hinweise
14. Dokumentation aktualisieren

Am Ende bitte ausgeben:

- geänderte Dateien
- neue ENV-Werte
- Testbefehle
- manuelle Testschritte
- bekannte Einschränkungen
- nächste sinnvolle Schritte
```
