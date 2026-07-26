# UWE — Vollständige Bereichsliste über alle vier Oberflächen

**Arbeitsdokument zum Ausfüllen** · Aktualisiert: 2026-07-26 abends · Basis: `main` @ `2cf0ae7`

Vollständig aus dem Code erhoben: 149 Studio-Seiten, 34 Portal-Seiten, 16 Brain-Seiten,
1 Landing-Seite, plus die vorgeschlagenen Family-Bereiche. Reine Detailansichten (`[id]`,
`[slug]`) sind unter ihrem Elternbereich zusammengefasst; eigenständig platzierbare
Unterseiten stehen als eigene Zeile, weil genau die die Migrationskandidaten sind.

> ### Aktualisierung gegenüber der ersten Fassung
>
> | | Änderung | Wo in dieser Liste |
> |---|---|---|
> | 🆕 | **`apps/landing`** — fünfte Oberfläche auf dem Apex-Origin | neuer Abschnitt **L** |
> | 🆕 | **Brain KI-Chat** (`/ki-chat`) | neue Zeile **A14**, und **G12** hat jetzt eine Vorlage |
> | ✅ | Brain-Nav ist ein Modul mit Suche (`brain-nav.ts`) | Anmerkung bei **A** |
> | 🆕 | **Bereichs-Suchleiste** in allen drei Apps | neue Zeilen **C42**, **B26**, **A15** |
> | 💤 | **`terra.html`** — Karteneditor, nirgends eingebunden | **zurückgestellt**, siehe **E34** |
>
> Neu zu entscheiden sind damit die Zeilen A14, A15, B26, C42, L1–L4. (E34 ist
> zurückgestellt.)
> Die Rechte-Lücken B1/B2 aus der Zustandsanalyse sind erledigt (PR #797) — Abschnitt J
> ist entsprechend fortgeschrieben.

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

---

## Notiz Lasse (2026-07-26)

> Allgemein gilt, nur leute die auf der E-Mail-Allowlist stehen können in den Ihnen
> zugeordneten Bereich von UWE kommen.
> Ein eigenständiges Benutzerkonto anlegen ist nicht möglich NUR durch den Owner.
> Ich würde gerne die „Player_Visible", „DM_only", „owner_private_Local",
> „household_shared" gesamtfassend entfernen
> Und durch einen neuen Bereich Im UWE Commandcenter ersetzen. Hier hinterlege ich eh neue
> Mail adressen und ich möchte einfach nur anhaken können:
> Portal Ja/Nein, Studio Ja/Nein, Brain Ja/Nein, Family Ja/Nein
> Das UWE Commandcenter ist von natur aus nur durch den Owner zu steuern (Eigener PC)

**Einordnung dazu in [Abschnitt N](#n--zugangsmodell-nach-notiz-lasse).** Kurzfassung: Das
Häkchen-Modell ist die richtige Antwort auf die Frage „wer darf in welche App" und ersetzt
dort mehr, als du vermutlich erwartest — Rollen-Enum, Capability-Matrix und
`FamilyMember.areas` können weg. Zwei der vier Labels erledigen aber eine *andere* Aufgabe
als Zugang, und die bleibt offen: `dm_only`/`player_visible` steuern, was **innerhalb einer
Welt** sichtbar ist, und `owner_private_local` steuert, **was den Host verlassen darf**.
Details und Entscheidungszeilen dort.

---

## Die fünf Zielbereiche

| Bereich | Für wen | Datenklasse | Zugang |
|---|---|---|---|
| Bereich | Für wen | Zugang künftig (Notiz Lasse) |
|---|---|---|
| **Landing** | alle Besucher | keiner — nur Startseite + Login-Weiche |
| **Portal** | Mitspieler:innen | Häkchen `Portal` |
| **Studio** | DM + Betrieb | Häkchen `Studio` |
| **Brain** | nur du | Häkchen `Brain` |
| **Family** | Haushalt | Häkchen `Family` |
| **Command Center** | nur du, lokal | kein Häkchen — läuft auf deinem PC |

Es sind inzwischen **sechs** Oberflächen. `apps/landing` ist seit PR #796 eine eigene App
auf dem Apex-Origin; das **Command Center** (`tools/uwe-host-command-center`, 3.310 Zeilen)
ist der lokale Steuerstand auf deinem Rechner. Beide tragen keine Weltinhalte, deshalb
stehen sie am Ende der Liste (Abschnitte L und M) und nicht vorne.

Faustregel: Stört es dich, wenn deine Partnerin/dein Partner es sieht → **Brain**. Muss die
Person es sehen, damit der Haushalt läuft → **Family**. D&D → **Studio** oder **Portal**.

---

# A · BRAIN — heute (16 Seiten)

Die Spalte „auch in Studio" zeigt die Doppelungen: **11 von 15** Brain-Bereichen existieren
zusätzlich in Studio, auf derselben Datenbank.

> Seit PR #798 kommt die Brain-Navigation aus `apps/brain/src/navigation/brain-nav.ts`
> statt aus einem handgeschriebenen Array in der Komponente — mit Keywords und
> Bereichssuche. Der Item-Typ ist allerdings weiterhin ein eigener, nicht das `NavGroup`
> aus `@uwe/shared-utils/navigation`, das Studio und Portal nutzen.

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
| **A14** | **KI-Chat** *(neu, PR #795)* | `/ki-chat`, `/ki-chat/[id]` | – | **Brain** | Bildanalyse + Diktat, `personal_brain` cloud-gesperrt. Vorlage für G12 | |
| **A15** | **Bereichssuche** *(neu, PR #798)* | Kopfzeile | ⚠️ auch Studio + Portal | **überall** | geteilte Suche über `@uwe/shared-utils/nav-search` — korrekt geteilt | |

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
| **B26** | **Bereichssuche** *(neu, PR #798)* | Kopfzeile | **Portal** | siehe A15 — entschärft B25 teilweise | |

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
| **C42** | **Bereichssuche** *(neu, PR #798)* | Kopfzeile | owner/admin/dm | **Studio** | ergänzt C3 (`/search`) — prüfen, ob beide nötig sind | |

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
| ~~E34~~ | `terra.html` *(PR #793)* | Repo-Root, nirgends eingebunden | 💤 **zurückgestellt** | 3.998 Zeilen, `file://`, three.js per CDN. Stört keinen Build; wird erst relevant, falls es produktiv werden soll | *zurückgestellt* |

---

# F · STUDIO — Seiten ohne Nav-Eintrag

Zur Vollständigkeit; hier ist vermutlich nichts zu entscheiden.

| # | Bereich | Pfad | Vorschlag | Entscheidung |
|---|---|---|---|---|
| F1 | Landing / Redirects | `/`, `/studio`, `/portal` | behalten (Redirects) | |
| F2 | Auth | `/login`, `/logout`, `/setup`, `/forgot-password`, `/reset-password` | behalten | |
| F3 | Wartung | `/maintenance` | behalten | |

---

# L · LANDING — neu seit PR #796 (1 Seite, 2 API-Routes)

Fünfte Oberfläche, 590 Zeilen, trägt den Apex-Origin `uweanddragons.org`. Die Middleware
arbeitet mit einer **vollständigen Allowlist**; unbekannte Seitenpfade werden dauerhaft
(308) auf denselben Pfad im Studio umgeleitet, unbekannte API-Pfade geben 404.

| # | Bereich | Pfad | Vorschlag | Begründung | Entscheidung |
|---|---|---|---|---|---|
| L1 | Startseite | `/` | **Landing** | öffentliche Visitenkarte | |
| L2 | Login-Weiche | `/api/auth/enter` | **Landing** | wählt Ziel: studio / portal / brain | |
| L3 | Health | `/api/health` | **Landing** | | |
| L4 | Studio-Variante von `/api/auth/enter` | `apps/studio/app/api/auth/enter` | **WEG** *(Empfehlung)* | liegt seit #796 doppelt vor, identische Logik an zwei Origins | |

> **Zu L4:** Das ist genau der Endpunkt, über den die Rechteausweitung aus Befund B1 lief.
> Der Exploit ist durch den Rollen-Check in PR #797 tot. Aber zwei Kopien einer
> Login-Zustandsmaschine an zwei Origins driften irgendwann auseinander — und dann gilt
> die Härtung womöglich nur für eine davon.

---

# M · UWE COMMAND CENTER — lokaler Steuerstand (3.310 Zeilen)

`tools/uwe-host-command-center` — kein Web-Bereich, sondern ein lokaler Dienst auf deinem
PC mit `dashboard.html` als Oberfläche. Kein Login, keine Rollen: **wer den Rechner hat,
hat das Command Center.** Deshalb ist es der richtige Ort für die E-Mail-Allowlist.

## M.1 Was heute drin ist

| # | Bereich | Quelle | Vorschlag | Entscheidung |
|---|---|---|---|---|
| M1 | UWE Erreichbarkeit | `uwe-health.ts` | behalten | |
| M2 | systemd Dienste & Timer | `service-journal.ts` | behalten | |
| M3 | Host-Steuerung | `control.ts` | behalten | |
| M4 | Host-Sicherheit | `snapshot.ts` | behalten | |
| M5 | Offene Ports | `snapshot.ts` | behalten | |
| M6 | Fehlgeschlagene Anmeldungen | `snapshot.ts` | behalten | |
| M7 | Letzte Fehler | `service-journal.ts` | behalten | |
| M8 | UWE Journal (Auszug) | `service-journal.ts` | behalten | |
| M9 | Host-Update | `desktop-host-update.ts` | behalten | |
| M10 | Cloudflare-Tunnel | `cloudflare-tunnel-cli.ts` | behalten | |
| M11 | Lokalen Connector einrichten | `provision-local-connector.ts` | behalten | |
| M12 | **Benutzerverwaltung** *(CLI, ohne eigene Dashboard-Kachel)* | `user-admin-cli.ts` | **→ M13 ausbauen** | |

> **M12 ist der Anknüpfungspunkt.** `user-admin-cli.ts` kann schon
> `list` / `create` / `update` / `set-password` / `delete` und nimmt heute ein
> `role`-Feld (`owner`/`admin`/`dm`/`player`). Aus diesem einen Feld werden die vier
> Häkchen. Kommentar in der Datei: *„Lets the desktop app provision the owner and every
> other user without the Studio web UI"* — also genau dafür gebaut.

## M.2 Was nach der Notiz dazukommt

| # | Bereich | Vorschlag | Entscheidung |
|---|---|---|---|
| M13 | **Zugänge** — E-Mail-Allowlist mit vier Häkchen | neue Dashboard-Kachel: Liste aller Adressen, Spalten Portal / Studio / Brain / Family, Passwort setzen, Einladung, Sperren | |
| M14 | Welt-Zuordnung *(nur falls „Portal Ja" nicht alle Welten heißt — siehe N4)* | Unterpunkt von M13 | |

---

# N · Zugangsmodell nach Notiz Lasse

Meine Einordnung deines Vorschlags. **Kurz: bauen — aber er löst drei verschiedene Fragen
auf einmal, und für zwei davon reichen vier Häkchen nicht.**

## N.1 Was die Häkchen ersetzen — mehr als du denkst

Heute beantworten **vier** Mechanismen die Frage „wer darf wo rein", teils widersprüchlich.
Alle vier werden durch die Häkchen überflüssig:

| Was heute | Zeilen | Nach dem Umbau |
|---|---|---|
| Rollen-Enum `owner/admin/dm/player/readonly/guest` + `STUDIO_ACCESS_ROLES` / `ADMIN_ACCESS_ROLES` | ~120 | `owner` bleibt (für Betrieb/Restore), die anderen fünf entfallen |
| **Capability-Matrix**, 20 Capabilities × 10 Rollen — heute reine Deko (Befund B3) | 274 + 80 Test | **ersatzlos weg** |
| `AUDIENCE_DOMAIN_ACCESS` — die Hälfte, die App-Zugang regelt (Befund B4) | Teil von 422 | weg; der Daten-Routing-Teil bleibt (N.3) |
| `FamilyMember.areas` aus meinem eigenen Family-Vorschlag (G.3) | noch nicht gebaut | **verworfen** — dein Modell ist einfacher und reicht |
| `guest`-Modus / `guestModeEnabled` pro Welt | ~verteilt | entfällt, wenn ohne Häkchen niemand reinkommt |

Das ist ein echter Gewinn: **~900 Zeilen weg**, und das Rechtekonzept schrumpft von vier
konkurrierenden Modellen auf eines, das man in einem Satz erklären kann. Genau das war
Befund B3 aus der Zustandsanalyse. Dein Modell erledigt ihn.

Dass Konten **nur** der Owner anlegt, ist übrigens schon fast so: Es gibt keine
Selbstregistrierung, nur `/setup` für den ersten Owner. Der Rest ist Aufräumen.

## N.2 Was die Häkchen **nicht** können: Sichtbarkeit innerhalb einer Welt

`dm_only` und `player_visible` sitzen nicht am Benutzer, sondern an **jeder einzelnen
Wiki-Seite und jedem Textblock** (`Page.visibility`, `ContentBlock.visibility`). Sie
beantworten eine andere Frage:

> Innerhalb *einer* Welt, die ein Spieler betreten darf — welche Seiten sieht er, und
> welche nur der DM?

Ein Häkchen „Portal Ja" kann das nicht ausdrücken, weil es pro Person gilt und nicht pro
Seite. Würden `dm_only` und `player_visible` entfallen, wäre die Folge: **jede Wiki-Seite,
jeder NPC, jede Karte und jeder Session-Recap wäre für jeden Portal-Nutzer sichtbar,
sobald das Häkchen gesetzt ist.** Der DM könnte keinen Twist mehr vorbereiten, keine
Fraktion geheim halten, kein Handout zurückhalten. Auch `specific_players` und
`unlock_after_session` (Seite wird nach der Session freigeschaltet) hängen daran.

Das ist kein Rechtekonzept-Wildwuchs, sondern die Kernmechanik des DM-Studios — und der
einzige Teil des heutigen Modells, der nachweislich sauber funktioniert und getestet ist.

| # | Frage | Möglichkeiten | Deine Entscheidung |
|---|---|---|---|
| N1 | `dm_only` / `player_visible` an Seiten und Blöcken | **(a)** bleibt wie heute — Häkchen regeln nur den App-Zugang *(meine Empfehlung)* · **(b)** wirklich weg, Portal zeigt dann alles · **(c)** vereinfachen auf zwei Werte statt heute sechs | |
| N2 | `specific_players`, `unlock_after_session`, `secretLevel`/`revealState` | **(a)** bleiben · **(b)** streichen, nur noch DM-oder-alle | |

Falls **(c)** bei N1: Heute gibt es sechs Sichtbarkeiten (`dm_only`, `player_visible`,
`public`, `specific_players`, `unlock_after_session`, `archived`, `private`). Auf `dm_only`
und `player_visible` zu reduzieren wäre eine echte Verschlankung im Sinne deiner Notiz —
ohne die DM-Mechanik zu verlieren.

## N.3 Was die Häkchen **nicht** können: was den Host verlassen darf

`owner_private_local` ist trotz des Namens kein Zugangs-Label, sondern ein
**Routing-Label**. Es tut zwei Dinge:

1. `privacyGuard` sperrt Inhalte dieser Klasse dauerhaft für Cloud-KI
   (`validateProviderContextCombination`) — deshalb kann der Brain-Chat deine privaten
   Dokumente nicht an ein Cloud-Modell schicken.
2. Es entscheidet, welche Prisma-Modelle in `uwe-brain.db` statt in die App-DB gehören.

Ersatzlos entfernt hieße: Personal-Brain-Inhalte könnten an einen Cloud-Provider gehen.
Das Häkchen „Brain Ja" sagt nichts darüber, wohin die Daten fließen — es sagt nur, wer die
Oberfläche sehen darf.

| # | Frage | Möglichkeiten | Deine Entscheidung |
|---|---|---|---|
| N3 | `owner_private_local` als Cloud-Sperre | **(a)** bleibt als reines Routing-Label, verschwindet aber aus der Zugangs-Diskussion *(meine Empfehlung)* · **(b)** umbenennen in etwas klar Nicht-Rechte-Klingendes, z. B. `local_only` · **(c)** weg — Cloud-KI darf dann private Inhalte sehen | |

Dass `household_shared` verschwindet, ist dagegen kostenlos: Die Klasse existiert noch
nicht, sie war nur mein Vorschlag. Family bekommt stattdessen sein Häkchen und — falls
N3 = (a)/(b) — für den Chatbot dieselbe Cloud-Sperre wie Brain.

## N.4 Eine Lücke, die das Modell noch offen lässt

„Portal Ja" sagt, dass jemand ins Portal darf — aber nicht, **welche Welten** er dort
sieht. Heute macht das `WorldMembership` (und das ist auch der Fix aus PR #797).

| # | Frage | Möglichkeiten | Deine Entscheidung |
|---|---|---|---|
| N4 | Welt-Zuordnung | **(a)** `WorldMembership` bleibt: Häkchen = darf ins Portal, Zuordnung = welche Welten *(meine Empfehlung, funktioniert schon)* · **(b)** „Portal Ja" heißt alle Welten — einfacher, aber bei mehreren Kampagnen sehen alle alles · **(c)** fünftes Häkchen pro Welt in M13 | |

## N.5 Vorschlag für das Zielbild

Wenn N1=(a) oder (c), N3=(a) oder (b), N4=(a):

```
Zugang          → 4 Häkchen pro E-Mail im Command Center       (ersetzt Rollen + Capabilities)
Welt-Zuordnung  → WorldMembership                              (bleibt, nur ohne Rollenwerte)
Sichtbarkeit    → dm_only | player_visible an Seite/Block      (bleibt, ggf. von 6 auf 2 gekürzt)
KI-Routing      → local_only als Datenklasse                   (bleibt, umbenannt)
Owner           → einzige verbleibende Rolle                    (Betrieb, Restore, Command Center)
```

Vier Achsen statt vier konkurrierender Modelle — und jede beantwortet genau eine Frage.
Das ist erklärbar, und es ist deutlich weniger Code als heute.

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

**Aktualisiert:** Seit PR #795 gibt es den Brain-KI-Chat (A14). Der Family-Chatbot braucht
damit kein Konzept mehr, sondern eine Kopiervorlage — `@uwe/brain-assistant` (1.384 Zeilen)
liefert Konversationsmodell, Anhänge, Modellwahl, RAG-Kontext, Bildanalyse und Diktat
bereits fertig.

| Aspekt | Vorschlag | Vorlage vorhanden? | Entscheidung |
|---|---|---|---|
| Datenbasis | **nur Family-Daten** (Verträge, Dokumente, Essensplan, Kalender, Haushalt). Kein Brain, kein D&D | ✅ `rag-context.ts` | |
| Provider | **lokal erzwungen** — Haushaltsdokumente gehen nicht in die Cloud | ✅ `privacyGuard`: `personal_brain` ist bereits dauerhaft cloud-gesperrt, `family` analog ergänzen | |
| Antwortumfang | pro Person gefiltert: wer Verträge nicht freigeschaltet hat, bekommt daraus auch keine Antwort | ❌ **neu** — Brain kennt nur einen Nutzer, Family ist mehrbenutzerfähig | |
| Konversationen, Anhänge, Diktat | übernehmen | ✅ 4 Prisma-Modelle + `chat-runner.ts` | |
| Guard | Owner **und** freigeschaltete Mitglieder | ⚠️ `requireBrainActionAuth()` prüft nur Owner — für Family muss daraus eine Mitgliedschaftsprüfung werden | |

Der eine echt neue Teil ist also die **Mehrbenutzer-Filterung**. Alles andere ist
Wiederverwendung. Genau deshalb lohnt es sich, G.3 (`FamilyMember.areas`) vor dem Bau
festzulegen — daran hängt der Filter.

## G.3 Zugang — überholt durch Notiz Lasse

~~`FamilyMember.areas` mit Freischaltung pro Unterbereich~~ — **verworfen.** Der Zugang
läuft nach der Notiz über das Häkchen `Family` im Command Center (M13). Ein Mitglied hat
damit Zugriff auf **ganz** Family, nicht auf einzelne Unterbereiche.

Das ist die einfachere Lösung und ich halte sie für richtig. Der Preis: „Partner:in sieht
Verträge, Kinder nur den Essensplan" ist damit nicht möglich — Family ist alles oder
nichts. Falls das später doch gebraucht wird, lässt es sich als zweite Spaltengruppe in
M13 nachrüsten, ohne das Modell umzubauen.

| # | Frage | Vorschlag | Entscheidung |
|---|---|---|---|
| G14 | Eigene App (`apps/family`) oder Bereich in Studio? | **eigene App** — sonst wiederholen wir das Brain/Studio-Duplikat | |
| G15 | Eigene DB (`uwe-family.db`) oder Brain-DB mitnutzen? | **eigene DB** — Family ist geteilt, Brain ist privat; beides darf nicht in derselben Datei liegen | |
| G16 | Dürfen Family-Mitglieder ins Portal oder Studio? | ergibt sich aus den Häkchen — wer nur `Family` hat, kommt nirgends sonst hin | |
| G17 | Chatbot: lokal erzwungen oder Cloud erlaubt? | **lokal erzwungen** — Haushaltsdokumente gehen nicht in die Cloud (hängt an **N3**) | |
| G18 | ~~Feingranular pro Bereich freischalten?~~ | **nein** — durch M13 ersetzt | *überholt* |

## G.4 Technische Folge (nur zur Information)

- Neue Audience `family` in `packages/product-contracts` *(sofern die Audience-Matrix nach
  N.1 überhaupt bleibt)*; die ursprünglich geplante Privacy-Klasse `household_shared`
  entfällt nach der Notiz
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
| **Command Center** | 13 | 11 bestehende Kacheln · **Zugänge (M13)** · ggf. Welt-Zuordnung |
| **Landing** | 3 | Startseite · Login-Weiche · Health |
| **Portal** | 18 | unverändert (minus Atlas-2D-Leiche) |
| **Studio** | 19 + Welt-Ebene | Start · Welten · Welt-Wissen · KI · Werkzeuge · System |
| **Brain** | 12 | Heute · Life Brain · Wissensassistent · **KI-Chat** · Capture · Projekte · Werkstatt · Miniaturen · Hardware · Mail · Ideen · Start |
| **Family** | 13 | Start · Verträge · Dokumente · Küche · Essensplan · Einkaufsliste · Vorrat · Haushalt · Finanzen · Kalender · Scan · Chat · Mitglieder |

Gestrichen: 13 Bereiche (C14, D2, D3, D9, D10, D25, D26, D27, D29, E8, E32, B24, L4).
Zusammengelegt: 4 Welt-Werkzeuge → 1, Print Center → Labels, Admin-Hub → System-Hub.

---

# J · Reihenfolge, die ich empfehle

*Fortgeschrieben 2026-07-26 abends.*

1. ~~Rechte-Lücken B1/B2 schließen~~ — **erledigt** (PR #797, gemergt)
2. **Diese Liste ausfüllen** ← wir sind hier, inklusive **N1–N4**
3. **Zugangsmodell umbauen** (M13 + Abschnitt N) — vier Häkchen im Command Center, Rollen
   und Capability-Matrix raus. Das ist die Grundlage für alles Weitere: Family braucht das
   Häkchen, und der Umbau ist am billigsten, *bevor* eine fünfte App daran hängt.
4. **Abschnitt H entscheiden** (Brain oder Studio) — davon hängt ab, wohin Family gebaut
   wird. **Dringender geworden:** Der neue Brain-MCP-Server liest Brain-Inhalte über
   Studio (`/api/life-brain/*`), weil `apps/brain` keine Inhalts-API hat. Die
   Vermischung ist damit tragend für ein Feature — je länger sie steht, desto teurer wird
   die Trennung.
5. **Family bauen** — eigene DB, Häkchen-Zugang, Chat als Ableitung von
   `@uwe/brain-assistant` mit Mehrbenutzer-Filter
6. Verschlankung (Streichungen und Zusammenlegungen aus C–E) nebenher
7. **L4** (doppeltes `/api/auth/enter`) einsammeln — klein, aber sollte nicht liegen bleiben

*Zurückgestellt: E34 (`terra.html`) — berührt keinen der Schritte oben und kann jederzeit
nachgezogen werden. **E7 (Atlas 3D) bleibt offen** und ist mit 21.750 Zeilen weiterhin der
größte Einzelposten.*
