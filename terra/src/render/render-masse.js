const MAX_RENDER_PIXEL = 3840 * 2160;

/**
 * Bestimmt ein scharfes, aber speichersicheres Rendermass.
 * Normale Ansichten behalten bis zu 2x Retina; sehr grosse Fenster werden
 * hoechstens in 4K gerendert, statt mehrere hundert MB Post-Puffer anzulegen.
 *
 * `skala` (0..1, optional) ist die adaptive Renderskala des Leistungsreglers
 * (render/leistungsregler.js): sie senkt die Pixeldichte unter die normale
 * Untergrenze von 1 ab — aber nie unter 0.5, darunter zerfaellt das Bild.
 * Ohne oder mit ungueltiger Skala bleibt das Ergebnis exakt das bisherige.
 */
function berechneRenderMasse(breite, hoehe, geraeteDpr, skala) {
  var w = Math.max(1, Math.round(Number(breite) || 1));
  var h = Math.max(1, Math.round(Number(hoehe) || 1));
  var dpr = Math.max(1, Number(geraeteDpr) || 1);
  var budgetDpr = Math.sqrt(MAX_RENDER_PIXEL / (w * h));
  var pixelRatio = Math.max(1, Math.min(2, dpr, budgetDpr));
  var s = (typeof skala === 'number' && skala > 0 && skala < 1) ? skala : 1;
  pixelRatio = Math.max(0.5, pixelRatio * s);
  /* Tiefen-Prepass in VOLLER Renderaufloesung (vorher halbe).
     Der Grund steht im Bild: aus der halben Aufloesung zeichnete der Sobel des
     Kante-Passes seine Silhouettenlinie in 2x2-Bloecken — die Tiefentextur
     muss NearestFilter tragen (DEPTH_COMPONENT ist in WebGL2 nicht filterbar),
     also rastete die Linie auf genau diesen Bloecken ein und lief als vier
     Bildpunkte breite Treppe ueber jeden Hoehenruecken. Dasselbe galt fuer den
     Kontakthof, der die Objekte erdet, und fuer die Himmelsmaske der Godrays.
     Gemessen kostet die volle Aufloesung nichts: alle drei Weitaufnahmen
     bleiben bei 17 ms Median. Der Prepass ist seit dem Materialtausch ein
     reiner Tiefendurchlauf (MeshDepthMaterial, kein Shading) — die vierfache
     Fragmentzahl faellt neben der Geometriearbeit nicht ins Gewicht, die er
     ohnehin schon leistet. */
  return {
    pixelRatio: pixelRatio,
    tiefenBreite: Math.max(1, Math.round(w * pixelRatio)),
    tiefenHoehe: Math.max(1, Math.round(h * pixelRatio))
  };
}

export { MAX_RENDER_PIXEL, berechneRenderMasse };
