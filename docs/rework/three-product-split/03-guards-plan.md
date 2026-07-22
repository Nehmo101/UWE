# O03 — Plan für Import-, Route- und Dependency-Guards

Stand: 2026-07-15. Dieses Dokument ist ein umsetzungsreifer Plan für den
Drei-Produkte-Split. Es ändert weder Imports noch Routen, Pakete, Runtime-Policy
oder CI.

## 1. Quellen und verbindliche Begriffe

Grundlage sind das O00-Inventar aus Commit
`223ac6f176458bf17a6679e39c066ca6e9721012`, der advisory O02-Stand aus Commit
`837a708ca3a98c3ce7841eabdd895b5019f973fb`, `AGENTS.md`,
`scripts/file-size-budget-check.mjs`, die Root-ESLint-Konfiguration,
`packages/auth/src/security/route-policy.ts`, `turbo.json`, die Workspace-
Manifeste und `.github/workflows/pr-check.yml`. Im Arbeitsbaum lag O02 nicht als
Datei vor; deshalb wurden seine Commit-Inhalte als advisory Contract verwendet.

O02s Namen werden unverändert übernommen:

- `AppAudience`: `portal`, `studio`, `brain`, `platform`.
- `DataDomain`: `dnd_world`, `dnd_brain`, `portal_player`, `personal_brain`,
  `admin_life`, `platform_auth`, `platform_ops`, `assets`, `jobs`,
  `integrations`, `ai_control`, `shared_reference`.
- `PrivacyClass`: `public`, `player_visible`, `dm_only`,
  `owner_private_local`.

Für diese Guards sind `personal_brain` und `admin_life` Brain-only. Inhalte mit
`owner_private_local` dürfen nur von `audience: "brain"` hinter dem Owner- und
Local-/LAN-Guard verarbeitet werden. `dnd_brain` bleibt dagegen Studio. Eine
`platform`-Audience ist kein fachlicher Superuser; sie darf private Inhalte nur
über opaque Handles orchestrieren.

## 2. Entscheidung: ein eigener Zero-Dependency-Guard

Der verbindliche Mechanismus soll ein eigenes Node-22-Skript
`scripts/product-boundary-check.mjs` sein. Es verwendet ausschließlich
`node:fs`, `node:path`, `node:url` und kleine, getestete Lexer-Helfer. Ein Lauf
prüft statische Modul- und Dateireferenzen, Workspace-Abhängigkeiten sowie die
Abdeckung der Route-Audience-Regeln. Zielwert für einen kalten Checkout ist
höchstens fünf Sekunden ohne `pnpm install`.

| Option | Stärken | Grenzen | Entscheidung |
|---|---|---|---|
| ESLint `no-restricted-imports` mit `paths`/`patterns` | Gute IDE-Rückmeldung; TypeScript-Imports werden geparst; vorhandener Root-Lint erfasst beide Next-Apps | Erst nach Installation verfügbar; löst relative Pfade, Workspace-Graph, transitive Dependencies und Datei-Lesezugriffe nicht vollständig auf; Pattern-Duplikation driftet leicht | Nur ergänzend. Ein kleiner, aus derselben Regelquelle erzeugter Regelsatz spiegelt die wichtigsten direkten Verbote. |
| `dependency-cruiser` | Ausgereifter Modulgraph, Zyklen und transitive Regeln | Neue Dependency und Lockfile-Änderung; nicht vor Installation nutzbar; für Route-Audience und Manifest-Sonderregeln ist weiterhin eigener Code nötig | Nicht einführen. |
| Eigenes Node-Skript | Keine Dependency; vor Install lauffähig; einheitliche Meldungen und Baseline; kann Imports, Pfadliterale, Manifeste und Routen gemeinsam prüfen | Der Lexer und die Pfadauflösung brauchen gezielte Negativtests; kein vollständiger TypeScript-Compiler | Autoritativer Guard. |

Es existiert derzeit nur `eslint.config.mjs` im Root; app-lokale
ESLint-Konfigurationen wurden nicht gefunden. Die optionale ESLint-Spiegelung
wird deshalb als Flat-Config-Block je `files`-Baum in der Root-Konfiguration
erzeugt. Die Entscheidungshoheit bleibt beim Node-Skript.

## 3. Gemeinsames Regelmodell

Die Implementierung trennt Regeln und Ausführung:

```text
scripts/product-boundary-rules.mjs       Verzeichnis-, Paket- und Ausnahme-Map
scripts/product-boundary-imports.mjs     Lexer, Specifier- und Pfadauflösung
scripts/product-boundary-routes.mjs      Next-Dateipfad -> URL und Coverage
scripts/product-boundary-check.mjs       CLI, Sortierung, Baseline, Exitcode
scripts/product-boundary-baseline.json   nur auditierte Bestandsverstöße
scripts/product-boundary-check.test.ts   positive und negative Fixtures
```

Die Aufteilung verhindert einen schwer prüfbaren Monolithen. Die Regeldatei
enthält keine Runtime-Konfiguration und keine Zugangswerte. Alle Pfade werden
auf Repo-relative Slash-Pfade normalisiert. Generierte Ordner, Build-Ausgaben,
`node_modules`, `.next`, `.turbo`, `dist`, Coverage und Prisma-Generated-Code
bleiben ausgeschlossen, analog zum File-Size-Guard.

### 3.1 Verzeichnis- und Paketklassen

Die O00-Zuordnung wird als explizite, reviewbare Tabelle codiert; unbekannte
Workspace-Pakete führen zu einem Fehler, bis sie klassifiziert wurden.

| Klasse | Verzeichnisbäume beziehungsweise Pakete |
|---|---|
| Portal-App | `apps/portal/**` |
| Studio-App | `apps/studio/**`; bis zur Verschiebung ein physisch gemischter Host, dessen Route-Dateien über `AppAudience` feiner klassifiziert werden |
| Brain-App | künftig `apps/brain/**` |
| Platform-App/Tool | `apps/rtx-connector-client/**`, `tools/**` |
| Portal-Pakete | `@uwe/player-hub`, `@uwe/static-export` |
| Studio-Pakete | `@uwe/image-studio`, `@uwe/knoteforge-import`, `@uwe/page-ai-review`, `@uwe/theme-studio` |
| Brain-Pakete | `@uwe/cookbook`, `@uwe/kitchen`, `@uwe/mail`, `@uwe/scan-inbox` |
| Shared Engines | `@uwe/ai-brain`, `@uwe/assets`, `@uwe/atlas`, `@uwe/atlas-3d`, `@uwe/calendar`, `@uwe/connector-model-profile`, `@uwe/dnd-api`, `@uwe/mail-core`, `@uwe/roll-tables`, `@uwe/shared-ui`, `@uwe/shared-utils`, `@uwe/soundboard`, `@uwe/web-search` |
| Platform-Pakete | `@uwe/agent-jobs`, `@uwe/auth`, `@uwe/backup`, `@uwe/config`, `@uwe/connector`, `@uwe/connector-client-config`, `@uwe/database`, `@uwe/env`, `@uwe/host-monitor`, `@uwe/security`, `@uwe/security-tests`; künftig `@uwe/product-contracts` |

`packages/security-tests/**` und Guard-Fixtures dürfen App-Quelldateien als
Testdaten lesen, aber keine App-Runtime-Module als Produktdependency einführen.
`scripts/**` darf Apps orchestrieren. Diese Ausnahmen gelten nicht für Code,
der in ein Produktbundle gelangt.

## 4. Import- und Dateireferenz-Guards

### 4.1 Verbindliche Regelliste

| ID | Importer | Verbot |
|---|---|---|
| `IMP_CROSS_APP` | `apps/portal/**`, `apps/studio/**`, künftig `apps/brain/**` | Jeder Import, Re-Export, `require`- oder dynamische Import-Literalpfad in einen anderen App-Baum, in beide Richtungen. HTTP-Links zwischen Produkten sind keine Modulimporte. |
| `IMP_PACKAGE_TO_APP` | alle `packages/**` und produktiven `tools/**` | Imports und aufgelöste Datei-Literale in `apps/**`. Dadurch wird auch die heutige Static-Export-Abhängigkeit auf `apps/portal/app/wiki.css` sichtbar. |
| `IMP_PORTAL_BRAIN` | `apps/portal/**`, Portal-Pakete und `@uwe/static-export` | Brain-Pakete, Brain-private DB-/AI-Subpaths und alle Exporte der Domains `personal_brain` oder `admin_life`. Gilt auch für Type-only-Imports. |
| `IMP_SHARED_PRODUCT` | Shared Engines | App-Bäume sowie Portal-, Studio- oder Brain-Pakete. Zusätzlich direkter Prisma-/DB-Clientzugriff; Engines erhalten Daten nur über schmale Ports. |
| `IMP_BRAIN_FROM_NON_BRAIN` | Studio- oder Platform-Audience-Code | Brain-private Module. Eine Datei unter `apps/studio` ist nur dann vorübergehend erlaubt, wenn ihre Route beziehungsweise ihr expliziter Adapter als `audience: "brain"` klassifiziert ist. |
| `IMP_BRAIN_TO_PRODUCT` | Brain-App und Brain-Pakete | Studio-/Portal-App-Code und deren fachliche Pakete. Gemeinsame Engines sowie freigegebene Platform-Ports bleiben erlaubt. |
| `IMP_UNRESOLVED_DYNAMIC` | Portal, Shared Engines und audience-gemischte App-Infrastruktur | Nichtliterale `import()`-/`require()`-Ziele, sofern sie nicht in einer engen, begründeten Allowlist stehen. Dies verhindert das Umgehen der Pfadregeln durch String-Konkatenation. |

Die App-Grenze wird nach aufgelöstem Ziel geprüft, nicht anhand eines
Substrings. Damit werden relative Pfade, `@/` innerhalb der jeweiligen App,
Workspace-Paketnamen samt Subpaths, `export ... from`, CSS-`@import`, statische
`import()`-Aufrufe und CommonJS-`require()` gleich behandelt. Symlink-Ziele
werden vor der Klassifikation real aufgelöst und müssen im Repository bleiben.

Zusätzlich untersucht der Lexer String-Literale mit Repo-/App-Pfadsegmenten in
produktiven Dateioperationen. So wird die bekannte Zeile in
`packages/static-export/src/assets.ts`, die Portal-CSS direkt liest, vom selben
Guard erfasst. Kommentare, Dokumentation, Fehlermeldungen und Testinventare
werden nicht als Dateikanten gewertet.

### 4.2 Brain-private Module während der Übergangszeit

Vor dem Package-Split braucht die Regeldatei eine explizite Übergangsmap. Sie
umfasst mindestens:

- die vier Brain-Pakete aus Abschnitt 3.1;
- `packages/database/src/personal-brain-*.ts` und
  `packages/database/src/life-admin/**`;
- die privaten Mail-, Capture-, persönliche Kalender-, Knowledge-, Kitchen-,
  Projekt-, Workshop-, Dokument- und Scan-Service-Exports aus dem heute breiten
  `@uwe/database/server`-Barrel;
- `packages/ai-brain/src/embeddings/personal-brain-*` sowie private
  Personal-Brain-Kontextlader und Capture-Triage-Adapter.

Die Map nennt konkrete Modulpfade und, für das bestehende breite DB-Barrel,
konkrete Exportnamen. Reine Namensheuristiken wie `*brain*` sind unzulässig,
weil sie `dnd_brain` fälschlich sperren könnten. Namespace-Imports des breiten
DB-Barrels sind in Portal, Shared Engines und nicht als Brain klassifiziertem
Code verboten, weil ihre Symbole nicht sicher eingegrenzt werden können.

> **Hinweis (2026-07-22):** „O05" bezeichnet in diesem Dokument den damals
> geplanten Extraktions-Task. Der Slot wurde anders belegt
> (`05-ci-brain-prep.md` ist CI-Vorbereitung). Alle „O05"-Verweise hier meinen
> die **Masterplan-Wellen 2 (Contracts) und 4 (fachliche Extraktion)** — siehe
> [07-delta-und-mehrfachzuordnung.md](07-delta-und-mehrfachzuordnung.md) §3.

O05 ersetzt diese Übergangsmap durch explizite Subpaths beziehungsweise eigene
Pakete, zum Beispiel Brain-Repositories hinter einem Brain-Port und Portal-
Projektionen hinter einem Portal-Port. Nach der Extraktion verbietet der Guard
das alte breite Barrel in diesen Verbrauchern vollständig.

### 4.3 Lexer und Auflösung

Der Zero-Dependency-Lexer ist kein Regex über den gesamten Quelltext. Er
überspringt Kommentare und Template-Inhalte, erkennt aber Modul-Grammatik und
relevante String-Literale. Tests decken mindestens folgende Fälle ab:

1. statischer Import, Type-only-Import, Re-Export, `require()` und dynamischer
   Literalimport;
2. App-Alias, relative Traversierung, Workspace-Name und Workspace-Subpath;
3. auskommentierte Imports und gleichlautende UI-Texte als Nichttreffer;
4. zusammengesetzte nichtliterale dynamische Imports als sicherer Fehler;
5. Windows- und POSIX-Pfadtrenner, Route Groups und Symlink-Ausbruch;
6. direkte und transitive Brain-Abhängigkeit sowie App-Dateilesen aus einem
   Package.

Die Ausgabe wird deterministisch nach Regel-ID, Quelldatei und Ziel sortiert.
Der Guard verändert im normalen Modus keine Datei.

## 5. Route-Guards und `AppAudience`

### 5.1 Verankerung in `route-policy.ts`

`packages/auth/src/security/route-policy.ts` bleibt die Runtime-Quelle für
Route-Security. `UweAppSurface` beschreibt weiterhin den physischen Host; die
neue `AppAudience` beschreibt den fachlichen Verbraucher. Beides darf nicht
gleichgesetzt werden, weil Brain- und Platform-Routen vorübergehend unter
`apps/studio` liegen.

Der Zielaufbau ist:

- `RouteClassification` erhält `audience: AppAudience | null` und
  `unknownRoute: boolean` zusätzlich zu `access`, `unknownApi` und `pathname`.
- `ROUTE_AUDIENCE_RULES` enthält literale, normalisierte Regeln mit
  `surface`, `pattern` und `audience`. `AppAudience` kommt aus dem von O02
  vorgesehenen `@uwe/product-contracts/audience`-Subpath.
- Exakte Muster schlagen Präfixmuster; danach gewinnt das längste Präfix.
  Gleich spezifische widersprüchliche Treffer sind ein CI-Fehler.
- Es gibt keinen produktiven Catch-all, der neue Dateien still als Studio oder
  Portal einordnet. Unbekannte Routen bleiben geschützt, erhalten
  `audience: null` und werden deny-by-default abgewiesen.
- Der Node-Guard leitet aus jeder vorhandenen `page.tsx` und `route.ts` die
  Next-URL ab, entfernt Route Groups und verlangt genau eine eindeutige
  Klassifikation nach der Präzedenzregel. Der Inventarstand von 409 Routen wird
  bei der Ersteinführung abgeglichen, aber nicht als dauerhaft starre Zahl
  codiert.

`access` und `audience` lösen verschiedene Fragen: Eine öffentliche Login- oder
Health-Route kann `audience: "platform"` haben; eine geschützte Brain-Route
braucht zusätzlich Owner und Local-/LAN-Exposure. Vorhandene Wrapper wie
`requiresStudioAuth` bleiben zunächst kompatibel, delegieren aber an die neue
Klassifikation.

### 5.2 Heutige Studio-Routen mit späterer Brain-Audience

Die folgenden Routen bleiben in dieser Welle physisch unverändert. Sie werden
nur mit `audience: "brain"` gekennzeichnet.

**Seiten**

- `/today`;
- `/capture` und `/capture/*`;
- `/continue`, `/search` und `/knowledge`;
- `/life-brain` und `/life-brain/*`;
- `/calendar`, `/contracts`, `/documents`, `/finance`, `/hardware` und
  `/household`;
- `/kitchen` und `/kitchen/*`;
- `/mail` und `/mail/*`;
- `/miniatures`;
- `/projects` und `/projects/*`;
- `/scan-inbox` und `/scan-inbox/*`;
- `/workshop` und `/workshop/*`;
- `/admin/cockpit` und `/admin/cookbook`.

**APIs**

- `/api/calendar`, `/api/capture`, `/api/documents`, `/api/kitchen`,
  `/api/life-brain`, `/api/mail`, `/api/miniatures`, `/api/projects`,
  `/api/scan` und `/api/workshop`, jeweils einschließlich `/*`;
- `/api/internal/briefing` und `/api/internal/mail-sync`;
- `/api/admin/cockpit`, `/api/admin/cookbook` und `/api/admin/mail`, jeweils
  einschließlich `/*`.

Die gemischten Nähte `/api/ai/*`, `/api/import/*`, `/api/image-studio/*`,
`/api/research/*` und produktgemischte Job-Payloads werden noch nicht pauschal
Brain. Ihre heutigen Studio-/Platform-Routen dürfen `personal_brain` oder
`admin_life` nach Aktivierung des Guards nur über einen separat klassifizierten
Brain-Adapter beziehungsweise opaque Handle erreichen. O05 trennt diese
Adapter vor dem Verschieben der Routen.

### 5.3 Route-Akzeptanzkriterien

- Jede existierende Studio-, Portal- und spätere Brain-Seite/API hat genau eine
  aufgelöste `AppAudience`; eine neue unklassifizierte Route macht CI rot.
- Alle oben genannten Muster ergeben `brain`, ohne die URL oder Datei zu
  verschieben. `/brain` und `/worlds/*/brain` ergeben weiterhin `studio`.
- Portal-Routen können niemals `personal_brain` oder `admin_life` anfordern.
- Eine Portal- oder Studio-Session gegen eine geschützte Brain-Route wird
  abgewiesen; `brain` benötigt zusätzlich Rolle `owner` und den Exposure-Guard.
- Öffentliche Platform-Routen behalten ihren heutigen Public-Status. Audience-
  Einführung darf Login, Callback und Health nicht versehentlich schützen oder
  öffnen.
- Tests enthalten unbekannte Pfade, Präfixkollisionen, Route Groups,
  dynamische Segmente und Replay einer falschen Audience.

## 6. Dependency-Guards auf `package.json`-Ebene

Der Guard liest alle Workspace-Manifeste selbst, baut `Paketname -> Pfad`,
klassifiziert jeden Knoten nach Abschnitt 3.1 und prüft `dependencies`,
`optionalDependencies`, `peerDependencies` und `devDependencies`. Externe
Pakete werden nicht klassifiziert. Workspace-Kanten werden zusätzlich transitiv
verfolgt; ein erlaubtes Shared-Paket darf Brain nicht als Hintertür einführen.

### 6.1 Kantenregeln

| Verbraucher | Erlaubte Workspace-Ziele | Verbot |
|---|---|---|
| Portal-App und Portal-Pakete | Portal, Shared Engines und ausdrücklich freigegebene Platform-Ports | Jede direkte oder transitive Brain-Abhängigkeit; Studio-Fachpakete; ungefilterte private DB-Ports |
| `@uwe/static-export` | Portal-Projektion, datenquellenneutrale Renderer und freigegebene D&D-Read-Ports | Brain-Pakete, Brain-private Subpaths und `owner_private_local`/`dm_only`-Rohmodelle |
| Studio | Studio, Shared Engines und freigegebene Platform-Ports; Portal nur über explizite Preview-/Export-Ports | Brain-private Module aus `audience: "studio"`; generische Portal-Repositories |
| Brain | Brain, Shared Engines und freigegebene Platform-Ports | Portal-/Studio-Fachpakete; D&D- oder Portal-Repositories |
| Shared Engines | Shared Engines und reine Contract-/Security-/Config-Ports | Produktpakete, App-Code, Prisma-/DB-Clients und private Stores |
| Platform | Platform, Shared Engines und opaque Produktports | Fachliche Produktrepositories oder private Payload-Interpretation |

`apps/studio/package.json` ist bis zur physischen Brain-App ein dokumentierter
Mixed-Host-Sonderfall: Die vier Brain-Pakete dürfen dort vorübergehend als
Dependencies stehen, aber nur Brain-klassifizierte Route-/Adapterdateien dürfen
sie importieren. Sobald `apps/brain` existiert, wird diese Ausnahme entfernt;
das Ratchet darf sie nie neu hinzufügen oder ausweiten.

`personal_brain`-Services erhalten einen zusätzlichen harten Guard:

1. Anbieter werden über explizite Brain-Subpaths/Exports markiert.
2. Nur Dateien mit aufgelöster `audience: "brain"` oder interne Brain-Pakete
   dürfen diese Exporte importieren.
3. Shared Engines erhalten stattdessen datenminimierte Ports als Parameter;
   Platform sieht nur opaque Handles und Lifecycle-Metadaten.
4. Portal und Static Export dürfen auch transitiv keinen solchen Anbieter
   erreichen.

Damit bleibt ein Paketgraph-Check allein nicht die Sicherheitsbehauptung: Das
heute gemischte `@uwe/database` wird zusätzlich auf private Subpaths und
benannte Exporte geprüft, bis O05 es trennt.

### 6.2 Dependency-Akzeptanzkriterien

- Eine Fixture mit `apps/portal -> @uwe/mail`,
  `@uwe/static-export -> @uwe/scan-inbox` oder Portal -> Shared -> Brain
  schlägt fehl.
- `apps/brain -> @uwe/shared-ui` und ein enger
  `@uwe/product-contracts/audience`-Import bestehen.
- Brain-private DB-/AI-Exports sind aus Portal, Studio-Audience, Platform und
  Shared Engines nicht importierbar.
- Ein neues Workspace-Paket ohne Klassifikation schlägt fehl.
- Alle vier Dependency-Sektionen und Package-Subpaths werden geprüft; eine
  Verschiebung nach `devDependencies` umgeht den Guard nicht.

## 7. CI-Integration, Ausgabe und Ratchet

### 7.1 Position im Gate

In `.github/workflows/pr-check.yml` erhält `fast-checks` direkt nach
`File size budget (fail fast, no install)` und vor `pnpm/action-setup` einen
Schritt:

```yaml
- name: Product boundary guards (fail fast, no install)
  if: needs.detect-changes.outputs.code == 'true'
  run: node scripts/product-boundary-check.mjs
```

Damit prüft ein sauberer GitHub-Checkout die Grenzen ohne Cache und ohne
Install. Der Root erhält `boundaries:check`. `pnpm test`, `pnpm test:ci` und
`pnpm test:ci:affected` rufen denselben Check auf, damit der Guard auch außerhalb
des PR-Workflows und im `main`-Quality-Gate läuft. Turbo braucht keine neue
Task: Der Guard ist bewusst repositoryweit und läuft einmal im Root.

### 7.2 Fehlermeldungen

Das Format ist kurz, stabil und maschinenlesbar:

```text
product-boundary: 2 violation(s)
[IMP_CROSS_APP] apps/portal/src/example.ts:4 -> apps/studio/src/private.ts
  portal code must not import studio app code
[DEP_BRAIN_TO_PORTAL] apps/portal/package.json dependencies[@uwe/mail]
  portal/static-export must not depend on a Brain package
product-boundary: FAILED
```

Bei Erfolg lautet die einzige Zusammenfassung beispielsweise:

```text
product-boundary: OK (409 routes, 38 workspaces, 0 new violations)
```

Die tatsächlichen Zähler werden aus dem Checkout ermittelt. Meldungen enthalten
Regel-ID, Quelle, Ziel, bei Imports die Zeile und eine konkrete Remediation.
Keine Meldung druckt Dateiinhalt, Payloads, Konfigurationseinträge oder private
Werte.

### 7.3 Baseline und Ratchet

`scripts/product-boundary-baseline.json` speichert ausschließlich bei der
Ersteinführung auditierte Bestandsverstöße als stabile Fingerprints aus
`ruleId`, Quellpfad, Ziel/Specifier und optional Exportname sowie deren Anzahl.
Zeilennummern gehören nicht zum Fingerprint. Portal-zu-Brain-Verstöße,
unklassifizierte Routen und neue Cross-App-Imports sind nicht baselinefähig.

Normalmodus:

- Ein nicht in der Baseline vorhandener Fingerprint oder eine höhere Anzahl
  schlägt fehl.
- Fehlende/stale Baseline-Einträge schlagen ebenfalls fehl und verlangen das
  Ratchet, damit die Baseline nicht heimlich veraltet.
- Ein verschobener Verstoß ist ein neuer Fingerprint und schlägt fehl; er gilt
  nicht als berechtigte Verlagerung.

`node scripts/product-boundary-check.mjs --ratchet` darf nur vorhandene Counts
senken und verschwundene Einträge entfernen. Es darf nie einen Fingerprint
hinzufügen, einen Count erhöhen oder eine nicht baselinefähige Regel
aufnehmen. Die initiale Baseline wird einmalig im Implementierungs-PR aus einer
manuell geprüften Liste erstellt, nicht durch einen dauerhaft verfügbaren
Bootstrap-Schalter. Tests beweisen diese Monotonie.

## 8. Implementierungswelle und Aufwand

| Welle | Inhalt | Aufwand | Akzeptanz |
|---|---|---:|---|
| 1. Regeln und Fixtures | Paketklassifikation, Edge-Matrix, Lexer-Fixtures und bekannte Bestandsbefunde festschreiben | 1 Tag | O00/O02-Namen sind exakt; unbekannte Klasse und alle Negativfixtures schlagen deterministisch fehl. |
| 2. Zero-Dependency-Scanner | Import-/Re-Export-/Pfadscanner, Workspace-Graph, CLI und Ratchet | 2–3 Tage | Ohne Installation unter fünf Sekunden; keine Änderungen im Check-Modus; Windows/Linux-Pfade liefern dieselben Fingerprints. |
| 3. Route-Audience | `AppAudience`-Contract anbinden, Route-Regeln in `route-policy.ts`, alle heutigen Routen annotieren und Coverage-/Replay-Tests ergänzen | 2–3 Tage | Jede gefundene Route ist eindeutig; Brain-Liste aus Abschnitt 5.2 ist markiert; URLs und Dateien bleiben unverändert; unknown bleibt deny-by-default. |
| 4. Private Ports und Manifestregeln | Brain-private Übergangsmap, Symboltests für das DB-Barrel, direkte/transitive Manifestprüfung | 2 Tage | Portal/Static Export erreichen Brain weder direkt noch transitiv; `personal_brain` ist nur aus Brain-Audience-Code nutzbar. |
| 5. CI und ESLint-Spiegel | Pre-Install-Schritt, Root-Skripte, optionale abgeleitete ESLint-Regeln, Ausgabe-Dokumentation | 1 Tag | PR-Gate scheitert vor Install; `pnpm test` führt denselben Guard aus; ESLint und Node-Regeln verwenden dieselbe Klassifikationsquelle. |
| 6. Ratchet-Cleanup | Bestandsverstöße in O05-Paketschnitten abbauen | fortlaufend | Jeder Cleanup senkt oder entfernt Baseline-Einträge; keine Welle erhöht sie. |

Gesamtschätzung bis zum aktivierten Guard: acht bis zehn Entwicklertage,
zuzüglich der fachlichen Extraktionen in O05. Route-Audience-Metadaten werden
vor Runtime-Enforcement vollständig eingeführt. Erst wenn Session-Audience,
Owner- und Exposure-Prüfung verfügbar sind, wird die Ablehnung falscher
Audiences aktiviert; Metadaten-Coverage und Importverbote können vorher grün
geschaltet werden.

## 9. Übergabe an O05

O05 sollte in dieser Reihenfolge integrieren:

1. `@uwe/product-contracts` mit den unveränderten O02-Wertelisten und kleinen
   Subpath-Exports anlegen; keine breite Barrel-Erweiterung in Database.
2. Portal-Projektionen und Brain-Repositories als getrennte Ports exportieren.
   Portal/Static Export dürfen kein generisches Prisma-Repository erhalten.
3. Brain-private Teile aus `@uwe/ai-brain` in einen Brain-Adapter verschieben;
   der Shared-Engine-Kern erhält minimale Inputs und speichert nichts Privates.
4. Portal-CSS/Renderer aus `apps/portal` in ein Portal- oder Shared-Paket
   verschieben, bevor `IMP_PACKAGE_TO_APP` aus der Baseline entfernt wird.
5. Cookbook-Capability-Typen von der privaten Brain-Verwaltung trennen, damit
   AI-Engine und RTX-Connector nur den neutralen Capability-Port nutzen.
6. Die Mixed-Host-Ausnahme von `apps/studio` erst nach Aufbau von `apps/brain`
   entfernen. Bis dahin entscheidet die Route-/Adapter-Audience über private
   Imports.
7. Nach jeder Extraktion `--ratchet` ausführen und den kleineren Baseline-Diff
   gemeinsam mit den neuen Negativtests reviewen.

## 10. Risiken und erwartete Bestandsverstöße

Bei Aktivierung sind mindestens folgende Befunde zu erwarten:

- `packages/static-export/src/assets.ts` liest
  `apps/portal/app/wiki.css` direkt. Das ist der bekannte Package-zu-App-
  Rückwärtszugriff aus O00.
- `@uwe/ai-brain` ist als Shared Engine klassifiziert, hängt heute aber von
  `@uwe/cookbook` ab und importiert Cookbook-Code. Außerdem liegen
  Personal-Brain-Indexer/-Suche und private Kontextadapter im selben Paket.
- `tools/uwe-rtx-connector` ist Platform, hängt aber direkt von
  `@uwe/cookbook` ab. Neutrale Capability-Typen müssen aus dem Brain-Paket
  herausgelöst werden.
- `apps/studio` hängt direkt von allen vier Brain-Paketen ab. Das ist während
  des Mixed-Host-Zustands nur für die in Abschnitt 5.2 klassifizierten
  Brain-Routen/Adapter zulässig und muss nach `apps/brain` verschwinden.
- `@uwe/database/server` exportiert D&D-, Portal-, Platform- und private
  Brain-Services gemeinsam. Portal und Shared Engines verwenden das breite
  Barrel heute vielfach. Der Guard kann bekannte private Exporte sperren,
  vollständige strukturelle Sicherheit entsteht aber erst mit O05-Subpaths und
  getrennten Repository-Ports.
- `/api/ai`, Import, Image Studio, Research und Jobs tragen gemischte
  Context-/Target-Payloads. Eine bloße Route-Audience darf diese fachliche Naht
  nicht verdecken; getrennte Adapter und Contracts sind Voraussetzung für das
  spätere Runtime-Enforcement.

Weitere Risiken sind Lexer-False-Positives bei Pfadtexten, unerkannte
berechnete Modulziele, Regel-/ESLint-Drift und überbreite Ausnahmen. Dagegen
stehen Parser-Negativtests, die harte Behandlung nichtliteraler dynamischer
Imports in sensiblen Bäumen, eine einzige Klassifikationsquelle, kleine
begründete Ausnahmen und das monotone Ratchet. OAuth-, Callback- und
Konfigurationsvokabular in Tests/Dokumentation darf nicht zu echten Werten oder
geloggten Inhalten führen; Security-Scanner-Befunde werden anhand der konkreten
Zeile geprüft, nicht durch Lockerung der Produktgrenzen umgangen.
