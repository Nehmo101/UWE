# UWE Informationsarchitektur — Portal & Studio

Stand: Juni 2026. Dieses Dokument beschreibt die getrennte Informationsarchitektur (IA) für **UWE Portal** (Spieler/Nutzer) und **UWE Studio** (Creator/DM/Owner/Admin), die technische Navigation und bekannte offene Punkte.

## Grundprinzip

| Oberfläche | App | Zielgruppe | Rolle |
|------------|-----|------------|-------|
| **UWE Portal** | `apps/portal` | Spieler, Besucher, eingeloggte Nutzer | Lesen, finden, nutzen — keine Adminfunktionen |
| **UWE Studio** | `apps/studio` | DM, Creator, Owner, Admin | Erstellen, verwalten, einrichten, diagnostizieren |

Portal und Studio haben **eigene Navigationen** und je einen eigenen Shell unter `apps/<app>/src/components/shell/`. Gemeinsam sind nur der framework-agnostische Navigationsvertrag (`@uwe/shared-utils/navigation`) und die Blätter aus `@uwe/shared-ui` (Suche, Bottom-Nav, Theme-Umschalter).

---

## A) Ist-Analyse (vor der Umstrukturierung)

### Portal — bestehende Routen

| Bereich | Routen | Bewertung |
|---------|--------|-----------|
| Öffentlich | `/`, `/login`, `/worlds/*`, `/share/*` | Korrekt — Gast-Wiki |
| Spieler-Hub | `/auth/worlds/*`, `/auth/account/*` | Korrekt, aber eigene `AuthHeader`-Navigation |
| Admin-Leaks | Welt erstellen, Preview-as-Player, „Admin/Einstellungen“-Link | Teilweise DM/Admin — bleiben funktional, Studio-Link ersetzt Admin-Link |

**Schmerzpunkte (behoben oder verbessert):**
- Zwei parallele Navigationsparadigmen (`AuthHeader` vs. `PortalShell`/`AppShell`)
- `portalAuthBottomNav` war definiert, aber nicht eingebunden
- Keine gruppierte Sidebar für Spieler-Hub
- Admin-Link im Portal-Header verwirrte Spieler

### Studio — bestehende Routen

| Bereich | Routen | Bewertung |
|---------|--------|-----------|
| Dashboard | `/studio`, `/` (Landing) | Zwei „Homes“ — Landing vs. Dashboard |
| Daily Admin OS | `/today`, `/capture`, `/projects`, … | Korrekt im Studio |
| Welten | `/worlds/[slug]/**` | Korrekt, aber uneinheitliche Sidebars |
| Admin/System | `/admin/*`, `/settings`, `/backup`, `/jobs` | Korrekt im Studio, verstreut in mehreren Nav-Quellen |
| Orphan-Routen | `/brain`, `/ai-runs`, `/admin/reviews`, `/admin/ai-gateway` | Schwer auffindbar — jetzt in `studio-navigation.ts` |

**Schmerzpunkte (behoben oder verbessert):**
- Vier konkurrierende Nav-Quellen (`adminSidebarNav`, `worldNavItems`, Custom-Sidebars, `StudioNavSidebar`)
- Mobile „Mehr“ → `/studio` mit anderer Sidebar als Daily-Admin-Seiten
- `worldNavItems` fehlten Brain/KI-Läufe
- Keine sectionierte Admin-Navigation

---

## B) Zielstruktur — UWE Portal

### Oberkategorien

| Kategorie | Nav-Label | Route(n) | Features |
|-----------|-----------|----------|----------|
| Start | Start | `/portal` | Login-Hub, Weiterleitung |
| Meine Welten | Meine Welten | `/auth/worlds` | Weltliste, Session-Hub |
| Welt entdecken | Welt entdecken | `/worlds` | Öffentliches/Gast-Wiki |
| Kampagnen | (in Welt-Übersicht) | `/auth/worlds/[slug]` | Player-Dashboard |
| Sessions | Sessions | `/auth/worlds/[slug]/sessions` | Session-Recaps |
| Charaktere | (in Wiki-Seiten) | `/auth/worlds/[slug]/[pageSlug]` | Charakter-Self-Edit |
| Handouts | Handouts | `/auth/worlds/[slug]/assets` | Medien, Handouts |
| Medien | (Filter in Handouts) | `?type=` | Asset-Typ-Filter |
| Spielernotizen | Spielernotizen | `/auth/worlds/[slug]/notes` | Eigene + Gruppennotizen |
| Soundboard | Soundboard | `/auth/worlds/[slug]/soundboard` | Ambient (read-only) |
| Suche | Suche | `?q=` auf Welt-Dashboard | GlobalSearchForm |
| Account | Account | `/auth/account/password`, `/security` | Passwort, 2FA |
| Hilfe | Hilfe | `/` | Landing mit Links |

### Portal-Regeln (umgesetzt)

- Keine Admin-Navigation im Portal-Sidebar
- Admin-Nutzer sehen **„Studio öffnen“** in der Topbar (nicht „Admin/Einstellungen“)
- Preview-as-Player bleibt auf Welt-Dashboard (DM-Tool, nicht in Hauptnav)
- Welt-Erstellung nur für Owner/Admin auf `/auth/worlds` (bestehendes Feature)

### Wichtigste Portal-Workflows

1. **Portal öffnen** → `/` oder `/login` → `/portal` → `/auth/worlds`
2. **Welt auswählen** → `/auth/worlds/[slug]`
3. **Session ansehen** → Sidebar „Sessions“ oder Dashboard-Karte
4. **Handouts öffnen** → Sidebar „Handouts“
5. **Notizen** → Sidebar „Spielernotizen“
6. **Account** → Sidebar „Account“ oder Bottom-Nav „Account“
7. **Zurück** → Breadcrumbs, Back-Links auf Detailseiten, Sidebar „Meine Welten“

### Abgrenzung zum Studio

Portal verlinkt optional auf Studio (nur für Admin-Rollen). Studio verlinkt nicht verwirrend zurück ins Portal-Admin.

---

## C) Zielstruktur — UWE Studio

### Oberkategorien (sectionierte Sidebar)

| Sektion | Inhalte |
|---------|---------|
| Dashboard | Studio Dashboard, Heute |
| Welten & Kampagnen | Welten, Globale Suche, Brain Store, Templates |
| Daily Admin OS | Capture, Projekte, Werkstatt, Verträge, Hardware, Life Brain |
| Inhalte & Medien | Image Studio, Mail Center, Kalender |
| KI-Werkzeuge | KI-Chat, KI-Prompt, KI-Gateway, Reviews |
| Integrationen | Einstellungen → Integrationen |
| Benutzer & Rollen | Benutzer, API Tokens, Webhooks |
| Admin | Admin Übersicht, Security, Audit Log, Tags, Cookbook |
| Einrichtung | Setup, Cookbook, KI-Gateway |
| System & Diagnose | Systemstatus, Jobs, Einstellungen → Status |
| Backup & Restore | Backup |
| Einstellungen | Einstellungen, Passwort, 2FA |

### Welt-Navigation (pro `[worldSlug]`)

Übersicht, Seiten, Sessions, Dungeons, Medien, Labels, Spielernotizen, Soundboard, Wissensgraph, Kanon & Leaks, Brain Store, KI-Läufe, Import, DnD API, Backup, Neue Seite.

### Wichtigste Studio-Workflows

1. **Studio öffnen** → `/login` → `/studio`
2. **Welt bearbeiten** → `/worlds` → `/worlds/[slug]/dashboard`
3. **Sichtbarkeit prüfen** → Inspektor oder `?preview=player` auf Wiki-Seiten
4. **Admin** → Sidebar-Sektion „Admin“ → `/admin`
5. **Einrichtung** → `/setup`, `/admin/cookbook`, `/admin/ai-gateway`
6. **Systemstatus** → `/admin/status` oder `/settings?tab=status`
7. **Backup** → `/backup` oder `/worlds/[slug]/backup`

### Abgrenzung zum Portal

Studio enthält alle Schreib-, Admin- und Setup-Funktionen. Player-Preview (`?preview=player`) ist ein DM-QA-Werkzeug, kein Portal-Ersatz.

---

## D) Navigationstechnik

### Neue/geänderte Komponenten

| Komponente | Ort | Zweck |
|------------|-----|-------|
| `portal-navigation.ts` | `apps/portal/src/lib/` | IA-Konfiguration Portal |
| `PortalAppShell` | `apps/portal/src/components/` | Einheitliche Portal-Shell |
| `navigation/*.ts` | `apps/studio/src/` | IA-Konfiguration Studio (Studio- und Welt-Nav) |
| `AppShell` | `apps/studio/src/components/shell/` | Der Studio-Shell, montiert im Root-Layout |
| `ShellProvider` | `apps/studio/src/components/shell/` | Welt-Kontext + Slots für Brotkrumen/Kontextspalte |

### Portal-Layouts

```
app/auth/
  layout.tsx                    # Pass-through
  (hub)/layout.tsx + page.tsx   # /auth/worlds — Meine Welten
  worlds/[worldSlug]/layout.tsx # Welt-Kontext + Bottom-Nav
  account/layout.tsx            # Account-Bereich
```

### Weiterleitungen

- `/auth/worlds` → Route-Group `(hub)/page.tsx` (URL unverändert)
- Bestehende Routen bleiben erhalten — keine Breaking Changes

### Middleware

- Portal setzt `x-uwe-pathname` für aktive Nav-Erkennung (wie Studio)

---

## E) Bekannte offene Punkte

| Punkt | Priorität | Hinweis |
|-------|-----------|---------|
| `/worlds/[slug]/pages/new` — `createPageAction` | Erledigt | `apps/studio/app/actions.ts` hat `"use server"`; Regression-Test in `studio-navigation.test.ts` |
| Landing `/` vs. Dashboard `/studio` | Mittel | Zwei Einstiege bewusst (Marketing vs. Arbeitsbereich) |
| Weltseiten: sectionierte Studio-Nav | Erledigt | Ein Shell, Welt-Block über globalem Block ([studio-shell.md](studio-shell.md)) |
| Zwei getrennte Studio-Shells | Erledigt | Zusammengeführt ins Root-Layout; Welt als Context + Cookie |
| Portal-Gast-Wiki auf `PortalGuestShell` | Erledigt | `/worlds/*`, `/share/*` (PR 4) |
| Command Palette an `studio-navigation.ts` | Erledigt | `studioCommandPaletteCommands()` in PR 1 |
| Cloudflare/Hosting ohne dedizierte Route | Niedrig | Verteilt auf `/admin`, `/hardware`, `/settings` |
| Preview-as-Player im Portal | Niedrig | DM-Tool; könnte später ins Studio verschoben werden |
| Welt-Erstellung im Portal | Niedrig | Funktional für Owner; langfristig nur Studio |

### Empfohlene nächste UX-Verbesserungen

1. Studio-Dashboard (`/studio`): Widget-Grid statt loser Kacheln (Mockup-Richtung)
2. ~~Welt- und Studio-Shell zusammenführen~~ — erledigt, siehe [studio-shell.md](studio-shell.md)
3. Mobile Overlap-Audit auf tiefen Dungeon-/Editor-Routen
4. Einheitliche Empty States / Stat-Cards auf verbleibenden Legacy-Inhalten
5. `global-nav.ts` entfernen, wenn nirgends mehr referenziert

---

## G) Shell-Komponenten (Stand August 2026)

**Studio hat genau einen Shell**, montiert im Root-Layout. Die frühere
Aufteilung in einen welt-losen und einen Welt-Rahmen (`StudioShell`,
`SystemShell`, `WorldShell`, `ModuleShell`) ist aufgelöst: die Welt ist Zustand
mit Cookie, kein Rahmenwechsel, und keine Route rendert noch eigene Navigation.
Details, Cookie-Vertrag und Slot-Melder: [studio-shell.md](studio-shell.md).

| Komponente | App | Verwendung |
|------------|-----|------------|
| `AppShell` (+ `ShellProvider`) | Studio | Alle Routen außer Landing/Auth/Wartung |
| `PortalShell` | Portal | Authentifizierter Spieler-Hub (`/auth/**`) |
| `PortalGuestShell` | Portal | Öffentliches Wiki, Share-Links (`/worlds/*`, `/share/*`) |

---

## F) Tests

```bash
pnpm --filter @uwe/portal test    # portal-navigation.test.ts
pnpm --filter @uwe/studio test    # studio-navigation.test.ts, mobile-nav.test.ts
```

Vollständiges Gate: `pnpm quality`
