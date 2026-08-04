/* Handgezeichnete Signaturen fuer den Chronik-Atlas. Reine Canvas-Funktionen,
   keine DOM- oder Three-Abhaengigkeit; alle Zufallswerte sind ortsstabil. */

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function hash(x, y, seed) {
  var n = Math.imul((x | 0) ^ seed, 374761393) + Math.imul(y | 0, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}
function hoeheAn(feld, vw, px, py, breite, hoehe) {
  var gx = clamp(px / Math.max(1, breite - 1) * (vw - 1), 0, vw - 1);
  var gy = clamp(py / Math.max(1, hoehe - 1) * (vw - 1), 0, vw - 1);
  var x0 = Math.floor(gx), y0 = Math.floor(gy);
  var x1 = Math.min(vw - 1, x0 + 1), y1 = Math.min(vw - 1, y0 + 1);
  var tx = gx - x0, ty = gy - y0;
  var a = feld[y0 * vw + x0] * (1 - tx) + feld[y0 * vw + x1] * tx;
  var b = feld[y1 * vw + x0] * (1 - tx) + feld[y1 * vw + x1] * tx;
  return a * (1 - ty) + b * ty;
}
function weltPunkt(p, breite, hoehe, half) {
  return { x: (p.x + half) / (half * 2) * breite, y: (p.z + half) / (half * 2) * hoehe };
}

export function zeichnePapierfasern(ctx, breite, hoehe, stil, seed) {
  ctx.save();
  var anzahl = Math.round(breite * hoehe / 1500);
  ctx.lineWidth = Math.max(.35, breite / 2600);
  for (var i = 0; i < anzahl; i++) {
    var x = hash(i, 2, seed) * breite, y = hash(i, 7, seed + 3) * hoehe;
    var laenge = 2 + hash(i, 11, seed + 9) * breite / 90;
    ctx.strokeStyle = stil.faser + (0.025 + hash(i, 13, seed) * .055) + ")";
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + laenge, y + (hash(i, 17, seed) - .5) * 1.8); ctx.stroke();
  }
  ctx.restore();
}

function berg(ctx, x, y, s, schluessel, stil) {
  var spitze = y - s * (1.05 + hash(schluessel, 1, 19) * .22);
  var links = x - s * (1 + hash(schluessel, 2, 31) * .2);
  var rechts = x + s * (.92 + hash(schluessel, 3, 47) * .24);
  ctx.save(); ctx.strokeStyle = stil.tinte; ctx.fillStyle = stil.tinte;
  ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.lineWidth = Math.max(.75, s * .095);
  ctx.beginPath();
  ctx.moveTo(links, y + s * .12);
  ctx.lineTo(x - s * .55, y - s * .34);
  ctx.lineTo(x - s * .28, y - s * .26);
  ctx.lineTo(x, spitze);
  ctx.lineTo(x + s * .24, y - s * .38);
  ctx.lineTo(x + s * .43, y - s * .45);
  ctx.lineTo(rechts, y + s * .16);
  ctx.stroke();
  // Schwarze Schattenflanke wie mit Feder schraffiert.
  ctx.beginPath(); ctx.moveTo(x, spitze); ctx.lineTo(x + s * .18, y - s * .08);
  ctx.lineTo(x + s * .47, y - s * .22); ctx.lineTo(x + s * .32, y + s * .03);
  ctx.lineTo(x + s * .72, y - s * .03); ctx.lineTo(x + s * .48, y + s * .18); ctx.closePath();
  ctx.globalAlpha = .72; ctx.fill(); ctx.globalAlpha = 1;
  for (var k = 0; k < 3; k++) {
    var yy = y - s * (.16 - k * .17);
    ctx.beginPath(); ctx.moveTo(x - s * (.18 + k * .12), yy);
    ctx.lineTo(x - s * (.46 + k * .08), yy + s * .2); ctx.stroke();
  }
  ctx.restore();
}

export function zeichneGebirge(ctx, feld, vw, breite, hoehe, stil, seed) {
  var schritt = Math.max(18, breite / 43), punkte = [];
  for (var y = schritt; y < hoehe - schritt; y += schritt * .72) {
    for (var x = schritt; x < breite - schritt; x += schritt) {
      var sx = x + (hash(x, y, seed) - .5) * schritt * .68;
      var sy = y + (hash(x, y, seed + 1) - .5) * schritt * .34;
      var h = hoeheAn(feld, vw, sx, sy, breite, hoehe);
      var hx = hoeheAn(feld, vw, sx + schritt * .45, sy, breite, hoehe);
      var hy = hoeheAn(feld, vw, sx, sy + schritt * .45, breite, hoehe);
      var relief = Math.abs(h - hx) + Math.abs(h - hy);
      if (h < 6.4 || hash(x, y, seed + 8) < .13 || (h < 9.5 && relief < .7)) continue;
      punkte.push({ x: sx, y: sy, h: h, key: (x * 71 + y * 17) | 0 });
    }
  }
  punkte.sort(function (a, b) { return a.y - b.y; });
  for (var i = 0; i < punkte.length; i++) {
    var p = punkte[i], s = clamp(breite / 90 + (p.h - 8) * breite / 1600, breite / 105, breite / 47);
    berg(ctx, p.x, p.y, s, p.key, stil);
  }
  return punkte;
}

function punktInPoly(x, y, poly) {
  var innen = false;
  for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    var a = poly[i], b = poly[j];
    if (((a.y > y) !== (b.y > y)) && x < (b.x - a.x) * (y - a.y) / ((b.y - a.y) || 1e-9) + a.x) innen = !innen;
  }
  return innen;
}
function baum(ctx, x, y, s, key, stil) {
  ctx.save(); ctx.strokeStyle = stil.tinte; ctx.lineCap = "round";
  ctx.lineWidth = Math.max(.55, s * .11);
  ctx.beginPath(); ctx.moveTo(x, y + s * .45); ctx.lineTo(x, y - s * .42); ctx.stroke();
  for (var k = 0; k < 3; k++) {
    var yy = y - s * (.28 - k * .24), b = s * (.34 + k * .13);
    var drift = (hash(key, k, 17) - .5) * s * .08;
    ctx.beginPath(); ctx.moveTo(x + drift, yy - s * .18); ctx.quadraticCurveTo(x - b * .15, yy, x - b, yy + s * .2);
    ctx.moveTo(x + drift, yy - s * .18); ctx.quadraticCurveTo(x + b * .15, yy, x + b, yy + s * .2); ctx.stroke();
  }
  ctx.restore();
}

export function zeichneWaelder(ctx, waelder, breite, hoehe, half, stil, seed) {
  var gezeichnet = 0, schritt = Math.max(13, breite / 68);
  for (var w = 0; w < waelder.length; w++) {
    var poly = waelder[w].map(function (p) { return weltPunkt(p, breite, hoehe, half); });
    if (poly.length < 3) continue;
    var minX = breite, minY = hoehe, maxX = 0, maxY = 0;
    for (var p = 0; p < poly.length; p++) {
      minX = Math.min(minX, poly[p].x); minY = Math.min(minY, poly[p].y);
      maxX = Math.max(maxX, poly[p].x); maxY = Math.max(maxY, poly[p].y);
    }
    for (var y = minY; y <= maxY; y += schritt * .72) for (var x = minX; x <= maxX; x += schritt) {
      var jx = x + (hash(x, y, seed + w) - .5) * schritt * .78;
      var jy = y + (hash(x, y, seed + w + 5) - .5) * schritt * .45;
      if (!punktInPoly(jx, jy, poly) || hash(x, y, seed + 21) < .32) continue;
      baum(ctx, jx, jy, schritt * (.46 + hash(x, y, seed + 31) * .18), gezeichnet + w * 10000, stil);
      gezeichnet++;
    }
  }
  return gezeichnet;
}

export function zeichneOrtssignet(ctx, x, y, groesse, art, stil) {
  ctx.save(); ctx.strokeStyle = stil.tinte; ctx.fillStyle = stil.papierCss;
  ctx.lineWidth = Math.max(.8, groesse * .11); ctx.lineJoin = "round";
  if (art === "burg") {
    ctx.strokeRect(x - groesse * .42, y - groesse * .22, groesse * .84, groesse * .62);
    for (var i = -1; i <= 1; i++) ctx.strokeRect(x + i * groesse * .35 - groesse * .13, y - groesse * .5, groesse * .26, groesse * .34);
  } else {
    ctx.beginPath(); ctx.arc(x, y, groesse * .28, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - groesse * .48, y + groesse * .35); ctx.lineTo(x, y - groesse * .5);
    ctx.lineTo(x + groesse * .48, y + groesse * .35); ctx.stroke();
  }
  ctx.restore();
}

export function zeichneKompassrose(ctx, x, y, r, stil) {
  ctx.save(); ctx.translate(x, y); ctx.strokeStyle = stil.tinte; ctx.fillStyle = stil.tinte;
  ctx.lineWidth = Math.max(1, r * .045); ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath();
  for (var i = 0; i < 16; i++) {
    var a = -Math.PI / 2 + i * Math.PI / 8, rr = i % 4 === 0 ? r * .95 : (i % 2 === 0 ? r * .62 : r * .4);
    var x1 = Math.cos(a) * rr, y1 = Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(x1, y1); else ctx.lineTo(x1, y1);
  }
  ctx.closePath(); ctx.stroke();
  for (var k = 0; k < 4; k++) {
    var aa = -Math.PI / 2 + k * Math.PI / 2;
    ctx.beginPath(); ctx.moveTo(Math.cos(aa) * r * .88, Math.sin(aa) * r * .88);
    ctx.lineTo(Math.cos(aa + .18) * r * .18, Math.sin(aa + .18) * r * .18);
    ctx.lineTo(0, 0); ctx.closePath(); ctx.fillStyle = k % 2 ? stil.tinte : stil.akzent; ctx.fill();
  }
  ctx.fillStyle = stil.tinte; ctx.font = "600 " + Math.max(10, r * .48) + "px Georgia, serif";
  ctx.textAlign = "center"; ctx.fillText("N", 0, -r - r * .22); ctx.restore();
}
