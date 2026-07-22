# O07 — Plan-Review, Repo-Delta und Mehrfach-Zuordnungen

Stand: 2026-07-22. Dieses Dokument füllt den bisher freien `07`-Slot der
Foundation-Welle. Es hält drei Dinge fest: (1) den Umsetzungsstand des
Masterplans gegenüber `main`, (2) das Repo-Delta seit dem Inventar-Snapshot
vom 2026-07-15 samt Zuordnung der neuen Bausteine, (3) die bisher nur implizit
beantwortete Frage, **was an mehrere Stellen gehört** — also welche Entitäten
eine primäre Hoheit plus definierte Zweitflächen (Projektion, Port, Adapter)
haben. Zusätzlich korrigiert es Querverweis-Fehler zwischen den
Foundation-Dokumenten und ergänzt vier real verifizierte Lücken.

## 1. Umsetzungsstand gegenüber `main`

Die Foundation-Welle (PR #776) ist seit 2026-07-15 in `main` gemerged — sie ist
aber rein dokumentarisch. Von den Wellen 2–5 ist **nichts** implementiert
(verifiziert am Stand `main`@`25a3c01`, 2026-07-22):

- Kein `packages/product-contracts`; `AppAudience`/`DataDomain`/`PrivacyClass`
  existieren nirgends im Produktionscode.
- Kein `apps/brain`; Brain-Flächen liegen unverändert im Studio-Baum.
- F-1 (`playerPreviewAllowDmOnly`-Bypass, `permissions.ts:109-117`), F-2
  (fehlende Brain-Präfixe in `PROTECTED_ROUTE_PREFIXES`, Laufzeitschutz nur
  über `unknownApi`-deny-by-default) und F-3 (Namenskollision
  `CLOUD_ALLOWED_CONTEXT_MODES` in `@uwe/ai-brain` vs. `@uwe/database`) sind
  unverändert vorhanden.
- Die im README als „Bekannte Lücke" geführten vier Scratch-Vergleichsdateien
  (`*.check`/`*.origcheck`) sind nicht im Repo gelandet — diese Lücke ist
  erledigt.

## 2. Repo-Delta seit dem Inventar-Snapshot (2026-07-15)

Seit dem Snapshot sind die PRs #777–#782 gemerged. Betroffen sind vor allem
Atlas 3D, ein neuer PDF-Kampagnen-Importer und das UWE Command Center. Die
Inventar-Kennzahlen verschieben sich:

| Metrik | Inventar (O00) | Ist (2026-07-22) | Delta |
|---|---:|---:|---|
| Routen gesamt | 409 | 411 | +2 (Atlas-3D-Seiten in Studio und Portal) |
| Studio-Seiten | 148 | 149 | +1 |
| Portal-Seiten | 33 | 34 | +1 |
| Studio-/Portal-APIs | 204 / 24 | 204 / 24 | unverändert (Atlas 3D nutzt Server Actions) |
| Packages | 34 | 36 | +2 (`atlas-editor`, `pdf-campaign-import`) |
| Prisma-Modelle | 141 | 142 | −5 Alt-Atlas, +6 `Atlas3D*` |

### 2.1 Zuordnung der neuen Bausteine

| Baustein | Zuordnung | Begründung | Konfidenz |
|---|---|---|---|
| `packages/atlas-editor` | SharedEngine | Inheritance-Resolver, Undo/Redo-Command-Stack, Carve-Ops — reine Engine ohne privaten Datenzugriff. | hoch |
| `packages/pdf-campaign-import` | Studio | PDF-Kampagnen-Import ist D&D-Content-Aufnahme mit Review, analog `knoteforge-import`. | hoch |
| `packages/atlas-3d` | SharedEngine (bestätigt) | Bleibt Rendering-/Projektions-Engine; die Persistenz liegt in `@uwe/database` (atlas3d-Service via Subpath-Export). | hoch |
| `apps/studio/app/worlds/[worldSlug]/atlas3d/**` (2 Seiten) | Studio | D&D-Weltkarten-Authoring. Die alte `/atlas`-Seite ist nur noch ein Redirect-Stub auf `/atlas3d`. | hoch |
| `apps/portal/app/auth/worlds/[worldSlug]/atlas3d/**` (2 Seiten) | Portal | Read-only 3D-Viewer; liest ausschließlich Atlas-3D-Daten, die per Owner-Entscheidung vollständig spielersichtbar sind. | hoch |
| UWE Command Center (PR #779/#780) | Platform | Host-Betriebs-/Diagnose-Client, keine Produkt-Fachdaten. | hoch |

### 2.2 Prisma-Modell-Delta

Entfernt (Phase 5a/5b der Atlas-3D-Wellen): `AtlasMap`, `AtlasNode`,
`AtlasFeature`, `AtlasObject`, `AtlasPaletteItem`.

Neu (alle `@@map("atlas3d_*")`): `Atlas3DWorld`, `Atlas3DNode`,
`Atlas3DTerrain`, `Atlas3DFeature`, `Atlas3DObject`, `Atlas3DCameraBookmark`.

Zuordnung: alle sechs `dnd_world`, Ziel-DB `uwe.db`. **PrivacyClass-Sonderfall:**
Per Owner-Entscheidung (2026-07-21, dokumentiert im Schema-Kommentar) ist
Atlas-3D-Inhalt vollständig spielersichtbar; die Modelle besitzen bewusst
keine Visibility-Spalten. Sie erhalten daher `player_visible` statt des
konservativen `dm_only`-Defaults — die Invariante „`dm_only` erreicht nie das
Portal" gilt hier trivial, weil nichts `dm_only` existiert. Das Mapping in
`02-domain-contracts.md` §5/§5.1 wurde entsprechend aktualisiert. Sollte
Atlas 3D später DM-Notizen o. Ä. erhalten, ist zuerst eine Visibility-Spalte
plus Projektor einzuführen; ein stilles Abweichen von der Owner-Entscheidung
ist unzulässig.

Genau dieser Fall bestätigt das in O02 §10 benannte **Mapping-Drift-Risiko**:
Zwischen Foundation-Merge und Contract-Umsetzung (Welle 2) muss jede
Schema-Änderung das Mapping in O02 mitziehen. Ab Welle 2 erzwingt das der
DMMF-Contract-Test; bis dahin gilt: PRs mit `schema.prisma`-Änderungen
aktualisieren O02 §5 im selben PR.

## 3. Korrigierte Querverweise und Nummerierung

Bei der Prüfung der Foundation-Dokumente gegeneinander wurden folgende
Konsistenzfehler gefunden und — soweit möglich — direkt korrigiert:

| ID | Befund | Auflösung |
|---|---|---|
| K-1 | README und O04 §3.5 schrieben O03 Inhalte zu, die dort nicht stehen (Job-Envelopes, DMMF-Contract-Tests, †G1-Feld-Allowlist). Diese Bausteine sind in **O02 §9** spezifiziert und gehören zur **Welle 2 (Contracts)**, nicht zum statischen Guard-Plan. | README-Dokumentliste korrigiert; O04-Verzahnung als „O02/Welle 2" zu lesen. |
| K-2 | O03 delegiert fachliche Extraktion (Ports, `@uwe/product-contracts`, Barrel-Auflösung) an „O05" — das reale `05-ci-brain-prep.md` ist aber CI-Vorbereitung. Gemeint sind **Welle 2 (Contracts)** und **Welle 4 (Extraktion)** des Masterplans. | Hinweisblock in O03 ergänzt; „O05" dort als Welle-2/4-Platzhalter zu lesen. |
| K-3 | Vier parallele „Welle"-Nummerierungen: Masterplan global 0–5, O03-intern 1–6, O04-Testprioritäten W1–W6, O05-Schritte 1–7. | Kanonisch sind ausschließlich die **Masterplan-Wellen 0–5**. Lokale Stufen werden ab jetzt mit Präfix referenziert: `O03-S1..S6` (Guard-Implementierungsstufen), `O04-P1..P6` (Testprioritäten), `O05-C1..C7` (CI-Schritte). Ohne Präfix bezeichnet „Welle n" immer den Masterplan. |
| K-4 | `/api/research/*`: O03 §5.2 nennt es „gemischte Naht, noch nicht pauschal Brain", O04 führt es unter den geschützten Brain-Präfixen. | Verbindlich gilt O03: gemischte Naht mit getrennten D&D-/Brain-Adaptern (Streitgruppe G6). Bis zur Adapter-Trennung wird `/api/research` wie Brain behandelt (härtere Grenze gewinnt). |
| K-5 | Keine kanonische Brain-Präfixliste: O03 §5.2 und O04 S2 führen abweichende Routen-/API-Mengen (z. B. fehlende `/api/finance|contracts|hardware|household`-Pendants, `/api/miniatures` nur in O04). | Die Route-Audience-Tabelle in **O03 §5.2** ist die einzige kanonische Quelle. O04-Tests müssen ihre Präfixe daraus ableiten, nicht eigene Listen pflegen. Bei Aufnahme in `@uwe/product-contracts` (Welle 2) wird die Liste dort Single Source of Truth. |
| K-6 | O06 F-2 als „offen an O07" markiert, README-Auflösungstabelle sagt „behoben in O04". | README/O04 sind aktueller; O06 bleibt als Read-only-Review-Snapshot unverändert stehen. |

## 4. Mehrfach-Zuordnungen: primäre Hoheit plus Zweitflächen

Das Inventar erzwingt bewusst genau **eine** primäre Zielkategorie pro
Eintrag. Viele Bausteine haben aber legitime Zweitflächen in anderen
Produkten. Damit das nicht implizit bleibt (und bei der Extraktion niemand
„aus Versehen" einen Direktzugriff baut), gilt: **Eine Zweitfläche ist nie
Datenzugriff, sondern immer genau einer dieser drei Mechanismen:**

- **Projektion (FP):** serverseitig gefilterte Read-Kopie, einseitig.
- **Port (SP):** schmaler, validierter Use-Case-Contract mit expliziten
  Reads/Writes.
- **Opaque Handle (OO):** Lifecycle-Metadaten ohne Inhaltszugriff (Platform).

| Bereich | Primäre Hoheit | Zweitfläche(n) | Mechanismus |
|---|---|---|---|
| Wiki/Seiten/Blöcke (`Page`, `ContentBlock`) | Studio | Portal, Static Export | Projektion (publish/visibility/secret-gefiltert) |
| Atlas 3D (`Atlas3D*`) | Studio (Authoring) | Portal (Read-only-Viewer) | Projektion; per Owner-Entscheidung vollflächig `player_visible` |
| Charaktere/Schatz (G1: `Character`, `CharacterSpell`, `PartyTreasury`, `InventoryItem`) | Portal (Spieler-Owner) | Studio (DM-Review/Override) | Port je Aktion/Feld-Allowlist (O02 §9); kein generischer Tabellenzugriff |
| Spielerfragen (`PlayerQuestion`) | Portal | Studio (Antwort-Workflow) | Port (beantworten/ablehnen), kein Vollzugriff |
| Kampagnen-Mail (G2) | Brain (Mail-Engine, Konten, Inbox) | Studio (Kampagnen-Versand) | Port „Kampagnenmail" ohne Inbox-/Kontozugriff; Adressen bleiben Brain |
| Kalender (G3: `CalendarFeed`, `CalendarEvent`) | Brain | Studio (Session-/Welttermine), Portal (Sessiontermine) | Projektion aus `GameSession`/`WorldEvent` heraus — nicht umgekehrt; Feed-Credentials nur Brain |
| Image Studio (G4) | Studio | Brain (private Medien) | Getrennter Brain-Media-Port + eigene Dateipfade; Brain-Zieltypen in `ImageStudioLink` werden ungültig |
| Import (G5: `ImportJob`) | Platform (Lifecycle-Hülle) | Studio (D&D-Preview), Brain (`personal_brain`-Preview) | Opaque Handle in der Hülle; Previews produktlokal |
| Research (G6) | Brain (`life_brain` bestimmt die Grenze) | Studio (D&D-Research) | Eigener Studio-Contract + Store; `contextMode` wählt nie die Cloud-Policy |
| Tags (G7: `Tag`, `EntityTag`) | Platform (Registry) | Studio-, Brain-Namespaces | Produkt-Namespaces; Counts/Existenz kreuzen die Grenze nicht |
| Lokale Modelle (G8: Cookbook/`InferenceEndpoint`) | Platform (Endpoint-Metadaten) | Brain (Nutzung/Empfehlung) | Brain erhält Capability-Handle, keine Platform-Konfigurationsrechte |
| Uploads/Dateien (G9) | je Produkt-Root | Backup (Platform) | Getrennte Resolver (O02 §4); Backup sieht Handles/Manifeste, keine Klartext-Marker |
| Aktivität (G10: `ActivityLog`) | Studio (Content-Verlauf) | Platform (`AuditLog`), Brain (eigenes Minimal-Audit) | Drei getrennte Modelle, kein Cross-Product-Feed |
| Suche (`/search`, `searchStudioCrossDomain`) | pro Produkt eigener Index | ggf. owner-only föderierte Ansicht | Föderation nur auf Ergebnis-API-Ebene (owner-only), nie gemeinsamer Index/Store |
| Soundboard/Spotify | Studio (Steuerung, Credentials) | Portal (Anzeige erlaubter Buttons) | Projektion; Portal löst nie Playback aus |
| Scans (`ScanDocument`) | Brain (Default `private`) | Studio (nach D&D-Klassifikation) | Explizite Übergabe nach Review — Kopie/Umzug, kein geteilter Store |
| Capture (`CaptureEntry`) | Brain | Studio (Weltverknüpfung) | Übergabe-Port; die Verknüpfung ist ein Handle, kein Studio-Read auf Capture |
| Settings (`SystemSettings`) | Platform (Store) | Brain/Studio (fachliche Werte, z. B. Briefing/Mail-Sync) | Nach DB-Trennung wandern Brain-Settings nach `uwe-brain.db`; Platform behält nur Instanz-/Betriebswerte |
| Schedule-Sync (`*-schedule-sync.ts` → `schedule.json`) | Platform (Muster/Timer) | Brain (Briefing/Mail-Werte), Studio (Backup-Toggle-UI) | Writer gehört zur App, die das Setting fachlich besitzt — siehe Lücke L-1 |
| Route Policy (`classifyRoute`, `PROTECTED_ROUTE_PREFIXES`) | Platform (`@uwe/auth`) | alle drei Apps | Gemeinsame Engine; Audience-Metadaten kommen ab Welle 2 aus `@uwe/product-contracts` |
| Navigation (`@uwe/shared-utils/navigation`) | SharedEngine (Typen) | drei Produkt-Navs | Jede App komponiert ihre eigene Nav aus geteilten Typen |
| Backup (`@uwe/backup`) | Platform | Brain (separates Brain-Backup ab Welle 5) | Getrennte Archive/Retention/Restore-Freigabe — siehe Lücke L-2 |

Regel für alle künftigen Fälle: Wer eine Zweitfläche braucht, benennt Hoheit +
Mechanismus in dieser Tabelle, bevor Code entsteht. Ein Eintrag ohne
Mechanismus ist keine genehmigte Zweitfläche.

## 5. Neue verifizierte Lücken (in den Wellenplan aufgenommen)

Diese vier Punkte fehlen in O03/O04/O05 und sind gegen den realen Code
verifiziert. Sie werden dem Masterplan als Risiken/Auflagen zugeordnet:

### L-1 — Self-Service-Config und Timer nach dem Split (Welle 2 planen, Welle 4 umsetzen)

Das etablierte Muster (DB-Setting → Sync-Wrapper in
`apps/studio/src/lib/*-schedule-sync.ts` → host-lesbare `schedule.json` →
statischer systemd-Timer ruft Studio-API mit `STUDIO_API_TOKEN`) wird vom
Split zerschnitten: `/api/internal/briefing` und `/api/internal/mail-sync`
sollen `audience: "brain"` werden, Brain läuft aber im Ziel loopback-only auf
:3002 und wird von systemd nicht automatisch gestartet. Offen und vor Welle 4
zu entscheiden: Wer besitzt die Sync-Writer für Brain-Settings, gegen welchen
Origin feuern die Timer (Loopback :3002 vom selben Host ist mit ADR 004
vereinbar), und wie wandern die Settings selbst nach `uwe-brain.db`. O05 §7
Frage 8 wird damit von einer Deploy-Frage zu einem eigenen Contract-Punkt.

### L-2 — Full-Backup sammelt heute Brain-Daten (Übergangsguard in Welle 3)

`packages/backup/src/collect.ts` (`collectDailyAdminData`) nimmt beim
`full`-Backup bereits heute `PersonalBrain*`- und `admin_life`-Tabellen in
dieselbe `uwe.db`-Sicherung auf. O04 deckt das nur als `it.todo` (X3) für die
Zeit **nach** der physischen Trennung ab. Ergänzend nötig, schon vor Welle 5:
ein Übergangstest, dass keine Backup-**Projektion** (Welt-Backup, Export,
Restore-Teilmengen) Brain-Zeilen enthält, und ein Konzept, wie
`restore.ts`/`cli-restore.ts` die separate Owner-Freigabe für Brain-Restore
(ADR 003) technisch erzwingen.

### L-3 — `@uwe/agent-jobs` ist eine ungeprüfte Cloud-Naht (Test in O04-P-Umfang aufnehmen)

`dispatchCursorCloudJob` POSTet `input.prompt` an eine Cloud-API. Die
Privacy-Negativtests erfassen `@uwe/agent-jobs` bisher gar nicht. Erforderlich:
ein Negativtest, dass Agent-Job-Prompts nie Kampagnen-, `dm_only`- oder
Brain-Kontext enthalten (die Presets verbieten es textlich — es fehlt der
Test), plus ab Welle 2 ein Envelope-Feld, das Agent-Jobs hart auf
`platform_ops`-Inhalte begrenzt. Abzugrenzen sind dabei die drei realen
Job-Systeme: `@uwe/agent-jobs` (Dev-Prompts, cloud-dispatchend),
`Job`-Queue inkl. `deferredAiPrompt` (lokal, teils `personal_brain`) und
`ConnectorJob` (lokaler Worker-Transport).

### L-4 — RTX-Connector-Audience ist widersprüchlich (ADR-Nachtrag vor Welle 2)

Der Connector ist als Platform klassifiziert („sieht nur opaque Handles"),
führt aber lokale Inferenz für `personal_brain` aus und sieht dabei
zwangsläufig Klartext-Prompts. Aufzulösen per ADR-Nachtrag (Vorschlag:
ADR 008 „Connector-Ausführungsgrenze"): Der Connector bleibt Platform als
**Transport**, erhält aber für `personal_brain`-Jobs eine explizite Rolle als
*lokaler Ausführer im Owner-Trust-Rahmen* — zulässig nur, weil er auf
Owner-Hardware outbound-only läuft, nichts persistiert und keine
Cloud-Weiterleitung besitzt. Diese Bedingungen werden testbare Auflagen
(keine Persistenz von Prompt-Inhalten in `job-history.json`/Logs, keine
Remote-Provider im `personal_brain`-Pfad).

## 6. Konsequenzen für die nächsten Schritte

1. **Vor Welle 2:** ADR-Nachtrag zu L-4; O02-Mapping gilt in der hier
   aktualisierten Fassung (142 Modelle) als Referenz für den DMMF-Test.
2. **In Welle 2:** L-1-Contract (Settings-/Timer-Ownership), L-3-Envelope,
   F-3-Umbenennung, kanonische Brain-Präfixliste in `@uwe/product-contracts`.
3. **In Welle 3:** L-2-Übergangstests zusammen mit den O04-P1/P2-Tests;
   F-1-Bypass vorher schließen.
4. **Laufend bis Welle 2:** Schema-PRs aktualisieren O02 §5 im selben PR
   (Drift-Regel aus Abschnitt 2.2).
