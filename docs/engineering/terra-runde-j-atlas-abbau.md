# Terra Runde J — Inventar für den Atlas-Abbau

> **ERLEDIGT (27.07.2026).** Der hier inventarisierte Abbau ist durchgeführt;
> Atlas 3D existiert nicht mehr. Das Dokument bleibt als Protokoll stehen: es
> hält fest, WAS es gab, WORAN es hing und WARUM einzelne Dinge (die
> Frame-Direktiven in `security-headers.ts`, die Prompt-Dateien unter
> `docs/prompts/atlas-*`, der Asset-Katalog) bewusst stehen geblieben sind.
> `packages/backup` verweist im Code auf Vorabbefund 1.
>
> Abweichungen von der hier vorgeschlagenen Reihenfolge: die Pfade heissen
> heute `/karten` statt `/atlas3d` (Schritt 4 ging weiter als geplant), die
> Brain-Actions (Schritt 9) und `packages/atlas` (Schritt 10) blieben
> ausgeklammert — sie gehören einem anderen Arbeitsstrang.

Aufklärungsstand 27.07.2026. Worktree `C:\git\UWE-terra`, Branch
`claude/terra-runde-h`, HEAD `1772e842`. **Reines Inventar — an diesem Bericht
wurde keine einzige Zeile Code geändert.**

Grundlage: `docs/engineering/terra-runde-j-uwe.md`, Abschnitte J1 und J2.

---

## ⚠️ Vorab: Zwei Befunde, die vor jedem Löschen bekannt sein müssen

### 1. Das Backup-Problem ist bestätigt — Löschen ist unumkehrbar

`packages/backup` kennt **kein einziges** Atlas-Modell. Es gibt keinen
generischen Weg, der sie doch mitnähme:

- `packages/backup/src/types.ts:523-548` — `interface BackupData` listet 22
  Sektionen namentlich. Keine davon ist Atlas.
- `packages/backup/src/collect.ts` — hartkodierte `db.<model>.findMany()`-Aufrufe
  (Zeilen 302, 306, 329, 368, 378, 389, 404, 425, 431-442, 451-581). Kein Atlas.
- `packages/backup/src/restore.ts` schreibt in genau dieselben 22 Modelle.
- Kein DMMF-Durchlauf, kein `$queryRaw` auf `sqlite_master`, keine dynamische
  Modell-Enumeration — gezielt gesucht, null Treffer.
- `docs/backup-restore.md:9-27` („Was wird gesichert?") führt Atlas nicht auf,
  weder als „Ja" noch als „Nein".

**Warum das nie aufgefallen ist:** Der einzige Vollständigkeitstest im Repo,
`packages/backup/src/brain-export.test.ts:9-21` über
`brainExportCoversContract()` (`brain-export.ts:113-118`), bewacht **nur** die
Brain-DB. Er vergleicht gegen `BRAIN_MODEL_NAMES`, und das ist per Definition
(`packages/product-contracts/src/prisma-model-boundaries.ts:205-209`) auf
`targetDatabase === "uwe-brain.db"` gefiltert. Die Atlas-Modelle liegen in
`uwe.db` (`prisma-model-boundaries.ts:166-171`) und fallen konstruktionsbedingt
heraus. Für die 97 Modelle in `uwe.db` — von denen nur 22 gesichert werden —
existiert kein Analogon.

**Konsequenz:** `pnpm backup:create` sichert Atlas-Inhalte nicht.
Der einzige Weg, der Atlas-Daten erhält, ist ein **roher Dateisnapshot** der
SQLite-Datei (`deploy/scripts/uwe-backup.sh`, vgl. `docs/backup-restore.md:45-48`).
Das deckt sich mit der Notiz „UWE-Backup ist ein logischer Export".

Vor Schritt 6 der Reihenfolge (Prisma-Drop) müssen also
`uwe.db`, `uwe.db-wal` und `uwe.db-shm` von Hand kopiert werden — der logische
Export reicht nicht.

**Entwarnung im konkreten Fall:** In der Live-DB stehen ohnehin nur
Demo-Seed-Daten (siehe Abschnitt 3.2). Der Verlust ist real, aber winzig.

### 2. Schema-Drift SQLite ↔ Postgres

`packages/database/prisma/migrations-postgresql/` enthält **weder**
`20260721120000_atlas3d_foundation` **noch** `20260721150000_drop_legacy_atlas`.
Es legt weiterhin die fünf **alten 2D**-Tabellen an
(`migrations-postgresql/20260701220000_sync_sqlite_waves/migration.sql:653-729`)
plus fünf Enums (`:71-83`), während `schema.postgresql.prisma:2569-2695` die
Atlas-**3D**-Modelle beschreibt. Kein Test liest
`schema.postgresql.prisma` (`prisma-model-boundaries.sync.test.ts:17-22` liest
nur `schema.prisma` + `brain/schema.prisma`), und `scripts/migration-check.mjs:12`
prüft nur den SQLite-Ordner — und warnt dort nur, statt zu scheitern (`:56-62`).

Für den Abbau heißt das: Die Drop-Migration muss in **beiden** Ordnern angelegt
werden, und der Postgres-Ordner braucht dabei die 2D-Reste gleich mit. Wer nur
den SQLite-Pfad bedient, vergrößert die Drift.

---

# 1. Code

## 1.1 Eindeutig Atlas-3D — löschbar

| Pfad | Dateien | Zeilen | Anmerkung |
|---|---:|---:|---|
| `packages/atlas-3d/` | 88 | 12.602 | komplettes Paket inkl. 30 Testdateien |
| `packages/atlas-editor/` | 12 | 1.302 | Doc, Commands, Carve, Geometry, Inheritance |
| `apps/studio/src/components/atlas3d/` | 11 | 2.570 | UI + `atlas3d.css` (373 Z.) |
| `apps/portal/src/components/atlas3d/` | 3 | 189 | Viewer + Lazy + CSS |
| `apps/studio/app/atlas3d-actions.ts` | 1 | 401 | 8 Server Actions |
| `packages/database/src/atlas3d-service.ts` | 1 | 440 | Service |
| `packages/database/src/atlas3d-service.test.ts` | 1 | 211 | |
| Routen Studio | 2 | 204 | `atlas3d/page.tsx` 24, `atlas3d/[nodeId]/page.tsx` 180 |
| Routen Portal | 2 | 203 | `atlas3d/page.tsx` 76, `atlas3d/[nodeId]/page.tsx` 127 |
| Legacy-Redirects (2D) | 2 | 22 | `worlds/[slug]/atlas/page.tsx`, `auth/worlds/[slug]/atlas/page.tsx` |
| `e2e/studio-atlas3d.spec.ts`, `e2e/portal-atlas3d.spec.ts` | 2 | 170 | |
| `scripts/atlas3d-demo-seed.ts` | 1 | 99 | |
| **Summe Kern** | **126** | **18.413** | |
| Docs (`docs/**/atlas*`, `terra-uebernahmen-aus-atlas.md`) | 24 | ~5.605 | siehe 2.9 |
| **Gesamt** | **150** | **~24.018** | |

Die Planung nannte „86 Dateien, ~12.500 Zeilen" für `packages/atlas-3d` — gemessen
sind es 88 / 12.602. `packages/atlas-editor` wurde mit „10 Dateien, ~1.270 Z."
angesetzt, gemessen 12 / 1.302. Beide Abweichungen sind harmlos.

## 1.2 Der große Fund: `packages/atlas` — das *2D*-Paket lebt noch

Die Planung erwähnt es nicht. Es liegt aber vollständig im Repo:

**`packages/atlas/` — 78 Dateien, 16.244 Zeilen** (43 Nicht-Test-Module,
33 Testdateien, 37 Subpath-Exports in `packages/atlas/package.json:8-46`).

Der 2D-Atlas wurde am 21.07.2026 abgeschaltet (Commits `a527271d` „Phase 5a",
`55140ef2` „Phase 5b") — **die UI und die Tabellen wurden entfernt, das Paket
nicht.** Es ist heute zu rund 70 % toter Code: nur 13 von 43 Modulen sind über
einen echten Importpfad erreichbar. Der Root-Export `index.ts` (371 Z.) hat
keinen einzigen Importeur.

Tatsächlich benutzt werden **3 von 37 Exports**:

| Export | Zeilen | Konsument |
|---|---:|---|
| `./elevation` | 412 | `packages/atlas-3d`: `atlas3d.ts:1`, `billboards.ts:1`, `heightfield.ts:1`, `picking.ts:1`, `scene.ts:1`, `types.ts:1` |
| `./plot-fill-proposal` | 380 | `packages/ai-brain/src/proposals.ts:1` |
| `./rtx-asset-proposal` | 693 | `packages/ai-brain/src/proposals.ts:2`, `packages/ai-brain/src/tasks.ts:1` |

**Das ist die Warnung, um die gebeten wurde.** Die letzte Abschaltung hat ein
16.000-Zeilen-Paket liegengelassen, dessen 33 Testdateien seither in jeder CI
mitlaufen und toten Code zementieren. Nach dem Atlas-3D-Abbau bleibt von
`packages/atlas` nur noch, was `ai-brain` braucht — `elevation.ts` verliert
seinen einzigen Konsumenten mit. **Empfehlung: `packages/atlas` im selben Zug
mit erledigen**, sonst wiederholt sich die Geschichte ein zweites Mal.

## 1.3 Gemeinsam genutzter Code — der gefährliche Teil

Jeder Kandidat einzeln nachgeprüft, nicht nach Namen beurteilt.

### (a) `packages/atlas-editor` → **doch eindeutig Atlas**

Klingt nach einem generischen Editor-Kern (Geometrie, Undo/Redo, CSG-Carve) und
wäre der naheliegendste Kandidat für „das braucht noch jemand". Ist es aber
nicht: `git grep "@uwe/atlas-editor"` liefert **ausschließlich**
Atlas-Konsumenten — `packages/atlas-3d` (12 Importe),
`apps/studio/app/atlas3d-actions.ts:6,7,13`,
`apps/studio/src/components/atlas3d/Atlas3DEditorShell.tsx:6`,
`apps/portal/app/auth/worlds/[worldSlug]/atlas3d/[nodeId]/page.tsx:6,7`.
Keine Nutzung außerhalb. **Löschbar.**

### (b) `packages/atlas/src/elevation.ts` (412 Z.) → **löschbar, aber erst nach atlas-3d**

Einziger externer Konsument ist `packages/atlas-3d`. Fällt Atlas-3D, fällt
`elevation.ts` mit. Wichtig für die Reihenfolge: Paket-Löschung **nach**
Atlas-3D, sonst bricht der Build.

### (c) `packages/atlas/src/plot-fill-proposal.ts` + `rtx-asset-proposal.ts` → **NICHT löschen (jetzt)**

Diese beiden sind **live in Benutzung von `packages/ai-brain`** und haben nichts
mit Atlas-3D zu tun — sie bedienen den 2D-Weltenbauer bzw. den RTX-Asset-Pfad.
Wer `packages/atlas` blind löscht, bricht Brain. Siehe Abschnitt 6.

### (d) `AtlasNodeLevel` (Prisma-Enum) → **gemeinsam benutzt, aber nur von Atlas**

`packages/database/prisma/schema.prisma:2582-2587` (`globe | continent |
landscape | city`). Stammt aus dem 2D-Atlas und **überlebte die Drop-Migration
bewusst**, weil `Atlas3DNode.level` (`schema.prisma:2613`) es weiterverwendet.
Es gibt einen öffentlichen Re-Export:
`packages/database/src/server.ts:2211` — `export type { AtlasNodeLevel } from
"./generated/prisma/client";` (laut Commit-Message „für Bestandsimporte").
Geprüft: **Niemand außerhalb von Atlas importiert ihn.** Löschbar — aber der
Re-Export im Barrel muss mit weg, sonst bricht `server.ts` beim Typecheck.

Achtung Duplikat: `packages/atlas/src/constants.ts:11,22-29` definiert dieselben
vier Werte nochmal als TS-Konstante mit dem Kommentar „Keep in sync with the
schema enums." (`:7`).

### (e) `SpriteAtlasAllocator` → **Namenskollision, aber trotzdem Atlas-Paket**

`packages/atlas-3d/src/sprite-atlas.ts:11` ist ein Textur-Atlas-Allokator
(Grafikbegriff), benutzt von `billboards.ts:4,23`. Der *Name* kollidiert, die
*Zugehörigkeit* nicht — die Datei liegt im Paket und fällt mit weg.

### (f) `terra/src/world/vfx.js` → **reine Namenskollision, NICHT anfassen**

12 Treffer auf „Atlas", alle Textur-Atlas: `:43` „Texturatlas: zwei 128er-Zellen
…", `:85` `function baueAtlas()`, `:101` `const VFX_ATLAS = baueAtlas();`,
`:381`/`:402` `map: VFX_ATLAS`. Gehört Terra, hat mit Atlas-3D nichts zu tun.

### (g) „W0 Atlas Policy" → **reine Namenskollision, NICHT anfassen**

Codename der KI-Privacy-Routing-Policy, benannt nach dem 2D-Meilenstein:
`SECURITY.md:190`, `SECURITY_NOTES.md:6`,
`.cursor/skills/local-first-privacy/SKILL.md:16`,
`docs/ai-privacy-and-cloud-fallback.md:3`. Wer hier „aufräumt", zerlegt die
Privacy-Dokumentation.

### (h) `packages/shared-ui/src/scene/scenePools.ts:46,70` → **Namenskollision**

„weltenbau**m**-stadt" (Szenenbild-Dateiname), kollidiert nur mit einer
`weltenbau`-Suche. Ebenso `pickScene.test.ts:95`.

---

# 2. Verweise von außen

## 2.1 Navigation (4 Dateien + 2 Testdateien)

| Ort | Zeile | Inhalt |
|---|---|---|
| `apps/studio/src/navigation/world-nav.ts` | 70-80 | `item("world-atlas3d", "Atlas 3D", \`${base}/atlas3d\`, "globe", "Wiki", ["atlas 3d","atlas","karte","map","weltkarte","globus","planet","3d","weltenbau"])` |
| `apps/studio/src/navigation/world-nav.ts` | 255 | Rollen pauschal `["owner","admin","dm"]` (kein Atlas-Sonderfall, kein Feature-Flag) |
| `apps/studio/src/lib/studio-navigation.ts` | 32 | `"world-atlas3d"` in `highlightIds` der DM-Tool-Quicklinks |
| `apps/studio/src/lib/studio-navigation.ts` | 62 | `\| "atlas"` im Union-Typ `WorldNavKey` |
| `apps/studio/src/lib/studio-navigation.ts` | 142 | `{ key: "atlas", label: "Atlas 3D", href: \`${base}/atlas3d\` }` — drei Schreibweisen in einer Zeile |
| `apps/studio/src/lib/studio-navigation.ts` | 174 | `active === "atlas"` → Bottom-Tab `"content"` |
| `apps/studio/src/lib/studio-navigation.ts` | **302** | `if (normalized.startsWith(\`${base}/atlas\`)) return "atlas";` — **Präfix-Match, fängt `/atlas` UND `/atlas3d`** |
| `apps/portal/src/navigation/portal-nav.ts` | 121-129 | `worldItem("portal-world-atlas3d", "Atlas 3D", …, "globe", …)` |
| `apps/portal/src/navigation/portal-nav.ts` | 149 | Rollen `["player","dm","admin","owner","readonly"]` |
| `apps/portal/src/lib/mobile-nav.ts` | 22, 65 | Kommentar + `"atlas3d"` in `WORLD_DRAWER_SECTIONS` |
| `apps/portal/src/navigation/portal-nav.test.ts` | 70, 95-100 | Assertions auf `/auth/worlds/terra/atlas3d` |
| `apps/portal/src/lib/mobile-nav.test.ts` | 75, 80 | Testname + Pfad in der Drawer-Liste |

Kein Feature-Flag, keine Umgebungsvariable steuert Atlas — geprüft.

**Beschriftung:** Alle drei sichtbaren Labels lauten `"Atlas 3D"`. Nach J1 sollen
sie auf „Karten" wechseln.

## 2.2 Routen und Redirects

- `apps/studio/app/worlds/[worldSlug]/atlas/page.tsx:7-11` — 2D-Redirect →
  `/worlds/${worldSlug}/atlas3d`
- `apps/portal/app/auth/worlds/[worldSlug]/atlas/page.tsx:10` — analog
- `apps/studio/app/worlds/[worldSlug]/atlas3d/page.tsx:21-23` —
  `getOrCreateForWorld(worldSlug)` und `redirect(…/${rootNode.id})`.
  **Seiteneffekt: Der bloße Aufruf der Indexseite legt Atlas-Daten in der DB an.**
  Das erklärt, warum in der Live-DB Atlas-Zeilen stehen, obwohl niemand bewusst
  eine Welt gebaut hat.
- Der zentrale Mechanismus `resolveLegacyPathRedirect`
  (`packages/auth/src/legacy-path-redirects.ts`, benutzt in
  `apps/studio/middleware.ts:68`, `apps/portal/middleware.ts:34`) enthält
  **keinen** Atlas-Eintrag. Die Alt-Link-Umleitung läuft ausschließlich über die
  beiden `atlas/page.tsx`.
- `apps/studio/next.config.ts` / `apps/portal/next.config.ts` haben **keine**
  `redirects()`.

## 2.3 Middleware / Allowlists

- `apps/studio/middleware.ts:216-220` — im Matcher-Negativ-Lookahead steht
  `atlas/`:
  `"/((?!_next/static|_next/image|favicon.ico|atlas/|.*\\.(?:svg|png|…)$).*)"`.
  Der zugehörige Pfad `apps/studio/public/atlas/` **existiert nicht mehr** →
  toter Eintrag aus der 2D-Zeit.
- `apps/studio/middleware.ts:16-30` (`PUBLIC_PATH_PREFIXES`) enthält keinen
  Atlas-Pfad — Atlas-Routen sind auth-pflichtig.
- `apps/portal/middleware.ts:154-169` — kein Atlas-Eintrag; generisch über
  `"/auth/:path*"` (`:164`).

## 2.4 Build / Bundling

- `apps/portal/next.config.ts:17` —
  `transpilePackages: ["@uwe/shared-ui","@uwe/auth","@uwe/env","@uwe/atlas-3d"]`.
  Einziger Atlas-Eintrag in einer `next.config`. Studio listet ihn nicht (lädt
  über `Atlas3DEditorLazy`).
- `eslint.config.mjs:38` — `"**/atlas-3d.js"` in `ignores`. **Die Datei existiert
  nicht** → toter Eintrag.
- `apps/studio/.gitignore:1-2` — `/public/atlas/` mit Kommentar
  „copied from @uwe/static-export on predev/prebuild (copy:atlas)". Weder das
  Skript noch der Ordner existieren → stale.
- `scripts/materialize-standalone-prisma-deps.mjs:92-93` — nur Kommentare über
  den alten Atlas-iframe.
- `turbo.json`, `playwright.config.ts`, `.github/workflows/*` — **keine**
  Atlas-Treffer. Die e2e-Specs werden über `testMatch: /studio-.*\.spec\.ts/`
  bzw. `/portal-.*\.spec\.ts/` (`playwright.config.ts:18,26`) implizit erfasst.

## 2.5 package.json / Workspace / tsconfig

| Datei:Zeile | Eintrag | Status |
|---|---|---|
| `apps/studio/package.json:30` | `"@uwe/atlas": "workspace:*"` | **verwaist** — Studio importiert `@uwe/atlas` nirgends |
| `apps/studio/package.json:71-72` | `@uwe/atlas-editor`, `@uwe/atlas-3d` | echt |
| `apps/portal/package.json:25` | `"@uwe/atlas"` | **verwaist** |
| `apps/portal/package.json:26,48` | `@uwe/atlas-3d`, `@uwe/atlas-editor` | echt |
| `packages/database/package.json:89` | `"@uwe/atlas"` | **verwaist** — nur zwei Kommentare in `atlas3d-service.ts:15,124` |
| `packages/database/package.json:18` | `"./atlas3d": "./src/atlas3d-service.ts"` | Export-Map |
| `packages/ai-brain/package.json:27` | `"@uwe/atlas"` | **echt und lebenswichtig** |
| `packages/atlas-3d/package.json:56,58` | `@uwe/atlas`, `@uwe/atlas-editor` | echt |
| `pnpm-workspace.yaml:2-3` | Globs `apps/*`, `packages/*` | keine Einzeleinträge — Löschen der Ordner genügt |
| `three@0.178.0` | `packages/atlas-3d/package.json` | entfällt mit dem Paket (Terra nutzt 0.185.1 über CDN) |

`tsconfig`: `packages/atlas-3d/tsconfig.json` (8 Z.) und
`packages/atlas-editor/tsconfig.json` (9 Z.) sind eigenständig; **keine
Pfad-Aliase auf Atlas** in einer übergeordneten tsconfig gefunden.

## 2.6 Rechte- und Rollenprüfungen

Es gibt **keine Atlas-spezifische Rechtelogik** — Atlas hängt vollständig an den
generischen Studio-/Portal-Guards. Das ist für J1 die gute Nachricht.

**Studio (Schreiben)** — jede der 8 Server Actions in `atlas3d-actions.ts` ruft
dasselbe Trio auf (`:48-50`, `:166-168`, `:225-227`, `:253-255`, `:297-299`,
`:318-320`, `:343-345`, `:364-366`, `:384-386`):

```ts
await requireStudioActionAuth();                    // CSRF/Origin
const worldSlug = String(formData.get("worldSlug"));
await requireStudioWorldEdit(worldSlug);            // Rolle owner/admin/dm
```
plus `requireNodeInWorld(worldSlug, nodeId)` (`:29-39`) als dritter Guard: die
Ebene muss zur Welt gehören. Das ist genau das „dreifache Guard"-Muster, das J1
für Terra übernehmen will.

- `apps/studio/src/lib/studio-action-auth.ts` — `authorize({ scope:
  "studio-action", request })` über Header, mit dem Kommentar „middleware alone
  is not sufficient".
- `apps/studio/src/lib/authz.ts:56-65` — `requireStudioWorldEdit` →
  `assertStudioTrusted()` + `assertStudioCanEditWorld()` → `assertCanEditWorld(…,
  STUDIO_TRUSTED_SCOPE)` (`:36-38`).

**Studio (Lesen)** — die Seiten prüfen nichts Atlas-spezifisches:
`atlas3d/page.tsx:15-21` und `[nodeId]/page.tsx:20-30` nutzen nur
`getWorldBySlug` + `notFound()`; die Auth liegt in Middleware + `WorldShell`.

**Portal** — `atlas3d/page.tsx:28-29` und `[nodeId]/page.tsx:22-23`:
`const ctx = await getAccessContextForWorld(worldSlug); if (!ctx) notFound();`
mit dem Kommentar (`page.tsx:22-24`) „access is gated by world membership only,
never per entity."

**Sichtbarkeit:** ausdrücklich keine.
`apps/studio/app/atlas3d-actions.ts:20-21` — „Atlas 3D content is entirely
player-visible (owner decision 2026-07-21), so there is no visibility handling
here." Deckungsgleich mit Entscheidung 3 in der J-Planung.

## 2.7 Brain / KI (packages/ai-brain, cookbook, security)

Vier Action-Ids, verteilt über **10 Code-Dateien** (die Planung sagte neun —
das stimmt, wenn man nur `packages/` zählt und die Studio-UI weglässt):

| Datei | Zeilen | Rolle |
|---|---|---|
| `packages/ai-brain/src/actions.ts` | 13-16, 132-179 | `BrainActionId`-Union + `BRAIN_ACTIONS` |
| `packages/ai-brain/src/actions.ts` | 18-28 | `AiProposalTargetType`: `atlas_draft_names`, `atlas_region_description`, `atlas_plot_fill`, `atlas_asset_proposal` |
| `packages/ai-brain/src/proposals.ts` | 1-2, 126, 144, 162, 172, 190 | Validator-Aufruf + `proposalKind` |
| `packages/ai-brain/src/tasks.ts` | 1, 24-27, 80-88 | Labels + Prompts |
| `packages/ai-brain/src/router/providers/connectorQueueProvider.ts` | 457, 477-480 | Workflow-Slot-Mapping |
| `packages/ai-brain/src/brain-actions.test.ts` | 32-35, 90, 113, 127, 168 | |
| `packages/ai-brain/src/router/providers/connectorQueueProvider.test.ts` | 252-253 | |
| `packages/security/src/security/inference/ai-context-types.ts` | 30-33 | **Quelle der Wahrheit** für `AiTaskType` |
| `packages/cookbook/src/ai-types.ts` | 32-35 | **Handkopie ohne Compilerbindung** |
| `packages/cookbook/src/routing-hints.ts` | 29-30 | nur 2 von 4 |
| `apps/studio/src/components/atlas3d/Atlas3DDescribePanel.tsx` | 7, 58 | einzige UI, ruft `atlas_describe_region` |

**Compilerschutz — und wo er nicht greift.** Entfernt man die vier Werte aus
`AiTaskType`, brechen drei exhaustive Records: `tasks.ts:4`, `tasks.ts:41`,
`connectorQueueProvider.ts:457`. Das ist gewollt.
**Aber:** `packages/cookbook/src/ai-types.ts:1` sagt selbst „Mirrors
@uwe/ai-brain router modes without creating a package cycle" — es ist eine
manuelle Kopie **ohne Typ- oder Testverbindung**. Ein Grep nach
`CookbookAiTaskType` in `packages/ai-brain/src` liefert null Treffer. Wer nur in
`security` löscht, bekommt in `cookbook` **keinen Fehler** — die toten Einträge
bleiben still stehen. Das ist eine der drei gefährlichsten Fundstellen.

**Namensfalle:** Action-Id `atlas_name_region**s**` (Plural, `actions.ts:13`)
mappt auf Task-Typ `atlas_name_region` (Singular, `actions.ts:137`). Beide
Schreibweisen müssen gesucht werden.

## 2.8 Weitere Verweise

| Datei:Zeile | Inhalt |
|---|---|
| `packages/database/src/wiki-quality-service.ts:426-430` | `location_missing_map: { title: "Karten für Orte hinterlegen", description: "Orte und Regionen mit einer Karte im Atlas verknüpfen.", pathSuffix: "/atlas" }` |
| `packages/database/src/wiki-quality-service.ts:475` | `href: \`/worlds/${worldSlug}${meta.pathSuffix}\`` — **Route aus einem Datenfeld zusammengesetzt** |
| `packages/database/src/server.ts:2211` | `export type { AtlasNodeLevel } …` |
| `packages/product-contracts/src/prisma-model-boundaries.ts:166-171` | 6 Modelleinträge |
| `packages/product-contracts/src/contracts.test.ts:96` | harter Verweis auf `.Atlas3DWorld` |
| `scripts/ux-audit/pages-data.mjs:2151-2187, 3215-3252` | 4 Routen-Einträge, davon 2 auf gelöschte Dateien |
| `scripts/ux-audit/issue-manifest.json:1056-1073, 1536-1548` | dieselben 4 als Issue-Daten |
| `scripts/ux-audit/close-phase-c-issues.mjs:69` | „Graph/Atlas-Performance" |
| `docs/CURRENT_STATE.md:80` | „Atlas-Handout" |
| `apps/studio/app/ideas/IdeaWorkspaceClient.tsx:301` | Placeholder-Beispieltext „z. B. Atlas-Orchestrator Subagent" |
| `CHANGELOG.md` | **keine** Atlas-Treffer |

**Übersetzungen:** Es gibt keine i18n-Infrastruktur. Alle deutschen Labels stehen
inline. Kein `locales/`, `i18n/`, `messages/`-Katalog.

**Icons:** Keine zentrale Icon-Registry mit Atlas-Eintrag. Zwei Mechanismen:
String-Icon-Name `"globe"` in beiden Nav-Dateien (aufgelöst über
`resolveLucideIcon` — der Test `apps/studio/src/components/ui/icon.test.ts:12`
ist generisch und darf bleiben, `"globe"` ist auch das Icon für „Meine Welten",
`portal-nav.ts:30`), plus direkte lucide-Importe in
`apps/portal/app/auth/worlds/[worldSlug]/atlas3d/page.tsx:3`.

## 2.9 Dokumentation — 24 Dateien, ~5.605 Zeilen

`docs/engineering/`: `atlas-3d.md` (107), `atlas-cok-gap-analysis.md` (199),
`atlas-editor-roadmap.md` (135), `atlas-follow-ups.md` (142),
`atlas-gouache-plan.md` (112), `atlas-height-simulation.md` (115),
`atlas3d-feature-roadmap.md` (86), `terra-uebernahmen-aus-atlas.md` (212).
`docs/design/atlas-redesign/`: README (18), `asset-catalog.md` (215),
`improvement-ideas.md` (116), 2 HTML (1.121).
`docs/handoffs/atlas-singlefile/`: 6 Dateien (~2.261).
`docs/prompts/`: `atlas-orchestrator.md` (121), `atlas-pictogram-styleguide.md`
(306), `atlas-style-reference.md` (45), `atlas-pictograms.svg` (228).
`docs/artifacts/atlas-3d-prototype.html` (66).

**⚠️ Vier davon sind produktiv referenziert, nicht nur Doku:**
`packages/atlas/src/rtx-asset-proposal.ts:15-18` definiert
`RTX_ATLAS_ASSET_STYLEGUIDE_PATH` und `RTX_ATLAS_ASSET_CATALOG_PATH` und schickt
diese Pfade in den RTX-Prompt. Wer `docs/prompts/atlas-*` löscht, während
`ai-brain` noch läuft, entwertet den Asset-Prompt.

**Zwei Dokumente sind heute schon irreführend:** `docs/engineering/atlas-3d.md:19-20`
behauptet, 3D sei „eine Projektion des 2D-Dokuments, kein zweites Datenmodell"
und es gebe „weder eine Prisma-Migration noch einen 3D-spezifischen Save-Pfad" —
seit `20260721120000_atlas3d_foundation` ist beides falsch. `:41` und `:47`
verweisen auf `packages/static-export/static/atlas-3d.js` bzw. `atlas.html`,
**die es nicht gibt**. `scripts/docs-check.mjs` prüft nur die Existenz von sieben
Pflichtdateien (`:11-19`), keine Links — deshalb überleben tote Verweise die CI.

Empfehlung der Planung, `atlas3d-feature-roadmap.md` zu behalten und umzubenennen:
plausibel, unabhängig von Atlas nützlich.

## 2.10 Wo meine Suche blind ist — ehrlich

1. **Laufzeitdaten.** Ich kann nur Code lesen. `ai_runs`-Zeilen mit
   `task_type = "atlas_*"` und `target_type = "atlas_plot_fill"` etc. bleiben nach
   dem Code-Ausbau als Waisen-Strings zurück; es gibt keine Cleanup-Migration.
   In der geprüften Live-DB sind allerdings **null** solche Zeilen (siehe 3.2).
2. **Dynamisch gebaute Strings.** Gefunden habe ich `${base}/atlas3d`
   (drei Nav-Dateien), `pathSuffix`-Konkatenation (`wiki-quality-service.ts:475`)
   und Segment-Extraktion per `split("/")` (`mobile-nav.ts:91-96`). Ein Muster wie
   `` `/worlds/${slug}/${section}` `` mit `section` aus einer Datenquelle wäre
   unauffindbar. `studio-navigation.ts:302` zeigt, dass Präfix-Logik existiert.
3. **`data/` und `exports/`** sind in `eslint.config.mjs:39-40` ignoriert und
   wurden nicht durchsucht.
4. **`pnpm-lock.yaml`** (23 Treffer) — wird beim Ausbau regeneriert.
5. **Migrationsdateien** habe ich nur für Atlas gelesen, nicht Zeile für Zeile
   für alle 89 Ordner.

**Suchmethode:** `git ls-files | grep -i atlas` (150 Dateien), `git grep -il
atlas` repo-weit, gezielte Greps auf `Atlas3D`, `atlas3d`, `ATLAS3D`, `atlas-3d`,
`atlas_3d` (0 Treffer), `AtlasNodeLevel`, `@uwe/atlas`, `weltenbau`, `world
builder`, `karte`, `map`, `globe`, `3d`, plus Import-Rückverfolgung für jedes
Paket in beide Richtungen und Existenzprüfung jeder referenzierten Datei.

---

# 3. Datenbank

## 3.1 Die 6 Modelle und ihre Fremdschlüssel

Alle in `packages/database/prisma/schema.prisma:2582-2723`.

### Ausgehend — Atlas zeigt nach außen

| Von | Spalte | Nach | onDelete | Zeile |
|---|---|---|---|---|
| `Atlas3DWorld` | `world_id` | `World` | **Cascade** | 2601 |
| `Atlas3DNode` | `atlas_world_id` | `Atlas3DWorld` | Cascade | 2629 |
| `Atlas3DNode` | `parent_id` | `Atlas3DNode` (self) | SetNull | 2630 |
| `Atlas3DNode` | `page_id` | `Page` | SetNull | 2632 |
| `Atlas3DTerrain` | `node_id` | `Atlas3DNode` | Cascade | 2656 |
| `Atlas3DTerrain` | `heightmap_asset_id` | `Asset` | SetNull | 2657 |
| `Atlas3DTerrain` | `splatmap_asset_id` | `Asset` | SetNull | 2658 |
| `Atlas3DFeature` | `node_id` | `Atlas3DNode` | Cascade | 2678 |
| `Atlas3DFeature` | `child_node_id` | `Atlas3DNode` | SetNull | 2679 |
| `Atlas3DFeature` | `linked_page_id` | `Page` | SetNull | 2680 |
| `Atlas3DObject` | `node_id` | `Atlas3DNode` | Cascade | 2702 |
| `Atlas3DCameraBookmark` | `node_id` | `Atlas3DNode` | Cascade | 2718 |

### Eingehend — **welche Nicht-Atlas-Tabelle zeigt auf Atlas?**

**Keine.** Das ist der entscheidende Befund für die Löschreihenfolge.

`World` (`schema.prisma:701`), `Page` (`:784-785`) und `Asset` (`:1082-1083`)
tragen zwar Atlas-Felder — aber ausschließlich **Rück-Relationen** ohne eigene
Spalte:

```prisma
World.atlas3d              Atlas3DWorld?                              // :701
Page.atlas3dNodes          Atlas3DNode[]    @relation("Atlas3DNodePage")     // :784
Page.atlas3dFeatures       Atlas3DFeature[] @relation("Atlas3DFeaturePage")  // :785
Asset.atlas3dHeightmaps    Atlas3DTerrain[] @relation("Atlas3DTerrainHeightmap") // :1082
Asset.atlas3dSplatmaps     Atlas3DTerrain[] @relation("Atlas3DTerrainSplatmap")  // :1083
```

Prisma-Rück-Relationen erzeugen **keine Datenbankspalte**. In SQL zeigt der
Fremdschlüssel immer von Atlas nach außen. Daraus folgt:

**Die sechs Tabellen lassen sich in beliebiger Kinder-zuerst-Reihenfolge droppen,
ohne dass eine Fremdtabelle bricht.** Es bleibt kein verwaister Verweis in
`worlds`, `pages` oder `assets` zurück. Zu tun ist nur: die fünf Zeilen oben aus
dem Schema streichen, sonst schlägt `prisma validate` fehl.

## 3.2 Datenbestand (gemessen, nur lesend)

DB laut `C:\git\UWE\.env`:
`C:/Users/lasse/AppData/Local/UWE/rtx-connector-client/host/data/uwe.db`.
Ich habe `uwe.db` + `-wal` + `-shm` in den Scratchpad **kopiert** und die Kopie
mit `node:sqlite` abgefragt — die Originaldatei wurde nicht geöffnet.
Stand der Kopie: 27.07.2026.

| Tabelle | Zeilen |
|---|---:|
| `atlas3d_worlds` | **1** |
| `atlas3d_nodes` | **1** |
| `atlas3d_terrains` | **1** |
| `atlas3d_features` | **0** |
| `atlas3d_objects` | **12** |
| `atlas3d_camera_bookmarks` | **1** |
| — zum Vergleich: `worlds` | 1 |
| — `pages` | 0 |
| — `assets` | 0 |

Verweise in die Gegenrichtung: `atlas3d_nodes.page_id` gesetzt: **0**;
`atlas3d_features.linked_page_id`: 0; `atlas3d_terrains.heightmap_asset_id`: 0;
`splatmap_asset_id`: 0. `ai_runs`: **keine** Zeile mit Atlas-`task_type`.

Migrationsstand in `_prisma_migrations` (alle sechs Atlas-Migrationen angewandt):
`20260629230000_atlas_world_builder`, `20260701160000_atlas_schema_version_tile_layer`,
`20260703130000_atlas_feature_kind_vine`, `20260705120000_atlas_object_style_plot_kind`,
`20260721120000_atlas3d_foundation`, `20260721150000_drop_legacy_atlas`.

**Deutung:** Das ist exakt der Zustand nach `scripts/atlas3d-demo-seed.ts` bzw.
nach einem einmaligen Aufruf der Indexseite (`atlas3d/page.tsx:21`, lazy
`getOrCreateForWorld`). Es existiert **keine gewachsene Atlas-Welt**. Die
Entscheidung „alte Atlas-Welten verwerfen" kostet praktisch nichts, und die
Backup-Lücke wiegt hier weniger schwer, als der Grundsatz vermuten lässt.

**Falls in einer anderen Umgebung gezählt werden muss** (ohne `sqlite3`-CLI auf
diesem Rechner):
```
node -e "const{DatabaseSync}=require('node:sqlite');const d=new DatabaseSync(process.argv[1]);
for(const t of ['atlas3d_worlds','atlas3d_nodes','atlas3d_terrains','atlas3d_features','atlas3d_objects','atlas3d_camera_bookmarks'])
console.log(t, d.prepare('SELECT COUNT(*) n FROM \"'+t+'\"').get().n);" <pfad-zur-uwe.db>
```
oder `pnpm --filter @uwe/database exec prisma studio`.

## 3.3 Migrationsentwurf zum Droppen (Text, **nicht** als Datei anlegen)

Vorlage ist `20260721150000_drop_legacy_atlas/migration.sql` — dieselbe Bauart,
zwei Verbesserungen: `IF EXISTS` (die alte Migration hat es nicht und bricht auf
einer DB ohne die Tabellen ab) und der Enum-Drop.

**SQLite** — `packages/database/prisma/migrations/2026XXXXXXXXXX_drop_atlas3d/migration.sql`:

```sql
-- Terra ersetzt Atlas 3D vollständig (Owner-Entscheid 27.07.2026).
-- Alte Atlas-Welten werden ausdrücklich VERWORFEN, nicht migriert.
-- ACHTUNG: packages/backup sichert diese Tabellen NICHT — vor dem Deploy
-- uwe.db + uwe.db-wal + uwe.db-shm als Dateikopie sichern.
--
-- Reihenfolge Kinder → Eltern. Keine Nicht-Atlas-Tabelle hat einen
-- Fremdschlüssel auf diese Tabellen (geprüft 27.07.2026), es bleiben also
-- keine verwaisten Verweise in worlds/pages/assets zurück.

PRAGMA foreign_keys=off;
DROP TABLE IF EXISTS "atlas3d_camera_bookmarks";
DROP TABLE IF EXISTS "atlas3d_objects";
DROP TABLE IF EXISTS "atlas3d_features";
DROP TABLE IF EXISTS "atlas3d_terrains";
DROP TABLE IF EXISTS "atlas3d_nodes";
DROP TABLE IF EXISTS "atlas3d_worlds";
PRAGMA foreign_keys=on;

-- Enum AtlasNodeLevel: In SQLite existiert es nicht als Datenbankobjekt
-- (Prisma bildet es als TEXT ab). Es genügt, den Block aus schema.prisma
-- (Zeilen 2582-2587) zu streichen; hier ist nichts zu tun.
```

**PostgreSQL** — `migrations-postgresql/2026XXXXXXXXXX_drop_atlas3d/migration.sql`.
Achtung: Dort existieren die `atlas3d_*`-Tabellen **gar nicht** (Drift, siehe
Vorabbefund 2), dafür noch die alten 2D-Tabellen. Beides in einem Zug:

```sql
-- Postgres-Zweig hinkt hinterher: atlas3d_* wurde nie angelegt,
-- die 2D-Tabellen wurden nie gedroppt. Hier beides einholen.
DROP TABLE IF EXISTS "atlas3d_camera_bookmarks" CASCADE;
DROP TABLE IF EXISTS "atlas3d_objects" CASCADE;
DROP TABLE IF EXISTS "atlas3d_features" CASCADE;
DROP TABLE IF EXISTS "atlas3d_terrains" CASCADE;
DROP TABLE IF EXISTS "atlas3d_nodes" CASCADE;
DROP TABLE IF EXISTS "atlas3d_worlds" CASCADE;

-- Reste des 2D-Atlas (nie gedroppt im Postgres-Zweig):
DROP TABLE IF EXISTS "atlas_features" CASCADE;
DROP TABLE IF EXISTS "atlas_objects" CASCADE;
DROP TABLE IF EXISTS "atlas_nodes" CASCADE;
DROP TABLE IF EXISTS "atlas_maps" CASCADE;
DROP TABLE IF EXISTS "atlas_palette_items" CASCADE;

DROP TYPE IF EXISTS "AtlasNodeLevel";
DROP TYPE IF EXISTS "AtlasFeatureKind";
DROP TYPE IF EXISTS "AtlasLabelColor";
DROP TYPE IF EXISTS "AtlasPaletteSource";
DROP TYPE IF EXISTS "AtlasPaletteReviewStatus";
```

Zusätzlich im selben Commit:
`schema.prisma` — Modelle `:2589-2723`, Enum `:2582-2587` und die fünf
Rück-Relationen `:701`, `:784-785`, `:1082-1083` streichen;
`schema.postgresql.prisma` — dasselbe (`:2569-2695`, Rück-Relationen analog);
`packages/database/src/server.ts:2211` — Re-Export entfernen.

Ein **Daten-Cleanup für `ai_runs`** ist optional: In der geprüften DB gibt es
keine Atlas-Zeilen. In anderen Umgebungen bleiben `task_type`/`target_type`
als Waisen-Strings stehen — funktional harmlos, kosmetisch unschön.

---

# 4. Die Pfadübernahme (J1)

## 4.1 Wie die Studio-Seite heute gebaut ist

`apps/studio/app/worlds/[worldSlug]/atlas3d/[nodeId]/page.tsx` (180 Z.) ist eine
**async Server-Komponente**. Ablauf:

1. `:19-22` — `params` auflösen, `getWorldBySlug`, `notFound()` bei Fehlschlag.
2. `:24-30` — `createAtlas3DService(db)`, `getNodeChain(nodeId)`,
   **Mandantenprüfung** `chain.atlasWorld.worldId !== world.id → notFound()`.
3. `:33` — voller Knotenbaum für das Ebenen-Panel.
4. `:36-56` — Vererbungskette bauen und über
   `resolveEffectiveNodeSettings` (`@uwe/atlas-editor/inheritance`) auflösen.
5. `:67-76` — Breadcrumb.
6. `:78-83` — Rahmen `<WorldShell worldSlug worldName breadcrumb>`. **Hier
   sitzt die Auth-Hülle** (zusammen mit `apps/studio/middleware.ts`); die Seite
   selbst prüft keine Rolle.
7. `:93-177` — `<Atlas3DEditorLazy … />` bekommt **rund 20 Props**: `nodeId`,
   `mode` (`node.level === "globe" ? "globe" : "terrain"`), `seed`,
   `initialCarveOps`, `initialHeightmap`, `initialHeightLayers`, `initialSplat`,
   `initialObjects`, `initialFeatures` (nach `EDITOR_FEATURE_KINDS` gefiltert,
   `:16`), `silhouette`, fünf Umgebungswerte mit Herkunftsangabe
   (`{value, fromTitle, overridden}`), `stylePreset`, `bookmarks`, `children3d`,
   `treeNodes`, `regionFeatures`.

**Gespeichert wird nicht über die Seite, sondern über Server Actions.**
`Atlas3DEditorShell.tsx:178-198` — `scheduleSave` mit **1200 ms Debounce**:

```ts
saveTimerRef.current = setTimeout(() => {
  setSaveState("speichert …");
  const form = new FormData();
  form.set("worldSlug", props.worldSlug);
  form.set("nodeId", props.nodeId);
  form.set("carveOps",  JSON.stringify(doc.carveOps));
  form.set("heightmap", JSON.stringify(doc.heightmap));
  … objects, features, heightLayers, splat …
  saveAtlas3DTerrainAction(form)
    .then((r) => setSaveState(r.ok ? "gespeichert" : "Fehler"))
    .catch(() => setSaveState("Fehler"));
}, 1200);
```

Bestätigt: **kein `beforeunload`-Flush** — der Timer wird beim Verlassen
abgebrochen. Genau der Mangel, den J1 für Terra beheben will.

Die Indexseite `atlas3d/page.tsx` (24 Z.) ist ein Bootstrap: `getOrCreateForWorld`
+ `redirect` auf die Wurzel.

## 4.2 Wohin der Frame gehört

Der Frame ersetzt genau `<Atlas3DEditorLazy … />` in Zeile 93-177. Alles davor
bleibt: `getWorldBySlug`, die Mandantenprüfung, `WorldShell`, Breadcrumb. Das ist
der Grund, warum Weg A so gut passt — die Rechteprüfung liegt **vor** dem Frame
und wird von ihm gar nicht berührt.

Konkret:

```
apps/studio/app/worlds/[worldSlug]/atlas3d/[nodeId]/page.tsx   (Server)
  ├─ Welt laden, Mandant prüfen, Karte laden  ← unverändertes Muster
  ├─ <WorldShell> + Breadcrumb                ← unverändert
  └─ <TerraFrame karteId=… initialDaten=… />  (Client, dünn)
        └─ <iframe src="/terra/index.html?karte=…" />
              └─ postMessage-Brücke
```

Terra selbst wird nach `apps/studio/public/terra/` ausgeliefert. Kein Bundler,
kein Build-Schritt — die Datei wird nur kopiert (Vorbild: das inzwischen
entfernte `copy:atlas`-Skript, dessen Spur noch in
`apps/studio/.gitignore:1-2` steht).

## 4.3 Wie die Karte hinein- und wieder herauskommt, ohne die Rechte zu umgehen

Das ist der Knackpunkt: Terra ist statisches HTML/JS ohne Server. Der Frame darf
**nie** selbst zur Datenbank sprechen.

**Regel: Der Frame ist ein reiner Renderer. Alle Daten reisen über die Brücke,
alle Schreibvorgänge über die bestehenden Server Actions der Elternseite.**

**Hinein.** Zwei Möglichkeiten, die zweite ist die sichere:

- ~~Terra holt sich die Karte selbst per `fetch`~~ — würde eine öffentliche
  Leseroute erfordern. Abzulehnen.
- Die Server-Komponente liest die Karte (wie heute `node.terrain`), reicht sie
  als Prop an die dünne Client-Komponente, und die schickt sie nach
  `iframe.onload` per `postMessage({typ:"karte-laden", daten})` hinein. Terra
  hat mit `terra/src/editor/io.js` bereits einen Deserialisierer für sein
  v4-JSON (`:181-206`, Fassungserkennung über `d.version`) — der wird nur an
  eine andere Quelle als den Dateidialog gehängt.

**Heraus.** Terra meldet `postMessage({typ:"karte-geaendert", daten, version})`.
Die Elternkomponente debounct (wie `scheduleSave`, aber **mit**
`beforeunload`-Flush) und ruft eine Server Action `speichereTerraKarteAction`.
Die prüft dann dasselbe Trio wie heute: `requireStudioActionAuth()` (CSRF/Origin)
→ `requireStudioWorldEdit(worldSlug)` (Rolle) → Karte gehört zur Welt.

**Damit kann der Frame nichts umgehen:** Er besitzt keine Session, keinen
Cookie-Zugriff auf fremde Daten und keine Route. Er kann nur Nachrichten
schicken, die von der Elternseite entgegengenommen und gegen die vollen Guards
geprüft werden.

**Zwei Pflichten für die Brücke:**
1. `event.origin` **und** `event.source === iframe.contentWindow` prüfen — beides.
   Da der Frame gleich-origin ist, ist `origin === location.origin` die Regel.
2. Beim Senden **nicht** `postMessage(msg, "*")`, sondern `location.origin`.

**Konflikterkennung** (J1-Wunsch): `version` reist in beide Richtungen mit;
die Server Action lehnt ein Schreiben mit veralteter Version ab und meldet das
über die Brücke zurück.

## 4.4 CSP und Frame-Regeln — was heute im Weg steht

Alles in `packages/auth/src/security-headers.ts`, gesetzt über
`apps/studio/next.config.ts:44-51` und `apps/portal/next.config.ts:18-25`
(beide `source: "/:path*"` → `getUweSecurityHeaderEntries()`).

**Gut — das Framing selbst ist bereits erlaubt:**
- `:66` — `const frameSrc: string[] = ["'self'"];` mit dem Kommentar (`:63-65`)
  „'self' permits the Studio to embed the same-origin single-file Atlas editor
  (atlas.html) in an `<iframe>`".
- `:81` — `"frame-ancestors 'self'"`.
- `:149` — `"X-Frame-Options": "SAMEORIGIN"` mit dem Kommentar (`:147-148`)
  „SAMEORIGIN (not DENY) so the Studio can iframe the same-origin Atlas editor".

Das ist die Erbschaft aus der 2D-Zeit, auf die die J-Planung setzt — sie
**stimmt**. Für einen gleich-origin-Frame unter `/terra/index.html` ist nichts zu
ändern. **Diese drei Stellen dürfen beim Abbau also nicht mitgelöscht werden**,
obwohl in ihren Kommentaren „Atlas" steht. Die Kommentare gehören umgeschrieben,
die Werte bleiben.

**Schlecht — der echte Blocker:**

`terra/index.html:11-14` lädt Three.js per Import-Map von einem CDN:
```html
"three": "https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.module.js",
"three/addons/": "https://cdn.jsdelivr.net/npm/three@0.185.1/examples/jsm/"
```
Die CSP setzt `script-src 'self' 'unsafe-inline'` (`security-headers.ts:50`,
`:82`) — **jsdelivr ist nicht enthalten, der Import schlägt fehl.** Terra bliebe
im Frame schwarz.

Drei Auswege, in dieser Reihenfolge:
1. **Three.js mitliefern** — `three.module.js` und die benötigten `addons/`
   nach `apps/studio/public/terra/vendor/` legen und die Import-Map auf
   relative Pfade umstellen. Beste Lösung: CSP bleibt streng, Terra bleibt
   eigenständig (die Import-Map funktioniert auch beim Öffnen per Doppelklick),
   und die Anwendung wird offline-fähig. **Empfohlen.**
2. jsdelivr in `script-src` aufnehmen — löchert die CSP für die ganze App.
   Abzulehnen.
3. Terra als Paket bündeln — das ist Weg B, verworfen.

**Weitere Direktiven, geprüft:**
- `connect-src 'self'` (`:86`) — Terra darf nur gleich-origin fetchen. Für die
  Brücke irrelevant (postMessage ist kein Netzwerkzugriff). Falls Terra später
  Texturen oder Kacheln nachladen soll: gleich-origin ausliefern.
- `img-src 'self' data: blob:` (`:84`) und `worker-src 'self' blob:` (`:88`) —
  reichen für Canvas-Export als PNG und für Worker aus Blobs.
- `media-src 'self' blob:` (`:87`), `object-src 'none'` (`:78`), `font-src
  'self'` (`:85`) — Terra nutzt keine eigenen Schriften; falls doch, müssen sie
  gleich-origin liegen.
- **`wasm-unsafe-eval` fehlt** (`script-src` = `:50-56`). Heute unkritisch —
  Terra nutzt kein WASM. Falls je Rapier/Draco o.ä. dazukommt, muss die
  Direktive ergänzt werden.
- `'unsafe-eval'` gibt es **nur außerhalb Production** (`:51-53`). Wer Terra in
  Dev testet und in Prod scheitert, sucht sonst lange.
- `Cross-Origin-Opener-Policy: same-origin` und
  `Cross-Origin-Resource-Policy: same-origin` (`:151-152`) — für einen
  gleich-origin-Frame unproblematisch.

**Tests, die dabei mitzudenken sind:** `packages/auth/src/security-headers.test.ts:18-22`
(Kommentar nennt atlas.html), `:57-58` („Tight default: frame-src is same-origin
only"), `:40`, `:71`, `:73`.

## 4.5 Was mit `/auth/worlds/[slug]/atlas3d` passiert (Portal, read-only)

Heute: `apps/portal/app/auth/worlds/[worldSlug]/atlas3d/page.tsx` (76 Z.) zeigt
den Ebenenbaum; `[nodeId]/page.tsx` (127 Z.) rendert
`Atlas3DPortalViewerLazy` → `Atlas3DPortalViewer.tsx` (88 Z.), das über
`createAtlas3DEditorApp` (`:4`) **dieselbe Engine** wie Studio startet, nur ohne
Werkzeuge. Zugriff über `getAccessContextForWorld(worldSlug)` (`:28-29` bzw.
`:22-23`), Kommentar: „access is gated by world membership only, never per
entity."

Für Terra heißt das:
- Derselbe Frame, mit einem Parameter `modus=lesen`. Terra blendet Rail und
  Panels aus und lässt nur Navigation zu.
- **Die Brücke muss im Portal einseitig sein.** Die Elternkomponente lädt die
  Karte hinein, nimmt aber **keine** `karte-geaendert`-Nachricht entgegen — es
  gibt im Portal schlicht keine Server Action zum Schreiben. Das ist die
  robustere Absicherung als ein Flag im Frame: Selbst ein manipulierter Frame
  hat kein Ziel, an das er schreiben könnte.
- `transpilePackages` in `apps/portal/next.config.ts:17` verliert seinen
  `@uwe/atlas-3d`-Eintrag — Terra braucht keine Transpilation.
- Entscheidung 3 der Planung (keine Sichtbarkeit je Karte) bleibt: Das Portal
  zeigt den ganzen Kartenbaum ungefiltert, wie Atlas heute.

**Offene Frage, hier müsste man nachsehen:** Ob das Portal seine eigene
`public/terra/`-Kopie braucht oder über den Studio-Proxy
(`apps/studio/next.config.ts:32-43` `rewrites()`) mitversorgt werden kann. Ich
habe den Proxy nur gestreift und kann es nicht sicher sagen. Zwei Kopien wären
funktional unproblematisch, aber verdoppeln die Wartung.

---

# 5. Vorgeschlagene Reihenfolge

Jeder Schritt ist einzeln lauffähig und einzeln zurücknehmbar. „Kaputt, wenn man
hier aufhört" ist bewusst als Warnung formuliert.

### Schritt 0 — Sicherung und Dokumentation
Dateikopie von `uwe.db` + `-wal` + `-shm` (der logische `backup:create` reicht
**nicht**, siehe Vorabbefund 1). Changelog-Eintrag: Atlas entfällt, Inhalte
gehen verloren.
*Wenn man hier aufhört:* nichts kaputt, nur eine Sicherung mehr.

### Schritt 1 — Das Brauchbare aus Atlas herausholen (siehe Abschnitt 6)
Vor jedem Löschen. Kein Produktivcode betroffen.
*Wenn man hier aufhört:* nichts kaputt.

### Schritt 2 — Terra ausliefern und den Frame bauen (J1)
`apps/studio/public/terra/` inkl. mitgeliefertem Three.js, dünne
Frame-Komponente, `postMessage`-Brücke, neue Prisma-Modelle
(`TerraAtlas`/`TerraKarte`/`TerraStand`/`TerraFassung`) und Server Actions.
**Atlas bleibt vorerst vollständig erreichbar** — Terra läuft zunächst unter
einem eigenen Pfad (z. B. `/worlds/[slug]/karten`).
*Wenn man hier aufhört:* nichts kaputt, zwei Karteneditoren nebeneinander.

### Schritt 3 — Pfade umhängen
`/worlds/[slug]/atlas3d[/[nodeId]]` und `/auth/worlds/[slug]/atlas3d[/[nodeId]]`
rendern Terra. Atlas-Code bleibt im Repo, ist aber nicht mehr erreichbar.
*Wenn man hier aufhört:* Atlas-Inhalte sind nicht mehr aufrufbar, liegen aber
noch in der DB. Rückgängig durch ein Zurücksetzen der vier Seiten.
**Die Planung empfiehlt zu Recht, hier eine Weile stehenzubleiben** — im echten
Betrieb merkt man erst, was Terra fehlt.

### Schritt 4 — Navigation und Beschriftung
Labels auf „Karten", `world-nav.ts:70-80`, `studio-navigation.ts:32/62/142/174/302`,
`portal-nav.ts:121-129`, `mobile-nav.ts:65` und die zwei Nav-Tests.
Achtung `studio-navigation.ts:302`: der `startsWith("/atlas")`-Präfix fängt beide
Varianten und muss bewusst umgeschrieben werden.
*Wenn man hier aufhört:* konsistenter Zustand, Atlas nur noch über Direktlink.

### Schritt 5 — Atlas-UI, Routen, Tests entfernen
`apps/studio/src/components/atlas3d/`, `apps/portal/src/components/atlas3d/`,
die vier `atlas3d`-Seiten, `atlas3d-actions.ts`, die zwei e2e-Specs,
`scripts/atlas3d-demo-seed.ts`, die zwei 2D-Redirect-Seiten,
`apps/portal/next.config.ts:17` (`@uwe/atlas-3d` aus `transpilePackages`),
`apps/studio/middleware.ts:216-220` (`atlas/` aus dem Matcher),
`apps/studio/.gitignore:1-2`, `eslint.config.mjs:38`.
*Wenn man hier aufhört:* Pakete und Tabellen sind Ballast, aber alles läuft.

### Schritt 6 — Pakete löschen
`packages/atlas-3d/`, `packages/atlas-editor/`, die drei verwaisten
`@uwe/atlas`-Deps (`apps/studio/package.json:30`, `apps/portal/package.json:25`,
`packages/database/package.json:89`), `three@0.178.0` entfällt.
`packages/database/src/atlas3d-service.ts` + Test,
`packages/database/package.json:18` (Export-Map).
**Reihenfolge beachten:** erst nach Schritt 5, sonst brechen die Importe.
*Wenn man hier aufhört:* nur noch die DB-Tabellen übrig.

### Schritt 7 — Prisma-Migration `drop_atlas3d` (beide Zweige)
Wie in 3.3 entworfen, plus die fünf Rück-Relationen und
`packages/database/src/server.ts:2211`.
*Wenn man hier aufhört:* fertig bis auf Contracts und Brain.

### Schritt 8 — Contracts und ihre Tests
`prisma-model-boundaries.ts:166-171` und `contracts.test.ts:96`
**im selben Commit** wie Schritt 7 — sonst schlägt
`prisma-model-boundaries.sync.test.ts:40-48` fehl („covers exactly the models
declared across both schemas"). Genau genommen gehören 7 und 8 zusammen.
*Wenn man hier aufhört:* rote Tests, wenn 7 ohne 8 gemacht wurde.

### Schritt 9 — Brain-Actions (nach J3/J4)
`atlas_describe_region` ersatzlos; die anderen drei erst, wenn die
Terra-Nachfolger stehen. Betrifft `actions.ts:13-16/18-28/132-179`,
`tasks.ts:24-27/80-88`, `proposals.ts`, `connectorQueueProvider.ts:477-480`,
`ai-context-types.ts:30-33`, **und `cookbook/ai-types.ts:32-35` +
`routing-hints.ts:29-30`, die der Compiler NICHT erwischt**.
*Wenn man hier aufhört:* vier tote Brain-Actions im Katalog.

### Schritt 10 — `packages/atlas` (2D) abwickeln
Erst nach Schritt 9. Behalten werden müssen `plot-fill-proposal.ts` und
`rtx-asset-proposal.ts` (+ `assets*.ts`, `constants.ts`, `geometry.ts`,
`prng.ts`, `terrain.ts`, `plot-fill.ts`, `rtx-asset-prompt-context.ts`) samt
`docs/prompts/atlas-*` — solange die RTX-Asset-Action lebt. Der Rest (30 tote
Module, ~11.000 Zeilen, 33 Testdateien) kann weg. Empfehlung: das Verbliebene
nach `packages/ai-brain/src/proposals/` verschieben und `packages/atlas`
auflösen.
*Wenn man hier aufhört:* der Fehler von 2026-07-21 wiederholt sich.

### Schritt 11 — Dokumente
Löschen bis auf `atlas3d-feature-roadmap.md` (umbenennen, behalten),
`terra-uebernahmen-aus-atlas.md` (Terra-bezogen) und `docs/prompts/atlas-*`
(produktiv referenziert, siehe 2.9). Die W0-Atlas-Policy-Erwähnungen
(`SECURITY.md:190` u. a.) **nicht anfassen**.

### Schritt 12 — Endprüfung
`git grep -i atlas` muss leer sein bis auf: W0-Atlas-Policy,
`terra/src/world/vfx.js` (Texturatlas), Changelog, die behaltene Roadmap und —
falls Schritt 10 unvollständig blieb — die Brain-Validatoren.
Zusätzlich: `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`, und
`scripts/migration-check.mjs` mit `UWE_STRICT_MIGRATION_DRIFT=1`.

---

# 6. Was ich NICHT löschen würde, bevor es herausgeholt ist

Gelöscht wird trotzdem alles — aber nicht vorher.

### 6.1 Die KI-Validatoren — das Beste im Repo an strukturierter Ausgabe

`packages/atlas/src/plot-fill-proposal.ts` (380 Z., Test 95 Z.) und
`rtx-asset-proposal.ts` (693 Z., Test 183 Z.).
**Nicht löschen — sie laufen produktiv** (`ai-brain/proposals.ts:1-2`,
`tasks.ts:1`) und sind zugleich die Vorlage für `terra-welt-entwurf.ts` (J4).

Was sie leisten, konkret:
- **Ausführbarer Code wird rekursiv abgelehnt** — `scanExecutable`
  (`plot-fill-proposal.ts:138-166`) mit `WeakSet`-Zyklusschutz, 16 verbotene
  Schlüsselnamen (`:82-96`), 7 Quelltext-Regexe (`:98-106`).
- **Whitelist statt Blacklist** — `rejectUnknown` (`:125-136`); jedes unbekannte
  Feld erzeugt `unexpected_field`.
- **Harte Wertebereiche** (`:246-252`, `:314-315`) und Kreuzvalidierung
  (`:254-259`, `scaleMin <= scaleMax`).
- **Registry-Referenzprüfung** (`:241-243`): keine freien Strings.
- **Das Ergebnis ist ein neu gebautes Objekt** (`:324-338`), nie das Rohobjekt.
- **Der Prompt-Kontext kommt aus derselben Registry wie die Validierung**
  (`:345-380`) — die eine Stelle, die es unmöglich macht, dass Prompt und
  Validator auseinanderlaufen. Genau das braucht J4, wo der Wertebereich aus
  Terras `PARAMS`-Schema abgeleitet werden soll.
- Fehlermodell `{path, code, message}` mit fünf Codes (`:34-45`) und
  `{ok:true, proposal, warnings[]} | {ok:false, errors[]}`.

`rtx-asset-proposal.ts` ergänzt: diskriminierte Union über `outputType`
(`:22-24`, `:90-98`), sichere Regexe (`:227-230`, `SAFE_PATH` erlaubt nur
SVG-Pfadkommandos), fixiertes Koordinatensystem (`:63`).

### 6.2 Das Review-Muster: KI-Ausgabe ist nie Kanon

`packages/ai-brain/src/proposals.ts:144-198` — bei `ok:false` bleibt der Rohtext
als Review-Artefakt erhalten (`validation: "invalid"` + `errors`), bei `ok:true`
das kanonisierte JSON. **In beiden Fällen** `autoApply: false`,
`visibility: "dm_only"`, `status: "pending"`. Geprüft von
`brain-actions.test.ts:89-124` und `:126-179`.
Auf der UI-Seite dasselbe: `Atlas3DDescribePanel.tsx:5-9` — „zeigt das Ergebnis
read-only und lässt den DM kopieren oder verwerfen — nie automatisch in den
Kanon übernommen." Das ist das Muster, das J4 ausdrücklich übernehmen will.

### 6.3 Der dreifache Guard

`apps/studio/app/atlas3d-actions.ts:29-39` (`requireNodeInWorld`) plus das
Aufrufpaar `requireStudioActionAuth()` / `requireStudioWorldEdit(worldSlug)` an
allen acht Actions. Vor dem Löschen wörtlich für Terra nachbauen — das ist
weniger „Vorlage" als „Prüfliste".

### 6.4 Der Vererbungs-Resolver

`packages/atlas-editor/src/inheritance.ts` (106 Z., Test 81 Z.) —
`resolveEffectiveNodeSettings` liefert nicht nur den effektiven Wert, sondern
auch **dessen Herkunft** (`effective.origins.environment.*`,
`page.tsx:130-131`). Die UI zeigt daraus „geerbt von X" / „hier überschrieben".
Terras Ebenen-Hierarchie (I1) braucht genau dasselbe. Nicht abschreiben —
verstehen und neu bauen, das Konzept ist die Übernahme wert.

Achtung: `inheritance.ts:34` definiert
`ATLAS3D_DEFAULT_PALETTE_SCOPE = ["natur","siedlung","gewaesser","weltenbau"]` —
das sind **persistierte Werte**, kein reiner Anzeigetext.

### 6.5 Der Service als Muster für Terras Persistenz

`packages/database/src/atlas3d-service.ts` (440 Z.). Besonders:
- `getOrCreateForWorld` (`:75`) — Lazy-Bootstrap pro Welt
- `getNodeChain` (`:122`) mit Tiefenbegrenzung
- `deleteNodeSubtree` (`:245`) — blattzuerst, FK-sicher
- **Replace-all-Speichern** (`:320` Objekte, `:349` Features, `:390` Bookmarks) —
  „the editor always sends the full set". Terra macht es mit seinem
  Ein-Blob-`TerraStand` ohnehin so, aber die Fehlerbehandlung lohnt einen Blick.
- `:406` — „Full player-visible read for the Portal viewer (identical data to
  Studio, read-only)": eine Lesefunktion für beide Apps, keine zweite Wahrheit.

### 6.6 Autosave — als Warnung, nicht als Vorlage

`Atlas3DEditorShell.tsx:178-198`. Übernehmen: Debounce (1200 ms) und die drei
Zustände „ungespeichert / speichert … / gespeichert / Fehler" (`:151`, `:427-428`).
**Nicht übernehmen: das Fehlen des `beforeunload`-Flushs.** Terra hat mit
`terra/src/editor/io.js:509-586` bereits einen LocalStorage-Ringpuffer (4 Slots,
4 MB Deckel) und laut `:931` einen synchronen Schreibvorgang beim Verlassen —
das ist Atlas voraus und sollte bleiben.

### 6.7 Die Tests — 205 Fälle

`packages/atlas-3d/src/*.test.ts` (30 Dateien), `packages/atlas-editor/src/*.test.ts`
(4), `packages/database/src/atlas3d-service.test.ts` — zusammen **205
`it()`/`test()`-Fälle**. Die wertvollsten für Terra, weil sie Verfahren prüfen,
die Terra ebenfalls braucht:

| Datei | Prüft |
|---|---|
| `erosion.test.ts` (108 Z.) | Erosion — Terra I3 |
| `hydrology.test.ts` (64) | Abflussfeld — Terra I3 |
| `contours.test.ts` (43) | Höhenlinien |
| `height-layers.test.ts` (151) | Höhen-Layer-Stack — Terra I1 |
| `biome-derive.test.ts` (35) | Biom-Ableitung — Terra I2 |
| `wfc-settlement.test.ts` (134) | Wave-Function-Collapse-Siedlungen |
| `surface-nets.test.ts` (68) | Isoflächen-Meshing |
| `terrain-path.test.ts` (70) | Pfade auf Gelände |
| `landmass-templates.test.ts` (102) | Landmassen-Vorlagen |
| `names.test.ts` (40) | Namensgenerator — **Terra J3** |
| `atlas-editor/carve.test.ts` (109), `commands.test.ts` (93) | CSG + Undo/Redo |
| `atlas3d-service.test.ts` (211) | Mandanten, Subtree-Löschung, Replace-all |

Empfehlung: Vor Schritt 5 die Testdateien der Verfahren, die Terra in Runde I
nachbaut (Erosion, Hydrologie, Höhenlayer, Biome, Namen), in Terras Testordner
**portieren statt kopieren** — Terra hat andere Datenstrukturen, aber dieselben
Invarianten.

### 6.8 Der Namensgenerator als Negativvorlage
`packages/atlas-3d/src/names.ts` (146 Z.) — vier Kulturen mit Silbenlisten.
J3 will bewusst etwas Besseres (Bestimmungswort + Grundwort, ortsabhängig). Vor
dem Löschen einmal lesen, um zu sehen, wo der Silbenkompositor an seine Grenzen
kommt.

### 6.9 Die Migrationen als Formvorlage
`20260721120000_atlas3d_foundation/migration.sql` (119 Z.) und
`20260721150000_drop_legacy_atlas/migration.sql` (25 Z.) — die eine zeigt eine
saubere Foundation (reines `CREATE TABLE` + `CREATE INDEX`, keine
Datenmigration, NOT-NULL mit Defaults statt Nullables), die andere einen
sauberen Drop mit explizitem Owner-Entscheid im Kommentar. Terras Modelle sollten
demselben Muster folgen — und die Drop-Migration `IF EXISTS` ergänzen, das fehlt
der Vorlage.

---

## Anhang: Die drei gefährlichsten Fundstellen

1. **`packages/cookbook/src/ai-types.ts:32-35` + `routing-hints.ts:29-30`** —
   Handkopie der Task-Typ-Union ohne Compiler- oder Testverbindung
   (`ai-types.ts:1` gibt das selbst zu). Das Löschen in `security` erzeugt hier
   **keinen Fehler**. Die Union über neun Dateien ist also nicht so
   compilergeprüft, wie die Planung annimmt.

2. **`packages/atlas/src/{plot-fill-proposal,rtx-asset-proposal}.ts`** — leben in
   einem Paket, das nach „alter 2D-Atlas, kann weg" aussieht, sind aber die
   einzigen produktiven KI-Validatoren des Repos. Ein `rm -rf packages/atlas`
   bricht Brain sofort. Zusätzlich hängen an `rtx-asset-proposal.ts:15-18` vier
   `docs/prompts/atlas-*`-Dateien als Laufzeit-Pfade.

3. **`packages/auth/src/security-headers.ts:63-66, 79-81, 147-149`** — die
   Kommentare nennen „atlas.html", die Werte (`frame-src 'self'`,
   `frame-ancestors 'self'`, `X-Frame-Options: SAMEORIGIN`) sind aber genau das,
   was Terras Frame braucht. Wer beim `git grep -i atlas`-Aufräumen die
   Direktiven mitnimmt, macht J1 unmöglich — und merkt es erst, wenn der Frame
   leer bleibt.

Knapp dahinter: **`apps/studio/src/lib/studio-navigation.ts:302`**
(`startsWith("${base}/atlas")` fängt `/atlas` *und* `/atlas3d`) und der
**fehlende Postgres-Migrationszweig**.
