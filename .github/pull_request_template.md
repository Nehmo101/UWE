## Worum geht es?

<!-- Was ändert sich und warum? Das "Was" steht im Diff — beschreib das "Warum". -->

## Verwandtes Issue

<!-- z. B. "Schließt #123". Bei kleinen Korrekturen: "keins". -->

## Art der Änderung

- [ ] Bugfix (behebt ein Problem, ändert kein bestehendes Verhalten)
- [ ] Feature (neues Verhalten)
- [ ] Breaking Change (bestehendes Verhalten oder Einrichtung ändert sich)
- [ ] Dokumentation
- [ ] Betrieb / CI

## Wie getestet?

<!-- Welche Tests sind dazugekommen? Was hast du manuell geprüft? -->

## Checkliste

- [ ] `pnpm quality` läuft lokal grün (oder `pnpm ci:light` bei kleinem Umfang)
- [ ] Neues Verhalten ist durch Tests abgedeckt; Bugfixes haben einen Test, der ohne den Fix fehlschlägt
- [ ] Fachlogik liegt in `packages/`, nicht in Route Handlers oder Komponenten
- [ ] Neue Dateien bleiben unter 700 Zeilen; `scripts/file-size-baseline.json` wurde **nicht** erhöht
- [ ] Keine Cross-App-Imports, keine Server-only Module in Client Components
- [ ] Keine Secrets im Diff (`pnpm secret:scan`)
- [ ] Dokumentation angepasst, falls sich Verhalten oder Einrichtung ändert

## Sichtbarkeitsgrenzen

<!-- Nur ausfüllen, wenn der PR Inhalte, Auth, Export oder KI-Routing berührt. -->

- [ ] `dm_only`-Inhalte erreichen weiterhin nicht das Portal
- [ ] `owner_private_local`-Inhalte verlassen weiterhin nicht den Host
- [ ] Nicht zutreffend

## Schema-Änderungen

<!-- Nur ausfüllen, wenn `schema.prisma` berührt wird. -->

- [ ] Migration liegt bei und wurde gegen eine bestehende Datenbank getestet
- [ ] Nicht zutreffend
