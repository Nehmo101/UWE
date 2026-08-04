import { S, KARTE } from '../core/store.js';
import { hgt } from '../world/terrain.js';
import { pathSamples } from '../generators/paths.js';
import { nameFuer, neueVergabe } from '../generators/namen.js';
import { ATLAS_STILE, ATLAS_STANDARD, atlasFarbe, wasserFarbe, hoeheInterpoliert, weltZuAtlas,
  kuestenLinien, atlasTitel } from './kartografie.js';
import { zeichnePapierfasern, zeichneGebirge, zeichneWaelder,
  zeichneOrtssignet, zeichneKompassrose } from './kartografie-zeichen.js';

var aktiv = false;
var overlay = null;
var canvas = null;
var statusEl = null;
var titelEl = null;
var renderToken = 0;
var opt = { stil: ATLAS_STANDARD, strassen: true, konturen: true, namen: true };

function el(tag, cls, text) {
  var n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}

function kartenname() {
  if (S.baum && S.aktiveKarte) {
    for (var i = 0; i < S.baum.karten.length; i++) {
      if (S.baum.karten[i].id === S.aktiveKarte) return S.baum.karten[i].titel;
    }
  }
  return "Terra - Seed " + S.worldSeed;
}

function zeichneGrund(ctx, w, h, stil) {
  var bild = ctx.createImageData(w, h), data = bild.data, vw = KARTE.vw;
  for (var y = 0; y < h; y++) {
    for (var x = 0; x < w; x++) {
      var hh = hoeheInterpoliert(hgt, vw, x, y, w, h);
      var farbe = hh <= 0 ? wasserFarbe(hh, opt.stil, x, y, S.worldSeed)
        : atlasFarbe(hh, 0, opt.stil, x, y, S.worldSeed);
      var o = (y * w + x) * 4;
      data[o] = farbe[0]; data[o + 1] = farbe[1]; data[o + 2] = farbe[2]; data[o + 3] = 255;
    }
  }
  ctx.putImageData(bild, 0, 0);
  zeichnePapierfasern(ctx, w, h, stil, S.worldSeed);
}

function zug(ctx, linie, w, h) {
  ctx.beginPath();
  for (var i = 0; i < linie.length; i++) {
    var p = weltZuAtlas(linie[i].x, linie[i].z, w, h, KARTE.half);
    if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y);
  }
  ctx.stroke();
}

function zeichnePfad(ctx, e, w, h, stil) {
  var linie = pathSamples(e.points || [], Math.max(2, KARTE.map / 220));
  if (linie.length < 2) return;
  var art = e.variant, strasse = art === "strasse";
  if (strasse && !opt.strassen) return;
  var breite = Math.max(1, Number(e.params && e.params.breite) || (strasse ? 5 : 2));
  var pxBreite = Math.max(1, breite / KARTE.map * w);
  ctx.save(); ctx.lineCap = "round"; ctx.lineJoin = "round";
  if (art === "fluss") {
    ctx.strokeStyle = stil.papierCss; ctx.lineWidth = pxBreite + Math.max(2.5, w / 450); zug(ctx, linie, w, h);
    ctx.strokeStyle = stil.tinte; ctx.lineWidth = Math.max(1.1, pxBreite * .48); zug(ctx, linie, w, h);
  } else if (strasse) {
    ctx.strokeStyle = stil.papierCss; ctx.lineWidth = Math.max(3, pxBreite * .62); zug(ctx, linie, w, h);
    ctx.setLineDash([Math.max(1.2, w / 850), Math.max(3.2, w / 260)]);
    ctx.strokeStyle = stil.tinte; ctx.lineWidth = Math.max(.9, w / 1200); zug(ctx, linie, w, h);
  } else if (art === "bruch") {
    ctx.strokeStyle = stil.tinte; ctx.lineWidth = Math.max(1, w / 900);
    ctx.setLineDash([w / 80, w / 300]); zug(ctx, linie, w, h);
  } else {
    ctx.strokeStyle = stil.tinte; ctx.lineWidth = Math.max(1, pxBreite * .42);
    if (art === "hecke") ctx.setLineDash([2, 3]); zug(ctx, linie, w, h);
  }
  ctx.restore();
}

function zeichneGelaende(ctx, w, h, stil) {
  if (!opt.konturen) return;
  var waelder = [];
  for (var i = 0; i < S.elements.length; i++) {
    var e = S.elements[i];
    if (e.kind === "flaeche" && e.variant === "wald" && e.points) waelder.push(e.points);
  }
  zeichneWaelder(ctx, waelder, w, h, KARTE.half, stil, S.worldSeed);
  zeichneGebirge(ctx, hgt, KARTE.vw, w, h, stil, S.worldSeed);
}

function elementMitte(e) {
  var pts = e.points || [];
  if (!pts.length) return null;
  var x = 0, z = 0;
  for (var i = 0; i < pts.length; i++) { x += pts[i].x; z += pts[i].z; }
  return { x: x / pts.length, z: z / pts.length };
}

function zeichneOrteUndPfade(ctx, w, h, stil) {
  for (var i = 0; i < S.elements.length; i++) {
    var e = S.elements[i];
    if (e.kind === "pfad") { zeichnePfad(ctx, e, w, h, stil); continue; }
    if (!e.points || !e.points.length) continue;
    var mitte = elementMitte(e), p = weltZuAtlas(mitte.x, mitte.z, w, h, KARTE.half);
    if (e.kind === "flaeche" && e.variant === "viertel") {
      zeichneOrtssignet(ctx, p.x, p.y, Math.max(8, w / 70), "ort", stil);
    } else if (e.kind === "flaeche" && (e.variant === "burg" || e.variant === "kloster")) {
      zeichneOrtssignet(ctx, p.x, p.y, Math.max(10, w / 62), "burg", stil);
    }
  }
}

function artFuerName(e) {
  if (e.kind === "flaeche" && e.variant === "viertel") return "ort";
  if (e.kind === "flaeche" && e.variant === "wald") return "wald";
  if (e.kind === "flaeche" && (e.variant === "burg" || e.variant === "kloster")) return "ort";
  if (e.kind === "pfad" && e.variant === "fluss") return "fluss";
  if (e.kind === "pfad" && e.variant === "bruch") return "bruch";
  if (e.kind === "ranke") return "ranke";
  return null;
}

function hoechsterPunkt() {
  var vw = KARTE.vw, best = { h: -Infinity, x: 0, z: 0 };
  var schritt = Math.max(4, Math.floor((vw - 1) / 32));
  for (var j = schritt; j < vw - schritt; j += schritt) for (var i = schritt; i < vw - schritt; i += schritt) {
    var h = hgt[j * vw + i];
    if (h > best.h) best = { h: h, x: i - KARTE.half, z: j - KARTE.half };
  }
  return best;
}

function labelSammlung() {
  var labels = [], vergabe = neueVergabe(), i;
  for (i = 0; i < S.marker.length; i++) {
    var m = S.marker[i];
    if (m.text) labels.push({ x: m.x, z: m.z, text: m.text, rang: m.art === "ort" ? 3 : 2 });
  }
  for (i = 0; i < S.elements.length; i++) {
    var e = S.elements[i], art = artFuerName(e), mitte = elementMitte(e);
    if (!art || !mitte) continue;
    var text = e.params && (e.params.name || e.params.text);
    if (!text) text = nameFuer(art, mitte.x, mitte.z, e.seed || 0, {
      worldSeed: S.worldSeed, vergabe: vergabe, index: i, rolle: "atlas-" + art
    });
    labels.push({ x: mitte.x, z: mitte.z, text: text, rang: art === "ort" ? 3 : (art === "wald" ? 2 : 1) });
  }
  var gipfel = hoechsterPunkt();
  if (gipfel.h > 9) labels.push({ x: gipfel.x, z: gipfel.z,
    text: nameFuer("gebirge", gipfel.x, gipfel.z, S.worldSeed ^ 0x41a7, {
      worldSeed: S.worldSeed, vergabe: vergabe, rolle: "atlas-gebirge"
    }), rang: 2, hoch: true });
  labels.sort(function (a, b) { return b.rang - a.rang; });
  return labels;
}

function zeichneNamen(ctx, w, h, stil) {
  if (!opt.namen) return;
  var labels = labelSammlung(), belegt = [];
  ctx.save(); ctx.textAlign = "center"; ctx.textBaseline = "middle";
  for (var i = 0; i < labels.length; i++) {
    var l = labels[i], p = weltZuAtlas(l.x, l.z, w, h, KARTE.half);
    var groesse = Math.max(11, w / (l.rang >= 3 ? 52 : 68));
    var text = String(l.text || "").slice(0, 42);
    if (l.rang >= 2) text = text.toUpperCase();
    ctx.font = (l.rang >= 3 ? "600 " : "500 ") + groesse + "px Georgia, serif";
    var tw = ctx.measureText(text).width, box = { x: p.x - tw / 2 - 5, y: p.y - groesse * .7, w: tw + 10, h: groesse * 1.4 };
    var kollidiert = false;
    for (var b = 0; b < belegt.length; b++) {
      var q = belegt[b];
      if (box.x < q.x + q.w && box.x + box.w > q.x && box.y < q.y + q.h && box.y + box.h > q.y) { kollidiert = true; break; }
    }
    if (kollidiert && l.rang < 3) continue;
    belegt.push(box);
    ctx.lineWidth = Math.max(3, w / 300); ctx.strokeStyle = stil.papierCss; ctx.strokeText(text, p.x, p.y);
    ctx.fillStyle = stil.akzent; ctx.fillText(text, p.x, p.y);
  }
  ctx.restore();
}

function zeichneRahmen(ctx, w, h, stil) {
  var rand = Math.max(13, w * .018);
  ctx.save(); ctx.strokeStyle = stil.tinte; ctx.lineWidth = Math.max(1.2, w / 900);
  ctx.strokeRect(rand, rand, w - rand * 2, h - rand * 2);
  ctx.lineWidth = Math.max(.6, w / 1800); ctx.strokeRect(rand + 5, rand + 5, w - (rand + 5) * 2, h - (rand + 5) * 2);
  zeichneKompassrose(ctx, w - rand - w * .05, rand + w * .06, Math.max(18, w * .026), stil);
  var meter = KARTE.map * (S.einheitMeter || 1), barW = Math.min(w * .19, 220);
  var bx = rand + 18, by = h - rand - 25;
  ctx.fillStyle = stil.tinte; ctx.fillRect(bx, by, barW, 2);
  for (var t = 0; t <= 4; t++) ctx.fillRect(bx + barW * t / 4, by - 4, 1.2, 9);
  ctx.font = Math.max(9, w / 105) + "px Georgia, serif"; ctx.textAlign = "left";
  ctx.fillText(Math.round(meter * barW / w) + " m", bx, by - 8);
  var titel = atlasTitel(kartenname()).toUpperCase(), cw = Math.min(w * .42, ctx.measureText(titel).width + w * .08);
  var cx = w / 2 - cw / 2, cy = h - rand - Math.max(50, w * .065), ch = Math.max(38, w * .052);
  ctx.fillStyle = stil.papierCss; ctx.fillRect(cx, cy, cw, ch);
  ctx.strokeStyle = stil.tinte; ctx.lineWidth = Math.max(1, w / 950); ctx.strokeRect(cx, cy, cw, ch);
  ctx.strokeRect(cx + 4, cy + 4, cw - 8, ch - 8);
  ctx.fillStyle = stil.tinte; ctx.textAlign = "center";
  ctx.font = "600 " + Math.max(12, w / 58) + "px Georgia, serif"; ctx.fillText(titel, w / 2, cy + ch * .55);
  ctx.restore();
}

function renderAuf(ziel, w, h) {
  ziel.width = w; ziel.height = h;
  var ctx = ziel.getContext("2d", { alpha: false }), stil = ATLAS_STILE[opt.stil] || ATLAS_STILE.gemalt;
  zeichneGrund(ctx, w, h, stil);
  kuestenLinien(ctx, hgt, KARTE.vw, w, h);
  zeichneGelaende(ctx, w, h, stil);
  zeichneOrteUndPfade(ctx, w, h, stil);
  zeichneNamen(ctx, w, h, stil);
  zeichneRahmen(ctx, w, h, stil);
}

function neuRendern() {
  var token = ++renderToken;
  statusEl.textContent = "Chronikkarte wird mit Feder gezeichnet ...";
  requestAnimationFrame(function () {
    if (!aktiv || token !== renderToken) return;
    var box = canvas.closest(".atlasBuehne").getBoundingClientRect();
    var seite = Math.max(520, Math.min(1100, Math.floor(Math.min(box.width, box.height) * 1.45)));
    renderAuf(canvas, seite, seite);
    statusEl.textContent = KARTE.map + " \u00d7 " + KARTE.map + " Zellen - "
      + Math.round(KARTE.map * (S.einheitMeter || 1)) + " m Kantenl\u00e4nge";
  });
}

function optionKnopf(label, key) {
  var b = el("button", "atlasOption", label); b.type = "button";
  function sync() { b.classList.toggle("on", !!opt[key]); b.setAttribute("aria-pressed", String(!!opt[key])); }
  b.addEventListener("click", function () { opt[key] = !opt[key]; sync(); neuRendern(); }); sync(); return b;
}

function downloadPNG() {
  statusEl.textContent = "Druckdatei wird in hoher Aufl\u00f6sung gezeichnet ...";
  requestAnimationFrame(function () {
    var out = document.createElement("canvas"); renderAuf(out, 2048, 2048);
    out.toBlob(function (blob) {
      var a = document.createElement("a"), url = URL.createObjectURL(blob);
      a.href = url; a.download = "terra-chronikkarte-" + S.worldSeed + ".png"; a.click();
      setTimeout(function () { URL.revokeObjectURL(url); }, 3000);
      statusEl.textContent = "PNG exportiert - 2048 \u00d7 2048 px";
    }, "image/png");
  });
}

function schliessen() {
  aktiv = false; overlay.hidden = true; document.body.classList.remove("kartenmodus-aktiv");
}
function oeffnen() {
  aktiv = true; overlay.hidden = false; document.body.classList.add("kartenmodus-aktiv");
  titelEl.textContent = atlasTitel(kartenname()); neuRendern();
}

export function initKartenmodus() {
  var start = document.getElementById("kartenmodusBtn"); if (!start) return;
  overlay = el("section", "kartenmodus"); overlay.hidden = true;
  overlay.setAttribute("aria-label", "Atlasmodus");
  var kopf = el("header", "atlasKopf"), titelBlock = el("div", "atlasTitelblock");
  titelBlock.appendChild(el("span", "atlasKicker", "TERRA - CHRONIKKARTE"));
  titelEl = el("h1", "atlasTitel", "Atlas"); titelBlock.appendChild(titelEl); kopf.appendChild(titelBlock);
  var aktionen = el("div", "atlasAktionen");
  var png = el("button", "atlasPrimaer", "PNG exportieren"); png.addEventListener("click", downloadPNG);
  var druck = el("button", "", "Drucken"); druck.addEventListener("click", function () { window.print(); });
  var zu = el("button", "atlasZu", "Editor"); zu.title = "Zur\u00fcck zur 3D-Ansicht"; zu.addEventListener("click", schliessen);
  aktionen.appendChild(png); aktionen.appendChild(druck); aktionen.appendChild(zu); kopf.appendChild(aktionen);
  var werk = el("nav", "atlasWerkzeuge"), stilLabel = el("label", "atlasStil", "Tinte");
  var stilWahl = el("select");
  Object.keys(ATLAS_STILE).forEach(function (id) {
    var o = el("option", "", ATLAS_STILE[id].label); o.value = id; stilWahl.appendChild(o);
  });
  stilWahl.value = opt.stil;
  stilWahl.addEventListener("change", function () { opt.stil = stilWahl.value; neuRendern(); });
  stilLabel.appendChild(stilWahl); werk.appendChild(stilLabel);
  werk.appendChild(optionKnopf("Stra\u00dfen", "strassen")); werk.appendChild(optionKnopf("Reliefzeichen", "konturen"));
  werk.appendChild(optionKnopf("Namen", "namen"));
  statusEl = el("span", "atlasStatus", "Bereit"); werk.appendChild(statusEl);
  var buehne = el("div", "atlasBuehne"), bild = el("div", "atlasBlatt");
  canvas = el("canvas", "atlasCanvas"); bild.appendChild(canvas); buehne.appendChild(bild);
  var legende = el("aside", "atlasLegende");
  legende.innerHTML = "<strong>Zeichenschl\u00fcssel</strong><span><i class=\"weg\"></i>Stra\u00dfe</span>"
    + "<span><i class=\"fluss\"></i>Fluss</span><span><i class=\"ort\"></i>Ort / Viertel</span>"
    + "<small>Federzeichnungen aus H\u00f6henfeld, Waldfl\u00e4chen und editierbaren Wegen</small>";
  buehne.appendChild(legende);
  overlay.appendChild(kopf); overlay.appendChild(werk); overlay.appendChild(buehne); document.body.appendChild(overlay);
  start.addEventListener("click", oeffnen);
  window.addEventListener("keydown", function (e) { if (aktiv && e.code === "Escape") schliessen(); });
  if (new URLSearchParams(window.location.search).get("karte") === "1") setTimeout(oeffnen, 450);
}

export function istKartenmodus() { return aktiv; }
