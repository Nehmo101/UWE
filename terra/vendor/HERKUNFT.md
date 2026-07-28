# Fremdcode in Terra

Terra hat keine Abhängigkeiten und keinen Build-Schritt. Dieser Ordner ist die
einzige Ausnahme, und sie hat einen Grund.

## three 0.185.1

| | |
|---|---|
| Fassung | **0.185.1** (REVISION 185) |
| Quelle | `https://cdn.jsdelivr.net/npm/three@0.185.1/` |
| Geholt am | 27.07.2026 |
| Verändert | **nein** — Byte für Byte wie ausgeliefert |
| Lizenz | MIT (siehe `three/LICENSE` im npm-Paket) |

```
vendor/three/three.module.js                     build/three.module.js
vendor/three/three.core.js                       build/three.core.js
vendor/three/addons/postprocessing/*.js          examples/jsm/postprocessing/
vendor/three/addons/shaders/*.js                 examples/jsm/shaders/
```

`three.core.js` wird von `three.module.js` aus demselben Ordner nachgeladen;
die sieben Postprocessing-Dateien und die drei Shader ziehen einander
gegenseitig. Alle zehn Addon-Dateien werden gebraucht — auch die, die Terra
nicht direkt importiert (`Pass.js`, `MaskPass.js`, die drei Shader).

## Warum im Baum und nicht vom CDN

Bis Runde J lud `terra/index.html` three per Import-Map von jsdelivr. Das ging,
solange Terra allein lief. Eingebettet in UWE geht es nicht mehr: die
Content-Security-Policy dort setzt `script-src 'self'`, und ein fremder Host
steht nicht darin — Terra bliebe im Frame schwarz.

Die Alternative wäre gewesen, jsdelivr in die CSP aufzunehmen. Das hätte die
Richtlinie für die **ganze** Anwendung gelöchert, nicht nur für diese Seite.
Zwei Megabyte im Baum sind der günstigere Preis.

Drei Dinge kommen umsonst dazu: Terra lässt sich weiterhin per Doppelklick auf
`terra/index.html` öffnen, der Editor läuft ohne Netz, und der Shader-Ankertest
(`terra/test/04-shader-anker.test.mjs`) kann seit dieser Runde gegen die
**echte** Three-Quelle prüfen statt gegen eine mitgelieferte Ankerliste. Das war
vorher ein optionaler Schritt, den man von Hand einrichten musste; jetzt ist es
der Regelfall.

## Beim Wechsel der Fassung

Die Fassung ist **gepinnt**. Ein Wechsel ist ein bewusster Schritt, kein
Nebeneffekt:

1. Die zwölf Dateien oben aus der neuen Fassung holen, an dieselben Stellen.
2. Diese Datei fortschreiben (Fassung, Datum).
3. `node --test terra/test` laufen lassen. Ebene 4 prüft jeden Shader-Anker
   gegen die neue Quelle und meldet, welcher Patch seinen Anker verloren hat.
4. Die Ankerliste `terra/test/fixtures/three-0.185.1-anker.json` neu erzeugen
   und umbenennen.

Schritt 3 ist der Punkt. Terra patcht Three-Shader über `onBeforeCompile` an
elf Stellen; verschiebt eine neue Fassung einen `#include`, fällt der Patch
still aus, und das Bild ist nur ein bisschen falsch. Genau dagegen gibt es
diese Prüfung.
