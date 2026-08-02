# Godot-Spike: die Messung

> Ergebnis des in [`terra-godot-mcp-analyse.md`](terra-godot-mcp-analyse.md) § 9
> vorgeschlagenen Spikes. **Terra ist unverändert** und läuft weiter auf
> Three.js (`pnpm test:terra`: 682 Tests, 681 grün, 0 Fehler, 1 übersprungen).
> Der Spike liegt in [`terra-godot/`](../../terra-godot/) und ist wegwerfbar.
>
> Gemessen am 02.08.2026, Godot 4.5.stable, Chromium 1194, Node 22.22.

## Kurzfassung

Von den vier technischen Befunden der Analyse sind drei **bestätigt**, einer
**widerlegt**. Dazu kommt ein Befund, den die Analyse gar nicht auf dem Schirm
hatte und der der teuerste von allen ist.

| Frage | Analyse schätzte | Messung |
|---|---|---|
| Kann Godot Terras Format überhaupt lesen? | offen, „erste harte Frage" | **ja** — bitweise Parität |
| Lädt der Export unter der Produktions-CSP? | nein, `'wasm-unsafe-eval'` fehlt | **bestätigt**, exakt dieser Fehler |
| Reicht `'wasm-unsafe-eval'`? | ja, „schmalste WASM-Freigabe" | **bestätigt**, auch für die Brücke |
| Braucht es COEP / SharedArrayBuffer? | ja, außer bei einfädigem Export | **nein** — einfädig trägt |
| Auslieferungsgröße | 25–40 MB | **38,9 MB** roh, 9,7 MB gzip |
| Rechenzeit des Generators | *nicht bedacht* | **~197× langsamer als JS** |

---

## 1. Determinismus-Parität — bestanden

Die Frage, an der alles hängt: Seit Format v3 speichert Terra nicht die Höhen,
sondern nur das *Delta* gegen ein aus dem Seed nachgerechnetes Terrain
(`terra/src/editor/io.js:115`). Ein zweiter Renderer muss diesen Generator
bit-genau reproduzieren, sonst entsteht keine Fehlermeldung, sondern **eine
andere Welt**, auf die dann ein fremdes Delta gerechnet wird.

| Prüfung | Umfang | Ergebnis |
|---|---|---|
| Zufallsprimitive (`hashi`, `vnoise`, `fractal`, mulberry32) | 2.111 Werte | bitweise gleich |
| Basisterrain (`genBaseIn`) | 7 Felder, 91.399 Höhenwerte | bitweise gleich |

Abgedeckt sind negative Koordinaten, Seeds an beiden int32-Grenzen, 1 bis 8
Oktaven und alle vier Sonderzweige des Höhenprofils (`grat`, `stufe`,
`senken`, abweichende `randBreite`).

Die Referenzwerte kommen aus Terras Quelldateien selbst — die Dump-Werkzeuge
importieren `rng.js` und `terrain.js` direkt. Es gibt keine abgeschriebenen
Tabellen.

**Zwei Fallen, die dabei sichtbar wurden:**

- *Godots JSON-Leser gibt das letzte Bit eines Double nicht zurück.* Der erste
  Anlauf meldete 199 Abweichungen bei größter Abweichung 1,1e-16 — exakt ein
  ULP. Der Test maß den Parser, nicht die Portierung. Seitdem reisen alle
  Referenzwerte als IEEE-754-Bitmuster.
- *Terras Zielfeld ist ein `Float32Array`* (`io.js:454`): gerechnet wird in
  Double, gespeichert in 32 Bit. `PackedFloat64Array` hätte ein Feld ergeben,
  das dem Original nur ähnelt.

---

## 2. Die CSP — Analyse bestätigt, mit einer wichtigen Präzisierung

Gemessen wurde gegen die **echte** Policy, aus
`packages/auth/src/security-headers.ts` geholt statt nachgebaut:

```
script-src 'self' 'unsafe-inline'
```

**Unter dieser Policy startet Godot nicht**, mit exakt dem vorhergesagten
Fehler:

> `CompileError: WebAssembly.instantiateStreaming(): Refused to compile or
> instantiate WebAssembly module because 'unsafe-eval' is not an allowed
> source of script`

Mit `'wasm-unsafe-eval'` ergänzt: **startet, rechnet, zeichnet.**

### Die Präzisierung betrifft die Brücke

Ein Godot-Terra bräuchte Terras `postMessage`-Brücke (`bruecke.js`) — und
Godots Weg dorthin ist `JavaScriptBridge`. Der kennt zwei Zugänge, und der
Unterschied ist sicherheitsrelevant:

| Zugang | Braucht | Ergebnis |
|---|---|---|
| `JavaScriptBridge.eval()` | `'unsafe-eval'` — breit, gefährlich | blockiert |
| `JavaScriptBridge.get_interface()` | nur `'wasm-unsafe-eval'` | **funktioniert, null Seitenfehler** |

Das war zwischenzeitlich ein Fehlalarm: Die erste Messbrücke benutzte `eval`
und produzierte einen Strom von CSP-Fehlern, was wie ein Ausschlusskriterium
aussah. Es war ein Artefakt der Messung, nicht Godots. Über `get_interface`
läuft die Verständigung mit der Seite ohne `'unsafe-eval'`.

**Fazit:** Die nötige CSP-Änderung wäre `'wasm-unsafe-eval'` in `script-src` —
und nur das. Das ist die schmalste WASM-Freigabe, die es gibt, deutlich enger
als `'unsafe-eval'`. Eine bewusste Entscheidung bleibt es trotzdem.

---

## 3. COEP / SharedArrayBuffer — Analyse widerlegt

Die Analyse nannte die Cross-Origin-Isolation als schwerste Kollision: COEP
ließe sich nicht auf `/terra/*` beschränken, und unter `require-corp` stünden
YouTube-Einbettungen und Cloudflare Turnstile im Feuer.

**Diese Sorge ist gegenstandslos.** Der einfädige Export (`thread_support=false`,
Godot ≥ 4.3) läuft ohne `SharedArrayBuffer`:

```
Build configuration: Emscripten 4.0.10, single-threaded, no GDExtension support.
```

Kein COEP, kein `require-corp`, keine Cross-Origin-Isolation. YouTube und
Turnstile bleiben unberührt. Die Analyse nannte den einfädigen Export als
„Ausweg zum Preis der Leistung" — gemessen ist er schlicht der Normalweg.

---

## 4. Auslieferungsgröße — Analyse bestätigt

| | roh | gzip |
|---|---:|---:|
| `index.wasm` | 38.057.390 | 9.256.790 |
| `index.pck` | 519.256 | 371.188 |
| `index.js` | 305.185 | 76.948 |
| übrige (HTML, Audio-Worklets) | 15.568 | 5.546 |
| **Godot gesamt** | **38.897.399** | **9.710.472** |
| **Terra** (`vendor` + `src` + `index.html`) | **4.385.911** | **1.181.944** |
| **Faktor** | **8,8×** | **8,2×** |

Über die Leitung: **9,7 MB gegen 1,2 MB.** Im LAN belanglos, über einen
Cloudflare-Tunnel an einem Heimanschluss ein anderer Erstlade-Charakter — und
für das Portal, das Spieler von außen benutzen, der spürbarere Fall.

Anmerkung: Terras 4,39 MB sind die vollständige Positivliste aus
`copy-terra.mjs` (vendor, src, index.html). Die 519 KB im `.pck` sind fast
ausschließlich die Referenzdaten des Spikes, kein Godot-Aufwand.

---

## 5. Der Befund, den die Analyse nicht hatte: GDScript ist zu langsam

`genBaseIn` läuft bei **jedem Kartenladen** — das Format erzwingt es, weil nur
das Delta gespeichert ist. Es ist nicht optional und nicht in den Hintergrund
zu schieben.

| Kantenlänge | Zellen | GDScript | JavaScript | Faktor |
|---:|---:|---:|---:|---:|
| 64 | 4.225 | 305,7 ms | — | |
| 128 | 16.641 | 1.167,9 ms | — | |
| 256 | 66.049 | **4.714,4 ms** | **23,9 ms** | **197×** |

Beide auf derselben Maschine, dasselbe Biom, derselbe Rechenweg — die
Paritätsprüfung garantiert, dass wirklich dasselbe gerechnet wird.

Die Skalierung ist linear mit der Zellenzahl. Hochgerechnet auf Terras größte
Karte (1024² = 1.050.625 Zellen): **rund 75 Sekunden in GDScript gegen etwa
0,4 Sekunden in JavaScript.** Beim Öffnen jeder Karte.

Das ist kein Ausschlusskriterium — es gibt Auswege (C#, GDExtension, das Feld
in einem Compute-Shader rechnen, oder das Format so ändern, dass es die Höhen
mitliefert). Aber jeder dieser Auswege ist ein eigenes Vorhaben, und keiner
davon stand in der Analyse.

---

## 6. Bildrate — gemessen, aber nur eingeschränkt aussagekräftig

| | fps | Renderer |
|---|---:|---|
| Godot (nacktes Terrain, 131.072 Dreiecke) | 2,1 | WebKit WebGL |
| Terra (volle Welt) | 0,7 | ANGLE / **SwiftShader** |

**Diese zwei Zahlen sind kein Engine-Vergleich, und wer sie als einen liest,
liest sie falsch.** Die Lasten sind nicht dieselben: Godot zeichnet hier ein
flach eingefärbtes Terrain-Mesh ohne Vegetation, Wasser, Nachbearbeitung oder
Ghibli-Bildaufbau. Terra zeichnet die vollständige Szene. Dass Godot dabei die
höhere Zahl erreicht, sagt über die Engines nichts.

Was die Messung **doch** hergibt, ist der Renderer-String:

```
ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)
```

Ein **Software-Rasterizer**. Damit ist gezeigt, dass genau das Symptom aus
`terra/README.md:120-124` — einstellige fps bei geringer Dreieckslast —
entsteht, wenn keine GPU im Spiel ist.

**Das ersetzt C10 nicht.** Gemessen wurde dieser Container, nicht die
UWE-Hardware. Die Prüfung auf dem Zielrechner steht weiterhin aus und bleibt
laut `terra-bearbeitungsplan.md:126` Vorbedingung für H1. Der Spike zeigt nur:
Die Vermutung im README beschreibt ein real existierendes Fehlerbild.

---

## 7. Was das für die Empfehlung bedeutet

Die Empfehlung der Analyse — **nicht umstellen** — steht. Sie steht sogar auf
besserem Grund, weil zwei ihrer Argumente sich verschoben haben:

**Schwächer geworden:** Die CSP-Hürde ist kleiner als gedacht
(`'wasm-unsafe-eval'` genügt, auch für die Brücke), und die COEP-Kollision
existiert nicht.

**Stärker geworden:** Die Rechenzeit. 197× langsamer bei einer Rechnung, die
das Dateiformat bei jedem Laden erzwingt, ist ein Kostenpunkt, der in der
Analyse fehlte — und er trifft ausgerechnet die Kartengrößen, für die Runde H
gebaut wurde.

**Unverändert:** Der eigentliche Anlass ist weiterhin nicht aufgeklärt (§ 6),
und der Umfang einer echten Umstellung — 47.884 Zeilen Generatoren, 17.423
Zeilen Tests, die gesamte Bildsprache — ist von diesem Spike unberührt. Er hat
ein Terrain gezeichnet, sonst nichts.

### Was als Nächstes sinnvoll wäre

1. **C10 auf der echten Hardware messen.** Eine Stunde. Blockiert laut
   Bearbeitungsplan bereits H1.
2. Falls Godot weiterverfolgt wird: **zuerst die Rechenzeit lösen**, nicht den
   Look. Ein Renderer, der 75 Sekunden zum Öffnen einer 1024er-Karte braucht,
   ist unabhängig von seiner Bildqualität unbenutzbar.
3. `terra/README.md:3-5` korrigieren (behauptet CDN-Bezug, Three ist vendored).

---

## Nachvollziehen

```bash
GODOT=/pfad/zu/Godot_v4.5-stable_linux.x86_64

node terra-godot/werkzeug/golden-dump.mjs  > terra-godot/test/golden.json
node terra-godot/werkzeug/terrain-dump.mjs > terra-godot/test/terrain.json

"$GODOT" --headless --path terra-godot --import
"$GODOT" --headless --path terra-godot --script res://test/parity.gd
"$GODOT" --headless --path terra-godot --script res://test/terrain-parity.gd
"$GODOT" --headless --path terra-godot --script res://test/bank.gd
"$GODOT" --headless --path terra-godot --export-release "Web" export/index.html

node terra-godot/werkzeug/messen.mjs      # Rohwerte: terra-godot/export/messung.json
```

Godot-Binary und Export-Templates liegen **nicht** im Repo (66 MB + 1,3 GB).
