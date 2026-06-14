# DnD-Generator Upgrade

KI-gestützte DnD-Inhaltsgenerierung in UWE — kontextuelle Aktionen, Review/Apply-Workflow und strikte Player-Safety.

> Der „DnD-Generator“ ist kein separates Modul, sondern ein Set von **KI-Aufgaben** (`AiTaskType`) und **Brain-Aktionen** (`BrainActionId`), die über den AI Router mit lokaler RTX-Inferenz laufen.

---

## Verfügbare Aktionen

### KI-Aufgaben (`packages/ai-brain/src/tasks.ts`)

| Aufgabe | Task-Type | Beschreibung |
|---------|-----------|--------------|
| NPC generieren | `create_npc` | NPC mit Rolle, Motivation, Hooks |
| Ort ergänzen | `create_location` | Ort mit Atmosphäre, Geheimnissen, Hooks |
| Dungeon-Raum ergänzen | `fill_dungeon_room` | Raumbeschreibung, Interaktionen, GM-Notizen |
| Encounter erstellen | `create_encounter` | Szenario mit Gegnern, Taktik, Ausgängen |
| Spieler-Handout erzeugen | `create_player_handout` | In-Game-Dokument ohne GM-Geheimnisse |
| Kanon-Konflikt prüfen | `detect_contradictions` / `prepare_canon_check` | Widersprüche im Kontext erkennen |
| Nächste Session vorbereiten | `prepare_next_session` | Agenda, Szenen, NPCs, Encounters |
| Spieler-Recap | `generate_player_recap` | Session-Zusammenfassung ohne DM-only |
| Lore verbessern | `improve_lore_text` | Stilistische Verbesserung ohne Kanon-Änderung |

### Brain-Aktionen (`packages/ai-brain/src/actions.ts`)

| Aktion | ID | Player-safe | Review-Target |
|--------|-----|-------------|---------------|
| Session Recap | `session_recap` | Nein | `session_summary_dm` |
| Nächste Session vorbereiten | `next_session_prep` | Nein | `page_content_block` |
| Kanon-Konfliktprüfung | `canon_check` | Nein | `idea_page` |
| Spieler-Handout | `player_handout` | **Ja** | `brain_document` |
| Dungeonraum füllen | `fill_dungeon_room` | Nein | `page_content_block` |
| Wissenstext erweitern | `expand_knowledge` | Nein | `page_content_block` |
| Mail-Entwurf | `mail_draft` | **Ja** | `mail_draft` |

---

## Workflow: Generieren → Review → Apply

UWE übernimmt **nichts automatisch**. Der Ablauf:

```txt
1. DM wählt Kontext (Seite, Session, Dungeon-Raum)
2. DM startet KI-Aktion (lokale RTX erforderlich)
3. KI erzeugt Vorschlag (AI Run + Proposal)
4. DM prüft Vorschlag in Review-UI
5. DM wendet explizit an (Apply) oder verwirft (Discard)
```

Ergebnisse werden als:

- **Idea-Page** (`canonicalStatus: idea`, `publishStatus: draft`) — z. B. NPC-Ideen, Kanonprüfung
- **Content-Block** (`visibility: dm_only`, `type: ai_summary`) — z. B. Zusammenfassungen
- **Brain-Dokument** — z. B. Spieler-Handouts
- **Session-Felder** — z. B. DM-Recap, Spieler-Recap

Gespeichert mit Metadaten `isCanon: false` und Quellen-Referenzen.

---

## Player-Safety (DM-only Leak verhindern)

### Serverseitige Regeln

1. **Player-safe Tasks** (`generate_player_recap`, `create_player_handout`, `prepare_mail_draft`):
   - `resolveServerAllowDmOnly()` gibt `false` zurück
   - System-Prompt verbietet GM-Geheimnisse explizit
   - `validatePlayerRecapContent()` prüft gegen bekannte DM-only-Phrasen

2. **Cloud-Provider:**
   - Blockiert bei jedem lokalen Kontext (`contextContainsLocalKnowledge`)
   - Blockiert bei DM-only-Inhalten (`contextContainsDmOnly`)
   - `sanitizeContextForCloud()` entfernt DM-only-Blöcke (Defense-in-Depth)

3. **Portal:**
   - DM-only-Blöcke werden serverseitig gefiltert (`visibility-security.test.ts`)
   - Player-Preview zeigt keine GM-Notizen

### Automatisierte Tests

| Prüfung | Testdatei |
|---------|-----------|
| Cloud + Brain-Kontext blockiert | `privacy.test.ts`, `router.test.ts` |
| DM-only nicht an Cloud | `privacy.test.ts` |
| Player-Recap ohne GM-Secrets | `ai-brain.test.ts` |
| Portal filtert DM-only | `visibility-security.test.ts` |
| Mail nur summaryPlayer an Spieler | `compose.test.ts`, `mail-service.test.ts` |

---

## RTX offline und Jobs

Wenn RTX nicht bereit ist:

| Kontext | Verhalten |
|---------|-----------|
| Allgemeiner Chat (Auto) | Cloud-Fallback, wenn konfiguriert |
| Brain / Objekt / DnD-Kontext | **Blockieren** oder Job `pending` anlegen |
| DnD-Generator-Aktionen | Job vormerken, Ausführung bei RTX ready |

Kein Cloud-Fallback für Generator-Aktionen mit Kampagnenkontext.

Job-Verwaltung: `/jobs` — Status `pending`, `running`, `completed`, `failed`, `cancelled`.

---

## Privacy: Kein Brain-/Objektkontext an Cloud

Der DnD-Generator sendet bei lokalen Kontextmodi **ausschließlich** an RTX:

- Brain-Retrieval-Ergebnisse
- Aktuelle Seite/Entität
- Session-Daten, Kanon, Dungeons

Cloud-KI erhält nur den reinen Prompt im Allgemeinen-Chat-Modus. Details: [SECURITY_NOTES.md](../SECURITY_NOTES.md).

---

## Smoke-Tests (DnD-Generator)

### Automatisiert

```bash
pnpm test
# Prüft u. a.:
# - AI task definitions (integration-smoke.test.ts)
# - Brain actions registry (brain-actions.test.ts)
# - Privacy guard (privacy.test.ts, router.test.ts)
# - AI result save as idea/block (ai-brain.test.ts)
# - Player recap validation (ai-brain.test.ts)
```

### Manuell (mit laufender RTX oder `AI_USE_MOCK=true`)

| Aktion | Erwartung |
|--------|-----------|
| NPC generieren | Idea-Page als Draft, nicht als Kanon |
| Ort ergänzen | Vorschlag mit Setting-Hooks, Review nötig |
| Dungeon-Raum ergänzen | GM-Notizen als dm_only Block |
| Encounter skalieren | Encounter-Szenario als Vorschlag |
| Spieler-Handout erzeugen | Keine DM-only-Phrasen im Output |
| Kanon-Konflikt anzeigen | Findings als Idea-Page oder Report |
| Prepare-for-next-session | Agenda + Szenen als Proposal |
| Apply | Explizit — nichts wird automatisch kanonisiert |
| Discard | Proposal wird verworfen, kein Seiten-Update |
| RTX offline | Klare Fehlermeldung oder pending Job |

---

## Multi-World

- Generator-Aktionen sind **weltgebunden** (Kontext der aktuellen Welt/Seite).
- Terra kann als bevorzugte Welt gesetzt werden (`favoriteWorldId` — geplant, Subagent 7).
- **Kein Hardcoding:** `seedTerraWorld` ist nur Demo-Seed, keine Produktlogik.
- `/worlds` bleibt vollständige Multi-World-Verwaltung.

---

## Zugriff in Studio

| Oberfläche | Pfad |
|------------|------|
| KI-Prompt (mobil/desktop) | `/admin/ai-prompt` |
| AI Runs (pro Welt) | `/worlds/[slug]/ai-runs` |
| Brain-Aktionen | Seiten-Sidebar, Session-Ansicht, Dungeon-Raum |
| Admin Status (RTX) | `/admin/status` |

---

## Weiterführend

- [daily-admin-os.md](daily-admin-os.md) — Daily Admin OS Integration
- [life-brain-privacy.md](life-brain-privacy.md) — Gleiche Privacy-Regeln für Life-Brain
- [ai-brain-mail/SMOKE_TESTS.md](ai-brain-mail/SMOKE_TESTS.md) — Gesamt-Smoke-Tests
