/* ==========================================================================
   Visuelle Objektauswahl („Asset-Katalog") fuer das Objekt-Werkzeug

   Der Wunsch dahinter: nicht mehr blind aus der gewichteten Gruppen-Mischung
   wuerfeln lassen, sondern ein KONKRETES Asset ansehen und anklicken koennen.
   Die Daten-Seite existiert laengst (params.nurTyp erzwingt einen Pool, siehe
   generators/objects.js) — dieses Modul ist ihre sichtbare Seite: ein
   durchsuchbares Kartenraster mit echten 3D-Vorschaubildern je Pool.

   Bauart:
   - KEINE Abhaengigkeit auf editor/ oder andere ui/-Module. panels.js reicht
     die fertig beschriftete Optionsliste (nurTypOptionen aus editor/tools.js)
     und einen Auswahl-Callback herein; hier wird nur DOM gebaut und gemalt.
     Damit entsteht kein neuer Importzyklus (tools.js importiert panels.js).
   - Die Vorschaubilder entstehen in einem EIGENEN kleinen WebGL-Renderer
     abseits des Bildschirms — einmal je Pool und Sitzung, danach aus dem
     Cache (DataURL). Gemalt wird die echte Pool-Geometrie (POOLS[name].geo)
     mit einem Lambert-Vorschaumaterial, das Vertexfarben, Textur und
     Alphatest des Poolmaterials uebernimmt. Der Editor-Renderer und seine
     Post-Kette bleiben komplett unberuehrt.
   - Gemalt wird GEDROSSELT (wenige Bilder je Animationsframe) ueber
     requestAnimationFrame, damit das Oeffnen des Panels nicht ruckelt.
   - Ohne WebGL (Testlaeufe, alte Maschinen) faellt jede Karte auf einen
     Buchstaben-Platzhalter zurueck — die Auswahl funktioniert trotzdem.
   ========================================================================== */
import * as THREE from 'three';
import { POOLS } from '../core/pools.js';

/* --- Sitzungszustand ------------------------------------------------------
   Suche und Aufklappzustand ueberleben den Panel-Neuaufbau (buildPanel wirft
   das DOM nach jedem Klick weg): wer sucht, will nach dem Setzen eines Assets
   an derselben Stelle weitersuchen. */
var letzteSuche = "";
var restOffen = false;

/* --- Vorschau-Cache und Malwerk ------------------------------------------ */
var VORSCHAU_PX = 96;                  // Kantenlaenge des Vorschaubildes
var vorschauCache = {};                // Poolname -> DataURL
var vorschauFehlt = {};                // Poolname -> true (Malen fehlgeschlagen)
var warteliste = [];                   // Poolnamen, die noch gemalt werden wollen
var wartendeBilder = {};               // Poolname -> [<img>-Elemente]
var malwerk = null;                    // { renderer, scene, camera, mesh, mat }
var malwerkKaputt = false;             // WebGL nicht verfuegbar -> Platzhalter
var malTakt = 0;                       // rAF-Handle der Warteschlange

function malwerkHolen() {
  if (malwerk || malwerkKaputt) return malwerk;
  try {
    var canvas = document.createElement("canvas");
    canvas.width = VORSCHAU_PX;
    canvas.height = VORSCHAU_PX;
    var renderer = new THREE.WebGLRenderer({
      canvas: canvas, antialias: true, alpha: true,
      // toDataURL direkt nach dem render()-Aufruf braucht den erhaltenen Puffer.
      preserveDrawingBuffer: true
    });
    renderer.setPixelRatio(1);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    var scene = new THREE.Scene();
    // Warmes Hauptlicht + kuehle Aufhellung: dieselbe Lichtidee wie die
    // Szene, nur neutral genug, dass jede Materialfamilie lesbar bleibt.
    scene.add(new THREE.HemisphereLight(0xfff6e4, 0x5d6a5e, 1.15));
    var sonne = new THREE.DirectionalLight(0xfff1d6, 2.1);
    sonne.position.set(3.2, 5.4, 2.6);
    scene.add(sonne);
    var camera = new THREE.PerspectiveCamera(30, 1, 0.05, 4000);
    var mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    var mesh = new THREE.Mesh(new THREE.BufferGeometry(), mat);
    mesh.frustumCulled = false;
    scene.add(mesh);
    malwerk = { renderer: renderer, scene: scene, camera: camera, mesh: mesh, mat: mat };
  } catch (err) {
    malwerkKaputt = true;
  }
  return malwerk;
}

var _box = new THREE.Box3();
var _mitte = new THREE.Vector3();
var _groesse = new THREE.Vector3();
// Blick leicht von oben und schraeg von vorn — die Standard-Katalogansicht.
var BLICK = new THREE.Vector3(0.82, 0.58, 1).normalize();

/** Malt EIN Vorschaubild und liefert die DataURL (oder null). */
function maleVorschau(name) {
  var P = POOLS[name];
  var werk = malwerkHolen();
  if (!P || !P.geo || !werk) return null;
  var m = werk.mat, q = P.mat || {};
  // Textur, Alphatest, Seite und Transparenz des Poolmaterials uebernehmen —
  // Gras, Kronenkarten und Blattwerk brauchen ihre Alphamaske auch hier.
  m.map = q.map || null;
  m.alphaTest = q.alphaTest || 0;
  m.side = q.side === undefined ? THREE.FrontSide : q.side;
  m.transparent = !!q.transparent;
  m.opacity = q.opacity === undefined ? 1 : q.opacity;
  if (m.emissive) m.emissive.set(q.emissive ? q.emissive.getHex() : 0x000000);
  m.needsUpdate = true;
  werk.mesh.geometry = P.geo;
  // Die Pool-Huellkugel ist absichtlich kartengross (weiteHuelle) — fuer den
  // Bildausschnitt zaehlt die echte Box der Geometrie.
  _box.setFromBufferAttribute(P.geo.attributes.position);
  _box.getCenter(_mitte);
  _box.getSize(_groesse);
  var radius = Math.max(_groesse.x, _groesse.y, _groesse.z) * 0.5 || 1;
  var dist = radius / Math.tan((werk.camera.fov * Math.PI / 180) / 2) * 1.18;
  werk.camera.position.copy(_mitte).addScaledVector(BLICK, dist);
  werk.camera.lookAt(_mitte);
  werk.camera.updateProjectionMatrix();
  try {
    werk.renderer.render(werk.scene, werk.camera);
    return werk.renderer.domElement.toDataURL("image/png");
  } catch (err) {
    return null;
  }
}

/** Arbeitet die Warteliste gedrosselt ab (drei Bilder je Frame). */
function warteListeAbarbeiten() {
  malTakt = 0;
  var budget = 3;
  while (budget-- > 0 && warteliste.length) {
    var name = warteliste.shift();
    if (vorschauCache[name] || vorschauFehlt[name]) continue;
    var url = maleVorschau(name);
    if (url) vorschauCache[name] = url;
    else vorschauFehlt[name] = true;
    var bilder = wartendeBilder[name] || [];
    for (var i = 0; i < bilder.length; i++) bildEintragen(bilder[i], name);
    delete wartendeBilder[name];
  }
  if (warteliste.length && typeof requestAnimationFrame === "function") {
    malTakt = requestAnimationFrame(warteListeAbarbeiten);
  }
}

function bildAnfordern(img, name) {
  if (vorschauCache[name] || vorschauFehlt[name]) { bildEintragen(img, name); return; }
  (wartendeBilder[name] || (wartendeBilder[name] = [])).push(img);
  if (warteliste.indexOf(name) < 0) warteliste.push(name);
  if (!malTakt && typeof requestAnimationFrame === "function") {
    malTakt = requestAnimationFrame(warteListeAbarbeiten);
  }
}

function bildEintragen(img, name) {
  if (!img.isConnected && img.parentNode === null) return;
  var url = vorschauCache[name];
  if (url) { img.src = url; img.style.display = ""; return; }
  // Platzhalter: der Buchstabe steht schon dahinter, das Bild bleibt weg.
  img.style.display = "none";
}

/* --- DOM-Bausteine -------------------------------------------------------- */
function el(tag, cls, txt) {
  var n = document.createElement(tag);
  if (cls) n.className = cls;
  if (txt !== undefined) n.textContent = txt;
  return n;
}

/** Eine Asset-Karte: Vorschaubild (oder Platzhalter), Label, Klick waehlt. */
function baueKarte(name, label, aktiv, waehle) {
  var karte = el("button", "objKarte" + (aktiv ? " on" : ""));
  karte.type = "button";
  karte.title = label + (name ? "" : " — gewichtete Mischung der Objektart");
  var thumb = el("div", "objThumb");
  if (name) {
    // Platzhalter-Buchstabe UNTER dem Bild: sichtbar bis (und falls kein)
    // Vorschaubild kommt.
    thumb.appendChild(el("span", "objThumbFallback", label.charAt(0).toUpperCase()));
    var img = document.createElement("img");
    img.alt = "";
    img.draggable = false;
    thumb.appendChild(img);
    bildAnfordern(img, name);
  } else {
    thumb.appendChild(el("span", "objThumbWuerfel", "🎲"));
  }
  karte.appendChild(thumb);
  karte.appendChild(el("div", "objLabel", label));
  karte.addEventListener("click", function () { waehle(name); });
  return karte;
}

function baueGitter(eintraege, wert, waehle) {
  var gitter = el("div", "objGitter");
  for (var i = 0; i < eintraege.length; i++) {
    var name = eintraege[i][0], label = eintraege[i][1];
    if (!POOLS[name]) continue;               // nie erreichbare Pools ausblenden
    gitter.appendChild(baueKarte(name, label, wert === name, waehle));
  }
  return gitter;
}

function passtZurSuche(label, name, suche) {
  if (!suche) return true;
  return label.toLowerCase().indexOf(suche) >= 0
    || name.toLowerCase().indexOf(suche) >= 0;
}

function gefiltert(eintraege, suche) {
  if (!suche) return eintraege;
  var out = [];
  for (var i = 0; i < eintraege.length; i++) {
    if (passtZurSuche(eintraege[i][1], eintraege[i][0], suche)) out.push(eintraege[i]);
  }
  return out;
}

/**
 * Baut den Katalog-Abschnitt des Objekt-Panels.
 *
 * @param cfg.optionen  Ergebnis von nurTypOptionen(variant) aus editor/tools.js:
 *                      { o: [["", Mischungslabel]], og: [[Gruppenlabel, [[name,
 *                      label], …]], …] } — og[0] sind die Pools der gewaehlten
 *                      Objektart, og[1] alle uebrigen erreichbaren Pools.
 * @param cfg.wert      aktueller nurTyp-Wert ("" = Mischung).
 * @param cfg.waehle    waehle(name) — uebernimmt die Auswahl (Undo + Commit
 *                      macht der Aufrufer in ui/panels.js).
 * @returns DOM-Element zum Anhaengen ans Panel.
 */
export function baueObjektKatalog(cfg) {
  var wrap = el("div", "objKatalog");
  var suche = letzteSuche;
  var gruppe = (cfg.optionen.og && cfg.optionen.og[0]) ? cfg.optionen.og[0][1] : [];
  var rest = (cfg.optionen.og && cfg.optionen.og[1]) ? cfg.optionen.og[1][1] : [];

  var kopf = el("div", "objKopf");
  kopf.appendChild(el("span", "objTitel", "Asset-Auswahl"));
  var status = el("span", "objStatus");
  var aktivLabel = "Zufällige Mischung";
  if (cfg.wert) {
    var alle = gruppe.concat(rest);
    for (var s = 0; s < alle.length; s++) {
      if (alle[s][0] === cfg.wert) { aktivLabel = alle[s][1]; break; }
    }
    if (aktivLabel === "Zufällige Mischung") aktivLabel = cfg.wert;
  }
  status.textContent = aktivLabel;
  kopf.appendChild(status);
  wrap.appendChild(kopf);

  var sucheIn = document.createElement("input");
  sucheIn.type = "text";
  sucheIn.className = "objSuche";
  sucheIn.placeholder = "Suchen … (alle " + (gruppe.length + rest.length) + " Assets)";
  sucheIn.value = suche;
  sucheIn.spellcheck = false;
  wrap.appendChild(sucheIn);

  var koerper = el("div");
  wrap.appendChild(koerper);

  function neuZeichnen() {
    koerper.innerHTML = "";
    var q = letzteSuche.trim().toLowerCase();

    // Die Mischungs-Karte steht nur ohne Suchtext vorn — wer sucht, sucht
    // ein konkretes Asset.
    if (!q) {
      var mix = el("div", "objGitter");
      mix.appendChild(baueKarte("", "Zufällige Mischung", !cfg.wert, cfg.waehle));
      var gk = gefiltert(gruppe, q);
      for (var i = 0; i < gk.length; i++) {
        if (!POOLS[gk[i][0]]) continue;
        mix.appendChild(baueKarte(gk[i][0], gk[i][1], cfg.wert === gk[i][0], cfg.waehle));
      }
      koerper.appendChild(mix);
    } else {
      var gTreffer = gefiltert(gruppe, q);
      if (gTreffer.length) {
        koerper.appendChild(el("div", "objAbschnitt", "Diese Objektart"));
        koerper.appendChild(baueGitter(gTreffer, cfg.wert, cfg.waehle));
      }
    }

    var rTreffer = gefiltert(rest, q);
    if (rTreffer.length) {
      var details = document.createElement("details");
      details.className = "objRest";
      details.open = q ? true : restOffen;
      details.addEventListener("toggle", function () {
        if (!letzteSuche.trim()) restOffen = details.open;
      });
      var summary = document.createElement("summary");
      summary.textContent = q
        ? rTreffer.length + " Treffer in anderen Objektarten"
        : "Alle weiteren Assets (" + rTreffer.length + ")";
      details.appendChild(summary);
      // Grosse Restliste erst beim Aufklappen fuellen — 500 Karten samt
      // Vorschau-Warteschlange sollen nicht am geschlossenen <details> haengen.
      var befuellt = false;
      var fuellen = function () {
        if (befuellt) return;
        befuellt = true;
        details.appendChild(baueGitter(rTreffer, cfg.wert, cfg.waehle));
      };
      if (details.open) fuellen();
      else details.addEventListener("toggle", function () { if (details.open) fuellen(); });
      koerper.appendChild(details);
    } else if (q && !gefiltert(gruppe, q).length) {
      koerper.appendChild(el("div", "objLeer", "Kein Asset passt zu „" + letzteSuche + "“."));
    }
  }

  sucheIn.addEventListener("input", function () {
    letzteSuche = sucheIn.value;
    neuZeichnen();
  });

  neuZeichnen();
  return wrap;
}
