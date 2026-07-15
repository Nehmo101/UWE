# O06 — Security-/Privacy-Review des Foundation-Pakets (Drei-Produkte-Split)

Stand: 2026-07-15. Dieses Dokument ist ein **read-only Review** der Ergebnisse
der Tasks O01–O05. Es ändert keinen geprüften Text und keinen Produktionscode.
Korrekturbedarf ist als priorisierte Findings an den Integrator (O07) formuliert.

## 0. Prüfumfang und Methode

Geprüft wurde die dokumentarische Konsistenz der Foundation-Welle gegen die
sieben nicht verhandelbaren Invarianten sowie die stichprobenhafte Übereinstimmung
mit dem echten Runtime-Code. Reine Leseoperationen; keine git-Mutationen.

### 0.1 Geprüfte Quellen je Artefakt

| Artefakt | Quelle | Status |
|---|---|---|
| Inventar O00 | `git show 223ac6f17…:docs/rework/three-product-split/00-inventory.md` | geprüft |
| Masterplan | `git show d2eff71a:docs/rework/uwe-portal-studio-brain-masterplan.md` | geprüft |
| ADR 002 Produktgrenzen | `git show d2eff71a:docs/adr/002-product-boundaries.md` | geprüft |
| ADR 003 Datenebenen | `git show d2eff71a:docs/adr/003-data-layers.md` | geprüft |
| ADR 004 Brain owner-only | `git show d2eff71a:docs/adr/004-brain-owner-only.md` | geprüft |
| ADR 005 Session-Audiences | `git show d2eff71a:docs/adr/005-session-audiences.md` | geprüft |
| ADR 006 KI-/Privacy-Policy | `git show d2eff71a:docs/adr/006-ai-privacy-policy.md` | geprüft |
| ADR 007 Deployment/Exposure | `git show d2eff71a:docs/adr/007-deployment-exposure.md` | geprüft |
| O01 Doku-Angleichung | `git show d2eff71a -- SECURITY.md docs/life-brain-privacy.md` (Diff) | geprüft |
| O02 Domain-Contracts | `git show 837a708c:docs/rework/three-product-split/02-domain-contracts.md` | geprüft |
| O03 Guards-Plan | `git show e70e6a45:docs/rework/three-product-split/03-guards-plan.md` | geprüft |
| O04 Privacy-Negativtests | `git show fe6d044d:docs/rework/three-product-split/04-privacy-negative-tests-plan.md` | geprüft |
| O05 CI-Brain-Prep | `git show f41d0b10:docs/rework/three-product-split/05-ci-brain-prep.md` | geprüft |

Kein Artefakt war „nicht prüfbar". Die Foundation-Dokumente liegen nicht im
Arbeitsbaum vor (der Ordner `docs/rework/three-product-split/` existiert dort
noch nicht); alle wurden aus den partiellen Vorgänger-Commits gelesen.

### 0.2 Code-Verifikation

| Prüfpunkt | Datei / Fundstelle | Befund |
|---|---|---|
| `LOCAL_ONLY_CONTEXT_MODES` | `packages/ai-brain/src/router/types.ts:73` | `["personal_brain","mail"]` — hart local-only. |
| `CLOUD_ALLOWED_CONTEXT_MODES` | `packages/ai-brain/src/router/types.ts:82` | `["general_chat","brain","current_object","current_object_plus_brain"]` — D&D cloud-fähig nach Policy. |
| `validateProviderContextCombination` | `packages/ai-brain/src/router/privacyGuard.ts:40` | wirft `AiPrivacyError`, wenn `cloud` + nicht-cloud-fähiger Kontext. |
| `validateResolvedRouteForContext` | `packages/ai-brain/src/router/privacyGuard.ts:55` | zweite Verteidigungslinie gegen Cloud-Route für lokalen Kontext. |
| `validateLocalRtxRequired` | `packages/ai-brain/src/router/privacyGuard.ts:88` | kein Cloud-Fallback für `personal_brain`/`mail` bei RTX offline. |
| `assertPersonalBrainLocalOnly` | `packages/database/src/personal-brain-privacy.ts:23` | erlaubt nur `local_rtx`/`auto`, lehnt `cloud`/Unbekannt ab. |
| Route-Policy deny-by-default | `packages/auth/src/security/route-policy.ts:292,307` | unbekannte APIs → `access:"protected", unknownApi:true`. |
| dm_only-Portalfilter | `packages/database/src/permissions.ts:119` | Portal/Share filtern auf `isBlockPlayerExposable` + Visibility. |
| `playerPreviewAllowDmOnly` | `packages/database/src/permissions.ts:109-117` | **Bypass** — gibt bei `share` alle Blöcke inkl. `dm_only` zurück (siehe F-1). |

## 1. Executive Summary

**Gesamturteil: BESTANDEN MIT AUFLAGEN.**

Das Foundation-Paket (Masterplan, sechs ADRs, O02–O05) ist architektonisch
kohärent und über alle Artefakte hinweg konsistent mit den sieben nicht
verhandelbaren Invarianten. Die dokumentierten Zielgrenzen decken sich mit dem
echten Code an den geprüften Stellen: Der AI-Privacy-Guard, die
`personal_brain`-Local-Only-Garantie und die deny-by-default Route-Policy
verhalten sich wie beschrieben. Die zentrale Doku-Vereinheitlichung von O01 hat
D&D-Kontext korrekt in Richtung `CLOUD_ALLOWED` (W0 Atlas) angeglichen und die
älteren „D&D = local-only"-Aussagen überschrieben.

Es wurden **keine Blocker gegen die Invarianten** gefunden. Die `[needs-work]`-
Markierungen von O01–O05 resultieren aus (a) Infrastruktur-Quality-Gate-Fehlern
(fehlendes `prisma`/`node_modules` im Worktree, `pnpm test`) und (b) den unter
R3 erwarteten Security-Gate-Vokabular-False-Positives (`oauth`, `secret-leak`,
`authorization`). Keiner dieser Punkte ist ein inhaltlicher Sicherheitsverstoß;
die Dokumente enthalten keine echten Secret-Werte.

Die Auflagen betreffen einen bestehenden Code-Bypass (den die Docs korrekt als
vor der Guard-Aktivierung zu schließen kennzeichnen) und zwei kleinere
Doku-Präzisierungen für O07.

## 2. Findings

Severity-Skala: **blocker** (verletzt eine Invariante / verhindert Integration),
**major** (echtes Risiko, muss vor Guard-Aktivierung adressiert werden),
**minor** (Präzisierung/Klarstellung ohne Sicherheitsbruch).

| ID | Severity | Fundstelle | Befund | Fix-Vorschlag für O07 |
|---|---|---|---|---|
| **F-1** | major | `packages/database/src/permissions.ts:109-117` (Bestandscode; markiert in O02 §10 „Preview-Ausnahme" und O04 R-D) | `filterBlocksForContext` gibt bei `context === "share"` **alle** Blöcke inklusive `dm_only` zurück, wenn `getUweRuntimeConfig().playerPreviewAllowDmOnly` gesetzt ist und die Seite im Share-Grant liegt. Das kollidiert mit Invariante 1 (`dm_only` nie Portal/Export). Nicht durch O01–O05 eingeführt (docs-only). | Kein Doku-Fix nötig — beide Docs benennen es bereits richtig. O07 muss diesen Punkt in das Integrations-Backlog der Guard-Welle (O03 §5.2 / O04 L5) übernehmen: Flag entfernen oder hart auf Nicht-`dm_only` begrenzen, bevor der Audience-Guard scharf geschaltet wird. Nicht als „erledigt" verbuchen, nur weil die Foundation-Welle keinen Code ändert. |
| **F-2** | minor | O04 § 2 Punkt 5 / § 3.3 S2 / § 5 „Integrationshinweise" vs. `packages/auth/src/security/route-policy.ts:98-151` | O04 formuliert, die Brain-Präfixe „stehen bereits in `PROTECTED_ROUTE_PREFIXES`". Tatsächlich fehlen dort explizit `/api/life-brain`, `/api/capture`, `/api/kitchen`, `/api/scan`, `/api/workshop`, `/api/documents` und `/api/internal/*`; enthalten sind u. a. `/api/mail`, `/api/projects`, `/api/calendar`, `/api/research`. Die fehlenden Präfixe sind zur Laufzeit dennoch geschützt — über den `unknownApi:true`-Default (`route-policy.ts:292,307`), der genau die deny-by-default-Regel ist. | O07: S2-Test so umsetzen, dass er `classifyRoute(pfad, surface).access === "protected"` prüft (nicht Array-Mitgliedschaft in `PROTECTED_ROUTE_PREFIXES`) und die deny-by-default-abhängigen Brain-Präfixe explizit als eigene Fälle abdeckt. Optional die fehlenden Präfixe explizit aufnehmen, damit „protected" nicht nur implizit ist. Formulierung in O04 präzisieren. |
| **F-3** | minor | `packages/database/src/personal-brain-privacy.ts:2` vs. `packages/ai-brain/src/router/types.ts:82` | Namenskollision: `CLOUD_ALLOWED_CONTEXT_MODES` existiert zweimal mit unterschiedlichem Wert — in `@uwe/ai-brain` breit (`general_chat`, `brain`, …), in `@uwe/database` eng (`["general_chat"]`). Verhalten ist an beiden Stellen sicher (die DB-Variante gilt nur für den `personal_brain`-Provider-Gate), aber der gleiche Name kann bei künftiger Extraktion (O03/O05) zu Fehlannahmen führen. Kein Invariantenbruch. | O07/O05: bei der Contract-Extraktion (`@uwe/product-contracts`) den engen DB-Wert umbenennen (z. B. `PERSONAL_BRAIN_CLOUD_CONTEXT_MODES`) oder auf die kanonische Liste aus `@uwe/ai-brain` verweisen. Rein kosmetisch/präventiv. |
| **F-4** | minor | Querschnitt aller Dokumente; `pnpm test:security` | Kein Artefakt kann `test:security` grün nachweisen; die Vorgänger-Blocker (O02/O04) sind Infra (`prisma`/`node_modules` fehlen im Worktree). Damit bleibt die Foundation-Welle rein statisch/dokumentarisch belegt. | O07: vor der Umsetzungswelle im Ziel-Worktree `pnpm install` + `pnpm --filter @uwe/database db:generate` sicherstellen, damit O04s geplante Negativtests gegen eine grüne Baseline entstehen. Kein Handlungsbedarf am Foundation-Text. |

**Blocker-Liste: keine.** Es existiert kein Finding der Severity *blocker*.

## 3. Echte `pnpm test:security`-Ausgabe

Ausgeführt im Worktree `task-28` (letzte Zeilen, ungekürzt):

```text
> uwe@0.1.0 test:security C:\git\UWE\.orca-worktrees\…\task-28
> pnpm --filter @uwe/database db:generate && pnpm --filter @uwe/security-tests test && node --import tsx --test scripts/studio-route-auth.test.ts scripts/security-leaks.test.ts

> @uwe/database@0.1.0 db:generate C:\git\UWE\…\packages\database
> prisma generate && prisma generate --schema=prisma/schema.postgresql.prisma

Der Befehl "prisma" ist entweder falsch geschrieben oder
konnte nicht gefunden werden.
C:\git\UWE\…\packages\database:
 ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL  @uwe/database@0.1.0 db:generate: `prisma generate && prisma generate --schema=prisma/schema.postgresql.prisma`
Exit status 1
 WARN   Local package.json exists, but node_modules missing, did you mean to install?
 ELIFECYCLE  Command failed with exit code 1.
```

Diagnose: Root-`node_modules` vorhanden, aber `packages/database/node_modules`
fehlt und der Prisma-Client ist nicht generiert; `pnpm install`/`db:generate`
werden vom Sandbox-Permission-Layer abgelehnt. **Advisory-Infra-Fehler, kein
Test-Fehlschlag** — identisch zu O02/O04. Die Code-Verifikation in § 0.2 erfolgte
deshalb durch direktes Lesen der Quelldateien.

## 4. Invarianten-Checkliste 1–10

| # | Prüfkriterium | Status | Beleg |
|---|---|---|---|
| 1 | Portal player-safe & read-mostly, nur klar begrenzte Spieleraktionen | **OK** | ADR 002 (Portal-Zeile), Masterplan Zielbild, O02 §1.1/§3 (`portal` nur `FP`/`SP`, keine generischen Writes), Inventar §2.3/§2.4. Kein Portal-Schreibpfad außer expliziter Aktions-Allowlist. |
| 2 | Studio ausschließlich D&D/DM/World-Brain/Review/Publish; Life Brain/Admin OS als Brain klassifiziert | **OK** | ADR 002 (Studio-Zeile: „keine persönlichen Brain-Daten"), Inventar §2.1 (`/today`, `/mail`, `/life-brain` → Brain), O02 §1.2 (`admin_life`/`personal_brain` = Brain-only), O03 §5.2 (Brain-Audience-Liste). |
| 3 | Brain owner-only, lokal/LAN-Default, nie automatisch öffentlich | **OK** | ADR 004 (Exposure-Tabelle: Standard Loopback, LAN nur explizit, Internet „nicht unterstützt"), ADR 007, O05 §7 (Port 3002 keine Firewall/Tunnel-Freigabe). |
| 4 | `personal_brain` hart local-only und NICHT konfigurierbar — konsistent über alle Artefakte | **OK** | Masterplan Inv 2, ADR 002/004/006 („nicht konfigurierbar"), O02 §1.3 (`owner_private_local` „nicht konfigurierbar"), O03 §1, O04 I2. Code: `LOCAL_ONLY_CONTEXT_MODES`, `assertPersonalBrainLocalOnly`. Keine Abweichung gefunden. |
| 5 | Private Brain-Inhalte nie an Cloud-KI; `dm_only` nie Portal/Export/ungeschützte Cloud | **OK** (mit F-1) | ADR 006 Schritte 1–3, O02 §3 Regeln 3/4, O04 I1/I2/§3.2. Code: `validateProviderContextCombination`, `validateResolvedRouteForContext`. `dm_only`-Portalfilter in `permissions.ts`. Einschränkung: bestehender Bypass F-1 (von den Docs korrekt zur Schließung markiert). |
| 6 | D&D-Kontext folgt Gateway-Policy (W0 Atlas, default `CLOUD_ALLOWED`); O01-Doku muss in DIESE Richtung korrigiert haben | **OK** | O01-Diff `docs/life-brain-privacy.md`: `brain (DnD)` von „Nein" auf „**Konfigurierbar**, Default `CLOUD_ALLOWED`" geändert; `SECURITY.md`-Verweis ergänzt. ADR 006 (Alternative „alle D&D local-only" verworfen), O02 §3 R3, O04 I3/C6. Code: `CLOUD_ALLOWED_CONTEXT_MODES` enthält `brain`/`current_object`. |
| 7 | Keine Cross-App-Imports; gemeinsame Engines ja, gemeinsame private Datenzugriffe nein | **OK** | ADR 002 (Abhängigkeitsregeln), Masterplan Inv 5, O03 §4.1 (`IMP_CROSS_APP`, `IMP_SHARED_PRODUCT`, `IMP_BRAIN_FROM_NON_BRAIN`), §6 (Dependency-Kanten). Bekannte Bestandsverstöße (Static-Export→Portal-CSS, ai-brain→cookbook) sind explizit als Baseline/Ratchet erfasst, nicht ausgeblendet. |
| 8 | Zieldatenebene `uwe-brain.db` + eigene Storage/Backups; keine Migration/Löschung geplant; Irreversibles nur mit separater Owner-Freigabe | **OK** | ADR 003, Masterplan Welle 5, O02 §4/§5 (`uwe-brain.db`-Mapping) /§9, O04 §3.4/§3.6. Foundation-Welle migriert nichts; harte Freigabebedingungen (Backup, Dry-Run, Rollback ohne Quell-Löschung) dokumentiert. |
| 9 | Session-Audience-ADR ändert KEINE Cookies | **OK** | ADR 005 („Cookie, Session-Schema, Login und Middleware bleiben unverändert"), O02 §7, O03 §5.1 (`UweAppSurface` bleibt Runtime-Quelle, `AppAudience` nur zusätzliche Metadaten). Code: `route-policy.ts:11` weiterhin `UweAppSurface = "portal" | "studio"`, kein Audience-Feld, kein Cookie-Diff. |
| 10 | Scope-Treue: kein Task hat Produktionscode/Routen/Schema/Cookies/systemd/`.github` verändert | **OK** | `git show --stat`: O01 = nur `SECURITY.md`, `SECURITY_NOTES.md`, `docs/adr/*`, `docs/life-brain-privacy.md`, `docs/rework/*.md` (alles Doku). O02–O05 = je genau eine `.md`. Kein `.ts`/`.tsx`, kein `prisma/`, kein `.github/`, kein `deploy/systemd/`, keine Cookie-/Middleware-Datei berührt. |

## 5. Anweisungen an O07 (Integrator)

1. **Integration freigegeben** — das Foundation-Paket kann integriert werden;
   es liegt kein Blocker gegen die Invarianten vor. Reihenfolge gemäß Masterplan
   § „Integrationsreihenfolge": zuerst Inventar, dann Decision Pack, dann O02–O05.
2. **F-1 in das Guard-Backlog übernehmen** (major): Der bestehende
   `playerPreviewAllowDmOnly`-Bypass (`permissions.ts:109-117`) muss vor der
   Aktivierung der Audience-/Portal-Guards (O03 §5, O04 L5/W5) entfernt oder hart
   auf Nicht-`dm_only` begrenzt werden. Er ändert nichts an der Foundation-Doku,
   darf aber nicht in Vergessenheit geraten, weil diese Welle keinen Code anfasst.
3. **F-2 als Test-Präzisierung führen** (minor): O04-S2 gegen
   `classifyRoute().access === "protected"` formulieren und die
   deny-by-default-geschützten Brain-Präfixe (`/api/life-brain`, `/api/capture`,
   `/api/kitchen`, `/api/scan`, `/api/workshop`, `/api/documents`,
   `/api/internal/*`) explizit abdecken; O04-Formulierung entsprechend glätten.
4. **F-3 bei der Contract-Extraktion beachten** (minor): Namenskollision
   `CLOUD_ALLOWED_CONTEXT_MODES` (breit in `@uwe/ai-brain`, eng in
   `@uwe/database`) beim Aufbau von `@uwe/product-contracts` auflösen.
5. **F-4 vor der Test-Umsetzungswelle** (minor): Im Ziel-Worktree
   `pnpm install` + `db:generate` herstellen, damit die geplanten O04-Negativtests
   gegen eine grüne `test:security`-Baseline entwickelt werden.
6. **Security-Gate-Interpretation**: Die `oauth`/`secret-leak`/`authorization`-
   Befunde in den Diffs von O03–O05 sind Vokabular-False-Positives (R3). Diffs
   und Fixtures enthalten keine echten Secret-Werte; nicht durch Lockerung der
   Produktgrenzen „reparieren", sondern anhand der konkreten Zeile bestätigen.
7. **Keine irreversible Aktion**: Die Datenmigration (Masterplan Welle 5) bleibt
   an eine separate, dokumentierte Owner-Freigabe gebunden. O07 darf keine
   Migration, Löschung oder systemd-/`.github`-/Cookie-Änderung aus diesem Paket
   ableiten.
