# Cursor-Agent-Briefing: Design-Konsolidierung Portal (Paket P1)

> Dieses Dokument ist ein vollständiger, eigenständiger Arbeitsauftrag für einen
> Cursor-Agenten (oder jeden anderen Coding-Agenten). Als Prompt einfach den
> kompletten Abschnitt „Prompt" unten übergeben.

## Prompt

Du arbeitest im UWE-Monorepo. Lies zuerst diese drei Dateien vollständig:

1. `docs/design/new-ui-stack.md` — verbindlicher Ziel-Stack (Tailwind v4 + shadcn-Stil-Kit + Radix + Lucide) und Migrationsregeln.
2. `docs/engineering/design-consolidation.md` — Arbeitsplan, Definition of Done, Mapping-Spickzettel, Paket-Aufteilung.
3. `docs/engineering/ui-assessment.md` — Abschnitt „Portal" (Befunde pro Seite).

**Dein Paket: P1 — Portal komplett.** Dein Datei-Scope ist ausschließlich
`apps/portal/**`. Du darfst NICHTS außerhalb davon ändern — insbesondere nicht
`packages/**`, `apps/studio/**` oder Root-Konfigurationen. Fehlt dir etwas aus
`packages/shared-ui`, notiere es als TODO im Commit-Text und löse es lokal im
Portal-Kit (`apps/portal/src/components/ui/*`, copy-in im shadcn-Stil).

**Branch:** Erstelle `cursor/design-portal` von `claude/site-ui-assessment-5ay1ow`
(dort liegen der aktuelle Assessment-Stand, das Inventar-Script und die bereits
umgebauten Seiten). Niemals auf andere Branches pushen.

**Auftrag:** Migriere alle Portal-Seiten mit Legacy-Styling auf den Ziel-Stack.
Die Liste bekommst du mit:

```bash
node scripts/design-consolidation-inventory.mjs --app portal --json
```

Alle Seiten mit `status != "fertig"` sind dein Backlog (aktuell 21, v. a.
`apps/portal/app/auth/worlds/[worldSlug]/*`: treasury, questions, [slug], notes,
characters, assets, soundboard, quests, atlas, handouts, wiki, npcs …).
Arbeite in Batches von 3–5 Seiten, von hoher zu niedriger Legacy-Zahl.

**Pro Seite (Definition of Done, Kurzform — Details im Plan-Dokument):**
- `auth-*`-, `portal-*`-, `uwe-*`-Klassen durch Portal-Kit-Komponenten
  (`apps/portal/src/components/ui/*`) und Tailwind-Utilities ersetzen
  (Token-Bridge: Farben/Abstände existieren als Tailwind-Tokens).
- Max. 2 Inline-Styles pro Seite (nur echt dynamische Werte).
- Icons über Lucide, keine Emoji.
- **Verhalten unverändert:** Datenbeschaffung, Server Actions und vor allem die
  Sicherheits-/Sichtbarkeitslogik (dm_only darf NIE im Portal erscheinen,
  Filtering via `packages/database/src/permissions.ts`) nicht anfassen.
  Du änderst nur Markup/Styling.
- Seitenspezifische Komponenten unter `apps/portal/src/**` gehören zur Seite
  und werden mitmigriert; geteilte Komponenten aus `packages/shared-ui`
  (z. B. PlayerNotesPanel, GraphView) lässt du unverändert und wrappst sie nur.

**Qualität & Prozess:**
- Nach jedem Batch: `pnpm --filter @uwe/portal typecheck && pnpm lint` — vor
  jedem Push das volle `pnpm ci:light`.
- Ein Commit pro Batch, Präfix `style(portal): …`, in der Commit-Message die
  Inventar-Zahlen vorher/nachher (Script-Aufruf oben).
- Datei-Budget: keine Datei über 700 Zeilen; `scripts/file-size-baseline.json`
  niemals erhöhen.
- Kein neues globales CSS; Portal-CSS-Dateien (`apps/portal/app/*.css`) nur
  ergänzen, wenn eine Utility nachweislich nicht reicht — Regel: erst Kit, dann
  Utility, CSS nur als letzter Ausweg mit Begründung im Commit.
- Wenn eine Seite nach Migration im Dev-Server (Port 3001) sichtbar kaputt wäre
  und du es nicht lösen kannst: Seite zurückstellen, im Commit-Text notieren,
  nächste Seite.

**Fertig-Kriterium des Pakets:** `node scripts/design-consolidation-inventory.mjs --app portal`
meldet für alle Seiten `fertig`, `pnpm ci:light` ist grün, alles ist auf
`cursor/design-portal` gepusht. Öffne KEINEN Pull Request — das macht der Mensch
nach Review.

## Warum dieser Zuschnitt

Das Portal ist eine eigene Next.js-App ohne Datei-Überschneidung mit den
Studio-Arbeitspaketen (S1–S5), die parallel in einer Claude-Session laufen.
Solange beide Seiten ihren Scope einhalten, gibt es keine Merge-Konflikte;
gemeinsame Pakete (`packages/**`) sind für beide tabu.
