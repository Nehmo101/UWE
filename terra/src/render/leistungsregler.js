/* ==========================================================================
   Leistungsregler — adaptive Renderaufloesung

   Terra rendert mit voller Retina-Schaerfe, MSAA und einer mehrstufigen
   Post-Kette. Auf schwaecheren GPUs oder grossen Karten faellt die Bildrate
   damit unter die Bedienbarkeitsgrenze. Der Regler beobachtet die echte
   Bildzeit und senkt die Renderskala in Stufen, bis die Rate traegt — und
   hebt sie wieder an, wenn Luft ist. Reine Logik ohne DOM/WebGL, damit sie
   im Node-Test vollstaendig pruefbar ist; die Anwendung der Skala (Renderer,
   Composer, Tiefenziel) macht render/pipeline.js.

   Bewusste Traegheit in beide Richtungen (Hysterese):
   - RUNTER erst nach ~1 s anhaltend langsamer Bilder — ein einzelner Ruckler
     (Tab-Wechsel, Commit einer grossen Karte) darf die Schaerfe nicht kosten.
   - HOCH erst nach mehreren Sekunden anhaltend schneller Bilder — sonst
     pumpt der Regler zwischen zwei Stufen.
   - Nach jedem Wechsel eine Ruhepause, denn die EMA misst noch die alte
     Stufe; ohne Pause spraenge er zwei Stufen auf einmal.
   ========================================================================== */

/**
 * Schaerfeorientierte Skalenleiter: der erste Schritt spart bereits 15 % Pixel,
 * bleibt aber deutlich klarer als der alte direkte Sprung auf 0.85.
 */
export const LEISTUNGS_STUFEN = [1, 0.92, 0.82, 0.72, 0.6];

/**
 * @param opts.stufen     Skalenleiter (absteigend), Default LEISTUNGS_STUFEN.
 * @param opts.runterMs   Bildzeit, ab der eine Stufe runtergeschaltet wird
 *                        (Default 38 ms ≈ unter 26 fps).
 * @param opts.hochMs     Bildzeit, unter der wieder hochgeschaltet wird
 *                        (Default 20 ms ≈ ueber 50 fps).
 * @param opts.runterNach Sekunden anhaltend langsam bis zum Runterschalten.
 * @param opts.hochNach   Sekunden anhaltend schnell bis zum Hochschalten.
 * @param opts.ruhe       Ruhepause nach jedem Wechsel in Sekunden.
 */
export function erzeugeLeistungsRegler(opts) {
  opts = opts || {};
  var stufen = opts.stufen || LEISTUNGS_STUFEN;
  var runterMs = opts.runterMs === undefined ? 38 : opts.runterMs;
  var hochMs = opts.hochMs === undefined ? 20 : opts.hochMs;
  var runterNach = opts.runterNach === undefined ? 1.2 : opts.runterNach;
  var hochNach = opts.hochNach === undefined ? 2.5 : opts.hochNach;
  var ruhe = opts.ruhe === undefined ? 1.2 : opts.ruhe;
  var stufe = 0, ema = 16, langsam = 0, schnell = 0, pause = 0;

  return {
    skala: function () { return stufen[stufe]; },
    stufe: function () { return stufe; },
    /**
     * Ein Bild melden. dt ist die ECHTE Bildzeit in Sekunden (ungeklammert).
     * Rueckgabe: die neue Skala bei einem Stufenwechsel, sonst null.
     */
    tick: function (dt) {
      if (!(dt > 0) || !Number.isFinite(dt)) return null;
      // Ausreisser deckeln: eine Sekunde Tab-Pause ist kein Messwert.
      var ms = Math.min(dt * 1000, 250);
      ema += (ms - ema) * 0.1;
      if (pause > 0) { pause -= dt; return null; }
      if (ema > runterMs) {
        schnell = 0;
        langsam += dt;
        if (langsam >= runterNach && stufe < stufen.length - 1) {
          stufe++;
          langsam = 0;
          pause = ruhe;
          // Die EMA traegt noch die alte Stufe — auf die Schwelle zuruecksetzen,
          // damit erst die NEUE Stufe gemessen wird statt weiterzufallen.
          ema = runterMs;
          return stufen[stufe];
        }
      } else if (ema < hochMs) {
        langsam = 0;
        schnell += dt;
        if (schnell >= hochNach && stufe > 0) {
          stufe--;
          schnell = 0;
          pause = ruhe;
          ema = hochMs;
          return stufen[stufe];
        }
      } else {
        langsam = 0;
        schnell = 0;
      }
      return null;
    }
  };
}
