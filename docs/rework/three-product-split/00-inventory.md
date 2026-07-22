# O00 — Repo-Inventar für den Drei-Produkte-Split

Stand: 2026-07-15. Dieses Dokument ist ein **Read-only-Snapshot** des Repositories. Es beschreibt den Ist-Zustand und eine eindeutige Zielverantwortung; es ist noch kein Migrationsplan.

> **Delta-Hinweis (2026-07-22):** Seit diesem Snapshot sind die PRs #777–#782
> gemerged (Atlas 3D, PDF-Kampagnen-Import, Command Center). Ist-Werte jetzt:
> 411 Routen, 36 Packages, 142 Prisma-Modelle; die fünf 2D-Atlas-Modelle sind
> entfernt, sechs `Atlas3D*`-Modelle sowie `packages/atlas-editor` und
> `packages/pdf-campaign-import` sind neu. Der Snapshot unten bleibt bewusst
> unverändert; das Delta samt Zuordnung steht in
> [07-delta-und-mehrfachzuordnung.md](07-delta-und-mehrfachzuordnung.md).

## Methode und bindende Regeln

Ausgewertet wurden `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/CURRENT_STATE.md`, `SECURITY.md`, `docs/life-brain-privacy.md`, `docs/rework/route-feature-inventory.md`, `.cursor/skills/uwe-architecture/SKILL.md`, dessen Package-Boundary-Referenz, der aktuelle Route-Baum, die drei Navigation Contracts, alle `packages/*` und `tools/*`, `docs/engineering/database-service-map.md`, das vollständige Prisma-Schema sowie Storage-, Job- und Deploy-Quellen.

Die Tabellen verwenden genau eine primäre Zielkategorie pro Eintrag:

- **Portal** — player-facing D&D-Oberfläche; read-mostly und ausschließlich serverseitig gefilterte, freigegebene Daten.
- **Studio** — D&D-Spielleitung, Authoring, D&D-World-Brain, Review und Veröffentlichung.
- **Brain** — owner-private persönliche Daten und lokale KI; standardmäßig lokal/LAN.
- **Platform** — Auth, Security, Konfiguration, Persistenz-Infrastruktur, Jobs, Connector, Deploy und CI.
- **SharedEngine** — wiederverwendbare, datenquellenneutrale Engines ohne direkten privaten Datenzugriff.

Verbindliche Invarianten für jede Zuordnung:

1. `dm_only` erreicht niemals Portal, statischen Export oder Cloud.
2. `personal_brain` ist hart local-only, owner-only und nicht konfigurierbar.
3. D&D-Kontext folgt `SECURITY.md`: Gateway-Default `CLOUD_ALLOWED` (W0 Atlas), wobei `dm_only` vor Cloud-Routing entfernt wird und Datenschutzmodus/Policy Cloud weiter sperren können. Anderslautende ältere Aussagen in `docs/life-brain-privacy.md` und der Architektur-Skill sind nicht maßgeblich.
4. Brain ist owner-only.
5. Keine Cross-App-Imports. Gemeinsame Engines sind erlaubt; gemeinsame private Datenzugriffe sind es nicht.

### Zählweise

Eine Route ist genau eine vorhandene `page.tsx` oder `route.ts`. Route Groups zählen nicht als URL-Segment. Verzeichnisse ohne `page.tsx`/`route.ts`, Layouts, Server Actions und Middleware werden nicht als Route gezählt. Die gruppierten Zeilen unten partitionieren alle **409** gefundenen Routen: Studio-Baum 148 Seiten + 204 APIs, Portal-Baum 33 Seiten + 24 APIs.

## 1. Apps

| Pfad | Zweck | Zuordnung | Begründung | Konfidenz |
|---|---|---|---|---|
| `apps/studio` | Next.js-App für D&D-Authoring, Administration und derzeit auch Daily Admin OS | Studio | Der D&D-Schreib-, Review- und Veröffentlichungsanteil definiert das Zielprodukt; owner-private Flächen im selben Baum werden unten Brain zugeordnet und müssen herausgelöst werden. | hoch |
| `apps/portal` | Next.js-Spieler-Wiki, Handouts, Share-Links und player-facing Interaktion | Portal | Alle Inhaltszugriffe müssen veröffentlicht/player-safe und serverseitig gefiltert sein. | hoch |
| `apps/rtx-connector-client` | Tauri-Desktop-Client für Host-Verbindung, lokale Modelle, Drucker, Jobs, Logs und Diagnose | Platform | Lokale Ausführungs- und Betriebsoberfläche, kein Produkt-Datenspeicher. | hoch |

Ein eigenes `apps/brain` existiert im Ist-Stand nicht. Brain-Flächen liegen überwiegend im Studio-Baum.

## 2. Routeninventar

### 2.1 Studio-Seiten — `apps/studio/app/**/page.tsx` (148)

| Pfad/Verzeichnisgruppe (Anzahl) | Zweck | Zuordnung | Begründung | Konfidenz |
|---|---|---|---|---|
| `/worlds/**` (54) | Welten, Wiki, Dashboard, Sessions/Live/Review, Dungeons, Assets, Labels/Print, Graph, Atlas, D&D-Brain, AI-Runs, Inspector, Import, Soundboard, Kalender/Chronik, Charaktere, Schatz, Statblocks/Items und Backup je Welt | Studio | Gesamter D&D-Authoring- und DM-Review-Bereich; Portal konsumiert nur separat gefilterte Projektionen. | hoch |
| `/ai`, `/brain`, `/image-studio/**`, `/import`, `/templates/**` (9) | D&D-KI/Generatoren, D&D-Brain Store, Bild-Authoring, Inhaltsimport und Seitenvorlagen | Studio | Erzeugt oder verändert D&D-/Weltinhalte und verlangt Review. `image-studio` und `import` haben heute einzelne Brain-fähige Zieldaten und sind deshalb Hotspots. | mittel |
| `/admin/ai-prompt`, `/admin/reviews` (2) | D&D-Prompt-Konsole und Content-Review-Queue | Studio | Inhaltliche KI- und Freigabe-Workflows. | hoch |
| `/today`, `/capture/**`, `/continue`, `/search`, `/knowledge`, `/life-brain/**` (10) | Daily Admin OS, Capture, Cross-Domain-Suche, persönlicher Wissensassistent und Life-Brain | Brain | Enthält persönliche/owner-private Daten. `/search` mischt zusätzlich D&D und Admin-Domänen und ist eine Split-Naht. | mittel |
| `/calendar`, `/contracts`, `/documents`, `/finance`, `/hardware`, `/household`, `/kitchen/**`, `/mail/**`, `/miniatures`, `/projects/**`, `/scan-inbox/**`, `/workshop/**` (24) | Persönliche Organisation, Mail, Kalender, Dokumente, Verträge, Kosten, Homelab, Haushalt, Küche, Scans und Werkstatt | Brain | Daily-/Admin-OS-Daten sind owner-privat und dürfen nicht über Studio-/Portal-Datenzugriffe geteilt werden. | hoch |
| `/admin/cockpit`, `/admin/cookbook` (2) | Owner-Cockpit und lokale Modell-/Hardware-Verwaltung | Brain | Owner-only und eng mit persönlichen/lokalen KI-Funktionen verbunden. | mittel |
| `/bugs`, `/ideas`, `/prompts/**` (4) | Repo-Bug-Center, Entwicklungs-Ideen und Agent-Prompt-Bibliothek | Platform | Entwicklungs- und Repo-Betrieb, nicht persönliches Life-Brain. | mittel |
| `/`, `/portal`, `/studio` (3) | Landing-/Redirect-Shims und Produktübergang | Platform | App-Routing und Produkt-Gateway, keine Fachdaten. | hoch |
| `/login`, `/logout`, `/forgot-password`, `/reset-password`, `/setup`, `/account/**` (7) | Anmeldung, Bootstrap, Reset, Passwort und 2FA | Platform | Gemeinsamer Auth-/Account-Layer. | hoch |
| `/backup`, `/command`, `/jobs`, `/maintenance`, `/settings`, `/system/**` (17) | Backup, Admin-Kommandos, Queue, Wartungsstatus, globale Einstellungen und Host-/Systembetrieb | Platform | Betriebs-, Konfigurations- und Orchestrierungsflächen. | hoch |
| `/admin/{activity,agent-jobs,ai-gateway,api-tokens,audit-log,checklist,migrations,roles,secrets,security,setup,status,tags,users,webhooks}` sowie `/admin` (16) | Systemadministration, Gateway, Security, Nutzer, Integrationen und Audit | Platform | Produktübergreifende Host-/Security-Verantwortung. | hoch |

### 2.2 Studio-APIs — `apps/studio/app/api/**/route.ts` (204)

| Pfad/Verzeichnisgruppe (Anzahl) | Zweck | Zuordnung | Begründung | Konfidenz |
|---|---|---|---|---|
| `/api/worlds/**` (27) | Welt-, Seiten-, Brain-, Assets-, Graph-, Print-, Review-, Inspector-, Charakter- und Spotify-Endpunkte | Studio | D&D-Authoring/Review; auch player-safe Ableitungen werden im Portal separat exponiert. | hoch |
| `/api/ai/**` (12), `/api/brain/**` (4) | KI-Routing, Runs/Proposals und D&D-Brain-Aktionen | Studio | Primär D&D-Autorensurface. `personal_brain`-Modi im gemeinsamen AI-Pfad müssen in einen Brain-Adapter getrennt werden. | mittel |
| `/api/dnd/**`, `/api/dnd-api`, `/api/dnd-generator` (5) | Regelwerksuche, externe D&D-Quellen und strukturierte Generatoren | Studio | D&D-Authoring; die datenquellenneutralen Clients selbst liegen in SharedEngine. | hoch |
| `/api/{assets,export,image-studio,import,research,spotify}/**` (9) | Medienausgabe, statischer Export, Bild- und Importjobs, Research und Spotify OAuth | Studio | Aktuell an D&D-/Weltworkflows gebunden; Research und Import unterstützen zugleich Brain-Kontexte und bleiben strittig. | mittel |
| `/api/admin/reviews/**` (2) | Review-Queue | Studio | Expliziter D&D-/Content-Review. | hoch |
| `/api/{calendar,capture,documents,kitchen,life-brain,mail,miniatures,projects,scan,workshop}/**` (28) | Persönliche Kalender-, Capture-, Dokument-, Küchen-, Life-Brain-, Mail-, Scan- und Projektoperationen | Brain | Verarbeitet owner-private Daten; niemals Portal- oder generischer Shared-Zugriff. | hoch |
| `/api/internal/{briefing,mail-sync}` (2) | Timer-Trigger für persönliches Briefing und IMAP-Sync | Brain | Owner-private Automationen mit lokalen/persönlichen Inhalten. | hoch |
| `/api/admin/{cockpit,cookbook,mail}/**` (22) | Owner-Cockpit, lokale Modellverwaltung und Mail-Administration | Brain | Owner-only und/oder persönliche Daten. | hoch |
| `/api/{bugs,ideas}/**` (7) | Entwicklungs-Ideen, Agent-Dispatch und GitHub-Issue-Erzeugung | Platform | Repo-/Entwicklungsbetrieb. | mittel |
| `/api/{agent-jobs,auth,backup,command,connectors,health,inference,jobs,maintenance,settings,system}/**` (47) | Auth, Queue, Host Connector, Backup, Inferenzendpunkte, Health und Einstellungen | Platform | Gemeinsame Betriebs- und Orchestrierungsschicht. | hoch |
| `/api/admin/**` ohne `reviews`, `cockpit`, `cookbook`, `mail` (39) | Nutzer/RBAC, Security, Audit, Tokens, Webhooks, Setup, Hoststeuerung, Gateway und Connector-Administration | Platform | Produktübergreifende Systemverantwortung. | hoch |

### 2.3 Portal-Seiten — `apps/portal/app/**/page.tsx` (33)

| Pfad/Verzeichnisgruppe (Anzahl) | Zweck | Zuordnung | Begründung | Konfidenz |
|---|---|---|---|---|
| `/`, `/portal` (2) | Login-first Einstieg/Redirect | Portal | Produkt-Landing ohne eigene private Daten. | hoch |
| `/auth/worlds/**` (19) | Meine Welten, Wiki, NPCs, Graph, Sessions, Schatz, Timeline, Quests, Charaktere, Handouts, Assets, Notizen, Fragen, Soundboard und Atlas | Portal | Player-facing Projektionen und begrenzte Spielerinteraktion; alle Weltinhalte bleiben visibility-gefiltert. | hoch |
| `/share/**` (2) | Passwort-/Token-gebundene Freigaben | Portal | Player-safe, streng auf das Share-Ziel begrenzt. | hoch |
| `/worlds/**` (4) | Legacy Public-Discovery/Redirect-Shims inkl. Graph und Seite | Portal | Bleibt Portal-Verantwortung, obwohl die aktive IA login-first ist. | hoch |
| `/login`, `/forgot-password`, `/reset-password`, `/maintenance` (4) | Öffentliche Auth- und Wartungseinstiege | Platform | Gemeinsamer Auth-/Betriebs-Layer. | hoch |
| `/auth/account/**` (2) | Passwort und 2FA | Platform | Gemeinsame Account-Security. | hoch |

### 2.4 Portal-APIs — `apps/portal/app/api/**/route.ts` (24)

| Pfad/Verzeichnisgruppe (Anzahl) | Zweck | Zuordnung | Begründung | Konfidenz |
|---|---|---|---|---|
| `/api/assets/**` (1), `/api/share/**` (2), `/api/worlds/**` (3) | Gefilterte Assets, Share-Verifikation/-Dateien und player-safe Welt-/Graphdaten | Portal | Portal-spezifische, serverseitig gefilterte Read-/Share-Verträge. | hoch |
| `/api/auth/**` (12), `/api/health/**` (3), `/api/maintenance/**` (2), `/api/admin/audit-log` (1) | Session/2FA, Health, Wartung und Audit | Platform | Gemeinsame Auth-/Betriebsfunktionen. Der einzelne Portal-Audit-Endpunkt ist ein Grenzfall und sollte nicht Portal-Fachdaten werden. | hoch |

## 3. Navigation Contracts

### 3.1 Studio

`apps/studio/src/navigation/studio-nav.ts` komponiert zusätzlich `organization-nav.ts` und `system-nav.ts`; die folgenden Zeilen bilden die aufgelöste Navigation vollständig ab.

| Pfad/Symbol | Zweck bzw. Ziele | Zuordnung | Begründung | Konfidenz |
|---|---|---|---|---|
| `studio-nav.ts:START_NAV` | `/today`, `/capture?quick=1`, `/search` | Brain | Daily Admin/Capture und die heute gemischte Cross-Domain-Suche. | mittel |
| `studio-nav.ts:WORLDS_NAV` | `/worlds` | Studio | D&D-Weltverwaltung. | hoch |
| `studio-nav.ts:KNOWLEDGE_NAV` | `/brain` | Studio | `BrainDocument`/`BrainFact` sind D&D-Weltwissen. | hoch |
| `studio-nav.ts:KNOWLEDGE_NAV` | `/life-brain`, `/knowledge`, `/life-brain/chat` | Brain | Owner-only, persönliche Daten, local-only KI. | hoch |
| `studio-nav.ts:AI_NAV` | `/ai`, `/admin/ai-prompt` | Studio | D&D-KI und Generator-/Prompt-Review. | hoch |
| `studio-nav.ts:AI_NAV` | `/admin/ai-gateway` | Platform | Provider-, Policy- und Budgetsteuerung für mehrere Produkte. | hoch |
| `studio-nav.ts:TOOLS_NAV/tools-daily` | `/capture`, `/scan-inbox`, `/continue`, `/finance`, `/household`, `/kitchen` | Brain | Persönliche Erfassung und Daily Admin OS. | hoch |
| `studio-nav.ts:TOOLS_NAV/tools-content` | `/templates`, `/image-studio`, `/import` | Studio | D&D-Inhaltsauthoring; Import/Image Studio bleiben gemischte Adapter-Hotspots. | mittel |
| `studio-nav.ts:TOOLS_NAV/tools-content` | `/prompts` | Platform | Repo-/Agent-Prompt-Bibliothek. | mittel |
| `studio-nav.ts:TOOLS_NAV/tools-automation` | `/admin/reviews` | Studio | Content-Review. | hoch |
| `studio-nav.ts:TOOLS_NAV/tools-automation` | `/admin/agent-jobs`, `/jobs` | Platform | Entwicklungs- und Background-Job-Orchestrierung. | hoch |
| `organization-nav.ts:org-work` | `/projects`, `/contracts`, `/documents`, `/workshop`, `/miniatures` | Brain | Persönliche Projekte, Dokumente und Werkstattdaten. | hoch |
| `organization-nav.ts:org-work` | `/ideas`, `/bugs` | Platform | Repo-/Entwicklungsbetrieb. | mittel |
| `organization-nav.ts:org-infra` | `/hardware` | Brain | Persönliches Homelab-Inventar mit privaten Netzwerk-/Gerätedaten. | hoch |
| `organization-nav.ts:org-comms` | `/mail`, `/calendar` | Brain | Persönliche Kommunikations- und Termindaten. | hoch |
| `system-nav.ts:SYSTEM_NAV/overview` | `/system`, `/admin`, `/command`, `/system/navigation`, `/admin/activity` | Platform | System-, IA-, Admin- und Auditoberflächen. | hoch |
| `system-nav.ts:SYSTEM_NAV/overview` | `/admin/cockpit` | Brain | Owner-zentrierte, domänenübergreifende private Zusammenfassung. | mittel |
| `system-nav.ts:SYSTEM_NAV/setup-host` | `/admin/setup`, `/admin/checklist`, `/system/command-center`, `/system/host-control`, `/system/cloudflare`, `/system/rtx-connector`, `/system/printers` | Platform | Host-, Netzwerk-, Connector- und Gerätebetrieb. | hoch |
| `system-nav.ts:SYSTEM_NAV/access` | `/admin/users`, `/admin/roles`, `/admin/security`, `/admin/audit-log`, `/admin/api-tokens`, `/admin/webhooks` | Platform | RBAC und Security. | hoch |
| `system-nav.ts:SYSTEM_NAV/operations` | `/backup`, `/admin/migrations`, `/system/version`, `/system/whats-new`, `/system/startklar`, `/system/health`, `/system?tab=diagnose`, `/system/uwe-knowhow`, `/admin/tags` | Platform | Betrieb, Persistenz, Diagnose und globale Taxonomie. | hoch |
| `system-nav.ts:SYSTEM_NAV/settings` | `/settings`, `/account/password`, `/account/security` | Platform | Gemeinsame Konfiguration und Account-Security. | hoch |
| `system-nav.ts:ADMIN_HUB_SECTIONS` | Sekundärlinks auf Setup/Host, Nutzer/Security, Content/KI und Betrieb | Platform | Hub selbst ist Platform; seine Links auf `/admin/reviews`, `/mail` und `/worlds` delegieren fachlich an Studio bzw. Brain. | mittel |

### 3.2 Portal und Connector

| Pfad/Symbol | Zweck bzw. Ziele | Zuordnung | Begründung | Konfidenz |
|---|---|---|---|---|
| `apps/portal/src/navigation/portal-nav.ts:PORTAL_NAV` | `/auth/worlds` | Portal | Einstieg in player-safe Welten. | hoch |
| `portal-nav.ts:PORTAL_NAV` | `/auth/account/password`, `/auth/account/security` | Platform | Gemeinsame Account-Security. | hoch |
| `portal-nav.ts:portalWorldNav` | Übersicht, Wiki, NPCs, Graph, Sessions, Schatz, Timeline, Quests, Charaktere, Handouts, Galerie, Notizen, Fragen, Soundboard, Atlas | Portal | Vollständige world-scoped Spieler-IA. | hoch |
| `portal-nav.ts:shareNavGroups` | `/share/[token]` | Portal | Zielgebundene Freigabe. | hoch |
| `apps/rtx-connector-client/src/navigation/connector-nav.ts:CONNECTOR_NAV` | `/`, `/runner`, `/models`, `/printers`, `/jobs`, `/logs`, `/diagnostics` | Platform | Owner-only lokale Worker-/Betriebs-IA. | hoch |

## 4. Packages und Tools

### 4.1 Alle `packages/*` (34)

| Pfad | Zweck | Zuordnung | Begründung | Konfidenz |
|---|---|---|---|---|
| `packages/agent-jobs` | Dispatch/Status für GitHub Actions und Cursor Cloud, Presets | Platform | Entwicklungsautomation ohne Welt-/Brain-Payloads. | hoch |
| `packages/ai-brain` | KI-Router, Provider, Privacy Guards, D&D-/Personal-Brain-Indexierung | SharedEngine | Router/Guards sind wiederverwendbar; private Kontextlader müssen in Produktadapter ausgelagert bleiben. | mittel |
| `packages/assets` | Pfadauflösung, Storage Keys, MIME-/Uploadvalidierung | SharedEngine | Datenquellenneutrale Storage-Engine; Autorisierung liegt außerhalb. | hoch |
| `packages/atlas` | Atlas-Geometrie, Zeichenmodell, Presets, Serialisierung | SharedEngine | Reine wiederverwendbare Weltkarten-Engine. | hoch |
| `packages/atlas-3d` | WebGL-Höhenfeld und 3D-Projektion | SharedEngine | Rendering-Engine ohne privaten Datenzugriff. | hoch |
| `packages/auth` | Sessions, Rollen, Rechte, Route Policy | Platform | Produktübergreifende Identität und Zugriffspolitik. | hoch |
| `packages/backup` | Backup/Restore, Manifest, Schedule-Datei | Platform | Instanzweite Persistenzoperation; muss Produktgrenzen beim Export erzwingen. | hoch |
| `packages/calendar` | iCal-/CalDAV-Parsing, Export und Sync-Helper | SharedEngine | Protokoll-/Format-Engine; private Credentials/Daten gehören in Brain-Adapter. | hoch |
| `packages/config` | Gemeinsame TypeScript-/Tooling-Konfiguration | Platform | Build-/Repo-Infrastruktur. | hoch |
| `packages/connector` | Host/Worker-Rollen, Capabilities, Queue-Lanes und Token-Hashing | Platform | Transport- und Ausführungsvertrag. | hoch |
| `packages/connector-client-config` | Connector-Client-Settings, Validierung, UI-Helper ohne I/O | Platform | Konfiguration einer Platform-App. | hoch |
| `packages/connector-model-profile` | Modellprofil-Typen, Validierung, Scanpfade ohne Persistenz | SharedEngine | Datenneutrales Modellmetadaten-Schema. | hoch |
| `packages/cookbook` | Lokale Modellverwaltung, Hardware-Fit und Runtime-Diagnose | Brain | Owner-private lokale KI; wegen Betriebsanteilen noch strittig. | mittel |
| `packages/database` | Prisma-Schema, Repositories und gemischte Domain Services | Platform | Gemeinsame Persistenz-Infrastruktur im Ist-Stand; fachliche Services müssen nach den unten dokumentierten Produktgrenzen getrennt werden. | mittel |
| `packages/dnd-api` | Open5e-/5e-SRD-Clients | SharedEngine | Öffentliche D&D-Datenquellen ohne privaten UWE-Zugriff. | hoch |
| `packages/env` | Env-Validierung und Redaction | Platform | Laufzeitkonfiguration/Security. | hoch |
| `packages/host-monitor` | Read-only Linux-Telemetrie | Platform | Hostbetrieb ohne Fachdaten. | hoch |
| `packages/image-studio` | Bildgenerierungs-/Editier-Typen und Workflows | Studio | Aktuelle Autorensurface; generische Bildoperationen könnten später weiter extrahiert werden. | mittel |
| `packages/kitchen` | Rezepte, Zutaten und Einheiten | Brain | Persönlicher Haushaltsbereich. | hoch |
| `packages/knoteforge-import` | Preview, Mapping und Validierung für Weltimport | Studio | D&D-Inhaltsaufnahme mit Review/Undo. | hoch |
| `packages/mail` | Mail-Center mit DB-nahen Konten, Sync, Regeln, Suche und Aktionen | Brain | Verarbeitet persönliche Maildaten. | hoch |
| `packages/mail-core` | SMTP/IMAP/MIME und Attachment-Primitives ohne DB-Abhängigkeit | SharedEngine | Wiederverwendbare Mail-Protokoll-Engine. | hoch |
| `packages/page-ai-review` | Batch-/Side-by-side-KI-Review für Wiki-Seiten | Studio | D&D-Content-Review. | hoch |
| `packages/player-hub` | Handout-Postfach, Questprioritäten und Sessionverfügbarkeit | Portal | Explizite Spielerfunktionalität. | hoch |
| `packages/roll-tables` | Würfel-/Zufallstabellenlogik | SharedEngine | Datenneutrale D&D-Engine. | hoch |
| `packages/scan-inbox` | OCR, Feldextraktion und Ablagevorschläge | Brain | Scans sind standardmäßig privat; D&D-Scans werden erst nach Klassifikation an Studio übergeben. | hoch |
| `packages/security` | Validierung, CSRF, Rate Limits und sichere Responses | Platform | Produktübergreifende Security. | hoch |
| `packages/security-tests` | Authz-, Leak- und Route-Gates | Platform | Gemeinsame Sicherheits-Governance. | hoch |
| `packages/shared-ui` | Cross-App React-Primitives und Shell-Bausteine | SharedEngine | UI-Engine ohne direkten privaten Datenzugriff. | hoch |
| `packages/shared-utils` | Framework-neutrale Slugs, Lookup Keys und Navigation Contract | SharedEngine | Reine Utility-/Vertragslogik. | hoch |
| `packages/soundboard` | Playback-State und Source-Adapter | SharedEngine | Wiederverwendbare Medienengine; Sichtbarkeit/Steuerung verbleibt in Studio/Portal-Adaptern. | mittel |
| `packages/static-export` | Statischer HTML-Export player-sicherer Inhalte | Portal | Ergebnis ist eine Portal-Projektion; `dm_only` ist zwingend ausgeschlossen. | hoch |
| `packages/theme-studio` | Palette, WCAG-Gate und dialogische Theme-Erstellung | Studio | Authoring-Werkzeug; die resultierenden Tokens können geteilt werden. | mittel |
| `packages/web-search` | SearXNG-Provider und Research-Report-Helfer | SharedEngine | Datenquellenneutrale Websuche; Kontextanreicherung gehört in Studio-/Brain-Adapter. | hoch |

### 4.2 Alle `tools/*` (2)

| Pfad | Zweck | Zuordnung | Begründung | Konfidenz |
|---|---|---|---|---|
| `tools/uwe-host-command-center` | Lokaler Telemetrie- und Hoststeuerungs-Client | Platform | Betrieb/Diagnose des Linux-Hosts. | hoch |
| `tools/uwe-rtx-connector` | Optionaler outbound Worker für lokale KI, Audio, Spotify und Druck | Platform | Ausführungsinfrastruktur; keine dauerhafte UWE-Source-of-Truth. | hoch |

### 4.3 `@uwe/database`-Services nach Domäne

| Pfad/Domain | Zweck | Zuordnung | Begründung | Konfidenz |
|---|---|---|---|---|
| `packages/database/src/{repository,app-repository,client,permissions,content-access}.ts` | DB-Kern, Repository und Visibility-Gates | Platform | Gemeinsame Persistenz; Produktadapter dürfen nur eng geschnittene Repositories erhalten. | mittel |
| `auth.ts`, `user-service.ts`, `two-factor-service.ts`, `api-token-service.ts`, `login-audit.ts`, `owner-setup-service.ts` | Nutzer, Sessions, 2FA, Tokens und Bootstrap | Platform | Gemeinsame Auth-/Security-Domäne. | hoch |
| `page-service.ts`, `page-template-service.ts`, `page-templates.ts`, `search-service.ts`, `graph-service.ts` | Wiki-/Seiten-Authoring und D&D-Suche/Graph | Studio | Studio besitzt die Quelle; Portal erhält gefilterte Read Models. | hoch |
| `tag-service.ts` | Globale Tags über Studio- und Brain-Entitäten | Platform | Heutige Cross-Domain-Taxonomie; benötigt künftig getrennte Namespaces/ACLs. | niedrig |
| `world-creation-service.ts`, `world-inspector.ts`, `world-overview.ts`, `game-session.ts`, `dungeon-cockpit.ts` | Welten, Sessions, Dungeons und Leak-/Canon-Inspektion | Studio | D&D-DM-Authoring. | hoch |
| `character-service.ts`, `character-spell-service.ts`, `character-level-up-service.ts`, `character-sheet-export.ts` | Spielercharaktere und Exporte | Portal | Spielerbezogener Datensatz; DM-Override und Schreibhoheit sind noch zu entscheiden. | niedrig |
| `brain-store-service.ts`, `generator-service.ts` | D&D-World-Brain und Generatorpersistenz | Studio | `BrainDocument`/`BrainFact` sind D&D-, nicht Personal-Brain. | hoch |
| `research-service.ts` | Research mit `dnd_brain`, `life_brain` und `open_web` | Brain | Sensitivste Variante (`life_brain`) bestimmt vorläufig die Grenze; D&D-Research braucht einen Studio-Adapter. | niedrig |
| `life-admin-service.ts`, `personal-brain-service.ts`, `personal-brain-context.ts`, `personal-brain-search.ts`, `capture-triage-service.ts` | Daily Admin OS und Personal Brain | Brain | Owner-only, local-only bei persönlichem KI-Kontext. | hoch |
| `ai-gateway-service.ts`, `inference-endpoint-service.ts` | Provider, Policy, Budgets und lokale Endpunkte | Platform | Produktübergreifendes Routing/Policy. | hoch |
| `ai-run-service.ts`, `ai-review-service.ts` | Runs, Proposals und Review | Studio | Aktuell welt-/seitenzentrierter D&D-Workflow; persönliche Runs dürfen diese Tabellen nicht ungeprüft teilen. | mittel |
| `mail-service.ts`, `mail-compose-service.ts`, `mail-portal-service.ts`, `mail-account-service.ts`, `mail-template-service.ts`, `mail-unsubscribe-service.ts` | Persönliches Mail-Center | Brain | Private Nachrichten, Konten und Anhänge. | hoch |
| `calendar-service.ts`, `calendar-aggregation-service.ts` | Persönliche, Vertrags- und Welttermine | Brain | Externe Credentials und persönliche Events machen die Domäne privat; Welttermine brauchen eine Studio-Projektion. | mittel |
| `label-service.ts`, `label-print-queue-service.ts`, `label-workshop-service.ts`, `label-export.ts` | D&D-Labels und Druckqueue | Studio | Welt-/Session-Authoring. | hoch |
| `portal-access-service.ts`, `portal-dashboard-service.ts`, `player-note-service.ts`, `share-link-service.ts` | Portalzugriff, Spieler-Dashboard, Notizen und Shares | Portal | Player-facing Daten und Zugriffsprojektionen. | hoch |
| `studio-security.ts`, `security-dashboard.ts`, `audit-log-service.ts`, `public-leak-scanner.ts`, `production-safety.ts` | Security, Audit und Leak-Erkennung | Platform | Gemeinsame Schutzschicht. | hoch |
| `connector-service.ts`, `connector-workflow-service.ts`, `job-service.ts`, `agent-job-service.ts` | Connector Registry und Queues | Platform | Produktübergreifende Orchestrierung. | hoch |
| `integrations-service.ts`, Connector-Anteil | Integrationskonfiguration | Platform | Infrastruktur-/Connector-Konfiguration. | mittel |
| `spotify-connection-service.ts`, `soundboard.ts` | Weltbezogene Spotify-/Soundboard-Steuerung | Studio | D&D-Spieltischfunktion; Portal darf nur gefiltert anzeigen und nicht Playback auslösen. | hoch |
| `settings-service.ts`, `settings-validation.ts`, `admin-status.ts`, `system-status.ts`, `homelab-cockpit.ts` | Globale Einstellungen und Hoststatus | Platform | Systemweite Konfiguration/Betrieb. | hoch |
| `asset-repository.ts`, `asset-link-service.ts` | Weltmedien und Seitenlinks | Studio | D&D-Assetquelle; Portal liest nur visibility-gefiltert. Private Brain-Dateien benötigen einen eigenen Store. | mittel |
| `review-service.ts`, `review-bridge.ts`, `undo-service.ts`, `activity-log-service.ts` | Content-Review, Undo und fachliche Aktivität | Studio | Aktuell auf Welt-/Contentänderungen ausgerichtet. | mittel |

## 5. Prisma-Modelle — vollständig (141)

Jedes `model` aus `packages/database/prisma/schema.prisma` erscheint genau einmal. Die Zielkategorie bezeichnet die fachliche Hoheit, nicht zwingend die heutige Datenbank oder App.

### 5.1 Platform (33)

| Pfad/Modell | Zweck | Zuordnung | Begründung | Konfidenz |
|---|---|---|---|---|
| `schema.prisma#User` | Identität, Rolle, Status und Accountbeziehungen | Platform | Produktübergreifende Identität. | hoch |
| `schema.prisma#DashboardLayout` | Nutzerbezogene Widget-Anordnung für Studio/Portal | Platform | Cross-Product-UI-Präferenz, keine Fachdatenhoheit. | hoch |
| `schema.prisma#AuthIdentity` | Externe IdP-Verknüpfung | Platform | Auth-Infrastruktur. | hoch |
| `schema.prisma#Session` | Gehashte Session, Ablauf und Aktivität | Platform | Gemeinsame Session-Security. | hoch |
| `schema.prisma#WorldMembership` | Nutzerrolle in einer Welt | Platform | RBAC-Verknüpfung zwischen Identität und D&D-Welt. | hoch |
| `schema.prisma#SystemSettings` | Instanzweite Settings | Platform | Gemeinsame Laufzeitkonfiguration. | hoch |
| `schema.prisma#AuditLog` | Append-only Security-Audit | Platform | Produktübergreifende Nachvollziehbarkeit. | hoch |
| `schema.prisma#SeedHistory` | Idempotenzstatus von Seeds | Platform | Datenbankbetrieb. | hoch |
| `schema.prisma#Job` | Generische Background-Job-Queue | Platform | Gemeinsame Orchestrierung; Payloads müssen künftig produktgeschnitten sein. | hoch |
| `schema.prisma#JobLog` | Job-Fortschritt und Fehlerdetails | Platform | Queue-Telemetrie. | hoch |
| `schema.prisma#Connector` | Outbound-Worker Registry/Capabilities | Platform | Connector-Infrastruktur. | hoch |
| `schema.prisma#ConnectorWorkflowDefault` | Defaultmodell je Connector-Workflow | Platform | Ausführungsrouting. | hoch |
| `schema.prisma#ConnectorJob` | Transportqueue für lokale Worker | Platform | Infrastrukturvertrag; Payload darf keine unzulässigen Daten halten. | hoch |
| `schema.prisma#DevAgentJob` | Entwicklungsagent-Dispatch und PR-/Run-Status | Platform | Repo-Automation. | hoch |
| `schema.prisma#DevIdea` | Entwicklungs-Idee, Prompt und Agentverknüpfung | Platform | Repo-/Produktentwicklungsbetrieb, nicht Life-Brain. | mittel |
| `schema.prisma#BugReport` | Internes Bug-Center | Platform | Repo-/Systembetrieb. | mittel |
| `schema.prisma#ImportJob` | Importstatus, Preview, Undo und Zieltyp | Platform | Cross-Product-Orchestrierung; `personal_brain` und Weltziele müssen getrennte Adapter/Payloads erhalten. | niedrig |
| `schema.prisma#ApiToken` | Gehashter API-Token und Lebenszyklus | Platform | Security. | hoch |
| `schema.prisma#ApiTokenScope` | Token-Berechtigungen | Platform | Security/RBAC. | hoch |
| `schema.prisma#ApiTokenUsageLog` | Token-Nutzungsprotokoll | Platform | Security-Audit. | hoch |
| `schema.prisma#WebhookEndpoint` | Webhookziel und verschlüsselte Konfiguration | Platform | Integrationsinfrastruktur. | hoch |
| `schema.prisma#WebhookDelivery` | Zustellversuche/-status | Platform | Webhook-Betrieb. | hoch |
| `schema.prisma#SecurityWarning` | Erkannte/dismissed Sicherheitswarnung | Platform | Instanzsecurity. | hoch |
| `schema.prisma#TwoFactorSecret` | Verschlüsseltes 2FA-Material | Platform | Account-Security. | hoch |
| `schema.prisma#TwoFactorChallenge` | Kurzlebige 2FA-Challenge | Platform | Account-Security. | hoch |
| `schema.prisma#InferenceEndpoint` | Lokaler/kompatibler Inferenzendpunkt und Modellcache | Platform | Provider-Infrastruktur; persönliche Daten bleiben außerhalb. | hoch |
| `schema.prisma#AiGatewayConfig` | Routingmodus, Privacy Rules und Budgets | Platform | Zentrale Policy; `personal_brain` bleibt unabhängig davon local-only. | hoch |
| `schema.prisma#AiCloudProvider` | Cloud-Providerkonfiguration | Platform | Provider-Infrastruktur. | hoch |
| `schema.prisma#AiUserGrant` | KI-Rechte und Budget je Nutzer | Platform | Produktübergreifende KI-Autorisierung. | hoch |
| `schema.prisma#AiUsageLog` | KI-Nutzung, Kosten und Routingmetadaten | Platform | Betriebs-/Budgettelemetrie; keine Promptinhalte vorgesehen. | hoch |
| `schema.prisma#Tag` | Globale Tagdefinition | Platform | Heutiger globaler Namespace über mehrere Produkte. | niedrig |
| `schema.prisma#EntityTag` | Polymorphe Tag-zu-Entity-Verknüpfung | Platform | Cross-Domain-Hotspot mit optionaler Weltbindung; braucht Produkt-Namespaces. | niedrig |
| `schema.prisma#PromptTemplate` | Repo-, UI-, D&D-, Import- und Refactor-Prompts | Platform | Primär Entwicklungs-/Automationsbibliothek; D&D-Presets können Studio-Projektionen werden. | mittel |

### 5.2 Portal (12)

| Pfad/Modell | Zweck | Zuordnung | Begründung | Konfidenz |
|---|---|---|---|---|
| `schema.prisma#PagePlayerAccess` | Explizite Seitenfreigabe je Spieler | Portal | Player-spezifische Zugriffsliste. | hoch |
| `schema.prisma#PlayerQuestFlag` | Spielerpriorität/-notiz für Quests | Portal | Player-owned Interaktion. | hoch |
| `schema.prisma#SessionAvailability` | Spieler-Verfügbarkeit für Sessions | Portal | Player-facing Planung. | hoch |
| `schema.prisma#SessionUnlock` | Spielerbezogene Freischaltung | Portal | Portal-Entitlement. | hoch |
| `schema.prisma#Character` | Spielercharakter-Sheet und Owner | Portal | Player-owned Kernobjekt; DM-Override/Schreibhoheit noch offen. | mittel |
| `schema.prisma#CharacterSpell` | Zauber eines Spielercharakters | Portal | Bestandteil des player-owned Sheets. | mittel |
| `schema.prisma#PartyTreasury` | Gruppenschatz einer Welt | Portal | Player-Hub-Funktion; DM-Authoring bleibt als administrativer Adapter. | mittel |
| `schema.prisma#InventoryItem` | Charakter-/Gruppenschatz-Inventar | Portal | Player-facing Besitz; Schreibrechte müssen feingranular bleiben. | mittel |
| `schema.prisma#PlayerNote` | Private/geteilte Spielernotiz | Portal | Player-owned Daten; niemals an andere Spieler ohne Freigabe. | hoch |
| `schema.prisma#ShareLink` | Zielgebundene Freigabe | Portal | Portal-/Export-nahe Read-Surface. | hoch |
| `schema.prisma#ShareAccessLog` | Zugriffstelemetrie je Share-Link | Portal | Direkt an Portal-Freigaben gebunden; Datenschutz/Retention beachten. | hoch |
| `schema.prisma#PlayerQuestion` | Frage an den DM und Antwortstatus | Portal | Spielerinteraktion mit Studio-Gegenstelle. | hoch |

### 5.3 SharedEngine (1)

| Pfad/Modell | Zweck | Zuordnung | Begründung | Konfidenz |
|---|---|---|---|---|
| `schema.prisma#DndApiCacheEntry` | Cache öffentlicher Open5e-/SRD-Payloads | SharedEngine | Keine privaten UWE-Daten, nur Provider + Cache Key + öffentlicher Payload. | hoch |

### 5.4 Studio (50)

| Pfad/Modell | Zweck | Zuordnung | Begründung | Konfidenz |
|---|---|---|---|---|
| `schema.prisma#World` | D&D-Welt-Aggregat | Studio | Authoritative D&D-Quelle. | hoch |
| `schema.prisma#Campaign` | Kampagne innerhalb einer Welt | Studio | DM-Authoring. | hoch |
| `schema.prisma#Page` | Wiki-/D&D-Entität mit Publish-, Canon-, Visibility- und Secret-Status | Studio | Studio schreibt; Portal liest ausschließlich gefilterte Projektionen. | hoch |
| `schema.prisma#WorldCalendar` | In-Game-Kalendersystem | Studio | D&D-Weltzeit, nicht persönlicher Kalender. | hoch |
| `schema.prisma#WorldEvent` | D&D-Chronikereignis mit DM-/Player-Zusammenfassung | Studio | Authoring und getrennte Sichtbarkeit. | hoch |
| `schema.prisma#WorldEventEntityLink` | Chronik-zu-Seite-Verknüpfung | Studio | D&D-Graph. | hoch |
| `schema.prisma#FactionState` | Ziele/Ressourcen/Beziehungen einer D&D-Fraktion | Studio | DM-Simulation/Authoring. | hoch |
| `schema.prisma#StructuredStatblock` | Strukturierter D&D-Statblock | Studio | Regel-/NPC-Authoring. | hoch |
| `schema.prisma#GameSession` | Sessionplanung, DM-/Player-Recap und offene Plots | Studio | Studio ist Quelle; Portal erhält veröffentlichte Felder. | hoch |
| `schema.prisma#GameSessionPageLink` | Session-zu-Seite-Verknüpfung | Studio | DM-Authoring. | hoch |
| `schema.prisma#ContentBlock` | Seitenblock mit eigener Visibility/Secret-/Reveal-State | Studio | Zentrale DM-only-Grenze; Portal/Export filtern serverseitig. | hoch |
| `schema.prisma#Asset` | Weltasset mit Storage Key und Visibility | Studio | Studio verwaltet; Portal/Export lesen nur erlaubte Assets. | hoch |
| `schema.prisma#AssetAlbum` | Weltbezogenes Medienalbum | Studio | D&D-Medienauthoring. | hoch |
| `schema.prisma#AssetAlbumItem` | Sortierte Asset-Album-Zuordnung | Studio | D&D-Medienauthoring. | hoch |
| `schema.prisma#AssetPageLink` | Asset-zu-Seite-Verknüpfung | Studio | D&D-Contentgraph. | hoch |
| `schema.prisma#PageLink` | Wiki-/Beziehungslink | Studio | Authoritativer Weltgraph. | hoch |
| `schema.prisma#LabelTemplate` | Welt-/Systemvorlage für Labels | Studio | D&D-Druckauthoring. | hoch |
| `schema.prisma#Label` | D&D-Label mit Layout und Printstatus | Studio | Session-/Weltwerkzeug. | hoch |
| `schema.prisma#PrintList` | Druckliste je Welt/Kampagne | Studio | DM-Vorbereitung. | hoch |
| `schema.prisma#PrintListItem` | Label in Druckliste | Studio | DM-Vorbereitung. | hoch |
| `schema.prisma#SoundboardButton` | Weltbezogener Playback-Button mit Visibility | Studio | Studio steuert Playback; Portal darf nur erlaubte Buttons anzeigen. | hoch |
| `schema.prisma#SoundboardButtonPageLink` | Soundboard-zu-Seite-Verknüpfung | Studio | D&D-Spieltisch-Authoring. | hoch |
| `schema.prisma#ContentReview` | Unified Review-Queue für Weltcontent | Studio | DM-/Co-DM-Freigabe vor Apply/Publish. | hoch |
| `schema.prisma#ReviewComment` | Kommentar zu Content-Review | Studio | Review-Kollaboration. | hoch |
| `schema.prisma#SpotifyConnection` | Verschlüsselte Spotify-Weltverbindung | Studio | Weltbezogene Soundboardsteuerung; nie Portal-Playback. | hoch |
| `schema.prisma#ActivityLog` | Fachliche Content-/Review-/Backup-Aktivität | Studio | Heute überwiegend Welt-/Contentverlauf; Systemaktionen machen es zum Hotspot. | mittel |
| `schema.prisma#UndoEntry` | Snapshot vor destruktiver/automatischer Contentänderung | Studio | Authoring-Undo. | hoch |
| `schema.prisma#PageTemplate` | Quick-Create-Seitenvorlage | Studio | Wiki-Authoring. | hoch |
| `schema.prisma#AiRun` | D&D-KI-Ausführung mit Welt-/Seiten-/Sessionkontext | Studio | Welt-/Contentworkflow; persönliche Runs benötigen getrennten Store. | mittel |
| `schema.prisma#AiProposal` | Nicht automatisch angewandter KI-Patch | Studio | Review-pflichtiges D&D-Authoring. | hoch |
| `schema.prisma#AiApplyLog` | Apply/Discard/Rerun-Protokoll | Studio | Audit des D&D-Review-Lebenszyklus. | hoch |
| `schema.prisma#BrainDocument` | D&D-World-Brain-Dokument | Studio | Explizit getrennt von `PersonalBrainDocument`; D&D-Gateway-Policy aus `SECURITY.md` gilt. | hoch |
| `schema.prisma#BrainChunk` | Chunk/Embedding eines D&D-Brain-Dokuments | Studio | D&D-Index, niemals mit Personal-Brain-Chunks mischen. | hoch |
| `schema.prisma#BrainFact` | D&D-World-Brain-Fakt | Studio | Explizit D&D, nicht Life Brain. | hoch |
| `schema.prisma#BrainLink` | Polymorphe D&D-Brain-Verknüpfung | Studio | Weltgebundener Wissensgraph. | hoch |
| `schema.prisma#GeneratorPreset` | D&D-/Weltgenerator-Vorlage | Studio | Authoring. | hoch |
| `schema.prisma#GeneratorOutput` | Review-pflichtiges strukturiertes Generatorergebnis | Studio | Kein Auto-Apply; Welt-/Seitenbezug. | hoch |
| `schema.prisma#ImageStudioProject` | Bildprojekt mit optionaler Weltbindung | Studio | Aktuelle Autorensurface; worldloser/private Einsatz ist strittig. | mittel |
| `schema.prisma#ImageStudioVersion` | Generierte/bearbeitete Bildversion | Studio | Versionierung des Studio-Authorings. | mittel |
| `schema.prisma#ImageStudioLink` | Bildprojekt-Link auf Welt- oder Admin-Entität | Studio | Mischt Studio- und Brain-Ziele und muss in Produktadapter gespalten werden. | niedrig |
| `schema.prisma#DndBeyondReference` | Welt-/Seitenreferenz auf D&D Beyond | Studio | D&D-Authoring. | hoch |
| `schema.prisma#PageVersion` | Wiki-Seiten-Snapshot | Studio | Authoring-Versionierung. | hoch |
| `schema.prisma#RollTable` | Weltbezogene Zufallstabelle | Studio | D&D-Authoring; die Engine selbst ist geteilt. | hoch |
| `schema.prisma#AtlasMap` | Weltatlas-Dokument | Studio | D&D-Kartenauthoring mit Visibility. | hoch |
| `schema.prisma#AtlasNode` | Atlas-Hierarchieknoten | Studio | Weltkartenpersistenz. | hoch |
| `schema.prisma#AtlasFeature` | Geometrisches Atlas-Feature | Studio | Weltkartenpersistenz mit Visibility. | hoch |
| `schema.prisma#AtlasObject` | Platzierte Atlas-Palette-Instanz | Studio | Weltkartenpersistenz. | hoch |
| `schema.prisma#AtlasPaletteItem` | Atlas-Paletteneintrag/Asset | Studio | Authoring-Palette; builtin Geometrie kann SharedEngine bleiben. | mittel |
| `schema.prisma#SessionLiveEntry` | Ungeprüfter Live-Spieltisch-Eintrag | Studio | Muss nach der Session Review durchlaufen; ist noch nicht Canon. | hoch |
| `schema.prisma#StructuredItem` | Strukturierte D&D-Gegenstandsdaten je Seite | Studio | D&D-Authoring. | hoch |

### 5.5 Brain (45)

| Pfad/Modell | Zweck | Zuordnung | Begründung | Konfidenz |
|---|---|---|---|---|
| `schema.prisma#MailTemplate` | Globale oder weltbezogene Mailvorlage | Brain | Mailinhalte sind privat; weltbezogene Kampagnenmail ist ein strittiger Studio-Adapter. | mittel |
| `schema.prisma#MailRecipientGroup` | Weltbezogene Empfängergruppe | Brain | Personen-/Kontaktdaten; nicht Portal. | mittel |
| `schema.prisma#MailRecipient` | E-Mail-Adresse/Name in Gruppe | Brain | Personenbezogene Kommunikationsdaten. | hoch |
| `schema.prisma#MailMessageLog` | Versandstatus, Adressen und optionaler Preview | Brain | Private Kommunikationsmetadaten. | hoch |
| `schema.prisma#MailAccount` | IMAP-/SMTP-Konto und verschlüsselte Zugangsdaten | Brain | Owner-private Mailkonfiguration, lokal zu halten. | hoch |
| `schema.prisma#MailFolder` | IMAP-Ordner und Syncstatus | Brain | Persönliche Mailstruktur. | hoch |
| `schema.prisma#MailInboxMessage` | Eingehende Mail inkl. Body/Adressen | Brain | Hochprivate persönliche Daten. | hoch |
| `schema.prisma#MailAttachment` | Metadaten/Storage Key eines Mailanhangs | Brain | Teil privater Maildaten. | hoch |
| `schema.prisma#MailPriorityScore` | Lokale Mailpriorisierung | Brain | Aus persönlichem Mailinhalt abgeleitet; kein Cloud-Fallback mit Inhalt. | hoch |
| `schema.prisma#MailAiAction` | Zusammenfassung/Antwortentwurf/Priorisierung | Brain | Persönliche KI-Aktion; lokal gemäß Mail-/Personal-Privacy. | hoch |
| `schema.prisma#MailUnsubscribeRequest` | Abmeldeaktion und Ziel | Brain | Persönlicher Mailworkflow. | hoch |
| `schema.prisma#MailAuditLog` | Mail-spezifischer Auditverlauf | Brain | Private Kommunikationsdomäne. | hoch |
| `schema.prisma#MailDraft` | Persönlicher oder weltbezogener Entwurf | Brain | Entwurfsinhalt ist privat; Weltbezug bleibt strittig. | mittel |
| `schema.prisma#MailRule` | Persönliche Filter-/Aktionsregel | Brain | Owner-private Inbox-Automation. | hoch |
| `schema.prisma#MailVipSender` | VIP-Absenderliste | Brain | Persönliche Kontaktdaten. | hoch |
| `schema.prisma#CaptureEntry` | Quick Note, Datei/Audio/URL und Triagezustand | Brain | Persönliche Inbox; optionale Weltverknüpfung ist nur Übergabe an Studio. | hoch |
| `schema.prisma#PersonalProject` | Persönliches Projekt, Kosten und Next Action | Brain | Daily Admin OS. | hoch |
| `schema.prisma#ProjectStep` | Schritt eines persönlichen Projekts | Brain | Daily Admin OS. | hoch |
| `schema.prisma#ProjectImage` | Bild eines persönlichen Projekts | Brain | Private Projektdatei. | hoch |
| `schema.prisma#WorkshopProject` | Werkstatt-/Miniatur-/3D-Druckprojekt | Brain | Persönlicher Werkstattbestand; optionaler D&D-Link ändert die Hoheit nicht. | hoch |
| `schema.prisma#WorkshopPaintRecipe` | Persönliches Bemalrezept | Brain | Werkstatt-/Hobbydaten. | hoch |
| `schema.prisma#WorkshopPrintProfile` | 3D-Druckprofil/Erfahrungswerte | Brain | Persönliche Hardware-/Werkstattdaten. | hoch |
| `schema.prisma#WorkshopTerrainRental` | Geländeausleihe, Preise, Schäden und Checklisten | Brain | Owner-private Geschäfts-/Werkstattdaten. | hoch |
| `schema.prisma#ContractExpense` | Vertrag/Abo/Kosten und Fristen | Brain | Finanz-/Vertragsdaten. | hoch |
| `schema.prisma#HardwareDevice` | Homelab-Gerät, Host/IP/URLs und Setup | Brain | Persönliche Infrastrukturdetails; nicht Cloud/Portal. | hoch |
| `schema.prisma#PersonalBrainDocument` | Persönliches Life-Brain-Dokument | Brain | Hart owner-only und local-only, nicht konfigurierbar. | hoch |
| `schema.prisma#PersonalBrainChunk` | Separater Chunk/Embedding des Personal Brain | Brain | Strikt getrennt von `BrainChunk`; nur lokale Inferenz. | hoch |
| `schema.prisma#PersonalBrainFact` | Persönlicher Life-Brain-Fakt | Brain | Hart owner-only und local-only. | hoch |
| `schema.prisma#AdminEntityLink` | Link zwischen Capture, Projekten, Verträgen, Hardware und Personal Brain | Brain | Graph des Daily Admin OS. | hoch |
| `schema.prisma#CalendarFeed` | Persönlicher iCal-/CalDAV-Feed und verschlüsselte Credentials | Brain | Private externe Kalenderintegration. | hoch |
| `schema.prisma#CalendarEvent` | Persönliches, externes oder D&D-/Session-Event | Brain | Gemischtes Modell; private Events/Credentials bestimmen vorläufig die Grenze, Welttermine brauchen Studio-Projektion. | niedrig |
| `schema.prisma#MiniatureCollectionItem` | Persönliche Miniaturensammlung | Brain | Hobby-/Inventardaten; D&D-Bezug ist optional. | hoch |
| `schema.prisma#DocumentTemplate` | Vertrags-, Guide- und Checklisten-Vorlage | Brain | Daily Admin OS; D&D-Dokumente nutzen getrennte Page Templates. | hoch |
| `schema.prisma#ResearchSession` | Research in D&D-, Life-Brain- oder Open-Web-Modus | Brain | `life_brain` erzwingt owner-only/local-only; D&D-Research braucht getrennten Studio-Adapter. | niedrig |
| `schema.prisma#ResearchSource` | Webquelle eines Research-Reports | Brain | Kann Teil eines privaten Life-Brain-Reports sein. | mittel |
| `schema.prisma#Recipe` | Persönliches Rezept | Brain | Haushalts-/Küchendaten. | hoch |
| `schema.prisma#RecipeIngredient` | Zutat/Menge eines Rezepts | Brain | Haushalts-/Küchendaten. | hoch |
| `schema.prisma#MealPlanWeek` | Wochenplan, Ziele und KI-Entwurf | Brain | Persönliche Haushaltsplanung. | hoch |
| `schema.prisma#MealPlanEntry` | Mahlzeit je Tag/Slot | Brain | Persönliche Haushaltsplanung. | hoch |
| `schema.prisma#ShoppingList` | Einkaufsliste | Brain | Persönliche Haushaltsdaten. | hoch |
| `schema.prisma#ShoppingListItem` | Einkaufslistenposition | Brain | Persönliche Haushaltsdaten. | hoch |
| `schema.prisma#BringConnection` | Verschlüsselte Bring!-Verbindung | Brain | Persönliche externe Integration, niemals Portal/Cloud-Kontext. | hoch |
| `schema.prisma#ScanDocument` | Private oder D&D-Scans, OCR, Felder und Ablagevorschlag | Brain | Default ist `private`; D&D-Klassifikation wird erst nach Review an Studio übergeben. | mittel |
| `schema.prisma#MaintenanceTask` | Haushalts-/Wartungsintervall und Fälligkeit | Brain | Persönliches Daily Admin OS. | hoch |
| `schema.prisma#PantryItem` | Vorrat, Menge und Haltbarkeit | Brain | Persönliche Haushaltsdaten. | hoch |

## 6. Storage-Inventar

Es wurde ausschließlich Doku-/Codekonfiguration ausgewertet, kein Host-Dateisystem. Der aktive Setup-Pfad nutzt getrennte Host-Backups unter `/var/backups/uwe`; mehrere Dokumente nennen noch `/var/lib/uwe/backups`. Diese Abweichung ist unten ausdrücklich markiert.

### 6.1 Repo-/Entwicklungsdefaults

| Pfad | Zweck | Zuordnung | Begründung | Konfidenz |
|---|---|---|---|---|
| `packages/database/data/uwe.db` | Aufgelöster SQLite-Default für `file:./data/uwe.db` | Platform | Eine physische DB enthält heute Modelle aller Produkte; im aktuellen Worktree ist der Pfad nicht angelegt. | hoch |
| `data/uploads/<worldId>/...` | Weltassets, Sound, Image Studio; derzeit auch manche Admin-Medien über Hilfswelten | Studio | D&D-Assets sind Studio-Quelle. Brain-Dateien in derselben Welt-Namespace-Struktur sind ein Isolationsrisiko. | mittel |
| `data/uploads/_capture/...` | World-unabhängige Capture-Dateien | Brain | Persönliche Inbox-Anhänge. | hoch |
| `data/uploads/_scan/...` | Scan-Originale/OCR-Eingang | Brain | Standardmäßig private Dokumente. | hoch |
| `data/backups/` | Repo-lokale Backup-ZIPs/JSON und Safety Copies | Platform | Instanzweite Sicherung mit gemischten Produktdaten. | hoch |
| `data/backups/schedule.json` | Auto-Backup-Schalter und Frequenz | Platform | Vom Studio-Setting gespiegelt und vom Hostskript gelesen. | hoch |
| `exports/<world>-static/` bzw. konfiguriertes Export-Root | Statische player-safe HTML/CSS/JS/Search-Ausgabe | Portal | Nur veröffentlichte player/public Projektion; `dm_only` ausgeschlossen. | hoch |
| `data/mail/schedule.json` | Auto-Sync-Konfiguration | Brain | Persönliche Mailautomation. | hoch |
| `data/mail/outbound/<opaque-id>/<filename>` | Temporäre ausgehende Mailanhänge | Brain | Private Kommunikationsdateien; nach erfolgreichem Versand löschbar. | hoch |
| `data/briefings/schedule.json` | Morning-Briefing-Zeitplan | Brain | Owner-private Automation. | hoch |
| Konfiguriertes `UWE_RATE_LIMIT_DIR` | Optionaler file-backed Rate-Limit-State | Platform | Security-/Betriebszustand, standardmäßig in-memory. | hoch |

Im Repository existieren aktuell nur `data/uploads/.gitkeep`, `data/backups/.gitkeep` und `exports/.gitkeep`; Laufzeitdaten sind nicht versioniert.

### 6.2 Aktive Linux-Hoststruktur

| Pfad | Zweck | Zuordnung | Begründung | Konfidenz |
|---|---|---|---|---|
| `/opt/uwe` | Installierter Code/Workspace | Platform | Laufzeitinstallation, keine persistente Produkt-Source-of-Truth. | hoch |
| `/etc/uwe/uwe.env` | Hostkonfiguration und Referenzen auf Zugangsdaten | Platform | Muss root-/gruppenbeschränkt bleiben; keine Produktinhalte. | hoch |
| `/var/lib/uwe/uwe.db` | Produktions-SQLite-DB | Platform | Physisch gemeinsam, logisch hochsensitiv gemischt. | hoch |
| `/var/lib/uwe/uploads/` | Upload-Root | Platform | Physischer Container; Zielpartitionen müssen Studio (`<worldId>`) und Brain (`_capture`, `_scan`, künftig eigene Roots) trennen. | mittel |
| `/var/lib/uwe/exports/` | Statische Exporte | Portal | Player-safe Ausgabe. | hoch |
| `/var/lib/uwe/cache/` | Node-/Build-/Runtimecache (`XDG_CACHE_HOME`) | Platform | Betriebsdaten. | hoch |
| `/var/lib/uwe/mail/` | Mail-Schedule und outbound Attachments | Brain | Owner-private Kommunikation. | hoch |
| `/var/lib/uwe/briefings/` | Briefing-Schedule | Brain | Owner-private Automation. | hoch |
| `/var/lib/uwe/rtx-connector/` | Connector `config.json`, `model-store.json`, `printer-store.json`, `job-history.json`, `connector.log`, lokale Spotify-Session und optionale Modell-Downloads | Platform | Lokale Worker-Metadaten; laut Design keine Welt-/Brain-Source-of-Truth. | hoch |
| `/var/lib/uwe/host-update-request.json`, `host-update-state.json`, `host-update.lock` | Host-Update-Steuerung | Platform | Betriebszustand. | hoch |
| `/var/backups/uwe/` | Aktiver Setup-Default für Host-Backups | Platform | Vom Setup als separates, restriktives Backup-Root gesetzt. | hoch |
| `/var/lib/uwe/backups/` | In Architektur/Production-/Backup-Doku genannter alternativer/älterer Backup-Pfad | Platform | Dokumentationsabweichung zum aktiven Setup-Default; vor Migration kanonisieren. | mittel |
| `/var/log/uwe/` | Host-/Update-Logs | Platform | Betriebs- und Security-Telemetrie. | hoch |
| `/var/log/uwe/diagnostics/` | Host-/AI-Diagnoseberichte | Platform | Kann Systemdetails enthalten; restriktive Rechte. | hoch |

## 7. Jobs, Runner und Timer

### 7.1 Persistente `JobType`-Queue (14)

Quelle: `packages/database/prisma/schema.prisma`, Ausführung: `apps/studio/src/lib/job-runners.ts` und `integration-job-runners.ts`.

| Pfad/Jobtyp | Zweck | Zuordnung | Begründung | Konfidenz |
|---|---|---|---|---|
| `schema.prisma#JobType.mail_send` | Mail versenden | Brain | Persönliche Kommunikation. | hoch |
| `schema.prisma#JobType.mail_sync` | IMAP-Postfach synchronisieren/triagieren | Brain | Private Maildaten. | hoch |
| `schema.prisma#JobType.ai_run` | D&D-Aktion, Page Review, deferred Prompt oder Capture-Triage | Studio | Primärer D&D-Run; persönliche Varianten im selben Typ müssen in Brain-Typen getrennt werden. | niedrig |
| `schema.prisma#JobType.embedding` | D&D- oder Personal-Brain-Dokument indexieren | Brain | Der Personal-Brain-Zweig ist die härtere Grenze; eigener Studio-Embedding-Typ erforderlich. | niedrig |
| `schema.prisma#JobType.reindex` | D&D-Brain einer Welt neu indexieren | Studio | Weltgebundener D&D-Index. | hoch |
| `schema.prisma#JobType.import` | KnoteForge/Markdown-Inhalte in Welt importieren | Studio | D&D-Authoring mit Undo. | hoch |
| `schema.prisma#JobType.backup` | Instanz-/Weltbackup erzeugen | Platform | Infrastruktur; enthält potenziell alle Produktdaten. | hoch |
| `schema.prisma#JobType.backup_restore` | Safety Copy und Restore | Platform | Instanzweite Persistenzoperation. | hoch |
| `schema.prisma#JobType.canon_check` | Welt auf Canon-/Safety-Befunde prüfen | Studio | D&D-Review. | hoch |
| `schema.prisma#JobType.image_studio` | Bild generieren/editieren und als Asset ablegen | Studio | D&D-Authoring; private Ziele sind als Brain-Adapter zu trennen. | mittel |
| `schema.prisma#JobType.agent_job` | Entwicklungsagent dispatchen | Platform | Repo-Automation. | hoch |
| `schema.prisma#JobType.calendar_sync` | CalDAV/iCal, Session- und Vertragsfristen syncen | Brain | Externe Credentials und persönliche Termine; Welttermine benötigen Studio-Adapter. | mittel |
| `schema.prisma#JobType.research` | Websuche und KI-Synthese mit D&D-/Life-/Open-Web-Kontext | Brain | `life_brain` erzwingt local-only; D&D-Research ist separat zu routen. | niedrig |
| `schema.prisma#JobType.briefing` | Persönliches Morning Briefing erstellen | Brain | Owner-private Fakten/News und Personal-Brain-Ziel. | hoch |

### 7.2 Job- und Connector-Verträge

| Pfad | Zweck | Zuordnung | Begründung | Konfidenz |
|---|---|---|---|---|
| `packages/database/src/job-service.ts` | Persistente Queue, Status, Retry, Recovery und Logs | Platform | Produktübergreifender Queue-Store. | hoch |
| `apps/studio/src/lib/job-executor.ts` | In-process Fire-and-forget-Ausführung, Boot-Recovery und Dispatch | Platform | Orchestrierung gehört Platform, liegt aber heute physisch im Studio-Prozess. | hoch |
| `apps/studio/src/lib/job-runners.ts` | Backup, Import, D&D-/Personal-Brain-KI, Mail, Embeddings, Canon und Restore | Platform | Aktueller gemischter Dispatcher; direkter Zugriff auf private Produktdaten macht ihn zu einer kritischen Split-Naht, nicht zu SharedEngine. | niedrig |
| `apps/studio/src/lib/integration-job-runners.ts` | Image, Agent, Mail-Sync, Research, Briefing, Calendar-Sync | Platform | Ebenfalls gemischter Dispatcher; fachliche Runner müssen nach Studio/Brain verschoben werden. | niedrig |
| `apps/studio/app/api/jobs/**`, `apps/studio/src/lib/job-api-handlers.ts` | Enqueue/List/Retry/Cancel und optionales synchrones Warten | Platform | Generische Queue-API; künftig keine produktfremden Payloads akzeptieren. | hoch |
| `packages/agent-jobs` | Provider `github_actions`, `cursor_cloud`, manueller `cursor_cli_local` | Platform | Entwicklungsautomation; Presets verbieten Welt-, Brain- und Zugangsdaten. | hoch |
| `packages/agent-jobs/src/presets.ts` | `backlog_package`, `bugfix`, `docs_sync`, `test_hardening`, `security_check`, `refactor_cleanup` | Platform | Reine Repo-Prompt-Templates, kein Kampagnen-/Personal-Kontext. | hoch |
| `packages/database/src/agent-job-service.ts`, `apps/studio/app/api/agent-jobs/**` | DevAgentJob-Persistenz, Dispatch, Polling und Callback | Platform | Repo-Automation; kein Auto-Merge. | hoch |
| `schema.prisma#ConnectorJobType` | `sound_*`, `spotify_*`, `llm_generate`, `image_generate`, `embedding_generate`, `vision_extract`, `connector_refresh_models`, `label_print`, `printer_discover` | Platform | Transport-/Capability-Vertrag zum outbound Worker; Produktkontext muss vor Enqueue geprüft/minimiert werden. | hoch |
| `tools/uwe-rtx-connector` | Claims, Ausführung und Ergebnisrückgabe von Connector Jobs | Platform | Lokaler Worker ohne UWE-Source-of-Truth. | hoch |

Der Runner ist kein separater Daemon: `enqueueAndDispatch` startet Jobs im Studio-Node-Prozess; beim Boot werden `running`-Jobs als unterbrochen markiert und `pending`-Jobs neu dispatched. Das koppelt heute die Verfügbarkeit aller Brain-/Platform-Jobs an Studio.

### 7.3 Geplante systemd-Timer (vollständig)

| Pfad | Schedule/Zweck | Zuordnung | Begründung | Konfidenz |
|---|---|---|---|---|
| `deploy/systemd/uwe-backup.timer` + `.service` | täglich 03:15, persistent, bis zu 15 Minuten Zufallsverzögerung; ruft `deploy/scripts/uwe-backup.sh` | Platform | Instanzweite Sicherung. | hoch |
| `deploy/systemd/uwe-healthcheck.timer` + `.service` | 2 Minuten nach Boot und danach alle 2 Minuten; Liveness/Restart | Platform | Hostbetrieb. | hoch |
| `deploy/systemd/uwe-nightly-restart.timer` + `.service` | täglich 04:10, persistent, bis zu 5 Minuten Zufallsverzögerung | Platform | Betriebssicherheitsnetz. | hoch |
| `deploy/systemd/uwe-mail-sync.timer` + `.service` | alle 5 Minuten; Skript prüft den in UWE konfigurierten Intervallplan | Brain | Persönlicher IMAP-Sync. | hoch |
| `deploy/systemd/uwe-briefing.timer` + `.service` | alle 15 Minuten; Skript prüft die konfigurierte Briefing-Zeit | Brain | Owner-private Morning-Briefing-Automation. | hoch |

`deploy/systemd/uwe.service`, `uwe-rtx-connector.service` und `uwe-host-command-center.service` sind langlebige Platform-Services; `uwe-host-update.service` wird explizit getriggert und besitzt keinen Timer.

### 7.4 Auto-Backup-Scheduler

| Pfad | Zweck | Zuordnung | Begründung | Konfidenz |
|---|---|---|---|---|
| `apps/studio/app/api/backup/schedule/route.ts` | Schedule lesen/ändern | Platform | Betriebs-API, derzeit im Studio gehostet. | hoch |
| `apps/studio/src/lib/backup-schedule-sync.ts` | DB-Setting `autoBackupEnabled` nach `schedule.json` spiegeln; derzeit immer Frequenz `daily` | Platform | Bridge von Settings zu Host. | hoch |
| `packages/backup/src/schedule.ts` | Validiertes Lesen/Schreiben von `enabled` und `daily|weekly|monthly` | Platform | Wiederverwendbare Betriebslogik mit Dateizugriff. | hoch |
| `deploy/scripts/uwe-backup.sh` | Liest Schedule, überspringt deaktiviert/zu früh, führt Backup-CLI aus | Platform | Hostseitige Ausführung. | hoch |
| `deploy/systemd/uwe-backup.timer` | Täglicher Trigger; Wochen-/Monatsfrequenz wird im Skript über Alter des letzten ZIPs gegated | Platform | systemd bleibt täglicher Wecker, Schedule entscheidet effektiv. | hoch |

## 8. Strittige Zuordnungen

| Pfad/Bereich | Vorläufige Zuordnung | Entscheidungsbedarf | Risiko bei falscher Grenze |
|---|---|---|---|
| `docs/life-brain-privacy.md` und Architektur-Skill vs. `SECURITY.md` | `SECURITY.md` gilt | Alte Aussagen „D&D-Brain lokal-only/kein Cloudkontext" an W0-Atlas-Policy angleichen; Personal Brain bleibt unverändert local-only. | Policy-Drift, unerwartete Cloudroute oder unnötige Funktionssperre. |
| `apps/studio/app/search`, `searchStudioCrossDomain` | Brain | Separate Studio-Weltsuche und Brain-Privatsuche oder owner-only föderierte Ergebnis-API definieren. | Gemeinsamer privater Datenzugriff; Leakage über Snippets/Counts. |
| `Character`, `CharacterSpell`, `PartyTreasury`, `InventoryItem` | Portal | Festlegen, welche Felder Spieler schreiben dürfen und welche Studio/DM besitzt. | Portal wird zu breit schreibend oder DM verliert administrative Kontrolle. |
| Weltbezogene `MailTemplate`/`MailRecipient*`/`MailDraft` | Brain | Kampagnenmail als Studio-Adapter auf Brain-Mail-Engine oder vollständig Studio-eigene Versandprojektion? | Personen-/Maildaten gelangen in Studio-/Cloud-Kontext. |
| `CalendarEvent`/Calendar Services | Brain | Persönliche/externe Events von D&D-Session-/Weltterminen physisch/logisch trennen. | Kalender-Credentials oder private Termine werden Studio sichtbar. |
| `ImageStudioLink` und Image-Studio-Jobs | Studio | Brain-Ziele (`capture`, `workshop_project`, `hardware_device`, `contract_expense`) in separaten Adapter/Store verschieben. | Studio-Service erhält Zugriff auf private Brain-Entitäten. |
| `ImportJob`/Import-Zentrale | Platform/Studio | Jobhülle Platform; `personal_brain`-, `capture`- und D&D-Targets benötigen getrennte Schemas/Handler. | Preview-Payload mischt private Inhalte in gemeinsamer Queue. |
| `ResearchSession`/`ResearchSource` | Brain | D&D-Research von Life-Brain/Open-Web-Research trennen; unterschiedliche Gateway Policies explizit typisieren. | Personal Brain könnte über D&D-Cloudpolicy geroutet werden. |
| `Tag`/`EntityTag` | Platform | Globale Taxonomie in Studio-/Brain-Namespaces oder streng autorisierte zentrale Registry teilen. | Tag-Suche/Counts offenbaren private Entity-Existenz. |
| `packages/cookbook`, `/admin/cookbook` | Brain | Lokale Modellberatung (Brain) von Host-/Runtime-Diagnose (Platform) trennen. | Platform erhält persönliche Modellnutzung oder Brain Hostrechte. |
| `data/uploads/<worldId>` | Studio | Eigene Brain-Uploadroots für Projekt-/Bug-/Miniatur-/Workshopdateien einführen. | Pfad-/Backup-/Assetberechtigungen vermischen private und player-fähige Medien. |
| `/var/backups/uwe` vs. `/var/lib/uwe/backups` | Platform | Einen aktiven kanonischen Pfad in Setup, Doku, Health und Restore festlegen. | Scheduler/Restore/Health sehen unterschiedliche Sicherungen. |
| `ActivityLog`, `/admin/cockpit` | Studio bzw. Brain | Fachliche Content-Aktivität, Security-Audit und owner-private Unified Activity getrennt modellieren. | Ein gemeinsamer Feed leakt private Titel/Links über Produktgrenzen. |

## 9. Gemeinsame Hotspots

| Hotspot | Ist-Zustand | Erforderliche Split-Grenze |
|---|---|---|
| Shared Schema/DB | Eine Prisma-Datei und eine DB enthalten Auth, D&D, Portal und hochprivate Brain-Daten. | Mindestens getrennte Service-/Repository-Interfaces und DB-Rollen; bevorzugt getrennte Brain-Persistenz/Backups. Keine generischen Prisma-Clients in App-Routen. |
| IPC/API-Verträge | Next-Routen, `Job.payload`, `ConnectorJob.payload`, Share APIs und Static Export transportieren heterogene Kontexte. | Produktgetaggte, validierte Contracts; Personal-Brain-Typen dürfen Cloud-/Portal-Verträge nicht implementieren. |
| Session/Auth | `User`, `Session`, Cookie, 2FA und Route Policy sind gemeinsam; Brain braucht owner-only. | Platform-Session beibehalten, aber Brain-Audience/Owner-Guard als verpflichtende zweite Policy-Schicht. |
| Navigation | `studio-nav.ts` komponiert Studio-, Brain- und Platform-Ziele in einer Shell. | Drei Produktnavigationen; gemeinsame Nav-Typen bleiben in `@uwe/shared-utils/navigation`. |
| AI-Router | Ein Router bedient allgemeine, D&D- und Personal-Kontexte; Jobtypen/Runs sind teils gemischt. | Hart typisierte Context Contracts: Personal Brain nur lokaler Provider; D&D nach Gateway-Policy; `dm_only` immer vor Route strippen. |
| Jobs | Queue/Runner laufen im Studio-Prozess und greifen direkt auf Studio-, Brain- und Platform-Services zu. | Platform Queue/Worker-Supervision; fachliche Runner je Produkt, getrennte Payloadschemas und Datenzugriffs-Credentials. |
| Storage | DB, Uploadroot und Backups sind physisch gemeinsam; Admin-Medien nutzen teils Welt-Assetpfade. | Produktroots, separate Retention/Backup-Policies, player-safe Export als einseitige Projektion. |
| Deploy | `uwe.service` startet Studio + Portal gemeinsam; Brain existiert nicht als eigener Dienst. | Brain standardmäßig nur localhost/LAN, nie im öffentlichen Tunnel; Health/Backup/Update als Platform-Services. |
| Static Export/Cross-App-Grenze | `packages/static-export/src/assets.ts` liest CSS direkt aus `apps/portal/app/wiki.css`. | Player-safe Styles/Renderer in ein Package verschieben. Es gibt keinen offensichtlichen App-zu-App-Modulimport, aber diese Package→App-Dateiabhängigkeit verletzt die gewünschte Richtung. |
| Portal Safety | Portal und Export lesen dieselbe D&D-Quelle wie Studio. | Nur serverseitig gefilterte Read Models; Leak-Tests für Seiten, Blöcke, Assets, Graph, Suche, Share und Export beibehalten/erweitern. |

## 10. Kennzahlen

### 10.1 Routen nach Zielprodukt

| Ziel | Seiten | API-Routen | Gesamt |
|---|---:|---:|---:|
| Portal | 27 | 6 | **33** |
| Studio | 65 | 59 | **124** |
| Brain | 36 | 52 | **88** |
| Platform | 53 | 111 | **164** |
| SharedEngine | 0 | 0 | **0** |
| **Gesamt** | **181** | **228** | **409** |

Platform-Seiten/APIs umfassen dabei 47/93 aus dem Studio-Baum und 6/18 aus dem Portal-Baum. Die 33 Portal-Routen sind fachliche Portal-Routen; Auth/Health/Account wurden Platform zugerechnet.

### 10.2 Prisma-Modelle nach Zielprodukt

| Ziel | Modelle |
|---|---:|
| Portal | **12** |
| Studio | **50** |
| Brain | **45** |
| Platform | **33** |
| SharedEngine | **1** |
| **Gesamt** | **141** |

### 10.3 Weitere Inventarzahlen

| Bereich | Anzahl/Verteilung |
|---|---|
| Apps | 3: Portal 1, Studio 1, Platform 1 |
| Packages | 34: Portal 2, Studio 4, Brain 4, Platform 11, SharedEngine 13 |
| Tools | 2: beide Platform |
| Persistente `JobType`-Werte | 14 |
| `ConnectorJobType`-Werte | 15 |
| systemd-Timer | 5 |

## 11. Übergaben an nachfolgende Tasks

1. Zuerst Produktcontracts für Auth-Audience, AI-Context, Jobs und Storage definieren; erst danach Routen verschieben.
2. Brain benötigt eine eigene owner-only App-/Service-Grenze und lokale Exposure-Defaults, bevor persönliche Studio-Routen migriert werden.
3. D&D-`BrainDocument`/`BrainFact` bleiben Studio; `PersonalBrain*` und deren Chunks/Embeddings dürfen weder Tabellen, Indexer noch Jobpayloads mit D&D teilen.
4. Portal bekommt ausschließlich player-safe Read Models plus eng definierte Writes für Notizen, Fragen, Availability, Quest Flags, Charaktere und Schatz.
5. Platform übernimmt Session/Auth, Gateway Policy, Queue-Supervision, Connector, Deploy und Backups, aber keine generischen privaten Repository-Zugriffe.
6. SharedEngine-Pakete müssen I/O-/DB-frei oder über vom Produkt bereitgestellte, eng geschnittene Ports arbeiten.
7. Vor dem Routensplit die Package→Portal-CSS-Abhängigkeit im Static Export und die gemischten Upload-/Backup-Pfade beseitigen.
