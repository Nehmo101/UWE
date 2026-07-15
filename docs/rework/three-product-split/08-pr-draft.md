# PR Draft — Foundation-Welle des Drei-Produkte-Splits

**Status:** Vor Review
**Branch-Name:** `foundation/three-product-split`
**Base:** `main`
**Ziel-PR-Template:** Foundation-Welle

---

## Titel-Vorschlag

```
feat(docs): Foundation-Welle für Drei-Produkte-Split — Masterplan, ADRs, Contracts & Privacy
```

## Zusammenfassung

Diese PR integriert die Foundation-Welle (O00R–O07) für den Drei-Produkte-Split von UWE in **Portal**, **Studio** und **Brain**. Das Paket ist rein dokumentarisch — kein Produktionscode, kein Schema, keine Daten, Cookies, Routen, systemd-Units oder Infrastruktur-Änderungen.

### Lieferumfang

| Artefakt | Leitfunktion |
|---|---|
| **Inventar** | Read-only-Snapshot: 409 Routen, 34 Packages, 141 Prisma-Modelle, Storage, Jobs, Timer — pro Zielprodukt zugeordnet mit Hotspot-Markierung. |
| **Masterplan** | Kanonischer Umsetzungsplan mit Zielbild, sieben Invarianten, Wellenplan (Welle 0–5) und Definition of Done. |
| **Sechs ADRs** | ADR 002–007 fixieren Produktgrenzen, Datenebenen, Brain-Owner-Only, Session-Audiences, AI-Privacy-Policy und Deployment-Exposure. |
| **Domain Contracts** | `AppAudience`/`DataDomain`/`PrivacyClass`-Wertelisten, Kompatibilitätsmatrix, Prisma-Modell-Mapping und Ziel-Storage-Notation. |
| **Guards-Plan** | Statische/Compile-Guards für Audience-Kontrolle, Cross-App-Import-Verbote, Job-Envelopes und Contract-Tests. |
| **Privacy-Negativtests-Plan** | Laufzeit-Negativtests für Portal-/Export-Leaks, Session-Zugriffe, Cloud-Routing-Grenzen und Backup-Trennung. |
| **CI-Brain-Prep** | CI-Vorbereitung für die künftige `apps/brain`-App (Turbo-/Workflow-Anpassungen) ohne die App selbst zu schaffen. |
| **Privacy-Doku-Vereinheitlichung** | Angleichung von `SECURITY.md`, `SECURITY_NOTES.md` und `docs/life-brain-privacy.md` an die W0-Atlas-Cloud-Policy (D&D konfigurierbar, default `CLOUD_ALLOWED`). |

### Nicht verhandelbare Invarianten (Zielbild)

1. `dm_only` erreicht niemals Portal, statischen Export oder einen ungeschützten Cloud-Pfad.
2. `personal_brain` ist hart local-only, owner-only und nicht konfigurierbar.
3. Private Brain-Inhalte werden niemals an Cloud-KI übertragen.
4. Brain ist owner-only und standardmäßig lokal; LAN nur nach expliziter Owner-Aktivierung.
5. Apps importieren niemals aus anderen Apps; gemeinsame Engines sind erlaubt, gemeinsame private Datenzugriffe nicht.
6. KI übernimmt Inhalte nie automatisch — Review und explizites Apply vor jeder Änderung.
7. Keine Löschung und keine irreversible Migration ohne separate Owner-Freigabe.

---

## Dateiliste (vollständig)

### Neue Dateien

```
docs/rework/three-product-split/00-inventory.md
docs/rework/three-product-split/02-domain-contracts.md
docs/rework/three-product-split/03-guards-plan.md
docs/rework/three-product-split/04-privacy-negative-tests-plan.md
docs/rework/three-product-split/05-ci-brain-prep.md
docs/rework/three-product-split/06-security-review.md
docs/rework/three-product-split/README.md
docs/rework/uwe-portal-studio-brain-masterplan.md
docs/adr/002-product-boundaries.md
docs/adr/003-data-layers.md
docs/adr/004-brain-owner-only.md
docs/adr/005-session-audiences.md
docs/adr/006-ai-privacy-policy.md
docs/adr/007-deployment-exposure.md
```

### Geänderte Dateien

```
SECURITY.md (Angleichung an W0-Atlas-Policy)
SECURITY_NOTES.md (D&D-Context-Konfigurierbarkeit dokumentiert)
docs/ARCHITECTURE.md (Verweis auf Masterplan hinzugefügt)
docs/CURRENT_STATE.md (Verweis auf Masterplan hinzugefügt)
docs/life-brain-privacy.md (Vereinheitlichung mit W0-Atlas-Policy)
```

---

## Bewusst NICHT in diesem PR

- ❌ Keine Umsetzung von `apps/brain` — nur Vorbereitung (CI-Workflows, Route-Surface-Metriken).
- ❌ Keine Routen-Verschiebung zwischen Studio, Portal oder Brain.
- ❌ Keine Datenbank-Migration, kein Schema-Change, keine Prisma-Modell-Umsetzung.
- ❌ Keine Cookie-, Session- oder Middleware-Änderung.
- ❌ Keine systemd-Unit-Änderung; `deploy/systemd/` bleibt unverändert.
- ❌ Keine `.github/workflows`-Änderung; CI-Pläne sind dokumentarisch.
- ❌ Keine Löschungen (Code, Routen, Modelle); bestandsdignostesche Bypass (F-1) ist in Guard-Backlog aufgenommen, nicht gelöst.
- ❌ Keine Produktionscode-Änderung in `apps/` oder `packages/`.

---

## Security- & Privacy-Review

### O06-Urteil (vollständig)

**Gesamturteil: BESTANDEN MIT AUFLAGEN.**

Die Foundation-Welle ist architektonisch kohärent und konsistent mit den sieben nicht verhandelbaren Invarianten. Kein Blocker gegen Integration gefunden. Die zentrale Doku-Vereinheitlichung (O01) hat D&D-Kontext korrekt in Richtung `CLOUD_ALLOWED` (W0 Atlas) angeglichen.

### Bekannte Findings (O06) und Auflösungen (O07)

| ID | Severity | Befund | Status |
|---|---|---|---|
| **F-1** | major | `playerPreviewAllowDmOnly`-Bypass in `packages/database/src/permissions.ts:109-117` (Bestandscode, von den Docs korrekt zur Schließung vor Guard-Aktivierung markiert) | In Guard-Backlog aufgenommen — muss vor Welle 3 (Guard-Aktivierung) adressiert werden. Nicht im Foundation-Scope. |
| **F-2** | minor | O04-Formulierung: Brain-Präfixe „stehen bereits in `PROTECTED_ROUTE_PREFIXES`"; tatsächlich implizit geschützt über `unknownApi:true` deny-by-default. | O07-Anweisung: Test S2 neu gegen `classifyRoute().access === "protected"` formulieren; Präfixe explizit abdecken. |
| **F-3** | minor | Namenskollision `CLOUD_ALLOWED_CONTEXT_MODES` (breit in `@uwe/ai-brain`, eng in `@uwe/database`). | O07-Anweisung: bei Contract-Extraktion (Welle 2/3) umbenennen (z.B. `PERSONAL_BRAIN_CLOUD_CONTEXT_MODES`). Rein kosmetisch. |
| **F-4** | minor | Kein Artefakt kann `pnpm test:security` grün nachweisen (`prisma`/`node_modules` fehlen). | Advisory-Infra: vor Test-Umsetzungswelle (Welle 2/3) `pnpm install` + `db:generate` im Ziel-Worktree sicherstellen. |

### Security-Gate-Vokabular (FALSE POSITIVE)

Die Automatisierte Security-Gate kann auf Vokabular in den Dokumenten reagieren (OAuth, Token, Secret, Authorization). Das ist ein akzeptierter False Positive (RAHMENBEDINGUNG R3):

- **Grund:** Alle Erwähnungen sind Modell-, Feature- oder HTTP-Header-Namen (z. B. `ApiToken`-Modell, Spotify-OAuth-Callback, `Authorization`-Header-Konzept) — keine echten Secret-Werte.
- **Verifiziert:** Jedes Dokument wurde auf echte Secret-Werte gescannt; keine gefunden.
- **Auflösungstabelle in README:** Explizite Markierung unter „Sicherheits-Hinweis (Vokabular)".

**Empfehlung:** Gate-False-Positives bei der Dokumentation bestätigen und nicht durch Scope-Lockerung oder Wort-Ersetzungen „reparieren". Die Docs sind fachlich korrekt.

---

## Review-Reihenfolge (für Reviewer)

1. **`docs/rework/three-product-split/README.md`** — Orientierung (2 min)
2. **`docs/rework/uwe-portal-studio-brain-masterplan.md`** — Masterplan, Zielbild, Invarianten, Wellenplan (10 min)
3. **`docs/adr/002-product-boundaries.md` bis `007-deployment-exposure.md`** — Sechs ADRs (15 min)
4. **`docs/rework/three-product-split/02-domain-contracts.md`** — Contracts, Mapping (10 min)
5. **`docs/rework/three-product-split/03-guards-plan.md` bis `05-ci-brain-prep.md`** — Umsetzungspläne (15 min)
6. **`docs/rework/three-product-split/06-security-review.md`** — O06-Findings und Auflösungen (10 min)
7. **`docs/rework/three-product-split/00-inventory.md`** — Referenz für Zuordnungen (bei Fragen konsultieren)
8. **`SECURITY.md`, `SECURITY_NOTES.md`, `docs/life-brain-privacy.md`** — Diffs gegen alte Texte (5 min)

---

## GitHub-Checks (Voraussetzungen)

- ✅ `file-size-budget-check.mjs` → PASS
- ✅ `docs-check.mjs` → PASS (6 erforderliche Dateien, 168 Markdown-Dateien gescannt)
- ✅ `pnpm lint` → PASS
- ✅ `pnpm secret:scan` → PASS (keine verdächtigen Muster gefunden)
- ⏸️ `pnpm ci:light` (volle Testsuite) → wird im Ziel-PR optional, Gate-4-Infra-Fehler sind erwartet
  - **Advisory:** `pnpm test:security` schlägt derzeit fehl, weil `prisma` nicht generiert ist (Sandbox-Limitation); das ist eine Infra-Frage, keine Doku-Frage. Vor der Test-Umsetzungswelle (Welle 2/3) wird `pnpm install` + `db:generate` im Ziel-Worktree fällig.

---

## Integrationshinweise

1. **Keine Schema-Umsetzung:** Der Masterplan beschreibt ein Zielschema (`uwe-brain.db`, getrennte Audience-Felder), implementiert es aber nicht. Das ist für Welle 2 vorgesehen.
2. **Bestandscode-Bypasss F-1 bleibt unverändert:** Der `playerPreviewAllowDmOnly`-Bypass in `permissions.ts` wird **nicht** repariert, aber als **Auflage vor Guard-Aktivierung** markiert. Die Foundation-Doku benennt ihn richtig.
3. **Keine Änderungen bei `PROTECTED_ROUTE_PREFIXES`:** Brain-Präfixe sind implizit geschützt (deny-by-default); der Guard-Backlog trägt F-2 (Präzisierung) auf der Test-Ebene ein.
4. **Privacy-Doku-Vereinheitlichung gelöst:** Alte „D&D = local-only"-Aussagen wurden korrekt durch `CLOUD_ALLOWED` (W0-Atlas) überschrieben. Alle Texte sind kohärent.
5. **Master-Reihenfolge:** Integration gemäß Masterplan-Integrationsreihenfolge: zuerst Inventar, dann Decision Pack (ADRs + Masterplan), dann O02–O05 einzeln oder gebündelt.

---

## Anhang: Gate-Ergebnisse (ausführlich)

### Gate 2a — `node scripts/file-size-budget-check.mjs`

```
file-size-budget: OK
```

**Status:** ✅ PASS
- Neue Dateien liegen alle unter 700-Zeilen-Limit.
- Bestandsbaseline nicht berührt.

### Gate 2b — `node scripts/docs-check.mjs`

```
docs-check: OK (6 required files, 168 markdown files scanned)
```

**Status:** ✅ PASS
- 6 erforderliche Dateien vorhanden (ARCHITECTURE.md, CURRENT_STATE.md usw.).
- 168 Markdown-Dateien gescannt, keine strukturellen Fehler.

### Gate 2c — `pnpm lint`

```
[WARN] The "pnpm" field in package.json is no longer read by pnpm. The following keys were ignored: pnpm.overrides.
> uwe@0.1.0 lint
> eslint --max-warnings 0 .

[OK] No linting errors found.
```

**Status:** ✅ PASS
- ESLint bestanden mit `--max-warnings 0`.
- Warnung ist Konfigurationshinweis (nicht relevant für diese PR).

### Gate 2d — `pnpm secret:scan`

```
secret-scan: no suspicious patterns found.
```

**Status:** ✅ PASS
- Keine verdächtigen Muster gefunden.
- OAuth-/Token-/Secret-Vokabular wurde gescannt, aber als False Positive (R3) verifiziert.

---

## Abzeichnung

**Validator:** Beregond (O08 Quality-Gate & PR-Draft)
**Datum:** 2026-07-15
**Scope-Status:** Whitespace-Hygiene (OK), keine Temp-Dateien hinterlassen, kein git-Zustand geändert
**Ergebnis:** FREIGEGEBEN ZUR INTEGRATION

**Nächster Schritt:** Orchestrator-Integration nach GitHub-Checks; Review gemäß Reihenfolge (README → Masterplan → ADRs → Pläne → Security).
