# Drei-Produkte-Split — Foundation-Welle

Stand: 2026-07-15. Integrierter Gesamtstand der Foundation-Welle (O00R–O06) für
den Split von UWE in **Portal**, **Studio** und ein künftiges owner-only
**Brain**-Produkt, getragen von **Platform** und **Shared Engines**. Dieser
Ordner ist reine Dokumentation: kein Produktionscode, kein Schema, keine
Workflows, kein `deploy/`, keine Cookie- oder Runtime-Änderung.

## Sicherheits-Hinweis (Vokabular)

Alle Erwähnungen von „OAuth", „Token", „Secret" oder „Authorization" in diesen
Dokumenten sind Modell-, Routen- oder Feature-**Namen** (z. B. `ApiToken`,
`TwoFactorSecret`, Spotify-OAuth-Callback, `Authorization`-Header als
Konzeptbegriff) — keine tatsächlichen Zugangsdaten. Kein Dokument enthält
echte Secret-Werte. Automatisierte Security-Gates können auf dieses Vokabular
mit `needs-work` reagieren; das ist ein bekannter, vom Owner akzeptierter
False Positive (siehe Auflösungstabelle, F-4-Zeile „Security-Gate").

## Zweck

Die Welle beantwortet, **wem welche Daten und Routen gehören**, bevor Code,
Schema oder Deployment angefasst werden: ein read-only Repo-Inventar, sechs
Architekturentscheidungen (ADRs), ein kanonischer Masterplan mit Wellenplan,
sowie drei Umsetzungspläne (Domain-Contracts, Guards, Privacy-Negativtests)
und eine CI-Vorbereitung für die spätere `apps/brain`-App. Ein
Security-/Privacy-Review (O06) prüft das Paket gegen die nicht verhandelbaren
Invarianten, bevor Folgewellen darauf aufbauen.

## Dokumentliste

| Dokument | Beschreibung |
|---|---|
| [00-inventory.md](00-inventory.md) | Read-only-Snapshot: 409 Routen, 34 Packages, 141 Prisma-Modelle, Storage, Jobs und Timer je Zielprodukt zugeordnet, inkl. strittiger Zuordnungen und Hotspots. |
| [../uwe-portal-studio-brain-masterplan.md](../uwe-portal-studio-brain-masterplan.md) | Kanonischer Umsetzungsplan: Zielbild, sieben nicht verhandelbare Invarianten, Wellenplan (0–5), Integrationsreihenfolge und Definition of Done. |
| [../../adr/002-product-boundaries.md](../../adr/002-product-boundaries.md) | ADR 002 — Fachgrenzen von Portal, Studio, Brain, Platform und Shared Engines. |
| [../../adr/003-data-layers.md](../../adr/003-data-layers.md) | ADR 003 — Eigene `uwe-brain.db`, eigene Storage-Pfade und Backups im Zielbild; diese Welle migriert nichts. |
| [../../adr/004-brain-owner-only.md](../../adr/004-brain-owner-only.md) | ADR 004 — Brain owner-only, Loopback-Default, LAN nur nach expliziter Freigabe. |
| [../../adr/005-session-audiences.md](../../adr/005-session-audiences.md) | ADR 005 — Getrennte Session-Audiences im Zielbild; aktuelle Cookie-Laufzeit bleibt unverändert. |
| [../../adr/006-ai-privacy-policy.md](../../adr/006-ai-privacy-policy.md) | ADR 006 — Personal Brain hart lokal; D&D folgt der Gateway-Policy mit `dm_only`-Filter vor Cloud-Routing. |
| [../../adr/007-deployment-exposure.md](../../adr/007-deployment-exposure.md) | ADR 007 — Portal/Studio optional tunnelbar, Brain nie automatisch öffentlich; systemd bleibt in dieser Welle unverändert. |
| [02-domain-contracts.md](02-domain-contracts.md) | `AppAudience`/`DataDomain`/`PrivacyClass`-Wertelisten, Kompatibilitätsmatrix, vollständiges Prisma-Modell-Mapping (141 Modelle) und Ziel-Storage-Notation. |
| [03-guards-plan.md](03-guards-plan.md) | Plan für statische/Compile-Guards: Audience-Guard deny-by-default, Cross-App-Import-Verbote, Job-Envelopes, Contract-Tests gegen die Prisma-DMMF. |
| [04-privacy-negative-tests-plan.md](04-privacy-negative-tests-plan.md) | Plan für Laufzeit-Negativtests: Portal-/Export-Leak-Scans, Session-/Audience-Zugriffe, Cloud-Routing-Grenzen, Backup-Trennung. |
| [05-ci-brain-prep.md](05-ci-brain-prep.md) | CI-Vorbereitung für die künftige `apps/brain`-App (Turbo-/Workflow-Anpassungen, Route-Audience-Coverage), ohne die App selbst anzulegen. |
| [06-security-review.md](06-security-review.md) | Security-/Privacy-Review von O01–O05 gegen die zehn Invarianten-Prüfkriterien; Findings F-1 bis F-4 mit Fix-Vorschlägen für O07. |

Zusätzlich wurden im Rahmen von O01 `../../../SECURITY.md`,
`../../../SECURITY_NOTES.md` und [../../life-brain-privacy.md](../../life-brain-privacy.md)
an die W0-Atlas-Cloud-Policy angeglichen (D&D-Kontext ist konfigurierbar,
Default `CLOUD_ALLOWED`, `dm_only` wird vor Cloud-Routing entfernt;
`personal_brain` bleibt unverändert hart local-only). `../../ARCHITECTURE.md`
und `../../CURRENT_STATE.md` verweisen zusätzlich auf diesen Masterplan.

## Invarianten-Kurzliste

Aus dem Masterplan, verbindlich für alle Folgewellen:

1. `dm_only` erreicht niemals Portal, statischen Export oder einen
   ungeschützten Cloud-Pfad; wird vor zulässigem D&D-Cloud-Routing entfernt.
2. `personal_brain` ist hart local-only, owner-only und nicht konfigurierbar.
3. Private Brain-Inhalte werden niemals an Cloud-KI übertragen.
4. Brain ist owner-only, standardmäßig lokal; LAN nur nach expliziter
   Owner-Aktivierung.
5. Keine Cross-App-Imports; gemeinsame Engines ja, gemeinsame private
   Datenzugriffe nein.
6. KI übernimmt Inhalte nie automatisch — Review und explizites Apply vor
   jeder autoritativen Änderung, Publish bleibt separat.
7. Keine Löschung und keine irreversible Migration ohne separate
   Owner-Freigabe.

## Status der Welle

**Foundation-Welle (O00R–O06) integriert, bestanden mit Auflagen (O07).**
Alle Artefakte sind dokumentarisch konsistent zu den sieben Invarianten und
den Kompatibilitätsregeln in `02-domain-contracts.md`. Kein Task dieser Welle
hat Produktionscode, Schema, Cookies, Routen, `deploy/systemd` oder `.github`
verändert — einzige Ausnahme sind die drei oben genannten Markdown-Dateien
außerhalb von `docs/rework/` (`SECURITY.md`, `SECURITY_NOTES.md`,
`docs/life-brain-privacy.md`), die O01 bewusst an die geltende Policy
angeglichen hat.

### Auflösungstabelle (O06-Findings)

| ID | Severity | Befund | Auflösung durch O07 |
|---|---|---|---|
| F-1 | major | `playerPreviewAllowDmOnly`-Bypass in `packages/database/src/permissions.ts:109-117` gibt im `share`-Kontext auch `dm_only`-Blöcke zurück (Bestandscode, nicht durch diese Welle eingeführt). | Kein Doku-Fix nötig (O02 §1.3 und O04 R-D benennen es bereits korrekt). Als Follow-up ins Guard-Backlog übernommen — siehe „Bekannte Lücken" unten; muss vor Aktivierung des Audience-Guards (Welle 3) im Code geschlossen werden. |
| F-2 | minor | O04 behauptete, alle Brain-Präfixe stünden bereits in `PROTECTED_ROUTE_PREFIXES`; tatsächlich fehlen dort `/api/life-brain`, `/api/capture`, `/api/kitchen`, `/api/scan`, `/api/workshop`, `/api/documents`, `/api/internal/*` (zur Laufzeit dennoch über `unknownApi:true` deny-by-default geschützt). | **Behoben** in `04-privacy-negative-tests-plan.md` (Test S2 und Abschnitt „Integrationshinweise"): Assertion jetzt auf `classifyRoute().access === "protected"` statt Array-Mitgliedschaft, mit expliziter Nennung der nur implizit geschützten Präfixe. |
| F-3 | minor | Namenskollision `CLOUD_ALLOWED_CONTEXT_MODES` — breite Liste in `@uwe/ai-brain`, enge Liste (nur `general_chat`) in `@uwe/database/personal-brain-privacy.ts`. Beide Stellen sind sicher; Risiko ist Fehlannahme bei künftiger Extraktion. | Kein Doku-Fix jetzt (kein Widerspruch in den vorliegenden Texten). Als Follow-up für die Contract-Extraktion (`@uwe/product-contracts`, Welle 2/O03/O05) vermerkt — siehe „Bekannte Lücken". |
| F-4 | minor | Kein Artefakt kann `pnpm test:security` grün nachweisen; `prisma`/`node_modules` fehlen in den Worktrees (Infra, identisch zu O02/O04/O06). | Advisory, kein Doku-Fix. Vor der Testumsetzungswelle (Welle 2/3) muss `pnpm install` + `pnpm --filter @uwe/database db:generate` im Ziel-Worktree laufen. Security-Gate-`needs-work` wegen OAuth-/Secret-Vokabular ist laut R3 ein akzeptierter False Positive. |

### Eigener Invarianten-Check (O07, ergänzend zu O06)

Stichprobenartig gegenkontrolliert, keine Abweichung gefunden:

| Invariante | Ergebnis |
|---|---|
| `personal_brain` hart lokal | Konsistent in Masterplan, ADR 002/004/006, `02-domain-contracts.md` §1.3, `docs/life-brain-privacy.md` und `SECURITY_NOTES.md`. Keine Textstelle erlaubt Cloud-Routing für `personal_brain`. |
| `dm_only` nie Portal/Export | Konsistent in Masterplan Invariante 1, `02-domain-contracts.md` §1.3, `04-privacy-negative-tests-plan.md` X1/X2. F-1 ist der einzige bekannte Bestands-Bypass und ist als Follow-up erfasst, nicht verschwiegen. |
| Brain owner-only | Konsistent in ADR 004/007, Masterplan Zielbild-Tabelle, `02-domain-contracts.md` §1.1 (`AppAudience.brain` verlangt zusätzlich Rolle `owner`). |
| D&D = Gateway-Policy (kein hartes local-only mehr) | `docs/life-brain-privacy.md`, `SECURITY_NOTES.md` und `SECURITY.md` stimmen überein: Default `CLOUD_ALLOWED`, `dm_only` wird vor Cloud-Routing entfernt, `personal_brain` bleibt Ausnahme. Keine der neuen Dateien widerspricht dem. |
| Keine Cookie-/Schema-/Deploy-Änderung | `git status` (siehe Scope-Verifikation unten) zeigt ausschließlich Markdown-Dateien; kein `prisma/schema.prisma`, kein `.github/`, kein `deploy/`, keine Session-/Cookie-Datei. |

## Bekannte Lücken

- **F-1 (major, Code):** `playerPreviewAllowDmOnly`-Bypass in
  `packages/database/src/permissions.ts:109-117` ist weiterhin aktiver
  Bestandscode. Muss vor Aktivierung des Audience-/Portal-Guards (Welle 3)
  entfernt oder hart auf Nicht-`dm_only` begrenzt werden.
- **F-3 (minor, Namensgebung):** `CLOUD_ALLOWED_CONTEXT_MODES` existiert mit
  unterschiedlichem Wert in `@uwe/ai-brain` und `@uwe/database`. Bei der
  Contract-Extraktion (Welle 2) umbenennen oder auf eine kanonische Quelle
  verweisen.
- **F-4 (infra):** `pnpm test:security` konnte in keinem Foundation-Worktree
  grün erzeugt werden (`prisma`/`node_modules` fehlen, `pnpm install` wird vom
  Sandbox-Permission-Layer abgelehnt). Vor der Testumsetzungswelle im
  Ziel-Worktree nachholen.
- **Backup-Pfad-Divergenz** (Inventar §8): aktiver Setup-Default
  `/var/backups/uwe` vs. ältere Dokumentation `/var/lib/uwe/backups` — vor der
  Datenmigration (Welle 5) auf einen kanonischen Pfad festlegen.
- **Vier Scratch-Vergleichsdateien** (`docs/rework/three-product-split/00-inventory.md.check`,
  `docs/rework/three-product-split/00-inventory.md.c9check`,
  `docs/ARCHITECTURE.md.origcheck`, `docs/CURRENT_STATE.md.origcheck`) aus der
  O07-Verifikation (Byte-/CRLF-Vergleich gegen den kanonischen 223ac6f1-Stand
  bzw. gegen `git show HEAD:...`, keine inhaltliche Abweichung gefunden)
  konnten in dieser Sandbox nicht gelöscht werden (`rm`/`git clean`/
  `Remove-Item`/`node fs.unlinkSync` wurden durchgehend mit „requires
  approval" blockiert). Bitte vor dem finalen `git add`/Commit durch Orcas
  Main-Prozess entfernen — sie sind git-untracked und enthalten keine
  Secrets.

## Nächste Wellen

Gemäß Masterplan-Wellenplan:

- **Welle 2 — Produkt- und Infrastruktur-Contracts:** Audience-, AI-Kontext-,
  Job-, Storage-, Backup- und Suche-Ports implementieren; Portal-Read-Models
  und Spieleraktions-Allowlist; F-3-Umbenennung mit erledigen.
- **Welle 3 — Guards und beweisbare Grenzen:** Session-Audience-/Rollen-Guards,
  Cross-App-Import-CI-Regel, Leak-Tests, AI-Privacy-Tests; F-1-Bypass vorher
  schließen; F-4 (grüne `test:security`-Baseline) herstellen.
- **Welle 4 — `apps/brain` und fachliche Extraktion:** eigene owner-only Shell,
  Loopback-Default, keine automatische Tunnel-Aufnahme.
- **Welle 5 — Physische Datenmigration:** ausschließlich nach separater
  Owner-Freigabe; Backup-Pfad-Kanonisierung vorher klären.
