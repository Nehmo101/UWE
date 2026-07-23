# Atlas 3D — Feature-Roadmap Weltgestaltung & Kartenbau

Kuratierte Ideensammlung für den Ausbau des Atlas-3D-Editors — **rein Weltgestaltung und Kartenbau**, keine UWE-Integrationsthemen. Basis: Deep-Research (Juli 2026) in 2D-Fantasy-Kartentools (Inkarnate, Wonderdraft, Azgaar's Fantasy Map Generator, Watabou Procgen Arcana, Dungeondraft/Dungeon Alchemist, Campaign Cartographer 3+, World Anvil, Nortantis, Fractal Terrains/Wilbur, Songs of the Eons) und 3D-Terrain-/Planeten-/Sandbox-Tools (Gaea, World Machine, World Creator, Houdini, Terragen, SpaceEngine, Astroneer/Enshrouded/No Man's Sky, Townscaper/Tiny Glade, Flowscape, Canvas of Kings, WorldPainter, Dwarf-Fortress-Worldgen, Unreal Landscape Edit Layers, Okami-/Cel-Shading-Techniken).

Aufwand: **[K]** klein · **[M]** mittel · **[G]** groß. **★** = Quick-Win, setzt direkt auf vorhandener Substanz auf (SDF-Carve-Ops, Splat-Biome, A\*-Pfade, Siedlungs-Generator, Tusche-Shader, Vererbungssystem).

## A · Terrain & Geologie

- ★ **[M] Flatten-/Plateau-Pinsel** — auf dem Globus relativ zur lokalen „Unten"-Richtung nivellieren (Astroneer-Muster; `BrushMode "flatten"` existiert bereits im Planeten-Feld).
- ★ **[K] Terrain-Stempel** — Krater-, Dünen-, Gebirgs-Profile als wiederverwendbare Pinselformen (WorldPainter/Darewise-Brushes).
- **[K] Graustufen-PNG als Höhen-Stempel** — beliebige Bilder als importierbare Pinselbibliothek (WorldPainter Custom Brushes).
- **[M] Landmassen-Vorlagen als Start-Seeds** — Kontinent / Archipel / Hochinsel als Ausgangspunkt vor dem Formen (Wonderdraft/Azgaar-Templates).
- **[G] Hydraulische + thermische Erosion** — Pass über das Höhenfeld mit „Feature-Size"-Regler; Flow-/Ablagerungs-Masken wiederverwendbar für Schnee, Schutt, Vegetation (Gaea/Wilbur).
- **[M] Gemalte/gerichtete Erosion** — Erosionsstriche direkt aufs Terrain malen statt nur simulieren (Gaea Directed Erosion).

## B · Klima, Biome & Gewässer

- ★ **[M] Biome-Ableitung** — Temperatur (Breitengrad × Höhe) × Niederschlag → Biom-Vorschlag nach Whittaker-Matrix, auf dem vorhandenen Splat, jederzeit handübermalbar (Azgaar, Dwarf Fortress, WorldEngine).
- **[M] Fluss-Simulation** — Testflüsse ab Gebirgskanten fließen bergab und kerben Täler; ergänzt den A\*-Fluss-Assistenten (Dwarf Fortress Flow-Test).
- **[M] Seen** — „Wasser auf Höhe X"-Objekt zusätzlich zum globalen Wasserstand (Terragen Lake-Objekt vs. Wasser-Shader).
- **[K] Klima-/Temperatur-Overlay** — als schaltbare Ansicht über dem Terrain.

## C · Generatoren (gelenkt, nicht zufällig)

- ★ **[M] Constraint-then-generate für Siedlungen** — Pflicht-Features (Mauern, Fluss, Zitadelle) wählen, dann generieren; Viertel-Typen (Markt, Tempel, Slums) mit eigenen Layout-Parametern (Watabou MFCG, Dungeon Alchemist).
- **[M] „Bereich ausmalen"** — Region umreißen → automatisch mit Wald/Markt/Feldern füllen (Dungeon Alchemist, Canvas of Kings).
- **[M] Auto-Linienfeatures** — Mauerzug bekommt automatisch Türme + Tore; Weg wird gesäumte Straße (Canvas of Kings).
- **[M] Warp-Werkzeug** — Generiertes nachträglich verformen statt komplett neu würfeln (Watabou).
- **[M] Namens-Generator** — je Kultur/Region für Orte, Ebenen, Labels (Azgaar Namesbase).
- **[G] WFC-Siedlungen** — Wave Function Collapse auf irregulärem Raster als Ausbau des Siedlungs-Generators (Townscaper, Tiny Glade).
- **[K] Seed-Mutation gezielt** — nur einen Teilbereich neu würfeln, Rest bleibt deterministisch (World Creator/Gaea Seed-Mutate).

## D · Asset-Sprache

(baut auf den Asset-Gruppen Natur/Siedlung/Weltenbau/Himmel auf)

- ★ **[M] Streu-Pinsel** — Assets mit Auto-Variation in Größe/Drehung/Abstand malen statt einzeln klicken; Varianten-Attribut je Instanz (Wonderdraft Symbol-Spray, Flowscape, Houdini Scatter).
- **[K] Schwerkraft-Platzierung** — Objekte setzen sich natürlich aufs Gelände (Flowscape).
- **[M] Neue Gruppen-Assets** — Natur: Fels, Busch, Pilzhain · Siedlung: Brücke, Mühle, Hafen · Weltenbau: Portal, Obelisk, Schrein · Himmel: Mond, Wolkeninsel.
- **[K] Hangneigung-Ausrichtung** — Assets neigen sich mit dem Gelände (Flowscape Align-to-Landscape).

## E · Politische & erzählerische Ebenen

- **[M] Territorien/Reiche** — Regionen-Layer mit Farbflächen und kostenbasiertem Wachstum über das Terrain (Azgaar States/Provinces).
- **[M] POI-Marker mit Notizen** — gruppier- und schaltbar (Azgaar Markers, World Anvil Pins).
- **[K] Zonen-Overlay** — Gefahr/Verboten/Magie/Korruption als Flavour-Feld über den physischen Biomen (Azgaar Zones, Dwarf Fortress Savagery).
- **[G] Leichte generierte Historie** — Gründungen, Kriege, Wanderungen als Lore-Haken (Dwarf Fortress, Songs of the Eons).

## F · Darstellung & Karten-Ausgabe

- ★ **[K] Hex-/Quadrat-Gitter-Overlay** — direkt im Viewport, nicht nur im PNG-Export (Inkarnate, CC3+).
- **[M] Thematische Ansichten** — Relief · Biome · Politisch · Klima · Bevölkerung als schaltbare Layer über demselben Globus (Azgaar Layer-Presets, World Anvil Overlays).
- **[M] Gebogene Beschriftungen** — Labels folgen Küsten und Flüssen (Wonderdraft).
- **[M] Stil-Themes** — dieselbe Welt in Pergament-Varianten (Tusche/Aquarell/Sepia) als Shader-Preset (Inkarnate-Prinzip; passt zum bestehenden `stylePreset`-Vererbungsfeld).
- **[K] Höhenlinien-/Hachuren-Modus** — für den Top-Down-Blick (Watabou Village, CC3+ Contours).
- **[K] Papierkorn + Tuschefleck-Schatten** — konsequent über die ganze Szene als eine Leinwand (Okami-Playbook).

## G · Stimmung

- ★ **[K] Wetter-Overlay** — Wolkenschicht, Regen-/Schnee-Animation, Nebelbänke; Tageszeit + Nebel existieren bereits im Umgebungs-System (Canvas of Kings, Dungeon Alchemist).
- **[M] Jahreszeiten-Preset je Ebene** — vererbt und überschreibbar, wie Tageszeit heute (passt exakt ins Inheritance-System).

## H · Workflow

- ★ **[M] Undo über prozedurale Regenerationen** — Generator-Läufe als Commands im bestehenden Command-Stack (World Machine „Mt Rainier").
- **[G] Nicht-destruktiver Ebenen-Stack** — Höhe/Carve/Paint/Scatter als sortier-, ausblend- und solo-bare Layer (Unreal Landscape Edit Layers; Fernziel/Architektur-Thema).
- **[K] Mess-Werkzeug** — Distanz in Wegstunden (Engine-Substanz laut Vision-Konzept vorhanden).
- **[M] Sub-Ebene neu ableiten** — gewählten Bereich bei höherem Detail regenerieren (Azgaar Submaps; passt exakt zum Drill-Down).

## Empfohlene Startreihenfolge

Die **★-Quick-Wins** zuerst, da sie direkt auf vorhandener Substanz aufsetzen: Flatten-Pinsel + Terrain-Stempel (A), Biome-Ableitung (B), Constraint-Siedlungen (C), Streu-Pinsel (D), Gitter-Overlay (F), Wetter-Overlay (G), prozedurales Undo (H).

## Quellen (Auswahl)

- Azgaar's Fantasy Map Generator — <https://azgaar.github.io/Fantasy-Map-Generator/> · Wiki: <https://github.com/Azgaar/Fantasy-Map-Generator/wiki>
- Watabou Procgen Arcana — <https://watabou.github.io/> · MFCG: <https://watabou.itch.io/medieval-fantasy-city-generator>
- Inkarnate — <https://inkarnate.com/updates> · Wonderdraft — <https://www.wonderdraft.net/>
- Dungeon Alchemist — <https://www.dungeonalchemist.com/> · Campaign Cartographer 3+ — <https://www.profantasy.com/products/campaign-cartographer-3>
- World Anvil Maps — <https://www.worldanvil.com/features/maps> · Nortantis — <https://jeheydorn.github.io/nortantis/>
- Gaea Erosion — <https://docs.quadspinner.com/Guide/Using-Gaea/Erosion.html> · World Machine — <https://www.world-machine.com/features.php> · World Creator — <https://www.world-creator.com/en/features.phtml>
- Houdini Terrain — <https://www.sidefx.com/products/houdini/world-building/terrain/> · Terragen — <http://planetside.co.uk/terragen-feature-tour/>
- WorldPainter Custom Brushes — <https://www.worldpainter.net/trac/wiki/CustomBrushes> · Unreal Landscape Edit Layers — <https://dev.epicgames.com/documentation/unreal-engine/landscape-edit-layers-in-unreal-engine>
- Astroneer Terrain Tool — <https://astroneer.fandom.com/wiki/Terrain_Tool> · Townscaper — <https://en.wikipedia.org/wiki/Townscaper> · Flowscape — <https://store.steampowered.com/app/1043390/FlowScape/>
- Dwarf Fortress World Generation — <https://dwarffortresswiki.org/index.php/World_generation> · Songs of the Eons — <https://demiansky.itch.io/songs-of-the-eons>
- SpaceEngine Procedural Generation — <https://spaceengine.fandom.com/wiki/Procedural_Generation> · Íñigo Quílez SDF — <https://iquilezles.org/articles/raymarchingdf/>
