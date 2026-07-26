# UWE — Zustandsanalyse: Rechtekonzept, Informationsarchitektur, Feature-Bilanz

Erstfassung: 2026-07-26 (Basis `0a9261c`) · **Aktualisiert: 2026-07-26 abends, Basis `main` @ `2cf0ae7`**

> ### Was sich seit der Erstfassung geändert hat
>
> Sieben PRs sind eingegangen (#792–#798). Kurzfassung, Details in
> [§6](#6-nachtrag--was-heute-dazugekommen-ist):
>
> | | Änderung | Wirkung auf diese Analyse |
> |---|---|---|
> | ✅ | **B1 und B2 behoben** (PR #797) | die beiden Rechte-Lücken sind zu |
> | ✅ | **Brain-Nav ist jetzt ein Modul** (`brain-nav.ts`, PR #798) | IA-Befund teilweise erledigt |
> | 🆕 | **`apps/landing`** — 5. App auf dem Apex-Origin | neue Oberfläche, sauber gebaut; `/api/auth/enter` liegt jetzt **doppelt** |
> | 🆕 | **Brain KI-Chat** (`/ki-chat`, `@uwe/brain-assistant`) | vorbildlich abgesichert — und der fertige Bauplan für den Family-Chatbot |
> | 🆕 | **MCP-Server** für Studio/Portal/Brain | Design sauber, aber **verschärft B4** |
> | ⚠️ | **`terra.html`** — 3998 Zeilen, nirgends referenziert | **vierter** Karteneditor; verschärft §3.1 |
>
> Unverändert gültig bleiben: B3 (Capability-Matrix ohne Wirkung), B4 (Domain-Contract
> verletzt — jetzt schlimmer), B5 (tote Guards), sowie die IA-Befunde zu Studio.

---

## 0. Kennzahlen

Aktualisiert auf `2cf0ae7`; Werte der Erstfassung in Klammern, wo sie sich bewegt haben.

| | |
|---|---|
| TypeScript gesamt (ohne `generated/`) | ~353.000 Zeilen *(327.000)* |
| davon `apps/studio` | 108.300 (31 %) *(104.500)* |
| davon `apps/portal` | 23.600 *(11.100)* |
| davon `apps/brain` | 7.500 *(3.400 — durch KI-Chat mehr als verdoppelt)* |
| davon `apps/landing` | 590 *(neu)* |
| davon `apps/rtx-connector-client` | 7.800 |
| Packages | 39 *(37 — neu: `mcp`, `brain-assistant`)* |
| Prisma-Modelle | 97 (App-DB) + 49 (Brain-DB) *(45 — 4 neue für den KI-Chat)* |
| Studio: Seiten / API-Routes / Server Actions | 149 / 204 / 272 (in 59 Dateien) |
| Portal: Seiten / API-Routes | 34 / 24 |
| Brain: Seiten / API-Routes | 16 / 5 *(14 / 2)* |
| Landing: Seiten / API-Routes | 1 / 2 *(neu)* |
| Nicht referenzierter Code am Repo-Root | `terra.html`, 3998 Zeilen *(neu)* |
| Eingefrorene Monolithen (`file-size-baseline.json`) | 24 Dateien *(unverändert)* |

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

#### B1 — Studio Server Actions haben **kein** Rollen-Gate (kritisch) — ✅ BEHOBEN in PR #797

> **Status 2026-07-26 abends:** geschlossen. `requireStudioActionAuth()` erzwingt jetzt
> zusätzlich `STUDIO_ACCESS_ROLES` (401 ohne Session, 403 bei falscher Rolle). Der
> Dev-Bypass bleibt an `studioAuthRequired()` gebunden. Weil `server-actions.test.ts`
> bereits statisch erzwingt, dass jede Action den Guard aufruft, wirkte die Härtung
> sofort auf alle 272 Actions. Die Beschreibung unten bleibt als Begründung stehen.
>
> **Offener Rest:** `/api/auth/enter` existiert seit PR #796 **doppelt** — in
> `apps/landing` und weiterhin unverändert in `apps/studio`, beide mit identischer
> `hasTargetAccess`-Logik. Der Exploit-Pfad ist durch den Rollen-Check tot, aber eine
> Login-Zustandsmaschine an zwei Origins doppelt zu pflegen ist eine vermeidbare
> Angriffsfläche. Empfehlung: die Studio-Variante entfernen, jetzt wo Landing sie trägt.


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

#### B2 — Portal-Weltseiten prüfen keine Welt-Mitgliedschaft (hoch) — ✅ BEHOBEN in PR #797

> **Status 2026-07-26 abends:** geschlossen. Das Gate sitzt jetzt in
> `getAccessContextForWorld()` — im Datenpfad, nicht im Layout, weil ein Next.js-Layout
> nicht bei jeder Navigation innerhalb seines Segments neu läuft. Damit sind alle 20
> Weltseiten, 4 API-Routes und 6 Action-Module abgedeckt. Das Welt-Layout prüft
> zusätzlich über `loadReadableWorld()`, damit auch der Weltname nicht durchsickert.
> `assertWorldReadable()` ist nicht mehr tot (siehe B5).


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

#### B4 — `@uwe/product-contracts` wird von Studio in 108 Dateien verletzt (mittel → **erhöht**)

> **Status 2026-07-26 abends: verschärft.** Mit PR #796 ist der Brain-MCP-Server
> hinzugekommen. Sein Design ist bewusst sauber — HTTP-Client vor der laufenden App,
> damit alle Guards auf dem Request-Pfad bleiben. Nur: Brain-Inhalte liest er **über
> Studio** via `/api/life-brain/*`, weil `apps/brain` selbst nur `/api/health` anbietet
> (dokumentiert in `packages/mcp/src/client/config.ts`).
>
> Damit ist die Vertragsverletzung nicht mehr bloß Altlast, sondern **tragende
> Voraussetzung eines neuen Features**. Wer Studio künftig von `personal_brain` trennen
> will, muss zuerst den Brain-MCP umhängen. Das erhöht die Kosten von Option (A) in
> §4.8 spürbar — und ist ein Argument, die Entscheidung nicht weiter aufzuschieben.


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

> **Status 2026-07-26 abends:** `assertWorldReadable` ist durch PR #797 nicht mehr tot —
> es ist jetzt die werfende Variante von `loadReadableWorld()`, das im Welt-Layout
> aufgerufen wird. Die übrigen fünf Einträge stehen unverändert.

| Symbol | Ort | Aufrufstellen im Produktivcode |
|---|---|---|
| ~~`assertWorldReadable`~~ | `apps/portal/src/lib/auth.ts` | ✅ verdrahtet (PR #797) |
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

### 3.1 Kartenwerkzeuge — 25.748 Zeilen in **vier** parallelen Implementierungen

*Aktualisiert 2026-07-26 abends: aus drei sind vier geworden.*

| Implementierung | Zeilen | Eingebunden in |
|---|---|---|
| `@uwe/atlas` | 10.654 | Studio + Portal (`/atlas3d`) |
| `@uwe/atlas-3d` | 10.308 | Studio + Portal (`/atlas3d`) |
| `@uwe/atlas-editor` | 788 | Studio + Portal (`/atlas3d`) |
| **`terra.html`** *(neu, PR #793)* | **3.998** | **nirgends** |

Die ersten drei bedienen genau eine Route in Studio und eine im Portal — **6,2 % des
Codes** für einen 3D-Globus. Ein D&D-Tisch braucht eine Karte mit Pins; ein
Planeten-Editor mit Terrain, Features, Objekten und Kamera-Bookmarks ist ein eigenes
Produkt.

`terra.html` liegt seit PR #793 am Repo-Root und ist **repo-weit nirgends referenziert** —
kein Import, kein Build-Schritt, kein Deploy, keine Doku, kein Link. Der Commit sagt es
selbst: *„Berührt keinen Bestandscode: eine neue Datei, sonst nichts."* Die Datei läuft
über `file://` und lädt three.js r128 per CDN-Script-Tag, ist also auch bewusst außerhalb
der CSP und des Dependency-Managements.

Als Prototyp ist das legitim und sogar klug — man baut so etwas erst mal frei. Als
Dauerzustand im Hauptrepo ist es die vierte Antwort auf dieselbe Frage. **Es braucht eine
Entscheidung, keine weitere Implementierung:**

- Wird `terra` die Zukunft der Karte? Dann ersetzt es die Atlas-Familie — 21.750 Zeilen
  können weg, und `terra` muss in eine App integriert werden (CSP, three.js als
  Dependency, Persistenz statt Datei-Export).
- Ist es ein Experiment? Dann gehört es in einen eigenen Branch oder ein
  `prototypes/`-Verzeichnis mit README, nicht neben `package.json`.
- Beides parallel zu pflegen ist die einzige Option, die sicher Geld kostet.

*Empfehlung:* Erst `terra` vs. Atlas entscheiden, dann die Verlierer-Implementierung
ausbauen. Das ist mit Abstand der größte Einzelposten in diesem Dokument.

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

*Aktualisiert 2026-07-26 abends.*

Die Sicherheitsmechanik, die man erwartet — API-Guards, `dm_only`-Filterung, Owner-Gating
für Restore und Brain — ist vorhanden, konsequent und getestet; die zwei unauffälligen
Lücken (Studio-Server-Actions ohne Rollen-Gate, Portal-Weltseiten ohne
Mitgliedschaftsprüfung) sind mit PR #797 geschlossen, und der am selben Tag hinzugekommene
Brain-KI-Chat zeigt, dass die Lehre daraus sitzt: sein Action-Guard prüft die Owner-Rolle
und sagt im Kommentar ausdrücklich, dass er das anders macht als Studio. Was bleibt, sind
zwei vollständig ausformulierte Rechtemodelle — die Capability-Matrix und die
Audience-Domain-Matrix —, die nirgends erzwungen werden; die zweite wird von Studio in 108
Dateien widerlegt und ist durch den neuen Brain-MCP-Server, der Brain-Inhalte über Studio
liest, inzwischen sogar tragend für ein Feature. Die Navigation ist handwerklich exzellent
gepflegt und hat mit der Bereichssuche und `brain-nav.ts` weiter gewonnen, ordnet aber
weiterhin drei Produkte unter sieben Studio-Überschriften ein, während `apps/brain` Studios
kompletten Organisation-Bereich auf derselben Datenbank dupliziert. Beim Code-Volumen ist
die Lage schlechter geworden statt besser: mit `terra.html` liegen jetzt vier parallele
Kartenimplementierungen im Repo, eine davon 3.998 Zeilen groß und an keiner Stelle
eingebunden. Das größte Einsparpotenzial liegt weiterhin nicht in vielen kleinen Features,
sondern in drei Entscheidungen — Brain oder Studio, welche der vier Karten gewinnt, und
welches der vier Rechtekonzepte gilt.

---

## 6. Nachtrag — was heute dazugekommen ist

PRs #792–#798, alle nach der Erstfassung dieser Analyse gemergt.

### 6.1 `apps/landing` — fünfte Oberfläche (PR #796)

590 Zeilen, trägt den Apex-Origin (`uweanddragons.org`). Die Middleware arbeitet mit einer
**vollständigen Allowlist** (`/`, `/api/auth/enter`, `/api/health`); alles andere gibt 404
oder leitet dauerhaft (308) auf denselben Pfad im Studio um, damit alte Lesezeichen nicht
ins Leere laufen. Das ist ein sauberes Deny-by-default und genau richtig für einen
öffentlichen Origin.

Ein Punkt bleibt: `/api/auth/enter` liegt jetzt **zweimal** im Repo — in `apps/landing`
und unverändert in `apps/studio` —, beide mit identischer `hasTargetAccess`-Logik. Das war
der Origin des B1-Exploits. Der ist tot, aber eine Login-Zustandsmaschine an zwei Origins
doppelt zu pflegen lädt zum Auseinanderdriften ein. Die Studio-Variante kann weg.

### 6.2 Brain KI-Chat (PR #795) — das Vorbild für Family

Neuer Bereich `/ki-chat` in Brain, neues Package `@uwe/brain-assistant` (1.384 Zeilen),
vier neue Prisma-Modelle (`BrainAssistantProfile`, `BrainChatConversation`,
`BrainChatMessage`, `BrainChatAttachment`), dazu Bildanalyse und Diktat über den
RTX-Connector.

**Sicherheitstechnisch ist das die beste Neuzugang-Arbeit im Repo:**

- `requireBrainActionAuth()` prüft die **Owner-Rolle**, nicht nur CSRF — mit dem Kommentar
  *„unlike Studio's trusted-scope guard — this asserts the global owner role."* Genau der
  Fehler aus B1 wurde bewusst nicht wiederholt.
- `guardAssistantApi()` kombiniert `requireBrainOwnerAuth` + Same-Origin + Rate-Limit, und
  begründet im Kommentar, warum die CSRF-Prüfung hier ausgeschrieben werden muss.
- `contextModeFor()` bildet nur auf `personal_brain` | `general_chat` ab, mit einem Test,
  der festhält: *„nothing else may appear."* `personal_brain` ist im `privacyGuard`
  dauerhaft cloud-gesperrt.

**Konsequenz für Family:** Der in der Bereichsliste vorgeschlagene Family-Chatbot (G12)
braucht kein Konzept mehr, sondern eine Kopiervorlage. `@uwe/brain-assistant` liefert
Konversationsmodell, Anhänge, Modellwahl, RAG-Kontext und Diktat. Für Family kommt genau
ein neuer Kontext-Modus dazu — und der muss, anders als `personal_brain`, gegen die
Family-DB laufen und pro Mitglied gefiltert werden.

### 6.3 MCP-Server für Studio, Portal und Brain (PR #796)

`packages/mcp`, 1.699 Zeilen. Design bewusst konservativ und dadurch gut: dünne
HTTP-Clients vor den laufenden Apps, sodass alle Route-Guards, RBAC-Prüfungen und das
Audit-Log auf dem Request-Pfad bleiben. Schreiben ist deny-by-default
(`UWE_MCP_ALLOW_WRITES`), Personal-Brain-**Inhalte** ebenso
(`UWE_MCP_BRAIN_ALLOW_CONTENT`, Default aus — ohne die Freigabe gibt es nur Metadaten).

Die eine Schattenseite steht in B4: Der Brain-MCP liest Brain-Inhalte über Studio
(`/api/life-brain/*`), weil `apps/brain` selbst keine Inhalts-API hat. Die
Contract-Verletzung ist damit tragend geworden.

### 6.4 Bereichs-Suchleiste (PR #798)

`@uwe/shared-utils/nav-search` (195 Zeilen, unit-getestet) plus `NavSearch.tsx` in
`@uwe/shared-ui`, eingebunden in Studio, Portal und Brain. Brain hat dabei
`src/navigation/brain-nav.ts` bekommen — statt des handgeschriebenen `SECTIONS`-Arrays in
der Komponente gibt es jetzt ein Modul mit Keywords.

Damit ist der IA-Befund aus §2.2 **teilweise** erledigt. Was bleibt: `brain-nav.ts`
definiert weiterhin einen **eigenen** Item-Typ (`href`/`label`/`icon` als Unicode-Zeichen)
statt `NavGroup` aus `@uwe/shared-utils/navigation`, das Studio und Portal nutzen. Geteilt
wird nur die Suche, nicht das Nav-Modell — die Drift ist verlangsamt, nicht beendet.

### 6.5 `terra.html` (PR #793)

Siehe §3.1 — der Befund hat sich dadurch von „drei Implementierungen" auf „vier" verschärft.

### 6.6 Design-Korrekturen (PRs #792, #794)

Darkmode-Lesbarkeit für Buttons, Badges und Tabs; Abmelden-Button erbt keine
System-Farben mehr; neues `uwe-base-reset.css` in `@uwe/shared-ui`. Ohne Auswirkung auf
Rechtekonzept oder Informationsarchitektur.
