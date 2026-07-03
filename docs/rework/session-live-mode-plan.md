# Detailplan: Session-Live-Modus (Ausbau)

Stand: 2026-07-03 · Teil von [feature-roadmap-2026-07.md](feature-roadmap-2026-07.md) (Welle 1, Phasen A–B).

**Ziel:** Aus dem vorhandenen minimalen Live-Panel (eine Notes-Textarea +
Timestamp-Append) ein echtes Spieltisch-Cockpit machen: Session starten, Live-Notizen,
Schnellsuche, Initiative-Leiste, Loot/Quest-Änderungen vormerken — und nach der Session
„Review & Kanon übernehmen". Philosophie unverändert: **Live wird nur vorgemerkt,
nichts wird direkt Kanon** — Proposal → Review → Apply.

> **Umsetzungsstand 2026-07-03:** Phase A + B (Kern) gebaut. `SessionLiveEntry`-Modell
> + Migration, `session-live-service.ts` (append/list/delete + pures
> `buildSessionReviewDraft`/`buildRecapDraft`, 7 Tests), Live-Cockpit mit
> strukturiertem Ereignis-Log (Notiz/Beute/Quest/NPC/Initiative/Lesezeichen +
> Seiten-Referenz), und neue Review-Seite `/sessions/[id]/review` (gruppierte
> Vormerkungen mit Deep-Links + Recap-Entwurf → `summaryDm`). **Offen (Folge-Iteration):**
> direktes Apply von Quest-Status/Loot aus der Review-Seite (aktuell Deep-Link zur
> betroffenen Seite), Schnellsuche-Integration im Panel, Soundboard-Leiste.

---

## 1. Ist-Stand (wiederverwenden)

- Route `apps/studio/app/worlds/[worldSlug]/sessions/[sessionId]/live/` +
  `apps/studio/components/SessionLivePanel.tsx` (171 Z.) +
  `apps/studio/app/session-live-actions.ts` (61 Z.): Notes-Autosave,
  `appendSessionLiveNoteAction` (Zeilen `- [HH:MM] …` in `GameSession.notes`),
  `endSessionLiveModeAction` (Status → `played`).
- `createGameSessionService` (`packages/database/src/game-session.ts`),
  `ai-review-service.ts` (AiProposal-Review + Undo), `ContentReview`/`review-service.ts`,
  `quest-lifecycle-service.ts` (`updateQuestStatus`), `InventoryItem`/`PartyTreasury`,
  `StructuredStatblock`-Lookup, `prepare-session.ts` (heuristischer Outline-Builder).
- Portal-Soundboard existiert bereits (`apps/portal/.../soundboard`).

## 2. Phase A — Live-Cockpit

1. **Neues Modell `SessionLiveEntry`** (statt weiter alles in `notes` zu konkatenieren):

   ```prisma
   model SessionLiveEntry {
     id            String @id @default(cuid())
     gameSessionId String  // FK GameSession, cascade
     kind          SessionLiveEntryKind  // note|loot|quest_update|npc_update|initiative|bookmark
     content       String @default("")
     refPageId     String?               // verlinkte NPC-/Ort-/Item-/Quest-Seite
     payload       Json?                 // kind-spezifisch (z. B. Initiative-Reihenfolge)
     createdAt     DateTime @default(now())
     @@index([gameSessionId, createdAt])
     @@map("session_live_entries")
   }
   ```

   Migration in `packages/database/prisma` (+ Postgres-Mirror). Die bisherigen
   `notes` bleiben unverändert gültig (Abwärtskompatibilität; Freitext-Feld bleibt
   im Panel verfügbar).
2. **Service `packages/database/src/session-live-service.ts`** (bewusst in database,
   da eng am GameSession-Repository; klein halten, < 300 Z.): append/list/delete
   Entries, `buildSessionReviewDraft()` — gruppiert Entries nach Kind zu einer
   Vorschlagsstruktur für die Review-Seite. Export über Subpath/Feature-Zugriff,
   **nicht** über das eingefrorene `server.ts`-Barrel.
3. **Schnellsuche** im Live-Panel: bestehende Page-Suche wiederverwenden
   (page-service / Cross-Domain-Suchindex aus Fundament F4) — NPC/Ort/Item nachschlagen,
   Kurzinfo anzeigen, als Entry verlinken (`refPageId`).
4. **Initiative-/Encounter-Leiste**: rein client-seitig geführt, persistiert als Entry
   `kind=initiative` mit `payload` (Reihenfolge, HP-Notizen) — **kein eigenes
   Kampf-Modell in Phase A**; Monster-Statblocks über bestehendes
   `StructuredStatblock`-Lookup einblendbar.
5. **Loot/Quest/NPC vormerken**: Schnellaktionen erzeugen Entries `kind=loot` /
   `quest_update` / `npc_update` mit `refPageId` — bewusst nur Vormerkung, keine
   Schreibzugriffe auf Kanon-Daten während der Session.
6. **Soundboard-Leiste**: Link/Embed des bestehenden Portal-Soundboards — keine
   Neuentwicklung.
7. UI: `SessionLivePanel` erweitern; bei > 300 Zeilen in Unterkomponenten
   `apps/studio/components/session-live/*` aufteilen (File-Size-Budget).
   Server Actions in `session-live-actions.ts` ergänzen (append/delete Entry).

## 3. Phase B — Review & Kanon übernehmen

1. „Session beenden" führt statt direkt zur Detailseite auf eine neue Review-Seite
   `/worlds/[worldSlug]/sessions/[sessionId]/review`: zeigt `buildSessionReviewDraft()`
   — vorgemerkte Loot-/Quest-/NPC-Änderungen als **einzeln bestätigbare** Vorschläge,
   plus alle note/bookmark-Entries als Recap-Rohmaterial.
2. Apply nutzt ausschließlich bestehende Services:
   - Quest-Status → `updateQuestStatus()` (`quest-lifecycle-service.ts`)
   - Loot → `InventoryItem`-/`PartyTreasury`-Methoden
   - NPC-/Welt-Fakten → als `ContentReview`- bzw. `AiProposal`-Eintrag in den
     bestehenden Review-Flow (**kein Auto-Kanon**, Undo über `ai-review-service.ts`)
3. Recap-Entwurf: `summaryDm`-Vorschlag heuristisch aus den Entries generieren
   (Muster `prepare-session.ts`); KI-Recap optional über den bestehenden AiRun-Pfad —
   auch dort nur als Vorschlag.

## 4. Verifikation

- Unit-Tests `session-live-service`: Entry-CRUD, `buildSessionReviewDraft`-Gruppierung
  (Fixtures mit gemischten Kinds), Abwärtskompatibilität mit vorhandenen `notes`.
- Manuelle Probe: Session starten → Notiz/Loot/Quest-Entries anlegen → Initiative
  führen → beenden → Review-Seite bestätigt eine Quest-Status-Änderung →
  `questStatus` geändert, NPC-Fakt liegt als Review-Eintrag vor, nichts wurde
  automatisch Kanon.
- `pnpm quality` (inkl. File-Size-Budget und Navigation-Tests).
