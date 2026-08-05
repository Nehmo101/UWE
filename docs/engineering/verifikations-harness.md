# Verifikations-Harness

Wie eine Änderung an UWE nachweisbar wird — und zwar so, dass die Person, die
den Nachweis führt, keine fremden Zugangsdaten braucht und die laufende
Installation nicht gefährdet.

> Anlass: Am 2026-08-05 wurden Bestandskampagnen auf das Kampagnen-Cockpit
> umgestellt und die Magic-Item-Werkbank gefüllt. Die Datenschicht ließ sich
> vollständig belegen, die **Oberfläche nicht** — die einzige laufende
> Installation ist die Produktion, und in die kommt man nur mit dem Passwort des
> Besitzers. Der Nachweis blieb an zwei Screenshots hängen, die der Besitzer von
> Hand geschickt hat. Dieses Dokument beschreibt, was stattdessen gebaut wird.

---

## 1. Der Grundsatz

**Verifiziert wird gegen ein Wegwerf-System, nie gegen die Produktion.**

Das ist keine Vorsichtsmaßnahme, sondern eine Voraussetzung: Ein Wegwerf-System
darf eigene Zugangsdaten haben, darf beliebig hässliche Testdaten enthalten und
darf kaputtgehen. Die Produktion darf nichts davon. Wer in der Produktion prüft,
prüft entweder gar nicht oder mit dem Passwort eines Menschen — beides ist
falsch.

Drei Regeln folgen daraus, und die dritte ist die, die am 2026-08-05 fast
schiefgegangen wäre:

1. **Eigene Zugangsdaten.** Der Harness legt seinen Besitzer selbst an
   (`packages/database/src/auth-seed.ts`, `dm@uwe.local` / `uwe-dev`, ohne 2FA).
   Nie das Konto eines Menschen benutzen, nie nach einem Passwort fragen.
2. **Eigene Daten.** Eine frische SQLite-Datei je Lauf, im Temp-Verzeichnis,
   danach gelöscht (`scripts/e2e-servers.mjs`).
3. **Eigener Arbeitsbaum und eigene Ports.** Der Harness baut die Apps neu und
   schreibt dabei in `apps/*/.next`. **Genau aus diesem Verzeichnis bedient der
   laufende Live-Dienst** (`tools/uwe-host-command-center/src/desktop-host.ts`
   startet `apps/<id>/.next/standalone/apps/<id>/server.js`). Ein
   Verifikationslauf im selben Arbeitsbaum reißt die öffentliche Seite herunter.
   Deshalb: immer eigener `git worktree`, immer der E2E-Portbereich 3199–3202
   (die Live-Dienste liegen auf 3100–3104).

---

## 2. Vier Stufen, von billig nach teuer

Die Stufe wird nach der Frage gewählt, die beantwortet werden muss — nicht nach
Gewohnheit. Eine teurere Stufe ersetzt keine billigere: Sie beantwortet eine
andere Frage.

| Stufe | Beantwortet | Kosten | Werkzeug |
|---|---|---|---|
| **S1 Logik** | Rechnet die Funktion richtig? | Sekunden | `node --test`, reine Funktionen |
| **S2 Dienstschicht** | Kommen aus der echten Abfrage die erwarteten Daten? | Sekunden | `createTestDatabaseUrl()` + echter Service |
| **S3 Oberfläche** | Sieht ein Mensch, was er sehen soll? | Minuten | Playwright im Wegwerf-Stack, Screenshots |
| **S4 Datenumbau** | Tut das Skript auf den **echten** Daten das Richtige? | Minuten | Probelauf gegen eine Kopie der Live-DB |

**S1 und S2 sind heute belastbar.** Am 2026-08-05 haben sie den falsch erkannten
Fluch, das Fahrzeug aus „Schiffsnamen" und die unvollständige Markup-Entfernung
gefunden — zwei davon, bevor der Code das erste Mal lief.

**S3 und S4 fehlen als benutzbare Werkzeuge.** Beides existiert in Teilen, aber
nicht in einer Form, die man für eine konkrete Frage in Minuten einsetzen kann.

---

## 3. Was heute schon da ist

Der Bestand ist besser als sein Ruf; es fehlt weniger, als es zunächst aussieht.

- **Selbststartender Stack:** `scripts/e2e-servers.mjs` legt drei frische DBs an,
  migriert, seedet (`prisma/seed.ts` → `seedTerraWorld`, `seedAuthUsers`), baut
  die gewählten Apps und startet sie auf 3199–3202. Steuerbar über `E2E_APPS`,
  `E2E_NO_SEED`, `E2E_*_PORT`.
- **Anmeldung ohne Menschen:** `e2e/helpers/auth.ts` — `loginStudioForShellTests`
  meldet sich über `POST /api/auth/login` an und setzt nur das Cookie
  (`uwe_session`). Die Seed-Nutzer haben bewusst keine 2FA.
- **Screenshots:** `e2e/helpers/qa-matrix.ts` schreibt bereits PNGs nach
  `qa-artifacts/` — aber nur im Theme-Sweep über eine **feste** Routenliste
  (12 Presets × 6 Routen), opt-in über `QA_MATRIX=1`.
- **Spielersicht:** `e2e/portal-auth.spec.ts` prüft Spielerflows, und
  `PLAYER_PREVIEW_PUBLIC=true` ist im Harness gesetzt.
- **Wegwerf-DB für Dienste:** `packages/database/src/test-helpers.ts`
  (`createTestDatabaseUrl`, Brain- und Family-Varianten).

Die Lücke ist damit klar benannt: Es gibt **keinen Weg, für eine konkrete Frage
gezielt Routen anzusteuern und die Bilder zu bekommen**, und es gibt **keinen
Probelauf für Datenumbauten**.

---

## 4. Was gebaut wird

### B1 — `pnpm verify:ui` (Stufe 3)

Ein Lauf, der Routen als Argument nimmt statt sie fest zu verdrahten:

```bash
pnpm verify:ui --routen "/worlds/terra/kampagnen,/worlds/terra/kampagnen/himmelsrouten" \
               --als dm --ausgabe <verzeichnis>
```

Er startet den Stack (nur die nötigen Apps), meldet sich an, ruft jede Route auf,
wartet auf Ruhe im Netzwerk, schießt einen Vollbild-Screenshot und schreibt
daneben eine `manifest.json` mit Route, Datei, HTTP-Status und den sichtbaren
Überschriften. Das Manifest ist der Teil, der die Bilder maschinell auswertbar
macht: Ein leerer Zustand („Noch keine Kampagne") ist im Bild sofort erkennbar,
im Manifest aber auch ohne Hinsehen.

`--als dm|spieler` wählt das Konto. Die Spielersicht ist kein Zusatz, sondern der
halbe Zweck: „Für Spieler hat sich nichts geändert" ist eine Behauptung, die man
zeigen können muss.

**Warum das reicht:** Screenshots kann ich selbst ansehen — PNG-Dateien lassen
sich direkt lesen. Damit wird aus „die Tests sind grün" ein „so sieht es aus".

### B2 — Fixture-Import als Seed (Stufe 3, Voraussetzung)

Der Terra-Demo-Seed enthält fünf Wiki-Seiten und keine Kampagnenstruktur. Auf so
einer Welt sieht ein Kampagnen-Cockpit auch dann leer aus, wenn es funktioniert.

Deshalb bekommt der Harness einen zweiten, fachlichen Seed: **ein kleines
Kampagnenbuch als Markdown-Fixture, das durch den echten Dokument-Import
läuft** (`buildDocImportPlan` + `writeDocImport`). Das Fixture enthält bewusst
alles, was Struktur ausmacht: zwei Kapitel mit Szenen, eine Nebenquest, einen
Gegenstand mit `:::dm`-Bereich, ein Bestiarium.

Das ist der Baustein mit dem besten Verhältnis von Aufwand zu Wirkung, denn er
prüft zwei Dinge gleichzeitig: Der Import erzeugt die richtige Struktur, **und**
die Oberfläche zeigt sie. Der `story_arc`-Fehler, der am 2026-08-05 vierzehn
Seiten Handarbeit verursacht hat, wäre hier ohne jede zusätzliche Behauptung
aufgefallen — das Cockpit wäre leer geblieben.

### B3 — `pnpm verify:migration` (Stufe 4)

Für jedes Skript, das Bestandsdaten anfasst:

```bash
pnpm verify:migration --skript <pfad> --quelle <live.db>
```

1. Kopiert die Live-DB samt `-wal`/`-shm` in ein Temp-Verzeichnis (die Kopie ohne
   WAL ist im WAL-Modus inkonsistent — siehe `docs/engineering/`-Notizen zum
   Backup).
2. Nimmt einen Vorher-Fingerabdruck: Zeilenzahlen je Tabelle und ein Hash je
   Datensatz über die Felder, die das Skript anfassen darf.
3. Führt das Skript **gegen die Kopie** aus.
4. Schreibt einen Diff-Bericht: welcher Datensatz, welches Feld, alt → neu — und
   vor allem eine Liste der Felder, die sich geändert haben, **obwohl sie nicht
   auf der Erlaubnisliste standen**.

Punkt 4 ist der eigentliche Gewinn. Am 2026-08-05 lautete die Zusage „Slugs,
Inhalte, `portalReleased` und `dm_only`-Inhalte werden niemals angefasst". Belegt
wurde sie durch einen selbstgeschriebenen Trockenlauf — also durch dasselbe
Denken, das auch das Skript geschrieben hat. Ein unabhängiger Feld-Diff ist ein
Beleg, keine Wiederholung derselben Annahme.

### B4 — Leitplanken als Code

- `verify:*` weigert sich zu starten, wenn das Arbeitsverzeichnis der Baum ist,
  aus dem laufende Dienste bedient werden (Prüfung: laufender Prozess mit
  `cwd` unter `<repo>/apps/*/.next/standalone`).
- `verify:migration` weigert sich, wenn `--quelle` und Ziel dieselbe Datei sind.
- Beide schreiben ausschließlich unter das mit `--ausgabe` genannte Verzeichnis.

---

## 5. Wann welche Stufe — die Entscheidungsregel

Die Kurzform für den Alltag:

- **Neue reine Funktion?** S1. Immer, ohne Nachdenken.
- **Neue Abfrage, neuer Service, neues Feld?** S2. Gegen den echten Service,
  nicht gegen ein Mock — sonst prüft man seine eigene Vorstellung der Abfrage.
- **Behauptung über etwas Sichtbares** („das Cockpit zeigt die Kapitel", „im
  Druck steht kein DM-Text", „für Spieler ändert sich nichts")? **S3. Ohne
  Ausnahme.** Genau hier ist am 2026-08-05 die Lücke aufgegangen, und genau hier
  hilft ein grüner Test am wenigsten: Der Rail-Fall aus der Vergangenheit hatte
  grüne Tests und eine kaputte Oberfläche.
- **Skript fasst Bestandsdaten an?** S4, vor dem Lauf auf den echten Daten.
  Zusätzlich Dateikopie der DB als Rückfallebene.

Und die Regel, die alles zusammenhält: **Wenn eine Behauptung im Abschlussbericht
steht, muss dahinter eine Stufe stehen, die sie trägt.** Steht keine dahinter,
gehört in den Bericht, dass sie ungeprüft ist — so wie es am 2026-08-05 für die
Oberfläche geschehen ist.

---

## 6. Umsetzung in Schnitten

| Schnitt | Inhalt | Aufwand | Nutzen |
|---|---|---|---|
| 1 | B1 `verify:ui` mit `--routen`, DM-Konto, Manifest | klein | schließt die Hauptlücke |
| 2 | B2 Fixture-Import als Seed | mittel | macht die Bilder überhaupt aussagekräftig |
| 3 | B1 Erweiterung `--als spieler` + Portal-Gegenprobe | klein | belegt Spieler-Zusagen |
| 4 | B3 `verify:migration` mit Feld-Diff | mittel | unabhängiger Beleg statt Selbstbestätigung |
| 5 | B4 Leitplanken | klein | verhindert den Live-Unfall |

Schnitt 1 und 5 gehören zusammen — ein Werkzeug, das die laufende Installation
beschädigen kann, wird nicht ohne seine Sicherung ausgeliefert.

---

## 7. Woran man merkt, dass es wirkt

Der Harness ist gelungen, wenn diese drei Sätze in einem Bericht mit einem
Artefakt belegbar sind statt mit einer Beteuerung:

1. „Das Kampagnen-Cockpit zeigt die Kapitel in Lesereihenfolge mit Status." →
   Screenshot aus B1 auf einer Welt aus B2.
2. „In der Spieler-Druckversion steht kein `:::dm`-Inhalt." → Screenshot der
   Spieler-Variante, erzeugt mit `--als spieler`.
3. „Der Umbau hat Slugs, Inhalte und Portal-Freigaben nicht angefasst." →
   Feld-Diff aus B3, in dem die Erlaubnisliste eingehalten wurde.

Und eine vierte, negative Probe: Wer die `story_arc`-Erkennung aus dem Import
wieder entfernt, muss danach ein **leeres Cockpit** im Screenshot sehen. Ein
Harness, der einen absichtlich eingebauten Fehler nicht sichtbar macht, prüft
nichts.
