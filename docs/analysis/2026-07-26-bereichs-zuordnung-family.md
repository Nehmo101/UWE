# UWE — Bereichs-Zuordnung inkl. neuem Bereich „Family"

Stand: 2026-07-26 · **Arbeitsdokument zum Ausfüllen**

So benutzt du das: In der Spalte **„Deine Entscheidung"** stehen drei Möglichkeiten —
`OK` (Vorschlag passt), `→ Ziel` (gehört woanders hin, Ziel dahinterschreiben) oder
`WEG` (streichen). Die Spalte „Vorschlag" ist meine Empfehlung, nicht gesetzt.

---

## 0. Die vier Bereiche — Abgrenzung, die ich vorschlage

| Bereich | Zielgruppe | Datenklasse | Wer richtet ein | Zugang |
|---|---|---|---|---|
| **Portal** | Mitspieler:innen | `player_visible` | DM | Login, Welt-Mitgliedschaft |
| **Studio** | DM (du) | `dm_only` / `player_visible` | Owner | Rolle `owner`/`admin`/`dm` |
| **Brain** | nur du | `owner_private_local` | Owner | Rolle `owner`, nichts sonst |
| **Family** | Haushalt | **`household_shared`** (neu) | Owner | **E-Mail-Allowlist durch Owner** |

**Der entscheidende Unterschied Brain ↔ Family:** Brain ist *owner-private*. Family ist
*geteilt* — mehrere Menschen sehen dieselben Daten. Das ist keine kosmetische Trennung: Was
heute in der Brain-DB (`uwe-brain.db`) liegt, ist per Contract `owner_private_local` und
darf laut `packages/product-contracts` niemanden außer dem Owner erreichen. Alles, was nach
Family wandert, verlässt diese Klasse und braucht eine neue.

**Faustregel für die Zuordnung unten:**
> Würde es dich stören, wenn deine Partnerin/dein Partner es sieht? → **Brain.**
> Muss die Person es sehen können, damit der Haushalt funktioniert? → **Family.**
> Hat es mit D&D zu tun? → **Studio** (oder Portal, wenn Spieler es sehen sollen).

---

## 1. FAMILY — Vorschlag für den neuen Bereich

Alles hier ist ein Vorschlag; nichts davon existiert bislang als eigener Bereich.

### 1.1 Inhalte, die ich nach Family verschieben würde

| # | Bereich | Heute in | Vorschlag | Warum | Deine Entscheidung |
|---|---|---|---|---|---|
| F1 | **Verträge** | Studio → Organisation (`/contracts`) | **Family** | Miete, Versicherung, Strom betreffen den Haushalt, nicht dich allein | |
| F2 | **Dokumente** | Studio → Organisation (`/documents`) | **Family** | Ausweise, Urkunden, Policen — klassisch geteilt | |
| F3 | **Essensplan / Küche** | Studio → Werkzeuge (`/kitchen` + 5 Unterseiten) | **Family** | Wochenplan, Rezepte, Einkaufsliste, Vorrat: Kernfall geteilt | |
| F4 | **Einkaufsliste (Bring)** | Teil von `/kitchen/shopping` | **Family** | Genau dafür da, dass mehrere drauf schreiben | |
| F5 | **Haushalt** | Studio → Werkzeuge (`/household`) | **Family** | Wartung, Müllkalender, Rauchmelder — Haushaltsaufgaben | |
| F6 | **Finanzen / Abos** | Studio → Werkzeuge (`/finance`) | **Family** *oder* Brain | Haushaltskosten = Family; persönliche Finanzen = Brain. **Deine Entscheidung** | |
| F7 | **Familien-Kalender** | Studio → Organisation (`/calendar`) | **Family** (geteilt) | Termine des Haushalts. Weltuhr/Session-Termine bleiben in Studio | |
| F8 | **Scan Inbox** | Studio → Werkzeuge (`/scan-inbox`) | **Family** (Triage nur Owner) | Scannt genau die Belege/Verträge, die nach Family gehören | |
| F9 | **Family-Chatbot** | *existiert nicht* | **Family** (neu) | Von dir gewünscht — siehe 1.2 | |
| F10 | **Family-Start / Heute** | *existiert nicht* | **Family** (neu) | Einstieg: Was ist heute los, was steht an, was fehlt im Kühlschrank | |
| F11 | **Mitglieder & Freigaben** | *existiert nicht* | **Family** (nur Owner) | E-Mail-Allowlist, pro Person freischalten welche Bereiche | |

### 1.2 Der Family-Chatbot — was ich vorschlage

| Aspekt | Vorschlag | Deine Entscheidung |
|---|---|---|
| Datenbasis | **Nur Family-Daten** (Verträge, Dokumente, Essensplan, Kalender, Haushalt). **Kein** Zugriff auf Brain, kein Zugriff auf D&D | |
| Provider | **Lokal erzwungen** (RTX-Connector / Ollama). Haushaltsdokumente gehen nicht in die Cloud | |
| Antwortumfang | Pro Nutzer:in gefiltert — wer Verträge nicht freigeschaltet hat, bekommt daraus auch keine Antwort | |
| Wiederverwendung | Baut auf `@uwe/ai-brain` + `privacyGuard` auf; **kein** neuer Router | |

Die Privacy-Mechanik dafür existiert bereits und funktioniert (`privacyGuard.ts`,
`localOnly`-Erzwingung im `aiRouter`). Neu ist nur der Kontext-Modus `family`.

### 1.3 Zugang: E-Mail-Allowlist — mein Vorschlag zur Umsetzung

Nicht über eine neue globale Rolle (`family`), sondern über ein **Membership-Modell**
analog `WorldMembership`, das es schon gibt und das sich bewährt hat:

```
FamilyMember
  userId        → User
  email         → vom Owner freigegebene Adresse (Einladung)
  areas         → welche Family-Bereiche: contracts, documents, meals, calendar, household
  status        → invited | active | revoked
```

Vorteil: Du kannst pro Person entscheiden. Partner:in sieht Verträge und Essensplan; Kinder
sehen nur Essensplan und Kalender. Eine flache Rolle könnte das nicht.

| Frage | Vorschlag | Deine Entscheidung |
|---|---|---|
| Eigene App (`apps/family`, eigener Port) oder Bereich in Studio? | **Eigene App** — sonst wiederholen wir den Brain-Fehler (zwei UIs auf einer DB) | |
| Eigene DB (`uwe-family.db`) oder Brain-DB mitnutzen? | **Eigene DB** — sonst ist die `owner_private_local`-Zusicherung der Brain-DB gebrochen | |
| Dürfen Family-Mitglieder ins Portal / Studio? | **Nein**, strikt getrennt (wie Portal ↔ Studio heute) | |
| Feingranular pro Bereich freischalten? | **Ja** (siehe `areas` oben) | |

### 1.4 Was das technisch bedeutet (zur Info, nicht zum Ausfüllen)

- Neue Audience `family` in `packages/product-contracts` (5. Spalte in der Matrix)
- Neue Privacy-Klasse `household_shared` zwischen `owner_private_local` und `player_visible`
- **~14 Prisma-Modelle** wandern aus der Brain-DB in eine Family-DB:
  `ContractExpense`, `DocumentTemplate`, `Recipe`, `RecipeIngredient`, `MealPlanWeek`,
  `MealPlanEntry`, `ShoppingList`, `ShoppingListItem`, `BringConnection`, `PantryItem`,
  `MaintenanceTask`, `ScanDocument`, `CalendarFeed`, `CalendarEvent`
- Studio verliert dadurch ~50 der 108 Direktimporte auf `@uwe/database/brain-client`
  — das ist der Nebeneffekt, der die Architektur *entlastet* statt sie zu belasten

---

## 2. BRAIN — was bleibt, wenn Family da ist

| # | Bereich | Heute (Brain) | Heute auch in Studio | Vorschlag | Deine Entscheidung |
|---|---|---|---|---|---|
| B1 | **Start / Überblick** | `/` | — | Brain | |
| B2 | **Heute** | `/today` | `/today` ⚠️ doppelt | Brain **oder** Studio — nicht beides | |
| B3 | **Wissen (Life Brain)** | `/life-brain` | `/life-brain` ⚠️ doppelt | **Brain** | |
| B4 | **Wissensassistent** | — | `/knowledge` | **Brain** (aus Studio raus) | |
| B5 | **Life-Brain Chat** | — | `/life-brain/chat` | **Brain** (aus Studio raus) | |
| B6 | **Capture** | `/capture` | `/capture` ⚠️ doppelt | **Brain** | |
| B7 | **Projekte** | `/projects` | `/projects` ⚠️ doppelt | **Brain** | |
| B8 | **Werkstatt** | `/workshop` | `/workshop` ⚠️ doppelt | **Brain** (Hobby, persönlich) | |
| B9 | **Miniaturen** | `/miniatures` | `/miniatures` ⚠️ doppelt | **Brain** — *oder* Studio, weil D&D-nah | |
| B10 | **Verträge** | `/contracts` | `/contracts` ⚠️ doppelt | **→ Family** (F1) | |
| B11 | **Hardware** | `/hardware` | `/hardware` ⚠️ doppelt | **Brain** *oder* Studio → System | |
| B12 | **Dokumente** | `/documents` | `/documents` ⚠️ doppelt | **→ Family** (F2) | |
| B13 | **Mail** | `/mail` | `/mail` ⚠️ doppelt | **Brain** — persönliches Postfach, nicht geteilt | |
| B14 | **Kalender** | `/calendar` | `/calendar` ⚠️ doppelt | **→ Family** (F7), persönliche Termine bleiben Brain | |
| B15 | **Ideen** | — | `/ideas` | **Brain** (aus Studio raus) | |
| B16 | **Recherche** | — | (Service ohne Nav) | Brain | |

> **⚠️ Alle 11 mit „doppelt" markierten Bereiche existieren heute zweimal** — einmal in
> Brain, einmal in Studio, auf derselben Datenbank. Das ist der größte offene Punkt aus der
> Zustandsanalyse. Mit Family kommt eine dritte Instanz dazu, wenn wir nicht vorher
> aufräumen. **Empfehlung: Brain/Studio-Duplikat auflösen, bevor Family gebaut wird.**

---

## 3. STUDIO — was übrig bleibt

### 3.1 Studio-Hauptnavigation (34 Einträge heute)

| # | Sektion → Eintrag | Pfad | Vorschlag | Deine Entscheidung |
|---|---|---|---|---|
| S1 | Start → **Heute** | `/today` | Studio (D&D-Cockpit) | |
| S2 | Start → **Schnell erfassen** | `/capture?quick=1` | **→ Brain** | |
| S3 | Start → **Suche** | `/search` | Studio (pro Bereich eigene Suche) | |
| S4 | Welten → **Alle Welten** | `/worlds` | Studio | |
| S5 | Knowledge → **Brain Store** | `/brain` | Studio — **umbenennen** in „Welt-Wissen", sonst Verwechslung mit App Brain | |
| S6 | Knowledge → **Life Brain** | `/life-brain` | **→ Brain** | |
| S7 | Knowledge → **Wissensassistent** | `/knowledge` | **→ Brain** | |
| S8 | Knowledge → **Life-Brain Chat** | `/life-brain/chat` | **→ Brain** | |
| S9 | AI → **KI & Generatoren** | `/ai` | Studio | |
| S10 | AI → **AI Gateway** | `/admin/ai-gateway` | Studio → System (Plattform, nicht D&D) | |
| S11 | AI → **Prompt-Konsole** | `/admin/ai-prompt` | Studio → System | |
| S12 | Werkzeuge → **Capture / Inbox** | `/capture` | **→ Brain** | |
| S13 | Werkzeuge → **Scan Inbox** | `/scan-inbox` | **→ Family** (F8) | |
| S14 | Werkzeuge → **Mach weiter** | `/continue` | **WEG** — 61 Zeilen, doppelt zu `/today` | |
| S15 | Werkzeuge → **Finanzen / Abos** | `/finance` | **→ Family** (F6) | |
| S16 | Werkzeuge → **Haushalt** | `/household` | **→ Family** (F5) | |
| S17 | Werkzeuge → **Küche** | `/kitchen` | **→ Family** (F3) | |
| S18 | Werkzeuge → **Templates** | `/templates` | Studio | |
| S19 | Werkzeuge → **Prompt-Bibliothek** | `/prompts` | Studio → hinter Entwickler-Schalter | |
| S20 | Werkzeuge → **Image Studio** | `/image-studio` | Studio | |
| S21 | Werkzeuge → **Import-Zentrale** | `/import` | Studio | |
| S22 | Werkzeuge → **Reviews** | `/admin/reviews` | Studio | |
| S23 | Werkzeuge → **Cursor Agent Jobs** | `/admin/agent-jobs` | Studio → hinter Entwickler-Schalter | |
| S24 | Werkzeuge → **Hintergrund-Jobs** | `/jobs` | Studio → System | |
| S25 | Organisation → **Projekte** | `/projects` | **→ Brain** | |
| S26 | Organisation → **Verträge** | `/contracts` | **→ Family** (F1) | |
| S27 | Organisation → **Dokumente** | `/documents` | **→ Family** (F2) | |
| S28 | Organisation → **Werkstatt** | `/workshop` | **→ Brain** | |
| S29 | Organisation → **Miniaturen** | `/miniatures` | **→ Brain** oder Studio | |
| S30 | Organisation → **Ideen** | `/ideas` | **→ Brain** | |
| S31 | Organisation → **Bug-Center** | `/bugs` | Studio → hinter Entwickler-Schalter | |
| S32 | Organisation → **Hardware / Homelab** | `/hardware` | **→ Brain** oder Studio → System | |
| S33 | Organisation → **Mail** | `/mail` | **→ Brain** | |
| S34 | Organisation → **Kalender** | `/calendar` | **→ Family** (F7) | |

> Wenn du meinen Vorschlägen folgst, verliert Studio 15 Einträge und die Sektionen
> **„Organisation"** und **„Werkzeuge → Erfassen & Alltag"** entfallen ersatzlos.
> Studio wäre dann wieder: **Start · Welten · Wissen · KI · Werkzeuge · System.**

### 3.2 Studio → System / Admin (heute 30+ Einträge, zwei konkurrierende Hubs)

`ADMIN_HUB_SECTIONS` (Kacheln auf `/admin`) und `SYSTEM_NAV` (Sidebar) listen **weitgehend
dieselben Ziele** doppelt. Vorschlag: eine Quelle, `/admin` wird Redirect auf `/system`.

| # | Gruppe → Eintrag | Pfad | Vorschlag | Deine Entscheidung |
|---|---|---|---|---|
| Y1 | Übersicht → **System-Hub** | `/system` | Behalten — **der** Betriebs-Einstieg | |
| Y2 | Übersicht → **Admin Übersicht** | `/admin` | **WEG** → Redirect auf `/system` | |
| Y3 | Übersicht → **Owner Cockpit** | `/admin/cockpit` | **WEG** → Tab in `/system` | |
| Y4 | Übersicht → **Verlauf** | `/admin/activity` | Behalten | |
| Y5 | Übersicht → **NL-Befehle** | `/command` | Behalten oder in Suche integrieren | |
| Y6 | Übersicht → **Navigation** | `/system/navigation` | Entwickler-Schalter | |
| Y7 | Setup → **Owner-Einrichtung** | `/admin/setup` | Behalten | |
| Y8 | Setup → **Aufgabenliste** | `/admin/checklist` | Behalten | |
| Y9 | Setup → **Kommandozentrale** | `/system/command-center` | **WEG** — 30 Zeilen, doppelt zu Y5 | |
| Y10 | Setup → **Host Control** | `/system/host-control` | Behalten | |
| Y11 | Setup → **Cloudflare** | `/system/cloudflare` | Behalten (Platzhalter-Inhalt prüfen) | |
| Y12 | Setup → **RTX Connector** | `/system/rtx-connector` | Behalten | |
| Y13 | Setup → **Drucker** | `/system/printers` | Behalten | |
| Y14 | Sicherheit → **Benutzer & Rollen** | `/admin/users` | Behalten — **hier kommt Family-Allowlist rein** | |
| Y15 | Sicherheit → **Rollen-Matrix** | `/admin/roles` | **WEG oder erzwingen** — zeigt heute eine wirkungslose Tabelle | |
| Y16 | Sicherheit → **Security** | `/admin/security` | Behalten | |
| Y17 | Sicherheit → **Audit Log** | `/admin/audit-log` | Behalten | |
| Y18 | Sicherheit → **API Tokens** | `/admin/api-tokens` | Behalten | |
| Y19 | Sicherheit → **Webhooks** | `/admin/webhooks` | Behalten | |
| Y20 | Sicherheit → **Secrets-Status** | `/admin/secrets` | Behalten | |
| Y21 | Betrieb → **Backup & Restore** | `/backup` | Behalten | |
| Y22 | Betrieb → **Migrationen** | `/admin/migrations` | Behalten | |
| Y23 | Betrieb → **Version & Updates** | `/system/version` | Behalten | |
| Y24 | Betrieb → **Was ist neu** | `/system/whats-new` | **WEG** → in Version integrieren | |
| Y25 | Betrieb → **Startklar** | `/system/startklar` | **WEG** → in Version integrieren | |
| Y26 | Betrieb → **Health-Ampel** | `/system/health` | **WEG** — 28 Zeilen, Tab in `/system` | |
| Y27 | Betrieb → **Diagnose** | `/system?tab=diagnose` | Behalten (ist bereits Tab) | |
| Y28 | Betrieb → **UWE KnowHow** | `/system/uwe-knowhow` | **WEG** — 27 Zeilen Selbstdoku | |
| Y29 | Betrieb → **Tags** | `/admin/tags` | Behalten | |
| Y30 | Betrieb → **Mail Center** | `/mail` | **→ Brain** (B13) | |
| Y31 | Einstellungen → **Einstellungen** | `/settings` | Behalten (905 Zeilen — aufteilen) | |
| Y32 | Einstellungen → **Passwort / 2FA** | `/account/*` | Behalten | |

### 3.3 Studio → Welt-Ebene (30 Einträge pro Welt)

| # | Gruppe → Eintrag | Vorschlag | Deine Entscheidung |
|---|---|---|---|
| W1 | Übersicht → **Übersicht** | Behalten | |
| W2 | Übersicht → **Kampagnen-Radar** | **Zusammenlegen** mit W26/W27/W28 → ein „Weltzustand" | |
| W3 | Wiki → **Wiki / Seiten** | Behalten | |
| W4 | Wiki → **Seiten-Review** | Behalten | |
| W5 | Wiki → **Neue Seite** | Behalten (Aktion, kein Bereich — evtl. Button statt Nav) | |
| W6 | Wiki → **Verbindungen / Graph** | Behalten | |
| W7 | Wiki → **Atlas 3D** | **Grundsatzfrage** — 21.750 Zeilen Code für diese eine Seite | |
| W8 | Wiki → **Magic-Item-Werkbank** | Behalten | |
| W9 | Spiel → **Sessions** | Behalten | |
| W10 | Spiel → **Weltuhr** | Behalten | |
| W11 | Spiel → **Chronik** | Behalten — oder mit Weltuhr zusammen | |
| W12 | Spiel → **Session vorbereiten** | Behalten | |
| W13 | Spiel → **One-Shot-Generator** | Behalten | |
| W14 | Spiel → **Was ist offen?** | **Zusammenlegen** (siehe W2) | |
| W15 | Spiel → **Gruppenschatz** | Behalten | |
| W16 | Spiel → **Zufallstabellen** | Behalten | |
| W17 | Spiel → **Spielernotizen** | Behalten | |
| W18 | Spiel → **Spielerfragen** | Behalten | |
| W19 | Spiel → **Dungeons** | Behalten (Platzhalter-Inhalt prüfen) | |
| W20 | Medien → **Medien / Assets** | Behalten | |
| W21 | Medien → **Soundboard** | Behalten | |
| W22 | Medien → **Labels & Print** | Behalten | |
| W23 | Medien → **Print Center** | **Zusammenlegen** mit W22 | |
| W24 | Wissen & KI → **Brain / Wissen** | Behalten (umbenennen, s. S5) | |
| W25 | Wissen & KI → **KI / Generatoren** | Behalten | |
| W26 | Wissen & KI → **DnD API** | Behalten | |
| W27 | Wissen & KI → **Import & Konvertierung** | Behalten | |
| W28 | Freigabe → **Freigaben / Kanon (Inspector)** | **Zusammenlegen** (siehe W2) | |
| W29 | Freigabe → **Wiki-Pflege (Quality)** | **Zusammenlegen** (siehe W2) | |
| W30 | Freigabe → **Backup** | **WEG** → globales `/backup` reicht | |
| W31 | Live-Session (4 Einträge) | Behalten — kontextabhängig, korrekt getrennt | |

---

## 4. PORTAL — hier schlage ich fast nichts vor

Die Portal-IA ist der sauberste Teil des Systems. Alles ist spielerbezogen, nichts ist
fehlplatziert.

| # | Eintrag | Pfad | Vorschlag | Deine Entscheidung |
|---|---|---|---|---|
| P1 | **Meine Welten** | `/auth/worlds` | Behalten | |
| P2 | **Passwort** | `/auth/account/password` | Behalten | |
| P3 | **Sicherheit (2FA)** | `/auth/account/security` | Behalten | |
| P4 | Welt → **Übersicht** | `…/` | Behalten | |
| P5 | Welt → **Wiki** | `…/wiki` | Behalten | |
| P6 | Welt → **NPCs** | `…/npcs` | Behalten | |
| P7 | Welt → **Beziehungsnetz** | `…/graph` | Behalten | |
| P8 | Welt → **Sessions / Recaps** | `…/sessions` | Behalten | |
| P9 | Welt → **Gruppenschatz** | `…/treasury` | Behalten | |
| P10 | Welt → **Timeline** | `…/timeline` | Behalten — evtl. mit P8 zusammen | |
| P11 | Welt → **Questlog** | `…/quests` | Behalten | |
| P12 | Welt → **Charaktere** | `…/characters` | Behalten | |
| P13 | Welt → **Handout-Postfach** | `…/handouts` | Behalten | |
| P14 | Welt → **Galerie** | `…/assets` | Behalten | |
| P15 | Welt → **Spielernotizen** | `…/notes` | Behalten | |
| P16 | Welt → **Fragen an den DM** | `…/questions` | Behalten | |
| P17 | Welt → **Soundboard** | `…/soundboard` | Behalten | |
| P18 | Welt → **Atlas 3D** | `…/atlas3d` | Abhängig von W7 | |
| P19 | *(ohne Nav)* **Atlas (2D)** | `…/atlas` | **WEG** — verwaister Vorgänger von P18 | |
| P20 | **Gruppierung der 15 Welt-Einträge** | — | Vorschlag: Zweiteilung „Nachschlagen" (P5–P7, P12–P14) / „Mitspielen" (P8–P11, P15–P18) | |

---

## 5. Sortiert nach Zielbereich — die Kurzfassung

Wenn du allen Vorschlägen folgst:

**FAMILY** (neu, 11 Bereiche)
Start · Verträge · Dokumente · Essensplan/Küche · Einkaufsliste · Haushalt · Finanzen ·
Kalender · Scan-Eingang · Family-Chat · Mitglieder & Freigaben

**BRAIN** (owner-privat, 11 Bereiche)
Start/Heute · Life Brain (Wissen) · Wissensassistent · Life-Brain Chat · Capture ·
Projekte · Werkstatt · Miniaturen · Hardware · Mail · Ideen

**STUDIO** (D&D + Plattform, ~19 + Welt-Ebene)
Start: Heute, Suche · Welten · Welt-Wissen · KI & Generatoren ·
Werkzeuge: Templates, Image Studio, Import, Reviews · System (konsolidiert) ·
Welt-Ebene: ~24 statt 30 Einträge

**PORTAL** (unverändert, 18 Bereiche)

---

## 6. Reihenfolge, die ich empfehle

1. **Zuerst die zwei Sicherheitslücken schließen** (Server-Action-Rollen-Gate,
   Portal-Welt-Mitgliedschaft) — siehe Zustandsanalyse B1/B2. Family bringt neue
   Nutzer:innen ins System; die Lücken vorher zu schließen ist keine Kür.
2. **Dann Brain/Studio-Duplikat auflösen.** Family jetzt danebenzubauen, während 11
   Bereiche doppelt existieren, erzeugt eine dritte Kopie derselben Idee.
3. **Dann Family bauen** — mit `FamilyMember`-Modell, eigener DB, lokal erzwungenem Chat.
4. Verschlankung (Dashboard-Konsolidierung, Welt-Werkzeuge zusammenlegen) läuft nebenher.

Punkt 2 ist der, bei dem ich Widerspruch erwarte, weil er Arbeit ohne sichtbares neues
Feature bedeutet. Aber genau er entscheidet, ob Family der vierte saubere Bereich wird
oder die dritte Kopie.
