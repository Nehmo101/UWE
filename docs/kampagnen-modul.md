# Das eine Kampagnen-Modul — Konzept & Migrationsplan

Stand: 2026-08-05 · Status: **Entschieden, in Umsetzung** — Etappe 0 und 1 sind gebaut,
die Antworten auf die offenen Fragen stehen [unten](#offene-fragen-bitte-entscheiden) bei den Fragen.

Anlass: Kampagnen-Radar, Kampagnen-Cockpit und Sessions sind drei getrennte
Flächen mit großer Überlappung. „Session vorbereiten" kennt keine Kampagne,
am Spieltisch fehlt der schnelle Zugriff auf den ganzen Akt samt NSCs, und
Spielernotizen im Portal finden ihre Session nur auf einer von drei Flächen.
Dieses Dokument beschreibt den Ist-Stand, ein Zielbild als ein Modul mit
einem Flow bis ins Dungeon, die nötige Migration und die Entscheidungen,
die vorher zu treffen sind.

---

## 1. Ist-Stand in einem Bild

```
Datenmodell (bereits gut vorbereitet):

World ─┬─ Campaign ──┬─ Page(type=story_arc)  ← „Kapitel", sortIndex, prepStatus
       │             │      └─ Page(type=quest, parentPageId=Kapitel, questStatus)
       │             ├─ GameSession (campaignId, SetNull)
       │             │      ├─ SessionLiveEntry   (Live-Protokoll, Cascade)
       │             │      ├─ GameSessionPageLink (n:m Session↔Seite, Cascade)
       │             │      └─ SessionAvailability (Spieler-Zusagen, Cascade)
       │             ├─ Page(type=dungeon → dungeon_level → room …, campaignId)
       │             └─ PlayerNote (campaignId PFLICHT, gameSessionId optional)
       ├─ WorldEvent (Chronik, gameSessionId optional)
       └─ WorldCalendar (Weltuhr)
```

Wichtig: **Kapitel, Quests, Dungeons und Räume sind alle `Page`-Zeilen** —
es gibt kein eigenes Chapter-/Dungeon-Modell. Die Struktur entsteht aus
`type`, `campaignId`, `parentPageId` und `sortIndex`. NSCs (`type=npc`)
hängen an keiner dieser Kanten: ihre Zuordnung zu Kapiteln entsteht heute
ausschließlich abgeleitet aus `[[Wiki-Links]]` in Quest-Texten
(`deriveQuestRelations` in `@uwe/campaign-cockpit`).

### Die fünf Flächen und ihre Überlappung

| Fläche | Route | Rahmen | zeigt |
|---|---|---|---|
| Kampagnen-Radar | `/radar` | Welt (Kampagne = Filter) | Fraktionen, offene Quests, letzte Session, Chronik, Dungeons, Weltuhr, NPC-Zähler, Kanon-Konflikte |
| Kampagnen-Cockpit | `/kampagnen/[slug]` | Kampagne | Kapitel + Fortschritt, offene Quests, Fraktionen, letzte/nächste Session, Chronik, Notizen-Queue, Kanon-Konflikte |
| Sessions | `/sessions` | Welt (Kampagne = Filter) | Liste, Detail, Live-Modus, Review |
| Session vorbereiten | `/prepare-session` | Welt, **kennt keine Kampagne** | kommende Sessions, letztes KI-Paket, Outline-Heuristik |
| Dungeons | `/dungeons` | Welt (Kampagne = Filter) | Dungeon → Ebene → Raum-Cockpit |

Fraktionen, offene Quests, letzte Session, Chronik und Kanon-Konflikte
kommen in Radar **und** Cockpit vor — teils aus wortgleichen Queries
(`campaign-radar-service.ts` vs. `cockpit-service.ts`). Beide teilen sich
sogar dieselbe Server Action (`updateQuestStatusInPlaceAction`).

### Warum gibt es überhaupt beide?

Historisch: Der Radar war zuerst da — als „Was passiert in der Welt?"-Blick
mit Kampagne als optionalem Filter (dasselbe Muster wie das Dungeon-Cockpit).
Das Kampagnen-Cockpit kam später als bewusste Kopie des Dungeon-Cockpits
(`Kampagne → Kapitel → Quests`, Kommentar in `cockpit-service.ts`) und hat
die Radar-Karten größtenteils noch einmal gebaut, diesmal kampagnen-verwurzelt.
Der einzige echte Unterschied ist der Rahmen: Radar = Welt, Cockpit = Kampagne.
Alles Weitere ist Drift. **Empfehlung: zusammenlegen** — es gibt keinen
inhaltlichen Grund für zwei Flächen.

---

## 2. Zielbild: ein Modul, ein Flow

Ein Nav-Eintrag **„Kampagne"**, innen entlang des Spielabend-Zyklus
organisiert: **Planen → Spielen → Nachbereiten**.

```
/worlds/x/kampagnen                       Liste (wie heute)
/worlds/x/kampagnen/[slug]                ÜBERBLICK  = Cockpit + Lage-Karten des Radars
/worlds/x/kampagnen/[slug]/kapitel/[k]    KAPITEL    + NSC-Tafel + zugeordnete Dungeons
/worlds/x/kampagnen/[slug]/sessions       SESSIONS   der Kampagne (heutige Liste, vorgefiltert)
/worlds/x/kampagnen/[slug]/vorbereiten    VORBEREITEN, kampagnen-bewusst (heute /prepare-session)
/worlds/x/kampagnen/[slug]/spielabend     SPIELABEND — die Akt-Ansicht am Tisch (neu, Abschnitt 4)
/worlds/x/kampagnen/[slug]/abschluss      NACHBEREITEN (wie heute)
```

- `/radar` → Redirect auf den Überblick der zuletzt aktiven Kampagne
  (Muster: bestehender `campaigns/`-Redirect-Stub). Die **welt-weiten**
  Radar-Anteile (Weltuhr, welt-weite Chronik) wandern ins Welt-Dashboard,
  das heute schon `next-session`/`open-plots`-Widgets hat.
- `/sessions` und `/prepare-session` bleiben als welt-weite Einstiege
  bestehen (Redirect bzw. Weiterleitung mit `?campaign=`), damit Bookmarks
  und Portal-Links nicht brechen.
- Das Modul lebt in **`packages/campaign-cockpit`** (bestehendes
  Feature-Package, wird zum Kampagnen-Modul-Package); `campaign-radar-service.ts`
  aus `@uwe/database` zieht dort ein und stirbt als Duplikat.
  Neue Domänen-Services gehören laut Modul-Disziplin ohnehin nicht mehr
  in `packages/database`.

### Session vorbereiten schaut ins Cockpit

„Vorbereiten" wird kampagnen-bewusst und bekommt genau die Sicht, die heute
fehlt — aus vorhandenen Services, ohne neue Queries zu erfinden:

1. **Aktuelles Kapitel** (`findCurrentChapter`) mit Status und offenen
   Quests des Kapitels (`getChapterView`),
2. **NSC-/Schauplatz-Tafel** des Kapitels (`deriveQuestRelations`),
3. **Letzte Session** mit `openPlots`/`playerDecisions` (heute schon da),
4. **Dungeons des Kapitels** mit `prepStatus` (nach Migration, Abschnitt 5),
5. KI-Paket wie heute — der Digest (`buildCampaignAiDigest`) existiert schon
   und bekommt das gewählte Kapitel als Fokus.

Der tote Parameter `?sessionId=` (wird heute verlinkt, aber nie gelesen)
wird dabei echt: Vorbereitung einer konkreten Session statt „irgendeiner".

---

## 3. Sessions ↔ Kampagne ↔ Kapitel

`GameSession.campaignId` existiert bereits. Was fehlt, ist die Kante
**Session ↔ Kapitel**: Welchen Akt spielen wir gerade?

**Vorschlag:** neue nullable Spalte `GameSession.storyArcPageId`
(FK auf `Page`, `onDelete: SetNull`, Index). Damit:

- Beim Anlegen einer Session wird das **aktuelle Kapitel der Kampagne**
  vorgeschlagen (überschreibbar, Dropdown der Kapitel).
- Die Sessions-Liste kann nach Kapitel gruppieren; das Kapitel zeigt seine
  Sessions; der Spielabend weiß ohne Umweg, welcher Akt offen sein muss.
- Kein Backfill nötig: Bestands-Sessions bleiben `null`, der DM ordnet bei
  Bedarf zu (oder eine Einmal-Heuristik: Session dem Kapitel zuordnen, das
  zum Session-Zeitpunkt `prepStatus=played` wurde — nur als Angebot).

Bewusst **kein** neues Kapitel-Modell und keine neue Akt-Ebene: die
Page-Hierarchie trägt das bereits, und „Akt II — Der Sturm zieht auf" als
Kapiteltitel funktioniert (siehe Frage F2).

---

## 4. Der Spielabend: den ganzen Akt im Zugriff

Das Herzstück des Wunsches: *„Wenn ich im Game bin, brauche ich den gesamten
Akt schnell im Zugriff, ohne andere Fakten aus dem Auge zu verlieren."*

Heute existiert `sessions/[id]/live` bereits mit drei starken Bausteinen:
`SessionRunner` (Lesereihenfolge + Lesezeichen), `SessionLivePanel`
(Protokoll) und `SessionLiveSoundboard`. Was fehlt, ist der **Akt-Rahmen**.
Der Spielabend wird deshalb kein Neubau, sondern der ausgebaute Live-Modus:

```
┌────────────────────────────────────────────────────────────────────┐
│ Kopf: Kampagne · Akt/Kapitel (Wechsler) · Session · Weltuhr        │
├───────────────────────────┬────────────────────────────────────────┤
│ LESEFLÄCHE (bestehender   │ AKT-TAFEL (neu, immer sichtbar)        │
│ SessionRunner)            │  · Quests des Kapitels + Status-Toggle │
│                           │  · NSC-Karten des Akts (s.u.)          │
│ Kapiteltext, Quest-Texte, │  · Dungeons des Kapitels → Raum-Cockpit│
│ Dungeon-Räume — mit       │  · Offene Plots der letzten Session    │
│ Lesezeichen               │──────────────────────────────────────  │
│                           │ LIVE-PROTOKOLL (bestehend) + Soundboard│
└───────────────────────────┴────────────────────────────────────────┘
```

**Woher kommen die NSCs des Akts?** Drei Quellen, gestaffelt:

1. **Abgeleitet** (sofort, ohne Migration): `deriveQuestRelations` liefert
   NSCs/Orte/Fraktionen aus den Quest-Texten des Kapitels. Zusätzlich wird
   der **Kapiteltext selbst** einbezogen — heute werden nur Quest-Texte
   ausgewertet, das ist eine bekannte Lücke.
2. **Gepinnt** (Migration, Abschnitt 5): explizite Kante Kapitel↔Seite mit
   Rolle (`npc`, `location`, `faction`, `handout`), damit der DM NSCs an den
   Akt heften kann, die im Text (noch) nicht verlinkt sind. Modelliert wie
   `WorldEventEntityLink` — das Muster existiert im Schema bereits.
3. **Aus dem Spiel** (später): `SessionLiveEntry` mit `kind=npc_update`
   schlägt vor, den NSC ans Kapitel zu pinnen („kam am Tisch vor").

Jede NSC-Karte zeigt Kurzfassung (`Page.summary`), Link zur Seite und —
weil DM-Ansicht — die `:::dm`-Zeilen. Die Lesefläche wechselt beim Klick
auf einen NSC nicht die Seite, sondern öffnet die Karte als Overlay:
der Lesefaden (Lesezeichen!) geht nie verloren. Genau das adressiert
„ohne andere Fakten aus dem Auge zu verlieren".

**Dungeon-Flow:** Ein Dungeon wird per `parentPageId` einem Kapitel
zugeordnet (dieselbe Kante wie Quests; UI analog „Quest diesem Kapitel
zuordnen"). Der Spielabend zeigt die Dungeons des Kapitels mit
`prepStatus`; ein Klick führt in das bestehende Raum-Cockpit, das einen
„Zurück zum Spielabend"-Link und einen Schnell-Protokoll-Knopf bekommt
(schreibt `SessionLiveEntry` mit `refPageId=Raum`). Damit ist
Kampagne → Kapitel → Session → Dungeon → Raum **ein** Flow.

---

## 5. Migration

Eine einzige, kleine, rückwärtskompatible Schema-Migration trägt alles
(SQLite **und** `migrations-postgresql/`, plus
`packages/product-contracts/src/prisma-model-boundaries.ts` nachziehen):

```prisma
model GameSession {
  // NEU: welcher Akt/welches Kapitel wird gespielt
  storyArcPageId String?  @map("story_arc_page_id")
  storyArcPage   Page?    @relation("SessionStoryArc", fields: [storyArcPageId], references: [id], onDelete: SetNull)
  @@index([storyArcPageId])
}

// NEU: explizites Pinnen von Seiten (NSC, Ort, Fraktion, Handout) an ein Kapitel
model StoryArcEntityLink {
  id             String   @id @default(cuid())
  storyArcPageId String   @map("story_arc_page_id")   // Page(type=story_arc), Cascade
  pageId         String   @map("page_id")             // Cascade
  role           StoryArcEntityRole @default(npc)
  sortIndex      Int?
  createdAt      DateTime @default(now())
  @@unique([storyArcPageId, pageId, role])
}
```

Dazu **Datenreparaturen ohne Schemarisiko**:

- `PlayerQuestion.campaignId` ist heute ein loses String-Feld ohne Relation
  (Waisen beim Kampagnen-Löschen) → echte FK mit `SetNull`, vorher Waisen
  auf `null` setzen.
- One-Shot-Ergebnisse werden ohne `campaignId` angelegt und brechen damit
  als einzige Fläche aus der Kampagnenstruktur aus → Kampagnen-Auswahl im
  One-Shot-Formular.
- `doc-import` erzeugt nie `type=story_arc`, obwohl das Cockpit „importiere
  ein Kampagnenbuch, dessen Kapitel hier ankommen" verspricht → Import
  markiert Kapitel-Ebene des Seitenbaums als `story_arc` (Frontmatter-Feld).

**Keine Daten-Migration der Flächen selbst nötig**: Radar/Cockpit/Sessions
lesen alle aus denselben Tabellen; die Vereinigung ist Routen-, Navigations-
und Service-Arbeit, kein Datenumzug.

### Etappen (je ein PR, jederzeit deploybar)

| Etappe | Inhalt | Schema? |
|---|---|---|
| **0 — Bugfixes** ✅ | Druck-Buttons (Route-Allowlist + Matcher-Fix), Session-Löschung, RBAC-Guards für Radar/Dungeons/Open-Items | nein |
| **1 — Zusammenlegen** ✅ | Radar-Karten (Dungeons, NSC-Stand) in den Kampagnen-Überblick, `/radar`-Redirect, Nav auf einen Eintrag „Kampagnen", Radar-Service aufgelöst (Overview erweitert, `formatClockLabel` → Kalender-Helfer), Weltuhr-Widget im Welt-Dashboard, „Vorbereiten" kampagnen-bewusst (`?campaign=` + `?sessionId=` echt), Akt-Tafel „Im Akt wichtig" aus Kapitel- + Quest-Texten | nein |
| **2 — Session↔Kapitel + Spielabend** | Migration (oben), Kapitel-Dropdown an Session, Spielabend-Ansicht v1 (Akt-Tafel + Lesefläche + Protokoll), NSC-Pinnen | **ja** |
| **3 — Portal-Notizen** | Session-Auswahl im Notizen-Panel, `take:1`-Kampagnen-Bug beheben, Tischmodus mit aktiver Session (Abschnitt 6) | nein |
| **4 — Dungeon-Flow + Aufräumen** | Dungeon↔Kapitel-UI, Raum-Cockpit-Rückweg + Schnell-Protokoll, tote Radar-Links, zweite Nav-Quelle (`studio-navigation.ts`) konsolidieren, `campaigns/`-Stub entfernen | nein |

Jede Etappe zieht die Bereichs-Skills nach (`pnpm skills:sync` +
Prosa-Teil), sonst wird der Build rot.

---

## 6. Spielernotizen im Portal: Session → Kampagne automatisch

Die gewünschte Kette **Notiz → Session → Kampagne** ist im Schema fertig
(`PlayerNote.gameSessionId` optional, `campaignId` Pflicht) und auf der
Session-Detailseite des Portals sogar schon verdrahtet. Kaputt sind die
zwei anderen Wege:

1. **Notizen-Übersicht** und **Offline-Snapshot** wählen die Kampagne als
   „erste der Welt" (`take: 1`) — bei mehreren Kampagnen landen Notizen in
   der falschen. Fix: Kampagne aus der gewählten Session ableiten; ohne
   Session die Kampagne der **letzten für Spieler sichtbaren Session**.
2. **Tischmodus** setzt `gameSessionId` hart auf `null`. Fix: der
   Offline-Snapshot bekommt die **aktive Session** (die jüngste mit
   `playerVisibleSchedule` bzw. die letzte veröffentlichte) mitgeliefert;
   `TableModeClient` hängt sie an neue Notizen. Das Feld reist durch
   Sync-Schema und `note-sync.ts` bereits vollständig durch.

Im Notizen-Panel wird die Session als Dropdown wählbar (Default: aktive
Session), damit auch nachträgliche Notizen richtig hängen. Der DM sieht in
seiner Review-Queue heute schon `Session N: Titel` — je mehr Notizen eine
Session tragen, desto besser funktionieren Abschluss-Assistent und Recaps.

---

## 7. Nebenbefunde aus der Bestandsaufnahme

Bereits in Etappe 0 behoben:

- **Route-Allowlist**: `kapitel-druck` fehlte in `PROTECTED_ROUTE_PREFIXES`
  → 404 „API-Route nicht gefunden". Dabei fand sich ein Matcher-Bug:
  Muster mit `*` in der Mitte **und** `/*` am Ende (z. B.
  `/api/worlds/*/spotify/*`, `/api/worlds/*/brain/*`) matchten nie — in
  Produktion waren damit auch Spotify-Soundboard, Brain-Einträge,
  `/api/tags`, `/api/dnd/*`, Slug-Prüfung, Druck-Warteschlange u. a. tot.
- **Session-Löschung**: existierte auf keiner Ebene (Service, Action, UI).
- **RBAC**: `/radar`, `/dungeons`, `/open-items` prüften die Welt-Zuordnung
  nicht (`requireStudioWorldRead` fehlte).

Offen (in den Etappen verplant):

- Tote Links im Radar auf `/npcs` und `/fraktionen` (Seiten existieren im
  Studio nicht).
- Zwei konkurrierende Nav-Quellen (`src/navigation/world-nav.ts` vs.
  `src/lib/studio-navigation.ts`) mit unterschiedlichen Labels.
- `PartyTreasury` und `RollTable` kennen keine Kampagne (bewusst? siehe F6).

---

## Offene Fragen (bitte entscheiden)

Entschieden am 2026-08-05: **F1 ja** (Dashboard + Redirect) · **F2 flach** ·
**F3 ja** (Kapitel-Vorschlag beim Anlegen) · **F4 beides** (Ableitung + Pinnen) ·
**F5 frei wählbar, ohne Auswahl automatisch** · **F6 eigenes Werkzeug, aber
bessere Verbindung** · **F7 Reihenfolge wie geplant**. Der Wortlaut der Fragen
bleibt unten als Begründungs-Archiv stehen.

**F1 — Wohin mit dem Welt-Blick des Radars?**
Der Radar ist heute der einzige Ort, der Weltuhr + Chronik + Fraktionen
welt-weit nebeneinander zeigt. Empfehlung: diese Karten ins bestehende
Welt-Dashboard heben, `/radar` leitet auf den Kampagnen-Überblick weiter.
Alternative: Radar bleibt als reine Welt-Lage-Seite bestehen (dann aber
ohne die Kampagnen-Karten). **Empfehlung: Dashboard + Redirect.**

**F2 — Braucht es eine echte Akt-Ebene über den Kapiteln?**
Heute: Kampagne → Kapitel (flach), „Akt" ist Namenskonvention im Titel.
Eine echte Ebene (Akt → Kapitel) ginge über `parentPageId` ohne neues
Modell, macht aber jede Liste und den Import komplexer. **Empfehlung:
flach lassen; der Spielabend zeigt ein Kapitel = einen Akt.** Wenn deine
Kampagnen typischerweise „Akt II, Kapitel 3" haben, sag es — dann planen
wir die Ebene gleich in Etappe 2 ein.

**F3 — Session↔Kapitel: automatisch oder manuell?**
Empfehlung: beim Anlegen wird das aktuelle Kapitel (erstes nicht gespielte)
**vorausgewählt**, per Dropdown änderbar; bestehende Sessions bleiben ohne
Kapitel, bis du sie zuordnest.

**F4 — Reicht die abgeleitete NSC-Tafel oder willst du pinnen?**
Ableitung aus `[[Wiki-Links]]` (Quest- + Kapiteltext) kommt ohne Migration
aus, zeigt aber nur, was verlinkt ist. Pinnen (`StoryArcEntityLink`) kostet
die kleine Migration und ein Stück UI. **Empfehlung: beides — Ableitung in
Etappe 1, Pinnen in Etappe 2.** Wenn du sauber verlinkst und die Ableitung
reicht, entfällt die zweite Tabelle.

**F5 — Spielernotizen: dürfen Spieler die Session frei wählen?**
Empfehlung: Dropdown mit Default „aktive Session", freie Wahl unter den
für Spieler sichtbaren Sessions. Alternative: immer automatisch die aktive
Session, kein Dropdown (weniger UI, aber nachträgliche Notizen hängen falsch).

**F6 — Wie tief soll das Dungeon-Modul einziehen?**
Empfehlung: Dungeons bleiben ein eigenes Werkzeug (eigene Liste, eigenes
Raum-Cockpit), bekommen aber die Kapitel-Kante + Auftritt im Spielabend.
Alternative wäre die volle Eingliederung unter `/kampagnen/[slug]/dungeons`
— mehr Umbau, wenig Zusatznutzen, und welt-weite Dungeons ohne Kampagne
gibt es ja weiterhin.

**F7 — Reihenfolge der Etappen ok?**
Insbesondere: Portal-Notizen (Etappe 3) vor oder nach dem Spielabend
(Etappe 2)? Wenn der nächste Spielabend bald ist und Notizen wichtiger sind,
lassen sich 2 und 3 tauschen — sie sind unabhängig.
