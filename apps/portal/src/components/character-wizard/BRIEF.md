# Bauanleitung für die Schritte des Charakter-Erstellers

Diese Datei ist der gemeinsame Nenner aller Schritt-Komponenten. Wer einen
Schritt baut oder ändert, hält sich daran — sonst zerfällt der Ersteller in
neun Oberflächen, die zufällig hintereinander liegen.

## Wo die Dateien liegen

```
apps/portal/src/components/character-wizard/
  CharacterWizard.tsx   Gerüst, Schrittleiste, Fußnavigation  (fertig)
  CharacterRail.tsx     Die rechte Vorschau-Spalte            (fertig)
  useDraft.ts           Entwurf + sessionStorage              (fertig)
  types.ts              StepProps — der Vertrag               (fertig)
  wizard.css            Die gesamte Optik                     (fertig)
  steps/<Name>Step.tsx  Ein Schritt pro Datei                 (zu bauen)
```

Jeder Schritt exportiert genau eine benannte Komponente:

```tsx
export function SpeciesStep({ draft, set, patch, resolved, preview, validation, goTo }: StepProps) { … }
```

## Harte Regeln

1. **Max. 700 Zeilen pro Datei.** Wird es mehr, in `steps/<name>/` aufteilen.
2. **Kein `any`.** Strict TypeScript. Kein `@ts-expect-error`.
3. **Deutsch.** Jede sichtbare Zeichenkette. Auch Fehlermeldungen, auch
   `aria-label`, auch Platzhalter.
4. **Keine neuen Abhängigkeiten.** Es gibt kein framer-motion, kein
   Icon-Paket außer `NavIcon` (Lucide, kebab-case-Namen).
5. **Keine Farbwerte, keine Pixelwerte, keine Millisekunden im TSX.** Alles
   Sichtbare kommt über die Klassen aus `wizard.css`. Fehlt eine Klasse,
   wird sie dort ergänzt — nicht inline gebaut.
6. **Bilder nur same-origin, `data:` oder `blob:`.** Die CSP verbietet
   externe Quellen. Kein `next/image` (das Repo benutzt es nirgends).
7. **Ein `<h1>` pro Seite** — den rendert das Gerüst. Schritte beginnen bei
   `<h3>`; die `<h2>` ist der Schritttitel im Gerüst.

## Die Klassen aus `wizard.css`

| Klasse | Wofür |
|---|---|
| `.cw-grid` | Kachelraster, füllt automatisch nach Breite |
| `.cw-tile` | Eine wählbare Kachel. `aria-pressed` steuert den Auswahlzustand. |
| `.cw-tile__art` / `__name` / `__hook` / `__meta` / `__check` | Innenleben der Kachel |
| `.cw-chip` (`data-tone="accent"`), `.cw-chip__value` | Kleine Faktenmarke |
| `.cw-search`, `.cw-filters`, `.cw-filter` | Suchzeile und Filterpillen |
| `.cw-disclosure` | `<details>` für den vollen Regeltext |
| `.cw-prose` | Fließtext im lesbaren Maß |
| `.cw-buy-row`, `.cw-budget`, `.cw-budget__bar`, `.cw-budget__fill` | Punktekauf |
| `.cw-dice`, `.cw-die` (`data-dropped`, `data-rolling`) | Würfelwurf |
| `.cw-vitals`, `.cw-vital`, `.cw-abilities`, `.cw-ability` | Zahlenblöcke |

Eine Kachel sieht immer so aus:

```tsx
<button
  type="button"
  className="cw-tile"
  aria-pressed={selected}
  onClick={() => set("speciesKey", entry.key)}
>
  <span className="cw-tile__check" aria-hidden="true">
    <NavIcon name="check" width={16} height={16} />
  </span>
  <span className="cw-tile__art">{/* Wappen oder Sigill */}</span>
  <span className="cw-tile__name">{entry.name}</span>
  <span className="cw-tile__hook">{entry.hook}</span>
  <span className="cw-tile__meta">
    <span className="cw-chip">…</span>
  </span>
</button>
```

## Die Qualitätslatte

Ein Kritiker vergleicht jeden Schritt gegen den D&D-Beyond-Builder. Was er
prüft und was hier deshalb nicht fehlen darf:

- **Entscheidung zuerst, Regeltext danach.** Die Kachel zeigt den Haken
  (`hook`), die Kennzahlen und drei Rollenschlagworte. Der vollständige
  Regeltext steckt in einer `.cw-disclosure`. Wer den SRD-Absatz direkt auf
  die Kachel kippt, hat den Schritt verloren.
- **Die Wahl muss man von weitem sehen.** `aria-pressed` reicht der CSS; ein
  reiner Rahmenwechsel wäre zu wenig, deshalb macht `wizard.css` Ecke, Haken
  und inneres Leuchten. Nichts davon selbst nachbauen.
- **Jede Wahl verändert sofort die rechte Spalte.** Das passiert automatisch,
  solange der Schritt über `set`/`patch` schreibt und nichts lokal spiegelt.
- **Suchen und Filtern**, sobald mehr als acht Einträge zur Wahl stehen.
- **Vergleichbarkeit.** Gleiche Kennzahlen an gleicher Stelle auf jeder
  Kachel — nur so kann man vier Optionen nebeneinander lesen.
- **Anfängerhilfe.** Wo es eine sinnvolle Empfehlung gibt (`complexity === 1`,
  passende Attribute zur Klasse), wird sie als Chip gezeigt, nicht versteckt.
- **Leerer Zustand ist gestaltet.** „Keine Treffer" bekommt einen Satz, der
  sagt, was zu tun ist.
- **Kein Sprung beim Klicken.** Auswahl darf das Raster nicht umbauen.

## Zugänglichkeit — wird automatisiert geprüft

`e2e/portal-a11y.spec.ts` fährt axe (WCAG A/AA) in hell und dunkel bei 390,
768 und 1440 px. Zusätzlich prüft `auditShell`: kein waagerechtes Scrollen,
keine Schrift unter 12 px, Trefferflächen ≥ 24 px (≥ 44 px auf Touch), genau
eine `<h1>`.

Konkret heißt das:

- Auswahlkacheln sind `<button type="button">` mit `aria-pressed`, keine
  `<div onClick>`.
- Eine Gruppe zusammengehöriger Kacheln bekommt ein `<fieldset>` mit
  `<legend>` oder ein `role="group"` mit `aria-label`.
- Zahlenfelder haben ein echtes `<label>`, nicht nur einen Platzhalter.
- Farbe trägt nie allein die Information — immer Haken, Text oder Symbol dazu.

## Der Katalog

Alles kommt aus `@uwe/character-creator`:

```ts
import {
  SPECIES, CLASSES, BACKGROUNDS, FEATS, LANGUAGES, ALIGNMENTS,
  EQUIPMENT_PACKS, WEAPONS, ARMOR, CANTRIPS, LEVEL1_SPELLS,
  spellsForClass, findFeat, findPack,
  ABILITIES, ABILITY_LABELS, ABILITY_SHORT, ABILITY_HINTS,
  STANDARD_ARRAY, POINT_BUY_BUDGET, evaluatePointBuy, canRaise, canLower,
  pointBuyStart, pointBuyStepCost, rollAbilityScores, applyPool,
  isPoolFullyAssigned, abilityModifier, formatModifier,
} from "@uwe/character-creator";
```

Der Katalog ist **rein** — keine Netzwerkaufrufe, kein Server. Ein Schritt
darf ihn direkt im Browser lesen.
