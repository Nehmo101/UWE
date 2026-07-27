# Asset-Styleguide (Piktogramme & Gouache)

> **Diese Datei ist ein Laufzeitpfad, kein blosses Dokument.** Ihr Pfad steht
> als Konstante im Prompt-Kontext der RTX-Asset-Action (`packages/ai-brain`)
> und wird von einem Test geprüft. Nicht umbenennen, nicht verschieben.
>
> Der Karteneditor, für den sie ursprünglich geschrieben wurde, ist am
> 27.07.2026 entfallen; die Asset-Erzeugung, die sie als verbindliche Vorgabe
> in den Prompt gibt, läuft weiter. Deshalb bleibt sie.

Verbindlicher Styleguide für die **Karten-Piktogramme** und **Gouache-Assets**.
Er ergänzt die übergeordnete Stil-Referenz
[atlas-style-reference.md](atlas-style-reference.md) (handgezeichnete Tinten-Kartografie)
um konkrete Regeln und einen Katalog für die Punkt-Symbole und gemalten Assets.

> Ziel: einheitliche, sofort wiedererkennbare Karten-Assets — alte Ink-Glyphen
> bleiben stabil, neue Gouache-Assets folgen einer gemeinsamen Form-, Farb- und
> Review-Sprache.
>
> Für RTX-gestützte Asset-Erzeugung in UWE ist dieses Dokument die verbindliche
> Prompt- und Review-Quelle. RTX-Ausgaben sind Vorschläge, nie Auto-Apply.
>
> **Gouache ist der kanonische Look (Owner-Entscheid).** Die Ink-Spur ist
> **deprecated für Neues**: keine neuen Ink-Glyphen, die Editor-Palette zeigt
> nur noch Gouache/RTX, und alle Generatoren (KI-Bild-Stempel via
> `ATLAS_STAMP_STYLE_PROMPT`, RTX-Rezepte, Scatter, Säumen, Legenden) erzeugen
> bzw. rendern Gouache. Bestehende Ink-Keys bleiben als stabile FK-Träger
> (`AtlasObject.paletteItemId`, Restrict) und werden über `GLYPH_TO_GOUACHE`
> (`packages/atlas/src/assets-batch5.ts`) automatisch gemalt gerendert.

---

## Single Source of Truth

UWE hat zwei kanonische Asset-Spuren:

| Spur | Registry | Persistenz | Nutzung |
|---|---|---|---|
| Ink-Piktogramme | `packages/atlas/src/glyphs.ts` → `BUILTIN_GLYPHS` | `AtlasPaletteItem.builtinGlyphKey` / `AtlasObject.paletteItemId` | Bestehende Kontur-Symbole, rückwärtskompatibel |
| Gouache-Assets | `packages/atlas/src/assets.ts` → `GOUACHE_ASSETS` | `AtlasObject.style.gouache` plus gültiger Glyph-Träger | Gefüllte, gemalte Canvas-of-Kings-Assets |

Alle eingebauten Ink-Piktogramme leben an genau **einer** Stelle:

```
packages/atlas/src/glyphs.ts   →   BUILTIN_GLYPHS
```

Diese kanonische Liste wird von allen Stellen importiert — es gibt **keine**
parallelen, von Hand gepflegten Kopien mehr:

| Konsument | Import | Nutzung |
|---|---|---|
| Studio-Editor (`AtlasEditor.tsx`) | `@uwe/atlas/glyphs` | Palette (nach Kategorie gruppiert), Canvas-Rendering |
| Portal-Viewer (`AtlasViewer.tsx`) | `@uwe/atlas/glyphs` | read-only Canvas-Rendering |
| DB-Seed (`atlas-service.ts`) | `@uwe/atlas/glyphs` | `BUILTIN_ATLAS_GLYPHS` → globale `AtlasPaletteItem`-Zeilen |
| Statischer Export (`export-atlas.ts`) | `@uwe/atlas/glyphs` | spielt die Liste als `data.builtinGlyphs` in `atlas/data.json` ein; der Viewer liest sie von dort |

**Folge:** Wird ein Ink-Piktogramm in `glyphs.ts` ergänzt, ist es automatisch in
Editor-Palette, Portal, Export **und** als seedbare Palette verfügbar — „wenn
weitere Piktogramme hinzukommen, kann direkt darauf zugegriffen werden".

Hilfsfunktionen aus `@uwe/atlas/glyphs`:
`getGlyphByKey`, `listGlyphsByCategory`, `groupGlyphsByCategory`,
`ATLAS_GLYPH_CATEGORIES`, `BUILTIN_GLYPH_KEYS`.

Gouache-Hilfsfunktionen aus `@uwe/atlas/assets`:
`GOUACHE_ASSETS`, `GOUACHE_ASSET_KEYS`, `GOUACHE_CATEGORY_LABELS`,
`getGouacheAsset`, `listGouacheAssetsByCategory`, `drawGouacheAsset`,
`isGouacheAsset`.

**RTX-Regel:** Das RTX-Asset-Studio darf diese Registries und den
Asset-Katalog lesen, aber es schreibt nicht direkt TypeScript. Es erzeugt
validierte Asset-Vorschläge, die UWE als Preview/Review zeigt.

---

## Katalog

![UWE Atlas — Piktogramm-Katalog](atlas-pictograms.svg)

> Der Katalog (`atlas-pictograms.svg`) wird aus der kanonischen Registry erzeugt
> und ist damit immer aktuell. Mit „NEU" markierte Symbole wurden zuletzt ergänzt.
>
> Der Gouache-Backlog lebt in
> [../design/atlas-redesign/asset-catalog.md](../design/atlas-redesign/asset-catalog.md).
> Starter-Rezepte stehen in `packages/atlas/src/assets.ts`.

---

## Ink-Kategorien

Piktogramme gehören zu genau einer von drei Kategorien (Feld `kind`). Die Palette
gruppiert nach genau dieser Reihenfolge:

| Kategorie (`kind`) | Label | Inhalt |
|---|---|---|
| `relief` | Relief | Höhen & Landformen — Berge, Hügel, Vulkane, Klippen |
| `biome` | Biom | Vegetation & Gewässer — Wälder, Grasland, Sümpfe, Wüsten, Seen |
| `pin` | Marker | Orte & Bauwerke — Städte, Burgen, Türme, Brücken, Tempel |

---

## Design-Regeln: Ink-Piktogramme

Jedes Piktogramm folgt denselben Regeln, damit das Set homogen wirkt:

1. **Nur Konturen, keine Flächen.** Die Renderer (Canvas2D) *stroken* den Pfad,
   sie füllen nicht. `fill="none"` im SVG-Preview.
2. **24×24 viewBox.** Gezeichnet wird zentriert in einem 24×24-Raster.
3. **Bodenlinie ~ y = 21.** „Stehende" Objekte (Turm, Tempel, Stadt …) sitzen auf
   ~`y=21`; Gelände-Glyphen dürfen den Rahmen ausfüllen.
4. **Strichstärke 1.5**, `stroke-linecap="round"`, `stroke-linejoin="round"`.
5. **Erlaubte Pfad-Befehle:** ausschließlich **absolute** `M L H V Q C Z`, und
   **ein Segment pro Befehl** (z. B. mehrere `L` statt eines `L` mit vielen Punkten).
   Grund: Der Pfad-Parser der Renderer ist bewusst minimal (siehe
   [Rendering-Details](#rendering-details)). Relative Befehle (`m l q …`),
   `S`/`A`/Arcs und Mehrfach-Koordinaten werden **nicht** unterstützt.
6. **Gedämpfte Erd-/Tinten-Farben.** `color` ist ein 6-stelliger Hex-Wert, der zum
   Pergament passt (Braun-, Grau-, Grün-, Blautöne; Tinte `#1a1008`).
7. **Stabile `key`s.** Der `key` wird als `builtinGlyphKey` persistiert und in
   gespeicherten Karten referenziert — **niemals umbenennen oder entfernen**
   (sonst verlieren bestehende Objekte ihr Symbol). Nur additiv erweitern.

---

## Design-Regeln: Gouache-Assets

Gouache ist die neue CoK-nahe Asset-Spur. Sie ist **gefüllt**, malerisch und
deckend, aber weiterhin deterministisch, schnell und kartografisch lesbar.

1. **Gefüllte Formen statt reiner Kontur.** Jedes Asset hat Körperfläche,
   dunkleren Pigmentrand, Schatten und mindestens ein Highlight.
2. **Base-centre-Anker.** Der Objektpunkt sitzt am unteren Mittelpunkt; das
   Asset wächst primär nach oben (`drawGouacheAsset` übersetzt nach `x/y` und
   rotiert/skaliert dann).
3. **Gedämpfte Kartenpalette.** Erdige Rot-, Ocker-, Grün-, Grau- und Blautöne;
   keine grellen UI-Farben, keine fotorealistischen Texturen.
4. **Deterministische Variation.** Organische Formen nutzen `mulberry32` /
   `hashStringToSeed`, damit dieselbe Welt reproduzierbar bleibt.
5. **Keine fremden CoK-Assets kopieren.** Canvas of Kings ist Stilreferenz, keine
   Asset-Quelle. Rezepte sind eigene Formen.
6. **Kein Runtime-Code aus RTX.** RTX darf JSON/Parameter/Skizzen vorschlagen,
   aber UWE führt keine generierte TypeScript- oder JavaScript-Quelle direkt aus.
7. **Stabile `g_`-Keys.** Builtin-Gouache-Assets verwenden `g_<name>` und werden
   nach Veröffentlichung nicht umbenannt. Custom-Assets bekommen eigene stabile
   IDs/PaletteItems.
8. **Review vor Kanon.** Jedes RTX-Asset landet zuerst als Preview/Proposal; erst
   nach Übernahme wird es in einer Welt oder Palette sichtbar.

Gouache-Kategorien in `assets.ts`: `flora`, `structure`, `landmark`, `vehicle`,
`market`, `prop`. Der größere Backlog nutzt zusätzlich Umsetzungs-Tags wie
`Plot`, `Path`, `Landmark`, `Gen` und `Terrain`.

---

## Aktuelle Piktogramme

Quelle der Wahrheit ist `glyphs.ts`; `pathData` und `color` stehen dort. Diese
Tabelle listet bewusst nur die stabilen Identifikatoren.

### Relief
| `key` | Name | Status |
|---|---|---|
| `mountain` | Berg | Bestand |
| `mountain_snow` | Schneeberg | Bestand |
| `hill` | Hügel | **neu** |
| `volcano` | Vulkan | **neu** |
| `mountain_range` | Gebirgskette | **neu** |
| `cliff` | Klippe | **neu** |

### Biom
| `key` | Name | Status |
|---|---|---|
| `tree` | Wald | Bestand |
| `water` | See/Meer | Bestand |
| `pine` | Nadelwald | **neu** |
| `grass` | Grasland | **neu** |
| `swamp` | Sumpf | **neu** |
| `desert` | Wüste | **neu** |

### Marker
| `key` | Name | Status |
|---|---|---|
| `city` | Stadt | Bestand |
| `village` | Dorf | Bestand |
| `ruin` | Ruine | Bestand |
| `castle` | Burg | Bestand |
| `tower` | Turm | **neu** |
| `bridge` | Brücke | **neu** |
| `harbor` | Hafen | **neu** |
| `temple` | Tempel | **neu** |

---

## Neues Piktogramm hinzufügen

1. **Eintrag ergänzen** in `packages/atlas/src/glyphs.ts` im passenden
   Kategorie-Block:

   ```ts
   {
     key: "lighthouse",      // stabil, einzigartig, snake_case
     name: "Leuchtturm",     // deutscher Anzeigename
     kind: "pin",            // relief | biome | pin
     pathData: "M10 22 L9 8 L15 8 L14 22 Z ...", // 24×24, nur M L H V Q C Z, absolut
     color: "#2a1d10",
   },
   ```

2. **Designregeln einhalten** (siehe oben). Tipp: zuerst in einem 24×24-SVG-Editor
   skizzieren, dann auf erlaubte Befehle reduzieren.

3. **Tests laufen lassen:** `pnpm --filter @uwe/atlas test`
   (prüft eindeutige Keys, gültige Kategorie/Pfad-Befehle, Kategorie-Mindestmengen)
   und `pnpm --filter @uwe/database test` (Seeding aller Glyphen).

4. **Fertig.** Editor-Palette, Portal-Viewer und statischer Export zeigen das Symbol
   automatisch. Bestehende Welten erhalten den neuen globalen Palette-Eintrag beim
   nächsten Öffnen des Atlas (idempotentes `ensureBuiltinPaletteItems`).

5. **Optional – Katalog aktualisieren:** `atlas-pictograms.svg` wird aus der
   Registry erzeugt; nach größeren Erweiterungen neu rendern und committen.

---

## Neues Gouache-Asset hinzufügen

1. **Asset wählen** aus
   [../design/atlas-redesign/asset-catalog.md](../design/atlas-redesign/asset-catalog.md)
   oder als bewusst kleine Ergänzung definieren.

2. **Metadata ergänzen** in `packages/atlas/src/assets.ts`:

   ```ts
   { key: "g_lighthouse", name: "Leuchtturm", category: "structure" }
   ```

3. **Rezept ergänzen** in derselben Datei: Basisform(en), Schatten,
   Highlight, Pigmentrand. Gebäude sind meist Polygone/Rechtecke; Flora nutzt
   organische Blob-Formen; schwebende Assets bekommen langen Bodenschatten.

4. **Renderer-Vertrag einhalten:** `drawGouacheAsset(ctx, key, opts)` zeichnet
   um den Base-centre-Anker, respektiert `scale`, `rotation`, `lineWidth`,
   optional `blur`, und no-oped bei unbekanntem Key.

5. **Tests laufen lassen.** Bei neuen Persistenzfeldern zusätzlich die
   Datenbank- und Security-Gates (`pnpm test:security`).

6. **Static Engine aktualisieren**, wenn die Engine geändert wurde:
   `pnpm --filter @uwe/static-export build:atlas-engine`.

---

## RTX-Asset-Erzeugung in UWE

Der RTX-Workflow erstellt Assets direkt in UWE, aber bleibt ein Review-Flow:

1. UWE gibt RTX diesen Styleguide, den Asset-Katalog und die bestehende
   `GOUACHE_ASSETS`-Registry als Kontext.
2. Der DM beschreibt das gewünschte Asset, z. B. „verwunschener Leuchtturm auf
   Klippe, Gouache, Landmarke".
3. RTX liefert einen **Asset-Vorschlag**: Name, Kategorie, Tags, Palette,
   Formbeschreibung/JSON-Rezept oder PNG-Fallback, kurze Begründung gegen diesen
   Styleguide.
4. UWE rendert eine Preview und zeigt Validierungsfehler statt Auto-Apply.
5. Übernahme erzeugt ein Custom-Asset/PaletteItem. Builtin-Promotion bleibt ein
   normaler PR-Schritt mit Code-Review und Tests.

RTX darf:

- bestehende Kategorien, Farben, Schatten-/Highlight-Regeln und Backlog-Tags
  benutzen;
- Varianten für Marktstände, Baustile, Jahreszeiten und Zustände vorschlagen;
- Vorschläge für `Plot`-, `Landmark`-, `Gen`- oder `Terrain`-Einsatz liefern.

RTX darf nicht:

- fremde Canvas-of-Kings-Grafiken kopieren oder nachbauen;
- TypeScript/JavaScript erzeugen, das UWE ungeprüft zur Laufzeit ausführt;
- Assets ohne Preview, Review und Übernahme in den Kanon schreiben.

---

## Rendering-Details

Sowohl der Editor (`GlyphSvg`) als auch die Canvas-Renderer interpretieren
`pathData` identisch:

- **SVG-Preview (Palette):** `<path d={pathData} fill="none" stroke={color}
  stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />` in einer
  `0 0 24 24`-viewBox.
- **Canvas (`drawSvgPath`):** ein minimaler Parser für `M L H V Q C Z`
  (absolut, ein Segment pro Befehl). Deshalb gelten die Pfad-Regeln oben strikt.
- **Gouache (`drawGouacheAsset`):** Canvas-2D-Rezepte in
  `packages/atlas/src/assets.ts`; Objekte aktivieren sie über
  `AtlasObject.style.gouache`. `paletteItemId` bleibt ein gültiger Builtin-Glyph
  als FK-Träger.

Größe/Drehung pro platziertem Objekt kommen aus `AtlasObject.scale` / `rotation`;
bei Gouache kommen zusätzlich `style.lineWidth` und `style.blur` hinzu.

---

## Weiterführend

- [atlas-style-reference.md](atlas-style-reference.md) — Gesamt-Stil (Tinte/Pergament)
- [../design/atlas-redesign/asset-catalog.md](../design/atlas-redesign/asset-catalog.md) — Gouache-Asset-Backlog
- `packages/atlas/src/glyphs.ts` — kanonische Registry
- `packages/atlas/src/assets.ts` — kanonische Gouache-Registry
- `.cursor/skills/uwe-image-studio-assets/SKILL.md` — KI-Stempel (Quelle `ai`)
