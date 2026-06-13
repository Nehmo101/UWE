# Cursor Setup fuer Auto Mode und Subagents

Referenz: https://cursor.com/de/docs/subagents

## 1. Repository oeffnen

1. Cursor starten.
2. `Nehmo101/UWE` lokal oeffnen.
3. Sicherstellen, dass der Arbeitsbaum sauber ist.
4. Einen neuen Branch erstellen, zum Beispiel:

```bash
git checkout -b feat/ai-brain-mail-automode
```

## 2. Subagents vorbereiten

In Cursor die Subagents-Funktion oeffnen und die Rollen aus `docs/ai-brain-mail/SUBAGENTS.md` als Projekt-Subagents oder wiederverwendbare Agent-Instruktionen anlegen.

Wichtige Rollen:

- repo-analyst
- platform-hosting-agent
- security-cloudflare-agent
- mail-agent
- brain-store-agent
- inference-agent
- ai-run-agent
- context-agent
- review-apply-agent
- brain-actions-agent
- embedding-agent
- dashboard-agent
- jobs-agent
- qa-hardening-agent

## 3. Auto Mode einstellen

Empfohlene Einstellungen:

- Auto Mode aktivieren.
- Terminal-Kommandos erlauben.
- Produktive Deployments nicht automatisch ausfuehren lassen.
- Keine echten Zugangsdaten eintragen.
- Maximal 2 bis 3 parallele Subagents nutzen.
- Nach jeder Runde Tests/Build pruefen.

## 4. Orchestrator starten

1. `docs/ai-brain-mail/ORCHESTRATOR_PROMPT.md` oeffnen.
2. Den kompletten Prompt kopieren.
3. In Cursor Agent/Composer einfuegen.
4. Starten.
5. Der Orchestrator soll mit P00A, P00B und P00C beginnen.

## 5. Danach

Nach jeder Runde pruefen:

- geaenderte Dateien
- Build/Typecheck/Lint/Tests
- neue ENV-Werte
- Sicherheitsauswirkungen
- offene Risiken

Erst danach die naechste Runde starten lassen.
