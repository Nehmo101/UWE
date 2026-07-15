# O04 — Plan der negativen Security-/Privacy-Tests für den Drei-Produkte-Split

Stand: 2026-07-15. Dieses Dokument ist ein **Testplan**, keine Test-Implementierung
und keine Änderung der aktiven Runtime. Es baut auf der bestehenden Security-Suite
auf und benennt gezielt, wo diese den Drei-Produkte-Split (Portal / Studio / Brain,
plus Platform und SharedEngine) noch **nicht** absichert. Jeder Testfall nennt Ziel-Ort,
eine Arrange/Act/Assert-Skizze, das erwartete **Negativ**-Ergebnis und ob er eine
Bestandsdatei erweitert oder neu ist.

## 0. Maßgebliche Quellen und Begriffe

- Inventar: `223ac6f176458bf17a6679e39c066ca6e9721012:docs/rework/three-product-split/00-inventory.md`.
- Contracts (advisory, O02): `docs/rework/three-product-split/02-domain-contracts.md`
  (Commit `837a708`) — `AppAudience`, `DataDomain`, `PrivacyClass`,
  `AUDIENCE_DOMAIN_ACCESS`, Streitgruppen `†G1`–`†G10`.
- Gelesene Ist-Suite: `packages/database/src/visibility-security.test.ts`,
  `packages/security-tests/**`, `scripts/security-leaks.test.ts`,
  `scripts/studio-route-auth.test.ts`,
  `packages/ai-brain/src/router/privacyGuard.ts` +
  `personal-brain-privacy.test.ts` + `mail-privacy.test.ts` + `types.ts`,
  `packages/database/src/personal-brain-privacy.test.ts`,
  `packages/auth/src/security/route-policy.ts`, `SECURITY.md`,
  `docs/life-brain-privacy.md`.

Begriffe werden aus O02 übernommen. Zentrale Invarianten (aus O02 §1.3 / §3 und
`SECURITY.md`):

- **I1** `dm_only` erreicht niemals Portal, Suche/Graph/Backlinks, statischen Export
  oder ungeschützte Cloud; wird vor jedem D&D-Cloud-Routing vollständig entfernt.
- **I2** `owner_private_local` (`personal_brain`, `admin_life`): nur `audience:"brain"`
  + Rolle `owner`, lokal/LAN. Nie Cloud-KI, Portal, Studio, Share, Export. Nicht
  konfigurierbar, kein Cloud-Fallback.
- **I3** D&D-Kontext folgt Gateway-Policy `CLOUD_ALLOWED` (W0 Atlas): RTX bevorzugt,
  Cloud-Fallback erlaubt — aber `datenschutzMode=true` und `CLOUD_FORBIDDEN` sperren,
  und `dm_only` wird vorher gestrippt (Positivfall, siehe §2).
- **I4** Audience ist notwendig, nie hinreichend: Portal-Session gegen Studio/Brain
  wird deny-by-default abgewiesen (O02 §7).

## 1. Ist-Abdeckung (Baseline) — was bereits grün ist

| Bereich | Datei | Deckt ab |
|---|---|---|
| Portal-Visibility (D&D) | `packages/database/src/visibility-security.test.ts` | `dm_only`-Seiten/Blöcke nie in Portal-Listing/-Endpoint/-Share; Draft versteckt; Templates halten GM-Secrets in `dm_only`. |
| Rollen-Matrix (D&D) | `packages/security-tests/src/role-matrix.test.ts` | anonymous/player/dm/admin/owner × Seite/Block/Asset/Privatwelt. |
| Leak-Scanner (D&D) | `public-leak-scanner.ts` + `.test.ts` | Anonyme Portal-Pfade (listWorlds, listPagesForContext, getPublicPageForPortal, Assets, `search("portal", …)`, `buildWorldGraph("portal")`) auf Marker `DM_ONLY/DRAFT/HIDDEN/PRIVATE_MEDIA`. |
| Route-Guards Studio | `route-authz.test.ts`, `studio-route-inventory.ts` | Jede Studio-API ist guarded/delegiert/allowlisted; Cross-Site-POST → 403; `STUDIO_API_TOKEN`-Bearer-Pflicht. |
| Route-Guards Portal | `portal-route-authz.test.ts`, `portal-route-inventory.ts` | Jede Portal-API guarded/delegiert/allowlisted; Public-Allowlist trägt keinen Guard. |
| Static Export (D&D) | `scripts/security-leaks.test.ts` | Atlas-`dm_only`-Filter, approved-only Palette/RTX-Recipe, Portal-gefilterter Tile-Layer, kein Prompt/Rationale-Leak. |
| AI-Cloud-Privacy | `ai-brain/src/router/personal-brain-privacy.test.ts`, `mail-privacy.test.ts`, `database/src/personal-brain-privacy.test.ts` | `personal_brain`/`mail` niemals Cloud (Combination + resolved route); RTX-offline → kein Cloud-Fallback; `assertPersonalBrainLocalOnly` weist Cloud/Unknown ab. |

**Kernbefund:** Die Ist-Suite ist stark für die **D&D-Achse** (`dm_only` vs.
`player_visible`) und für die **AI-Cloud-Grenze** von `personal_brain`/`mail`. Sie ist
**blind** für die Produktgrenze **Brain/Admin-OS ⇄ Portal/Studio** auf Daten- und
Routen-Ebene, weil die gemeinsame Fixture keinerlei `personal_brain`/`admin_life`-Daten
enthält (`markers.ts` kennt nur D&D-Marker).

## 2. Top-5-Lücken der Bestandssuite

1. **Fixture ohne Brain-Daten.** `security-fixture.ts`/`markers.ts` tragen nur
   `DM_ONLY`, `PRIVATE_DRAFT`, `HIDDEN_SECRET`, `PRIVATE_MEDIA` (alle D&D). Es gibt
   keinen Marker und keine Zeile für `personal_brain`/`admin_life`/Mail. Damit ist
   „Brain erreicht nie Portal" **strukturell nicht testbar** — der Leak-Scanner kann
   nichts finden, was nicht existiert. *(Höchste Priorität; blockiert L-Fälle in §3.1.)*
2. **Kein Audience-/Brain-Routen-Negativtest.** `route-authz` prüft nur die statische
   **Präsenz** eines Guards und Cross-Site-CSRF (403). Es gibt keinen Laufzeittest, dass
   eine `player`/`guest`-Session `/api/life-brain/*`, `/api/mail/*`, `/api/capture/*`
   **nicht** erreicht, und keine Portal-Brain-Route-Inventory.
3. **Export/Backup blind für `owner_private_local`.** `security-leaks.test.ts` deckt nur
   Atlas/`dm_only`. Kein Negativtest, dass Brain-Daten aus `exports/<world>-static/`
   ausgeschlossen sind; kein Konzepttest für getrennte Brain-Backups (`uwe-brain.db`).
4. **Cloud-Policy unvollständig.** Getestet ist der `personal_brain`/`mail`-Cloud-Block.
   Nicht getestet: `datenschutzMode=true` blockt Kampagnendaten; `dm_only` wird **vor**
   der Cloud-Route entfernt (I1); die Life-Brain-Route ruft `assertPersonalBrainLocalOnly`
   und liefert bei RTX-offline **202 + `jobId`** ohne Cloud-Fallback (`docs/life-brain-privacy.md` §RTX offline).
5. **Kein Session-Replay-/owner-only-Konzepttest.** O02 §7 fordert deny-by-default für
   Portal-Session gegen Studio/Brain. Zusätzlich fehlt ein Negativtest, dass die
   gemischte `/api/command/search` in Portal/Player-Kontext **nie** `admin_life`/
   `personal_brain`-Zeilen zurückgibt.

## 3. Geplante Testfälle nach Kategorie

Konvention je Fall: **ID** · Ort · Erweiterung (E) / Neu (N) · A/A/A-Skizze ·
erwartetes Negativ-Ergebnis.

### 3.1 Portal-Leak-Negativtests

Voraussetzung **P0 (Fixture-Erweiterung, N):** In
`packages/security-tests/src/markers.ts` neue Marker ergänzen und in
`fixtures/security-fixture.ts` **owner-private Brain-Daten** anlegen, ohne echte
Secret-Werte:

- `PERSONAL_BRAIN` = `__PERSONAL_BRAIN_SHOULD_NEVER_LEAVE_HOST__`
- `ADMIN_LIFE` = `__ADMIN_LIFE_SHOULD_NEVER_LEAVE_HOST__`
- `MAIL_PRIVATE` = `__MAIL_PRIVATE_SHOULD_NEVER_LEAVE_HOST__`

Diese Marker kommen in ein `owner`-eigenes Personal-Brain-Dokument, einen
Admin-OS/Capture-Eintrag und eine Mail-Nachricht. Neue Konstante
`BRAIN_LEAK_MARKERS = [PERSONAL_BRAIN, ADMIN_LIFE, MAIL_PRIVATE]`. Grund: Ohne
Datenbestand ist kein negativer Leak-Nachweis möglich (Lücke L1).

- **L1 · `public-leak-scanner.ts` (E) + `.test.ts` (E).**
  *Arrange:* Fixture mit P0-Brain-Daten in derselben DB. *Act:* `scanPublicPortalForLeaks`
  um `BRAIN_LEAK_MARKERS` erweitern; alle anonymen Portal-Pfade scannen.
  *Assert:* `findings` enthält **keinen** Brain-Marker.
  *Negativ:* Kein `personal_brain`/`admin_life`/Mail-Fragment in irgendeiner anonymen
  Portal-Response. *(schließt L1 für anonyme Pfade)*
- **L2 · `role-matrix.test.ts` (E).**
  *Arrange:* P0-Daten. *Act:* für Rollen `anonymous`/`player` die Portal-Projektionen
  (Seiten, Assets, Suche) abrufen. *Assert:* keine `BRAIN_LEAK_MARKERS`.
  *Negativ:* Auch eingeloggte Spieler erhalten nie Brain-Inhalte über Portal-Pfade.
- **L3 · Suche im Portal (`public-leak-scanner.ts` E).**
  *Act:* `repo.search("portal", { query: <PERSONAL_BRAIN|ADMIN_LIFE|MAIL_PRIVATE> })`.
  *Assert:* leeres Ergebnis. *Negativ:* Portal-Suche findet keine Brain-Domänen —
  auch dann nicht, wenn der Suchbegriff exakt der Brain-Inhalt ist.
- **L4 · Graph/Backlinks (`public-leak-scanner.ts` E).**
  *Act:* `buildWorldGraph(repo, worldSlug, "portal")` + (falls vorhanden) Backlink-/
  Related-Projektor. *Assert:* keine Brain-Knoten/-Kanten, keine `dm_only`-Knoten.
  *Negativ:* Graph enthält nur `player_visible`/`public` D&D-Knoten.
- **L5 · Share-Links (`visibility-security.test.ts` E oder neuer `share-brain-leak.test.ts` N).**
  *Arrange:* Share-Link auf eine `player_visible`-Seite. *Act:* `buildPageView(…, "share")`
  gegen eine Welt, deren DB auch Brain-Daten hält. *Assert:* View enthält weder
  `dm_only`- noch `BRAIN_LEAK_MARKERS`. *Negativ:* Ein Share-Grant erweitert die
  Projektion nie auf Brain-/DM-Inhalte (deckt O02-Risiko „Preview-Bypass").
- **L6 · Static-Export-Projektion (siehe §3.4).** Verweis, Umsetzung in Export-Kategorie.

Alle L-Fälle sind **Erweiterungen** derselben Scanner-/Matrix-Infrastruktur — keine
Duplikation. Sie erben `formatLeakReport` und die „hard error, never skip"-Semantik.

### 3.2 Private-Cloud-Routen (AI-Router / Gateway)

Basis: `privacyGuard.ts` (`validateProviderContextCombination`,
`validateResolvedRouteForContext`, `validateLocalRtxRequired`) und
`assertPersonalBrainLocalOnly` (`@uwe/database/server`, genutzt in
`apps/studio/app/api/life-brain/context/route.ts`).

- **C1 · `personal-brain-privacy.test.ts` (bereits grün, als Regressionsanker referenziert).**
  `validateProviderContextCombination("cloud","personal_brain")` wirft `AiPrivacyError`;
  `validateResolvedRouteForContext("cloud","personal_brain")` wirft (zweite Verteidigungslinie).
  *Negativ:* `personal_brain` erreicht nie einen Cloud-Provider. **Keine neue Arbeit** —
  nur als Verzahnungspunkt dokumentiert.
- **C2 · RTX offline → 202/Job, kein Cloud-Fallback (N, `apps/studio/app/api/life-brain/*` Route-Test).**
  *Arrange:* Kontextmodus `personal_brain`, Provider `auto`, RTX offline. *Act:* POST an
  die Life-Brain-Context-Route. *Assert:* HTTP **202** mit `jobId`, `deferredAiPrompt`-Job
  angelegt, **keine** Cloud-Anfrage. Ergänzt `validateLocalRtxRequired("auto","personal_brain",false)`
  (wirft `AiRouterError` „Cloud-Fallback … nicht erlaubt", schon grün) um den **HTTP-Vertrag**.
  *Negativ:* Kein Fallback auf Cloud, keine andere Audience/Domain — Warten statt Leak (I2).
- **C3 · `dm_only` wird vor Cloud-D&D-Route entfernt (N, Router-Test).**
  *Arrange:* D&D-Kontext (`brain`/`current_object`) mit eingebettetem `dm_only`-Fragment,
  Gateway-Policy `CLOUD_ALLOWED`, RTX offline → Cloud-Fallback. *Act:* Prompt-Aufbau +
  Routing. *Assert:* Der an den Cloud-Provider gehende Prompt/Context enthält **kein**
  `dm_only`-Fragment (Stripping-Projektor greift). *Negativ:* Kampagnen-Cloud ja, aber
  DM-Geheimnisse nie (I1/I3, `extractDmOnlyPhrases`/`validatePlayerRecapContent` als Anker).
- **C4 · `datenschutzMode=true` blockt Kampagnendaten (N, Gateway-Test).**
  *Arrange:* `datenschutzMode=true`, D&D-Kontext, Provider `cloud`. *Act:* Routing-Entscheid.
  *Assert:* Cloud abgewiesen (lokal erzwungen oder sicherer Fehler). *Negativ:* Trotz
  `CLOUD_ALLOWED`-Default keine Kampagnendaten in die Cloud, wenn Datenschutzmodus aktiv.
- **C5 · `dm_only` vor Cloud-Routing entfernt — negativer Provider-Combination-Test (E in `router.test.ts`).**
  *Act:* Provider `cloud` + `personal_brain`/`mail` → `AiPrivacyError`; Provider `cloud` +
  `general_chat`/`brain` → erlaubt. *Assert:* Trennlinie `LOCAL_ONLY_CONTEXT_MODES` vs.
  `CLOUD_ALLOWED_CONTEXT_MODES` bleibt exakt. *Negativ:* Keine stille Ausweitung der
  Cloud-erlaubten Modi.
- **C6 · Positivfall dokumentieren (E, `router.test.ts`).**
  D&D-Kontext (`brain`) + Policy `CLOUD_ALLOWED` + RTX offline → Cloud-Route **erlaubt**
  (W0 Atlas). Ausdrücklich als **erwarteter Positivfall** notiert, damit ein zu strenger
  Guard nicht fälschlich als „Fix" durchrutscht.
- **C7 · `assertPersonalBrainLocalOnly`-Aufrufnachweis (N, statischer Route-Test).**
  *Act:* Quelle von `apps/studio/app/api/life-brain/context/route.ts` lesen.
  *Assert:* `assertPersonalBrainLocalOnly(provider)` wird vor jeder Kontext-/Antwortpfad-
  Verzweigung aufgerufen (Muster analog `AUTH_GUARD`-Grep in `route-authz`). *Negativ:*
  Kein Life-Brain-Pfad ohne Local-Only-Gate.

### 3.3 Session-/Audience-Negativtests (ohne Cookie-Änderung)

O02 §7 ist Zielkonzept; heute teilen Studio/Portal `uwe_session`. Diese Tests prüfen
**Rolle + Scope**, nicht das künftige Audience-Cookie. Basis: `route-policy.ts`
(`classifyRoute`, `PROTECTED_ROUTE_PREFIXES`, `requiresStudioAuth`) und die Guard-Greps.

- **S1 · player/guest erreicht keine Studio-/Brain-Route (N, `route-policy`-Laufzeittest).**
  *Act:* `classifyRoute("/api/life-brain/context","portal")`,
  `classifyRoute("/api/mail/…","portal")`, `classifyRoute("/api/brain/run","studio")`
  ohne/mit Player-Rolle. *Assert:* `access !== "public"` und für Portal-Surface
  `protected` (nicht `protected-session`-Bypass). *Negativ:* Brain-/Studio-Präfixe sind
  in `PROTECTED_ROUTE_PREFIXES` und nie über eine Player-Session auflösbar.
- **S2 · Brain-Präfix-Vollständigkeit (E, `route-policy` Contract-Test).**
  *Assert:* Für alle Brain-Domänen-Präfixe aus dem Inventar (`/api/life-brain`, `/api/mail`,
  `/api/capture`, `/api/calendar`, `/api/documents`, `/api/kitchen`, `/api/miniatures`,
  `/api/projects`, `/api/scan`, `/api/workshop`, `/api/internal/{briefing,mail-sync}`) gilt
  `classifyRoute(pfad, surface).access === "protected"` — unabhängig davon, ob der Präfix
  explizit in `PROTECTED_ROUTE_PREFIXES` steht oder nur über den `unknownApi:true`-Default
  (deny-by-default) geschützt ist. *Negativ:* Kein Brain-Präfix fällt in eine
  Public-Allowlist. *(Ergänzt die Studio-Inventory-Vollständigkeit um Brain-Sicht; O06-F-2.)*
- **S3 · dm ohne owner/admin keine Admin-APIs (E, `role-matrix`/neuer Rollen-Route-Test).**
  *Act:* Rolle `dm` gegen `/api/admin/*`-Repräsentanten. *Assert:* abgewiesen.
  *Negativ:* DM-Rechte begründen keinen Platform-Admin-Zugriff.
- **S4 · Portal-Session-Replay gegen Studio/Brain (N, Konzept-/Laufzeittest, deny-by-default).**
  *Arrange:* Portal-ausgestellte Session (heute gemeinsames Cookie). *Act:* dieselbe
  Session gegen eine Studio-/Brain-Route. *Assert:* deny-by-default (heute via
  `requireStudioApiAuth`-Cross-Site/Origin-Prüfung dokumentiert; Zielzustand: Audience-Mismatch).
  *Negativ:* Eine Audience ist nie hinreichend (I4). Als **Konzepttest mit `it.todo`-Marker**
  für die künftige Audience-Session, plus heutiger Origin/CSRF-Nachweis.
- **S5 · owner-only-Konzepttests für künftige brain-Routen (N, `it.todo`).**
  *Assert (dokumentiert):* künftige `audience:"brain"`-Routen verlangen Rolle `owner`
  **und** lokales/LAN-Exposure; `player`/`dm`/`admin` ohne `owner` werden abgewiesen.
  *Negativ:* Admin ≠ Owner für Brain. Platzhalter, bis der Audience-Guard aus O02/O03 existiert.
- **S6 · Gemischte Suche `/api/command/search` (N, Laufzeit-Negativtest).**
  *Arrange:* P0-Brain-Daten + D&D-Daten. *Act:* Suche im **Portal/Player**-Scope nach
  `ADMIN_LIFE`/`PERSONAL_BRAIN`-Begriff. *Assert:* keine Treffer aus Brain-Domänen.
  *Negativ:* Die Cross-Domain-Suche liefert Spielern nie Admin-OS/Brain-Zeilen (Split-Naht
  aus dem Inventar).

### 3.4 Export-/Backup-Negativtests

- **X1 · Static Export nie `dm_only` (E, `scripts/security-leaks.test.ts`).**
  Bestand deckt Atlas; **erweitern** um einen End-to-End-Marker-Scan des erzeugten
  `exports/<world>-static/`: *Assert:* Ausgabe enthält keinen `DM_ONLY`-Marker.
  *Negativ:* bestätigt I1 auf Artefakt-Ebene (nicht nur per Quell-Grep).
- **X2 · Static Export nie Brain-Daten (N, `static-export`-Test).**
  *Arrange:* DB mit P0-Brain-Daten. *Act:* Export-CLI/Serializer laufen lassen. *Assert:*
  kein `BRAIN_LEAK_MARKER` im Bundle. *Negativ:* `owner_private_local` verlässt den Host
  nie über Export (I2). *(Da Export nur Welt-Projektionen liest, ist dies primär ein
  Nachweis, dass kein Brain-Adapter versehentlich in den Export-Pfad gerät.)*
- **X3 · Brain-Backups getrennt — Konzepttest `uwe-brain.db` (N, `it.todo`/Struktur-Test).**
  *Assert (dokumentiert, O02 §4/§9):* Ein Brain-Backup schreibt/liest ausschließlich aus
  der logischen `uwe-brain.db`-Ebene; das `uwe.db`-Backup enthält **keine**
  `personal_brain`/`admin_life`-Tabellen. Restore verlangt explizite Owner-Freigabe.
  *Negativ:* Kein Dual-Store-Backup, das Produktgrenzen vermischt. Bis zur physischen
  Trennung als `it.todo` mit Verweis auf O02-Storage-Notation.
- **X4 · Backup-Manifest-Minimierung (N, `packages/backup`-Test).**
  *Assert:* Manifest/Logs enthalten keine `BRAIN_LEAK_MARKER`-Payloads (opaque Handles,
  vgl. O02-Risiko „Platform-Orchestrierung loggt private Payloads"). *Negativ:* Backup
  loggt keine privaten Inhalte im Klartext.

### 3.5 Verzahnung mit dem Guards-Plan (O03)

O03 definiert **statische** Contracts (Audience-Guard deny-by-default, Portal-Read-Models
+ Feld-Allowlist für `†G1`, getrennte D&D-/Brain-AI-/Research-/Mail-/Import-Verträge,
Job-Envelopes, Contract-Tests gegen alle Prisma-DMMF-Modellnamen + Ausschluss von
`owner_private_local` aus Portal/Studio/Cloud/Export). Abgrenzung:

| Absicherung durch **O03-Guards (statisch/Compile-/Contract)** | Absicherung durch **O04-Laufzeittests (dieser Plan)** |
|---|---|
| `AUDIENCE_DOMAIN_ACCESS`-Matrix ist typkonsistent und vollständig (alle Audience×Domain). | Eine echte Portal-Response/Suche/Graph enthält keine Brain-Marker (§3.1). |
| Jede Prisma-Modellzuordnung existiert (`PRISMA_MODEL_BOUNDARIES` vs. DMMF). | Ein realer Player-/Portal-Zugriff auf Brain-Routen wird abgewiesen (§3.3 S1/S2/S6). |
| `owner_private_local` ist in keiner Portal/Studio/Cloud/Export-Allowlist. | Cloud-Router wirft bei `personal_brain`/`mail` und strippt `dm_only` (§3.2). |
| Feld-Allowlist für `†G1` (Character/Treasury) ist deklariert. | RTX-offline liefert 202/Job statt Cloud-Fallback (§3.2 C2). |
| Job-Envelope-Schema (`audience`/`dataDomain`/`privacyClass`/opaque Handle). | Backup/Export-Artefakt trägt keine privaten Payloads (§3.4). |

**Regel:** O03 verhindert *falsche Deklaration*; O04 verhindert *falsches Laufzeitverhalten*.
Ein O03-Contract ohne O04-Laufzeitnachweis ist unvollständig und umgekehrt. Neue
Prisma-Modelle müssen **beide** aktualisieren (O02-Risiko „Mapping-Drift").

### 3.6 Verzahnung mit dem Storage-/Datenebenen-Plan

O02 §9 verweist die Storage-Trennung (`uwe.db` vs. `uwe-brain.db`, Datei-Resolver,
Brain-Backups, Cutover/Rollback) an die Migrationswelle. Dieser Testplan liefert die
**Abnahme-Negativtests** dafür: X2/X3/X4 sowie L1–L5 werden nach physischer Trennung von
„Marker existiert nicht im Output" zu „Marker liegt in getrennter DB und crosst die Grenze
nie". Bis dahin laufen die Brain-Marker-Fälle gegen die gemeinsame Fixture-DB und sind
dennoch aussagekräftig, weil die Filter-/Projektionslogik bereits heute greifen muss.

## 4. Priorisierung für die nächste Welle

Reihenfolge nach Risiko × Aufwand; jeder Block mit Akzeptanzkriterium und Ort in
`pnpm test:security` (= `@uwe/security-tests test` + `scripts/studio-route-auth.test.ts`
+ `scripts/security-leaks.test.ts`).

| Prio | Fälle | Akzeptanzkriterium | Ort in `pnpm test:security` |
|---|---|---|---|
| **W1** | P0, L1–L4 | Leak-Scanner scannt Brain-Marker; alle anonymen + Player-Portal-Pfade grün ohne Brain-/`dm_only`-Treffer. | `packages/security-tests` (Fixture, `public-leak-scanner*`, `role-matrix`) → `test:leaks`. |
| **W2** | S1, S2, S6 | Alle Brain-Präfixe `protected`; Player-Suche liefert keine Brain-Zeile. | `route-policy`-Test in `@uwe/security-tests`; Studio-Route-Test in `scripts/studio-route-auth.test.ts`. |
| **W3** | C2, C3, C4, C7 | Life-Brain-Route: 202/Job, `assertPersonalBrainLocalOnly` aufgerufen; `datenschutzMode` + `dm_only`-Stripping erzwungen. | `ai-brain` Router/Gateway-Tests (laufen unter `turbo run test`; Router-spezifische Datei zusätzlich in `test:security`-Aggregat aufnehmen). |
| **W4** | X1, X2, X4 | Erzeugtes Export-Bundle + Backup-Manifest ohne `dm_only`/Brain-Marker. | `scripts/security-leaks.test.ts` (Export) + `packages/backup`-Test. |
| **W5** | L5, S3, C5, C6 | Share-View ohne Brain/DM; DM≠Admin; Cloud-Trennlinie exakt inkl. Positivfall. | `visibility-security.test.ts`, `role-matrix`, `router.test.ts`. |
| **W6** | S4, S5, X3 | `it.todo`-Konzepttests grün angelegt, verweisen auf O02/O03-Audience-Guard und `uwe-brain.db`. | `@uwe/security-tests` (Platzhalter), aktivierbar mit O03-Guard. |

**Reihenfolge-Begründung:** W1 schließt die strukturelle Blindheit (Fixture) und ist
Voraussetzung für jeden Brain-Leak-Nachweis. W2/W3 sichern die zwei schärfsten
Laufzeitgrenzen (Routen-Audience, Cloud). W4 deckt Exfiltration über Artefakte. W5/W6
verfeinern und legen die Konzeptplatzhalter für die spätere Audience-Session.

## 5. Integrationshinweise

- **Ein Fixture-Erweiterungspunkt:** Alle Brain-Marker über `markers.ts` +
  `BRAIN_LEAK_MARKERS` und **eine** owner-private Datenanlage in `security-fixture.ts`.
  Keine parallele zweite Fixture — sonst Drift.
- **Scanner erweitern statt duplizieren:** `scanPublicPortalForLeaks` bekommt zusätzliche
  `record(...)`-Aufrufe für Brain-Domänen-Projektoren; `PRIVATE_LEAK_MARKERS`
  bleibt für D&D, `BRAIN_LEAK_MARKERS` kommt additiv dazu. `formatLeakReport` unverändert.
- **Route-Policy-Tests** nutzen die vorhandene `classifyRoute`-API. Ein Teil der
  Brain-Präfixe steht explizit in `PROTECTED_ROUTE_PREFIXES` (u. a. `/api/mail`,
  `/api/projects`, `/api/calendar`, `/api/research`); `/api/life-brain`, `/api/capture`,
  `/api/kitchen`, `/api/scan`, `/api/workshop`, `/api/documents` und `/api/internal/*`
  fehlen dort und sind heute nur über den `unknownApi:true`-Default (deny-by-default)
  geschützt (O06-F-2). Der Test prüft deshalb `access === "protected"` statt
  Array-Mitgliedschaft und macht die Deckung **explizit** — das fängt spätere
  Regressionen (versehentliche Allowlist) unabhängig vom Schutzweg ab.
- **AI-Router-Tests** bleiben in `packages/ai-brain`; damit sie im Security-Gate sichtbar
  werden, den Router-Privacy-Test zusätzlich in die `test:security`-Aggregatzeile
  aufnehmen (ohne bestehende Zeilen zu verändern; additive Ergänzung planen).
- **Keine neuen `process.env`-Zugriffe** in geplanten Tests; RTX-offline und
  `datenschutzMode` werden über Fixture-/Repo-Parameter bzw. Settings-Service simuliert,
  nicht über Umgebungsvariablen.
- **Modul-Disziplin:** Neue Testdateien < 700 Zeilen; Brain-Leak-Fälle bevorzugt als
  Erweiterung bestehender Dateien, neue Dateien nur für klar getrennte Themen
  (`share-brain-leak.test.ts`, `route-policy-brain.test.ts`).
- **Security-Gate-Hinweis:** Marker-Konstanten sind bewusste Nicht-Secrets
  (`__…_SHOULD_NEVER_LEAVE_HOST__`); es dürfen **keine** echten Token/Schlüssel in
  Fixtures stehen. Orcas Diff-Security-Gate kann Vokabular (z. B. „Bearer", „Secret",
  „OAuth") als Auffälligkeit melden — hier ein bekannter False-Positive.

## 6. Risiken

- **R-A (Fixture-Kosten):** Brain-Daten in die gemeinsame Fixture zu heben, koppelt
  D&D- und Brain-Tests an eine DB. *Gegenmaßnahme:* Marker-Isolation + Cleanup wie in
  `role-matrix` (`fixture.cleanup()`); bei physischer DB-Trennung (O02 §4) auf zwei
  Fixtures aufteilen.
- **R-B (Scheinsicherheit vor Storage-Split):** Solange Brain in `uwe.db` liegt, testen
  L-Fälle nur die **Projektions-/Filterlogik**, nicht die physische Trennung.
  *Gegenmaßnahme:* X3/S4/S5 als `it.todo` mit klarer Aktivierungsbedingung markieren,
  damit „grün" nicht mit „migriert" verwechselt wird.
- **R-C (Cloud-Positivfall-Regression):** Ein zu strenger neuer Guard könnte den
  legitimen D&D-Cloud-Fallback (I3, W0 Atlas) brechen. *Gegenmaßnahme:* C6 als
  expliziter Positivfall.
- **R-D (`playerPreviewAllowDmOnly`-Altlast):** Der bestehende DM-only-Preview-Bypass
  kollidiert mit I1/I2 (O02 §10). *Gegenmaßnahme:* L5 prüft Share-Views scharf; vor
  Guard-Aktivierung muss das Flag entfernt/hart begrenzt werden.
- **R-E (Gemischte polymorphe IDs):** `EntityTag`, `AdminEntityLink`, `ImageStudioLink`,
  Job-JSON haben keine physische Grenze (O02 §10). Laufzeittests fangen Metadatenleaks
  erst nach O03-Envelope/Namespace-Trennung vollständig; bis dahin decken S6/X4 nur
  Inhalts-, nicht alle Existenz-Leaks ab.
- **R-F (Gate-False-Positive):** Security-Gate meldet ggf. `needs-work` wegen
  Secret-/OAuth-Vokabular in diesem Plan — einkalkuliert, keine echten Secrets enthalten.

## 7. Zusammenfassung

Die Ist-Suite sichert die D&D-`dm_only`-Achse und die `personal_brain`/`mail`-Cloud-Grenze
robust ab, ist aber blind für die Produktgrenze **Brain/Admin-OS ⇄ Portal/Studio** auf
Daten- und Routenebene, weil die gemeinsame Fixture keine Brain-Daten kennt. Der Plan
schließt das primär durch **eine** additive Fixture-/Marker-Erweiterung (W1) und
darauf aufbauende Laufzeit-Negativtests für Routen-Audience (W2), Cloud-Policy (W3) und
Export/Backup (W4), verzahnt mit den statischen O03-Guards und der O02-Storage-Trennung.
