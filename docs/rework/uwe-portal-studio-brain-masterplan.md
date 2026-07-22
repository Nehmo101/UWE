# UWE Portal/Studio/Brain Masterplan

Stand: 2026-07-15

Dieses Dokument ist der kanonische Umsetzungsplan für den Drei-Produkte-Split.
Es übersetzt das
[Repo-Inventar](three-product-split/00-inventory.md) in verbindliche
Architekturentscheidungen und gestufte Implementierungswellen. Das Inventar ist
ein Read-only-Snapshot des Ist-Zustands; dieser Masterplan beschreibt das
Zielbild und die Reihenfolge.

## Quellen und Geltungsbereich

- [SECURITY.md](../../SECURITY.md) bleibt die operative Source of Truth für
  Security, insbesondere für die W0-Atlas-KI-Policy.
- Die sechs ADRs dieses Packs fixieren die Architekturentscheidungen.
- [CURRENT_STATE.md](../CURRENT_STATE.md) beschreibt weiterhin die aktive
  Runtime. Zielzustände in diesem Plan sind nicht automatisch implementiert.
- Bei Abweichungen älterer Architektur- oder Privacy-Texte gelten in dieser
  Reihenfolge Security-Policy, ADRs, dieser Masterplan und das Inventar.
- [07-delta-und-mehrfachzuordnung.md](three-product-split/07-delta-und-mehrfachzuordnung.md)
  (Stand 2026-07-22) ergänzt das Repo-Delta seit dem Inventar-Snapshot
  (Atlas 3D, neue Packages), die kanonische Wellen-Nummerierung, die
  Mehrfach-Zuordnungs-Matrix (primäre Hoheit + Projektion/Port/Handle) und
  vier zusätzliche verifizierte Lücken (L-1 bis L-4).

Die aktuelle Welle ist ausschließlich Foundation und Dokumentation. Sie ändert
keinen Produktionscode, kein Schema, keine Daten, Cookies, Routes, systemd-Units
oder Netzwerk-Exposition.

## Zielbild

| Schicht | Verantwortung | Harte Grenze |
|---|---|---|
| **Portal** | Player-facing D&D, read-mostly, serverseitig gefilterte Projektionen und eng begrenzte Spieleraktionen | Kein `dm_only`, kein generischer Studio-Schreibzugriff, kein Brain-Zugriff |
| **Studio** | DM-/D&D-Authoring, World-Brain, Review, Apply und Veröffentlichung | Keine persönlichen Brain-Daten oder Daily-Admin-Verantwortung |
| **Brain** | Owner-private persönliche Daten, Daily Admin OS und lokale persönliche KI | Owner-only, local/LAN, keine Cloud-KI für private Inhalte |
| **Platform** | Auth, Security, Konfiguration, Persistenz-Infrastruktur, Jobs, Connector, Deployment und CI | Orchestrierung begründet keinen generischen privaten Datenzugriff |
| **Shared Engines** | Datenquellenneutrale Logik, UI-Primitives und schmale Contracts | Keine App-Imports, keine produktübergreifenden privaten Repositories |

Details: [ADR 002](../adr/002-product-boundaries.md).

## Nicht verhandelbare Invarianten

1. `dm_only` erreicht niemals Portal, statischen Export oder einen
   ungeschützten Cloud-Pfad. Vor zulässigem D&D-Cloud-Routing wird es immer
   serverseitig entfernt.
2. `personal_brain` ist hart local-only, owner-only und nicht konfigurierbar.
3. Private Brain-Inhalte werden niemals an Cloud-KI übertragen.
4. Brain ist owner-only und standardmäßig lokal; LAN braucht eine explizite
   Owner-Aktivierung, öffentliche Erreichbarkeit ist kein Standardpfad.
5. Apps importieren niemals aus anderen Apps. Gemeinsame Engines sind erlaubt,
   gemeinsame private Datenzugriffe sind verboten.
6. KI übernimmt Inhalte nie automatisch. Review und explizites Apply sind vor
   jeder autoritativen Änderung erforderlich; Publish bleibt separat.
7. Daten werden nicht gelöscht und nicht irreversibel migriert, solange dafür
   keine separate Owner-Freigabe vorliegt.

## Architekturentscheidungen

| ADR | Kernentscheidung |
|---|---|
| [ADR 002](../adr/002-product-boundaries.md) | Portal, Studio und Brain erhalten eindeutige Fachgrenzen; Platform und Shared Engines unterstützen ohne private Querzugriffe. |
| [ADR 003](../adr/003-data-layers.md) | Private Daten erhalten im Ziel eine eigene `uwe-brain.db`, eigene Storage-Pfade und eigene Backups; diese Welle migriert nichts. |
| [ADR 004](../adr/004-brain-owner-only.md) | Brain ist owner-only, standardmäßig Loopback und nur nach expliziter Freigabe im LAN erreichbar. |
| [ADR 005](../adr/005-session-audiences.md) | Portal, Studio und Brain erhalten getrennte Session-Audiences; die aktuelle Cookie-Laufzeit bleibt vorerst unverändert. |
| [ADR 006](../adr/006-ai-privacy-policy.md) | Personal Brain bleibt hart lokal; D&D folgt der Gateway-Policy mit `dm_only`-Filter und verpflichtendem Review/Apply. |
| [ADR 007](../adr/007-deployment-exposure.md) | Portal und Studio dürfen optional getunnelt werden, Brain nie automatisch; systemd bleibt in dieser Welle unverändert. |

## Wellenplan

### Welle 0 — Inventar

Status: abgeschlossen und nach Integration verfügbar unter
[`docs/rework/three-product-split/00-inventory.md`](three-product-split/00-inventory.md).

Ergebnis: vollständige Zuordnung von Apps, Routen, Packages, Datenmodellen,
Storage, Jobs, Timern und Split-Hotspots ohne Migration.

### Welle 1 — Foundation und Dokumentation

Status: dieses Decision Pack.

Lieferumfang:

- sechs akzeptierte ADRs;
- dieser kanonische Masterplan;
- Angleichung der D&D-/Brain-Privacy-Dokumentation an `SECURITY.md`;
- keine Runtime-, Cookie-, Daten-, Deployment- oder Codeänderung.

Abnahme: Dokumentprüfung, Whitespace-Hygiene, erlaubter Dateiscope und klare
Kennzeichnung von Ziel- gegenüber Ist-Zustand.

### Welle 2 — Produkt- und Infrastruktur-Contracts

Zuerst werden Contracts implementiert, noch bevor Routen verschoben werden:

- Produktkennzeichnung und schmale Ports für Auth-Audience, AI-Kontext, Jobs,
  Storage, Backups und Suche;
- Portal Read Models und eine Allowlist eng begrenzter Spieleraktionen;
- getrennte Studio-/Brain-Payloadschemas für gemischte Jobs, Research,
  Kalender, Mail, Import und Image Studio;
- Brain-eigene Repository-Interfaces ohne generischen Zugriff aus Studio oder
  Platform;
- Shared Engines ohne App-Dateizugriff oder private Store-Credentials.

Abnahme: Contract-Tests beweisen deny-by-default bei unbekannten Produkten und
verhindern Personal-Brain-Payloads in Portal-, Studio- und Cloud-Verträgen.

### Welle 3 — Guards und beweisbare Grenzen

- serverseitige Session-Audience- und Rollen-Guards je App;
- CI-Regel gegen Cross-App-Imports und gegen Package-zu-App-Abhängigkeiten;
- Leak-Tests für Portal, Share, Suche, Graph, Assets und Static Export;
- AI-Tests für den harten `personal_brain`-Block, `dm_only`-Entfernung vor
  Cloud-Routing und Review/Apply;
- Storage-, Job- und Backup-Guards gegen produktfremde private Zugriffe;
- Deployment-Smoke, der Brain aus öffentlichen Standardpfaden ausschließt.

Cookie-Namen, Audience-Repräsentation und Login-Übergänge werden in dieser
Welle anhand von [ADR 005](../adr/005-session-audiences.md) konkretisiert und
separat freigegeben.

### Welle 4 — `apps/brain` und fachliche Extraktion

Erst nach den Contracts und Guards entsteht `apps/brain`:

- eigene owner-only Shell, Navigation, Routes und APIs;
- Extraktion persönlicher Studio-Flächen und fachlicher Runner;
- Loopback als Default, explizit aktivierbarer LAN-Modus;
- keine automatische Aufnahme in Cloudflare Tunnel oder öffentliche Proxies;
- Studio bleibt ausschließlich D&D-/DM-/World-Brain-/Review-/Publish-Produkt.

Die bestehende systemd-Topologie wird nur in einer ausdrücklich freigegebenen
Deployment-Änderung angepasst.

### Welle 5 — Physische Datenmigration

Diese Welle beginnt ausschließlich nach separater Owner-Freigabe. Sie umfasst:

- Festlegung der kanonischen Pfade und Berechtigungen für `uwe-brain.db`,
  Brain-Storage und Brain-Backups;
- klassifizierte Migration aller Brain-Modelle und Dateien;
- vollständige Sicherung, Restore-Test, Dry Run, Integritätsvergleich und
  dokumentierten Rollback;
- kontrollierten Cutover ohne vorschnelle Löschung der bisherigen Quelle;
- separate Abnahme, bevor alte Tabellen oder Pfade überhaupt zur Löschung
  vorgeschlagen werden.

Keine irreversible Migration und keine Datenlöschung ist durch diesen
Masterplan vorab autorisiert.

## Übergangsregeln

- Physische Ist-Strukturen dürfen vorübergehend gemischt bleiben; fachliche
  Neuentwicklung richtet sich bereits nach den Zielgrenzen.
- Eine Route im heutigen Studio-Baum darf als Brain klassifiziert sein, ist aber
  bis zur Extraktion weiterhin Teil der dokumentierten aktuellen Runtime.
- Platform-Komponenten dürfen Infrastruktur koordinieren, nicht aber private
  Inhalte durchsuchen oder in generische Payloads aufnehmen.
- Portal erhält Daten nur einseitig über gefilterte Projektionen. Ein Rückkanal
  existiert ausschließlich für explizite Spieleraktions-Contracts.
- D&D- und Personal-Brain-Indexer, Chunks, Jobs und Suchergebnisse bleiben
  logisch getrennt, auch solange sie physisch denselben Host nutzen.

## Integrationsreihenfolge

1. Inventar-Dokument aus dem Vorgänger-Commit integrieren.
2. Dieses Decision Pack integrieren, damit alle Folgewellen dieselben Grenzen
   referenzieren.
3. Contract-Welle planen und pro Hotspot eine fachliche Zielverantwortung
   bestätigen.
4. Guards vor Route- oder Datenverschiebungen aktivieren.
5. Brain-App extrahieren.
6. Datenmigration nur nach dem separaten Owner-Gate beginnen.

## Risiken und offene Entscheidungen

- Spieler-Schreibhoheit für Character, Spells, Party Treasury und Inventory ist
  je Feld noch zu definieren.
- Gemischte Suche, Tags, Activity Feed, Kalender, Research, Mail, Import und
  Image Studio brauchen Produktadapter ohne Metadatenleaks.
- Job-Runner laufen heute im Studio-Prozess; Zielprozess und
  Produkt-Credentials sind noch festzulegen.
- Der aktive Backup-Pfad `/var/backups/uwe` und ältere Dokumentation zu
  `/var/lib/uwe/backups` müssen vor der Datenmigration kanonisiert werden.
- Audience-UX, Cookie-Namen, zentraler Logout und Session-Widerruf sind Teil der
  späteren Auth-Contract-Entscheidung.
- `apps/brain`-Port, systemd-Zuschnitt und Healthcheck-Vertrag werden nicht in
  der Foundation-Welle vorweggenommen.
- D&D-Cloud-Nutzung bleibt eine bewusste administrative Policy-Entscheidung;
  Fehlklassifikation oder unvollständiges `dm_only`-Filtering ist ein
  kritisches Testrisiko.
- Self-Service-Config/Timer (L-1): Die systemd-Timer für Briefing und
  Mail-Sync feuern heute gegen den Studio-Origin; nach dem Split müssen
  Setting-Ownership, `schedule.json`-Writer und Trigger-Origin für das
  loopback-only Brain vor Welle 4 vertraglich geklärt sein.
- Backup-Vermischung (L-2): Das heutige Full-Backup sammelt `PersonalBrain*`-
  und `admin_life`-Daten in die gemeinsame Sicherung; Übergangstests und die
  technische Erzwingung der separaten Brain-Restore-Freigabe sind vor Welle 5
  fällig.
- Agent-Jobs-Cloud-Naht (L-3): `@uwe/agent-jobs` dispatcht Prompts an eine
  Cloud-API und ist von den Privacy-Negativtests bisher nicht erfasst;
  Negativtest und Envelope-Begrenzung auf `platform_ops`-Inhalte ergänzen.
- Connector-Ausführungsgrenze (L-4): Der RTX-Connector führt lokale
  `personal_brain`-Inferenz aus und sieht dabei Klartext-Prompts — Widerspruch
  zur „Platform sieht nur opaque Handles"-Regel; per ADR-Nachtrag vor Welle 2
  auflösen.
  Details zu allen vier Punkten:
  [07-delta-und-mehrfachzuordnung.md](three-product-split/07-delta-und-mehrfachzuordnung.md) §5.

## Definition of Done für den Gesamtsplit

Der Split ist erst abgeschlossen, wenn die drei Apps getrennte Audiences und
Guards besitzen, keine Cross-App-Imports existieren, Portal ausschließlich
player-safe Projektionen konsumiert, Brain owner-only und nicht öffentlich ist,
private Brain-Daten physisch samt Storage und Backups getrennt sind und ein
verifizierter Rollback für die Migration dokumentiert wurde.
