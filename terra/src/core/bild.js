/* ==========================================================================
   Bildraum — Umrechnung Weltgroesse <-> Bildpunkte

   Eine Datei fuer eine Formel, und das ist Absicht.

   Zwei Dinge in Terra muessen im BILD gleich gross bleiben, statt in der
   Welt: die Kartenbeschriftung (ui/beschriftung.js) und die Signaturen
   (render/signaturen.js). Beide brauchen dieselbe Umrechnung, und beide
   duerfen einander nicht importieren — ui/ nach render/ waere die falsche
   Richtung, render/ nach ui/ erst recht.

   Also stand die Formel zweimal da, jeweils mit einer Notiz „das laeuft
   auseinander". Genau das ist der Fall, fuer den es diese Datei gibt: sie
   haengt an nichts und darf von ueberall gelesen werden.

   Warum das ueberhaupt zaehlt: laufen Schriftgrad und Signaturgroesse
   auseinander, sieht die Karte auf jedem Maszstab ein bisschen falsch aus —
   ein Fehler, den man sieht, aber nicht findet.
   ========================================================================== */

const DEG = Math.PI / 180;

/**
 * Bildhoehe eines Objekts fester Weltgroesse in Bildpunkten, perspektivische
 * Kamera.
 *
 * `2 * tan(fov/2) * abstand` ist die Hoehe des sichtbaren Ausschnitts in
 * Weltmetern an dieser Entfernung; der Rest ist der Dreisatz auf die
 * Bildhoehe. Der Abstand wird bei 1e-3 abgefangen — steht die Kamera exakt
 * im Objekt, waere das Ergebnis unendlich, und das liefe als NaN bis in die
 * Instanzdaten.
 *
 * @param weltHoehe  Ausdehnung in Weltmetern
 * @param abstand    Kameraabstand in Weltmetern
 * @param fovGrad    vertikaler Oeffnungswinkel in Grad (Vorgabe 30)
 * @param bildHoehe  Hoehe des Ausgabebildes in Bildpunkten
 */
export function bildhoehe(weltHoehe, abstand, fovGrad, bildHoehe) {
  var t = Math.tan((fovGrad || 30) * 0.5 * DEG) * Math.max(1e-3, abstand) * 2;
  return weltHoehe / t * bildHoehe;
}

/**
 * Gegenrichtung: welche Weltgroesse ergibt an diesem Abstand die gewuenschte
 * Zahl Bildpunkte. Das ist die Rechnung hinter Mindest- und Hoechstgroesse —
 * ohne sie muesste jeder Aufrufer die Formel umstellen, und genau dabei
 * entstehen die Abweichungen, wegen derer diese Datei existiert.
 */
export function weltgroesseFuerPixel(pixel, abstand, fovGrad, bildHoehe) {
  if (!(bildHoehe > 0)) return 0;
  var t = Math.tan((fovGrad || 30) * 0.5 * DEG) * Math.max(1e-3, abstand) * 2;
  return pixel / bildHoehe * t;
}
