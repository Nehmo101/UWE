# O05 — CI-Vorbereitung für `apps/brain`

Stand: 2026-07-15. Dieses Dokument ist ein umsetzungsreifer Plan für die
Implementierungswelle, in der eine dritte Next.js-App `apps/brain` in die
vorhandenen Qualitätsgates aufgenommen wird. Es ändert noch keinen Workflow,
kein Root-Skript und keinen Deploy-Pfad.

## 1. Ziel, feste Grenzen und Ausgangslage

Brain ist das owner-private Produkt für persönliche Daten und lokale KI. Es
läuft standardmäßig nur lokal oder im LAN und wird niemals allein durch einen
Merge öffentlich erreichbar. Die Produktgrenzen aus dem Inventar bleiben
bindend: Brain ist owner-only, `personal_brain` bleibt local-only, und es gibt
keine Cross-App-Imports.

Für diese Planung gelten außerdem:

- `fast-checks` bleibt der einzige Required Check der Branch Protection.
- Die Implementierungswelle erweitert CI-Gates, aber schaltet keinen Deploy um.
- Neue Konfigurationsbeispiele enthalten ausschließlich Platzhalter, keine
  echten Zugangsdatenwerte.
- Neue Laufzeit-Umgebungszugriffe sind nicht Teil dieser Welle.
- Die GitHub-Cloud-CI bleibt das autoritative Gate; lokale Läufe sind
  Vorabprüfungen.

### Ist-Befund

| Bereich | Ist-Zustand | Lücke für Brain |
|---|---|---|
| `.github/workflows/pr-check.yml` | `detect-changes` liefert nur `studio_build`; `fast-checks` baut Studio konditional. | Ein Brain-only-PR würde keinen Next.js-Production-Build ausführen. |
| `.github/workflows/ci.yml` | `quality` führt `pnpm quality` aus; der Next.js-Cache enthält nur Studio und Portal. | `build:release` baut Brain künftig mit, sein `.next/cache` bliebe aber kalt. |
| `turbo.json` | Globale Tasks `build`, `topo`, `typecheck` und `test`; `typecheck`/`test` hängen nur an `topo`. | Brain muss passende Package-Skripte und korrekte Workspace-Abhängigkeiten deklarieren. |
| Root-`package.json` | `dev:studio`, `dev:portal`; Affected-Gates nutzen `...[origin/main]`. | `dev:brain` und die Portkonvention fehlen; die Affected-Gates müssen mit dem neuen Package nachweislich greifen. |
| Budget-Gates | Dateigrößen gelten repo-weit; Bundle-Budget gilt nur für Studio; Runtime-Budgets kennen Studio und Portal. | Brain braucht eigene Bundle- und Runtime-Messpunkte. |
| Release-Helfer | Standalone-Materialisierung und -Prüfung kennen nur Studio und Portal. | Das ist bewusst eine Deploy-Grenze und wird in dieser sowie der nächsten Welle nicht erweitert. |
| Host/Deploy | `uwe.service`, Start, Health, Firewall und Cloudflare sind auf Studio `:3000` und Portal `:3001` verdrahtet. | Brain darf durch die CI-Aufnahme nicht automatisch auf dem Host oder öffentlich starten. |

## 2. PR-Gate: konditionaler Brain-Production-Build

### 2.1 Change Detection

In `.github/workflows/pr-check.yml` erhält `detect-changes` einen zusätzlichen
Output `brain_build`, gespeist aus
`steps.scoped_changes.outputs.brain_build`. Der neue Filter lautet:

```yaml
brain_build:
  - 'apps/brain/**'
  - 'packages/**'
  - 'pnpm-lock.yaml'
  - 'turbo.json'
```

Damit ist das Verhalten symmetrisch zum vorhandenen Studio-Filter:

- Änderungen nur unter `apps/brain/**` bauen Brain, aber nicht Studio.
- Änderungen an gemeinsamem Package-Code, Lockfile oder Turbo-Graph bauen
  Studio und Brain, weil beide Produktions-Builds betroffen sein können.
- Docs-only-PRs bleiben im install-freien `docs-check`-Pfad.
- Portal wird in dieser Aufgabe nicht zusätzlich zu einem PR-Production-Build
  gemacht; das wäre eine unabhängige CI-Policy-Änderung.

Der breite `packages/**`-Filter ist absichtlich sicherheitsorientiert. Eine
spätere Verengung ist erst zulässig, wenn sie aus dem echten Turbo-
Abhängigkeitsgraphen abgeleitet und mit Shared-Package-Änderungen getestet wird.

### 2.2 Build-Schritt und Required-Check-Vertrag

Nach dem Affected-Gate kommt im bestehenden Job `fast-checks` ein Schritt
`Brain production build` hinzu:

```yaml
if: needs.detect-changes.outputs.code == 'true' && needs.detect-changes.outputs.brain_build == 'true'
run: pnpm --filter @uwe/brain build
```

Der Schritt bleibt im selben Job wie Lint, Affected-Gate und Studio-Build. Eine
fehlgeschlagene Brain-Kompilierung macht daher den bereits required gesetzten
Check `fast-checks` rot; es entsteht kein zweiter Required Check. Die
Voraussetzungsprüfung für `detect-changes` und den konditionalen Fedora-Smoke
bleibt unverändert.

### 2.3 PR-Cache

Brain bekommt einen eigenen Restore-only-Cache, statt den bestehenden
Studio-Cache aufzublähen:

- Pfad: `apps/brain/.next/cache`
- Schlüssel: `next-brain-${runner.os}-${lockfile-hash}`
- Restore-Präfix: `next-brain-${runner.os}-`
- Bedingung: Codeänderung und `brain_build == 'true'`

Der Cache wird im PR nicht gespeichert. Wie beim Studio-Cache schreibt nur der
Main-Job die wiederverwendbare Next.js-Basis. Der pnpm-Store und `.turbo`
bleiben gemeinsame Caches; eine dritte Kopie pro App wäre unnötig und würde
Transferzeit sowie Cache-Quota erhöhen.

### Akzeptanzkriterien PR

- Ein Brain-only-Code-PR setzt `brain_build=true` und `studio_build=false`.
- Ein Shared-Package-PR setzt beide Build-Outputs auf `true`.
- Ein Docs-only-PR installiert keine Dependencies und baut keine App.
- Ein absichtlich fehlschlagender Brain-Production-Build schlägt
  `fast-checks` fehl.
- In der Branch Protection ist weiterhin ausschließlich `fast-checks`
  required.
- Ein Warm-Cache-Lauf und ein Cold-Cache-Lauf bleiben unter dem
  35-Minuten-Timeout; Ziel ist mindestens fünf Minuten Reserve. Wird die
  Reserve verfehlt, muss vor Aktivierung die Build-Parallelität oder der
  Cache-Zuschnitt optimiert werden. Eine Timeout-Erhöhung benötigt eine
  dokumentierte Kostenentscheidung.

## 3. Main-CI und `build:release`

### 3.1 Wirkung der dritten Next.js-App

`pnpm build:release` führt über das Root-Skript `build` bereits
`turbo run build` aus. Sobald `apps/brain/package.json` ein `build`-Skript
besitzt und das Package über `apps/*` im Workspace liegt, wird Brain ohne eine
weitere App-Liste Teil jedes Release-Builds und damit von `pnpm quality`.

Das erhöht:

- CPU-Zeit für Next.js-Kompilierung und statische Analyse,
- Spitzen-RAM, falls mehrere App-Builds parallel laufen,
- Größe und Transferzeit der Next.js-Caches,
- Main-CI-Minuten pro Merge und die Zeit bis zum nachgelagerten Deploy,
- Cold-Cache-Risiko nach Lockfile-Änderungen.

pnpm-Store und Turbo-Cache werden nicht app-spezifisch dupliziert. Der Store
profitiert weiterhin von identischen Next-/React-Versionen; Turbo nimmt die
neuen Brain-Tasks in denselben Graphen auf.

### 3.2 Main-Cache-Änderung

In `.github/workflows/ci.yml` kommen getrennte Restore-/Save-Schritte für
`apps/brain/.next/cache` mit dem Präfix `next-brain-` hinzu. Der vorhandene
kombinierte Studio-/Portal-Cache bleibt unverändert, damit die Einführung
keinen vollständigen Cache-Cold-Start für beide Bestands-Apps verursacht.

Der Save-Schritt verwendet wie die vorhandenen Caches `if: always()`. So kann
auch ein später fehlgeschlagenes Gate den bis dahin erzeugten Brain-Cache für
den nächsten Lauf bereitstellen. Der Cache darf nur Build-Artefakte enthalten;
Laufzeitdaten und persönliche Brain-Inhalte gehören nie hinein.

### 3.3 Zeit- und Kostenkontrolle

Vor und nach der CI-Änderung werden für mindestens drei Main-Läufe jeweils
Warm- und Cold-Cache-Werte erfasst: Dauer von `quality`, Dauer jedes App-Builds,
Cachegröße, Cache-Hit sowie Peak-RAM beziehungsweise OOM-Ereignisse.

Entscheidungsgrenzen:

- Der 50-Minuten-Timeout bleibt bestehen; ein Cold-Cache-Lauf soll spätestens
  nach 40 Minuten enden, damit zehn Minuten Betriebsreserve bleiben.
- Bei OOM wird zuerst die Build-Parallelität auf höchstens zwei gleichzeitige
  Next.js-Builds begrenzt, statt mehr Runner-RAM vorauszusetzen.
- Bei mehr als zehn zusätzlichen Warm-Cache-Minuten pro Main-Lauf werden
  Cache-Hits und unnötige App-Rebuilds untersucht, bevor der Timeout steigt.
- Ein Split in einen weiteren Main-Job ist nur zulässig, wenn `quality` als
  vollständiges Gate erhalten bleibt und `deploy.yml` weiterhin erst nach
  einem insgesamt grünen Workflow auslöst.

Standalone-Materialisierung, `build:standalone-check` und deren App-Liste
bleiben in dieser und der nächsten Welle bei Studio und Portal. Brain erhält
zwar einen Production-Build, aber noch kein freigegebenes Host-Artefakt.

### Akzeptanzkriterien Main-CI

- `pnpm quality` führt `@uwe/brain#build` aus und scheitert bei dessen Fehler.
- Ein zweiter Main-Lauf mit unverändertem Lockfile meldet einen Brain-Next-
  Cache-Hit.
- Studio-/Portal-Cachepfade und pnpm-/Turbo-Cacheverhalten regressieren nicht.
- Der Cold-Cache-Lauf bleibt unter 40 Minuten und ohne OOM; andernfalls greift
  vor Merge die oben definierte Parallelitätsmaßnahme.
- Standalone-Prüfung und Deploy bleiben ausdrücklich Zwei-App-Verträge.

## 4. Turbo- und Package-Vertrag

`turbo.json` definiert Tasks global, nicht pro App. Deshalb werden keine
scheinbaren `apps/brain`-Sondertasks angelegt. Die App nimmt durch folgende
Skripte in `apps/brain/package.json` an den bestehenden Tasks teil:

| Skript | Vertrag |
|---|---|
| `dev` | Next.js-Dev-Server auf Port `3002` |
| `build` | Next.js-Production-Build |
| `typecheck` | TypeScript-Prüfung ohne Ausgabe |
| `test` | reproduzierbarer Node-Testlauf; ein fehlendes Test-Skript ist nicht zulässig |

Die bestehenden Turbo-Einträge bleiben fachlich so aufgebaut:

```json
{
  "build": { "dependsOn": ["^build"] },
  "topo": { "dependsOn": ["^topo"] },
  "typecheck": { "dependsOn": ["topo"] },
  "test": { "dependsOn": ["topo"] }
}
```

`build` darf seine echten Package-Build-Abhängigkeiten topologisch bauen.
`typecheck` und `test` dürfen dagegen kein `^build` erhalten: UWE konsumiert
Workspace-Quellen direkt, und ein vorgeschalteter Build würde die Affected-
Gates nur verteuern. Der synthetische No-op-Task `topo` bleibt notwendig, damit
Änderungen in internen Abhängigkeiten den Cache-Hash der Brain-Tasks ändern.

Jedes von Brain importierte Workspace-Package muss in dessen `dependencies`
oder `devDependencies` deklariert sein. Nur dann kann Turbo die Kante erkennen
und `...[origin/main]` korrekt auswerten.

### Akzeptanzkriterien Turbo

- Die Dry-Run-Ausgabe für Brain enthält `build`, `typecheck` und `test`.
- `typecheck` und `test` zeigen `topo`, aber kein vorgeschaltetes `build`.
- Nach einer Änderung an einer deklarierten Brain-Abhängigkeit ändert sich der
  Hash des abhängigen Brain-Tasks beziehungsweise der Task wird erneut
  ausgeführt.
- Ein Brain-only-PR zeigt `@uwe/brain#typecheck` und `@uwe/brain#test` im
  `ci:light:pr:gate`-Log.

## 5. Root-Skripte und Portkonvention

Das Root-`package.json` erhält:

```json
"dev:brain": "pnpm --filter @uwe/brain dev"
```

Die Portkonvention lautet verbindlich:

| App | Entwicklung und lokaler Start |
|---|---:|
| Studio | `3000` |
| Portal | `3001` |
| Brain | `3002` |

`pnpm dev` verwendet weiterhin `turbo run dev` und startet damit nach dem
Scaffold alle drei Apps. `dev:brain` erlaubt den isolierten Start. Port `3002`
ist eine lokale Produktkonvention, noch keine Firewall-, systemd- oder
Cloudflare-Freigabe.

Die Root-Skripte `typecheck:affected`, `test:ci:affected` und
`ci:light:pr:gate` benötigen keine neue hartcodierte App-Liste. Ihre
Turbo-Filter nehmen `@uwe/brain` automatisch auf, sofern Package-Skripte und
Abhängigkeitsgraph korrekt sind. Genau dieses Verhalten wird als
Akzeptanztest geprüft; eine zusätzliche separate Brain-Testpipeline würde das
Affected-Prinzip umgehen.

## 6. Budgets und Gates

### 6.1 Dateigrößen

`scripts/file-size-budget-check.mjs` scannt bereits `apps` und erfasst damit
neue produktive `.ts`-/`.tsx`-Dateien unter `apps/brain` automatisch. Es gilt
ohne Sonderregel:

- höchstens 700 Zeilen pro neuer Produktionsdatei,
- keine neue Baseline-Ausnahme für Brain,
- Tests, generierte Ausgaben, `.next` und andere bestehende Excludes bleiben
  unverändert,
- bei Überschreitung wird die Datei geteilt; das Budget wird nicht erhöht.

Akzeptanz: `node scripts/file-size-budget-check.mjs` ist grün und ein
Regressionstest weist nach, dass eine übergroße synthetische Brain-Datei als
`new-file-too-large` erkannt würde.

### 6.2 Bundle-Budget

Der bestehende Bundle-Check misst nur Studio. Er wird in der
Implementierungswelle so generalisiert, dass Studio unverändert und Brain
zusätzlich, aber getrennt ausgewertet werden. Für Brain werden nach einem
sauberen Production-Build drei Werte festgeschrieben:

- Gesamtgröße der statischen Client-Chunks: aufgerundeter Messwert plus zehn
  Prozent, niemals höher als das Studio-Limit von 6.500 KB,
- größter Einzelchunk: aufgerundeter Messwert plus zehn Prozent, niemals höher
  als 550 KB,
- Shared-Framework-Chunk: höchstens 200 KB.

Die gemessene Ausgangsbasis und jede spätere Änderung werden in
`docs/engineering/performance.md` begründet. Der Checker muss fehlen gelassene
Brain-Buildausgaben als Fehler melden, damit `quality` keinen ausgelassenen
Build übersieht. Der zugehörige Test prüft Brain-Inventar, Grenzwerte und die
Verdrahtung in `quality`.

### 6.3 Runtime-Performance

Die erste Brain-Budgetroute ist `brain:/today`, weil `/today` laut Inventar in
das owner-private Produkt wandert. Für die erste Welle gelten dieselben
Startgrenzen wie bisher für die entsprechende Studio-Route:

- LCP: 3.000 ms,
- FCP: 2.000 ms,
- Load: 4.000 ms.

`e2e/brain-perf.spec.ts` misst die authentifizierte Owner-Route, und der
testinterne Brain-Server verwendet Port `3201`, getrennt vom Dev-Port `3002`.
`test:e2e:perf`, die zentrale Runtime-Budgettabelle und deren Regressionstest
werden um `brain:/today` ergänzt. Diese Messung läuft weiterhin nur geplant
oder manuell, nicht bei jedem PR. Das testinterne Starten einer dritten App ist
keine Host- oder Deploy-Freigabe.

### 6.4 Zugangsdaten-Scan und Security-Gate

`pnpm secret:scan` läuft bereits repo-weit und nimmt unterstützte Dateien unter
`apps/brain` automatisch auf. Die Implementierungswelle ergänzt keine
Brain-Allowlist. Beispiele verwenden nur kurze, eindeutig markierte
Platzhalter. Für owner-only Brain-Routen kommen zusätzlich negative
Route-Guard-Tests in das bestehende `test:security`-Gate: ohne Session,
Nicht-Owner und falsche Produktaudience müssen abgewiesen werden.

Akzeptanz: `pnpm secret:scan` und `pnpm test:security` sind grün; der
Scannerlauf zeigt keine Ausnahme für `apps/brain`.

### 6.5 Dokumentationsgate

`docs-check.mjs` scannt Markdown unter `docs` schon automatisch. In der
Implementierungswelle werden `README.md`, `AGENTS.md` und
`docs/engineering/ci.md` um die dritte App, Port `3002`, den konditionalen
Build und die lokale Exposure-Grenze ergänzt. Zusätzlich wird ein kanonischer
Brain-Betriebs- und Datenschutztext als
`docs/engineering/brain-local-runtime.md` angelegt und als Required File
geführt. Der Privacy-Owner bestätigt seinen Inhalt vor dem Merge.

Akzeptanz: `node scripts/docs-check.mjs` erfasst den kanonischen Brain-Text und
ist grün. Die Dokumentation darf Brain nicht als automatisch öffentlich oder
bereits durch systemd gestartet darstellen.

## 7. Harte Deploy-Abgrenzung

In dieser Planungswelle und in der unmittelbar folgenden CI-/App-Scaffold-
Welle bleiben unverändert:

- `.github/workflows/deploy.yml`,
- `deploy/systemd/uwe.service` und alle weiteren Units,
- `deploy/scripts/start-uwe.sh`, Host-Setup, Healthcheck, Firewall- und
  Update-Skripte,
- Cloudflare-Tunnelkonfiguration und öffentliche Hostnamen,
- Standalone-Materialisierung und -Prüfung mit ihrer Studio-/Portal-Liste,
- produktive Timer sowie interne Briefing-/Mail-Endpunkte.

Insbesondere wird Port `3002` nicht automatisch in Firewall oder Tunnel
freigegeben. Ein CI-Build erzeugt keine öffentliche Erreichbarkeit.

Folgende Fragen brauchen später separate Owner-Entscheidungen und eine eigene
Deploy-Welle:

1. Läuft Brain in einem eigenen gehärteten Dienst oder im bestehenden
   Mehrprozessdienst?
2. Bindet Brain nur an Loopback oder an eine ausgewählte LAN-Schnittstelle, und
   welche Firewall-Regel ist dafür zulässig?
3. Bleibt Remote-Zugriff vollständig ausgeschlossen? Falls nicht, sind
   Threat-Model, explizite Freigabe und eine owner-only Access-Policy nötig;
   ein Tunnel darf nie automatisch entstehen.
4. Wie werden Session-Audience, Cookies, Origin-/CSRF-Prüfung und Owner-Guard
   zwischen Studio und Brain getrennt?
5. Welche Healthchecks, Restart-Grenzen, RAM-Limits und Log-Redaction gelten
   für einen Brain-Prozess?
6. Wann werden Brain-Standalone-Artefakt, Materialisierung und Host-Update in
   den Release-Vertrag aufgenommen?
7. Welche Brain-Datenroots, Backups, Restore-Rechte und Retention-Regeln sind
   getrennt von Studio/Portal nötig?
8. Wann wechseln persönliche Briefing-, Mail-, Job- und Timer-Aufrufe vom
   Studio-Origin zu Brain, und wer besitzt die Migration?
9. Wie sehen Rollback, Datenmigration und ein Health-Fallback aus, ohne Brain
   unbeabsichtigt öffentlich zu machen?

Keine dieser Fragen wird durch den Port, das Package oder einen grünen Build
vorentschieden.

## 8. Reihenfolge der Implementierungswelle

Die Änderungen werden in dieser Reihenfolge umgesetzt und möglichst in einem
atomaren PR validiert:

1. **App-/Package-Vertrag herstellen.** `@uwe/brain` mit `dev`, `build`,
   `typecheck`, `test`, Port `3002` und vollständig deklarierten Workspace-
   Abhängigkeiten anlegen. Owner-only Route Guards sind ab der ersten Route
   Pflicht.
2. **Turbo und Affected-Gate beweisen.** Dry Run, Brain-only-Änderung und
   Shared-Package-Änderung prüfen; `topo` beibehalten und kein `^build` vor
   `typecheck`/`test` einführen.
3. **PR-Gate erweitern.** `brain_build`-Output und Filter, Restore-only-Next-
   Cache sowie konditionalen Brain-Build innerhalb `fast-checks` ergänzen.
4. **Main-Gate und Budgets erweitern.** Separaten Brain-Next-Cache,
   `build:release`-Nachweis, Bundle-Budget und geplante Runtime-Messung
   integrieren; Warm-/Cold-Werte erfassen.
5. **Security und Dokumentation schließen.** Owner-negative Tests,
   repo-weiten Scan, Required Brain-Dokumentation sowie README/AGENTS/CI-Doku
   aktualisieren.
6. **Deploy-Negativprüfung durchführen.** Sicherstellen, dass kein Deploy-,
   systemd-, Hoststart-, Firewall-, Cloudflare- oder produktiver Timer-Pfad
   Brain/Port `3002` aufgenommen hat.
7. **Cloud-CI abwarten.** Der PR ist erst bereit, wenn `fast-checks` grün ist;
   nach Merge müssen Main-`quality` und der gesamte CI-Workflow grün sein.

## 9. Abschlusscheckliste und Definition of Done

- [ ] `@uwe/brain` ist im Workspace und besitzt alle vier Turbo-relevanten
      Skripte.
- [ ] `pnpm dev:brain` startet Brain auf `:3002`; Studio und Portal behalten
      `:3000` und `:3001`.
- [ ] Brain-only- und Shared-Package-Diffs setzen die erwarteten
      `brain_build`-/`studio_build`-Outputs.
- [ ] `fast-checks` bleibt der einzige Required Check und enthält den
      konditionalen Brain-Production-Build.
- [ ] `ci:light:pr:gate` führt Brain-Typecheck und -Tests affected aus.
- [ ] `quality` baut Brain und prüft sein Bundle-Budget.
- [ ] Warm-/Cold-Main-CI liegen innerhalb der Zeit- und RAM-Grenzen.
- [ ] pnpm-Store und Turbo bleiben geteilt; Brain besitzt einen separaten
      Next.js-Cache.
- [ ] Dateigrößen-, Bundle-, Runtime-, Security-, Zugangsdaten- und
      Dokumentationsgates sind grün.
- [ ] Keine echte Zugangsdatenprobe wurde eingecheckt und keine Brain-Allowlist
      wurde ergänzt.
- [ ] Deploy, Hoststart, systemd, Firewall und Cloudflare bleiben ohne Brain.
- [ ] Die Owner-Fragen aus Abschnitt 7 sind als eigener späterer
      Entscheidungsblock eingeplant.

## 10. Risiken und Gegenmaßnahmen

| Risiko | Wirkung | Gegenmaßnahme und Abbruchkriterium |
|---|---|---|
| Zusätzliche PR-Build-Minuten | Brain-only-PRs zahlen einen Next.js-Build; Shared-Package-PRs bauen Studio und Brain. | Restore-only-Brain-Cache, unverändertes Affected-Gate, 30-Minuten-Ziel innerhalb des 35-Minuten-Jobs; bei Überschreitung vor Aktivierung optimieren. |
| Höhere Main-CI-Kosten | Jeder Merge baut eine dritte App; bei vielen Agent-PRs multiplizieren sich Minuten. | Drei Warm-/Cold-Messungen, gemeinsamer pnpm-/Turbo-Cache, eigener Next-Cache, Merge-Frequenz beobachten; mehr als zehn zusätzliche Warm-Minuten erfordert Review. |
| OOM durch parallele Builds | `quality` kann spät und teuer scheitern. | Maximal zwei gleichzeitige Next-Builds, falls Peak-RAM/OOM auffällig wird; zehn Minuten Timeout-Reserve halten. |
| Cache-Wachstum oder -Verdrängung | Große Archive erhöhen Transferzeit und verdrängen nützliche Caches. | Brain-Next-Cache separat halten, nur `.next/cache` speichern, Größe pro Lauf protokollieren. |
| Affected-False-Negative | Brain-Tests werden bei einer Shared-Änderung fälschlich aus Cache bedient oder ausgelassen. | Vollständige Workspace-Dependencies, `topo`-Kante und Hash-Regressionstest. |
| Build grün, Runtime ungeprüft | Server-/Client-Grenzen oder Performancefehler erreichen Main. | Konditionaler Production-Build im PR, Bundle-Gate auf Main, geplanter authentifizierter Perf-Smoke. |
| Owner-private Route wird zu breit erreichbar | Persönliche Daten könnten Produktgrenzen verlassen. | Owner-/Audience-Negativtests in `test:security`; keine Deploy-/Tunneländerung in beiden Wellen. |
| Deploy-Kopplung durch Hilfsskripte | Eine scheinbar harmlose Release-Liste könnte Brain auf dem Host aktivieren. | Standalone-Helfer und Deploy-Dateien explizit unverändert lassen; separate Owner-Entscheidung. |

## 11. Integrationshinweise

- Der verbindliche Package-Name ist `@uwe/brain`; CI-Filter und Root-Skript
  müssen denselben Namen verwenden.
- Port `3002` ist eine gemeinsame Schnittstelle für App-Scaffold, lokale Doku
  und spätere E2E-Konfiguration, aber keine öffentliche Freigabe.
- Die Route `brain:/today` verbindet die Route-Migrations- und
  Performance-Welle; ändert sich die erste Brain-Landingroute, müssen Spec,
  Budget-Key und Doku atomar folgen.
- Die Privacy-Welle liefert den kanonischen Namen des Required Brain-Dokuments
  und die owner-only Audience-Regeln.
- Die spätere Deploy-Welle übernimmt ausschließlich die offenen Fragen aus
  Abschnitt 7; sie darf die CI-Aufnahme nicht rückwirkend als
  Veröffentlichungsfreigabe interpretieren.

## 12. Referenzierte Ist-Quellen

- `AGENTS.md`
- `docs/engineering/ci.md`
- `.github/workflows/pr-check.yml`
- `.github/workflows/ci.yml`
- `.github/workflows/deploy.yml`
- `turbo.json`
- `package.json`
- `pnpm-workspace.yaml`
- `scripts/file-size-budget-check.mjs`
- `scripts/bundle-budget-check.mjs`
- `scripts/perf-budget-check.mjs`
- `scripts/docs-check.mjs`
- `scripts/secret-scan.mjs`
- `deploy/systemd/uwe.service`
- `deploy/scripts/`
- `docs/rework/three-product-split/00-inventory.md` aus Revision
  `223ac6f176458bf17a6679e39c066ca6e9721012`
