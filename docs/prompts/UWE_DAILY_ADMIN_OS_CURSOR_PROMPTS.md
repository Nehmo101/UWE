# UWE Daily Admin OS — Cursor Prompts

Diese Datei enthält copy-paste-fertige Prompts für Cursor/Fable/Codex-artige Agenten.

Ziel: UWE soll für Lasse nicht nur ein DnD-Tool sein, sondern ein tägliches privates Admin-Cockpit für DnD, Projekte, Technik/Homelab, Kunstwerke/Miniaturen/Terrain, Verträge/Monatsausgaben und persönliches Wissen.

Wichtige Produktentscheidung: UWE wird **kein** Familien-/Haushalts-/Meal-/Katzen-Tool.

Nicht bauen:
- Kein Familien-/Kind-Modul
- Kein Katzen-Modul
- Kein Meal Planner
- Kein Haushalts-/Vorratsplaner
- Kein großer Dokumenten-Tresor
- Kein Entscheidungs-Log
- Kein Wochenreview-Modus
- Kein großes Käufe/Garantien/Retouren-Modul

Empfohlene Reihenfolge:

```txt
0 Security zuerst
1 Data Foundations danach
2 + 3 + 4 + 5 teilweise parallel möglich
6 erst nach 1, teilweise parallel zu 2/3/4/5
7 erst nach 1/6, DnD/KI Integration
8 ganz am Ende als QA/Integration
```

---

## Copy-Paste: Orchestrator Prompt

```text
Du bist der Orchestrator für den nächsten UWE-Entwicklungsstrang: „UWE Daily Admin OS“.

Du arbeitest im Repository UWE auf dem aktuellen main-Stand.

Deine Rolle:
- Du bist NICHT der Agent, der blind alles selbst in einem riesigen Umbau implementiert.
- Du koordinierst die unten definierten Subagents.
- Du prüfst Abhängigkeiten, Reihenfolge, Scope, Risiken, Tests und Integrationspunkte.
- Du darfst kleine verbindende Änderungen selbst machen, aber große Pakete sollen den Subagents gehören.
- Du hältst die Architektur konsistent und verhinderst Feature-Wildwuchs.

Ziel:
UWE soll für Lasse nicht nur ein DnD-Tool sein, sondern ein tägliches privates Admin-Cockpit für DnD, Projekte, Technik/Homelab, Kunstwerke/Miniaturen/Terrain, Verträge/Monatsausgaben und persönliches Wissen.

Produktentscheidung:
UWE wird kein Familien-/Haushalts-/Meal-/Katzen-Tool.

Nicht bauen:
- Kein Familien-/Kind-Modul
- Kein Katzen-Modul
- Kein Meal Planner
- Kein Haushalts-/Vorratsplaner
- Kein großer Dokumenten-Tresor
- Kein Entscheidungs-Log
- Kein Wochenreview-Modus
- Kein großes Käufe/Garantien/Retouren-Modul

Zielstruktur:

UWE Admin
- Heute / Daily Cockpit
- Capture Inbox
- DnD / Welten
- Projekte
- Werkstatt / Kunstwerke / Miniaturen / Terrain
- Verträge & Monatsausgaben
- Hardware / Homelab
- Persönliches Brain
- Systemstatus

Subagents, die du koordinierst:

Subagent 0 — Studio Security Step 1
- Macht Studio/Admin-Sicherheit, Cloudflare/Proxy/Auth-Warnungen und RTX-public-exposure-Warnungen.
- Muss zuerst laufen.

Subagent 1 — Data Foundations für Daily Admin OS
- Macht Prisma-Modelle, Enums, Services und Grundtests für Capture, Projekte, Werkstatt, Verträge, Hardware und Personal Brain.
- Muss vor UI-Modulen laufen.

Subagent 2 — Today Dashboard + Capture Inbox + Mobile UX
- Baut /today, globale Capture Inbox, mobilen Capture-Flow und Mobile Bottom Nav.
- Hängt von Subagent 1 ab.

Subagent 3 — Projekte + Werkstatt / Kunstwerke / Miniaturen / Terrain
- Baut /projects und /workshop mit Kartenlayouts, Bildern, Materialien, Farben, Filament, STL-Links und optionaler DnD-Verknüpfung.
- Hängt von Subagent 1 ab.

Subagent 4 — Verträge & Monatsausgaben
- Baut schlanke manuelle Vertrags-/Ausgabenverwaltung ohne Bankdaten.
- Hängt von Subagent 1 ab.

Subagent 5 — Hardware / Homelab Cockpit
- Baut Hardware-/Homelab-Modul für UWE Host, RTX-Rechner, eGPU/RTX 3090, SSDs, Cloudflare, Setup-Schritte und Fehlernotizen.
- Hängt von Subagent 1 ab.

Subagent 6 — Persönliches Brain + Privacy
- Baut Life-Brain oder erweitert bestehende Brain-Struktur sauber.
- Stellt sicher: private Life-Daten gehen niemals an Cloud-KI.
- Hängt von Subagent 1 ab.

Subagent 7 — DnD/KI Integration + Multi-World + RTX Offline Jobs
- Baut Terra-Favorit ohne Hardcoding, Multi-World-Erhalt, kontextuelle KI-Aktionen und deferred RTX-offline Jobs.
- Hängt von Subagent 1 und 6 ab.

Subagent 8 — QA / Integration / Release Hardening
- Finaler Integrations-/Regression-/Mobile-/Security-/Doku-Agent.
- Muss am Ende laufen.

Arbeitsreihenfolge:
1. Starte mit Subagent 0.
2. Danach Subagent 1.
3. Danach können Subagent 2, 3, 4 und 5 getrennt laufen.
4. Danach Subagent 6.
5. Danach Subagent 7.
6. Am Ende Subagent 8.

Globale Regeln für alle Subagents:
- Bestehende DnD-, Portal-, Brain-, Mail-, Backup-, AI-Router-, Soundboard-, Jobs- und Security-Features dürfen nicht brechen.
- Keine Secrets im Frontend.
- Keine Cloud-KI mit DnD-Brain, Objektkontext oder privaten Life-Brain-Daten.
- Terra darf als bevorzugte Welt gesetzt werden, aber niemals hardcoded als einzige Welt.
- UWE muss weiterhin beliebig viele DnD-Welten verwalten.
- Capture muss ohne RTX funktionieren.
- Mobile UI muss Kartenlayouts bevorzugen, keine unbenutzbaren Tabellen.
- Bestehende Patterns im Repo nutzen.
- Pro Subagent Tests ergänzen.
- Keine riesigen ungetesteten Umbauten.

Orchestrator-Aufgaben:
- Prüfe den aktuellen main-Stand.
- Erstelle eine kurze Implementierungsplanung mit PR-/Commit-Schnitten.
- Prüfe, ob die Subagent-Aufgaben bereits teilweise implementiert sind.
- Verhindere doppelte Datenmodelle oder doppelte Services.
- Sorge dafür, dass Subagents nicht widersprüchliche Routen, Enums oder Service-Namen einführen.
- Halte eine Mapping-Tabelle: Subagent → betroffene Dateien → Tests → Status.
- Führe nach jedem Subagent die relevanten Checks aus oder dokumentiere klar, welche Checks noch offen sind.

Akzeptanzkriterien für den Gesamtstrang:
- /today funktioniert auf Desktop und Mobile.
- Capture funktioniert ohne RTX.
- Projekte, Werkstatt, Verträge und Hardware sind als eigene Admin-Bereiche nutzbar.
- System-Ampel zeigt UWE/DB/Backup/RTX/Brain/Mail/Portal sinnvoll an.
- Private Daten bleiben lokal.
- Cloud-KI bekommt nur allgemeinen Chat ohne Brain-/Objekt-/Life-Kontext.
- Bestehende DnD-Welten bleiben nutzbar.
- Terra kann bevorzugt werden, aber weitere Welten bleiben vollständig verwaltbar.
- pnpm lint, pnpm typecheck, pnpm test und pnpm build:release sind am Ende grün oder jede Abweichung ist konkret dokumentiert.
```

---

## Copy-Paste: Subagent 0 — Studio Security Step 1

```text
Du bist Subagent 0 für den UWE-Entwicklungsstrang „UWE Daily Admin OS“.

Du bist ein spezialisierter Subagent. Arbeite nur an deinem Scope und vermeide Änderungen an nicht betroffenen Modulen. Übergib offene Punkte klar an den Orchestrator.

Dein Scope:
Studio Security Step 1.

Ziel:
Studio/Admin darf nicht ungeschützt öffentlich erreichbar sein. Portal darf separat öffentlich/halböffentlich bleiben. RTX-Agent darf niemals öffentlich exponiert werden.

Nicht bauen:
- Keine neuen Life-Admin-Module.
- Keine Today-/Capture-UI.
- Keine Projekt-/Werkstatt-/Vertragsmodule.
- Keine DnD-KI-Erweiterungen außer Security-relevante Prüfungen.

Aufgaben:
- Prüfe bestehende Security-/Production-/Proxy-Checks.
- Ergänze Security-Auswertung für:
  - AUTH_REQUIRED
  - AUTH_SECRET
  - SESSION_COOKIE_SECURE
  - TRUST_PROXY
  - CLOUDFLARE_TUNNEL
  - PUBLIC_APP_URL
  - Cloudflare Access / Reverse Proxy Indikatoren, soweit serverseitig erkennbar
- Admin Status Dashboard soll klar anzeigen:
  - Studio geschützt
  - Studio unsicher
  - nur lokal
  - falsch konfiguriert
- Zeige konkrete Next Steps bei unsicherer Konfiguration.
- RTX_AGENT_URL / AI_INFERENCE_BASE_URL dürfen nicht öffentlich wirken.
- Warnung, wenn RTX-Agent auf öffentliche URL zeigt.
- Keine Secrets, Tokens oder Passwörter im Frontend ausgeben.
- Tests für Security-Auswertung ergänzen.
- Bestehende Healthchecks nicht brechen.

Repo-Regeln:
- Nutze bestehende Admin-Status-/Healthcheck-Patterns.
- Keine Secrets ausgeben, auch nicht maskiert, wenn nicht nötig.
- Konservativ warnen, wenn öffentliche Exposition unklar ist.

Akzeptanz:
- Admin Status zeigt verständliche Security-Ampel.
- Unsichere Public-Studio-Konfiguration wird deutlich gewarnt.
- RTX public exposure wird erkannt oder konservativ gewarnt.
- Tests grün für deinen Scope.

Übergabe an Orchestrator:
- Liste geänderte Dateien.
- Liste neue Tests.
- Liste bekannte Grenzen, insbesondere was serverseitig nicht sicher erkennbar ist.
```

---

## Copy-Paste: Subagent 1 — Data Foundations für Daily Admin OS

```text
Du bist Subagent 1 für den UWE-Entwicklungsstrang „UWE Daily Admin OS“.

Du bist ein spezialisierter Subagent. Arbeite nur an Datenmodell, Services und Basistests. Baue keine großen UI-Flows. Übergib offene Punkte klar an den Orchestrator und an die UI-Subagents.

Dein Scope:
Data Foundations für Capture, Projekte, Werkstatt, Verträge, Hardware und persönliches Brain.

Ziel:
Datenbasis für Today, Capture, Projekte, Werkstatt, Verträge, Hardware und privates Brain schaffen.

Nicht bauen:
- Keine vollständige /today UI.
- Keine vollständige /projects oder /workshop UI.
- Keine Security-Hardening-Arbeit außer Datenmodell-Sicherheit.
- Keine Familien-/Kind-/Katzen-/Meal-/Haushaltsmodule.

Aufgaben:
- Analysiere bestehendes Prisma Schema und Service-Patterns.
- Ergänze robuste Datenmodelle für:
  - CaptureEntry
  - PersonalProject
  - WorkshopProject
  - ContractExpense
  - HardwareDevice
  - PersonalBrainDocument / PersonalBrainFact oder saubere Erweiterung bestehender Brain-Modelle
  - Verknüpfungen zwischen Captures, Projekten, Werkstatt, Hardware, Verträgen, Brain und optional DnD-Welten/Seiten
- Status-Enums ergänzen:
  - CaptureStatus: inbox, triaged, linked, archived
  - ProjectStatus: idea, planned, active, blocked, paused, done, archived
  - WorkshopStatus: idea, planned, material_missing, in_progress, paused, done, archived
  - ContractStatus: active, cancelled, review, paused, archived
  - HardwareStatus: planned, active, offline, broken, retired, archived
- Services im bestehenden Repository-Stil bauen.
- Seeds nur minimal, keine unnötigen Demo-Daten.
- Migrationen sauber erstellen.
- Unit-/Service-Tests ergänzen.

Design-Hinweise:
- Life-Admin-Daten sind weltunabhängig, können aber optional mit DnD-Welten/Seiten verknüpft werden.
- Keine sensiblen Bankdaten modellieren.
- Keine Secrets modellieren.
- Bilder/Dateien möglichst über bestehende Asset-/Upload-Patterns verknüpfen, nicht neu erfinden.

Akzeptanz:
- Datenmodelle sind sauber migrierbar.
- Services können CRUD und Listenansichten.
- Verknüpfungen sind vorbereitet.
- Keine bestehenden DnD-Datenmodelle brechen.
- Tests grün für deinen Scope.

Übergabe an Orchestrator:
- Liste neue Modelle/Enums.
- Liste neue Services.
- Erkläre, welche Felder die UI-Subagents verwenden sollen.
- Liste offene Risiken bei Migrationen oder Naming.
```

---

## Copy-Paste: Subagent 2 — Today Dashboard + Capture Inbox + Mobile UX

```text
Du bist Subagent 2 für den UWE-Entwicklungsstrang „UWE Daily Admin OS“.

Du bist ein spezialisierter Subagent. Arbeite auf Basis der Data Foundations von Subagent 1. Baue Today, Capture und Mobile UX. Ändere keine Datenmodelle außer kleinen notwendigen Anpassungen; wenn größere Datenmodelländerungen nötig sind, dokumentiere sie für den Orchestrator.

Dein Scope:
Today Dashboard, Capture Inbox und Mobile Daily UX.

Ziel:
UWE bekommt ein echtes Daily Cockpit.

Nicht bauen:
- Keine vollständigen Projekte-/Werkstatt-/Vertrags-/Hardware-Detailmodule.
- Keine Familien-/Kind-/Katzen-/Meal-/Haushaltsmodule.
- Keine DnD-KI-Erweiterungen außer Links/Status auf /today.

Aufgaben:
- Neue Route /today bauen.
- /today zeigt:
  - bevorzugte Welt
  - nächste DnD-Session
  - offene Projekte
  - aktive Werkstatt-Projekte
  - Capture Inbox
  - offene Vertrags-/Ausgaben-Prüfungen
  - Hardware/Homelab-Probleme
  - System-Ampel: UWE, DB, Backup, RTX, Brain, Mail, Portal
- Globaler + Capture Button auf Desktop und Mobile.
- Capture-Typen:
  - schnelle Notiz
  - DnD-Idee
  - UWE-To-do
  - Projektidee
  - Hardware/Homelab
  - Vertrag/Monatsausgabe
  - Kunstwerk/Miniatur/Terrain
  - Link
  - Datei/Bild
- Capture muss ohne RTX funktionieren.
- Mobile Bottom Nav ändern zu:
  - Heute
  - Capture
  - Suche
  - KI
  - Mehr
- Keine komplexen Tabellen auf Mobile; Kartenlayout verwenden.
- Bestehende Dashboards nicht ersetzen, sondern ergänzen.
- Tests für /today, Capture und Mobile Nav ergänzen.

UX-Hinweise:
- /today ist die persönliche Startseite, kein reines Statistik-Dashboard.
- Schnell erfassen ist wichtiger als perfekte Einordnung.
- Empty States sollen konkrete nächste Aktionen anbieten.
- Auf Mobile muss Capture mit einem Tap erreichbar sein.

Akzeptanz:
- /today ist als Startseite nutzbar.
- Capture ist mit einem Tap erreichbar.
- Capture funktioniert offline von RTX.
- Mobile Darstellung ist sauber.
- Tests grün für deinen Scope.

Übergabe an Orchestrator:
- Liste geänderte Routen und Komponenten.
- Liste UI-Annahmen gegenüber Subagent 3/4/5.
- Liste offene UX-Fragen.
```

---

## Copy-Paste: Subagent 3 — Projekte + Werkstatt / Kunstwerke / Miniaturen / Terrain

```text
Du bist Subagent 3 für den UWE-Entwicklungsstrang „UWE Daily Admin OS“.

Du bist ein spezialisierter Subagent. Arbeite auf Basis der Data Foundations von Subagent 1. Dein Fokus sind Projekte und kreative Werkstatt-Projekte. Vermeide Änderungen an Security, AI Router oder DnD-Kernlogik, außer für optionale Verknüpfungen.

Dein Scope:
Projekte-Modul und Werkstatt-Modul.

Ziel:
UWE verwaltet persönliche Projekte und kreative Werkstatt-Projekte für Kunstwerke, Miniaturen, Terrain, 3D-Druck und Dioramen.

Nicht bauen:
- Kein Vertrags-/Ausgabenmodul.
- Kein Hardware-/Homelab-Modul außer Projektverknüpfungen.
- Kein Dokumenten-Tresor.
- Keine Familien-/Kind-/Katzen-/Meal-/Haushaltsmodule.

Teil A: Allgemeines Projekte-Modul
- Route /projects bauen.
- Projekt-Felder:
  - Name
  - Beschreibung
  - Status
  - Kategorie
  - nächste Aktion
  - Notizen
  - Links
  - Dateien/Bilder optional
  - Kosten optional
  - verknüpfte Captures
  - verknüpfte Brain-Einträge
- Projektkategorien:
  - UWE
  - Hardware/Homelab
  - DnD
  - Kunst/Werkstatt
  - 3D-Druck
  - Sonstiges
- Aktive Projekte und nächste Aktionen auf /today anzeigen oder Daten dafür bereitstellen.

Teil B: Werkstatt-Modul
- Route /workshop bauen.
- Ein Werkstatt-Projekt kann sein:
  - DnD-Terrain
  - Miniatur
  - 3D-Druck
  - Diorama
  - Kunstwerk
  - sonstiges kreatives Projekt
- Felder:
  - Titel
  - Typ
  - Status
  - Bildergalerie
  - Referenzbilder
  - benötigte Materialien
  - verwendete Materialien
  - verwendete Farben
  - verwendetes Filament
  - Druckdateien/STL-Links
  - Notizen
  - Kosten
  - nächste Aktion
  - Fortschrittsfotos
  - optional verknüpfte DnD-Welt, Session, Seite oder Projekt
- Ansichten:
  - Alle Werkstatt-Projekte
  - Aktive Projekte
  - Material fehlt
  - Fertige Projekte
  - DnD-verknüpfte Projekte
- Mobile Kartenlayout.
- Bilder/Uploads bestehende Asset-Patterns nutzen.

Akzeptanz:
- Projekte und Werkstatt-Projekte sind getrennt, aber verknüpfbar.
- /today kann relevante offene Projekte anzeigen.
- Bilder können zu Werkstatt-Projekten gehören.
- DnD-Verknüpfung optional, nicht verpflichtend.
- Tests grün für deinen Scope.

Übergabe an Orchestrator:
- Liste Routen, Komponenten und Services.
- Liste, wie /today offene Projekte abfragen soll.
- Liste offene Punkte zu Asset-/Bildverknüpfung.
```

---

## Copy-Paste: Subagent 4 — Verträge & Monatsausgaben

```text
Du bist Subagent 4 für den UWE-Entwicklungsstrang „UWE Daily Admin OS“.

Du bist ein spezialisierter Subagent. Arbeite auf Basis der Data Foundations von Subagent 1. Dein Fokus ist ein schlankes manuelles Vertrags-/Monatsausgaben-Modul. Keine Bank-Anbindung, keine sensiblen Zahlungsdaten.

Dein Scope:
Verträge & Monatsausgaben.

Ziel:
Schlankes manuelles Vertrags-/Monatsausgaben-Modul ohne Bankdaten.

Nicht bauen:
- Keine Bank-Anbindung.
- Keine IBAN/Kreditkarten-/Zahlungsdaten speichern.
- Kein großer Dokumenten-Tresor.
- Kein Käufe/Garantien/Retouren-Modul.
- Keine Familien-/Haushaltsmodule.

Aufgaben:
- Route /expenses oder /contracts bauen. Wähle einen konsistenten Namen und dokumentiere ihn.
- Datenmodell aus Subagent 1 nutzen.
- Felder:
  - Name
  - Anbieter
  - Kategorie
  - Betrag
  - Intervall: monatlich, jährlich, einmalig, sonstig
  - Startdatum
  - nächste Zahlung
  - Kündigungsfrist optional
  - Vertragsende optional
  - Status: aktiv, gekündigt, prüfen, pausiert, archiviert
  - Link zum Portal optional
  - Notizen
  - verknüpftes Projekt optional
- Monatskosten und Jahreskosten berechnen.
- Hinweise:
  - bald prüfen
  - bald kündigen
  - Zahlung demnächst
- /today zeigt relevante Hinweise oder erhält eine saubere Abfrage dafür.
- Tests für Kostenberechnung und Statushinweise ergänzen.

Akzeptanz:
- Manuelle Monats-/Jahresübersicht funktioniert.
- Baldige Prüfungen erscheinen auf /today oder sind per Service abrufbar.
- Keine sensiblen Zahlungsdaten vorgesehen.
- Tests grün für deinen Scope.

Übergabe an Orchestrator:
- Liste Route und Service-Funktionen.
- Dokumentiere Berechnungsregeln für monatlich/jährlich/einmalig.
- Liste offene UX-Entscheidungen.
```

---

## Copy-Paste: Subagent 5 — Hardware / Homelab Cockpit

```text
Du bist Subagent 5 für den UWE-Entwicklungsstrang „UWE Daily Admin OS“.

Du bist ein spezialisierter Subagent. Arbeite auf Basis der Data Foundations von Subagent 1. Dein Fokus ist Lasses Technik-/Selfhosting-Setup. Du sollst bestehenden Admin Status ergänzen, nicht sinnlos duplizieren.

Dein Scope:
Hardware / Homelab Cockpit.

Ziel:
UWE verwaltet Lasses Technik-/Selfhosting-Setup.

Nicht bauen:
- Kein vollständiger Monitoring-Daemon.
- Kein Secret-Store.
- Keine automatische Netzwerk-Discovery.
- Keine Familien-/Haushaltsmodule.

Aufgaben:
- Route /hardware oder /homelab bauen. Wähle einen konsistenten Namen und dokumentiere ihn.
- HardwareDevice-Modell nutzen.
- Geräte verwalten:
  - UWE Host Laptop
  - RTX-Rechner
  - eGPU/RTX 3090
  - externe SSDs
  - Cloudflare Domain/Tunnel
  - sonstige Geräte
- Felder:
  - Name
  - Rolle
  - Status
  - lokale URL/IP optional
  - öffentliche URL optional
  - Betriebssystem
  - offene Setup-Schritte
  - Fehlermeldungen
  - Notizen
  - verknüpfte Projekte
  - verknüpfte Brain-Einträge
- Integration mit bestehendem Admin Status, RTX-Status und Backup-Status, wo sinnvoll.
- /today zeigt Geräte mit Problemen/offenen Schritten oder erhält eine saubere Abfrage dafür.
- Sicherheitsregel:
  - Secrets nicht speichern
  - lokale IPs optional und nur Admin-seitig
  - öffentliche RTX-Agent-URLs warnen
- Tests ergänzen.

Akzeptanz:
- Hardware-Setup kann dokumentiert werden.
- Offene Setup-Schritte erscheinen auf /today oder sind per Service abrufbar.
- Bestehender Systemstatus wird nicht dupliziert, sondern sinnvoll ergänzt.
- Tests grün für deinen Scope.

Übergabe an Orchestrator:
- Liste Route und Komponenten.
- Liste Integrationspunkte mit Admin Status.
- Liste Warnlogik für öffentliche URLs.
```

---

## Copy-Paste: Subagent 6 — Persönliches Brain + Privacy

```text
Du bist Subagent 6 für den UWE-Entwicklungsstrang „UWE Daily Admin OS“.

Du bist ein spezialisierter Subagent. Arbeite auf Basis der Data Foundations von Subagent 1. Dein Fokus ist Personal/Life Brain und Privacy. Du musst bestehende AI-Router- und Brain-Privacy-Regeln respektieren und erweitern.

Dein Scope:
Persönliches Brain + Privacy.

Ziel:
Neben DnD-Brain entsteht ein privates Life-Brain für Projekte, Hardware, Werkstatt, Verträge und Troubleshooting.

Nicht bauen:
- Keine Cloud-KI mit privaten Daten.
- Kein großer Dokumenten-Tresor.
- Keine Familien-/Kind-/Katzen-/Meal-/Haushaltsmodule.
- Keine vollständigen UI-Module für Projekte/Werkstatt/Hardware/Verträge außer Brain-Verknüpfungen.

Aufgaben:
- Prüfe, ob bestehende BrainDocument/BrainFact-Modelle erweitert oder separate PersonalBrain-Modelle besser sind.
- Kategorien:
  - UWE/Coding
  - Hardware/Homelab
  - Verträge/Monatsausgaben
  - Kunst/Werkstatt
  - Miniaturen/Terrain
  - 3D-Druck
  - Anleitungen/Troubleshooting
  - Persönliche Notizen
- Privates Brain bleibt lokal.
- Keine Cloud-KI mit privaten Brain-Daten.
- Bestehende AI Router Privacy-Regeln analog anwenden.
- Brain-Einträge können verknüpft werden mit:
  - Captures
  - Projekten
  - Werkstatt-Projekten
  - Hardware
  - Verträgen
  - optional DnD-Welten/Seiten
- UI für Übersicht und Detailansicht bauen oder bestehende Brain-UI sauber erweitern.
- Tests:
  - Privacy
  - Verknüpfungen
  - keine Cloud-Route bei privatem Brain-Kontext
  - lokale RTX erforderlich

Akzeptanz:
- Privates Brain ist getrennt genug vom DnD-Brain, aber wiederverwendet sinnvolle bestehende Patterns.
- Cloud-KI bekommt keine privaten Brain-Daten.
- Private Brain-Einträge sind mit Life-Admin-Modulen verknüpfbar.
- Tests grün für deinen Scope.

Übergabe an Orchestrator:
- Begründe Modellentscheidung: Erweiterung vs separate PersonalBrain-Modelle.
- Liste Privacy-Regeln und Tests.
- Liste Integrationspunkte für Subagent 7.
```

---

## Copy-Paste: Subagent 7 — DnD/KI Integration + Multi-World + RTX Offline Jobs

```text
Du bist Subagent 7 für den UWE-Entwicklungsstrang „UWE Daily Admin OS“.

Du bist ein spezialisierter Subagent. Arbeite nach Subagent 1 und Subagent 6. Dein Fokus ist DnD/KI-Integration, Terra-Favorit ohne Hardcoding, Multi-World-Erhalt und sichere RTX-offline Jobs.

Dein Scope:
DnD/KI Integration + Multi-World + RTX Offline Jobs.

Ziel:
DnD bleibt stark, Terra kann Favorit sein, aber Multi-World bleibt vollständig erhalten. KI-Aktionen werden kontextuell und RTX-offline-fähig.

Nicht bauen:
- Terra niemals hardcoden.
- Keine Cloud-Fallbacks für Brain-/Objekt-/Life-Kontext.
- Keine allgemeinen Life-Admin-CRUD-Module.

Aufgaben:
- Setting für favoriteWorldId oder lastActiveWorldId bauen.
- Terra darf als bevorzugte Welt gesetzt werden, aber niemals hardcoden.
- /today zeigt bevorzugte Welt prominent.
- /worlds bleibt vollständige Multi-World-Verwaltung.
- Kontextuelle KI-Aktionen auf:
  - Seiten
  - Sessions
  - Dungeons
  - Werkstatt-Projekten mit DnD-Verknüpfung
- Aktionen:
  - Zusammenfassen
  - Spieler-Version erzeugen
  - Brain-Fakten extrahieren
  - Kanon-Konflikte prüfen
  - Für nächste Session vorbereiten
- Bestehenden AI Router und Privacy Guard nutzen.
- Brain-/Objekt-/Life-Kontext niemals an Cloud.
- Wenn RTX offline:
  - lokale Brain-/Objekt-KI-Aktion als Job vormerken
  - Status pending/deferred anzeigen
  - Ausführung erst, wenn RTX ready ist
  - kein Cloud-Fallback
- Tests:
  - Multi-World
  - Terra Favorit ohne Hardcoding
  - Privacy
  - RTX offline Job-Verhalten
  - kein Cloud-Fallback bei lokalem Kontext

Akzeptanz:
- Terra kann Default/Favorit sein.
- Weitere Welten bleiben voll nutzbar.
- KI-Aktionen sind kontextuell erreichbar.
- RTX offline blockiert nicht die Planung, sondern erzeugt sichere Jobs.
- Tests grün für deinen Scope.

Übergabe an Orchestrator:
- Liste Setting-Keys.
- Liste KI-Aktionen und Routen.
- Liste Job-Verhalten bei RTX offline.
- Liste Privacy-Tests.
```

---

## Copy-Paste: Subagent 8 — QA / Integration / Release Hardening

```text
Du bist Subagent 8 für den UWE-Entwicklungsstrang „UWE Daily Admin OS“.

Du bist der finale QA-, Integrations- und Release-Hardening-Subagent. Du arbeitest am Ende, nachdem Subagents 0 bis 7 gelaufen sind. Deine Aufgabe ist nicht, große neue Features zu bauen, sondern Integration, Regressionen, Tests, Doku und Releasefähigkeit abzusichern.

Dein Scope:
QA / Integration / Release Hardening.

Ziel:
Alle neuen Daily Admin OS Features zusammenführen und absichern.

Nicht bauen:
- Keine neuen großen Produktmodule.
- Keine neuen Datenmodelle, außer kleine Fixes für Integration.
- Keine Feature-Ausweitung außerhalb der bestehenden Roadmap.

Aufgaben:
- Gesamten Flow testen:
  - /today
  - Capture
  - Projekte
  - Werkstatt
  - Verträge
  - Hardware
  - persönliches Brain
  - DnD-Welten
  - KI-Router
  - Admin Status
  - Mobile Nav
- Regressionstest für bestehende Kernfeatures:
  - DnD-Welten
  - Portal
  - Brain
  - Mail
  - Backup/Restore
  - Soundboard soweit betroffen
  - Jobs
  - AI Runs
- Mobile Smoke:
  - /today
  - Capture
  - Projektkarten
  - Werkstattkarten
  - KI-Prompt
- Security Smoke:
  - keine Secrets im Frontend
  - Studio-Warnung bei unsicherem Public Setup
  - RTX-Agent nicht öffentlich
  - Cloud bekommt keinen lokalen Kontext
- Doku aktualisieren:
  - README Kurzüberblick
  - docs/PRODUCTION.md Security-Hinweis
  - neue docs/daily-admin-os.md
  - neue docs/life-brain-privacy.md
  - diese Prompt-Datei nur aktualisieren, wenn sich Subagent-Schnittstellen wesentlich geändert haben
- Changelog aktualisieren.
- Alle Tests, Lint, Typecheck, Build ausführen.

Akzeptanz:
- pnpm lint grün
- pnpm typecheck grün
- pnpm test grün
- pnpm build:release grün
- Neue Features dokumentiert
- Keine bekannten kritischen Regressionen

Übergabe an Orchestrator:
- Ergebnis der Checks.
- Liste behobener Integrationsprobleme.
- Liste verbleibender bekannte Einschränkungen.
- Klare Empfehlung: releasefähig ja/nein.
```
