// Anno-Kamera: Fokus auf der Bodenebene, Auto-Flatten, gedaempfte Interpolation,
// plus analytische Strahlen gegen das Heightfield.
import * as THREE from 'three';
import { clamp, lerp, DEG } from '../core/rng.js';
import { HALF } from '../core/store.js';
import { heightAt } from '../world/terrain.js';

export const camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.5, 3000);
camera.position.set(0, 120, 160);

/** Veraenderlicher Kamerazustand — von Zeiger, Tastatur und IO gemeinsam genutzt. */
export const cam = {
  focus: { x: 0, z: 0 }, tFocus: { x: 0, z: 0 },
  focusY: 0, tFocusY: 0,
  dist: 120, tDist: 120,
  yaw: 0.7, tYaw: 0.7,
  pitch: 42 * DEG, tPitch: 42 * DEG,
  /* F4: Brennweite und Blickpunkthebung laufen ueber dieselbe Daempfung wie
     alles andere. Ausserhalb des Aufnahme-Modus stehen sie auf den Werten,
     die das bisherige Verhalten exakt reproduzieren (30° FOV, keine Hebung) —
     io.js speichert sie bewusst NICHT mit, eine geladene Karte startet also
     immer in der freien Ansicht. */
  fov: 30, tFov: 30,
  hebung: 0, tHebung: 0
};
var DAMP = 0.15;

/* Schwenkgrenze: 40 Einheiten ueber den Kartenrand hinaus (H1b).
   HALF ist seit der Kartengroessen-Umstellung keine Konstante mehr, sondern
   eine lebende Modulbindung aus core/store.js. Deshalb MUSS der Wert in der
   Funktion gelesen werden — eine Kopie beim Modulstart wuerde beim Wechsel
   auf 512/1024 auf der alten Grenze einfrieren. */
function fokusGrenze() { return HALF + 40; }

export const keys = {};
export function initKeys(onKey) {
  window.addEventListener("keydown", function (e) {
    var tag = (e.target && e.target.tagName) || "";
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
    keys[e.code] = true;
    onKey(e);
  });
  window.addEventListener("keyup", function (e) { keys[e.code] = false; });
  window.addEventListener("blur", function () { for (var k in keys) delete keys[k]; });
}

/* ==========================================================================
   F4 — Aufnahme-Modus: komponierte Kamera
   --------------------------------------------------------------------------
   Zustand des Modus. `vorher` haelt die Zielwerte der freien Ansicht, damit
   setAufnahme(false) genau dorthin zurueckfaehrt (ueber die normale
   Daempfung, also als Fahrt, nicht als Sprung).
   ========================================================================== */
var AUF = {
  an: false,
  fov: 20,             // Grad, vertikal
  horizont: 1 / 3,     // NDC-y, auf dem der Horizont sitzen soll
  hebung: 16,          // Welteinheiten, um die der Blickpunkt ueber Grund steigt
  pitch: 0,            // aus fov + horizont gerechnet, siehe horizontPitch
  vorher: null
};
/** Vorgaben des Modus — als Objekt, damit opt sie einzeln ueberschreiben kann. */
var AUFNAHME_VORGABE = { fov: 20, horizont: 1 / 3, hebung: 16, distMin: 90, distMax: 260 };

function zoomT() { return clamp((cam.tDist - 25) / (400 - 25), 0, 1); }

/**
 * Auto-Flatten: nah = flach (30°), fern = steiler (60°).
 * Im Aufnahme-Modus liefert die Funktion den komponierten Neigungswinkel
 * zurueck statt des Zoom-Werts. Das ist die eine Stelle, an der die
 * Auto-Flatten-Logik die Komposition kippen koennte: pointer.js setzt im
 * Radhandler `cam.tPitch = autoPitch()`. Weil die Funktion dort importiert
 * wird, genuegt dieser Riegel — der Zoom bleibt im Modus erlaubt, nur die
 * Neigung nicht mehr. Gegen direkte Schreibzugriffe (Orbit-Ziehen setzt
 * cam.tPitch selbst) sichert zusaetzlich updateCamera ab.
 */
function autoPitch() { return AUF.an ? AUF.pitch : lerp(30, 60, zoomT()) * DEG; }

function updateCamera(dt) {
  var f = 1 - Math.pow(1 - DAMP, dt * 60);
  /* Der Aufnahme-Modus haelt seine Neigung selbst: Orbit-Ziehen (pointer.js)
     schreibt cam.tPitch direkt und wuerde die Komposition sonst verstellen.
     Gieren, Schwenken und Zoomen bleiben frei — nur die Bildaufteilung ist
     eingerastet. */
  if (AUF.an) { cam.tPitch = AUF.pitch; cam.tFov = AUF.fov; cam.tHebung = AUF.hebung; }
  cam.focus.x += (cam.tFocus.x - cam.focus.x) * f;
  cam.focus.z += (cam.tFocus.z - cam.focus.z) * f;
  cam.dist += (cam.tDist - cam.dist) * f;
  cam.yaw += (cam.tYaw - cam.yaw) * f;
  cam.pitch += (cam.tPitch - cam.pitch) * f;
  cam.hebung += (cam.tHebung - cam.hebung) * f;
  // Brennweite faehrt mit derselben Daempfung; die Projektionsmatrix wird nur
  // angefasst, solange sich wirklich etwas bewegt.
  if (Math.abs(cam.tFov - cam.fov) > 1e-4) {
    cam.fov += (cam.tFov - cam.fov) * f;
    if (Math.abs(cam.tFov - cam.fov) <= 1e-4) cam.fov = cam.tFov;
    camera.fov = cam.fov;
    camera.updateProjectionMatrix();
  }
  cam.tFocusY = heightAt(cam.focus.x, cam.focus.z);
  cam.focusY += (cam.tFocusY - cam.focusY) * f * 0.6;
  var cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
  var cx = cam.focus.x + cam.dist * cp * Math.sin(cam.yaw);
  var cz = cam.focus.z + cam.dist * cp * Math.cos(cam.yaw);
  var blickY = cam.focusY + cam.hebung;      // angehobener Blickpunkt (F4)
  var cy = blickY + cam.dist * sp;
  var floor = heightAt(cx, cz) + 4;
  /* Bodenfreiheit: ausserhalb des Aufnahme-Modus wird wie bisher nur die
     Kamera angehoben. Im Modus wuerde das die Neigung und damit den Horizont
     verschieben — deshalb hebt sich dort das ganze Gespann (Kamera UND
     Blickpunkt) um denselben Betrag, die Komposition bleibt erhalten. */
  var hebe = floor - cy;
  if (hebe > 0) { cy += hebe; if (AUF.an) blickY += hebe; }
  camera.position.set(cx, cy, cz);
  camera.lookAt(cam.focus.x, blickY, cam.focus.z);
}

function moveFocus(dt) {
  var sp = cam.dist * 0.55 * dt;
  var fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw);
  var rx = -fz, rz = fx;
  var mx = 0, mz = 0;
  if (keys.KeyW || keys.ArrowUp) { mx += fx; mz += fz; }
  if (keys.KeyS || keys.ArrowDown) { mx -= fx; mz -= fz; }
  if (keys.KeyD || keys.ArrowRight) { mx += rx; mz += rz; }
  if (keys.KeyA || keys.ArrowLeft) { mx -= rx; mz -= rz; }
  if (mx || mz) {
    var l = Math.sqrt(mx * mx + mz * mz);
    var g = fokusGrenze();
    cam.tFocus.x = clamp(cam.tFocus.x + mx / l * sp, -g, g);
    cam.tFocus.z = clamp(cam.tFocus.z + mz / l * sp, -g, g);
  }
  if (keys.KeyQ) cam.tYaw += 1.4 * dt;
  if (keys.KeyE) cam.tYaw -= 1.4 * dt;
}

var raycaster = new THREE.Raycaster();
var _ndc = new THREE.Vector2();
function rayFrom(ev) {
  _ndc.x = (ev.clientX / window.innerWidth) * 2 - 1;
  _ndc.y = -((ev.clientY / window.innerHeight) * 2 - 1);
  raycaster.setFromCamera(_ndc, camera);
  return raycaster.ray;
}
function rayTerrain(ray) {
  var o = ray.origin, d = ray.direction, t = 0, step;
  for (var i = 0; i < 900; i++) {
    step = Math.max(1.0, t * 0.02);
    var nt = t + step;
    var x = o.x + d.x * nt, y = o.y + d.y * nt, z = o.z + d.z * nt;
    if (y - heightAt(x, z) <= 0) {
      var lo = t, hi = nt;
      for (var b = 0; b < 22; b++) {
        var mid = (lo + hi) * 0.5;
        if ((o.y + d.y * mid) - heightAt(o.x + d.x * mid, o.z + d.z * mid) > 0) lo = mid; else hi = mid;
      }
      var ft = (lo + hi) * 0.5;
      return new THREE.Vector3(o.x + d.x * ft, o.y + d.y * ft, o.z + d.z * ft);
    }
    t = nt;
    if (t > 2400) break;
  }
  return null;
}

function rayPlane(ray, y) {
  var d = ray.direction;
  if (Math.abs(d.y) < 1e-6) return null;
  var t = (y - ray.origin.y) / d.y;
  if (t < 0) return null;
  return new THREE.Vector3(ray.origin.x + d.x * t, y, ray.origin.z + d.z * t);
}

function groundPoint(ev) {
  var ray = rayFrom(ev);
  return rayTerrain(ray) || rayPlane(ray, cam.focusY) || null;
}


/* ==========================================================================
   F4 — Komposition: Brennweite, Horizontlage, Drittelregel
   --------------------------------------------------------------------------
   Alles hier rechnet ueber die Projektion, nicht nach Augenmass.

   (1) Halbwinkel. Ein Punkt, der um den Winkel a ueber der Blickachse liegt,
       landet bei ndc.y = tan(a) / tan(fov/2). Waagerecht kommt der
       Seitenverhaeltnisfaktor dazu: ndc.x = tan(b) / (tan(fov/2) * aspect).

   (2) Horizont. Die Kamera steht um `pitch` ueber der Blickachse geneigt
       (updateCamera setzt cy = blickY + dist*sin(pitch) und schaut auf
       blickY — die Blickachse faellt also um genau `pitch`). Der Horizont
       ist die Richtung mit Hoehenwinkel 0, liegt also um `pitch` UEBER der
       Blickachse:
             ndc.y(Horizont) = tan(pitch) / tan(fov/2)
       Soll er auf einem Drittel sitzen (ndc.y = 1/3 = oberes Drittel), folgt
             pitch = atan( ndcZiel * tan(fov/2) ).
       Das ist der Grund, warum eine komponierte Einstellung zwangslaeufig
       flach ist: bei fov 20° sind das 3.36°. Mit den heutigen 42° Neigung
       liegt der Horizont bei ndc.y = 3.36 — also weit ausserhalb des Bildes,
       man sieht ueberhaupt keinen Horizont, sondern den Kartenrand.

   (3) Brennweite. fov 30° -> 20° entspricht am Kleinbild (Bildhoehe 24 mm)
       12/tan(15°) = 44.8 mm -> 12/tan(10°) = 68.1 mm, also gut die
       anderthalbfache Brennweite. Die Perspektive wird flacher, der Aufbau-
       spiel-Look filmischer.
   ========================================================================== */

/** tan(fov/2) — der Halbwinkel, mit dem die ganze Projektion skaliert. */
function halbwinkel(fovGrad) { return Math.tan(fovGrad * DEG * 0.5); }

/** Neigung, die den Horizont auf die NDC-Hoehe `ndcY` legt (siehe (2)). */
function horizontPitch(fovGrad, ndcY) { return Math.atan(ndcY * halbwinkel(fovGrad)); }

/**
 * Schaltet den Aufnahme-Modus. `opt` darf fov, horizont, hebung, dist und yaw
 * ueberschreiben. Gesetzt werden ausschliesslich ZIELwerte — updateCamera
 * faehrt sie mit derselben Daempfung an wie jede andere Kamerabewegung.
 * Rueckgabe: der neue Zustand.
 */
function setAufnahme(an, opt) {
  opt = opt || {};
  if (an) {
    if (!AUF.an) {
      // Nur beim ERSTEN Einschalten sichern — ein zweiter Aufruf mit anderen
      // Optionen darf die freie Ansicht nicht ueberschreiben.
      AUF.vorher = { fov: cam.tFov, dist: cam.tDist, yaw: cam.tYaw, pitch: cam.tPitch,
        x: cam.tFocus.x, z: cam.tFocus.z, hebung: cam.tHebung };
      cam.tDist = clamp(cam.tDist, AUFNAHME_VORGABE.distMin, AUFNAHME_VORGABE.distMax);
    }
    AUF.an = true;
    AUF.fov = Number.isFinite(opt.fov) ? opt.fov : AUFNAHME_VORGABE.fov;
    AUF.horizont = Number.isFinite(opt.horizont) ? opt.horizont : AUFNAHME_VORGABE.horizont;
    AUF.hebung = Number.isFinite(opt.hebung) ? opt.hebung : AUFNAHME_VORGABE.hebung;
    AUF.pitch = horizontPitch(AUF.fov, AUF.horizont);
    cam.tFov = AUF.fov;
    cam.tPitch = AUF.pitch;
    cam.tHebung = AUF.hebung;
    if (Number.isFinite(opt.dist)) cam.tDist = clamp(opt.dist, 25, 400);
    if (Number.isFinite(opt.yaw)) cam.tYaw = opt.yaw;
  } else if (AUF.an) {
    AUF.an = false;
    var v = AUF.vorher;
    if (v) {
      cam.tFov = v.fov; cam.tDist = v.dist; cam.tYaw = v.yaw; cam.tPitch = v.pitch;
      cam.tFocus.x = v.x; cam.tFocus.z = v.z; cam.tHebung = v.hebung;
    }
    AUF.vorher = null;
  }
  return AUF.an;
}

/** Laeuft der Aufnahme-Modus? Fuer PNG-Export, Knopfzustand und UI. */
function istAufnahme() { return AUF.an; }

/**
 * Richtet die komponierte Kamera so aus, dass der Weltpunkt `punkt` auf einem
 * Drittelpunkt sitzt statt in der Bildmitte. Schaltet den Modus bei Bedarf ein.
 *
 * opt.drittelX / opt.drittelY: NDC-Ziel des Motivs, Vorgabe (-1/3, -1/3) —
 * also linkes unteres Drittel, waehrend der Horizont oben auf 1/3 liegt.
 * opt.yaw: Blickrichtung; Vorgabe ist die aktuelle, das Motiv wandert dann
 * ueber die Fokusverschiebung an seinen Platz.
 *
 * Rechenweg: aus (drittelX, drittelY) folgt die Blickrichtung zum Motiv
 *   g = f + drittelX*tan(fov/2)*aspect * rechts + drittelY*tan(fov/2) * oben
 * in der Kamerabasis (f = Blickachse, rechts/oben aus yaw und pitch). Steht
 * das Motiv im Abstand t auf diesem Strahl, liegt die Kamera bei
 *   K = punkt - t*g
 * und der Blickpunkt (Bildmitte) bei
 *   L = K - dist*e     mit e = (cos p*sin yaw, sin p, cos p*cos yaw).
 * Die einzige verbleibende Unbekannte ist t; sie folgt aus der Forderung,
 * dass L genau `hebung` ueber dem Gelaende liegt. Weil g nach unten zeigt,
 * waechst L.y streng mit t — eine Bisektion findet die Loesung sicher.
 */
function aufnahmeAufMotiv(punkt, opt) {
  opt = opt || {};
  setAufnahme(true, opt);
  var nx = Number.isFinite(opt.drittelX) ? opt.drittelX : -1 / 3;
  var ny = Number.isFinite(opt.drittelY) ? opt.drittelY : -1 / 3;
  var yaw = Number.isFinite(opt.yaw) ? opt.yaw : cam.tYaw;
  var p = AUF.pitch, th = halbwinkel(AUF.fov), asp = camera.aspect || 1;
  var cp = Math.cos(p), sp = Math.sin(p), sY = Math.sin(yaw), cY = Math.cos(yaw);

  // Kamerabasis, exakt die von updateCamera erzeugte Lage:
  //   e = Fokus -> Kamera, f = Blickachse, r = rechts, u = oben
  var ex = cp * sY, ey = sp, ez = cp * cY;
  var fx = -ex, fy = -ey, fz = -ez;
  var rx = cY, rz = -sY;                       // r.y ist 0
  var ux = -sp * sY, uy = cp, uz = -sp * cY;

  var ax = nx * th * asp, ay = ny * th;
  var gx = fx + ax * rx + ay * ux;
  var gy = fy + ay * uy;                       // r.y = 0, faellt heraus
  var gz = fz + ax * rz + ay * uz;
  var gl = Math.sqrt(gx * gx + gy * gy + gz * gz) || 1;
  gx /= gl; gy /= gl; gz /= gl;

  var dist = cam.tDist;
  /* Entartungsfall: drittelY = horizont ergibt exakt den Horizontstrahl
     (gy = 0) — der trifft den Boden nie. Dann bleibt nur ein fester Abstand. */
  var t;
  if (gy > -0.01) {
    t = dist * 1.2;
  } else {
    var rest = function (tt) {
      var lx = punkt.x - tt * gx - dist * ex;
      var lz = punkt.z - tt * gz - dist * ez;
      var ly = punkt.y - tt * gy - dist * ey;
      return ly - (heightAt(lx, lz) + AUF.hebung);
    };
    var lo = 0, hi = 1600;
    if (rest(lo) > 0) { t = lo; }             // Motiv liegt schon hoch genug
    else if (rest(hi) < 0) { t = hi; }
    else {
      for (var i = 0; i < 40; i++) {
        var m = (lo + hi) * 0.5;
        if (rest(m) < 0) lo = m; else hi = m;
      }
      t = (lo + hi) * 0.5;
    }
  }

  var g = fokusGrenze();
  cam.tYaw = yaw;
  cam.tFocus.x = clamp(punkt.x - t * gx - dist * ex, -g, g);
  cam.tFocus.z = clamp(punkt.z - t * gz - dist * ez, -g, g);
  // Am Kartenrand kann die Schwenkgrenze den Fokus beschneiden; dann sitzt das
  // Motiv nicht mehr exakt auf dem Drittel. Der Rueckgabewert macht das sichtbar.
  return { abstand: t, pitch: AUF.pitch, fov: AUF.fov, hebung: AUF.hebung,
    beschnitten: Math.abs(cam.tFocus.x) >= g - 1e-6 || Math.abs(cam.tFocus.z) >= g - 1e-6 };
}

/**
 * NDC-Position eines Weltpunkts unter der KOMPONIERTEN Einstellung — die
 * Umkehrung von aufnahmeAufMotiv und die Probe, mit der sich die Drittelregel
 * nachrechnen laesst (siehe Tests). Nutzt bewusst die Zielwerte, nicht die
 * gerade laufende Interpolation.
 */
function aufnahmeNdc(punkt) {
  var p = AUF.an ? AUF.pitch : cam.tPitch, fov = AUF.an ? AUF.fov : cam.tFov;
  var th = halbwinkel(fov), asp = camera.aspect || 1;
  var cp = Math.cos(p), sp = Math.sin(p), sY = Math.sin(cam.tYaw), cY = Math.cos(cam.tYaw);
  var hebung = AUF.an ? AUF.hebung : cam.tHebung;
  var lx = cam.tFocus.x, lz = cam.tFocus.z, ly = heightAt(lx, lz) + hebung;
  var kx = lx + cam.tDist * cp * sY, ky = ly + cam.tDist * sp, kz = lz + cam.tDist * cp * cY;
  var dx = punkt.x - kx, dy = punkt.y - ky, dz = punkt.z - kz;
  var tiefe = dx * (-cp * sY) + dy * (-sp) + dz * (-cp * cY);       // dot(d, Blickachse)
  if (tiefe <= 1e-6) return null;                                   // hinter der Kamera
  var seite = dx * cY - dz * sY;                                    // dot(d, rechts)
  var hoch = dx * (-sp * sY) + dy * cp + dz * (-sp * cY);           // dot(d, oben)
  return { x: seite / tiefe / (th * asp), y: hoch / tiefe / th, tiefe: tiefe };
}

/* rayTerrain arbeitet ausschliesslich analytisch gegen das Hoehenfeld
   (heightAt), NICHT gegen Meshes — die Zerlegung des Terrains in Patches
   (H1a) laesst ihn deshalb voellig unberuehrt. Die Schrittweite (max 2400
   Welteinheiten Reichweite) deckt auch eine 1024er-Karte ab, weil der
   Strahl vom Kamerastandpunkt aus laeuft und die Kamera hoechstens
   400 Einheiten vom Fokus entfernt steht. */
export { zoomT, autoPitch, updateCamera, moveFocus, fokusGrenze, raycaster, _ndc, rayFrom,
  rayTerrain, rayPlane, groundPoint,
  setAufnahme, istAufnahme, aufnahmeAufMotiv, aufnahmeNdc, horizontPitch, halbwinkel,
  AUFNAHME_VORGABE };
