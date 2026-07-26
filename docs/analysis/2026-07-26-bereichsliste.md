# UWE — Vollständige Bereichsliste über alle vier Oberflächen

Stand: 2026-07-26 · **Arbeitsdokument zum Ausfüllen** · Basis: `main` @ `ce9c8b0`

Vollständig aus dem Code erhoben: 149 Studio-Seiten, 34 Portal-Seiten, 14 Brain-Seiten,
plus die vorgeschlagenen Family-Bereiche. Reine Detailansichten (`[id]`, `[slug]`) sind
unter ihrem Elternbereich zusammengefasst; eigenständig platzierbare Unterseiten stehen
als eigene Zeile, weil genau die Migrationskandidaten sind.

## Wie ausfüllen

In der letzten Spalte eintragen:

| Eintrag | Bedeutung |
|---|---|
| `OK` | Vorschlag passt, bleibt/geht wie vorgeschlagen |
| `→ Studio` / `→ Brain` / `→ Family` / `→ Portal` | gehört woanders hin |
| `WEG` | streichen |
| `?` | unklar, bitte nachfragen |

Die Spalte **Vorschlag** ist meine Empfehlung, nicht gesetzt. Wo ich unsicher bin, steht
das ausdrücklich dabei.

## Die vier Zielbereiche

| Bereich | Für wen | Datenklasse | Zugang |
|---|---|---|---|
| **Portal** | Mitspieler:innen | `player_visible` | Login + Welt-Mitgliedschaft |
| **Studio** | DM + Betrieb | `dm_only` / Plattform | Rolle owner/admin/dm |
| **Brain** | nur du | `owner_private_local` | Rolle owner |
| **Family** | Haushalt | `household_shared` *(neu)* | E-Mail-Allowlist durch Owner |

Faustregel: Stört es dich, wenn deine Partnerin/dein Partner es sieht → **Brain**. Muss die
Person es sehen, damit der Haushalt läuft → **Family**. D&D → **Studio** oder **Portal**.

---

# A · BRAIN — heute (14 Seiten)

Die Spalte „auch in Studio" zeigt die Doppelungen: **11 von 13** Brain-Bereichen existieren
zusätzlich in Studio, auf derselben Datenbank.

| # | Bereich | Pfad | auch in Studio | Vorschlag | Begründung | Entscheidung |
|---|---|---|---|---|---|---|
| A1 | Start | `/` | – | **Brain** | Einstieg der App | |
| A2 | Heute | `/today` | ⚠️ `/today` | **Brain** | persönlicher Tagesüberblick | |
| A3 | Wissen (Life Brain) | `/life-brain` | ⚠️ `/life-brain` | **Brain** | Kern von Brain | |
| A4 | Capture | `/capture` | ⚠️ `/capture` | **Brain** | persönlicher Eingang | |
| A5 | Projekte | `/projects` | ⚠️ `/projects` | **Brain** | persönliche Vorhaben | |
| A6 | Werkstatt | `/workshop` | ⚠️ `/workshop` | **Brain** | Hobby, kein Haushalt | |
| A7 | Miniaturen | `/miniatures` | ⚠️ `/miniatures` | **Brain** *(oder Studio, weil D&D-nah)* | unsicher — deine Entscheidung | |
| A8 | Verträge | `/contracts` | ⚠️ `/contracts` | **→ Family** | Haushaltsverträge | |
| A9 | Hardware | `/hardware` | ⚠️ `/hardware` | **Brain** *(oder Studio → System)* | unsicher — Homelab ist Betrieb | |
| A10 | Dokumente | `/documents` | ⚠️ `/documents` | **→ Family** | Urkunden, Policen | |
| A11 | Mail | `/mail`, `/mail/[id]` | ⚠️ `/mail` | **Brain** | persönliches Postfach, nicht geteilt | |
| A12 | Kalender | `/calendar` | ⚠️ `/calendar` | **aufteilen**: privat → Brain, Haushalt → Family | | |
| A13 | Login | `/login` | – | **Brain** | technisch nötig | |

---

# B · PORTAL — heute (34 Seiten)

Der sauberste Bereich. Ich schlage hier fast nichts vor.

## B.1 Portal-Rahmen

| # | Bereich | Pfad | Vorschlag | Begründung | Entscheidung |
|---|---|---|---|---|---|
| B1 | Meine Welten | `/auth/worlds` | **Portal** | Einstieg | |
| B2 | Passwort | `/auth/account/password` | **Portal** | | |
| B3 | Sicherheit (2FA) | `/auth/account/security` | **Portal** | | |
| B4 | Login / Passwort vergessen / zurücksetzen | `/login`, `/forgot-password`, `/reset-password` | **Portal** | | |
| B5 | Wartung | `/maintenance` | **Portal** | | |
| B6 | Freigabe-Link (anonym) | `/share/[token]`, `/share/[token]/pages/[slug]` | **Portal** | passwortgeschützte Freigaben | |
| B7 | Landing / Weiterleitung | `/`, `/portal` | **Portal** | reine Redirects | |
| B8 | Legacy-Weltpfade | `/worlds`, `/worlds/[slug]`, `/worlds/[slug]/[cat]/[slug]`, `/worlds/[slug]/graph` | **Portal** | reine Redirects, korrekt | |

## B.2 Welt-Ebene im Portal (15 Nav-Einträge)

| # | Bereich | Pfad `…= /auth/worlds/[slug]` | Vorschlag | Begründung | Entscheidung |
|---|---|---|---|---|---|
| B9 | Übersicht | `…/` | **Portal** | | |
| B10 | Wiki | `…/wiki`, `…/[slug]` | **Portal** | | |
| B11 | NPCs | `…/npcs` | **Portal** | | |
| B12 | Beziehungsnetz | `…/graph` | **Portal** | | |
| B13 | Sessions / Recaps | `…/sessions`, `…/sessions/[id]` | **Portal** | | |
| B14 | Gruppenschatz | `…/treasury` | **Portal** | | |
| B15 | Timeline | `…/timeline` | **Portal** — evtl. mit B13 zusammenlegen | vier Chronologie-Sichten nebeneinander | |
| B16 | Questlog | `…/quests` | **Portal** | | |
| B17 | Charaktere | `…/characters` | **Portal** | | |
| B18 | Handout-Postfach | `…/handouts` | **Portal** | | |
| B19 | Galerie | `…/assets` | **Portal** | | |
| B20 | Spielernotizen | `…/notes` | **Portal** | | |
| B21 | Fragen an den DM | `…/questions` | **Portal** | | |
| B22 | Soundboard | `…/soundboard` | **Portal** | | |
| B23 | Atlas 3D | `…/atlas3d`, `…/atlas3d/[nodeId]` | abhängig von **E7** | 21.750 Zeilen Code — Grundsatzfrage | |
| B24 | Atlas (2D) *(ohne Nav-Eintrag)* | `…/atlas` | **WEG** | verwaister Vorgänger von B23 | |
| B25 | Gruppierung der 15 Einträge | – | Vorschlag: „Nachschlagen" (B10–B12, B17–B19) / „Mitspielen" (B13–B16, B20–B23) | 15 Einträge auf einer Ebene | |

---

# C · STUDIO — Hauptnavigation (7 Sektionen, 34 Einträge)

| # | Sektion → Bereich | Pfad | heute sichtbar für | Vorschlag | Begründung | Entscheidung |
|---|---|---|---|---|---|---|
| C1 | Start → Heute | `/today` | owner/admin/dm | **Studio** | DM-Cockpit | |
| C2 | Start → Schnell erfassen | `/capture?quick=1` | owner/admin/dm | **→ Brain** | persönlicher Eingang | |
| C3 | Start → Suche | `/search` | owner/admin/dm | **Studio** | jeder Bereich braucht eigene Suche | |
| C4 | Welten → Alle Welten | `/worlds` | owner/admin/dm | **Studio** | | |
| C5 | Knowledge → Brain Store | `/brain` | owner/admin/dm | **Studio**, **umbenennen** → „Welt-Wissen" | „Brain" meint hier D&D-Kanon, nicht die Brain-App | |
| C6 | Knowledge → Life Brain | `/life-brain` | owner | **→ Brain** | | |
| C7 | Knowledge → Wissensassistent | `/knowledge` | owner | **→ Brain** | | |
| C8 | Knowledge → Life-Brain Chat | `/life-brain/chat` | owner | **→ Brain** | | |
| C9 | AI → KI & Generatoren | `/ai` | owner/admin/dm | **Studio** | D&D-Generatoren | |
| C10 | AI → AI Gateway | `/admin/ai-gateway` | owner/admin | **Studio → System** | Plattform, nicht D&D | |
| C11 | AI → Prompt-Konsole | `/admin/ai-prompt` | owner/admin | **Studio → System** | Plattform | |
| C12 | Werkzeuge → Capture / Inbox | `/capture`, `/capture/[id]` | owner/admin/dm | **→ Brain** | | |
| C13 | Werkzeuge → Scan Inbox | `/scan-inbox`, `/scan-inbox/[id]` | owner/admin/dm | **→ Family** | scannt Belege und Verträge | |
| C14 | Werkzeuge → Mach weiter | `/continue` | owner/admin/dm | **WEG** | 61 Zeilen, inhaltlich in `/today` enthalten | |
| C15 | Werkzeuge → Finanzen / Abos | `/finance` | owner/admin/dm | **→ Family** *(oder Brain)* | Haushaltskosten vs. private Finanzen — deine Entscheidung | |
| C16 | Werkzeuge → Haushalt | `/household` | owner/admin/dm | **→ Family** | enthält heute Platzhalter-Inhalte | |
| C17 | Werkzeuge → Küche | `/kitchen` | owner/admin/dm | **→ Family** | | |
| C18 | └ Rezepte | `/kitchen/recipes`, `/kitchen/recipes/[id]` | – | **→ Family** | | |
| C19 | └ Essensplan | `/kitchen/plan` | – | **→ Family** | von dir ausdrücklich gewünscht | |
| C20 | └ Einkaufsliste | `/kitchen/shopping` | – | **→ Family** | mehrere schreiben drauf | |
| C21 | └ Vorrat | `/kitchen/pantry` | – | **→ Family** | | |
| C22 | Werkzeuge → Templates | `/templates`, `/templates/new`, `/templates/[id]` | owner/admin/dm | **Studio** | Seitenvorlagen für Welten | |
| C23 | Werkzeuge → Prompt-Bibliothek | `/prompts`, `/prompts/[id]` | owner/admin/dm | **Studio**, hinter Entwickler-Schalter | Werkzeug für den Werkzeugbau | |
| C24 | Werkzeuge → Image Studio | `/image-studio` + 2 Unterseiten | owner/admin/dm | **Studio** | | |
| C25 | Werkzeuge → Import-Zentrale | `/import` | owner/admin/dm | **Studio** | | |
| C26 | Werkzeuge → Reviews | `/admin/reviews` | owner/admin | **Studio** | Kanon-Freigaben | |
| C27 | Werkzeuge → Cursor Agent Jobs | `/admin/agent-jobs` | owner/admin | **Studio**, hinter Entwickler-Schalter | | |
| C28 | Werkzeuge → Hintergrund-Jobs | `/jobs` | owner/admin | **Studio → System** | Betrieb | |
| C29 | Organisation → Projekte | `/projects`, `/projects/[id]` | owner/admin/dm | **→ Brain** | | |
| C30 | Organisation → Verträge | `/contracts` | owner/admin | **→ Family** | | |
| C31 | Organisation → Dokumente | `/documents` | owner/admin | **→ Family** | enthält heute Platzhalter-Inhalte | |
| C32 | Organisation → Werkstatt | `/workshop`, `/workshop/[id]` | owner/admin/dm | **→ Brain** | | |
| C33 | └ Druckprofile | `/workshop/print-profiles` | – | **→ Brain** | | |
| C34 | └ Farbrezepte | `/workshop/recipes` | – | **→ Brain** | | |
| C35 | └ Geländeverleih | `/workshop/rental` | – | **→ Brain** *(oder Family, wenn andere buchen)* | unsicher | |
| C36 | Organisation → Miniaturen | `/miniatures` | owner/admin/dm | **→ Brain** *(oder Studio)* | siehe A7 | |
| C37 | Organisation → Ideen | `/ideas` | owner | **→ Brain**, hinter Entwickler-Schalter | Produktideen für UWE selbst | |
| C38 | Organisation → Bug-Center | `/bugs` | owner/admin/dm | **Studio**, hinter Entwickler-Schalter | | |
| C39 | Organisation → Hardware / Homelab | `/hardware` | owner/admin | **→ Brain** *(oder Studio → System)* | siehe A9 | |
| C40 | Organisation → Mail | `/mail`, `/mail/compose` | owner/admin | **→ Brain** | | |
| C41 | Organisation → Kalender | `/calendar` | owner/admin/dm | **aufteilen**: Haushalt → Family, Session-Termine → Studio | | |

> Bei Zustimmung verliert Studio 15 Einträge; die Sektionen **„Organisation"** und
> **„Werkzeuge → Erfassen & Alltag"** entfallen ganz.

---

# D · STUDIO — System & Admin (32 Einträge, zwei konkurrierende Hubs)

`ADMIN_HUB_SECTIONS` (Kacheln auf `/admin`) und `SYSTEM_NAV` (Sidebar) listen weitgehend
dieselben Ziele doppelt.

| # | Gruppe → Bereich | Pfad | Vorschlag | Begründung | Entscheidung |
|---|---|---|---|---|---|
| D1 | Übersicht → System-Hub | `/system` | **behalten** — *der* Betriebseinstieg | 512 Zeilen, Tabs: overview/homelab/diagnose/cloudflare | |
| D2 | Übersicht → Admin Übersicht | `/admin` | **WEG** → Redirect auf `/system` | zwei Hubs für eine Sache | |
| D3 | Übersicht → Owner Cockpit | `/admin/cockpit` | **WEG** → Tab in `/system` | | |
| D4 | Übersicht → Verlauf | `/admin/activity` | behalten | | |
| D5 | Übersicht → NL-Befehle | `/command` | behalten *oder* in Suche (C3) integrieren | | |
| D6 | Übersicht → Navigation | `/system/navigation` | Entwickler-Schalter | 23 Zeilen | |
| D7 | Setup → Owner-Einrichtung | `/admin/setup` | behalten | | |
| D8 | Setup → Aufgabenliste | `/admin/checklist` | behalten | | |
| D9 | Setup → Systemstatus | `/admin/status` | **WEG** | 9 Zeilen, doppelt zu D1 | |
| D10 | Setup → Kommandozentrale | `/system/command-center` | **WEG** | 30 Zeilen, doppelt zu D5 | |
| D11 | Setup → Host Control | `/system/host-control` | behalten | | |
| D12 | Setup → Cloudflare | `/system/cloudflare` | behalten — Platzhalter-Inhalt prüfen | | |
| D13 | Setup → RTX Connector | `/system/rtx-connector` | behalten | | |
| D14 | Setup → Drucker | `/system/printers` | behalten | | |
| D15 | Sicherheit → Benutzer & Rollen | `/admin/users` | behalten — **hier kommt die Family-Allowlist rein** | | |
| D16 | Sicherheit → Rollen-Matrix | `/admin/roles` | **WEG oder erzwingen** | zeigt heute eine wirkungslose Tabelle | |
| D17 | Sicherheit → Security | `/admin/security` | behalten | | |
| D18 | Sicherheit → Audit Log | `/admin/audit-log` | behalten | | |
| D19 | Sicherheit → API Tokens | `/admin/api-tokens` | behalten | | |
| D20 | Sicherheit → Webhooks | `/admin/webhooks` | behalten | | |
| D21 | Sicherheit → Secrets-Status | `/admin/secrets` | behalten | | |
| D22 | Betrieb → Backup & Restore | `/backup` | behalten | | |
| D23 | Betrieb → Migrationen | `/admin/migrations` | behalten | | |
| D24 | Betrieb → Version & Updates | `/system/version` | behalten | | |
| D25 | Betrieb → Was ist neu | `/system/whats-new` | **WEG** → in D24 integrieren | 39 Zeilen | |
| D26 | Betrieb → Startklar | `/system/startklar` | **WEG** → in D24 integrieren | 198 Zeilen, einmal pro Update relevant | |
| D27 | Betrieb → Health-Ampel | `/system/health` | **WEG** → Tab in D1 | 28 Zeilen | |
| D28 | Betrieb → Diagnose | `/system?tab=diagnose` | behalten (ist bereits Tab) | | |
| D29 | Betrieb → UWE KnowHow | `/system/uwe-knowhow` | **WEG** | 27 Zeilen Selbstdokumentation | |
| D30 | Betrieb → Tags | `/admin/tags` | behalten | | |
| D31 | Betrieb → Mail Center | `/mail` | **→ Brain** (siehe C40) | | |
| D32 | Betrieb → Cookbook *(ohne Nav)* | `/admin/cookbook` | behalten oder **WEG** | Hardware-Fit + lokale Modelle | |
| D33 | Einstellungen | `/settings` | behalten — **aufteilen** | 905 Zeilen, 11 Gruppen: app, worlds, campaigns, portal, ai, storage, backup, briefing, privacy, auth, maintenance | |
| D34 | Konto → Passwort / 2FA | `/account/password`, `/account/security` | behalten | | |

---

# E · STUDIO — Welt-Ebene (31 Einträge pro Welt)

Alle sichtbar für owner/admin/dm.

| # | Gruppe → Bereich | Pfad `…= /worlds/[slug]` | Vorschlag | Begründung | Entscheidung |
|---|---|---|---|---|---|
| E1 | Übersicht → Übersicht | `…/dashboard` | behalten | | |
| E2 | Übersicht → Kampagnen-Radar | `…/radar` | **zusammenlegen** mit E27/E28/E29 | vier „Was ist offen?"-Werkzeuge | |
| E3 | Wiki → Wiki / Seiten | `…/wiki`, `…/[cat]/[slug]`, `…/[cat]/[slug]/edit` | behalten | | |
| E4 | Wiki → Seiten-Review | `…/page-review`, `…/page-review/[pageId]` | behalten | | |
| E5 | Wiki → Neue Seite | `…/pages/new` | behalten — evtl. Button statt Nav-Eintrag | ist eine Aktion, kein Bereich | |
| E6 | Wiki → Verbindungen / Graph | `…/graph` | behalten | | |
| E7 | Wiki → **Atlas 3D** | `…/atlas3d`, `…/atlas3d/[nodeId]` | **Grundsatzfrage** | 3 Packages, 21.750 Zeilen (6,7 % des Codes) für diese eine Seite | |
| E8 | Wiki → Atlas (2D) *(ohne Nav)* | `…/atlas` | **WEG** | verwaister Vorgänger | |
| E9 | Wiki → Magic-Item-Werkbank | `…/magic-items`, `…/magic-items/[pageId]` | behalten | | |
| E10 | Spiel → Sessions | `…/sessions`, `…/sessions/new`, `…/sessions/[id]` | behalten | | |
| E11 | Spiel → Weltuhr | `…/calendar` | behalten | | |
| E12 | Spiel → Chronik | `…/chronicle` | behalten *oder* mit E11 zusammen | | |
| E13 | Spiel → Session vorbereiten | `…/prepare-session` | behalten | | |
| E14 | Spiel → Session-Nachbereitung | `…/sessions/[id]/review` | behalten | | |
| E15 | Spiel → One-Shot-Generator | `…/one-shot` | behalten | | |
| E16 | Spiel → Was ist offen? | `…/open-items` | **zusammenlegen** (siehe E2) | | |
| E17 | Spiel → Gruppenschatz | `…/treasury` | behalten | | |
| E18 | Spiel → Zufallstabellen | `…/roll-tables` | behalten | | |
| E19 | Spiel → Spielernotizen | `…/notes` | behalten | | |
| E20 | Spiel → Spielerfragen | `…/questions` | behalten | | |
| E21 | Spiel → Dungeons | `…/dungeons` + 4 Unterseiten | behalten — Platzhalter-Inhalte prüfen | | |
| E22 | Medien → Medien / Assets | `…/assets` | behalten | | |
| E23 | Medien → Soundboard | `…/soundboard` | behalten | | |
| E24 | Medien → Labels & Print | `…/labels` + 5 Unterseiten | behalten | | |
| E25 | Medien → Print Center | `…/print-center`, `…/characters/print` | **zusammenlegen** mit E24 | | |
| E26 | Wissen & KI → Brain / Wissen | `…/brain` + 2 Unterseiten | behalten (umbenennen, siehe C5) | | |
| E27 | Wissen & KI → KI-Läufe | `…/ai-runs`, `…/ai-runs/[runId]` | behalten | | |
| E28 | Wissen & KI → DnD API | `…/dnd-api` | behalten | | |
| E29 | Wissen & KI → Import | `…/import` | behalten | | |
| E30 | Freigabe → Inspector / Kanon | `…/inspector` | **zusammenlegen** (siehe E2) | | |
| E31 | Freigabe → Wiki-Pflege | `…/quality` | **zusammenlegen** (siehe E2) | | |
| E32 | Freigabe → Backup | `…/backup` | **WEG** → globales `/backup` (D22) reicht | | |
| E33 | Live-Session (4 Einträge) | `…/sessions/[id]/live` u. a. | behalten | kontextabhängige Nav, korrekt getrennt | |

---

# F · STUDIO — Seiten ohne Nav-Eintrag

Zur Vollständigkeit; hier ist vermutlich nichts zu entscheiden.

| # | Bereich | Pfad | Vorschlag | Entscheidung |
|---|---|---|---|---|
| F1 | Landing / Redirects | `/`, `/studio`, `/portal` | behalten (Redirects) | |
| F2 | Auth | `/login`, `/logout`, `/setup`, `/forgot-password`, `/reset-password` | behalten | |
| F3 | Wartung | `/maintenance` | behalten | |

---

# G · FAMILY — neu vorgeschlagen

## G.1 Was aus A–F hierher wandert

| # | Bereich | kommt aus | Entscheidung |
|---|---|---|---|
| G1 | Verträge | A8 / C30 | |
| G2 | Dokumente | A10 / C31 | |
| G3 | Küche & Rezepte | C17 / C18 | |
| G4 | Essensplan | C19 | |
| G5 | Einkaufsliste | C20 | |
| G6 | Vorrat | C21 | |
| G7 | Haushalt | C16 | |
| G8 | Finanzen / Abos | C15 *(unsicher — evtl. Brain)* | |
| G9 | Familien-Kalender | A12 / C41 (Teilmenge) | |
| G10 | Scan-Eingang | C13 | |

## G.2 Was in Family neu entsteht

| # | Bereich | Vorschlag | Entscheidung |
|---|---|---|---|
| G11 | Start / Heute | Was steht heute an, was fehlt im Vorrat | |
| G12 | Family-Chatbot | siehe G.2a | |
| G13 | Mitglieder & Freigaben | nur Owner: E-Mail einladen, Bereiche freischalten | |

### G.2a Family-Chatbot im Detail

| Aspekt | Vorschlag | Entscheidung |
|---|---|---|
| Datenbasis | **nur Family-Daten** (Verträge, Dokumente, Essensplan, Kalender, Haushalt). Kein Zugriff auf Brain, kein Zugriff auf D&D | |
| Provider | **lokal erzwungen** (RTX-Connector / Ollama) — Haushaltsdokumente gehen nicht in die Cloud | |
| Antwortumfang | pro Person gefiltert: wer Verträge nicht freigeschaltet hat, bekommt daraus auch keine Antwort | |
| Wiederverwendung | baut auf `@uwe/ai-brain` + `privacyGuard` auf, **kein** neuer Router — nur ein neuer Kontext-Modus `family` | |

Die Privacy-Mechanik dafür existiert bereits und greift nachweislich
(`packages/ai-brain/src/router/privacyGuard.ts`, eingebunden in `aiRouter.ts`).

## G.3 Zugang — Vorschlag

Kein neuer globaler Rollenwert, sondern ein Membership-Modell analog `WorldMembership`:

```
FamilyMember
  userId    → User
  email     → vom Owner freigegebene Adresse (Einladung)
  areas     → contracts | documents | meals | calendar | household | finance
  status    → invited | active | revoked
```

Damit ist pro Person entscheidbar: Partner:in sieht Verträge und Essensplan, Kinder nur
Essensplan und Kalender. Eine flache Rolle könnte das nicht.

| # | Frage | Vorschlag | Entscheidung |
|---|---|---|---|
| G14 | Eigene App (`apps/family`) oder Bereich in Studio? | **eigene App** — sonst wiederholen wir das Brain/Studio-Duplikat | |
| G15 | Eigene DB (`uwe-family.db`) oder Brain-DB mitnutzen? | **eigene DB** — sonst bricht die `owner_private_local`-Zusicherung der Brain-DB | |
| G16 | Dürfen Family-Mitglieder ins Portal oder Studio? | **nein**, strikt getrennt | |
| G17 | Chatbot: lokal erzwungen oder Cloud erlaubt? | **lokal erzwungen** — Haushaltsdokumente gehen nicht in die Cloud | |
| G18 | Feingranular pro Bereich freischalten? | **ja** (`areas`) | |

## G.4 Technische Folge (nur zur Information)

- Neue Audience `family` in `packages/product-contracts`, neue Privacy-Klasse
  `household_shared`
- **~14 Prisma-Modelle** wandern aus der Brain-DB in eine Family-DB: `ContractExpense`,
  `DocumentTemplate`, `Recipe`, `RecipeIngredient`, `MealPlanWeek`, `MealPlanEntry`,
  `ShoppingList`, `ShoppingListItem`, `BringConnection`, `PantryItem`, `MaintenanceTask`,
  `ScanDocument`, `CalendarFeed`, `CalendarEvent`
- Studio verliert dadurch rund die Hälfte seiner 108 Direktimporte auf
  `@uwe/database/brain-client` — der Umbau entlastet die Architektur, statt sie zu belasten

---

# H · Die 11 Doppelungen — bitte je Zeile entscheiden

Diese Bereiche existieren **heute zweimal**, in Brain und in Studio, auf derselben
Datenbank. Solange das so bleibt, erzeugt jeder neue Bereich eine dritte Kopie.

| # | Bereich | Brain | Studio | LOC Brain / Studio | Entscheidung: welche Seite gewinnt? |
|---|---|---|---|---|---|
| H1 | Heute | `/today` | `/today` | 74 / 202 | |
| H2 | Wissen / Life Brain | `/life-brain` | `/life-brain` | 227 / 193 | |
| H3 | Capture | `/capture` | `/capture` | 156 / 49 | |
| H4 | Projekte | `/projects` | `/projects` | 216 / 522 | |
| H5 | Werkstatt | `/workshop` | `/workshop` | 159 / 451 | |
| H6 | Miniaturen | `/miniatures` | `/miniatures` | 157 / 277 | |
| H7 | Verträge | `/contracts` | `/contracts` | 172 / 513 | *(→ Family, dann beide weg)* |
| H8 | Hardware | `/hardware` | `/hardware` | 148 / 641 | |
| H9 | Dokumente | `/documents` | `/documents` | 135 / 143 | *(→ Family, dann beide weg)* |
| H10 | Mail | `/mail` | `/mail` | 225 / 136 | |
| H11 | Kalender | `/calendar` | `/calendar` | 215 / 405 | |

Zwei saubere Wege, ein dritter ist keiner:

- **(A) Brain gewinnt** — Studios „Organisation" wird zu Redirects. Studio ist wieder reine
  DM-App, `product-contracts` stimmt, die 108 `brain-client`-Importe verschwinden.
  Kosten: Brain muss ~3.700 Zeilen Funktionalität aufholen.
- **(B) Studio gewinnt** — `apps/brain` wird gelöscht (3.400 Zeilen), Life-Brain-Inhalte
  bleiben in Studio hinter `owner`. Sofort umsetzbar, aber dann muss
  `product-contracts` weg, weil das Produktmodell aufgegeben wird.
- **(C) Status quo** — doppelte Wartung ohne Produktargument.

---

# I · Zielbild, wenn du allen Vorschlägen folgst

| Bereich | Anzahl | Inhalt |
|---|---|---|
| **Portal** | 18 | unverändert (minus Atlas-2D-Leiche) |
| **Studio** | 19 + Welt-Ebene | Start · Welten · Welt-Wissen · KI · Werkzeuge · System |
| **Brain** | 11 | Heute · Life Brain · Wissensassistent · Chat · Capture · Projekte · Werkstatt · Miniaturen · Hardware · Mail · Ideen |
| **Family** | 13 | Start · Verträge · Dokumente · Küche · Essensplan · Einkaufsliste · Vorrat · Haushalt · Finanzen · Kalender · Scan · Chat · Mitglieder |

Gestrichen: 12 Bereiche (C14, D2, D3, D9, D10, D25, D26, D27, D29, E8, E32, B24).
Zusammengelegt: 4 Welt-Werkzeuge → 1, Print Center → Labels, Admin-Hub → System-Hub.

---

# J · Reihenfolge, die ich empfehle

1. ~~Rechte-Lücken B1/B2 schließen~~ — **erledigt** (PR #797, gemergt)
2. **Diese Liste ausfüllen** ← wir sind hier
3. **Abschnitt H entscheiden** (Brain oder Studio) — davon hängt ab, wohin Family gebaut wird
4. **Family bauen** — `FamilyMember`, eigene DB, lokal erzwungener Chat
5. Verschlankung (Streichungen und Zusammenlegungen aus C–E) nebenher
