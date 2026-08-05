// Einstieg: verdrahtet Module, baut die Startkarte, treibt die Renderschleife.
import { DEG, hashi } from './core/rng.js';
import { S, HALF, VW, setScene, mkElement, nextSeed } from './core/store.js';
import { scene, initPipeline, resizePipeline, renderFrame, getRenderInfo, tickLeistung, setPalette, setMultiplane, PALETTE_STANDARD } from './render/pipeline.js';
import { camera, cam, initKeys, updateCamera, moveFocus } from './editor/camera.js';
import { base, genBase, initTerrain, heightAt, slopeAt, refreshTerrainFull, basisGeaendert } from './world/terrain.js';
import './generators/geometry.js';        // registriert alle Objekt-Pools
import { setRauchSammler, flushPack } from './core/pools.js';
import { POOLS } from './core/pools.js';
import { rebuildAll } from './core/dirty.js';
import { initWater, wasserSichtbar, updateWater, water } from './world/water.js';
// Bedienungsrunde: die Uhr der Fluss-Fliessanimation (Shader-Patch an
// flussMat). paths.js liegt laengst im Modulgraphen (geometry.js zieht es).
import { setFlussZeit } from './generators/paths.js';
import { tickFlugrouten } from './generators/flugrouten.js';
import { initSky, updateSky } from './world/sky.js';
import { initAtmosphere, setTod, setWetter, tickAtmosphere, updateBirds, updateRauch, setRauchQuellen, getWolkenTempo } from './world/atmosphere.js';
import { initVfx, tickVfx } from './world/vfx.js';
import { initSelection, updateHandlePositions, beschriftungenAktualisieren } from './editor/selection.js';
import { defaultsFor } from './editor/tools.js';
import { initPointer, verarbeiteZeiger, onKey } from './editor/pointer.js';
import { initPanels, buildRail, buildPanel, updateHint, updateStats, tickToast, markerOverlayAktualisieren } from './ui/panels.js';
import { initIO, palettePassend, setzeKartenGroesseFuerSchau } from './editor/io.js';
// I3: Erosion laeuft ueber mehrere Bilder und braucht deshalb einen Takt.
import { tickErosion } from './editor/erosion-lauf.js';
// I4: die Beschriftungsschicht. In die Szene gehaengt wird sie in
// initSelection, hier braucht die Bildschleife nur das Nachziehen.
import { holeBeschriftungsschicht } from './ui/beschriftung.js';
var beschriftungen = holeBeschriftungsschicht();
var letzterBeschriftungsAbgleich = -1e9;
import { tickWind } from './world/wind.js';
import { tickWeltschildkroeten } from './generators/weltschildkroete.js';
import { tickWeltschloesser } from './generators/weltschloss.js';
import { ladeExterneAssets } from './assets/external-assets.js';
import { ARCHITEKTUR_STILE, architekturAssetId } from './assets/architektur-katalog.js';
import { erstelleLuftschauPlan } from './generators/luftschau.js';
import {
  ASSET_SCHAU_KARTENGROESSE,
  baueAssetSchauLayout,
  erzeugeAssetSchau
} from './generators/asset-schau.js';

var SCHAU_PARAM = new URLSearchParams(window.location.search);
var SCHAU_MODUS = SCHAU_PARAM.get("schau");
var SCHAU_BLICK = SCHAU_PARAM.get("blick");
var SCHAU_FOKUS = SCHAU_PARAM.get("terraFocus") ||
  (SCHAU_BLICK === "baum" ? "baum" : null);

/* ==========================================================================
   Startkarte (unveraendert portiert — gleiche Seed, gleiche Karte)
   ========================================================================== */
/** Sucht in der Nähe einen brauchbaren Bauplatz (Land, flach genug). */
function findLand(cx, cz, minH, maxH) {
  for (var r = 0; r <= 90; r += 5) {
    for (var a = 0; a < 16; a++) {
      var ang = a / 16 * Math.PI * 2 + r * 0.3;
      var x = cx + Math.cos(ang) * r, z = cz + Math.sin(ang) * r;
      if (x < -HALF + 20 || x > HALF - 20 || z < -HALF + 20 || z > HALF - 20) continue;
      var h = heightAt(x, z);
      if (h < minH || h > maxH) continue;
      if (slopeAt(x, z) < Math.cos(18 * DEG)) continue;
      return { x: Math.round(x), z: Math.round(z) };
    }
  }
  return { x: cx, z: cz };
}

function addEl(kind, variant, points, over) {
  var p = defaultsFor(kind, variant);
  if (over) for (var k in over) p[k] = over[k];
  var e = mkElement(kind, variant, points, p, nextSeed());
  S.elements.push(e);
  return e;
}

function ring(c, r, n, wob, seed) {
  var out = [];
  for (var i = 0; i < n; i++) {
    var a = i / n * Math.PI * 2;
    var rr2 = r * (1 + (hashi(i, 0, seed) - 0.5) * wob);
    out.push({ x: Math.round(c.x + Math.cos(a) * rr2), z: Math.round(c.z + Math.sin(a) * rr2) });
  }
  return out;
}

/**
 * Reproduzierbare Katalogansicht fuer visuelle Regressionen. Sie bleibt ueber
 * `?schau=architektur` erreichbar, ohne die normale Startkarte anzutasten.
 */
function architekturSchauMap() {
  document.body.classList.add("architektur-schaukasten");
  var rollen = [
    ["wohnhaus", -6, 4, 1.50],
    ["rathaus", 0, 0, 1.36],
    ["palast", 7, -3, 1.18]
  ];
  for (var i = 0; i < ARCHITEKTUR_STILE.length; i++) {
    var stil = ARCHITEKTUR_STILE[i];
    var spalte = i % 4, zeile = Math.floor(i / 4);
    var ziel = findLand(-62 + spalte * 36, -32 + zeile * 32, 1.5, 15);
    for (var r = 0; r < rollen.length; r++) {
      var rolle = rollen[r];
      var bauplatz = findLand(ziel.x + rolle[1], ziel.z + rolle[2], 1.5, 15);
      addEl("objekt", stil.id, [{ x: bauplatz.x, z: bauplatz.z }], {
        anzahl: 1, streuung: 0, groesse: rolle[3], frei: true,
        nurTyp: architekturAssetId(stil.id, rolle[0])
      });
    }
    addEl("marker", "beschriftung", [{ x: ziel.x, z: ziel.z + 7 }],
      { text: stil.label, klasse: "ort", groesse: 1.70 });
  }
  return { x: -8, z: 12, dist: 160, pitch: 48 * DEG, yaw: 0 };
}

/** Kleine Beispielkarte, damit beim Öffnen sofort etwas zu sehen ist. */
/**
 * Die Vollkatalogkarte braucht ruhigen, trockenen Boden: auf dem normalen
 * Seed-Terrain verschwanden sonst ausgerechnet kleine Requisiten im Wasser.
 * Eine minimale breite Welle verhindert zugleich den Eindruck einer
 * technischen grauen Testplatte.
 */
function assetSchauGelaende() {
  for (var j = 0; j < VW; j++) {
    for (var i = 0; i < VW; i++) {
      base[j * VW + i] = 5.6 + Math.sin(i * 0.045) * 0.12
        + Math.cos(j * 0.038) * 0.12;
    }
  }
  basisGeaendert(0, VW - 1, 0, VW - 1);
}

/**
 * Museumskarte fuer die Abnahme: jeder der 505 physischen Pools genau einmal,
 * die animierte Landschildkroete als zusaetzliche Hero-Landmarke daneben.
 */
function assetSchauMap() {
  document.body.classList.add("asset-schaukasten");
  document.title = "terra - vollstaendige Asset-Schau (505/505)";
  var legende = document.createElement("aside");
  legende.className = "assetSchauLegende";
  legende.innerHTML = "<strong>Asset-Schau &middot; 505 / 505</strong>"
    + "<span>12 &times; 18 Architektur &middot; 289 Umwelt-, Kultur- und Weltassets</span>";
  document.body.appendChild(legende);
  if (SCHAU_FOKUS) {
    // Der Fokusmodus erzeugt nur das Zielasset. Dadurch wird weder Geometrie
    // der 504 Nachbarn gepackt noch ein riesiges Galerie-Terrain benoetigt.
    var ganzesLayout = baueAssetSchauLayout();
    var fokusQuelle = ganzesLayout.placements.find(function (p) {
      return p.name === SCHAU_FOKUS;
    });
    if (!fokusQuelle) throw new Error("Unbekanntes Fokusasset: " + SCHAU_FOKUS);
    var fokusPlatz = Object.assign({}, fokusQuelle, { x: 0, y: 0, z: 0 });
    erzeugeAssetSchau({ hoeheAn: heightAt, markiere: false, layout: {
      version: ganzesLayout.version,
      placements: [fokusPlatz],
      blocks: [],
      bounds: { minX: -8, maxX: 8, minZ: -8, maxZ: 8 },
      counts: { physical: 1, architecture: 0, other: 1 }
    } });
    legende.innerHTML = "<strong>Asset-Fokus &middot; " + SCHAU_FOKUS + "</strong>"
      + "<span>Silhouette &middot; Formaufbau &middot; Material &middot; Laufzeit</span>";
    var fokusPool = POOLS[SCHAU_FOKUS];
    fokusPool.geo.computeBoundingBox();
    var fokusBox = fokusPool.geo.boundingBox;
    var fokusBreite = (fokusBox.max.x - fokusBox.min.x) * fokusPlatz.scale;
    var fokusHoehe = (fokusBox.max.y - fokusBox.min.y) * fokusPlatz.scale;
    var fokusTiefe = (fokusBox.max.z - fokusBox.min.z) * fokusPlatz.scale;
    var fokusSpanne = Math.max(fokusBreite, fokusHoehe * 1.12, fokusTiefe * 0.72);
    return { x: 0, z: 0, dist: Math.max(5.8, fokusSpanne * 2.35),
      pitch: 18 * DEG, yaw: 0.48, fov: 30,
      hebung: Math.max(0.8, fokusHoehe * 0.48) };
  }
  var schau = erzeugeAssetSchau({ hoeheAn: heightAt, markiere: false });
  var archBlock = schau.layout.blocks[0];
  var heroX = archBlock.minX - 40;
  var heroZ = archBlock.maxZ - 35;
  addEl("objekt", "weltschildkroete", [{ x: heroX, z: heroZ }], {
    groesse: 0.96,
    drehung: 112,
    kopfbewegung: 0.78
  });
  var familienBlock = SCHAU_BLICK !== "architektur" &&
    schau.layout.blocks.find(function (b) { return b.id === SCHAU_BLICK; });
  if (familienBlock) {
    legende.innerHTML = "<strong>Asset-Familie &middot; " + familienBlock.label + "</strong>"
      + "<span>" + familienBlock.count + " Pools &middot; identische Abnahmekamera</span>";
    return { x: (familienBlock.minX + familienBlock.maxX) / 2,
      z: (familienBlock.minZ + familienBlock.maxZ) / 2,
      dist: Math.max(familienBlock.maxX - familienBlock.minX,
        familienBlock.maxZ - familienBlock.minZ) * 1.32,
      pitch: 48 * DEG, yaw: 0.08, fov: 31 };
  }
  if (SCHAU_BLICK === "architektur") {
    return { x: 0, z: -82, dist: 255, pitch: 50 * DEG, yaw: 0, fov: 31 };
  }
  if (SCHAU_BLICK === "welt-links") {
    return { x: -112, z: 103, dist: 190, pitch: 46 * DEG, yaw: 0, fov: 31 };
  }
  if (SCHAU_BLICK === "welt-rechts") {
    return { x: 108, z: 103, dist: 190, pitch: 46 * DEG, yaw: 0, fov: 31 };
  }
  if (SCHAU_BLICK === "held") {
    return {
      x: heroX + 1.8, z: heroZ - 0.8, dist: 76, pitch: 29 * DEG,
      yaw: 0.46, fov: 31, hebung: 7.5
    };
  }
  if (SCHAU_BLICK === "kopf") {
    // Freier Dreiviertelblick knapp unter Augenhoehe: Die Laengsform des
    // Schaedelprofils bleibt sichtbar und die Burgtuerme rahmen nicht das Gesicht.
    return {
      x: heroX + 12.35, z: heroZ - 5.0, dist: 27, pitch: -2 * DEG,
      yaw: 150 * DEG, fov: 25, hebung: 14.25
    };
  }

  return {
    x: 0,
    z: 0,
    dist: 400,
    pitch: 60 * DEG,
    yaw: 0,
    fov: 35
  };
}

function luftSchauMap() {
  document.title = "terra - Luftarchipel, Flugrouten und Riesenbambus";
  var plan = erstelleLuftschauPlan();
  for (var i = 0; i < plan.elements.length; i++) {
    var spec = plan.elements[i];
    addEl(spec.kind, spec.variant, spec.points, spec.params);
  }
  return plan.kamera;
}

function demoMap() {
  // Blickrichtung der Startkamera, damit die Komposition sofort sitzt
  if (SCHAU_MODUS === "assets") return assetSchauMap();
  if (SCHAU_MODUS === "luft") return luftSchauMap();
  if (SCHAU_MODUS === "architektur") {
    return architekturSchauMap();
  }
  var vx = -Math.sin(0.85), vz = -Math.cos(0.85);      // vom Fokus weg
  var px = -vz, pz = vx;                                // quer dazu

  var town = findLand(20, 20, 2.5, 11);
  function bei(f, q, lo, hi) {
    return findLand(town.x + vx * f + px * q, town.z + vz * f + pz * q, lo, hi);
  }
  var v1 = bei(96, -8, 1.5, 15);
  var v2 = bei(150, 78, 1.5, 15);
  var wood = bei(40, 78, 1.5, 13);
  var field = bei(-30, 62, 1.5, 9);
  var meadow = bei(55, -70, 1.5, 9);
  var klass = bei(-46, -52, 2.5, 12);
  var zwerg = bei(78, -46, 3, 16);
  var elfen = bei(30, 104, 2, 12);
  var schild = bei(12, -34, 2.5, 12);
  var bluetenhain = findLand(schild.x - 32, schild.z + 23, 1.5, 13);

  addEl("ranke", "ranke", [{ x: v1.x, z: v1.z }],
    { hoehe: 215, straenge: 5, plateaus: 3, staedtchen: true, inseln: 2 });
  addEl("ranke", "ranke", [{ x: v2.x, z: v2.z }],
    { hoehe: 145, straenge: 5, plateaus: 2, staedtchen: true, inseln: 1 });

  addEl("pfad", "strasse", [
    { x: v1.x + 16, z: v1.z + 10 },
    { x: (v1.x + town.x) / 2 + 10, z: (v1.z + town.z) / 2 - 8 },
    { x: town.x - 6, z: town.z - 4 },
    { x: town.x + 44, z: town.z + 22 }
  ], { breite: 6, abstand: 15, haeuser: true, stil: "windweiden" });

  // vier Siedlungen in vier Baustilen
  addEl("flaeche", "viertel", ring(town, 30, 9, 0.26, 11),
    { netz: "gebogen", block: 21, gasse: 3.5, dichte: 1.25, stil: "windweiden" });
  addEl("flaeche", "viertel", ring(klass, 24, 8, 0.2, 71),
    { netz: "raster", block: 20, gasse: 4, dichte: 1.1, stil: "pilzmarken", drehung: 40 });
  addEl("flaeche", "viertel", ring(zwerg, 20, 7, 0.24, 83),
    { netz: "zellen", block: 17, gasse: 4, dichte: 1.2, stil: "tiefenzwerge" });
  addEl("flaeche", "viertel", ring(elfen, 22, 8, 0.28, 97),
    { netz: "ring", block: 16, gasse: 3, dichte: 1.0, stil: "mondelfen" });

  addEl("flaeche", "biom", ring(schild, 48, 12, 0.22, 107),
    { biom: "bluetental", weich: 14 });
  addEl("flaeche", "wald", ring(wood, 44, 11, 0.3, 23), { dichte: 1.3, mischung: 0.28 });
  addEl("flaeche", "feld", ring(field, 28, 7, 0.2, 41), { drehung: 55, reihe: 3.2 });
  addEl("flaeche", "wiese", ring(meadow, 26, 8, 0.25, 57), { dichte: 1.4, blumen: 0.45 });
  addEl("flaeche", "wiese", ring(schild, 40, 10, 0.24, 67),
    { dichte: 1.2, blumen: 0.62 });
  addEl("objekt", "baeume", [{ x: bluetenhain.x, z: bluetenhain.z }],
    { anzahl: 5, streuung: 14, groesse: 0.94, frei: false, nurTyp: "bluetenbaum" });
  addEl("pfad", "hecke", [
    { x: field.x - 26, z: field.z + 26 },
    { x: field.x + 8, z: field.z + 34 },
    { x: field.x + 38, z: field.z + 22 }
  ], { stil: "hecke" });
  addEl("objekt", "haeuser", [{ x: field.x + 20, z: field.z - 14 }],
    { anzahl: 1, streuung: 0, groesse: 1.15, frei: false, nurTyp: "windmuehle" });
  addEl("objekt", "weltschildkroete", [{ x: schild.x, z: schild.z }],
    { groesse: 1.2, drehung: 145, kopfbewegung: 0.82 });

  return { x: town.x + vx * 28, z: town.z + vz * 28, dist: 124, pitch: 36 * DEG };
}


/* ==========================================================================
   Initialisierung in expliziter Reihenfolge
   ========================================================================== */
setScene(scene);
const renderer = initPipeline(camera);
/* Ghibli-Bildaufbau (F1-F3) fuer NEUE Karten einschalten. Die Setter stehen
   ab Werk auf 0, damit der Pass byteidentisch bleibt, solange niemand ihn
   ruft — sichtbar wird der Look aber erst hier. Geladene Karten ueber-
   schreiben die Werte gleich wieder aus ihren eigenen Feldern; fehlen sie
   (Dateien vor dieser Runde), setzt io.js auf 0 und die Karte sieht exakt so
   aus wie frueher. Werte bewusst zurueckhaltend: die Bindung soll das Bild
   auf eine Palette ziehen, nicht postern. */
// 0.5 nahm in der Sichtpruefung sichtbar Kontrast (Mittag wirkte wie durch
// Milchglas); 0.42 staffelt Vorder-, Mittel- und Hintergrund noch klar.
setMultiplane(SCHAU_MODUS === "assets" ? 0.12 : 0.42);
// Die Farbrampe kommt aus dem Biom (palettePassend in io.js) — die
// Standardrampe hier waere biomblind und zoege dunkle Biome Richtung Creme.
setPalette(PALETTE_STANDARD, 0.20);
initTerrain(scene);
initWater(scene);
initSky(scene);
initAtmosphere(scene);
// VFX nach der Atmosphaere: initAtmosphere verdrahtet #wetterSel, setWetter()
// weiter unten schreibt dann bereits in ein fertig aufgebautes Partikelsystem.
initVfx(scene);
initSelection(scene);
initPanels();
setRauchSammler(setRauchQuellen);
initPointer(renderer.domElement);
initKeys(onKey);
initIO();
if (SCHAU_MODUS === "luft") {
  S.biom = "luftarchipel";
  var biomSelect = document.getElementById("biomSel");
  if (biomSelect) biomSelect.value = S.biom;
}
if (SCHAU_MODUS === "assets") setzeKartenGroesseFuerSchau(
  SCHAU_FOKUS ? 128 : ASSET_SCHAU_KARTENGROESSE);
// Farbrampe des Startbioms setzen (F1) — muss nach initIO stehen, weil die
// Funktion dort lebt und BIOME liest.
palettePassend();

// Freigegebene Hero-Assets vor dem synchronen Kartenaufbau laden. Bei leerem
// Manifest oder Fehler bleibt die prozedurale Geometrie unveraendert aktiv.
await ladeExterneAssets();

genBase(S.worldSeed);
if (SCHAU_MODUS === "assets") assetSchauGelaende();
refreshTerrainFull();
var c = demoMap();
rebuildAll();
flushPack();

cam.tFocus.x = cam.focus.x = c.x;
cam.tFocus.z = cam.focus.z = c.z;
cam.focusY = heightAt(cam.focus.x, cam.focus.z);
cam.tDist = cam.dist = c.dist || 120;
cam.tYaw = cam.yaw = c.yaw === undefined ? 0.85 : c.yaw;
cam.tPitch = cam.pitch = c.pitch || 38 * DEG;
if (Number.isFinite(c.fov)) {
  cam.tFov = cam.fov = c.fov;
  camera.fov = c.fov;
  camera.updateProjectionMatrix();
}
if (Number.isFinite(c.hebung)) cam.tHebung = cam.hebung = c.hebung;

setTod(SCHAU_MODUS === "assets" || SCHAU_MODUS === "luft" ? "mittag" : "morgen", true);
setWetter("klar", true);       // Standardwetter; waehlt bei "klar" den Biom-VFX
buildRail();
buildPanel();
updateHint();

window.addEventListener("resize", function () {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  resizePipeline(camera);
});

/* ==========================================================================
   Renderschleife
   ========================================================================== */
var fps = 60, frameCount = 0, fpsAcc = 0, lastT = performance.now();
// Wiederverwendeter Fokuspunkt fuer tickVfx — das Partikelvolumen haengt am
// Kamerafokus (x/z aus cam.focus, Hoehe aus cam.focusY). Ein Modulobjekt statt
// eines Literals pro Bild: kein Muell fuer den Sammler.
var vfxFokus = { x: 0, y: 0, z: 0 };

function animate() {
  requestAnimationFrame(animate);
  var now = performance.now();
  var raw = (now - lastT) / 1000;          // echte Bildzeit fuer Anzeige und Blenden
  var dt = Math.min(0.05, raw);            // geklammert fuer stabile Bewegung
  lastT = now;

  verarbeiteZeiger(now);
  moveFocus(dt);
  updateCamera(dt);
  tickAtmosphere(raw);
  // Wolkentempo aus der Wetterlage: im Sturm jagen Cumulus und Zirren, im
  // Schneefall ziehen sie langsamer. sky.js bleibt dafuer unveraendert.
  updateSky(dt * getWolkenTempo());
  tickWind(now * 0.001);
  updateBirds(dt, now * 0.001);
  tickWeltschildkroeten(now * 0.001);
  tickWeltschloesser(now * 0.001);
  tickFlugrouten(now * 0.001);
  updateRauch(now * 0.001);
  vfxFokus.x = cam.focus.x; vfxFokus.y = cam.focusY; vfxFokus.z = cam.focus.z;
  tickVfx(now * 0.001, vfxFokus);
  water.visible = wasserSichtbar(scene.fog.far);
  if (water.visible) updateWater(now * 0.001);
  // Fluesse fliessen unabhaengig von der Sichtbarkeit des Meeres — die Uhr
  // kostet einen Uniform-Schreibzugriff je Bild.
  setFlussZeit(now * 0.001);
  flushPack();
  updateHandlePositions();
  // I3: laufende Erosion bekommt ihr Zeitbudget. Steht VOR dem Zeichnen, damit
  // ein fertig gewordener Lauf im selben Bild sichtbar wird statt einen Frame
  // spaeter. Ohne Lauf kostet der Aufruf einen Vergleich.
  tickErosion();
  /* I4 — Beschriftungselemente in die Schicht spiegeln. Gedrosselt auf fuenf
     Mal je Sekunde, und zwar bewusst hier statt an jeder Stelle, die Elemente
     aendert: Anlegen, Loeschen, Undo, Redo, Laden, Welt wuerfeln und das
     Textfeld im Panel sind sieben Wege, und der achte wird vergessen. Ein
     Abgleich, der von sich aus nachzieht, kann nicht vergessen werden.
     `abgleichen` vergleicht ueber einen Stempel aus Klasse, Groesse und Text —
     ohne Aenderung entsteht kein einziges neues Sprite. */
  if (now - letzterBeschriftungsAbgleich > 200) {
    letzterBeschriftungsAbgleich = now;
    beschriftungenAktualisieren();
  }
  /* I4 — Beschriftungen neu bewerten: welche verdeckt welche, was ist im
     aktuellen Massstab ueberhaupt zugelassen. Die Schicht drosselt selbst auf
     rund sechsmal je Sekunde; der Aufruf je Bild kostet einen Zeitvergleich.
     Der Massstab ist bis I1 ein Platzhalter aus der Kameradistanz — die
     Klassentabelle hat je Klasse ein Fenster, das damit schon jetzt greift. */
  beschriftungen.nachziehen({
    camera: camera, breite: window.innerWidth, hoehe: window.innerHeight,
    fov: camera.fov, massstab: cam.dist * 2
  }, now);
  tickToast(now);
  // Marker-Beschriftung als HTML-Overlay ueber dem Canvas (D1) — eigene
  // Zeile statt Anhaengsel von tickToast, damit der Taktgeber eindeutig bleibt.
  markerOverlayAktualisieren();
  // Adaptive Aufloesung: die ECHTE Bildzeit melden (raw, nicht das geklammerte
  // dt) — der Regler senkt bei anhaltend zaehen Bildern die Renderskala und
  // hebt sie wieder, sobald die Rate traegt.
  // Art-Sichten bleiben pixelgenau; Headless-Last ist kein Asset-Signal.
  if (!SCHAU_MODUS) tickLeistung(raw);
  renderFrame(camera, now * 0.001);

  frameCount++; fpsAcc += raw;
  if (fpsAcc > 0.5) { fps = frameCount / fpsAcc; frameCount = 0; fpsAcc = 0; updateStats(fps); }
}

animate();
window.__terraOk = true;
window.__terraDebug = { POOLS: POOLS, S: S, getRenderInfo: getRenderInfo };
