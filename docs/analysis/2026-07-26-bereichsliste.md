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

> ### Stand nach deiner Durchsicht (2026-07-26 nachts)
>
> Deine Entscheidungen sind eingearbeitet. **Beantwortet:** Zugangsmodell (N.0), Sichtbarkeit
> raus (N.2), Cloud raus (N.3), Welt-Zuordnung bleibt (N.4), private Brains pro Person
> (G.2b), Studio-System komplett weg (Abschnitt D), ein Kalender in Family, Brain gewinnt
> alle Doppelungen (H).
>
> **Alles beantwortet.** Die letzten beiden Zeilen sind geschlossen:
>
> | # | Frage | Entscheidung |
> |---|---|---|
> | **N5** | Review-Workflow nach dem Wegfall von `publishStatus` | ✅ **Der gesamte Review-Prozess wird entfernt** — kein Ersatzfeld |
> | **B8a** | Legacy-Weltpfade im Portal löschen? | ✅ **Ja, aktiv löschen** |
> | **N8** | KI-Vorschlags-Flow (`AiProposal`) | ✅ **bleibt** — die KI schlägt vor, du entscheidest |
> | **N9** | Freigabe-Links (B6) | ✅ **weg** — wirklich nur Allowlist, keine anonymen Links |
>
> **Damit ist die Liste vollständig.** Gesamte Löschmenge: **~6.000 Zeilen** über
> ~290 berührte Dateien (N.6).
>
> **Alle übrigen leeren Zeilen gelten nach deiner Regel als angenommen** („Wenn ich keine
> Entscheidung geschrieben habe, gilt deine Empfehlung"). Konkret heißt das bei den vier
> Zeilen, die ich als unsicher markiert hatte:
>
> | # | Bereich | Damit entschieden |
> |---|---|---|
> | A7 / C36 | Miniaturen | → **Brain** (deckt sich mit deinem H6) |
> | A9 / C39 | Hardware / Homelab | → **Brain** (deckt sich mit deinem H8) |
> | C15 | Finanzen / Abos | → **Family** |
> | C35 | Geländeverleih | → **Brain** |

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

Lasse: Wenn ich keine entscheidung geschrieben habe, gilt deine Empfehlung. Wenn etwas entfernt werden soll, dann wird es entfernt BACKUPS sind absolut egal Datenverlust ist absolut in Ordnung also nicht in die Hose machen.

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

**Umgesetzt und ausformuliert in [Abschnitt N](#n--zugangsmodell-nach-notiz-lasse--entschieden).**
Beide Bedenken, die ich zur Vorfassung erhoben hatte, sind beantwortet: Das KI-Routing-Label
wird überflüssig, weil es gar keinen Cloud-Provider mehr geben soll — das ist die sauberere
Lösung als ein Verbotsschild. Und bei der Sichtbarkeit bleibt es bei deiner Entscheidung:
sie fällt vollständig weg, inklusive Entwurfsstatus. Zusammen mit dem Häkchen-Modell sind das
**rund 3.700 gelöschte Zeilen** (N.6). Eine technische Nebenwirkung, die zwei deiner
Entscheidungen kollidieren lässt, steht in **N.7** und braucht noch eine Antwort.

---

## Die sechs Oberflächen

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
| A12 | Kalender | `/calendar` | ⚠️ `/calendar` | **→ Family** | ✅ ein Kalender in Family, kein Aufteilen | ✅ |
| A13 | Login | `/login` | – | **Brain** | technisch nötig, muss bleiben | ✅ |
| **A14** | **KI-Chat** *(neu, PR #795)* | `/ki-chat`, `/ki-chat/[id]` | – | **Brain** | Bildanalyse + Diktat, `personal_brain` cloud-gesperrt. Vorlage für G12 | |
| **A15** | **Bereichssuche** *(neu, PR #798)* | Kopfzeile | ⚠️ auch Studio + Portal | **überall** | ✅ pro App gefiltert: Brain zeigt Brain-Einträge, Portal Portal-Einträge usw. Läuft heute schon so — jede App speist ihre eigene Nav in `searchNavEntries` | ✅ |

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
| B6 | Freigabe-Link (anonym) | `/share/[token]`, `/share/[token]/pages/[slug]` | ~~Portal~~ | ✅ **WEG** — anonymer Zugriff ohne Allowlist widerspricht dem Grundsatz. Siehe N.9 | ✅ WEG |
| B7 | Landing / Weiterleitung | `/`, `/portal` | **Portal** | reine Redirects | |
| B8 | Legacy-Weltpfade | `/worlds`, `/worlds/[slug]`, `/worlds/[slug]/[cat]/[slug]`, `/worlds/[slug]/graph` | ~~Portal~~ | ✅ **WEG** — obsolet, reine Weiterleitungen. Wird aktiv gelöscht, inkl. `legacy-world-redirect.ts` | ✅ WEG |
| **B27** | **Bereichssuche** | Kopfzeile | **Portal** | ✅ alles was im Portal klickbar ist (dieselbe Leiste wie B26) | ✅ |

> **Antwort auf deine Frage zu B8** — „Legacy Weltpfade? Also veraltet und obsolete?“
>
> Ja, obsolet. Vor dem Umbau auf `/auth/worlds/…` lagen die Portal-Welten unter
> `/worlds/…`. Die vier Pfade enthalten **keinen Inhalt mehr** — es sind vier Dateien mit
> je 3–8 Zeilen, die ausschließlich weiterleiten, damit alte Lesezeichen und an Spieler
> verschickte Links nicht ins Leere laufen.
>
> Da Datenverlust für dich in Ordnung ist und es um vier Weiterleitungen geht:
> **Empfehlung `WEG`.** Schlimmstenfalls läuft ein altes Lesezeichen in einen 404.
>
> ✅ **Entschieden: aktiv löschen.** Vier Seiten plus `src/lib/legacy-world-redirect.ts`
> und `resolveLegacyPathRedirect` in der Middleware, soweit es nur diese Pfade betrifft.


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
| B25 | Gruppierung der 15 Einträge | – | Vorschlag: „Nachschlagen" (B10–B12, B17–B19) / „Mitspielen" (B13–B16, B20–B23) | 15 Einträge auf einer Ebene | ✅ als gut befunden |
| **B26** | **Bereichssuche** *(neu, PR #798)* | Kopfzeile | **Portal** | siehe A15 — entschärft B25 teilweise | |

---

# C · STUDIO — Hauptnavigation (7 Sektionen, 34 Einträge)

| # | Sektion → Bereich | Pfad | heute sichtbar für | Vorschlag | Begründung | Entscheidung |
|---|---|---|---|---|---|---|
| C1 | Start → Heute | `/today` | owner/admin/dm | **Studio** | DM-Cockpit | | 
| C2 | Start → Schnell erfassen | `/capture?quick=1` | owner/admin/dm | **→ Brain** | persönlicher Eingang | |
| C3 | Start → Suche | `/search` | owner/admin/dm | ~~Studio~~ | ✅ **WEG** — ersetzt durch die Bereichssuche in der Kopfzeile (C42). Die NL-Befehle aus D5 ziehen dorthin um | ✅ WEG |
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
| C26 | Werkzeuge → Reviews | `/admin/reviews` | owner/admin | ~~Studio~~ | ✅ **WEG** — der gesamte Review-Prozess entfällt (N.7) | ✅ WEG |
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
| C38 | Organisation → Bug-Center | `/bugs` | owner/admin/dm | **Studio**, hinter Entwickler-Schalter | | **→ Brain**|
| C39 | Organisation → Hardware / Homelab | `/hardware` | owner/admin | **→ Brain** *(oder Studio → System)* | siehe A9 | |
| C40 | Organisation → Mail | `/mail`, `/mail/compose` | owner/admin | **→ Brain** | | |
| C41 | Organisation → Kalender | `/calendar` | owner/admin/dm | **→ Family** | ✅ ein Kalender in Family. Die In-Game-Weltuhr (E11) bleibt unberührt in Studio | ✅ |
| **C42** | **Bereichssuche** *(neu, PR #798)* | Kopfzeile | owner/admin/dm | **Studio** | ergänzt C3 (`/search`) — prüfen, ob beide nötig sind | |

> Bei Zustimmung verliert Studio 15 Einträge; die Sektionen **„Organisation"** und
> **„Werkzeuge → Erfassen & Alltag"** entfallen ganz.

---

# D · STUDIO — System & Admin ✅ **entfällt vollständig**

> **Entscheidung:** Der gesamte System- und Admin-Bereich verschwindet aus Studio.
>
> - **Konfigurieren** → nur noch im **Command Center** (M). Was dort fehlt, wird nachgezogen:
>   Setup, Host Control, Cloudflare, RTX-Connector, Drucker, Benutzer, Security, Audit-Log,
>   API-Tokens, Webhooks, Secrets, Backup, Migrationen, Einstellungen.
> - **Betrieb ansehen** → **Brain** (D1 System-Hub wandert dorthin).
> - **Studio** ist danach ausschließlich DM-Werkzeug: Welten, Wiki, Sessions, KI, Medien.
>
> Damit entfallen die beiden konkurrierenden Hubs (`ADMIN_HUB_SECTIONS` und `SYSTEM_NAV`)
> von selbst — es gibt keinen Studio-System-Bereich mehr, in dem sie sich doppeln könnten.
>
> **Zwei Punkte, die ich dabei annehme** (widersprich, falls anders gemeint):
>
> 1. **D34 (eigenes Passwort / 2FA) bleibt in Studio und Portal.** Konten legt der Owner an,
>    aber jede Person muss ihr eigenes Passwort ändern und 2FA einrichten können — das kann
>    das Command Center nicht für sie tun, weil sie keinen Zugriff darauf hat.
> 2. **D30 (Tags) wandert nach Studio → Welten**, nicht ins Command Center. Tags sind
>    Inhaltsverschlagwortung für Welten, keine Systemkonfiguration.
>
> Die Tabelle bleibt als Umzugsliste stehen: Sie sagt, *wohin* jede Kachel geht.

| # | Gruppe → Bereich | Pfad | Vorschlag | Begründung | Entscheidung |
|---|---|---|---|---|---|
| D1 | Übersicht → System-Hub | `/system` | **behalten** — *der* Betriebseinstieg | 512 Zeilen, Tabs: overview/homelab/diagnose/cloudflare | `→ Brain` |
| D2 | Übersicht → Admin Übersicht | `/admin` | **WEG** → Redirect auf `/system` | zwei Hubs für eine Sache | |
| D3 | Übersicht → Owner Cockpit | `/admin/cockpit` | **WEG** → Tab in `/system` | | |
| D4 | Übersicht → Verlauf | `/admin/activity` | behalten | | |
| D5 | Übersicht → NL-Befehle | `/command` | in die Suche integrieren | ✅ C3 fällt weg, also **in die Bereichssuche (C42)** statt in `/search` | ✅ in C42 |
| D6 | Übersicht → Navigation | `/system/navigation` | Entwickler-Schalter | 23 Zeilen | |
| D7 | Setup → Owner-Einrichtung | `/admin/setup` | behalten | | -> Einrichtungen nur noch im Uwe Command Center, wenn dort noch nicht vorhanden nachziehen|
| D8 | Setup → Aufgabenliste | `/admin/checklist` | behalten | |  **WEG** |
| D9 | Setup → Systemstatus | `/admin/status` | **WEG** | 9 Zeilen, doppelt zu D1 | |
| D10 | Setup → Kommandozentrale | `/system/command-center` | **WEG** | 30 Zeilen, doppelt zu D5 | |
| D11 | Setup → Host Control | `/system/host-control` | behalten | | -> Einrichtungen nur noch im Uwe Command Center, wenn dort noch nicht vorhanden nachziehen |
| D12 | Setup → Cloudflare | `/system/cloudflare` | behalten — Platzhalter-Inhalt prüfen | |  -> Einrichtungen nur noch im Uwe Command Center, wenn dort noch nicht vorhanden nachziehen|
| D13 | Setup → RTX Connector | `/system/rtx-connector` | behalten | |  -> Einrichtungen nur noch im Uwe Command Center, wenn dort noch nicht vorhanden nachziehen|
| D14 | Setup → Drucker | `/system/printers` | behalten | |  -> Einrichtungen nur noch im Uwe Command Center, wenn dort noch nicht vorhanden nachziehen|
| D15 | Sicherheit → Benutzer & Rollen | `/admin/users` | behalten — **hier kommt die Family-Allowlist rein** | | -> Einrichtungen nur noch im Uwe Command Center, wenn dort noch nicht vorhanden nachziehen |
| D16 | Sicherheit → Rollen-Matrix | `/admin/roles` | **WEG oder erzwingen** | zeigt heute eine wirkungslose Tabelle | WEG|
| D17 | Sicherheit → Security | `/admin/security` | behalten | |  -> Einrichtungen nur noch im Uwe Command Center, wenn dort noch nicht vorhanden nachziehen|
| D18 | Sicherheit → Audit Log | `/admin/audit-log` | behalten | |  -> Einrichtungen nur noch im Uwe Command Center, wenn dort noch nicht vorhanden nachziehen|
| D19 | Sicherheit → API Tokens | `/admin/api-tokens` | behalten | |  -> Einrichtungen nur noch im Uwe Command Center, wenn dort noch nicht vorhanden nachziehen|
| D20 | Sicherheit → Webhooks | `/admin/webhooks` | behalten | | -> Einrichtungen nur noch im Uwe Command Center, wenn dort noch nicht vorhanden nachziehen |
| D21 | Sicherheit → Secrets-Status | `/admin/secrets` | behalten | | -> Einrichtungen nur noch im Uwe Command Center, wenn dort noch nicht vorhanden nachziehen |
| D22 | Betrieb → Backup & Restore | `/backup` | behalten | |  -> Einrichtungen nur noch im Uwe Command Center, wenn dort noch nicht vorhanden nachziehen|
| D23 | Betrieb → Migrationen | `/admin/migrations` | behalten | |  -> Einrichtungen nur noch im Uwe Command Center, wenn dort noch nicht vorhanden nachziehen|
| D24 | Betrieb → Version & Updates | `/system/version` | ~~behalten~~ | ✅ **WEG** — Version und Update laufen über das Command Center (M9 Host-Update). Damit sind auch D25 und D26 gegenstandslos, die dorthin integriert werden sollten | ✅ WEG |
| D25 | Betrieb → Was ist neu | `/system/whats-new` | **WEG** → in D24 integrieren | 39 Zeilen | |
| D26 | Betrieb → Startklar | `/system/startklar` | **WEG** → in D24 integrieren | 198 Zeilen, einmal pro Update relevant | |
| D27 | Betrieb → Health-Ampel | `/system/health` | **WEG** → Tab in D1 | 28 Zeilen | |
| D28 | Betrieb → Diagnose | `/system?tab=diagnose` | behalten (ist bereits Tab) | | |
| D29 | Betrieb → UWE KnowHow | `/system/uwe-knowhow` | **WEG** | 27 Zeilen Selbstdokumentation | |
| D30 | Betrieb → Tags | `/admin/tags` | behalten | | |
| D31 | Betrieb → Mail Center | `/mail` | **→ Brain** (siehe C40) | | |
| D32 | Betrieb → Cookbook *(ohne Nav)* | `/admin/cookbook` | behalten oder **WEG** | Hardware-Fit + lokale Modelle |**WEG**  |
| D33 | Einstellungen | `/settings` | behalten — **aufteilen** | 905 Zeilen, 11 Gruppen: app, worlds, campaigns, portal, ai, storage, backup, briefing, privacy, auth, maintenance |-> Einrichtungen nur noch im Uwe Command Center, wenn dort noch nicht vorhanden nachziehen |
| D34 | Konto → Passwort / 2FA | `/account/password`, `/account/security` | behalten | | |

---

# E · STUDIO — Welt-Ebene (31 Einträge pro Welt)

Alle sichtbar für owner/admin/dm.

| # | Gruppe → Bereich | Pfad `…= /worlds/[slug]` | Vorschlag | Begründung | Entscheidung |
|---|---|---|---|---|---|
| E1 | Übersicht → Übersicht | `…/dashboard` | behalten | | |
| E2 | Übersicht → Kampagnen-Radar | `…/radar` | **zusammenlegen** mit E27/E28/E29 | vier „Was ist offen?"-Werkzeuge | |
| E3 | Wiki → Wiki / Seiten | `…/wiki`, `…/[cat]/[slug]`, `…/[cat]/[slug]/edit` | behalten | | |
| E4 | Wiki → Seiten-Review | `…/page-review`, `…/page-review/[pageId]` | ~~behalten~~ | ✅ **WEG** — Review-Prozess entfällt komplett (N.7) | ✅ WEG |
| E5 | Wiki → Neue Seite | `…/pages/new` | behalten — evtl. Button statt Nav-Eintrag | ist eine Aktion, kein Bereich | |
| E6 | Wiki → Verbindungen / Graph | `…/graph` | behalten | | |
| E7 | Wiki → **Atlas 3D** | `…/atlas3d`, `…/atlas3d/[nodeId]` | **Grundsatzfrage** | 3 Packages, 21.750 Zeilen (6,7 % des Codes) für diese eine Seite | erstmal behalten|
| E8 | Wiki → Atlas (2D) *(ohne Nav)* | `…/atlas` | **WEG** | verwaister Vorgänger ||
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

# N · Zugangsmodell nach Notiz Lasse — **entschieden**

> **Notiz Lasse:** Das ganze nur dm sichtbar nur spieler sichtbar soll bitte entfernt
> werden. Ein spieler darf alles wissen einer welt sehen in der er zugeordnet ist.
> Die ganze Local vs Cloud geschichte Raus. Es gilt als Grundsatz! Alles was KI Aktionen
> sind, geht rein über den RTX Host. Kein Cloudprovider mehr und alles was davon abhängig
> ist wird entfernt.

## N.0 Beschlossenes Modell

| Achse | Entscheidung |
|---|---|
| **Zugang** | 4 Häkchen pro E-Mail im Command Center (Portal / Studio / Brain / Family). Konten legt nur der Owner an. |
| **Welt-Zuordnung** | `WorldMembership` bleibt — ohne Rollenwerte, nur „Person X gehört zu Welt Y". |
| **Sichtbarkeit in der Welt** | **entfällt vollständig.** Kein `visibility`, kein `publishStatus`, keine `gm_note`. Wer einer Welt zugeordnet ist, sieht alles darin. |
| **KI-Routing** | **entfällt vollständig.** Kein Cloud-Provider mehr; jede KI-Aktion läuft über den RTX-Host. Damit ist kein Datenschutz-Label mehr nötig. |
| **Rollen** | nur noch `owner`. |

Zu den beiden Bedenken, die ich in der Vorfassung erhoben hatte:

- **KI-Routing (N.3):** Deine Antwort löst mein Bedenken vollständig auf, sie umgeht es
  nicht. Meine Sorge war „Cloud-KI könnte private Inhalte bekommen". Wenn es **keinen**
  Cloud-Provider mehr gibt, kann das strukturell nicht mehr passieren. Ein Verbotsschild
  wird überflüssig, wenn die Straße nicht mehr existiert. Das ist die sauberere Lösung.
- **Sichtbarkeit (N.2):** Hier bleibt es bei deiner Entscheidung, und die Folge ist real
  und gewollt: Sobald eine Seite existiert, sieht sie jeder Spieler der Welt. Es gibt
  keinen Entwurfszustand mehr in UWE. Vorbereitung, die niemand sehen soll, passiert
  außerhalb — oder in einer Welt, der noch niemand zugeordnet ist. Notiert, umgesetzt wird
  es so. Eine technische Nebenwirkung siehe **N.7**.

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

## N.2 Sichtbarkeit — entfällt (N1 = alles raus)

| # | Frage | Entscheidung |
|---|---|---|
| N1 | `dm_only` / `player_visible` an Seiten und Blöcken | **raus** |
| N2 | `specific_players`, `unlock_after_session`, `secretLevel`/`revealState`, `publishStatus`, `gm_note` | **raus** |

Alles, was heute steuert, *was* jemand innerhalb einer Welt sieht, entfällt. Danach gilt
genau eine Regel: **Wer einer Welt zugeordnet ist, sieht alles darin.** Punkt.

Was das konkret löscht:

| Weg | Wo |
|---|---|
| `Visibility`-Enum (7 Werte) | `Page`, `ContentBlock`, `Asset` |
| `PublishStatus`-Enum (5 Werte) | `Page` — kein Entwurf/Review/Archiv mehr |
| `SecretLevel` / `revealState` | `Page`, `ContentBlock`, `Asset` |
| Blocktyp `gm_note` | `ContentBlock` |
| `PagePlayerAccess`, `SessionUnlock` | Prisma-Modelle für `specific_players` / `unlock_after_session` |
| `packages/auth/src/permissions.ts` | 291 Zeilen |
| `packages/auth/src/content-access.ts` | 248 Zeilen |
| `packages/auth/src/security/authz.ts` | 461 Zeilen |
| `packages/database/src/permissions.ts` | 213 Zeilen |
| `packages/database/src/content-access.ts` | 193 Zeilen |
| `player-note-permissions.ts`, `player-character-permissions.ts` | 144 Zeilen |

**217 Dateien** berühren heute `visibility` oder `publishStatus`. Das ist der mit Abstand
größte Umbau in diesem Dokument — deutlich größer als Family. Er ist aber weitgehend
mechanisch: Filter entfernen, Enum-Spalten droppen, Sichtbarkeits-Auswahl aus den Formularen
nehmen.

## N.3 KI-Routing — entfällt, weil es keine Cloud mehr gibt (N3 = raus)

Grundsatz aus der Notiz: **Jede KI-Aktion läuft über den RTX-Host. Kein Cloud-Provider.**

Damit entfällt nicht nur `owner_private_local`, sondern der ganze Apparat, der bisher
entschied, *wohin* eine Anfrage geht:

| Weg | Wozu es diente |
|---|---|
| `privacyGuard.ts` — `validateProviderContextCombination`, `validateResolvedRouteForContext`, `isCloudRouteAllowedForContext` | Cloud-Route gegen Kontext-Modus prüfen |
| `AiCloudProvider`, `AiUserGrant`, `AiGatewayConfig` *(teilweise)* | Cloud-Anbieter, Nutzerfreigaben, Budgets |
| Cloud-Provider im `aiRouter` + `createApiKeyStoreFromEnv` | API-Schlüssel für externe Anbieter |
| `AI_ALLOWED_MODELS`, `providerMode: "cloud" \| "auto"` | Routing-Entscheidung |
| `/admin/ai-gateway` (C10) als Provider-Verwaltung | Cloud-Budget und -Auswahl |
| Privacy-Klassen in `product-contracts` | Was darf den Host verlassen |

Was bleibt: der RTX-Connector, die lokalen Modelle, `AiRun`/`AiUsageLog` für die Historie.
`providerMode` schrumpft auf einen einzigen Wert und kann als Feld entfallen.

`household_shared` verschwindet kostenlos — die Klasse war nur mein Vorschlag und wurde nie
gebaut.

## N.4 Welt-Zuordnung — bleibt (N4 = a)

`WorldMembership` bleibt, aber **ohne Rollenwerte**. Heute hat es `owner`/`dm`/`co_dm`/`player`;
künftig ist es eine reine Zuordnung: Person X gehört zu Welt Y. Wer Studio darf, ist DM;
wer Portal darf, ist Spieler. Das steht schon im Häkchen.

## N.5 Zielbild — beschlossen

```
Zugang          → 4 Häkchen pro E-Mail im Command Center     (ersetzt Rollen + Capabilities)
Welt-Zuordnung  → WorldMembership ohne Rollenwerte           (wer gehört zu welcher Welt)
Sichtbarkeit    → entfällt                                    (Welt-Zuordnung = sieht alles)
KI-Routing      → entfällt                                    (alles über RTX, keine Cloud)
Owner           → einzige verbleibende Rolle                  (Betrieb, Restore, Command Center)
```

Zwei Achsen statt vier konkurrierender Modelle. Das ist in einem Satz erklärbar:
*„Häkchen sagt, welche App. Welt-Zuordnung sagt, welche Welt. Sonst nichts."*

## N.6 Geschätzte Löschmenge

| Bereich | Zeilen |
|---|---|
| Review-Prozess (N.7) | ~1.720 |
| Sichtbarkeitssystem (N.2) | ~1.550 |
| Rollen, Capability-Matrix, Gastmodus (N.1) | ~900 |
| Cloud-Routing und Privacy-Guards (N.3) | ~800 |
| Freigabe-Links (N.9) | ~600 |
| `product-contracts` (Zugangs- und Privacy-Teil) | ~430 |
| **Summe** | **~6.000 Zeilen**, plus Anpassungen in ~290 berührten Dateien |

Zum Vergleich: Das Repo hat heute ~353.000 Zeilen TypeScript. Der Umbau löscht also rund
**1,7 % des Codes** — und zwar den Teil, der am schwersten zu erklären war.

## N.7 Review-Prozess ✅ **entfällt vollständig**

Der Konflikt aus der Vorfassung — C26 und E4 hängen an `publishStatus` — ist damit
gegenstandslos: Nicht der Zustand wird ersetzt, sondern der ganze Prozess entfernt.

| # | Entscheidung |
|---|---|
| N5 | **Der gesamte Review-Prozess wird entfernt.** Kein Ersatzfeld, kein `reviewState`. |

Was dabei weggeht:

| Weg | Zeilen |
|---|---|
| `packages/page-ai-review` (ganzes Package) | 509 |
| `packages/database/src/ai-review-service.ts` | 1.206 |
| Prisma-Modelle `ContentReview`, `ReviewComment` + Enums `ContentReviewStatus`, `ContentReviewSourceType` | – |
| Studio `/admin/reviews` (C26) | – |
| Studio `…/page-review` + `…/page-review/[pageId]` (E4) | – |
| API `…/page-reviews`, `…/page-reviews/[pageId]`, `…/page-reviews/[pageId]/refine` | – |
| Capabilities `review_approve`, `proposal_submit` | fallen ohnehin mit N.1 |

**40 Dateien** referenzieren heute den Review-Prozess. Zusammen mit N.2 und N.3 steigt die
Löschmenge damit auf **~5.400 Zeilen**.

Der benachbarte **KI-Vorschlags-Flow** ist davon *nicht* betroffen — siehe N.8.

## N.8 KI-Vorschläge ✅ **bleiben**

| # | Entscheidung |
|---|---|
| N8 | Der KI-Vorschlags-Flow (`AiRun` → `AiProposal` → anwenden/verwerfen) **bleibt** unverändert. |

Er ist ein anderer Mechanismus als der gestrichene `ContentReview`: Die KI erzeugt einen
Vorschlag, du siehst ihn unter `/ai` (C9) und Welt → KI-Läufe (E27) und entscheidest pro
Vorschlag. `AiRun`, `AiProposal`, `AiApplyLog` und die zugehörigen Ansichten bleiben.

Das ist nach dem Wegfall von Sichtbarkeit und Entwurfsstatus auch der **einzige verbliebene
Zwischenschritt** vor der Veröffentlichung: Was angewendet wird, sehen die Spieler sofort.

## N.9 Freigabe-Links ✅ **entfallen**

| # | Entscheidung |
|---|---|
| N9 | `ShareLink` und alles daran hängende wird entfernt. Wirklich nur Allowlist. |

Anonymer Zugriff per Link — ohne Konto, ohne Häkchen — war die einzige Ausnahme vom
Grundsatz „nur Leute auf der Allowlist kommen rein". Sie fällt.

| Weg | Zeilen |
|---|---|
| `packages/database/src/share-link-service.ts` | 424 |
| `apps/portal/src/lib/share-access.ts`, `share-auth.ts` | 55 |
| `apps/studio/app/share-actions.ts` | 103 |
| Portal `/share/[token]`, `/share/[token]/pages/[slug]` | 2 Seiten |
| Portal `…/api/share/[token]/verify`, `…/assets/[assetId]/file` | 2 Routen |
| Prisma `ShareLink`, `ShareAccessLog` | 2 Modelle |
| `AccessContext`-Variante `"share"`, `shareGrant`, `PLAYER_PREVIEW_ALLOW_DM_ONLY` | — |

**44 Dateien** betroffen. Wer künftig etwas sehen soll, bekommt ein Konto mit Häkchen.

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
| G12 | **Family-Chatbot** | Wissen wird gespeichert, ist für die ganze Familie sichtbar und dient als Kontext im **Family-Brain** | ✅ entschieden |
| G13 | Mitglieder & Freigaben | nur Owner: E-Mail einladen, Bereiche freischalten | ✅ |
| **G19** | **Privat-Chatbot** *(Zusatz Lasse)* | Wird gespeichert, aber **nur für die schreibende Person sichtbar**. Legt bei Bedarf ein privates Brain für die Person an | ✅ entschieden — siehe G.2b |

### G.2a Family-Chatbot im Detail

**Aktualisiert:** Seit PR #795 gibt es den Brain-KI-Chat (A14). Der Family-Chatbot braucht
damit kein Konzept mehr, sondern eine Kopiervorlage — `@uwe/brain-assistant` (1.384 Zeilen)
liefert Konversationsmodell, Anhänge, Modellwahl, RAG-Kontext, Bildanalyse und Diktat
bereits fertig.

| Aspekt | Entscheidung | Vorlage vorhanden? |
|---|---|---|
| Datenbasis | nur Family-Daten (Verträge, Dokumente, Essensplan, Kalender, Haushalt) | ✅ `rag-context.ts` |
| Provider | RTX-Host — wie künftig alles (N.3) | ✅ nach dem Cloud-Ausbau der einzige Weg |
| Antwortumfang | **wer in Family ist, darf alles sehen was in Family ist** — keine Filterung pro Person | ✅ entfällt damit |
| Konversationen, Anhänge, Diktat | übernehmen | ✅ 4 Prisma-Modelle + `chat-runner.ts` |
| Guard | Häkchen `Family` | ⚠️ `requireBrainActionAuth()` prüft nur Owner — wird zur Family-Zugehörigkeitsprüfung |

Damit fällt die Mehrbenutzer-Filterung weg, die ich zuvor als den einzigen echt neuen Teil
bezeichnet hatte. Der Family-Chat ist eine fast unveränderte Kopie des Brain-Chats mit
anderer Datenquelle.

### G.2b Privat-Chatbot (G19) — Ablage nach aktuellem Benutzer

Neben dem geteilten Family-Chat gibt es einen **privaten** Chat. Was dort geschrieben wird,
sieht nur die schreibende Person. Existiert für sie noch kein privates Brain, wird es
angelegt.

**Ablageort richtet sich nach dem angemeldeten Benutzer:**

| Wer chattet | Wohin Wissen und Konversation gehen |
|---|---|
| **Owner** *(ist automatisch Teil der Family)* | zurück ins **Owner-Brain** (`uwe-brain.db`) — nicht in die Family-DB |
| jedes andere Family-Mitglied | **privates Brain in der Family-DB**, getrennt über die Benutzer-ID |

Das heißt konkret: Der Owner hat *einen* Wissensspeicher, egal ob er ihn über `apps/brain`
oder über den privaten Family-Chat füttert. Family-Mitglieder haben je einen eigenen, der
den Owner-Brain nie berührt.

| Speicher | Wer sieht ihn | Liegt in |
|---|---|---|
| **Owner-Brain** | nur Owner | `uwe-brain.db` |
| **Family-Brain** (G12) | alle mit Häkchen `Family` | `uwe-family.db` |
| **Privates Brain je Mitglied** (G19) | nur diese Person | `uwe-family.db`, nach `userId` getrennt |

`apps/brain` bleibt damit owner-only; das Häkchen `Brain` behält seine Bedeutung.

> **Anmerkung zur Konsistenz:** Die Trennung „nur diese Person sieht es" läuft hier über
> **Eigentum** (`userId` am Datensatz), nicht über ein Sichtbarkeits-Label. Das ist etwas
> anderes als das nach N.2 gestrichene `visibility` und widerspricht deiner Entscheidung
> nicht — Eigentum bleibt, Sichtbarkeitsstufen fallen weg.

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
| G14 | Eigene App (`apps/family`) oder Bereich in Studio? | **eigene App** — sonst wiederholen wir das Brain/Studio-Duplikat | ✅ |
| G15 | Eigene DB (`uwe-family.db`) | **ja** — mit den privaten Brains der Mitglieder darin (G.2b). Nur der Owner schreibt weiterhin in `uwe-brain.db` | ✅ entschieden |
| G16 | Dürfen Family-Mitglieder ins Portal oder Studio? | ergibt sich aus den Häkchen — wer nur `Family` hat, kommt nirgends sonst hin | ✅ |
| G17 | Chatbot-Provider | RTX-Host, wie alles nach N.3 | ✅ |
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

# H · Die 11 Doppelungen ✅ **entschieden: Brain gewinnt**

Diese Bereiche existierten **zweimal**, in Brain und in Studio, auf derselben Datenbank.
Deine Entscheidungen ergeben durchgehend Weg (A) aus der Liste unten: **Brain gewinnt,
Studios „Organisation" wird abgeräumt** — außer bei Verträgen, Dokumenten und Kalender,
die ganz nach Family wandern.

Damit stimmt auch der Domain-Contract wieder, und Studios 108 Direktimporte auf
`@uwe/database/brain-client` verschwinden. Preis: Brain muss den Funktionsumfang der
Studio-Seiten aufholen — grob 3.700 Zeilen, vor allem bei Hardware (148 statt 641),
Verträgen und Projekten.

| # | Bereich | Brain | Studio | LOC Brain / Studio | Entscheidung: welche Seite gewinnt? |
|---|---|---|---|---|---|
| H1 | Heute | `/today` | `/today` | 74 / 202 | Brain|
| H2 | Wissen / Life Brain | `/life-brain` | `/life-brain` | 227 / 193 | ✅ **Brain** — die Trennung besteht schon, siehe Antwort unten |
| H3 | Capture | `/capture` | `/capture` | 156 / 49 | ✅ **Brain** (keine Angabe → Empfehlung) |
| H4 | Projekte | `/projects` | `/projects` | 216 / 522 |Brain |
| H5 | Werkstatt | `/workshop` | `/workshop` | 159 / 451 |Brain|
| H6 | Miniaturen | `/miniatures` | `/miniatures` | 157 / 277 |Brain |
| H7 | Verträge | `/contracts` | `/contracts` | 172 / 513 | *(→ Family, dann beide weg)* |
| H8 | Hardware | `/hardware` | `/hardware` | 148 / 641 |Brain |
| H9 | Dokumente | `/documents` | `/documents` | 135 / 143 | *(→ Family, dann beide weg)* |
| H10 | Mail | `/mail` | `/mail` | 225 / 136 | Brain|
| H11 | Kalender | `/calendar` | `/calendar` | 215 / 405 | ✅ **→ Family**, beide weg |

Zwei saubere Wege, ein dritter ist keiner:

- **(A) Brain gewinnt** — Studios „Organisation" wird zu Redirects. Studio ist wieder reine
  DM-App, `product-contracts` stimmt, die 108 `brain-client`-Importe verschwinden.
  Kosten: Brain muss ~3.700 Zeilen Funktionalität aufholen.
- **(B) Studio gewinnt** — `apps/brain` wird gelöscht (3.400 Zeilen), Life-Brain-Inhalte
  bleiben in Studio hinter `owner`. Sofort umsetzbar, aber dann muss
  `product-contracts` weg, weil das Produktmodell aufgegeben wird.
- **(C) Status quo** — doppelte Wartung ohne Produktargument.

> **Antwort auf deine Frage bei H2** — „Aufteilen auf Privat und Gamebrain?"
>
> Die Trennung existiert bereits, sie ist nur schlecht benannt. Es sind **zwei getrennte
> Wissensspeicher in zwei verschiedenen Datenbanken**, die zufällig beide „Brain" heißen:
>
> | Heute | Modelle | Datenbank | Inhalt |
> |---|---|---|---|
> | Studio `/brain`, Welt `…/brain` | `BrainDocument`, `BrainChunk`, `BrainFact` | App-DB | **Spielwissen**, pro Welt — Kanon, NPCs, Lore |
> | Brain `/life-brain` | `PersonalBrainDocument`, `PersonalBrainChunk`, `PersonalBrainFact` | `uwe-brain.db` | **Privatwissen** |
>
> Es gibt also nichts aufzuteilen — nur umzubenennen, damit man sie auseinanderhält. Mein
> Vorschlag steht schon als **C5** in der Liste: Studios `/brain` heißt künftig
> **„Welt-Wissen"**, und „Brain" meint dann eindeutig nur noch deine private App.
>
> Nach diesem Umbau gibt es vier Wissensspeicher mit klaren Namen:
>
> | Speicher | Wer sieht ihn | Datenbank |
> |---|---|---|
> | **Welt-Wissen** | wer der Welt zugeordnet ist | App-DB |
> | **Owner-Brain** | nur du | `uwe-brain.db` |
> | **Family-Brain** | alle mit Häkchen `Family` | `uwe-family.db` |
> | **Privates Brain je Mitglied** | nur diese Person | `uwe-family.db` |

---

# I · Zielbild, wenn du allen Vorschlägen folgst

| Bereich | Anzahl | Inhalt |
|---|---|---|
| **Command Center** | ~25 | 11 bestehende Kacheln · **Zugänge (M13)** · der komplette Studio-System-Bereich |
| **Landing** | 3 | Startseite · Login-Weiche · Health |
| **Portal** | 18 | unverändert (minus Atlas-2D-Leiche) |
| **Studio** | 13 + Welt-Ebene | Start · Welten · Welt-Wissen · KI · Templates · Image Studio · Import · Reviews · Bug-Center — **kein System-Bereich mehr** |
| **Brain** | 13 | Start · Heute · Life Brain · Wissensassistent · **KI-Chat** · Capture · Projekte · Werkstatt · Miniaturen · Hardware · Mail · Ideen · **System-Hub** |
| **Family** | 14 | Start · Verträge · Dokumente · Küche · Essensplan · Einkaufsliste · Vorrat · Haushalt · Finanzen · Kalender · Scan · **Family-Chat** · **Privat-Chat** · Mitglieder |

Gestrichen: **28 Bereiche** — C3, C14, B24, E8, E32, L4 sowie der gesamte Abschnitt D
(bis auf D34, das in Studio und Portal bleibt, und D30, das zu den Welten wandert).
Zusammengelegt: 4 Welt-Werkzeuge → 1, Print Center → Labels, NL-Befehle → Bereichssuche.

Dazu die Code-Löschung aus N.6: **~3.700 Zeilen** Rechte-, Sichtbarkeits- und
Cloud-Routing-Code, verteilt über 217 berührte Dateien.

---

# J · Reihenfolge, die ich empfehle

*Fortgeschrieben 2026-07-26 abends.*

1. ~~Rechte-Lücken B1/B2 schließen~~ — **erledigt** (PR #797, gemergt)
2. ~~Liste ausfüllen~~ — **erledigt**, bis auf **N5** und **B8a**
3. **Cloud-Ausbau** (N.3) — alle Cloud-Provider, Gateway-Budgets und Privacy-Guards raus,
   alles über den RTX-Host. Zuerst, weil es unabhängig von allem anderen ist und die
   KI-Pfade danach nur noch einen Weg kennen.
4. **Review-Prozess und Freigabe-Links ausbauen** (N.7, N.9) — beide hängen an der
   Sichtbarkeit und müssen vor ihr weg, sonst repariert man Code, den man danach löscht.
5. **Sichtbarkeit ausbauen** (N.2) — `visibility`, `publishStatus`, `secretLevel`,
   `gm_note`, `PagePlayerAccess`, `SessionUnlock` und die fünf Permission-Module.
   Größter Einzelposten, ~1.550 Zeilen plus 217 berührte Dateien.
6. **Zugangsmodell umbauen** (M13 + N.1) — vier Häkchen im Command Center, Rollen und
   Capability-Matrix raus. Danach ist `owner` die einzige Rolle.
7. **Studio-System abräumen** (Abschnitt D) — Konfiguration ins Command Center nachziehen,
   System-Hub nach Brain, Rest löschen.
8. **Brain/Studio-Doppelungen auflösen** (H) — Brain gewinnt; Studios „Organisation" wird
   abgeräumt, die 108 `brain-client`-Importe verschwinden.
9. **Family bauen** — eigene DB mit Family-Brain und privaten Brains, Häkchen-Zugang,
   zwei Chats als Ableitung von `@uwe/brain-assistant`.
10. Restliche Verschlankung (C–E), **B8a** und **L4** nebenher.

Die Reihenfolge 3 → 4 → 5 → 6 ist bewusst so: Jeder Schritt macht den nächsten kleiner.
Wer zuerst das Zugangsmodell umbaut, fasst die Sichtbarkeitslogik zweimal an; wer die
Sichtbarkeit vor dem Review-Prozess anfasst, repariert Code, den er danach löscht.

**Lieferform:** ein PR pro Schritt, jeder für sich lauffähig und mit grünem Gate. Bei
~6.000 gelöschten Zeilen über ~290 Dateien wäre ein einzelner PR weder prüfbar noch
sicher zurückzurollen.

*Zurückgestellt: E34 (`terra.html`) — berührt keinen der Schritte oben und kann jederzeit
nachgezogen werden. **E7 (Atlas 3D) bleibt offen** und ist mit 21.750 Zeilen weiterhin der
größte Einzelposten.*
