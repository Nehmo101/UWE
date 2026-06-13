# UWE AI Brain + Mail + Cloudflare Plan

Diese Doku beschreibt die Zielarchitektur für UWE als zentrale DM-Plattform:

- UWE läuft auf dem alten Laptop und ist über Cloudflare erreichbar.
- Das gesamte Brain-Wissen bleibt auf dem alten Laptop in UWE gespeichert.
- Der RTX-Rechner führt nur lokale LLM-Inferenz aus.
- Mail ist ein Pflichtmodul von UWE.
- Odysseus wird nicht parallel gehostet; sinnvolle Odysseus-Ideen werden als UWE-Module integriert.

## Wichtigste Architekturregel

```txt
UWE ist der alleinige Besitzer aller Daten und allen Brain-Wissens.
Der RTX-Rechner ist nur ein austauschbarer Inference Worker.
Er darf keine UWE-Daten dauerhaft speichern und ist nicht öffentlich erreichbar.
```

## Dokumente

| Datei | Zweck |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Zielarchitektur, Datenflüsse, Sicherheitsregeln |
| [IMPLEMENTATION_PACKAGES.md](IMPLEMENTATION_PACKAGES.md) | Sinnvoll aufgeteilte Umsetzungspakete für Cursor |
| [CURSOR_PROMPTS.md](CURSOR_PROMPTS.md) | Copy-Paste-Prompts für Cursor mit Verweisen auf diese Doku |
| [ENV_AND_DEPLOYMENT.md](ENV_AND_DEPLOYMENT.md) | ENV-Konzept, Cloudflare, alter Laptop, RTX-Rechner |
| [SMOKE_TESTS.md](SMOKE_TESTS.md) | P13 Smoke-Checks, QA-Matrix, Backup-Hinweise |

## Kurzfassung

```txt
Internet
  ↓
Cloudflare / uweanddragons.org
  ↓
Alter Laptop
  ├─ UWE Web-App
  ├─ UWE Datenbank
  ├─ Brain-Wissen
  ├─ Embeddings / Vektorindex
  ├─ Mail Center
  ├─ AI Run History
  ├─ Context Builder
  ├─ Job Queue
  └─ ruft RTX-Rechner nur für Modellantworten auf
        ↓ Heimnetz
      RTX-Rechner
      ├─ Ollama / LM Studio / OpenAI-compatible Server
      ├─ lokale LLMs
      └─ GPU-Inferenz
```

## Cursor-Regel

Wenn Cursor an diesem Thema arbeitet, soll zuerst diese Doku gelesen werden:

1. `docs/ai-brain-mail/README.md`
2. `docs/ai-brain-mail/ARCHITECTURE.md`
3. `docs/ai-brain-mail/IMPLEMENTATION_PACKAGES.md`
4. der passende Prompt aus `docs/ai-brain-mail/CURSOR_PROMPTS.md`

## Nicht-Ziele

- Kein dauerhaft paralleles Odysseus-Hosting.
- Keine zweite UWE-Datenbank auf dem RTX-Rechner.
- Kein öffentlich erreichbarer Ollama-/LM-Studio-Port.
- Keine automatische KI-Überschreibung produktiver Daten ohne Review/Apply.
- Keine Secrets im Frontend.
