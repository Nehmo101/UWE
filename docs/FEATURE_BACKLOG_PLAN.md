# UWE Feature-Backlog — Umsetzungsplan & Status-Audit

Stand: 2026-07-01 · Eingabe: großer Ideen-Backlog (59 Ideen in 4 Bereichen)

> **Zweck dieses Dokuments.** Planungs- und Audit-Dokument: mappt Ideen auf den **realen
> Code-Stand** (vorhanden / teilweise / fehlt) und priorisiert Wellen A→D. **Umsetzung läuft**
> über Orchestrator-Batches (Waves A–D, Rest-Batches 1–5); bei Abweichungen gilt der Code +
> [FEATURE_MATURITY_MATRIX.md](FEATURE_MATURITY_MATRIX.md) als Wahrheit.

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
| 10 | Migration Inspector | 🔶 | `migration-status.ts`, `/admin/migrations`, Checklist-Link | Dedizierte **read-only** Inspector-UI mit angewendeter Liste + Fehler-Metadaten (Batch 5). Kein In-App-Repair. |
| 11 | User Management | ✅ | `/admin/users` + `UserManagementWorkspace`, `user-service.ts` (create/invite/disable/role/reset), `WorldMembership` | Invite-Mail hängt an Mail-Config. Kern erfüllt. |
| 12 | World Templates | ✅ Beta | `world-templates.ts`, `CreateWorldForm`, DnD/Wiki/Roman/Wargame + Kalender-Seed | Archetypen bei Welterstellung in Studio + Portal; blank/dnd/wiki/roman/wargame. |
| 13 | Content Moderation / Freigabe | ✅ | `ContentReview` + `/admin/reviews`, `review-service.ts`, `AiProposal`/`ai-review-service.ts` (kein Auto-Apply) | Review-zentriert; nicht jeder KI-Pfad erzeugt zwingend Review. Kern erfüllt. |
| 14 | System-Changelog | 🔶 | `/system/version` (Build-Info), `/system/uwe-knowhow` (durchsucht `CHANGELOG.md`/docs) | Kein **„Was ist neu“** nach Update (geparste Release-Notes/Modal). |
| 15 | Owner Notfallmodus | ✅ Beta | `maintenanceMode`/`lockPortal`/`lockStudio`, Middleware + Owner-Bypass, Settings-UI | Shipped: Gate in Middleware + Layout, `/api/maintenance/evaluate`, NL-Command. |
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
| 4 | Questlog | 🔶 | `PageType.quest`, `QuestLifecycleStatus`, `/auth/worlds/[slug]/quests`, `QuestStatusEditPanel` | **Global-Suche-Filter `quests`** fehlt noch in älteren Docs — **seit Batch 5 im Code**. Portal-Detail zeigt Quest-Status-Badge. |
| 5 | Handout-Bereich | ✅ | `PageType.handout` + Template, `Asset`(image/map/handout/document), Portal `/assets`, `ShareLink`, `generate_handout` | Handouts auf Assets **und** Wiki-Seiten verteilt; kein typisierter Unterbereich (Rätsel/Briefe). Kern erfüllt. |
| 6 | Spielernotizen | ✅ | `PlayerNote` (private/dm_only/party + status-Workflow), `/auth/.../notes`, DM-Review in Studio, Backup opt-in | Kein Realtime-Collab (Formular-CRUD). Kern erfüllt. |
| 7 | NPC-Liste für Spieler | 🔶 | `PageType.npc`, `filterPagesForViewer`/`gm_note`-Schutz, `PagePlayerAccess`/`SessionUnlock`, Dashboard `knownNpcs`, Suchfilter `npcs` | **Keine dedizierte NPC-Listen-Route**; `player_character`+`monster` im selben Widget gemischt. |
| 8 | Timeline (Spielersicht) | ✅ Beta | `PortalStoryTimeline`, `/auth/worlds/[slug]/timeline`, Jahres-Story-Layout | Story-Timeline mit Jahresgruppen, Kampagnen-„Jetzt“-Marker, Entitäts-Chronik. |
| 9 | Beziehungsnetz | ✅ | `graph-service.ts`, Portal `/auth/worlds/[slug]/graph`, `PortalGraphView`, `portal-nav` | Optional: Graph in Mobile-Bottom-Nav. Kern erfüllt (Welle A). |
| 10 | Inventar / Gruppenbesitz | ⬜ | verwandt: `PageType.loot` (Dungeon), `PageType.item` (Handouts) | **Echtes Neubau-Thema**: kein Inventar/Party-Treasury-Modell (Geld/Items/Artefakte). |
| 11 | Spieler-Dashboard vor Session | 🔶 | `portal-dashboard-service`, `playerVisibleSchedule`, Session-Edit-Checkbox | **`nextSession` sichtbar wenn DM Termin ankündigt** (opt-in). Batch 5: Studio-Hinweis wenn geplant aber nicht angekündigt. |

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
| 3 | Kanon-Status | 🔶 | `Page.canonicalStatus` inkl. prepared/played/discarded; Edit-UI, Suche & Seitenliste filterbar; „Was ist offen?“ nutzt Lifecycle | Deprecated/contradictory weiter als Spezialstatus. |
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
| 16 | World Clock | ✅ | `WorldCalendar`, `/worlds/[slug]/calendar`, `advanceInGameDate`, Terra-Seed | Kern: konfigurierbarer Kalender + aktuelles Datum + Vorlauf-Buttons. Feiertage optional später. |
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
| 5 | Globale Suche 2.0 | 🔶 | `search-service.ts`, `cross-domain-search-service.ts`, `/search` (Wiki + Daily Admin + Medien + EntityTag-Facetten) | Semantische Suche weiter offen (RTX-only, später). |
| 6 | Tag-System | 🔶 | `tag-service.ts` (EntityTag-Primärquelle + Json-Gap-Fallback), `/admin/tags`, Backfill/Merge Dual-Write | Json-Felder bleiben deprecated bis vollständiger Backfill. |
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
- **#4 KI-Sortierung — aus dem Backlog gestrichen (Owner-Entscheidung 2026-06-30).** Die heutige
  heuristische Triage (`capture-triage-service.ts`) bleibt unverändert; ein LLM-/Kategorien-Ausbau
  ist **nicht** geplant.
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
| **F3 — Strukturierter Generator + Proposal/Review als Standard** | NPC/Quest/Item/Encounter (3.7–3.10), Faction-Sim (3.15), Doc-Generator (4.8) | Feld-Schema je Typ über `generator-service.ts`; alle KI-Ausgaben → Review. |
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

> **Runde 1 beantwortet (2026-06-30).** Entschieden/vertieft in **§11**: Secrets (1),
> NL-Command-Center (2), Charaktersheet = **Voll 5e** (5), Faction-Sim = **KI-Vorschlag + Review,
> dateierte Events auf Entitätsseiten** (6), Globale Suche (10), Tag-Modell = **freigegeben** (11).
> **Noch offen (Runde 2):** 3, 4, 7, 8, 9, 12, 13 hier — plus neue Detailfragen in **§12**.

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
- **Auto-Kanonisierung** von KI-Ausgaben (Faction-Sim, Generatoren) — immer
  Proposal→Review.
- **Voller generischer Secret-Store** in der DB (siehe Frage 1).
- **Zeitliche Schätzungen** — Aufwand wird hier technisch (Layer/Invasivität/Abhängigkeiten)
  beschrieben.

---

## 10. Nächster Schritt

Nach deinen Antworten auf §8 überführe ich die beschlossenen Punkte als konkrete, abhakbare
Einträge in [ROADMAP.md](ROADMAP.md) (eine Quelle der Wahrheit) und schneide pro Welle-A-Item
einen kleinen, testbaren Umsetzungs-PR. **Bis dahin wird nichts am Produktcode geändert.**

---

## 11. Entscheidungen & vertiefte Designs (Runde 1)

Code-belegte Detailplanung zu den in Runde 1 beantworteten Punkten. **Weiterhin reine Planung —
keine Umsetzung.**

### 11.1 Secrets / API-Key Vault (Frage 1) — Empfehlung & bester Weg

**Ausgangslage (belegt):** `packages/database/src/token-crypto.ts` verschlüsselt mit AES-256-GCM;
der Schlüssel wird aus `SESSION_SECRET`/`AUTH_SECRET` **aus der ENV** abgeleitet
(`resolveTokenEncryptionSecret`). Provider-/Endpoint-Keys liegen bereits verschlüsselt
(`AiCloudProvider.apiKeyEnc`, `InferenceEndpoint.apiKeyEnc`, Spotify-Tokens).

**Henne-Ei-Kern:** Der Schlüssel, der DB-Secrets entschlüsselt, **darf nicht in der DB liegen**.
Ein „echter Vault“, der `AUTH_SECRET` selbst verwaltet, ist daher unmöglich/sinnlos.

**Empfehlung (3 Teile, „best case“ = max. Übersicht, min. neue Angriffsfläche):**

1. **Konsolidieren statt neu bauen:** Alle verbleibenden Keys (SMTP, RTX-Connector-Token,
   Cloudflare, CalDAV, Cloud-AI) konsequent über das **bestehende** `encryptSecret`/`decryptSecret`
   in DB-Spalten ablegen — als **write-only**-Felder (Frontend bekommt nie Klartext zurück, nur
   `gesetzt / letzte 4 Zeichen / aktualisiert am`).
2. **Read-only „Secrets-Status“-Seite** (`/admin/secrets` oder Tab in `/admin/setup`): listet jedes
   bekannte Secret mit **Quelle** (ENV vs. DB-verschlüsselt), **Status** (gesetzt/fehlt), maskiertem
   Last-4, Stand und — wo sinnvoll — einem **Test**-Button. Kein Klartext, kein Download.
   Das liefert genau das Idee-Ziel „Übersicht statt unübersichtliche ENV“ ohne Vault-Risiko.
3. **Bootstrap-Secrets bleiben ENV** (`AUTH_SECRET`, `SESSION_SECRET`, `STUDIO_API_TOKEN`,
   `DATABASE_URL`) — sie werden gebraucht, bevor DB/App nutzbar sind. Die Status-Seite spiegelt sie
   nur wider.

**Rotations-Warnung einbauen:** `AUTH_SECRET`-Rotation entwertet alle DB-verschlüsselten Secrets
(Spotify etc.). Die Status-Seite muss warnen und einen geführten „betroffene Secrets neu
eingeben“-Flow anbieten statt stiller Brüche.

**Layer/Aufwand:** SVC (Secret-Status-Service, ggf. Erweiterung `owner-setup-service`/settings) +
STU (read-only Seite); optional kleine DB-Migration, falls weitere Keys in verschlüsselte Spalten
wandern. **Niedrig–mittel.** → Verschiebt sich von Welle D nach **Welle A/B** (geringes Risiko).

### 11.2 NL Admin Command Center (Frage 2) — was genau gemeint ist

**Kein** frei agierender LLM-Agent mit DB-Schreibrechten. Stattdessen Pipeline
**„natürliche Sprache → strukturierter Intent → Bestätigung → Ausführung über bestehende Services“:**

1. **Eingabe:** Owner/Admin tippt z. B. „Mach Carina zur Spielerin in Terra und gib ihr
   Portalzugriff.“ (erweitertes Command-Palette-Feld oder `/admin/command`).
2. **Intent-Parsing (lokale RTX bevorzugt):** Das LLM darf **nur ein striktes JSON-Schema** aus
   einer **Whitelist bekannter Befehle** ausfüllen (z. B. `assign_world_role`, `invite_user`,
   `set_portal_access`, `disable_user`, `create_world`, `toggle_maintenance`). Output =
   `{intent, params, matchedEntities}`. Unbekannt/uneindeutig → „bitte präzisieren“ statt Raten.
   **Keine** Ausführungsrechte für das Modell.
3. **Resolver + Validierung (deterministisch, server-seitig):** Namen→IDs auflösen (Carina→welcher
   User? Terra→welche Welt?), `requireAdminAccess()` prüfen, Plausibilität. Mehrdeutigkeit
   (zwei „Carinas“) → Auswahldialog.
4. **Bestätigungs-Vorschau:** UI zeigt die **konkrete** Aktion im Klartext + Bestätigen/Abbrechen.
   **Nichts** wird ohne Klick ausgeführt.
5. **Ausführung** über **dieselben** geprüften Services wie die Formulare (`user-service.ts` …) —
   nicht über das LLM.
6. **Audit:** jeder ausgeführte Befehl → `AuditLog`.

**Warum so:** Prompt-Injection kann maximal ein Schema befüllen, nie echte Mutationen auslösen;
Rechte-Checks bleiben deterministisch; passt exakt zum bestehenden Proposal/Bestätigungs-Muster
(`AiRun`/`AiProposal`). **Privacy:** nur Owner/Admin, RTX bevorzugt; falls Cloud, dann nur die
Befehls-Grammatik, **keine Weltdaten**.

**Start-Scope:** kleine Befehls-Whitelist (User/Rolle/Welt/Portal/Maintenance), später erweitern.
**Layer/Aufwand:** AI (Intent-Schema) + SVC (Resolver/Executor-Bridge) + STU (Palette/Vorschau).
**Mittel; Risiko hoch → bewusst Welle D.**

### 11.3 Charaktersheet — **Voll 5e** (Frage 5)

Größtes Einzelthema. „Voll 5e“ heißt strukturierte Charakterdaten **mit Berechnungen**, nicht nur
Freitext-Blöcke.

**Datenmodell — Empfehlung: eigenes `Character`-Modell** (nicht nur `ContentBlock.metadata`), weil
Voll-5e Validierung/Rechnen braucht: Attribute, Skills, HP/AC/Speed, Klassen+Level, Spezies,
Hintergrund, Proficiencies, Zauber/Slots, Inventar, Features, Zustände, Währung. Die bestehende
`player_character`-**Page** bleibt als Wiki-/Portrait-/Lore-Hülle und wird mit dem `Character`
verknüpft. Das koppelt sauber an **Inventar (2.10)** (Charakter-Inventar + Party-Treasury).

**Berechnungen (Regeltabellen nötig):** Attribut-Modifikatoren, Proficiency-Bonus nach Level,
Save-DCs, Skill-Boni, Spell-Slots je Klasse/Level, passive Wahrnehmung, optional AC.

**UI:** editierbarer Sheet im **Portal** (Spieler) + **Studio** (DM-Override), Sektionen
(Werte/Kampf/Skills/Zauber/Inventar/Features/Bio), mobil-tauglich (koppelt an Mobile-Portal 2.1).
**Visibility:** Spieler editieren ihren eigenen Sheet (player-safe), DM sieht/justiert alles.

**Empfohlene Phasen (testbar):**
- **P1 Kern-Sheet:** Werte, Kampf, Skills, Inventar, Bio + Auto-Berechnungen.
- **P2 Zauber + Klassen-/Item-Katalog** (SRD/Open5e via vorhandenem `@uwe/dnd-api`).
- **P3 Level-Up-Assistent + Druck/Export (PDF/Label) + optional Würfel/Initiative.**

**Layer/Aufwand:** DB (neues Modell + Migration) + SVC (Regeln/Berechnung) + POR/STU (Sheet-UI).
**Hoch.** Wegen Größe in **Welle C** als eigener mehrteiliger Strang.

> **Offene Detailfragen → §12** (Regelversion 2014/2024, Homebrew, Datenquelle, Auto-Berechnung,
> Leveling, Editierrechte, Würfeln, mehrere Charaktere pro Spieler).

### 11.4 Faction-Simulator als KI-Vorschlag mit datierten Events (Frage 6)

Bestätigt: **KI-Vorschlag → Review → bei Annahme erscheinen die Ereignisse auf den konkreten Seiten
(Fraktion/NPC/Ort) „zu welchem Datum was passiert“.**

**Wichtige Konsequenz (Kopplung):** „zu welchem Datum“ erfordert eine **In-Game-Zeit** und ein
**Ereignis-Modell**. Damit hängen jetzt drei Ideen zusammen und müssen gemeinsam geplant werden:

- **3.16 World-Clock** liefert das In-Game-Datum (→ wird von „Welle D optional“ zu **Voraussetzung**).
- **neues `WorldEvent`/Chronik-Modell** trägt die datierten Ereignisse.
- **2.8 Spieler-Timeline** konsumiert dieselben Events (spoiler-gefiltert).

**Designskizze:**

1. **Fraktions-State (leichtgewichtig):** je Fraktions-Page strukturierte Felder
   (Ziele/Agenda, Ressourcen/Macht, Beziehungen) — als JSON-Block (`ContentBlock.metadata`) oder
   kleines `FactionState`-Modell. Start: minimal.
2. **Lauf (nur lokale RTX — Weltdaten!):** DM startet „Fraktionen weiterbewegen“ (optional über
   X In-Game-Tage / ausgewählte Fraktionen). Erzeugt einen **`AiProposal`** mit einer Liste von
   Ereignissen: betroffene Entitäten, Beschreibung (player-safe + DM-Teil), **In-Game-Datum**,
   Konsequenzen.
3. **Review:** je Ereignis annehmen/bearbeiten/verwerfen — **wiederverwendet**
   `AiProposal`/`ai-review-service`/`AiApplyLog` (inkl. Undo).
4. **Bei Annahme → `WorldEvent`** wird angelegt und an alle beteiligten Pages gehängt; rendert dort
   als datierte **„Chronik“** und speist Welt-/Spieler-Timeline und **„Was ist offen?“ (3.12)**.

**`WorldEvent`-Modell (Vorschlag):**
`WorldEvent { id, worldId, inGameDate (strukturiert, s. World-Clock), title, summaryPlayer,
summaryDm, visibility, secretLevel, sourceType (faction_sim|manual|session), sourceAiProposalId? }`
+ Join `WorldEventEntityLink { eventId, pageId, role }`. Portal-Ausspielung strikt
visibility-/secret-gefiltert (kein DM-Leak).

**Layer/Aufwand:** DB (`WorldEvent` + Join + In-Game-Datum) + AI (Sim-Prompt) + SVC + STU/POR.
**Hoch**, aber baut auf vorhandener Proposal/Review-Pipeline auf. **Reihenfolge:** erst World-Clock +
`WorldEvent` (Welle C), dann Faction-Sim obendrauf (Ende C / D).

> **Offene Detailfragen → §12** (In-Game-Datumsformat, Umfang Fraktions-State, Automatik-Grad,
> Ereignisse pro Lauf).

### 11.5 Globale Suche 2.0 (Frage 10) — lexikalisch vs. semantisch

**Heute (belegt):** `search-service.ts` ist **lexikalisch** (Keyword/Substring + Scoring über
title/slug/summary/tags/aliases/content), **seiten-zentriert** (`SearchResultItem.pageId`,
`type: PageType`), baut einen In-Memory-Index je Scope (`buildSearchIndexForScope`), cross-world für
Wiki-Seiten — **indiziert aber kein** Daily-Admin (Capture/Projects/Workshop/Contracts/Hardware),
keine allgemeinen Medien, kein Life-Brain (separat in `personal-brain-search.ts`).

**Zwei Dimensionen von „2.0“:**

- **(A) Breite / cross-domain (das eigentliche Anliegen):** mehr Entitätstypen in **eine** Suche
  („über alle Welten, Projekte, Medien, Notizen“). Braucht einen **generischen Ergebnistyp**
  (statt seiten-zentriert): `entityType + href + quellspezifische Felder`. **Privacy:**
  Life-Brain/persönliche Daten bleiben owner-only und dürfen **nie** in Welt-/Portal-Suche bluten;
  Portal-Suche strikt nur player-safe Weltinhalte. **Lexikalisch, moderater Aufwand.**
- **(B) Tiefe / semantisch (Embeddings):** „nach Bedeutung finden“. Erfordert Embeddings →
  **RTX-only** (local-first-privacy). Brain hat Embedding-Ansätze (`BrainChunk`, `embedding`-Job),
  **aber Life-Brain-Retrieval fehlt noch** (Matrix §10/Lab). **Größere Investition**
  (Embedding-Pipeline für alle Entitäten, Vektor-Storage, Reindex, RTX-Abhängigkeit).

**Empfehlung (phasiert):**
- **Phase 1 (jetzt): lexikalische cross-domain Suche** — `search-service` auf einen vereinheitlichten
  Index (Welten + Daily-Admin + Medien + owner-only Life-Brain) mit generischem Ergebnistyp und
  strikter Privacy-Skopierung. Liefert ~90 % des gefühlten Werts ohne RTX-Abhängigkeit.
- **Phase 2 (optional, später): semantische Suche** nur über lokale RTX, baut auf der dann ohnehin
  nötigen Brain-Embedding-Infrastruktur auf und schließt zugleich die Life-Brain-Retrieval-Lücke.

→ **Frage zur Bestätigung in §12:** Phase-1-lexikalisch als erster Schritt ok, semantisch später?

### 11.6 Zentrales Tag-Modell (Frage 11) — freigegeben, Migrationsplan

**Heute (belegt):** Tags sind **Json-Arrays** auf 5 Entitäten (page, asset, soundboard_button,
personal_brain_document, personal_brain_fact); `tag-service.ts` bietet `normalizeTagKey`/
`canonicalizeTag`/`collectTagInventory`/`mergeTags`. **Kein `Tag`-Table.**

**Zielmodell:**
`Tag { id, key (normalisiert, unique), label (Anzeige), color?, description? }` +
`EntityTag { id, tagId, entityType, entityId, worldId?, @@unique([tagId, entityType, entityId]) }`.

**Migration (additiv, idempotent, rückwärtskompatibel):**
1. `Tag` + `EntityTag` als **additive** Migration (kein Datenverlust).
2. **Backfill-Skript:** alle vorhandenen Json-`tags` lesen → `Tag` per normalisiertem Key upserten →
   `EntityTag`-Zeilen anlegen. **Wiederverwendet `normalizeTagKey`/`canonicalizeTag`**, damit die
   Merge-Semantik erhalten bleibt.
3. **Dual-Write-Übergang:** Json-`tags` kurz parallel mitschreiben (eine Release), dann Lese-Pfad auf
   `EntityTag` umstellen und Json als deprecated/derived behandeln.
4. **Abdeckung erweitern** auf die gewünschten Entitäten (Capture/Project/Workshop/Contract/Hardware/
   DevIdea) — nur via `EntityTag`, kein neues Json-Feld nötig.
5. `tag-service` (`collectInventory`/`merge`/`suggest`) auf `EntityTag` neu aufsetzen (eine Quelle).

**Entsperrt:** Tag-System (4.6), cross-domain Such-Facetten (4.5), Miniaturen-/Ideen-/Bug-Filter,
Tag-Dashboards. **Risiko:** Datenmigration (durch additiv + Backfill + Dual-Write gemildert).
**Layer/Aufwand:** DB + SVC + STU. **Welle B (Fundament F1).**

### 11.7 Re-Sequenzierung nach Runde 1

| Item | Vorher | Jetzt | Grund |
|------|--------|-------|-------|
| World-Clock (3.16) + neues `WorldEvent`-Modell | Welle D (optional) | **Welle C (Voraussetzung)** | Faction-Sim braucht In-Game-Datum + Events |
| Spieler-Timeline (2.8) | Welle C | **Welle C (an `WorldEvent` gekoppelt)** | konsumiert dieselben Events |
| Faction-Sim (3.15) | Welle D | **Ende C / D, nach World-Clock+Events** | baut darauf auf |
| Secrets-Status-Seite (1.6) | Welle D | **Welle A/B** | geringes Risiko, hoher Überblicksnutzen |
| Voll-5e-Sheet (2.2) | — | **Welle C, mehrteilig (P1–P3)** | groß; zieht Inventar (2.10) mit |
| Tag-Modell (F1) | Welle B | **Welle B (bestätigt, zuerst)** | entsperrt Suche/Filter |

---

## 12. Offene Fragen (Runde 2)

> **Runde 2 beantwortet (2026-06-30).** Alle Beschlüsse konsolidiert in **§13**; der
> Umsetzungs-Orchestrator liegt in [prompts/feature-backlog-orchestrator.md](prompts/feature-backlog-orchestrator.md).

**Charaktersheet „Voll 5e“ (2.2):**
1. **Regelversion:** 2014 (PHB) oder 2024er Regeln — oder pro Welt wählbar?
2. **Homebrew:** eigene Klassen/Spezies/Items/Zauber nötig, oder reicht SRD/Open5e-Umfang?
   (Nicht-SRD-Inhalte dürfen rechtlich nicht mitgeliefert werden — du gibst sie selbst ein.)
3. **Auto-Berechnung** (Modifikatoren/Slots/Proficiency) oder nur speichern, was eingetragen wird?
4. **Leveling:** Level-Up-Assistent oder manuell?
5. **Editierrechte:** Spieler vollständig auf eigenem Sheet? DM alles? „Sheet-Lock“ in Session?
6. **Würfeln/Initiative-Tracker** im Scope (v1) oder reine Verwaltung?
7. **Mehrere Charaktere** pro Spieler / pro Kampagne?

**Faction-Sim + World-Clock (3.15/3.16):**
8. **In-Game-Datumsformat:** an Realkalender angelehnt, oder eigener Welt-Kalender (Monatsnamen,
   Jahreslänge)? Wie tief soll die World-Clock minimal sein?
9. **Fraktions-State:** minimal (Freitext-Agenda) oder strukturiert (Ziele/Ressourcen/Beziehungen)?
10. **Automatik-Grad:** nur auf Knopfdruck, oder automatisch bei Recap-Publish / Zeitsprung?
11. **Umfang pro Lauf:** 1 Ereignis pro Fraktion oder mehrere (begrenzbar)?

**Globale Suche (4.5):**
12. Phase-1 **lexikalische** cross-domain Suche zuerst, **semantisch** (RTX-only) später — ok?

**Aus Runde 1 noch offen (§8):**
13. Kosten-Dashboard (1.16): AI-Kosten **getrennt** von `/contracts` (eigenes Admin-Dashboard)?
14. Kanon-Status (3.3): `canonicalStatus` **erweitern** statt 5. Status-Feld?
15. Inventar (2.10): Start mit **Gruppen-Inventar**? Währung modellieren? (koppelt an Voll-5e-Sheet)
16. KI-Sortierung (4.4): Kategorien **Musik/Haushalt** gewünscht? (RTX-only Pflicht.)
17. Mobile-Portal (2.1): Bottom-Nav statt Drawer als Standard?
18. **Priorisierung:** Reihenfolge A→B→C→D ok, oder „Pull“-Themen sofort?

---

## 13. Beschlossen (final, Runde 1 + 2)

Alle Entscheidungen gesperrt — Subagenten verhandeln sie **nicht** neu. Umsetzung erfolgt über
den Orchestrator-Prompt: [prompts/feature-backlog-orchestrator.md](prompts/feature-backlog-orchestrator.md).

| Thema | Beschluss |
|-------|-----------|
| Secrets (1.6) | **Kein Vault.** Read-only Secrets-Status-Seite + verschlüsselte DB-Felder (`token-crypto.ts`); Bootstrap-Secrets bleiben ENV; Rotations-Warnung. |
| NL-Command-Center (1.18) | Befehls-Whitelist → strukturierter Intent → **Klartext-Bestätigung** → Ausführung über bestehende Services → Audit. Kein freies LLM-Tool-Calling. |
| Charaktersheet (2.2) | **Voll 5e**, Regeln **2024**, **Homebrew** unterstützt, **Auto-Berechnung**, **Level-Up-Assistent**, **Initiative-Wert anzeigen** (kein Würfel-/Initiative-Tracker), **mehrere Charaktere pro Spieler**. Eigenes `Character`-Modell. |
| Faction-Sim (3.15) | KI-Vorschlag → Review → **datierte `WorldEvent`s** auf Entitätsseiten. **Nur per Knopf.** **Strukturierter** Fraktions-State. Nur lokale RTX. |
| World-Clock (3.16) | Eigener, **pro Welt konfigurierbarer** Kalender (Monate/Jahr, Tage/Monat, Monatsnamen, aktuelles In-Game-Datum). Voraussetzung für Faction-Sim + Timeline. |
| Globale Suche (4.5) | **Nur lexikalisch**, cross-domain. Kein Embedding/Semantik in diesem Backlog. |
| Kosten-Dashboard (1.16) | **In `/contracts` integrieren** (kein separates Admin-Dashboard). |
| Kanon-Status (3.3) | Bestehenden `canonicalStatus` **erweitern** (prepared/played/discarded). |
| Inventar (2.10) | **Gruppen-Treasury + Währung** (koppelt an Character-Sheet). |
| KI-Sortierung (4.4) | **Aus dem Backlog gestrichen** (Owner-Entscheidung 2026-06-30) — kein Kategorien-/LLM-Ausbau. |
| Mobile-Portal (2.1) | **Bottom-Nav** als Standard. |
| Tag-Modell (4.6/F1) | Zentrales `Tag` + `EntityTag`, additive Migration + Backfill + Dual-Write. |
| Reihenfolge | Wellen A→B→C→D wie §7/§11.7 (keine Einwände). |

**Status:** Beschlüsse in §13 gelten. Umsetzung über Orchestrator-Batches (siehe GitHub PRs
#357–#392). EntityTag-Primärquelle in tag-service; cross-domain Suche; Kanon-Lifecycle-Filter.
