# UWE — Zustandsanalyse: Rechtekonzept, Informationsarchitektur, Feature-Bilanz

Stand: 2026-07-26 · Basis: `main` @ `0a9261c` · Analyse ohne Codeänderung

---

## 0. Kennzahlen

| | |
|---|---|
| TypeScript gesamt (ohne `generated/`) | ~327.000 Zeilen |
| davon `apps/studio` | 104.500 (32 %) |
| davon `apps/portal` | 11.100 |
| davon `apps/brain` | 3.400 |
| davon `apps/rtx-connector-client` | 7.700 |
| Packages | 37 |
| Prisma-Modelle | 97 (App-DB) + 45 (Brain-DB) |
| Studio: Seiten / API-Routes / Server Actions | 149 / 204 / 272 (in 59 Dateien) |
| Portal: Seiten / API-Routes | 34 / 24 |
| Brain: Seiten / API-Routes | 14 / 2 |
| Eingefrorene Monolithen (`file-size-baseline.json`) | 24 Dateien |

**Erster Eindruck:** Studio ist zu einem Drittel des Codes gewachsen und trägt inzwischen
drei Produkte gleichzeitig (DM-Studio, Daily Admin OS, Life Brain). Die Sicherheits-
Grundmechanik ist an den *offensichtlichen* Stellen (API-Routes, Portal-Content-Filterung)
sauber und getestet. Die Lücken sitzen an den *unauffälligen* Stellen: Server Actions,
Portal-Weltseiten, und drei Rechtemodelle, die dokumentiert aber nicht erzwungen werden.

---

## 1. Rechtekonzept

### 1.1 Es gibt nicht ein Rechtekonzept, sondern vier

| # | Modell | Ort | LOC | Wird erzwungen? |
|---|--------|-----|-----|-----------------|
| 1 | **Grobe Rollen** (`owner/admin/dm/player/readonly/guest`) | `packages/auth/src/roles.ts` | 120 | **Ja** — Login, Middleware, API-Guards, Page-Guards |
| 2 | **Content-Sichtbarkeit** (`dm_only`, `player_visible`, `secretLevel`, `revealState`) | `packages/auth/src/permissions.ts`, `packages/database/src/permissions.ts` | 505 | **Ja** — Portal, Share-Links, Static Export |
| 3 | **Capability-Matrix** (20 Capabilities × 6 globale × 4 Welt-Rollen) | `packages/auth/src/role-capabilities.ts` | 274 | **Nein** — nur Deko |
| 4 | **Audience × Domain-Matrix** (Portal/Studio/Brain/Platform × 12 Domains) | `packages/product-contracts` | 422 | **Nein** — und von Studio massiv verletzt |

Modelle 1 und 2 sind gut. Modelle 3 und 4 sind Dokumentation im Gewand von Code — sie
erzeugen den Eindruck eines feingranularen Rechtekonzepts, das faktisch nicht existiert.
Das ist die gefährlichste Sorte technischer Schuld: Sie liest sich wie eine Zusicherung.

### 1.2 Was tatsächlich greift — Wirkungskarte

```
                       Middleware      Route-/Page-Guard      Objekt-Ebene
Studio /api/**    Session vorhanden?  → Rolle geprüft ✓     → studioTrusted = alles frei
Studio /pages     Session vorhanden?  → Rolle geprüft ✓     → studioTrusted = alles frei
Studio Actions    Session vorhanden?  → NUR CSRF/Origin ✗   → studioTrusted = alles frei
Portal /api/**    Session vorhanden?  → Session geprüft ✓   → *ForViewer-Services ✓
Portal /auth/**   Session vorhanden?  → keine Weltprüfung ✗ → *ForViewer-Services ✓
Portal Actions    Session vorhanden?  → nur Session ✓       → *ForViewer-Services ✓
Brain /**         Session + Exposure  → requireBrainOwner ✓ → n/a (owner-only)
```

Zwei Zellen sind rot. Beide sind unten ausgeführt.

### 1.3 Befunde nach Schwere

---

#### B1 — Studio Server Actions haben **kein** Rollen-Gate (kritisch)

Alle 272 Server Actions in Studio rufen genau denselben Guard auf:

```ts
// apps/studio/src/lib/studio-action-auth.ts:19
export async function requireStudioActionAuth(): Promise<void> {
  const headerStore = await headers();
  const request = new Request("http://studio.local/", { headers: headerStore });
  const denied = authorize({ scope: "studio-action", request });   // ← kein hasSession, kein user
  if (denied) throw new StudioActionAuthError(denied);
}
```

`authorize({scope: "studio-action"})` landet in `authorizeStudio()`
(`packages/auth/src/security/authorize.ts:93`). Diese Funktion prüft **ausschließlich**:
Cross-Site-Origin, `STUDIO_API_TOKEN`, `isPublicExposureConfigured`. Sie liest **nie** ein
Cookie, **nie** eine Session, **nie** eine Rolle. Der Guard ist ein CSRF-Check, nichts weiter
— trotz Kommentar „Server-side guard for Studio Server Actions".

Die Rollenprüfung sitzt in Studio nur an zwei Stellen: `enforceStudioPageAuth()` (Seiten) und
`guardStudioApiRequest()` (API-Routes). Server Actions gehen an beiden vorbei.

**Warum das ausnutzbar ist — die Session-Kette:**

1. `POST /api/auth/enter` liegt auf dem **Studio-Origin** und steht in
   `PUBLIC_STUDIO_API_ROUTES` (`route-policy.ts:169`), ist also immer erreichbar.
2. Mit `target: "portal"` gilt `hasTargetAccess()` → `true` **für jeden aktiven Benutzer**
   (`apps/studio/app/api/auth/enter/route.ts:52`) — auch für Rolle `player`.
3. Die Route setzt daraufhin das Cookie `uwe_session` **auf dem Studio-Origin**
   (Zeile 78 ff.), optional domainweit via `SESSION_COOKIE_DOMAIN`.
4. Studio-Middleware prüft nur `Boolean(cookies.get(SESSION_COOKIE_NAME))`
   (`apps/studio/middleware.ts:135`) — Cookie vorhanden, Durchlass.
5. Server-Action-IDs stehen in den Client-Chunks unter `/_next/static/**`, das vom
   Middleware-Matcher ausgenommen ist (`middleware.ts:196`) und damit offen liegt.

Ergebnis: Ein Konto mit Rolle `player` kann Studio-Server-Actions aufrufen. Betroffen sind
u. a. `settings-actions.ts`, `owner-setup-actions.ts`, `life-admin-actions.ts`,
`ideas-actions.ts` sowie sämtliche Welt-Mutationen. Das ist eine vollständige
Privilege-Escalation von `player` auf effektiv `owner`.

Verstärkend: Jede Studio-Action ruft anschließend `apps/studio/src/lib/authz.ts`, das
konsequent `user: null` plus `STUDIO_TRUSTED_SCOPE = { studioTrusted: true }` übergibt.
`studioTrusted` ist in `authz.ts` der erste Kurzschluss jeder Prüfung
(`canReadWorld:172`, `canEditWorld:196`, …). Die Objekt-Ebene fängt also nichts ab.

**Fix (minimal, ~15 Zeilen):** In `requireStudioActionAuth()` nach dem CSRF-Check
`getCurrentAuthUser()` auflösen und `hasAnyRole(user, STUDIO_ACCESS_ROLES)` erzwingen;
für owner-only Actions eine Variante `requireOwnerActionAuth()`. Zusätzlich einen
Boundary-Test analog `security-boundary.test.ts` schreiben, der jede `"use server"`-Datei
gegen den Guard prüft.

---

#### B2 — Portal-Weltseiten prüfen keine Welt-Mitgliedschaft (hoch)

Alle 20 Seiten unter `apps/portal/app/auth/worlds/[worldSlug]/**` verwenden
`getAccessContextForWorld(worldSlug)`. Diese Funktion baut nur den `AccessContext`
und **wirft nie** (`apps/portal/src/lib/auth.ts:85`).

Die dafür vorgesehene Funktion existiert — `assertWorldReadable()`
(`apps/portal/src/lib/auth.ts:124`) — hat aber **null Aufrufstellen** im gesamten Repo.
Auch `apps/portal/app/auth/worlds/[worldSlug]/layout.tsx` prüft nichts; es baut nur
Breadcrumb und Chrome.

Konsequenz aus `resolveEffectiveRole()` (`packages/auth/src/permissions.ts:66`): Ohne
Mitgliedschaft und mit `user.role === "player"` ist die effektive Rolle `player` — und
`canViewPage()` gibt für `player_visible` genau dann `true` zurück. Ein eingeloggter
Spieler kann also durch bloßes URL-Raten die spielersichtbaren Inhalte **fremder Welten**
lesen: Wiki, NPCs, Sessions, Timeline, Quests, Handouts, Galerie, Gruppenschatz.

Kein `dm_only`-Leak — Modell 2 hält. Aber die Welt-Isolation existiert nur in der
*Auflistung* (`listAccessibleWorldsForUser`), nicht im *Zugriff*.

**Fix:** `assertWorldReadable()` in `apps/portal/app/auth/worlds/[worldSlug]/layout.tsx`
aufrufen (ein Ort, 20 Seiten abgedeckt) und in den Seiten den Kontext von dort beziehen.

---

#### B3 — Die Capability-Matrix ist reine Dekoration (mittel)

`packages/auth/src/role-capabilities.ts` definiert 20 Capabilities, zwei vollständige
Matrizen und 13 Prüf-Funktionen (`canApproveReviews`, `canGrantPortalUnlocks`,
`canManageApiTokens`, `canDirectlyEditCanon`, `mustSubmitProposal`, …).

Aufrufstellen im Produktivcode: **eine** — `apps/studio/app/admin/roles/page.tsx:90` ruft
`buildRoleCapabilityMatrix()`, um eine **Tabelle zu rendern**. `hasCapability()` wird
nirgends aufgerufen. (Die anderen `hasCapability`-Treffer im Repo gehören zur
Connector-Registry und sind ein unglücklicher Namensdoppelgänger.)

Die Seite heißt in der Navigation „Rollen & Rechte" / „Rollen-Matrix" und zeigt dem Owner
eine Matrix, die keine Wirkung hat. Sie beschreibt einen Soll-Zustand, nicht den Ist-Zustand.

Besonders auffällig: `co_dm` hat laut Matrix `proposal_submit` statt `canon_edit` — das
Proposal-Konzept existiert aber nur hier. `mustSubmitProposal()` wird nie aufgerufen.

**Entscheidung nötig:** entweder erzwingen (dann ist es das *eine* Rechtekonzept und
Modell 1 wird darauf abgebildet) oder löschen. Der Zwischenzustand ist der schlechteste.

---

#### B4 — `@uwe/product-contracts` wird von Studio in 108 Dateien verletzt (mittel)

Die Matrix in `packages/product-contracts/src/domain-access.ts` ist als *„AUTHORITATIVE
product-boundary contracts"* deklariert und sagt:

```ts
studio: { ..., personal_brain: N, admin_life: N, ... }   // N = none
```

Tatsächlich importieren **108 Dateien in `apps/studio`** direkt
`@uwe/database/brain-client` und greifen damit unmittelbar auf `personal_brain` und
`admin_life` zu — Kitchen, Mail, Projects, Contracts, Finance, Life-Brain, Scan-Inbox,
Miniatures, Search, Today-Dashboard, Morning-Briefing.

Der einzige Konsument der Matrix im gesamten Repo ist `apps/brain/src/lib/audience.ts`
mit `brainCanAccess()` — und diese Funktion wird ihrerseits nur in ihrer eigenen Testdatei
aufgerufen. Es gibt **keinen** Lint-, Test- oder CI-Check, der die Matrix durchsetzt.

Das Paket beschreibt einen geplanten Three-Product-Split
(`docs/rework/three-product-split/`), der in Studio nie vollzogen wurde. Es ist kein
Sicherheitsloch (alles ist owner/admin-gated), aber es ist eine falsche Zusicherung im
Repo, und `pnpm test` grünt fröhlich dazu.

---

#### B5 — Tote Guards

| Symbol | Ort | Aufrufstellen im Produktivcode |
|---|---|---|
| `assertWorldReadable` | `apps/portal/src/lib/auth.ts:124` | 0 |
| `requireAiRole` | `packages/security/src/security/ai-policy.ts:57` | 0 |
| `hasCapability` (+12 Wrapper) | `packages/auth/src/role-capabilities.ts` | 0 |
| `brainCanAccess` | `apps/brain/src/lib/audience.ts:11` | 0 |
| `canEditWorld` | `packages/auth/src/security/authz.ts:191` | 0 (nur via `assertCanEditWorld`) |
| `authorizeForSurface` | `packages/auth/src/security/authorize.ts:225` | 0 |

`requireAiRole` ist besonders schade: Es ist die einzige Stelle, die „KI nur für
Owner/Admin/DM" durchsetzen würde. Die tatsächliche KI-Absicherung läuft über
`guardStudioApiRequest` (Rolle) plus `privacyGuard` im Router — das funktioniert, aber
`requireAiRole` suggeriert eine zweite Schicht, die es nicht gibt.

---

### 1.4 Was gut ist — ausdrücklich

Damit die Kritik einsortiert ist, hier das, was belastbar funktioniert:

- **API-Guard-Abdeckung Studio:** 184 von 204 Routes rufen einen echten Guard. Die
  20 Ausnahmen sind sauber begründet: Health-Probes, Auth-Entry, Maintenance,
  OAuth-Callback, Connector-Endpoints (eigener Token), `internal/*` (Bearer via
  `requirePrivateHealthAuth`). Keine echte Lücke gefunden.
- **`dm_only` erreicht das Portal nicht.** Die Filterung sitzt konsequent in der
  Service-Schicht (`listPagesForViewer`, `getForViewer`, `filterBlocksForContext`), nicht
  in Komponenten. `isPageAccessible` hat 27 Aufrufstellen, `filterBlocksForContext` 20.
  Die Asset-Pfade wurden nachweislich zusammengeführt
  (`isAssetExposableToPlayers`, `permissions.ts:147`), damit Einzelprüfung und
  Listenfilter nicht divergieren können.
- **Restore ist korrekt owner-gated**, inklusive expliziter Ablehnung von `admin`/`dm`
  und ohne Öffnung bei fehlendem `RESTORE_OWNER_TOKEN` (`guards.ts:163`).
- **Brain ist konsequent owner-only:** Loopback-Bind + Exposure-Schalter + Deny-by-default
  Route-Policy + serverseitiges `requireBrainOwnerAuth` auf jeder Seite.
- **AI-Privacy-Guard greift wirklich** (`packages/ai-brain/src/router/privacyGuard.ts`,
  eingebunden in `aiRouter.ts:50`) — Cloud-Routing wird gegen den Kontext-Modus validiert.
- **Portal-Actions delegieren an `*ForViewer`-Services**, die Objekt-Eigentümerschaft
  prüfen. Das ist genau das richtige Muster.
- `security-boundary.test.ts` erzwingt Guard-Aufrufe in Portal-API-Routes automatisiert.
  Das gleiche Muster fehlt für Studio-Actions — siehe B1.

---

## 2. Informationsarchitektur — sind die Überschriften am richtigen Ort?

### 2.1 Studio: 7 Sektionen, faktisch 3 Produkte

Die kanonische IA (`apps/studio/src/navigation/studio-nav.ts`) lautet:
**Start · Welten · Knowledge & Brain · AI & Generatoren · Werkzeuge · Organisation · System.**

Formal sauber: Nav-Audit ergibt **0 tote Links** und nur 19 Seiten ohne Nav-Eintrag,
davon alle legitim (Auth-Seiten, Redirects, Unterseiten). Die Struktur ist gepflegt.

Inhaltlich stimmt die Zuordnung an mehreren Stellen nicht:

**a) „Knowledge & Brain" mischt zwei getrennte Datenwelten.**
Der Abschnitt enthält *Brain Store* (`/brain` → D&D-Kanon, App-DB) und *Life Brain*,
*Wissensassistent*, *Life-Brain Chat* (→ `personal_brain`, Brain-DB). Zwei Datenbanken,
zwei Privacy-Klassen (`dm_only` vs. `owner_private_local`), eine Überschrift. Für den
Nutzer heißt „Brain" hier zweierlei. Das ist die IA-Spiegelung von B4.

**b) „Organisation" ist das Daily Admin OS und gehört nicht in Studio.**
Projekte, Verträge, Dokumente, Werkstatt, Miniaturen, Hardware/Homelab, Mail, Kalender —
alles `admin_life`-Domäne. Zusammen mit „Werkzeuge → Erfassen & Alltag" (Capture, Scan
Inbox, Mach weiter, Finanzen, Haushalt, Küche) sind das **13 von 34** Studio-Nav-Einträgen,
die mit D&D nichts zu tun haben. Sie liegen in der DM-App, weil sie historisch dort
gewachsen sind, nicht weil sie dorthin gehören.

**c) „Werkzeuge" ist eine Restekiste.**
Der Kommentar im Code gibt es selbst zu (`studio-nav.ts:200`: *„mit 13 heterogenen
Einträgen zu überladen"*) und löst es durch Unterteilung in drei Untergruppen — die
Sektion bleibt aber 13 Einträge groß und mischt Alltag (Küche, Haushalt), Content
(Templates, Image Studio) und Automation (Reviews, Agent Jobs, Jobs). Drei Sub-Header sind
eine Kaschierung, keine Lösung.

**d) System und Admin sind zwei Namen für einen Bereich.**
`/system` (512 Zeilen) und `/admin` (135) sind beide Hubs. Die System-Nav mischt
`/admin/*`- und `/system/*`-Pfade munter durcheinander — z. B. „Benutzer & Sicherheit"
zeigt auf `/admin/users`, „Kommandozentrale" auf `/system/command-center`. Dazu kommen
`/admin/cockpit`, `/admin/status` (9 Zeilen), `/system/health` (28 Zeilen),
`/admin/checklist`, `/system/startklar`. Sechs Einstiegspunkte für „Wie geht's dem System?".

**e) Dashboards insgesamt: sieben.**
`/today` (202) · `/continue` (61) · `/command` (33) · `/system` (512) · `/admin` (135) ·
`/admin/cockpit` (137) · `/system/command-center` (30). Dazu auf Weltebene noch
`/worlds/[slug]/dashboard` (155) und `/worlds/[slug]/radar` (182).

**f) Auf Weltebene doppeln sich vier „Was ist offen?"-Werkzeuge.**
`radar` (182), `open-items` (110), `quality` (271), `inspector` (314) — mit vier eigenen
Services in `packages/database` (`campaign-radar-service`, `world-open-items-service`,
`wiki-quality-service`, `world-inspector`). Alle beantworten Varianten derselben Frage.

**Bewertung Studio-IA:** Die Nav-Mechanik ist vorbildlich (zentraler Contract, Tests,
Conflict-Detection, `/system/navigation`-Overview). Die *Inhaltszuordnung* ist es nicht:
Studio trägt drei Produkte unter sieben Überschriften, und die Überschriften bilden die
Produktgrenzen nicht ab.

---

### 2.2 Brain: eine zweite, ärmere Kopie von Studios Organisation-Bereich

`apps/brain` hat 13 Nav-Einträge in 3 Gruppen:

| Brain | Studio-Pendant | LOC Brain / Studio |
|---|---|---|
| Heute | `/today` | 74 / 202 |
| Wissen | `/life-brain` | 227 / 193 |
| Capture | `/capture` | 156 / 49 |
| Projekte | `/projects` | 216 / 522 |
| Werkstatt | `/workshop` | 159 / 451 |
| Miniaturen | `/miniatures` | 157 / 277 |
| Verträge | `/contracts` | 172 / 513 |
| Hardware | `/hardware` | 148 / 641 |
| Dokumente | `/documents` | 135 / 143 |
| Mail | `/mail` | 225 / 136 |
| Kalender | `/calendar` | 215 / 405 |

**Jeder** Brain-Bereich existiert auch in Studio, auf derselben Brain-DB, mit derselben
faktischen Zielgruppe (Owner). Es sind zwei UIs, zwei Nav-Definitionen, zwei
Theme-Provider, zwei Shells, zwei Auth-Schichten für einen Datenbestand.

Architektonisch ist Brain der *richtige* Ort — es ist die einzige App, die
`@uwe/product-contracts` respektiert. Nur wurde Studio nie entkernt. Brain ist keine
Migration, sondern ein Parallelbau, der auf halbem Weg stehen geblieben ist. 94 Commits
für Brain gegen 2029 für Studio zeigen, wo die Arbeit tatsächlich passiert.

Ein zusätzliches Signal: Brain-Nav und Studio-Nav teilen sich **keinen** Contract. Brain
hat ein handgeschriebenes `SECTIONS`-Array mit Unicode-Icons (`◆ ☀ ✦ ✎`), Studio nutzt
`@uwe/shared-utils/navigation` mit Lucide-Namen. Divergenz ist damit vorprogrammiert.

---

### 2.3 Portal: die einzige App, deren IA stimmt

15 weltbezogene Einträge, alle unter einer Überschrift „Welt", plus drei Account-Einträge.
Alles ist spielerbezogen, nichts ist fehlplatziert, login-first ohne öffentliche
Welt-Discovery. Legacy-Pfade (`/worlds/**`, `/players/**`) sind auf reine Redirects
reduziert.

Zwei kleine Punkte:

- `/auth/worlds/[slug]/atlas` existiert als Seite, steht aber nicht in der Nav — die Nav
  kennt nur `atlas3d`. Verwaister Vorgänger.
- Der Sidebar zeigt 15 Einträge auf einer Ebene. „Beziehungsnetz", „Timeline", „Questlog",
  „Chronik" sind für Spieler vier ähnlich klingende Chronologie-Sichten. Hier wäre eine
  Zweiteilung (Nachschlagen / Mitspielen) hilfreich — das ist Komfort, kein Fehler.

---

## 3. Features, die ich für verzichtbar halte

Kriterium: geringer Nutzen im Verhältnis zu Wartungslast, Angriffsfläche oder
Bedienkomplexität. Nach Einsparpotenzial sortiert.

### 3.1 Atlas 3D — 21.750 Zeilen für eine Unterseite

Drei Packages (`atlas` 10.654 · `atlas-3d` 10.308 · `atlas-editor` 788) bedienen genau
eine Route in Studio und eine im Portal. Das sind **6,7 % des gesamten Codes** für einen
3D-Globus. Ein D&D-Tisch braucht eine Karte mit Pins; ein Planeten-Editor mit Terrain,
Features, Objekten und Kamera-Bookmarks ist ein eigenes Produkt. 341 Commits stecken drin,
der Bereich ist also nicht tot — aber die Frage ist, ob er den Anteil wert ist.

*Empfehlung:* Nicht löschen, aber ehrlich bewerten. Wenn Atlas 3D am Spieltisch nicht
regelmäßig benutzt wird, ist es der mit Abstand größte Einzelposten zum Ausbauen.

### 3.2 Die Capability-Matrix samt `/admin/roles`

274 Zeilen Modell + 80 Zeilen Test + eine Admin-Seite, die eine wirkungslose Tabelle
rendert. Siehe B3. Entweder erzwingen oder ersatzlos streichen.

### 3.3 `@uwe/product-contracts` in der jetzigen Form

422 Zeilen, ein einziger (selbst toter) Konsument, keine Durchsetzung, und der beschriebene
Zustand widerspricht dem realen Code in 108 Dateien. Als *Zielbild* ist die Matrix wertvoll
— dann gehört sie nach `docs/`. Als `@uwe`-Package suggeriert sie Wirkung.

### 3.4 Der Dashboard-Zoo

Von sieben Studio-Hubs tragen `/admin/status` (9 Zeilen), `/system/health` (28),
`/system/command-center` (30) und `/command` (33) praktisch nur Weiterleitungs- oder
Wrapper-Logik. `/admin/cockpit`, `/admin` und `/system` überlappen inhaltlich stark.

*Empfehlung:* Ein Betriebs-Hub (`/system`) mit Tabs, ein Tages-Hub (`/today`). Der Rest
sind Redirects.

### 3.5 Vier „Was ist offen?"-Werkzeuge pro Welt

`radar`, `open-items`, `quality`, `inspector` mit vier eigenen Services. Das ist eine
Funktion in vier Ausprägungen. Zusammenlegen auf einen „Weltzustand"-Screen mit Filtern
spart vier Seiten, vier Services und die Frage „welches nehme ich jetzt?".

### 3.6 `/system/uwe-knowhow` (27 Z.) und `/system/whats-new` (39 Z.)

Selbstdokumentation der App in der App. `/system/startklar` (198 Z.) ist eine
Post-Update-Checkliste — sinnvoll genau einmal pro Update. Drei Nav-Einträge für Inhalte,
die in ein Changelog-Modal passen.

### 3.7 Meta-Werkzeuge, die das Produkt über sich selbst reden lassen

`/bugs` (Bug-Center, 109 Z. + GitHub-Issue-Route), `/ideas` (Ideen-Management mit
Cursor-Dispatch, 13 Guards), `/prompts` (Prompt-Bibliothek), `/admin/agent-jobs`
(Cursor Agent Jobs), `/system/navigation` (Nav-Overview). Fünf Nav-Einträge, mit denen man
UWE *entwickelt*, nicht *benutzt*. Für ein selbstgehostetes Ein-Personen-System ist das
Werkzeug für den Werkzeugbau — nützlich, aber es gehört nicht in dieselbe Ebene wie
„Küche" und „Sessions". Mindestens hinter einen Developer-Schalter.

### 3.8 `/household` und `/documents` mit Platzhalter-Inhalten

Beide Seiten enthalten „Demnächst"/Platzhalter-Markierungen, stehen aber als vollwertige
Nav-Einträge da. Angefangene Bereiche sollten nicht wie fertige aussehen.

### 3.9 `@uwe/web-search` — 84 Zeilen, 2 Importer

Kaum Substanz. Entweder in `ai-brain` aufgehen lassen oder streichen.

---

## 4. Wo verschlanken — konkret

Nach Wirkung pro Aufwand geordnet.

### Sofort (Sicherheit, klein, hoher Nutzen)

1. **Rollenprüfung in `requireStudioActionAuth()`** ergänzen (~15 Zeilen) plus
   Boundary-Test über alle `"use server"`-Dateien. Schließt B1.
2. **`assertWorldReadable()` im Portal-Welt-Layout aufrufen** (~5 Zeilen). Schließt B2 für
   alle 20 Weltseiten auf einen Schlag.
3. **Tote Guards löschen oder verdrahten** (B5). Jeder tote Guard ist eine Einladung, sich
   auf ihn zu verlassen.

### Kurzfristig (Klarheit, ~1.500 Zeilen weniger)

4. **Ein Rechtekonzept festlegen.** Mein Vorschlag: Modell 1 + 2 sind die Wahrheit,
   Modell 3 wird gelöscht, Modell 4 wandert nach `docs/`. Wer die Capability-Matrix
   behalten will, muss `hasCapability()` in die Guards einziehen — dann kann
   `role-capabilities.ts` die grobe Rollentabelle *ersetzen* statt sie zu doppeln.
5. **Dashboard-Konsolidierung:** `/admin/status`, `/system/health`,
   `/system/command-center`, `/admin/cockpit` → Redirects auf `/system` mit Tab-Parameter.
   Vier Seiten, vier Nav-Einträge weg.
6. **Welt-Werkzeuge zusammenlegen:** `radar` + `open-items` + `quality` + `inspector` →
   ein Screen. Die vier Services bleiben als Datenquellen, die UI wird eine.
7. **Meta-Werkzeuge hinter einen Schalter** (`/bugs`, `/ideas`, `/prompts`,
   `/admin/agent-jobs`, `/system/navigation`): eine Settings-Option „Entwickler-Werkzeuge
   anzeigen", Default aus. Fünf Nav-Einträge weniger im Alltag, kein Code gelöscht.

### Mittelfristig (die eigentliche Entscheidung)

8. **Brain-Duplikat auflösen.** Der jetzige Zustand — zwei UIs auf einer DB — ist die
   teuerste Variante. Zwei saubere Wege:

   - **(A) Brain gewinnt.** Studios „Organisation" und „Erfassen & Alltag" werden zu
     Redirects auf die Brain-App. Studio wird wieder reine DM-App, `product-contracts`
     stimmt plötzlich, und die 108 `brain-client`-Importe in Studio verschwinden.
     Kosten: Brains 11 Seiten müssen Studios Funktionsumfang erreichen (Studio hat dort
     ~3.700 Zeilen mehr Funktionalität).
   - **(B) Studio gewinnt.** `apps/brain` wird gelöscht (3.400 Zeilen), Life-Brain-Inhalte
     bleiben in Studio hinter `permission: ["owner"]`. Ehrlich, sofort umsetzbar — aber
     dann muss `product-contracts` weg, weil das Produktmodell aufgegeben wird.

   Was nicht geht, ist der Status quo. Er kostet doppelte Wartung und liefert kein
   Produkt-Argument.

9. **Atlas 3D bewerten** (siehe 3.1). Die einzige Maßnahme mit fünfstelligem
   Einsparpotenzial.

### Struktur-Hygiene

10. `packages/database/src/server.ts` (2.185 Zeilen, ~440 Importer) ist zu Recht
    eingefroren. Die 24 Baseline-Einträge sind aber kein Endzustand — insbesondere
    `nl-command-service.ts` (1.416), `ai-review-service.ts` (1.167) und
    `tag-service.ts` (1.082) sind Domänen-Services, die laut eigener CLAUDE.md-Regel gar
    nicht in `packages/database` gehören. Sie sind die naheliegendsten Kandidaten für
    Feature-Packages.
11. **Brain-Nav an `@uwe/shared-utils/navigation` anschließen**, solange Brain existiert.
    Ein handgeschriebenes Nav-Array driftet garantiert ab.

---

## 5. Zusammenfassung in fünf Sätzen

Die Sicherheitsmechanik, die man erwartet — API-Guards, `dm_only`-Filterung,
Owner-Gating für Restore und Brain — ist vorhanden, konsequent und getestet. Zwei
unauffällige Pfade sind offen: Studio-Server-Actions prüfen nur CSRF und keine Rolle
(was über den öffentlichen `/api/auth/enter` zu einer echten Rechteausweitung führt), und
Portal-Weltseiten prüfen keine Welt-Mitgliedschaft. Daneben existieren zwei vollständig
ausformulierte Rechtemodelle — die Capability-Matrix und die Audience-Domain-Matrix —,
die nirgends erzwungen werden und deren zweite von Studio in 108 Dateien widerlegt wird.
Die Navigation ist handwerklich exzellent gepflegt (keine toten Links, zentraler Contract,
Tests), ordnet aber drei Produkte unter sieben Studio-Überschriften ein, und `apps/brain`
dupliziert Studios kompletten Organisation-Bereich auf derselben Datenbank. Das größte
Einsparpotenzial liegt nicht in vielen kleinen Features, sondern in drei Entscheidungen:
Brain oder Studio, Atlas 3D ja oder nein, und welches der vier Rechtekonzepte gilt.
