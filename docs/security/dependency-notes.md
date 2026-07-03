# Dependency-Notes — Overrides & Build-Script-Allowlist

Dokumentiert nicht offensichtliche Dependency-Entscheidungen im Root der Workspace.
Geprüft am 2026-07-03.

## pnpm-Override: `nodemailer: ^9.0.1`

**Wo:** Root-`package.json` → `pnpm.overrides.nodemailer`.

**Herkunft:** Eingeführt über PR #341 (Merge-Commit `9b88e58`, Branch
`cursor/backlog-b3-owner-cockpit-c636`) — ohne dokumentierte Begründung im
Commit oder CHANGELOG. Laut `docs/engineering/cleanup-inventory.md` und
`docs/engineering/TECHNICAL_ROADMAP.md` gab es zuvor doppelte `pnpm`-Blöcke
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
