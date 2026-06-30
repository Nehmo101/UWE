# UWE Feature-Backlog — Umsetzungsplan & Status-Audit

Stand: 2026-06-30 · Eingabe: großer Ideen-Backlog (59 Ideen in 4 Bereichen)

> **Zweck dieses Dokuments.** Es ist ein **Planungs-Dokument**, kein Implementierungs-PR.
> Es bildet jede der 59 Ideen auf den **realen Code-Stand** ab (vorhanden / teilweise / fehlt),
> macht **Verbesserungsvorschläge**, **hinterfragt** zweifelhafte Punkte und schlägt eine
> **priorisierte Roadmap** vor. Es wird bewusst **noch nichts umgesetzt**.
>
> Verwandte Quellen der Wahrheit: [CURRENT_STATE.md](CURRENT_STATE.md) (Runtime/CI),
> [FEATURE_MATURITY_MATRIX.md](FEATURE_MATURITY_MATRIX.md) (Reifegrade),
> [ROADMAP.md](ROADMAP.md) (offene Bereiche). Dieses Dokument ergänzt sie und sollte bei
> Beschluss in die ROADMAP überführt werden, statt eine Parallelstruktur zu bilden.

---

## 0. Kernaussage (TL;DR)

Der Backlog liest sich wie eine Liste „neuer“ Features — tatsächlich ist UWE aber **schon sehr
weit**. Von 59 Ideen sind nach Code-Audit:

| Status | Anzahl | Bedeutung |
|--------|--------|-----------|
| ✅ **Vorhanden** (EXISTS) | **9** | End-to-end nutzbar für den beschriebenen Kern |
| 🔶 **Teilweise** (PARTIAL) | **43** | Datenmodell/Service/Teil-UI da — Ausbau nötig |
| ⬜ **Fehlt** (MISSING) | **7** | Kein nennenswerter Code vorhanden |

**Konsequenz für die Planung:** Das ist zu ~73 % ein **„Ausbauen & Sichtbarmachen“**-Projekt,
kein „von null bauen“-Projekt. Der größte Hebel liegt nicht in neuen Systemen, sondern darin,
bereits zu 80 % fertige Bausteine **fertig zu verdrahten** und einige **Quer­schnitts-Fundamente**
(zentrales Tag-Modell, einheitlicher Activity-/Audit-Browser, strukturierte Entitäten,
cross-domain Suche) zu legen, von denen viele Einzelideen profitieren.

**Nur 7 echte Neubau-Themen:** World-Templates, Owner-Notfallmodus, Spieler-Timeline,
Inventar/Gruppenbesitz, Faction-Simulator, World-Clock (In-Game-Zeit), Bug-Center.

**Architektur-Leitplanken (gelten für *jede* Umsetzung unten):**

- Business-Logik in `packages/*`, nicht in Next.js Route Handlers (siehe `CLAUDE.md`/`AGENTS.md`).
- Portal bleibt **read-only & player-safe**: niemals `dm_only` ausspielen; Filter im
  Repository/Service-Layer, nicht nur in der UI.
- **Brain/Welt/Life-Kontext nie an Cloud-KI**; RTX-only für Wissen, Cloud nur „Allgemeiner Chat“.
- KI-Ausgaben sind **Vorschläge** (Proposal → Review → Apply), nie Auto-Kanon.
- Scope-Disziplin: bestehende Services erweitern statt duplizieren; Package-Grenzen einhalten.

---

## 1. Status-Legende

| Symbol | Status | Definition |
|--------|--------|-----------|
| ✅ | Vorhanden | Nutzbar end-to-end für den dokumentierten Kern |
| 🔶 | Teilweise | Modell/Service/Teil-UI vorhanden, aber unvollständig vs. Idee |
| ⬜ | Fehlt | Kein nennenswerter Code |

Spalten in den Audit-Tabellen: **Idee → Status → Bestehende Basis (Pfade) → Lücke / Empfehlung**.
Vertiefende Design-Fragen stehen je Bereich unter „Details & kritische Fragen“.

---

## 2. Bereich 1 — Admin / Owner (18 Ideen: 3 ✅ · 13 🔶 · 2 ⬜)

| # | Idee | Status | Bestehende Basis | Lücke / Empfehlung |
|---|------|:--:|------------------|--------------------|
| 1 | Owner Cockpit | 🔶 | `/admin`, `/admin/status`, `admin-status.ts`, `system-status.ts`, `/today` Ampel | Kein **einzelner** Cockpit-Screen mit aktiven Welten + User-Zahlen + letzte Änderungen + Fehler zusammen. Empfehlung: Aggregations-View, der bestehende Services bündelt (kein neues Datenmodell). |
| 2 | Rollen & Rechte | 🔶 | `UserRole` (owner/admin/dm/player/readonly/guest), `WorldMembership.role` (owner/dm/co_dm/player), `role-capabilities.ts`, `/admin/users` | Keine **pro-Bereich**-Rechte (z. B. „Mail-Admin, aber kein Backup“). Frage: braucht es echte feingranulare Capabilities oder reichen Rollen? |
| 3 | Audit Log | 🔶 | `AuditLog` + `/admin/audit-log`; `ActivityLog` + `activity-log-service.ts` (Inhalts-/KI-Änderungen) | **Zwei** Logs, kein vereinheitlichter „Wer hat was geändert“-Browser. `ActivityLog` hat außer einem Security-Slice keine Browse-UI. Empfehlung: ein gemeinsamer Verlauf-Browser. |
| 4 | Backup / Restore | 🔶 | `packages/backup` (full/world/campaign), `/backup`, Pre-Restore-Safety, Auto-Scheduler (`schedule.json` + systemd-Timer) | **Auto-Snapshot vor Migrationen** ist nur dokumentiert, nicht im aktiven Linux-Pfad erzwungen. Empfehlung: `db:deploy`-Wrapper, der vorher `backup:create` ruft. |
| 5 | AI Provider Management | 🔶 | `/admin/ai-gateway`, `ai-gateway-service.ts`, `AiGatewayConfig`/`AiCloudProvider`/`InferenceEndpoint`, RTX-Router | **Modell pro Feature** fehlt als UI (Privacy pro Feature existiert). Provider sind über Gateway + RTX-Connector verteilt, keine flache Provider-Liste. |
| 6 | Secrets / API-Key Vault | 🔶 | `token-crypto.ts` (AES-256-GCM via `AUTH_SECRET`), `AiCloudProvider.apiKeyEnc`, `ApiToken`, `/admin/api-tokens` | Kein **einheitlicher Vault** für `AUTH_SECRET`/SMTP/RTX/Cloudflare — bleibt ENV/Host-Secret. **Kritische Frage unten** (Henne-Ei-Problem). |
| 7 | Import-Zentrale | 🔶 | `packages/knoteforge-import` (json/markdown), `/worlds/[slug]/import`, Preview+Execute+Undo | Nur **welt-bezogener** Import, **kein** Ziel-Picker (Personal-Brain/DnD/Capture), **kein** Obsidian/PDF/Bulk-Bild. |
| 8 | Admin Aufgabenliste | 🔶 | `/admin/setup` (Tabs system/access/cloudflare/mail/rtx/printer), `owner-setup-service.ts` (`nextSteps[]`), `/today` Homelab-Alerts | Keine **eine** Checkliste Mail+Backup+AI+Cloudflare+User+Worlds mit Fortschritt %. |
| 9 | Health Checks | ✅ | `/api/health` (Studio+Portal), `/admin/status`, `homelab-cockpit.ts` (DB/Portal/Cloudflare/RTX/Ollama/Backup) | Klein: Cloudflare-Health ist Heuristik, keine Live-Tunnel-API. Kern erfüllt. |
| 10 | Migration Inspector | 🔶 | `migration-status.ts` (pending/failed aus `_prisma_migrations`), in `/admin/status` & `/system/host-control`, CI `migration-check.mjs` | Keine **dedizierte Inspector-UI** mit Liste/Fehlerdetails/Repair. |
| 11 | User Management | ✅ | `/admin/users` + `UserManagementWorkspace`, `user-service.ts` (create/invite/disable/role/reset), `WorldMembership` | Invite-Mail hängt an Mail-Config. Kern erfüllt. |
| 12 | World Templates | ⬜ | `world-creation-service.ts` (nur leere Welt), `PageTemplate` (nur **Seiten**-Templates) | **Echtes Neubau-Thema**: Welt-Archetypen (DnD/Wargame/Roman/Projektwiki) bei Welt-Erstellung. Empfehlung: Template = Satz Seed-Seiten/Templates + Default-Settings. |
| 13 | Content Moderation / Freigabe | ✅ | `ContentReview` + `/admin/reviews`, `review-service.ts`, `AiProposal`/`ai-review-service.ts` (kein Auto-Apply) | Review-zentriert; nicht jeder KI-Pfad erzeugt zwingend Review. Kern erfüllt. |
| 14 | System-Changelog | 🔶 | `/system/version` (Build-Info), `/system/uwe-knowhow` (durchsucht `CHANGELOG.md`/docs) | Kein **„Was ist neu“** nach Update (geparste Release-Notes/Modal). |
| 15 | Owner Notfallmodus | ⬜ | verwandt: `settings.portal.portalEnabled`, `AUTH_REQUIRED`, Host-Script `stop_uwe_service_for_maintenance` | **Echtes Neubau-Thema**: `maintenanceMode`/`lockPortal`/`lockStudio` mit Owner-Bypass in `SystemSettings` + Middleware. |
| 16 | Kosten-Dashboard | 🔶 | `AiUsageLog` (Tokens/`estimatedCostUsd`/Feature/User), Budget+CSV im AI-Gateway-Wizard; `ContractExpense`/`/contracts` (Life-Admin) | Kein **vereinheitlichtes** Dashboard pro User/Welt/Feature. **Frage:** AI-Kosten wirklich „in Verträge“ mischen? |
| 17 | AI Agent Queue | 🔶 | `Job`/`JobLog` + `/jobs` (ai_run/import/canon_check/embedding/research), `DevAgentJob` + `/admin/agent-jobs` | `DevAgentJob` = Repo-Automation, nicht „Terra analysieren / NPCs erzeugen“. Keine 1-Klick-Presets für lange Kampagnen-Jobs. |
| 18 | Admin Command Center (NL) | 🔶 | `StudioCommandPalette` (statische Nav-Befehle), `/api/command/search` (Wiki-Suche) | **Keine** natürliche Sprache, keine Mutations-Befehle. **Sicherheits-kritisch** (siehe Fragen). |

### Details & kritische Fragen — Admin/Owner

- **#6 Secrets-Vault — Henne-Ei-Problem.** Ein „Vault“ in der DB braucht einen Schlüssel, der
  **nicht** in der DB liegen darf (`AUTH_SECRET` lebt in `/etc/uwe/uwe.env`). Ein vollständiger
  Vault über das bestehende `apiKeyEnc`-Muster hinaus bringt wenig Sicherheitsgewinn, aber Risiko
  (Schlüssel-Rotation invalidiert Spotify/Provider-Tokens). **Empfehlung:** kein generischer
  Secret-Store; stattdessen (a) Provider-/SMTP-/RTX-Keys konsequent verschlüsselt in DB +
  (b) eine **read-only Secret-Status-Seite** („gesetzt / fehlt / aus ENV“), keine Klartext-Anzeige.
- **#18 NL Command Center — Sicherheit zuerst.** Frei interpretierende LLM-Tool-Calls auf
  Mutationen (User anlegen, Rechte vergeben) sind ein **Prompt-Injection-Risiko**. **Empfehlung:**
  eingeschränkte Befehls-Grammatik (Intent-Parsing → strukturierter Vorschlag) **mit
  Bestätigungsdialog + Audit-Log-Eintrag**, statt direktem Ausführen. Passt zur bestehenden
  Proposal/Review-Philosophie.
- **#1/#3/#16 gehören zusammen.** Owner-Cockpit, einheitlicher Audit-Browser und Kosten-Rollups
  sind dieselbe Aufgabe: **bestehende Aggregations-Services in einer View bündeln**. Lieber ein
  gemeinsames „Cockpit + Verlauf + Kosten“ als drei Einzel-Screens.
- **#15 Notfallmodus** ist klein umsetzbar (Settings-Flag + Middleware), aber **muss den
  Owner-Bypass sicher lösen** (Rolle aus Session, nicht aus Query-Param).

---

## 3. Bereich 2 — Spieler (11 Ideen: 3 ✅ · 6 🔶 · 2 ⬜)

| # | Idee | Status | Bestehende Basis | Lücke / Empfehlung |
|---|------|:--:|------------------|--------------------|
| 1 | Mobile-first Portal | 🔶 | `PortalShell` (Drawer/Sheet), responsive CSS, `portal-dashboard-service.ts`; `MobileBottomNav` & `portalAuthBottomNav` existieren, **aber nicht verdrahtet** | Keine Thumb-Zone-Bottom-Nav in Produktion. Nav-Item **„Wiki“ → `…/wiki` 404** (`portal-nav.ts:75`). „Link öffnen → sofort sehen“ erfordert Login+Welt-Wahl. |
| 2 | Charaktersheet Designer | 🔶 | `PageType.player_character`, `PlayerCharacterEditPanel`, `player-character-permissions.ts`, Dashboard-Widget | **Kein `Character`-Modell**, kein 5e-Sheet (Werte/HP/Zauber/Inventar), kein `player_character`-Template. Aktuell freie Wiki-Blöcke. |
| 3 | Session Recap | ✅ | `GameSession` (`summaryPlayer`/`openPlots`/`playerDecisions`/`recapPublished`), `SessionRecapFeed`, `publishRecap`, KI-Recap | Text/Markdown, kein „Story-Timeline“-Layout (minor). Kern erfüllt. |
| 4 | Questlog | 🔶 | `PageType.quest` + Quest-Template, Dashboard `openQuests` | **Kein Quest-Lifecycle** (aktiv/erledigt/gescheitert), keine Questlog-Route, keine DM-Status-Toggles, kein `quests`-Suchfilter. |
| 5 | Handout-Bereich | ✅ | `PageType.handout` + Template, `Asset`(image/map/handout/document), Portal `/assets`, `ShareLink`, `generate_handout` | Handouts auf Assets **und** Wiki-Seiten verteilt; kein typisierter Unterbereich (Rätsel/Briefe). Kern erfüllt. |
| 6 | Spielernotizen | ✅ | `PlayerNote` (private/dm_only/party + status-Workflow), `/auth/.../notes`, DM-Review in Studio, Backup opt-in | Kein Realtime-Collab (Formular-CRUD). Kern erfüllt. |
| 7 | NPC-Liste für Spieler | 🔶 | `PageType.npc`, `filterPagesForViewer`/`gm_note`-Schutz, `PagePlayerAccess`/`SessionUnlock`, Dashboard `knownNpcs`, Suchfilter `npcs` | **Keine dedizierte NPC-Listen-Route**; `player_character`+`monster` im selben Widget gemischt. |
| 8 | Timeline (Spielersicht) | ⬜ | `ContentBlockType.timeline` (unstrukturiert), `GameSession.date`/`sessionNumber` | **Echtes Neubau-Thema**: chronologische, spoiler-freie Ereignis-Ansicht; kein Renderer, kein Event-Aggregat. |
| 9 | Beziehungsnetz | 🔶 | `PageLink`, `graph-service.ts` (`buildWorldGraph(...,"portal")` respektiert Visibility), Portal-API `/api/worlds/[slug]/graph`, `GraphView` | **Keine Portal-Graph-Seite** (nur JSON-API); nicht in `portalWorldNav`. UI-Komponente existiert in Studio. |
| 10 | Inventar / Gruppenbesitz | ⬜ | verwandt: `PageType.loot` (Dungeon), `PageType.item` (Handouts) | **Echtes Neubau-Thema**: kein Inventar/Party-Treasury-Modell (Geld/Items/Artefakte). |
| 11 | Spieler-Dashboard vor Session | 🔶 | `portal-dashboard-service.ts` (`nextSession`/`lastRecap`/quests/...), Hub `(hub)`, `SessionUnlock` | **`nextSession` faktisch immer leer** (s. u.); kein „vor Session N lesen“-Prep-Paket. `PlayerDashboard.tsx` ungenutzt. |

### Details & kritische Fragen — Spieler

- **#11/#1 konkreter Bug: `nextSession` ist für Spieler praktisch immer `null`.**
  `getPortalDashboard` (`auth.ts:959`) speist das Dashboard nur mit
  `listPublishedForPortal` → `recapPublished: true` (`game-session.ts:447`). `buildDashboard`
  filtert daraus aber `status === "planned" || "prepared"` (`portal-dashboard-service.ts:135`) —
  und genau diese geplanten Sessions haben **keinen** veröffentlichten Recap. Ergebnis: „Keine
  geplante Session bekannt“. **Spannungsfeld:** Portal soll Prep nicht leaken, will aber die
  *nächste* Session zeigen. **Empfehlung:** player-safe „angekündigte Session“ (nur Datum/Titel/
  optional Teaser) über ein eigenes Flag (z. B. `playerVisibleSchedule`) exponieren, ohne DM-Prep.
- **#2 Charaktersheet — wie tief?** Voll-5e-Sheet bedeutet **Regelpflege** (2014 vs. 2024),
  Validierung, hoher Aufwand. **Frage:** reicht ein **strukturierter Sheet-Block** (Attribute,
  HP, AC, Slots, Inventar-Referenz) auf `player_character`-Seiten, der den bestehenden
  `statblock`-Block-Typ wiederverwendet? Nur Anzeige oder editierbar durch Spieler?
- **#9 Beziehungsnetz — billiger Win.** Backend + API + Komponente existieren; es fehlt **eine
  Portal-Seite**, die `GraphView` mit der vorhandenen Portal-Graph-API füttert.
- **#4 Questlog — leichtgewichtig.** Statt `Quest`-Modell genügt ein **Status-Feld auf
  Quest-Seiten** (`offen/erledigt/gescheitert`) + Questlog-Route + Suchfilter.
- **#10 Inventar — Scope klären.** Pro Charakter, pro Gruppe, oder beides? Währung modellieren?
  Empfehlung: mit **Gruppen-Inventar** (Party-Treasury) starten; pro-Charakter später.

---

## 4. Bereich 3 — DnD (18 Ideen: 2 ✅ · 14 🔶 · 2 ⬜)

| # | Idee | Status | Bestehende Basis | Lücke / Empfehlung |
|---|------|:--:|------------------|--------------------|
| 1 | World Database | 🔶 | `PageType` (location/region/npc/faction/item/monster/quest/secret/lore/...), `page-types.ts`, Kategorie-Routen | **Kein `god`/`deity`/`event`**-Typ (als `lore`/`note` modelliert); keine welt-weite „Secrets-Registry“. |
| 2 | Verlinkungssystem | 🔶 | `PageLink` (`relationType`/`label`), Wikilinks (`wikilink-utils.ts`), `graph-service.ts`, Backlinks-UI | **Keine Studio-UI zum Anlegen/Bearbeiten typisierter `PageLink`** (nur Import/Seed/API); `relationType` ist freier String ohne Presets. |
| 3 | Kanon-Status | 🔶 | `Page.canonicalStatus` (idea/draft/canon/deprecated/contradictory/non_canon), editierbar | Kein `prepared`/`happened-in-play`/`discarded`. Überlappt mit `publishStatus`. **Empfehlung: vereinheitlichen** (siehe Fragen). |
| 4 | Spoiler-Level | 🔶 | `Visibility`, `SecretLevel`(none/spoiler/dm_secret)+`RevealState`(hidden/preview/revealed), `content-access.ts`, `SessionUnlock` | Kein erstklassiges „teilweise bekannt“ (am ehesten `RevealState.preview`). Starkes Modell, andere Taxonomie. |
| 5 | Session Manager | 🔶 | `GameSession` (prep/notes/post/openPlots), `game-session.ts`, Routen, KI-Recap, Kalender-Sync | Kein dedizierter **Live-Modus** (eine `notes`-Textarea); Recap ist manuell (Proposal→Publish), nicht automatisch. |
| 6 | Dungeon Cockpit | ✅ | `dungeon-cockpit.ts` (dungeon→level→room→encounter/trap/puzzle/loot/secret/map), volle Routen, `prepStatus`, Label/Print | Nahezu vollständig. |
| 7 | Encounter Builder | 🔶 | `dnd-api/encounter-builder.ts` (`buildEncounterMarkdown`), `DndApiEncounterPanel`, `encounter-logic.ts`, `generate_encounter` | **Kein CR/XP-Budget-Rechner**, keine Schwierigkeits-Mathematik/Terrain/Taktik-UI; erzeugt Markdown-Seiten, keine strukturierten Objekte. |
| 8 | NPC Generator | 🔶 | NPC-Template, Preset „NPC Schnell“, Kontext-Aktionen (`fill_missing`/`dm_notes`/`extract_brain_facts`) | **Kein** dedizierter `generate_npc`-Workflow mit strukturierter Ausgabe (Stimme/Beziehung/Plot-Nutzen). |
| 9 | Quest Builder | 🔶 | `PageType.quest` + Template, Quest-Kontext-Aktionen | **Keine** Quest-Builder-UI (Auftraggeber-Picker, strukturierte Twist/Failure-Felder), kein `generate_quest`. |
| 10 | Magic Item Builder | 🔶 | `PageType.item`; `searchDnd5eSrd("equipment")` existiert, aber **nicht** in der Such-UI | **Schwach.** Kein Item-Template, kein Item-Generator, kein SRD-Equipment-Import-UI. |
| 11 | Prepare Next Session | 🔶 | KI-Aktion `prepare_next_session`/`next_session_prep`, `prepare-session.ts` (heuristischer Outline-Builder), Review-pflichtig | Deterministische Heuristik statt echter Kampagnen-Analyse; keine dedizierte Route; `world-inspector` speist Prep nicht. |
| 12 | „Was ist offen?“ | 🔶 | `GameSession.openPlots`, `world-overview.ts`, Dashboard `open-plots`, Portal-Recaps | Kein vereinheitlichter View für vergessene NPCs/ungelöste Rätsel/Foreshadowing; `openPlots` ist Freitext. |
| 13 | Kanon-Konfliktprüfung | 🔶 | `canon-rules.ts` (Terra-spezifisch + Duplikate), `canon_check`-Job→`world-inspector`, `BrainFactType.canon` | Keine „NPC ist tot“/Timeline-Checks; Regeln nicht welt-generisch; KI-abhängig. |
| 14 | Broken Link Scanner | ✅ | `world-inspector.ts` (`broken_wiki_link`/`orphan_page`/`duplicate_name`/`hidden_link_in_portal_page`) + Fix-Aktionen, `canon_check`-Job | „Unused NPC“ nur als `orphan_page` (info). Kern erfüllt. |
| 15 | Faction Simulator | ⬜ | Fraktionen existieren als `PageType.faction` + Graph | **Echtes Neubau-Thema**: kein Fraktions-State, keine Zwischen-Session-Logik, keine UI. |
| 16 | World Clock | ⬜ | `packages/calendar` ist **real-world**; `ContentBlockType.timeline` unstrukturiert | **Echtes Neubau-Thema**: keine In-Game-Zeit/Regionalkalender/„Welt-Uhr vorstellen“. |
| 17 | Print Center | 🔶 | `Label`/`LabelTemplate`/`PrintList`, `label-service.ts` (6×4"), PDF/HTML-Export, RTX/CUPS-Print, Session→Printliste | „Verträge“ in Daily-Admin (`/contracts`), nicht im Print-Center; keine benannten NPC-/Item-Karten-Templates. |
| 18 | Statblock Studio | 🔶 | `ContentBlockType.statblock`, Open5e→Markdown-Import (`statblock-format.ts`), Label kann Statblock-Text | **Kein strukturierter Statblock-Editor**; Export **nur Markdown** (kein Homebrewery/5e.tools/JSON); kein 1-Klick „Statblock→6×4-Label“. |

### Details & kritische Fragen — DnD

- **#3 Kanon-Status vs. `publishStatus` vereinheitlichen.** Aktuell existieren parallel
  `canonicalStatus`, `publishStatus`, `DungeonPrepStatus`, `GameSessionStatus`. Die Idee
  (idea→draft→prepared→played→canon→discarded) **überlappt** damit. **Frage/Empfehlung:** lieber
  `canonicalStatus` um `prepared`/`played`/`discarded` erweitern und das Verhältnis zu
  `publishStatus` klar dokumentieren, statt ein 5. Status-Feld einzuführen.
- **#7/#8/#9/#10 Generatoren — gemeinsames Muster.** NPC/Quest/Item/Encounter-Builder sind
  dasselbe Pattern: **strukturierte Eingabe → KI-Vorschlag → Review → Seite/Block**. Lieber **ein**
  generischer „strukturierter Generator“ (Feld-Schema je Typ) als vier Sonderlocken. Reuse
  `generator-service.ts` + Proposal/Review.
- **#15 Faction-Simulator — Simulation vs. KI-Vorschlag.** Eine deterministische Simulation ist
  schwer balancierbar und intransparent. **Empfehlung:** „Fraktionen bewegen sich“ als
  **KI-Proposal** umsetzen (zwischen Sessions: Vorschlag „Fraktion X tut Y, weil Z“) → Review →
  optional als Seite/Plot übernehmen. Braucht ein leichtes Fraktions-State-Feld (Ziele, Ressourcen,
  Beziehungen), aber **kein Auto-Kanon**. Niemals Cloud-KI mit Weltdaten.
- **#16 World-Clock — Scope.** Eigenes Welt-Kalender-Modell (Monatsnamen, Jahreslänge, Feiertage,
  aktuelle In-Game-Zeit) ist machbar, aber **wie tief**? Empfehlung: Minimal-Modell (aktuelles
  In-Game-Datum + frei definierbare Monate) auf Welt-Ebene; Verknüpfung zu Sessions/Events optional.
- **#18 Statblock-Exports — Lizenz beachten.** Homebrewery/5e.tools-Export ist wertvoll; SRD/Open5e
  brauchen **Attribution** (siehe `DND_API_INTEGRATION.md`). Strukturierter Statblock (JSON im
  Block) als Basis, daraus Renderer für Markdown/Homebrewery/Label.

---

## 5. Bereich 4 — Andere UWE-Features (12 Ideen: 1 ✅ · 10 🔶 · 1 ⬜)

| # | Idee | Status | Bestehende Basis | Lücke / Empfehlung |
|---|------|:--:|------------------|--------------------|
| 1 | Miniaturen-Datenbank | 🔶 | `WorkshopProject` (`projectType: miniature`, `WorkshopStatus`), `WorkshopPaintRecipe`, `/workshop` | **Kein Sammlungs-Modell** (Hersteller/System/Fraktion/Menge, Status gekauft/gebaut/grundiert/bemalt). Projekt ≠ Sammlung. |
| 2 | Fotovergleich | 🔶 | `WorkshopProject.referenceImages`/`progressPhotos`/`resultPhotos`/`imageGallery` (Json), Grid-Anzeige | **Kein** Vorher/Nachher-UI (Slider/Side-by-side), keine Fortschritts-Timeline. |
| 3 | Inbox / Raw Capture | ✅ | `CaptureEntry` (+Typen quick_note/dnd_idea/link/file_image/...), `/capture`, Upload-API | **Kein `voice_memo`**/Audio-Capture-Typ in der UI. Sonst Kern erfüllt. |
| 4 | KI-Sortierung | 🔶 | `capture-triage-service.ts` (`buildCaptureAiProposal`, Ziele project/workshop/dnd/hardware/contract/life_brain) | **Nur Heuristik (`source: "heuristic"`), kein LLM**; keine Kategorien Musik/Haushalt. |
| 5 | Globale Suche 2.0 | 🔶 | `search-service.ts` (`searchGlobalForDm`, 14 Entity-Filter, cross-world für Wiki), `/search`; Life-Brain-Suche separat | **Indiziert kein Daily-Admin** (Capture/Projects/Workshop/Contracts/Hardware/Media/Life-Brain); keine semantische Suche. |
| 6 | Tag-System | 🔶 | `tag-service.ts` (Inventar/Merge/Suggest), `/admin/tags`; Tags als **Json-Arrays pro Entität** (kein `Tag`-Modell) | Nicht über alle Domänen vereinheitlicht (keine Tags auf Capture/Project/Workshop/Contract/Hardware/Idea). |
| 7 | Projekt-Dashboards | 🔶 | `PersonalProject` (Kategorien uwe/hardware/dnd/art/printing/other), `/projects` (flache Liste), `/today`, Welt-Dashboard | Keine **pro-Domäne**-Dashboards (Musik/Haushalt fehlen als Kategorie); kein `/projects/[id]`-Detail. |
| 8 | Dokumentengenerator | 🔶 | Seiten-Templates, DnD-Generator (`generate_handout`), Mail-Templates, Label-Templates | **Kein generischer** Dokumentengenerator (Verträge/Guides/Checklisten außerhalb DnD/Mail/Label). |
| 9 | Prompt-Bibliothek | 🔶 | `DevIdea.generatedPrompt`/`/ideas`, `GeneratorPreset` (DnD), `admin/ai-prompt`→`/ai` | **Keine** In-App-CRUD-Bibliothek für Cursor/Orchestrator/Subagent-Prompts (liegen als Markdown in `docs/`/`.cursor/`). |
| 10 | Feature Registry (Ideenmgmt) | 🔶 | `DevIdea` (`status: in_planning/implemented/rejected`), `dev-idea-service.ts`, `/ideas` | **Kein** existing/planned/broken/deprecated-Lebenszyklus, kein Feature-vs-Bug-Typ, keine Modul-/Reifegrad-Felder. |
| 11 | Bug Center | ⬜ | nur Tangente: Capture-Keyword „bug“→project | **Echtes Neubau-Thema**: kein `BugReport`-Modell, kein UI-Report-Flow, kein Screenshot-Attach/Status. |
| 12 | Testworld | 🔶 | `seed.ts`→Terra; `stress-seed.ts`→`perf-test` (opt-in via `db:seed:stress`) | Kein erstklassiges „Sandbox“-Konzept/Flag; `perf-test` ist Performance-fokussiert. |

### Details & kritische Fragen — Andere

- **#6 Zentrales Tag-Modell ist der größte Hebel.** Heute sind Tags Json-Arrays pro Entität;
  `tag-service` merged nur einige. Ein **`Tag`-Modell + Join-Tabelle** würde Tag-System,
  **Globale Suche 2.0**, Miniaturen-Filter, Idea/Bug-Kategorisierung und Projekt-Dashboards
  zugleich aufwerten. **Empfehlung: zuerst dieses Fundament.** Migration der bestehenden
  Json-Tags nötig (rückwärtskompatibel planen).
- **#4 KI-Sortierung — heuristisch vs. LLM.** Die „KI“-Sortierung ist real-rule-based. Echtes
  LLM-Routing ist möglich, aber: Captures sind **persönliche Daten** → nur **lokale RTX**, nie
  Cloud (`local-first-privacy`-Skill). **Frage:** Kategorien „Musik/Haushalt“ neu einführen
  (`PersonalProjectCategory` erweitern)? Sollen die überhaupt ins Produkt?
- **#9/#10 Prompt-Bibliothek & Feature-Registry — reuse `DevIdea`/Agent-Jobs.** Statt neuer
  Systeme: `DevIdea` um `type`(feature/bug/prompt) + Lifecycle-Status erweitern; Prompt-Bibliothek
  als eigener `DevIdea`-Typ oder kleines `PromptTemplate`-Modell. Frage: soll die Registry
  **automatisch** aus `FEATURE_MATURITY_MATRIX.md` gespeist werden?
- **#11 Bug-Center** ist ein klarer, eigenständiger Neubau (Modell + Report-Form + Screenshot-
  Upload via `packages/assets` + Status). Synergie mit #10 (gemeinsames Intake).
- **#12 Testworld — fast geschenkt.** `createWorld()` existiert; es fehlt ein **`isSandbox`-Flag**
  (von Backup/Export/Portal ausgenommen) + 1-Klick „Demo-Welt klonen“.
- **#1/#2 Workshop ausbauen, nicht ersetzen.** Miniaturen-Sammlung als **eigenes Modell** neben
  `WorkshopProject` (1 Projekt kann mehrere Minis bemalen); Fotovergleich als UI auf bestehende
  Photo-Json-Felder + `packages/assets`.

---

## 6. Querschnitts-Fundamente (zuerst, weil sie viele Ideen entsperren)

Diese vier Investitionen sind **keine** Einzelfeatures, sondern Hebel:

| Fundament | Entsperrt u. a. | Skizze |
|-----------|-----------------|--------|
| **F1 — Zentrales Tag-Modell** | Tag-System (4.6), Globale Suche 2.0 (4.5), Miniaturen-Filter (4.1), Feature/Bug-Tagging (4.10/4.11), Projekt-Dashboards (4.7) | `Tag` + `EntityTag`-Join; `tag-service` migrieren; Json-Tags rückwärtskompatibel. |
| **F2 — Einheitlicher Verlauf/Audit-Browser** | Owner-Cockpit (1.1), Audit-Log (1.3), Kosten-Dashboard (1.16), Moderation (1.13) | `ActivityLog`+`AuditLog`+`AiUsageLog` in einer filterbaren View bündeln (read-only). |
| **F3 — Strukturierter Generator + Proposal/Review als Standard** | NPC/Quest/Item/Encounter (3.7–3.10), Faction-Sim (3.15), KI-Sortierung (4.4), Doc-Generator (4.8) | Feld-Schema je Typ über `generator-service.ts`; alle KI-Ausgaben → Review. |
| **F4 — Player-safe „angekündigte Session“ + Cross-domain Suchindex** | Mobile Portal (2.1), Player-Dashboard (2.11), Globale Suche 2.0 (4.5) | `playerVisibleSchedule`-Flag (behebt `nextSession`-Bug); Suchindex auf Daily-Admin erweitern. |

---

## 7. Empfohlene Roadmap (Wellen)

Sequenzierung nach **Wert/Risiko**, kompatibel zum bestehenden „Wave“-Vorgehen. Aufwand wird
**technisch** beschrieben (welche Layer), nicht in Zeit.

> Layer-Kürzel: **DB** = Prisma-Modell+Migration · **SVC** = Package-Service · **STU** = Studio-UI ·
> **POR** = Portal-UI · **AI** = ai-brain · **MID** = Middleware/Auth.

### Welle A — „Sichtbar machen“ / Quick Wins (hoher Wert, geringes Risiko)

Bereits ~80 % fertige Bausteine zu Ende verdrahten. Wenig/keine Migration.

| Item | Idee(n) | Layer | Risiko |
|------|---------|-------|--------|
| Portal-Graph-Seite (API+Komponente existieren) | 2.9 | POR | niedrig |
| Mobile Bottom-Nav verdrahten + „Wiki“-404 fixen | 2.1 | POR | niedrig |
| `nextSession`-Bug: player-safe angekündigte Session | 2.11, 2.1 | DB(klein), SVC, POR | niedrig–mittel |
| Dedizierte NPC-Listen-Route (Filter aus vorhandener Logik) | 2.7 | POR | niedrig |
| Einheitlicher Verlauf-Browser (F2, read-only) | 1.1, 1.3 | STU, SVC | niedrig |
| Statblock→6×4-Label 1-Klick | 3.18, 3.17 | STU, SVC | niedrig |
| Testworld-Flag `isSandbox` + „Demo klonen“ | 4.12 | DB(klein), SVC, STU | niedrig |
| Capture Voice-Memo-Typ (Audio bereits in assets erlaubt) | 4.3 | DB(klein), STU | niedrig |
| „Was ist neu“ aus `CHANGELOG.md` (geparst) | 1.14 | STU, SVC | niedrig |
| World-Templates aus vorhandenem Seed (DnD/Wiki/Roman) | 1.12 | SVC, STU | mittel |

### Welle B — Fundamente (entsperrt viele Folge-Features)

| Item | Idee(n) | Layer | Risiko |
|------|---------|-------|--------|
| **F1 Zentrales Tag-Modell** + Migration | 4.6, 4.5, 4.1 | DB, SVC, STU | mittel |
| Cross-domain Suchindex (Daily-Admin in `search-service`) | 4.5 | SVC, STU | mittel |
| Kanon-Lifecycle vereinheitlichen (`canonicalStatus` erweitern) | 3.3 | DB, SVC, STU | mittel |
| Typisierte `PageLink`-Editor-UI + `relationType`-Presets | 3.2, 2.9 | SVC, STU | mittel |
| Owner-Cockpit-Aggregation + Kosten-Rollups (nutzt F2) | 1.1, 1.16 | STU, SVC | mittel |
| Owner-Notfallmodus (Settings-Flag + Middleware + Bypass) | 1.15 | DB(klein), MID, STU | mittel (Sicherheit!) |

### Welle C — Strukturierte DnD- & Spieler-Tools (mittlerer Aufwand)

| Item | Idee(n) | Layer | Risiko |
|------|---------|-------|--------|
| **F3 Strukturierter Generator** (NPC/Quest/Item/Encounter) | 3.7–3.10 | AI, SVC, STU | mittel |
| Encounter-Builder CR/XP-Budget-Rechner | 3.7 | SVC, STU | mittel |
| Questlog: Status-Feld + Route + Suchfilter | 2.4, 3.9 | DB(klein), SVC, POR/STU | mittel |
| Charaktersheet als strukturierter Block (reuse statblock) | 2.2 | DB, SVC, POR | mittel–hoch |
| Statblock Studio: strukturiertes JSON + Exporte | 3.18 | DB, SVC, STU | mittel |
| Party-Inventar/Gruppenbesitz | 2.10 | DB, SVC, POR/STU | mittel |
| Spieler-Timeline (spoiler-frei) | 2.8 | DB(klein), SVC, POR | mittel |
| „Was ist offen?“ vereinheitlichter View | 3.12, 3.11 | SVC, STU | mittel |

### Welle D — Ambitioniert / Risiko / Klärungsbedarf (zuletzt)

| Item | Idee(n) | Layer | Risiko / Frage |
|------|---------|-------|----------------|
| Faction-Simulator als KI-Proposal | 3.15 | DB, AI, SVC, STU | hoch — Qualität/Determinismus |
| NL Admin Command Center (eingeschränkt + Bestätigung) | 1.18 | AI, SVC, STU | hoch — Sicherheit |
| World-Clock (In-Game-Zeit/Regionalkalender) | 3.16 | DB, SVC, STU | mittel–hoch — Scope |
| KI-Sortierung via lokale RTX (LLM statt Heuristik) | 4.4 | AI, SVC | mittel — Privacy (RTX-only) |
| Import-Zentrale (PDF/Obsidian/Multi-Ziel) | 1.7 | SVC, STU | mittel–hoch |
| Migration-Inspector-UI | 1.10 | SVC, STU | mittel |
| Secrets-Status-Seite (kein voller Vault) | 1.6 | SVC, STU | niedrig–mittel (s. Frage) |
| Dokumentengenerator (generisch) | 4.8 | SVC, STU | mittel |
| Prompt-Bibliothek + Feature-Registry (reuse `DevIdea`) | 4.9, 4.10 | DB, SVC, STU | mittel |
| Bug-Center (Modell + Report + Screenshot) | 4.11 | DB, SVC, STU | mittel |
| Miniaturen-Sammlung + Fotovergleich-UI | 4.1, 4.2 | DB, SVC, STU | mittel |
| Projekt-Dashboards (inkl. neue Kategorien?) | 4.7 | DB(klein), SVC, STU | mittel — Frage |

---

## 8. Kritische Fragen an dich (Entscheidungsbedarf vor Umsetzung)

Bitte beantworte diese, bevor wir Wellen B–D konkretisieren:

1. **Secrets-Vault (1.6):** Voller Vault ist wegen des Henne-Ei-Problems heikel. OK mit
   **read-only Secret-Status-Seite** statt Klartext-Vault?
2. **NL Command Center (1.18):** Einverstanden mit **eingeschränkter Grammatik + Bestätigungs-
   dialog + Audit** statt freiem LLM-Tool-Calling?
3. **Kosten-Dashboard (1.16):** AI-Kosten **getrennt** von Life-Admin-`Verträgen` (eigenes
   Admin-Dashboard), oder bewusst in `/contracts` integrieren?
4. **Kanon-Status (3.3):** `canonicalStatus` **erweitern** (prepared/played/discarded) statt 5.
   Status-Feld — und Verhältnis zu `publishStatus` festschreiben?
5. **Charaktersheet (2.2):** Voll-5e-Sheet (Regelpflege, 2014/2024) **oder** strukturierter
   Sheet-Block? Editierbar durch Spieler?
6. **Faction-Simulator (3.15):** Als **KI-Vorschlag** (Review, kein Auto-Kanon) — einverstanden?
   Wie viel Fraktions-State (Ziele/Ressourcen/Beziehungen) willst du pflegen?
7. **World-Clock (3.16):** Minimal (aktuelles In-Game-Datum + freie Monate) oder volles
   Regionalkalender-System?
8. **Inventar (2.10):** Start mit **Gruppen-Inventar**? Währung modellieren?
9. **KI-Sortierung (4.4):** Neue Kategorien **Musik/Haushalt** gewünscht? (RTX-only bleibt Pflicht.)
10. **Globale Suche 2.0 (4.5):** Reicht **lexikalische** cross-domain Suche, oder ist
    **semantisch/Embedding** ein Muss? (Embeddings = RTX-only, größere Investition.)
11. **Tag-Modell (F1/4.6):** Migration der Json-Tags auf ein zentrales `Tag`-Modell freigegeben?
12. **Mobile Portal (2.1):** Bottom-Nav statt Drawer als Standard gewünscht?
13. **Priorisierung:** Stimmt die Wellen-Reihenfolge (A Quick Wins → B Fundamente → C Tools →
    D Ambitioniert), oder gibt es „Pull“-Themen, die du sofort willst?

---

## 9. Was bewusst NICHT empfohlen wird

- **Parallele Systeme** zu `DevIdea`/Agent-Jobs/`tag-service`/`generator-service` — lieber
  erweitern (Scope-Disziplin laut `AGENTS.md`).
- **Cloud-KI mit Welt-/Brain-/Life-Kontext** für irgendeine der Ideen — verstößt gegen die
  nicht-verhandelbare Datenschutzregel.
- **Auto-Kanonisierung** von KI-Ausgaben (Faction-Sim, Generatoren, Sortierung) — immer
  Proposal→Review.
- **Voller generischer Secret-Store** in der DB (siehe Frage 1).
- **Zeitliche Schätzungen** — Aufwand wird hier technisch (Layer/Invasivität/Abhängigkeiten)
  beschrieben.

---

## 10. Nächster Schritt

Nach deinen Antworten auf §8 überführe ich die beschlossenen Punkte als konkrete, abhakbare
Einträge in [ROADMAP.md](ROADMAP.md) (eine Quelle der Wahrheit) und schneide pro Welle-A-Item
einen kleinen, testbaren Umsetzungs-PR. **Bis dahin wird nichts am Produktcode geändert.**
