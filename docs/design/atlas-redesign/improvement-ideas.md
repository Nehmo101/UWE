# Atlas — Ideen zur starken Verbesserung

Strategischer Ideen-Vorrat jenseits der einzelnen Assets. Grün-Notiz: vieles
davon dockt an **bereits vorhandene, aber ungenutzte Engine-Fähigkeiten** an
(siehe [../../engineering/atlas-cok-gap-analysis.md](../../engineering/atlas-cok-gap-analysis.md)) —
Hebel liegt oft im Verdrahten, nicht im Neubau.

**Aufwand:** S = klein · M = mittel · L = groß. **UWE-USP** = Feature, das
CoK/Wonderdraft nicht haben, weil es an UWEs Brain/DnD/Kalender hängt.

---

## ⭐ Top-Hebel (wenn ich 8 Dinge zuerst bauen würde)

1. **Gouache-Assets + Auto-Fill-Flächen** (der große Optik-Sprung) — M/L.
2. **Ebenen-Panel** (Sichtbarkeit/Reihenfolge/Sperren pro Layer) — M.
3. **Snapping & Ausrichten** (Raster, Kanten, Winkel) — S/M.
4. **Jahreszeiten-/Tageszeit-Schalter** (statische Tönung, Asset-Varianten) — M.
5. **Reise- & Distanz-Werkzeug mit Maßstab** (Tage/Ligen, Route folgen) — S. **UWE-USP**
6. **Fraktions-/Territorien-Overlay** aus dem DnD-Brain — M. **UWE-USP**
7. **KI „Region beschreiben & benennen"** (Panels für vorhandene Actions) — M. **UWE-USP**
8. **Spieler-Pins & Erkundung** (Portal: eigene Marker, aufgedeckte Bereiche) — M.

---

## A · Stimmung & Rendering (Atmosphäre)

- **Jahreszeiten/Tageszeit** — globaler Tönungs-/Licht-Schalter + saisonale Asset-Varianten (koppelbar an den In-Game-Kalender). M. **UWE-USP**
- **Statische „Atmosphäre light"** — Vignette, Dunst, Morgen/Abend-Tönung als Preset-Variante (Owner-Frage aus Gap-Analyse). S/M.
- **Relief-Schummerung überall** — `buildReliefShading` existiert, rendert aber nur im Portal; im Editor/Static angleichen. S.
- **Höhen-/Konturlinien** — optionale Isohypsen aus einer Höhen-Metadata pro Biom. M.
- **Gewässer-Tiefe & Küstensaum** — heller Flachwasser-Ring an Küsten, dunkleres Tiefwasser. S/M.
- **Papier-Alterung** — Kartenränder, Flecken, Faltkanten als optionale Overlay-Ebene. S.
- **Biom-Auto-Kolorit** — Grundfarbe je Biom global stärken/schwächen (der Untergrund-Regler; s. Redesign). S.

## B · Editor-Produktivität (UX)

- **Ebenen-Panel** — Layer ein/aus, Reihenfolge, Sperren, Deckkraft (heute nur `LAYER_Z` im Code). M.
- **Snapping & Ausrichten** — an Raster, an andere Objekte, Winkel-Rasten beim Drehen. S/M.
- **Objekt-Verteilen/Ausrichten** — „gleichmäßig verteilen", „an Linie ausrichten". S.
- **Pinsel-Dynamik** — Streu-Pinsel (Objekte malen statt einzeln setzen), Größe/Dichte/Jitter. M.
- **Symmetrie-/Spiegel-Modus** — für Burgen, Tempel, Gärten. M.
- **Bibliothek/Favoriten & Suche** in der Asset-Ablage; zuletzt benutzt. S.
- **Vorlagen (Templates)** — Karten-Startpunkte (Küstenstadt, Gebirgspass …). S.
- **Karten-übergreifendes Copy/Paste** — Assets/Gruppen zwischen Nodes kopieren. M.
- **Mini-Map & Lesezeichen** — schnelle Navigation in großen Karten. S/M.
- **Live-Kompass/Maßstab im Editor** — bereits im Export, nur auf die Canvas holen. S.
- **Mess-Werkzeug mit Einheit** — `scaleUnit` (Ligen/Tage) aus dem Preset nutzen. S.

## C · Prozedural & KI (immer Proposal → Review → Übernehmen)

- **„Region beschreiben"** — `atlas_describe_region` hat schon ein Panel; ausbauen. S/M. **UWE-USP**
- **„Regionen benennen"** — `atlas_name_regions` existiert als Action/Proposal **ohne UI**; Panel bauen. M. **UWE-USP**
- **Fläche per KI füllen** — „dichter Nadelwald mit Lichtung" füllt nur den Plot. M.
- **Terrain aus Heightmap/Skizze** — grobe Höhenskizze → Berge/Flüsse/Küsten-Vorschlag. L.
- **Flüsse folgen dem Gefälle** — Fluss automatisch bergab zur Küste routen. M.
- **Ein-Klick-Weltentwurf** als Ghost-Overlay (kein Auto-Apply), lockbare Features (`generateDraft`/`rerollDraft` existieren). M.
- **Namens-/Lore-Generatoren** je Kultur (Ortsnamen, Wirtshausnamen). S/M. **UWE-USP**

## D · Weltensimulation & Daten-Verknüpfung (der eigentliche UWE-Vorsprung)

- **Fraktions-/Territorien-Overlay** — Grenzen & Einflusszonen aus dem DnD-Brain, aktualisiert mit dem Fraktions-Tick. M. **UWE-USP**
- **Handelsrouten & Reichweiten** — Routen zwischen Städten, Reisezeit-Isochronen. M. **UWE-USP**
- **Kalender-gekoppelte Karte** — Jahreszeit/Wetter/Belagerungen nach In-Game-Datum (Kalender-Package existiert). M. **UWE-USP**
- **Encounter-/Gefahren-Zonen** — Regionen mit Zufallstabellen/Monster-Budget verknüpfen. M. **UWE-USP**
- **Quest-Marker & Story-Pins** — Pins verlinken auf Quests/Seiten (Wiki-Link existiert, ausbauen). S/M. **UWE-USP**
- **Ressourcen-/Bevölkerungs-Layer** — thematische Einfärbung (Reichtum, Bevölkerung). M.
- **Zeitleiste/Karten-Historie** — „Karte im Jahr X" (Grenzen/Städte über Zeit). L. **UWE-USP**

## E · Spieler- & Portal-Erlebnis

- **Erkundung / Fog of Exploration** — Spieler sehen nur Besuchtes; DM deckt auf (bewusst deferred — Owner-Entscheid). M.
- **Spieler-Pins & Annotationen** — eigene Marker/Notizen, für DM sichtbar. M.
- **„Du bist hier" & Reise mitverfolgen** — aktueller Party-Standort, zurückgelegte Route. S/M. **UWE-USP**
- **Interaktive Pins** — Klick öffnet Wiki/Handout/Bild (teilweise da). S.
- **Legende & Ebenen-Umschalter** im Portal (Routen/Politik/Gelände an/aus). S/M.
- **Vorlese-/Handout-Modus** — Kartenausschnitt als Spieler-Handout (Pipeline ist Stub → fertig bauen). M.

## F · Export, Druck & Interop

- **Ausschnitt-Export mit Grid** — Square/Hex, Auflösung, A4 (Engine `buildGridLines` fertig). M.
- **Batch-/Kachel-Druck** — große Karte über mehrere A4-Seiten. M.
- **VTT-Export** — PNG + Grid für Foundry/Roll20 (ehrlich: nur Bild+Grid, keine Walls). M.
- **Formate** — PNG/JPG/WebP, optional SVG für Vektor-Print. S/M.
- **Teilen-Link / Einbetten** — read-only Kartenlink (Static-Export existiert). S.
- **GeoJSON-Im/Export** — Interop mit anderen Tools (Geometrie ist GeoJSON-nah). M.

## G · Zusammenarbeit & Versionierung

- **Karten-Snapshots / Historie** — Versionen, Vergleich, Zurückrollen. M.
- **Kommentare/Marker fürs Team** — Review direkt auf der Karte. M.
- **Mehrbenutzer-Bearbeitung** — später; erst Snapshots/Locking. L.

## H · Performance & Technik

- **Tile-/Render-Cache** — Assets als Sprites vorbacken (Offscreen-Canvas), dann stempeln — deutlich schneller bei vielen Objekten. M.
- **Level-of-Detail** — bei geringem Zoom vereinfacht rendern. M.
- **Ein Render-Core** — die drei Pfade (Editor/Portal/Static) auf gemeinsame Engine ziehen (Gap-Analyse #10). L.
- **PRNG-Konsolidierung** — lokale `mulberry32`-Kopien auf `prng.ts` vereinen. S.
- **Worker-Generierung** — Settlement/Plot in einem Web-Worker, UI bleibt flüssig. M.

## I · Barrierefreiheit & Politur

- **Farbenblind-/Kontrast-Paletten** als Preset-Varianten. S.
- **Tastatur-Vollbedienung & Fokus-Sichtbarkeit** im Editor. S/M.
- **Lokalisierung** der Editor-UI (DE/EN). M.
- **Onboarding/Tour** — 60-Sekunden-Einführung für neue DMs. S.

---

## Leitplanken (gelten für alle Ideen)

- Business-Logik in `packages/*`, nicht in Route Handlers; `@uwe/database` bleibt Data-Access.
- KI/Generatives **immer** Proposal → Review → Übernehmen, nie Auto-Apply; `personal_brain` bleibt hart lokal.
- Dreistufige Portal-Sichtbarkeit zuerst per Leak-Test absichern, bevor neue Felder exportiert werden.
- Self-hosted-realistisch bleiben: Canvas-2D-Stack, kein WebGL-Rewrite ohne zwingenden Grund; keine animierten Wetter-Partikel (Stil-/Perf-Bruch).
