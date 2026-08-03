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
import './10-kartenbaum.test.mjs';
import './11-signaturen.test.mjs';
import './12-bruecke.test.mjs';
import './13-fluesse.test.mjs';
import './14-signaturen-generatoren.test.mjs';
import './15-welt-vorgabe.test.mjs';
import './16-seen.test.mjs';
import './17-kartenbild.test.mjs';
import './18-bedienung.test.mjs';
import './19-wasser-nebel.test.mjs';
import './20-kartenbild-voll.test.mjs';
import './21-bedienung-voll.test.mjs';
import './22-architektur-schildkroete.test.mjs';
import './23-architektur-details.test.mjs';
import './24-architektur-fassaden.test.mjs';
import './25-architektur-radius.test.mjs';
import './26-architektur-leben.test.mjs';
import './27-umwelt-geometrie.test.mjs';
import './28-wegrand-profil.test.mjs';
import './28-weltleben.test.mjs';
import './29-performance-depth-pass.test.mjs';
import './30-grainless-image.test.mjs';
import './31-bestand-bau-veredelung.test.mjs';
import './32-bestand-katalog-veredelung.test.mjs';
import './33-asset-schau.test.mjs';
import './34-asset-modernisierung.test.mjs';
import './35-selection-outline.test.mjs';
import './35-steampunk-luftflotte.test.mjs';
import './35-luftinseln-hochbambus.test.mjs';
import './36-luftsysteme.test.mjs';
import './37-luftschau.test.mjs';
import './38-final-art-pass.test.mjs';
import './43-render-masse.test.mjs';
import './44-leistungsregler.test.mjs';
import './45-landmarken-bereich.test.mjs';
import './46-art-factory.test.mjs';
