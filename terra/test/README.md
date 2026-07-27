# terra — Tests

Automatisierte Prüfung der fünf Zusagen, die terra schriftlich gibt:
Determinismus, Formatkompatibilität, Generator-Invarianten, Shader-Anker und
Registry-Konsistenz (Entwurf: `docs/engineering/terra-runde-i-plan.md`, I5).

## Aufruf

Aus dem **Repo-Wurzelverzeichnis**:

```
node --test terra/test
```

Gleichwertig, aber mit einem Prozess je Datei (schneller bei parallelen Kernen):

```
node --test "terra/test/*.test.mjs"
```

Eine einzelne Ebene:

```
node --test terra/test/03-invarianten.test.mjs
```

Keine Abhängigkeiten, kein Build-Schritt, kein pnpm-Workspace — nur der in Node
eingebaute Testläufer. Gebraucht wird Node ≥ 20.6 (für `module.register`);
entwickelt und geprüft mit Node 24.18.

> **Warum es die Datei `index.mjs` und die `package.json` gibt:** Node 22+
> behandelt Argumente von `--test` als Glob-Muster. Ein Verzeichnisname passt
> dabei auf sich selbst und wird als *Datei* geladen statt durchsucht — der
> Aufruf `node --test terra/test` scheiterte sonst mit `MODULE_NOT_FOUND`. Die
> `package.json` dieses Ordners macht das Verzeichnis auflösbar (`main` zeigt
> auf `index.mjs`), und `index.mjs` zieht die einzelnen Testdateien herein.
> **Eine neue Testdatei muss dort eingetragen werden**, sonst läuft sie nur
> über die Glob-Form.

## Aufbau

```
terra/test/
  01-determinismus.test.mjs    Ebene 1 — gleiche Seed, gleiches Ergebnis
  02-format.test.mjs           Ebene 2 — v1..v4 laden, Zyklus, Fehlerfälle
  03-invarianten.test.mjs      Ebene 3 — Platzierungsvertrag, Deckel, NaN
  04-shader-anker.test.mjs     Ebene 4 — Patch-Anker gegen Three 0.185.1
  05-registry.test.mjs         Ebene 5 — Biome, Pools, Paletten, Familien
  index.mjs                    Sammeleinstieg (siehe oben)
  package.json                 macht das Verzeichnis auflösbar
  fixtures/                    Beispieldateien
    v1-einzeldatei.json          Fassung 1 (terra.html, ohne `version`)
    v2-hoehen-vollarray.json     Fassung 2 (`hoehen`, `seedZaehler`)
    v3-hoehendelta.json          Fassung 3 (`hoehenDelta`, Biom, Marker)
    v4-kartengroesse.json        Fassung 4 (`kartenGroesse`, Stempel, Palette)
    three-0.185.1-anker.json     Ankerbestand der gepinnten Three-Fassung
  hilfen/
    laden.mjs                  registriert den Loader-Haken, lädt terra-Module
    haken.mjs                  der Loader-Haken (auflösen + Testfenster)
    three-stub.mjs             Three-Ersatz
    addons-stub.mjs            Platzhalter für three/addons/*
    dom-stub.mjs               minimales document/localStorage
    ersatz/                    schlanke Ersatzmodule für Browser-/UI-Module
    karte.mjs                  Testwelt, Beispielkarte, Ergebnis-Hashes
    hash.mjs                   bitgenaue SHA-256-Hashes über Zahlenströme
    three-quelle.mjs           Zugang zur echten Three-Datei (optional)
    gesamthash.mjs             Hilfsprogramm für den Zwei-Prozess-Vergleich
```

Jede Testdatei beginnt mit einem Kopfkommentar, der ihre Ebene erklärt.

## Wie terra ohne Browser läuft

terra lädt Three über eine Import-Map vom CDN und zeichnet in ein Canvas. In
Node gibt es beides nicht. Drei Bausteine schließen die Lücke:

**1. Der Loader-Haken (`hilfen/haken.mjs`).** Er wird in `hilfen/laden.mjs`
über `module.register()` angemeldet und tut zweierlei:

* Er löst `three` auf den Ersatz auf und `three/addons/*` auf einen
  Platzhalter.
* Er tauscht einzelne terra-Module gegen schlanke Ersatzmodule aus
  (`hilfen/ersatz/`). Getauscht wird **ausschließlich**, was Browser-Technik
  braucht (`render/textures.js` malt in ein Canvas, `render/pipeline.js` ist
  der WebGL-Renderer, `world/water.js` und `world/atmosphere.js` hängen daran)
  oder reine Bedienoberfläche ist (`ui/panels.js`, `editor/tools.js`,
  `editor/selection.js`, `editor/camera.js`, `editor/history.js`).
  **Nie** ein Modul, dessen Verhalten geprüft wird: `core/*`, `generators/*`,
  `world/terrain.js`, `render/materials.js` und `editor/io.js` laufen echt.

Weil `import`-Anweisungen vor der ersten Anweisung ausgeführt werden, dürfen
Testdateien terra-Module **nicht statisch** importieren. Sie nehmen dafür
`ladeTerra('core/store.js')` aus `hilfen/laden.mjs` (dynamischer Import,
nach der Registrierung).

**2. Das Testfenster.** Manche Zusagen stecken in modul-internen Funktionen:
`editor/io.js` prüft und übernimmt Karten, exportiert davon aber nur `initIO`.
Statt den Produktivcode um Testexporte zu erweitern, hängt der `load`-Haken
beim Laden eine zusätzliche Exportzeile an (`validiereKarte`,
`uebernehmeKarte`, `kartenDaten`, …). Die Datei auf der Platte bleibt
unangetastet; fehlt eine der Funktionen, schlägt das Laden laut fehl.

**3. Der Three-Ersatz (`hilfen/three-stub.mjs`).** Eine eigenständige
Nachbildung der Teilmenge, die terra außerhalb des Browsers benutzt: Vektor-,
Matrix- und Farbmathematik, `BufferGeometry` samt Primitiven, `CatmullRomCurve3`,
Objekthierarchie, `InstancedMesh`. Die Primitiven erzeugen **echte** Vertexdaten
nach denselben Formeln wie Three — nur so haben Aussagen wie „kein NaN in
Position/Normale/UV" oder „Dreieckszahl je Pool" Gewicht. WebGL, Shaderbausteine
und Texturen sind leere Hüllen; die Shader-Anker werden deshalb **nicht** gegen
den Ersatz geprüft (siehe unten).

Der Ersatz wurde gegen die echte Fassung 0.185.1 gegengerechnet:
`PlaneGeometry`, `BoxGeometry`, `SphereGeometry`, `TorusGeometry`,
`CylinderGeometry`, `ConeGeometry`, `CircleGeometry`, `IcosahedronGeometry`,
`Matrix4.compose`, `Color` (samt sRGB→Linear), `CatmullRomCurve3` und
`computeVertexNormals` liefern identische Werte. Über alle 272 Pools bleiben
fünf Geometrien in einzelnen Werten um ~1·10⁻¹⁶ verschieden (Rundung nahe null
in zusammengesetzten Rotationen); der Hash über die erzeugte Beispielkarte ist
mit Ersatz und mit echtem Three **identisch**.

## Optional: gegen die echte Three-Datei prüfen

Liegt eine echte Three-Datei bereit, benutzen sowohl der Loader-Haken als auch
die Ankerprüfung sie statt des Ersatzes bzw. statt der mitgelieferten
Ankerliste:

```
mkdir terra/test/.three
curl -o terra/test/.three/three.module.js \
  https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.module.js
curl -o terra/test/.three/three.core.js \
  https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.core.js
```

Alternativ zeigt die Umgebungsvariable `TERRA_THREE` auf eine
`three.module.js`. Der Ordner `.three/` gehört **nicht** ins Projekt — terra
hat keinen Build-Schritt und soll keine 2 MB Fremdcode im Baum tragen. Ohne
die Datei laufen alle Tests trotzdem; die Ankerprüfung sagt dann im Protokoll,
dass sie gegen `fixtures/three-0.185.1-anker.json` geprüft hat.

## Was die fünf Ebenen prüfen

1. **Determinismus.** Ein Hash über *alle* `emit()`-Argumente (12 Zahlen je
   Instanz), die Kontaktschatten, die Rauchpunkte und sämtliche Attribute der
   elementeigenen Meshes. Je Generator ein Fall, dazu der Gesamtlauf über die
   Beispielkarte, die Reihenfolgeunabhängigkeit zweier überlappender Elemente
   und ein Vergleich über **zwei getrennte Prozesse** (nur so lassen sich die
   272 Pool-Geometrien prüfen, die beim Modulstart entstehen).
2. **Formatkompatibilität.** Die vier Beispieldateien laden, ergeben die
   erwartete Elementzahl und überstehen einen Speicher-Lade-Zyklus unverändert.
   Dazu 16 Fehlerfälle, die atomar scheitern müssen, und die drei bewusst
   *toleranten* Fälle (unbekanntes Biom, unbekanntes Wetter, unbrauchbare
   Kamerazahl).
3. **Generator-Invarianten.** Der Platzierungsvertrag aus
   `generators/objects.js` (nichts im Wasser, nichts über 40°, nichts im
   Korridor) für die streuenden Generatoren, mit Gegenprobe; der Instanzdeckel;
   keine NaN in Geometrien, Instanzen, Schatten und Meshes; jeder genannte
   Poolname existiert; `InstancedMesh.count` gleich der Belegung.
4. **Shader-Anker.** Jeder `#include <…>`, den terra ersetzt, muss es in der
   gepinnten Three-Fassung geben **und** im Shader des Materials vorkommen, an
   dem der Patch hängt. Die Anker werden aus dem Quelltext der fünf patchenden
   Dateien gelesen, nicht von Hand gepflegt — ein neuer Patch ist automatisch
   mitgeprüft.
5. **Registry-Konsistenz.** Biome nennen existierende Pools, Partikeltypen und
   Höhenprofil-Schlüssel; Palettenrampen sind vollständig; die Biomliste in
   `index.html` deckt sich mit der Registry; keine doppelten Poolnamen; jede
   Materialfamilie existiert; kein Pool bleibt unerreichbar.

## Bekannte Ausnahmen im Protokoll

Zwei Tests sind als `todo` eingetragen: sie beschreiben eine Zusage, die der
Code heute **nicht** hält. Sie erscheinen im Protokoll mit `⚠` und lassen den
Lauf nicht scheitern.

* *rebuildAll ist beim ERSTEN Lauf nicht stabil* — `core/dirty.js` stempelt die
  Korridore, bevor `refreshTerrainFull()` das Höhenfeld schreibt; die Kaiflucht
  einer Werft liest aber genau dieses Feld.
* *jeder Pool ist erreichbar* — `pechnase` wird definiert, aber nirgends
  benutzt.

Ein Test ist `skip`: der Abgleich der Parameterschemata aus `editor/tools.js`
gegen die Generatoren. Die Datei wurde in dieser Runde parallel bearbeitet.

Beides ist im Rundenbericht I5 ausführlich beschrieben.

## Eine neue Prüfung schreiben

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { testWelt, hashElement } from './hilfen/karte.mjs';

test('… beschreibt die Zusage in einem Satz …', async () => {
  const welt = await testWelt({ seed: 4711, biom: 'wiese', groesse: 256 });
  const el = welt.element('flaeche', 'wald',
    [{ x: -20, z: -20 }, { x: 20, z: -20 }, { x: 0, z: 20 }]);
  welt.erzeuge(el);
  assert.ok(el.total > 0);
});
```

`testWelt()` baut eine betriebsbereite Welt auf (Kartengröße, Basisterrain,
Szene). `welt.element(...)` legt ein Element mit **vollständigen** Parametern an
(die Vorgabewerte stehen als Momentaufnahme in `hilfen/karte.mjs`, damit kein
Testergebnis am parallel wachsenden Schema in `editor/tools.js` hängt).
`welt.erzeuge(el)` läuft über `core/dirty.js`, also denselben Weg wie der
Editor; `welt.alleNeu()` entspricht einem vollständigen Neuaufbau.
