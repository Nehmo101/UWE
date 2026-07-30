import * as THREE from 'three';
import { M, mergeGeos, part } from '../assets/geometrie-hilfen.js';

const PL = THREE.PlaneGeometry;
const SP = THREE.SphereGeometry;
const TO = THREE.TorusGeometry;
const IC = THREE.IcosahedronGeometry;

const HAUT = 0x555247;
const HAUT_HELL = 0x6b6754;
const HAUT_DUNKEL = 0x292f2a;
const WANGEN_PLATTE = 0x484b40;
const HORN = 0x7f7259;
const MAUL = 0x151a17;
const LID = 0x32362e;
const AUGE = 0x11100c;
const IRIS = 0x9a7440;
const PUPILLE = 0x0a0c0a;
const GLANZ = 0xdfe7dc;

function laengsKoerperGeo(ringe) {
  if (!ringe || ringe.length < 2 ||
      ringe.some(function (ring) { return ring.punkte.length !== 8; })) {
    throw new Error('laengsKoerperGeo braucht mindestens zwei Achterprofile');
  }
  var position = [];
  function dreieck(a, b, c) {
    position.push(
      a[0], a[1], a[2],
      b[0], b[1], b[2],
      c[0], c[1], c[2]
    );
  }
  function punkt(ring, index) {
    var p = ring.punkte[index];
    return [p[0], p[1], ring.z + (p[2] || 0)];
  }
  for (var r = 0; r < ringe.length - 1; r++) {
    for (var i = 0; i < 8; i++) {
      var j = (i + 1) % 8;
      var a = punkt(ringe[r], i), b = punkt(ringe[r], j);
      var c = punkt(ringe[r + 1], j), d = punkt(ringe[r + 1], i);
      dreieck(a, b, c);
      dreieck(a, c, d);
    }
  }
  // Die Kappen bestehen aus horizontalen Stirn-, Schlaefen- und
  // Kieferstreifen. Es gibt bewusst keinen Mittelpunkt und keinen Sternfaecher.
  var streifen = [
    [0, 1, 7],
    [1, 2, 6], [1, 6, 7],
    [2, 3, 5], [2, 5, 6],
    [3, 4, 5]
  ];
  var hinten = ringe[0], vorn = ringe[ringe.length - 1];
  for (var s = 0; s < streifen.length; s++) {
    var t = streifen[s];
    dreieck(punkt(vorn, t[0]), punkt(vorn, t[1]), punkt(vorn, t[2]));
    dreieck(punkt(hinten, t[0]), punkt(hinten, t[2]), punkt(hinten, t[1]));
  }
  var geometrie = new THREE.BufferGeometry();
  geometrie.setAttribute('position',
    new THREE.BufferAttribute(new Float32Array(position), 3));
  geometrie.computeVertexNormals();
  return geometrie;
}

/**
 * Ein duennes Band entlang einer Punktfolge — die Maulnaht. Jedes Segment ist
 * ein vertikales Baendchen; die Folge darf frei um die Schnauze herumlaufen.
 */
function maulnahtGeo(punkte, halbeDicke) {
  var position = [];
  for (var i = 0; i < punkte.length - 1; i++) {
    var a = punkte[i], b = punkte[i + 1];
    position.push(
      a.x, a.y - halbeDicke, a.z,
      b.x, b.y - halbeDicke, b.z,
      b.x, b.y + halbeDicke, b.z,
      a.x, a.y - halbeDicke, a.z,
      b.x, b.y + halbeDicke, b.z,
      a.x, a.y + halbeDicke, a.z
    );
  }
  var geometrie = new THREE.BufferGeometry();
  geometrie.setAttribute('position',
    new THREE.BufferAttribute(new Float32Array(position), 3));
  geometrie.computeVertexNormals();
  return geometrie;
}

/**
 * Eine kontinuierliche Spline-Roehre ohne sichtbare Zylindernaehte. Die
 * parallel transportierten Rahmen verhindern verdrehte Ringe in der S-Kurve.
 */
function taperedTube(punkte, breiten, tiefen, laengsSegmente, radialSegmente) {
  if (punkte.length !== breiten.length || punkte.length !== tiefen.length ||
      punkte.length < 2) {
    throw new Error('taperedTube braucht Punkte sowie Breiten- und Tiefenradien');
  }
  var kurve = new THREE.CatmullRomCurve3(
    punkte.map(function (punkt) { return punkt.clone(); }),
    false,
    'centripetal'
  );
  var tangenten = [], ringNormalen = [], binormalen = [];
  var ring, t;
  for (ring = 0; ring <= laengsSegmente; ring++) {
    t = ring / laengsSegmente;
    tangenten.push(kurve.getTangentAt(t, new THREE.Vector3()).normalize());
  }
  var anfang = tangenten[0];
  var ax = Math.abs(anfang.x), ay = Math.abs(anfang.y), az = Math.abs(anfang.z);
  var hilfsAchse = new THREE.Vector3(1, 0, 0);
  if (ay <= ax && ay <= az) hilfsAchse.set(0, 1, 0);
  else if (az <= ax && az <= ay) hilfsAchse.set(0, 0, 1);
  var quer = new THREE.Vector3().crossVectors(anfang, hilfsAchse).normalize();
  ringNormalen[0] = new THREE.Vector3().crossVectors(anfang, quer).normalize();
  binormalen[0] = new THREE.Vector3()
    .crossVectors(anfang, ringNormalen[0]).normalize();
  for (ring = 1; ring <= laengsSegmente; ring++) {
    ringNormalen[ring] = ringNormalen[ring - 1].clone();
    var drehAchse = new THREE.Vector3()
      .crossVectors(tangenten[ring - 1], tangenten[ring]);
    if (drehAchse.lengthSq() > 1e-10) {
      drehAchse.normalize();
      var winkel = Math.acos(Math.max(-1, Math.min(1,
        tangenten[ring - 1].dot(tangenten[ring]))));
      ringNormalen[ring].applyAxisAngle(drehAchse, winkel).normalize();
    }
    binormalen[ring] = new THREE.Vector3()
      .crossVectors(tangenten[ring], ringNormalen[ring]).normalize();
  }

  var ringBreite = radialSegmente + 1;
  var vertexAnzahl = (laengsSegmente + 1) * ringBreite;
  var position = new Float32Array(vertexAnzahl * 3);
  var normalen = new Float32Array(vertexAnzahl * 3);
  var uv = new Float32Array(vertexAnzahl * 2);
  var indizes = [];
  var mitte = new THREE.Vector3();
  for (ring = 0; ring <= laengsSegmente; ring++) {
    t = ring / laengsSegmente;
    kurve.getPointAt(t, mitte);
    var verlauf = t * (breiten.length - 1);
    var radiusIndex = Math.min(breiten.length - 2, Math.floor(verlauf));
    var mischung = verlauf - radiusIndex;
    mischung = mischung * mischung * (3 - 2 * mischung);
    var breite = THREE.MathUtils.lerp(
      breiten[radiusIndex], breiten[radiusIndex + 1], mischung
    );
    var tiefe = THREE.MathUtils.lerp(
      tiefen[radiusIndex], tiefen[radiusIndex + 1], mischung
    );
    for (var seite = 0; seite <= radialSegmente; seite++) {
      var v = seite / radialSegmente;
      var bogen = v * Math.PI * 2;
      var cos = Math.cos(bogen), sin = Math.sin(bogen);
      var px = ringNormalen[ring].x * cos * breite
        + binormalen[ring].x * sin * tiefe;
      var py = ringNormalen[ring].y * cos * breite
        + binormalen[ring].y * sin * tiefe;
      var pz = ringNormalen[ring].z * cos * breite
        + binormalen[ring].z * sin * tiefe;
      var nx = ringNormalen[ring].x * cos / breite
        + binormalen[ring].x * sin / tiefe;
      var ny = ringNormalen[ring].y * cos / breite
        + binormalen[ring].y * sin / tiefe;
      var nz = ringNormalen[ring].z * cos / breite
        + binormalen[ring].z * sin / tiefe;
      var nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      var vertex = ring * ringBreite + seite;
      position[vertex * 3] = mitte.x + px;
      position[vertex * 3 + 1] = mitte.y + py;
      position[vertex * 3 + 2] = mitte.z + pz;
      normalen[vertex * 3] = nx / nl;
      normalen[vertex * 3 + 1] = ny / nl;
      normalen[vertex * 3 + 2] = nz / nl;
      uv[vertex * 2] = t;
      uv[vertex * 2 + 1] = v;
    }
  }
  for (ring = 1; ring <= laengsSegmente; ring++) {
    for (var kante = 1; kante <= radialSegmente; kante++) {
      var a = (ring - 1) * ringBreite + kante - 1;
      var b = ring * ringBreite + kante - 1;
      var c = ring * ringBreite + kante;
      var d = (ring - 1) * ringBreite + kante;
      indizes.push(a, d, b, b, d, c);
    }
  }
  var geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normalen, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(indizes);
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

function setzeKopfVertrag(geometrie) {
  var daten = geometrie.userData;
  daten.terraHalsLaengenFaktor = 1.22;
  daten.terraKopfMassstab = 1.36;
  daten.terraKopfLaengenFaktor = 1.31;
  daten.terraKopfSchwereFaktor = 1.17;
  daten.terraKopfNeigungGrad = 10;
  daten.terraKopfForm = 'runder-schaedel-freundlicher-hornschnabel';
  daten.terraSchaedelSilhouette = 'gewoelbte-stirn-hinten-breit-stumpfer-schnabel';
  daten.terraSchaedelplatten = 5;
  daten.terraSchaedelVerjuengung = 0.37;
  daten.terraBrauenplatten = 2;
  daten.terraBrauenUeberstand = 0.14;
  daten.terraWangenplatten = 2;
  daten.terraWangenUeberstand = 0;
  daten.terraAugenFlaechenFaktor = 0.42;
  daten.terraAugenWeissanteil = 0;
  daten.terraAugenLichtpunkt = 'klein-oben-vorn';
  daten.terraAugenLage = 'seitlich-hoch-vor-schlaefe';
  daten.terraAugenFrontsicht = 'dreiviertel-sichtbar';
  daten.terraAugenAufbau = 'lidring-augapfel-iris-pupille-glanzpunkt';
  daten.terraSchnabelProfil = 'stumpfer-durchgehender-hornkeil';
  daten.terraMaulnaht = 'laechelnd-seitlich-ansteigend';
  daten.terraMaulnahtSegmente = 10;
  daten.terraNasenloecher = 'zwei-kleine-schraege-schlitze';
  daten.terraNackenVerzahnung = 'hinterhaupt-kiefermuskel-kehlschild';
  daten.terraHalsFalten = 0;
  daten.terraKehlSchuppen = 'keine-aufgesetzte-zusatzgeometrie';
  daten.terraHalsSeitenschilde = 0;
  daten.terraHalsQuerschnitt = 'elliptisch';
  daten.terraHalsSForm = 'ausgepraegt';
  daten.terraHalsTopologie = 'catmull-rom-tube';
  daten.terraHalsSplinePunkte = 8;
  daten.terraHalsSegmente = 24;
  daten.terraHalsRinge = 25;
  daten.terraHalsRadialSegmente = 12;
  daten.terraHalsKontinuierlich = true;
  daten.terraStatischeGeometrie = true;
}

/**
 * Monumentaler Landschildkroeten-Kopf. Alle anatomischen Teile werden zu
 * einer statischen BufferGeometry verschmolzen und bleiben damit ein Drawcall.
 *
 * Gesichtsrunde: der Schaedel ist jetzt ein GESICHT — gewoelbte Stirn,
 * grosse, seitlich-hohe Augen mit Lidring, Iris und Glanzpunkt (im
 * Dreiviertelblick klar lesbar), eine laechelnd ansteigende Maulnaht wie bei
 * einer echten Landschildkroete und ein weiches Kinn, das den Unterkiefer in
 * den Hals uebergehen laesst.
 */
export function baueWeltschildkroetenKopf() {
  var p = [], i;
  // Ausgepraegte S-Linie: erst zur Brust zurueck, dann mit langem Bogen nach
  // vorn. Getrennte Breiten- und Tiefenradien erzeugen den flachen,
  // muskuloesen Hals einer Landschildkroete statt einer runden Schlangenroehre.
  var halsPunkte = [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 1.45, -0.58),
    new THREE.Vector3(0, 3.05, -1.28),
    new THREE.Vector3(0, 4.82, -1.12),
    new THREE.Vector3(0, 6.58, -0.28),
    new THREE.Vector3(0, 8.12, 1.18),
    new THREE.Vector3(0, 9.38, 3.18),
    new THREE.Vector3(0, 10.08, 5.12)
  ];
  var halsBreiten = [2.65, 2.52, 2.35, 2.15, 1.94, 1.8, 1.67, 1.58];
  var halsTiefen = [2.25, 2.12, 1.96, 1.82, 1.63, 1.49, 1.36, 1.28];
  p.push(part(taperedTube(
    halsPunkte, halsBreiten, halsTiefen, 24, 12
  ), M(), HAUT));

  // Der gesamte Schaedel kippt um zehn Grad nach vorn. Dadurch sitzt er am
  // Hinterhaupt hoch und schwer, waehrend Schnabel und Kinn leicht absinken.
  var kopfNeigung = new THREE.Matrix4()
    .makeTranslation(0, 10.08, 5.12)
    .multiply(new THREE.Matrix4().makeRotationX(Math.PI / 18))
    .multiply(new THREE.Matrix4().makeTranslation(0, -10.08, -5.12));
  function kopfTeil(geo, matrix, farbe) {
    return part(geo, kopfNeigung.clone().multiply(matrix || M()), farbe);
  }

  // Fuenf laengs gestaffelte Achterprofile: rundes Hinterhaupt, gewoelbte
  // Stirnkuppel, Augenlinie, Schnauzenbasis und Schnauzenende. Die Kappen
  // sind streifenweise trianguliert — kein Mittelpunkt, kein Sternfaecher.
  var schaedel = laengsKoerperGeo([
    { z: -1.85, punkte: [
      [0, 1.16], [-1.6, 1.0], [-2.38, 0.3], [-1.98, -0.74],
      [0, -1.08], [1.98, -0.74], [2.38, 0.3], [1.6, 1.0]
    ] },
    { z: -0.85, punkte: [
      [0, 1.54], [-1.88, 1.3], [-2.48, 0.34], [-2.1, -0.92],
      [0, -1.22], [2.1, -0.92], [2.48, 0.34], [1.88, 1.3]
    ] },
    { z: 0.35, punkte: [
      [0, 1.36], [-1.64, 1.14], [-2.06, 0.26], [-1.72, -0.86],
      [0, -1.06], [1.72, -0.86], [2.06, 0.26], [1.64, 1.14]
    ] },
    { z: 1.5, punkte: [
      [0, 0.8], [-1.06, 0.63], [-1.4, 0.12], [-1.2, -0.62],
      [0, -0.78], [1.2, -0.62], [1.4, 0.12], [1.06, 0.63]
    ] },
    { z: 2.5, punkte: [
      [0, 0.44], [-0.82, 0.36], [-1.06, 0.05], [-0.96, -0.52],
      [0, -0.64], [0.96, -0.52], [1.06, 0.05], [0.82, 0.36]
    ] }
  ]);
  p.push(kopfTeil(schaedel, M(0, 10.42, 6.35), HAUT));

  // Nur die stumpfe Endkappe ist Horn. Die lange Schnauze bleibt Teil des
  // Hautschaedels; der Hornkeil rundet vorn weich ab statt zu einer Kante
  // auszulaufen — die freundliche, stumpfe Nase einer Landschildkroete.
  var schnabel = laengsKoerperGeo([
    { z: -0.35, punkte: [
      [0, 0.42], [-0.8, 0.36], [-1.08, 0.06], [-0.98, -0.54],
      [0, -0.62], [0.98, -0.54], [1.08, 0.06], [0.8, 0.36]
    ] },
    { z: 0.32, punkte: [
      [0, 0.18, 0.05], [-0.62, 0.24], [-0.78, 0.03, -0.03],
      [-0.68, -0.42, -0.13], [0, -0.5, -0.16],
      [0.68, -0.42, -0.13], [0.78, 0.03, -0.03], [0.62, 0.24]
    ] }
  ]);
  p.push(kopfTeil(schnabel, M(0, 10.34, 9.2), HORN));

  // Der Unterkiefer bleibt deutlich hinter der Hornspitze; ein weiches Kinn
  // und eine Kehlwoelbung lassen ihn in den Hals uebergehen statt frei zu
  // schweben.
  var unterkiefer = laengsKoerperGeo([
    { z: -0.95, punkte: [
      [0, 0.34], [-0.88, 0.29], [-1.22, 0.05], [-1.08, -0.3],
      [0, -0.4], [1.08, -0.3], [1.22, 0.05], [0.88, 0.29]
    ] },
    { z: 0.55, punkte: [
      [0, 0.22], [-0.5, 0.18], [-0.72, 0.03], [-0.63, -0.22],
      [0, -0.3], [0.63, -0.22], [0.72, 0.03], [0.5, 0.18]
    ] }
  ]);
  p.push(kopfTeil(unterkiefer, M(0, 9.83, 8.45), WANGEN_PLATTE));
  p.push(kopfTeil(new SP(1, 12, 8),
    M(0, 9.5, 7.75, 0, 0, 0, 0.74, 0.46, 0.95), WANGEN_PLATTE));

  // Laechelnde Maulnaht: vorn ein kurzer Spalt unter der Hornkappe, seitlich
  // eine lange, zu den Mundwinkeln hin ANSTEIGENDE Linie — das klassische
  // Schildkroetenlaecheln, im Profil wie im Dreiviertelblick lesbar.
  var laecheln = [
    new THREE.Vector3(-1.74, 10.24, 7.3),
    new THREE.Vector3(-1.58, 10.08, 7.78),
    new THREE.Vector3(-1.36, 9.97, 8.2),
    new THREE.Vector3(-1.02, 9.9, 8.66),
    new THREE.Vector3(-0.62, 9.86, 9.1),
    new THREE.Vector3(0, 9.84, 9.42),
    new THREE.Vector3(0.62, 9.86, 9.1),
    new THREE.Vector3(1.02, 9.9, 8.66),
    new THREE.Vector3(1.36, 9.97, 8.2),
    new THREE.Vector3(1.58, 10.08, 7.78),
    new THREE.Vector3(1.74, 10.24, 7.3)
  ];
  p.push(kopfTeil(maulnahtGeo(laecheln, 0.03), M(), MAUL));

  for (i = -1; i <= 1; i += 2) {
    // Blickrichtung des Auges: seitlich-hoch, leicht nach vorn — im
    // Dreiviertelblick voll sichtbar, frontal als schmale Mandel.
    var augRy = i * 1.02;
    var augRx = -0.14;
    var ax = i * 1.82, ay = 11.0, az = 6.92;
    var nx = Math.sin(augRy) * Math.cos(augRx);
    var ny = -Math.sin(augRx);
    var nz = Math.cos(augRy) * Math.cos(augRx);

    // Lidring: ein flacher Torus fasst das Auge wie ein wulstiges Lid.
    p.push(kopfTeil(new TO(0.4, 0.095, 7, 14),
      M(ax, ay, az, augRx, augRy, 0, 1, 0.92, 1), LID));
    // Augapfel als dunkle Kuppel im Lidring.
    p.push(kopfTeil(new SP(1, 12, 8),
      M(ax - nx * 0.05, ay - 0.02, az - nz * 0.05,
        augRx, augRy, 0, 0.36, 0.32, 0.26), AUGE));
    // Warme Iris und tiefe Pupille als flache Kuppeln auf dem Augapfel.
    p.push(kopfTeil(new SP(1, 10, 7),
      M(ax + nx * 0.17, ay + ny * 0.17 - 0.01, az + nz * 0.17,
        augRx, augRy, 0, 0.21, 0.19, 0.07), IRIS));
    p.push(kopfTeil(new SP(1, 9, 6),
      M(ax + nx * 0.225, ay + ny * 0.225 - 0.01, az + nz * 0.225,
        augRx, augRy, 0, 0.115, 0.105, 0.05), PUPILLE));
    // Kleiner Glanzpunkt oben-vorn: er macht das Auge lebendig.
    p.push(kopfTeil(new SP(1, 8, 6),
      M(ax + nx * 0.23 + i * 0.03, ay + 0.09, az + nz * 0.23 + 0.05,
        0, 0, 0, 0.05, 0.045, 0.035), GLANZ));

    // Brauenwulst ueber dem Auge: der wache, freundliche Ausdruck einer
    // alten Landschildkroete — er ueberragt das Lid leicht.
    p.push(kopfTeil(new IC(1, 0),
      M(i * 1.72, 11.42, 6.72, 0.12, i * 0.5, -i * 0.26, 0.58, 0.2, 0.4),
      HAUT_HELL));
    // Wangenschuppe unterhalb des Auges, flach anliegend.
    p.push(kopfTeil(new SP(1, 9, 6),
      M(i * 1.95, 10.3, 6.35, 0, augRy, 0, 0.34, 0.28, 0.07),
      WANGEN_PLATTE));

    // Winzige, schraege Schlitznasen oben auf der stumpfen Hornkappe.
    p.push(kopfTeil(new PL(0.07, 0.028),
      M(i * 0.17, 10.55, 9.47, -0.85, 0, i * 0.5), MAUL));
  }

  var geometrie = mergeGeos(p);
  setzeKopfVertrag(geometrie);
  return geometrie;
}
