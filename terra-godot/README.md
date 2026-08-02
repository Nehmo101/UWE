# terra-godot — Messspike, kein Editor

Dieser Baum beantwortet **eine** Frage mit Zahlen statt mit Einschätzung:

> Könnte ein Godot-Renderer Terras Kartenformat lesen und zeichnen — und was
> würde das kosten?

Er ist **additiv und wegwerfbar**. `terra/` bleibt unangetastet und läuft
weiter auf Three.js. Hier entsteht kein zweiter Editor.

Der Anlass steht in
[`docs/engineering/terra-godot-mcp-analyse.md`](../docs/engineering/terra-godot-mcp-analyse.md);
die Analyse rät von einer Umstellung ab und nennt diesen Spike als Weg, ihre
Schätzungen durch Messungen zu ersetzen.

## Warum die Determinismus-Prüfung zuerst kommt

Seit Format v3 speichert Terra **nicht die Höhen**, sondern nur das *Delta*
gegen ein Terrain, das aus dem Seed nachgerechnet wird
(`terra/src/editor/io.js:115`). Ein zweiter Renderer muss diesen Generator
deshalb bit-genau reproduzieren. Tut er es nicht, entsteht keine Fehlermeldung
und kein leeres Bild — es entsteht **eine andere Welt**, auf die dann das Delta
einer fremden Karte gerechnet wird. Das ist die schlimmste Sorte Fehler.

Deshalb ist das die erste Prüfung und nicht die letzte: Sie ist billig und sie
falsifiziert früh. Wäre sie fehlgeschlagen, hätte der Spike dort geendet — ein
gutes Ergebnis, nur eben ein negatives.

**Ergebnis: bestanden.** 2.111 Primitivwerte und 7 Terrainfelder (91.399
Höhenwerte) stimmen bitweise, inklusive negativer Koordinaten, Seeds an den
int32-Grenzen und aller vier Sonderzweige des Höhenprofils.

## Aufbau

| Datei | Zweck |
|---|---|
| `rng.gd` | Portierung von `terra/src/core/rng.js` — `hashi`, `vnoise`, `fractal`, mulberry32 |
| `hoehen.gd` | Portierung von `genBaseIn` (`terra/src/world/terrain.js:169`) + v3-Delta |
| `werkzeug/golden-dump.mjs` | Referenzwerte aus der **echten** `rng.js`, als IEEE-754-Bitmuster |
| `werkzeug/terrain-dump.mjs` | Referenz-Basisterrain aus dem **echten** `genBaseIn`, als Float32-Rohbytes |
| `test/parity.gd` | Primitiven-Parität |
| `test/terrain-parity.gd` | Terrain-Parität |

Beide Dump-Werkzeuge importieren Terras Quelldateien **direkt**. Es gibt keine
abgeschriebenen Tabellen und keine nachgebauten Referenzwerte — abgeschriebenes
läuft auseinander, ausgelesenes nicht.

## Warum Bitmuster statt Zahlen

Der erste Anlauf verglich die Dezimaldarstellungen aus dem JSON und meldete
199 Abweichungen — bei einer größten Abweichung von 1,1e-16, also exakt einem
ULP. Nicht der Zufallskern lag daneben, sondern Godots JSON-Leser gibt das
letzte Bit eines Double nicht zurück. Der Test maß den Parser.

Seitdem reisen alle Referenzwerte als IEEE-754-Bitmuster bzw. als Float32-
Rohbytes und werden über `PackedByteArray.decode_double()` respektive
`to_float32_array()` zurückgelesen. Erst damit prüft der Test das, was er
behauptet.

Eine zweite Feinheit derselben Art: Terras Zielfeld ist ein `Float32Array`
(`io.js:454`). Gerechnet wird in Double, **gespeichert in 32 Bit**. Wer in
GDScript mit `PackedFloat64Array` arbeitet, bekommt ein Feld, das dem Original
nur ähnelt.

## Ausführen

Godot 4.5 wird **nicht** im Repo abgelegt (Editor 66 MB, Export-Templates
1,3 GB). Herunterladen, dann:

```bash
GODOT=/pfad/zu/Godot_v4.5-stable_linux.x86_64

# Referenzwerte aus Terra erzeugen
node terra-godot/werkzeug/golden-dump.mjs  > terra-godot/test/golden.json
node terra-godot/werkzeug/terrain-dump.mjs > terra-godot/test/terrain.json

# Einmalig: Projekt importieren (registriert die class_name-Klassen)
"$GODOT" --headless --path terra-godot --import

# Prüfen
"$GODOT" --headless --path terra-godot --script res://test/parity.gd
"$GODOT" --headless --path terra-godot --script res://test/terrain-parity.gd
```

Beide Prüfungen enden mit Rückgabewert 0, wenn die Parität hält.

## Was hier bewusst NICHT entsteht

Kein Editor, keine Werkzeuge, keine Objekte, kein Ghibli-Look, keine
Einbettung in Studio oder Portal, keine Änderung an der CSP, keine Änderung an
Terra. Wer das dazunimmt, misst nicht mehr, sondern baut.
