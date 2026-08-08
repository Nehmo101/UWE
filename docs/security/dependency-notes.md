# Dependency-Notes — Overrides & Build-Script-Allowlist

Dokumentiert nicht offensichtliche Dependency-Entscheidungen im Root der Workspace.
Geprüft am 2026-07-03, Overrides für Advisories ergänzt am 2026-07-28.

## pnpm-Override: `nodemailer: ^9.0.1`

**Wo:** `pnpm-workspace.yaml` → `overrides` (bis 2026-07-28: Root-`package.json` → `pnpm.overrides`).

**Herkunft:** Eingeführt über PR #341 (Merge-Commit `9b88e58`, Branch
`cursor/backlog-b3-owner-cockpit-c636`) — ohne dokumentierte Begründung im
Commit oder CHANGELOG. Laut `docs/engineering/TECHNICAL_ROADMAP.md` gab es zuvor doppelte `pnpm`-Blöcke
in der Root-`package.json`, die auf diesen einen Override zusammengeführt
wurden.

**Vermutlicher Zweck:** CVE-Pinning bzw. Versions-Konsistenz — der Override
erzwingt, dass auch transitive `nodemailer`-Abhängigkeiten auf >= 9.0.1
aufgelöst werden. Ältere nodemailer-Major-Versionen (< 6.9.9 / < 7) hatten
bekannte Advisories (u. a. Adress-Interpretation-Conflicts). Ursprung im
Detail unklar; vermutlich CVE-Pinning, geprüft am 2026-07-03.

**Aktueller Stand:** Der einzige direkte Konsument ist
`packages/mail/package.json` mit `nodemailer: ^9.0.1` — identisch zum
Override. Der Override ist damit nur relevant, falls eine andere Dependency
transitiv eine ältere nodemailer-Version anfordert.

**Wann kann der Override entfernt werden?**

1. Prüfen, ob nodemailer noch transitiv vorkommt:
   `pnpm why -r nodemailer`
2. Wenn ausschließlich `@uwe/mail` nodemailer direkt anfordert (bereits
   `^9.0.1`) und keine transitive Abhängigkeit eine ältere Version zieht,
   kann der Override entfernt werden.
3. Danach `pnpm install` ausführen, Lockfile-Diff prüfen (keine
   nodemailer-Version < 9.0.1 darf auftauchen) und `pnpm audit` laufen
   lassen.

## Overrides gegen Advisories (2026-07-28)

`pnpm audit:prod` meldete acht Befunde der Stufe *high*. Vier Pakete waren die
Ursache, drei davon nur transitiv erreichbar:

| Paket | Vorher | Nachher | Advisory |
|-------|--------|---------|----------|
| `next` | 15.5.19 | 15.5.22 | DoS im App Router, SSRF in Server Actions, SSRF in Rewrites |
| `sharp` | 0.34.5 | 0.35.3 | geerbte libvips-Lücken |
| `postcss` | 8.5.15 | 8.5.23 | Path Traversal über `sourceMappingURL` |
| `fast-uri` | 3.1.2 | 3.1.4 | Host-Confusion (über Prisma) |
| `linkify-it` | 5.0.1 | 5.0.2 | quadratische Laufzeit bei `mailto:` |

**`next`** und **`sharp`** stehen als direkte Abhängigkeit in den Apps; deren
Bereiche wurden angehoben (`^15.5.21`, `^0.35.0`). Bei `next` ist der Bereich
absichtlich präzise: `^15.3.4` hätte den Patch zwar zugelassen, aber nicht
verlangt — das Lockfile blieb monatelang auf 15.5.19.

**`sharp` zusätzlich als Override**, weil `next` selbst noch 0.34.5 mitbringt.

**`fast-uri` und `linkify-it` mit Major-Deckel** (`>=3.1.4 <4`, `>=5.0.2 <6`).
Ohne den Deckel zieht pnpm auf 4.x bzw. 6.x — beim ersten Versuch brach damit
jeder Test in `packages/database` mit `require(...) is not a function`. Gepatcht
werden soll die Lücke, nicht die Schnittstelle: bei einem Override auf eine
transitive Abhängigkeit gehört der Major-Deckel dazu, weil der Aufrufer die neue
Major nicht kennt.

**Ein Folgefehler, der beim Bump auffiel:** `sharp` 0.35 exportiert seine Typen
anders — bis 0.34 war `typeof import("sharp")` selbst aufrufbar, jetzt ist es der
Namensraum und der Konstruktor steckt in `default`. `packages/assets/src/image-processing.ts`
typt entsprechend um; der Laufzeitpfad (`mod.default ?? mod`) bleibt.

**Nachtrag (gleicher Tag):** auch die restlichen sechs Befunde (fünf *moderate*,
ein *low*) sind geschlossen — `hono` (drei Advisories, u. a. XSS über `cx()`),
`@hono/node-server` (Memory-Leak; der alte Pin `>=1.19.13` ließ 2.0.8 durch,
weil 2.x das `>=` erfüllt), `valibot` (`flatten()`-Wurf) und `dompurify`
(`CUSTOM_ELEMENT_HANDLING`-Bypass — das ist die Bibliothek unter dem
Mail-Reader-Sanitizer). Alle vier transitiv, alle als Override mit
Major-Deckel. `pnpm audit --prod` meldet damit: keine bekannten Lücken.

**Die Overrides liegen jetzt in `pnpm-workspace.yaml`, nicht mehr in
`package.json#pnpm.overrides`.** pnpm 10 liest beide Orte, pnpm 11 nur noch die
Workspace-Datei — beim Umstieg wären die Pins sonst still weggefallen
(`audit:prod` warnte bereits, weil es per `dlx` pnpm 11 benutzt). Gleiches
Muster wie bei `onlyBuiltDependencies`, siehe unten.

**Nachtrag (2026-08-04):** `fast-uri` von `>=3.1.4 <4` auf `>=3.1.5 <4`
angehoben — neuer GHSA-Befund (*high*): Host-Confusion über einen
Backslash-Authority-Introducer, verwundbar `>=3.0.0 <3.1.5`. Der Konsument ist
unverändert Prisma (transitiv, über `@prisma/dev` → `@prisma/streams-local` →
`ajv 8.20.0`). ajvs Range `^3.0.1` hätte 3.1.5 zwar zugelassen, aber der alte
Override-Boden `>=3.1.4` hätte 3.1.4 weiterhin erlaubt — gleiche Logik wie beim
`next`-Bereich oben: der Patch soll verlangt werden, nicht nur möglich sein.
Major-Deckel `<4` bleibt aus demselben Grund wie oben bestehen. Verifiziert mit
`pnpm why -r fast-uri`: überall 3.1.5.

**Nachtrag (2026-08-08):** `nanoid` als transitiven Override
`>=3.3.17 <4` ergänzt. `GHSA-2v37-7h3g-55p8` betrifft benutzerdefinierte
Generatoren in Versionen vor 3.3.17, die bei einer Größe von null endlos laufen
können. UWE zieht `nanoid` ausschließlich über `postcss`, unter anderem aus
Next.js, Tailwind CSS und Vite. Der Major-Deckel bewahrt die von diesen
Konsumenten erwartete 3.x-Schnittstelle. Verifiziert wird mit
`pnpm why -r nanoid` und `pnpm audit:prod`.

## `onlyBuiltDependencies` — eine Quelle: `pnpm-workspace.yaml`

pnpm 10 liest `onlyBuiltDependencies` aus `pnpm-workspace.yaml`; diese Quelle
hat Vorrang und ist hier die einzige gepflegte Liste (verifiziert mit
`pnpm config get onlyBuiltDependencies` unter pnpm 10.12.1 — es wird die
Liste aus `pnpm-workspace.yaml` zurückgegeben):

- `esbuild`
- `sharp`
- `prisma`
- `@prisma/engines`
- `better-sqlite3`

Die früher zusätzlich in `.npmrc` gepflegten `onlyBuiltDependencies[]`-Einträge
(3 Stück, gedriftet: ohne `esbuild`/`sharp`) waren wirkungslos, weil die
Workspace-YAML sie überschattet. Sie wurden am 2026-07-03 entfernt.
**Regel:** Neue Build-Script-Freigaben nur in `pnpm-workspace.yaml` eintragen,
nicht in `.npmrc`.
