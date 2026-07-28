# Atlas 3D

> Status: **MVP umgesetzt (Owner-Entscheidung 2026-07-11).** 2D bleibt der
> Default und die kanonische Druck-/PNG-Darstellung. Echtes WebGL-Terrain ist
> in Editor, Portal und Static Export lazy zuschaltbar.

## Zielbild

Atlas behält sein v3-Dokument als 2D-Geometrie plus sparsames Höhenfeld. Die
3D-Darstellung ist eine Projektion dieses Dokuments, kein zweites Datenmodell:

- X/Z stammen aus normalisierten Atlas-Koordinaten `[0,1]²`.
- Y wird mit `sampleElevation(tileLayer, x, y)` berechnet.
- Die vorhandene 2D-Karte wird ohne Objekt-Layer in ein Canvas gebacken und als
  `CanvasTexture` auf das Heightfield gelegt.
- Kartenobjekte werden separat als kameraorientierte Instanzen gezeichnet.
- Persistenz, Visibility und Publish-Status bleiben vollständig bei den Hosts.

Damit gibt es weder eine Prisma-Migration noch einen 3D-spezifischen
Save-Pfad. Ein Wechsel zurück nach 2D ist verlustfrei und sofort möglich.

## Package-Grenze

`@uwe/atlas-3d` ist das wiederverwendbare Feature-Package:

| Modul | Verantwortung |
|---|---|
| `heightfield.ts` | deterministische Mesh-Arrays und Live-Height-Updates |
| `camera-math.ts` | Orbit-State, Clamps, Projektion, Screen-Rays, Effective Zoom |
| `picking.ts` | Ray-Heightfield-Schnitt mit Ground-Plane-Fallback |
| `sprite-atlas.ts` | deterministische Slot-Allokation |
| `scene.ts` | Three.js-Renderer, Licht, Terrain und Wasser |
| `ground-texture.ts` | 4096px-Cap und 150ms-Rebake-Drosselung |
| `billboards.ts` | ein instanziertes Sprite-Atlas-Mesh inklusive Selection-Tint |
| `controls.ts` | Viewer-Pan sowie Orbit/Dolly; Editor reserviert Links-Drag für Tools |
| `overlays.ts` | gedrapte Pfad-/Polygon- und Vertex-Vorschau |
| `atlas3d.ts` | Host-Facade `createAtlas3D(canvas, hooks)` |

Die reinen Mathematikmodule importieren Three.js nicht und laufen im
Node-Test-Runner. `three` und `@types/three` sind exakt gepinnt; das minimierte
ESM-Bundle wird als `packages/static-export/static/atlas-3d.js` eingecheckt.

## Host-Integration

### Studio-Editor

`packages/static-export/static/atlas.html` lädt das Bundle erst beim Klick auf
„3D Ansicht“. Die zentralen Projektionsfunktionen `c2n`, `n2c` und `tileAt`
delegieren dann an Raycast bzw. Kamera-Projektion. Dadurch verwenden Stempel,
Pinsel, Auswahl, Verschieben, Pfade, Polygone, Pins und Messen weiterhin die
vorhandenen Werkzeugpfade.

Terrain-/Feature-Änderungen lösen einen gedrosselten Boden-Rebake aus. Der
Höhenpinsel aktualisiert zusätzlich die Mesh-Positionen und Normalen live; beim
Pointer-Up wird der finale Stand sofort synchronisiert. Objekt-Selektion wird
als Tint im Billboard-Mesh gezeigt, Pfad-/Polygon-Editing als gedraptes Overlay.

Review-Ghosts, Export-Rechteck und gebogene Labels wechseln bewusst zurück in
2D. Diese Flows besitzen noch kein vollständiges Screen-Space-Overlay.

### Portal

`AtlasViewerShell` schaltet zwischen dem bestehenden `AtlasViewer` und
`Atlas3DViewer` um. Beide erhalten exakt dieselben Props aus der serverseitig
gefilterten Page. Der 3D-Viewer verwendet den 2D-Viewer intern im
`groundOnly`-Modus für die Boden-/Feature-Textur und synchronisiert die bereits
gefilterten Objekte als Billboards. Es existiert kein zusätzlicher Fetch- oder
DB-Pfad.

### Static Export

`atlas-viewer-3d.js` erweitert den bestehenden Offline-Viewer erst nach dessen
Ready-Event. Das 3D-Bundle wird dynamisch und relativ geladen. Fehlt WebGL oder
scheitert `import()` unter einer strengen `file://`-Umgebung, bleibt die
vollständige 2D-Ansicht verfügbar. Alle benötigten Skripte werden vom Export
lokal kopiert; es gibt kein CDN.

## Sicherheit und CSP

- `@uwe/atlas-3d` kennt keine Persistenz, Sessions oder Visibility-Werte.
- Portal-Props kommen unverändert aus dem bestehenden player-safe Loader.
- Static Export enthält weiterhin ausschließlich publizierte Exportdaten.
- Die Production-CSP wurde nicht gelockert. Same-origin ESM und WebGL benötigen
  keine zusätzliche Direktive; es werden keine WASM-Loader verwendet.

## Artefakte und Rebuild

Der eigenständig öffnbare Prototyp liegt unter
und benötigt weder Server noch CDN.

Nach Änderungen an `@uwe/atlas` oder `@uwe/atlas-3d`:

```bash
pnpm --filter @uwe/static-export build:atlas-engine
node packages/static-export/scripts/build-atlas-3d-prototype.mjs
node apps/studio/scripts/copy-atlas-runtime.mjs
```

## Bewusste Grenzen

- PNG-Export und Minimap bleiben 2D und damit deterministisch/druckfähig.
- Keine Shadow-Map; das MVP nutzt reales Richtungslicht plus einfache
  Objekt-Sprites.
- Keine 3D-Kameralesezeichen oder persistierte Kameraposition.
- Kein Rotate-Gizmo und keine vollständig screen-anchored Resize-Handles.
- Ghost-Reviews und Curve-Labels werden in 2D bearbeitet.
