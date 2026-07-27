/* ==========================================================================
   Sammeleinstieg — damit `node --test terra/test` funktioniert.

   Hintergrund: Node 22+ behandelt Argumente von `--test` als Glob-Muster.
   Ein Verzeichnisname passt dabei auf sich selbst und wird als DATEI geladen,
   statt durchsucht zu werden (geprueft mit Node 24.18 unter Windows). Damit
   der in der Anleitung genannte Aufruf trotzdem stimmt, macht die
   package.json dieses Ordners ihn aufloesbar: sie zeigt mit `main` auf diese
   Datei, und diese Datei zieht die einzelnen Testdateien herein.

   Beide Wege laufen also:
       node --test terra/test                     (ueber diese Datei)
       node --test "terra/test/*.test.mjs"        (jede Datei ein Prozess)

   Neue Testdatei? Hier eintragen — sonst laeuft sie nur ueber das Glob.
   ========================================================================== */
import './01-determinismus.test.mjs';
import './02-format.test.mjs';
import './03-invarianten.test.mjs';
import './04-shader-anker.test.mjs';
import './05-registry.test.mjs';
import './06-erosion.test.mjs';
import './07-biomfeld.test.mjs';
import './08-beschriftung.test.mjs';
import './09-einbettung.test.mjs';
