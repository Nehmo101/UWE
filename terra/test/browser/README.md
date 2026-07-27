# Browserprüfungen

`node --test terra/test` prüft Logik. Es prüft **nicht**, ob der Editor startet.

Das ist keine Nachlässigkeit, sondern die Bauart der Suite: `main.js` wird dort
gar nicht geladen, und `panels.js`, `tools.js`, `pipeline.js`, `textures.js`,
`camera.js`, `selection.js`, `history.js` sind durch Ersatzmodule ausgetauscht
(siehe `../hilfen/haken.mjs`). Alles, was Bedienung, Szeneaufbau und Bild
angeht, liegt damit außerhalb ihrer Reichweite.

Diese Lücke schließen die Skripte hier. Sie laufen **nicht** unter
`node --test`, weil sie einen Browser und einen laufenden Server brauchen —
zwei Abhängigkeiten, die die Hauptsuite bewusst nicht hat.

## Voraussetzungen

Ein statischer Server auf `terra/`, Port 8123:

```
node -e "const http=require('http'),fs=require('fs'),path=require('path');const root=process.cwd();const typ={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json'};http.createServer((q,s)=>{let p=path.join(root,decodeURIComponent(q.url.split('?')[0]));if(q.url==='/')p=path.join(root,'index.html');fs.readFile(p,(e,d)=>{if(e){s.writeHead(404);s.end();return}s.writeHead(200,{'Content-Type':typ[path.extname(p)]||'application/octet-stream'});s.end(d)})}).listen(8123)"
```

Playwright kommt aus dem Monorepo (`C:/git/UWE/node_modules`) — Terra selbst
hat keine Abhängigkeiten und soll auch keine bekommen. Der Pfad steht oben in
jedem Skript; wandert das Monorepo, muss er mitwandern.

## Aufruf

```
cd C:/git/UWE-terra/terra          # Server hier starten
node test/browser/runde-i.mjs      # Exitcode 0 = alles grün
```

Screenshots landen im Scratchpad-Ordner, der oben im Skript steht.

## `runde-i.mjs` — 19 Schritte

Deckt die Einbettung der Runde I ab: Startet der Editor ohne Seitenfehler,
stehen die Panel-Abschnitte Erosion, Biome und Namen, läuft ein Erosionslauf
über mehrere Bilder durch und kehrt zurück, erzeugt der Biomvorschlag
Elemente mit handhabbarer Punktzahl, lässt sich eine Beschriftung setzen, und
hält `zielPruefen` auch im Browser dicht.

Stand 27.07.2026: **19/19 grün**, 44 Shaderpatches, 0 Konsolenwarnungen,
19 vorgeschlagene Biomflächen aus 8 Biomen, größtes Polygon 32 Punkte.

## `bruecke.mjs` — 20 Schritte (J1)

Prüft die Einbettung: Terra läuft in einem gleich-origin `<iframe>`, eine
Elternseite spricht das Protokoll aus `src/editor/bruecke.js`.

Die Elternseite liegt **nicht** im Baum — Playwright blendet sie über
`page.route()` auf die Herkunft des Servers ein (`/__brueckenprobe.html`).
Anders ginge es nicht: der `origin`-Vergleich verlangt dieselbe Herkunft, und
eine Testdatei unter `terra/` wäre Werkzeug am falschen Ort.

Drei Läufe:

1. **Bearbeiten** — kommt `terra-bereit` an, läuft eine hereingereichte
   v5-Datei durch den GANZEN Ladeweg (Seed, Biom, Baumtitel), löst eine echte
   Bedienung entprellt `karte-geaendert` aus, hebt `stand-bestaetigt` die
   Version, lässt eine unlesbare Karte den Editorstand unangetastet.
2. **Lesen** (`?modus=lesen`) — Rail, Panel und Leiste ausgeblendet,
   `<body data-terra-modus="lesen">`, Karten kommen herein, aber es geht
   **nie** eine Änderung hinaus.
3. **Ohne Rahmen** — die wichtigste Zusage: Terra allein aufgerufen verhält
   sich wie vorher. Keine Brücke, kein Zuhörer, nichts ausgeblendet.

Stand 27.07.2026: **20/20 grün**, 0 Seitenfehler in allen drei Läufen.

## Was auch das nicht leistet

WebGL läuft hier über SwiftShader, also in Software — rund ein Bild je
Sekunde. Geprüft wird damit, **dass** etwas gezeichnet wird, nicht **wie gut**
es aussieht. Für die Bildbeurteilung führt kein Weg an einem Menschen mit
einer echten Grafikkarte vorbei.
