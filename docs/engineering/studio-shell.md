# Studio-Shell — ein Rahmen für alle Routen

Stand: August 2026. Verbindlich für alles unter `apps/studio/app/**`.

## Die Regel

**Keine Route rendert ihre eigene Navigation.** Der Rahmen sitzt genau einmal
im Root-Layout (`apps/studio/app/layout.tsx`); Seiten liefern nur noch Inhalt.

## Warum

Bis dahin gab es zwei Shells, und jede Seite entschied selbst, welchen sie
aufmacht:

| | `StudioShell` (+ `SystemShell`) | `WorldShell` |
|---|---|---|
| Seitenleiste | globale Studio-IA (11 Gruppen) | Welt-IA (6 Gruppen) |
| Marke | „UWE Studio" → `/worlds` | Weltname → Welt-Dashboard |
| Bottom-Nav | Produktwechsel | **keine** |

Die beiden Seitenleisten ersetzten einander vollständig. In einer Welt waren
Suche, Brain, KI, Jobs und Admin aus der Navigation verschwunden; außerhalb die
Welt. Der Weltwechsel *war* der Shell-Wechsel: zurück auf `/worlds`, Karte
anklicken, anderer Rahmen. Auf dem Telefon fehlte in der Welt jeder Weg zu
Portal, Brain oder Family.

## Wie es jetzt aussieht

```
apps/studio/app/layout.tsx
  └─ ShellProvider          Welt-Zustand + Slots (Client)
       └─ AppShell          Seitenleiste, Topbar, Main, Kontextspalte
            └─ {children}   die Seite — nur Inhalt
```

Die Seitenleiste trägt zwei Blöcke:

```
UWE Studio                 Marke → /worlds
[ 🌐 Terra            ▾ ]  Welt-Switcher (immer sichtbar)
  TERRA                    Welt-Block — nur bei aktiver Welt
    Übersicht ▸ Wiki ▸ …
  STUDIO                   globaler Block — immer
    Start ▸ Welten ▸ KI ▸ …
```

Am Spieltisch schrumpft der Welt-Block auf die vier Live-Ziele. Das war früher
die Prop `navMode="live"`, die genau eine Seite gesetzt hat; der Shell liest es
jetzt selbst aus dem Pfad (`liveSessionIdFromPathname`).

## Die aktive Welt

Die Welt ist **Zustand**, kein Rahmen. Zwei Cookies, klar getrennt:

| Cookie | Inhalt | Gelesen von |
|---|---|---|
| `uwe_active_world` | **welche** Welt zuletzt aktiv war | Root-Layout (Startwert), `/portal` |
| `uwe_world_route_<slug>` | **wo** in dieser Welt zuletzt gearbeitet wurde | `/worlds/[worldSlug]` (Redirect) |

Zusammen ergeben sie den Rückweg: der Welt-Switcher zielt auf `/worlds/<slug>`
und lässt den dortigen Redirect die Unterroute wählen.

**Die Auflösung läuft im Client** (`ShellProvider`), nicht im Layout. Grund: das
Root-Layout rendert bei einer Client-Navigation nicht neu — ein serverseitig
berechneter Welt-Kontext bliebe beim Wechsel von Terra nach Aldoria auf Terra
stehen. Der Server liefert nur den geprüften Cookie-Startwert, damit der erste
Aufschlag ohne Nachrücken und ohne Hydration-Mismatch sitzt.

Regeln in `apps/studio/src/lib/active-world.ts`:
- Der Pfad schlägt das Gemerkte.
- Beides zählt nur, wenn die Welt in der geladenen Weltliste steht. Ein Cookie
  auf eine gelöschte Welt darf keine Seitenleiste voller 404-Ziele erzeugen.
- Der Zustandsabgleich passiert **während des Renderns**, nicht im Effekt —
  sonst käme ein Bild mit der alten Welt auf den Schirm, bevor korrigiert wird.

## Was eine Seite noch beisteuert

Zwei Melder aus `@/src/components/shell`. Beide rendern selbst nichts, sie
schreiben in Slots des Shells.

```tsx
// Nur nötig, wenn das letzte Segment ein Datensatz-Titel ist.
<ShellBreadcrumb items={worldDetailBreadcrumb(world.name, slug, "Sessions", href, session.title)} />

// Rechte Kontextspalte (ab lg sichtbar). Höchstens einer pro Seite.
<ShellContextPanel>
  <WikiContextPanel … />
</ShellContextPanel>
```

Ohne `ShellBreadcrumb` leitet der Shell die Spur aus dem Navigationsvertrag ab
(`apps/studio/src/navigation/derive-breadcrumb.ts`) — das genügt für alle
Listen- und Bereichsseiten und ist der Normalfall.

### Bekannter Kompromiss: die Kontextspalte kommt erst mit der Hydration

Der Shell rendert im Baum **über** der Seite. Inhalt kann deshalb nicht aus der
Seite nach oben in den Rahmen fließen, ohne durch React-State zu laufen — und
State-Schreiber laufen im Effekt, also nach dem ersten Bild. Konkret:

- **Brotkrumen**: kein Problem. Die abgeleitete Spur steht serverseitig da; die
  Meldung einer Detailseite verfeinert sie nur.
- **Kontextspalte**: das `<aside>` ist beim ersten Bild leer und füllt sich bei
  der Hydration. Auf den rund zwanzig Seiten mit Kontextspalte rückt die
  Hauptspalte ab `lg` einmal um 320 px. Bewusst in Kauf genommen: die Spalte ist
  Zusatzinformation (unter `lg` ohnehin ausgeblendet), und die Alternative wären
  Next.js Parallel Routes mit einem `@context`-Slot plus `default.tsx` über den
  gesamten Routenbaum.

Wenn der Sprung stört, ist das der Weg: Parallel Routes für den Slot, nicht ein
zweiter Shell.

## Routen ohne Rahmen

`isChromelessStudioPath` (`apps/studio/src/lib/studio-chrome.ts`): Landing (`/`),
`/login`, `/logout`, `/setup`, `/forgot-password`, `/reset-password` und
`/maintenance`. Die Liste deckt sich mit den Ausnahmen in
`enforceStudioPageAuth` — der Shell setzt eine angemeldete Sitzung voraus, und
genau dort wird sie nicht erzwungen.

`/maintenance` lief vorher mit voller Seitenleiste, obwohl im Wartungsmodus
jedes Ziel dorthin zurückleitet und die Seite ohne Anmeldung erreichbar ist.

## Die gemalte Bühne

Auch die Szene ist Rahmen und keine Seiteneigenschaft — der Shell entscheidet,
nicht die Route. `hasStudioSceneBand` (`src/lib/studio-scene.ts`) führt die
Einstiege, die sie tragen: `/worlds`, `/brain`, `/knowledge`, `/continue`,
`/ai`. Die Liste ist **exakt**, kein Präfix: `/worlds` trägt die Bühne,
`/worlds/terra/wiki` nicht. Studio ist die Arbeitsfläche, und hinter einem
Editor oder einer Job-Liste hat kein Hintergrundvideo zu laufen.

Studio zeigt sie als **Band** am oberen Rand von `<main>`, nicht als Vollbild
wie Portal, Brain und Family — dort trägt ein `SceneHero` zusätzlich Titel und
Subline. Im Studio bringt jede Seite ihren `PageHeader` selbst mit; ein zweiter
Titel auf dem Bild wäre eine Dopplung. Das Band ist deshalb reine Kulisse
(`StudioSceneBand`).

Zwei Dinge daran sind nicht beliebig:

- Der Szenen-Index kommt als Prop aus dem Root-Layout. Der Shell ist eine
  Client-Komponente und würde `dayIndex()` bei SSR und Hydration je einmal
  auswerten — über eine Tagesgrenze hinweg wären das zwei Bilder.
- `<main>` trägt `relative isolate`, das Band `z-index: -1`. Ohne `isolate`
  fiele es hinter den Grund des Shell-Rahmens und wäre unsichtbar; mit dieser
  Kombination braucht der Seiteninhalt weder Wrapper noch eigene z-index-Angabe.

Dass eine Bühne wirklich rendert, hält `scripts/scene-motion-coverage.test.ts`
fest — die Assets allein sagen darüber nichts.

## Beim Bauen beachten

- Neue Seite: kein Wrapper, kein Layout, keine Sidebar. Inhalt zurückgeben.
- Neuer Einstieg, der die Bühne tragen soll: in `src/lib/studio-scene.ts`
  eintragen, nicht im Seiteninhalt einbauen.
- Neues Navigationsziel: in `src/navigation/world-nav.ts`. Seitenleiste,
  Schublade, Suche, Palette und Brotkrumen ziehen von dort. `studio-nav.ts`
  trägt nur noch die drei welt-losen Bereiche (Start · Welten · System) und
  wächst nicht mehr: gearbeitet wird in einer Welt, und ein globaler Eintrag
  neben dem Welt-Eintrag wäre ein zweiter Weg zum selben Ziel ohne
  Welt-Kontext. Eine Route, die keine Seitenleiste bekommen soll, aber
  auffindbar bleiben muss, gehört in `STUDIO_PALETTE_EXTRA`
  (`src/lib/studio-navigation.ts`).
- Bereichs-Unternavigation im Inhalt (`SettingsShell`-Tabs, Filterleisten,
  `CampaignSidebar`) bleibt erlaubt — das ist Inhalt, keine IA.
- Kit-Komponenten aus `src/components/ui/*`. Die Widgets in
  `packages/shared-ui/src/shells/` sind Altbestand und wachsen nicht mehr.
