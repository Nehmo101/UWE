# Cursor Auto Mode + Subagents Workflow

Diese Datei beschreibt, wie UWE AI-Brain-Mail-Cloudflare in Cursor mit einem Orchestrator-Agent und spezialisierten Subagents abgearbeitet werden soll.

Referenz: Cursor Subagents Doku: https://cursor.com/de/docs/subagents

## Ziel

Ein Haupt-Agent startet und koordiniert spezialisierte Subagents. Die Subagents bearbeiten kleine, klar begrenzte Tasks. Der Orchestrator prüft Abhängigkeiten, sammelt Ergebnisse, fordert Tests an und verhindert riskante Paralleländerungen.

## Grundregel

```txt
UWE ist der alleinige Besitzer aller Daten und allen Brain-Wissens.
Der RTX-Rechner ist nur ein austauschbarer Inference Worker.
Er darf keine UWE-Daten dauerhaft speichern und ist nicht öffentlich erreichbar.
```

## Cursor-Einstellung: empfohlen

In Cursor:

1. UWE Repository öffnen.
2. Sicherstellen, dass der aktuelle Branch sauber ist.
3. Agent/Composer öffnen.
4. Auto Mode aktivieren, aber mit Review-Gates arbeiten.
5. Terminal-Ausführung erlauben, aber Production-/Deploy-Befehle nicht automatisch bestätigen.
6. Keine echten Secrets in `.env`, Prompts oder Tests eintragen.
7. Maximal 2 bis 3 parallele Subagents verwenden.
8. Nach jeder Phase Build/Tests prüfen.

## Agent-Struktur

Der Orchestrator verwendet diese Rollen:

| Subagent | Aufgabe |
|---|---|
| `repo-analyst` | Repo analysieren, Architekturpunkte finden, Risiken erkennen |
| `platform-hosting-agent` | Production Host, ENV, Storage, Healthchecks |
| `security-cloudflare-agent` | Cloudflare, Auth, Cookies, Player Preview Sicherheit |
| `mail-agent` | SMTP, Mail Center, Templates, Logs |
| `brain-store-agent` | Brain Knowledge Store auf altem Laptop |
| `inference-agent` | Ollama/LM Studio/OpenAI-compatible RTX Connector |
| `ai-run-agent` | AI Run History und Run Detail UI |
| `context-agent` | Context Builder, Sichtbarkeit, Kontextbudget |
| `review-apply-agent` | Vorschläge, ApplyLog, Undo/Snapshot-Hooks |
| `brain-actions-agent` | Session Recap, Session Prep, Wissenstext erweitern |
| `embedding-agent` | Chunking, Embeddings, Vektorindex |
| `dashboard-agent` | Admin Status Dashboard |
| `jobs-agent` | Job Queue, lange Tasks, Retry/Fehler |
| `qa-hardening-agent` | Tests, Security Review, Final Hardening |

## Kleine Task-Einheiten

Die alten Prompts 0 bis 13 sind jetzt in kleinere Units aufgeteilt:

```txt
P00 Analyse
P01 Host Baseline
P02 Cloudflare/Auth
P03 Mail
P04 Brain Store
P05 Inference
P06 AI Run History
P07 Context Builder
P08 Review/Apply
P09 Brain Actions
P10 Embeddings
P11 Dashboard
P12 Jobs
P13 QA/Hardening
```

Jedes Paket besteht aus A/B/C-Tasks. Cursor soll nur kleine Tasks an Subagents delegieren.

## Abhängigkeiten

```txt
P00 alleine
P01 nach P00
P02 nach P01
P03 nach P01, parallel zu P04/P05 möglich
P04 nach P01, parallel zu P03/P05 möglich
P05 nach P01, parallel zu P03/P04 möglich
P06 nach P04+P05
P07 nach P04+P06
P08 nach P06, parallel zu P07 möglich
P09 nach P04+P05+P06+P07+P08
P10 nach P04+P05+P07
P11 nach P02+P03+P04+P05+P06
P12 nach P03+P06+P10
P13 zuletzt
```

## Sichere Parallel-Runden

```txt
Runde 0:
- repo-analyst: P00

Runde 1:
- platform-hosting-agent: P01

Runde 2:
- security-cloudflare-agent: P02
- mail-agent: P03A/P03B
- brain-store-agent: P04A/P04B

Runde 3:
- inference-agent: P05A/P05B
- mail-agent: P03C/P03D
- brain-store-agent: P04C/P04D

Runde 4:
- ai-run-agent: P06

Runde 5:
- context-agent: P07
- review-apply-agent: P08

Runde 6:
- embedding-agent: P10
- dashboard-agent: P11

Runde 7:
- brain-actions-agent: P09

Runde 8:
- jobs-agent: P12

Runde 9:
- qa-hardening-agent: P13
```

## Stop-Regeln

Der Orchestrator muss stoppen, wenn:

- Build/Typecheck/Lint fehlschlagen und nicht direkt repariert werden können.
- Migrationen produktive Daten gefährden könnten.
- Auth/Player Preview unsicher wird.
- Secrets im Frontend oder Repo auftauchen.
- ein Subagent versucht, Ollama/LM Studio öffentlich verfügbar zu machen.
- mehrere Subagents dieselben Dateien konfliktträchtig ändern.

## Commit-Regeln

Empfohlen pro Paket oder Subtask:

```txt
feat(hosting): add production health checks
feat(mail): add smtp test and mail logs
feat(brain): add local knowledge store models
feat(ai): add ollama inference provider
```

## Orchestrator-Ausgabe nach jeder Runde

Der Orchestrator muss ausgeben:

```txt
Runde:
Subagents:
Erledigte Tasks:
Geänderte Dateien:
Neue ENV-Werte:
Tests/Build:
Security Check:
Offene Risiken:
Nächste Runde:
```

## Wichtig für Auto Mode

Auto Mode ist erlaubt, aber nicht blind:

- lokale Tests ausführen lassen
- keine echten Deployments
- keine echten Secrets
- keine produktiven Daten löschen
- keine Router-/Cloudflare-Konfiguration automatisch ändern
- keine öffentliche RTX-Verbindung bauen
