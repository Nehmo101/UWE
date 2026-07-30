# UWE Command Center

Das **UWE Command Center** ist die zentrale Desktop-Anlaufstation für ein
All-in-one-Setup: UWE Studio, UWE Portal, Datenhaltung und lokale Rechenleistung
laufen auf demselben PC und werden aus einer Oberfläche bedient.

Die früheren Produktnamen „UWE RTX Connector Client“ (App) und „RTX Host
Connector“ (Worker) heißen heute **UWE Command Center** und **Maschinenraum**.
In internen Paket-, Release- und Datenpfaden bleiben die alten Bezeichner
bewusst stehen — dadurch bleiben bestehende Konfigurationen, Tokens, Modelle und
Updater-Installationen kompatibel. Details: [rtx-connector.md](./rtx-connector.md).

## Verantwortungsgrenzen

| Baustein | Verantwortung |
|---|---|
| Command-Center-UI | Ersteinrichtung, Status, Start/Stopp, Neustart, Backup, Logs und Maschinenraum-Konfiguration |
| Desktop-Host-Steuerung | Ein idempotenter lokaler Orchestrator für Studio und Portal |
| UWE Studio | Source of Truth, Admin, Daten und Connector-Tokens |
| UWE Portal | Spieleransicht; weiterhin strikt player-safe |
| Maschinenraum | Outbound-only Worker für Ollama, Audio, Bilder und lokale Geräte |

Es wird bewusst **kein zweiter lokaler Webserver** für das Command Center
gestartet. Die Tauri-App ruft dieselbe kleine Host-Steuerung auf, die auch ohne
UI diagnostiziert werden kann. Das reduziert Ports, Prozesse und Fehlerquellen.

## All-in-one-Ablauf

```text
UWE Command Center
  ├─ Ersteinrichtung       → Bereiche wählen, alles in einem Durchgang installieren
  ├─ Einrichten/Reparieren → pnpm, Prisma, Migration, optional Seed, Release-Build
  ├─ Starten/Stoppen       → gewählte Apps auf den in .env festgelegten Ports
  ├─ Überwachen            → Healthchecks, Prozesse, CPU/RAM/Disk/GPU, Logs
  ├─ Sichern               → SQLite-Backup in AppData
  └─ Maschinenraum         → ausgehender Worker zum lokalen Studio
```

Das Command Center führt absichtlich **kein stilles** `git pull` aus. Updates
laufen nur über den expliziten Button **Nach Updates suchen** /
**Update installieren** (oder die CLI-Aktionen `check-update` / `update`).
Maßgeblich ist in beiden Fällen der GitHub-Release-Tag `uwe-vX.Y.Z`:

- **Monorepo-Checkout:** der Checkout wird auf den neuesten `uwe-v*`-Tag
  synchronisiert und Studio/Portal neu gebaut. Lokale Arbeitsbaum-Änderungen
  werden vorher per `git stash` gesichert — nie still überschrieben.
- **Bundle-Installation** (ausgelieferter Zustand, kein git): das Manifest
  `uwe-release.json` des Releases am Tag sagt, welche App-Bundles zur Version
  gehören; nachgeladen wird nur, was eine andere SHA-256 hat, und vor der
  Migration werden die Datenbanken kopiert.

Liegt die Desktop-App selbst hinter dem Tag, wird zusätzlich ihr
Windows-Installer geöffnet. „Reparieren / neu bauen“ baut weiterhin den
aktuellen Stand ohne Remote-Sync.

## Lokale Pfade (Windows)

| Inhalt | Pfad |
|---|---|
| Checkout | frei wählbar, z. B. `C:\git\UWE` |
| Kompatibler AppData-Stamm | `%LOCALAPPDATA%\UWE\rtx-connector-client` |
| Host-Daten | `...\host\data` |
| Backups | `...\host\data\backups` |
| Logs | `...\host\logs` |
| PID-Dateien | `...\host\runtime` |

Bei der ersten Einrichtung wird nur dann eine sichere lokale `.env` erzeugt,
wenn noch keine vorhanden ist. Bestehende Konfigurationen werden nicht
überschrieben. Fehlende lokale Pflichtwerte werden ergänzt. Neue Secrets sind
zufällig, Cookies bleiben bei lokalem HTTP funktionsfähig und die Ports lassen
sich über `STUDIO_PORT`/`PORTAL_PORT` ändern (Standard 3000/3001). So kann
eine installierte Instanz konfliktfrei neben einem Dev-Server laufen.

## Ersteinrichtungs-Assistent (1-Klick-Installation)

Beim allerersten Start springt der Assistent von selbst auf und fragt, **was auf
diesem Rechner laufen soll**. Aus der Antwort wird eine vollständige lokale
Installation — ohne einen einzigen Host-Befehl von Hand.

```text
Schritt 1  Bereiche wählen   → Studio · Portal · Brain · Family · Startseite
                               (Vorlagen: Komplett / Nur D&D / Nur privat / Haushalt)
                               + Demo-Grundbestand ja/nein
Schritt 2  Owner-Konto       → Name, E-Mail, Passwort (optional, später nachholbar)
Schritt 3  Jetzt installieren → ein Klick, Fortschritt live
Schritt 4  Fertig            → Links auf die installierten Bereiche
```

Was „Jetzt installieren“ in einem Durchgang erledigt:

1. Auswahl festschreiben (`install-selection.json` neben den Host-Daten).
2. Abhängigkeiten installieren, Prisma-Clients generieren.
3. **Nur die gebrauchten Datenbanken** migrieren: `uwe.db` immer (Konten und
   Einstellungen), `uwe-brain.db` nur mit Brain, `uwe-family.db` nur mit Family.
4. Optional den Demo-Grundbestand einspielen — nur bei frischer Datenbank,
   bestehende Daten werden nie überschrieben.
5. Den lokalen Maschinenraum idempotent registrieren.
6. Produktions-Builds **nur der gewählten Apps** erzeugen.
7. Owner-Konto anlegen (mit den Häkchen der gewählten Bereiche) und auf Wunsch
   direkt starten.

Die Auswahl ist danach die verbindliche Wahrheit für „gehört dazu": Statuskarten,
`Alles starten` und der Fortschrittsbalken beim Update zeigen nur die
installierten Bereiche. Ohne Brain wartet UWE also nicht auf einen Brain-Build,
der nie kommt.

**Nachträglich ändern:** Command Center → **Bereiche ändern**. Der Assistent
läuft dann erneut; die zusätzlichen Datenbanken und Builds werden nachgezogen.
Abgewählte Bereiche werden nur nicht mehr gestartet — ihre Daten bleiben liegen.

**Bestandsinstallationen** bleiben unberührt: Fehlt die Auswahl-Datei, gilt „alle
Apps“ und der Assistent springt nicht auf. Ein „Später“ merkt sich der Client in
`installWizardCompleted`.

CLI-Äquivalent (ohne Oberfläche prüfbar):

```bash
node tools/uwe-host-command-center/src/desktop-host-cli.ts get-install-selection --root /pfad/zu/UWE
echo '{"apps":["studio","portal"],"seedDemoContent":false}' \
  | node tools/uwe-host-command-center/src/desktop-host-cli.ts set-install-selection --root /pfad/zu/UWE
node tools/uwe-host-command-center/src/desktop-host-cli.ts setup --root /pfad/zu/UWE
```

## Bedienung

1. UWE-Projektordner wählen und Einstellungen speichern.
2. **UWE einrichten** ausführen. Das installiert Abhängigkeiten, migriert die
   Datenbank, registriert idempotent einen lokalen Connector und erzeugt die
   Produktions-Builds. Eine vorherige Remote-Konfiguration wird einmalig gesichert.
3. **Alles starten** startet die gewählten Apps und den bereits provisionierten
   Maschinenraum.
4. Unter **Maschinenraum** Ollama, Modelle und optionale lokale
   Executor konfigurieren.
5. Optional unter **Lokales Hosting** den Haken **KI-Jobs direkt zustellen
   (Hybrid-Transport)** setzen: KI-Anfragen gehen dann ohne Warteschlangen-Umweg
   über die lokale Verbindung an den Connector, die Queue bleibt als Fallback.
   Empfohlen im All-in-one-Setup (UWE und Maschinenraum auf demselben Rechner);
   greift beim nächsten Start des Maschinenraums. Der Haken entspricht dem Transport-Feld
   unter „Verbindung“ (`hybrid`/`queue`; eine dort gewählte reine
   Direktverbindung bleibt erhalten).

### Lebensdauer der Dienste

Das Command Center ist der Schalter für die öffentliche Erreichbarkeit: läuft es
nicht, läuft nichts. Beenden — über den Bestätigungsdialog des X-Knopfes oder
**Beenden** im Tray-Menü — stoppt Studio, Portal, Brain, Familie und Startseite
und trennt den Cloudflare-Tunnel. Danach ist `uweanddragons.org` offline.

- **Weiterlaufen lassen** heißt minimieren, nicht schließen: bei `trayMode`
  `minimize_to_tray` verschwindet das Fenster in den Tray, die Dienste bleiben.
- Mit **Dienste und Tunnel beim Beenden stoppen** (`stopServicesOnExit`, unter
  *Lokales Hosting*) lässt sich das abschalten. Standard ist **an**, auch für
  Konfigurationsdateien von vor der Einstellung — sonst bliebe die öffentliche
  Seite nach dem Beenden erreichbar, ohne dass jemand sie noch steuert.
- Zusammen mit **automatisch starten** für Apps und Tunnel gilt die Regel in
  beide Richtungen: Command Center offen = Seite erreichbar.
- Abstürze und `taskkill` decken kein Aufräumcode ab. Dafür hängen alle
  Kindprozesse in einem Windows Job Object mit `KILL_ON_JOB_CLOSE`: verschwindet
  der App-Prozess auf beliebige Weise, nimmt Windows Dienste und Tunnel mit.
  Ausnahme ist **Im Browser öffnen** — dieser Teilbaum bricht per
  `CREATE_BREAKAWAY_FROM_JOB` aus dem Job aus, damit das Beenden des Command
  Centers nicht den geöffneten Browser mit abschießt.

Entwicklungs- und Build-Befehle:

```powershell
pnpm command-center:dev
pnpm command-center:build
pnpm --filter @uwe/rtx-connector-client typecheck
```

Die Host-Steuerung kann separat geprüft werden (Node 22.18+ bzw. Node 24):

```powershell
node tools/uwe-host-command-center/src/desktop-host-cli.ts status --root C:\git\UWE
node tools/uwe-host-command-center/src/desktop-host-cli.ts setup --root C:\git\UWE
node tools/uwe-host-command-center/src/desktop-host-cli.ts start --root C:\git\UWE
node tools/uwe-host-command-center/src/desktop-host-cli.ts backup --root C:\git\UWE
node tools/uwe-host-command-center/src/desktop-host-cli.ts stop --root C:\git\UWE
node tools/uwe-host-command-center/src/desktop-host-cli.ts check-update --root C:\git\UWE
node tools/uwe-host-command-center/src/desktop-host-cli.ts update --root C:\git\UWE
```

Windows-Releases baut GitHub Actions
(`.github/workflows/uwe-windows-release.yml`): der Lauf erzeugt den Tag
`uwe-vX.Y.Z`, Installer, App-Bundles, leere Datenbanken und `uwe-release.json`.
Ein bereits vorhandener `uwe-v*`-Tag löst denselben Build per Push aus.
Details: [docs/engineering/rtx-connector-release.md](./engineering/rtx-connector-release.md).

## Sicherheit

- Studio, Portal und Ollama werden nicht automatisch ins Internet exponiert.
- Der Maschinenraum bleibt outbound-only; auf dem RTX-PC wird kein API-Port
  geöffnet.
- Secrets werden weder in Statusantworten noch in Logs ausgegeben.
- UWE-Daten und Modelle bleiben außerhalb des Git-Checkouts erhalten.
- Vor öffentlicher Freigabe sind TLS/Reverse Proxy und eine separate
  Zugriffskontrolle für Studio erforderlich.

## Weiterhin unterstütztes Split-Modell

Ein Linux-Host mit systemd und ein separater RTX-PC bleiben vollständig
unterstützt. Im Split-Modell ist der Linux-Host die Source of Truth und das
Command Center verwaltet auf dem RTX-PC primär den ausgehenden Connector. So
bleibt die bestehende Always-on-Topologie verfügbar, ohne den All-in-one-Pfad
mit Linux-spezifischer Komplexität zu belasten.

## Bewusste Strukturentscheidungen

1. **Ein Orchestrator statt zweier Dashboards:** weniger Prozesse und keine
   konkurrierenden Zustände.
2. **Health plus Prozessbesitz:** „Online“ bedeutet erfolgreicher
   `/api/health` eines vom Command Center gestarteten Prozesses; fremde
   Portbelegungen und fehlerhafte Healthchecks werden getrennt gemeldet.
3. **Daten außerhalb des Repos:** Updates und Builds berühren keine Nutzdaten.
4. **Kompatible technische IDs:** keine erzwungene Token-/Modellmigration.
5. **Explizite Updates:** nur der Update-Button/CLI rollt Releases aus; lokale
   Änderungen werden per Stash gesichert, nie still überschrieben.
6. **Checkout statt Runtime-Duplikat:** Produktionsprozesse nutzen den
   installierten Workspace gezielt; große doppelte Standalone-Bäume entfallen.
7. **Linux bleibt optional:** All-in-one und Split-Hosting teilen Kern und
   Sicherheitsregeln, aber nicht unnötig denselben Betriebsmechanismus.
