# UI-Assessment: Alle navigierbaren Seiten (Studio + Portal)

> Stand: 2026-07-10 · Methode: statische Code-Analyse (page.tsx + zentrale Komponenten) durch parallele Review-Agents · Skala 1–10
> (1–3 chaotisch/kaputt wirkend · 4–5 funktional aber unübersichtlich · 6–7 solide mit Schwächen · 8–9 gut aufgeteilt & konsistent · 10 vorbildlich)

**181 Seiten bewertet · Gesamtdurchschnitt Ø 6.8**

Design-System-Verteilung: gemischt: 136 · v2: 19 · legacy: 15 · unklar: 11

Rating-Verteilung: 4→5× · 5→15× · 6→38× · 7→76× · 8→44× · 9→3×

## Globale Shell & Navigation (übergreifend)

Die gemeinsame `AppShell` (packages/shared-ui) ist ein klarer Pluspunkt des Gesamtsystems: Sidebar mit Einklapp-Zustand (persistiert in localStorage), optionales Icon-Rail, Topbar, Kontext-Panel, mobile Bottom-Nav, Fokus-Trap und Skip-Link — solide Accessibility-Grundlage. Die Welt-Navigation ist kanonisch in `apps/studio/src/lib/studio-navigation.ts` definiert (gruppierte Sidebar-Sektionen, Cockpit-Tabs, Breadcrumbs, Command-Palette). **Bewertung Shell: 8/10.**

**Übergreifende Schwachstelle (Discoverability):** Laut `STUDIO_PALETTE_EXTRA` sind mehrere Seiten (Kitchen-Unterseiten, Workshop-Verleih/Druckprofile, Audit-Log, Health, Version, NL Command Center, Mail-Compose, Life Brain, Brain Store) **nur über die Command-Palette** erreichbar, nicht über die Sidebar-IA. Wer die Palette nicht kennt, findet diese Bereiche nicht. Zweitens zieht sich der Mix aus V2-Design-System und Legacy-Klassen (`uwe-*`) als häufigste Einzelschwäche durch fast alle Bereiche.

## Die 15 größten Verbesserungskandidaten (niedrigstes Rating zuerst)

| # | Route | Rating | Bereich | Kernproblem |
|---|-------|--------|---------|-------------|
| 1 | `/jobs` | **4** | Studio: Daily Admin OS B (Finanzen, Haushalt, Projekte, Ideen) | Kern-Layoutklassen (uwe-jobs-layout, -list, -detail, -toolbar, -list-item, -log-list) sind in keiner CSS-Datei definiert — das Master-Detail-Layout zerfällt zu ungestylten, gestapelten Blöcken |
| 2 | `/workshop/recipes` | **4** | Studio: Image Studio, Workshop & Miniatures | Jedes Bibliothekselement ist ein komplettes 11-Felder-Edit-Formular — bei 200er-Limit eine unscanbare Formularwand ohne Lese-Ansicht |
| 3 | `/worlds/[worldSlug]/labels/print` | **4** | Studio Worlds: Labels & Print (Etiketten, Print-Center, Charakterdruck) | Die Haupt-Sektion ist eine Meta-Tabelle, die interne Routen und API-Pfade als Code erklärt — Entwickler-Doku statt Nutzerfunktion |
| 4 | `/worlds/[worldSlug]/assets` | **4** | Studio Worlds: Verwaltung (Assets, Backup, Import, AI-Runs, Brain, DnD-API) | Dieselbe Asset-Liste wird viermal gerendert (Tabelle, Bearbeiten-Details, Freigabe-Details, Batch-Toolbar) — Bearbeiten eines Assets erfordert erneutes Suchen am Seitenende |
| 5 | `/maintenance` | **4** | Portal: Öffentlich & Einstieg (Login, Weltliste, Share-Links) | Die Klassen uwe-page und uwe-page-centered sind in keinem CSS des Repos definiert — die Zentrierung existiert nicht, der Card klebt unstrukturiert oben links |
| 6 | `/logout` | **5** | Studio: Auth, Account & Basis | Fehler-Branch nutzt Legacy-Klassen (uwe-page/uwe-card/uwe-auth-message), der Ladezustand das moderne Kit — Stilbruch auf einer Mini-Seite |
| 7 | `/contracts` | **5** | Studio: Daily Admin OS A (Today, Kalender, Capture, Scan, Dokumente) | IA-Reihenfolge fragwürdig: die KI-Kosten-Nische dominiert den Seitenanfang, die eigentliche Vertragsliste kommt erst nach drei Karten und einem Formular |
| 8 | `/hardware` | **5** | Studio: Daily Admin OS B (Finanzen, Haushalt, Projekte, Ideen) | Geräte-Karten massiv überladen: 12-Felder-Edit-Formular, Fehler-Formular, Setup-Schritte und Löschen dauerhaft ausgeklappt in jeder Karte |
| 9 | `/workshop/[id]` | **5** | Studio: Image Studio, Workshop & Miniatures | Edit-first statt read-first: Ein ~20-Felder-Formular dominiert die Seite, die lesbare Übersicht kommt erst danach — dieselben Daten erscheinen doppelt |
| 10 | `/workshop/rental` | **5** | Studio: Image Studio, Workshop & Miniatures | Gleiches Formularwand-Anti-Pattern: Jedes Set ist ein 12-Felder-Edit-Formular, die scanbare Zusammenfassung (Status, Miete, Kaution) steht erst am Formular-Ende |
| 11 | `/admin/agent-jobs` | **5** | Studio: Admin A (Übersicht, Aktivität, AI, Tokens) | Die Verlaufs-Klassen uwe-list-cards/uwe-list-card sind in keinem CSS definiert — der Kerninhalt rendert als ungestylte Browser-Liste, Badges und Texte laufen zusammen |
| 12 | `/admin/reviews` | **5** | Studio: Admin B (Checklist, Cockpit, Migrations, Rollen) | Kein Empty State: bei 0 Treffern bleibt eine leere Tabelle ohne jeden Hinweis stehen |
| 13 | `/system/printers` | **5** | Studio: System (Health, Host-Control, Printers, Navigation, ...) | Drucker und Jobs als nackte <p>-Zeilen ohne Status-Badges, Farben oder Aktionen — die Queue-Statuslabels bleiben reiner Text |
| 14 | `/worlds/[worldSlug]/soundboard` | **5** | Studio Worlds: Sessions & Vorbereitung (Live, Review, One-Shot, Soundboard) | Fünf gestapelte Sektionen ohne Priorisierung; Bearbeiten als komplettes Formular in einem <details> innerhalb einer Tabellenzelle ist unübersichtlich und mobil kaum nutzbar |
| 15 | `/worlds/[worldSlug]/dungeons/[dungeonSlug]/ebenen/[levelSlug]` | **5** | Studio Worlds: Dungeons, Magic Items, Roll Tables, Treasury | Räume doppelt gerendert: "Raum-Übersicht" (Cards) und "Räume" (Tabelle) zeigen exakt dieselben Daten — bei 0 Räumen erscheint der Empty State sogar zweimal |

## Die 10 besten Seiten (als Referenz für Verbesserungen)

| Route | Rating | Bereich | Warum gut |
|-------|--------|---------|-----------|
| `/login` | **9** | Studio: Auth, Account & Basis | Sehr vollständige Zustände: Loading, Fehler (inkl. JSON-Parse- und Netzwerkfehler), Reset-Erfolgsmeldung, Forbidden-Hinweis, Turnstile-Token-Refresh nach Fehlversuch |
| `/system/command-center` | **9** | Studio: System (Health, Host-Control, Printers, Navigation, ...) | Vorbildliche Zustände: Stale-Kennzeichnung bei fehlgeschlagenem Refresh, In-Flight-Guard, Polling pausiert bei verstecktem Tab, manueller Refresh-Button |
| `/login` | **9** | Portal: Öffentlich & Einstieg (Login, Weltliste, Share-Links) | Sehr vollständige Zustände: Loading, Fehler, reset=success-Banner, forbidden-Hinweis, 2FA-Subview mit Zurück-Button, Suspense-Fallback |
| `/` | **8** | Studio: Top-Level Hubs & Templates (Root, Studio, Portal, Backup, Import, Settings, Templates) | Klare Zwei-Wege-IA (Studio für GM, Portal für Spieler) mit Rollen-Badges, Feature-Bullets und deutlich unterschiedlichen Karten-Farbwelten |
| `/studio` | **8** | Studio: Top-Level Hubs & Templates (Root, Studio, Portal, Backup, Import, Settings, Templates) | Query-String wird vollständig übernommen (auch Array-Parameter) — Deep-Links wie ?world=… überleben die IA-Konsolidierung |
| `/setup` | **8** | Studio: Auth, Account & Basis | Klarer Wizard mit Fortschrittsanzeige (aria-current), gegateten Weiter-Buttons und pro Schritt wechselnder Beschreibung |
| `/today` | **8** | Studio: Daily Admin OS A (Today, Kalender, Capture, Scan, Dokumente) | Widget-System (DashboardWidgetGrid) mit eigenem Empty State und Deep-Link pro Widget — inkl. positivem "Alles erledigt"-Zustand über isTodayDashboardAllClear |
| `/capture` | **8** | Studio: Daily Admin OS A (Today, Kalender, Capture, Scan, Dokumente) | Durchdachte Listen-UX: Status-Tabs (Inbox/Archiv/Alle) plus Quellen-Tabs (Manuell/Mail/Scan), Bulk-Auswahl mit "Alle auswählen" und Zähler im Archiv-Button |
| `/capture/[id]` | **8** | Studio: Daily Admin OS A (Today, Kalender, Capture, Scan, Dokumente) | ViewEditToggle trennt Lese-Ansicht (inkl. Audio-Player für Sprachmemos, Anhang-Link) sauber von der Triage-Ansicht |
| `/finance` | **8** | Studio: Daily Admin OS B (Finanzen, Haushalt, Projekte, Ideen) | Klare Sektionsgliederung in v2-Cards mit Stat-Grid für KPIs und Zeitraum-Chips inkl. aria-current |

## Bereichsübersicht

| Bereich | Seiten | Ø | Fazit |
|---------|--------|---|-------|
| Studio: Top-Level Hubs & Templates (Root, Studio, Portal, Backup, Import, Settings, Templates) | 9 | **6.9** | Die Top-Level-Hubs sind funktional durchdacht — Rollen-Gating, Preview-vor-Restore, Job-Verlauf mit Rollback und saubere Redirect-Konsolidierung (/studio → /today) zeugen von guter Flow-Planung. Optisch ist die Gruppe aber dreigeteilt: Legacy-Panels (uwe-panel/uwe-form), v2-Buttons und Tailwind-Utilities mischen sich auf fast jeder Seite, dazu viele Inline-Styles statt Systemklassen. Größte Baustellen sind der 963-Zeilen-Settings-Monolith mit Deutsch/Englisch-Sprachmix und die Mobile-Tauglichkeit (Tabellen ohne Overflow-Wrapper, nicht-responsives Editor-Grid). |
| Studio: Auth, Account & Basis | 9 | **6.9** | Die Auth-Kernflüsse (Login, Setup-Wizard, Forgot/Reset) sind die stärksten Seiten der Gruppe: konsistent auf dem token-basierten ui-Kit in der StudioAuthShell, mit überdurchschnittlich vollständigen Zuständen und guter Formular-Semantik. Die Account- und Randseiten (Passwort ändern, Logout, Maintenance, Security-Tabelle) fallen ab, weil sie Legacy-CSS in moderne Shells mischen und dadurch sichtbare Stilbrüche erzeugen. Wiederkehrendes technisches Muster mit UX-Folge: fetch-Aufrufe ohne try/catch, die bei Netzwerkfehlern Buttons dauerhaft im Ladezustand hängen lassen — plus zwei echte Lücken bei 2FA-Recovery-Codes und dem irreführenden Setup-Fallback. |
| Studio: Daily Admin OS A (Today, Kalender, Capture, Scan, Dokumente) | 8 | **6.9** | Die Daily-Admin-Gruppe ist funktional reich und in den Kern-Flows (Today-Widgets, Capture-Triage, Scan-Workflow) mit durchdachten Zuständen gebaut — Empty States, statusgetriebene Buttons und KI-Review-Muster sind klar überdurchschnittlich. Das wiederkehrende UX-Problem ist überall dasselbe: Erfassungs- und Edit-Formulare stehen vor dem eigentlichen Inhalt bzw. bleiben permanent offen (Calendar, Documents, Contracts), was Seiten lang und unübersichtlich macht. Keine Seite ist reines V2 — durchgängig mischen sich uwe-v2-Klassen mit Legacy-Klassen (uwe-dashboard-*, uwe-brain-create-form, uwe-badge), Inline-Styles und vereinzelt Tailwind, sodass eine Konsolidierung auf CardV2/ButtonV2 plus Abstands-Klassen der wirksamste Querschnitts-Hebel wäre. |
| Studio: Daily Admin OS B (Finanzen, Haushalt, Projekte, Ideen) | 8 | **6.5** | Die Daily-Admin-Seiten sind funktional reich und überraschend konsequent bei Zuständen: fast überall gibt es Empty-States, Busy-Labels, Fehleranzeigen mit role=alert und erklärte disabled-Buttons. Das Design-System ist jedoch durchgehend gemischt (v2-Cards/-Buttons plus Legacy- und App-lokale Klassen), und zwei Seiten nutzen Layout-Klassen, die in keiner CSS-Datei existieren (uwe-jobs-*, uwe-list-card) — dort zerfällt das intendierte Layout. Wiederkehrende Muster mit größtem Hebel: destruktive Aktionen ohne Bestätigung, data-severity="warn" als Aktiv-Zustand-Ersatz und Inline-Styles statt Systemklassen. |
| Studio: Kitchen (Küche, Vorrat, Plan, Rezepte, Einkauf) | 6 | **6.8** | Die Kitchen-Gruppe ist funktional erstaunlich reif — URL-basierte Filter, KI-Draft-Flow mit explizitem Opt-in, Offline-Sync und Druckansicht zeigen echtes Nachdenken über Nutzungsszenarien. Stilistisch ist sie aber durchgehend ein Mix: V2-Buttons/Cards/Badges neben Legacy-Klassen (uwe-today-*, uwe-brain-create-form, uwe-badge) und vielen Inline-Styles, dazu Icon-Buttons ohne aria-labels. Die größten Hebel liegen in der Trennung von Lese- und Edit-Modus im Rezept-Detail, einem kompakteren Wochenplan-Layout und der Priorisierung des Kerninhalts auf der Einkaufsseite. |
| Studio: Wissen & Kommunikation (Knowledge, Mail, Suche, Prompts, Command, AI) | 8 | **7.0** | Eine funktional starke Gruppe mit zwei Leuchttürmen: Das Mail Center ist ein vollwertiger 3-Spalten-Mail-Client mit eigenem Mobile-Konzept, und das Command Center zeigt einen vorbildlichen Parse-Bestätigen-Ausführen-Flow mit Audit-Trail. Durchgängige Schwäche ist die Stil-Fragmentierung: Praktisch jede Seite mischt v2-Klassen, Legacy-Helfer (uwe-dashboard-*, uwe-btn), Tailwind-Utilities und Inline-Styles — teils drei Ansätze in einer Datei. Die Formular-UX (Prompts, Compose) hinkt den Lese-Ansichten hinterher: unstrukturierte Felder, fehlende Lösch-Bestätigung, undifferenziertes Status-Feedback. |
| Studio: Life-Brain & Brain | 5 | **6.6** | Die Life-Brain-Gruppe ist funktional erstaunlich reif — Zugriffs-Gates, Maschinenraum-Status-Differenzierung, Such-Feedback und Empty States sind fast überall vorhanden und konkret formuliert. Durchgängige Schwächen sind der Mischzustand aus v2-Klassen, Legacy-Klassen (uwe-today-card, uwe-form-grid) und Inline-Styles, der zweckentfremdete Fehler-Stil für Privacy-Hinweise sowie Lösch-Aktionen ohne Bestätigung auf beiden Detailseiten. Die /brain-Übersicht fällt gestalterisch ab (Legacy-lastig, nutzlose Sidebar-Legende) und die Fakt-Detailseite hinkt der Dokument-Seite funktional hinterher. |
| Studio: Image Studio, Workshop & Miniatures | 9 | **6.0** | Die Gruppe hat eine durchgängig solide Informationsarchitektur (Breadcrumbs, EmptyStates, Filter-Chips, klare PageHeader), aber zwei systemische Schwächen: Erstens rendern mehrere Bibliotheksseiten (Recipes, Rental, Miniatures) jedes Listenelement als komplettes Inline-Edit-Formular, was bei mehr als einer Handvoll Einträgen zu einer unscanbaren Formularwand führt. Zweitens sind alle Seiten Design-System-gemischt (uwe-v2-* neben Legacy-Klassen wie uwe-today-card/uwe-brain-create-form), und im Image Studio werden sogar nirgends definierte CSS-Klassen (uwe-list-cards, uwe-kv-list) verwendet — die Projekt- und Versionslisten eines Bild-Tools zeigen zudem keine Bild-Thumbnails. |
| Studio: Admin A (Übersicht, Aktivität, AI, Tokens) | 7 | **7.0** | Die Admin-A-Gruppe steht auf einem einheitlichen Gerüst (SystemShell + BreadcrumbTrail + PageHeader) und deckt Loading-/Fehler-/Empty-Zustände überwiegend sauber ab — die Workspaces für Aktivität, Tokens und Audit sind funktional durchdacht. Jede Seite mischt jedoch V2-CSS-Klassen mit Legacy-uwe.css-Klassen und Inline-Styles, was die visuelle Konsistenz untergräbt. Konkrete Detailfehler drücken die Politur: nirgends definierte CSS-Klassen (Agent-Jobs-Verlauf), ein ignorierter Deep-Link-Filter (?source=audit), fehlende Bestätigungen und Pending-Zustände bei destruktiven bzw. sofort speichernden Aktionen. |
| Studio: Admin B (Checklist, Cockpit, Migrations, Rollen) | 7 | **6.9** | Die Admin-B-Gruppe ist durchweg solide gebaut: identisches Grundgerüst (SystemShell, Breadcrumb, PageHeader mit HealthBadge), klare Sektionsgliederung und bei Migrations und Secrets vorbildliche Zustandslogik mit konditionalen Sektionen und konkreten Handlungsanweisungen. Kein einziges Page nutzt jedoch die V2-React-Komponenten — überall werden uwe-v2-CSS-Klassen mit Legacy-Klassen (uwe-badge, uwe-table, uwe-today-card) und vielen Inline-Styles gemischt, was die Konsistenz untergräbt. Größter Ausreißer nach unten ist der Review-Workspace: funktional komplett, aber ohne Empty State und mit rohem JSON-Diff als zentraler Arbeitsfläche. |
| Studio: Admin C (Security, Status, Users, Webhooks) | 6 | **7.0** | Die Admin-C-Gruppe ist überdurchschnittlich solide: alle Seiten teilen SystemShell, Breadcrumbs und PageHeader, und Loading-/Empty-/Error-Zustände sind fast überall vorhanden — für Admin-Seiten keine Selbstverständlichkeit. Durchgängige Schwäche ist der Stilmix aus v2-Karten/-Buttons, Legacy-Klassen (uwe-badge, uwe-table, uwe-dashboard-*), Tailwind-Utilities und Inline-Styles, wodurch Abstände und Badge-Farben von Seite zu Seite variieren. Größte funktionale Lücken: fehlende Verwaltungsaktionen bei Webhooks, harte Listen-Kappungen ohne Hinweis (Tags, Deliveries) und fehlende Pending-States bei Users/Webhooks. |
| Studio: System (Health, Host-Control, Printers, Navigation, ...) | 12 | **7.3** | Die System-Gruppe ist funktional stark: Fast jede Seite denkt an Offline-, Leer- und Fehlerzustände (Maschinenraum-offline-Erklärung, Stale-Flag im Command Center, Empty States), was für Admin-Bereiche ungewöhnlich gut ist. Größtes Problem ist die visuelle Uneinheitlichkeit: Drei Styling-Generationen (Legacy uwe.css-Klassen, uwe-v2-CSS und das studio-lokale Tailwind-Token-Kit) plus viele Inline-Styles existieren nebeneinander, sodass sich z. B. Health, Cloudflare und Maschinenraum wie Seiten aus verschiedenen Apps anfühlen. Der /system-Hub dupliziert zudem Inhalte seiner Unterseiten (Jobs/App-Status doppelt in Übersicht und Diagnose), und schwächere Seiten wie Drucker und KnowHow wirken unfertig gegenüber dem sehr durchdachten Command Center. |
| Studio Worlds: Kern & Wiki (Weltliste, Dashboard, Wiki, Seiten, Review) | 10 | **7.1** | Der Worlds-Kern ist solide bis gut: konsistente Shell mit Breadcrumbs, Kontextpanels und fast überall durchdachten Empty States; die Wiki-Liste und der Inspektor sind die reifsten Seiten. Größte Baustelle ist der Stilmix aus drei Generationen (Legacy uwe.css, design-v2 uwe-v2-*, neuer Tailwind/shadcn-Stack) — praktisch jede Seite mischt mindestens zwei davon, wodurch Buttons und Tabellen je nach Seite anders aussehen. Dazu kommen einzelne echte UX-Gefahren: die vom Block entkoppelten Lösch-Buttons auf der Edit-Seite, doppelte Filterleisten in der Wiki-Suche und der doppelte Seitenkopf im Dashboard. |
| Studio Worlds: Struktur & Analyse (Atlas, Graph, Kalender, Chronik, Radar, Quality) | 10 | **7.2** | Solide, funktional durchdachte Analyse- und Struktur-Seiten: Empty States und Erfolgs-Banner sind fast überall vorhanden, die Informationsarchitektur (Shell, Breadcrumbs, Sidebar-Kontextpanels) ist konsistent. Die größte Schwäche ist das durchgehend gemischte Styling — uwe-v2-Klassen, Legacy-Klassen (uwe-hint, uwe-block, auth-*), Tailwind-Utilities und massenhaft Inline-Styles koexistieren auf jeder Seite, inklusive handwerklicher Fehler wie der nicht existierenden Klasse uwe-v2-btn-small. Eine Konsolidierung auf CardV2/ButtonV2 plus Abbau der Inline-Styles hätte den größten Effekt auf die gesamte Gruppe. |
| Studio Worlds: Sessions & Vorbereitung (Live, Review, One-Shot, Soundboard) | 8 | **6.8** | Die Sessions-Gruppe hat einen durchdacht modellierten Workflow (Planen → Live → Review → Portal-Publish) mit echten Empty States, Flash-Meldungen und einem eigenen Live-Nav-Modus — konzeptionell die stärkste Seite des Studios. Handwerklich bremst sie sich selbst aus: durchgängig gemischtes Design-System (v2-Buttons/Cards auf Legacy-Tabellen, Panels und vielen Inline-Styles) und mehrere Cross-Page-Brüche (Live-Panel kann Loot/Quest/Lesezeichen-Einträge nicht erfassen, die das Review erwartet; prepare-session ignoriert den sessionId-Deep-Link; doppelte Flash-Meldungen und Publish-Buttons im Session-Detail). Soundboard und One-Shot brauchen eine Konsolidierung ihrer redundanten Formulare, der Kern-Workflow dagegen vor allem Politur. |
| Studio Worlds: Dungeons, Magic Items, Roll Tables, Treasury | 9 | **6.2** | Solide, funktional vollständige Gruppe mit durchgängigem Gerüst (WorldShell, BreadcrumbTrail, PageHeader, Erfolgs-Flashes), aber keine einzige Seite ist rein V2 — überall mischen sich uwe-v2-Klassen mit Legacy-CSS (uwe-page-table, uwe-banner, uwe-hint) und viel Inline-Styling. Wiederkehrende Muster-Schwächen: dieselben Daten werden doppelt gerendert (Ebenen- und Raum-Seiten zeigen Cards UND Tabelle), destruktive Aktionen (Tabelle/Item löschen) haben keine Bestätigung, und die Cockpit-Seiten (Raum, Treasury) sind überladen. Die Formular-UX ist dagegen überdurchschnittlich: klare Spieler/DM-Feldtrennung, gute Placeholder und clevere Extras wie Schnellstart-Presets und Würfel-Verlauf. |
| Studio Worlds: Labels & Print (Etiketten, Print-Center, Charakterdruck) | 8 | **6.6** | Funktional reifer Bereich mit teils vorbildlichen Zuständen: DM-only-Absicherungen mit expliziter Bestätigung, auto-aktualisierende Druck-Queues, Flash-Messages und Empty States sind fast überall vorhanden. Durchgängig problematisch ist der Mix aus drei Styling-Welten (Legacy uwe-*, v2 uwe-v2-*, Tailwind/shadcn) auf denselben Seiten sowie die Redundanz von vier Einstiegspunkten (Label-Bibliothek, Maschinenraum-Druck, Print Center, Drucklisten-Detail), deren Abgrenzung die Maschinenraum-Druck-Seite sogar per Routen-Tabelle im UI erklären muss. Die dünnen Hub-/Picker-Seiten (labels/print, characters/print) fallen mit Dev-Jargon und fehlender Shell deutlich ab. |
| Studio Worlds: Verwaltung (Assets, Backup, Import, AI-Runs, Brain, DnD-API) | 9 | **6.4** | Die Verwaltungsgruppe ist funktional reif — besonders die Preview-vor-Ausführung-Flows bei Import und Backup-Restore sind vorbildlich abgesichert — aber visuell durchgehend ein Dreifach-Mix aus Legacy-uwe.css, v2-Klassen und Tailwind-basierter Shell; keine einzige Seite nutzt das V2-System konsequent. Wiederkehrende Muster: rohe IDs/Enums in der UI (Batch-Toolbar, Backup-Auswahl, Brain-Links, Statusmeldungen), fehlende Pagination bei wachsenden Listen und viele Inline-Styles. Größte Ausreißer nach unten sind die überladene Assets-Seite mit vierfach redundanten Asset-Listen und die DnD-API-Seite, deren Kartenlisten auf nirgends definierten CSS-Klassen basieren. |
| Portal: Öffentlich & Einstieg (Login, Weltliste, Share-Links) | 12 | **6.8** | Der Portal-Einstieg ist zweigeteilt: Die Hälfte der Gruppe sind reine Redirect-Stubs ohne UI (Root, /portal, alle /worlds-Legacy-Pfade), die Auth-aware und Deep-Link-erhaltend sauber umleiten, aber temporäre statt permanente Redirects nutzen. Die sichtbaren Seiten (Login, Passwort-Flows, Share-Gates) sitzen konsistent auf dem neuen Tailwind/shadcn-Stack mit vorbildlicher Zustandsabdeckung (2FA, Turnstile, abgelaufene/deaktivierte Links, Passwort-Gates) — nur unbehandelte Netzwerkfehler lassen Buttons in Ladezuständen hängen. Einziger echter Ausreißer ist die Maintenance-Seite: Legacy-CSS plus zwei nirgends definierte Klassen, wodurch das Zentrieren-Layout schlicht nicht existiert. |
| Portal: Welt A (Hub, Wiki-Seiten, Atlas, Charaktere, Handouts, NPCs) | 11 | **6.8** | Die Portal-Welt-A-Gruppe ist solide und ungewöhnlich konsequent bei Zuständen: fast jede Seite hat Empty-States (PortalEmptyState), das Dashboard sogar per-Widget-Leertexte, und die Notiz-Workflows funktionieren ohne Client-JS über Server Actions. Die größten Schwächen sind Stil-Fragmentierung (Tailwind-Kit im Hub, massive Inline-Styles im Atlas, Legacy-Klassen überall sonst — das V2-System aus shared-ui/components-v2 wird auf keiner Seite genutzt) sowie Detail-Rauschen wie rohe effectiveRole-Werte im Fließtext und redundante Badges. Ausreißer nach unten ist /notes, wo eine doppelte Notiz-UI (eigene Liste plus leeres PlayerNotesPanel) sich selbst widerspricht und Entwürfe auf der eigenen Notizseite nicht gesendet werden können. |
| Portal: Welt B (Quests, Sessions, Timeline, Treasury, Wiki, Account) | 10 | **7.1** | Die Portal-Welt-Seiten sind funktional solide, rollenbewusst gefiltert und durchweg mit sinnvollen Sektionen aufgebaut, hängen aber fast komplett im Legacy-CSS (portal-*/auth-*-Klassen) mit Inline-Styles, Text-Link-Filtern und repetitiven Inline-Formularen; nur die Empty States kommen bereits aus dem neuen Kit. Die Account-Seiten zeigen den Zielzustand: Sie nutzen das moderne Tailwind-Kit des Portals (PageHeader/Card/Alert auf --uwe-Tokens — nicht das shared-ui components-v2) und wirken deutlich aufgeräumter, haben aber ein wiederkehrendes fetch-ohne-try/catch-Problem, das Buttons bei Netzwerkfehlern hängen lässt. Größter Hebel für die Gruppe: einheitliche Feedback-Zustände nach Aktionen (Vote, Frage, Item-Transfer) und die Migration der Welt-Seiten auf das Card-/Badge-Kit der Account-Seiten. |

---

## Detailbewertungen pro Bereich

### Studio: Top-Level Hubs & Templates (Root, Studio, Portal, Backup, Import, Settings, Templates) — Ø 6.9

_Die Top-Level-Hubs sind funktional durchdacht — Rollen-Gating, Preview-vor-Restore, Job-Verlauf mit Rollback und saubere Redirect-Konsolidierung (/studio → /today) zeugen von guter Flow-Planung. Optisch ist die Gruppe aber dreigeteilt: Legacy-Panels (uwe-panel/uwe-form), v2-Buttons und Tailwind-Utilities mischen sich auf fast jeder Seite, dazu viele Inline-Styles statt Systemklassen. Größte Baustellen sind der 963-Zeilen-Settings-Monolith mit Deutsch/Englisch-Sprachmix und die Mobile-Tauglichkeit (Tabellen ohne Overflow-Wrapper, nicht-responsives Editor-Grid)._

#### `/backup` — **6/10** _(Design: gemischt)_

Backup-Hub: Voll-/Welt-/Kampagnen-Backups erstellen, herunterladen, Zeitplan konfigurieren und mit Preview + Bestätigung wiederherstellen. (`apps/studio/app/backup/page.tsx`)

- **Stärken:** Vorbildlicher Restore-Flow: Preview-Pflicht → RESTORE-Tippbestätigung → detaillierter Ergebnisbericht inkl. Fehlerprotokoll und Nutzer-ohne-Passwort-Liste · Sektionen sauber nach Berechtigungen gegated (canCreate/canRestore/owner-Zeitplan); Empty State und role=alert/status vorhanden · Kontextpanel erklärt, was im Backup steckt und dass Secrets ausgeschlossen sind
- **Schwächen:** Welt-/Kampagnen-Slug als Freitextfeld mit Placeholder 'terra' statt Dropdown der vorhandenen Welten — tippfehleranfällig · Massive Inline-Styles statt Systemklassen; Legacy uwe-panel + v2-Buttons gemischt · Permissions werden erst clientseitig nachgeladen: Sektionen ploppen ohne Loading-State ein (Layout-Shift), globale Fehleranzeige klebt ganz unten fern der Aktion
- **Quickwin:** Welt- und Kampagnen-Auswahl als Select mit den echten Welten/Kampagnen des Systems statt Slug-Freitext.

#### `/settings` — **6/10** _(Design: gemischt)_

Zentrale Admin-/Systemeinstellungen mit 14 Tabs (General bis Systemstatus) über serverseitige searchParams-Navigation. (`apps/studio/app/settings/page.tsx`)

- **Stärken:** SettingsShell mit stabiler linker Tab-Navigation (aria-current, aktive Hervorhebung) und begrenzter Lesebreite — 14 Bereiche bleiben auffindbar · Gute Secret-UX: 'Leer lassen = bestehenden Key behalten', ENV-Vorrang mit Quellen-Badges sichtbar, env-gesperrte Felder erklärt statt versteckt · Kollaps-Panels und Pfad-Übersicht (dl mit aktiver Quelle) strukturieren die langen Tabs Mail/AI/Storage sinnvoll
- **Schwächen:** 963-Zeilen-Monolith mit drei Stilwelten in einer Datei: Tailwind-Shell, Legacy uwe-form mit Inline-margins, v2-Buttons · Sprachmix: Tab-Labels und Überschriften englisch ('General', 'World Settings'), Hints und Buttons deutsch — wirkt unfertig · Speicher-Feedback inkonsistent: generische 'Einstellungen gespeichert'-Notice nur über ?saved=1, ohne Bezug zum jeweiligen Tab; jeder Tabwechsel ist ein Full-Page-Load
- **Quickwin:** Alle Tab-Labels und Abschnittsüberschriften auf Deutsch vereinheitlichen — minimaler Aufwand, beseitigt den auffälligsten Inkonsistenz-Eindruck der Seite.

#### `/templates` — **6/10** _(Design: gemischt)_

Liste aller Quick-Create-Seitentemplates mit Typ-Filter, Suche und Aktionen (Duplizieren, Aktivieren/Deaktivieren). (`apps/studio/app/templates/page.tsx`)

- **Stärken:** Filter + Suche mit sichtbarem 'Zurücksetzen'-Link, der nur bei aktivem Filter erscheint · Empty-State als Tabellenzeile ('Keine Templates für diesen Filter') und Fehleranzeige mit role=alert · System-Badge unterscheidet mitgelieferte von eigenen Templates direkt in der Namensspalte
- **Schwächen:** Drei Styling-Paradigmen in einer Datei: Tailwind-Utilities im Filter, Legacy uwe-page-table, v2-Buttons — plus Inline-Styles · Tabelle ohne den vorhandenen uwe-page-table-wrap — 6 Spalten ohne horizontales Scrollen auf Mobil · Primäraktion 'Neues Template' hängt lose in einem <p> zwischen Filter und Tabelle statt als action im PageHeader
- **Quickwin:** 'Neues Template' als actions-Prop in den PageHeader verschieben — die Primäraktion gehört an die etablierte Stelle oben rechts.

#### `/portal` — **7/10** _(Design: unklar)_

Redirect vom Studio ins Spieler-Portal der relevantesten Welt (zuletzt aktiv → Favorit → erste Welt), mit Auth-Guard. (`apps/studio/app/portal/page.tsx`)

- **Stärken:** Intelligente Zielwahl mit dreistufigem Fallback inkl. Validierung, dass der gespeicherte Slug noch existiert · requireStudioAccess() vor dem Redirect — kein Leak der Portal-URL an Unbefugte
- **Schwächen:** Bei null Welten landet der Nutzer kommentarlos auf der leeren Portal-Weltliste statt einen Hinweis im Studio zu bekommen · Drei sequenzielle DB-Zugriffe ohne jegliches Zwischen-Feedback — bei langsamer DB wirkt der Klick tot
- **Quickwin:** Bei 0 Welten im Studio bleiben und einen Empty-State mit 'Erste Welt anlegen'-CTA zeigen statt ins leere Portal zu springen.

#### `/import` — **7/10** _(Design: gemischt)_

Import-Zentrale: Quelle (KnoteForge/Markdown/Obsidian/PDF) und Ziel (Welt/Life Brain/Capture/DnD) wählen, Import-Jobs mit Vorschau, Verlauf und Rollback ausführen. (`apps/studio/app/import/page.tsx`)

- **Stärken:** Klares Job-Modell: Status-Badges mit semantischen Farben, Verlaufstabelle mit Ergebnis-/Vorschau-Zusammenfassung und Rollback-Aktion · Nicht verfügbare Quelle/Ziel-Kombinationen werden aktiv markiert ('demnächst') und der Start-Button korrekt disabled · Kontextpanel listet unterstützte/geplante Formate dynamisch aus der Registry — keine veraltete Doku
- **Schwächen:** Der File-Input 'Dateiname (optional)' liest nur den Dateinamen; der echte Upload passiert erst im nächsten Schritt im Panel — Nutzer wählen die Datei gefühlt doppelt · Verlaufstabelle mit 7 Spalten nutzt uwe-page-table ohne den vorhandenen uwe-page-table-wrap — bricht auf Mobil aus dem Layout · Aktiver Job schiebt sich zwischen Formular und Verlauf; beim 'Öffnen' alter Jobs kein Lade-/Kontextwechsel-Feedback
- **Quickwin:** Den Pseudo-File-Input beim Job-Anlegen entfernen oder zum echten Upload machen — die Zwei-Schritt-Dateiauswahl ist der größte Stolperstein im Flow.

#### `/templates/new` — **7/10** _(Design: gemischt)_

Formular zum Anlegen eines eigenen Quick-Create-Templates mit Block-Editor und Live-Vorschau in der Seitenleiste. (`apps/studio/app/templates/new/page.tsx`)

- **Stärken:** Live-Vorschau (v2-Card) spiegelt Name, Beschreibung und nur gefüllte Blöcke — mit eigenem Empty-State-Hinweis · Klarer Aufbau: Breadcrumb, PageHeader mit erklärender Summary, Fehleranzeige mit role=alert · Automatisch angehängter Leerblock senkt die Hürde, den ersten Block anzulegen
- **Schwächen:** Split-Grid nur als Inline-Style definiert; die Klasse uwe-template-editor-split existiert in keiner CSS-Datei — das Layout kollabiert auf Mobil nie einspaltig · Blöcke lassen sich nicht umsortieren; 'Block entfernen' als Checkbox, die erst beim Speichern wirkt, statt direkter Aktion · Formular mischt Legacy uwe-form mit v2-Buttons und Inline-Styles
- **Quickwin:** Responsive-Fallback für das Editor-Grid ergänzen (einspaltig unter ~900px), sonst ist der Editor auf Mobil unbenutzbar.

#### `/templates/[templateId]` — **7/10** _(Design: gemischt)_

Detailseite eines Templates mit Lesemodus (Blockübersicht) und umschaltbarem Bearbeitungsmodus (?edit=1) inklusive Live-Vorschau. (`apps/studio/app/templates/[templateId]/page.tsx`)

- **Stärken:** Sauberer Lese-/Bearbeitungsmodus-Toggle als PageHeader-Action; System-Templates warnen in der Summary vor globaler Wirkung · Feedback-Zustände vorhanden: saved mit role=status, error mit role=alert, notFound-Handling · Breadcrumb zurück zur Liste und konsistenter PageHeader wie im Rest der Gruppe
- **Schwächen:** Lesemodus quetscht Beschreibung, Seitentyp und Sichtbarkeit in eine Punkt-getrennte Textzeile statt strukturierter Metadaten · Blöcke im Lesemodus nur als verschachtelte Sections ohne visuelle Abgrenzung oder Badges — bei vielen Blöcken schwer scanbar · Erbt die Editor-Schwächen: nicht-responsives Split-Grid, Entfernen-Checkbox, keine Block-Reihenfolge
- **Quickwin:** Blöcke im Lesemodus als abgegrenzte Karten mit Typ-/Sichtbarkeits-Badges rendern statt flacher verschachtelter Sections.

#### `/` — **8/10** _(Design: unklar)_

Öffentliche Landing Page (uwe.example) mit Studio/Portal-Auswahl und In-Place-Login; eingeloggte Nutzer werden zur konfigurierten Startseite umgeleitet. (`apps/studio/app/page.tsx`)

- **Stärken:** Klare Zwei-Wege-IA (Studio für GM, Portal für Spieler) mit Rollen-Badges, Feature-Bullets und deutlich unterschiedlichen Karten-Farbwelten · Durchgängig responsive (clamp()-Spacing, auto-fit-Grid, safe-area-inset im Footer) plus Tastaturbedienung der Karten (role=button, Enter/Space) · Zustände mitgedacht: Maschinenraum-Status-Pill online/offline, Theme wird für den ersten Paint serverseitig fixiert (Parchment-Tokens inline)
- **Schwächen:** Karten sind div[role=button] statt echter Links — kein Mittelklick, kein Fallback ohne JavaScript · Komplett in Inline-Styles gebaut (eigenes Pixel-Spec-Design), liegt außerhalb von v2 und Legacy — Änderungen am Design-System erreichen die Seite nie
- **Quickwin:** Karten-CTAs als echte <a>-Elemente auf die Login-Ansicht rendern (Progressive Enhancement statt reinem onClick).

#### `/studio` — **8/10** _(Design: unklar)_

Legacy-Redirect: leitet die alte DM-Dashboard-URL auf /today um und erhält dabei den Query-String für Deep-Links. (`apps/studio/app/studio/page.tsx`)

- **Stärken:** Query-String wird vollständig übernommen (auch Array-Parameter) — Deep-Links wie ?world=… überleben die IA-Konsolidierung · Zweck und Kontext im JSDoc dokumentiert, kein toter UI-Code
- **Schwächen:** Nutzt redirect() (307) statt permanentRedirect() (308) für eine dauerhaft verlegte URL — Bookmarks/Crawler lernen das neue Ziel nie
- **Quickwin:** redirect() durch permanentRedirect() ersetzen, da die Verlegung nach /today endgültig ist.


### Studio: Auth, Account & Basis — Ø 6.9

_Die Auth-Kernflüsse (Login, Setup-Wizard, Forgot/Reset) sind die stärksten Seiten der Gruppe: konsistent auf dem token-basierten ui-Kit in der StudioAuthShell, mit überdurchschnittlich vollständigen Zuständen und guter Formular-Semantik. Die Account- und Randseiten (Passwort ändern, Logout, Maintenance, Security-Tabelle) fallen ab, weil sie Legacy-CSS in moderne Shells mischen und dadurch sichtbare Stilbrüche erzeugen. Wiederkehrendes technisches Muster mit UX-Folge: fetch-Aufrufe ohne try/catch, die bei Netzwerkfehlern Buttons dauerhaft im Ladezustand hängen lassen — plus zwei echte Lücken bei 2FA-Recovery-Codes und dem irreführenden Setup-Fallback._

#### `/logout` — **5/10** _(Design: gemischt)_

Führt den Logout automatisch beim Seitenaufruf aus und leitet zur Startseite weiter. (`apps/studio/app/logout/page.tsx`)

- **Stärken:** Automatischer Ablauf mit sichtbarem LoadingState ('Melde ab…') · Fehlerzustand existiert und bietet einen Link zur Startseite
- **Schwächen:** Fehler-Branch nutzt Legacy-Klassen (uwe-page/uwe-card/uwe-auth-message), der Ladezustand das moderne Kit — Stilbruch auf einer Mini-Seite · Kein 'Erneut versuchen'-Button im Fehlerfall; Nutzer muss manuell neu laden · Bei Fehler bleibt unklar, ob man noch angemeldet ist — keine Statusaussage
- **Quickwin:** Fehlerzustand auf ErrorState aus dem ui-Kit umstellen und einen Retry-Button ergänzen, der den Logout-Call erneut auslöst.

#### `/account/password` — **6/10** _(Design: gemischt)_

Passwort ändern, inklusive Pflicht-Änderung und Erst-Passwort nach Restore. (`apps/studio/app/account/password/page.tsx`)

- **Stärken:** Durchdachte Varianten: forcePasswordChange und initialPasswordOnly mit passenden Texten, Button-Labels und Reset-Fallback-Link · PasswordStrengthMeter am neuen Passwort und role=status auf der Erfolgsmeldung · Klare Verortung: Breadcrumb Einstellungen → Passwort, Card zeigt an, als wer man angemeldet ist, Querverweis auf 2FA
- **Schwächen:** Stilbruch in der Card: ChangePasswordForm nutzt rohe label/input und Legacy-Klassen (studio-auth-form, uwe-auth-message, uwe-v2-btn) statt des ui-Kits der restlichen Auth-Seiten · fetch ohne try/catch — Netzwerkfehler lässt 'Speichern…' hängen · Bei Pflicht-Änderung fehlt nach Erfolg eine automatische Weiterleitung zurück ins Studio (nur manueller 'Zurück'-Link)
- **Quickwin:** ChangePasswordForm auf Input/Label/Button/Alert aus dem ui-Kit umstellen — beseitigt den sichtbaren Stilbruch mit einem Schlag.

#### `/maintenance` — **6/10** _(Design: gemischt)_

Sperrseite im Wartungsmodus mit konfigurierbarer Meldung und automatischem Recovery-Polling alle 30 Sekunden. (`apps/studio/app/maintenance/page.tsx`)

- **Stärken:** Transparente Kommunikation: konfigurierbare Meldung mit Fallback, Hinweis auf Auto-Reload und Owner-Escape-Hatch zu den Einstellungen · MaintenanceRecoveryPoller lädt die App selbstständig neu, sobald die Sperre endet — Nutzer muss nichts tun
- **Schwächen:** Rendert in der vollen SystemShell mit kompletter Studio-Navigation, obwohl die App gesperrt ist — die Nav-Links sind tote Enden · Inhalt in Legacy-Card (uwe-card/uwe-hint) unter Tailwind-PageHeader — gemischte Stilebenen · Kein manueller 'Jetzt prüfen'-Button als Ergänzung zum 30-Sekunden-Polling
- **Quickwin:** Sperrseite in der StudioAuthShell (zentrierte Card ohne Navigation) rendern statt in der SystemShell — entfernt die irreführende Voll-Navigation.

#### `/forgot-password` — **7/10** _(Design: v2)_

Fordert per E-Mail einen Passwort-Reset-Link an. (`apps/studio/app/forgot-password/page.tsx`)

- **Stärken:** Enumeration-sichere Erfolgsmeldung ('Falls ein Konto existiert…'), die das Formular ersetzt — klarer Abschluss · Konsistente StudioAuthShell mit Beschreibung und Rückweg zur Anmeldung im Footer · Fehleranzeige über zentralen Formatter (formatForgotPasswordError) statt Rohtext
- **Schwächen:** fetch ohne try/catch: Bei Netzwerkfehler bleibt der Button dauerhaft auf 'Sende Link…' und disabled hängen · Nach Erfolg gibt es keinen Weg, die Anfrage erneut zu senden (nur Footer-Link zurück zum Login)
- **Quickwin:** Submit in try/catch/finally packen und Netzwerkfehler als Alert anzeigen — behebt den hängenden Ladezustand.

#### `/reset-password` — **7/10** _(Design: v2)_

Setzt über den per Mail erhaltenen Token ein neues Passwort. (`apps/studio/app/reset-password/page.tsx`)

- **Stärken:** Fehlender/ungültiger Token wird sofort als eigener Zustand mit Link zu /forgot-password behandelt · Client-Validierung (Mindestlänge, Passwort-Match) vor dem Request, E-Mail-Feld nur wenn nicht in der URL · Sauberer Abschluss-Flow: Redirect auf /login?reset=success, wo eine Erfolgsmeldung erscheint
- **Schwächen:** fetch ohne try/catch und response.json() ungeprüft — Netzwerk- oder Nicht-JSON-Antwort lässt den Button hängen · Kein PasswordStrengthMeter, obwohl er in shared-ui existiert und im ChangePasswordForm genutzt wird — inkonsistentes Feedback · Kein 'Passwort anzeigen'-Toggle bei zwei blinden Passwortfeldern
- **Quickwin:** PasswordStrengthMeter aus @uwe/shared-ui einbinden — gleiches Feedback wie beim Passwort-Ändern und direkt bessere Passwortwahl.

#### `/continue` — **7/10** _(Design: v2)_

Listet die fünf wahrscheinlich relevantesten offenen Fortsetzungen (Projekte, Werkstatt, Captures, Scans) zum Weiterarbeiten. (`apps/studio/app/continue/page.tsx`)

- **Stärken:** Klarer PageHeader mit erklärender Summary, Breadcrumb und voller StudioShell-Navigation · Karten mit Typ-Badge und Hinweistext pro Eintrag geben sofort Kontext, wohin der Klick führt · Empty State mit freundlicher, konkreter Formulierung vorhanden
- **Schwächen:** Emoji-Icons (🧩🔧📥📄) widersprechen der V2-Vorgabe 'SVG statt Emoji' · Fix auf 5 Einträge ohne 'Mehr anzeigen' oder Filter nach Art · Empty State ist nur ein Textabsatz ohne CTA (z. B. 'Neues Capture anlegen')
- **Quickwin:** Empty State auf die EmptyState-Komponente mit Aktions-Button (Capture/Projekt starten) umstellen und Emoji durch NavIcon-SVGs ersetzen.

#### `/account/security` — **7/10** _(Design: gemischt)_

2FA (TOTP) einrichten oder deaktivieren und die letzten Login-Ereignisse des Kontos einsehen. (`apps/studio/app/account/security/page.tsx`)

- **Stärken:** 2FA-Flow mit sauberen Zuständen: Status-Loading, QR-Code + Geheimschlüssel + otpauth-Link, Bestätigungscode, Abbrechen, destructive-Button zum Deaktivieren · Sinnvolle Zweiteilung in zwei Cards (2FA / Letzte Anmeldungen) mit Empty State für die Login-Tabelle · Gute Input-Semantik für Codes (inputMode=numeric, one-time-code, pattern)
- **Schwächen:** Nach 2FA-Aktivierung werden keine Recovery-Codes angezeigt — Verlust des Authenticators sperrt den Nutzer aus · Login-Tabelle zeigt nur Zeit und Ereignis, ohne IP/Gerät wenig Aussagekraft; zudem Legacy-Klasse uwe-page-table in der Tailwind-Card · fetch-Aufrufe ohne try/catch — Netzwerkfehler enden in hängenden Busy-Zuständen
- **Quickwin:** Nach erfolgreicher Aktivierung einmalig Recovery-Codes generieren und anzeigen — größter Sicherheits- und UX-Gewinn der Seite.

#### `/setup` — **8/10** _(Design: v2)_

Vierstufiger Ersteinrichtungs-Wizard: Voraussetzungen prüfen, Owner anlegen, Produktions-Hinweise, nächste Schritte. (`apps/studio/app/setup/page.tsx`)

- **Stärken:** Klarer Wizard mit Fortschrittsanzeige (aria-current), gegateten Weiter-Buttons und pro Schritt wechselnder Beschreibung · Voraussetzungen und Produktions-Hinweise als Status-Checkliste mit Ampel-Glyphen, Meldung und konkretem Hint (inkl. openssl-Kommando bei fehlendem Setup-Token) · Eigener Zustand für 'Setup bereits abgeschlossen' mit sinnvollen Weiterleitungen; Zurück-Navigation nach Owner-Anlage korrekt gesperrt
- **Schwächen:** Fehlgeschlagener Status-Fetch (catch → setupAvailable=false) wird fälschlich als 'Setup abgeschlossen' angezeigt — irreführend bei Netzwerkproblemen · Owner-Formular-Submit ohne try/catch — Netzwerkfehler lässt 'Owner anlegen…' hängen · Status-Glyphen sind Textzeichen (✓/!/✕) statt SVG-Icons des Design-Systems
- **Quickwin:** Fetch-Fehler vom Zustand 'Setup abgeschlossen' trennen und als eigenen Fehlerzustand mit Retry-Button darstellen.

#### `/login` — **9/10** _(Design: v2)_

Anmeldeseite des Studios mit Passwort-Login, optionaler Turnstile-Prüfung und integriertem 2FA-Schritt. (`apps/studio/app/login/page.tsx`)

- **Stärken:** Sehr vollständige Zustände: Loading, Fehler (inkl. JSON-Parse- und Netzwerkfehler), Reset-Erfolgsmeldung, Forbidden-Hinweis, Turnstile-Token-Refresh nach Fehlversuch · Saubere Formular-UX: Labels, autoComplete/inputMode, aria-invalid, autoFocus, 'Passwort vergessen?' direkt am Feld, 2FA-Schritt mit Zurück-Option · Konsistente StudioAuthShell (zentrierte Card) mit Dev-Credentials-Box nur im Dev-Modus und dynamischem Setup-Link im Footer
- **Schwächen:** Fehlermeldung ist nicht per aria-describedby mit den Feldern verknüpft · Kein 'Passwort anzeigen'-Toggle · Im 2FA-Schritt fehlt ein Hinweis für den Fall 'Code/Gerät verloren' (kein Recovery-Pfad)
- **Quickwin:** Im 2FA-Schritt einen Recovery-Hinweis bzw. Fallback-Link ergänzen, damit Nutzer bei verlorenem Authenticator nicht in einer Sackgasse landen.


### Studio: Daily Admin OS A (Today, Kalender, Capture, Scan, Dokumente) — Ø 6.9

_Die Daily-Admin-Gruppe ist funktional reich und in den Kern-Flows (Today-Widgets, Capture-Triage, Scan-Workflow) mit durchdachten Zuständen gebaut — Empty States, statusgetriebene Buttons und KI-Review-Muster sind klar überdurchschnittlich. Das wiederkehrende UX-Problem ist überall dasselbe: Erfassungs- und Edit-Formulare stehen vor dem eigentlichen Inhalt bzw. bleiben permanent offen (Calendar, Documents, Contracts), was Seiten lang und unübersichtlich macht. Keine Seite ist reines V2 — durchgängig mischen sich uwe-v2-Klassen mit Legacy-Klassen (uwe-dashboard-*, uwe-brain-create-form, uwe-badge), Inline-Styles und vereinzelt Tailwind, sodass eine Konsolidierung auf CardV2/ButtonV2 plus Abstands-Klassen der wirksamste Querschnitts-Hebel wäre._

#### `/contracts` — **5/10** _(Design: gemischt)_

Manuelle Verwaltung von Verträgen und Monatsausgaben inkl. KI-Kosten-Rollup, Kostenübersicht und Fristen-Alerts. (`apps/studio/app/contracts/page.tsx`)

- **Stärken:** Fristen-Alerts pro Vertrag und in der Kostenübersicht mit direkter "Mail vorbereiten"-Aktion · KI-Kosten-Sektion mit Perioden-Umschalter (aktiver Button hervorgehoben), Tabellen nach Feature/User und explizitem Null-Zustand · Deklaratives AdminEntityForm für die Neuanlage — konsistente Feldkomponenten aus shared-ui
- **Schwächen:** IA-Reihenfolge fragwürdig: die KI-Kosten-Nische dominiert den Seitenanfang, die eigentliche Vertragsliste kommt erst nach drei Karten und einem Formular · Jeder Vertrag ist ein permanent offenes 8-Felder-Edit-Formular — kein Lese-/Vergleichsmodus, bei 20+ Verträgen unbenutzbar; Löschen ohne Bestätigung · "Betrag (Cent)" als rohes Zahlenfeld ist fehleranfällig (49,99 € muss als 4999 eingegeben werden)
- **Quickwin:** Vertragsliste als kompakte Lese-Tabelle (Name, Betrag, Intervall, nächste Zahlung, Alerts) mit Edit-on-Demand statt Dauer-Formularen.

#### `/calendar` — **6/10** _(Design: gemischt)_

Kalender mit Monats-/Wochenansicht, Termin- und Feed-Verwaltung (CalDAV/iCal) plus editierbarer Terminliste. (`apps/studio/app/calendar/page.tsx`)

- **Stärken:** Vollständige Header-Aktionsleiste: Prev/Next, Monat/Woche-Toggle mit aktiver Hervorhebung, ICS-Export · Empty States für Feeds und Termine; Sync-Fehler und letzter Sync-Zeitpunkt werden pro Feed angezeigt · Monats-Grid mit Overflow-Anzeige (+N) und Anker-Links (#event-id) zur Detail-Liste
- **Schwächen:** IA verkehrt: zwei große Formulare (Termin anlegen, Feed hinzufügen) stehen VOR dem Kalender-Grid — der eigentliche Hauptinhalt rutscht unter den Fold · Prev/Next-Pfeile bauen Links fest mit view=month (calendarPageHref("month", …)) — in der Wochenansicht springt die Navigation zurück zur Monatsansicht und schrittet monatsweise · Termin-Bearbeitung als komplettes Inline-Formular in jedem <details> — bei vollen Monaten schwerfällig; viele Inline-Styles (marginTop) statt Systemklassen
- **Quickwin:** Kalender-Grid direkt unter den Header ziehen und die beiden Anlege-Formulare in einklappbare Sektionen verschieben.

#### `/scan-inbox` — **6/10** _(Design: gemischt)_

Dokumente hochladen oder fotografieren, per OCR analysieren lassen und als Status-Board (unanalyzed bis archived) verwalten. (`apps/studio/app/scan-inbox/page.tsx`)

- **Stärken:** Klarer Workflow-Header ("nie automatisch") und Upload mit capture="environment" für Mobile-Fotos plus Ladezustand am Button · Suche über Titel/OCR-Text/Status mit expliziter Kein-Treffer-Meldung · Status-Board mit 8 benannten Spalten, Zählern und PDF-Vorschau-Modal direkt aus der Karte
- **Schwächen:** Alle 8 Status-Spalten rendern immer — leere Spalten zeigen nur "—" und erzeugen Rauschen; erledigte Status (filed/rejected/archived) stehen gleichwertig neben der Arbeit · Kein echter Empty State ohne Scans: statt EmptyState-Komponente erscheinen 8 leere Karten mit Strichen · Karte-in-Karte-Verschachtelung (uwe-v2-card in uwe-v2-card) und Inline-Styles verwässern die Hierarchie
- **Quickwin:** Leere Status-Spalten ausblenden bzw. filed/rejected/archived einklappen und einen echten EmptyState für die leere Inbox ergänzen.

#### `/scan-inbox/[id]` — **7/10** _(Design: gemischt)_

Scan-Detail mit Original-Vorschau, OCR-Text-Korrektur, erkannten Feldern, Ablage-Vorschlag und Bestätigen/Ablehnen/Archivieren. (`apps/studio/app/scan-inbox/[id]/page.tsx`)

- **Stärken:** Logischer Workflow von oben nach unten (Original → OCR → Felder → Vorschlag → Aktionen); konditionale Sektionen erscheinen nur bei Inhalt · Statusgetriebene UI: "Vision-Ergebnis abholen" nur bei status=analyzing; Status, Dokumentart und Konfidenz kompakt im Header-Summary · Erkannte Felder als <dl> mit deutschen Labels und formatiertem Betrag (Cent → EUR); eigene Unsicherheiten-Sektion
- **Schwächen:** Sieben gleichgewichtige Karten-Sektionen — die Kernaktion "Bestätigen und ablegen" steht erst ganz unten nach viel Scroll · Sechs separate Formulare mit ähnlich gestylten Buttons; Ablehnen/Archivieren ohne Bestätigung und optisch gleichrangig zur Analyse · Wiederkehrende Inline-Styles (marginTop) statt Abstands-Klassen des Design-Systems
- **Quickwin:** Aktions-Sektion (Ablage-Ziel + Bestätigen) nach oben neben den Vorschlag ziehen oder als Sticky-Leiste — die Entscheidung ist der Zweck der Seite.

#### `/documents` — **7/10** _(Design: gemischt)_

Dokumentengenerator: Vorlagen mit {{Platzhaltern}} verwalten und daraus per Live-Vorschau Dokumente erzeugen, speichern oder kopieren. (`apps/studio/app/documents/page.tsx`)

- **Stärken:** Generator-Panel mit Live-Vorschau, dynamisch erzeugten Variablen-Feldern, benannten fehlenden Pflichtfeldern und entsprechend deaktiviertem Speichern-Button · Nach dem Speichern direkte Follow-ups (Life-Brain-Link, Druckansicht); eigener Empty State im Panel, wenn keine Vorlagen existieren · Vorlagen nach Kategorie gruppiert mit Zählern; Suche mit Kein-Treffer-Meldung
- **Schwächen:** Jede Vorlage rendert permanent ein komplettes Edit-Formular (Name, Kategorie, 8-Zeilen-Textarea) — ab einer Handvoll Vorlagen wird die Seite sehr lang, kein Lesemodus · Statusmeldungen (Erfolg, Kopierfehler, fehlende Pflichtfelder) alle als uwe-dashboard-muted — Erfolg und Fehler visuell nicht unterscheidbar · Empty-State-Hinweis "lege oben die erste an" steht ganz am Seitenende, weit weg vom Editor, auf den er verweist
- **Quickwin:** Vorlagenliste als kompakte Lese-Karten mit Edit-on-Demand (z. B. ViewEditToggle) statt dauerhaft offener Editoren.

#### `/today` — **8/10** _(Design: gemischt)_

Daily-Cockpit mit konfigurierbarem Widget-Grid (System-Ampel, Agenda, Capture, Mail, Verträge, Haushalt, Jobs), Morning Briefing und Quick Capture. (`apps/studio/app/today/page.tsx`)

- **Stärken:** Widget-System (DashboardWidgetGrid) mit eigenem Empty State und Deep-Link pro Widget — inkl. positivem "Alles erledigt"-Zustand über isTodayDashboardAllClear · Quick Capture als einklappbarer <details>-Streifen direkt unter dem Header plus +Capture-Aktion im PageHeader — Erfassung stört das Cockpit nicht · Konsequente Ampel-Semantik (uwe-dot ok/warn/error) mit klickbaren Status-Chips zu den jeweiligen Detailseiten
- **Schwächen:** Mail-Center- und Werkstatt-Karten liegen hart kodiert außerhalb des Widget-Grids — inkonsistent zur Widget-Logik und Mail doppelt (prioritized-mail-Widget + eigene Sektion) · Morning-Briefing-Volltext wird ungekürzt als <p> gerendert und kann die Seite dominieren; Health-Badge verliert sich als letzter Absatz ganz unten · Stilmix im Header: Tailwind-Utilities (bg-primary, h-9) für den +Capture-Button neben uwe-v2-btn überall sonst
- **Quickwin:** Mail-Center und Werkstatt als reguläre Widgets ins Grid integrieren — eine einheitliche, konfigurierbare Fläche statt Grid plus Anhängsel.

#### `/capture` — **8/10** _(Design: gemischt)_

Universelle Capture-Inbox mit Quick-Capture-Formular (Typ-Chips), Bild-Upload und filterbarer Liste mit Bulk-Archivierung. (`apps/studio/app/capture/page.tsx`)

- **Stärken:** Durchdachte Listen-UX: Status-Tabs (Inbox/Archiv/Alle) plus Quellen-Tabs (Manuell/Mail/Scan), Bulk-Auswahl mit "Alle auswählen" und Zähler im Archiv-Button · QuickCaptureForm mit Typ-Chips (role=listbox), Upload-Status, Fehleranzeige und disabled-Submit während Upload — sauberes Formular-Feedback · Empty State mit direkter Aktion ("Schnell erfassen") und konsistentes AdminModulePage-Layout (PageHeaderV2, Breadcrumb, Zurück-Link)
- **Schwächen:** Zwei Erfassungs-Karten übereinander (Bild erfassen + Neuer Capture) schieben die Inbox-Liste weit nach unten — auf Mobile viel Scroll bis zum Kerninhalt · Überschrift zeigt immer "Inbox (N)", auch wenn der Filter auf Archiv oder Alle steht — Zähler und Label passen nicht zum Filter · Löschen-Button pro Karte feuert ohne Bestätigung eine destruktive Server Action
- **Quickwin:** Die beiden Erfassungs-Karten einklappbar machen (wie TodayQuickCapture auf /today) und die Inbox-Liste nach oben ziehen.

#### `/capture/[id]` — **8/10** _(Design: gemischt)_

Triage-Detail eines Captures: KI-Vorschlag prüfen und Eintrag in Projekte, Werkstatt, DnD, Hardware, Verträge oder Life Brain überführen. (`apps/studio/app/capture/[id]/page.tsx`)

- **Stärken:** ViewEditToggle trennt Lese-Ansicht (inkl. Audio-Player für Sprachmemos, Anhang-Link) sauber von der Triage-Ansicht · KI-Vorschlag als Review-Karte mit Quelle-Badge (Maschinenraum/Heuristik), Annehmen/Ablehnen und explizitem Hinweis, dass Übernahme nur über Triage-Aktionen erfolgt · Triage-Aktionen als <details> mit kontextspezifischen Feldern pro Ziel; Löschen bekommt Warntext und uwe-v2-btn-danger
- **Schwächen:** ensureAiProposal läuft blockierend im Server-Render — beim ersten Öffnen wartet der Nutzer ohne jedes Lade-Feedback auf die KI · Seitentitel statisch "Capture sortieren"; der eigentliche Capture-Titel erscheint erst in der Karte darunter und fehlt im PageHeader · notFound() ist der einzige Fehlerzustand — 404 und "Vorschlag fehlgeschlagen" sind nicht unterscheidbar
- **Quickwin:** Capture-Titel in den PageHeader übernehmen und die Vorschlags-Erzeugung aus dem blockierenden Server-Render lösen (Suspense/Client-Trigger).


### Studio: Daily Admin OS B (Finanzen, Haushalt, Projekte, Ideen) — Ø 6.5

_Die Daily-Admin-Seiten sind funktional reich und überraschend konsequent bei Zuständen: fast überall gibt es Empty-States, Busy-Labels, Fehleranzeigen mit role=alert und erklärte disabled-Buttons. Das Design-System ist jedoch durchgehend gemischt (v2-Cards/-Buttons plus Legacy- und App-lokale Klassen), und zwei Seiten nutzen Layout-Klassen, die in keiner CSS-Datei existieren (uwe-jobs-*, uwe-list-card) — dort zerfällt das intendierte Layout. Wiederkehrende Muster mit größtem Hebel: destruktive Aktionen ohne Bestätigung, data-severity="warn" als Aktiv-Zustand-Ersatz und Inline-Styles statt Systemklassen._

#### `/jobs` — **4/10** _(Design: gemischt)_

System-Job-Warteschlange mit Kampagnen-Presets, Master-Detail-Liste, Live-Polling, Retry/Cancel und Protokollansicht. (`apps/studio/app/jobs/page.tsx`)

- **Stärken:** Live-Verhalten durchdacht: 2s-Polling nur bei aktiven Jobs, Retry/Cancel mit busy-State und Fehleranzeige (role=alert) · Gute IA-Idee: Summary-Stats, Statusfilter, Liste links, Detail mit Log rechts, Hinweis-Sidebar · Presets-Panel mit klaren Validierungsmeldungen und Erfolgs-/Fehler-Feedback
- **Schwächen:** Kern-Layoutklassen (uwe-jobs-layout, -list, -detail, -toolbar, -list-item, -log-list) sind in keiner CSS-Datei definiert — das Master-Detail-Layout zerfällt zu ungestylten, gestapelten Blöcken · Badge-Klassen zweckentfremdet: uwe-badge-published/player/secret für Job-Status ist semantisch irreführend · Sidebar-Hinweise und StatGrid mit Inline-Styles statt Systemklassen
- **Quickwin:** Die fehlenden uwe-jobs-*-CSS-Klassen definieren (zweispaltiges Master-Detail, Listen-Items) — ohne sie ist die Seite visuell kaputt.

#### `/hardware` — **5/10** _(Design: gemischt)_

Homelab-Kontrollzentrum mit Service-Status (Auto-Refresh), Security-Checks, Runbooks, Fehlerhistorie und kompletter Geräteverwaltung. (`apps/studio/app/hardware/page.tsx`)

- **Stärken:** Durchdachtes Monitoring: 30s-Auto-Refresh, Statusfarben via data-status, Security-Warnungen mit role=alert · Runbooks als aufklappbare details-Elemente mit Schritt-für-Schritt-Kommandos · Responsive auto-fill-Grids für Service- und Geräte-Karten
- **Schwächen:** Geräte-Karten massiv überladen: 12-Felder-Edit-Formular, Fehler-Formular, Setup-Schritte und Löschen dauerhaft ausgeklappt in jeder Karte · Gerät löschen ohne Bestätigung, als gleichrangiger Secondary-Button zwischen anderen Aktionen · Monitoring und CRUD-Datenpflege ungetrennt auf einer sehr langen Seite; mehrere Inline-Styles statt Klassen
- **Quickwin:** Edit- und Fehler-Formulare der Geräte-Karten hinter <details> einklappen oder auf eine Detailseite auslagern.

#### `/household` — **7/10** _(Design: gemischt)_

Haushalts-Cockpit für wiederkehrende Wartungsaufgaben mit Fälligkeitsübersicht, Anlage-Formular und Erledigt/Löschen-Aktionen. (`apps/studio/app/household/page.tsx`)

- **Stärken:** Sinnvolle Reihenfolge: Demnächst/überfällig zuerst, mit v2-Badges (danger/warning) klar unterschieden · Kompaktes Anlage-Formular mit hilfreichen Placeholders, Intervall-Select und Datumsfeld · EmptyState-Komponente und Aufgaben-Zähler im Sektionstitel
- **Schwächen:** "Löschen" steht ohne Bestätigung direkt neben "Erledigt" — hohes Fehlklick-Risiko bei gleicher Button-Größe · "Alle Aufgaben" ist eine flache Kartenliste ohne Sortierung/Gruppierung nach Fälligkeit oder Kategorie · uwe-brain-create-form wird als Wrapper für die Aktions-Buttonzeile zweckentfremdet
- **Quickwin:** Aufgabenliste nach Fälligkeitsklasse sortieren/gruppieren und Löschen mit Bestätigung absichern.

#### `/projects` — **7/10** _(Design: gemischt)_

Übersicht persönlicher Projekte mit Kategorie-Dashboards inkl. Fortschrittsbalken, kombinierbaren Kategorie-/Status-Filtern und Anlage-Formular. (`apps/studio/app/projects/page.tsx`)

- **Stärken:** Kategorie-Dashboards mit ARIA-Progressbar, Aktiv/Gesamt-Zahlen und zuletzt aktualisierten Projekten · Kategorie- und Status-Filter URL-getrieben kombinierbar, Formular-Kategorie folgt dem aktiven Filter · Einheitliches Anlage-Formular über AdminEntityForm, kontextabhängiger EmptyState-Text
- **Schwächen:** Zwei fast identische Chip-Reihen direkt untereinander ("Nach Status filtern" und "Status offen") — redundant und verwirrend · Aktiv-Markierung erneut über data-severity="warn" plus Inline-Outline-Style statt Design-System-Klasse · "Kosten (Cent)" als rohes Zahlenfeld ist nutzerunfreundlich (Cent- statt Euro-Eingabe)
- **Quickwin:** Die beiden Status-Chip-Sektionen zu einer einzigen klickbaren Chip-Reihe mit Zählern zusammenführen.

#### `/projects/[id]` — **7/10** _(Design: gemischt)_

Projekt-Detailseite mit Schritt-Checkliste, 1-Klick-Statuswechsel, Mediathek, Quick-Capture, Übersichtskarten und vollem Edit-Formular. (`apps/studio/app/projects/[id]/page.tsx`)

- **Stärken:** Schritt-Checkliste mit aria-pressed-Toggle, Fortschrittszähler und Inline-Hinzufügen — bestes Interaktionsmuster der Gruppe · Bedingte Sektionen (Nächster Schritt, Beschreibung, Notizen, Captures) halten die Seite schlank; Breadcrumb plus Anker-Link zum Edit-Formular · Links-Feld mit Format-Hint und Monospace-Eingabe
- **Schwächen:** Bis zu 12 Sektionen ohne Priorisierung — "Schnell erfassen" und "Domänen-Module" stehen vor dem eigentlichen Projektinhalt · uwe-list-cards/uwe-list-card ist in keiner CSS-Datei definiert — die Domänen-Module-Liste rendert ungestylt · "Projekt löschen" ohne Bestätigung und ohne Danger-Styling (btn-secondary) am Seitenende
- **Quickwin:** Sektionsreihenfolge umdrehen (Schritte/Nächster Schritt/Übersicht zuerst) und Löschen mit Bestätigung plus Danger-Button versehen.

#### `/ideas` — **7/10** _(Design: gemischt)_

Drei-Spalten-Ideen-Workspace: Ideenliste mit Views/Filtern, KI-Chat zur Schärfung und Prompt-Spalte mit Cursor-Dispatch inkl. Job-Statuspolling. (`apps/studio/app/ideas/page.tsx`)

- **Stärken:** Durchgängiger Workflow (Idee → Chat → Prompt → Cursor) mit 5s-Statuspolling, Copy/Save/Dispatch und disabled-Begründung per title plus Konfigurations-Hinweisen · Konsistente Zustände: Empty-State pro Spalte, busy-Labels ("KI antwortet…"), Fehler-/Info-Meldungen, Badges für Lifecycle/Typ/Status · Views und Filter URL-getrieben, Workspace-Kontext bleibt über hidden fields in allen Server Actions erhalten
- **Schwächen:** Drei-Spalten-Grid bricht erst spät auf eine Spalte — auf mittleren Screens sehr enge, dichte Spalten · Filterwechsel via window.location.href erzwingt Voll-Reload mit Zustandsverlust statt router.push · Pro Listeneintrag zwei zusätzliche Formulare (Status setzen, Löschen); Löschen ohne Bestätigung
- **Quickwin:** Löschen mit Bestätigung absichern und Filternavigation auf router.push umstellen.

#### `/bugs` — **7/10** _(Design: gemischt)_

Bug-Center zum Melden, Filtern und Priorisieren von Fehlern mit Screenshot-Upload, Detail-Editing und GitHub-Issue-Sync. (`apps/studio/app/bugs/page.tsx`)

- **Stärken:** Klare 2-Spalten-IA (Liste + Meldeformular links, Detail-Editor rechts) mit responsivem Zusammenbruch auf eine Spalte · Vorbildliche Zustandskommunikation: disabled GitHub-Button mit erklärendem title und konkretem Env-Var-Hint, busy-Label, Empty-State bei Filterung · Filter-Kontext bleibt über hidden fields bei jeder Status-/Schwere-/Lösch-Aktion erhalten
- **Schwächen:** Drei separate Formulare (Status, Schwere, Löschen) mit Selects in jedem Listeneintrag — Liste wirkt überladen; Löschen ohne Bestätigung · Statuswechsel braucht Select plus separaten Button statt onChange-Submit — zwei Interaktionen pro Änderung · Detail-Panel recycelt uwe-idea-*-Klassen aus dem Ideen-Modul — Konsistenz- und Wartungsschuld
- **Quickwin:** Listeneinträge auf Titel plus Badges reduzieren und Status-/Schwere-Änderung ins Detail-Panel konsolidieren.

#### `/finance` — **8/10** _(Design: gemischt)_

Read-only Finanz- und Abo-Übersicht mit Gesamtkosten, Kündigungsfristen, Review-Kandidaten, KI-Kosten und Aufschlüsselung nach Kategorie/Intervall. (`apps/studio/app/finance/page.tsx`)

- **Stärken:** Klare Sektionsgliederung in v2-Cards mit Stat-Grid für KPIs und Zeitraum-Chips inkl. aria-current · Jede Sektion hat einen eigenen, konkreten Empty-State-Text; zentrale EmptyState-Komponente bei Kategorien · Sauberes read-only Konzept: Bearbeitung konsequent nach /contracts verlinkt statt Formulardopplung
- **Schwächen:** Aktiver Zeitraum-Chip wird über data-severity="warn" markiert — Warnfarbe als Aktiv-Zustand ist semantisch irreführend · uwe-table-Tabellen ohne overflow-x-Wrapper — auf schmalen Screens laufen 4-Spalten-Tabellen über · Fristen-Liste ohne Dringlichkeits-Badges oder Sortierung nach Fälligkeit
- **Quickwin:** Aktive Filter-Chips mit echter Aktiv-Klasse statt severity=warn stylen und Tabellen in scrollbare Container packen.


### Studio: Kitchen (Küche, Vorrat, Plan, Rezepte, Einkauf) — Ø 6.8

_Die Kitchen-Gruppe ist funktional erstaunlich reif — URL-basierte Filter, KI-Draft-Flow mit explizitem Opt-in, Offline-Sync und Druckansicht zeigen echtes Nachdenken über Nutzungsszenarien. Stilistisch ist sie aber durchgehend ein Mix: V2-Buttons/Cards/Badges neben Legacy-Klassen (uwe-today-*, uwe-brain-create-form, uwe-badge) und vielen Inline-Styles, dazu Icon-Buttons ohne aria-labels. Die größten Hebel liegen in der Trennung von Lese- und Edit-Modus im Rezept-Detail, einem kompakteren Wochenplan-Layout und der Priorisierung des Kerninhalts auf der Einkaufsseite._

#### `/kitchen/recipes/[id]` — **6/10** _(Design: gemischt)_

Rezept-Detailseite mit Zutaten, Zubereitungsschritten, Bild-Upload, komplettem Bearbeitungsformular und Druckansicht. (`apps/studio/app/kitchen/recipes/[id]/page.tsx`)

- **Stärken:** Durchdachte Druckansicht: eigenes Print-Stylesheet blendet Navigation/Formulare aus, Seitenumbruch-Regeln für Überschriften und Listen · Informativer Header (Status, Zutatenzahl, Portionen, Dauer in der Summary) plus notFound() bei unbekannter ID · Empty States für fehlende Zutaten und fehlendes Bild vorhanden
- **Schwächen:** Kein getrennter Lese-/Edit-Modus: das 13+-Felder-Formular (inkl. 5 Rating-Feldern) ist immer voll ausgeklappt und dominiert die Seite · Beschreibung, Notizen, Quelle und Bewertungen erscheinen nur als Formular-Defaults, nicht in der Lese-Ansicht — wer nur kochen will, sieht diese Infos nicht · Archivieren-Button hängt lose als letztes Element ohne Sektion oder Bestätigungshinweis
- **Quickwin:** Lese- und Bearbeiten-Modus trennen (Formular einklappen bzw. ?edit=1) und Beschreibung plus Bewertungen prominent in der Lese-Ansicht zeigen.

#### `/kitchen/shopping` — **6/10** _(Design: gemischt)_

Einkaufslisten-Übersicht und -Detail mit Kategorie-Gruppierung, Abhaken, Bring!-Integration und Offline-Zwischenspeicher. (`apps/studio/app/kitchen/shopping/page.tsx`)

- **Stärken:** Offline-Konzept (ShoppingListOfflinePanel): localStorage-Cache, Pending-Replay bei Reconnect und klare Statustexte — passend zum Supermarkt-Anwendungsfall · Aktive Liste nach Einkaufs-Kategorien gruppiert, Abhaken mit Durchstreichen, datalist-Autocomplete für neue Positionen · Bring!-Feedback mit role='status' und ok/error-Farbcodierung; ehrliche Datenschutz-Erklärung beim Verbinden
- **Schwächen:** Die Bring!-Sync-Sektion steht vor den eigentlichen Listen und verdrängt den Kerninhalt; ein zweiter PageHeader mitten auf der Seite bricht die Hierarchie · Abhaken über ☑/☐-Submit-Buttons (Server-Roundtrip pro Klick) statt echter Checkboxen; '✕' ohne Bestätigung/aria-label · Keine Rückmeldung bei geöffneter Liste ohne Positionen (nur das nackte Hinzufügen-Feld); sehr viel Inline-Styling
- **Quickwin:** Bring!-Sektion einklappen oder ans Seitenende/in die Settings verlagern und Listen plus aktive Liste an den Seitenanfang — der Haupt-Task (abhaken) gehört nach oben.

#### `/kitchen` — **7/10** _(Design: gemischt)_

Küchen-Dashboard mit Kennzahlen zu Vorrat, offenen Einkaufslisten, nächster geplanter Mahlzeit und Rezept-Status plus Schnellzugriff und aktiven Rezepten. (`apps/studio/app/kitchen/page.tsx`)

- **Stärken:** Klare Informationsarchitektur: KPI-Karten, Schnellzugriff und Rezeptliste sauber in Sektionen getrennt, jede Karte verlinkt direkt zum Ziel · Zustände abgedeckt: 'Kein Eintrag in dieser Woche' und Empty State für aktive Rezepte mit CTA zum Anlegen · Die Karte 'Nächster Essensplan' zeigt handlungsrelevante Info (nächste ungekochte Mahlzeit mit Datum/Slot) statt nur einer Zahl
- **Schwächen:** Zwei KPI-Grids direkt hintereinander: die drei Status-Zählkarten (Aktiv/Entwurf/Archiviert) rechtfertigen keine eigenen großen Karten · Kennzahlen-Typografie per Inline-Style (fontSize: 2rem) statt Token/Klasse — auf jeder Karte wiederholt · Klassen-Mix aus V2 (uwe-v2-card/-btn) und Legacy (uwe-dashboard-*, uwe-today-card, uwe-brain-create-form als Button-Zeile zweckentfremdet)
- **Quickwin:** Die drei Status-Zählkarten zu einer kompakten Badge-/Chip-Zeile zusammenfassen und den frei werdenden Platz der Liste aktiver Rezepte geben.

#### `/kitchen/pantry` — **7/10** _(Design: gemischt)_

Vorratsverwaltung nach Lagerort gruppiert, mit MHD-Warnungen, Rezeptvorschlägen aus dem Vorrat und Anlege-Formular. (`apps/studio/app/kitchen/pantry/page.tsx`)

- **Stärken:** Sinnvolle Priorisierung: 'Bald ablaufend' erscheint nur bei Treffern ganz oben, mit Unterscheidung abgelaufen/bald (V2-Badges danger/warning) · 'Koche mit meinem Vorrat' verknüpft Vorrat und Rezepte (x von y Zutaten im Vorrat) — echter Mehrwert, inkl. Empty State · Bestand nach Lagerort gruppiert, Low-Stock-Toggle und Löschen direkt am Item
- **Schwächen:** Item-Zeilen als konkatenierter Text ('Name · Menge — knapp — bis Datum') mit Inline-Flex-Styles — bei vielen Vorräten schlecht scanbar, keine Spaltenstruktur · Löschen-Button '✕' ohne Bestätigung und ohne aria-label; auf derselben Seite legacy uwe-badge und uwe-v2-badge gemischt · Das immer sichtbare 6-Felder-Formular steht zwischen Vorschlägen und Bestand und drückt den eigentlichen Inhalt nach unten
- **Quickwin:** Bestand als strukturierte Zeilen/Tabelle mit festen Spalten (Name, Menge, MHD, Status-Badge) statt konkateniertem Text darstellen und das Anlege-Formular einklappbar machen.

#### `/kitchen/plan` — **7/10** _(Design: gemischt)_

Wochenplan pro Tag und Mahlzeit mit KI-Wochenvorschlag als Entwurf, Wochennavigation und Erzeugung einer Einkaufsliste. (`apps/studio/app/kitchen/plan/page.tsx`)

- **Stärken:** Durchdachter KI-Draft-Flow: Entwurf-Sektion mit explizitem Hinweis 'Nichts wird automatisch übernommen', Einträge einzeln übernehmen/verwerfen, verständliche Fehlertexte (engine_offline, parse_error) · Kontextsensitive Header-Actions: 'Einkaufsliste erzeugen' erscheint nur, wenn Einträge existieren; klare Wochennavigation (zurück/diese Woche/vor) · Schnelles Inline-Hinzufügen pro Tag (Slot + Rezept-Select + Notiz), gekochte Einträge durchgestrichen mit Toggle
- **Schwächen:** Kein Empty State für eine leere Woche — sieben Tagesüberschriften mit nackten Formularen, ohne Hinweis auf den KI-Vorschlag als Einstieg · Sieben identische, permanent sichtbare Formulare mit je einem vollen Rezept-Select untereinander — langes Scrollen statt kompakter Wochenraster-Ansicht · Icon-Buttons '✓/↺/✕' ohne aria-label oder title; viel Inline-Styling statt Klassen
- **Quickwin:** Die Woche auf Desktop als responsives Mo-So-Grid rendern und das Hinzufügen-Formular pro Tag aufklappbar machen statt sieben permanenter Formulare.

#### `/kitchen/recipes` — **8/10** _(Design: gemischt)_

Rezeptübersicht mit Status- und Tag-Filterchips, Sortierung nach Dauer/Bewertung und per URL einblendbarem Anlege-Formular. (`apps/studio/app/kitchen/recipes/page.tsx`)

- **Stärken:** Vollständige, URL-basierte Filter-UX (Status, Tag, Sortierung) mit aktiv markierten Chips — Zustände sind teil- und bookmarkbar · Echte EmptyState-Komponente aus shared-ui mit Beschreibung und CTA statt bloßem Muted-Text · Rezeptkarten mit nützlicher Vorschau: Status, Zutatenzahl, Dauer, Sterne-Rating und die ersten fünf Zutaten
- **Schwächen:** Sortierung lässt sich nicht zurücksetzen — es gibt keinen 'Titel/Standard'-Chip, nur 'Alle' (das auch die Filter verwirft) · '+ Neues Rezept' ist ein unscheinbarer Textlink unter den Chips statt Primär-Button in den PageHeader-Actions · Legacy-Chip-Klassen (uwe-today-quick-chip) und marginTop-Inline-Styles statt V2-Abstandsklassen
- **Quickwin:** 'Neues Rezept' als Primär-Button in die PageHeader-actions verschieben — die wichtigste Aktion der Seite ist aktuell versteckt.


### Studio: Wissen & Kommunikation (Knowledge, Mail, Suche, Prompts, Command, AI) — Ø 7.0

_Eine funktional starke Gruppe mit zwei Leuchttürmen: Das Mail Center ist ein vollwertiger 3-Spalten-Mail-Client mit eigenem Mobile-Konzept, und das Command Center zeigt einen vorbildlichen Parse-Bestätigen-Ausführen-Flow mit Audit-Trail. Durchgängige Schwäche ist die Stil-Fragmentierung: Praktisch jede Seite mischt v2-Klassen, Legacy-Helfer (uwe-dashboard-*, uwe-btn), Tailwind-Utilities und Inline-Styles — teils drei Ansätze in einer Datei. Die Formular-UX (Prompts, Compose) hinkt den Lese-Ansichten hinterher: unstrukturierte Felder, fehlende Lösch-Bestätigung, undifferenziertes Status-Feedback._

#### `/prompts` — **6/10** _(Design: gemischt)_

Prompt-Bibliothek: durchsuchbare, nach Kategorie und Tag filterbare Prompt-Vorlagen plus Inline-Formular zum Anlegen neuer Prompts. (`apps/studio/app/prompts/page.tsx`)

- **Stärken:** Filter-Zustand wird sauber durch die Kategorie-Chips getragen (q und tag bleiben in den Chip-URLs erhalten), aktiver Chip via aria-current · Empty State vorhanden ("Keine Prompts für diesen Filter") und Zurücksetzen-Link erscheint nur bei aktivem Filter · Anlegen ohne Seitenwechsel direkt auf der Seite möglich
- **Schwächen:** Drei Styling-Ansätze in einer Datei: Tailwind-Utilities im Filter-Formular, nackte Label/Inputs im Anlege-Formular, v2-Buttons und Inline-Styles dazwischen · Listen-Metadaten als ein zusammengeklebter Muted-Absatz (Badge · Variablenzahl · Tags · Beschreibung) — schlecht scanbar · Das immer voll ausgeklappte "Neuer Prompt"-Formular am Seitenende macht die Browsing-Seite lang und vermischt Lesen mit Anlegen
- **Quickwin:** Listen-Einträge strukturieren: Kategorie, Tags und Variablenzahl als getrennte Badges statt Fließtext-Absatz — größter Hebel für die Scanbarkeit der Bibliothek.

#### `/prompts/[id]` — **6/10** _(Design: gemischt)_

Prompt-Detailseite: Variablen live ausfüllen und Ergebnis kopieren, darunter Bearbeiten-Formular und Löschen des Templates. (`apps/studio/app/prompts/[id]/page.tsx`)

- **Stärken:** PromptFillClient ist gelungen: Live-Ersetzung der {{Variablen}} in der Vorschau, Copy-Button mit Feedback ("✓ Kopiert"), Hinweis wenn keine Variablen nötig · Gespeichert-Bestätigung nach dem Edit via ?saved mit role=status · Klare Kopfzeile mit Breadcrumb, Kategorie als Summary und Aktion "Als Agent Job starten"
- **Schwächen:** Prompt löschen ist ein einziger Klick ohne jede Bestätigung — destruktive Aktion im Look eines normalen kleinen Buttons · Nutzung (Ausfüllen/Kopieren) und Verwaltung (komplettes Edit-Formular) stehen ungetrennt untereinander — kein Tab/Collapse, die Seite wirkt doppelt · "Als Agent Job starten" verlinkt generisch auf /admin/agent-jobs, ohne den Prompt mitzugeben — der Kontext geht beim Wechsel verloren
- **Quickwin:** Lösch-Bestätigung einbauen (Confirm-Dialog oder Zwei-Schritt-Button) und den Button als destruktiv kennzeichnen — aktuell ist Datenverlust einen Fehlklick entfernt.

#### `/knowledge` — **7/10** _(Design: gemischt)_

Q&A-Wissensassistent über das lokale Life-Brain mit Konfidenz-Anzeige, optionaler Maschinenraum-Synthese und Quellen-Zitaten, plus Hub-Karten zu Life Brain und DnD Brain. (`apps/studio/app/knowledge/page.tsx`)

- **Stärken:** Klarer Seitenaufbau: Hub-Karten → Frage-Formular → Konfidenz → KI-Antwort → Quellen, mit Konfidenz-Ampel und Labels (Gut belegt/Unsicher) · Guter Empty State mit Handlungsvorschlag (Link auf /capture, wenn keine Quellen gefunden) · KI-Synthese als bewusster Opt-in-Schritt (eigener Button) statt automatisch — Quellen bleiben sichtbar maßgeblich
- **Schwächen:** Konfidenz-Farben als hartkodierte Hex-Werte (#2e7d32, #c62828) statt Theme-Tokens — im Dark Mode potenziell kontrastschwach · Viele Inline-Styles (Formular-Flex, Margins) statt Design-System-Klassen · Dritte Stat-Karte (Wissensassistent) ist als einzige nicht klickbar — inkonsistent zu den zwei Link-Karten daneben
- **Quickwin:** Konfidenz-Anzeige auf Badge-Klassen mit Theme-Tokens umstellen (statt Hex-Inline-Farben) — behebt Dark-Mode-Risiko und vereinheitlicht mit dem restlichen Badge-System.

#### `/mail/compose` — **7/10** _(Design: gemischt)_

Bereitet eine vorlagenbasierte Mail (Session-Recap, Handout, Warnungen …) mit Vorschau und Empfängerauswahl vor, Versand nur nach explizitem Klick. (`apps/studio/app/mail/compose/page.tsx`)

- **Stärken:** Sicherheits-UX durchdacht: Warnhinweise mit role=alert, separate DM-only-Bestätigungs-Checkbox, Senden-Button erst bei mindestens einem Empfänger aktiv · Entwurf wird alle 30s in localStorage gesichert (mit Zeitstempel-Anzeige) plus beforeunload-Schutz bei ungespeicherten Änderungen · Klarer Kontext-Header: Breadcrumb, Mail-Art im Titel, beruhigende Summary ("Keine automatischen Mails") und Welt-Verlinkung
- **Schwächen:** Status-Feedback undifferenziert: Erfolg und Fehler nutzen dieselbe uwe-notice-Klasse — visuell nicht unterscheidbar · Nach erfolgreichem Versand bleibt das gefüllte Formular unverändert stehen — kein Redirect, kein Reset, Doppelversand möglich · Quelle als rohe Technik-Codes angezeigt (sourceType/sourceId in <code>) statt lesbarem Label
- **Quickwin:** Sende-Ergebnis differenzieren: Erfolg grün mit Weiterleitung/Reset, Fehler rot mit role=alert — der aktuelle Einheits-Hinweis lässt den wichtigsten Moment der Seite unklar.

#### `/search` — **7/10** _(Design: gemischt)_

Globale Cross-Domain-Suche über Wiki, Medien/Soundboard, Tags und Daily-Admin-Daten mit adaptiver Filterleiste (Scope, Welt, Kampagne, Typ, Sichtbarkeit, Kanon). (`apps/studio/app/search/page.tsx`)

- **Stärken:** Adaptive Filterleiste mit Progressive Disclosure: Kampagnen-Filter nur bei gewählter Welt, Quest-Status nur beim Typ Quests, Admin-Typ nur im Admin-Scope — plus Mobile-Filter-Sheet · Ergebnisse sauber sektioniert mit Trefferzahl, Typ-/Sichtbarkeits-Badges und explizitem "Studio-only"-Badge auf Admin-Daten · Gute Zustände über EmptyState-Komponente ("Suche starten" ohne Query, "Keine Treffer" mit Query)
- **Schwächen:** Logik-Bug in der Sidebar: "Weltfilter zurücksetzen" rendert bei !worldSlug — der Link erscheint also nur, wenn gar kein Weltfilter aktiv ist · Media-, Tag- und Admin-Ergebnisse duplizieren das Ergebnis-Markup inline statt SearchResultsList wiederzuverwenden — inkl. h2 in Listeneinträgen (gebrochene Überschriften-Hierarchie) · Filter wirken erst nach Klick auf "Filtern" — bei sechs Selects ein spürbarer Reibungspunkt
- **Quickwin:** Die invertierte Bedingung des "Weltfilter zurücksetzen"-Links fixen (worldSlug statt !worldSlug) — ein Einzeiler, der ein sichtbar verwirrendes Verhalten behebt.

#### `/ai` — **7/10** _(Design: gemischt)_

KI-Hub: allgemeiner Chat ohne Brain-/Objekt-Kontext mit Provider-/Kontext-Wahl, plus Schnellstart-Links zu DnD-Brain, Life-Brain und Admin-Bereichen. (`apps/studio/app/ai/page.tsx`)

- **Stärken:** Zugriffsverweigerung wird als eigene, handlungsfähige Seite gerendert (Hinweis mit exaktem Freigabe-Pfad AI_CHAT_USE für den Master-Admin) · Prompt-Panel deckt alle Zustände ab: EmptyState bei KI-Offline, LoadingSpinner mit aria-live, ErrorAlert mit sanitisierten Fehlermeldungen, Sticky-Send-Bar für Mobile · Privacy-Scope wird direkt im Header kommuniziert ("ohne lokalen Brain-/Objekt-Kontext")
- **Schwächen:** Kein Verlauf: nur ein Prompt-Antwort-Paar, die vorherige Antwort wird beim nächsten Senden verworfen — für einen "Chat" untypisch · Antwort wird als roher Text-Div gerendert — KI-Antworten mit Markdown (Listen, Code) werden unformatiert angezeigt · Seite ist dünn: Titel "KI" plus Link-Card, die vermutlich die globale Navigation dupliziert; die Kernkomponente heißt MobileAiPromptPanel, dient aber als Desktop-Hauptinhalt
- **Quickwin:** KI-Antworten als Markdown rendern — Listen, Absätze und Code sind bei LLM-Antworten der Normalfall und derzeit die auffälligste Qualitätslücke des Panels.

#### `/mail` — **8/10** _(Design: gemischt)_

Vollwertiger Mail-Client mit Ordner-Rail, Nachrichtenliste, Reader, KI-Triage, Compose-Modal, Bulk-Aktionen und Tastatur-Navigation. (`apps/studio/app/mail/page.tsx`)

- **Stärken:** Echtes App-Layout mit durchdachtem Mobile-Konzept: Liste/Reader wechseln sich vollflächig ab, eigene Chip-Leiste (MobileMailBar) und Compose-FAB ersetzen die Desktop-Rail · Sehr vollständige Zustände: kontextsensitiver Empty-Inbox-Screen (Konto fehlt vs. leer), Sync-Fortschrittsbalken, Toast-Feedback, Loading beim Nachrichtendetail · Tastatur-Shortcuts (j/k/e/#/r/s//) mit sichtbarem Hinweis plus Auswahl-Modus für Bulk-Aktionen
- **Schwächen:** Ordner-Zähler sind irreführend: markiert/ungelesen werden nur aus der aktuell geladenen Teilmenge (inboxLimit) berechnet, nicht aus echten Totalen · Massiver Inline-Style-Einsatz (Progressbar, Toast, Layout-Container) statt Klassen — Mail hat faktisch ein eigenes Design-Subsystem (MailButton, mail-ui) neben v2 · Drafts/Sent werden über separate Pfade mit leerem portalResult gefüllt — Suchfeld und Kategorie-Filter greifen dort nicht
- **Quickwin:** Ordner- und Ungelesen-Zähler serverseitig als echte Counts ermitteln statt aus der geladenen Nachrichten-Teilmenge — die Zahlen in der Rail sind das erste, dem Nutzer vertrauen müssen.

#### `/command` — **8/10** _(Design: v2)_

NL Admin Command Center: Whitelist-Befehle in natürlicher Sprache mit Intent-Vorschau, Klartext-Bestätigung vor Mutationen, Ergebnis-Anzeige und Audit-Log. (`apps/studio/app/command/page.tsx`)

- **Stärken:** Vorbildlicher Drei-Schritt-Flow als getrennte Cards: Eingabe → Bestätigungs-Card mit strukturiertem Intent → Ergebnis-Card, plus Audit-Liste mit Loading- und Empty-State · Klickbare Beispiel-Befehle senken die Einstiegshürde des freien Textfelds erheblich · Saubere Zustandskommunikation: Buttons mit Progress-Texten ("Analysiere…", "Führe aus…"), Fehler mit role=alert, ?q= aus der Command-Palette wird vorgeparst, Ausführung bleibt bewusster zweiter Klick
- **Schwächen:** 15 Beispiel-Befehle als vertikale Button-Liste fressen viel Platz — als Chip-Grid wäre die Card halb so hoch · Bestätigungs-Card zeigt nur bei den drei Lock-Intents Details; kritische Mutationen wie delete_user zeigen bloß den rohen Intent-Code plus Textzeile · Ergebnisdaten von List-Intents (list_users, list_worlds) landen als roher JSON-Dump im <pre> statt als Tabelle
- **Quickwin:** Listen-Ergebnisse (Benutzer, Welten, Mitglieder) als einfache Tabelle rendern statt JSON-Dump — die Lese-Befehle sind der häufigste Anwendungsfall und aktuell am schwersten lesbar.


### Studio: Life-Brain & Brain — Ø 6.6

_Die Life-Brain-Gruppe ist funktional erstaunlich reif — Zugriffs-Gates, Maschinenraum-Status-Differenzierung, Such-Feedback und Empty States sind fast überall vorhanden und konkret formuliert. Durchgängige Schwächen sind der Mischzustand aus v2-Klassen, Legacy-Klassen (uwe-today-card, uwe-form-grid) und Inline-Styles, der zweckentfremdete Fehler-Stil für Privacy-Hinweise sowie Lösch-Aktionen ohne Bestätigung auf beiden Detailseiten. Die /brain-Übersicht fällt gestalterisch ab (Legacy-lastig, nutzlose Sidebar-Legende) und die Fakt-Detailseite hinkt der Dokument-Seite funktional hinterher._

#### `/life-brain/documents/[id]` — **6/10** _(Design: gemischt)_

Detailseite eines Life-Brain-Dokuments mit Lese-/Bearbeiten-Umschalter, Tag-Pflege, verknüpften Captures und Reindex-Aktion. (`apps/studio/app/life-brain/documents/[id]/page.tsx`)

- **Stärken:** ViewEditToggle trennt Lese- und Bearbeitungsansicht sauber; notFound() korrekt behandelt · Sinnvolle Sektionen: Metadaten-Zeile, Inhalt, Quellen/Captures, Verknüpfungen (AdminEntityLinksPanel rendert sich bei 0 Einträgen selbst weg), Indexierung
- **Schwächen:** "Dokument löschen" ohne jede Bestätigung, optisch als harmloser Secondary-Button — hohes Datenverlustrisiko · Edit-Modus zerfällt in drei getrennte Formulare (Inhalt, Tags, Löschen) ohne gemeinsamen Rahmen; kein Erfolgs-/Fehler-Feedback nach Server Actions · Privacy-Hinweis erneut in Fehler-Optik; "Zurück zur Suche"-Button dupliziert die Breadcrumb
- **Quickwin:** Lösch-Button mit Bestätigungsdialog versehen und als destruktive Aktion (rot, abgesetzt) gestalten.

#### `/life-brain/facts/[id]` — **6/10** _(Design: gemischt)_

Detailseite eines Life-Brain-Fakts mit Inhalt, verknüpften Captures, ähnlichen Fakten und Tag-Bearbeitung. (`apps/studio/app/life-brain/facts/[id]/page.tsx`)

- **Stärken:** "Ähnliche Fakten" per Suchdienst mit Vorschau-Snippets ist ein durchdachtes Discovery-Feature · Klare Sektionsgliederung in einer Karte (Inhalt, Quellen, Ähnliche, Tags); Datumsformatierung konsistent via Intl
- **Schwächen:** Titel, Inhalt und Typ sind nicht editierbar — inkonsistent zur Dokument-Detailseite mit ViewEditToggle; nur Tags lassen sich ändern · "Fakt löschen" ohne Bestätigung als unauffälliger Button am Kartenende · Meta-Zeile quetscht Typ, Tags und zwei Zeitstempel in einen Fließtext; mehrere Inline-Styles statt Systemklassen
- **Quickwin:** ViewEditToggle von der Dokument-Seite übernehmen, damit Titel/Inhalt/Typ editierbar werden — schließt die größte Funktionslücke.

#### `/brain` — **6/10** _(Design: gemischt)_

Welten-übergreifende Übersicht des DnD-Brain-Knowledge-Stores mit Zähler-Summary und Einträge-Vorschau pro Welt. (`apps/studio/app/brain/page.tsx`)

- **Stärken:** Gute Informationsdichte pro Welt: Summary-Zeile (Dokumente/Fakten/Chunks) plus Vorschau-Tabelle mit VisibilityBadge und Status · Tabelle nutzt data-label-Attribute für mobile Kartendarstellung; EmptyState bei null Welten vorhanden · Header grenzt DnD-Brain explizit vom privaten Life-Brain ab — verhindert Verwechslung
- **Schwächen:** Sidebar-Legende "Sichtbarkeit" listet nur fettgedruckte Labels ohne jede Erklärung — belegt Platz ohne Mehrwert · Vorschau kappt hart bei 5 Dokumenten + 5 Fakten ohne "+X weitere"-Hinweis; Welten ohne Einträge zeigen nur Überschrift und Button · Überwiegend Legacy-Klassen (uwe-brain-*, uwe-page-table, uwe-hint) mit einzelnem v2-Button; doppelter Link zum Brain Store (Button + Text-Link) im Footer jeder Sektion
- **Quickwin:** Vorschau-Kappung sichtbar machen: "+X weitere Einträge"-Link unter der Tabelle, der direkt in den Brain Store der Welt führt.

#### `/life-brain` — **7/10** _(Design: gemischt)_

Übersichts- und Verwaltungsseite des persönlichen Life-Brains mit Maschinenraum-Index-Status, Live-Suche, Anlage-Formularen und Listen aller Dokumente und Fakten. (`apps/studio/app/life-brain/page.tsx`)

- **Stärken:** Vorbildliche Zustände: Suche mit Debounce, Loading, Fehler, Kein-Treffer-Meldung, Min-2-Zeichen-Hinweis und Match-Mode-Anzeige (semantisch/keyword) · Index-Panel differenziert vier Maschinenraum-Zustände (ready/offline/disabled/no-model) mit klaren Handlungshinweisen und Stat-Grid · Guter Empty State mit konkreten Einstiegen (Capture, Chat) statt leerer Fläche
- **Schwächen:** Frontlastiger Aufbau: Index-Panel, Suche und zwei Erstell-Formulare stehen vor den eigentlichen Inhaltslisten — bei bis zu 100 Dokumenten + 100 Fakten ohne Pagination wird die Seite sehr lang · Privacy-Hinweis nutzt die Fehler-Klasse uwe-form-error für eine rein informative Notiz — visuell irreführend · Karten-Listen nutzen Legacy-Klassen (uwe-today-card, uwe-dashboard-muted) im v2-Rahmen
- **Quickwin:** Dokument-/Fakten-Listen vor die Formulare ziehen und die Erstell-Karten einklappbar machen — die Inhalte sind der Hauptzweck der Seite.

#### `/life-brain/chat` — **8/10** _(Design: gemischt)_

Chat-Oberfläche für Fragen an das persönliche Wissen, ausschließlich über den lokalen Maschinenraum ohne Cloud-Fallback. (`apps/studio/app/life-brain/chat/page.tsx`)

- **Stärken:** Vollständige Zustandsabdeckung: Zugriffs-Gate mit konkreter Admin-Anleitung und Links, Maschinenraum-offline-Hinweis mit deaktiviertem Senden, Beispielfrage als Empty State, Spinner und ErrorAlert · Durchdachte Chat-Details: Maschinenraum-Status-Badge mit Polling, Auto-Scroll, Verlauf-leeren-Button, Modell-Anzeige nach Antwort · Schlanke, fokussierte Seite — Header, Panel, fertig; klare Breadcrumb-Einbettung
- **Schwächen:** Kein Streaming: lange lokale Antworten zeigen nur einen Spinner, die Seite wirkt währenddessen hängend · Verlauf lebt nur im React-State — Reload löscht alles, ohne Hinweis darauf · Layout über Inline-Styles (flex, gap, maxHeight) statt Design-System-Klassen; Nachrichten-Bubbles nutzen Legacy uwe-today-card
- **Quickwin:** Streaming-Antworten (oder zumindest eine leere Assistant-Bubble mit Tipp-Indikator) statt reinem Spinner — größter gefühlter Geschwindigkeitsgewinn.


### Studio: Image Studio, Workshop & Miniatures — Ø 6.0

_Die Gruppe hat eine durchgängig solide Informationsarchitektur (Breadcrumbs, EmptyStates, Filter-Chips, klare PageHeader), aber zwei systemische Schwächen: Erstens rendern mehrere Bibliotheksseiten (Recipes, Rental, Miniatures) jedes Listenelement als komplettes Inline-Edit-Formular, was bei mehr als einer Handvoll Einträgen zu einer unscanbaren Formularwand führt. Zweitens sind alle Seiten Design-System-gemischt (uwe-v2-* neben Legacy-Klassen wie uwe-today-card/uwe-brain-create-form), und im Image Studio werden sogar nirgends definierte CSS-Klassen (uwe-list-cards, uwe-kv-list) verwendet — die Projekt- und Versionslisten eines Bild-Tools zeigen zudem keine Bild-Thumbnails._

#### `/workshop/recipes` — **4/10** _(Design: gemischt)_

Bibliothek wiederverwendbarer Paint-Anleitungen mit Anlage- und Inline-Bearbeitung. (`apps/studio/app/workshop/recipes/page.tsx`)

- **Stärken:** In-Place-Bearbeitung ohne Extra-Detailseite, inklusive Rückverlinkung zum Quellprojekt · EmptyState und konsistente v2-Buttons vorhanden
- **Schwächen:** Jedes Bibliothekselement ist ein komplettes 11-Felder-Edit-Formular — bei 200er-Limit eine unscanbare Formularwand ohne Lese-Ansicht · Anzeige-Infos (Farben-Zusammenfassung, Ergebnisfoto, Projektlink) sind mitten zwischen Formularfeldern vergraben · Kein Filter nach Ziel (Miniatur/Terrain/Diorama), obwohl targetType und Labels existieren
- **Quickwin:** Rezepte als kompakte Lese-Karten (Name, Ziel, Rating, Foto, Farbkette) rendern und das Edit-Formular nur per 'Bearbeiten'-Toggle öffnen.

#### `/workshop/[id]` — **5/10** _(Design: gemischt)_

Projekt-Cockpit mit Riesen-Edit-Formular, Übersichts-Cards, Fotogalerien sowie eingebetteten Paint-Rezept- und Druckprofil-Formularen. (`apps/studio/app/workshop/[id]/page.tsx`)

- **Stärken:** Alles an einem Ort: Materialien, Farben, Links, Fotos, Rezepte und Druckprofile projektbezogen gebündelt · Foto-Upload-Felder mit Kamera-Capture (capture=environment), die Uploads direkt in die Formularfelder eintragen · Übersichts-Cards zeigen die geparsten Material-/Farb-/Link-Daten lesbar an
- **Schwächen:** Edit-first statt read-first: Ein ~20-Felder-Formular dominiert die Seite, die lesbare Übersicht kommt erst danach — dieselben Daten erscheinen doppelt · Fünf Pipe-/Spezialsyntax-Textareas (Materialien, Farben, Filamente, Links, Fotos) ohne Validierung oder Syntax-Hilfe · 'Projekt löschen'-Button am Seitenende ohne Bestätigungsdialog und ohne Gefahr-Styling (nur Secondary-Button)
- **Quickwin:** Seite in Lese-Ansicht mit 'Bearbeiten'-Toggle umbauen: Übersicht und Fotos zuerst, das Formular nur auf Anforderung.

#### `/workshop/rental` — **5/10** _(Design: gemischt)_

Verwaltung von Terrain-Verleih-Sets mit Verfügbarkeitsübersicht, Checklisten, Kaution und ICS-Export der Rückgabetermine. (`apps/studio/app/workshop/rental/page.tsx`)

- **Stärken:** Verfügbarkeits-Badges je Status geben sofort den Bestandsüberblick · ICS-Export der Rückgabetermine als Header-Action ist eine durchdachte Integration · Übergabe-/Rückgabe-Checklisten mit [x]-Syntax und Platzhalter-Beispiel
- **Schwächen:** Gleiches Formularwand-Anti-Pattern: Jedes Set ist ein 12-Felder-Edit-Formular, die scanbare Zusammenfassung (Status, Miete, Kaution) steht erst am Formular-Ende · Rückgabedatum wird per Parse-Hack im Notizen-Feld gespeichert (parseRentalReturnDue/stripRentalReturnDue) — fragil und für Nutzer undurchsichtig · Geldbeträge müssen in Cent eingegeben werden ('Kaution (Cent)': 5000 statt 50 €) — hohe Fehlbedienungsgefahr
- **Quickwin:** Geld-Eingaben auf Euro mit Dezimalstellen umstellen (Umrechnung in Cent in der Action) — beseitigt die größte Fehlerquelle bei Preisen und Kaution.

#### `/image-studio/[projectId]/edit` — **6/10** _(Design: gemischt)_

Canvas-Editor zum Drehen des aktuellen Projektbilds und Speichern als neue Version, plus lokaler Prompt-Verlauf. (`apps/studio/app/image-studio/[projectId]/edit/page.tsx`)

- **Stärken:** Saubere dreistufige Breadcrumb und klarer Rückweg zum Projekt · Editor hat gute Zustände: Buttons disabled bis Bild geladen, 'Speichern…'-Pending und Erfolgs-/Fehlermeldung · Ehrlicher Hinweistext, der den begrenzten Funktionsumfang erklärt und zum KI-Generator verweist
- **Schwächen:** Seite heißt 'Bearbeiten', kann aber nur in 90°-Schritten drehen — Erwartung und Funktionsumfang klaffen auseinander · Projekt ohne Asset liefert hartes notFound() (404) statt einer Erklärung mit Link zum Generator · Prompt-Verlauf ist reines manuelles localStorage-Notizfeld — er speist sich nicht aus den tatsächlich abgeschickten Jobs und füllt kein Formular vor
- **Quickwin:** Bei fehlendem Asset statt 404 eine EmptyState-Seite mit Erklärung und Link zum Generator zeigen.

#### `/workshop/print-profiles` — **6/10** _(Design: gemischt)_

Bibliothek dokumentierter 3D-Drucklauf-Profile mit Anlage-Formular und JSON-Import/-Export. (`apps/studio/app/workshop/print-profiles/page.tsx`)

- **Stärken:** Import-Feedback vorbildlich: Erfolg (role=status) und zwei unterscheidbare Fehlerfälle (role=alert) über Query-Params · JSON-Export/-Import erlaubt Sicherung und Austausch der Profildaten · Historie-Karten verlinken zurück zum zugehörigen Werkstatt-Projekt, EmptyState vorhanden
- **Schwächen:** Zehn unstrukturierte Freitextfelder ohne Pflichtfelder oder Auswahllisten — selbst 'Ergebnis' (gut/mittel/schlecht) ist Freitext statt Select · Meta-Zeile der Karten degeneriert bei leeren Feldern zu ' · Düse · Layer ' ohne Fallbacks · Bis zu 200 Historie-Einträge ohne Suche, Filter (z. B. nach Drucker/Filament) oder Sortierung
- **Quickwin:** 'Ergebnis' als Select (gut/mittel/schlecht) plus Filterchips nach Drucker/Ergebnis über der Historie — macht die Historie als Nachschlagewerk nutzbar.

#### `/miniatures` — **6/10** _(Design: gemischt)_

Miniaturen-Sammlung mit Fortschritts-Statistik, kombinierbaren Filtern (Status/Hersteller/Spielsystem) und Inline-Pflege inkl. Fotovergleich. (`apps/studio/app/miniatures/page.tsx`)

- **Stärken:** Filter-Engineering vorbildlich: buildFilterHref kombiniert Status-, Hersteller- und System-Filter in der URL und erhält den restlichen Zustand, inkl. aria-current und Reset-Link · Stat-Grid mit Zählern und Prozenten je Status gibt sofort den Bemalungs-Fortschritt der Sammlung wieder · Karten zeigen Name, Status, Menge und Meta-Zeile vor dem Formular — plus Referenz-/Vergleichsfoto-Feature
- **Schwächen:** Jedes Sammlungsitem bettet erneut das komplette 8-Felder-Edit-Formular ein — bei Limit 500 Items eine massive Formularwand · Hersteller-/Systemfilter als Button-Reihen skalieren nicht (jeder Wert ein eigener Button, kein Select/Suchfeld) · Das immer offene 'Neue Miniatur'-Formular steht zwischen Filtern und Sammlung und unterbricht den Fluss
- **Quickwin:** Items als kompakte Karten mit 'Bearbeiten'-Toggle rendern (Formular nur bei params.selected öffnen — der Mechanismus existiert schon halb über data-selected).

#### `/image-studio` — **7/10** _(Design: gemischt)_

Übersicht aller Image-Studio-Projekte mit Statusfilter plus Generator zum Anlegen neuer Bild-Jobs. (`apps/studio/app/image-studio/page.tsx`)

- **Stärken:** Durchdachte responsive Generator-Lösung: Desktop öffnet ein ToolWindow, Mobile zeigt das Formular inline (per CSS-Breakpoint umgeschaltet) · Deaktiviert-Zustand sauber behandelt: Warn-Notice mit Direktlink zu den Einstellungen, Formular-Button disabled · Statusfilter-Chips und EmptyState mit konkreter Handlungsaufforderung vorhanden
- **Schwächen:** Projektliste nutzt die Klassen uwe-list-cards/uwe-list-card, die in keinem CSS definiert sind — die Liste rendert faktisch ungestylt · Ein Bild-Tool ohne Bilder: Vorschau nur als Link, der das Roh-Asset in neuem Tab öffnet, keine Thumbnails · Aktiver Filter-Chip wird über data-severity="warn" (Warnfarbe) markiert — Semantik-Missbrauch statt Aktiv-Zustand
- **Quickwin:** Projektkarten mit Inline-Thumbnail der letzten Version rendern und die undefinierten uwe-list-cards-Klassen durch gestylte Karten (z. B. uwe-today-card/CardV2) ersetzen.

#### `/image-studio/[projectId]` — **7/10** _(Design: gemischt)_

Projekt-Detailseite zum Prüfen der Versionen, Nachbearbeiten per Folge-Job und Übernehmen des Assets in verknüpfte Seiten. (`apps/studio/app/image-studio/[projectId]/page.tsx`)

- **Stärken:** Fehlerzustand vorbildlich: Bei status=failed erscheint die konkrete Fehlermeldung plus Retry-Button in einer Error-Notice · Kontextstarker Folge-Job: Formular ist mit Prompt, Titel, Welt und Quell-Asset des Projekts vorbefüllt · Versions-Filter (mit/ohne Asset), Bulk-Download und Link zur Medienbibliothek im Header
- **Schwächen:** Status-Badge schwebt lose unter dem Header und wird in der Review-Card gleich nochmal angezeigt — Redundanz ohne Layout-Anker · Versionsliste (uwe-list-cards, ohne CSS-Definition) zeigt keine Thumbnails, nur 'Vorschau'-Links in neue Tabs — Versionen lassen sich nicht visuell vergleichen · Inline-Styles (marginTop) statt Abstands-Klassen in ImageStudioProjectReview
- **Quickwin:** Versionen als Bild-Grid mit Inline-Thumbnails darstellen, damit man Varianten direkt auf der Seite vergleichen und auswählen kann.

#### `/workshop` — **8/10** _(Design: gemischt)_

Hobby-Cockpit mit Filterbarer Projektliste, Aktiv-Übersicht und Schnellanlage für Werkstatt-Projekte. (`apps/studio/app/workshop/page.tsx`)

- **Stärken:** Ein-Klick-Workflow: '→ nächster Status'-Button direkt auf jeder Projektkarte treibt Projekte ohne Detailseite voran · Informationsdichte Karten: Thumbnail, Typ/Status, Welt-Link, Material-Bereitschaft (x/y bereit, n fehlen) und nächster Schritt · Filter-Chips mit Zählern, EmptyState mit Capture-Link und PageHeaderV2 über AdminModulePage
- **Schwächen:** Materialerfassung per Pipe-Syntax-Textarea ('Name | Menge | ja/nein') ist fehleranfällig und unentdeckbar · Das immer voll ausgeklappte Anlege-Formular (7 Felder) schiebt die eigentliche Projektliste weit nach unten · 'Aktive Projekte'-Sektion dupliziert Inhalte, die der Filter 'Aktiv' ohnehin liefert
- **Quickwin:** Das Anlege-Formular einklappbar machen (Details/Accordion), damit die Projektliste ohne Scrollen sichtbar ist.


### Studio: Admin A (Übersicht, Aktivität, AI, Tokens) — Ø 7.0

_Die Admin-A-Gruppe steht auf einem einheitlichen Gerüst (SystemShell + BreadcrumbTrail + PageHeader) und deckt Loading-/Fehler-/Empty-Zustände überwiegend sauber ab — die Workspaces für Aktivität, Tokens und Audit sind funktional durchdacht. Jede Seite mischt jedoch V2-CSS-Klassen mit Legacy-uwe.css-Klassen und Inline-Styles, was die visuelle Konsistenz untergräbt. Konkrete Detailfehler drücken die Politur: nirgends definierte CSS-Klassen (Agent-Jobs-Verlauf), ein ignorierter Deep-Link-Filter (?source=audit), fehlende Bestätigungen und Pending-Zustände bei destruktiven bzw. sofort speichernden Aktionen._

#### `/admin/agent-jobs` — **5/10** _(Design: gemischt)_

Startet Dev-Agent-Jobs (GitHub Actions / Cursor Cloud) per Preset oder Freitext-Prompt und zeigt den Job-Verlauf mit Live-Polling. (`apps/studio/app/admin/agent-jobs/page.tsx`)

- **Stärken:** Verlauf mit EmptyState-Komponente, 10s-Polling inkl. sichtbarem Hinweis und Retry-Button für fehlgeschlagene Jobs · Presets platzsparend in <details> eingeklappt; deutliche Sicherheitswarnung zu Prompt-Inhalten · Status-Sektion macht Konfigurationslücken (Token fehlt, Auto-Merge-Warnung) sofort sichtbar
- **Schwächen:** Die Verlaufs-Klassen uwe-list-cards/uwe-list-card sind in keinem CSS definiert — der Kerninhalt rendert als ungestylte Browser-Liste, Badges und Texte laufen zusammen · Server-Action-Formulare ohne Pending-Zustand und ohne Erfolgs-Feedback nach Job-Start; Doppel-Submit möglich · Status-Karte ist eine rohe Text-Liste statt Badges; deaktivierter Zustand zeigt trotzdem alle Formulare voll an, Hinweis verlangt manuelles Env-Setzen
- **Quickwin:** Den Job-Verlauf auf definierte uwe-v2-card-Styles umstellen (oder die fehlenden uwe-list-card-Klassen definieren) — aktuell wirkt der wichtigste Seitenteil kaputt.

#### `/admin` — **7/10** _(Design: gemischt)_

Admin-Hub mit Systemstatus-Badge, kritischen Warnungen und gruppierten Schnellzugriffen auf alle Admin-Bereiche. (`apps/studio/app/admin/page.tsx`)

- **Stärken:** Klare thematische Gruppierung in vier Bereichs-Karten (Setup, Nutzer, Content & KI, Betrieb) plus HealthBadge direkt im Header · Kritische Produktions-Warnungen werden prominent mit role="alert" und Direktlinks über dem Inhalt angezeigt · Fallback-UX: fehlt die Portal-URL, wird stattdessen ein 'Portal konfigurieren'-Link angeboten
- **Schwächen:** Reine Link-Farm ohne Status pro Bereich — nur ein globales OK/Degraded-Badge, keine Signale an den Karten · 'Diagnose' und 'Erweiterte Karten' verlinken auf exakt dieselbe URL (/system?tab=diagnose) — verwirrende Dublette · Layout über Inline-Styles (flex/gap/margin) statt Klassen; uwe-section-subtitle ist in keinem CSS definiert
- **Quickwin:** Bereichs-Karten mit Status-Signalen anreichern (z.B. Warnungs-Zähler pro Bereich) und den doppelten Diagnose-Link entfernen.

#### `/admin/activity` — **7/10** _(Design: gemischt)_

Vereint ActivityLog, AuditLog und KI-Nutzung in einer chronologischen, filterbaren Verlaufansicht mit Pagination. (`apps/studio/app/admin/activity/page.tsx`)

- **Stärken:** Vollständige Zustandsabdeckung: Loading, Fehleranzeige, Empty State und Pagination mit Seitenzähler · Sinnvolle Filter (Quelle, Welt, Schweregrad, Zeitraum) inkl. kontextuellem Hinweis, dass KI-Nutzung global ist · Einträge mit Severity-Badge, Zeitstempel und 'Ziel öffnen'-Aktion gut scanbar
- **Schwächen:** Der Deep-Link ?source=audit (von der Audit-Log-Seite verlinkt) wird ignoriert — die Komponente liest keine URL-Parameter · Beim Laden verschwindet die komplette Liste zugunsten von 'Lade Verlauf…' — Layout springt bei jedem Filter-/Seitenwechsel · Severity wird auf semantisch fremde Badge-Klassen gemappt (error→uwe-badge-secret, warn→uwe-badge-draft); Meta zeigt rohe Slugs/User-IDs
- **Quickwin:** useSearchParams auswerten, damit ?source=audit den Quellen-Filter vorbelegt — sonst ist der Cross-Link vom Audit Log wertlos.

#### `/admin/api-tokens` — **7/10** _(Design: gemischt)_

Erstellt und verwaltet persönliche API-Tokens mit Scopes, Ablauf-Presets und Widerruf. (`apps/studio/app/admin/api-tokens/page.tsx`)

- **Stärken:** One-Time-Secret sauber gelöst: Token nur einmal sichtbar, Copy-Button mit 'Kopiert'-Feedback, deutliche Warnbox · Tabelle mit allen relevanten Spalten (Prefix, Scopes, Ablauf, letzte Nutzung, Status) inkl. Abgelaufen-Erkennung; Loading- und Empty-State vorhanden · Sinnvolle Ablauf-Presets mit sicherem Default (1 Jahr) und Scope-Checkboxen mit 'eng halten'-Hinweis
- **Schwächen:** 'Widerrufen' feuert ohne Bestätigungsdialog — destruktive Ein-Klick-Aktion · Keine Client-Validierung: 'Token erstellen' ist auch mit leerem Namen und null Scopes aktiv, Fehler kommt erst vom Server; kein Pending-Zustand (Doppel-Submit möglich) · Token-Tabelle ohne Overflow-Wrapper (anders als beim Audit Log) — auf schmalen Viewports läuft sie aus dem Layout
- **Quickwin:** Widerruf mit Bestätigungsdialog absichern und 'Token erstellen' erst aktivieren, wenn Name und mindestens ein Scope gesetzt sind.

#### `/admin/audit-log` — **7/10** _(Design: gemischt)_

Filterbare Tabelle sicherheitsrelevanter Aktionen mit gehashten IP/UA-Werten, CSV-Export und Pagination. (`apps/studio/app/admin/audit-log/page.tsx`)

- **Stärken:** Reiche Filter (Action-Labels vom Server, User/World, Von/Bis-Zeitraum) plus CSV-Export direkt aus der Filter-Karte · Tabelle im uwe-page-table-wrap-Overflow-Container — mobil scrollt die Tabelle statt der Seite; Metadata wird menschenlesbar aufbereitet (App, E-Mail, Grund, Fehler) · Cross-Link zum einheitlichen Verlauf ordnet die Seite in die IA ein; Loading-/Fehler-/Empty-Zustände vorhanden
- **Schwächen:** CSV-Export exportiert stillschweigend nur die aktuelle Seite (25 Einträge) — weder beschriftet noch serverseitig vollständig · User-ID/World-ID nur als rohe ID-Textfelder filterbar und auch in der Tabelle als nackte IDs angezeigt — ohne Namen kaum nutzbar · Der beworbene Link '/admin/activity?source=audit' filtert dort tatsächlich nichts vor (Empfängerseite ignoriert den Parameter)
- **Quickwin:** CSV-Export auf alle gefilterten Einträge ausweiten (Server-Endpoint) oder klar als 'aktuelle Seite' beschriften.

#### `/admin/ai-gateway` — **8/10** _(Design: gemischt)_

Owner-Konfiguration des KI-Routings: Maschinenraum-Bevorzugung, Cloud-Fallback, Privacy, Modelle, Budgets, Freigaben und Logs in sechs Tabs. (`apps/studio/app/admin/ai-gateway/page.tsx`)

- **Stärken:** Große Konfigurationsdomäne sauber in Overview-Karte + 6 Tabs zerlegt (je Tab eine eigene, kleine Komponente) · Zustände vollständig: Ladehinweis, Fehler mit role="alert", Erfolgsmeldungen mit role="status", Maschinenraum-Status mit Handlungsanleitung · Sinnvolle Sicherheits-UX: API-Key nur als Passwortfeld beim Setzen, nie wieder angezeigt
- **Schwächen:** Breadcrumb weicht vom Rest der Gruppe ab (Dashboard → Maschinenraum → …) obwohl die Navigation über /admin führt · Heißt 'Wizard', ist aber kein geführter Ablauf — Erst-Einrichtung ohne Schrittfolge oder Fortschritt · Sofort speichernde Selects/Checkboxen ohne Feld-Pending-Feedback (nur globale Meldung); Provider-Liste als nackte <ul>, Legacy-Button (uwe-button-primary) neben v2-Buttons
- **Quickwin:** Breadcrumb auf Admin → KI-Gateway vereinheitlichen und Sofort-Speichern-Controls ein sichtbares Speichert…/Gespeichert-Feedback pro Feld geben.

#### `/admin/ai-prompt` — **8/10** _(Design: gemischt)_

Editor für den System-Prompt des allgemeinen KI-Chats mit lokalem Entwurf und explizitem Aktivieren. (`apps/studio/app/admin/ai-prompt/page.tsx`)

- **Stärken:** Sicheres Entwurf-vs-Aktiv-Modell: getrennte Karten, explizites 'Als aktiv setzen', Abweichungs-Warnung und Aktivierungs-Bestätigung mit role="status" · Entwurf überlebt Reloads via localStorage; leerer aktiver Prompt zeigt verständlichen Fallback ('Standard-Prompt eingebaut') · Direkter Test-Link zum KI-Chat mit durchgereichten Kontext-Parametern
- **Schwächen:** localStorage-Entwurf überschreibt beim Mount kommentarlos den Server-Stand — ein veralteter lokaler Entwurf erscheint ohne Hinweis als aktueller Zustand · 'Entwurf zurücksetzen' verwirft ohne Rückfrage sofort den lokalen Entwurf · Styling der <pre>/<textarea> komplett über Inline-Styles statt Design-System-Klassen
- **Quickwin:** Beim Laden eines abweichenden localStorage-Entwurfs einen Hinweis 'lokaler Entwurf geladen' mit Verwerfen-Option zeigen, statt still zu überschreiben.


### Studio: Admin B (Checklist, Cockpit, Migrations, Rollen) — Ø 6.9

_Die Admin-B-Gruppe ist durchweg solide gebaut: identisches Grundgerüst (SystemShell, Breadcrumb, PageHeader mit HealthBadge), klare Sektionsgliederung und bei Migrations und Secrets vorbildliche Zustandslogik mit konditionalen Sektionen und konkreten Handlungsanweisungen. Kein einziges Page nutzt jedoch die V2-React-Komponenten — überall werden uwe-v2-CSS-Klassen mit Legacy-Klassen (uwe-badge, uwe-table, uwe-today-card) und vielen Inline-Styles gemischt, was die Konsistenz untergräbt. Größter Ausreißer nach unten ist der Review-Workspace: funktional komplett, aber ohne Empty State und mit rohem JSON-Diff als zentraler Arbeitsfläche._

#### `/admin/reviews` — **5/10** _(Design: gemischt)_

Workspace zum Sichten, Kommentieren, Freigeben und Ablehnen offener Änderungsvorschläge (KI, Co-DM, Spielernotizen) inkl. Bulk-Approve. (`apps/studio/app/admin/reviews/page.tsx`)

- **Stärken:** Vollständiger Workflow: Filter, Master-Detail-Layout, Kommentare, Einzel- und Bulk-Freigabe · Loading- und Fehlerzustand vorhanden; Detail-Pane mit Diff-Vorschau und Ziel-Link · Responsives auto-fit-Grid lässt Liste und Detail auf schmalen Screens untereinander fallen
- **Schwächen:** Kein Empty State: bei 0 Treffern bleibt eine leere Tabelle ohne jeden Hinweis stehen · Diff wird als rohes JSON.stringify im <pre> gerendert — für die Kernaufgabe (Änderung beurteilen) kaum lesbar · World-Filter verlangt eine rohe worldId als Freitext; Inputs/Buttons großteils per Inline-Style, kein Feedback während Aktionen
- **Quickwin:** Den JSON-Diff durch eine lesbare Vorher/Nachher-Felddarstellung ersetzen — das ist der Kern des Review-Vorgangs.

#### `/admin/cockpit` — **6/10** _(Design: gemischt)_

Read-only Owner-Dashboard mit Nutzern, Welten, letzten Fehlern, AI-Kosten und letzten Änderungen inkl. 30s-Auto-Refresh. (`apps/studio/app/admin/cockpit/page.tsx`)

- **Stärken:** Klare Sektionsgliederung mit HealthBadge (OK / Aufmerksamkeit nötig) im Header · Auto-Refresh alle 30s plus manueller 'Jetzt aktualisieren'-Button (OwnerCockpitRefresh) · Fehler-Sektion hat expliziten Empty State ('Keine offenen Fehler') mit Detail-Links
- **Schwächen:** Welten und Letzte Änderungen haben keinen Empty State — leere Sektionen bleiben kommentarlos leer · AI-Kosten ist nur ein nackter Absatz, bricht die Card-Optik der übrigen Sektionen · Nutzer-Card-Überschrift '{n} aktive Rollen-Zählung' ist sprachlich schief; alles einspaltig statt kompakter KPI-Zeile
- **Quickwin:** Nutzer, Welten-Anzahl, Fehler und AI-Kosten als einheitliche KPI-Kachelzeile oben bündeln — verwandelt die lange Einspalten-Liste in ein echtes Cockpit.

#### `/admin/checklist` — **7/10** _(Design: gemischt)_

Owner-Onboarding-Checkliste mit Fortschrittsbalken über System, Zugriff, Mail, Maschinenraum, Welten, Migrationen und Backup. (`apps/studio/app/admin/checklist/page.tsx`)

- **Stärken:** Klarer Aufbau: Fortschritts-Card mit Balken und Zählern oben, danach Sektionen pro Kategorie · Pro Punkt Status-Badge, 'Auto'-Kennzeichnung für live ermittelte Checks und Deep-Link 'Öffnen →' · HealthBadge mit Prozentwert im PageHeader gibt sofort Gesamtstand
- **Schwächen:** Status-Badges zweckentfremden Legacy-Klassen (badge-published/draft/secret/player) statt semantischer Statusfarben · Item-Layout ist ein starrer Flex-Row ohne Wrap — Titel + Badge quetschen sich auf schmalen Screens · Kein Filter oder Priorisierung: erledigte und offene Punkte stehen gleichwertig untereinander
- **Quickwin:** Offene und Warnung-Punkte an den Anfang sortieren oder einen 'Nur offene'-Filter ergänzen, damit Handlungsbedarf sofort sichtbar ist.

#### `/admin/cookbook` — **7/10** _(Design: gemischt)_

Zeigt Hardware-Profil, lokale Runtime, Modell-Empfehlungen pro Use Case (filterbar), Engine-Status, installierte Modelle und Setup-Hinweise. (`apps/studio/app/admin/cookbook/page.tsx`)

- **Stärken:** StatusCards mit Level, Details und Next Steps machen Hardware-/Runtime-Zustand sofort lesbar · Privacy-/Routing-Warnungen als role=alert prominent oben; Empty State bei 'Keine Modelle erkannt' · Client-seitiger Kategorie-Filter (CookbookRecommendationsPanel) für die Empfehlungs-Cards
- **Schwächen:** Sieben Sektionen untereinander ohne Tabs oder Sprungnavigation — sehr lange, dichte Seite · Filter-Select ist unstyled (nacktes label/select ohne Formular-Klassen); kein Empty State, wenn der Filter 0 Treffer liefert · Katalog-Tabelle ohne uwe-table-wrap, Karten-in-Karten-Verschachtelung (uwe-v2-card in uwe-v2-card)
- **Quickwin:** Seite in Tabs oder eine Sprungnavigation gliedern (Empfehlungen / Status / Katalog / Setup) — reduziert die Scroll-Länge massiv.

#### `/admin/roles` — **7/10** _(Design: gemischt)_

Read-only Capability-Matrix für globale Studio-Rollen und Welt-Mitgliedschaften plus Capability-Referenzliste. (`apps/studio/app/admin/roles/page.tsx`)

- **Stärken:** Capabilities nach Bereich in einklappbare <details>-Gruppen gegliedert, erste Gruppe offen — bändigt die große Matrix · Tabellen in overflow-x-Wrapper — breite Matrizen bleiben mobil scrollbar · Notice verweist klar auf /admin/users für tatsächliche Rollenänderungen (Erwartungsmanagement)
- **Schwächen:** Zellen nur '✓'/'—' ohne Farbe oder Screenreader-Semantik — schwer scanbar in großen Tabellen · Global/Welt-Umschaltung hängt am fragilen String-Check title.includes('Globale') · Zwei volle Matrizen plus Referenzliste untereinander, keine Suche/Filter für einzelne Capabilities
- **Quickwin:** Suchfeld über den Matrizen, das Capability-Zeilen filtert und die passende Gruppe aufklappt.

#### `/admin/migrations` — **8/10** _(Design: gemischt)_

Read-only Inspector für angewendete, ausstehende und fehlerhafte Prisma-Migrationen mit konkreten CLI-Reparaturschritten. (`apps/studio/app/admin/migrations/page.tsx`)

- **Stärken:** Vorbildliche Zustandslogik: StatusCard mit ok/degraded/error, Sektionen erscheinen nur bei Bedarf · Konkrete Next Steps inkl. exaktem Deploy-Befehl und Backup-Hinweis statt generischer Fehlermeldung · Angewendete Migrationen in <details> eingeklappt — Seite bleibt im Normalfall angenehm kurz; Querlinks zu Diagnose-Seiten
- **Schwächen:** Abstände durchgehend per Inline-Style statt Layout-Klassen · Zeitstempel via toLocaleString('de-DE') statt der etablierten formatStudioDateTime-Utility — inkonsistent zum Rest · Deploy-Befehl nur als <code>-Text, nicht kopierbar
- **Quickwin:** Copy-Button am Deploy-Befehl (pnpm --filter @uwe/database db:deploy) — der eine Handgriff, den die Seite im Fehlerfall verlangt.

#### `/admin/secrets` — **8/10** _(Design: gemischt)_

Read-only Statusübersicht aller bekannten Secrets mit Quelle, maskiertem Last-4, Rotationshinweisen und Warnungen — ohne Klartext. (`apps/studio/app/admin/secrets/page.tsx`)

- **Stärken:** Durchdachte Zustandslogik: Warnungs-Sektion mit Severity-Badges, dedizierter Alert für decrypt_failed nach AUTH_SECRET-Rotation, Rotationshinweis pro Zeile · Tabellen in uwe-table-wrap, Host-ENV-Sektion einklappbar und öffnet sich automatisch bei Problemen, Summary-Zähler pro Sektion · Klarer Header mit HealthBadge (kritische Warnungen gezählt) und Link zum Security Dashboard; Zugriffe werden auditiert
- **Schwächen:** Severity-Badge zeigt rohe englische Werte ('critical'/'warning') im sonst deutschen UI · 6-Spalten-Tabelle sehr dicht — auf Mobile trotz Scroll-Wrap mühsam · Viele Inline-Styles für Abstände statt Utility-/Layout-Klassen
- **Quickwin:** Severity-Labels lokalisieren und Warnungen nach Schweregrad sortieren, damit Kritisches immer zuoberst steht.


### Studio: Admin C (Security, Status, Users, Webhooks) — Ø 7.0

_Die Admin-C-Gruppe ist überdurchschnittlich solide: alle Seiten teilen SystemShell, Breadcrumbs und PageHeader, und Loading-/Empty-/Error-Zustände sind fast überall vorhanden — für Admin-Seiten keine Selbstverständlichkeit. Durchgängige Schwäche ist der Stilmix aus v2-Karten/-Buttons, Legacy-Klassen (uwe-badge, uwe-table, uwe-dashboard-*), Tailwind-Utilities und Inline-Styles, wodurch Abstände und Badge-Farben von Seite zu Seite variieren. Größte funktionale Lücken: fehlende Verwaltungsaktionen bei Webhooks, harte Listen-Kappungen ohne Hinweis (Tags, Deliveries) und fehlende Pending-States bei Users/Webhooks._

#### `/admin/status` — **6/10** _(Design: unklar)_

Legacy-Route ohne eigene UI — leitet direkt zum konsolidierten System-Hub-Diagnose-Tab (/system?tab=diagnose) um. (`apps/studio/app/admin/status/page.tsx`)

- **Stärken:** Saubere Konsolidierung statt totem Link: alte Bookmarks landen im neuen System-Hub · Kommentar dokumentiert die Migration und dass die JSON-API unter /api/admin/status erhalten bleibt
- **Schwächen:** redirect() erzeugt einen temporären 307 — für eine dauerhaft konsolidierte Route wäre permanentRedirect() korrekt · Kein Übergangs-Hinweis für Nutzer, die /admin/status noch aus Doku oder Links kennen (z.B. kurze Notice am Ziel)
- **Quickwin:** permanentRedirect() verwenden, damit Browser und Crawler die neue URL dauerhaft lernen.

#### `/admin/tags` — **6/10** _(Design: gemischt)_

Tag-Aufräumer: Inventar analysieren, ähnliche Schreibweisen als Merge-Vorschläge anzeigen, Tags zusammenführen und Legacy-Tags nach EntityTag backfillen. (`apps/studio/app/admin/tags/page.tsx`)

- **Stärken:** Durchdachter Workflow: Merge-Vorschlag per Klick ins Formular übernehmen, danach automatisches Neuladen des Inventars · Loading- und Error-Zustände vorhanden, Buttons zeigen Pending-Text ("Merge läuft…", "Backfill läuft…") und sind währenddessen disabled · Coverage-Sektion erklärt die Datenquelle (EntityTag vs. Legacy-JSON) — gute Transparenz für ein Admin-Werkzeug
- **Schwächen:** Listen hart gekappt (20 Vorschläge, 30 Kandidaten, 100 Inventar-Zeilen) ohne Hinweis oder Pagination — bei großen Welten unsichtbar abgeschnitten · Merge-Fehler und -Erfolg landen in derselben unauffälligen Textklasse (uwe-dashboard-muted) — Fehler sind nicht als Fehler erkennbar · Kein Bestätigungsdialog vor dem Merge, obwohl er viele Entitäten auf einmal verändert und nicht rückgängig zu machen ist
- **Quickwin:** Merge-Ergebnis als klaren Erfolg-/Fehler-Alert stylen und vor dem Merge eine Bestätigung mit der Anzahl betroffener Referenzen einblenden.

#### `/admin/setup` — **7/10** _(Design: gemischt)_

Tab-basierte Owner-/Host-Einrichtung (System, Zugriff, Cloudflare, Mail, Maschinenraum, Drucker, Diagnose) mit Status-Tabellen, Speicher-Formularen und Test-Panels. (`apps/studio/app/admin/setup/page.tsx`)

- **Stärken:** URL-basierte Tabs (verlinkbar, server-gerendert) mit sinnvoller Sektions-Ansicht: Status-Badge, nextSteps-Notice und Prüfpunkt-Tabelle mit Quelle-Badges (Datenbank/Umgebung/Host-Secret) · Rollen-bewusstes UI: Nicht-Owner sehen expliziten Lesemodus-Hinweis, Formulare erscheinen nur für Owner · Gute Formular-Details: Passwort-Placeholder "Leer = bestehendes Passwort", autoComplete-Attribute, gespeichert-Bestätigung
- **Schwächen:** Drei gestapelte uwe-notice-Absätze zwischen Header und Tabs erzeugen Hinweis-Rauschen, bevor der eigentliche Inhalt beginnt · Erfolgsmeldung hängt am Query-Param saved=1 und bleibt bei Reload/Tab-Wechsel-Zurück bestehen · Langes SMTP-Formular ohne Untergruppierung und ohne Client-Validierung (z.B. Port-Bereich, Pflichtfelder)
- **Quickwin:** Die drei Hinweis-Absätze zu einem kompakten Hinweis zusammenfassen (oder in den Diagnose-Tab verschieben), damit Tabs und Sektion direkt unter dem Header sichtbar sind.

#### `/admin/webhooks` — **7/10** _(Design: gemischt)_

Outbound-Webhooks verwalten: Endpunkte mit Event-Auswahl anlegen, Endpunkt-Liste einsehen und Delivery-Log mit Retry für Fehlschläge. (`apps/studio/app/admin/webhooks/page.tsx`)

- **Stärken:** Vorbildlicher Secret-Flow: einmalige Anzeige des Signing Secrets als Warn-Notice mit Copy-Button, Tabelle zeigt danach nur den Prefix · Delivery-Log mit Retry nur bei Fehlschlägen inkl. Pending-State pro Zeile (retryingId) · Empty- und Loading-States in allen drei Sektionen, SSRF-Hinweis direkt im Formular
- **Schwächen:** Endpunkte sind nach dem Anlegen unveränderbar: kein Bearbeiten, Deaktivieren oder Löschen — isActive wird geladen, aber nirgends angezeigt oder steuerbar · Delivery-Log zeigt fix 25 Einträge von deliveryTotal ohne Pagination oder Fehler-Filter (failedOnly hart auf 0) · Kein Erstellen-Pending-State und keine Client-Validierung (Events-Pflicht, leerer Name) — Fehler erst nach Server-Roundtrip
- **Quickwin:** Endpunkt-Zeilen um Aktionen erweitern (Deaktivieren/Löschen) und den isActive-Status sichtbar machen — aktuell ist ein falsch angelegter Webhook nur per API entfernbar.

#### `/admin/security` — **8/10** _(Design: gemischt)_

Read-only Security-Dashboard: prüft Auth, Rollen, ENV-Secrets, Routen-Schutz, Backups, Upload-/AI-Policy, CSP und zeigt das Sicherheits-Audit-Log. (`apps/studio/app/admin/security/page.tsx`)

- **Stärken:** Sauber behandelter Zugriff-verweigert-Zustand mit Begründung, angezeigter Rolle und konkreter Handlungsanweisung · Klare Kartenstruktur (StatusCard mit HealthBadge, Detail-Liste als dl-Grid, nextSteps) plus Warnungen-Sektion prominent oben · Durchdachte Extras: CSP-Entwurf-Prüfer mit Live-Analyse, Zeitstempel/angemeldeter Nutzer, Link zur JSON-API
- **Schwächen:** Viele Inline-Styles (marginTop/marginBottom) statt Spacing-Klassen des Design-Systems · Generische Detail-Labels wie "Check 1", "Check 2", "Rate Limit 1" statt sprechender Bezeichnungen · Severity-Badges in der Warnungen-Liste sind unfarbig und zeigen rohe englische Werte ("critical") ohne visuelle Abstufung
- **Quickwin:** Warnungs-Severity farbcodieren (warn/critical als uwe-badge-warning/-danger) und Checklisten-Details echte Labels geben statt durchnummerierter "Check N".

#### `/admin/users` — **8/10** _(Design: gemischt)_

Benutzerverwaltung: Nutzer anlegen und bearbeiten, Rollen/Status setzen, Welt-Mitgliedschaften pflegen und Portalzugriff diagnostizieren. (`apps/studio/app/admin/users/page.tsx`)

- **Stärken:** Vollständige Zustände: Loading, leerer Filter-Zustand, Fehler mit role="alert", Confirm vor endgültigem Löschen · Portal-Bereitschafts-Badge pro Zeile (Inaktiv / Login unvollständig / Keine Welten / Portal bereit) plus separater Portalzugriff-Prüfer mit Check-Liste — sehr hilfreiche Diagnose · Sinnvolle Werkzeuge: Rollen-/Status-Filter, letzter Login in der Tabelle, Passwort-Reset optional im Edit-Formular
- **Schwächen:** "Bearbeiten" öffnet eine dritte Karte weit unterhalb der Tabelle ohne Scroll-Führung — auf langen Listen wirkt der Klick folgenlos · Kein Pending-/Disabled-State auf Erstellen/Speichern/Löschen-Buttons — Doppelklicks feuern doppelte Requests · Anlegen-Formular ohne Pflichtfeld-Markierung oder Client-Validierung; Fehler kommen erst vom Server
- **Quickwin:** Nach Klick auf "Bearbeiten" zum Edit-Panel scrollen (oder als Dialog öffnen) und Aktions-Buttons während laufender Requests disablen.


### Studio: System (Health, Host-Control, Printers, Navigation, ...) — Ø 7.3

_Die System-Gruppe ist funktional stark: Fast jede Seite denkt an Offline-, Leer- und Fehlerzustände (Maschinenraum-offline-Erklärung, Stale-Flag im Command Center, Empty States), was für Admin-Bereiche ungewöhnlich gut ist. Größtes Problem ist die visuelle Uneinheitlichkeit: Drei Styling-Generationen (Legacy uwe.css-Klassen, uwe-v2-CSS und das studio-lokale Tailwind-Token-Kit) plus viele Inline-Styles existieren nebeneinander, sodass sich z. B. Health, Cloudflare und Maschinenraum wie Seiten aus verschiedenen Apps anfühlen. Der /system-Hub dupliziert zudem Inhalte seiner Unterseiten (Jobs/App-Status doppelt in Übersicht und Diagnose), und schwächere Seiten wie Drucker und KnowHow wirken unfertig gegenüber dem sehr durchdachten Command Center._

#### `/system/printers` — **5/10** _(Design: gemischt)_

Status des Maschinenraum-Label-Drucks: verbundene Drucker, Druck-Queue und manuelle Drucker-Suche mit 30-Sekunden-Polling. (`apps/studio/app/system/printers/page.tsx`)

- **Stärken:** Polling behält bei Fehlern den letzten guten Snapshot; Zeitstempel zeigt Aktualität · Offline-, Fehler- und Erfolgs-Alerts plus Empty States vorhanden
- **Schwächen:** Drucker und Jobs als nackte <p>-Zeilen ohne Status-Badges, Farben oder Aktionen — die Queue-Statuslabels bleiben reiner Text · Empty States ohne Beschreibung oder Handlungsempfehlung ("Keine Drucker" / "Leer" erklären nicht, dass der Connector laufen muss) · Initial-Error aus der URL bleibt dauerhaft stehen (useState ohne Setter), auch wenn Polling längst wieder OK ist
- **Quickwin:** Job-Status als farbige Badges rendern (Status-Mapping existiert schon via LABEL_PRINT_QUEUE_STATUS_LABELS) — verwandelt die Textliste in eine lesbare Queue.

#### `/system/uwe-knowhow` — **6/10** _(Design: v2)_

Durchsuchbare Systemhilfe über README, CHANGELOG und docs/ mit Volltextfilter und Quellen-Chips. (`apps/studio/app/system/uwe-knowhow/page.tsx`)

- **Stärken:** Suche mit aria-Label, Quellen-Filter-Chips und Treffer-Zähler ("X von N Dokumenten") · Empty State erklärt den Standalone-Build-Fall verständlich
- **Schwächen:** Klick auf einen Doku-Titel öffnet nicht das Dokument, sondern setzt nur Suchfeld und Filter — der Kern-Use-Case (Inhalt lesen) ist eine Sackgasse · Kein Empty State bei 0 Suchtreffern — nur eine leere Liste unter "0 von N Dokumenten" · Keine Hervorhebung des Suchbegriffs in Treffern
- **Quickwin:** Doku-Klick den tatsächlichen Inhalt öffnen lassen (Detail-Ansicht oder Expand-Panel) — erst damit erfüllt die Seite ihr Versprechen als Systemhilfe.

#### `/system` — **7/10** _(Design: gemischt)_

Zentraler System-Hub mit Tabs für Übersicht, Homelab-Status, Diagnose und Cloudflare-Kurzstatus. (`apps/studio/app/system/page.tsx`)

- **Stärken:** Klare IA: PageHeader mit Gesamt-Badge, Erklärung System vs. Admin, Tab-Navigation über URL-Parameter (bookmarkbar) · Status-Cards mit Ampel-Leveln, Details und nextSteps; Homelab-Sicherheitswarnungen prominent als role=alert · Schnellzugriff-Sektion verlinkt alle relevanten Unterseiten
- **Schwächen:** Redundanz: UWE-App- und Jobs-Cards erscheinen identisch in Übersicht und Diagnose; Kurzstatus + Header-Badge + Tab-Inhalt zeigen dreifach denselben Zustand · Stil-Mix aus uwe-v2-Klassen, Legacy-Klassen (uwe-dashboard-*, uwe-settings-tabs, uwe-homelab-*) und vielen Inline-Styles · Links mal als Text-Pfeil, mal als v2-Button — keine einheitliche Link-Sprache
- **Quickwin:** Doppelte Status-Cards zwischen Übersicht und Diagnose deduplizieren (Übersicht nur Ampeln + Link zur Diagnose) — macht den Hub sofort schlanker.

#### `/system/health` — **7/10** _(Design: gemischt)_

Health-Ampel mit DB-Größe, größten Tabellen, Upload-Volumen und Maschinenraum-Erreichbarkeit inkl. manuellem Refresh. (`apps/studio/app/system/health/page.tsx`)

- **Stärken:** Refresh mit sauberem Fehler- und Loading-State; Session-Verlauf der letzten Checks · Ampel-Metapher mit Dot + Klartext-Label sofort verständlich · Empty State für Tabellen, kontextuelle Links (Migrations-Inspector, Maschinenraum)
- **Schwächen:** Hardcodierte Hex-Farben (#2e7d32 etc.) statt Design-Tokens — bricht bei Theme-Wechsel · Handgebaute Balken-Visualisierung per Inline-Style-width statt einer Komponente; Listen statt Cards wirken dünn neben den Schwesterseiten · Verlauf nur pro Session (geht bei Reload verloren) ohne Hinweis darauf
- **Quickwin:** Ampel-Farben auf CSS-Variablen des Design-Systems umstellen — kleiner Diff, behebt Theme-Bruch und Konsistenz gleichzeitig.

#### `/system/engine-connector` — **7/10** _(Design: gemischt)_

Verwaltung der Maschinenraum-Worker: Token-Ausgabe, Status, Capability-Governance, Workflow-Standardmodelle, Privacy-Regeln und Setup-Anleitung. (`apps/studio/app/system/engine-connector/page.tsx`)

- **Stärken:** Offline-Zustand wird vorbildlich als Normalfall erklärt statt als Fehler; Umzugs-Hinweis vom Cookbook mit Kontext · Token-UX durchdacht: nur einmal sichtbar, user-select:all, klare Einbau-Anleitung; Buttons mit erklärenden title-Tooltips · Setup-Schritte, Privacy-Guard und Governance direkt auf der Seite — kein Doku-Wechsel nötig
- **Schwächen:** Sehr lange Seite mit 8+ Sektionen ohne Sub-Navigation oder Anker · "Entfernen" löscht einen Connector ohne Bestätigungsdialog — einzige destruktive Aktion der Gruppe ohne Confirm · Massiver Stil-Mix: uwe-v2-Klassen, Legacy-Grids (uwe-homelab-*, uwe-dashboard-*) und dutzende Inline-Styles
- **Quickwin:** Bestätigungsdialog vor dem Connector-Löschen einbauen — verhindert versehentlichen Verlust von Token und Konfiguration mit einem Klick.

#### `/system/startklar` — **7/10** _(Design: v2)_

Post-Update-Checkliste: Env-Änderungen, Abhängigkeiten, Migrationen, Backup-Empfehlung und neue Release Notes mit Als-gelesen-Bestätigung. (`apps/studio/app/system/startklar/page.tsx`)

- **Stärken:** Aufgabenorientierte IA ("Was musst du tun?") mit Versions-Bestätigungs-Workflow per Server Action · Jede erledigte Sektion zeigt eine positive Bestätigung statt leer zu bleiben · Kontextuelle Deep-Links pro Abhängigkeit (Health, Maschinenraum, Cloudflare, Backup, Migrationen)
- **Schwächen:** Status als Text-Zeichen (✓/⚠/✗) statt Design-System-Badges/Dots — Fehler und Warnungen kaum visuell unterscheidbar · Env-Issues nur als Fließtext-Liste; "Fehler" vs. "Warnung" ohne Farbe oder Alert-Ton · Link-Zuordnung pro Service-ID als harte if-Kette im JSX — inkonsistent, wenn neue Abhängigkeiten dazukommen
- **Quickwin:** Env-Issues und Abhängigkeiten auf die vorhandenen Alert-/Severity-Dot-Komponenten umstellen — die Checkliste wird auf einen Blick scanbar.

#### `/system/cloudflare` — **8/10** _(Design: v2)_

Anzeige und Bearbeitung der Cloudflare-/Deployment-Konfiguration (Routing, Tunnel, Turnstile, Sicherheits-Flags) mit DB-vs-Env-Herkunft. (`apps/studio/app/system/cloudflare/page.tsx`)

- **Stärken:** DB/Env-Source-Badges pro Wert machen die Konfigurations-Herkunft transparent — sehr durchdacht · Klare Zustände: Saved-Bestätigung, Healthy/Unhealthy-Alert, Info-Alert erklärt was sofort greift vs. Neustart braucht · Formular sauber in Cards gruppiert; Secret-Feld mit "leer lassen um zu behalten"-Placeholder und explizitem Lösch-Checkbox
- **Schwächen:** dl-Grid mit fester 14rem-Labelspalte bricht auf schmalen Screens nicht um · Kein Pending-State am Speichern-Button, keine Client-Validierung der URLs · Header verweist auf docs/cloudflare-current-setup.md als toten Code-Text statt Link
- **Quickwin:** Labelspalte der Status-Listen responsiv machen (grid-cols-1 sm:grid-cols-[14rem_1fr]) — behebt das einzige echte Mobile-Problem der Seite.

#### `/system/host-control` — **8/10** _(Design: v2)_

Owner-Übersicht des Systemzustands (DB, Storage, Sicherheit, Dienste) plus geschützter Host-Neustart. (`apps/studio/app/system/host-control/page.tsx`)

- **Stärken:** Konsistentes Card+Definition-List-Muster über fünf Bereiche; klare Success/Warning/Danger-Alerts inkl. AUTH_SECRET-Sonderfall · Neustart gut abgesichert: Owner-Gating, Verfügbarkeits-Check, Bestätigung per RESTART-Eingabe, Audit-Hinweis · Diagnose-Card verlinkt Healthcheck, Audit-Log, Cloudflare und Backup
- **Schwächen:** Reine Ja/Nein-Werte ohne Severity-Markierung pro Zeile — "AUTH_SECRET schwach: Ja" sieht genauso aus wie ein OK-Wert · Feste 16rem-Labelspalte nicht mobiltauglich · HostRestartPanel meldet Erfolg über den Error-State (gleiche rote Darstellung für "Neustart ausgelöst")
- **Quickwin:** Kritische Zeilen (schwaches Secret, fehlende Migrationen) mit Severity-Dot/Badge einfärben, damit Probleme in den Ja/Nein-Listen ins Auge springen.

#### `/system/navigation` — **8/10** _(Design: v2)_

Audit- und Verwaltungsseite der zentralen Navigation: tote Links, Duplikate, geplante Routen und Sidebar-Sichtbarkeit pro Eintrag. (`apps/studio/app/system/navigation/page.tsx`)

- **Stärken:** Audit-getriebene Alerts (tote Links, aktivierbare geplante Routen, Duplikate) plus explizites Erfolgs-Alert wenn alles sauber ist · Sortier-/filterbare DataTable mit Live-Sichtbarkeits-Toggle, der server- und localStorage-seitig persistiert · Sektion "Routen ohne Navigationseintrag" schließt die umgekehrte Lücke
- **Schwächen:** 9-Spalten-Tabelle auf Mobilgeräten kaum nutzbar · Sichtbarkeits-Toggle gibt kein Feedback bei fehlgeschlagener Server-Persistenz (Fehler wird still geschluckt) · Icon-Spalte ohne Header und Rollen-/Quelle-Spalten blähen die Tabelle für den Hauptzweck auf
- **Quickwin:** Fehlgeschlagene Persistenz des Sichtbarkeits-Toggles per Toast/Alert melden, sonst glaubt der Owner, die Einstellung sei geräteübergreifend gespeichert.

#### `/system/version` — **8/10** _(Design: v2)_

Anzeige der Build- und Deploy-Metadaten (Version, Commit, Branch, Build-Zeit, Deploy-Run) mit Copy-Funktion. (`apps/studio/app/system/version/page.tsx`)

- **Stärken:** Eng fokussierte Single-Purpose-Seite mit max-w-2xl, sauberem dl-Layout und Copy-to-Clipboard · Fallback "unbekannt (lokal/Dev)" statt leerer Werte; Footnote erklärt die Env-Variablen-Herkunft · Direkter Absprung zum Changelog
- **Schwächen:** Titel verspricht "Version & Updates", bietet aber keinerlei Update-Prüfung oder -Aktion · Feste 10rem-Labelspalte im dl-Grid ohne Mobile-Umbruch
- **Quickwin:** Entweder eine "Auf Updates prüfen"-Aktion ergänzen oder den Titel auf "Version" kürzen — aktuell weckt der Header eine falsche Erwartung.

#### `/system/whats-new` — **8/10** _(Design: v2)_

Release Notes aus CHANGELOG.md als Karten pro Version mit Hervorhebung der installierten Version. (`apps/studio/app/system/whats-new/page.tsx`)

- **Stärken:** Installierte Version wird per Ring + Badge markiert, Unreleased als "In Entwicklung" gekennzeichnet · Changelog-Sektionen ins Deutsche übersetzt, Datumsformat lokalisiert, Inline-Bold geparst · Empty State erklärt fehlendes CHANGELOG im Standalone-Build
- **Schwächen:** Alle Releases werden vollständig ausgerollt — bei langem Changelog eine endlose Seite ohne Collapse oder Pagination · Keine Sprungnavigation/Anker zu einer bestimmten Version
- **Quickwin:** Ältere Releases standardmäßig einklappen (nur aktuelle + neuere offen) — hält die Seite auch nach Jahren nutzbar.

#### `/system/command-center` — **9/10** _(Design: gemischt)_

Live-Monitoring des Linux-Hosts (CPU, RAM, Netz, Disks, systemd, Sicherheit, Diagnose) mit 10-Sekunden-Polling. (`apps/studio/app/system/command-center/page.tsx`)

- **Stärken:** Vorbildliche Zustände: Stale-Kennzeichnung bei fehlgeschlagenem Refresh, In-Flight-Guard, Polling pausiert bei verstecktem Tab, manueller Refresh-Button · CollapsibleSections mit Zusammenfassung und problemgesteuertem defaultOpen (Sicherheit/Diagnose öffnen nur bei Befunden) · Stat-Cards mit Sparklines, Severity-Dots und konsistentem StatusRow-Idiom; klare Abgrenzung read-only vs. Host Control
- **Schwächen:** Stil-Mix: Tailwind-Cards neben uwe-v2-stat-card und Legacy uwe-dot; h1 in font-serif weicht von allen Schwesterseiten ab · Sehr hohe Informationsdichte — ohne Suchfunktion oder Anker in langen Dienst-/Check-Listen
- **Quickwin:** Header-Typografie an die übrigen System-Seiten angleichen (text-xl, ohne serif) — beseitigt den auffälligsten Konsistenzbruch der besten Seite der Gruppe.


### Studio Worlds: Kern & Wiki (Weltliste, Dashboard, Wiki, Seiten, Review) — Ø 7.1

_Der Worlds-Kern ist solide bis gut: konsistente Shell mit Breadcrumbs, Kontextpanels und fast überall durchdachten Empty States; die Wiki-Liste und der Inspektor sind die reifsten Seiten. Größte Baustelle ist der Stilmix aus drei Generationen (Legacy uwe.css, design-v2 uwe-v2-*, neuer Tailwind/shadcn-Stack) — praktisch jede Seite mischt mindestens zwei davon, wodurch Buttons und Tabellen je nach Seite anders aussehen. Dazu kommen einzelne echte UX-Gefahren: die vom Block entkoppelten Lösch-Buttons auf der Edit-Seite, doppelte Filterleisten in der Wiki-Suche und der doppelte Seitenkopf im Dashboard._

#### `/worlds/[worldSlug]/[category]/[slug]/edit` — **6/10** _(Design: gemischt)_

Vollständige Bearbeitungsseite: Metadaten-Formular, ContentBlocks mit Geheimnis-Steuerung, typspezifische Panels und KI-Werkzeuge. (`apps/studio/app/worlds/[worldSlug]/[category]/[slug]/edit/page.tsx`)

- **Stärken:** Autosave in localStorage plus Sticky-Action-Bar mit Vorschau-Link; Gespeichert-Flash mit role=status · Deutliche dm_only-Warnung und Live-Spieler-Vorschau geheimer Blöcke direkt im Formular · Collapsibles (ContentBlocks, KI-Werkzeuge) und typabhängige Panels (Quest, Fraktion, Item, Charakter) strukturieren die Masse
- **Schwächen:** Block-Löschen-Formulare werden in einer separaten Schleife NACH allen Block-Formularen gerendert (mit -1rem-Margin-Hack) — bei mehreren Blöcken steht der Lösch-Button nicht beim zugehörigen Block, Verwechslungsgefahr bei einer destruktiven Aktion ohne Bestätigung · Sehr lange Seite mit vielen gleichzeitig offenen Formularen, ohne Anker-Navigation oder Tabs; pro Block wiederholt sich die komplette Sichtbarkeits-/Geheimnis-Feldgruppe · Viele Inline-Styles (Borders, Margins, Flex) statt Klassen — bricht die v2-Formsprache
- **Quickwin:** Lösch-Button in die jeweilige Block-Card integrieren (mit Bestätigung) statt der nachgelagerten Lösch-Liste.

#### `/worlds/[worldSlug]/page-review` — **6/10** _(Design: gemischt)_

Liste aller Seiten mit offenen KI-Review-Vorschlägen als Einstieg in den Review-Editor. (`apps/studio/app/worlds/[worldSlug]/page-review/page.tsx`)

- **Stärken:** EmptyState erklärt konkret, wie Reviews entstehen (KI-Aktion in der Seitenliste starten) und verlinkt dorthin · Schlanke Tabelle im overflow-x-auto-Wrapper, Review-Zähler wird an die Shell-Navigation durchgereicht · Zugriffsschutz (requireStudioWorldEdit) direkt auf der Seite
- **Schwächen:** Typ und KI-Aufgabe werden als rohe Enum-Werte ausgegeben statt der überall sonst genutzten Labels/Badges (PAGE_TYPE_LABELS, PageTypeBadge) · Statische Tabelle statt der DataTable der Wiki-Liste — keine Sortierung, kein Filter, obwohl die Liste wachsen kann · Keine Zeilen-Aktionen (direktes Übernehmen/Ablehnen oder Vorschau des Diffs)
- **Quickwin:** Typ- und Aufgaben-Spalte auf die vorhandenen Labels/Badges umstellen — eine Zeile Code pro Spalte, sofort konsistent.

#### `/worlds` — **7/10** _(Design: gemischt)_

Weltenübersicht mit Karten-Grid pro Welt und rollenbasiertem Erstellen-Formular. (`apps/studio/app/worlds/page.tsx`)

- **Stärken:** Responsives Karten-Grid (sm:2 / lg:3 Spalten) mit klarer Primäraktion "Welt verwalten" und Zuletzt-bearbeitet-Datum · EmptyState mit Handlungshinweis; Erstellen-Formular nur für Owner/Admin sichtbar · CreateWorldForm mit Template-Karten, Sandbox-/Gastmodus-Logik (Sandbox deaktiviert Gastmodus), Fehleranzeige und Submitting-State
- **Schwächen:** Das voll ausgeklappte Erstellen-Formular dominiert dauerhaft den Seitenanfang, obwohl Weltanlage eine seltene Aktion ist · Weltkarten zeigen außer Name/Beschreibung keine Kennzahlen (Seiten, Kampagnen, Portal-Status) und nur eine einzige Aktion · Doppelte h2-Hierarchie: Kartentitel als h2 neben dem Abschnitts-h2 "Deine Welten"
- **Quickwin:** Erstellen-Formular hinter einen "Neue Welt"-Button im PageHeader legen (Dialog/Collapsible) — Bestandswelten rücken an den Seitenanfang.

#### `/worlds/[worldSlug]/dashboard` — **7/10** _(Design: gemischt)_

Welt-Cockpit mit Hero-Widgets (nächste Session, offene Plots, zuletzt bearbeitet), Kennzahlen-Karten und Schnellaktionen. (`apps/studio/app/worlds/[worldSlug]/dashboard/page.tsx`)

- **Stärken:** Durchdachte Kontextspalte: Schnell-erstellen-Links, DM-Werkzeuge, Portal-Status, Spielernotizen-Sektion nur wenn Reviews warten · Hero-Reihe priorisiert das Wichtigste, jedes Widget hat einen eigenen Empty State mit Aktion ("Session planen") · Widget-Grid per Layout-Konfiguration steuerbar, Tabellen mit Badges gut scanbar
- **Schwächen:** Doppelter Seitenkopf: PageHeader (Weltname + Beschreibung) steht direkt über WorldCockpitHeader mit identischem Titel und Summary · Stilmix aus uwe-v2-Karten, Legacy uwe-dashboard-*-Klassen und Tailwind-Sidebar-Links auf einer Seite · Kennzahlen doppeln sich zwischen Kontextspalte (Portal-Status) und Widget "Portal & Sharing"
- **Quickwin:** Den redundanten PageHeader entfernen und WorldCockpitHeader als einzigen Seitenkopf nutzen.

#### `/worlds/[worldSlug]/wiki` — **7/10** _(Design: gemischt)_

Zentrale Seitenliste der Welt mit Typ-/Kanon-Filtern, Volltextsuche, Kampagnen-Sidebar und Batch-Aktionen. (`apps/studio/app/worlds/[worldSlug]/wiki/page.tsx`)

- **Stärken:** Starke DataTable (TanStack): Sortierung, Spalten ein-/ausblendbar mit localStorage, Mehrfachauswahl mit Batch-Toolbar · Badges für Typ/Sichtbarkeit/Publish/Kanon plus Quest-Status machen Zeilen schnell erfassbar · EmptyState mit direkter "Seite erstellen"-Aktion; Kampagnenfilter als eigene Sidebar sauber getrennt
- **Schwächen:** Im Suchmodus stehen zwei SearchFilterBars übereinander — mit doppeltem Kanon-Status-Dropdown und zwei Suchfeldern · Drei konkurrierende Filter-Paradigmen auf einer Seite: Legacy uwe-filter-bar-Links, GET-Formular-Filterleiste und der Client-Filter der DataTable ("Seiten durchsuchen…") · Typ-Filterleiste verliert beim Klick den Kanon-Filter (URL-Params werden nicht vollständig mitgenommen)
- **Quickwin:** Im Suchmodus nur die erweiterte Filterleiste rendern und den doppelten Kanon-Filter entfernen.

#### `/worlds/[worldSlug]/pages/new` — **7/10** _(Design: gemischt)_

Neue Wiki-Seite anlegen: Vorlagenwahl als Kartengrid, KI-Assistent und Formular mit sinnvollen Defaults. (`apps/studio/app/worlds/[worldSlug]/pages/new/page.tsx`)

- **Stärken:** Template-Karten mit aktivem Zustand und transparentem Hinweis, welche Zusatzblöcke die Vorlage anlegt · SlugDuplicateChecker und Defaults aus System-Settings (Sichtbarkeit, Kanon-Status) verhindern Fehleingaben · Klare Abschlussleiste mit Erstellen/Abbrechen; Prefill über URL-Parameter (template, campaign, title) für Quick-Create-Links
- **Schwächen:** Vorlagenwechsel ist eine Navigation (key={template.id} resettet das Formular) — bereits eingegebene Felder wie Titel, Zusammenfassung und Tags gehen verloren · Langes Einzel-Formular ohne visuelle Gruppierung von Metadaten (Typ, Sichtbarkeit, Kanon) vs. Inhalt · Stilmix: Legacy uwe-template-grid und uwe-form-hint neben uwe-v2-form
- **Quickwin:** Beim Vorlagenwechsel eingegebene Werte erhalten (mindestens den Titel als Query-Param mitnehmen oder Wechsel clientseitig ohne Reload).

#### `/worlds/[worldSlug]/page-review/[pageId]` — **7/10** _(Design: gemischt)_

Review-Editor: Original und KI-Text vergleichen (Side-by-side oder Diff), bearbeiten, per KI-Chat verfeinern, übernehmen oder ablehnen. (`apps/studio/app/worlds/[worldSlug]/page-review/[pageId]/page.tsx`)

- **Stärken:** Automatische Wahl zwischen Side-by-side und Diff je nach Textlänge, mit "(empfohlen)"-Hinweis am Umschalter · Vollständige Zustandsbehandlung: loading/disabled, Fehler- und Erfolgsmeldungen, Bestätigung vor dem Ablehnen · KI-Chat mit Provider-/Modellwahl (respektiert localOnly-Einstellung) und sichtbarem Verlauf
- **Schwächen:** Einzige Seite der Gruppe ohne PageHeader — nur Back-Link plus h2 im Editor, bricht die Kopfzeilen-Konsistenz · Ablehnungskommentar-Feld ist per Inline-Style in die Aktionszeile gequetscht und konkurriert visuell mit dem primären Übernehmen-Button · Fehler beim Laden von AI-Settings/Modellen werden stillschweigend verschluckt — leere Dropdowns ohne Erklärung
- **Quickwin:** PageHeader mit Seitentitel und Übernehmen/Ablehnen als actions einsetzen; den Ablehnungskommentar in einen Bestätigungs-Dialog verlagern.

#### `/worlds/[worldSlug]` — **8/10** _(Design: unklar)_

Reine Weiterleitung: springt per Cookie auf die zuletzt besuchte Welt-Unterseite, sonst aufs Dashboard. (`apps/studio/app/worlds/[worldSlug]/page.tsx`)

- **Stärken:** Merkt sich die letzte Route pro Welt und spart beim Wiedereinstieg Klicks · Sauberer Fallback aufs Dashboard, kein UI-Flackern (Server-Redirect)
- **Schwächen:** Das Sprungverhalten ist für Nutzer unsichtbar und nicht abschaltbar — wer bewusst /worlds/[slug] aufruft, landet unerwartet z.B. tief im Wiki
- **Quickwin:** Nach dem Redirect kurz visuell verorten (z.B. Breadcrumb-Highlight), damit der Sprung auf die letzte Unterseite nachvollziehbar ist.

#### `/worlds/[worldSlug]/[category]/[slug]` — **8/10** _(Design: gemischt)_

DM-Leseansicht einer Wiki-Seite mit Spieler-Vorschau-Modus, Kontextpanel (Backlinks, Metadaten, Freigabe, KI) und Nachbarschafts-Graph. (`apps/studio/app/worlds/[worldSlug]/[category]/[slug]/page.tsx`)

- **Stärken:** Spieler-Vorschau als konsequenter Modus: Banner mit Perspektiv-Wahl pro Spieler, alle Links tragen den preview-Param weiter, eigener Empty State wenn die Seite für Spieler unsichtbar ist · Reiches, aber gebändigtes Kontextpanel: Backlinks/ausgehende/verwandte Links immer sichtbar, Freigabe/KI/Brain in zugeklappten Collapsibles · Proaktiver Warnhinweis bei defekten Wikilinks mit Verweis auf die Seitenleiste; kompakter Graph mit Absprung in die Vollansicht
- **Schwächen:** Header-Aktionen als handgebaute Tailwind-Links — dieselben Aktionen nutzen auf der Edit-Seite uwe-v2-btn und sehen dort anders aus · Inline-Styles im Vorschau-Banner statt Klassen · page.tsx ist nur ein Wrapper; die eigentliche 360-Zeilen-Ansicht liegt in components/StudioWikiPageView.tsx und mischt Datenbeschaffung und Layout
- **Quickwin:** Header-Aktionsbuttons auf die v2-Button-Klassen vereinheitlichen — identisch zur Edit-Seite.

#### `/worlds/[worldSlug]/inspector` — **8/10** _(Design: gemischt)_

Sicherheits- und Kanon-Prüfbericht der Welt: Spieler-Leaks, sichtbare Seiten/Assets, Share-Links und Kanon-Konflikte mit Ein-Klick-Fixes. (`apps/studio/app/worlds/[worldSlug]/inspector/page.tsx`)

- **Stärken:** Klare Berichtsstruktur: StatGrid mit Kritisch/Warnungen oben, danach thematische Sektionen mit eigenem Positiv-Zustand ("✓ Keine Auffälligkeiten") · Findings mit Severity-Label, Deep-Link zur betroffenen Seite und Inline-Fix-Buttons direkt am Fund; Fix-Feedback über role=status/alert · Kontextspalte zeigt die relevante Portal-Konfiguration samt Absprung in die Einstellungen
- **Schwächen:** Legacy-Tabellen (uwe-page-table) ohne Overflow-Wrapper — auf schmalen Screens droht horizontales Scrollen der ganzen Seite · Lange Seite ohne Anker-Navigation zu den Sektionen; die StatGrid-Kacheln verlinken nicht auf die zugehörigen Abschnitte · Stilmix aus uwe-inspector-*-Legacy-Klassen, v2-Sektionen und Unicode-Häkchen statt Icon-Set
- **Quickwin:** StatGrid-Kacheln als Anchor-Links auf die jeweiligen Sektionen schalten — bei vielen Findings entscheidend für die Orientierung.


### Studio Worlds: Struktur & Analyse (Atlas, Graph, Kalender, Chronik, Radar, Quality) — Ø 7.2

_Solide, funktional durchdachte Analyse- und Struktur-Seiten: Empty States und Erfolgs-Banner sind fast überall vorhanden, die Informationsarchitektur (Shell, Breadcrumbs, Sidebar-Kontextpanels) ist konsistent. Die größte Schwäche ist das durchgehend gemischte Styling — uwe-v2-Klassen, Legacy-Klassen (uwe-hint, uwe-block, auth-*), Tailwind-Utilities und massenhaft Inline-Styles koexistieren auf jeder Seite, inklusive handwerklicher Fehler wie der nicht existierenden Klasse uwe-v2-btn-small. Eine Konsolidierung auf CardV2/ButtonV2 plus Abbau der Inline-Styles hätte den größten Effekt auf die gesamte Gruppe._

#### `/worlds/[worldSlug]/calendar` — **6/10** _(Design: gemischt)_

Konfiguration des In-Game-Kalenders (Monate, Wochentage, Feiertage) und Fortschalten des aktuellen Weltdatums. (`apps/studio/app/worlds/[worldSlug]/calendar/page.tsx`)

- **Stärken:** Quick-Advance-Buttons (+1/+7/+30 Tage) direkt an der prominenten Datumsanzeige — sehr praktisch · Saubere Fieldset-Gruppierung und Erfolgs-Banner mit role=status nach dem Speichern · Responsive auto-fit-Grids für Datums- und Monatszeilen
- **Schwächen:** Monate lassen sich weder hinzufügen noch entfernen — monthCount ist als hidden Field fixiert · Feiertage auf max(vorhandene, 3) Zeilen begrenzt, kein 'Weitere hinzufügen'; Monat nur als Zahlen-Index statt Namens-Select · ReadOnly-Feld 'Schlüssel' pro Monat ist für Nutzer wertlos und bläht das Formular auf
- **Quickwin:** Monats- und Feiertagszeilen dynamisch hinzufügbar machen (Client-Komponente mit Add/Remove) statt fixer Zeilenzahl.

#### `/worlds/[worldSlug]/open-items` — **6/10** _(Design: gemischt)_

Vereinheitlichte Übersicht aller offenen Punkte (Quests, Session-Plots, Entwürfe, Rätsel) mit Bulk-Abschluss für Quests. (`apps/studio/app/worlds/[worldSlug]/open-items/page.tsx`)

- **Stärken:** Sinnvolle feste Kategorie-Reihenfolge; leere Kategorien werden ausgeblendet · Bulk-Close mit Auswahl-Zähler im Button und disabled-State bei leerer Auswahl · Positiver Empty State ('alles sieht erledigt aus')
- **Schwächen:** Leiht sich fremde CSS-Klassen (auth-page-list, portal-dash-summary, auth-muted) statt v2-Listen — inkonsistente Optik · Offene Quests erscheinen doppelt: einmal in der Bulk-Close-Checkbox-Liste, einmal in der Kategorie-Sektion · Breadcrumb manuell zusammengebaut statt über worldSectionBreadcrumb wie auf allen Nachbarseiten
- **Quickwin:** Bulk-Close als Checkboxen direkt in die Quest-Sektion integrieren statt als separate, redundante Liste darüber.

#### `/worlds/[worldSlug]/atlas` — **7/10** _(Design: gemischt)_

Übersicht der Atlas-Knoten einer Welt als Hierarchie-Baum mit Anlage-Formular und Review-Queue für KI-generierte Maschinenraum-Assets. (`apps/studio/app/worlds/[worldSlug]/atlas/page.tsx`)

- **Stärken:** Guter Empty State mit klarem Primär-CTA (Atlas erstellen & Editor öffnen) · Level-Summary-Chips plus Baum mit Einrückung, Sichtbarkeits-Badges (Spieler/DM) und Nachfahren-Zähler am Delete-Button · Maschinenraum-Review-Sektion erscheint nur bei Bedarf und erklärt die Konsequenz des Genehmigens
- **Schwächen:** Fast das gesamte Layout über Inline-Styles statt Design-System-Klassen (Chips, Liste, Formular) · Baum ohne Ein-/Ausklappen — bei großen Welten wird die flache Liste lang · Anlage-Formular im <details> erlaubt keine Eltern-Auswahl; unklar, dass nur Top-Level-Knoten entstehen
- **Quickwin:** Inline-Styles der Chips/Baumliste in uwe-v2-Karten/Listen-Klassen überführen und dem Anlage-Formular ein Eltern-Knoten-Select geben.

#### `/worlds/[worldSlug]/atlas/[nodeId]` — **7/10** _(Design: gemischt)_

Editor-Seite eines einzelnen Atlas-Knotens mit Metadaten-Panel und lazy geladenem Canvas-Karten-Workspace. (`apps/studio/app/worlds/[worldSlug]/atlas/[nodeId]/page.tsx`)

- **Stärken:** Breadcrumb bildet die komplette Knoten-Hierarchie ab — sehr gute Orientierung · Lazy-Loading des schweren Editors mit sichtbarem Status-Fallback (role=status) · Detail-Panel als responsives auto-fit-Grid mit Feature-/Objekt-Zählern und Wiki-Verknüpfung
- **Schwächen:** Kein PageHeader/H1 — die Seite startet direkt mit einer Karte namens 'Knoten' statt dem Knotentitel · Zwei getrennte Formulare mit zwei Speichern-Buttons ('Speichern' / 'Sichtbarkeit setzen') in einer Karte verwirren · Kein Fehlerzustand, falls der Client-Editor nicht lädt
- **Quickwin:** PageHeader mit Knotentitel und Level als Meta ergänzen, damit die Seite eine klare H1 und Identität bekommt.

#### `/worlds/[worldSlug]/chronicle` — **7/10** _(Design: gemischt)_

Datierte Welt-Chronik mit Ereignis-Anlage, Fraktions-Simulations-Trigger und chronologischer Timeline. (`apps/studio/app/worlds/[worldSlug]/chronicle/page.tsx`)

- **Stärken:** Vorbildliche Feedback-Banner (gespeichert, gelöscht, Fraktions-Tick mit Link zu AI Runs) · Timeline lädt in 15er-Batches nach — skaliert für lange Chroniken · Neues Ereignis defaultet auf das aktuelle Weltdatum; Sidebar zeigt Weltuhr mit Direktlink
- **Schwächen:** Die eigentlichen Ereignisse stehen erst als dritte Karte — Simulation und Anlage-Formular schieben den Kerninhalt weit nach unten · Timeline-Einträge mit hartkodierter rgba-Border als Inline-Style statt Karten-Klasse · Löschen von Ereignissen ohne Bestätigung
- **Quickwin:** Timeline nach oben ziehen und das Anlage-Formular (wie im Atlas) in ein einklappbares <details> packen.

#### `/worlds/[worldSlug]/notes` — **7/10** _(Design: gemischt)_

Review-Queue für Spielernotizen: freigeben, als Seite/ContentBlock übernehmen, verbergen oder löschen. (`apps/studio/app/worlds/[worldSlug]/notes/page.tsx`)

- **Stärken:** Durchdachter Review-Workflow mit statusabhängigen Aktionen und Status-Badge pro Karte · Kontextsensitive Empty States (Suche / alle / Queue) und Volltext-Suche über Inhalt, Autor, Seite, Session · Sidebar kombiniert Ansicht-Umschalter, Kampagnenfilter und Queue-Zähler sauber
- **Schwächen:** Aktions-Footer mit bis zu fünf Formularen inkl. Seiten-Select aller Wiki-Seiten wirkt überladen · Klasse uwe-v2-btn-small existiert im CSS nicht (nur uwe-v2-btn-sm) — zwei Übernehmen-Buttons rendern ungestylt in voller Größe · Löschen ohne Bestätigungsdialog
- **Quickwin:** uwe-v2-btn-small durch uwe-v2-btn-sm ersetzen und die Übernahme-Aktionen in ein einzelnes Dropdown/Menü bündeln.

#### `/worlds/[worldSlug]/graph` — **8/10** _(Design: gemischt)_

Interaktiver Wissensgraph der Welt mit Filtern (Typ, Tag, Sichtbarkeit, Modus, Fokus-Seite), Spieler-Vorschau und Verbindungsmatrix. (`apps/studio/app/worlds/[worldSlug]/graph/page.tsx`)

- **Stärken:** Sehr vollständige Filter-Leiste plus Kampagnen-Sidebar und Fokus-/Modus-Konzept · Truncation-Feedback direkt im Header (x von y Knoten, Performance-Limit) mit Handlungsempfehlung · Spieler-Vorschau mit Banner und Rück-Link; GraphView-Client bietet Legende, Suche, Zoom, Minimap und barrierefreie Knotennamen
- **Schwächen:** Backend unterstützt Mehrfachwerte (CSV/Array), die UI bietet aber nur Single-Selects — Fähigkeit verschenkt · Fokus-Seiten-Select listet alle Seiten der Welt ungefiltert — bei großen Wikis unbenutzbar · Verbindungsmatrix-Tabelle ohne overflow-Container; auf Mobil droht horizontales Scrollen der Seite
- **Quickwin:** Fokus-Seiten-Auswahl durch ein durchsuchbares Eingabefeld (datalist/Combobox) ersetzen.

#### `/worlds/[worldSlug]/questions` — **8/10** _(Design: gemischt)_

Eingegangene Spielerfragen beantworten oder archivieren, getrennt nach offen und beantwortet. (`apps/studio/app/worlds/[worldSlug]/questions/page.tsx`)

- **Stärken:** Klare Zwei-Sektionen-Struktur mit Zählern und 'x neu'-Badge im PageHeader · Inline-Antwort-Textarea direkt an der Frage — minimale Friktion beim Beantworten · Empty States für beide Sektionen, Datums- und Status-Metadaten pro Karte
- **Schwächen:** Antwort-Textarea nur 2 Zeilen bei maxLength 4000 — unangenehm für längere Antworten · Beantwortete Liste ohne Pagination/Batching; wächst unbegrenzt · Sektions-Klasse uwe-block ist im CSS nicht definiert — Abschnitte erben kein Styling
- **Quickwin:** Antwort-Textarea auf 4-5 Zeilen mit auto-resize vergrößern.

#### `/worlds/[worldSlug]/radar` — **8/10** _(Design: gemischt)_

Kampagnen-Dashboard: KPIs, letzte Session, Fraktionslagen, offene Quests mit Schnellabschluss und jüngste Ereignisse. (`apps/studio/app/worlds/[worldSlug]/radar/page.tsx`)

- **Stärken:** StatGrid mit vier relevanten KPIs als klarer Einstieg, danach logisch geordnete Sektionen · Jede Sektion hat einen eigenen Empty State; Sidebar bietet Weltuhr-Setup-Link, falls keine Uhr existiert · Inline-'Abschließen'-Aktion direkt am Quest — kurzer Weg von Erkenntnis zu Handlung
- **Schwächen:** Kanon-Konflikt-Warnung steht ganz unten und missbraucht die Formular-Fehlerklasse uwe-form-error statt eines Alert-Banners · Jüngste Ereignisse ohne Datumsangabe — gerade hier wäre das In-Game-Datum wertvoll · Sektionen sind reine Listen ohne Karten-Rahmen; wenig visuelle Trennung bei viel Inhalt
- **Quickwin:** Kanon-Konflikte als Warn-Banner direkt unter den PageHeader ziehen (Konflikte > 0 ist die wichtigste Information der Seite).

#### `/worlds/[worldSlug]/quality` — **8/10** _(Design: gemischt)_

Wiki-Pflege-Cockpit mit Qualitäts-Score, priorisierten Empfehlungen, sechs Prüf-Kategorien und Bulk-Auto-Verlinkung. (`apps/studio/app/worlds/[worldSlug]/quality/page.tsx`)

- **Stärken:** Score + Bewertung + priorisierte 'Nächste Schritte' mit Direktlinks machen die Seite wirklich handlungsleitend · Jede Prüfgruppe hat einen positiven Empty-Text ('✓ Alle NPCs sind verknüpft…') — Zustände vorbildlich kommuniziert · Feedback nach Bulk-Auto-Link inkl. Null-Fall und Undo-Hinweis; transparente Score-Erklärung mit Punktabzügen
- **Schwächen:** Sechs Prüf-Sektionen werden immer voll gerendert, auch wenn alles grün ist — viel Scroll für 'nichts zu tun' · Bulk-Auto-Link als Hauptaktion erst am Seitenende statt im Header oder bei der Fundstellen-Gruppe · Severity der Findings nur als data-Attribut, keine sichtbaren Warn-/Info-Badges im Markup
- **Quickwin:** Grüne Prüfgruppen zu einer kompakten '✓ 4 Checks ohne Befund'-Zeile zusammenfassen und nur Gruppen mit Findings ausklappen.


### Studio Worlds: Sessions & Vorbereitung (Live, Review, One-Shot, Soundboard) — Ø 6.8

_Die Sessions-Gruppe hat einen durchdacht modellierten Workflow (Planen → Live → Review → Portal-Publish) mit echten Empty States, Flash-Meldungen und einem eigenen Live-Nav-Modus — konzeptionell die stärkste Seite des Studios. Handwerklich bremst sie sich selbst aus: durchgängig gemischtes Design-System (v2-Buttons/Cards auf Legacy-Tabellen, Panels und vielen Inline-Styles) und mehrere Cross-Page-Brüche (Live-Panel kann Loot/Quest/Lesezeichen-Einträge nicht erfassen, die das Review erwartet; prepare-session ignoriert den sessionId-Deep-Link; doppelte Flash-Meldungen und Publish-Buttons im Session-Detail). Soundboard und One-Shot brauchen eine Konsolidierung ihrer redundanten Formulare, der Kern-Workflow dagegen vor allem Politur._

#### `/worlds/[worldSlug]/soundboard` — **5/10** _(Design: gemischt)_

Soundboard-Verwaltung pro Welt/Kampagne: Buttons abspielen, anlegen, bearbeiten und mit Wiki-Seiten verknüpfen. (`apps/studio/app/worlds/[worldSlug]/soundboard/page.tsx`)

- **Stärken:** Gute Status-Kommunikation: Maschinenraum-Panel, Spotify-Connect-Feedback, Fehler-Flash mit role="alert" · Client-seitige Feld-Validierung im Button-Formular mit Fehlermeldung direkt am Feld · Kampagnen-Filter in der Sidebar mit Kontext-Zähler konsistent zur Sessions-Liste
- **Schwächen:** Fünf gestapelte Sektionen ohne Priorisierung; Bearbeiten als komplettes Formular in einem <details> innerhalb einer Tabellenzelle ist unübersichtlich und mobil kaum nutzbar · Redundanz: eigene "Seite verknüpfen"-Sektion, obwohl das Button-Formular bereits ein linkedPageIds-Multiselect (Strg/Cmd-Klick) hat · Generisches "Änderungen gespeichert." für vier verschiedene Operationen; Löschen ohne Bestätigung; überwiegend Legacy uwe-panel/uwe-form-grid
- **Quickwin:** Bearbeiten aus der Tabellenzelle in einen Dialog (wie QuickCreateSessionDialog) verlagern und die redundante Verknüpfen-Sektion streichen.

#### `/worlds/[worldSlug]/prepare-session` — **6/10** _(Design: gemischt)_

Vorbereitungs-Cockpit: kommende Sessions, letztes KI-Session-Paket, heuristische Outline und Maschinenraum-Generator. (`apps/studio/app/worlds/[worldSlug]/prepare-session/page.tsx`)

- **Stärken:** Saubere Gliederung in vier Collapsible-Panels mit sinnvollen defaultOpen-Zuständen · Gute Offline-/Deferred-Zustände für Maschinenraum (deaktiviert, offline → Job vorgemerkt, Link zu AI Runs) · Empty State mit direktem Link "Neue Session anlegen"
- **Schwächen:** Der Deep-Link ?sessionId= aus dem Session-Detail wird ignoriert — die Seite liest keine searchParams, die Bezugs-Session wird nicht vorausgewählt · Doppelte Chrome: Panel "KI Session-Paket generieren" enthält eine weitere Card mit eigener Überschrift "Session vorbereiten" (= Seitentitel) · KI-Ergebnisse als rohe <pre>-Blöcke — schwer scanbar, kein Markdown-Rendering
- **Quickwin:** searchParams.sessionId auslesen und als defaultSessionId ins PrepareSessionPanel geben — der bestehende Deep-Link funktioniert dann endlich.

#### `/worlds/[worldSlug]/one-shot` — **6/10** _(Design: gemischt)_

One-Shot-Generator, der aus Ort, Ton und NPCs ein kanon-sicheres Abenteuer-Gerüst baut und als Quest-Entwurf speichert. (`apps/studio/app/worlds/[worldSlug]/one-shot/page.tsx`)

- **Stärken:** GET-Formular macht Ergebnisse URL-teilbar und bookmarkbar · Ergebnis klar strukturiert: Spieler-Brief, Szenen, DM-Geheimnisse, Kanon-Warnungen getrennt · Schnell-Assistent mit Ein-Klick-Ton-Presets senkt die Einstiegshürde
- **Schwächen:** Zwei redundante Formulare übereinander (Schnell-Assistent und GET-Form) mit doppelten Ort/Ton-Selects — unklar, welches man nutzen soll; NPCs gibt es nur im zweiten · NPC-Liste still auf 16 gekappt (slice) ohne Hinweis, dass weitere existieren · Layout fast vollständig über Inline-Styles; Markdown-Block dupliziert die strukturierte Ausgabe darüber
- **Quickwin:** Die beiden Generator-Formulare zu einem zusammenführen (Presets + NPC-Auswahl in der GET-Form) — halbiert die Seite und beseitigt die Verwirrung.

#### `/worlds/[worldSlug]/sessions/new` — **7/10** _(Design: gemischt)_

Anlage-Formular für eine neue Session mit drei Kernfeldern und einklappbaren erweiterten Feldern. (`apps/studio/app/worlds/[worldSlug]/sessions/new/page.tsx`)

- **Stärken:** Progressive Disclosure: nur Titel/Kampagne/Datum sichtbar, sechs weitere Felder hinter <details> · autoFocus auf Titel, Kampagne aus Query vorbelegt, klare Submit/Abbrechen-Aktionen
- **Schwächen:** Keinerlei Fehleranzeige — schlägt createGameSessionAction fehl, sieht der Nutzer nichts · Layout der erweiterten Felder komplett über Inline-Styles statt Design-Klassen · uwe-edit-form (Legacy) kombiniert mit uwe-v2-btn/uwe-v2-section
- **Quickwin:** Server-Action-Fehler sichtbar machen (error-searchParam oder useActionState mit uwe-flash-error).

#### `/worlds/[worldSlug]/sessions/[sessionId]` — **7/10** _(Design: gemischt)_

Session-Detail mit Status/Portal-Badges, Spieler-Verfügbarkeit, View/Edit-Umschalter und Recap-Publish. (`apps/studio/app/worlds/[worldSlug]/sessions/[sessionId]/page.tsx`)

- **Stärken:** Reicher, informativer Header: Statusbadge, Datum, Portal-Sichtbarkeits-Badges plus Publish-CTA · Proaktive Warn-Notice, wenn die Session für Spieler unsichtbar ist, inkl. Handlungsanweisung · Verfügbarkeits-Card mit Zusagen-Zählern und Einzelvotes; Workflow-Schritte als Sidebar-Hilfe
- **Schwächen:** Flash-Meldungen doppelt: page.tsx (Z. 139-142) und SessionDetailClient (Z. 227-230) rendern dieselben vier Meldungen zweimal · Publish-Button ebenfalls doppelt (Header-Action und nochmals über dem ViewEditToggle) · Edit-Formular sehr lang und einspaltig, viele Inline-Styles; Legacy uwe-flash/uwe-notice neben v2-Cards
- **Quickwin:** Doppelte Flash-Meldungen und den zweiten Publish-Button aus SessionDetailClient entfernen — der Header deckt beides ab.

#### `/worlds/[worldSlug]/sessions/[sessionId]/review` — **7/10** _(Design: gemischt)_

Nachbereitung: Live-Einträge kategorisiert triagieren (Quests, Beute, NPCs) und Recap-Entwurf speichern. (`apps/studio/app/worlds/[worldSlug]/sessions/[sessionId]/review/page.tsx`)

- **Stärken:** Klare Triage-Struktur mit Kategorien, Zählern, Kontext-Hints und direkten Quest-Status-Aktionen inline · Recap-Textarea aus den Einträgen vorbefüllt; explizite Botschaft "nichts wird automatisch Kanon" · Empty State bei 0 Einträgen und role="status" auf Erfolgs-Meldungen
- **Schwächen:** "Erledigt" und "Gescheitert" sind identisch gestylte Buttons ohne Erfolgs-/Gefahr-Differenzierung oder Bestätigung · Erfolgs-Meldungen nutzen uwe-inspector-ok statt des sonst üblichen uwe-flash — inkonsistentes Feedback-Vokabular · Recap-Textarea ohne Formular-Klasse/Styling; Beute- und Quest-Sektionen bleiben faktisch leer, weil der Live-Modus diese Typen nicht anbietet
- **Quickwin:** Quest-Status-Buttons visuell differenzieren (erledigt = success, gescheitert = danger) und Meldungen auf uwe-flash vereinheitlichen.

#### `/worlds/[worldSlug]/sessions` — **8/10** _(Design: gemischt)_

Paginierte Session-Liste einer Welt mit Kampagnen- und Status-Filter plus Schnellanlage-Dialog. (`apps/studio/app/worlds/[worldSlug]/sessions/page.tsx`)

- **Stärken:** Vollständige Zustände: Empty State, Pagination, Filter-Chips, Kontext-Zähler in der Sidebar · Zwei gut abgestufte Anlage-Wege (Schnell-Dialog mit 3 Feldern + Link zum vollen Formular) · Tabelle nutzt das responsive data-label-Muster von uwe-page-table und ist damit mobil als Karten lesbar
- **Schwächen:** Aktiver Filter wird über data-severity="warn" der Today-Quick-Chips signalisiert — semantischer Missbrauch, aktiv sieht aus wie Warnung · Bei 0 Treffern rendert der Tabellenkopf trotzdem, der Empty State hängt darunter · Gemisch aus uwe-v2-*, Legacy-Badges und geliehenen Dashboard-Klassen (uwe-today-quick-chip, uwe-dashboard-muted)
- **Quickwin:** Filter-Chips eine echte Aktiv-Klasse geben (statt data-severity="warn") und bei 0 Treffern die Tabelle durch den Empty State ersetzen.

#### `/worlds/[worldSlug]/sessions/[sessionId]/live` — **8/10** _(Design: gemischt)_

Fokussierter Live-Modus am Spieltisch: Timer, Ereignis-Erfassung, Autosave-Notizen und Soundboard. (`apps/studio/app/worlds/[worldSlug]/sessions/[sessionId]/live/page.tsx`)

- **Stärken:** Eigener Live-Nav-Modus (navMode="live") reduziert die Navigation aufs Wesentliche — echte Fokus-UX · Stat-Cards mit persistentem Live-Timer (localStorage), debounced Autosave der Notizen, Enter-to-Add-Erfassung · Klarer Abschluss-CTA "Live beenden → Review" plus Soundboard mit Zuletzt-gespielt- und Maschinenraum-Status
- **Schwächen:** Typ-Auswahl bietet nur Notiz/NPC-Update/Initiative — Loot, Quest-Update und Lesezeichen, die die Review-Seite kategorisiert, sind hier gar nicht erfassbar · Autosave meldet nur Erfolg; ein fehlgeschlagenes Speichern bleibt unsichtbar · Lösch-Button "✕" ohne aria-label und ohne Bestätigung; Layout stark über Inline-Styles
- **Quickwin:** ENTRY_KINDS um loot, quest_update und bookmark erweitern, damit der Review-Workflow tatsächlich befüllt werden kann.


### Studio Worlds: Dungeons, Magic Items, Roll Tables, Treasury — Ø 6.2

_Solide, funktional vollständige Gruppe mit durchgängigem Gerüst (WorldShell, BreadcrumbTrail, PageHeader, Erfolgs-Flashes), aber keine einzige Seite ist rein V2 — überall mischen sich uwe-v2-Klassen mit Legacy-CSS (uwe-page-table, uwe-banner, uwe-hint) und viel Inline-Styling. Wiederkehrende Muster-Schwächen: dieselben Daten werden doppelt gerendert (Ebenen- und Raum-Seiten zeigen Cards UND Tabelle), destruktive Aktionen (Tabelle/Item löschen) haben keine Bestätigung, und die Cockpit-Seiten (Raum, Treasury) sind überladen. Die Formular-UX ist dagegen überdurchschnittlich: klare Spieler/DM-Feldtrennung, gute Placeholder und clevere Extras wie Schnellstart-Presets und Würfel-Verlauf._

#### `/worlds/[worldSlug]/dungeons/[dungeonSlug]/ebenen/[levelSlug]` — **5/10** _(Design: gemischt)_

Ebenen-Detailseite mit Raum-Übersicht und Formular zum Anlegen neuer Räume. (`apps/studio/app/worlds/[worldSlug]/dungeons/[dungeonSlug]/ebenen/[levelSlug]/page.tsx`)

- **Stärken:** Responsives Karten-Grid der Räume mit Status-Badge und Summary (auto-fill/minmax) · Raum-Formular trennt sauber Vorlesetext, Spieler-Beschreibung und DM-Notizen mit passenden Placeholdern · Räume zusätzlich als Sidebar-Navigation erreichbar
- **Schwächen:** Räume doppelt gerendert: "Raum-Übersicht" (Cards) und "Räume" (Tabelle) zeigen exakt dieselben Daten — bei 0 Räumen erscheint der Empty State sogar zweimal · Grid und Card-Verhalten komplett per Inline-Styles statt Design-System-Klassen · Die Ebene selbst ist hier nicht editierbar (Titel/Status nur auf der Dungeon-Seite änderbar) — inkonsistent zur Raum-Seite
- **Quickwin:** Die Tabellen-Sektion "Räume" komplett streichen — das Karten-Grid transportiert dieselbe Information besser.

#### `/worlds/[worldSlug]/dungeons/[dungeonSlug]/ebenen/[levelSlug]/raeume/[roomSlug]` — **5/10** _(Design: gemischt)_

Raum-Cockpit zum Editieren von Vorlesetext/DM-Notizen, Verwalten von Encounters/Fallen/Loot etc. und Vorbereiten von Drucklisten. (`apps/studio/app/worlds/[worldSlug]/dungeons/[dungeonSlug]/ebenen/[levelSlug]/raeume/[roomSlug]/page.tsx`)

- **Stärken:** Vollständige Breadcrumb-Kette plus Kontext-Sidebar mit Dungeon/Ebene und AI-Panel · Praxisnahe Header-Actions (Label erstellen, Druckliste vorbereiten) und vier differenzierte Erfolgs-Flashes · Neue Raum-Inhalte platzsparend in <details> pro Typ eingeklappt
- **Schwächen:** Extrem lange Seite: 7 Entity-Sektionen rendern bei leerem Raum je ein eigenes "Keine Einträge." — Leerzustands-Spam statt kompakter Zusammenfassung · "Alle ContentBlocks" dupliziert die bereits im Formular editierten Inhalte und wirkt mit der rohen Block→Label-Linkliste wie Debug-Ausgabe · Wiki-Vorschau, Edit-Formular und ContentBlock-Liste zeigen denselben Inhalt dreifach in unterschiedlicher Form
- **Quickwin:** Leere Entity-Sektionen ausblenden bzw. zu einer Zeile bündeln und "Alle ContentBlocks" in ein eingeklapptes <details> verschieben.

#### `/worlds/[worldSlug]/dungeons/[dungeonSlug]` — **6/10** _(Design: gemischt)_

Dungeon-Detailseite mit Ebenen-Verwaltung, Beschreibung, Asset-Verknüpfung und Metadaten-Formular. (`apps/studio/app/worlds/[worldSlug]/dungeons/[dungeonSlug]/page.tsx`)

- **Stärken:** Kontext-Sidebar listet alle Ebenen als Navigation, Breadcrumb sitzt korrekt · Erfolgs-Feedback nach Speichern/Verknüpfen über Flash-Meldungen · Alle Verwaltungsaufgaben (Ebene anlegen, Assets, Sichtbarkeit/Publish) auf einer Seite erreichbar
- **Schwächen:** Ebenen werden doppelt dargestellt: erst als Layout-Cards (DungeonLevelLayout), direkt darunter nochmal als Tabelle mit identischem Inhalt · Beschreibung ist nur read-only (WikiContent), das Metadaten-Formular hat kein Beschreibungsfeld — unklar, wo man den Text editiert · Assets-Sektion ohne Empty State: sind keine Assets vorhanden, bleibt unter der Überschrift einfach Leere
- **Quickwin:** Die redundante Ebenen-Tabelle entfernen und die Layout-Cards (mit Status) zur einzigen Ebenen-Darstellung machen.

#### `/worlds/[worldSlug]/magic-items` — **6/10** _(Design: gemischt)_

Liste aller Item-Seiten der Welt mit Seltenheitsfilter als Einstieg in die Magic-Item-Werkbank. (`apps/studio/app/worlds/[worldSlug]/magic-items/page.tsx`)

- **Stärken:** Seltenheitsfilter als eigene Filterleiste mit URL-State und aktiver Markierung · Empty State unterscheidet zwischen "kein Filter-Treffer" und "gar keine Items" und erklärt den nächsten Schritt · Sektionstitel spiegelt den aktiven Filter wider
- **Schwächen:** Kein CTA zum Anlegen: Der Empty State sagt "Lege im Wiki eine Seite vom Typ Item an", verlinkt aber nirgendwohin · Items nur als schlichte Linkliste — Rarity- und Werkbank-Badges kleben unstrukturiert am Titel, keine Tabelle/Cards · Filterleiste nutzt Legacy-Klasse uwe-filter-bar mit simpler active-Klasse statt v2-Muster
- **Quickwin:** Header-Action "Neues Item anlegen" ergänzen, die direkt zur Wiki-Neuanlage mit Typ Item führt.

#### `/worlds/[worldSlug]/treasury` — **6/10** _(Design: gemischt)_

Gruppenschatz-Verwaltung: Party-Währung, gemeinsames Inventar und Zuweisung von Gegenständen an Charaktere. (`apps/studio/app/worlds/[worldSlug]/treasury/page.tsx`)

- **Stärken:** Klare Sektionsfolge (Währung, Hinzufügen, Inventar, bei Charakteren) mit Mengen-Zählern in den Überschriften · Portal-Sichtbarkeit (dm_only bleibt im Studio) wird im Kontextpanel und an den Feldern explizit erklärt · Responsive Grids für Währungsfelder und Item-Attribute, differenzierte Erfolgs-Banner je Aktion
- **Schwächen:** Item-Einträge sind komplett handgestylte <li> mit Inline-Border statt uwe-v2-card — visuell vom Rest des Systems abgekoppelt · "Entfernen" löscht Items ohne Bestätigung · Statusbanner erscheinen erst unter der "Loot & Zufall"-Teaser-Karte, die zudem primär auf ein erst geplantes Feature hinweist
- **Quickwin:** Inventar-Einträge auf uwe-v2-card umstellen und Entfernen mit Bestätigung absichern.

#### `/worlds/[worldSlug]/dungeons` — **7/10** _(Design: gemischt)_

Übersichtsliste aller Dungeons einer Welt mit Status- und Kampagnen-Filter plus Einstieg zum Anlegen. (`apps/studio/app/worlds/[worldSlug]/dungeons/page.tsx`)

- **Stärken:** Klarer Header mit primärem CTA "Neuer Dungeon" und prägnanter Summary · Zweifach filterbar (Status-Chips + Kampagnen-Sidebar), Filterzustand in der URL · Empty State mit Handlungsaufforderung vorhanden
- **Schwächen:** Status-Chips zweckentfremden die Today-Quick-Chip-Klasse: aktiver Filter wird über data-severity="warn" markiert — semantisch falsch und ohne aria-current · Bei leerer Liste rendert die Tabelle trotzdem ihren Kopf, der Empty-Text hängt lose darunter · Zusammenfassungs-Spalte ohne Kürzung — lange Texte sprengen die Tabelle, keine mobile Strategie
- **Quickwin:** Leere Tabelle konditional ausblenden und aktive Filter-Chips mit echtem Aktiv-Stil + aria-current statt data-severity="warn" auszeichnen.

#### `/worlds/[worldSlug]/dungeons/new` — **7/10** _(Design: gemischt)_

Anlage-Formular für einen neuen Dungeon mit klickbaren Schnellstart-Vorlagen. (`apps/studio/app/worlds/[worldSlug]/dungeons/new/page.tsx`)

- **Stärken:** Schnellstart-Presets füllen das Formular per Klick vor und setzen den Fokus — sehr gute Onboarding-UX · Schlankes, fokussiertes Formular mit konkreten Placeholdern ("Verlassener Tempel") · Abbrechen-Link zurück zur Liste neben dem Submit
- **Schwächen:** Kampagnen-Zuordnung läuft unsichtbar über ein Hidden-Field (Default: erste Kampagne) — der Nutzer sieht nicht, wohin der Dungeon wandert · Keine Fehleranzeige, falls die Server Action scheitert (kein useFormState/Fehler-Flash) · Preset-Karten sind Buttons mit Inline-Styles statt konsistenter v2-Card-Interaktion
- **Quickwin:** Kampagne als sichtbares Select-Feld statt Hidden-Input anbieten.

#### `/worlds/[worldSlug]/magic-items/[pageId]` — **7/10** _(Design: gemischt)_

Werkbank zum strukturierten Editieren eines magischen Gegenstands mit Export nach Homebrewery, Spieler-Handout und 5e.tools-JSON. (`apps/studio/app/worlds/[worldSlug]/magic-items/[pageId]/page.tsx`)

- **Stärken:** Saubere Spieler/DM-Trennung (sichtbare Beschreibung vs. DM-Geheimnis/Fluch), im Summary explizit erklärt · Drei Export-Formate direkt auf der Seite, inkl. player-safe Handout · Besitzer-Auswahl mit direktem Link zur Wiki-Seite des Besitzers
- **Schwächen:** Export-Blöcke sind reine <pre>-Dumps ohne Copy-Button oder Download · Formular verzichtet auf uwe-v2-form und baut das Layout per Inline-Flexbox nach; Checkbox-Label fällt aus dem Muster · Gespeichert-Hinweis nutzt Legacy-Klasse uwe-inspector-ok statt des Flash/Banner-Musters der Nachbarseiten
- **Quickwin:** Copy-to-Clipboard-Button an jedem Export-Block — das ist der Kern-Workflow dieser Seite.

#### `/worlds/[worldSlug]/roll-tables` — **7/10** _(Design: gemischt)_

Verwaltung gewichteter Zufallstabellen (Loot, Encounter, Namen) mit Würfeln-Button, Roll-Verlauf und Vorlagen-Seeding. (`apps/studio/app/worlds/[worldSlug]/roll-tables/page.tsx`)

- **Stärken:** Hervorragender Empty State: Vorlagen per Klick einspielen statt leerer Seite · Würfeln liefert Sofort-Ergebnis inline plus persistenten Verlauf (localStorage) mit Live-Update · Bearbeiten je Tabelle platzsparend in <details> eingeklappt, kompaktes Zeilen-Format für Einträge mit Gewichtung
- **Schwächen:** "Löschen" feuert ohne jede Bestätigung — als Ghost-Button direkt neben dem Würfeln-Button ist Datenverlust einen Fehlklick entfernt · Erfolgs-Banner erscheinen erst unterhalb des Roll-Verlauf-Panels statt oben auf der Seite · Kein Kategorie-Filter, obwohl jede Tabelle eine Kategorie hat — bei vielen Tabellen wird die Seite sehr lang
- **Quickwin:** Bestätigungsdialog (oder mindestens confirm) vor deleteRollTableAction.


### Studio Worlds: Labels & Print (Etiketten, Print-Center, Charakterdruck) — Ø 6.6

_Funktional reifer Bereich mit teils vorbildlichen Zuständen: DM-only-Absicherungen mit expliziter Bestätigung, auto-aktualisierende Druck-Queues, Flash-Messages und Empty States sind fast überall vorhanden. Durchgängig problematisch ist der Mix aus drei Styling-Welten (Legacy uwe-*, v2 uwe-v2-*, Tailwind/shadcn) auf denselben Seiten sowie die Redundanz von vier Einstiegspunkten (Label-Bibliothek, Maschinenraum-Druck, Print Center, Drucklisten-Detail), deren Abgrenzung die Maschinenraum-Druck-Seite sogar per Routen-Tabelle im UI erklären muss. Die dünnen Hub-/Picker-Seiten (labels/print, characters/print) fallen mit Dev-Jargon und fehlender Shell deutlich ab._

#### `/worlds/[worldSlug]/labels/print` — **4/10** _(Design: gemischt)_

Maschinenraum-Druck-Hub, der Drucklisten und die aktuelle Druck-Queue anzeigen soll. (`apps/studio/app/worlds/[worldSlug]/labels/print/page.tsx`)

- **Stärken:** Empty States für Listen und Queue vorhanden, Breadcrumb und PageHeader konsistent zur Shell
- **Schwächen:** Die Haupt-Sektion ist eine Meta-Tabelle, die interne Routen und API-Pfade als Code erklärt — Entwickler-Doku statt Nutzerfunktion · Versprochene Kernfunktion fehlt: kein Senden an Drucker möglich; Drucklisten nur als nackte Links, Jobs als bloße Textzeilen ohne Zeit/Drucker · Drei Design-Systeme auf einer Seite (uwe-v2-card, Legacy-Tabelle, shadcn Card/EmptyState) und minimalistische Empty States ("Leer") ohne Handlungshinweis
- **Quickwin:** Routen-Erklärtabelle streichen und stattdessen die Drucklisten als Karten mit Label-/Kopienzahl plus direktem "An Maschinenraum senden"-Einstieg rendern.

#### `/worlds/[worldSlug]/characters/print` — **5/10** _(Design: gemischt)_

Charakterbogen als Druck-HTML oder Markdown exportieren, mit Format-/Layout-Wahl und Live-Vorschau. (`apps/studio/app/worlds/[worldSlug]/characters/print/page.tsx`)

- **Stärken:** Format-/Layout-Picker mit sofortiger iframe-Vorschau; Layout-Select wird bei Markdown sinnvoll deaktiviert · Hilfreiche Erklärung, was der Kompakt-Modus ausblendet
- **Schwächen:** Ohne characterId nur eine Dead-End-Seite, die den Query-Parameter als Code nennt, statt eine Charakterauswahl anzubieten · Rendert außerhalb der WorldShell: kein Breadcrumb, keine Navigation, kein PageHeader — bricht mit allen anderen Welt-Seiten · Hartkodierte Inline-Styles (border: 1px solid #ccc) ignorieren die Design-Tokens; kein Ladezustand für die Vorschau
- **Quickwin:** Seite in WorldShell mit Breadcrumb einbetten und bei fehlender characterId eine Charakter-Auswahlliste statt des Parameter-Hinweises zeigen.

#### `/worlds/[worldSlug]/labels` — **7/10** _(Design: gemischt)_

Label-Bibliothek mit Tabs für Labels, Templates und Drucklisten inkl. Anlegen, Duplizieren und Export. (`apps/studio/app/worlds/[worldSlug]/labels/page.tsx`)

- **Stärken:** Klare IA: PageHeader mit Primäraktion, Tabs mit Zählern, Kontext-Panel mit Bestandszahlen, einklappbare Workflow-Kurzanleitung · Zustände gut abgedeckt: Erfolgs-Flash je Aktion, Empty States mit CTA, DM-only-Warnungen direkt in der Tabellenzeile · Drucklisten-Tab kombiniert Anlegen-Formular und Liste sinnvoll auf einer Ansicht
- **Schwächen:** Template-Umbenennen als Inline-Textfeld in der Aktionsspalte wirkt gequetscht; Löschen ohne Bestätigung · Der Tab "Maschinenraum-Druck" sieht aus wie ein Tab, navigiert aber auf eine andere Seite — bricht die Tab-Semantik · Stilmix: v2-Buttons/-Cards neben Legacy-Tabelle, -Tabs und -Panel
- **Quickwin:** Template-Umbenennen aus der Tabellenzeile in einen kleinen Dialog/Detailbereich verschieben und Löschen mit Bestätigung absichern.

#### `/worlds/[worldSlug]/labels/new` — **7/10** _(Design: gemischt)_

Neues Label aus Quelle (Seite/Raum/Block/Asset) oder als leeres manuelles Label erstellen. (`apps/studio/app/worlds/[worldSlug]/labels/new/page.tsx`)

- **Stärken:** Quellen-Dropdown sauber in optgroups gegliedert, DM-only-Blöcke gekennzeichnet · LabelTemplatePreviewPicker zeigt live eine maßstabsgetreue Format-Vorschau (aria-live) zur gewählten Vorlage · Empty State bei fehlenden Quellen mit klarem Fallback auf das manuelle Formular
- **Schwächen:** Zwei lange, fast identische Formulare untereinander (Vorlage/Modus/Kürzung doppelt) — konkurrieren um Aufmerksamkeit · Handout-Seiten erscheinen doppelt im Dropdown (in "Seiten" und nochmal in der Handout-Gruppe mit gleichem value) · Kein Fehler-Feedback-Pfad; der von anderen Seiten verlinkte ?template=-Parameter wird ignoriert
- **Quickwin:** Die beiden Erstellwege als Tabs/Segmented Control zusammenführen und die gemeinsamen Layout-Felder nur einmal rendern.

#### `/worlds/[worldSlug]/labels/[labelId]/preview` — **7/10** _(Design: gemischt)_

Fokussierte Druckvorschau eines Labels im 6×4-Format mit Export-Links. (`apps/studio/app/worlds/[worldSlug]/labels/[labelId]/preview/page.tsx`)

- **Stärken:** Klarer Single-Purpose-Aufbau: Header mit Drucken/Bearbeiten, Sidebar nur mit Exporten, sandboxte srcDoc-iframe-Vorschau · DM-only-Inhalte standardmäßig ausgeblendet mit explizitem Opt-in-Link — gutes Privacy-Default
- **Schwächen:** Kein Lade-/Fehlerzustand und keine Größen-/Zoom-Kontrolle für die iframe-Vorschau · Feste iframe-Höhe per CSS-Klasse kann Inhalt abschneiden statt sich dem Label-Format anzupassen
- **Quickwin:** Iframe-Höhe aus dem Seitenverhältnis der Vorlage ableiten (wie im TemplatePreviewPicker) statt fixer Klasse.

#### `/worlds/[worldSlug]/print-center` — **7/10** _(Design: gemischt)_

Druck-Dashboard der Welt mit Kennzahlen, Queue, Schnellaktionen, Karten-Vorlagen und offenen Drucklisten. (`apps/studio/app/worlds/[worldSlug]/print-center/page.tsx`)

- **Stärken:** Saubere Dashboard-Struktur: Stat-Karten, Queue mit Auto-Refresh, Schnellaktionen, Vorlagen- und Drucklisten-Karten in klaren v2-Sektionen · Jede Sektion hat einen Empty State mit Handlungsanweisung bzw. weiterführendem Link
- **Schwächen:** Vorlagen-CTA verlinkt auf /labels/new?template=<slug>, aber die Zielseite liest den template-Parameter nicht aus — Vorauswahl läuft ins Leere · Stat "Jobs in Queue" zählt die letzten 20 Jobs inkl. abgeschlossener — Zahl passt nicht zum Label · Empty-State-Text "Migration prüfen" ist Entwickler- statt Nutzersprache
- **Quickwin:** template-Parameter in /labels/new auswerten (Vorlage vorselektieren), damit der zentrale Vorlagen-CTA des Print Centers tatsächlich wirkt.

#### `/worlds/[worldSlug]/labels/[labelId]` — **8/10** _(Design: gemischt)_

Label-Detailseite mit visuellem Editor, Druckvorbereitung, Statuspflege, Template- und Drucklisten-Anbindung. (`apps/studio/app/worlds/[worldSlug]/labels/[labelId]/page.tsx`)

- **Stärken:** Beste Zustandsabdeckung der Gruppe: Erfolgs-Flash-Varianten, Safety- und Export-Warnungen, Fit-Status-Badge mit Auto-Fit/KI-Kürzen inkl. deaktiviertem Zustand mit Tooltip · Sidebar gruppiert Export, Druckstatus und Template sauber und hält die Hauptspalte fürs Editieren frei · Vorher/Nachher-Vergleich bei angewendeter Kürzung und eingebettete Druckvorschau vor dem Export
- **Schwächen:** Sehr dichte Seite mit redundanten Aktionen (Drucken/Vorschau im Header und in der Sidebar); Duplizieren/Zurücksetzen hängen kontextlos am Seitenende · Löschen ohne Bestätigungsdialog direkt im Header · Technik-Jargon in der Sidebar (HTTP-Header X-UWE-Export-Fallback) statt Nutzersprache
- **Quickwin:** Duplizieren/Auf-Vorlage-zurücksetzen zu den Header-Aktionen bzw. in die Sidebar ziehen und Löschen mit Confirm absichern.

#### `/worlds/[worldSlug]/labels/print-lists/[printListId]` — **8/10** _(Design: gemischt)_

Druckliste verwalten: Vorschau, Maschinenraum-Batch-Druck, Job-Fortschritt und Sortierung/Kopien der Labels. (`apps/studio/app/worlds/[worldSlug]/labels/print-lists/[printListId]/page.tsx`)

- **Stärken:** Kompletter Workflow logisch sektioniert: Vorschau (lazy iframe), Maschinenraum-Formular, auto-aktualisierender Job-Fortschritt, Drag-&-Drop-Editor mit Inline-Kopien · Vorbildliche DM-only-Absicherung: Warn-Flash plus Pflicht-Checkbox, die den Batch-Submit erst freischaltet · Fallback-Zustände für Connector offline / keine Drucker sowie Fehleranzeige über ?error-Parameter
- **Schwächen:** "Als gedruckt markieren" hängt als verwaister Button ohne Überschrift am Seitenende, Statuspflege dadurch verstreut · Löschen der Liste im Header ohne Bestätigung · Connector-/Drucker-Hinweise extrem knapp ("Keine Drucker. Suchen") — abgehackte Microcopy
- **Quickwin:** Statusaktion in den Header (ContextActions) integrieren und die Offline-/Drucker-Hinweise zu ganzen Sätzen mit klarer CTA ausbauen.


### Studio Worlds: Verwaltung (Assets, Backup, Import, AI-Runs, Brain, DnD-API) — Ø 6.4

_Die Verwaltungsgruppe ist funktional reif — besonders die Preview-vor-Ausführung-Flows bei Import und Backup-Restore sind vorbildlich abgesichert — aber visuell durchgehend ein Dreifach-Mix aus Legacy-uwe.css, v2-Klassen und Tailwind-basierter Shell; keine einzige Seite nutzt das V2-System konsequent. Wiederkehrende Muster: rohe IDs/Enums in der UI (Batch-Toolbar, Backup-Auswahl, Brain-Links, Statusmeldungen), fehlende Pagination bei wachsenden Listen und viele Inline-Styles. Größte Ausreißer nach unten sind die überladene Assets-Seite mit vierfach redundanten Asset-Listen und die DnD-API-Seite, deren Kartenlisten auf nirgends definierten CSS-Klassen basieren._

#### `/worlds/[worldSlug]/assets` — **4/10** _(Design: gemischt)_

Zentrale Asset-Bibliothek der Welt: Upload, Alben, Typ-/Sichtbarkeitsfilter, Tags, Freigabe-Links und Seiten-Verknüpfung. (`apps/studio/app/worlds/[worldSlug]/assets/page.tsx`)

- **Stärken:** Doppelte Filterleisten (Typ + Sichtbarkeit) mit aktivem Zustand und kombinierbaren Query-Params · dm_only-Warnhinweis mit Zähler und rot hinterlegte GM-only-Zeilen machen Portal-Sichtbarkeit sofort erkennbar · Empty State und Erfolgs-Flash vorhanden, Badges für Typ/Sichtbarkeit konsistent
- **Schwächen:** Dieselbe Asset-Liste wird viermal gerendert (Tabelle, Bearbeiten-Details, Freigabe-Details, Batch-Toolbar) — Bearbeiten eines Assets erfordert erneutes Suchen am Seitenende · AssetBatchToolbar zeigt Checkboxen mit abgeschnittenen IDs ('Asset a1b2c3d4…') statt Titeln — praktisch unbenutzbar · Upload-Formular postet direkt an die API ohne Client-Feedback/Progress; Seite insgesamt stark überladen (Alben-Anlage, Upload, Zuordnung immer sichtbar)
- **Quickwin:** Bearbeiten, Freigabe und Batch-Auswahl als Zeilenaktionen bzw. Checkbox-Spalte in die Asset-Tabelle integrieren und die drei redundanten Sektionen am Seitenende streichen.

#### `/worlds/[worldSlug]/dnd-api` — **5/10** _(Design: gemischt)_

Open5e/SRD-Suche mit Encounter-Builder (XP-Budget, Statblock-Import) und manueller D&D-Beyond-Linkverwaltung. (`apps/studio/app/worlds/[worldSlug]/dnd-api/page.tsx`)

- **Stärken:** Encounter-Builder funktional stark: Generator mit Budget-Parametern, Monster-Auswahl mit CR/Anzahl, laufende Budget-Zusammenfassung, Direkt-Navigation zur erstellten Seite · EmptyState-Komponente bei fehlenden Treffern und fehlenden Referenzen; Busy-Labels auf allen Aktionen · Klare Policy-Kommunikation im Header (D&D Beyond nur als Link-Referenz, kein Scraping)
- **Schwächen:** Die Klassen uwe-list-cards/uwe-list-card sind in keinem Stylesheet definiert — Suchergebnisse und Beyond-Links rendern als ungestylte Listen · Suchergebnisse erscheinen doppelt (Monster-Karten im Encounter-Panel und nochmal unter 'Alle Ergebnisse') ohne erkennbaren Mehrwert · Einheitliche message-Anzeige (uwe-notice) unterscheidet Fehler nicht von Erfolg; Encounter-Panel mit Titel-Feld und Erstellen-Button auch ohne jede Auswahl sichtbar
- **Quickwin:** uwe-list-card(s) im CSS definieren oder auf uwe-v2-card umstellen — die zentralen Ergebnislisten der Seite sind aktuell komplett ungestylt.

#### `/worlds/[worldSlug]/brain/[entryId]` — **6/10** _(Design: gemischt)_

Detail- und Bearbeitungsansicht eines Brain-Dokuments mit Lese-/Editier-Umschaltung. (`apps/studio/app/worlds/[worldSlug]/brain/[entryId]/page.tsx`)

- **Stärken:** ViewEditToggle trennt Lesemodus (Karte mit Meta-Zeile, Quelle, Chunk-Zahl, Seitenlink) sauber vom Formular · Speichern gibt Feedback ('Gespeichert.') und refresht die Server-Daten; 'Kein Inhalt.'-Fallback vorhanden · Breadcrumb führt korrekt über den Brain Store zurück
- **Schwächen:** Links-Sektion ist Entwickler-Output: 'relationType: targetType → targetId' mit rohen IDs, nichts verlinkt oder übersetzt · PageHeader-Summary generisch ('Brain-Dokument bearbeiten') statt Typ/Sichtbarkeit/Status zu nutzen · Keine Lösch-/Archivier-Aktion auf der Detailseite
- **Quickwin:** Links-Sektion menschenlesbar machen: Zieltitel auflösen, verlinken und Relationstypen übersetzen statt rohe IDs auszugeben.

#### `/worlds/[worldSlug]/backup` — **7/10** _(Design: gemischt)_

Welt-bezogene Backups erstellen, herunterladen, planen und per Vorschau-Flow wiederherstellen (BackupWorkspace). (`apps/studio/app/worlds/[worldSlug]/backup/page.tsx`)

- **Stärken:** Vorbildlicher Destruktiv-Flow: Vorschau vor Restore, RESTORE-Bestätigungstext, Warnbox mit Abbruch und Hinweis auf automatische Sicherheitskopie · Rechte-abhängige UI (canCreate/canRestore/owner-Schedule) und Busy-Zustände auf jedem Button ('Erstelle…', 'Analysiere…') · Klare Sektionierung: Erstellen → gespeicherte Backups → Zeitplan → Restore; Fehler mit role=alert, Erfolg mit role=status
- **Schwächen:** Sehr viele Inline-Styles statt Design-System-Klassen (Abstände, Farben, Flex-Layouts) — visuell inkonsistent zur restlichen App · 'Für Restore wählen' zeigt danach nur die rohe Backup-ID an, kein Dateiname und kein Sprung zur Restore-Sektion · Kampagnen-/Welt-Slug als Freitextfeld statt Auswahl; globale Fehlermeldung erst ganz unten, weit weg von der auslösenden Aktion
- **Quickwin:** Nach 'Für Restore wählen' den Dateinamen statt der ID anzeigen und automatisch zur Restore-Sektion scrollen — der aktuelle Zustandswechsel ist sonst leicht zu übersehen.

#### `/worlds/[worldSlug]/ai-runs` — **7/10** _(Design: gemischt)_

Historie aller KI-Läufe der Welt mit Status-Filter und automatischer Aktualisierung laufender Jobs. (`apps/studio/app/worlds/[worldSlug]/ai-runs/page.tsx`)

- **Stärken:** Status-Filter elegant als Sidebar-Navigation gelöst — Hauptbereich bleibt eine einzige klare Tabelle · Auto-Polling alle 2,5s nur solange pending/running-Läufe existieren — laufende Jobs aktualisieren sich ohne Reload · Header kommuniziert Gesamtzahl und das Vorschlags-Prinzip ('nichts wird automatisch Kanon'); Empty State vorhanden
- **Schwächen:** Status nur als Text ohne farbige Badges — fehlgeschlagene Läufe sind beim Scannen nicht unterscheidbar · Hartes Limit von 100 ohne Pagination oder Hinweis, obwohl der Header die (ggf. höhere) Gesamtzahl nennt · Tabelle ohne data-label-Attribute — der Mobile-Kartenmodus von uwe-page-table greift hier nicht
- **Quickwin:** Status-Spalte als farbige Badges (failed rot, running animiert) — mit einer Zeile Aufwand wird die Liste scanbar.

#### `/worlds/[worldSlug]/ai-runs/[runId]` — **7/10** _(Design: gemischt)_

Detailansicht eines KI-Laufs mit Metadaten, Prompts, Ergebnis und Review-Aktionen (übernehmen/verwerfen/abbrechen). (`apps/studio/app/worlds/[worldSlug]/ai-runs/[runId]/page.tsx`)

- **Stärken:** Klare Sektionsfolge: Metadaten-Grid → Aktionen → Fehler → Prompts → Ergebnis; leere Felder konsequent als '—' · Review-Aktionen kontextabhängig (nur bei completed, Abbrechen nur bei pending/running) inkl. optionalem Ablehnungskommentar und Copy-Button · Rohdaten (Kontext-JSON, Ergebnis-Metadaten) sinnvoll in <details> eingeklappt statt die Seite zu fluten
- **Schwächen:** Kein Auto-Refresh: Bei einem laufenden Run bleibt die Seite statisch, obwohl die Listenseite pollt · Feedback nach Statuswechsel zeigt den rohen Enum-Wert ('Status: applied') statt des deutschen Labels · System-/User-Prompt als immer offene, potenziell sehr lange pre-Blöcke; Aktions-Buttons in app-lokalem Legacy-Stil statt v2
- **Quickwin:** Auto-Polling für pending/running-Runs wie auf der Listenseite — aktuell muss man manuell neu laden, um das Ergebnis zu sehen.

#### `/worlds/[worldSlug]/brain` — **7/10** _(Design: gemischt)_

Übersicht des Brain Knowledge Store: Dokumente und Fakten der Welt auflisten, manuell anlegen und per KI generieren. (`apps/studio/app/worlds/[worldSlug]/brain/page.tsx`)

- **Stärken:** Gute Informationsarchitektur: Zusammenfassungszeile (Dokumente/Fakten/Chunks/Links) → zwei Tabellen → Anlegen → KI-Panel; Kampagnenfilter in der Sidebar · Dokumenten-Tabelle paginiert (25/Seite) mit sauberer URL-Erhaltung des Kampagnenfilters; Empty States für beide Tabellen · Tabellen mit data-label-Attributen — Mobile-Kartenmodus funktioniert; Privacy-Hinweis (lokaler Maschinenraum, kein Cloud-Fallback) im Kontextpanel
- **Schwächen:** Fakten-Tabelle lädt und rendert alle Einträge unpaginiert — inkonsistent zur Dokumenten-Tabelle und bei vielen Fakten unübersichtlich · Zwei große, immer offene Anlage-Formulare schieben das KI-Panel weit nach unten; einklappbar wäre aufgeräumter · Stilmix: v2-Cards/Buttons neben Legacy-Tabellen und app-lokalen uwe-brain-*-Klassen
- **Quickwin:** Fakten-Tabelle wie die Dokumente paginieren (gleiche brainPageHref-Mechanik) — verhindert, dass die Seite mit wachsendem Wissensbestand degeneriert.

#### `/worlds/[worldSlug]/brain/facts/[entryId]` — **7/10** _(Design: gemischt)_

Detail- und Bearbeitungsansicht eines Brain-Fakts mit Quellenbezügen und ähnlichen Fakten. (`apps/studio/app/worlds/[worldSlug]/brain/facts/[entryId]/page.tsx`)

- **Stärken:** 'Quellen & Bezüge' verlinkt Wiki-Seite, Kampagne und Session korrekt — starker Kontext für Herkunft des Fakts · 'Ähnliche Fakten' (gleicher Typ, max. 6) ist ein sinnvolles Entdeckungs-Element · Vollständiges, klar beschriftetes Formular mit Typ/Sichtbarkeit/Status als übersetzte Selects
- **Schwächen:** Immer im Editiermodus — inkonsistent zur Dokument-Detailseite, die einen View/Edit-Toggle hat · Links-Sektion identisch roh wie beim Dokument (relationType/targetId unübersetzt, unverlinkt) · Kein Speicher-Feedback und keine Lösch-Aktion
- **Quickwin:** Denselben ViewEditToggle wie bei Brain-Dokumenten einsetzen — konsistente Bedienung und ruhigerer Lesemodus.

#### `/worlds/[worldSlug]/import` — **8/10** _(Design: gemischt)_

KnoteForge-JSON oder Markdown/TXT-Texte mit Vorschau-Bestätigungs-Flow importieren plus Batch-Konvertierung bestehender Wikitexte. (`apps/studio/app/worlds/[worldSlug]/import/page.tsx`)

- **Stärken:** Sauberer zweistufiger Flow: Quelle → Vorschau mit Status-Badges, Konflikt-/Warnungs-Anzeige pro Eintrag, Auswahl-Checkboxen mit Select-All → bestätigter Import mit Fortschrittsbalken und Protokoll · Durchdachte Zustände: Buttons disabled ohne Inhalt/Auswahl, Fehler-Flash, 'nichts zu tun'-Meldung im WikitextConvertPanel, expliziter Rollback-Warnhinweis mit Backup-Link · Sidebar mit kompakten Hinweisen zu Formaten und Verhalten entlastet den Hauptbereich
- **Schwächen:** Konflikt-Status bekommt nur ein neutrales 'uwe-badge', Fehler zweckentfremdet 'uwe-badge-secret' — die kritischsten Status sind visuell am schwächsten kodiert · Vorschau- und Protokoll-Tabellen ohne Pagination — bei großen Exporten (hunderte Einträge) unübersichtlich · Backup-Link im Warnhinweis zeigt auf /backup statt auf die welt-eigene Backup-Seite
- **Quickwin:** Eigene Warn-/Fehler-Badge-Varianten für Konflikt und Fehler in der Vorschau-Tabelle, damit die entscheidungsrelevanten Zeilen sofort ins Auge springen.


### Portal: Öffentlich & Einstieg (Login, Weltliste, Share-Links) — Ø 6.8

_Der Portal-Einstieg ist zweigeteilt: Die Hälfte der Gruppe sind reine Redirect-Stubs ohne UI (Root, /portal, alle /worlds-Legacy-Pfade), die Auth-aware und Deep-Link-erhaltend sauber umleiten, aber temporäre statt permanente Redirects nutzen. Die sichtbaren Seiten (Login, Passwort-Flows, Share-Gates) sitzen konsistent auf dem neuen Tailwind/shadcn-Stack mit vorbildlicher Zustandsabdeckung (2FA, Turnstile, abgelaufene/deaktivierte Links, Passwort-Gates) — nur unbehandelte Netzwerkfehler lassen Buttons in Ladezuständen hängen. Einziger echter Ausreißer ist die Maintenance-Seite: Legacy-CSS plus zwei nirgends definierte Klassen, wodurch das Zentrieren-Layout schlicht nicht existiert._

#### `/maintenance` — **4/10** _(Design: legacy)_

Wartungsmodus-Hinweisseite, die alle 30 Sekunden automatisch auf Wiederverfügbarkeit prüft. (`apps/portal/app/maintenance/page.tsx`)

- **Stärken:** MaintenanceRecoveryPoller lädt automatisch neu, sobald der Wartungsmodus endet — und die Seite sagt das dem Nutzer transparent · Admin-konfigurierbare Meldung mit sinnvollem deutschen Fallback-Text
- **Schwächen:** Die Klassen uwe-page und uwe-page-centered sind in keinem CSS des Repos definiert — die Zentrierung existiert nicht, der Card klebt unstrukturiert oben links · Einzige Seite der Gruppe auf Legacy-uwe-*-Klassen statt PortalAuthShell — bricht die visuelle Konsistenz des Auth-Einstiegs · Kein Branding/Logo — Nutzer sehen nicht, dass sie beim UWE Portal sind
- **Quickwin:** Auf PortalAuthShell umstellen: behebt gleichzeitig die tote uwe-page-centered-Klasse, die fehlende Zentrierung und die Inkonsistenz zum restlichen Auth-Flow.

#### `/worlds/[worldSlug]/[category]/[slug]` — **5/10** _(Design: unklar)_

Legacy-Weiterleitung alter Wiki-Artikel-URLs auf das neue Schema ohne Kategorie-Segment. (`apps/portal/app/worlds/[worldSlug]/[category]/[slug]/page.tsx`)

- **Stärken:** Artikel-Deep-Links (worldSlug + slug) bleiben grundsätzlich erreichbar · Gleiches zentrales Redirect-Muster wie die übrigen Legacy-Routen
- **Schwächen:** Das category-Segment wird kommentarlos verworfen — waren Slugs nur pro Kategorie eindeutig, laufen alte Links ins 404 · Temporärer statt permanenter Redirect
- **Quickwin:** Beim Verwerfen der Kategorie prüfen (oder dokumentieren), dass Page-Slugs weltweit eindeutig sind — sonst Kategorie ins neue Ziel mappen.

#### `/worlds` — **6/10** _(Design: unklar)_

Legacy-Weiterleitung der alten Weltlisten-URL auf den neuen Hub /auth/worlds. (`apps/portal/app/worlds/page.tsx`)

- **Stärken:** Alte Bookmarks bleiben funktionsfähig; Gäste werden mit korrektem redirect-Ziel zum Login geführt · Logik zentral in legacy-world-redirect.ts gebündelt statt pro Seite dupliziert
- **Schwächen:** Nutzt redirect() (307 temporär) statt permanentRedirect() — Browser und Suchmaschinen lernen die neue URL nie
- **Quickwin:** Auf permanentRedirect() umstellen, damit Clients die Legacy-URL dauerhaft durch /auth/worlds ersetzen.

#### `/worlds/[worldSlug]` — **6/10** _(Design: unklar)_

Legacy-Weiterleitung einer alten Welt-URL auf /auth/worlds/[worldSlug] inklusive Login-Umweg für Gäste. (`apps/portal/app/worlds/[worldSlug]/page.tsx`)

- **Stärken:** Slug bleibt erhalten — Deep-Links auf Welten überleben die IA-Migration · Gäste landen nach dem Login direkt am ursprünglich angefragten Ziel
- **Schwächen:** Temporärer statt permanenter Redirect für eine dauerhaft umgezogene URL · worldSlug wird ungeprüft weitergereicht; ungültige Slugs erzeugen erst downstream ein 404
- **Quickwin:** permanentRedirect() für den eingeloggten Pfad verwenden — der Login-Umweg darf temporär bleiben.

#### `/worlds/[worldSlug]/graph` — **6/10** _(Design: unklar)_

Legacy-Weiterleitung der alten Graph-Ansicht auf /auth/worlds/[worldSlug]/graph. (`apps/portal/app/worlds/[worldSlug]/graph/page.tsx`)

- **Stärken:** Suffix-Mechanik des zentralen Redirect-Helpers hält die Route trivial und konsistent · Graph-Deep-Links inklusive Login-Umweg für Gäste erhalten
- **Schwächen:** Temporärer statt permanenter Redirect wie bei allen Legacy-Stubs
- **Quickwin:** Zusammen mit den anderen Legacy-Routen zentral in redirectLegacyWorldPath auf permanentRedirect() wechseln — eine Stelle, vier Routen gefixt.

#### `/` — **7/10** _(Design: unklar)_

Wurzel-Einstieg, der eingeloggte Nutzer zum sanitierten Ziel und Gäste zum Login umleitet. (`apps/portal/app/page.tsx`)

- **Stärken:** Redirect-Ziel wird über sanitizePortalRedirectPath gegen Open-Redirects abgesichert · Session-Fehler (getCurrentUser wirft) führen sauber zum Login statt zu einem Crash
- **Schwächen:** Kein gerenderter Fallback — bei langsamem Server-Redirect sieht der Nutzer nur eine weiße Seite · Session-Fehler werden stumm verschluckt; der Nutzer erfährt nie, warum er ausgeloggt wurde
- **Quickwin:** Beim Catch-Fall einen Query-Hinweis (z.B. ?error=session) an die Login-URL hängen, damit der Login-Screen erklären kann, warum die Sitzung endete.

#### `/portal` — **7/10** _(Design: unklar)_

Einstiegs-Router, der Gäste zum Login schickt und Nutzer mit genau einer Welt direkt hinein leitet. (`apps/portal/app/portal/page.tsx`)

- **Stärken:** Single-World-Shortcut: Wer nur eine Welt hat, landet ohne Zwischenschritt direkt darin — gute IA-Entscheidung · Klare Login-Weiterleitung mit korrektem redirect-Ziel /auth/worlds
- **Schwächen:** Ignoriert einen eventuellen ?redirect-Parameter — inkonsistent zur Root-Seite, die Deep-Links erhält · Kein UI-Fallback während der zwei sequentiellen DB-Aufrufe (User + Weltliste)
- **Quickwin:** searchParams.redirect wie auf der Root-Seite sanitieren und durchreichen, damit Deep-Links auch über /portal funktionieren.

#### `/forgot-password` — **8/10** _(Design: v2)_

Fordert einen Passwort-Reset-Link per E-Mail an, enumeration-sicher formuliert. (`apps/portal/app/forgot-password/page.tsx`)

- **Stärken:** Enumeration-sichere Erfolgsmeldung ersetzt das Formular komplett — klarer Abschlusszustand · Kontext-Hinweis, dass das Konto vom DM verwaltet wird, beugt Support-Fragen vor · Konsistente Auth-Card mit Loading-Zustand und Zurück-Link zur Anmeldung
- **Schwächen:** fetch ohne try/catch: Bei Netzwerkfehler bleibt der Button dauerhaft auf 'Sende Link…' hängen und keine Fehlermeldung erscheint
- **Quickwin:** Submit in try/catch wickeln und bei Netzwerkfehler einen danger-Alert zeigen, damit der Ladezustand nie festhängt.

#### `/reset-password` — **8/10** _(Design: v2)_

Setzt über einen Token-Link ein neues Passwort mit Live-Anforderungs-Checkliste. (`apps/portal/app/reset-password/page.tsx`)

- **Stärken:** Fehlender/ungültiger Token wird sofort als klarer Fehlerzustand gerendert statt erst beim Submit · Live-PasswordRequirements-Checkliste plus Client-Validierung (Länge, Übereinstimmung) vor dem Request · E-Mail-Feld erscheint nur, wenn es nicht schon aus der URL kommt — reduziert Formularlast; Erfolg landet als Banner auf /login
- **Schwächen:** fetch und response.json() ohne try/catch: Netzwerkfehler oder Nicht-JSON-Antwort lassen den Button auf 'Speichere…' hängen bzw. crashen den Handler · Bestätigungsfeld gibt erst beim Submit Feedback, kein Live-Abgleich der beiden Passwörter
- **Quickwin:** Request und JSON-Parsing absichern (try/catch) mit generischem Netzwerkfehler-Alert — wie es das Login-Formular bereits vormacht.

#### `/share/[token]` — **8/10** _(Design: v2)_

Öffentliche Freigabe-Ansicht eines Wiki-Artikels oder Assets über einen Token-Link mit Passwort-Gate. (`apps/portal/app/share/[token]/page.tsx`)

- **Stärken:** Vorbildliche Zustandsmaschine: deaktiviert (global/Link), abgelaufen (mit Datum), Passwort-Gate, Policy-Verstoß und not_found werden jeweils mit eigener, verständlicher Meldung gerendert · Asset-Handling differenziert: Bilder inline, PDFs im iframe, alles andere als Download-Button — statt eines generischen Links · Vollwertige PortalShell mit reduzierter Share-Navigation, WikiSidebar (Backlinks/verwandte Seiten) und Tag-Chips im PageHeader
- **Schwächen:** Die Meldung 'Passwort erforderlich' nennt Gästen die interne Env-Variable PLAYER_PREVIEW_REQUIRE_TOKEN — technisches Detail in einer Endnutzer-Fehlermeldung · Kein Breadcrumb auf der Einstiegsseite, obwohl die Unterseite einen hat — inkonsistente Orientierung · resolveShareView ist fast vollständig mit der Unterseiten-Route dupliziert; Abweichungen der Gate-Texte sind vorprogrammiert
- **Quickwin:** Env-Variablen-Namen aus der Gast-Fehlermeldung streichen und den Hinweis fürs Studio/Log reservieren — Gäste brauchen nur 'Bitte den Spielleiter um einen geschützten Link bitten'.

#### `/share/[token]/pages/[slug]` — **8/10** _(Design: v2)_

Unterseite einer Freigabe: rendert verlinkte Wiki-Artikel innerhalb des Share-Grants mit Breadcrumb. (`apps/portal/app/share/[token]/pages/[slug]/page.tsx`)

- **Stärken:** Gleiche vollständige Gate-Zustandsmaschine wie die Hauptseite — kein Zustand fällt beim Navigieren in Unterseiten weg · BreadcrumbTrail (Freigabe → Artikel) gibt Gästen Orientierung und Rückweg im tokenbasierten Kontext · Kontextpanel mit Backlinks/verwandten Seiten macht das Share-Erlebnis zum echten Mini-Wiki
- **Schwächen:** Ungültiger Artikel-Slug innerhalb eines gültigen Links endet im harten globalen 404 statt in einer Gate-Message mit Rückweg zur Freigabe-Startseite · Rund 90 Zeilen resolve- und Gate-Logik 1:1 aus der Hauptroute dupliziert · Tag-Chips im Header sind reine Dekoration ohne Funktion oder Tooltip
- **Quickwin:** not_found bei gültigem Link, aber unbekanntem Slug durch eine ShareGateMessage mit Link zurück zu /share/[token] ersetzen — Gäste haben sonst keine Rettung außer dem Browser-Zurück.

#### `/login` — **9/10** _(Design: v2)_

Anmeldeseite mit E-Mail/Passwort, optionalem Cloudflare-Turnstile und 2FA-Folgeschritt. (`apps/portal/app/login/page.tsx`)

- **Stärken:** Sehr vollständige Zustände: Loading, Fehler, reset=success-Banner, forbidden-Hinweis, 2FA-Subview mit Zurück-Button, Suspense-Fallback · Durchdachte Details: Turnstile-Token wird nach Fehlversuch erneuert (Single-Use), korrekte autoComplete/inputMode/aria-invalid-Attribute, Passwort-vergessen-Link direkt am Feld · Konsistente zentrierte Card (PortalAuthShell) auf dem neuen Tailwind/shadcn-Stack, Dev-Credentials nur in Development sichtbar
- **Schwächen:** aria-invalid markiert bei jedem Fehler pauschal beide Felder, auch bei reinen Server-/Netzwerkfehlern · Kein Passwort-Sichtbarkeits-Toggle — auf Mobilgeräten fehleranfällig · Submit-Button ist bis zur Turnstile-Lösung deaktiviert, ohne dass der Button selbst den Grund nennt
- **Quickwin:** Passwort-Sichtbarkeits-Toggle am Passwortfeld ergänzen — geringster Aufwand, größter Effekt auf mobile Login-Fehlversuche.


### Portal: Welt A (Hub, Wiki-Seiten, Atlas, Charaktere, Handouts, NPCs) — Ø 6.8

_Die Portal-Welt-A-Gruppe ist solide und ungewöhnlich konsequent bei Zuständen: fast jede Seite hat Empty-States (PortalEmptyState), das Dashboard sogar per-Widget-Leertexte, und die Notiz-Workflows funktionieren ohne Client-JS über Server Actions. Die größten Schwächen sind Stil-Fragmentierung (Tailwind-Kit im Hub, massive Inline-Styles im Atlas, Legacy-Klassen überall sonst — das V2-System aus shared-ui/components-v2 wird auf keiner Seite genutzt) sowie Detail-Rauschen wie rohe effectiveRole-Werte im Fließtext und redundante Badges. Ausreißer nach unten ist /notes, wo eine doppelte Notiz-UI (eigene Liste plus leeres PlayerNotesPanel) sich selbst widerspricht und Entwürfe auf der eigenen Notizseite nicht gesendet werden können._

#### `/auth/worlds/[worldSlug]/notes` — **5/10** _(Design: legacy)_

Notizzentrale: eigene Entwürfe/gesendete Notizen und vom GM freigegebene Gruppennotizen, plus Formular für neue Notizen. (`apps/portal/app/auth/worlds/[worldSlug]/notes/page.tsx`)

- **Stärken:** Klare Zweiteilung 'Eigene Notizen' / 'Gruppennotizen' mit Status-Badges und Autorennamen · Gruppennotizen-Sektion erscheint nur, wenn es freigegebene Notizen gibt · Notiz-Erstellung als Server-Action-Formular — funktioniert ohne Client-JS
- **Schwächen:** Doppelte UI: unter der echten Notizliste rendert PlayerNotesPanel mit notes=[] die Überschrift 'Kommentare & Notizen' samt widersprüchlichem 'Noch keine Notizen.' · Entwürfe in 'Eigene Notizen' haben keine Aktionen — 'An GM senden'/'Bearbeiten' existieren nur im PlayerNotesPanel, das hier leer bleibt · Verlinkte Seite (pageTitle) nur bei eigenen, nicht bei Gruppennotizen sichtbar
- **Quickwin:** PlayerNotesPanel die echten myNotes übergeben und die separate Doppel-Liste streichen — Entwürfe werden dann direkt hier sende- und editierbar, der Widerspruch verschwindet.

#### `/auth/worlds/[worldSlug]/atlas` — **6/10** _(Design: legacy)_

Atlas-Index: hierarchische Baumliste der spieler-sichtbaren Kartenknoten mit Level-Icons und Zähl-Chips pro Ebene. (`apps/portal/app/auth/worlds/[worldSlug]/atlas/page.tsx`)

- **Stärken:** Baum mit Einrückung, Level-Icons und -Labels macht die Globus→Stadt-Hierarchie sofort lesbar · Zusammenfassungs-Chips pro Ebene geben schnellen Überblick über den Kartenbestand · Back-Link und Empty-Hinweis bei unsichtbarem Atlas vorhanden
- **Schwächen:** Fast alles inline gestylt (Chips, Liste, Hint) statt der etablierten uwe-/auth-Klassen — nicht zentral pflegbar · Empty-State nur als schlichter Textabsatz, während Schwesterseiten PortalEmptyState nutzen · Native <a>-Links statt next/link erzwingen Full-Page-Reloads; Einrückung depth*20px ohne Mobile-Rücksicht
- **Quickwin:** Inline-Styles in CSS-Klassen überführen und den Empty-Zustand auf PortalEmptyState umstellen — stellt die Konsistenz mit dem Rest des Portals her.

#### `/auth/worlds/[worldSlug]/characters` — **6/10** _(Design: legacy)_

Liste der sichtbaren Charakterbögen mit Kernwerten (Stufe, RK, Initiative, Passive Wahrnehmung) und Markierung des eigenen Charakters. (`apps/portal/app/auth/worlds/[worldSlug]/characters/page.tsx`)

- **Stärken:** Kompakte Statszeile pro Charakter direkt in der Liste — nützliche Infos ohne Klick · 'Dein Charakter'-Badge hebt den eigenen Charakter hervor · Empty-State über PortalEmptyState vorhanden
- **Schwächen:** Eigenerkennung per fragilem Namens-String-Vergleich mit membership.characterName statt Owner-ID — schlägt bei abweichender Schreibweise still fehl · Charaktere ohne pageSlug werden als tote, nicht klickbare Einträge gerendert, ohne dass der Unterschied erklärt wird · Titel 'Meine Charaktere' passt nicht, wenn die Liste auch fremde Party-Charaktere enthält
- **Quickwin:** Eigenerkennung auf ownerUserId umstellen und den eigenen Charakter an den Listenanfang sortieren.

#### `/auth/worlds` — **7/10** _(Design: gemischt)_

Welten-Hub: Liste aller freigegebenen Welten mit Aktivitäts-Badge, für Admins zusätzlich Welt-Erstellung mit Template-Auswahl. (`apps/portal/app/auth/worlds/(hub)/page.tsx`)

- **Stärken:** Differenzierte Empty-States je nach Login/Rolle inkl. Handlungsaufforderung (Login-Link bzw. Erstell-Formular) · CreateWorldForm mit Template-Karten, Auswahl-Hint, Fehler-Alert und Pending-State ('Erstelle…') · 'Neu seit deinem letzten Besuch'-Badge über localStorage-Visit-Tracking
- **Schwächen:** Erstell-Formular steht für Admins permanent aufgeklappt VOR der Weltenliste und dominiert die Seite · Stilbruch im selben Card: Tailwind/shadcn-Formular neben Legacy-Klassen (auth-world-list, uwe-badge) · Keine Suche/Sortierung der Weltenliste bei vielen Welten
- **Quickwin:** Erstell-Formular hinter einen 'Neue Welt'-Button (Details/Dialog) klappen, damit die Weltenliste zuerst sichtbar ist.

#### `/auth/worlds/[worldSlug]/assets` — **7/10** _(Design: legacy)_

Galerie freigegebener Medien und Handouts mit Typ-Filterleiste, Inline-Vorschau (Bild/PDF) oder Download-Fallback. (`apps/portal/app/auth/worlds/[worldSlug]/assets/page.tsx`)

- **Stärken:** Typ-Filterleiste mit aktivem Zustand und 'Alle Typen'-Reset über URL-Parameter · MIME-basierte Vorschau: Bild-Thumb, PDF-iframe, sonst Download-Link — kein toter Eintrag · Empty-State vorhanden, Badges für Typ und Sichtbarkeit pro Asset
- **Schwächen:** Filterleiste listet alle ASSET_TYPES, auch solche ohne einen einzigen Treffer — führt in leere Ergebnisse · Empty-State unterscheidet nicht zwischen 'keine Assets' und 'keine für diesen Filter' (kein Reset-Angebot) · Roher effectiveRole-Wert (z. B. 'player') unübersetzt im deutschen Lead-Text
- **Quickwin:** Empty-State filterbewusst machen: 'Keine <Typ>-Assets freigegeben' plus Link 'Filter zurücksetzen'.

#### `/auth/worlds/[worldSlug]/atlas/[nodeId]` — **7/10** _(Design: legacy)_

Interaktiver Canvas-Kartenviewer eines Atlas-Knotens mit Hierarchie-Breadcrumb, Zoom/Pan, Tooltips und klickbaren Wiki-/Unterebenen-Links. (`apps/portal/app/auth/worlds/[worldSlug]/atlas/[nodeId]/page.tsx`)

- **Stärken:** Hierarchie-Breadcrumb plus Info-Bar mit Interaktionslegende ('Scrollen: Zoom', klickbare Marker farbcodiert) · Tooltips mit direkten Wiki-Links, Kompassrose/Maßstab je nach Kartenstil-Preset · A11y beachtet: aria-label auf Breadcrumb-nav und Canvas
- **Schwächen:** 1100+-Zeilen-Komponente komplett inline gestylt, Legendenfarben hardcodiert (#3b82f6, #059669) statt Tokens · Keine Zoom-Buttons (+/−/Reset) — Touch- und Trackpad-Nutzer sind allein auf Wheel/Pinch angewiesen · Leerer Knoten (keine Features/Objekte) zeigt nur eine leere Pergamentfläche ohne Hinweis
- **Quickwin:** Zoom-Steuerung (+/−/Reset) als Overlay ergänzen — größter Gewinn für Touch-Geräte und Bedienbarkeit.

#### `/auth/worlds/[worldSlug]/graph` — **7/10** _(Design: legacy)_

Vollflächiges interaktives Beziehungsnetz der sichtbaren Seiten, client-seitig geladen mit Fokus-/Modus-Parametern (focus/neighbors/backlinks). (`apps/portal/app/auth/worlds/[worldSlug]/graph/page.tsx`)

- **Stärken:** Loading- und Fehlerzustand explizit behandelt (eigene uwe-graph-empty-Container) · Screenreader-h1, sichtbarer Titel als Overlay im Graphen — bewusste A11y-Entscheidung · Modus-Parameter wird serverseitig validiert statt ungeprüft durchgereicht
- **Schwächen:** Fehlermeldung zeigt rohen HTTP-Status ('… (403).') und bietet keinen Retry-Button · Loading nur als Textzeile ohne Skeleton — bei großem Graph wirkt die Seite lange leer
- **Quickwin:** Fehlerzustand mit 'Erneut versuchen'-Button und nutzerfreundlicher Meldung statt Statuscode ausstatten.

#### `/auth/worlds/[worldSlug]/handouts` — **7/10** _(Design: legacy)_

Handout-Postfach: pro Session freigeschaltete In-Game-Dokumente mit Neu-Markierung, Freischaltdatum und Session-Label. (`apps/portal/app/auth/worlds/[worldSlug]/handouts/page.tsx`)

- **Stärken:** 'X neu'-Zähler im Lead plus Neu-Markierung pro Eintrag — klares Posteingangs-Mentalmodell · Freischaltdatum und Session-Label geben jedem Handout Spielkontext · Empty-State und Querverweis auf die Asset-Galerie vorhanden
- **Schwächen:** Neu-Markierung als rohes 🆕-Emoji statt des vorhandenen portal-new-badge — inkonsistent mit dem Hub · PageTypeBadge zeigt bei jedem Eintrag redundant 'Handout', obwohl die Liste nur Handouts enthält · Keine Sortier-/Filteroption für lange Postfächer (z. B. nur Neue)
- **Quickwin:** 🆕-Emoji durch das etablierte portal-new-badge ersetzen und die redundante Typ-Badge entfernen.

#### `/auth/worlds/[worldSlug]/npcs` — **7/10** _(Design: legacy)_

Durchsuchbare Liste der freigeschalteten NPC-Seiten mit Badges und Kurzbeschreibung. (`apps/portal/app/auth/worlds/[worldSlug]/npcs/page.tsx`)

- **Stärken:** Suchfeld mit URL-getriebener Filterung über Titel, Slug und Summary · Differenzierter Empty-State: 'Keine passenden NPCs' (mit Tipp) vs. 'Keine NPCs freigeschaltet' · Einheitliches Listenmuster mit Typ-Badge und Summary — konsistent mit Handouts/Dashboard
- **Schwächen:** Roher effectiveRole-Wert (z. B. 'player') unübersetzt im deutschen Lead · VisibilityBadge auf einer per Definition spieler-sichtbaren Liste ist informationsfrei · Keine Sortierung/Gruppierung (z. B. nach Ort oder Fraktion) bei langen NPC-Listen
- **Quickwin:** effectiveRole ins Deutsche mappen (Spieler/Gast/Spielleiter) oder aus dem Lead streichen — betrifft auch die Assets-Seite.

#### `/auth/worlds/[worldSlug]` — **8/10** _(Design: legacy)_

Kampagnen-Dashboard einer Welt mit Widgets (nächste Session, Recap, Quests, NPCs, Orte, Handouts, Notizen) plus globaler Suche mit Typ-Filter. (`apps/portal/app/auth/worlds/[worldSlug]/page.tsx`)

- **Stärken:** Durchdachte Widget-Architektur: jede Sektion mit eigenem 'Alle'-Link und spezifischem Leertext · Suche ersetzt das Dashboard sauber durch Filterbar + Ergebnisliste, URL-getrieben (q/filter) · Preview-as-Player-Funktion direkt integriert, globaler Empty-State wenn nichts freigegeben ist
- **Schwächen:** Aktiver Preview-Modus nur als unscheinbarer Klammerzusatz im Lead — leicht zu übersehen · Header minimal: statisches 'Kampagnen-Übersicht' ohne Meta-Infos (Rolle, Kampagne, letzte Aktivität)
- **Quickwin:** Preview-as-Player als deutliches Banner mit 'Preview beenden'-Aktion statt Klammerzusatz rendern.

#### `/auth/worlds/[worldSlug]/[slug]` — **8/10** _(Design: legacy)_

Wiki-Detailseite mit Content-Blöcken, Badges, Nachbarschaftsgraph, Chronik sowie bedingtem Charakterbogen-, Edit- und Notizen-Panel. (`apps/portal/app/auth/worlds/[worldSlug]/[slug]/page.tsx`)

- **Stärken:** Klarer Seitenkopf: Back-Link, Titel, Typ-/Sichtbarkeits-/Quest-Status-Badges und Summary als Lead · Panels erscheinen nur bei Relevanz (Charakterbogen mit Level-Up-Vorschlägen, Edit nur bei Berechtigung, Notizen nur mit Kampagne) · Bild-Blöcke sauber als figure/figcaption mit lazy loading
- **Schwächen:** Jeder Block wiederholt Typ- und Sichtbarkeits-Badges — visuelles Rauschen ohne Nutzen für Spieler · Bis zu fünf gestapelte Zusatzpanels (Graph, Chronik, Sheet, Edit, Notizen) ohne Anker- oder Sekundärnavigation auf langen Seiten
- **Quickwin:** Block-Meta-Badges nur anzeigen, wenn die Sichtbarkeit vom Seitendefault abweicht — reduziert das Rauschen pro Block massiv.


### Portal: Welt B (Quests, Sessions, Timeline, Treasury, Wiki, Account) — Ø 7.1

_Die Portal-Welt-Seiten sind funktional solide, rollenbewusst gefiltert und durchweg mit sinnvollen Sektionen aufgebaut, hängen aber fast komplett im Legacy-CSS (portal-*/auth-*-Klassen) mit Inline-Styles, Text-Link-Filtern und repetitiven Inline-Formularen; nur die Empty States kommen bereits aus dem neuen Kit. Die Account-Seiten zeigen den Zielzustand: Sie nutzen das moderne Tailwind-Kit des Portals (PageHeader/Card/Alert auf --uwe-Tokens — nicht das shared-ui components-v2) und wirken deutlich aufgeräumter, haben aber ein wiederkehrendes fetch-ohne-try/catch-Problem, das Buttons bei Netzwerkfehlern hängen lässt. Größter Hebel für die Gruppe: einheitliche Feedback-Zustände nach Aktionen (Vote, Frage, Item-Transfer) und die Migration der Welt-Seiten auf das Card-/Badge-Kit der Account-Seiten._

#### `/auth/worlds/[worldSlug]/questions` — **6/10** _(Design: legacy)_

Spieler stellen zwischen den Runden Fragen an den DM und sehen dessen Antworten als Q&A-Liste. (`apps/portal/app/auth/worlds/[worldSlug]/questions/page.tsx`)

- **Stärken:** Klarer Aufbau: Erklärung, Frageformular, Q&A-Liste als getrennte Sektionen · Antworten visuell hervorgehoben (portal-dash-highlight) mit Status-Label für unbeantwortete Fragen · Gast-Fallback vorhanden (Hinweis statt Formular, wenn nicht angemeldet)
- **Schwächen:** Empty State nur als nackter Text statt der etablierten PortalEmptyState-Komponente · Kein Feedback nach dem Absenden (kein Pending-State, keine Erfolgsmeldung) — die neue Frage erscheint nur stumm in der Liste · Inline-Style (marginTop) statt CSS-Klasse für die Antwort-Box
- **Quickwin:** Nach dem Absenden eine sichtbare Bestätigung anzeigen (z. B. via Redirect-Query + Erfolgsbanner) und den Empty State auf PortalEmptyState umstellen.

#### `/auth/worlds/[worldSlug]/treasury` — **6/10** _(Design: legacy)_

Gruppenschatzkammer mit Währungsbestand, geteiltem Inventar und Item-Übergabe zwischen Schatzkammer und eigenen Charakteren. (`apps/portal/app/auth/worlds/[worldSlug]/treasury/page.tsx`)

- **Stärken:** Klare Sektionierung (Währung, Notizen, Inventar, Meine Charaktere) mit Empty-Text je Sektion · Item-Transfer in beide Richtungen direkt inline möglich, mit sauberem returnPath · 'Zuletzt aktualisiert'-Zeitstempel schafft Vertrauen in die Daten
- **Schwächen:** Fünf Währungswerte als vertikale Liste im Seiten-Listen-Stil (auth-page-list) — verschenkt Platz und wirkt wie klickbare Einträge · Pro Inventar-Item ein komplettes Formular mit Charakter-Select + Button — bei vielen Items extrem repetitiv · Viele Inline-Styles (margin/marginBottom) statt CSS-Klassen, kein Feedback nach einem Transfer
- **Quickwin:** Währungen als kompakte Badge-/Chip-Zeile (z. B. '120 Gold · 34 Silber') statt als Liste darstellen — größter visueller Gewinn mit kleinstem Aufwand.

#### `/auth/worlds/[worldSlug]/quests` — **7/10** _(Design: gemischt)_

Rollenbasiert gefiltertes Questlog mit Status-/Prioritätsfilter, Volltextsuche und persönlicher Quest-Priorisierung. (`apps/portal/app/auth/worlds/[worldSlug]/quests/page.tsx`)

- **Stärken:** Durchdachte Filterlogik: URL-basierte Status-Tabs, Suche behält Filter via Hidden-Fields, Sortierung nach eigener Priorität mit Stern-Markierung · Badges (Typ/Sichtbarkeit/Queststatus) machen jede Zeile auf einen Blick scanbar · Empty State unterscheidet Suche ohne Treffer von 'nichts freigeschaltet'
- **Schwächen:** Filter sind nur Text-Links mit '·'-Trennern in einem auth-muted-Absatz — keine Tab-/Chip-Optik, schwache Affordanz und kaum Touch-Fläche · Pro Quest ein eigenes Inline-Formular mit Select + 'Speichern'-Button für die Priorität — macht die Liste laut und repetitiv · Keine Trefferanzahl bei aktiver Suche/Filterung
- **Quickwin:** Statusfilter als echte Chip-/Tab-Leiste stylen und die Prioritätswahl auf einen Auto-Submit-Toggle (Stern-Button) ohne separaten Speichern-Button reduzieren.

#### `/auth/worlds/[worldSlug]/sessions` — **7/10** _(Design: legacy)_

Kommende Spieltermine mit Verfügbarkeits-Abstimmung (Ja/Vielleicht/Nein) plus Archiv veröffentlichter Session-Recaps mit Jahresfilter. (`apps/portal/app/auth/worlds/[worldSlug]/sessions/page.tsx`)

- **Stärken:** Sinnvolle Zweiteilung 'Kommende Sessions' vs. 'Session-Recaps' mit clientseitigem Jahresfilter · Voting mit aria-pressed und Hervorhebung der eigenen Stimme, plus aggregierte Zu-/Absagen-Zählung · Empty-Texte differenzieren zwischen 'keine Recaps' und 'keine Recaps im gewählten Jahr'
- **Schwächen:** Aktive Stimme nur per Fettdruck/Unterstrich markiert und Button-Reihe per Inline-Style layoutet — der gewählte Zustand ist visuell zu schwach · Verfügbarkeits-Summary ist eine schwer scanbare Fließtext-Wurst ('Zusagen: 2 · … — Name: Ja, Name: Vielleicht') · Kommende Sessions sind nicht verlinkt, Recaps schon — inkonsistentes Klickverhalten in derselben Listenoptik
- **Quickwin:** Die drei Vote-Buttons als Segmented Control mit klar gefülltem Aktiv-Zustand umsetzen und die Stimmen als Badge-Liste statt Fließtext rendern.

#### `/auth/worlds/[worldSlug]/sessions/[sessionId]` — **7/10** _(Design: legacy)_

Session-Detailseite mit Spieler-Recap, neu freigeschalteten Inhalten, verknüpften Seiten und Kommentar-/Notiz-Panel. (`apps/portal/app/auth/worlds/[worldSlug]/sessions/[sessionId]/page.tsx`)

- **Stärken:** Gute Detail-Navigation: Back-Link plus Vorherige/Nächste-Session-Links mit aria-label · Recap-Feed klar in Sinnabschnitte gegliedert ('Was zuletzt geschah', 'Offene Fragen', 'Neu freigeschaltet') · Notizen-Panel mit vollständigem Status-Lebenszyklus (Entwurf bearbeiten, an GM senden, Review-Hinweise)
- **Schwächen:** Interne Navigation über rohe <a>-Tags statt next/link — erzwingt volle Seiten-Reloads · Prev/Next-Links nur generisch beschriftet, ohne Session-Nummer oder Titel als Orientierung · Recap-Texte als unformatierter Text-Block (portal-recap-text) — keine Absatz-/Markdown-Darstellung längerer Recaps
- **Quickwin:** Prev/Next auf next/link umstellen und mit 'Session N: Titel' beschriften, damit Spieler wissen, wohin sie springen.

#### `/auth/worlds/[worldSlug]/soundboard` — **7/10** _(Design: gemischt)_

Spieler spielen freigegebene Ambient-/Musik-Sounds lokal im Browser ab (Tag-Filter, Lautstärke), Spotify-Buttons nur als Anzeige. (`apps/portal/app/auth/worlds/[worldSlug]/soundboard/page.tsx`)

- **Stärken:** Erwartungsmanagement: kontextabhängige Hinweise erscheinen nur, wenn lokale bzw. Spotify-Sounds existieren · Kompakte Bestands-Summary ('12 Sounds … 8 lokal · 3 YouTube · 1 Spotify') vor dem Workspace · Mächtige geteilte Workspace-Komponente mit Tag-Filter und Live-Kontrolle aktiver Sounds
- **Schwächen:** Bis zu vier Hinweis-Absätze vor dem eigentlichen Inhalt — die Sound-Buttons rutschen unter den Fold · Der 'Zukunft — gemeinsame Audio-Synchronisation'-Absatz ist Roadmap-Prosa, die in der Nutzer-UI dauerhaft Platz frisst · Technisches Rollen-Internum im Lead ('für deine Rolle (player)')
- **Quickwin:** Die Hinweise in ein einklappbares Info-Element (details/summary oder Info-Icon) bündeln, damit das Soundboard sofort sichtbar ist.

#### `/auth/account/security` — **7/10** _(Design: gemischt)_

Sicherheitsseite zum Einrichten/Deaktivieren der Zwei-Faktor-Authentifizierung und Einsehen aktiver Sitzungen. (`apps/portal/app/auth/account/security/page.tsx`)

- **Stärken:** Vollständiger 2FA-Flow mit QR-Code, Bestätigungscode, Deaktivierung per Code sowie Loading-/Busy-States und Alerts · Sitzungsliste mit 'Aktuell'-Badge, IP und Zeitstempeln plus Hinweis, dass Passwortänderung andere Sitzungen beendet · Gegenseitige Verlinkung Passwort ↔ 2FA hält den Account-Bereich zusammen
- **Schwächen:** Stilbruch auf einer Seite: oben Tailwind-Card, unten Legacy portal-content-card mit auth-lead — zwei sichtbar verschiedene Kartendesigns übereinander · Aktive Sitzungen sind reine Anzeige — keine 'Sitzung beenden'-Aktion pro Gerät, obwohl das der Hauptnutzen so einer Liste ist · fetch-Aufrufe im 2FA-Formular ohne try/catch — Netzwerkfehler enden in unbehandelter Rejection und hängendem busy-State
- **Quickwin:** Pro fremder Sitzung einen 'Abmelden'-Button (Remote-Logout) ergänzen — und die Sitzungs-Sektion dabei gleich auf die Tailwind-Card umziehen.

#### `/auth/worlds/[worldSlug]/timeline` — **8/10** _(Design: gemischt)_

Chronologische, spoilerarme Kampagnen-Timeline mit Jahresgruppen, In-Game-Datum und 'Jetzt in der Kampagne'-Marker. (`apps/portal/app/auth/worlds/[worldSlug]/timeline/page.tsx`)

- **Stärken:** Schlanke Page: Datenaufbereitung sauber in lib ausgelagert, Darstellung in eigener Komponente · Semantisch stark: Jahres-Sektionen mit aria-label, <ol> für Ereignisse, <time> mit dateTime, verlinkte Bezugsseiten pro Ereignis · 'Jetzt'-Box mit Fortschrittsangabe ('X von Y Ereignissen liegen davor') gibt sofort Orientierung
- **Schwächen:** Keine Sprungnavigation (Jahr-Anker) — lange Kampagnen werden zu einer einzigen Scroll-Strecke · Der 'Jetzt'-Marker steht nur oben statt an der chronologisch passenden Stelle im Zeitstrang
- **Quickwin:** Den 'Jetzt in der Kampagne'-Marker als Einschub an der richtigen Position in der Timeline rendern (zusätzlich zur Kopf-Box).

#### `/auth/worlds/[worldSlug]/wiki` — **8/10** _(Design: gemischt)_

Übersicht aller für die Rolle sichtbaren Wiki-Seiten, nach festen Kategorien (Lore, Orte, NPCs, …) gruppiert und durchsuchbar. (`apps/portal/app/auth/worlds/[worldSlug]/wiki/page.tsx`)

- **Stärken:** Feste, kuratierte Kategorien-Reihenfolge statt zufälliger Gruppierung; leere Kategorien werden ausgeblendet · Einträge mit Typ-/Sichtbarkeits-Badges und optionaler Zusammenfassung — gut scanbar · Empty State unterscheidet 'Suche ohne Treffer' von 'nichts freigegeben' und die Suche behält den Query-Wert
- **Schwächen:** Keine Trefferanzahl und keine Hervorhebung des Suchbegriffs bei aktiver Suche · Keine Kategorie-Sprungleiste — bei großen Wikis muss man durch alle Sektionen scrollen · Rollen-Internum im Lead ('für deine Rolle (player)') statt spielergerechter Formulierung
- **Quickwin:** Anker-Chips der vorhandenen Kategorien (mit Anzahl) über den Sektionen einblenden, um lange Wikis navigierbar zu machen.

#### `/auth/account/password` — **8/10** _(Design: v2)_

Passwort ändern bzw. Erstpasswort setzen, mit Stärkeanzeige und Sonderbehandlung für erzwungene Passwortänderung. (`apps/portal/app/auth/account/password/page.tsx`)

- **Stärken:** Konsequent im neuen Tailwind-Kit (PageHeader, Card max-w-md, Label/Input/Button/Alert) — modernste Seite der Gruppe · Durchdachte Formular-UX: autoComplete-Attribute, minLength, PasswordStrengthMeter, Loading-State am Button, Erfolgs-/Fehler-Alerts · Sonderfälle sauber abgebildet: initialPasswordOnly blendet das Altpasswort-Feld aus und passt Texte und Reset-Link an
- **Schwächen:** fetch ohne try/catch: bei Netzwerkfehler bleibt loading=true — Button hängt dauerhaft auf 'Speichern…' · Passwort-Mismatch wird erst beim Submit gemeldet statt inline am Bestätigungsfeld
- **Quickwin:** Den fetch-Aufruf in try/catch/finally packen, damit Netzwerkfehler eine Fehlermeldung zeigen und der Button nicht in 'Speichern…' festhängt.

---

_Erstellt automatisiert (statische Analyse, kein Live-Rendering). Ratings sind relative Priorisierungshilfe, kein Pixel-Audit._
