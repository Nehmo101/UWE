# Atlas — Stil-Referenz (handgezeichnete Tinten-Kartografie)

Visuelle Zielvorgabe für den Atlas-Renderer und die KI-Stil-Presets. Diese Datei
beschreibt den **Stil** in Worten; sie reproduziert kein urheberrechtlich geschütztes
Werk.

## Referenzbild

Das vom Owner als Inspiration genannte Bild ist eine kommerzielle, urheberrechtlich
geschützte Mittelerde-/Herr-der-Ringe-Karte. Sie wird hier **bewusst nicht** mitgeliefert
oder nachgebaut, um keine Schutzrechte zu verletzen.

Wenn du ein eigenes, rechtlich unbedenkliches Referenzbild ablegen möchtest, lege es unter
folgendem Pfad ab — dann greift der Link automatisch:

`docs/prompts/atlas-style-reference.png`

<!-- Sobald die Datei existiert, einkommentieren:
![Atlas Stil-Referenz](atlas-style-reference.png)
-->

## Stil-Brief (für Renderer + KI-Prompt-Preset)

- **Medium/Look:** handgezeichnete Schwarz-Tinte auf Pergament/Cremeweiß, feine Federstrich-Linien.
- **Küsten:** durchgezogene Tinten-Konturen, leicht unregelmäßig; optional dünne Parallel-Linien als Wasser-Andeutung.
- **Gebirge:** wiederholte, von Hand wirkende Berg-Glyphen entlang von Graten; Größe skaliert die „Höhe"; dezente Schummerung/Höhenschatten.
- **Hügel:** kleinere, flachere Glyphen als Gebirge.
- **Wälder:** Cluster gestreuter Baum-Glyphen (Nadel/Laub) mit Dichte-/Größen-Jitter.
- **Flüsse:** dünne, von der Quelle zur Mündung sich verjüngende Linien, „bergab" verlaufend.
- **Straßen:** gestrichelte Pfade zwischen Siedlungen.
- **Siedlungen/Objekte:** kompakte Symbole (Dorf, Stadt, Burg, Turm, Ruine, Brücke). Konkrete Regeln & Katalog: [atlas-pictogram-styleguide.md](atlas-pictogram-styleguide.md).
- **Labels:** Serifen-Versalien; zwei Farben — Schwarz für Details/Orte, Rot für Reiche/Großregionen; gerade Labels in v1, gebogene/pfadgeführte Labels als spätere Politur.
- **Deko:** Kompassrose, Maßstabsleiste, Pergament-Textur.

## Mapping auf Atlas

- Style-Preset-Schlüssel (Plan): `stylePreset: "tolkien-ink"` auf `AtlasMap`.
- KI-Stempel (Phase 5): fester Stil-Prompt-Preset erzwingt diesen Look; Nutzer erweitert nur per Stichwort (z. B. „Kirche"); transparentes Linien-Art-PNG.
- Renderer (Phase 1-3): Canvas2D für dichte Layer (Pergament, Biome, Relief, gestreute Glyphen) + SVG-Overlay für interaktive Handles.
- **Piktogramme (eingebaute Glyphen/Stempel):** kanonische Registry in
  `packages/atlas/src/glyphs.ts` — eine Quelle für Editor, Portal, Export und
  DB-Seed. Regeln, Katalog und „neues Piktogramm hinzufügen": siehe
  [atlas-pictogram-styleguide.md](atlas-pictogram-styleguide.md).

Details und Phasen: siehe Cursor-Plan „Atlas World Builder" und [atlas-orchestrator.md](atlas-orchestrator.md).
